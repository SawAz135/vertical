---
name: roblox-rojo-project
description: Use when laying out a Roblox project for Rojo: default.project.json, file naming (.server.lua/.client.lua), folders as services, init files, building .rbxl/.rbxm.
---

# Rojo project layout (Rojo 7)
- `name.server.lua` → Script, `name.client.lua` → LocalScript, `name.lua`/`.luau` → ModuleScript, `init.server.lua` makes the folder itself a Script.
- `*.model.json` → instance tree; `*.meta.json` → properties/attributes for a sibling; `*.txt` → StringValue; `*.csv` → LocalizationTable.
- project tree: `{"name":"Game","tree":{"$className":"DataModel","ReplicatedStorage":{"$path":"src/shared"},"ServerScriptService":{"$path":"src/server"},"StarterPlayer":{"StarterPlayerScripts":{"$path":"src/client"}}}}`.
- Build: `rojo build default.project.json -o game.rbxl` (place) or `-o pack.rbxm` (model).
- `StarterPlayerScripts` lives under `StarterPlayer`; `StarterCharacterScripts` too.
- Rojo 7.7 migrates legacy props: Font → FontFace, IgnoreGuiInset → ScreenInsets, CornerRadius per corner; both forms build.
