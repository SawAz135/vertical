--[[ IndexService: Fish / Bear discovery (index) + claimable discovery rewards. ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local E = require(ReplicatedStorage.Shared.Config.EconomyConfig)
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

return Index
