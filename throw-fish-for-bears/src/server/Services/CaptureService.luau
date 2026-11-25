--[[ CaptureService: from a landed fish to a new animal, decided ON THE SERVER.

   1. fish lands -> outcome rolled (species / rarity / variant / weight; luck from zone
      depth + fish rarity / variant / weight) and SAVED at once (leaving never loses it),
      Index updated (NEW!), the real probability "1 IN X" computed
   2. the client plays the reveal (~8 s): the fish turns into a black "1 IN ?" slot machine
      that morphs between animals and grows, then the animal in colour + its texts
   3. GO BACK (button, or automatically after a while): the player is sent back to their base
      and the animal goes to the base (placed if there is room, else carried). ]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local Layout = require(Shared.Layout)
local GameConfig = require(Shared.Config.GameConfig)
local BearConfig = require(Shared.Config.BearConfig)
local FishConfig = require(Shared.Config.FishConfig)
local ZoneConfig = require(Shared.Config.ZoneConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local BearBuilder = require(Shared.Models.BearBuilder)
local Rng = require(Shared.Util.Rng)
local Formulas = require(Shared.Formulas)
local R = require(script.Parent.Parent.Registry)

local CaptureService = {}
local rand = Random.new()
local G = GameConfig.Capture
local captures: { [Player]: any } = {}

local function fx(player: Player, phase: string, data: any)
	Net.event("CaptureFx"):FireClient(player, phase, data)
end

-- luck for the bear roll
function CaptureService.luckFor(fish, landing: Vector3, zone: number): number
	local z = ZoneConfig.get(zone)
	local a, b = Layout.zoneRange(zone)
	local depth = math.clamp((a - landing.Z) / (a - b), 0, 1)
	local spec = FishConfig.get(fish.s)
	local tier = RarityConfig.get(spec.rarity)
	local variant = RarityConfig.Variants[fish.v] or RarityConfig.Variants.Normal
	local weightK = 1 + 0.25 * math.clamp(fish.w / spec.weight.avg - 1, 0, 3)
	return z.luck * (1 + (z.depthLuck - 1) * depth) * tier.fishToBearLuck * variant.fishToBearLuck * weightK
end

function CaptureService.speciesWeights(zone: number): { [string]: number }
	local out = {}
	for _, id in BearConfig.Order do
		local s = BearConfig.get(id)
		if s.fixedRarity then continue end -- one-of-a-kind species (Impossible) are never rolled here
		-- every species (bears AND animals) has the SAME base chance; its home zones still
		-- make it much more likely there
		local w = 1
		if table.find(s.zones, zone) then w *= BearConfig.ZoneAffinity end
		out[id] = w
	end
	return out
end

function CaptureService.roll(fish, landing: Vector3, zone: number)
	local luck = CaptureService.luckFor(fish, landing, zone)
	local species = Rng.pickMap(rand, CaptureService.speciesWeights(zone))
	local rarity = Rng.pickMap(rand, RarityConfig.weights(luck, "bearOdds"))
	-- luck bonus: a second roll with boosted luck, the better rarity wins
	local baseRarity, mult = rarity, nil
	local roll = rand:NextNumber()
	local acc = 0
	for _, b in G.luckBonus do
		acc += b.chance
		if roll < acc then
			local boosted = Rng.pickMap(rand, RarityConfig.weights(luck * b.mult, "bearOdds"))
			if RarityConfig.index(boosted) > RarityConfig.index(rarity) then
				rarity = boosted
				mult = b.mult
			end
			break
		end
	end
	if rarity == "Impossible" then
		species = "CosmicBear" -- the one and only Impossible bear
	end
	local fv = RarityConfig.Variants[fish.v] or RarityConfig.Variants.Normal
	local variant = Rng.pickMap(rand, RarityConfig.variantWeights(math.sqrt(luck) * fv.fishToBearLuck))
	local spec = BearConfig.get(species)
	local fishRatio = math.clamp(fish.w / FishConfig.get(fish.s).weight.avg, 0, 3)
	local w = Rng.skewed(rand, spec.weight.min, spec.weight.max, 2.4 / (1 + fishRatio * 0.5))
	-- a MUTATED fish makes a heavier bear (Golden +25% ... Clockwork +200%)
	w *= 1 + (fv.kgBonus or 0)
	return { s = species, r = rarity, v = variant, w = math.floor(w * 10 + 0.5) / 10, baseR = baseRarity, mult = mult }, luck
end

-- the REAL probability of this exact outcome (species x rarity x mutation), as "1 IN X"
function CaptureService.oneIn(o, luck: number, zone: number, fish): number
	local function share(map, key): number
		local tot = 0
		for _, w in map do tot += w end
		return (map[key] or 0) / math.max(tot, 1e-12)
	end
	local ps = if o.r == "Impossible" then 1 else share(CaptureService.speciesWeights(zone), o.s)
	local pr = share(RarityConfig.weights(luck * (o.mult or 1), "bearOdds"), o.r)
	local fv = RarityConfig.Variants[fish.v] or RarityConfig.Variants.Normal
	local pv = share(RarityConfig.variantWeights(math.sqrt(luck) * fv.fishToBearLuck), o.v or "Normal")
	local p = ps * pr * pv
	if p <= 0 then return 1 end
	return math.max(1, math.floor(1 / p + 0.5))
end

function CaptureService.begin(player: Player, fish, landing: Vector3, zone: number, _power: number)
	if not R.State.set(player, "WaitingForBear") then return end
	local data = R.PlayerData.get(player)
	if not data then
		R.State.set(player, "Idle", true)
		return
	end
	local outcome, luck = CaptureService.roll(fish, landing, zone)
	-- saved right now: a disconnect during the reveal never loses the animal
	local id = R.PlayerData.newId(player)
	local record = { id = id, s = outcome.s, r = outcome.r, v = outcome.v, w = outcome.w, placed = false, t = os.time() }
	data.bears[id] = record
	data.stats.bears += 1
	local isNew = R.IndexService.discoverBear(player, record)
	R.PlayerData.push(player, "bears")
	local RV = G.Reveal
	local oneIn = CaptureService.oneIn(outcome, luck, zone, fish)
	local revealLen = RV.total + GameConfig.revealPauses(oneIn) * RV.pause -- longer for rarer ones
	local c = {
		player = player, fish = fish, outcome = outcome, zone = zone, alive = true, luck = luck,
		record = record, isNew = isNew, revealEnd = os.clock() + revealLen,
	}
	captures[player] = c
	R.State.set(player, "WatchingEatingCinematic", true)
	fx(player, "Reveal", {
		landing = Vector3.new(landing.X, Layout.groundY(landing), landing.Z),
		fish = { s = fish.s, w = fish.w, v = fish.v },
		outcome = outcome, oneIn = oneIn, isNew = isNew,
		income = Formulas.bearIncome(record), luck = luck * (outcome.mult or 1), weight = outcome.w,
		canSkip = data.stats.bears > 1,
	})
	task.delay(revealLen + 0.4, function()
		if player.Parent then R.Announce.bear(player, record) end
	end)
	-- nobody stays stuck on the result screen
	task.delay(revealLen + RV.autoBack, function()
		if captures[player] == c and c.alive then CaptureService.goBack(player, true) end
	end)
end

-- GO BACK: back to the base, the animal goes to the base with you
function CaptureService.goBack(player: Player, force: boolean?)
	local c = captures[player]
	if not c or not c.alive then return end
	if not force and os.clock() < c.revealEnd - 0.6 then return end -- the reveal plays to the end
	c.alive = false
	captures[player] = nil
	R.State.set(player, "Idle", true)
	if not player.Parent then return end
	local record = c.record
	local base = R.BaseService.get(player)
	local char = player.Character
	if base and char and char.PrimaryPart then
		char:PivotTo(Layout.baseSpawn(base))
	end
	-- the new animal is IN YOUR ARMS when you get back: place it in your base (or store it)
	local placed = false
	if char and char.Parent and not char:GetAttribute("IsBear") then
		R.EquipService.equipBear(player, record)
		R.State.set(player, "CarryingCapturedBear", true)
	end
	fx(player, "Captured", { bear = record, income = Formulas.bearIncome(record), isNew = c.isNew, placed = placed })
end

-- skip the reveal (only once you already own animals): straight to GO BACK
function CaptureService.skip(player: Player)
	local c = captures[player]
	local data = R.PlayerData.get(player)
	if not c or not c.alive or not data or data.stats.bears < 2 then return end
	CaptureService.goBack(player, true)
end

-- the player died / left during the reveal: the animal is already saved in storage
function CaptureService.abort(player: Player, why: string?)
	local c = captures[player]
	if not c then return end
	c.alive = false
	captures[player] = nil
	if player.Parent then
		R.State.set(player, "Idle", true)
		fx(player, "Failed", { reason = why or "cancelled" })
	end
end

function CaptureService.active(player: Player)
	return captures[player]
end

-- ambient wildlife in each zone (decorative, never answers a fish)
function CaptureService.spawnAmbient()
	for i = 1, Layout.ZONE_COUNT do
		local z = ZoneConfig.get(i)
		local rects = Layout.zoneRoamRects(i)
		-- the zone's own wildlife: its bears + up to 2 of the animals that live there
		local list = table.clone(z.ambient)
		local added = 0
		for _, id in BearConfig.Order do
			local spec = BearConfig.get(id)
			if spec.isAnimal and spec.zones[1] == i and added < 2 then
				table.insert(list, id)
				added += 1
			end
		end
		for k, species in list do
			local r = rects[(k - 1) % #rects + 1]
			local spec = BearConfig.get(species)
			local p = Vector3.new((r.minX + r.maxX) / 2, Layout.CORRIDOR_Y, r.minZ + (r.maxZ - r.minZ) * (k / (#list + 1)))
			local agent = R.BearAI.spawn({
				species = species, weight = spec.weight.min + (spec.weight.ref - spec.weight.min) * rand:NextNumber(),
				cf = CFrame.new(p) * CFrame.Angles(0, rand:NextNumber() * 6.28, 0), mode = "Zone", rects = rects,
				brickBudget = 60, -- wildlife far away: a lighter brick relief
			})
			agent.timer = rand:NextNumber() * 4
		end
	end
end

Players.PlayerRemoving:Connect(function(player)
	local c = captures[player]
	if c then
		c.alive = false
		captures[player] = nil -- the animal was saved when the reveal started
	end
end)

CaptureService.BearBuilder = BearBuilder
return CaptureService
