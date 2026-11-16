--[[ RodBuilder: stud fishing rod with a bendable 3-segment shaft and a bobber.
     Rod axis = -Z (tip forward). Rig:
       Handle (PrimaryPart, grip at origin)
        └─ "Bend1" -> Seg1 └─ "Bend2" -> Seg2 └─ "Bend3" -> Seg3 (TipAtt at the tip)
     Clients rotate Bend1..3 to bend the rod under line tension and during the cast. ]]
local Shared = script.Parent.Parent
local Studs = require(script.Parent.Studs)
local RodConfig = require(Shared.Config.RodConfig)

local RodBuilder = {}
local CF = CFrame.new
local V3 = Vector3.new
local ANG = CFrame.Angles
local DARK = Color3.fromRGB(46, 46, 50)
local METAL = Color3.fromRGB(120, 122, 128)

RodBuilder.LENGTH = 7.2

function RodBuilder.build(rodId: string): Model
	local cfg = RodConfig.get(rodId)
	local col = cfg.colors
	local model = Instance.new("Model")
	model.Name = cfg.name
	local handle = Studs.bone(model, "Handle", CF(0, 0, 0), V3(0.4, 0.4, 0.4))
	handle.Massless = false
	model.PrimaryPart = handle
	local hp = {}
	local function add(list, p) table.insert(list, p) return p end
	-- butt: two studded bricks (like the reference 2x2 brick handle)
	add(hp, Studs.piece(model, "Butt", V3(0.5, 0.42, 1.0), CF(0, 0, 1.15), col.handle, "handle"))
	add(hp, Studs.piece(model, "Butt2", V3(0.46, 0.38, 0.9), CF(0, 0, 0.2), Studs.shade(col.handle, 0.92), "handle"))
	add(hp, Studs.piece(model, "ButtCap", V3(0.54, 0.46, 0.12), CF(0, 0, 1.7), Studs.shade(col.handle, 0.7), "handle"))
	add(hp, Studs.piece(model, "Collar", V3(0.4, 0.36, 0.14), CF(0, 0, -0.3), col.band, "band", { smooth = true }))
	-- reel seat + reel
	add(hp, Studs.piece(model, "ReelSeat", V3(0.46, 0.5, 0.5), CF(0, 0.02, -0.62), DARK, "metal"))
	add(hp, Studs.piece(model, "ReelStem", V3(0.16, 0.36, 0.16), CF(0, -0.38, -0.62), METAL, "metal"))
	add(hp, Studs.piece(model, "ReelBody", V3(0.62, 0.62, 0.56), CF(0, -0.78, -0.62), METAL, "metal"))
	add(hp, Studs.piece(model, "ReelFace", V3(0.08, 0.46, 0.4), CF(0.33, -0.78, -0.62), Studs.shade(METAL, 0.8), "metal", { smooth = true }))
	add(hp, Studs.piece(model, "ReelKnobArm", V3(0.12, 0.12, 0.42), CF(0.42, -0.78, -0.48), METAL, "metal", { smooth = true }))
	local knob = add(hp, Studs.piece(model, "ReelKnob", V3(0.34, 0.24, 0.24), CF(0.6, -0.78, -0.3) * ANG(0, 0, 0), col.reel, "band", { smooth = true }))
	knob.Shape = Enum.PartType.Cylinder
	add(hp, Studs.piece(model, "ReelSpool", V3(0.1, 0.3, 0.3), CF(-0.33, -0.78, -0.62), col.reel, "band", { smooth = true }))
	Studs.weldAll(handle, hp)

	-- shaft segments
	local L = RodBuilder.LENGTH
	local z0 = -0.9
	local segLen = { L * 0.36, L * 0.3, L * 0.24 }
	local thick = { 0.26, 0.2, 0.15 }
	local prev = handle
	local zStart = z0
	local tipAtt
	for i = 1, 3 do
		local len = segLen[i]
		local pivot = CF(0, 0.02, zStart)
		local bone = Studs.bone(model, "Seg" .. i, pivot)
		local parts = {}
		add(parts, Studs.piece(model, "Shaft", V3(thick[i], thick[i], len), pivot * CF(0, 0, -len / 2), col.shaft, "shaft"))
		-- coloured bands
		local bands = if i == 1 then { 0.08, 0.55 } elseif i == 2 then { 0.3, 0.85 } else { 0.5 }
		for _, f in bands do
			add(parts, Studs.piece(model, "Band", V3(thick[i] + 0.08, thick[i] + 0.08, 0.16), pivot * CF(0, 0, -len * f), col.band, "band", { smooth = true }))
		end
		-- line guide ring under the shaft
		local ring = add(parts, Studs.piece(model, "Guide", V3(0.05, 0.22, 0.22), pivot * CF(0, -thick[i] / 2 - 0.13, -len * 0.7) * ANG(0, math.pi / 2, 0), DARK, "metal", { smooth = true }))
		ring.Shape = Enum.PartType.Cylinder
		add(parts, Studs.piece(model, "GuideStem", V3(0.05, 0.12, 0.05), pivot * CF(0, -thick[i] / 2 - 0.04, -len * 0.7), DARK, "metal", { smooth = true }))
		if i == 3 then
			add(parts, Studs.piece(model, "TipCap", V3(0.16, 0.16, 0.18), pivot * CF(0, 0, -len - 0.06), DARK, "metal", { smooth = true }))
			tipAtt = Instance.new("Attachment")
			tipAtt.Name = "TipAtt"
			tipAtt.Position = V3(0, 0, -len - 0.14)
			tipAtt.Parent = bone
		end
		Studs.weldAll(bone, parts)
		Studs.motor("Bend" .. i, prev, bone, pivot)
		prev = bone
		zStart -= len
	end
	model:SetAttribute("Kind", "Rod")
	model:SetAttribute("RodId", rodId)
	return model
end

-- the floating bobber (client side visual), returns model with BobAtt at the line eye
function RodBuilder.buildBobber(rodId: string): Model
	local cfg = RodConfig.get(rodId)
	local model = Instance.new("Model")
	model.Name = "Bobber"
	local body = Studs.piece(model, "Body", V3(0.62, 0.62, 0.62), CF(), Color3.fromRGB(245, 245, 245), "bobber", { smooth = true, shape = Enum.PartType.Ball })
	body.Massless = false
	model.PrimaryPart = body
	local parts = {}
	local top = Studs.piece(model, "Cap", V3(0.5, 0.3, 0.5), CF(0, 0.18, 0), cfg.colors.bobber, "bobber", { smooth = true, shape = Enum.PartType.Ball })
	table.insert(parts, top)
	local band = Studs.piece(model, "Band", V3(0.14, 0.66, 0.66), CF(0, 0.02, 0) * ANG(0, 0, math.pi / 2), cfg.colors.bobber, "bobber", { smooth = true, shape = Enum.PartType.Cylinder })
	table.insert(parts, band)
	table.insert(parts, Studs.piece(model, "Stick", V3(0.08, 0.32, 0.08), CF(0, 0.44, 0), Color3.fromRGB(60, 60, 64), "bobber", { smooth = true }))
	table.insert(parts, Studs.piece(model, "Sinker", V3(0.22, 0.3, 0.22), CF(0, -0.62, 0), METAL, "bobber"))
	table.insert(parts, Studs.piece(model, "SinkerLine", V3(0.03, 0.3, 0.03), CF(0, -0.38, 0), Color3.fromRGB(230, 230, 230), "bobber", { smooth = true }))
	Studs.weldAll(body, parts)
	local att = Instance.new("Attachment")
	att.Name = "BobAtt"
	att.Position = V3(0, 0.58, 0)
	att.Parent = body
	return model
end

return RodBuilder
