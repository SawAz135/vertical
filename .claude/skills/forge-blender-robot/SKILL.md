---
name: forge-blender-robot
description: Use when running Blender headless for Roblox Forge (renders, HD meshes, map covers) locally or on the Roblox Push GitHub Actions robot.
---

# Blender pipeline (roblox-forge/blender/forge_blender.py, copy in roblox-push/kit/)
Commands (after `--`): `pet <json> <out> [--hd] [--render N] [--samples N]`, `import <job.json> <out> [--hd] [--render N]`, `map <json> <out> [--render W]`.
Run: `blender -b -noaudio -P forge_blender.py -- pet pet.json out --render 1024 --samples 64`.

## Environment facts
- Ubuntu `apt install blender python3-numpy` (glTF exporter needs numpy). blender.org downloads may be blocked.
- Cycles CPU, no OpenImageDenoise in the distro build → `use_denoising = False`.
- Use absolute export paths. Draco "library not found" errors on export are harmless.
- Coordinates: Roblox (x,y,z) → Blender (x,-z,y); Euler XYZ degrees = CFrame.Angles.
- fbx export: `axis_forward='-Z', axis_up='Y', apply_unit_scale=True, bake_space_transform=True`; Roblox MeshPart limit 20 000 tris per mesh.

## Robot (push.py `blender` step)
`stage` counts `ForgeBlender/*.json` in the new pack → `has_blender`; the workflow installs Blender then runs `push.py blender`: renders copied to `.roblox-push/renders/`, fbx uploaded (`upload_model`, assetType Model, `model/fbx`), ids written to `ReplicatedStorage/ForgeHDMeshes.lua`, ForgeBlender removed, pack rewritten (stored copy too). Failures are reported per job, never fatal. Result: `result.blender[]` shown in the app.
