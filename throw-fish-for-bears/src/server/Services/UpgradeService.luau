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
local R = require(script.Parent.Parent.Registry)

local Upgrade = {}
local training: { [Player]: number } = {} -- player -> time of last rep

local function restPose(char: Model)
	local holding = char:GetAttribute("Holding")
	char:SetAttribute("Pose", if holding == "Rod" then "RodIdle" elseif holding == "Fish" then "HoldFish" elseif holding == "Bear" then "CarryBear" else "")
end

local function stop(player: Player)
	training[player] = nil
	local char = player.Character
	if char and char:GetAttribute("Pose") == "Lift" then restPose(char) end
	player:SetAttribute("Training", false)
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
			local ok = base and root and not char:GetAttribute("IsBear") and R.State.is(player, "Idle")
				and Layout.isInTraining(base, root.Position)
			if ok then
				local now = os.clock()
				if not training[player] then
					-- start: hands free, lift the training fish
					if char:GetAttribute("Holding") ~= "" and char:GetAttribute("Holding") ~= nil then
						R.EquipService.clear(player)
					end
					training[player] = now
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

Players.PlayerRemoving:Connect(function(p) training[p] = nil end)

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
	data.strengthGain += 1
	R.PlayerData.push(player, "strengthGain")
	Net.event("WorkoutFx"):FireAllClients(player, data.strengthGain)
	R.Notify(player, ("Each lift now gives +%d strength!"):format(data.strengthGain), "good")
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
	R.Notify(player, ("Base capacity: %d bears!"):format(Formulas.capacity(data.capacity)), "good")
	R.Sfx(player, "Buy")
end

return Upgrade
