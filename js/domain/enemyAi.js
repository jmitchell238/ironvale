/**
 * Domain: enemy locomotion + awareness (pure).
 * Caller owns entity arrays and side effects.
 */

import {
  getEnemyMeleeCfg, ENEMY_LUNGE, ENEMY_CAST, ENEMY_SWOOP, ENEMY_CHARGE, ENEMY_BEAST,
} from '../config/index.js';
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
  if (e.hasMelee || e.hasSlam || e.bossAi) return true; // the stage bosses hit only through their own moves
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

/** Charge profile for the Nightmare, else null. */
export function getEnemyChargeCfg(e) {
  return e && e.bossAi === 'charge' && ENEMY_CHARGE[e.type] ? ENEMY_CHARGE[e.type] : null;
}

/** Arena floor limits for a boss's centre: the walls (or its patrol bounds) less half its width. */
function arenaSpan(e, pad) {
  const half = e.w / 2 + pad;
  return {
    lo: (e.arenaMinX != null ? e.arenaMinX : e.patrolMin - 24) + half,
    hi: (e.arenaMaxX != null ? e.arenaMaxX : e.patrolMax + 24) - half,
  };
}

/**
 * Nightmare state machine (pure; it sets e.vx): idle -> windup -> charge -> skid -> recover -> idle.
 * Idle backs away from a knight closer than cfg.runUp to take a run-up. The wind-up is the warning, tracks
 * the knight and nothing interrupts it. The charge keeps the direction locked at its end and runs at the
 * wall, hurting a knight whose body meets the horse's box once (a jump over the low box is safe); the skid
 * eases it to a stop at the wall, and it then stands open to the sword for the recover.
 * Below cfg.enrage.at of its health it charges faster, rears for less and rests less.
 * @returns {{ hit: true, damage: number, knockback: number, dir: number } | null}
 */
export function tickEnemyCharge(e, dt, player, cfg) {
  if (!cfg) return null;
  if (!e.bossState) { e.bossState = 'idle'; e.bossT = 0; e.bossCd = 0.8; }
  if (e.bossCd > 0) e.bossCd = Math.max(0, e.bossCd - dt);
  const rage = e.maxHp > 0 && e.hp / e.maxHp < cfg.enrage.at;
  const speed = cfg.speed * (rage ? cfg.enrage.speed : 1);
  const dx = player.x - e.x;
  const toward = dx >= 0 ? 1 : -1;
  const { lo, hi } = arenaSpan(e, 6);
  let hit = null;
  e.vx = 0;

  if (e.bossState === 'idle') {
    e.facing = toward;
    if (e.spawnGrace > 0 || e.bossCd > 0) return null;
    const room = toward > 0 ? e.x - lo : hi - e.x; // floor behind the horse, away from the knight
    if (Math.abs(dx) < cfg.runUp && room > 8) {
      e.facing = -toward; // it turns and trots to the far side
      e.vx = -toward * Math.min(cfg.pace, room / Math.max(dt, 1e-3));
    } else {
      e.bossState = 'windup';
      e.bossMove = 'charge';
      e.bossT = cfg.windup * (rage ? cfg.enrage.windup : 1);
    }
  } else if (e.bossState === 'windup') {
    e.facing = toward; // tracks the knight until it breaks
    e.bossT -= dt;
    if (e.bossT <= 0) {
      e.chargeDir = toward;
      e.chargeT = 0;
      e.chargeHitDone = false;
      e.bossState = 'charge';
    }
  } else if (e.bossState === 'charge') {
    const dir = e.chargeDir;
    e.facing = dir;
    e.chargeT += dt;
    const v = speed * Math.min(1, 0.3 + 0.7 * e.chargeT / cfg.ramp);
    e.vx = dir * v;
    if (!e.chargeHitDone && bodiesOverlap(e, player)) {
      e.chargeHitDone = true;
      hit = { hit: true, damage: e.damage, knockback: cfg.knockback, dir };
    }
    const left = dir > 0 ? hi - e.x : e.x - lo;
    if (left <= v * cfg.skid / 2) {
      e.skidV = v;
      e.skidDur = Math.max(0.15, 2 * Math.max(left, 0) / v);
      e.bossT = e.skidDur;
      e.bossState = 'skid';
    }
  } else if (e.bossState === 'skid') {
    e.facing = e.chargeDir;
    e.bossT -= dt;
    e.vx = e.chargeDir * e.skidV * Math.max(0, e.bossT / e.skidDur);
    // A knight standing near the end wall is reached while the horse is still sliding, so the slide hurts too.
    if (!e.chargeHitDone && Math.abs(e.vx) > 60 && bodiesOverlap(e, player)) {
      e.chargeHitDone = true;
      hit = { hit: true, damage: e.damage, knockback: cfg.knockback, dir: e.chargeDir };
    }
    if (e.bossT <= 0) {
      e.vx = 0;
      e.bossState = 'recover';
      e.bossT = cfg.recover * (rage ? cfg.enrage.recover : 1);
    }
  } else if (e.bossState === 'recover') {
    e.facing = toward;
    e.bossT -= dt;
    if (e.bossT <= 0) {
      e.bossState = 'idle';
      e.bossCd = cfg.cooldown;
    }
  }
  // Never carry the horse's body into a wall, whatever the step size.
  const nx = e.x + e.vx * dt;
  if (nx < lo) e.vx = (lo - e.x) / dt;
  else if (nx > hi) e.vx = (hi - e.x) / dt;
  return hit;
}

/** Hell Beast profile, else null. */
export function getEnemyBeastCfg(e) {
  return e && e.bossAi === 'beast' && ENEMY_BEAST[e.type] ? ENEMY_BEAST[e.type] : null;
}

/** The beast's spit: one fireball flat at the knight's chest, or (arc) a staggered line of lobs around the knight. */
function beastShots(e, player, cfg, arc) {
  const dir = player.x >= e.x ? 1 : -1;
  const x0 = e.x + dir * e.w * 0.4;
  const y0 = e.y - e.h * cfg.spit.muzzle;
  const ty = (player.y || 0) - (player.h || 70) * 0.5;
  const damage = Math.round(e.damage * cfg.spit.damageMul);
  if (!arc) {
    const d = Math.hypot(player.x - x0, ty - y0) || 1;
    return [makeProjectile('fireball', {
      x: x0, y: y0, vx: (player.x - x0) / d * cfg.spit.speed, vy: (ty - y0) / d * cfg.spit.speed,
      damage, owner: e.type,
    })];
  }
  const a = cfg.arc;
  const out = [];
  for (let i = 0; i < a.count; i++) {
    const tx = player.x + (i - (a.count - 1) / 2) * a.spread;
    const T = a.flight[i % a.flight.length];
    out.push(makeProjectile('fireball', {
      x: x0, y: y0, vx: (tx - x0) / T, vy: (ty - y0 - 0.5 * a.gravity * T * T) / T, g: a.gravity,
      damage, owner: e.type,
    }));
  }
  return out;
}

/**
 * Hell Beast state machine (pure; it stays put): emerge -> idle -> windup -> (recover | act -> recover) -> idle,
 * and every cfg.relocate.every attacks idle -> sink -> hidden -> emerge on the far side from the knight.
 * e.vis (0 sunk, 1 up) drives the drawing; below 0.3 the beast cannot be hit. The wind-ups are the warnings
 * and nothing interrupts them. The burn is a hit returned like a melee hit: a knight inside the pillar's
 * half-width while it is up gets hurt once. Spits go out as e.shot (an array).
 * @returns {{ hit: true, damage: number, knockback: number, dir: number } | null}
 */
export function tickEnemyBeast(e, dt, player, cfg) {
  if (!cfg) return null;
  if (!e.bossState) {
    e.bossState = 'emerge';
    e.bossDur = e.bossT = cfg.emerge;
    e.bossCd = 0;
    e.bossCount = 0;
    e.spits = 0;
  }
  if (e.bossCd > 0) e.bossCd = Math.max(0, e.bossCd - dt);
  const dx = player.x - e.x;
  const toward = dx >= 0 ? 1 : -1;
  const rage = e.maxHp > 0 && e.hp / e.maxHp < cfg.arc.at;
  const { lo, hi } = arenaSpan(e, cfg.edge);
  let hit = null;
  e.vx = 0;

  if (e.bossState === 'emerge') {
    e.bossT -= dt;
    e.vis = 1 - Math.max(0, e.bossT) / e.bossDur;
    if (e.bossT <= 0) { e.bossState = 'idle'; e.bossCd = 0.6; }
  } else if (e.bossState === 'idle') {
    e.vis = 1;
    e.facing = toward;
    if (e.spawnGrace > 0 || e.bossCd > 0) return null;
    if (e.bossCount >= cfg.relocate.every) {
      e.bossCount = 0;
      e.bossState = 'sink';
      e.bossDur = e.bossT = cfg.relocate.sink;
    } else if (Math.abs(dx) <= cfg.burn.reach) {
      e.bossState = 'windup';
      e.bossMove = 'burn';
      e.bossT = cfg.burn.windup;
    } else if (Math.abs(dx) <= cfg.range && Math.abs((player.y || 0) - e.y) <= cfg.aggroY) {
      e.bossState = 'windup';
      e.bossMove = 'spit';
      e.bossT = cfg.spit.windup;
    }
  } else if (e.bossState === 'windup') {
    e.facing = toward; // tracks the knight until it fires
    e.bossT -= dt;
    if (e.bossT <= 0 && e.bossMove === 'spit') {
      e.shot = beastShots(e, player, cfg, rage && e.spits % 2 === 1);
      e.spits++;
      e.bossCount++;
      e.bossState = 'recover';
      e.bossT = cfg.spit.recover;
    } else if (e.bossT <= 0) {
      e.burnHitDone = false;
      e.bossState = 'act';
      e.bossT = cfg.burn.active;
    }
  } else if (e.bossState === 'act') {
    e.bossT -= dt;
    if (!e.burnHitDone && Math.abs(dx) <= cfg.burn.half + (player.w || 26) / 2) {
      e.burnHitDone = true;
      hit = {
        hit: true, damage: Math.round(e.damage * cfg.burn.damageMul),
        knockback: cfg.burn.knockback, dir: toward,
      };
    }
    if (e.bossT <= 0) {
      e.bossCount++;
      e.bossState = 'recover';
      e.bossT = cfg.burn.recover;
    }
  } else if (e.bossState === 'recover') {
    e.bossT -= dt;
    if (e.bossT <= 0) {
      e.bossState = 'idle';
      e.bossCd = rage ? cfg.rageCooldown : cfg.cooldown;
    }
  } else if (e.bossState === 'sink') {
    e.bossT -= dt;
    e.vis = Math.max(0, e.bossT) / e.bossDur;
    if (e.bossT <= 0) {
      // Out of sight: surface on the side of the floor farthest from the knight.
      e.x = player.x < (lo + hi) / 2 ? hi : lo;
      e.bossState = 'hidden';
      e.bossT = cfg.relocate.hidden;
    }
  } else if (e.bossState === 'hidden') {
    e.vis = 0;
    e.bossT -= dt;
    if (e.bossT <= 0) {
      e.bossState = 'emerge';
      e.bossDur = e.bossT = cfg.relocate.emerge;
    }
  }
  e.untargetable = (e.vis != null ? e.vis : 1) < 0.3;
  return hit;
}

/** Swoop profile for fliers that dive at the knight (fire skull, angel), else null. */
export function getEnemySwoopCfg(e) {
  return e && e.swoops && ENEMY_SWOOP[e.type] ? ENEMY_SWOOP[e.type] : null;
}

/** True while the skull is igniting or diving (it is drawn aflame). */
export function enemySwoopBusy(e) {
  return !!e && (e.swoopState === 'windup' || e.swoopState === 'dash');
}

function bodiesOverlap(e, p) {
  const pw = p.w || 26;
  const ph = p.h || 70;
  return Math.abs(p.x - e.x) < (e.w + pw) / 2 && p.y > e.y - e.h && p.y - ph < e.y;
}

/** The angel's fan of bolts, aimed at the knight's chest and spread evenly about that line. */
function angelVolley(e, player, v) {
  const x0 = e.x;
  const y0 = e.y - e.h * 0.55;
  const base = Math.atan2((player.y || 0) - (player.h || 70) * 0.5 - y0, player.x - x0);
  const out = [];
  for (let i = 0; i < v.count; i++) {
    const a = base + (i - (v.count - 1) / 2) * v.spread;
    out.push(makeProjectile(v.projectile, {
      x: x0, y: y0, vx: Math.cos(a) * v.speed, vy: Math.sin(a) * v.speed,
      damage: Math.round(e.damage * v.damageMul), owner: e.type,
    }));
  }
  return out;
}

/**
 * Swoop state machine (pure; it also moves the flier): hover -> windup -> dash -> return -> hover.
 * Hovering keeps above the knight. The wind-up is the warning, tracks the knight and is
 * cancelled by a hit (unless cfg.noFlinch). The dash line is fixed at the end of the wind-up, so it cannot steer
 * (and a knight who moves away is simply missed). Then it drifts back up and waits out the cooldown.
 * e.y is the bottom of the sprite; the skull's centre is e.h / 2 above it.
 * With cfg.landing (the angel) the dive ends with her feet on the floor (e.floorY, else the knight's feet),
 * she rests there for cfg.land, and below cfg.volley.at of her health every other attack is a fan of bolts
 * (set as e.shot, an array) from the hover instead of a dive. With cfg.hitDash only the dive hurts, and
 * the hit is returned like a melee hit (a flier with no hitDash hurts by contact instead).
 * @returns {{ hit: true, damage: number, knockback: number, dir: number } | null}
 */
export function tickEnemySwoop(e, dt, player, cfg) {
  if (!cfg) return null;
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
  let hit = null;

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
    if (e.isBoss) e.x = Math.min(Math.max(e.x, e.patrolMin), e.patrolMax); // a boss stays in its arena
    const cy = e.y - e.h / 2;
    const d = Math.hypot(player.x - e.x, (player.y || 0) - (player.h || 70) / 2 - cy);
    if (e.swoopCd <= 0 && e.hitStun <= 0 && !(e.spawnGrace > 0) && d <= cfg.range && d >= cfg.minDist) {
      const rage = cfg.volley && e.maxHp > 0 && e.hp / e.maxHp < cfg.volley.at;
      e.swoopMove = rage && (e.swoopCount || 0) % 2 === 1 ? 'volley' : 'dive';
      e.swoopCount = (e.swoopCount || 0) + 1;
      e.swoopState = 'windup';
      e.swoopT = e.swoopMove === 'volley' ? cfg.volley.windup : cfg.windup;
      e.vx = 0;
    }
  } else if (e.swoopState === 'windup') {
    e.vx = 0;
    e.facing = dx >= 0 ? 1 : -1;
    if (e.hitStun > 0 && !cfg.noFlinch) {
      e.swoopState = 'hover';
      e.swoopCd = Math.max(e.swoopCd, 0.8);
      return null;
    }
    e.swoopT -= dt;
    if (e.swoopT <= 0 && e.swoopMove === 'volley') {
      e.shot = angelVolley(e, player, cfg.volley);
      e.swoopState = 'return';
      e.swoopT = cfg.volley.recover;
    } else if (e.swoopT <= 0) {
      const tx = player.x - e.x;
      const ty = (player.y || 0) - (player.h || 70) / 2 - (e.y - e.h / 2);
      const d = Math.hypot(tx, ty) || 1;
      e.swoopDir = { x: tx / d, y: ty / d };
      e.swoopLeft = d + cfg.overshoot;
      // The skull never dives below the knight's feet; a lander stops with her own feet on the floor.
      e.swoopFloor = cfg.landing ? (e.floorY != null ? e.floorY : player.y || 0) : (player.y || 0) - 8;
      e.facing = tx >= 0 ? 1 : -1;
      e.swoopHitDone = false;
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
    if (cfg.hitDash && !e.swoopHitDone && bodiesOverlap(e, player)) {
      e.swoopHitDone = true;
      hit = {
        hit: true, damage: Math.round(e.damage * (cfg.damageMul || 1)),
        knockback: cfg.knockback || 300, dir: Math.sign(e.swoopDir.x) || 1,
      };
    }
    const floor = e.swoopFloor + (cfg.landing ? 0 : e.h / 2);
    if (e.swoopLeft <= 0 || e.swoopT >= cfg.maxDash || e.y >= floor) {
      e.vx = 0;
      if (cfg.landing && e.y >= floor - 4) {
        e.y = floor;
        e.swoopState = 'land';
        e.swoopT = cfg.land;
      } else {
        e.swoopState = 'return';
        e.swoopT = cfg.recover;
      }
    }
  } else if (e.swoopState === 'land') {
    e.vx = 0;
    e.swoopT -= dt;
    if (e.swoopT <= 0) {
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
  return hit;
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
      const swoopHit = tickEnemySwoop(e, dt, player, swoopCfg);
      e.vy = 0;
      return swoopHit;
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
  const chargeCfg = getEnemyChargeCfg(e);
  const beastCfg = getEnemyBeastCfg(e);
  let bossHit = null;
  if (chargeCfg) bossHit = tickEnemyCharge(e, dt, player, chargeCfg);
  else if (beastCfg) bossHit = tickEnemyBeast(e, dt, player, beastCfg);

  e.vy += g * dt;
  if (e.vy > maxFall) e.vy = maxFall;

  const busy = enemySlamBusy(e);

  if (chargeCfg || beastCfg) {
    // The boss state machine has already set e.vx: a hit never knocks these bosses about or cancels a move.
  } else if (e.hitStun > 0) {
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

  return bossHit || tickEnemySlam(e, dt, player, meleeCfg || getEnemyMeleeCfg(e));
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
