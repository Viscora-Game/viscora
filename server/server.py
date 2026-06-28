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
mongo_users_collection = None
mongo_error = None
mongo_db_name = None

if MONGO_URI:
    try:
        try:
            from pymongo import MongoClient
        except ImportError:
            import subprocess
            import sys
            import site
            print("pymongo modülü bulunamadı, çalışma zamanında yükleniyor...")
            cmd = [sys.executable, "-m", "pip", "install", "--user", "--break-system-packages", "pymongo", "dnspython"]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode != 0:
                raise Exception(f"pip install failed (code {res.returncode}): {res.stderr} | stdout: {res.stdout}")
            
            # Kullanıcı dizinini yola ekle
            user_site = site.getusersitepackages()
            if user_site not in sys.path:
                sys.path.append(user_site)
                
            from pymongo import MongoClient
            
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # Veritabanı adını URI'den ayıkla, varsayılan 'viscora'
        db_name = 'viscora'
        parsed_uri = urllib.parse.urlparse(MONGO_URI)
        if parsed_uri.path and parsed_uri.path != '/':
            db_name = parsed_uri.path.strip('/')
        mongo_db_name = db_name
        mongo_db = client[db_name]
        
        # Bağlantıyı test et (pymongo varsayılan olarak tembeldir)
        client.admin.command('ping')
        
        mongo_collection = mongo_db['levels']
        mongo_users_collection = mongo_db['users']
        print(f"MongoDB bağlantısı başarılı! Veritabanı: {db_name}, Koleksiyon: levels & users")
    except Exception as e:
        mongo_error = str(e)
        print("MongoDB bağlantı hatası, yerel JSON dosyasına geçiliyor:", e)
        mongo_collection = None
        mongo_users_collection = None
DB_USERS_FILE = os.path.join(os.path.dirname(__file__), 'db_users.json')
if not os.path.exists(DB_USERS_FILE):
    with open(DB_USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f, indent=2)

DB_CAMPAIGN_FILE = os.path.join(os.path.dirname(__file__), 'db_campaign_scores.json')
if not os.path.exists(DB_CAMPAIGN_FILE):
    with open(DB_CAMPAIGN_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f, indent=2)

def read_campaign_db():
    if mongo_collection is not None:
        try:
            db_conn = mongo_collection.database
            return list(db_conn['campaign_scores'].find({}, {'_id': False}))
        except Exception as e:
            print("MongoDB campaign scores okuma hatası, yerel JSON dosyasına geçiliyor:", e)

    try:
        with open(DB_CAMPAIGN_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print("Campaign scores veritabanı okuma hatası:", e)
        return []

def write_campaign_db(data):
    if mongo_collection is not None:
        try:
            db_conn = mongo_collection.database
            coll = db_conn['campaign_scores']
            for item in data:
                level_num = item.get('levelNumber')
                if level_num is not None:
                    coll.update_one({'levelNumber': level_num}, {'$set': item}, upsert=True)
            return True
        except Exception as e:
            print("MongoDB campaign scores yazma hatası, yerel JSON dosyasına geçiliyor:", e)

    try:
        with open(DB_CAMPAIGN_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print("Campaign scores veritabanı yazma hatası:", e)
        return False

def read_users_db():
    if mongo_users_collection is not None:
        try:
            return list(mongo_users_collection.find({}, {'_id': False}))
        except Exception as e:
            print("MongoDB users okuma hatası, yerel JSON dosyasına geçiliyor:", e)

    try:
        with open(DB_USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print("Users veritabanı okuma hatası:", e)
        return []

def write_users_db(data):
    if mongo_users_collection is not None:
        try:
            for user in data:
                user_id = user.get('userId')
                if user_id:
                    mongo_users_collection.update_one({'userId': user_id}, {'$set': user}, upsert=True)
            return True
        except Exception as e:
            print("MongoDB users yazma hatası, yerel JSON dosyasına geçiliyor:", e)

    try:
        with open(DB_USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print("Users veritabanı yazma hatası:", e)
        return False

def get_user_by_id(user_id):
    if mongo_users_collection is not None:
        try:
            res = mongo_users_collection.find_one({'userId': user_id}, {'_id': False})
            if res:
                return res
        except Exception as e:
            print("MongoDB find_one by userId error:", e)
            
    users = read_users_db()
    for u in users:
        if u.get('userId') == user_id:
            return u
    return None

def get_user_by_google_id(google_id):
    if mongo_users_collection is not None:
        try:
            res = mongo_users_collection.find_one({'googleId': google_id}, {'_id': False})
            if res:
                return res
        except Exception as e:
            print("MongoDB find_one by googleId error:", e)
            
    users = read_users_db()
    for u in users:
        if u.get('googleId') == google_id:
            return u
    return None

def get_user_by_sync_code(code):
    code = str(code).upper().strip()
    if mongo_users_collection is not None:
        try:
            res = mongo_users_collection.find_one({'syncCode': code}, {'_id': False})
            if res:
                return res
        except Exception as e:
            print("MongoDB find_one by syncCode error:", e)
            
    users = read_users_db()
    for u in users:
        if str(u.get('syncCode', '')).upper().strip() == code:
            return u
    return None

def save_user(user_data):
    if mongo_users_collection is not None:
        try:
            user_id = user_data.get('userId')
            if user_id:
                mongo_users_collection.update_one({'userId': user_id}, {'$set': user_data}, upsert=True)
                return True
        except Exception as e:
            print("MongoDB save_user error:", e)
            
    users = read_users_db()
    updated = False
    for i, u in enumerate(users):
        if u.get('userId') == user_data.get('userId'):
            users[i] = user_data
            updated = True
            break
    if not updated:
        users.append(user_data)
    return write_users_db(users)

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

import re

def is_offensive(text):
    if not text:
        return False
    
    text = str(text)
    raw = text.lower().strip()
    
    # Türkçe karakter normalizasyonu
    turkish_map = {
        'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c',
        'â': 'a', 'î': 'i', 'û': 'u'
    }
    # Leet speak / rakam-harf karışımı normalizasyonu (ör: s1k → sik, @m → am)
    # Not: 2 → 'iki' (Türkçe) kısalmaları özel olarak ele alınıyor
    leet_map = {
        '0': 'o', '1': 'i', '3': 'e', '4': 'a',
        '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '|': 'i'
    }
    
    # Türkçe normalize (leet'ten önce — 31/69 kontrolü burada yapılacak)
    norm = raw
    for k, v in turkish_map.items():
        norm = norm.replace(k, v)
    
    # 31 ve 69 argo/küfür sayıları (leet'ten ÖNCE kontrol et)
    if re.search(r'(?<!\d)(31|69)(?!\d)', norm):
        return True
    if re.search(r'(?<!\d)(31|69)(?!\d)', re.sub(r'[^a-z0-9]', '', norm)):
        return True

    # Leet normalizasyonu uygula
    for k, v in leet_map.items():
        norm = norm.replace(k, v)

    short_bad = {
        # Türkçe — tek başına engellenmeli
        'amk', 'aq', 'sik', 'am', 'got', 'pic', 'oc', 'pust',
        'akp', 'chp', 'mhp', 'hdp', 'rte', 'feto',
        'bok', 'ibne', 'gavat', 'gavad', 'gerzek', 'angut',
        # İngilizce — tek başına engellenmeli
        'ass', 'shit', 'cunt', 'dick', 'cock', 'slut', 'nigga',
        'bastard', 'fag', 'boner', 'cum', 'rape',
        # Sayı bypass’ları (s2m = sikim, 2 = iki anlamında)
        's2m', 's2k', 's2ks', 'am2', 'g2t'
    }

    long_bad = {
        # Türkçe — alt kelime olarak da engellenmeli
        'yarrak', 'yarak', 'assak', 'tasak', 'tassak', 'dassak', 'dasak', 'orospu', 'siktir', 'pezevenk', 'kahpe',
        'amcik', 'kaltak', 'erdogan', 'pkk',
        'kilicdaroglu', 'imamoglu', 'ataturk',
        'siken', 'domalt', 'domalan', 'domalm',
        'sikim', 'sikime', 'sikis', 'sikti', 'sike', 'sikip', 'siksen',
        'sikem', 'siker', 'siktim', 'sikcem', 'sikicem', 'sikik',
        'sikisler', 'soktum', 'sokar',
        'otuzbir', 'altmisdokuz', 'masturbasyon',
        # ooguz/turkce-kufur-karaliste kaynağından eklenenler
        'dalyarak', 'dalyarrak', 'dangalak', 'fahise',
        'gerizekal', 'gerzekl',
        'ananin', 'ananisi', 'ananiko',
        'bacini', 'bacina',
        'godos', 'godumun', 'atmik',
        'amina', 'aminako', 'aminakoy',
        'boklu', 'boktan', 'bokbok', 'bombok',
        'orosbuc', 'orospuc',
        # İngilizce — alt kelime olarak da engellenmeli
        'fuck', 'bitch', 'asshole', 'motherfuck', 'nigger', 'faggot',
        'whore', 'porn', 'dildo', 'fucker', 'fuckin', 'goddamn',
        'pussy', 'rapist', 'pedophil', 'pedofil', 'meme'
    }


    def _check(t):
        """Verilen normalize metni kelime listelerine karşı kontrol eder."""
        words = re.findall(r'[a-z]+', t)
        for w in words:
            if w in short_bad or w in long_bad:
                return True
            for bad in long_bad:
                if bad in w:
                    return True
        no_punc = re.sub(r'[^a-z]', '', t)
        for bad in short_bad:
            if no_punc == bad:
                return True
        for bad in long_bad:
            if bad in no_punc:
                return True
        return False

    def _collapse(t):
        """Arka arkaya gelen aynı harfleri teke indirir: siikim → sikim."""
        return re.sub(r'(.)\1+', r'\1', t)

    def _sanitize_bypass(t):
        """Sayı bypass'larını harf karşılıklarına çevirir (ör: s2m -> sikim, g2t -> got)."""
        t = t.replace('s2', 'siki')
        t = t.replace('g2', 'go')
        t = t.replace('am2', 'am')
        return t

    # 4 farklı versiyonu kontrol et:
    # 1) Normal  2) Boşluksuz (s i k → sik)  3) Tekrar temizlenmiş (siikim → sikim)  4) Her ikisi
    no_space = re.sub(r'\s+', '', norm)
    for v in [norm, no_space, _collapse(norm), _collapse(no_space)]:
        if _check(_sanitize_bypass(v)):
            return True

    return False


def validate_level_limits(level_data):
    if not isinstance(level_data, dict):
        return "Geçersiz harita verisi."
        
    width = level_data.get('levelWidth', level_data.get('width', 2000))
    height = level_data.get('levelHeight', level_data.get('height', 600))
    
    if not (800 <= width <= 5000):
        return f"Harita genişliği 800px ile 5000px arasında olmalıdır. (Girilen: {width}px)"
    if not (600 <= height <= 1500):
        return f"Harita yüksekliği 600px ile 1500px arasında olmalıdır. (Girilen: {height}px)"
        
    platforms = level_data.get('platforms', [])
    falling_platforms = level_data.get('fallingPlatforms', [])
    breakable_platforms = level_data.get('breakablePlatforms', [])
    moving_platforms = level_data.get('movingPlatforms', [])
    conveyors = level_data.get('conveyors', [])
    platform_count = len(platforms) + len(falling_platforms) + len(breakable_platforms) + len(moving_platforms) + len(conveyors)
    if platform_count > 200:
        return f"En fazla 200 adet zemin yerleştirilebilir. (Girilen: {platform_count})"
        
    spikes = level_data.get('spikes', [])
    acid_pools = level_data.get('acidPools', [])
    flamethrowers = level_data.get('flamethrowers', [])
    falling_traps = level_data.get('fallingBlockTraps', [])
    shooters = level_data.get('arrowShooters', [])
    hazard_count = len(spikes) + len(acid_pools) + len(flamethrowers) + len(falling_traps) + len(shooters)
    if hazard_count > 100:
        return f"En fazla 100 adet engel/tuzak yerleştirilebilir. (Girilen: {hazard_count})"
        
    gates = level_data.get('lasers', level_data.get('gates', []))
    laser_gates = [g for g in gates if g.get('type') in ('laser', 'pinkLaser', 'greenLaser', 'yellowLaser')]
    emitters = level_data.get('laserEmitters', [])
    receivers = level_data.get('laserReceivers', [])
    laser_count = len(laser_gates) + len(emitters) + len(receivers)
    if laser_count > 40:
        return f"En fazla 40 adet lazer elemanı yerleştirilebilir. (Girilen: {laser_count})"
        
    push_blocks = level_data.get('pushBlocks', [])
    static_mirrors = level_data.get('staticMirrors', [])
    mirror_count = len(push_blocks) + len(static_mirrors)
    if mirror_count > 45:
        return f"En fazla 45 adet itilebilir blok/ayna yerleştirilebilir. (Girilen: {mirror_count})"
        
    enemies = level_data.get('enemies', [])
    if len(enemies) > 40:
        return f"En fazla 40 adet düşman yerleştirilebilir. (Girilen: {len(enemies)})"

    # Dekorasyon yazı kutularını küfür filtresiyle tara
    decorations = level_data.get('decorations', [])
    for deco in decorations:
        if deco.get('type') == 'textbox' and is_offensive(deco.get('text', '')):
            return "Haritadaki bir yazı kutusu uygunsuz veya küfürlü içerik içeriyor."

    return None

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
                is_immortal = likes >= 50

                # Kalıcı Silme: 50 beğeni altındaysa ve son oynanıştan itibaren 30 gün geçmişse db'den tamamen kaldır (Sahibi dahil)
                if not is_immortal and age_seconds > allowed_age_seconds + (30 * 86400):
                    db_changed = True
                    continue # db_maps.json'a dahil etme

                cleaned_db.append(level)

                # Yanıt Filtreleme: Süre dolmadıysa, ebediyse VEYA istek atan kişi bölümün yaratıcısıysa göster
                if is_immortal or age_seconds <= allowed_age_seconds or creator_id == user_id:
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
        elif path == '/api/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            
            masked_uri = None
            if MONGO_URI:
                try:
                    parsed = urllib.parse.urlparse(MONGO_URI)
                    if parsed.password:
                        # Replace the password in the netloc
                        netloc_parts = parsed.netloc.split('@')
                        if len(netloc_parts) > 1:
                            creds = netloc_parts[0].split(':')
                            user = creds[0]
                            netloc_parts[0] = f"{user}:***"
                        new_netloc = '@'.join(netloc_parts)
                        masked_uri = parsed._replace(netloc=new_netloc).geturl()
                    else:
                        masked_uri = parsed.geturl()
                except Exception as parse_err:
                    masked_uri = f"Error parsing URI: {str(parse_err)}"
                    
            status_data = {
                "mongodb_connected": mongo_collection is not None,
                "mongodb_db_name": mongo_db_name,
                "mongodb_error": mongo_error,
                "mongodb_uri_configured": MONGO_URI is not None,
                "mongodb_uri_masked": masked_uri,
                "server_time_utc": datetime.now(timezone.utc).isoformat(),
                "git_commit": os.environ.get('RENDER_GIT_COMMIT', 'unknown'),
                "environment_keys": list(os.environ.keys())
            }
            self.wfile.write(json.dumps(status_data, ensure_ascii=False).encode('utf-8'))
        elif path.startswith('/api/campaign/') and path.endswith('/leaderboard'):
            parts = path.split('/')
            if len(parts) >= 4:
                try:
                    level_num = int(parts[3])
                except ValueError:
                    self.send_response(400)
                    self.end_headers()
                    return
                
                user_id = query.get('userId', [''])[0]
                
                db = read_campaign_db()
                found = None
                for item in db:
                    if item.get('levelNumber') == level_num:
                        found = item
                        break
                
                all_scores = found.get('scores', []) if found else []
                all_scores = sorted(all_scores, key=lambda s: s['time'])
                
                # Top 3 leaderboard
                top_3 = []
                for idx, s in enumerate(all_scores[:3]):
                    top_3.append({
                        'username': s.get('username', 'Anonim'),
                        'time': s.get('time'),
                        'medal': 'gold' if idx == 0 else ('silver' if idx == 1 else 'bronze')
                    })
                
                # Find personal stats
                rank = None
                percentile = None
                personal_best = None
                total_players = len(all_scores)
                
                if user_id:
                    for idx, s in enumerate(all_scores):
                        if s.get('userId') == user_id:
                            rank = idx + 1
                            personal_best = s.get('time')
                            break
                    if rank is not None and total_players > 0:
                        percentile = round((rank / total_players) * 100, 1)
                
                res_data = {
                    'leaderboard': top_3,
                    'rank': rank,
                    'totalPlayers': total_players,
                    'percentile': percentile,
                    'personalBest': personal_best
                }
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(res_data, ensure_ascii=False).encode('utf-8'))
                return
        else:
            # Diğer tüm istekleri (index.html, js/, css/ vb.) standart SimpleHTTPRequestHandler ile sun
            super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = urllib.parse.parse_qs(parsed_url.query)

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


        # Bulut Kayıt Senkronizasyonu: POST /api/user/sync
        if path == '/api/user/sync':
            user_id = body.get('userId')
            save_data = body.get('saveData')
            
            if not user_id or not isinstance(save_data, dict):
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'userId ve saveData gereklidir.'}, ensure_ascii=False).encode('utf-8'))
                return
                
            # İsmini/yapımcı adını filtrele (eğer data içinde varsa)
            author_name = save_data.get('authorName', '')
            if author_name and is_offensive(author_name):
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Tasarımcı adı uygunsuz içerik içeremez.'}, ensure_ascii=False).encode('utf-8'))
                return
                
            existing_user = get_user_by_id(user_id)
            if existing_user:
                # Kullanıcı zaten kayıtlı, saveData'yı güncelle
                existing_user['saveData'] = save_data
                existing_user['lastUpdated'] = datetime.now(timezone.utc).isoformat()
                user_record = existing_user
            else:
                # Yeni kullanıcı, 6 haneli syncCode üret (ör: R8F9T2)
                # Benzersiz olana kadar dene
                import string
                chars = string.ascii_uppercase + string.digits
                sync_code = ''.join(random.choices(chars, k=6))
                while get_user_by_sync_code(sync_code) is not None:
                    sync_code = ''.join(random.choices(chars, k=6))
                    
                user_record = {
                    'userId': user_id,
                    'syncCode': sync_code,
                    'saveData': save_data,
                    'lastUpdated': datetime.now(timezone.utc).isoformat()
                }
                
            if save_user(user_record):
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'syncCode': user_record['syncCode'],
                    'lastUpdated': user_record['lastUpdated']
                }, ensure_ascii=False).encode('utf-8'))
            else:
                self.send_response(500)
                self.end_headers()
            return

        # Bulut Kayıt Geri Yükleme: POST /api/user/restore
        if path == '/api/user/restore':
            sync_code = body.get('syncCode')
            if not sync_code:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'syncCode gereklidir.'}, ensure_ascii=False).encode('utf-8'))
                return
                
            user_record = get_user_by_sync_code(sync_code)
            if user_record:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'userId': user_record['userId'],
                    'saveData': user_record['saveData'],
                    'lastUpdated': user_record['lastUpdated']
                }, ensure_ascii=False).encode('utf-8'))
            else:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Geçersiz veya bulunamayan kurtarma kodu.'}, ensure_ascii=False).encode('utf-8'))
            return

        # Google Giriş ve Senkronizasyon: POST /api/user/google_auth
        if path == '/api/user/google_auth':
            id_token = body.get('idToken')
            current_user_id = body.get('currentUserId')
            
            if not id_token:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'idToken gereklidir.'}, ensure_ascii=False).encode('utf-8'))
                return
                
            # Google'ın tokeninfo API'si ile token doğrula
            try:
                import urllib.request
                import urllib.parse
                verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
                req = urllib.request.Request(verify_url, method="GET")
                with urllib.request.urlopen(req) as resp:
                    token_info = json.loads(resp.read().decode('utf-8'))
                    
                google_id = token_info.get('sub')
                email = token_info.get('email')
                
                if not google_id:
                    raise Exception("Geçersiz token.")
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'error': f'Google doğrulaması başarısız: {str(e)}'}, ensure_ascii=False).encode('utf-8'))
                return
                
            # Google ID ile kayıtlı kullanıcı ara
            user_record = get_user_by_google_id(google_id)
            
            if user_record:
                # Kullanıcı bulundu! Kayıtlı veriyi geri yükle
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'userId': user_record['userId'],
                    'syncCode': user_record.get('syncCode'),
                    'saveData': user_record['saveData'],
                    'lastUpdated': user_record['lastUpdated']
                }, ensure_ascii=False).encode('utf-8'))
            else:
                # Yeni Google kullanıcısı. Mevcut yerel ilerlemeyi bağla
                linked = False
                if current_user_id:
                    anon_user = get_user_by_id(current_user_id)
                    if anon_user:
                        anon_user['googleId'] = google_id
                        anon_user['googleEmail'] = email
                        anon_user['lastUpdated'] = datetime.now(timezone.utc).isoformat()
                        save_user(anon_user)
                        user_record = anon_user
                        linked = True
                        
                if not linked:
                    # Yeni bir kullanıcı oluştur
                    import string
                    import time
                    import uuid
                    chars = string.ascii_uppercase + string.digits
                    sync_code = ''.join(random.choices(chars, k=6))
                    while get_user_by_sync_code(sync_code) is not None:
                        sync_code = ''.join(random.choices(chars, k=6))
                        
                    user_record = {
                        'userId': 'user_' + str(uuid.uuid4())[:8] + '_' + str(int(time.time())),
                        'googleId': google_id,
                        'googleEmail': email,
                        'syncCode': sync_code,
                        'saveData': {},
                        'lastUpdated': datetime.now(timezone.utc).isoformat()
                    }
                    save_user(user_record)
                    
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'userId': user_record['userId'],
                    'syncCode': user_record['syncCode'],
                    'saveData': user_record['saveData'],
                    'lastUpdated': user_record['lastUpdated']
                }, ensure_ascii=False).encode('utf-8'))
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

            validation_error = validate_level_limits(data)
            if validation_error:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'error': validation_error}, ensure_ascii=False).encode('utf-8'))
                return

            if is_offensive(name) or is_offensive(author):
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write('{"error": "Bölüm adı veya yapımcı adı uygunsuz/siyasi içerik içeremez."}'.encode('utf-8'))
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
                'tags': body.get('tags', []),
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
                user_id = query.get('userId', [''])[0]
                db = read_db()
                found = None
                for level in db:
                    if level['id'] == level_id:
                        # Kendi haritasını oynarken süreyi sıfırlayamasın/uzatamasın
                        if level.get('creatorId') != user_id:
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

        # 3.5. Harita derece kaydetme: POST /api/levels/<id>/score
        elif path.startswith('/api/levels/') and path.endswith('/score'):
            parts = path.split('/')
            if len(parts) >= 4:
                level_id = parts[3]
                username = body.get('username')
                score_time = body.get('time')

                if not username or score_time is None:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write('{"error": "Kullanıcı adı ve süre zorunludur."}'.encode('utf-8'))
                    return

                try:
                    score_time = float(score_time)
                except ValueError:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write('{"error": "Geçersiz süre değeri."}'.encode('utf-8'))
                    return

                if score_time <= 0:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write('{"error": "Süre 0\'dan büyük olmalıdır."}'.encode('utf-8'))
                    return

                if is_offensive(username):
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write('{"error": "Kullanıcı adı uygunsuz içerik içeremez."}'.encode('utf-8'))
                    return

                db = read_db()
                found = None
                for level in db:
                    if level['id'] == level_id:
                        found = level
                        break

                if found:
                    if 'scores' not in found:
                        found['scores'] = []

                    # Aynı kullanıcının eski derecesi varsa kontrol et ve güncelle
                    existing_score = None
                    for s in found['scores']:
                        if s.get('username', '').lower().strip() == username.strip().lower():
                            existing_score = s
                            break

                    if existing_score:
                        if score_time < existing_score['time']:
                            existing_score['time'] = score_time
                            existing_score['date'] = datetime.now(timezone.utc).isoformat()
                    else:
                        found['scores'].append({
                            'username': username.strip(),
                            'time': score_time,
                            'date': datetime.now(timezone.utc).isoformat()
                        })

                    # Süreye göre küçükten büyüğe sırala ve en iyi 5 dereceyi tut
                    found['scores'] = sorted(found['scores'], key=lambda s: s['time'])[:5]

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
                    
                validation_error = validate_level_limits(new_data)
                if validation_error:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': validation_error}, ensure_ascii=False).encode('utf-8'))
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
                        if is_offensive(new_name):
                            self.send_response(400)
                            self.send_header('Content-Type', 'application/json; charset=utf-8')
                            self.end_headers()
                            self.wfile.write('{"error": "Bölüm adı uygunsuz/siyasi içerik içeremez."}'.encode('utf-8'))
                            return
                        for level in db:
                            if level['id'] != level_id and level.get('name', '').strip().lower() == new_name.strip().lower():
                                self.send_response(409)
                                self.send_header('Content-Type', 'application/json; charset=utf-8')
                                self.end_headers()
                                self.wfile.write('{"error": "Bu bölüm adı zaten mevcut."}'.encode('utf-8'))
                                return
                        found['name'] = new_name.strip()
                        
                    found['data'] = new_data
                    if 'tags' in body:
                        found['tags'] = body.get('tags', [])
                    
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
        elif path.startswith('/api/campaign/') and path.endswith('/score'):
            parts = path.split('/')
            if len(parts) >= 4:
                try:
                    level_num = int(parts[3])
                except ValueError:
                    self.send_response(400)
                    self.end_headers()
                    return
                
                user_id = body.get('userId')
                username = body.get('username')
                score_time = body.get('time')
                
                if not user_id or not username or score_time is None:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write('{"error": "Kullanıcı ID, adı ve süre zorunludur."}'.encode('utf-8'))
                    return
                
                try:
                    score_time = float(score_time)
                except ValueError:
                    self.send_response(400)
                    self.end_headers()
                    return
                
                if score_time <= 0:
                    self.send_response(400)
                    self.end_headers()
                    return
                
                if is_offensive(username):
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write('{"error": "Kullanıcı adı uygunsuz içerik içeremez."}'.encode('utf-8'))
                    return

                db = read_campaign_db()
                found = None
                for item in db:
                    if item.get('levelNumber') == level_num:
                        found = item
                        break
                
                if not found:
                    found = {'levelNumber': level_num, 'scores': []}
                    db.append(found)
                
                # Check for existing user score
                existing = None
                for s in found['scores']:
                    if s.get('userId') == user_id:
                        existing = s
                        break
                
                if existing:
                    existing['username'] = username.strip()
                    if score_time < existing['time']:
                        existing['time'] = score_time
                        existing['date'] = datetime.now(timezone.utc).isoformat()
                else:
                    found['scores'].append({
                        'userId': user_id,
                        'username': username.strip(),
                        'time': score_time,
                        'date': datetime.now(timezone.utc).isoformat()
                    })
                
                write_campaign_db(db)
                
                # Recalculate stats
                all_scores = sorted(found['scores'], key=lambda s: s['time'])
                top_3 = []
                for idx, s in enumerate(all_scores[:3]):
                    top_3.append({
                        'username': s.get('username', 'Anonim'),
                        'time': s.get('time'),
                        'medal': 'gold' if idx == 0 else ('silver' if idx == 1 else 'bronze')
                    })
                
                rank = None
                personal_best = None
                total_players = len(all_scores)
                for idx, s in enumerate(all_scores):
                    if s.get('userId') == user_id:
                        rank = idx + 1
                        personal_best = s.get('time')
                        break
                
                percentile = round((rank / total_players) * 100, 1) if rank else 100.0
                
                res_data = {
                    'success': True,
                    'leaderboard': top_3,
                    'rank': rank,
                    'totalPlayers': total_players,
                    'percentile': percentile,
                    'personalBest': personal_best
                }
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(res_data, ensure_ascii=False).encode('utf-8'))
                return
            else:
                self.send_response(400)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

def sanitize_existing_db():
    db = read_db()
    original_len = len(db)
    
    # Belirli uygunsuz haritayı sil
    db = [level for level in db if level.get('id') != 'map_1782506417393_451']
    modified = len(db) < original_len
    if modified:
        print("Inappropriate map 'map_1782506417393_451' successfully deleted.")
    
    for level in db:
        name = level.get('name', '')
        author = level.get('author', '')
        scores = level.get('scores', [])
        
        # Harita adını kontrol et
        if is_offensive(name):
            new_name = "".join(random.choices("0123456789", k=8))
            print(f"Renaming offensive map name '{name}' to '{new_name}'")
            level['name'] = new_name
            modified = True
            
        # Yapımcı adını kontrol et
        if is_offensive(author):
            new_author = "".join(random.choices("0123456789", k=8))
            print(f"Renaming offensive author '{author}' to '{new_author}'")
            level['author'] = new_author
            modified = True
            
        # Skorları kontrol et
        for score in scores:
            username = score.get('username', '')
            if is_offensive(username):
                new_username = "".join(random.choices("0123456789", k=8))
                print(f"Renaming offensive score username '{username}' to '{new_username}'")
                score['username'] = new_username
                modified = True
                
    if modified:
        write_db(db)
        print("Existing offensive names sanitized in the database successfully.")
    else:
        print("No offensive names found in the database.")

def run_server():
    sanitize_existing_db()
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
