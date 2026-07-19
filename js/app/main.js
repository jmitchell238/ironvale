/**
 * App composition root: wire adapters + GameSession + DOM shell.
 */

import {
  GAME_NAME, GAME_VERSION, GAME_VERSION_LABEL, W, H, ENEMIES,
} from '../config/index.js';
import { resizeCanvas } from '../core/math.js';
import { GameSession } from '../world/GameSession.js';
import { listLevels } from '../domain/levels.js';
import { ATTR_KEYS, ATTR_INFO } from '../domain/rpg.js';
import { createSaveStore } from '../adapters/save.js';
import { createAudio } from '../adapters/audio.js';
import { loadAllSprites } from '../adapters/sprites.js';
import { drawSession, drawLoading, levelUpHitTest } from '../adapters/render.js';
import { createInput } from '../adapters/input.js';

function configEnemyLabel(type) {
  return ENEMIES[type]?.label || null;
}

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
  const meta = saveStore.getMeta();
  document.getElementById('statBest').textContent = String(saveStore.data.best);
  const heroEl = document.getElementById('statHeroLv');
  if (heroEl) heroEl.textContent = String(meta.level);
  document.getElementById('statWave').textContent = String(saveStore.data.bestWave);
  const rpgLine = document.getElementById('menuRpgLine');
  if (rpgLine) {
    let line =
      `Unspent points: ${meta.unspentPoints} · XP ${meta.xp}` +
      (meta.unspentPoints > 0 ? ' · spend after a clear' : '');
    if (meta.ngPlus > 0) line += ` · NG+${meta.ngPlus}`;
    else if (meta.campaignCleared) line += ' · Campaign cleared';
    rpgLine.textContent = line;
  }
  const muteBtn = document.getElementById('muteBtn');
  if (muteBtn) muteBtn.textContent = saveStore.data.muted ? '🔇 Sound off' : '🔊 Sound on';
  const ngBtn = document.getElementById('btnNgPlus');
  if (ngBtn) {
    const show = !!meta.campaignCleared;
    ngBtn.classList.toggle('hidden', !show);
    if (show) {
      ngBtn.textContent = meta.ngPlus > 0
        ? `✦  New Game+ ${meta.ngPlus + 1}`
        : '✦  New Game+';
    }
  }
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
  const meta = session.meta || saveStore.getMeta();
  for (const lvl of listLevels()) {
    const unlocked = session.isStageUnlocked(lvl.order);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'level-btn' + (unlocked ? '' : ' locked');
    btn.dataset.levelId = lvl.id;
    btn.disabled = !unlocked;
    btn.innerHTML =
      `<span class="level-order">${unlocked ? lvl.order : '🔒'}</span>` +
      `<span class="level-meta">` +
      `<strong>${lvl.name}</strong>` +
      `<small>${unlocked ? lvl.subtitle : 'Clear previous stage to unlock'}</small>` +
      `</span>`;
    if (unlocked) {
      btn.addEventListener('click', () => {
        audio.click();
        showPlay(lvl.id);
      });
    }
    list.appendChild(btn);
  }
}

function showSelect() {
  session.openLevelSelect();
  input.resetStick();
  populateLevelList();
  setScreen('select');
}

function showPlay(levelId, opts = {}) {
  audio.ensure();
  lastLevelId = levelId || lastLevelId;
  session.startRun(lastLevelId, opts);
  if (session.screen !== 'play') {
    // locked / missing — fall back to first unlocked
    const first = listLevels().find(l => session.isStageUnlocked(l.order));
    if (first) {
      lastLevelId = first.id;
      session.startRun(first.id);
    }
  }
  input.resetStick();
  setScreen('play');
}

function showContinue() {
  audio.ensure();
  if (!session.continueFromCheckpoint()) {
    showPlay(lastLevelId);
    return;
  }
  lastLevelId = session.level?.id || lastLevelId;
  input.resetStick();
  setScreen('play');
}

function startNgPlus() {
  audio.ensure();
  if (!session.beginNewGamePlus()) return;
  updateMenuStats();
  showSelect();
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
  const btnCont = document.getElementById('btnContinue');
  if (btnCont) {
    const can = session.hasContinueCheckpoint();
    btnCont.classList.toggle('hidden', !can);
    const retry = document.getElementById('btnRetry');
    if (retry) {
      retry.classList.toggle('primary', !can);
      retry.classList.toggle('secondary', can);
    }
  }
  if (window.__pendingReload) {
    window.__pendingReload = false;
    window.__reloaded = true;
    location.reload();
  }
}

function refreshAllocateUi() {
  const ptsEl = document.getElementById('allocPoints');
  const list = document.getElementById('allocList');
  if (!ptsEl || !list || !session.meta) return;
  const unspent = session.meta.unspentPoints;
  ptsEl.textContent = `Unspent points: ${unspent}`;
  list.innerHTML = '';
  for (const key of ATTR_KEYS) {
    const info = ATTR_INFO[key];
    const val = session.meta.stats[key] || 0;
    const row = document.createElement('div');
    row.className = 'alloc-row';
    row.innerHTML =
      `<div class="alloc-info">` +
      `<div class="alloc-name">${info.name} · ${info.label}</div>` +
      `<div class="alloc-desc">${info.desc}</div>` +
      `</div>` +
      `<span class="alloc-val">${val}</span>`;
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'alloc-plus';
    plus.textContent = '+';
    plus.disabled = unspent <= 0;
    plus.addEventListener('click', () => {
      audio.ensure();
      if (session.allocateAttr(key)) {
        audio.click();
        refreshAllocateUi();
      }
    });
    row.appendChild(plus);
    list.appendChild(row);
  }
}

function showAllocate() {
  input.resetStick();
  refreshAllocateUi();
  setScreen('allocate');
}

function showClear() {
  input.resetStick();
  setScreen('clear');
  const nameEl = document.getElementById('clearLevelName');
  if (nameEl) {
    const bossType = session.level?.boss?.type;
    const bossLabel = bossType && configEnemyLabel(bossType);
    nameEl.textContent = session.level
      ? `${session.level.order}. ${session.level.name}${bossLabel ? ' · ' + bossLabel + ' down' : ''}`
      : 'Stage complete';
  }
  document.getElementById('clearScore').textContent = String(Math.floor(session.score));
  document.getElementById('clearKills').textContent = String(session.kills);
  const lvEl = document.getElementById('clearHeroLv');
  if (lvEl) lvEl.textContent = String(session.meta?.level || 1);
  const ptsEl = document.getElementById('clearPoints');
  if (ptsEl) ptsEl.textContent = String(session.meta?.unspentPoints || 0);

  const next = session.getNextLevel();
  const btnNext = document.getElementById('btnNextLevel');
  const btnClearNg = document.getElementById('btnClearNgPlus');
  if (btnNext) {
    if (next) {
      btnNext.textContent = `▶  Next: ${next.name}`;
      btnNext.classList.remove('hidden');
      btnNext.disabled = false;
    } else {
      btnNext.textContent = '🏆 Campaign clear!';
      btnNext.disabled = true;
    }
  }
  if (btnClearNg) {
    const showNg = !next && !!session.meta?.campaignCleared;
    btnClearNg.classList.toggle('hidden', !showNg);
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
    // Legacy canvas level-up cards no longer used mid-stage
    if (session.screen === 'levelup') {
      e.preventDefault();
      session.applyUpgrade();
      if (session.screen === 'play') setScreen('play');
      return true;
    }
    return false;
  },
  onKeyDown(e) {
    if (session.screen === 'allocate') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        session.finishAllocate();
        showClear();
      }
      // 1–6 spend into attr order
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= ATTR_KEYS.length) {
        e.preventDefault();
        if (session.allocateAttr(ATTR_KEYS[n - 1])) refreshAllocateUi();
      }
      return;
    }
    if (session.screen !== 'play') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (session.screen === 'menu') showSelect();
        else if (session.screen === 'over') {
          if (session.hasContinueCheckpoint()) showContinue();
          else showPlay(lastLevelId);
        }
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

  if (session.screen === 'play') {
    session.update(dt, input.poll());
    if (session.screen === 'over') showOver();
    else if (session.screen === 'allocate') showAllocate();
    else if (session.screen === 'clear') showClear();
  }

  drawSession(ctx, session, t, input.stick, saveStore.data.best);

  requestAnimationFrame(frame);
}

document.getElementById('btnPlay').addEventListener('click', () => { audio.click(); showSelect(); });
const btnNgPlus = document.getElementById('btnNgPlus');
if (btnNgPlus) {
  btnNgPlus.addEventListener('click', () => { audio.click(); startNgPlus(); });
}
document.getElementById('btnHow').addEventListener('click', () => {
  audio.click();
  document.getElementById('howPanel').classList.toggle('hidden');
});
const btnContinue = document.getElementById('btnContinue');
if (btnContinue) {
  btnContinue.addEventListener('click', () => { audio.click(); showContinue(); });
}
document.getElementById('btnRetry').addEventListener('click', () => {
  audio.click();
  // Full stage restart — drop continue snapshot
  session.lastDeathCheckpoint = null;
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
const btnClearNg = document.getElementById('btnClearNgPlus');
if (btnClearNg) {
  btnClearNg.addEventListener('click', () => { audio.click(); startNgPlus(); });
}
document.getElementById('btnAllocDone').addEventListener('click', () => {
  audio.click();
  session.finishAllocate();
  showClear();
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
  for (const id of ['versionTag', 'versionMenu', 'versionOver', 'versionSelect', 'versionClear', 'versionAlloc']) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (id === 'versionMenu' || id === 'versionSelect') el.textContent = label + ' · PWA ready';
    else if (id === 'versionTag') el.textContent = label;
    else el.textContent = label;
  }
}

function safeReloadForUpdate() {
  if (window.__reloaded) return;
  if (session.screen === 'play' || session.screen === 'levelup' || session.screen === 'allocate') {
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
    if (reg.installing) {
      const w = reg.installing;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          w.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          w.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
    const checkForUpdate = () => { reg.update().catch(() => {}); };
    checkForUpdate();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkForUpdate();
    });
    window.addEventListener('focus', checkForUpdate);
    setInterval(checkForUpdate, 60 * 1000);
    navigator.serviceWorker.addEventListener('controllerchange', () => safeReloadForUpdate());
  }).catch(err => console.warn('[sw]', err));

  function checkRemoteVersion() {
    if (session.screen === 'play' || session.screen === 'levelup' || session.screen === 'allocate') return;
    fetch('js/config/index.js', { cache: 'no-store' })
      .then(r => r.ok ? r.text() : '')
      .then(text => {
        const m = text.match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
        if (m && m[1] && m[1] !== GAME_VERSION) safeReloadForUpdate();
      })
      .catch(() => {});
  }
  checkRemoteVersion();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkRemoteVersion();
  });
  setInterval(checkRemoteVersion, 2 * 60 * 1000);
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
