# Sources, corpus scope and maintenance

## What is bundled

The corpus contains English Roblox Marketplace avatar creation, validation, publishing and related API documentation at a fixed `Roblox/creator-docs` revision, combined with the live Creator Hub inventory. It includes full licensed source Markdown/API YAML, complete official tutorial sequences, relevant legacy guides and source-backed authored workflows. Live-only pages use linked section metadata where redistribution rights were not established.

`corpus/sources.jsonl` records each source's inclusion/exclusion, reason, topic, original path, inventories, revision/hash, retrieval time and local path. Every English candidate in the combined inventory is classified. `corpus/links.jsonl` traces outgoing documentation dependencies. `corpus/coverage.json` contains counts, fetch failures, unresolved upstream references and the precise claims this release can make.

`corpus/resources.json` records illustrations, local tutorial videos and template downloads. Inspect relevant visual illustrations when cage placement, UV panels or face landmarks depend on them. Template hashes in `assets/templates.json` protect the selected project preparation downloads; other resource links are an inventory, not a claim that every binary has been inspected.

## Videos and community tutorials

`corpus/videos.json` separately records videos linked by official docs, their backlinks, channel verification, transcript/visual review state and known blockers. Linked-by-docs does not necessarily mean authored by Roblox. A title, description or thumbnail is not a reviewed video. YouTube can require authentication or withhold captions; the release reports those gaps rather than asserting a complete viewing history.

Reviewed captions have original technique notes, language/type and a content hash. Captions are not redistributed. `sampled` visual status identifies paused screenshots and exact sample times; only `reviewed` counts as a full visual walkthrough. Garbled automatic speech and music-only captions are rejected as instructional evidence. Out-of-scope environment/skybox/advertising clips retain exclusion reasons. Search reviewed notes with `corpus.py search`; inspect their record with `corpus.py show video/VIDEO_ID`.

Community video analysis has its own `corpus/community-videos.json`, so it does not inflate the official-index video counts. Additional tool audits are recorded separately from Roblox requirements; see [RBX Toolbox](rbx-toolbox.md), [Blender MCP](blender-mcp.md) and [Studio control](studio-control.md).

`corpus/external-review.json` records selected Help Center, staff DevForum, tool-repository and community source metadata and access results. Third-party tutorial technique adoption remains conditional on current official requirements and a reproduced output. These sources are not automatically licensed under creator-docs' documentation license.

Useful community discovery areas include original rigid/hair modeling, sculpt/retopology/UV/baking, body bundle setup, automatic avatar setup, MD/CLO garment workflows, head/FACS tutorials and emote publishing. Current Marketplace makeup-authoring and animation-pack information is primarily supplied by the official corpus. Player styling, free-item acquisition and unexplained timelapses do not fill those authoring gaps.

Read the [community technique review](community.md) before using these supplemental sources. The complete official tutorial text remains the primary workflow.

## Retrieval

```bash
python scripts/corpus.py search "RootFaceJoint Frame0" --topic head --limit 6
python scripts/corpus.py search "publishing advance" --topic publishing --json
python scripts/corpus.py show avatar/character-bodies/specifications --start-line 380 --lines 100
python scripts/corpus.py audit --json
python scripts/corpus.py audit --live
```

For live discovery use [Roblox's agent index](https://create.roblox.com/docs/llms.txt) or `/docs/api/search/<percent-encoded plain-language question>`, then follow the returned exact Markdown URL. Do not guess removed paths. The live index/API indexes distinguish Engine APIs and Open Cloud. For source pages, locale-prefixed Markdown URLs in the index are reliable; check actual response type instead of interpreting a 404 HTML page as documentation.

## Maintenance

`python scripts/corpus.py sync --revision COMMIT_OR_REF` updates the installed snapshot and coverage. Run it on a writable source checkout as a deliberate maintenance operation, not silently in a normal asset task. Record the previous revision, inspect the diff and update authored references, machine rules, template hashes and conflict notes where needed before publishing another version.

`audit --live` detects changed inventory only; it cannot establish that an existing policy/price page remained unchanged. The specific live page must be rechecked for current advice or publication.

Preserve video review evidence during maintenance and do not substitute machine indexing for human/agent analysis. When a video link disappears from the upstream snapshot, `sync` archives its evidence in `corpus/retired-videos.json` and records the change; a returning link recovers those notes. Archived material is searchable as `retired-video/ID` and is marked retired rather than counted as a current link. Source defects remain documented with a disposition and reason. Upstream mistakes such as nonexistent API identifiers must not be converted into invented implementation details.

## Evidence boundaries

This release provides a classified official inventory and searchable source corpus. It does not claim all internet tutorials or every video were reviewed. Report inventory coverage, prose availability, video review, practical test results, host installation and Roblox publication separately. See [attribution](../ATTRIBUTION.md) for licenses and transformations.
