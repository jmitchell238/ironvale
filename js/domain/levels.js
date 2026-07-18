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

/**
 * Outer Vale — P2 prototype level 1 (difficulty baseline).
 * Teaching path: run → slash slime → jump platforms → light bandits → captain.
 */
const OUTER_VALE = {
  id: 'outer-vale',
  name: 'Outer Vale',
  subtitle: 'Learn run, jump, and slash',
  order: 1,
  stub: false,
  bounds: { minX: 0, maxX: 3200 },
  spawn: { x: 80, y: GROUND_Y },
  // Authored layout: gentle rises + short gaps (single-jump safe).
  platforms: [
    // Intro ground — run space
    { x: -40, y: GROUND_Y, w: 480 },
    // First teaching ledge (overlap ground so climb is free)
    { x: 360, y: GROUND_Y - 48, w: 150 },
    { x: 560, y: GROUND_Y, w: 260 },
    // Low perch over continuous ground path
    { x: 880, y: GROUND_Y, w: 220 },
    { x: 1080, y: GROUND_Y - 50, w: 130 },
    { x: 1260, y: GROUND_Y, w: 280 },
    // Twin steps (short gaps, modest height)
    { x: 1580, y: GROUND_Y - 38, w: 120 },
    { x: 1740, y: GROUND_Y - 52, w: 120 },
    { x: 1920, y: GROUND_Y, w: 300 },
    // Ridge before gate
    { x: 2260, y: GROUND_Y - 48, w: 140 },
    { x: 2440, y: GROUND_Y, w: 300 },
    // Boss arena floor (wide)
    { x: 2780, y: GROUND_Y, w: 460 },
  ],
  encounters: [
    // Teach slash — single slime on open ground
    {
      id: 'ov-slash',
      triggerX: 200,
      enemies: [{ type: 'slime', x: 300 }],
    },
    // Teach jump + elevated target
    {
      id: 'ov-jump',
      triggerX: 340,
      enemies: [{ type: 'slime', x: 430, y: GROUND_Y - 48 }],
    },
    // Multi slime pack
    {
      id: 'ov-pack',
      triggerX: 760,
      enemies: [
        { type: 'slime', x: 840 },
        { type: 'slime', x: 920 },
      ],
    },
    // First bandit (light) with slime support
    {
      id: 'ov-bandit',
      triggerX: 1120,
      enemies: [
        { type: 'bandit', x: 1220 },
        { type: 'slime', x: 1340 },
      ],
    },
    // Platform bandits — pressure while jumping
    {
      id: 'ov-steps',
      triggerX: 1540,
      enemies: [
        { type: 'slime', x: 1630, y: GROUND_Y - 38 },
        { type: 'bandit', x: 1800, y: GROUND_Y - 52 },
      ],
    },
    // Pre-gate mixed (still baseline)
    {
      id: 'ov-gate-guard',
      triggerX: 2220,
      enemies: [
        { type: 'bandit', x: 2320 },
        { type: 'slime', x: 2420 },
        { type: 'slime', x: 2520 },
      ],
    },
  ],
  gateX: 2700,
  boss: {
    type: 'bandit_captain',
    arenaMinX: 2780,
    arenaMaxX: 3180,
    spawnX: 2980,
    spawnY: GROUND_Y,
  },
  clearBonus: 100,
};

/** @type {LevelDef[]} */
export const LEVELS = [
  OUTER_VALE,
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
