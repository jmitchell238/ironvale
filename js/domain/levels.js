/**
 * Domain: campaign level definitions + pure helpers.
 * Layout/spawns live here — not in render.
 *
 * Campaign (4 biomes): Forgegate Fields → Forest Ramparts → Forge Ruins → Iron Caverns.
 * All four are tile-map stages (see tilemap.js); Iron Caverns ends in the Iron Warden's throne room.
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
 *   theme?: string,
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
 * Scenery stamps cut from each theme's tileset, keyed by theme (the same name
 * as the tile map's `theme`; renderStage.js has the matching look). `src` is
 * [col, row, wide, tall] in source tiles (fractions allowed, to crop tight);
 * `walk` is the one-way top (world px from the stamp's corner).
 */
export const STAMPS = {
  cliffs: {
    island: { src: [2, 1, 7, 5], walk: { dx: 24, dy: 22, w: 184 } },
    islet: { src: [3, 7, 3, 3], walk: { dx: 8, dy: 26, w: 80 } },
    tree: { src: [12, 3, 8, 7], layer: 'back' },
    pillar: { src: [9, 6, 2, 4], layer: 'back' },
    fern: { src: [6, 11, 1, 1], layer: 'front' },
  },
  // Gothicvania Swamp props sit in the tileset's lower rows; boxes are source px / 16.
  swamp: {
    tuft: { src: [27 / 16, 71 / 16, 38 / 16, 35 / 16], layer: 'back' },
    root: { src: [89 / 16, 86 / 16, 55 / 16, 21 / 16], layer: 'back' },
    bush: { src: [165 / 16, 76 / 16, 45 / 16, 32 / 16], layer: 'back' },
  },
  // The town props sit below the church tiles in the combined tileset (see tools/build_assets.py);
  // the balustrade is cut from the church tiles (12 rows down). Boxes are source px / 16.
  town: {
    lamp: { src: [0, 416 / 16, 35 / 16, 108 / 16], layer: 'back' },
    crates: { src: [40 / 16, 416 / 16, 73 / 16, 68 / 16], layer: 'back' },
    wagon: { src: [120 / 16, 416 / 16, 93 / 16, 75 / 16], layer: 'back' },
    well: { src: [220 / 16, 416 / 16, 65 / 16, 65 / 16], layer: 'back' },
    barrel: { src: [292 / 16, 416 / 16, 24 / 16, 30 / 16], layer: 'back' },
    houseA: { src: [0, 528 / 16, 168 / 16, 183 / 16], layer: 'back' },
    houseB: { src: [176 / 16, 528 / 16, 210 / 16, 244 / 16], layer: 'back' },
    houseC: { src: [394 / 16, 528 / 16, 221 / 16, 183 / 16], layer: 'back' },
    balustrade: { src: [12, 18, 5, 3], layer: 'back' },
  },
  // Castle props are cut from the two backdrop pictures stored under the tileset (see tools/build_assets.py:
  // the old castle's at y 368, the hall's at y 672); boxes are source px / 16. `door` is in the tileset itself.
  castle: {
    chandelier: { src: [56 / 16, 672 / 16, 76 / 16, 70 / 16], layer: 'back' },
    lantern: { src: [120 / 16, 735 / 16, 45 / 16, 65 / 16], layer: 'back' },
    window: { src: [212 / 16, 735 / 16, 42 / 16, 66 / 16], layer: 'back' },
    gargoyle: { src: [292 / 16, 742 / 16, 72 / 16, 70 / 16], layer: 'back' },
    column: { src: [22 / 16, 716 / 16, 28 / 16, 99 / 16], layer: 'back' },
    skulls: { src: [50 / 16, 866 / 16, 90 / 16, 78 / 16], layer: 'back' },
    glow: { src: [20 / 16, 470 / 16, 160 / 16, 130 / 16], layer: 'back' },
    door: { src: [41, 3, 3, 4], layer: 'back' },
  },
};

/** Stamp whose bottom sits on top of ground row `r` (for scenery). */
function standStamp(map, name, c, r) {
  const st = STAMPS[map.theme][name];
  map.stamps.push({ name, x: c * TILE, y: r * TILE - st.src[3] * TILE, src: st.src, layer: st.layer || 'back' });
}

/** Scenery hung on the wall or ceiling: top-left corner at cell (c, r). */
function propStamp(map, name, c, r) {
  const st = STAMPS[map.theme][name];
  map.stamps.push({ name, x: c * TILE, y: r * TILE, src: st.src, layer: st.layer || 'back' });
}

function floatStamp(map, name, c, r) {
  const st = STAMPS[map.theme][name];
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
  const map = createTileMap(180, 22, 'cliffs');
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
  theme: FG_MAP.tiles.theme,
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

function buildForestRamparts() {
  const map = createTileMap(190, 22, 'swamp');

  // A — mire edge: spawn, a step up, the first pit (3 wide), two skeletons
  fillCells(map, 0, 7, 0, 21, '#');
  groundCells(map, 1, 14, 17);
  groundCells(map, 15, 30, 16);
  groundCells(map, 34, 47, 16);
  standStamp(map, 'tuft', 3, 17);
  standStamp(map, 'bush', 9, 17);
  standStamp(map, 'root', 20, 16);
  standStamp(map, 'tuft', 27, 16);
  coinArc(map, 8, 12, 15, 1);
  coinRow(map, 18, 21, 15);

  // B — plank bridge over the black water; ghosts over the planks; a low ledge on the far bank
  fillCells(map, 48, 16, 57, 16, 'b');
  groundCells(map, 58, 72, 16);
  coinArc(map, 49, 56, 14, 1);
  fillCells(map, 60, 13, 63, 13, '=');
  coinRow(map, 60, 63, 12);
  standStamp(map, 'bush', 61, 16);
  standStamp(map, 'tuft', 68, 16);

  // C — first rampart: two steps up, a ladder to a hidden alcove, first checkpoint
  groundCells(map, 73, 78, 14);
  groundCells(map, 79, 92, 12);
  fillCells(map, 82, 7, 89, 7, '=');
  map.ladders.push({ c: 85, rTop: 7, rBottom: 12 });
  map.pickups.push({ type: 'heart', c: 87, r: 6 });
  coinRow(map, 82, 84, 6);
  standStamp(map, 'tuft', 75, 14);
  standStamp(map, 'root', 91, 12);

  // D — back down into the bog: stepping-stone islands over three pits, a ledge stair for a heart
  groundCells(map, 93, 106, 16);
  groundCells(map, 110, 113, 16);
  groundCells(map, 117, 119, 16);
  fillCells(map, 120, 16, 124, 16, 'b');
  groundCells(map, 125, 131, 16);
  fillCells(map, 107, 13, 111, 13, '=');
  fillCells(map, 113, 10, 117, 10, '=');
  map.pickups.push({ type: 'heart', c: 115, r: 9 });
  coinRow(map, 107, 110, 12);
  coinArc(map, 118, 123, 14, 1);
  standStamp(map, 'bush', 96, 16);
  standStamp(map, 'tuft', 103, 16);
  standStamp(map, 'tuft', 128, 16);

  // E — the climb: stairs of rampart blocks, then a long wall-walk with a ladder to a high ledge
  groundCells(map, 132, 136, 14);
  groundCells(map, 137, 141, 12);
  groundCells(map, 142, 146, 10);
  groundCells(map, 147, 160, 8);
  fillCells(map, 138, 9, 141, 9, '=');
  fillCells(map, 150, 3, 157, 3, '=');
  map.ladders.push({ c: 153, rTop: 3, rBottom: 8 });
  map.pickups.push({ type: 'heart', c: 155, r: 2 });
  coinRow(map, 138, 141, 8);
  coinRow(map, 142, 145, 9);
  coinRow(map, 150, 152, 2);
  coinArc(map, 154, 159, 7, 1);
  standStamp(map, 'tuft', 134, 14);
  standStamp(map, 'root', 148, 8);
  standStamp(map, 'bush', 158, 8);

  // F — drop to the gate field: last fight, then the Forest Gate
  groundCells(map, 161, 189, 16);
  fillCells(map, 188, 0, 189, 15, '#');
  fillCells(map, 166, 13, 169, 13, '=');
  coinRow(map, 166, 169, 12);
  coinArc(map, 172, 177, 14, 1);
  standStamp(map, 'tuft', 163, 16);
  standStamp(map, 'bush', 181, 16);

  return compileTileMap(map);
}

const FR_MAP = buildForestRamparts();

const FOREST_RAMPARTS = {
  id: 'forest-ramparts',
  name: 'Forest Ramparts',
  subtitle: 'Nature reclaims. Adventures remain.',
  order: 2,
  stub: false,
  theme: FR_MAP.tiles.theme,
  tiles: FR_MAP.tiles,
  solids: FR_MAP.solids,
  bounds: { minX: 0, maxX: 190 * TILE, minY: 0, maxY: 22 * TILE, fallY: 22 * TILE + 80 },
  spawn: foot(4, 17),
  platforms: FR_MAP.platforms,
  ladders: FR_MAP.ladders,
  coins: FR_MAP.coins,
  pickups: FR_MAP.pickups,
  props: [],
  encounters: [
    encounter('fr-first-bones', 420, [
      { type: 'goblin', ...foot(22, 16) },
      { type: 'spider', ...foot(27, 16) },
    ]),
    encounter('fr-bridge-ghosts', 560, [
      { type: 'bat', ...air(50, 12) },
      { type: 'bat', ...air(55, 13) },
    ]),
    encounter('fr-mire-pair', 420, [
      { type: 'goblin', ...foot(62, 16) },
      { type: 'thing', ...foot(68, 16) },
    ]),
    encounter('fr-rampart-wolves', 520, [
      { type: 'wolf', ...foot(84, 12) },
      { type: 'wolf', ...foot(88, 12) },
    ]),
    encounter('fr-low-guard', 460, [
      { type: 'shield_skeleton', ...foot(98, 16) },
      { type: 'thing', ...foot(103, 16) },
      { type: 'bat', ...air(100, 12) },
    ]),
    encounter('fr-stones', 560, [
      { type: 'bat', ...air(108, 11) },
      { type: 'bat', ...air(115, 12) },
      { type: 'goblin', ...foot(111, 16) },
      { type: 'bat', ...air(122, 12) },
    ]),
    encounter('fr-hollow-pack', 480, [
      { type: 'wolf', ...foot(127, 16) },
      { type: 'wolf', ...foot(130, 16) },
      { type: 'spider', ...foot(129, 16) },
    ]),
    encounter('fr-tower', 460, [
      { type: 'shield_skeleton', ...foot(144, 10) },
      { type: 'bat', ...air(145, 6) },
      { type: 'goblin', ...foot(153, 8) },
    ]),
    encounter('fr-gate-guard', 440, [
      { type: 'goblin', ...foot(170, 16) },
      { type: 'thing', ...foot(174, 16) },
      { type: 'wolf', ...foot(177, 16) },
      { type: 'spider', ...foot(180, 16) },
      { type: 'bat', ...air(172, 11) },
    ]),
  ],
  checkpoints: [
    { id: 'fr-rampart', ...foot(91, 12) },
    { id: 'fr-climb', ...foot(134, 14) },
  ],
  gateX: 185 * TILE,
  gate: { x: 184 * TILE, y: 16 * TILE - 128, w: 64, h: 128, blockTop: 0 },
  clearBonus: 220,
};

function buildForgeRuins() {
  const map = createTileMap(200, 22, 'town');
  const STREET = 17;

  // A — the town gate street: spawn, two skeletons, a first look at the houses
  fillCells(map, 0, 7, 0, 21, '#');
  groundCells(map, 1, 31, STREET);
  standStamp(map, 'houseA', 10, STREET);
  standStamp(map, 'lamp', 22, STREET);
  standStamp(map, 'crates', 26, STREET);
  coinArc(map, 8, 12, 15, 1);

  // B — a collapsed stretch of street (3 wide), then the market lane
  groundCells(map, 35, 118, STREET);
  standStamp(map, 'well', 36, STREET);
  standStamp(map, 'houseB', 39, STREET);
  standStamp(map, 'wagon', 44, STREET);
  coinArc(map, 32, 34, 14, 1);

  // C — rooftops: balconies up from the street, then four roofs with alleys (3 wide) between.
  // Each alley has a low balcony to climb back out; a ladder on the second roof reaches a hidden loft.
  fillCells(map, 49, 15, 51, 15, '=');
  fillCells(map, 52, 13, 59, 21, '#');
  fillCells(map, 63, 12, 70, 21, '#');
  fillCells(map, 74, 13, 81, 21, '#');
  fillCells(map, 85, 12, 90, 21, '#');
  fillCells(map, 60, 15, 61, 15, '=');
  fillCells(map, 72, 15, 73, 15, '=');
  fillCells(map, 82, 15, 83, 15, '=');
  fillCells(map, 64, 7, 69, 7, '=');
  map.ladders.push({ c: 66, rTop: 7, rBottom: 12 });
  map.pickups.push({ type: 'heart', c: 68, r: 6 });
  coinRow(map, 54, 57, 12);
  coinArc(map, 60, 62, 11, 2);
  coinArc(map, 71, 73, 10, 2);
  coinRow(map, 76, 79, 12);
  coinArc(map, 82, 84, 11, 2);
  coinRow(map, 64, 65, 6);

  // D — the ruined hall: walk under a fallen upper floor, or climb a ladder and cross its roof
  fillCells(map, 94, 9, 97, 9, '=');
  fillCells(map, 98, 9, 117, 11, '#');
  map.ladders.push({ c: 95, rTop: 9, rBottom: STREET });
  map.pickups.push({ type: 'heart', c: 106, r: 8 });
  standStamp(map, 'lamp', 96, STREET);
  standStamp(map, 'houseC', 100, STREET);
  standStamp(map, 'barrel', 116, STREET);
  coinRow(map, 101, 107, 8);
  coinRow(map, 103, 105, 15);

  // E — a plank bridge over the broken street, a market stall, and the road up to the church
  fillCells(map, 119, STREET, 124, STREET, 'b');
  groundCells(map, 125, 131, STREET);
  groundCells(map, 135, 140, STREET);
  groundCells(map, 141, 146, 15);
  standStamp(map, 'wagon', 126, STREET);
  standStamp(map, 'crates', 136, STREET);
  standStamp(map, 'lamp', 143, 15);
  coinArc(map, 120, 123, 15, 1);
  coinArc(map, 132, 134, 14, 2);

  // F — the church: a nave, then a climb up broken ledges over a pit to the bell tower
  groundCells(map, 147, 163, 13);
  standStamp(map, 'balustrade', 150, 13);
  standStamp(map, 'balustrade', 158, 13);
  fillCells(map, 165, 11, 167, 11, '=');
  fillCells(map, 170, 9, 172, 9, '=');
  fillCells(map, 175, 7, 177, 7, '=');
  fillCells(map, 180, 5, 185, 21, '#');
  fillCells(map, 181, 2, 185, 2, '=');
  map.ladders.push({ c: 183, rTop: 2, rBottom: 5 });
  map.pickups.push({ type: 'heart', c: 183, r: 1 });
  coinRow(map, 153, 156, 11);
  coinRow(map, 165, 167, 10);
  coinRow(map, 170, 172, 8);
  coinRow(map, 175, 177, 6);
  coinRow(map, 180, 182, 4);

  // G — down from the tower to the gate floor: last fight, then the Forge Gate
  groundCells(map, 186, 199, 15);
  fillCells(map, 198, 0, 199, 14, '#');
  coinArc(map, 189, 193, 13, 1);

  return compileTileMap(map);
}

const FRU_MAP = buildForgeRuins();

const FORGE_RUINS = {
  id: 'forge-ruins',
  name: 'Forge Ruins',
  subtitle: 'Old machines. New paths.',
  order: 3,
  stub: false,
  theme: FRU_MAP.tiles.theme,
  tiles: FRU_MAP.tiles,
  solids: FRU_MAP.solids,
  bounds: { minX: 0, maxX: 200 * TILE, minY: 0, maxY: 22 * TILE, fallY: 22 * TILE + 80 },
  spawn: foot(4, 17),
  platforms: FRU_MAP.platforms,
  ladders: FRU_MAP.ladders,
  coins: FRU_MAP.coins,
  pickups: FRU_MAP.pickups,
  props: [],
  encounters: [
    encounter('fru-first-bones', 420, [
      { type: 'goblin', ...foot(20, 17) },
      { type: 'goblin', ...foot(26, 17) },
    ]),
    encounter('fru-market-pair', 440, [
      { type: 'goblin', ...foot(40, 17) },
      { type: 'burning_ghoul', ...foot(45, 17) },
    ]),
    encounter('fru-roof-wolves', 520, [
      { type: 'hell_hound', ...foot(65, 12) },
      { type: 'hell_hound', ...foot(69, 12) },
      { type: 'goblin', ...foot(55, 13) },
    ]),
    encounter('fru-alley-ghosts', 560, [
      { type: 'bat', ...air(61, 10) },
      { type: 'bat', ...air(72, 10) },
      { type: 'bat', ...air(83, 10) },
    ]),
    encounter('fru-roof-guard', 460, [
      { type: 'shield_skeleton', ...foot(77, 13) },
      { type: 'burning_ghoul', ...foot(80, 13) },
      { type: 'shield_skeleton', ...foot(88, 12) },
    ]),
    encounter('fru-hall', 520, [
      { type: 'hell_hound', ...foot(103, 17) },
      { type: 'hell_hound', ...foot(107, 17) },
      { type: 'goblin', ...foot(112, 17) },
      { type: 'bat', ...air(105, 14) },
    ]),
    encounter('fru-bridge', 560, [
      { type: 'bat', ...air(120, 14) },
      { type: 'bat', ...air(124, 15) },
      { type: 'burning_ghoul', ...foot(128, 17) },
      { type: 'goblin', ...foot(138, 17) },
    ]),
    encounter('fru-nave', 480, [
      { type: 'shield_skeleton', ...foot(152, 13) },
      { type: 'burning_ghoul', ...foot(158, 13) },
      { type: 'hell_hound', ...foot(161, 13) },
      { type: 'bat', ...air(155, 9) },
    ]),
    encounter('fru-tower', 500, [
      { type: 'goblin', ...foot(171, 9) },
      { type: 'wizard', ...foot(176, 7) },
      { type: 'bat', ...air(168, 8) },
      { type: 'bat', ...air(174, 5) },
    ]),
    encounter('fru-gate-guard', 440, [
      { type: 'goblin', ...foot(188, 15) },
      { type: 'burning_ghoul', ...foot(191, 15) },
      { type: 'hell_hound', ...foot(189, 15) },
      { type: 'hell_hound', ...foot(190, 15) },
      { type: 'bat', ...air(188, 10) },
    ]),
  ],
  checkpoints: [
    { id: 'fru-hall', ...foot(93, 17) },
    { id: 'fru-nave', ...foot(149, 13) },
  ],
  gateX: 194 * TILE,
  gate: { x: 193 * TILE, y: 15 * TILE - 128, w: 64, h: 128, blockTop: 0 },
  clearBonus: 280,
};

function buildIronCaverns() {
  const map = createTileMap(208, 22, 'castle');
  const HALL = 17; // main floor row

  // A — the gatehouse hall: spawn, two skeletons, a vaulted ceiling to walk under
  fillCells(map, 0, 7, 0, 21, '#');
  groundCells(map, 1, 30, HALL);
  fillCells(map, 12, 0, 26, 10, '#');
  propStamp(map, 'chandelier', 16, 11);
  propStamp(map, 'chandelier', 24, 11);
  propStamp(map, 'window', 14, 11);
  propStamp(map, 'lantern', 20, 11);
  standStamp(map, 'column', 3, HALL);
  standStamp(map, 'column', 10, HALL);
  coinArc(map, 8, 12, 15, 1);

  // B — a drawbridge across the first pit; ghosts over the planks
  fillCells(map, 31, HALL, 36, HALL, 'b');
  propStamp(map, 'glow', 29, 11);
  coinArc(map, 31, 36, 14, 2);

  // C — the barracks: a long low ceiling, shield skeletons under it
  groundCells(map, 37, 66, HALL);
  fillCells(map, 40, 0, 62, 10, '#');
  propStamp(map, 'chandelier', 46, 11);
  propStamp(map, 'chandelier', 58, 11);
  propStamp(map, 'window', 51, 11);
  propStamp(map, 'lantern', 43, 11);
  standStamp(map, 'door', 62, HALL);
  standStamp(map, 'column', 38, HALL);
  coinRow(map, 42, 45, 15);
  coinRow(map, 52, 56, 15);

  // D — the first shaft: stone steps up (2 tiles each) to a long gallery under a ceiling, a ladder to a hidden loft
  groundCells(map, 67, 72, 15);
  groundCells(map, 73, 78, 13);
  groundCells(map, 79, 84, 11);
  groundCells(map, 85, 102, 9);
  fillCells(map, 88, 0, 91, 3, '#');
  fillCells(map, 93, 4, 98, 4, '=');
  map.ladders.push({ c: 95, rTop: 4, rBottom: 9 });
  map.pickups.push({ type: 'heart', c: 96, r: 3 });
  standStamp(map, 'column', 69, 15);
  standStamp(map, 'gargoyle', 100, 9);
  propStamp(map, 'chandelier', 89, 4);
  propStamp(map, 'glow', 74, 8);
  coinRow(map, 74, 77, 12);
  coinRow(map, 80, 83, 10);
  coinRow(map, 94, 97, 3);

  // E — back down into the moat hall: a drawbridge over a pit, a hidden loft on a ladder, a rest at the checkpoint
  groundCells(map, 104, 116, HALL);
  fillCells(map, 107, 13, 110, 13, '=');
  map.ladders.push({ c: 108, rTop: 13, rBottom: HALL });
  map.pickups.push({ type: 'heart', c: 109, r: 12 });
  fillCells(map, 117, HALL, 124, HALL, 'b');
  standStamp(map, 'column', 105, HALL);
  standStamp(map, 'skulls', 112, HALL);
  propStamp(map, 'lantern', 114, 11);
  propStamp(map, 'glow', 100, 12);
  coinRow(map, 107, 110, 12);
  coinArc(map, 118, 123, 14, 2);

  // F — the narrow corridor: a low ceiling, a 3-wide pit in the middle, wolves at the far end
  groundCells(map, 125, 130, HALL);
  groundCells(map, 134, 140, HALL);
  fillCells(map, 126, 0, 140, 10, '#');
  propStamp(map, 'chandelier', 129, 11);
  propStamp(map, 'chandelier', 137, 11);
  propStamp(map, 'window', 133, 11);
  coinArc(map, 130, 134, 14, 2);

  // G — the stacks: stone ledges climb to a gallery, a ladder drops back down, and a hidden loft above
  groundCells(map, 141, 175, HALL);
  fillCells(map, 144, 15, 147, 15, '=');
  fillCells(map, 149, 13, 152, 13, '=');
  fillCells(map, 154, 11, 157, 11, '=');
  fillCells(map, 159, 9, 172, 9, '=');
  map.ladders.push({ c: 170, rTop: 9, rBottom: HALL });
  fillCells(map, 164, 5, 168, 5, '=');
  map.ladders.push({ c: 166, rTop: 5, rBottom: 9 });
  map.pickups.push({ type: 'heart', c: 166, r: 4 });
  standStamp(map, 'column', 142, HALL);
  standStamp(map, 'gargoyle', 161, HALL);
  propStamp(map, 'window', 150, 7);
  propStamp(map, 'glow', 156, 5);
  coinRow(map, 149, 152, 12);
  coinRow(map, 160, 163, 8);
  coinRow(map, 164, 168, 4);

  // H — the Warden's gate and the throne room: a flat, walled hall under a high ceiling
  fillCells(map, 174, 0, 175, 12, '#');
  groundCells(map, 176, 205, HALL);
  fillCells(map, 176, 0, 205, 3, '#');
  fillCells(map, 206, 0, 207, 21, '#');
  propStamp(map, 'chandelier', 184, 4);
  propStamp(map, 'chandelier', 198, 4);
  standStamp(map, 'column', 178, HALL);
  standStamp(map, 'column', 203, HALL);
  standStamp(map, 'gargoyle', 182, HALL);
  standStamp(map, 'gargoyle', 197, HALL);
  standStamp(map, 'skulls', 189, HALL);
  propStamp(map, 'lantern', 186, 10);
  propStamp(map, 'lantern', 200, 10);

  return compileTileMap(map);
}

const IC_MAP = buildIronCaverns();

const IRON_CAVERNS = {
  id: 'iron-caverns',
  name: 'Iron Caverns',
  subtitle: 'Deeper places. Tougher tests.',
  order: 4,
  stub: false,
  theme: IC_MAP.tiles.theme,
  tiles: IC_MAP.tiles,
  solids: IC_MAP.solids,
  bounds: { minX: 0, maxX: 208 * TILE, minY: 0, maxY: 22 * TILE, fallY: 22 * TILE + 80 },
  spawn: foot(4, 17),
  platforms: IC_MAP.platforms,
  ladders: IC_MAP.ladders,
  coins: IC_MAP.coins,
  pickups: IC_MAP.pickups,
  props: [],
  encounters: [
    encounter('ic-entry', 420, [
      { type: 'goblin', ...foot(20, 17) },
      { type: 'goblin', ...foot(26, 17) },
    ]),
    encounter('ic-bats', 560, [
      { type: 'bat', ...air(33, 13) },
      { type: 'fire_skull', ...air(36, 13) },
    ]),
    encounter('ic-bones', 460, [
      { type: 'shield_skeleton', ...foot(46, 17) },
      { type: 'shield_skeleton', ...foot(53, 17) },
      { type: 'goblin', ...foot(60, 17) },
    ]),
    encounter('ic-shaft', 480, [
      { type: 'goblin', ...foot(70, 15) },
      { type: 'shield_skeleton', ...foot(76, 13) },
      { type: 'fire_skull', ...air(82, 8) },
    ]),
    encounter('ic-pack', 520, [
      { type: 'hell_hound', ...foot(90, 9) },
      { type: 'hell_hound', ...foot(97, 9) },
      { type: 'goblin', ...foot(94, 9) },
    ]),
    encounter('ic-moat', 560, [
      { type: 'wizard', ...foot(112, 17) },
      { type: 'bat', ...air(118, 14) },
      { type: 'bat', ...air(122, 15) },
      { type: 'goblin', ...foot(127, 17) },
    ]),
    encounter('ic-corridor', 480, [
      { type: 'hell_hound', ...foot(135, 17) },
      { type: 'hell_hound', ...foot(139, 17) },
      { type: 'shield_skeleton', ...foot(137, 17) },
    ]),
    encounter('ic-stacks', 520, [
      { type: 'goblin', ...foot(146, 15) },
      { type: 'shield_skeleton', ...foot(151, 13) },
      { type: 'fire_skull', ...air(156, 8) },
      { type: 'bat', ...air(161, 6) },
    ]),
    encounter('ic-keep', 500, [
      { type: 'wizard', ...foot(163, 9) },
      { type: 'hell_hound', ...foot(167, 9) },
      { type: 'shield_skeleton', ...foot(171, 9) },
    ]),
    encounter('ic-gate-guard', 440, [
      { type: 'shield_skeleton', ...foot(160, 17) },
      { type: 'wizard', ...foot(163, 17) },
      { type: 'hell_hound', ...foot(166, 17) },
      { type: 'hell_hound', ...foot(168, 17) },
      { type: 'fire_skull', ...air(164, 12) },
    ]),
  ],
  checkpoints: [
    { id: 'ic-hall', ...foot(105, 17) },
    { id: 'ic-gate', ...foot(172, 17) },
  ],
  gateX: 175 * TILE,
  gate: { x: 174 * TILE, y: 17 * TILE - 128, w: 64, h: 128, blockTop: 0 },
  // The throne room: arena walls are the gate on the left and solid rock on the right.
  boss: {
    type: 'iron_warden',
    arenaMinX: 176 * TILE,
    arenaMaxX: 206 * TILE,
    spawnX: 197 * TILE,
    spawnY: 17 * TILE,
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
