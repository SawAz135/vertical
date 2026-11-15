---
name: roblox-collision-physics
description: Use when tuning Roblox physics: collision groups, CanCollide/CanQuery/CanTouch, network ownership, constraints, anchoring, stopping exploits.
---

# Physics
- CollisionGroups via `PhysicsService:RegisterCollisionGroup` + `CollisionGroupSetCollidable`; assign `part.CollisionGroup = "Pets"`.
- Decorative/cosmetic parts: CanCollide=false, CanQuery=false, CanTouch=false, Massless=true.
- Network ownership: server-owned for anything with gameplay authority; `SetNetworkOwner(player)` only for things that player controls.
- Constraints over BodyMovers: AlignPosition, AlignOrientation, LinearVelocity, AngularVelocity, HingeConstraint, PrismaticConstraint.
- Touched events fire on the server for client-owned parts: validate (distance, cooldown) before rewarding.
