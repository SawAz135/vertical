--[[ Shop: Gérard's carpenter-built market stall (bevelled deck boards with gaps, counter of
     vertical boards under a thick oak top, turned posts with knee braces, plank back wall
     with three shelves on iron brackets, striped awning + scalloped valance, gilded sign on
     chains, burlap sacks, a crate of golden potatoes, a brass scale, a till, a lantern that
     glows at night, the chalkboard price list) and Gérard himself (an articulated model the
     clients animate). ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)
local Potato = require(ReplicatedStorage.Shared.Potato)
local B = require(script.Parent.Build)

local Shop = {}
local WOOD = Color3.fromRGB(170, 116, 62)
local WOOD_D = Color3.fromRGB(104, 66, 36)
local WOOD_W = Color3.fromRGB(176, 160, 132)
local RED = Color3.fromRGB(184, 50, 42)
local CREAM = Color3.fromRGB(244, 236, 216)
local IRON = Color3.fromRGB(42, 40, 38)
local BRASS = Color3.fromRGB(196, 156, 64)

function Shop.build(parent: Instance)
	local m = Instance.new("Model"); m.Name = "Shop"; m.Parent = parent
	local o = CFrame.new(Config.SHOP.Pos) -- front (counter) faces -Z of the world, toward the spawn
	local r = Random.new(1987)
	local function P(cf: CFrame, size: Vector3, props: { [string]: any })
		props.Size = size; props.CFrame = o * cf
		return B.part(m, props)
	end
	local W = Enum.Material.Wood
	-- deck
	for k = 0, 13 do P(CFrame.new((r:NextNumber() - 0.5) * 0.1, 0.4, -4 + k * 0.88), Vector3.new(18.5, 0.25, 0.84), { Material = W, Color = B.tint(WOOD_W, r, 0.2) }) end
	for _, z in { -3.5, 2, 7.6 } do P(CFrame.new(0, 0.15, z), Vector3.new(18.5, 0.32, 0.32), { Material = W, Color = WOOD_D }) end
	-- counter: vertical boards on battens, thick top with a front lip
	for k = 0, 23 do P(CFrame.new(-7.25 + k * 0.63, 2.2, -1.65), Vector3.new(0.6, 3.4, 0.12), { Material = W, Color = B.tint(WOOD, r, 0.2) }) end
	for _, y in { 1.1, 3.2 } do P(CFrame.new(0, y, -1.75), Vector3.new(15.1, 0.32, 0.12), { Material = W, Color = WOOD_D }) end
	for _, x in { -7.55, 7.55 } do P(CFrame.new(x, 2.2, -0.65), Vector3.new(0.14, 3.4, 2.2), { Material = W, Color = B.tint(WOOD, r) }) end
	P(CFrame.new(0, 4.0, -0.7), Vector3.new(16.1, 0.3, 3.0), { Material = W, Color = WOOD_D })
	P(CFrame.new(0, 3.78, -2.1), Vector3.new(15.8, 0.18, 0.18), { Material = W, Color = WOOD_D })
	-- turned posts (base, rings, capital) + beams + knee braces
	for _, pz in { { -8.6, -3.3, 10.5 }, { 8.6, -3.3, 10.5 }, { -8.6, 7.7, 11.6 }, { 8.6, 7.7, 11.6 } } do
		local x, z, h = pz[1], pz[2], pz[3]
		P(CFrame.new(x, 0.75, z), Vector3.new(0.75, 0.6, 0.75), { Material = W, Color = WOOD_D })
		P(CFrame.new(x, 0.5 + h / 2, z) * CFrame.Angles(0, 0, math.pi / 2), Vector3.new(h, 0.5, 0.5), { Shape = Enum.PartType.Cylinder, Material = W, Color = WOOD })
		for y = 2, h - 1, 2.2 do P(CFrame.new(x, y, z) * CFrame.Angles(0, 0, math.pi / 2), Vector3.new(0.22, 0.66, 0.66), { Shape = Enum.PartType.Cylinder, Material = W, Color = WOOD_D }) end
		P(CFrame.new(x, h + 0.25, z), Vector3.new(0.9, 0.4, 0.9), { Material = W, Color = WOOD_D })
	end
	P(CFrame.new(0, 10.9, -3.3), Vector3.new(18.6, 0.62, 0.5), { Material = W, Color = WOOD_D })
	P(CFrame.new(0, 12.0, 7.7), Vector3.new(18.6, 0.62, 0.5), { Material = W, Color = WOOD_D })
	for _, x in { -8.6, 8.6 } do P(CFrame.new(x, 11.4, 2.2) * CFrame.Angles(math.rad(-5.7), 0, 0), Vector3.new(0.42, 0.55, 11.4), { Material = W, Color = WOOD_D }) end
	for _, s in { -1, 1 } do P(CFrame.new(s * 7.7, 9.9, -3.3) * CFrame.Angles(0, 0, s * math.rad(45)), Vector3.new(0.26, 2.6, 0.26), { Material = W, Color = WOOD_D }) end
	-- back wall + shelves on iron brackets
	for k = 0, 26 do P(CFrame.new(-8.6 + k * 0.665, 6.2, 8.05), Vector3.new(0.65, 11.2, 0.12), { Material = W, Color = B.tint(WOOD_W, r, 0.25) }) end
	for _, y in { 1.8, 5.6, 9.8 } do P(CFrame.new(0, y, 8.15), Vector3.new(17.2, 0.35, 0.12), { Material = W, Color = WOOD_D }) end
	for _, y in { 3.3, 5.9, 8.4 } do
		P(CFrame.new(0, y, 7.2), Vector3.new(15.4, 0.16, 1.5), { Material = W, Color = B.tint(WOOD, r) })
		P(CFrame.new(0, y + 0.14, 6.5), Vector3.new(15.4, 0.2, 0.08), { Material = W, Color = WOOD_D })
		for _, x in { -6.6, 0, 6.6 } do
			P(CFrame.new(x, y - 0.5, 7.9), Vector3.new(0.12, 1.0, 0.08), { Material = Enum.Material.Metal, Color = IRON })
			P(CFrame.new(x, y - 0.45, 7.3) * CFrame.Angles(math.rad(-40), 0, 0), Vector3.new(0.1, 0.1, 1.3), { Material = Enum.Material.Metal, Color = IRON })
		end
	end
	-- striped awning (sagging slats) + scalloped valance
	for k = 0, 13 do
		local x = -8.85 + (k + 0.5) * 1.264
		for j = 0, 3 do
			local z0, z1 = -3.6 + j * 2.9, -3.6 + (j + 1) * 2.9
			local y0, y1 = 11.1 + (j / 4) * 1.1, 11.1 + ((j + 1) / 4) * 1.1
			local sag = 0.22
			local a, b = Vector3.new(x, y0 + 0.25, z0), Vector3.new(x, y1 + 0.25, z1)
			local mid = (a + b) / 2 - Vector3.new(0, sag, 0)
			for _, seg in { { a, mid }, { mid, b } } do
				local wa, wb = (o * CFrame.new(seg[1])).Position, (o * CFrame.new(seg[2])).Position
				local pp = B.beam(m, wa, wb, 1.27, 0.08, { Material = Enum.Material.Fabric, Color = if k % 2 == 0 then RED else CREAM, CastShadow = true })
				pp.CanCollide = false
			end
		end
		-- scallop: a half disc hanging from the front edge
		local sc = P(CFrame.new(x, 10.85, -3.75) * CFrame.Angles(0, math.pi / 2, 0), Vector3.new(0.05, 1.25, 1.25), { Shape = Enum.PartType.Cylinder, Material = Enum.Material.Fabric, Color = if k % 2 == 0 then RED else CREAM, CanCollide = false })
		sc.CFrame = sc.CFrame * CFrame.Angles(math.pi / 2, 0, 0)
		P(CFrame.new(x, 11.25, -3.75), Vector3.new(1.264, 0.75, 0.05), { Material = Enum.Material.Fabric, Color = if k % 2 == 0 then RED else CREAM, CanCollide = false })
	end
	-- gilded sign hanging from chains
	local sign = P(CFrame.new(0, 14.6, -3.5), Vector3.new(9.6, 3, 0.25), { Name = "Sign", Material = W, Color = Color3.fromRGB(74, 44, 22) })
	local g = Instance.new("SurfaceGui"); g.Face = Enum.NormalId.Front; g.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud; g.PixelsPerStud = 50; g.Parent = sign
	local frame = Instance.new("Frame"); frame.Size = UDim2.fromScale(1, 1); frame.BackgroundColor3 = Color3.fromRGB(66, 38, 18); frame.Parent = g
	local st = Instance.new("UIStroke"); st.Color = Color3.fromRGB(214, 168, 70); st.Thickness = 8; st.ApplyStrokeMode = Enum.ApplyStrokeMode.Border; st.Parent = frame
	local t1 = Instance.new("TextLabel"); t1.BackgroundTransparency = 1; t1.Size = UDim2.fromScale(0.94, 0.55); t1.Position = UDim2.fromScale(0.03, 0.06); t1.Font = Enum.Font.Merriweather; t1.TextScaled = true; t1.Text = "CHEZ GÉRARD"; t1.TextColor3 = Color3.fromRGB(246, 208, 110); t1.TextStrokeTransparency = 0.4; t1.Parent = frame
	local gr = Instance.new("UIGradient"); gr.Color = ColorSequence.new({ ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 240, 176)), ColorSequenceKeypoint.new(0.5, Color3.fromRGB(216, 166, 64)), ColorSequenceKeypoint.new(1, Color3.fromRGB(168, 116, 28)) }); gr.Rotation = 90; gr.Parent = t1
	local t2 = Instance.new("TextLabel"); t2.BackgroundTransparency = 1; t2.Size = UDim2.fromScale(0.9, 0.26); t2.Position = UDim2.fromScale(0.05, 0.66); t2.Font = Enum.Font.Merriweather; t2.TextScaled = true; t2.Text = "Outils · Améliorations · Conseils — depuis 1987"; t2.TextColor3 = CREAM; t2.Parent = frame
	for _, x in { -3.8, 3.8 } do
		for k = 0, 4 do P(CFrame.new(x, 16.4 + k * 0.32, -3.5) * CFrame.Angles(0, if k % 2 == 0 then 0 else math.pi / 2, math.pi / 2), Vector3.new(0.1, 0.35, 0.35), { Shape = Enum.PartType.Cylinder, Material = Enum.Material.Metal, Color = IRON, CanCollide = false }) end
	end
	-- props: sacks, crate of golden potatoes, brass scale, till, bell, lantern
	for _, s in { { -10.4, -4.6, 1 }, { -11.8, -3.2, 0.85 }, { 10.3, -5.0, 0.95 } } do
		local sack = P(CFrame.new(s[1], 1.6 * s[3] + 0.3, s[2]), Vector3.new(2.6, 3.2, 2.2) * s[3], { Mesh = Enum.MeshType.Sphere, Material = Enum.Material.Fabric, Color = Color3.fromRGB(184, 147, 102) })
		sack.CanCollide = true
		P(CFrame.new(s[1], 3.3 * s[3] + 0.3, s[2]), Vector3.new(0.9, 0.9, 0.9) * s[3], { Mesh = Enum.MeshType.Sphere, Material = Enum.Material.Fabric, Color = Color3.fromRGB(170, 132, 90) })
		P(CFrame.new(s[1], 3.05 * s[3] + 0.3, s[2]) * CFrame.Angles(0, 0, math.pi / 2), Vector3.new(0.2, 1, 1) * s[3], { Shape = Enum.PartType.Cylinder, Material = Enum.Material.Fabric, Color = Color3.fromRGB(138, 106, 58) })
	end
	for _, spec in { { 0.2, 0, 2.2 }, { 0.2, 0, -2.2 } } do P(CFrame.new(5.4, 4.5, -0.9 + spec[3] * 0.32), Vector3.new(2.2, 0.7, 0.1), { Material = W, Color = B.tint(WOOD, r) }) end
	for _, x in { 4.35, 6.45 } do P(CFrame.new(x, 4.5, -0.9), Vector3.new(0.1, 0.7, 1.5), { Material = W, Color = B.tint(WOOD, r) }) end
	for k = 0, 13 do
		local pp = Potato.make(6, 0.75 + r:NextNumber() * 0.2, r:NextNumber())
		pp.Material = Enum.Material.Metal; pp.Reflectance = 0.12
		pp.Anchored = true; pp.CFrame = o * CFrame.new(4.6 + (k % 5) * 0.4, 4.75 + (k // 5) * 0.15, -1.35 + (k // 5) * 0.45) * CFrame.Angles(r:NextNumber() * 0.5, r:NextNumber() * 6, 0)
		pp.Parent = m
	end
	local sc = CFrame.new(-2.2, 4.15, -1.4)
	P(sc, Vector3.new(0.1, 0.9, 0.9), { Shape = Enum.PartType.Cylinder, Material = Enum.Material.Metal, Color = BRASS, Reflectance = 0.2 }).CFrame = o * sc * CFrame.Angles(0, 0, math.pi / 2)
	P(sc * CFrame.new(0, 0.7, 0), Vector3.new(0.12, 1.4, 0.12), { Material = Enum.Material.Metal, Color = BRASS })
	P(sc * CFrame.new(0, 1.35, 0) * CFrame.Angles(0, 0, 0.05), Vector3.new(1.8, 0.08, 0.08), { Material = Enum.Material.Metal, Color = BRASS })
	for _, s in { -1, 1 } do P(sc * CFrame.new(s * 0.85, 0.95 - s * 0.05, 0), Vector3.new(0.75, 0.2, 0.75), { Mesh = Enum.MeshType.Sphere, Material = Enum.Material.Metal, Color = BRASS, Reflectance = 0.2 }) end
	local till = P(CFrame.new(2.4, 4.6, 0.1) * CFrame.Angles(0, 0.2, 0), Vector3.new(1.6, 0.9, 1.3), { Material = Enum.Material.Metal, Color = BRASS, Reflectance = 0.15 })
	P(CFrame.new(2.4, 5.2, 0.45) * CFrame.Angles(math.rad(-20), 0.2, 0), Vector3.new(1.4, 0.6, 0.45), { Material = Enum.Material.Metal, Color = BRASS })
	till.Name = "Till"
	local bell = P(CFrame.new(-4.6, 4.3, -1.5), Vector3.new(0.6, 0.35, 0.6), { Mesh = Enum.MeshType.Sphere, Material = Enum.Material.Metal, Color = BRASS, Reflectance = 0.3 })
	bell.Name = "Bell"
	local lantern = P(CFrame.new(-5.6, 9.6, -3.3), Vector3.new(0.8, 1.1, 0.8), { Name = "Lantern", Material = Enum.Material.Glass, Color = Color3.fromRGB(255, 224, 170), Transparency = 0.35, CanCollide = false })
	P(CFrame.new(-5.6, 10.3, -3.3), Vector3.new(0.95, 0.3, 0.95), { Material = Enum.Material.Metal, Color = IRON, CanCollide = false })
	local flame = P(CFrame.new(-5.6, 9.55, -3.3), Vector3.new(0.25, 0.42, 0.25), { Name = "Flame", Mesh = Enum.MeshType.Sphere, Material = Enum.Material.Neon, Color = Color3.fromRGB(255, 180, 80), CanCollide = false, Transparency = 1 })
	local ll = Instance.new("PointLight"); ll.Color = Color3.fromRGB(255, 176, 96); ll.Range = 22; ll.Brightness = 0; ll.Shadows = true; ll.Parent = flame
	Shop.lantern = flame
	-- chalkboard A-frame with the prices
	local board = P(CFrame.new(11.6, 3.3, -5) * CFrame.Angles(math.rad(-10), math.rad(25), 0), Vector3.new(3.6, 4.6, 0.15), { Name = "Chalk", Material = Enum.Material.Slate, Color = Color3.fromRGB(30, 42, 34) })
	P(CFrame.new(11.6, 3.3, -5.05) * CFrame.Angles(math.rad(-10), math.rad(25), 0), Vector3.new(4, 5, 0.1), { Material = W, Color = WOOD_D })
	Shop.chalk = board
	-- counter interaction (ProximityPrompt)
	local talk = P(CFrame.new(0, 4.6, -1.2), Vector3.new(4, 2, 1), { Name = "TalkPoint", Transparency = 1, CanCollide = false })
	local prompt = Instance.new("ProximityPrompt"); prompt.ActionText = "Parler à Gérard"; prompt.ObjectText = "Boutique"; prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.MaxActivationDistance = 13; prompt.RequiresLineOfSight = false; prompt.HoldDuration = 0; prompt.Parent = talk
	Shop.prompt = prompt
	Shop.origin = o
	Shop.model = m
	return m
end

-- price list on the chalkboard
function Shop.drawChalk()
	local b = Shop.chalk; if not b then return end
	local g = b:FindFirstChild("Prices") or Instance.new("SurfaceGui")
	g.Name = "Prices"; g.Face = Enum.NormalId.Front; g.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud; g.PixelsPerStud = 60; g.Parent = b
	g:ClearAllChildren()
	local l = Instance.new("UIListLayout"); l.Padding = UDim.new(0, 4); l.HorizontalAlignment = Enum.HorizontalAlignment.Center; l.Parent = g
	local function line(txt, size, col)
		local t = Instance.new("TextLabel"); t.BackgroundTransparency = 1; t.Size = UDim2.new(0.92, 0, 0, size); t.Font = Enum.Font.PermanentMarker; t.TextScaled = true
		t.Text = txt; t.TextColor3 = col or Color3.fromRGB(240, 240, 230); t.Parent = g
	end
	line("Tarifs du jour", 34)
	for _, it in Config.ITEMS do line(it.icon .. " " .. it.name .. " — dès " .. it.levels[2].price .. " ₣", 20, Color3.fromRGB(246, 215, 138)) end
	line("Pas de crédit. — G.", 20)
end

return Shop
