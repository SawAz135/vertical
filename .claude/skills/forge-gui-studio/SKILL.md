---
name: forge-gui-studio
description: Use when building or editing Roblox GUIs with Forge GUI Studio (roblox-forge/gui): templates, themes, Forge attributes, preview renderer, export.
---

# Forge GUI Studio
Files: `gui-core.js` (schema, themes, render, toModel), `templates.js`, `stud.js`, `app.js`, `kit/ForgeGuiAnim.client.lua`.
Nodes: `{id, cls, name, props, children, anim}`; colours can be theme tokens (`$panel $panel2 $primary $primary2 $accent $text $muted $good $bad $stroke`), font `$font`.

## Behaviour attributes (exported from `anim`)
`ForgeOpen` (pop|zoom|slideUp|…), `ForgeWindow`, `ForgeDur`, `ForgeHover` (grow|lift|glow), `ForgePress` (squish|bounce), `ForgeIdle` (pulse|float|spin|wiggle|shine|rainbow) + `ForgePeriod`, `ForgeAction` (toggle + `ForgeTarget`, close, switch, roll + `ForgeRollItems`), `ForgeBind`/`ForgeFormat` (leaderstats), `ForgeStuds` (stud dots size). ScreenGui needs `ForgeGui = true`.
Actions are read at click time, so other scripts can override with `SetAttribute("ForgeAction","system")` (Forge Systems does this).

## Rules
- Size with Scale + UIAspectRatioConstraint; TextScaled + UITextSizeConstraint.
- A UIGradient tints a button's own text: put text in a child `Label` (helper `B()`).
- Window names are the link targets (`Shop`, `Daily`, `Inventory`, `EggOpen`, `Quests`, `Confirm`, `Index`, `Rebirth`, `Gears`, `Store`, `Auras`).
Tests: `scratchpad/guitest/gt.js` and `st.js`.
