---
name: forge-simulator-style
description: Use when working on the round toy-like 'Simulateur' pet style (roblox-forge/studio/chibi.js) or its variants Doré / Arc-en-ciel / Néon.
---

# Simulator style (chibi.js)
`chibiPet(g, sp, variant)` builds ~18–30 parts: `Body` blob (head+body), `Belly`, `EyeL/R` + `ShineL/R` + `Shine2L/R` (Neon white), `BlushL/R`, `Mouth`, `Nose`, paws `LegFL/FR/BL/BR`, ears by `sp.ears`, `Tail1` by `sp.tail`, species extras (horn, wings, beak, antenna, tentacles, cap, wisps).
Mirroring: `pair(part)` renames trailing `L` → `R` and mirrors x/rot.
Names matter: the rig/animations key on Body/Ear/Leg/Tail/Wing, effects on Body.

## Variants (genre conventions, not copies of a game)
- `gold`: c1 #ffc93c, Metal tint parts, sparkles + glow + outline.
- `rainbow`: rainbow fx + sparkles.
- `neon`: Neon only on accents (ears, tail, paws, wings…), never on Body/Belly (too bright), glow + aura.
`styled()` caches by style+variant+seed+prompt; card names get the variant suffix.

## Adding a plan (bird, octo…)
Add a branch in "species extras"; keep extra parts ≤ 12 and parented by name (HEAD_KIDS regex in anim-core.js decides head children).
