/**
 * Adapter: pixel-art stage drawing (tile maps, Magic Cliffs parallax,
 * ladders, gate, pickups, effects). Presentation only.
 */

import { W, H } from '../config/index.js';
import { clamp } from '../core/math.js';
import { getSprite, drawSprite, drawImageKey } from './sprites.js';

const SRC = 16;
const SCALE = 2;
const T = SRC * SCALE;

function hash(c, r) {
  let h = (c * 374761393 + r * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

function cell(tiles, c, r) {
  if (c < 0 || c >= tiles.cols || r < 0) return '.';
  if (r >= tiles.rows) return tiles.cells[tiles.rows - 1][c];
  return tiles.cells[r][c];
}

const solid = (tiles, c, r) => cell(tiles, c, r) === '#';

const TOPS = [[4, 12], [5, 12], [7, 12], [4, 12]];
const UNDER_TOP = [[4, 13], [5, 13], [6, 13], [7, 13]];
const DEEP = [[7, 16], [7, 17], [6, 16], [6, 17], [5, 16], [5, 17]];
const VINES = [[5, 14], [6, 14], [5, 15], [6, 15]];

/**
 * Source tiles for one cell: a list of [srcCol, srcRow, dxTiles, dyTiles].
 * dx/dy let edge cells spill rock and grass into the neighbouring empty cell.
 */
export function tileArt(tiles, c, r) {
  const ch = cell(tiles, c, r);
  const out = [];
  if (ch === '#') {
    const up = solid(tiles, c, r - 1);
    const left = solid(tiles, c - 1, r);
    const right = solid(tiles, c + 1, r);
    const h = hash(c, r);
    if (!up) {
      if (!left) out.push([3, 12, 0, 0], [2, 12, -1, 0]);
      else if (!right) out.push([3, 12, 0, 0, 1], [2, 12, 1, 0, 1]);
      else out.push([...TOPS[h % TOPS.length], 0, 0]);
      return out;
    }
    let depth = 1;
    while (depth < 4 && solid(tiles, c, r - depth - 1)) depth++;
    if (!left) {
      out.push([3, 13 + (r % 5), 0, 0], [2, 13 + (r % 5), -1, 0]);
    } else if (!right) {
      out.push([3, 13 + (r % 5), 0, 0, 1], [2, 13 + (r % 5), 1, 0, 1]);
    } else if (depth === 1) {
      out.push([...UNDER_TOP[h % UNDER_TOP.length], 0, 0]);
    } else if (depth === 2 && h % 5 === 0) {
      out.push([...VINES[(h >>> 3) % VINES.length], 0, 0]);
    } else {
      out.push([...DEEP[h % DEEP.length], 0, 0]);
    }
    return out;
  }
  if (ch === '=') {
    const l = cell(tiles, c - 1, r) === '=';
    const rt = cell(tiles, c + 1, r) === '=';
    if (!l && !rt) out.push([30, 12, 0, 0]);
    else if (!l) out.push([24, 12, 0, 0]);
    else if (!rt) out.push([30, 12, 0, 0]);
    else out.push([c % 2 ? 25 : 24, 12, 0, 0]);
    return out;
  }
  if (ch === 'b') {
    out.push([40 + (c % 2), 12, 0, 0], [40 + (c % 2), 13, 0, 1]);
  }
  return out;
}

function tilesetImg() {
  const e = getSprite('cliffs/tileset');
  return e && e.ready ? e.img : null;
}

function drawStamp(ctx, img, st, cam) {
  const [sc, sr, sw, sh] = st.src;
  const x = Math.round(st.x - cam.x);
  const y = Math.round(st.y - cam.y);
  if (x > W || x + sw * T < 0 || y > H || y + sh * T < 0) return;
  ctx.drawImage(img, sc * SRC, sr * SRC, sw * SRC, sh * SRC, x, y, sw * T, sh * T);
}

/** Stamps for one layer ('back' behind tiles, 'mid' with tiles, 'front' over actors). */
export function drawStamps(ctx, tiles, cam, layer) {
  const img = tilesetImg();
  if (!img || !tiles?.stamps) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const st of tiles.stamps) {
    if ((st.layer || 'back') === layer) drawStamp(ctx, img, st, cam);
  }
  ctx.restore();
}

export function drawTiles(ctx, tiles, cam) {
  const img = tilesetImg();
  if (!tiles) return;
  const c0 = Math.max(0, Math.floor(cam.x / T) - 1);
  const c1 = Math.min(tiles.cols - 1, Math.ceil((cam.x + W) / T) + 1);
  const r0 = Math.max(0, Math.floor(cam.y / T) - 1);
  const r1 = Math.min(tiles.rows - 1, Math.ceil((cam.y + H) / T) + 1);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const parts = tileArt(tiles, c, r);
      for (const [sc, sr, dx, dy, flip] of parts) {
        const x = Math.round((c + dx) * T - cam.x);
        const y = Math.round((r + dy) * T - cam.y);
        if (img && flip) {
          ctx.save();
          ctx.translate(x + T, y);
          ctx.scale(-1, 1);
          ctx.drawImage(img, sc * SRC, sr * SRC, SRC, SRC, 0, 0, T, T);
          ctx.restore();
        } else if (img) ctx.drawImage(img, sc * SRC, sr * SRC, SRC, SRC, x, y, T, T);
        else {
          ctx.fillStyle = sr === 12 ? '#9ab030' : '#2a3a3a';
          ctx.fillRect(x, y, T, T);
        }
      }
    }
  }
  // Ground below the last row continues off-screen
  const bottomY = Math.round(tiles.rows * T - cam.y);
  if (bottomY < H) {
    for (let c = c0; c <= c1; c++) {
      if (!solid(tiles, c, tiles.rows - 1)) continue;
      ctx.fillStyle = '#132221';
      ctx.fillRect(Math.round(c * T - cam.x), bottomY, T, H - bottomY);
    }
  }
  ctx.restore();
}

function tileLayer(ctx, key, cam, fx, fy, y0) {
  const e = getSprite(key);
  if (!e || !e.ready) return null;
  const w = e.img.width * SCALE;
  const h = e.img.height * SCALE;
  const off = ((cam.x * fx) % w + w) % w;
  const y = Math.round(y0 - cam.y * fy);
  for (let x = -Math.round(off); x < W; x += w) ctx.drawImage(e.img, x, y, w, h);
  return { y, h };
}

/** Magic Cliffs sky, clouds, distant islands and sea. */
export function drawCliffsBackground(ctx, cam) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#5bc0d8';
  ctx.fillRect(0, 0, W, H);
  tileLayer(ctx, 'cliffs/sky', cam, 0, 0.02, 0);
  tileLayer(ctx, 'cliffs/clouds', cam, 0.06, 0.04, 30);
  const far = tileLayer(ctx, 'cliffs/far-grounds', cam, 0.18, 0.12, 250);
  const seaTop = far ? far.y + far.h - 6 : 420;
  const sea = tileLayer(ctx, 'cliffs/sea', cam, 0.18, 0, seaTop);
  const seaBottom = sea ? sea.y + sea.h : seaTop;
  if (seaBottom < H) {
    ctx.fillStyle = '#1b6d8f';
    ctx.fillRect(0, seaBottom, W, H - seaBottom);
  }
  ctx.restore();
}

export function drawLaddersPixel(ctx, ladders, cam) {
  if (!ladders?.length) return;
  const e = getSprite('tile/ladder');
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const l of ladders) {
    const x = Math.round(l.x - cam.x);
    const y = Math.round(l.y - cam.y);
    if (x < -40 || x > W + 40) continue;
    if (e && e.ready) {
      for (let yy = 0; yy < l.h; yy += 64) {
        const hh = Math.min(64, l.h - yy);
        ctx.drawImage(e.img, 0, 0, 32, hh, x - 16, y + yy, 32, hh);
      }
    } else {
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(x - 12, y, 4, l.h);
      ctx.fillRect(x + 8, y, 4, l.h);
      for (let yy = 6; yy < l.h; yy += 16) ctx.fillRect(x - 12, y + yy, 24, 4);
    }
  }
  ctx.restore();
}

/** Stone arch with an iron portcullis; bars lift when the gate opens. */
export function drawPixelGate(ctx, gate, cam, openAmt) {
  if (!gate) return;
  const x = Math.round(gate.x - cam.x);
  const by = Math.round(gate.y + gate.h - cam.y);
  const w = gate.w || 64;
  const h = gate.h || 128;
  if (x < -120 || x > W + 120) return;
  const top = by - h;
  ctx.save();
  // Opening
  ctx.fillStyle = '#10161a';
  ctx.fillRect(x + 8, top + 12, w - 16, h - 12);
  // Bars
  const lift = Math.round((h - 16) * clamp(openAmt, 0, 1));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 8, top + 12, w - 16, h - 12);
  ctx.clip();
  ctx.fillStyle = '#5a6068';
  for (let bx = x + 12; bx < x + w - 10; bx += 10) ctx.fillRect(bx, top + 12 - lift, 4, h);
  ctx.fillStyle = '#7d858e';
  for (let yy = top + 30 - lift; yy < by; yy += 28) ctx.fillRect(x + 8, yy, w - 16, 4);
  ctx.fillStyle = '#9aa2aa';
  for (let bx = x + 12; bx < x + w - 10; bx += 10) ctx.fillRect(bx, by - 8 - lift, 4, 8);
  ctx.restore();
  // Pillars + lintel
  const stone = (sx, sy, sw, sh) => {
    ctx.fillStyle = '#6e6a5c';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = '#8f8a74';
    for (let yy = sy; yy < sy + sh; yy += 16) ctx.fillRect(sx, yy, sw, 4);
    ctx.fillStyle = '#4a473d';
    ctx.fillRect(sx + sw - 4, sy, 4, sh);
  };
  stone(x - 8, top, 16, h);
  stone(x + w - 8, top, 16, h);
  stone(x - 12, top - 12, w + 24, 16);
  ctx.fillStyle = openAmt > 0.5 ? '#7dffa0' : '#d4a43a';
  ctx.fillRect(x + w / 2 - 4, top - 8, 8, 8);
  ctx.restore();
}

export function drawFlags(ctx, checkpoints, cam, reached, activeId, t) {
  if (!checkpoints?.length) return;
  for (const cp of checkpoints) {
    const x = Math.round(cp.x - cam.x);
    const y = Math.round(cp.y - cam.y);
    if (x < -40 || x > W + 40) continue;
    const on = reached?.has(cp.id) || cp.id === activeId;
    ctx.save();
    if (on) {
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 4);
      ctx.fillStyle = '#ffe28a';
      ctx.beginPath();
      ctx.ellipse(x, y - 30, 26, 36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (!drawImageKey(ctx, 'prop/flag', x - 20, y - 64, 40, 64, true)) {
      ctx.fillStyle = '#6a4a28';
      ctx.fillRect(x - 2, y - 56, 4, 56);
      ctx.fillStyle = on ? '#5ab060' : '#3a5a9a';
      ctx.fillRect(x + 2, y - 54, 20, 14);
    }
    ctx.restore();
  }
}

export function drawPickups(ctx, pickups, cam, t) {
  if (!pickups?.length) return;
  for (const pk of pickups) {
    if (pk.taken) continue;
    const x = Math.round(pk.x - cam.x);
    const y = Math.round(pk.y - cam.y + Math.sin(t * 3 + pk.x) * 3);
    if (x < -30 || x > W + 30) continue;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ff9a9a';
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (!drawImageKey(ctx, 'fx/heart', x - 12, y - 12, 24, 24)) {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(x - 8, y - 8, 16, 16);
    }
    ctx.restore();
  }
}

export function drawEffects(ctx, effects, cam) {
  if (!effects?.length) return;
  for (const fx of effects) {
    if (fx.key === 'fx/spark') {
      const k = clamp(fx.t / 0.14, 0, 1);
      if (k >= 1) continue;
      const x = Math.round(fx.x - cam.x);
      const y = Math.round(fx.y - cam.y);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#fffbe8';
      const r = 6 + k * 22;
      ctx.fillRect(x - r, y - 2, r * 2, 4);
      ctx.fillRect(x - 2, y - r * 0.6, 4, r * 1.2);
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.restore();
      continue;
    }
    const e = getSprite(fx.key);
    if (!e || !e.ready) continue;
    const frame = Math.floor(fx.t * (e.meta.fps || 12));
    if (frame >= (e.meta.frames || 1)) continue;
    drawSprite(ctx, fx.key, frame, fx.x, fx.y, {
      scale: SCALE, camX: cam.x, camY: cam.y, pixel: true,
    });
  }
}

export function drawPopups(ctx, popups, cam) {
  if (!popups?.length) return;
  ctx.save();
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(20, 12, 8, 0.85)';
  for (const q of popups) {
    const x = Math.round(q.x - cam.x);
    const y = Math.round(q.y - cam.y);
    ctx.globalAlpha = clamp(q.life / (q.max * 0.5), 0, 1);
    ctx.strokeText(q.text, x, y);
    ctx.fillStyle = q.color;
    ctx.fillText(q.text, x, y);
  }
  ctx.restore();
}
