--[[ BearBuilder: builds a detailed, articulated stud bear from BearConfig.

     Rig (bear faces -Z, feet on Y = 0 in model space):
       HumanoidRootPart (invisible body box, PrimaryPart)
        └─ Motor6D "BodyJoint" -> Torso
             ├─ "Neck" -> Head ── "Jaw" -> JawBone, "EarL"/"EarR" -> ear bones
             ├─ "LegFL" "LegFR" "LegBL" "LegBR" -> leg bones (pivot at the hip)
             └─ "Tail" -> TailBone
     Eyelids exist on every bear (hidden) so clients can blink / close eyes.
     All joints are axis aligned with the body, so animation code can use
     simple pitch (X) / yaw (Y) / roll (Z) angles for every bone. ]]
local Shared = script.Parent.Parent
local Studs = require(script.Parent.Studs)
local BearConfig = require(Shared.Config.BearConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local BearTraits = require(script.Parent.BearTraits)

local BearBuilder = {}

local CF = CFrame.new
local V3 = Vector3.new
local ANG = CFrame.Angles
local BLACK = Color3.fromRGB(16, 16, 20)
local WHITE = Color3.fromRGB(255, 255, 255)
local MOUTH = Color3.fromRGB(96, 30, 34)
local TONGUE = Color3.fromRGB(236, 110, 120)

local function buildHead(model, head: BasePart, spec, s: number, d)
	local c = spec.colors
	local t = spec.traits or {}
	local hs = spec.head.s * s
	local hc = head.CFrame
	local parts = {}
	local function add(p) table.insert(parts, p) return p end
	local hw, hh, hd = hs, hs * 0.9, hs * 0.86
	local front = -hd / 2

	-- cranium + layered fur shell (lighter top, darker cheeks)
	add(Studs.piece(model, "Cranium", V3(hw, hh, hd), hc, c.fur, "fur"))
	add(Studs.piece(model, "CrownTuft", V3(hw * 0.5, hs * 0.08, hd * 0.42), hc * CF(0, hh / 2 + hs * 0.04, hd * 0.04), c.fur2, "fur2"))
	add(Studs.piece(model, "BackHead", V3(hw * 0.86, hh * 0.8, hs * 0.08), hc * CF(0, -hh * 0.02, hd / 2 + hs * 0.035), c.fur2, "fur2"))
	for _, side in { 1, -1 } do
		add(Studs.piece(model, "Cheek", V3(hs * 0.12, hh * 0.42, hd * 0.6), hc * CF(side * (hw / 2 + hs * 0.05), -hh * 0.22, -hd * 0.08), c.fur2, "fur2"))
		add(Studs.piece(model, "CheekTuft", V3(hs * 0.1, hh * 0.18, hd * 0.3), hc * CF(side * (hw / 2 + hs * 0.1), -hh * 0.34, hd * 0.05), Studs.shade(c.fur2, 0.92), "fur2"))
	end

	-- eyes (big, glossy, cute) + hidden eyelids for blinking
	local eyeW, eyeH = hs * 0.155, hs * 0.2
	local eyeY = hs * 0.06
	local eyeX = hs * 0.235
	if t.panda then
		for _, side in { 1, -1 } do
			add(Studs.piece(model, "EyePatch", V3(hs * 0.3, hs * 0.34, 0.08), hc * CF(side * eyeX, eyeY - hs * 0.03, front - 0.02) * ANG(0, 0, side * -0.22), c.patch, "patch", { smooth = true }))
		end
	end
	for _, side in { 1, -1 } do
		local z = front - (if t.panda then 0.08 else 0.04)
		add(Studs.piece(model, "Eye", V3(eyeW, eyeH, 0.08), hc * CF(side * eyeX, eyeY, z), BLACK, "eye", { smooth = true }))
		add(Studs.piece(model, "EyeShine", V3(eyeW * 0.4, eyeH * 0.32, 0.04), hc * CF(side * eyeX - side * eyeW * 0.18, eyeY + eyeH * 0.24, z - 0.05), WHITE, "pupil", { smooth = true }))
		add(Studs.piece(model, "EyeShine2", V3(eyeW * 0.18, eyeH * 0.14, 0.04), hc * CF(side * eyeX + side * eyeW * 0.2, eyeY - eyeH * 0.26, z - 0.05), WHITE, "pupil", { smooth = true }))
		local lid = add(Studs.piece(model, "Eyelid", V3(eyeW * 1.15, eyeH * 1.1, 0.06), hc * CF(side * eyeX, eyeY, z - 0.08), if t.panda then c.patch else c.fur, if t.panda then "patch" else "fur", { smooth = true }))
		lid.Transparency = 1
		-- brow
		add(Studs.piece(model, "Brow", V3(eyeW * 1.6, hs * 0.07, hs * 0.08), hc * CF(side * eyeX, eyeY + eyeH * 0.82, front - 0.03) * ANG(0, 0, side * 0.12), Studs.shade(c.fur2, 0.95), "fur2"))
	end

	-- muzzle (upper) with nose; the jaw is a separate bone so the mouth really opens
	local mL = spec.head.muzzle * s
	local mW, mH = hs * 0.52, hs * 0.26
	local mY = -hs * 0.2
	local mZ = front - mL / 2 + hs * 0.06
	add(Studs.piece(model, "Muzzle", V3(mW, mH, mL), hc * CF(0, mY, mZ), c.muzzle, "muzzle"))
	add(Studs.piece(model, "MuzzleBridge", V3(mW * 0.6, hs * 0.1, mL * 0.7), hc * CF(0, mY + mH / 2 + hs * 0.04, mZ + mL * 0.1), Studs.shade(c.muzzle, 0.96), "muzzle"))
	local tipZ = mZ - mL / 2
	add(Studs.piece(model, "Nose", V3(hs * 0.26, hs * 0.15, hs * 0.14), hc * CF(0, mY + mH / 2 - hs * 0.02, tipZ - hs * 0.03), c.nose, "nose", { smooth = true }))
	add(Studs.piece(model, "NoseShine", V3(hs * 0.08, hs * 0.04, 0.04), hc * CF(-hs * 0.05, mY + mH / 2 + hs * 0.04, tipZ - hs * 0.1), Color3.fromRGB(120, 110, 110), "nose", { smooth = true }))
	add(Studs.piece(model, "Philtrum", V3(hs * 0.04, mH * 0.42, 0.05), hc * CF(0, mY - mH * 0.12, tipZ - 0.025), Studs.shade(c.nose, 1.2), "nose", { smooth = true }))
	-- mouth interior (visible when the jaw opens)
	add(Studs.piece(model, "MouthInside", V3(mW * 0.82, hs * 0.1, mL * 0.86), hc * CF(0, mY - mH / 2 - hs * 0.03, mZ + 0.02), MOUTH, "mouth", { smooth = true }))

	-- upper teeth (hang under the muzzle, only visible when the jaw opens): 4 small + 2 fangs
	local TOOTH = Color3.fromRGB(250, 248, 238)
	for i, x in { -0.3, -0.1, 0.1, 0.3 } do
		add(Studs.piece(model, "ToothU" .. i, V3(mW * 0.12, hs * 0.07, hs * 0.05), hc * CF(x * mW, mY - mH / 2 - hs * 0.005, tipZ + hs * 0.05), TOOTH, "teeth", { smooth = true }))
	end
	for _, side in { 1, -1 } do
		add(Studs.piece(model, "ToothFangU", V3(mW * 0.1, hs * 0.13, hs * 0.06), hc * CF(side * mW * 0.4, mY - mH / 2 - hs * 0.03, tipZ + hs * 0.1), TOOTH, "teeth", { smooth = true }))
	end

	-- species head geometry (hats, crowns, masks, glasses ...)
	BearTraits.head({ model = model, traits = t, c = c, s = s, hc = hc, hs = hs, hw = hw, hh = hh, hd = hd, eyeX = eyeX, eyeY = eyeY, add = add })

	Studs.weldAll(head, parts)

	-- jaw bone
	local jawPivot = hc * CF(0, mY - mH / 2, front + hs * 0.05)
	local jaw = Studs.bone(model, "JawBone", jawPivot)
	local jawParts = {}
	local jL = mL * 0.92
	table.insert(jawParts, Studs.piece(model, "Jaw", V3(mW * 0.88, hs * 0.13, jL), jawPivot * CF(0, -hs * 0.065, -jL / 2 - hs * 0.02), Studs.shade(c.muzzle, 0.9), "muzzle"))
	local tongue = Studs.piece(model, "Tongue", V3(mW * 0.45, hs * 0.05, jL * 0.6), jawPivot * CF(0, hs * 0.02, -jL * 0.55), TONGUE, "tongue", { smooth = true })
	table.insert(jawParts, tongue)
	if t.tongue then
		-- tiny tongue poking out of a smile
		table.insert(jawParts, Studs.piece(model, "TongueTip", V3(mW * 0.28, hs * 0.05, hs * 0.08), jawPivot * CF(0, 0.0, -jL - hs * 0.04), TONGUE, "tongue", { smooth = true }))
	end
	-- lower teeth (on the jaw, point up)
	for i, x in { -0.28, -0.09, 0.09, 0.28 } do
		table.insert(jawParts, Studs.piece(model, "ToothL" .. i, V3(mW * 0.11, hs * 0.06, hs * 0.045), jawPivot * CF(x * mW, hs * 0.03, -jL * 0.93), Color3.fromRGB(250, 248, 238), "teeth", { smooth = true }))
	end
	for _, side in { 1, -1 } do
		table.insert(jawParts, Studs.piece(model, "ToothFangL", V3(mW * 0.09, hs * 0.1, hs * 0.05), jawPivot * CF(side * mW * 0.38, hs * 0.05, -jL * 0.8), Color3.fromRGB(250, 248, 238), "teeth", { smooth = true }))
	end
	Studs.weldAll(jaw, jawParts)
	Studs.motor("Jaw", head, jaw, jawPivot)

	-- ears (own bones -> twitch / flatten)
	local earS = spec.head.ear * s
	for _, side in { 1, -1 } do
		local pivot = hc * CF(side * hw * 0.36, hh / 2 - hs * 0.02, hd * 0.05)
		local bone = Studs.bone(model, if side > 0 then "EarBoneR" else "EarBoneL", pivot)
		local ew, eh, ed = hs * 0.3 * earS, hs * 0.28 * earS, hs * 0.14
		local ear = Studs.piece(model, "Ear", V3(ew, eh, ed), pivot * CF(side * ew * 0.08, eh / 2, 0), if t.panda then c.patch else c.fur, if t.panda then "patch" else "fur")
		local inner = Studs.piece(model, "EarInner", V3(ew * 0.56, eh * 0.56, 0.06), pivot * CF(side * ew * 0.08, eh * 0.45, -ed / 2 - 0.02), c.ear, "ear", { smooth = true })
		Studs.weldAll(bone, { ear, inner })
		Studs.motor(if side > 0 then "EarR" else "EarL", head, bone, pivot)
	end

	d.mouthCF = head.CFrame:ToObjectSpace(jawPivot * CF(0, 0, -jL * 0.7))
end

local function buildLeg(model, torso: BasePart, name: string, pivot: CFrame, spec, s: number, isFront: boolean, side: number)
	local c = spec.colors
	local t = spec.traits or {}
	local len = spec.leg.len * s
	local th = spec.leg.t * s * (if isFront then 1 else 1.06)
	local bone = Studs.bone(model, name .. "Bone", pivot)
	local parts = {}
	local legColor = if t.panda then c.patch else c.fur
	local upperH = len * 0.7 + 0.35 * s
	table.insert(parts, Studs.piece(model, "Leg", V3(th, upperH, th), pivot * CF(0, 0.35 * s - upperH / 2, 0), legColor, if t.panda then "patch" else "fur"))
	table.insert(parts, Studs.piece(model, "LegFur", V3(th * 1.06, upperH * 0.3, th * 1.06), pivot * CF(0, 0.35 * s - upperH * 0.18, 0), Studs.shade(legColor, 0.94), if t.panda then "patch" else "fur2"))
	local pawH = len * 0.32
	local pawCF = pivot * CF(0, -len + pawH / 2, -th * 0.08)
	local pk = if t.bigPaws then 1.3 else 1
	table.insert(parts, Studs.piece(model, "Paw", V3(th * 1.1 * pk, pawH, th * 1.24 * pk), pawCF, c.paw, "paw"))
	table.insert(parts, Studs.piece(model, "PawPad", V3(th * 0.9, 0.06, th * 0.9), pawCF * CF(0, -pawH / 2 + 0.02, 0), Studs.shade(c.paw, 0.7), "paw", { smooth = true }))
	-- claws
	local clawLen = if t.longClaws then 0.32 * s else 0.18 * s
	for k = -1, 1 do
		table.insert(parts, Studs.piece(model, "Claw", V3(th * 0.16, pawH * 0.26, clawLen), pawCF * CF(k * th * 0.32, -pawH * 0.28, -th * 0.62 - clawLen / 2 + 0.04), c.claw, "claw", { smooth = true }))
	end
	Studs.weldAll(bone, parts)
	Studs.motor(name, torso, bone, pivot)
	return bone
end

--[[ Build a bear.
	opts.weight / opts.scale, opts.variant, opts.rarity,
	opts.character = true -> adds a Humanoid so a player can control it ]]
function BearBuilder.build(speciesId: string, opts: any?): Model
	opts = opts or {}
	local spec = BearConfig.get(speciesId) or BearConfig.get(BearConfig.Order[1])
	local s = opts.scale or (opts.weight and BearConfig.scaleFor(speciesId, opts.weight)) or 1
	local c = spec.colors
	local t = spec.traits or {}
	local model = Instance.new("Model")
	-- with StreamingEnabled the parts would arrive one by one on clients: the animator then
	-- missed late joints (the JAW never opened). Atomic = the whole animal arrives at once.
	pcall(function() model.ModelStreamingMode = Enum.ModelStreamingMode.Atomic end)
	model.Name = spec.name

	local w, h, l = spec.body.w * s, spec.body.h * s, spec.body.l * s
	local legLen = spec.leg.len * s
	local bodyY = legLen + h / 2

	local root = Instance.new("Part")
	root.Name = "HumanoidRootPart"
	root.Size = V3(w, h, l)
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

	local torso = Studs.bone(model, "Torso", CF(0, bodyY, 0), V3(w * 0.5, h * 0.5, l * 0.5))
	Studs.motor("BodyJoint", root, torso, CF(0, bodyY, 0))

	-- body -----------------------------------------------------------------
	local bp = {}
	local function add(p) table.insert(bp, p) return p end
	local bc = CF(0, bodyY, 0)
	add(Studs.piece(model, "Body", V3(w, h, l), bc, c.fur, "fur"))
	-- brick fur panels on the flanks (2 x 3) and the back (3), alternating shade
	for _, side in { 1, -1 } do
		for row = 0, 1 do
			for col = 0, 2 do
				local k = if (row + col) % 2 == 0 then 0.93 else 1.05
				local pw, ph = l / 3 - 0.08 * s, h / 2 - 0.1 * s
				add(Studs.piece(model, "FlankFur", V3(0.12 * s, ph, pw), bc * CF(side * (w / 2 + 0.05 * s), h / 4 - row * h / 2, -l / 3 + col * l / 3), Studs.shade(c.fur, k), "fur"))
			end
		end
	end
	for col = 0, 2 do
		local k = if col % 2 == 0 then 1.06 else 0.95
		local col3 = if t.grizzled then Studs.mix(c.fur, c.extra, 0.45 + col * 0.12) else Studs.shade(c.fur, k)
		add(Studs.piece(model, "BackFur", V3(w * 0.78, 0.12 * s, l / 3 - 0.1 * s), bc * CF(0, h / 2 + 0.05 * s, -l / 3 + col * l / 3), col3, if t.grizzled then "extra" else "fur"))
	end
	-- shoulders / haunches
	for _, side in { 1, -1 } do
		add(Studs.piece(model, "Shoulder", V3(0.3 * s, h * 0.55, l * 0.26), bc * CF(side * (w / 2 + 0.1 * s), h * 0.12, -l * 0.3), c.fur2, "fur2"))
		add(Studs.piece(model, "Haunch", V3(0.3 * s, h * 0.6, l * 0.3), bc * CF(side * (w / 2 + 0.1 * s), h * 0.06, l * 0.3), c.fur2, "fur2"))
	end
	-- chest bib, belly, rump
	add(Studs.piece(model, "Chest", V3(w * 0.66, h * 0.62, 0.14 * s), bc * CF(0, -h * 0.08, -l / 2 - 0.06 * s), c.belly, "belly"))
	add(Studs.piece(model, "Belly", V3(w * 0.7, 0.12 * s, l * 0.66), bc * CF(0, -h / 2 - 0.05 * s, 0), c.belly, "belly"))
	add(Studs.piece(model, "Rump", V3(w * 0.84, h * 0.76, 0.14 * s), bc * CF(0, h * 0.04, l / 2 + 0.06 * s), c.fur2, "fur2"))

	-- species traits on the body
	if t.hump then
		add(Studs.piece(model, "Hump", V3(w * 0.7, h * 0.3, l * 0.32), bc * CF(0, h / 2 + h * 0.15, -l * 0.26), c.fur2, "fur2"))
		add(Studs.piece(model, "HumpTips", V3(w * 0.56, 0.12 * s, l * 0.26), bc * CF(0, h / 2 + h * 0.3 + 0.05 * s, -l * 0.26), c.extra, "extra"))
	end
	if t.chestV then
		for _, side in { 1, -1 } do
			add(Studs.piece(model, "ChestV", V3(w * 0.3, 0.16 * s, 0.08 * s), bc * CF(side * w * 0.12, h * 0.12, -l / 2 - 0.15 * s) * ANG(0, 0, side * -0.65), c.mark, "mark", { smooth = true }))
		end
	end
	if t.snowflake then
		local sc = bc * CF(0, h * 0.02, -l / 2 - 0.15 * s)
		for k = 0, 2 do
			add(Studs.piece(model, "Snowflake", V3(0.12 * s, h * 0.42, 0.06 * s), sc * ANG(0, 0, k * math.pi / 3), c.mark, "mark", { smooth = true }))
		end
		add(Studs.piece(model, "SnowflakeCore", V3(0.24 * s, 0.24 * s, 0.07 * s), sc * CF(0, 0, -0.01), Color3.fromRGB(220, 240, 255), "mark", { smooth = true }))
	end
	if t.panda then
		-- black shoulder saddle wrapping the front of the body
		add(Studs.piece(model, "Saddle", V3(w + 0.3 * s, h * 0.62, l * 0.3), bc * CF(0, h * 0.2, -l * 0.26), c.patch, "patch"))
		add(Studs.piece(model, "SaddleBelly", V3(w * 0.72, h * 0.3, l * 0.3), bc * CF(0, -h * 0.3, -l * 0.26), c.patch, "patch"))
	end
	-- species body geometry (moss, rocks, crystals, scarf, stripes ...)
	BearTraits.body({ model = model, traits = t, c = c, s = s, bc = bc, w = w, h = h, l = l, torso = torso, add = add })
	Studs.weldAll(torso, bp)

	-- head ------------------------------------------------------------------
	local hs = spec.head.s * s
	local headCF = CF(0, bodyY + h * 0.36 + hs * 0.08, -l / 2 - hs * 0.32)
	local head = Studs.bone(model, "Head", headCF, V3(hs * 0.6, hs * 0.6, hs * 0.6))
	local d = {}
	buildHead(model, head, spec, s, d)
	-- neck ruff connecting body and head
	local ruff = Studs.piece(model, "NeckRuff", V3(w * 0.78, h * 0.7, hs * 0.4), CF(0, bodyY + h * 0.12, -l / 2 - hs * 0.06), c.fur2, "fur2")
	Studs.weld(torso, ruff)
	Studs.motor("Neck", torso, head, CF(0, bodyY + h * 0.25, -l / 2 + 0.2 * s))

	-- legs -------------------------------------------------------------------
	local lx = w / 2 - spec.leg.t * s * 0.5 - 0.06 * s
	local lzF = -l / 2 + spec.leg.t * s * 0.6 + 0.08 * s
	local lzB = l / 2 - spec.leg.t * s * 0.6 - 0.08 * s
	local hipY = legLen + 0.1 * s
	buildLeg(model, torso, "LegFL", CF(-lx, hipY, lzF), spec, s, true, -1)
	buildLeg(model, torso, "LegFR", CF(lx, hipY, lzF), spec, s, true, 1)
	buildLeg(model, torso, "LegBL", CF(-lx, hipY, lzB), spec, s, false, -1)
	buildLeg(model, torso, "LegBR", CF(lx, hipY, lzB), spec, s, false, 1)

	-- tail -------------------------------------------------------------------
	local tailPivot = CF(0, bodyY + h * 0.28, l / 2 + 0.1 * s)
	local tailBone = Studs.bone(model, "TailBone", tailPivot)
	local tailCol = if t.panda then c.fur else c.fur2
	local tail = Studs.piece(model, "TailFur", V3(0.55 * s, 0.5 * s, 0.42 * s), tailPivot * CF(0, 0, 0.2 * s), tailCol, "fur2")
	local tailTip = Studs.piece(model, "TailTip", V3(0.36 * s, 0.32 * s, 0.2 * s), tailPivot * CF(0, 0.04 * s, 0.48 * s), Studs.shade(tailCol, 1.08), "fur")
	local tailParts = { tail, tailTip }
	BearTraits.tail({ model = model, traits = t, c = c, s = s, pivot = tailPivot, add = function(p) table.insert(tailParts, p) return p end })
	Studs.weldAll(tailBone, tailParts)
	Studs.motor("Tail", torso, tailBone, tailPivot)

	-- attachments used by gameplay -------------------------------------------
	local mouthAtt = Instance.new("Attachment")
	mouthAtt.Name = "MouthAtt"
	mouthAtt.CFrame = d.mouthCF
	mouthAtt.Parent = head
	local overhead = Instance.new("Attachment")
	overhead.Name = "Overhead"
	overhead.Position = V3(0, h / 2 + hs * 0.9, -l * 0.25)
	overhead.Parent = root
	local feet = Instance.new("Attachment")
	feet.Name = "Feet"
	feet.Position = V3(0, -bodyY + 0.1, 0)
	feet.Parent = root

	model:SetAttribute("Kind", "Bear")
	model:SetAttribute("Species", speciesId)
	model:SetAttribute("Scale", s)
	model:SetAttribute("Gait", spec.gait)
	model:SetAttribute("HipHeight", legLen)
	model:SetAttribute("BodyLength", l + hs * 0.9)
	model:SetAttribute("Anim", "Idle")

	if opts.variant and opts.variant ~= "Normal" then
		require(script.Parent.Variants).apply(model, opts.variant)
	end
	if opts.rarity then
		BearBuilder.applyAura(model, opts.rarity)
	end

	if opts.character then
		root.CanCollide = true
		root.Massless = false
		local hum = Instance.new("Humanoid")
		hum.RigType = Enum.HumanoidRigType.R15
		hum.HipHeight = legLen
		hum.RequiresNeck = false
		hum.BreakJointsOnDeath = false
		hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
		hum.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
		hum.WalkSpeed = spec.speed
		hum.UseJumpPower = true
		hum.JumpPower = 46
		hum.AutoRotate = true
		hum.Parent = model
	else
		root.Massless = false
	end
	return model
end

-- restrained rarity aura: ring at the feet (+ light / orbiting motes for top tiers)
function BearBuilder.applyAura(model: Model, rarity: string)
	local tier = RarityConfig.get(rarity)
	model:SetAttribute("Rarity", rarity)
	if tier.index < 4 then return end
	local root = model.PrimaryPart
	if not root then return end
	local feet = root:FindFirstChild("Feet")
	local col = if tier.rainbow then Color3.fromRGB(255, 140, 240) else tier.color
	local p = Instance.new("ParticleEmitter")
	p.Name = "AuraMotes"
	p.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	p.Color = if tier.rainbow
		then ColorSequence.new({ ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 80, 80)), ColorSequenceKeypoint.new(0.5, Color3.fromRGB(80, 255, 140)), ColorSequenceKeypoint.new(1, Color3.fromRGB(120, 120, 255)) })
		else ColorSequence.new(col)
	p.LightEmission = 1
	p.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(0.4, 0.35 + tier.index * 0.04), NumberSequenceKeypoint.new(1, 0) })
	p.Lifetime = NumberRange.new(1.2, 2)
	p.Rate = 2 + tier.index
	p.Speed = NumberRange.new(1, 2.2)
	p.SpreadAngle = Vector2.new(25, 25)
	p.EmissionDirection = Enum.NormalId.Top
	p.Shape = Enum.ParticleEmitterShape.Disc
	p.ShapeStyle = Enum.ParticleEmitterShapeStyle.Surface
	p.ShapeInOut = Enum.ParticleEmitterShapeInOut.Outward
	p.Parent = feet
	if tier.index >= 5 then
		local light = Instance.new("PointLight")
		light.Name = "AuraLight"
		light.Color = col
		light.Range = 10 + tier.index
		light.Brightness = 1.1
		light.Shadows = false
		light.Parent = root
	end
	model:SetAttribute("AuraColor", col)
end

return BearBuilder
