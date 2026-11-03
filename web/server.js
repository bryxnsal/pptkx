const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Parse CLI arguments:
// node server.js --port 8080 --ply "C:\Users\User\Downloads\route.ply"
let port = 8080;
let plyPath = null;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    port = parseInt(args[i + 1], 10);
    i++;
  } else if ((args[i] === '--ply' || args[i] === '-p') && args[i + 1]) {
    plyPath = path.resolve(args[i + 1]);
    i++;
  }
}

const publicDir = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API endpoint for config & PLY metadata
  if (pathname === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    let hasPly = false;
    let plySize = 0;
    let plyFilename = '';
    let bounds = null;

    if (plyPath && fs.existsSync(plyPath)) {
      hasPly = true;
      plySize = fs.statSync(plyPath).size;
      plyFilename = path.basename(plyPath);

      // Compute global bounds once and cache
      if (!server._cachedBounds) {
        try {
          const fd = fs.openSync(plyPath, 'r');
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          let minZ = Infinity, maxZ = -Infinity;
          const chunk = Buffer.alloc(16 * 1000000);
          let bytesRead = 0;
          let pos = 142; // offset after standard PLY header
          while ((bytesRead = fs.readSync(fd, chunk, 0, chunk.length, pos)) > 0) {
            pos += bytesRead;
            const count = bytesRead / 16;
            const f32 = new Float32Array(chunk.buffer, chunk.byteOffset, count * 4);
            for (let i = 0; i < count; i += 10) { // Fast sample across all 38M points
              const x = f32[i * 4 + 0];
              const y = f32[i * 4 + 1];
              const z = f32[i * 4 + 2];
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
              if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
            }
          }
          fs.closeSync(fd);
          server._cachedBounds = { minX, maxX, minY, maxY, minZ, maxZ };
        } catch (_) {}
      }
      bounds = server._cachedBounds;
    }

    res.end(JSON.stringify({
      hasPly,
      plySize,
      plyFilename,
      port,
      bounds
    }));
    return;
  }

  // API endpoint to stream the binary PLY file directly
  if (pathname === '/api/ply') {
    if (!plyPath || !fs.existsSync(plyPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('PLY file not specified or does not exist');
      return;
    }

    const stat = fs.statSync(plyPath);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': stat.size,
      'Content-Disposition': `inline; filename="${path.basename(plyPath)}"`
    });

    const readStream = fs.createReadStream(plyPath);
    readStream.pipe(res);
    return;
  }

  // Static files server
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(publicDir, pathname);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, () => {
  console.log(`=======================================================`);
  console.log(` PPTK Web Native Server ejecutándose en:`);
  console.log(` http://localhost:${port}`);
  if (plyPath) {
    if (fs.existsSync(plyPath)) {
      const mb = (fs.statSync(plyPath).size / (1024 * 1024)).toFixed(1);
      console.log(` Archivo PLY vinculado: ${plyPath} (${mb} MB)`);
    } else {
      console.log(` [AVISO] Ruta PLY no encontrada: ${plyPath}`);
    }
  } else {
    console.log(` Sin archivo PLY parametrizado (Usa --ply <ruta>)`);
  }
  console.log(`=======================================================`);
});
