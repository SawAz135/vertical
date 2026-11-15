---
name: roblox-tweens-ui-animation
description: Use when animating Roblox GUIs: TweenService, UIScale pop-ins, shakes, idle pulses, hover/press feedback, cinematic reveals.
---

# UI animation
- `TweenService:Create(obj, TweenInfo.new(t, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {Size=…}):Play()`.
- Scale with a `UIScale` child (pop: 0.3 → 1 Back Out) instead of tweening Size (keeps layouts stable).
- Shake: short alternating Position/Rotation tweens with growing amplitude; screen flash: full-screen Frame transparency 0 → 1.
- Hover = 1.06 scale, press = 0.9 then Back to 1. Idle pulse via sin(t) in RenderStepped for many objects (cheaper than chained tweens).
- Rarity reveal: dim background, blur (`BlurEffect` in Lighting), FOV punch on the camera, rays (rotating thin frames), stars, rarity text scale 2.2 → 1.
- Always restore camera FOV/blur and destroy temporary GUIs; queue overlapping cinematics.
