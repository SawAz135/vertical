# Rigid accessories and hair

Sources: [overview](https://create.roblox.com/docs/avatar/rigid-accessories), [specifications](https://create.roblox.com/docs/avatar/rigid-accessories/specifications), [export](https://create.roblox.com/docs/avatar/rigid-accessories/export), [import](https://create.roblox.com/docs/avatar/rigid-accessories/import), [full first-accessory tutorial](https://create.roblox.com/docs/art/accessories/creating-rigid), [categories](https://create.roblox.com/docs/marketplace/categories).

## Create → fit → publish

1. Choose Hat, Hair, Face, Neck, Shoulder, Front, Back or Waist and the target Classic/Normal/Slender body scale. Open that category's attachment-relative size table. Hair and facial hair have distinct categorization rules.
2. Import the relevant reference mannequin and model a single render mesh. The rigid budget is 4000 triangles. Use closed geometry, useful silhouette detail and sensible texture seams. Avoid backface-dependent shapes and invisible/glitch-dependent designs.
3. UV unwrap and produce the final texture/PBR maps. Verify the specific map limits in both category and texture documents; generic 4K mesh advice is insufficient for Marketplace accessories. Rigid accessories do not use deform skinning.
4. Run preflight, export a separate FBX/GLB, import with the correct scale, and convert the mesh into an Accessory through AFT. Set its category and attachment position using actual avatars.
5. Inspect frontal, side and rear views on target body scales and while moving. Check clipping, surface placement, visibility, attachment motion and spatial bounds. Save the configured Studio asset and preview.
6. Run official accessory validation. Follow the publishing guide after the technical/visual evidence is satisfactory; current account eligibility and transaction details need live verification.

## Attachment map

| Category | Studio attachment |
| --- | --- |
| Hat | HatAttachment |
| Hair | HairAttachment |
| Face | FaceFrontAttachment or FaceCenterAttachment |
| Neck | NeckAttachment |
| Front | BodyFrontAttachment |
| Back | BodyBackAttachment |
| Waist | WaistFrontAttachment, WaistCenterAttachment or WaistBackAttachment |
| Shoulder | Right/LeftShoulderAttachment, Right/LeftCollarAttachment or NeckAttachment |

Shoulder joints follow arm movement; collar joints remain attached to the torso. Choose the intended behavior and test it. Head attachments must meet the visible head surface; floating attachment points can violate policy.

Complete hairstyles belong in Hair. Partial hair can have other allowed categories under current policy; facial hair belongs in Face. Do not disguise a full-body item as a tiny Hat: bodysuit/full-mask detection and category restrictions apply. See the full [Marketplace policy](https://create.roblox.com/docs/marketplace/marketplace-policy).

## Common failures

Multiple render meshes: consolidate the intended accessory, excluding the reference mannequin. Excess triangles: retopologize the render mesh, preserving the visible silhouette. Holes/backfaces: repair actual geometry. Skinning on a rigid item: remove the unwanted deformation through an editable working copy. Incorrect scale/bounds: validate in the attachment frame after import. Misplaced accessory: fix the attachment, not an unrelated body mesh.

A successful general mesh import produces a mesh, not automatically a fitted, validated Marketplace accessory.
