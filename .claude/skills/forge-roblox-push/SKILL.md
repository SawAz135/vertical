---
name: forge-roblox-push
description: Use when publishing to Roblox from the iPhone via Roblox Push (roblox-push/): kit install, publish, add packs, Luau run, game page meta, Blender jobs, results.
---

# Roblox Push
App `roblox-push/index.html` (GitHub API only) commits an orphan commit to branch `roblox-push` with kit files (`.github/workflows/roblox-push.yml`, `.roblox-push/push.py`, `merge.luau`, `forge_blender.py`) + `request.json` + file; GitHub Actions publishes with the `ROBLOX_API_KEY` secret and writes `.roblox-push/result.json` (+ `renders/`).

## Actions
- publish (.rbxl/.rbxlx/.zip Rojo project; auto project for loose scripts),
- addpack: kept base game + every stored pack rebuilt with Rojo and merged with Lune (`merge.luau`), stored on branch `roblox-push-store`,
- meta: name, description, icon, thumbnails (Image assets),
- luau: Open Cloud Luau execution on the published place,
- blender: ForgeBlender jobs (see forge-blender-robot).
Steps: prepare → stage → (rojo/lune install, cached) → build → blender → merge → publish → store → luau/meta → finish.

## Rules
Never store or echo the Roblox key; it lives only in the GitHub secret. Pack names `safe_pack_name`. Packs are folders named after services. Test locally with a fake API (`ROBLOX_API_BASE`, `ROBLOX_GAMES_BASE`, `RUNNER_TEMP`).
