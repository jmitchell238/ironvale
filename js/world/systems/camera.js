/**
 * Camera system — follow player on X and Y, clamp to phase bounds.
 */

import { CAM, W, H } from '../../config/index.js';
import { clamp, lerp } from '../../core/math.js';
import { cameraLimits } from '../../domain/levels.js';

/**
 * Camera clamp for current phase (arena or level).
 * @param {import('../GameSession.js').GameSession} session
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
 */
export function getCameraBounds(session) {
  if (session.arena) {
    return {
      minX: session.arena.minX,
      maxX: Math.max(session.arena.minX, session.arena.maxX - W),
      minY: session.arena.minY != null ? session.arena.minY : (session.level?.bounds?.minY || 0),
      maxY: session.arena.maxY != null
        ? Math.max(session.arena.minY || 0, session.arena.maxY - H)
        : cameraLimits(session.level || { bounds: { minX: 0, maxX: W, minY: 0, maxY: H } }, W, H).maxY,
    };
  }
  if (session.level) return cameraLimits(session.level, W, H);
  return { minX: 0, maxX: 1e9, minY: 0, maxY: 1e9 };
}

/**
 * @param {import('../GameSession.js').GameSession} session
 * @param {number} dt
 */
export function updateCamera(session, dt) {
  const p = session.player;
  if (!p) return;
  const targetX = p.x - CAM.focusX;
  const targetY = p.y - (CAM.focusY != null ? CAM.focusY : H * 0.62);
  const lx = 1 - Math.exp(-(CAM.lerp || 6) * dt);
  const ly = 1 - Math.exp(-(CAM.lerpY != null ? CAM.lerpY : 4.2) * dt);
  session.cameraX = lerp(session.cameraX, targetX, lx);
  session.cameraY = lerp(session.cameraY || 0, targetY, ly);
  const camB = getCameraBounds(session);
  session.cameraX = clamp(session.cameraX, camB.minX, camB.maxX);
  session.cameraY = clamp(session.cameraY, camB.minY, camB.maxY);
  if (p.x - session.cameraX < 40) {
    session.cameraX = clamp(p.x - 40, camB.minX, camB.maxX);
  }
}
