---
name: roblox-camera-cinematics
description: Use when scripting cameras in Roblox: cutscenes, egg-opening zooms, shop views, FOV punches, shakes.
---

# Camera
- `camera.CameraType = Enum.CameraType.Scriptable`, tween `CFrame` and `FieldOfView`; restore `Custom` and the subject afterwards.
- Look at: `CFrame.lookAt(eye, target)`; orbit with angle += dt·speed.
- Shake: add small random offsets for N frames decaying exponentially; keep under ~0.5 stud for comfort.
- FOV punch: 70 → 58 → 70 on reveals; combine with BlurEffect and ColorCorrection tint.
- Respect players: skip button / tap to speed up; never lock the camera for long.
