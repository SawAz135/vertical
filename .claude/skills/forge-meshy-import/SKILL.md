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

## 🪄 AI creation inside the app (free)
- `studio/ai3d.js` + `studio/vendor/gradio-client.js` (official @gradio/client 2.7.2, Apache-2.0, unmodified).
- Text → 3D: `tencent/Hunyuan3D-2` `/generation_all` (caption; returns [white mesh, textured mesh, …]). French prompt translated with `toEnglish()`.
- Fallback / photo → 3D: `black-forest-labs/FLUX.1-schnell` `/infer` then `microsoft/TRELLIS.2` `/start_session` → `/image_to_3d` → `/extract_glb`.
- Result goes through `importGLBBuffer()` (same path as a .glb file): voxel pet + real mesh kept for the Blender HD version; 💾 saves the .glb.
- ZeroGPU quota: anonymous daily quota; a free HF "Read" token (`forge.hfToken` in localStorage) raises it. Meshy's own API needs a paid plan, so it is not used.
- CSP in studio/index.html allows `https://huggingface.co https://*.hf.space`.
