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

Stages 2–4 still use `stubBiome(...)`. Each needs its own tileset; `renderStage.js` currently picks tiles from the Magic Cliffs set only.

### Updating the art

The packs listed in `assets/CREDITS.md` aren't in the repo, only the pieces the game uses. To rebuild `assets/gv/` and `js/config/spriteMeta.js`, unzip the packs into one folder (named as in the paths at the top of `tools/build_assets.py`) and run:

```bash
python3 tools/build_assets.py path/to/packs
```

It needs Pillow. Every animation is lined up on the character's feet, so sprites are drawn bottom-centre at the entity's position.

### Adding an enemy

1. Put its behavior in `js/domain/enemyAi.js`, or a new file under `js/domain/`.
2. Add its stats to the enemy table in `js/config/index.js` (`skin` names its sprite in `assets/gv/enemy/`), and an entry in `ENEMY_MELEE` if it has a telegraphed attack.
3. Add it to a stage's encounters.
4. Test the AI in `tests/run.mjs` without the canvas.

### Changing the sword

Change `PLAYER_SWORD.attackRange` in `js/config/index.js` and run the tests. The body tests should still pass. See [ARCHITECTURE.md](ARCHITECTURE.md#body-sword-and-drawing-are-separate) for which settings are independent.

### Changing saved data

All saving goes through `js/adapters/save.js`. `normalizeMeta()` in `js/domain/rpg.js` fills in missing fields, so older saves keep working when you add one.
