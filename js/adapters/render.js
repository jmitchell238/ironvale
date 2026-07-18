/**
 * Adapter: draw a GameSession snapshot to canvas.
 * Presentation only — never mutates session state.
 */

import {
  W, H, PLAY, GROUND_Y, PLAYER_DRAW, PLAYER_SWORD, PLAYER_BODY,
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
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#6a90b8');
  g.addColorStop(0.45, '#a8c4a0');
  g.addColorStop(1, '#5a6a48');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const hills = getSprite('bg/hills');
  if (hills && hills.ready) {
    const img = hills.img;
    const ch = Math.min(img.height * 0.85, (GROUND_Y - PLAY.top) * 0.5);
    const scale = ch / img.height;
    const cw = img.width * scale;
    const y = GROUND_Y - ch + 6;
    const scroll = (cam * 0.1) % cw;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.imageSmoothingEnabled = true;
    for (let x = -scroll - cw; x < W + cw; x += cw) {
      ctx.drawImage(img, x, y, cw, ch);
    }
    ctx.restore();
    const wash = ctx.createLinearGradient(0, y, 0, GROUND_Y);
    wash.addColorStop(0, 'rgba(40, 50, 40, 0.05)');
    wash.addColorStop(1, 'rgba(30, 40, 30, 0.35)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, y, W, GROUND_Y - y + 2);
  }

  ctx.fillStyle = '#3a2e22';
  ctx.fillRect(0, GROUND_Y + 2, W, H - GROUND_Y);
}

export function drawPlatforms(ctx, platforms, cam) {
  for (const pl of platforms) {
    const x = pl.x - cam;
    if (x + pl.w < -20 || x > W + 20) continue;
    const key = pl.ground ? 'tile/ground' : 'tile/platform';
    const tile = getSprite(key);
    if (tile && tile.ready) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      const tw = pl.ground ? 48 : 40;
      const th = pl.ground ? Math.max(pl.h, 26) : pl.h + 8;
      for (let px = 0; px < pl.w; px += tw) {
        const ww = Math.min(tw, pl.w - px);
        ctx.drawImage(tile.img, x + px, pl.y, ww, th);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = pl.ground ? '#5a4a32' : '#6b5a3e';
      ctx.fillRect(x, pl.y, pl.w, pl.h + 6);
    }
    ctx.fillStyle = 'rgba(201, 162, 39, 0.55)';
    ctx.fillRect(x, pl.y, pl.w, 2);
  }
}

function playerAnimKey(p) {
  if (p.hp <= 0) return 'player/dead';
  if (p.attacking) return p.attackAir ? 'player/jump_attack' : 'player/attack';
  if (!p.onGround) return 'player/jump';
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
  ctx.ellipse(p.x - cam, p.y - 1, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const flash = p.inv > 0 && Math.floor(t * 18) % 2 === 0;
  const scale = PLAYER_DRAW.drawScale || 1.35;
  const ok = drawSprite(ctx, key, frame, p.x, p.y + 2, {
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

  // Slam telegraph: ground warning + body flash during windup/active
  if (e.slamState === 'windup' || e.slamState === 'slam') {
    const face = e.facing || -1;
    const range = 78;
    const warnX = sx + face * (e.w * 0.2 + range * 0.45);
    const pulse = e.slamState === 'windup'
      ? 0.35 + 0.35 * Math.sin(t * 18)
      : 0.7;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = e.slamState === 'slam' ? 'rgba(220,40,30,0.55)' : 'rgba(255,90,40,0.4)';
    ctx.beginPath();
    ctx.ellipse(warnX, e.y - 2, range * 0.55, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    if (e.slamState === 'windup') {
      ctx.strokeStyle = 'rgba(255,200,80,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.ellipse(warnX, e.y - 2, range * 0.55, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
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

  const ax = W - 58, ay = H - 118;
  ctx.globalAlpha = stick.attackDown ? 0.8 : 0.38;
  ctx.fillStyle = 'rgba(50, 20, 20, 0.9)';
  ctx.strokeStyle = 'rgba(231, 76, 60, 0.7)';
  ctx.beginPath(); ctx.arc(ax, ay, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f5c6c0';
  ctx.globalAlpha = 0.95;
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
