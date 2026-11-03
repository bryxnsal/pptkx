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

    if (plyPath && fs.existsSync(plyPath)) {
      hasPly = true;
      plySize = fs.statSync(plyPath).size;
      plyFilename = path.basename(plyPath);
    }

    res.end(JSON.stringify({
      hasPly,
      plySize,
      plyFilename
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
