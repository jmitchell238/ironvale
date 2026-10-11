/**
 * Projectile system — enemy shots in flight: sword cuts, wall and knight hits.
 */

import { MAX_PROJECTILES } from '../../config/index.js';
import { cutProjectiles, tickProjectiles } from '../../domain/projectiles.js';
import { getPlayerBodyBox } from '../../domain/combat.js';

/**
 * @param {import('../GameSession.js').GameSession} session
 * @param {object} shot - a projectile from makeProjectile()
 */
export function spawnProjectile(session, shot) {
  if (session.projectiles.length >= MAX_PROJECTILES) return;
  session.projectiles.push(shot);
}

/**
 * @param {import('../GameSession.js').GameSession} session
 * @param {number} dt
 */
export function updateProjectiles(session, dt) {
  const list = session.projectiles;
  const p = session.player;
  if (!list.length || !p || session.screen !== 'play') return;

  // The swing destroys any shot inside its box.
  if (p.attacking) {
    for (const c of cutProjectiles(list, session.getAttackBoxForPlayer())) {
      session.burst(c.x, c.y, '#ffb030', 8, 120);
      session.spark(c.x, c.y, p.facing || 1);
      session.audio.hit();
    }
  }

  const events = tickProjectiles(list, dt, {
    solids: session.level?.solids,
    bounds: session.level?.bounds,
    target: getPlayerBodyBox(p),
    canHurt: !(p.inv > 0),
  });
  for (const ev of events) {
    const s = ev.p;
    if (ev.type === 'hit') {
      session.burst(s.x, s.y, '#ff7a2a', 10, 130);
      session.hurtPlayer(s.damage);
      const dir = Math.sign(s.vx) || 1;
      p.vx = dir * 120;
      p.vy = -160;
      p.onGround = false;
      if (session.screen !== 'play') return;
    } else if (ev.type === 'wall') {
      session.burst(s.x, s.y, '#ff7a2a', 6, 90);
    }
  }
}
