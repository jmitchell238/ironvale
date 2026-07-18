# Ironvale — Architecture

Clean, layered architecture for a medieval action-platformer (Castlevania-style campaign).

**Version:** 1.4.000 · **Entry:** `js/app/main.js` (ES modules) · **Tests:** `npm test` / `node tests/run.mjs`

---

## 1. Purpose

| | |
|--|--|
| **Pitch** | Knight platformer: run, jump, sword combat through Ironvale. |
| **Product direction** | Discrete **levels** → end boss → clear campaign; persistent RPG stats **between levels**. |
| **Current loop** | Campaign stages (level select → explore encounters → end gate → boss → clear/fail). |
| **Feel targets** | Long sword hitbox, jump attack, ledge-safe enemies (P0). Telegraphed enemy melee (bandit/ogre/boss); slime contact-only. |

---

## 2. Layer diagram

```
┌─────────────────────────────────────────────────────────┐
│  app/main.js          Composition root (DOM, loop)      │
└───────────────────────────┬─────────────────────────────┘
                            │ uses
┌───────────────────────────▼─────────────────────────────┐
│  adapters/            Outside world                      │
│    render.js · input.js · sprites.js · audio.js · save.js│
└───────────────────────────┬─────────────────────────────┘
                            │ drives / reads
┌───────────────────────────▼─────────────────────────────┐
│  world/GameSession.js   Mutable run state (thin facade)  │
│  world/systems/         player · combat · enemy ·        │
│                         camera · level                   │
└───────────────────────────┬─────────────────────────────┘
                            │ calls pure functions
┌───────────────────────────▼─────────────────────────────┐
│  domain/              Game rules (no DOM, no globals)    │
│    combat · enemyAi · platforms · player · upgrades      │
│    levels · rpg       Campaign stages + persistent attrs │
└───────────────────────────┬─────────────────────────────┘
                            │ reads
┌───────────────────────────▼─────────────────────────────┐
│  config/              Numbers only                       │
│  core/math.js         clamp, lerp, hits, canvas resize   │
└─────────────────────────────────────────────────────────┘
```

**Dependency rule:** arrows only point **down**. Domain never imports adapters or app. Config never imports domain.

---

## 3. Directory map

```
js/
  app/
    main.js              Boot, screens, rAF loop, wire session ↔ UI
  adapters/
    render.js            Draw session snapshot (no mutation)
    input.js             Keyboard + virtual stick
    sprites.js           Load / draw sheets
    audio.js             Web Audio beeps
    save.js              localStorage
  world/
    GameSession.js       One class owns the run (thin facade)
    systems/
      player.js          Movement, hurt, invuln
      combat.js          Melee, kills, XP grant
      enemy.js           Spawn, AI tick, contact damage
      camera.js          Follow + clamp
      level.js           Bounds, encounters, gate, boss arena
  domain/
    combat.js            Sword hitbox, swing, resolve hits
    enemyAi.js           Ledge-safe patrol / aggro / integrate
    platforms.js         Jump-safe layout + procgen helpers
    player.js            Factory + body helpers + movement
    upgrades.js          Combat stats factory (blessings retired)
    rpg.js               Persistent XP / attrs / unlock (between levels)
    levels.js            Stage defs: bounds, platforms, encounters, gate, boss
  config/
    index.js             PLAYER_BODY / MOVE / SWORD / DRAW, enemies
  core/
    math.js              Pure utilities
```

Legacy flat files (`js/game.js`, etc.) were **removed**.

---

## 4. Concern isolation (critical)

| Want to change… | Edit | Must not affect |
|-----------------|------|-----------------|
| Sword **length** | `PLAYER_SWORD.attackRange` + `domain/combat.js` | `PLAYER_BODY` feet size |
| Character **collision** | `PLAYER_BODY.w/h` | Sword range |
| Sprite **looks bigger** | `PLAYER_DRAW.drawScale` | Physics / hitboxes |
| Jump feel | `PLAYER_MOVE` + `domain/player.js` | Combat |
| Enemy ledge brain | `ENEMY_AI` + `domain/enemyAi.js` | Sword |
| HUD / VFX | `adapters/render.js` | Domain math |
| Save schema | `adapters/save.js` | Domain |

Tests in `tests/run.mjs` section **“sword ≠ body”** lock the body/sword split.

---

## 5. GameSession (world layer)

Single source of run mutation; systems do the work:

```js
const session = new GameSession({ audio, save });
session.loadLevel('outer-vale'); // or startRun(levelId)
session.update(dt, { x, y, jump, attack });
// session.screen: 'menu' | 'select' | 'play' | 'allocate' | 'clear' | 'over'
// session.levelPhase: 'explore' | 'boss' | 'done'
// session.meta: { xp, level, unspentPoints, stats, levelUnlocked }
```

- Injects **audio** and **save** adapters (testable with no-ops).
- **Systems** under `world/systems/` receive the session and mutate run state.
- Domain modules receive plain objects + config; they do not know about DOM.
- Render reads session fields (or `snapshot()`); it never writes score/HP.
- **Level APIs:** `loadLevel`, `getPlayerBounds` / `getCameraBounds`, `getGateX`, `isGateOpen`, `enterBossArena`, `clearLevel`, `getNextLevel`.
- Public session methods stay stable for app + tests; implementation lives in systems.

---

## 6. Runtime screens

```
menu ──Campaign──► select ──pick unlocked──► play
                                         │
                    death ──► over ──Retry──► play
                                         │
                    XP mid-stage ── banks unspent points (no pause)
                                         │
                    boss down ──► allocate? ──► clear ──Next──► play
                         (if unspent)      └──Menu──► menu
```

---

## 7. Testing

```bash
npm test
# or
node tests/run.mjs
```

Imports real ES modules (no VM string concat):

1. **Pure domain** — combat, AI, config splits (no session)
2. **Session integration** — `GameSession` with mock audio/save
3. **Shell** — HTML module entry, SW cache ↔ `GAME_VERSION`

Not covered: browser pixels, touch hardware, PWA install UI.

---

## 8. How to add features (recipes)

### Longer sword only
1. `js/config/index.js` → `PLAYER_SWORD.attackRange`
2. Run `npm test` — body tests must still pass
3. Optional: tweak slash FX in `adapters/render.js` (presentation)

### New enemy behavior
1. Pure logic in `domain/enemyAi.js` (or new `domain/enemies/bandit.js`)
2. Spawn/tuning in `config` + `GameSession.spawnEnemy`
3. Unit-test AI without canvas

### Campaign level (P1 done shell; P2 fills content; P4 = 10 stages)
1. Edit `domain/levels.js` — platforms, encounters, checkpoints, gate, boss arena
2. `GameSession.loadLevel` seeds state; do **not** put layout in `render.js`
3. Clear/fail/select screens live in `index.html` + `app/main.js`
4. Optional `checkpoints: [{ id, x }]` — death continue via over-screen

### Persistent RPG stats (P3 done)
1. `domain/rpg.js` — XP, bank points, allocate STR/VIT/SPD/AGI/DEX/Reach
2. Save: `xp`, `level`, `unspentPoints`, `stats`, `levelUnlocked`, `ngPlus`, `campaignCleared`
3. Blessing cards retired; allocate only between stages (clear → allocate → next)
4. New Game+ after L10 clear: keep hero RPG, reset stage unlocks, scale enemy HP/dmg

---

## 9. Product roadmap (status)

| Phase | Status | Notes |
|-------|--------|--------|
| **P0 Feel** | Done | Longsword, jump attack, ledge AI |
| **Architecture** | Done (v1.1) | Layers + ES modules + GameSession |
| **P1 Level shell** | Done (v1.2) | Finite stages, gate, boss arena, clear/fail, select |
| **P2 L1 Outer Vale** | Done (v1.2.100) | Teaching layout, slimes + light bandits, bandit captain |
| **P2 L2 Ruined Road** | Done (v1.2.200) | Tighter platforms, skeletons, skeleton champion |
| **P2 L3 Iron Gate** | Done (v1.2.300) | Ogres + war-chief telegraphed slams, campaign clear |
| **P3 RPG** | Done (v1.3.000) | Persistent XP + attrs between levels only |
| **Polish melee telegraphs** | Done (v1.3.100) | Bandit/skeleton/ogre/boss windups; slime contact-only |
| **P1b systems extract** | Done (v1.3.200) | `world/systems/*` — thin GameSession facade |
| **P4 Scale + polish** | Done (v1.4.000) | 10 stages, checkpoints, hitstop juice, New Game+ |

---

## 10. Local play

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

ES modules require HTTP (not `file://`).

---

## 11. Versioning

Bump `GAME_VERSION` in `js/config/index.js` **and** `CACHE` name in `sw.js` together. Tests enforce the match.
