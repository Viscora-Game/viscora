const CACHE_NAME = 'viscora-cache-v289';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v289',
  './manifest.json',
  './js/main.js?v=v289',
  './js/game.js?v=v289',
  './js/audio.js?v=v289',
  './js/ui.js?v=v289',
  './js/level.js?v=v289',
  './js/player.js?v=v289',
  './js/enemies.js?v=v289',
  './js/viscosity.js?v=v289',
  './js/boss.js?v=v289',
  './js/editor.js?v=v289',
  './js/controls_customizer.js?v=v289',
  './js/cloud_save.js?v=v289',
  './js/generator.js?v=v289',
  './js/shop.js?v=v289',
  './assets/dragon_head.png',
  './assets/flamethrower.png',
  './assets/avatars/slime_king.png?v=v289',
  './assets/avatars/mecha_drone.png?v=v289',
  './assets/avatars/fire_elemental.png?v=v289',
  './assets/avatars/ancient_totem.png?v=v289',
  './assets/avatars/crystal_shard.png?v=v289',
  './assets/avatars/ghost_orb.png?v=v289',
  './assets/avatars/tentacle_blob.png?v=v289',
  './assets/avatars/shadow_artifact.png?v=v289'
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


