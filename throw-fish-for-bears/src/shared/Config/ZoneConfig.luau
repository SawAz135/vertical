--[[ ZoneConfig: the 10 natural zones along the corridor (zone 1 nearest the bases).
     luck      : bear rarity luck multiplier for fish landing in this zone
     depthLuck : extra luck reached at the far end of the zone (rewards strong throws)
     ambient   : species roaming in the zone as wildlife (never the responder)
     theme     : decor builder key read by MapService (trees, snow, bamboo, palms ...)
     particles : client ambience (Leaves, Needles, Snow, Petals, Fireflies, Mist, Sand)
     The recommended strength of each zone is computed from the throw formula
     (Formulas.zoneStrength), so it stays correct when the economy is rebalanced. ]]
local ZoneConfig = {}
local C = Color3.fromRGB

ZoneConfig.Zones = {
	{
		id = "GreenForest", name = "Green Forest", theme = "forest",
		luck = 1, depthLuck = 1.5,
		ambient = { "BrownBear", "BabyBear", "BlackBear" },
		ground = C(66, 140, 44), groundAlt = C(58, 126, 38), path = C(150, 116, 74),
		fog = C(196, 226, 255), atmosphere = 0.26, tint = C(255, 255, 250),
		particles = "Leaves", sign = C(196, 142, 62),
	},
	{
		id = "PineForest", name = "Pine Forest", theme = "pine",
		luck = 1.5, depthLuck = 1.5,
		ambient = { "GrizzlyBear", "PineBear", "CinnamonBear" },
		ground = C(52, 112, 52), groundAlt = C(46, 100, 46), path = C(126, 96, 62),
		fog = C(180, 214, 210), atmosphere = 0.32, tint = C(245, 255, 245),
		particles = "Needles", sign = C(150, 100, 52),
	},
	{
		id = "MountainLake", name = "Mountain Lake", theme = "lake",
		luck = 2.2, depthLuck = 1.5,
		ambient = { "KodiakBear", "FisherBear" },
		ground = C(84, 150, 70), groundAlt = C(74, 136, 64), path = C(160, 150, 130),
		fog = C(190, 220, 245), atmosphere = 0.3, tint = C(245, 250, 255),
		particles = "Mist", sign = C(120, 140, 160),
	},
	{
		id = "SnowyForest", name = "Snowy Forest", theme = "snow",
		luck = 3.2, depthLuck = 1.5,
		ambient = { "SnowBear", "WinterBear", "SnowballBear" },
		ground = C(236, 242, 250), groundAlt = C(222, 232, 244), path = C(190, 200, 214),
		fog = C(226, 236, 250), atmosphere = 0.38, tint = C(240, 246, 255),
		particles = "Snow", sign = C(110, 150, 200),
	},
	{
		id = "FrozenLake", name = "Frozen Lake", theme = "ice",
		luck = 4.6, depthLuck = 1.5,
		ambient = { "PolarBear", "IceBear" },
		ground = C(196, 228, 246), groundAlt = C(178, 216, 240), path = C(232, 240, 250),
		fog = C(214, 236, 255), atmosphere = 0.36, tint = C(236, 246, 255),
		particles = "Snow", sign = C(90, 160, 220),
	},
	{
		id = "BambooForest", name = "Bamboo Forest", theme = "bamboo",
		luck = 6.5, depthLuck = 1.5,
		ambient = { "Panda", "RedPandaBear", "BambooBear" },
		ground = C(120, 170, 70), groundAlt = C(108, 156, 62), path = C(196, 176, 130),
		fog = C(220, 236, 200), atmosphere = 0.3, tint = C(255, 250, 240),
		particles = "Petals", sign = C(180, 60, 60),
	},
	{
		id = "RiverValley", name = "River Valley", theme = "river",
		luck = 9, depthLuck = 1.5,
		ambient = { "RiverBear", "SpectacledBear", "MudBear" },
		ground = C(96, 160, 64), groundAlt = C(86, 146, 56), path = C(170, 130, 90),
		fog = C(200, 230, 240), atmosphere = 0.3, tint = C(250, 255, 250),
		particles = "Mist", sign = C(70, 130, 190),
	},
	{
		id = "RockyMountains", name = "Rocky Mountains", theme = "rocky",
		luck = 13, depthLuck = 1.5,
		ambient = { "MountainBear", "StoneBear", "CaveBear" },
		ground = C(140, 136, 128), groundAlt = C(126, 122, 116), path = C(176, 160, 136),
		fog = C(210, 214, 224), atmosphere = 0.34, tint = C(250, 248, 245),
		particles = "Dust", sign = C(110, 110, 120),
	},
	{
		id = "DeepForest", name = "Deep Forest", theme = "deep",
		luck = 18, depthLuck = 1.5,
		ambient = { "ForestBear", "SlothBear", "MossBear" },
		ground = C(40, 92, 40), groundAlt = C(34, 80, 34), path = C(96, 76, 52),
		fog = C(120, 160, 120), atmosphere = 0.48, tint = C(225, 245, 225),
		particles = "Fireflies", sign = C(70, 100, 50),
	},
	{
		id = "TropicalBeach", name = "Tropical Beach", theme = "beach",
		luck = 26, depthLuck = 1.6,
		ambient = { "SunBear", "CoconutBear", "SurferBear" },
		ground = C(238, 214, 150), groundAlt = C(228, 202, 136), path = C(250, 232, 180),
		fog = C(200, 236, 255), atmosphere = 0.24, tint = C(255, 252, 240),
		particles = "Sand", sign = C(40, 170, 200),
	},
}

function ZoneConfig.get(i: number)
	return ZoneConfig.Zones[i]
end

return ZoneConfig
