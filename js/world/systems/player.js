/**
 * Player system — movement integration, hurt, invuln tick.
 */

import { PLAYER_MOVE, PLAYER_SWORD } from '../../config/index.js';
import { hasMeleePriority } from '../../domain/combat.js';
import { integratePlayerMovement, playerCx, playerCy } from '../../domain/player.js';

/**
 * Integrate player movement for one frame.
 * Bounds / hit-follow-through go through session facade (avoids systems cycles).
 * @param {import('../GameSession.js').GameSession} session
 * @param {number} dt
 * @param {{ x: number, y: number, jump: boolean }} input
 */
export function updatePlayer(session, dt, input) {
  const bounds = session.getPlayerBounds();
  const move = integratePlayerMovement(dt, {
    ix: input.x,
    iy: input.y,
    wantJump: input.jump,
  }, {
    player: session.player,
    stats: session.stats,
    platforms: session.platforms,
    cameraX: session.cameraX,
    jumpBuffered: session.jumpBuffered,
    jumpHeld: session.jumpHeld,
    swordCfg: PLAYER_SWORD,
    worldMinX: bounds.minX,
    worldMaxX: bounds.maxX,
    onJump: () => session.audio.jump(),
    onFellOff: () => hurtPlayer(session, 25),
  });
  session.jumpBuffered = move.jumpBuffered;
  if (move.stillSwinging && !session.player.attackHitDone) {
    session.applyAttackHits();
  }
}

/**
 * @param {import('../GameSession.js').GameSession} session
 * @param {number} dmg
 */
export function hurtPlayer(session, dmg) {
  const p = session.player;
  if (!p || p.inv > 0) return;
  if (hasMeleePriority(p, session.stats, PLAYER_SWORD)) return;
  p.hp -= dmg;
  p.inv = PLAYER_MOVE.invuln;
  session.shake = Math.max(session.shake, 2);
  session.audio.hurt();
  session.burst(playerCx(p), playerCy(p), '#e74c3c', 8, 100);
  if (p.hp <= 0) {
    p.hp = 0;
    session.endRun('Fallen in battle!');
  }
}

/**
 * @param {import('../GameSession.js').GameSession} session
 * @param {number} dt
 */
export function tickPlayerInvuln(session, dt) {
  if (session.player && session.player.inv > 0) {
    session.player.inv -= dt;
  }
}

/**
 * @param {import('../GameSession.js').GameSession} session
 * @param {boolean} held
 */
export function setJumpHeld(session, held) {
  session.jumpHeld = !!held;
}

/**
 * @param {import('../GameSession.js').GameSession} session
 */
export function requestJump(session) {
  session.jumpBuffered = PLAYER_MOVE.jumpBuffer;
}
