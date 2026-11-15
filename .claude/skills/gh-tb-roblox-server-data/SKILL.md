---
name: gh-tb-roblox-server-data
description: "Use when building or fixing Roblox cross-server data: OrderedDataStore leaderboards, MessagingService, MemoryStore, world state, seasons."
---

# Roblox Server & Shared Data

## When to Load

Load for leaderboards, messaging, MemoryStore coordination, world state, seasons, or guilds. Player persistence: `roblox-data`; Open Cloud: `roblox-cloud`.

## Quick Reference

### OrderedDataStore (Leaderboards)
- Sortable DataStore: string keys (`tostring(UserId)`), integer sort values; `GetSortedAsync` → pages; `BatchGetAsync` multi-key read (missing keys omitted).
- Budget bursts via `GetRequestBudgetForRequestType(OrderedWrite)` (per server: 30 + numPlayers×5 writes/min).
- Leaderboards only, never player saves. Keep `player_<UserId>` a static key substring so RTBF templates match.

### MessagingService (Cross-Server)
- `SubscribeAsync` / `PublishAsync`; no delivery or ordering guarantee — design for idempotency.
- Request/response: `{reqId}` correlation + ack + timeout; no ack ≠ not executed — replay same reqId, don't double-grant.
- Budget broadcast receives, not just sends; limits and polling trade-offs: full.md. <!-- temporal: 2026-10 -->

### GlobalDataStore (Shared State)
- Persistent non-player state (guilds, seasons, counters). Use `UpdateAsync`; never for player session data.

### MemoryStoreService (Temporary Coordination)
- Queues and sorted maps for expiring matchmaking, leases, coordination.
- Remove a read batch only after successful, idempotent processing.
- Sorted-map paging: last item's `{key, sortKey}` = next exclusive bound. Quotas are **game-level** (one shared pool): request units 1000+120×CCU/min, memory 64 KB+1.2 KB/user, value ≤32 KB, TTL 45 days; batch calls bill per item. <!-- temporal: 2026-10 -->

### Cross-Server Patterns
- Register servers with expiring heartbeats; notify via MessagingService.

### User Identity
- Identify users with `player.User` (`User.Id`, `DomainType`, `DomainId`); `UserId` stays valid. Domain IDs are per-experience: key cross-server data on `UserId`.

### Pitfalls
- MessagingService: fire-and-forget, unordered; not for time-critical work
- GlobalDataStore: same rate limits as player DataStores
- Never store Instances; `SetAsync` overwrites — use `UpdateAsync` for shared counters
> Store selection and workflows: [references/full.md](references/full.md)


---
Source: https://github.com/TabooHarmony/roblox-brain/tree/HEAD/skills/core/roblox-server-data (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
