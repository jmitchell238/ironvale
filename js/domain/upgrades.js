/**
 * Domain: run-time combat stats.
 *
 * Blessing cards (pick 1 of 3) are retired for campaign RPG —
 * use domain/rpg.js attributes between stages instead.
 * defaultStats remains for tests / fallbacks.
 */

import { PLAYER_SWORD } from '../config/index.js';
import { attrsToCombatStats, defaultAttrs } from './rpg.js';

/** Base combat stats (no attributes invested). */
export function defaultStats() {
  return attrsToCombatStats(defaultAttrs());
}

/**
 * @deprecated Campaign uses persistent RPG allocate between levels.
 * Kept so older tests / tooling can still import the shape.
 */
export function pickLevelUpChoices() {
  return [];
}

/**
 * @deprecated Prefer allocatePoint in domain/rpg.js.
 */
export function applyUpgradeToRun(player, stats, up) {
  if (!up || !player || !stats) return;
  const owned = player._owned || (player._owned = {});
  owned[up.id] = (owned[up.id] || 0) + 1;
  switch (up.id) {
    case 'dmg': stats.damage *= 1.2; break;
    case 'rate': stats.attackRate *= 1.15; break;
    case 'speed': stats.speedMul *= 1.12; break;
    case 'jump': stats.jumpMul *= 1.12; break;
    case 'range': stats.rangeMul *= 1.2; break;
    case 'hp':
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
      break;
    case 'heal':
      player.hp = Math.min(player.maxHp, player.hp + 40);
      break;
  }
}

// re-export for convenience
export { attrsToCombatStats, defaultAttrs };
