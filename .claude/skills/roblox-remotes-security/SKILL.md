---
name: roblox-remotes-security
description: Use when creating RemoteEvents/RemoteFunctions or any client→server action in Roblox: validation, rate limiting, never trusting the client.
---

# Secure remotes
- The client only asks; the server decides (prices, odds, rewards, positions). Never accept amounts, item ids that grant value, or results from the client.
- Validate every argument type (`typeof(x) == "string"`, lengths, `x == x` for NaN, `math.clamp`), and existence (item owned, egg exists).
- Rate-limit per player+action with `os.clock()` cooldowns; reply `{ok=false, slow=true}` instead of erroring.
- Check context: distance to the stand/NPC (`(root.Position - pos).Magnitude <= range`), state (not already rolling), ownership.
- Prefer one RemoteFunction `Request(action, ...)` with a whitelist table of handlers wrapped in `pcall`; log errors with `warn`, return generic messages.
- RemoteFunction server→client `InvokeClient` can hang forever: never use it. Server→client: RemoteEvent `FireClient`.
- Don't put RemoteEvents in places the client can create: create them on the server at start.
