---
name: roblox-voxel-art-style
description: Use when making voxel / low-poly blocky art for Roblox (pets, props, maps): proportions, palettes, shading, part budgets.
---

# Voxel art rules
- Silhouette first: exaggerate (big head, chunky body, short legs); readable at small size.
- Palette per material: 3 tones (shadow / base / light) per colour; dark accents for eyes, claws, nose; white highlight voxel in eyes.
- Bake light into colours: darker creases (AO), slightly darker bottom, lighter tops, small patch noise for fur/stone; avoid smooth gradients that create banding.
- Roblox: each block = Part; merge same-colour runs (greedy meshing); hide interior; weld blocks to one bone part per limb.
- Budget: 300–650 parts per pet, decor props 20–150.
