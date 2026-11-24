--[[ BearConfig: the full bear collection (75 species over the 10 zones).
     Each species = a body preset (proportions) + its own colours + traits
     (species geometry read by Models/BearBuilder: hump, shaggy, moss, crystals,
     scarf, spectacles ...), so no two bears share a silhouette AND a look.
     income   : base $/s before rarity / weight / variant multipliers
     spawn    : relative weight in the species roll (every species is always possible)
     zones    : home zones (spawn weight x ZoneAffinity there)
     speed    : walk speed when controlled (studs/s at scale 1)
     gait     : animation tempo (heavy bears < 1, light bears > 1) ]]
local BearConfig = {}

local C = Color3.fromRGB

local function shade(c: Color3, k: number): Color3
	return Color3.new(math.clamp(c.R * k, 0, 1), math.clamp(c.G * k, 0, 1), math.clamp(c.B * k, 0, 1))
end

-- body presets: proportions + weight range + movement
local PRESETS = {
	baby = { body = { w = 2.3, h = 2.1, l = 2.9 }, leg = { len = 1.05, t = 1.0 }, head = { s = 2.8, muzzle = 0.6, ear = 1.2 }, weight = { min = 8, max = 45, ref = 18 }, speed = 32, gait = 1.25 },
	small = { body = { w = 2.7, h = 2.4, l = 3.6 }, leg = { len = 1.3, t = 1.0 }, head = { s = 2.6, muzzle = 0.75, ear = 0.85 }, weight = { min = 25, max = 120, ref = 55 }, speed = 32, gait = 1.15 },
	medium = { body = { w = 3.3, h = 2.9, l = 4.5 }, leg = { len = 1.6, t = 1.2 }, head = { s = 2.9, muzzle = 0.95, ear = 1.0 }, weight = { min = 40, max = 300, ref = 120 }, speed = 30, gait = 1.0 },
	round = { body = { w = 3.6, h = 3.2, l = 4.4 }, leg = { len = 1.4, t = 1.38 }, head = { s = 3.3, muzzle = 0.8, ear = 1.1 }, weight = { min = 70, max = 160, ref = 110 }, speed = 28, gait = 0.95 },
	long = { body = { w = 3.4, h = 2.9, l = 5.3 }, leg = { len = 1.8, t = 1.3 }, head = { s = 2.8, muzzle = 1.3, ear = 0.8 }, weight = { min = 100, max = 650, ref = 360 }, speed = 29, gait = 0.93 },
	large = { body = { w = 3.9, h = 3.3, l = 5.0 }, leg = { len = 1.75, t = 1.45 }, head = { s = 3.1, muzzle = 1.0, ear = 0.9 }, weight = { min = 110, max = 480, ref = 260 }, speed = 28, gait = 0.88 },
	huge = { body = { w = 4.4, h = 3.7, l = 5.7 }, leg = { len = 1.95, t = 1.65 }, head = { s = 3.45, muzzle = 1.05, ear = 0.85 }, weight = { min = 250, max = 900, ref = 500 }, speed = 27, gait = 0.8 },
}

BearConfig.Order = {}
BearConfig.Species = {}

--[[ add one species
     cols: fur (required), fur2, belly, muzzle, paw, ear, nose, claw, mark, patch, extra, accent
     o   : preset, zones, income, spawn, traits, head = { s, muzzle, ear } overrides, body / leg scale ]]
local function bear(id: string, name: string, cols, o)
	local p = PRESETS[o.preset or "medium"]
	local fur = cols.fur
	local head = table.clone(p.head)
	for k, v in o.head or {} do head[k] = v end
	local body = table.clone(p.body)
	if o.bodyK then
		body.w *= o.bodyK.w or 1
		body.h *= o.bodyK.h or 1
		body.l *= o.bodyK.l or 1
	end
	local leg = table.clone(p.leg)
	if o.legK then leg.len *= o.legK end
	local traits = {}
	for _, t in o.traits or {} do traits[t] = true end
	BearConfig.Species[id] = {
		name = name,
		income = o.income, spawn = o.spawn or 6, zones = o.zones or {},
		weight = table.clone(o.weight or p.weight), speed = p.speed, gait = p.gait,
		body = body, leg = leg, head = head,
		colors = {
			fur = fur, fur2 = cols.fur2 or shade(fur, 0.84), belly = cols.belly or shade(fur, 1.18),
			muzzle = cols.muzzle or C(214, 170, 120), paw = cols.paw or shade(fur, 0.78), ear = cols.ear or cols.muzzle or C(214, 170, 120),
			nose = cols.nose or C(28, 22, 22), claw = cols.claw or C(238, 226, 200), mark = cols.mark, patch = cols.patch,
			extra = cols.extra or shade(fur, 1.3), accent = cols.accent or C(240, 80, 90),
		},
		traits = traits,
		fixedRarity = o.fixedRarity, -- set = this species only exists in that rarity
	}
	table.insert(BearConfig.Order, id)
end

-- Zone 1 · Green Forest ------------------------------------------------------
bear("BrownBear", "Brown Bear", { fur = C(122, 76, 44), fur2 = C(100, 61, 35), belly = C(148, 98, 60), muzzle = C(214, 168, 118), paw = C(204, 156, 106), ear = C(200, 146, 102) },
	{ income = 2, spawn = 12, zones = { 1, 3 }, traits = { "tongue" }, weight = { min = 40, max = 320, ref = 120 } })
bear("BlackBear", "Black Bear", { fur = C(34, 33, 36), fur2 = C(48, 47, 52), belly = C(42, 41, 45), muzzle = C(196, 152, 108), paw = C(44, 43, 47), nose = C(18, 16, 16), claw = C(210, 200, 180), mark = C(214, 170, 110) },
	{ income = 2.4, spawn = 11, zones = { 1, 2 }, traits = { "chestV" }, head = { muzzle = 1.1, ear = 1.05 } })
bear("BabyBear", "Baby Bear", { fur = C(150, 100, 60), muzzle = C(236, 200, 150) },
	{ preset = "baby", income = 1.6, spawn = 12, zones = { 1 }, traits = { "tuft", "tongue" } })
bear("HoneyBear", "Honey Bear", { fur = C(214, 150, 50), fur2 = C(190, 126, 36), belly = C(240, 196, 100), muzzle = C(250, 222, 160), accent = C(255, 180, 20) },
	{ preset = "small", income = 3, spawn = 9, zones = { 1, 7, 10 }, traits = { "honey" } })
bear("CinnamonBear", "Cinnamon Bear", { fur = C(170, 90, 46), fur2 = C(148, 74, 36), belly = C(196, 120, 70), muzzle = C(230, 180, 130) },
	{ income = 2.8, spawn = 10, zones = { 1, 2, 7 }, traits = { "tongue" } })
bear("TeddyBear", "Teddy Bear", { fur = C(200, 150, 96), belly = C(236, 206, 160), muzzle = C(244, 220, 180), accent = C(230, 50, 70) },
	{ preset = "small", income = 3.4, spawn = 7, zones = { 1 }, traits = { "bow", "patches" }, head = { s = 2.9, ear = 1.15 } })
bear("AcornBear", "Acorn Bear", { fur = C(140, 92, 50), muzzle = C(220, 180, 130), accent = C(110, 70, 36), extra = C(190, 140, 70) },
	{ preset = "small", income = 3.2, spawn = 8, zones = { 1, 2 }, traits = { "acorn" } })
bear("CloverBear", "Clover Bear", { fur = C(110, 120, 60), muzzle = C(220, 200, 140), accent = C(70, 190, 70), mark = C(80, 180, 70) },
	{ income = 3.6, spawn = 6, zones = { 1 }, traits = { "clover", "spots" } })

-- Zone 2 · Pine Forest -------------------------------------------------------
bear("GrizzlyBear", "Grizzly Bear", { fur = C(96, 62, 40), fur2 = C(80, 52, 34), belly = C(120, 82, 54), muzzle = C(186, 140, 96), paw = C(78, 50, 33), ear = C(150, 108, 74), nose = C(26, 20, 18), claw = C(240, 232, 214), extra = C(168, 124, 86) },
	{ preset = "large", income = 6, spawn = 8, zones = { 2, 3 }, traits = { "hump", "grizzled", "longClaws" } })
bear("PineBear", "Pine Bear", { fur = C(90, 70, 46), muzzle = C(200, 170, 120), accent = C(40, 110, 60) },
	{ income = 4.5, spawn = 8, zones = { 2 }, traits = { "pineCrown", "stripes" } })
bear("SpiritBear", "Spirit Bear", { fur = C(236, 226, 200), fur2 = C(220, 208, 180), belly = C(246, 240, 224), muzzle = C(250, 244, 230), nose = C(60, 50, 50), claw = C(120, 110, 100) },
	{ income = 6.5, spawn = 4, zones = { 2 }, traits = { "aura" } })
bear("BarkBear", "Bark Bear", { fur = C(110, 74, 46), fur2 = C(84, 56, 34), muzzle = C(190, 150, 100), extra = C(70, 46, 28) },
	{ preset = "large", income = 5, spawn = 7, zones = { 2 }, traits = { "bark", "brow" } })
bear("PineconeBear", "Pinecone Bear", { fur = C(130, 86, 50), muzzle = C(210, 170, 120), accent = C(150, 96, 50), extra = C(100, 64, 34) },
	{ preset = "small", income = 4.2, spawn = 8, zones = { 2 }, traits = { "pinecones" } })
bear("TimberBear", "Timber Bear", { fur = C(78, 56, 40), muzzle = C(180, 140, 100), mark = C(200, 160, 110) },
	{ preset = "huge", income = 7, spawn = 5, zones = { 2, 9 }, traits = { "thickNeck", "bigPaws", "chestV" } })
bear("RangerBear", "Ranger Bear", { fur = C(120, 84, 52), muzzle = C(220, 180, 130), accent = C(60, 100, 50), extra = C(150, 110, 60) },
	{ income = 5.5, spawn = 6, zones = { 2 }, traits = { "rangerHat", "scarf" } })

-- Zone 3 · Mountain Lake -----------------------------------------------------
bear("KodiakBear", "Kodiak Bear", { fur = C(104, 66, 38), fur2 = C(86, 54, 30), muzzle = C(190, 146, 100), extra = C(150, 108, 70) },
	{ preset = "huge", income = 9, spawn = 6, zones = { 3, 7 }, traits = { "thickNeck", "bigPaws", "hump" }, head = { s = 3.6 } })
bear("FisherBear", "Fisher Bear", { fur = C(116, 80, 50), muzzle = C(214, 176, 126), accent = C(250, 200, 40), extra = C(240, 120, 110) },
	{ income = 7, spawn = 6, zones = { 3 }, traits = { "bucketHat", "fishSnack" } })
bear("LakeBear", "Lake Bear", { fur = C(70, 96, 120), fur2 = C(56, 80, 102), belly = C(160, 190, 210), muzzle = C(200, 214, 224), extra = C(140, 200, 240) },
	{ income = 7.5, spawn = 5, zones = { 3 }, traits = { "ripples" } })
bear("ReedBear", "Reed Bear", { fur = C(120, 110, 70), muzzle = C(220, 210, 160), accent = C(90, 140, 60), extra = C(150, 100, 60) },
	{ preset = "long", income = 8, spawn = 5, zones = { 3 }, traits = { "reeds" } })
bear("PebbleBear", "Pebble Bear", { fur = C(130, 120, 110), muzzle = C(210, 200, 190), mark = C(170, 166, 160), extra = C(100, 96, 92) },
	{ preset = "small", income = 6, spawn = 7, zones = { 3, 8 }, traits = { "pebbles" } })
bear("GlacierBear", "Glacier Bear", { fur = C(110, 120, 136), fur2 = C(90, 100, 116), belly = C(170, 184, 200), muzzle = C(200, 210, 222), extra = C(200, 230, 250) },
	{ income = 9.5, spawn = 4, zones = { 3, 5 }, traits = { "frost" } })

-- Zone 4 · Snowy Forest ------------------------------------------------------
bear("SnowBear", "Snow Bear", { fur = C(232, 238, 246), fur2 = C(210, 220, 234), belly = C(246, 248, 252), muzzle = C(250, 252, 255), nose = C(40, 44, 60), claw = C(110, 120, 140), extra = C(180, 220, 250) },
	{ income = 10, spawn = 7, zones = { 4, 5 }, traits = { "frost" } })
bear("FrostBear", "Frost Bear", { fur = C(170, 200, 230), fur2 = C(140, 176, 214), belly = C(220, 236, 250), muzzle = C(236, 244, 252), extra = C(230, 246, 255) },
	{ income = 12, spawn = 5, zones = { 4 }, traits = { "frost", "crystals" } })
bear("SnowballBear", "Snowball Bear", { fur = C(244, 244, 248), muzzle = C(255, 255, 255), nose = C(30, 30, 40), accent = C(220, 60, 60) },
	{ preset = "round", income = 11, spawn = 6, zones = { 4 }, traits = { "scarf", "snowballs" } })
bear("SilvertipBear", "Silvertip Bear", { fur = C(90, 76, 66), fur2 = C(74, 62, 54), muzzle = C(190, 170, 150), extra = C(220, 220, 226) },
	{ preset = "large", income = 12.5, spawn = 5, zones = { 4 }, traits = { "hump", "grizzled", "longClaws" } })
bear("WinterBear", "Winter Bear", { fur = C(150, 110, 80), muzzle = C(230, 200, 160), accent = C(60, 120, 220), extra = C(250, 250, 255) },
	{ income = 11.5, spawn = 6, zones = { 4 }, traits = { "beanie", "scarf" } })
bear("IcicleBear", "Icicle Bear", { fur = C(200, 220, 236), muzzle = C(240, 248, 255), extra = C(170, 230, 255) },
	{ preset = "long", income = 13, spawn = 4, zones = { 4, 5 }, traits = { "icicles" } })
bear("AuroraBear", "Aurora Bear", { fur = C(40, 50, 90), fur2 = C(30, 40, 76), belly = C(70, 90, 140), muzzle = C(150, 170, 220), accent = C(110, 255, 190), extra = C(190, 120, 255) },
	{ income = 15, spawn = 3, zones = { 4 }, traits = { "aurora", "stars" } })

-- Zone 5 · Frozen Lake -------------------------------------------------------
bear("PolarBear", "Polar Bear", { fur = C(240, 240, 236), fur2 = C(222, 224, 222), belly = C(246, 246, 244), muzzle = C(252, 252, 250), paw = C(232, 232, 228), ear = C(214, 214, 212), nose = C(26, 26, 30), claw = C(70, 70, 76), mark = C(140, 196, 240) },
	{ preset = "long", income = 14, spawn = 6, zones = { 5 }, traits = { "snowflake" }, head = { muzzle = 1.35, ear = 0.72 } })
bear("IceBear", "Ice Bear", { fur = C(150, 210, 240), fur2 = C(120, 190, 230), belly = C(210, 240, 255), muzzle = C(230, 248, 255), extra = C(190, 240, 255) },
	{ income = 16, spawn = 5, zones = { 5 }, traits = { "crystals" } })
bear("IglooBear", "Igloo Bear", { fur = C(236, 236, 240), muzzle = C(250, 250, 252), accent = C(230, 120, 40), extra = C(200, 220, 240) },
	{ preset = "round", income = 15, spawn = 5, zones = { 5 }, traits = { "earmuffs", "scarf" } })
bear("BlizzardBear", "Blizzard Bear", { fur = C(214, 224, 236), fur2 = C(190, 204, 220), muzzle = C(240, 246, 250), extra = C(255, 255, 255) },
	{ preset = "huge", income = 18, spawn = 3, zones = { 5 }, traits = { "frost", "shaggy", "brow" } })
bear("CrystalBear", "Crystal Bear", { fur = C(170, 150, 230), fur2 = C(150, 130, 210), belly = C(220, 210, 250), muzzle = C(236, 230, 255), extra = C(210, 180, 255) },
	{ income = 20, spawn = 2, zones = { 5 }, traits = { "crystals", "aura" } })
bear("TundraBear", "Tundra Bear", { fur = C(170, 150, 120), muzzle = C(230, 220, 200), extra = C(240, 240, 240) },
	{ preset = "large", income = 16.5, spawn = 4, zones = { 5, 8 }, traits = { "shaggy", "frost" } })

-- Zone 6 · Bamboo Forest -----------------------------------------------------
bear("Panda", "Panda", { fur = C(242, 242, 240), fur2 = C(228, 228, 226), belly = C(246, 246, 244), muzzle = C(250, 250, 248), paw = C(34, 34, 38), ear = C(34, 34, 38), nose = C(24, 24, 28), claw = C(80, 80, 86), patch = C(34, 34, 38) },
	{ preset = "round", income = 18, spawn = 6, zones = { 6 }, traits = { "panda", "bambooSnack" } })
bear("RedPandaBear", "Red Panda Bear", { fur = C(200, 80, 40), fur2 = C(170, 64, 30), belly = C(50, 30, 26), muzzle = C(250, 246, 240), paw = C(40, 26, 22), ear = C(250, 246, 240), extra = C(240, 230, 220) },
	{ preset = "small", income = 19, spawn = 5, zones = { 6 }, traits = { "mask", "ringTail" } })
bear("BambooBear", "Bamboo Bear", { fur = C(150, 170, 90), muzzle = C(230, 230, 190), accent = C(100, 170, 60), extra = C(70, 130, 40) },
	{ income = 17, spawn = 6, zones = { 6 }, traits = { "bambooSnack", "stripes" } })
bear("LotusBear", "Lotus Bear", { fur = C(240, 220, 230), muzzle = C(255, 246, 250), accent = C(255, 140, 190), extra = C(250, 230, 120) },
	{ preset = "small", income = 20, spawn = 4, zones = { 6 }, traits = { "lotus" } })
bear("JadeBear", "Jade Bear", { fur = C(60, 140, 100), fur2 = C(46, 116, 82), belly = C(140, 210, 170), muzzle = C(200, 240, 214), extra = C(110, 230, 160) },
	{ income = 22, spawn = 3, zones = { 6 }, traits = { "crystals" } })
bear("MoonBear", "Moon Bear", { fur = C(30, 30, 34), muzzle = C(200, 170, 130), mark = C(250, 240, 210) },
	{ income = 18.5, spawn = 5, zones = { 6, 9 }, traits = { "crescent" }, head = { ear = 1.4 } })
bear("SakuraBear", "Sakura Bear", { fur = C(250, 200, 214), fur2 = C(236, 176, 196), muzzle = C(255, 236, 242), accent = C(255, 150, 190), extra = C(255, 255, 255) },
	{ preset = "small", income = 21, spawn = 4, zones = { 6 }, traits = { "flowerCrown", "petals" } })
bear("QinlingPanda", "Qinling Panda", { fur = C(236, 220, 200), fur2 = C(220, 204, 184), muzzle = C(246, 236, 222), paw = C(110, 76, 50), ear = C(110, 76, 50), patch = C(110, 76, 50), claw = C(80, 80, 86) },
	{ preset = "round", income = 24, spawn = 2, zones = { 6 }, traits = { "panda" } })

-- Zone 7 · River Valley ------------------------------------------------------
bear("RiverBear", "River Bear", { fur = C(90, 70, 56), muzzle = C(200, 170, 130), extra = C(110, 180, 230) },
	{ income = 20, spawn = 6, zones = { 7 }, traits = { "ripples", "fishSnack" } })
bear("SpectacledBear", "Spectacled Bear", { fur = C(40, 34, 30), muzzle = C(220, 190, 140), mark = C(240, 214, 160) },
	{ preset = "small", income = 22, spawn = 5, zones = { 7 }, traits = { "spectacles" } })
bear("MudBear", "Mud Bear", { fur = C(120, 90, 60), muzzle = C(200, 170, 130), mark = C(84, 60, 40) },
	{ income = 19, spawn = 6, zones = { 7 }, traits = { "mud" } })
bear("CanyonBear", "Canyon Bear", { fur = C(190, 110, 60), fur2 = C(160, 90, 46), muzzle = C(240, 200, 150), extra = C(140, 70, 36) },
	{ preset = "large", income = 24, spawn = 4, zones = { 7, 8 }, traits = { "stripes", "brow" } })
bear("WillowBear", "Willow Bear", { fur = C(130, 130, 90), muzzle = C(220, 220, 180), accent = C(140, 190, 80) },
	{ preset = "long", income = 23, spawn = 4, zones = { 7 }, traits = { "willow" } })
bear("ClayBear", "Clay Bear", { fur = C(176, 100, 70), muzzle = C(230, 180, 150), mark = C(140, 76, 50), extra = C(210, 130, 90) },
	{ income = 21, spawn = 5, zones = { 7 }, traits = { "patches", "brow" } })
bear("SalmonKingBear", "Salmon King Bear", { fur = C(110, 60, 40), muzzle = C(220, 170, 120), accent = C(255, 200, 40), extra = C(240, 120, 110) },
	{ preset = "huge", income = 28, spawn = 2, zones = { 7 }, traits = { "crown", "fishSnack", "hump" } })

-- Zone 8 · Rocky Mountains ---------------------------------------------------
bear("MountainBear", "Mountain Bear", { fur = C(110, 110, 120), fur2 = C(90, 90, 100), muzzle = C(200, 200, 206), extra = C(150, 150, 160) },
	{ preset = "large", income = 26, spawn = 6, zones = { 8 }, traits = { "rocky", "hump" } })
bear("CaveBear", "Cave Bear", { fur = C(100, 80, 64), fur2 = C(80, 64, 50), muzzle = C(170, 146, 120), extra = C(130, 120, 110) },
	{ preset = "huge", income = 30, spawn = 5, zones = { 8, 9 }, traits = { "brow", "longClaws", "hump", "rocky" } })
bear("StoneBear", "Stone Bear", { fur = C(140, 140, 146), muzzle = C(196, 196, 200), extra = C(110, 110, 116) },
	{ income = 25, spawn = 6, zones = { 8 }, traits = { "rocky" } })
bear("BoulderBear", "Boulder Bear", { fur = C(120, 116, 110), muzzle = C(180, 176, 170), extra = C(150, 146, 140) },
	{ preset = "round", income = 27, spawn = 5, zones = { 8 }, traits = { "rocky", "thickNeck" } })
bear("GraniteBear", "Granite Bear", { fur = C(170, 150, 150), muzzle = C(220, 210, 210), mark = C(90, 80, 80), extra = C(200, 186, 186) },
	{ preset = "large", income = 29, spawn = 4, zones = { 8 }, traits = { "spots", "rocky" } })
bear("GoldBear", "Gold Rush Bear", { fur = C(150, 110, 70), muzzle = C(230, 196, 150), accent = C(255, 200, 40), extra = C(255, 210, 60) },
	{ income = 34, spawn = 2, zones = { 8 }, traits = { "nuggets", "minerHat" } })
bear("CragBear", "Crag Bear", { fur = C(96, 90, 86), muzzle = C(170, 160, 150), extra = C(130, 124, 118) },
	{ preset = "long", income = 28, spawn = 4, zones = { 8 }, traits = { "brow", "rocky", "longClaws" } })
bear("IronBear", "Iron Bear", { fur = C(90, 96, 104), fur2 = C(70, 76, 84), muzzle = C(160, 166, 172), extra = C(180, 186, 196), accent = C(220, 120, 40) },
	{ preset = "huge", income = 36, spawn = 2, zones = { 8 }, traits = { "armor" } })

-- Zone 9 · Deep Forest -------------------------------------------------------
bear("ForestBear", "Forest Bear", { fur = C(80, 70, 40), muzzle = C(190, 170, 120), accent = C(60, 140, 50), extra = C(90, 150, 60) },
	{ income = 32, spawn = 6, zones = { 9 }, traits = { "moss", "leafCrown" } })
bear("MossBear", "Moss Bear", { fur = C(70, 100, 50), fur2 = C(56, 84, 40), muzzle = C(180, 190, 140), extra = C(110, 170, 70) },
	{ preset = "large", income = 34, spawn = 5, zones = { 9 }, traits = { "moss", "shaggy" } })
bear("SlothBear", "Sloth Bear", { fur = C(36, 34, 34), fur2 = C(54, 50, 48), muzzle = C(210, 196, 180), mark = C(240, 236, 226), extra = C(70, 66, 62) },
	{ preset = "long", income = 33, spawn = 6, zones = { 9, 10 }, traits = { "shaggy", "chestV", "longClaws" }, head = { muzzle = 1.5 } })
bear("MushroomBear", "Mushroom Bear", { fur = C(120, 90, 70), muzzle = C(220, 200, 170), accent = C(220, 50, 50), extra = C(250, 250, 240) },
	{ preset = "small", income = 35, spawn = 5, zones = { 9 }, traits = { "mushrooms" } })
bear("ShadowBear", "Shadow Bear", { fur = C(26, 22, 34), fur2 = C(20, 16, 28), belly = C(40, 34, 52), muzzle = C(60, 52, 76), nose = C(10, 8, 14), accent = C(170, 90, 255), extra = C(80, 50, 140) },
	{ preset = "large", income = 40, spawn = 2, zones = { 9 }, traits = { "glowEyes", "aura" } })
bear("FernBear", "Fern Bear", { fur = C(100, 90, 60), muzzle = C(200, 190, 150), accent = C(70, 160, 70) },
	{ income = 31, spawn = 6, zones = { 9 }, traits = { "ferns" } })
bear("NightBear", "Night Bear", { fur = C(30, 36, 70), fur2 = C(24, 30, 60), muzzle = C(110, 120, 170), accent = C(255, 236, 140), extra = C(255, 240, 160), mark = C(255, 236, 140) },
	{ income = 38, spawn = 3, zones = { 9 }, traits = { "stars", "crescent" } })
bear("AncientBear", "Ancient Bear", { fur = C(90, 80, 60), fur2 = C(70, 62, 46), muzzle = C(160, 150, 120), extra = C(100, 150, 70) },
	{ preset = "huge", income = 45, spawn = 2, zones = { 9 }, traits = { "moss", "brow", "longClaws", "rocky" }, head = { s = 3.7 } })

-- Zone 10 · Tropical Beach ---------------------------------------------------
bear("SunBear", "Sun Bear", { fur = C(36, 30, 28), muzzle = C(220, 170, 110), mark = C(255, 190, 70) },
	{ preset = "small", income = 36, spawn = 6, zones = { 10 }, traits = { "crescent", "tongue" }, head = { muzzle = 0.6, ear = 0.6 } })
bear("CoconutBear", "Coconut Bear", { fur = C(120, 80, 50), muzzle = C(240, 230, 210), accent = C(110, 70, 40), extra = C(250, 250, 240) },
	{ income = 38, spawn = 5, zones = { 10 }, traits = { "coconutHat" } })
bear("CoralBear", "Coral Bear", { fur = C(250, 130, 120), fur2 = C(230, 110, 100), muzzle = C(255, 210, 200), accent = C(255, 90, 140), extra = C(255, 170, 80) },
	{ income = 42, spawn = 4, zones = { 10 }, traits = { "coral" } })
bear("SurferBear", "Surfer Bear", { fur = C(200, 150, 90), muzzle = C(240, 210, 170), accent = C(40, 40, 50), extra = C(60, 180, 240) },
	{ income = 40, spawn = 4, zones = { 10 }, traits = { "sunglasses", "lei" } })
bear("MangoBear", "Mango Bear", { fur = C(250, 170, 40), fur2 = C(240, 130, 30), belly = C(255, 214, 90), muzzle = C(255, 236, 180), accent = C(80, 160, 50) },
	{ preset = "round", income = 41, spawn = 4, zones = { 10 }, traits = { "leafCrown" } })
bear("ShellBear", "Shell Bear", { fur = C(230, 210, 180), muzzle = C(250, 240, 226), accent = C(255, 160, 170), extra = C(250, 220, 200) },
	{ preset = "small", income = 39, spawn = 5, zones = { 10 }, traits = { "shells" } })
bear("HibiscusBear", "Hibiscus Bear", { fur = C(170, 120, 80), muzzle = C(240, 210, 170), accent = C(240, 40, 80), extra = C(255, 220, 60) },
	{ income = 44, spawn = 3, zones = { 10 }, traits = { "hibiscus", "lei" } })
bear("RainbowBear", "Rainbow Bear", { fur = C(250, 250, 250), muzzle = C(255, 255, 255), accent = C(255, 80, 120) },
	{ preset = "small", income = 60, spawn = 1, zones = { 10 }, traits = { "rainbowStripes", "aura" } })

-- Extra rarities spread over the corridor (any zone, rare spawn) ---------------
bear("KingGrizzly", "King Grizzly", { fur = C(110, 70, 40), fur2 = C(90, 56, 32), muzzle = C(196, 150, 104), accent = C(255, 200, 40), extra = C(180, 130, 90) },
	{ preset = "huge", income = 70, spawn = 1, zones = { 2, 3 }, traits = { "crown", "hump", "grizzled", "longClaws" } })
bear("TitanBear", "Titan Bear", { fur = C(70, 60, 56), fur2 = C(56, 48, 44), muzzle = C(150, 130, 120), accent = C(255, 200, 40), extra = C(160, 150, 140) },
	{ preset = "huge", income = 100, spawn = 1, zones = { 8, 9 }, traits = { "armor", "crown", "brow", "longClaws" }, head = { s = 3.8 }, bodyK = { w = 1.1, h = 1.08, l = 1.08 } })

-- Impossible (one of a kind): only rolled when the rarity roll lands on "Impossible"
bear("CosmicBear", "Cosmic Bear", { fur = C(78, 44, 168), fur2 = C(54, 30, 128), belly = C(140, 100, 235), muzzle = C(190, 165, 255), nose = C(14, 6, 30),
	accent = C(255, 220, 120), extra = C(140, 230, 255), mark = C(255, 160, 240) },
	{ preset = "large", income = 300, spawn = 0, traits = { "stars", "aurora", "crown", "glowEyes", "aura", "crescent" }, fixedRarity = "Impossible", head = { s = 3.4 } })

-- ANIMALS: the other fish eaters of the real world (they eat NOTHING in the game). Same
-- rarities, mutations, income and base life as the bears; built by Models/AnimalBuilder.
-- `animal` = the body plan + its proportions (see AnimalBuilder).
local function animal(id: string, name: string, cols, o)
	local fur = cols.fur
	local a = o.animal
	local bw = a.body.w
	local legLen = a.legLen or 0
	BearConfig.Species[id] = {
		name = name, isAnimal = true,
		income = o.income, spawn = o.spawn or 6, zones = o.zones or {},
		weight = table.clone(o.weight), speed = o.speed or 28, gait = o.gait or 1,
		-- bear-like dimensions (carrying, base spacing, personality)
		body = { w = bw, h = a.body.h, l = a.body.l }, leg = { len = legLen, t = a.legT or 0.4 },
		head = { s = if type(a.head) == "table" then a.head.s else (a.head or 1), muzzle = 0.5, ear = 0.5 },
		colors = {
			fur = fur, fur2 = cols.fur2 or shade(fur, 0.84), belly = cols.belly or shade(fur, 1.18),
			muzzle = cols.muzzle or shade(fur, 1.1), paw = cols.paw or shade(fur, 0.78), ear = cols.ear or fur,
			nose = cols.nose or C(28, 22, 22), claw = cols.claw or C(238, 226, 200), mark = cols.mark, patch = cols.patch,
			extra = cols.extra or shade(fur, 1.3), accent = cols.accent or C(240, 80, 90),
			beak = cols.beak, leg = cols.leg, wing = cols.wing, wingTip = cols.wingTip, tail = cols.tail, head = cols.head,
			neck = cols.neck, crown = cols.crown, face = cols.face, flipper = cols.flipper, cheek = cols.cheek, earIn = cols.earIn,
			paw2 = cols.paw2,
		},
		traits = {}, animal = a,
	}
	table.insert(BearConfig.Order, id)
end

-- wave 1 ----------------------------------------------------------------------------------
animal("Pelican", "Pelican", { fur = C(246, 244, 236), fur2 = C(226, 222, 212), belly = C(255, 252, 246), beak = C(250, 196, 60), leg = C(240, 150, 60),
	wing = C(236, 232, 222), wingTip = C(40, 40, 46), head = C(255, 252, 240), crown = C(255, 236, 170), neck = C(250, 248, 240) },
	{ income = 40, zones = { 10, 3 }, weight = { min = 4, max = 14, ref = 8 }, speed = 26, gait = 0.95,
		animal = { plan = "bird", body = { w = 2.2, h = 2.0, l = 3.0 }, legLen = 1.2, legT = 0.24, neck = { len = 1.3, lean = 0.25, w = 0.62 }, head = 1.05,
			beak = { l = 2.6, w = 0.5, h = 0.26, tip = C(230, 90, 60) }, pouch = C(252, 170, 70), tail = { l = 0.9, w = 0.6 }, iris = C(250, 220, 90) } })
animal("Otter", "River Otter", { fur = C(112, 74, 46), fur2 = C(92, 60, 36), belly = C(170, 130, 90), muzzle = C(196, 160, 120), paw = C(74, 50, 32), nose = C(30, 22, 20) },
	{ income = 22, zones = { 7, 3 }, weight = { min = 5, max = 35, ref = 12 }, speed = 30, gait = 1.2,
		animal = { plan = "quad", body = { w = 1.5, h = 1.3, l = 3.4 }, legLen = 0.55, legT = 0.42, head = { s = 1.35, l = 0.45, snoutW = 0.62, snoutH = 0.34, flat = 0.78 },
			ears = 0.32, whiskers = true, tail = { l = 2.6, w = 0.7, segs = 4, taper = 0.7, flat = 0.6, droop = -0.05 } } })
animal("Seal", "Harbor Seal", { fur = C(150, 156, 164), fur2 = C(120, 126, 136), belly = C(200, 204, 210), muzzle = C(176, 180, 186), flipper = C(104, 110, 120), nose = C(24, 22, 26) },
	{ income = 36, zones = { 10, 5 }, weight = { min = 50, max = 160, ref = 90 }, speed = 22, gait = 0.85,
		animal = { plan = "swim", body = { w = 2.1, h = 1.8, l = 4.4 }, head = 1.6, flipper = 0.9, tailL = 1.4, spots = C(84, 88, 98) } })
animal("Penguin", "Gentoo Penguin", { fur = C(34, 36, 44), belly = C(250, 250, 250), beak = C(250, 110, 40), leg = C(250, 140, 60), face = C(34, 36, 44), mark = C(250, 250, 250) },
	{ income = 16, zones = { 5, 4 }, weight = { min = 4, max = 9, ref = 6 }, speed = 22, gait = 1.25,
		animal = { plan = "penguin", body = { w = 1.8, h = 2.5, l = 1.6 }, head = 1.25 } })
animal("Osprey", "Osprey", { fur = C(250, 248, 242), fur2 = C(86, 60, 42), belly = C(252, 250, 244), beak = C(40, 38, 42), leg = C(220, 220, 200), mark = C(92, 64, 44),
	wing = C(96, 68, 46), wingTip = C(52, 38, 28), tail = C(110, 80, 56), head = C(252, 250, 246) },
	{ income = 30, zones = { 8, 2 }, weight = { min = 1.2, max = 2.2, ref = 1.6 }, speed = 30, gait = 1.1,
		animal = { plan = "bird", body = { w = 1.7, h = 1.9, l = 2.3 }, legLen = 0.9, legT = 0.26, upright = 0.3, neck = { len = 0.5, lean = 0.05, w = 0.8 }, head = 1.15,
			beak = { l = 0.6, w = 0.4, h = 0.42, hook = true }, stripe = C(60, 44, 32), talons = true, tail = { l = 1.2, w = 0.6 }, iris = C(250, 210, 40) } })
animal("Kingfisher", "Kingfisher", { fur = C(40, 150, 220), fur2 = C(20, 110, 190), belly = C(250, 140, 50), beak = C(30, 30, 34), leg = C(230, 70, 60), mark = C(80, 210, 240),
	wing = C(24, 120, 200), wingTip = C(16, 70, 130), tail = C(30, 100, 180), head = C(40, 150, 220), crown = C(60, 190, 240) },
	{ income = 18, zones = { 7, 1 }, weight = { min = 0.03, max = 0.06, ref = 0.045 }, speed = 30, gait = 1.35,
		animal = { plan = "bird", body = { w = 1.2, h = 1.2, l = 1.6 }, legLen = 0.35, legT = 0.18, upright = 0.2, neck = { len = 0.3, lean = 0, w = 0.8 }, head = 1.0,
			beak = { l = 1.05, w = 0.26, h = 0.22 }, tail = { l = 0.6, w = 0.6 }, toe = 0.3 } })
animal("Heron", "Grey Heron", { fur = C(176, 182, 192), fur2 = C(140, 146, 158), belly = C(236, 238, 242), beak = C(240, 196, 70), leg = C(196, 170, 110),
	wing = C(150, 156, 170), wingTip = C(50, 52, 60), head = C(246, 246, 248), neck = C(236, 238, 242) },
	{ income = 11, zones = { 3, 7 }, weight = { min = 1, max = 2.5, ref = 1.6 }, speed = 28, gait = 0.95,
		animal = { plan = "bird", body = { w = 1.3, h = 1.4, l = 2.2 }, legLen = 2.9, legT = 0.2, neck = { len = 2.2, lean = 0.32, w = 0.4, s = true }, head = 0.8,
			beak = { l = 1.6, w = 0.24, h = 0.24 }, crest = C(30, 30, 36), tail = { l = 0.6, w = 0.6 }, toe = 0.6, iris = C(250, 220, 60) } })
animal("Crocodile", "Crocodile", { fur = C(70, 110, 52), fur2 = C(56, 90, 42), belly = C(200, 196, 140), muzzle = C(78, 120, 58), paw = C(60, 96, 46), nose = C(30, 40, 26),
	claw = C(230, 224, 200) },
	{ income = 34, zones = { 9, 6 }, weight = { min = 100, max = 900, ref = 380 }, speed = 24, gait = 0.8,
		animal = { plan = "quad", body = { w = 2.4, h = 1.2, l = 5.0 }, legLen = 0.6, legT = 0.5, sprawl = 1, scutes = true, teeth = true, eyesTop = true,
			head = { s = 1.6, l = 2.6, snoutW = 0.7, snoutH = 0.3, flat = 0.6, up = 0 }, tail = { l = 5, w = 1.3, segs = 6, taper = 0.85, flat = 0.75, droop = 0.02, fall = 0.02 },
			iris = C(220, 200, 60) } })
animal("Orca", "Orca", { fur = C(24, 24, 30), fur2 = C(30, 30, 38), belly = C(250, 250, 252), muzzle = C(24, 24, 30), flipper = C(24, 24, 30) },
	{ income = 65, zones = { 5, 10 }, weight = { min = 2000, max = 7000, ref = 4000 }, speed = 22, gait = 0.7,
		animal = { plan = "swim", orca = true, body = { w = 3.2, h = 3.2, l = 10 }, head = 2.8, flipper = 2.2, tailL = 3.2, dorsal = 3.4, saddle = C(150, 154, 164) } })
animal("Raccoon", "Raccoon", { fur = C(130, 128, 130), fur2 = C(104, 102, 106), belly = C(176, 172, 170), muzzle = C(236, 234, 230), paw = C(40, 38, 42), nose = C(24, 22, 24),
	ear = C(110, 108, 112), earIn = C(236, 234, 230), cheek = C(220, 218, 214) },
	{ income = 3, zones = { 1, 2 }, weight = { min = 4, max = 14, ref = 8 }, speed = 30, gait = 1.2,
		animal = { plan = "quad", body = { w = 1.8, h = 1.6, l = 2.6 }, legLen = 0.85, legT = 0.42, head = { s = 1.5, l = 0.5, snoutW = 0.44, snoutH = 0.3 },
			ears = 0.45, mask = C(34, 32, 36), whiskers = true, tail = { l = 1.9, w = 0.75, segs = 6, taper = 0.25, rings = C(40, 38, 42), tip = C(40, 38, 42), droop = -0.25, fall = 0.1 } } })

BearConfig.ZoneAffinity = 24 -- a zone's own species are ~24x more likely there

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
