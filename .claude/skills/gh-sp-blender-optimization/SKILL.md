---
name: gh-sp-blender-optimization
description: "Applies Blender poly, material, texture, draw-call, and LOD preparation budgets. Use before export or when profiling identifies asset cost."
---

# Blender Optimization

## Overview
Reduce asset cost against measured project budgets without damaging silhouette, shading, UVs, or traceability.

## Usage
Use this skill when:
- Setting or validating triangle and material-slot budgets
- Preparing LOD variants or collision proxies
- Removing hidden geometry and redundant data before export

## Core Concepts
- Optimize for target viewing distance and measured bottlenecks.
- Material slots and object splits can cost draw calls even with low polygon counts.
- LOD transitions require stable pivots, bounds, and naming.

## Workflow
1. You MUST read the platform, viewing distance, and asset budget.
2. You MUST measure evaluated triangles, objects, material slots, and texture memory before editing.
3. You SHOULD remove invisible geometry and merge only where ownership and culling remain valid.
4. You MUST preserve silhouette and shading at each approved LOD distance.
5. You MUST name LOD and collision variants using the shared taxonomy.

## Example
`SM_Rock_A_LOD0`, `LOD1`, and `LOD2` share origin and bounds while reducing silhouette detail at documented screen sizes.

## Validation
You MUST report before-and-after metrics and verify UV, normal, and export integrity.


---
Source: https://github.com/sapai5/GameDevAgent/blob/HEAD/skills/blender-optimization/SKILL.md (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
