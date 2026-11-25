--[[ PotionConfig: LUCK POTIONS.
     Drinking one multiplies your luck (animal pulls AND fishing) for 10 minutes of play.
     Several different potions multiply together (x2 * x5 = x10); drinking the same one
     again adds 10 more minutes (up to MaxMinutes).
     Sources: rare drop when you catch a fish, Shop > Potions ($), Robux (MonetizationConfig). ]]
local E = require(script.Parent.EconomyConfig)

local P = {}

P.Order = { "Luck2", "Luck5", "Luck10" }
P.MaxMinutes = 120 -- one potion type can never stack past 2 hours

P.Potions = {
	Luck2 = {
		name = "Luck x2", mult = 2, minutes = 10, rarity = "Rare",
		liquid = Color3.fromRGB(70, 214, 92), liquidDark = Color3.fromRGB(32, 150, 60),
		cork = Color3.fromRGB(150, 96, 52), tag = Color3.fromRGB(255, 244, 214),
		-- money price grows with your income so it stays a real choice all game long
		price = { base = 2_500, incomeSeconds = 240 },
		drop = 1 / 35, -- chance per caught fish
	},
	Luck5 = {
		name = "Luck x5", mult = 5, minutes = 10, rarity = "Epic",
		liquid = Color3.fromRGB(64, 150, 255), liquidDark = Color3.fromRGB(34, 84, 214),
		cork = Color3.fromRGB(120, 76, 44), tag = Color3.fromRGB(226, 240, 255),
		price = { base = 20_000, incomeSeconds = 1_200 },
		drop = 1 / 180,
	},
	Luck10 = {
		name = "Luck x10", mult = 10, minutes = 10, rarity = "Legendary",
		liquid = Color3.fromRGB(255, 196, 40), liquidDark = Color3.fromRGB(226, 120, 20),
		cork = Color3.fromRGB(176, 40, 44), tag = Color3.fromRGB(255, 236, 160),
		price = { base = 150_000, incomeSeconds = 4_800 },
		drop = 1 / 900,
	},
}

for _, p in P.Potions do p.price.base *= E.MoneyMult end

function P.get(id: string)
	return P.Potions[id]
end

-- $ price of one potion for a player earning `income` $/s
function P.price(id: string, income: number): number
	local p = P.Potions[id]
	local raw = math.max(p.price.base, (income or 0) * p.price.incomeSeconds)
	-- rounded to 2 significant digits so the price reads well ($48K, $1.2M)
	local mag = 10 ^ math.max(0, math.floor(math.log10(math.max(raw, 1))) - 1)
	return math.ceil(raw / mag) * mag
end

return P
