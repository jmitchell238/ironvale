/**
 * Level system — bounds, encounters, gate, boss arena, checkpoints, progress.
 */

import { CAM, GROUND_Y } from '../../config/index.js';
import {
  getLevelById, listLevels, buildLevelPlatforms, nextLevel,
  playerWorldLimits, listCheckpoints,
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
 * Activate checkpoint when player walks past it (mid-stage continue).
 * @param {import('../GameSession.js').GameSession} session
 * @param {{ id: string, x: number, y?: number }} cp
 */
export function activateCheckpoint(session, cp) {
  if (!cp || session.reachedCheckpoints.has(cp.id)) return;
  session.reachedCheckpoints.add(cp.id);
  session.activeCheckpoint = {
    id: cp.id,
    x: cp.x,
    y: cp.y ?? GROUND_Y,
    firedIds: [...session.firedEncounters],
  };
  // Soft juice — gold burst at flag
  if (typeof session.burst === 'function') {
    session.burst(cp.x, (cp.y ?? GROUND_Y) - 20, '#c9a227', 14, 90);
  }
  session.shake = Math.max(session.shake || 0, 0.8);
}

/**
 * @param {import('../GameSession.js').GameSession} session
 */
export function enterBossArena(session) {
  if (!session.level || session.bossSpawned) return;
  const b = session.level.boss;
  session.bossSpawned = true;
  session.levelPhase = 'boss';
  // Boss run has no mid-arena continue
  session.activeCheckpoint = null;
  session.arena = { minX: b.arenaMinX, maxX: b.arenaMaxX };
  const bossType = b.type || 'boss';
  const boss = spawnEnemy(session, bossType, {
    x: b.spawnX,
    y: b.spawnY ?? GROUND_Y,
    isBoss: true,
  });
  if (boss) {
    // HP already scaled by wave + NG+ in spawnEnemy
    boss.patrolMin = b.arenaMinX + 24;
    boss.patrolMax = b.arenaMaxX - 24;
    boss.homeX = boss.x;
    boss.homeY = boss.y;
    boss.isBoss = true;
  }
  session.shake = Math.max(session.shake, 2.5);
  if (typeof session.burst === 'function') {
    session.burst(b.spawnX, (b.spawnY ?? GROUND_Y) - 30, '#e74c3c', 22, 140);
  }
}

/** Encounter triggers + checkpoints + boss gate. */
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
    for (const cp of listCheckpoints(session.level)) {
      if (px >= cp.x) activateCheckpoint(session, cp);
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
 * @param {{ fromCheckpoint?: boolean }} [opts]
 * @returns {boolean}
 */
export function loadLevelIntoSession(session, levelId, opts = {}) {
  const def = levelId ? getLevelById(levelId) : listLevels()[0];
  if (!def) return false;

  session.meta = session._loadMetaFromSave();
  if (!isLevelUnlocked(session.meta, def.order)) return false;

  // Capture continue snapshot before wipe (retry from checkpoint)
  const resume = opts.fromCheckpoint ? session.lastDeathCheckpoint : null;
  const resumeOk = resume
    && resume.levelId === def.id
    && Array.isArray(resume.firedIds);

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

  if (resumeOk) {
    for (const id of resume.firedIds) session.firedEncounters.add(id);
    session.player.x = resume.x;
    session.player.y = resume.y ?? GROUND_Y;
    session.cameraX = Math.max(0, session.player.x - CAM.focusX);
    // Restore active checkpoint so further continues work
    session.activeCheckpoint = {
      id: resume.id,
      x: resume.x,
      y: resume.y ?? GROUND_Y,
      firedIds: [...resume.firedIds],
    };
    session.reachedCheckpoints.add(resume.id);
    // Soft invuln after continue
    session.player.inv = 1.2;
  }

  session.lastDeathCheckpoint = null;
  return true;
}

/**
 * Snapshot checkpoint for the over-screen Continue action.
 * @param {import('../GameSession.js').GameSession} session
 */
export function stashDeathCheckpoint(session) {
  if (!session.level || !session.activeCheckpoint || session.levelPhase === 'boss') {
    session.lastDeathCheckpoint = null;
    return;
  }
  const cp = session.activeCheckpoint;
  session.lastDeathCheckpoint = {
    levelId: session.level.id,
    id: cp.id,
    x: cp.x,
    y: cp.y,
    firedIds: [...cp.firedIds],
  };
}

/**
 * @param {import('../GameSession.js').GameSession} session
 * @returns {boolean}
 */
export function hasContinueCheckpoint(session) {
  return !!(session.lastDeathCheckpoint && session.lastDeathCheckpoint.levelId);
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

export { listLevels, getLevelById, nextLevel, listCheckpoints };
