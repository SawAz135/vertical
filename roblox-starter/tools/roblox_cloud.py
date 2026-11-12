#!/usr/bin/env python3
"""Talk to Roblox Open Cloud without Roblox Studio.

  python3 tools/roblox_cloud.py publish build/BeyondObby.rbxl [--saved]
  python3 tools/roblox_cloud.py run tests/smoke.luau [--version N]

Settings come from environment variables (never put the key in a file):
  ROBLOX_API_KEY      Open Cloud API key (secret)
  ROBLOX_UNIVERSE_ID  experience (universe) id   - not secret
  ROBLOX_PLACE_ID     place id                   - not secret

The API key needs these permissions on the experience:
  universe-places:write                      (publish)
  universe.place.luau-execution-session:write (run)

Only the Python standard library is used. Exit code is 0 on success, 1 on failure.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

# ROBLOX_API_BASE exists only so the script can be tested against a local fake server.
API = os.environ.get("ROBLOX_API_BASE", "https://apis.roblox.com").rstrip("/")


def env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        sys.exit(f"error: environment variable {name} is not set")
    return value


def request(method: str, url: str, body: bytes | None = None, content_type: str | None = None) -> dict:
    headers = {"x-api-key": env("ROBLOX_API_KEY"), "Accept": "application/json"}
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = resp.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as err:
            detail = err.read().decode("utf-8", "replace")
            # 429 = rate limited, 5xx = Roblox side: wait and retry.
            if err.code == 429 or err.code >= 500:
                wait = 2 ** attempt
                print(f"  HTTP {err.code}, retrying in {wait}s", file=sys.stderr)
                time.sleep(wait)
                continue
            hint = {
                401: "the API key is missing, wrong or expired",
                403: "the key lacks a permission for this experience, or its IP allow-list blocks this machine",
                404: "check ROBLOX_UNIVERSE_ID and ROBLOX_PLACE_ID",
            }.get(err.code, "")
            sys.exit(f"error: HTTP {err.code} {hint}\n{detail}")
        except urllib.error.URLError as err:
            wait = 2 ** attempt
            print(f"  network error {err.reason}, retrying in {wait}s", file=sys.stderr)
            time.sleep(wait)
    sys.exit("error: Roblox did not answer after 5 attempts")


def publish(path: str, saved: bool) -> None:
    universe, place = env("ROBLOX_UNIVERSE_ID"), env("ROBLOX_PLACE_ID")
    with open(path, "rb") as fh:
        data = fh.read()
    content_type = "application/xml" if path.endswith(".rbxlx") else "application/octet-stream"
    version_type = "Saved" if saved else "Published"
    url = f"{API}/universes/v1/{universe}/places/{place}/versions?versionType={version_type}"
    print(f"uploading {path} ({len(data) / 1024:.1f} KB) as {version_type} ...")
    result = request("POST", url, data, content_type)
    print(f"ok: place version {result.get('versionNumber')}")


def run(path: str, version: int | None, timeout_s: int) -> None:
    universe, place = env("ROBLOX_UNIVERSE_ID"), env("ROBLOX_PLACE_ID")
    with open(path, encoding="utf-8") as fh:
        script = fh.read()
    base = f"{API}/cloud/v2/universes/{universe}/places/{place}"
    if version is not None:
        base += f"/versions/{version}"
    task = request(
        "POST",
        f"{base}/luau-execution-session-tasks",
        json.dumps({"script": script, "timeout": f"{timeout_s}s"}).encode(),
        "application/json",
    )
    task_path = task["path"]
    print(f"task started: {task_path}")

    deadline = time.time() + timeout_s + 60
    state = task.get("state")
    while state not in ("COMPLETE", "FAILED", "CANCELLED"):
        if time.time() > deadline:
            sys.exit("error: task did not finish in time")
        time.sleep(2)
        task = request("GET", f"{API}/cloud/v2/{task_path}")
        state = task.get("state")
        print(f"  state: {state}")

    logs = request("GET", f"{API}/cloud/v2/{task_path}/logs")
    print("---- logs ----")
    for entry in logs.get("luauExecutionSessionTaskLogs", []):
        for message in entry.get("messages", []):
            print(message)
    print("--------------")

    if state == "COMPLETE":
        print("result:", json.dumps(task.get("output", {}).get("results", []), indent=2))
        return
    error = task.get("error", {})
    sys.exit(f"error: task {state}: {error.get('code', '')} {error.get('message', '')}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    p_pub = sub.add_parser("publish", help="upload a .rbxl/.rbxlx as a new place version")
    p_pub.add_argument("file")
    p_pub.add_argument("--saved", action="store_true", help="save without making it live")
    p_run = sub.add_parser("run", help="run a Luau script on Roblox servers against the place")
    p_run.add_argument("file")
    p_run.add_argument("--version", type=int, default=None)
    p_run.add_argument("--timeout", type=int, default=120)
    args = parser.parse_args()
    if args.command == "publish":
        publish(args.file, args.saved)
    else:
        run(args.file, args.version, args.timeout)


if __name__ == "__main__":
    main()
