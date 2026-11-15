---
name: roblox-blender-coordinates
description: Use when converting positions/rotations between Roblox, Blender, glTF and three.js.
---

# Coordinate systems
- Roblox: Y up, -Z forward, studs; `CFrame.Angles(rx, ry, rz)` = XYZ Euler in radians.
- three.js: Y up, same handedness as Roblox → positions copy directly; Euler order 'XYZ'.
- Blender: Z up. Roblox (x, y, z) → Blender (x, -z, y), so a Roblox pet facing -Z faces +Y in Blender.
- glTF: Y up, +Z forward; Blender importer maps glTF +Z to Blender -Y. To match Roblox pets (front -Z) negate x and z (rotate 180° around up).
- fbx for Roblox: export `axis_forward='-Z', axis_up='Y'`.
