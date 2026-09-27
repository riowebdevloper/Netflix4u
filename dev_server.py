import http.server
import socketserver
import os
import urllib.parse
import json
import mimetypes

PORT = 4173
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('application/json', '.json')

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Health API
        if path == '/api/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "version": "1.0.0", "status": "healthy"}).encode('utf-8'))
            return

        # Download API endpoint
        if path.startswith('/api/download/hicine') or path in ['/api/download', '/api/downloads']:
            vcloud = query.get('vcloud', [None])[0] or query.get('url', [None])[0]
            if vcloud:
                target = vcloud
                if not target.startswith('http'):
                    target = 'https://' + target.lstrip('/')
                self.send_response(302)
                self.send_header('Location', target)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                return
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "status": "active"}).encode('utf-8'))
            return

        # Details API endpoint
        if path == '/api/details':
            title_id = query.get('id', [None])[0]
            if title_id:
                clean_id = os.path.basename(title_id)
                cand_paths = [
                    os.path.join(ROOT_DIR, 'data', 'details', f"{clean_id}.json"),
                    os.path.join(ROOT_DIR, 'data', 'details', f"tmdb-movie-{clean_id}.json"),
                    os.path.join(ROOT_DIR, 'data', 'details', f"tmdb-series-{clean_id}.json")
                ]
                for cp in cand_paths:
                    if os.path.exists(cp):
                        with open(cp, 'rb') as f:
                            data = f.read()
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(data)
                        return
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Title not found"}).encode('utf-8'))
            return

        # Clean URL rewrite & SPA routes fallback (e.g. /movies -> /movies.html, /genres -> /index.html)
        if path != '/' and not os.path.splitext(path)[1]:
            html_candidate = os.path.join(ROOT_DIR, path.lstrip('/') + '.html')
            if os.path.exists(html_candidate):
                self.path = path + '.html'
            else:
                self.path = '/index.html'

        return super().do_GET()

def run():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('127.0.0.1', PORT), CustomHandler) as httpd:
        print(f"Server started on http://127.0.0.1:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass

if __name__ == '__main__':
    run()
