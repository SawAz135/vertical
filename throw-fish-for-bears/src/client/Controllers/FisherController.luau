--[[ FisherController: brings the hired fishermen to life (client side, every player sees
     them, zero network cost). The server publishes each fisherman's phase (Phase, PhaseT,
     PhaseDur + the fish he carries); this animates it, keyframed like a real animation:
       Cast     : rod drawn back over the shoulder, body coiled... WHIP, the bobber flies
                  out in an arc and plops into the water
       Wait     : breathing, rod tip bobbing, bobber floating; little idle acts: yawn,
                  look around, scratch the beard, pipe puffs, foot tapping
       Reel     : the bobber is yanked under -> startled jolt -> a real fight: leaning back,
                  cranking, the rod jerking, the fish thrashing closer with splashes
       Catch    : one big heave, the fish flies out of the water into his hand
       Unhook   : he KNEELS on the dock, pins the thrashing fish and works the hook out
                  (pop!), then stands up with the fish held in both hands
       ToBucket : walks to the bucket on the beach carrying it (it still wriggles)
       Full     : bucket full: waits next to it, foot tapping, head shaking
       Drop     : leans over the bucket and drops it in: the fish lands ELASTIC (squash /
                  stretch bounce, jelly wobble), splash, then he dusts his hands off
       Back     : walks back to his spot
     Also: the bucket's live counter billboard + fish tails sticking out, the "hire me"
     silhouettes' sign, and the collect / hire / upgrade effects. ]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local Easing = require(Shared.Util.Easing)
local Format = require(Shared.Util.Format)
local F = require(Shared.Config.FisherConfig)
local Layout = require(Shared.Layout)
local FishBuilder = require(Shared.Models.FishBuilder)
local Fx = require(script.Parent.Fx)
local Sound = require(script.Parent.Sound)
local Clock = require(script.Parent.Clock)

local FisherController = {}
local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local fishers = {} -- [model] = entry
local ghosts = {} -- [model] = entry
local buckets = {} -- [model] = entry
local HUD = nil

local sin, cos, clamp, abs = math.sin, math.cos, math.clamp, math.abs
local V3, CF = Vector3.new, CFrame.new
local JOINTS = { "Waist", "Neck", "ShoulderL", "ShoulderR", "HipL", "HipR" }
local HIP_H = 2 -- root height above the feet

local function kf(t: number, keys)
	if t <= keys[1][1] then return keys[1][2] end
	for i = 2, #keys do
		local k1, k0 = keys[i], keys[i - 1]
		if t <= k1[1] then
			local u = (t - k0[1]) / math.max(1e-4, k1[1] - k0[1])
			u = (k1[3] or Easing.sineInOut)(u)
			return k0[2] + (k1[2] - k0[2]) * u
		end
	end
	return keys[#keys][2]
end

local function newPose()
	local p = {}
	for _, j in JOINTS do p[j] = V3() end
	p.Drop = 0 -- root height offset (kneeling)
	p.Pitch = 0
	return p
end

-- a held / flying fish model (sized to fit in the hands)
local function makeFish(id: string, w: number?, v: string?): Model?
	local ok, m = pcall(FishBuilder.build, id, { weight = w, variant = v })
	if not ok or not m or not m.PrimaryPart then return nil end
	for _, d in m:GetDescendants() do
		if d:IsA("BasePart") then
			d.Anchored = false
			d.CanCollide = false
			d.CanQuery = false
			d.CanTouch = false
		end
	end
	m.PrimaryPart.Anchored = true
	local size = m:GetExtentsSize()
	local big = math.max(size.X, size.Y, size.Z)
	if big > 2.4 then pcall(function() m:ScaleTo(2.4 / big) end) end
	m:SetAttribute("BaseScale", m:GetScale())
	m:SetAttribute("Anim", "Held")
	m.Parent = Fx.folder
	return m
end

local function makeBobber(): Model
	local m = Instance.new("Model")
	m.Name = "FisherBobber"
	local top = Instance.new("Part")
	top.Shape = Enum.PartType.Ball
	top.Size = V3(0.5, 0.5, 0.5)
	top.Color = Color3.fromRGB(230, 40, 40)
	top.Anchored = true
	top.CanCollide = false
	top.CanQuery = false
	top.Parent = m
	local bot = top:Clone()
	bot.Color = Color3.fromRGB(250, 250, 250)
	bot.Size = V3(0.46, 0.46, 0.46)
	bot.Parent = m
	local att = Instance.new("Attachment")
	att.Name = "Line"
	att.Position = V3(0, 0.22, 0)
	att.Parent = top
	m.PrimaryPart = top
	m:SetAttribute("Bot", true)
	m.Parent = Fx.folder
	return m
end

local function makeLine(a0: Attachment, a1: Attachment): Beam
	local b = Instance.new("Beam")
	b.Attachment0 = a0
	b.Attachment1 = a1
	b.Width0 = 0.04
	b.Width1 = 0.04
	b.Color = ColorSequence.new(Color3.fromRGB(235, 235, 235))
	b.LightEmission = 0
	b.Transparency = NumberSequence.new(0.15)
	b.FaceCamera = true
	b.CurveSize0 = 0
	b.CurveSize1 = 0
	b.Segments = 12
	b.Parent = a0.Parent
	return b
end

-- registration ------------------------------------------------------------------------
local function registerFisher(m: Model)
	if fishers[m] or not m.PrimaryPart then return end
	local motors = {}
	for _, d in m:GetDescendants() do
		if d:IsA("Motor6D") then motors[d.Name] = d end
	end
	local base, slot = m:GetAttribute("Base"), m:GetAttribute("Slot")
	if not base or not slot then return end
	local path = F.path(base, slot)
	local lens, total = { 0 }, 0
	for i = 2, #path do
		total += (path[i] - path[i - 1]).Magnitude
		lens[i] = total
	end
	local e = {
		model = m, root = m.PrimaryPart, motors = motors, base = base, slot = slot,
		path = path, lens = lens, total = total, cur = newPose(), yaw = nil,
		tipAtt = m:FindFirstChild("RodTip", true), pipe = m:FindFirstChild("PipeSmoke", true),
		seed = (m:GetAttribute("Seed") or 1) % 1000, lastPhase = nil, splashT = 0, idleT = 0,
	}
	fishers[m] = e
	m.Destroying:Connect(function()
		fishers[m] = nil
		if e.bobber then e.bobber:Destroy() end
		if e.fish then e.fish:Destroy() end
	end)
end

local function textLabel(parent: Instance, text: string, size: UDim2, pos: UDim2, color: Color3, stroke: number)
	local t = Instance.new("TextLabel")
	t.BackgroundTransparency = 1
	t.Size = size
	t.Position = pos
	t.AnchorPoint = Vector2.new(0.5, 0.5)
	t.Font = Enum.Font.FredokaOne
	t.TextScaled = true
	t.Text = text
	t.TextColor3 = color
	local st = Instance.new("UIStroke")
	st.Thickness = stroke
	st.Color = Color3.new(0, 0, 0)
	st.LineJoinMode = Enum.LineJoinMode.Round
	st.Parent = t
	t.Parent = parent
	return t
end

local function registerGhost(m: Model)
	if ghosts[m] or not m.PrimaryPart then return end
	local mine = m:GetAttribute("Owner") == player.UserId
	local e = { model = m, root = m.PrimaryPart, motors = {}, cur = newPose(), t0 = os.clock() }
	for _, d in m:GetDescendants() do
		if d:IsA("Motor6D") then e.motors[d.Name] = d end
	end
	ghosts[m] = e
	if mine then
		-- floating sign over the silhouette: HIRE FISHERMAN + price (text only, outlined)
		local bb = Instance.new("BillboardGui")
		bb.Name = "HireSign"
		bb.Size = UDim2.fromOffset(240, 90)
		bb.StudsOffsetWorldSpace = V3(0, 7.6, 0)
		bb.AlwaysOnTop = false
		bb.MaxDistance = 90
		bb.Adornee = m.PrimaryPart
		bb.Parent = m
		textLabel(bb, "HIRE FISHERMAN", UDim2.fromScale(1, 0.4), UDim2.fromScale(0.5, 0.25), Color3.fromRGB(255, 236, 120), 3)
		textLabel(bb, Format.money(m:GetAttribute("Price") or 0), UDim2.fromScale(0.8, 0.45), UDim2.fromScale(0.5, 0.72), Color3.fromRGB(124, 255, 70), 3)
		e.sign = bb
	end
	m.Destroying:Connect(function() ghosts[m] = nil end)
end

local function registerBucket(m: Model)
	if buckets[m] then return end
	local anchor = m:FindFirstChild("Anchor") :: BasePart?
	if not anchor then return end
	local e = { model = m, anchor = anchor, tails = {}, shownCount = -1, mine = m:GetAttribute("Owner") == player.UserId }
	buckets[m] = e
	local bb = Instance.new("BillboardGui")
	bb.Name = "BucketSign"
	bb.Size = UDim2.fromOffset(200, 80)
	bb.StudsOffsetWorldSpace = V3(0, 2.2, 0)
	bb.MaxDistance = 80
	bb.Adornee = anchor
	bb.Parent = m
	e.count = textLabel(bb, "", UDim2.fromScale(1, 0.62), UDim2.fromScale(0.5, 0.36), Color3.new(1, 1, 1), 3.5)
	e.sub = textLabel(bb, "", UDim2.fromScale(0.9, 0.3), UDim2.fromScale(0.5, 0.82), Color3.fromRGB(255, 220, 120), 2.5)
	local sc = Instance.new("UIScale")
	sc.Parent = e.count
	e.countScale = sc
	m.Destroying:Connect(function()
		buckets[m] = nil
		for _, t in e.tails do t:Destroy() end
	end)
end

local function register(d: Instance)
	if not d:IsA("Model") then return end
	if d:GetAttribute("Fisher") then
		task.defer(registerFisher, d)
	elseif d:GetAttribute("GhostSlot") then
		task.defer(registerGhost, d)
	elseif d:GetAttribute("FishBucket") then
		task.defer(registerBucket, d)
	end
end

-- movement along the path ----------------------------------------------------------------
local function pathAt(e, s: number): (Vector3, Vector3)
	s = clamp(s, 0, e.total)
	for i = 2, #e.path do
		if s <= e.lens[i] + 1e-4 then
			local a, b = e.path[i - 1], e.path[i]
			local seg = e.lens[i] - e.lens[i - 1]
			local u = if seg > 0 then (s - e.lens[i - 1]) / seg else 0
			local dir = Vector3.new(b.X - a.X, 0, b.Z - a.Z)
			return a:Lerp(b, u), if dir.Magnitude > 0.01 then dir.Unit else V3(0, 0, 1)
		end
	end
	local n = #e.path
	return e.path[n], V3(0, 0, 1)
end

-- POSES ------------------------------------------------------------------------------------
-- rod "ready" stance (right arm forward-up holding the rod, left hand on the reel)
local function rodStance(p, t: number)
	local br = sin(t * 1.8)
	p.ShoulderR = V3(0.95 + br * 0.03, 0, -0.08)
	p.ShoulderL = V3(0.85, -0.45, 0.12)
	p.Waist = V3(0.04 + br * 0.015, 0, 0)
	p.Neck = V3(-0.12, 0, 0)
	p.HipL = V3(0.12, 0, 0)
	p.HipR = V3(-0.08, 0, 0)
end

local function walkPose(p, t: number, speed: number, carrying: boolean)
	local f = speed * 1.1
	local ph = t * f
	local sw = sin(ph)
	p.HipL = V3(sw * 0.6, 0, 0)
	p.HipR = V3(-sw * 0.6, 0, 0)
	p.Waist = V3(-0.05, sin(ph) * 0.08, 0)
	p.Neck = V3(0.02, -sin(ph) * 0.05, 0)
	p.Drop = -abs(cos(ph)) * 0.12 + 0.04
	if carrying then
		-- both arms forward, the fish held in front at chest height
		p.ShoulderL = V3(1.15 + sw * 0.04, 0.35, 0)
		p.ShoulderR = V3(1.15 - sw * 0.04, -0.35, 0)
	else
		p.ShoulderL = V3(-sw * 0.5, 0, 0.05)
		p.ShoulderR = V3(0.45 + sw * 0.25, 0, -0.05) -- rod carried pointing forward
	end
end

local P = {}

function P.Cast(e, p, u, d, t)
	rodStance(p, t)
	local x = u
	p.ShoulderR = V3(kf(x, { { 0, 0.95 }, { 0.45, 3.0, Easing.cubicOut }, { 0.55, 3.1 }, { 0.72, 0.55, Easing.expoOut }, { 1.1, 0.8 }, { 1.4, 0.95 } }), 0,
		kf(x, { { 0, -0.08 }, { 0.45, 0.25 }, { 0.72, -0.1 }, { 1.4, -0.08 } }))
	p.ShoulderL = V3(kf(x, { { 0, 0.85 }, { 0.45, 1.6 }, { 0.72, 0.6, Easing.expoOut }, { 1.4, 0.85 } }), -0.45, 0.12)
	p.Waist = V3(kf(x, { { 0, 0.04 }, { 0.45, 0.25, Easing.cubicOut }, { 0.68, -0.25, Easing.expoOut }, { 1.0, -0.08 }, { 1.4, 0.04 } }),
		kf(x, { { 0, 0 }, { 0.45, 0.45, Easing.cubicOut }, { 0.68, -0.35, Easing.expoOut }, { 1.4, 0 } }), 0)
	p.Neck = V3(kf(x, { { 0, -0.12 }, { 0.45, 0.25 }, { 0.75, -0.2 }, { 1.4, -0.12 } }), 0, 0)
	p.HipL = V3(kf(x, { { 0, 0.12 }, { 0.45, 0.05 }, { 0.7, 0.45 }, { 1.4, 0.12 } }), 0, 0)
	p.HipR = V3(kf(x, { { 0, -0.08 }, { 0.45, 0.3 }, { 0.7, -0.35 }, { 1.4, -0.08 } }), 0, 0)
	p.Drop = kf(x, { { 0, 0 }, { 0.45, -0.2 }, { 0.7, -0.1 }, { 1.4, 0 } })
end

function P.Wait(e, p, u, d, t)
	rodStance(p, t)
	-- little idle acts every few seconds (deterministic per fisherman)
	local cyc = (t + e.seed) % 7
	if cyc < 1.4 then
		-- look around (left, right)
		p.Neck += V3(0.05, sin(cyc / 1.4 * math.pi * 2) * 0.7, 0)
	elseif cyc > 2.5 and cyc < 3.7 then
		-- scratch the beard with the left hand
		local k = Easing.bump((cyc - 2.5) / 1.2)
		p.ShoulderL = V3(0.85 + 1.4 * k, -0.45 - 0.2 * k, 0.12)
		p.Neck += V3(0.15 * k + sin(t * 14) * 0.04 * k, 0, 0)
	elseif cyc > 4.6 and cyc < 5.8 then
		-- big yawn: head back, left arm stretch
		local k = Easing.bump((cyc - 4.6) / 1.2)
		p.Neck += V3(0.5 * k, 0, 0)
		p.Waist += V3(0.15 * k, 0, 0)
		p.ShoulderL = V3(0.85 + 2.2 * k, -0.45, 0.12 + 0.5 * k)
	elseif cyc > 6.2 then
		-- foot tapping
		p.HipR += V3(abs(sin(t * 9)) * 0.18, 0, 0)
	end
end

function P.Reel(e, p, u, d, t)
	rodStance(p, t)
	-- BITE: startled jolt
	local jolt = Easing.bump(clamp(u / 0.35, 0, 1))
	-- FIGHT: leaning back, cranking, the rod jerking with the fish
	local f = clamp((u - 0.25) / 0.3, 0, 1)
	local pull = sin(t * 7.3) * 0.22 + sin(t * 3.1) * 0.12
	local crank = t * 15
	p.ShoulderR = V3(0.95 + 0.9 * jolt + f * (0.45 + pull), 0, -0.08)
	p.ShoulderL = V3(0.85 + f * (0.2 + sin(crank) * 0.28), -0.45, 0.12 + f * cos(crank) * 0.22)
	p.Waist = V3(0.04 + 0.3 * jolt + f * (0.28 + pull * 0.4), f * pull * 0.3, f * pull * 0.08)
	p.Neck = V3(-0.12 + 0.2 * jolt - f * 0.15, 0, 0)
	p.HipL = V3(0.12 + f * 0.4, 0, 0)
	p.HipR = V3(-0.08 - f * 0.3, 0, 0)
	p.Drop = -0.25 * f
end

function P.Catch(e, p, u, d, t)
	rodStance(p, t)
	-- one huge heave, then the left hand grabs the fish
	local heave = Easing.backOut(clamp(u / 0.35, 0, 1))
	local grab = Easing.cubicOut(clamp((u - 0.55) / 0.3, 0, 1))
	p.ShoulderR = V3(0.95 + 1.8 * heave * (1 - grab * 0.6), 0, -0.08)
	p.ShoulderL = V3(0.85 + 0.9 * grab, -0.2, 0.12)
	p.Waist = V3(0.04 + 0.45 * heave * (1 - grab), 0, 0)
	p.Neck = V3(-0.12 + 0.45 * heave * (1 - grab) - 0.2 * grab, 0, 0)
	p.HipL = V3(0.3 * (1 - grab), 0, 0)
	p.HipR = V3(-0.3 * (1 - grab), 0, 0)
end

function P.Unhook(e, p, u, d, t)
	-- KNEEL on the dock, pin the fish, work the hook out... POP, stand up with it
	local down = Easing.cubicOut(clamp(u / 0.4, 0, 1))
	local up = Easing.cubicInOut(clamp((u - 1.55) / 0.45, 0, 1))
	local kneel = down * (1 - up)
	local pop = Easing.bump(clamp((u - 1.25) / 0.25, 0, 1))
	local work = if u > 0.45 and u < 1.25 then sin(t * 22) * 0.12 else 0
	p.Drop = -1.05 * kneel
	p.HipL = V3(1.35 * kneel, 0, -0.05 * kneel)
	p.HipR = V3(-1.25 * kneel, 0, 0.05 * kneel)
	p.Waist = V3(-0.45 * kneel, 0, 0)
	p.Neck = V3(-0.55 * kneel + 0.25 * pop, 0, 0)
	-- left hand pins the fish on the planks, right hand twists the hook out
	p.ShoulderL = V3(0.7 * kneel + 1.1 * up, 0.2 * kneel + 0.35 * up, 0.05)
	p.ShoulderR = V3(0.95 * (1 - kneel) + (0.55 + work + 0.8 * pop) * kneel + 1.1 * up, -0.3 * kneel - 0.35 * up, -0.08)
end

function P.ToBucket(e, p, u, d, t)
	walkPose(p, t, e.total / math.max(0.5, d), true)
end

function P.Back(e, p, u, d, t)
	walkPose(p, t, e.total / math.max(0.5, d), false)
end

function P.Full(e, p, u, d, t)
	-- impatient: holding the fish, foot tapping, head shaking
	p.ShoulderL = V3(1.15, 0.35, 0)
	p.ShoulderR = V3(1.15, -0.35, 0)
	p.HipR = V3(abs(sin(t * 8)) * 0.22, 0, 0)
	p.Neck = V3(-0.1, sin(t * 3) * 0.35, 0)
	p.Waist = V3(0.05 + sin(t * 1.5) * 0.03, 0, 0)
end

function P.Drop(e, p, u, d, t)
	-- lean over the bucket, drop the fish in, then dust the hands off
	local lean = Easing.cubicOut(clamp(u / 0.4, 0, 1)) * (1 - Easing.cubicInOut(clamp((u - 0.75) / 0.4, 0, 1)))
	local clap = if u > 0.8 then abs(sin(t * 18)) * Easing.bump(clamp((u - 0.8) / 0.45, 0, 1)) else 0
	p.Waist = V3(-0.4 * lean, 0, 0)
	p.Neck = V3(-0.35 * lean, 0, 0)
	p.ShoulderL = V3(1.15 + 0.4 * lean + 0.5 * clap, 0.35 - 0.2 * clap, 0)
	p.ShoulderR = V3(1.15 + 0.4 * lean + 0.5 * clap, -0.35 + 0.2 * clap, 0)
	p.Drop = -0.15 * lean
end

-- ONE FISHERMAN, PER FRAME --------------------------------------------------------------------
local function setFishLocal(e, on: boolean)
	local m = e.model
	if on and not e.fish then
		local id = m:GetAttribute("CarryFish")
		if id then
			e.fish = makeFish(id, m:GetAttribute("CarryW"), m:GetAttribute("CarryV"))
		end
	elseif not on and e.fish then
		e.fish:Destroy()
		e.fish = nil
	end
end

local function updateFisher(e, dt: number, now: number)
	local m = e.model
	local phase = m:GetAttribute("Phase") or "Wait"
	local pt = m:GetAttribute("PhaseT") or now
	local d = math.max(0.05, m:GetAttribute("PhaseDur") or 1)
	local u = clamp(now - pt, 0, d + 5)
	local t = os.clock() + e.seed
	local entering = phase ~= e.lastPhase
	if entering then
		e.lastPhase = phase
		e.phaseClock = os.clock()
	end
	local near = (e.root.Position - camera.CFrame.Position).Magnitude < 70

	-- where he stands / walks
	local feet, face
	local spotCF = F.spotCF(e.base, e.slot)
	if phase == "ToBucket" then
		local s = e.total * Easing.sineInOut(clamp(u / d, 0, 1))
		feet, face = pathAt(e, s)
	elseif phase == "Back" then
		local s = e.total * (1 - Easing.sineInOut(clamp(u / d, 0, 1)))
		local dir
		feet, dir = pathAt(e, s)
		face = -dir
	elseif phase == "Full" or phase == "Drop" then
		feet = F.bucketStand(e.base, e.slot)
		local b = F.bucketPos(e.base)
		local v = Vector3.new(b.X - feet.X, 0, b.Z - feet.Z)
		face = if v.Magnitude > 0.01 then v.Unit else V3(0, 0, 1)
	else
		feet = spotCF.Position
		face = spotCF.LookVector
	end
	local yaw = math.atan2(-face.X, -face.Z)
	if not e.yaw then e.yaw = yaw end
	local dy = (yaw - e.yaw + math.pi) % (math.pi * 2) - math.pi
	e.yaw += dy * Easing.damp(10, dt)

	-- pose
	local p = newPose()
	local fn = P[phase]
	if fn then fn(e, p, u, d, t) else rodStance(p, t) end
	local k = Easing.damp(14, dt)
	local c = e.cur
	for _, j in JOINTS do c[j] = c[j]:Lerp(p[j], k) end
	c.Drop += (p.Drop - c.Drop) * k
	local rootCF = CF(feet + V3(0, HIP_H + c.Drop, 0)) * CFrame.Angles(0, e.yaw, 0)
	e.root.CFrame = rootCF
	if near then
		for _, j in JOINTS do
			local mt = e.motors[j]
			if mt then
				local v = c[j]
				-- shoulders / hips: X = swing forward; the left side mirrors Y / Z
				if j == "ShoulderL" or j == "HipL" then
					mt.Transform = CFrame.Angles(v.X, -v.Y, -v.Z)
				else
					mt.Transform = CFrame.Angles(v.X, v.Y, v.Z)
				end
			end
		end
	end

	-- the bobber and the line --------------------------------------------------------------
	local seed = m:GetAttribute("Seed") or 1
	local target = F.bobber(e.base, e.slot, seed)
	local lineOn = (phase == "Cast" and u > 0.62) or phase == "Wait" or phase == "Reel"
	if lineOn and near and e.tipAtt then
		if not e.bobber then
			e.bobber = makeBobber()
			e.line = makeLine(e.tipAtt, e.bobber.PrimaryPart:FindFirstChild("Line"))
		end
		local bp
		if phase == "Cast" then
			-- flies out in an arc from the rod tip, plop
			local k2 = clamp((u - 0.62) / 0.6, 0, 1)
			local from = e.tipAtt.WorldPosition
			bp = from:Lerp(target, k2) + V3(0, sin(k2 * math.pi) * 3.5, 0)
			if k2 >= 1 and not e.plopped then
				e.plopped = true
				if near then
					Fx.splash(target, 0.5)
					Sound.play("Splash", { at = target, volume = 0.5, pitch = 1.3 })
				end
			end
		elseif phase == "Wait" then
			e.plopped = false
			bp = target + V3(0, sin(t * 2.4) * 0.06, 0)
		else
			-- the fish pulls the bobber under and fights its way to the dock
			local k2 = clamp(u / d, 0, 1)
			local edge = feet + face * 1.5 + V3(0, -feet.Y + Layout.WATER_Y, 0)
			bp = target:Lerp(edge, Easing.sineIn(k2)) + V3(sin(t * 11) * 0.5, -0.35 - abs(sin(t * 7)) * 0.2, cos(t * 9) * 0.4)
			e.splashT -= dt
			if e.splashT <= 0 then
				e.splashT = 0.22
				Fx.blocks(bp + V3(0, 0.3, 0), Color3.fromRGB(150, 210, 255), 4, 9, 0.18, { life = 0.5, up = 2.2, spread = 1.2, gravity = 45 })
				if entering or math.random() < 0.3 then Sound.play("Splash", { at = bp, volume = 0.35, pitch = 1.5 }) end
			end
		end
		e.bobber:PivotTo(CF(bp))
		e.bobber.PrimaryPart.LocalTransparencyModifier = 0
	elseif e.bobber then
		e.bobber:Destroy()
		e.bobber = nil
		e.line = nil
	end

	-- the fish ----------------------------------------------------------------------------------
	local carryPhase = phase == "Catch" or phase == "Unhook" or phase == "ToBucket" or phase == "Full" or phase == "Drop"
	if near then setFishLocal(e, carryPhase and (phase ~= "Drop" or u < d)) end
	if e.fish and e.fish.PrimaryPart then
		local f = e.fish
		local hands = rootCF * CF(0, 0.45, -1.25) -- in front of the chest (both hands)
		local fcf
		if phase == "Catch" then
			-- flies out of the water into his hand
			local k2 = Easing.cubicOut(clamp(u / 0.6, 0, 1))
			local water = feet + face * 2.2 + V3(0, -feet.Y + Layout.WATER_Y, 0)
			local pos = water:Lerp(hands.Position, k2) + V3(0, sin(k2 * math.pi) * 2.5, 0)
			fcf = CF(pos) * CFrame.Angles(t * 6, t * 4, 0)
			f:SetAttribute("Anim", "Flop")
			if entering then
				Fx.splash(water, 0.7)
				Sound.play("Splash", { at = water, volume = 0.6 })
			end
		elseif phase == "Unhook" then
			-- on the planks in front of his knees, thrashing; lifted at the end
			local up = Easing.cubicInOut(clamp((u - 1.55) / 0.45, 0, 1))
			local low = rootCF * CF(0, -HIP_H - c.Drop + Layout.DOCK_TOP_Y - feet.Y + 0.35, -1.5)
			fcf = low:Lerp(hands, up) * CFrame.Angles(0, math.pi / 2, (1 - up) * math.pi / 2)
			f:SetAttribute("Anim", if up < 0.5 then "Flop" else "Held")
			if u > 1.25 and not e.popped then
				e.popped = true
				Sound.play("Snap", { at = fcf.Position, volume = 0.4, pitch = 1.8 })
				Fx.blocks(fcf.Position + V3(0, 0.3, 0), Color3.fromRGB(200, 200, 210), 2, 6, 0.12, { life = 0.5, up = 2, gravity = 40 })
			end
		elseif phase == "Drop" then
			e.popped = false
			local rel = d * 0.55
			local b = F.bucketPos(e.base)
			local bm = e.bucketModel
			local top = if bm then (bm:GetAttribute("Top") or 2) else 2
			if u < rel then
				fcf = hands * CFrame.Angles(0, math.pi / 2, 0)
			else
				-- falls in... and lands ELASTIC: squash / stretch bounce + jelly wobble
				local k2 = clamp((u - rel) / 0.28, 0, 1)
				local into = b + V3(0, top - 0.2, 0)
				local pos = hands.Position:Lerp(into, Easing.quadIn(k2))
				local land = u - rel - 0.28
				local wob = 0
				if land > 0 then
					wob = math.exp(-5 * land) * sin(land * 26)
					if not e.landed then
						e.landed = true
						Fx.splash(into, 0.45)
						Sound.play("Flop", { at = into, volume = 0.8, pitch = 0.9 })
					end
				end
				local s0 = f:GetAttribute("BaseScale") or 1
				pcall(function() f:ScaleTo(s0 * (1 + 0.35 * wob)) end)
				fcf = CF(pos) * CFrame.Angles(wob * 0.6, math.pi / 2 + wob * 0.4, math.pi / 2 * k2 + wob * 0.5)
				f:SetAttribute("Anim", "Flop")
			end
		else
			e.landed = false
			fcf = hands * CFrame.Angles(0, math.pi / 2, 0)
			f:SetAttribute("Anim", "Held")
		end
		f:PivotTo(fcf)
	end
	if phase ~= "Drop" then e.landed = false end

	-- pipe smoke (old salts)
	if e.pipe and near and (phase == "Wait" or phase == "Reel") then
		e.idleT -= dt
		if e.idleT <= 0 then
			e.idleT = 1.6 + math.random()
			Fx.puff(e.pipe.WorldPosition, Color3.fromRGB(235, 235, 240), 3, 0.35)
		end
	end
end


-- BUCKET -------------------------------------------------------------------------------------------
local function updateBucket(e, dt: number)
	local m = e.model
	local n = m:GetAttribute("Count") or 0
	local cap = m:GetAttribute("Cap") or 10
	local full = n >= cap
	e.count.Text = ("🐟 %d / %d"):format(n, cap)
	e.sub.Text = if full then "FULL!  COLLECT" elseif n > 0 then "COLLECT" else ""
	e.count.TextColor3 = if full then Color3.fromRGB(255, 80, 80) else Color3.new(1, 1, 1)
	e.countScale.Scale = if full then 1 + abs(sin(os.clock() * 5)) * 0.12 else 1
	if n ~= e.shownCount then
		if e.shownCount >= 0 and n > e.shownCount then
			e.countScale.Scale = 1.3
		end
		e.shownCount = n
		-- fish tails sticking out of the bucket (more as it fills)
		for _, t in e.tails do t:Destroy() end
		e.tails = {}
		local want = if n <= 0 then 0 else math.clamp(math.ceil(5 * n / cap), 1, 5)
		local inner = m:GetAttribute("Inner") or 1
		local top = m:GetAttribute("Top") or 2
		local pivot = m:GetPivot()
		for i = 1, want do
			local tail = Instance.new("Part")
			tail.Size = V3(0.12, 0.7, 0.5)
			tail.Color = ({ Color3.fromRGB(120, 170, 220), Color3.fromRGB(240, 150, 60), Color3.fromRGB(160, 200, 110), Color3.fromRGB(230, 90, 90), Color3.fromRGB(200, 200, 210) })[i]
			tail.Anchored = true
			tail.CanCollide = false
			tail.CanQuery = false
			local a = i * 2.3
			tail.CFrame = pivot * CF(math.cos(a) * inner * 0.45, top - 0.1 - (1 - n / cap) * 0.4, math.sin(a) * inner * 0.45) * CFrame.Angles(0, a, 0.3)
			tail.Parent = Fx.folder
			table.insert(e.tails, tail)
		end
	end
	-- the tails wiggle
	for i, tail in e.tails do
		local base = tail:GetAttribute("BaseCF")
		if not base then
			tail:SetAttribute("BaseCF", tail.CFrame)
			base = tail.CFrame
		end
		tail.CFrame = base * CFrame.Angles(0, sin(os.clock() * 7 + i * 1.7) * 0.35, 0)
	end
end

-- EFFECTS (from the server) ----------------------------------------------------------------------
local function popup(text: string, color: Color3)
	if HUD and HUD.popup then HUD.popup(text, color) end
end

local function onFx(kind: string, d)
	if kind == "Collected" then
		-- every fish flies from the bucket into your arms
		local char = player.Character
		local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
		if not root then return end
		local from = d.from + V3(0, 2.5, 0)
		Sound.play("Splash", { at = d.from, volume = 0.7 })
		for i, id in d.list do
			if i > 12 then break end
			task.delay((i - 1) * 0.07, function()
				local f = makeFish(id)
				if not f then return end
				pcall(function() f:ScaleTo((f:GetAttribute("BaseScale") or 1) * 0.6) end)
				f:SetAttribute("Anim", "Flop")
				local t0 = os.clock()
				local side = V3((math.random() - 0.5) * 3, 0, (math.random() - 0.5) * 3)
				local conn
				conn = RunService.RenderStepped:Connect(function()
					local k = clamp((os.clock() - t0) / 0.6, 0, 1)
					if k >= 1 or not root.Parent then
						conn:Disconnect()
						f:Destroy()
						Sound.play("Tick", { pitch = 1.4 + i * 0.05, volume = 0.5 })
						return
					end
					local to = root.Position + V3(0, 0.5, 0)
					local pos = from:Lerp(to, Easing.quadIn(k)) + side * sin(k * math.pi) + V3(0, sin(k * math.pi) * 4, 0)
					f:PivotTo(CF(pos) * CFrame.Angles(k * 8, k * 5, 0))
				end)
			end)
		end
		popup(("+%d FISH!"):format(#d.list), Color3.fromRGB(110, 210, 255))
	elseif kind == "Hired" then
		if d.at then
			Fx.blocks(d.at + V3(0, 3, 0), Color3.fromRGB(255, 220, 90), 30, 22, 0.4, { life = 1.2, up = 2.4, gravity = 40,
				colors = { Color3.fromRGB(255, 220, 90), Color3.fromRGB(250, 205, 35), Color3.fromRGB(255, 255, 255), Color3.fromRGB(60, 92, 165) } })
		end
		Sound.play("Reward")
		Sound.play("Buy")
		popup("FISHERMAN HIRED!", Color3.fromRGB(255, 220, 90))
	elseif kind == "Upgraded" then
		if d.at then
			Fx.blocks(d.at + V3(0, 3, 0), Color3.fromRGB(124, 255, 70), 22, 18, 0.35, { life = 1, up = 2.2, gravity = 40 })
		end
		Sound.play("Buy")
		if d.newOutfit then
			Sound.play("Reward")
			popup(("NEW OUTFIT: %s!"):format(F.TierNames[d.tier]:upper()), Color3.fromRGB(255, 200, 60))
		else
			popup(("FISHERMAN LV.%d!"):format(d.level), Color3.fromRGB(124, 255, 70))
		end
	elseif kind == "BucketUp" then
		if d.at then
			Fx.blocks(d.at + V3(0, 2, 0), Color3.fromRGB(176, 112, 56), 24, 18, 0.35, { life = 1, up = 2.2, gravity = 40 })
		end
		Sound.play("Buy")
		popup(("BUCKET: %d FISH!"):format(d.cap), Color3.fromRGB(255, 200, 60))
	end
end

-- init ---------------------------------------------------------------------------------------------
function FisherController.init(hud)
	HUD = hud
	for _, d in workspace:GetDescendants() do register(d) end
	workspace.DescendantAdded:Connect(register)
	Net.event("FisherFx").OnClientEvent:Connect(onFx)
	RunService.RenderStepped:Connect(function(dt)
		dt = math.min(dt, 0.1)
		local now = Clock.now()
		for m, e in fishers do
			if m.Parent and e.root.Parent then
				if not e.bucketModel or not e.bucketModel.Parent then
					for bm in buckets do
						if bm:GetAttribute("Base") == e.base then e.bucketModel = bm end
					end
				end
				local ok, err = pcall(updateFisher, e, dt, now)
				if not ok and not e.warned then
					e.warned = true
					warn("[TFB] fisher anim", err)
				end
			end
		end
		for m, e in ghosts do
			if m.Parent then
				-- the silhouette breathes and shimmers softly (no glow)
				local t = os.clock() - e.t0
				local br = sin(t * 1.6)
				for _, j in { "Waist", "Neck", "ShoulderL", "ShoulderR" } do
					local mt = e.motors[j]
					if mt then
						if j == "Waist" then mt.Transform = CFrame.Angles(0.03 + br * 0.02, 0, 0)
						elseif j == "Neck" then mt.Transform = CFrame.Angles(-0.05, sin(t * 0.5) * 0.3, 0)
						elseif j == "ShoulderR" then mt.Transform = CFrame.Angles(0.9 + br * 0.03, 0, 0)
						else mt.Transform = CFrame.Angles(0.1 + br * 0.03, 0, 0) end
					end
				end
				if e.sign then e.sign.StudsOffsetWorldSpace = V3(0, 7.6 + sin(t * 2) * 0.2, 0) end
			end
		end
		for m, e in buckets do
			if m.Parent then pcall(updateBucket, e, dt) end
		end
	end)
	-- hide other players' prompts / signs on their docks
	local function filter(d: Instance)
		if d:IsA("ProximityPrompt") then
			local kind = d:GetAttribute("TFBPrompt")
			if kind == "HireFisher" or kind == "UpgradeFisher" or kind == "CollectBucket" or kind == "UpgradeBucket" then
				d.Enabled = d:GetAttribute("Owner") == player.UserId
			end
		end
	end
	for _, d in workspace:GetDescendants() do filter(d) end
	workspace.DescendantAdded:Connect(filter)
end

return FisherController
