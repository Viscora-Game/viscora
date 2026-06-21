const CACHE_NAME = 'viscora-cache-v134';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v134',
  './manifest.json',
  './js/main.js?v=v134',
  './js/game.js?v=v134',
  './js/audio.js?v=v134',
  './js/ui.js?v=v134',
  './js/level.js?v=v134',
  './js/player.js?v=v134',
  './js/enemies.js?v=v134',
  './js/viscosity.js?v=v134',
  './js/boss.js?v=v134',
  './js/editor.js?v=v134',
  './js/controls_customizer.js?v=v134',
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
