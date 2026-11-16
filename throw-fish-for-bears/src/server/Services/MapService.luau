--[[ MapService: builds the whole world at server start from Layout + ZoneConfig.
     Front: SELL / SHOP stalls, throw zone. Middle: 4 fenced bases + BIG CATCH
     workout circle in front of each. Rear: sand strip, lake, 4 docks.
     Corridor: brick walls + zone decor (Green Forest in the slice). ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")
local Studs = require(ReplicatedStorage.Shared.Models.Studs)
local Layout = require(ReplicatedStorage.Shared.Layout)
local ZoneConfig = require(ReplicatedStorage.Shared.Config.ZoneConfig)
local Props = require(script.Parent.Parent.World.Props)

local MapService = {}
MapService.baseSigns = {} -- [i] = TextLabel
MapService.baseFolders = {}
MapService.decor = nil -- folder with blocking decor (raycast checks)

local CF = CFrame.new
local V3 = Vector3.new
local C = Color3.fromRGB
local GRASS = C(96, 182, 66)
local GRASS_DARK = C(84, 164, 58)
local SAND = C(226, 190, 128)
local WATER = C(48, 138, 236)

local function prompt(anchor: BasePart, kind: string, action: string, object: string, dist: number?)
	local p = Instance.new("ProximityPrompt")
	p.Name = "TFBPrompt"
	p.ActionText = action
	p.ObjectText = object
	p.KeyboardKeyCode = Enum.KeyCode.F
	p.HoldDuration = 0
	p.MaxActivationDistance = dist or 12
	p.RequiresLineOfSight = false
	p.Style = Enum.ProximityPromptStyle.Default
	p:SetAttribute("TFBPrompt", kind)
	p.Parent = anchor
	return p
end

local function buildGround(map)
	-- the world plate (max part size 2048)
	local minZ = Layout.CORRIDOR_END_Z - 120
	local maxZ = Layout.LAKE.maxZ + 40
	Studs.static(map, "Ground", V3(760, 4, maxZ - minZ), CF(0, -2, (minZ + maxZ) / 2), GRASS)
	-- subtle darker tiles in the compound so the floor reads like the reference baseplate
	for i, c in Layout.BASE_CENTERS do
		local floor = Studs.static(map, "BaseFloor" .. i, V3(Layout.BASE_SIZE - 2, 0.2, Layout.BASE_SIZE - 2), CF(c.X, 0.1, c.Z), GRASS_DARK)
		floor.CanCollide = false
	end
	-- sand "fishing zone" strip with its label
	local s = Layout.SAND
	Studs.static(map, "Sand", V3(s.maxX - s.minX, 0.4, s.maxZ - s.minZ + 4), CF((s.minX + s.maxX) / 2, 0.2, (s.minZ + s.maxZ) / 2 + 2), SAND)
	Props.groundText(map, V3(0, 0.4, (s.minZ + s.maxZ) / 2), Vector2.new(60, 10), "Fishing Zone", math.pi)
	-- lake: water surface + darker deep bed for depth
	local l = Layout.LAKE
	local water = Studs.static(map, "Lake", V3(l.maxX - l.minX, 1, l.maxZ - l.minZ), CF(0, Layout.WATER_Y - 0.5, (l.minZ + l.maxZ) / 2), WATER, { smooth = true })
	water.Material = Enum.Material.Plastic
	water.Transparency = 0.12
	water.CanCollide = false
	Studs.static(map, "LakeBed", V3(l.maxX - l.minX, 2, l.maxZ - l.minZ), CF(0, Layout.WATER_Y - 8, (l.minZ + l.maxZ) / 2), C(30, 90, 170))
	-- lake shore walls under the water so nothing walks on the bed
	Studs.static(map, "LakeKill", V3(l.maxX - l.minX, 1, l.maxZ - l.minZ - 6), CF(0, Layout.WATER_Y - 6.5, (l.minZ + l.maxZ) / 2 + 3), C(30, 90, 170), { transparency = 1, noQuery = true })
	MapService.water = water
end

local function buildCompound(map, rand)
	local c = Layout.COMPOUND
	local h = 12
	-- side walls and front wall (rear is open on the lake)
	Props.brickWall(map, V3(c.minX, 0, c.minZ), V3(c.minX, 0, c.maxZ - 6), h, 4)
	Props.brickWall(map, V3(c.maxX, 0, c.minZ), V3(c.maxX, 0, c.maxZ - 6), h, 4)
	Props.brickWall(map, V3(c.minX, 0, c.minZ), V3(-Layout.CORRIDOR_HALF - 2, 0, c.minZ), h, 4)
	Props.brickWall(map, V3(Layout.CORRIDOR_HALF + 2, 0, c.minZ), V3(c.maxX, 0, c.minZ), h, 4)
	-- white guide lines (reference: thin white lines on the ground)
	local function line(z, x0, x1)
		Studs.static(map, "Line", V3(x1 - x0, 0.12, 0.8), CF((x0 + x1) / 2, 0.06, z), C(255, 255, 255), { smooth = true, noCollide = true })
	end
	line(Layout.THROW_AREA.maxZ, Layout.THROW_AREA.minX, Layout.THROW_AREA.maxX)
	line(Layout.FRONT.maxZ + 1, c.minX + 3, c.maxX - 3)
	line(Layout.SAND.minZ - 0.5, c.minX + 3, c.maxX - 3)
	Props.groundText(map, V3(0, 0, Layout.THROW_AREA.maxZ - 6), Vector2.new(40, 7), "Throw Zone", math.pi)
	-- throw area tint
	local ta = Layout.THROW_AREA
	local tint = Studs.static(map, "ThrowArea", V3(ta.maxX - ta.minX, 0.1, ta.maxZ - ta.minZ), CF((ta.minX + ta.maxX) / 2, 0.05, (ta.minZ + ta.maxZ) / 2), C(110, 196, 78))
	tint.CanCollide = false
	-- outside scenery trees like the reference horizon
	for i = 1, 26 do
		local side = if i % 2 == 0 then 1 else -1
		local x = side * (rand:NextNumber() * 120 + 236)
		local z = rand:NextNumber() * (Layout.LAKE.minZ - Layout.CORRIDOR_END_Z) + Layout.CORRIDOR_END_Z
		Props.tree(map, V3(x, 0, z), 1 + rand:NextNumber() * 0.7, rand)
	end
	for i = 1, 10 do
		local side = if i % 2 == 0 then 1 else -1
		Props.tree(map, V3(side * (rand:NextNumber() * 80 + 90), 0, Layout.CORRIDOR_START_Z - 30 - rand:NextNumber() * 200), 0.9 + rand:NextNumber() * 0.6, rand)
	end
end

local function buildBases(map)
	for i, c in Layout.BASE_CENTERS do
		local folder = Instance.new("Folder")
		folder.Name = "Base" .. i
		folder.Parent = map
		MapService.baseFolders[i] = folder
		local h = Layout.BASE_HALF
		local gate = Layout.BASE_GATE_WIDTH
		local col = Layout.BASE_COLORS[i]
		Props.fence(folder, V3(c.X - h, 0, c.Z - h), V3(c.X + h, 0, c.Z - h), gate)
		Props.fence(folder, V3(c.X - h, 0, c.Z + h), V3(c.X + h, 0, c.Z + h), gate)
		Props.fence(folder, V3(c.X - h, 0, c.Z - h), V3(c.X - h, 0, c.Z + h))
		Props.fence(folder, V3(c.X + h, 0, c.Z - h), V3(c.X + h, 0, c.Z + h))
		-- owner colour border inside the fence
		for _, side in { -1, 1 } do
			local b1 = Studs.static(folder, "Border", V3(Layout.BASE_SIZE - 4, 0.16, 1.2), CF(c.X, 0.15, c.Z + side * (h - 2)), col)
			b1.CanCollide = false
			local b2 = Studs.static(folder, "Border", V3(1.2, 0.16, Layout.BASE_SIZE - 4), CF(c.X + side * (h - 2), 0.15, c.Z), col)
			b2.CanCollide = false
		end
		-- owner sign at the front gate
		local signPos = V3(c.X - gate / 2 - 6, 0, c.Z - h - 1.5)
		Studs.static(folder, "SignPost", V3(1, 7, 1), CF(signPos + V3(-3.6, 3.5, 0)), Props.WOOD_DARK)
		Studs.static(folder, "SignPost", V3(1, 7, 1), CF(signPos + V3(3.6, 3.5, 0)), Props.WOOD_DARK)
		local board = Studs.static(folder, "SignBoard", V3(9, 3.4, 0.6), CF(signPos + V3(0, 6.2, 0)), Props.WOOD)
		Studs.static(folder, "SignStripe", V3(9.2, 0.6, 0.7), CF(signPos + V3(0, 8.1, 0)), col)
		MapService.baseSigns[i] = Props.signText(board, "Empty Base", Enum.NormalId.Front)
		-- flag with the base colour
		Studs.static(folder, "FlagPole", V3(0.6, 14, 0.6), CF(c.X + h - 3, 7, c.Z - h + 3), C(220, 220, 225))
		Studs.static(folder, "Flag", V3(0.2, 3, 5), CF(c.X + h - 3, 12.4, c.Z - h + 5.6), col)

		-- small white training circle at the outer front corner of the base
		local tp = Layout.trainPos(i)
		local r = Layout.TRAIN_RADIUS
		local ring = Studs.static(folder, "TrainRing", V3(0.24, r * 2, r * 2), CF(tp + V3(0, 0.12, 0)) * CFrame.Angles(0, 0, math.pi / 2), C(250, 250, 250), { shape = Enum.PartType.Cylinder, noCollide = true })
		ring.CanCollide = false
		local inner = Studs.static(folder, "TrainInner", V3(0.26, r * 2 - 1, r * 2 - 1), CF(tp + V3(0, 0.13, 0)) * CFrame.Angles(0, 0, math.pi / 2), GRASS, { shape = Enum.PartType.Cylinder, noCollide = true })
		inner.CanCollide = false

		-- dock behind the base
		Props.dock(folder, c.X, Layout.DOCK_START_Z, Layout.DOCK_END_Z, Layout.DOCK_WIDTH, Layout.DOCK_TOP_Y)
		local spot = Layout.dockEnd(i)
		local mark = Studs.static(folder, "FishSpot", V3(0.12, 5, 5), CF(spot + V3(0, 0.07, 0)) * CFrame.Angles(0, 0, math.pi / 2), col, { shape = Enum.PartType.Cylinder, noCollide = true })
		mark.CanCollide = false
		mark.Transparency = 0.3
	end
end

local function buildShops(map)
	local _, sellAnchor = Props.stall(map, CFrame.lookAt(Layout.SELL_POS, Layout.SELL_POS + V3(0, 0, -1)), C(220, 50, 50), "SELL")
	prompt(sellAnchor, "Sell", "Sell Fish", "SELL", 14)
	local _, shopAnchor = Props.stall(map, CFrame.lookAt(Layout.SHOP_POS, Layout.SHOP_POS + V3(0, 0, -1)), C(40, 110, 230), "SHOP")
	prompt(shopAnchor, "Shop", "Open Shop", "SHOP", 14)
	-- spawn (players are moved to their base right after spawning)
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "Spawn"
	spawn.Size = V3(10, 0.4, 10)
	spawn.CFrame = CF(Layout.SPAWN_POS + V3(0, 0.2, 0))
	spawn.Anchored = true
	spawn.Neutral = true
	spawn.Transparency = 1
	spawn.CanCollide = false
	spawn.Duration = 0
	spawn.Parent = map
end

local function buildCorridor(map, rand)
	local x = Layout.CORRIDOR_HALF + 2
	local z0, z1 = Layout.CORRIDOR_START_Z, Layout.CORRIDOR_END_Z
	Props.brickWall(map, V3(-x, 0, z0), V3(-x, 0, z1), Layout.WALL_HEIGHT, 4)
	Props.brickWall(map, V3(x, 0, z0), V3(x, 0, z1), Layout.WALL_HEIGHT, 4)
	Props.brickWall(map, V3(-x, 0, z1 - 2), V3(x, 0, z1 - 2), Layout.WALL_HEIGHT, 4)

	local decor = Instance.new("Folder")
	decor.Name = "Decor"
	decor.Parent = map
	MapService.decor = decor

	for i = 1, Layout.ZONE_COUNT do
		local zone = ZoneConfig.get(i)
		local a, b = Layout.zoneRange(i)
		local folder = Instance.new("Folder")
		folder.Name = "Zone" .. i .. "_" .. zone.id
		folder.Parent = decor
		-- zone ground: checker of two greens, dirt path down the middle
		local tile = 20
		for zz = a, b + tile, -tile do
			for xx = -Layout.CORRIDOR_HALF, Layout.CORRIDOR_HALF - tile, tile do
				local col = if ((zz - a) / tile + (xx + Layout.CORRIDOR_HALF) / tile) % 2 == 0 then zone.ground else zone.groundAlt
				local g = Studs.static(map, "ZoneGround", V3(tile, 0.2, tile), CF(xx + tile / 2, 0.1, zz - tile / 2), col)
				g.CanCollide = false
			end
		end
		local path = Studs.static(map, "Path", V3(14, 0.24, a - b), CF(0, 0.12, (a + b) / 2), zone.path)
		path.CanCollide = false
		for zz = a - 6, b + 6, -9 do
			local st = Studs.static(map, "PathStone", V3(3, 0.3, 2.4), CF((rand:NextNumber() - 0.5) * 8, 0.15, zz), C(150, 150, 150))
			st.CanCollide = false
		end
		-- entrance arch sign
		Studs.static(folder, "ArchL", V3(3, 20, 3), CF(-Layout.CORRIDOR_HALF + 4, 10, a - 4), Props.TRUNK)
		Studs.static(folder, "ArchR", V3(3, 20, 3), CF(Layout.CORRIDOR_HALF - 4, 10, a - 4), Props.TRUNK)
		local arch = Studs.static(folder, "ArchBoard", V3(40, 5, 1.2), CF(0, 19, a - 4), Props.WOOD)
		Studs.static(folder, "ArchLeaves", V3(46, 2, 3), CF(0, 22, a - 4), Props.LEAF)
		Props.signText(arch, ("ZONE %d  ·  %s"):format(i, zone.name:upper()), Enum.NormalId.Back)
		Props.signText(arch, "BASES  ↓", Enum.NormalId.Front)

		-- decor on both sides (centre lane |x| < 18 kept clear)
		local function sidePos(minX, maxX)
			local sx = if rand:NextNumber() < 0.5 then -1 else 1
			return V3(sx * (minX + rand:NextNumber() * (maxX - minX)), 0, a - 10 - rand:NextNumber() * (a - b - 20))
		end
		for _ = 1, 16 do
			Props.tree(folder, sidePos(40, 54), 0.8 + rand:NextNumber() * 0.5, rand)
		end
		for _ = 1, 14 do
			Props.bush(folder, sidePos(24, 56), 0.8 + rand:NextNumber() * 0.5, rand)
		end
		for _ = 1, 9 do
			Props.rock(folder, sidePos(26, 56), 0.7 + rand:NextNumber() * 0.6, rand)
		end
		for _ = 1, 45 do
			Props.flower(folder, sidePos(18, 58), rand)
		end
		-- little pond at the far end (reference: water + sand at the end of the corridor)
		local pz = b + 16
		Studs.static(folder, "PondSand", V3(70, 0.4, 26), CF(0, 0.2, pz), C(226, 196, 132))
		local pond = Studs.static(folder, "Pond", V3(52, 0.5, 14), CF(0, 0.25, pz - 3), WATER, { smooth = true })
		pond.Transparency = 0.15
		for _, sx in { -30, 30 } do
			Props.tree(folder, V3(sx, 0, pz), 0.9, rand)
		end
	end
end

local function buildSky(map, rand)
	for i = 1, 12 do
		Props.cloud(map, V3((rand:NextNumber() - 0.5) * 700, 110 + rand:NextNumber() * 40, Layout.CORRIDOR_END_Z + rand:NextNumber() * 900), 1 + rand:NextNumber() * 0.6, rand)
	end
	local atmo = Instance.new("Atmosphere")
	atmo.Density = 0.26
	atmo.Offset = 0.12
	atmo.Color = C(196, 226, 255)
	atmo.Decay = C(120, 170, 230)
	atmo.Glare = 0.2
	atmo.Haze = 1.2
	atmo.Parent = Lighting
	local cc = Instance.new("ColorCorrectionEffect")
	cc.Name = "TFBColor"
	cc.Saturation = 0.18
	cc.Contrast = 0.06
	cc.Brightness = 0.02
	cc.Parent = Lighting
	local bloom = Instance.new("BloomEffect")
	bloom.Intensity = 0.35
	bloom.Size = 24
	bloom.Threshold = 1.6
	bloom.Parent = Lighting
end

function MapService.build()
	local map = Instance.new("Folder")
	map.Name = "Map"
	local rand = Random.new(1337)
	buildGround(map)
	buildCompound(map, rand)
	buildBases(map)
	buildShops(map)
	buildCorridor(map, rand)
	buildSky(map, rand)
	map.Parent = workspace
	local npcs = Instance.new("Folder")
	npcs.Name = "Bears"
	npcs.Parent = workspace
	local fx = Instance.new("Folder")
	fx.Name = "WorldFx"
	fx.Parent = workspace
	MapService.map = map
	MapService.bearsFolder = npcs
	MapService.fxFolder = fx
	return map
end

function MapService.setBaseOwner(i: number, player: Player?)
	local label = MapService.baseSigns[i]
	if label then
		label.Text = if player then (player.DisplayName .. "'s Base") else "Empty Base"
	end
end

return MapService
