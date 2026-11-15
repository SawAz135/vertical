---
name: gh-tb-roblox-analytics
description: "Use when adding, changing, or auditing Roblox analytics: AnalyticsService events, economy, funnels, onboarding traces, rate limits."
---

# Roblox Analytics Reference

## When to Load

Load when tracking player behavior, economy events, funnels, or onboarding traces, or building `AnalyticsService` instrumentation.

## Quick Reference

Key rules:
- Built-in `AnalyticsService`; no third-party SDK.
- Event types: Custom (counters/values), Economy (currency flow), Funnel (step progression)
- Rate limit: 120 + (20 × CCU) calls/minute. Batch where possible.
- Economy events report committed changes; diagnostic events can record failed attempts.
- Report the balance the committed mutation RETURNED; never recompute it from the `leaderstats` replica — re-adding double-counts.
- Economy events track sources (earned) and sinks (spent) separately.
- Funnel steps need not fire in order; skipped steps back-fill when a later step logs.
- Dashboard ~24-hour delay; "View Events" validates in real time.
- Server-side logging preferred; client-side only for UI interaction tracking.
- Creator Rewards: no AnalyticsService grant event. Track leading indicators (session duration, onboarding, referrals); Creator Dashboard owns payouts.
- First-session traces: bounded buffer, shared save owner, RTBF + retention. Eligibility from player history, not missing traces; attempts matter. full.md §8.

**Economy health (decision layer):**
- Instrument from day one; you cannot backfill history.
- Log source AND sink per currency with SKUs + the mutation's returned balance.
- Health signals: sink/source ratio, inflation, whale concentration, elasticity, sink sufficiency, D1/D7 cohorts. Thresholds are heuristics.
- Economy breaks: verify events, read narrowest broken signal, change ONE lever, re-check.

**Cross-refs:** `roblox-growth-design` (audit workflow); `roblox-monetization` (purchase funnel).

**Need more detail?** `references/full.md`: code examples, API tables, edge cases.


---
Source: https://github.com/TabooHarmony/roblox-brain/tree/HEAD/skills/design/roblox-analytics (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
