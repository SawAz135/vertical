---
name: roblox-meshparts-import
description: Use when bringing 3D models into Roblox as MeshParts: .fbx/.obj limits, Open Cloud Model upload, InsertService loading, scaling and alignment.
---

# MeshParts from outside
- Limits: 20 000 triangles per mesh; textures 1024² recommended; .fbx/.obj via the 3D Importer or Open Cloud Assets API (`assetType: "Model"`, content type `model/fbx`).
- Loading at runtime: `InsertService:LoadAsset(id)` works for assets owned by the game's creator (user or group) — wrap in pcall.
- Fit a loaded model on an existing one: compare `GetBoundingBox()` sizes, `Model:ScaleTo(GetScale()*k)`, then translate by the centre difference with `PivotTo`.
- Orientation: export Y-up, forward -Z from Blender (`axis_forward='-Z', axis_up='Y'`).
- Collisions: set `CollisionFidelity = Box/Hull` for decorative meshes; `CanCollide=false` on pets.
- Many small parts vs one mesh: one mesh is cheaper to render but can't bend; keep rigged parts when limbs must animate.
