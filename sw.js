const CACHE_NAME = 'viscora-cache-v309';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v309',
  './manifest.json',
  './js/main.js?v=v309',
  './js/game.js?v=v309',
  './js/audio.js?v=v309',
  './js/ui.js?v=v309',
  './js/level.js?v=v309',
  './js/player.js?v=v309',
  './js/enemies.js?v=v309',
  './js/viscosity.js?v=v309',
  './js/boss.js?v=v309',
  './js/editor.js?v=v309',
  './js/controls_customizer.js?v=v309',
  './js/cloud_save.js?v=v309',
  './js/generator.js?v=v309',
  './js/shop.js?v=v309',
  './privacy.html?v=v309',
  './terms.html?v=v309',
  './assets/dragon_head.png',
  './assets/flamethrower.png',
  './assets/avatars/slime_king.png?v=v309',
  './assets/avatars/mecha_drone.png?v=v309',
  './assets/avatars/fire_elemental.png?v=v309',
  './assets/avatars/ancient_totem.png?v=v309',
  './assets/avatars/crystal_shard.png?v=v309',
  './assets/avatars/ghost_orb.png?v=v309',
  './assets/avatars/tentacle_blob.png?v=v309',
  './assets/avatars/shadow_artifact.png?v=v309'
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


