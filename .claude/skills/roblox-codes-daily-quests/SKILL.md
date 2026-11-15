---
name: roblox-codes-daily-quests
description: Use when adding redeem codes, daily rewards with streaks, or daily quests to a Roblox game.
---

# Codes, daily, quests
- Codes: normalise (`upper`, strip spaces), store used codes per player, optional expiry timestamp; rate-limit attempts (2 s) and cap length (40).
- Daily: `day = floor(os.time()/86400)` (UTC); claim if `last ~= day`; streak continues if `last == day-1` else resets to 1; reward index `((streak-1) % #rewards)+1`.
- Quests: reset when the stored day changes; progress per quest type (hatch, collect, playtime minutes, rebirth); claim only when progress ≥ target and not claimed — all checked on the server.
- UI: show next reward, a red dot when claimable, countdown to UTC midnight.
