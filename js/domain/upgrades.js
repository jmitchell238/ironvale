/**
 * Domain: run-time combat stats + blessing cards (current endless model).
 * Future RPG attributes will live alongside this, not inside combat.js.
 */

import { PLAYER_SWORD } from '../config/index.js';
import { shuffle } from '../core/math.js';
import { UPGRADES } from '../config/index.js';

export function defaultStats() {
  return {
    damage: PLAYER_SWORD.attackDamage,
    attackRate: 1,
    speedMul: 1,
    jumpMul: 1,
    rangeMul: 1,
  };
}

export function pickLevelUpChoices(player) {
  const owned = player._owned || (player._owned = {});
  const pool = UPGRADES.filter(u => {
    if (u.id === 'heal') return player.hp < player.maxHp;
    const c = owned[u.id] || 0;
    if (u.max != null && c >= u.max) return false;
    return true;
  });
  shuffle(pool);
  const choices = pool.slice(0, 3);
  while (choices.length < 3) choices.push(UPGRADES[0]);
  return choices;
}

/**
 * Apply one blessing. Mutates player + stats.
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
