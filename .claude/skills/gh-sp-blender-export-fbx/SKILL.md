---
name: gh-sp-blender-export-fbx
description: "Defines validated Blender FBX export for Unity, including axes, transforms, animation, and texture handoff. Use when project compatibility requires FBX."
---

# Blender Export FBX

## Overview
Create deterministic Unity-compatible FBX artifacts while making axis, scale, bake, and animation choices explicit.

## Usage
Use this skill when:
- Exporting rigs, animation clips, or pipelines standardized on FBX
- Diagnosing axis conversion, scale, leaf-bone, or animation bake issues
- Producing one FBX per manifest asset or approved collection

## Core Concepts
- Axis conversion and unit scale must be tested as a pair.
- Animation baking can change curve density and clip boundaries.
- Texture copying does not replace explicit material and license records.

## Workflow
1. You MUST verify gates and select the exact export objects.
2. You MUST use the project's recorded axis, scale, and bake settings.
3. You MUST disable unneeded helper-bone generation.
4. You MUST NOT overwrite an existing FBX because the previous checksum is an audit record without explicit approval.
5. You MUST update the export path and checksum in the manifest.

## Example
A character export includes deform bones and mesh, excludes controls, records clip ranges, and validates scale against a one-meter reference in Unity.

## Validation
You MUST import into a clean validation scene and compare hierarchy, dimensions, bind pose, and clip ranges.


---
Source: https://github.com/sapai5/GameDevAgent/blob/HEAD/skills/blender-export-fbx/SKILL.md (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
