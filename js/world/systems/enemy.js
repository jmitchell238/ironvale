/**
 * Enemy system — spawn, AI tick, contact/melee damage loop.
 */

import {
  ENEMIES, ENEMY_AI, MAX_ENEMIES, GROUND_Y, W, enemyIsBoss, getEnemyMeleeCfg,
  NG_PLUS, PLAYER_MOVE, SPAWN_SAFE,
} from '../../config/index.js';
import { clamp, circleHit, rand } from '../../core/math.js';
import {
  aiUpdateEnemy, aiPatrolBounds, aiCanStandAt, enemyUsesTelegraphedAttack,
} from '../../domain/enemyAi.js';
import { ngPlusDamageMul, ngPlusHpMul } from '../../domain/rpg.js';
import { playerCx, playerCy } from '../../domain/player.js';

/**
 * @param {import('../GameSession.js').GameSession} session
 * @param {number} x
 * @param {number} [preferredY]
 */
export function findPlatformAt(session, x, preferredY) {
  let best = null;
  let bestDist = Infinity;
  for (const pl of session.platforms) {
    if (x < pl.x - 4 || x > pl.x + pl.w + 4) continue;
    const d = preferredY != null ? Math.abs(pl.y - preferredY) : 0;
    if (d < bestDist) {
      bestDist = d;
      best = pl;
    }
  }
  return best;
}

/**
 * @param {import('../GameSession.js').GameSession} session
 * @param {string} type
 * @param {{ x?: number, y?: number, isBoss?: boolean, hasMelee?: boolean, hasSlam?: boolean }} [opts]
 */
export function spawnEnemy(session, type, opts = {}) {
  if (session.enemies.length >= MAX_ENEMIES) return null;
  const def = ENEMIES[type] || ENEMIES.slime;
  const scale = 1 + Math.max(0, (session.wave - 1) * 0.04);
  const ngHp = ngPlusHpMul(session.meta, NG_PLUS);
  const ngDmg = ngPlusDamageMul(session.meta, NG_PLUS);
  let spawnX = opts.x != null
    ? opts.x
    : (session.cameraX + W + rand(20, 80));

  // Never materialize on top of the player — push spawn ahead
  const px = session.player?.x;
  if (px != null && !opts.isBoss && !enemyIsBoss(type) && !def.isBoss) {
    const minAhead = SPAWN_SAFE.minAhead != null ? SPAWN_SAFE.minAhead : 200;
    const jitter = SPAWN_SAFE.leadJitter != null ? SPAWN_SAFE.leadJitter : 90;
    if (spawnX < px + minAhead) {
      spawnX = px + minAhead + rand(0, jitter);
    }
  }

  let pl = findPlatformAt(session, spawnX, opts.y);
  // If safe push left the authored platform, search again near new X
  if (!pl || (opts.y != null && Math.abs(pl.y - opts.y) > 40)) {
    pl = findPlatformAt(session, spawnX, opts.y);
  }
  const margin = ENEMY_AI.ledgeMargin + 4;
  let x, y, homePl;
  if (pl) {
    homePl = pl;
    const minX = pl.x + margin;
    const maxX = pl.x + pl.w - margin;
    x = clamp(spawnX, minX, maxX);
    // If still too close after clamp, walk to platform end ahead of player
    if (px != null && x < px + (SPAWN_SAFE.minAhead || 200) * 0.75 && !def.isBoss) {
      x = Math.min(maxX, Math.max(x, px + 160));
      x = clamp(x, minX, maxX);
    }
    y = pl.y;
  } else {
    x = spawnX;
    y = opts.y != null ? opts.y : GROUND_Y;
    homePl = null;
  }
  const bounds = aiPatrolBounds(x, homePl, ENEMY_AI);
  const bossFlag = !!opts.isBoss || enemyIsBoss(type) || !!def.isBoss;
  const hasMelee = !!(def.hasMelee || def.hasSlam || opts.hasMelee || opts.hasSlam
    || getEnemyMeleeCfg(type));
  const hasSlam = !!(def.hasSlam || opts.hasSlam);
  const meleeCfg = getEnemyMeleeCfg(type);
  // Long first-attack delay so player can read the threat
  let slamCd = 0;
  if (hasMelee) {
    const firstCd = SPAWN_SAFE.firstAttackCd != null ? SPAWN_SAFE.firstAttackCd : 0.85;
    slamCd = bossFlag ? 0.9 : firstCd + Math.random() * 0.35;
  }
  const grace = bossFlag ? 0.35 : (SPAWN_SAFE.grace != null ? SPAWN_SAFE.grace : 1.05);
  const hp = def.hp * scale * ngHp;
  const enemy = {
    type, x, y, w: def.w, h: def.h,
    hp, maxHp: hp,
    speed: def.speed * (0.9 + Math.random() * 0.25),
    score: Math.floor(def.score * (1 + (session.wave - 1) * 0.05)
      * (1 + (session.meta?.ngPlus || 0) * (NG_PLUS.scorePerCycle || 0.1))),
    xp: def.xp, color: def.color, damage: Math.round(def.damage * ngDmg),
    skin: def.skin, frames: def.frames, fw: def.fw, fh: def.fh,
    drawScale: def.drawScale || null,
    label: def.label || null,
    phase: Math.random() * 10, flash: 0, vx: 0, vy: 0,
    onGround: true, facing: -1,
    homeX: x, homeY: y,
    patrolMin: bounds.patrolMin, patrolMax: bounds.patrolMax,
    hitStun: 0,
    isBoss: bossFlag,
    hasMelee,
    hasSlam,
    meleeCfg: meleeCfg || null,
    slamState: 'idle',
    slamT: 0,
    slamCd,
    slamHitDone: false,
    spawnGrace: grace,
  };
  session.enemies.push(enemy);
  return enemy;
}

/**
 * @param {import('../GameSession.js').GameSession} session
 * @param {number} x
 * @param {number} refY
 */
export function canStandAt(session, x, refY) {
  return aiCanStandAt(x, refY, session.platforms, ENEMY_AI);
}

/**
 * @param {import('../GameSession.js').GameSession} session
 * @param {object} e
 * @param {number} dt
 */
export function updateEnemy(session, e, dt) {
  return aiUpdateEnemy(e, dt, session.player, session.platforms, ENEMY_AI, {
    gravity: PLAYER_MOVE.gravity,
    maxFall: PLAYER_MOVE.maxFall,
  }, e.meleeCfg || getEnemyMeleeCfg(e));
}

/**
 * Tick all enemies: AI, cull, telegraphed hits, contact damage.
 * @param {import('../GameSession.js').GameSession} session
 * @param {number} dt
 */
export function updateEnemies(session, dt) {
  if (!session.player || session.screen !== 'play') return;

  const pcx = playerCx(session.player);
  const pcy = playerCy(session.player);

  for (let i = session.enemies.length - 1; i >= 0; i--) {
    const e = session.enemies[i];
    const slamHit = updateEnemy(session, e, dt);
    // Don't cull bosses off-screen; cull far-behind fodder only
    if (!enemyIsBoss(e) && e.x < session.cameraX - 160) {
      session.enemies.splice(i, 1);
      continue;
    }
    if (slamHit && slamHit.hit) {
      // Via session facade to avoid systems import cycles
      session.hurtPlayer(slamHit.damage);
      const kbScale = e.hasSlam ? 0.55 : 0.42;
      session.player.vx = (slamHit.dir || 1) * slamHit.knockback * kbScale;
      session.player.vy = e.hasSlam ? -220 : -160;
      session.player.onGround = false;
      session.shake = Math.max(session.shake, e.hasSlam ? 2.8 : 1.8);
      continue;
    }
    // Melee enemies: damage only from telegraphed attack (not contact-only).
    // Slimes and other contact fodder still use body overlap.
    if (enemyUsesTelegraphedAttack(e)) continue;
    // Spawn grace: contact fodder also waits a beat after popping in
    if (e.spawnGrace != null && e.spawnGrace > 0) continue;
    if (circleHit(pcx, pcy, Math.min(session.player.w, session.player.h) * 0.32, e.x, e.y - e.h / 2, e.w * 0.35)) {
      session.hurtPlayer(e.damage);
      session.player.vx += (session.player.x < e.x ? -1 : 1) * 100;
      session.player.vy = -160;
      session.player.onGround = false;
    }
  }
}
