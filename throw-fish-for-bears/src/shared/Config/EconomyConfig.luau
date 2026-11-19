--[[ EconomyConfig: every money number in one place. ]]
local E = {}

-- every money number (prices, income, rewards) is multiplied by this
E.MoneyMult = 100

E.StartMoney = 150 * E.MoneyMult
E.FishBagMax = math.huge -- the fish bag has no limit
E.BearStorageMax = 60

E.Strength = {
	-- STRENGTH = a number that grows: every lift in the white circle adds `gain`
	-- (starts at +1). The shop upgrade raises the gain: +1 -> +2 -> +3 ...
	-- More strength = longer throws (studs) and heavier fish.
	repTime = 1.25, -- seconds per lift
	maxGain = 200,
	gainCost = function(gain: number): number -- price to go from +gain to +(gain + 1) per lift
		return math.floor(100 * 1.32 ^ (gain - 1) / 5 + 0.5) * 5 * E.MoneyMult
	end,
	-- studs at full power: ~70 at 0, ~200 at 50, ~600 at 1.5K, ~1.2K at 12K, ~3K at 100K
	maxDistance = function(strength: number): number
		return math.min(3060, 70 + 24 * math.max(0, strength) ^ 0.42)
	end,
	-- inverse: strength needed so a full-power throw of a light fish reaches `dist` studs
	strengthFor = function(dist: number): number
		return math.max(0, (math.max(0, dist - 70) / 24) ^ (1 / 0.42))
	end,
	maxFishWeight = function(strength: number): number
		return 10 + 6 * math.sqrt(math.max(0, strength))
	end,
}

E.Capacity = {
	start = 5, perLevel = 1, maxLevel = 26,
	cost = function(level: number): number
		return math.floor(400 * 1.55 ^ (level - 1) / 10 + 0.5) * 10 * E.MoneyMult
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

E.TutorialReward = 1_000 -- once, after the first bear is placed through the tutorial
E.TutorialDone = 99

E.IndexReward = { Fish = 250, Bears = 600 } -- per newly discovered species

E.Lucky = { period = 900, duration = 180, fishLuck = 2, biteSpeed = 1.5 }

-- x MoneyMult on every flat reward (income-based rewards already scale with bear income)
for i, v in E.Daily.rewards do E.Daily.rewards[i] = v * E.MoneyMult end
for _, g in E.Playtime do g.money *= E.MoneyMult end
E.TutorialReward *= E.MoneyMult
E.IndexReward.Fish *= E.MoneyMult
E.IndexReward.Bears *= E.MoneyMult

return E
