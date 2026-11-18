--[[ FisherConfig: the 2 hireable fishermen on each player's dock and the bucket on the
     beach where they bring their catch.
       - hire: a ghost silhouette stands on the dock with its price; the 2nd silhouette
         only appears once the 1st fisherman is hired
       - levels: faster + luckier, and the fisherman's OUTFIT gets better every 2 levels
       - bucket: holds the catch until the player collects it; upgradable capacity ]]
local Layout = require(script.Parent.Parent.Layout)

local F = {}

F.MaxSlots = 2
F.HirePrice = { 50_000, 250_000 }
F.MaxLevel = 10

-- price to go from `lv` to `lv + 1` for a fisherman in `slot`
function F.levelCost(slot: number, lv: number): number
	local base = F.HirePrice[slot] or F.HirePrice[1]
	return math.floor(base * 0.4 * 1.55 ^ (lv - 1) / 100 + 0.5) * 100
end

-- seconds per fish (the whole loop: cast, wait, fight, walk to the bucket and back)
F.BaseInterval = 30
function F.interval(lv: number): number
	return F.BaseInterval * 0.9 ^ (lv - 1)
end

-- luck multiplier on the player's own fishing luck
function F.luck(lv: number): number
	return 1 + 0.2 * (lv - 1)
end

-- outfit tier (the style improves while upgrading)
F.TierNames = { "Deckhand", "Fisherman", "Old Salt", "Sea Captain", "Legend of the Sea" }
function F.tier(lv: number): number
	if lv >= 9 then return 5 end
	if lv >= 7 then return 4 end
	if lv >= 5 then return 3 end
	if lv >= 3 then return 2 end
	return 1
end

-- bucket levels
F.Bucket = {
	{ cap = 10, cost = 0, name = "Wooden Pail" },
	{ cap = 20, cost = 40_000, name = "Big Bucket" },
	{ cap = 40, cost = 150_000, name = "Fish Barrel" },
	{ cap = 80, cost = 600_000, name = "Golden Barrel" },
	{ cap = 150, cost = 2_500_000, name = "Royal Vat" },
}

-- the loop timings (seconds); the waiting time fills the rest of the interval
-- nominal timings (level 1). bait: worm from the creel onto the hook. unhook: he kneels,
-- pins the fish, takes the hook out, then shows it off. Higher levels play the same
-- animations faster (pace), so every gesture always fits.
F.Timing = { bait = 2.4, cast = 1.6, reel = 3.6, catch = 1.2, unhook = 3.4, drop = 2.0 }
function F.pace(lv: number): number
	return math.clamp(F.interval(lv) / F.BaseInterval, 0.55, 1)
end
function F.phaseTime(name: string, lv: number): number
	return F.Timing[name] * F.pace(lv)
end
function F.walkTime(lv: number): number
	return math.max(2.6, 5.2 * F.pace(lv))
end
function F.waitTime(lv: number): number
	local busy = 0
	for name in F.Timing do busy += F.phaseTime(name, lv) end
	return math.max(1.5, F.interval(lv) - busy - 2 * F.walkTime(lv))
end

-- places (feet positions) ---------------------------------------------------------------
local SAND_Y = 0.4

-- where the fisherman stands to fish: on the edge of the dock, near the shore (left /
-- right side), fishing over the side, facing out (-X / +X). Short walk to the bucket.
F.SPOT_Z = Layout.DOCK_START_Z + 13
function F.spot(base: number, slot: number): Vector3
	local c = Layout.BASE_CENTERS[base]
	local side = if slot == 1 then -1 else 1
	return Vector3.new(c.X + side * (Layout.DOCK_WIDTH / 2 - 1.3), Layout.DOCK_TOP_Y, F.SPOT_Z)
end
function F.facing(slot: number): Vector3
	return Vector3.new(if slot == 1 then -1 else 1, 0, 0)
end
function F.spotCF(base: number, slot: number): CFrame
	local p = F.spot(base, slot)
	return CFrame.lookAt(p, p + F.facing(slot))
end

-- the bucket: on the beach, just in front of the dock
function F.bucketPos(base: number): Vector3
	local c = Layout.BASE_CENTERS[base]
	return Vector3.new(c.X + 9, SAND_Y, Layout.DOCK_START_Z - 6)
end

-- where each fisherman stands to drop his fish in the bucket
function F.bucketStand(base: number, slot: number): Vector3
	local b = F.bucketPos(base)
	return if slot == 1 then b + Vector3.new(-2.6, 0, 0.6) else b + Vector3.new(0.4, 0, 2.6)
end

-- the walk from the fishing spot to the bucket (polyline of feet positions)
function F.path(base: number, slot: number): { Vector3 }
	local c = Layout.BASE_CENTERS[base]
	local side = if slot == 1 then -1 else 1
	local top = Layout.DOCK_TOP_Y
	return {
		F.spot(base, slot),
		Vector3.new(c.X + side * 2.6, top, F.SPOT_Z - 2),
		Vector3.new(c.X + side * 2.6, top, Layout.DOCK_START_Z + 1.5),
		Vector3.new(c.X + side * 2.6 + 1.5, SAND_Y, Layout.DOCK_START_Z - 1.5),
		F.bucketStand(base, slot),
	}
end

-- where the bobber lands for a fisherman
function F.bobber(base: number, slot: number, seed: number): Vector3
	local s = F.spot(base, slot)
	local side = if slot == 1 then -1 else 1
	local r = Random.new(seed)
	return Vector3.new(s.X + side * (8 + r:NextNumber() * 5), Layout.WATER_Y + 0.05, s.Z + (r:NextNumber() - 0.3) * 8)
end

return F
