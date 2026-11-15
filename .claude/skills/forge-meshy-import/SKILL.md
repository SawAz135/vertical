---
name: forge-meshy-import
description: Use when a user wants to bring an outside 3D model (Meshy free plan, Sketchfab, Blender .glb) into a Roblox pet: voxel conversion in the browser or HD mesh via the robot.
---

# 3D model import (.glb)
Meshy API is paid (Pro plan): stay $0 by having the user generate on meshy.ai (free plan ≈ 10 models/month, CC BY non-commercial licence) and download **.glb**. Draco and Meshopt .glb are decoded in the browser (vendored DRACOLoader + meshopt decoder; CSP needs 'wasm-unsafe-eval' and worker-src blob:). For the robot, `plainGLB()` re-exports compressed files as a plain .glb with GLTFExporter, because Ubuntu's Blender has no Draco library.

## Browser: `meshimport.js` `voxelizeGLB(buffer, {height:3.4, res:40, colors:14, smooth:1})`
1. Area-weighted triangle sampling; colour = texture (canvas, respects `tex.flipY`) × material colour, else vertex colour, else material colour.
2. 6-connected flood fill from the border → unreached empty cells are interior → `WILD`.
3. k-means palette (luma-weighted), majority filter passes, greedy merge.
4. glTF faces +Z; Roblox pets face -Z → x,z negated.
Pet Studio retries lower res/colours until ≤ 900 parts. CSP needs `connect-src blob:` and `img-src blob:` for embedded textures.

## HD in game (robot)
Export → ✨ Version HD: pack gets `ForgeBlender/<n>.glb` + job `{kind:'import', file, mesh:true}`; Blender `cmd_import` joins meshes, turns 180° (Blender -Y → +Y front), scales to 3.4 studs, decimates < 19 000 tris, exports fbx with embedded textures; the robot uploads it as a Model asset; `ForgeHD.server.lua` loads it with InsertService and fits it on the pet's bounding box.
