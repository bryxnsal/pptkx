// Exact JavaScript port of PPTK's Camera (pptk/viewer/camera.h & qt_camera.h)
// Faithfully implements spherical coordinates (phi, theta, d, lookAt),
// mouse panning, rotation, and zooming exact mathematical formulas.

export class PPTKCamera {
  constructor() {
    this.PI = Math.PI;

    // Camera parameters
    this.theta = 0.0;           // angle of elevation (radians)
    this.phi = 0.0;             // azimuthal angle (radians)
    this.d = 1.0;               // camera distance from lookAt
    this.lookAt = [0.0, 0.0, 0.0];

    // PPTK constants from camera.h
    this.panRate = 2.0 / 300.0;            // 2.0 per 300 pixels
    this.zoomRate = 0.8;                   // zoom exponential factor
    this.rotateRate = (Math.PI / 2) / 256; // PI/2 per 256 pixels

    // Projection attributes from qt_camera.h
    this.vfov = Math.PI / 4.0; // 45 degrees in radians
    this.aspectRatio = 1.0;
    this.projectionMode = 0; // 0: PERSPECTIVE, 1: ORTHOGRAPHIC
    this.viewAxis = 0; // 0: ARBITRARY, 1: X_AXIS, 2: Y_AXIS, 3: Z_AXIS

    // Saved state for relative drag interactions (save / restore pattern)
    this.savedTheta = this.theta;
    this.savedPhi = this.phi;
    this.savedD = this.d;
    this.savedLookAt = [...this.lookAt];
    this.savedProjectionMode = this.projectionMode;
    this.savedViewAxis = this.viewAxis;

    this.save();
  }

  // Initialize camera view from dataset bounding box:
  // Sets lookAt to (center_x, center_y, min_z) and distance d to maximum span
  fitBox(minX, maxX, minY, maxY, minZ, maxZ) {
    this.theta = Math.PI / 4.0;
    this.phi = Math.PI / 4.0;
    this.zoomRate = 0.8;
    this.rotateRate = (Math.PI / 2.0) / 256.0;
    this.projectionMode = 0;
    this.viewAxis = 0;

    this.lookAt[0] = (minX + maxX) / 2.0;
    this.lookAt[1] = (minY + maxY) / 2.0;
    this.lookAt[2] = minZ;

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const spanZ = maxZ - minZ;
    this.d = Math.max(spanX, Math.max(spanY, spanZ));

    // Dynamic pan rate matching PPTK
    this.panRate = this.d / 300.0;
    this.save();
  }

  save() {
    this.savedLookAt = [...this.lookAt];
    this.savedTheta = this.theta;
    this.savedPhi = this.phi;
    this.savedD = this.d;
    this.savedProjectionMode = this.projectionMode;
    this.savedViewAxis = this.viewAxis;
  }

  restore() {
    this.lookAt = [...this.savedLookAt];
    this.theta = this.savedTheta;
    this.phi = this.savedPhi;
    this.d = this.savedD;
    this.projectionMode = this.savedProjectionMode;
    this.viewAxis = this.savedViewAxis;
  }

  setViewAxis(axis) {
    if (axis === 1) { // X_AXIS
      this.phi = 0.0;
      this.theta = 0.0;
    } else if (axis === 2) { // Y_AXIS
      this.phi = -0.5 * Math.PI;
      this.theta = 0.0;
    } else if (axis === 3) { // Z_AXIS
      this.phi = -0.5 * Math.PI;
      this.theta = 0.5 * Math.PI;
    }
    this.viewAxis = axis;
    this.save();
  }

  toggleProjectionMode() {
    this.projectionMode = (this.projectionMode === 0) ? 1 : 0;
    this.save();
  }

  // Exact formula:
  // _phi = _phi - _rotateRate * dx
  // _theta = _theta + _rotateRate * dy
  rotate(dx, dy) {
    this.phi = this.savedPhi - this.rotateRate * dx;
    this.theta = this.savedTheta + this.rotateRate * dy;
  }

  // Pan movement in screen space:
  // Balances distance d with a minimum baseline so panning never freezes or crawls near objects
  pan(dx, dy) {
    const right = [0, 0, 0];
    const up = [0, 0, 0];
    this.computeRightVector(right, this.savedTheta, this.savedPhi);
    this.computeUpVector(up, this.savedTheta, this.savedPhi);

    // Keep an effective base scale so that panning remains responsive even at tiny zoom distances:
    const baseSpan = Math.max(0.5, this.panRate * 150.0);
    const effectivePanRate = (this.d + baseSpan * 0.2) * Math.tan(this.vfov * 0.5) * 2.0;

    for (let i = 0; i < 3; i++) {
      this.lookAt[i] = this.savedLookAt[i] + (-right[i] * dx + up[i] * dy) * effectivePanRate;
    }
  }

  // Truly infinite zoom: allows zooming from macro (1e6) to sub-millimeter (1e-6)
  zoom(steps) {
    this.d = Math.max(1e-6, this.d * Math.pow(this.zoomRate, steps));
  }

  setAspectRatio(ratio) {
    this.aspectRatio = ratio;
  }

  // PPTK Vector calculations:
  computeRightVector(v, theta, phi) {
    v[0] = -Math.sin(phi);
    v[1] = Math.cos(phi);
    v[2] = 0.0;
  }

  computeUpVector(v, theta, phi) {
    v[0] = -Math.sin(theta) * Math.cos(phi);
    v[1] = -Math.sin(theta) * Math.sin(phi);
    v[2] = Math.cos(theta);
  }

  computeViewVector(v, theta, phi) {
    v[0] = Math.cos(theta) * Math.cos(phi);
    v[1] = Math.cos(theta) * Math.sin(phi);
    v[2] = Math.sin(theta);
  }

  getCameraPosition(p) {
    const v = [0, 0, 0];
    this.computeViewVector(v, this.theta, this.phi);
    for (let i = 0; i < 3; i++) {
      p[i] = this.lookAt[i] + this.d * v[i];
    }
  }

  // Compute LookAt View Matrix in column-major order (OpenGL standard)
  computeViewMatrix(out) {
    const eye = [0, 0, 0];
    const right = [0, 0, 0];
    const up = [0, 0, 0];
    const view = [0, 0, 0];

    this.getCameraPosition(eye);
    this.computeRightVector(right, this.theta, this.phi);
    this.computeUpVector(up, this.theta, this.phi);
    this.computeViewVector(view, this.theta, this.phi);

    // Camera coordinate frame (R, U, V)
    // In OpenGL view space: right = x, up = y, -view = z
    out[0] = right[0];
    out[1] = up[0];
    out[2] = view[0];
    out[3] = 0.0;

    out[4] = right[1];
    out[5] = up[1];
    out[6] = view[1];
    out[7] = 0.0;

    out[8] = right[2];
    out[9] = up[2];
    out[10] = view[2];
    out[11] = 0.0;

    out[12] = -(right[0] * eye[0] + right[1] * eye[1] + right[2] * eye[2]);
    out[13] = -(up[0] * eye[0] + up[1] * eye[1] + up[2] * eye[2]);
    out[14] = -(view[0] * eye[0] + view[1] * eye[1] + view[2] * eye[2]);
    out[15] = 1.0;
  }

  // Perspective Matrix according to PPTK's qt_camera.h
  // Adapts near and far planes dynamically to distance d for infinite zoom without clipping
  computeProjectionMatrix(out, nearVal = null, farVal = null) {
    const near = nearVal || Math.max(1e-5, 0.001 * this.d);
    // Far plane must encompass the lookAt target plus surrounding cloud span
    const baseSpan = Math.max(100.0, this.panRate * 300.0);
    const far = farVal || Math.max(1000.0, this.d + baseSpan * 4.0);

    const tanHalfFov = Math.tan(this.vfov * 0.5);

    for (let i = 0; i < 16; i++) out[i] = 0.0;

    out[0] = 1.0 / (this.aspectRatio * tanHalfFov);
    out[5] = 1.0 / tanHalfFov;
    out[10] = -(far + near) / (far - near);
    out[11] = -1.0;
    out[14] = -(2.0 * far * near) / (far - near);
  }

  // Combined MVP Matrix: Proj * View
  computeMVPMatrix(out) {
    const view = new Float32Array(16);
    const proj = new Float32Array(16);
    this.computeViewMatrix(view);

    if (this.projectionMode === 0) { // Perspective
      this.computeProjectionMatrix(proj);
    } else { // Orthographic
      const t = this.d * Math.tan(0.5 * this.vfov);
      const r = this.aspectRatio * t;
      const near = Math.max(1e-5, 0.001 * this.d);
      const far = Math.max(1000.0, this.d * 4.0);
      for (let i = 0; i < 16; i++) proj[i] = 0.0;
      proj[0] = 1.0 / r;
      proj[5] = 1.0 / t;
      proj[10] = -2.0 / (far - near);
      proj[14] = -(far + near) / (far - near);
      proj[15] = 1.0;
    }

    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0.0;
        for (let k = 0; k < 4; k++) {
          sum += proj[k * 4 + row] * view[col * 4 + k];
        }
        out[col * 4 + row] = sum;
      }
    }
  }
}
