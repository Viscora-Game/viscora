const CACHE_NAME = 'viscora-cache-v303';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v303',
  './manifest.json',
  './js/main.js?v=v303',
  './js/game.js?v=v303',
  './js/audio.js?v=v303',
  './js/ui.js?v=v303',
  './js/level.js?v=v303',
  './js/player.js?v=v303',
  './js/enemies.js?v=v303',
  './js/viscosity.js?v=v303',
  './js/boss.js?v=v303',
  './js/editor.js?v=v303',
  './js/controls_customizer.js?v=v303',
  './js/cloud_save.js?v=v303',
  './js/generator.js?v=v303',
  './js/shop.js?v=v303',
  './privacy.html?v=v303',
  './terms.html?v=v303',
  './assets/dragon_head.png',
  './assets/flamethrower.png',
  './assets/avatars/slime_king.png?v=v303',
  './assets/avatars/mecha_drone.png?v=v303',
  './assets/avatars/fire_elemental.png?v=v303',
  './assets/avatars/ancient_totem.png?v=v303',
  './assets/avatars/crystal_shard.png?v=v303',
  './assets/avatars/ghost_orb.png?v=v303',
  './assets/avatars/tentacle_blob.png?v=v303',
  './assets/avatars/shadow_artifact.png?v=v303'
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


