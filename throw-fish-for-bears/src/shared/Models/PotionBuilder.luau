--[[ PotionBuilder: 3D studded models for the store.
     build(id): a LUCK POTION - square brick flask (studded base, see-through shell,
     coloured studded liquid with a lighter top layer and bubbles), shoulder, neck, lip,
     studded cork (wax seal on x5, gold points on x10), a front label and a paper tag
     hanging from the neck on a string. Faces -Z like every other model.
     pass(id): gamepass trophies - a studded four-leaf clover (x2 Luck), a stack of
     studded brick coins (x2 Money). ]]
local Shared = script.Parent.Parent
local Studs = require(script.Parent.Studs)
local PotionConfig = require(Shared.Config.PotionConfig)

local PotionBuilder = {}
local CF = CFrame.new
local V3 = Vector3.new
local ANG = CFrame.Angles
local RGB = Color3.fromRGB
local GLASS = RGB(214, 236, 246)

local function part(m, name, size, cf, color, opts)
	local p = Studs.piece(m, name, size, cf, color, "detail", opts)
	p.Anchored = true
	return p
end

function PotionBuilder.build(id: string, scale: number?): Model
	local spec = PotionConfig.get(id) or PotionConfig.get("Luck2")
	local s = scale or 1
	local m = Instance.new("Model")
	m.Name = "Potion_" .. id
	local function P(name, sx, sy, sz, x, y, z, color, opts)
		return part(m, name, V3(sx * s, sy * s, sz * s), CF(x * s, y * s, z * s), color, opts)
	end
	-- foot + flask
	local base = P("Base", 2.6, 0.4, 2.6, 0, 0.2, 0, Studs.shade(spec.liquidDark, 0.8))
	m.PrimaryPart = base
	P("LiquidDeep", 2.32, 0.6, 2.32, 0, 0.7, 0, spec.liquidDark)
	P("Liquid", 2.3, 1.75, 2.3, 0, 1.87, 0, spec.liquid)
	P("LiquidTop", 2.3, 0.3, 2.3, 0, 2.9, 0, Studs.mix(spec.liquid, Color3.new(1, 1, 1), 0.38))
	for i, b in { { -0.55, 1.3, -0.95, 0.42 }, { 0.5, 2.1, -0.97, 0.3 }, { 0.15, 1.0, -0.97, 0.24 }, { -0.2, 2.5, -0.95, 0.2 }, { 0.7, 1.55, -0.96, 0.18 } } do
		P("Bubble" .. i, b[4], b[4], b[4], b[1], b[2], b[3], Studs.mix(spec.liquid, Color3.new(1, 1, 1), 0.6), { smooth = true })
	end
	P("Shell", 2.75, 2.95, 2.75, 0, 1.88, 0, GLASS, { smooth = true, transparency = 0.74, reflectance = 0.08 })
	-- glass shine: thin pale strips on the front-left edge (no glow, just lighter glass)
	P("Shine", 0.18, 2.1, 0.06, -0.98, 1.9, -1.4, Color3.new(1, 1, 1), { smooth = true, transparency = 0.3 })
	P("Shine2", 0.12, 0.7, 0.06, -0.66, 2.6, -1.4, Color3.new(1, 1, 1), { smooth = true, transparency = 0.45 })
	-- label on the front
	P("Label", 1.5, 1.0, 0.1, 0.28, 1.55, -1.43, spec.tag)
	P("LabelBand", 1.5, 0.24, 0.12, 0.28, 1.55, -1.44, spec.liquidDark, { smooth = true })
	P("LabelDot", 0.3, 0.3, 0.12, 0.28, 1.85, -1.45, spec.liquid, { smooth = true })
	-- shoulder / neck / lip
	P("Shoulder", 2.1, 0.42, 2.1, 0, 3.56, 0, GLASS, { transparency = 0.5 })
	P("Shoulder2", 1.5, 0.3, 1.5, 0, 3.9, 0, GLASS, { transparency = 0.5 })
	P("Neck", 0.95, 0.85, 0.95, 0, 4.45, 0, GLASS, { smooth = true, transparency = 0.55 })
	P("Lip", 1.3, 0.26, 1.3, 0, 4.98, 0, GLASS, { transparency = 0.35 })
	-- cork
	P("Cork", 0.85, 0.72, 0.85, 0, 5.4, 0, spec.cork)
	P("CorkTop", 1.0, 0.22, 1.0, 0, 5.85, 0, Studs.shade(spec.cork, 0.82))
	if spec.mult >= 5 then -- wax seal dripping over the cork
		P("Wax", 1.12, 0.24, 1.12, 0, 5.6, 0, spec.liquidDark)
		P("WaxDrip", 0.24, 0.44, 0.1, 0.32, 5.36, -0.55, spec.liquidDark, { smooth = true })
		P("WaxDrip2", 0.2, 0.3, 0.1, -0.3, 5.42, -0.55, spec.liquidDark, { smooth = true })
	end
	if spec.mult >= 10 then -- four small gold points on top (a crown) + a red gem
		for _, c in { { -0.4, -0.4 }, { 0.4, -0.4 }, { -0.4, 0.4 }, { 0.4, 0.4 } } do
			P("Crown", 0.22, 0.36, 0.22, c[1], 6.12, c[2], RGB(255, 214, 60))
		end
		P("Gem", 0.34, 0.34, 0.34, 0, 6.12, 0, RGB(220, 40, 60), { smooth = true })
	end
	-- paper tag on a string, tied under the lip and hanging OUTSIDE the glass
	local a, b = V3(0.5, 4.7, -0.45), V3(1.62, 3.55, -0.7)
	local mid, len = (a + b) / 2, (b - a).Magnitude
	local str = P("String", 0.07, len, 0.07, 0, 0, 0, RGB(120, 84, 50), { smooth = true })
	str.CFrame = CFrame.lookAt(mid * s, b * s) * ANG(math.pi / 2, 0, 0)
	local tag = P("Tag", 0.66, 0.86, 0.08, 0, 0, 0, spec.tag)
	tag.CFrame = CF(1.72 * s, 3.1 * s, -0.72 * s) * ANG(0, math.rad(-22), math.rad(-10))
	local dot = P("TagDot", 0.3, 0.3, 0.1, 0, 0, 0, spec.liquid, { smooth = true })
	dot.CFrame = tag.CFrame * CF(0, -0.08 * s, -0.05 * s)
	local hole = P("TagHole", 0.12, 0.12, 0.1, 0, 0, 0, spec.liquidDark, { smooth = true })
	hole.CFrame = tag.CFrame * CF(0, 0.3 * s, -0.05 * s)
	Studs.allStuds(m)
	m:SetAttribute("Potion", id)
	return m
end

function PotionBuilder.pass(id: string, scale: number?): Model
	local s = scale or 1
	local m = Instance.new("Model")
	m.Name = "Pass_" .. id
	if id == "Luck2x" then
		local green, dark, light = RGB(64, 196, 84), RGB(30, 132, 52), RGB(140, 236, 120)
		local core = part(m, "Core", V3(1.0 * s, 1.0 * s, 0.6 * s), CF(0, 2.6 * s, 0) * ANG(0, 0, math.rad(45)), dark)
		m.PrimaryPart = core
		for k = 0, 3 do
			local a = math.rad(45 + k * 90)
			local dir = V3(math.cos(a), math.sin(a), 0)
			local c = V3(0, 2.6 * s, 0) + dir * 1.15 * s
			-- each leaf = two rotated studded blocks (a heart shape) + a lighter inner block
			for j, off in { -0.42, 0.42 } do
				local side = V3(-dir.Y, dir.X, 0) * off * s
				part(m, "Leaf" .. k .. j, V3(1.05 * s, 1.05 * s, 0.5 * s), CF(c + side + dir * 0.15 * s) * ANG(0, 0, a + math.rad(45)), green)
			end
			part(m, "Vein" .. k, V3(1.05 * s, 0.16 * s, 0.56 * s), CF(c) * ANG(0, 0, a), dark, { smooth = true })
			part(m, "Light" .. k, V3(0.5 * s, 0.5 * s, 0.56 * s), CF(c + dir * 0.35 * s) * ANG(0, 0, a + math.rad(45)), light)
		end
		local stem = part(m, "Stem", V3(0.32 * s, 2.2 * s, 0.32 * s), CF(0.3 * s, 1.05 * s, 0) * ANG(0, 0, math.rad(-16)), dark)
		m.PrimaryPart = stem
	else
		local gold, deep, pale = RGB(255, 200, 40), RGB(214, 140, 20), RGB(255, 236, 140)
		local base = part(m, "Coin1", V3(2.3 * s, 0.42 * s, 2.3 * s), CF(0, 0.21 * s, 0), deep)
		m.PrimaryPart = base
		local rots = { 8, -12, 20, -4 }
		for i = 2, 5 do
			part(m, "Coin" .. i, V3(2.3 * s, 0.42 * s, 2.3 * s), CF(((i % 2) - 0.5) * 0.2 * s, (0.21 + (i - 1) * 0.44) * s, 0) * ANG(0, math.rad(rots[i - 1]), 0),
				if i % 2 == 0 then gold else deep)
		end
		-- a big coin standing in front of the stack, with a raised "$" made of bricks
		local front = part(m, "Front", V3(2.6 * s, 2.6 * s, 0.44 * s), CF(0.4 * s, 1.5 * s, -1.6 * s) * ANG(math.rad(-10), math.rad(14), 0), gold)
		local rim = part(m, "Rim", V3(2.1 * s, 2.1 * s, 0.1 * s), front.CFrame * CF(0, 0, -0.27 * s), deep, { smooth = true })
		local _ = rim
		local bars = { { 0, 0.7, 1.1, 0.26 }, { 0, 0, 1.1, 0.26 }, { 0, -0.7, 1.1, 0.26 }, { 0.42, 0.35, 0.26, 0.72 }, { -0.42, -0.35, 0.26, 0.72 }, { 0, 0, 0.16, 1.9 } }
		for i, b in bars do
			part(m, "Dollar" .. i, V3(b[3] * s, b[4] * s, 0.16 * s), front.CFrame * CF(b[1] * s, b[2] * s, -0.36 * s), pale, { smooth = i == 6 })
		end
	end
	Studs.allStuds(m)
	return m
end

return PotionBuilder
