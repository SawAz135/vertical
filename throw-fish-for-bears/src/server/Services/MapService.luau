--[[ MapService: builds the whole world at server start from Layout + ZoneConfig.
     Front: SELL / SHOP stalls, throw zone. Middle: 4 fenced bases + FISH-UP
     training station at the outer front corner of each. Rear: sand strip, lake, 4 docks.
     Corridor: brick walls + 10 themed zones (forest, pine, lake, snow, ice,
     bamboo, river, rocky, deep forest, beach). ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")
local Studs = require(ReplicatedStorage.Shared.Models.Studs)
local Layout = require(ReplicatedStorage.Shared.Layout)
local ZoneConfig = require(ReplicatedStorage.Shared.Config.ZoneConfig)
local Props = require(script.Parent.Parent.World.Props)
local Backdrop = require(ReplicatedStorage.Shared.Models.Backdrop)
local FishBuilder = require(ReplicatedStorage.Shared.Models.FishBuilder)
local Formulas = require(ReplicatedStorage.Shared.Formulas)

-- anchored decorative fish (Fish-Up trophies / dumbbells)
local function buildFish(id: string, scale: number): Model
	local f = FishBuilder.build(id, { scale = scale })
	for _, d in f:GetDescendants() do
		if d:IsA("BasePart") then
			d.Anchored = true
			d.CanCollide = false
			d.CanQuery = false
			d.CanTouch = false
		end
	end
	f:SetAttribute("Kind", "Decor")
	return f
end

local MapService = {}
MapService.baseSigns = {} -- [i] = TextLabel
MapService.baseFolders = {}
MapService.fishUps = {} -- [base] = FISH-UP station model
MapService.decor = nil -- folder with blocking decor (raycast checks)

local CF = CFrame.new
local V3 = Vector3.new
local C = Color3.fromRGB
local GRASS = C(78, 172, 50)
local GRASS_DARK = C(68, 156, 44)
local SAND = C(226, 190, 128)
local WATER = C(30, 140, 245)

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
	-- the grass stops where the lake starts (it used to cover the water = green lake)
	local minZ = Layout.CORRIDOR_END_Z - 120
	local maxZ = Layout.LAKE.minZ
	-- the ground stops at the walls: no empty grass plain outside the map
	-- compound plate (inside the outer walls, up to the lake)
	local cp = Layout.COMPOUND
	local cw = (cp.maxX + 3) * 2
	local cz0 = cp.minZ - 3
	Studs.static(map, "Ground", V3(cw, 4, maxZ - cz0), CF(0, -2, (cz0 + maxZ) / 2), GRASS)
	-- corridor plate: as wide as the corridor + its mountain backdrop (chunks: parts <= 2048)
	local corW = (Layout.CORRIDOR_HALF + 100) * 2
	local CHUNK = 1000
	local z0 = minZ
	while z0 < cz0 - 0.01 do
		local z1 = math.min(cz0, z0 + CHUNK)
		Studs.static(map, "Ground", V3(corW, 4, z1 - z0), CF(0, -2, (z0 + z1) / 2), GRASS)
		z0 = z1
	end
	-- thin grass banks framing the lake
	local l0 = Layout.LAKE
	for _, sx in { -1, 1 } do
		Studs.static(map, "GroundSide", V3(6, 4, l0.maxZ - l0.minZ + 6), CF(sx * (l0.maxX + 3), -2, (l0.minZ + l0.maxZ + 6) / 2), GRASS)
	end
	Studs.static(map, "GroundBack", V3((l0.maxX + 6) * 2, 4, 6), CF(0, -2, l0.maxZ + 3), GRASS)
	-- lake shore wall (sand coloured bank under the edge of the grass)
	Studs.static(map, "Shore", V3(l0.maxX - l0.minX, 9, 2), CF(0, -4.5, l0.minZ + 1), C(200, 168, 110))
	-- subtle darker tiles in the compound so the floor reads like the reference baseplate
	for i, c in Layout.BASE_CENTERS do
		local floor = Studs.static(map, "BaseFloor" .. i, V3(Layout.BASE_SIZE - 2, 0.2, Layout.BASE_SIZE - 2), CF(c.X, 0.1, c.Z), GRASS_DARK)
		floor.CanCollide = false
	end
	-- sand "fishing zone" strip with its label
	local s = Layout.SAND
	Studs.static(map, "Sand", V3(s.maxX - s.minX, 0.4, s.maxZ - s.minZ + 4), CF((s.minX + s.maxX) / 2, 0.2, (s.minZ + s.maxZ) / 2 + 2), SAND)

	Props.groundLabel(map, V3(0, 0.4, (s.minZ + s.maxZ) / 2), 40, 8, "FISHING ZONE")
	-- lake: water surface + darker deep bed for depth
	local l = Layout.LAKE
	local water = Studs.static(map, "Lake", V3(l.maxX - l.minX, 1, l.maxZ - l.minZ), CF(0, Layout.WATER_Y - 0.5, (l.minZ + l.maxZ) / 2), WATER, { smooth = true })
	water.Material = Enum.Material.Plastic
	water.Transparency = 0.05
	water.Reflectance = 0.08
	water.CanCollide = false
	Studs.static(map, "LakeBed", V3(l.maxX - l.minX, 2, l.maxZ - l.minZ), CF(0, Layout.WATER_Y - 8, (l.minZ + l.maxZ) / 2), C(20, 70, 150))
	-- lake shore walls under the water so nothing walks on the bed
	Studs.static(map, "LakeKill", V3(l.maxX - l.minX, 1, l.maxZ - l.minZ - 6), CF(0, Layout.WATER_Y - 6.5, (l.minZ + l.maxZ) / 2 + 3), C(30, 90, 170), { transparency = 1, noQuery = true })
	MapService.water = water
end

local function buildCompound(map, rand)
	local c = Layout.COMPOUND
	local h = 26
	-- side walls and front wall (rear is open on the lake)
	Props.brickWall(map, V3(c.minX, 0, c.minZ), V3(c.minX, 0, c.maxZ - 6), h, 4)
	Props.brickWall(map, V3(c.maxX, 0, c.minZ), V3(c.maxX, 0, c.maxZ - 6), h, 4)
	Props.brickWall(map, V3(c.minX, 0, c.minZ), V3(-Layout.CORRIDOR_HALF - 2, 0, c.minZ), h, 4)
	Props.brickWall(map, V3(Layout.CORRIDOR_HALF + 2, 0, c.minZ), V3(c.maxX, 0, c.minZ), h, 4)
	-- white guide lines (reference: thin white lines on the ground)
	local function line(z, x0, x1)
		Studs.static(map, "Line", V3(x1 - x0, 0.12, 0.8), CF((x0 + x1) / 2, 0.06, z), C(255, 255, 255), { smooth = true, noCollide = true })
	end
	-- throw zone: front line as wide as the corridor + 2 side lines back to the corridor corners
	local ta = Layout.THROW_AREA
	line(ta.maxZ, ta.minX, ta.maxX)
	for _, x in { ta.minX, ta.maxX } do
		Studs.static(map, "Line", V3(0.8, 0.12, ta.maxZ - c.minZ), CF(x, 0.06, (ta.maxZ + c.minZ) / 2), C(255, 255, 255), { smooth = true, noCollide = true })
	end
	line(Layout.FRONT.maxZ + 1, c.minX + 3, c.maxX - 3)
	line(Layout.SAND.minZ - 0.5, c.minX + 3, c.maxX - 3)
	Props.groundLabel(map, V3(0, 0, Layout.THROW_AREA.maxZ - 6), 44, 8, "THROW ZONE")
	-- decor along the inside of the compound walls (keeps the front lively)
	for z = c.minZ + 12, Layout.FRONT.maxZ - 6, 22 do
		for _, sx in { -1, 1 } do
			Props.tree(map, V3(sx * (c.maxX - 9), 0, z), 0.85 + rand:NextNumber() * 0.3, rand)
		end
	end
	for x = -190, 190, 26 do
		if math.abs(x) > 70 and math.abs(math.abs(x) - 72) > 14 then
			Props.bush(map, V3(x, 0, c.minZ + 6), 0.9, rand)
			for _ = 1, 3 do
				Props.flower(map, V3(x + rand:NextNumber() * 14 - 7, 0, c.minZ + 10 + rand:NextNumber() * 6), rand)
			end
		end
	end
	for _ = 1, 10 do
		local sx = if rand:NextNumber() < 0.5 then -1 else 1
		Props.rock(map, V3(sx * (90 + rand:NextNumber() * 60), 0, c.minZ + 22 + rand:NextNumber() * 60), 0.7, rand)
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
		-- FISH-UP training station at the outer front corner of the base
		local tp = Layout.trainPos(i)
		local side = if c.X < 0 then -1 else 1
		local station, anchor = Props.fishUp(folder, tp, side, col, buildFish)
		MapService.fishUps[i] = station
		anchor:SetAttribute("FishUpBase", i)

		-- dock behind the base
		Props.dock(folder, c.X, Layout.DOCK_START_Z, Layout.DOCK_END_Z, Layout.DOCK_WIDTH, Layout.DOCK_TOP_Y)
		local spot = Layout.dockEnd(i)
		local mark = Studs.static(folder, "FishSpot", V3(0.12, 5, 5), CF(spot + V3(0, 0.07, 0)) * CFrame.Angles(0, 0, math.pi / 2), col, { shape = Enum.PartType.Cylinder, noCollide = true })
		mark.CanCollide = false
		mark.Transparency = 0.3
	end
end

local function buildShops(map)
	local _, sellAnchor = Props.stall(map, CFrame.lookAt(Layout.SELL_POS, Layout.SELL_POS + V3(0, 0, 1)), C(220, 50, 50), "SELL")
	prompt(sellAnchor, "Sell", "Sell Fish", "SELL", 14)
	local _, shopAnchor = Props.stall(map, CFrame.lookAt(Layout.SHOP_POS, Layout.SHOP_POS + V3(0, 0, 1)), C(40, 110, 230), "SHOP")
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

local K = Layout.CORRIDOR_HALF / 60 -- decor positions were authored for a 60 half width
local function buildCorridor(map, rand)
	local x = Layout.CORRIDOR_HALF + 2
	local z0, z1 = Layout.CORRIDOR_START_Z, Layout.CORRIDOR_END_Z
	-- the corridor walls are built PER ZONE in the zone's style (below); the end wall here
	local lastZone = ZoneConfig.get(Layout.ZONE_COUNT)
	Props.brickWall(map, V3(-x, 0, z1 - 2), V3(x, 0, z1 - 2), Layout.WALL_HEIGHT, 4, Props.WALL_STYLES[lastZone.theme])

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
		-- zone ground: checker of two tones, path down the middle
		local tile = Layout.CORRIDOR_HALF / 2 -- 4 tiles across the corridor
		for zz = a, b + tile, -tile do
			for xx = -Layout.CORRIDOR_HALF, Layout.CORRIDOR_HALF - tile, tile do
				local col = if ((zz - a) / tile + (xx + Layout.CORRIDOR_HALF) / tile) % 2 == 0 then zone.ground else zone.groundAlt
				local g = Studs.static(map, "ZoneGround", V3(tile, 0.2, tile), CF(xx + tile / 2, 0.1, zz - tile / 2), col)
				g.CanCollide = false
			end
		end
		local path = Studs.static(map, "Path", V3(14, 0.24, a - b), CF(0, 0.12, (a + b) / 2), zone.path)
		path.CanCollide = false
		-- walls in the zone's style + ground details + the mountains behind the walls
		local style = Props.WALL_STYLES[zone.theme]
		local wx = Layout.CORRIDOR_HALF + 2
		Props.brickWall(folder, V3(-wx, 0, a), V3(-wx, 0, b), Layout.WALL_HEIGHT, 4, style)
		Props.brickWall(folder, V3(wx, 0, a), V3(wx, 0, b), Layout.WALL_HEIGHT, 4, style)
		pcall(Props.groundDetails, folder, zone.theme, a, b, Layout.CORRIDOR_HALF, rand)
		for _, side in { -1, 1 } do
			local ok, err = pcall(Backdrop.build, folder, zone.theme, a, b, side, wx + 2, i * 7919 + (if side > 0 then 13 else 0), Layout.WALL_HEIGHT, i == 1)
			if not ok then warn("[TFB] backdrop", err) end
		end
		-- soft transition strip at the zone border (blends both grounds)
		if i > 1 then
			local prev = ZoneConfig.get(i - 1)
			local strip = Studs.static(map, "ZoneBlend", V3(Layout.CORRIDOR_HALF * 2, 0.22, 6), CF(0, 0.11, a - 1), prev.ground:Lerp(zone.ground, 0.5))
			strip.CanCollide = false
		end
		-- entrance arch: zone name + recommended strength
		Studs.static(folder, "ArchL", V3(3, 20, 3), CF(-Layout.CORRIDOR_HALF + 4, 10, a - 4), Props.TRUNK)
		Studs.static(folder, "ArchR", V3(3, 20, 3), CF(Layout.CORRIDOR_HALF - 4, 10, a - 4), Props.TRUNK)
		local arch = Studs.static(folder, "ArchBoard", V3(44, 6, 1.2), CF(0, 19, a - 4), zone.sign)
		Studs.static(folder, "ArchFrame", V3(46, 7, 0.8), CF(0, 19, a - 3.4), Props.WOOD_DARK)
		Studs.static(folder, "ArchTop", V3(50, 2, 3), CF(0, 22.6, a - 4), zone.groundAlt)
		local rec = Formulas.zoneStrength(i)
		Props.signText(arch, ("ZONE %d  ·  %s"):format(i, zone.name:upper()), Enum.NormalId.Back)
		Props.signText(arch, if rec > 0 then ("💪 %s+  ·  BASES ↓"):format(rec >= 1000 and (math.floor(rec / 100) / 10 .. "K") or tostring(rec)) else "BASES ↓", Enum.NormalId.Front)
		arch:SetAttribute("Zone", i)

		-- decor on both sides (centre lane |x| < 18 kept clear)
		local function sidePos(minX, maxX)
			-- authored for a 60-wide half corridor: scaled to the current width (centre lane kept clear)
			minX = math.max(16, minX * K)
			maxX = math.max(minX + 2, maxX * K)
			local sx = if rand:NextNumber() < 0.5 then -1 else 1
			return V3(sx * (minX + rand:NextNumber() * (maxX - minX)), 0, a - 10 - rand:NextNumber() * (a - b - 20))
		end
		local theme = zone.theme
		if theme == "forest" then
			for _ = 1, 16 do Props.tree(folder, sidePos(40, 54), 0.8 + rand:NextNumber() * 0.5, rand) end
			for _ = 1, 12 do Props.bush(folder, sidePos(24, 56), 0.8 + rand:NextNumber() * 0.5, rand) end
			for _ = 1, 8 do Props.rock(folder, sidePos(26, 56), 0.7 + rand:NextNumber() * 0.6, rand) end
			for _ = 1, 30 do Props.flower(folder, sidePos(18, 58), rand) end
		elseif theme == "pine" then
			for _ = 1, 22 do Props.snowPine(folder, sidePos(34, 55), 0.9 + rand:NextNumber() * 0.6, rand, false) end
			for _ = 1, 6 do Props.log(folder, sidePos(24, 50), 0.9, rand) end
			for _ = 1, 8 do Props.rock(folder, sidePos(24, 56), 0.7 + rand:NextNumber() * 0.5, rand) end
			for _ = 1, 10 do Props.fern(folder, sidePos(20, 56), 0.9, rand) end
			for _ = 1, 8 do
				local p = sidePos(20, 56)
				Studs.static(folder, "Needles", V3(6, 0.08, 5), CF(p + V3(0, 0.26, 0)) * CFrame.Angles(0, rand:NextNumber() * 3, 0), C(130, 96, 56), { noCollide = true, smooth = true })
			end
		elseif theme == "lake" then
			for _, sx in { -1, 1 } do
				Props.pond(folder, V3(sx * 38 * K, 0, a - 80), 26, 50, rand, true)
				Props.pond(folder, V3(sx * 40 * K, 0, a - 210), 22, 60, rand, true)
			end
			for _ = 1, 10 do Props.reeds(folder, sidePos(22, 30), rand) end
			for _ = 1, 10 do Props.snowPine(folder, sidePos(50, 56), 0.9 + rand:NextNumber() * 0.4, rand, false) end
			for _ = 1, 10 do Props.rock(folder, sidePos(22, 56), 0.6 + rand:NextNumber() * 0.5, rand) end
			for _ = 1, 16 do Props.flower(folder, sidePos(18, 56), rand) end
		elseif theme == "snow" then
			for _ = 1, 20 do Props.snowPine(folder, sidePos(34, 55), 0.9 + rand:NextNumber() * 0.5, rand, true) end
			for _ = 1, 12 do Props.snowPile(folder, sidePos(20, 56), 0.8 + rand:NextNumber() * 0.6, rand) end
			for _ = 1, 6 do Props.rock(folder, sidePos(24, 56), 0.7, rand) end
		elseif theme == "ice" then
			for _, sx in { -1, 1 } do
				Props.frozenPond(folder, V3(sx * 38 * K, 0, a - 75), 28, 60)
				Props.frozenPond(folder, V3(sx * 38 * K, 0, a - 220), 28, 70)
			end
			for _ = 1, 12 do Props.iceBlock(folder, sidePos(22, 56), 0.8 + rand:NextNumber() * 0.6, rand) end
			for _ = 1, 10 do Props.snowPile(folder, sidePos(20, 56), 0.9, rand) end
			for _ = 1, 6 do Props.snowPine(folder, sidePos(50, 56), 0.9, rand, true) end
		elseif theme == "bamboo" then
			for _ = 1, 20 do Props.bamboo(folder, sidePos(30, 54), 0.9 + rand:NextNumber() * 0.4, rand) end
			for _ = 1, 6 do Props.tree(folder, sidePos(40, 54), 0.9, rand, C(250, 170, 200)) end
			for z = a - 40, b + 40, -70 do
				Props.lantern(folder, V3(-12, 0, z))
				Props.lantern(folder, V3(12, 0, z - 35))
			end
			for _ = 1, 14 do Props.flower(folder, sidePos(18, 56), rand) end
		elseif theme == "river" then
			-- streams on both sides with a footbridge, trees and reeds along the banks
			for _, sx in { -1, 1 } do
				local w = Studs.static(folder, "Stream", V3(14, 0.4, a - b - 20), CF(sx * 38 * K, 0.2, (a + b) / 2), C(50, 140, 230), { smooth = true, noCollide = true })
				w.Transparency = 0.1
				Studs.static(folder, "StreamBank", V3(18, 0.3, a - b - 18), CF(sx * 38 * K, 0.12, (a + b) / 2), C(150, 126, 90))
				Props.bridge(folder, CF(sx * 38 * K, 0, a - 150) * CFrame.Angles(0, math.pi / 2, 0), 20, 6)
			end
			for _ = 1, 12 do Props.tree(folder, sidePos(48, 56), 0.9 + rand:NextNumber() * 0.4, rand) end
			for _ = 1, 10 do Props.reeds(folder, sidePos(28, 31), rand) end
			for _ = 1, 10 do Props.rock(folder, sidePos(20, 30), 0.6 + rand:NextNumber() * 0.4, rand) end
			for _ = 1, 20 do Props.flower(folder, sidePos(18, 28), rand) end
		elseif theme == "rocky" then
			for _ = 1, 14 do Props.cliff(folder, sidePos(40, 52), 1 + rand:NextNumber() * 0.6, rand) end
			for _ = 1, 14 do Props.rock(folder, sidePos(20, 56), 0.8 + rand:NextNumber() * 0.8, rand) end
			for _ = 1, 6 do Props.snowPine(folder, sidePos(30, 56), 0.8, rand, false) end
		elseif theme == "deep" then
			for _ = 1, 22 do Props.tree(folder, sidePos(34, 55), 1.1 + rand:NextNumber() * 0.5, rand, C(36, 100, 40)) end
			for _ = 1, 10 do Props.giantMushroom(folder, sidePos(22, 50), 0.8 + rand:NextNumber() * 0.6, rand) end
			for _ = 1, 8 do Props.log(folder, sidePos(22, 50), 1, rand) end
			for _ = 1, 16 do Props.fern(folder, sidePos(18, 56), 1, rand) end
		elseif theme == "beach" then
			for _ = 1, 16 do Props.palm(folder, sidePos(30, 54), 0.9 + rand:NextNumber() * 0.4, rand) end
			for _ = 1, 22 do Props.shell(folder, sidePos(18, 56), rand) end
			for _ = 1, 6 do Props.rock(folder, sidePos(26, 56), 0.6, rand) end
			for k = 1, 4 do
				Props.umbrella(folder, sidePos(24, 40), ({ C(240, 60, 60), C(60, 160, 240), C(250, 200, 40), C(90, 200, 90) })[k])
			end
		end
		if i == Layout.ZONE_COUNT then
			-- the corridor ends on the sea: water + sand bank against the end wall
			local pz = b + 22
			Studs.static(folder, "Shore", V3(Layout.CORRIDOR_HALF * 2, 0.4, 30), CF(0, 0.2, pz), C(246, 226, 170))
			local sea = Studs.static(folder, "Sea", V3(Layout.CORRIDOR_HALF * 2 - 4, 0.5, 18), CF(0, 0.3, b + 10), C(40, 170, 230), { smooth = true })
			sea.Transparency = 0.1
		end
	end
end

local function buildSky(map, rand)
	for i = 1, 12 do
		Props.cloud(map, V3((rand:NextNumber() - 0.5) * 700, 110 + rand:NextNumber() * 40, Layout.CORRIDOR_END_Z + rand:NextNumber() * 900), 1 + rand:NextNumber() * 0.6, rand)
	end
	local atmo = Instance.new("Atmosphere")
	atmo.Density = 0.16
	atmo.Offset = 0.1
	atmo.Color = C(196, 226, 255)
	atmo.Decay = C(120, 170, 230)
	atmo.Glare = 0.1
	atmo.Haze = 0.55
	atmo.Parent = Lighting
	local cc = Instance.new("ColorCorrectionEffect")
	cc.Name = "TFBColor"
	cc.Saturation = 0.22 -- vivid toy colours
	cc.Contrast = 0.14 -- crisper studs / shadows
	cc.Brightness = 0.02
	cc.Parent = Lighting
	local bloom = Instance.new("BloomEffect")
	bloom.Intensity = 0.12
	bloom.Size = 18
	bloom.Threshold = 2.2
	bloom.Parent = Lighting
end

function MapService.build()
	local map = Instance.new("Folder")
	map.Name = "Map"
	local rand = Random.new(1337)
	-- each section is built on its own: an error in one decor never removes the ground
	local function step(name: string, fn, ...)
		local ok, err = pcall(fn, ...)
		if not ok then warn("[TFB] map section failed:", name, err) end
	end
	step("ground", buildGround, map)
	step("compound", buildCompound, map, rand)
	step("bases", buildBases, map)
	step("shops", buildShops, map)
	step("corridor", buildCorridor, map, rand)
	step("sky", buildSky, map, rand)
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

-- re-skin a base's FISH-UP for its owner's tier (FishUpConfig)
function MapService.setFishUpTier(i: number, tier: number)
	local m = MapService.fishUps[i]
	if m then
		local ok, err = pcall(Props.fishUpTier, m, tier)
		if not ok then warn("[TFB] fish-up tier", err) end
	end
end

function MapService.setBaseOwner(i: number, player: Player?)
	local label = MapService.baseSigns[i] -- base signs were removed (kept for API compatibility)
	if label then
		label.Text = if player then (player.DisplayName .. "'s Base") else "Empty Base"
	end
end

return MapService
