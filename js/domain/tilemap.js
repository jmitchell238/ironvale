/**
 * Domain: tile-map stages (pure).
 *
 * A stage is a grid of cells built with a small builder, then compiled into
 * the same shapes the rest of the game already uses: walkable platform tops,
 * solid rectangles (walls and ceilings), ladders, coins and pickups. The
 * renderer reads `tiles` to pick art for each cell.
 *
 * Cells: '#' solid ground, '=' stone ledge (one-way), 'b' bridge (one-way),
 * '.' empty.
 */

export const TILE = 32;

export function createTileMap(cols, rows) {
  const cells = [];
  for (let r = 0; r < rows; r++) cells.push(new Array(cols).fill('.'));
  return { cols, rows, cells, ladders: [], stamps: [], coins: [], pickups: [], props: [] };
}

export function cellAt(map, c, r) {
  if (r < 0) return '.';
  if (r >= map.rows) return map.cells[map.rows - 1][Math.max(0, Math.min(map.cols - 1, c))] === '#' ? '#' : '.';
  if (c < 0 || c >= map.cols) return '.';
  return map.cells[r][c];
}

export function fillCells(map, c0, r0, c1, r1, ch) {
  for (let r = Math.max(0, r0); r <= Math.min(map.rows - 1, r1); r++) {
    for (let c = Math.max(0, c0); c <= Math.min(map.cols - 1, c1); c++) map.cells[r][c] = ch;
  }
}

/** Solid ground from `top` down to the bottom of the map. */
export function groundCells(map, c0, c1, top) {
  fillCells(map, c0, top, c1, map.rows - 1, '#');
}

export function isSolidCell(ch) { return ch === '#'; }
export function isLedgeCell(ch) { return ch === '=' || ch === 'b'; }

/** Walkable tops: solid cells with open air above, plus one-way ledges, merged per row. */
export function compilePlatforms(map) {
  const out = [];
  for (let r = 0; r < map.rows; r++) {
    let c = 0;
    while (c < map.cols) {
      const ch = map.cells[r][c];
      const top = (isSolidCell(ch) && !isSolidCell(cellAt(map, c, r - 1))) || isLedgeCell(ch);
      if (!top) { c++; continue; }
      const kind = isSolidCell(ch) ? 'ground' : (ch === 'b' ? 'bridge' : 'ledge');
      let e = c;
      while (e + 1 < map.cols) {
        const n = map.cells[r][e + 1];
        const nTop = (isSolidCell(n) && !isSolidCell(cellAt(map, e + 1, r - 1))) || isLedgeCell(n);
        const nKind = isSolidCell(n) ? 'ground' : (n === 'b' ? 'bridge' : 'ledge');
        if (!nTop || nKind !== kind) break;
        e++;
      }
      out.push({
        x: c * TILE, y: r * TILE, w: (e - c + 1) * TILE,
        style: 'tile', h: TILE, exact: true, oneWay: kind !== 'ground', kind,
      });
      c = e + 1;
    }
  }
  return out;
}

/** Solid cells merged into rectangles (row runs, then stacked runs with equal span). */
export function compileSolids(map) {
  const runs = [];
  for (let r = 0; r < map.rows; r++) {
    let c = 0;
    while (c < map.cols) {
      if (!isSolidCell(map.cells[r][c])) { c++; continue; }
      let e = c;
      while (e + 1 < map.cols && isSolidCell(map.cells[r][e + 1])) e++;
      runs.push({ c0: c, c1: e, r0: r, r1: r });
      c = e + 1;
    }
  }
  const merged = [];
  for (const run of runs) {
    const prev = merged.find(m => m.c0 === run.c0 && m.c1 === run.c1 && m.r1 === run.r0 - 1);
    if (prev) prev.r1 = run.r0;
    else merged.push({ ...run });
  }
  return merged.map(m => ({
    x: m.c0 * TILE, y: m.r0 * TILE,
    w: (m.c1 - m.c0 + 1) * TILE, h: (m.r1 - m.r0 + 1) * TILE,
  }));
}

/**
 * Turn a built map into level fields.
 * @returns {{ platforms: object[], solids: object[], ladders: object[], coins: object[],
 *   pickups: object[], tiles: object }}
 */
export function compileTileMap(map) {
  return {
    platforms: compilePlatforms(map),
    solids: compileSolids(map),
    ladders: map.ladders.map(l => ({
      x: l.c * TILE + TILE / 2, y: l.rTop * TILE, h: (l.rBottom - l.rTop) * TILE, w: 30,
    })),
    coins: map.coins.map(([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 })),
    pickups: map.pickups.map(p => ({ type: p.type, x: p.c * TILE + TILE / 2, y: p.r * TILE + TILE / 2 })),
    props: map.props.slice(),
    tiles: { cols: map.cols, rows: map.rows, size: TILE, cells: map.cells, stamps: map.stamps },
  };
}
