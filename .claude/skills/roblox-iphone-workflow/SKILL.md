---
name: roblox-iphone-workflow
description: Use when the user works only from an iPhone (no PC) on Roblox: which Forge tools to use, publishing without Studio, limits.
---

# iPhone-only workflow ($0)
1. Make content in the browser studios (GitHub Pages): Pet Studio, GUI Studio, Map Studio, Systems Studio (all mobile-first, save in the browser).
2. "🎮 Ajouter à mon jeu" → Roblox Push → GitHub Actions publishes with the user's Roblox key (stored only as a GitHub secret).
3. Blender, Rojo and Lune run on the free GitHub runner; results (renders, versions) come back in the app.
Limits: no Roblox Studio on iPhone (no live play-testing of server scripts from the phone; test in the Roblox app after publishing); Roblox Studio MCP and Blender MCP need a computer; paid APIs (Meshy API) are avoided — use free web plans and import files.
