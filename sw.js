const CACHE_NAME = 'viscora-cache-v322';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v322',
  './manifest.json',
  './js/main.js?v=v322',
  './js/game.js?v=v322',
  './js/audio.js?v=v322',
  './js/ui.js?v=v322',
  './js/level.js?v=v322',
  './js/player.js?v=v322',
  './js/enemies.js?v=v322',
  './js/viscosity.js?v=v322',
  './js/boss.js?v=v322',
  './js/editor.js?v=v322',
  './js/controls_customizer.js?v=v322',
  './js/cloud_save.js?v=v322',
  './js/generator.js?v=v322',
  './js/shop.js?v=v322',
  './privacy.html?v=v322',
  './terms.html?v=v322',
  './assets/dragon_head.png',
  './assets/flamethrower.png',
  './assets/avatars/slime_king.png?v=v322',
  './assets/avatars/mecha_drone.png?v=v322',
  './assets/avatars/fire_elemental.png?v=v322',
  './assets/avatars/ancient_totem.png?v=v322',
  './assets/avatars/crystal_shard.png?v=v322',
  './assets/avatars/ghost_orb.png?v=v322',
  './assets/avatars/tentacle_blob.png?v=v322',
  './assets/avatars/shadow_artifact.png?v=v322'
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


