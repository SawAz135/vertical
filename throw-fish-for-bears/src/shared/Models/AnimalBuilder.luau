--[[ AnimalBuilder: the non-bear creatures (fish eaters of the real world), in the same
     "full studs" brick-toy language as the bears (studs on every face, round glossy eyes).

     Every animal uses the SAME rig vocabulary as the bears, so the whole game (base AI,
     carrying, Index thumbnails, reveal, AnimalAnimator) handles it without special cases:
       HumanoidRootPart (invisible, PrimaryPart) ─ "BodyJoint" -> Torso
         ├─ "Neck" -> Head ─ "Jaw" (lower beak / jaw), "EarL" / "EarR" (mammals)
         ├─ legs   "LegFL" "LegFR" "LegBL" "LegBR" (birds / penguins: LegBL + LegBR only;
         │          seals: LegFL / LegFR are the front flippers)
         ├─ "WingL" / "WingR" (birds' wings, penguins' flippers, the orca's pectoral fins)
         └─ "Tail" (feathers, tail, rear flippers, the orca's fluke)
     The animal faces -Z, feet / belly on Y = 0 in model space. Attribute "Plan" tells the
     animator how the body moves: "bird", "penguin", "quad", "swim". ]]
local Shared = script.Parent.Parent
local Studs = require(script.Parent.Studs)
local BearConfig = require(Shared.Config.BearConfig)

local AnimalBuilder = {}

local CF = CFrame.new
local V3 = Vector3.new
local ANG = CFrame.Angles
local PI = math.pi
local BLACK = Color3.fromRGB(16, 16, 20)
local WHITE = Color3.fromRGB(255, 255, 255)
local MOUTH = Color3.fromRGB(110, 34, 40)
local TOOTH = Color3.fromRGB(250, 248, 238)
local CYL = Enum.PartType.Cylinder

-- a build context: the model + its torso, piece helpers that remember the bone they weld to
local function newCtx(id: string, spec, s: number)
	local model = Instance.new("Model")
	pcall(function() model.ModelStreamingMode = Enum.ModelStreamingMode.Atomic end)
	model.Name = spec.name
	return { model = model, spec = spec, s = s, c = spec.colors }
end

local function P(ctx, list, name: string, size: Vector3, cf: CFrame, color: Color3, role: string?, opts: any?)
	local p = Studs.piece(ctx.model, name, size, cf, color, role, opts)
	table.insert(list, p)
	return p
end

-- a bone with its own parts, jointed to `parent` at `pivot`
local function limb(ctx, parent: BasePart, jointName: string, boneName: string, pivot: CFrame, build: (list: { BasePart }) -> ())
	local bone = Studs.bone(ctx.model, boneName, pivot)
	local list = {}
	build(list)
	Studs.weldAll(bone, list)
	Studs.motor(jointName, parent, bone, pivot)
	return bone
end

--[[ ROUND GLOSSY EYES (owl reference): a white disc, a big black pupil, two shine dots and a
     hidden lid (blinks). `cf` = the eye centre, facing direction = the frame's -Z.
     side-facing bird eyes pass a frame turned to the side. ]]
local function eye(ctx, list, cf: CFrame, r: number, iris: Color3?, lidColor: Color3)
	local face = cf * ANG(0, PI / 2, 0) -- cylinder axis (X) -> the frame's Z axis
	P(ctx, list, "EyeWhite", V3(0.08, r * 2, r * 2), face, WHITE, "eye", { shape = CYL, smooth = true })
	if iris then
		P(ctx, list, "Iris", V3(0.06, r * 1.5, r * 1.5), face * CF(0.05, 0, 0), iris, "eye", { shape = CYL, smooth = true })
	end
	P(ctx, list, "Pupil", V3(0.06, r * 1.15, r * 1.15), face * CF(0.09, 0, 0), BLACK, "eye", { shape = CYL, smooth = true })
	P(ctx, list, "EyeShine", V3(0.04, r * 0.38, r * 0.38), cf * CF(r * 0.3, r * 0.32, -0.14), WHITE, "pupil", { smooth = true })
	P(ctx, list, "EyeShine2", V3(0.04, r * 0.17, r * 0.17), cf * CF(-r * 0.28, -r * 0.3, -0.14), WHITE, "pupil", { smooth = true })
	local lid = P(ctx, list, "Eyelid", V3(0.07, r * 2.15, r * 2.15), face * CF(0.13, 0, 0), lidColor, "fur", { shape = CYL, smooth = true })
	lid.Transparency = 1
end

-- the common rig: root + torso + the standard attachments / attributes
local function rig(ctx, bodySize: Vector3, bodyY: number)
	local model = ctx.model
	local root = Instance.new("Part")
	root.Name = "HumanoidRootPart"
	root.Size = bodySize
	root.CFrame = CF(0, bodyY, 0)
	root.Transparency = 1
	root.CanCollide = false
	root.CanTouch = false
	root.CanQuery = true
	root.CastShadow = false
	root.TopSurface = Enum.SurfaceType.Smooth
	root.BottomSurface = Enum.SurfaceType.Smooth
	root.Parent = model
	model.PrimaryPart = root
	local torso = Studs.bone(model, "Torso", CF(0, bodyY, 0), bodySize * 0.5)
	Studs.motor("BodyJoint", root, torso, CF(0, bodyY, 0))
	ctx.root, ctx.torso, ctx.bodyY = root, torso, bodyY
	return root, torso
end

local function finish(ctx, opts, plan: string, hip: number, bodyLen: number, headTop: number, mouthCF: CFrame?)
	local model, root, s = ctx.model, ctx.root, ctx.s
	local spec = ctx.spec
	local overhead = Instance.new("Attachment")
	overhead.Name = "Overhead"
	overhead.Position = V3(0, headTop - ctx.bodyY + 0.6 * s, 0)
	overhead.Parent = root
	local feet = Instance.new("Attachment")
	feet.Name = "Feet"
	feet.Position = V3(0, -ctx.bodyY + 0.1, 0)
	feet.Parent = root
	local head = model:FindFirstChild("Head")
	if head and mouthCF then
		local m = Instance.new("Attachment")
		m.Name = "MouthAtt"
		m.CFrame = (head :: BasePart).CFrame:ToObjectSpace(mouthCF)
		m.Parent = head
	end
	model:SetAttribute("Kind", "Bear") -- "Bear" = any collectible creature (systems share it)
	model:SetAttribute("Animal", true)
	model:SetAttribute("Plan", plan)
	model:SetAttribute("Species", ctx.id)
	model:SetAttribute("Scale", s)
	model:SetAttribute("Gait", spec.gait)
	model:SetAttribute("HipHeight", hip)
	model:SetAttribute("BodyLength", bodyLen)
	model:SetAttribute("Anim", "Idle")
	-- brick relief everywhere (feathers, scales, fur), before the mutation recolours it
	if not opts.noBricks then
		Studs.brickify(model, s, #ctx.id * 977 + 13, opts.brickBudget or 130)
	end
	if opts.variant and opts.variant ~= "Normal" then
		require(script.Parent.Variants).apply(model, opts.variant)
	end
	if opts.character then
		root.CanCollide = true
		local hum = Instance.new("Humanoid")
		hum.RigType = Enum.HumanoidRigType.R15
		hum.HipHeight = math.max(0.5, hip)
		hum.RequiresNeck = false
		hum.BreakJointsOnDeath = false
		hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
		hum.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
		hum.WalkSpeed = spec.speed
		hum.Parent = model
	end
	root.Massless = false
	Studs.allStuds(model) -- full studs: sides and bottom too
	return model
end

------------------------------------------------------------------------------------------
-- BIRDS: pelican, osprey, kingfisher, heron
------------------------------------------------------------------------------------------
--[[ o: body {w,h,l}, legLen, legT, neck {len, lean, w}, head (size), beak {l, w, h, hook},
        pouch, crest, stripe, tail {l, w}, upright (body pitch), colours in ctx.c ]]
local function buildBird(ctx, o)
	local s, c = ctx.s, ctx.c
	local W, H, L = o.body.w * s, o.body.h * s, o.body.l * s
	local legLen = o.legLen * s
	local by = legLen + H * 0.42
	local _, torso = rig(ctx, V3(W, H, L), by)
	local tilt = ANG(o.upright or 0, 0, 0) -- raptors sit up
	local bc = CF(0, by, 0) * tilt
	local tp = {}
	-- body: layered plumage
	P(ctx, tp, "Body", V3(W, H, L), bc, c.fur, "fur")
	P(ctx, tp, "Back", V3(W * 0.9, H * 0.22, L * 0.86), bc * CF(0, H * 0.5, L * 0.04), c.fur2, "fur2")
	P(ctx, tp, "Belly", V3(W * 0.84, H * 0.5, L * 0.78), bc * CF(0, -H * 0.3, -L * 0.04), c.belly, "belly")
	P(ctx, tp, "Chest", V3(W * 0.82, H * 0.74, 0.5 * s), bc * CF(0, -H * 0.06, -L / 2 - 0.2 * s), c.belly, "belly")
	P(ctx, tp, "ChestFluff", V3(W * 0.56, H * 0.4, 0.24 * s), bc * CF(0, -H * 0.18, -L / 2 - 0.5 * s), Studs.shade(c.belly, 1.06), "belly")
	P(ctx, tp, "Rump", V3(W * 0.78, H * 0.6, 0.4 * s), bc * CF(0, H * 0.02, L / 2 + 0.15 * s), c.fur2, "fur2")
	if c.mark then
		-- a band of colour across the shoulders (osprey dark back / kingfisher stripe)
		P(ctx, tp, "Mantle", V3(W * 0.96, H * 0.3, L * 0.4), bc * CF(0, H * 0.4, -L * 0.22), c.mark, "mark")
	end
	-- FEATHER ROWS (3D, stepped like brick shingles): scapulars on the back, scallops on
	-- the chest, a fluffy flank on each side
	for k = 0, 2 do
		P(ctx, tp, "Scapular" .. k, V3(W * (0.74 - k * 0.12), H * 0.1, L * 0.22), bc * CF(0, H * 0.58 + k * 0.02, -L * 0.2 + k * L * 0.22), Studs.shade(c.fur2, 1 - k * 0.05), "fur2")
		P(ctx, tp, "Scallop" .. k, V3(W * (0.66 - k * 0.14), H * 0.16, 0.16 * s), bc * CF(0, H * (0.12 - k * 0.2), -L / 2 - 0.42 * s - k * 0.04 * s), Studs.shade(c.belly, 1.03 - k * 0.03), "belly")
	end
	for _, side in { -1, 1 } do
		P(ctx, tp, "Flank", V3(0.18 * s, H * 0.42, L * 0.62), bc * CF(side * (W / 2 + 0.06 * s), -H * 0.22, L * 0.02), Studs.shade(c.belly, 0.96), "belly")
	end
	if o.ring then
		-- the white neck ring (mallard)
		P(ctx, tp, "NeckRing", V3(W * 0.5, 0.18 * s, W * 0.5), bc * CF(0, H * 0.42, -L * 0.42), o.ring, "mark")
	end
	Studs.weldAll(torso, tp)

	-- TAIL feathers (own bone: they fan, flick)
	local tl = (o.tail and o.tail.l or 1) * s
	local tw = (o.tail and o.tail.w or 0.7) * W
	local tailPivot = bc * CF(0, H * 0.12, L / 2 + 0.3 * s)
	limb(ctx, torso, "Tail", "TailBone", tailPivot, function(list)
		P(ctx, list, "TailFeathers", V3(tw, 0.24 * s, tl), tailPivot * ANG(0.22, 0, 0) * CF(0, 0, tl / 2), c.tail or c.fur2, "fur2")
		P(ctx, list, "TailTip", V3(tw * 0.8, 0.18 * s, 0.3 * s), tailPivot * ANG(0.22, 0, 0) * CF(0, 0.02, tl + 0.1 * s), Studs.shade(c.tail or c.fur2, 0.8), "fur2")
		P(ctx, list, "TailUnder", V3(tw * 0.6, 0.16 * s, tl * 0.6), tailPivot * ANG(0.15, 0, 0) * CF(0, -0.16 * s, tl * 0.3), c.belly, "belly")
		if o.tail and o.tail.fork then
			-- a long forked tail (terns, frigatebirds): two streamers spreading apart
			for _, side in { -1, 1 } do
				local fl = o.tail.fork * s
				P(ctx, list, "Streamer", V3(tw * 0.22, 0.16 * s, fl), tailPivot * ANG(0.18, side * 0.28, 0) * CF(side * tw * 0.2, 0, tl + fl / 2 - 0.1 * s), Studs.shade(c.tail or c.fur2, 0.9), "fur2")
			end
		end
	end)

	-- WINGS folded along the sides (own bones: they open, flap, ruffle)
	for _, side in { -1, 1 } do
		local pivot = bc * CF(side * W / 2, H * 0.28, -L * 0.28)
		limb(ctx, torso, if side < 0 then "WingL" else "WingR", if side < 0 then "WingBoneL" else "WingBoneR", pivot, function(list)
			local wl = L * 1.02 * (o.wingK or 1)
			P(ctx, list, "Wing", V3(0.3 * s, H * 0.72, wl), pivot * CF(side * 0.12 * s, -H * 0.3, wl / 2 - 0.1 * s), c.wing or c.fur2, "fur2")
			P(ctx, list, "WingCovert", V3(0.32 * s, H * 0.26, wl * 0.62), pivot * CF(side * 0.14 * s, -H * 0.06, wl * 0.3), Studs.shade(c.wing or c.fur2, 1.1), "fur2")
			-- primaries cross over the rump, darker tips
			P(ctx, list, "Primaries", V3(0.26 * s, H * 0.34, L * 0.5), pivot * CF(side * 0.1 * s, -H * 0.46, wl * 0.98), c.wingTip or Studs.shade(c.wing or c.fur2, 0.55), "mark")
			P(ctx, list, "PrimaryTip", V3(0.22 * s, H * 0.2, L * 0.2), pivot * CF(side * 0.08 * s, -H * 0.42, wl * 1.3), c.wingTip or Studs.shade(c.wing or c.fur2, 0.45), "mark")
			-- stepped secondaries (each row a little lower and further out: real 3D feathers)
			for k = 0, 2 do
				P(ctx, list, "Secondary" .. k, V3(0.34 * s + k * 0.04 * s, H * 0.12, wl * (0.42 - k * 0.08)), pivot * CF(side * (0.16 + k * 0.03) * s, -H * (0.34 + k * 0.13), wl * (0.5 + k * 0.08)),
					Studs.shade(c.wing or c.fur2, 1.05 - k * 0.1), "fur2")
			end
		end)
	end

	-- LEGS (thin, scaly) with 3 toes forward and one back
	local legT = (o.legT or 0.22) * s
	for _, side in { -1, 1 } do
		local pivot = CF(side * W * 0.24, legLen + 0.05 * s, L * 0.05)
		limb(ctx, torso, if side < 0 then "LegBL" else "LegBR", if side < 0 then "LegBLBone" else "LegBRBone", pivot, function(list)
			P(ctx, list, "Thigh", V3(legT * 2.4, 0.5 * s, legT * 2.6), pivot * CF(0, 0.15 * s, 0), c.fur2, "fur2")
			P(ctx, list, "Shank", V3(legT, legLen, legT), pivot * CF(0, -legLen / 2, 0), c.leg, "paw")
			P(ctx, list, "Ankle", V3(legT * 1.3, legT * 1.2, legT * 1.3), pivot * CF(0, -legLen + legT * 0.8, 0), Studs.shade(c.leg, 0.9), "paw")
			local toeL = (o.toe or 0.55) * s * 1.15
			-- chunky brick feet: a flat foot plate + 3 fat toes
			P(ctx, list, "FootPlate", V3(legT * 2.6, legT * 0.7, toeL * 0.9), pivot * CF(0, -legLen + legT * 0.35, -toeL * 0.3), c.leg, "paw")
			for k = -1, 1 do
				P(ctx, list, "Toe", V3(legT * 1.1, legT * 0.75, toeL), pivot * CF(0, -legLen + legT * 0.38, 0) * ANG(0, k * 0.42, 0) * CF(0, 0, -toeL / 2), Studs.shade(c.leg, 1.04), "paw")
			end
			P(ctx, list, "HindToe", V3(legT * 0.7, legT * 0.55, toeL * 0.55), pivot * CF(0, -legLen + legT * 0.3, toeL * 0.3), c.leg, "paw")
			if o.talons then
				for k = -1, 1 do
					P(ctx, list, "Talon", V3(legT * 0.5, legT * 0.8, legT * 0.6), pivot * CF(0, -legLen + legT * 0.2, 0) * ANG(0, k * 0.5, 0) * CF(0, -0.02, -toeL - 0.05 * s), BLACK, "claw", { smooth = true })
				end
			end
		end)
	end

	-- NECK + HEAD (one bone: the whole neck bends at its base)
	local nk = o.neck
	local nLen, nLean = nk.len * s, nk.lean or 0.3
	local nW = (nk.w or 0.55) * s
	local neckPivot = bc * CF(0, H * 0.3, -L * 0.4)
	local hs = o.head * s * 1.15 -- big cute heads (reference: chunky brick birds)
	local headTop = 0
	local mouth
	local head = Studs.bone(ctx.model, "Head", neckPivot)
	local hp = {}
	-- the neck: stacked blocks leaning forward (an S for the heron, short for the others)
	local segs = math.max(1, math.floor(nLen / (0.6 * s) + 0.5))
	local tip = neckPivot
	for i = 1, segs do
		local lean = nLean * (if nk.s and i > segs / 2 then -0.6 else 1)
		local seg = tip * ANG(-lean, 0, 0) * CF(0, nLen / segs / 2, 0)
		P(ctx, hp, "Neck", V3(nW, nLen / segs + 0.12 * s, nW * 1.05), seg, if i == segs then c.head or c.fur else c.neck or c.fur, "fur")
		tip = seg * CF(0, nLen / segs / 2, 0)
	end
	local hc = CF(tip.Position) * CF(0, hs * 0.3, 0) -- the head stays level
	headTop = hc.Position.Y + hs / 2
	P(ctx, hp, "Skull", V3(hs * 0.9, hs, hs * 1.1), hc, c.head or c.fur, "fur")
	P(ctx, hp, "Cheek", V3(hs * 0.96, hs * 0.4, hs * 0.7), hc * CF(0, -hs * 0.26, hs * 0.05), Studs.shade(c.head or c.fur, 0.95), "fur")
	if c.crown then
		P(ctx, hp, "Crown", V3(hs * 0.7, hs * 0.18, hs * 0.8), hc * CF(0, hs * 0.55, hs * 0.05), c.crown, "mark")
	end
	if o.batEars then
		for _, side in { -1, 1 } do
			P(ctx, hp, "BatEar", V3(hs * 0.3, hs * 0.75, 0.14 * s), hc * CF(side * hs * 0.3, hs * 0.75, 0) * ANG(0, 0, side * -0.25), c.head or c.fur, "fur")
			P(ctx, hp, "BatEarIn", V3(hs * 0.16, hs * 0.5, 0.06), hc * CF(side * hs * 0.3, hs * 0.72, -0.09 * s) * ANG(0, 0, side * -0.25), Color3.fromRGB(200, 140, 140), "ear", { smooth = true })
		end
	end
	if o.faceWhite then
		-- the pale face disc (puffin)
		for _, side in { -1, 1 } do
			P(ctx, hp, "FacePatch", V3(0.12 * s, hs * 0.62, hs * 0.72), hc * CF(side * (hs * 0.45 + 0.02), -hs * 0.02, -hs * 0.1), Color3.fromRGB(236, 236, 230), "belly")
		end
	end
	if o.stripe then
		-- a dark band through the eye (osprey)
		for _, side in { -1, 1 } do
			P(ctx, hp, "EyeStripe", V3(0.1 * s, hs * 0.22, hs * 0.9), hc * CF(side * hs * 0.47, hs * 0.02, hs * 0.2), o.stripe, "mark")
		end
	end
	if o.crest then
		-- a plume of black feathers trailing back (heron)
		for k = 1, 3 do
			P(ctx, hp, "Crest", V3(0.12 * s, 0.12 * s, (0.5 + k * 0.25) * s), hc * CF((k - 2) * 0.08 * s, hs * 0.22 - k * 0.06 * s, hs * 0.55 + (0.25 + k * 0.12) * s) * ANG(0.25 + k * 0.08, 0, 0), o.crest, "mark")
		end
	end
	-- side eyes (round, glossy)
	for _, side in { -1, 1 } do
		local ec = hc * CF(side * (hs * 0.45 + 0.04), hs * 0.12, -hs * 0.12) * ANG(0, -side * PI / 2, 0) -- looks sideways
		eye(ctx, hp, ec, hs * 0.22, o.iris, c.head or c.fur)
	end
	-- upper beak
	local bk = o.beak
	local bl, bw, bh = bk.l * s, bk.w * s, bk.h * s
	local beakBase = hc * CF(0, -hs * 0.06, -hs * 0.55)
	if bk.curve then
		-- a long down-curved beak (ibis): 3 segments, each bent a little more
		local f = beakBase * CF(0, bh * 0.2, 0)
		for k = 1, 3 do
			f = f * ANG(-bk.curve / 3, 0, 0)
			P(ctx, hp, "Beak" .. k, V3(bw * (1 - k * 0.15), bh * (1 - k * 0.12), bl / 3 + 0.06 * s), f * CF(0, 0, -bl / 6), c.beak, "nose")
			f = f * CF(0, 0, -bl / 3)
		end
	else
		P(ctx, hp, "Beak", V3(bw, bh, bl), beakBase * CF(0, bh * 0.2, -bl / 2), c.beak, "nose")
		P(ctx, hp, "BeakRidge", V3(bw * 0.5, bh * 0.3, bl * 0.9), beakBase * CF(0, bh * 0.65, -bl * 0.48), Studs.shade(c.beak, 0.92), "nose")
	end
	if bk.bands then
		-- coloured bands across the beak (puffin)
		for k, col in bk.bands do
			P(ctx, hp, "BeakBand" .. k, V3(bw * 1.06, bh * 1.04, bl * 0.16), beakBase * CF(0, bh * 0.2, -bl * (0.14 + (k - 1) * 0.3)), col, "accent")
		end
	end
	if bk.hook then
		P(ctx, hp, "BeakHook", V3(bw * 0.6, bh * 0.75, 0.2 * s), beakBase * CF(0, -bh * 0.1, -bl - 0.02 * s), Studs.shade(c.beak, 0.75), "nose")
		P(ctx, hp, "Cere", V3(bw * 1.05, bh * 0.5, 0.2 * s), beakBase * CF(0, bh * 0.45, -0.05 * s), Color3.fromRGB(150, 150, 160), "nose")
	end
	if bk.tip then
		P(ctx, hp, "BeakTip", V3(bw * 0.8, bh * 0.6, 0.22 * s), beakBase * CF(0, bh * 0.25, -bl - 0.05 * s), bk.tip, "nose")
	end
	Studs.weldAll(head, hp)
	Studs.motor("Neck", torso, head, neckPivot)
	-- lower beak on the Jaw joint (the pelican's POUCH hangs from it)
	local jawPivot = beakBase * CF(0, -bh * 0.3, 0)
	limb(ctx, head, "Jaw", "JawBone", jawPivot, function(list)
		P(ctx, list, "LowerBeak", V3(bw * 0.92, bh * 0.45, (if bk.curve then bl * 0.4 else bl * 0.96)), jawPivot * CF(0, -bh * 0.2, -(if bk.curve then bl * 0.2 else bl * 0.48)), Studs.shade(c.beak, 0.88), "nose")
		P(ctx, list, "MouthIn", V3(bw * 0.7, 0.06, bl * 0.8), jawPivot * CF(0, 0.02, -bl * 0.45), MOUTH, "mouth", { smooth = true })
		if o.pouch then
			-- the big stretchy throat pouch, in stepped blocks
			P(ctx, list, "Pouch", V3(bw * 0.9, bh * 1.6, bl * 0.72), jawPivot * CF(0, -bh * 1.1, -bl * 0.46), o.pouch, "accent")
			P(ctx, list, "PouchLow", V3(bw * 0.7, bh * 0.8, bl * 0.46), jawPivot * CF(0, -bh * 2.1, -bl * 0.4), Studs.shade(o.pouch, 0.9), "accent")
		end
	end)
	mouth = jawPivot * CF(0, 0, -bl * 0.6)
	return W, H, L, legLen, headTop, mouth
end

------------------------------------------------------------------------------------------
-- PENGUIN: upright, black back, white front, flippers, waddle feet
------------------------------------------------------------------------------------------
local function buildPenguin(ctx, o)
	local s, c = ctx.s, ctx.c
	local W, H, D = o.body.w * s, o.body.h * s, o.body.l * s
	local legLen = 0.45 * s
	local by = legLen + H / 2
	local _, torso = rig(ctx, V3(W, H, D), by)
	local bc = CF(0, by, 0)
	local tp = {}
	P(ctx, tp, "Body", V3(W, H, D), bc, c.fur, "fur")
	P(ctx, tp, "BodyLow", V3(W * 1.06, H * 0.45, D * 1.04), bc * CF(0, -H * 0.22, 0), c.fur, "fur") -- pear shape
	P(ctx, tp, "Belly", V3(W * 0.8, H * 0.82, 0.3 * s), bc * CF(0, -H * 0.05, -D / 2 - 0.1 * s), c.belly, "belly")
	P(ctx, tp, "BellyLow", V3(W * 0.88, H * 0.38, 0.32 * s), bc * CF(0, -H * 0.26, -D * 0.52 - 0.12 * s), c.belly, "belly")
	if c.accent and o.chestBand then
		P(ctx, tp, "ChestBand", V3(W * 0.82, H * 0.1, 0.34 * s), bc * CF(0, H * 0.36, -D / 2 - 0.12 * s), c.accent, "accent")
	end
	Studs.weldAll(torso, tp)
	-- tail
	local tailPivot = bc * CF(0, -H * 0.42, D / 2)
	limb(ctx, torso, "Tail", "TailBone", tailPivot, function(list)
		P(ctx, list, "Tail", V3(W * 0.4, 0.22 * s, 0.5 * s), tailPivot * CF(0, -0.05 * s, 0.2 * s) * ANG(-0.3, 0, 0), c.fur, "fur")
	end)
	-- flippers
	for _, side in { -1, 1 } do
		local pivot = bc * CF(side * W / 2, H * 0.3, 0)
		limb(ctx, torso, if side < 0 then "WingL" else "WingR", if side < 0 then "WingBoneL" else "WingBoneR", pivot, function(list)
			P(ctx, list, "Flipper", V3(0.24 * s, H * 0.62, D * 0.5), pivot * CF(side * 0.12 * s, -H * 0.3, 0.05 * s) * ANG(0, 0, side * 0.12), c.fur, "fur")
			P(ctx, list, "FlipperEdge", V3(0.25 * s, H * 0.12, D * 0.4), pivot * CF(side * 0.2 * s, -H * 0.6, 0.05 * s), c.belly, "belly")
		end)
	end
	-- feet
	for _, side in { -1, 1 } do
		local pivot = CF(side * W * 0.24, legLen, -D * 0.05)
		limb(ctx, torso, if side < 0 then "LegBL" else "LegBR", if side < 0 then "LegBLBone" else "LegBRBone", pivot, function(list)
			P(ctx, list, "Leg", V3(0.36 * s, legLen, 0.36 * s), pivot * CF(0, -legLen / 2, 0), c.leg, "paw")
			P(ctx, list, "Foot", V3(0.7 * s, 0.22 * s, 0.85 * s), pivot * CF(0, -legLen + 0.11 * s, -0.3 * s), c.leg, "paw")
			for k = -1, 1 do
				P(ctx, list, "Toe", V3(0.18 * s, 0.18 * s, 0.3 * s), pivot * CF(k * 0.22 * s, -legLen + 0.09 * s, -0.78 * s), Studs.shade(c.leg, 0.9), "paw")
			end
		end)
	end
	-- head
	local hs = o.head * s * 1.12
	local neckPivot = bc * CF(0, H / 2, 0)
	local hc = neckPivot * CF(0, hs * 0.48, -0.05 * s)
	local head = Studs.bone(ctx.model, "Head", neckPivot)
	local hp = {}
	P(ctx, hp, "Skull", V3(hs * 1.05, hs, hs), hc, c.fur, "fur")
	P(ctx, hp, "Face", V3(hs * 0.8, hs * 0.5, 0.2 * s), hc * CF(0, -hs * 0.12, -hs / 2 - 0.05 * s), c.face or c.fur, "belly")
	if c.mark then
		-- the coloured patches (king / emperor) at the sides of the head
		for _, side in { -1, 1 } do
			P(ctx, hp, "EarPatch", V3(0.14 * s, hs * 0.5, hs * 0.4), hc * CF(side * hs * 0.53, -hs * 0.1, hs * 0.1), c.mark, "mark")
		end
	end
	for _, side in { -1, 1 } do
		local ec = hc * CF(side * hs * 0.26, hs * 0.14, -hs / 2 - 0.06 * s)
		P(ctx, hp, "EyeRing", V3(hs * 0.34, hs * 0.34, 0.06), ec * CF(0, 0, 0.03), WHITE, "belly", { smooth = true })
		eye(ctx, hp, ec * CF(0, 0, -0.02), hs * 0.13, nil, c.fur)
	end
	local bl = 0.62 * s
	local beakBase = hc * CF(0, -hs * 0.08, -hs / 2 - 0.05 * s)
	P(ctx, hp, "Beak", V3(0.36 * s, 0.22 * s, bl), beakBase * CF(0, 0.05 * s, -bl / 2), c.beak, "nose")
	P(ctx, hp, "BeakTip", V3(0.24 * s, 0.16 * s, 0.18 * s), beakBase * CF(0, 0.02 * s, -bl - 0.05 * s), Studs.shade(c.beak, 0.85), "nose")
	Studs.weldAll(head, hp)
	Studs.motor("Neck", torso, head, neckPivot)
	local jawPivot = beakBase * CF(0, -0.06 * s, 0)
	limb(ctx, head, "Jaw", "JawBone", jawPivot, function(list)
		P(ctx, list, "LowerBeak", V3(0.3 * s, 0.12 * s, bl * 0.9), jawPivot * CF(0, -0.05 * s, -bl * 0.45), Studs.shade(c.beak, 0.8), "nose")
	end)
	return W, H, D, legLen, hc.Position.Y + hs / 2, jawPivot * CF(0, 0, -bl * 0.6)
end

------------------------------------------------------------------------------------------
-- QUADRUPEDS: otter, raccoon, crocodile
------------------------------------------------------------------------------------------
--[[ o: body {w,h,l}, legLen, legT, sprawl (crocodile legs out to the sides), head {s, l (snout)},
        ears, tail {l, w, segs, rings}, mask, teeth, scutes, whiskers ]]
local function buildQuad(ctx, o)
	local s, c = ctx.s, ctx.c
	local W, H, L = o.body.w * s, o.body.h * s, o.body.l * s
	local legLen = o.legLen * s
	local legT = (o.legT or 0.6) * s
	local by = legLen + H * 0.45
	local _, torso = rig(ctx, V3(W, H, L), by)
	local bc = CF(0, by, 0)
	local tp = {}
	P(ctx, tp, "Body", V3(W, H, L), bc, c.fur, "fur")
	P(ctx, tp, "Back", V3(W * 0.86, H * 0.2, L * 0.9), bc * CF(0, H * 0.5, 0), c.fur2, "fur2")
	P(ctx, tp, "Belly", V3(W * 0.8, H * 0.24, L * 0.82), bc * CF(0, -H * 0.48, 0), c.belly, "belly")
	P(ctx, tp, "Shoulders", V3(W * 1.04, H * 0.84, L * 0.3), bc * CF(0, 0, -L * 0.34), Studs.shade(c.fur, 1.04), "fur")
	P(ctx, tp, "Hips", V3(W * 1.02, H * 0.9, L * 0.28), bc * CF(0, 0.02 * s, L * 0.36), c.fur2, "fur2")
	if o.scutes then
		-- crocodile armour: rows of raised studded scutes along the back
		local n = math.floor(L / (0.55 * s))
		for i = 0, n - 1 do
			for _, x in { -0.26, 0, 0.26 } do
				P(ctx, tp, "Scute", V3(0.3 * s, 0.22 * s, 0.4 * s), bc * CF(x * W, H * 0.62, -L / 2 + (i + 0.5) * L / n), Studs.shade(c.fur2, if x == 0 then 0.85 else 1), "fur2")
			end
		end
	end
	if c.mark and o.chestMark then
		P(ctx, tp, "ChestMark", V3(W * 0.6, H * 0.5, 0.2 * s), bc * CF(0, -H * 0.08, -L / 2 - 0.08 * s), c.mark, "mark")
	end
	-- fur volume: a ruff on the chest, stepped shoulder blocks
	P(ctx, tp, "ChestRuff", V3(W * 0.7, H * 0.55, 0.3 * s), bc * CF(0, -H * 0.1, -L / 2 - 0.12 * s), c.belly, "belly")
	for _, side in { -1, 1 } do
		P(ctx, tp, "ShoulderStep", V3(0.2 * s, H * 0.5, L * 0.22), bc * CF(side * (W * 0.52 + 0.08 * s), H * 0.05, -L * 0.3), Studs.shade(c.fur, 0.96), "fur")
		P(ctx, tp, "HipStep", V3(0.2 * s, H * 0.5, L * 0.22), bc * CF(side * (W * 0.51 + 0.08 * s), H * 0.05, L * 0.33), Studs.shade(c.fur2, 0.96), "fur2")
	end
	if o.shell then
		-- TURTLE: a stepped dome of plates, with the darker plate seams and a rim
		local sc = o.shell
		P(ctx, tp, "ShellRim", V3(W * 1.18, H * 0.2, L * 1.12), bc * CF(0, H * 0.18, 0), Studs.shade(sc, 0.8), "mark")
		for k = 0, 3 do
			local kk = 1 - k * 0.2
			P(ctx, tp, "Shell" .. k, V3(W * 1.1 * kk, H * 0.28, L * 1.04 * kk), bc * CF(0, H * 0.36 + k * H * 0.24, 0), Studs.shade(sc, 1 - k * 0.04), "accent")
		end
		for i = -1, 1 do
			for j = -1, 1 do
				P(ctx, tp, "Scute", V3(W * 0.22, 0.08 * s, L * 0.2), bc * CF(i * W * 0.3, H * 0.64 + (1 - math.abs(i)) * H * 0.26, j * L * 0.3), Studs.shade(sc, 1.15), "accent")
			end
		end
		P(ctx, tp, "Plastron", V3(W * 0.95, H * 0.14, L * 0.95), bc * CF(0, -H * 0.42, 0), c.belly, "belly")
	end
	if o.spots then
		-- spots / rosettes (jaguar, fishing cat, leopard seal...) on the back and both flanks
		local rnd = Random.new(#ctx.id * 13 + 7)
		for _ = 1, o.spotN or 18 do
			local side = rnd:NextInteger(-1, 1)
			local z = (rnd:NextNumber() - 0.5) * L * 0.85
			local sz = (0.22 + rnd:NextNumber() * 0.16) * s
			if side == 0 then
				P(ctx, tp, "Spot", V3(sz * 1.2, 0.06, sz), bc * CF((rnd:NextNumber() - 0.5) * W * 0.6, H / 2 + 0.03, z), o.spots, "mark", { smooth = true })
			else
				P(ctx, tp, "Spot", V3(0.06, sz, sz * 1.2), bc * CF(side * (W / 2 + 0.03), (rnd:NextNumber() - 0.3) * H * 0.6, z), o.spots, "mark", { smooth = true })
			end
		end
	end
	if o.stripes then
		-- tabby stripes across the back and down the flanks
		for k = 0, 4 do
			local z = -L * 0.32 + k * L * 0.16
			P(ctx, tp, "Stripe", V3(W * 1.02, H * 0.12, 0.18 * s), bc * CF(0, H * 0.42, z), o.stripes, "mark")
			for _, side in { -1, 1 } do
				P(ctx, tp, "StripeSide", V3(0.05, H * 0.5, 0.18 * s), bc * CF(side * (W / 2 + 0.03), H * 0.1, z), o.stripes, "mark", { smooth = true })
			end
		end
	end
	Studs.weldAll(torso, tp)

	-- legs + paws
	local sprawl = o.sprawl or 0
	for _, def in { { "LegFL", -1, -1 }, { "LegFR", 1, -1 }, { "LegBL", -1, 1 }, { "LegBR", 1, 1 } } do
		local name, side, fb = def[1], def[2], def[3]
		local pivot = CF(side * (W * 0.32 + sprawl * W * 0.25), legLen + H * 0.1, fb * L * 0.34)
		limb(ctx, torso, name, name .. "Bone", pivot, function(list)
			local up = legLen + H * 0.1
			if sprawl > 0 then
				-- a sprawled leg: upper leg out to the side, forearm down, splayed foot
				local outL = W * 0.3 * sprawl
				P(ctx, list, "UpperLeg", V3(outL + legT, legT, legT * 1.1), pivot * CF(side * outL / 2, 0, 0), c.fur, "fur")
				P(ctx, list, "Leg", V3(legT, up, legT), pivot * CF(side * outL, -up / 2, 0), c.fur, "fur")
				P(ctx, list, "Foot", V3(legT * 1.5, 0.22 * s, legT * 1.8), pivot * CF(side * outL, -up + 0.11 * s, -legT * 0.35), c.paw, "paw")
				for k = -1, 1 do
					P(ctx, list, "Claw", V3(legT * 0.22, 0.12 * s, 0.3 * s), pivot * CF(side * outL + k * legT * 0.45, -up + 0.06 * s, -legT * 1.25 - 0.1 * s), c.claw, "claw", { smooth = true })
				end
			else
				P(ctx, list, "Leg", V3(legT, up, legT), pivot * CF(0, -up / 2, 0), c.paw2 or c.fur, "fur")
				P(ctx, list, "Paw", V3(legT * 1.15, 0.3 * s, legT * 1.35), pivot * CF(0, -up + 0.15 * s, -legT * 0.12), c.paw, "paw")
				for k = -1, 1 do
					P(ctx, list, "Claw", V3(legT * 0.18, 0.1 * s, 0.16 * s), pivot * CF(k * legT * 0.32, -up + 0.06 * s, -legT * 0.8), c.claw, "claw", { smooth = true })
				end
			end
		end)
	end

	-- tail: segments (bushy ringed raccoon, thick tapered otter / crocodile)
	local tl = o.tail.l * s
	local segs = o.tail.segs or 3
	local tailPivot = bc * CF(0, H * 0.08, L / 2)
	limb(ctx, torso, "Tail", "TailBone", tailPivot, function(list)
		local w0 = o.tail.w * s
		for i = 1, segs do
			local k = (i - 1) / segs
			local w = w0 * (1 - k * (o.tail.taper or 0.55))
			local col = if o.tail.rings and i % 2 == 0 then o.tail.rings else (if i == segs and o.tail.tip then o.tail.tip else c.fur)
			P(ctx, list, "Tail" .. i, V3(w, w * (o.tail.flat or 0.85), tl / segs + 0.05 * s), tailPivot * ANG(o.tail.droop or -0.1, 0, 0) * CF(0, -k * tl * (o.tail.fall or 0.08), (i - 0.5) * tl / segs), col, if col == c.fur then "fur" else "mark")
			if o.scutes then
				P(ctx, list, "TailScute", V3(0.18 * s, 0.24 * s, tl / segs * 0.6), tailPivot * ANG(o.tail.droop or -0.1, 0, 0) * CF(0, -k * tl * 0.08 + w * 0.45, (i - 0.5) * tl / segs), Studs.shade(c.fur2, 0.85), "fur2")
			end
		end
	end)

	-- head
	local hs = o.head.s * s
	local sl = (o.head.l or 0.5) * s
	local neckPivot = bc * CF(0, H * 0.15, -L / 2)
	local hc = neckPivot * CF(0, o.head.up or 0.1 * s, -hs * 0.42)
	local head = Studs.bone(ctx.model, "Head", neckPivot)
	local hp = {}
	local hw, hh, hd = hs, hs * (o.head.flat or 0.82), hs * 0.9
	P(ctx, hp, "Skull", V3(hw, hh, hd), hc, c.fur, "fur")
	P(ctx, hp, "Crown", V3(hw * 0.7, hs * 0.1, hd * 0.6), hc * CF(0, hh / 2 + hs * 0.04, hd * 0.05), c.fur2, "fur2")
	for _, side in { -1, 1 } do
		P(ctx, hp, "Cheek", V3(hs * 0.08, hh * 0.34, hd * 0.4), hc * CF(side * (hw / 2 + hs * 0.03), -hh * 0.22, -hd * 0.12), c.cheek or c.fur2, "fur2")
	end
	if o.mask then
		-- raccoon bandit mask + white brows
		for _, side in { -1, 1 } do
			P(ctx, hp, "Mask", V3(hs * 0.42, hs * 0.26, 0.08), hc * CF(side * hs * 0.22, hs * 0.04, -hd / 2 - 0.02), o.mask, "patch", { smooth = true })
			P(ctx, hp, "Brow", V3(hs * 0.36, hs * 0.08, 0.1), hc * CF(side * hs * 0.22, hs * 0.22, -hd / 2 - 0.03), WHITE, "belly")
		end
	end
	local eyeY = if o.eyesTop then hh / 2 + hs * 0.06 else hs * 0.06
	for _, side in { -1, 1 } do
		if o.eyesTop then
			-- crocodile eyes on raised bumps
			P(ctx, hp, "EyeBump", V3(hs * 0.3, hs * 0.18, hs * 0.3), hc * CF(side * hs * 0.24, hh / 2, -hd * 0.05), c.fur2, "fur2")
			eye(ctx, hp, hc * CF(side * hs * 0.24, eyeY, -hd * 0.05 - hs * 0.16), hs * 0.1, o.iris, c.fur2)
		else
			eye(ctx, hp, hc * CF(side * hs * 0.22, eyeY, -hd / 2 - 0.05), hs * 0.13, o.iris, c.fur)
		end
	end
	-- snout (upper) + nose
	local mW, mH = hs * (o.head.snoutW or 0.5), hs * (o.head.snoutH or 0.28)
	local mY = -hs * 0.14
	local mZ = -hd / 2 - sl / 2 + 0.05 * s
	P(ctx, hp, "Snout", V3(mW, mH, sl), hc * CF(0, mY, mZ), c.muzzle, "muzzle")
	local tipZ = mZ - sl / 2
	P(ctx, hp, "Nose", V3(mW * 0.5, mH * 0.5, 0.16 * s), hc * CF(0, mY + mH * 0.25, tipZ - 0.04 * s), c.nose, "nose", { smooth = true })
	if o.tongue then
		-- a forked tongue flicking out (snakes, monitors)
		P(ctx, hp, "Tongue", V3(0.08 * s, 0.04 * s, 0.5 * s), hc * CF(0, mY - mH * 0.3, tipZ - 0.22 * s), Color3.fromRGB(220, 50, 70), "tongue", { smooth = true })
		for _, side in { -1, 1 } do
			P(ctx, hp, "TongueFork", V3(0.06 * s, 0.04 * s, 0.2 * s), hc * CF(side * 0.05 * s, mY - mH * 0.3, tipZ - 0.52 * s) * ANG(0, side * 0.4, 0), Color3.fromRGB(220, 50, 70), "tongue", { smooth = true })
		end
	end
	if o.buckTeeth then
		-- the beaver's big orange incisors
		P(ctx, hp, "BuckTeeth", V3(mW * 0.5, mH * 0.7, 0.12 * s), hc * CF(0, mY - mH * 0.55, tipZ + 0.1 * s), Color3.fromRGB(240, 140, 40), "teeth", { smooth = true })
	end
	if o.ruff then
		-- cheek ruff (lynx)
		for _, side in { -1, 1 } do
			P(ctx, hp, "Ruff", V3(hs * 0.14, hh * 0.42, hd * 0.36), hc * CF(side * (hw / 2 + hs * 0.06), -hh * 0.32, hd * 0.02) * ANG(0, 0, side * 0.35), c.belly, "belly")
		end
	end
	if o.whiskers then
		for _, side in { -1, 1 } do
			for k = 0, 1 do
				P(ctx, hp, "Whisker", V3(0.5 * s, 0.04, 0.04), hc * CF(side * (mW / 2 + 0.22 * s), mY + k * 0.08 * s, tipZ + 0.2 * s) * ANG(0, side * (0.2 - k * 0.3), 0), WHITE, "pupil", { smooth = true })
			end
		end
	end
	if o.teeth then
		-- a row of teeth along the upper jaw, visible even mouth closed (crocodile grin)
		local n = math.floor(sl / (0.3 * s))
		for i = 0, n - 1 do
			for _, side in { -1, 1 } do
				P(ctx, hp, "Tooth", V3(0.08 * s, 0.16 * s, 0.08 * s), hc * CF(side * mW * 0.46, mY - mH / 2 - 0.06 * s, tipZ + 0.2 * s + i * 0.3 * s), TOOTH, "teeth", { smooth = true })
			end
		end
	end
	-- ears
	Studs.weldAll(head, hp)
	Studs.motor("Neck", torso, head, neckPivot)
	if o.ears then
		for _, side in { -1, 1 } do
			local pivot = hc * CF(side * hw * 0.34, hh / 2, hd * 0.1)
			limb(ctx, head, if side > 0 then "EarR" else "EarL", if side > 0 then "EarBoneR" else "EarBoneL", pivot, function(list)
				local e = o.ears * s
				P(ctx, list, "Ear", V3(e, e * 1.1, e * 0.4), pivot * CF(0, e * 0.5, 0), c.ear or c.fur, "fur")
				P(ctx, list, "EarInner", V3(e * 0.5, e * 0.6, 0.06), pivot * CF(0, e * 0.45, -e * 0.21), c.earIn or c.muzzle, "ear", { smooth = true })
				if o.pointy then
					P(ctx, list, "EarTip", V3(e * 0.55, e * 0.45, e * 0.32), pivot * CF(0, e * 1.25, 0), c.earTip or c.ear or c.fur, "fur")
				end
				if o.tufts then
					P(ctx, list, "Tuft", V3(e * 0.18, e * 0.7, e * 0.18), pivot * CF(0, e * 1.45, 0), Color3.fromRGB(30, 26, 26), "mark")
				end
			end)
		end
	end
	local jawPivot = hc * CF(0, mY - mH / 2, -hd / 2 + 0.1 * s)
	limb(ctx, head, "Jaw", "JawBone", jawPivot, function(list)
		P(ctx, list, "Jaw", V3(mW * 0.9, mH * 0.5, sl * 0.95), jawPivot * CF(0, -mH * 0.25, -sl * 0.5), Studs.shade(c.muzzle, 0.9), "muzzle")
		P(ctx, list, "MouthIn", V3(mW * 0.7, 0.06, sl * 0.8), jawPivot * CF(0, 0.02, -sl * 0.5), MOUTH, "mouth", { smooth = true })
		if o.teeth then
			local n = math.floor(sl / (0.3 * s))
			for i = 0, n - 1 do
				for _, side in { -1, 1 } do
					P(ctx, list, "ToothL", V3(0.07 * s, 0.14 * s, 0.07 * s), jawPivot * CF(side * mW * 0.4, 0.04 * s, -0.25 * s - i * 0.3 * s), TOOTH, "teeth", { smooth = true })
				end
			end
		end
	end)
	return W, H, L, legLen, hc.Position.Y + hh / 2 + (o.ears or 0) * s, jawPivot * CF(0, 0, -sl * 0.6)
end

------------------------------------------------------------------------------------------
-- SWIMMERS: seal, orca (lying on their belly; no legs)
------------------------------------------------------------------------------------------
local function buildSwimmer(ctx, o)
	local s, c = ctx.s, ctx.c
	local W, H, L = o.body.w * s, o.body.h * s, o.body.l * s
	local by = H / 2
	local _, torso = rig(ctx, V3(W, H, L), by)
	local bc = CF(0, by, 0)
	local tp = {}
	-- a rounded torpedo out of stepped blocks
	P(ctx, tp, "Body", V3(W, H, L * 0.6), bc, c.fur, "fur")
	P(ctx, tp, "BodyFront", V3(W * 0.9, H * 0.9, L * 0.24), bc * CF(0, -H * 0.03, -L * 0.36), c.fur, "fur")
	P(ctx, tp, "BodyRear", V3(W * 0.78, H * 0.78, L * 0.22), bc * CF(0, -H * 0.08, L * 0.38), c.fur2, "fur2")
	P(ctx, tp, "BodyTop", V3(W * 0.78, H * 0.14, L * 0.7), bc * CF(0, H * 0.53, -L * 0.02), c.fur2, "fur2")
	P(ctx, tp, "Belly", V3(W * 0.84, H * 0.22, L * 0.74), bc * CF(0, -H * 0.42, -L * 0.04), c.belly, "belly")
	if o.spots then
		-- seal speckles
		local r = Random.new(#ctx.id * 7)
		for _ = 1, 12 do
			local side = if r:NextNumber() < 0.5 then -1 else 1
			P(ctx, tp, "Spot", V3(0.06, 0.22 * s, 0.26 * s), bc * CF(side * (W / 2 + 0.02), (r:NextNumber() - 0.2) * H * 0.6, (r:NextNumber() - 0.5) * L * 0.7), o.spots, "mark", { smooth = true })
		end
	end
	if o.saddle then
		-- the orca's grey saddle behind the fin + the white flank patch
		P(ctx, tp, "Saddle", V3(W * 0.82, H * 0.1, L * 0.22), bc * CF(0, H * 0.6, L * 0.14), o.saddle, "mark")
		for _, side in { -1, 1 } do
			P(ctx, tp, "Flank", V3(0.1 * s, H * 0.36, L * 0.26), bc * CF(side * (W / 2 + 0.04), -H * 0.16, L * 0.2), c.belly, "belly")
		end
	end
	if o.dorsal then
		-- the dorsal fin, stepped (tall: orca, swept back: sharks)
		local fh = o.dorsal * s
		for k = 0, 3 do
			local ch = fh * (1 - k * 0.22)
			P(ctx, tp, "Dorsal" .. k, V3(0.34 * s, ch, (0.9 - k * 0.18) * s), bc * CF(0, H / 2 + ch / 2, -L * 0.02 + k * 0.32 * s), c.fur, "fur")
		end
	end
	Studs.weldAll(torso, tp)
	-- front flippers (seal: LegFL / LegFR, they help to "walk"; orca: pectoral fins WingL / WingR)
	for _, side in { -1, 1 } do
		local pivot = bc * CF(side * W * 0.42, -H * 0.2, -L * 0.18)
		local joint = if o.orca then (if side < 0 then "WingL" else "WingR") else (if side < 0 then "LegFL" else "LegFR")
		limb(ctx, torso, joint, joint .. "Bone", pivot, function(list)
			local fl = o.flipper * s
			P(ctx, list, "Flipper", V3(fl, 0.24 * s, fl * 0.7), pivot * CF(side * fl * 0.45, -0.1 * s, 0.1 * s) * ANG(0, side * 0.35, side * -0.35), c.flipper or c.fur2, "fur2")
			if not o.orca then
				for k = -1, 1 do
					P(ctx, list, "Nail", V3(0.08 * s, 0.08 * s, 0.14 * s), pivot * CF(side * fl * 0.75 + k * 0.12 * s, -0.12 * s, -0.1 * s), BLACK, "claw", { smooth = true })
				end
			end
		end)
	end
	-- tail: rear flippers fan (seal) / horizontal fluke (orca)
	local tailPivot = bc * CF(0, -H * 0.1, L / 2)
	limb(ctx, torso, "Tail", "TailBone", tailPivot, function(list)
		local tl = o.tailL * s
		P(ctx, list, "TailStock", V3(W * 0.45, H * 0.42, tl * 0.5), tailPivot * CF(0, 0, tl * 0.25), c.fur2, "fur2")
		if o.fishTail then
			-- a vertical tail fin (sharks, barracuda, pike): upper lobe bigger, swept back
			P(ctx, list, "TailUpper", V3(0.3 * s, H * 0.75, tl * 0.4), tailPivot * CF(0, H * 0.32, tl * 0.62) * ANG(-0.5, 0, 0), c.fur, "fur")
			P(ctx, list, "TailLower", V3(0.3 * s, H * 0.5, tl * 0.34), tailPivot * CF(0, -H * 0.2, tl * 0.58) * ANG(0.5, 0, 0), c.fur2, "fur2")
		elseif o.orca then
			for _, side in { -1, 1 } do
				P(ctx, list, "Fluke", V3(W * 0.62, 0.3 * s, tl * 0.45), tailPivot * CF(side * W * 0.28, 0, tl * 0.62) * ANG(0, side * -0.4, 0), c.fur, "fur")
			end
		else
			for _, side in { -1, 1 } do
				P(ctx, list, "RearFlipper", V3(W * 0.3, 0.2 * s, tl * 0.6), tailPivot * CF(side * W * 0.16, -H * 0.12, tl * 0.75) * ANG(0, side * -0.45, 0), c.flipper or c.fur2, "fur2")
			end
		end
	end)
	-- head
	local hs = o.head * s
	local neckPivot = bc * CF(0, H * 0.1, -L * 0.48)
	local head = Studs.bone(ctx.model, "Head", neckPivot)
	local hp = {}
	local hc
	if o.orca then
		-- the orca's head is the rounded front of the body (melon) + the white eye patch
		hc = neckPivot * CF(0, -H * 0.05, -hs * 0.45)
		P(ctx, hp, "Melon", V3(W * 0.86, H * 0.78, hs), hc, c.fur, "fur")
		P(ctx, hp, "Snout", V3(W * 0.66, H * 0.5, hs * 0.34), hc * CF(0, -H * 0.06, -hs * 0.6), c.fur, "fur")
		if o.hammer then
			-- the hammerhead's wide flat head, an eye at each end
			P(ctx, hp, "Hammer", V3(W * 2.2, H * 0.3, hs * 0.5), hc * CF(0, H * 0.02, -hs * 0.45), c.fur, "fur")
			for _, side in { -1, 1 } do
				eye(ctx, hp, hc * CF(side * W * 1.1, H * 0.02, -hs * 0.45) * ANG(0, -side * PI / 2, 0), H * 0.08, nil, c.fur)
			end
		end
		if o.gills then
			for _, side in { -1, 1 } do
				for k = 0, 4 do
					P(ctx, hp, "Gill", V3(0.05, H * 0.36, 0.1 * s), hc * CF(side * (W * 0.43 + 0.04), -H * 0.04, hs * 0.2 + k * 0.22 * s), Studs.shade(c.fur, 0.7), "mark", { smooth = true })
				end
			end
		end
		if o.rostrum then
			-- the dolphin's beak
			P(ctx, hp, "Rostrum", V3(W * 0.34, H * 0.2, o.rostrum * s), hc * CF(0, -H * 0.2, -hs * 0.75 - o.rostrum * s / 2), c.fur, "fur")
		end
		P(ctx, hp, "Chin", V3(W * 0.6, H * 0.12, hs * 0.9), hc * CF(0, -H * 0.38, -hs * 0.08), c.belly, "belly")
		for _, side in { -1, 1 } do
			if o.eyePatch ~= false then
				P(ctx, hp, "EyePatch", V3(0.1 * s, H * 0.22, hs * 0.55), hc * CF(side * (W * 0.43 + 0.03), H * 0.08, hs * 0.34), c.belly, "belly")
			end
			eye(ctx, hp, hc * CF(side * (W * 0.43 + 0.05), -H * 0.04, hs * 0.02) * ANG(0, -side * PI / 2, 0), H * 0.07, nil, c.fur)
		end
	else
		hc = neckPivot * CF(0, H * 0.25 + (o.headUp or 0) * s, -hs * 0.42)
		P(ctx, hp, "Skull", V3(hs, hs * 0.9, hs * 0.95), hc, c.fur, "fur")
		P(ctx, hp, "Crown", V3(hs * 0.7, hs * 0.12, hs * 0.7), hc * CF(0, hs * 0.48, 0.02), c.fur2, "fur2")
		P(ctx, hp, "Snout", V3(hs * 0.62, hs * 0.38, hs * 0.38), hc * CF(0, -hs * 0.18, -hs * 0.6), c.muzzle, "muzzle")
		P(ctx, hp, "Nose", V3(hs * 0.3, hs * 0.14, hs * 0.1), hc * CF(0, -hs * 0.04, -hs * 0.8), c.nose, "nose", { smooth = true })
		if o.trunk then
			-- the elephant seal's inflatable nose, drooping over the mouth
			P(ctx, hp, "Trunk", V3(hs * 0.42, hs * 0.3, hs * 0.4), hc * CF(0, -hs * 0.02, -hs * 0.86), c.muzzle, "muzzle")
			P(ctx, hp, "TrunkTip", V3(hs * 0.36, hs * 0.4, hs * 0.22), hc * CF(0, -hs * 0.3, -hs * 1.02), Studs.shade(c.muzzle, 0.9), "muzzle")
		end
		if o.tusks then
			-- walrus: a bristly moustache pad + two long ivory tusks
			P(ctx, hp, "WhiskerPad", V3(hs * 0.78, hs * 0.34, hs * 0.3), hc * CF(0, -hs * 0.28, -hs * 0.7), c.muzzle, "muzzle")
			for _, side in { -1, 1 } do
				P(ctx, hp, "Tusk", V3(0.18 * s, o.tusks * s, 0.18 * s), hc * CF(side * hs * 0.18, -hs * 0.45 - o.tusks * s / 2, -hs * 0.72), Color3.fromRGB(250, 244, 224), "teeth")
			end
		end
		if o.earFlaps then
			for _, side in { -1, 1 } do
				P(ctx, hp, "EarFlap", V3(0.1 * s, hs * 0.16, hs * 0.14), hc * CF(side * hs * 0.51, hs * 0.12, hs * 0.12), c.fur2, "fur2")
			end
		end
		for _, side in { -1, 1 } do
			eye(ctx, hp, hc * CF(side * hs * 0.25, hs * 0.1, -hs * 0.5), hs * 0.17, nil, c.fur)
			for k = 0, 2 do
				P(ctx, hp, "Whisker", V3(0.6 * s, 0.04, 0.04), hc * CF(side * hs * 0.48, -hs * 0.18 + k * 0.06 * s, -hs * 0.66) * ANG(0, side * (0.25 - k * 0.2), side * (k - 1) * 0.15), WHITE, "pupil", { smooth = true })
			end
		end
	end
	Studs.weldAll(head, hp)
	Studs.motor("Neck", torso, head, neckPivot)
	local jawPivot = if o.orca then hc * CF(0, -H * 0.2, -hs * 0.2) else hc * CF(0, -hs * 0.3, -hs * 0.35)
	limb(ctx, head, "Jaw", "JawBone", jawPivot, function(list)
		local jl = if o.orca then hs * 0.7 else hs * 0.4
		local jw = if o.orca then W * 0.58 else hs * 0.5
		P(ctx, list, "Jaw", V3(jw, 0.2 * s, jl), jawPivot * CF(0, -0.1 * s, -jl / 2), if o.orca then c.belly else c.muzzle, "muzzle")
		P(ctx, list, "MouthIn", V3(jw * 0.8, 0.06, jl * 0.8), jawPivot * CF(0, 0.02, -jl / 2), MOUTH, "mouth", { smooth = true })
		if o.orca then
			for i = 0, (if o.teeth then 5 else 3) do
				for _, side in { -1, 1 } do
					P(ctx, list, "Tooth", V3(0.12 * s, 0.18 * s, 0.12 * s), jawPivot * CF(side * jw * 0.4, 0.08 * s, -jl * 0.2 - i * jl * 0.2), TOOTH, "teeth", { smooth = true })
				end
			end
		end
	end)
	return W, H, L, 0, hc.Position.Y + hs * 0.5, jawPivot * CF(0, 0, -hs * 0.3)
end

------------------------------------------------------------------------------------------
-- SERPENTS: water snake, moray, electric eel. A chain of 3 tail joints (Tail, Tail2, Tail3)
-- so the body really waves in an S.
------------------------------------------------------------------------------------------
local function buildSerpent(ctx, o)
	local s, c = ctx.s, ctx.c
	local W, H, L = o.body.w * s, o.body.h * s, o.body.l * s
	local by = H / 2
	local _, torso = rig(ctx, V3(W, H, L * 0.3), by)
	local segL = L / 10
	local function segment(list, base: CFrame, i: number, k: number)
		-- one body segment: back, belly, a band / spot pattern, a ribbon fin
		local w, h = W * k, H * k
		local cf = base * CF(0, 0, (i + 0.5) * segL)
		P(ctx, list, "Seg", V3(w, h, segL + 0.06 * s), cf, if o.bands and i % 2 == 0 then o.bands else c.fur, if o.bands and i % 2 == 0 then "mark" else "fur")
		P(ctx, list, "SegBelly", V3(w * 0.8, h * 0.2, segL), cf * CF(0, -h * 0.45, 0), c.belly, "belly")
		P(ctx, list, "SegBack", V3(w * 0.6, h * 0.12, segL * 0.8), cf * CF(0, h * 0.55, 0), c.fur2, "fur2")
		if o.spots and i % 2 == 1 then
			for _, side in { -1, 1 } do
				P(ctx, list, "Spot", V3(0.05, h * 0.3, segL * 0.4), cf * CF(side * (w / 2 + 0.03), h * 0.1, 0), o.spots, "mark", { smooth = true })
			end
		end
		if o.ribbon then
			P(ctx, list, "Ribbon", V3(0.12 * s, h * 0.35, segL), cf * CF(0, (if o.ribbonTop then h * 0.62 else -h * 0.62), 0), o.ribbon, "fur2")
		end
	end
	-- torso: 3 segments around the middle-front
	local tp = {}
	local base = CF(0, by, -1.5 * segL)
	for i = 0, 2 do segment(tp, base, i, 1) end
	Studs.weldAll(torso, tp)
	-- tail chain
	local parent = torso
	local z = 1.5 * segL
	for j, name in { "Tail", "Tail2", "Tail3" } do
		local pivot = CF(0, by, z)
		local n = if j == 3 then 3 else 2
		parent = limb(ctx, parent, name, name .. "Bone", pivot, function(list)
			for i = 0, n - 1 do
				local k = 1 - ((j - 1) * 2 + i) * 0.11
				segment(list, pivot * CF(0, -H * (1 - k) * 0.5, 0), i - 0, k)
			end
			if j == 3 then
				P(ctx, list, "TailTip", V3(W * 0.2, H * 0.22, segL), pivot * CF(0, -H * 0.38, (n + 0.5) * segL), c.fur2, "fur2")
			end
		end)
		z += n * segL
	end
	-- head (raised a little, looking ahead)
	local hs = o.head * s
	local neckPivot = CF(0, by, -1.5 * segL)
	local hc = neckPivot * CF(0, H * 0.15, -hs * 0.55)
	local head = Studs.bone(ctx.model, "Head", neckPivot)
	local hp = {}
	P(ctx, hp, "Neck", V3(W * 0.9, H * 0.9, hs * 0.5), neckPivot * CF(0, 0, -hs * 0.2), c.fur, "fur")
	P(ctx, hp, "Skull", V3(hs * 0.95, hs * 0.62, hs * 1.15), hc, c.fur, "fur")
	P(ctx, hp, "Snout", V3(hs * 0.7, hs * 0.42, hs * 0.5), hc * CF(0, -hs * 0.06, -hs * 0.75), c.muzzle, "muzzle")
	P(ctx, hp, "Brow", V3(hs * 0.8, hs * 0.12, hs * 0.5), hc * CF(0, hs * 0.34, -hs * 0.2), c.fur2, "fur2")
	for _, side in { -1, 1 } do
		eye(ctx, hp, hc * CF(side * hs * 0.36, hs * 0.22, -hs * 0.42) * ANG(0, -side * 0.6, 0), hs * 0.14, o.iris, c.fur)
		P(ctx, hp, "Nostril", V3(0.08 * s, 0.08 * s, 0.06), hc * CF(side * hs * 0.16, hs * 0.08, -hs * 1.0), BLACK, "nose", { smooth = true })
	end
	if o.tongue then
		P(ctx, hp, "Tongue", V3(0.08 * s, 0.04 * s, 0.5 * s), hc * CF(0, -hs * 0.2, -hs * 1.15), Color3.fromRGB(220, 50, 70), "tongue", { smooth = true })
		for _, side in { -1, 1 } do
			P(ctx, hp, "TongueFork", V3(0.06 * s, 0.04 * s, 0.2 * s), hc * CF(side * 0.05 * s, -hs * 0.2, -hs * 1.45) * ANG(0, side * 0.4, 0), Color3.fromRGB(220, 50, 70), "tongue", { smooth = true })
		end
	end
	Studs.weldAll(head, hp)
	Studs.motor("Neck", torso, head, neckPivot)
	local jawPivot = hc * CF(0, -hs * 0.26, -hs * 0.1)
	limb(ctx, head, "Jaw", "JawBone", jawPivot, function(list)
		P(ctx, list, "Jaw", V3(hs * 0.62, hs * 0.18, hs * 1.0), jawPivot * CF(0, -hs * 0.08, -hs * 0.5), c.belly, "muzzle")
		P(ctx, list, "MouthIn", V3(hs * 0.5, 0.06, hs * 0.85), jawPivot * CF(0, 0.02, -hs * 0.5), MOUTH, "mouth", { smooth = true })
		if o.teeth then
			for i = 0, 3 do
				for _, side in { -1, 1 } do
					P(ctx, list, "Tooth", V3(0.08 * s, 0.18 * s, 0.08 * s), jawPivot * CF(side * hs * 0.24, 0.08 * s, -hs * 0.2 - i * hs * 0.22), TOOTH, "teeth", { smooth = true })
				end
			end
		end
	end)
	return W, H, L, 0, hc.Position.Y + hs * 0.4, jawPivot * CF(0, 0, -hs * 0.6)
end

------------------------------------------------------------------------------------------
-- TENTACLES: octopus (sits on its arms), giant squid (long mantle, two long tentacles),
-- jellyfish (a floating bell with hanging tentacles). Arms grouped on 4 joints
-- (LegFL / LegFR / LegBL / LegBR), squid tentacles on WingL / WingR.
------------------------------------------------------------------------------------------
local function buildTentacle(ctx, o)
	local s, c = ctx.s, ctx.c
	local kind = o.kind
	local R = o.body.w * s / 2
	local armL = o.armL * s
	local by = if kind == "jelly" then armL + R * 0.4 else R * 0.9
	local _, torso = rig(ctx, V3(R * 2, R * 1.6, R * 2), by)
	local bc = CF(0, by, 0)
	local tp = {}
	if kind == "jelly" then
		-- the BELL: stepped translucent dome, a frilly rim, inner pattern
		for k = 0, 3 do
			local kk = 1 - k * 0.22
			local p = P(ctx, tp, "Bell" .. k, V3(R * 2 * kk, R * 0.32, R * 2 * kk), bc * CF(0, k * R * 0.3, 0), Studs.shade(c.fur, 1 + k * 0.04), "fur")
			p.Transparency = 0.25
		end
		for i = 0, 11 do
			local a = i / 12 * math.pi * 2
			P(ctx, tp, "Frill", V3(R * 0.5, R * 0.16, R * 0.2), bc * ANG(0, a, 0) * CF(0, -R * 0.18, -R * 0.98), c.fur2, "fur2")
		end
		P(ctx, tp, "Pattern", V3(R * 0.9, 0.08 * s, R * 0.9), bc * CF(0, R * 0.92, 0), c.mark or c.fur2, "mark")
	else
		-- the MANTLE (octopus: a big rounded sack behind the head; squid: a long torpedo)
		local ml = if kind == "squid" then R * 4 else R * 1.8
		local mc = if kind == "squid" then bc * CF(0, R * 0.2, R * 1.6) else bc * CF(0, R * 0.9, R * 0.5) * ANG(0.45, 0, 0)
		if kind == "squid" then
			for k = 0, 2 do
				local kk = 1 - k * 0.18
				P(ctx, tp, "Mantle" .. k, V3(R * 1.7 * kk, R * 1.6 * kk, ml * (1 - k * 0.12)), mc * CF(0, k * R * 0.12, k * ml * 0.08), Studs.shade(c.fur, 1 - k * 0.05), "fur")
			end
		else
			-- octopus: a soft stepped dome (wide base, narrower rings, rounded top)
			local layers = { { 1.7, 0.55 }, { 1.85, 0.5 }, { 1.7, 0.45 }, { 1.4, 0.4 }, { 1.0, 0.3 } }
			local y = 0
			for k, l in layers do
				local w = R * l[1]
				local h = R * l[2]
				P(ctx, tp, "Mantle" .. k, V3(w, h, w * 1.05), mc * CF(0, y + h / 2 - R * 0.7, 0), Studs.shade(c.fur, 1 - k * 0.03), "fur")
				y += h
			end
		end
		if o.spots then
			local rnd = Random.new(#ctx.id * 5)
			for _ = 1, 10 do
				local side = if rnd:NextNumber() < 0.5 then -1 else 1
				P(ctx, tp, "Spot", V3(0.06, R * 0.25, R * 0.3), mc * CF(side * R * 0.87, (rnd:NextNumber() - 0.5) * R, (rnd:NextNumber() - 0.5) * ml * 0.8), o.spots, "mark", { smooth = true })
			end
		end
		if kind == "squid" then
			for _, side in { -1, 1 } do
				P(ctx, tp, "Fin", V3(R * 1.2, 0.2 * s, R * 1.2), mc * CF(side * R * 0.9, 0, ml * 0.42) * ANG(0, side * 0.785, 0), c.fur2, "fur2")
			end
		end
	end
	Studs.weldAll(torso, tp)
	-- ARMS: 8, two per joint, each 3 segments tapering, suckers underneath, curling at the tip
	local groups = { { "LegFL", -1, -1 }, { "LegFR", 1, -1 }, { "LegBL", -1, 1 }, { "LegBR", 1, 1 } }
	for gi, g in groups do
		local name = g[1]
		local pivot = if kind == "jelly" then bc * CF(g[2] * R * 0.4, -R * 0.15, g[3] * R * 0.4) else bc * CF(g[2] * R * 0.45, -R * 0.5, g[3] * R * 0.45 - (if kind == "squid" then R * 0.9 else 0))
		limb(ctx, torso, name, name .. "Bone", pivot, function(list)
			for a = 0, 1 do
				local ang
				if kind == "squid" then
					ang = ANG(0, (g[2] * 0.12 + (a - 0.5) * 0.16), 0) -- arms forward (-Z)
				else
					ang = ANG(0, math.atan2(-g[2], -g[3]) + (a - 0.5) * 0.7, 0)
				end
				local f = pivot * ang
				local segL = armL / 3
				for k = 0, 2 do
					local th = (0.5 - k * 0.13) * s * (o.armT or 1)
					local down = if kind == "jelly" then (if k == 0 then ANG(-1.5, 0, 0) else ANG(if k % 2 == 0 then 0.12 else -0.12, 0, 0))
						elseif kind == "squid" then ANG(0.05 + k * 0.05, 0, 0) else ANG(-0.2 + k * 0.45, 0, 0)
					f = f * down
					P(ctx, list, "Arm" .. k, V3(th, th * 0.8, segL + 0.05 * s), f * CF(0, 0, -segL / 2), if k == 2 and c.mark then c.mark else c.fur, "fur")
					if kind ~= "jelly" then
						P(ctx, list, "Sucker" .. k, V3(th * 0.6, 0.06, segL * 0.5), f * CF(0, -th * 0.42, -segL / 2), c.belly, "belly", { smooth = true })
					end
					f = f * CF(0, 0, -segL) * ANG(0, 0, 0)
				end
				if kind == "jelly" then
					-- long thin stinging strands
					P(ctx, list, "Strand", V3(0.08 * s, 0.08 * s, armL * 0.22), f * CF(0, 0, armL * 0.05) * ANG(0, 0.3, 0), c.fur2, "fur2", { smooth = true })
				end
			end
		end)
	end
	if kind == "squid" then
		-- the two long hunting tentacles with suckered clubs
		for _, side in { -1, 1 } do
			local pivot = bc * CF(side * R * 0.3, -R * 0.4, -R * 1.2)
			limb(ctx, torso, if side < 0 then "WingL" else "WingR", if side < 0 then "WingBoneL" else "WingBoneR", pivot, function(list)
				local tl = armL * 1.8
				P(ctx, list, "Tentacle", V3(0.22 * s, 0.22 * s, tl), pivot * ANG(0, side * 0.15, 0) * CF(0, 0, -tl / 2), c.fur, "fur")
				P(ctx, list, "Club", V3(0.5 * s, 0.3 * s, 0.9 * s), pivot * ANG(0, side * 0.15, 0) * CF(0, 0, -tl - 0.3 * s), c.fur2, "fur2")
			end)
		end
	end
	-- HEAD / "Neck" joint: eyes + funnel (octopus, squid); oral arms (jelly)
	local neckPivot = bc * CF(0, 0, if kind == "squid" then -R * 0.6 else -R * 0.2)
	local head = Studs.bone(ctx.model, "Head", neckPivot)
	local hp = {}
	local headTop
	if kind == "jelly" then
		for i = 0, 3 do
			local a = i / 4 * math.pi * 2 + 0.4
			for k = 0, 2 do
				P(ctx, hp, "OralArm", V3(R * 0.3, armL * 0.22, R * 0.14), neckPivot * ANG(0, a, 0) * CF(0, -R * 0.3 - (k + 0.5) * armL * 0.2, -R * 0.15) * ANG(0, 0, (k % 2 - 0.5) * 0.4), c.mark or c.fur2, "mark")
			end
		end
		headTop = by + R
	else
		local hc = neckPivot * CF(0, R * 0.1, -R * 0.4)
		P(ctx, hp, "Head", V3(R * 1.5, R * 1.1, R * 0.9), hc, c.fur, "fur")
		for _, side in { -1, 1 } do
			eye(ctx, hp, hc * CF(side * R * 0.5, R * 0.3, -R * 0.42), R * 0.24, o.iris, c.fur)
			P(ctx, hp, "Brow", V3(R * 0.5, R * 0.12, R * 0.3), hc * CF(side * R * 0.5, R * 0.6, -R * 0.3), c.fur2, "fur2")
		end
		P(ctx, hp, "Funnel", V3(R * 0.3, R * 0.3, R * 0.4), hc * CF(R * 0.75, -R * 0.2, 0), c.fur2, "fur2")
		headTop = by + R * 2
	end
	Studs.weldAll(head, hp)
	Studs.motor("Neck", torso, head, neckPivot)
	return R * 2, R * 2, R * 2, 0, headTop, neckPivot
end

local BUILD = { bird = buildBird, penguin = buildPenguin, quad = buildQuad, swim = buildSwimmer, serpent = buildSerpent, tentacle = buildTentacle }

function AnimalBuilder.build(speciesId: string, opts: any?): Model
	opts = opts or {}
	local spec = BearConfig.get(speciesId)
	local s = opts.scale or (opts.weight and BearConfig.scaleFor(speciesId, opts.weight)) or 1
	local ctx = newCtx(speciesId, spec, s)
	ctx.id = speciesId
	local a = spec.animal
	local W, H, L, hip, headTop, mouth = BUILD[a.plan](ctx, a)
	local _ = W
	local bodyLen = math.max(L, H)
	return finish(ctx, opts, a.plan, hip, bodyLen, headTop, mouth)
end

return AnimalBuilder
