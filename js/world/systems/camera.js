/**
 * Camera system — follow player + clamp to phase bounds.
 * Mutates session.cameraX only.
 */

import { CAM, W } from '../../config/index.js';
import { clamp, lerp } from '../../core/math.js';
import { cameraLimits } from '../../domain/levels.js';

/**
 * Camera clamp for current phase (arena or level).
 * @param {import('../GameSession.js').GameSession} session
 * @returns {{ minX: number, maxX: number }}
 */
export function getCameraBounds(session) {
  if (session.arena) {
    return {
      minX: session.arena.minX,
      maxX: Math.max(session.arena.minX, session.arena.maxX - W),
    };
  }
  if (session.level) return cameraLimits(session.level, W);
  return { minX: 0, maxX: 1e9 };
}

/**
 * @param {import('../GameSession.js').GameSession} session
 * @param {number} dt
 */
export function updateCamera(session, dt) {
  const p = session.player;
  if (!p) return;
  const target = p.x - CAM.focusX;
  session.cameraX = lerp(session.cameraX, target, 1 - Math.exp(-CAM.lerp * dt));
  const camB = getCameraBounds(session);
  session.cameraX = clamp(session.cameraX, camB.minX, camB.maxX);
  if (p.x - session.cameraX < 40) {
    session.cameraX = clamp(p.x - 40, camB.minX, camB.maxX);
  }
}
