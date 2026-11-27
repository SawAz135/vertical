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

local Carpet = {}
local S = Potato.S
local LAYER = 0.55
local folder = Instance.new("Folder"); folder.Name = "PotatoCarpet"; folder.Parent = workspace
Carpet.folder = folder

local R = Config.POTATO.Radius.PC
local pool: { BasePart } = {}
local live: { [number]: BasePart } = {} -- key → part
Carpet.keyOf = {} :: { [BasePart]: number }
local cx0, cz0 = math.huge, math.huge
local pending: { number } = {} -- keys to (re)place
local growing: { [BasePart]: number } = {}
local rayParams = RaycastParams.new(); rayParams.FilterType = Enum.RaycastFilterType.Include; rayParams.FilterDescendantsInstances = { workspace.Terrain }

local function newPart(): BasePart
	local p = table.remove(pool)
	if p then return p end
	p = Potato.make(1, 1, 0.5)
	p.Anchored = true; p.CanCollide = false; p.CanTouch = false; p.CastShadow = false
	p.Parent = folder
	return p
end
local function hidePart(p: BasePart)
	p.CFrame = CFrame.new(0, -500, 0)
	Carpet.keyOf[p] = nil
	growing[p] = nil
	table.insert(pool, p)
end

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
	if not p then p = newPart(); live[key] = p; Carpet.keyOf[p] = key end
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
	RunService:BindToRenderStep("WMP_Carpet", Enum.RenderPriority.Camera.Value + 2, function()
		local cam = workspace.CurrentCamera
		rebuild(cam.CFrame.Position)
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
			if m then
				if k >= 1 then m.Scale = Vector3.one; growing[p] = nil
				else local s = 1 + 2.4 * (k - 1) ^ 3 + 1.4 * (k - 1) ^ 2; m.Scale = Vector3.one * math.max(0.05, s) end
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
