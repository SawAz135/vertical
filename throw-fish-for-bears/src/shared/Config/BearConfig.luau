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

-- wave 2 · more fish-eating birds ----------------------------------------------------------
local function bird(id, name, cols, inc, zones, w, a)
	a.plan = a.plan or "bird"
	animal(id, name, cols, { income = inc, zones = zones, weight = w, speed = a.speed or 28, gait = a.gait or 1.1, animal = a })
end
bird("Cormorant", "Cormorant", { fur = C(40, 44, 40), fur2 = C(28, 32, 30), belly = C(52, 56, 50), beak = C(70, 64, 56), leg = C(30, 30, 32), wing = C(46, 52, 44),
	wingTip = C(20, 22, 22), head = C(36, 40, 38), neck = C(40, 44, 40), crown = C(30, 34, 32) }, 9, { 3, 7 }, { min = 1.5, max = 3.5, ref = 2.4 },
	{ body = { w = 1.5, h = 1.6, l = 2.6 }, legLen = 0.7, legT = 0.24, upright = 0.35, neck = { len = 1.1, lean = 0.12, w = 0.5 }, head = 0.85,
		beak = { l = 1.0, w = 0.24, h = 0.22, hook = true }, tail = { l = 1.0, w = 0.5 }, iris = C(60, 200, 120) })
bird("Seagull", "Seagull", { fur = C(250, 250, 250), fur2 = C(186, 194, 204), belly = C(255, 255, 255), beak = C(250, 214, 60), leg = C(240, 170, 90),
	wing = C(180, 188, 200), wingTip = C(30, 30, 34), head = C(255, 255, 255), tail = C(250, 250, 250) }, 38, { 10, 1 }, { min = 0.4, max = 1.2, ref = 0.8 },
	{ body = { w = 1.4, h = 1.4, l = 2.2 }, legLen = 0.75, neck = { len = 0.4, lean = 0.1, w = 0.75 }, head = 1.0,
		beak = { l = 0.9, w = 0.26, h = 0.26, tip = C(220, 40, 40) }, tail = { l = 0.8, w = 0.6 }, wingK = 1.1, iris = C(250, 230, 120) })
bird("HerringGull", "Herring Gull", { fur = C(246, 246, 246), fur2 = C(150, 160, 172), belly = C(255, 255, 255), beak = C(250, 200, 40), leg = C(236, 160, 160),
	wing = C(150, 160, 172), wingTip = C(24, 24, 28), head = C(250, 250, 250), tail = C(246, 246, 246) }, 40, { 10, 8 }, { min = 0.7, max = 1.6, ref = 1.1 },
	{ body = { w = 1.6, h = 1.6, l = 2.6 }, legLen = 0.85, neck = { len = 0.5, lean = 0.1, w = 0.85 }, head = 1.1,
		beak = { l = 1.05, w = 0.3, h = 0.32, hook = true, tip = C(230, 40, 40) }, tail = { l = 0.9, w = 0.6 }, wingK = 1.15, iris = C(250, 230, 120) })
bird("Albatross", "Albatross", { fur = C(250, 250, 248), fur2 = C(70, 70, 76), belly = C(255, 255, 255), beak = C(250, 220, 170), leg = C(230, 200, 200),
	wing = C(60, 60, 66), wingTip = C(30, 30, 34), head = C(255, 255, 255), tail = C(60, 60, 66) }, 44, { 10, 5 }, { min = 6, max = 11, ref = 8.5 },
	{ body = { w = 1.9, h = 1.8, l = 3.0 }, legLen = 0.9, legT = 0.26, neck = { len = 0.6, lean = 0.12, w = 0.95 }, head = 1.2,
		beak = { l = 1.4, w = 0.34, h = 0.36, hook = true }, tail = { l = 0.8, w = 0.6 }, wingK = 1.55, iris = C(40, 30, 30) })
bird("Gannet", "Northern Gannet", { fur = C(252, 252, 250), fur2 = C(240, 240, 236), belly = C(255, 255, 255), beak = C(176, 190, 206), leg = C(60, 64, 70),
	wing = C(246, 246, 242), wingTip = C(26, 26, 30), head = C(250, 220, 130), neck = C(252, 240, 210), tail = C(250, 250, 248) }, 31, { 8, 10 }, { min = 2.3, max = 3.6, ref = 3 },
	{ body = { w = 1.7, h = 1.7, l = 2.8 }, legLen = 0.7, neck = { len = 0.7, lean = 0.15, w = 0.8 }, head = 1.05,
		beak = { l = 1.3, w = 0.3, h = 0.32 }, tail = { l = 1.1, w = 0.5 }, wingK = 1.2, iris = C(170, 200, 255) })
bird("Puffin", "Atlantic Puffin", { fur = C(28, 28, 32), fur2 = C(20, 20, 24), belly = C(255, 255, 255), beak = C(250, 110, 40), leg = C(250, 120, 50),
	wing = C(26, 26, 30), wingTip = C(16, 16, 20), head = C(30, 30, 34), tail = C(24, 24, 28) }, 30, { 8, 4 }, { min = 0.4, max = 0.6, ref = 0.5 },
	{ body = { w = 1.4, h = 1.6, l = 1.7 }, legLen = 0.45, legT = 0.24, upright = 0.4, neck = { len = 0.3, lean = 0, w = 0.9 }, head = 1.15,
		beak = { l = 0.58, w = 0.3, h = 0.52, bands = { C(70, 90, 120), C(250, 220, 80) } }, tail = { l = 0.4, w = 0.5 }, toe = 0.4, faceWhite = true, iris = C(30, 30, 30) })
bird("Stork", "White Stork", { fur = C(252, 252, 250), fur2 = C(240, 240, 236), belly = C(255, 255, 255), beak = C(236, 50, 40), leg = C(236, 80, 60),
	wing = C(244, 244, 240), wingTip = C(24, 24, 28), head = C(255, 255, 255), neck = C(252, 252, 250), tail = C(250, 250, 248) }, 3.4, { 1, 6 }, { min = 2.3, max = 4.5, ref = 3.4 },
	{ body = { w = 1.6, h = 1.6, l = 2.6 }, legLen = 2.8, legT = 0.22, neck = { len = 1.5, lean = 0.2, w = 0.5 }, head = 0.85,
		beak = { l = 1.7, w = 0.26, h = 0.26 }, tail = { l = 0.7, w = 0.6 }, toe = 0.6, iris = C(40, 30, 30) })
bird("Egret", "Great Egret", { fur = C(255, 255, 255), fur2 = C(244, 244, 244), belly = C(255, 255, 255), beak = C(250, 200, 40), leg = C(26, 26, 30),
	wing = C(250, 250, 250), wingTip = C(240, 240, 240), head = C(255, 255, 255), neck = C(255, 255, 255), tail = C(250, 250, 250) }, 20, { 6, 3 }, { min = 0.7, max = 1.5, ref = 1 },
	{ body = { w = 1.2, h = 1.3, l = 2.1 }, legLen = 2.8, legT = 0.18, neck = { len = 2.3, lean = 0.32, w = 0.36, s = true }, head = 0.72,
		beak = { l = 1.5, w = 0.22, h = 0.22 }, tail = { l = 0.6, w = 0.6 }, toe = 0.6, iris = C(250, 220, 60) })
bird("Ibis", "Scarlet Ibis", { fur = C(236, 40, 40), fur2 = C(210, 30, 34), belly = C(246, 70, 60), beak = C(120, 40, 36), leg = C(230, 60, 60),
	wing = C(230, 36, 40), wingTip = C(30, 20, 24), head = C(240, 50, 48), neck = C(236, 44, 44), tail = C(220, 34, 38) }, 22, { 6, 9 }, { min = 0.6, max = 1.4, ref = 0.9 },
	{ body = { w = 1.3, h = 1.3, l = 2.1 }, legLen = 1.8, legT = 0.18, neck = { len = 1.2, lean = 0.22, w = 0.42 }, head = 0.78,
		beak = { l = 1.7, w = 0.2, h = 0.2, curve = 0.9 }, tail = { l = 0.6, w = 0.6 }, toe = 0.55, iris = C(250, 220, 60) })
bird("BlackSwan", "Black Swan", { fur = C(30, 28, 34), fur2 = C(22, 20, 26), belly = C(40, 38, 44), beak = C(220, 30, 40), leg = C(30, 30, 34),
	wing = C(26, 24, 30), wingTip = C(240, 240, 240), head = C(30, 28, 34), neck = C(32, 30, 36), tail = C(26, 24, 30) }, 8.5, { 3, 1 }, { min = 4, max = 9, ref = 6 },
	{ body = { w = 2.0, h = 1.6, l = 3.2 }, legLen = 0.5, legT = 0.3, neck = { len = 2.4, lean = 0.3, w = 0.5, s = true }, head = 0.9,
		beak = { l = 0.9, w = 0.36, h = 0.26, tip = C(250, 250, 250) }, tail = { l = 0.7, w = 0.6 }, toe = 0.7, iris = C(220, 40, 40) })
bird("Merganser", "Merganser", { fur = C(250, 250, 248), fur2 = C(36, 40, 44), belly = C(255, 255, 250), beak = C(220, 40, 30), leg = C(240, 110, 50),
	wing = C(50, 54, 60), wingTip = C(20, 22, 26), head = C(20, 80, 60), crown = C(16, 60, 46), tail = C(90, 96, 104) }, 23, { 7, 3 }, { min = 1, max = 2, ref = 1.4 },
	{ body = { w = 1.5, h = 1.3, l = 2.5 }, legLen = 0.4, legT = 0.26, neck = { len = 0.5, lean = 0.15, w = 0.7 }, head = 0.95,
		beak = { l = 0.85, w = 0.2, h = 0.2, hook = true }, crest = C(16, 60, 46), tail = { l = 0.7, w = 0.6 }, toe = 0.55, iris = C(200, 30, 30) })
bird("Loon", "Common Loon", { fur = C(24, 26, 30), fur2 = C(16, 18, 22), belly = C(250, 250, 250), beak = C(26, 26, 30), leg = C(30, 32, 36), mark = C(240, 240, 240),
	wing = C(22, 24, 28), wingTip = C(240, 240, 240), head = C(20, 50, 40), tail = C(22, 24, 28) }, 10, { 3, 4 }, { min = 2.7, max = 6, ref = 4 },
	{ body = { w = 1.8, h = 1.3, l = 3.1 }, legLen = 0.35, legT = 0.28, neck = { len = 0.7, lean = 0.2, w = 0.7 }, head = 1.0,
		beak = { l = 1.1, w = 0.26, h = 0.26 }, ring = C(240, 240, 240), tail = { l = 0.4, w = 0.5 }, toe = 0.6, iris = C(220, 30, 30) })
bird("Frigatebird", "Frigatebird", { fur = C(24, 24, 30), fur2 = C(16, 16, 22), belly = C(30, 30, 36), beak = C(90, 90, 100), leg = C(40, 40, 46),
	wing = C(22, 22, 28), wingTip = C(14, 14, 18), head = C(26, 26, 32), tail = C(20, 20, 26) }, 46, { 10, 8 }, { min = 1, max = 1.7, ref = 1.3 },
	{ body = { w = 1.4, h = 1.5, l = 2.4 }, legLen = 0.5, legT = 0.2, neck = { len = 0.5, lean = 0.1, w = 0.7 }, head = 0.95,
		beak = { l = 1.2, w = 0.24, h = 0.24, hook = true }, pouch = C(236, 30, 40), tail = { l = 1.2, w = 0.4, fork = 1.6 }, wingK = 1.6, iris = C(30, 30, 30) })
bird("Tern", "Arctic Tern", { fur = C(250, 250, 250), fur2 = C(210, 216, 226), belly = C(255, 255, 255), beak = C(230, 40, 40), leg = C(230, 50, 50),
	wing = C(206, 212, 222), wingTip = C(120, 124, 134), head = C(255, 255, 255), crown = C(20, 20, 24), tail = C(250, 250, 250) }, 41, { 10, 4 }, { min = 0.08, max = 0.13, ref = 0.1 },
	{ body = { w = 1.1, h = 1.1, l = 1.8 }, legLen = 0.3, legT = 0.16, neck = { len = 0.3, lean = 0.05, w = 0.7 }, head = 0.85,
		beak = { l = 0.8, w = 0.18, h = 0.18 }, tail = { l = 0.8, w = 0.4, fork = 1.3 }, wingK = 1.35, toe = 0.35, iris = C(30, 30, 30) })
bird("Mallard", "Mallard Duck", { fur = C(200, 196, 190), fur2 = C(130, 110, 90), belly = C(230, 226, 220), beak = C(250, 210, 40), leg = C(250, 140, 40),
	wing = C(150, 130, 110), wingTip = C(60, 80, 200), head = C(20, 130, 70), neck = C(20, 120, 64), tail = C(40, 40, 44), mark = C(140, 90, 60) }, 2.8, { 1, 3 }, { min = 0.7, max = 1.6, ref = 1.1 },
	{ body = { w = 1.6, h = 1.3, l = 2.4 }, legLen = 0.45, legT = 0.24, neck = { len = 0.6, lean = 0.1, w = 0.7 }, head = 0.95,
		beak = { l = 0.7, w = 0.5, h = 0.16 }, ring = C(250, 250, 250), tail = { l = 0.5, w = 0.5 }, toe = 0.5, iris = C(30, 30, 30) })
-- penguins
local function penguin(id, name, cols, inc, zones, w, a)
	a.plan = "penguin"
	animal(id, name, cols, { income = inc, zones = zones, weight = w, speed = 20, gait = a.gait or 1.2, animal = a })
end
penguin("EmperorPenguin", "Emperor Penguin", { fur = C(26, 28, 36), belly = C(252, 250, 240), beak = C(30, 30, 36), leg = C(30, 30, 36), face = C(26, 28, 36),
	mark = C(250, 190, 60), accent = C(252, 220, 120) }, 20, { 5, 4 }, { min = 22, max = 45, ref = 32 },
	{ body = { w = 2.3, h = 3.4, l = 2.0 }, head = 1.4, chestBand = true, gait = 0.95 })
penguin("KingPenguin", "King Penguin", { fur = C(40, 44, 56), belly = C(252, 250, 244), beak = C(40, 40, 44), leg = C(40, 40, 44), face = C(30, 30, 36),
	mark = C(250, 140, 40), accent = C(250, 180, 70) }, 14, { 4, 5 }, { min = 9, max = 18, ref = 13 },
	{ body = { w = 2.0, h = 3.0, l = 1.8 }, head = 1.3, chestBand = true, gait = 1.05 })
penguin("AdeliePenguin", "Adelie Penguin", { fur = C(24, 26, 32), belly = C(252, 252, 252), beak = C(36, 30, 30), leg = C(236, 150, 160), face = C(24, 26, 32) },
	17, { 5, 4 }, { min = 3.5, max = 6, ref = 4.6 }, { body = { w = 1.7, h = 2.3, l = 1.5 }, head = 1.2, gait = 1.35 })

-- wave 3 · fish-eating mammals --------------------------------------------------------------
local function mammal(id, name, cols, inc, zones, w, a, o)
	o = o or {}
	animal(id, name, cols, { income = inc, zones = zones, weight = w, speed = o.speed or 30, gait = o.gait or 1.05, animal = a })
end
mammal("LeopardSeal", "Leopard Seal", { fur = C(110, 116, 128), fur2 = C(84, 90, 102), belly = C(206, 210, 218), muzzle = C(130, 136, 148), flipper = C(80, 86, 98), nose = C(24, 22, 26) },
	18, { 5, 4 }, { min = 200, max = 600, ref = 380 }, { plan = "swim", body = { w = 2.0, h = 1.7, l = 5.2 }, head = 1.8, flipper = 1.2, tailL = 1.6, spots = C(46, 50, 60) }, { gait = 0.8, speed = 22 })
mammal("ElephantSeal", "Elephant Seal", { fur = C(130, 110, 96), fur2 = C(110, 92, 80), belly = C(170, 150, 134), muzzle = C(150, 128, 112), flipper = C(100, 84, 72), nose = C(40, 30, 28) },
	16, { 4, 10 }, { min = 900, max = 3600, ref = 2000 }, { plan = "swim", body = { w = 3.0, h = 2.6, l = 6.2 }, head = 2.1, flipper = 1.2, tailL = 1.8, trunk = true }, { gait = 0.7, speed = 18 })
mammal("SeaLion", "Sea Lion", { fur = C(120, 82, 52), fur2 = C(98, 66, 42), belly = C(150, 108, 72), muzzle = C(140, 100, 66), flipper = C(70, 50, 34), nose = C(30, 22, 20) },
	39, { 10, 8 }, { min = 100, max = 350, ref = 200 }, { plan = "swim", body = { w = 2.0, h = 2.0, l = 4.4 }, head = 1.5, flipper = 1.5, tailL = 1.4, earFlaps = true, headUp = 0.9 }, { gait = 0.9, speed = 24 })
mammal("Walrus", "Walrus", { fur = C(170, 120, 96), fur2 = C(150, 104, 82), belly = C(196, 146, 120), muzzle = C(210, 170, 140), flipper = C(140, 96, 76), nose = C(60, 40, 34) },
	14, { 4, 5 }, { min = 800, max = 1700, ref = 1200 }, { plan = "swim", body = { w = 3.2, h = 2.6, l = 5.4 }, head = 2.1, flipper = 1.4, tailL = 1.6, tusks = 1.2 }, { gait = 0.7, speed = 18 })
mammal("Dolphin", "Bottlenose Dolphin", { fur = C(130, 144, 160), fur2 = C(110, 124, 140), belly = C(214, 220, 228), muzzle = C(130, 144, 160), flipper = C(110, 124, 140) },
	42, { 10, 7 }, { min = 150, max = 650, ref = 300 }, { plan = "swim", orca = true, body = { w = 2.0, h = 2.0, l = 6.4 }, head = 1.9, flipper = 1.3, tailL = 2.2, dorsal = 1.4, rostrum = 0.9, eyePatch = false }, { gait = 1.0, speed = 26 })
mammal("RedFox", "Red Fox", { fur = C(214, 100, 40), fur2 = C(190, 84, 32), belly = C(250, 246, 240), muzzle = C(250, 246, 240), paw = C(40, 30, 28), paw2 = C(60, 40, 32), nose = C(30, 24, 22),
	ear = C(200, 90, 36), earIn = C(250, 240, 230), earTip = C(40, 30, 28), cheek = C(250, 246, 240) },
	3.2, { 1, 2 }, { min = 3, max = 14, ref = 7 }, { plan = "quad", body = { w = 1.5, h = 1.4, l = 2.8 }, legLen = 1.1, legT = 0.36, head = { s = 1.4, l = 0.7, snoutW = 0.4, snoutH = 0.3 },
		ears = 0.55, pointy = true, whiskers = true, tail = { l = 2.2, w = 0.8, segs = 5, taper = 0.2, tip = C(250, 248, 244), droop = -0.35, fall = 0.12 } }, { gait = 1.2 })
mammal("ArcticFox", "Arctic Fox", { fur = C(248, 248, 250), fur2 = C(230, 232, 238), belly = C(255, 255, 255), muzzle = C(255, 255, 255), paw = C(236, 236, 240), nose = C(26, 24, 26),
	ear = C(244, 244, 248), earIn = C(230, 220, 220) },
	13, { 4, 5 }, { min = 2.5, max = 9, ref = 5 }, { plan = "quad", body = { w = 1.5, h = 1.4, l = 2.5 }, legLen = 0.85, legT = 0.38, head = { s = 1.4, l = 0.5, snoutW = 0.42, snoutH = 0.3 },
		ears = 0.4, whiskers = true, tail = { l = 2, w = 0.9, segs = 5, taper = 0.15, droop = -0.35, fall = 0.12 }, iris = C(60, 40, 20) }, { gait = 1.2 })
mammal("SeaWolf", "Coastal Wolf", { fur = C(150, 140, 130), fur2 = C(110, 104, 98), belly = C(220, 214, 206), muzzle = C(214, 208, 200), paw = C(120, 112, 104), nose = C(28, 24, 22),
	ear = C(120, 110, 100), earIn = C(200, 190, 180), cheek = C(220, 214, 206) },
	33, { 8, 2 }, { min = 25, max = 60, ref = 40 }, { plan = "quad", body = { w = 1.9, h = 1.8, l = 3.6 }, legLen = 1.5, legT = 0.45, head = { s = 1.7, l = 0.85, snoutW = 0.44, snoutH = 0.34 },
		ears = 0.55, pointy = true, whiskers = true, tail = { l = 2, w = 0.75, segs = 4, taper = 0.3, tip = C(50, 46, 44), droop = -0.45, fall = 0.15 }, iris = C(230, 190, 60) }, { gait = 1.0, speed = 32 })
mammal("Cat", "Tabby Cat", { fur = C(230, 150, 70), fur2 = C(210, 130, 56), belly = C(250, 236, 214), muzzle = C(250, 240, 224), paw = C(250, 240, 224), paw2 = C(230, 150, 70), nose = C(240, 140, 150),
	ear = C(230, 150, 70), earIn = C(250, 190, 190), cheek = C(244, 200, 150) },
	2.6, { 1, 3 }, { min = 3, max = 7, ref = 4.5 }, { plan = "quad", body = { w = 1.3, h = 1.2, l = 2.2 }, legLen = 0.9, legT = 0.3, head = { s = 1.35, l = 0.25, snoutW = 0.46, snoutH = 0.26 },
		ears = 0.45, pointy = true, whiskers = true, stripes = C(180, 96, 36), tail = { l = 2, w = 0.36, segs = 5, taper = 0.2, rings = C(190, 106, 40), droop = 0.35, fall = -0.1 }, iris = C(120, 200, 80) }, { gait = 1.3 })
mammal("FishingCat", "Fishing Cat", { fur = C(150, 140, 120), fur2 = C(126, 116, 98), belly = C(220, 212, 196), muzzle = C(230, 222, 206), paw = C(140, 130, 112), nose = C(160, 110, 110),
	ear = C(110, 100, 86), earIn = C(200, 180, 170), cheek = C(200, 190, 170) },
	21, { 6, 7 }, { min = 6, max = 16, ref = 10 }, { plan = "quad", body = { w = 1.6, h = 1.4, l = 2.7 }, legLen = 0.95, legT = 0.38, head = { s = 1.45, l = 0.32, snoutW = 0.48, snoutH = 0.28 },
		ears = 0.36, whiskers = true, spots = C(50, 44, 40), spotN = 26, tail = { l = 1.3, w = 0.42, segs = 4, taper = 0.2, rings = C(60, 52, 46), droop = 0.1 }, iris = C(200, 200, 80) }, { gait = 1.15 })
mammal("Jaguar", "Jaguar", { fur = C(236, 170, 60), fur2 = C(220, 150, 46), belly = C(252, 238, 210), muzzle = C(250, 236, 210), paw = C(236, 170, 60), nose = C(150, 90, 80),
	ear = C(220, 150, 50), earIn = C(250, 230, 200), cheek = C(250, 230, 200) },
	37, { 9, 6 }, { min = 56, max = 120, ref = 85 }, { plan = "quad", body = { w = 2.2, h = 1.9, l = 4.0 }, legLen = 1.3, legT = 0.6, head = { s = 1.9, l = 0.45, snoutW = 0.5, snoutH = 0.32 },
		ears = 0.42, whiskers = true, spots = C(40, 30, 26), spotN = 40, tail = { l = 2.6, w = 0.5, segs = 5, taper = 0.3, rings = C(50, 38, 30), droop = 0.15, fall = 0.05 }, iris = C(230, 200, 60) }, { gait = 0.95, speed = 33 })
mammal("Lynx", "Lynx", { fur = C(200, 170, 130), fur2 = C(176, 146, 108), belly = C(244, 236, 222), muzzle = C(244, 236, 222), paw = C(190, 160, 120), nose = C(150, 100, 90),
	ear = C(170, 140, 100), earIn = C(240, 230, 214) },
	12, { 4, 2 }, { min = 10, max = 30, ref = 18 }, { plan = "quad", body = { w = 1.8, h = 1.7, l = 2.9 }, legLen = 1.4, legT = 0.48, head = { s = 1.65, l = 0.3, snoutW = 0.5, snoutH = 0.3 },
		ears = 0.5, tufts = true, ruff = true, whiskers = true, spots = C(120, 90, 66), spotN = 14, tail = { l = 0.6, w = 0.5, segs = 2, taper = 0.2, tip = C(30, 26, 24), droop = 0.3 }, iris = C(230, 200, 80) }, { gait = 1.05 })
mammal("Mink", "Mink", { fur = C(70, 44, 30), fur2 = C(56, 34, 24), belly = C(84, 54, 38), muzzle = C(90, 60, 42), paw = C(50, 32, 22), nose = C(24, 18, 16), cheek = C(240, 236, 230) },
	8, { 3, 7 }, { min = 0.5, max = 1.6, ref = 1 }, { plan = "quad", body = { w = 1.1, h = 1.0, l = 3.0 }, legLen = 0.5, legT = 0.32, head = { s = 1.05, l = 0.35, snoutW = 0.5, snoutH = 0.3 },
		ears = 0.22, whiskers = true, tail = { l = 1.6, w = 0.5, segs = 4, taper = 0.35, droop = -0.1, fall = 0.05 } }, { gait = 1.35 })
mammal("Beaver", "Beaver", { fur = C(116, 76, 44), fur2 = C(96, 62, 36), belly = C(140, 98, 64), muzzle = C(130, 90, 58), paw = C(60, 44, 36), nose = C(26, 20, 18) },
	24, { 7, 3 }, { min = 11, max = 30, ref = 20 }, { plan = "quad", body = { w = 2.1, h = 1.8, l = 2.9 }, legLen = 0.55, legT = 0.48, head = { s = 1.55, l = 0.45, snoutW = 0.6, snoutH = 0.34 },
		ears = 0.24, buckTeeth = true, whiskers = true, tail = { l = 1.9, w = 1.4, segs = 2, taper = 0.05, flat = 0.18, droop = 0.05, fall = 0.0, tip = C(70, 60, 56) } }, { gait = 0.9, speed = 24 })

-- wave 4 · reptiles, sharks and other fish eaters --------------------------------------------
mammal("Alligator", "Alligator", { fur = C(50, 66, 48), fur2 = C(40, 54, 38), belly = C(214, 206, 170), muzzle = C(56, 72, 52), paw = C(44, 58, 40), nose = C(26, 30, 24), claw = C(230, 224, 200) },
	35, { 9, 6 }, { min = 200, max = 500, ref = 360 }, { plan = "quad", body = { w = 2.6, h = 1.3, l = 5.2 }, legLen = 0.6, legT = 0.52, sprawl = 1, scutes = true, teeth = true, eyesTop = true,
		head = { s = 1.7, l = 2.2, snoutW = 0.85, snoutH = 0.32, flat = 0.6, up = 0 }, tail = { l = 5, w = 1.4, segs = 6, taper = 0.85, flat = 0.75, droop = 0.02, fall = 0.02 }, iris = C(220, 200, 80) }, { gait = 0.75, speed = 22 })
mammal("Gavial", "Gharial", { fur = C(92, 110, 80), fur2 = C(76, 92, 66), belly = C(220, 214, 180), muzzle = C(100, 118, 88), paw = C(80, 96, 70), nose = C(60, 70, 54), claw = C(230, 224, 200) },
	36, { 9, 7 }, { min = 150, max = 700, ref = 400 }, { plan = "quad", body = { w = 2.2, h = 1.2, l = 5.2 }, legLen = 0.55, legT = 0.48, sprawl = 1, scutes = true, teeth = true, eyesTop = true,
		head = { s = 1.4, l = 3.4, snoutW = 0.32, snoutH = 0.24, flat = 0.6, up = 0 }, tail = { l = 5, w = 1.2, segs = 6, taper = 0.85, flat = 0.75, droop = 0.02, fall = 0.02 }, iris = C(220, 200, 80) }, { gait = 0.75, speed = 22 })
mammal("SeaTurtle", "Sea Turtle", { fur = C(130, 150, 90), fur2 = C(110, 128, 76), belly = C(236, 226, 170), muzzle = C(140, 160, 100), paw = C(120, 140, 84), nose = C(40, 40, 30) },
	40, { 10, 7 }, { min = 70, max = 200, ref = 130 }, { plan = "quad", body = { w = 2.6, h = 1.1, l = 3.0 }, legLen = 0.4, legT = 0.6, sprawl = 1, shell = C(120, 90, 50),
		head = { s = 1.1, l = 0.35, snoutW = 0.6, snoutH = 0.34, up = 0 }, tail = { l = 0.6, w = 0.4, segs = 1, taper = 0.4, droop = 0.1 }, iris = C(60, 40, 20) }, { gait = 0.6, speed = 16 })
mammal("WaterMonitor", "Water Monitor", { fur = C(60, 62, 50), fur2 = C(44, 46, 38), belly = C(210, 200, 140), muzzle = C(66, 68, 56), paw = C(54, 56, 46), nose = C(30, 30, 26), claw = C(40, 38, 34) },
	20, { 6, 9 }, { min = 10, max = 25, ref = 18 }, { plan = "quad", body = { w = 1.6, h = 1.0, l = 3.4 }, legLen = 0.7, legT = 0.38, sprawl = 0.8, tongue = true, spots = C(220, 210, 120), spotN = 22,
		head = { s = 1.1, l = 0.9, snoutW = 0.5, snoutH = 0.3, flat = 0.7, up = 0.1 }, tail = { l = 4.2, w = 0.8, segs = 6, taper = 0.85, flat = 0.8, droop = 0.02, fall = 0.02 }, iris = C(200, 150, 60) }, { gait = 1.0, speed = 26 })
mammal("GiantSalamander", "Giant Salamander", { fur = C(96, 80, 60), fur2 = C(80, 66, 48), belly = C(130, 112, 86), muzzle = C(104, 88, 66), paw = C(90, 74, 56), nose = C(40, 32, 26), claw = C(90, 74, 56) },
	7.5, { 3, 7 }, { min = 10, max = 50, ref = 25 }, { plan = "quad", body = { w = 2.0, h = 0.9, l = 3.2 }, legLen = 0.4, legT = 0.42, sprawl = 0.9, spots = C(50, 40, 30), spotN = 30,
		head = { s = 1.6, l = 0.3, snoutW = 0.9, snoutH = 0.3, flat = 0.5, up = 0 }, tail = { l = 2.4, w = 0.9, segs = 4, taper = 0.6, flat = 0.5, droop = 0.02, fall = 0.02 }, iris = C(40, 40, 40) }, { gait = 0.7, speed = 16 })
local function fishy(id, name, cols, inc, zones, w, a, o)
	a.plan = "swim"
	a.orca = true
	a.fishTail = true
	a.eyePatch = false
	animal(id, name, cols, { income = inc, zones = zones, weight = w, speed = (o and o.speed) or 26, gait = (o and o.gait) or 0.9, animal = a })
end
fishy("GreatWhite", "Great White Shark", { fur = C(110, 122, 136), fur2 = C(94, 106, 120), belly = C(240, 242, 244), muzzle = C(110, 122, 136), flipper = C(100, 112, 126) },
	62, { 10, 8 }, { min = 700, max = 2200, ref = 1200 }, { body = { w = 2.6, h = 2.8, l = 8.6 }, head = 2.4, flipper = 2.0, tailL = 2.8, dorsal = 2.4, gills = true, teeth = true }, { gait = 0.75 })
fishy("TigerShark", "Tiger Shark", { fur = C(126, 120, 100), fur2 = C(104, 98, 80), belly = C(238, 236, 226), muzzle = C(126, 120, 100), flipper = C(110, 104, 86) },
	45, { 10, 9 }, { min = 400, max = 900, ref = 600 }, { body = { w = 2.2, h = 2.4, l = 7.6 }, head = 2.0, flipper = 1.8, tailL = 2.6, dorsal = 2.0, gills = true, teeth = true, spots = C(70, 64, 50) }, { gait = 0.8 })
fishy("Hammerhead", "Hammerhead Shark", { fur = C(130, 140, 150), fur2 = C(110, 120, 130), belly = C(236, 238, 240), muzzle = C(130, 140, 150), flipper = C(116, 126, 136) },
	48, { 10, 8 }, { min = 200, max = 500, ref = 300 }, { body = { w = 2.0, h = 2.2, l = 7.2 }, head = 1.8, flipper = 1.6, tailL = 2.6, dorsal = 2.4, gills = true, hammer = true }, { gait = 0.85 })
fishy("Barracuda", "Barracuda", { fur = C(150, 166, 180), fur2 = C(110, 124, 140), belly = C(230, 236, 240), muzzle = C(150, 166, 180), flipper = C(120, 134, 150) },
	39, { 10, 8 }, { min = 5, max = 40, ref = 15 }, { body = { w = 1.1, h = 1.2, l = 5.2 }, head = 1.6, flipper = 0.7, tailL = 1.4, dorsal = 0.7, teeth = true, rostrum = 0.6, spots = C(40, 44, 52) }, { gait = 1.1 })
fishy("Pike", "Northern Pike", { fur = C(90, 120, 60), fur2 = C(70, 96, 46), belly = C(230, 226, 190), muzzle = C(90, 120, 60), flipper = C(170, 120, 60) },
	9, { 3, 7 }, { min = 2, max = 18, ref = 7 }, { body = { w = 1.1, h = 1.3, l = 4.6 }, head = 1.5, flipper = 0.7, tailL = 1.3, dorsal = 0.6, teeth = true, rostrum = 0.5, spots = C(220, 220, 150) }, { gait = 1.05 })
local function serpent(id, name, cols, inc, zones, w, a, o)
	a.plan = "serpent"
	animal(id, name, cols, { income = inc, zones = zones, weight = w, speed = (o and o.speed) or 24, gait = (o and o.gait) or 1, animal = a })
end
serpent("WaterSnake", "Water Snake", { fur = C(90, 80, 56), fur2 = C(70, 62, 44), belly = C(220, 200, 150), muzzle = C(96, 86, 60), nose = C(30, 26, 20) },
	21, { 7, 6 }, { min = 0.3, max = 2, ref = 0.8 }, { body = { w = 0.8, h = 0.7, l = 7 }, head = 1.0, bands = C(50, 44, 32), tongue = true, iris = C(220, 160, 40) })
serpent("MorayEel", "Moray Eel", { fur = C(90, 110, 50), fur2 = C(70, 90, 40), belly = C(150, 170, 90), muzzle = C(96, 116, 56), nose = C(30, 30, 20) },
	43, { 10, 8 }, { min = 5, max = 30, ref = 12 }, { body = { w = 1.1, h = 1.3, l = 7.5 }, head = 1.4, spots = C(240, 230, 120), ribbon = C(80, 100, 44), ribbonTop = true, teeth = true, iris = C(240, 220, 80) })
serpent("ElectricEel", "Electric Eel", { fur = C(60, 60, 64), fur2 = C(46, 46, 50), belly = C(230, 170, 60), muzzle = C(66, 66, 70), nose = C(24, 24, 26) },
	24, { 7, 9 }, { min = 5, max = 20, ref = 10 }, { body = { w = 1.0, h = 1.1, l = 8 }, head = 1.3, ribbon = C(240, 180, 60), iris = C(40, 40, 40) })
local function tentacle(id, name, cols, inc, zones, w, a, o)
	a.plan = "tentacle"
	animal(id, name, cols, { income = inc, zones = zones, weight = w, speed = (o and o.speed) or 18, gait = (o and o.gait) or 0.9, animal = a })
end
tentacle("Octopus", "Octopus", { fur = C(220, 90, 70), fur2 = C(190, 70, 56), belly = C(250, 200, 180), mark = C(240, 120, 100) },
	44, { 10, 8 }, { min = 3, max = 15, ref = 8 }, { kind = "octopus", body = { w = 2.0, h = 2.0, l = 2.0 }, armL = 2.6, head = 1, iris = C(240, 200, 60) })
tentacle("GiantSquid", "Giant Squid", { fur = C(200, 70, 80), fur2 = C(170, 54, 64), belly = C(250, 190, 190), mark = C(230, 110, 120) },
	58, { 10, 5 }, { min = 150, max = 400, ref = 250 }, { kind = "squid", body = { w = 2.0, h = 2.0, l = 2.0 }, armL = 3, head = 1, spots = C(150, 40, 50), iris = C(250, 240, 200) }, { gait = 0.7 })
tentacle("Jellyfish", "Moon Jellyfish", { fur = C(200, 210, 250), fur2 = C(170, 180, 240), belly = C(230, 230, 255), mark = C(250, 160, 220) },
	41, { 10, 3 }, { min = 0.5, max = 4, ref = 1.5 }, { kind = "jelly", body = { w = 2.4, h = 1.2, l = 2.4 }, armL = 2.6, armT = 0.4, head = 1 }, { gait = 0.6, speed = 12 })
bird("FishingBat", "Fishing Bat", { fur = C(130, 90, 60), fur2 = C(100, 68, 46), belly = C(180, 140, 100), beak = C(60, 40, 36), leg = C(70, 50, 40),
	wing = C(70, 48, 40), wingTip = C(50, 34, 28), head = C(130, 90, 60), tail = C(70, 48, 40) }, 25, { 9, 7 }, { min = 0.03, max = 0.07, ref = 0.05 },
	{ body = { w = 1.1, h = 1.2, l = 1.4 }, legLen = 0.3, legT = 0.16, upright = 0.5, neck = { len = 0.2, lean = 0, w = 0.8 }, head = 1.0,
		beak = { l = 0.3, w = 0.36, h = 0.24 }, batEars = true, tail = { l = 0.5, w = 0.6 }, wingK = 1.3, talons = true, toe = 0.35, iris = C(30, 30, 30) })

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
