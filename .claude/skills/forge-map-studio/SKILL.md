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

## Scene sentences (map-scene.js)
`parseScene(text)` finds every « [nombre] nom [couleur] [avec des ailes] [géant|petit] »: numbers (3, trois, quelques, beaucoup…), FR colours, wings, size. Nouns: 17 voxel animals (vache, cochon, mouton + Pet Studio species), farm (grange, silo, foin, champ, carottes, citrouilles, enclos, abreuvoir, tracteur, épouvantail), buildings/trees, and every Objets › Ressources prop.
`buildScene()` lays a farm (barn, silo, pen sized for the herd, fields, hay, tractor) when « ferme » or animals are named; animals come from `voxelAnimal` (voxel 0.17, palette from the colour, wings) and graze in the pen; other things form clusters on a ring. Hooked into `generateFromText` (gameplay core + scenery + Farm/Scene model).
Resources: `map-props.js` (37 props, Kenney-style: plank gaps, 3-tone palettes, faceted rocks, overhanging grass caps).

## Dictionary (map-lexicon.js + map-archetypes.js)
`ENTRIES` map French/English words to a model family with settings: voxel animals (`A(species, {palette, flags, size, wings})` — horse = unicorn without horn, zebra = striped, giraffe = spotted deer…), critters (birds, fish, insects, reptiles), vehicles, buildings (one family, many signs), furniture, food, fun/sport/seasons, plants, and existing builder ids. Plurals (s, x, aux, eaux, ies, es) and multi-word names (« bonhomme de neige », « voitures de course ») are generated; accents are ignored; ~2 900 forms. Setting words (ville, île, obby…) are skipped; an unknown counted noun becomes a labelled object. Pet Studio's generator falls back to the same dictionary (`q.lex`), so « zèbre », « pégase », « loup-garou » become voxel pets with the right palette/flags.
