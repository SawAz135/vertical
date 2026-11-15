# New UVs, remeshing and texture transfer

Use this workflow when a render mesh needs a different texture atlas, its original image has an unfamiliar layout/name, or an independently authored low mesh must inherit the high mesh's appearance. Re-UV changes surface-to-image coordinates; retopology changes topology; voxel remesh rebuilds a surface; decimation reduces geometry. Choose the operation that addresses the actual problem. Repacking UVs usually needs no remesh.

Keep the original project, original shader, old UVs and all source images. Transfer on a separate target and save a new project. Use permitted inputs; changing topology or UVs does not change ownership.

## Inspect before interpreting the texture

An atlas can look like unrelated fragments when viewed as an image. Judge it on the mesh. Identify the active material output, connected shader, Base Color/Alpha/Roughness/Metallic/Normal inputs, Image Texture vector inputs, named UV Maps, image color spaces and packed/external files. A filename or image resemblance is insufficient evidence of its role. Inspect texture alpha as well as RGB; invisible RGB, disconnected nodes and unused materials can explain confusing atlas content.

```bash
python scripts/rebake.py inspect --input source.blend --source HatMesh --report material-inspection.json
```

The helper records connected nodes, actual input links, image dimensions/color space, decoded pixel hashes and source file hashes. It accepts a direct Principled surface shader with ordinary connected image/procedural nodes. It refuses missing images, undefined named UVs, movie/UDIM/sequence textures, nested shader groups, mixed surface shaders and material displacement. Inspect those graphs manually in Blender, then prepare a deliberate, equivalent working shader. This limit prevents silently baking the wrong appearance.

For Blender MCP, first inspect the available tool schema and active scene through [Blender MCP](blender-mcp.md). Execute the same inspection and transfer using that integration's authorized Python execution tools or the CLI helper; no particular MCP server is required. Return the saved project/images and actual reports in both Claude and Codex. A successful tool call is not a rendered comparison.

## Re-UV the same geometry

Duplicate the render mesh, give the duplicate a new UV layer and arrange a non-overlapping atlas. Keep the source old UV active for rendering. Preserve named UV mappings used by source nodes. Do not move either object's geometry while projecting. On the target, use the new UV for baking and for the resulting material. A UV edit must not be applied to Roblox inner/outer cages.

The portable helper can duplicate the mesh and perform Smart UV Project:

```bash
python scripts/rebake.py rebake --input source.blend --source HatMesh --uv smart --ray-distance 0.02 --maps base-color alpha roughness metallic normal --size 1024 --map-size normal=256 --map-size roughness=256 --map-size metallic=256 --margin 8 --output ./rebaked-hat
```

`0.02` is an example in Blender units, not a universal preset. Set projection distance from the actual source/target separation and object scale. Resolution and padding also need the selected Roblox category/map's limits. Smart projection is a starting atlas; inspect distortion, texel density, seams and island spacing. Its angle cuts suit many hard-surface meshes; sculpted or deforming assets often need deliberately authored seams. [Blender UV operators](https://docs.blender.org/manual/en/4.5/modeling/meshes/editing/uv.html).

For an existing manually UVed target:

```bash
python scripts/rebake.py rebake --input working.blend --source HighMesh --source-uv OldUV --target LowMesh --target-uv NewUV --ray-distance 0.04 --maps base-color alpha roughness metallic normal --size 1024 --map-size normal=256 --map-size roughness=256 --map-size metallic=256 --output ./transferred
```

Each destination directory must be new. The input file is hash-checked before and after. The result contains `result.blend`, individual PNG maps, `coverage.png` and `report.json`; source and destination objects remain separate in the packed output project. The preserved source is hidden in the result so a later visible-object export selects the target. Source files are never saved by the worker.

## Project high to low deliberately

Selected-to-active baking evaluates the source surface at rays projected from the target. Inspect both geometry and normals, especially folds, inside surfaces and thin parts. A large distance can hit a different nearby surface; a small distance can miss details. Use a separate manually authored **bake cage** when ray projection needs more control. It must match the target's ordered topology. This cage is a baking aid, distinct from a Roblox wrapping cage. [Blender bake projection](https://docs.blender.org/manual/en/4.5/render/cycles/baking.html#selected-to-active).

```bash
python scripts/rebake.py rebake --input working.blend --source HighMesh --target LowMesh --target-uv NewUV --cage LowBakeCage --ray-distance 0.04 --cage-extrusion 0 --output ./cage-transfer
```

The helper rejects empty UV triangles, out-of-range UVs, sampled overlaps and failed interior projection probes. Its UV overlap raster and coverage probes are finite checks; tiny intersections or a few bad texels can remain. Inspect the full atlas and on-mesh result before accepting it.

## Transfer maps without baking lighting into color

Base Color uses a Cycles **Diffuse / Color-only** pass, with direct/indirect illumination excluded. Temporary copies of source materials set Metallic/Alpha/Transmission/Subsurface weights to values that allow this color pass; original materials are restored in the result. Alpha, Roughness and Metallic are explicitly projected through a unit-strength emission pass into Non-Color images. These are material data, not lit color. The helper connects the resulting maps to the new Principled material. [Bake pass definitions](https://docs.blender.org/manual/en/4.5/render/cycles/baking.html).

Alpha is checked and written as a separate mask and into the Base Color PNG. In `--alpha-policy preserve` (the default), padding outside the projected coverage remains transparent. The resulting material consumes the Base Color image's own Alpha output; an unused embedded alpha combined with a separate shader mask can change Blender's color interpretation. Bake dilation supplies RGB beside islands to reduce filtering seams. Inspect transparent edges, especially where neighboring islands could collide.

Select alpha policy from the asset category. Rigid accessory ColorMap and NormalMap must be opaque over **all** pixels, including unused atlas regions. Use `--alpha-policy opaque`: the helper first checks source material alpha over projected coverage and refuses real transparency, then sets output alpha to 1 throughout the atlas. It never silently erases a transparent design. Alpha-preserving output remains appropriate only where the category supports it. [Rigid accessory texture requirements](https://create.roblox.com/docs/avatar/rigid-accessories/specifications#texture-requirements).

`--size` supplies the default image resolution; repeat `--map-size MAP=N` for individual overrides. Alpha and Base Color must match. For a rigid workflow, use ColorMap up to 1024 and NormalMap/MetalnessMap/RoughnessMap up to 256 according to the applicable current validation/specification pages; do not assume every map accepts the ColorMap's resolution. The helper's general 4096 ceiling is a runtime limit, not Roblox approval. [UGC validation system](https://create.roblox.com/docs/marketplace/validation-system), [texture specifications](https://create.roblox.com/docs/art/modeling/texture-specifications).

Normal uses the tangent-space normal bake with +X/+Y/+Z channels. The result's tangent basis belongs to the **new** UV, so copying old tangent-normal pixels into a new atlas without rebaking is insufficient. Normal orientation, shader interpretation and Studio's imported result need their own check. A grayscale height image is not automatically a normal image. [Principled material inputs](https://docs.blender.org/manual/en/4.5/render/shader_nodes/shader/principled.html).

Only maps listed in `--maps` are transferred. Combined light/shadow, emission, coat, sheen, transmission, displacement, unusual shader blending and category-specific material appearance are not implicitly preserved. When a source uses those effects, document how it is converted into the Roblox-supported material and visually validate that choice.

## Optional geometry changes

Author a separate low target when topology must support deformation. Preserve silhouettes, face/eyelid loops, caps and rig/FACS responsibilities. Transfer textures after retopology/UV, then deliberately transfer/rebuild weights and cages and verify actual poses. Reducing triangle count alone is not sufficient retopology. [Blender retopology](https://docs.blender.org/manual/en/4.0/modeling/meshes/retopology.html).

For a **static**, unbound render mesh, the helper offers duplicate-only decimation or voxel remesh, followed by a new UV and texture transfer:

```bash
python scripts/rebake.py rebake --input sculpt.blend --source StaticMesh --remesh decimate --ratio 0.5 --uv smart --ray-distance 0.08 --cage-extrusion 0.04 --output ./reduced
python scripts/rebake.py rebake --input sculpt.blend --source StaticMesh --remesh voxel --voxel-size 0.04 --uv smart --ray-distance 0.08 --cage-extrusion 0.04 --output ./voxel-copy
```

All distances and ratios are explicit design choices, not Roblox defaults. Positive cage extrusion enables an automatically inflated bake cage; check that it surrounds the intended source rather than a nearby surface. Automatic topology editing refuses existing modifiers, shape keys, vertex groups, parenting, constraints and animation data. It never operates on supplied low targets or Roblox cage/attachment names. Voxel remesh can remove thin details, create a degenerate UV projection, change silhouette or produce too many triangles; adjust the resolution/author UV and inspect the result instead of suppressing a failed report. [Remesh modifier](https://docs.blender.org/manual/en/4.5/modeling/modifiers/generate/remesh.html).

## Verify appearance and diagnose Roblox errors

Render the old and new meshes with identical camera/light/color management, then inspect sides, seams, alpha edges, close-ups and mipmaps. For a re-UVed mesh, compare the same surface points against the old material; comparing identical atlas pixel coordinates is wrong because the layout intentionally changed. A checker/gradient fixture in `tests/test_rebake.py` tests known surface colors and scalar maps after a rotated/inset target UV. This proves the transfer path on that original fixture, not every user's material.

Reports distinguish successful map generation and measured projection from `appearance-comparison` and `roblox-acceptance`, which remain `NOT_CHECKED` until actual evidence exists. Run [asset preflight](authoring.md), Studio validation, avatar fit and moderation separately.

If Roblox unexpectedly interprets a texture fragment as a face, preserve the exact displayed error and determine which stage produced it. A Marketplace moderation/classifier result is different from a dynamic-head landmark/FACS technical validation failure. Use [UGC validation system](https://create.roblox.com/docs/marketplace/validation-system) and [head validation](https://create.roblox.com/docs/avatar/dynamic-heads/validate) for the applicable process. Diagnose actual connected maps, unused atlas content, alpha/padding, texture encoding and upload category. A clean new atlas with correctly rebaked appearance can resolve a genuine atlas/material defect; it does not guarantee a classifier outcome. For a false moderation result, use the offered review/appeal process rather than claim the asset is approved.
