--[[ StateService: explicit per-player state machine. Every gameplay action checks
     and moves the state here, so two actions can never overlap (no throwing while
     fishing, no second capture, no placing while controlling a bear...). ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Net = require(ReplicatedStorage.Shared.Net)

local StateService = {}

-- allowed transitions: from -> { to = true }
local T = {
	Loading = { Idle = true },
	Idle = { Fishing = true, ChargingThrow = true, CarryingCapturedBear = true, Throwing = true },
	Fishing = { Bite = true, Idle = true },
	Bite = { Reeling = true, Fishing = true, Idle = true },
	Reeling = { Idle = true },
	ChargingThrow = { Throwing = true, Idle = true },
	Throwing = { WaitingForBear = true, Idle = true },
	WaitingForBear = { WatchingEatingCinematic = true, Idle = true },
	WatchingEatingCinematic = { ControllingBear = true, Idle = true },
	ControllingBear = { CarryingCapturedBear = true, Idle = true },
	CarryingCapturedBear = { Idle = true },
}

local states: { [Player]: { state: string, token: number, data: any } } = {}

function StateService.get(player: Player): string
	local s = states[player]
	return if s then s.state else "Loading"
end

function StateService.info(player: Player)
	local s = states[player]
	if not s then
		s = { state = "Loading", token = 0, data = {} }
		states[player] = s
	end
	return s
end

-- returns the new token on success (used to invalidate delayed callbacks)
function StateService.set(player: Player, new: string, force: boolean?): number?
	local s = StateService.info(player)
	if not force then
		local allowed = T[s.state]
		if not (allowed and allowed[new]) and s.state ~= new then
			return nil
		end
	end
	s.state = new
	s.token += 1
	player:SetAttribute("TFBState", new)
	Net.event("State"):FireClient(player, new)
	return s.token
end

function StateService.is(player: Player, ...: string): boolean
	local cur = StateService.get(player)
	for _, st in { ... } do
		if cur == st then return true end
	end
	return false
end

function StateService.token(player: Player): number
	return StateService.info(player).token
end

Players.PlayerRemoving:Connect(function(p)
	states[p] = nil
end)

return StateService
