#!/usr/bin/env python3
"""Collect Roblox/Luau libraries from GitHub search (throttled), keep only permissive licenses."""
import json, subprocess, time, sys
CATS = {
  "ui": ["roblox ui library", "roblox gui", "luau ui framework", "roblox ui components", "roblox react lua", "roblox fusion ui", "roblox ui animation", "roblox topbar", "roblox notification ui", "roblox inventory ui", "roblox shop ui", "roblox ui kit"],
  "animation": ["roblox tween", "roblox spring", "roblox animation", "luau motion library", "roblox easing", "roblox cframe animation", "roblox procedural animation", "roblox inverse kinematics"],
  "vfx": ["roblox vfx", "roblox particles", "roblox effects", "roblox lightning", "roblox beam effect", "roblox trail", "roblox shockwave", "roblox aura", "roblox screen shake", "roblox camera shake", "roblox post processing"],
  "pets": ["roblox pet", "roblox pet follow", "roblox egg hatching", "roblox gacha", "roblox rng", "roblox loot table", "roblox weighted random"],
  "map": ["roblox terrain generator", "roblox procedural", "roblox map generator", "roblox building", "roblox voxel", "roblox dungeon generator", "roblox maze"],
  "systems": ["roblox datastore", "roblox profile service", "roblox inventory system", "roblox trading system", "roblox leaderboard", "roblox quest system", "roblox combat system", "roblox hitbox", "roblox ability system", "roblox round system", "roblox matchmaking"],
  "network": ["roblox networking", "roblox remote", "luau signal", "roblox replication", "roblox bytenet", "roblox packet"],
  "physics": ["roblox physics", "roblox raycast", "roblox projectile", "roblox vehicle", "roblox ragdoll", "roblox character controller"],
  "camera": ["roblox camera", "roblox cutscene", "roblox cinematic"],
  "audio": ["roblox sound", "roblox music system"],
  "framework": ["roblox framework", "luau framework", "roblox knit", "roblox ecs", "luau ecs", "roblox component"],
  "utility": ["luau utility", "roblox util", "luau promise", "luau maid janitor trove", "luau table utilities", "luau string utilities", "luau math", "luau noise", "luau serialization"],
  "tools": ["rojo", "luau tooling", "roblox open cloud", "roblox studio plugin", "luau lint", "luau test framework"],
}
BAD = ["executor", "exploit", "script hub", "scripthub", "cheat", "hack", "aimbot", "injector", "bypass", "keyless", "synapse", "krnl", "delta executor", "fluxus", "byfron", "autofarm", "auto farm", "dupe", "cookie logger", "grabber", "free robux"]
OK_LIC = {"MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "MPL-2.0", "CC0-1.0", "Unlicense", "Zlib", "ISC", "0BSD", "BSL-1.0"}
out, seen, log = [], set(), []
total = sum(len(v) for v in CATS.values()); n = 0
for cat, queries in CATS.items():
    for q in queries:
        n += 1
        for page in (1, 2):
            for attempt in range(6):
                r = subprocess.run(["gh", "api", "-X", "GET", "search/repositories", "-f", f"q={q}", "-f", "sort=stars", "-f", "per_page=50", "-f", f"page={page}"], capture_output=True, text=True)
                if r.returncode == 0: break
                time.sleep(20 + attempt * 10)
            else:
                log.append(f"FAILED {q} p{page}: {r.stderr[:120]}"); continue
            items = json.loads(r.stdout).get("items", [])
            for it in items:
                name = it["full_name"]; desc = (it.get("description") or "")
                lic = (it.get("license") or {}).get("spdx_id") or "NONE"
                text = (name + " " + desc).lower()
                if name.lower() in seen: continue
                seen.add(name.lower())
                if any(b in text for b in BAD): log.append(f"EXCLUDED-exploit {name}"); continue
                if lic not in OK_LIC: continue
                if it.get("archived"): continue
                out.append({"name": name, "category": cat, "query": q, "license": lic, "stars": it["stargazers_count"], "description": desc[:200],
                            "url": it["html_url"], "language": it.get("language"), "updated": it.get("pushed_at"), "topics": it.get("topics", [])[:8]})
            if len(items) < 50: break
            time.sleep(7)
        time.sleep(7)
        print(f"[{n}/{total}] {cat}: {q} -> kept {len(out)} total", flush=True)
json.dump({"items": out, "log": log}, open("github.json", "w"), indent=1)
print("DONE", len(out))
