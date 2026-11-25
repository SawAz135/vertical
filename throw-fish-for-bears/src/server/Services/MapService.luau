--[[ MapService: builds the whole world at server start from Layout + ZoneConfig.
     Front: SELL / SHOP stalls, throw zone. Middle: 4 fenced bases + FISH-UP
     training station at the outer front corner of each. Rear: sand strip, lake, 4 docks.
     The whole compound is a PLATEAU (grass hills all around, invisible walls); the corridor
     is a TRENCH 20 studs lower (dirt checker cliffs with a stepped grass rim), reached by
     the stairs (left) and the ramp (right). 10 themed zones (forest, pine, lake, snow, ice,
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
local CHECK_LIGHT = C(132, 226, 44) -- checkerboard (damier) tones, shared by the spawn floor and the bases
local CHECK_DARK = C(98, 198, 30) -- (vivid lime like the reference; raw colours, not re-saturated)
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
	local cz0 = cp.minZ -- the plateau ends exactly at its front cliff
	Studs.static(map, "Ground", V3(cw, 4, maxZ - cz0), CF(0, -2, (cz0 + maxZ) / 2), GRASS)
	-- the TRENCH (corridor) floor, 20 studs below the plateau, and the land on both sides of
	-- the trench at plateau level (the mountains stand on it). Chunks: parts <= 2048.
	local H = Layout.CORRIDOR_HALF
	local cy = Layout.CORRIDOR_Y
	local CHUNK = 1000
	local z0 = minZ
	while z0 < cz0 - 0.01 do
		local z1 = math.min(cz0, z0 + CHUNK)
		Studs.static(map, "TrenchFloor", V3((H + 4) * 2, 4, z1 - z0), CF(0, cy - 2, (z0 + z1) / 2), GRASS)
		for _, sx in { -1, 1 } do
			Studs.static(map, "Ground", V3(120, 4, z1 - z0), CF(sx * (H + 4 + 60), -2, (z0 + z1) / 2), GRASS)
		end
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
		-- BASE FLOOR: small checkerboard inside the fence = one light plate + dark tiles on top
		-- (half the parts of a full grid): 22 x 22 cells of 4 studs. The beach is not touched.
		local folder = Instance.new("Folder")
		folder.Name = "BaseChecker" .. i
		local spanX, span = Layout.BASE_SIZE_X - 2, Layout.BASE_SIZE - 2
		local tile = 4 -- big checker squares, studs clearly visible
		local nx, n = math.floor(spanX / tile + 0.5), math.floor(span / tile + 0.5)
		local tx, tz = spanX / nx, span / n
		Studs.static(folder, "BasePlate", V3(spanX, 0.2, span), CF(c.X, 0.1, c.Z), CHECK_LIGHT, { noCollide = true, noShadow = true, raw = true })
		for a = 0, nx - 1 do
			for b = 0, n - 1 do
				if (a + b) % 2 == 1 then
					local x = c.X - spanX / 2 + (a + 0.5) * tx
					local z = c.Z - span / 2 + (b + 0.5) * tz
					Studs.static(folder, "BaseTile", V3(tx, 0.22, tz), CF(x, 0.11, z), CHECK_DARK, { noCollide = true, noShadow = true, raw = true })
				end
			end
		end
		folder.Parent = map
	end
	-- SPAWN FLOOR: small green checkerboard (damier) over the front area, bases excluded.
	-- One light plate per rectangle + dark tiles on top. NEVER inside the throw zone: tiles are
	-- 4 studs so the zone edges (x = +-48, z = 0) fall exactly on tile borders.
	do
		local TILE = 4
		local ta = Layout.THROW_AREA
		local folder = Instance.new("Folder")
		folder.Name = "SpawnChecker"
		local function plate(x0, x1, z0, z1)
			Studs.static(folder, "SpawnPlate", V3(x1 - x0, 0.08, z1 - z0), CF((x0 + x1) / 2, 0.04, (z0 + z1) / 2), CHECK_LIGHT, { noCollide = true, noShadow = true, raw = true })
		end
		local nX = math.floor((Layout.COMPOUND.maxX - 2) / TILE)
		local nZ = math.floor((Layout.BASE_Z - Layout.BASE_HALF - 2) / TILE)
		local X = nX * TILE
		plate(-X, X, 0, nZ * TILE) -- from the throw line to the bases
		plate(-X, ta.minX, -6 * TILE, 0) -- left of the throw zone
		plate(ta.maxX, X, -6 * TILE, 0) -- right of the throw zone
		for i = -nX, nX - 1 do
			local x0, x1 = i * TILE, (i + 1) * TILE
			for j = -6, nZ - 1 do
				if (i + j) % 2 == 1 then
					local z0, z1 = j * TILE, (j + 1) * TILE
					local inThrowZone = x1 > ta.minX and x0 < ta.maxX and z1 > ta.minZ - 2 and z0 < ta.maxZ
					if not inThrowZone then
						Studs.static(folder, "SpawnTile", V3(TILE, 0.11, TILE), CF((x0 + x1) / 2, 0.055, (z0 + z1) / 2), CHECK_DARK, { noCollide = true, noShadow = true, raw = true })
					end
				end
			end
		end
		folder.Parent = map
	end
	-- sand \"fishing zone\" strip with its label
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

-- cliff colours per zone theme (dirt checker a / b + the grass cap)
local CLIFF = {
	forest = { a = C(150, 96, 52), b = C(124, 76, 40), cap = C(96, 200, 40) },
	pine = { a = C(132, 86, 50), b = C(108, 68, 38), cap = C(70, 160, 50) },
	lake = { a = C(140, 104, 70), b = C(116, 84, 56), cap = C(90, 196, 70) },
	snow = { a = C(150, 158, 176), b = C(128, 136, 156), cap = C(244, 248, 255) },
	ice = { a = C(150, 196, 226), b = C(126, 176, 212), cap = C(240, 250, 255) },
	bamboo = { a = C(170, 128, 80), b = C(146, 106, 64), cap = C(110, 190, 60) },
	river = { a = C(146, 100, 60), b = C(120, 80, 46), cap = C(86, 196, 60) },
	rocky = { a = C(178, 112, 78), b = C(150, 90, 62), cap = C(176, 156, 92) },
	deep = { a = C(104, 76, 52), b = C(84, 60, 40), cap = C(56, 140, 46) },
	beach = { a = C(232, 200, 140), b = C(210, 176, 118), cap = C(244, 226, 168) },
}
MapService.CLIFF = CLIFF

-- low, flat grass lip for the plateau edge over the trench (the throw zone stays flat)
local LOW_RIM = { { from = 2.6, to = -2, y = 0, h = 0.6 }, { from = 0.4, to = -3.2, y = 0.6, h = 0.5 } }

local function buildCompound(map, rand)
	local c = Layout.COMPOUND
	local H = Layout.CORRIDOR_HALF
	local cy = Layout.CORRIDOR_Y
	-- 1) the plateau's FRONT CLIFF above the trench (face looks down the corridor), low grass lip
	Props.cliffFace(map, V3(-H, 0, c.minZ + 2), V3(H, 0, c.minZ + 2), cy, 0, V3(0, 0, -1), CLIFF.forest, rand, LOW_RIM)
	-- invisible wall along the whole edge: nobody goes down into the corridor (no stairs, no
	-- ramp: the fish flies down there, GO BACK brings you home after a capture)
	Props.invisibleWall(map, V3(-H - 6, 0, c.minZ - 0.4), V3(H + 6, 0, c.minZ - 0.4), 0, 40)
	-- 3) the PLATEAU WALLS: the same dirt-checker cliffs as the corridor, just as high (20),
	--    all around the spawn (front corners beside the trench, both sides, behind the lake),
	--    grass rim on top with still decor (birches, blocky trees, sunflowers, mushrooms)
	local P = Layout.PLATEAU_HALF
	local WH = Layout.PLATEAU_WALL
	local backZ = Layout.LAKE.maxZ + 2
	local walls = {
		{ V3(-P - 2, 0, c.minZ - 2), V3(-P - 2, 0, backZ + 2), V3(1, 0, 0) },
		{ V3(P + 2, 0, c.minZ - 2), V3(P + 2, 0, backZ + 2), V3(-1, 0, 0) },
		{ V3(-P - 4, 0, backZ + 2), V3(P + 4, 0, backZ + 2), V3(0, 0, -1) },
		{ V3(-P - 4, 0, c.minZ - 2), V3(-H - 4, 0, c.minZ - 2), V3(0, 0, 1) },
		{ V3(H + 4, 0, c.minZ - 2), V3(P + 4, 0, c.minZ - 2), V3(0, 0, 1) },
	}
	for _, wd in walls do
		local m = Props.cliffFace(map, wd[1], wd[2], 0, WH, wd[3], CLIFF.forest, rand)
		local d = wd[2] - wd[1]
		local len = d.Magnitude
		local along = d.Unit
		local out = -wd[3]
		local sPos = 2 + rand:NextNumber() * 3
		while sPos < len - 2 do
			-- on the highest grass step (offsets 4.5 .. 12 behind the face, top at WH + 3.6)
			local pos = wd[1] + along * sPos + out * (5.5 + rand:NextNumber() * 5.5) + V3(0, WH + 3.6, 0)
			local roll = rand:NextNumber()
			if roll < 0.22 then
				Props.birch(m, pos, 0.8 + rand:NextNumber() * 0.4, rand)
				sPos += 8
			elseif roll < 0.42 then
				Props.tree(m, pos, 0.75 + rand:NextNumber() * 0.35, rand, C(92, 190, 50))
				sPos += 10
			elseif roll < 0.62 then
				Props.sunflower(m, pos, rand)
				sPos += 3
			elseif roll < 0.74 then
				Props.mushroom(m, pos, 0.8 + rand:NextNumber() * 0.4)
				sPos += 3
			elseif roll < 0.86 then
				Props.bush(m, pos, 0.8, rand)
				sPos += 5
			else
				Props.flower(m, pos, rand)
				sPos += 2
			end
		end
	end
	-- white guide lines (reference: thin white lines on the ground)
	local function line(z, x0, x1)
		Studs.static(map, "Line", V3(x1 - x0, 0.12, 0.8), CF((x0 + x1) / 2, 0.06, z), C(255, 255, 255), { smooth = true, noCollide = true })
	end
	-- throw zone: front line as wide as the corridor + 2 side lines back to the cliff edge
	local ta = Layout.THROW_AREA
	-- the throw zone floor: a darker grass so it stands out from the rest of the front
	local tz0 = c.minZ
	local tzf = Studs.static(map, "ThrowFloor", V3(ta.maxX - ta.minX, 0.08, ta.maxZ - tz0), CF((ta.minX + ta.maxX) / 2, 0.04, (ta.maxZ + tz0) / 2), C(30, 92, 22))
	tzf.CanCollide = false
	line(ta.maxZ, ta.minX, ta.maxX)
	for _, x in { ta.minX, ta.maxX } do
		Studs.static(map, "Line", V3(0.8, 0.12, ta.maxZ - c.minZ), CF(x, 0.06, (ta.maxZ + c.minZ) / 2), C(255, 255, 255), { smooth = true, noCollide = true })
	end
	line(Layout.FRONT.maxZ + 1, c.minX + 3, c.maxX - 3)
	line(Layout.SAND.minZ - 0.5, c.minX + 3, c.maxX - 3)
	Props.groundLabel(map, V3(0, 0, Layout.THROW_AREA.maxZ - 6), 44, 8, "THROW ZONE")
	-- (no decor on the spawn floor: it stays clean around the bases; the decor is on the walls)
end

local function buildBases(map)
	for i, c in Layout.BASE_CENTERS do
		local folder = Instance.new("Folder")
		folder.Name = "Base" .. i
		folder.Parent = map
		MapService.baseFolders[i] = folder
		local hx, h = Layout.BASE_HALF_X, Layout.BASE_HALF
		local gate = Layout.BASE_GATE_WIDTH
		local col = Layout.BASE_COLORS[i]
		Props.fence(folder, V3(c.X - hx, 0, c.Z - h), V3(c.X + hx, 0, c.Z - h), gate)
		Props.fence(folder, V3(c.X - hx, 0, c.Z + h), V3(c.X + hx, 0, c.Z + h), gate)
		Props.fence(folder, V3(c.X - hx, 0, c.Z - h), V3(c.X - hx, 0, c.Z + h))
		Props.fence(folder, V3(c.X + hx, 0, c.Z - h), V3(c.X + hx, 0, c.Z + h))
		-- owner colour border inside the fence
		for _, side in { -1, 1 } do
			local b1 = Studs.static(folder, "Border", V3(Layout.BASE_SIZE_X - 4, 0.16, 1.2), CF(c.X, 0.15, c.Z + side * (h - 2)), col)
			b1.CanCollide = false
			local b2 = Studs.static(folder, "Border", V3(1.2, 0.16, Layout.BASE_SIZE - 4), CF(c.X + side * (hx - 2), 0.15, c.Z), col)
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

-- everything built in a zone folder at y = 0 that stands INSIDE the trench is sunk to the
-- trench floor (the cliffs and the mountains outside stay where they are)
local function sinkTrench(folder: Instance)
	local dy = Layout.CORRIDOR_Y - Layout.GROUND_Y
	for _, child in folder:GetChildren() do
		local ref: BasePart? = if child:IsA("BasePart") then child else child:FindFirstChildWhichIsA("BasePart", true)
		if ref and child.Name ~= "Cliff" and Layout.inTrench(ref.Position) and ref.Position.Y > Layout.CORRIDOR_Y + 0.05 - 0.5 then
			local list = if child:IsA("BasePart") then { child } else child:GetDescendants()
			for _, d in list do
				if d:IsA("BasePart") then d.CFrame = d.CFrame + V3(0, dy, 0) end
			end
		end
	end
end

local function buildCorridor(map, rand)
	local H = Layout.CORRIDOR_HALF
	local cy = Layout.CORRIDOR_Y
	local z0, z1 = Layout.CORRIDOR_START_Z, Layout.CORRIDOR_END_Z
	local _ = z0
	-- end of the trench: a cliff closing the corridor + plateau-level land behind it
	local lastZone = ZoneConfig.get(Layout.ZONE_COUNT)
	Props.cliffFace(map, V3(-H - 4, 0, z1 - 2), V3(H + 4, 0, z1 - 2), cy, Layout.PLATEAU_WALL, V3(0, 0, 1), CLIFF[lastZone.theme], rand)
	Studs.static(map, "Ground", V3((H + 4) * 2, 4, 116), CF(0, -2, z1 - 4 - 58), GRASS)

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
		-- zone ground: a finer, vivid checker (one light plate + the dark squares on top:
		-- half the parts of a full grid), studs everywhere
		local n = math.max(2, math.floor(H * 2 / 12 + 0.5))
		local tile = H * 2 / n -- ~12-stud squares
		local plate = Studs.static(folder, "ZoneGround", V3(H * 2, 0.2, a - b), CF(0, 0.1, (a + b) / 2), zone.ground)
		plate.CanCollide = false
		local rows = math.floor((a - b) / tile + 0.5)
		local tz = (a - b) / rows
		for j = 0, rows - 1 do
			for i = 0, n - 1 do
				if (i + j) % 2 == 1 then
					local g = Studs.static(folder, "ZoneGround", V3(tile, 0.22, tz), CF(-H + (i + 0.5) * tile, 0.11, a - (j + 0.5) * tz), zone.groundAlt)
					g.CanCollide = false
				end
			end
		end
		-- the trench walls: dirt cliffs in the zone's colours, stepped grass rim on top
		local cs = CLIFF[zone.theme] or CLIFF.forest
		-- as high as the spawn walls: their tops line up (20 above the plateau, 40 above the floor)
		Props.cliffFace(folder, V3(-H - 2, 0, a), V3(-H - 2, 0, b), cy, Layout.PLATEAU_WALL, V3(1, 0, 0), cs, rand)
		Props.cliffFace(folder, V3(H + 2, 0, a), V3(H + 2, 0, b), cy, Layout.PLATEAU_WALL, V3(-1, 0, 0), cs, rand)
		pcall(Props.groundDetails, folder, zone.theme, a, b, H, rand)
		for _, side in { -1, 1 } do
			local ok, err = pcall(Backdrop.build, folder, zone.theme, a, b, side, H + 12, i * 7919 + (if side > 0 then 13 else 0), Layout.PLATEAU_WALL + 6, i == 1)
			if not ok then warn("[TFB] backdrop", err) end
		end
		-- soft transition strip at the zone border (blends both grounds)
		if i > 1 then
			local prev = ZoneConfig.get(i - 1)
			local strip = Studs.static(folder, "ZoneBlend", V3(H * 2, 0.22, 6), CF(0, 0.11, a - 1), prev.ground:Lerp(zone.ground, 0.5))
			strip.CanCollide = false
		end
		-- (no signs at all in the corridor: the zone name shows as a banner on screen)
		local zStart = if i == 1 then a - Layout.DESCENT_LEN - 16 else a - 10

		-- decor on both sides (centre lane |x| < 18 kept clear)
		local function sidePos(minX, maxX)
			-- authored for a 60-wide half corridor: scaled to the current width (centre lane kept clear)
			minX = math.max(16, minX * K)
			maxX = math.max(minX + 2, maxX * K)
			local sx = if rand:NextNumber() < 0.5 then -1 else 1
			return V3(sx * (minX + rand:NextNumber() * (maxX - minX)), 0, zStart - rand:NextNumber() * (zStart - b - 10))
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
		-- A BEAUTIFUL VIEW: a line of themed trees / plants on top of both corridor walls (seen
		-- against the sky from down in the corridor), flowers and tall grass all along the foot
		-- of the walls, and more flower patches on the floor
		local WH = Layout.PLATEAU_WALL
		local top = { forest = { "tree", "birch", "tree", "bush" }, pine = { "pine", "pine", "rock" }, lake = { "birch", "tree", "reeds" },
			snow = { "snowPine", "snowPine", "snowPile" }, ice = { "snowPine", "ice", "snowPile" }, bamboo = { "bamboo", "bamboo", "pink" },
			river = { "tree", "birch", "bush" }, rocky = { "rock", "pine", "cliff" }, deep = { "dark", "mushroom", "dark" }, beach = { "palm", "palm", "bush" } }
		local list = top[theme] or top.forest
		local function topItem(kind: string, pos: Vector3)
			if kind == "tree" then Props.tree(folder, pos, 0.8 + rand:NextNumber() * 0.5, rand, C(92, 190, 50))
			elseif kind == "birch" then Props.birch(folder, pos, 0.8 + rand:NextNumber() * 0.4, rand)
			elseif kind == "bush" then Props.bush(folder, pos, 0.9, rand)
			elseif kind == "pine" then Props.snowPine(folder, pos, 0.9 + rand:NextNumber() * 0.5, rand, false)
			elseif kind == "snowPine" then Props.snowPine(folder, pos, 0.9 + rand:NextNumber() * 0.5, rand, true)
			elseif kind == "snowPile" then Props.snowPile(folder, pos, 0.9, rand)
			elseif kind == "ice" then Props.iceBlock(folder, pos, 0.9, rand)
			elseif kind == "rock" then Props.rock(folder, pos, 0.9 + rand:NextNumber() * 0.5, rand)
			elseif kind == "cliff" then Props.cliff(folder, pos, 0.8, rand)
			elseif kind == "reeds" then Props.reeds(folder, pos, rand)
			elseif kind == "bamboo" then Props.bamboo(folder, pos, 0.9 + rand:NextNumber() * 0.3, rand)
			elseif kind == "pink" then Props.tree(folder, pos, 0.9, rand, C(250, 170, 200))
			elseif kind == "dark" then Props.tree(folder, pos, 1 + rand:NextNumber() * 0.4, rand, C(36, 100, 40))
			elseif kind == "mushroom" then Props.giantMushroom(folder, pos, 0.8, rand)
			elseif kind == "palm" then Props.palm(folder, pos, 0.9 + rand:NextNumber() * 0.3, rand) end
		end
		for _, sx in { -1, 1 } do
			-- on the wall top (the highest grass step: 4.5 .. 12 behind the face)
			local z = a - 4 - rand:NextNumber() * 6
			while z > b + 4 do
				topItem(list[rand:NextInteger(1, #list)], V3(sx * (H + 2 + 6 + rand:NextNumber() * 5), WH + 3.6, z))
				z -= 18 + rand:NextNumber() * 10 -- airy: a tree every ~20 studs
			end
			-- along the foot of the wall, inside the corridor (sunk with the rest of the floor)
			z = zStart - rand:NextNumber() * 3
			while z > b + 3 do
				local p = V3(sx * (H - 1.5 - rand:NextNumber() * 4), 0, z)
				local roll = rand:NextNumber()
				if theme == "snow" or theme == "ice" then
					if roll < 0.3 then Props.snowPile(folder, p, 0.5 + rand:NextNumber() * 0.4, rand)
					elseif roll < 0.55 then Props.tallGrass(folder, p, rand, C(150, 176, 150)) end
				elseif theme == "beach" then
					if roll < 0.35 then Props.shell(folder, p, rand)
					elseif roll < 0.6 then Props.tallGrass(folder, p, rand, C(170, 190, 90)) end
				elseif theme == "lake" or theme == "river" then
					if roll < 0.3 then Props.reeds(folder, p, rand)
					elseif roll < 0.65 then Props.flower(folder, p, rand)
					else Props.tallGrass(folder, p, rand) end
				else
					if roll < 0.55 then Props.flower(folder, p, rand)
					elseif roll < 0.85 then Props.tallGrass(folder, p, rand, if theme == "deep" then C(50, 130, 50) else nil)
					elseif theme == "forest" or theme == "deep" then Props.mushroom(folder, p, 0.7 + rand:NextNumber() * 0.3) end
				end
				z -= 7 + rand:NextNumber() * 6 -- light touches, not a hedge
			end
		end
		-- flower patches scattered on the floor (centre lane kept clear for the landings)
		if theme ~= "snow" and theme ~= "ice" then
			for _ = 1, 3 do
				local c0 = sidePos(18, 50)
				for _ = 1, 4 do
					Props.flower(folder, c0 + V3((rand:NextNumber() - 0.5) * 4, 0, (rand:NextNumber() - 0.5) * 4), rand)
				end
				Props.tallGrass(folder, c0 + V3(1.5, 0, 1.5), rand)
			end
		end
		if i == Layout.ZONE_COUNT then
			-- the corridor ends on the sea: water + sand bank against the end wall
			local pz = b + 22
			Studs.static(folder, "Shore", V3(Layout.CORRIDOR_HALF * 2, 0.4, 30), CF(0, 0.2, pz), C(246, 226, 170))
			local sea = Studs.static(folder, "Sea", V3(Layout.CORRIDOR_HALF * 2 - 4, 0.5, 18), CF(0, 0.3, b + 10), C(40, 170, 230), { smooth = true })
			sea.Transparency = 0.1
		end
		sinkTrench(folder)
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
