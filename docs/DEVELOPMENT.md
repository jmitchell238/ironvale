# Development

## Running locally

```bash
npm start
```

This serves the folder on http://localhost:8080. The game uses ES modules, which don't load from `file://`, so opening `index.html` directly won't work.

The game draws to a 960×540 landscape canvas, letterboxed to fit the screen.

## Tests

```bash
npm test
```

## Versioning

`GAME_VERSION` is in `js/config/index.js`. When you bump it, set `CACHE` in `sw.js` to `'ironvale-' + GAME_VERSION`. The tests check that they match.

## Code layout

The code is layered ES modules:

```
app → adapters → world/GameSession + systems → domain → config/core
```

[ARCHITECTURE.md](ARCHITECTURE.md) explains each layer.
