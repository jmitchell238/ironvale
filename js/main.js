'use strict';

const cv = document.getElementById('cv');
const stage = document.getElementById('stage');
let ctx = null;
let last = performance.now();
let assetsLoaded = false;

const stick = {
  active: false, dx: 0, dy: 0, id: null, ox: 0, oy: 0,
  jumpDown: false, jumpId: null, jumpQueued: false,
  attackDown: false, attackId: null, attackQueued: false,
};
const keys = Object.create(null);
const STICK_R = 40;
const JUMP_BTN = { x: W - 58, y: H - 52, r: 30 };
const ATK_BTN = { x: W - 58, y: H - 118, r: 28 };

function setScreen(name) {
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.toggle('hidden', el.dataset.screen !== name);
  });
  document.querySelectorAll('.play-chrome').forEach(el => {
    el.classList.toggle('hidden', name !== 'play' && name !== 'levelup');
  });
}

function updateMenuStats() {
  document.getElementById('statBest').textContent = String(save.best);
  document.getElementById('statGames').textContent = String(save.games);
  document.getElementById('statWave').textContent = String(save.bestWave);
  const muteBtn = document.getElementById('muteBtn');
  if (muteBtn) muteBtn.textContent = save.muted ? '🔇 Sound off' : '🔊 Sound on';
}

function showMenu() {
  state = 'menu';
  resetStick();
  updateMenuStats();
  setScreen('menu');
  if (window.__pendingReload) { window.__pendingReload = false; window.__reloaded = true; location.reload(); }
}

function showPlay() {
  ensureAudio();
  startGame();
  startWave();
  resetStick();
  setScreen('play');
}

function showOver() {
  resetStick();
  setScreen('over');
  document.getElementById('overScore').textContent = String(Math.floor(score));
  document.getElementById('overBest').textContent = String(save.best);
  document.getElementById('overWave').textContent = String(wave);
  document.getElementById('overKills').textContent = String(kills);
  document.getElementById('overReason').textContent = overReason;
  document.getElementById('newBest').classList.toggle('hidden', !(Math.floor(score) > 0 && Math.floor(score) >= save.best));
  if (window.__pendingReload) { window.__pendingReload = false; window.__reloaded = true; location.reload(); }
}

function resetStick() {
  stick.active = false; stick.dx = 0; stick.dy = 0; stick.id = null;
  stick.jumpDown = false; stick.jumpId = null; stick.jumpQueued = false;
  stick.attackDown = false; stick.attackId = null; stick.attackQueued = false;
  setJumpHeld(false);
}

function canvasRect() { return cv.getBoundingClientRect(); }

function clientToStage(cx, cy) {
  const rect = canvasRect();
  return { x: (cx - rect.left) / (rect.width / W), y: (cy - rect.top) / (rect.height / H) };
}

function hitBtn(sx, sy, btn) { return dist(sx, sy, btn.x, btn.y) <= btn.r + 8; }

function keyboardAxis() {
  let x = 0, y = 0;
  if (keys.ArrowLeft || keys.a || keys.A) x -= 1;
  if (keys.ArrowRight || keys.d || keys.D) x += 1;
  if (keys.ArrowUp || keys.w || keys.W) y -= 1;
  if (keys.ArrowDown || keys.s || keys.S) y += 1;
  return { x, y };
}

function inputAxis() {
  const k = keyboardAxis();
  if (stick.active && Math.abs(stick.dx) > 0.05) {
    return { x: clamp(stick.dx + k.x * 0.35, -1, 1), y: clamp(stick.dy * 0.5 + k.y * 0.5, -1, 1) };
  }
  return k;
}

function wantJump() {
  const k = !!(keys[' '] || keys.ArrowUp || keys.w || keys.W);
  if (k) setJumpHeld(true);
  else if (!stick.jumpDown) setJumpHeld(false);
  if (stick.jumpQueued) { stick.jumpQueued = false; return true; }
  return k;
}

function wantAttack() {
  const k = !!(keys.j || keys.J || keys.k || keys.K || keys.f || keys.F || keys.Shift);
  if (stick.attackQueued) { stick.attackQueued = false; return true; }
  return k;
}

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  if (!ctx) ({ ctx } = resizeCanvas(cv));

  if (state === 'play') {
    const axis = inputAxis();
    updatePlay(dt, axis.x, axis.y, wantJump(), wantAttack());
    if (state === 'over') showOver();
  }

  const cam = cameraX;
  ctx.save();
  if (shake > 0 && (state === 'play' || state === 'levelup')) {
    const s = Math.min(shake, 3) * 0.35;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  if (state === 'menu') drawIdleDecor(ctx, t);
  else {
    drawBackground(ctx, cam);
    drawPlatforms(ctx, cam);
    for (const c of coins) drawCoin(ctx, c, t, cam);
    for (const e of enemies) drawEnemy(ctx, e, cam, t);
    if (player) drawPlayer(ctx, player, t, cam);
    drawParticles(ctx, cam);
    drawHud(ctx, player, score, Math.max(save.best, Math.floor(score)), wave);
    if (state === 'play' || state === 'levelup') drawControls(ctx, stick);
  }
  if (state === 'levelup') drawLevelUpOverlay(ctx, levelChoices);
  ctx.restore();
  requestAnimationFrame(frame);
}

function onPointerDown(e) {
  if (state === 'levelup') {
    ensureAudio();
    const idx = levelUpHitTest(e.clientY, canvasRect(), levelChoices);
    if (idx >= 0 && levelChoices[idx]) {
      e.preventDefault();
      applyUpgrade(levelChoices[idx]);
      if (state === 'play') setScreen('play');
    }
    return;
  }
  if (state !== 'play') return;
  ensureAudio();
  const p = clientToStage(e.clientX, e.clientY);
  if (hitBtn(p.x, p.y, ATK_BTN) || (p.x > W * 0.55 && p.y < H - 90 && p.y > H - 150)) {
    stick.attackDown = true; stick.attackId = e.pointerId; stick.attackQueued = true;
    e.preventDefault();
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    return;
  }
  if (hitBtn(p.x, p.y, JUMP_BTN) || (p.x > W * 0.62 && p.y >= H - 90)) {
    stick.jumpDown = true; stick.jumpId = e.pointerId; stick.jumpQueued = true; setJumpHeld(true);
    e.preventDefault();
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    return;
  }
  stick.active = true; stick.id = e.pointerId; stick.ox = p.x; stick.oy = p.y;
  updateStick(p.x, p.y);
  e.preventDefault();
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
}

function updateStick(sx, sy) {
  let dx = (sx - stick.ox) / STICK_R, dy = (sy - stick.oy) / STICK_R;
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  stick.dx = dx; stick.dy = dy;
}

function onPointerMove(e) {
  if (state !== 'play' || !stick.active) return;
  if (stick.id != null && e.pointerId !== stick.id) return;
  const p = clientToStage(e.clientX, e.clientY);
  updateStick(p.x, p.y);
  e.preventDefault();
}

function onPointerUp(e) {
  if (stick.jumpId != null && e.pointerId === stick.jumpId) {
    stick.jumpDown = false; stick.jumpId = null; setJumpHeld(false);
  }
  if (stick.attackId != null && e.pointerId === stick.attackId) {
    stick.attackDown = false; stick.attackId = null;
  }
  if (stick.id != null && e.pointerId === stick.id) {
    stick.active = false; stick.dx = 0; stick.dy = 0; stick.id = null;
  }
}

const ptrOpts = { passive: false };
stage.addEventListener('pointerdown', onPointerDown, ptrOpts);
stage.addEventListener('pointermove', onPointerMove, ptrOpts);
stage.addEventListener('pointerup', onPointerUp, ptrOpts);
stage.addEventListener('pointercancel', () => resetStick(), ptrOpts);

addEventListener('keydown', e => {
  keys[e.key] = true;
  if (state === 'levelup') {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= levelChoices.length) {
      e.preventDefault();
      applyUpgrade(levelChoices[n - 1]);
      if (state === 'play') setScreen('play');
    }
    return;
  }
  if (state !== 'play') {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (state === 'menu' || state === 'over') showPlay(); }
    return;
  }
  if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    e.preventDefault(); requestJump(); setJumpHeld(true);
  }
  if (e.key === 'j' || e.key === 'J' || e.key === 'k' || e.key === 'K' || e.key === 'f' || e.key === 'F' || e.key === 'Shift') {
    e.preventDefault(); requestAttack();
  }
  if (e.key === 'Escape') { e.preventDefault(); showMenu(); }
});
addEventListener('keyup', e => {
  keys[e.key] = false;
  if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') setJumpHeld(false);
});
addEventListener('resize', () => { ({ ctx } = resizeCanvas(cv)); });

document.getElementById('btnPlay').addEventListener('click', () => { sfxClick(); showPlay(); });
document.getElementById('btnHow').addEventListener('click', () => {
  sfxClick();
  document.getElementById('howPanel').classList.toggle('hidden');
});
document.getElementById('btnRetry').addEventListener('click', () => { sfxClick(); showPlay(); });
document.getElementById('btnMenu').addEventListener('click', () => { sfxClick(); showMenu(); });
document.getElementById('btnPauseMenu').addEventListener('click', e => { e.stopPropagation(); sfxClick(); showMenu(); });
document.getElementById('muteBtn').addEventListener('click', () => {
  save.muted = !save.muted; persist(); updateMenuStats(); sfxClick();
});

function applyVersionLabels() {
  const label = GAME_NAME + ' ' + GAME_VERSION_LABEL;
  const tag = document.getElementById('versionTag');
  const menu = document.getElementById('versionMenu');
  const over = document.getElementById('versionOver');
  if (tag) tag.textContent = label;
  if (menu) menu.textContent = label + ' · PWA ready';
  if (over) over.textContent = label;
}

function safeReloadForUpdate() {
  if (window.__reloaded) return;
  if (state === 'play' || state === 'levelup') { window.__pendingReload = true; return; }
  window.__reloaded = true;
  location.reload();
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (!(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) w.postMessage({ type: 'SKIP_WAITING' });
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => safeReloadForUpdate());
  }).catch(err => console.warn('[sw]', err));
}

applyVersionLabels();
updateMenuStats();
setScreen('menu');
registerSW();
({ ctx } = resizeCanvas(cv));

function bootFrame(now) {
  if (!ctx) ({ ctx } = resizeCanvas(cv));
  if (!assetsLoaded) {
    drawLoading(ctx);
    requestAnimationFrame(bootFrame);
    return;
  }
  last = now;
  frame(now);
}

loadAllSprites().then(() => { assetsLoaded = true; }).catch(() => { assetsLoaded = true; });
requestAnimationFrame(bootFrame);
