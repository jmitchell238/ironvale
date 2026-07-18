/**
 * Domain: enemy locomotion + awareness (pure).
 * Caller owns entity arrays and side effects.
 */

export function aiCanStandAt(x, refY, platforms, aiCfg) {
  const m = aiCfg.ledgeMargin != null ? aiCfg.ledgeMargin : 10;
  if (!platforms) return false;
  for (let i = 0; i < platforms.length; i++) {
    const pl = platforms[i];
    if (x < pl.x + m || x > pl.x + pl.w - m) continue;
    if (Math.abs(pl.y - refY) <= 14) return true;
  }
  return false;
}

export function aiPlatformUnder(e, platforms) {
  if (!e || !platforms) return null;
  let best = null;
  for (let i = 0; i < platforms.length; i++) {
    const pl = platforms[i];
    if (e.x < pl.x + 2 || e.x > pl.x + pl.w - 2) continue;
    if (Math.abs(pl.y - e.y) > 16) continue;
    if (!best || pl.w > best.w) best = pl;
  }
  return best;
}

export function aiHorizontalIntent(e, player, platforms, aiCfg) {
  if (!e || e.hitStun > 0) return 0;

  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const aggro = Math.abs(dx) < aiCfg.aggroX && Math.abs(dy) < aiCfg.aggroY;
  let wantDir = 0;

  if (e.type === 'boss') {
    const target = player.x + (player.x < e.x ? 70 : -70);
    wantDir = Math.abs(target - e.x) > 12 ? Math.sign(target - e.x) : 0;
  } else if (aggro) {
    wantDir = dx > 8 ? 1 : dx < -8 ? -1 : 0;
  } else {
    if (e.x <= e.patrolMin) e.facing = 1;
    else if (e.x >= e.patrolMax) e.facing = -1;
    else if (!e.facing) e.facing = -1;
    wantDir = e.facing;
  }

  if (wantDir !== 0) e.facing = wantDir;

  if (e.onGround && wantDir !== 0) {
    const look = e.x + wantDir * (aiCfg.lookAhead + e.w * 0.25);
    if (!aiCanStandAt(look, e.y, platforms, aiCfg)) {
      wantDir = 0;
      if (!aggro) {
        e.facing = -e.facing || 1;
        e.patrolMin = Math.min(e.patrolMin, e.x);
        e.patrolMax = Math.max(e.patrolMax, e.x);
      }
    }
    const pl = aiPlatformUnder(e, platforms);
    if (pl && e.type !== 'boss') {
      const edgeL = pl.x + aiCfg.ledgeMargin;
      const edgeR = pl.x + pl.w - aiCfg.ledgeMargin;
      if (wantDir < 0 && e.x <= edgeL + 2) wantDir = 0;
      if (wantDir > 0 && e.x >= edgeR - 2) wantDir = 0;
    }
  }

  return wantDir;
}

export function aiMoveSpeed(e, player, aiCfg) {
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const aggro = Math.abs(dx) < aiCfg.aggroX && Math.abs(dy) < aiCfg.aggroY;
  let speed = e.speed;
  if (!aggro && e.type !== 'boss') speed *= aiCfg.patrolSpeedMul;
  return speed;
}

/**
 * @param {object} phys - { gravity, maxFall }
 */
export function aiUpdateEnemy(e, dt, player, platforms, aiCfg, phys) {
  const g = phys.gravity;
  const maxFall = phys.maxFall;

  e.phase += dt;
  if (e.flash > 0) e.flash -= dt;
  if (e.hitStun > 0) e.hitStun = Math.max(0, e.hitStun - dt);

  e.vy += g * dt;
  if (e.vy > maxFall) e.vy = maxFall;

  if (e.hitStun > 0) {
    e.vx *= aiCfg.hitStunDecay;
  } else {
    const wantDir = aiHorizontalIntent(e, player, platforms, aiCfg);
    e.vx = wantDir * aiMoveSpeed(e, player, aiCfg);
  }

  e.x += e.vx * dt;
  e.onGround = false;
  e.y += e.vy * dt;

  if (e.vy >= 0 && platforms) {
    for (let i = 0; i < platforms.length; i++) {
      const pl = platforms[i];
      if (e.x + e.w / 2 <= pl.x + 2 || e.x - e.w / 2 >= pl.x + pl.w - 2) continue;
      const prev = e.y - e.vy * dt;
      if (prev <= pl.y + 4 && e.y >= pl.y && e.y <= pl.y + pl.h + 10) {
        e.y = pl.y;
        e.vy = 0;
        e.onGround = true;
        break;
      }
    }
  }

  if (e.y > aiCfg.fallKillY) {
    e.x = e.homeX;
    e.y = e.homeY;
    e.vx = 0;
    e.vy = 0;
    e.onGround = true;
    e.hitStun = 0.3;
  }
}

export function aiPatrolBounds(x, platform, aiCfg) {
  const margin = aiCfg.ledgeMargin + 4;
  const half = aiCfg.patrolHalf;
  if (!platform) {
    return { patrolMin: x - half, patrolMax: x + half };
  }
  return {
    patrolMin: Math.max(platform.x + margin, x - half),
    patrolMax: Math.min(platform.x + platform.w - margin, x + half),
  };
}
