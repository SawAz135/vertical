---
name: gh-tb-roblox-monetization
description: "Use when adding, changing, or auditing Roblox purchases: GamePasses, Developer Products, subscriptions, private servers, policy checks."
---

# roblox monetization

## When to Load

Load when adding a Game Pass, Developer Product, subscription, private server, Creator Rewards-related product decision, or purchase eligibility check.

## Quick Reference

- Prompt purchases from the client, but grant value only from server-owned code.
- Passes: one server-owned ID→benefit registry; join and purchase refresh use the same idempotent benefit path. Full.md §2a.
- Developer Products: repeatable consumables. Grant through a server-owned receipt handler, either `ProcessReceipt` or `BindReceiptHandler` with `Enum.ReceiptType.DeveloperProduct`. `PromptProductPurchaseFinished` is not purchase confirmation.
- Failed receipts remain `NotProcessedYet`; retries depend on the chosen receipt API, not an invented timer. See full.md.
- For eligibility-sensitive purchases, check `PolicyService` and current Roblox guidance. If a paid-random-item restriction applies, offer the user the documented choices, including earnable rewards, a known non-random sequence, or direct purchase. Do not default to hiding or blocking the feature; handle the affected purchase path without stopping unrelated work.
- Creator Rewards is a platform program, not a grant API. Track eligibility, attribution, engagement, and dashboard reporting separately from purchases and inventory.
- Test failed/duplicate grants, absent players, and interrupted saves. Transfers, subscription changes, and dynamic pricing: full.md.
- A receipt handler's presence is not proof of correctness; inspect its ownership, durable idempotent grant, and retry paths for unknown products or absent players.

**Need the details?** Load `references/full.md` for purchase flows and failure handling.


---
Source: https://github.com/TabooHarmony/roblox-brain/tree/HEAD/skills/design/roblox-monetization (MIT, see ../THIRD_PARTY_LICENSES.md). Installed unchanged except this note and the skill name.
