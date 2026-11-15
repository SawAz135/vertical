---
name: gh-sp-blender-naming-and-scale
description: "Enforces Blender units, transforms, origins, collections, and export-safe naming. Use when creating, composing, validating, or exporting Blender assets."
---

# Blender Naming and Scale

## Overview
Keep Blender geometry predictable across modeling, export, and Unity import by normalizing names, units, transforms, and origins.

## Usage
Use this skill when:
- Creating or reviewing a model, collection, camera, or collision mesh
- Preparing a Blender file for glTF or FBX handoff
- Diagnosing scale, rotation, pivot, or duplicate-name problems

## Core Concepts
- Project units and target dimensions are part of the asset contract.
- Object names identify purpose; mesh-data names identify reusable geometry.
- Applied transforms and intentional origins prevent downstream prefab drift.

## Workflow
1. You MUST read the project taxonomy and target dimensions before editing.
2. You MUST use deterministic names such as `SM_Crate_A`, `COL_Crate_A`, and `MAT_Wood_A`.
3. You MUST verify dimensions, rotation, scale, origin, and collection ownership.
4. You MUST report exceptions rather than silently compensating during export.

## Example
A one-meter crate uses object `SM_Crate_A`, collision object `COL_Crate_A`, scale `(1,1,1)`, and an origin centered on its floor contact plane.

## Validation
You MUST record the Blender path and asset id, then re-read transforms through Blender MCP before handoff.


---
Source: https://github.com/sapai5/GameDevAgent/blob/HEAD/skills/blender-naming-and-scale/SKILL.md (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
