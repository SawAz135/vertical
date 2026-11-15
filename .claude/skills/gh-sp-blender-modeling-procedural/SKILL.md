---
name: gh-sp-blender-modeling-procedural
description: "Defines safe Geometry Nodes patterns for arrays, scatter, and parametric kits. Use when Blender assets need controlled variants or repeatable placement."
---

# Blender Modeling Procedural

## Overview
Create bounded, reproducible procedural assets whose controls and realized export results remain understandable.

## Usage
Use this skill when:
- Building repeated modular pieces or parametric variants
- Scattering objects over a controlled surface
- Replacing manual duplication with Geometry Nodes

## Core Concepts
- Exposed inputs form a stable parameter contract.
- Random operations require a recorded seed.
- Instancing saves memory; export may require intentional realization.

## Workflow
1. You MUST define output bounds, variant count, density, and seed before node construction.
2. You MUST expose only meaningful controls with units and safe ranges.
3. You SHOULD keep generation, selection, transform, and output phases visually separated.
4. You MUST validate extreme parameter values and empty inputs.
5. You MUST document whether instances are realized for export.

## Example
A fence generator exposes segment count, spacing in meters, post asset, and seed; it clamps segment count to the approved kit limit.

## Validation
You MUST regenerate twice with the same inputs and verify identical object counts and bounds.


---
Source: https://github.com/sapai5/GameDevAgent/blob/HEAD/skills/blender-modeling-procedural/SKILL.md (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
