---
name: gh-tb-roblox-networking
description: "Use when adding, changing, or auditing RemoteEvents/RemoteFunctions: argument validation, rate limits, server authority, exploit prevention."
---

# roblox networking

## When to Load

Load when adding a remote, handling untrusted input, adding cooldowns, or assigning authority.

## Quick Reference

- Every client argument is attacker-controlled; validate type, size, ownership, state, distance, cooldown on the server.
- Look up prices, damage, rewards, permissions from server-owned definitions.
- Choose the authority model first: Server Authority uses client prediction + server rollback, and is not `SetNetworkOwner`.
- Under Server Authority, simulation input uses `InputAction`/`BindToSimulation()` + `UseFixedSimulation`, not a remote.
- Events for most gameplay requests; keep `RemoteFunction` calls short and bounded.
- `RemoteEvent` for reliable state; not ordered vs property/attribute replication — one explicit channel or version state. `UnreliableRemoteEvent` only for replaceable data; droppable, 1000-byte cap.
- Engine ceiling: each remote type has ~500 FireServer req/s/client, pooled across same-type remotes — a ceiling, not a target.
- Measure payload and fire rate under load; budget rate × bytes × recipients; snapshot on join, diffs after.
- Hit timestamps are untrusted context, never proof. Bound freshness and validate server history; see full.md §3a.
- Typed schemas do not replace security checks. Pin generators and verify generated output in CI.
- Check NaN/infinity first (`x ~= x`, `math.abs(x) == math.huge`): `NaN` defeats `<`/`>`. `utf8.len` catches malformed UTF-8 that fails a DataStore save.
- Serialization: functions arrive `nil`, metatables stripped, mixed keys mangled, `nil` truncates tables, tables are copies — validate field by field, share state via server-owned snapshots/ids.
- Server Authority needs `AuthorityMode = Server` + its bundle; misprediction/rollback are normal (full.md).
- Rate limits protect the server; validation still rejects invalid requests. Bindables are same-side only: tables copied, metatables stripped, `Invoke` yields until `OnInvoke` returns.
- Record suspicion with thresholds; never punish one malformed packet.
- Edit-mode play: wrap the network layer so `RunContext:IsEdit()` gets a loopback mock (full.md).

**Need details?** `references/full.md` has validation, throttling, and mock patterns.


---
Source: https://github.com/TabooHarmony/roblox-brain/tree/HEAD/skills/core/roblox-networking (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
