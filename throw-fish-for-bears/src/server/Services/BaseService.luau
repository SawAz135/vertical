--[[ BaseService: assigns one of the 4 bases (and its dock) to each player, moves
     spawned characters into their base, rescues players who fall in the lake,
     and frees the base when the player leaves. ]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Layout = require(ReplicatedStorage.Shared.Layout)
local R = require(script.Parent.Parent.Registry)

local BaseService = {}
local owners: { [number]: Player } = {}
local bases: { [Player]: number } = {}

function BaseService.get(player: Player): number?
	return bases[player]
end

function BaseService.owner(i: number): Player?
	return owners[i]
end

function BaseService.assign(player: Player): number?
	if bases[player] then return bases[player] end
	for i = 1, #Layout.BASE_CENTERS do
		if not owners[i] then
			owners[i] = player
			bases[player] = i
			player:SetAttribute("Base", i)
			R.MapService.setBaseOwner(i, player)
			return i
		end
	end
	return nil
end

function BaseService.release(player: Player)
	local i = bases[player]
	if i then
		owners[i] = nil
		bases[player] = nil
		R.MapService.setBaseOwner(i, nil)
	end
end

-- place a (human) character at its base spawn
function BaseService.spawnAtBase(player: Player, character: Model)
	local i = bases[player]
	if not i then return end
	local root = character:WaitForChild("HumanoidRootPart", 5)
	if root then
		task.defer(function()
			if character.Parent then
				character:PivotTo(Layout.baseSpawn(i))
			end
		end)
	end
end

Players.PlayerRemoving:Connect(function(p)
	BaseService.release(p)
end)

-- lake rescue: anyone in the water goes back to the end of their dock
task.spawn(function()
	while true do
		task.wait(0.5)
		for player, i in bases do
			local char = player.Character
			local root = char and char:FindFirstChild("HumanoidRootPart")
			if root and root.Position.Y < Layout.WATER_Y - 2.5 and Layout.inRect(Layout.LAKE, root.Position, 0) then
				if char:GetAttribute("IsBear") then continue end -- capture service handles bears
				char:PivotTo(CFrame.new(Layout.dockEnd(i) + Vector3.new(0, 3.5, -4)))
				R.Notify(player, "Splash! Back on your dock.", "info")
			end
		end
	end
end)

return BaseService
