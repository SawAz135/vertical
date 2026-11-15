---
name: forge-systems
description: Use when changing game systems (eggs, odds, pity, economy, rebirth, daily, quests, codes, gamepasses, products, saving) in Forge Systems Studio (roblox-forge/systems).
---

# Forge Systems
Twin logic: `systems/sys-core.js` (studio) == `systems/kit/ForgeLogic.lua` (game). Any rule change must be made in BOTH and re-verified:
`cd scratchpad/systest && node parity.mjs && lune run tests.luau <ForgeLogic.lua>` (49 tests, 9 000-draw hatch parity).

## Runtime
- `ForgeSystems.server.lua`: DataStore with session lock (`UpdateAsync`, lock {job,t}, expire = autosave·3+60), retries with backoff, autosave, release on leave, BindToClose; never re-lock after release (`s.released`). leaderstats, one validated rate-limited `RemoteFunction Request` (hatch near egg, equip, sell, sellAll, rebirth, daily, claimQuest, redeem), ProcessReceipt idempotent by PurchaseId and saved before Granted, gamepass perks, OrderedDataStore board, egg stands with ProximityPrompt (E / R ×3).
- `ForgeSystems.client.lua`: casino hatch cinematic, built-in panel (pets/quests/daily/codes/rebirth), wiring of GUI Studio windows by name.
Server mock test: `lune run scratchpad/systest/mock.luau` (29 checks: lock, kick, stale lock, receipts, income, BindToClose).

## Pack
`ReplicatedStorage/ForgeSystems/{Config,Logic}.lua`, `ServerScriptService/ForgeSystems.server.lua`, `StarterPlayerScripts/ForgeSystems.client.lua`. Ids of 0 = not configured (nothing sold).
