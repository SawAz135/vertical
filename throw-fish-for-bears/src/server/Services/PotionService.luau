--[[ PotionService: luck potions (server authoritative).
     data.potions = { inv = { Luck2 = n, ... }, active = { Luck2 = secondsLeft, ... } }
     - an active potion only ticks down while you are in the game (offline time is free)
     - luckMult(player) = every active potion multiplied together x the x2 Luck gamepass
       x the live event bonus; used by CaptureService (animals) and FishingService (fish)
     - the client gets "potions" pushed on every change and counts down by itself;
       the player attribute "LuckMult" is what the HUD shows. ]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local PotionConfig = require(Shared.Config.PotionConfig)
local Format = require(Shared.Util.Format)
local R = require(script.Parent.Parent.Registry)

local Potion = {}

local function store(player: Player)
	local data = R.PlayerData.get(player)
	return data and data.potions, data
end

function Potion.luckMult(player: Player): number
	local p = store(player)
	local mult = 1
	if p then
		for id, left in p.active do
			local spec = PotionConfig.get(id)
			if spec and left > 0 then mult *= spec.mult end
		end
	end
	if R.Monetization and R.Monetization.owns(player, "Luck2x") then mult *= 2 end
	if R.EventService then mult *= R.EventService.luckMult() end
	return mult
end

local function refresh(player: Player)
	player:SetAttribute("LuckMult", Potion.luckMult(player))
	R.PlayerData.push(player, "potions")
end
Potion.refresh = refresh

function Potion.give(player: Player, id: string, count: number, why: string?)
	local p = store(player)
	if not p or not PotionConfig.get(id) then return false end
	p.inv[id] = math.clamp((p.inv[id] or 0) + count, 0, 999)
	refresh(player)
	if why then
		R.Notify(player, why, "good")
	end
	return true
end

function Potion.use(player: Player, id: string)
	local p = store(player)
	local spec = PotionConfig.get(id)
	if not p or not spec then return end
	if (p.inv[id] or 0) <= 0 then
		R.Notify(player, "You have no " .. spec.name .. " potion.", "warn")
		return
	end
	local left = p.active[id] or 0
	if left >= PotionConfig.MaxMinutes * 60 - spec.minutes * 60 then
		R.Notify(player, ("%s is already at the %d min limit."):format(spec.name, PotionConfig.MaxMinutes), "warn")
		return
	end
	p.inv[id] -= 1
	if p.inv[id] <= 0 then p.inv[id] = nil end
	p.active[id] = left + spec.minutes * 60
	refresh(player)
	R.Notify(player, ("%s active! Total luck x%s"):format(spec.name, Format.short(Potion.luckMult(player))), "good")
	R.Sfx(player, "Potion")
end

function Potion.buy(player: Player, id: string)
	local p = store(player)
	if not p or not PotionConfig.get(id) then return end
	local cost = PotionConfig.price(id, R.EconomyService.rate(player))
	if not R.EconomyService.spend(player, cost) then
		R.Notify(player, "Not enough money!", "warn")
		return
	end
	Potion.give(player, id, 1, ("Bought a %s potion!"):format(PotionConfig.get(id).name))
	R.Sfx(player, "Buy")
end

-- a caught fish can come with a potion (rarest first: only one per catch)
function Potion.rollDrop(player: Player, rand: Random)
	for i = #PotionConfig.Order, 1, -1 do
		local id = PotionConfig.Order[i]
		if rand:NextNumber() < PotionConfig.get(id).drop then
			Potion.give(player, id, 1, ("LUCKY! You found a %s potion!"):format(PotionConfig.get(id).name))
			R.Sfx(player, "Reward")
			return id
		end
	end
	return nil
end

-- countdown (online time only)
task.spawn(function()
	local last = os.clock()
	while true do
		task.wait(1)
		local now = os.clock()
		local dt = now - last
		last = now
		for _, player in Players:GetPlayers() do
			local p = store(player)
			if not p then continue end
			local ended = false
			for id, left in p.active do
				local nl = left - dt
				if nl <= 0 then
					p.active[id] = nil
					ended = true
					local spec = PotionConfig.get(id)
					if spec then R.Notify(player, spec.name .. " potion ran out.", "info") end
				else
					p.active[id] = nl
				end
			end
			if ended then refresh(player) end
		end
	end
end)

-- re-sync the client countdown now and then (it drifts very little, this keeps it exact)
task.spawn(function()
	while true do
		task.wait(30)
		for _, player in Players:GetPlayers() do
			local p = store(player)
			if p and next(p.active) then R.PlayerData.push(player, "potions") end
		end
	end
end)

return Potion
