# Architecture

Ironvale is plain ES modules with no build step. `index.html` loads `js/app/main.js`, which imports everything else. The game draws to a 960×540 canvas that's letterboxed to fit the screen.

## Layers

```
app/main.js        DOM, screens, the animation loop
   ↓
adapters/          Rendering, input, sprites, audio, saving
   ↓
world/             GameSession and its systems: the state of the current run
   ↓
domain/            Game rules as pure functions: no DOM, no globals
   ↓
config/, core/     Tuning numbers and math helpers
```

Each layer only imports from the layers below it. `domain/` never imports from `world/`, `adapters/` or `app/`, which is what lets the tests run the rules in Node without a browser.

## Files

| Path | Contents |
|------|----------|
| `js/app/main.js` | Startup, menu and screen switching, the frame loop, wiring buttons to the session |
| `js/adapters/render.js` | Draws the current session. Reads game state but never changes it. |
| `js/adapters/input.js` | Keyboard, the touch stick, and the JUMP and ATK buttons |
| `js/adapters/sprites.js` | Loading and drawing sprite sheets |
| `js/adapters/audio.js` | Web Audio sound effects |
| `js/adapters/save.js` | Reading and writing progress in localStorage |
| `js/world/GameSession.js` | The `GameSession` class, which owns everything about the current run |
| `js/world/systems/player.js` | Player movement, getting hurt, invulnerability frames |
| `js/world/systems/combat.js` | Sword hits, kills, granting XP |
| `js/world/systems/enemy.js` | Spawning enemies, running their AI, contact damage |
| `js/world/systems/camera.js` | Camera follow and limits |
| `js/world/systems/level.js` | Stage bounds, triggering fights, checkpoints, the gate, the boss arena |
| `js/domain/levels.js` | Stage definitions: platforms, ladders, fights, checkpoints, gate, boss |
| `js/domain/player.js` | Player creation and movement physics |
| `js/domain/combat.js` | Sword hitbox, swing timing, resolving hits, shield blocking |
| `js/domain/enemyAi.js` | Patrolling without walking off ledges, chasing, attacking |
| `js/domain/platforms.js` | Platform layout helpers, including checking that jumps are possible |
| `js/domain/rpg.js` | XP, levels, stats, stage unlocks, New Game+ |
| `js/domain/upgrades.js` | Turns stats into combat numbers |
| `js/config/index.js` | `GAME_VERSION` and all tuning: player body, movement, sword, drawing, enemies, NG+ scaling |
| `js/core/math.js` | `clamp`, `lerp`, hit tests, canvas resizing |
| `sw.js`, `manifest.webmanifest` | Offline cache and PWA install |
| `tests/run.mjs` | Tests |

## GameSession

`GameSession` is the only thing that changes run state. The app creates one, passing in the audio and save adapters (the tests pass stand-ins), and calls `update()` once per frame:

```js
const session = new GameSession({ audio, save });
session.loadLevel('forgegate-fields');
session.update(dt, { x, y, jump, attack });
```

The work is done by the modules in `world/systems/`, which receive the session. They call into `domain/` for the actual rules.

Useful fields:

- `session.screen`: `menu`, `select`, `play`, `levelup`, `allocate`, `clear` or `over`
- `session.levelPhase`: `explore`, `boss` or `done`
- `session.meta`: saved progress (`xp`, `level`, `unspentPoints`, `stats`, `levelUnlocked`, `ngPlus`, `campaignCleared`)

## Screens

```
menu → select → play ──(die)──→ over → continue from checkpoint, or retry
                  │
                  └──(clear stage)──→ allocate (if you have points) → clear → next stage or menu
```

Leveling up during a stage only banks a point. Points are spent on the `allocate` screen between stages.

## Stages

Stages are plain objects in `js/domain/levels.js`. Each has bounds, a spawn point, platforms, ladders, encounters, checkpoints, a gate, and optionally a boss. An encounter is a trigger X position plus a list of enemies to spawn when the player passes it. The gate opens once every encounter has fired and no enemies are left. On a stage with a boss, the boss spawns in an arena past the gate.

## Body, sword and drawing are separate

These are tuned independently, and the "sword ≠ body" tests in `tests/run.mjs` make sure they stay that way:

| To change | Edit | Doesn't affect |
|-----------|------|----------------|
| Sword length | `PLAYER_SWORD.attackRange` | Collision box |
| Collision box | `PLAYER_BODY.w` / `h` | Sword range |
| How big the knight looks | `PLAYER_DRAW.drawScale` | Physics or hitboxes |
| Jump feel | `PLAYER_MOVE` and `domain/player.js` | Combat |
| Enemy ledge behavior | `ENEMY_AI` and `domain/enemyAi.js` | The sword |
