const CACHE_NAME = 'viscora-cache-v269';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v269',
  './manifest.json',
  './js/main.js?v=v269',
  './js/game.js?v=v269',
  './js/audio.js?v=v269',
  './js/ui.js?v=v269',
  './js/level.js?v=v269',
  './js/player.js?v=v269',
  './js/enemies.js?v=v269',
  './js/viscosity.js?v=v269',
  './js/boss.js?v=v269',
  './js/editor.js?v=v269',
  './js/controls_customizer.js?v=v269',
  './js/cloud_save.js?v=v269',
  './js/generator.js?v=v269',
  './js/shop.js?v=v269',
  './assets/dragon_head.png',
  './assets/flamethrower.png',
  './assets/avatars/slime_king.png?v=v269',
  './assets/avatars/mecha_drone.png?v=v269',
  './assets/avatars/fire_elemental.png?v=v269',
  './assets/avatars/ancient_totem.png?v=v269',
  './assets/avatars/crystal_shard.png?v=v269',
  './assets/avatars/ghost_orb.png?v=v269',
  './assets/avatars/tentacle_blob.png?v=v269',
  './assets/avatars/shadow_artifact.png?v=v269'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // API isteklerini veya GET dışındaki istekleri önbelleğe alma
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) {
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Arka planda güncel sürümü sorgula ve önbelleği güncelle (Stale-While-Revalidate)
        fetch(e.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});


