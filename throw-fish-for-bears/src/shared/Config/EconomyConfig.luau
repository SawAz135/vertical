--[[ EconomyConfig: every money number in one place. ]]
local E = {}

E.StartMoney = 150
E.FishBagMax = 40
E.BearStorageMax = 60

E.Strength = {
	maxLevel = 40,
	-- strength is TRAINED (training circle): reps needed to go from `level` to level + 1
	repsNeeded = function(level: number): number
		return math.floor(6 * 1.16 ^ (level - 1) + 0.5)
	end,
	repTime = 1.25, -- seconds per lift
	-- strength can also be BOUGHT in the shop (price from `level` to level + 1)
	cost = function(level: number): number
		return math.floor(80 * 1.34 ^ (level - 1) / 5 + 0.5) * 5
	end,
	maxDistance = function(level: number): number -- studs at full power
		return 75 + 260 * (1 - math.exp(-(level - 1) / 9))
	end,
	maxFishWeight = function(level: number): number
		return 10 * 1.2 ^ (level - 1)
	end,
}

E.Capacity = {
	start = 5, perLevel = 1, maxLevel = 26,
	cost = function(level: number): number
		return math.floor(400 * 1.55 ^ (level - 1) / 10 + 0.5) * 10
	end,
}

E.WeightIncomeExp = 0.7 -- income ~ (weight / reference) ^ exp
E.FishValueWeightExp = 0.6
E.BearSellFactor = 45 -- a bear sells for income * this many seconds

E.Daily = {
	cooldown = 20 * 3600, resetAfter = 48 * 3600,
	rewards = { 150, 400, 900, 2_000, 4_500, 9_000, 25_000 },
	incomeSeconds = { 30, 60, 90, 120, 180, 240, 600 }, -- + income * seconds
}

E.Playtime = { -- session gifts (minutes) for the Rewards menu
	{ minutes = 1, money = 100 }, { minutes = 3, money = 250 }, { minutes = 6, money = 600 },
	{ minutes = 10, money = 1_200 }, { minutes = 15, money = 2_500 }, { minutes = 22, money = 5_000 },
	{ minutes = 30, money = 10_000 }, { minutes = 45, money = 25_000 },
}
E.PlaytimeIncomeSeconds = 20

E.IndexReward = { Fish = 250, Bears = 600 } -- per newly discovered species

E.Lucky = { period = 900, duration = 180, fishLuck = 2, biteSpeed = 1.5 }

return E
