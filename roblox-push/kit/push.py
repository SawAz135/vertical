#!/usr/bin/env python3
"""Roblox Push - server side (runs inside GitHub Actions, never in the browser).

The Roblox Push web app commits two files to the `roblox-push` branch:
  .roblox-push/request.json   what to do (ids, version type, optional Luau)
  .roblox-push/<file>         the game: .rbxl, .rbxlx or .zip

and this script, driven by .github/workflows/roblox-push.yml, does the work:
  prepare  -> read + validate the request, unpack a .zip, decide if Rojo is needed
  build    -> rojo build (only for Rojo projects)
  publish  -> upload the place to Roblox Open Cloud
  luau     -> optionally run a Luau script on Roblox servers against the new version
  finish   -> write .roblox-push/result.json (read back by the web app)

The Roblox key comes only from the ROBLOX_API_KEY secret. It is never printed,
written to disk or put in result.json. Only the Python standard library is used.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(".roblox-push")
REQUEST = ROOT / "request.json"
STATE = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "roblox-push-state.json"
RESULT = ROOT / "result.json"
WORK = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "roblox-push-work"
API = os.environ.get("ROBLOX_API_BASE", "https://apis.roblox.com").rstrip("/")
MAX_ZIP_FILES = 20000
MAX_UNZIPPED = 1024 * 1024 * 1024  # 1 GB


class PushError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


# ---------------------------------------------------------------- state ----
def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"steps": {}}


def save_state(state: dict) -> None:
    STATE.write_text(json.dumps(state))


def output(name: str, value: str) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(f"{name}={value}\n")


def step(state: dict, name: str, ok: bool, detail: str = "") -> None:
    state["steps"][name] = {"ok": ok, "detail": detail[:2000]}
    save_state(state)


# ------------------------------------------------------------------ http ---
def roblox(method: str, url: str, body: bytes | None = None, content_type: str | None = None) -> dict:
    key = os.environ.get("ROBLOX_API_KEY", "").strip()
    if not key:
        raise PushError("NO_KEY", "The ROBLOX_API_KEY secret is missing in this repository.")
    headers = {"x-api-key": key, "Accept": "application/json"}
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    last = ""
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                raw = resp.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as err:
            detail = err.read().decode("utf-8", "replace")[:1500]
            if err.code == 429 or err.code >= 500:
                last = f"HTTP {err.code}: {detail}"
                time.sleep(2 ** attempt)
                continue
            code = {401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 413: "TOO_LARGE"}.get(err.code, f"HTTP_{err.code}")
            raise PushError(code, f"HTTP {err.code}: {detail}") from None
        except urllib.error.URLError as err:
            last = f"network: {err.reason}"
            time.sleep(2 ** attempt)
    raise PushError("UNREACHABLE", f"Roblox did not answer after 5 attempts ({last})")


GAMES_API = os.environ.get("ROBLOX_GAMES_BASE", "https://games.roblox.com").rstrip("/")


def lookup_name(universe: str) -> str | None:
    """Best effort: the experience's public name, shown on the app's game tiles."""
    try:
        url = f"{GAMES_API}/v1/games?universeIds={universe}"
        with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=20) as resp:
            data = json.loads(resp.read()).get("data") or []
        return (data[0].get("name") or None) if data else None
    except Exception:  # never fail a publish because of a display name
        return None


def lookup_universe(place: str) -> str:
    """Public Roblox endpoint (no key): which experience a place belongs to."""
    url = f"{API}/universes/v1/places/{place}/universe"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=60) as resp:
            universe = json.loads(resp.read()).get("universeId")
    except (urllib.error.URLError, json.JSONDecodeError) as err:
        raise PushError("BAD_IDS", f"Could not find the experience of place {place}: {err}") from None
    if not universe:
        raise PushError("BAD_IDS", f"Place {place} does not exist or is not visible.")
    return str(universe)


# --------------------------------------------------------------- prepare ---
def safe_extract(archive: Path, target: Path) -> None:
    """Unzip without letting entries escape the target folder (zip-slip) or explode in size."""
    target.mkdir(parents=True, exist_ok=True)
    root = target.resolve()
    total = 0
    with zipfile.ZipFile(archive) as zf:
        infos = zf.infolist()
        if len(infos) > MAX_ZIP_FILES:
            raise PushError("BAD_ZIP", f"The zip has {len(infos)} files (limit {MAX_ZIP_FILES}).")
        for info in infos:
            name = info.filename.replace("\\", "/")
            if name.startswith("__MACOSX/") or name.endswith("/.DS_Store") or name == ".DS_Store":
                continue
            dest = (root / name).resolve()
            if root not in dest.parents and dest != root:
                raise PushError("BAD_ZIP", f"Unsafe path in zip: {info.filename}")
            total += info.file_size
            if total > MAX_UNZIPPED:
                raise PushError("BAD_ZIP", "The zip unpacks to more than 1 GB.")
            if info.is_dir():
                dest.mkdir(parents=True, exist_ok=True)
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src, open(dest, "wb") as out:
                shutil.copyfileobj(src, out)


# ------------------------------------------------- automatic Rojo project ---
# When a zip only has script files (no default.project.json, no place file), we
# build a Rojo project for it. This works for any game laid out the usual ways:
#   * folders named after Roblox services (ServerScriptService, ReplicatedStorage...)
#   * the Rojo template (src/server, src/client, src/shared)
#   * loose files (Main.server.lua, Hud.client.lua, Utils.lua, Map.rbxm)
SCRIPT_EXT = (".lua", ".luau")
SERVICES = {s.lower(): s for s in (
    "Workspace", "ReplicatedStorage", "ReplicatedFirst", "ServerScriptService", "ServerStorage",
    "StarterGui", "StarterPack", "StarterPlayer", "Lighting", "SoundService", "Teams", "Chat",
    "TextChatService", "MaterialService", "LocalizationService")}
PLAYER_CONTAINERS = {"starterplayerscripts": "StarterPlayerScripts", "startercharacterscripts": "StarterCharacterScripts"}
ALIASES = {  # common folder names -> (service, child folder name or None)
    "server": ("ServerScriptService", "Server"), "serverscripts": ("ServerScriptService", "Server"),
    "client": ("StarterPlayerScripts", "Client"), "clientscripts": ("StarterPlayerScripts", "Client"),
    "localscripts": ("StarterPlayerScripts", "Client"), "playerscripts": ("StarterPlayerScripts", "Client"),
    "shared": ("ReplicatedStorage", "Shared"), "common": ("ReplicatedStorage", "Shared"),
    "modules": ("ReplicatedStorage", "Modules"), "gui": ("StarterGui", None), "ui": ("StarterGui", None),
    "map": ("Workspace", "Map"), "maps": ("Workspace", "Map"), "models": ("Workspace", "Models"),
}
RUNS_ON = {  # where a plain .lua with no final `return` is meant to run
    "ServerScriptService": "server", "StarterPlayerScripts": "client", "StarterCharacterScripts": "client",
    "StarterGui": "client", "StarterPack": "client", "ReplicatedFirst": "client", "Workspace": "server",
}


def is_script(p: Path) -> bool:
    return p.suffix.lower() in SCRIPT_EXT and not p.name.lower().endswith(".meta.json")


def script_kind(p: Path) -> str:
    stem = p.name.lower()
    if stem.endswith((".server.lua", ".server.luau")):
        return "server"
    if stem.endswith((".client.lua", ".client.luau")):
        return "client"
    return "module"


def returns_value(p: Path) -> bool:
    """True if the file ends with a `return` statement, i.e. it is really a ModuleScript."""
    try:
        text = p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return True
    lines = []
    in_block = False
    for raw in text.splitlines():
        line = raw.strip()
        if in_block:
            if "]]" in line:
                in_block = False
            continue
        if line.startswith("--[[") or line.startswith("--[=["):
            in_block = "]]" not in line[4:]
            continue
        if not line or line.startswith("--"):
            continue
        lines.append(line)
    return bool(lines) and lines[-1].split("--")[0].strip().startswith("return")


def find_root(base: Path) -> Path:
    """The folder that best looks like a game's top level (most recognised child folders)."""
    best, best_score = base, -1
    for d in [base, *[p for p in base.rglob("*") if p.is_dir()]]:
        if any(part.startswith(".") or part == "__MACOSX" for part in d.relative_to(base).parts):
            continue
        names = [c.name.lower() for c in d.iterdir() if c.is_dir()]
        score = sum(2 if n in SERVICES or n in PLAYER_CONTAINERS else 1 if n in ALIASES else 0 for n in names)
        depth = len(d.relative_to(base).parts)
        if score > best_score or (score == best_score and score > 0 and depth < len(best.relative_to(base).parts)):
            best, best_score = d, score
    if best_score <= 0:  # no structure at all: the shallowest folder that holds files
        holders = [p.parent for p in base.rglob("*") if p.is_file() and "__MACOSX" not in p.parts]
        best = min(holders, key=lambda p: len(p.parts)) if holders else base
    return best


def make_script_runnable(path: Path, where: str) -> Path:
    """A plain .lua with no final return, placed where code runs, becomes a Script/LocalScript."""
    if script_kind(path) != "module" or returns_value(path):
        return path
    run = RUNS_ON.get(where)
    if not run:
        return path
    target = path.with_name(path.name[: -len(path.suffix)] + f".{run}{path.suffix}")
    path.rename(target)
    return target


def auto_project(source: Path, out: Path) -> tuple[Path, list[str]]:
    """Copy `source` into `out`, arrange it, write default.project.json. Returns (project, notes)."""
    root = find_root(source)
    shutil.copytree(root, out / "game", ignore=shutil.ignore_patterns("__MACOSX", ".DS_Store", ".git"))
    game = out / "game"
    tree: dict = {"$className": "DataModel"}
    notes: list[str] = []

    def service(name: str) -> dict:
        if name in PLAYER_CONTAINERS.values():
            sp = tree.setdefault("StarterPlayer", {"$className": "StarterPlayer"})
            return sp.setdefault(name, {"$className": name})
        return tree.setdefault(name, {"$className": name})

    def mount(node: dict, child: str | None, folder: Path, where: str) -> None:
        for f in list(folder.rglob("*")):
            if f.is_file() and is_script(f):
                new = make_script_runnable(f, where)
                if new != f:
                    notes.append(f"{f.name} -> {new.name}")
        rel = folder.relative_to(out).as_posix()
        if child:
            node[child] = {"$path": rel}
        else:
            node["$path"] = rel

    loose_dir = game / "_loose"
    for entry in sorted(game.iterdir()):
        key = entry.name.lower()
        if entry.is_dir():
            if key in SERVICES:
                mount(service(SERVICES[key]), None, entry, SERVICES[key])
            elif key in PLAYER_CONTAINERS:
                mount(service(PLAYER_CONTAINERS[key]), None, entry, PLAYER_CONTAINERS[key])
            elif key in ALIASES:
                svc, child = ALIASES[key]
                mount(service(svc), child, entry, svc)
            elif entry.name != "_loose":
                # Unknown folder of code: shared modules are the safest guess.
                mount(service("ReplicatedStorage"), entry.name, entry, "ReplicatedStorage")
                notes.append(f"{entry.name}/ -> ReplicatedStorage")
        elif entry.is_file():
            kind = script_kind(entry) if is_script(entry) else None
            suffix = entry.suffix.lower()
            if kind == "server":
                svc = "ServerScriptService"
            elif kind == "client":
                svc = "StarterPlayerScripts"
            elif kind == "module":
                svc = "ReplicatedStorage"
            elif suffix in (".rbxm", ".rbxmx"):
                svc = "Workspace"
            elif suffix in (".json", ".txt", ".csv", ".toml"):
                svc = "ReplicatedStorage"
            else:
                continue  # images, readmes...: Roblox assets cannot come from a zip
            dest = loose_dir / svc
            dest.mkdir(parents=True, exist_ok=True)
            moved = dest / entry.name
            entry.rename(moved)
            if kind == "module" and not returns_value(moved):
                # A loose script that returns nothing is a game script: run it on the server.
                runnable = moved.with_name(moved.name[: -len(moved.suffix)] + f".server{moved.suffix}")
                svc_dir = loose_dir / "ServerScriptService"
                svc_dir.mkdir(parents=True, exist_ok=True)
                moved.rename(svc_dir / runnable.name)
                notes.append(f"{entry.name} -> ServerScriptService/{runnable.name}")
    if loose_dir.exists():
        for svc_dir in sorted(loose_dir.iterdir()):
            if any(svc_dir.iterdir()):
                node = service(svc_dir.name)
                node[f"Loose{svc_dir.name}"] = {"$path": svc_dir.relative_to(out).as_posix()}

    # Players need something to stand on: add a baseplate + spawn unless the game brings a world.
    workspace = tree.get("Workspace", {})
    has_world = any(k != "$className" for k in workspace) or (game / "Workspace").exists()
    if not has_world:
        tree.setdefault("Workspace", {"$className": "Workspace"}).update({
            "Baseplate": {"$className": "Part", "$properties": {
                "Anchored": True, "Locked": True, "Size": [2048, 16, 2048], "CFrame": {"CFrame": {"position": [0, -8, 0], "orientation": [[1, 0, 0], [0, 1, 0], [0, 0, 1]]}},
                "Color": [0.36, 0.36, 0.38], "Material": "Concrete", "TopSurface": "Smooth", "BottomSurface": "Smooth"}},
            "SpawnLocation": {"$className": "SpawnLocation", "$properties": {
                "Anchored": True, "Size": [12, 1, 12], "CFrame": {"CFrame": {"position": [0, 0.5, 0], "orientation": [[1, 0, 0], [0, 1, 0], [0, 0, 1]]}}, "Neutral": True, "Duration": 0,
                "Color": [0.45, 0.35, 1.0], "Material": "Neon"}},
        })
        notes.append("Workspace: baseplate + spawn added")

    project = out / "default.project.json"
    project.write_text(json.dumps({"name": "AutoProject", "tree": tree}, indent=2))
    return project, notes


def shallowest(paths: list[Path]) -> Path | None:
    return min(paths, key=lambda p: (len(p.parts), str(p))) if paths else None


def prepare() -> None:
    state = {"steps": {}, "started": time.time()}
    save_state(state)
    try:
        if not REQUEST.exists():
            raise PushError("NO_REQUEST", "No .roblox-push/request.json in this commit.")
        req = json.loads(REQUEST.read_text(encoding="utf-8"))
        state["request"] = {k: req.get(k) for k in ("id", "universeId", "placeId", "versionType", "file")}

        universe, place = str(req.get("universeId") or "").strip(), str(req.get("placeId") or "").strip()
        if not place.isdigit():
            raise PushError("BAD_IDS", "placeId must be a number (the one in roblox.com/games/<number>).")
        if not universe:
            universe = lookup_universe(place)
            print(f"place {place} belongs to universe {universe}")
        if not universe.isdigit():
            raise PushError("BAD_IDS", "universeId must be a number.")
        version_type = req.get("versionType", "Published")
        if version_type not in ("Published", "Saved"):
            raise PushError("BAD_REQUEST", "versionType must be Published or Saved.")
        file_name = Path(str(req.get("file", ""))).name
        game = ROOT / file_name
        if not file_name or not game.exists():
            raise PushError("NO_FILE", f"Game file {file_name!r} is not in the commit.")

        if WORK.exists():
            shutil.rmtree(WORK)
        WORK.mkdir(parents=True)
        suffix = game.suffix.lower()
        kind, place_file, project = "", None, None

        if suffix in (".rbxl", ".rbxlx"):
            kind, place_file = suffix[1:], game
        elif suffix == ".zip":
            safe_extract(game, WORK / "unzipped")
            unzipped = WORK / "unzipped"
            projects = [p for p in unzipped.rglob("default.project.json")] or list(unzipped.rglob("*.project.json"))
            places = list(unzipped.rglob("*.rbxl")) + list(unzipped.rglob("*.rbxlx"))
            if projects:
                kind, project = "rojo", shallowest(projects)
            elif places:
                place_file = shallowest(places)
                kind = place_file.suffix.lower()[1:]
            elif any(p.is_file() and (is_script(p) or p.suffix.lower() in (".rbxm", ".rbxmx")) for p in unzipped.rglob("*")):
                project, notes = auto_project(unzipped, WORK / "auto")
                kind = "rojo"
                state["autoProject"] = notes
                print("no project file: generated", project)
                print("\n".join(notes))
            else:
                raise PushError(
                    "BAD_ZIP",
                    "The zip has no game files: no Rojo project, no .rbxl/.rbxlx and no .lua/.luau scripts.",
                )
        else:
            raise PushError("BAD_FILE", "Send a .rbxl, .rbxlx or .zip file.")

        state.update(
            kind=kind,
            universe=universe,
            place=place,
            versionType=version_type,
            placeFile=str(place_file) if place_file else None,
            project=str(project) if project else None,
            luau=(req.get("luau") or "").strip(),
        )
        detail = f"{kind}: {project or place_file}"
        step(state, "prepare", True, detail)
        print(f"prepared {detail}")
        output("needs_rojo", "true" if kind == "rojo" else "false")
        output("has_luau", "true" if state["luau"] else "false")
    except PushError as err:
        fail(state, "prepare", err)
    except (json.JSONDecodeError, zipfile.BadZipFile) as err:
        fail(state, "prepare", PushError("BAD_REQUEST", str(err)))


# ----------------------------------------------------------------- build ---
def build() -> None:
    state = load_state()
    project = Path(state["project"])
    out = WORK / "place.rbxl"
    print(f"rojo build {project}")
    proc = subprocess.run(["rojo", "build", str(project), "-o", str(out)], capture_output=True, text=True)
    print(proc.stdout[-4000:], proc.stderr[-4000:], sep="\n")
    if proc.returncode != 0 or not out.exists():
        fail(state, "build", PushError("BUILD_FAILED", (proc.stderr or proc.stdout)[-1500:]))
    state["placeFile"] = str(out)
    state["kind"] = "rojo"
    step(state, "build", True, f"built {out.stat().st_size} bytes")


# --------------------------------------------------------------- publish ---
def publish() -> None:
    state = load_state()
    try:
        place_file = Path(state["placeFile"])
        data = place_file.read_bytes()
        content_type = "application/xml" if place_file.suffix.lower() == ".rbxlx" else "application/octet-stream"
        url = f"{API}/universes/v1/{state['universe']}/places/{state['place']}/versions?versionType={state['versionType']}"
        print(f"uploading {place_file.name} ({len(data) / 1024:.1f} KB) as {state['versionType']}")
        result = roblox("POST", url, data, content_type)
        state["version"] = result.get("versionNumber")
        step(state, "publish", True, f"version {state['version']}")
        print(f"ok: place version {state['version']}")
    except PushError as err:
        fail(state, "publish", err)


# ------------------------------------------------------------------ luau ---
def luau() -> None:
    state = load_state()
    info: dict = {"ran": True, "ok": False, "logs": [], "results": None, "error": None}
    state["luauResult"] = info
    try:
        base = f"{API}/cloud/v2/universes/{state['universe']}/places/{state['place']}"
        if state.get("version"):
            base += f"/versions/{state['version']}"
        task = roblox(
            "POST",
            f"{base}/luau-execution-session-tasks",
            json.dumps({"script": state["luau"], "timeout": "120s"}).encode(),
            "application/json",
        )
        path = task["path"]
        deadline = time.time() + 200
        while task.get("state") not in ("COMPLETE", "FAILED", "CANCELLED"):
            if time.time() > deadline:
                raise PushError("LUAU_TIMEOUT", "The Luau task did not finish in time.")
            time.sleep(2)
            task = roblox("GET", f"{API}/cloud/v2/{path}")
        logs = roblox("GET", f"{API}/cloud/v2/{path}/logs")
        for entry in logs.get("luauExecutionSessionTaskLogs", []):
            info["logs"].extend(entry.get("messages", []))
        info["logs"] = info["logs"][-200:]
        if task.get("state") == "COMPLETE":
            info["ok"] = True
            info["results"] = task.get("output", {}).get("results")
        else:
            error = task.get("error", {})
            info["error"] = f"{error.get('code', task.get('state'))}: {error.get('message', '')}"
        print("\n".join(info["logs"]))
        step(state, "luau", info["ok"], info["error"] or "complete")
        if not info["ok"]:
            sys.exit(1)
    except PushError as err:
        info["error"] = f"{err.code}: {err}"
        fail(state, "luau", err)


# ---------------------------------------------------------------- finish ---
def fail(state: dict, name: str, err: PushError) -> None:
    state["error"] = {"code": err.code, "message": str(err)[:1500], "step": name}
    step(state, name, False, str(err))
    print(f"::error::{name} failed [{err.code}] {err}")
    sys.exit(1)


def finish() -> None:
    state = load_state()
    request = state.get("request") or {}
    published = bool(state.get("version"))
    luau_info = state.get("luauResult")
    result = {
        "id": request.get("id"),
        "ok": published and state.get("error") is None and (not luau_info or luau_info.get("ok")),
        "published": published,
        "version": state.get("version"),
        "versionType": state.get("versionType"),
        "universeId": state.get("universe"),
        "placeId": state.get("place"),
        "kind": state.get("kind"),
        "gameName": lookup_name(state["universe"]) if state.get("universe") else None,
        "autoProject": state.get("autoProject"),
        "steps": state.get("steps", {}),
        "luau": luau_info,
        "error": state.get("error"),
        "playUrl": f"https://www.roblox.com/games/{state.get('place')}" if published else None,
        "runUrl": f"{os.environ.get('GITHUB_SERVER_URL', '')}/{os.environ.get('GITHUB_REPOSITORY', '')}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}",
        "seconds": round(time.time() - state.get("started", time.time()), 1),
    }
    RESULT.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    commands = {"prepare": prepare, "build": build, "publish": publish, "luau": luau, "finish": finish}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        sys.exit(f"usage: push.py {{{'|'.join(commands)}}}")
    commands[sys.argv[1]]()
