/** Adapter: sprite sheet loading + draw. */

import { SPRITE_META } from '../config/spriteMeta.js';

export const SPRITE_MANIFEST = {
  ...SPRITE_META,


  'bg/sky':        { src: 'assets/sprites/bg/sky.png' },
  'bg/castle':     { src: 'assets/sprites/bg/castle.png' },
  'bg/hills':      { src: 'assets/sprites/bg/hills.png' },

  'tile/ground':   { src: 'assets/sprites/tiles/ground.png' },
  'tile/platform': { src: 'assets/sprites/tiles/platform.png' },
  'tile/ladder':   { src: 'assets/sprites/tiles/ladder.png' },

  'prop/coin':     { src: 'assets/sprites/props/coin.png' },
  'prop/flag':     { src: 'assets/sprites/props/flag.png' },
  'prop/torch':    { src: 'assets/sprites/props/torch.png' },
  'prop/crate':    { src: 'assets/sprites/props/crate.png' },
  'prop/barrel':   { src: 'assets/sprites/props/barrel.png' },
  'prop/banner':   { src: 'assets/sprites/props/banner.png' },

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
  const scale = opts.scale != null ? opts.scale : 1.15;
  const flip = !!opts.flip;
  const camX = opts.camX != null ? opts.camX : (opts.cam || 0);
  const camY = opts.camY || 0;
  const pixel = !!opts.pixel;
  const sx = pixel ? Math.round(x - camX) : x - camX;
  const sy = pixel ? Math.round(y - camY) : y - camY;
  const dw = fw * scale;
  const dh = fh * scale;
  const col = ((frame % (meta.frames || 1)) + (meta.frames || 1)) % (meta.frames || 1);
  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (opts.composite) ctx.globalCompositeOperation = opts.composite;
  ctx.imageSmoothingEnabled = !pixel;
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

export function drawImageKey(ctx, key, dx, dy, dw, dh, smooth = false) {
  const entry = spriteCache[key];
  if (!entry || !entry.ready || !entry.img) return false;
  ctx.imageSmoothingEnabled = !!smooth;
  ctx.drawImage(entry.img, dx, dy, dw, dh);
  return true;
}
