const CACHE_NAME = 'viscora-cache-v164';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v164',
  './manifest.json',
  './js/main.js?v=v164',
  './js/game.js?v=v164',
  './js/audio.js?v=v164',
  './js/ui.js?v=v164',
  './js/level.js?v=v164',
  './js/player.js?v=v164',
  './js/enemies.js?v=v164',
  './js/viscosity.js?v=v164',
  './js/boss.js?v=v164',
  './js/editor.js?v=v164',
  './js/controls_customizer.js?v=v164',
  './assets/dragon_head.png'
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


