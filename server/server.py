import json
import os
import random
import urllib.parse
import urllib.request
import threading
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

PORT = int(os.environ.get('PORT', 8080))
DB_FILE = os.path.join(os.path.dirname(__file__), 'db_maps.json')

# Veritabanı kilitleme nesneleri (Eşzamanlı okuma/yazma güvenliği için)
maps_db_lock = threading.Lock()
users_db_lock = threading.Lock()
campaign_db_lock = threading.Lock()

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
mongo_db = None

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

# Otomatik Veri Göçü (Local JSON -> MongoDB)
if MONGO_URI and mongo_collection is not None:
    try:
        # 1. Haritalar Göçü
        if os.path.exists(DB_FILE):
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                local_maps = json.load(f)
            if local_maps and mongo_collection.count_documents({}) == 0:
                print(f"Yerel haritalar ({len(local_maps)} adet) MongoDB'ye aktarılıyor...")
                mongo_collection.insert_many(local_maps)
        
        # 2. Kullanıcılar Göçü
        if os.path.exists(DB_USERS_FILE):
            with open(DB_USERS_FILE, 'r', encoding='utf-8') as f:
                local_users = json.load(f)
            if local_users and mongo_users_collection.count_documents({}) == 0:
                print(f"Yerel kullanıcılar ({len(local_users)} adet) MongoDB'ye aktarılıyor...")
                mongo_users_collection.insert_many(local_users)
                
        # 3. Kampanya Skorları Göçü
        if os.path.exists(DB_CAMPAIGN_FILE):
            with open(DB_CAMPAIGN_FILE, 'r', encoding='utf-8') as f:
                local_scores = json.load(f)
            mongo_scores_coll = mongo_db['campaign_scores']
            if local_scores and mongo_scores_coll.count_documents({}) == 0:
                print(f"Yerel kampanya skorları ({len(local_scores)} adet) MongoDB'ye aktarılıyor...")
                mongo_scores_coll.insert_many(local_scores)
    except Exception as migration_error:
        print("Yerel verileri MongoDB'ye göçürme sırasında hata oluştu:", migration_error)

def read_campaign_db():
    if mongo_collection is not None:
        try:
            db_conn = mongo_collection.database
            return list(db_conn['campaign_scores'].find({}, {'_id': False}))
        except Exception as e:
            print("MongoDB campaign scores okuma hatası, yerel JSON dosyasına geçiliyor:", e)

    with campaign_db_lock:
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

    with campaign_db_lock:
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

    with users_db_lock:
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

    with users_db_lock:
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

def generate_signature_py(total, spent, owned_str):
    salt = "ViscoraSecretSaltKey_2026_xYz"
    string_val = f"{total}_{spent}_{owned_str}_{salt}"
    hash1 = 5381
    hash2 = 0
    for char in string_val:
        code = ord(char)
        hash1 = ((hash1 << 5) + hash1 + code) & 0xFFFFFFFF
        hash2 = (code + (hash2 << 6) + (hash2 << 16) - hash2) & 0xFFFFFFFF
    return f"{hash1:x}{hash2:x}"

def merge_save_data(db_save, incoming_save):
    if not db_save:
        return incoming_save or {}
    if not incoming_save:
        return db_save or {}
        
    merged = db_save.copy()
    
    # Achievements ve İstatistik Birleştirme
    db_ach = db_save.get('achievements', {})
    inc_ach = incoming_save.get('achievements', {})
    if isinstance(db_ach, str):
        try: db_ach = json.loads(db_ach)
        except: db_ach = {}
    if isinstance(inc_ach, str):
        try: inc_ach = json.loads(inc_ach)
        except: inc_ach = {}
    if not isinstance(db_ach, dict): db_ach = {}
    if not isinstance(inc_ach, dict): inc_ach = {}
    
    merged_ach = db_ach.copy()
    merged_ach.update(inc_ach)
    merged['achievements'] = merged_ach
    
    db_deaths = int(db_save.get('statsDeaths', 0) or 0)
    inc_deaths = int(incoming_save.get('statsDeaths', 0) or 0)
    merged['statsDeaths'] = max(db_deaths, inc_deaths)
    
    db_shifts = int(db_save.get('statsFormShifts', 0) or 0)
    inc_shifts = int(incoming_save.get('statsFormShifts', 0) or 0)
    merged['statsFormShifts'] = max(db_shifts, inc_shifts)
    
    # 1. Kristaller ve Kozmetikler (En yüksek toplam kristale sahip olan kazanır)
    db_total = int(db_save.get('totalCrystals', 0) or 0)
    inc_total = int(incoming_save.get('totalCrystals', 0) or 0)
    
    # Her halükarda sahip olunan eşyaları birleştir (Böylece hiçbir cihazdaki eşya kaybolmaz)
    db_items = db_save.get('ownedItems', [])
    if isinstance(db_items, str):
        try: db_items = json.loads(db_items)
        except: db_items = []
    if not isinstance(db_items, list):
        db_items = []
        
    inc_items = incoming_save.get('ownedItems', [])
    if isinstance(inc_items, str):
        try: inc_items = json.loads(inc_items)
        except: inc_items = []
    if not isinstance(inc_items, list):
        inc_items = []
        
    merged_items = list(set(db_items + inc_items))
    for default_item in ['default_trail', 'default_accessory', 'default_eyes']:
        if default_item not in merged_items:
            merged_items.append(default_item)
            
    merged['ownedItems'] = merged_items
    
    if inc_total >= db_total:
        merged['totalCrystals'] = inc_total
        merged['spentCrystals'] = incoming_save.get('spentCrystals', 0)
    else:
        merged['totalCrystals'] = db_total
        merged['spentCrystals'] = db_save.get('spentCrystals', 0)
        
    # Birleştirilmiş eşyalara göre yeni doğrulama imzasını üret
    owned_str = json.dumps(merged['ownedItems'], separators=(',', ':'))
    merged['balanceSig'] = generate_signature_py(merged['totalCrystals'], merged['spentCrystals'], owned_str)
            
    # 2. Bölüm İlerlemesi (En yüksek seviye kazanır)
    db_lvl = int(db_save.get('unlockedLevel', 1) or 1)
    inc_lvl = int(incoming_save.get('unlockedLevel', 1) or 1)
    merged['unlockedLevel'] = max(db_lvl, inc_lvl)
    
    # Bölüm yıldızlarını akıllıca birleştir (her bölüm için en yüksek yıldız sayısını koru)
    db_stars = db_save.get('stars', {}) or {}
    if isinstance(db_stars, str):
        try: db_stars = json.loads(db_stars)
        except: db_stars = {}
    if not isinstance(db_stars, dict):
        db_stars = {}
        
    inc_stars = incoming_save.get('stars', {}) or {}
    if isinstance(inc_stars, str):
        try: inc_stars = json.loads(inc_stars)
        except: inc_stars = {}
    if not isinstance(inc_stars, dict):
        inc_stars = {}
        
    merged_stars = {}
    for lvl_str in set(list(db_stars.keys()) + list(inc_stars.keys())):
        try:
            merged_stars[lvl_str] = max(int(db_stars.get(lvl_str, 0)), int(inc_stars.get(lvl_str, 0)))
        except:
            merged_stars[lvl_str] = 0
            
    merged['stars'] = merged_stars
    
    if inc_lvl >= db_lvl:
        if 'progress' in incoming_save:
            merged['progress'] = incoming_save['progress']
    else:
        if 'progress' in db_save:
            merged['progress'] = db_save['progress']
            
    # 3. Editör Taslak Haritaları (Boş olmayanları koru)
    for i in range(1, 6):
        key = f'draftSlot{i}'
        inc_slot = incoming_save.get(key)
        db_slot = db_save.get(key)
        if inc_slot:
            merged[key] = inc_slot
        elif db_slot:
            merged[key] = db_slot
            
    # 4. Diğer Ayarlar ve Karakter Bilgileri (Boş olmayanları ez + Akıllı Zaman Damgası Koruması)
    db_profile_time = int(db_save.get('profileLastChanged', 0) or 0)
    inc_profile_time = int(incoming_save.get('profileLastChanged', 0) or 0)
    
    if inc_profile_time >= db_profile_time:
        for key in ['avatar', 'authorName', 'activeTrail', 'activeAccessory', 'activeEyes', 'profileLastChanged']:
            if key in incoming_save:
                val = incoming_save[key]
                if val not in [None, ""]:
                    if key == 'authorName' and val in ['Tasarımcı', 'Oyuncu', 'oyuncu'] and db_save.get('authorName') not in [None, "", 'Tasarımcı', 'Oyuncu', 'oyuncu']:
                        continue
                    if key == 'avatar' and val == 'slime_king' and db_save.get('avatar') not in [None, "", 'slime_king']:
                        continue
                    merged[key] = val
    else:
        for key in ['avatar', 'authorName', 'activeTrail', 'activeAccessory', 'activeEyes', 'profileLastChanged']:
            if key in db_save:
                merged[key] = db_save[key]
                    
    # Profil dışı diğer genel ayarları ve haftalık görevleri doğrudan eşitle
    for key in ['difficulty', 'customControls', 'likedMaps', 'dailyLastClaimDate', 'dailyStreak', 'activeSlot', 'weeklyProgress', 'weeklyClaimed', 'weeklyResetTime']:
        inc_val = incoming_save.get(key)
        db_val = db_save.get(key)
        if inc_val not in [None, "", [], {}]:
            merged[key] = inc_val
        elif db_val not in [None, "", [], {}]:
            merged[key] = db_val
            
    return merged

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

def get_user_by_email(email):
    if not email:
        return None
    email = str(email).strip().lower()
    if mongo_users_collection is not None:
        try:
            res = mongo_users_collection.find_one({'googleEmail': email}, {'_id': False})
            if res:
                return res
        except Exception as e:
            print("MongoDB find_one by googleEmail error:", e)
            
    users = read_users_db()
    for u in users:
        u_email = u.get('googleEmail')
        if u_email and str(u_email).strip().lower() == email:
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

    with maps_db_lock:
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

    with maps_db_lock:
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
        'amk', 'aq', 'sik', 'am', 'got', 'pic', 'oc', 'pust',
        'akp', 'chp', 'mhp', 'hdp', 'rte', 'feto',
        'bok', 'ibne', 'gavat', 'gavad', 'gerzek', 'angut',
        'ass', 'shit', 'cunt', 'dick', 'cock', 'slut', 'nigga',
        'bastard', 'fag', 'boner', 'cum', 'rape',
        's2m', 's2k', 's2ks', 'am2', 'g2t'
    }

    long_bad = {
        'yarrak', 'yarak', 'assak', 'tasak', 'tassak', 'dassak', 'dasak', 'orospu', 'siktir', 'pezevenk', 'kahpe',
        'amcik', 'kaltak', 'erdogan', 'pkk',
        'kilicdaroglu', 'imamoglu', 'ataturk',
        'siken', 'domalt', 'domalan', 'domalm',
        'sikim', 'sikime', 'sikis', 'sikti', 'sike', 'sikip', 'siksen',
        'sikem', 'siker', 'siktim', 'sikcem', 'sikicem', 'sikik',
        'sikisler', 'soktum', 'sokar',
        'otuzbir', 'altmisdokuz', 'masturbasyon',
        'dalyarak', 'dalyarrak', 'dangalak', 'fahise',
        'gerizekal', 'gerzekl',
        'ananin', 'ananisi', 'ananiko',
        'bacini', 'bacina',
        'godos', 'godumun', 'atmik',
        'amina', 'aminako', 'aminakoy',
        'boklu', 'boktan', 'bokbok', 'bombok',
        'orosbuc', 'orospuc',
        'fuck', 'bitch', 'asshole', 'motherfuck', 'nigger', 'faggot',
        'whore', 'porn', 'dildo', 'fucker', 'fuckin', 'goddamn',
        'pussy', 'rapist', 'pedophil', 'pedofil', 'meme'
    }

    def _check(t):
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
        return re.sub(r'(.)\1+', r'\1', t)

    def _sanitize_bypass(t):
        t = t.replace('s2', 'siki')
        t = t.replace('g2', 'go')
        t = t.replace('am2', 'am')
        return t

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

    decorations = level_data.get('decorations', [])
    for deco in decorations:
        if deco.get('type') == 'textbox' and is_offensive(deco.get('text', '')):
            return "Haritadaki bir yazı kutusu uygunsuz veya küfürlü içerik içeriyor."

    return None

def sanitize_existing_db():
    db = read_db()
    original_len = len(db)
    
    db = [level for level in db if level.get('id') != 'map_1782506417393_451']
    modified = len(db) < original_len
    if modified:
        print("Inappropriate map 'map_1782506417393_451' successfully deleted.")
    
    for level in db:
        name = level.get('name', '')
        author = level.get('author', '')
        scores = level.get('scores', [])
        
        if is_offensive(name):
            new_name = "".join(random.choices("0123456789", k=8))
            print(f"Renaming offensive map name '{name}' to '{new_name}'")
            level['name'] = new_name
            modified = True
            
        if is_offensive(author):
            new_author = "".join(random.choices("0123456789", k=8))
            print(f"Renaming offensive author '{author}' to '{new_author}'")
            level['author'] = new_author
            modified = True
            
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

# FastAPI Uygulaması
app = FastAPI(title="Viscora API Server", docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    sanitize_existing_db()

@app.get("/api/debug_users")
async def get_debug_users():
    users = read_users_db()
    debug_info = []
    for u in users:
        debug_info.append({
            'userId': u.get('userId'),
            'googleEmail': u.get('googleEmail'),
            'syncCode': u.get('syncCode'),
            'totalCrystals': u.get('saveData', {}).get('totalCrystals'),
            'spentCrystals': u.get('saveData', {}).get('spentCrystals'),
            'avatar': u.get('saveData', {}).get('avatar'),
            'authorName': u.get('saveData', {}).get('authorName'),
            'lastUpdated': u.get('lastUpdated')
        })
    return debug_info

@app.get("/api/levels")
async def get_levels(sort: str = 'new', userId: str = ''):
    db = read_db()
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

        # Kalıcı Silme: 50 beğeni altındaysa ve son oynanıştan itibaren 30 gün geçmişse db'den kaldır
        if not is_immortal and age_seconds > allowed_age_seconds + (30 * 86400):
            db_changed = True
            continue

        cleaned_db.append(level)

        if is_immortal or age_seconds <= allowed_age_seconds or creator_id == userId:
            response_db.append(level)

    if db_changed:
        write_db(cleaned_db)

    if sort == 'popular':
        response_db.sort(key=lambda x: (x.get('likes', 0), x.get('createdAt', '')), reverse=True)
    else:
        response_db.sort(key=lambda x: x.get('createdAt', ''), reverse=True)

    return response_db

@app.get("/api/status")
async def get_status():
    masked_uri = None
    if MONGO_URI:
        try:
            parsed = urllib.parse.urlparse(MONGO_URI)
            if parsed.password:
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
            
    return {
        "mongodb_connected": mongo_collection is not None,
        "mongodb_db_name": mongo_db_name,
        "mongodb_error": mongo_error,
        "mongodb_uri_configured": MONGO_URI is not None,
        "mongodb_uri_masked": masked_uri,
        "server_time_utc": datetime.now(timezone.utc).isoformat(),
        "git_commit": os.environ.get('RENDER_GIT_COMMIT', 'unknown'),
        "environment_keys": list(os.environ.keys())
    }

@app.get("/api/campaign/{level_num}/leaderboard")
async def get_campaign_leaderboard(level_num: int, userId: str = ''):
    db = read_campaign_db()
    found = None
    for item in db:
        if item.get('levelNumber') == level_num:
            found = item
            break
            
    all_scores = found.get('scores', []) if found else []
    all_scores = sorted(all_scores, key=lambda s: s['time'])
    
    top_3 = []
    for idx, s in enumerate(all_scores[:3]):
        top_3.append({
            'username': s.get('username', 'Anonim'),
            'time': s.get('time'),
            'medal': 'gold' if idx == 0 else ('silver' if idx == 1 else 'bronze')
        })
    
    rank = None
    percentile = None
    personal_best = None
    total_players = len(all_scores)
    
    if userId:
        for idx, s in enumerate(all_scores):
            if s.get('userId') == userId:
                rank = idx + 1
                personal_best = s.get('time')
                break
        if rank is not None and total_players > 0:
            percentile = round((rank / total_players) * 100, 1)
            
    return {
        'leaderboard': top_3,
        'rank': rank,
        'totalPlayers': total_players,
        'percentile': percentile,
        'personalBest': personal_best
    }

@app.post("/api/user/sync")
async def post_user_sync(request: Request):
    body = await request.json()
    user_id = body.get('userId')
    save_data = body.get('saveData')
    
    if not user_id or not isinstance(save_data, dict):
        return JSONResponse(status_code=400, content={'error': 'userId ve saveData gereklidir.'})
        
    author_name = save_data.get('authorName', '')
    if author_name and is_offensive(author_name):
        return JSONResponse(status_code=400, content={'error': 'Tasarımcı adı uygunsuz içerik içeremez.'})
        
    force = body.get('force', False)
    existing_user = get_user_by_id(user_id)
    if existing_user:
        if force:
            existing_user['saveData'] = save_data
        else:
            db_save = existing_user.get('saveData', {})
            db_time = int(db_save.get('lastSaveTime', 0) or 0)
            inc_time = int(save_data.get('lastSaveTime', 0) or 0)
            
            if inc_time >= db_time:
                existing_user['saveData'] = save_data
        existing_user['lastUpdated'] = datetime.now(timezone.utc).isoformat()
        user_record = existing_user
    else:
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
        return {
            'status': 'success',
            'syncCode': user_record['syncCode'],
            'saveData': user_record['saveData'],
            'lastUpdated': user_record['lastUpdated']
        }
    else:
        return JSONResponse(status_code=500, content={'error': 'Veritabanına kaydedilemedi.'})

@app.post("/api/user/restore")
async def post_user_restore(request: Request):
    body = await request.json()
    sync_code = body.get('syncCode')
    if not sync_code:
        return JSONResponse(status_code=400, content={'error': 'syncCode gereklidir.'})
        
    user_record = get_user_by_sync_code(sync_code)
    if user_record:
        return {
            'status': 'success',
            'userId': user_record['userId'],
            'saveData': user_record['saveData'],
            'lastUpdated': user_record['lastUpdated']
        }
    else:
        return JSONResponse(status_code=404, content={'error': 'Geçersiz veya bulunamayan kurtarma kodu.'})

@app.post("/api/admin/search-users")
async def post_admin_search_users(request: Request):
    body = await request.json()
    query = body.get('query', '')
    secret = body.get('secret')
    
    if secret != "ViscoraSecretAdminKey_2026":
        return JSONResponse(status_code=403, content={'error': 'Yetkisiz erişim.'})
        
    matched_users = []
    if mongo_users_collection is not None:
        try:
            cursor = mongo_users_collection.find(
                {'googleEmail': {'$regex': query, '$options': 'i'}}, 
                {'_id': False}
            )
            matched_users = list(cursor)
        except Exception as e:
            print("MongoDB search error:", e)
    else:
        users = read_users_db()
        for u in users:
            u_email = u.get('googleEmail')
            if u_email and query.lower() in str(u_email).lower():
                matched_users.append(u)
                
    results = []
    for u in matched_users:
        results.append({
            'email': u.get('googleEmail'),
            'userId': u.get('userId'),
            'syncCode': u.get('syncCode'),
            'totalCrystals': u.get('saveData', {}).get('totalCrystals', 0)
        })
        
    return {'results': results}

@app.post("/api/admin/add-crystals")
async def post_admin_add_crystals(request: Request):
    body = await request.json()
    email = body.get('email')
    count = body.get('count', 0)
    secret = body.get('secret')
    
    if secret != "ViscoraSecretAdminKey_2026":
        return JSONResponse(status_code=403, content={'error': 'Yetkisiz erişim.'})
        
    if not email or count <= 0:
        return JSONResponse(status_code=400, content={'error': 'Geçersiz email veya elmas adedi.'})
        
    user_record = get_user_by_email(email)
    if not user_record:
        return JSONResponse(status_code=404, content={'error': 'Belirtilen e-postaya ait kayıt bulunamadı.'})
        
    save_data = user_record.get('saveData', {})
    total = int(save_data.get('totalCrystals', 0) or 0) + count
    spent = int(save_data.get('spentCrystals', 0) or 0)
    
    save_data['totalCrystals'] = total
    
    import time
    owned_items = save_data.get('ownedItems', ['default_trail', 'default_accessory', 'default_eyes'])
    if isinstance(owned_items, str):
        try: owned_items = json.loads(owned_items)
        except: pass
    if not isinstance(owned_items, list):
        owned_items = ['default_trail', 'default_accessory', 'default_eyes']
    
    owned_str = json.dumps(owned_items, separators=(',', ':'))
    sig = generate_signature_py(total, spent, owned_str)
    save_data['balanceSig'] = sig
    
    now_ms = int(time.time() * 1000)
    save_data['lastSaveTime'] = now_ms
    user_record['saveData'] = save_data
    user_record['lastUpdated'] = datetime.now(timezone.utc).isoformat()
    
    if save_user(user_record):
        return {
            'status': 'success',
            'message': f'{email} hesabına {count} elmas başarıyla eklendi.',
            'totalCrystals': total,
            'lastSaveTime': now_ms
        }
    else:
        return JSONResponse(status_code=500, content={'error': 'Elmas eklenemedi.'})

@app.post("/api/user/google_auth")
async def post_user_google_auth(request: Request):
    body = await request.json()
    id_token = body.get('idToken')
    current_user_id = body.get('currentUserId')
    
    if not id_token:
        return JSONResponse(status_code=400, content={'error': 'idToken gereklidir.'})
        
    try:
        verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
        req = urllib.request.Request(verify_url, method="GET")
        with urllib.request.urlopen(req) as resp:
            token_info = json.loads(resp.read().decode('utf-8'))
            
        google_id = token_info.get('sub')
        email = token_info.get('email')
        
        if not google_id:
            raise Exception("Geçersiz token.")
    except Exception as e:
        return JSONResponse(status_code=400, content={'error': f'Google doğrulaması başarısız: {str(e)}'})
        
    user_record = get_user_by_google_id(google_id)
    if user_record:
        return {
            'status': 'success',
            'userId': user_record['userId'],
            'syncCode': user_record.get('syncCode'),
            'saveData': user_record['saveData'],
            'lastUpdated': user_record['lastUpdated']
        }
    else:
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
            
        return {
            'status': 'success',
            'userId': user_record['userId'],
            'syncCode': user_record['syncCode'],
            'saveData': user_record['saveData'],
            'lastUpdated': user_record['lastUpdated']
        }

@app.post("/api/levels")
async def post_publish_level(request: Request):
    body = await request.json()
    name = body.get('name')
    author = body.get('author')
    creator_id = body.get('creatorId', '')
    data = body.get('data')
    
    if not name or not author or not data:
        return JSONResponse(status_code=400, content={'error': 'Harita adı, yapımcı ve harita verileri zorunludur.'})
        
    validation_error = validate_level_limits(data)
    if validation_error:
        return JSONResponse(status_code=400, content={'error': validation_error})
        
    if is_offensive(name) or is_offensive(author):
        return JSONResponse(status_code=400, content={'error': 'Bölüm adı veya yapımcı adı uygunsuz/siyasi içerik içeremez.'})
        
    db = read_db()
    for level in db:
        if level.get('name', '').strip().lower() == name.strip().lower():
            return JSONResponse(status_code=409, content={'error': 'Bu bölüm adı zaten mevcut.'})
            
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
        return JSONResponse(status_code=201, content=new_level)
    else:
        return JSONResponse(status_code=500, content={'error': 'Harita kaydedilemedi.'})

@app.post("/api/levels/{level_id}/like")
async def post_like_level(level_id: str):
    db = read_db()
    found = None
    for level in db:
        if level['id'] == level_id:
            level['likes'] = level.get('likes', 0) + 1
            found = level
            break
            
    if found:
        if write_db(db):
            return found
        else:
            return JSONResponse(status_code=500, content={'error': 'Beğeni kaydedilemedi.'})
    else:
        return JSONResponse(status_code=404, content={'error': 'Harita bulunamadı.'})

@app.post("/api/levels/{level_id}/play")
async def post_play_level(level_id: str, request: Request):
    userId = request.query_params.get('userId', '')
    db = read_db()
    found = None
    for level in db:
        if level['id'] == level_id:
            if level.get('creatorId') != userId:
                level['lastPlayedAt'] = datetime.now(timezone.utc).isoformat()
            found = level
            break
            
    if found:
        if write_db(db):
            return {'status': 'ok'}
        else:
            return JSONResponse(status_code=500, content={'error': 'Oynanma kaydedilemedi.'})
    else:
        return JSONResponse(status_code=404, content={'error': 'Harita bulunamadı.'})

@app.post("/api/levels/{level_id}/score")
async def post_level_score(level_id: str, request: Request):
    body = await request.json()
    username = body.get('username')
    score_time = body.get('time')
    
    if not username or score_time is None:
        return JSONResponse(status_code=400, content={'error': 'Kullanıcı adı ve süre zorunludur.'})
        
    try:
        score_time = float(score_time)
    except ValueError:
        return JSONResponse(status_code=400, content={'error': 'Geçersiz süre değeri.'})
        
    if score_time <= 0:
        return JSONResponse(status_code=400, content={'error': "Süre 0'dan büyük olmalıdır."})
        
    if is_offensive(username):
        return JSONResponse(status_code=400, content={'error': 'Kullanıcı adı uygunsuz içerik içeremez.'})
        
    db = read_db()
    found = None
    for level in db:
        if level['id'] == level_id:
            found = level
            break
            
    if found:
        if 'scores' not in found:
            found['scores'] = []
            
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
            
        found['scores'] = sorted(found['scores'], key=lambda s: s['time'])[:5]
        
        if write_db(db):
            return found
        else:
            return JSONResponse(status_code=500, content={'error': 'Skor kaydedilemedi.'})
    else:
        return JSONResponse(status_code=404, content={'error': 'Harita bulunamadı.'})

@app.post("/api/levels/{level_id}/update")
async def post_update_level(level_id: str, request: Request):
    body = await request.json()
    creator_id = body.get('creatorId', '')
    new_data = body.get('data')
    new_name = body.get('name')
    
    if not new_data:
        return JSONResponse(status_code=400, content={'error': 'Güncellenecek veri bulunamadı.'})
        
    validation_error = validate_level_limits(new_data)
    if validation_error:
        return JSONResponse(status_code=400, content={'error': validation_error})
        
    db = read_db()
    found = None
    for level in db:
        if level['id'] == level_id:
            found = level
            break
            
    if found:
        if found.get('creatorId') != creator_id:
            return JSONResponse(status_code=403, content={'error': 'Bu bölümü güncelleme izniniz yok.'})
            
        if new_name and new_name.strip().lower() != found.get('name', '').strip().lower():
            if is_offensive(new_name):
                return JSONResponse(status_code=400, content={'error': 'Bölüm adı uygunsuz/siyasi içerik içeremez.'})
            for level in db:
                if level['id'] != level_id and level.get('name', '').strip().lower() == new_name.strip().lower():
                    return JSONResponse(status_code=409, content={'error': 'Bu bölüm adı zaten mevcut.'})
            found['name'] = new_name.strip()
            
        found['data'] = new_data
        if 'tags' in body:
            found['tags'] = body.get('tags', [])
            
        if write_db(db):
            return found
        else:
            return JSONResponse(status_code=500, content={'error': 'Harita güncellenemedi.'})
    else:
        return JSONResponse(status_code=404, content={'error': 'Harita bulunamadı.'})

@app.post("/api/campaign/{level_num}/score")
async def post_campaign_score(level_num: int, request: Request):
    body = await request.json()
    user_id = body.get('userId')
    username = body.get('username')
    score_time = body.get('time')
    
    if not user_id or not username or score_time is None:
        return JSONResponse(status_code=400, content={'error': 'Kullanıcı ID, adı ve süre zorunludur.'})
        
    try:
        score_time = float(score_time)
    except ValueError:
        return JSONResponse(status_code=400, content={'error': 'Geçersiz süre değeri.'})
        
    if score_time <= 0:
        return JSONResponse(status_code=400, content={'error': "Süre 0'dan büyük olmalıdır."})
        
    if is_offensive(username):
        return JSONResponse(status_code=400, content={'error': 'Kullanıcı adı uygunsuz içerik içeremez.'})
        
    db = read_campaign_db()
    found = None
    for item in db:
        if item.get('levelNumber') == level_num:
            found = item
            break
            
    if not found:
        found = {'levelNumber': level_num, 'scores': []}
        db.append(found)
        
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
    
    return {
        'success': True,
        'leaderboard': top_3,
        'rank': rank,
        'totalPlayers': total_players,
        'percentile': percentile,
        'personalBest': personal_best
    }

# Statik Dosyaları Sunma (Wildcard fallback en sonda tanımlanmalıdır)
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
app.mount("/", StaticFiles(directory=root_dir, html=True), name="static")

if __name__ == '__main__':
    import uvicorn
    import sys
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
        
    print(f"Viscora API Sunucusu (FastAPI/Uvicorn) {PORT} portunda başlatılıyor...")
    uvicorn.run("server:app", host="0.0.0.0", port=PORT, log_level="warning")
