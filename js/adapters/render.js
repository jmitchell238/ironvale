/**
 * Adapter: draw a GameSession snapshot to canvas.
 * Presentation only — never mutates session state.
 */

import {
  W, H, PLAY, GROUND_Y, PLAYER_DRAW, PLAYER_SWORD, PLAYER_BODY, getEnemyMeleeCfg,
} from '../config/index.js';
import { clamp } from '../core/math.js';
import { getAttackBox, combatAttackDuration } from '../domain/combat.js';
import { getSprite, animFrame, drawSprite, drawImageKey } from './sprites.js';

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

export function drawBackground(ctx, cam) {
  // Sky gradient — brighter so terrain reads against it
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#7eb0d8');
  g.addColorStop(0.35, '#b8d4a8');
  g.addColorStop(0.7, '#8aaa68');
  g.addColorStop(1, '#5a7048');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Soft clouds (parallax far)
  ctx.save();
  const cloudScroll = (cam * 0.04) % 220;
  for (let i = -1; i < 4; i++) {
    const cx = i * 220 - cloudScroll + 40;
    const cy = 70 + (i % 3) * 28;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#eef6ff';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 42, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 28, cy + 4, 30, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 24, cy + 6, 26, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Distant hills silhouette
  const hills = getSprite('bg/hills');
  if (hills && hills.ready) {
    const img = hills.img;
    const ch = Math.min(img.height * 0.9, (GROUND_Y - PLAY.top) * 0.52);
    const scale = ch / img.height;
    const cw = img.width * scale;
    const y = GROUND_Y - ch + 8;
    const scroll = (cam * 0.12) % cw;
    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.imageSmoothingEnabled = true;
    for (let x = -scroll - cw; x < W + cw; x += cw) {
      ctx.drawImage(img, x, y, cw, ch);
    }
    ctx.restore();
  } else {
    // Procedural distant ridges
    ctx.save();
    const scroll = (cam * 0.1) % 180;
    ctx.fillStyle = 'rgba(70, 100, 70, 0.45)';
    ctx.beginPath();
    ctx.moveTo(-20, GROUND_Y);
    for (let x = -scroll; x < W + 40; x += 60) {
      const peak = GROUND_Y - 90 - Math.sin((x + cam) * 0.01) * 40;
      ctx.lineTo(x, peak);
    }
    ctx.lineTo(W + 20, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Mid-ground trees (simple silhouettes, parallax)
  ctx.save();
  const tScroll = (cam * 0.22) % 96;
  for (let x = -tScroll; x < W + 40; x += 96) {
    const base = GROUND_Y - 2;
    const hgt = 36 + ((Math.floor(x + cam) * 17) % 28);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#2a4028';
    ctx.fillRect(x + 18, base - hgt * 0.35, 6, hgt * 0.4);
    ctx.beginPath();
    ctx.moveTo(x + 4, base - hgt * 0.3);
    ctx.lineTo(x + 21, base - hgt);
    ctx.lineTo(x + 38, base - hgt * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Deep soil under the playfield (readable floor bed)
  const soil = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  soil.addColorStop(0, '#4a3828');
  soil.addColorStop(0.15, '#3a2a1c');
  soil.addColorStop(1, '#1e1610');
  ctx.fillStyle = soil;
  ctx.fillRect(0, GROUND_Y + 2, W, H - GROUND_Y);

  // Grass strip at world floor line for depth cue when no platform tile
  ctx.fillStyle = 'rgba(70, 130, 55, 0.35)';
  ctx.fillRect(0, GROUND_Y, W, 4);
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
  // Sort back-to-front: higher Y (lower on screen) drawn later for overlap
  const list = platforms.slice().sort((a, b) => a.y - b.y);
  for (const pl of list) {
    const x = pl.x - cam;
    if (x + pl.w < -30 || x > W + 30) continue;

    // Prefer rich procedural blocks (tiles alone read as flat bars)
    drawPlatformBlock(ctx, pl, x);

    // Optional tile overlay for texture (subtle)
    const key = pl.ground ? 'tile/ground' : 'tile/platform';
    const tile = getSprite(key);
    if (tile && tile.ready && pl.w > 80) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.imageSmoothingEnabled = false;
      const tw = 48;
      const th = pl.ground ? 28 : 18;
      for (let px = 0; px < pl.w; px += tw) {
        const ww = Math.min(tw, pl.w - px);
        ctx.drawImage(tile.img, x + px, pl.y, ww, th);
      }
      ctx.restore();
      // Re-draw crisp grass top over texture
      ctx.fillStyle = 'rgba(100, 180, 60, 0.55)';
      ctx.fillRect(x, pl.y - 2, pl.w, 4);
      ctx.fillStyle = 'rgba(220, 190, 80, 0.5)';
      ctx.fillRect(x, pl.y - 2, pl.w, 1);
    }
  }
}

function playerAnimKey(p) {
  if (p.hp <= 0) return 'player/dead';
  if (p.attacking) return p.attackAir ? 'player/jump_attack' : 'player/attack';
  if (!p.onGround) return 'player/jump';
  if (p.ducking) return 'player/idle';
  if (Math.abs(p.vx) > 40) return 'player/run';
  if (Math.abs(p.vx) > 15) return 'player/walk';
  return 'player/idle';
}

export function drawPlayer(ctx, p, t, cam, stats) {
  if (!p) return;
  const key = playerAnimKey(p);
  const entry = getSprite(key);
  const rate = stats && stats.attackRate != null ? stats.attackRate : 1;
  const atkFull = combatAttackDuration(PLAYER_SWORD, { attackRate: rate });
  let frame = 0;
  if (entry && entry.meta) {
    if (key === 'player/jump') {
      frame = p.vy < -120 ? 2 : p.vy < 0 ? 4 : p.vy < 200 ? 6 : 8;
    } else if (key === 'player/attack' || key === 'player/jump_attack') {
      const prog = 1 - (p.attackT / atkFull);
      frame = clamp(Math.floor(prog * 10), 0, 9);
    } else {
      frame = animFrame(entry.meta, p.anim != null ? p.anim : t * 0.4, 1);
    }
  }

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(p.x - cam, p.y - 1, p.ducking ? 16 : 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const flash = p.inv > 0 && Math.floor(t * 18) % 2 === 0;
  let scale = PLAYER_DRAW.drawScale || 1.35;
  // Squash sprite when ducking (no dedicated crouch sheet)
  if (p.ducking) scale *= 0.72;
  const footY = p.ducking ? p.y + 4 : p.y + 2;
  const ok = drawSprite(ctx, key, frame, p.x, footY, {
    scale, flip: (p.facing || 1) < 0, cam, alpha: flash ? 0.4 : 1,
  });
  if (!ok) {
    ctx.fillStyle = '#c0c8d0';
    ctx.fillRect(p.x - cam - 10, p.y - p.h, 20, p.h);
  }

  if (p.attacking && p.attackT > atkFull * 0.25) {
    const st = stats || { rangeMul: 1 };
    const box = getAttackBox(p, st, PLAYER_SWORD);
    const dir = p.facing || 1;
    const rm = st.rangeMul != null ? st.rangeMul : 1;
    const reach = (p.attackAir ? PLAYER_SWORD.airAttackRange : PLAYER_SWORD.attackRange) * rm;
    const midX = box ? (box.x + box.w * 0.55) : (p.x + dir * (p.w * 0.2 + reach * 0.55));
    const midY = box ? (box.y + box.h * 0.45) : (p.y - p.h * 0.5);
    const fxW = Math.max(36, reach * 0.72);
    const fxH = p.attackAir ? 32 : 24;
    const life = clamp(p.attackT / atkFull, 0, 1);
    ctx.save();
    ctx.translate(midX - cam, midY);
    if (dir < 0) ctx.scale(-1, 1);
    if (p.attackAir) ctx.rotate(0.35);
    ctx.globalAlpha = 0.55 + life * 0.35;
    if (!drawImageKey(ctx, 'fx/slash', -4, -fxH / 2, fxW, fxH)) {
      ctx.strokeStyle = '#f5e6c8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(fxW * 0.15, 0, fxW * 0.42, -1.0, 0.85);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawEnemy(ctx, e, cam, t) {
  const sx = e.x - cam;
  if (sx < -80 || sx > W + 80) return;
  const key = 'enemy/' + (e.skin || 'slime');
  const entry = getSprite(key);
  const frame = entry && entry.meta ? animFrame(entry.meta, e.phase * 0.5, 1) : 0;
  const bossLike = !!(e.isBoss || e.type === 'boss' || e.type === 'bandit_captain'
    || e.type === 'skeleton_champion' || e.type === 'ogre_warchief');
  const scale = e.drawScale
    || (e.type === 'boss' ? 1.6
      : e.type === 'ogre_warchief' ? 1.75
      : e.type === 'skeleton_champion' ? 1.55
      : e.type === 'bandit_captain' ? 1.5
      : e.type === 'ogre' ? 1.35
      : 1.3);

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
    ctx.ellipse(warnX, e.y - 2, elW, elH, 0, 0, Math.PI * 2);
    ctx.fill();
    if (e.slamState === 'windup') {
      ctx.strokeStyle = heavy ? 'rgba(255,200,80,0.85)' : 'rgba(255,220,120,0.9)';
      ctx.lineWidth = heavy ? 2 : 1.5;
      ctx.setLineDash(heavy ? [6, 4] : [4, 3]);
      ctx.beginPath();
      ctx.ellipse(warnX, e.y - 2, elW, elH, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Light slash: short arc cue in facing direction
      if (!heavy) {
        ctx.strokeStyle = 'rgba(255,230,160,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const arcR = range * 0.55;
        const base = sx + face * (e.w * 0.15);
        const ay = e.y - e.h * 0.45;
        ctx.arc(base, ay, arcR, face > 0 ? -0.9 : Math.PI - 0.2, face > 0 ? 0.2 : Math.PI + 0.9);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(sx, e.y - 1, e.w * 0.4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const slamFlash = e.slamState === 'windup' ? 0.55 + 0.25 * Math.sin(t * 20) : 1;
  const alpha = e.flash > 0 ? 0.5 : slamFlash;
  const ok = drawSprite(ctx, key, frame, e.x, e.y + 2, {
    scale, flip: (e.facing || -1) > 0, cam, alpha,
  });
  if (!ok) {
    ctx.fillStyle = e.slamState === 'windup' ? '#c44' : e.color;
    ctx.fillRect(sx - e.w / 2, e.y - e.h, e.w, e.h);
  }

  if (bossLike || e.type === 'ogre' || e.hp < e.maxHp * 0.95) {
    const bw = Math.max(e.w, 28);
    const ratio = clamp(e.hp / e.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(sx - bw / 2, e.y - e.h * scale * 0.55 - 10, bw, 4);
    ctx.fillStyle = ratio > 0.35 ? '#7dffa0' : '#e74c3c';
    ctx.fillRect(sx - bw / 2, e.y - e.h * scale * 0.55 - 10, bw * ratio, 4);
  }

  if (e.label && bossLike) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const label = e.label;
    ctx.font = 'bold 11px system-ui,sans-serif';
    const tw = ctx.measureText(label).width;
    const ly = e.y - e.h * scale * 0.55 - 22;
    ctx.fillRect(sx - tw / 2 - 4, ly - 10, tw + 8, 14);
    ctx.fillStyle = '#f5e6c8';
    ctx.textAlign = 'center';
    ctx.fillText(label, sx, ly);
    ctx.textAlign = 'left';
  }
}

export function drawCoin(ctx, c, t, cam) {
  const bob = Math.sin(t * 5 + c.x) * 2;
  if (!drawImageKey(ctx, 'fx/coin', c.x - cam - 8, c.y + bob - 8, 16, 16)) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(c.x - cam, c.y + bob, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawParticles(ctx, particles, cam) {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - cam, p.y, p.r, 0, Math.PI * 2);
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
export function drawHud(ctx, p, sc, best, opts = {}) {
  const stageLabel = opts.stageLabel || 'STAGE';
  const phaseLabel = opts.phaseLabel || '';

  ctx.fillStyle = 'rgba(20, 14, 10, 0.78)';
  ctx.fillRect(0, 0, W, PLAY.top - 2);
  ctx.fillStyle = 'rgba(201, 162, 39, 0.35)';
  ctx.fillRect(0, PLAY.top - 3, W, 2);

  ctx.fillStyle = '#f5e6c8';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(Math.floor(sc).toLocaleString(), 14, 22);
  ctx.fillStyle = '#a89070';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('BEST ' + Math.floor(best).toLocaleString(), 14, 40);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#c9a227';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(stageLabel, W - 14, 22);
  ctx.fillStyle = '#a89070';
  ctx.font = '11px system-ui, sans-serif';
  const pts = opts.unspentPoints != null ? opts.unspentPoints : null;
  let rightSub = phaseLabel || ('LV ' + (p ? p.level : 1));
  if (pts != null && pts > 0 && !phaseLabel) rightSub = 'LV ' + (p ? p.level : 1) + ' · +' + pts + 'pt';
  else if (!phaseLabel && p) rightSub = 'LV ' + p.level;
  ctx.fillText(rightSub, W - 14, 40);

  if (p) {
    const bx = 14, by = H - 96, bw = W - 28, bh = 11;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRectPath(ctx, bx, by, bw, bh, 4); ctx.fill();
    const ratio = clamp(p.hp / p.maxHp, 0, 1);
    ctx.fillStyle = '#c0392b';
    if (ratio > 0.01) {
      ctx.save();
      roundRectPath(ctx, bx, by, bw * ratio, bh, 4); ctx.clip();
      ctx.fillRect(bx, by, bw * ratio, bh);
      ctx.restore();
    }
    const xy = by + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRectPath(ctx, bx, xy, bw, 7, 3); ctx.fill();
    const xr = p.xpNext > 0 ? clamp(p.xp / p.xpNext, 0, 1) : 0;
    ctx.fillStyle = '#c9a227';
    if (xr > 0.01) {
      ctx.save();
      roundRectPath(ctx, bx, xy, bw * xr, 7, 3); ctx.clip();
      ctx.fillRect(bx, xy, bw * xr, 7);
      ctx.restore();
    }
  }
}

export function drawControls(ctx, stick) {
  const cx = 64, cy = H - 48, br = 36;
  ctx.save();
  ctx.globalAlpha = stick.active ? 0.55 : 0.3;
  ctx.fillStyle = 'rgba(30, 22, 16, 0.9)';
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, br, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = stick.active ? 0.9 : 0.4;
  ctx.fillStyle = '#c9a227';
  ctx.beginPath();
  ctx.arc(cx + stick.dx * (br - 14), cy + clamp(stick.dy, -1, 1) * (br - 14) * 0.3, 13, 0, Math.PI * 2);
  ctx.fill();
  // Stick hint: ↓ duck
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#a89070';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('↓ duck', cx, cy + br + 12);

  const jx = W - 58, jy = H - 52;
  ctx.globalAlpha = stick.jumpDown ? 0.75 : 0.35;
  ctx.fillStyle = 'rgba(40, 28, 18, 0.9)';
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.7)';
  ctx.beginPath(); ctx.arc(jx, jy, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f5e6c8';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.95;
  ctx.fillText('JUMP', jx, jy);
  ctx.globalAlpha = 0.45;
  ctx.font = '8px system-ui';
  ctx.fillStyle = '#a89070';
  ctx.fillText('×2 air', jx, jy + 32);

  const ax = W - 58, ay = H - 118;
  ctx.globalAlpha = stick.attackDown ? 0.8 : 0.38;
  ctx.fillStyle = 'rgba(50, 20, 20, 0.9)';
  ctx.strokeStyle = 'rgba(231, 76, 60, 0.7)';
  ctx.beginPath(); ctx.arc(ax, ay, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f5c6c0';
  ctx.globalAlpha = 0.95;
  ctx.font = 'bold 10px system-ui';
  ctx.fillText('ATK', ax, ay);
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
  const platforms = [
    { x: 0, y: GROUND_Y, w: 400, h: 28, ground: true },
    { x: 80, y: GROUND_Y - 90, w: 100, h: 14, ground: false },
  ];
  drawBackground(ctx, t * 20);
  drawPlatforms(ctx, platforms, 0);
  drawPlayer(ctx, {
    x: 110, y: GROUND_Y, w: PLAYER_BODY.w, h: PLAYER_BODY.h, facing: 1,
    onGround: true, anim: t * 0.8, vx: 30, vy: 0, hp: 100, inv: 0, attacking: false, attackT: 0,
  }, t, 0, null);
  drawEnemy(ctx, {
    x: 250, y: GROUND_Y, w: 26, h: 22, type: 'slime', skin: 'slime', color: '#3d8b3d',
    hp: 1, maxHp: 1, flash: 0, facing: -1, phase: t, frames: 4, fw: 32, fh: 32,
  }, 0, t);
  drawEnemy(ctx, {
    x: 300, y: GROUND_Y, w: 28, h: 42, type: 'bandit', skin: 'bandit', color: '#8b0000',
    hp: 1, maxHp: 1, flash: 0, facing: -1, phase: t + 1, frames: 4, fw: 40, fh: 48,
  }, 0, t);
}

export function drawLoading(ctx) {
  ctx.fillStyle = '#1a1420';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f5e6c8';
  ctx.font = 'bold 18px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('Loading the realm…', W / 2, H / 2);
}

/** End gate pillar (world space). */
export function drawGate(ctx, gateX, cam, open) {
  if (gateX == null) return;
  const x = gateX - cam;
  if (x < -40 || x > W + 40) return;
  const baseY = GROUND_Y;
  const h = 96;
  ctx.save();
  // Posts
  ctx.fillStyle = open ? 'rgba(201, 162, 39, 0.85)' : 'rgba(90, 70, 50, 0.9)';
  ctx.fillRect(x - 10, baseY - h, 8, h);
  ctx.fillRect(x + 18, baseY - h, 8, h);
  // Lintel
  ctx.fillRect(x - 14, baseY - h - 10, 50, 12);
  // Banner
  ctx.fillStyle = open ? 'rgba(80, 160, 90, 0.55)' : 'rgba(40, 30, 24, 0.65)';
  ctx.fillRect(x - 4, baseY - h + 8, 24, 36);
  ctx.fillStyle = open ? '#e8f5d0' : '#a89070';
  ctx.font = 'bold 9px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(open ? 'OPEN' : 'GATE', x + 8, baseY - h + 26);
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
    const x = cp.x - cam;
    if (x < -30 || x > W + 30) continue;
    const baseY = cp.y ?? GROUND_Y;
    const on = reached?.has(cp.id) || cp.id === activeId;
    ctx.save();
    // Pole
    ctx.fillStyle = on ? 'rgba(201, 162, 39, 0.9)' : 'rgba(100, 80, 55, 0.85)';
    ctx.fillRect(x - 2, baseY - 52, 4, 52);
    // Flag
    ctx.fillStyle = on ? 'rgba(80, 160, 90, 0.85)' : 'rgba(70, 55, 40, 0.7)';
    ctx.beginPath();
    ctx.moveTo(x + 2, baseY - 52);
    ctx.lineTo(x + 22, baseY - 42);
    ctx.lineTo(x + 2, baseY - 32);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** Soft arena edge markers while fighting the boss. */
export function drawArenaBounds(ctx, arena, cam) {
  if (!arena) return;
  ctx.save();
  ctx.fillStyle = 'rgba(180, 40, 40, 0.18)';
  const left = arena.minX - cam;
  const right = arena.maxX - cam;
  if (left > -20) ctx.fillRect(left - 6, PLAY.top, 6, GROUND_Y - PLAY.top);
  if (right < W + 20) ctx.fillRect(right, PLAY.top, 6, GROUND_Y - PLAY.top);
  ctx.fillStyle = 'rgba(231, 76, 60, 0.75)';
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('BOSS ARENA', W / 2, PLAY.top + 14);
  ctx.restore();
}

/** Full frame for an active session. */
export function drawSession(ctx, session, t, stick, bestScore) {
  const cam = session.cameraX;
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
  } else if (inWorld && session.player) {
    drawBackground(ctx, cam);
    drawPlatforms(ctx, session.platforms, cam);
    if (session.levelPhase === 'explore') {
      drawCheckpoints(
        ctx,
        session.level?.checkpoints || [],
        cam,
        session.reachedCheckpoints,
        session.activeCheckpoint?.id || null,
      );
      drawGate(ctx, session.getGateX?.() ?? session.level?.gateX, cam, session.isGateOpen?.() ?? false);
    }
    if (session.levelPhase === 'boss') {
      drawArenaBounds(ctx, session.arena, cam);
    }
    for (const c of session.coins) drawCoin(ctx, c, t, cam);
    for (const e of session.enemies) drawEnemy(ctx, e, cam, t);
    if (session.player) drawPlayer(ctx, session.player, t, cam, session.stats);
    drawParticles(ctx, session.particles, cam);

    const stageLabel = session.level
      ? `${session.level.order}. ${session.level.name}`
      : ('STAGE ' + (session.wave || 1));
    let phaseLabel = '';
    if (session.levelPhase === 'boss') phaseLabel = 'BOSS';
    else if (session.isGateOpen?.()) phaseLabel = 'GATE OPEN';
    else if (session.activeCheckpoint) phaseLabel = '⚑ CHECKPOINT';
    if (session.meta?.ngPlus > 0) {
      stageLabel += ` · NG+${session.meta.ngPlus}`;
    }

    drawHud(
      ctx,
      session.player,
      session.score,
      Math.max(bestScore, Math.floor(session.score)),
      {
        stageLabel,
        phaseLabel,
        unspentPoints: session.meta ? session.meta.unspentPoints : 0,
      },
    );
    if (session.screen === 'play' || session.screen === 'levelup') drawControls(ctx, stick);
  } else {
    drawIdleDecor(ctx, t);
  }
  // Blessing-card overlay retired (P3 RPG allocate is DOM).
  ctx.restore();
}
