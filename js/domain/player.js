/**
 * Domain: player factory + body geometry + movement integration.
 * Sword logic lives in combat.js — not here.
 */

import { clamp } from '../core/math.js';
import {
  PLAYER_BODY, PLAYER_MOVE, PLAYER, GROUND_Y, PLAY, CAM, xpForLevel,
} from '../config/index.js';
import { tickMeleeAttack } from './combat.js';

export function makePlayer() {
  return {
    x: 80,
    y: GROUND_Y,
    w: PLAYER_BODY.w,
    h: PLAYER_BODY.h,
    vx: 0,
    vy: 0,
    hp: PLAYER_MOVE.maxHp,
    maxHp: PLAYER_MOVE.maxHp,
    inv: 0,
    level: 1,
    xp: 0,
    xpNext: xpForLevel(1),
    facing: 1,
    onGround: true,
    coyote: 0,
    anim: 0,
    attacking: false,
    attackT: 0,
    attackCd: 0,
    attackAir: false,
    attackHitDone: false,
    _owned: {},
  };
}

export function playerCx(p) { return p.x; }
export function playerCy(p) { return p.y - p.h / 2; }
export function playerLeft(p) { return p.x - p.w / 2; }
export function playerRight(p) { return p.x + p.w / 2; }
export function playerTop(p) { return p.y - p.h; }

/**
 * Integrate run/jump/platform collision for one frame.
 * Attack swing start is handled by caller (session); this ticks melee timers.
 *
 * @param {object} ctx
 * @param {object} ctx.player
 * @param {object} ctx.stats
 * @param {object[]} ctx.platforms
 * @param {number} ctx.cameraX
 * @param {number} ctx.jumpBuffered  (mutated via return)
 * @param {boolean} ctx.jumpHeld
 * @param {object} ctx.swordCfg
 * @param {function} [ctx.onJump]
 * @param {function} [ctx.onFellOff]
 * @returns {{ jumpBuffered: number, stillSwinging: boolean }}
 */
export function integratePlayerMovement(dt, input, ctx) {
  const p = ctx.player;
  const stats = ctx.stats;
  let jumpBuffered = ctx.jumpBuffered;
  const { ix, iy, wantJump } = input;

  if (wantJump || iy < -0.55) jumpBuffered = PLAYER_MOVE.jumpBuffer;

  const spd = PLAYER_MOVE.runSpeed * stats.speedMul;
  const mx = Math.abs(ix) > 0.08 ? clamp(ix, -1, 1) : 0;
  const targetVx = mx * spd;
  const accel = p.onGround ? 2800 : 1800;
  const control = p.onGround ? 1 : PLAYER_MOVE.airControl;
  if (Math.abs(targetVx - p.vx) < accel * dt) p.vx = targetVx;
  else p.vx += Math.sign(targetVx - p.vx) * accel * dt * control;

  if (mx > 0.1) p.facing = 1;
  else if (mx < -0.1) p.facing = -1;

  if (jumpBuffered > 0) jumpBuffered -= dt;
  if (p.onGround) p.coyote = PLAYER_MOVE.coyote;
  else p.coyote = Math.max(0, p.coyote - dt);

  if (jumpBuffered > 0 && p.coyote > 0 && !p.attacking) {
    p.vy = PLAYER_MOVE.jumpVel * stats.jumpMul;
    p.onGround = false;
    p.coyote = 0;
    jumpBuffered = 0;
    if (ctx.onJump) ctx.onJump();
  }
  if (!ctx.jumpHeld && p.vy < -80) p.vy *= 0.55;

  p.vy += PLAYER_MOVE.gravity * dt;
  if (p.vy > PLAYER_MOVE.maxFall) p.vy = PLAYER_MOVE.maxFall;

  p.x += p.vx * dt;
  const camMin = ctx.cameraX + 24;
  const worldMin = ctx.worldMinX != null ? ctx.worldMinX : camMin;
  const minX = Math.max(camMin, worldMin);
  if (p.x < minX) {
    p.x = minX;
    p.vx = Math.max(0, p.vx);
  }
  if (ctx.worldMaxX != null && p.x > ctx.worldMaxX) {
    p.x = ctx.worldMaxX;
    p.vx = Math.min(0, p.vx);
  }

  p.onGround = false;
  p.y += p.vy * dt;

  if (p.vy >= 0) {
    for (const pl of ctx.platforms) {
      const left = playerLeft(p);
      const right = playerRight(p);
      if (right <= pl.x + 2 || left >= pl.x + pl.w - 2) continue;
      const prevFeet = p.y - p.vy * dt;
      if (
        (prevFeet <= pl.y + 6 && p.y >= pl.y) ||
        (p.y >= pl.y - 2 && p.y <= pl.y + Math.max(pl.h + 10, 28) && prevFeet <= pl.y + 20)
      ) {
        p.y = pl.y;
        p.vy = 0;
        p.onGround = true;
        break;
      }
    }
  }

  if (p.y > PLAY.bottom + 80) {
    if (ctx.onFellOff) ctx.onFellOff();
    p.y = GROUND_Y;
    p.vy = 0;
    p.x = ctx.cameraX + CAM.focusX;
    p.inv = PLAYER_MOVE.invuln;
  }

  const stillSwinging = tickMeleeAttack(p, dt, ctx.swordCfg, stats);

  if (p.onGround && Math.abs(p.vx) > 20) p.anim += dt * (Math.abs(p.vx) / PLAYER_MOVE.runSpeed);
  else if (!p.onGround) p.anim += dt * 0.3;
  else p.anim += dt * 0.45;

  return { jumpBuffered, stillSwinging };
}

/** Re-export merged PLAYER for systems that need full table. */
export { PLAYER };
