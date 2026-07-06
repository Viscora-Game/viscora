const CACHE_NAME = 'viscora-cache-v348';
const ASSETS = [
  './',
  './index.html',
  './index.css?v=v348',
  './manifest.json',
  './js/main.js?v=v348',
  './js/game.js?v=v348',
  './js/audio.js?v=v348',
  './js/ui.js?v=v348',
  './js/level.js?v=v348',
  './js/player.js?v=v348',
  './js/enemies.js?v=v348',
  './js/viscosity.js?v=v348',
  './js/boss.js?v=v348',
  './js/editor.js?v=v348',
  './js/controls_customizer.js?v=v348',
  './js/cloud_save.js?v=v348',
  './js/generator.js?v=v348',
  './js/shop.js?v=v348',
  './privacy.html?v=v348',
  './terms.html?v=v348',
  './assets/dragon_head.png',
  './assets/flamethrower.png',
  './assets/avatars/slime_king.png?v=v348',
  './assets/avatars/mecha_drone.png?v=v348',
  './assets/avatars/fire_elemental.png?v=v348',
  './assets/avatars/ancient_totem.png?v=v348',
  './assets/avatars/crystal_shard.png?v=v348',
  './assets/avatars/ghost_orb.png?v=v348',
  './assets/avatars/tentacle_blob.png?v=v348',
  './assets/avatars/shadow_artifact.png?v=v348',
  './assets/badges/badge_first_steps.png?v=v348',
  './assets/badges/badge_boss_1.png?v=v348',
  './assets/badges/badge_star_collector.png?v=v348',
  './assets/badges/badge_form_shifter.png?v=v348',
  './assets/badges/badge_speedrun.png?v=v348',
  './assets/badges/badge_champion.png?v=v348',
  './assets/badges/badge_90_stars.png?v=v348',
  './assets/badges/badge_all_bosses.png?v=v348',
  './assets/badges/badge_patrol_killer.png?v=v348',
  './assets/badges/badge_gel_killer.png?v=v348',
  './assets/badges/badge_ufo_killer.png?v=v348',
  './assets/badges/badge_crystal_spender.png?v=v348'
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


