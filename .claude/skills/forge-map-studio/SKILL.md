---
name: forge-map-studio
description: Use when generating or editing Roblox maps with Forge Map Studio (roblox-forge/map): generators, themes, text-to-map, scenery models, gameplay roles, play test, export.
---

# Forge Map Studio
Files: `map-core.js` (9 generators, themes, LIGHTS, lightingOf, export), `map-models.js` (pine, oak/cherry, cactus, rocks, crystals, flowers, house, lampPost, castle, temple, windmill, statue, bridge, volcano, pyramid, mountains, waterfall, fence, cloud; `scenery()`; `parseMap/generateFromText`), `kit/ForgeMap.server.lua`, `ForgeMap.client.lua`.

## Gameplay roles (attributes on parts)
14 roles incl. spawn, coin, jump pad, kill brick, checkpoint, gate, conveyor, dropper/tycoon. Play mode uses fixed 1/60 sub-steps; role lists are cached at start.

## Tuning
Fog density `(0.00025 + Density·0.0016 + Haze·0.00012) × (play ? 1 : 0.45)`; bloom threshold ≥ 0.9 (lower = white screen). Mountains are wedge pyramids with snow caps, not cubes.
Text → map: "île avec village et château" → island base, 5 houses, monuments; monuments only → lobby.
Export builds in Rojo (422–1 127 parts typical). Tests: `scratchpad/maptest/mt.js`.
