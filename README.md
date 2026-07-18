# Ironvale

Medieval **2D platformer** — run, jump, and sword-slash through discrete stages of Ironvale. Clear encounters, open the end gate, defeat the stage boss, and advance the campaign.

**Play:** https://jmitchell238.github.io/ironvale/

## Controls

| Input | Action |
|-------|--------|
| Left stick / A D / ← → | Run |
| JUMP / Space / W / ↑ | Jump |
| ATK / J / F / Shift | Sword slash |
| 1 / 2 / 3 | Pick level-up upgrade |
| Esc | Menu |

## Features

- Knight character art (GameArt2D free sprite)
- Gravity, coyote time, variable jump
- Campaign stages with authored layouts and end bosses
- Melee combat, coins/XP; persistent RPG stats **between stages**
- End gate → boss arena → allocate points → stage clear
- Installable PWA

## Architecture

Layered ES modules — see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

```
app → adapters → world/GameSession → domain → config/core
```

Sword length, body size, and draw scale are separate config axes so changing one does not break the others.

## Tests

```bash
npm test
# or: node tests/run.mjs
```

## Local

```bash
npm start
# or: python3 -m http.server 8080
```

Requires HTTP (ES modules).
