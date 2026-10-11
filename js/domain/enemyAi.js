/**
 * Domain: enemy locomotion + awareness (pure).
 * Caller owns entity arrays and side effects.
 */

import { getEnemyMeleeCfg, ENEMY_LUNGE, ENEMY_CAST, ENEMY_SWOOP } from '../config/index.js';
import { makeProjectile } from './projectiles.js';

/** Boss-style chase / arena walk (not ledge-bound fodder). */
export function enemyIsBossLike(e) {
  if (!e) return false;
  if (e.isBoss) return true;
  const t = e.type;
  return t === 'iron_warden' || t === 'boss';
}

export function enemyFlies(e) {
  return !!(e && (e.fly || e.flying));
}

/**
 * Uses windup → active hit → recover instead of contact-only damage.
 * Goblin / shield skeleton / Iron Warden; bats stay contact-only.
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

/** Leap profile for enemies that lunge (hell hound), else null. */
export function getEnemyLungeCfg(e) {
  return e && e.lunges && ENEMY_LUNGE[e.type] ? ENEMY_LUNGE[e.type] : null;
}

/** True while the lunge crouch, leap or recovery owns the enemy's movement. */
export function enemyLungeBusy(e) {
  return !!e && !!e.lungeState && e.lungeState !== 'idle';
}

/**
 * Lunge state machine (pure): idle -> crouch -> leap -> recover -> idle.
 * The crouch is the warning and a hit cancels it. The leap is committed: it
 * keeps the direction picked at take-off and lands short of a jumping knight's
 * reach. A cooldown after landing stops it chaining leaps.
 */
export function tickEnemyLunge(e, dt, player, platforms, aiCfg, gravity, cfg) {
  if (!cfg) return;
  if (!e.lungeState) e.lungeState = 'idle';
  if (e.lungeCd == null) e.lungeCd = 0;
  if (e.lungeCd > 0) e.lungeCd = Math.max(0, e.lungeCd - dt);
  const dx = player.x - e.x;
  const dir = dx >= 0 ? 1 : -1;

  if (e.lungeState === 'idle') {
    if (e.lungeCd > 0 || !e.onGround || e.hitStun > 0) return;
    if (e.spawnGrace != null && e.spawnGrace > 0) return;
    const dist = Math.abs(dx);
    if (dist < cfg.min || dist > cfg.max || Math.abs((player.y || 0) - e.y) > cfg.aggroY) return;
    const land = cfg.speed * 2 * cfg.jump / gravity;
    if (!aiCanStandAt(e.x + dir * land * 0.8, e.y, platforms, aiCfg)) return;
    e.lungeState = 'crouch';
    e.lungeT = cfg.crouch;
    e.facing = dir;
    return;
  }

  if (e.hitStun > 0 && (e.lungeState === 'crouch' || e.lungeState === 'leap')) {
    e.lungeState = 'idle';
    e.lungeT = 0;
    e.lungeCd = Math.max(e.lungeCd, 0.8);
    return;
  }

  if (e.lungeState === 'crouch') {
    e.facing = dir; // tracks the knight until it springs
    e.lungeT -= dt;
    if (e.lungeT <= 0) {
      e.lungeState = 'leap';
      e.lungeT = 0;
      e.lungeDir = dir;
      e.vy = -cfg.jump;
      e.onGround = false;
    }
  } else if (e.lungeState === 'leap') {
    e.lungeT += dt;
    if (e.onGround && e.lungeT > 0.1) {
      e.lungeState = 'recover';
      e.lungeT = cfg.recover;
    }
  } else if (e.lungeState === 'recover') {
    e.lungeT -= dt;
    if (e.lungeT <= 0) {
      e.lungeState = 'idle';
      e.lungeT = 0;
      e.lungeCd = cfg.cooldown;
    }
  }
}

/** Cast profile for enemies that throw projectiles (wizard), else null. */
export function getEnemyCastCfg(e) {
  return e && e.casts && ENEMY_CAST[e.type] ? ENEMY_CAST[e.type] : null;
}

/** True while the cast wind-up or recovery owns the enemy's movement. */
export function enemyCastBusy(e) {
  return !!e && !!e.castState && e.castState !== 'idle';
}

/**
 * Cast state machine (pure): idle -> windup -> release -> recover -> idle.
 * It only starts on a knight within range and on the same level. The wind-up is the
 * warning and a hit cancels it. The shot flies the way the wizard faces at release, and
 * the cooldown counts from the release.
 * @returns {object|null} a new projectile on the frame it is released
 */
export function tickEnemyCast(e, dt, player, cfg) {
  if (!cfg) return null;
  if (!e.castState) e.castState = 'idle';
  if (e.castCd == null) e.castCd = 0;
  if (e.castCd > 0) e.castCd = Math.max(0, e.castCd - dt);
  const dx = player.x - e.x;
  const dir = dx >= 0 ? 1 : -1;

  if (e.castState === 'idle') {
    if (e.castCd > 0 || !e.onGround || e.hitStun > 0) return null;
    if (e.spawnGrace != null && e.spawnGrace > 0) return null;
    if (Math.abs(dx) > cfg.range || Math.abs((player.y || 0) - e.y) > cfg.aggroY) return null;
    e.castState = 'windup';
    e.castT = cfg.windup;
    e.facing = dir;
    return null;
  }

  if (e.castState === 'windup' && e.hitStun > 0) {
    e.castState = 'idle';
    e.castT = 0;
    e.castCd = Math.max(e.castCd, 0.9);
    return null;
  }

  if (e.castState === 'windup') {
    e.facing = dir; // tracks the knight until the release
    e.castT -= dt;
    if (e.castT <= 0) {
      e.castState = 'recover';
      e.castT = cfg.recover;
      e.castCd = cfg.cooldown;
      return makeProjectile(cfg.projectile, {
        x: e.x + dir * e.w * 0.55, y: e.y - e.h * cfg.muzzle, vx: dir * cfg.speed,
        damage: Math.round(e.damage * cfg.damageMul), owner: e.type,
      });
    }
  } else if (e.castState === 'recover') {
    e.castT -= dt;
    if (e.castT <= 0) {
      e.castState = 'idle';
      e.castT = 0;
    }
  }
  return null;
}

/**
 * Ground movement for a caster: keeps between cfg.retreat and cfg.range of an engaged
 * knight (steps back when closer, steps in when farther), otherwise patrols.
 * @returns {number} horizontal velocity
 */
export function aiCasterMove(e, player, platforms, aiCfg, cfg) {
  const dx = player.x - e.x;
  const dist = Math.abs(dx);
  const engaged = !(e.spawnGrace > 0) && Math.abs((player.y || 0) - e.y) <= cfg.aggroY
    && dist <= cfg.range + 120;
  if (!engaged) {
    // A knight out of reach never wakes the patrol's chase code
    const away = { x: e.x + 1e6, y: -1e6 };
    return aiHorizontalIntent(e, away, platforms, aiCfg) * e.speed * (aiCfg.patrolSpeedMul || 0.55);
  }
  e.facing = dx >= 0 ? 1 : -1;
  let want = 0;
  if (dist < cfg.retreat) want = -e.facing;
  else if (dist > cfg.range * 0.9) want = e.facing;
  if (want !== 0 && e.onGround
    && !aiCanStandAt(e.x + want * (aiCfg.lookAhead + e.w * 0.25), e.y, platforms, aiCfg)) want = 0;
  return want * e.speed;
}

/** Swoop profile for fliers that dive at the knight (fire skull), else null. */
export function getEnemySwoopCfg(e) {
  return e && e.swoops && ENEMY_SWOOP[e.type] ? ENEMY_SWOOP[e.type] : null;
}

/** True while the skull is igniting or diving (it is drawn aflame). */
export function enemySwoopBusy(e) {
  return !!e && (e.swoopState === 'windup' || e.swoopState === 'dash');
}

/**
 * Fire skull state machine (pure; it also moves the skull): hover -> windup -> dash -> return -> hover.
 * Hovering keeps above the knight. The wind-up is the warning, tracks the knight and is
 * cancelled by a hit. The dash line is fixed at the end of the wind-up, so it cannot steer
 * (and a knight who moves away is simply missed). Then it drifts back up and waits out the cooldown.
 * e.y is the bottom of the sprite; the skull's centre is e.h / 2 above it.
 */
export function tickEnemySwoop(e, dt, player, cfg) {
  if (!cfg) return;
  if (!e.swoopState) e.swoopState = 'hover';
  if (e.swoopCd == null) e.swoopCd = 0;
  if (e.swoopCd > 0) e.swoopCd = Math.max(0, e.swoopCd - dt);
  const homeY = e.homeY != null ? e.homeY : e.y;
  const dx = player.x - e.x;
  const near = Math.abs(dx) < cfg.range + 120 && Math.abs((player.y || 0) - homeY) < 420;
  const hoverY = near
    ? Math.min(Math.max(homeY, player.y - cfg.hoverAbove[1]), player.y - cfg.hoverAbove[0])
    : homeY;
  const settle = (rate) => { e.y += (hoverY + Math.sin(e.phase * 2.4) * 8 - e.y) * Math.min(1, dt * rate); };

  if (e.swoopState === 'hover') {
    settle(3);
    if (near && !(e.spawnGrace > 0)) {
      e.facing = dx >= 0 ? 1 : -1;
      e.vx = Math.abs(dx) > 90 ? e.facing * e.speed * 0.7 : 0;
    } else {
      if (e.x <= e.patrolMin) e.facing = 1;
      else if (e.x >= e.patrolMax) e.facing = -1;
      e.vx = (e.facing || -1) * e.speed * 0.55;
    }
    e.x += e.vx * dt;
    const cy = e.y - e.h / 2;
    const d = Math.hypot(player.x - e.x, (player.y || 0) - (player.h || 70) / 2 - cy);
    if (e.swoopCd <= 0 && e.hitStun <= 0 && !(e.spawnGrace > 0) && d <= cfg.range && d >= cfg.minDist) {
      e.swoopState = 'windup';
      e.swoopT = cfg.windup;
      e.vx = 0;
    }
  } else if (e.swoopState === 'windup') {
    e.vx = 0;
    e.facing = dx >= 0 ? 1 : -1;
    if (e.hitStun > 0) {
      e.swoopState = 'hover';
      e.swoopCd = Math.max(e.swoopCd, 0.8);
      return;
    }
    e.swoopT -= dt;
    if (e.swoopT <= 0) {
      const tx = player.x - e.x;
      const ty = (player.y || 0) - (player.h || 70) / 2 - (e.y - e.h / 2);
      const d = Math.hypot(tx, ty) || 1;
      e.swoopDir = { x: tx / d, y: ty / d };
      e.swoopLeft = d + cfg.overshoot;
      e.swoopFloor = (player.y || 0) - 8; // never dives below the knight's feet
      e.facing = tx >= 0 ? 1 : -1;
      e.swoopState = 'dash';
      e.swoopT = 0;
    }
  } else if (e.swoopState === 'dash') {
    const step = cfg.speed * dt;
    e.x += e.swoopDir.x * step;
    e.y += e.swoopDir.y * step;
    e.vx = e.swoopDir.x * cfg.speed;
    e.swoopLeft -= step;
    e.swoopT += dt;
    if (e.swoopLeft <= 0 || e.swoopT >= cfg.maxDash || e.y >= e.swoopFloor + e.h / 2) {
      e.swoopState = 'return';
      e.swoopT = cfg.recover;
    }
  } else if (e.swoopState === 'return') {
    settle(2.2);
    e.vx = 0;
    e.swoopT -= dt;
    if (e.swoopT <= 0) {
      e.swoopState = 'hover';
      e.swoopT = 0;
      e.swoopCd = cfg.cooldown;
    }
  }
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

  const flying = enemyFlies(e);

  if (flying) {
    e.onGround = false;
    const swoopCfg = getEnemySwoopCfg(e);
    if (swoopCfg) {
      tickEnemySwoop(e, dt, player, swoopCfg);
      e.vy = 0;
      return null;
    }
    const homeY = e.homeY != null ? e.homeY : e.y;
    const bob = Math.sin(e.phase * 2.4) * 18;
    const targetY = homeY + bob;
    if (player && Math.abs(player.x - e.x) < (aiCfg.aggroX || 200)) {
      const swoop = Math.sin(e.phase * 1.6) * 26;
      e.y += ((targetY + swoop) - e.y) * Math.min(1, dt * 3);
      const want = Math.sign(player.x - e.x) || e.facing || -1;
      e.facing = want;
      e.vx = want * e.speed * 0.7;
    } else {
      e.y += (targetY - e.y) * Math.min(1, dt * 2);
      if (e.x <= e.patrolMin) e.facing = 1;
      else if (e.x >= e.patrolMax) e.facing = -1;
      e.vx = (e.facing || -1) * e.speed * (aiCfg.patrolSpeedMul || 0.55);
    }
    e.x += e.vx * dt;
    e.vy = 0;
    return tickEnemySlam(e, dt, player, meleeCfg || getEnemyMeleeCfg(e));
  }

  const lungeCfg = getEnemyLungeCfg(e);
  tickEnemyLunge(e, dt, player, platforms, aiCfg, g, lungeCfg);
  const castCfg = getEnemyCastCfg(e);
  const shot = tickEnemyCast(e, dt, player, castCfg);
  if (shot) e.shot = shot; // the enemy system turns it into a live projectile

  e.vy += g * dt;
  if (e.vy > maxFall) e.vy = maxFall;

  const busy = enemySlamBusy(e);

  if (e.hitStun > 0) {
    e.vx *= aiCfg.hitStunDecay;
  } else if (e.lungeState === 'leap') {
    e.vx = e.lungeDir * lungeCfg.speed;
  } else if (busy || enemyLungeBusy(e) || enemyCastBusy(e)) {
    e.vx = 0;
  } else if (castCfg) {
    e.vx = aiCasterMove(e, player, platforms, aiCfg, castCfg);
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
      if (prev <= pl.y + 10 && e.y >= pl.y) {
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
    if (castCfg) {
      e.castState = 'idle';
      e.castT = 0;
      e.castCd = 0.6;
    }
    if (lungeCfg) {
      e.lungeState = 'idle';
      e.lungeT = 0;
      e.lungeCd = 0.6;
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
