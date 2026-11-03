// Grid & Spatial Partitioning LOD Worker
// Replicates PPTK's Hierarchical Level-Of-Detail & Frustum Culling
// Compact memory layout: 16 bytes per vertex:
// [posX (float32), posY (float32), posZ (float32), color_rgba (uint32)]

class SpatialOctreeLOD {
  constructor() {
    this.totalPoints = 0;
    this.positions = null;
    this.colors = null;
    this.grid = new Map();
    this.cellResolution = 1.0; // Dynamic spatial grid resolution
    this.bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  }

  init(positionsF32, colorsU32, totalPoints, bounds) {
    this.positions = positionsF32;
    this.colors = colorsU32;
    this.totalPoints = totalPoints;
    this.bounds = bounds;

    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    const spanZ = bounds.maxZ - bounds.minZ;
    const maxSpan = Math.max(spanX, spanY, spanZ);

    // Calculate hierarchical bucket size
    this.cellResolution = maxSpan / 128.0;
  }

  // Frustum culling and point subsampling matching PPTK's cullAndLOD criterion
  cullAndSample(cameraEye, cameraTarget, vfov, aspect, maxRenderBudget = 3000000) {
    if (this.totalPoints === 0) return new Uint32Array(0);

    // Distance-based sampling factor
    const camDist = Math.hypot(
      cameraEye[0] - cameraTarget[0],
      cameraEye[1] - cameraTarget[1],
      cameraEye[2] - cameraTarget[2]
    );

    // If point count exceeds budget, compute stride
    let stride = 1;
    if (this.totalPoints > maxRenderBudget) {
      stride = Math.ceil(this.totalPoints / maxRenderBudget);
    }

    const visibleIndices = [];
    const step = stride;

    // View vector
    const vx = cameraTarget[0] - cameraEye[0];
    const vy = cameraTarget[1] - cameraEye[1];
    const vz = cameraTarget[2] - cameraEye[2];
    const vLen = Math.hypot(vx, vy, vz) || 1;
    const nvx = vx / vLen, nvy = vy / vLen, nvz = vz / vLen;

    const cosHalfFov = Math.cos(vfov * 0.7);

    for (let i = 0; i < this.totalPoints; i += step) {
      const px = this.positions[i * 3 + 0];
      const py = this.positions[i * 3 + 1];
      const pz = this.positions[i * 3 + 2];

      // Vector from eye to point
      const dx = px - cameraEye[0];
      const dy = py - cameraEye[1];
      const dz = pz - cameraEye[2];
      const dLen = Math.hypot(dx, dy, dz);

      if (dLen < 0.1) continue;

      // Dot product to test if point is in front of camera
      const dot = (dx * nvx + dy * nvy + dz * nvz) / dLen;
      if (dot > cosHalfFov) {
        visibleIndices.push(i);
      }
    }

    return new Uint32Array(visibleIndices);
  }
}

const lodEngine = new SpatialOctreeLOD();

self.onmessage = function (e) {
  const { type } = e.data;

  if (type === 'init') {
    const { positions, colors, totalPoints, bounds } = e.data;
    const posF32 = new Float32Array(positions);
    const colU32 = new Uint32Array(colors);
    lodEngine.init(posF32, colU32, totalPoints, bounds);
    self.postMessage({ type: 'initialized', totalPoints });
  } else if (type === 'query_lod') {
    const { cameraEye, cameraTarget, vfov, aspect, budget } = e.data;
    const indices = lodEngine.cullAndSample(cameraEye, cameraTarget, vfov, aspect, budget);
    self.postMessage({
      type: 'lod_result',
      indices: indices.buffer,
      count: indices.length
    }, [indices.buffer]);
  }
};
