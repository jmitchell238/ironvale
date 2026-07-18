/** Adapter: sprite sheet loading + draw. */

export const SPRITE_MANIFEST = {
  'player/idle':   { src: 'assets/sprites/player/idle.png',   fw: 64, fh: 72, frames: 10, fps: 5 },
  'player/walk':   { src: 'assets/sprites/player/walk.png',   fw: 64, fh: 72, frames: 10, fps: 6 },
  'player/run':    { src: 'assets/sprites/player/run.png',    fw: 64, fh: 72, frames: 10, fps: 7 },
  'player/jump':   { src: 'assets/sprites/player/jump.png',   fw: 64, fh: 72, frames: 10, fps: 6 },
  'player/attack':      { src: 'assets/sprites/player/attack.png',      fw: 64, fh: 72, frames: 10, fps: 14 },
  'player/jump_attack': { src: 'assets/sprites/player/jump_attack.png', fw: 64, fh: 72, frames: 10, fps: 14 },
  'player/dead':        { src: 'assets/sprites/player/dead.png',        fw: 64, fh: 72, frames: 10, fps: 6 },

  'enemy/slime':    { src: 'assets/sprites/enemies/slime.png',    fw: 32, fh: 32, frames: 4, fps: 5 },
  'enemy/bandit':   { src: 'assets/sprites/enemies/bandit.png',   fw: 40, fh: 48, frames: 4, fps: 5 },
  'enemy/skeleton': { src: 'assets/sprites/enemies/skeleton.png', fw: 40, fh: 48, frames: 4, fps: 5 },
  'enemy/ogre':     { src: 'assets/sprites/enemies/ogre.png',     fw: 56, fh: 56, frames: 4, fps: 4 },

  'bg/hills':      { src: 'assets/sprites/bg/hills.png' },
  'tile/ground':   { src: 'assets/sprites/tiles/ground.png' },
  'tile/platform': { src: 'assets/sprites/tiles/platform.png' },
  'fx/coin':       { src: 'assets/sprites/fx/coin.png' },
  'fx/slash':      { src: 'assets/sprites/fx/slash.png' },
  'fx/heart':      { src: 'assets/sprites/fx/heart.png' },
};

const spriteCache = Object.create(null);
let spritesLoadPromise = null;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed ' + src));
    img.src = src;
  });
}

export function loadAllSprites() {
  if (spritesLoadPromise) return spritesLoadPromise;
  spritesLoadPromise = Promise.all(Object.entries(SPRITE_MANIFEST).map(async ([key, meta]) => {
    try {
      const img = await loadImage(meta.src);
      spriteCache[key] = { img, meta, ready: true };
    } catch (e) {
      console.warn('[sprites]', e.message);
      spriteCache[key] = { img: null, meta, ready: false };
    }
  })).then(() => Object.values(spriteCache).some(s => s.ready));
  return spritesLoadPromise;
}

export function getSprite(key) {
  return spriteCache[key] || null;
}

export function animFrame(meta, time, speedMul) {
  const fps = (meta.fps || 6) * (speedMul || 1);
  const n = meta.frames || 1;
  return Math.floor(time * fps) % n;
}

export function drawSprite(ctx, key, frame, x, y, opts = {}) {
  const entry = spriteCache[key];
  if (!entry || !entry.ready || !entry.img) return false;
  const meta = entry.meta;
  const fw = meta.fw || entry.img.width;
  const fh = meta.fh || entry.img.height;
  const scale = opts.scale != null ? opts.scale : 1.35;
  const flip = !!opts.flip;
  const cam = opts.cam || 0;
  const sx = x - cam;
  const dw = fw * scale;
  const dh = fh * scale;
  const col = frame % (meta.frames || 1);
  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  ctx.imageSmoothingEnabled = false;
  if (flip) {
    ctx.translate(sx, y);
    ctx.scale(-1, 1);
    ctx.drawImage(entry.img, col * fw, 0, fw, fh, -dw / 2, -dh, dw, dh);
  } else {
    ctx.drawImage(entry.img, col * fw, 0, fw, fh, sx - dw / 2, y - dh, dw, dh);
  }
  ctx.restore();
  return true;
}

export function drawImageKey(ctx, key, dx, dy, dw, dh) {
  const entry = spriteCache[key];
  if (!entry || !entry.ready || !entry.img) return false;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(entry.img, dx, dy, dw, dh);
  return true;
}
