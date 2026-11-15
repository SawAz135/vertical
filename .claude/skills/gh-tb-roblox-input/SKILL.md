---
name: gh-tb-roblox-input
description: "Use when handling Roblox touch, gamepad, keyboard, mouse or motion input, on-screen action buttons, or cross-platform action binding."
---

# Roblox Input

## When to Load

Touch, gamepad, keyboard, mouse or motion input, on-screen action buttons, cross-platform binding. Client-only; Server Authority simulation input uses the Input Action System.

## Quick Reference

- **Events:** `InputBegan/Changed/Ended` give `(input, gameProcessedEvent)`; filter it for gameplay. Wheel fires only `InputChanged`.
- **Bindings:** prefer `ContextActionService:BindAction(name, handler, touchButton, ...keys)`; gate on `state` (touch is `KeyCode.Unknown`); stack order, so `BindActionAtPriority`. Server Authority: `InputAction`/`InputContext` + `RunService:BindToSimulation()` (needs `Workspace.UseFixedSimulation`).
- **Mobile first, hybrid aware:** show controls from `UserInputService.PreferredInput` (`Enum.PreferredInput`), observed with `GetPropertyChangedSignal`, not from `TouchEnabled` cached once.
- **Touch action buttons:** fire only for touches that began on the button; camera drags across it never fire. Place from the measured jump button under `PlayerGui.TouchGui`; clear the thumbstick zone.
- **Gate gameplay:** block attacks while a game window is open, a `TextBox` is focused, `GuiService.MenuIsOpen`, or `GuiService.SelectedObject` is set.
- **Cancel is not release:** holds cancel on window open, `Cancel`, unequip, focus loss, input switch or pad disconnect.
- **Gamepad tools:** default controls bind `ButtonR2` through `BindActivate`; `Tool.ManualActivationOnly = true` disables it. Aim from the screen center on gamepad, not `GetMouseLocation()`.
- **Hints:** `GetStringForKeyCode(key, Enum.KeyCodeStringFormat.Abbreviated)`, `GetImageForKeyCode`, or `InputActionLabel`; never hardcode Xbox names.
- **Test:** Device Simulator + Controller Emulator; menu focus is in `roblox-gui`.

> Details: [references/full.md](references/full.md)


---
Source: https://github.com/TabooHarmony/roblox-brain/tree/HEAD/skills/gameplay/roblox-input (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
