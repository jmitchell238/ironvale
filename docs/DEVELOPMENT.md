# Development

## Running locally

```bash
npm start
```

This serves the folder on http://localhost:8080. The game uses ES modules, which don't load from `file://`, so opening `index.html` directly won't work.

Add `?debug` to the URL to expose the running session as `window.__session` in the browser console (handy for jumping the knight to a spot with `__session.player.x = ...`).

## Tests

```bash
npm test
```

The tests import the real modules in Node. They cover the pure game rules (combat, enemy AI, the body/sword split), `GameSession` with stand-in audio and save adapters, and the page shell (module entry point, service worker cache name). They don't cover drawing, touch input or installing.

## Versioning

`GAME_VERSION` is in `js/config/index.js`. When you bump it, set `CACHE` in `sw.js` to `'ironvale-' + GAME_VERSION`. The tests check that they match.

## Common changes

### Building out a stage

Stages live in `js/domain/levels.js`. `buildForgegateFields()` is the model to copy: create a map with `createTileMap(cols, rows)`, lay it out with `groundCells` (ground from a row down to the bottom), `fillCells` with `'='` (stone ledge) or `'b'` (bridge), add ladders, coins, hearts and scenery stamps, then call `compileTileMap()`. Encounters, checkpoints and the gate go on the stage object.

Some numbers to design around (32 px tiles):

- A single jump clears about 3 tiles up and 4 across. Keep main-route steps to 2 tiles and gaps to 3; use 4-tile climbs for optional areas that need a double jump or a ladder.
- A ladder's top (`rTop`) must be the row of a ledge or ground top, so the knight has something to step onto.
- Enemies stand on platform tops. The "full tile stage" test checks that every ground enemy, checkpoint and ladder top sits on one, and the bot test checks that a simple run-and-jump bot reaches the gate.

`buildForestRamparts()` follows the same pattern with the `'swamp'` theme, and `buildForgeRuins()` with `'town'` (street, rooftops, a hall with a ceiling to walk under or climb over, then the church). `buildIronCaverns()` uses the `'castle'` theme: halls with ceilings, two stone shafts, drawbridges over pits, and a walled throne room at the end. Its `boss` block (`arenaMinX`, `arenaMaxX`, `spawnX`, `spawnY`) must sit on one flat floor inside the bounds, with the gate as the arena's left wall (the tests check this); the arena should be at least one screen (960 px) wide so the camera holds still.

### Adding a theme

A tile map's `theme` (the third argument of `createTileMap`, copied to the level's `theme`) decides how it is drawn:

1. Add the tileset (and any parallax layers) to `tools/build_assets.py` so they land in `assets/gv/<theme>/` and `js/config/spriteMeta.js`, and list them in `sw.js` and `assets/CREDITS.md`.
2. In `js/adapters/renderStage.js`, write a tile-rule function (what to draw for `'#'`, `'='` and `'b'`; see `cliffsTileArt` and `swampTileArt`) and a background function, then add an entry to `THEMES` with the tileset key, those two functions and the fallback colours.
3. In `js/domain/levels.js`, add the theme's scenery to `STAMPS` (cut from the tileset; fractional tile sizes are fine).
4. Build the layout with `createTileMap(cols, rows, '<theme>')`. Tiles that don't fill their cell (the swamp's earth starts 5 px down its tile) are lifted with a fractional `dy` so the art meets the platform line, and backgrounds must cover the whole view, including a tall portrait one.

A theme can draw from more than one pack if they share one tileset image: the `'town'` theme's `town/tileset.png` holds the town tiles, the church tiles 12 rows down and the town props below, and its tile rule switches to church stone from a column on (`TW_CHURCH_C`).

The castle theme works the same way with one extra step: `castle/tileset.png` holds the pack's tileset on top, floor, body and ledge strips re-cut so the art starts at the top of the tile (from row `CS_ROW`), and the pack's two backdrop pictures below, which the props are cut from (see `castle_assets()` in `tools/build_assets.py`). Keep ceilings 6 tiles above the floor wherever the player has to jump.

The "full tile stage" and bot tests run for every non-stub tile stage automatically.

### Updating the art

The packs listed in `assets/CREDITS.md` aren't in the repo, only the pieces the game uses. To rebuild `assets/gv/` and `js/config/spriteMeta.js`, unzip the packs into one folder (named as in the paths at the top of `tools/build_assets.py`) and run:

```bash
python3 tools/build_assets.py path/to/packs
```

It needs Pillow. Every animation is lined up on the character's feet, so sprites are drawn bottom-centre at the entity's position.

### Adding an enemy

1. Put its behavior in `js/domain/enemyAi.js`, or a new file under `js/domain/`.
2. Add its stats to the enemy table in `js/config/index.js` (`skin` names its sprite in `assets/gv/enemy/`; the Warden also has `warden_windup` and `warden_slam` strips chosen in `wardenFrame()` in `render.js`), and an entry in `ENEMY_MELEE` if it has a telegraphed attack (or `ENEMY_LUNGE` plus `lunges: true` for the hound's leap). Several strips per enemy are chosen in `render.js`, like `houndFrame()`. A caster uses `ENEMY_CAST` plus `casts: true` (the wizard), a diving flier `ENEMY_SWOOP` plus `swoops: true` (the fire skull), and a new kind of shot goes in `ENEMY_PROJECTILES` (see [ARCHITECTURE.md](ARCHITECTURE.md#enemy-projectiles)).
3. Add it to a stage's encounters.
4. Test the AI in `tests/run.mjs` without the canvas.

### Changing the sword

Change `PLAYER_SWORD.attackRange` in `js/config/index.js` and run the tests. The body tests should still pass. See [ARCHITECTURE.md](ARCHITECTURE.md#body-sword-and-drawing-are-separate) for which settings are independent.

### Changing saved data

All saving goes through `js/adapters/save.js`. `normalizeMeta()` in `js/domain/rpg.js` fills in missing fields, so older saves keep working when you add one.
