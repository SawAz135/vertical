--[[ FishBuilder: builds a fully articulated stud-style fish from FishConfig.look.

     Rig (fish faces -Z):
       Root  (front body bone, PrimaryPart)
        ├─ Motor6D "Spine" -> Rear (rear body bone)
        │    └─ Motor6D "Tail" -> TailBone (caudal fin)
        ├─ Motor6D "FinL" / "FinR" -> pectoral fins
       Attachments: Root.Grip (held in hand), Root.Mouth (front), Root.Top
     Body = mosaic of slices x 3 horizontal bands (back / side / belly) like the
     reference figurines, with patterns, eyes, gills, mouth and species fins. ]]
local Shared = script.Parent.Parent
local Studs = require(script.Parent.Studs)
local FishConfig = require(Shared.Config.FishConfig)

local FishBuilder = {}

local CF = CFrame.new
local V3 = Vector3.new
local ANG = CFrame.Angles
local BLACK = Color3.fromRGB(20, 20, 24)
local WHITE = Color3.fromRGB(250, 250, 250)

local function addEye(model, bone, x, y, z, size, side, ringColor)
	-- white ring, black pupil, white highlight (the reference eye look)
	local ring = Studs.piece(model, "EyeRing", V3(0.05, size, size), CF(x, y, z), ringColor or WHITE, "eye", { smooth = true })
	local px = x + side * 0.035
	local pupil = Studs.piece(model, "Pupil", V3(0.05, size * 0.66, size * 0.66), CF(px, y - size * 0.04, z + size * 0.02), BLACK, "pupil", { smooth = true })
	local hl = Studs.piece(model, "Highlight", V3(0.03, size * 0.2, size * 0.2), CF(px + side * 0.03, y + size * 0.12, z - size * 0.12), WHITE, "pupil", { smooth = true })
	Studs.weldAll(bone, { ring, pupil, hl })
end

local function finPlate(model, name, size, cf, color, edge)
	local p = Studs.piece(model, name, size, cf, color, "fin")
	if edge then
		local e = Studs.piece(model, name .. "Edge", V3(size.X + 0.02, size.Y * 0.18, size.Z + 0.02), cf * CF(0, size.Y * 0.5, 0), edge, "detail", { smooth = true })
		return { p, e }
	end
	return { p }
end

local function buildTail(model, tailBone: BasePart, kind: string, size: number, H: number, colors, edge)
	local t = tailBone.CFrame
	local parts = {}
	local th = 0.09
	local sz = size * H
	local function add(list)
		for _, p in list do table.insert(parts, p) end
	end
	add({ Studs.piece(model, "TailRoot", V3(th * 1.6, sz * 0.32, sz * 0.22), t * CF(0, 0, sz * 0.11), colors.tail, "tail") })
	if kind == "fork" or kind == "lunate" then
		local spread = if kind == "lunate" then math.rad(48) else math.rad(36)
		local len = if kind == "lunate" then sz * 1.0 else sz * 0.78
		local wid = if kind == "lunate" then sz * 0.2 else sz * 0.3
		for _, dir in { 1, -1 } do
			local cf = t * CF(0, 0, sz * 0.18) * ANG(dir * spread, 0, 0) * CF(0, 0, len / 2)
			add(finPlate(model, "TailLobe", V3(th, wid, len), cf, colors.tail, edge))
			-- darker tip voxel
			add({ Studs.piece(model, "TailTip", V3(th + 0.01, wid * 0.8, len * 0.25), cf * CF(0, 0, len * 0.38), Studs.shade(colors.tail, 0.82), "tail") })
		end
	elseif kind == "shark" then
		-- heterocercal: long upper lobe, short lower lobe
		add(finPlate(model, "TailUpper", V3(th * 1.4, sz * 0.26, sz * 1.15), t * CF(0, 0, sz * 0.15) * ANG(math.rad(38), 0, 0) * CF(0, 0, sz * 0.55), colors.tail, edge))
		add(finPlate(model, "TailLower", V3(th * 1.2, sz * 0.22, sz * 0.6), t * CF(0, 0, sz * 0.15) * ANG(-math.rad(40), 0, 0) * CF(0, 0, sz * 0.3), colors.tail, edge))
		add({ Studs.piece(model, "TailTip", V3(th * 1.5, sz * 0.18, sz * 0.3), t * CF(0, 0, sz * 0.15) * ANG(math.rad(38), 0, 0) * CF(0, 0, sz * 1.05), Studs.shade(colors.tail, 0.85), "tail") })
	elseif kind == "veil" then
		-- long flowing double veil that droops (goldfish, betta, guppy, koi)
		local l = sz * 1.1
		for _, dir in { 1, -1 } do
			local cf = t * CF(0, 0, sz * 0.15) * ANG(dir * math.rad(24), 0, 0) * CF(0, 0, l / 2)
			add(finPlate(model, "Veil", V3(th * 0.8, sz * 0.62, l), cf, colors.tail, nil))
			add({ Studs.piece(model, "VeilTip", V3(th * 0.85, sz * 0.5, l * 0.4), cf * CF(0, -dir * sz * 0.1, l * 0.42) * ANG(dir * 0.25, 0, 0), Studs.shade(colors.tail, 1.12), "tail") })
			if edge then
				add({ Studs.piece(model, "VeilEdge", V3(th + 0.02, sz * 0.5, 0.08), cf * CF(0, 0, l * 0.62), edge, "detail", { smooth = true }) })
			end
		end
	elseif kind == "point" then
		-- eel / oarfish: the body tapers into a small pointed fin
		add(finPlate(model, "TailPoint", V3(th, sz * 0.5, sz * 0.7), t * CF(0, 0, sz * 0.4), colors.tail))
		add({ Studs.piece(model, "TailPointTip", V3(th, sz * 0.24, sz * 0.36), t * CF(0, 0, sz * 0.9), Studs.shade(colors.tail, 0.85), "tail") })
	elseif kind == "stub" then
		-- sunfish clavus: short scalloped rudder as tall as the body
		add(finPlate(model, "Clavus", V3(th * 1.6, sz * 1.5, sz * 0.32), t * CF(0, 0, sz * 0.08), colors.tail))
		for k = -2, 2 do
			add({ Studs.piece(model, "ClavusLobe", V3(th * 1.7, sz * 0.22, sz * 0.14), t * CF(0, k * sz * 0.3, sz * 0.28), Studs.shade(colors.tail, 0.9), "tail") })
		end
	elseif kind == "round" or kind == "fan" then
		local h = if kind == "fan" then sz * 0.85 else sz * 0.95
		local l = if kind == "fan" then sz * 0.55 else sz * 0.62
		add(finPlate(model, "TailFan", V3(th, h, l), t * CF(0, 0, sz * 0.2 + l / 2), colors.tail))
		add({ Studs.piece(model, "TailFanTop", V3(th, h * 0.22, l * 0.8), t * CF(0, h * 0.55, sz * 0.2 + l * 0.48), Studs.shade(colors.tail, 0.92), "tail") })
		add({ Studs.piece(model, "TailFanBot", V3(th, h * 0.22, l * 0.8), t * CF(0, -h * 0.55, sz * 0.2 + l * 0.48), Studs.shade(colors.tail, 0.92), "tail") })
		if edge then
			add({ Studs.piece(model, "TailEdge", V3(th + 0.02, h * 1.25, 0.1), t * CF(0, 0, sz * 0.2 + l), edge, "detail", { smooth = true }) })
		end
	end
	Studs.weldAll(tailBone, parts)
end

-- generic fusiform body (trout, salmon, clownfish, swordfish ...)
local function buildBody(model: Model, look, s: number)
	local L = look.length * s
	local H = look.height * s
	local W = look.width * s
	local profile = look.profile
	local n = #profile
	local bodyL = L * 0.8
	local sl = bodyL / n
	local zNose = -L / 2
	local colors = look.colors
	local split = math.ceil(n / 2)
	local zSplit = zNose + split * sl
	local zTail = zNose + n * sl

	local root = Studs.bone(model, "Root", CF(0, 0, zNose + split * sl / 2), V3(W * 0.6, H * 0.6, split * sl))
	local rear = Studs.bone(model, "Rear", CF(0, 0, (zSplit + zTail) / 2))
	local tailBone = Studs.bone(model, "TailBone", CF(0, 0, zTail))
	model.PrimaryPart = root

	-- pattern lookup
	local override = {} -- [i .. band] = color
	local spots = {}
	local edges = {}
	for _, pat in look.pattern or {} do
		if pat.kind == "stripe" then
			for i = pat.from, math.min(pat.to, n) do override[i .. pat.band] = pat.color end
		elseif pat.kind == "checker" then
			for i = 1, n do
				if i % 2 == 0 then override[i .. pat.band] = pat.color end
			end
		elseif pat.kind == "vband" then
			for _, i in pat.slices do
				if i <= n then
					override[i .. "top"] = pat.color
					override[i .. "mid"] = pat.color
					override[i .. "bot"] = pat.color
					if pat.edge then table.insert(edges, { i = i, color = pat.edge }) end
				end
			end
		elseif pat.kind == "patch" then
			for _, cell in pat.cells do override[cell] = pat.color end
		elseif pat.kind == "spots" then
			for i = 2, n - 1 do
				if (i + (pat.offset or 0)) % (pat.every or 2) == 0 then
					table.insert(spots, { i = i, band = pat.band, color = pat.color })
				end
			end
		end
	end

	local frontParts, rearParts = {}, {}
	local bandFrac = { top = 0.34, mid = 0.36, bot = 0.30 }
	local bandRole = { top = "back", mid = "side", bot = "belly" }
	local bandColor = { top = colors.back, mid = colors.side, bot = colors.belly }
	local slices = {}
	for i = 1, n do
		local h = profile[i][1] * H
		local w = profile[i][2] * W
		local zc = zNose + (i - 0.5) * sl
		-- back sits slightly higher than the belly for a natural arch
		local yTop = h / 2 + (i <= 2 and 0 or H * 0.02)
		local y = yTop
		local list = if i <= split then frontParts else rearParts
		slices[i] = { h = h, w = w, z = zc, top = yTop }
		for _, band in { "top", "mid", "bot" } do
			local bh = h * bandFrac[band]
			local bw = if band == "mid" then w else w * 0.9
			local shadeK = if (i + (band == "mid" and 1 or 0)) % 2 == 0 then 1 else 0.93
			local col = override[i .. band] or Studs.shade(bandColor[band], shadeK)
			local p = Studs.piece(model, "Body" .. i .. band, V3(bw, bh, sl * 1.001), CF(0, y - bh / 2, zc), col, bandRole[band])
			if band ~= "top" then p.TopSurface = Enum.SurfaceType.Smooth end
			table.insert(list, p)
			y -= bh
		end
	end

	-- nose cap + mouth
	local s1 = slices[1]
	local snout = (look.snout or 0) * L * 0.3
	local nose = Studs.piece(model, "Nose", V3(s1.w * 0.7, s1.h * 0.62, sl * 0.4 + snout), CF(0, -s1.h * 0.04, zNose - sl * 0.18 - snout / 2), colors.side, "side")
	local mouthW = if look.bigMouth then s1.w * 0.7 else s1.w * 0.42
	local mouthH = if look.bigMouth then s1.h * 0.16 else s1.h * 0.1
	local mouthZ = zNose - sl * 0.38 - snout
	local mouth = Studs.piece(model, "Mouth", V3(mouthW, mouthH, 0.06), CF(0, -s1.h * 0.18, mouthZ), Color3.fromRGB(60, 30, 30), "mouth", { smooth = true })
	table.insert(frontParts, nose)
	table.insert(frontParts, mouth)
	if look.underbite then
		-- jutting lower jaw
		table.insert(frontParts, Studs.piece(model, "LowerJaw", V3(mouthW * 1.05, s1.h * 0.16, sl * 0.5 + snout * 0.6), CF(0, -s1.h * 0.32, zNose - sl * 0.3 - snout * 0.6), Studs.shade(colors.belly, 0.92), "belly"))
	end
	if look.teeth then
		local nt = if look.bigMouth then 5 else 3
		for k = 1, nt do
			local x = (k - (nt + 1) / 2) * mouthW / nt
			table.insert(frontParts, Studs.piece(model, "Tooth", V3(mouthW / nt * 0.5, mouthH * 1.1, 0.07), CF(x, -s1.h * 0.18 + mouthH * 0.5, mouthZ - 0.04), look.teeth, "detail", { smooth = true }))
			table.insert(frontParts, Studs.piece(model, "Tooth", V3(mouthW / nt * 0.5, mouthH * 1.1, 0.07), CF(x + mouthW / nt * 0.5, -s1.h * 0.18 - mouthH * 0.5, mouthZ - 0.05), look.teeth, "detail", { smooth = true }))
		end
	end
	if look.barbels then
		local b = look.barbels
		for k = 1, b.count do
			for _, side in { 1, -1 } do
				if b.chin and side < 0 then continue end
				local x = if b.chin then 0 else side * mouthW * (0.35 + k * 0.08)
				local len = b.length * H * (1 - (k - 1) * 0.25)
				local y = -s1.h * (0.2 + (k - 1) * 0.12)
				table.insert(frontParts, Studs.piece(model, "Barbel", V3(0.06, 0.06, len), CF(x, y, mouthZ + 0.05) * ANG(-0.5, side * (0.5 + k * 0.25), 0) * CF(0, 0, -len / 2), b.color, "detail", { smooth = true }))
			end
		end
	end
	if look.lure then
		-- anglerfish: rod from the forehead with a glowing bulb
		local stalk = H * 0.9
		local base = CF(0, s1.top, s1.z)
		table.insert(frontParts, Studs.piece(model, "LureStalk", V3(0.07, stalk, 0.07), base * ANG(-0.55, 0, 0) * CF(0, stalk / 2, 0), Studs.shade(colors.back, 1.2), "detail", { smooth = true }))
		local tip = (base * ANG(-0.55, 0, 0) * CF(0, stalk, 0)).Position
		local bulb = Studs.piece(model, "LureBulb", V3(0.26, 0.26, 0.26), CF(tip + V3(0, -0.05, -0.08)), look.lure, "accent", { smooth = true, material = Enum.Material.Neon })
		bulb.Shape = Enum.PartType.Ball
		table.insert(frontParts, bulb)
		local light = Instance.new("PointLight")
		light.Color = look.lure
		light.Range = 6
		light.Brightness = 1.4
		light.Shadows = false
		light.Parent = bulb
	end
	if look.hammer then
		-- hammerhead: wide flat cephalofoil with the eyes on the tips
		local hw = W * 2.6
		table.insert(frontParts, Studs.piece(model, "Hammer", V3(hw, s1.h * 0.42, sl * 0.9), CF(0, s1.top - s1.h * 0.4, zNose + sl * 0.1), colors.back, "back"))
		table.insert(frontParts, Studs.piece(model, "HammerBelly", V3(hw * 0.94, s1.h * 0.14, sl * 0.8), CF(0, s1.top - s1.h * 0.68, zNose + sl * 0.1), colors.belly, "belly"))
	end
	if look.shark then
		-- five gill slits on each flank
		local s3 = slices[3]
		for _, side in { 1, -1 } do
			for k = 0, 4 do
				table.insert(frontParts, Studs.piece(model, "GillSlit", V3(0.05, s3.h * 0.4, 0.07), CF(side * (s3.w / 2 + 0.02), -s3.h * 0.05, s3.z - sl * 0.4 + k * sl * 0.2), Studs.shade(colors.side, 0.6), "detail", { smooth = true }))
			end
		end
	end

	-- gill plates
	local s2 = slices[2]
	for _, side in { 1, -1 } do
		table.insert(frontParts, Studs.piece(model, "Gill", V3(0.05, s2.h * 0.72, 0.08), CF(side * (s2.w / 2 + 0.02), -s2.h * 0.04, s2.z - sl * 0.45), Studs.shade(colors.side, 0.72), "detail", { smooth = true }))
	end

	-- ring edges of vertical bands
	for _, e in edges do
		local sd = slices[e.i]
		local list = if e.i <= split then frontParts else rearParts
		for _, dz in { -0.5, 0.5 } do
			table.insert(list, Studs.piece(model, "BandEdge", V3(sd.w + 0.04, sd.h + 0.04, 0.07), CF(0, sd.top - sd.h / 2, sd.z + dz * sl), e.color, "detail", { smooth = true }))
		end
	end

	-- spots: small raised tiles on both flanks
	for _, sp in spots do
		local sd = slices[sp.i]
		local yb = if sp.band == "top" then sd.top - sd.h * 0.17 elseif sp.band == "mid" then sd.top - sd.h * 0.52 else sd.top - sd.h * 0.85
		local list = if sp.i <= split then frontParts else rearParts
		for _, side in { 1, -1 } do
			local x = side * ((if sp.band == "mid" then sd.w else sd.w * 0.9) / 2 + 0.02)
			table.insert(list, Studs.piece(model, "Spot", V3(0.05, sd.h * 0.16, sl * 0.36), CF(x, yb, sd.z + ((sp.i % 2) - 0.5) * sl * 0.3), sp.color, "accent", { smooth = true }))
		end
		if sp.band == "top" then
			table.insert(list, Studs.piece(model, "SpotTop", V3(sd.w * 0.22, 0.05, sl * 0.3), CF(sd.w * 0.18, sd.top + 0.02, sd.z), sp.color, "accent", { smooth = true }))
		end
	end

	-- eyes
	local eyeSize = math.max(0.16, H * 0.24) * (look.bigEyes or 1)
	if look.shark then eyeSize *= 0.6 end
	for _, side in { 1, -1 } do
		if look.hammer then
			addEye(model, root, side * (W * 1.3 + 0.03), s1.top - s1.h * 0.4, zNose + sl * 0.1, eyeSize, side)
		else
			addEye(model, root, side * (s1.w / 2 + 0.03), s1.top - s1.h * 0.36, s1.z + sl * 0.12 - snout * 0.2, eyeSize, side, look.eyeColor)
		end
	end

	-- dorsal fin (stepped voxel fin along the back)
	local d = look.dorsal
	if d then
		local count = d.to - d.from + 1
		for k = 0, count - 1 do
			local i = d.from + k
			local sd = slices[i]
			if sd then
				local t = if count > 1 then k / (count - 1) else 0.5
				local hk = if d.sail then (1 - t * 0.55) else math.sin(math.pi * (0.25 + t * 0.6))
				local fh = d.height * H * hk
				local list = if i <= split then frontParts else rearParts
				local fin = Studs.piece(model, "Dorsal", V3(0.1, fh, sl * 1.0), CF(0, sd.top + fh / 2, sd.z + (if d.sail then -t * sl * 0.2 else 0)), d.color, "fin")
				table.insert(list, fin)
				if d.spiky then
					table.insert(list, Studs.piece(model, "DorsalSpine", V3(0.12, fh * 0.25, 0.1), CF(0, sd.top + fh + fh * 0.1, sd.z - sl * 0.3), Studs.shade(d.color, 0.8), "fin"))
				end
				if d.edge then
					table.insert(list, Studs.piece(model, "DorsalEdge", V3(0.12, 0.08, sl), CF(0, sd.top + fh, sd.z), d.edge, "detail", { smooth = true }))
				end
			end
		end
	end
	if look.adipose and slices[n - 1] then
		local sd = slices[n - 1]
		table.insert(rearParts, Studs.piece(model, "Adipose", V3(0.08, H * 0.12, sl * 0.6), CF(0, sd.top + H * 0.06, sd.z), colors.fin, "fin"))
	end
	if look.pelvic and slices[3] then
		local sd = slices[3]
		for _, side in { 1, -1 } do
			table.insert(frontParts, Studs.piece(model, "Pelvic", V3(0.07, H * 0.18, sl * 0.7), CF(side * sd.w * 0.22, sd.top - sd.h - H * 0.07, sd.z + sl * 0.2) * ANG(-0.35, 0, 0), colors.fin, "fin"))
		end
	end
	if look.anal and slices[n - 1] then
		local sd = slices[n - 1]
		table.insert(rearParts, Studs.piece(model, "Anal", V3(0.08, H * 0.2, sl * 0.8), CF(0, sd.top - sd.h - H * 0.08, sd.z) * ANG(-0.3, 0, 0), colors.fin, "fin"))
	end
	if look.keel then
		local sd = slices[n]
		for _, side in { 1, -1 } do
			table.insert(rearParts, Studs.piece(model, "Keel", V3(0.1, 0.08, sl * 0.8), CF(side * (sd.w / 2 + 0.04), sd.top - sd.h / 2, sd.z), Studs.shade(colors.back, 0.8), "detail"))
		end
	end

	if look.finlets then
		for i = n - 2, n do
			local sd = slices[i]
			if sd then
				table.insert(rearParts, Studs.piece(model, "Finlet", V3(0.08, H * 0.08, sl * 0.3), CF(0, sd.top + H * 0.04, sd.z), look.finlets, "fin"))
				table.insert(rearParts, Studs.piece(model, "Finlet", V3(0.08, H * 0.08, sl * 0.3), CF(0, sd.top - sd.h - H * 0.04, sd.z), look.finlets, "fin"))
			end
		end
	end
	if look.scutes then
		-- sturgeon: armour plates along the back and the flanks
		for i = 2, n - 1 do
			local sd = slices[i]
			local list = if i <= split then frontParts else rearParts
			table.insert(list, Studs.piece(model, "Scute", V3(sd.w * 0.22, H * 0.1, sl * 0.5), CF(0, sd.top + H * 0.04, sd.z), look.scutes, "accent"))
			for _, side in { 1, -1 } do
				table.insert(list, Studs.piece(model, "Scute", V3(0.08, H * 0.1, sl * 0.4), CF(side * (sd.w / 2 + 0.03), sd.top - sd.h * 0.45, sd.z), look.scutes, "accent"))
			end
		end
	end
	if look.spines then
		-- lionfish: venomous striped rays fanning out of the back
		local sp = look.spines
		for k = 1, sp.count do
			local t = (k - 1) / math.max(1, sp.count - 1)
			local i = math.clamp(math.floor(1 + t * (n - 2) + 0.5), 1, n)
			local sd = slices[i]
			local list = if i <= split then frontParts else rearParts
			local len = sp.height * H * (1 - t * 0.45)
			local cf = CF(0, sd.top, sd.z) * ANG(0.35 - t * 0.7, 0, 0)
			table.insert(list, Studs.piece(model, "Spine", V3(0.06, len, 0.06), cf * CF(0, len / 2, 0), sp.color, "fin"))
			table.insert(list, Studs.piece(model, "SpineBand", V3(0.08, len * 0.18, 0.08), cf * CF(0, len * 0.55, 0), sp.tip, "fin"))
			table.insert(list, Studs.piece(model, "SpineWeb", V3(0.04, len * 0.6, sl * 0.6), cf * CF(0, len * 0.3, sl * 0.2), Studs.shade(sp.color, 1.25), "fin"))
		end
	end
	if look.crest then
		-- oarfish: tall red crest rays on the head
		for k = 0, 4 do
			local len = H * (1.1 - k * 0.12)
			table.insert(frontParts, Studs.piece(model, "Crest", V3(0.07, len, 0.07), CF(0, s1.top, s1.z + k * sl * 0.18) * ANG(0.45 + k * 0.08, 0, 0) * CF(0, len / 2, 0), look.crest, "fin"))
		end
	end
	if look.tallAnal and slices[n - 2] then
		local sd = slices[n - 2]
		local ah = look.tallAnal * H * 0.22
		table.insert(rearParts, Studs.piece(model, "AnalTall", V3(0.08, ah, sl * 1.4), CF(0, sd.top - sd.h - ah / 2 + 0.05, sd.z) * ANG(-0.25, 0, 0), colors.fin, "fin"))
	end
	if look.longAnal then
		for i = split, n - 1 do
			local sd = slices[i]
			table.insert(rearParts, Studs.piece(model, "AnalLong", V3(0.08, H * 0.22, sl), CF(0, sd.top - sd.h - H * 0.1, sd.z), colors.fin, "fin"))
		end
	end
	if look.shine then
		local sparkle = Instance.new("Sparkles")
		sparkle.SparkleColor = colors.side
		sparkle.Parent = root
	end

	-- bill (swordfish, marlin)
	if look.bill then
		local billL = L * look.bill
		local b1 = Studs.piece(model, "Bill", V3(s1.w * 0.32, s1.h * 0.2, billL * 0.55), CF(0, s1.h * 0.04, zNose - billL * 0.27), look.colors.bill, "accent")
		local b2 = Studs.piece(model, "BillTip", V3(s1.w * 0.2, s1.h * 0.13, billL * 0.5), CF(0, s1.h * 0.04, zNose - billL * 0.76), Studs.shade(look.colors.bill, 1.15), "accent")
		table.insert(frontParts, b1)
		table.insert(frontParts, b2)
	end

	Studs.weldAll(root, frontParts)
	Studs.weldAll(rear, rearParts)
	Studs.motor("Spine", root, rear, CF(0, 0, zSplit))
	Studs.motor("Tail", rear, tailBone, CF(0, 0, zTail))
	buildTail(model, tailBone, look.tail or "fork", look.tailSize or 1, H, colors, look.tailEdge)

	-- pectoral fins on their own joints (flap)
	local pz = s2.z + sl * 0.25
	for _, side in { 1, -1 } do
		local pivot = CF(side * (s2.w / 2 + 0.03), -s2.h * 0.2, pz)
		local finBone = Studs.bone(model, if side > 0 then "FinBoneR" else "FinBoneL", pivot)
		local size = (look.pectoral or 0.35) * H
		local parts = finPlate(model, "Pectoral", V3(0.07, size * 0.7, size), pivot * ANG(0, side * 0.5, 0) * CF(0, 0, size / 2), look.pectoralColor or colors.fin, look.pectoralEdge)
		Studs.weldAll(finBone, parts)
		Studs.motor(if side > 0 then "FinR" else "FinL", root, finBone, pivot)
	end

	return root, { length = L + (look.bill and L * look.bill or 0) + snout, height = H, width = W, noseZ = zNose - snout, tailZ = zTail }
end

-- pufferfish: round spiky voxel ball
local function buildPuffer(model: Model, look, s: number)
	local L = look.length * s
	local H = look.height * s
	local W = look.width * s
	local c = look.colors
	local root = Studs.bone(model, "Root", CF(0, 0, 0), V3(W * 0.8, H * 0.8, L * 0.7))
	local rear = Studs.bone(model, "Rear", CF(0, 0, L * 0.3))
	local tailBone = Studs.bone(model, "TailBone", CF(0, 0, L * 0.42))
	model.PrimaryPart = root
	local parts = {}
	local function add(p) table.insert(parts, p) return p end
	-- stacked core: big middle + inset layers = rounded voxel sphere
	add(Studs.piece(model, "Core", V3(W * 0.84, H * 0.5, L * 0.84), CF(0, 0, 0), c.side, "side"))
	add(Studs.piece(model, "CoreTop", V3(W * 0.72, H * 0.17, L * 0.72), CF(0, H * 0.33, 0), c.back, "back"))
	add(Studs.piece(model, "CoreTop2", V3(W * 0.46, H * 0.12, L * 0.46), CF(0, H * 0.47, 0), Studs.shade(c.back, 0.95), "back"))
	add(Studs.piece(model, "CoreBot", V3(W * 0.72, H * 0.17, L * 0.72), CF(0, -H * 0.33, 0), c.belly, "belly"))
	add(Studs.piece(model, "CoreBot2", V3(W * 0.46, H * 0.1, L * 0.46), CF(0, -H * 0.46, 0), c.belly, "belly"))
	add(Studs.piece(model, "CoreSideL", V3(W * 0.1, H * 0.36, L * 0.62), CF(-W * 0.46, 0, 0), Studs.shade(c.side, 0.95), "side"))
	add(Studs.piece(model, "CoreSideR", V3(W * 0.1, H * 0.36, L * 0.62), CF(W * 0.46, 0, 0), Studs.shade(c.side, 0.95), "side"))
	add(Studs.piece(model, "Face", V3(W * 0.6, H * 0.4, L * 0.1), CF(0, -H * 0.02, -L * 0.46), c.belly, "belly"))
	-- spots on back and flanks
	for k = 0, 8 do
		local a = k * 2.399
		local r = 0.25 + (k % 3) * 0.1
		add(Studs.piece(model, "Spot", V3(W * 0.09, 0.05, L * 0.09), CF(math.cos(a) * W * r, H * 0.535, math.sin(a) * L * r), c.spot, "accent", { smooth = true }))
	end
	for _, side in { 1, -1 } do
		for k = 0, 3 do
			add(Studs.piece(model, "SideSpot", V3(0.05, H * 0.08, L * 0.08), CF(side * W * 0.515, H * (0.12 - (k % 2) * 0.18), L * (-0.2 + k * 0.16)), c.spot, "accent", { smooth = true }))
		end
	end
	-- spikes: fibonacci sphere directions
	local count = 46
	for k = 0, count - 1 do
		local y = 1 - (k / (count - 1)) * 2
		local r = math.sqrt(1 - y * y)
		local th = k * 2.399963
		local dir = V3(math.cos(th) * r, y, math.sin(th) * r)
		if dir.Z > -0.72 and math.abs(dir.Y) < 0.94 then
			local pos = dir * V3(W * 0.5, H * 0.5, L * 0.48)
			local cf = CFrame.lookAt(pos, pos + dir) * CF(0, 0, -H * 0.05)
			add(Studs.piece(model, "Spike", V3(0.11 * s, 0.11 * s, 0.24 * s), cf, c.spike, "accent"))
		end
	end
	-- big eyes and little "o" mouth
	local eye = math.max(0.3, H * 0.26)
	for _, side in { 1, -1 } do
		addEye(model, root, side * W * 0.44, H * 0.16, -L * 0.3, eye, side)
		-- eyes on a puffer are on the front-sides: rotate ring slightly
	end
	add(Studs.piece(model, "MouthRing", V3(W * 0.18, H * 0.12, 0.08), CF(0, -H * 0.06, -L * 0.52), Studs.shade(c.side, 0.8), "detail", { smooth = true }))
	add(Studs.piece(model, "Mouth", V3(W * 0.1, H * 0.06, 0.1), CF(0, -H * 0.06, -L * 0.53), Color3.fromRGB(70, 34, 30), "mouth", { smooth = true }))
	-- small dorsal + anal at the back
	add(Studs.piece(model, "Dorsal", V3(0.1, H * 0.16, L * 0.14), CF(0, H * 0.5, L * 0.3), c.fin, "fin"))
	add(Studs.piece(model, "Anal", V3(0.1, H * 0.14, L * 0.14), CF(0, -H * 0.46, L * 0.3), c.fin, "fin"))
	Studs.weldAll(root, parts)
	Studs.motor("Spine", root, rear, CF(0, 0, L * 0.3))
	Studs.motor("Tail", rear, tailBone, CF(0, 0, L * 0.42))
	buildTail(model, tailBone, "fan", look.tailSize or 0.7, H * 0.7, c, nil)
	for _, side in { 1, -1 } do
		local pivot = CF(side * W * 0.5, -H * 0.05, -L * 0.05)
		local finBone = Studs.bone(model, if side > 0 then "FinBoneR" else "FinBoneL", pivot)
		local size = (look.pectoral or 0.4) * H * 0.7
		local p = finPlate(model, "Pectoral", V3(0.08, size * 0.8, size), pivot * ANG(0, side * 0.6, 0) * CF(0, 0, size / 2), c.fin)
		Studs.weldAll(finBone, p)
		Studs.motor(if side > 0 then "FinR" else "FinL", root, finBone, pivot)
	end
	return root, { length = L * 1.25, height = H, width = W, noseZ = -L * 0.5, tailZ = L * 0.42 }
end

-- rays (stingray, manta): flat diamond disc, flapping wings, long whip tail
local function buildRay(model: Model, look, s: number)
	local L = look.length * s
	local H = look.height * s
	local W = look.width * s
	local c = look.colors
	local root = Studs.bone(model, "Root", CF(0, 0, 0), V3(W * 0.3, H, L * 0.5))
	local rear = Studs.bone(model, "Rear", CF(0, 0, L * 0.42))
	local tailBone = Studs.bone(model, "TailBone", CF(0, 0, L * 0.5))
	model.PrimaryPart = root
	local parts = {}
	local function add(p) table.insert(parts, p) return p end
	-- central body: stacked plates thinner toward the edges
	add(Studs.piece(model, "Body", V3(W * 0.3, H, L * 0.8), CF(0, 0, 0), c.back, "back"))
	add(Studs.piece(model, "BodyBelly", V3(W * 0.28, H * 0.2, L * 0.76), CF(0, -H * 0.55, 0), c.belly, "belly"))
	add(Studs.piece(model, "Head", V3(W * 0.22, H * 0.8, L * 0.16), CF(0, -H * 0.05, -L * 0.46), c.side, "side"))
	-- eyes on top, spiracles behind
	local eye = math.max(0.16, L * 0.08)
	for _, side in { 1, -1 } do
		local ring = Studs.piece(model, "EyeRing", V3(eye, 0.05, eye), CF(side * W * 0.09, H * 0.52, -L * 0.3), WHITE, "eye", { smooth = true })
		local pupil = Studs.piece(model, "Pupil", V3(eye * 0.6, 0.05, eye * 0.6), CF(side * W * 0.09, H * 0.55, -L * 0.3), BLACK, "pupil", { smooth = true })
		add(ring) add(pupil)
		add(Studs.piece(model, "Spiracle", V3(eye * 0.6, 0.05, eye * 0.4), CF(side * W * 0.09, H * 0.52, -L * 0.18), Studs.shade(c.back, 0.7), "detail", { smooth = true }))
	end
	-- spots / pattern on the back
	for k = 0, 7 do
		local a = k * 2.39
		local r = 0.3 + (k % 3) * 0.12
		add(Studs.piece(model, "Spot", V3(W * 0.05, 0.05, W * 0.05), CF(math.cos(a) * W * 0.12 * r * 2, H * 0.52, math.sin(a) * L * 0.3 * r), c.spot, "accent", { smooth = true }))
	end
	if look.manta then
		-- cephalic horns + wide mouth
		for _, side in { 1, -1 } do
			add(Studs.piece(model, "Horn", V3(W * 0.05, H * 0.6, L * 0.3), CF(side * W * 0.12, -H * 0.1, -L * 0.56), c.back, "back"))
		end
		add(Studs.piece(model, "Mouth", V3(W * 0.16, H * 0.2, 0.06), CF(0, -H * 0.15, -L * 0.55), Color3.fromRGB(240, 240, 240), "mouth", { smooth = true }))
	end
	Studs.weldAll(root, parts)
	-- wings on their own joints (flap)
	for _, side in { 1, -1 } do
		local pivot = CF(side * W * 0.15, 0, 0)
		local bone = Studs.bone(model, if side > 0 then "FinBoneR" else "FinBoneL", pivot)
		local wp = {}
		-- three stepped plates = diamond-ish wing
		local steps = { { 0.16, 0.9, 0.8 }, { 0.14, 0.62, 0.55 }, { 0.12, 0.34, 0.3 } }
		for k, st in steps do
			local x = side * W * (0.06 + (k - 1) * 0.11)
			table.insert(wp, Studs.piece(model, "Wing", V3(W * st[1], H * st[3], L * st[2]), pivot * CF(x, 0, if look.manta then L * 0.05 * (k - 1) else 0), Studs.shade(c.back, 1 - k * 0.04), "back"))
			table.insert(wp, Studs.piece(model, "WingBelly", V3(W * st[1], 0.06, L * st[2] * 0.95), pivot * CF(x, -H * st[3] / 2 - 0.02, if look.manta then L * 0.05 * (k - 1) else 0), c.belly, "belly", { smooth = true }))
		end
		table.insert(wp, Studs.piece(model, "WingTip", V3(W * 0.06, H * 0.2, L * 0.12), pivot * CF(side * W * 0.37, 0, if look.manta then L * 0.16 else 0), Studs.shade(c.back, 0.85), "back"))
		Studs.weldAll(bone, wp)
		Studs.motor(if side > 0 then "FinR" else "FinL", root, bone, pivot)
	end
	-- rear + whip tail
	local tl = look.tailLen * s
	local rp = { Studs.piece(model, "TailBase", V3(W * 0.08, H * 0.4, L * 0.2), CF(0, 0, L * 0.5), c.tail, "tail") }
	Studs.weldAll(rear, rp)
	local tp = { Studs.piece(model, "Whip", V3(0.12 * s, 0.12 * s, tl), CF(0, 0, L * 0.5 + tl / 2), c.tail, "tail") }
	if look.barb then
		table.insert(tp, Studs.piece(model, "Barb", V3(0.08 * s, 0.22 * s, tl * 0.12), CF(0, 0.12 * s, L * 0.5 + tl * 0.3), Color3.fromRGB(230, 220, 200), "accent"))
	end
	Studs.weldAll(tailBone, tp)
	Studs.motor("Spine", root, rear, CF(0, 0, L * 0.42))
	Studs.motor("Tail", rear, tailBone, CF(0, 0, L * 0.5))
	model:SetAttribute("SwimStyle", "Flap")
	return root, { length = L + tl, height = H, width = W, noseZ = -L * 0.55, tailZ = L * 0.5 }
end

-- seahorse: upright head + horse snout, ridged belly, curled tail
local function buildSeahorse(model: Model, look, s: number)
	local H = look.height * s
	local W = look.width * s
	local c = look.colors
	local root = Studs.bone(model, "Root", CF(0, H * 0.25, 0), V3(W, H * 0.4, W))
	local rear = Studs.bone(model, "Rear", CF(0, -H * 0.05, 0.05))
	local tailBone = Studs.bone(model, "TailBone", CF(0, -H * 0.25, 0.1))
	model.PrimaryPart = root
	local front, back, tail = {}, {}, {}
	-- head + crown + tube snout (faces -Z)
	table.insert(front, Studs.piece(model, "Head", V3(W * 0.7, H * 0.18, W * 0.8), CF(0, H * 0.4, 0), c.back, "back"))
	table.insert(front, Studs.piece(model, "Crown", V3(W * 0.36, H * 0.1, W * 0.36), CF(0, H * 0.53, 0.05), c.fin, "fin"))
	table.insert(front, Studs.piece(model, "CrownTip", V3(W * 0.2, H * 0.06, W * 0.2), CF(0, H * 0.6, 0.08), c.spot, "accent"))
	table.insert(front, Studs.piece(model, "Snout", V3(W * 0.26, W * 0.24, W * 0.9), CF(0, H * 0.37, -W * 0.8), c.side, "side"))
	table.insert(front, Studs.piece(model, "SnoutTip", V3(W * 0.32, W * 0.28, W * 0.12), CF(0, H * 0.37, -W * 1.26), Studs.shade(c.side, 0.85), "side"))
	for _, side in { 1, -1 } do
		addEye(model, root, side * W * 0.37, H * 0.42, -W * 0.12, math.max(0.16, W * 0.3), side)
	end
	-- neck + chest
	table.insert(front, Studs.piece(model, "Neck", V3(W * 0.6, H * 0.14, W * 0.7), CF(0, H * 0.26, 0.08), c.side, "side"))
	table.insert(front, Studs.piece(model, "Chest", V3(W * 0.8, H * 0.18, W * 0.9), CF(0, H * 0.11, -0.02), c.side, "side"))
	-- belly ridges (rear bone)
	for k = 0, 3 do
		local y = H * (0.02 - k * 0.07)
		local w = W * (0.85 - k * 0.1)
		table.insert(back, Studs.piece(model, "Ring", V3(w, H * 0.065, w), CF(0, y, 0.05 + k * 0.04), if k % 2 == 0 then c.belly else c.side, "belly"))
		table.insert(back, Studs.piece(model, "RingSpot", V3(w * 0.3, H * 0.03, 0.05), CF(0, y, 0.05 + k * 0.04 - w / 2 - 0.02), c.spot, "accent", { smooth = true }))
	end
	-- dorsal fin on the back
	table.insert(back, Studs.piece(model, "Dorsal", V3(0.08, H * 0.14, W * 0.5), CF(0, -H * 0.06, W * 0.62), c.fin, "fin"))
	-- curled tail (tail bone)
	local curl = { { 0, -0.24, 0.1, 0.52 }, { 0, -0.31, 0.16, 0.44 }, { 0, -0.38, 0.14, 0.36 }, { 0, -0.43, 0.04, 0.3 }, { 0, -0.43, -0.08, 0.25 }, { 0, -0.39, -0.14, 0.21 }, { 0, -0.34, -0.1, 0.17 } }
	for k, cpt in curl do
		table.insert(tail, Studs.piece(model, "TailCurl", V3(W * cpt[4] * 1.4, H * 0.07, W * cpt[4] * 1.4), CF(0, H * cpt[2], W * cpt[3] * 2), Studs.shade(c.tail, 1 - k * 0.03), "tail"))
	end
	Studs.weldAll(root, front)
	Studs.weldAll(rear, back)
	Studs.weldAll(tailBone, tail)
	Studs.motor("Spine", root, rear, CF(0, H * 0.04, 0.05))
	Studs.motor("Tail", rear, tailBone, CF(0, -H * 0.25, 0.1))
	for _, side in { 1, -1 } do
		local pivot = CF(side * W * 0.38, H * 0.3, W * 0.15)
		local bone = Studs.bone(model, if side > 0 then "FinBoneR" else "FinBoneL", pivot)
		Studs.weldAll(bone, { Studs.piece(model, "Pectoral", V3(0.06, W * 0.3, W * 0.26), pivot * CF(side * 0.05, 0, W * 0.12), c.fin, "fin") })
		Studs.motor(if side > 0 then "FinR" else "FinL", root, bone, pivot)
	end
	model:SetAttribute("SwimStyle", "Upright")
	return root, { length = W * 2.2, height = H, width = W, noseZ = -W * 1.3, tailZ = W * 0.4 }
end

--[[ Build a fish model.
	opts.weight  (kg) -> scale ; opts.scale overrides
	opts.variant "Normal" | "Golden" | "Diamond" | "Rainbow" ]]
function FishBuilder.build(speciesId: string, opts: any?): Model
	opts = opts or {}
	local spec = FishConfig.get(speciesId) or FishConfig.get(FishConfig.Order[1])
	local s = opts.scale or (opts.weight and FishConfig.scaleFor(speciesId, opts.weight)) or 1
	local model = Instance.new("Model")
	model.Name = spec.name
	local look = spec.look
	local root, dims
	if look.special == "puffer" then
		root, dims = buildPuffer(model, look, s)
	elseif look.special == "ray" then
		root, dims = buildRay(model, look, s)
	elseif look.special == "seahorse" then
		root, dims = buildSeahorse(model, look, s)
	else
		root, dims = buildBody(model, look, s)
	end
	root.Massless = false

	local grip = Instance.new("Attachment")
	grip.Name = "Grip"
	grip.Parent = root
	local mouth = Instance.new("Attachment")
	mouth.Name = "Mouth"
	mouth.Position = root.CFrame:PointToObjectSpace(V3(0, 0, dims.noseZ))
	mouth.Parent = root
	local top = Instance.new("Attachment")
	top.Name = "Top"
	top.Position = V3(0, dims.height * 0.6, 0)
	top.Parent = root

	model:SetAttribute("Kind", "Fish")
	model:SetAttribute("Species", speciesId)
	model:SetAttribute("Scale", s)
	model:SetAttribute("Length", dims.length)
	model:SetAttribute("Height", dims.height)
	if opts.variant and opts.variant ~= "Normal" then
		require(script.Parent.Variants).apply(model, opts.variant)
	end
	return model
end

return FishBuilder
