---
name: forge-stud-gui
description: Use when making the bright studded 'stud' simulator GUI look (thick black outlines, colourful gradient panels, round font) with the Forge Stud kit.
---

# Stud GUI kit (roblox-forge/gui/stud.js)
Look: saturated two-stop gradients (`COL.yellow/magenta/blue/orange/green/pink/red/purple/teal/grey/navy/wood/sky/rainbow`), black UIStroke 3–4 px on every block, Contextual black stroke on every text, FredokaOne, rounded 8–12 px corners, stud dots on panels.
Helpers: `Blk(name, gradient, props, kids, anim, studSize)`, `Btn(name, text, gradient, props, anim)`, `win(name, title, icon, aspect, content, {title, body, studs, vis})`, `iconBox`.
Templates: stud_hud, stud_daily, stud_shop, stud_store, stud_confirm, stud_gears, stud_index, stud_rebirth, stud_auras (+ "Ajouter le kit Stud complet").

## Studs are real
`anim.studs = px` → attribute `ForgeStuds`; ForgeGuiAnim fills the frame with a UIGridLayout of round Frames (cap 240, refills after AbsoluteSize changes, compensates UIScale). No image upload needed. Preview uses CSS radial gradients (`.gstuds`).

## Layout tips
Windows: aspect ≥ 1.55 on phones so they never overflow vertically. Keep the left menu (StudMenu) and right menus (AuraMenu) on opposite sides.
