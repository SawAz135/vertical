"""Build skills.json for the 📚 Skills page from .claude/skills (on) and .claude/skills-off (off) (run from the repo root:
python3 roblox-forge/skills/build.py). Only SKILL.md texts are published (no scripts)."""
import json, os, re
BASE = os.path.join(os.path.dirname(__file__), "..", "..", ".claude")
ROOTS = [(os.path.join(BASE, "skills"), True), (os.path.join(BASE, "skills-off"), False)]
SRC = {"sc": "scenario-labs/skills", "gd": "gamedev-skills/awesome-gamedev-agent-skills", "lu": "luumenlabs/luau-skills", "nl": "nonlooped/roblox-suite",
       "af": "afrxo/roblox-agent-skills", "tb": "TabooHarmony/roblox-brain", "mc": "MRCalderon3D/everything-game-dev-code", "jk": "jakuza0ae/roblox-ugc-skill",
       "ag": "msitarzewski/agency-agents", "el": "EL4CTEO/roblox-skills", "eb": "EL4CTEO/blender-skills", "ar": "arjun988/blender-skills", "sp": "sapai5/GameDevAgent",
       "ra": "ra100/blender-claude-plugin", "om": "omer-metin/skills-for-antigravity", "fb": "freshtechbro/claudedesignskills", "sk": "sickn33/agentic-awesome-skills",
       "sh": "stevehalliwell/agent-skills", "rl": "RobLe3/cc-blender-skill"}
def category(name, text):
    n = name.lower()
    if n.startswith("forge-"): return "forge"
    if re.search(r"blender|threejs|gltf|voxel|texture|shader|3d|sculpt|rig|uv|lod|chibi|prop|biome|set-dressing|reference-to|text-to-blender", n): return "3d"
    if re.search(r"roblox|luau|lune|rojo", n): return "roblox"
    return "design"
out = []
entries = sorted((d, root, on) for root, on in ROOTS if os.path.isdir(root) for d in os.listdir(root))
for d, ROOT, enabled in entries:
    p = os.path.join(ROOT, d, "SKILL.md")
    if not os.path.isfile(p): continue
    t = open(p, encoding="utf-8").read()
    m = re.match(r"---\nname: (.+)\ndescription: (.+)\n---\n", t)
    if not m: continue
    body = t[m.end():].strip()
    src = re.search(r"\nSource: (\S+) \(([^,]+),", body)
    pre = d.split("-")[1] if d.startswith("gh-") else None
    out.append({"name": d, "description": m.group(2).strip().strip('"'), "category": category(d, body),
                "source": src.group(1) if src else "Roblox Forge (écrit pour ce projet)", "license": src.group(2) if src else "projet",
                "enabled": enabled, "repo": SRC.get(pre, "SawAz135/vertical") if pre else "SawAz135/vertical", "body": re.sub(r"\n---\nSource: .*$", "", body, flags=re.S)})
json.dump({"count": len(out), "skills": out}, open(os.path.join(os.path.dirname(__file__), "skills.json"), "w", encoding="utf-8"), ensure_ascii=False)
print(len(out), "skills")
