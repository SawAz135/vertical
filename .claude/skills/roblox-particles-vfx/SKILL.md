---
name: roblox-particles-vfx
description: Use when making visual effects in Roblox: ParticleEmitter, Beam, Trail, Highlight, PointLight, Neon, auras, flashes, performance limits.
---

# VFX toolbox
- ParticleEmitter: Rate, Lifetime NumberRange, Speed, SpreadAngle, Size/Transparency NumberSequence, Color ColorSequence, LightEmission 1 for glow, `LockedToPart` for auras, `Emit(n)` for bursts. Needs a Texture asset id (built-in rbxasset textures or uploaded images).
- Trail between two Attachments (MinLength, Lifetime, WidthScale); Beam between attachments for lasers/rays (CurveSize, TextureSpeed).
- Highlight: outline/fill on a model (max ~31 visible at once).
- Neon material + PointLight/SurfaceLight for glow; Bloom in Lighting amplifies Neon.
- Budget: few hundred active particles per effect on mobile; disable emitters off-screen; reuse emitters with Emit rather than creating instances.
