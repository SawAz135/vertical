---
name: gh-sh-gltf-assets
description: "Inspect a GLB/glTF, break down why a model is large, report what makes up its size, analyze textures, geometry, draw calls, nodes, materials, animations, bounds, or validate, optimize, compress, resize textures in, convert, or troubleshoot glTF assets. Use for glTF-Transform CLI, GLTFLoader compatibility, Meshopt, Draco, KTX2, or safe Three.js asset-processing work. Skip generic Three.js scene code without asset-file work."
---

# glTF Assets

Inspect first, preserve source files, then make one explicit reversible transform.

## Workflow

1. Locate the source model and its consumer. Identify GLB versus `.gltf` with external resources; inspect the loading path for `MeshoptDecoder`, `DRACOLoader`, `KTX2Loader`, animations, skins, names, and scene hierarchy that the application relies on. Confirm that the file being inspected is the file loaded at runtime; repositories often retain larger source/reference GLBs beside an optimized runtime asset. Done when input and compatibility constraints are known.

2. Report before changing. Run:
   ```powershell
   node "$env:USERPROFILE\.pi\agent\skills\gltf-assets\scripts\gltf-report.mjs" <model.glb>
   node "$env:USERPROFILE\.pi\agent\skills\gltf-assets\scripts\gltf-report.mjs" <model.glb> --json
   npx --yes @gltf-transform/cli inspect <model.glb>
   ```
   `gltf-report` reads GLB and JSON glTF without dependencies. It reports file size, the bytes held by embedded images and accessor data, geometry bytes by attribute, and the ten largest embedded images. Its JSON output supports further sorting or comparison. `inspect` supplies image dimensions, GPU memory estimates, material slots, and extension detail. For large reports, capture `inspect` to a file and extract its `TEXTURES` section instead of flooding the terminal. Its geometry total counts submitted primitive vertices, not unique GPU vertices. Done when file size, byte breakdown, largest textures, dimensions, draw calls, triangles, materials, extensions, animation/skin use, and named-node count are recorded.

3. Interpret the breakdown before selecting a transform.
   - Embedded image bytes dominate: resize/re-encode the specific largest images first. 4K PNG normal and metallic-roughness maps are common high-impact targets.
   - Accessor bytes dominate: inspect `POSITION`, `NORMAL`, `TANGENT`, `TEXCOORD_0`, and index totals. Use validation to identify unused tangents or attributes before removing them; use meshopt before geometry simplification.
   - Primitive/node count dominates rendering but not necessarily download size: inspect repeated CAD/Revit parts and alternate variants. Removing them requires confirming product and hierarchy needs.
   - GPU texture size can far exceed download bytes: base decisions on both embedded bytes and `inspect` GPU estimates.
   Done when the likely size driver and lowest-risk reduction are explicit.

4. Select the smallest safe operation.
   - Need only file-size reduction with runtime Meshopt support: use `meshopt`.
   - Need broad web optimization: use `optimize`; it may change texture encoding, mesh layout, materials, and hierarchy. Inspect and regression-test after.
   - Need a targeted correction: use one CLI command such as `resize`, `weld`, `dedup`, `prune`, `simplify`, `draco`, or `ktxfix`, with explicit input/output paths.
   - Preserve source model. Write to a new sibling or staged-output filename. Never overwrite deployed assets without a backup and an explicit request.
   Done when profile and expected runtime decoder requirements are explicit.

5. Run a non-overwriting profile:
   ```powershell
   node "$env:USERPROFILE\.pi\agent\skills\gltf-assets\scripts\gltf-optimize.mjs" <input.glb> <output.glb> --profile meshopt
   node "$env:USERPROFILE\.pi\agent\skills\gltf-assets\scripts\gltf-optimize.mjs" <input.glb> <output.glb> --profile web --texture-size 1024
   ```
   The wrapper refuses existing outputs and invokes `npx @gltf-transform/cli`; first use may download the CLI. `meshopt` requires `MeshoptDecoder` in Three.js. Draco and KTX2 similarly require their matching loaders/transcoder. Done when the command exits successfully into a new file.

6. Compare output against input. Run both reports, inspect the output with glTF-Transform, then load it in the actual application. Check bounds/scale, named nodes, materials, texture mapping, animation, skins, shadows, and decoder support. Done when size reduction is measured and consumer-specific behavior passes.

## Commands

```powershell
# Validate structure and inspect deeply.
npx --yes @gltf-transform/cli validate model.glb
npx --yes @gltf-transform/cli inspect model.glb

# Write every transform to a new file.
npx --yes @gltf-transform/cli resize source.glb resized.glb --width 1024 --height 1024
npx --yes @gltf-transform/cli weld source.glb welded.glb
npx --yes @gltf-transform/cli simplify source.glb simplified.glb --ratio 0.75 --error 0.001
npx --yes @gltf-transform/cli meshopt source.glb compressed.glb --level medium
npx --yes @gltf-transform/cli optimize source.glb optimized.glb --texture-size 1024
```

## Rules

- Treat `optimize`, `dedup`, `join`, `palette`, `instance`, `flatten`, `simplify`, `draco`, and texture conversion as compatibility-affecting transforms.
- Do not blindly copy the old batch optimizers in `arc-three`, `three sandbox`, or `threejs_workspace`; inspect each source asset and its runtime loader first.
- Do not use a file-size result as proof of visual or functional correctness.
- For `.gltf`, keep referenced `.bin` files and external textures beside the JSON, and preserve relative paths during copies/conversion.


---
Source: https://github.com/stevehalliwell/agent-skills/blob/HEAD/skills/gltf-assets/SKILL.md (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
