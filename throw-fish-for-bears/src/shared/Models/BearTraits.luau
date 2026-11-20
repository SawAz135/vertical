--[[ BearTraits: species-specific stud geometry added on top of the shared bear rig.
     BearBuilder calls:
       BearTraits.head(ctx)  -> parts welded to the Head bone (hats, crowns, glasses ...)
       BearTraits.body(ctx)  -> parts welded to the Torso (moss, rocks, crystals, scarf ...)
       BearTraits.tail(ctx)  -> parts welded to the TailBone (ringed tail)
     Every trait is a few carefully placed Plastic blocks so the silhouette of each
     species stays readable from far away, and everything follows the rig while
     animating. ctx.add(part) registers a part for the right bone. ]]
local Studs = require(script.Parent.Studs)

local BearTraits = {}

local CF = CFrame.new
local V3 = Vector3.new
local ANG = CFrame.Angles
local C = Color3.fromRGB
local WHITE = C(255, 255, 255)

local function piece(ctx, name, size, cf, color, role, opts)
	return ctx.add(Studs.piece(ctx.model, name, size, cf, color, role or "detail", opts))
end

-- small 5-petal flower (top view) at cf
local function flower(ctx, cf, size, petal, centre)
	for k = 0, 4 do
		local a = k * math.pi * 2 / 5
		piece(ctx, "Petal", V3(size * 0.5, size * 0.18, size * 0.5), cf * CF(math.cos(a) * size * 0.36, 0, math.sin(a) * size * 0.36), petal, "accent")
	end
	piece(ctx, "FlowerCore", V3(size * 0.34, size * 0.26, size * 0.34), cf * CF(0, size * 0.04, 0), centre, "accent")
end

-- small leaf: two plates in a V
local function leaf(ctx, cf, size, color)
	piece(ctx, "Leaf", V3(size * 0.5, size * 0.1, size), cf * ANG(0, 0, 0.35), color, "accent")
	piece(ctx, "Leaf", V3(size * 0.5, size * 0.1, size), cf * CF(size * 0.42, 0, 0) * ANG(0, 0, -0.35), Studs.shade(color, 0.86), "accent")
	piece(ctx, "LeafVein", V3(size * 0.08, size * 0.12, size * 0.9), cf * CF(size * 0.21, size * 0.05, 0), Studs.shade(color, 0.7), "accent", { smooth = true })
end

local function crystal(ctx, cf, size, color)
	piece(ctx, "Crystal", V3(size * 0.5, size, size * 0.5), cf * CF(0, size / 2, 0) * ANG(0, math.pi / 4, 0), color, "accent", { material = Enum.Material.Glass, transparency = 0.15 })
	piece(ctx, "CrystalTip", V3(size * 0.3, size * 0.3, size * 0.3), cf * CF(0, size * 1.08, 0) * ANG(0, math.pi / 4, math.pi / 4), Studs.shade(color, 1.15), "accent", { material = Enum.Material.Glass, transparency = 0.1 })
end

local function sparkle(part: BasePart, color: Color3, rate: number)
	local p = Instance.new("ParticleEmitter")
	p.Name = "TraitSparkle"
	p.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	p.Color = ColorSequence.new(color)
	p.LightEmission = 0.8
	p.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(0.5, 0.35), NumberSequenceKeypoint.new(1, 0) })
	p.Lifetime = NumberRange.new(0.8, 1.4)
	p.Rate = rate
	p.Speed = NumberRange.new(0.4, 1.2)
	p.SpreadAngle = Vector2.new(180, 180)
	p.Parent = part
end

------------------------------------------------------------------------------------------
-- HEAD
------------------------------------------------------------------------------------------
function BearTraits.head(ctx)
	local t, c, s = ctx.traits, ctx.c, ctx.s
	local hc, hs, hw, hh, hd = ctx.hc, ctx.hs, ctx.hw, ctx.hh, ctx.hd
	local top = hc * CF(0, hh / 2, 0)
	local front = -hd / 2
	local eyeX, eyeY = ctx.eyeX, ctx.eyeY

	if t.tuft then -- baby curl
		piece(ctx, "Tuft", V3(hs * 0.16, hs * 0.16, hs * 0.16), top * CF(0, hs * 0.08, -hd * 0.1), c.fur2, "fur2")
		piece(ctx, "Tuft2", V3(hs * 0.12, hs * 0.12, hs * 0.12), top * CF(hs * 0.06, hs * 0.18, -hd * 0.14), c.fur2, "fur2")
	end
	if t.bow then
		local b = hc * CF(hw * 0.32, hh * 0.46, -hd * 0.05)
		piece(ctx, "BowL", V3(hs * 0.2, hs * 0.16, hs * 0.1), b * CF(-hs * 0.12, 0, 0) * ANG(0, 0, 0.3), c.accent, "accent")
		piece(ctx, "BowR", V3(hs * 0.2, hs * 0.16, hs * 0.1), b * CF(hs * 0.12, 0, 0) * ANG(0, 0, -0.3), c.accent, "accent")
		piece(ctx, "BowKnot", V3(hs * 0.09, hs * 0.1, hs * 0.11), b, Studs.shade(c.accent, 0.8), "accent")
	end
	if t.acorn then -- acorn cap hat
		piece(ctx, "AcornCap", V3(hw * 0.62, hs * 0.14, hd * 0.6), top * CF(0, hs * 0.07, 0), c.accent, "accent")
		piece(ctx, "AcornCap2", V3(hw * 0.44, hs * 0.1, hd * 0.42), top * CF(0, hs * 0.18, 0), Studs.shade(c.accent, 1.15), "accent")
		piece(ctx, "AcornStem", V3(hs * 0.06, hs * 0.14, hs * 0.06), top * CF(0, hs * 0.3, 0), c.extra, "accent")
	end
	if t.clover then
		local b = top * CF(-hw * 0.18, hs * 0.04, 0)
		for k = 0, 3 do
			local a = k * math.pi / 2
			piece(ctx, "CloverLeaf", V3(hs * 0.14, hs * 0.04, hs * 0.14), b * CF(math.cos(a) * hs * 0.08, hs * 0.14, math.sin(a) * hs * 0.08), c.accent, "accent")
		end
		piece(ctx, "CloverStem", V3(hs * 0.03, hs * 0.14, hs * 0.03), b * CF(0, hs * 0.07, 0), Studs.shade(c.accent, 0.7), "accent")
	end
	if t.pineCrown then -- little pine tree growing on the head
		piece(ctx, "PineTrunk", V3(hs * 0.06, hs * 0.12, hs * 0.06), top * CF(0, hs * 0.06, 0), C(110, 70, 40), "accent")
		for k, wk in { 0.34, 0.24, 0.14 } do
			piece(ctx, "PineTier", V3(hs * wk, hs * 0.1, hs * wk), top * CF(0, hs * (0.1 + k * 0.08), 0), Studs.shade(c.accent, 0.9 + k * 0.08), "accent")
		end
		if t.frost then piece(ctx, "PineSnow", V3(hs * 0.1, hs * 0.05, hs * 0.1), top * CF(0, hs * 0.36, 0), WHITE, "accent") end
	end
	if t.rangerHat then
		piece(ctx, "HatBrim", V3(hw * 1.15, hs * 0.04, hd * 1.05), top * CF(0, hs * 0.02, 0), c.extra, "accent")
		piece(ctx, "HatCrown", V3(hw * 0.6, hs * 0.22, hd * 0.55), top * CF(0, hs * 0.14, 0), c.extra, "accent")
		piece(ctx, "HatBand", V3(hw * 0.62, hs * 0.05, hd * 0.57), top * CF(0, hs * 0.07, 0), c.accent, "accent")
		piece(ctx, "HatDent", V3(hw * 0.1, hs * 0.05, hd * 0.4), top * CF(0, hs * 0.26, 0), Studs.shade(c.extra, 0.8), "accent")
	end
	if t.bucketHat then
		piece(ctx, "BucketBrim", V3(hw * 1.05, hs * 0.05, hd * 0.98), top * CF(0, hs * 0.02, 0) * ANG(-0.08, 0, 0), c.accent, "accent")
		piece(ctx, "Bucket", V3(hw * 0.72, hs * 0.18, hd * 0.66), top * CF(0, hs * 0.12, 0), c.accent, "accent")
		piece(ctx, "BucketTop", V3(hw * 0.6, hs * 0.04, hd * 0.54), top * CF(0, hs * 0.22, 0), Studs.shade(c.accent, 1.1), "accent")
		piece(ctx, "Lure", V3(hs * 0.1, hs * 0.06, hs * 0.16), top * CF(hw * 0.36, hs * 0.12, 0), c.extra, "accent")
	end
	if t.beanie then
		piece(ctx, "Beanie", V3(hw * 0.86, hs * 0.22, hd * 0.84), top * CF(0, hs * 0.06, 0), c.accent, "accent")
		piece(ctx, "BeanieFold", V3(hw * 0.9, hs * 0.08, hd * 0.88), top * CF(0, -hs * 0.02, 0), c.extra, "accent")
		local pom = piece(ctx, "Pompom", V3(hs * 0.2, hs * 0.2, hs * 0.2), top * CF(0, hs * 0.26, 0), c.extra, "accent", { smooth = true })
		pom.Shape = Enum.PartType.Ball
	end
	if t.earmuffs then
		for _, side in { 1, -1 } do
			piece(ctx, "Muff", V3(hs * 0.16, hs * 0.3, hs * 0.3), hc * CF(side * (hw / 2 + hs * 0.08), hh * 0.18, 0), c.accent, "accent")
		end
		piece(ctx, "MuffBand", V3(hw * 1.1, hs * 0.06, hs * 0.1), top * CF(0, hs * 0.04, 0), Studs.shade(c.accent, 0.8), "accent")
	end
	if t.minerHat then
		piece(ctx, "Helmet", V3(hw * 0.86, hs * 0.2, hd * 0.86), top * CF(0, hs * 0.08, 0), c.accent, "accent")
		piece(ctx, "HelmetBrim", V3(hw * 0.9, hs * 0.04, hd * 0.2), top * CF(0, 0, -hd * 0.5), Studs.shade(c.accent, 0.85), "accent")
		local lamp = piece(ctx, "Lamp", V3(hs * 0.16, hs * 0.14, hs * 0.08), top * CF(0, hs * 0.1, -hd * 0.45), C(255, 250, 200), "accent", { material = Enum.Material.Neon })
		local light = Instance.new("SpotLight")
		light.Face = Enum.NormalId.Front
		light.Range = 14
		light.Brightness = 1.2
		light.Angle = 50
		light.Parent = lamp
	end
	if t.coconutHat then
		piece(ctx, "Coconut", V3(hw * 0.8, hs * 0.16, hd * 0.8), top * CF(0, hs * 0.04, 0), c.accent, "accent")
		piece(ctx, "CoconutRim", V3(hw * 0.84, hs * 0.04, hd * 0.84), top * CF(0, -hs * 0.03, 0), c.extra, "accent")
		leaf(ctx, top * CF(hw * 0.1, hs * 0.14, -hd * 0.1) * ANG(0, 0.6, 0), hs * 0.3, C(70, 160, 60))
	end
	if t.crown then
		piece(ctx, "CrownBand", V3(hw * 0.62, hs * 0.1, hd * 0.6), top * CF(0, hs * 0.06, 0), c.accent, "accent", { reflectance = 0.15 })
		for k = 0, 3 do
			local a = k * math.pi / 2 + math.pi / 4
			piece(ctx, "CrownSpike", V3(hs * 0.08, hs * 0.14, hs * 0.08), top * CF(math.cos(a) * hw * 0.24, hs * 0.17, math.sin(a) * hd * 0.24), c.accent, "accent", { reflectance = 0.15 })
		end
		piece(ctx, "CrownGem", V3(hs * 0.08, hs * 0.08, hs * 0.05), top * CF(0, hs * 0.07, -hd * 0.31), C(230, 40, 60), "accent", { smooth = true })
	end
	if t.leafCrown or t.willow then
		for k = 0, 4 do
			local a = k * math.pi * 2 / 5
			local cf = top * CF(math.cos(a) * hw * 0.3, hs * 0.04, math.sin(a) * hd * 0.3) * ANG(0, -a, if t.willow then 0.9 else 0.25)
			leaf(ctx, cf, hs * (if t.willow then 0.34 else 0.22), c.accent)
		end
	end
	if t.flowerCrown then
		for k = 0, 4 do
			local a = k * math.pi * 2 / 5
			flower(ctx, top * CF(math.cos(a) * hw * 0.32, hs * 0.04, math.sin(a) * hd * 0.32), hs * 0.18, c.accent, c.extra)
		end
	end
	if t.lotus then
		local b = top * CF(0, hs * 0.04, 0)
		for k = 0, 5 do
			local a = k * math.pi / 3
			piece(ctx, "LotusPetal", V3(hs * 0.1, hs * 0.2, hs * 0.08), b * CF(math.cos(a) * hs * 0.1, hs * 0.08, math.sin(a) * hs * 0.1) * ANG(0, -a, 0) * ANG(0, 0, 0.4), c.accent, "accent")
		end
		piece(ctx, "LotusCore", V3(hs * 0.1, hs * 0.08, hs * 0.1), b * CF(0, hs * 0.06, 0), c.extra, "accent")
	end
	if t.hibiscus then
		flower(ctx, hc * CF(hw * 0.42, hh * 0.3, -hd * 0.1) * ANG(0, 0, -1.2), hs * 0.32, c.accent, c.extra)
	end
	if t.mask then -- red panda face: white brows / cheeks + tear marks
		for _, side in { 1, -1 } do
			piece(ctx, "MaskBrow", V3(hs * 0.18, hs * 0.08, 0.06), hc * CF(side * eyeX, eyeY + hs * 0.18, front - 0.05), c.extra, "accent", { smooth = true })
			piece(ctx, "MaskCheek", V3(hs * 0.2, hs * 0.18, 0.06), hc * CF(side * hw * 0.34, -hh * 0.18, front - 0.04), c.extra, "accent", { smooth = true })
			piece(ctx, "TearMark", V3(hs * 0.06, hs * 0.2, 0.06), hc * CF(side * eyeX, eyeY - hs * 0.16, front - 0.06), Studs.shade(c.fur, 0.55), "accent", { smooth = true })
		end
	end
	if t.spectacles then -- pale rings around the eyes
		for _, side in { 1, -1 } do
			piece(ctx, "SpecRingT", V3(hs * 0.3, hs * 0.05, 0.05), hc * CF(side * eyeX, eyeY + hs * 0.14, front - 0.03), c.mark, "mark", { smooth = true })
			piece(ctx, "SpecRingB", V3(hs * 0.3, hs * 0.05, 0.05), hc * CF(side * eyeX, eyeY - hs * 0.14, front - 0.03), c.mark, "mark", { smooth = true })
			piece(ctx, "SpecRingS", V3(hs * 0.05, hs * 0.28, 0.05), hc * CF(side * (eyeX + hs * 0.14), eyeY, front - 0.03), c.mark, "mark", { smooth = true })
		end
		piece(ctx, "SpecBridge", V3(hs * 0.2, hs * 0.05, 0.05), hc * CF(0, eyeY + hs * 0.1, front - 0.03), c.mark, "mark", { smooth = true })
	end
	if t.sunglasses then
		for _, side in { 1, -1 } do
			piece(ctx, "Lens", V3(hs * 0.28, hs * 0.2, 0.06), hc * CF(side * eyeX, eyeY, front - 0.12), c.accent, "accent", { reflectance = 0.35 })
		end
		piece(ctx, "GlassBridge", V3(hw * 0.95, hs * 0.05, 0.05), hc * CF(0, eyeY + hs * 0.08, front - 0.12), c.accent, "accent")
		piece(ctx, "GlassArmL", V3(0.05, hs * 0.05, hd * 0.6), hc * CF(-hw / 2 - 0.03, eyeY + hs * 0.08, front + hd * 0.3), c.accent, "accent")
		piece(ctx, "GlassArmR", V3(0.05, hs * 0.05, hd * 0.6), hc * CF(hw / 2 + 0.03, eyeY + hs * 0.08, front + hd * 0.3), c.accent, "accent")
	end
	if t.glowEyes then
		for _, side in { 1, -1 } do
			piece(ctx, "GlowEye", V3(hs * 0.12, hs * 0.08, 0.04), hc * CF(side * eyeX, eyeY + hs * 0.02, front - 0.1), c.accent, "accent", { material = Enum.Material.Neon, smooth = true })
		end
	end
	if t.brow then -- heavy brow ridge
		piece(ctx, "BrowRidge", V3(hw * 0.92, hs * 0.12, hs * 0.18), hc * CF(0, eyeY + hs * 0.2, front - 0.02), Studs.shade(c.fur2, 0.9), "fur2")
	end
	if t.shaggy then -- mane around the face
		for _, side in { 1, -1 } do
			for k = 0, 2 do
				piece(ctx, "ManeTuft", V3(hs * 0.16, hs * 0.22, hs * 0.22), hc * CF(side * (hw / 2 + hs * 0.06), hh * (0.2 - k * 0.24), hd * 0.1), Studs.shade(c.fur2, 0.9 + k * 0.06), "fur2")
			end
		end
		piece(ctx, "ManeTop", V3(hw * 0.7, hs * 0.14, hd * 0.5), top * CF(0, hs * 0.04, hd * 0.12), c.fur2, "fur2")
	end
	if t.honey then -- honey dripping from the head
		piece(ctx, "HoneyCap", V3(hw * 0.5, hs * 0.08, hd * 0.5), top * CF(0, hs * 0.03, 0), c.accent, "accent", { transparency = 0.15, reflectance = 0.1 })
		for k, x in { -0.18, 0.04, 0.2 } do
			piece(ctx, "HoneyDrip", V3(hs * 0.08, hs * (0.14 + k * 0.05), hs * 0.08), hc * CF(x * hw, hh / 2 - hs * 0.06 - k * 0.02, front - 0.02), c.accent, "accent", { transparency = 0.15, smooth = true })
		end
	end
	if t.mushrooms then
		for k, o in { { 0.18, 0, 1 }, { -0.2, 0.1, 0.7 } } do
			local b = top * CF(hw * o[1], 0, hd * o[2])
			local m = o[3]
			piece(ctx, "MushStem", V3(hs * 0.14 * m, hs * 0.24 * m, hs * 0.14 * m), b * CF(0, hs * 0.12 * m, 0), c.extra, "accent")
			piece(ctx, "MushCap", V3(hs * 0.48 * m, hs * 0.14 * m, hs * 0.48 * m), b * CF(0, hs * 0.3 * m, 0), c.accent, "accent")
			piece(ctx, "MushCapTop", V3(hs * 0.3 * m, hs * 0.08 * m, hs * 0.3 * m), b * CF(0, hs * 0.4 * m, 0), Studs.shade(c.accent, 1.08), "accent")
			piece(ctx, "MushDot", V3(hs * 0.09 * m, hs * 0.04 * m, hs * 0.09 * m), b * CF(hs * 0.12 * m, hs * 0.38 * m, hs * 0.06 * m), c.extra, "accent")
			piece(ctx, "MushDot", V3(hs * 0.07 * m, hs * 0.04 * m, hs * 0.07 * m), b * CF(-hs * 0.1 * m, hs * 0.38 * m, -hs * 0.08 * m), c.extra, "accent")
		end
	end
	if t.ferns then
		for _, side in { 1, -1 } do
			leaf(ctx, top * CF(side * hw * 0.2, hs * 0.02, hd * 0.1) * ANG(0.3, 0, side * 0.6), hs * 0.3, c.accent)
		end
	end
	if t.crystals then
		crystal(ctx, top * CF(0, -hs * 0.02, 0), hs * 0.22, c.extra)
	end
	if t.aurora then
		piece(ctx, "AuroraBand", V3(hw * 0.8, hs * 0.05, hd * 0.2), top * CF(0, hs * 0.03, -hd * 0.1), c.accent, "accent", { material = Enum.Material.Neon, transparency = 0.25 })
	end
	if t.mud then
		piece(ctx, "MudSplat", V3(hs * 0.2, hs * 0.04, hs * 0.18), top * CF(hw * 0.1, hs * 0.01, 0), c.mark, "mark", { smooth = true })
	end
end

------------------------------------------------------------------------------------------
-- BODY (torso)
------------------------------------------------------------------------------------------
function BearTraits.body(ctx)
	local t, c, s = ctx.traits, ctx.c, ctx.s
	local bc, w, h, l = ctx.bc, ctx.w, ctx.h, ctx.l
	local back = bc * CF(0, h / 2 + 0.1 * s, 0)
	local neck = bc * CF(0, h * 0.3, -l / 2 - 0.1 * s)

	if t.stripes then
		for k = 0, 3 do
			piece(ctx, "BackStripe", V3(w * 0.84, 0.08 * s, l * 0.06), back * CF(0, 0.02, -l * 0.3 + k * l * 0.2), c.extra, "extra")
			for _, side in { 1, -1 } do
				piece(ctx, "SideStripe", V3(0.08 * s, h * 0.36, l * 0.06), bc * CF(side * (w / 2 + 0.12 * s), h * 0.22, -l * 0.3 + k * l * 0.2), c.extra, "extra")
			end
		end
	end
	if t.rainbowStripes then
		local cols = { C(255, 80, 90), C(255, 170, 50), C(255, 230, 60), C(90, 220, 90), C(70, 170, 255), C(170, 100, 255) }
		for k, col in cols do
			piece(ctx, "RainbowBand", V3(w * 0.86, 0.08 * s, l * 0.12), back * CF(0, 0.02, -l * 0.36 + (k - 1) * l * 0.145), col, "accent")
		end
	end
	if t.spots or t.patches or t.pebbles then
		local col = if t.pebbles then c.mark or c.extra else c.mark or Studs.shade(c.fur, 0.75)
		local spots = { { 0.2, 0.2, -0.2 }, { -0.25, 0.1, 0.15 }, { 0.1, -0.15, 0.3 }, { -0.1, 0.25, -0.05 } }
		for _, sp in spots do
			piece(ctx, "BackSpot", V3(w * 0.22, 0.08 * s, l * 0.14), back * CF(sp[1] * w, 0.02, sp[3] * l), col, "mark")
		end
		for _, side in { 1, -1 } do
			piece(ctx, "SideSpot", V3(0.08 * s, h * 0.22, l * 0.14), bc * CF(side * (w / 2 + 0.12 * s), h * 0.05, side * l * 0.12), col, "mark")
		end
		if t.pebbles then
			for k = 0, 2 do
				piece(ctx, "Pebble", V3(0.36 * s, 0.24 * s, 0.32 * s), back * CF((k - 1) * w * 0.25, 0.12 * s, l * (0.25 - k * 0.2)) * ANG(0, k, 0), c.extra, "extra")
			end
		end
	end
	if t.bark then
		for k = 0, 2 do
			for _, side in { 1, -1 } do
				piece(ctx, "BarkPlate", V3(0.1 * s, h * 0.5, l * 0.14), bc * CF(side * (w / 2 + 0.16 * s), h * 0.1, -l * 0.28 + k * l * 0.28), c.extra, "extra")
			end
		end
	end
	if t.pinecones then
		for k = 0, 2 do
			local p = back * CF((k - 1) * w * 0.22, 0.2 * s, l * (0.2 - k * 0.2))
			piece(ctx, "Cone", V3(0.42 * s, 0.5 * s, 0.42 * s), p, c.accent, "accent")
			piece(ctx, "ConeTip", V3(0.28 * s, 0.22 * s, 0.28 * s), p * CF(0, 0.34 * s, 0), Studs.shade(c.accent, 0.8), "accent")
		end
	end
	if t.thickNeck then
		piece(ctx, "NeckMass", V3(w * 0.9, h * 0.55, 0.6 * s), neck * CF(0, -h * 0.1, 0.25 * s), c.fur2, "fur2")
	end
	if t.scarf then
		piece(ctx, "Scarf", V3(w * 0.84, h * 0.17, 0.75 * s), neck * CF(0, 0, 0.1 * s), c.accent, "accent")
		piece(ctx, "ScarfStripe", V3(w * 0.86, h * 0.05, 0.77 * s), neck * CF(0, 0, 0.1 * s), c.extra, "accent")
		piece(ctx, "ScarfTail", V3(0.4 * s, h * 0.5, 0.12 * s), neck * CF(w * 0.22, -h * 0.28, -0.3 * s) * ANG(0, 0, 0.12), c.accent, "accent")
	end
	if t.lei then
		local cols = { c.accent, c.extra, C(255, 140, 200), c.accent, c.extra }
		for k = 0, 6 do
			local a = (k / 6 - 0.5) * math.pi * 0.9
			flower(ctx, neck * CF(math.sin(a) * w * 0.42, -h * 0.05 - math.cos(a) * h * 0.08, -0.15 * s - math.cos(a) * 0.1 * s) * ANG(math.pi / 2, 0, 0), 0.34 * s, cols[k % #cols + 1], C(255, 230, 80))
		end
	end
	if t.moss then
		for k = 0, 3 do
			piece(ctx, "Moss", V3(w * (0.4 + (k % 2) * 0.2), 0.16 * s, l * 0.2), back * CF((k % 2 - 0.5) * w * 0.3, 0.04, -l * 0.32 + k * l * 0.21), Studs.shade(c.extra, 0.9 + (k % 2) * 0.15), "extra")
		end
		piece(ctx, "MossDrape", V3(0.1 * s, h * 0.35, l * 0.3), bc * CF(w / 2 + 0.14 * s, h * 0.25, 0), c.extra, "extra")
	end
	if t.rocky then
		for k = 0, 2 do
			local p = back * CF((k - 1) * w * 0.2, 0.2 * s, -l * 0.2 + k * l * 0.2)
			piece(ctx, "RockPlate", V3(w * 0.34, 0.4 * s, l * 0.2), p * ANG(0, k * 0.4, (k - 1) * 0.15), c.extra, "extra")
			piece(ctx, "RockTop", V3(w * 0.2, 0.24 * s, l * 0.12), p * CF(0, 0.3 * s, 0) * ANG(0, k * 0.7, 0), Studs.shade(c.extra, 1.12), "extra")
		end
	end
	if t.armor then
		piece(ctx, "ArmorBack", V3(w * 0.9, 0.24 * s, l * 0.7), back * CF(0, 0.08 * s, 0), c.extra, "extra", { reflectance = 0.2 })
		for _, side in { 1, -1 } do
			piece(ctx, "ArmorSide", V3(0.14 * s, h * 0.5, l * 0.66), bc * CF(side * (w / 2 + 0.16 * s), h * 0.18, 0), Studs.shade(c.extra, 0.9), "extra", { reflectance = 0.2 })
			for k = 0, 2 do
				piece(ctx, "Rivet", V3(0.14 * s, 0.14 * s, 0.14 * s), bc * CF(side * (w / 2 + 0.24 * s), h * 0.32, -l * 0.25 + k * l * 0.25), c.accent, "accent")
			end
		end
	end
	if t.nuggets then
		for k = 0, 3 do
			piece(ctx, "Nugget", V3(0.4 * s, 0.3 * s, 0.36 * s), back * CF((k % 2 - 0.5) * w * 0.4, 0.14 * s, -l * 0.3 + k * l * 0.2) * ANG(0, k, 0.2), c.extra, "accent", { reflectance = 0.25 })
		end
	end
	if t.crystals then
		for k = 0, 2 do
			crystal(ctx, back * CF((k - 1) * w * 0.22, 0, -l * 0.2 + k * l * 0.15) * ANG(0, 0, (k - 1) * 0.3), (0.7 + (k % 2) * 0.3) * s, c.extra)
		end
	end
	if t.frost or t.icicles then
		for k = 0, 2 do
			piece(ctx, "FrostTip", V3(w * 0.7, 0.1 * s, l * 0.18), back * CF(0, 0.05 * s, -l * 0.3 + k * l * 0.3), c.extra, "extra")
		end
		if t.icicles then
			for k = 0, 4 do
				for _, side in { 1, -1 } do
					piece(ctx, "Icicle", V3(0.12 * s, 0.4 * s, 0.12 * s), bc * CF(side * (w / 2 + 0.06 * s), -h * 0.05, -l * 0.36 + k * l * 0.18), c.extra, "accent", { material = Enum.Material.Glass, transparency = 0.2 })
				end
			end
		end
	end
	if t.snowballs then
		for k = 0, 1 do
			local b = piece(ctx, "Snowball", V3(0.6 * s, 0.6 * s, 0.6 * s), back * CF((k - 0.5) * w * 0.4, 0.25 * s, l * 0.15 - k * l * 0.3), WHITE, "accent", { smooth = true })
			b.Shape = Enum.PartType.Ball
		end
	end
	if t.ripples then
		for k = 0, 2 do
			for _, side in { 1, -1 } do
				piece(ctx, "Ripple", V3(0.08 * s, 0.12 * s, l * 0.5), bc * CF(side * (w / 2 + 0.13 * s), -h * 0.15 + k * h * 0.15, 0), c.extra, "extra", { smooth = true })
			end
		end
	end
	if t.reeds then
		for k = 0, 3 do
			local p = back * CF((k % 2 - 0.5) * w * 0.3, 0, l * (0.25 - k * 0.12))
			local hgt = (1 + (k % 3) * 0.3) * s
			piece(ctx, "Reed", V3(0.08 * s, hgt, 0.08 * s), p * CF(0, hgt / 2, 0) * ANG(0.1 * k, 0, 0), c.accent, "accent")
			piece(ctx, "ReedTop", V3(0.16 * s, 0.34 * s, 0.16 * s), p * ANG(0.1 * k, 0, 0) * CF(0, hgt, 0), c.extra, "accent")
		end
	end
	if t.petals then
		for k = 0, 4 do
			piece(ctx, "Petal", V3(0.3 * s, 0.06 * s, 0.24 * s), back * CF((k % 3 - 1) * w * 0.28, 0.03, -l * 0.35 + k * l * 0.17) * ANG(0, k * 1.1, 0), c.accent, "accent")
		end
	end
	if t.coral then
		for k = 0, 2 do
			local p = back * CF((k - 1) * w * 0.25, 0, l * (0.15 - k * 0.15))
			piece(ctx, "CoralStem", V3(0.2 * s, 0.6 * s, 0.2 * s), p * CF(0, 0.3 * s, 0), c.accent, "accent")
			piece(ctx, "CoralBranch", V3(0.16 * s, 0.4 * s, 0.16 * s), p * CF(0.18 * s, 0.5 * s, 0) * ANG(0, 0, -0.6), c.accent, "accent")
			piece(ctx, "CoralBranch", V3(0.16 * s, 0.34 * s, 0.16 * s), p * CF(-0.16 * s, 0.56 * s, 0) * ANG(0, 0, 0.6), c.extra, "accent")
		end
	end
	if t.shells then
		for k = 0, 2 do
			local p = back * CF((k - 1) * w * 0.26, 0.08 * s, l * (0.2 - k * 0.2)) * ANG(0, k * 0.8, 0)
			for r = 0, 2 do
				piece(ctx, "ShellRib", V3(0.12 * s, 0.14 * s, 0.5 * s), p * ANG(0, (r - 1) * 0.45, 0) * CF(0, 0, -0.1 * s), if r == 1 then c.accent else c.extra, "accent")
			end
		end
	end
	if t.mud then
		for k = 0, 3 do
			piece(ctx, "Mud", V3(w * 0.28, 0.08 * s, l * 0.16), back * CF((k % 2 - 0.5) * w * 0.4, 0.02, -l * 0.3 + k * l * 0.2) * ANG(0, k * 0.6, 0), c.mark, "mark")
		end
		for _, side in { 1, -1 } do
			piece(ctx, "MudSide", V3(0.08 * s, h * 0.3, l * 0.3), bc * CF(side * (w / 2 + 0.12 * s), -h * 0.15, side * l * 0.1), c.mark, "mark")
		end
	end
	if t.stars then
		for k = 0, 4 do
			piece(ctx, "Star", V3(0.16 * s, 0.06 * s, 0.16 * s), back * CF((k % 3 - 1) * w * 0.3, 0.03, -l * 0.35 + k * l * 0.17) * ANG(0, math.pi / 4, 0), c.extra, "accent", { material = Enum.Material.Neon })
		end
	end
	if t.aurora then
		for k = 0, 2 do
			piece(ctx, "AuroraBack", V3(w * 0.6, 0.06 * s, l * 0.08), back * CF(0, 0.03, -l * 0.25 + k * l * 0.25) * ANG(0, 0.3 * (k - 1), 0), if k == 1 then c.extra else c.accent, "accent", { material = Enum.Material.Neon, transparency = 0.3 })
		end
	end
	if t.crescent then
		local cc = bc * CF(0, h * 0.12, -l / 2 - 0.16 * s)
		piece(ctx, "Crescent", V3(w * 0.5, 0.18 * s, 0.08 * s), cc, c.mark, "mark", { smooth = true })
		for _, side in { 1, -1 } do
			piece(ctx, "CrescentTip", V3(0.18 * s, h * 0.2, 0.08 * s), cc * CF(side * w * 0.26, h * 0.08, 0) * ANG(0, 0, side * 0.4), c.mark, "mark", { smooth = true })
		end
	end
	if t.fishSnack or t.bambooSnack then
		-- something to munch held against the chest
		local p = bc * CF(0, -h * 0.05, -l / 2 - 0.4 * s)
		if t.bambooSnack then
			piece(ctx, "Bamboo", V3(0.24 * s, h * 0.9, 0.24 * s), p * ANG(0, 0, 0.5), C(130, 190, 70), "accent")
			piece(ctx, "BambooNode", V3(0.28 * s, 0.08 * s, 0.28 * s), p * ANG(0, 0, 0.5), C(90, 150, 50), "accent")
			leaf(ctx, p * ANG(0, 0, 0.5) * CF(0, h * 0.4, 0), 0.5 * s, C(80, 170, 60))
		else
			piece(ctx, "SnackFish", V3(0.3 * s, 0.4 * s, 1.1 * s), p * ANG(0, math.pi / 2, 0.2), c.extra, "accent")
			piece(ctx, "SnackTail", V3(0.12 * s, 0.4 * s, 0.3 * s), p * ANG(0, math.pi / 2, 0.2) * CF(0, 0, 0.65 * s), Studs.shade(c.extra, 0.8), "accent")
		end
	end
	if t.aura then
		sparkle(ctx.torso, c.extra, 3)
	end
end

------------------------------------------------------------------------------------------
-- TAIL
------------------------------------------------------------------------------------------
function BearTraits.tail(ctx)
	local t, c, s = ctx.traits, ctx.c, ctx.s
	if t.ringTail then
		-- long red-panda tail with rings
		for k = 0, 5 do
			local col = if k % 2 == 0 then c.fur else c.extra
			piece(ctx, "RingTail", V3(0.5 * s, 0.5 * s, 0.34 * s), ctx.pivot * CF(0, -k * 0.08 * s, 0.3 * s + k * 0.32 * s) * ANG(-0.15 * k, 0, 0), col, "fur")
		end
	end
end

return BearTraits
