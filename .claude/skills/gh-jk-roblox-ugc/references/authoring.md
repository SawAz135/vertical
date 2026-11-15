# Authoring and tools

## Deliver a usable project

Agree on the asset kind and visible design. Use original geometry/art or inputs with demonstrated permission. Typical output is an editable source project, used textures, separate FBX/GLB or classic-clothing image, several useful previews, and a report identifying every tested stage. Match the user's requested scope; a simple item need not become a complete character.

Model against a relevant Roblox mannequin. Establish the scale/body type before final geometry. Plan triangle allocation around silhouette and deformation; do not spend most of the budget on invisible details. For sculpted content, retopologize before UV/baking/rigging. Maintain clean normals and seams, remove degenerates, and use watertight render geometry where required. Caps are part of body limb geometry.

Use the complete [modeling](https://create.roblox.com/docs/art/modeling), [texture](https://create.roblox.com/docs/art/modeling/texture-specifications), [Blender](https://create.roblox.com/docs/art/blender) and category-specific Maya export sections in the corpus. Modeling, UV, baking, cages and skinning are separate operations; a generic generated mesh rarely contains all required avatar components.

## Scale, coordinates and export

Blender and Studio have different up axes. Follow the category export guide and import options together, then measure the imported result in studs. The Blender guide describes Unit System None and Studio Scale Unit Stud; another valid source may use FBX scaling with a documented unit conversion. Record the chosen convention instead of silently assuming raw Blender dimensions are studs.

Traditional character specifications and Avatar Setup input have different front conventions (+Z versus -Z). Choose the process explicitly. Keep existing rigs/animations and source orientation intact; avoid applying destructive transforms after binding unless the chosen process requires it.

FBX helpers use FBX Unit Scale, embedded copied textures, no leaf bones, custom properties and category-appropriate animation export. Head/body exports preserve the FACS frame range, use Simplify 0 and disable NLA/all-actions/forced endpoint keying. GLB is a supported alternative, but inspect actual Studio interpretation. For an animation pack, export/check individual active actions and assemble the pack in Studio; one FBX with arbitrary actions is not a published pack.

Sources: [rigid export](https://create.roblox.com/docs/avatar/rigid-accessories/export), [layered export](https://create.roblox.com/docs/avatar/layered-accessories/export), [body export](https://create.roblox.com/docs/avatar/character-bodies/export), [basic-head authoring](https://create.roblox.com/docs/art/characters/facial-animation/create-basic-heads).

## Helpers

Python 3.10+ is sufficient for the launcher and corpus. Blender is an optional external runtime required for real 3D analysis/export. `--blender` accepts its executable path. In Claude Chat's remote runtime, local Blender/Studio may be inaccessible; Cowork/Code and Codex require their own authorized local tools.

For interactive scene editing and previews, use [Blender MCP setup and operation](blender-mcp.md). For the additional authoring operators, use the audited [RBX Toolbox guide](rbx-toolbox.md). For geometry reduction/new UVs and appearance transfer, use [remesh and rebake](remesh-rebake.md). The skill's ordinary preflight/export remains usable without either add-on. Connect and inspect Studio through [Studio control](studio-control.md).

```bash
python scripts/asset.py templates
python scripts/asset.py prepare --kind layered --template clothing-cages --dest ./jacket-project
python scripts/asset.py preflight ./jacket.blend --kind layered --workflow traditional --report ./jacket-report.json
python scripts/asset.py preflight ./body.blend --kind body --workflow avatar-setup
python scripts/asset.py export --input ./hat.blend --kind rigid --objects HatMesh --output ./exports/hat.fbx
python scripts/asset.py preflight ./shirt.png --kind classic-shirt
```

Kinds: `rigid`, `layered`, `body`, `head`, `makeup`, `classic-shirt`, `classic-pants`, `classic-tshirt`, `emote`, `animation-pack`.

Formats: PNG/JPEG for classic/makeup checks; `.blend`, `.fbx`, `.gltf`, `.glb` for Blender. Export creates a new `.fbx` or `.glb`. It refuses existing output files and blocking preflight findings. Use `--objects NAME ...` to omit scene references, mannequins and helper geometry. Include the intended armature, attachments and cages for the chosen process. The default includes visible Mesh/Armature/Empty objects.

`--cage-baseline FILE.blend` compares cage vertex count, ordered topology and UVs with matching object names in an official template. Without it, cage correctness remains unvalidated. `--studs-per-unit` records a claimed conversion; this release still requires attachment-relative bounds validation in Studio.

Preflight is read-only, opens Blender with autoexecution disabled, and never saves the input. It checks evaluated render triangles separately from cages. It does not prove artistic quality, actual FACS motion, normal-map handedness, category-specific bounds or moderation. The report keeps these as `NOT_CHECKED`.

To model programmatically, create an isolated Blender Python script using `bpy`, then run Blender in background mode with that script. Preserve the source `.blend`, export through the supplied helper, and generate actual previews. Inspect the previews and use appropriate reference mannequins; merely running Blender is not verification of the visible result.
