/**
 * Adapter: draw a GameSession snapshot to canvas.
 * Presentation only — never mutates session state.
 */

import {
  W, H, PLAY, GROUND_Y, PLAYER_DRAW, PLAYER_SWORD, PLAYER_BODY, HEART, CONTROLS, PORTRAIT,
  getEnemyMeleeCfg,
} from '../config/index.js';
import { clamp } from '../core/math.js';
import { getAttackBox, combatAttackDuration } from '../domain/combat.js';
import { getSprite, animFrame, drawSprite, drawImageKey } from './sprites.js';
import { getLevelById } from '../domain/levels.js';
import {
  drawCliffsBackground, drawTiles, drawStamps, drawLaddersPixel, drawPixelGate,
  drawFlags, drawPickups, drawEffects, drawPopups,
} from './renderStage.js';

function camOf(cam) {
  if (cam && typeof cam === 'object') return { x: cam.x || 0, y: cam.y || 0 };
  return { x: Number(cam) || 0, y: 0 };
}
function wx(x, cam) { return x - camOf(cam).x; }
function wy(y, cam) { return y - camOf(cam).y; }
function spriteCam(cam) {
  const c = camOf(cam);
  return { cam: c.x, camX: c.x, camY: c.y };
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawParallaxLayer(ctx, key, cam, factorX, factorY, yBase, height) {
  const entry = getSprite(key);
  if (!entry || !entry.ready) return false;
  const img = entry.img;
  const ch = height || Math.min(img.height, H * 0.7);
  const scale = ch / img.height;
  const cw = img.width * scale;
  const c = camOf(cam);
  const scroll = (c.x * factorX) % cw;
  const y = yBase - c.y * factorY;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  for (let x = -scroll - cw; x < W + cw; x += cw) {
    ctx.drawImage(img, x, y, cw, ch);
  }
  ctx.restore();
  return true;
}

export function drawBackground(ctx, cam) {
  const c = camOf(cam);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#8ec8f0');
  g.addColorStop(0.45, '#c5e4f6');
  g.addColorStop(0.72, '#9ec47a');
  g.addColorStop(1, '#6a8a50');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (!drawParallaxLayer(ctx, 'bg/sky', cam, 0.04, 0.02, -20, H * 0.55)) {
    ctx.save();
    const cloudScroll = (c.x * 0.04) % 280;
    for (let i = -1; i < 6; i++) {
      const cx = i * 280 - cloudScroll + 60;
      const cy = 70 + (i % 3) * 22 - c.y * 0.02;
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#eef6ff';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 64, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 36, cy + 4, 40, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.save();
  const mScroll = (c.x * 0.1) % 220;
  ctx.fillStyle = 'rgba(110, 140, 150, 0.55)';
  ctx.beginPath();
  ctx.moveTo(-40, H);
  for (let x = -mScroll; x < W + 80; x += 80) {
    ctx.lineTo(x, H * 0.38 - Math.sin((x + c.x) * 0.008) * 50 - c.y * 0.04);
  }
  ctx.lineTo(W + 40, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  drawParallaxLayer(ctx, 'bg/castle', cam, 0.16, 0.05, H * 0.22, H * 0.5);

  ctx.save();
  const tScroll = (c.x * 0.28) % 110;
  for (let x = -tScroll; x < W + 50; x += 110) {
    const base = H * 0.82 - c.y * 0.08;
    const hgt = 48 + ((Math.floor(x + c.x) * 17) % 36);
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#2a4a30';
    ctx.fillRect(x + 22, base - hgt * 0.35, 7, hgt * 0.4);
    ctx.beginPath();
    ctx.moveTo(x + 4, base - hgt * 0.28);
    ctx.lineTo(x + 26, base - hgt);
    ctx.lineTo(x + 48, base - hgt * 0.28);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw a single platform with depth: top grass/stone, dirt body, shadow, edge lip.
 */
function drawPlatformBlock(ctx, pl, x) {
  const y = pl.y;
  const w = pl.w;
  const bodyH = pl.ground ? Math.max(pl.h, 32) : Math.max(pl.h + 6, 18);
  const style = pl.style || (pl.ground ? 'ground' : 'float');
  const isStone = style === 'stone';
  const isGround = pl.ground || style === 'ground';

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + 6, w * 0.48, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dirt / stone body
  if (isGround) {
    const body = ctx.createLinearGradient(0, y, 0, y + bodyH + 18);
    body.addColorStop(0, '#6b5238');
    body.addColorStop(0.35, '#5a422c');
    body.addColorStop(1, '#3e2e1e');
    ctx.fillStyle = body;
    ctx.fillRect(x, y, w, bodyH + (isGround ? 20 : 0));
    // Soil clumps
    ctx.fillStyle = 'rgba(40, 28, 16, 0.35)';
    for (let i = 8; i < w; i += 22) {
      ctx.fillRect(x + i, y + 10 + (i % 3) * 3, 8, 5);
    }
  } else if (isStone) {
    ctx.fillStyle = '#6a6460';
    ctx.fillRect(x, y, w, bodyH);
    ctx.fillStyle = '#7a7470';
    ctx.fillRect(x + 2, y + 2, w - 4, bodyH * 0.4);
    ctx.strokeStyle = 'rgba(30,28,26,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, bodyH - 1);
  } else {
    // Floating wood/dirt pad
    const body = ctx.createLinearGradient(0, y, 0, y + bodyH);
    body.addColorStop(0, '#7a5e3a');
    body.addColorStop(1, '#4a3620');
    ctx.fillStyle = body;
    ctx.fillRect(x, y, w, bodyH);
    // Underside lip
    ctx.fillStyle = 'rgba(30, 20, 12, 0.55)';
    ctx.fillRect(x + 2, y + bodyH - 3, w - 4, 3);
  }

  // Bright walkable top surface (high contrast — key readability fix)
  const topH = isGround ? 7 : 6;
  if (isStone) {
    ctx.fillStyle = '#9a948c';
    ctx.fillRect(x, y - 1, w, topH);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 1, y - 1, w - 2, 2);
  } else {
    // Grass top
    const grass = ctx.createLinearGradient(0, y - 2, 0, y + topH);
    grass.addColorStop(0, '#7ec850');
    grass.addColorStop(0.55, '#5aaa38');
    grass.addColorStop(1, '#4a8a28');
    ctx.fillStyle = grass;
    ctx.fillRect(x - 1, y - 2, w + 2, topH + 1);
    // Blade nubs
    ctx.fillStyle = '#8ed858';
    for (let i = 3; i < w; i += 10) {
      ctx.fillRect(x + i, y - 4, 3, 3);
    }
    // Gold rim so feet land line is obvious
    ctx.fillStyle = 'rgba(220, 190, 80, 0.65)';
    ctx.fillRect(x, y - 2, w, 1.5);
  }

  // Left/right edge bevels
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x, y - 1, 3, bodyH);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + w - 3, y - 1, 3, bodyH);
}

export function drawPlatforms(ctx, platforms, cam) {
  const list = platforms.slice().sort((a, b) => a.y - b.y);
  for (const pl of list) {
    const x = wx(pl.x, cam);
    const y = wy(pl.y, cam);
    if (x + pl.w < -40 || x > W + 40) continue;
    if (y < -90 || y > H + 90) continue;
    if (pl.style === 'hidden' || pl.style === 'lip') continue;

    drawPlatformBlock(ctx, { ...pl, y }, x);

    const key = pl.style === 'bridge' ? 'tile/platform' : (pl.ground ? 'tile/ground' : 'tile/platform');
    const tile = getSprite(key);
    if (tile && tile.ready && pl.w > 80) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.imageSmoothingEnabled = true;
      const tw = 48;
      const th = pl.ground ? 32 : 18;
      for (let px = 0; px < pl.w; px += tw) {
        const ww = Math.min(tw, pl.w - px);
        ctx.drawImage(tile.img, x + px, y, ww, th);
      }
      ctx.restore();
    }
  }
}

export function drawLadders(ctx, ladders, cam) {
  if (!ladders?.length) return;
  for (const l of ladders) {
    const x = wx(l.x, cam);
    const y = wy(l.y, cam);
    if (x < -40 || x > W + 40) continue;
    const tile = getSprite('tile/ladder');
    ctx.save();
    if (tile && tile.ready) {
      ctx.imageSmoothingEnabled = true;
      const tw = 28;
      const th = 24;
      for (let yy = 0; yy < l.h; yy += th) {
        const hh = Math.min(th, l.h - yy);
        ctx.drawImage(tile.img, x - tw / 2, y + yy, tw, hh);
      }
    } else {
      ctx.fillStyle = '#8a6238';
      ctx.fillRect(x - 10, y, 4, l.h);
      ctx.fillRect(x + 6, y, 4, l.h);
      ctx.fillStyle = '#c4a06a';
      for (let yy = 6; yy < l.h; yy += 16) ctx.fillRect(x - 10, y + yy, 20, 4);
    }
    ctx.restore();
  }
}

export function drawProps(ctx, props, cam) {
  if (!props?.length) return;
  for (const pr of props) {
    const key = 'prop/' + pr.type;
    const x = wx(pr.x, cam);
    const y = wy(pr.y, cam);
    if (x < -60 || x > W + 60) continue;
    if (!drawImageKey(ctx, key, x - 16, y - 36, 32, 36)) {
      if (pr.type === 'torch') {
        ctx.fillStyle = '#6a4420';
        ctx.fillRect(x - 2, y - 28, 4, 28);
        ctx.fillStyle = '#ffb347';
        ctx.beginPath(); ctx.arc(x, y - 30, 5, 0, Math.PI * 2); ctx.fill();
      } else if (pr.type === 'banner') {
        ctx.fillStyle = '#3a5a9a';
        ctx.fillRect(x - 10, y, 20, 36);
        ctx.fillStyle = '#c9a227';
        ctx.fillRect(x - 6, y + 8, 12, 10);
      } else if (pr.type === 'sign') {
        ctx.fillStyle = '#7a5a30';
        ctx.fillRect(x - 2, y - 28, 4, 28);
        ctx.fillRect(x - 18, y - 40, 40, 16);
      } else if (pr.type === 'crate' || pr.type === 'barrel') {
        ctx.fillStyle = pr.type === 'crate' ? '#8a6238' : '#6a4a28';
        ctx.fillRect(x - 12, y - 22, 24, 22);
      } else if (pr.type === 'chain') {
        ctx.strokeStyle = '#6a6a70';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x, y); ctx.stroke();
      }
    }
  }
}

/** Pick the hero animation and frame for this moment. */
export function playerPose(p, t, atkFull) {
  const prog = atkFull > 0 ? clamp(1 - p.attackT / atkFull, 0, 0.999) : 0;
  if (p.hp <= 0 || p.hurtT > 0) return { key: 'hero/hurt', frame: p.hp <= 0 ? 2 : Math.floor((0.3 - (p.hurtT || 0)) / 0.1) };
  if (p.attacking) {
    if (p.attackAir) return { key: 'hero/jump_attack', frame: 2 + Math.floor(prog * 4) };
    if (p.ducking) return { key: 'hero/crouch_slash', frame: Math.floor(prog * 4) };
    return { key: 'hero/attack', frame: 1 + Math.floor(prog * 5) };
  }
  if (p.climbing) return { key: 'hero/jump', frame: 1 + (Math.floor((p.anim || 0) * 4) % 2) };
  if (p.ducking) return { key: 'hero/crouch', frame: 2 };
  if (!p.onGround) {
    const f = p.vy < -260 ? 1 : p.vy < -40 ? 2 : p.vy < 220 ? 3 : 4;
    return { key: 'hero/jump', frame: f };
  }
  if (Math.abs(p.vx) > 30) {
    const meta = getSprite('hero/run')?.meta || { fps: 16, frames: 12 };
    return { key: 'hero/run', frame: animFrame(meta, p.anim || 0, 1.1) };
  }
  const meta = getSprite('hero/idle')?.meta || { fps: 6, frames: 4 };
  return { key: 'hero/idle', frame: animFrame(meta, t, 1) };
}

export function drawPlayer(ctx, p, t, cam, stats) {
  if (!p) return;
  const rate = stats && stats.attackRate != null ? stats.attackRate : 1;
  const atkFull = combatAttackDuration(PLAYER_SWORD, { attackRate: rate });
  const pose = playerPose(p, t, atkFull);
  const c = camOf(cam);

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(Math.round(p.x - c.x), Math.round(p.y - c.y) - 1, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const flash = p.inv > 0 && p.hp > 0 && Math.floor(t * 18) % 2 === 0;
  const ok = drawSprite(ctx, pose.key, pose.frame, p.x, p.y, {
    scale: PLAYER_DRAW.drawScale || 2, flip: (p.facing || 1) < 0,
    camX: c.x, camY: c.y, alpha: flash ? 0.45 : 1, pixel: true,
  });
  if (!ok) {
    ctx.fillStyle = '#3a6aa0';
    ctx.fillRect(wx(p.x, cam) - p.w / 2, wy(p.y, cam) - p.h, p.w, p.h);
  }
}

export function drawEnemy(ctx, e, cam, t) {
  const sx = wx(e.x, cam);
  const sy = wy(e.y, cam);
  if (sx < -80 || sx > W + 80) return;
  if (sy < -120 || sy > H + 80) return;
  let key = 'enemy/' + (e.skin || 'skeleton');
  let entry = getSprite(key);
  let frame = 0;
  if (e.rise > 0 && getSprite('enemy/skeleton_rise')?.ready) {
    key = 'enemy/skeleton_rise';
    entry = getSprite(key);
    frame = Math.min(entry.meta.frames - 1, Math.floor((1 - e.rise / 0.6) * entry.meta.frames));
  } else if (entry && entry.meta) {
    const moving = e.fly || Math.abs(e.vx) > 5;
    frame = moving ? animFrame(entry.meta, e.phase, 1) : (e.slamState === 'windup' ? 0 : animFrame(entry.meta, e.phase, 0.35));
  }
  const bossLike = !!(e.isBoss || e.type === 'iron_warden');
  const scale = e.drawScale || (e.type === 'iron_warden' ? 1.35 : 1.15);

  // Melee telegraph: ground / strike warning during windup/active
  if (e.slamState === 'windup' || e.slamState === 'slam') {
    const face = e.facing || -1;
    const mcfg = e.meleeCfg || getEnemyMeleeCfg(e);
    const range = mcfg && mcfg.range != null ? mcfg.range : 48;
    const heavy = !!(mcfg && mcfg.heavy) || !!e.hasSlam;
    const warnX = sx + face * (e.w * 0.25 + range * 0.45);
    const pulse = e.slamState === 'windup'
      ? 0.35 + 0.35 * Math.sin(t * (heavy ? 18 : 22))
      : 0.7;
    const elW = range * (heavy ? 0.55 : 0.42);
    const elH = heavy ? 7 : 5;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = e.slamState === 'slam'
      ? (heavy ? 'rgba(220,40,30,0.55)' : 'rgba(230,70,50,0.45)')
      : (heavy ? 'rgba(255,90,40,0.4)' : 'rgba(255,160,60,0.38)');
    ctx.beginPath();
    ctx.ellipse(warnX, sy - 2, elW, elH, 0, 0, Math.PI * 2);
    ctx.fill();
    if (e.slamState === 'windup') {
      ctx.strokeStyle = heavy ? 'rgba(255,200,80,0.85)' : 'rgba(255,220,120,0.9)';
      ctx.lineWidth = heavy ? 2 : 1.5;
      ctx.setLineDash(heavy ? [6, 4] : [4, 3]);
      ctx.beginPath();
      ctx.ellipse(warnX, sy - 2, elW, elH, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (!heavy) {
        ctx.strokeStyle = 'rgba(255,230,160,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const arcR = range * 0.55;
        const base = sx + face * (e.w * 0.15);
        const ay = sy - e.h * 0.45;
        ctx.arc(base, ay, arcR, face > 0 ? -0.9 : Math.PI - 0.2, face > 0 ? 0.2 : Math.PI + 0.9);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(sx, sy - 1, e.w * 0.4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const pixel = !!(entry && entry.meta && entry.meta.fw && e.drawScale === 2);
  const sopts = { scale, flip: (e.facing || -1) !== (e.artFaces || -1), ...spriteCam(cam), pixel };
  const ok = drawSprite(ctx, key, frame, e.x, e.y + (pixel ? 0 : 2), sopts);
  if (ok && (e.flash > 0 || e.slamState === 'windup')) {
    const a = e.flash > 0 ? 0.85 : 0.25 + 0.25 * Math.sin(t * 24);
    drawSprite(ctx, key, frame, e.x, e.y + (pixel ? 0 : 2), { ...sopts, alpha: a, composite: 'lighter' });
  }
  if (!ok) {
    ctx.fillStyle = e.slamState === 'windup' ? '#c44' : e.color;
    ctx.fillRect(sx - e.w / 2, sy - e.h, e.w, e.h);
  }

  if (bossLike || e.hp < e.maxHp * 0.95) {
    const bw = Math.max(e.w, 28);
    const ratio = clamp(e.hp / e.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    const barY = sy - (pixel ? e.h + 14 : e.h * scale * 0.55 + 10);
    ctx.fillRect(sx - bw / 2, barY, bw, 4);
    ctx.fillStyle = ratio > 0.35 ? '#7dffa0' : '#e74c3c';
    ctx.fillRect(sx - bw / 2, barY, bw * ratio, 4);
  }

  if (e.label && bossLike) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const label = e.label;
    ctx.font = 'bold 11px system-ui,sans-serif';
    const tw = ctx.measureText(label).width;
    const ly = sy - e.h * scale * 0.55 - 22;
    ctx.fillRect(sx - tw / 2 - 4, ly - 10, tw + 8, 14);
    ctx.fillStyle = '#f5e6c8';
    ctx.textAlign = 'center';
    ctx.fillText(label, sx, ly);
    ctx.textAlign = 'left';
  }
}

export function drawCoin(ctx, c, t, cam) {
  const bob = Math.sin(t * 5 + c.x) * 2;
  const x = wx(c.x, cam);
  const y = wy(c.y, cam) + bob;
  if (!drawImageKey(ctx, 'prop/coin', Math.round(x - 11), Math.round(y - 11), 22, 22, true)) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawParticles(ctx, particles, cam) {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(wx(p.x, cam), wy(p.y, cam), p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * @param {object} p player
 * @param {number} sc score
 * @param {number} best best score
 * @param {object} [opts]
 * @param {string} [opts.stageLabel]
 * @param {string} [opts.phaseLabel]
 */
function drawHeartIcon(ctx, x, y, s, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 16, s / 16);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-8, -4, -16, 4, 0, 16);
  ctx.bezierCurveTo(16, 4, 8, -4, 0, 5);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

export function drawHud(ctx, p, sc, best, opts = {}) {
  const stageLabel = opts.stageLabel || 'STAGE';
  const phaseLabel = opts.phaseLabel || '';
  const coins = opts.coins != null ? opts.coins : 0;

  // Top-left (right of the ☰ button): portrait, hearts, coins, XP
  ctx.save();
  ctx.translate(70, 0);
  if (p) {
    ctx.fillStyle = 'rgba(24, 18, 12, 0.55)';
    ctx.beginPath();
    ctx.arc(34, 34, 26, 0, Math.PI * 2);
    ctx.fill();
    if (!drawImageKey(ctx, 'hero/portrait', 10, 10, 48, 48)) {
      ctx.fillStyle = '#3a6aa0';
      ctx.beginPath(); ctx.arc(34, 34, 20, 0, Math.PI * 2); ctx.fill();
    }

    const heartHp = HEART || 25;
    const maxHearts = Math.max(1, Math.ceil((p.maxHp || 100) / heartHp));
    const hp = Math.max(0, p.hp || 0);
    for (let i = 0; i < maxHearts; i++) {
      const hx = 70 + i * 22;
      const filled = hp > i * heartHp;
      const half = !filled && hp > (i - 0.5) * heartHp + heartHp * 0.5;
      const col = filled ? '#e74c3c' : (half ? '#e74c3c' : 'rgba(40,20,20,0.45)');
      drawHeartIcon(ctx, hx, 22, half && !filled ? 14 : 16, col);
    }

    ctx.fillStyle = '#f5e6c8';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪙  × ' + coins, 68, 48);

    const bx = 68, by = 62, bw = 160, bh = 10;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRectPath(ctx, bx, by, bw, bh, 4); ctx.fill();
    const xr = p.xpNext > 0 ? clamp(p.xp / p.xpNext, 0, 1) : 0;
    ctx.fillStyle = '#3d7ec9';
    if (xr > 0.01) {
      ctx.save();
      roundRectPath(ctx, bx, by, bw * xr, bh, 4); ctx.clip();
      ctx.fillRect(bx, by, bw * xr, bh);
      ctx.restore();
    }
    ctx.fillStyle = '#c9a227';
    ctx.font = 'bold 9px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Lv ' + (p.level || 1), bx + bw + 22, by + 5);
  }

  // Top-right stage banner
  ctx.translate(-70, 0);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(28, 22, 16, 0.55)';
  // Portrait: the banner gets its own row under the hearts
  const bannerW = PORTRAIT ? W - 28 : 306;
  const bannerY = PORTRAIT ? 84 : 12;
  roundRectPath(ctx, W - 14 - bannerW, bannerY, bannerW, 40, 8); ctx.fill();
  ctx.fillStyle = '#f5e6c8';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(stageLabel, W - 22, bannerY + 12);
  ctx.fillStyle = '#c9b48a';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(phaseLabel || 'Explore  ·  Climb  ·  Fight  ·  Discover', W - 22, bannerY + 28);
  ctx.restore();
}

export function drawControls(ctx, stick) {
  const { stick: sc, jump: jb, attack: ab } = CONTROLS;
  ctx.save();
  if (PORTRAIT) {
    const top = H - 330;
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, 'rgba(12, 10, 8, 0)');
    g.addColorStop(0.35, 'rgba(12, 10, 8, 0.45)');
    g.addColorStop(1, 'rgba(12, 10, 8, 0.7)');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);
  }
  ctx.globalAlpha = stick.active ? 0.6 : 0.35;
  ctx.fillStyle = 'rgba(30, 22, 16, 0.9)';
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(sc.x, sc.y, sc.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = stick.active ? 0.9 : 0.45;
  ctx.fillStyle = '#c9a227';
  const knob = sc.r * 0.36;
  ctx.beginPath();
  ctx.arc(sc.x + stick.dx * (sc.r - knob), sc.y + clamp(stick.dy, -1, 1) * (sc.r - knob) * 0.5, knob, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#a89070';
  ctx.font = `${Math.round(sc.r * 0.24)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('↓ duck · ↑ climb', sc.x, sc.y + sc.r + 12);

  const button = (b, down, fill, stroke, label, textCol) => {
    ctx.globalAlpha = down ? 0.8 : 0.4;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = textCol;
    ctx.font = `bold ${Math.round(b.r * 0.36)}px system-ui`;
    ctx.fillText(label, b.x, b.y);
  };
  button(jb, stick.jumpDown, 'rgba(40, 28, 18, 0.9)', 'rgba(201, 162, 39, 0.7)', 'JUMP', '#f5e6c8');
  button(ab, stick.attackDown, 'rgba(50, 20, 20, 0.9)', 'rgba(231, 76, 60, 0.7)', 'ATK', '#f5c6c0');
  ctx.restore();
}

export function drawLevelUpOverlay(ctx, choices) {
  ctx.save();
  ctx.fillStyle = 'rgba(18, 12, 8, 0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f5e6c8';
  ctx.font = 'bold 22px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LEVEL UP!', W / 2, 120);
  ctx.fillStyle = '#a89070';
  ctx.font = '13px system-ui';
  ctx.fillText('Choose a blessing', W / 2, 148);

  const cardW = W - 48, cardH = 72, startY = 190, gap = 14;
  for (let i = 0; i < choices.length; i++) {
    const u = choices[i];
    const y = startY + i * (cardH + gap);
    ctx.fillStyle = 'rgba(36, 26, 18, 0.96)';
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.5)';
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, 24, y, cardW, cardH, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(201, 162, 39, 0.15)';
    ctx.beginPath(); ctx.arc(54, y + cardH / 2, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9a227';
    ctx.font = '18px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(u.icon || '★', 54, y + cardH / 2 + 1);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f5e6c8';
    ctx.font = 'bold 15px system-ui';
    ctx.fillText(u.name, 82, y + 28);
    ctx.fillStyle = '#a89070';
    ctx.font = '12px system-ui';
    ctx.fillText(u.desc, 82, y + 48);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = 'bold 18px system-ui';
    ctx.fillText(String(i + 1), W - 40, y + cardH / 2 + 1);
  }
  ctx.restore();
}

export function levelUpHitTest(clientY, rect, choices) {
  const scale = rect.width / W;
  const y = (clientY - rect.top) / scale;
  const cardH = 72, startY = 190, gap = 14;
  for (let i = 0; i < choices.length; i++) {
    const cy = startY + i * (cardH + gap);
    if (y >= cy && y <= cy + cardH) return i;
  }
  return -1;
}

export function drawIdleDecor(ctx, t) {
  const L = getLevelById('forgegate-fields');
  const span = Math.max(1, L.bounds.maxX - W);
  const k = (Math.sin(t * 0.05) + 1) / 2;
  const cam = { x: Math.round(k * span), y: Math.round(L.bounds.maxY - H) };
  drawCliffsBackground(ctx, cam);
  drawStamps(ctx, L.tiles, cam, 'back');
  drawStamps(ctx, L.tiles, cam, 'mid');
  drawTiles(ctx, L.tiles, cam);
  drawStamps(ctx, L.tiles, cam, 'front');
}

export function drawLoading(ctx) {
  ctx.fillStyle = '#1a2430';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f5e6c8';
  ctx.font = 'bold 18px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('A brighter vale awaits…', W / 2, H / 2);
}

/** End gate pillar (world space). */
export function drawGate(ctx, gate, cam, open) {
  if (!gate && gate !== 0) return;
  const gx = typeof gate === 'object' ? gate.x : gate;
  const gy = typeof gate === 'object' ? gate.y + (gate.h || 120) : GROUND_Y;
  const gh = typeof gate === 'object' ? (gate.h || 120) : 110;
  const gw = typeof gate === 'object' ? (gate.w || 64) : 56;
  const x = wx(gx, cam);
  const y = wy(gy, cam);
  if (x < -80 || x > W + 80) return;
  ctx.save();
  ctx.fillStyle = open ? 'rgba(201, 162, 39, 0.85)' : 'rgba(50, 44, 40, 0.95)';
  ctx.fillRect(x, y - gh, 8, gh);
  ctx.fillRect(x + gw - 8, y - gh, 8, gh);
  ctx.fillRect(x - 4, y - gh - 10, gw + 8, 12);
  ctx.fillStyle = open ? 'rgba(80, 160, 90, 0.4)' : 'rgba(20, 18, 16, 0.75)';
  ctx.fillRect(x + 8, y - gh + 8, gw - 16, gh - 16);
  if (!open) {
    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.arc(x + gw / 2, y - gh * 0.45, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Mid-stage checkpoint flags.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id: string, x: number, y?: number }[]} checkpoints
 * @param {number} cam
 * @param {Set<string>|null} reached
 * @param {string|null} activeId
 */
export function drawCheckpoints(ctx, checkpoints, cam, reached, activeId) {
  if (!checkpoints?.length) return;
  for (const cp of checkpoints) {
    const x = wx(cp.x, cam);
    const baseY = wy(cp.y ?? GROUND_Y, cam);
    if (x < -40 || x > W + 40) continue;
    const on = reached?.has(cp.id) || cp.id === activeId;
    ctx.save();
    if (!drawImageKey(ctx, 'prop/flag', x - 10, baseY - 52, 28, 52)) {
      ctx.fillStyle = on ? 'rgba(201, 162, 39, 0.9)' : 'rgba(100, 80, 55, 0.85)';
      ctx.fillRect(x - 2, baseY - 52, 4, 52);
      ctx.fillStyle = on ? 'rgba(80, 160, 90, 0.85)' : '#3a5a9a';
      ctx.beginPath();
      ctx.moveTo(x + 2, baseY - 52);
      ctx.lineTo(x + 22, baseY - 42);
      ctx.lineTo(x + 2, baseY - 32);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Soft arena edge markers while fighting the boss. */
export function drawArenaBounds(ctx, arena, cam) {
  if (!arena) return;
  ctx.save();
  ctx.fillStyle = 'rgba(180, 40, 40, 0.18)';
  const left = wx(arena.minX, cam);
  const right = wx(arena.maxX, cam);
  if (left > -20) ctx.fillRect(left - 6, 0, 6, H);
  if (right < W + 20) ctx.fillRect(right, 0, 6, H);
  ctx.fillStyle = 'rgba(231, 76, 60, 0.75)';
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('BOSS ARENA', W / 2, PLAY.top + 14);
  ctx.restore();
}

/** Full frame for an active session. */
export function drawSession(ctx, session, t, stick, bestScore) {
  const cam = { x: session.cameraX || 0, y: session.cameraY || 0 };
  ctx.save();
  if (session.shake > 0 && (session.screen === 'play' || session.screen === 'levelup')) {
    const s = Math.min(session.shake, 3) * 0.35;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  const inWorld = session.screen === 'play'
    || session.screen === 'levelup'
    || session.screen === 'allocate'
    || session.screen === 'clear'
    || session.screen === 'over'
    || session.screen === 'select';

  if (session.screen === 'menu' || session.screen === 'select' || session.screen === 'allocate') {
    drawIdleDecor(ctx, t);
  } else if (inWorld && session.player && session.level?.tiles) {
    const pc = { x: Math.round(cam.x), y: Math.round(cam.y) };
    const tiles = session.level.tiles;
    drawCliffsBackground(ctx, pc);
    drawStamps(ctx, tiles, pc, 'back');
    drawStamps(ctx, tiles, pc, 'mid');
    drawTiles(ctx, tiles, pc);
    drawLaddersPixel(ctx, session.ladders, pc);
    if (session.level.gate) {
      session.gateLift = clamp((session.gateLift || 0) + (session.isGateOpen?.() ? 0.02 : -0.05), 0, 1);
      drawPixelGate(ctx, session.level.gate, pc, session.gateLift);
    }
    drawFlags(ctx, session.level.checkpoints, pc, session.reachedCheckpoints, session.activeCheckpoint?.id || null, t);
    drawPickups(ctx, session.pickups, pc, t);
    for (const c of session.coins) drawCoin(ctx, c, t, pc);
    for (const e of session.enemies) drawEnemy(ctx, e, pc, t);
    drawPlayer(ctx, session.player, t, pc, session.stats);
    drawEffects(ctx, session.effects, pc);
    drawStamps(ctx, tiles, pc, 'front');
    drawParticles(ctx, session.particles, pc);
    drawPopups(ctx, session.popups, pc);
  } else if (inWorld && session.player) {
    drawBackground(ctx, cam);
    drawPlatforms(ctx, session.platforms, cam);
    drawLadders(ctx, session.ladders, cam);
    drawProps(ctx, session.level?.props, cam);
    if (session.levelPhase === 'explore') {
      drawCheckpoints(
        ctx,
        session.level?.checkpoints || [],
        cam,
        session.reachedCheckpoints,
        session.activeCheckpoint?.id || null,
      );
      drawGate(
        ctx,
        session.level?.gate || session.getGateX?.() || session.level?.gateX,
        cam,
        session.isGateOpen?.() ?? false,
      );
    }
    if (session.levelPhase === 'boss') {
      drawArenaBounds(ctx, session.arena, cam);
    }
    for (const c of session.coins) drawCoin(ctx, c, t, cam);
    for (const e of session.enemies) drawEnemy(ctx, e, cam, t);
    drawPlayer(ctx, session.player, t, cam, session.stats);
    drawEffects(ctx, session.effects, cam);
    drawParticles(ctx, session.particles, cam);
    drawPopups(ctx, session.popups, cam);
  }
  if (inWorld && session.player && session.screen !== 'select' && session.screen !== 'allocate') {
    let stageLabel = session.level
      ? `STAGE ${session.level.order}: ${session.level.name.toUpperCase()}`
      : ('STAGE ' + (session.wave || 1));
    let phaseLabel = '';
    if (session.levelPhase === 'boss') phaseLabel = 'The Iron Warden';
    else if (session.isGateOpen?.()) phaseLabel = 'Gate open';
    else if (session.allEncountersFired?.() && session.enemies.length) {
      phaseLabel = `Defeat ${session.enemies.length} more ${session.enemies.length === 1 ? 'foe' : 'foes'} to open the gate`;
    }
    else if (session.activeCheckpoint) phaseLabel = 'Checkpoint';
    if (session.meta?.ngPlus > 0) stageLabel += `  ·  NG+${session.meta.ngPlus}`;

    drawHud(
      ctx,
      session.player,
      session.score,
      Math.max(bestScore, Math.floor(session.score)),
      {
        stageLabel,
        phaseLabel,
        coins: session.coinsCollected || 0,
        unspentPoints: session.meta ? session.meta.unspentPoints : 0,
      },
    );
    if (session.screen === 'play' || session.screen === 'levelup') drawControls(ctx, stick);
  }
  ctx.restore();
}
