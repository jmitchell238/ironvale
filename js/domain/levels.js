/**
 * Domain: campaign level definitions + pure helpers.
 * Layout/spawns live here — not in render.
 *
 * Campaign (4 biomes): Forgegate Fields → Forest Ramparts → Forge Ruins → Iron Caverns.
 */

import { GROUND_Y, W, H } from '../config/index.js';
import { buildPlatformsFromDefs, makeLadder } from './platforms.js';

/**
 * @typedef {{ type: string, x?: number, y?: number }} LevelEnemySpawn
 * @typedef {{ id: string, triggerX: number, enemies: LevelEnemySpawn[] }} LevelEncounter
 * @typedef {{ id: string, x: number, y?: number }} LevelCheckpoint
 * @typedef {{ type: string, x: number, y: number }} LevelProp
 * @typedef {{
 *   id: string,
 *   name: string,
 *   subtitle: string,
 *   order: number,
 *   stub?: boolean,
 *   bounds: { minX: number, maxX: number, minY?: number, maxY?: number },
 *   spawn: { x: number, y: number },
 *   platforms: { x: number, y: number, w: number, style?: string, h?: number }[],
 *   ladders?: { x: number, y: number, h: number, w?: number }[],
 *   props?: LevelProp[],
 *   coins?: { x: number, y: number }[],
 *   encounters: LevelEncounter[],
 *   checkpoints?: LevelCheckpoint[],
 *   gateX: number,
 *   gate?: { x: number, y: number, w?: number, h?: number },
 *   boss?: {
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
 * Painted Forgegate vista lives in world space. Percent helpers map the
 * 16:9 painting onto collision (x/y are 0–1 across the image).
 */
const FG = { x: 0, y: 40, w: 1600, h: 900 };
const fgx = (p) => FG.x + FG.w * p;
const fgy = (p) => FG.y + FG.h * p;
const fgw = (p) => FG.w * p;

const FORGEGATE_FIELDS = {
  id: 'forgegate-fields',
  name: 'Forgegate Fields',
  subtitle: 'Explore · climb · fight · open the gate',
  order: 1,
  stub: false,
  vista: { key: 'bg/forgegate', x: FG.x, y: FG.y, w: FG.w, h: FG.h },
  bounds: { minX: 0, maxX: FG.w, minY: 0, maxY: FG.y + FG.h + 160 },
  spawn: { x: fgx(0.18), y: fgy(0.50) },
  platforms: [
    // Left intro terrace (sign / banner)
    { x: fgx(0.00), y: fgy(0.50), w: fgw(0.30), style: 'lip', h: 18 },
    // Wooden landing under the left ladder
    { x: fgx(0.05), y: fgy(0.72), w: fgw(0.16), style: 'lip', h: 14 },
    // Mid goblin ledge
    { x: fgx(0.33), y: fgy(0.445), w: fgw(0.22), style: 'lip', h: 16 },
    // Rope bridge
    { x: fgx(0.54), y: fgy(0.455), w: fgw(0.17), style: 'lip', h: 12 },
    // Lower skeleton walk
    { x: fgx(0.50), y: fgy(0.655), w: fgw(0.28), style: 'lip', h: 16 },
    // Gate terrace
    { x: fgx(0.72), y: fgy(0.62), w: fgw(0.28), style: 'lip', h: 18 },
    // High right coins perch
    { x: fgx(0.80), y: fgy(0.30), w: fgw(0.12), style: 'lip', h: 14 },
    // Safety floor (fall catch under the gap)
    { x: fgx(0.20), y: fgy(0.88), w: fgw(0.38), style: 'lip', h: 20 },
  ],
  ladders: [
    { x: fgx(0.155), y: fgy(0.50), h: fgy(0.72) - fgy(0.50) },
    { x: fgx(0.495), y: fgy(0.445), h: fgy(0.655) - fgy(0.445) },
    { x: fgx(0.695), y: fgy(0.62), h: fgy(0.78) - fgy(0.62) },
  ],
  props: [
    { type: 'crate', x: fgx(0.40), y: fgy(0.445) },
    { type: 'barrel', x: fgx(0.43), y: fgy(0.445) },
  ],
  coins: [
    { x: fgx(0.30), y: fgy(0.46) },
    { x: fgx(0.325), y: fgy(0.46) },
    { x: fgx(0.35), y: fgy(0.46) },
    { x: fgx(0.84), y: fgy(0.26) },
    { x: fgx(0.87), y: fgy(0.26) },
    { x: fgx(0.73), y: fgy(0.62) - 28 },
    { x: fgx(0.76), y: fgy(0.62) - 28 },
  ],
  encounters: [
    {
      id: 'fg-goblin',
      triggerX: fgx(0.28),
      enemies: [{ type: 'goblin', x: fgx(0.46), y: fgy(0.445) }],
    },
    {
      id: 'fg-bats',
      triggerX: fgx(0.42),
      enemies: [
        { type: 'bat', x: fgx(0.58), y: fgy(0.38) },
        { type: 'bat', x: fgx(0.50), y: fgy(0.58) },
      ],
    },
    {
      id: 'fg-skeleton',
      triggerX: fgx(0.52),
      enemies: [{ type: 'shield_skeleton', x: fgx(0.62), y: fgy(0.655) }],
    },
    {
      id: 'fg-gate-guard',
      triggerX: fgx(0.70),
      enemies: [
        { type: 'goblin', x: fgx(0.78), y: fgy(0.62) },
      ],
    },
  ],
  checkpoints: [{ id: 'fg-mid', x: fgx(0.54), y: fgy(0.455) }],
  gateX: fgx(0.82),
  gate: { x: fgx(0.80), y: fgy(0.48), w: 70, h: fgy(0.62) - fgy(0.48) },
  clearBonus: 100,
};

function stubBiome(opts) {
  const y = GROUND_Y;
  return {
    stub: true,
    bounds: { minX: 0, maxX: 2200, minY: 400, maxY: 1400 },
    spawn: { x: 80, y },
    platforms: [
      { x: -40, y, w: 520, style: 'ground', h: 36 },
      { x: 560, y: y - 60, w: 180, style: 'stone', h: 24 },
      { x: 820, y, w: 400, style: 'ground', h: 36 },
      { x: 1320, y: y - 50, w: 200, style: 'stone', h: 24 },
      { x: 1600, y, w: 560, style: 'ground', h: 36 },
    ],
    ladders: [{ x: 640, y: y - 60, h: 60 }],
    encounters: [
      { id: opts.id + '-a', triggerX: 200, enemies: [{ type: 'goblin', x: 360, y }] },
      { id: opts.id + '-b', triggerX: 700, enemies: [{ type: 'bat', x: 900, y: y - 80 }] },
    ],
    checkpoints: [{ id: opts.id + '-mid', x: 900, y }],
    gateX: 1980,
    gate: { x: 1980, y: y - 120, w: 64, h: 120 },
    clearBonus: 140,
    ...opts,
  };
}

const FOREST_RAMPARTS = stubBiome({
  id: 'forest-ramparts',
  name: 'Forest Ramparts',
  subtitle: 'Nature reclaims. Adventures remain.',
  order: 2,
});

const FORGE_RUINS = stubBiome({
  id: 'forge-ruins',
  name: 'Forge Ruins',
  subtitle: 'Old machines. New paths.',
  order: 3,
});

const IRON_CAVERNS = {
  ...stubBiome({
    id: 'iron-caverns',
    name: 'Iron Caverns',
    subtitle: 'Deeper places. Tougher tests.',
    order: 4,
  }),
  stub: false,
  encounters: [
    { id: 'ic-entry', triggerX: 180, enemies: [{ type: 'goblin', x: 340, y: GROUND_Y }] },
    { id: 'ic-bats', triggerX: 500, enemies: [
      { type: 'bat', x: 700, y: GROUND_Y - 90 },
      { type: 'bat', x: 780, y: GROUND_Y - 50 },
    ] },
    { id: 'ic-bones', triggerX: 900, enemies: [{ type: 'shield_skeleton', x: 1100, y: GROUND_Y }] },
    { id: 'ic-pack', triggerX: 1400, enemies: [
      { type: 'goblin', x: 1550, y: GROUND_Y },
      { type: 'shield_skeleton', x: 1680, y: GROUND_Y },
    ] },
  ],
  gateX: 1860,
  gate: { x: 1860, y: GROUND_Y - 120, w: 64, h: 120 },
  boss: {
    type: 'iron_warden',
    arenaMinX: 1880,
    arenaMaxX: 2180,
    spawnX: 2040,
    spawnY: GROUND_Y,
  },
  clearBonus: 300,
};

/** @type {LevelDef[]} */
export const LEVELS = [
  FORGEGATE_FIELDS,
  FOREST_RAMPARTS,
  FORGE_RUINS,
  IRON_CAVERNS,
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
 * @returns {ReturnType<typeof buildPlatformsFromDefs>}
 */
export function buildLevelPlatforms(def) {
  return buildPlatformsFromDefs(def.platforms || []);
}

/**
 * @param {LevelDef} def
 */
export function buildLevelLadders(def) {
  return (def.ladders || []).map(l => makeLadder(l.x, l.y, l.h, { w: l.w }));
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
 * World clamp limits for camera.
 * @param {LevelDef} def
 * @param {number} [viewW=W]
 * @param {number} [viewH]
 */
export function cameraLimits(def, viewW = W, viewH = H) {
  const minX = def.bounds.minX;
  const maxX = Math.max(minX, def.bounds.maxX - viewW);
  const minY = def.bounds.minY != null ? def.bounds.minY : 0;
  const maxYRaw = def.bounds.maxY != null ? def.bounds.maxY : GROUND_Y + 80;
  const maxY = Math.max(minY, maxYRaw - viewH);
  return { minX, maxX, minY, maxY };
}

/**
 * @param {LevelDef} def
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
 */
export function playerWorldLimits(def) {
  return {
    minX: def.bounds.minX + 24,
    maxX: def.bounds.maxX - 24,
    minY: (def.bounds.minY != null ? def.bounds.minY : 0) + 8,
    maxY: def.bounds.maxY != null ? def.bounds.maxY - 8 : GROUND_Y + 200,
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
