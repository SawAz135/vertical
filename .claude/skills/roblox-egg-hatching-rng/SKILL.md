---
name: roblox-egg-hatching-rng
description: Use when designing egg/gacha hatching: weights, odds display '1 in N', luck multipliers, pity, Monte Carlo checks, server-side randomness.
---

# Egg hatching / RNG
- Weights per pet; probability = w / Σw. Display `1 sur round(1/p)` and % with adaptive precision.
- Luck multiplies the weights of "lucky" rarities only, then renormalise (luck 2 ≠ double chance for every pet).
- Pity: after N hatches without tier ≥ T, the next roll draws only from tier ≥ T; reset when such a pet drops.
- Randomness on the server (`Random.new()`), pure logic functions take `r` in [0,1) so they are testable and can be mirrored in JS.
- Verify with Monte Carlo (≥ 100 000 draws) that observed ≈ expected and pity triggers as designed.
- Triple hatch = 3 independent draws with pity updated between them.
- Show odds at the stand (BillboardGui) and in the shop; required for Robux-paid randomness.
