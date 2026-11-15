# Emotes and animation packs

Sources: [emote specifications](https://create.roblox.com/docs/avatar/emotes/specifications), [export](https://create.roblox.com/docs/avatar/emotes/export), [import](https://create.roblox.com/docs/avatar/emotes/import), [complete animation-pack workflow](https://create.roblox.com/docs/avatar/animation-packs), [Curve Editor](https://create.roblox.com/docs/animation/curve-editor).

## Emote

Author an original social animation on the supported R15 rig. Import it into Studio's Animation Editor, review actual motion, and convert the intended sequence to CurveAnimation according to the current import guide. Check duration, root travel and frame-to-frame speeds; these are separate from visual appeal.

The general specification describes an Animation wrapper referencing a saved asset ID, but a newer Studio publishing correction requires the appropriate Emote type/marker through the editor's animation-object creation workflow. If validation reports a missing valid UGC emote marker, verify the current Studio version and publishing UI; manually constructing a generic Animation wrapper may omit that marker. See [known conflicts](troubleshooting.md).

Advanced-rig emote availability is inconsistent between a snapshot's beta wording and its linked staff announcement. Verify live access before promising support. Do not force advanced-rig rules onto standard R15 or presume a beta API is enabled for the user's account.

## Locomotion pack

Produce eight or nine original clips: Idle (one or two), Walk, Run, Jump, Fall, Climb, Swim and Swim Idle. Each clip uses standard R15 and CurveAnimation; the snapshot requires duration no longer than ten seconds. All clips except Jump loop. Default Roblox animation reuse fails the originality requirement.

Export and inspect individual clips. In Studio, upload with the correct Animation type/Sub animation and a shared Parent model name so the clips assemble into one pack. Idle weights govern relative selection when there are two Idle clips. The fields labeled optional in the UI can still be required for correct pack assembly.

Validate the assembled parent model through Avatar Item → Avatar Animations. Resolve missing states, CurveAnimation type, parent-name mismatch, duration, looping and spatial errors before submission. Verify actual ownership/group permissions and current upload quotas/fees. A successful generic Animation API upload does not establish a published Marketplace pack.

## Verification

Inspect gait and transitions on supported avatars; test actual loops and body movement. Use Studio's validation result for movement thresholds, preserving original errors. Blender action existence/frame ranges are only preflight data; they do not prove allowed root motion or correct Roblox publishing markers.
