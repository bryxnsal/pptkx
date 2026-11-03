// Native PPTK Scene Helpers: Background, LookAt Crosshair, and FloorGrid
// Faithfully ported from pptk/viewer/background.h, pptk/viewer/look_at.h, pptk/viewer/floor_grid.h

export class PPTKBackground {
  constructor(gl) {
    this.gl = gl;
    this.colorTop = [0.0, 0.0, 0.0, 1.0];
    this.colorBottom = [0.23, 0.23, 0.44, 1.0];

    const vs = `#version 300 es
      precision highp float;
      layout(location = 0) in vec2 a_pos;
      out vec2 v_coord;
      void main() {
        v_coord = a_pos;
        gl_Position = vec4(2.0 * a_pos - 1.0, 0.99999, 1.0);
      }
    `;

    const fs = `#version 300 es
      precision mediump float;
      in vec2 v_coord;
      uniform vec4 u_colorBottom;
      uniform vec4 u_colorTop;
      out vec4 fragColor;
      void main() {
        fragColor = mix(u_colorBottom, u_colorTop, v_coord.y);
      }
    `;

    this.program = this._createProgram(vs, fs);
    this.uColorBottom = gl.getUniformLocation(this.program, 'u_colorBottom');
    this.uColorTop = gl.getUniformLocation(this.program, 'u_colorTop');

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);

    // Quad (0,0) to (1,1)
    const vertices = new Float32Array([
      0.0, 0.0,
      1.0, 0.0,
      1.0, 1.0,
      0.0, 0.0,
      1.0, 1.0,
      0.0, 1.0
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  _createProgram(vsSrc, fsSrc) {
    const gl = this.gl;
    const s1 = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(s1, vsSrc);
    gl.compileShader(s1);
    if (!gl.getShaderParameter(s1, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s1));

    const s2 = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(s2, fsSrc);
    gl.compileShader(s2);
    if (!gl.getShaderParameter(s2, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s2));

    const p = gl.createProgram();
    gl.attachShader(p, s1);
    gl.attachShader(p, s2);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  draw() {
    const gl = this.gl;
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);

    gl.useProgram(this.program);
    gl.uniform4fv(this.uColorBottom, this.colorBottom);
    gl.uniform4fv(this.uColorTop, this.colorTop);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);

    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }
}

export class PPTKLookAt {
  constructor(gl) {
    this.gl = gl;
    this.visible = true;

    const vs = `#version 300 es
      precision highp float;
      layout(location = 0) in vec3 a_position;
      layout(location = 1) in vec3 a_color;
      uniform float u_d;
      uniform vec3 u_lookat;
      uniform mat4 u_mvp;
      out vec3 v_color;
      void main() {
        gl_Position = u_mvp * vec4(u_d * a_position + u_lookat, 1.0);
        v_color = a_color;
      }
    `;

    const fs = `#version 300 es
      precision mediump float;
      in vec3 v_color;
      out vec4 fragColor;
      void main() {
        fragColor = vec4(v_color, 1.0);
      }
    `;

    this.program = this._createProgram(vs, fs);
    this.uD = gl.getUniformLocation(this.program, 'u_d');
    this.uLookat = gl.getUniformLocation(this.program, 'u_lookat');
    this.uMVP = gl.getUniformLocation(this.program, 'u_mvp');

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    // 6 vertices for 3 axes: X (red), Y (green), Z (blue)
    const positions = new Float32Array([
      0.0, 0.0, 0.0,   1.0, 0.0, 0.0, // X
      0.0, 0.0, 0.0,   0.0, 1.0, 0.0, // Y
      0.0, 0.0, 0.0,   0.0, 0.0, 1.0  // Z
    ]);

    const colors = new Float32Array([
      1.0, 0.0, 0.0,   1.0, 0.0, 0.0,
      0.0, 1.0, 0.0,   0.0, 1.0, 0.0,
      0.0, 0.0, 1.0,   0.0, 0.0, 1.0
    ]);

    this.posVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posVbo);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    this.colVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colVbo);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  _createProgram(vsSrc, fsSrc) {
    const gl = this.gl;
    const s1 = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(s1, vsSrc);
    gl.compileShader(s1);
    if (!gl.getShaderParameter(s1, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s1));

    const s2 = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(s2, fsSrc);
    gl.compileShader(s2);
    if (!gl.getShaderParameter(s2, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s2));

    const p = gl.createProgram();
    gl.attachShader(p, s1);
    gl.attachShader(p, s2);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  draw(camera, mvpMatrix) {
    if (!this.visible) return;
    const gl = this.gl;
    const d = 0.0625 * camera.d;

    gl.useProgram(this.program);
    gl.uniform1f(this.uD, d);
    gl.uniform3fv(this.uLookat, camera.lookAt);
    gl.uniformMatrix4fv(this.uMVP, false, mvpMatrix);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.LINES, 0, 6);
    gl.bindVertexArray(null);
  }
}

// Sector helper class for floor horizon calculation (from floor_grid.h)
class Sector {
  constructor(start = 0.0, end = -1.0) {
    this._start = start;
    this._end = end;
    if (!this.empty()) {
      Sector.normalizeRange(this);
    }
  }

  empty() {
    return this._start === 0.0 && this._end === -1.0;
  }

  contains(angle) {
    angle = Sector.normalize(angle);
    if (angle >= this._start) return angle <= this._end;
    return angle + 2.0 * Math.PI <= this._end;
  }

  intersect(other) {
    let a = this;
    let b = other;
    if (a._start > b._start) {
      a = other;
      b = this;
    }

    if (b._start <= a._end) {
      return new Sector(b._start, Math.min(a._end, b._end));
    } else if (b._end >= a._start + 2.0 * Math.PI) {
      return new Sector(a._start + 2.0 * Math.PI, Math.min(a._end + 2.0 * Math.PI, b._end));
    }
    return new Sector();
  }

  static normalizeRange(sec) {
    const fullCircle = sec._end - sec._start >= 2.0 * Math.PI;
    if (fullCircle) {
      sec._start = 0;
      sec._end = 2.0 * Math.PI;
    } else {
      sec._start = Sector.normalize(sec._start);
      sec._end = Sector.normalize(sec._end);
      if (sec._end < sec._start) sec._end += 2.0 * Math.PI;
    }
  }

  static normalize(x) {
    return x - Math.floor(x / (2.0 * Math.PI)) * 2.0 * Math.PI;
  }
}

export class PPTKFloorGrid {
  constructor(gl, canvas) {
    this.gl = gl;
    this.canvas = canvas;
    this.visible = true;

    this.gridLineColor = [0.7, 0.7, 0.7, 1.0];
    this.gridFloorColor = [0.3, 0.3, 0.3, 0.5];
    this.floorZ = 0.0;
    this.cellSize = 1.0;
    this.lineWeight = 0.0;

    this._compilePerspProgram();
    this._compileOrthoProgram();
    this._initSquare();
  }

  _compilePerspProgram() {
    const gl = this.gl;
    const vs = `#version 300 es
      precision highp float;
      layout(location = 0) in vec3 position;

      uniform vec3 eye;
      uniform vec3 right;
      uniform vec3 up;
      uniform vec3 view;
      uniform float height;
      uniform float h_lo;
      uniform float h_hi;
      uniform float r;
      uniform float t;

      out vec2 v_floor_coord;
      out float v_distance;

      void main() {
        vec2 image_coord = position.xy * vec2(2.0 * r, h_hi - h_lo) + vec2(-r, h_lo);
        mat3 R = mat3(right, up, view);
        vec3 p_world = R * vec3(image_coord, -1.0);
        p_world *= -height / p_world.z;
        vec3 p_camera = transpose(R) * p_world;
        gl_Position = vec4(p_camera.xy * vec2(1.0 / r, 1.0 / t), 0.0, -p_camera.z);
        v_floor_coord = p_world.xy;
        v_distance = length(p_world);
      }
    `;

    const fs = `#version 300 es
      precision highp float;
      in vec2 v_floor_coord;
      in float v_distance;

      uniform vec3 eye;
      uniform vec3 right;
      uniform vec3 up;
      uniform vec3 view;
      uniform float height;
      uniform vec4 line_color;
      uniform vec4 floor_color;
      uniform float cell_size;
      uniform float line_weight;
      uniform float line_width;
      uniform float max_dist_in_focus;
      uniform float max_dist_visible;

      out vec4 fragColor;

      float compute_weight(vec3 n, vec2 image_coord) {
        vec3 line = transpose(mat3(right, up, view)) * n;
        line /= length(line.xy);
        float eps = -abs(dot(vec3(image_coord, -1.0), line));
        return (eps + line_width) / line_width;
      }

      void main() {
        vec2 cell_idx = floor((v_floor_coord + eye.xy) / cell_size);
        vec2 cell_min = cell_idx * cell_size - eye.xy;
        vec2 cell_max = cell_min + cell_size;
        float i = mod(cell_idx.x, 10.0);
        float j = mod(cell_idx.y, 10.0);
        float x_min_weight = (i == 0.0) ? 1.0 : line_weight;
        float x_max_weight = (i == 9.0) ? 1.0 : line_weight;
        float y_min_weight = (j == 0.0) ? 1.0 : line_weight;
        float y_max_weight = (j == 9.0) ? 1.0 : line_weight;

        vec3 temp = transpose(mat3(right, up, view)) * vec3(v_floor_coord, -height);
        vec2 image_coord = -temp.xy / temp.z;
        float weight = 0.0;
        weight = max(weight, x_min_weight * compute_weight(vec3(height, 0.0, cell_min.x), image_coord));
        weight = max(weight, x_max_weight * compute_weight(vec3(height, 0.0, cell_max.x), image_coord));
        weight = max(weight, y_min_weight * compute_weight(vec3(0.0, height, cell_min.y), image_coord));
        weight = max(weight, y_max_weight * compute_weight(vec3(0.0, height, cell_max.y), image_coord));
        weight *= 0.7;

        float blur_weight = clamp((max_dist_visible - v_distance) / (max_dist_visible - max_dist_in_focus), 0.0, 1.0);
        vec4 c = line_color * weight + floor_color * (1.0 - weight);
        fragColor = vec4(c.xyz, c.w * blur_weight);
      }
    `;

    this.perspProgram = this._createProgram(vs, fs);
    this.p_eye = gl.getUniformLocation(this.perspProgram, 'eye');
    this.p_right = gl.getUniformLocation(this.perspProgram, 'right');
    this.p_up = gl.getUniformLocation(this.perspProgram, 'up');
    this.p_view = gl.getUniformLocation(this.perspProgram, 'view');
    this.p_height = gl.getUniformLocation(this.perspProgram, 'height');
    this.p_h_lo = gl.getUniformLocation(this.perspProgram, 'h_lo');
    this.p_h_hi = gl.getUniformLocation(this.perspProgram, 'h_hi');
    this.p_r = gl.getUniformLocation(this.perspProgram, 'r');
    this.p_t = gl.getUniformLocation(this.perspProgram, 't');
    this.p_line_color = gl.getUniformLocation(this.perspProgram, 'line_color');
    this.p_floor_color = gl.getUniformLocation(this.perspProgram, 'floor_color');
    this.p_cell_size = gl.getUniformLocation(this.perspProgram, 'cell_size');
    this.p_line_weight = gl.getUniformLocation(this.perspProgram, 'line_weight');
    this.p_line_width = gl.getUniformLocation(this.perspProgram, 'line_width');
    this.p_max_dist_in_focus = gl.getUniformLocation(this.perspProgram, 'max_dist_in_focus');
    this.p_max_dist_visible = gl.getUniformLocation(this.perspProgram, 'max_dist_visible');
  }

  _compileOrthoProgram() {
    const gl = this.gl;
    const vs = `#version 300 es
      precision highp float;
      layout(location = 0) in vec3 position;

      uniform vec3 eye;
      uniform vec3 right;
      uniform vec3 up;
      uniform vec3 view;
      uniform float z_floor;
      uniform float r;
      uniform float t;

      out vec2 v_floor_coord;

      void main() {
        vec2 image_coord = (position.xy - 0.5) * 2.0;
        vec3 o = eye + image_coord.x * r * right + image_coord.y * t * up;
        float d = (o.z - z_floor) / view.z;
        v_floor_coord = -view.xy * d + o.xy;
        gl_Position = vec4(image_coord, 0.0, 1.0);
      }
    `;

    const fs = `#version 300 es
      precision highp float;
      in vec2 v_floor_coord;

      uniform float eps_x;
      uniform float eps_y;
      uniform float cell_size;
      uniform float line_weight;
      uniform vec4 floor_color;
      uniform vec4 line_color;

      out vec4 fragColor;

      void main() {
        vec2 cell_idx = floor(v_floor_coord / cell_size);
        vec2 cell_min = cell_idx * cell_size;
        vec2 cell_max = cell_min + cell_size;
        vec2 ij = mod(cell_idx, 10.0);
        float x_min_weight = (ij.x == 0.0) ? 1.0 : line_weight;
        float x_max_weight = (ij.x == 9.0) ? 1.0 : line_weight;
        float y_min_weight = (ij.y == 0.0) ? 1.0 : line_weight;
        float y_max_weight = (ij.y == 9.0) ? 1.0 : line_weight;

        float weight = 0.0;
        weight = max(weight, x_min_weight * (1.0 - (v_floor_coord.x - cell_min.x) / eps_x));
        weight = max(weight, y_min_weight * (1.0 - (v_floor_coord.y - cell_min.y) / eps_y));
        weight = max(weight, x_max_weight * (1.0 + (v_floor_coord.x - cell_max.x) / eps_x));
        weight = max(weight, y_max_weight * (1.0 + (v_floor_coord.y - cell_max.y) / eps_y));
        weight *= 0.7;

        fragColor = floor_color * (1.0 - weight) + line_color * weight;
      }
    `;

    this.orthoProgram = this._createProgram(vs, fs);
    this.o_eye = gl.getUniformLocation(this.orthoProgram, 'eye');
    this.o_right = gl.getUniformLocation(this.orthoProgram, 'right');
    this.o_up = gl.getUniformLocation(this.orthoProgram, 'up');
    this.o_view = gl.getUniformLocation(this.orthoProgram, 'view');
    this.o_z_floor = gl.getUniformLocation(this.orthoProgram, 'z_floor');
    this.o_r = gl.getUniformLocation(this.orthoProgram, 'r');
    this.o_t = gl.getUniformLocation(this.orthoProgram, 't');
    this.o_eps_x = gl.getUniformLocation(this.orthoProgram, 'eps_x');
    this.o_eps_y = gl.getUniformLocation(this.orthoProgram, 'eps_y');
    this.o_cell_size = gl.getUniformLocation(this.orthoProgram, 'cell_size');
    this.o_line_weight = gl.getUniformLocation(this.orthoProgram, 'line_weight');
    this.o_floor_color = gl.getUniformLocation(this.orthoProgram, 'floor_color');
    this.o_line_color = gl.getUniformLocation(this.orthoProgram, 'line_color');
  }

  _initSquare() {
    const gl = this.gl;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    const points = new Float32Array([
      0.0, 0.0, 0.0,
      1.0, 0.0, 0.0,
      1.0, 1.0, 0.0,
      0.0, 1.0, 0.0
    ]);
    const indices = new Uint16Array([
      0, 1, 2,
      0, 2, 3
    ]);

    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);

    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  _createProgram(vsSrc, fsSrc) {
    const gl = this.gl;
    const s1 = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(s1, vsSrc);
    gl.compileShader(s1);
    if (!gl.getShaderParameter(s1, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s1));

    const s2 = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(s2, fsSrc);
    gl.compileShader(s2);
    if (!gl.getShaderParameter(s2, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s2));

    const p = gl.createProgram();
    gl.attachShader(p, s1);
    gl.attachShader(p, s2);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  normalizeAngle(angle) {
    const PI = Math.PI;
    angle = angle - Math.floor(angle / (2.0 * PI)) * 2.0 * PI;
    if (angle > PI) angle -= 2.0 * PI;
    return angle;
  }

  visibleDistance(cellSize, projectedCellSize, camera, zFloor) {
    const eye = [0, 0, 0];
    camera.getCameraPosition(eye);
    const eyeFloorHeight = Math.abs(eye[2] - zFloor);
    const h = this.canvas.height;
    return Math.sqrt(cellSize * eyeFloorHeight * h / projectedCellSize / (2.0 * Math.tan(45.0 / 2.0 / 180.0 * Math.PI)));
  }

  computeHorizon(camera, zFloor, cellSize) {
    const projectedCellSize = 5.0;
    const alpha = (45.0 / 180.0) * Math.PI;
    const eye = [0, 0, 0];
    camera.getCameraPosition(eye);
    const eyeFloorHeight = eye[2] - zFloor;

    const dMax = 2.0 * this.visibleDistance(cellSize, projectedCellSize, camera, zFloor);
    if (Math.abs(eyeFloorHeight) > dMax) return null;

    const thetaMax = Math.asin(Math.max(-1.0, Math.min(1.0, eyeFloorHeight / dMax)));
    const theta = this.normalizeAngle(camera.theta);

    let floorSector;
    if (eyeFloorHeight < 0.0) {
      floorSector = new Sector(-Math.PI - thetaMax, thetaMax);
    } else {
      floorSector = new Sector(thetaMax, Math.PI - thetaMax);
    }

    const cameraSector = new Sector(theta - 0.5 * alpha, theta + 0.5 * alpha);
    const horizonSector = cameraSector.intersect(floorSector);
    if (horizonSector.empty()) return null;

    const h_lo = Math.tan(-horizonSector._end + theta);
    const h_hi = Math.tan(-horizonSector._start + theta);
    return { h_lo, h_hi };
  }

  computeCellSize(camera, zFloor) {
    const projectedCellSize = 150.0;
    const alpha = (45.0 / 180.0) * Math.PI;
    const d = camera.d + Math.abs(camera.lookAt[2] - zFloor);
    const d_0 = (this.canvas.height / 2.0) / Math.tan(alpha / 2.0) / projectedCellSize;
    const x = Math.log(Math.max(1e-6, d / d_0)) / Math.log(10.0);
    const x_ = Math.floor(x);
    this.lineWeight = 1.0 - (x - x_);
    this.cellSize = Math.pow(10.0, x_);
  }

  draw(camera, zFloor = null) {
    if (!this.visible) return;
    const floorZ = (zFloor !== null) ? zFloor : this.floorZ;
    if (camera.projectionMode === 0) {
      this.drawPersp(camera, floorZ);
    } else {
      this.drawOrtho(camera, floorZ);
    }
  }

  drawPersp(camera, zFloor) {
    const gl = this.gl;
    this.computeCellSize(camera, zFloor);

    const weightedCellSize = this.cellSize * Math.pow(10.0, 1.0 - this.lineWeight);
    const maxDistInFocus = this.visibleDistance(weightedCellSize, 5.0, camera, zFloor);
    const maxDistVisible = 2.0 * maxDistInFocus;

    const horizon = this.computeHorizon(camera, zFloor, weightedCellSize);
    if (!horizon) return;

    const t = Math.tan((45.0 / 2.0 / 180.0) * Math.PI);
    const r = t * this.canvas.width / this.canvas.height;
    const dpr = window.devicePixelRatio || 1;
    const lineWidth = (1.2 / this.canvas.height / dpr) * 2.0 * t;

    const eye = [0, 0, 0];
    const right = [0, 0, 0];
    const up = [0, 0, 0];
    const view = [0, 0, 0];
    camera.getCameraPosition(eye);
    camera.computeRightVector(right, camera.theta, camera.phi);
    camera.computeUpVector(up, camera.theta, camera.phi);
    camera.computeViewVector(view, camera.theta, camera.phi);

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);

    gl.useProgram(this.perspProgram);
    gl.uniform3fv(this.p_eye, eye);
    gl.uniform3fv(this.p_right, right);
    gl.uniform3fv(this.p_up, up);
    gl.uniform3fv(this.p_view, view);
    gl.uniform1f(this.p_height, eye[2] - zFloor);
    gl.uniform1f(this.p_cell_size, this.cellSize);
    gl.uniform1f(this.p_line_weight, this.lineWeight);
    gl.uniform4fv(this.p_line_color, this.gridLineColor);
    gl.uniform4fv(this.p_floor_color, this.gridFloorColor);
    gl.uniform1f(this.p_max_dist_in_focus, maxDistInFocus);
    gl.uniform1f(this.p_max_dist_visible, maxDistVisible);
    gl.uniform1f(this.p_h_lo, horizon.h_lo);
    gl.uniform1f(this.p_h_hi, horizon.h_hi);
    gl.uniform1f(this.p_t, t);
    gl.uniform1f(this.p_r, r);
    gl.uniform1f(this.p_line_width, lineWidth);

    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }

  drawOrtho(camera, zFloor) {
    const gl = this.gl;
    const t = camera.d * Math.tan(0.5 * camera.vfov);
    const r = camera.aspectRatio * t;
    const actualZFloor = (camera.viewAxis !== 0) ? 0.0 : zFloor;

    const dpr = window.devicePixelRatio || 1;
    const deltaPixels = 1.0;
    const deltaImage = (deltaPixels / this.canvas.height / dpr) * 2.0 * t;

    let eps_x = deltaImage;
    let eps_y = deltaImage;

    if (camera.viewAxis === 0) {
      const tanTheta = Math.tan(camera.theta);
      const sinPhi = Math.sin(camera.phi);
      const cosPhi = Math.cos(camera.phi);
      const tanTheta2 = tanTheta * tanTheta;
      const sinPhi2 = sinPhi * sinPhi;
      const cosPhi2 = cosPhi * cosPhi;
      eps_x = deltaImage * Math.sqrt(1.0 + cosPhi2 / (tanTheta2 || 1e-6));
      eps_y = deltaImage * Math.sqrt(1.0 + sinPhi2 / (tanTheta2 || 1e-6));
    }

    this.computeCellSize(camera, actualZFloor);

    let lineColor = [...this.gridLineColor];
    if (camera.viewAxis === 0) {
      const a = 0.1;
      const b = 0.2;
      const fadeWeight = Math.min(1.2, Math.max(0.0, (Math.abs(Math.sin(camera.theta)) - a) / (b - a)));
      lineColor = [
        this.gridFloorColor[0] * (1.0 - fadeWeight) + this.gridLineColor[0] * fadeWeight,
        this.gridFloorColor[1] * (1.0 - fadeWeight) + this.gridLineColor[1] * fadeWeight,
        this.gridFloorColor[2] * (1.0 - fadeWeight) + this.gridLineColor[2] * fadeWeight,
        this.gridFloorColor[3] * (1.0 - fadeWeight) + this.gridLineColor[3] * fadeWeight
      ];
    }

    const eye = [0, 0, 0];
    const right = [0, 0, 0];
    const up = [0, 0, 0];
    const view = [0, 0, 0];

    if (camera.viewAxis === 0) {
      camera.getCameraPosition(eye);
      camera.computeRightVector(right, camera.theta, camera.phi);
      camera.computeUpVector(up, camera.theta, camera.phi);
      camera.computeViewVector(view, camera.theta, camera.phi);
    } else {
      camera.getCameraPosition(eye);
      if (camera.viewAxis === 1) { // X_AXIS
        eye[0] = -eye[2]; eye[1] = eye[1]; eye[2] = 1.0;
      } else if (camera.viewAxis === 2) { // Y_AXIS
        eye[0] = -eye[2]; eye[1] = eye[0]; eye[2] = 1.0;
      } else { // Z_AXIS
        eye[0] = -eye[1]; eye[1] = eye[0]; eye[2] = 1.0;
      }
      right[0] = 0.0; right[1] = 1.0; right[2] = 0.0;
      up[0] = -1.0; up[1] = 0.0; up[2] = 0.0;
      view[0] = 0.0; view[1] = 0.0; view[2] = 1.0;
    }

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);

    gl.useProgram(this.orthoProgram);
    gl.uniform3fv(this.o_eye, eye);
    gl.uniform3fv(this.o_right, right);
    gl.uniform3fv(this.o_up, up);
    gl.uniform3fv(this.o_view, view);
    gl.uniform1f(this.o_t, t);
    gl.uniform1f(this.o_r, r);
    gl.uniform1f(this.o_z_floor, actualZFloor);
    gl.uniform1f(this.o_eps_x, eps_x);
    gl.uniform1f(this.o_eps_y, eps_y);
    gl.uniform1f(this.o_cell_size, this.cellSize);
    gl.uniform1f(this.o_line_weight, this.lineWeight);
    gl.uniform4fv(this.o_line_color, lineColor);
    gl.uniform4fv(this.o_floor_color, this.gridFloorColor);

    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
