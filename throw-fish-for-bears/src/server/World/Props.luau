--[[ Props: classic stud props for the map (trees, bushes, rocks, flowers, fences,
     stalls, signs, docks, clouds). Everything anchored Plastic with studs, built
     to match the reference screenshots (block trees, checker brick walls, golden
     wooden fences, striped stalls, plank docks). ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Studs = require(ReplicatedStorage.Shared.Models.Studs)

local Props = {}
local CF = CFrame.new
local V3 = Vector3.new
local ANG = CFrame.Angles
local C = Color3.fromRGB

Props.WOOD = C(196, 142, 62)
Props.WOOD_DARK = C(160, 108, 44)
Props.PLANK = C(176, 100, 46)
Props.PLANK_DARK = C(150, 82, 36)
Props.TRUNK = C(122, 80, 44)
Props.TRUNK_DARK = C(100, 64, 34)
Props.LEAF = C(64, 150, 52)
Props.LEAF_DARK = C(48, 122, 40)
Props.LEAF_LIGHT = C(92, 176, 70)
Props.ROCK = C(140, 140, 146)
Props.ROCK_DARK = C(112, 112, 118)
Props.BRICK_A = C(178, 112, 58)
Props.BRICK_B = C(150, 92, 46)

local function model(parent, name)
	local m = Instance.new("Model")
	m.Name = name
	m.Parent = parent
	return m
end

-- block tree like the reference (studded trunk + stacked cube canopy)
function Props.tree(parent: Instance, pos: Vector3, size: number, rand: Random, leaf: Color3?)
	local m = model(parent, "Tree")
	local k = size
	local leafC = leaf or Props.LEAF
	local tH = 7 * k
	Studs.static(m, "Trunk", V3(2.6 * k, tH, 2.6 * k), CF(pos + V3(0, tH / 2, 0)), Props.TRUNK)
	Studs.static(m, "TrunkStripe", V3(1.1 * k, tH * 0.9, 2.7 * k), CF(pos + V3(0.6 * k, tH * 0.45, 0)), Props.TRUNK_DARK)
	Studs.static(m, "Root1", V3(1.2 * k, 1.2 * k, 3.6 * k), CF(pos + V3(0, 0.6 * k, 0)), Props.TRUNK_DARK)
	Studs.static(m, "Root2", V3(3.6 * k, 1 * k, 1.2 * k), CF(pos + V3(0, 0.5 * k, 0)), Props.TRUNK_DARK)
	local top = pos + V3(0, tH, 0)
	Studs.static(m, "Canopy", V3(9 * k, 6.5 * k, 9 * k), CF(top + V3(0, 3.6 * k, 0)), leafC)
	Studs.static(m, "CanopyTop", V3(6 * k, 3 * k, 6 * k), CF(top + V3(0, 8.2 * k, 0)), Studs.shade(leafC, 1.12))
	local dirs = { V3(1, 0, 0), V3(-1, 0, 0), V3(0, 0, 1), V3(0, 0, -1) }
	for i, d in dirs do
		local h = (rand:NextNumber() * 2.4 - 0.6) * k
		local s = (3.4 + rand:NextNumber() * 1.2) * k
		Studs.static(m, "Bump" .. i, V3(s, s, s), CF(top + d * 4.6 * k + V3(0, 3 * k + h, 0)), if i % 2 == 0 then Studs.shade(leafC, 0.86) else Studs.shade(leafC, 1.05))
	end
	Studs.static(m, "Under", V3(7.4 * k, 1 * k, 7.4 * k), CF(top + V3(0, 0.1 * k, 0)), Studs.shade(leafC, 0.72))
	return m
end

function Props.pine(parent: Instance, pos: Vector3, size: number, leaf: Color3?)
	local m = model(parent, "Pine")
	local k = size
	local leafC = leaf or C(40, 116, 60)
	Studs.static(m, "Trunk", V3(2 * k, 6 * k, 2 * k), CF(pos + V3(0, 3 * k, 0)), Props.TRUNK)
	local y = 4 * k
	for i, w in { 9, 7, 5, 3 } do
		Studs.static(m, "Tier" .. i, V3(w * k, 3 * k, w * k), CF(pos + V3(0, y + 1.5 * k, 0)), Studs.shade(leafC, 0.9 + i * 0.06))
		y += 2.6 * k
	end
	return m
end

function Props.bush(parent: Instance, pos: Vector3, size: number, rand: Random)
	local m = model(parent, "Bush")
	local k = size
	Studs.static(m, "B1", V3(4 * k, 3 * k, 4 * k), CF(pos + V3(0, 1.5 * k, 0)), Props.LEAF)
	Studs.static(m, "B2", V3(3 * k, 2.4 * k, 3 * k), CF(pos + V3(2.2 * k, 1.2 * k, (rand:NextNumber() - 0.5) * 2 * k)), Props.LEAF_DARK)
	Studs.static(m, "B3", V3(2.6 * k, 2.2 * k, 2.6 * k), CF(pos + V3(-2 * k, 1.1 * k, (rand:NextNumber() - 0.5) * 2 * k)), Props.LEAF_LIGHT)
	if rand:NextNumber() < 0.5 then
		local berry = if rand:NextNumber() < 0.5 then C(220, 50, 60) else C(240, 220, 60)
		for i = 1, 3 do
			Studs.static(m, "Berry", V3(0.6, 0.6, 0.6), CF(pos + V3((rand:NextNumber() - 0.5) * 4 * k, 3 * k + 0.1, (rand:NextNumber() - 0.5) * 3 * k)), berry)
		end
	end
	return m
end

function Props.rock(parent: Instance, pos: Vector3, size: number, rand: Random)
	local m = model(parent, "Rock")
	local k = size
	Studs.static(m, "R1", V3(4 * k, 2.4 * k, 3.4 * k), CF(pos + V3(0, 1.2 * k, 0)) * ANG(0, rand:NextNumber() * 3, 0), Props.ROCK)
	Studs.static(m, "R2", V3(2.6 * k, 1.8 * k, 2.4 * k), CF(pos + V3(1.4 * k, 2.6 * k, 0.3 * k)) * ANG(0, rand:NextNumber() * 3, 0), Studs.shade(Props.ROCK, 1.08))
	Studs.static(m, "R3", V3(2 * k, 1.2 * k, 2 * k), CF(pos + V3(-2.4 * k, 0.6 * k, 1 * k)), Props.ROCK_DARK)
	return m
end

local PETALS = { C(250, 80, 120), C(255, 210, 60), C(170, 110, 250), C(255, 255, 255), C(255, 130, 40) }
function Props.flower(parent: Instance, pos: Vector3, rand: Random)
	local m = model(parent, "Flower")
	local petal = PETALS[rand:NextInteger(1, #PETALS)]
	Studs.static(m, "Stem", V3(0.3, 1.4, 0.3), CF(pos + V3(0, 0.7, 0)), C(50, 130, 40), { noCollide = true })
	Studs.static(m, "Leaf", V3(0.8, 0.2, 0.4), CF(pos + V3(0.35, 0.6, 0)), C(70, 160, 50), { noCollide = true })
	for _, d in { V3(0.45, 0, 0), V3(-0.45, 0, 0), V3(0, 0, 0.45), V3(0, 0, -0.45) } do
		Studs.static(m, "Petal", V3(0.5, 0.3, 0.5), CF(pos + V3(0, 1.55, 0) + d), petal, { noCollide = true })
	end
	Studs.static(m, "Center", V3(0.45, 0.4, 0.45), CF(pos + V3(0, 1.6, 0)), C(255, 220, 60), { noCollide = true })
	return m
end

-- golden wooden fence between a and b (on the ground), optional gap in the middle
function Props.fence(parent: Instance, a: Vector3, b: Vector3, gap: number?)
	local m = model(parent, "Fence")
	local dir = (b - a)
	local len = dir.Magnitude
	local u = dir.Unit
	local function segment(p0: Vector3, p1: Vector3)
		local d = p1 - p0
		local l = d.Magnitude
		if l < 1 then return end
		local mid = (p0 + p1) / 2
		local rot = CFrame.lookAt(mid, mid + d)
		for _, h in { 1.6, 3.2 } do
			Studs.static(m, "Rail", V3(0.5, 0.6, l), rot + V3(0, h, 0), Props.WOOD)
		end
		local n = math.max(1, math.floor(l / 5))
		for i = 0, n do
			local p = p0:Lerp(p1, i / n)
			Studs.static(m, "Post", V3(1, 4.4, 1), CFrame.lookAt(p + V3(0, 2.2, 0), p + V3(0, 2.2, 0) + d), if i % 2 == 0 then Props.WOOD_DARK else Props.WOOD)
			Studs.static(m, "PostCap", V3(1.2, 0.4, 1.2), CF(p + V3(0, 4.5, 0)), Studs.shade(Props.WOOD, 1.1))
		end
	end
	if gap and gap > 0 then
		local half = (len - gap) / 2
		segment(a, a + u * half)
		segment(b - u * half, b)
	else
		segment(a, b)
	end
	return m
end

-- checker brick wall (reference: brown studded blocks), returns the model
function Props.brickWall(parent: Instance, a: Vector3, b: Vector3, height: number, thick: number)
	local m = model(parent, "Wall")
	local d = b - a
	local len = d.Magnitude
	local u = d.Unit
	local tile = 8
	local n = math.max(1, math.floor(len / tile + 0.5))
	local tl = len / n
	local rows = math.max(1, math.floor(height / 6 + 0.5))
	local th = height / rows
	for i = 0, n - 1 do
		for r = 0, rows - 1 do
			local p = a + u * (tl * (i + 0.5))
			local cf = CFrame.lookAt(p, p + u) + V3(0, th * (r + 0.5), 0)
			local col = if (i + r) % 2 == 0 then Props.BRICK_A else Props.BRICK_B
			Studs.static(m, "Brick", V3(thick, th, tl), cf, col, { allStuds = true })
		end
	end
	-- green grass cap (reference walls have a grass top edge)
	-- (in segments: a part can't be longer than 2048 studs)
	local segs = math.max(1, math.ceil(len / 500))
	local sl = len / segs
	for i = 0, segs - 1 do
		local mid = a + u * (sl * (i + 0.5))
		Studs.static(m, "Cap", V3(thick + 0.4, 0.8, sl + 0.02), CFrame.lookAt(mid, mid + u) + V3(0, height + 0.4, 0), C(80, 170, 60))
	end
	return m
end

-- a sign board with big text (SurfaceGui), facing direction `face`
function Props.signText(part: BasePart, text: string, face: Enum.NormalId, color: Color3?, font: Enum.Font?)
	local sg = Instance.new("SurfaceGui")
	sg.Face = face
	sg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	sg.PixelsPerStud = 40
	sg.LightInfluence = 0.2
	sg.Parent = part
	local t = Instance.new("TextLabel")
	t.Name = "Text"
	t.BackgroundTransparency = 1
	t.Size = UDim2.fromScale(1, 1)
	t.Font = font or Enum.Font.FredokaOne
	t.TextScaled = true
	t.Text = text
	t.TextColor3 = color or Color3.new(1, 1, 1)
	t.Parent = sg
	local st = Instance.new("UIStroke")
	st.Thickness = 5
	st.Color = Color3.new(0, 0, 0)
	st.Parent = t
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0.04, 0)
	pad.PaddingRight = UDim.new(0.04, 0)
	pad.PaddingTop = UDim.new(0.08, 0)
	pad.PaddingBottom = UDim.new(0.08, 0)
	pad.Parent = t
	return t
end

-- text painted flat on the ground, readable from the bases (looking toward -Z)
function Props.groundLabel(parent: Instance, pos: Vector3, width: number, height: number, text: string, color: Color3?)
	local p = Studs.static(parent, "GroundLabel", V3(width, height, 0.2), CF(pos + V3(0, 0.16, 0)) * ANG(0, math.pi, 0) * ANG(math.pi / 2, 0, 0),
		Color3.new(1, 1, 1), { transparency = 1, noCollide = true, noQuery = true, smooth = true, noShadow = true })
	return Props.signText(p, text, Enum.NormalId.Front, color)
end

-- text painted on the ground (top face)
function Props.groundText(parent: Instance, pos: Vector3, size: Vector2, text: string, rotY: number?)
	local p = Studs.static(parent, "GroundText", V3(size.X, 0.05, size.Y), CF(pos + V3(0, 0.03, 0)) * ANG(0, rotY or 0, 0), Color3.new(1, 1, 1), { transparency = 1, noCollide = true, noQuery = true, smooth = true })
	return Props.signText(p, text, Enum.NormalId.Top, Color3.fromRGB(255, 255, 255))
end

-- wooden arch with a big readable sign board (replaces text painted on the ground)
function Props.arch(parent: Instance, center: Vector3, width: number, text: string, board: Color3?)
	local m = model(parent, "Arch")
	local h = 16
	for _, sx in { -1, 1 } do
		Studs.static(m, "Pillar", V3(3, h, 3), CF(center + V3(sx * width / 2, h / 2, 0)), Props.TRUNK)
		Studs.static(m, "PillarCap", V3(3.6, 1, 3.6), CF(center + V3(sx * width / 2, h + 0.5, 0)), Props.TRUNK_DARK)
		Studs.static(m, "PillarBase", V3(4, 1.2, 4), CF(center + V3(sx * width / 2, 0.6, 0)), Props.ROCK)
	end
	Studs.static(m, "Beam", V3(width + 4, 1.4, 2.4), CF(center + V3(0, h - 1, 0)), Props.TRUNK_DARK)
	local b = Studs.static(m, "Board", V3(math.min(width - 4, 34), 5, 1), CF(center + V3(0, h - 4.6, 0)), board or Color3.fromRGB(250, 200, 40))
	Studs.static(m, "BoardFrame", V3(math.min(width - 4, 34) + 1, 5.8, 0.8), CF(center + V3(0, h - 4.6, 0.3)), Props.WOOD_DARK)
	Studs.static(m, "Leaves", V3(width + 6, 2, 3.4), CF(center + V3(0, h + 1.2, 0)), Props.LEAF)
	Props.signText(b, text, Enum.NormalId.Front)
	Props.signText(b, text, Enum.NormalId.Back)
	return m
end

-- market stall with striped awning (SELL red, SHOP blue in the reference)
function Props.stall(parent: Instance, cf: CFrame, stripe: Color3, label: string)
	local m = model(parent, label .. "Stall")
	local function at(x, y, z) return cf * CF(x, y, z) end
	-- counter
	Studs.static(m, "Counter", V3(12, 3.6, 4), at(0, 1.8, -2), Props.WOOD)
	Studs.static(m, "CounterTop", V3(12.6, 0.6, 4.6), at(0, 3.9, -2), Props.WOOD_DARK)
	for i = -2, 2 do
		Studs.static(m, "Plank", V3(0.3, 3.2, 0.2), at(i * 2.4, 1.8, -4.05), Studs.shade(Props.WOOD, 0.85), { smooth = true })
	end
	Studs.static(m, "Back", V3(12, 8, 1), at(0, 4, 3), Props.WOOD)
	Studs.static(m, "Shelf", V3(11, 0.5, 1.6), at(0, 5.2, 2.2), Props.WOOD_DARK)
	-- goods on the shelf (fish crates / rods)
	for i = -2, 2 do
		Studs.static(m, "Good", V3(1.4, 1.2, 1.2), at(i * 2.2, 6, 2.2), if i % 2 == 0 then stripe else C(240, 240, 240))
	end
	for _, x in { -5.7, 5.7 } do
		Studs.static(m, "Post", V3(0.8, 10, 0.8), at(x, 5, -3.6), Props.WOOD_DARK)
	end
	-- striped awning (sloped)
	local stripes = 8
	for i = 0, stripes - 1 do
		local x = -6.4 + (i + 0.5) * (12.8 / stripes)
		local col = if i % 2 == 0 then stripe else C(250, 250, 250)
		Studs.static(m, "Awning", V3(12.8 / stripes, 0.5, 7.6), at(x, 10.4, -0.4) * ANG(math.rad(16), 0, 0), col)
		Studs.static(m, "Scallop", V3(12.8 / stripes - 0.2, 1.1, 0.4), at(x, 9.2, -4.2), col)
	end
	-- yellow sign board on top with big text
	local board = Studs.static(m, "SignBoard", V3(10, 3.2, 0.8), at(0, 13.4, 1.2), C(250, 200, 40))
	Studs.static(m, "SignFrame", V3(10.6, 3.8, 0.6), at(0, 13.4, 1.6), Props.WOOD_DARK)
	Props.signText(board, label, Enum.NormalId.Front)
	-- invisible prompt anchor in front of the counter
	local anchor = Studs.static(m, "PromptAnchor", V3(1, 1, 1), at(0, 3, -5), C(255, 255, 255), { transparency = 1, noCollide = true, noQuery = true })
	return m, anchor
end

-- plank dock from z0 to z1 at x, top at topY
function Props.dock(parent: Instance, x: number, z0: number, z1: number, width: number, topY: number)
	local m = model(parent, "Dock")
	local len = math.abs(z1 - z0)
	local zc = (z0 + z1) / 2
	local n = math.floor(len / 2.2)
	for i = 0, n - 1 do
		local z = z0 + (i + 0.5) * (len / n)
		Studs.static(m, "Plank", V3(width, 0.8, len / n - 0.15), CF(x, topY - 0.4, z), if i % 2 == 0 then Props.PLANK else Props.PLANK_DARK)
	end
	for _, side in { -1, 1 } do
		Studs.static(m, "Beam", V3(1, 1, len), CF(x + side * (width / 2 - 0.5), topY - 1.2, zc), Props.PLANK_DARK)
		for _, z in { z0 + 1, zc, z1 - 1 } do
			Studs.static(m, "Pile", V3(1.6, 7, 1.6), CF(x + side * (width / 2 + 0.3), topY - 2.6, z), Props.PLANK_DARK)
			Studs.static(m, "PileCap", V3(1.8, 0.6, 1.8), CF(x + side * (width / 2 + 0.3), topY + 1.2, z), C(230, 200, 160))
		end
	end
	return m
end

-- puffy cloud made of balls
function Props.cloud(parent: Instance, pos: Vector3, k: number, rand: Random)
	local m = model(parent, "Cloud")
	for i = 1, 6 do
		local off = V3((i - 3.5) * 7 * k, rand:NextNumber() * 4 * k, (rand:NextNumber() - 0.5) * 6 * k)
		local s = (8 + rand:NextNumber() * 7) * k
		Studs.static(m, "Puff", V3(s, s, s), CF(pos + off), C(250, 250, 255), { shape = Enum.PartType.Ball, smooth = true, noCollide = true, noQuery = true, noShadow = true })
	end
	return m
end

------------------------------------------------------------------------------------------
-- Biome props (zones 2-10)
------------------------------------------------------------------------------------------
local SNOW = C(244, 248, 255)

-- pine with optional snow caps on every tier
function Props.snowPine(parent: Instance, pos: Vector3, size: number, rand: Random, snowy: boolean?)
	local m = model(parent, "Pine")
	local k = size
	Studs.static(m, "Trunk", V3(2 * k, 6 * k, 2 * k), CF(pos + V3(0, 3 * k, 0)), Props.TRUNK)
	local y = 4 * k
	local leafC = if snowy then C(46, 104, 74) else C(40, 116, 60)
	for i, w in { 10, 8, 6, 4, 2.4 } do
		local rot = ANG(0, rand:NextNumber() * 0.3, 0)
		Studs.static(m, "Tier" .. i, V3(w * k, 2.8 * k, w * k), CF(pos + V3(0, y + 1.4 * k, 0)) * rot, Studs.shade(leafC, 0.88 + i * 0.05))
		if snowy then
			Studs.static(m, "Snow" .. i, V3(w * 0.8 * k, 0.5 * k, w * 0.8 * k), CF(pos + V3(0, y + 3 * k, 0)) * rot, SNOW)
		end
		y += 2.4 * k
	end
	return m
end

function Props.snowPile(parent: Instance, pos: Vector3, size: number, rand: Random)
	local m = model(parent, "SnowPile")
	local k = size
	Studs.static(m, "S1", V3(5 * k, 1.6 * k, 4 * k), CF(pos + V3(0, 0.8 * k, 0)) * ANG(0, rand:NextNumber() * 3, 0), SNOW)
	Studs.static(m, "S2", V3(3 * k, 1.2 * k, 2.6 * k), CF(pos + V3(0.6 * k, 2 * k, 0)) * ANG(0, rand:NextNumber() * 3, 0), C(232, 240, 252))
	Studs.static(m, "S3", V3(2 * k, 0.8 * k, 2 * k), CF(pos + V3(-2 * k, 0.4 * k, 1.2 * k)), C(226, 236, 250))
	return m
end

function Props.iceBlock(parent: Instance, pos: Vector3, size: number, rand: Random)
	local m = model(parent, "Ice")
	local k = size
	local ice = C(170, 220, 250)
	local opts = { material = Enum.Material.Glass, transparency = 0.2 }
	Studs.static(m, "I1", V3(3 * k, 5 * k, 3 * k), CF(pos + V3(0, 2.5 * k, 0)) * ANG(0, rand:NextNumber() * 3, 0.12), ice, opts)
	Studs.static(m, "I2", V3(2 * k, 3.4 * k, 2 * k), CF(pos + V3(2 * k, 1.7 * k, 0.6 * k)) * ANG(0, rand:NextNumber() * 3, -0.2), Studs.shade(ice, 1.08), opts)
	Studs.static(m, "I3", V3(1.6 * k, 2.4 * k, 1.6 * k), CF(pos + V3(-1.6 * k, 1.2 * k, -1 * k)) * ANG(0.2, rand:NextNumber() * 3, 0), Studs.shade(ice, 0.92), opts)
	Studs.static(m, "Base", V3(5 * k, 0.6 * k, 4 * k), CF(pos + V3(0, 0.3 * k, 0)), SNOW)
	return m
end

function Props.frozenPond(parent: Instance, pos: Vector3, w: number, l: number)
	local m = model(parent, "FrozenPond")
	Studs.static(m, "Rim", V3(w + 3, 0.3, l + 3), CF(pos + V3(0, 0.15, 0)), SNOW)
	Studs.static(m, "Ice", V3(w, 0.34, l), CF(pos + V3(0, 0.2, 0)), C(150, 210, 245), { material = Enum.Material.Glass, transparency = 0.1, smooth = true })
	for i = 1, 3 do
		Studs.static(m, "Crack", V3(w * 0.3, 0.36, 0.2), CF(pos + V3((i - 2) * w * 0.25, 0.21, (i - 2) * l * 0.2)) * ANG(0, i * 0.8, 0), C(230, 246, 255), { smooth = true, noCollide = true })
	end
	return m
end

function Props.bamboo(parent: Instance, pos: Vector3, size: number, rand: Random)
	local m = model(parent, "Bamboo")
	local k = size
	for i = 1, 4 do
		local off = V3((rand:NextNumber() - 0.5) * 4 * k, 0, (rand:NextNumber() - 0.5) * 4 * k)
		local h = (12 + rand:NextNumber() * 9) * k
		local col = if i % 2 == 0 then C(120, 180, 70) else C(100, 160, 56)
		local seg = 3 * k
		local n = math.floor(h / seg)
		for j = 0, n - 1 do
			Studs.static(m, "Stalk", V3(0.9 * k, seg - 0.2, 0.9 * k), CF(pos + off + V3(0, j * seg + seg / 2, 0)), col)
			Studs.static(m, "Node", V3(1.1 * k, 0.3, 1.1 * k), CF(pos + off + V3(0, j * seg + seg, 0)), Studs.shade(col, 0.8))
		end
		for j = 1, 2 do
			local y = h - j * 2.4 * k
			local a = rand:NextNumber() * 6.28
			Studs.static(m, "Leaves", V3(3 * k, 0.3, 1 * k), CF(pos + off + V3(math.cos(a) * 1.5 * k, y, math.sin(a) * 1.5 * k)) * ANG(0, -a, -0.3), C(90, 170, 60), { noCollide = true })
		end
	end
	return m
end

-- stone lantern (bamboo forest)
function Props.lantern(parent: Instance, pos: Vector3)
	local m = model(parent, "Lantern")
	Studs.static(m, "Base", V3(3, 1, 3), CF(pos + V3(0, 0.5, 0)), Props.ROCK)
	Studs.static(m, "Post", V3(1.2, 3, 1.2), CF(pos + V3(0, 2.5, 0)), Props.ROCK)
	Studs.static(m, "Box", V3(2.4, 1.8, 2.4), CF(pos + V3(0, 4.9, 0)), Props.ROCK_DARK)
	local glow = Studs.static(m, "Glow", V3(1.6, 1.2, 2.5), CF(pos + V3(0, 4.9, 0)), C(255, 200, 110), { material = Enum.Material.Neon, noCollide = true })
	local l = Instance.new("PointLight")
	l.Color = C(255, 190, 100)
	l.Range = 12
	l.Brightness = 0.8
	l.Parent = glow
	Studs.static(m, "Roof", V3(3.6, 0.8, 3.6), CF(pos + V3(0, 6.2, 0)), Props.ROCK)
	Studs.static(m, "RoofTop", V3(1.4, 0.8, 1.4), CF(pos + V3(0, 7, 0)), Props.ROCK_DARK)
	return m
end

function Props.palm(parent: Instance, pos: Vector3, size: number, rand: Random)
	local m = model(parent, "Palm")
	local k = size
	local lean = (rand:NextNumber() - 0.5) * 0.5
	local top = pos
	for i = 0, 6 do
		local p = pos + V3(math.sin(lean) * i * 1.6 * k, i * 2.2 * k + 1.1 * k, 0)
		Studs.static(m, "Trunk", V3(1.6 * k, 2.2 * k, 1.6 * k), CF(p) * ANG(0, 0, -lean * 0.6), if i % 2 == 0 then C(150, 110, 64) else C(130, 94, 54))
		top = p
	end
	top += V3(0, 1.2 * k, 0)
	for i = 0, 5 do
		local a = i * math.pi / 3 + rand:NextNumber() * 0.3
		local d = V3(math.cos(a), 0, math.sin(a))
		Studs.static(m, "Frond", V3(1.8 * k, 0.4 * k, 6 * k), CFrame.lookAt(top + d * 3 * k + V3(0, -0.6 * k, 0), top + d * 6 * k + V3(0, -2.4 * k, 0)), if i % 2 == 0 then C(70, 170, 60) else C(56, 150, 50), { noCollide = true })
		Studs.static(m, "FrondTip", V3(1.2 * k, 0.4 * k, 2 * k), CFrame.lookAt(top + d * 6.2 * k + V3(0, -2.2 * k, 0), top + d * 8 * k + V3(0, -4 * k, 0)), C(60, 150, 50), { noCollide = true })
	end
	for i = 1, 3 do
		local a = i * 2.1
		Studs.static(m, "Coconut", V3(0.9 * k, 0.9 * k, 0.9 * k), CF(top + V3(math.cos(a) * 0.8 * k, -0.9 * k, math.sin(a) * 0.8 * k)), C(110, 70, 36))
	end
	return m
end

function Props.shell(parent: Instance, pos: Vector3, rand: Random)
	local m = model(parent, "Shell")
	local col = ({ C(255, 170, 170), C(255, 220, 180), C(250, 240, 230), C(255, 190, 120) })[rand:NextInteger(1, 4)]
	if rand:NextNumber() < 0.5 then
		-- starfish
		for i = 0, 4 do
			local a = i * math.pi * 2 / 5
			Studs.static(m, "Arm", V3(0.5, 0.3, 1.4), CF(pos + V3(math.cos(a) * 0.6, 0.15, math.sin(a) * 0.6)) * ANG(0, -a + math.pi / 2, 0), C(255, 120, 70), { noCollide = true })
		end
		Studs.static(m, "Core", V3(0.8, 0.4, 0.8), CF(pos + V3(0, 0.2, 0)), C(255, 140, 80), { noCollide = true })
	else
		for i = -1, 1 do
			Studs.static(m, "Rib", V3(0.4, 0.4, 1.4), CF(pos + V3(0, 0.2, 0)) * ANG(0, i * 0.45, 0) * CF(0, 0, -0.3), col, { noCollide = true })
		end
	end
	return m
end

function Props.umbrella(parent: Instance, pos: Vector3, col: Color3)
	local m = model(parent, "Umbrella")
	Studs.static(m, "Pole", V3(0.4, 7, 0.4), CF(pos + V3(0, 3.5, 0)), C(240, 240, 240))
	for i = 0, 3 do
		Studs.static(m, "Canopy", V3(7 - i * 1.6, 0.5, 7 - i * 1.6), CF(pos + V3(0, 7 + i * 0.4, 0)) * ANG(0, i * 0.4, 0), if i % 2 == 0 then col else C(255, 255, 255))
	end
	Studs.static(m, "Towel", V3(3, 0.12, 6), CF(pos + V3(3, 0.06, 1)), col, { noCollide = true })
	return m
end

-- stacked boulder cliff (rocky mountains)
function Props.cliff(parent: Instance, pos: Vector3, size: number, rand: Random)
	local m = model(parent, "Cliff")
	local k = size
	local y = 0
	for i = 1, 4 do
		local w = (11 - i * 2) * k
		local h = (3 + rand:NextNumber() * 2) * k
		Studs.static(m, "Slab" .. i, V3(w, h, w * (0.8 + rand:NextNumber() * 0.3)), CF(pos + V3((rand:NextNumber() - 0.5) * 2 * k, y + h / 2, (rand:NextNumber() - 0.5) * 2 * k)) * ANG(0, rand:NextNumber() * 0.6, 0),
			Studs.shade(Props.ROCK, 0.85 + i * 0.06))
		y += h
	end
	if rand:NextNumber() < 0.5 then
		Studs.static(m, "SnowCap", V3(3 * k, 0.6 * k, 3 * k), CF(pos + V3(0, y + 0.3 * k, 0)), SNOW)
	end
	return m
end

function Props.log(parent: Instance, pos: Vector3, size: number, rand: Random)
	local m = model(parent, "Log")
	local k = size
	local rot = ANG(0, rand:NextNumber() * 3, 0)
	Studs.static(m, "Log", V3(2 * k, 2 * k, 8 * k), CF(pos + V3(0, k, 0)) * rot, Props.TRUNK)
	Studs.static(m, "Ring", V3(1.4 * k, 1.4 * k, 0.2), CF(pos + V3(0, k, 0)) * rot * CF(0, 0, 4 * k + 0.05), C(220, 180, 120))
	Studs.static(m, "Moss", V3(1.6 * k, 0.4 * k, 4 * k), CF(pos + V3(0, 2.1 * k, 0)) * rot * CF(0, 0, -1 * k), C(90, 150, 60))
	return m
end

function Props.giantMushroom(parent: Instance, pos: Vector3, size: number, rand: Random)
	local m = model(parent, "Mushroom")
	local k = size
	local cap = if rand:NextNumber() < 0.6 then C(210, 50, 50) else C(200, 120, 60)
	Studs.static(m, "Stem", V3(2 * k, 5 * k, 2 * k), CF(pos + V3(0, 2.5 * k, 0)), C(240, 232, 214))
	Studs.static(m, "Cap", V3(7 * k, 1.6 * k, 7 * k), CF(pos + V3(0, 5.6 * k, 0)), cap)
	Studs.static(m, "CapTop", V3(4.6 * k, 1.2 * k, 4.6 * k), CF(pos + V3(0, 6.8 * k, 0)), Studs.shade(cap, 1.08))
	for i = 1, 4 do
		local a = i * 1.6
		Studs.static(m, "Dot", V3(0.9 * k, 0.3 * k, 0.9 * k), CF(pos + V3(math.cos(a) * 2.2 * k, 7.45 * k, math.sin(a) * 2.2 * k)), C(250, 250, 240))
	end
	return m
end

function Props.fern(parent: Instance, pos: Vector3, size: number, rand: Random)
	local m = model(parent, "Fern")
	local k = size
	for i = 0, 4 do
		local a = i * math.pi * 2 / 5 + rand:NextNumber() * 0.4
		Studs.static(m, "Frond", V3(0.8 * k, 0.3 * k, 3.4 * k), CF(pos + V3(math.cos(a) * 1.4 * k, 1 * k, math.sin(a) * 1.4 * k)) * ANG(0, -a + math.pi / 2, 0) * ANG(0.5, 0, 0), C(60, 140, 56), { noCollide = true })
	end
	return m
end

function Props.reeds(parent: Instance, pos: Vector3, rand: Random)
	local m = model(parent, "Reeds")
	for i = 1, 5 do
		local off = V3((rand:NextNumber() - 0.5) * 3, 0, (rand:NextNumber() - 0.5) * 3)
		local h = 3 + rand:NextNumber() * 2.5
		Studs.static(m, "Reed", V3(0.3, h, 0.3), CF(pos + off + V3(0, h / 2, 0)), C(90, 140, 60), { noCollide = true })
		Studs.static(m, "Cattail", V3(0.5, 1.1, 0.5), CF(pos + off + V3(0, h + 0.4, 0)), C(120, 76, 40), { noCollide = true })
	end
	return m
end

function Props.pond(parent: Instance, pos: Vector3, w: number, l: number, rand: Random, lilies: boolean?)
	local m = model(parent, "Pond")
	Studs.static(m, "Bank", V3(w + 4, 0.3, l + 4), CF(pos + V3(0, 0.15, 0)), C(150, 130, 96))
	local water = Studs.static(m, "Water", V3(w, 0.4, l), CF(pos + V3(0, 0.22, 0)), C(46, 130, 220), { smooth = true, noCollide = true })
	water.Transparency = 0.12
	if lilies then
		for i = 1, 4 do
			local p = pos + V3((rand:NextNumber() - 0.5) * w * 0.8, 0.45, (rand:NextNumber() - 0.5) * l * 0.8)
			Studs.static(m, "Lily", V3(1.6, 0.1, 1.6), CF(p) * ANG(0, rand:NextNumber() * 3, 0), C(70, 160, 60), { noCollide = true })
			if i % 2 == 0 then Studs.static(m, "LilyFlower", V3(0.5, 0.4, 0.5), CF(p + V3(0.2, 0.2, 0)), C(255, 170, 210), { noCollide = true }) end
		end
	end
	return m
end

-- wooden footbridge: cf = centre (bridge runs along cf.LookVector)
function Props.bridge(parent: Instance, cf: CFrame, len: number, width: number)
	local m = model(parent, "Bridge")
	for i = 0, math.floor(len / 1.6) do
		local k = -len / 2 + i * 1.6
		-- gentle arch
		local y = 0.7 + math.sin((i * 1.6 / len) * math.pi) * 1.2
		Studs.static(m, "Plank", V3(width, 0.4, 1.4), cf * CF(0, y, k), if i % 2 == 0 then Props.PLANK else Props.PLANK_DARK)
	end
	for _, sx in { -1, 1 } do
		for i = 0, 2 do
			local k = -len / 2 + i * len / 2
			local y = 0.7 + math.sin((i / 2) * math.pi) * 1.2
			Studs.static(m, "Post", V3(0.5, 2.4, 0.5), cf * CF(sx * width / 2, y + 1.2, k), Props.WOOD_DARK)
		end
		Studs.static(m, "Rail", V3(0.4, 0.4, len), cf * CF(sx * width / 2, 3.2, 0), Props.WOOD)
	end
	return m
end

------------------------------------------------------------------------------------------
-- FISH-UP training station (one per base): low stud platform (walk on / off freely),
-- white training ring, owner-coloured trim, fish-dumbbell rack, weight plates and a
-- leaping trophy fish on a wooden post. Props.fishUpTier re-skins it per tier
-- (FishUpConfig): same shape, richer materials + pillars / torches / crystals / aura.
------------------------------------------------------------------------------------------
local FishUpConfig = require(ReplicatedStorage.Shared.Config.FishUpConfig)
local DumbbellBuilder = require(ReplicatedStorage.Shared.Models.DumbbellBuilder)
local FishBuilder = require(ReplicatedStorage.Shared.Models.FishBuilder)

local function decorFish(id: string, scale: number, variant: string?): Model
	local f = FishBuilder.build(id, { scale = scale, variant = variant })
	for _, d in f:GetDescendants() do
		if d:IsA("BasePart") then d.Anchored = true d.CanCollide = false d.CanQuery = false d.CanTouch = false end
	end
	f:SetAttribute("Kind", "Decor")
	return f
end

-- accent part: hidden until the station reaches `minTier`
local function accent(m, name, size, cf, color, minTier, opts)
	local p = Studs.static(m, name, size, cf, color, opts)
	p.CanCollide = false
	p.CanQuery = false
	p:SetAttribute("MinTier", minTier)
	p:SetAttribute("BaseTransparency", p.Transparency)
	p.Transparency = 1
	return p
end

function Props.fishUp(parent: Instance, pos: Vector3, side: number, ownerColor: Color3, _buildFish)
	local m = model(parent, "FishUp")
	m:SetAttribute("Side", side)
	m:SetAttribute("Origin", pos)
	local r = 3.6
	-- octagon platform, only 0.4 stud high: you simply walk on and off
	Studs.static(m, "Plinth", V3(11, 0.25, 11), CF(pos + V3(0, 0.125, 0)), C(150, 150, 158))
	Studs.static(m, "Plinth2", V3(11, 0.25, 11), CF(pos + V3(0, 0.125, 0)) * ANG(0, math.pi / 4, 0), C(142, 142, 150))
	Studs.static(m, "Mat", V3(9.4, 0.15, 9.4), CF(pos + V3(0, 0.325, 0)), C(60, 62, 70))
	Studs.static(m, "Mat2", V3(9.4, 0.15, 9.4), CF(pos + V3(0, 0.325, 0)) * ANG(0, math.pi / 4, 0), C(56, 58, 66))
	for i = 0, 7 do
		local a = i * math.pi / 4 + math.pi / 8
		Studs.static(m, "Trim", V3(4.4, 0.12, 0.5), CF(pos + V3(math.cos(a) * 5.05, 0.31, math.sin(a) * 5.05)) * ANG(0, -a + math.pi / 2, 0), ownerColor, { noCollide = true, smooth = true })
	end
	local ring = Studs.static(m, "TrainRing", V3(0.06, r * 2, r * 2), CF(pos + V3(0, 0.42, 0)) * ANG(0, 0, math.pi / 2), C(250, 250, 250), { shape = Enum.PartType.Cylinder, noCollide = true, smooth = true })
	ring.CanQuery = false
	local inner = Studs.static(m, "TrainInner", V3(0.07, r * 2 - 0.9, r * 2 - 0.9), CF(pos + V3(0, 0.425, 0)) * ANG(0, 0, math.pi / 2), C(70, 72, 82), { shape = Enum.PartType.Cylinder, noCollide = true, smooth = true })
	inner.CanQuery = false
	Studs.static(m, "EmblemBody", V3(2.2, 0.05, 1), CF(pos + V3(0, 0.47, 0)), ownerColor, { noCollide = true, smooth = true })
	Studs.static(m, "EmblemTail", V3(0.8, 0.05, 1.4), CF(pos + V3(1.5, 0.47, 0)), ownerColor, { noCollide = true, smooth = true })

	-- dumbbell rack on the outer side
	local rack = pos + V3(side * 7.2, 0, 0)
	for _, dz in { -2.4, 2.4 } do
		Studs.static(m, "RackPost", V3(0.8, 4.2, 0.8), CF(rack + V3(0, 2.1, dz)), Props.WOOD_DARK)
	end
	Studs.static(m, "RackFoot", V3(2.4, 0.4, 6.4), CF(rack + V3(0, 0.2, 0)), Props.WOOD_DARK)
	for k, y in { 1.6, 3.2 } do
		Studs.static(m, "RackBar", V3(1.6, 0.3, 5.6), CF(rack + V3(0, y, 0)), Props.WOOD)
		for j, dz in { -1.6, 1.6 } do
			local plate = Studs.static(m, if (k + j) % 2 == 0 then "PlateA" else "PlateB", V3(0.5, 1.2 + k * 0.2, 1.2 + k * 0.2), CF(rack + V3(0, y + 0.75 + k * 0.1, dz)) * ANG(0, math.pi / 2, 0),
				if (k + j) % 2 == 0 then C(220, 50, 50) else C(40, 40, 46), { shape = Enum.PartType.Cylinder })
			plate.CanCollide = false
		end
	end

	-- wooden post + sign (inner back corner)
	local post = pos + V3(-side * 5.6, 0, 4)
	Studs.static(m, "PostBase", V3(2, 0.8, 2), CF(post + V3(0, 0.4, 0)), C(150, 150, 158))
	Studs.static(m, "Post", V3(1.1, 9, 1.1), CF(post + V3(0, 4.9, 0)), Props.WOOD_DARK)
	local board = Studs.static(m, "Board", V3(5.4, 2.2, 0.5), CF(post + V3(0, 7.6, -0.8)), Props.WOOD)
	Studs.static(m, "BoardFrame", V3(5.9, 2.7, 0.3), CF(post + V3(0, 7.6, -0.5)), Props.WOOD_DARK)
	Props.signText(board, "FISH-UP", Enum.NormalId.Front, C(255, 220, 60))
	local anchor = Studs.static(m, "FishUpAnchor", V3(0.2, 0.2, 0.2), CF(pos + V3(0, 13, 0)), C(0, 0, 0), { transparency = 1, noCollide = true, noQuery = true, noShadow = true })

	-- tier accents ------------------------------------------------------------------
	-- 2+ : 4 corner pillars with caps
	for i = 0, 3 do
		local a = i * math.pi / 2 + math.pi / 4
		local c = pos + V3(math.cos(a) * 5.6, 0, math.sin(a) * 5.6)
		accent(m, "Pillar", V3(0.9, 3.2, 0.9), CF(c + V3(0, 1.6, 0)), C(150, 150, 158), 2)
		accent(m, "PillarCap", V3(1.3, 0.4, 1.3), CF(c + V3(0, 3.4, 0)), C(150, 150, 158), 2)
		-- 4+ : torch flames on the pillars
		local flame = accent(m, "Flame", V3(0.6, 0.8, 0.6), CF(c + V3(0, 4, 0)) * ANG(0, math.pi / 4, 0), C(255, 170, 40), 4, { material = Enum.Material.Neon })
		local fl = Instance.new("PointLight")
		fl.Name = "TierLight"
		fl.Range = 10
		fl.Brightness = 1.2
		fl.Color = C(255, 170, 60)
		fl.Enabled = false
		fl.Parent = flame
		-- 5+ : crystals on the caps
		accent(m, "Crystal", V3(0.5, 1.1, 0.5), CF(c + V3(0, 4.4, 0)) * ANG(0, math.pi / 4, 0.2), C(170, 235, 255), 5, { material = Enum.Material.Glass, transparency = 0.15 })
	end
	-- 3+ : metal plate under the ring
	accent(m, "RingPlate", V3(0.05, r * 2 + 0.6, r * 2 + 0.6), CF(pos + V3(0, 0.405, 0)) * ANG(0, 0, math.pi / 2), C(190, 190, 200), 3, { shape = Enum.PartType.Cylinder, smooth = true, reflectance = 0.2 })
	-- 6 : cosmic glow ring + rising sparkles
	local glow = accent(m, "GlowRing", V3(0.08, r * 2 + 0.3, r * 2 + 0.3), CF(pos + V3(0, 0.412, 0)) * ANG(0, 0, math.pi / 2), C(200, 140, 255), 6, { shape = Enum.PartType.Cylinder, smooth = true, material = Enum.Material.Neon, transparency = 0.3 })
	local pe = Instance.new("ParticleEmitter")
	pe.Name = "TierAura"
	pe.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	pe.Color = ColorSequence.new(C(210, 160, 255), C(130, 230, 255))
	pe.LightEmission = 1
	pe.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(0.4, 0.5), NumberSequenceKeypoint.new(1, 0) })
	pe.Lifetime = NumberRange.new(1.2, 2)
	pe.Speed = NumberRange.new(2, 4)
	pe.Rate = 6
	pe.EmissionDirection = Enum.NormalId.Right -- cylinder axis is vertical after the rotation
	pe.Enabled = false
	pe.Parent = glow

	Props.fishUpTier(m, 1)
	return m, anchor
end

-- re-skin a station for a tier (same shape, new materials + accents)
function Props.fishUpTier(m: Model, tierIndex: number)
	local tier = FishUpConfig.get(tierIndex)
	if m:GetAttribute("Tier") == tierIndex then return end
	m:SetAttribute("Tier", tierIndex)
	local MAP = {
		Plinth = tier.stone, Plinth2 = Studs.shade(tier.stone, 0.94), Mat = tier.mat, Mat2 = Studs.shade(tier.mat, 0.92),
		PostBase = tier.stone, Pillar = tier.stone, PillarCap = tier.metal, RingPlate = tier.metal,
		RackPost = Studs.shade(tier.wood, 0.85), RackFoot = Studs.shade(tier.wood, 0.85), RackBar = tier.wood,
		Post = Studs.shade(tier.wood, 0.85), Board = tier.wood, BoardFrame = Studs.shade(tier.wood, 0.8),
		PlateA = tier.plateA, PlateB = tier.plateB,
	}
	local shiny = tierIndex >= 3
	for _, p in m:GetChildren() do
		if p:IsA("BasePart") then
			local col = MAP[p.Name]
			if col then
				p.Color = Studs.vivid(col)
				if p.Name == "PillarCap" or p.Name == "RingPlate" or p.Name:sub(1, 5) == "Plate" then
					p.Reflectance = if shiny then 0.18 else 0
				end
			end
			local minTier = p:GetAttribute("MinTier")
			if minTier then
				local on = tierIndex >= minTier
				p.Transparency = if on then (p:GetAttribute("BaseTransparency") or 0) else 1
				for _, d in p:GetChildren() do
					if d:IsA("PointLight") or d:IsA("ParticleEmitter") then d.Enabled = on end
				end
			end
		end
	end
	-- the dumbbell and the trophy follow the tier (golden / diamond / rainbow fish)
	local pos = m:GetAttribute("Origin") :: Vector3
	local side = m:GetAttribute("Side") :: number
	local old = m:FindFirstChild("FishDumbbell")
	if old then old:Destroy() end
	local bell = DumbbellBuilder.build(tierIndex, 1.05)
	bell:PivotTo(CF(pos + V3(side * 7.2, 4.6, 0)) * ANG(0, math.pi / 2, 0))
	bell.Parent = m
	local oldT = m:FindFirstChild("Trophy")
	if oldT then oldT:Destroy() end
	local trophy = decorFish("Salmon", 2.2 + (tierIndex - 1) * 0.08, tier.fish)
	trophy.Name = "Trophy"
	local postPos = pos + V3(-side * 5.6, 0, 4)
	trophy:PivotTo(CF(postPos + V3(0, 11.2, 0)) * ANG(0, side * math.pi / 2, 0) * ANG(0.5, 0, 0))
	trophy.Parent = m
end

return Props
