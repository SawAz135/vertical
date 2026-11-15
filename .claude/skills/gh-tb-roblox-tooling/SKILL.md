---
name: gh-tb-roblox-tooling
description: "Use when setting up or fixing Roblox tooling: Rojo, Wally, pesde, Selene, StyLua, Lune, Rokit, luau-lsp, tests, or CI/CD."
---

# roblox tooling

## When to Load

Load for filesystem workflows, tool/package pins, linting, sourcemaps, and CI.

## Quick Reference

- Rojo when files own the truth; Wally for manifests+lockfile (explicit realm). Pin tools via the project's manager; new projects lead with Rokit (Aftman archived, reads `aftman.toml`).
- Selene + StyLua check-mode in CI (no silent rewrites); Lune for standalone Luau; Rojo sourcemap for editor tooling.
- CI gates on parsed results and counts, not exit codes; split logic/file/HTTP/engine suites (full.md).

**Source-of-truth first.** Know Studio vs files before editing; never assume sync. `rojo syncback` pulls saved-place edits, not live two-way sync — dry-run first. Don't impose optional tools. TestEZ archived: keep where used.

**Script writes from plugin/MCP** go through `ScriptEditorService:UpdateSourceAsync` (raw `.Source` writes can clobber an open editor) + one `ChangeHistoryService` recording per bounded mutation. Script Sync conflicts resolve as Keep Studio vs Keep Disk — never assume either side wins. See full.md §§1b–1d.

**Details:** `references/full.md` (setup, file layout, CI examples).


---
Source: https://github.com/TabooHarmony/roblox-brain/tree/HEAD/skills/tools/roblox-tooling (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
