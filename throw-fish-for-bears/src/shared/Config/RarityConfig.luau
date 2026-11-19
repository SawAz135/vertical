--[[ RarityConfig: every probability and multiplier tied to rarity / variants.
     Odds are "1 in N" before luck. All values are balancing knobs: change them here,
     no gameplay script hardcodes a probability.

     Luck model: weight(tier) = baseWeight(tier) * luck ^ luckExp(tier)
     (Common has exponent 0, so extra luck shifts probability toward rarer tiers
     smoothly instead of deleting commons.) ]]
local RarityConfig = {}

RarityConfig.Order = { "Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Secret", "UltraSecret", "Impossible" }

RarityConfig.Tiers = {
	Common = {
		name = "Common", index = 1,
		color = Color3.fromRGB(205, 205, 210), dark = Color3.fromRGB(120, 120, 128),
		bearOdds = 2, fishOdds = 2, luckExp = 0,
		bearIncome = 1, fishValue = 1, fishToBearLuck = 1.0,
		reveal = 1,
	},
	Uncommon = {
		name = "Uncommon", index = 2,
		color = Color3.fromRGB(95, 230, 95), dark = Color3.fromRGB(30, 130, 40),
		bearOdds = 5, fishOdds = 4, luckExp = 0.35,
		bearIncome = 2.5, fishValue = 2, fishToBearLuck = 1.15,
		reveal = 1,
	},
	Rare = {
		name = "Rare", index = 3,
		color = Color3.fromRGB(70, 160, 255), dark = Color3.fromRGB(20, 80, 180),
		bearOdds = 25, fishOdds = 10, luckExp = 0.55,
		bearIncome = 7, fishValue = 5, fishToBearLuck = 1.35,
		reveal = 2,
	},
	Epic = {
		name = "Epic", index = 4,
		color = Color3.fromRGB(190, 90, 255), dark = Color3.fromRGB(100, 30, 170),
		bearOdds = 100, fishOdds = 30, luckExp = 0.7,
		bearIncome = 20, fishValue = 14, fishToBearLuck = 1.7,
		reveal = 2,
	},
	Legendary = {
		name = "Legendary", index = 5,
		color = Color3.fromRGB(255, 195, 40), dark = Color3.fromRGB(190, 110, 0),
		bearOdds = 1_000, fishOdds = 120, luckExp = 0.8,
		bearIncome = 80, fishValue = 50, fishToBearLuck = 2.2,
		reveal = 3,
	},
	Mythic = {
		name = "Mythic", index = 6,
		color = Color3.fromRGB(255, 70, 100), dark = Color3.fromRGB(160, 0, 40),
		bearOdds = 10_000, fishOdds = 600, luckExp = 0.85,
		bearIncome = 400, fishValue = 220, fishToBearLuck = 3.0,
		reveal = 3,
	},
	Secret = {
		name = "Secret", index = 7,
		color = Color3.fromRGB(40, 40, 46), dark = Color3.fromRGB(0, 0, 0),
		textColor = Color3.fromRGB(255, 255, 255),
		bearOdds = 100_000, fishOdds = 4_000, luckExp = 0.9,
		bearIncome = 2_500, fishValue = 1_000, fishToBearLuck = 4.5,
		reveal = 4,
	},
	UltraSecret = {
		name = "Ultra Secret", index = 8,
		color = Color3.fromRGB(255, 255, 255), dark = Color3.fromRGB(80, 0, 120),
		rainbow = true,
		bearOdds = 1_000_000, fishOdds = 25_000, luckExp = 0.9,
		bearIncome = 20_000, fishValue = 6_000, fishToBearLuck = 7.0,
		reveal = 4,
	},	-- the top tier: exactly ONE bear (Cosmic Bear) and ONE fish (Cosmic Koi) exist in it.
	-- Only this tier gets a full-screen announcement for the whole server.
	Impossible = {
		name = "Impossible", index = 9,
		color = Color3.fromRGB(170, 90, 255), dark = Color3.fromRGB(20, 0, 40),
		textColor = Color3.fromRGB(210, 160, 255), impossible = true,
		bearOdds = 5_000_000, fishOdds = 200_000, luckExp = 0.85,
		bearIncome = 120_000, fishValue = 30_000, fishToBearLuck = 12,
		reveal = 4,
	},

}

RarityConfig.VariantOrder = { "Normal", "Golden", "Diamond", "Ancient", "Rainbow", "Clockwork" }

RarityConfig.Variants = {
	Normal = { name = "Normal", odds = 1, luckExp = 0, income = 1, value = 1, color = Color3.fromRGB(230, 230, 230), fishToBearLuck = 1 },
	Golden = { name = "Golden", odds = 50, luckExp = 0.5, income = 2.5, value = 3, color = Color3.fromRGB(255, 205, 50), fishToBearLuck = 1.7, kgBonus = 0.25 },
	Diamond = { name = "Diamond", odds = 250, luckExp = 0.6, income = 6, value = 8, color = Color3.fromRGB(110, 230, 255), fishToBearLuck = 2.5, kgBonus = 0.5 },
	-- ANCIENT: a mossy stone statue come to life (flowers + mushrooms growing on it)
	Ancient = { name = "Ancient", odds = 700, luckExp = 0.65, income = 10, value = 13, color = Color3.fromRGB(120, 170, 90), fishToBearLuck = 3.2, kgBonus = 0.75 },
	Rainbow = { name = "Rainbow", odds = 1_500, luckExp = 0.7, income = 15, value = 20, color = Color3.fromRGB(255, 120, 220), fishToBearLuck = 4, kgBonus = 1 },
	-- CLOCKWORK: the rarest: a brass machine with turning gears, a wind-up key and a steam chimney
	Clockwork = { name = "Clockwork", odds = 8_000, luckExp = 0.8, income = 40, value = 55, color = Color3.fromRGB(214, 160, 70), fishToBearLuck = 6, kgBonus = 2 },
}

function RarityConfig.get(id: string)
	return RarityConfig.Tiers[id] or RarityConfig.Tiers.Common
end

function RarityConfig.index(id: string): number
	return RarityConfig.get(id).index
end

-- weights for one roll, given a luck multiplier and which odds column to use
function RarityConfig.weights(luck: number, column: "bearOdds" | "fishOdds"): { [string]: number }
	local out = {}
	luck = math.max(1, luck)
	for _, id in RarityConfig.Order do
		local t = RarityConfig.Tiers[id]
		out[id] = (1 / t[column]) * luck ^ t.luckExp
	end
	return out
end

function RarityConfig.variantWeights(luck: number): { [string]: number }
	local out = {}
	luck = math.max(1, luck)
	for _, id in RarityConfig.VariantOrder do
		local v = RarityConfig.Variants[id]
		out[id] = (1 / v.odds) * luck ^ v.luckExp
	end
	return out
end

function RarityConfig.color(id: string, t: number?): Color3
	local tier = RarityConfig.get(id)
	if tier.rainbow then
		return Color3.fromHSV(((t or os.clock()) * 0.25) % 1, 0.75, 1)
	end
	return tier.color
end

return RarityConfig
