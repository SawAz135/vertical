--[[ UpgradeService:
     - Strength is TRAINED: stand in your small white circle (outer front corner of
       your base) and the character lifts a fish automatically; every rep adds
       progress, levels raise throw distance / power and max fish weight.
     - Base capacity is bought with $ (Shop > Base tab, or the bears panel). ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local Layout = require(Shared.Layout)
local E = require(Shared.Config.EconomyConfig)
local Formulas = require(Shared.Formulas)
local FishUpConfig = require(Shared.Config.FishUpConfig)
local R = require(script.Parent.Parent.Registry)

local Upgrade = {}
local training: { [Player]: number } = {} -- player -> time of last rep

local function restPose(char: Model)
	local holding = char:GetAttribute("Holding")
	char:SetAttribute("Pose", if holding == "Rod" then "RodIdle" elseif holding == "Fish" then "HoldFish" elseif holding == "Bear" then "CarryBear" else "")
end

-- while training the character is locked in the middle of the mat (fixed spot, fixed
-- animation); a JUMP is the only way out. After a jump the station does not grab you
-- again until you have walked out of the ring.
local locked: { [Player]: any } = {}
local blocked: { [Player]: boolean } = {}

local function unlock(player: Player)
	local l = locked[player]
	locked[player] = nil
	if not l then return end
	if l.conn then l.conn:Disconnect() end
	if l.hum and l.hum.Parent then
		l.hum.WalkSpeed = l.walk
		l.hum.AutoRotate = true
	end
end

local function stop(player: Player, jumped: boolean?)
	training[player] = nil
	unlock(player)
	if jumped then blocked[player] = true end
	local char = player.Character
	-- step OUT of the ring (a few studs in front of it), or the player lands back in it and
	-- the training starts again at once
	if jumped and char then
		local base = R.BaseService.get(player)
		local root = char:FindFirstChild("HumanoidRootPart") :: BasePart?
		if base and root then
			local c = Layout.trainPos(base)
			local out = Vector3.new(c.X, root.Position.Y + 0.5, c.Z - (Layout.TRAIN_RADIUS + 6))
			task.defer(function()
				if char.Parent then
					char:PivotTo(CFrame.lookAt(out, out + Vector3.new(0, 0, -1)))
					root.AssemblyLinearVelocity = Vector3.zero
				end
			end)
		end
	end
	if char and char:GetAttribute("Pose") == "Lift" then restPose(char) end
	player:SetAttribute("Training", false)
end

local function lock(player: Player, char: Model, base: number)
	local hum = char:FindFirstChildOfClass("Humanoid")
	local root = char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not hum or not root then return end
	unlock(player)
	local c = Layout.trainPos(base)
	-- stand in the centre of the ring, facing the front of the map
	local at = Vector3.new(c.X, root.Position.Y, c.Z)
	char:PivotTo(CFrame.lookAt(at, at + Vector3.new(0, 0, -1)))
	root.AssemblyLinearVelocity = Vector3.zero
	local l = { hum = hum, walk = if hum.WalkSpeed > 0 then hum.WalkSpeed else 20 }
	hum.WalkSpeed = 0
	hum.AutoRotate = false
	l.conn = hum.StateChanged:Connect(function(_, new)
		if new == Enum.HumanoidStateType.Jumping and training[player] then
			stop(player, true)
		end
	end)
	locked[player] = l
end

function Upgrade.leaveTraining(player: Player)
	if training[player] then stop(player, true) end
end

local function rep(player: Player)
	local data = R.PlayerData.get(player)
	if not data then return end
	data.strength += data.strengthGain
	R.PlayerData.push(player, "strength")
end

task.spawn(function()
	while true do
		task.wait(0.2)
		for _, player in Players:GetPlayers() do
			local base = R.BaseService.get(player)
			local char = player.Character
			local root = char and char:FindFirstChild("HumanoidRootPart")
			local inRing = base and root and Layout.isInTraining(base, root.Position)
			if blocked[player] and root and base then
				local c = Layout.trainPos(base)
				if Vector3.new(root.Position.X - c.X, 0, root.Position.Z - c.Z).Magnitude > Layout.TRAIN_RADIUS + 2 then blocked[player] = nil end
			end
			local ok = inRing and not blocked[player] and not char:GetAttribute("IsBear") and R.State.is(player, "Idle")
			if ok then
				local now = os.clock()
				if not training[player] then
					-- start: hands free, lift the training fish
					if char:GetAttribute("Holding") ~= "" and char:GetAttribute("Holding") ~= nil then
						R.EquipService.clear(player)
					end
					training[player] = now
					lock(player, char, base)
					player:SetAttribute("Training", true)
					char:SetAttribute("Pose", "Lift")
					char:SetAttribute("PoseT", workspace:GetServerTimeNow())
				elseif now - training[player] >= E.Strength.repTime then
					training[player] = now
					rep(player)
				end
			elseif training[player] then
				stop(player)
			end
		end
	end
end)

Players.PlayerRemoving:Connect(function(p)
	training[p] = nil
	locked[p] = nil
	blocked[p] = nil
end)

-- shop: the gain per lift goes +1 -> +2 -> +3 ...
function Upgrade.buyStrength(player: Player)
	local data = R.PlayerData.get(player)
	if not data then return end
	if data.strengthGain >= E.Strength.maxGain then
		R.Notify(player, "Strength gain is maxed!", "info")
		return
	end
	if not R.EconomyService.spend(player, E.Strength.gainCost(data.strengthGain)) then
		R.Notify(player, "Not enough money!", "warn")
		return
	end
	local oldTier = FishUpConfig.tierFor(data.strengthGain)
	data.strengthGain += 1
	R.PlayerData.push(player, "strengthGain")
	Net.event("WorkoutFx"):FireAllClients(player, data.strengthGain)
	R.Notify(player, ("Each lift now gives +%d strength!"):format(data.strengthGain), "good")
	-- the FISH-UP station gets a new look at each tier
	local newTier = FishUpConfig.tierFor(data.strengthGain)
	local base = R.BaseService.get(player)
	if base and newTier ~= oldTier then
		R.MapService.setFishUpTier(base, newTier)
		R.Notify(player, ("Your FISH-UP is now %s!"):format(FishUpConfig.get(newTier).name:upper()), "good")
	end
	R.Sfx(player, "Buy")
end

function Upgrade.capacity(player: Player)
	local data = R.PlayerData.get(player)
	if not data then return end
	if data.capacity >= E.Capacity.maxLevel then
		R.Notify(player, "Capacity is maxed!", "info")
		return
	end
	if not R.EconomyService.spend(player, E.Capacity.cost(data.capacity)) then
		R.Notify(player, "Not enough money!", "warn")
		return
	end
	data.capacity += 1
	R.PlayerData.push(player, "capacity")
	R.Notify(player, ("Base capacity: %d animals!"):format(Formulas.capacity(data.capacity)), "good")
	R.Sfx(player, "Buy")
end

return Upgrade
