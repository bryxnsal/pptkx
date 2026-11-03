// PPTK-Compliant binary PLY streaming parser with 16-byte packed output
self.onmessage = async function (e) {
  const { url } = e.data;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const reader = response.body.getReader();
    let headerParsed = false;
    let numVertices = 0;
    const vertexByteSize = 16; // x(4), y(4), z(4), class(4)
    let leftoverBuffer = new Uint8Array(0);

    let pointsLoaded = 0;
    const CHUNK_POINTS = 500000; // 500k points per stream batch

    // Pre-allocated interleaved buffer for GPU:
    // 16 bytes per vertex: 3 float32 (12B) + 1 uint32 RGBA (4B)
    let chunkBuffer = new ArrayBuffer(CHUNK_POINTS * 16);
    let chunkF32 = new Float32Array(chunkBuffer);
    let chunkU32 = new Uint32Array(chunkBuffer);
    let chunkPointCount = 0;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let minClass = Infinity, maxClass = -Infinity;

    while (true) {
      const { done, value } = await reader.read();
      if (done && leftoverBuffer.length === 0) break;

      let chunk = value || new Uint8Array(0);
      if (leftoverBuffer.length > 0) {
        const combined = new Uint8Array(leftoverBuffer.length + chunk.length);
        combined.set(leftoverBuffer);
        combined.set(chunk, leftoverBuffer.length);
        chunk = combined;
        leftoverBuffer = new Uint8Array(0);
      }

      let byteOffset = 0;

      // 1. Locate end_header byte offset
      if (!headerParsed) {
        const target = [101, 110, 100, 95, 104, 101, 97, 100, 101, 114, 10]; // "end_header\n"
        let foundIdx = -1;

        for (let i = 0; i <= chunk.length - target.length; i++) {
          let match = true;
          for (let j = 0; j < target.length; j++) {
            if (chunk[i + j] !== target[j]) { match = false; break; }
          }
          if (match) { foundIdx = i + target.length; break; }
        }

        if (foundIdx === -1) {
          leftoverBuffer = chunk;
          continue;
        }

        const headerBytes = chunk.subarray(0, foundIdx);
        const headerStr = new TextDecoder('ascii').decode(headerBytes);
        const vertexMatch = headerStr.match(/element\s+vertex\s+(\d+)/);
        if (vertexMatch) numVertices = parseInt(vertexMatch[1], 10);

        byteOffset = foundIdx;
        headerParsed = true;

        self.postMessage({
          type: 'header',
          totalPoints: numVertices
        });
      }

      // 2. Stream vertices
      const remainingBytes = chunk.length - byteOffset;
      const fullVerticesInChunk = Math.floor(remainingBytes / vertexByteSize);

      if (fullVerticesInChunk > 0) {
        const dataView = new DataView(chunk.buffer, chunk.byteOffset + byteOffset, fullVerticesInChunk * vertexByteSize);

        for (let i = 0; i < fullVerticesInChunk; i++) {
          const srcBase = i * vertexByteSize;
          const x = dataView.getFloat32(srcBase + 0, true);
          const y = dataView.getFloat32(srcBase + 4, true);
          const z = dataView.getFloat32(srcBase + 8, true);
          const cls = dataView.getUint32(srcBase + 12, true);

          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
          if (cls < minClass) minClass = cls; if (cls > maxClass) maxClass = cls;

          const dstIdx = chunkPointCount * 4;
          chunkF32[dstIdx + 0] = x;
          chunkF32[dstIdx + 1] = y;
          chunkF32[dstIdx + 2] = z;

          // Store class directly in the 4th slot:
          // Red = class ID (0-255), Green = class ID, Blue = class ID, Alpha = 255
          const c8 = Math.min(255, cls & 0xFF);
          const packedCls = (255 << 24) | (c8 << 16) | (c8 << 8) | c8;
          chunkU32[dstIdx + 3] = packedCls;

          chunkPointCount++;

          if (chunkPointCount === CHUNK_POINTS) {
            const outBuffer = chunkBuffer.slice(0, CHUNK_POINTS * 16);

            self.postMessage({
              type: 'chunk',
              pointsLoaded: pointsLoaded + chunkPointCount,
              totalPoints: numVertices,
              chunkCount: chunkPointCount,
              buffer: outBuffer,
              bounds: { minX, maxX, minY, maxY, minZ, maxZ }
            }, [outBuffer]);

            pointsLoaded += chunkPointCount;
            chunkPointCount = 0;
          }
        }

        byteOffset += fullVerticesInChunk * vertexByteSize;
      }

      if (byteOffset < chunk.length) {
        leftoverBuffer = chunk.slice(byteOffset);
      }
    }

    if (chunkPointCount > 0) {
      const outBuffer = chunkBuffer.slice(0, chunkPointCount * 16);
      self.postMessage({
        type: 'chunk',
        pointsLoaded: pointsLoaded + chunkPointCount,
        totalPoints: numVertices,
        chunkCount: chunkPointCount,
        buffer: outBuffer,
        bounds: { minX, maxX, minY, maxY, minZ, maxZ }
      }, [outBuffer]);
      pointsLoaded += chunkPointCount;
    }

    self.postMessage({
      type: 'done',
      totalPoints: pointsLoaded,
      bounds: { minX, maxX, minY, maxY, minZ, maxZ },
      classes: { minClass, maxClass }
    });

  } catch (err) {
    self.postMessage({ type: 'error', error: err.message });
  }
};
