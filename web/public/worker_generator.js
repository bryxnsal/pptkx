// Web Worker for Chunked High-Performance Point Cloud Generation
self.onmessage = function (e) {
  const { totalPoints, chunkSize } = e.data;
  let pointsGenerated = 0;

  // Knot / Torus / Helix Parametric Equation
  while (pointsGenerated < totalPoints) {
    const currentChunk = Math.min(chunkSize, totalPoints - pointsGenerated);
    
    // Allocate contiguous typed arrays per chunk
    const positions = new Float32Array(currentChunk * 3);
    const colors = new Float32Array(currentChunk * 3);
    const sizes = new Float32Array(currentChunk);

    for (let i = 0; i < currentChunk; i++) {
      const idx = pointsGenerated + i;
      
      // Torus knot with perturbation (3D geometry)
      const u = (idx * 0.0001) + Math.random() * 0.01;
      const v = (idx * 0.0003) + Math.random() * 0.01;
      const r = 2.0 + Math.cos(3 * u) * 0.8;

      const x = r * Math.cos(2 * u) + (Math.random() - 0.5) * 0.15;
      const y = r * Math.sin(2 * u) + (Math.random() - 0.5) * 0.15;
      const z = Math.sin(3 * u) * 0.8 + Math.cos(v) * 0.2 + (Math.random() - 0.5) * 0.15;

      positions[i * 3 + 0] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color encoding: RGB by (X, Z, Y) normalized space
      colors[i * 3 + 0] = (x + 3.0) / 6.0;
      colors[i * 3 + 1] = (z + 1.2) / 2.4;
      colors[i * 3 + 2] = (y + 3.0) / 6.0;

      sizes[i] = 1.0;
    }

    pointsGenerated += currentChunk;

    // Zero-Copy transfer of ArrayBuffers back to main thread
    self.postMessage({
      type: 'chunk',
      pointsGenerated,
      totalPoints,
      chunkCount: currentChunk,
      positions: positions.buffer,
      colors: colors.buffer,
      sizes: sizes.buffer
    }, [positions.buffer, colors.buffer, sizes.buffer]);
  }

  self.postMessage({ type: 'done', totalPoints });
};
