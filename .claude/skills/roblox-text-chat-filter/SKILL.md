---
name: roblox-text-chat-filter
description: Use when showing player-written text in Roblox (pet names, signs, trade notes): TextService filtering, TextChatService.
---

# Filtering player text
- Server: `local ok, res = pcall(TextService.FilterStringAsync, TextService, text, fromUserId)` then `res:GetNonChatStringForBroadcastAsync()` (public) or `GetNonChatStringForUserAsync(toUserId)`.
- Required for pet names, signs, guild names, anything others can see. On failure show nothing or a placeholder.
- TextChatService for chat: `TextChatService.OnIncomingMessage` to add tags (VIP, rarity colours) with rich text.
