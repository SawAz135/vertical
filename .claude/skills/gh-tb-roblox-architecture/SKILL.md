---
name: gh-tb-roblox-architecture
description: "Use when adding, moving, refactoring, or reviewing Roblox feature ownership, code layout, dependencies, startup, or client-server boundaries."
---

# Roblox Architecture

## When to Load

Load for ownership, integration, boundaries, startup, or module splits.

## Quick Reference

Reuse proven project modules before rebuilding; inspect contracts and failure/cleanup paths. Integration workflow: full.md.

### Start from one owner

For each behavior, name:

- authoritative state and who may mutate it;
- public operations and callers;
- Roblox instances, connections, and tasks it owns;
- persistence or network boundary;
- startup and teardown conditions.

Group by feature when that keeps one change together. Split server, client, and shared code only where the runtime boundary requires it. Shared code has no secrets or authoritative mutable state.

### Use the smallest dependency shape

Direct module calls are the default. Use a signal only when one publisher has genuinely independent observers. Do not add an event bus, dependency container, manager class, or `Init`/`Start` ceremony to hide an ordinary dependency.

Keep module top-level work cheap and non-yielding. A small bootstrap owns startup that needs ordering; call it sequentially and fail visibly. Concurrency must be explicit and safe, not automatic `task.spawn` everywhere.

Bound `WaitForChild` when a dependency arrives through replication; an unbounded wait turns a missing instance into a silent hang.

### Enforce runtime authority

The client presents and predicts; the server validates and decides. Remotes are APIs with types, bounds, ownership, abuse controls, and failure behavior. Route details to `roblox-networking` and `roblox-security`.

### Split only for evidence

Split when there is a separate lifecycle or authority boundary, a distinct persistence contract, an independently testable pure core, or unrelated reasons to change.

### Data-oriented alternative: only on evidence

An ECS earns its cost only when many similar entities update every frame by order-independent logic, or cross-cutting queries replace tangled per-entity scripts; hooks enforce invariants, ordered systems decide. Version-specific pitfalls: full.md "ECS on Roblox".

### Review

One canonical owner per mutation, no hidden startup yield or replicated trust decision, explicit cleanup, smallest traceable structure. Tags are discovery, attributes configuration, one owner for attach/remove cleanup.

> Details: [references/full.md](references/full.md)


---
Source: https://github.com/TabooHarmony/roblox-brain/tree/HEAD/skills/core/roblox-architecture (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
