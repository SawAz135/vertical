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
		-- a LOW garden fence (small plots side by side, like the reference)
		for _, h in { 0.9, 1.9 } do
			Studs.static(m, "Rail", V3(0.4, 0.5, l), rot + V3(0, h, 0), Props.WOOD)
		end
		local n = math.max(1, math.floor(l / 4))
		for i = 0, n do
			local p = p0:Lerp(p1, i / n)
			Studs.static(m, "Post", V3(0.8, 2.6, 0.8), CFrame.lookAt(p + V3(0, 1.3, 0), p + V3(0, 1.3, 0) + d), if i % 2 == 0 then Props.WOOD_DARK else Props.WOOD)
			Studs.static(m, "PostCap", V3(1, 0.35, 1), CF(p + V3(0, 2.75, 0)), Studs.shade(Props.WOOD, 1.1))
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
-- wall looks per zone theme: brick tones, top cap, inner-face details
Props.WALL_STYLES = {
	forest = { a = C(128, 124, 112), b = C(110, 106, 96), cap = C(80, 170, 60), moss = true },
	pine = { a = C(118, 92, 66), b = C(98, 76, 54), cap = C(66, 128, 50), moss = true },
	lake = { a = C(130, 140, 150), b = C(110, 120, 132), cap = C(84, 160, 70), moss = true },
	snow = { a = C(140, 148, 162), b = C(120, 128, 142), cap = C(244, 248, 255), snow = true },
	ice = { a = C(172, 212, 236), b = C(150, 196, 226), cap = C(244, 250, 255), snow = true },
	bamboo = { a = C(176, 150, 110), b = C(156, 130, 92), cap = C(96, 152, 60), moss = true },
	river = { a = C(140, 140, 128), b = C(120, 120, 110), cap = C(80, 160, 60), moss = true },
	rocky = { a = C(172, 112, 82), b = C(146, 92, 66), cap = C(160, 146, 86) },
	deep = { a = C(84, 94, 82), b = C(68, 78, 66), cap = C(52, 104, 42), moss = true },
	beach = { a = C(232, 202, 142), b = C(212, 180, 122), cap = C(242, 224, 164) },
}

function Props.brickWall(parent: Instance, a: Vector3, b: Vector3, height: number, thick: number, style: any?)
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
			local col = if (i + r) % 2 == 0 then (style and style.a or Props.BRICK_A) else (style and style.b or Props.BRICK_B)
			Studs.static(m, "Brick", V3(thick, th, tl), cf, col, { allStuds = true })
		end
	end
	-- green grass cap (reference walls have a grass top edge)
	-- (in segments: a part can't be longer than 2048 studs)
	local segs = math.max(1, math.ceil(len / 500))
	local sl = len / segs
	for i = 0, segs - 1 do
		local mid = a + u * (sl * (i + 0.5))
		Studs.static(m, "Cap", V3(thick + 0.4, 0.8, sl + 0.02), CFrame.lookAt(mid, mid + u) + V3(0, height + 0.4, 0), style and style.cap or C(80, 170, 60))
	end
	-- details on both faces: hanging moss / vines, or snow drips + icicles
	if style and (style.moss or style.snow) then
		local rnd = Random.new(math.floor(a.Z * 7 + a.X * 3))
		local side = u:Cross(Vector3.yAxis).Unit
		local zcount = math.floor(len / 9)
		for k = 1, zcount do
			local along = a + u * (k * 9 + rnd:NextNumber() * 5 - 2.5)
			for _, sgn in { -1, 1 } do
				if rnd:NextNumber() < 0.55 then
					local face = along + side * sgn * (thick / 2 + 0.15)
					if style.snow then
						local l = 1 + rnd:NextNumber() * 2.6
						Studs.static(m, "Icicle", V3(0.5, l, 0.5), CFrame.new(face + V3(0, height - l / 2, 0)), C(220, 240, 255), { noCollide = true, smooth = true, noShadow = true })
						Studs.static(m, "SnowDrip", V3(0.4, 0.7, 2 + rnd:NextNumber() * 2), CFrame.lookAt(face, face + u) + V3(0, height - 0.3, 0), style.cap, { noCollide = true, noShadow = true })
					else
						local l = 2 + rnd:NextNumber() * 7
						Studs.static(m, "Vine", V3(0.35, l, 0.5 + rnd:NextNumber() * 0.8), CFrame.lookAt(face, face + u) + V3(0, height - l / 2, 0), Studs.shade(style.cap, 0.85 + rnd:NextNumber() * 0.3),
							{ noCollide = true, noShadow = true })
						if rnd:NextNumber() < 0.4 then
							Studs.static(m, "MossPatch", V3(0.3, 1.6 + rnd:NextNumber() * 2, 2 + rnd:NextNumber() * 3), CFrame.lookAt(face, face + u) + V3(0, 1 + rnd:NextNumber() * 4, 0),
								Studs.shade(style.cap, 0.8), { noCollide = true, noShadow = true })
						end
					end
				end
			end
		end
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

-- small details scattered on a zone's ground (never on the path, never colliding)
function Props.groundDetails(parent: Instance, theme: string, a: number, b: number, half: number, rand: Random)
	local m = model(parent, "GroundDetails")
	local function spot(): Vector3
		local x = (9 + rand:NextNumber() * (half - 12)) * (if rand:NextNumber() < 0.5 then -1 else 1)
		return V3(x, 0, a - 6 - rand:NextNumber() * (a - b - 12))
	end
	local function flat(name, size: Vector3, pos: Vector3, col: Color3, y: number?)
		local p = Studs.static(m, name, size, CF(pos + V3(0, y or (0.22 + size.Y / 2), 0)) * CFrame.Angles(0, rand:NextNumber() * 3.14, 0), col, { noCollide = true, noShadow = true })
		p.CanQuery = false
		return p
	end
	local green = theme == "forest" or theme == "pine" or theme == "lake" or theme == "river" or theme == "deep" or theme == "bamboo"
	if green then
		for _ = 1, 14 do flat("Dirt", V3(3 + rand:NextNumber() * 6, 0.12, 2 + rand:NextNumber() * 5), spot(), C(120, 90, 58)) end
		for _ = 1, 26 do
			local p = spot()
			for k = 1, 3 do
				flat("Tuft", V3(0.3, 0.6 + rand:NextNumber() * 0.6, 0.3), p + V3((k - 2) * 0.35, 0, rand:NextNumber() * 0.3), Studs.shade(C(70, 150, 50), 0.9 + rand:NextNumber() * 0.3))
			end
		end
		for _ = 1, 16 do flat("Leaf", V3(0.9, 0.06, 0.6), spot(), ({ C(214, 160, 50), C(196, 100, 40), C(160, 120, 60) })[rand:NextInteger(1, 3)]) end
	elseif theme == "snow" or theme == "ice" then
		for _ = 1, 16 do flat("SnowMound", V3(3 + rand:NextNumber() * 4, 0.5 + rand:NextNumber() * 0.6, 2 + rand:NextNumber() * 3), spot(), C(250, 252, 255)) end
		for _ = 1, 10 do flat("IcePatch", V3(4 + rand:NextNumber() * 5, 0.1, 3 + rand:NextNumber() * 4), spot(), C(190, 228, 248)) end
	elseif theme == "rocky" then
		for _ = 1, 14 do flat("Gravel", V3(4 + rand:NextNumber() * 5, 0.12, 3 + rand:NextNumber() * 4), spot(), C(150, 120, 96)) end
		for _ = 1, 14 do flat("GroundCrack", V3(0.25, 0.05, 3 + rand:NextNumber() * 4), spot(), C(90, 66, 50)) end
	elseif theme == "beach" then
		for _ = 1, 24 do flat("Ripple", V3(0.35, 0.06, 4 + rand:NextNumber() * 5), spot(), C(250, 236, 190)) end
		for _ = 1, 8 do flat("Seaweed", V3(1.2, 0.08, 2 + rand:NextNumber()), spot(), C(70, 120, 60)) end
	end
	-- pebbles everywhere
	for _ = 1, 22 do
		local s = 0.4 + rand:NextNumber() * 0.8
		flat("Pebble", V3(s, s * 0.6, s * 0.9), spot(), Studs.shade(C(140, 140, 146), 0.8 + rand:NextNumber() * 0.4))
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

-- FISH-UP training spot: just a DOTTED CIRCLE on the ground + a small studded FISH-UP
-- sign on a post. Both change with the tier (wood -> bronze -> silver -> gold -> diamond
-- -> cosmic): colours, metal bolts, trims, a crown, gems and a little trophy fish on top.
function Props.fishUp(parent: Instance, pos: Vector3, side: number, ownerColor: Color3, _buildFish)
	local m = model(parent, "FishUp")
	m:SetAttribute("Side", side)
	m:SetAttribute("Origin", pos)
	local r = 3.6
	-- the dotted circle (24 dashes lying on the ground)
	local N = 24
	for i = 0, N - 1 do
		local a = i / N * math.pi * 2
		local dash = Studs.static(m, "Dash", V3(0.8, 0.08, 0.34), CF(pos + V3(math.cos(a) * r, 0.04, math.sin(a) * r)) * ANG(0, -a + math.pi / 2, 0),
			C(250, 250, 250), { noCollide = true, smooth = true })
		dash.CanQuery = false
		dash.CastShadow = false
	end
	-- the small sign (inner back corner)
	local post = pos + V3(-side * 5.2, 0, 3.6)
	Studs.static(m, "Post", V3(0.6, 4.4, 0.6), CF(post + V3(0, 2.2, 0)), Props.WOOD_DARK)
	local board = Studs.static(m, "Board", V3(3.8, 1.5, 0.35), CF(post + V3(0, 4.5, -0.5)), Props.WOOD)
	Studs.static(m, "BoardFrame", V3(4.2, 1.9, 0.22), CF(post + V3(0, 4.5, -0.3)), Props.WOOD_DARK)
	Props.signText(board, "FISH-UP", Enum.NormalId.Front, C(255, 220, 60))
	-- tier details on the sign
	for _, sx in { -1, 1 } do
		for _, sy in { -1, 1 } do
			accent(m, "Bolt", V3(0.2, 0.2, 0.1), CF(post + V3(sx * 1.8, 4.5 + sy * 0.62, -0.72)), C(190, 190, 200), 2, { smooth = true })
			accent(m, "Gem", V3(0.34, 0.34, 0.16), CF(post + V3(sx * 2.05, 4.5 + sy * 0.85, -0.5)) * ANG(0, 0, math.pi / 4), C(150, 230, 255), 5,
				{ material = Enum.Material.Glass, transparency = 0.1, smooth = true })
		end
	end
	accent(m, "TrimTop", V3(4.3, 0.16, 0.28), CF(post + V3(0, 5.45, -0.42)), C(225, 230, 240), 3, { smooth = true })
	accent(m, "TrimBottom", V3(4.3, 0.16, 0.28), CF(post + V3(0, 3.55, -0.42)), C(225, 230, 240), 3, { smooth = true })
	for i = -1, 1 do
		accent(m, "Crown", V3(0.36, 0.5 + (if i == 0 then 0.25 else 0), 0.2), CF(post + V3(i * 0.5, 5.75 + (if i == 0 then 0.12 else 0), -0.42)), C(255, 210, 60), 4, { smooth = true })
	end
	accent(m, "CosmicStar", V3(0.5, 0.5, 0.12), CF(post + V3(-1.5, 5.6, -0.42)) * ANG(0, 0, math.pi / 4), C(200, 140, 255), 6, { smooth = true })
	accent(m, "CosmicStar2", V3(0.36, 0.36, 0.12), CF(post + V3(1.55, 5.55, -0.42)) * ANG(0, 0, math.pi / 4), C(130, 230, 255), 6, { smooth = true })
	-- the floating FISH-UP billboard sits above the circle
	local anchor = Studs.static(m, "FishUpAnchor", V3(0.2, 0.2, 0.2), CF(pos + V3(0, 8.5, 0)), C(0, 0, 0), { transparency = 1, noCollide = true, noQuery = true, noShadow = true })
	m:SetAttribute("SignPos", post)
	Props.fishUpTier(m, 1)
	return m, anchor
end

-- re-skin a station for a tier (circle + sign colours, sign details, trophy fish)
function Props.fishUpTier(m: Model, tierIndex: number)
	local tier = FishUpConfig.get(tierIndex)
	if m:GetAttribute("Tier") == tierIndex then return end
	m:SetAttribute("Tier", tierIndex)
	local MAP = {
		Post = Studs.shade(tier.wood, 0.85), Board = tier.wood, BoardFrame = Studs.shade(tier.wood, 0.75),
		Dash = tier.color, Bolt = tier.metal, TrimTop = tier.metal, TrimBottom = tier.metal,
	}
	local shiny = tierIndex >= 3
	for _, p in m:GetChildren() do
		if p:IsA("BasePart") then
			local col = MAP[p.Name]
			if col then
				p.Color = Studs.vivid(col)
				if p.Name == "Bolt" or p.Name:sub(1, 4) == "Trim" or p.Name == "BoardFrame" then
					p.Reflectance = if shiny then 0.15 else 0
				end
			end
			local minTier = p:GetAttribute("MinTier")
			if minTier then
				p.Transparency = if tierIndex >= minTier then (p:GetAttribute("BaseTransparency") or 0) else 1
			end
		end
	end
	-- little trophy fish on top of the sign (golden / diamond / rainbow with the tier)
	local oldT = m:FindFirstChild("Trophy")
	if oldT then oldT:Destroy() end
	local side = m:GetAttribute("Side") :: number
	local post = m:GetAttribute("SignPos") :: Vector3
	if post then
		local trophy = decorFish("Salmon", 1.0 + (tierIndex - 1) * 0.06, tier.fish)
		trophy.Name = "Trophy"
		trophy:PivotTo(CF(post + V3(0, 6.5, -0.4)) * ANG(0, side * math.pi / 2, 0) * ANG(0.35, 0, 0))
		trophy.Parent = m
	end
end

-- ===================== PLATEAU / TRENCH TERRAIN (reference: garden-sim map) =====================
Props.DIRT_A = C(150, 96, 52)
Props.DIRT_B = C(124, 76, 40)
Props.GRASS_TOP = C(96, 200, 40)

local function allStuds(opts)
	opts = opts or {}
	opts.allStuds = true
	return opts
end

--[[ A CLIFF FACE: a dirt wall in a brown CHECKER (studs on every face), with a stepped GRASS
     bank on top and grass "drips" hanging over the edge (like the reference).
     p0 -> p1 : the horizontal line of the wall (centre of its 4-stud thickness)
     normal   : the direction the visible face looks at (unit, horizontal)
     style    : { a, b, cap } colours (a / b = checker, cap = grass) ]]
function Props.cliffFace(parent: Instance, p0: Vector3, p1: Vector3, yBottom: number, yTop: number, normal: Vector3, style: any?, rand: Random, rim: any?)
	local m = model(parent, "Cliff")
	local ca, cb = (style and style.a) or Props.DIRT_A, (style and style.b) or Props.DIRT_B
	local cap = (style and style.cap) or Props.GRASS_TOP
	local d = p1 - p0
	local len = d.Magnitude
	if len < 1 then return m end
	local along = d.Unit
	local h = yTop - yBottom
	local mid = (p0 + p1) / 2
	local function frameAt(center: Vector3)
		return CFrame.lookAt(center, center + along) -- X = across (normal axis), Z = along
	end
	-- the solid wall (one block, colour A)
	Studs.static(m, "Wall", V3(4, h, len), frameAt(V3(mid.X, yBottom + h / 2, mid.Z)), ca, allStuds())
	-- the checker: colour-B tiles laid on the visible face
	local T = 5
	local cols = math.max(1, math.floor(len / T + 0.5))
	local tw = len / cols
	local rows = math.max(1, math.floor(h / T + 0.5))
	local th = h / rows
	for k = 0, cols - 1 do
		for r = 0, rows - 1 do
			if (k + r) % 2 == 1 then
				local c = p0 + along * ((k + 0.5) * tw) + normal * 2.15
				Studs.static(m, "Tile", V3(0.3, th, tw), frameAt(V3(c.X, yBottom + (r + 0.5) * th, c.Z)), cb, allStuds({ noShadow = true }))
			end
		end
	end
	-- stepped GRASS bank on top: 3 steps going up and back from the edge
	local steps = rim or { { from = 2.6, to = -6, y = 0 }, { from = -1, to = -9, y = 1.2 }, { from = -4.5, to = -12, y = 2.4 } }
	for i, st in steps do
		local w = st.from - st.to
		local cOff = (st.from + st.to) / 2
		local c = mid + normal * cOff
		local gh = st.h or 1.2
		Studs.static(m, "Grass" .. i, V3(w, gh, len + (if i == 1 then 0.6 else 0)), frameAt(V3(c.X, yTop + st.y + gh / 2, c.Z)),
			if i == 2 then Studs.shade(cap, 1.08) else cap, allStuds())
	end
	-- grass drips hanging over the face (irregular, like the reference)
	local s = rand:NextNumber() * 3
	while s < len - 1 do
		local w = 1.2 + rand:NextNumber() * 2.2
		local dh = 0.8 + rand:NextInteger(0, 3) * 0.9
		local c = p0 + along * (s + w / 2) + normal * 2.45
		Studs.static(m, "Drip", V3(0.6, dh, w), frameAt(V3(c.X, yTop - dh / 2 + 0.05, c.Z)), Studs.shade(cap, 0.9 + rand:NextNumber() * 0.15), allStuds({ noShadow = true, noCollide = true }))
		s += w + 2 + rand:NextNumber() * 6
	end
	return m
end

--[[ GRASS TERRACES rising away from a line (the hills around the plateau = the "bowl" of the
     reference): `tiers` steps of tierH high and tierD deep, dirt fronts in checker, grass
     tops with studs. inward = the direction the fronts face (towards the playable area). ]]
function Props.terraces(parent: Instance, p0: Vector3, p1: Vector3, inward: Vector3, tiers: number, tierH: number, tierD: number, rand: Random)
	local m = model(parent, "Terraces")
	local d = p1 - p0
	local len = d.Magnitude
	if len < 1 then return m end
	local along = d.Unit
	local out = -inward
	local mid = (p0 + p1) / 2
	local function frameAt(center: Vector3)
		return CFrame.lookAt(center, center + along)
	end
	local tops = {}
	for t = 1, tiers do
		local top = t * tierH
		local depth = tierD * (tiers - t + 1) -- each tier runs to the back of the hill
		local c = mid + out * ((t - 1) * tierD + depth / 2)
		Studs.static(m, "Hill" .. t, V3(depth, top - 0.2, len), frameAt(V3(c.X, (top - 0.2) / 2, c.Z)), if t % 2 == 0 then Props.DIRT_B else Props.DIRT_A, allStuds())
		-- checker band on the front face of the tier (one row)
		local T = 4
		local cols = math.max(1, math.floor(len / T + 0.5))
		local tw = len / cols
		local front = mid + out * ((t - 1) * tierD) + inward * 0.15
		for k = 0, cols - 1 do
			if (k + t) % 2 == 1 then
				local fc = p0 + out * ((t - 1) * tierD) + inward * 0.15 + along * ((k + 0.5) * tw)
				Studs.static(m, "HillTile", V3(0.3, tierH - 0.2, tw), frameAt(V3(fc.X, top - tierH / 2 - 0.1, fc.Z)), if t % 2 == 0 then Props.DIRT_A else Props.DIRT_B, allStuds({ noShadow = true }))
			end
		end
		local _ = front
		-- the grass cap of the tier (slight overhang = the stepped grass edge)
		local gc = mid + out * ((t - 1) * tierD + depth / 2) + inward * 0.3
		Studs.static(m, "HillGrass" .. t, V3(depth + 0.6, 1, len), frameAt(V3(gc.X, top + 0.3, gc.Z)), if t % 2 == 0 then Studs.shade(Props.GRASS_TOP, 1.06) else Props.GRASS_TOP, allStuds())
		tops[t] = { y = top + 0.8, from = (t - 1) * tierD + 0.8, to = (t - 1) * tierD + tierD - 0.8 }
	end
	m:SetAttribute("Len", len)
	return m, tops, along, out
end

-- a WHITE BIRCH: white trunk with dark stud marks, blocky light-green crown
function Props.birch(parent: Instance, pos: Vector3, size: number, rand: Random)
	local m = model(parent, "Birch")
	local k = size
	local tH = 9 * k
	Studs.static(m, "Trunk", V3(1.4 * k, tH, 1.4 * k), CF(pos + V3(0, tH / 2, 0)), C(240, 238, 228), allStuds())
	for i = 1, 4 do
		local y = (1 + i * 1.8 + rand:NextNumber()) * k
		Studs.static(m, "Mark", V3(0.9 * k, 0.35 * k, 1.5 * k), CF(pos + V3((rand:NextNumber() - 0.5) * 0.4 * k, y, 0)), C(46, 44, 42), { noCollide = true })
	end
	local top = pos + V3(0, tH, 0)
	local leaf = C(140, 214, 60)
	Studs.static(m, "Crown", V3(5 * k, 4 * k, 5 * k), CF(top + V3(0, 1.2 * k, 0)), leaf, allStuds())
	Studs.static(m, "CrownTop", V3(3.4 * k, 2.6 * k, 3.4 * k), CF(top + V3(0.4 * k, 4.2 * k, -0.3 * k)), Studs.shade(leaf, 1.1), allStuds())
	Studs.static(m, "CrownSide", V3(3 * k, 3 * k, 3 * k), CF(top + V3(-2.4 * k, -0.4 * k, 1.2 * k)), Studs.shade(leaf, 0.9), allStuds())
	return m
end

-- a SUNFLOWER: tall stem, two leaves, big yellow head with a brown centre
function Props.sunflower(parent: Instance, pos: Vector3, rand: Random)
	local m = model(parent, "Sunflower")
	local h = 3.4 + rand:NextNumber() * 1.6
	Studs.static(m, "Stem", V3(0.35, h, 0.35), CF(pos + V3(0, h / 2, 0)), C(60, 150, 40), { noCollide = true })
	Studs.static(m, "Leaf", V3(1.1, 0.2, 0.5), CF(pos + V3(0.5, h * 0.4, 0)), C(80, 170, 50), { noCollide = true })
	Studs.static(m, "Leaf", V3(1.1, 0.2, 0.5), CF(pos + V3(-0.5, h * 0.6, 0)), C(80, 170, 50), { noCollide = true })
	local head = CF(pos + V3(0, h + 0.4, 0)) * CFrame.Angles(0.35, rand:NextNumber() * 6.28, 0)
	Studs.static(m, "Petals", V3(2, 2, 0.3), head, C(255, 206, 30), allStuds({ noCollide = true }))
	Studs.static(m, "Petals2", V3(1.4, 2.6, 0.25), head, C(255, 190, 20), { noCollide = true })
	Studs.static(m, "Petals3", V3(2.6, 1.4, 0.25), head, C(255, 190, 20), { noCollide = true })
	Studs.static(m, "Seeds", V3(1.1, 1.1, 0.45), head, C(110, 70, 30), allStuds({ noCollide = true }))
	return m
end

-- a little red MUSHROOM with white dots
function Props.mushroom(parent: Instance, pos: Vector3, size: number)
	local m = model(parent, "Mushroom")
	local k = size
	Studs.static(m, "Stalk", V3(0.8 * k, 1.2 * k, 0.8 * k), CF(pos + V3(0, 0.6 * k, 0)), C(245, 238, 220), allStuds({ noCollide = true }))
	Studs.static(m, "Cap", V3(2 * k, 0.8 * k, 2 * k), CF(pos + V3(0, 1.5 * k, 0)), C(220, 40, 40), allStuds({ noCollide = true }))
	Studs.static(m, "CapTop", V3(1.3 * k, 0.5 * k, 1.3 * k), CF(pos + V3(0, 2.1 * k, 0)), C(230, 50, 50), allStuds({ noCollide = true }))
	for _, o in { V3(0.6, 0, 0.3), V3(-0.5, 0, -0.4), V3(0.1, 0.45, 0.2) } do
		Studs.static(m, "Dot", V3(0.4 * k, 0.15 * k, 0.4 * k), CF(pos + V3(o.X * k, (1.95 + o.Y) * k, o.Z * k)), C(255, 255, 255), { noCollide = true, smooth = true })
	end
	return m
end

-- an invisible collision wall (keeps players on the plateau; never blocks the camera)
function Props.invisibleWall(parent: Instance, p0: Vector3, p1: Vector3, y0: number, height: number)
	local d = p1 - p0
	local len = d.Magnitude
	if len < 0.5 then return nil end
	local mid = (p0 + p1) / 2
	local c = V3(mid.X, y0 + height / 2, mid.Z)
	local w = Studs.static(parent, "InvisibleWall", V3(1, height, len), CFrame.lookAt(c, c + d.Unit), C(255, 255, 255), { noShadow = true, smooth = true })
	w.Transparency = 1
	w.CanQuery = false
	w.CanTouch = false
	return w
end

return Props
