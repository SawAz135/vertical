--[[ Carpet: the 3D potato desert around the player. Thousands of real potato parts (smooth
     ellipsoids, each one unique: size, tint, tilt, variety) laid cell by cell on the dunes,
     tightly packed so there is no empty space. Cells are world-locked and recycled as you
     walk (pooled parts, BulkMoveTo, a per-frame budget → no hitch). Dug cells sink layer by
     layer into the carved Terrain, empty cells pop back with a bounce when they regrow. ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Config = require(ReplicatedStorage.Shared.Config)
local Potato = require(ReplicatedStorage.Shared.Potato)
local Land = require(ReplicatedStorage.Shared.Land)
local State = require(script.Parent.State)
local PM = require(game:GetService("ReplicatedStorage").Shared.PotatoMesh)

local Carpet = {}
local S = Potato.S
local LAYER = 0.55
local folder = Instance.new("Folder"); folder.Name = "PotatoCarpet"; folder.Parent = workspace
Carpet.folder = folder

local R = Config.POTATO.Radius.PC
local pools: { [number]: { BasePart } } = {} -- per mesh variant
local partVar: { [BasePart]: number } = {}
local live: { [number]: BasePart } = {} -- key → part
Carpet.keyOf = {} :: { [BasePart]: number }
local cx0, cz0 = math.huge, math.huge
local pending: { number } = {} -- keys to (re)place
local growing: { [BasePart]: number } = {}
local rayParams = RaycastParams.new(); rayParams.FilterType = Enum.RaycastFilterType.Include; rayParams.FilterDescendantsInstances = { workspace.Terrain }

-- a potato part of mesh variant v (real sculpted mesh when available, else smooth ellipsoid)
local function newPart(v: number): BasePart
	local pool = pools[v]
	local p = pool and table.remove(pool)
	if p then return p end
	p = PM.make((v - 1) / 8) or Potato.make(1, 1, 0.5)
	p.Anchored = true; p.CanCollide = false; p.CanTouch = false; p.CastShadow = false
	partVar[p] = v
	p.Parent = folder
	return p
end
local function recycle(p: BasePart)
	p.CFrame = CFrame.new(0, -500, 0)
	local v = partVar[p] or 1
	pools[v] = pools[v] or {}
	table.insert(pools[v], p)
end
local function hidePart(p: BasePart)
	Carpet.keyOf[p] = nil
	growing[p] = nil
	recycle(p)
end
local function variantOf(r: number): number return math.floor(r * 7.999) + 1 end

-- surface under a dug area: follow the real (carved) terrain
local function nearDug(ix: number, iz: number): boolean
	for dx = -2, 2 do for dz = -2, 2 do if State.layer[Potato.key(ix + dx, iz + dz)] then return true end end end
	return false
end
local function place(key: number, parts: { BasePart }, cfs: { CFrame })
	local ix, iz = Potato.unkey(key)
	local p = live[key]
	local now = os.clock()
	local hidden = (State.empty[key] or 0) > now or (State.predicted[key] or 0) > now
	if hidden then
		if p then live[key] = nil; hidePart(p) end
		return
	end
	local layer = State.layer[key] or 0
	local x, z, size, variety, r5, r6 = Potato.cell(ix, iz, layer)
	local y = Land.height(x, z) - layer * LAYER
	if layer > 0 or nearDug(ix, iz) then
		local hit = workspace:Raycast(Vector3.new(x, y + 8, z), Vector3.new(0, -24, 0), rayParams)
		if hit then y = math.min(y, hit.Position.Y) end
	end
	local v = variantOf(r5)
	if p and partVar[p] ~= v then live[key] = nil; hidePart(p); p = nil end
	if not p then p = newPart(v); live[key] = p; Carpet.keyOf[p] = key end
	local want = Vector3.new(Config.POTATO.Len * size * (1.05 + r6 * 0.25), 0.78 * size, 0.98 * size)
	if p.Size ~= want then p.Size = want end
	local col = Potato.color(variety, r6)
	if p.Color ~= col then p.Color = col end
	if variety == 6 then p.Material = Enum.Material.Metal; p.Reflectance = 0.15 elseif p.Material ~= Enum.Material.Sand then p.Material = Enum.Material.Sand; p.Reflectance = 0 end
	table.insert(parts, p)
	table.insert(cfs, CFrame.new(x, y + 0.18 * size, z) * CFrame.Angles((r6 - 0.5) * 0.5, r5 * 6.283, (r5 - 0.5) * 0.4))
end

function Carpet.refresh(keys: { number })
	for _, k in keys do table.insert(pending, k) end
end
-- a cell and its neighbourhood (after a dig the surrounding surface changed too)
function Carpet.refreshAround(key: number)
	local ix, iz = Potato.unkey(key)
	for dx = -2, 2 do for dz = -2, 2 do
		local k = Potato.key(ix + dx, iz + dz)
		if live[k] or (dx == 0 and dz == 0) then table.insert(pending, k) end
	end end
end
function Carpet.pop(key: number)
	local p = live[key]; if p then growing[p] = os.clock() end
end
function Carpet.partFor(key: number): BasePart? return live[key] end

function Carpet.setRadius(r: number) R = r; cx0 = math.huge end

-- ---------------------------------------------------------------- far rings: potatoes everywhere
-- beyond the pickable carpet, rings of bigger and sparser potatoes cover every dune up to the
-- horizon (world-locked cells per ring, recycled pools, rebuilt only when you cross a cell)
local RINGS = {
	PC = { { sp = 2.1, k = 2.35, r1 = 80 }, { sp = 4.2, k = 4.7, r1 = 180 }, { sp = 9, k = 10, r1 = 430 }, { sp = 20, k = 22, r1 = 1000 } },
	Mobile = { { sp = 2.1, k = 2.35, r1 = 60 }, { sp = 4.2, k = 4.7, r1 = 130 }, { sp = 9, k = 10, r1 = 300 }, { sp = 24, k = 26, r1 = 900 } },
}
local rings = {}
local function clearZone(x: number, z: number): boolean
	if x * x + z * z < (Config.JAR.R + 2) ^ 2 then return true end
	for _, c in Config.CLEAR do if (x - c[1]) ^ 2 + (z - c[2]) ^ 2 < (c[3] * 0.55) ^ 2 then return true end end
	return false
end
local function buildRings(mobile: boolean)
	local list = if mobile then RINGS.Mobile else RINGS.PC
	local r0 = R - 1
	for i, L in list do
		rings[i] = { sp = L.sp, k = L.k, r0 = r0, r1 = L.r1, live = {}, pool = {}, cx = math.huge, cz = math.huge, todo = {}, salt = i * 101 }
		if L.sp >= 20 then rings[i].mountains = true end
		r0 = L.r1 - L.sp
	end
end
local function ringPart(ring, v: number): BasePart
	local pool = ring.pool[v]
	local p = pool and table.remove(pool)
	if p then return p end
	p = PM.make((v - 1) / 8) or Potato.make(1, 1, 0.5)
	p.Anchored = true; p.CanCollide = false; p.CanTouch = false; p.CanQuery = false; p.CastShadow = false
	partVar[p] = v
	p.Parent = folder
	return p
end
local function ringRebuild(ring, pos: Vector3)
	local sp = ring.sp
	local cx, cz = math.floor(pos.X / sp), math.floor(pos.Z / sp)
	if math.abs(cx - ring.cx) < 2 and math.abs(cz - ring.cz) < 2 then return end
	ring.cx, ring.cz = cx, cz
	local n = math.ceil(ring.r1 / sp)
	local want = {}
	for dx = -n, n do for dz = -n, n do
		local d2 = (dx * sp) ^ 2 + (dz * sp) ^ 2
		if d2 <= ring.r1 * ring.r1 and d2 >= ring.r0 * ring.r0 then want[Potato.key(cx + dx, cz + dz)] = true end
	end end
	for key, p in ring.live do
		if not want[key] then
			ring.live[key] = nil
			if p then p.CFrame = CFrame.new(0, -500, 0); local v = partVar[p] or 1; ring.pool[v] = ring.pool[v] or {}; table.insert(ring.pool[v], p) end
		end
	end
	for key in want do if ring.live[key] == nil then table.insert(ring.todo, key) end end
end
local function ringStep(ring, budget: number, parts, cfs)
	local i = 0
	while #ring.todo > 0 and i < budget do
		i += 1
		local key = table.remove(ring.todo) :: number
		if ring.live[key] ~= nil then continue end
		local ix, iz = Potato.unkey(key)
		local a, b = ix % 65536, iz % 65536
		local r1, r2, r3, r4, r5, r6 = Potato.hash(a, b, ring.salt), Potato.hash(a, b, ring.salt + 1), Potato.hash(a, b, ring.salt + 2), Potato.hash(a, b, ring.salt + 3), Potato.hash(a, b, ring.salt + 4), Potato.hash(a, b, ring.salt + 5)
		local x, z = (ix + 0.5 + (r1 - 0.5) * 0.6) * ring.sp, (iz + 0.5 + (r2 - 0.5) * 0.6) * ring.sp
		if clearZone(x, z) then ring.live[key] = false :: any; continue end
		local size = (0.85 + r3 * 0.35) * ring.k
		local p = ringPart(ring, variantOf(r5))
		ring.live[key] = p
		p.Size = Vector3.new(Config.POTATO.Len * size * (1.05 + r6 * 0.25), 0.78 * size, 0.98 * size)
		p.Color = Potato.color(if r4 < 0.72 then 1 else 2, r6)
		table.insert(parts, p)
		table.insert(cfs, CFrame.new(x, Land.height(x, z) + 0.12 * size, z) * CFrame.Angles((r6 - 0.5) * 0.5, r5 * 6.283, (r5 - 0.5) * 0.4))
	end
end

-- rebuild the set of cells around the camera (only the difference is touched)
local function rebuild(pos: Vector3)
	local cx, cz = Potato.cellOf(pos.X, pos.Z)
	if math.abs(cx - cx0) < 2 and math.abs(cz - cz0) < 2 then return end
	cx0, cz0 = cx, cz
	local n = math.ceil(R / S)
	local want = {}
	for dx = -n, n do
		for dz = -n, n do
			if dx * dx + dz * dz <= n * n then want[Potato.key(cx + dx, cz + dz)] = true end
		end
	end
	for key, p in live do if not want[key] then live[key] = nil; hidePart(p) end end
	-- nearest last in the stack (popped first): the ground under your feet is always complete
	local add = {}
	for key in want do if not live[key] then table.insert(add, key) end end
	table.sort(add, function(a, b)
		local ax, az = Potato.unkey(a); local bx, bz = Potato.unkey(b)
		return (ax - cx) ^ 2 + (az - cz) ^ 2 > (bx - cx) ^ 2 + (bz - cz) ^ 2
	end)
	local merged = add
	for _, k in pending do table.insert(merged, k) end -- urgent refreshes stay on top
	pending = merged
end

function Carpet.start()
	if #PM.templates == 0 then PM.build() end
	buildRings(R < Config.POTATO.Radius.PC)
	RunService:BindToRenderStep("WMP_Carpet", Enum.RenderPriority.Camera.Value + 2, function()
		local cam = workspace.CurrentCamera
		rebuild(cam.CFrame.Position)
		if #rings > 0 then
			local rp, rc = {}, {}
			for _, ring in rings do ringRebuild(ring, cam.CFrame.Position); ringStep(ring, 260, rp, rc) end
			if #rp > 0 then workspace:BulkMoveTo(rp, rc, Enum.BulkMoveMode.FireCFrameChanged) end
		end
		if #pending > 0 then
			local parts, cfs = {}, {}
			local budget = if #pending > 2500 then 900 else 500
			local i = 0
			while #pending > 0 and i < budget do
				i += 1
				place(table.remove(pending) :: number, parts, cfs)
			end
			if #parts > 0 then workspace:BulkMoveTo(parts, cfs, Enum.BulkMoveMode.FireCFrameChanged) end
		end
		-- regrowth pop (scale bounce)
		for p, t0 in growing do
			local k = (os.clock() - t0) / 0.45
			local m = p:FindFirstChildOfClass("SpecialMesh") :: SpecialMesh?
			if k >= 1 then if m then m.Scale = Vector3.one end; growing[p] = nil
			else
				local sc = 1 + 2.4 * (k - 1) ^ 3 + 1.4 * (k - 1) ^ 2
				if m then m.Scale = Vector3.one * math.max(0.05, sc) else growing[p] = nil end
			end
		end
	end)
	-- potatoes coming back: check empty cells regularly
	task.spawn(function()
		while true do
			task.wait(0.15)
			local now = os.clock()
			for key, t in State.empty do
				if t <= now then
					State.empty[key] = nil
					table.insert(pending, key); task.delay(0.05, Carpet.pop, key)
				end
			end
			for key, t in State.predicted do
				if t <= now then State.predicted[key] = nil; table.insert(pending, key) end
			end
		end
	end)
end

-- cells near a point (for the bucket / vacuum), nearest first
function Carpet.cellsNear(p: Vector3, r: number, maxN: number, filter: ((number, Vector3) -> boolean)?): { number }
	local cx, cz = Potato.cellOf(p.X, p.Z)
	local n = math.ceil(r / S)
	local out, now = {}, os.clock()
	for dx = -n, n do for dz = -n, n do
		local k = Potato.key(cx + dx, cz + dz)
		local part = live[k]
		if part and (State.empty[k] or 0) <= now and (State.predicted[k] or 0) <= now then
			local d = (part.Position - p).Magnitude
			if d <= r and (not filter or filter(k, part.Position)) then table.insert(out, { k, d }) end
		end
	end end
	table.sort(out, function(a, b) return a[2] < b[2] end)
	local res = {}
	for i = 1, math.min(maxN, #out) do res[i] = out[i][1] end
	return res
end

return Carpet
