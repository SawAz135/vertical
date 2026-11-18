--[[ Variants: recolours a built bear / fish model by part Role.
     Golden  : warm gold studs, slight reflectance, gold sparkle
     Diamond : cyan crystal tones, glass-like facets, cold glints
     Rainbow : controlled hue sweep along the body (client animates the hue drift)
     Eyes, pupils, noses, mouths and claws keep their colour so the face stays readable. ]]
local Studs = require(script.Parent.Studs)

local Variants = {}
local ancient, clockwork -- (defined below)

local KEEP = { eye = true, pupil = true, nose = true, mouth = true, claw = true, tongue = true, teeth = true }

local GOLD = {
	fur = Color3.fromRGB(240, 186, 40), fur2 = Color3.fromRGB(214, 154, 28), belly = Color3.fromRGB(255, 220, 110),
	muzzle = Color3.fromRGB(255, 226, 130), paw = Color3.fromRGB(226, 168, 36), ear = Color3.fromRGB(255, 214, 100),
	back = Color3.fromRGB(226, 160, 30), side = Color3.fromRGB(250, 196, 50), fin = Color3.fromRGB(255, 214, 90),
	tail = Color3.fromRGB(236, 176, 40), accent = Color3.fromRGB(190, 120, 20), detail = Color3.fromRGB(170, 110, 20),
	mark = Color3.fromRGB(255, 236, 160), patch = Color3.fromRGB(200, 130, 20), extra = Color3.fromRGB(255, 230, 120),
}
local DIAMOND = {
	fur = Color3.fromRGB(110, 210, 255), fur2 = Color3.fromRGB(80, 180, 240), belly = Color3.fromRGB(200, 245, 255),
	muzzle = Color3.fromRGB(210, 248, 255), paw = Color3.fromRGB(90, 190, 245), ear = Color3.fromRGB(170, 235, 255),
	back = Color3.fromRGB(70, 170, 240), side = Color3.fromRGB(130, 220, 255), fin = Color3.fromRGB(180, 240, 255),
	tail = Color3.fromRGB(110, 205, 255), accent = Color3.fromRGB(40, 120, 220), detail = Color3.fromRGB(40, 110, 200),
	mark = Color3.fromRGB(230, 252, 255), patch = Color3.fromRGB(50, 130, 220), extra = Color3.fromRGB(200, 250, 255),
}

local function sparkles(root: BasePart, color: Color3, rate: number)
	local att = Instance.new("Attachment")
	att.Name = "VariantFx"
	att.Parent = root
	local p = Instance.new("ParticleEmitter")
	p.Name = "VariantSparkle"
	p.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	p.Color = ColorSequence.new(color)
	p.LightEmission = 0.8
	p.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(0.3, 0.45), NumberSequenceKeypoint.new(1, 0) })
	p.Transparency = NumberSequence.new(0.15)
	p.Lifetime = NumberRange.new(0.6, 1.1)
	p.Rate = rate
	p.Speed = NumberRange.new(0.5, 1.5)
	p.SpreadAngle = Vector2.new(180, 180)
	p.Shape = Enum.ParticleEmitterShape.Box
	p.ShapeStyle = Enum.ParticleEmitterShapeStyle.Volume
	p.Parent = att
	return p
end

-- the biggest coloured parts (where details can grow), deterministic
local function hosts(parts, count: number)
	local list = {}
	for _, p in parts do
		local role = p:GetAttribute("Role")
		if role and not KEEP[role] and p.Size.X * p.Size.Z > 0.15 then table.insert(list, p) end
	end
	table.sort(list, function(a, b) return a.Size.X * a.Size.Z * (1 + a.Size.Y) > b.Size.X * b.Size.Z * (1 + b.Size.Y) end)
	local out = {}
	for i = 1, math.min(count, #list) do out[i] = list[i] end
	return out
end

local function attach(host: BasePart, name: string, size: Vector3, cf: CFrame, color: Color3, opts: any?)
	local p = Studs.piece(host.Parent, name, size, cf, color, "mutation", opts)
	Studs.weld(host, p)
	return p
end

-- ANCIENT: mossy grey stone, cracks, moss caps, little flowers + mushrooms that sway
function ancient(model: Model, parts)
	model:SetAttribute("Variant", "Ancient")
	model:SetAttribute("Ancient", true)
	local STONE = Color3.fromRGB(150, 148, 138)
	local MOSS = Color3.fromRGB(92, 136, 62)
	local r = Random.new(#parts * 31 + 7)
	for _, p in parts do
		local role = p:GetAttribute("Role")
		if role and not KEEP[role] then
			local _, _, v = p.Color:ToHSV()
			local base = if r:NextNumber() < 0.28 then MOSS else STONE
			p.Color = Studs.shade(base, 0.78 + v * 0.35 + (r:NextNumber() - 0.5) * 0.08)
			p.Material = Enum.Material.Plastic
			p.Reflectance = 0
		end
	end
	for i, h in hosts(parts, 7) do
		local top = h.CFrame * CFrame.new(0, h.Size.Y / 2 + 0.05, 0)
		-- moss cap on top
		attach(h, "Moss", Vector3.new(h.Size.X * 0.82, 0.12, h.Size.Z * 0.78), top, Studs.shade(MOSS, 0.9 + r:NextNumber() * 0.25))
		-- a crack on the side
		attach(h, "Crack", Vector3.new(0.06, h.Size.Y * 0.6, 0.06), h.CFrame * CFrame.new(h.Size.X / 2 + 0.02, 0, 0) * CFrame.Angles(0, 0, 0.4), Color3.fromRGB(70, 68, 64), { smooth = true })
		-- something growing (alternating flowers and mushrooms), on a swaying joint
		local s = math.clamp(math.min(h.Size.X, h.Size.Z) * 0.35, 0.25, 0.8)
		local spot = top * CFrame.new((r:NextNumber() - 0.5) * h.Size.X * 0.5, 0.05, (r:NextNumber() - 0.5) * h.Size.Z * 0.5)
		local stem = Studs.piece(h.Parent, "Stem", Vector3.new(0.12, 0.6, 0.12) * s / 0.5, spot * CFrame.new(0, 0.3 * s / 0.5, 0), Color3.fromRGB(80, 140, 60), "mutation", { smooth = true })
		local grow = {}
		if i % 2 == 1 then
			local col = ({ Color3.fromRGB(240, 120, 170), Color3.fromRGB(255, 220, 80), Color3.fromRGB(245, 245, 245), Color3.fromRGB(170, 140, 255) })[(i % 4) + 1]
			table.insert(grow, Studs.piece(h.Parent, "Petals", Vector3.new(0.5, 0.18, 0.5) * s / 0.5, spot * CFrame.new(0, 0.66 * s / 0.5, 0), col, "mutation"))
			table.insert(grow, Studs.piece(h.Parent, "Heart", Vector3.new(0.2, 0.2, 0.2) * s / 0.5, spot * CFrame.new(0, 0.78 * s / 0.5, 0), Color3.fromRGB(255, 200, 60), "mutation", { smooth = true }))
		else
			stem.Color = Color3.fromRGB(240, 235, 220)
			table.insert(grow, Studs.piece(h.Parent, "Cap", Vector3.new(0.62, 0.26, 0.62) * s / 0.5, spot * CFrame.new(0, 0.66 * s / 0.5, 0), Color3.fromRGB(205, 50, 45), "mutation"))
			table.insert(grow, Studs.piece(h.Parent, "Dot", Vector3.new(0.12, 0.06, 0.12) * s / 0.5, spot * CFrame.new(0.12 * s / 0.5, 0.8 * s / 0.5, 0), Color3.fromRGB(250, 250, 250), "mutation", { smooth = true }))
		end
		Studs.weldAll(stem, grow)
		local m = Studs.motor("Sway", h, stem, spot)
		m:SetAttribute("Phase", i * 1.3)
	end
end

-- CLOCKWORK: brass / copper / iron, rivets, meshing GEARS on the flanks, a wind-up KEY on
-- the back and a little STEAM chimney (the client turns the gears / key, puffs the steam)
function clockwork(model: Model, parts)
	model:SetAttribute("Variant", "Clockwork")
	model:SetAttribute("Clockwork", true)
	local BRASS = Color3.fromRGB(206, 156, 72)
	local COPPER = Color3.fromRGB(184, 112, 54)
	local IRON = Color3.fromRGB(72, 68, 64)
	local MAP = { fur = BRASS, fur2 = COPPER, belly = COPPER, muzzle = IRON, paw = IRON, ear = COPPER, back = BRASS, side = BRASS,
		fin = COPPER, tail = COPPER, accent = IRON, detail = IRON, mark = COPPER, patch = IRON, extra = BRASS }
	for _, p in parts do
		local role = p:GetAttribute("Role")
		if role and not KEEP[role] then
			local _, _, v = p.Color:ToHSV()
			p.Color = Studs.shade(MAP[role] or BRASS, 0.8 + v * 0.3)
			p.Reflectance = 0.22
			p.Material = Enum.Material.Plastic
		end
	end
	local hs = hosts(parts, 6)
	-- rivets on the big plates
	for _, h in hs do
		for _, sx in { -1, 1 } do
			for _, sz in { -1, 1 } do
				attach(h, "Rivet", Vector3.new(0.12, 0.08, 0.12), h.CFrame * CFrame.new(sx * h.Size.X * 0.38, h.Size.Y / 2 + 0.03, sz * h.Size.Z * 0.38), Color3.fromRGB(230, 200, 130), { smooth = true })
			end
		end
	end
	local main = hs[1]
	if not main then return end
	-- GEARS: one big + one small meshing gear on each flank of the biggest part
	local function gear(host: BasePart, cf: CFrame, radius: number, teeth: number, dir: number, speed: number)
		local hub = Studs.piece(host.Parent, "Gear", Vector3.new(0.18, radius * 2, radius * 2), cf, Studs.shade(BRASS, 1.1), "mutation", { shape = Enum.PartType.Cylinder, smooth = true, reflectance = 0.25 })
		local list = {}
		for k = 0, teeth - 1 do
			local a = k / teeth * math.pi * 2
			table.insert(list, Studs.piece(host.Parent, "Tooth", Vector3.new(0.18, radius * 0.32, radius * 0.22), cf * CFrame.Angles(a, 0, 0) * CFrame.new(0, radius + radius * 0.1, 0), Studs.shade(BRASS, 0.95), "mutation", { smooth = true }))
		end
		table.insert(list, Studs.piece(host.Parent, "Axle", Vector3.new(0.24, radius * 0.4, radius * 0.4), cf, IRON, "mutation", { shape = Enum.PartType.Cylinder, smooth = true }))
		Studs.weldAll(hub, list)
		local m = Studs.motor("Gear", host, hub, cf)
		m:SetAttribute("Dir", dir)
		m:SetAttribute("Speed", speed)
	end
	local R = math.clamp(math.min(main.Size.Y, main.Size.Z) * 0.32, 0.35, 1.6)
	for _, side in { -1, 1 } do
		local face = main.CFrame * CFrame.new(side * (main.Size.X / 2 + 0.1), 0, 0)
		gear(main, face * CFrame.new(0, 0, -R * 0.2), R, 10, side, 1.2)
		gear(main, face * CFrame.new(0, R * 0.95, R * 1.15), R * 0.55, 7, -side, 1.2 / 0.55)
	end
	-- wind-up KEY on the back (turns slowly)
	local back = main.CFrame * CFrame.new(0, main.Size.Y / 2 + 0.1, main.Size.Z * 0.15)
	local shaft = Studs.piece(main.Parent, "KeyShaft", Vector3.new(0.18, R * 1.2, 0.18), back * CFrame.new(0, R * 0.6, 0), IRON, "mutation", { smooth = true })
	local bow = {}
	for _, sx in { -1, 1 } do
		table.insert(bow, Studs.piece(main.Parent, "KeyBow", Vector3.new(R * 0.9, R * 0.55, 0.14), back * CFrame.new(sx * R * 0.5, R * 1.35, 0), Studs.shade(BRASS, 1.05), "mutation", { reflectance = 0.25 }))
	end
	Studs.weldAll(shaft, bow)
	Studs.motor("Key", main, shaft, back)
	-- STEAM chimney near the head end
	local ch = main.CFrame * CFrame.new(main.Size.X * 0.2, main.Size.Y / 2 + 0.1, -main.Size.Z * 0.3)
	local pipe = attach(main, "Chimney", Vector3.new(0.28, R * 0.9, 0.28), ch * CFrame.new(0, R * 0.45, 0), IRON, { smooth = true })
	attach(main, "ChimneyCap", Vector3.new(0.4, 0.12, 0.4), ch * CFrame.new(0, R * 0.92, 0), COPPER, { smooth = true })
	local steam = Instance.new("Attachment")
	steam.Name = "Steam"
	steam.Position = Vector3.new(0, R * 0.5, 0)
	steam.Parent = pipe
end

function Variants.apply(model: Model, variant: string)
	if variant == "Normal" or variant == nil then return end
	model:SetAttribute("Variant", variant)
	local root = model.PrimaryPart
	local parts = {}
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") and d.Transparency < 1 then
			table.insert(parts, d)
		end
	end
	if variant == "Golden" then
		for _, p in parts do
			local role = p:GetAttribute("Role")
			if role and not KEEP[role] then
				local base = GOLD[role] or GOLD.fur
				-- keep the light/dark structure of the original colour
				local _, _, v = p.Color:ToHSV()
				p.Color = Studs.shade(base, 0.82 + v * 0.3)
				p.Reflectance = 0.18
			end
		end
		if root then sparkles(root, Color3.fromRGB(255, 220, 90), 4) end
	elseif variant == "Diamond" then
		for _, p in parts do
			local role = p:GetAttribute("Role")
			if role and not KEEP[role] then
				local base = DIAMOND[role] or DIAMOND.fur
				local _, _, v = p.Color:ToHSV()
				p.Color = Studs.shade(base, 0.85 + v * 0.25)
				p.Reflectance = 0.25
				if role == "extra" or role == "accent" or role == "mark" then
					p.Material = Enum.Material.Glass
					p.Transparency = 0.15
				end
			end
		end
		if root then sparkles(root, Color3.fromRGB(170, 240, 255), 6) end
	elseif variant == "Rainbow" then
		-- hue sweeps from front to back; the client drifts it over time (attribute RainbowHue)
		local minZ, maxZ = math.huge, -math.huge
		for _, p in parts do
			local z = p.Position.Z
			minZ = math.min(minZ, z)
			maxZ = math.max(maxZ, z)
		end
		for _, p in parts do
			local role = p:GetAttribute("Role")
			if role and not KEEP[role] then
				local t = (p.Position.Z - minZ) / math.max(0.01, maxZ - minZ)
				local _, _, v = p.Color:ToHSV()
				p:SetAttribute("RainbowT", t)
				p:SetAttribute("RainbowV", 0.75 + v * 0.25)
				p.Color = Color3.fromHSV(t * 0.85 % 1, 0.62, 0.75 + v * 0.25)
			end
		end
		model:SetAttribute("Rainbow", true)
		if root then sparkles(root, Color3.fromRGB(255, 255, 255), 5) end
	elseif variant == "Ancient" then
		ancient(model, parts)
	elseif variant == "Clockwork" then
		clockwork(model, parts)
	end
end

return Variants
