const CACHE_NAME = 'viscora-cache-v63';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v63',
  './manifest.json',
  './js/main.js?v=v63',
  './js/game.js?v=v63',
  './js/audio.js?v=v63',
  './js/ui.js?v=v63',
  './js/level.js?v=v63',
  './js/player.js?v=v63',
  './js/enemies.js?v=v63',
  './js/viscosity.js?v=v63',
  './js/boss.js?v=v63',
  './js/editor.js?v=v63',
  './js/controls_customizer.js?v=v63',
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
