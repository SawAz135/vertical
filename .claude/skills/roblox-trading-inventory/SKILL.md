---
name: roblox-trading-inventory
description: Use when designing pet inventories and trading in Roblox: data shape, unique ids, safe two-sided trades, duplication protection.
---

# Inventory and trading
- Store pets as a dictionary `uid -> {id, eq, shiny…}` with a monotonic `nextUid`; never index by array position.
- Trades: server holds a trade session (both offers), both confirm, then ONE atomic step moves items; re-validate ownership at commit; cancel on leave.
- Duplication protection: session-locked DataStores, save both players right after a trade, log trades.
- Rate-limit trade requests; filter any trade notes.
