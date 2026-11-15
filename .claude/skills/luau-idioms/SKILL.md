---
name: luau-idioms
description: Use when writing Luau for Roblox: modern syntax, types, generalized iteration, task library, common pitfalls.
---

# Luau idioms
- Generalized iteration: `for k, v in t do` (no pairs/ipairs needed); `continue`; compound ops `+= -= *= ..=`; string interpolation `` `Hello {name}` ``.
- Types: `--!strict`, `type Pet = { id: string, eq: boolean }`, `local function f(x: number): string`, generics `<T>`; `typeof(x)` for Roblox types at runtime.
- `task.spawn`, `task.defer`, `task.delay`, `task.wait` (never `wait`, `spawn`, `delay`).
- `table.clone`, `table.freeze`, `table.find`, `table.clear`; `math.clamp`, `math.round`.
- `return` must be the last statement of a block; `x ~= x` detects NaN.
- Modules return a table; avoid cyclic requires; cache services at the top (`local Players = game:GetService("Players")`).
