--[[ ThrowService: charge + throw a carried fish down the corridor.
     Power is measured by the SERVER from ChargeStart -> Throw (the client meter is
     only a display). Distance = f(power, strength, fish weight). The flight is
     broadcast; after the flight time the fish lands and CaptureService takes over. ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local Layout = require(Shared.Layout)
local GameConfig = require(Shared.Config.GameConfig)
local Formulas = require(Shared.Formulas)
local R = require(script.Parent.Parent.Registry)

local ThrowService = {}
local charging: { [Player]: number } = {}
local G = GameConfig.Throw

local function heldFish(player: Player)
	local data = R.PlayerData.get(player)
	local char = player.Character
	if not data or not char or char:GetAttribute("Holding") ~= "Fish" then return nil end
	local id = char:GetAttribute("HeldId")
	for i, f in data.fish do
		if f.id == id then return f, i end
	end
	return nil
end

function ThrowService.chargeStart(player: Player)
	if not R.State.is(player, "Idle") then return end
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root or not heldFish(player) then return end
	if not Layout.isInThrowArea(root.Position) then
		R.Notify(player, "Go to the THROW ZONE at the start of the corridor!", "warn")
		return
	end
	if not R.State.set(player, "ChargingThrow") then return end
	charging[player] = os.clock()
	char:SetAttribute("Pose", "ThrowCharge")
	char:SetAttribute("PoseT", workspace:GetServerTimeNow())
end

function ThrowService.cancel(player: Player)
	charging[player] = nil
	if R.State.is(player, "ChargingThrow") then
		R.State.set(player, "Idle", true)
		local char = player.Character
		if char then char:SetAttribute("Pose", if char:GetAttribute("Holding") == "Fish" then "HoldFish" else "") end
	end
end

function ThrowService.throw(player: Player, aim: number)
	local t0 = charging[player]
	charging[player] = nil
	if not t0 or not R.State.is(player, "ChargingThrow") then return end
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	local fish, idx = heldFish(player)
	if not root or not fish then
		ThrowService.cancel(player)
		return
	end
	if not Layout.isInThrowArea(root.Position) then
		ThrowService.cancel(player)
		R.Notify(player, "You left the Throw Zone.", "warn")
		return
	end
	local data = R.PlayerData.get(player)
	local power = math.clamp((os.clock() - t0) / G.chargeTime, G.minPower, 1)
	local dist = Formulas.throwDistance(power, data.strength, fish.w)
	aim = math.clamp(aim, -1, 1)
	local from = root.Position + Vector3.new(0, 2.2, -1.5)
	local lx = math.clamp(from.X + aim * dist * 0.14, -Layout.LANDING_HALF, Layout.LANDING_HALF)
	local lz = math.max(Layout.CORRIDOR_END_Z + 22, from.Z - dist)
	if lz > Layout.CORRIDOR_START_Z - Layout.DESCENT_LEN - 4 then
		-- never on the ramp going down into the trench
		lx = math.min(lx, Layout.RAMP.minX - 3)
	end
	local to = Vector3.new(lx, Layout.CORRIDOR_Y + 0.2, lz) -- on the trench floor, below the plateau
	local flight = Formulas.flightTime((to - from).Magnitude)
	local apex = Formulas.apex((to - from).Magnitude)

	-- the fish leaves the bag now (returned if the throw is too weak)
	table.remove(data.fish, idx)
	if data.selectedFish == fish.id then data.selectedFish = nil end
	data.stats.throws += 1
	R.PlayerData.push(player, "fish")
	R.EquipService.clear(player)
	R.State.set(player, "Throwing")
	char:SetAttribute("Pose", "Throw")
	char:SetAttribute("PoseT", workspace:GetServerTimeNow())

	local zone = Layout.zoneAt(to)
	local ok = zone ~= nil and to.Z <= Layout.CORRIDOR_START_Z - G.minLandingDepth
	-- distance travelled on the ground (studs) + personal record
	local travelled = Vector3.new(to.X - root.Position.X, 0, to.Z - root.Position.Z).Magnitude
	local best = tonumber(data.bestThrow) or 0
	local record = ok and best > 0 and travelled > best
	if ok and travelled > best then
		data.bestThrow = math.floor(travelled * 10 + 0.5) / 10
	end
	Net.event("ThrowFx"):FireAllClients(player, {
		from = from, to = to, flight = flight, apex = apex, fish = fish, power = power,
		t0 = workspace:GetServerTimeNow() + G.releaseDelay, ok = ok, zone = zone,
		dist = travelled, best = best, record = record,
	})

	task.delay(G.releaseDelay + flight, function()
		if not player.Parent then return end
		if char.Parent then char:SetAttribute("Pose", "") end
		if not ok then
			-- too weak: the fish flops back into the bag
			table.insert(data.fish, fish)
			R.PlayerData.push(player, "fish")
			R.State.set(player, "Idle", true)
			R.Notify(player, "Too weak! The fish didn't reach the zone. Hold longer or train at your FISH-UP.", "warn")
			return
		end
		R.CaptureService.begin(player, fish, to, zone :: number, power)
	end)
end

game:GetService("Players").PlayerRemoving:Connect(function(p)
	charging[p] = nil
end)

return ThrowService
