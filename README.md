# Ironvale

**Small knight. A greater tomorrow.**

A 2D action-platformer about an apprentice knight who explores, climbs, fights, and opens the path to a brighter vale.

**Play:** https://jmitchell238.github.io/ironvale/

## Controls

| Input | Action |
|-------|--------|
| Left stick / A D / ← → | Run |
| W / ↑ on a ladder | Climb |
| JUMP / Space | Jump (press again in air = double jump) |
| S / ↓ | Duck |
| ATK / J / F / Shift | Sword slash |
| 1–6 | Train attributes at the forge (between stages) |
| Esc | Menu |

## Campaign

1. **Forgegate Fields** — teaching stage. Ruins, ladders, goblins, bats, shield skeletons, locked gate.
2. **Forest Ramparts** — nature reclaims the walls.
3. **Forge Ruins** — old machines, new paths.
4. **Iron Caverns** — campaign boss: **The Iron Warden**.

Clear encounters to unlock the end gate. Touch a flag for checkpoints. Level-ups bank forge points mid-stage; spend them between biomes.

## Architecture

Layered ES modules — see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

```
app → adapters → world/GameSession + systems → domain → config/core
```

Sword length, body size, and draw scale are separate config axes.

## Tests

```bash
npm test
```

## Local

```bash
npm start
```

Requires HTTP (ES modules). Landscape 960×540 canvas, letterboxed.
