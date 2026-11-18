--[[ FisherBuilder: the hireable fisherman, an old sea dog made of studs.
     Rig (Motor6D, animated on the client by FisherController):
       Root (anchored, hip height) ── "Waist" -> Torso ── "Neck" -> Head
                                   │                 ├─ "ShoulderL" -> ArmL
                                   │                 └─ "ShoulderR" -> ArmR (+ the rod, welded)
                                   ├─ "HipL" -> LegL
                                   └─ "HipR" -> LegR
     The model is built around the origin, feet at y = 0, facing -Z.
     The OUTFIT improves with the tier (1..5, from the fisherman's level):
       1 Deckhand        : oilskin coat, beanie, short beard, wooden rod
       2 Fisherman       : + fishing vest with pockets, rubber boots, bamboo rod + reel
       3 Old Salt        : open oilskin over a knit sweater, sou'wester hat, pipe, white beard, carbon rod
       4 Sea Captain     : navy coat, gold buttons + epaulettes, captain cap, golden rod
       5 Legend of the Sea: teal coat with gold trims, cape, tricorn, medallion, eyepatch, crystal rod
     Slot 2 wears an ORANGE oilskin and a bucket fishing hat (tiers 1-3).
     opts.ghost = true -> a see-through silhouette (the "hire me" spot). ]]
local Studs = require(script.Parent.Studs)

local FisherBuilder = {}
local V3, CF, ANG = Vector3.new, CFrame.new, CFrame.Angles
local RGB = Color3.fromRGB

local SKIN = RGB(244, 196, 160)
local NOSE = RGB(232, 140, 120)
local EYE = RGB(25, 25, 30)
local WHITE = RGB(245, 245, 245)
local GOLD = RGB(255, 200, 50)

local STYLE = {
	{ coat = RGB(250, 205, 35), pants = RGB(60, 92, 165), boots = RGB(44, 44, 50), hat = "beanie", hatCol = RGB(130, 130, 140), beard = RGB(120, 76, 42), beardLen = 0.55, rod = "wood" },
	{ coat = RGB(250, 205, 35), pants = RGB(60, 92, 165), boots = RGB(46, 140, 64), hat = "beanie", hatCol = RGB(210, 50, 50), beard = RGB(150, 128, 104), beardLen = 0.75, rod = "bamboo", vest = RGB(112, 124, 62) },
	{ coat = RGB(250, 205, 35), pants = RGB(54, 70, 120), boots = RGB(46, 140, 64), hat = "souwester", hatCol = RGB(250, 205, 35), beard = RGB(236, 236, 236), beardLen = 0.95, rod = "carbon", sweater = RGB(40, 52, 110), pipe = true },
	{ coat = RGB(30, 42, 96), pants = RGB(30, 34, 60), boots = RGB(30, 30, 34), hat = "captain", hatCol = WHITE, beard = RGB(240, 240, 240), beardLen = 1.0, rod = "gold", buttons = true, epaulettes = true, pipe = true },
	{ coat = RGB(18, 96, 104), pants = RGB(28, 36, 52), boots = RGB(60, 34, 24), hat = "tricorn", hatCol = RGB(28, 28, 34), beard = RGB(245, 245, 245), beardLen = 1.15, rod = "crystal", buttons = true, epaulettes = true, cape = RGB(160, 24, 36), trims = true, medallion = true, eyepatch = true, beardRings = true },
}

function FisherBuilder.style(tier: number)
	return STYLE[math.clamp(tier, 1, #STYLE)]
end

function FisherBuilder.build(slot: number, tier: number, opts: any?): Model
	opts = opts or {}
	local st = table.clone(STYLE[math.clamp(tier, 1, #STYLE)])
	if slot == 2 and tier <= 3 then
		st.coat = RGB(245, 126, 32)
		if tier <= 2 then
			st.hat = "bucket"
			st.hatCol = RGB(96, 120, 70)
		else
			st.hatCol = RGB(245, 126, 32)
		end
	end
	local model = Instance.new("Model")
	model.Name = "Fisher"
	pcall(function() model.ModelStreamingMode = Enum.ModelStreamingMode.Atomic end)

	local function piece(name, size, cf, color, role, o)
		return Studs.piece(model, name, size, cf, color, role or "outfit", o)
	end
	local function bone(name, pivot)
		return Studs.bone(model, name, pivot)
	end

	-- ROOT (hips) -----------------------------------------------------------------
	local root = bone("Root", CF(0, 2, 0))
	root.Anchored = true
	model.PrimaryPart = root

	-- LEGS: thigh -> (knee) -> shin + boot shaft -> (ankle) -> foot --------------------
	for _, side in { -1, 1 } do
		local x = side * 0.5
		local L = if side < 0 then "L" else "R"
		local upper = bone("UpperLeg" .. L, CF(x, 2, 0))
		Studs.weldAll(upper, {
			piece("Thigh", V3(0.9, 1.0, 0.9), CF(x, 1.5, 0), st.pants),
			piece("ThighSeam", V3(0.06, 0.9, 0.92), CF(x + side * 0.42, 1.5, 0), Studs.shade(st.pants, 0.85), "outfit", { smooth = true }),
		})
		Studs.motor("Hip" .. L, root, upper, CF(x, 2, 0))
		local lower = bone("LowerLeg" .. L, CF(x, 1.0, 0))
		Studs.weldAll(lower, {
			piece("Shin", V3(0.86, 0.45, 0.86), CF(x, 0.98, 0), st.pants),
			piece("Knee", V3(0.5, 0.36, 0.06), CF(x, 1.0, -0.45), Studs.shade(st.pants, 0.85), "outfit"),
			piece("Cuff", V3(0.96, 0.2, 0.96), CF(x, 0.8, 0), Studs.shade(st.pants, 1.2), "outfit"),
			piece("BootShaft", V3(0.98, 0.5, 1.0), CF(x, 0.5, 0), st.boots, "boots"),
			piece("BootTop", V3(1.04, 0.14, 1.06), CF(x, 0.72, 0), Studs.shade(st.boots, 1.25), "boots", { smooth = true }),
			piece("BootBuckle", V3(0.3, 0.22, 0.08), CF(x, 0.5, -0.52), GOLD, "metal", { smooth = true }),
		})
		Studs.motor("Knee" .. L, upper, lower, CF(x, 1.0, 0))
		local foot = bone("Foot" .. L, CF(x, 0.28, 0))
		Studs.weldAll(foot, {
			piece("Boot", V3(0.98, 0.3, 1.25), CF(x, 0.15, -0.12), st.boots, "boots"),
			piece("Toe", V3(0.98, 0.34, 0.4), CF(x, 0.2, -0.66), Studs.shade(st.boots, 1.05), "boots"),
			piece("Sole", V3(1.0, 0.08, 1.3), CF(x, 0.04, -0.12), RGB(30, 30, 32), "boots", { smooth = true }),
		})
		Studs.motor("Ankle" .. L, lower, foot, CF(x, 0.28, 0))
	end

	-- TORSO -------------------------------------------------------------------------
	local torso = bone("Torso", CF(0, 2, 0))
	local tparts = {}
	local function t(p) table.insert(tparts, p) return p end
	-- coat body + a skirt over the hips
	t(piece("Coat", V3(2.0, 1.9, 1.1), CF(0, 3.05, 0), st.coat))
	t(piece("CoatSkirt", V3(2.1, 0.75, 1.2), CF(0, 1.95, 0), Studs.shade(st.coat, 0.95)))
	t(piece("Belt", V3(2.06, 0.22, 1.16), CF(0, 2.38, 0), RGB(60, 40, 26), "belt", { smooth = true }))
	t(piece("Buckle", V3(0.4, 0.3, 0.08), CF(0, 2.38, -0.6), GOLD, "metal", { smooth = true }))
	if st.sweater then
		-- open oilskin over a knit sweater (ribbed)
		t(piece("Sweater", V3(1.0, 1.7, 0.08), CF(0, 3.05, -0.56), st.sweater, "sweater"))
		for i = 0, 3 do
			t(piece("Rib", V3(1.0, 0.08, 0.1), CF(0, 2.45 + i * 0.4, -0.6), Studs.shade(st.sweater, 0.8), "sweater", { smooth = true }))
		end
		t(piece("Lapel", V3(0.35, 1.6, 0.1), CF(-0.62, 3.1, -0.58), Studs.shade(st.coat, 0.9)))
		t(piece("Lapel", V3(0.35, 1.6, 0.1), CF(0.62, 3.1, -0.58), Studs.shade(st.coat, 0.9)))
	else
		-- closed coat with a zip / button strip
		t(piece("Placket", V3(0.18, 1.8, 0.06), CF(0, 3.05, -0.57), Studs.shade(st.coat, 0.82), "outfit", { smooth = true }))
	end
	if st.vest then
		-- fishing vest: two big pockets on each side
		t(piece("VestL", V3(0.7, 1.4, 0.12), CF(-0.6, 3.0, -0.6), st.vest, "vest"))
		t(piece("VestR", V3(0.7, 1.4, 0.12), CF(0.6, 3.0, -0.6), st.vest, "vest"))
		for _, sx in { -1, 1 } do
			t(piece("Pocket", V3(0.5, 0.42, 0.1), CF(sx * 0.6, 2.7, -0.68), Studs.shade(st.vest, 0.85), "vest"))
			t(piece("Pocket", V3(0.5, 0.36, 0.1), CF(sx * 0.6, 3.25, -0.68), Studs.shade(st.vest, 0.85), "vest"))
		end
	end
	if st.buttons then
		for i = 0, 3 do
			t(piece("Button", V3(0.16, 0.16, 0.08), CF(-0.3, 2.6 + i * 0.38, -0.6), GOLD, "metal", { smooth = true }))
			t(piece("Button", V3(0.16, 0.16, 0.08), CF(0.3, 2.6 + i * 0.38, -0.6), GOLD, "metal", { smooth = true }))
		end
	end
	if st.trims then
		t(piece("TrimL", V3(0.14, 1.9, 0.08), CF(-0.5, 3.05, -0.58), GOLD, "metal", { smooth = true }))
		t(piece("TrimR", V3(0.14, 1.9, 0.08), CF(0.5, 3.05, -0.58), GOLD, "metal", { smooth = true }))
		t(piece("TrimHem", V3(2.12, 0.12, 1.22), CF(0, 1.6, 0), GOLD, "metal", { smooth = true }))
	end
	if st.medallion then
		-- anchor medallion on a chain
		t(piece("Chain", V3(0.7, 0.08, 0.06), CF(0, 3.7, -0.6), GOLD, "metal", { smooth = true }))
		t(piece("Medal", V3(0.44, 0.44, 0.1), CF(0, 3.35, -0.64), GOLD, "metal", { smooth = true }))
		t(piece("Anchor", V3(0.08, 0.32, 0.06), CF(0, 3.35, -0.7), RGB(160, 110, 20), "metal", { smooth = true }))
		t(piece("Anchor", V3(0.28, 0.08, 0.06), CF(0, 3.24, -0.7), RGB(160, 110, 20), "metal", { smooth = true }))
	end
	if st.cape then
		t(piece("Cape", V3(2.1, 2.6, 0.14), CF(0, 2.75, 0.62) * ANG(-0.08, 0, 0), st.cape, "cape"))
		t(piece("CapeTrim", V3(2.12, 0.14, 0.16), CF(0, 1.5, 0.72), GOLD, "metal", { smooth = true }))
	end
	-- collar
	t(piece("Collar", V3(1.5, 0.3, 1.16), CF(0, 4.0, 0), Studs.shade(st.coat, 0.85)))
	-- DETAILS -------------------------------------------------------------------
	-- knife in its sheath on the belt + a little tackle pouch
	t(piece("Sheath", V3(0.22, 0.7, 0.3), CF(-0.85, 2.05, -0.45) * ANG(0, 0, 0.12), RGB(92, 58, 30), "belt"))
	t(piece("KnifeGrip", V3(0.16, 0.3, 0.2), CF(-0.8, 2.55, -0.45) * ANG(0, 0, 0.12), RGB(50, 34, 20), "belt", { smooth = true }))
	t(piece("Pouch", V3(0.5, 0.45, 0.3), CF(0.7, 2.1, -0.58), RGB(110, 74, 40), "belt"))
	t(piece("PouchFlap", V3(0.52, 0.16, 0.34), CF(0.7, 2.3, -0.6), RGB(90, 58, 30), "belt", { smooth = true }))
	if not st.vest and not st.trims then
		-- big coat pockets
		for _, sx in { -1, 1 } do
			t(piece("CoatPocket", V3(0.6, 0.45, 0.08), CF(sx * 0.55, 2.62, -0.58), Studs.shade(st.coat, 0.88)))
			t(piece("PocketFlap", V3(0.64, 0.14, 0.1), CF(sx * 0.55, 2.86, -0.6), Studs.shade(st.coat, 0.78), "outfit", { smooth = true }))
		end
	end
	if tier <= 3 then
		-- wicker CREEL on the back with a strap across the chest
		local wick = RGB(196, 152, 86)
		t(piece("Creel", V3(1.4, 1.1, 0.7), CF(0, 2.9, 0.92), wick, "creel"))
		for i = 0, 2 do
			t(piece("Weave", V3(1.44, 0.1, 0.74), CF(0, 2.5 + i * 0.36, 0.92), Studs.shade(wick, 0.8), "creel", { smooth = true }))
		end
		t(piece("CreelLid", V3(1.46, 0.16, 0.76), CF(0, 3.5, 0.92), Studs.shade(wick, 0.9), "creel"))
		t(piece("FishTail", V3(0.1, 0.36, 0.3), CF(0.4, 3.72, 0.9) * ANG(0, 0, 0.4), RGB(120, 160, 200), "creel", { smooth = true }))
		t(piece("Strap", V3(0.2, 2.4, 0.08), CF(0, 3.05, -0.6) * ANG(0, 0, 0.72), RGB(80, 52, 28), "belt", { smooth = true }))
	end
	if tier == 2 or tier == 3 then
		-- knitted scarf
		t(piece("Scarf", V3(1.56, 0.34, 1.22), CF(0, 3.9, 0), RGB(200, 48, 48), "scarf"))
		t(piece("ScarfEnd", V3(0.34, 0.9, 0.12), CF(0.4, 3.35, -0.66), RGB(200, 48, 48), "scarf"))
		t(piece("ScarfStripe", V3(0.36, 0.1, 0.14), CF(0.4, 3.1, -0.67), WHITE, "scarf", { smooth = true }))
	end
	if tier >= 4 then
		-- brass spyglass on the belt
		t(piece("Spyglass", V3(0.24, 0.24, 1.2), CF(0.95, 2.2, 0.1) * ANG(0, 0, 0) * ANG(math.rad(70), 0, 0), RGB(200, 150, 50), "metal", { smooth = true }))
		t(piece("SpyRing", V3(0.3, 0.3, 0.12), CF(0.95, 2.55, -0.05) * ANG(math.rad(70), 0, 0), RGB(120, 80, 30), "metal", { smooth = true }))
	end
	Studs.weldAll(torso, tparts)
	Studs.motor("Waist", root, torso, CF(0, 2, 0))

	-- HEAD ----------------------------------------------------------------------------
	local head = bone("Head", CF(0, 4.05, 0))
	local hparts = {}
	local function h(p) table.insert(hparts, p) return p end
	h(piece("Face", V3(1.4, 1.4, 1.3), CF(0, 4.8, 0), SKIN, "skin"))
	h(piece("Nose", V3(0.34, 0.3, 0.28), CF(0, 4.72, -0.76), NOSE, "skin", { smooth = true }))
	h(piece("CheekL", V3(0.26, 0.2, 0.06), CF(-0.45, 4.62, -0.67), Studs.mix(SKIN, NOSE, 0.6), "skin", { smooth = true }))
	h(piece("CheekR", V3(0.26, 0.2, 0.06), CF(0.45, 4.62, -0.67), Studs.mix(SKIN, NOSE, 0.6), "skin", { smooth = true }))
	-- eyes (squinting old sailor) + bushy brows
	for _, sx in { -1, 1 } do
		if st.eyepatch and sx > 0 then
			h(piece("Eyepatch", V3(0.36, 0.34, 0.08), CF(sx * 0.32, 4.98, -0.68), RGB(20, 20, 24), "patch", { smooth = true }))
			h(piece("Strap", V3(1.46, 0.08, 1.36), CF(0, 5.12, 0) * ANG(0, 0, -0.35), RGB(20, 20, 24), "patch", { smooth = true }))
		else
			h(piece("Eye", V3(0.2, 0.18, 0.06), CF(sx * 0.32, 4.98, -0.67), EYE, "eye", { smooth = true }))
			h(piece("EyeShine", V3(0.07, 0.07, 0.04), CF(sx * 0.32 - 0.04, 5.02, -0.7), WHITE, "eye", { smooth = true }))
		end
		h(piece("Brow", V3(0.42, 0.13, 0.12), CF(sx * 0.32, 5.17, -0.66) * ANG(0, 0, -sx * 0.12), st.beard, "beard"))
	end
	-- beard: a big block under the face + sideburns + moustache
	local bl = st.beardLen
	h(piece("Beard", V3(1.46, bl, 0.6), CF(0, 4.3 - bl * 0.35, -0.42), st.beard, "beard"))
	h(piece("BeardTip", V3(0.9, bl * 0.5, 0.5), CF(0, 4.3 - bl * 0.85, -0.45), st.beard, "beard"))
	h(piece("SideL", V3(0.2, 0.9, 1.0), CF(-0.72, 4.55, -0.05), st.beard, "beard"))
	h(piece("SideR", V3(0.2, 0.9, 1.0), CF(0.72, 4.55, -0.05), st.beard, "beard"))
	h(piece("Moustache", V3(1.0, 0.22, 0.22), CF(0, 4.48, -0.74), Studs.shade(st.beard, 0.92), "beard"))
	if st.beardRings then
		h(piece("BeardRing", V3(0.6, 0.1, 0.56), CF(0, 4.3 - bl * 0.75, -0.45), GOLD, "metal", { smooth = true }))
		h(piece("BeardRing", V3(0.5, 0.1, 0.5), CF(0, 4.3 - bl * 1.0, -0.45), GOLD, "metal", { smooth = true }))
	end
	if st.pipe then
		h(piece("Pipe", V3(0.12, 0.12, 0.55), CF(0.32, 4.4, -0.95), RGB(90, 56, 30), "pipe", { smooth = true }))
		h(piece("PipeBowl", V3(0.26, 0.3, 0.26), CF(0.32, 4.5, -1.25), RGB(110, 66, 34), "pipe", { smooth = true }))
		local smoke = Instance.new("Attachment")
		smoke.Name = "PipeSmoke"
		smoke.Parent = hparts[#hparts]
		smoke.Position = V3(0, 0.2, 0)
	end
	-- HATS
	local hc = st.hatCol
	if st.hat == "beanie" then
		h(piece("Beanie", V3(1.5, 0.7, 1.4), CF(0, 5.6, 0.02), hc, "hat"))
		h(piece("BeanieFold", V3(1.56, 0.3, 1.46), CF(0, 5.35, 0.02), Studs.shade(hc, 0.85), "hat"))
		h(piece("Pompom", V3(0.4, 0.4, 0.4), CF(0, 6.05, 0.02), Studs.shade(hc, 1.15), "hat", { shape = Enum.PartType.Ball, smooth = true }))
	elseif st.hat == "bucket" then
		h(piece("HatTop", V3(1.4, 0.6, 1.36), CF(0, 5.62, 0), hc, "hat"))
		h(piece("HatBrim", V3(2.1, 0.12, 2.0), CF(0, 5.32, 0) * ANG(-0.06, 0, 0), Studs.shade(hc, 0.9), "hat"))
		h(piece("Lure", V3(0.16, 0.3, 0.16), CF(0.6, 5.65, -0.66), RGB(230, 60, 60), "hat", { smooth = true }))
	elseif st.hat == "souwester" then
		h(piece("HatTop", V3(1.5, 0.6, 1.44), CF(0, 5.62, 0.04), hc, "hat"))
		h(piece("HatBrim", V3(2.0, 0.12, 2.3), CF(0, 5.32, 0.25) * ANG(0.16, 0, 0), Studs.shade(hc, 0.92), "hat"))
	elseif st.hat == "captain" then
		h(piece("CapTop", V3(1.62, 0.5, 1.6), CF(0, 5.72, 0.04), hc, "hat"))
		h(piece("CapBand", V3(1.5, 0.3, 1.44), CF(0, 5.4, 0.02), RGB(24, 24, 30), "hat"))
		h(piece("CapPeak", V3(1.3, 0.1, 0.6), CF(0, 5.3, -0.8) * ANG(0.25, 0, 0), RGB(20, 20, 24), "hat", { smooth = true }))
		h(piece("Badge", V3(0.42, 0.36, 0.08), CF(0, 5.46, -0.76), GOLD, "metal", { smooth = true }))
	elseif st.hat == "tricorn" then
		h(piece("HatTop", V3(1.5, 0.55, 1.44), CF(0, 5.62, 0.02), hc, "hat"))
		for i, a in { 0, 2.1, -2.1 } do
			local dir = CFrame.Angles(0, a, 0)
			h(piece("Corner" .. i, V3(1.4, 0.5, 0.18), CF(0, 5.45, 0) * dir * CF(0, 0, -0.8) * ANG(-0.35, 0, 0), hc, "hat"))
			h(piece("CornerTrim" .. i, V3(1.42, 0.08, 0.2), CF(0, 5.45, 0) * dir * CF(0, 0.24, -0.86) * ANG(-0.35, 0, 0), GOLD, "metal", { smooth = true }))
		end
		h(piece("Feather", V3(0.12, 0.9, 0.3), CF(0.55, 6.0, 0.3) * ANG(0, 0, -0.4), RGB(240, 240, 240), "hat", { smooth = true }))
	end
	Studs.weldAll(head, hparts)
	Studs.motor("Neck", torso, head, CF(0, 4.05, 0))

	-- ARMS: upper arm -> (elbow) -> forearm -> (wrist) -> hand --------------------------
	local gloveCol = if st.trims or st.buttons then RGB(240, 240, 240) else SKIN
	local handBones = {}
	for _, side in { -1, 1 } do
		local x = side * 1.36
		local L = if side < 0 then "L" else "R"
		local upper = bone("UpperArm" .. L, CF(x, 3.75, 0))
		local up = {
			piece("Sleeve", V3(0.74, 0.85, 0.78), CF(x, 3.35, 0), st.coat),
		}
		if st.epaulettes then
			table.insert(up, piece("Epaulette", V3(0.85, 0.16, 0.85), CF(x, 3.9, 0), GOLD, "metal", { smooth = true }))
			table.insert(up, piece("Fringe", V3(0.85, 0.2, 0.06), CF(x, 3.76, -0.42), GOLD, "metal", { smooth = true }))
		end
		Studs.weldAll(upper, up)
		Studs.motor("Shoulder" .. L, torso, upper, CF(x, 3.75, 0))
		local fore = bone("ForeArm" .. L, CF(x, 2.95, 0))
		Studs.weldAll(fore, {
			piece("ForeSleeve", V3(0.7, 0.62, 0.74), CF(x, 2.68, 0), Studs.shade(st.coat, 0.96)),
			piece("Cuff", V3(0.78, 0.2, 0.82), CF(x, 2.4, 0), Studs.shade(st.coat, 0.8)),
		})
		Studs.motor("Elbow" .. L, upper, fore, CF(x, 2.95, 0))
		local hand = bone("Hand" .. L, CF(x, 2.3, 0))
		local glove = piece("Glove", V3(0.6, 0.46, 0.64), CF(x, 2.08, 0), gloveCol, "hand")
		local thumb = piece("Thumb", V3(0.18, 0.28, 0.2), CF(x - side * 0.32, 2.16, -0.18), gloveCol, "hand", { smooth = true })
		Studs.weldAll(hand, { glove, thumb })
		Studs.motor("Wrist" .. L, fore, hand, CF(x, 2.3, 0))
		local att = Instance.new("Attachment")
		att.Name = "Grip" .. L -- (not "HandL": that's the bone's name)
		att.Position = V3(0, -0.15, -0.05)
		att.Parent = glove
		handBones[side] = hand
	end

	-- THE ROD (in the right hand): handle + reel on the hand, then 3 bending segments --------
	local handR = handBones[1]
	local grip = CF(1.36, 2.08, 0) * ANG(math.rad(35), 0, 0)
	local rodCol, blankCol, reelCol, rodMat = RGB(120, 76, 40), RGB(150, 100, 56), RGB(150, 150, 160), Enum.Material.Plastic
	if st.rod == "bamboo" then
		blankCol = RGB(206, 186, 110)
	elseif st.rod == "carbon" then
		rodCol, blankCol, reelCol = RGB(30, 30, 34), RGB(40, 40, 46), GOLD
	elseif st.rod == "gold" then
		rodCol, blankCol, reelCol = RGB(90, 50, 24), GOLD, RGB(250, 250, 250)
	elseif st.rod == "crystal" then
		rodCol, blankCol, reelCol, rodMat = RGB(40, 30, 60), RGB(140, 230, 255), GOLD, Enum.Material.Glass
	end
	Studs.weldAll(handR, {
		piece("RodHandle", V3(0.26, 0.26, 1.3), grip * CF(0, 0, -0.1), rodCol, "rod"),
		piece("RodButt", V3(0.32, 0.32, 0.2), grip * CF(0, 0, 0.6), Studs.shade(rodCol, 0.7), "rod", { smooth = true }),
		piece("RodReel", V3(0.42, 0.42, 0.32), grip * CF(0, -0.32, -0.55), reelCol, "rod", { smooth = true, shape = Enum.PartType.Cylinder }),
		piece("ReelFoot", V3(0.1, 0.22, 0.3), grip * CF(0, -0.16, -0.55), reelCol, "rod", { smooth = true }),
		piece("RodBlank0", V3(0.15, 0.15, 0.9), grip * CF(0, 0, -1.15), blankCol, "rod", { smooth = true, material = rodMat }),
	})
	-- reel crank (turns when he reels in)
	local crank = bone("Crank", grip * CF(0.26, -0.32, -0.55))
	Studs.weldAll(crank, {
		piece("CrankArm", V3(0.06, 0.34, 0.08), grip * CF(0.28, -0.46, -0.55), reelCol, "rod", { smooth = true }),
		piece("CrankKnob", V3(0.16, 0.12, 0.12), grip * CF(0.36, -0.6, -0.55), RGB(30, 30, 34), "rod", { smooth = true }),
	})
	Studs.motor("Crank", handR, crank, grip * CF(0.26, -0.32, -0.55))
	-- 3 bending segments
	local prev = handR
	local z0 = -1.6
	local lens = { 1.4, 1.3, 1.2 }
	local widths = { 0.13, 0.1, 0.075 }
	local tipPart
	for i = 1, 3 do
		local pivot = grip * CF(0, 0, z0)
		local seg = bone("RodSeg" .. i, pivot)
		local blank = piece("RodBlank" .. i, V3(widths[i], widths[i], lens[i] + 0.04), pivot * CF(0, 0, -lens[i] / 2), blankCol, "rod", { smooth = true, material = rodMat })
		local guide = piece("Guide", V3(0.18 - i * 0.03, 0.18 - i * 0.03, 0.05), pivot * CF(0, -0.1, -lens[i] * 0.7), WHITE, "rod", { smooth = true })
		local parts = { blank, guide }
		if st.rod == "bamboo" then
			table.insert(parts, piece("Node", V3(widths[i] + 0.05, widths[i] + 0.05, 0.08), pivot * CF(0, 0, -lens[i] * 0.4), RGB(150, 120, 60), "rod", { smooth = true }))
		end
		Studs.weldAll(seg, parts)
		Studs.motor("Rod" .. i, prev, seg, pivot)
		prev = seg
		z0 -= lens[i]
		tipPart = blank
	end
	local tip = Instance.new("Attachment")
	tip.Name = "RodTip"
	tip.Parent = tipPart
	tip.Position = V3(0, 0, -lens[3] / 2)

	-- PROPS in the left hand (shown by the client only when used) ------------------------
	local handL = handBones[-1]
	local hl = CF(-1.36, 2.0, -0.2)
	local thermos = {
		piece("Thermos", V3(0.36, 0.8, 0.36), hl * CF(0, 0.15, 0), RGB(40, 120, 70), "prop", { shape = Enum.PartType.Cylinder }),
		piece("ThermosCap", V3(0.4, 0.2, 0.4), hl * CF(0, 0.6, 0), RGB(200, 200, 205), "prop", { smooth = true }),
	}
	thermos[1].CFrame = hl * CF(0, 0.15, 0) * ANG(0, 0, math.pi / 2)
	for _, p in thermos do p:SetAttribute("Prop", "Thermos") end
	local worm = {}
	for i = 0, 3 do
		local w = piece("Worm", V3(0.12, 0.12, 0.14), hl * CF(0, -0.15 - i * 0.1, -0.1), RGB(220, 120, 130), "prop", { smooth = true })
		w:SetAttribute("Prop", "Worm")
		table.insert(worm, w)
	end
	Studs.weldAll(handL, thermos)
	Studs.weldAll(handL, worm)

	model:SetAttribute("Fisher", true)
	model:SetAttribute("Slot", slot)
	model:SetAttribute("Tier", tier)
	model.WorldPivot = CF(0, 0, 0)

	if opts.ghost then
		for _, d in model:GetDescendants() do
			if d:IsA("BasePart") and d.Transparency < 1 then
				d.Color = RGB(190, 214, 245)
				d.Material = Enum.Material.SmoothPlastic
				d.Transparency = 0.62
				d.CastShadow = false
			end
		end
		model:SetAttribute("Ghost", true)
	end
	return model
end

return FisherBuilder
