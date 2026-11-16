--[[ FishingService: server authoritative fishing.
     Cast (at own dock end, rod equipped) -> wait (rod speed, lucky event) -> Bite
     -> player taps HOOK within the window -> fish is rolled HERE (species/weight/
     variant) -> reel mini-game on the client -> ReelFinish(success) after a minimum
     time -> fish added to the bag + reveal. A missed bite re-arms the line. ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local Layout = require(Shared.Layout)
local GameConfig = require(Shared.Config.GameConfig)
local FishConfig = require(Shared.Config.FishConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local RodConfig = require(Shared.Config.RodConfig)
local E = require(Shared.Config.EconomyConfig)
local Rng = require(Shared.Util.Rng)
local Formulas = require(Shared.Formulas)
local R = require(script.Parent.Parent.Registry)

local FishingService = {}
local rand = Random.new()
local sessions: { [Player]: any } = {}
local G = GameConfig.Fishing

local function fx(player: Player, phase: string, data: any)
	Net.event("FishingFx"):FireAllClients(player, phase, data)
end

-- species weights: each species uses the odds of its rarity tier, shifted by luck
function FishingService.speciesWeights(luck: number): { [string]: number }
	local tierW = RarityConfig.weights(luck, "fishOdds")
	local count = {}
	for _, id in FishConfig.Order do
		local r = FishConfig.get(id).rarity
		count[r] = (count[r] or 0) + 1
	end
	local out = {}
	for _, id in FishConfig.Order do
		local r = FishConfig.get(id).rarity
		out[id] = tierW[r] / count[r]
	end
	return out
end

function FishingService.luck(player: Player): number
	local data = R.PlayerData.get(player)
	local rod = RodConfig.get(data.rods.equipped)
	local luck = rod.luck
	if R.RewardService.isLucky() then luck *= E.Lucky.fishLuck end
	return luck
end

function FishingService.rollFish(player: Player)
	local data = R.PlayerData.get(player)
	local luck = FishingService.luck(player)
	local species = Rng.pickMap(rand, FishingService.speciesWeights(luck))
	local spec = FishConfig.get(species)
	local w = Rng.skewed(rand, spec.weight.min, spec.weight.max, 2.6)
	local cap = E.Strength.maxFishWeight(data.strength)
	local capped = false
	if w > cap then
		w = math.max(spec.weight.min, cap * (0.85 + rand:NextNumber() * 0.15))
		capped = true
	end
	local variant = Rng.pickMap(rand, RarityConfig.variantWeights(luck))
	return {
		id = R.PlayerData.newId(player),
		s = species,
		w = math.floor(w * 100 + 0.5) / 100,
		v = variant,
	}, capped
end

local function waitTime(player: Player): number
	local data = R.PlayerData.get(player)
	local rod = RodConfig.get(data.rods.equipped)
	local speed = rod.speed * (if R.RewardService.isLucky() then E.Lucky.biteSpeed else 1)
	return (G.waitMin + rand:NextNumber() * (G.waitMax - G.waitMin)) / speed
end

local function arm(player: Player, token: number, delayS: number)
	task.delay(delayS, function()
		local s = sessions[player]
		if not s or R.State.token(player) ~= token or R.State.get(player) ~= "Fishing" then return end
		local t2 = R.State.set(player, "Bite")
		if not t2 then return end
		s.biteAt = os.clock()
		s.biteToken = t2
		fx(player, "Bite", { bobber = s.bobber })
		-- missed bite: fish escapes, line stays in the water
		task.delay(G.biteWindow + 0.35, function()
			if R.State.token(player) == t2 and R.State.get(player) == "Bite" then
				local t3 = R.State.set(player, "Fishing")
				fx(player, "Miss", { bobber = s.bobber })
				R.Notify(player, "It got away... keep waiting!", "info")
				if t3 then arm(player, t3, G.missRetryMin + rand:NextNumber() * (G.missRetryMax - G.missRetryMin)) end
			end
		end)
	end)
end

function FishingService.cast(player: Player)
	if not R.State.is(player, "Idle") then return end
	local base = R.BaseService.get(player)
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not base or not root or char:GetAttribute("IsBear") then return end
	if R.EquipService.holding(player) ~= "Rod" then
		R.Notify(player, "Equip your rod first (slot 1).", "warn")
		return
	end
	if not Layout.isAtFishingSpot(base, root.Position) then
		R.Notify(player, "Walk to the end of YOUR dock to fish!", "warn")
		return
	end
	local token = R.State.set(player, "Fishing")
	if not token then return end
	local dock = Layout.dockEnd(base)
	local dist = G.castDistance[1] + rand:NextNumber() * (G.castDistance[2] - G.castDistance[1])
	local bobber = Vector3.new(dock.X + (rand:NextNumber() - 0.5) * 8, Layout.WATER_Y + 0.05, dock.Z + dist)
	sessions[player] = { bobber = bobber, castAt = os.clock() }
	char:SetAttribute("Pose", "Cast")
	char:SetAttribute("PoseT", workspace:GetServerTimeNow())
	fx(player, "Cast", { bobber = bobber, rod = R.PlayerData.get(player).rods.equipped })
	arm(player, token, waitTime(player) + 0.9)
end

function FishingService.hook(player: Player)
	local s = sessions[player]
	if not s or R.State.get(player) ~= "Bite" then return end
	if os.clock() - (s.biteAt or 0) > G.biteWindow + 0.6 then return end
	local token = R.State.set(player, "Reeling")
	if not token then return end
	local fish, capped = FishingService.rollFish(player)
	s.fish = fish
	s.capped = capped
	s.reelAt = os.clock()
	local tier = RarityConfig.get(FishConfig.get(fish.s).rarity)
	player.Character:SetAttribute("Pose", "Reel")
	player.Character:SetAttribute("PoseT", workspace:GetServerTimeNow())
	-- the client only gets the difficulty, not the result, until the catch
	fx(player, "Hooked", { bobber = s.bobber, difficulty = tier.index })
end

function FishingService.finish(player: Player, success: boolean)
	local s = sessions[player]
	if not s or R.State.get(player) ~= "Reeling" or not s.fish then return end
	local elapsed = os.clock() - s.reelAt
	if success and elapsed < G.reelMinTime then return end -- too fast: ignore (client will retry)
	sessions[player] = nil
	R.State.set(player, "Idle")
	local char = player.Character
	if char then
		char:SetAttribute("Pose", if R.EquipService.holding(player) == "Rod" then "RodIdle" else "")
	end
	if not success or elapsed > G.reelMaxTime then
		fx(player, "Snap", { bobber = s.bobber })
		R.Notify(player, "The line snapped! The fish escaped.", "warn")
		return
	end
	local data = R.PlayerData.get(player)
	if #data.fish >= E.FishBagMax then
		fx(player, "Release", { bobber = s.bobber, fish = s.fish })
		R.Notify(player, ("Fish bag full (%d)! Sell or throw fish first."):format(E.FishBagMax), "warn")
		return
	end
	local fish = s.fish
	table.insert(data.fish, fish)
	data.stats.fish += 1
	local isNew = R.IndexService.discoverFish(player, fish)
	R.PlayerData.push(player, "fish")
	fx(player, "Catch", { bobber = s.bobber, fish = fish })
	Net.event("CatchReveal"):FireClient(player, fish, { isNew = isNew, capped = s.capped, value = Formulas.fishValue(fish) })
end

function FishingService.stop(player: Player)
	if not R.State.is(player, "Fishing", "Bite") then return end
	local s = sessions[player]
	sessions[player] = nil
	R.State.set(player, "Idle", true)
	if player.Character then
		player.Character:SetAttribute("Pose", if R.EquipService.holding(player) == "Rod" then "RodIdle" else "")
	end
	fx(player, "Reset", { bobber = s and s.bobber })
end

-- cancel silently (unequip, death, leaving the dock)
function FishingService.cancel(player: Player)
	if R.State.is(player, "Fishing", "Bite", "Reeling") then
		sessions[player] = nil
		R.State.set(player, "Idle", true)
		fx(player, "Reset", {})
	end
end

-- leaving the fishing spot cancels the line
task.spawn(function()
	while true do
		task.wait(0.5)
		for player in sessions do
			local base = R.BaseService.get(player)
			local char = player.Character
			local root = char and char:FindFirstChild("HumanoidRootPart")
			if not base or not root or not Layout.isAtFishingSpot(base, root.Position + Vector3.new(0, 0, 0)) then
				if R.State.is(player, "Fishing", "Bite") then
					FishingService.cancel(player)
				end
			end
		end
	end
end)

Players.PlayerRemoving:Connect(function(p)
	sessions[p] = nil
end)

return FishingService
