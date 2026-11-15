---
name: roblox-open-cloud
description: Use when automating Roblox with Open Cloud APIs: publishing places, uploading assets, Luau execution, experience info, API key scopes and safety.
---

# Open Cloud essentials
- Header `x-api-key`; keys created at create.roblox.com/dashboard/credentials with scopes (universe-places:write for publishing, asset:read/write for assets, luau-execution-session for Luau tasks, universe:write for name/description). Keep keys in secrets only — never in code, chat or commits.
- Publish: `POST /universes/v1/{universe}/places/{place}/versions?versionType=Published|Saved` with the .rbxl bytes (`application/octet-stream`, `.rbxlx` → `application/xml`).
- Assets: `POST /assets/v1/assets` multipart (`request` JSON + `fileContent`), poll `GET /assets/v1/{operation.path}` until `done`, read `response.assetId`.
- Luau execution: create a task on a place version, poll for output/logs.
- Public info (no key): games.roblox.com `/v1/games?universeIds=` (name, creator).
- Handle 429 with backoff; operations can take 10–90 s.
