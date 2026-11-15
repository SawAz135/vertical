---
name: roblox-marketplace-receipts
description: Use when selling gamepasses or developer products in Roblox: ProcessReceipt, idempotency, UserOwnsGamePassAsync, prompts, Robux rules.
---

# Gamepasses and developer products
- Gamepass: check `MarketplaceService:UserOwnsGamePassAsync(userId, passId)` (pcall) on join; grant on `PromptGamePassPurchaseFinished(player, id, bought)`.
- Developer product: ONE `MarketplaceService.ProcessReceipt` callback per game. Look up the player's loaded data; if not loaded return `Enum.ProductPurchaseDecision.NotProcessedYet` (Roblox retries).
- Idempotency: keep `receipts[PurchaseId]`, grant once, SAVE the data, then return `PurchaseGranted`. If the save fails return NotProcessedYet.
- Prompts: `PromptGamePassPurchase(player, id)`, `PromptProductPurchase(player, id)` — ids come from create.roblox.com → Monetization; never hard-code fake ids.
- Paid random items (loot boxes bought with Robux) must disclose odds before purchase (Roblox policy). Show the odds UI.
