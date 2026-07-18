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

/**
 * Ruined Road — P2 prototype level 2 (harder than Outer Vale).
 * Tighter platforms, skeleton-heavy roster, skeleton champion boss.
 */
const RUINED_ROAD = {
  id: 'ruined-road',
  name: 'Ruined Road',
  subtitle: 'Tighter path — bones and broken stone',
  order: 2,
  stub: false,
  bounds: { minX: 0, maxX: 3320 },
  spawn: { x: 80, y: GROUND_Y },
  // Authored layout: narrower ledges, more height changes than L1 (jump-safe).
  platforms: [
    // Short intro stretch
    { x: -40, y: GROUND_Y, w: 320 },
    // Overlapped tight rise
    { x: 250, y: GROUND_Y - 52, w: 115 },
    { x: 420, y: GROUND_Y, w: 150 },
    // Elevated hop chain
    { x: 620, y: GROUND_Y - 44, w: 100 },
    { x: 770, y: GROUND_Y - 60, w: 100 },
    { x: 920, y: GROUND_Y, w: 160 },
    // Crumble steps (narrow)
    { x: 1130, y: GROUND_Y - 48, w: 100 },
    { x: 1280, y: GROUND_Y - 36, w: 100 },
    { x: 1430, y: GROUND_Y - 56, w: 100 },
    { x: 1580, y: GROUND_Y, w: 170 },
    // Twin ridge (vertical pressure)
    { x: 1800, y: GROUND_Y - 48, w: 105 },
    { x: 1955, y: GROUND_Y - 62, w: 100 },
    { x: 2110, y: GROUND_Y, w: 160 },
    // Pre-gate gauntlet
    { x: 2320, y: GROUND_Y - 50, w: 110 },
    { x: 2480, y: GROUND_Y - 38, w: 110 },
    { x: 2640, y: GROUND_Y, w: 180 },
    // Boss arena floor
    { x: 2860, y: GROUND_Y, w: 420 },
  ],
  encounters: [
    // First skeleton on open ground
    {
      id: 'rr-bones',
      triggerX: 140,
      enemies: [{ type: 'skeleton', x: 230 }],
    },
    // Elevated skeleton + slime support
    {
      id: 'rr-rise',
      triggerX: 220,
      enemies: [
        { type: 'skeleton', x: 300, y: GROUND_Y - 52 },
        { type: 'slime', x: 480 },
      ],
    },
    // Hop-chain pressure
    {
      id: 'rr-hops',
      triggerX: 560,
      enemies: [
        { type: 'skeleton', x: 670, y: GROUND_Y - 44 },
        { type: 'skeleton', x: 820, y: GROUND_Y - 60 },
      ],
    },
    // Crumble steps — mixed
    {
      id: 'rr-steps',
      triggerX: 1060,
      enemies: [
        { type: 'skeleton', x: 1180, y: GROUND_Y - 48 },
        { type: 'bandit', x: 1330, y: GROUND_Y - 36 },
        { type: 'skeleton', x: 1480, y: GROUND_Y - 56 },
      ],
    },
    // Twin ridge — denser
    {
      id: 'rr-ridge',
      triggerX: 1720,
      enemies: [
        { type: 'skeleton', x: 1850, y: GROUND_Y - 48 },
        { type: 'skeleton', x: 2005, y: GROUND_Y - 62 },
        { type: 'bandit', x: 2180 },
      ],
    },
    // Pre-gate gauntlet
    {
      id: 'rr-gate-guard',
      triggerX: 2260,
      enemies: [
        { type: 'skeleton', x: 2370, y: GROUND_Y - 50 },
        { type: 'skeleton', x: 2530, y: GROUND_Y - 38 },
        { type: 'bandit', x: 2700 },
        { type: 'skeleton', x: 2780 },
      ],
    },
  ],
  gateX: 2780,
  boss: {
    type: 'skeleton_champion',
    arenaMinX: 2860,
    arenaMaxX: 3240,
    spawnX: 3060,
    spawnY: GROUND_Y,
  },
  clearBonus: 125,
};

/** @type {LevelDef[]} */
export const LEVELS = [
  OUTER_VALE,
  RUINED_ROAD,
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
