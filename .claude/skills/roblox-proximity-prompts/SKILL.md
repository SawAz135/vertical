---
name: roblox-proximity-prompts
description: Use when making interactable objects in Roblox: ProximityPrompt setup, hold durations, multiple prompts, custom styles, server validation.
---

# ProximityPrompt
- Parent to a BasePart or Attachment; `ActionText`, `ObjectText`, `HoldDuration`, `MaxActivationDistance`, `KeyboardKeyCode`, `GamepadKeyCode`, `RequiresLineOfSight`.
- Several prompts on one object: different keys (E, R) and `UIOffset` so they don't overlap.
- `Triggered(player)` runs on the server — still validate cooldowns and state.
- Custom look: `Style = Custom` and build the UI on `PromptShown` on the client.
- Good for eggs, shops, doors, NPC dialogue; works on touch automatically.
