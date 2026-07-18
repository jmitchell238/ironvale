/** Adapter: localStorage persistence (campaign + RPG meta). */

import { defaultMeta, normalizeMeta } from '../domain/rpg.js';

const SAVE_KEY = 'ironvale-v1';

function defaultSave() {
  const meta = defaultMeta();
  return {
    best: 0,
    games: 0,
    bestWave: 0,
    totalKills: 0,
    muted: false,
    // RPG (also mirrored under nested shape for clarity)
    xp: meta.xp,
    level: meta.level,
    unspentPoints: meta.unspentPoints,
    stats: meta.stats,
    levelUnlocked: meta.levelUnlocked,
  };
}

function readStorage() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const base = defaultSave();
    const merged = { ...base, ...parsed };
    // Normalize RPG fields through domain
    const meta = normalizeMeta(merged);
    merged.xp = meta.xp;
    merged.level = meta.level;
    merged.unspentPoints = meta.unspentPoints;
    merged.stats = meta.stats;
    merged.levelUnlocked = meta.levelUnlocked;
    return merged;
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

    /** @returns {import('../domain/rpg.js').defaultMeta extends Function ? ReturnType<typeof defaultMeta> : never} */
    getMeta() {
      return normalizeMeta(data);
    },

    /**
     * Write RPG meta fields into save blob.
     * @param {ReturnType<typeof defaultMeta>} meta
     */
    saveMeta(meta) {
      const m = normalizeMeta(meta);
      data.xp = m.xp;
      data.level = m.level;
      data.unspentPoints = m.unspentPoints;
      data.stats = { ...m.stats };
      data.levelUnlocked = m.levelUnlocked;
      writeStorage(data);
    },

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

/** In-memory save for tests (no localStorage). */
export function createMemorySave(seed = {}) {
  const data = { ...defaultSave(), ...seed };
  if (seed.stats) data.stats = { ...defaultMeta().stats, ...seed.stats };
  const store = {
    get data() { return data; },
    persist() {},
    getMeta() { return normalizeMeta(data); },
    saveMeta(meta) {
      const m = normalizeMeta(meta);
      data.xp = m.xp;
      data.level = m.level;
      data.unspentPoints = m.unspentPoints;
      data.stats = { ...m.stats };
      data.levelUnlocked = m.levelUnlocked;
    },
    recordGameEnd(score, wave, kills) {
      data.games += 1;
      data.totalKills += kills;
      if (score > data.best) data.best = score;
      if (wave > data.bestWave) data.bestWave = wave;
    },
    setMuted(muted) { data.muted = !!muted; },
    toggleMuted() { data.muted = !data.muted; return data.muted; },
  };
  return store;
}
