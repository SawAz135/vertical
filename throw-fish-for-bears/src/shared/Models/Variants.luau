--[[ Variants: recolours a built bear / fish model by part Role.
     Golden  : warm gold studs, slight reflectance, gold sparkle
     Diamond : cyan crystal tones, glass-like facets, cold glints
     Rainbow : controlled hue sweep along the body (client animates the hue drift)
     Eyes, pupils, noses, mouths and claws keep their colour so the face stays readable. ]]
local Studs = require(script.Parent.Studs)

local Variants = {}

local KEEP = { eye = true, pupil = true, nose = true, mouth = true, claw = true, tongue = true }

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
	end
end

return Variants
