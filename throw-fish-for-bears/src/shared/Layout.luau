--[[ Layout: every world coordinate of the map, shared by server (building, validation)
     and client (hints, arrows, zone ambience). 1 stud ~ 28 cm. Ground top is Y = 0.

     Rear  (+Z): fishing lake with 4 docks
     Middle    : 4 player bases (90 x 90 studs)
     Front     : SELL / SHOP / BIG CATCH + throw area
     Corridor (-Z): 10 zones x 200 studs = 2000 studs, walled, straight. ]]
local Layout = {}

Layout.GROUND_Y = 0
Layout.MAX_PLAYERS = 4

-- Bases -------------------------------------------------------------------
Layout.BASE_SIZE = 90
Layout.BASE_HALF = 45
Layout.BASE_Z = 115
Layout.BASE_CENTERS = {
	Vector3.new(-150, 0, 115),
	Vector3.new(-50, 0, 115),
	Vector3.new(50, 0, 115),
	Vector3.new(150, 0, 115),
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
Layout.SAND = { minX = -210, maxX = 210, minZ = 160, maxZ = 184 }
Layout.LAKE = { minX = -300, maxX = 300, minZ = 184, maxZ = 360 }
Layout.WATER_Y = -1.2
Layout.DOCK_START_Z = 180
Layout.DOCK_END_Z = 238
Layout.DOCK_WIDTH = 14
Layout.DOCK_TOP_Y = 0.8
Layout.FISH_SPOT_RADIUS = 9 -- distance from the dock end where casting is allowed

-- Front area --------------------------------------------------------------
Layout.COMPOUND = { minX = -212, maxX = 212, minZ = -64, maxZ = 184 }
Layout.FRONT = { minX = -205, maxX = 205, minZ = -60, maxZ = 68 }
Layout.THROW_AREA = { minX = -56, maxX = 56, minZ = -58, maxZ = 10 }
Layout.THROW_LINE_Z = -60
Layout.SELL_POS = Vector3.new(-112, 0, 22)
Layout.SHOP_POS = Vector3.new(112, 0, 22)
Layout.TRAIN_RADIUS = 3.6
-- one small white training circle per base, at the outer front corner (outside the fence)
function Layout.trainPos(i: number): Vector3
	local c = Layout.BASE_CENTERS[i]
	local side = if c.X < 0 then -1 else 1
	return Vector3.new(c.X + side * (Layout.BASE_HALF - 6), 0, c.Z - Layout.BASE_HALF - 6)
end

function Layout.isInTraining(i: number, pos: Vector3): boolean
	local t = Layout.trainPos(i)
	return Vector3.new(pos.X - t.X, 0, pos.Z - t.Z).Magnitude <= Layout.TRAIN_RADIUS + 0.6 and pos.Y < 8
end
Layout.SPAWN_POS = Vector3.new(0, 0, 40)

-- Corridor and zones ------------------------------------------------------
Layout.CORRIDOR_HALF = 60
Layout.CORRIDOR_START_Z = -60
Layout.ZONE_LENGTH = 300
Layout.ZONE_COUNT = 1 -- playable slice: 1 zone (Green Forest). Add zones in ZoneConfig + raise this.
Layout.CORRIDOR_END_Z = Layout.CORRIDOR_START_Z - Layout.ZONE_LENGTH * Layout.ZONE_COUNT
Layout.WALL_HEIGHT = 18
Layout.LANDING_HALF = 50 -- landing x is clamped inside this half width

function Layout.zoneRange(i: number): (number, number)
	local zStart = Layout.CORRIDOR_START_Z - Layout.ZONE_LENGTH * (i - 1)
	return zStart, zStart - Layout.ZONE_LENGTH
end

function Layout.zoneCenter(i: number): Vector3
	local a, b = Layout.zoneRange(i)
	return Vector3.new(0, 0, (a + b) / 2)
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
	local h = Layout.BASE_HALF
	return { minX = c.X - h, maxX = c.X + h, minZ = c.Z - h, maxZ = c.Z + h }
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
	if pos.Y < -8 then return false end
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
	for k = 0, 3 do
		local z = a - 25 - k * 50
		table.insert(dens, Vector3.new(-48, 0, z))
		table.insert(dens, Vector3.new(48, 0, z - 25))
	end
	return dens
end

-- rectangles in which ambient bears of a zone roam (both sides, centre path kept clear)
function Layout.zoneRoamRects(i: number)
	local a, b = Layout.zoneRange(i)
	return {
		{ minX = -54, maxX = -22, minZ = b + 14, maxZ = a - 14 },
		{ minX = 22, maxX = 54, minZ = b + 14, maxZ = a - 14 },
	}
end

return Layout
