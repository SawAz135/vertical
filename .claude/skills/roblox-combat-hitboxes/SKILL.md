---
name: roblox-combat-hitboxes
description: Use when adding combat/abilities to Roblox games: server hitboxes, spatial queries, cooldowns, damage validation, effects on clients.
---

# Combat
- Hitboxes on the server: `workspace:GetPartBoundsInBox(cframe, size, OverlapParams)` or `Spherecast`/`Raycast`; whitelist character parts.
- Client plays animation/VFX immediately (feel), server validates range + cooldown and applies damage (`Humanoid:TakeDamage`).
- Cooldowns stored server-side per player per ability; never trust a client damage value.
- Hit feedback: highlight flash, damage numbers (BillboardGui), small camera shake on the attacker.
