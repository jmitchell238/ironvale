# Ironvale

Small knight. A greater tomorrow.

A 2D pixel-art action platformer. You play an apprentice knight who runs, jumps, climbs and cuts through skeletons, ghosts and wolves on the way to the Iron Warden. Between stages you train at the forge to get stronger.

Play at https://jmitchell238.github.io/ironvale/

You can install it as an app from the browser (Add to Home Screen on iPhone and iPad). It plays upright or sideways: held upright, the whole stage height shows with the touch controls underneath.

## Controls

| Action | Keyboard | Touch |
|--------|----------|-------|
| Run | A D / ← → | Left stick |
| Climb a ladder | W S / ↑ ↓ | Stick up or down |
| Jump (press again in the air to double jump) | Space / W / ↑ | JUMP |
| Duck | S / ↓ | Stick down |
| Sword (keep pressing to chain hits) | J / K / F / Shift | ATK |
| Pick a stat at the forge | 1–6 | Tap |
| Menu | Esc | ☰ |

## How it plays

Each stage is a side-scrolling level with cliffs, ladders, bridges and floating islands. Enemies appear as you go; skeletons climb out of the ground. The gate at the end stays shut until every enemy in the stage is beaten. Walking past a flag sets a checkpoint, and if you die you can continue from it or retry the stage. Falling into the sea costs a heart and puts you back on the last solid ground.

- The sword chains: keep pressing and the third hit of a chain does extra damage. A hit stops an enemy's wind-up.
- Skeletons wind up before they swing, so you can see attacks coming.
- Bone Guards block hits from the front. Bait their swing or get behind them.
- Ghosts float through walls and hurt you if they touch you. Wolves are fast and fragile.
- Hearts hidden around the stage heal you.
- The Iron Warden, at the end of the last stage, has a telegraphed ground slam.

## Getting stronger

Defeating enemies earns XP. Each level up gives you a point to spend at the forge, between stages:

| Stat | Effect |
|------|--------|
| STR | Sword damage |
| VIT | Max HP |
| SPD | Run speed |
| AGI | Jump height |
| DEX | Attack speed |
| REACH | Sword range |

Your stats carry over from stage to stage and are saved on the device.

After you beat the Iron Warden, New Game+ appears on the menu. It keeps your knight's stats, locks the stages again, and makes enemies tougher each cycle (+35% HP and +15% damage per cycle).

## Stages

1. Forgegate Fields
2. Forest Ramparts
3. Forge Ruins
4. Iron Caverns, with the Iron Warden

The campaign goes from bright to dark: sunny sea cliffs, then swamp and forest, a gothic town and church, and finally a dark castle. Forgegate Fields is finished. The other three still use a placeholder layout; see [docs/ROADMAP.md](docs/ROADMAP.md).

## Credits

Pixel art by Luis Zuno ([@ansimuz](https://www.patreon.com/ansimuz)): Magic Cliffs Environment (CC-BY 3.0) and the Gothicvania packs (public domain). Details are in [assets/CREDITS.md](assets/CREDITS.md).

## License

© 2026 James Mitchell / 238 Apps. All rights reserved. You're welcome to play it at https://jmitchell238.github.io/ironvale/, but the code, art and other content may not be copied, reused, republished or sold without permission. Third-party material keeps its own license. See [LICENSE](LICENSE), the [Terms of Use](https://jmitchell238.github.io/arcade-hub/terms.html) and the [Privacy Policy](https://jmitchell238.github.io/arcade-hub/privacy.html).

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for running it locally, tests, versioning and common changes, and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organized.
