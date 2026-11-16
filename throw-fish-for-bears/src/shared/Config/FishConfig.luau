--[[ FishConfig: species list (playable slice = 5 species, each with its own model).
     rarity      : fixed rarity tier of the species (Index + reveal + odds)
     weight      : kg range + average (avg = reference size, model scale 1)
     value       : base sell value (scaled by weight, variant)
     look        : parameters read by Models/FishBuilder (body profile, colours, fins, pattern)
     To add a species: add an entry here (and, for a special silhouette, a builder in FishBuilder). ]]
local FishConfig = {}

local C = Color3.fromRGB

FishConfig.Order = { "Trout", "Salmon", "Clownfish", "Pufferfish", "Swordfish" }

FishConfig.Species = {
	Trout = {
		name = "Trout", rarity = "Common",
		weight = { min = 0.4, max = 9, avg = 2 }, value = 6,
		look = {
			length = 2.6, height = 0.9, width = 0.62,
			profile = { { 0.62, 0.7 }, { 0.86, 0.9 }, { 0.98, 1 }, { 1, 1 }, { 0.92, 0.94 }, { 0.78, 0.8 }, { 0.58, 0.6 }, { 0.42, 0.44 } },
			colors = { back = C(96, 112, 58), side = C(150, 158, 92), belly = C(232, 228, 205), fin = C(170, 120, 92), tail = C(120, 112, 70) },
			pattern = {
				{ kind = "stripe", band = "mid", from = 2, to = 8, color = C(232, 128, 140) },
				{ kind = "spots", band = "top", color = C(52, 46, 30), every = 2 },
				{ kind = "spots", band = "mid", color = C(70, 60, 36), every = 3, offset = 1 },
			},
			dorsal = { from = 3, to = 5, height = 0.42, color = C(130, 118, 76) },
			adipose = true,
			tail = "fork", tailSize = 0.95,
			pectoral = 0.36, pelvic = true, anal = true,
		},
	},
	Salmon = {
		name = "Salmon", rarity = "Uncommon",
		weight = { min = 1.5, max = 60, avg = 8 }, value = 12,
		look = {
			length = 3.0, height = 1.0, width = 0.66,
			profile = { { 0.58, 0.66 }, { 0.84, 0.88 }, { 0.98, 1 }, { 1, 1 }, { 0.94, 0.96 }, { 0.8, 0.82 }, { 0.6, 0.62 }, { 0.42, 0.44 } },
			colors = { back = C(196, 66, 62), side = C(232, 112, 100), belly = C(245, 236, 228), fin = C(222, 130, 120), tail = C(206, 92, 84) },
			pattern = {
				{ kind = "spots", band = "top", color = C(150, 36, 40), every = 2 },
				{ kind = "checker", band = "mid", color = C(240, 140, 128) },
			},
			dorsal = { from = 3, to = 5, height = 0.46, color = C(210, 110, 104), spiky = true },
			adipose = true,
			tail = "fork", tailSize = 1.0,
			pectoral = 0.38, pelvic = true, anal = true,
		},
	},
	Clownfish = {
		name = "Clownfish", rarity = "Rare",
		weight = { min = 0.05, max = 0.45, avg = 0.15 }, value = 28,
		look = {
			length = 2.1, height = 1.05, width = 0.7,
			profile = { { 0.7, 0.72 }, { 0.92, 0.92 }, { 1, 1 }, { 1, 1 }, { 0.94, 0.92 }, { 0.78, 0.76 }, { 0.6, 0.58 } },
			colors = { back = C(255, 120, 20), side = C(255, 140, 32), belly = C(255, 160, 60), fin = C(255, 128, 24), tail = C(255, 128, 24), edge = C(24, 22, 24) },
			pattern = {
				{ kind = "vband", slices = { 2 }, color = C(250, 250, 250), edge = C(24, 22, 24) },
				{ kind = "vband", slices = { 4 }, color = C(250, 250, 250), edge = C(24, 22, 24) },
				{ kind = "vband", slices = { 7 }, color = C(250, 250, 250), edge = C(24, 22, 24) },
			},
			dorsal = { from = 2, to = 6, height = 0.5, color = C(255, 128, 24), edge = C(24, 22, 24), spiky = true },
			tail = "round", tailSize = 0.85, tailEdge = C(24, 22, 24),
			pectoral = 0.42, pectoralEdge = C(24, 22, 24), pelvic = true, anal = true,
		},
	},
	Pufferfish = {
		name = "Pufferfish", rarity = "Epic",
		weight = { min = 0.2, max = 12, avg = 1.5 }, value = 250,
		look = {
			special = "puffer",
			length = 2.3, height = 2.0, width = 2.0,
			colors = { back = C(214, 190, 128), side = C(232, 212, 158), belly = C(246, 236, 200), fin = C(206, 176, 110), tail = C(206, 176, 110), spot = C(150, 112, 70), spike = C(190, 160, 100) },
			tail = "fan", tailSize = 0.7,
			pectoral = 0.4,
		},
	},
	Swordfish = {
		name = "Swordfish", rarity = "Legendary",
		weight = { min = 20, max = 650, avg = 90 }, value = 1200,
		look = {
			special = "sword",
			length = 3.8, height = 0.95, width = 0.66,
			profile = { { 0.56, 0.62 }, { 0.8, 0.84 }, { 0.96, 0.98 }, { 1, 1 }, { 0.92, 0.92 }, { 0.74, 0.74 }, { 0.52, 0.54 }, { 0.34, 0.36 }, { 0.24, 0.26 } },
			colors = { back = C(28, 58, 120), side = C(70, 116, 176), belly = C(222, 230, 238), fin = C(30, 62, 130), tail = C(30, 62, 130), bill = C(46, 70, 112) },
			pattern = { { kind = "checker", band = "top", color = C(36, 72, 140) } },
			dorsal = { from = 2, to = 3, height = 1.1, color = C(30, 62, 130), sail = true },
			tail = "lunate", tailSize = 1.35,
			pectoral = 0.5, pelvic = false, anal = true, keel = true,
		},
	},
}

function FishConfig.get(id: string)
	return FishConfig.Species[id]
end

-- visual scale from individual weight (cube root keeps proportions believable)
function FishConfig.scaleFor(id: string, weight: number): number
	local s = FishConfig.Species[id]
	if not s then return 1 end
	return math.clamp((weight / s.weight.avg) ^ (1 / 3), 0.6, 2.1)
end

return FishConfig
