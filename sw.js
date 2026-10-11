const CACHE = 'ironvale-2.3.001';

const ASSETS = [
  './', './index.html', './css/style.css',
  './js/app/main.js',
  './js/config/index.js',
  './js/config/spriteMeta.js',
  './js/core/math.js',
  './js/domain/combat.js',
  './js/domain/enemyAi.js',
  './js/domain/platforms.js',
  './js/domain/projectiles.js',
  './js/domain/tilemap.js',
  './js/domain/player.js',
  './js/domain/upgrades.js',
  './js/domain/rpg.js',
  './js/domain/levels.js',
  './js/world/GameSession.js',
  './js/world/systems/camera.js',
  './js/world/systems/combat.js',
  './js/world/systems/enemy.js',
  './js/world/systems/level.js',
  './js/world/systems/player.js',
  './js/world/systems/projectiles.js',
  './js/adapters/save.js',
  './js/adapters/audio.js',
  './js/adapters/sprites.js',
  './js/adapters/render.js',
  './js/adapters/renderStage.js',
  './js/adapters/input.js',
  './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  './apple-touch-icon.png', './art/cover.jpg',
  './assets/gv/castle/backdrop.png',
  './assets/gv/castle/tileset.png',
  './assets/gv/cliffs/clouds.png',
  './assets/gv/cliffs/far-grounds.png',
  './assets/gv/cliffs/sea.png',
  './assets/gv/cliffs/sky.png',
  './assets/gv/cliffs/tileset.png',
  './assets/gv/enemy/angel.png',
  './assets/gv/enemy/angel_smite.png',
  './assets/gv/enemy/beast.png',
  './assets/gv/enemy/beast_breath.png',
  './assets/gv/enemy/beast_burn.png',
  './assets/gv/enemy/beast_pillar.png',
  './assets/gv/enemy/fire_skull.png',
  './assets/gv/enemy/fire_skull_calm.png',
  './assets/gv/enemy/ghost.png',
  './assets/gv/enemy/ghoul.png',
  './assets/gv/enemy/hound.png',
  './assets/gv/enemy/hound_idle.png',
  './assets/gv/enemy/hound_jump.png',
  './assets/gv/enemy/hound_run.png',
  './assets/gv/enemy/nightmare.png',
  './assets/gv/enemy/nightmare_gallop.png',
  './assets/gv/enemy/skeleton.png',
  './assets/gv/enemy/skeleton_clothed.png',
  './assets/gv/enemy/skeleton_rise.png',
  './assets/gv/enemy/spider.png',
  './assets/gv/enemy/thing.png',
  './assets/gv/enemy/warden.png',
  './assets/gv/enemy/warden_slam.png',
  './assets/gv/enemy/warden_windup.png',
  './assets/gv/enemy/wizard.png',
  './assets/gv/enemy/wizard_cast.png',
  './assets/gv/enemy/wolf.png',
  './assets/gv/fx/death.png',
  './assets/gv/fx/fireball.png',
  './assets/gv/fx/lightbolt.png',
  './assets/gv/hero/attack.png',
  './assets/gv/hero/crouch.png',
  './assets/gv/hero/crouch_slash.png',
  './assets/gv/hero/hurt.png',
  './assets/gv/hero/idle.png',
  './assets/gv/hero/jump.png',
  './assets/gv/hero/jump_attack.png',
  './assets/gv/hero/portrait.png',
  './assets/gv/hero/run.png',
  './assets/gv/swamp/background.png',
  './assets/gv/swamp/mid-layer-01.png',
  './assets/gv/swamp/mid-layer-02.png',
  './assets/gv/swamp/tileset.png',
  './assets/gv/town/background.png',
  './assets/gv/town/church-backdrop.png',
  './assets/gv/town/middleground.png',
  './assets/gv/town/tileset.png',
  './assets/sprites/bg/castle.png',
  './assets/sprites/bg/hills.png',
  './assets/sprites/bg/sky.png',
  './assets/sprites/fx/heart.png',
  './assets/sprites/props/banner.png',
  './assets/sprites/props/barrel.png',
  './assets/sprites/props/coin.png',
  './assets/sprites/props/crate.png',
  './assets/sprites/props/flag.png',
  './assets/sprites/props/torch.png',
  './assets/sprites/tiles/ground.png',
  './assets/sprites/tiles/ladder.png',
  './assets/sprites/tiles/platform.png',
];

function precacheAll(cache) {
  return Promise.allSettled(ASSETS.map(url =>
    cache.add(url).catch(err => console.warn('[sw] precache failed', url, err))));
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(precacheAll).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) self.skipWaiting();
});

function sameOrigin(url) {
  try { return new URL(url).origin === self.location.origin; } catch { return false; }
}
function networkFirst(request) {
  return fetch(request, { cache: 'no-store' }).then(res => {
    if (res.ok && sameOrigin(request.url)) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(request, copy));
    }
    return res;
  }).catch(() => caches.match(request).then(hit => hit || Response.error()));
}
function cacheFirst(request) {
  return caches.match(request).then(hit => hit || fetch(request).then(res => {
    if (res.ok && sameOrigin(request.url)) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(request, copy));
    }
    return res;
  }));
}
function isShellOrCode(url) {
  const path = new URL(url).pathname;
  return path.endsWith('/sw.js') || path.endsWith('.html') || path.endsWith('/') ||
    path.includes('/css/') || path.includes('/js/') || path.endsWith('manifest.webmanifest');
}
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !sameOrigin(e.request.url)) return;
  if (e.request.mode === 'navigate' || isShellOrCode(e.request.url)) {
    e.respondWith(networkFirst(e.request));
    return;
  }
  e.respondWith(cacheFirst(e.request));
});
