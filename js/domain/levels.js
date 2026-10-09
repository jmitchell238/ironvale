/**
 * Domain: campaign level definitions + pure helpers.
 * Layout/spawns live here — not in render.
 *
 * Campaign (4 biomes): Forgegate Fields → Forest Ramparts → Forge Ruins → Iron Caverns.
 * Forgegate Fields is a tile-map stage (see tilemap.js); the others are still blockouts.
 */

import { GROUND_Y, W, H } from '../config/index.js';
import { buildPlatformsFromDefs, makeLadder } from './platforms.js';
import {
  TILE, createTileMap, fillCells, groundCells, compileTileMap,
} from './tilemap.js';

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
 * Stamps cut from the Magic Cliffs tileset. `src` is [col, row, wide, tall] in
 * source tiles; `walk` is the one-way top (world px from the stamp's corner).
 */
export const STAMPS = {
  island: { src: [2, 1, 7, 5], walk: { dx: 24, dy: 22, w: 184 } },
  islet: { src: [3, 7, 3, 3], walk: { dx: 8, dy: 26, w: 80 } },
  tree: { src: [12, 3, 8, 7], layer: 'back' },
  pillar: { src: [9, 6, 2, 4], layer: 'back' },
  fern: { src: [6, 11, 1, 1], layer: 'front' },
};

/** Stamp whose bottom sits on top of ground row `r` (for scenery). */
function standStamp(map, name, c, r) {
  const st = STAMPS[name];
  map.stamps.push({ name, x: c * TILE, y: r * TILE - st.src[3] * TILE, src: st.src, layer: st.layer || 'back' });
}

function floatStamp(map, name, c, r) {
  const st = STAMPS[name];
  const x = c * TILE;
  const y = r * TILE;
  map.stamps.push({ name, x, y, src: st.src, layer: 'mid' });
  map.extraPlatforms.push({
    x: x + st.walk.dx, y: y + st.walk.dy, w: st.walk.w,
    style: 'tile', h: 16, exact: true, oneWay: true, kind: 'island',
  });
}

function coinRow(map, c0, c1, r) {
  for (let c = c0; c <= c1; c++) map.coins.push([c, r]);
}

function coinArc(map, c0, c1, r, lift) {
  const n = c1 - c0;
  for (let c = c0; c <= c1; c++) {
    const t = n ? (c - c0) / n : 0.5;
    map.coins.push([c, r - Math.round(Math.sin(t * Math.PI) * lift)]);
  }
}

/** Foot position of a cell: centre x, top of the ground row it stands on. */
const foot = (c, r) => ({ x: c * TILE + TILE / 2, y: r * TILE });
const air = (c, r) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });

/** Encounter that fires when the player gets within `lead` px of its first enemy. */
function encounter(id, lead, enemies) {
  const minX = Math.min(...enemies.map(e => e.x));
  return { id, triggerX: Math.max(0, minX - lead), enemies };
}

function buildForgegateFields() {
  const map = createTileMap(180, 22);
  map.extraPlatforms = [];

  // A — sunny meadow: spawn, a step, a teaching skeleton
  fillCells(map, 0, 7, 0, 21, '#');
  groundCells(map, 1, 13, 17);
  groundCells(map, 14, 29, 16);
  fillCells(map, 18, 14, 21, 14, '=');
  standStamp(map, 'tree', 3, 17);
  standStamp(map, 'fern', 9, 17);
  standStamp(map, 'fern', 24, 16);
  coinArc(map, 8, 12, 15, 1);
  coinRow(map, 18, 21, 13);

  // B — rope bridge over the first drop; ghost overhead; high ledge for double jumpers
  fillCells(map, 30, 16, 37, 16, 'b');
  groundCells(map, 38, 49, 16);
  standStamp(map, 'pillar', 44, 16);
  fillCells(map, 40, 12, 43, 12, '=');
  coinRow(map, 40, 43, 11);
  coinArc(map, 31, 36, 14, 1);

  // C — raised field, ladder to a hidden alcove, first checkpoint
  groundCells(map, 50, 75, 14);
  fillCells(map, 63, 8, 70, 8, '=');
  map.ladders.push({ c: 66, rTop: 8, rBottom: 14 });
  map.pickups.push({ type: 'heart', c: 68, r: 7 });
  coinRow(map, 63, 65, 7);
  standStamp(map, 'tree', 52, 14);
  standStamp(map, 'fern', 58, 14);
  standStamp(map, 'fern', 72, 14);

  // D — island hopping over the sea
  floatStamp(map, 'island', 77, 13);
  floatStamp(map, 'islet', 86, 11);
  floatStamp(map, 'island', 90, 12);
  floatStamp(map, 'islet', 98, 12);
  coinArc(map, 78, 82, 12, 1);
  coinArc(map, 84, 89, 9, 2);
  coinArc(map, 91, 95, 11, 1);
  coinRow(map, 99, 100, 11);

  // E — grove; ladder (or double jump) up to the wolves' plateau
  groundCells(map, 102, 111, 14);
  fillCells(map, 108, 11, 111, 11, '=');
  map.ladders.push({ c: 109, rTop: 11, rBottom: 14 });
  groundCells(map, 112, 131, 11);
  standStamp(map, 'tree', 103, 14);
  standStamp(map, 'pillar', 116, 11);
  standStamp(map, 'fern', 127, 11);
  coinRow(map, 113, 118, 10);
  map.pickups.push({ type: 'heart', c: 104, r: 13 });

  // F — drop down, second checkpoint, climb the stone steps
  groundCells(map, 132, 152, 15);
  fillCells(map, 138, 12, 141, 12, '=');
  fillCells(map, 143, 9, 146, 9, '=');
  fillCells(map, 148, 6, 150, 6, '=');
  coinRow(map, 138, 141, 11);
  coinRow(map, 143, 146, 8);
  map.pickups.push({ type: 'heart', c: 149, r: 5 });
  standStamp(map, 'fern', 135, 15);

  // G — the gate field: last fight, then the Forgegate
  groundCells(map, 153, 179, 14);
  fillCells(map, 178, 0, 179, 13, '#');
  standStamp(map, 'tree', 154, 14);
  coinArc(map, 158, 163, 12, 1);

  const compiled = compileTileMap(map);
  compiled.platforms.push(...map.extraPlatforms);
  return compiled;
}

const FG_MAP = buildForgegateFields();

const FORGEGATE_FIELDS = {
  id: 'forgegate-fields',
  name: 'Forgegate Fields',
  subtitle: 'Cliffs by the sea · climb · fight · open the gate',
  order: 1,
  stub: false,
  theme: 'cliffs',
  tiles: FG_MAP.tiles,
  solids: FG_MAP.solids,
  bounds: { minX: 0, maxX: 180 * TILE, minY: 0, maxY: 22 * TILE, fallY: 22 * TILE + 80 },
  spawn: foot(4, 17),
  platforms: FG_MAP.platforms,
  ladders: FG_MAP.ladders,
  coins: FG_MAP.coins,
  pickups: FG_MAP.pickups,
  props: [],
  encounters: [
    encounter('fg-first-bones', 420, [{ type: 'goblin', ...foot(26, 16) }]),
    encounter('fg-bridge-ghost', 560, [{ type: 'bat', ...air(36, 11) }]),
    encounter('fg-field-pair', 420, [
      { type: 'goblin', ...foot(46, 16) },
      { type: 'shield_skeleton', ...foot(58, 14) },
    ]),
    encounter('fg-sea-ghosts', 560, [
      { type: 'bat', ...air(88, 7) },
      { type: 'bat', ...air(95, 9) },
    ]),
    encounter('fg-grove', 420, [{ type: 'goblin', ...foot(106, 14) }]),
    encounter('fg-wolves', 520, [
      { type: 'wolf', ...foot(122, 11) },
      { type: 'wolf', ...foot(127, 11) },
    ]),
    encounter('fg-steps', 420, [
      { type: 'shield_skeleton', ...foot(147, 15) },
      { type: 'bat', ...air(144, 6) },
    ]),
    encounter('fg-gate-guard', 420, [
      { type: 'goblin', ...foot(165, 14) },
      { type: 'shield_skeleton', ...foot(169, 14) },
      { type: 'wolf', ...foot(172, 14) },
      { type: 'bat', ...air(167, 9) },
    ]),
  ],
  checkpoints: [
    { id: 'fg-field', ...foot(73, 14) },
    { id: 'fg-steps', ...foot(134, 15) },
  ],
  gateX: 175 * TILE,
  gate: { x: 174 * TILE, y: 14 * TILE - 128, w: 64, h: 128, blockTop: 0 },
  clearBonus: 160,
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
    maxY: def.bounds.fallY != null ? def.bounds.fallY
      : (def.bounds.maxY != null ? def.bounds.maxY - 8 : GROUND_Y + 200),
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
