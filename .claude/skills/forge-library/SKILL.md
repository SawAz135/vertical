---
name: forge-library
description: Use when adding open-source Roblox scripts to the Forge Library (roblox-forge/library): catalog, bundle extraction, licences, install into packs.
---

# Forge Library
`library/catalog.json` → `library/tools/bundle.py` (gh code search + raw.githubusercontent.com) → `bundle/index.json` + `bundle/pkg/<owner>__<repo>.json` (116 packages, 1 656 Luau files). Browser cache: IndexedDB `forge-library`.
`forge-lib.js` `createLibrary({studio})` → `render`, `packFiles()` → `ReplicatedStorage/ForgeLibrary/<Name>/…` + LICENSE.txt + CREDITS.txt; kinds: ModuleScript → ReplicatedStorage, LocalScript → StarterPlayerScripts, Script → ServerScriptService.

## Rules
- Only permissive licences (`ALLOWED`: MIT, Apache-2.0, BSD, MPL, Zlib, Unlicense, CC0…); keep LICENSE and credits.
- Refuse exploit/cheat patterns (`CHEAT` filter) and skip build/test folders (`SKIP_DIR`).
- Every file must compile: `lune run scratchpad/bundlecheck.luau`.
- api.github.com and codeload may be blocked from containers; raw.githubusercontent.com works.
