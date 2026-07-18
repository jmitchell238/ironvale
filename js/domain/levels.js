/**
 * Domain: campaign level definitions + pure helpers.
 * Layout/spawns live here — not in render.
 *
 * Campaign (10 stages): Outer Vale → … → Ironvale Keep.
 */

import { GROUND_Y, W } from '../config/index.js';
import { buildPlatformsFromDefs } from './platforms.js';

/**
 * @typedef {{ type: string, x?: number, y?: number }} LevelEnemySpawn
 * @typedef {{ id: string, triggerX: number, enemies: LevelEnemySpawn[] }} LevelEncounter
 * @typedef {{ id: string, x: number, y?: number }} LevelCheckpoint
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
 *   checkpoints?: LevelCheckpoint[],
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
 * Outer Vale — teaching stage with Mario-style rhythm.
 * Intro ground → stair climb → gap hop → multi-tier choice → rolling hills → boss.
 * High float platforms are optional shortcuts (main path stays ground-connected).
 */
const G = GROUND_Y;
const OUTER_VALE = {
  id: 'outer-vale',
  name: 'Outer Vale',
  subtitle: 'Learn run, jump, double-jump & duck',
  order: 1,
  stub: false,
  bounds: { minX: 0, maxX: 3720 },
  spawn: { x: 80, y: G },
  platforms: [
    // ── Intro runway (safe teaching space) ──
    { x: -40, y: G, w: 420, style: 'ground' },
    // ── Stair climb (overlapping steps) ──
    { x: 340, y: G - 28, w: 90, style: 'stone' },
    { x: 400, y: G - 52, w: 90, style: 'stone' },
    { x: 460, y: G - 76, w: 100, style: 'stone' },
    // Landing terrace + low ground under (dual path)
    { x: 540, y: G - 76, w: 160, style: 'float' },
    { x: 520, y: G, w: 280, style: 'ground' },
    // Drop down then small hop islands
    { x: 820, y: G, w: 140, style: 'ground' },
    { x: 1000, y: G - 40, w: 80, style: 'float' },
    { x: 1120, y: G - 64, w: 80, style: 'float' },
    { x: 1240, y: G - 40, w: 90, style: 'float' },
    { x: 1380, y: G, w: 220, style: 'ground' },
    // High road (optional) over long ground
    { x: 1520, y: G - 88, w: 100, style: 'float' },
    { x: 1660, y: G - 88, w: 100, style: 'float' },
    { x: 1600, y: G, w: 280, style: 'ground' },
    // Rolling hills / stairs down
    { x: 1900, y: G - 36, w: 100, style: 'stone' },
    { x: 2020, y: G - 60, w: 90, style: 'stone' },
    { x: 2140, y: G - 36, w: 100, style: 'stone' },
    { x: 2260, y: G, w: 200, style: 'ground' },
    // Gap hop series (short gaps, modest rise — jump-safe)
    { x: 2520, y: G, w: 140, style: 'ground' },
    { x: 2680, y: G - 36, w: 100, style: 'float' },
    { x: 2840, y: G, w: 180, style: 'ground' },
    // Pre-gate rise
    { x: 3040, y: G - 40, w: 110, style: 'stone' },
    { x: 3180, y: G, w: 240, style: 'ground' },
    // Boss arena floor (wide)
    { x: 3400, y: G, w: 280, style: 'ground' },
  ],
  encounters: [
    // Teach slash — slime well ahead on open ground
    { id: 'ov-slash', triggerX: 160, enemies: [{ type: 'slime', x: 380 }] },
    // Stair slime
    {
      id: 'ov-jump',
      triggerX: 320,
      enemies: [{ type: 'slime', x: 500, y: G - 76 }],
    },
    // Pack on low ground after stairs
    {
      id: 'ov-pack',
      triggerX: 700,
      enemies: [
        { type: 'slime', x: 900 },
        { type: 'slime', x: 980 },
      ],
    },
    // Bandit after hop islands
    {
      id: 'ov-bandit',
      triggerX: 1280,
      enemies: [
        { type: 'bandit', x: 1480 },
        { type: 'slime', x: 1580 },
      ],
    },
    // Hills pressure
    {
      id: 'ov-steps',
      triggerX: 1860,
      enemies: [
        { type: 'slime', x: 1980, y: G - 36 },
        { type: 'bandit', x: 2100, y: G - 60 },
      ],
    },
    // Pre-gate
    {
      id: 'ov-gate-guard',
      triggerX: 2780,
      enemies: [
        { type: 'bandit', x: 2980 },
        { type: 'slime', x: 3100 },
        { type: 'slime', x: 3220 },
      ],
    },
  ],
  checkpoints: [{ id: 'ov-mid', x: 1450 }],
  gateX: 3340,
  boss: {
    type: 'bandit_captain',
    arenaMinX: 3400,
    arenaMaxX: 3660,
    spawnX: 3540,
    spawnY: G,
  },
  clearBonus: 100,
};

/**
 * Ruined Road — P2 prototype level 2 (harder than Outer Vale).
 */
const RUINED_ROAD = {
  id: 'ruined-road',
  name: 'Ruined Road',
  subtitle: 'Tighter path — bones and broken stone',
  order: 2,
  stub: false,
  bounds: { minX: 0, maxX: 3320 },
  spawn: { x: 80, y: GROUND_Y },
  platforms: [
    { x: -40, y: GROUND_Y, w: 320 },
    { x: 250, y: GROUND_Y - 52, w: 115 },
    { x: 420, y: GROUND_Y, w: 150 },
    { x: 620, y: GROUND_Y - 44, w: 100 },
    { x: 770, y: GROUND_Y - 60, w: 100 },
    { x: 920, y: GROUND_Y, w: 160 },
    { x: 1130, y: GROUND_Y - 48, w: 100 },
    { x: 1280, y: GROUND_Y - 36, w: 100 },
    { x: 1430, y: GROUND_Y - 56, w: 100 },
    { x: 1580, y: GROUND_Y, w: 170 },
    { x: 1800, y: GROUND_Y - 48, w: 105 },
    { x: 1955, y: GROUND_Y - 62, w: 100 },
    { x: 2110, y: GROUND_Y, w: 160 },
    { x: 2320, y: GROUND_Y - 50, w: 110 },
    { x: 2480, y: GROUND_Y - 38, w: 110 },
    { x: 2640, y: GROUND_Y, w: 180 },
    { x: 2860, y: GROUND_Y, w: 420 },
  ],
  encounters: [
    { id: 'rr-bones', triggerX: 140, enemies: [{ type: 'skeleton', x: 230 }] },
    {
      id: 'rr-rise',
      triggerX: 220,
      enemies: [
        { type: 'skeleton', x: 300, y: GROUND_Y - 52 },
        { type: 'slime', x: 480 },
      ],
    },
    {
      id: 'rr-hops',
      triggerX: 560,
      enemies: [
        { type: 'skeleton', x: 670, y: GROUND_Y - 44 },
        { type: 'skeleton', x: 820, y: GROUND_Y - 60 },
      ],
    },
    {
      id: 'rr-steps',
      triggerX: 1060,
      enemies: [
        { type: 'skeleton', x: 1180, y: GROUND_Y - 48 },
        { type: 'bandit', x: 1330, y: GROUND_Y - 36 },
        { type: 'skeleton', x: 1480, y: GROUND_Y - 56 },
      ],
    },
    {
      id: 'rr-ridge',
      triggerX: 1720,
      enemies: [
        { type: 'skeleton', x: 1850, y: GROUND_Y - 48 },
        { type: 'skeleton', x: 2005, y: GROUND_Y - 62 },
        { type: 'bandit', x: 2180 },
      ],
    },
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
  checkpoints: [{ id: 'rr-mid', x: 1620 }],
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

/**
 * Iron Gate — P2 prototype level 3 (first real wall).
 */
const IRON_GATE = {
  id: 'iron-gate',
  name: 'Iron Gate',
  subtitle: 'First wall — ogres and iron',
  order: 3,
  stub: false,
  bounds: { minX: 0, maxX: 3580 },
  spawn: { x: 80, y: GROUND_Y },
  platforms: [
    { x: -40, y: GROUND_Y, w: 360 },
    { x: 280, y: GROUND_Y - 48, w: 120 },
    { x: 450, y: GROUND_Y, w: 200 },
    { x: 700, y: GROUND_Y - 40, w: 110 },
    { x: 860, y: GROUND_Y - 55, w: 110 },
    { x: 1020, y: GROUND_Y, w: 220 },
    { x: 1300, y: GROUND_Y, w: 280 },
    { x: 1520, y: GROUND_Y - 46, w: 110 },
    { x: 1680, y: GROUND_Y - 36, w: 110 },
    { x: 1840, y: GROUND_Y - 52, w: 110 },
    { x: 2000, y: GROUND_Y, w: 200 },
    { x: 2240, y: GROUND_Y - 50, w: 120 },
    { x: 2420, y: GROUND_Y, w: 180 },
    { x: 2640, y: GROUND_Y - 44, w: 115 },
    { x: 2810, y: GROUND_Y, w: 200 },
    { x: 3060, y: GROUND_Y, w: 480 },
  ],
  encounters: [
    {
      id: 'ig-watch',
      triggerX: 160,
      enemies: [
        { type: 'bandit', x: 260 },
        { type: 'skeleton', x: 340, y: GROUND_Y - 48 },
      ],
    },
    {
      id: 'ig-first-ogre',
      triggerX: 400,
      enemies: [{ type: 'ogre', x: 540 }, { type: 'bandit', x: 620 }],
    },
    {
      id: 'ig-hops',
      triggerX: 640,
      enemies: [
        { type: 'skeleton', x: 750, y: GROUND_Y - 40 },
        { type: 'bandit', x: 910, y: GROUND_Y - 55 },
        { type: 'skeleton', x: 1100 },
      ],
    },
    {
      id: 'ig-corridor',
      triggerX: 1200,
      enemies: [
        { type: 'ogre', x: 1380 },
        { type: 'ogre', x: 1500 },
        { type: 'bandit', x: 1460 },
      ],
    },
    {
      id: 'ig-steps',
      triggerX: 1480,
      enemies: [
        { type: 'skeleton', x: 1570, y: GROUND_Y - 46 },
        { type: 'bandit', x: 1730, y: GROUND_Y - 36 },
        { type: 'ogre', x: 1920, y: GROUND_Y - 52 },
      ],
    },
    {
      id: 'ig-perch',
      triggerX: 2140,
      enemies: [
        { type: 'bandit', x: 2300, y: GROUND_Y - 50 },
        { type: 'ogre', x: 2500 },
        { type: 'skeleton', x: 2560 },
      ],
    },
    {
      id: 'ig-gate-guard',
      triggerX: 2580,
      enemies: [
        { type: 'ogre', x: 2700, y: GROUND_Y - 44 },
        { type: 'bandit', x: 2880 },
        { type: 'skeleton', x: 2940 },
        { type: 'ogre', x: 2960 },
      ],
    },
  ],
  checkpoints: [
    { id: 'ig-mid', x: 1080 },
    { id: 'ig-late', x: 2060 },
  ],
  gateX: 2980,
  boss: {
    type: 'ogre_warchief',
    arenaMinX: 3060,
    arenaMaxX: 3500,
    spawnX: 3300,
    spawnY: GROUND_Y,
  },
  clearBonus: 150,
};

/** L4 — denser bandit/slime mix after the first wall. */
const MISTWOOD_TRAIL = {
  id: 'mistwood-trail',
  name: 'Mistwood Trail',
  subtitle: 'Fog and bandits in the trees',
  order: 4,
  stub: false,
  bounds: { minX: 0, maxX: 3400 },
  spawn: { x: 80, y: GROUND_Y },
  platforms: [
    { x: -40, y: GROUND_Y, w: 340 },
    { x: 260, y: GROUND_Y - 44, w: 125 },
    { x: 430, y: GROUND_Y, w: 180 },
    { x: 660, y: GROUND_Y - 50, w: 110 },
    { x: 820, y: GROUND_Y - 38, w: 110 },
    { x: 980, y: GROUND_Y, w: 200 },
    { x: 1220, y: GROUND_Y - 46, w: 115 },
    { x: 1380, y: GROUND_Y - 58, w: 110 },
    { x: 1540, y: GROUND_Y, w: 190 },
    { x: 1780, y: GROUND_Y - 42, w: 115 },
    { x: 1940, y: GROUND_Y, w: 170 },
    { x: 2160, y: GROUND_Y - 48, w: 120 },
    { x: 2320, y: GROUND_Y - 36, w: 115 },
    { x: 2480, y: GROUND_Y, w: 220 },
    { x: 2680, y: GROUND_Y - 36, w: 130 },
    { x: 2920, y: GROUND_Y, w: 440 },
  ],
  encounters: [
    {
      id: 'mw-ambush',
      triggerX: 150,
      enemies: [{ type: 'bandit', x: 250 }, { type: 'slime', x: 320 }],
    },
    {
      id: 'mw-rise',
      triggerX: 380,
      enemies: [
        { type: 'bandit', x: 500, y: GROUND_Y - 44 },
        { type: 'slime', x: 560 },
        { type: 'slime', x: 620 },
      ],
    },
    {
      id: 'mw-hops',
      triggerX: 600,
      enemies: [
        { type: 'bandit', x: 720, y: GROUND_Y - 50 },
        { type: 'bandit', x: 880, y: GROUND_Y - 38 },
      ],
    },
    {
      id: 'mw-ridge',
      triggerX: 1140,
      enemies: [
        { type: 'skeleton', x: 1280, y: GROUND_Y - 46 },
        { type: 'bandit', x: 1440, y: GROUND_Y - 58 },
        { type: 'slime', x: 1600 },
      ],
    },
    {
      id: 'mw-pack',
      triggerX: 1700,
      enemies: [
        { type: 'bandit', x: 1840, y: GROUND_Y - 42 },
        { type: 'bandit', x: 2000 },
        { type: 'skeleton', x: 2080 },
      ],
    },
    {
      id: 'mw-gate',
      triggerX: 2400,
      enemies: [
        { type: 'bandit', x: 2560 },
        { type: 'bandit', x: 2680 },
        { type: 'skeleton', x: 2800, y: GROUND_Y - 44 },
        { type: 'slime', x: 2860 },
      ],
    },
  ],
  checkpoints: [{ id: 'mw-mid', x: 1600 }],
  gateX: 2860,
  boss: {
    type: 'bandit_lord',
    arenaMinX: 2920,
    arenaMaxX: 3320,
    spawnX: 3120,
    spawnY: GROUND_Y,
  },
  clearBonus: 160,
};

/** L5 — narrow bridge hops, mixed bones. */
const BROKEN_BRIDGE = {
  id: 'broken-bridge',
  name: 'Broken Bridge',
  subtitle: 'Narrow spans over the ravine',
  order: 5,
  stub: false,
  bounds: { minX: 0, maxX: 3480 },
  spawn: { x: 80, y: GROUND_Y },
  platforms: [
    { x: -40, y: GROUND_Y, w: 300 },
    { x: 240, y: GROUND_Y - 48, w: 105 },
    { x: 400, y: GROUND_Y - 36, w: 105 },
    { x: 560, y: GROUND_Y, w: 160 },
    { x: 740, y: GROUND_Y - 40, w: 110 },
    { x: 900, y: GROUND_Y - 36, w: 110 },
    { x: 1060, y: GROUND_Y - 48, w: 110 },
    { x: 1240, y: GROUND_Y, w: 170 },
    { x: 1420, y: GROUND_Y - 38, w: 115 },
    { x: 1580, y: GROUND_Y - 48, w: 110 },
    { x: 1770, y: GROUND_Y, w: 160 },
    { x: 1980, y: GROUND_Y - 50, w: 105 },
    { x: 2140, y: GROUND_Y - 38, w: 105 },
    { x: 2300, y: GROUND_Y, w: 150 },
    { x: 2500, y: GROUND_Y - 48, w: 110 },
    { x: 2660, y: GROUND_Y, w: 180 },
    { x: 2900, y: GROUND_Y, w: 440 },
  ],
  encounters: [
    {
      id: 'bb-start',
      triggerX: 140,
      enemies: [{ type: 'skeleton', x: 280, y: GROUND_Y - 48 }, { type: 'slime', x: 360 }],
    },
    {
      id: 'bb-spans',
      triggerX: 500,
      enemies: [
        { type: 'skeleton', x: 620 },
        { type: 'bandit', x: 820, y: GROUND_Y - 52 },
      ],
    },
    {
      id: 'bb-chain',
      triggerX: 900,
      enemies: [
        { type: 'skeleton', x: 1000, y: GROUND_Y - 40 },
        { type: 'skeleton', x: 1160, y: GROUND_Y - 56 },
        { type: 'bandit', x: 1320 },
      ],
    },
    {
      id: 'bb-mid',
      triggerX: 1400,
      enemies: [
        { type: 'skeleton', x: 1520, y: GROUND_Y - 46 },
        { type: 'skeleton', x: 1680, y: GROUND_Y - 58 },
        { type: 'bandit', x: 1840 },
      ],
    },
    {
      id: 'bb-late',
      triggerX: 1920,
      enemies: [
        { type: 'bandit', x: 2040, y: GROUND_Y - 50 },
        { type: 'skeleton', x: 2200, y: GROUND_Y - 38 },
        { type: 'skeleton', x: 2380 },
      ],
    },
    {
      id: 'bb-gate',
      triggerX: 2460,
      enemies: [
        { type: 'skeleton', x: 2580, y: GROUND_Y - 48 },
        { type: 'bandit', x: 2720 },
        { type: 'skeleton', x: 2800 },
        { type: 'bandit', x: 2860 },
      ],
    },
  ],
  checkpoints: [
    { id: 'bb-mid', x: 1300 },
    { id: 'bb-late', x: 2340 },
  ],
  gateX: 2820,
  boss: {
    type: 'bone_reaver',
    arenaMinX: 2900,
    arenaMaxX: 3300,
    spawnX: 3100,
    spawnY: GROUND_Y,
  },
  clearBonus: 175,
};

/** L6 — crypt, skeleton-heavy, denser. */
const BONE_CRYPT = {
  id: 'bone-crypt',
  name: 'Bone Crypt',
  subtitle: 'Catacombs under the road',
  order: 6,
  stub: false,
  bounds: { minX: 0, maxX: 3600 },
  spawn: { x: 80, y: GROUND_Y },
  platforms: [
    { x: -40, y: GROUND_Y, w: 320 },
    { x: 250, y: GROUND_Y - 42, w: 115 },
    { x: 410, y: GROUND_Y, w: 160 },
    { x: 620, y: GROUND_Y - 50, w: 105 },
    { x: 780, y: GROUND_Y - 36, w: 105 },
    { x: 940, y: GROUND_Y - 54, w: 105 },
    { x: 1100, y: GROUND_Y, w: 180 },
    { x: 1320, y: GROUND_Y - 48, w: 110 },
    { x: 1480, y: GROUND_Y - 40, w: 110 },
    { x: 1640, y: GROUND_Y, w: 170 },
    { x: 1860, y: GROUND_Y - 52, w: 105 },
    { x: 2020, y: GROUND_Y - 38, w: 105 },
    { x: 2180, y: GROUND_Y - 56, w: 105 },
    { x: 2340, y: GROUND_Y, w: 180 },
    { x: 2560, y: GROUND_Y - 46, w: 115 },
    { x: 2720, y: GROUND_Y, w: 200 },
    { x: 2980, y: GROUND_Y, w: 460 },
  ],
  encounters: [
    {
      id: 'bc-entry',
      triggerX: 140,
      enemies: [
        { type: 'skeleton', x: 280, y: GROUND_Y - 42 },
        { type: 'skeleton', x: 360 },
      ],
    },
    {
      id: 'bc-hall',
      triggerX: 500,
      enemies: [
        { type: 'skeleton', x: 680, y: GROUND_Y - 50 },
        { type: 'skeleton', x: 840, y: GROUND_Y - 36 },
        { type: 'bandit', x: 1000, y: GROUND_Y - 54 },
      ],
    },
    {
      id: 'bc-vault',
      triggerX: 1040,
      enemies: [
        { type: 'skeleton', x: 1180 },
        { type: 'skeleton', x: 1260 },
        { type: 'skeleton', x: 1380, y: GROUND_Y - 48 },
      ],
    },
    {
      id: 'bc-steps',
      triggerX: 1420,
      enemies: [
        { type: 'skeleton', x: 1540, y: GROUND_Y - 40 },
        { type: 'bandit', x: 1700 },
        { type: 'skeleton', x: 1780 },
      ],
    },
    {
      id: 'bc-depths',
      triggerX: 1800,
      enemies: [
        { type: 'skeleton', x: 1920, y: GROUND_Y - 52 },
        { type: 'skeleton', x: 2080, y: GROUND_Y - 38 },
        { type: 'skeleton', x: 2240, y: GROUND_Y - 56 },
        { type: 'bandit', x: 2400 },
      ],
    },
    {
      id: 'bc-gate',
      triggerX: 2500,
      enemies: [
        { type: 'skeleton', x: 2620, y: GROUND_Y - 46 },
        { type: 'skeleton', x: 2780 },
        { type: 'bandit', x: 2860 },
        { type: 'skeleton', x: 2920 },
      ],
    },
  ],
  checkpoints: [
    { id: 'bc-mid', x: 1160 },
    { id: 'bc-late', x: 2400 },
  ],
  gateX: 2900,
  boss: {
    type: 'crypt_guardian',
    arenaMinX: 2980,
    arenaMaxX: 3400,
    spawnX: 3200,
    spawnY: GROUND_Y,
  },
  clearBonus: 190,
};

/** L7 — ash and ogre pressure returns. */
const ASHEN_CAUSEWAY = {
  id: 'ashen-causeway',
  name: 'Ashen Causeway',
  subtitle: 'Scorched road, heavy steps',
  order: 7,
  stub: false,
  bounds: { minX: 0, maxX: 3700 },
  spawn: { x: 80, y: GROUND_Y },
  platforms: [
    { x: -40, y: GROUND_Y, w: 340 },
    { x: 270, y: GROUND_Y - 46, w: 120 },
    { x: 440, y: GROUND_Y, w: 190 },
    { x: 680, y: GROUND_Y - 40, w: 115 },
    { x: 840, y: GROUND_Y - 54, w: 115 },
    { x: 1000, y: GROUND_Y, w: 220 },
    { x: 1280, y: GROUND_Y, w: 260 },
    { x: 1500, y: GROUND_Y - 48, w: 115 },
    { x: 1660, y: GROUND_Y - 36, w: 115 },
    { x: 1820, y: GROUND_Y - 52, w: 115 },
    { x: 1980, y: GROUND_Y, w: 220 },
    { x: 2200, y: GROUND_Y - 38, w: 130 },
    { x: 2420, y: GROUND_Y, w: 200 },
    { x: 2620, y: GROUND_Y - 36, w: 130 },
    { x: 2840, y: GROUND_Y, w: 200 },
    { x: 3100, y: GROUND_Y, w: 500 },
  ],
  encounters: [
    {
      id: 'ac-watch',
      triggerX: 150,
      enemies: [{ type: 'bandit', x: 280 }, { type: 'skeleton', x: 360, y: GROUND_Y - 46 }],
    },
    {
      id: 'ac-first',
      triggerX: 400,
      enemies: [{ type: 'ogre', x: 540 }, { type: 'bandit', x: 620 }],
    },
    {
      id: 'ac-hops',
      triggerX: 620,
      enemies: [
        { type: 'skeleton', x: 740, y: GROUND_Y - 40 },
        { type: 'ogre', x: 900, y: GROUND_Y - 54 },
        { type: 'bandit', x: 1100 },
      ],
    },
    {
      id: 'ac-corridor',
      triggerX: 1180,
      enemies: [
        { type: 'ogre', x: 1360 },
        { type: 'ogre', x: 1480 },
        { type: 'skeleton', x: 1440 },
      ],
    },
    {
      id: 'ac-steps',
      triggerX: 1460,
      enemies: [
        { type: 'bandit', x: 1560, y: GROUND_Y - 48 },
        { type: 'ogre', x: 1720, y: GROUND_Y - 36 },
        { type: 'skeleton', x: 1880, y: GROUND_Y - 52 },
      ],
    },
    {
      id: 'ac-perch',
      triggerX: 2140,
      enemies: [
        { type: 'ogre', x: 2300, y: GROUND_Y - 50 },
        { type: 'bandit', x: 2500 },
        { type: 'ogre', x: 2560 },
      ],
    },
    {
      id: 'ac-gate',
      triggerX: 2600,
      enemies: [
        { type: 'ogre', x: 2720, y: GROUND_Y - 44 },
        { type: 'bandit', x: 2900 },
        { type: 'skeleton', x: 2960 },
        { type: 'ogre', x: 3000 },
      ],
    },
  ],
  checkpoints: [
    { id: 'ac-mid', x: 1060 },
    { id: 'ac-late', x: 2040 },
  ],
  gateX: 3020,
  boss: {
    type: 'ash_brute',
    arenaMinX: 3100,
    arenaMaxX: 3560,
    spawnX: 3340,
    spawnY: GROUND_Y,
  },
  clearBonus: 210,
};

/** L8 — mixed elite barracks. */
const BARRACKS_YARD = {
  id: 'barracks-yard',
  name: 'Barracks Yard',
  subtitle: 'Drill grounds of the iron host',
  order: 8,
  stub: false,
  bounds: { minX: 0, maxX: 3650 },
  spawn: { x: 80, y: GROUND_Y },
  platforms: [
    { x: -40, y: GROUND_Y, w: 320 },
    { x: 250, y: GROUND_Y - 44, w: 120 },
    { x: 420, y: GROUND_Y, w: 170 },
    { x: 640, y: GROUND_Y - 50, w: 110 },
    { x: 800, y: GROUND_Y - 38, w: 110 },
    { x: 960, y: GROUND_Y, w: 190 },
    { x: 1200, y: GROUND_Y - 46, w: 110 },
    { x: 1360, y: GROUND_Y - 56, w: 110 },
    { x: 1520, y: GROUND_Y, w: 180 },
    { x: 1750, y: GROUND_Y - 42, w: 115 },
    { x: 1910, y: GROUND_Y, w: 190 },
    { x: 2100, y: GROUND_Y - 38, w: 125 },
    { x: 2280, y: GROUND_Y - 32, w: 120 },
    { x: 2460, y: GROUND_Y, w: 190 },
    { x: 2680, y: GROUND_Y - 40, w: 125 },
    { x: 2880, y: GROUND_Y, w: 200 },
    { x: 3140, y: GROUND_Y, w: 460 },
  ],
  encounters: [
    {
      id: 'by-drill',
      triggerX: 140,
      enemies: [{ type: 'bandit', x: 260 }, { type: 'bandit', x: 340, y: GROUND_Y - 44 }],
    },
    {
      id: 'by-mix',
      triggerX: 380,
      enemies: [
        { type: 'skeleton', x: 500 },
        { type: 'bandit', x: 700, y: GROUND_Y - 50 },
        { type: 'slime', x: 760 },
      ],
    },
    {
      id: 'by-hops',
      triggerX: 740,
      enemies: [
        { type: 'bandit', x: 860, y: GROUND_Y - 38 },
        { type: 'skeleton', x: 1020 },
        { type: 'bandit', x: 1100 },
      ],
    },
    {
      id: 'by-heavy',
      triggerX: 1140,
      enemies: [
        { type: 'ogre', x: 1280, y: GROUND_Y - 46 },
        { type: 'bandit', x: 1440, y: GROUND_Y - 56 },
        { type: 'skeleton', x: 1600 },
      ],
    },
    {
      id: 'by-yard',
      triggerX: 1680,
      enemies: [
        { type: 'bandit', x: 1820, y: GROUND_Y - 42 },
        { type: 'bandit', x: 1960 },
        { type: 'skeleton', x: 2040 },
        { type: 'ogre', x: 2100 },
      ],
    },
    {
      id: 'by-gate',
      triggerX: 2400,
      enemies: [
        { type: 'bandit', x: 2520, y: GROUND_Y - 48 },
        { type: 'skeleton', x: 2620, y: GROUND_Y - 36 },
        { type: 'ogre', x: 2760 },
        { type: 'bandit', x: 2920 },
        { type: 'skeleton', x: 3000 },
      ],
    },
  ],
  checkpoints: [
    { id: 'by-mid', x: 1580 },
    { id: 'by-late', x: 2520 },
  ],
  gateX: 3060,
  boss: {
    type: 'barracks_captain',
    arenaMinX: 3140,
    arenaMaxX: 3560,
    spawnX: 3360,
    spawnY: GROUND_Y,
  },
  clearBonus: 230,
};

/** L9 — hard gauntlet before the keep. */
const CASTLE_APPROACH = {
  id: 'castle-approach',
  name: 'Castle Approach',
  subtitle: 'Final road to the keep',
  order: 9,
  stub: false,
  bounds: { minX: 0, maxX: 3800 },
  spawn: { x: 80, y: GROUND_Y },
  platforms: [
    { x: -40, y: GROUND_Y, w: 300 },
    { x: 240, y: GROUND_Y - 48, w: 110 },
    { x: 400, y: GROUND_Y, w: 160 },
    { x: 610, y: GROUND_Y - 44, w: 110 },
    { x: 770, y: GROUND_Y - 56, w: 110 },
    { x: 930, y: GROUND_Y, w: 180 },
    { x: 1160, y: GROUND_Y - 50, w: 110 },
    { x: 1320, y: GROUND_Y - 38, w: 110 },
    { x: 1480, y: GROUND_Y - 54, w: 110 },
    { x: 1640, y: GROUND_Y, w: 190 },
    { x: 1880, y: GROUND_Y - 46, w: 115 },
    { x: 2040, y: GROUND_Y, w: 170 },
    { x: 2260, y: GROUND_Y - 52, w: 110 },
    { x: 2420, y: GROUND_Y - 40, w: 110 },
    { x: 2580, y: GROUND_Y, w: 200 },
    { x: 2780, y: GROUND_Y - 38, w: 130 },
    { x: 3000, y: GROUND_Y, w: 200 },
    { x: 3260, y: GROUND_Y, w: 480 },
  ],
  encounters: [
    {
      id: 'ca-out',
      triggerX: 130,
      enemies: [
        { type: 'bandit', x: 280, y: GROUND_Y - 48 },
        { type: 'skeleton', x: 360 },
        { type: 'slime', x: 420 },
      ],
    },
    {
      id: 'ca-rise',
      triggerX: 500,
      enemies: [
        { type: 'ogre', x: 680, y: GROUND_Y - 44 },
        { type: 'bandit', x: 840, y: GROUND_Y - 56 },
        { type: 'skeleton', x: 1000 },
      ],
    },
    {
      id: 'ca-chain',
      triggerX: 1080,
      enemies: [
        { type: 'skeleton', x: 1220, y: GROUND_Y - 50 },
        { type: 'bandit', x: 1380, y: GROUND_Y - 38 },
        { type: 'ogre', x: 1540, y: GROUND_Y - 54 },
      ],
    },
    {
      id: 'ca-mid',
      triggerX: 1580,
      enemies: [
        { type: 'bandit', x: 1720 },
        { type: 'skeleton', x: 1800 },
        { type: 'ogre', x: 1940, y: GROUND_Y - 46 },
        { type: 'bandit', x: 2100 },
      ],
    },
    {
      id: 'ca-late',
      triggerX: 2180,
      enemies: [
        { type: 'ogre', x: 2320, y: GROUND_Y - 52 },
        { type: 'skeleton', x: 2480, y: GROUND_Y - 40 },
        { type: 'bandit', x: 2640 },
        { type: 'ogre', x: 2700 },
      ],
    },
    {
      id: 'ca-gate',
      triggerX: 2760,
      enemies: [
        { type: 'ogre', x: 2880, y: GROUND_Y - 48 },
        { type: 'bandit', x: 3060 },
        { type: 'skeleton', x: 3120 },
        { type: 'ogre', x: 3180 },
        { type: 'bandit', x: 3220 },
      ],
    },
  ],
  checkpoints: [
    { id: 'ca-mid', x: 1700 },
    { id: 'ca-late', x: 2640 },
  ],
  gateX: 3180,
  boss: {
    type: 'iron_sentinel',
    arenaMinX: 3260,
    arenaMaxX: 3700,
    spawnX: 3500,
    spawnY: GROUND_Y,
  },
  clearBonus: 250,
};

/** L10 — campaign finale. */
const IRONVALE_KEEP = {
  id: 'ironvale-keep',
  name: 'Ironvale Keep',
  subtitle: 'The Iron Lord awaits',
  order: 10,
  stub: false,
  bounds: { minX: 0, maxX: 3900 },
  spawn: { x: 80, y: GROUND_Y },
  platforms: [
    { x: -40, y: GROUND_Y, w: 320 },
    { x: 250, y: GROUND_Y - 46, w: 115 },
    { x: 420, y: GROUND_Y, w: 170 },
    { x: 640, y: GROUND_Y - 50, w: 110 },
    { x: 800, y: GROUND_Y - 38, w: 110 },
    { x: 960, y: GROUND_Y - 54, w: 110 },
    { x: 1120, y: GROUND_Y, w: 200 },
    { x: 1360, y: GROUND_Y, w: 240 },
    { x: 1560, y: GROUND_Y - 48, w: 115 },
    { x: 1720, y: GROUND_Y - 36, w: 115 },
    { x: 1880, y: GROUND_Y - 52, w: 115 },
    { x: 2040, y: GROUND_Y, w: 190 },
    { x: 2280, y: GROUND_Y - 46, w: 120 },
    { x: 2460, y: GROUND_Y, w: 200 },
    { x: 2660, y: GROUND_Y - 38, w: 130 },
    { x: 2840, y: GROUND_Y - 32, w: 130 },
    { x: 3060, y: GROUND_Y, w: 200 },
    { x: 3320, y: GROUND_Y, w: 520 },
  ],
  encounters: [
    {
      id: 'ik-guard',
      triggerX: 140,
      enemies: [
        { type: 'bandit', x: 280, y: GROUND_Y - 46 },
        { type: 'skeleton', x: 360 },
        { type: 'bandit', x: 440 },
      ],
    },
    {
      id: 'ik-hops',
      triggerX: 560,
      enemies: [
        { type: 'ogre', x: 700, y: GROUND_Y - 50 },
        { type: 'skeleton', x: 860, y: GROUND_Y - 38 },
        { type: 'bandit', x: 1020, y: GROUND_Y - 54 },
      ],
    },
    {
      id: 'ik-hall',
      triggerX: 1060,
      enemies: [
        { type: 'ogre', x: 1240 },
        { type: 'ogre', x: 1380 },
        { type: 'bandit', x: 1320 },
        { type: 'skeleton', x: 1460 },
      ],
    },
    {
      id: 'ik-steps',
      triggerX: 1500,
      enemies: [
        { type: 'skeleton', x: 1620, y: GROUND_Y - 48 },
        { type: 'bandit', x: 1780, y: GROUND_Y - 36 },
        { type: 'ogre', x: 1940, y: GROUND_Y - 52 },
        { type: 'bandit', x: 2100 },
      ],
    },
    {
      id: 'ik-throne-path',
      triggerX: 2200,
      enemies: [
        { type: 'ogre', x: 2360, y: GROUND_Y - 46 },
        { type: 'skeleton', x: 2520 },
        { type: 'bandit', x: 2580 },
        { type: 'ogre', x: 2760, y: GROUND_Y - 50 },
      ],
    },
    {
      id: 'ik-gate',
      triggerX: 2820,
      enemies: [
        { type: 'ogre', x: 2960, y: GROUND_Y - 38 },
        { type: 'bandit', x: 3120 },
        { type: 'skeleton', x: 3180 },
        { type: 'ogre', x: 3240 },
        { type: 'bandit', x: 3280 },
      ],
    },
  ],
  checkpoints: [
    { id: 'ik-mid', x: 1180 },
    { id: 'ik-late', x: 2500 },
  ],
  gateX: 3240,
  boss: {
    type: 'iron_lord',
    arenaMinX: 3320,
    arenaMaxX: 3800,
    spawnX: 3580,
    spawnY: GROUND_Y,
  },
  clearBonus: 300,
};

/** @type {LevelDef[]} */
export const LEVELS = [
  OUTER_VALE,
  RUINED_ROAD,
  IRON_GATE,
  MISTWOOD_TRAIL,
  BROKEN_BRIDGE,
  BONE_CRYPT,
  ASHEN_CAUSEWAY,
  BARRACKS_YARD,
  CASTLE_APPROACH,
  IRONVALE_KEEP,
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

/** Highest stage order in the campaign. */
export function maxLevelOrder() {
  return LEVELS.reduce((m, l) => Math.max(m, l.order), 1);
}

/**
 * @param {LevelDef} def
 * @returns {ReturnType<typeof makePlatform>[]}
 */
export function buildLevelPlatforms(def) {
  return buildPlatformsFromDefs(def.platforms || []);
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

/**
 * Checkpoints sorted by x for a level.
 * @param {LevelDef} def
 * @returns {LevelCheckpoint[]}
 */
export function listCheckpoints(def) {
  if (!def?.checkpoints?.length) return [];
  return def.checkpoints.slice().sort((a, b) => a.x - b.x);
}
