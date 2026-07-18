/** Adapter: localStorage persistence. */

const SAVE_KEY = 'ironvale-v1';

function defaultSave() {
  return { best: 0, games: 0, bestWave: 0, totalKills: 0, muted: false };
}

function readStorage() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return { ...defaultSave(), ...JSON.parse(raw) };
  } catch {
    return defaultSave();
  }
}

function writeStorage(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* quota / private mode */ }
}

export function createSaveStore() {
  const data = readStorage();
  return {
    get data() { return data; },
    persist() { writeStorage(data); },
    recordGameEnd(score, wave, kills) {
      data.games += 1;
      data.totalKills += kills;
      if (score > data.best) data.best = score;
      if (wave > data.bestWave) data.bestWave = wave;
      writeStorage(data);
    },
    setMuted(muted) {
      data.muted = !!muted;
      writeStorage(data);
    },
    toggleMuted() {
      data.muted = !data.muted;
      writeStorage(data);
      return data.muted;
    },
  };
}
