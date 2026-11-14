#!/usr/bin/env python3
"""Merge GitHub search + Wally index + curated lists into one catalog (permissive licenses only)."""
import json, re, sys, math
from datetime import datetime, timezone
OK = {"MIT", "APACHE-2.0", "BSD-2-CLAUSE", "BSD-3-CLAUSE", "MPL-2.0", "CC0-1.0", "UNLICENSE", "ZLIB", "ISC", "0BSD", "BSL-1.0"}
KEYWORDS = [  # category guess from a project's own name/description/topics (first match wins)
  ("tools", r"\b(ai|mcp|claude|gpt|llm|agent|skills?|lint|linter|test(ing)?|plugin|rojo|cli|tooling|types?|language server|formatter|open ?cloud|deploy)\b"),
  ("network", r"\b(network(ing)?|remotes?|signals?|replicat\w*|packets?|bytenet|bridge|rpc|serializ\w*|buffer)\b"),
  ("framework", r"\b(framework|knit|ecs|entity component|matter|jecs|flamework|dependency injection)\b"),
  ("ui", r"\b(ui|gui|react|roact|fusion|vide|iris|topbar|hud|buttons?|menus?|interfaces?|layout|widgets?|notifications?|themes?|design system)\b"),
  ("vfx", r"\b(vfx|particles?|effects?|beams?|trails?|auras?|explosions?|bloom|shockwaves?|lightning bolts?|screen shake|camera shake|post.?process\w*|portals?)\b"),
  ("pets", r"\b(pets?|eggs?|gacha|rng|loot|weighted|rarity|hatch\w*|crates?|lootbox)\b"),
  ("animation", r"\b(tweens?|tweening|springs?|animat\w*|easing|motion|ik|inverse kinematics|flipper|spr)\b"),
  ("map", r"\b(terrain|procedural|maps?|voxels?|dungeons?|maze|biomes?|chunks?|world gen\w*|building system)\b"),
  ("physics", r"\b(physics|raycast\w*|projectiles?|vehicles?|ragdolls?|character controller|hitbox\w*|collisions?)\b"),
  ("camera", r"\b(camera|cutscenes?|cinematic\w*)\b"),
  ("audio", r"\b(sounds?|audio|music)\b"),
  ("systems", r"\b(datastores?|profiles?|inventory|trading|leaderboards?|quests?|combat|abilit\w*|rounds?|matchmak\w*|saves?|admin|economy|shop)\b"),
]
CHEAT = re.compile(r"(executor|exploit|script ?hub|cheat|hack|aimbot|aim ?lock|silent ?aim|injector|bypass|keyless|loadstring|autofarm|auto ?farm|auto ?player|"
  r"autoplayer|macro|kill ?aura|range ?aura|\besp\b|wallhack|noclip|no ?clip|fly ?script|god ?mode|speed ?hack|infinite ?yield|dex ?explorer|remote ?spy|"
  r"hitbox ?expander|skin ?changer|dupe|free ?robux|robux ?gen|cookie|grabber|logger|scam|fps[ _-]?(booster|unlocker)|asset[ _-]?replacer|desktop|installer|launcher|\\.exe\\b|crack|free download|"
  r"(adopt[ _-]?me|prison[ _-]?life|mm2|murder[ _-]?mystery|blox[ _-]?fruits?|pet[ _-]?simulator|da[ _-]?hood|arsenal|bedwars|brookhaven|doors|jailbreak|bee[ _-]?swarm|anime[ _-]?adventures|grow[ _-]?a[ _-]?garden|steal[ _-]?a[ _-]?brainrot|99[ _-]?nights|forsaken|rivals|blade[ _-]?ball|tower[ _-]?defense[ _-]?simulator)[ _-]?(script|hub|gui|auto|item|value|trade))", re.I)
ROBLOXY = re.compile(r"roblox|luau|\brbx|rojo|wally|roact|\bknit\b|studio plugin|open ?cloud", re.I)
def guess(text):
    t = text.lower()
    for cat, rx in KEYWORDS:
        if re.search(rx, t): return cat
    return "utility"
def repo_of(url):
    m = re.search(r"github\.com/([^/\s]+/[^/\s#?]+)", url or "")
    return m.group(1).removesuffix(".git").lower() if m else None
gh = json.load(open("github.json"))["items"] if len(sys.argv) < 2 else json.load(open(sys.argv[1]))["items"]
wally = json.load(open("wally.json")); curated = json.load(open("awesome.json"))
items = {}
dropped = {"cheat": 0, "not_roblox": 0}
for g in gh:
    text = g["name"] + " " + g["description"] + " " + " ".join(g.get("topics", []))
    if CHEAT.search(text): dropped["cheat"] += 1; continue
    if g.get("language") != "Luau" and not ROBLOXY.search(text): dropped["not_roblox"] += 1; continue
    cat = guess(text)
    if cat == "utility" and g["category"] != "utility": cat = g["category"]
    items[g["name"].lower()] = {"id": g["name"], "kind": "github", "category": cat, "license": g["license"], "stars": g["stars"],
        "description": g["description"], "url": g["url"], "updated": g["updated"], "topics": g.get("topics", []), "curated": False, "wally": None}
for c in curated:
    if c["license"].upper() not in OK: continue
    k = c["name"].lower(); e = items.get(k)
    if e: e["curated"] = True
    else: items[k] = {"id": c["name"], "kind": "github", "category": guess(c["name"] + " " + c["description"]), "license": c["license"], "stars": c["stars"],
                      "description": c["description"], "url": c["url"], "updated": c["updated"], "topics": [], "curated": True, "wally": None}
for w in wally:
    if CHEAT.search(w["name"] + " " + (w["description"] or "")): dropped["cheat"] += 1; continue
    r = repo_of(w.get("repository")); e = items.get(r) if r else None
    if e: e["wally"] = w["install"]; continue
    items["wally:" + w["name"]] = {"id": w["name"], "kind": "wally", "category": guess(w["name"] + " " + (w["description"] or "")), "license": w["license"], "stars": 0,
        "description": w["description"] or "", "url": w.get("repository") or f"https://wally.run/package/{w['name']}", "updated": None, "topics": [], "curated": False, "wally": w["install"]}
now = datetime.now(timezone.utc)
def score(e):
    s = math.log10(1 + e["stars"]) * 10 + (15 if e["curated"] else 0) + (4 if e["wally"] else 0)
    if e["updated"]:
        age = (now - datetime.fromisoformat(e["updated"].replace("Z", "+00:00"))).days
        s += 6 if age < 365 else 2 if age < 3 * 365 else -4
    if not e["description"]: s -= 3
    return round(s, 1)
out = sorted(items.values(), key=lambda e: -score(e))
for e in out: e["score"] = score(e)
cats = {}
for e in out: cats[e["category"]] = cats.get(e["category"], 0) + 1
json.dump({"generated": now.isoformat(), "count": len(out), "categories": cats, "sources": {"github": len(gh), "wally": len(wally), "curated": len(curated)}, "items": out},
          open(sys.argv[2] if len(sys.argv) > 2 else "/home/user/vertical/roblox-forge/library/catalog.json", "w"), separators=(",", ":"))
print("catalog:", len(out), cats, "dropped:", dropped)
