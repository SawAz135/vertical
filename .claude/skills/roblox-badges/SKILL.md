---
name: roblox-badges
description: Use when awarding Roblox badges: BadgeService, checks, ids, rate limits.
---

# Badges
- Create badges on create.roblox.com (some free per day, more cost Robux) and use their real ids.
- Server: `if not BadgeService:UserHasBadgeAsync(userId, id) then BadgeService:AwardBadge(userId, id) end` inside pcall.
- Award on meaningful milestones (first legendary, rebirth 1, 100 eggs). Cache "has badge" per session to avoid throttling.
