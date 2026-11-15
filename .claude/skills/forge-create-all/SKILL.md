---
name: forge-create-all
description: Use when working on Roblox Forge « Créer tout » (roblox-forge/create): one sentence → complete working game (map, ForgeGame scripts, GUI buttons, save), and edits like « ajoute un bouton +5 vitesse ».
---
# Créer tout

- `create/game-spec.js`: sentence (FR/EN) → spec. `applyText(text, prev)` creates or edits (« ajoute… », « enlève… »).
  Understands: genre, theme, stats (force, vitesse, magie…), money (coins, gems), buttons (« bouton +1 force », vendre, rebirth, boutique, œuf, spawn, x2),
  shop (named items → upgrades: perClick, mult, sellMult, capacity, speed), sell, rebirth, eggs/pets, N zones, daily, codes, gamepass ×2, auto-train.
- `configOf(spec)` → `ReplicatedStorage/ForgeGame/Config.lua`.
- `create/game-pack.js`: `buildMap` (Map Studio generator, voxel by default, + `padsFor`: Sell/Shop/Egg/Rebirth/Train pads with attribute ForgeGameZone),
  `packFiles`/`buildPack` (DEFLATE zip: a voxel map JSON 3.5 MB → ~100 KB).
- `create/kit/ForgeGame.server.lua`: server-authoritative engine (RemoteFunction Action, per-action rate limits, leaderstats shared with ForgeMap, DataStore with session lock, pads, tool).
- `create/kit/ForgeGame.client.lua`: GUI built from the config (counters, every button, shop, rebirth, eggs, codes, toasts, UIScale phone/PC, keys E/Q).
- Tests: Lune Roblox mock (30 checks: train, rate limit, buttons, sell, shop, pads, rebirth, eggs, daily, codes, save/rejoin, session lock), Playwright on iPhone 15 + PC, Rojo build + merge.
