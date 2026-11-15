---
name: roblox-policies-monetization
description: Use when checking a Roblox game against platform rules: paid random items, age-appropriate content, external links, copyrighted assets, experience guidelines.
---

# Policy guardrails (verify current rules on create.roblox.com/docs)
- Paid random items (Robux → random reward) require showing odds before purchase.
- No real-money gambling mechanics or trading Robux outside Roblox; no off-platform payment links.
- Don't use other games' names, characters or copyrighted assets; genre styles are fine.
- Fill the Experience Questionnaire honestly (content maturity labels).
- Text from players must pass `TextService:FilterStringAsync` before others see it.
- Data: no personal info collection; no external webhooks with user data.
