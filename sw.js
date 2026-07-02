const CACHE_NAME = 'viscora-cache-v307';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v307',
  './manifest.json',
  './js/main.js?v=v307',
  './js/game.js?v=v307',
  './js/audio.js?v=v307',
  './js/ui.js?v=v307',
  './js/level.js?v=v307',
  './js/player.js?v=v307',
  './js/enemies.js?v=v307',
  './js/viscosity.js?v=v307',
  './js/boss.js?v=v307',
  './js/editor.js?v=v307',
  './js/controls_customizer.js?v=v307',
  './js/cloud_save.js?v=v307',
  './js/generator.js?v=v307',
  './js/shop.js?v=v307',
  './privacy.html?v=v307',
  './terms.html?v=v307',
  './assets/dragon_head.png',
  './assets/flamethrower.png',
  './assets/avatars/slime_king.png?v=v307',
  './assets/avatars/mecha_drone.png?v=v307',
  './assets/avatars/fire_elemental.png?v=v307',
  './assets/avatars/ancient_totem.png?v=v307',
  './assets/avatars/crystal_shard.png?v=v307',
  './assets/avatars/ghost_orb.png?v=v307',
  './assets/avatars/tentacle_blob.png?v=v307',
  './assets/avatars/shadow_artifact.png?v=v307'
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


