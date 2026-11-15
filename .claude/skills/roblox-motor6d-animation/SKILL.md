---
name: roblox-motor6d-animation
description: Use when animating rigs in Roblox with code: Motor6D.Transform, keyframes and easing, client-side animation, blending, pivots.
---

# Code-driven animation
- `Motor6D.Transform` is applied on top of C0/C1 each frame and is not replicated: set it in `RunService.PreSimulation`/`RenderStepped` on each client.
- Pose = offset {position, quaternion} per bone; rotate around a pivot: `CFrame.new(pv) * rot * CFrame.new(-pv)`, then convert to the joint space with the rest CFrame inverse.
- Keyframes with Roblox easing styles (Linear, Sine, Quad, Cubic, Quart, Quint, Back, Elastic, Bounce, Exponential, Circular) and directions In/Out/InOut — same formulas in the editor and the game.
- Blend layers with weights (idle + walk + emote); crossfade over 0.15–0.3 s.
- Use real elapsed time (cap dt ~0.25 s) so animations don't slow down at low FPS.
- AnimationController/Animator with uploaded animations is the alternative when assets exist; it needs an Animation asset id.
