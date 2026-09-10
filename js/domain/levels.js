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

const HIGH = 640;
const MID = 780;
const LOW = 980;
const GATE_Y = 700;
const FLOOR = GROUND_Y;

const FORGEGATE_FIELDS = {
  id: 'forgegate-fields',
  name: 'Forgegate Fields',
  subtitle: 'Explore · climb · fight · open the gate',
  order: 1,
  stub: false,
  bounds: { minX: 0, maxX: 2800, minY: 200, maxY: 1400 },
  spawn: { x: 90, y: HIGH },
  platforms: [
    // Intro terrace (signpost / banner)
    { x: -40, y: HIGH, w: 480, style: 'ground', h: 40 },
    // Wooden landing under the intro ladder
    { x: 40, y: HIGH + 230, w: 260, style: 'bridge', h: 16 },
    // Mid goblin ledge
    { x: 560, y: MID, w: 420, style: 'stone', h: 28 },
    // Wood bridge over the air gap
    { x: 980, y: MID - 16, w: 280, style: 'bridge', h: 14 },
    // Approach to the right tower
    { x: 1260, y: MID, w: 220, style: 'stone', h: 26 },
    // Lower skeleton walk
    { x: 1080, y: LOW, w: 560, style: 'ground', h: 36 },
    // Gate terrace
    { x: 1680, y: GATE_Y, w: 620, style: 'stone', h: 32 },
    // Optional high coins
    { x: 1860, y: GATE_Y - 140, w: 160, style: 'float', h: 16 },
    // Safety floor under the gap (fall catch, not main path)
    { x: 300, y: FLOOR, w: 720, style: 'ground', h: 40 },
    { x: 1640, y: FLOOR, w: 280, style: 'ground', h: 40 },
  ],
  ladders: [
    { x: 170, y: HIGH, h: 230 },
    { x: 1180, y: MID, h: LOW - MID },
    { x: 1580, y: GATE_Y, h: LOW - GATE_Y },
    { x: 1980, y: GATE_Y - 140, h: 140 },
  ],
  props: [
    { type: 'sign', x: 40, y: HIGH },
    { type: 'banner', x: 70, y: HIGH - 90 },
    { type: 'torch', x: 620, y: MID },
    { type: 'crate', x: 700, y: MID },
    { type: 'barrel', x: 740, y: MID },
    { type: 'banner', x: 900, y: MID - 80 },
    { type: 'chain', x: 1100, y: MID - 90 },
    { type: 'torch', x: 1760, y: GATE_Y },
    { type: 'torch', x: 2140, y: GATE_Y },
    { type: 'banner', x: 1840, y: GATE_Y - 90 },
    { type: 'banner', x: 2060, y: GATE_Y - 90 },
  ],
  coins: [
    { x: 500, y: MID - 40 },
    { x: 530, y: MID - 40 },
    { x: 560, y: MID - 40 },
    { x: 1900, y: GATE_Y - 170 },
    { x: 1940, y: GATE_Y - 170 },
    { x: 1480, y: LOW - 30 },
    { x: 1520, y: LOW - 30 },
  ],
  encounters: [
    {
      id: 'fg-goblin',
      triggerX: 420,
      enemies: [{ type: 'goblin', x: 780, y: MID }],
    },
    {
      id: 'fg-bats',
      triggerX: 880,
      enemies: [
        { type: 'bat', x: 1080, y: MID - 80 },
        { type: 'bat', x: 1180, y: MID - 40 },
      ],
    },
    {
      id: 'fg-skeleton',
      triggerX: 1200,
      enemies: [{ type: 'shield_skeleton', x: 1400, y: LOW }],
    },
    {
      id: 'fg-gate-guard',
      triggerX: 1600,
      enemies: [
        { type: 'goblin', x: 1780, y: GATE_Y },
        { type: 'bat', x: 1880, y: GATE_Y - 70 },
      ],
    },
  ],
  checkpoints: [{ id: 'fg-mid', x: 1000, y: MID }],
  gateX: 2140,
  gate: { x: 2140, y: GATE_Y - 120, w: 64, h: 120 },
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
