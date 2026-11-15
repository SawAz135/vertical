# Character bodies and dynamic heads

Sources: [body specifications](https://create.roblox.com/docs/avatar/character-bodies/specifications), [body tutorial](https://create.roblox.com/docs/art/characters/creating), [head specifications](https://create.roblox.com/docs/avatar/dynamic-heads/specifications), [basic-head creation](https://create.roblox.com/docs/art/characters/facial-animation/create-basic-heads), [Avatar Setup](https://create.roblox.com/docs/avatar-setup).

## Choose traditional or Avatar Setup

Traditional authoring supplies geometry, rig, skinning, attachments, cages and facial animation. Avatar Setup generates essential avatar components from suitable inputs; its output still needs artistic inspection, edits and validation. Follow [Setup input requirements](https://create.roblox.com/docs/avatar-setup/auto-setup-requirements), including their front direction. Do not apply the traditional +Z front requirement to the Setup -Z input workflow.

The official [Auto Setup video](https://www.youtube.com/watch?v=Hp9pr2FpZa8) explicitly demonstrates a technically processed example that still has policy-invalid baked clothes/shoes. Its historical claim that output download is not available is superseded by current glTF download/edit support. Keep input requirements and output acceptance separate.

## Traditional body

Use the complete official character-template tutorial, including head cleanup, retopology/UV, texturing, rigging, caging, export and Blender/Studio tests. A standard body has 15 separate watertight render meshes: Head, Upper/LowerTorso, Upper/LowerArm plus Hand on each side, and Upper/LowerLeg plus Foot on each side. The DCC naming convention uses `_Geo`.

Budgets apply to Marketplace body assets, not each arbitrary mesh: Head 4000, combined torso 1750, each combined arm 1248, each combined leg 1248 (total 10742). Keep each limb capped after separation. Compare the selected Classic/Normal/Slender dimensions with the actual imported body. Render coverage, opacity and visible bounding-box occupancy have their own requirements.

Retain the required rig and attachment positions. DCC attachments use names such as `Hat_Att`, `Root_Att` and `LeftGrip_Att`, which import to Studio attachment names. Root_Att position is specifically constrained. R15 parts remain the same even when an advanced rig adds finger/internal joints; consult `HumanoidRigDescription`/`DigitsRigDescription` as applicable. Extra joints are not automatically invalid.

Skin using no more than the permitted deform influences per vertex, avoiding Root influence. Use the official outer cage for every body part. Preserve cage vertex/UV correspondence; the cage itself is not a render mesh and does not share every render-geometry rule.

Separate clothing/accessories from a body submission and implement required modesty layers. Skin-tone alpha in color maps is a supported workflow; MeshPart opacity and skin-tone texture masking are different checks. Eyebrows/eyelashes have special bundled requirements. Complete the original tutorial's cleanup: provided templates may contain placeholder objects or older face accessories.

## Dynamic head

Create editable head geometry with workable facial topology, a suitable cage and facial landmarks. Rig the face through a mapped `RootFaceJoint` under the head joint. Store neutral expression at frame 0, pose frames after it and map them through custom properties such as `Frame1`; preserve the entire frame range and custom properties in export.

The Marketplace requires the specific 17 FACS poses listed in the head specification (also recorded in `assets/rules.json`). Simple in-game demonstrations with four poses are not the Marketplace minimum. Include corrective combinations where needed so expressions blend without disfiguring the face.

Declared pose names do not prove exported motion. Check the rendered expressions, landmark projection, blink closure, jaw opening and happy/sad deformation through [Roblox head validation](https://create.roblox.com/docs/avatar/dynamic-heads/validate). Preserve working animations while repairing the cage; do not fix a failing expression merely by adding a property with the expected name.

## Test and deliver

Run [Blender tests](https://create.roblox.com/docs/avatar/character-bodies/test-blender), [Studio tests](https://create.roblox.com/docs/avatar/character-bodies/test-studio) and official body/head validation. Inspect walking, running, jumping, face controls, body scaling, attachment placement, layered garments and shoes. Save the editable project, exported body, textures, representative previews and separate evidence for each tested stage.
