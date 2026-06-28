const CACHE_NAME = 'viscora-cache-v282';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v282',
  './manifest.json',
  './js/main.js?v=v282',
  './js/game.js?v=v282',
  './js/audio.js?v=v282',
  './js/ui.js?v=v282',
  './js/level.js?v=v282',
  './js/player.js?v=v282',
  './js/enemies.js?v=v282',
  './js/viscosity.js?v=v282',
  './js/boss.js?v=v282',
  './js/editor.js?v=v282',
  './js/controls_customizer.js?v=v282',
  './js/cloud_save.js?v=v282',
  './js/generator.js?v=v282',
  './js/shop.js?v=v282',
  './assets/dragon_head.png',
  './assets/flamethrower.png',
  './assets/avatars/slime_king.png?v=v282',
  './assets/avatars/mecha_drone.png?v=v282',
  './assets/avatars/fire_elemental.png?v=v282',
  './assets/avatars/ancient_totem.png?v=v282',
  './assets/avatars/crystal_shard.png?v=v282',
  './assets/avatars/ghost_orb.png?v=v282',
  './assets/avatars/tentacle_blob.png?v=v282',
  './assets/avatars/shadow_artifact.png?v=v282'
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


