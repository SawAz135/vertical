---
name: gh-tb-roblox-security
description: "Use when auditing or hardening Roblox code against exploits: authority, remotes, economy, purchases, and DataStore flows."
---

# Roblox Security

## When to Load

Load for authority, remote abuse, economy, saves, bans, or sandboxing audits. Remote validation/rate limits: `roblox-networking`.

## Quick Reference

**Core:** Client is always compromised. The server remains the source of truth, but the implementation depends on the authority model.

### Authority Models

- **Classic replication:** validate client requests against server state. Never trust client damage, currency, inventory, permissions, or positions.
- **Server Authority:** `Workspace.AuthorityMode = Server`: the server owns core simulation while clients predict and recover from misprediction. Use `BindToSimulation()` (needs `UseFixedSimulation`), not blanket `Heartbeat` correction. Cheap for stock characters, rewrite-scale for authored simulation (full.md).
- **Both:** validate attacks, purchases, teleports, permissions, and custom remotes at the server boundary.

### Audit Checklist

**CRITICAL:** Server-authoritative state · Documented authority model · Validate all arg types · Rate limit remotes · Session-lock DataStore · No client currency mutations · ProcessReceipt verification · No secrets in client code

**HIGH:** Validate custom movement and action transitions · BindToClose protection · Atomic trading · Never trust client values · Use InputActions for simulation input in Server Authority projects · Validate ProximityPrompt/ClickDetector/DragDetector like remotes

**MEDIUM:** Server cooldowns · server-computed leaderboards · anti-AFK reward checks · TextService filtering · Script sandboxing for third-party code

### Enforcement

Enforcement is a product decision with appeal implications. `Players:BanAsync`/`UnbanAsync` are server-only and need `Players.BanningEnabled`; `pcall` them. Duration, reason limits and device blocks: full.md.

### Anti-Patterns

Don't obfuscate client code, use `_G` for security, kick without logging, over-validate movement, or rely on client anti-cheat.

See `references/full.md` for detailed examples.


---
Source: https://github.com/TabooHarmony/roblox-brain/tree/HEAD/skills/core/roblox-security (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
