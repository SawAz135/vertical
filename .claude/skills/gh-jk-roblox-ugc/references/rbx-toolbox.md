# RBX Toolbox: optional Blender authoring tools

[RBX Toolbox](https://github.com/Gl2imm/RBX_Toolbox) adds Blender operators, templates, avatar import and Open Cloud upload. Use it through an available Blender Python/MCP connection or its `N` sidebar, **RBX Tools**. It supplies neither a Blender MCP server nor control of Roblox Studio. The skill's offline helper and Studio validation remain necessary.

Reviewed on 2026-10-14: source commit `83efd4e348537f6e1377ac46d0d677838535507b`, add-on `7.11.0`, declared minimum Blender `4.5.0`. Twelve isolated operator checks passed on Blender `5.2.2 LTS`; full add-on startup, authenticated import/upload and GUI behavior were not tested. See `corpus/tool-integrations.json` for provenance and limits.

## Install and discover

1. Use the upstream [v.7.11 release asset](https://github.com/Gl2imm/RBX_Toolbox/releases/tag/v.7.11), `RBX_Toolbox_v7.11.zip`. The reviewed archive's SHA-256 is `f759a5e719f9263dc541b8c608c25444d92415325579a9fc4325abdc7b24cd0a`. Refresh this audit before replacing it with another release. Keep the downloaded ZIP intact.
2. In Blender 4.5+, open **Edit → Preferences → Add-ons → menu → Install from Disk**, select the ZIP, then enable **RBX Toolbox**. The [Blender manual](https://docs.blender.org/manual/en/4.5/editors/preferences/addons.html) documents legacy add-on installation. Use the installed package name when enabling through Python; folder names can differ.
3. Inspect console errors and the sidebar. The add-on's **Install Dependencies** action installs its requirements into its own staging folder with Blender's Python; it can require a restart. These network/authentication dependencies are not supplied by this skill. Avoid repeatedly installing them into a running process that already imported incompatible wheels.
4. OAuth is optional for local authoring. If authenticated operations are needed, use the real Roblox authorization flow and the intended user/group creator. The add-on stores token JSON in Blender add-on preferences. Never collect `.ROBLOSECURITY`, passwords, token values or complete preference dumps as debugging evidence.

The release ZIP's shipped files match the reviewed main commit after normalizing text line endings. **The Git tag `v.7.11` points to `3f9358afab45637e865f74b21ca55ab0a3480acc`, whose source declares version 7.10.0.** Do not use that tag checkout as a substitute for the verified ZIP or reviewed commit. Record archive hash and source revision separately.

For an enabled add-on, a Blender executor can discover its operators without changing the scene:

```python
import bpy
for category, name in [("object", "rbx_ugc_template"),
                       ("object", "rbx_button_lc"),
                       ("object", "rbx_button_ava"),
                       ("rbx", "check_animation_emote")]:
    op = getattr(getattr(bpy.ops, category), name)
    try:
        print(category + "." + name, sorted(op.get_rna_type().properties.keys()))
    except RuntimeError:
        print(category + "." + name, "NOT_AVAILABLE")
```

Inspect selected objects, active object, object mode and relevant scene properties before invoking an operator. Some actions return `FINISHED` even after reporting an error; verify resulting objects/data, not the return set alone. Work on an editable copy and separate test collection.

## Choose operations by purpose

| Purpose | Sidebar / exact operator | Agent procedure and boundary |
| --- | --- | --- |
| Accessory fit reference | Bounds; `bpy.ops.object.button_bnds(bnds='UGC')`; `scene.rbx_prefs.rbx_bnds_enum` selects type | Spawn separately; hide the optional dummy with `rbx_bnds_hide=True`. Historical bounds are guides. Upstream credits explicitly say some are obsolete; compare actual dimensions/attachment alignment with current official specifications and Studio. |
| Body/garment reference | Bounds with `bnds='AVA'` / `'LC'`; Dummy / Rigs | Separate comparison bodies and bounds from export objects. A template fitting its own dummy is insufficient evidence for scaled avatars or Marketplace acceptance. |
| Layered cages and rig | Layered Cloth; `object.rbx_button_lc(rbx_lc='_Cage')` / `'_Arma'`; `rbx_lc_dum_enum` | Choose the intended mannequin/body. Preserve cage topology/UV correspondence and coherent names. `_Cage` appends both cage meshes for the default mannequin; `_Arma` appends its rig. The misleading console messages are not a reliable inventory. Prefer a pinned official template as the normative baseline. |
| Hair creation | Hair; `object.button_hair(rbx_hair='hair_template')`, `'hair_shader'`, `'Dummy_head'` | Build an original silhouette; evaluate converted curves/arrays and final triangle count. Texture baking action `'hair_bake'` changes engine and bake settings and assumes specific named template objects; inspect them first, save the baked image explicitly and restore project settings. Procedural shader nodes do not become Roblox textures automatically. |
| Chains / fur | UGC Templates; `object.rbx_ugc_template(action='chain_1')`, `'chain_2'`, `'fur_sample'`, `'apply_fur'` | Chain templates contain Array/Curve modifiers. Evaluate final geometry before budget checks. Fur uses a particle preset; convert on a copy with `'convert_fur'` or `'convert_fur_combined'`. Conversion removes the particle system and template object and can produce many triangles. Combine and simplify as required by the asset category. |
| Attach item in Blender | Avatars → Attach & Parent; `object.rbx_attach_to_attachment`, `object.rbx_attach_to_mesh`, `object.rbx_attach_to_bone` | Select exactly one source. Set `rbx_attach_target`; for bone mode set `rbx_attach_bone` and `rbx_attach_bone_mode` (`OBJECT` or `WEIGHTS`). Attachment mode snaps the item's single attachment to the target. Mesh/bone parenting preserves world transform. Weight mode assigns all vertices weight 1 to a bone while retaining existing groups; inspect and repair combined influences. This Blender hierarchy does not establish Studio Accessory/Handle/Attachment structure. |
| FACS declarations | Avatars; `object.rbx_button_ava(rbx_ava='add_facs')` | Writes frame-name custom properties and `RootFaceJoint='DynamicHead'` to a selected object whose name contains Head. It creates no face rig or deformation. Verify the actual face root, pose animation, required expressions and landmark motion. Names alone never pass FACS validation. |
| FACS preview | Avatars; `object.rbx_button_ava(rbx_ava='add_facs_anim')` | Select a face armature. The preview assumes matching template bone names, copies a template action and deletes existing NLA tracks. Preserve authored animation first. Missing bones are warnings; inspect eyes/jaw/lips and actual Studio FaceControls before success. |
| Garment deformation preview | Layered Cloth → LC Animation V2; `object.rbx_lc_anim_v2`, `object.rbx_lc_anim_v2_add_anim` | Set `scene.rbx_lc_anim_armature` to the source. Spawn a test rig; select a test clip through `rbx_lc_anim_v2_type_enum` (or the `anim_type` operator argument). Linked duplicate meshes mean edits can affect both views. Test bends, armpits, shoulders and bulkier layered combinations again in Studio. Built-in locomotion clips are test material, not original Marketplace animation-pack content. |
| Inspect existing items | Import from Roblox / discovery; `object.rbx_import_discovery`, `object.rbx_import_discovery_download`, `object.rbx_import_user_avatar` | Discover only assets the user is allowed to access; inspect options for meshes, materials, attachments, armatures, weights and cages. Record downloaded components and failures. Import My Avatar is a rendered OBJ workflow with optional material separation; it is not an editable authoritative rig/FACS export. Downloading a purchasable item confers no right to reupload it. |
| Classic texture preview | R6 rig → Modify Character; `object.button_wear` | Preview owned/permitted classic clothing. This targets a particular R6 material layout; validate classic PNG dimensions and test the intended R6/R15 avatar separately. |
| Camera and preview | Cameras; `object.button_cmr(cmr='append')`, `'staging'`, `'edtr_append'` | Preserve scene world/camera/render settings; these actions append staging and can change resolution/world. Export only the asset collection. Inspect original work in neutral light as well as styled staging. |

Common selector enums are numbered `OP1`, `OP2`, etc.; read the installed RNA/UI labels instead of assuming they mean the same in a later release. For a reviewed default mannequin cage spawn:

```python
bpy.context.scene.rbx_prefs.rbx_lc_dum_enum = 'OP1'
bpy.ops.object.rbx_button_lc(rbx_lc='_Cage')
# Inspect newly appended meshes and keep them outside the original source collection.
```

## Export and Studio handoff

**File Export** provides selection-based FBX presets. `object.rbx_operators(rbx_operator='exp_fbx')` can apply all transforms and reset the origin, enabled by default. `'exp_fbx_lc'` uses Copy/embedded media, disables leaf bones and animation; `'exp_fbx_anim'` bakes the active armature animation. These presets use global scale `0.01`; `'set_unit'` also changes scene unit scale. Do not apply both blindly to an already calibrated project. Measure an actual Studio import in studs and preserve the chosen [export workflow](authoring.md).

Avatar export (`object.rbx_button_ava(rbx_ava='export')`) enables custom properties and animation, disables leaf bones, and exports **all actions**. This differs from the old credits file, which says animation is disabled. Inspect exported clips and FACS data. Prefer the skill's separate-output `asset.py export` when source preservation and reproducible reports are needed.

**Upload to Roblox → Mesh** exports and calls the Open Cloud Assets API with type `MODEL`. **Upload Animation** calls it with type `ANIMATION`. These upload development assets; they do not publish a Marketplace accessory, dynamic head, emote or animation pack. Follow [Open Cloud usage](https://create.roblox.com/docs/cloud/guides/usage-assets) and then the category's Studio/Marketplace process. Confirm actual creator, created asset ID, moderation and on-sale state independently. An operator reporting `FINISHED` precedes asynchronous completion.

**Advanced Upload** (`rbx.generate_keyframes`) generates clipboard Luau that creates a `KeyframeSequence` in `ServerStorage`. It uses a fixed standard R15 joint tree, accumulates root motion into LowerTorso, applies a floor-lift correction and emits linear easing. Review its report and compare poses after conversion; it is not a lossless generic exporter for arbitrary rigs, curve tangents, face animation or advanced R15 joints. The generated payload **destroys an existing ServerStorage child with the same clip name**. Use a unique name and an authorized scratch place, preserve existing content, and inspect the code before executing. The Marketplace workflow still requires the supported curve-animation conversion and publishing metadata. See [emote specifications](https://create.roblox.com/docs/avatar/emotes/specifications) and [animation packs](https://create.roblox.com/docs/avatar/animation-packs).

**Check Emote** samples world-space bone heads per integer action frame. Its internal threshold is `26.0` Blender units/second, multiplied by `30/26` for display; its “safe zone” uses a radius `5.0` in Blender coordinates. These are upstream heuristic constants, not calibrated official verdicts. It does not measure Roblox part centers, actual Studio import scale, every continuous-frame overshoot, duration, curve provenance or complete rig compliance. Report its result as `WARN`/heuristic evidence and keep Roblox validation `NOT_CHECKED` until performed.

## Avoid repairs that silently remove required data

- **Clean Up All** (`rbx_ava='clear'`) deletes selected objects' custom properties, including authored FACS frame mappings. **Rename All** truncates names at the first dot and can create collisions. Do neither as a generic importer-error repair.
- Merge by Distance, auto weighting, resetting origins and rest-pose edits can destroy cage correspondence or change attachment/rig transforms. Restrict fixes to identified render/rig data on a copy; inspect weight sums and cage baseline afterward.
- Glow manipulates custom normals; Outline adds/applies a Solidify modifier and moves UVs. A Blender viewport effect does not establish supported Marketplace VFX or correct Roblox shading. Use documented SurfaceAppearance/emissive requirements and recheck geometry/UV after changes.
- LC animation cleanup removes pose constraints and may delete their target objects. Run it only on the disposable test rig; never on the authored control rig.
- Self-update and AEPBR-update actions delete/replace add-on directories and extract downloads; do not place original projects inside those directories. The development `.bat` cleanup recursively removes caches and optionally imports. It is not an installation step.
- Some folder-opening helpers call Windows-only `os.startfile`; on Linux/macOS open the reported folder with the available OS/file tool. A folder-button error does not prove download failure.

Source inspection covers the registered operator map, template library, import-reader responsibilities, export/upload paths, authentication/dependency handling and destructive operations. The binary parser implementation was structurally surveyed rather than certified for all possible malformed files. Imported mesh/FACS data, full compatibility on every platform, online authorization and actual Marketplace acceptance remain distinct tests.

The root repository license is GPL-3.0; its add-on header allows GPL-3.0-or-later, and some Roblox-derived OAuth files carry MIT notices. Templates and imported third-party assets have separate origin/rights questions. This skill distributes its own guide and audit metadata, not the add-on, copied catalog assets or credentials.
