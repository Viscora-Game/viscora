const CACHE_NAME = 'viscora-cache-v315';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v315',
  './manifest.json',
  './js/main.js?v=v315',
  './js/game.js?v=v315',
  './js/audio.js?v=v315',
  './js/ui.js?v=v315',
  './js/level.js?v=v315',
  './js/player.js?v=v315',
  './js/enemies.js?v=v315',
  './js/viscosity.js?v=v315',
  './js/boss.js?v=v315',
  './js/editor.js?v=v315',
  './js/controls_customizer.js?v=v315',
  './js/cloud_save.js?v=v315',
  './js/generator.js?v=v315',
  './js/shop.js?v=v315',
  './privacy.html?v=v315',
  './terms.html?v=v315',
  './assets/dragon_head.png',
  './assets/flamethrower.png',
  './assets/avatars/slime_king.png?v=v315',
  './assets/avatars/mecha_drone.png?v=v315',
  './assets/avatars/fire_elemental.png?v=v315',
  './assets/avatars/ancient_totem.png?v=v315',
  './assets/avatars/crystal_shard.png?v=v315',
  './assets/avatars/ghost_orb.png?v=v315',
  './assets/avatars/tentacle_blob.png?v=v315',
  './assets/avatars/shadow_artifact.png?v=v315'
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


