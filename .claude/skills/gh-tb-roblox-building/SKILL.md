---
name: gh-tb-roblox-building
description: "Use when building or editing geometry, maps, props, or generated assets with MCP or standalone Luau."
---

# Roblox Building

## When to Load

Load for geometry, props, maps, and spatial onboarding via MCP or Luau.

## Quick Reference

### MCP Build Mode
1-2. Inspect Studio/Workspace/assets; name root, origin, dimensions, assets.
3-4. Build in phases with readback; verify tree, view, traversal.

### Asset Choice
- Search project assets and Toolbox first; check type, creator, price, scripts, fit.
- Paid/cross-owner insertion: disclose creator, ID, price, rights first. Inspect scripts/dependencies; remove unneeded code. See `roblox-security`.
- MCP: `generate_procedural_model`, `generate_mesh`, `generate_material`.
- Check mesh bounds, collision, PBR, and quality levels.
- Use permitted images; wait for jobs to finish.
- `EditableImage`/`EditableMesh`: permission + memory limits.
- Native Parts/CSG when reuse/generation is unsuitable.
- **Asset privacy:** new accounts/groups create Images/Decals/Meshes Restricted — blank texture/invisible mesh usually means a missing grant, not corruption. Read the Output error; grant the experience in Creator Dashboard. See `roblox-studio-mcp`.

### Player Scale
Player ~5 studs | Door 4w×7h | Ceiling 10-14 | Counter 3.5-4 | Seat 1.5 | Path 6+

### Spatial Rules
- Name dimensions; offset sub-parts from anchor CFrames, never guessed world coordinates.
- Snap to 0.125/0.25/0.5 studs. Build complex CSG near origin, then `PivotTo` the destination.
- Set anchoring, collision, shadows, color, material explicitly.

### Acceptance
**Prop:** named model, pivot, scale, bounds, materials, collision, anchoring, no loose parts, provenance.
**Map:** root/origin, zones, landmarks, spawns/return paths, traversal, bounds excluding Baseplate/Terrain/SpawnLocation.
**Evidence:** readback, view when supported, playtest results.

### Anti-Patterns
Guessing coordinates | unanchored/duplicate parts | hardcoded world positions | silent CSG failure | oversized batches | claims without readback

**Details:** `references/full.md` (maps, validation, assets).


---
Source: https://github.com/TabooHarmony/roblox-brain/tree/HEAD/skills/gameplay/roblox-building (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
