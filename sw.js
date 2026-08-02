const CACHE_NAME = 'viscora-v1.0.0.91';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v402',
  './manifest.json',
  './assets/audio/cybercore_sound_2_hollywood.wav',
  './js/main.js?v=v402',
  './js/game.js?v=v402',
  './js/audio.js?v=v402',
  './js/ui.js?v=v402',
  './js/level.js?v=v402',
  './js/player.js?v=v402',
  './js/enemies.js?v=v402',
  './js/viscosity.js?v=v402',
  './js/boss.js?v=v402',
  './js/editor.js?v=v402',
  './js/controls_customizer.js?v=v402',
  './js/admob_manager.js?v=v402',
  './js/cloud_save.js?v=v402',
  './js/generator.js?v=v402',
  './js/shop.js?v=v402'
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
