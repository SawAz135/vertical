# Layered accessories, cages and shoes

Sources: [overview](https://create.roblox.com/docs/avatar/layered-accessories), [specifications](https://create.roblox.com/docs/avatar/layered-accessories/specifications), [project files](https://create.roblox.com/docs/avatar/layered-accessories/project-files), [caging](https://create.roblox.com/docs/avatar/layered-accessories/caging-best-practices), [skinning transfer](https://create.roblox.com/docs/avatar/automatic-skinning-transfer), [complete tutorial](https://create.roblox.com/docs/art/accessories/creating).

## Author the garment

Start from a compatible mannequin/rig and official clothing cages. Model and texture the garment's render mesh with the target movement in mind. A layered accessory has a 4000-triangle render budget. Plan enough topology at shoulders, elbows, knees and folds for the intended deformation; dense detail does not compensate for bad edge flow.

Use the complete tutorial's modeling, texturing, caging, rigging, export and Studio conversion steps in their documented order. Inspect the supplied examples instead of rebuilding the cage surface from a visual approximation.

An inner cage defines the contact side and an outer cage defines the wrapping surface for subsequent layers. Preserve template vertex correspondence and UV mapping; adjust vertex positions to fit. Do not decimate, delete cage faces, rebuild cage UVs or apply topology-changing modifiers to cages as a generic repair. Partial cages that work in an experience are not a general Marketplace submission workaround.

Manual skinning must obey deform-weight rules and preserve the expected rig. Automatic Skinning Transfer is a supported alternative when configured through the documented Studio workflow. Missing manual weights therefore require workflow-specific review rather than an unconditional rejection.

## Convert and test

Export using layered settings, import the rig/cages, and use AFT to create the proper Accessory/WrapLayer structure. Check naming, category, cage pairing and scale after import. An imported cage with the right name can still have invalid topology or a bad fit.

Test the garment alone, under/over relevant garments, on multiple compatible body shapes and during walking, idle, jumping and limb motion. Look for skin breakthrough, extreme stretching, visible seams, incorrect layer order and intersecting cage surfaces. Recheck both the source and Studio result after every repair.

Shoes are a left/right pair of distinct accessories; each has its own cage data. Audit/export each intended accessory separately rather than applying one 4000-triangle limit to an arbitrary scene containing both shoes and a mannequin.

## Eyebrows and eyelashes

These are special layered assets bundled with a body or makeup. They require their own inner/outer cages and special skinning-transfer setup when used. Consult the exact `RBX_Leader`/`RBX_Follower` and `AutoSkin` requirements; generic garment weights are insufficient. They are not standalone Marketplace uploads. Sources: [face accessory rules](https://create.roblox.com/docs/avatar/layered-accessories/specifications#face-accessories), [special transfer joints](https://create.roblox.com/docs/avatar/automatic-skinning-transfer#special-skinning-transfer-joints).

## Repairs

Distorted cages: compare topology/UV correspondence with the matching official baseline, then adjust positions. Bad wrapping: inspect inner/outer intersections and actual avatar fit. Weight issues: identify the deform groups and affected vertices; do not count unrelated artistic groups as bones. Export scale problems: repair the documented unit/import pair and verify the imported dimensions. Avoid using general decimation on the entire scene.
