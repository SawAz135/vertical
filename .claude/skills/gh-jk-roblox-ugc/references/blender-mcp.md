# Blender MCP: optional setup and operation

Use an existing authorized Blender integration first. This plugin has no mandatory MCP server. When the agent needs interactive scene editing or viewport images, the included [launcher](../scripts/blender_mcp.py) can run **MCP for Blender**, previously named Blender MCP. Ordinary preflight/export still uses Blender CLI and works without this bridge.

## Quick setup

Run from this installed skill folder, using the Python executable available on the machine. Requirements: Blender 3.0+, `uv`, a graphical session, and network access for the first setup. On Windows/macOS, pass the actual Blender executable with `--blender` if it is absent from PATH. Install `uv` following its [official instructions](https://docs.astral.sh/uv/getting-started/installation/).

```bash
python scripts/blender_mcp.py setup
python scripts/blender_mcp.py launch
python scripts/blender_mcp.py config
```

`setup` downloads the pinned upstream wheel, checks SHA-256 before executing downloaded code, extracts the matching addon and MIT license, and installs dependencies into its own Python 3.11 environment using the included universal dependency lock and package hashes. It installs neither global Blender addons nor client settings. The default runtime is `~/.cache/roblox-ugc/blender-mcp-2.1.9`; `--runtime PATH` selects another directory.

`launch` starts a separate Blender GUI with factory defaults, disables embedded auto-execution, and loads the addon for that process only. The fresh scene is a scratch workspace. `--project PATH.blend` opens a supplied project without saving it; subsequent agent edits and saves remain explicit task actions. It refuses an occupied port. A detached process remains open until the user closes it or invokes `stop`.

`config` prints an MCP entry with absolute paths. Merge that entry into the intended client's settings; preserve existing servers. It writes no config file. The JSON works for Claude Desktop's `mcpServers` and project `.mcp.json` in Claude Code. For Codex, use the printed executable/arguments in Settings → MCP servers or the CLI:

```bash
codex mcp add blender-ugc -- /absolute/path/to/python /absolute/path/to/skill/scripts/blender_mcp.py serve
claude mcp add --transport stdio blender-ugc -- /absolute/path/to/python /absolute/path/to/skill/scripts/blender_mcp.py serve
```

Copy any non-default `--runtime` and `--port` to the `serve` arguments too. Restart/reconnect the client to discover tools. A plugin installed in a cloud session cannot access a Blender running on the user's computer unless that environment supplies the connection. Claude Chat skill uploads provide instructions and helpers; they do not create local process access. Claude Desktop uses a local stdio MCP connection when its current product mode permits it.

## Check and stop

```bash
python scripts/blender_mcp.py doctor
python scripts/blender_mcp.py status
python scripts/blender_mcp.py smoke --dest /new/empty/directory
python scripts/blender_mcp.py stop
```

`doctor` reports runtime hashes, executable availability and the actual local addon response separately. `status PASS` establishes an addon JSON response, not MCP tool discovery. `smoke` performs a real MCP initialization, lists tools, creates an original torus in a fresh launcher scratch scene, inspects it, retrieves a multi-view PNG, saves a `.blend`, and verifies safe-mode rejection. It refuses a nonempty destination or an already-open project. Its report labels visual inspection separately; a PNG returned by the transport has not yet been reviewed by an agent. The torus is a transport fixture, not an approved UGC asset.

`stop` closes only the Blender instance bearing that launch's ownership token. Opening another `.blend` may remove that token; in that case close the intended window manually. It never kills a process based only on a stale PID. Blender may prompt about unsaved work; save intended results first.

The addon requires a GUI event loop: **`blender --background` does not provide an MCP server**. On Linux without a desktop, `launch --virtual-display` uses an installed `xvfb-run` to create a GUI on a virtual display. Rendering still needs usable graphics/software rendering support. The normal CLI path remains appropriate for automated exports and checks.

## Agent editing loop

1. Observe available tools and current file before editing. With this pin, `get_scene_info` gives structure, topology and materials; `look` returns a viewport, camera, multi-angle or animation-frame image. Resolve exact local Blender APIs with Python/RNA inspection through `execute_blender_code` when needed. The raw addon's capability list differs from the tools exposed by the MCP server.
2. Use `execute_blender_code` for targeted `bpy`, `bmesh` and `mathutils` work. Read coordinates, object names, units and modifiers first. Operate on named objects/collections instead of deleting the whole scene. Use small batches and print concrete measurements.
3. Create source geometry, UVs, texture images/materials, rigs, weights and cages for the chosen UGC workflow. MCP is an editor bridge; it does not impose Roblox specifications or repair artistic defects automatically. Retrieve the relevant category guide.
4. Inspect multiple angles and actual UV/texture/animation output. Save a separate editable project, produce textures and export. Run `asset.py preflight` and the relevant Studio tests; keep each result distinct.

The helper fixes the addon endpoint to `127.0.0.1`; this upstream socket has no authentication and can execute Python. It disables upstream telemetry and enables upstream safe mode for MCP code execution. Modeling, material operations, baking, saving and import/export operators are allowed; shell/network access, arbitrary file access, external `.blend` datablocks and persistent callbacks are rejected. A rejected script should be rewritten using the supported Blender operations. Optional remote asset/generation services are off in the scratch addon; enable them only for a task that needs and authorizes them, with rights and costs checked separately.

## Pin and verification scope

Reviewed 2026-10-14: [upstream revision](https://github.com/ahujasid/blender-mcp/tree/7a0373ec9199183cb460068c4f96aed9c579fb4f), package `mcp-for-blender==2.1.9`, MIT, copyright Siddharth Ahuja. The PyPI wheel's addon, server, addon manager and safe-mode implementation match this inspected revision. The wheel contains the release telemetry configuration omitted from the Git source; setup therefore uses the verified release wheel.

| Artifact | SHA-256 |
| --- | --- |
| `mcp_for_blender-2.1.9-py3-none-any.whl` | `a5cbc6cf316fa7433566eb505a0c26ca22e28c10083bd1b09a23d9e357821ccc` |
| Bundled `addon.py` | `eb0facf69781a30e69792532087d8d41c6a14fcd323353250abe7988ee297fa5` |
| MIT license | `049501fd54d27852507853a5b88094ca1c6ff97404418a5032f3310eecc9cde6` |
| Universal dependency lock | `7001225c44fab1945cf8ea941e0e29c82d299d0b7f65796e2a282499ff743849` |

Live evidence covers Linux, Blender 5.2.2 LTS, virtual GUI and the MCP Python client's stdio transport. Windows/macOS launch behavior and each Codex/Claude graphical client need their own live checks. A successful offline test cannot establish those results.
