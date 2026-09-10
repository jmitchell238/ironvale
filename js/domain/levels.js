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
 * Painted Forgegate vista. Collision is authored in the source image's
 * pixels (1280×720), then scaled into world space. Do not draw these
 * platforms — the painting is the scenery.
 */
const IMG_W = 1280;
const IMG_H = 720;
const FG = { x: 0, y: 0, w: 1600, h: 900 };
const SX = FG.w / IMG_W;
const SY = FG.h / IMG_H;
const px = (x) => FG.x + x * SX;
const py = (y) => FG.y + y * SY;
const pw = (w) => w * SX;

function hiddenPlat(x, y, w) {
  return { x: px(x), y: py(y), w: pw(w), style: 'hidden', h: 22 };
}

const FORGEGATE_FIELDS = {
  id: 'forgegate-fields',
  name: 'Forgegate Fields',
  subtitle: 'Explore · climb · fight · open the gate',
  order: 1,
  stub: false,
  vista: { key: 'bg/forgegate', x: FG.x, y: FG.y, w: FG.w, h: FG.h },
  bounds: { minX: 0, maxX: FG.w, minY: 0, maxY: FG.h + 120 },
  spawn: { x: px(280), y: py(392) },
  platforms: [
    hiddenPlat(0, 392, 378),     // left terrace
    hiddenPlat(72, 516, 215),    // wooden deck under left ladder
    hiddenPlat(418, 362, 275),   // mid goblin ledge
    hiddenPlat(675, 368, 295),   // rope bridge
    hiddenPlat(655, 550, 305),   // lower skeleton walk
    hiddenPlat(948, 546, 332),   // gate terrace
    hiddenPlat(140, 668, 600),   // fall catch
  ],
  ladders: [
    { x: px(194), y: py(392), h: py(516) - py(392), w: 36 },
    { x: px(778), y: py(362), h: py(550) - py(362), w: 36 },
    { x: px(990), y: py(546), h: py(678) - py(546), w: 36 },
  ],
  props: [
    { type: 'crate', x: px(500), y: py(362) },
    { type: 'barrel', x: px(535), y: py(362) },
  ],
  coins: [
    { x: px(390), y: py(350) },
    { x: px(420), y: py(350) },
    { x: px(450), y: py(350) },
    { x: px(1088), y: py(520) },
    { x: px(1124), y: py(520) },
    { x: px(1020), y: py(250) },
    { x: px(1055), y: py(250) },
  ],
  encounters: [
    {
      id: 'fg-goblin',
      triggerX: px(360),
      enemies: [{ type: 'goblin', x: px(560), y: py(362) }],
    },
    {
      id: 'fg-bats',
      triggerX: px(500),
      enemies: [
        { type: 'bat', x: px(740), y: py(280) },
        { type: 'bat', x: px(620), y: py(470) },
      ],
    },
    {
      id: 'fg-skeleton',
      triggerX: px(640),
      enemies: [{ type: 'shield_skeleton', x: px(820), y: py(550) }],
    },
    {
      id: 'fg-gate-guard',
      triggerX: px(880),
      enemies: [{ type: 'goblin', x: px(1020), y: py(546) }],
    },
  ],
  checkpoints: [{ id: 'fg-mid', x: px(780), y: py(368) }],
  gateX: px(1088),
  gate: { x: px(1075), y: py(400), w: pw(120), h: py(546) - py(400) },
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
