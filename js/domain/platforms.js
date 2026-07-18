/**
 * Domain: platform geometry + jump-safe procedural generation (pure helpers).
 */

import { clamp, lerp, rand } from '../core/math.js';
import {
  GROUND_Y, PLAY, JUMP_SAFE, MAX_PLATFORMS, W,
  maxJumpHeight, maxJumpDistance,
} from '../config/index.js';

/**
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {{ style?: string, h?: number }} [opts]
 */
export function makePlatform(x, y, w, opts = {}) {
  const ground = y >= GROUND_Y - 2;
  const minW = JUMP_SAFE.minWidth != null ? JUMP_SAFE.minWidth : 56;
  const style = opts.style || (ground ? 'ground' : 'float');
  const h = opts.h != null
    ? opts.h
    : (ground ? 28 : style === 'stone' ? 18 : 16);
  return {
    x,
    y: clamp(y, PLAY.top + 90, GROUND_Y),
    w: Math.max(minW, w),
    h,
    ground,
    style,
  };
}

/**
 * Build platforms from level def entries (supports optional style/h).
 * @param {{ x: number, y: number, w: number, style?: string, h?: number }[]} list
 */
export function buildPlatformsFromDefs(list) {
  return (list || []).map(p => makePlatform(p.x, p.y, p.w, {
    style: p.style,
    h: p.h,
  }));
}

export function canReachPlatform(from, to, jumpMul = 1, speedMul = 1) {
  if (!from || !to) return false;
  const rise = from.y - to.y;
  const peak = maxJumpHeight(jumpMul);
  if (rise > peak * 0.92) return false;
  if (rise > peak * JUMP_SAFE.riseFrac) return false;
  if (rise < -JUMP_SAFE.maxDrop) return false;
  const gap = to.x - (from.x + from.w);
  if (gap <= 0) return true;
  const baseDist = maxJumpDistance(jumpMul, speedMul);
  let gapFrac = JUMP_SAFE.gapFracSame;
  if (rise > 12) gapFrac = JUMP_SAFE.gapFracUp;
  else if (rise < -30) gapFrac = JUMP_SAFE.gapFracDown;
  if (rise > 0) gapFrac *= lerp(1, 0.72, clamp(rise / (peak * JUMP_SAFE.riseFrac), 0, 1));
  return gap <= baseDist * gapFrac;
}

/**
 * Linear left→right chain (ground path). Floating platforms above ground
 * with overlapping X ranges are skipped when testing main-path continuity.
 */
export function platformsChainReachable(list, jumpMul = 1, speedMul = 1) {
  if (!list || list.length < 2) return true;
  // Prefer continuous walk path: ground + stepping stones ordered by x
  // that are not pure optional high-road floaters above continuous ground.
  const sorted = list.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const path = filterMainPath(sorted);
  if (path.length < 2) return true;
  for (let i = 1; i < path.length; i++) {
    if (!canReachPlatform(path[i - 1], path[i], jumpMul, speedMul)) return false;
  }
  return true;
}

/**
 * Drop optional high platforms that sit entirely above a lower platform
 * spanning the same X range (Mario multi-tier: high road is optional).
 * @param {object[]} sorted by x
 */
export function filterMainPath(sorted) {
  const out = [];
  for (const pl of sorted) {
    // Skip if a lower platform covers this x-span (optional high road)
    const covered = sorted.some(other => {
      if (other === pl) return false;
      if (other.y <= pl.y) return false; // other is higher or equal
      // other is lower (larger y) and overlaps X enough
      const overlapL = Math.max(pl.x, other.x);
      const overlapR = Math.min(pl.x + pl.w, other.x + other.w);
      return overlapR - overlapL >= pl.w * 0.55;
    });
    if (!covered) out.push(pl);
  }
  return out.length ? out : sorted;
}

/**
 * Grow platform list ahead of camera. Mutates `state.platforms` and `state.worldGenX`.
 * @param {{ platforms: any[], worldGenX: number, cameraX: number }} state
 */
export function generatePlatformsAhead(state) {
  const ahead = state.cameraX + W * 3 + 200;
  const peak = maxJumpHeight(1);
  const maxRise = peak * JUMP_SAFE.riseFrac;
  const baseDist = maxJumpDistance(1, 1);
  let platforms = state.platforms;
  let worldGenX = state.worldGenX;
  const procMin = JUMP_SAFE.procMinWidth || JUMP_SAFE.minWidth;

  while (worldGenX < ahead && platforms.length < MAX_PLATFORMS) {
    const prev = platforms[platforms.length - 1];
    let placed = null;
    for (let attempt = 0; attempt < 14 && !placed; attempt++) {
      const roll = Math.random();
      let y;
      if (Math.random() < 0.3) y = GROUND_Y;
      else if (roll < 0.4) y = prev.y + rand(-18, 18);
      else if (roll < 0.75) y = prev.y - rand(-40, maxRise * 0.75);
      else y = prev.y - rand(10, maxRise);
      y = clamp(y, GROUND_Y - maxRise * 1.05, GROUND_Y);
      const riseActual = prev.y - y;
      let gapFrac = JUMP_SAFE.gapFracSame;
      if (riseActual > 12) gapFrac = JUMP_SAFE.gapFracUp;
      else if (riseActual < -30) gapFrac = JUMP_SAFE.gapFracDown;
      if (riseActual > 0) gapFrac *= lerp(1, 0.72, clamp(riseActual / maxRise, 0, 1));
      const maxGap = baseDist * gapFrac;
      const gap = rand(JUMP_SAFE.minGap, Math.max(JUMP_SAFE.minGap + 8, maxGap));
      const cand = makePlatform(
        prev.x + prev.w + gap,
        y,
        rand(procMin, JUMP_SAFE.maxWidth),
      );
      if (canReachPlatform(prev, cand, 1, 1)) placed = cand;
    }
    if (!placed) {
      const gap = rand(JUMP_SAFE.minGap, Math.min(56, baseDist * 0.4));
      placed = makePlatform(
        prev.x + prev.w + gap,
        Math.min(GROUND_Y, prev.y + rand(0, 24)),
        rand(110, 160),
      );
    }
    platforms.push(placed);
    worldGenX = placed.x + placed.w;
  }

  state.platforms = platforms.filter(p => p.x + p.w > state.cameraX - 200);
  state.worldGenX = worldGenX;
}

export function seedPlatforms(state) {
  state.platforms = [];
  state.platforms.push(makePlatform(-40, GROUND_Y, 560));
  state.worldGenX = state.platforms[0].x + state.platforms[0].w;
  generatePlatformsAhead(state);
}
