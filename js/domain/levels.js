/**
 * Domain: campaign level definitions + pure helpers.
 * Layout/spawns live here — not in render.
 */

import { GROUND_Y, W } from '../config/index.js';
import { makePlatform } from './platforms.js';

/**
 * @typedef {{ type: string, x?: number, y?: number }} LevelEnemySpawn
 * @typedef {{ id: string, triggerX: number, enemies: LevelEnemySpawn[] }} LevelEncounter
 * @typedef {{
 *   id: string,
 *   name: string,
 *   subtitle: string,
 *   order: number,
 *   stub?: boolean,
 *   bounds: { minX: number, maxX: number },
 *   spawn: { x: number, y: number },
 *   platforms: { x: number, y: number, w: number }[],
 *   encounters: LevelEncounter[],
 *   gateX: number,
 *   boss: {
 *     type: string,
 *     arenaMinX: number,
 *     arenaMaxX: number,
 *     spawnX: number,
 *     spawnY?: number,
 *   },
 *   clearBonus: number,
 * }} LevelDef
 */

/** @type {LevelDef[]} */
export const LEVELS = [
  {
    id: 'outer-vale',
    name: 'Outer Vale',
    subtitle: 'Learn run, jump, and slash',
    order: 1,
    stub: true,
    bounds: { minX: 0, maxX: 2200 },
    spawn: { x: 80, y: GROUND_Y },
    platforms: [
      { x: -40, y: GROUND_Y, w: 560 },
      { x: 420, y: GROUND_Y - 55, w: 120 },
      { x: 620, y: GROUND_Y, w: 280 },
      { x: 860, y: GROUND_Y - 50, w: 110 },
      { x: 1020, y: GROUND_Y, w: 320 },
      { x: 1280, y: GROUND_Y - 48, w: 100 },
      { x: 1420, y: GROUND_Y, w: 400 },
      // Boss arena floor
      { x: 1750, y: GROUND_Y, w: 500 },
    ],
    encounters: [
      {
        id: 'ov-1',
        triggerX: 280,
        enemies: [
          { type: 'slime', x: 360 },
          { type: 'slime', x: 420 },
        ],
      },
      {
        id: 'ov-2',
        triggerX: 700,
        enemies: [
          { type: 'slime', x: 780 },
          { type: 'bandit', x: 860 },
        ],
      },
      {
        id: 'ov-3',
        triggerX: 1150,
        enemies: [
          { type: 'bandit', x: 1220 },
          { type: 'slime', x: 1300 },
          { type: 'slime', x: 1360 },
        ],
      },
    ],
    gateX: 1700,
    boss: {
      type: 'boss',
      arenaMinX: 1750,
      arenaMaxX: 2180,
      spawnX: 2000,
      spawnY: GROUND_Y,
    },
    clearBonus: 80,
  },
  {
    id: 'ruined-road',
    name: 'Ruined Road',
    subtitle: 'Stub — tighter path (P2)',
    order: 2,
    stub: true,
    bounds: { minX: 0, maxX: 1800 },
    spawn: { x: 80, y: GROUND_Y },
    platforms: [
      { x: -40, y: GROUND_Y, w: 400 },
      { x: 300, y: GROUND_Y - 50, w: 100 },
      { x: 480, y: GROUND_Y, w: 220 },
      { x: 760, y: GROUND_Y - 55, w: 96 },
      { x: 920, y: GROUND_Y, w: 280 },
      { x: 1300, y: GROUND_Y, w: 520 },
    ],
    encounters: [
      {
        id: 'rr-1',
        triggerX: 200,
        enemies: [
          { type: 'skeleton', x: 280 },
          { type: 'slime', x: 340 },
        ],
      },
      {
        id: 'rr-2',
        triggerX: 600,
        enemies: [
          { type: 'skeleton', x: 700 },
          { type: 'bandit', x: 780 },
        ],
      },
    ],
    gateX: 1250,
    boss: {
      type: 'boss',
      arenaMinX: 1300,
      arenaMaxX: 1750,
      spawnX: 1550,
      spawnY: GROUND_Y,
    },
    clearBonus: 100,
  },
  {
    id: 'iron-gate',
    name: 'Iron Gate',
    subtitle: 'Stub — first wall (P2)',
    order: 3,
    stub: true,
    bounds: { minX: 0, maxX: 2000 },
    spawn: { x: 80, y: GROUND_Y },
    platforms: [
      { x: -40, y: GROUND_Y, w: 480 },
      { x: 380, y: GROUND_Y - 52, w: 110 },
      { x: 560, y: GROUND_Y, w: 300 },
      { x: 920, y: GROUND_Y - 55, w: 120 },
      { x: 1100, y: GROUND_Y, w: 260 },
      { x: 1450, y: GROUND_Y, w: 580 },
    ],
    encounters: [
      {
        id: 'ig-1',
        triggerX: 220,
        enemies: [
          { type: 'bandit', x: 300 },
          { type: 'ogre', x: 400 },
        ],
      },
      {
        id: 'ig-2',
        triggerX: 700,
        enemies: [
          { type: 'ogre', x: 820 },
          { type: 'skeleton', x: 900 },
          { type: 'bandit', x: 980 },
        ],
      },
    ],
    gateX: 1400,
    boss: {
      type: 'boss',
      arenaMinX: 1450,
      arenaMaxX: 1950,
      spawnX: 1700,
      spawnY: GROUND_Y,
    },
    clearBonus: 150,
  },
];

/**
 * @param {string} id
 * @returns {LevelDef | null}
 */
export function getLevelById(id) {
  return LEVELS.find(l => l.id === id) || null;
}

/**
 * @param {number} order
 * @returns {LevelDef | null}
 */
export function getLevelByOrder(order) {
  return LEVELS.find(l => l.order === order) || null;
}

/** @returns {LevelDef[]} */
export function listLevels() {
  return LEVELS.slice().sort((a, b) => a.order - b.order);
}

/**
 * @param {LevelDef} def
 * @returns {ReturnType<typeof makePlatform>[]}
 */
export function buildLevelPlatforms(def) {
  return (def.platforms || []).map(p => makePlatform(p.x, p.y, p.w));
}

/**
 * Next campaign stage after `def`, or null if campaign complete.
 * @param {LevelDef} def
 * @returns {LevelDef | null}
 */
export function nextLevel(def) {
  if (!def) return null;
  return getLevelByOrder(def.order + 1);
}

/**
 * World X clamp limits for camera (keep playfield inside bounds).
 * @param {LevelDef} def
 * @param {number} [viewW=W]
 */
export function cameraLimits(def, viewW = W) {
  const minX = def.bounds.minX;
  const maxX = Math.max(minX, def.bounds.maxX - viewW);
  return { minX, maxX };
}

/**
 * @param {LevelDef} def
 * @returns {{ minX: number, maxX: number }}
 */
export function playerWorldLimits(def) {
  return {
    minX: def.bounds.minX + 24,
    maxX: def.bounds.maxX - 24,
  };
}
