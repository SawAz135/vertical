# Roblox project without Roblox Studio

This repository is a Roblox game built entirely from code. There is no Roblox
Studio anywhere in the workflow: the owner works from an iPhone through Claude
Code on the web. Never tell the user to "open Studio" or click in Studio.

## Layout
- `default.project.json` - Rojo project: maps folders to the Roblox tree.
- `src/shared/` -> ReplicatedStorage.Shared (ModuleScripts, shared config)
- `src/modules/` -> ServerStorage.Modules (server-only ModuleScripts)
- `src/server/` -> ServerScriptService.Server (`*.server.luau` = Script)
- `src/client/` -> StarterPlayer.StarterPlayerScripts.Client (`*.client.luau` = LocalScript)
- `tests/smoke.luau` - runs on Roblox servers (Open Cloud Luau Execution) AND offline under Lune.
- `tests/lune/run.luau` - offline tests against the built place file.
- `tools/roblox_cloud.py` - publish a place / run Luau on Roblox servers (needs env vars, see file).
- `tools/preview/` - renders PNG previews of the course with three.js.

## Rules
- Build all geometry, GUIs and effects in Luau code. Put geometry in ModuleScripts that only use
  Instance.new / datatypes (no services) so they run under Lune and in cloud tests.
- Read part positions as `part.CFrame.Position` in code that tests run (Lune cannot read `.Position`).
- Behaviour is attached on the server from attributes (`Kind`, `Stage`, ...), see MapBuilder.luau.
- Never put an API key in a file, commit, log or chat. It lives only in `ROBLOX_API_KEY`
  (GitHub Actions secret or the session's credential store).

## Before every commit (all must pass)
```bash
mkdir -p build
rojo build default.project.json -o build/place.rbxl
selene src tests                      # needs `selene generate-roblox-std` once, or CI does it
lune run tests/lune/run.luau build/place.rbxl
```
Optional preview: `lune run tools/preview/export.luau build/place.rbxl build/course.json && node tools/preview/render.mjs build/course.json build/preview`
(first `cd tools/preview && npm ci`). Send the PNGs to the user so they can see changes on their phone.

Tools: `cargo install rojo --version 7.7.1 --locked`, `selene --version 0.31.0`, `lune --version 0.11.1`.

## Publishing
Pushing to `main` makes GitHub Actions build, test, publish and run `tests/smoke.luau` on Roblox
(when the `ROBLOX_API_KEY` secret and `ROBLOX_UNIVERSE_ID` / `ROBLOX_PLACE_ID` variables are set).
The user then plays the result in the Roblox iPhone app. In-game errors: type `/console` in chat.
