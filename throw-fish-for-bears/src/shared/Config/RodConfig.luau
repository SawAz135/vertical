--[[ RodConfig: fishing rods (models follow the 12 reference rods: handle / shaft / band /
     reel / bobber colours). speed divides the bite waiting time, luck multiplies the
     fish rarity luck. Prices are $; order = shop order. ]]
local E = require(script.Parent.EconomyConfig)
local RodConfig = {}
local C = Color3.fromRGB

local BROWN, TAN, GRAY, BLACK, WHITE = C(124, 80, 45), C(206, 172, 122), C(150, 150, 156), C(36, 36, 40), C(232, 232, 232)
local RED, GOLD, PURPLE, BLUE, GREEN, ORANGE, YELLOW = C(214, 40, 40), C(232, 176, 40), C(140, 60, 200), C(30, 100, 220), C(70, 140, 50), C(250, 130, 30), C(250, 205, 40)

RodConfig.Order = {
	"Starter", "Oak", "Twilight", "River", "Camo", "Night",
	"Lake", "Royal", "Arctic", "Jungle", "Storm", "Master",
	-- EXCLUSIVE rods: only from completing Index sections (never sold)
	"Coral", "Forest", "Gilded", "Glacier", "Prism", "Abyss", "Mossback", "Phantom", "Spectrum", "Legend", "Gearwork",
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
	-- index rewards ------------------------------------------------------------------
	Coral = { name = "Coral Rod", exclusive = true, price = 0, speed = 1.5, luck = 1.7, desc = "Index: all Rare fish.",
		colors = { handle = C(250, 120, 110), shaft = C(255, 160, 140), band = WHITE, reel = WHITE, bobber = C(250, 120, 110) } },
	Forest = { name = "Forest Rod", exclusive = true, price = 0, speed = 1.6, luck = 1.9, desc = "Index: Zone 3 bears.",
		colors = { handle = BROWN, shaft = C(80, 130, 60), band = GREEN, reel = GREEN, bobber = YELLOW } },
	Gilded = { name = "Gilded Rod", exclusive = true, price = 0, speed = 2.1, luck = 2.8, desc = "Index: Golden Zone 5 bears.",
		colors = { handle = GOLD, shaft = GOLD, band = WHITE, reel = WHITE, bobber = GOLD } },
	Glacier = { name = "Glacier Rod", exclusive = true, price = 0, speed = 2.2, luck = 3.0, desc = "Index: Zone 6 bears.",
		colors = { handle = WHITE, shaft = C(160, 220, 255), band = BLUE, reel = BLUE, bobber = WHITE } },
	Prism = { name = "Prism Rod", exclusive = true, price = 0, speed = 2.6, luck = 3.8, desc = "Index: Diamond Zone 5 bears.",
		colors = { handle = C(140, 230, 255), shaft = C(200, 245, 255), band = BLUE, reel = WHITE, bobber = C(140, 230, 255) } },
	Abyss = { name = "Abyss Rod", exclusive = true, price = 0, speed = 2.7, luck = 4.0, desc = "Index: all Legendary fish.",
		colors = { handle = BLACK, shaft = C(20, 40, 80), band = C(60, 200, 220), reel = C(60, 200, 220), bobber = BLACK } },
	Mossback = { name = "Mossback Rod", exclusive = true, price = 0, speed = 3.0, luck = 5.0, desc = "Index: Ancient Zone 5 bears.",
		colors = { handle = C(120, 120, 112), shaft = C(96, 140, 70), band = C(150, 150, 140), reel = C(80, 120, 60), bobber = C(230, 120, 160) } },
	Phantom = { name = "Phantom Rod", exclusive = true, price = 0, speed = 3.3, luck = 6.0, desc = "Index: all Secret fish.",
		colors = { handle = BLACK, shaft = C(220, 220, 230), band = PURPLE, reel = PURPLE, bobber = WHITE } },
	Spectrum = { name = "Spectrum Rod", exclusive = true, price = 0, speed = 3.6, luck = 7.0, desc = "Index: Rainbow Zone 5 bears.",
		colors = { handle = PURPLE, shaft = C(255, 140, 220), band = YELLOW, reel = BLUE, bobber = GREEN } },
	Legend = { name = "Legend Rod", exclusive = true, price = 0, speed = 3.8, luck = 7.5, desc = "Index: Zone 10 bears.",
		colors = { handle = BLACK, shaft = GOLD, band = RED, reel = GOLD, bobber = RED } },
	Gearwork = { name = "Gearwork Rod", exclusive = true, price = 0, speed = 4.2, luck = 9.0, desc = "Index: Clockwork Zone 5 bears.",
		colors = { handle = C(110, 70, 40), shaft = C(200, 150, 70), band = C(184, 115, 51), reel = C(200, 150, 70), bobber = C(184, 115, 51) } },
}

for _, rod in RodConfig.Rods do
	if rod.price and rod.price > 0 then rod.price *= E.MoneyMult end
end

function RodConfig.get(id: string)
	return RodConfig.Rods[id] or RodConfig.Rods.Starter
end

function RodConfig.index(id: string): number
	return table.find(RodConfig.Order, id) or 1
end

return RodConfig
