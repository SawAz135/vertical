--[[ FishUpConfig: looks of the FISH-UP training station, one tier per range of
     "gain per lift" (Shop > Strength upgrades). Same shape at every tier: only the
     materials change and accents appear (pillars, torches, crystals, cosmic aura),
     so the station visibly gets more "tryhard" as you upgrade.
     Shared by the map (MapService/Props), the shop page and the 3D dumbbell. ]]
local C = Color3.fromRGB

local FishUpConfig = {}

FishUpConfig.Tiers = {
	{ name = "Wooden", minGain = 1, stone = C(150, 150, 158), mat = C(60, 62, 70), metal = C(190, 190, 200), wood = C(196, 142, 62),
		plateA = C(220, 50, 50), plateB = C(40, 40, 46), fish = "Normal", color = C(196, 142, 62) },
	{ name = "Bronze", minGain = 3, stone = C(170, 120, 80), mat = C(64, 44, 36), metal = C(205, 127, 50), wood = C(150, 96, 50),
		plateA = C(205, 127, 50), plateB = C(90, 56, 30), fish = "Normal", color = C(220, 140, 70) },
	{ name = "Silver", minGain = 6, stone = C(200, 206, 216), mat = C(46, 56, 78), metal = C(225, 230, 240), wood = C(120, 130, 150),
		plateA = C(230, 236, 245), plateB = C(70, 90, 130), fish = "Normal", color = C(210, 220, 235) },
	{ name = "Gold", minGain = 10, stone = C(250, 204, 70), mat = C(110, 30, 34), metal = C(255, 214, 70), wood = C(170, 60, 50),
		plateA = C(255, 210, 60), plateB = C(150, 30, 40), fish = "Golden", color = C(255, 205, 50) },
	{ name = "Diamond", minGain = 15, stone = C(160, 225, 255), mat = C(24, 50, 96), metal = C(190, 245, 255), wood = C(60, 120, 200),
		plateA = C(140, 230, 255), plateB = C(30, 80, 170), fish = "Diamond", color = C(120, 220, 255) },
	{ name = "Cosmic", minGain = 25, stone = C(96, 56, 180), mat = C(18, 10, 40), metal = C(210, 170, 255), wood = C(60, 30, 120),
		plateA = C(200, 120, 255), plateB = C(30, 16, 70), fish = "Rainbow", color = C(190, 120, 255) },
}

function FishUpConfig.tierFor(gain: number): number
	local t = 1
	for i, tier in FishUpConfig.Tiers do
		if (gain or 1) >= tier.minGain then t = i end
	end
	return t
end

function FishUpConfig.get(i: number)
	return FishUpConfig.Tiers[math.clamp(i, 1, #FishUpConfig.Tiers)]
end

return FishUpConfig
