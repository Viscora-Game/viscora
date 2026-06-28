const CACHE_NAME = 'viscora-cache-v251';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v251',
  './manifest.json',
  './js/main.js?v=v251',
  './js/game.js?v=v251',
  './js/audio.js?v=v251',
  './js/ui.js?v=v251',
  './js/level.js?v=v251',
  './js/player.js?v=v251',
  './js/enemies.js?v=v251',
  './js/viscosity.js?v=v251',
  './js/boss.js?v=v251',
  './js/editor.js?v=v251',
  './js/controls_customizer.js?v=v251',
  './js/cloud_save.js?v=v251',
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


