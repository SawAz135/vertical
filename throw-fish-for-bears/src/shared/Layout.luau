--[[ Layout: every world coordinate of the map, shared by server (building, validation)
     and client (hints, arrows, zone ambience). 1 stud ~ 28 cm. Ground top is Y = 0.

     Rear  (+Z): fishing lake with 4 docks
     Middle    : 4 player bases (90 x 90 studs)
     Front     : SELL / SHOP + throw area (FISH-UP stations at the base corners)
     Corridor (-Z): 10 zones x 300 studs = 3000 studs, walled, straight. ]]
local Layout = {}

Layout.GROUND_Y = 0
Layout.MAX_PLAYERS = 4

-- Bases: 4 SMALL plots side by side (reference: compact garden plots in a row) ---------
-- narrow plots: 44 studs wide (X) x 64 deep (Z), 4 studs apart
Layout.BASE_SIZE = 64 -- depth (Z)
Layout.BASE_HALF = 32 -- half depth (Z)
Layout.BASE_SIZE_X = 44 -- width (X)
Layout.BASE_HALF_X = 22 -- half width (X)
Layout.BASE_Z = 120
Layout.BASE_CENTERS = {
	Vector3.new(-72, 0, 120),
	Vector3.new(-24, 0, 120),
	Vector3.new(24, 0, 120),
	Vector3.new(72, 0, 120),
}
Layout.BASE_COLORS = {
	Color3.fromRGB(255, 85, 85),
	Color3.fromRGB(70, 160, 255),
	Color3.fromRGB(85, 215, 95),
	Color3.fromRGB(255, 200, 50),
}
Layout.BASE_COLOR_NAMES = { "Red", "Blue", "Green", "Yellow" }
Layout.BASE_GATE_WIDTH = 16 -- openings in the front and rear fences

-- Lake / docks ------------------------------------------------------------
Layout.SAND = { minX = -100, maxX = 100, minZ = 160, maxZ = 184 }
Layout.LAKE = { minX = -102, maxX = 102, minZ = 184, maxZ = 330 }
Layout.WATER_Y = -1.2
Layout.DOCK_START_Z = 180
Layout.DOCK_END_Z = 238
Layout.DOCK_WIDTH = 14
Layout.DOCK_TOP_Y = 0.8
Layout.FISH_SPOT_RADIUS = 9 -- distance from the dock end where casting is allowed

-- Front area --------------------------------------------------------------
-- the spawn plateau (narrower than before; its walls are as high as the corridor's: 20)
Layout.PLATEAU_HALF = 102 -- inner face of the side walls
Layout.PLATEAU_WALL = 20
Layout.COMPOUND = { minX = -102, maxX = 102, minZ = -24, maxZ = 184 }
Layout.FRONT = { minX = -98, maxX = 98, minZ = -20, maxZ = 84 }
-- throw zone: the whole width between the side walls, from the front wall to the throw line
Layout.THROW_AREA = { minX = -62, maxX = 62, minZ = -22, maxZ = 0 } -- rectangle in front of the corridor entrance
Layout.THROW_LINE_Z = -20
-- SELL and SHOP stand in the corners of the corridor entrance, against the front wall (inner face z = -22), facing the bases
Layout.SELL_POS = Vector3.new(-92, 0, -18.5)
Layout.SHOP_POS = Vector3.new(92, 0, -18.5)
Layout.TRAIN_RADIUS = 3.6
-- one FISH-UP training station per base, at the outer front corner (outside the fence)
function Layout.trainPos(i: number): Vector3
	local c = Layout.BASE_CENTERS[i]
	local side = if c.X < 0 then -1 else 1
	return Vector3.new(c.X + side * (Layout.BASE_HALF_X - 7), 0, c.Z - Layout.BASE_HALF - 7.5)
end

function Layout.isInTraining(i: number, pos: Vector3): boolean
	local t = Layout.trainPos(i)
	return Vector3.new(pos.X - t.X, 0, pos.Z - t.Z).Magnitude <= Layout.TRAIN_RADIUS + 0.6 and pos.Y < 8
end
Layout.SPAWN_POS = Vector3.new(0, 0, 40)

-- Corridor and zones ------------------------------------------------------
Layout.CORRIDOR_HALF = 72 -- a bit wider than before (60), still a corridor; the plateau is wider (102)
-- the corridor is a TRENCH: its floor is 20 studs below the plateau (spawn, bases, lake),
-- the front cliff of the plateau is at z = CORRIDOR_START_Z
Layout.CORRIDOR_START_Z = -24
Layout.CORRIDOR_Y = -20
Layout.CORRIDOR_DEPTH = 20
Layout.DESCENT_LEN = 20 -- clear strip at the corridor entrance (no stairs / ramp any more)
Layout.ZONE_LENGTH = 300
Layout.ZONE_COUNT = 10 -- Green Forest -> Tropical Beach (ZoneConfig)
Layout.CORRIDOR_END_Z = Layout.CORRIDOR_START_Z - Layout.ZONE_LENGTH * Layout.ZONE_COUNT
Layout.WALL_HEIGHT = 32
Layout.LANDING_HALF = Layout.CORRIDOR_HALF - 10 -- landing x is clamped inside this half width

function Layout.zoneRange(i: number): (number, number)
	local zStart = Layout.CORRIDOR_START_Z - Layout.ZONE_LENGTH * (i - 1)
	return zStart, zStart - Layout.ZONE_LENGTH
end

function Layout.zoneCenter(i: number): Vector3
	local a, b = Layout.zoneRange(i)
	return Vector3.new(0, Layout.CORRIDOR_Y, (a + b) / 2)
end

-- inside the trench (the corridor floor, below the plateau)?
function Layout.inTrench(pos: Vector3): boolean
	return math.abs(pos.X) <= Layout.CORRIDOR_HALF + 0.5 and pos.Z < Layout.CORRIDOR_START_Z
end

-- height of the walkable ground under a point (plateau 0, trench CORRIDOR_Y)
function Layout.groundY(pos: Vector3): number
	return if Layout.inTrench(pos) then Layout.CORRIDOR_Y else Layout.GROUND_Y
end

-- zone index at a world position (nil when not inside the corridor)
function Layout.zoneAt(pos: Vector3): number?
	if math.abs(pos.X) > Layout.CORRIDOR_HALF + 1 then return nil end
	if pos.Z > Layout.CORRIDOR_START_Z or pos.Z < Layout.CORRIDOR_END_Z then return nil end
	local d = Layout.CORRIDOR_START_Z - pos.Z
	return math.clamp(math.floor(d / Layout.ZONE_LENGTH) + 1, 1, Layout.ZONE_COUNT)
end

local function inRect(r, pos: Vector3, margin: number?): boolean
	local m = margin or 0
	return pos.X >= r.minX + m and pos.X <= r.maxX - m and pos.Z >= r.minZ + m and pos.Z <= r.maxZ - m
end
Layout.inRect = inRect

function Layout.baseRect(i: number)
	local c = Layout.BASE_CENTERS[i]
	local hx, hz = Layout.BASE_HALF_X, Layout.BASE_HALF
	return { minX = c.X - hx, maxX = c.X + hx, minZ = c.Z - hz, maxZ = c.Z + hz }
end

function Layout.isInBase(i: number, pos: Vector3, margin: number?): boolean
	return inRect(Layout.baseRect(i), pos, margin)
end

function Layout.baseAt(pos: Vector3): number?
	for i = 1, #Layout.BASE_CENTERS do
		if Layout.isInBase(i, pos, 0) then return i end
	end
	return nil
end

-- where players appear in their base (just behind the front gate, facing the corridor)
function Layout.baseSpawn(i: number): CFrame
	local c = Layout.BASE_CENTERS[i]
	local p = Vector3.new(c.X, 3, c.Z - Layout.BASE_HALF + 10)
	return CFrame.lookAt(p, p + Vector3.new(0, 0, -1))
end

function Layout.dockEnd(i: number): Vector3
	local c = Layout.BASE_CENTERS[i]
	return Vector3.new(c.X, Layout.DOCK_TOP_Y, Layout.DOCK_END_Z - 3)
end

function Layout.isAtFishingSpot(i: number, pos: Vector3): boolean
	local e = Layout.dockEnd(i)
	local flat = Vector3.new(pos.X - e.X, 0, pos.Z - e.Z)
	return flat.Magnitude <= Layout.FISH_SPOT_RADIUS and pos.Y > Layout.DOCK_TOP_Y - 1 and pos.Y < Layout.DOCK_TOP_Y + 8
end

function Layout.isInThrowArea(pos: Vector3): boolean
	return inRect(Layout.THROW_AREA, pos, 0)
end

-- any position a player-controlled bear may legally stand on (compound or corridor)
function Layout.isWalkable(pos: Vector3): boolean
	if pos.Y < Layout.CORRIDOR_Y - 8 then return false end
	if inRect(Layout.LAKE, pos, 0) and pos.Z > Layout.DOCK_START_Z + 6 then
		return false
	end
	if inRect(Layout.COMPOUND, pos, -2) then return true end
	if math.abs(pos.X) <= Layout.CORRIDOR_HALF + 2 and pos.Z <= Layout.CORRIDOR_START_Z + 4 and pos.Z >= Layout.CORRIDOR_END_Z - 4 then
		return true
	end
	return false
end

-- side "dens" of a zone where responding bears come out of the vegetation
function Layout.zoneDens(i: number): { Vector3 }
	local a = Layout.zoneRange(i)
	local dens = {}
	local first = if i == 1 then Layout.DESCENT_LEN + 12 else 0 -- off the entrance strip
	for k = 0, 5 do
		local z = a - 25 - first - k * 44
		table.insert(dens, Vector3.new(-(Layout.CORRIDOR_HALF - 12), Layout.CORRIDOR_Y, z))
		table.insert(dens, Vector3.new(Layout.CORRIDOR_HALF - 12, Layout.CORRIDOR_Y, z - 22))
	end
	return dens
end

-- rectangles in which ambient bears of a zone roam (both sides, centre path kept clear)
function Layout.zoneRoamRects(i: number)
	local a, b = Layout.zoneRange(i)
	local top = a - 14
	if i == 1 then top = a - Layout.DESCENT_LEN - 10 end -- off the entrance strip
	return {
		{ minX = -(Layout.CORRIDOR_HALF - 6), maxX = -22, minZ = b + 14, maxZ = top },
		{ minX = 22, maxX = Layout.CORRIDOR_HALF - 6, minZ = b + 14, maxZ = top },
	}
end

return Layout
