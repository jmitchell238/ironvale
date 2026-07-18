/**
 * App composition root: wire adapters + GameSession + DOM shell.
 */

import {
  GAME_NAME, GAME_VERSION_LABEL, W, H,
} from '../config/index.js';
import { resizeCanvas } from '../core/math.js';
import { GameSession } from '../world/GameSession.js';
import { listLevels } from '../domain/levels.js';
import { createSaveStore } from '../adapters/save.js';
import { createAudio } from '../adapters/audio.js';
import { loadAllSprites } from '../adapters/sprites.js';
import { drawSession, drawLoading, levelUpHitTest } from '../adapters/render.js';
import { createInput } from '../adapters/input.js';

const cv = document.getElementById('cv');
const stage = document.getElementById('stage');

const saveStore = createSaveStore();
const audio = createAudio(() => saveStore.data.muted);
const session = new GameSession({ audio, save: saveStore });

let ctx = null;
let last = performance.now();
let assetsLoaded = false;
/** Last level id for retry. */
let lastLevelId = listLevels()[0]?.id || 'outer-vale';

function setScreen(name) {
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.toggle('hidden', el.dataset.screen !== name);
  });
  document.querySelectorAll('.play-chrome').forEach(el => {
    el.classList.toggle('hidden', name !== 'play' && name !== 'levelup');
  });
}

function updateMenuStats() {
  document.getElementById('statBest').textContent = String(saveStore.data.best);
  document.getElementById('statGames').textContent = String(saveStore.data.games);
  document.getElementById('statWave').textContent = String(saveStore.data.bestWave);
  const muteBtn = document.getElementById('muteBtn');
  if (muteBtn) muteBtn.textContent = saveStore.data.muted ? '🔇 Sound off' : '🔊 Sound on';
}

function showMenu() {
  session.goMenu();
  input.resetStick();
  updateMenuStats();
  setScreen('menu');
  if (window.__pendingReload) {
    window.__pendingReload = false;
    window.__reloaded = true;
    location.reload();
  }
}

function populateLevelList() {
  const list = document.getElementById('levelList');
  if (!list) return;
  list.innerHTML = '';
  for (const lvl of listLevels()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'level-btn';
    btn.dataset.levelId = lvl.id;
    btn.innerHTML =
      `<span class="level-order">${lvl.order}</span>` +
      `<span class="level-meta">` +
      `<strong>${lvl.name}</strong>` +
      `<small>${lvl.subtitle}${lvl.stub ? ' · stub' : ''}</small>` +
      `</span>`;
    btn.addEventListener('click', () => {
      audio.click();
      showPlay(lvl.id);
    });
    list.appendChild(btn);
  }
}

function showSelect() {
  session.openLevelSelect();
  input.resetStick();
  populateLevelList();
  setScreen('select');
}

function showPlay(levelId) {
  audio.ensure();
  lastLevelId = levelId || lastLevelId;
  session.startRun(lastLevelId);
  input.resetStick();
  setScreen('play');
}

function showOver() {
  input.resetStick();
  setScreen('over');
  document.getElementById('overScore').textContent = String(Math.floor(session.score));
  document.getElementById('overBest').textContent = String(saveStore.data.best);
  document.getElementById('overWave').textContent = session.level
    ? String(session.level.order)
    : String(session.wave);
  document.getElementById('overKills').textContent = String(session.kills);
  document.getElementById('overReason').textContent = session.overReason;
  document.getElementById('newBest').classList.toggle(
    'hidden',
    !(Math.floor(session.score) > 0 && Math.floor(session.score) >= saveStore.data.best)
  );
  if (window.__pendingReload) {
    window.__pendingReload = false;
    window.__reloaded = true;
    location.reload();
  }
}

function showClear() {
  input.resetStick();
  setScreen('clear');
  const nameEl = document.getElementById('clearLevelName');
  if (nameEl) {
    nameEl.textContent = session.level
      ? `${session.level.order}. ${session.level.name}`
      : 'Stage complete';
  }
  document.getElementById('clearScore').textContent = String(Math.floor(session.score));
  document.getElementById('clearKills').textContent = String(session.kills);

  const next = session.getNextLevel();
  const btnNext = document.getElementById('btnNextLevel');
  if (btnNext) {
    if (next) {
      btnNext.textContent = `▶  Next: ${next.name}`;
      btnNext.classList.remove('hidden');
      btnNext.disabled = false;
    } else {
      btnNext.textContent = '🏆 Campaign clear';
      btnNext.disabled = true;
    }
  }
  if (window.__pendingReload) {
    window.__pendingReload = false;
    window.__reloaded = true;
    location.reload();
  }
}

const input = createInput(stage, cv, {
  isPlay: () => session.screen === 'play',
  ensureAudio: () => audio.ensure(),
  onJumpHeld: h => session.setJumpHeld(h),
  onPointerDown(e, api) {
    if (session.screen === 'levelup') {
      audio.ensure();
      const idx = levelUpHitTest(e.clientY, api.canvasRect(), session.levelChoices);
      if (idx >= 0 && session.levelChoices[idx]) {
        e.preventDefault();
        session.applyUpgrade(session.levelChoices[idx]);
        if (session.screen === 'play') setScreen('play');
        return true;
      }
      return true;
    }
    return false;
  },
  onKeyDown(e) {
    if (session.screen === 'levelup') {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= session.levelChoices.length) {
        e.preventDefault();
        session.applyUpgrade(session.levelChoices[n - 1]);
        if (session.screen === 'play') setScreen('play');
      }
      return;
    }
    if (session.screen !== 'play') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (session.screen === 'menu') showSelect();
        else if (session.screen === 'over') showPlay(lastLevelId);
        else if (session.screen === 'clear') {
          const next = session.getNextLevel();
          if (next) showPlay(next.id);
          else showMenu();
        }
      }
      return;
    }
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      session.requestJump();
      session.setJumpHeld(true);
    }
    if (e.key === 'j' || e.key === 'J' || e.key === 'k' || e.key === 'K' || e.key === 'f' || e.key === 'F' || e.key === 'Shift') {
      e.preventDefault();
      session.requestAttack();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      showMenu();
    }
  },
});

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  if (!ctx) ({ ctx } = resizeCanvas(cv, W, H));

  const prevScreen = session.screen;
  if (session.screen === 'play') {
    session.update(dt, input.poll());
    if (session.screen === 'over') showOver();
    else if (session.screen === 'clear') showClear();
  }

  drawSession(ctx, session, t, input.stick, saveStore.data.best);

  // Keep DOM overlay in sync if level-up opened mid-frame
  if (session.screen === 'levelup' && prevScreen === 'play') setScreen('levelup');

  requestAnimationFrame(frame);
}

document.getElementById('btnPlay').addEventListener('click', () => { audio.click(); showSelect(); });
document.getElementById('btnHow').addEventListener('click', () => {
  audio.click();
  document.getElementById('howPanel').classList.toggle('hidden');
});
document.getElementById('btnRetry').addEventListener('click', () => {
  audio.click();
  showPlay(lastLevelId);
});
document.getElementById('btnMenu').addEventListener('click', () => { audio.click(); showMenu(); });
document.getElementById('btnSelectBack').addEventListener('click', () => { audio.click(); showMenu(); });
document.getElementById('btnClearMenu').addEventListener('click', () => { audio.click(); showMenu(); });
document.getElementById('btnNextLevel').addEventListener('click', () => {
  audio.click();
  const next = session.getNextLevel();
  if (next) showPlay(next.id);
  else showMenu();
});
document.getElementById('btnPauseMenu').addEventListener('click', e => {
  e.stopPropagation();
  audio.click();
  showMenu();
});
document.getElementById('muteBtn').addEventListener('click', () => {
  saveStore.toggleMuted();
  updateMenuStats();
  audio.click();
});

function applyVersionLabels() {
  const label = GAME_NAME + ' ' + GAME_VERSION_LABEL;
  for (const id of ['versionTag', 'versionMenu', 'versionOver', 'versionSelect', 'versionClear']) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (id === 'versionMenu' || id === 'versionSelect') el.textContent = label + ' · PWA ready';
    else if (id === 'versionTag') el.textContent = label;
    else el.textContent = label;
  }
}

function safeReloadForUpdate() {
  if (window.__reloaded) return;
  if (session.screen === 'play' || session.screen === 'levelup') {
    window.__pendingReload = true;
    return;
  }
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
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          w.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => safeReloadForUpdate());
  }).catch(err => console.warn('[sw]', err));
}

addEventListener('resize', () => { ({ ctx } = resizeCanvas(cv, W, H)); });

applyVersionLabels();
updateMenuStats();
setScreen('menu');
registerSW();
({ ctx } = resizeCanvas(cv, W, H));

function bootFrame(now) {
  if (!ctx) ({ ctx } = resizeCanvas(cv, W, H));
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
