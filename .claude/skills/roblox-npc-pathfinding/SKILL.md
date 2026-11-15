---
name: roblox-npc-pathfinding
description: Use when making NPCs or pets navigate in Roblox: PathfindingService, waypoints, agent params, Humanoid:MoveTo, stuck detection.
---

# Pathfinding
- `PathfindingService:CreatePath({AgentRadius=2, AgentHeight=5, AgentCanJump=true, Costs={Water=20}})`, `path:ComputeAsync(from, to)` in pcall, iterate `path:GetWaypoints()`.
- `Humanoid:MoveTo(wp.Position)`; on `wp.Action == Jump` set `Humanoid.Jump = true`; wait `MoveToFinished` with timeout.
- Recompute on `path.Blocked`; detect stuck (no progress 2 s) → jump or recompute.
- Pets usually don't need pathfinding: fly/float with AlignPosition.
