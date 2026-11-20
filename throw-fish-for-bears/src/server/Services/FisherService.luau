--[[ FisherService: the 2 hireable fishermen on each player's dock + their bucket.
     - A see-through silhouette stands on the dock with a "Hire" prompt (slot 1 first;
       the 2nd silhouette appears once the 1st fisherman is hired).
     - Each fisherman loops: cast -> wait -> fight -> catch -> walk to the bucket -> drop
       the fish in -> walk back. Every phase is published as attributes (Phase, PhaseT,
       PhaseDur) and the CLIENT animates it (FisherController) from those exact times.
     - The fish are real rolls (the player's luck x the fisherman's level luck), stored in
       the bucket (saved). When the bucket is full the fisherman waits next to it.
     - The bucket: "Collect" prompt moves the fish into the player's bag; "Upgrade" prompt
       grows its capacity (new look per level).
     - Fishermen level up (faster, luckier) and their outfit improves every 2 levels. ]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local Format = require(Shared.Util.Format)
local E = require(Shared.Config.EconomyConfig)
local F = require(Shared.Config.FisherConfig)
local FishConfig = require(Shared.Config.FishConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local FisherBuilder = require(Shared.Models.FisherBuilder)
local BucketBuilder = require(Shared.Models.BucketBuilder)
local R = require(script.Parent.Parent.Registry)

local FisherService = {}
local per = {} -- [player] = { base, folder, slots = {}, ghost, bucket, alive }

local function now(): number
	return workspace:GetServerTimeNow()
end

local function dataOf(player: Player)
	local data = R.PlayerData.get(player)
	if not data then return nil end
	if type(data.fishers) ~= "table" then data.fishers = { n = 0, lv = { 1, 1 }, bucket = 1, stored = {} } end
	return data.fishers
end

local function prompt(parent: Instance, kind: string, action: string, object: string, owner: Player, key: Enum.KeyCode?, offsetY: number?)
	local p = Instance.new("ProximityPrompt")
	p.Name = "TFBPrompt"
	p.ActionText = action
	p.ObjectText = object
	p.KeyboardKeyCode = key or Enum.KeyCode.F
	p.GamepadKeyCode = if key == Enum.KeyCode.G then Enum.KeyCode.ButtonY else Enum.KeyCode.ButtonX
	p.HoldDuration = 0
	p.MaxActivationDistance = 12
	p.RequiresLineOfSight = false
	p.UIOffset = Vector2.new(0, offsetY or 0)
	p:SetAttribute("TFBPrompt", kind)
	p:SetAttribute("Owner", owner.UserId)
	p.Parent = parent
	return p
end

-- BUCKET -----------------------------------------------------------------------------
local function bucketCap(fd): number
	return F.Bucket[math.clamp(fd.bucket, 1, #F.Bucket)].cap
end

local function refreshBucket(player: Player)
	local st = per[player]
	local fd = dataOf(player)
	if not st or not fd or not st.bucket then return end
	local cap = bucketCap(fd)
	local n = #fd.stored
	local m = st.bucket
	m:SetAttribute("Count", n)
	m:SetAttribute("Cap", cap)
	m:SetAttribute("Level", fd.bucket)
	-- the water / fish level inside
	local fill = m:FindFirstChild("Fill") :: BasePart?
	if fill then
		local pivot = m:GetPivot()
		local bottom = m:GetAttribute("Bottom") or 0.6
		local depth = m:GetAttribute("Depth") or 1.2
		local k = math.clamp(n / cap, 0, 1)
		local hgt = 0.15 + depth * 0.92 * k
		fill.Size = Vector3.new(hgt, fill.Size.Y, fill.Size.Z)
		fill.CFrame = pivot * CFrame.new(0, bottom + hgt / 2, 0) * CFrame.Angles(0, 0, math.pi / 2)
		fill.Transparency = if n == 0 then 1 else 0.15
	end
	-- prompts text
	local anchor = m:FindFirstChild("Anchor")
	if anchor then
		for _, p in anchor:GetChildren() do
			if p:IsA("ProximityPrompt") then
				local kind = p:GetAttribute("TFBPrompt")
				if kind == "CollectBucket" then
					p.ObjectText = ("%d / %d fish"):format(n, cap)
				elseif kind == "UpgradeBucket" then
					local nxt = F.Bucket[fd.bucket + 1]
					p.ActionText = if nxt then ("Upgrade Bucket (%d)"):format(nxt.cap) else "Bucket MAX"
					p.ObjectText = if nxt then Format.money(nxt.cost) else ""
				end
			end
		end
	end
end

local function buildBucket(player: Player)
	local st = per[player]
	local fd = dataOf(player)
	if not st or not fd then return end
	if st.bucket then st.bucket:Destroy() end
	local m = BucketBuilder.build(fd.bucket)
	m:PivotTo(CFrame.new(F.bucketPos(st.base)) * CFrame.Angles(0, math.pi, 0))
	m:SetAttribute("Owner", player.UserId)
	m:SetAttribute("Base", st.base)
	m.Parent = st.folder
	st.bucket = m
	local anchor = m:FindFirstChild("Anchor")
	if anchor then
		prompt(anchor, "CollectBucket", "Collect Fish", "", player, Enum.KeyCode.F, 0)
		prompt(anchor, "UpgradeBucket", "Upgrade Bucket", "", player, Enum.KeyCode.G, 72)
	end
	refreshBucket(player)
end

-- FISHERMEN ------------------------------------------------------------------------------
local function setPhase(m: Model, name: string, dur: number)
	m:SetAttribute("Phase", name)
	m:SetAttribute("PhaseT", now())
	m:SetAttribute("PhaseDur", dur)
end

local function refreshFisherPrompt(player: Player, slot: number)
	local st = per[player]
	local fd = dataOf(player)
	local s = st and st.slots[slot]
	if not s or not s.model or not fd then return end
	local lv = fd.lv[slot] or 1
	s.model:SetAttribute("Level", lv)
	local p = s.prompt
	if p then
		if lv >= F.MaxLevel then
			p.ActionText = "MAX LEVEL"
			p.ObjectText = F.TierNames[F.tier(lv)]
		else
			p.ActionText = ("Upgrade  Lv.%d -> %d"):format(lv, lv + 1)
			p.ObjectText = Format.money(F.levelCost(slot, lv))
		end
	end
end

local function buildFisherModel(player: Player, slot: number)
	local st = per[player]
	local fd = dataOf(player)
	if not st or not fd then return end
	local s = st.slots[slot]
	local lv = fd.lv[slot] or 1
	local old = s.model
	local m = FisherBuilder.build(slot, F.tier(lv))
	m.Name = "Fisher" .. slot
	m:SetAttribute("Owner", player.UserId)
	m:SetAttribute("Base", st.base)
	m:SetAttribute("Level", lv)
	m:SetAttribute("Seed", math.random(1, 1e6))
	if old then
		-- keep the running phase (the client continues the animation seamlessly)
		for _, a in { "Phase", "PhaseT", "PhaseDur", "CarryFish", "CarryW", "CarryV", "Seed" } do
			m:SetAttribute(a, old:GetAttribute(a))
		end
		m:PivotTo(old:GetPivot())
		old:Destroy()
	else
		m:PivotTo(F.spotCF(st.base, slot))
	end
	m.Parent = st.folder
	s.model = m
	local torso = m:FindFirstChild("Torso")
	if torso then
		s.prompt = prompt(torso, "UpgradeFisher", "Upgrade", "", player)
		s.prompt:SetAttribute("Slot", slot)
	end
	refreshFisherPrompt(player, slot)
end

-- one fisherman's loop (server truth; the client animates the published phases)
local function runFisher(player: Player, slot: number)
	local st = per[player]
	local s = st.slots[slot]
	local function alive(): boolean
		return per[player] == st and st.alive and s.model ~= nil and s.model.Parent ~= nil
	end
	local function phase(name: string, dur: number): boolean
		if not alive() then return false end
		setPhase(s.model, name, dur)
		task.wait(dur)
		return alive()
	end
	task.wait(math.random() * 2)
	while alive() do
		local fd = dataOf(player)
		if not fd then return end
		local lv = fd.lv[slot] or 1
		s.model:SetAttribute("Seed", math.random(1, 1e6)) -- new bobber spot every cast
		local pt = function(n) return F.phaseTime(n, lv) end
		if not phase("Bait", pt("bait")) then return end
		if not phase("Cast", pt("cast")) then return end
		if not phase("Wait", F.waitTime(lv)) then return end
		if not phase("Reel", pt("reel")) then return end
		-- the catch: a real roll with the player's luck x the fisherman's luck
		local ok, fish = pcall(R.FishingService.rollFish, player, F.luck(lv))
		if not ok or type(fish) ~= "table" then
			warn("[TFB] fisher roll", fish)
			fish = nil
		end
		if fish then
			s.model:SetAttribute("CarryFish", fish.s)
			s.model:SetAttribute("CarryW", fish.w)
			s.model:SetAttribute("CarryV", fish.v)
			-- a "big one" (heavy for its species or rare): he celebrates; a small one: shrug
			local spec = FishConfig.get(fish.s)
			local rel = if spec then (fish.w - spec.weight.min) / math.max(0.01, spec.weight.max - spec.weight.min) else 0.5
			local rar = if spec then RarityConfig.get(spec.rarity).index else 1
			s.model:SetAttribute("CarryBig", rel > 0.55 or rar >= 4)
		end
		if not phase("Catch", pt("catch")) then return end
		if not phase("Unhook", pt("unhook")) then return end
		local walk = F.walkTime(lv)
		if not phase("ToBucket", walk) then return end
		s.model:PivotTo(CFrame.lookAt(F.bucketStand(st.base, slot), F.bucketPos(st.base) * Vector3.new(1, 0, 1) + Vector3.new(0, F.bucketStand(st.base, slot).Y, 0)))
		-- bucket full: wait next to it, tapping a foot
		while alive() and #dataOf(player).stored >= bucketCap(dataOf(player)) do
			if s.model:GetAttribute("Phase") ~= "Full" then setPhase(s.model, "Full", 1) end
			task.wait(0.5)
		end
		if not alive() then return end
		local dropT = F.phaseTime("drop", lv)
		setPhase(s.model, "Drop", dropT)
		task.wait(dropT * 0.4)
		if not alive() then return end
		local fd2 = dataOf(player)
		if fish and fd2 and #fd2.stored < bucketCap(fd2) then
			table.insert(fd2.stored, fish)
			refreshBucket(player)
			Net.event("FisherFx"):FireClient(player, "Dropped", { base = st.base, slot = slot, count = #fd2.stored, cap = bucketCap(fd2) })
		end
		task.wait(dropT * 0.6)
		s.model:SetAttribute("CarryFish", nil)
		if not phase("Back", walk) then return end
		s.model:PivotTo(F.spotCF(st.base, slot))
	end
end

local function startFisher(player: Player, slot: number)
	local st = per[player]
	if not st or st.slots[slot] then return end
	st.slots[slot] = {}
	buildFisherModel(player, slot)
	task.spawn(runFisher, player, slot)
end

-- the "hire me" silhouette for the next free slot
local function refreshGhost(player: Player)
	local st = per[player]
	local fd = dataOf(player)
	if not st or not fd then return end
	if st.ghost then
		st.ghost:Destroy()
		st.ghost = nil
	end
	local slot = fd.n + 1
	if slot > F.MaxSlots then return end
	local g = FisherBuilder.build(slot, 1, { ghost = true })
	g.Name = "FisherGhost"
	g:SetAttribute("Owner", player.UserId)
	g:SetAttribute("Base", st.base)
	g:SetAttribute("Fisher", nil)
	g:SetAttribute("GhostSlot", slot)
	g:SetAttribute("Price", F.HirePrice[slot])
	g:PivotTo(F.spotCF(st.base, slot))
	g.Parent = st.folder
	st.ghost = g
	local torso = g:FindFirstChild("Torso")
	if torso then
		local p = prompt(torso, "HireFisher", "Hire Fisherman", Format.money(F.HirePrice[slot]), player)
		p:SetAttribute("Slot", slot)
	end
end

-- API --------------------------------------------------------------------------------
function FisherService.setup(player: Player)
	if per[player] then return end
	local base = R.BaseService.get(player)
	local fd = dataOf(player)
	if not base or not fd then return end
	local folder = Instance.new("Folder")
	folder.Name = "Fishers_" .. base
	folder.Parent = R.MapService.fxFolder or workspace
	per[player] = { base = base, folder = folder, slots = {}, alive = true }
	buildBucket(player)
	for slot = 1, math.min(fd.n, F.MaxSlots) do
		startFisher(player, slot)
	end
	refreshGhost(player)
end

function FisherService.cleanup(player: Player)
	local st = per[player]
	if not st then return end
	st.alive = false
	per[player] = nil
	st.folder:Destroy()
end

function FisherService.hire(player: Player, slot: number)
	local st = per[player]
	local fd = dataOf(player)
	if not st or not fd then return end
	if slot ~= fd.n + 1 or slot > F.MaxSlots then return end
	local price = F.HirePrice[slot]
	if not R.EconomyService.spend(player, price) then
		R.Notify(player, ("You need %s to hire this fisherman!"):format(Format.money(price)), "warn")
		return
	end
	fd.n = slot
	fd.lv[slot] = 1
	R.PlayerData.push(player, "fishers")
	local at = st.ghost and st.ghost:GetPivot()
	refreshGhost(player)
	startFisher(player, slot)
	R.Notify(player, "Fisherman hired! He will fill your bucket on the beach.", "good")
	Net.event("FisherFx"):FireClient(player, "Hired", { base = st.base, slot = slot, at = at and at.Position })
end

function FisherService.upgrade(player: Player, slot: number)
	local st = per[player]
	local fd = dataOf(player)
	if not st or not fd or not st.slots[slot] then return end
	local lv = fd.lv[slot] or 1
	if lv >= F.MaxLevel then return end
	local cost = F.levelCost(slot, lv)
	if not R.EconomyService.spend(player, cost) then
		R.Notify(player, ("You need %s for this upgrade!"):format(Format.money(cost)), "warn")
		return
	end
	local oldTier = F.tier(lv)
	fd.lv[slot] = lv + 1
	R.PlayerData.push(player, "fishers")
	if F.tier(lv + 1) ~= oldTier then
		buildFisherModel(player, slot) -- new outfit!
	else
		refreshFisherPrompt(player, slot)
	end
	local m = st.slots[slot].model
	Net.event("FisherFx"):FireClient(player, "Upgraded", { base = st.base, slot = slot, level = lv + 1, tier = F.tier(lv + 1),
		newOutfit = F.tier(lv + 1) ~= oldTier, at = m and m:GetPivot().Position })
end

function FisherService.upgradeBucket(player: Player)
	local st = per[player]
	local fd = dataOf(player)
	if not st or not fd then return end
	local nxt = F.Bucket[fd.bucket + 1]
	if not nxt then return end
	if not R.EconomyService.spend(player, nxt.cost) then
		R.Notify(player, ("You need %s for a bigger bucket!"):format(Format.money(nxt.cost)), "warn")
		return
	end
	fd.bucket += 1
	R.PlayerData.push(player, "fishers")
	buildBucket(player)
	Net.event("FisherFx"):FireClient(player, "BucketUp", { base = st.base, level = fd.bucket, cap = nxt.cap, at = F.bucketPos(st.base) })
end

function FisherService.collect(player: Player)
	local st = per[player]
	local fd = dataOf(player)
	local data = R.PlayerData.get(player)
	if not st or not fd or not data then return end
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root or (root.Position - F.bucketPos(st.base)).Magnitude > 16 then return end
	if #fd.stored == 0 then
		R.Notify(player, "The bucket is empty. Your fishermen are working on it!", "info")
		return
	end
	local space = E.FishBagMax - #data.fish
	if space <= 0 then
		R.Notify(player, ("Fish bag full (%d)! Sell or throw fish first."):format(E.FishBagMax), "warn")
		return
	end
	local taken = {}
	while #fd.stored > 0 and #taken < space do
		local fish = table.remove(fd.stored, 1)
		if FishConfig.get(fish.s) then
			table.insert(data.fish, fish)
			data.stats.fish += 1
			pcall(R.IndexService.discoverFish, player, fish)
			table.insert(taken, fish.s)
		end
	end
	R.PlayerData.push(player, "fish")
	R.PlayerData.push(player, "fishers")
	refreshBucket(player)
	Net.event("FisherFx"):FireClient(player, "Collected", { base = st.base, list = taken, left = #fd.stored, from = F.bucketPos(st.base) })
	if #fd.stored > 0 then
		R.Notify(player, ("Bag full: %d fish stay in the bucket."):format(#fd.stored), "warn")
	end
end

-- prompts (server side, owner checked)
function FisherService.onPrompt(prompt: ProximityPrompt, player: Player): boolean
	local kind = prompt:GetAttribute("TFBPrompt")
	if prompt:GetAttribute("Owner") ~= player.UserId then return false end
	if kind == "HireFisher" then
		FisherService.hire(player, prompt:GetAttribute("Slot") or 1)
	elseif kind == "UpgradeFisher" then
		FisherService.upgrade(player, prompt:GetAttribute("Slot") or 1)
	elseif kind == "CollectBucket" then
		FisherService.collect(player)
	elseif kind == "UpgradeBucket" then
		FisherService.upgradeBucket(player)
	else
		return false
	end
	return true
end

Players.PlayerRemoving:Connect(function(p)
	FisherService.cleanup(p)
end)

return FisherService
