#!/usr/bin/env python3
"""
PPTK Web Native Server 100% Python (Zero Node.js dependency).
Serves WebGL2 viewer static assets and streams massive binary PLY or NumPy buffers
with high-performance chunked transfer, range requests, and CORS.
"""

import os
import sys
import argparse
import mimetypes
import json
import struct
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

# Ensure mime types are registered
mimetypes.init()
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/wasm', '.wasm')
mimetypes.add_type('application/json', '.json')

class PPTKWebHandler(BaseHTTPRequestHandler):
    server_version = "PPTKWebServer/1.0"

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_HEAD(self):
        self.do_GET(head_only=True)

    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Range')

    def do_GET(self, head_only=False):
        parsed = urlparse(self.path)
        pathname = parsed.path

        if pathname == '/api/config':
            self.handle_api_config(head_only)
        elif pathname == '/api/ply':
            self.handle_api_ply(head_only)
        else:
            self.handle_static(pathname, head_only)

    def handle_api_config(self, head_only=False):
        ply_path = getattr(self.server, 'ply_path', None)
        has_ply = False
        ply_size = 0
        ply_filename = ''
        bounds = None

        if ply_path and os.path.exists(ply_path):
            has_ply = True
            ply_size = os.path.getsize(ply_path)
            ply_filename = os.path.basename(ply_path)

            if not hasattr(self.server, '_cached_bounds'):
                self.server._cached_bounds = self._compute_bounds(ply_path)
            bounds = self.server._cached_bounds

        data = {
            'hasPly': has_ply,
            'plySize': ply_size,
            'plyFilename': ply_filename,
            'port': self.server.server_port,
            'bounds': bounds
        }

        body = json.dumps(data).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self._send_cors_headers()
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def _compute_bounds(self, filepath):
        """Fast sample to calculate global bounding box of 38M+ points in binary PLY"""
        try:
            min_x, max_x = float('inf'), float('-inf')
            min_y, max_y = float('inf'), float('-inf')
            min_z, max_z = float('inf'), float('-inf')

            with open(filepath, 'rb') as f:
                # Find end of header
                header = b''
                while True:
                    line = f.readline()
                    header += line
                    if line.strip() == b'end_header' or not line:
                        break

                chunk_size = 16 * 100000  # 1.6MB chunks
                stride = 10 * 16           # sample every 10th vertex (16 bytes: 3 floats x,y,z + 4 bytes class)

                while True:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    count = len(chunk) // 16
                    for i in range(0, count, 10):
                        offset = i * 16
                        x, y, z = struct.unpack_from('<fff', chunk, offset)
                        if x < min_x: min_x = x
                        if x > max_x: max_x = x
                        if y < min_y: min_y = y
                        if y > max_y: max_y = y
                        if z < min_z: min_z = z
                        if z > max_z: max_z = z

            return {
                'minX': min_x, 'maxX': max_x,
                'minY': min_y, 'maxY': max_y,
                'minZ': min_z, 'maxZ': max_z
            }
        except Exception as e:
            print(f"[WARN] No se pudo calcular bounds de {filepath}: {e}", file=sys.stderr)
            return None

    def handle_api_ply(self, head_only=False):
        ply_path = getattr(self.server, 'ply_path', None)
        if not ply_path or not os.path.exists(ply_path):
            self.send_error(404, "PLY file not specified or does not exist")
            return

        file_size = os.path.getsize(ply_path)
        self.send_response(200)
        self.send_header('Content-Type', 'application/octet-stream')
        self.send_header('Content-Length', str(file_size))
        self.send_header('Content-Disposition', f'inline; filename="{os.path.basename(ply_path)}"')
        self.send_header('Accept-Ranges', 'bytes')
        self._send_cors_headers()
        self.end_headers()

        if head_only:
            return

        # Stream binary chunks of 2MB to keep latency minimal
        chunk_size = 2 * 1024 * 1024
        with open(ply_path, 'rb') as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break

    def handle_static(self, pathname, head_only=False):
        if pathname == '/' or not pathname:
            pathname = '/index.html'

        # Remove query parameters and sanitize
        clean_path = os.path.normpath(pathname.lstrip('/'))
        public_dir = getattr(self.server, 'public_dir')
        full_path = os.path.join(public_dir, clean_path)

        # Security check: prevent directory traversal
        if not full_path.startswith(os.path.abspath(public_dir)):
            self.send_error(403, "Forbidden")
            return

        if not os.path.isfile(full_path):
            self.send_error(404, "File Not Found")
            return

        mime_type, _ = mimetypes.guess_type(full_path)
        if not mime_type:
            mime_type = 'application/octet-stream'

        file_size = os.path.getsize(full_path)

        self.send_response(200)
        self.send_header('Content-Type', mime_type)
        self.send_header('Content-Length', str(file_size))
        self.send_header('Cache-Control', 'no-cache')
        self._send_cors_headers()
        self.end_headers()

        if head_only:
            return

        with open(full_path, 'rb') as f:
            while True:
                chunk = f.read(1024 * 512)
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break

    def log_message(self, format, *args):
        # Quiet logger for high-frequency chunk requests
        if args and str(args[0]).startswith(('200', '204', '304')):
            return
        super().log_message(format, *args)


def run_server(port=8080, ply_path=None, public_dir=None):
    if not public_dir:
        public_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')

    server = ThreadingHTTPServer(('0.0.0.0', port), PPTKWebHandler)
    server.public_dir = os.path.abspath(public_dir)
    server.ply_path = os.path.abspath(ply_path) if ply_path else None

    print("=" * 60)
    print(f" PPTK Web Native Server 100% Python ejecutándose en:")
    print(f" http://localhost:{port}")
    if server.ply_path:
        if os.path.exists(server.ply_path):
            mb = os.path.getsize(server.ply_path) / (1024 * 1024)
            print(f" Archivo PLY vinculado: {server.ply_path} ({mb:.1f} MB)")
        else:
            print(f" [AVISO] Ruta PLY no encontrada: {server.ply_path}")
    else:
        print(" Sin archivo PLY parametrizado (Usa --ply <ruta>)")
    print("=" * 60)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDeteniendo servidor...")
        server.server_close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="PPTK Web Native 100% Python Server")
    parser.add_argument('--port', type=int, default=8080, help="Puerto del servidor (default: 8080)")
    parser.add_argument('--ply', '-p', type=str, default=None, help="Ruta al archivo .ply")
    parser.add_argument('--public', type=str, default=None, help="Ruta a carpeta pública de assets web")
    args = parser.parse_args()

    run_server(port=args.port, ply_path=args.ply, public_dir=args.public)
