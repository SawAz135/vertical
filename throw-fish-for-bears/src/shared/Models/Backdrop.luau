--[[ Backdrop: the mountains behind the corridor walls (the walls are 32 studs high, the
     mountains rise well above them so every zone feels framed and FULL).
     Fully procedural and organic (no repeating pattern):
       - a ridge line from layered noise decides the height along the corridor
       - NEAR range (right behind the wall): stepped stud cliffs built from strata of
         randomly sized / rotated / offset blocks, darker strata lines, cracks, overhangs,
         ledges with grass / snow / sand caps (snow drips over the edges), boulders, and
         TREES growing on the ledges in irregular clumps (zone themed)
       - forested hills in some places instead of bare rock (trees ARE the mass there)
       - rock spires here and there, a waterfall (frozen in the ice zone) somewhere random
       - FAR range: big simple peaks further out for depth, snow capped in cold zones
     Everything is anchored static studs (the cliffs are giant toy bricks). ]]
local Studs = require(script.Parent.Studs)

local Backdrop = {}
local V3, CF, ANG = Vector3.new, CFrame.new, CFrame.Angles
local C = Color3.fromRGB

-- per theme: rock tones, cap colour, tree kinds (weighted), snow on top?
local THEMES = {
	forest = { rock = { C(138, 136, 128), C(118, 116, 110), C(156, 152, 142) }, cap = C(78, 158, 52), trees = { broad = 6, pine = 2 }, hills = 0.35 },
	pine = { rock = { C(126, 120, 112), C(104, 100, 94), C(146, 140, 130) }, cap = C(66, 128, 50), trees = { pine = 8, broad = 1 }, hills = 0.3 },
	lake = { rock = { C(128, 136, 144), C(108, 116, 124), C(148, 154, 160) }, cap = C(84, 150, 70), trees = { pine = 4, broad = 3 }, hills = 0.25 },
	snow = { rock = { C(128, 132, 144), C(108, 112, 124), C(150, 154, 164) }, cap = C(244, 248, 255), snow = true, trees = { snowpine = 8 }, hills = 0.2 },
	ice = { rock = { C(148, 168, 190), C(120, 144, 170), C(172, 192, 212) }, cap = C(240, 248, 255), snow = true, ice = true, trees = { snowpine = 3 }, hills = 0.05 },
	bamboo = { rock = { C(150, 140, 118), C(128, 118, 98), C(168, 158, 134) }, cap = C(96, 152, 60), trees = { bamboo = 5, cherry = 3 }, hills = 0.35 },
	river = { rock = { C(128, 132, 122), C(108, 112, 104), C(146, 150, 140) }, cap = C(80, 150, 60), trees = { broad = 5, pine = 2 }, hills = 0.3 },
	rocky = { rock = { C(158, 118, 92), C(132, 96, 74), C(176, 138, 106) }, cap = C(140, 150, 80), trees = { dead = 3, pine = 2 }, hills = 0.05, spires = 0.3 },
	deep = { rock = { C(92, 98, 90), C(74, 80, 74), C(108, 114, 104) }, cap = C(52, 100, 42), trees = { dark = 5, mushroom = 2 }, hills = 0.45 },
	beach = { rock = { C(222, 192, 142), C(198, 168, 122), C(236, 210, 164) }, cap = C(150, 196, 84), trees = { palm = 6 }, hills = 0.2 },
}

local MOSSY = { forest = true, pine = true, lake = true, bamboo = true, river = true, deep = true }
local EARTH = C(122, 92, 60)
local SKY = C(170, 205, 235)

local function pick(r: Random, weights)
	local total = 0
	for _, w in weights do total += w end
	local x = r:NextNumber() * total
	for k, w in weights do
		x -= w
		if x <= 0 then return k end
	end
	return next(weights)
end

local function vary(r: Random, c: Color3, amt: number): Color3
	return Studs.shade(c, 1 + (r:NextNumber() - 0.5) * amt)
end

-- TREES ------------------------------------------------------------------------------------
local TREE = {}

function TREE.broad(p, base: Vector3, s: number, r: Random, leaf: Color3?)
	local lc = leaf or C(70, 150, 50)
	local h = (5 + r:NextNumber() * 3) * s
	Studs.static(p, "Trunk", V3(1.4 * s, h, 1.4 * s), CF(base + V3(0, h / 2, 0)), C(110, 74, 42), { noShadow = true })
	-- an irregular canopy: 3-4 overlapping blocks, a lighter crown on top
	local n = 3 + r:NextInteger(0, 1)
	for i = 1, n do
		local w = (3.2 + r:NextNumber() * 2.6) * s
		local off = V3((r:NextNumber() - 0.5) * 3 * s, h + (r:NextNumber() * 2.2 - 0.4) * s, (r:NextNumber() - 0.5) * 3 * s)
		Studs.static(p, "Leaves", V3(w, w * (0.55 + r:NextNumber() * 0.25), w), CF(base + off) * ANG(0, r:NextNumber() * 1.5, 0), vary(r, lc, 0.22), { noShadow = i > 2 })
	end
	Studs.static(p, "Crown", V3(2.6 * s, 1.4 * s, 2.6 * s), CF(base + V3(0, h + 2.6 * s, 0)) * ANG(0, r:NextNumber(), 0), Studs.shade(lc, 1.18), { noShadow = true })
end

function TREE.pine(p, base: Vector3, s: number, r: Random, snowy: boolean?)
	local h = (2 + r:NextNumber()) * s
	Studs.static(p, "Trunk", V3(1.1 * s, h, 1.1 * s), CF(base + V3(0, h / 2, 0)), C(96, 62, 36), { noShadow = true })
	local tiers = 3 + r:NextInteger(0, 1)
	local y = h
	for i = 1, tiers do
		local w = (6 - i * 1.05) * s * (0.9 + r:NextNumber() * 0.2)
		local th = 1.7 * s
		Studs.static(p, "Needles", V3(w, th, w), CF(base + V3(0, y + th / 2, 0)) * ANG(0, r:NextNumber() * 0.8, 0), vary(r, C(40, 110, 50), 0.18), { noShadow = i > 1 })
		if snowy and i >= tiers - 1 then
			Studs.static(p, "Snow", V3(w * 0.84, 0.4 * s, w * 0.84), CF(base + V3(0, y + th + 0.2 * s, 0)), C(244, 248, 255), { noShadow = true })
		end
		y += th * 0.9
	end
	Studs.static(p, "Tip", V3(0.9 * s, 1.4 * s, 0.9 * s), CF(base + V3(0, y + 0.7 * s, 0)), if snowy then C(244, 248, 255) else C(52, 126, 58), { noShadow = true })
end

function TREE.snowpine(p, base, s, r) TREE.pine(p, base, s, r, true) end

function TREE.dark(p, base, s, r) TREE.broad(p, base, s * 1.2, r, C(38, 98, 42)) end

function TREE.cherry(p, base, s, r) TREE.broad(p, base, s * 0.9, r, C(250, 170, 200)) end

function TREE.bamboo(p, base: Vector3, s: number, r: Random)
	for _ = 1, 2 + r:NextInteger(0, 2) do
		local off = V3((r:NextNumber() - 0.5) * 3 * s, 0, (r:NextNumber() - 0.5) * 3 * s)
		local hgt = (9 + r:NextNumber() * 7) * s
		local lean = (r:NextNumber() - 0.5) * 0.12
		local stalk = CF(base + off) * ANG(lean, 0, lean)
		Studs.static(p, "Bamboo", V3(0.55 * s, hgt, 0.55 * s), stalk * CF(0, hgt / 2, 0), if r:NextNumber() < 0.5 then C(120, 176, 72) else C(104, 160, 62), { noShadow = true })
		Studs.static(p, "Node", V3(0.66 * s, 0.16 * s, 0.66 * s), stalk * CF(0, hgt * 0.55, 0), C(86, 132, 50), { smooth = true, noShadow = true })
		local top = stalk * CF(0, hgt, 0)
		for k = 0, 1 do
			Studs.static(p, "BambooLeaf", V3(2.4 * s, 0.14 * s, 0.6 * s), top * ANG(0, k * 2.1 + r:NextNumber(), -0.4) * CF(1 * s, 0, 0), C(96, 168, 70), { noShadow = true })
		end
	end
end

function TREE.palm(p, base: Vector3, s: number, r: Random)
	local bend = (r:NextNumber() - 0.5) * 0.5
	local dir = r:NextNumber() * math.pi * 2
	local cf = CF(base) * ANG(0, dir, 0)
	local segs = 6 + r:NextInteger(0, 2)
	for k = 0, segs - 1 do
		cf = cf * ANG(bend / segs, 0, 0) * CF(0, 1.3 * s, 0)
		Studs.static(p, "PalmTrunk", V3(0.9 * s, 1.35 * s, 0.9 * s), cf, if k % 2 == 0 then C(150, 112, 70) else C(132, 96, 58), { noShadow = true })
	end
	for k = 0, 6 do
		Studs.static(p, "Frond", V3(4.4 * s, 0.2 * s, 1.1 * s), cf * ANG(0, k * 0.9, 0) * CF(2 * s, 0.2 * s, 0) * ANG(0, 0, -0.35), vary(r, C(70, 160, 56), 0.15), { noShadow = true })
	end
	Studs.static(p, "Coconut", V3(0.7 * s, 0.7 * s, 0.7 * s), cf * CF(0.4 * s, -0.4 * s, 0), C(110, 76, 40), { shape = Enum.PartType.Ball, smooth = true, noShadow = true })
end

function TREE.mushroom(p, base: Vector3, s: number, r: Random)
	local h = (5 + r:NextNumber() * 4) * s
	Studs.static(p, "Stem", V3(1.4 * s, h, 1.4 * s), CF(base + V3(0, h / 2, 0)), C(236, 226, 206), { noShadow = true })
	local cap = if r:NextNumber() < 0.5 then C(200, 50, 46) else C(140, 70, 200)
	Studs.static(p, "Cap", V3(6 * s, 1.6 * s, 6 * s), CF(base + V3(0, h + 0.4 * s, 0)), cap)
	Studs.static(p, "CapTop", V3(4 * s, 1.1 * s, 4 * s), CF(base + V3(0, h + 1.6 * s, 0)), cap, { noShadow = true })
	for _ = 1, 4 do
		Studs.static(p, "Dot", V3(0.7 * s, 0.2 * s, 0.7 * s), CF(base + V3((r:NextNumber() - 0.5) * 4 * s, h + 2.2 * s, (r:NextNumber() - 0.5) * 4 * s)), C(250, 250, 250), { smooth = true, noShadow = true })
	end
end

function TREE.dead(p, base: Vector3, s: number, r: Random)
	local h = (5 + r:NextNumber() * 3) * s
	Studs.static(p, "DeadTrunk", V3(1 * s, h, 1 * s), CF(base + V3(0, h / 2, 0)) * ANG(0, 0, (r:NextNumber() - 0.5) * 0.2), C(120, 100, 84), { noShadow = true })
	for _ = 1, 3 do
		Studs.static(p, "Branch", V3(0.5 * s, 2.6 * s, 0.5 * s), CF(base + V3(0, h * (0.5 + r:NextNumber() * 0.4), 0)) * ANG(0, r:NextNumber() * 6.28, 0.8) * CF(0, 1.2 * s, 0), C(110, 92, 76), { noShadow = true })
	end
end

-- ROCK MASSES ----------------------------------------------------------------------------------
-- a stepped cliff: strata of random blocks, each layer narrower, with a cap on every ledge
-- `face` = unit vector pointing from the cliff toward the corridor (+/-X)
local HIDDEN = 28 -- everything below this height is hidden by the 32-stud wall
local function cliff(p, T, base: Vector3, face: Vector3, H: number, W: number, D: number, r: Random, onLedge)
	-- one solid block for the part the wall hides (performance), details only above it
	local hidden = math.min(HIDDEN, H - 6)
	Studs.static(p, "RockBase", V3(W, hidden, D), CF(base + V3(0, hidden / 2, 0)), vary(r, T.rock[2], 0.06), { noShadow = true })
	local layers = math.clamp(math.floor((H - hidden) / 8) + r:NextInteger(0, 1), 1, 5)
	local y = hidden
	H = H - hidden
	local w, d = W, D
	local center = base
	for li = 1, layers do
		local lh = (H / layers) * (0.75 + r:NextNumber() * 0.5)
		-- 2-3 overlapping blocks per layer, rotated a little, never aligned
		local blocks = if r:NextNumber() < 0.6 then 2 else 1
		for b = 1, blocks do
			local bw = w * (0.55 + r:NextNumber() * 0.45)
			local bd = d * (0.55 + r:NextNumber() * 0.45)
			local off = V3((r:NextNumber() - 0.5) * (w - bw), 0, (r:NextNumber() - 0.5) * (d - bd))
			local col = T.rock[r:NextInteger(1, #T.rock)]
			if T.earth and b == 1 and r:NextNumber() < 0.22 then col = EARTH end
			Studs.static(p, "Rock", V3(bw, lh, bd), CF(center + off + V3(0, y + lh / 2, 0)) * ANG(0, (r:NextNumber() - 0.5) * 0.35, 0), vary(r, col, 0.1),
				{ noShadow = li > 2 })
		end
		-- a dark strata line on the face
		Studs.static(p, "Strata", V3(0.3, 0.35, d * 0.9), CF(center + face * (w * 0.5 + 0.05) + V3(0, y + lh * 0.1, 0)) * ANG(0, 0, 0), Studs.shade(T.rock[2], 0.75),
			{ noShadow = true, noCollide = true, smooth = true })
		-- moss patches on the face (green zones)
		if T.moss and r:NextNumber() < 0.5 then
			for _ = 1, 1 do
				Studs.static(p, "Moss", V3(0.4, lh * (0.25 + r:NextNumber() * 0.35), d * (0.15 + r:NextNumber() * 0.25)),
					CF(center + face * (w * 0.5 + 0.12) + V3(0, y + lh * (0.3 + r:NextNumber() * 0.5), (r:NextNumber() - 0.5) * d * 0.7)), vary(r, T.cap, 0.15),
					{ noShadow = true, noCollide = true })
			end
		end
		-- a crack now and then
		if r:NextNumber() < 0.35 then
			Studs.static(p, "Crack", V3(0.25, lh * 0.7, 0.4), CF(center + face * (w * 0.5 + 0.08) + V3(0, y + lh * 0.5, (r:NextNumber() - 0.5) * d * 0.7)) * ANG((r:NextNumber() - 0.5) * 0.4, 0, 0),
				C(60, 58, 56), { noShadow = true, noCollide = true, smooth = true })
		end
		y += lh
		-- the ledge cap (grass / snow / sand), with drips over the edge in the cold
		local cw, cd = w * (0.86 + r:NextNumber() * 0.14), d * (0.86 + r:NextNumber() * 0.14)
		local capCF = CF(center + V3((r:NextNumber() - 0.5) * w * 0.08, y + 0.4, (r:NextNumber() - 0.5) * d * 0.08))
		Studs.static(p, "Cap", V3(cw, 0.8, cd), capCF, vary(r, T.cap, 0.08), { noShadow = true })
		-- the cover SPILLS over the front edge (grass tufts / snow drips / sand runs)
		for _ = 1, 1 + r:NextInteger(0, 1) do
			Studs.static(p, "Spill", V3(0.9, 0.6 + r:NextNumber() * 1.8, 0.9 + r:NextNumber() * 1.6), capCF * CF(face.X * (cw * 0.5 + 0.1), -0.8, (r:NextNumber() - 0.5) * cd * 0.85),
				vary(r, T.cap, 0.1), { noShadow = true, noCollide = true })
		end
		-- bushes along the ledge
		if not T.snow and r:NextNumber() < 0.4 then
			for _ = 1, 1 do
				local bs = 1.4 + r:NextNumber() * 1.6
				Studs.static(p, "Bush", V3(bs, bs * 0.7, bs), capCF * CF(face.X * cw * (0.2 + r:NextNumber() * 0.25), bs * 0.35 + 0.3, (r:NextNumber() - 0.5) * cd * 0.8),
					vary(r, Studs.shade(T.cap, 0.88), 0.15), { noShadow = true })
			end
		end
		if onLedge then onLedge(capCF.Position + V3(0, 0.3, 0), cw, cd, li == layers) end
		-- the next layer steps back from the corridor and shrinks
		local step = 0.07 + r:NextNumber() * 0.12
		center = center - face * (w * step * 0.5) + V3(0, 0, (r:NextNumber() - 0.5) * d * 0.12)
		w *= 1 - step
		d *= 0.9 + r:NextNumber() * 0.08
	end
	-- an overhang slab sticking out of the upper face sometimes
	if r:NextNumber() < 0.35 then
		local oy = hidden + H * (0.4 + r:NextNumber() * 0.4)
		Studs.static(p, "Overhang", V3(W * 0.35, 1.6, D * 0.4), CF(base + face * (W * 0.32) + V3(0, oy, (r:NextNumber() - 0.5) * D * 0.4)) * ANG(0, 0, face.X * 0.08),
			vary(r, T.rock[1], 0.1), { noShadow = true })
	end
	return y
end

-- MAIN ------------------------------------------------------------------------------------------
-- builds the backdrop of one zone on one side
--   side = -1 (left wall) / 1 (right wall); wallX = |x| of the wall's outer face
-- clampStart: nothing may stick out in front of zA (the corridor entrance: shop / sell area)
function Backdrop.build(parent: Instance, theme: string, zA: number, zB: number, side: number, wallX: number, seed: number, wallH: number, clampStart: boolean?)
	local T = table.clone(THEMES[theme] or THEMES.forest)
	T.moss = MOSSY[theme] == true
	T.earth = not T.snow
	local r = Random.new(seed)
	local folder = Instance.new("Model")
	folder.Name = "Backdrop"
	folder.Parent = parent
	pcall(function() folder.ModelStreamingMode = Enum.ModelStreamingMode.Nonatomic end)
	local face = V3(-side, 0, 0) -- toward the corridor
	local nx = r:NextNumber() * 1000
	local function ridge(z: number): number
		-- layered noise: big swells + mid bumps + small jitter
		return 0.55 * math.noise(nx, z / 140) + 0.3 * math.noise(nx + 7, z / 55) + 0.15 * math.noise(nx + 19, z / 21)
	end
	local function plant(at: Vector3, w: number, d: number, top: boolean)
		-- irregular clumps: sometimes none, sometimes a little grove
		local n = if top then r:NextInteger(1, 3) else (if r:NextNumber() < 0.6 then r:NextInteger(1, 2) else 0)
		for _ = 1, n do
			local kind = pick(r, T.trees)
			local pos = at + V3((r:NextNumber() - 0.5) * w * 0.7, 0, (r:NextNumber() - 0.5) * d * 0.7)
			TREE[kind](folder, pos, 0.95 + r:NextNumber() * 0.7, r)
		end
	end
	local length = math.abs(zA - zB)
	local z = zA - r:NextNumber() * 6
	local waterfallAt = zA - length * (0.2 + r:NextNumber() * 0.6)
	local didFall = false
	while z > zB do
		local step = 26 + r:NextNumber() * 16
		local zc = z - step / 2
		local h0 = ridge(zc)
		local H = wallH + 8 + (h0 + 0.5) * 30 + r:NextNumber() * 8 -- always above the wall
		local W = 24 + r:NextNumber() * 16
		local D = step + 12 + r:NextNumber() * 12
		if clampStart then D = math.min(D, math.max(4, (zA - 1 - zc) * 2)) end
		local x = side * (wallX + 2 + r:NextNumber() * 6 + W * 0.5)
		local base = V3(x, 0, zc)
		local roll = r:NextNumber()
		if roll < (T.hills or 0.25) then
			-- FORESTED HILL: a low rounded rock base, the trees ARE the mass
			local hh = wallH + 2 + r:NextNumber() * 6
			cliff(folder, T, base, face, hh, W * 1.1, D, r, nil)
			for _ = 1, 3 + r:NextInteger(0, 3) do
				local kind = pick(r, T.trees)
				TREE[kind](folder, base + V3((r:NextNumber() - 0.5) * W, hh + 0.6, (r:NextNumber() - 0.5) * D), 1.1 + r:NextNumber() * 0.8, r)
			end
		elseif roll < (T.hills or 0.25) + (T.spires or 0.08) then
			-- ROCK SPIRES: 2-3 tall thin pillars of stacked chunks
			for _ = 1, 2 + r:NextInteger(0, 1) do
				local sp = base + V3((r:NextNumber() - 0.5) * W * 0.6, 0, (r:NextNumber() - 0.5) * D * 0.6)
				local sh = H * (0.8 + r:NextNumber() * 0.4)
				local sw = 9 + r:NextNumber() * 5
				Studs.static(folder, "SpireBase", V3(sw + 2, HIDDEN, sw + 2), CF(sp + V3(0, HIDDEN / 2, 0)), vary(r, T.rock[2], 0.06), { noShadow = true })
				local yy = HIDDEN
				while yy < sh do
					local ch = 4 + r:NextNumber() * 5
					Studs.static(folder, "Spire", V3(sw, ch, sw * (0.8 + r:NextNumber() * 0.3)), CF(sp + V3((r:NextNumber() - 0.5) * 1.2, yy + ch / 2, 0)) * ANG(0, r:NextNumber(), 0),
						vary(r, T.rock[r:NextInteger(1, #T.rock)], 0.1), { noShadow = yy > 10 })
					yy += ch
					sw *= 0.86
				end
				Studs.static(folder, "SpireCap", V3(sw + 1, 0.6, sw + 1), CF(sp + V3(0, yy + 0.3, 0)), T.cap, { noShadow = true })
				if r:NextNumber() < 0.5 then plant(sp + V3(0, yy + 0.6, 0), sw, sw, true) end
			end
		else
			-- STEPPED CLIFF with life on the ledges
			cliff(folder, T, base, face, H, W, D, r, plant)
		end
		-- boulders at the foot (only the tops show over the wall... and behind gaps)
		if false then
			local bs = 3 + r:NextNumber() * 4
			Studs.static(folder, "Boulder", V3(bs, bs * 0.8, bs * 1.1), CF(base + face * (W * 0.5 + bs * 0.4) + V3(0, bs * 0.4, (r:NextNumber() - 0.5) * D)) * ANG(0, r:NextNumber() * 3, 0),
				vary(r, T.rock[1], 0.12), { noShadow = true })
		end
		-- the WATERFALL (once per zone, random spot): a cliff with water stepping down its face
		if not didFall and zc <= waterfallAt then
			didFall = true
			local fh = H + 6
			local fx = side * (wallX + 2 + 9)
			local fbase = V3(fx, 0, zc)
			cliff(folder, T, fbase + V3(side * 6, 0, 0), face, fh, 18, 16, r, plant)
			local water = if T.ice then C(190, 230, 250) else C(80, 166, 240)
			local light = if T.ice then C(225, 245, 255) else C(140, 205, 255)
			local foam = if T.ice then C(240, 250, 255) else C(232, 246, 255)
			local top = fh
			local bottom = wallH - 3
			local wx = fx + face.X * 2.4
			local mat = if T.ice then Enum.Material.Glass else Enum.Material.SmoothPlastic
			-- the notch the water pours out of
			Studs.static(folder, "Lip", V3(5, 1.2, 9), CF(wx - face.X * 1.5, top + 0.2, zc), vary(r, T.rock[2], 0.05), { noShadow = true })
			-- the main sheet of water + a lighter inner stream (continuous columns)
			local col = Studs.static(folder, "Fall", V3(1.4, top - bottom, 6.2), CF(wx, (top + bottom) / 2, zc), water, { noShadow = true, noCollide = true, smooth = true, material = mat })
			col.Transparency = if T.ice then 0.12 else 0.06
			local inner = Studs.static(folder, "FallCore", V3(1.5, top - bottom, 2.2), CF(wx + face.X * 0.08, (top + bottom) / 2, zc + (r:NextNumber() - 0.5) * 1.5), light,
				{ noShadow = true, noCollide = true, smooth = true, material = mat })
			inner.Transparency = if T.ice then 0.1 else 0.05
			-- foam where it hits two ledges on the way down, and a churning basin at the bottom
			for _, k in { 0.62, 0.3 } do
				local yy = bottom + (top - bottom) * k
				Studs.static(folder, "Foam", V3(2.6, 1, 7.2), CF(wx + face.X * 0.5, yy, zc), foam, { noShadow = true, noCollide = true })
			end
			for i = 1, 5 do
				Studs.static(folder, "Splash", V3(2 + r:NextNumber() * 2, 1 + r:NextNumber(), 2 + r:NextNumber() * 2), CF(wx + face.X * (1.5 + r:NextNumber() * 2), bottom + 0.4, zc + (i - 3) * 1.8),
					foam, { noShadow = true, noCollide = true })
			end
		end
		z -= step * (0.82 + r:NextNumber() * 0.16) -- overlap: no gaps, no rhythm
	end
	-- FAR RANGE: big simple peaks further out (depth), snow capped in the cold
	local zf = zA - r:NextNumber() * 20 - (if clampStart then 40 else 0)
	while zf > zB do
		local ph = wallH + 36 + r:NextNumber() * 40
		local pw = 30 + r:NextNumber() * 30
		local px = side * (wallX + 34 + r:NextNumber() * 22)
		local pc = V3(px, 0, zf - pw * 0.4)
		local y = 0
		local w = pw
		local tiers = 3
		for t = 1, tiers do
			local th = ph / tiers
			Studs.static(folder, "FarPeak", V3(w, th, w * (0.8 + r:NextNumber() * 0.3)), CF(pc + V3(0, y + th / 2, 0)) * ANG(0, r:NextNumber() * 0.6, 0),
				vary(r, T.rock[1]:Lerp(SKY, 0.42), 0.06), { noShadow = true, noCollide = true })
			y += th
			w *= 0.7
		end
		if T.snow or ph > wallH + 55 then
			Studs.static(folder, "FarSnow", V3(w * 1.25, 2.5, w * 1.25), CF(pc + V3(0, y - 1, 0)), C(244, 248, 255), { noShadow = true, noCollide = true })
		elseif T.moss then
			Studs.static(folder, "FarGreen", V3(w * 1.2, 1.6, w * 1.2), CF(pc + V3(0, y - 0.6, 0)), T.cap:Lerp(SKY, 0.35), { noShadow = true, noCollide = true })
		end
		zf -= pw * (0.6 + r:NextNumber() * 0.5)
	end
	return folder
end

return Backdrop
