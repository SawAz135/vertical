---
name: roblox-performance
description: Use when a Roblox game lags or must run on phones: part counts, instance budgets, streaming, scripts per frame, render costs, memory.
---

# Performance checklist
- Part budget: aim < 20–30k visible parts on mobile; merge static decor into MeshParts/unions; anchor everything static.
- `Workspace.StreamingEnabled` for big maps (set StreamingTargetRadius); models that must stay: `ModelStreamingMode = Persistent`.
- CastShadow off on small/decor parts; Neon and transparency are costlier; limit lights with Shadows.
- Scripts: avoid per-frame loops over all instances; cache lists; use events; batch updates; `task.wait()` not `wait()`.
- Clients animate cosmetics (pets, UI, particles) — the server only does logic.
- Measure with the MicroProfiler (Ctrl+F6) and Developer Console (F9): memory, network, scripts.
