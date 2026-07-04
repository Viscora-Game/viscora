const CACHE_NAME = 'viscora-cache-v346';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v346',
  './manifest.json',
  './js/main.js?v=v346',
  './js/game.js?v=v346',
  './js/audio.js?v=v346',
  './js/ui.js?v=v346',
  './js/level.js?v=v346',
  './js/player.js?v=v346',
  './js/enemies.js?v=v346',
  './js/viscosity.js?v=v346',
  './js/boss.js?v=v346',
  './js/editor.js?v=v346',
  './js/controls_customizer.js?v=v346',
  './js/cloud_save.js?v=v346',
  './js/generator.js?v=v346',
  './js/shop.js?v=v346',
  './privacy.html?v=v346',
  './terms.html?v=v346',
  './assets/dragon_head.png',
  './assets/flamethrower.png',
  './assets/avatars/slime_king.png?v=v346',
  './assets/avatars/mecha_drone.png?v=v346',
  './assets/avatars/fire_elemental.png?v=v346',
  './assets/avatars/ancient_totem.png?v=v346',
  './assets/avatars/crystal_shard.png?v=v346',
  './assets/avatars/ghost_orb.png?v=v346',
  './assets/avatars/tentacle_blob.png?v=v346',
  './assets/avatars/shadow_artifact.png?v=v346',
  './assets/badges/badge_first_steps.png?v=v346',
  './assets/badges/badge_boss_1.png?v=v346',
  './assets/badges/badge_star_collector.png?v=v346',
  './assets/badges/badge_form_shifter.png?v=v346',
  './assets/badges/badge_speedrun.png?v=v346',
  './assets/badges/badge_champion.png?v=v346',
  './assets/badges/badge_90_stars.png?v=v346',
  './assets/badges/badge_all_bosses.png?v=v346',
  './assets/badges/badge_patrol_killer.png?v=v346',
  './assets/badges/badge_gel_killer.png?v=v346',
  './assets/badges/badge_ufo_killer.png?v=v346',
  './assets/badges/badge_crystal_spender.png?v=v346'
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


