const CACHE_NAME = 'viscora-cache-v351';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v351',
  './manifest.json',
  './js/main.js?v=v351',
  './js/game.js?v=v351',
  './js/audio.js?v=v351',
  './js/ui.js?v=v351',
  './js/level.js?v=v351',
  './js/player.js?v=v351',
  './js/enemies.js?v=v351',
  './js/viscosity.js?v=v351',
  './js/boss.js?v=v351',
  './js/editor.js?v=v351',
  './js/controls_customizer.js?v=v351',
  './js/cloud_save.js?v=v351',
  './js/generator.js?v=v351',
  './js/shop.js?v=v351',
  './privacy.html?v=v351',
  './terms.html?v=v351',
  './assets/dragon_head.png',
  './assets/flamethrower.png',
  './assets/avatars/slime_king.png?v=v351',
  './assets/avatars/mecha_drone.png?v=v351',
  './assets/avatars/fire_elemental.png?v=v351',
  './assets/avatars/ancient_totem.png?v=v351',
  './assets/avatars/crystal_shard.png?v=v351',
  './assets/avatars/ghost_orb.png?v=v351',
  './assets/avatars/tentacle_blob.png?v=v351',
  './assets/avatars/shadow_artifact.png?v=v351',
  './assets/badges/badge_first_steps.png?v=v351',
  './assets/badges/badge_boss_1.png?v=v351',
  './assets/badges/badge_star_collector.png?v=v351',
  './assets/badges/badge_form_shifter.png?v=v351',
  './assets/badges/badge_speedrun.png?v=v351',
  './assets/badges/badge_champion.png?v=v351',
  './assets/badges/badge_90_stars.png?v=v351',
  './assets/badges/badge_all_bosses.png?v=v351',
  './assets/badges/badge_patrol_killer.png?v=v351',
  './assets/badges/badge_gel_killer.png?v=v351',
  './assets/badges/badge_ufo_killer.png?v=v351',
  './assets/badges/badge_crystal_spender.png?v=v351'
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


