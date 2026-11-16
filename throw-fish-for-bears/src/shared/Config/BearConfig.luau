--[[ BearConfig: bear species (playable slice = 5, each with its own silhouette).
     body/head/leg sizes are studs at scale 1 (= reference weight). Individual bears
     scale uniformly with the cube root of their weight.
     income   : base $/s before rarity / weight / variant multipliers
     spawn    : relative weight in the species roll (every species is always possible)
     zones    : home zones (spawn weight x zoneAffinity there)
     speed    : walk speed when the player controls this bear (studs/s at scale 1)
     gait     : animation tempo (heavy bears < 1, light bears > 1) ]]
local BearConfig = {}

local C = Color3.fromRGB

BearConfig.Order = { "BrownBear", "BlackBear", "GrizzlyBear", "PolarBear", "Panda" }
BearConfig.ZoneAffinity = 4

BearConfig.Species = {
	BrownBear = {
		name = "Brown Bear",
		income = 2, spawn = 10, zones = { 1 },
		weight = { min = 40, max = 320, ref = 120 },
		speed = 30, gait = 1.0,
		body = { w = 3.4, h = 3.0, l = 4.6 }, leg = { len = 1.6, t = 1.25 },
		head = { s = 3.0, muzzle = 0.95, ear = 1.0 },
		colors = {
			fur = C(122, 76, 44), fur2 = C(100, 61, 35), belly = C(148, 98, 60), muzzle = C(214, 168, 118),
			paw = C(204, 156, 106), ear = C(200, 146, 102), nose = C(32, 24, 22), claw = C(238, 226, 200),
		},
		traits = { tongue = true },
	},
	BlackBear = {
		name = "Black Bear",
		income = 2.4, spawn = 9, zones = { 1 },
		weight = { min = 40, max = 260, ref = 100 },
		speed = 31, gait = 1.06,
		body = { w = 3.2, h = 2.8, l = 4.5 }, leg = { len = 1.6, t = 1.15 },
		head = { s = 2.8, muzzle = 1.1, ear = 1.05 },
		colors = {
			fur = C(34, 33, 36), fur2 = C(48, 47, 52), belly = C(42, 41, 45), muzzle = C(196, 152, 108),
			paw = C(44, 43, 47), ear = C(196, 152, 108), nose = C(18, 16, 16), claw = C(210, 200, 180),
			mark = C(214, 170, 110),
		},
		traits = { chestV = true },
	},
	GrizzlyBear = {
		name = "Grizzly Bear",
		income = 6, spawn = 5, zones = { 1 },
		weight = { min = 110, max = 480, ref = 260 },
		speed = 28, gait = 0.88,
		body = { w = 3.9, h = 3.3, l = 5.0 }, leg = { len = 1.75, t = 1.45 },
		head = { s = 3.1, muzzle = 1.0, ear = 0.9 },
		colors = {
			fur = C(96, 62, 40), fur2 = C(80, 52, 34), belly = C(120, 82, 54), muzzle = C(186, 140, 96),
			paw = C(78, 50, 33), ear = C(150, 108, 74), nose = C(26, 20, 18), claw = C(240, 232, 214),
			extra = C(168, 124, 86), -- grizzled tips
		},
		traits = { hump = true, grizzled = true, longClaws = true },
	},
	PolarBear = {
		name = "Polar Bear",
		income = 11, spawn = 3, zones = {},
		weight = { min = 150, max = 700, ref = 400 },
		speed = 29, gait = 0.92,
		body = { w = 3.6, h = 3.1, l = 5.4 }, leg = { len = 1.85, t = 1.35 },
		head = { s = 2.8, muzzle = 1.35, ear = 0.72 },
		colors = {
			fur = C(240, 240, 236), fur2 = C(222, 224, 222), belly = C(246, 246, 244), muzzle = C(252, 252, 250),
			paw = C(232, 232, 228), ear = C(214, 214, 212), nose = C(26, 26, 30), claw = C(70, 70, 76),
			mark = C(140, 196, 240), -- snowflake chest emblem
		},
		traits = { snowflake = true },
	},
	Panda = {
		name = "Panda",
		income = 10, spawn = 3, zones = {},
		weight = { min = 70, max = 160, ref = 110 },
		speed = 28, gait = 0.95,
		body = { w = 3.6, h = 3.2, l = 4.4 }, leg = { len = 1.4, t = 1.38 },
		head = { s = 3.3, muzzle = 0.8, ear = 1.1 },
		colors = {
			fur = C(242, 242, 240), fur2 = C(228, 228, 226), belly = C(246, 246, 244), muzzle = C(250, 250, 248),
			paw = C(34, 34, 38), ear = C(34, 34, 38), nose = C(24, 24, 28), claw = C(80, 80, 86),
			patch = C(34, 34, 38),
		},
		traits = { panda = true },
	},
}

function BearConfig.get(id: string)
	return BearConfig.Species[id]
end

-- uniform model scale from individual weight
function BearConfig.scaleFor(id: string, weight: number): number
	local s = BearConfig.Species[id]
	if not s then return 1 end
	return math.clamp((weight / s.weight.ref) ^ (1 / 3), 0.68, 1.6)
end

return BearConfig
