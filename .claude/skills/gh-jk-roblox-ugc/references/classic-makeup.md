# Classic clothing and makeup

## Classic clothing

Source: [complete classic clothing guide](https://create.roblox.com/docs/avatar/classic-clothing).

Classic T-shirts are square front graphics. Classic shirts and pants use the official panel templates, whose PNG dimensions are 585×559. Start from the correct template, identify front/back/left/right/top/bottom panels, create the artwork on separate layers, and export the intended image without resizing the template layout.

Test actual seam alignment and torso/limb placement using Shirt, Pants or ShirtGraphic on a suitable avatar. Many modern UGC bodies do not support classic 2D clothing; a correct image cannot force support on those bodies. The workflow needs an image editor and upload interface, not cages or AFT.

Inspect transparency, edge bleed and seam continuity visually. Header dimensions alone do not prove panel correctness or content approval. Use the current classic-clothing upload and selling requirements rather than copying the 3D upload workflow or fees.

```bash
python scripts/asset.py prepare --kind classic-shirt --template classic-clothing --dest ./shirt-project
python scripts/asset.py preflight ./shirt.png --kind classic-shirt
```

## Marketplace makeup

Sources: [creation process](https://create.roblox.com/docs/avatar/makeup), [specifications](https://create.roblox.com/docs/avatar/makeup/specifications), [texture reassignment/export](https://create.roblox.com/docs/avatar/makeup/reassign-textures), [import](https://create.roblox.com/docs/avatar/makeup/import), [official templates](https://github.com/Roblox/avatar/tree/main/Makeup).

Use the supplied makeup head/cage data model. Preserve the `TransferTarget_` head/cage names and create the intended regional textures on `TransferTexture_Eyes_01`, `TransferTexture_Lips_01` and `TransferTexture_Face_01`, incrementing the suffix for additional regions.

Author the look against the reference face. Use the documented Blender/Maya texture reassignment and export process, then import into Studio, where texture-transfer/Decal components configure the result. Arbitrarily placing a Decal on a head is not the complete Marketplace makeup workflow.

Marketplace makeup textures are limited to 1K in this snapshot. The 4K in-experience makeup limit does not apply to Marketplace upload. Verify current live category specs before submitting. Test the look on multiple supported head shapes, skin tones and facial expressions; inspect unwanted seams, distorted regions, alpha blending and changes under expression.

Optional eyebrows/eyelashes each need valid layered cages and the appropriate special skinning setup. They must be bundled as allowed with body/makeup rather than submitted as independent accessories.

The image helper checks makeup texture dimensions; it does not validate the complete transfer hierarchy or how the look fits different faces. Use the full imported Studio asset for those checks. Preserve the original DCC project and used textures as deliverables.
