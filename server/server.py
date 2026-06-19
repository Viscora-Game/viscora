import http.server
import json
import os
import random
import urllib.parse
from datetime import datetime, timezone

PORT = int(os.environ.get('PORT', 8080))
DB_FILE = os.path.join(os.path.dirname(__file__), 'db_maps.json')

# Veritabanını hazırla
if not os.path.exists(DB_FILE):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f, indent=2)

# MongoDB Desteği
MONGO_URI = os.environ.get('MONGODB_URI') or os.environ.get('MONGO_URI')
mongo_collection = None

if MONGO_URI:
    try:
        from pymongo import MongoClient
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # Veritabanı adını URI'den ayıkla, varsayılan 'viscora'
        db_name = 'viscora'
        parsed_uri = urllib.parse.urlparse(MONGO_URI)
        if parsed_uri.path and parsed_uri.path != '/':
            db_name = parsed_uri.path.strip('/')
        mongo_db = client[db_name]
        mongo_collection = mongo_db['levels']
        print(f"MongoDB bağlantısı başarılı! Veritabanı: {db_name}, Koleksiyon: levels")
    except Exception as e:
        print("MongoDB bağlantı hatası, yerel JSON dosyasına geçiliyor:", e)
        mongo_collection = None

def read_db():
    if mongo_collection is not None:
        try:
            return list(mongo_collection.find({}, {'_id': False}))
        except Exception as e:
            print("MongoDB okuma hatası, yerel JSON dosyasına geçiliyor:", e)

    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print("Veritabanı okuma hatası:", e)
        return []

def write_db(data):
    if mongo_collection is not None:
        try:
            # Her seviyeyi kendi ID'sine göre güncelle veya yoksa ekle (upsert)
            for level in data:
                level_id = level.get('id')
                if level_id:
                    mongo_collection.update_one({'id': level_id}, {'$set': level}, upsert=True)
            # Eğer db_maps'ten kalıcı silinenler varsa onları MongoDB'den de sil
            existing_ids = [l.get('id') for l in data if l.get('id')]
            mongo_collection.delete_many({'id': {'$nin': existing_ids}})
            return True
        except Exception as e:
            print("MongoDB yazma hatası, yerel JSON dosyasına geçiliyor:", e)

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
            user_id = query.get('userId', [''])[0]

            # 24 saat boyunca oynanmayan haritaları sahibinden gizle, 30 gün boyunca hiç oynanmamışsa kalıcı sil
            response_db = []
            cleaned_db = []
            db_changed = False
            now = datetime.now(timezone.utc)

            for level in db:
                played_str = level.get('lastPlayedAt') or level.get('createdAt')
                try:
                    played_time = datetime.fromisoformat(played_str)
                    if played_time.tzinfo is None:
                        played_time = played_time.replace(tzinfo=timezone.utc)
                    age_seconds = (now - played_time).total_seconds()
                except Exception:
                    age_seconds = 0

                creator_id = level.get('creatorId', '')
                likes = level.get('likes', 0)
                allowed_age_seconds = 86400 + (likes * 12 * 3600)

                # Kalıcı Silme: Son oynanıştan itibaren 30 gün geçmişse db'den tamamen kaldır (Sahibi dahil)
                if age_seconds > allowed_age_seconds + (30 * 86400):
                    db_changed = True
                    continue # db_maps.json'a dahil etme

                cleaned_db.append(level)

                # Yanıt Filtreleme: Süre dolmadıysa VEYA istek atan kişi bölümün yaratıcısıysa göster
                if age_seconds <= allowed_age_seconds or creator_id == user_id:
                    response_db.append(level)

            if db_changed:
                write_db(cleaned_db)

            # En çok beğeni alan en üstte olacak şekilde sırala (beğeni sayıları eşitse en son eklenen en üstte olur)
            if sort_type == 'popular':
                response_db.sort(key=lambda x: (x.get('likes', 0), x.get('createdAt', '')), reverse=True)
            else:
                response_db.sort(key=lambda x: x.get('createdAt', ''), reverse=True)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(response_db, ensure_ascii=False).encode('utf-8'))
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
            creator_id = body.get('creatorId', '')
            data = body.get('data')

            if not name or not author or not data:
                self.send_response(400)
                self.end_headers()
                self.wfile.write('{"error": "Harita adı, yapımcı ve harita verileri zorunludur."}'.encode('utf-8'))
                return

            db = read_db()
            
            # Bölüm adı çakışması kontrolü
            for level in db:
                if level.get('name', '').strip().lower() == name.strip().lower():
                    self.send_response(409) # 409 Conflict
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write('{"error": "Bu bölüm adı zaten mevcut."}'.encode('utf-8'))
                    return

            new_level = {
                'id': f'map_{int(datetime.now(timezone.utc).timestamp() * 1000)}_{random.randint(100, 999)}',
                'name': name.strip(),
                'author': author.strip(),
                'creatorId': creator_id,
                'data': data,
                'likes': 0,
                'createdAt': datetime.now(timezone.utc).isoformat(),
                'lastPlayedAt': datetime.now(timezone.utc).isoformat()
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

        # 3. Harita oynanma/tıklanma zamanı güncelleme: POST /api/levels/<id>/play
        elif path.startswith('/api/levels/') and path.endswith('/play'):
            parts = path.split('/')
            if len(parts) >= 4:
                level_id = parts[3]
                db = read_db()
                found = None
                for level in db:
                    if level['id'] == level_id:
                        level['lastPlayedAt'] = datetime.now(timezone.utc).isoformat()
                        found = level
                        break

                if found:
                    if write_db(db):
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json; charset=utf-8')
                        self.end_headers()
                        self.wfile.write('{"status": "ok"}'.encode('utf-8'))
                    else:
                        self.send_response(500)
                        self.end_headers()
                else:
                    self.send_response(404)
                    self.end_headers()
        # 4. Harita güncelleme: POST /api/levels/<id>/update
        elif path.startswith('/api/levels/') and path.endswith('/update'):
            parts = path.split('/')
            if len(parts) >= 4:
                level_id = parts[3]
                creator_id = body.get('creatorId', '')
                new_data = body.get('data')
                new_name = body.get('name')
                
                if not new_data:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write('{"error": "Güncellenecek veri bulunamadı."}'.encode('utf-8'))
                    return
                    
                db = read_db()
                found = None
                for level in db:
                    if level['id'] == level_id:
                        found = level
                        break
                        
                if found:
                    # Sahibi kontrolü
                    if found.get('creatorId') != creator_id:
                        self.send_response(403)
                        self.send_header('Content-Type', 'application/json; charset=utf-8')
                        self.end_headers()
                        self.wfile.write('{"error": "Bu bölümü güncelleme izniniz yok."}'.encode('utf-8'))
                        return
                    
                    # Eğer isim değiştiyse ve çakışma varsa kontrol et
                    if new_name and new_name.strip().lower() != found.get('name', '').strip().lower():
                        for level in db:
                            if level['id'] != level_id and level.get('name', '').strip().lower() == new_name.strip().lower():
                                self.send_response(409)
                                self.send_header('Content-Type', 'application/json; charset=utf-8')
                                self.end_headers()
                                self.wfile.write('{"error": "Bu bölüm adı zaten mevcut."}'.encode('utf-8'))
                                return
                        found['name'] = new_name.strip()
                        
                    found['data'] = new_data
                    
                    if write_db(db):
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json; charset=utf-8')
                        self.end_headers()
                        self.wfile.write(json.dumps(found, ensure_ascii=False).encode('utf-8'))
                    else:
                        self.send_response(500)
                        self.end_headers()
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
