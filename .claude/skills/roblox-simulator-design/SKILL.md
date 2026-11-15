---
name: roblox-simulator-design
description: Use when designing a simulator/tycoon game loop on Roblox: core loop, progression curves, rebirths, eggs, retention features, balancing numbers.
---

# Simulator design
- Core loop: earn (click/auto income) → spend (eggs, upgrades) → stronger (pets/multipliers) → new zones (gates by price) → rebirth (reset for permanent multiplier).
- Curves: costs grow geometric (×2–3 per tier), rewards grow slightly slower so each zone takes longer; rebirth cost `base·growth^n`, bonus `1 + n·step`.
- Pets: power multipliers (+% income), equip slots (3, +2 with pass), inventory cap, sell junk, auto-delete commons.
- Retention: daily streak, daily quests, codes, timed events, limited eggs, leaderboard, index/collection completion rewards.
- Numbers: abbreviate (K M B T Qa); show deltas (+125) with pop-ups.
- Monetization: passes (luck, x2 coins, +equip, triple hatch, auto hatch), products (currency packs). Odds disclosed.
- Balance with Monte Carlo and a spreadsheet of time-to-next-zone.
