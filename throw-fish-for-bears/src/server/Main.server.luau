--[[ THROW FISH FOR BEARS - server entry point.
     Builds the world, wires every service into the Registry, handles players and
     connects every client -> server remote (each one validated + rate limited). ]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ProximityPromptService = game:GetService("ProximityPromptService")
local StarterPlayer = game:GetService("StarterPlayer")

local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local Layout = require(Shared.Layout)
local E = require(Shared.Config.EconomyConfig)
local R = require(script.Parent.Registry)
local S = script.Parent.Services

Net.setupServer()

-- registry ---------------------------------------------------------------------
R.Security = require(S.SecurityService)
R.State = require(S.StateService)
R.PlayerData = require(S.PlayerDataService)
R.MapService = require(S.MapService)
R.BaseService = require(S.BaseService)
R.EquipService = require(S.EquipService)
R.FishingService = require(S.FishingService)
R.ThrowService = require(S.ThrowService)
R.BearAI = require(S.BearAIService)
R.CaptureService = require(S.CaptureService)
R.BearBase = require(S.BearBaseService)
R.EconomyService = require(S.EconomyService)
R.ShopService = require(S.ShopService)
R.UpgradeService = require(S.UpgradeService)
R.IndexService = require(S.IndexService)
R.RewardService = require(S.RewardService)
R.Announce = require(S.AnnounceService)
R.FisherService = require(S.FisherService)

function R.Notify(player: Player, text: string, kind: string?)
	Net.event("Notify"):FireClient(player, text, kind or "info")
end

function R.Sfx(player: Player, name: string, pos: Vector3?)
	Net.event("Sfx"):FireClient(player, name, pos)
end

-- world ------------------------------------------------------------------------
StarterPlayer.CharacterWalkSpeed = 20
R.MapService.build()
R.CaptureService.spawnAmbient()

-- players ------------------------------------------------------------------------
local function onCharacter(player: Player, char: Model)
	if char:GetAttribute("IsBear") then return end
	local hum = char:WaitForChild("Humanoid", 10) :: Humanoid?
	if not hum then return end
	hum.WalkSpeed = 20
	local spawnAt = player:GetAttribute("SpawnAt")
	if typeof(spawnAt) == "Vector3" then
		player:SetAttribute("SpawnAt", nil)
		local root = char:WaitForChild("HumanoidRootPart", 5)
		if root then
			task.defer(function()
				char:PivotTo(CFrame.lookAt(spawnAt + Vector3.new(0, 3, 0), spawnAt + Vector3.new(0, 3, -1)))
			end)
		end
	else
		R.BaseService.spawnAtBase(player, char)
	end
	-- a freshly spawned human never holds anything; recover from interrupted states
	local st = R.State.get(player)
	if st == "Fishing" or st == "Bite" or st == "Reeling" then
		R.FishingService.cancel(player)
	elseif st == "ChargingThrow" then
		R.ThrowService.cancel(player)
	end
	hum.Died:Connect(function()
		local s = R.State.get(player)
		if s == "Fishing" or s == "Bite" or s == "Reeling" then
			R.FishingService.cancel(player)
		elseif s == "ChargingThrow" then
			R.ThrowService.cancel(player)
		elseif s == "WaitingForBear" or s == "WatchingEatingCinematic" then
			R.CaptureService.abort(player, "You fell asleep!")
		elseif s == "CarryingCapturedBear" then
			R.State.set(player, "Idle", true) -- the bear stays safe in storage
		end
	end)
end

local function onPlayer(player: Player)
	local base = R.BaseService.assign(player)
	if not base then
		player:Kick("This server is full (4 players). Please join another server!")
		return
	end
	R.State.info(player)
	player.CharacterAdded:Connect(function(char)
		onCharacter(player, char)
	end)
	local data = R.PlayerData.load(player)
	if not data or not player.Parent then return end
	R.RewardService.onJoin(player)
	R.MapService.setFishUpTier(base, require(Shared.Config.FishUpConfig).tierFor(data.strengthGain))
	-- hired fishermen + their bucket on this player's dock
	task.spawn(function()
		local ok, err = pcall(R.FisherService.setup, player)
		if not ok then warn("[TFB] fishers", err) end
	end)
	R.BearBase.loadPlayer(player)
	R.State.set(player, "Idle", true)
	player:SetAttribute("DataReady", true)
	if player.Character then onCharacter(player, player.Character) end
end

Players.PlayerAdded:Connect(onPlayer)
for _, p in Players:GetPlayers() do task.spawn(onPlayer, p) end

-- remotes ----------------------------------------------------------------------------
local on = R.Security.on

on("Ready", {}, function(player)
	if not R.PlayerData.get(player) then
		local t0 = os.clock()
		repeat task.wait(0.2) until R.PlayerData.get(player) or os.clock() - t0 > 30 or not player.Parent
	end
	R.PlayerData.push(player, "*")
	Net.event("State"):FireClient(player, R.State.get(player))
end)

on("EquipSlot", { "string", "string?" }, function(player, slot, id)
	local data = R.PlayerData.get(player)
	local char = player.Character
	if not data or not char or char:GetAttribute("IsBear") then return end
	local st = R.State.get(player)
	if st == "Fishing" or st == "Bite" then
		R.FishingService.stop(player)
		st = R.State.get(player)
	end
	if st ~= "Idle" then return end
	local holding = R.EquipService.holding(player)
	if slot == "Rod" then
		if holding == "Rod" then R.EquipService.clear(player) else R.EquipService.equipRod(player) end
	elseif slot == "Fish" then
		local fishId = id or data.selectedFish or (data.fish[1] and data.fish[1].id)
		if not fishId then
			R.Notify(player, "No fish yet! Catch some at your dock.", "warn")
			return
		end
		if holding == "Fish" and char:GetAttribute("HeldId") == fishId then
			R.EquipService.clear(player)
		else
			R.EquipService.equipFish(player, fishId)
		end
		R.PlayerData.push(player, "selectedFish")
	elseif slot == "None" then
		R.EquipService.clear(player)
	end
end)

on("SelectFish", { "string" }, function(player, id)
	local data = R.PlayerData.get(player)
	if not data then return end
	for _, f in data.fish do
		if f.id == id then
			data.selectedFish = id
			R.PlayerData.push(player, "selectedFish")
			if R.State.is(player, "Idle") and not (player.Character and player.Character:GetAttribute("IsBear")) then
				R.EquipService.equipFish(player, id)
			end
			return
		end
	end
end)

on("Cast", {}, R.FishingService.cast)
on("Hook", {}, R.FishingService.hook)
on("ReelFinish", { "boolean" }, R.FishingService.finish)
on("StopFishing", {}, R.FishingService.stop)
on("ChargeStart", {}, R.ThrowService.chargeStart)
on("Throw", { "number" }, R.ThrowService.throw)
on("PlaceBear", { "Vector3" }, R.BearBase.place)
on("StoreBear", {}, R.BearBase.store)
on("PickupBear", { "string" }, R.BearBase.pickup)
on("TakeFromStorage", { "string" }, R.BearBase.takeFromStorage)
on("PlaceBest", {}, R.BearBase.placeBest)
on("EquipBear", { "string" }, R.BearBase.equip)
on("UnequipBear", { "string" }, R.BearBase.unequip)
on("EquipBest", {}, R.BearBase.equipBest)
on("ClaimIndexSection", { "string" }, R.IndexService.claimSection)
on("SellFish", { "table", "boolean" }, function(player, ids, confirm)
	local list = R.Security.idList(ids, 60)
	if list then R.ShopService.sellFish(player, list, confirm) end
end)
on("SellBear", { "string", "boolean" }, R.BearBase.sell)
on("BuyRod", { "string" }, R.ShopService.buyRod)
on("EquipRod", { "string" }, R.ShopService.equipRod)
on("UpgradeCapacity", {}, R.UpgradeService.capacity)
on("BuyStrength", {}, R.UpgradeService.buyStrength)
on("LeaveTraining", {}, R.UpgradeService.leaveTraining)
on("SkipCapture", {}, R.CaptureService.skip)
on("ClaimDaily", {}, R.RewardService.claimDaily)
on("ClaimPlaytime", { "number" }, function(player, i)
	R.RewardService.claimPlaytime(player, math.floor(i))
end)
on("ClaimIndex", { "string" }, R.IndexService.claim)
-- tutorial progress (client drives the steps; the server only stores the furthest
-- step and pays the one-time reward once the player really owns a bear)
on("TutorialStep", { "number" }, function(player, step)
	local data = R.PlayerData.get(player)
	if not data then return end
	step = math.clamp(math.floor(step), 0, E.TutorialDone)
	if step <= data.tutorial then return end
	data.tutorial = step
	if step >= E.TutorialDone and not data.tutorialPaid and data.stats.bears >= 1 then
		data.tutorialPaid = true
		R.EconomyService.add(player, E.TutorialReward)
		R.Notify(player, ("Tutorial complete! +$%d"):format(E.TutorialReward), "good")
	end
	R.PlayerData.push(player, "tutorial")
end)

on("SetSetting", { "string", "boolean" }, function(player, name, value)
	local data = R.PlayerData.get(player)
	if data and name == "lowFx" then
		data.settings.lowFx = value
		R.PlayerData.push(player, "settings")
	end
end)

ProximityPromptService.PromptTriggered:Connect(function(prompt, player)
	if R.FisherService.onPrompt(prompt, player) then return end
	if prompt:GetAttribute("TFBPrompt") == "PickupBear" then
		local id = prompt:GetAttribute("BearId")
		if type(id) == "string" and prompt:GetAttribute("Owner") == player.UserId then
			R.BearBase.pickup(player, id)
		end
	end
end)

print(("[TFB] Throw Fish For Bears ready - %d zone(s), corridor %d studs"):format(Layout.ZONE_COUNT, Layout.ZONE_LENGTH * Layout.ZONE_COUNT))
