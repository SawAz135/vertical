---
name: roblox-tycoon-obby
description: Use when building tycoon droppers/conveyors or obbies on Roblox (Forge Map roles).
---

# Tycoon and obby building
- Tycoon: plot ownership claimed on touch (server), buttons with price attribute, droppers spawn ore parts with value attribute, conveyor via `AssemblyLinearVelocity` on an anchored belt, collector sums values; save purchased buttons.
- Clean up ore parts (Debris:AddItem 20 s) to stay fast.
- Obby: checkpoints with stage attribute saved to leaderstats, kill bricks (Humanoid.Health = 0 on touch, server), moving platforms with TweenService or PrismaticConstraint, difficulty ramp and rest areas.
- Forge Map Studio has these roles built in (coin, jump pad, kill brick, checkpoint, gate, conveyor, dropper).
