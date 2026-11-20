--[[ EconomyService: the single currency ($). Server only: every change goes
     through add / spend; placed bears pay their individual income every second. ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Formulas = require(ReplicatedStorage.Shared.Formulas)
local R = require(script.Parent.Parent.Registry)

local Economy = {}
local rates: { [Player]: number } = {}

function Economy.recompute(player: Player)
	local data = R.PlayerData.get(player)
	if not data then return end
	local total = 0
	for _, b in data.bears do
		if b.placed then total += Formulas.bearIncome(b) end
	end
	rates[player] = total
	player:SetAttribute("Income", total)
end

function Economy.rate(player: Player): number
	return rates[player] or 0
end

function Economy.add(player: Player, amount: number)
	local data = R.PlayerData.get(player)
	if not data or amount <= 0 or amount ~= amount then return end
	data.money += amount
	data.earned += amount
	R.PlayerData.push(player, "money")
end

function Economy.spend(player: Player, amount: number): boolean
	local data = R.PlayerData.get(player)
	if not data or amount < 0 or data.money < amount then return false end
	data.money -= amount
	R.PlayerData.push(player, "money")
	return true
end

task.spawn(function()
	while true do
		task.wait(1)
		for _, player in Players:GetPlayers() do
			local r = rates[player]
			local data = R.PlayerData.get(player)
			if r and r > 0 and data then
				data.money += r
				data.earned += r
				R.PlayerData.push(player, "money")
			end
		end
	end
end)

Players.PlayerRemoving:Connect(function(p) rates[p] = nil end)
return Economy
