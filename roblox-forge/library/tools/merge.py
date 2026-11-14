#!/usr/bin/env python3
"""Merge GitHub search + Wally index + curated lists into one catalog (permissive licenses only)."""
import json, re, sys, math
from datetime import datetime, timezone
OK = {"MIT", "APACHE-2.0", "BSD-2-CLAUSE", "BSD-3-CLAUSE", "MPL-2.0", "CC0-1.0", "UNLICENSE", "ZLIB", "ISC", "0BSD", "BSL-1.0"}
KEYWORDS = [  # category guess for Wally packages / curated repos (first match wins)
  ("vfx", r"vfx|particle|effect|lightning|beam|trail|shake|aura|explosion|post.?process|bloom|shockwave"),
  ("pets", r"\bpets?\b|egg|gacha|\brng\b|loot|weighted|rarity|hatch"),
  ("animation", r"tween|spring|anim|easing|motion|\bik\b|inverse kinematic|flipper|spr\b"),
  ("ui", r"\bui\b|gui|react|roact|fusion|vide|iris|topbar|hud|button|menu|interface|layout|component library|notification"),
  ("map", r"terrain|procedural|map|voxel|dungeon|maze|biome|chunk|generator"),
  ("physics", r"physic|raycast|projectile|vehicle|ragdoll|character controller|hitbox|collision"),
  ("camera", r"camera|cutscene|cinematic"),
  ("audio", r"\bsound|audio|music"),
  ("network", r"network|remote|signal|replicat|packet|bytenet|bridge|event"),
  ("systems", r"datastore|profile|inventory|trading|leaderboard|quest|combat|ability|round|matchmak|save|data"),
  ("framework", r"framework|knit|\becs\b|component|matter|jecs|flamework"),
  ("tools", r"rojo|lint|test|plugin|open ?cloud|cli|tooling|type"),
]
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
for g in gh:
    items[g["name"].lower()] = {"id": g["name"], "kind": "github", "category": g["category"], "license": g["license"], "stars": g["stars"],
        "description": g["description"], "url": g["url"], "updated": g["updated"], "topics": g.get("topics", []), "curated": False, "wally": None}
for c in curated:
    if c["license"].upper() not in OK: continue
    k = c["name"].lower(); e = items.get(k)
    if e: e["curated"] = True
    else: items[k] = {"id": c["name"], "kind": "github", "category": guess(c["name"] + " " + c["description"]), "license": c["license"], "stars": c["stars"],
                      "description": c["description"], "url": c["url"], "updated": c["updated"], "topics": [], "curated": True, "wally": None}
for w in wally:
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
print("catalog:", len(out), cats)
