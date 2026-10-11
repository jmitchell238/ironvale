# Ironvale

Small knight. A greater tomorrow.

A 2D pixel-art action platformer. You play an apprentice knight who runs, jumps, climbs and cuts through skeletons, ghosts and wolves, with a boss waiting at the end of every stage and the Iron Warden last of all. Between stages you train at the forge to get stronger.

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

Each stage is a side-scrolling level with cliffs, ladders, bridges and floating islands. Enemies appear as you go; skeletons climb out of the ground. The gate at the end stays shut until every enemy in the stage is beaten. Past it is a walled boss arena: the gate closes behind you, the screen stops scrolling, and the stage is cleared when the boss falls. Walking past a flag sets a checkpoint, and if you die you can continue from it or retry the stage. Dying in a boss arena continues from the flag just before the gate; the boss comes back at full health when you walk in again. Falling into the sea costs a heart and puts you back on the last solid ground.

- The sword chains: keep pressing and the third hit of a chain does extra damage. A hit stops an enemy's wind-up.
- Skeletons wind up before they swing, so you can see attacks coming.
- Bone Guards block hits from the front. Bait their swing or get behind them.
- Ghosts float through walls and hurt you if they touch you. Wolves are fast and fragile.
- Spiders in the swamp are small and low; duck or jump and swing to catch them.
- Bog Things are slow and tough, with a long wind-up before each swipe.
- Burning Ghouls in the town and church hit harder than skeletons. Hit them during the wind-up to stop the swing.
- Hell Hounds (stages 3 and 4) crouch, then leap at you. Jump over the leap or step back, then hit them as they land.
- Wizards (stage 4, and once in stage 3's church) stand back and throw a fireball after a glowing wind-up. Duck or jump it, cut it with your sword, or rush in and hit the wizard to break the spell.
- Fire Skulls (stage 4) hover over you, burst into flame and dive in a straight line at where you were standing. Step aside, then hit them as they drift back up.
- Hearts hidden around the stage heal you.
- The Nightmare (stage 1) is a spectral horse. It rears and stamps, red arrows show its lane, then it gallops the whole length of the arena. It is low, so jump over it (or double jump), then hit it while it skids to a stop at the wall. It gets faster when it is hurt.
- The Hell Beast (stage 2) rises out of the bog and spits fireballs; hurt, it lobs three at a time in an arc. If you stand next to it, it ignites and a pillar of fire stands where it was, so back away when it glows. After a few attacks it sinks and comes up on the far side. You can cut a fireball with your sword.
- The Fallen Angel (stage 3) hovers out of reach, spreads her wings, then dives at where you were standing. Step aside and hit her while she rests on the floor. When she is hurt she also throws a fan of light bolts.
- The Iron Warden, at the end of the last stage, has a telegraphed ground slam.
- Every boss warns before each attack, and a hit does not interrupt it. Its health bar and name float over it.

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

1. Forgegate Fields, with the Nightmare
2. Forest Ramparts, with the Hell Beast
3. Forge Ruins, with the Fallen Angel
4. Iron Caverns, with the Iron Warden

The campaign goes from bright to dark: sunny sea cliffs, then swamp and forest, a gothic town and church, and finally a dark castle. All four stages are built, each with its own art and its own boss arena. Iron Caverns is the darkest: castle halls, shafts to climb and drawbridges, ending in the Iron Warden's throne room. See [docs/ROADMAP.md](docs/ROADMAP.md) for what's next.

## Credits

Pixel art by Luis Zuno ([@ansimuz](https://www.patreon.com/ansimuz)): Magic Cliffs Environment (CC-BY 3.0) and the Gothicvania packs, including Swamp (public domain). Details are in [assets/CREDITS.md](assets/CREDITS.md).

## License

© 2026 James Mitchell / 238 Apps. All rights reserved. You're welcome to play it at https://jmitchell238.github.io/ironvale/, but the code, art and other content may not be copied, reused, republished or sold without permission. Third-party material keeps its own license. See [LICENSE](LICENSE), the [Terms of Use](https://jmitchell238.github.io/arcade-hub/terms.html) and the [Privacy Policy](https://jmitchell238.github.io/arcade-hub/privacy.html).

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for running it locally, tests, versioning and common changes, and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organized.
