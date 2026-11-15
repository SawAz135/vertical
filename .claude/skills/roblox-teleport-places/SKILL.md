---
name: roblox-teleport-places
description: Use when a Roblox experience has several places (lobby, worlds, private servers): TeleportService, TeleportOptions, reserved servers, data hand-off.
---

# Teleporting
- `TeleportService:TeleportAsync(placeId, {players}, options)` from the server, wrapped in pcall with retries; listen to `TeleportInitFailed`.
- Places must belong to the same experience. Reserved/private instance: `ReserveServer(placeId)` → access code in `TeleportOptions.ReservedServerAccessCode`.
- Pass small data with `TeleportOptions:SetTeleportData` (client-visible: never trust it for rewards); real progress lives in DataStores.
- Save player data before teleporting (session lock releases on PlayerRemoving).
- Show a loading GUI with `TeleportService:SetTeleportGui`.
