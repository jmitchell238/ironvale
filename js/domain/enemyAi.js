/**
 * Domain: enemy locomotion + awareness (pure).
 * Caller owns entity arrays and side effects.
 */

import { getEnemyMeleeCfg } from '../config/index.js';

/** Boss-style chase / arena walk (not ledge-bound fodder). */
export function enemyIsBossLike(e) {
  if (!e) return false;
  if (e.isBoss) return true;
  const t = e.type;
  return t === 'boss' || t === 'bandit_captain'
    || t === 'skeleton_champion' || t === 'ogre_warchief';
}

/**
 * Uses windup → active hit → recover instead of contact-only damage.
 * Bandit / skeleton / ogre / bosses; slimes stay contact-only.
 */
export function enemyUsesTelegraphedAttack(e) {
  if (!e) return false;
  if (e.hasMelee || e.hasSlam) return true;
  return !!getEnemyMeleeCfg(e);
}

/** @deprecated Prefer enemyUsesTelegraphedAttack — same meaning. */
export function enemyUsesTelegraphedSlam(e) {
  return enemyUsesTelegraphedAttack(e);
}

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

  // Fresh spawn: patrol only, no chase
  if (e.spawnGrace != null && e.spawnGrace > 0) {
    if (e.x <= e.patrolMin) e.facing = 1;
    else if (e.x >= e.patrolMax) e.facing = -1;
    else if (!e.facing) e.facing = -1;
    return e.facing;
  }

  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const aggro = Math.abs(dx) < aiCfg.aggroX && Math.abs(dy) < aiCfg.aggroY;
  let wantDir = 0;

  const bossLike = enemyIsBossLike(e);

  if (bossLike) {
    // Flank slightly — keep pressure without overlapping the player center.
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
      if (!aggro && !bossLike) {
        e.facing = -e.facing || 1;
        e.patrolMin = Math.min(e.patrolMin, e.x);
        e.patrolMax = Math.max(e.patrolMax, e.x);
      }
    }
    const pl = aiPlatformUnder(e, platforms);
    // Bosses may walk full arena floor; fodder stays ledge-safe.
    if (pl && !bossLike) {
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
  const bossLike = enemyIsBossLike(e);
  let speed = e.speed;
  if (!aggro && !bossLike) speed *= aiCfg.patrolSpeedMul;
  return speed;
}

/**
 * Telegraphed melee state machine (pure). Mutates e.slam* fields.
 * Shared by light slashes (bandit) and heavy slams (war-chief).
 * @param {object} [meleeCfg] - ENEMY_MELEE profile; defaults via getEnemyMeleeCfg(e)
 * @returns {{ hit: true, damage: number, knockback: number, dir: number } | null}
 */
export function tickEnemySlam(e, dt, player, meleeCfg) {
  const cfg = meleeCfg || getEnemyMeleeCfg(e);
  if (!enemyUsesTelegraphedAttack(e) || !cfg) return null;

  if (!e.slamState) e.slamState = 'idle';
  if (e.slamCd == null) e.slamCd = 0;
  if (e.slamT == null) e.slamT = 0;

  if (e.slamCd > 0) e.slamCd = Math.max(0, e.slamCd - dt);

  // Spawn grace: no windup while newly spawned
  if (e.spawnGrace != null && e.spawnGrace > 0) return null;

  const dx = player.x - e.x;
  const dy = (player.y || 0) - e.y;
  const distX = Math.abs(dx);
  const aggroY = cfg.aggroY != null ? cfg.aggroY : 55;
  const inRange = distX <= cfg.range && Math.abs(dy) <= aggroY;
  const dir = dx >= 0 ? 1 : -1;

  if (e.slamState === 'idle') {
    if (e.slamCd <= 0 && e.hitStun <= 0 && inRange) {
      e.slamState = 'windup';
      e.slamT = cfg.windup;
      e.slamHitDone = false;
      e.facing = dir;
    }
    return null;
  }

  if (e.slamState === 'windup') {
    e.slamT -= dt;
    e.facing = dir; // track player during windup
    if (e.slamT <= 0) {
      e.slamState = 'slam';
      e.slamT = cfg.active;
      e.slamHitDone = false;
    }
    return null;
  }

  if (e.slamState === 'slam') {
    e.slamT -= dt;
    let result = null;
    if (!e.slamHitDone) {
      // Active frames: hit if still in melee range (not necessarily still facing)
      const stillClose = distX <= cfg.range * 1.05 && Math.abs(dy) <= aggroY + 10;
      if (stillClose) {
        e.slamHitDone = true;
        const baseDmg = e.damage != null ? e.damage : 24;
        result = {
          hit: true,
          damage: Math.floor(baseDmg * (cfg.damageMul != null ? cfg.damageMul : 1)),
          knockback: cfg.knockback != null ? cfg.knockback : 200,
          dir: e.facing || dir,
        };
      }
    }
    if (e.slamT <= 0) {
      e.slamState = 'recover';
      e.slamT = cfg.recover;
    }
    return result;
  }

  if (e.slamState === 'recover') {
    e.slamT -= dt;
    if (e.slamT <= 0) {
      e.slamState = 'idle';
      e.slamCd = cfg.cooldown;
      e.slamT = 0;
    }
    return null;
  }

  e.slamState = 'idle';
  return null;
}

/** True while melee windup/active/recover freezes locomotion. */
export function enemySlamBusy(e) {
  if (!e || !e.slamState) return false;
  return e.slamState === 'windup' || e.slamState === 'slam' || e.slamState === 'recover';
}

/**
 * @param {object} phys - { gravity, maxFall }
 * @param {object} [meleeCfg] - optional ENEMY_MELEE / BOSS_SLAM override
 * @returns {{ hit: true, damage: number, knockback: number, dir: number } | null}
 */
export function aiUpdateEnemy(e, dt, player, platforms, aiCfg, phys, meleeCfg) {
  const g = phys.gravity;
  const maxFall = phys.maxFall;

  e.phase += dt;
  if (e.flash > 0) e.flash -= dt;
  if (e.hitStun > 0) e.hitStun = Math.max(0, e.hitStun - dt);
  if (e.spawnGrace != null && e.spawnGrace > 0) {
    e.spawnGrace = Math.max(0, e.spawnGrace - dt);
  }

  e.vy += g * dt;
  if (e.vy > maxFall) e.vy = maxFall;

  const busy = enemySlamBusy(e);

  if (e.hitStun > 0) {
    e.vx *= aiCfg.hitStunDecay;
  } else if (busy) {
    e.vx = 0;
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
    if (enemyUsesTelegraphedAttack(e)) {
      e.slamState = 'idle';
      e.slamT = 0;
      e.slamCd = 0.4;
    }
  }

  return tickEnemySlam(e, dt, player, meleeCfg || getEnemyMeleeCfg(e));
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
