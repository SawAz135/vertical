---
name: gh-sp-blender-export-gltf
description: "Defines validated Blender glTF/GLB export for Unity handoff. Use when exporting portable static or animated assets with PBR materials."
---

# Blender Export glTF

## Overview
Export deterministic glTF or GLB artifacts only after transforms, naming, materials, and license gates pass.

## Usage
Use this skill when:
- Handing portable PBR assets from Blender to Unity
- Exporting selected collections or animation clips
- Diagnosing missing textures, axes, transforms, or unsupported nodes

## Core Concepts
- GLB embeds payloads; glTF can keep inspectable external resources.
- Export settings are part of the artifact's reproducibility record.
- Existing destinations require explicit overwrite approval.

## Workflow
1. You MUST verify the license, naming, transform, origin, and budget gates.
2. You MUST choose GLB or separate glTF resources based on the project contract.
3. You MUST export only the intended collection or selection.
4. You MUST NOT overwrite an existing artifact because prior handoffs must remain recoverable without explicit approval.
5. You MUST refresh the manifest checksum after export.

## Example
Export `SM_Crate_A` and its material as `Exports/Props/SM_Crate_A.glb`, then record the SHA-256 checksum and Blender source path.

## Validation
You MUST re-import or inspect the artifact and compare object count, dimensions, materials, and animations with the source.


---
Source: https://github.com/sapai5/GameDevAgent/blob/HEAD/skills/blender-export-gltf/SKILL.md (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
