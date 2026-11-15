---
name: roblox-lighting-atmosphere
description: Use when setting the mood of a Roblox map: Lighting technology, Atmosphere, Sky, Bloom, ColorCorrection, SunRays, day/night.
---

# Lighting recipes
- `Lighting.Technology = Future` (best, heavier) or ShadowMap; `Brightness 2–3`, `ClockTime`, `GeographicLatitude`.
- Atmosphere: Density 0.25–0.4, Haze 0–2, Color/Decay tinted to the theme; too dense = washed white screen.
- Post: BloomEffect (Intensity 0.5–1, Threshold ≥ 0.9), ColorCorrection (Saturation +0.1, Contrast +0.05, TintColor), SunRaysEffect (0.05–0.2), DepthOfField for menus.
- Day/night: tween `ClockTime`; switch street lights by attribute.
- Themes: candy (pastel sky, high saturation), lava (orange Atmosphere, dark ambient), ice (blue decay, bright), night neon (ClockTime 0, Bloom up).
