---
name: forge-pet-studio
description: Use when creating, editing or exporting pets with Roblox Forge Pet Studio (roblox-forge/studio): generator, styles (voxel, simulateur, gros blocs, lisse), 100-pet index, sculpt tools, animations, effects, export packs.
---

# Forge Pet Studio
Files: `roblox-forge/studio/` — `app.js` (UI), `pet-gen.js` (text → pet), `voxel.js` (voxel animals + voxelizer), `chibi.js` (simulator style), `meshimport.js` (.glb import), `anim-core.js` (rig + keyframes), `kit/*.lua` (Roblox runtime).

## Pet data
`pet = { name, rarity, c1, c2, fx, parts[], anims[], gen }`; a part = `{ id, name, shape: Block|Ball|Ellipsoid|Cylinder|Wedge, size[3], pos[3], rot[3] (deg, XYZ = CFrame.Angles), color, material, transparency, tint?, parent?, weld? }`.
Roblox axes: Y up, front = -Z. Body is the rig root (`AC.bodyOf`).

## Styles (`PET_STYLES`, `styled(g)`)
- `voxel`: `voxelAnimal(species)` for the 11 VOX species, else `voxelizeParts(parts, 0.13)`.
- `simu`: `chibiPet(g, PG.SPECIES[g.species], petVariant)` + `chibiFx` (normal/gold/rainbow/neon).
- `blocs`: `voxelizeParts(parts, 0.26)`. `lisse`: generator parts as is.
Voxel blocks carry `key/parentKey/weld`; `fromGenerated` maps them to ids, export writes attribute `ForgeWeld`, the controller welds them (WeldConstraint) instead of Motor6D.

## Export
`buildPack(blender?)` → zip: `ReplicatedStorage/ForgePets/<Name>.model.json`, `ForgeConfig.lua`, `ForgeAnimCore.lua`, `ServerScriptService/ForgePetController.server.lua`, `StarterPlayerScripts/ForgePetFX|ForgePetAnim.client.lua`, library files. `blender = {mesh}` adds `ForgeBlender/<n>.json` (+ `.glb` for imports) and `ForgeHD.server.lua`.
Hand-off to Roblox Push: `localStorage['rp2.pendingPack'] = {name,label,rarity,b64,at}`.

## Checks before shipping
- Keep a pet under ~900 parts (voxel pets 300–650, simulator ~20).
- Run `scratchpad/pettest/pt.js` (Playwright iPhone 15) and compile kit Lua with Lune.
