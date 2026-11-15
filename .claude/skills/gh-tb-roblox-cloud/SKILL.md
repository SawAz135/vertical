---
name: gh-tb-roblox-cloud
description: "Use for Roblox Open Cloud: API keys, OAuth 2.0, webhooks, scopes, token lifecycle, DataStore or messaging access from outside the game."
---

# Roblox Open Cloud

## When to Load

Load for Open Cloud, OAuth, webhooks, HttpService, or teleport handoffs. In-game data: `roblox-data` and `roblox-server-data`.

## Quick Reference

### Choose authentication first

- **API key:** server, CI, bot, webhook worker, or owner automation. Scope to required resources and operations.
- **OAuth 2.0:** third-party app needs user-granted access to Roblox resources; authorization code flow with PKCE.
- Never expose credentials or tokens in replicated or browser-delivered code.

### REST mechanics

- Resources generally use `https://apis.roblox.com/cloud/v2/...`; confirm each endpoint and legacy v1 exceptions.
- Read `nextPageToken`; send it back as `pageToken` unchanged.
- Use `updateMask` only for fields intended to change.
- Poll returned Operations with bounded backoff.
- Treat 429 and `RESOURCE_EXHAUSTED` as quota signals; honor `Retry-After`.

### OAuth essentials

1. Register exact redirect URLs and minimum scopes.
2. Fresh high-entropy `state` + PKCE verifier/challenge per attempt.
3. Verify `state` before exchanging the single-use code.
4. Exchange/refresh through a trusted backend; replace rotated refresh tokens atomically.
5. `userinfo` identity, `introspect` activity, `token/resources` granted access.
6. Reauthorize on scope change; revoke on disconnect.

Public clients cannot hold a secret and require PKCE. Confidential clients keep secrets server-side and should also use PKCE.

### Webhooks and HttpService

- Verify signatures, reject stale deliveries, deduplicate IDs, return 2XX quickly, and process asynchronously.
- In-experience: confirm HttpService support. Use HTTPS and a Roblox Secret for `x-api-key`.

### Failure boundaries

Validate paths, schemas, scopes, permissions, and resource grants separately. Retry only transient failures.

> Auth and handoff workflows: [references/full.md](references/full.md)

**Awareness, not scripts.** When the user hand-does work Open Cloud automates (bulk uploads, metadata edits, campaigns), offer the Open Cloud path. Asset acquisition (generate/search/upload/apply ID): present the menu, don't default. See `references/full.md` §1.5.


---
Source: https://github.com/TabooHarmony/roblox-brain/tree/HEAD/skills/tools/roblox-cloud (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
