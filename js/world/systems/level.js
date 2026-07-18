/**
 * Level system — bounds, encounters, gate, boss arena, progress tick.
 */

import { CAM, GROUND_Y, ENEMIES } from '../../config/index.js';
import {
  getLevelById, listLevels, buildLevelPlatforms, nextLevel,
  playerWorldLimits,
} from '../../domain/levels.js';
import { isLevelUnlocked } from '../../domain/rpg.js';
import { makePlayer } from '../../domain/player.js';
import { spawnEnemy } from './enemy.js';

/**
 * Active world limits for the player (arena when boss, else level bounds).
 * @param {import('../GameSession.js').GameSession} session
 * @returns {{ minX: number, maxX: number }}
 */
export function getPlayerBounds(session) {
  if (session.arena) {
    return {
      minX: session.arena.minX + 20,
      maxX: session.arena.maxX - 20,
    };
  }
  if (session.level) return playerWorldLimits(session.level);
  return { minX: 24, maxX: 1e9 };
}

/** @param {import('../GameSession.js').GameSession} session */
export function getGateX(session) {
  return session.level ? session.level.gateX : null;
}

/** @param {import('../GameSession.js').GameSession} session */
export function allEncountersFired(session) {
  if (!session.level) return true;
  return session.level.encounters.every(e => session.firedEncounters.has(e.id));
}

/** True once gate is reachable (encounters done, not yet in boss). */
export function isGateOpen(session) {
  if (!session.level || session.levelPhase !== 'explore') return false;
  if (session.bossSpawned) return false;
  return allEncountersFired(session) && session.enemies.length === 0;
}

/**
 * @param {import('../GameSession.js').GameSession} session
 * @param {object} enc
 */
export function fireEncounter(session, enc) {
  if (session.firedEncounters.has(enc.id)) return;
  session.firedEncounters.add(enc.id);
  for (const spec of enc.enemies) {
    spawnEnemy(session, spec.type, { x: spec.x, y: spec.y });
  }
}

/**
 * @param {import('../GameSession.js').GameSession} session
 */
export function enterBossArena(session) {
  if (!session.level || session.bossSpawned) return;
  const b = session.level.boss;
  session.bossSpawned = true;
  session.levelPhase = 'boss';
  session.arena = { minX: b.arenaMinX, maxX: b.arenaMaxX };
  const bossType = b.type || 'boss';
  const boss = spawnEnemy(session, bossType, {
    x: b.spawnX,
    y: b.spawnY ?? GROUND_Y,
    isBoss: true,
  });
  if (boss) {
    const baseHp = ENEMIES[bossType]?.hp ?? ENEMIES.boss.hp;
    boss.hp = baseHp * (1 + (session.wave - 1) * 0.08);
    boss.maxHp = boss.hp;
    boss.patrolMin = b.arenaMinX + 24;
    boss.patrolMax = b.arenaMaxX - 24;
    boss.homeX = boss.x;
    boss.homeY = boss.y;
    boss.isBoss = true;
  }
  session.shake = Math.max(session.shake, 2.5);
}

/** Encounter triggers + boss gate. */
export function updateLevelProgress(session) {
  if (!session.level || session.levelPhase === 'done') return;
  const px = session.player?.x;
  if (px == null) return;

  if (session.levelPhase === 'explore') {
    for (const enc of session.level.encounters) {
      if (!session.firedEncounters.has(enc.id) && px >= enc.triggerX) {
        fireEncounter(session, enc);
      }
    }
    if (isGateOpen(session) && px >= session.level.gateX) {
      enterBossArena(session);
    }
  }
}

/**
 * Load level definition into an empty session (caller should _initEmpty first).
 * @param {import('../GameSession.js').GameSession} session
 * @param {string} [levelId]
 * @returns {boolean}
 */
export function loadLevelIntoSession(session, levelId) {
  const def = levelId ? getLevelById(levelId) : listLevels()[0];
  if (!def) return false;

  session.meta = session._loadMetaFromSave();
  if (!isLevelUnlocked(session.meta, def.order)) return false;

  session._initEmpty();
  session.level = def;
  session.wave = def.order;
  session.player = makePlayer();
  session.player.x = def.spawn.x;
  session.player.y = def.spawn.y ?? GROUND_Y;
  session._applyMetaToRun();
  session.platforms = buildLevelPlatforms(def);
  session.cameraX = Math.max(0, def.spawn.x - CAM.focusX);
  session.levelPhase = 'explore';
  session.screen = 'play';
  return true;
}

/**
 * @param {import('../GameSession.js').GameSession} session
 * @returns {import('../../domain/levels.js').LevelDef | null}
 */
export function getNextLevel(session) {
  const n = session.level ? nextLevel(session.level) : null;
  if (!n) return null;
  if (!isLevelUnlocked(session.meta, n.order)) return null;
  return n;
}

export { listLevels, getLevelById, nextLevel };
