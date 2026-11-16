--[[ CaptureService: from a landed fish to a bear in the player's arms.

   1. fish lands -> outcome rolled on the SERVER (species / rarity / variant / weight;
      every fish can give every bear, luck from zone depth + fish rarity/variant/weight)
   2. ONE bear of that exact outcome comes out of the nearest den, notices the fish,
      runs to it (pathfinding around decor), arrives, sniffs, eats (fish welded to its
      mouth, then swallowed), happy reaction, transformation
   3. the player's character BECOMES that bear (Humanoid rig, network owned by the
      player) and must run back to their own base (no teleport). Server watches speed
      (anti teleport), walkable area, timeout and death -> clean failure
   4. at the base: arrival reaction, back to human, the bear is saved (stored) and
      carried above the head until placed. ]]
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
local FishBuilder = require(Shared.Models.FishBuilder)
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
		local w = s.spawn
		if table.find(s.zones, zone) then w *= BearConfig.ZoneAffinity end
		out[id] = w
	end
	return out
end

function CaptureService.roll(fish, landing: Vector3, zone: number)
	local luck = CaptureService.luckFor(fish, landing, zone)
	local species = Rng.pickMap(rand, CaptureService.speciesWeights(zone))
	local rarity = Rng.pickMap(rand, RarityConfig.weights(luck, "bearOdds"))
	local fv = RarityConfig.Variants[fish.v] or RarityConfig.Variants.Normal
	local variant = Rng.pickMap(rand, RarityConfig.variantWeights(math.sqrt(luck) * fv.fishToBearLuck))
	local spec = BearConfig.get(species)
	local fishRatio = math.clamp(fish.w / FishConfig.get(fish.s).weight.avg, 0, 3)
	local w = Rng.skewed(rand, spec.weight.min, spec.weight.max, 2.4 / (1 + fishRatio * 0.5))
	return { s = species, r = rarity, v = variant, w = math.floor(w * 10 + 0.5) / 10 }, luck
end

local function cleanup(c)
	if c.agent then c.agent:destroy() c.agent = nil end
	if c.fishModel then c.fishModel:Destroy() c.fishModel = nil end
	if c.monitor then c.monitor = nil end
end

local function wait(c, seconds: number): boolean
	task.wait(seconds)
	return captures[c.player] == c and c.alive
end

local function stagesTimeline()
	local t = 0
	local tl = {}
	for _, k in { "arrive", "sniff", "eat", "happy", "transform" } do
		tl[k] = t
		t += G[k]
	end
	tl.total = t
	return tl
end

function CaptureService.begin(player: Player, fish, landing: Vector3, zone: number, power: number)
	if not R.State.set(player, "WaitingForBear") then return end
	local outcome, luck = CaptureService.roll(fish, landing, zone)
	local c = { player = player, fish = fish, outcome = outcome, zone = zone, alive = true, luck = luck }
	captures[player] = c

	-- the fish on the ground (lying on its side)
	local fm = FishBuilder.build(fish.s, { weight = fish.w, variant = fish.v })
	for _, d in fm:GetDescendants() do
		if d:IsA("BasePart") then d.Anchored = false d.CanCollide = false d.Massless = true end
	end
	fm.PrimaryPart.Anchored = true -- root anchored, joints stay animatable (flop)
	local fh = fm:GetAttribute("Height") or 1
	fm:PivotTo(CFrame.new(landing.X, fh * 0.32 + 0.15, landing.Z) * CFrame.Angles(0, rand:NextNumber() * 6.28, math.pi / 2))
	fm.Name = "LandedFish"
	fm:SetAttribute("Anim", "Flop")
	fm.Parent = R.MapService.fxFolder
	c.fishModel = fm

	-- pick the den: nearest one at least 22 studs away from the fish
	local dens = Layout.zoneDens(zone)
	table.sort(dens, function(a, b)
		return (a - landing).Magnitude < (b - landing).Magnitude
	end)
	local den = dens[1]
	for _, d in dens do
		if (d - landing).Magnitude >= 22 then den = d break end
	end
	local agent = R.BearAI.spawn({
		species = outcome.s, weight = outcome.w, variant = outcome.v, rarity = outcome.r,
		cf = CFrame.lookAt(den, Vector3.new(landing.X, 0, landing.Z)), mode = "Responder",
	})
	c.agent = agent
	agent:setAnim("Idle")
	fx(player, "Spawned", { bear = agent.model, fish = fm, landing = landing, den = den })

	task.spawn(function()
		-- 1) notice the fish
		if not wait(c, 0.35) then return end
		agent:setAnim("Alert")
		agent:face(landing)
		fx(player, "Alert", {})
		if not wait(c, G.alert) then return end
		-- 2) run to the fish, stop with the muzzle over it
		local bodyLen = agent.model:GetAttribute("BodyLength") or 6
		local here = agent.root.Position
		local dir = Vector3.new(here.X - landing.X, 0, here.Z - landing.Z)
		dir = if dir.Magnitude > 0.1 then dir.Unit else Vector3.new(1, 0, 0)
		local stop = Vector3.new(landing.X, 0, landing.Z) + dir * (bodyLen * 0.5 + 0.6)
		local points = R.BearAI.route(here, stop, 2 + 1.5 * agent.scale)
		local arrived = false
		agent:moveTo(points, G.runSpeed, "Run", function()
			arrived = true
		end)
		fx(player, "Run", { duration = (here - stop).Magnitude / G.runSpeed })
		local t0 = os.clock()
		while not arrived and os.clock() - t0 < 14 do
			if not wait(c, 0.1) then return end
		end
		agent:hold()
		agent:face(landing)
		if not R.State.set(player, "WatchingEatingCinematic") then
			CaptureService.abort(player, "state")
			return
		end
		-- 3) eating cinematic (timeline shared with the client camera)
		local tl = stagesTimeline()
		local start = workspace:GetServerTimeNow()
		fx(player, "Eat", { start = start, tl = tl, bear = agent.model, fish = fm })
		agent:setAnim("Arrive")
		if not wait(c, G.arrive) then return end
		agent:setAnim("Sniff")
		if not wait(c, G.sniff) then return end
		agent:setAnim("Eat")
		if not wait(c, G.pickupAt) then return end
		-- pick the fish up with the mouth
		local head = agent.model:FindFirstChild("Head")
		local mouth = head and head:FindFirstChild("MouthAtt")
		if mouth and fm.Parent then
			for _, d in fm:GetDescendants() do
				if d:IsA("BasePart") then d.Anchored = false d.Massless = true end
			end
			fm:PivotTo(mouth.WorldCFrame * CFrame.Angles(0, math.pi / 2, 0))
			local weld = Instance.new("WeldConstraint")
			weld.Part0 = head :: BasePart
			weld.Part1 = fm.PrimaryPart
			weld.Parent = fm.PrimaryPart
			fm:SetAttribute("Anim", "Eaten")
		end
		if not wait(c, G.swallowAt - G.pickupAt) then return end
		if c.fishModel then
			c.fishModel:Destroy()
			c.fishModel = nil
		end
		if not wait(c, G.eat - G.swallowAt) then return end
		agent:setAnim("Happy")
		if not wait(c, G.happy) then return end
		-- poof: the bear leaves the zone and appears in the player's hands
		agent:setAnim("Happy")
		if not wait(c, G.transform) then return end
		CaptureService.giveToPlayer(player, c)
	end)
end

function CaptureService.transform(player: Player, c)
	local agent = c.agent
	if not agent or not player.Parent then
		CaptureService.abort(player, "gone")
		return
	end
	local cf = agent.root.CFrame
	local o = c.outcome
	local bear = BearBuilder.build(o.s, { weight = o.w, variant = o.v, rarity = o.r, character = true })
	bear.Name = player.Name
	bear:SetAttribute("IsBear", true)
	bear:SetAttribute("Owner", player.UserId)
	local spec = BearConfig.get(o.s)
	local scale = bear:GetAttribute("Scale")
	local speed = spec.speed * math.clamp(scale ^ 0.25, 0.9, 1.12)
	bear:SetAttribute("BaseSpeed", speed)
	local hum = bear:FindFirstChildOfClass("Humanoid")
	hum.WalkSpeed = speed
	local rootY = bear.PrimaryPart.Position.Y
	bear:PivotTo(CFrame.new(cf.Position.X, rootY + 0.1, cf.Position.Z) * cf.Rotation)
	agent:destroy()
	c.agent = nil

	local old = player.Character
	bear:SetAttribute("Anim", "Idle")
	player.Character = bear
	bear.Parent = workspace
	if old then old:Destroy() end
	pcall(function() bear.PrimaryPart:SetNetworkOwner(player) end)
	R.State.set(player, "ControllingBear")
	c.bearChar = bear
	c.started = os.clock()
	c.lastPos = bear.PrimaryPart.Position
	c.lastT = os.clock()
	c.violations = 0
	c.maxSpeed = speed * G.sprintMultiplier
	hum.Died:Connect(function()
		if captures[player] == c and R.State.get(player) == "ControllingBear" then
			CaptureService.fail(player, "Your bear got lost!")
		end
	end)
	local base = R.BaseService.get(player)
	fx(player, "Controlling", {
		bear = bear, outcome = o, base = base, timeout = G.returnTimeout,
		income = Formulas.bearIncome(o),
	})
end

-- the eaten-fish bear goes directly into the player's arms (no transformation)
function CaptureService.giveToPlayer(player: Player, c)
	c.alive = false
	captures[player] = nil
	local o = c.outcome
	local from = c.agent and c.agent.root.Position or Vector3.zero
	if c.agent then c.agent:destroy() c.agent = nil end
	if c.fishModel then c.fishModel:Destroy() c.fishModel = nil end
	if not player.Parent then return end
	local data = R.PlayerData.get(player)
	local id = R.PlayerData.newId(player)
	local record = { id = id, s = o.s, r = o.r, v = o.v, w = o.w, placed = false, t = os.time() }
	data.bears[id] = record
	data.stats.bears += 1
	local isNew = R.IndexService.discoverBear(player, record)
	R.PlayerData.push(player, "bears")
	R.State.set(player, "CarryingCapturedBear", true)
	local char = player.Character
	if char and not char:GetAttribute("IsBear") then
		R.EquipService.equipBear(player, record)
		-- the bear celebrates in your arms, then settles
		local held = char:FindFirstChild("TFBHeld")
		if held then
			held:SetAttribute("Anim", "Happy")
			held:SetAttribute("AnimT", workspace:GetServerTimeNow())
			task.delay(2.2, function()
				if held.Parent then held:SetAttribute("Anim", "Carried") end
			end)
		end
	end
	fx(player, "Captured", { bear = record, income = Formulas.bearIncome(record), isNew = isNew, from = from })
end

function CaptureService.complete(player: Player, c)
	c.alive = false
	local bear = c.bearChar
	local o = c.outcome
	local hum = bear and bear:FindFirstChildOfClass("Humanoid")
	local spawnPos = bear and bear.PrimaryPart and bear.PrimaryPart.Position or Layout.baseSpawn(R.BaseService.get(player) or 1).Position
	if hum then
		hum.WalkSpeed = 0
		hum.JumpPower = 0
		bear:SetAttribute("Anim", "Happy")
		bear:SetAttribute("AnimT", workspace:GetServerTimeNow())
	end
	-- the bear is saved immediately (stored), so leaving now never loses it
	local data = R.PlayerData.get(player)
	local id = R.PlayerData.newId(player)
	local record = { id = id, s = o.s, r = o.r, v = o.v, w = o.w, placed = false, t = os.time() }
	data.bears[id] = record
	data.stats.bears += 1
	local isNew = R.IndexService.discoverBear(player, record)
	R.PlayerData.push(player, "bears")
	fx(player, "Arrived", { outcome = o })
	task.wait(G.arrivalHappy)
	if not player.Parent then return end
	captures[player] = nil
	player:SetAttribute("SpawnAt", spawnPos)
	R.State.set(player, "CarryingCapturedBear", true)
	if bear then bear:Destroy() end
	player:LoadCharacter()
	local char = player.Character
	if char then
		char:WaitForChild("HumanoidRootPart", 5)
		task.wait(0.15)
		R.EquipService.equipBear(player, record)
	end
	fx(player, "Captured", { bear = record, income = Formulas.bearIncome(record), isNew = isNew })
end

function CaptureService.fail(player: Player, reason: string)
	local c = captures[player]
	if not c then return end
	c.alive = false
	captures[player] = nil
	local bearChar = c.bearChar
	local pos = bearChar and bearChar.PrimaryPart and bearChar.PrimaryPart.Position
	-- the bear walks back to its zone (if it is still somewhere sensible)
	if pos and Layout.isWalkable(pos) and c.outcome then
		local dens = Layout.zoneDens(c.zone)
		local agent = R.BearAI.spawn({
			species = c.outcome.s, weight = c.outcome.w, variant = c.outcome.v, rarity = c.outcome.r,
			cf = CFrame.new(pos.X, 0, pos.Z), mode = "Return",
		})
		agent:moveTo({ dens[1] }, 14, "Run", function(a) a:destroy() end)
		task.delay(40, function()
			if agent.alive then agent:destroy() end
		end)
	end
	cleanup(c)
	if bearChar then bearChar:Destroy() end
	R.State.set(player, "Idle", true)
	if player.Parent then
		player:SetAttribute("SpawnAt", nil)
		player:LoadCharacter()
		fx(player, "Failed", { reason = reason })
		R.Notify(player, reason .. " It ran back to its zone.", "warn")
	end
end

-- cancel before the transformation (player died / left / state broke)
function CaptureService.abort(player: Player, why: string?)
	local c = captures[player]
	if not c then return end
	c.alive = false
	captures[player] = nil
	cleanup(c)
	if c.bearChar then
		CaptureService.fail(player, "Capture cancelled.")
		return
	end
	if player.Parent then
		R.State.set(player, "Idle", true)
		fx(player, "Failed", { reason = why or "cancelled" })
	end
end

function CaptureService.active(player: Player)
	return captures[player]
end

-- monitor controlled bears (5 Hz)
task.spawn(function()
	while true do
		task.wait(0.2)
		for player, c in captures do
			if c.bearChar and c.alive and R.State.get(player) == "ControllingBear" then
				local root = c.bearChar.PrimaryPart
				if not root or not c.bearChar.Parent then
					CaptureService.fail(player, "Your bear got lost!")
					continue
				end
				local now = os.clock()
				local pos = root.Position
				local dt = now - c.lastT
				local moved = Vector3.new(pos.X - c.lastPos.X, 0, pos.Z - c.lastPos.Z).Magnitude
				if dt > 0 and moved / dt > c.maxSpeed * G.maxSpeedTolerance + 8 then
					c.violations += 1
					if c.violations >= 3 then
						CaptureService.fail(player, "Movement rejected!")
						continue
					end
				else
					c.violations = math.max(0, c.violations - 0.2)
				end
				c.lastPos = pos
				c.lastT = now
				if not Layout.isWalkable(pos) then
					CaptureService.fail(player, "Your bear fell somewhere it shouldn't!")
				elseif now - c.started > G.returnTimeout then
					CaptureService.fail(player, "Too slow!")
				else
					local base = R.BaseService.get(player)
					if base and Layout.isInBase(base, pos, 2) then
						task.spawn(CaptureService.complete, player, c)
					end
				end
			end
		end
	end
end)

-- ambient wildlife in each zone (decorative, never answers a fish)
function CaptureService.spawnAmbient()
	for i = 1, Layout.ZONE_COUNT do
		local z = ZoneConfig.get(i)
		local rects = Layout.zoneRoamRects(i)
		for k, species in z.ambient do
			local r = rects[(k - 1) % #rects + 1]
			local spec = BearConfig.get(species)
			local p = Vector3.new((r.minX + r.maxX) / 2, 0, r.minZ + (r.maxZ - r.minZ) * (k / (#z.ambient + 1)))
			local agent = R.BearAI.spawn({
				species = species, weight = spec.weight.min + (spec.weight.ref - spec.weight.min) * rand:NextNumber(),
				cf = CFrame.new(p) * CFrame.Angles(0, rand:NextNumber() * 6.28, 0), mode = "Zone", rects = rects,
			})
			agent.timer = rand:NextNumber() * 4
		end
	end
end

Players.PlayerRemoving:Connect(function(player)
	local c = captures[player]
	if c then
		c.alive = false
		captures[player] = nil
		cleanup(c)
		if c.bearChar then c.bearChar:Destroy() end
	end
end)

CaptureService.BearBuilder = BearBuilder
return CaptureService
