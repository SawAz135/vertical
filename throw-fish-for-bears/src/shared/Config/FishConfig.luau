--[[ FishConfig: the full collection (43 species, each with its own model).
     rarity      : fixed rarity tier of the species (Index + reveal + odds)
     weight      : kg range + average (avg = reference size, model scale 1)
     value       : base sell value (scaled by weight, variant)
     look        : parameters read by Models/FishBuilder
       profile   : body slices { height, width } (nose -> tail)
       pattern   : stripe / checker / spots / vband / patch (cells "3top")
       dorsal    : { from, to, height, color, spiky, sail, edge }
       tail      : fork | lunate | round | fan | veil | shark | point | stub
       options   : barbels, teeth, lure, finlets, scutes, spines, hammer, shark,
                   bill, tallAnal, bigMouth, keel, adipose, pelvic, anal, crest
       special   : puffer | ray | seahorse (own silhouette builders)
     To add a species: add an entry here and to FishConfig.Order. ]]
local FishConfig = {}

local C = Color3.fromRGB

-- body profiles (height, width per slice) shared by several species
local P = {
	std = { { 0.62, 0.7 }, { 0.86, 0.9 }, { 0.98, 1 }, { 1, 1 }, { 0.92, 0.94 }, { 0.78, 0.8 }, { 0.58, 0.6 }, { 0.42, 0.44 } },
	slim = { { 0.5, 0.6 }, { 0.8, 0.84 }, { 0.95, 0.96 }, { 1, 1 }, { 0.95, 0.95 }, { 0.82, 0.82 }, { 0.64, 0.64 }, { 0.46, 0.46 }, { 0.32, 0.34 } },
	deep = { { 0.7, 0.72 }, { 0.92, 0.92 }, { 1, 1 }, { 1, 1 }, { 0.94, 0.92 }, { 0.78, 0.76 }, { 0.6, 0.58 } },
	disc = { { 0.62, 0.8 }, { 0.9, 0.95 }, { 1, 1 }, { 1, 1 }, { 0.94, 0.95 }, { 0.78, 0.8 }, { 0.5, 0.6 } },
	torpedo = { { 0.55, 0.6 }, { 0.85, 0.85 }, { 1, 1 }, { 1, 1 }, { 0.95, 0.95 }, { 0.75, 0.75 }, { 0.5, 0.5 }, { 0.3, 0.3 }, { 0.2, 0.22 } },
	blunt = { { 1, 0.7 }, { 1, 0.85 }, { 0.98, 0.95 }, { 0.92, 1 }, { 0.84, 0.95 }, { 0.72, 0.8 }, { 0.58, 0.64 }, { 0.44, 0.5 }, { 0.32, 0.36 } },
	eel = { { 0.7, 0.7 }, { 0.9, 0.9 }, { 1, 1 }, { 1, 1 }, { 1, 1 }, { 0.98, 0.98 }, { 0.95, 0.95 }, { 0.9, 0.9 }, { 0.84, 0.84 }, { 0.76, 0.76 }, { 0.66, 0.66 }, { 0.54, 0.54 }, { 0.42, 0.42 }, { 0.3, 0.3 } },
	shark = { { 0.42, 0.5 }, { 0.72, 0.78 }, { 0.92, 0.95 }, { 1, 1 }, { 1, 1 }, { 0.9, 0.9 }, { 0.72, 0.72 }, { 0.52, 0.52 }, { 0.36, 0.36 }, { 0.24, 0.26 } },
	pike = { { 0.42, 0.52 }, { 0.62, 0.7 }, { 0.84, 0.86 }, { 0.96, 0.96 }, { 1, 1 }, { 1, 1 }, { 0.95, 0.95 }, { 0.82, 0.82 }, { 0.62, 0.62 }, { 0.42, 0.44 } },
	round = { { 0.7, 0.8 }, { 0.95, 0.96 }, { 1, 1 }, { 1, 1 }, { 0.92, 0.94 }, { 0.72, 0.74 } },
	mola = { { 0.74, 0.62 }, { 0.92, 0.8 }, { 1, 0.86 }, { 1, 0.86 }, { 0.96, 0.8 }, { 0.84, 0.66 } },
	angler = { { 0.92, 0.95 }, { 1, 1 }, { 1, 1 }, { 0.92, 0.9 }, { 0.74, 0.7 }, { 0.5, 0.48 } },
	oar = { { 0.85, 0.5 }, { 1, 0.6 }, { 1, 0.6 }, { 1, 0.6 }, { 0.98, 0.58 }, { 0.95, 0.56 }, { 0.92, 0.54 }, { 0.88, 0.52 }, { 0.82, 0.48 }, { 0.74, 0.44 }, { 0.64, 0.38 }, { 0.52, 0.32 }, { 0.4, 0.26 }, { 0.28, 0.2 } },
}
FishConfig.Profiles = P

FishConfig.Order = {
	-- Common
	"Sardine", "Anchovy", "Minnow", "Herring", "Perch", "Bluegill", "Carp", "Trout",
	-- Uncommon
	"Mackerel", "Bass", "Tilapia", "Cod", "Catfish", "Salmon", "Goldfish", "Guppy",
	-- Rare
	"Clownfish", "Pike", "Walleye", "Koi", "Angelfish", "BlueTang", "Betta", "Piranha",
	-- Epic
	"Pufferfish", "Tuna", "Eel", "Discus", "Lionfish", "MahiMahi", "Sturgeon",
	-- Legendary
	"Swordfish", "Barracuda", "Stingray", "Marlin", "Sunfish",
	-- Mythic
	"Hammerhead", "MantaRay", "Anglerfish",
	-- Secret
	"GreatWhite", "Oarfish",
	-- Ultra Secret
	"GoldenArowana", "Seahorse",
	-- Impossible (one of a kind)
	"CosmicKoi",
}

local DARK = C(24, 22, 24)

FishConfig.Species = {
	---------------------------------------------------------------- Common
	Sardine = {
		name = "Sardine", rarity = "Common", weight = { min = 0.03, max = 0.25, avg = 0.1 }, value = 3,
		look = {
			length = 1.9, height = 0.55, width = 0.42, profile = P.slim,
			colors = { back = C(40, 84, 140), side = C(196, 208, 222), belly = C(240, 244, 248), fin = C(150, 170, 196), tail = C(110, 136, 170) },
			pattern = { { kind = "spots", band = "mid", color = C(40, 60, 100), every = 2 }, { kind = "stripe", band = "top", from = 1, to = 9, color = C(52, 104, 168) } },
			dorsal = { from = 4, to = 5, height = 0.4, color = C(90, 120, 160) },
			tail = "fork", tailSize = 0.9, pectoral = 0.3, pelvic = true, anal = true,
		},
	},
	Anchovy = {
		name = "Anchovy", rarity = "Common", weight = { min = 0.01, max = 0.08, avg = 0.03 }, value = 2,
		look = {
			length = 1.7, height = 0.42, width = 0.36, profile = P.slim,
			colors = { back = C(96, 130, 120), side = C(220, 228, 226), belly = C(246, 248, 248), fin = C(190, 200, 200), tail = C(150, 170, 166) },
			pattern = { { kind = "stripe", band = "mid", from = 2, to = 9, color = C(200, 212, 220) } },
			dorsal = { from = 4, to = 4, height = 0.45, color = C(160, 180, 176) },
			bigMouth = true, tail = "fork", tailSize = 0.9, pectoral = 0.28, anal = true,
		},
	},
	Minnow = {
		name = "Minnow", rarity = "Common", weight = { min = 0.005, max = 0.05, avg = 0.02 }, value = 2,
		look = {
			length = 1.5, height = 0.48, width = 0.38, profile = P.std,
			colors = { back = C(120, 120, 80), side = C(200, 186, 130), belly = C(236, 228, 200), fin = C(200, 180, 120), tail = C(170, 150, 100) },
			pattern = { { kind = "stripe", band = "mid", from = 2, to = 8, color = C(60, 56, 40) } },
			dorsal = { from = 4, to = 5, height = 0.36, color = C(160, 140, 90) },
			tail = "fork", tailSize = 0.85, pectoral = 0.3, pelvic = true, anal = true,
		},
	},
	Herring = {
		name = "Herring", rarity = "Common", weight = { min = 0.1, max = 0.8, avg = 0.3 }, value = 4,
		look = {
			length = 2.2, height = 0.66, width = 0.44, profile = P.slim,
			colors = { back = C(54, 96, 130), side = C(210, 220, 230), belly = C(244, 246, 250), fin = C(170, 186, 200), tail = C(120, 150, 176) },
			pattern = { { kind = "checker", band = "top", color = C(72, 120, 160) } },
			dorsal = { from = 4, to = 5, height = 0.36, color = C(110, 140, 170) },
			tail = "fork", tailSize = 1, pectoral = 0.3, pelvic = true, anal = true, keel = true,
		},
	},
	Perch = {
		name = "Perch", rarity = "Common", weight = { min = 0.1, max = 2, avg = 0.5 }, value = 5,
		look = {
			length = 2.2, height = 0.85, width = 0.56, profile = P.std,
			colors = { back = C(74, 104, 46), side = C(176, 186, 70), belly = C(236, 232, 196), fin = C(240, 110, 40), tail = C(200, 120, 50), edge = DARK },
			pattern = {
				{ kind = "vband", slices = { 2 }, color = C(50, 70, 32) }, { kind = "vband", slices = { 4 }, color = C(50, 70, 32) },
				{ kind = "vband", slices = { 6 }, color = C(50, 70, 32) },
			},
			dorsal = { from = 2, to = 5, height = 0.5, color = C(110, 120, 60), spiky = true },
			tail = "fork", tailSize = 0.9, pectoral = 0.34, pelvic = true, anal = true,
		},
	},
	Bluegill = {
		name = "Bluegill", rarity = "Common", weight = { min = 0.05, max = 1.2, avg = 0.3 }, value = 5,
		look = {
			length = 1.9, height = 1.15, width = 0.5, profile = P.disc,
			colors = { back = C(60, 90, 70), side = C(120, 150, 110), belly = C(250, 170, 60), fin = C(90, 110, 90), tail = C(90, 110, 90) },
			pattern = { { kind = "patch", cells = { "2mid" }, color = C(30, 40, 90) }, { kind = "vband", slices = { 3, 5 }, color = C(80, 110, 86) } },
			dorsal = { from = 2, to = 6, height = 0.32, color = C(70, 90, 76), spiky = true },
			tail = "round", tailSize = 0.75, pectoral = 0.36, pelvic = true, anal = true, tallAnal = 1.4,
		},
	},
	Carp = {
		name = "Carp", rarity = "Common", weight = { min = 1, max = 30, avg = 5 }, value = 6,
		look = {
			length = 2.8, height = 1.05, width = 0.72, profile = P.std,
			colors = { back = C(120, 96, 50), side = C(196, 160, 80), belly = C(236, 216, 160), fin = C(170, 120, 70), tail = C(160, 110, 60) },
			pattern = { { kind = "checker", band = "mid", color = C(210, 176, 96) }, { kind = "checker", band = "top", color = C(140, 110, 58) } },
			dorsal = { from = 2, to = 6, height = 0.34, color = C(140, 104, 60) },
			barbels = { count = 2, length = 0.35, color = C(170, 130, 80) },
			tail = "fork", tailSize = 0.95, pectoral = 0.36, pelvic = true, anal = true,
		},
	},
	Trout = {
		name = "Trout", rarity = "Common", weight = { min = 0.4, max = 9, avg = 2 }, value = 6,
		look = {
			length = 2.6, height = 0.9, width = 0.62, profile = P.std,
			colors = { back = C(96, 112, 58), side = C(150, 158, 92), belly = C(232, 228, 205), fin = C(170, 120, 92), tail = C(120, 112, 70) },
			pattern = {
				{ kind = "stripe", band = "mid", from = 2, to = 8, color = C(232, 128, 140) },
				{ kind = "spots", band = "top", color = C(52, 46, 30), every = 2 },
				{ kind = "spots", band = "mid", color = C(70, 60, 36), every = 3, offset = 1 },
			},
			dorsal = { from = 3, to = 5, height = 0.42, color = C(130, 118, 76) },
			adipose = true, tail = "fork", tailSize = 0.95, pectoral = 0.36, pelvic = true, anal = true,
		},
	},
	---------------------------------------------------------------- Uncommon
	Mackerel = {
		name = "Mackerel", rarity = "Uncommon", weight = { min = 0.2, max = 3, avg = 0.8 }, value = 9,
		look = {
			length = 2.5, height = 0.7, width = 0.52, profile = P.torpedo,
			colors = { back = C(40, 120, 110), side = C(196, 216, 220), belly = C(244, 246, 248), fin = C(90, 120, 130), tail = C(50, 90, 100) },
			pattern = { { kind = "checker", band = "top", color = C(20, 50, 50) } },
			dorsal = { from = 3, to = 4, height = 0.4, color = C(50, 90, 96) },
			finlets = C(220, 200, 80), tail = "lunate", tailSize = 0.95, pectoral = 0.3, anal = true, keel = true,
		},
	},
	Bass = {
		name = "Bass", rarity = "Uncommon", weight = { min = 0.4, max = 10, avg = 2.2 }, value = 10,
		look = {
			length = 2.6, height = 1.0, width = 0.68, profile = P.std,
			colors = { back = C(70, 100, 46), side = C(150, 170, 90), belly = C(230, 230, 200), fin = C(110, 130, 70), tail = C(100, 120, 64) },
			pattern = { { kind = "spots", band = "mid", color = C(40, 56, 30), every = 1 } },
			dorsal = { from = 2, to = 6, height = 0.44, color = C(90, 116, 60), spiky = true },
			bigMouth = true, tail = "round", tailSize = 0.85, pectoral = 0.36, pelvic = true, anal = true,
		},
	},
	Tilapia = {
		name = "Tilapia", rarity = "Uncommon", weight = { min = 0.2, max = 4, avg = 1 }, value = 9,
		look = {
			length = 2.2, height = 1.05, width = 0.6, profile = P.deep,
			colors = { back = C(110, 116, 120), side = C(176, 180, 186), belly = C(230, 230, 234), fin = C(200, 120, 120), tail = C(190, 110, 110) },
			pattern = { { kind = "vband", slices = { 2, 4, 6 }, color = C(146, 150, 156) } },
			dorsal = { from = 2, to = 6, height = 0.38, color = C(150, 150, 156), spiky = true, edge = C(220, 90, 90) },
			tail = "round", tailSize = 0.8, pectoral = 0.36, pelvic = true, anal = true,
		},
	},
	Cod = {
		name = "Cod", rarity = "Uncommon", weight = { min = 1, max = 40, avg = 6 }, value = 11,
		look = {
			length = 2.9, height = 0.95, width = 0.7, profile = P.slim,
			colors = { back = C(130, 120, 84), side = C(190, 180, 136), belly = C(240, 236, 220), fin = C(150, 140, 100), tail = C(140, 130, 92) },
			pattern = { { kind = "spots", band = "top", color = C(96, 86, 56), every = 1 }, { kind = "stripe", band = "mid", from = 2, to = 9, color = C(230, 226, 206) } },
			dorsal = { from = 2, to = 8, height = 0.28, color = C(150, 140, 100) },
			barbels = { count = 1, length = 0.3, color = C(200, 190, 150) },
			tail = "round", tailSize = 0.8, pectoral = 0.32, pelvic = true, anal = true,
		},
	},
	Catfish = {
		name = "Catfish", rarity = "Uncommon", weight = { min = 1, max = 60, avg = 6 }, value = 12,
		look = {
			length = 3.0, height = 0.9, width = 0.9, profile = P.blunt,
			colors = { back = C(70, 66, 62), side = C(110, 106, 100), belly = C(220, 214, 200), fin = C(80, 76, 72), tail = C(80, 76, 72) },
			pattern = { { kind = "spots", band = "top", color = C(46, 44, 42), every = 2 } },
			dorsal = { from = 2, to = 3, height = 0.46, color = C(80, 76, 72) },
			barbels = { count = 3, length = 0.8, color = C(60, 56, 52) }, bigMouth = true, adipose = true,
			tail = "fork", tailSize = 0.8, pectoral = 0.4, pelvic = true, anal = true,
		},
	},
	Salmon = {
		name = "Salmon", rarity = "Uncommon", weight = { min = 1.5, max = 60, avg = 8 }, value = 12,
		look = {
			length = 3.0, height = 1.0, width = 0.66, profile = P.std,
			colors = { back = C(196, 66, 62), side = C(232, 112, 100), belly = C(245, 236, 228), fin = C(222, 130, 120), tail = C(206, 92, 84) },
			pattern = { { kind = "spots", band = "top", color = C(150, 36, 40), every = 2 }, { kind = "checker", band = "mid", color = C(240, 140, 128) } },
			dorsal = { from = 3, to = 5, height = 0.46, color = C(210, 110, 104), spiky = true },
			adipose = true, tail = "fork", tailSize = 1.0, pectoral = 0.38, pelvic = true, anal = true,
		},
	},
	Goldfish = {
		name = "Goldfish", rarity = "Uncommon", weight = { min = 0.05, max = 1.5, avg = 0.3 }, value = 14,
		look = {
			length = 1.9, height = 1.1, width = 0.8, profile = P.round,
			colors = { back = C(255, 120, 20), side = C(255, 150, 40), belly = C(255, 200, 110), fin = C(255, 140, 40), tail = C(255, 130, 30) },
			pattern = { { kind = "patch", cells = { "1top", "2mid" }, color = C(255, 230, 170) } },
			dorsal = { from = 2, to = 4, height = 0.5, color = C(255, 130, 30) },
			tail = "veil", tailSize = 1.35, pectoral = 0.38, pelvic = true, anal = true,
		},
	},
	Guppy = {
		name = "Guppy", rarity = "Uncommon", weight = { min = 0.002, max = 0.02, avg = 0.006 }, value = 14,
		look = {
			length = 1.4, height = 0.5, width = 0.36, profile = P.std,
			colors = { back = C(150, 160, 170), side = C(200, 206, 212), belly = C(236, 238, 240), fin = C(80, 160, 255), tail = C(255, 90, 160), spot = C(60, 60, 220) },
			pattern = { { kind = "patch", cells = { "6mid", "7top" }, color = C(255, 160, 40) } },
			dorsal = { from = 5, to = 6, height = 0.6, color = C(80, 160, 255) },
			tail = "veil", tailSize = 1.6, pectoral = 0.3, anal = true,
		},
	},
	---------------------------------------------------------------- Rare
	Clownfish = {
		name = "Clownfish", rarity = "Rare", weight = { min = 0.05, max = 0.45, avg = 0.15 }, value = 28,
		look = {
			length = 2.1, height = 1.05, width = 0.7, profile = P.deep,
			colors = { back = C(255, 120, 20), side = C(255, 140, 32), belly = C(255, 160, 60), fin = C(255, 128, 24), tail = C(255, 128, 24), edge = DARK },
			pattern = {
				{ kind = "vband", slices = { 2 }, color = C(250, 250, 250), edge = DARK },
				{ kind = "vband", slices = { 4 }, color = C(250, 250, 250), edge = DARK },
				{ kind = "vband", slices = { 7 }, color = C(250, 250, 250), edge = DARK },
			},
			dorsal = { from = 2, to = 6, height = 0.5, color = C(255, 128, 24), edge = DARK, spiky = true },
			tail = "round", tailSize = 0.85, tailEdge = DARK, pectoral = 0.42, pectoralEdge = DARK, pelvic = true, anal = true,
		},
	},
	Pike = {
		name = "Pike", rarity = "Rare", weight = { min = 1, max = 25, avg = 5 }, value = 30,
		look = {
			length = 3.4, height = 0.78, width = 0.6, profile = P.pike,
			colors = { back = C(60, 90, 50), side = C(120, 150, 80), belly = C(236, 232, 200), fin = C(150, 110, 70), tail = C(120, 110, 60) },
			pattern = { { kind = "spots", band = "mid", color = C(220, 226, 170), every = 1 }, { kind = "spots", band = "top", color = C(190, 200, 140), every = 2, offset = 1 } },
			dorsal = { from = 8, to = 9, height = 0.5, color = C(130, 110, 64) },
			snout = 0.45, teeth = C(250, 250, 240), bigMouth = true,
			tail = "fork", tailSize = 0.9, pectoral = 0.32, pelvic = true, anal = true,
		},
	},
	Walleye = {
		name = "Walleye", rarity = "Rare", weight = { min = 0.5, max = 9, avg = 2 }, value = 32,
		look = {
			length = 2.8, height = 0.85, width = 0.6, profile = P.slim,
			colors = { back = C(130, 110, 50), side = C(200, 180, 90), belly = C(240, 236, 210), fin = C(180, 160, 90), tail = C(170, 150, 80) },
			pattern = { { kind = "vband", slices = { 2, 4, 6 }, color = C(110, 92, 40) } },
			dorsal = { from = 2, to = 4, height = 0.48, color = C(150, 130, 70), spiky = true },
			bigEyes = 1.6, eyeColor = C(230, 230, 200), teeth = C(250, 250, 240),
			tail = "fork", tailSize = 0.95, tailEdge = C(250, 250, 250), pectoral = 0.32, pelvic = true, anal = true,
		},
	},
	Koi = {
		name = "Koi", rarity = "Rare", weight = { min = 1, max = 20, avg = 4 }, value = 36,
		look = {
			length = 2.9, height = 0.95, width = 0.72, profile = P.std,
			colors = { back = C(250, 250, 248), side = C(250, 248, 246), belly = C(250, 250, 250), fin = C(250, 250, 250), tail = C(250, 240, 236) },
			pattern = {
				{ kind = "patch", cells = { "1top", "2top", "3mid", "5top", "6top", "6mid" }, color = C(240, 70, 30) },
				{ kind = "patch", cells = { "4top", "7mid" }, color = C(30, 30, 34) },
			},
			dorsal = { from = 2, to = 6, height = 0.3, color = C(250, 250, 250) },
			barbels = { count = 2, length = 0.3, color = C(250, 220, 200) },
			tail = "veil", tailSize = 1.05, pectoral = 0.42, pelvic = true, anal = true,
		},
	},
	Angelfish = {
		name = "Angelfish", rarity = "Rare", weight = { min = 0.05, max = 0.5, avg = 0.15 }, value = 34,
		look = {
			length = 1.8, height = 1.5, width = 0.4, profile = P.disc,
			colors = { back = C(240, 236, 220), side = C(246, 244, 236), belly = C(250, 250, 246), fin = C(230, 226, 210), tail = C(230, 226, 210) },
			pattern = { { kind = "vband", slices = { 2, 4, 6 }, color = C(40, 40, 46) } },
			dorsal = { from = 2, to = 5, height = 1.0, color = C(230, 226, 210), sail = true, edge = C(40, 40, 46) },
			tallAnal = 3.2, tail = "veil", tailSize = 1.0, pectoral = 0.3, pelvic = true, anal = true,
		},
	},
	BlueTang = {
		name = "Blue Tang", rarity = "Rare", weight = { min = 0.1, max = 0.6, avg = 0.25 }, value = 38,
		look = {
			length = 2.1, height = 1.15, width = 0.48, profile = P.disc,
			colors = { back = C(30, 80, 220), side = C(40, 110, 240), belly = C(80, 150, 250), fin = C(30, 80, 220), tail = C(255, 220, 40), edge = DARK },
			pattern = { { kind = "patch", cells = { "2top", "3top", "4top", "5top", "4mid", "5mid", "6mid" }, color = C(20, 22, 40) } },
			dorsal = { from = 2, to = 7, height = 0.3, color = C(30, 70, 200), edge = DARK },
			tail = "lunate", tailSize = 0.8, pectoral = 0.36, pectoralColor = C(255, 220, 40), pelvic = true, anal = true, tallAnal = 1.4,
		},
	},
	Betta = {
		name = "Betta", rarity = "Rare", weight = { min = 0.003, max = 0.02, avg = 0.008 }, value = 40,
		look = {
			length = 1.6, height = 0.6, width = 0.4, profile = P.std,
			colors = { back = C(160, 20, 60), side = C(200, 30, 70), belly = C(220, 60, 100), fin = C(70, 70, 240), tail = C(220, 30, 80), edge = C(80, 120, 255) },
			dorsal = { from = 4, to = 7, height = 1.2, color = C(200, 30, 80), sail = true },
			tallAnal = 3.4, tail = "veil", tailSize = 2.2, tailEdge = C(80, 120, 255), pectoral = 0.4, pelvic = true, anal = true,
		},
	},
	Piranha = {
		name = "Piranha", rarity = "Rare", weight = { min = 0.2, max = 3.5, avg = 1 }, value = 42,
		look = {
			length = 1.9, height = 1.2, width = 0.6, profile = P.deep,
			colors = { back = C(120, 130, 136), side = C(170, 176, 180), belly = C(230, 60, 40), fin = C(170, 70, 60), tail = C(70, 70, 76) },
			pattern = { { kind = "spots", band = "mid", color = C(220, 230, 236), every = 2 } },
			dorsal = { from = 4, to = 5, height = 0.36, color = C(110, 110, 116) },
			teeth = C(255, 255, 250), underbite = true, bigMouth = true, adipose = true,
			tail = "fork", tailSize = 0.8, pectoral = 0.3, pelvic = true, anal = true,
		},
	},
	---------------------------------------------------------------- Epic
	Pufferfish = {
		name = "Pufferfish", rarity = "Epic", weight = { min = 0.2, max = 12, avg = 1.5 }, value = 250,
		look = {
			special = "puffer", length = 2.3, height = 2.0, width = 2.0,
			colors = { back = C(214, 190, 128), side = C(232, 212, 158), belly = C(246, 236, 200), fin = C(206, 176, 110), tail = C(206, 176, 110), spot = C(150, 112, 70), spike = C(190, 160, 100) },
			tail = "fan", tailSize = 0.7, pectoral = 0.4,
		},
	},
	Tuna = {
		name = "Tuna", rarity = "Epic", weight = { min = 10, max = 400, avg = 60 }, value = 220,
		look = {
			length = 3.6, height = 1.25, width = 0.95, profile = P.torpedo,
			colors = { back = C(30, 46, 100), side = C(170, 186, 200), belly = C(236, 240, 246), fin = C(240, 200, 40), tail = C(40, 56, 110) },
			pattern = { { kind = "stripe", band = "mid", from = 2, to = 6, color = C(120, 160, 200) } },
			dorsal = { from = 3, to = 4, height = 0.5, color = C(240, 200, 40) },
			finlets = C(250, 210, 40), keel = true, tail = "lunate", tailSize = 1.3, pectoral = 0.44, anal = true,
		},
	},
	Eel = {
		name = "Eel", rarity = "Epic", weight = { min = 0.5, max = 15, avg = 3 }, value = 230,
		look = {
			length = 4.2, height = 0.52, width = 0.46, profile = P.eel,
			colors = { back = C(60, 70, 40), side = C(110, 120, 60), belly = C(220, 210, 140), fin = C(80, 90, 50), tail = C(70, 80, 46) },
			dorsal = { from = 5, to = 14, height = 0.32, color = C(80, 90, 50) },
			tail = "point", tailSize = 0.9, pectoral = 0.36, anal = true, longAnal = true,
		},
	},
	Discus = {
		name = "Discus", rarity = "Epic", weight = { min = 0.05, max = 0.3, avg = 0.12 }, value = 240,
		look = {
			length = 1.9, height = 1.75, width = 0.36, profile = P.disc,
			colors = { back = C(220, 90, 40), side = C(250, 130, 50), belly = C(255, 170, 80), fin = C(240, 110, 40), tail = C(220, 140, 70) },
			pattern = { { kind = "stripe", band = "top", from = 1, to = 7, color = C(60, 170, 220) }, { kind = "checker", band = "mid", color = C(70, 180, 230) } },
			dorsal = { from = 2, to = 7, height = 0.3, color = C(60, 170, 220) },
			tallAnal = 1.6, tail = "round", tailSize = 0.7, pectoral = 0.28, pelvic = true, anal = true,
		},
	},
	Lionfish = {
		name = "Lionfish", rarity = "Epic", weight = { min = 0.1, max = 1.4, avg = 0.5 }, value = 260,
		look = {
			length = 2.2, height = 0.95, width = 0.6, profile = P.std,
			colors = { back = C(170, 40, 30), side = C(240, 236, 226), belly = C(250, 240, 230), fin = C(220, 120, 100), tail = C(200, 110, 90) },
			pattern = { { kind = "vband", slices = { 1, 3, 5, 7 }, color = C(180, 50, 34) } },
			spines = { count = 9, height = 1.3, color = C(200, 60, 44), tip = C(250, 240, 230) },
			tail = "fan", tailSize = 0.9, pectoral = 1.0, pectoralColor = C(230, 140, 120), pelvic = true, anal = true,
		},
	},
	MahiMahi = {
		name = "Mahi-Mahi", rarity = "Epic", weight = { min = 3, max = 40, avg = 12 }, value = 250,
		look = {
			length = 3.4, height = 1.1, width = 0.6, profile = P.blunt,
			colors = { back = C(40, 150, 120), side = C(150, 200, 60), belly = C(250, 220, 60), fin = C(60, 150, 200), tail = C(230, 200, 50) },
			pattern = { { kind = "spots", band = "mid", color = C(40, 110, 170), every = 1 } },
			dorsal = { from = 1, to = 9, height = 0.42, color = C(40, 120, 190) },
			tail = "fork", tailSize = 1.2, pectoral = 0.34, anal = true, longAnal = true,
		},
	},
	Sturgeon = {
		name = "Sturgeon", rarity = "Epic", weight = { min = 10, max = 900, avg = 80 }, value = 260,
		look = {
			length = 4.0, height = 0.85, width = 0.8, profile = P.shark,
			colors = { back = C(90, 96, 100), side = C(140, 146, 150), belly = C(226, 226, 222), fin = C(100, 106, 110), tail = C(90, 96, 100) },
			dorsal = { from = 8, to = 8, height = 0.5, color = C(100, 106, 110) },
			scutes = C(220, 216, 200), snout = 0.5, barbels = { count = 2, length = 0.3, color = C(220, 210, 200) },
			tail = "shark", tailSize = 1.1, pectoral = 0.42, pelvic = true, anal = true,
		},
	},
	---------------------------------------------------------------- Legendary
	Swordfish = {
		name = "Swordfish", rarity = "Legendary", weight = { min = 20, max = 650, avg = 90 }, value = 1200,
		look = {
			length = 3.8, height = 0.95, width = 0.66, bill = 0.42,
			profile = { { 0.56, 0.62 }, { 0.8, 0.84 }, { 0.96, 0.98 }, { 1, 1 }, { 0.92, 0.92 }, { 0.74, 0.74 }, { 0.52, 0.54 }, { 0.34, 0.36 }, { 0.24, 0.26 } },
			colors = { back = C(28, 58, 120), side = C(70, 116, 176), belly = C(222, 230, 238), fin = C(30, 62, 130), tail = C(30, 62, 130), bill = C(46, 70, 112) },
			pattern = { { kind = "checker", band = "top", color = C(36, 72, 140) } },
			dorsal = { from = 2, to = 3, height = 1.1, color = C(30, 62, 130), sail = true },
			tail = "lunate", tailSize = 1.35, pectoral = 0.5, anal = true, keel = true,
		},
	},
	Barracuda = {
		name = "Barracuda", rarity = "Legendary", weight = { min = 2, max = 50, avg = 10 }, value = 1100,
		look = {
			length = 3.8, height = 0.7, width = 0.55, profile = P.pike,
			colors = { back = C(70, 90, 110), side = C(190, 200, 210), belly = C(240, 244, 246), fin = C(120, 130, 140), tail = C(60, 70, 80) },
			pattern = { { kind = "vband", slices = { 3, 5, 7 }, color = C(110, 126, 140) }, { kind = "spots", band = "bot", color = C(40, 44, 50), every = 3 } },
			dorsal = { from = 4, to = 4, height = 0.5, color = C(110, 120, 130) },
			snout = 0.4, teeth = C(255, 255, 250), underbite = true, bigMouth = true,
			tail = "fork", tailSize = 1.1, pectoral = 0.3, pelvic = true, anal = true,
		},
	},
	Stingray = {
		name = "Stingray", rarity = "Legendary", weight = { min = 2, max = 120, avg = 15 }, value = 1300,
		look = {
			special = "ray", length = 3.2, height = 0.5, width = 3.2, tailLen = 3.4, barb = true,
			colors = { back = C(130, 110, 80), side = C(150, 130, 96), belly = C(240, 234, 220), fin = C(120, 100, 72), tail = C(90, 76, 56), spot = C(80, 150, 220) },
		},
	},
	Marlin = {
		name = "Marlin", rarity = "Legendary", weight = { min = 30, max = 800, avg = 120 }, value = 1500,
		look = {
			length = 4.0, height = 1.0, width = 0.7, bill = 0.5, profile = P.torpedo,
			colors = { back = C(20, 40, 110), side = C(60, 110, 200), belly = C(230, 236, 244), fin = C(40, 80, 200), tail = C(20, 40, 110), bill = C(30, 50, 110) },
			pattern = { { kind = "vband", slices = { 3, 4, 5, 6 }, color = C(110, 170, 250) } },
			dorsal = { from = 1, to = 6, height = 1.4, color = C(40, 90, 220), sail = true, edge = C(20, 40, 110) },
			finlets = C(40, 70, 160), keel = true, tail = "lunate", tailSize = 1.5, pectoral = 0.5, anal = true,
		},
	},
	Sunfish = {
		name = "Sunfish", rarity = "Legendary", weight = { min = 50, max = 2000, avg = 300 }, value = 1400,
		look = {
			length = 2.6, height = 2.4, width = 0.7, profile = P.mola,
			colors = { back = C(120, 130, 140), side = C(170, 178, 186), belly = C(220, 224, 228), fin = C(130, 140, 150), tail = C(150, 160, 170) },
			pattern = { { kind = "spots", band = "mid", color = C(200, 206, 212), every = 2 } },
			dorsal = { from = 5, to = 6, height = 1.0, color = C(130, 140, 150) },
			tallAnal = 4.5, tail = "stub", tailSize = 1.0, pectoral = 0.24, anal = true,
		},
	},
	---------------------------------------------------------------- Mythic
	Hammerhead = {
		name = "Hammerhead Shark", rarity = "Mythic", weight = { min = 80, max = 600, avg = 230 }, value = 5000,
		look = {
			length = 5.0, height = 1.2, width = 1.0, profile = P.shark,
			colors = { back = C(120, 130, 140), side = C(150, 160, 170), belly = C(236, 238, 240), fin = C(110, 120, 130), tail = C(110, 120, 130) },
			dorsal = { from = 4, to = 5, height = 1.0, color = C(110, 120, 130), sail = true },
			shark = true, hammer = true, tail = "shark", tailSize = 1.4, pectoral = 0.7, pelvic = true, anal = true,
		},
	},
	MantaRay = {
		name = "Manta Ray", rarity = "Mythic", weight = { min = 100, max = 2000, avg = 500 }, value = 5500,
		look = {
			special = "ray", manta = true, length = 3.4, height = 0.6, width = 5.2, tailLen = 1.6,
			colors = { back = C(30, 34, 44), side = C(44, 50, 62), belly = C(240, 242, 246), fin = C(30, 34, 44), tail = C(30, 34, 44), spot = C(70, 76, 90) },
		},
	},
	Anglerfish = {
		name = "Anglerfish", rarity = "Mythic", weight = { min = 0.5, max = 50, avg = 6 }, value = 5200,
		look = {
			length = 2.3, height = 1.5, width = 1.3, profile = P.angler,
			colors = { back = C(60, 50, 50), side = C(84, 70, 66), belly = C(110, 94, 86), fin = C(70, 58, 54), tail = C(70, 58, 54) },
			pattern = { { kind = "spots", band = "top", color = C(40, 32, 32), every = 1 } },
			dorsal = { from = 4, to = 5, height = 0.3, color = C(70, 58, 54) },
			lure = C(140, 255, 220), teeth = C(240, 240, 230), underbite = true, bigMouth = true, bigEyes = 0.7,
			tail = "round", tailSize = 0.7, pectoral = 0.4, anal = true,
		},
	},
	---------------------------------------------------------------- Secret
	GreatWhite = {
		name = "Great White Shark", rarity = "Secret", weight = { min = 300, max = 2200, avg = 900 }, value = 26000,
		look = {
			length = 5.6, height = 1.5, width = 1.2, profile = P.shark,
			colors = { back = C(100, 110, 120), side = C(130, 140, 150), belly = C(245, 246, 248), fin = C(96, 106, 116), tail = C(96, 106, 116) },
			pattern = { { kind = "stripe", band = "mid", from = 1, to = 10, color = C(200, 206, 212) } },
			dorsal = { from = 4, to = 5, height = 1.2, color = C(96, 106, 116), sail = true },
			shark = true, teeth = C(255, 255, 255), tail = "shark", tailSize = 1.6, pectoral = 0.9, pelvic = true, anal = true, keel = true,
		},
	},
	Oarfish = {
		name = "Oarfish", rarity = "Secret", weight = { min = 30, max = 270, avg = 100 }, value = 24000,
		look = {
			length = 6.4, height = 0.8, width = 0.4, profile = P.oar,
			colors = { back = C(200, 210, 226), side = C(220, 228, 240), belly = C(240, 244, 250), fin = C(230, 40, 60), tail = C(230, 40, 60) },
			pattern = { { kind = "spots", band = "mid", color = C(120, 130, 160), every = 2 } },
			dorsal = { from = 1, to = 14, height = 0.4, color = C(235, 40, 60) },
			crest = C(240, 40, 70), tail = "point", tailSize = 0.7, pectoral = 0.24, pectoralColor = C(230, 40, 60),
		},
	},
	---------------------------------------------------------------- Ultra Secret
	GoldenArowana = {
		name = "Golden Arowana", rarity = "UltraSecret", weight = { min = 1, max = 8, avg = 3 }, value = 150000,
		look = {
			length = 3.6, height = 0.9, width = 0.6, profile = P.pike,
			colors = { back = C(220, 170, 40), side = C(255, 210, 70), belly = C(255, 236, 150), fin = C(240, 180, 50), tail = C(240, 170, 40) },
			pattern = { { kind = "checker", band = "mid", color = C(255, 230, 120) }, { kind = "checker", band = "top", color = C(240, 190, 60) } },
			dorsal = { from = 8, to = 10, height = 0.5, color = C(240, 180, 50) },
			barbels = { count = 1, length = 0.4, color = C(255, 220, 120), chin = true }, underbite = true, bigMouth = true,
			tallAnal = 1.6, tail = "round", tailSize = 1.0, pectoral = 0.4, pelvic = true, anal = true, shine = true,
		},
	},
	Seahorse = {
		name = "Seahorse", rarity = "UltraSecret", weight = { min = 0.005, max = 0.05, avg = 0.015 }, value = 160000,
		look = {
			special = "seahorse", length = 1.4, height = 2.6, width = 0.7,
			colors = { back = C(255, 150, 40), side = C(255, 180, 70), belly = C(255, 214, 130), fin = C(255, 230, 170), tail = C(240, 130, 30), spot = C(255, 240, 200) },
		},
	},
	---------------------------------------------------------------- Impossible
	CosmicKoi = {
		name = "Cosmic Koi", rarity = "Impossible", weight = { min = 2, max = 20, avg = 6 }, value = 500000,
		look = {
			length = 3.2, height = 1.05, width = 0.76, profile = P.std,
			colors = { back = C(30, 14, 70), side = C(60, 30, 130), belly = C(120, 80, 220), fin = C(150, 110, 255), tail = C(110, 70, 240), edge = C(120, 230, 255) },
			pattern = {
				{ kind = "patch", cells = { "1top", "3mid", "5top", "6mid" }, color = C(255, 120, 230) },
				{ kind = "patch", cells = { "2top", "4mid", "7top" }, color = C(110, 230, 255) },
				{ kind = "spots", band = "top", color = C(255, 250, 200), every = 2 },
			},
			dorsal = { from = 2, to = 6, height = 0.42, color = C(150, 110, 255), edge = C(120, 230, 255) },
			barbels = { count = 2, length = 0.45, color = C(255, 220, 255) },
			tail = "veil", tailSize = 1.5, tailEdge = C(120, 230, 255), pectoral = 0.5, pectoralEdge = C(120, 230, 255), pelvic = true, anal = true, shine = true,
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
