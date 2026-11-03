// Native WebGL2 Point Cloud Renderer adhering to PPTK architecture
// Supports 256 discrete independent colors via a 1D Texture LUT (Sampler1D in PPTK)

import { create256ColorLUT } from './lut256.js';
import { PPTKBackground, PPTKLookAt, PPTKFloorGrid } from './pptk_scene.js';

export class WebGL2PointRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: true,
      stencil: false,
      preserveDrawingBuffer: true, // Enables progressive fine rendering like PPTK
      powerPreference: 'high-performance'
    });

    if (!this.gl) {
      throw new Error('WebGL2 no soportado.');
    }

    this.activeColorMap = -1; // -1: 256-Color Discrete LUT, 0: Jet Z, 1: Viridis Z, 2: Plasma Z, 3: Gray Z
    this.minZ = 0.0;
    this.maxZ = 1.0;
    this.floorZ = 0.0;

    this.background = new PPTKBackground(this.gl);
    this.lookAtWidget = new PPTKLookAt(this.gl);
    this.floorGrid = new PPTKFloorGrid(this.gl, this.canvas);

    this.showBackground = true;
    this.showGrid = true;
    this.showAxis = true;

    this._initLutTexture();
    this._initPointShader();
    this._initBoxShader();
    this._initBuffers();

    this.totalCapacity = 0;
    this.currentPoints = 0;
    this.drawAllPoints = true;
    this.maxRenderBudget = 50000000;
    this.drawStride = 1;
    this.activeDrawCount = 0;

    // Interactive LOD Index Buffer (like PPTK's _buffer_octree_ids)
    this.maxLodPoints = 2000000; // 2 million points during camera movement = 60 FPS
    this.lodCount = 0;
    this.lodEbo = null;

    // Progressive Fine Render state (matching Viewer::renderPointsFine())
    this.fineRenderOffset = 0;
    this.fineRenderChunkSize = 2500000; // 2.5M points per progressive slice
    this.isFineRendering = false;

    // Selection box state
    this.boxActive = false;
    this.boxStart = [0, 0];
    this.boxEnd = [0, 0];
  }

  startFineRender() {
    this.fineRenderOffset = 0;
    this.isFineRendering = true;
  }

  stopFineRender() {
    this.isFineRendering = false;
    this.fineRenderOffset = 0;
  }

  // Exact 256-color palette uploaded as a 1D texture for zero-cost hardware lookup
  _initLutTexture() {
    const gl = this.gl;
    this.lutTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);

    const lutData = create256ColorLUT(); // 256 entries * 4 (RGBA)

    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, lutData
    );

    // NEAREST filtering ensures EACH integer class has a completely discrete independent color (no blurred gradient)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  _initPointShader() {
    const gl = this.gl;

    const vsSource = `#version 300 es
      precision highp float;
      
      layout(location = 0) in vec3 a_position;
      layout(location = 1) in vec4 a_color;

      uniform mat4 u_mvp;
      uniform float u_point_size;
      uniform vec2 u_resolution;
      uniform int u_colormap_mode; // -1: discrete LUT 256, 0: jet, 1: viridis, 2: plasma, 3: gray
      uniform vec2 u_z_range;
      uniform sampler2D u_lut256;

      out vec4 v_color;
      out vec2 v_point_center;
      out float v_radius;

      vec3 colormapJet(float t) {
        t = clamp(t, 0.0, 1.0);
        float r = clamp(min(4.0 * t - 1.5, -4.0 * t + 4.5), 0.0, 1.0);
        float g = clamp(min(4.0 * t - 0.5, -4.0 * t + 3.5), 0.0, 1.0);
        float b = clamp(min(4.0 * t + 0.5, -4.0 * t + 2.5), 0.0, 1.0);
        return vec3(r, g, b);
      }

      vec3 colormapViridis(float t) {
        t = clamp(t, 0.0, 1.0);
        vec3 c0 = vec3(0.267, 0.004, 0.329);
        vec3 c1 = vec3(0.127, 0.566, 0.550);
        vec3 c2 = vec3(0.993, 0.906, 0.143);
        return (t < 0.5) ? mix(c0, c1, t * 2.0) : mix(c1, c2, (t - 0.5) * 2.0);
      }

      vec3 colormapPlasma(float t) {
        t = clamp(t, 0.0, 1.0);
        vec3 c0 = vec3(0.050, 0.029, 0.528);
        vec3 c1 = vec3(0.798, 0.280, 0.469);
        vec3 c2 = vec3(0.940, 0.975, 0.131);
        return (t < 0.5) ? mix(c0, c1, t * 2.0) : mix(c1, c2, (t - 0.5) * 2.0);
      }

      void main() {
        gl_Position = u_mvp * vec4(a_position, 1.0);
        float dist = max(gl_Position.w, 0.001);
        
        // Anti-aliased Point Sprite sizing matching PPTK's point_cloud.h
        float rawSize = (u_point_size / dist) * u_resolution.y * 0.5;
        float pointRadius = clamp(rawSize, 2.0, 36.0);
        gl_PointSize = pointRadius * 2.0;
        v_radius = pointRadius;

        if (u_colormap_mode == -1) {
          // Direct 1D discrete LUT sample for class integer (0..255)
          // Center of texel i is (i + 0.5) / 256.0
          float classIdx = a_color.r * 255.0;
          float texCoordX = (classIdx + 0.5) / 256.0;
          v_color = texture(u_lut256, vec2(texCoordX, 0.5));
        } else {
          float span = max(0.0001, u_z_range.y - u_z_range.x);
          float t = clamp((a_position.z - u_z_range.x) / span, 0.0, 1.0);
          vec3 rgb = vec3(1.0);
          if (u_colormap_mode == 0) rgb = colormapJet(t);
          else if (u_colormap_mode == 1) rgb = colormapViridis(t);
          else if (u_colormap_mode == 2) rgb = colormapPlasma(t);
          else if (u_colormap_mode == 3) rgb = vec3(t);
          v_color = vec4(rgb, 1.0);
        }
      }
    `;

    const fsSource = `#version 300 es
      precision mediump float;
      in vec4 v_color;
      in float v_radius;
      out vec4 fragColor;

      // Antialiased circular point sprite matching PPTK native point_cloud.h
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord) * 2.0; // 0.0 at center, 1.0 at edge
        if (dist > 1.0) discard;
        float alpha = clamp((1.0 - dist) * v_radius * 0.5, 0.0, 1.0);
        fragColor = vec4(v_color.rgb, v_color.a * alpha);
      }
    `;

    this.program = this._createProgram(vsSource, fsSource);
    this.uMVP = gl.getUniformLocation(this.program, 'u_mvp');
    this.uPointSize = gl.getUniformLocation(this.program, 'u_point_size');
    this.uResolution = gl.getUniformLocation(this.program, 'u_resolution');
    this.uColorMapMode = gl.getUniformLocation(this.program, 'u_colormap_mode');
    this.uZRange = gl.getUniformLocation(this.program, 'u_z_range');
    this.uLut256 = gl.getUniformLocation(this.program, 'u_lut256');
  }

  _initBoxShader() {
    const gl = this.gl;
    const vsBox = `#version 300 es
      precision highp float;
      layout(location = 0) in vec2 a_corner;
      uniform vec2 u_box_min;
      uniform vec2 u_box_max;
      void main() {
        vec2 p = a_corner * (u_box_max - u_box_min) + u_box_min;
        gl_Position = vec4(p, 0.0, 1.0);
      }
    `;
    const fsBox = `#version 300 es
      precision mediump float;
      out vec4 fragColor;
      void main() {
        fragColor = vec4(1.0, 0.9, 0.0, 1.0);
      }
    `;
    this.boxProgram = this._createProgram(vsBox, fsBox);
    this.uBoxMin = gl.getUniformLocation(this.boxProgram, 'u_box_min');
    this.uBoxMax = gl.getUniformLocation(this.boxProgram, 'u_box_max');
  }

  _createProgram(vsSource, fsSource) {
    const gl = this.gl;
    const compile = (src, type) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compile(vsSource, gl.VERTEX_SHADER));
    gl.attachShader(p, compile(fsSource, gl.FRAGMENT_SHADER));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  _initBuffers() {
    const gl = this.gl;

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);

    const stride = 16;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, stride, 12);
    gl.bindVertexArray(null);

    // Dynamic Element Buffer Object for interactive LOD indices
    this.lodEbo = gl.createBuffer();

    this.boxVao = gl.createVertexArray();
    gl.bindVertexArray(this.boxVao);
    this.boxVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.boxVbo);
    const boxVertices = new Float32Array([
      0, 0,  1, 0,  1, 1,  0, 1,  0, 0
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, boxVertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  allocateCapacity(totalPoints) {
    const gl = this.gl;
    this.totalCapacity = totalPoints;
    this.currentPoints = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, totalPoints * 16, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this._updateDrawStride();
  }

  uploadChunkInterleaved(buffer, offsetIndex, count) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, offsetIndex * 16, buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.currentPoints = offsetIndex + count;
    this._updateDrawStride();
  }

  _updateDrawStride() {
    this.drawStride = 1;
    this.activeDrawCount = this.currentPoints;
    this._updateLodIndexBuffer();
  }

  // Generates evenly spaced indices across the entire point buffer for 60 FPS interaction
  _updateLodIndexBuffer() {
    if (this.currentPoints === 0) return;
    const gl = this.gl;
    const targetCount = Math.min(this.currentPoints, this.maxLodPoints);
    const stride = Math.max(1, Math.floor(this.currentPoints / targetCount));
    const count = Math.floor(this.currentPoints / stride);

    const indices = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
      indices[i] = i * stride;
    }

    this.lodCount = count;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lodEbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }

  setColorMap(mode) {
    this.activeColorMap = mode;
  }

  setZRange(minZ, maxZ) {
    this.minZ = minZ;
    this.maxZ = maxZ;
    this.floorZ = minZ;
    this.floorGrid.floorZ = minZ;
  }

  setFloorLevel(z) {
    this.floorZ = z;
    this.floorGrid.floorZ = z;
  }

  setSelectionBox(active, startNdc, endNdc) {
    this.boxActive = active;
    if (active) {
      this.boxStart = startNdc;
      this.boxEnd = endNdc;
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const displayWidth = Math.floor(this.canvas.clientWidth * dpr);
    const displayHeight = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      this.gl.viewport(0, 0, displayWidth, displayHeight);
    }
  }

  render(camera, mvpMatrix, pointSize = 0.015, isInteracting = false) {
    const gl = this.gl;
    this.resize();

    // 1. Clear background
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 2. Render PPTK Gradient Background
    if (this.showBackground) {
      this.background.draw();
    }

    // 3. Render PPTK Floor Grid
    if (this.showGrid && camera) {
      this.floorGrid.draw(camera, this.floorZ);
    }

    // 4. Render Point Cloud
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);

    if (this.currentPoints > 0) {
      gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.uMVP, false, mvpMatrix);

      const isLod = isInteracting && (this.currentPoints > this.maxLodPoints);
      const strideRatio = isLod ? Math.sqrt(this.currentPoints / this.lodCount) : 1.0;
      const adjustedPointSize = pointSize * strideRatio;

      gl.uniform1f(this.uPointSize, adjustedPointSize);
      gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
      gl.uniform1i(this.uColorMapMode, this.activeColorMap);
      gl.uniform2f(this.uZRange, this.minZ, this.maxZ);

      // Bind 256-color LUT texture to unit 0
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
      gl.uniform1i(this.uLut256, 0);

      gl.bindVertexArray(this.vao);

      if (isLod && this.lodCount > 0) {
        // Native PPTK LOD draw via Element Array Buffer (Index Buffer) at 60 FPS
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lodEbo);
        gl.drawElements(gl.POINTS, this.lodCount, gl.UNSIGNED_INT, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      } else {
        // Full Render: 100% of points rendered directly or starting progressive refinement
        gl.drawArrays(gl.POINTS, 0, this.currentPoints);
      }

      gl.bindVertexArray(null);
    }
    gl.disable(gl.BLEND);

    // 5. Render LookAt Widget (Crosshair axes at target)
    if (this.showAxis && camera) {
      this.lookAtWidget.draw(camera, mvpMatrix);
    }

    // 6. Render Selection Box
    if (this.boxActive) {
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(this.boxProgram);

      const minX = Math.min(this.boxStart[0], this.boxEnd[0]);
      const maxX = Math.max(this.boxStart[0], this.boxEnd[0]);
      const minY = Math.min(this.boxStart[1], this.boxEnd[1]);
      const maxY = Math.max(this.boxStart[1], this.boxEnd[1]);

      gl.uniform2f(this.uBoxMin, minX, minY);
      gl.uniform2f(this.uBoxMax, maxX, maxY);

      gl.bindVertexArray(this.boxVao);
      gl.drawArrays(gl.LINE_STRIP, 0, 5);
      gl.bindVertexArray(null);
      gl.enable(gl.DEPTH_TEST);
    }
  }
}
