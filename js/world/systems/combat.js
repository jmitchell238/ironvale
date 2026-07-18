/**
 * Combat system — melee swings, hit resolution, kills, XP from combat.
 */

import {
  PLAYER_SWORD, MAX_COINS, enemyIsBoss, JUICE,
} from '../../config/index.js';
import { rand } from '../../core/math.js';
import {
  beginMeleeAttack, resolveMeleeHits, getAttackBox,
} from '../../domain/combat.js';
import { applyXp, xpToNext } from '../../domain/rpg.js';

/**
 * @param {import('../GameSession.js').GameSession} session
 * @param {object} [p]
 */
export function getAttackBoxForPlayer(session, p = session.player) {
  return getAttackBox(p, session.stats, PLAYER_SWORD);
}

/**
 * Brief freeze-frame on hit (juice).
 * @param {import('../GameSession.js').GameSession} session
 * @param {number} seconds
 */
export function applyHitstop(session, seconds) {
  const t = Math.max(0, Number(seconds) || 0);
  if (t <= 0) return;
  session.hitstop = Math.max(session.hitstop || 0, t);
}

/**
 * @param {import('../GameSession.js').GameSession} session
 */
export function applyAttackHits(session) {
  const p = session.player;
  if (!p) return;
  const result = resolveMeleeHits(p, session.enemies, session.stats, PLAYER_SWORD);
  if (!result.hitAny) return;
  let anyKill = false;
  let anyBoss = false;
  for (const hit of result.hits) {
    session.audio.hit();
    session.burst(hit.enemy.x, hit.enemy.y - hit.enemy.h / 2, '#f5e6c8', 10, 120);
    session.burst(hit.enemy.x, hit.enemy.y - hit.enemy.h / 2, '#c9a227', 4, 80);
    if (hit.killed) {
      anyKill = true;
      if (enemyIsBoss(hit.enemy)) anyBoss = true;
      killEnemy(session, hit.enemy, hit.index);
    }
  }
  session.shake = Math.max(session.shake, p.attackAir ? 1.8 : 1.25);
  if (anyBoss) applyHitstop(session, JUICE.hitstopBoss);
  else if (anyKill) applyHitstop(session, JUICE.hitstopHeavy);
  else applyHitstop(session, JUICE.hitstopLight);
}

/**
 * @param {import('../GameSession.js').GameSession} session
 */
export function doAttack(session) {
  const p = session.player;
  if (!p) return;
  if (!beginMeleeAttack(p, session.stats, PLAYER_SWORD)) return;
  session.audio.slash();
  applyAttackHits(session);
}

/**
 * @param {import('../GameSession.js').GameSession} session
 * @param {object} e
 * @param {number} idx
 */
export function killEnemy(session, e, idx) {
  session.score += e.score;
  session.kills += 1;
  const isBoss = enemyIsBoss(e);
  const burstN = isBoss ? JUICE.bossKillBurstN : JUICE.killBurstN;
  session.burst(e.x, e.y - e.h / 2, e.color, burstN, isBoss ? 180 : 150);
  session.burst(e.x, e.y - e.h / 2, '#f5e6c8', isBoss ? 16 : 6, 100);
  session.audio.explode(isBoss);
  session.shake = Math.max(session.shake, isBoss ? 3.4 : 1.4);
  const n = isBoss ? 6 : e.type === 'ogre' ? 3 : 1;
  for (let i = 0; i < n && session.coins.length < MAX_COINS; i++) {
    session.coins.push({
      x: e.x + rand(-10, 10), y: e.y - e.h / 2,
      vx: rand(-50, 50), vy: rand(-160, -40),
      r: 7, xp: Math.max(1, Math.floor(e.xp / n) || 1), life: 14,
    });
  }
  session.enemies.splice(idx, 1);
  if (isBoss) {
    session.bossDefeated = true;
    session.clearLevel();
  }
}

/**
 * Grant XP (kills / coins / clear bonus).
 * Mid-stage level-ups only bank unspent points — no blessing cards.
 * @param {import('../GameSession.js').GameSession} session
 * @param {number} amount
 */
export function addXp(session, amount) {
  if (amount <= 0 || !session.meta) return;
  const before = session.meta.unspentPoints;
  const { levelsGained } = applyXp(session.meta, amount);
  session.pointsBankedThisStage += Math.max(0, session.meta.unspentPoints - before);
  // Sync player HUD XP fields
  const p = session.player;
  if (p) {
    p.level = session.meta.level;
    p.xp = session.meta.xp;
    p.xpNext = xpToNext(session.meta.level);
  }
  if (levelsGained > 0) {
    session.audio.levelUp();
    session.persistMeta();
  }
}
