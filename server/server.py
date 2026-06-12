import http.server
import json
import os
import random
import urllib.parse
from datetime import datetime

PORT = 8080
DB_FILE = os.path.join(os.path.dirname(__file__), 'db_maps.json')

# Veritabanını hazırla
if not os.path.exists(DB_FILE):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f, indent=2)

def read_db():
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print("Veritabanı okuma hatası:", e)
        return []

def write_db(data):
    try:
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print("Veritabanı yazma hatası:", e)
        return False

class APIRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Statik dosyaları projenin ana klasöründen (server klasörünün bir üstü) sun
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        super().__init__(*args, directory=root_dir, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = urllib.parse.parse_qs(parsed_url.query)

        if path == '/api/levels':
            db = read_db()
            sort_type = query.get('sort', ['new'])[0]

            if sort_type == 'popular':
                db.sort(key=lambda x: (-x.get('likes', 0), x.get('createdAt', '')))
            else:
                db.sort(key=lambda x: x.get('createdAt', ''), reverse=True)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(db, ensure_ascii=False).encode('utf-8'))
        else:
            # Diğer tüm istekleri (index.html, js/, css/ vb.) standart SimpleHTTPRequestHandler ile sun
            super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        # Content length oku
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        body = {}
        if content_length > 0:
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write('{"error": "Geçersiz JSON verisi."}'.encode('utf-8'))
                return


        # 1. Yeni seviye yayınlama: POST /api/levels
        if path == '/api/levels':
            name = body.get('name')
            author = body.get('author')
            data = body.get('data')

            if not name or not author or not data:
                self.send_response(400)
                self.end_headers()
                self.wfile.write('{"error": "Harita adı, yapımcı ve harita verileri zorunludur."}'.encode('utf-8'))
                return

            db = read_db()
            new_level = {
                'id': f'map_{int(datetime.now().timestamp() * 1000)}_{random.randint(100, 999)}',
                'name': name.strip(),
                'author': author.strip(),
                'data': data,
                'likes': 0,
                'createdAt': datetime.now().isoformat()
            }
            db.append(new_level)

            if write_db(db):
                self.send_response(201)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(new_level, ensure_ascii=False).encode('utf-8'))
            else:
                self.send_response(500)
                self.end_headers()
                self.wfile.write('{"error": "Harita kaydedilemedi."}'.encode('utf-8'))

        # 2. Harita beğenme: POST /api/levels/<id>/like
        elif path.startswith('/api/levels/') and path.endswith('/like'):
            # ID ayıkla
            parts = path.split('/')
            if len(parts) >= 4:
                level_id = parts[3]
                db = read_db()
                found = None
                for level in db:
                    if level['id'] == level_id:
                        level['likes'] = level.get('likes', 0) + 1
                        found = level
                        break

                if found:
                    if write_db(db):
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json; charset=utf-8')
                        self.end_headers()
                        self.wfile.write(json.dumps(found, ensure_ascii=False).encode('utf-8'))
                    else:
                        self.send_response(500)
                        self.end_headers()
                        self.wfile.write('{"error": "Beğeni kaydedilemedi."}'.encode('utf-8'))
                else:
                    self.send_response(404)
                    self.end_headers()
                    self.wfile.write('{"error": "Harita bulunamadı."}'.encode('utf-8'))
            else:
                self.send_response(400)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

def run_server():
    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, APIRequestHandler)
    print(f"Viscora API Sunucusu {PORT} portunda başarıyla başlatıldı.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nSunucu durduruldu.")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
