/**
 * Domain: persistent RPG progression (pure).
 *
 * XP levels mid-stage bank unspent attribute points.
 * Allocation (STR/VIT/SPD/AGI/DEX/Reach) only between stages.
 */

import { PLAYER_MOVE, PLAYER_SWORD, xpForLevel } from '../config/index.js';

/** @typedef {'str'|'vit'|'spd'|'agi'|'dex'|'reach'} AttrKey */

/** @type {AttrKey[]} */
export const ATTR_KEYS = ['str', 'vit', 'spd', 'agi', 'dex', 'reach'];

export const ATTR_INFO = {
  str:   { name: 'STR',   label: 'Strength',  desc: '+sword damage' },
  vit:   { name: 'VIT',   label: 'Vitality',  desc: '+max HP' },
  spd:   { name: 'SPD',   label: 'Speed',     desc: '+run speed' },
  agi:   { name: 'AGI',   label: 'Agility',   desc: '+jump height' },
  dex:   { name: 'DEX',   label: 'Dexterity', desc: '+attack speed' },
  reach: { name: 'REACH', label: 'Reach',     desc: '+sword range' },
};

/** Per-point combat scaling (kept modest so early game stays fair). */
export const ATTR_SCALE = {
  strDamage: 4,
  vitHp: 12,
  spdMul: 0.06,
  agiJumpMul: 0.06,
  dexRateMul: 0.08,
  reachMul: 0.08,
};

/**
 * @returns {{ str: number, vit: number, spd: number, agi: number, dex: number, reach: number }}
 */
export function defaultAttrs() {
  return { str: 0, vit: 0, spd: 0, agi: 0, dex: 0, reach: 0 };
}

/**
 * Persistent campaign meta (not a single stage run).
 * @returns {{
 *   xp: number,
 *   level: number,
 *   unspentPoints: number,
 *   stats: ReturnType<typeof defaultAttrs>,
 *   levelUnlocked: number,
 *   ngPlus: number,
 *   campaignCleared: boolean,
 * }}
 */
export function defaultMeta() {
  return {
    xp: 0,
    level: 1,
    unspentPoints: 0,
    stats: defaultAttrs(),
    levelUnlocked: 1,
    ngPlus: 0,
    campaignCleared: false,
  };
}

/**
 * Normalize partial save / injected meta into a full meta object.
 * @param {object} [raw]
 */
export function normalizeMeta(raw) {
  const base = defaultMeta();
  if (!raw || typeof raw !== 'object') return base;
  const stats = defaultAttrs();
  const src = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  for (const k of ATTR_KEYS) {
    const v = Number(src[k]);
    stats[k] = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  }
  return {
    xp: Math.max(0, Math.floor(Number(raw.xp) || 0)),
    level: Math.max(1, Math.floor(Number(raw.level) || 1)),
    unspentPoints: Math.max(0, Math.floor(Number(raw.unspentPoints) || 0)),
    stats,
    levelUnlocked: Math.max(1, Math.floor(Number(raw.levelUnlocked) || 1)),
    ngPlus: Math.max(0, Math.floor(Number(raw.ngPlus) || 0)),
    campaignCleared: !!raw.campaignCleared,
  };
}

/**
 * Deep-ish clone for session ownership.
 * @param {ReturnType<typeof defaultMeta>} meta
 */
export function cloneMeta(meta) {
  return normalizeMeta(meta);
}

/**
 * XP required to go from `level` → level+1.
 * @param {number} level
 */
export function xpToNext(level) {
  return xpForLevel(Math.max(1, level));
}

/**
 * Apply XP to meta. Mid-stage and between-stage both use this;
 * levels only bank unspentPoints (no allocation).
 *
 * Mutates `meta`.
 * @param {ReturnType<typeof defaultMeta>} meta
 * @param {number} amount
 * @returns {{ levelsGained: number, pointsGained: number }}
 */
export function applyXp(meta, amount) {
  const n = Math.floor(Number(amount) || 0);
  if (!meta || n <= 0) return { levelsGained: 0, pointsGained: 0 };
  meta.xp += n;
  let levelsGained = 0;
  let pointsGained = 0;
  // Safety cap against runaway loops
  for (let i = 0; i < 50; i++) {
    const need = xpToNext(meta.level);
    if (meta.xp < need) break;
    meta.xp -= need;
    meta.level += 1;
    meta.unspentPoints += 1;
    levelsGained += 1;
    pointsGained += 1;
  }
  return { levelsGained, pointsGained };
}

/**
 * Spend one unspent point into an attribute. Between levels only (caller enforces).
 * Mutates `meta`.
 * @param {ReturnType<typeof defaultMeta>} meta
 * @param {AttrKey|string} attrKey
 * @returns {boolean}
 */
export function allocatePoint(meta, attrKey) {
  if (!meta || meta.unspentPoints <= 0) return false;
  if (!ATTR_KEYS.includes(/** @type {AttrKey} */ (attrKey))) return false;
  meta.unspentPoints -= 1;
  meta.stats[attrKey] = (meta.stats[attrKey] || 0) + 1;
  return true;
}

/**
 * Combat run stats derived from allocated attributes.
 * @param {ReturnType<typeof defaultAttrs>} attrs
 */
export function attrsToCombatStats(attrs) {
  const a = attrs || defaultAttrs();
  return {
    damage: PLAYER_SWORD.attackDamage + (a.str || 0) * ATTR_SCALE.strDamage,
    attackRate: 1 + (a.dex || 0) * ATTR_SCALE.dexRateMul,
    speedMul: 1 + (a.spd || 0) * ATTR_SCALE.spdMul,
    jumpMul: 1 + (a.agi || 0) * ATTR_SCALE.agiJumpMul,
    rangeMul: 1 + (a.reach || 0) * ATTR_SCALE.reachMul,
  };
}

/**
 * @param {ReturnType<typeof defaultAttrs>} attrs
 */
export function attrsToMaxHp(attrs) {
  const a = attrs || defaultAttrs();
  return PLAYER_MOVE.maxHp + (a.vit || 0) * ATTR_SCALE.vitHp;
}

/**
 * Whether stage `order` is unlocked given meta.
 * @param {ReturnType<typeof defaultMeta>} meta
 * @param {number} order
 */
export function isLevelUnlocked(meta, order) {
  if (!meta) return order <= 1;
  return order <= meta.levelUnlocked;
}

/**
 * After clearing a stage of `order`, unlock the next (order+1).
 * Mutates `meta`.
 * @param {ReturnType<typeof defaultMeta>} meta
 * @param {number} clearedOrder
 * @param {number} [maxOrder]
 */
export function unlockAfterClear(meta, clearedOrder, maxOrder = 99) {
  if (!meta) return;
  const next = Math.min(maxOrder, Math.floor(clearedOrder) + 1);
  if (next > meta.levelUnlocked) meta.levelUnlocked = next;
}

/**
 * Mark campaign cleared when the final stage is beaten.
 * Mutates `meta`.
 * @param {ReturnType<typeof defaultMeta>} meta
 * @param {number} clearedOrder
 * @param {number} maxOrder
 */
export function markCampaignCleared(meta, clearedOrder, maxOrder) {
  if (!meta) return;
  if (Math.floor(clearedOrder) >= Math.floor(maxOrder)) {
    meta.campaignCleared = true;
  }
}

/**
 * Start New Game+: keep hero RPG, reset stage unlocks, bump cycle.
 * Mutates `meta`.
 * @param {ReturnType<typeof defaultMeta>} meta
 * @returns {boolean} true if NG+ started
 */
export function startNewGamePlus(meta) {
  if (!meta || !meta.campaignCleared) return false;
  meta.ngPlus = (meta.ngPlus || 0) + 1;
  meta.levelUnlocked = 1;
  // Stay campaign-cleared so NG+ remains available after another clear
  return true;
}

/**
 * Enemy HP multiplier from NG+ cycle.
 * @param {ReturnType<typeof defaultMeta>|null} meta
 * @param {{ hpPerCycle?: number }} [cfg]
 */
export function ngPlusHpMul(meta, cfg = {}) {
  const cycle = meta?.ngPlus || 0;
  if (cycle <= 0) return 1;
  const per = cfg.hpPerCycle ?? 0.35;
  return 1 + cycle * per;
}

/**
 * Enemy damage multiplier from NG+ cycle.
 * @param {ReturnType<typeof defaultMeta>|null} meta
 * @param {{ damagePerCycle?: number }} [cfg]
 */
export function ngPlusDamageMul(meta, cfg = {}) {
  const cycle = meta?.ngPlus || 0;
  if (cycle <= 0) return 1;
  const per = cfg.damagePerCycle ?? 0.15;
  return 1 + cycle * per;
}
