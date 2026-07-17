'use strict';

const SAVE_KEY = 'ironvale-v1';

function defaultSave() {
  return { best: 0, games: 0, bestWave: 0, totalKills: 0, muted: false };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return { ...defaultSave(), ...JSON.parse(raw) };
  } catch { return defaultSave(); }
}

function writeSave(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* */ }
}

let save = loadSave();
function persist() { writeSave(save); }

function recordGameEnd(score, wave, kills) {
  save.games += 1;
  save.totalKills += kills;
  if (score > save.best) save.best = score;
  if (wave > save.bestWave) save.bestWave = wave;
  persist();
}
