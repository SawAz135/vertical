# Troubleshooting and source conflicts

Start with the original error string and [UGC validation system](https://create.roblox.com/docs/marketplace/validation-system). Search the local corpus, then verify live behavior when an error depends on Studio/API version or publishing policy. Fix the concrete asset defect rather than bypassing a checker.

| Symptom | Investigate / correct |
| --- | --- |
| Geometry budget failure | Count evaluated render triangles for the appropriate asset/category; exclude cages/attachments. Body limb budgets aggregate several parts. |
| Rigid skinning/multiple meshes | Check exported objects and unwanted armature deformation; separate the reference scene from the actual accessory. |
| Invalid cage UV/topology | Compare the matching official template, preserve vertex/UV correspondence and adjust positions rather than rebuilding cages. |
| Bad garment deformation | Determine manual skinning versus Automatic Skinning Transfer; inspect weights, cage intersections and actual layered fit. |
| Body attachment failure | DCC `_Att` names differ from Studio `Attachment` names; inspect required names, positions and orientation after import. |
| FACS/head validation failure | Inspect actual mapped pose motion, neutral frame, export range, RootFaceJoint and cage landmarks. Expected property names alone do not repair motion. |
| Classic clothing appears wrong | Use the correct 585×559 template/panels and a body that supports classic clothing. |
| Makeup region distortion | Preserve TransferTarget/TransferTexture naming and transfer data; inspect multiple heads, skin tones and expressions. |
| Missing UGC emote marker | Check current Studio version and the editor's Emote publishing/object-creation workflow. Generic Animation wrapper construction may miss the marker. |
| Animation pack missing states | Check eight/nine clips, types/subtypes, shared parent name, looping and CurveAnimation conversion. |
| Texture size dispute | Identify category, map type and workflow; generic mesh limits do not override category requirements. |
| Upload response uncertain | Check Dashboard/asset IDs before retrying, especially if another paid upload could occur. |
| Unsupported API symbol | Search the official Engine index; upstream prose typos do not establish an API. |

## Recorded conflicts at the source snapshot

1. **Coordinate direction:** [traditional body specs](https://create.roblox.com/docs/avatar/character-bodies/specifications) and [Avatar Setup input](https://create.roblox.com/docs/avatar-setup/auto-setup-requirements) use different front conventions. Apply each to its own process.
2. **Texture limits:** [general texture specs](https://create.roblox.com/docs/art/modeling/texture-specifications), PBR map guidance and individual Marketplace category limits differ. Read both and report unresolved disagreement; do not assert every ≤2048 texture is accepted.
3. **Advanced emotes:** [specs](https://create.roblox.com/docs/avatar/emotes/specifications) retain beta wording but link to [an opening announcement](https://devforum.roblox.com/t/upload-and-publish-for-emotes-with-additional-joints-is-now-open/4710932). Recheck the announcement and actual account/UI access.
4. **Emote submission markers:** the specification's simple Animation wrapper can conflict with [Studio 737 publishing reports](https://devforum.roblox.com/t/ugc-emote-upload-fails-with-%E2%80%9Cmissing-a-valid-ugc-emote-marker%E2%80%9D/4844418). Confirm the correction against the latest import/publishing guide and UI; community reports are evidence, not universal policy.
5. **In-game versus Marketplace:** a simple head with a few poses, partial cages or higher-resolution in-game makeup can be valid for a different use case. Marketplace requirements still apply to Marketplace submissions.

Known upstream references to `MeshParts` and `AttachmentConstraint` have no corresponding class in this pinned tree; the former is a likely pluralization issue. The inventory records these defects. Search actual supported class names instead of inventing them.

Repair a copy, rerun affected checks, reimport and inspect the result. Repeated successful static checks do not replace the missing visual/Studio test.
