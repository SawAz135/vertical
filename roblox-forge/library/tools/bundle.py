#!/usr/bin/env python3
"""Roblox Forge - build the offline Library bundle (library/bundle/).

For the best permissively-licensed repositories of catalog.json in the
categories useful inside the studios, this downloads the real Luau code
(raw.githubusercontent.com), the LICENSE and a README excerpt, and writes:
  bundle/index.json              one entry per package (no code)
  bundle/pkg/<owner>__<repo>.json  the package: files + licence + readme
File lists come from GitHub code search (gh api search/code). Only
permissive licences are accepted, test / example folders are skipped, and
packages keep their folder layout so `require(script.Parent.X)` still works.

  python3 tools/bundle.py            # resumable: skips packages already built
"""
import json, os, re, subprocess, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.dirname(HERE)
OUT = os.path.join(LIB, "bundle")
PKG = os.path.join(OUT, "pkg")
ALLOWED = {"mit", "apache-2.0", "bsd-2-clause", "bsd-3-clause", "mpl-2.0", "unlicense", "cc0-1.0", "isc", "0bsd"}
QUOTA = {"animation": 50, "vfx": 35, "map": 35, "pets": 28, "camera": 20, "ui": 35, "systems": 35, "physics": 15, "audio": 8, "framework": 12}
SKIP_DIR = re.compile(r"(^|/)(tests?|specs?|__tests__|examples?|demos?|bench(mark)?s?|docs?|\.github|vendor|node_modules|packages/_|testez|\.lune|\.vscode|plugin)(/|$)", re.I)
CHEAT = re.compile(r"(exploit|executor|aimbot|esp\b|cheat|bypass|injector|synapse|krnl|backdoor|admin ?abuse|serverside)", re.I)
MAX_FILE, MAX_PKG, MAX_FILES = 150_000, 450_000, 60


def gh_search_code(repo):
    for attempt in range(6):
        p = subprocess.run(["gh", "api", "-X", "GET", "search/code", "-f", f"q=repo:{repo} in:path lua", "-f", "per_page=100"], capture_output=True, text=True)
        if p.returncode == 0:
            return [i["path"] for i in json.loads(p.stdout).get("items", [])]
        if "rate limit" in (p.stdout + p.stderr).lower() or "secondary" in (p.stdout + p.stderr).lower():
            time.sleep(20 + attempt * 15)
            continue
        return []
    return []


def raw(repo, branch, path):
    url = f"https://raw.githubusercontent.com/{repo}/{branch}/{path}"
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return r.read()
    except Exception:
        return None


def kind_of(path):
    n = path.lower()
    if n.endswith((".server.lua", ".server.luau")):
        return "Script"
    if n.endswith((".client.lua", ".client.luau")):
        return "LocalScript"
    return "ModuleScript"


def package_root(paths):
    """The folder that holds the library itself (src/, lib/, a folder with init.lua, or the repo root)."""
    inits = sorted([p for p in paths if re.search(r"(^|/)init\.luau?$", p)], key=lambda p: p.count("/"))
    for cand in ("src/", "lib/", "Source/", "source/"):
        if any(p.startswith(cand) for p in paths):
            return cand
    if inits:
        return inits[0].rsplit("init.", 1)[0]
    return ""


def build(item):
    repo = item["id"]
    branch = None
    paths = gh_search_code(repo)
    paths = [p for p in paths if p.lower().endswith((".lua", ".luau")) and not SKIP_DIR.search(p)]
    if not paths:
        return None, "no luau files found by search"
    # default branch: try main then master
    for b in ("main", "master"):
        if raw(repo, b, paths[0]) is not None:
            branch = b
            break
    if not branch:
        return None, "branch not found"
    root = package_root(paths)
    files, total = [], 0
    for p in sorted(paths, key=lambda p: (p.count("/"), p)):
        if len(files) >= MAX_FILES or total > MAX_PKG:
            break
        if root and not p.startswith(root):
            continue
        data = raw(repo, branch, p)
        if not data or len(data) > MAX_FILE:
            continue
        text = data.decode("utf-8", "replace")
        if CHEAT.search(p) or re.search(r"getgenv\(|syn\.request|hookfunction|getrawmetatable", text):
            return None, "rejected: exploit-like code"
        rel = p[len(root):] if root else p
        files.append({"path": rel, "kind": kind_of(rel), "size": len(data), "source": text})
        total += len(data)
    if not files:
        return None, "no usable files"
    lic = None
    for name in ("LICENSE", "LICENSE.md", "LICENSE.txt", "license", "LICENCE", "COPYING"):
        d = raw(repo, branch, name)
        if d:
            lic = d.decode("utf-8", "replace")[:6000]
            break
    readme = None
    for name in ("README.md", "readme.md", "Readme.md", "README.MD"):
        d = raw(repo, branch, name)
        if d:
            readme = d.decode("utf-8", "replace")[:3000]
            break
    pkg_name = re.sub(r"[^\w]", "", repo.split("/")[1]) or "Package"
    return {
        "id": repo, "name": pkg_name, "branch": branch, "root": root, "category": item["category"], "license": item["license"],
        "licenseText": lic, "readme": readme, "stars": item.get("stars", 0), "description": item.get("description") or "",
        "url": item["url"], "files": files, "credit": f"{repo} ({item['license']}) - {item['url']}",
    }, None


def main():
    os.makedirs(PKG, exist_ok=True)
    cat = json.load(open(os.path.join(LIB, "catalog.json")))["items"]
    chosen = []
    for c, n in QUOTA.items():
        items = [i for i in cat if i.get("kind") == "github" and i.get("category") == c and (i.get("license") or "").lower() in ALLOWED and not CHEAT.search(i["id"] + " " + (i.get("description") or ""))]
        items.sort(key=lambda i: -(i.get("score") or 0))
        chosen += items[:n]
    print(f"{len(chosen)} candidate packages", flush=True)
    index_path = os.path.join(OUT, "index.json")
    index = {e["id"]: e for e in json.load(open(index_path))["packages"]} if os.path.exists(index_path) else {}
    for k, item in enumerate(chosen):
        fn = os.path.join(PKG, item["id"].replace("/", "__") + ".json")
        if os.path.exists(fn) or item["id"] in index:
            continue
        pkg, why = build(item)
        if not pkg:
            print(f"[{k + 1}/{len(chosen)}] skip {item['id']}: {why}", flush=True)
            index[item["id"]] = {"id": item["id"], "skip": why}
        else:
            json.dump(pkg, open(fn, "w"), ensure_ascii=False)
            index[item["id"]] = {k2: v for k2, v in pkg.items() if k2 not in ("files", "licenseText", "readme")} | {
                "fileCount": len(pkg["files"]), "bytes": sum(f["size"] for f in pkg["files"]), "file": os.path.basename(fn),
                "kinds": sorted({f["kind"] for f in pkg["files"]}), "summary": (pkg["readme"] or "")[:400]}
            print(f"[{k + 1}/{len(chosen)}] ok {item['id']}: {len(pkg['files'])} files", flush=True)
        json.dump({"v": 1, "built": time.strftime("%Y-%m-%d"), "packages": list(index.values())}, open(index_path, "w"), ensure_ascii=False)
        time.sleep(6.5)  # code search is limited to ~10 requests per minute
    ok = [e for e in index.values() if not e.get("skip")]
    print(f"done: {len(ok)} packages, {sum(e['fileCount'] for e in ok)} files, {sum(e['bytes'] for e in ok) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
