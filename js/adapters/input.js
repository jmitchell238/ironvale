/**
 * Adapter: keyboard + virtual stick input for the canvas stage.
 */

import { W, H } from '../config/index.js';
import { clamp, dist } from '../core/math.js';

export const STICK_R = 40;
export const JUMP_BTN = { x: W - 58, y: H - 52, r: 30 };
export const ATK_BTN = { x: W - 58, y: H - 118, r: 28 };

export function createInput(stageEl, canvasEl, hooks) {
  const stick = {
    active: false, dx: 0, dy: 0, id: null, ox: 0, oy: 0,
    jumpDown: false, jumpId: null, jumpQueued: false,
    attackDown: false, attackId: null, attackQueued: false,
  };
  const keys = Object.create(null);

  function canvasRect() {
    return canvasEl.getBoundingClientRect();
  }

  function clientToStage(cx, cy) {
    const rect = canvasRect();
    return {
      x: (cx - rect.left) / (rect.width / W),
      y: (cy - rect.top) / (rect.height / H),
    };
  }

  function hitBtn(sx, sy, btn) {
    return dist(sx, sy, btn.x, btn.y) <= btn.r + 8;
  }

  function resetStick() {
    stick.active = false; stick.dx = 0; stick.dy = 0; stick.id = null;
    stick.jumpDown = false; stick.jumpId = null; stick.jumpQueued = false;
    stick.attackDown = false; stick.attackId = null; stick.attackQueued = false;
    if (hooks.onJumpHeld) hooks.onJumpHeld(false);
  }

  function updateStick(sx, sy) {
    let dx = (sx - stick.ox) / STICK_R;
    let dy = (sy - stick.oy) / STICK_R;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    stick.dx = dx;
    stick.dy = dy;
  }

  function keyboardAxis() {
    let x = 0, y = 0;
    if (keys.ArrowLeft || keys.a || keys.A) x -= 1;
    if (keys.ArrowRight || keys.d || keys.D) x += 1;
    if (keys.ArrowUp || keys.w || keys.W) y -= 1;
    if (keys.ArrowDown || keys.s || keys.S) y += 1;
    return { x, y };
  }

  function axis() {
    const k = keyboardAxis();
    if (stick.active && Math.abs(stick.dx) > 0.05) {
      return {
        x: clamp(stick.dx + k.x * 0.35, -1, 1),
        y: clamp(stick.dy * 0.5 + k.y * 0.5, -1, 1),
      };
    }
    return k;
  }

  function wantJump() {
    const k = !!(keys[' '] || keys.ArrowUp || keys.w || keys.W);
    if (k) {
      if (hooks.onJumpHeld) hooks.onJumpHeld(true);
    } else if (!stick.jumpDown && hooks.onJumpHeld) {
      hooks.onJumpHeld(false);
    }
    if (stick.jumpQueued) {
      stick.jumpQueued = false;
      return true;
    }
    return k;
  }

  function wantAttack() {
    const k = !!(keys.j || keys.J || keys.k || keys.K || keys.f || keys.F || keys.Shift);
    if (stick.attackQueued) {
      stick.attackQueued = false;
      return true;
    }
    return k;
  }

  function poll() {
    return {
      x: axis().x,
      y: axis().y,
      jump: wantJump(),
      attack: wantAttack(),
    };
  }

  const ptrOpts = { passive: false };

  function onPointerDown(e) {
    if (hooks.onPointerDown && hooks.onPointerDown(e, { stick, clientToStage, hitBtn, canvasRect })) {
      return;
    }
    if (!hooks.isPlay || !hooks.isPlay()) return;
    if (hooks.ensureAudio) hooks.ensureAudio();
    const p = clientToStage(e.clientX, e.clientY);
    if (hitBtn(p.x, p.y, ATK_BTN) || (p.x > W * 0.55 && p.y < H - 90 && p.y > H - 150)) {
      stick.attackDown = true;
      stick.attackId = e.pointerId;
      stick.attackQueued = true;
      e.preventDefault();
      try { stageEl.setPointerCapture(e.pointerId); } catch (_) {}
      return;
    }
    if (hitBtn(p.x, p.y, JUMP_BTN) || (p.x > W * 0.62 && p.y >= H - 90)) {
      stick.jumpDown = true;
      stick.jumpId = e.pointerId;
      stick.jumpQueued = true;
      if (hooks.onJumpHeld) hooks.onJumpHeld(true);
      e.preventDefault();
      try { stageEl.setPointerCapture(e.pointerId); } catch (_) {}
      return;
    }
    stick.active = true;
    stick.id = e.pointerId;
    stick.ox = p.x;
    stick.oy = p.y;
    updateStick(p.x, p.y);
    e.preventDefault();
    try { stageEl.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function onPointerMove(e) {
    if (!hooks.isPlay || !hooks.isPlay() || !stick.active) return;
    if (stick.id != null && e.pointerId !== stick.id) return;
    const p = clientToStage(e.clientX, e.clientY);
    updateStick(p.x, p.y);
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (stick.jumpId != null && e.pointerId === stick.jumpId) {
      stick.jumpDown = false;
      stick.jumpId = null;
      if (hooks.onJumpHeld) hooks.onJumpHeld(false);
    }
    if (stick.attackId != null && e.pointerId === stick.attackId) {
      stick.attackDown = false;
      stick.attackId = null;
    }
    if (stick.id != null && e.pointerId === stick.id) {
      stick.active = false;
      stick.dx = 0;
      stick.dy = 0;
      stick.id = null;
    }
  }

  stageEl.addEventListener('pointerdown', onPointerDown, ptrOpts);
  stageEl.addEventListener('pointermove', onPointerMove, ptrOpts);
  stageEl.addEventListener('pointerup', onPointerUp, ptrOpts);
  stageEl.addEventListener('pointercancel', () => resetStick(), ptrOpts);

  addEventListener('keydown', e => {
    keys[e.key] = true;
    if (hooks.onKeyDown) hooks.onKeyDown(e, keys);
  });
  addEventListener('keyup', e => {
    keys[e.key] = false;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      if (hooks.onJumpHeld) hooks.onJumpHeld(false);
    }
  });

  return {
    stick,
    keys,
    poll,
    resetStick,
    canvasRect,
    clientToStage,
  };
}
