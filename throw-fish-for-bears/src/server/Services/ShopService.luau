--[[ ShopService: fishing rods (buy / equip) and selling fish at the SELL stall.
     Valuable fish (Epic+ or any special variant) need an explicit confirmation. ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Layout = require(Shared.Layout)
local RodConfig = require(Shared.Config.RodConfig)
local FishConfig = require(Shared.Config.FishConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local R = require(script.Parent.Parent.Registry)

local Shop = {}

function Shop.buyRod(player: Player, id: string)
	local data = R.PlayerData.get(player)
	local rod = RodConfig.Rods[id]
	if not data or not rod or data.rods.owned[id] then return end
	if not R.EconomyService.spend(player, rod.price) then
		R.Notify(player, "Not enough money!", "warn")
		return
	end
	data.rods.owned[id] = true
	R.Notify(player, ("Bought the %s!"):format(rod.name), "good")
	R.Sfx(player, "Buy")
	Shop.equipRod(player, id)
end

function Shop.equipRod(player: Player, id: string)
	local data = R.PlayerData.get(player)
	if not data or not data.rods.owned[id] then return end
	if R.State.is(player, "Fishing", "Bite", "Reeling") then
		R.Notify(player, "Finish fishing first.", "warn")
		return
	end
	data.rods.equipped = id
	R.PlayerData.push(player, "rods")
	if R.EquipService.holding(player) == "Rod" then
		R.EquipService.equipRod(player)
	end
end

function Shop.isValuable(fish): boolean
	local tier = RarityConfig.get(FishConfig.get(fish.s).rarity)
	return tier.index >= 4 or (fish.v ~= nil and fish.v ~= "Normal")
end

function Shop.sellFish(player: Player, ids: { string }, confirm: boolean)
	local data = R.PlayerData.get(player)
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not data or not root or char:GetAttribute("IsBear") then return end
	if (root.Position - Layout.SELL_POS).Magnitude > 26 then
		R.Notify(player, "Go to the SELL stall to sell fish.", "warn")
		return
	end
	if not R.State.is(player, "Idle") then return end
	local want = {}
	for _, id in ids do want[id] = true end
	local total, count = 0, 0
	local keep = {}
	for _, f in data.fish do
		if want[f.id] and (confirm or not Shop.isValuable(f)) then
			total += Formulas.fishValue(f)
			count += 1
			if char:GetAttribute("HeldId") == f.id then R.EquipService.clear(player) end
			if data.selectedFish == f.id then data.selectedFish = nil end
		else
			table.insert(keep, f)
		end
	end
	if count == 0 then return end
	data.fish = keep
	R.EconomyService.add(player, total)
	R.PlayerData.push(player, "fish")
	R.Notify(player, ("Sold %d fish for %s"):format(count, Format.money(total)), "good")
	R.Sfx(player, "Sell")
end

return Shop
