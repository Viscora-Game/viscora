const CACHE_NAME = 'viscora-v1.0.0.87';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v398',
  './manifest.json',
  './assets/audio/cybercore_sound_2_hollywood.wav',
  './js/main.js?v=v398',
  './js/game.js?v=v398',
  './js/audio.js?v=v398',
  './js/ui.js?v=v398',
  './js/level.js?v=v398',
  './js/player.js?v=v398',
  './js/enemies.js?v=v398',
  './js/viscosity.js?v=v398',
  './js/boss.js?v=v397',
  './js/editor.js?v=v397',
  './js/controls_customizer.js?v=v397',
  './js/admob_manager.js?v=v397',
  './js/cloud_save.js?v=v397',
  './js/generator.js?v=v397',
  './js/shop.js?v=v397'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
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
  
  // Ağ Öncelikli (Network-First) Strateji: Önce taze dosyayı çek, internet yoksa önbellekten sun
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
});
