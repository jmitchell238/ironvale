# Development

## Running locally

```bash
npm start
```

This serves the folder on http://localhost:8080. The game uses ES modules, which don't load from `file://`, so opening `index.html` directly won't work.

## Tests

```bash
npm test
```

The tests import the real modules in Node. They cover the pure game rules (combat, enemy AI, the body/sword split), `GameSession` with stand-in audio and save adapters, and the page shell (module entry point, service worker cache name). They don't cover drawing, touch input or installing.

## Versioning

`GAME_VERSION` is in `js/config/index.js`. When you bump it, set `CACHE` in `sw.js` to `'ironvale-' + GAME_VERSION`. The tests check that they match.

## Common changes

### Building out a stage

Stages live in `js/domain/levels.js`. Replace the placeholder (`stubBiome(...)`) with a full definition like `FORGEGATE_FIELDS`: platforms, ladders, encounters, checkpoints, the gate, and `boss` if the stage has one. Keep layout in the stage definition, not in `render.js`.

### Adding an enemy

1. Put its behavior in `js/domain/enemyAi.js`, or a new file under `js/domain/`.
2. Add its stats to the enemy table in `js/config/index.js`, and an entry in `ENEMY_MELEE` if it has a telegraphed attack.
3. Add it to a stage's encounters.
4. Test the AI in `tests/run.mjs` without the canvas.

### Changing the sword

Change `PLAYER_SWORD.attackRange` in `js/config/index.js` and run the tests. The body tests should still pass. See [ARCHITECTURE.md](ARCHITECTURE.md#body-sword-and-drawing-are-separate) for which settings are independent.

### Changing saved data

All saving goes through `js/adapters/save.js`. `normalizeMeta()` in `js/domain/rpg.js` fills in missing fields, so older saves keep working when you add one.
