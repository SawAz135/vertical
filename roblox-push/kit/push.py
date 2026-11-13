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
            else:
                raise PushError(
                    "BAD_ZIP",
                    "The zip has no Rojo project (default.project.json) and no .rbxl/.rbxlx place file.",
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
