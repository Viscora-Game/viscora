const CACHE_NAME = 'viscora-cache-v305';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v305',
  './manifest.json',
  './js/main.js?v=v305',
  './js/game.js?v=v305',
  './js/audio.js?v=v305',
  './js/ui.js?v=v305',
  './js/level.js?v=v305',
  './js/player.js?v=v305',
  './js/enemies.js?v=v305',
  './js/viscosity.js?v=v305',
  './js/boss.js?v=v305',
  './js/editor.js?v=v305',
  './js/controls_customizer.js?v=v305',
  './js/cloud_save.js?v=v305',
  './js/generator.js?v=v305',
  './js/shop.js?v=v305',
  './privacy.html?v=v305',
  './terms.html?v=v305',
  './assets/dragon_head.png',
  './assets/flamethrower.png',
  './assets/avatars/slime_king.png?v=v305',
  './assets/avatars/mecha_drone.png?v=v305',
  './assets/avatars/fire_elemental.png?v=v305',
  './assets/avatars/ancient_totem.png?v=v305',
  './assets/avatars/crystal_shard.png?v=v305',
  './assets/avatars/ghost_orb.png?v=v305',
  './assets/avatars/tentacle_blob.png?v=v305',
  './assets/avatars/shadow_artifact.png?v=v305'
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


