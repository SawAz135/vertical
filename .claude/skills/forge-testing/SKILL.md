---
name: forge-testing
description: Use when verifying Roblox Forge changes: Playwright on an emulated iPhone 15, Lune compile checks, Roblox mocks, Rojo builds, merges into a real place, Blender renders.
---

# Verifying Forge work
- Serve: `cd roblox-forge && python3 -m http.server 8794`.
- Playwright: `chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']})`, `devices['iPhone 15']`; set `localStorage['forge.libPrompted']='1'` to skip the library prompt; collect `pageerror` + console errors.
- Suites (scratchpad): `pettest/pt.js`, `studiotest/at.js`, `guitest/gt.js` + `st.js`, `maptest/mt.js`, `systest/ui.js`, `meshy/t.js`.
- Lune: `luau.compile(source)` for syntax; `lune run systest/mock.luau` runs the server against mocked services with virtual time.
- Rojo 7.7.1: `rojo build pack.project.json -o x.rbxm`; merge: `lune run roblox-push/kit/merge.luau base.rbxl out.rbxl a.rbxm b.rbxm`; inspect with `@lune/roblox` `deserializePlace`.
- Screenshots a human sees: deviceScaleFactor 2; for your own checks 1.
Report honestly what was only compiled vs actually run.
