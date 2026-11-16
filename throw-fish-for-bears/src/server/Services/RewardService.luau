--[[ RewardService: daily rewards (7 day streak), session playtime gifts and the
     "Lucky Lake" event timer (x2 fish luck, faster bites) shown under the title. ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local E = require(ReplicatedStorage.Shared.Config.EconomyConfig)
local R = require(script.Parent.Parent.Registry)

local Reward = {}
local joined: { [Player]: number } = {}
local claimedGifts: { [Player]: { [number]: boolean } } = {}

-- Lucky Lake: deterministic from server time, so every client can compute it too
local START = workspace:GetServerTimeNow()
ReplicatedStorage:SetAttribute("LuckyPeriod", E.Lucky.period)
ReplicatedStorage:SetAttribute("LuckyDuration", E.Lucky.duration)
ReplicatedStorage:SetAttribute("LuckyEpoch", START)

function Reward.isLucky(): boolean
	local t = (workspace:GetServerTimeNow() - START) % E.Lucky.period
	return t >= E.Lucky.period - E.Lucky.duration
end

function Reward.onJoin(player: Player)
	joined[player] = os.clock()
	claimedGifts[player] = {}
	player:SetAttribute("JoinedAt", workspace:GetServerTimeNow())
end

function Reward.claimDaily(player: Player)
	local data = R.PlayerData.get(player)
	if not data then return end
	local now = os.time()
	local d = data.daily
	if now - d.last < E.Daily.cooldown then
		R.Notify(player, "Daily reward already claimed. Come back later!", "warn")
		return
	end
	if now - d.last > E.Daily.resetAfter then d.streak = 0 end
	local day = d.streak % #E.Daily.rewards + 1
	local amount = E.Daily.rewards[day] + math.floor(R.EconomyService.rate(player) * E.Daily.incomeSeconds[day])
	d.streak += 1
	d.last = now
	R.EconomyService.add(player, amount)
	R.PlayerData.push(player, "daily")
	R.Notify(player, ("Day %d reward: +$%s"):format(day, tostring(amount)), "good")
	R.Sfx(player, "Reward")
end

function Reward.claimPlaytime(player: Player, index: number)
	local gift = E.Playtime[index]
	local t0 = joined[player]
	if not gift or not t0 then return end
	local claimed = claimedGifts[player]
	if claimed[index] then return end
	if os.clock() - t0 < gift.minutes * 60 - 2 then return end
	claimed[index] = true
	local amount = gift.money + math.floor(R.EconomyService.rate(player) * E.PlaytimeIncomeSeconds)
	R.EconomyService.add(player, amount)
	player:SetAttribute("GiftsClaimed", (player:GetAttribute("GiftsClaimed") or "") .. index .. ",")
	R.Notify(player, ("Gift opened: +$%s"):format(tostring(amount)), "good")
	R.Sfx(player, "Reward")
end

Players.PlayerRemoving:Connect(function(p)
	joined[p] = nil
	claimedGifts[p] = nil
end)

return Reward
