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
	local mid = (a + b) / 2
	Studs.static(m, "Cap", V3(thick + 0.4, 0.8, len), CFrame.lookAt(mid, mid + u) + V3(0, height + 0.4, 0), C(80, 170, 60))
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

-- text painted on the ground (top face)
function Props.groundText(parent: Instance, pos: Vector3, size: Vector2, text: string, rotY: number?)
	local p = Studs.static(parent, "GroundText", V3(size.X, 0.05, size.Y), CF(pos + V3(0, 0.03, 0)) * ANG(0, rotY or 0, 0), Color3.new(1, 1, 1), { transparency = 1, noCollide = true, noQuery = true, smooth = true })
	return Props.signText(p, text, Enum.NormalId.Top, Color3.fromRGB(255, 255, 255))
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

return Props
