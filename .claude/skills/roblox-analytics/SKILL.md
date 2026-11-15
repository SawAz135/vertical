---
name: roblox-analytics
description: Use when measuring a Roblox game: AnalyticsService funnels/economy events, retention, A/B ideas.
---

# Analytics
- `AnalyticsService:LogEconomyEvent(player, flowType, currency, amount, endingBalance, transactionType, itemSku?)` for sources/sinks.
- `LogFunnelStepEvent` for onboarding (spawn → first egg → first equip → first rebirth); `LogProgressionEvent`, `LogCustomEvent`.
- Read in Creator Hub analytics: D1/D7 retention, session length, payer conversion.
- Change one thing at a time; compare cohorts by date.
