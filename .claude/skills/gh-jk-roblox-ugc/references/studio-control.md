# Operating Roblox Studio for UGC

The skill teaches the workflow and uses the tools available in the host. Installing the skill alone does not connect Studio, add native desktop control, import a local mesh or grant Marketplace permissions. Read [Studio validation and APIs](studio-api.md) for the separate validation harness.

## Connect the official Studio server

In a current Roblox Studio installation, open **Assistant → … → Manage MCP Servers → Enable Studio as MCP server**. Prefer **Quick connect** for Codex CLI, Claude Code or Claude Desktop. Restart the client when required and confirm the connected-client indicator. Follow the live [official setup instructions](https://create.roblox.com/docs/studio/mcp) if the controls change.

The official server uses stdio. Its documented launchers are `cmd.exe /c %LOCALAPPDATA%\Roblox\mcp.bat` on Windows and `/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP` on macOS. Use the actual installed path/configuration; merge the entry into existing client settings instead of replacing other servers. Roblox documents no Linux launcher on that page. An existing working compatibility setup is a separate environment fact, not an official Linux support claim.

## Discover, then act

1. Enumerate the actual client's tools. Call `list_roblox_studios`; select the window by its name, local file and place identity. Reuse the user's authorization for the intended UGC test project. An unrelated open game is not the intended target simply because it is the only connection.
2. Call `get_studio_state`. Use the returned DataModel type. Edit mode accepts `Edit`; a playtest normally exposes `Client`/`Server`. Recheck after a mode transition; stale IDs and contexts can fail.
3. Inspect a bounded `search_game_tree` result and the exact imported object with `inspect_instance`. A truncated tree cannot prove absence of a child; narrow the path or request more depth.
4. Run `scripts/studio_doctor.luau` read-only to record runtime readiness. Then run the category-specific asset validation on the actual imported object. API availability is distinct from a successful call.
5. Make scoped changes only in the chosen asset or a scratch test place, preserving a source/export backup. Luau runs on Studio's main thread: split large work into small chunks and yield between them. Avoid unbounded polling and whole-place traversals.
6. Capture the resulting hierarchy, exact errors and relevant previews. Record the import, Roblox technical validation, visual fitting, moderation and sale status separately.

## Capability map

These names describe the official integration inspected on 2026-10-14. Other servers and later versions can differ. Inspect the current schema rather than hard-coding this table as a permanent guarantee.

| Operation | Available route | What must be verified |
| --- | --- | --- |
| Read hierarchy/properties/scripts | `search_game_tree`, `inspect_instance`, `script_read`, `script_search`, `script_grep` | Correct Studio ID, context, full relevant result |
| Create/edit supported Instances and scripts | `execute_luau`, `multi_edit` | Authorized target, permitted API/property writes, preserved asset |
| Read existing selection | Luau `Selection:Get()` when accessible | Actual selected Instances; do not guess from screenshots |
| Start/stop a test | `start_stop_play`, then `get_studio_state` | Intended scratch place, Client/Server roles, cleanup after test |
| Move a player, simulate player GUI input | `character_navigation`, `user_keyboard_input`, `user_mouse_input` | These tools target the **Client game**; they do not provide arbitrary Studio menu control |
| Capture viewport/plugin windows | `screen_capture`; `list_plugin_guis` + `capture_plugin_gui` when exposed | Correct window visible; an occluded widget can capture other screen content |
| Insert an existing Roblox asset ID | `insert_asset` | Ownership/access, returned instance, scripts in inserted content; ID insertion does not read a local FBX |
| Generate meshes/materials/textures | Exposed generation tools, where supported | Category-ready topology/UV/rig/cages/textures, rights, geometry validation; a generated object is not automatically publishable UGC |
| Import local FBX/glTF/OBJ or open a new local place | Native Studio UI through a verified desktop-control integration, otherwise manual handoff | The inspected official tool list contains no local-file importer or new-place tool |
| AFT / Avatar Setup / Animation Editor UI | Native Studio UI through verified desktop control, otherwise manual handoff | Real UI state, exact category settings and result; a plugin screenshot tool is not a click tool |
| Export source mesh to a local file | Blender source/export helper, or Studio's supported native export UI for the selected item | Actual file written and roundtrip; no such dedicated tool was exposed by the inspected Studio server |
| Official UGC technical validation | Supported `AvatarCreationService:ValidateUGC*Async` calls in the documented runtime, or category UI | Correct input, Player, API return/errors; see `studio_validate.luau` |
| Upload and Marketplace publication | The current category's Studio/Creator Dashboard workflow | Creator, permissions, fees, upload ID, moderation and on-sale status independently |

The official [MCP tool inventory](https://create.roblox.com/docs/studio/mcp) provides programmatic Studio access. The route descriptions above are conclusions from its exposed schemas; they do not claim untested native UI capabilities. A filesystem/terminal connector alone does not demonstrate the ability to click Studio controls.

## Import handoff and settings record

Use [File → Import](https://create.roblox.com/docs/studio/importer) for the actual exported file. Inspect the preview, file/object hierarchy and errors before import. Record the file hash, units, axes, creator and preset. For iterative tests, inspect **Upload to Roblox**: disabling it avoids inventory copies; the default import can create assets. Record whether **Uses Cage**, rig type and zero-influence-bone handling match the selected workflow. Do not merge separate body parts/cages or discard rig data to hide an error. Successful generic import is distinct from Marketplace publication.

If native automation is unavailable, give one concrete handoff: the absolute export path, category, the relevant documented settings, and the expected imported root. After the user performs the import, resume with MCP inspection and validation; keep the import check `NOT_CHECKED` until a real result is observed.

## Accessory and avatar fitting

Open [AFT](https://create.roblox.com/docs/avatar/accessory-fitting-tool) from **Avatar → Accessory**. Choose the imported mesh/model, the rigid or clothing route and the actual category/body scale. Fit against multiple body combinations and animations; then generate the accessory and inspect its Handle, Attachment, AccessoryType and, for clothing, WrapLayer. Keep screenshots of clipping, acceptable fit and repaired results. Transforming a mesh by Luau does not reproduce every AFT fitting/conversion step.

For a body/head, use [Avatar Setup](https://create.roblox.com/docs/avatar-setup) and the appropriate traditional or automatic input requirements. Check generated parts, attachments, skinning, cages and face poses, then run its available validation/test actions. For makeup, classic clothing and animations, follow their own guides and publishing controls. A rigid-accessory validator cannot establish those categories' correctness.

## Read-only doctor

The script returns a function; it can be evaluated directly through authorized `execute_luau`, or stored in a ModuleScript in the intended scratch project. It creates no Instances and does not start play, import, upload or publish:

```lua
local doctor = require(pathToDoctorModule)
local report = doctor({
    expectedPlaceId = game.PlaceId,
    root = actualImportedAccessory,
    tool_names = {"list_roblox_studios", "get_studio_state", "execute_luau"},
})
print(game:GetService("HttpService"):JSONEncode(report))
```

`tool_names` is the inventory the client actually discovered, not a way to create capabilities. Supply the intended place ID obtained during target selection; blindly copying `game.PlaceId` only records identity. The doctor reports `PASS` for an observed fact, `FAIL` for an invalid reference or target mismatch, `WARN` for a present but untested callable/prerequisite, and `NOT_CHECKED` where evidence is absent. It has no global success flag and always leaves asset validation, native UI and Marketplace effects unproven.

## Troubleshooting

| Symptom | Next action |
| --- | --- |
| No connected Studio | Enable server, verify official launcher path and client config, restart the required apps, enumerate again |
| Wrong DataModel / stale window ID | Re-enumerate the intended window and call `get_studio_state`; do not switch an unrelated game into play merely to satisfy a schema |
| A Luau call freezes Studio | Bound traversal/work, split into chunks, yield; remove busy waits |
| A screenshot shows a different window | Make the relevant widget visible using actual native control/manual handoff, then recapture |
| Import reports cage/rig/texture errors | Preserve the exact error; inspect the relevant Blender/export/import stage rather than deleting validation data |
| `ValidateUGC*Async` errors | Record `NOT_CHECKED` plus the error; fix runtime/input/permissions and repeat. API errors are not passed technical validation |
| A tool says upload completed | Resolve the actual asset ID and inspect its category/owner/state; upload alone does not establish moderation or Marketplace sale |
