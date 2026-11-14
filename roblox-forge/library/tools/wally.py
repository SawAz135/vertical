import json, os, re
BAD = ["executor", "exploit", "script hub", "cheat", "hack", "aimbot", "injector", "bypass", "autofarm", "dupe", "free robux"]
OK = {"MIT", "APACHE-2.0", "BSD-2-CLAUSE", "BSD-3-CLAUSE", "MPL-2.0", "CC0-1.0", "UNLICENSE", "ZLIB", "ISC", "0BSD", "BSL-1.0"}
def vkey(v):
    return [int(x) if x.isdigit() else -1 for x in re.split(r"[.\-+]", v)]
out, total, nolic = [], 0, 0
for scope in sorted(os.listdir("wally-index")):
    d = os.path.join("wally-index", scope)
    if scope.startswith(".") or not os.path.isdir(d): continue
    for pkg in os.listdir(d):
        lines = [l for l in open(os.path.join(d, pkg), encoding="utf-8", errors="replace").read().splitlines() if l.strip()]
        entries = []
        for l in lines:
            try: entries.append(json.loads(l)["package"])
            except Exception: pass
        if not entries: continue
        total += 1
        p = max(entries, key=lambda e: vkey(e.get("version", "0")))
        lic = (p.get("license") or "").strip()
        desc = (p.get("description") or "")
        if any(b in (p["name"] + " " + desc).lower() for b in BAD): continue
        if lic.upper() not in OK: nolic += 1; continue
        out.append({"name": p["name"], "version": p["version"], "license": lic, "realm": p.get("realm"), "description": desc[:200],
                    "repository": p.get("repository"), "versions": len(entries), "install": f'{p["name"].split("/")[1]} = "{p["name"]}@{p["version"]}"'})
json.dump(out, open("wally.json", "w"), indent=1)
print("wally packages:", total, "kept (permissive license):", len(out), "dropped (no/other license):", nolic)
