/**
 * Adapter: pixel-art stage drawing (tile maps, themed tilesets and parallax,
 * ladders, gate, pickups, effects). Presentation only.
 *
 * Each stage names a theme (`tiles.theme`, from the level's tile map); THEMES
 * says which tileset, tile rules and background that theme draws with. To add
 * a theme, write a tile-rule function and a background function and add an
 * entry to THEMES (see docs/DEVELOPMENT.md).
 */

import { W, H, ENEMY_PROJECTILES } from '../config/index.js';
import { clamp } from '../core/math.js';
import { getSprite, drawSprite, drawImageKey } from './sprites.js';

const SRC = 16;
const SCALE = 2;
const T = SRC * SCALE;

function hash(c, r) {
  let h = (c * 374761393 + r * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

function cell(tiles, c, r) {
  if (c < 0 || c >= tiles.cols || r < 0) return '.';
  if (r >= tiles.rows) return tiles.cells[tiles.rows - 1][c];
  return tiles.cells[r][c];
}

const solid = (tiles, c, r) => cell(tiles, c, r) === '#';

const TOPS = [[4, 12], [5, 12], [7, 12], [4, 12]];
const UNDER_TOP = [[4, 13], [5, 13], [6, 13], [7, 13]];
const DEEP = [[7, 16], [7, 17], [6, 16], [6, 17], [5, 16], [5, 17]];
const VINES = [[5, 14], [6, 14], [5, 15], [6, 15]];

/** Magic Cliffs rules. dx/dy let edge cells spill rock and grass into the neighbouring empty cell. */
function cliffsTileArt(tiles, c, r) {
  const ch = cell(tiles, c, r);
  const out = [];
  if (ch === '#') {
    const up = solid(tiles, c, r - 1);
    const left = solid(tiles, c - 1, r);
    const right = solid(tiles, c + 1, r);
    const h = hash(c, r);
    if (!up) {
      if (!left) out.push([3, 12, 0, 0], [2, 12, -1, 0]);
      else if (!right) out.push([3, 12, 0, 0, 1], [2, 12, 1, 0, 1]);
      else out.push([...TOPS[h % TOPS.length], 0, 0]);
      return out;
    }
    let depth = 1;
    while (depth < 4 && solid(tiles, c, r - depth - 1)) depth++;
    if (!left) {
      out.push([3, 13 + (r % 5), 0, 0], [2, 13 + (r % 5), -1, 0]);
    } else if (!right) {
      out.push([3, 13 + (r % 5), 0, 0, 1], [2, 13 + (r % 5), 1, 0, 1]);
    } else if (depth === 1) {
      out.push([...UNDER_TOP[h % UNDER_TOP.length], 0, 0]);
    } else if (depth === 2 && h % 5 === 0) {
      out.push([...VINES[(h >>> 3) % VINES.length], 0, 0]);
    } else {
      out.push([...DEEP[h % DEEP.length], 0, 0]);
    }
    return out;
  }
  if (ch === '=') {
    const l = cell(tiles, c - 1, r) === '=';
    const rt = cell(tiles, c + 1, r) === '=';
    if (!l && !rt) out.push([30, 12, 0, 0]);
    else if (!l) out.push([24, 12, 0, 0]);
    else if (!rt) out.push([30, 12, 0, 0]);
    else out.push([c % 2 ? 25 : 24, 12, 0, 0]);
    return out;
  }
  if (ch === 'b') {
    out.push([40 + (c % 2), 12, 0, 0], [40 + (c % 2), 13, 0, 1]);
  }
  return out;
}


// ---- Gothicvania Swamp ------------------------------------------------------
// The earth tiles start 5 source px below the top of their tile, so every
// ground tile is lifted by that much and the dirt meets the platform line.
const SW_DY = -5 / 16;
const SW_EARTH = 2; // first of five earth columns (rows: 0 top, 1-2 body, 3 dark)
const SW_SKULLS = 8; // first of five bone-wall columns
const SW_LEFT = 0; // ragged left / right edge columns
const SW_RIGHT = 20;

/** Earth block or, in patches of 3x2 cells, the bone-wall block (same column layout). */
function swampBlock(c, r) {
  return hash(Math.floor(c / 3), Math.floor(r / 2)) % 5 === 0 ? SW_SKULLS : SW_EARTH;
}

/** Swamp rules: edge tiles are drawn inside their own cell; ledges and bridges are built from pieces. */
function swampTileArt(tiles, c, r) {
  const ch = cell(tiles, c, r);
  if (ch === '#') {
    let depth = 0;
    while (depth < 3 && solid(tiles, c, r - depth - 1)) depth++;
    if (!solid(tiles, c - 1, r)) return [[SW_LEFT, depth, 0, SW_DY]];
    if (!solid(tiles, c + 1, r)) return [[SW_RIGHT, depth, 0, SW_DY]];
    return [[swampBlock(c, r) + (c % 5), depth, 0, SW_DY]];
  }
  if (ch === '=') {
    const l = cell(tiles, c - 1, r) === '=';
    const rt = cell(tiles, c + 1, r) === '=';
    // Slab: a lifted top tile plus the first rows of the body tile under it.
    if (l && rt) return [[SW_EARTH + (c % 5), 0, 0, SW_DY], [SW_EARTH + (c % 5), 1, 0, 11 / 16, 0, 5]];
    const col = !l ? SW_LEFT : SW_RIGHT;
    return [[col, 0, 0, -8 / 16], [col, 1, 0, 8 / 16, 0, 8]];
  }
  if (ch === 'b') {
    // Plank bridge (the pack has none): rects in source px, with a post at each loose end.
    const out = [
      { fill: '#8a7440', x: 0, y: 0, w: 16, h: 1 },
      { fill: '#5e4a26', x: 0, y: 1, w: 16, h: 4 },
      { fill: '#2a2011', x: 7, y: 1, w: 1, h: 4 },
      { fill: '#2a2011', x: 0, y: 5, w: 16, h: 1 },
    ];
    if (cell(tiles, c - 1, r) !== 'b') out.push({ fill: '#3b2c16', x: 0, y: -5, w: 2, h: 12 });
    if (cell(tiles, c + 1, r) !== 'b') out.push({ fill: '#3b2c16', x: 14, y: -5, w: 2, h: 12 });
    return out;
  }
  return [];
}

// ---- Gothicvania Town and Church ------------------------------------------
// One tileset image holds both packs (tools/build_assets.py): the town at the top
// left, the church tiles CH_ROW rows further down, then the props. Cells from
// TW_CHURCH_C on are drawn with the church rules.
const CH_ROW = 12;
const TW_CHURCH_C = 147; // first church column (levels.js builds the map to match)
const TW_STREET = 16; // a column topped at this row or lower is street; higher is a building
const TW_COBBLE = -9 / 16; // cobble tiles start 9 source px down their tile
const TW_ROOF = -4 / 16; // shingle tiles start 4 px down
const CH_DY = -8 / 16; // church slab tiles start 8 px down

const solidAbove = (tiles, c, r) => { let t = r; while (solid(tiles, c, t - 1)) t--; return t; };

/** Church stone: slab top, slab body, then plain stone wall that darkens near the bottom of the map. */
function churchBlock(tiles, c, r, d) {
  const h = hash(c, r);
  if (d === 0) {
    const col = !solid(tiles, c - 1, r) ? 0 : !solid(tiles, c + 1, r) ? 2 : [5, 9][h % 2];
    return [[col, CH_ROW + 10, 0, CH_DY]];
  }
  if (d === 1) return [[!solid(tiles, c - 1, r) ? 0 : !solid(tiles, c + 1, r) ? 2 : [5, 9][h % 2], CH_ROW + 11, 0, CH_DY]];
  return [[7 + (h % 2), CH_ROW + (r >= tiles.rows - 3 ? 8 : 6 + ((h >>> 3) % 2)), 0, CH_DY]];
}

/** Town rules: cobbled street over dark earth; buildings are shingled roofs over plain wall. */
function townTileArt(tiles, c, r) {
  const ch = cell(tiles, c, r);
  const church = c >= TW_CHURCH_C;
  if (ch === '#') {
    const t = solidAbove(tiles, c, r);
    const d = r - t;
    const h = hash(c, r);
    let out;
    if (church) out = churchBlock(tiles, c, r, d);
    else if (t >= TW_STREET) out = [[20 + (c % 2), 8 + Math.min(d, 2), 0, TW_COBBLE]];
    else if (d < 2) {
      out = [[c % 2 ? 4 : 6, d === 0 ? 0 : 1 + (h % 3), 0, d === 0 ? TW_ROOF : 0]];
      if (d === 0) out.push({ fill: '#b07a96', x: 0, y: 0, w: 16, h: 1 });
    } else if (r === TW_STREET) out = [[[5, 7, 8][h % 3], 10, 0, 0]]; // wall foot with the street's cobble
    else if (r > TW_STREET) out = [[20 + (c % 2), 9 + Math.min(r - TW_STREET - 1, 1), 0, TW_COBBLE]];
    else out = [[[7, 7, 14][h % 3], 6 + ((h >>> 4) % 2), 0, 0]];
    // The underside of a hanging block gets a dark edge so it reads as a ceiling.
    if (!solid(tiles, c, r + 1) && r < tiles.rows - 1) out.push({ fill: '#160c1c', x: 0, y: 13, w: 16, h: 3 });
    return out;
  }
  if (ch === '=') {
    if (church) {
      const l = cell(tiles, c - 1, r) === '=';
      const rt = cell(tiles, c + 1, r) === '=';
      const col = !l ? 0 : !rt ? 2 : [5, 9][c % 2];
      return [[col, CH_ROW + 10, 0, CH_DY], [col, CH_ROW + 11, 0, 8 / 16, 0, 8]];
    }
    return [[20, 5, 0, 0], { fill: '#c08a62', x: 0, y: 0, w: 16, h: 1 }];
  }
  if (ch === 'b') {
    const out = [
      { fill: '#b98a52', x: 0, y: 0, w: 16, h: 1 },
      { fill: '#7a5430', x: 0, y: 1, w: 16, h: 4 },
      { fill: '#2a1b10', x: 7, y: 1, w: 1, h: 4 },
      { fill: '#2a1b10', x: 0, y: 5, w: 16, h: 1 },
    ];
    if (cell(tiles, c - 1, r) !== 'b') out.push({ fill: '#4a3220', x: 0, y: -5, w: 2, h: 12 });
    if (cell(tiles, c + 1, r) !== 'b') out.push({ fill: '#4a3220', x: 14, y: -5, w: 2, h: 12 });
    return out;
  }
  return [];
}

// ---- Gothicvania old dark castle -------------------------------------------
// castle/tileset.png (tools/build_assets.py): the pack's tileset on top, then from row CS_ROW
// 2-tile-wide strips re-cut so the art starts at the top of the tile: floor top, floor body, ledge.
const CS_ROW = 15;
const CS_BRICK = 32; // first of two brick-wall columns (rows 11-13) for deep masonry
const CS_CEIL = [22, 26]; // ceiling underside tiles (row 6); a mossy lip along the bottom edge
const CS_CEIL_BODY = [[23, 3], [24, 3], [23, 4], [24, 4]];

/** Castle rules: mossy floors over brick, dark ceilings with a lip underneath, iron-and-plank drawbridges. */
function castleTileArt(tiles, c, r) {
  const ch = cell(tiles, c, r);
  if (ch === '#') {
    const h = hash(c, r);
    const d = r - solidAbove(tiles, c, r);
    const under = !solid(tiles, c, r + 1) && r < tiles.rows - 1;
    let out;
    if (d === 0) out = [[c % 2, CS_ROW, 0, 0]];
    else if (d === 1) out = [[c % 2, CS_ROW + 1, 0, 0]];
    else if (under) out = [[CS_CEIL[h % 2], 6, 0, 0]];
    else if (d < 4 && r < 4) out = [[...CS_CEIL_BODY[h % 4], 0, 0]];
    else out = [[CS_BRICK + (c % 2), 11 + ((h >>> 3) % 3), 0, 0]];
    if (under) {
      // The pack's gold lip would read as a floor from below: dim it, and shade the underside of thin slabs.
      out.push({ fill: d < 2 ? '#0a1514' : '#1d2c1a', x: 0, y: d < 2 ? 13 : 14, w: 16, h: d < 2 ? 3 : 2 });
    }
    return out;
  }
  if (ch === '=') {
    return [[c % 2, CS_ROW + 2, 0, 0], { fill: '#070c0c', x: 0, y: 15, w: 16, h: 1 }];
  }
  if (ch === 'b') {
    // Drawbridge: dark oak planks bound in iron, with a chain post at each loose end.
    const out = [
      { fill: '#7a5a34', x: 0, y: 0, w: 16, h: 1 },
      { fill: '#4a3420', x: 0, y: 1, w: 16, h: 4 },
      { fill: '#1b120a', x: 7, y: 1, w: 1, h: 4 },
      { fill: '#6c7478', x: 0, y: 5, w: 16, h: 1 },
    ];
    if (cell(tiles, c - 1, r) !== 'b') out.push({ fill: '#6c7478', x: 0, y: -6, w: 2, h: 13 });
    if (cell(tiles, c + 1, r) !== 'b') out.push({ fill: '#6c7478', x: 14, y: -6, w: 2, h: 13 });
    return out;
  }
  return [];
}

const CASTLE_BLACK = '#070707';

/** The great hall: columns, windows and stairs in the dark, repeating sideways, with black above and below. */
function drawCastleBackground(ctx, cam) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = CASTLE_BLACK;
  ctx.fillRect(0, 0, W, H);
  flatLayer(ctx, 'castle/backdrop', cam, 0.3, 0.55, 90, CASTLE_BLACK, CASTLE_BLACK);
  ctx.restore();
}

/** Draw a layer repeating sideways at `scale`; returns where it landed. */
function tileLayer(ctx, key, cam, fx, fy, y0) {
  const e = getSprite(key);
  if (!e || !e.ready) return null;
  const w = e.img.width * SCALE;
  const h = e.img.height * SCALE;
  const off = ((cam.x * fx) % w + w) % w;
  const y = Math.round(y0 - cam.y * fy);
  for (let x = -Math.round(off); x < W; x += w) ctx.drawImage(e.img, x, y, w, h);
  return { y, h };
}

/** Magic Cliffs sky, clouds, distant islands and sea. */
function drawCliffsBackground(ctx, cam) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#5bc0d8';
  ctx.fillRect(0, 0, W, H);
  tileLayer(ctx, 'cliffs/sky', cam, 0, 0.02, 0);
  tileLayer(ctx, 'cliffs/clouds', cam, 0.06, 0.04, 30);
  const far = tileLayer(ctx, 'cliffs/far-grounds', cam, 0.18, 0.12, 250);
  const seaTop = far ? far.y + far.h - 6 : 420;
  const sea = tileLayer(ctx, 'cliffs/sea', cam, 0.18, 0, seaTop);
  const seaBottom = sea ? sea.y + sea.h : seaTop;
  if (seaBottom < H) {
    ctx.fillStyle = '#1b6d8f';
    ctx.fillRect(0, seaBottom, W, H - seaBottom);
  }
  ctx.restore();
}

/** Colour of every row above and below the swamp layers' artwork (they are flat there). */
const SWAMP_GLOOM = '#2f2f1c';
const SWAMP_GREEN = '#1b6642';

/**
 * Swamp layer: tiled sideways like tileLayer, then the flat colour the picture
 * fades to is extended up and down so a tall (portrait) view is always covered.
 */
function swampLayer(ctx, key, cam, fx, fy, color) {
  const l = tileLayer(ctx, key, cam, fx, fy, 48);
  if (!l) return;
  ctx.fillStyle = color;
  if (l.y > 0) ctx.fillRect(0, 0, W, l.y);
  if (l.y + l.h < H) ctx.fillRect(0, l.y + l.h, W, H - l.y - l.h);
}

/**
 * Gothicvania Swamp: murky green sky behind two layers of gnarled forest. The
 * pictures are anchored to the world (48 px down at camera 0) and follow the
 * camera's height closely, so the tree line sits just above the ground.
 */
function drawSwampBackground(ctx, cam) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = SWAMP_GREEN;
  ctx.fillRect(0, 0, W, H);
  swampLayer(ctx, 'swamp/background', cam, 0.04, 0.6, SWAMP_GREEN);
  ctx.fillStyle = 'rgba(4, 16, 10, 0.35)';
  ctx.fillRect(0, 0, W, H);
  swampLayer(ctx, 'swamp/mid-layer-01', cam, 0.16, 0.7, SWAMP_GLOOM);
  swampLayer(ctx, 'swamp/mid-layer-02', cam, 0.32, 0.85, SWAMP_GLOOM);
  ctx.restore();
}

const TOWN_SKY_TOP = '#854a62';
const TOWN_SKY_LOW = '#713f5a';
const TOWN_HOUSES = '#392d55';
const CHURCH_WALL = '#272638';

/** Like swampLayer: tile a layer sideways, then continue its flat top and bottom colours over a tall view. */
function flatLayer(ctx, key, cam, fx, fy, y0, top, bottom) {
  const l = tileLayer(ctx, key, cam, fx, fy, y0);
  if (!l) return;
  if (top && l.y > 0) { ctx.fillStyle = top; ctx.fillRect(0, 0, W, l.y); }
  if (bottom && l.y + l.h < H) { ctx.fillStyle = bottom; ctx.fillRect(0, l.y + l.h, W, H - l.y - l.h); }
}

/**
 * Gothicvania Town: a dusk sky and mountains darkened to a gloom, with the town's
 * rooftops behind. Toward the church (TW_CHURCH_C) the view fades into the
 * church's wall panels (window, column, altar, gargoyle).
 */
function drawTownBackground(ctx, cam) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = TOWN_SKY_LOW;
  ctx.fillRect(0, 0, W, H);
  flatLayer(ctx, 'town/background', cam, 0.04, 0.2, 0, TOWN_SKY_TOP, TOWN_SKY_LOW);
  ctx.fillStyle = 'rgba(14, 6, 30, 0.45)';
  ctx.fillRect(0, 0, W, H);
  flatLayer(ctx, 'town/middleground', cam, 0.16, 0.5, -140, null, TOWN_HOUSES);
  ctx.fillStyle = 'rgba(14, 6, 30, 0.25)';
  ctx.fillRect(0, 0, W, H);
  const nave = clamp((cam.x - (TW_CHURCH_C * T - 1100)) / 600, 0, 1);
  if (nave > 0) {
    ctx.globalAlpha = nave;
    ctx.fillStyle = CHURCH_WALL;
    ctx.fillRect(0, 0, W, H);
    flatLayer(ctx, 'town/church-backdrop', cam, 0.3, 0.6, 60, CHURCH_WALL, CHURCH_WALL);
  }
  ctx.restore();
}

/**
 * Per-stage look, keyed by the tile map's `theme`.
 *  - tileset: sprite key of the tileset; cells are cut from it in 16 px tiles
 *  - tileArt(tiles, c, r): parts for one cell. A part is either
 *      [srcCol, srcRow, dxTiles, dyTiles, flip?, srcH?]  (tile cut from the tileset; offsets
 *      may be fractions of a tile; srcH crops to the first rows), or
 *      { fill, x, y, w, h }  (plain rectangle, source px from the cell's corner)
 *  - background(ctx, cam): full-view parallax backdrop
 *  - fallback: flat colours used until the tileset loads
 *  - bottomFill, bottomRaise: colour of the ground continuing below the last row, and how many
 *    px it starts above the map's edge (for tiles lifted off their cell)
 *  - water: optional {surface, deep} tiles drawn along the bottom of every pit
 * Scenery stamps for each theme live in STAMPS (domain/levels.js).
 */
const THEMES = {
  cliffs: {
    tileset: 'cliffs/tileset',
    tileArt: cliffsTileArt,
    background: drawCliffsBackground,
    fallback: { top: '#9ab030', fill: '#2a3a3a', topRow: 12 },
    bottomFill: '#132221',
    bottomRaise: 0,
  },
  swamp: {
    tileset: 'swamp/tileset',
    tileArt: swampTileArt,
    background: drawSwampBackground,
    fallback: { top: '#4a4a22', fill: '#1e201e', topRow: 0 },
    bottomFill: '#1e201e',
    bottomRaise: 12,
    water: { surface: [14, 5], deep: [14, 6], span: 4 },
  },
  castle: {
    tileset: 'castle/tileset',
    tileArt: castleTileArt,
    background: drawCastleBackground,
    fallback: { top: '#7a6a2a', fill: '#0c231f', topRow: CS_ROW },
    bottomFill: '#0c231f',
    bottomRaise: 0,
  },
  town: {
    tileset: 'town/tileset',
    tileArt: townTileArt,
    background: drawTownBackground,
    fallback: { top: '#8a5a3a', fill: '#1a0f1e', topRow: 8 },
    bottomFill: '#1a0f1e',
    bottomRaise: 20,
  },
};

function themeOf(tiles) {
  return THEMES[tiles?.theme] || THEMES.cliffs;
}

/**
 * Parts for one cell (see THEMES).
 * @param {{ theme?: string }} tiles
 */
export function tileArt(tiles, c, r) {
  return themeOf(tiles).tileArt(tiles, c, r);
}

/** Full-view backdrop for a theme name. */
export function drawStageBackground(ctx, cam, theme) {
  (THEMES[theme] || THEMES.cliffs).background(ctx, cam);
}

function tilesetImg(theme) {
  const e = getSprite(theme.tileset);
  return e && e.ready ? e.img : null;
}

function drawStamp(ctx, img, st, cam) {
  const [sc, sr, sw, sh] = st.src;
  const x = Math.round(st.x - cam.x);
  const y = Math.round(st.y - cam.y);
  if (x > W || x + sw * T < 0 || y > H || y + sh * T < 0) return;
  ctx.drawImage(img, sc * SRC, sr * SRC, sw * SRC, sh * SRC, x, y, sw * T, sh * T);
}

/** Stamps for one layer ('back' behind tiles, 'mid' with tiles, 'front' over actors). */
export function drawStamps(ctx, tiles, cam, layer) {
  const img = tilesetImg(themeOf(tiles));
  if (!img || !tiles?.stamps) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const st of tiles.stamps) {
    if ((st.layer || 'back') === layer) drawStamp(ctx, img, st, cam);
  }
  ctx.restore();
}

/** Water along the bottom of every column that has no ground in its last row. */
function drawPitWater(ctx, img, tiles, theme, c0, c1, cam) {
  const { surface, deep, span } = theme.water;
  const top = tiles.rows - 3;
  for (let c = c0; c <= c1; c++) {
    if (solid(tiles, c, tiles.rows - 1)) continue;
    const x = Math.round(c * T - cam.x);
    for (let k = 0; k < 3; k++) {
      const [sc, sr] = k === 0 ? surface : deep;
      ctx.drawImage(img, (sc + (c % span)) * SRC, sr * SRC, SRC, SRC, x, Math.round((top + k) * T - cam.y), T, T);
    }
  }
}

export function drawTiles(ctx, tiles, cam) {
  if (!tiles) return;
  const theme = themeOf(tiles);
  const img = tilesetImg(theme);
  const c0 = Math.max(0, Math.floor(cam.x / T) - 1);
  const c1 = Math.min(tiles.cols - 1, Math.ceil((cam.x + W) / T) + 1);
  const r0 = Math.max(0, Math.floor(cam.y / T) - 1);
  const r1 = Math.min(tiles.rows - 1, Math.ceil((cam.y + H) / T) + 1);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (img && theme.water) drawPitWater(ctx, img, tiles, theme, c0, c1, cam);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const parts = theme.tileArt(tiles, c, r);
      for (const part of parts) {
        if (!Array.isArray(part)) {
          ctx.fillStyle = part.fill;
          ctx.fillRect(Math.round(c * T - cam.x) + part.x * SCALE, Math.round(r * T - cam.y) + part.y * SCALE,
            part.w * SCALE, part.h * SCALE);
          continue;
        }
        const [sc, sr, dx, dy, flip, srcH = SRC] = part;
        const x = Math.round((c + dx) * T - cam.x);
        const y = Math.round((r + dy) * T - cam.y);
        const dh = srcH * SCALE;
        if (img && flip) {
          ctx.save();
          ctx.translate(x + T, y);
          ctx.scale(-1, 1);
          ctx.drawImage(img, sc * SRC, sr * SRC, SRC, srcH, 0, 0, T, dh);
          ctx.restore();
        } else if (img) ctx.drawImage(img, sc * SRC, sr * SRC, SRC, srcH, x, y, T, dh);
        else {
          ctx.fillStyle = sr === theme.fallback.topRow ? theme.fallback.top : theme.fallback.fill;
          ctx.fillRect(x, y, T, dh);
        }
      }
    }
  }
  // Ground below the last row continues off-screen
  const bottomY = Math.round(tiles.rows * T - cam.y);
  if (bottomY < H) {
    ctx.fillStyle = theme.bottomFill;
    for (let c = c0; c <= c1; c++) {
      if (!solid(tiles, c, tiles.rows - 1) && !theme.water) continue;
      ctx.fillRect(Math.round(c * T - cam.x), bottomY - theme.bottomRaise, T, H - bottomY + theme.bottomRaise);
    }
  }
  ctx.restore();
}

const LADDER_TOP = 5; // first drawn row of tile/ladder (rows 5-58)
const LADDER_BAND = 54;

export function drawLaddersPixel(ctx, ladders, cam) {
  if (!ladders?.length) return;
  const e = getSprite('tile/ladder');
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const l of ladders) {
    const x = Math.round(l.x - cam.x);
    const y = Math.round(l.y - cam.y);
    if (x < -40 || x > W + 40) continue;
    if (e && e.ready) {
      // The picture is 64 rows tall with 5 empty rows at each end; repeat only the drawn band so rungs run on.
      for (let yy = 0; yy < l.h; yy += LADDER_BAND) {
        const hh = Math.min(LADDER_BAND, l.h - yy);
        ctx.drawImage(e.img, 0, LADDER_TOP, 32, hh, x - 16, y + yy, 32, hh);
      }
    } else {
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(x - 12, y, 4, l.h);
      ctx.fillRect(x + 8, y, 4, l.h);
      for (let yy = 6; yy < l.h; yy += 16) ctx.fillRect(x - 12, y + yy, 24, 4);
    }
  }
  ctx.restore();
}

/** Stone arch with an iron portcullis; bars lift when the gate opens. */
export function drawPixelGate(ctx, gate, cam, openAmt) {
  if (!gate) return;
  const x = Math.round(gate.x - cam.x);
  const by = Math.round(gate.y + gate.h - cam.y);
  const w = gate.w || 64;
  const h = gate.h || 128;
  if (x < -120 || x > W + 120) return;
  const top = by - h;
  ctx.save();
  // Opening
  ctx.fillStyle = '#10161a';
  ctx.fillRect(x + 8, top + 12, w - 16, h - 12);
  // Bars
  const lift = Math.round((h - 16) * clamp(openAmt, 0, 1));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 8, top + 12, w - 16, h - 12);
  ctx.clip();
  ctx.fillStyle = '#5a6068';
  for (let bx = x + 12; bx < x + w - 10; bx += 10) ctx.fillRect(bx, top + 12 - lift, 4, h);
  ctx.fillStyle = '#7d858e';
  for (let yy = top + 30 - lift; yy < by; yy += 28) ctx.fillRect(x + 8, yy, w - 16, 4);
  ctx.fillStyle = '#9aa2aa';
  for (let bx = x + 12; bx < x + w - 10; bx += 10) ctx.fillRect(bx, by - 8 - lift, 4, 8);
  ctx.restore();
  // Pillars + lintel
  const stone = (sx, sy, sw, sh) => {
    ctx.fillStyle = '#6e6a5c';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = '#8f8a74';
    for (let yy = sy; yy < sy + sh; yy += 16) ctx.fillRect(sx, yy, sw, 4);
    ctx.fillStyle = '#4a473d';
    ctx.fillRect(sx + sw - 4, sy, 4, sh);
  };
  stone(x - 8, top, 16, h);
  stone(x + w - 8, top, 16, h);
  stone(x - 12, top - 12, w + 24, 16);
  ctx.fillStyle = openAmt > 0.5 ? '#7dffa0' : '#d4a43a';
  ctx.fillRect(x + w / 2 - 4, top - 8, 8, 8);
  ctx.restore();
}

export function drawFlags(ctx, checkpoints, cam, reached, activeId, t) {
  if (!checkpoints?.length) return;
  for (const cp of checkpoints) {
    const x = Math.round(cp.x - cam.x);
    const y = Math.round(cp.y - cam.y);
    if (x < -40 || x > W + 40) continue;
    const on = reached?.has(cp.id) || cp.id === activeId;
    ctx.save();
    if (on) {
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 4);
      ctx.fillStyle = '#ffe28a';
      ctx.beginPath();
      ctx.ellipse(x, y - 30, 26, 36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (!drawImageKey(ctx, 'prop/flag', x - 20, y - 64, 40, 64, true)) {
      ctx.fillStyle = '#6a4a28';
      ctx.fillRect(x - 2, y - 56, 4, 56);
      ctx.fillStyle = on ? '#5ab060' : '#3a5a9a';
      ctx.fillRect(x + 2, y - 54, 20, 14);
    }
    ctx.restore();
  }
}

export function drawPickups(ctx, pickups, cam, t) {
  if (!pickups?.length) return;
  for (const pk of pickups) {
    if (pk.taken) continue;
    const x = Math.round(pk.x - cam.x);
    const y = Math.round(pk.y - cam.y + Math.sin(t * 3 + pk.x) * 3);
    if (x < -30 || x > W + 30) continue;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ff9a9a';
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (!drawImageKey(ctx, 'fx/heart', x - 12, y - 12, 24, 24)) {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(x - 8, y - 8, 16, 16);
    }
    ctx.restore();
  }
}

/** Enemy shots: a warm glow (so they read in dark stages) and the sprite turned along the velocity. */
export function drawProjectiles(ctx, projectiles, cam) {
  if (!projectiles?.length) return;
  for (const p of projectiles) {
    const cfg = ENEMY_PROJECTILES[p.kind];
    const en = cfg && getSprite(cfg.sprite);
    if (!en || !en.ready) continue;
    const x = Math.round(p.x - cam.x);
    const y = Math.round(p.y - cam.y);
    if (x < -60 || x > W + 60) continue;
    const frame = Math.floor(p.age * (en.meta.fps || 12)) % en.meta.frames;
    const dw = en.meta.fw * cfg.scale;
    const dh = en.meta.fh * cfg.scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 4, x, y, 44);
    g.addColorStop(0, 'rgba(255,160,50,0.55)');
    g.addColorStop(1, 'rgba(255,100,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 44, y - 44, 88, 88);
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI); // the art flies left
    if (p.vx > 0) ctx.scale(1, -1); // keep the fireball's top up
    ctx.drawImage(en.img, frame * en.meta.fw, 0, en.meta.fw, en.meta.fh, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }
}

export function drawEffects(ctx, effects, cam) {
  if (!effects?.length) return;
  for (const fx of effects) {
    if (fx.key === 'fx/spark') {
      const k = clamp(fx.t / 0.14, 0, 1);
      if (k >= 1) continue;
      const x = Math.round(fx.x - cam.x);
      const y = Math.round(fx.y - cam.y);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#fffbe8';
      const r = 6 + k * 22;
      ctx.fillRect(x - r, y - 2, r * 2, 4);
      ctx.fillRect(x - 2, y - r * 0.6, 4, r * 1.2);
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.restore();
      continue;
    }
    const e = getSprite(fx.key);
    if (!e || !e.ready) continue;
    const frame = Math.floor(fx.t * (e.meta.fps || 12));
    if (frame >= (e.meta.frames || 1)) continue;
    drawSprite(ctx, fx.key, frame, fx.x, fx.y, {
      scale: SCALE, camX: cam.x, camY: cam.y, pixel: true,
    });
  }
}

export function drawPopups(ctx, popups, cam) {
  if (!popups?.length) return;
  ctx.save();
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(20, 12, 8, 0.85)';
  for (const q of popups) {
    const x = Math.round(q.x - cam.x);
    const y = Math.round(q.y - cam.y);
    ctx.globalAlpha = clamp(q.life / (q.max * 0.5), 0, 1);
    ctx.strokeText(q.text, x, y);
    ctx.fillStyle = q.color;
    ctx.fillText(q.text, x, y);
  }
  ctx.restore();
}
