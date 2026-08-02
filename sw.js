const CACHE_NAME = 'viscora-v1.0.0.90';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v401',
  './manifest.json',
  './assets/audio/cybercore_sound_2_hollywood.wav',
  './js/main.js?v=v401',
  './js/game.js?v=v401',
  './js/audio.js?v=v401',
  './js/ui.js?v=v401',
  './js/level.js?v=v401',
  './js/player.js?v=v401',
  './js/enemies.js?v=v401',
  './js/viscosity.js?v=v401',
  './js/boss.js?v=v401',
  './js/editor.js?v=v401',
  './js/controls_customizer.js?v=v401',
  './js/admob_manager.js?v=v401',
  './js/cloud_save.js?v=v401',
  './js/generator.js?v=v401',
  './js/shop.js?v=v401'
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
