# Forge Library: how the catalog is built

1. `collect.py` - GitHub repository search over ~90 Roblox/Luau topics (throttled), keeps
   permissive licenses only (MIT, Apache-2.0, BSD, MPL-2.0, CC0, Unlicense, Zlib, ISC, 0BSD, BSL)
   and drops anything about executors, exploits, cheats, script hubs, injectors.
2. `wally.py` - reads the public Wally registry index (github.com/UpliftGames/wally-index),
   latest version of each package, same license and exclusion rules.
3. Curated "awesome-roblox" lists (CC0) are resolved through GitHub search and flagged.
4. `merge.py` - dedupes (GitHub repo == Wally repository), assigns a category, scores
   (stars, recent activity, curated, published on Wally) and writes `catalog.json`.

Every entry keeps its own license; the app only links to projects and shows install lines.
