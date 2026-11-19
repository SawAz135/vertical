--[[ BearAIService: server-driven NPC bears (base collection, zone wildlife, the
     bear that answers a thrown fish).
     Movement: unanchored root + AlignPosition (speed capped by MaxVelocity, ramped
     for acceleration) + AlignOrientation (smooth turning). Physics replication gives
     clients interpolated motion; clients animate legs/head from velocity + the
     model's Anim attribute (see AnimalAnimator). The AI ticks at 10 Hz, never per
     frame, and only steers (no pathfinding inside the open bases). ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local PathfindingService = game:GetService("PathfindingService")
local Shared = ReplicatedStorage.Shared
local BearBuilder = require(Shared.Models.BearBuilder)
local BearConfig = require(Shared.Config.BearConfig)
local GameConfig = require(Shared.Config.GameConfig)
local R = require(script.Parent.Parent.Registry)

local BearAI = {}
local agents = {} -- set of agent tables
local rand = Random.new()

local Agent = {}
Agent.__index = Agent

local IDLE_CHOICES = {
	{ anim = "Wander", w = 34 }, { anim = "Look", w = 12 }, { anim = "Sniff", w = 12 },
	{ anim = "Sit", w = 12 }, { anim = "Scratch", w = 7 }, { anim = "Stretch", w = 6 },
	{ anim = "Sleep", w = 7 }, { anim = "Lie", w = 6 }, { anim = "Trot", w = 4 },
	{ anim = "Yawn", w = 5 }, { anim = "Fish", w = 6 }, { anim = "Forage", w = 8 }, { anim = "Roar", w = 3 },
}
local DURATION = {
	Look = { 2, 3.5 }, Sniff = { 1.8, 3 }, Sit = { 5, 9 }, Scratch = { 2.4, 3.2 },
	Stretch = { 2, 2.6 }, Sleep = { 9, 16 }, Lie = { 6, 10 }, Idle = { 1.5, 4 },
	Yawn = { 3.2, 3.4 }, Fish = { 6, 11 }, Forage = { 4, 7 }, Roar = { 2.5, 2.6 },
}

local function setNoCollide(model: Model)
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") then
			d.CanCollide = false
			d.CanTouch = false
			d.Anchored = false
		end
	end
end

--[[ params: species, weight|scale, variant, rarity, cf (ground CFrame), mode
     ("Base" | "Zone" | "Responder" | "Return"), rects (roam rectangles),
     owner (Player), bearId, label (bool) ]]
function BearAI.spawn(params)
	local model = BearBuilder.build(params.species, {
		weight = params.weight, scale = params.scale, variant = params.variant, rarity = params.rarity,
	})
	setNoCollide(model)
	local root = model.PrimaryPart
	local rootY = root.Position.Y -- model built with feet on Y = 0
	local cf = params.cf
	model:PivotTo(CFrame.new(cf.Position.X, cf.Position.Y + rootY, cf.Position.Z) * cf.Rotation)
	model:SetAttribute("Mode", params.mode)
	if params.owner then model:SetAttribute("Owner", params.owner.UserId) end
	if params.bearId then model:SetAttribute("BearId", params.bearId) end

	local att = Instance.new("Attachment")
	att.Name = "DriveAtt"
	att.Parent = root
	local ap = Instance.new("AlignPosition")
	ap.Mode = Enum.PositionAlignmentMode.OneAttachment
	ap.Attachment0 = att
	ap.MaxForce = 1e7
	ap.MaxVelocity = 6
	ap.Responsiveness = 40
	ap.Position = root.Position
	ap.Parent = root
	local ao = Instance.new("AlignOrientation")
	ao.Mode = Enum.OrientationAlignmentMode.OneAttachment
	ao.Attachment0 = att
	ao.MaxTorque = 1e7
	ao.MaxAngularVelocity = 4
	ao.Responsiveness = 9
	ao.CFrame = root.CFrame.Rotation
	ao.Parent = root

	model.Parent = R.MapService.bearsFolder
	pcall(function() root:SetNetworkOwner(nil) end)

	local spec = BearConfig.get(params.species)
	local self = setmetatable({
		model = model, root = root, ap = ap, ao = ao, rootY = rootY,
		mode = params.mode, rects = params.rects, owner = params.owner, bearId = params.bearId,
		species = params.species, scale = model:GetAttribute("Scale"), spec = spec,
		state = "Idle", timer = rand:NextNumber() * 3, target = nil, path = nil,
		speed = 0, maxSpeed = 0, onArrive = nil, lastDist = math.huge, stuck = 0,
		pos = root.Position, alive = true,
	}, Agent)
	agents[self] = true
	return self
end

function Agent:setAnim(name: string)
	self.model:SetAttribute("Anim", name)
	self.model:SetAttribute("AnimT", workspace:GetServerTimeNow())
end

function Agent:ground(p: Vector3): Vector3
	return Vector3.new(p.X, self.rootY, p.Z)
end

function Agent:face(p: Vector3)
	local from = self.root.Position
	local d = Vector3.new(p.X - from.X, 0, p.Z - from.Z)
	if d.Magnitude > 0.05 then
		self.ao.CFrame = CFrame.lookAt(Vector3.zero, d.Unit)
	end
end

-- walk (or run) along waypoints; onArrive(agent) when done
function Agent:moveTo(points: { Vector3 }, speed: number, gaitAnim: string, onArrive)
	self.path = points
	self.heading = nil
	self.maxSpeed = speed * math.max(0.75, self.scale ^ 0.5)
	self.onArrive = onArrive
	self.state = "Move"
	self.stuck = 0
	self.lastDist = math.huge
	self:setAnim(gaitAnim)
end

function Agent:hold()
	self.path = nil
	self.speed = 0
	self.ap.MaxVelocity = 6
	self.ap.Position = self:ground(self.root.Position)
end

function Agent:destroy()
	self.alive = false
	agents[self] = nil
	if self.model then self.model:Destroy() end
end

local function inRect(r, p: Vector3, m: number)
	return p.X >= r.minX + m and p.X <= r.maxX - m and p.Z >= r.minZ + m and p.Z <= r.maxZ - m
end

-- clear straight line at knee height (zone decor) ?
local params = RaycastParams.new()
params.FilterType = Enum.RaycastFilterType.Include
local function clearLine(a: Vector3, b: Vector3): boolean
	local decor = R.MapService.decor
	if not decor then return true end
	params.FilterDescendantsInstances = { decor }
	local from = Vector3.new(a.X, 1.5, a.Z)
	local to = Vector3.new(b.X, 1.5, b.Z)
	return workspace:Raycast(from, to - from, params) == nil
end

function Agent:pickWanderTarget(): Vector3?
	local rects = self.rects
	if not rects or #rects == 0 then return nil end
	local best, bestScore = nil, -math.huge
	local margin = 3 + 2 * self.scale
	local here = self.root.Position
	for _ = 1, 7 do
		local r = rects[rand:NextInteger(1, #rects)]
		local p = Vector3.new(
			r.minX + margin + rand:NextNumber() * math.max(0, r.maxX - r.minX - margin * 2),
			0,
			r.minZ + margin + rand:NextNumber() * math.max(0, r.maxZ - r.minZ - margin * 2)
		)
		local d = (p - Vector3.new(here.X, 0, here.Z)).Magnitude
		if d > 6 and d < 40 then
			-- prefer spots far from other bears of the same group (no stacking)
			local nearest = math.huge
			for other in agents do
				if other ~= self and other.rects == rects then
					local op = other.path and other.path[#other.path] or other.root.Position
					nearest = math.min(nearest, (Vector3.new(op.X, 0, op.Z) - p).Magnitude)
				end
			end
			local score = math.min(nearest, 18) + rand:NextNumber() * 4
			if self.mode == "Zone" and not clearLine(here, p) then score -= 100 end
			if score > bestScore then
				best, bestScore = p, score
			end
		end
	end
	return best
end

-- personality: light bears are playful (trot, look), heavy ones calm, round ones lazy
local function idleWeight(self, c): number
	local spec = self.spec
	local g = spec and spec.gait or 1
	local playful = math.clamp((g - 1) / 0.25, 0, 1)
	local heavy = math.clamp((1.02 - g) / 0.22, 0, 1)
	local lazy = if spec and (spec.traits.panda or spec.body.w / spec.body.l > 0.8) then 1 else 0
	local w = c.w
	if c.anim == "Trot" or c.anim == "Look" then w *= 1 + playful * 1.5 - heavy * 0.4 end
	if c.anim == "Sit" or c.anim == "Lie" or c.anim == "Sleep" or c.anim == "Yawn" then w *= 1 + lazy * 2.5 + heavy * 0.5 - playful * 0.5 end
	if c.anim == "Wander" then w *= 1 + playful * 0.5 - lazy * 0.5 end
	return math.max(0.1, w)
end

function Agent:chooseIdle()
	local total = 0
	for _, c in IDLE_CHOICES do total += idleWeight(self, c) end
	local r = rand:NextNumber() * total
	local pick = "Idle"
	for _, c in IDLE_CHOICES do
		r -= idleWeight(self, c)
		if r <= 0 then pick = c.anim break end
	end
	if pick == "Wander" or pick == "Trot" then
		local t = self:pickWanderTarget()
		if t then
			local run = pick == "Trot"
			self:moveTo({ t }, if run then 13 else 6.5, if run then "Run" else "Walk", function(a)
				a:setAnim("Idle")
				a.state = "Idle"
				a.timer = 1 + rand:NextNumber() * 2
			end)
			return
		end
		pick = "Look"
	end
	local dur = DURATION[pick] or DURATION.Idle
	self:setAnim(pick)
	self.state = "Idle"
	self.timer = dur[1] + rand:NextNumber() * (dur[2] - dur[1])
	-- after lying / sleeping / sitting go back to a neutral idle first
	self.afterIdle = true
end

function Agent:tick(dt: number)
	local pos = self.root.Position
	self.pos = pos
	if self.state == "Move" and self.path then
		local target = self.path[1]
		local flat = Vector3.new(target.X - pos.X, 0, target.Z - pos.Z)
		local dist = flat.Magnitude
		if dist < 0.9 then
			table.remove(self.path, 1)
			if #self.path == 0 then
				self.path = nil
				self.state = "Arrived"
				self.ap.Position = self:ground(Vector3.new(pos.X, 0, pos.Z) + flat)
				-- decelerate smoothly
				self.ap.MaxVelocity = math.max(2, self.speed * 0.5)
				local cb = self.onArrive
				self.onArrive = nil
				if cb then cb(self) end
				return
			end
			target = self.path[1]
		end
		-- NATURAL STEERING (no more robot lines): the bear has a heading that turns toward
		-- the path at a limited rate (slower when running -> it ARCS through turns), it cuts
		-- corners toward the next waypoint, slows down for sharp turns and eases its speed
		local hd = self.heading
		if not hd then
			local lv = self.root.CFrame.LookVector
			hd = Vector3.new(lv.X, 0, lv.Z)
			hd = if hd.Magnitude > 0.05 then hd.Unit else flat.Unit
		end
		local aim = target
		if #self.path >= 2 and dist < 4 + self.speed * 0.35 then
			aim = target:Lerp(self.path[2], 0.5) -- corner cutting
		end
		local want = Vector3.new(aim.X - pos.X, 0, aim.Z - pos.Z)
		want = if want.Magnitude > 0.05 then want.Unit else hd
		local ang = math.atan2(hd:Cross(want).Y, hd:Dot(want)) -- signed turn needed
		local turnRate = 4.2 / (1 + self.speed / 16)
		local stepA = math.clamp(ang, -turnRate * dt, turnRate * dt)
		hd = CFrame.Angles(0, stepA, 0):VectorToWorldSpace(hd)
		self.heading = hd
		-- speed: ease toward the max, slower in sharp turns, soft arrival
		local turnSlow = 1 - 0.6 * math.clamp(math.abs(ang) / 1.6, 0, 1)
		local wantSpeed = self.maxSpeed * turnSlow
		if #self.path == 1 then wantSpeed = math.min(wantSpeed, math.max(2.2, dist * 1.9)) end
		local rate = if wantSpeed > self.speed then self.maxSpeed * 1.3 else self.maxSpeed * 2.6
		self.speed += math.clamp(wantSpeed - self.speed, -rate * dt, rate * dt)
		self.speed = math.max(self.speed, 1.5)
		self.ap.MaxVelocity = self.speed
		if dist < 2.2 or math.abs(ang) > 2.6 and dist < 5 then
			-- very close (or the target is right behind): go straight to it, no orbiting
			self.ap.Position = self:ground(target)
		else
			self.ap.Position = self:ground(pos + hd * math.max(1.5, self.speed * 0.4))
		end
		self.ao.CFrame = CFrame.lookAt(Vector3.zero, hd)
		-- stuck detection
		if dist > self.lastDist - 0.05 * dt * 10 then
			self.stuck += dt
		else
			self.stuck = 0
		end
		self.lastDist = dist
		if self.stuck > 2.5 then
			self.stuck = 0
			if self.mode == "Base" or self.mode == "Zone" then
				self:hold()
				self.state = "Idle"
				self:setAnim("Look")
				self.timer = 1.5
			end
		end
		return
	end
	if self.mode == "Base" or self.mode == "Zone" then
		-- safety: keep roaming bears inside their area
		if self.rects then
			local inside = false
			for _, r in self.rects do
				if inRect(r, pos, -2) then inside = true break end
			end
			if not inside then
				local r = self.rects[1]
				local back = Vector3.new((r.minX + r.maxX) / 2, 0, (r.minZ + r.maxZ) / 2)
				self:moveTo({ back }, 8, "Walk", function(a) a.state = "Idle" a:setAnim("Idle") a.timer = 1 end)
				return
			end
		end
		if self.state == "Idle" or self.state == "Arrived" then
			self.speed = 0
			self.ap.MaxVelocity = 4
			self.timer -= dt
			if self.timer <= 0 then
				if self.afterIdle then
					self.afterIdle = false
					self:setAnim("Idle")
					self.timer = 0.8 + rand:NextNumber() * 1.2
				else
					self:chooseIdle()
				end
			end
		end
	end
end

-- straight line or pathfinding route (zones have decor)
function BearAI.route(from: Vector3, to: Vector3, radius: number): { Vector3 }
	if clearLine(from, to) then
		return { to }
	end
	local path = PathfindingService:CreatePath({ AgentRadius = radius, AgentHeight = 5, AgentCanJump = false, WaypointSpacing = 6 })
	local ok = pcall(function()
		path:ComputeAsync(Vector3.new(from.X, 1, from.Z), Vector3.new(to.X, 1, to.Z))
	end)
	if ok and path.Status == Enum.PathStatus.Success then
		local pts = {}
		for i, wp in path:GetWaypoints() do
			if i > 1 then table.insert(pts, wp.Position) end
		end
		if #pts > 0 then
			pts[#pts] = to
			return pts
		end
	end
	return { to }
end

function BearAI.agents()
	return agents
end

local acc = 0
RunService.Heartbeat:Connect(function(dt)
	acc += dt
	if acc < 0.05 then return end
	local step = acc
	acc = 0
	for a in agents do
		if a.alive and a.model.Parent then
			local ok, err = pcall(a.tick, a, step)
			if not ok then warn("[TFB] bear AI", err) end
		else
			agents[a] = nil
		end
	end
end)

BearAI.Config = GameConfig.Base
return BearAI
