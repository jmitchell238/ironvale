/**
 * Domain: player factory + body geometry + movement integration.
 * Sword logic lives in combat.js — not here.
 *
 * Movement feel: coyote, jump buffer, variable jump, duck, double-jump.
 */

import { clamp } from '../core/math.js';
import {
  PLAYER_BODY, PLAYER_MOVE, PLAYER, GROUND_Y, CAM, CLIMB, xpForLevel,
} from '../config/index.js';
import { tickMeleeAttack } from './combat.js';
import { findLadderAt, resolveSolidBlockers } from './platforms.js';

export function makePlayer() {
  const h = PLAYER_BODY.h;
  return {
    x: 80,
    y: GROUND_Y,
    w: PLAYER_BODY.w,
    h,
    standH: h,
    duckH: PLAYER_BODY.duckH || Math.floor(h * 0.58),
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
    ducking: false,
    climbing: false,
    /** Air jumps remaining (refills on land). */
    airJumps: PLAYER_MOVE.maxAirJumps != null ? PLAYER_MOVE.maxAirJumps : 1,
    _owned: {},
  };
}

export function playerCx(p) { return p.x; }
export function playerCy(p) { return p.y - p.h / 2; }
export function playerLeft(p) { return p.x - p.w / 2; }
export function playerRight(p) { return p.x + p.w / 2; }
export function playerTop(p) { return p.y - p.h; }

/**
 * Integrate run/jump/duck/double-jump/platform collision for one frame.
 * Attack swing start is handled by caller (session); this ticks melee timers.
 *
 * @param {object} ctx
 * @returns {{ jumpBuffered: number, stillSwinging: boolean }}
 */
export function integratePlayerMovement(dt, input, ctx) {
  const p = ctx.player;
  const stats = ctx.stats;
  let jumpBuffered = ctx.jumpBuffered;
  const { ix, iy, wantJump } = input;
  const duckThresh = PLAYER_MOVE.duckThreshold != null ? PLAYER_MOVE.duckThreshold : 0.55;
  const maxAir = PLAYER_MOVE.maxAirJumps != null ? PLAYER_MOVE.maxAirJumps : 1;

  const ladder = findLadderAt(p, ctx.ladders);
  const grabIy = CLIMB.grabIy != null ? CLIMB.grabIy : 0.35;
  const pressUp = iy <= -grabIy;
  const pressDown = iy >= grabIy;
  const wantClimb = !!(
    ladder
    && !p.attacking
    && (p.climbing || pressUp || (pressDown && p.onGround))
  );

  if (wantClimb) {
    p.climbing = true;
    p.ducking = false;
    p.h = p.standH || PLAYER_BODY.h;
    p.onGround = false;
    p.vy = 0;
    p.vx = 0;
    const snap = CLIMB.snapSpeed != null ? CLIMB.snapSpeed : 180;
    const dx = ladder.x - p.x;
    if (Math.abs(dx) > 2) p.x += Math.sign(dx) * Math.min(Math.abs(dx), snap * dt);
    p.y += iy * (CLIMB.speed != null ? CLIMB.speed : 150) * dt;
    // Stay inside the ladder column
    const top = ladder.y;
    const bot = ladder.y + ladder.h;
    if (p.y < top) {
      p.y = top;
      p.climbing = false;
      p.onGround = true;
    } else if (p.y > bot) {
      p.y = bot;
      p.climbing = false;
    }
    p.airJumps = maxAir;
    if (wantJump) {
      p.climbing = false;
      p.vy = PLAYER_MOVE.jumpVel * stats.jumpMul * 0.85;
      p.onGround = false;
      jumpBuffered = 0;
      if (ctx.onJump) ctx.onJump();
    }
    resolveSolidBlockers(p, ctx.blockers);
    const stillSwinging = tickMeleeAttack(p, dt, ctx.swordCfg, stats);
    p.anim += dt * 0.8;
    return { jumpBuffered, stillSwinging };
  }
  p.climbing = false;

  if (wantJump || (iy < -0.55 && !ladder)) jumpBuffered = PLAYER_MOVE.jumpBuffer;

  // ── Duck (ground only; hold down) ──
  const wantDuck = p.onGround && iy >= duckThresh && !p.attacking && !p.climbing;
  if (wantDuck) {
    p.ducking = true;
    p.h = p.duckH || PLAYER_BODY.duckH || 28;
  } else if (p.ducking) {
    // Stand up if headroom (always true in this game — no ceilings)
    p.ducking = false;
    p.h = p.standH || PLAYER_BODY.h;
  } else {
    p.h = p.standH || PLAYER_BODY.h;
  }

  const spd = PLAYER_MOVE.runSpeed * stats.speedMul
    * (p.ducking ? (PLAYER_MOVE.duckSpeedMul != null ? PLAYER_MOVE.duckSpeedMul : 0.45) : 1);
  const mx = Math.abs(ix) > 0.08 ? clamp(ix, -1, 1) : 0;
  const targetVx = mx * spd;
  const accel = p.onGround ? 2800 : 1800;
  const control = p.onGround ? 1 : PLAYER_MOVE.airControl;
  if (Math.abs(targetVx - p.vx) < accel * dt) p.vx = targetVx;
  else p.vx += Math.sign(targetVx - p.vx) * accel * dt * control;

  if (mx > 0.1) p.facing = 1;
  else if (mx < -0.1) p.facing = -1;

  if (jumpBuffered > 0) jumpBuffered -= dt;
  if (p.onGround) {
    p.coyote = PLAYER_MOVE.coyote;
    p.airJumps = maxAir;
  } else {
    p.coyote = Math.max(0, p.coyote - dt);
  }

  // Ground / coyote jump
  if (jumpBuffered > 0 && p.coyote > 0 && !p.attacking && !p.ducking) {
    p.vy = PLAYER_MOVE.jumpVel * stats.jumpMul;
    p.onGround = false;
    p.coyote = 0;
    jumpBuffered = 0;
    p.ducking = false;
    p.h = p.standH || PLAYER_BODY.h;
    if (ctx.onJump) ctx.onJump();
  } else if (
    // Double jump (air only, after leaving ground)
    jumpBuffered > 0
    && !p.onGround
    && p.coyote <= 0
    && (p.airJumps || 0) > 0
    && !p.attacking
  ) {
    p.vy = (PLAYER_MOVE.doubleJumpVel != null ? PLAYER_MOVE.doubleJumpVel : PLAYER_MOVE.jumpVel * 0.86)
      * stats.jumpMul;
    p.airJumps -= 1;
    jumpBuffered = 0;
    if (ctx.onJump) ctx.onJump();
    if (ctx.onDoubleJump) ctx.onDoubleJump();
  }

  // Variable jump height
  if (!ctx.jumpHeld && p.vy < -80) p.vy *= 0.55;

  p.vy += PLAYER_MOVE.gravity * dt;
  if (p.vy > PLAYER_MOVE.maxFall) p.vy = PLAYER_MOVE.maxFall;

  p.x += p.vx * dt;
  const worldMin = ctx.worldMinX != null ? ctx.worldMinX : 24;
  if (p.x < worldMin) {
    p.x = worldMin;
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
      if (right <= pl.x + 4 || left >= pl.x + pl.w - 4) continue;
      const prevFeet = p.y - p.vy * dt;
      if (prevFeet <= pl.y + 10 && p.y >= pl.y) {
        p.y = pl.y;
        p.vy = 0;
        p.onGround = true;
        p.airJumps = maxAir;
        break;
      }
    }
  }

  resolveSolidBlockers(p, ctx.blockers);

  const fallY = ctx.worldMaxY != null ? ctx.worldMaxY : GROUND_Y + 220;
  if (p.y > fallY) {
    if (ctx.onFellOff) ctx.onFellOff();
    p.y = ctx.respawnY != null ? ctx.respawnY : GROUND_Y;
    p.vy = 0;
    p.x = ctx.respawnX != null ? ctx.respawnX : (ctx.cameraX + CAM.focusX);
    p.inv = PLAYER_MOVE.invuln;
    p.airJumps = maxAir;
    p.climbing = false;
  }

  const stillSwinging = tickMeleeAttack(p, dt, ctx.swordCfg, stats);

  if (p.onGround && Math.abs(p.vx) > 20) p.anim += dt * (Math.abs(p.vx) / PLAYER_MOVE.runSpeed);
  else if (!p.onGround) p.anim += dt * 0.3;
  else p.anim += dt * 0.45;

  return { jumpBuffered, stillSwinging };
}

/** Re-export merged PLAYER for systems that need full table. */
export { PLAYER };
