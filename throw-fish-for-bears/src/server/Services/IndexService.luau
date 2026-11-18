--[[ IndexService: Fish / Bear discovery (index) + claimable discovery rewards. ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local E = require(ReplicatedStorage.Shared.Config.EconomyConfig)
local IndexConfig = require(ReplicatedStorage.Shared.Config.IndexConfig)
local FishConfig = require(ReplicatedStorage.Shared.Config.FishConfig)
local RodConfig = require(ReplicatedStorage.Shared.Config.RodConfig)
local RarityConfig = require(ReplicatedStorage.Shared.Config.RarityConfig)
local Net = require(ReplicatedStorage.Shared.Net)
local rand = Random.new()
local R = require(script.Parent.Parent.Registry)

local Index = {}

function Index.discoverFish(player: Player, fish): boolean
	local data = R.PlayerData.get(player)
	local entry = data.index.fish[fish.s]
	local isNew = entry == nil
	if not entry then
		entry = { n = 0, best = 0, v = {} }
		data.index.fish[fish.s] = entry
		data.indexPending.Fish += E.IndexReward.Fish
	end
	entry.n += 1
	entry.best = math.max(entry.best, fish.w)
	entry.v[fish.v or "Normal"] = true
	R.PlayerData.push(player, "index")
	R.PlayerData.push(player, "indexPending")
	return isNew
end

function Index.discoverBear(player: Player, bear): boolean
	local data = R.PlayerData.get(player)
	local entry = data.index.bears[bear.s]
	local isNew = entry == nil
	if not entry then
		entry = { n = 0, best = 0, r = {}, v = {} }
		data.index.bears[bear.s] = entry
		data.indexPending.Bears += E.IndexReward.Bears
	end
	entry.n += 1
	entry.best = math.max(entry.best, bear.w)
	entry.r[bear.r] = true
	entry.v[bear.v or "Normal"] = true
	R.PlayerData.push(player, "index")
	R.PlayerData.push(player, "indexPending")
	return isNew
end

function Index.claim(player: Player, category: string)
	local data = R.PlayerData.get(player)
	if not data or (category ~= "Fish" and category ~= "Bears") then return end
	local amount = data.indexPending[category]
	if amount <= 0 then return end
	data.indexPending[category] = 0
	R.EconomyService.add(player, amount)
	R.PlayerData.push(player, "indexPending")
	R.Notify(player, ("Index reward: +$%d"):format(amount), "good")
	R.Sfx(player, "Reward")
end

-- a guaranteed fish of a rarity (random species of that rarity, a good weight)
local function giftFish(player: Player, rarity: string)
	local pool = {}
	for _, id in FishConfig.Order do
		if FishConfig.get(id).rarity == rarity then table.insert(pool, id) end
	end
	if #pool == 0 then return nil end
	local id = pool[rand:NextInteger(1, #pool)]
	local spec = FishConfig.get(id)
	local w = spec.weight.min + (spec.weight.max - spec.weight.min) * (0.55 + rand:NextNumber() * 0.4)
	local fish = { id = R.PlayerData.newId(player), s = id, w = math.floor(w * 100 + 0.5) / 100, v = "Normal" }
	local data = R.PlayerData.get(player)
	table.insert(data.fish, fish)
	Index.discoverFish(player, fish)
	return fish
end

-- CLAIM a completed Index section (zone of bears / rarity of fish, per mutation)
function Index.claimSection(player: Player, key: string)
	local data = R.PlayerData.get(player)
	if not data or type(key) ~= "string" or #key > 40 then return end
	data.indexClaims = data.indexClaims or {}
	if data.indexClaims[key] then return end
	local s = IndexConfig.byKey(key)
	if not s then return end
	local n, total = IndexConfig.progress(data.index, s)
	if n < total then
		R.Notify(player, ("Complete this section first (%d/%d)."):format(n, total), "warn")
		return
	end
	data.indexClaims[key] = true
	local rw = s.reward
	R.EconomyService.add(player, rw.money)
	data.indexLuck = (data.indexLuck or 0) + rw.luck
	local fish = if rw.fish then giftFish(player, rw.fish) else nil
	local rodName = nil
	if rw.rod and RodConfig.Rods[rw.rod] and not data.rods.owned[rw.rod] then
		data.rods.owned[rw.rod] = true
		rodName = RodConfig.Rods[rw.rod].name
		R.PlayerData.push(player, "rods")
	end
	R.PlayerData.push(player, "indexClaims")
	R.PlayerData.push(player, "indexLuck")
	R.PlayerData.push(player, "fish")
	R.Sfx(player, "Reward")
	Net.event("IndexReward"):FireClient(player, {
		key = key, title = s.title, variant = s.variant, money = rw.money, luck = rw.luck,
		fish = fish and fish.s, fishRarity = rw.fish, rod = rodName, rodId = rw.rod,
	})
	local _ = RarityConfig
end

return Index
