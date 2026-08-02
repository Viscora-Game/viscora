const CACHE_NAME = 'viscora-v1.0.0.85';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v396',
  './manifest.json',
  './assets/audio/cybercore_sound_2_hollywood.wav',
  './js/main.js?v=v396',
  './js/game.js?v=v396',
  './js/audio.js?v=v396',
  './js/ui.js?v=v396',
  './js/level.js?v=v396',
  './js/player.js?v=v396',
  './js/enemies.js?v=v396',
  './js/viscosity.js?v=v396',
  './js/boss.js?v=v395',
  './js/editor.js?v=v395',
  './js/controls_customizer.js?v=v395',
  './js/admob_manager.js?v=v395',
  './js/cloud_save.js?v=v395',
  './js/generator.js?v=v395',
  './js/shop.js?v=v395'
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
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) {
    return;
  }
  
  // HTML gezinme veya index.html istekleri için AĞ ÖNCELİKLİ (Network-First) strateji
  const isHtmlRequest = e.request.mode === 'navigate' || e.request.url.endsWith('index.html') || e.request.url.endsWith('/');
  
  if (isHtmlRequest) {
    e.respondWith(
      fetch(e.request).then((networkResponse) => {
        if (networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(e.request);
      })
    );
    return;
  }

  // Statik varlıklar (JS/CSS/Resim) için Stale-While-Revalidate
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
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
