--[[ RodConfig: fishing rods (models follow the 12 reference rods: handle / shaft / band /
     reel / bobber colours). speed divides the bite waiting time, luck multiplies the
     fish rarity luck. Prices are $; order = shop order. ]]
local RodConfig = {}
local C = Color3.fromRGB

local BROWN, TAN, GRAY, BLACK, WHITE = C(124, 80, 45), C(206, 172, 122), C(150, 150, 156), C(36, 36, 40), C(232, 232, 232)
local RED, GOLD, PURPLE, BLUE, GREEN, ORANGE, YELLOW = C(214, 40, 40), C(232, 176, 40), C(140, 60, 200), C(30, 100, 220), C(70, 140, 50), C(250, 130, 30), C(250, 205, 40)

RodConfig.Order = {
	"Starter", "Oak", "Twilight", "River", "Camo", "Night",
	"Lake", "Royal", "Arctic", "Jungle", "Storm", "Master",
}

RodConfig.Rods = {
	Starter = { name = "Starter Rod", price = 0, speed = 1.0, luck = 1.0, desc = "A trusty first rod.",
		colors = { handle = BROWN, shaft = GRAY, band = RED, reel = RED, bobber = RED } },
	Oak = { name = "Oak Rod", price = 350, speed = 1.15, luck = 1.12, desc = "Solid oak, quicker bites.",
		colors = { handle = BROWN, shaft = C(110, 70, 40), band = GOLD, reel = GOLD, bobber = BLUE } },
	Twilight = { name = "Twilight Rod", price = 1_800, speed = 1.3, luck = 1.3, desc = "Purple bands attract curious fish.",
		colors = { handle = GRAY, shaft = BLACK, band = PURPLE, reel = PURPLE, bobber = GREEN } },
	River = { name = "River Rod", price = 7_500, speed = 1.45, luck = 1.5, desc = "Light and fast for river work.",
		colors = { handle = BROWN, shaft = TAN, band = BLUE, reel = BLUE, bobber = RED } },
	Camo = { name = "Camo Rod", price = 25_000, speed = 1.62, luck = 1.75, desc = "Fish never see it coming.",
		colors = { handle = C(84, 108, 52), shaft = C(98, 124, 60), band = GREEN, reel = GREEN, bobber = RED } },
	Night = { name = "Night Rod", price = 90_000, speed = 1.8, luck = 2.05, desc = "Black carbon, red guides.",
		colors = { handle = BLACK, shaft = BLACK, band = RED, reel = RED, bobber = YELLOW } },
	Lake = { name = "Lake Rod", price = 300_000, speed = 2.0, luck = 2.45, desc = "Built for the big lake.",
		colors = { handle = BROWN, shaft = C(120, 76, 42), band = BLUE, reel = BLUE, bobber = BLUE } },
	Royal = { name = "Royal Rod", price = 1_000_000, speed = 2.25, luck = 2.95, desc = "Gold trimmed. Rare fish love it.",
		colors = { handle = BLACK, shaft = BLACK, band = GOLD, reel = GOLD, bobber = GREEN } },
	Arctic = { name = "Arctic Rod", price = 3_500_000, speed = 2.5, luck = 3.55, desc = "Frost white grip.",
		colors = { handle = WHITE, shaft = GRAY, band = RED, reel = RED, bobber = RED } },
	Jungle = { name = "Jungle Rod", price = 12_000_000, speed = 2.8, luck = 4.3, desc = "Vines wrapped, wild luck.",
		colors = { handle = BROWN, shaft = C(116, 74, 42), band = GREEN, reel = GREEN, bobber = BLUE } },
	Storm = { name = "Storm Rod", price = 40_000_000, speed = 3.1, luck = 5.3, desc = "Charged steel. Very fast bites.",
		colors = { handle = GRAY, shaft = GRAY, band = BLUE, reel = BLUE, bobber = ORANGE } },
	Master = { name = "Master Rod", price = 150_000_000, speed = 3.5, luck = 6.5, desc = "The best rod on the lake.",
		colors = { handle = TAN, shaft = TAN, band = RED, reel = RED, bobber = YELLOW } },
}

function RodConfig.get(id: string)
	return RodConfig.Rods[id] or RodConfig.Rods.Starter
end

function RodConfig.index(id: string): number
	return table.find(RodConfig.Order, id) or 1
end

return RodConfig
