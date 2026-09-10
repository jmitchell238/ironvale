/** Adapter: sprite sheet loading + draw. */

export const SPRITE_MANIFEST = {
  'player/idle':   { src: 'assets/sprites/player/idle.png',   fw: 80, fh: 96, frames: 1, fps: 5 },
  'player/run':    { src: 'assets/sprites/player/run.png',    fw: 80, fh: 96, frames: 2, fps: 10 },
  'player/jump':   { src: 'assets/sprites/player/jump.png',   fw: 80, fh: 96, frames: 1, fps: 8 },
  'player/djump':  { src: 'assets/sprites/player/djump.png',  fw: 80, fh: 96, frames: 1, fps: 10 },
  'player/duck':   { src: 'assets/sprites/player/duck.png',   fw: 80, fh: 96, frames: 1, fps: 6 },
  'player/attack': { src: 'assets/sprites/player/attack.png', fw: 96, fh: 96, frames: 1, fps: 14 },
  'player/hurt':   { src: 'assets/sprites/player/hurt.png',   fw: 80, fh: 96, frames: 1, fps: 8 },
  'player/portrait': { src: 'assets/sprites/player/portrait.png' },
  'player/logo':     { src: 'assets/sprites/player/logo.png' },

  'enemy/goblin':    { src: 'assets/sprites/enemies/goblin.png',    fw: 64, fh: 72, frames: 1, fps: 6 },
  'enemy/bat':       { src: 'assets/sprites/enemies/bat.png',       fw: 64, fh: 48, frames: 1, fps: 8 },
  'enemy/skeleton':  { src: 'assets/sprites/enemies/skeleton.png',  fw: 64, fh: 72, frames: 1, fps: 5 },
  'enemy/warden':    { src: 'assets/sprites/enemies/warden.png',    fw: 96, fh: 112, frames: 1, fps: 4 },

  'bg/sky':        { src: 'assets/sprites/bg/sky.png' },
  'bg/forgegate':  { src: 'assets/sprites/bg/forgegate.png' },
  'bg/mountains':  { src: 'assets/sprites/bg/mountains.png' },
  'bg/castle':     { src: 'assets/sprites/bg/castle.png' },
  'bg/forest':     { src: 'assets/sprites/bg/forest.png' },
  'bg/bridge':     { src: 'assets/sprites/bg/bridge.png' },

  'tile/ground':   { src: 'assets/sprites/tiles/ground.png' },
  'tile/platform': { src: 'assets/sprites/tiles/platform.png' },
  'tile/ladder':   { src: 'assets/sprites/tiles/ladder.png' },

  'prop/coin':     { src: 'assets/sprites/props/coin.png' },
  'prop/flag':     { src: 'assets/sprites/props/flag.png' },
  'prop/gate':     { src: 'assets/sprites/props/gate.png' },
  'prop/torch':    { src: 'assets/sprites/props/torch.png' },
  'prop/crate':    { src: 'assets/sprites/props/crate.png' },
  'prop/barrel':   { src: 'assets/sprites/props/barrel.png' },
  'prop/banner':   { src: 'assets/sprites/props/banner.png' },
  'prop/sign':     { src: 'assets/sprites/props/sign.png' },
  'prop/chain':    { src: 'assets/sprites/props/chain.png' },

  'fx/slash':      { src: 'assets/sprites/fx/slash.png' },
  'fx/heart':      { src: 'assets/sprites/fx/heart.png' },
  'ui/logo':       { src: 'assets/sprites/ui/logo.png' },
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
  const scale = opts.scale != null ? opts.scale : 1.15;
  const flip = !!opts.flip;
  const camX = opts.camX != null ? opts.camX : (opts.cam || 0);
  const camY = opts.camY || 0;
  const sx = x - camX;
  const sy = y - camY;
  const dw = fw * scale;
  const dh = fh * scale;
  const col = frame % (meta.frames || 1);
  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  ctx.imageSmoothingEnabled = true;
  if (flip) {
    ctx.translate(sx, sy);
    ctx.scale(-1, 1);
    ctx.drawImage(entry.img, col * fw, 0, fw, fh, -dw / 2, -dh, dw, dh);
  } else {
    ctx.drawImage(entry.img, col * fw, 0, fw, fh, sx - dw / 2, sy - dh, dw, dh);
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
