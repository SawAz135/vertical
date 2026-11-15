---
name: roblox-ui-mobile-scaling
description: Use when making Roblox GUIs that work on phones, tablets and PC: Scale vs Offset, aspect ratio constraints, text scaling, safe areas, touch targets.
---

# Mobile-first Roblox UI
- Position/Size in Scale; lock shapes with `UIAspectRatioConstraint` (DominantAxis Height for side menus).
- Text: `TextScaled = true` + `UITextSizeConstraint` (MaxTextSize); avoid TextWrapped on single words.
- ScreenGui `ScreenInsets = DeviceSafeInsets` (Rojo maps legacy IgnoreGuiInset) and keep important buttons out of the notch/home-bar zones.
- Touch targets ≥ 44 px on phones; left/bottom-left is the thumb zone on landscape phones; the jump button sits bottom-right — don't cover it.
- Layout helpers: UIListLayout, UIGridLayout (CellSize scale), UIPadding; ScrollingFrame with `AutomaticCanvasSize = Y`, `CanvasSize = 0`.
- Test in Studio's device emulator: iPhone (landscape), iPad, 1080p.
