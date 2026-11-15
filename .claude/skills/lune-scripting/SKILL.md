---
name: lune-scripting
description: Use when running Luau outside Roblox with Lune: tests, compiling, reading/writing .rbxl/.rbxm, merging places, mocks.
---

# Lune (0.11)
- `lune run script.luau args…`; `process.args`; `@lune/fs`, `@lune/serde` (json/toml), `@lune/luau` (`compile`, `load(src, {debugName, environment})`), `@lune/roblox` (`deserializePlace/Model`, `serializePlace/Model`, Instance API), `@lune/process`.
- Syntax check: `pcall(luau.compile, source)`.
- Run game code against mocks: `luau.load(src, {environment = env})` with fake `game`, `Instance`, `task` (virtual-time scheduler) — see scratchpad/systest/mock.luau.
- Merge packs into a place: read place, `:Clone()` instances from rbxm into services, serialize.
