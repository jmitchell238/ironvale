# Roadmap

The campaign goes from bright to dark, one look per stage:

1. **Forgegate Fields**: sunny sea cliffs (Magic Cliffs). Done.
2. **Forest Ramparts**: swamp and forest (Gothicvania Swamp).
3. **Forge Ruins**: gothic town and church (Gothicvania Town and Church).
4. **Iron Caverns**: a dark castle and the Iron Warden (Gothicvania castle tiles, demon sprite for the boss).

## Unfinished

- **Stages 2 and 3** use `stubBiome()`, a shared placeholder layout with one skeleton and one ghost. They need tile-map layouts, encounters and their own tilesets.
- **Stage 4** has its own encounters and the Iron Warden, but still sits on the placeholder layout, and the Warden has no sprite yet.
- **Tile renderer** only knows the Magic Cliffs tileset. It needs a per-stage tile table.

## Not started

- Bosses for stages 1–3
- Moving platforms and hazards (spikes, falling rocks)
