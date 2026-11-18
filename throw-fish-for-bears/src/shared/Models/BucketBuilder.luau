--[[ BucketBuilder: the fishermen's bucket on the beach, one look per level:
       1 Wooden Pail    : small pail, rope handle
       2 Big Bucket     : bigger pail, 2 metal bands, handle
       3 Fish Barrel    : bulging barrel, 3 bands
       4 Golden Barrel  : barrel with gold bands and gold studs
       5 Royal Vat      : big vat, gold bands, little red pennant
     Built around the origin, bottom at y = 0. Parts:
       "Fill"   : the water / fish level inside (resized by the server with the count)
       "Anchor" : invisible part for the prompts / billboard
     Attributes: Inner (inner radius), Depth (inner height). ]]
local Studs = require(script.Parent.Studs)

local BucketBuilder = {}
local V3, CF, ANG = Vector3.new, CFrame.new, CFrame.Angles
local RGB = Color3.fromRGB

local LOOK = {
	{ r = 1.25, h = 1.5, wood = RGB(176, 112, 56), band = RGB(110, 110, 120), bands = 1, handle = true, flare = 0.18 },
	{ r = 1.6, h = 1.9, wood = RGB(166, 102, 50), band = RGB(120, 120, 132), bands = 2, handle = true, flare = 0.15 },
	{ r = 1.95, h = 2.5, wood = RGB(150, 92, 44), band = RGB(70, 70, 78), bands = 3, bulge = 0.25 },
	{ r = 2.15, h = 2.7, wood = RGB(140, 84, 40), band = RGB(255, 200, 50), bands = 3, bulge = 0.28, studs = true },
	{ r = 2.7, h = 2.4, wood = RGB(120, 70, 34), band = RGB(255, 200, 50), bands = 3, bulge = 0.12, studs = true, pennant = true },
}

function BucketBuilder.build(level: number): Model
	level = math.clamp(level, 1, #LOOK)
	local L = LOOK[math.clamp(level, 1, #LOOK)]
	local m = Instance.new("Model")
	m.Name = "FishBucket"
	local function part(name, size, cf, color, opts)
		return Studs.static(m, name, size, cf, color, opts)
	end
	local N = 12
	local r, h = L.r, L.h
	local lift = 0.5 -- the bucket stands on a little stud pallet
	-- PALLET: 3 studded planks on 2 cross beams
	local pw = r * 2 + 1.2
	for i = -1, 1 do
		part("PalletPlank", V3(pw, 0.3, pw / 3 - 0.08), CF(0, 0.35, i * pw / 3), if i == 0 then RGB(176, 112, 56) else RGB(160, 98, 46))
	end
	for _, sx in { -1, 1 } do
		part("PalletBeam", V3(0.5, 0.2, pw), CF(sx * (pw / 2 - 0.4), 0.1, 0), RGB(120, 76, 36))
	end
	-- name plate on the pallet front
	part("Plate", V3(2.2, 0.7, 0.18), CF(0, 0.75, -(pw / 2 + 0.05)) * ANG(-0.3, 0, 0), RGB(240, 220, 160))
	part("PlateFrame", V3(2.4, 0.9, 0.12), CF(0, 0.75, -(pw / 2)) * ANG(-0.3, 0, 0), RGB(110, 70, 34))
	local base = CF(0, lift, 0)
	-- bottom
	part("Bottom", V3(0.3, r * 2, r * 2), base * CF(0, 0.15, 0) * ANG(0, 0, math.pi / 2), Studs.shade(L.wood, 0.8), { shape = Enum.PartType.Cylinder })
	-- staves (a pail flares out at the top, a barrel bulges in the middle)
	local w = 2 * math.pi * r / N * 1.08
	for i = 0, N - 1 do
		local a = i / N * math.pi * 2
		local col = if i % 2 == 0 then L.wood else Studs.shade(L.wood, 0.9)
		if L.bulge then
			-- 2 halves leaning out, meeting at the bulge
			for _, half in { -1, 1 } do
				local lean = half * math.atan(L.bulge / (h / 2))
				local cf = base * CF(0, h / 2, 0) * ANG(0, a, 0) * CF(0, half * h / 4, -(r + L.bulge / 2)) * ANG(lean, 0, 0)
				part("Stave", V3(w * (1 + L.bulge / r * 0.5), h / 2 + 0.05, 0.3), cf, col)
			end
		else
			local lean = -math.atan(L.flare)
			local cf = base * CF(0, h / 2, 0) * ANG(0, a, 0) * CF(0, 0, -(r + L.flare * h / 2)) * ANG(lean, 0, 0)
			part("Stave", V3(w * (1 + L.flare * 0.6), h, 0.3), cf, col)
		end
	end
	-- metal bands
	local bandYs = if L.bands == 1 then { h * 0.75 } elseif L.bands == 2 then { h * 0.25, h * 0.75 } else { h * 0.15, h * 0.5, h * 0.85 }
	for _, y in bandYs do
		local out = if L.bulge then L.bulge * (1 - math.abs(y - h / 2) / (h / 2)) else L.flare * (y - h / 2)
		for i = 0, N - 1 do
			local a = (i + 0.5) / N * math.pi * 2
			-- bands follow the stave lean (pail) so they hug the wood
			local lean = if L.bulge then 0 else -math.atan(L.flare)
			part("Band", V3(w * 1.14, 0.24, 0.12), base * CF(0, y, 0) * ANG(0, a, 0) * CF(0, 0, -(r + out + 0.2)) * ANG(lean, 0, 0), L.band, { smooth = true })
			if (L.studs or i % 3 == 0) and i % 2 == 0 then
				part("Rivet", V3(0.14, 0.14, 0.08), base * CF(0, y, 0) * ANG(0, a, 0) * CF(0, 0, -(r + out + 0.28)) * ANG(lean, 0, 0), if L.studs then RGB(255, 230, 120) else RGB(170, 170, 180), { smooth = true })
			end
		end
	end
	-- rim
	local rimR = r + (if L.bulge then 0 else L.flare * h / 2)
	for i = 0, N - 1 do
		local a = (i + 0.5) / N * math.pi * 2
		part("Rim", V3(w * 1.15, 0.2, 0.36), base * CF(0, h + 0.05, 0) * ANG(0, a, 0) * CF(0, 0, -(rimR + 0.05)), Studs.shade(L.wood, 0.75))
	end
	-- handle (pails)
	if L.handle then
		-- a continuous rope handle (overlapping segments along the arc) + metal ears
		local segs = 16
		for i = 0, segs - 1 do
			local a0, a1 = math.pi * (i / segs), math.pi * ((i + 1) / segs)
			local p0 = V3(math.cos(a0) * (rimR + 0.12), lift + h + math.sin(a0) * rimR * 0.85, 0)
			local p1 = V3(math.cos(a1) * (rimR + 0.12), lift + h + math.sin(a1) * rimR * 0.85, 0)
			part("Handle", V3(0.18, 0.18, (p1 - p0).Magnitude + 0.08), CFrame.lookAt((p0 + p1) / 2, p1), RGB(196, 160, 104), { smooth = true, noCollide = true })
		end
		for _, sx in { -1, 1 } do
			part("Ear", V3(0.2, 0.5, 0.4), CF(sx * (rimR + 0.15), lift + h - 0.2, 0), L.band, { smooth = true })
		end
	end
	if L.pennant then
		part("Pole", V3(0.14, 2.2, 0.14), CF(rimR * 0.7, lift + h + 1.1, rimR * 0.4), RGB(255, 200, 50), { smooth = true, noCollide = true })
		part("Pennant", V3(0.06, 0.6, 1.1), CF(rimR * 0.7, lift + h + 1.9, rimR * 0.4 - 0.55), RGB(210, 30, 40), { noCollide = true })
		part("PoleTop", V3(0.3, 0.3, 0.3), CF(rimR * 0.7, lift + h + 2.25, rimR * 0.4), RGB(255, 220, 90), { shape = Enum.PartType.Ball, smooth = true, noCollide = true })
	end
	-- DECOR around the bucket (more with the level) -----------------------------------
	local side = r + 1.6
	if level >= 3 then
		-- coiled rope
		for k = 0, 2 do
			for i = 0, 9 do
				local a = i / 10 * math.pi * 2
				local rr = 0.75 - k * 0.12
				part("Rope", V3(0.5, 0.22, 0.24), CF(side, 0.12 + k * 0.22, -0.6) * ANG(0, a, 0) * CF(0, 0, -rr), RGB(206, 176, 120), { noCollide = true })
			end
		end
		-- an oar leaning on the bucket
		part("OarShaft", V3(0.22, 4.2, 0.22), CF(-side + 0.3, lift + 1.9, 0.4) * ANG(0, 0, -0.32), RGB(176, 120, 60), { noCollide = true })
		part("OarBlade", V3(0.7, 1.2, 0.14), CF(-side - 0.35, 0.65, 0.4) * ANG(0, 0, -0.32), RGB(196, 140, 74), { noCollide = true })
	end
	if level >= 4 then
		-- a pile of gold coins
		for i = 0, 7 do
			local a = i * 2.4
			local rr = 0.25 + (i % 3) * 0.2
			part("Coin", V3(0.12, 0.5, 0.5), CF(side * 0.9 + math.cos(a) * rr, 0.06 + math.floor(i / 3) * 0.13, 1.4 + math.sin(a) * rr) * ANG(0, 0, math.pi / 2),
				RGB(255, 205, 50), { shape = Enum.PartType.Cylinder, smooth = true, noCollide = true })
		end
	end
	if level >= 5 then
		-- a little treasure chest
		local cc = CF(-side, 0, -1.4) * ANG(0, 0.5, 0)
		part("Chest", V3(1.6, 0.9, 1.0), cc * CF(0, 0.45, 0), RGB(130, 70, 30))
		part("ChestLid", V3(1.6, 0.4, 1.0), cc * CF(0, 1.1, 0.2) * ANG(-0.6, 0, 0), RGB(150, 84, 36))
		part("ChestBand", V3(1.64, 0.2, 1.04), cc * CF(0, 0.75, 0), RGB(255, 200, 50), { smooth = true })
		part("ChestLock", V3(0.3, 0.36, 0.1), cc * CF(0, 0.75, -0.54), RGB(255, 200, 50), { smooth = true })
		part("ChestGold", V3(1.4, 0.2, 0.8), cc * CF(0, 0.95, 0), RGB(255, 210, 60), { noCollide = true })
	end
	-- the water / fish level (resized with the count by the server)
	local fill = part("Fill", V3(0.2, (rimR - 0.25) * 2, (rimR - 0.25) * 2), base * CF(0, 0.4, 0) * ANG(0, 0, math.pi / 2), RGB(80, 160, 220),
		{ shape = Enum.PartType.Cylinder, smooth = true, noCollide = true, raw = true })
	fill.Transparency = 0.15
	local anchor = part("Anchor", V3(1, 1, 1), CF(0, lift + h + 1, 0), RGB(255, 255, 255), { noCollide = true, noQuery = true })
	anchor.Transparency = 1
	m.PrimaryPart = part("Base", V3(r * 2, 0.1, r * 2), CF(0, 0.05, 0), Studs.shade(L.wood, 0.7), { noCollide = true })
	m.PrimaryPart.Transparency = 1
	m.WorldPivot = CF(0, 0, 0)
	m:SetAttribute("Inner", rimR - 0.25)
	m:SetAttribute("Depth", h - 0.4)
	m:SetAttribute("Bottom", lift + 0.3)
	m:SetAttribute("Top", lift + h)
	m:SetAttribute("FishBucket", true)
	return m
end

return BucketBuilder
