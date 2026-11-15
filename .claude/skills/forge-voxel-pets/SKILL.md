---
name: forge-voxel-pets
description: Use when tuning or extending the voxel pet engine (roblox-forge/studio/voxel.js): adding a species, changing anatomy/proportions, colours, MagicaVoxel-style shading, part count.
---

# Voxel pet engine (voxel.js)
Pipeline: SDF anatomy (`anatomy(sp,k)` → `evalAt(p) = [dist, bone, anchors]`) → `colourAt` → shading pass → greedy merge → `toParts`.

## Add a species
Add to `VOX_SPECIES`: `{ fr, body, legs, neckDrop, snout, ears: pointy|big|round|floppy|leaf|horns, tail: bushy|long|up|stub|tuft|mane|dragon, cols:{back,side,belly,muzzle,dark,nose,eye,socks}, flags }`. Flags: `mask snarl stripes(true|'soft') tailTip mane panda antlers spots horn rainbow wings spikes pawsOnly`.
Also map it in Pet Studio (styled uses `VOX_SPECIES[g.species]`; the key must equal the pet-gen species id).

## Proportions that read well (genre research)
Big head (ellipsoid ~0.6), short compact torso (chest/hip z ±0.62/0.72·B), crouched bent legs, black claws, white muzzle, bushy tail. Exaggerate silhouette before detail.

## Shading (baked colours)
AO bands from open cells in a 5³ neighbourhood (`<0.5 → 0.78`, `<0.7 → 0.9`), lower 28 % ×0.9, sunlit tops ×1.07, 4-voxel patch noise ×0.94, quantised to 0.09. Pure colours (eyes/claws/mouth) are excluded via `FLAT`.
Hidden interior voxels are `WILD`: they match any colour in `greedy`, so shading costs few parts. Never start a box on WILD.

## Budget
Voxel 0.11 studs; target 450–650 parts. Measure with `node blendertest/mkvox.mjs loup,tigre` (prints voxels → parts). Render check: `blender -b -P roblox-forge/blender/forge_blender.py -- pet vox_x.json out --render 360`.
