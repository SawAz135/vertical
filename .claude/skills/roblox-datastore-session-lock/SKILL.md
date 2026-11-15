---
name: roblox-datastore-session-lock
description: Use when saving player data in Roblox DataStores safely: UpdateAsync, session locking, retries, autosave, BindToClose, migrations, limits.
---

# Safe player saving
- Always `UpdateAsync` (atomic), never Get-then-Set. Key `p_<UserId>`.
- Session lock: store `{data, lock={job=game.JobId, t=os.time()}}`; on load refuse (return nil in the transform) if another job's lock is fresh; retry a few times, then kick with a friendly message. Treat locks older than ~3× autosave as dead.
- Save: transform refuses to write if another job holds the lock; release on leave (`lock = nil`) and never re-lock afterwards.
- Retries with exponential backoff (`pcall`, 2^i seconds, ~5 tries). On total failure play with defaults but NEVER save over the real data.
- Autosave every 60–120 s only if dirty; `game:BindToClose` saves all in parallel and waits ≤ 25 s.
- Migrations: fill missing fields from defaults on load; version field.
- Limits: 4 MB per key; ~60 + 10×players requests/min per server; keys ≤ 50 chars. Dictionaries must have string keys only (mixed tables break JSON).
- Studio: enable "Enable Studio Access to API Services" to test.
