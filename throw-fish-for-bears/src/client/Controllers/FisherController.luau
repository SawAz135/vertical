--[[ FisherController: brings the hired fishermen to life (client side, every player sees
     them, zero network cost). The server publishes each fisherman's phase (Phase, PhaseT,
     PhaseDur + the fish he carries); this animates it on a full rig (waist, neck,
     shoulders, ELBOWS, WRISTS, hips, KNEES, ANKLES, a 3-segment BENDING rod and a turning
     reel crank), keyframed like a real animation, every channel spring-smoothed:
       Bait     : reaches back into the creel, pulls out a wriggling worm, threads it onto
                  the hook dangling from the rod tip, head down, careful fingers
       Cast     : weight back, rod loaded over the shoulder (the rod bends back)... WHIP,
                  weight forward, the rod whips, the line flies out, plop
       Wait     : he SITS on the edge of the dock, legs dangling over the water, the line
                  sagging; drinks from his thermos, checks the line, looks around, swings
                  his boots, waves at you when you walk by
       Reel     : the bobber is yanked under, the line snaps taut: he jumps up, braces
                  (front knee bent), pumps the rod (bent double) and cranks the reel
       Catch    : one last heave, the fish flies out of the water, the left hand grabs it
       Unhook   : kneels (one knee on the planks), the fish flops and bounces on the boards,
                  he pins it, works the hook out (pop), grabs it by the gills, stands up and
                  shows it: a big one = arm high + fist pump; a small one = a shrug
       ToBucket : real walk (knees bend in the swing, heel / toe, hips sway, shoulders
                  counter-rotate), carrying it (a big one in both arms, leaning back)
       Full     : bucket full: waits, foot tapping, sighs, head shaking
       Drop     : leans over the bucket, lets it go (the fish lands ELASTIC: squash /
                  stretch bounce, jelly wobble, splash), then wipes his hands on his coat
       Back     : walks back to his spot ]]
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
local FishConfig = require(Shared.Config.FishConfig)
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
local PI = math.pi
local JOINTS = { "Waist", "Neck", "ShoulderL", "ShoulderR", "ElbowL", "ElbowR", "WristL", "WristR",
	"HipL", "HipR", "KneeL", "KneeR", "AnkleL", "AnkleR" }
local MIRRORED = { ShoulderL = true, ElbowL = true, WristL = true, HipL = true, KneeL = true, AnkleL = true }
local HIP_H = 2 -- root height above the feet
local ZERO = Vector3.zero

-- keyframes { {time, value, ease?}, ... } (value: number)
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
local bump = Easing.bump

local function newPose()
	local p = {}
	for _, j in JOINTS do p[j] = ZERO end
	p.rootY = 0 -- root height offset
	p.rootF = 0 -- root shift forward (facing)
	p.rootPitch = 0
	p.bend = 0.05 -- rod bend (+ up / - loaded down)
	p.crank = 0 -- crank speed (rad/s)
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
	m:SetAttribute("Len", math.min(big, 2.4))
	m:SetAttribute("Anim", "Held")
	m.Parent = Fx.folder
	return m
end

-- the MOUTH attachment of a fish (a Part is also called "Mouth": look for the Attachment)
local function fishMouth(f: Model): Attachment?
	for _, d in f:GetDescendants() do
		if d:IsA("Attachment") and d.Name == "Mouth" then return d end
	end
	return nil
end

local function part(size: Vector3, color: Color3, shape: Enum.PartType?): Part
	local p = Instance.new("Part")
	p.Size = size
	p.Color = color
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	if shape then p.Shape = shape end
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	return p
end

-- the end of the line: hook (+ worm) or the bobber in the water
local function makeTackle(): Model
	local m = Instance.new("Model")
	m.Name = "FisherTackle"
	local bob = part(V3(0.5, 0.5, 0.5), Color3.fromRGB(230, 40, 40), Enum.PartType.Ball)
	bob.Name = "Bobber"
	bob.Parent = m
	local bob2 = part(V3(0.46, 0.46, 0.46), Color3.fromRGB(250, 250, 250), Enum.PartType.Ball)
	bob2.Name = "BobberLow"
	bob2.Parent = m
	local hook = part(V3(0.08, 0.3, 0.08), Color3.fromRGB(180, 180, 190))
	hook.Name = "Hook"
	hook.Parent = m
	local worm = part(V3(0.12, 0.34, 0.12), Color3.fromRGB(220, 120, 130))
	worm.Name = "HookWorm"
	worm.Parent = m
	local att = Instance.new("Attachment")
	att.Name = "Line"
	att.Position = V3(0, 0.2, 0)
	att.Parent = bob
	-- the leader: a thin line from under the bobber down to the hook (visible when the fish hangs on it)
	local la = Instance.new("Attachment")
	la.Name = "LeaderTop"
	la.Position = V3(0, -0.2, 0)
	la.Parent = bob
	local lb = Instance.new("Attachment")
	lb.Name = "LeaderEnd"
	lb.Position = V3(0, 0.13, 0)
	lb.Parent = hook
	local leader = Instance.new("Beam")
	leader.Attachment0 = la
	leader.Attachment1 = lb
	leader.Width0 = 0.06
	leader.Width1 = 0.05
	leader.Color = ColorSequence.new(Color3.fromRGB(225, 225, 225))
	leader.LightEmission = 0
	leader.Transparency = NumberSequence.new(0.25)
	leader.FaceCamera = true
	leader.Segments = 4
	leader.Parent = bob
	m.PrimaryPart = bob
	m.Parent = Fx.folder
	return m
end

local function makeLine(a0: Attachment, a1: Attachment): Beam
	local b = Instance.new("Beam")
	b.Attachment0 = a0
	b.Attachment1 = a1
	b.Width0 = 0.09 -- visible from the beach
	b.Width1 = 0.07
	b.Color = ColorSequence.new(Color3.fromRGB(235, 235, 235))
	b.LightEmission = 0
	b.Transparency = NumberSequence.new(0.2)
	b.FaceCamera = true
	b.Segments = 16
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
	local props = { Thermos = {}, Worm = {} }
	for _, d in m:GetDescendants() do
		local pr = d:GetAttribute("Prop")
		if pr and props[pr] then
			table.insert(props[pr], d)
			d.LocalTransparencyModifier = 1
		end
	end
	local cur = newPose()
	local e = {
		model = m, root = m.PrimaryPart, motors = motors, base = base, slot = slot,
		path = path, lens = lens, total = total, cur = cur, vel = {}, yaw = nil,
		tipAtt = m:FindFirstChild("RodTip", true), pipe = m:FindFirstChild("PipeSmoke", true),
		handL = nil, handR = nil, -- the grip ATTACHMENTS (found below, by class)
		props = props, seed = (m:GetAttribute("Seed") or 1) % 1000, lastPhase = nil,
		splashT = 0, smokeT = 0, dripT = 0, crank = 0, walkPh = 0, waveT = -99, near = false,
	}
	for _, j in JOINTS do e.vel[j] = ZERO end
	-- grip attachments (the hand BONES are also called HandL / HandR: look for Attachments)
	for _, d in m:GetDescendants() do
		if d:IsA("Attachment") then
			if d.Name == "GripL" or d.Name == "HandL" then e.handL = d end
			if d.Name == "GripR" or d.Name == "HandR" then e.handR = d end
			if d.Name == "RodTip" then e.tipAtt = d end
		end
	end
	fishers[m] = e
	m.Destroying:Connect(function()
		fishers[m] = nil
		if e.tackle then e.tackle:Destroy() end
		if e.fish then e.fish:Destroy() end
		if e.bubble then e.bubble:Destroy() end
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
		if d:GetAttribute("Prop") then d.LocalTransparencyModifier = 1 end
	end
	ghosts[m] = e
	if mine then
		-- floating sign over the silhouette: HIRE FISHERMAN + price (text only, outlined)
		local bb = Instance.new("BillboardGui")
		bb.Name = "HireSign"
		bb.Size = UDim2.fromOffset(240, 90)
		bb.StudsOffsetWorldSpace = V3(0, 7.6, 0)
		bb.AlwaysOnTop = false
		bb.MaxDistance = 30 -- only readable when you are near the silhouette (was 90)
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
	bb.StudsOffsetWorldSpace = V3(0, 1.6, 0)
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
	return e.path[#e.path], V3(0, 0, 1)
end

-- POSES (all angles in radians; L side is mirrored when applied) --------------------------
-- X: shoulder/hip/wrist/elbow + = forward / flex; knee - = flex; waist + = lean back;
-- neck + = look up; Y = twist (+ left); Z = roll

-- standing with the rod: rod hand forward-up, left hand resting near the reel
local function rodStance(p, t: number)
	local br = sin(t * 1.7)
	p.ShoulderR = V3(0.75 + br * 0.02, 0.05, -0.1)
	p.ElbowR = V3(0.55, 0, 0)
	p.WristR = V3(0.15, 0, 0)
	p.ShoulderL = V3(0.55, -0.35, 0.1)
	p.ElbowL = V3(1.15, 0, 0)
	p.WristL = V3(0.1, 0, 0)
	p.Waist = V3(0.03 + br * 0.012, 0, 0)
	p.Neck = V3(-0.1, 0, 0)
	p.HipL = V3(0.14, 0, 0.03)
	p.KneeL = V3(-0.18, 0, 0)
	p.AnkleL = V3(0.04, 0, 0)
	p.HipR = V3(-0.06, 0, -0.03)
	p.KneeR = V3(-0.1, 0, 0)
	p.rootY = -0.06 + br * 0.01
end

-- seated on the dock edge, legs over the water, rod resting forward
local function seated(p, t: number)
	local br = sin(t * 1.5)
	p.rootY = -1.42
	p.rootF = 0.45
	p.HipL = V3(1.5, 0, 0.06)
	p.HipR = V3(1.5, 0, -0.06)
	-- boots swinging lazily over the water
	p.KneeL = V3(-1.45 + sin(t * 1.3) * 0.18, 0, 0)
	p.KneeR = V3(-1.45 + sin(t * 1.3 + 2) * 0.18, 0, 0)
	p.AnkleL = V3(0.2, 0, 0)
	p.AnkleR = V3(0.2, 0, 0)
	p.Waist = V3(-0.08 + br * 0.015, 0, 0)
	p.Neck = V3(-0.1, 0, 0)
	p.ShoulderR = V3(0.55, 0.05, -0.08)
	p.ElbowR = V3(0.7, 0, 0)
	p.WristR = V3(0.1, 0, 0)
	p.ShoulderL = V3(0.25, -0.2, 0.05)
	p.ElbowL = V3(0.9, 0, 0)
end

-- a REAL walk: knees bend in the swing, heel strike, toe off, hip sway, counter-rotating
-- shoulders, pelvis bob. `ph` = gait phase (radians), `carry` = nil | "big" | "small"
local function walkPose(p, ph: number, carry: string?)
	local function leg(side: string, q: number)
		local s = sin(q)
		local swing = math.max(0, cos(q)) -- the leg moving forward
		p["Hip" .. side] = V3(0.42 * s, 0, 0)
		p["Knee" .. side] = V3(-0.12 - 0.95 * swing ^ 1.4, 0, 0)
		p["Ankle" .. side] = V3(0.25 * sin(q + 0.6) - 0.05, 0, 0)
	end
	leg("L", ph)
	leg("R", ph + PI)
	p.rootY = -0.08 - 0.07 * cos(2 * ph)
	p.Waist = V3(0.02, 0.1 * sin(ph), 0.04 * sin(ph))
	p.Neck = V3(-0.05, -0.08 * sin(ph), -0.03 * sin(ph))
	if carry == "big" then
		-- a heavy fish in both arms, leaning back
		p.ShoulderL = V3(0.95, 0.35, 0)
		p.ShoulderR = V3(0.95, -0.35, 0)
		p.ElbowL = V3(0.9, 0, 0)
		p.ElbowR = V3(0.9, 0, 0)
		p.Waist += V3(0.14, 0, 0)
	elseif carry == "small" then
		-- held by the gills at the side, swinging a little
		p.ShoulderL = V3(0.15 - 0.15 * sin(ph), 0, 0.12)
		p.ElbowL = V3(0.35, 0, 0)
		p.ShoulderR = V3(0.55 + 0.1 * sin(ph), 0, -0.08)
		p.ElbowR = V3(0.7, 0, 0)
	else
		p.ShoulderL = V3(-0.4 * sin(ph), 0, 0.06)
		p.ElbowL = V3(0.3 + 0.2 * math.max(0, -sin(ph)), 0, 0)
		p.ShoulderR = V3(0.45 + 0.12 * sin(ph), 0, -0.08) -- rod carried forward
		p.ElbowR = V3(0.75, 0, 0)
	end
end

local P = {}

function P.Bait(e, p, x, t)
	rodStance(p, t)
	-- reach back into the creel
	local reach = bump(clamp(x / 0.9, 0, 1))
	p.ShoulderL = p.ShoulderL:Lerp(V3(-0.9, 0.2, 0.45), reach)
	p.ElbowL = p.ElbowL:Lerp(V3(1.4, 0, 0), reach)
	p.Waist += V3(0, 0.45 * reach, 0)
	p.Neck += V3(0, 0.6 * reach, 0)
	-- both hands come together in front of the chest, head down, threading
	local thread = Easing.sineInOut(clamp((x - 0.75) / 0.35, 0, 1)) * (1 - Easing.sineInOut(clamp((x - 2.0) / 0.35, 0, 1)))
	local fiddle = sin(t * 13) * 0.08 * thread
	p.ShoulderR = p.ShoulderR:Lerp(V3(0.55, -0.35, -0.05), thread)
	p.ElbowR = p.ElbowR:Lerp(V3(1.55, 0, 0), thread)
	p.ShoulderL = p.ShoulderL:Lerp(V3(0.6, 0.45, 0), thread)
	p.ElbowL = p.ElbowL:Lerp(V3(1.6, 0, 0), thread)
	p.WristL += V3(fiddle, fiddle * 2, 0)
	p.WristR += V3(-fiddle, 0, fiddle)
	p.Neck += V3(-0.5 * thread, 0, 0)
	p.Waist += V3(-0.12 * thread, 0, 0)
	p.bend = 0.04
end

function P.Cast(e, p, x, t)
	rodStance(p, t)
	-- 0 -> 0.6 load (weight back, rod over the shoulder), 0.6 -> 0.82 WHIP, follow-through
	p.ShoulderR = V3(kf(x, { { 0, 0.75 }, { 0.6, 2.75, Easing.cubicOut }, { 0.82, 0.7, Easing.expoOut }, { 1.15, 0.85 }, { 1.6, 0.75 } }), 0.05,
		kf(x, { { 0, -0.1 }, { 0.6, 0.15 }, { 0.82, -0.12 }, { 1.6, -0.1 } }))
	p.ElbowR = V3(kf(x, { { 0, 0.55 }, { 0.6, 1.25 }, { 0.82, 0.2, Easing.expoOut }, { 1.6, 0.55 } }), 0, 0)
	p.WristR = V3(kf(x, { { 0, 0.15 }, { 0.6, -0.4 }, { 0.8, 0.55, Easing.expoOut }, { 1.6, 0.15 } }), 0, 0)
	p.ShoulderL = V3(kf(x, { { 0, 0.55 }, { 0.6, 1.3 }, { 0.82, 0.35 }, { 1.6, 0.55 } }), -0.35, 0.1)
	p.Waist = V3(kf(x, { { 0, 0.03 }, { 0.6, 0.22, Easing.cubicOut }, { 0.8, -0.22, Easing.expoOut }, { 1.2, -0.06 }, { 1.6, 0.03 } }),
		kf(x, { { 0, 0 }, { 0.6, 0.4, Easing.cubicOut }, { 0.8, -0.3, Easing.expoOut }, { 1.6, 0 } }), 0)
	p.Neck = V3(kf(x, { { 0, -0.1 }, { 0.6, 0.2 }, { 0.85, -0.15 }, { 1.6, -0.1 } }), 0, 0)
	-- weight transfer: back leg loads, then the front leg takes it
	p.HipL = V3(kf(x, { { 0, 0.14 }, { 0.6, 0.05 }, { 0.82, 0.45 }, { 1.6, 0.14 } }), 0, 0.03)
	p.KneeL = V3(kf(x, { { 0, -0.18 }, { 0.6, -0.1 }, { 0.82, -0.45 }, { 1.6, -0.18 } }), 0, 0)
	p.HipR = V3(kf(x, { { 0, -0.06 }, { 0.6, 0.2 }, { 0.82, -0.3 }, { 1.6, -0.06 } }), 0, -0.03)
	p.KneeR = V3(kf(x, { { 0, -0.1 }, { 0.6, -0.4 }, { 0.82, -0.12 }, { 1.6, -0.1 } }), 0, 0)
	p.rootY = kf(x, { { 0, -0.06 }, { 0.6, -0.22 }, { 0.82, -0.18 }, { 1.6, -0.06 } })
	-- the rod LOADS back, then whips forward past straight, then settles
	p.bend = kf(x, { { 0, 0.04 }, { 0.5, 0.05 }, { 0.68, 0.55 }, { 0.82, -0.5, Easing.expoOut }, { 1.0, 0.25 }, { 1.2, -0.08 }, { 1.6, 0.04 } })
end

-- the idle schedule while sitting: what he's doing at time `w` into the wait
local function waitAct(e, w: number, d: number): (string?, number)
	if d < 3.2 then return nil, 0 end
	local acts = { "look", "thermos", "check", "swing" }
	local start = 1.2
	local slot = math.floor((w - start) / 2.6)
	if w < start or slot < 0 then return nil, 0 end
	local k = ((w - start) % 2.6) / 2.6
	if w > d - 0.6 then return nil, 0 end
	return acts[((slot + e.seed) % #acts) + 1], k
end

function P.Wait(e, p, x, t, d, w)
	-- sit down (0 -> 1 s) unless the wait is too short
	if d < 2.6 then
		rodStance(p, t)
	else
		seated(p, t)
		local sitK = Easing.cubicInOut(clamp(w / 1.0, 0, 1))
		if sitK < 1 then
			local st = newPose()
			rodStance(st, t)
			for _, j in JOINTS do p[j] = st[j]:Lerp(p[j], sitK) end
			p.rootY = st.rootY + (p.rootY - st.rootY) * sitK
			p.rootF = p.rootF * sitK
		end
		local act, k = waitAct(e, w, d)
		e.act = act
		local b = bump(k)
		if act == "thermos" then
			-- a sip of coffee: thermos to the mouth, head back
			p.ShoulderL = p.ShoulderL:Lerp(V3(1.25, 0.55, 0.1), b)
			p.ElbowL = p.ElbowL:Lerp(V3(2.0, 0, 0), b)
			p.WristL = V3(-0.3 * b, 0, 0)
			p.Neck += V3(0.35 * bump(clamp((k - 0.3) / 0.4, 0, 1)), 0.1 * b, 0)
		elseif act == "check" then
			-- pinches the line and tugs it gently
			p.ShoulderL = p.ShoulderL:Lerp(V3(1.15, -0.1, 0), b)
			p.ElbowL = p.ElbowL:Lerp(V3(0.35, 0, 0), b)
			p.WristL = V3(sin(t * 8) * 0.15 * b, 0, 0)
			p.Neck += V3(0.15 * b, 0, 0)
		elseif act == "look" then
			p.Neck += V3(0.05, sin(k * PI * 2) * 0.8 * b, 0)
			p.Waist += V3(0, sin(k * PI * 2) * 0.12 * b, 0)
		elseif act == "swing" then
			p.KneeL += V3(sin(t * 4) * 0.35 * b, 0, 0)
			p.KneeR += V3(sin(t * 4 + PI) * 0.35 * b, 0, 0)
		end
	end
	p.bend = 0.06 + sin(t * 1.3) * 0.015
end

function P.Reel(e, p, x, t)
	-- BITE: jumps up into the fight stance
	rodStance(p, t)
	local up = Easing.backOut(clamp(x / 0.45, 0, 1))
	local fight = clamp((x - 0.35) / 0.4, 0, 1)
	-- pump-and-reel: lift the rod (bent double), lower it while cranking
	local cyc = (x * 0.85) % 1
	local lift = if cyc < 0.45 then Easing.sineInOut(cyc / 0.45) else 1 - Easing.sineInOut((cyc - 0.45) / 0.55)
	local jerk = sin(t * 9.3) * 0.06 + sin(t * 5.1) * 0.05
	p.ShoulderR = V3(0.75 + up * 0.5 + fight * (0.55 * lift + jerk), 0.05, -0.12)
	p.ElbowR = V3(0.55 + fight * (0.6 - 0.3 * lift), 0, 0)
	p.WristR = V3(0.15 - 0.2 * fight * lift, 0, 0)
	-- left hand cranking: the hand circles with the crank
	local ca = e.crank
	p.ShoulderL = V3(0.7 + fight * (0.18 + sin(ca) * 0.12), -0.4, 0.1 + cos(ca) * 0.06 * fight)
	p.ElbowL = V3(1.3 + fight * cos(ca) * 0.25, 0, 0)
	p.WristL = V3(sin(ca) * 0.2 * fight, 0, 0)
	-- braced: front knee bent, leaning back against the pull
	p.Waist = V3(0.03 + 0.2 * up + fight * (0.2 + 0.1 * lift + jerk * 0.5), fight * jerk * 0.6, fight * jerk * 0.2)
	p.Neck = V3(-0.1 + 0.15 * up - fight * 0.12, 0, 0)
	p.HipL = V3(0.14 + fight * 0.42, 0, 0.05)
	p.KneeL = V3(-0.18 - fight * 0.55, 0, 0)
	p.AnkleL = V3(0.15 * fight, 0, 0)
	p.HipR = V3(-0.06 - fight * 0.3, 0, -0.05)
	p.KneeR = V3(-0.1 - fight * 0.15, 0, 0)
	p.rootY = -0.06 - 0.3 * fight
	p.bend = 0.05 - 0.4 * up - fight * (0.5 + 0.35 * lift + jerk * 2)
	p.crank = if x > 0.4 then (if lift < 0.5 then 16 else 6) else 0
end

function P.Catch(e, p, x, t)
	rodStance(p, t)
	-- one last heave (rod high, bent), then the left hand snatches the fish
	local heave = Easing.backOut(clamp(x / 0.45, 0, 1))
	local grab = Easing.cubicOut(clamp((x - 0.7) / 0.35, 0, 1))
	p.ShoulderR = V3(0.75 + 1.75 * heave * (1 - 0.6 * grab), 0.05, -0.1)
	p.ElbowR = V3(0.55 + 0.3 * heave, 0, 0)
	p.ShoulderL = V3(0.55 + 0.75 * grab, -0.1 * grab, 0.1)
	p.ElbowL = V3(1.15 - 0.6 * grab, 0, 0)
	p.Waist = V3(0.03 + 0.35 * heave * (1 - grab), 0, 0)
	p.Neck = V3(-0.1 + 0.4 * heave * (1 - grab) - 0.15 * grab, 0, 0)
	p.HipL = V3(0.14 + 0.25 * (1 - grab), 0, 0.03)
	p.KneeL = V3(-0.18 - 0.3 * (1 - grab), 0, 0)
	p.bend = -0.55 * (1 - heave) + 0.2 * heave * (1 - grab)
	p.crank = 10 * (1 - heave)
end

function P.Unhook(e, p, x, t, d, w, big)
	-- 0 -> 0.5 kneel (right knee on the planks, left foot planted)
	local down = Easing.cubicOut(clamp(x / 0.5, 0, 1))
	local standUp = Easing.cubicInOut(clamp((x - 2.15) / 0.55, 0, 1))
	local kneel = down * (1 - standUp)
	local pop = bump(clamp((x - 1.85) / 0.25, 0, 1))
	local work = if x > 0.9 and x < 1.85 then sin(t * 20) * 0.12 else 0
	rodStance(p, t)
	p.rootY = -1.12 * kneel - 0.06 * (1 - kneel)
	p.HipL = V3(1.45 * kneel + 0.14 * (1 - kneel), 0, 0.05)
	p.KneeL = V3(-1.45 * kneel - 0.18 * (1 - kneel), 0, 0)
	p.AnkleL = V3(0.1 * kneel, 0, 0)
	p.HipR = V3(-0.15 * kneel - 0.06 * (1 - kneel), 0, -0.05)
	p.KneeR = V3(-1.55 * kneel - 0.1 * (1 - kneel), 0, 0)
	p.AnkleR = V3(-0.6 * kneel, 0, 0)
	p.Waist = V3(-0.42 * kneel, 0, 0)
	p.Neck = V3(-0.55 * kneel + 0.2 * pop, 0, 0)
	-- left hand pins the fish, right hand works the hook out (pop), rod tucked under the arm
	local pin = clamp((x - 0.6) / 0.3, 0, 1) * kneel
	p.ShoulderL = V3(0.55 + 0.45 * pin, 0.1 * pin, 0.1)
	p.ElbowL = V3(1.15 - 0.85 * pin, 0, 0)
	p.ShoulderR = V3(0.75 * (1 - kneel) + (0.35 + work + 0.7 * pop) * kneel, -0.25 * kneel, -0.1)
	p.ElbowR = V3(0.55 + 0.9 * kneel, 0, 0)
	p.WristR = V3(work * 2, work * 3, 0)
	-- 2.7 -> 3.4: SHOW IT. big one = arm up high + fist pump; small one = shrug
	local show = Easing.backOut(clamp((x - 2.65) / 0.35, 0, 1))
	if show > 0 then
		if big then
			p.ShoulderL = p.ShoulderL:Lerp(V3(2.7, 0, 0.15), show)
			p.ElbowL = p.ElbowL:Lerp(V3(0.2, 0, 0), show)
			p.ShoulderR = p.ShoulderR:Lerp(V3(2.3 + abs(sin(t * 12)) * 0.4, 0, -0.35), show)
			p.ElbowR = p.ElbowR:Lerp(V3(1.6, 0, 0), show)
			p.Neck += V3(0.35 * show, 0, 0)
			p.Waist += V3(0.12 * show, 0, 0)
			p.rootY += abs(sin(t * 12)) * 0.08 * show
		else
			p.ShoulderL = p.ShoulderL:Lerp(V3(0.5, 0.2, 0.35), show)
			p.ElbowL = p.ElbowL:Lerp(V3(1.3, 0, 0), show)
			p.ShoulderR = p.ShoulderR:Lerp(V3(0.5, -0.1, -0.35), show)
			p.Neck += V3(0, 0, 0.2 * show)
			p.rootY += 0.06 * show
		end
	end
	p.bend = 0.05
end

function P.Full(e, p, x, t, d, w, big)
	walkPose(p, 0, if big then "big" else "small")
	p.HipL = V3(0, 0, 0.03)
	p.HipR = V3(0, 0, -0.03)
	p.KneeL = V3(-0.08, 0, 0)
	p.KneeR = V3(-0.08, 0, 0)
	-- foot tapping, sighs, head shaking
	p.AnkleR = V3(abs(sin(t * 7)) * 0.35, 0, 0)
	p.Neck = V3(-0.1, sin(t * 2.6) * 0.35, 0)
	p.Waist = V3(0.04 + sin(t * 0.9) * 0.05, 0, 0)
	p.rootY = -0.05 + sin(t * 0.9) * 0.03
end

function P.Drop(e, p, x, t, d, w, big)
	walkPose(p, 0, if big then "big" else "small")
	p.HipL = V3(0.1, 0, 0.03)
	p.HipR = V3(-0.05, 0, -0.03)
	p.KneeL = V3(-0.2, 0, 0)
	p.KneeR = V3(-0.1, 0, 0)
	-- lean over the bucket and let go (0.8), straighten, then wipe his hands on the coat
	local lean = Easing.cubicOut(clamp(x / 0.6, 0, 1)) * (1 - Easing.cubicInOut(clamp((x - 0.95) / 0.4, 0, 1)))
	p.Waist = V3(-0.45 * lean, 0, 0)
	p.Neck = V3(-0.4 * lean, 0, 0)
	p.ShoulderL = p.ShoulderL:Lerp(V3(1.35, 0.25, 0.05), lean)
	p.ShoulderR = p.ShoulderR:Lerp(V3(1.35, -0.25, -0.05), lean)
	p.ElbowL = p.ElbowL:Lerp(V3(0.3, 0, 0), lean)
	p.ElbowR = p.ElbowR:Lerp(V3(0.3, 0, 0), lean)
	p.KneeL += V3(-0.25 * lean, 0, 0)
	p.KneeR += V3(-0.25 * lean, 0, 0)
	p.rootY = -0.2 * lean
	local wipe = bump(clamp((x - 1.25) / 0.75, 0, 1))
	if wipe > 0 then
		local rub = sin(t * 16) * 0.12
		p.ShoulderL = V3(0.25 + rub, 0.1, 0.15) * wipe + p.ShoulderL * (1 - wipe)
		p.ShoulderR = V3(0.25 - rub, -0.1, -0.15) * wipe + p.ShoulderR * (1 - wipe)
		p.ElbowL = V3(0.9, 0, 0) * wipe + p.ElbowL * (1 - wipe)
		p.ElbowR = V3(0.9, 0, 0) * wipe + p.ElbowR * (1 - wipe)
		p.Neck += V3(-0.25 * wipe, 0, 0)
	end
end

-- ONE FISHERMAN, PER FRAME --------------------------------------------------------------------
local function setFish(e, on: boolean)
	local m = e.model
	if on and not e.fish then
		local id = m:GetAttribute("CarryFish")
		if id then
			e.fish = makeFish(id, m:GetAttribute("CarryW"), m:GetAttribute("CarryV"))
				or makeFish(FishConfig.Order[1], nil, nil) -- never an invisible catch
			e.mouth = if e.fish then fishMouth(e.fish) else nil
		end
	elseif not on and e.fish then
		e.fish:Destroy()
		e.fish = nil
		e.mouth = nil
		e.mouthPos = nil
	end
end

local function setProp(e, name: string, on: boolean)
	for _, d in e.props[name] do d.LocalTransparencyModifier = if on then 0 else 1 end
end

-- runs one part of the animation; an error there is reported ONCE and can't stop the rest
local function guard(e, fn)
	local ok, err = pcall(fn)
	if not ok then
		e.errs = e.errs or {}
		local key = tostring(err)
		if not e.errs[key] then
			e.errs[key] = true
			warn("[TFB] fisher anim", key)
		end
	end
end

-- SPEECH BUBBLES: a little studded bubble over the fisherman's head (pops in, floats, pops out)
local LINES = {
	CatchBig = { "WHOA! Look at this one!", "A monster!!", "Now THAT's a fish!" },
	Catch = { "Got one!", "Fish on!", "Here we go!" },
	Small = { "Bit small... it counts!", "Tiny but tasty.", "Better than nothing!" },
	Full = { "Bucket's full!", "No more room!", "Come collect!" },
	Drop = { "In you go!", "Another one!", "Plop!" },
	Wave = { "Hey there!", "Ahoy!", "Nice day for it!" },
}
local function say(e, kind: string)
	local list = LINES[kind]
	local head = e.head
	if not list or not head or not head.Parent then return end
	local TweenService = game:GetService("TweenService")
	if e.bubble then e.bubble:Destroy() end
	local bb = Instance.new("BillboardGui")
	bb.Name = "FisherBubble"
	bb.Size = UDim2.fromOffset(190, 52)
	bb.StudsOffsetWorldSpace = Vector3.new(0, 2.6, 0)
	bb.Adornee = head
	bb.LightInfluence = 0
	bb.MaxDistance = 70
	bb.AlwaysOnTop = false
	local box = Instance.new("Frame")
	box.AnchorPoint = Vector2.new(0.5, 1)
	box.Position = UDim2.fromScale(0.5, 0.82)
	box.Size = UDim2.fromScale(1, 0.8)
	box.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
	box.Parent = bb
	local cr = Instance.new("UICorner")
	cr.CornerRadius = UDim.new(0, 10)
	cr.Parent = box
	local st = Instance.new("UIStroke")
	st.Thickness = 3
	st.Color = Color3.fromRGB(20, 20, 24)
	st.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	st.Parent = box
	local tail = Instance.new("Frame")
	tail.Size = UDim2.fromOffset(12, 12)
	tail.AnchorPoint = Vector2.new(0.5, 0.5)
	tail.Position = UDim2.new(0.5, 0, 1, 0)
	tail.Rotation = 45
	tail.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
	tail.BorderSizePixel = 0
	tail.ZIndex = 0
	tail.Parent = box
	local tx = Instance.new("TextLabel")
	tx.BackgroundTransparency = 1
	tx.Size = UDim2.new(1, -14, 1, -8)
	tx.Position = UDim2.fromOffset(7, 4)
	tx.Font = Enum.Font.FredokaOne
	tx.TextScaled = true
	tx.TextColor3 = Color3.fromRGB(40, 40, 46)
	tx.Text = list[math.random(1, #list)]
	tx.ZIndex = 2
	tx.Parent = box
	local sc = Instance.new("UIScale")
	sc.Scale = 0
	sc.Parent = box
	bb.Parent = player:WaitForChild("PlayerGui")
	e.bubble = bb
	TweenService:Create(sc, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()
	task.delay(2.4, function()
		if e.bubble ~= bb then return end
		TweenService:Create(sc, TweenInfo.new(0.2, Enum.EasingStyle.Back, Enum.EasingDirection.In), { Scale = 0 }):Play()
		task.delay(0.22, function() bb:Destroy() end)
	end)
end

local NOMINAL = F.Timing

local function updateFisher(e, dt: number, now: number)
	local m = e.model
	local phase = m:GetAttribute("Phase") or "Wait"
	local pt = m:GetAttribute("PhaseT") or now
	local d = math.max(0.05, m:GetAttribute("PhaseDur") or 1)
	local w = clamp(now - pt, 0, d + 5) -- real seconds into the phase
	local nom = NOMINAL[string.lower(phase)]
	local x = if nom then w * (nom / d) else w -- nominal-time keyframes (faster levels just play faster)
	local t = os.clock() + e.seed
	local big = m:GetAttribute("CarryBig") == true
	if phase ~= e.lastPhase then
		e.lastPhase = phase
		e.entered = true
	else
		e.entered = false
	end
	local near = (e.root.Position - camera.CFrame.Position).Magnitude < 190 -- seen from the base too
	e.near = near
	-- speech bubbles on the key moments (only when you are close enough to read them)
	if e.entered and (e.root.Position - camera.CFrame.Position).Magnitude < 70 then
		e.head = e.head or m:FindFirstChild("Head", true)
		if phase == "Catch" then say(e, if big then "CatchBig" else "Catch")
		elseif phase == "Full" then say(e, "Full")
		elseif phase == "Drop" and math.random() < 0.5 then say(e, "Drop")
		elseif phase == "Unhook" and not big and math.random() < 0.4 then
			task.delay(2.8, function() say(e, "Small") end)
		end
	end

	-- where he stands / walks ----------------------------------------------------------------
	local feet, face
	local spotCF = F.spotCF(e.base, e.slot)
	local moving = 0
	if phase == "ToBucket" or phase == "Back" then
		local k = Easing.sineInOut(clamp(w / d, 0, 1))
		local s = if phase == "ToBucket" then e.total * k else e.total * (1 - k)
		local dir
		feet, dir = pathAt(e, s)
		face = if phase == "ToBucket" then dir else -dir
		-- gait phase from the distance actually travelled (no foot sliding)
		local prev = e.lastS or s
		e.walkPh += abs(s - prev) * PI / 1.05
		e.lastS = s
		moving = 1
	else
		e.lastS = nil
		if phase == "Full" or phase == "Drop" then
			feet = F.bucketStand(e.base, e.slot)
			local b = F.bucketPos(e.base)
			local v = Vector3.new(b.X - feet.X, 0, b.Z - feet.Z)
			face = if v.Magnitude > 0.01 then v.Unit else V3(0, 0, 1)
		else
			feet = spotCF.Position
			face = spotCF.LookVector
		end
	end
	local yaw = math.atan2(-face.X, -face.Z)
	if not e.yaw then e.yaw = yaw end
	local dy = (yaw - e.yaw + PI) % (PI * 2) - PI
	e.yaw += dy * Easing.damp(7, dt)

	-- pose -------------------------------------------------------------------------------------
	local p = newPose()
	if moving > 0 then
		walkPose(p, e.walkPh, if phase == "ToBucket" then (if big then "big" else "small") else nil)
	else
		local fn = P[phase]
		if fn then fn(e, p, x, t, d, w, big) else rodStance(p, t) end
	end
	-- he looks at you (and waves once) when you walk by, if his hands allow it
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if root and near and (phase == "Wait" or phase == "Back" or phase == "Full") then
		local v = root.Position - e.root.Position
		if v.Magnitude < 16 then
			local localDir = CFrame.Angles(0, e.yaw, 0):VectorToObjectSpace(v)
			local look = math.atan2(-localDir.X, -localDir.Z)
			p.Neck = V3(p.Neck.X, clamp(look, -1.1, 1.1), p.Neck.Z)
			if os.clock() - e.waveT > 25 and (phase ~= "Wait" or e.act == nil) then
				e.waveT = os.clock()
				e.head = e.head or m:FindFirstChild("Head", true)
				say(e, "Wave")
			end
		end
	end
	local wk = os.clock() - e.waveT
	if wk < 1.6 and phase ~= "Full" then
		local k = bump(wk / 1.6)
		p.ShoulderL = p.ShoulderL:Lerp(V3(2.6, 0, 0.35), k)
		p.ElbowL = p.ElbowL:Lerp(V3(0.5 + sin(wk * 14) * 0.35, 0, 0), k)
		p.WristL = V3(0, sin(wk * 14) * 0.3 * k, 0)
	end

	-- springs (critically damped, smooth and weighty) ------------------------------------------
	local c = e.cur
	local wn, z = 15, 0.9
	for _, j in JOINTS do
		local v = e.vel[j]
		local acc = (p[j] - c[j]) * (wn * wn) - v * (2 * z * wn)
		v += acc * dt
		e.vel[j] = v
		c[j] += v * dt
	end
	local kk = Easing.damp(10, dt)
	c.rootY += (p.rootY - c.rootY) * kk
	c.rootF += (p.rootF - c.rootF) * kk
	c.bend += (p.bend - c.bend) * Easing.damp(16, dt)
	e.crank += p.crank * dt

	local rot = CFrame.Angles(0, e.yaw, 0)
	local rootCF = CF(feet + V3(0, HIP_H + c.rootY, 0) + rot:VectorToWorldSpace(V3(0, 0, -c.rootF))) * rot
	e.root.CFrame = rootCF
	if near then
		for _, j in JOINTS do
			local mt = e.motors[j]
			if mt then
				local v = c[j]
				mt.Transform = if MIRRORED[j] then CFrame.Angles(v.X, -v.Y, -v.Z) else CFrame.Angles(v.X, v.Y, v.Z)
			end
		end
		-- the rod bends progressively toward the tip, the crank turns
		local b = c.bend
		for i, k in { 0.22, 0.32, 0.45 } do
			local mt = e.motors["Rod" .. i]
			if mt then mt.Transform = CFrame.Angles(b * k, 0, 0) end
		end
		local cr = e.motors.Crank
		if cr then cr.Transform = CFrame.Angles(e.crank, 0, 0) end
	end

	-- props ------------------------------------------------------------------------------------
	if near then
		setProp(e, "Worm", phase == "Bait" and x > 0.55 and x < 2.05)
		setProp(e, "Thermos", phase == "Wait" and e.act == "thermos")
	end

	-- tackle: hook (+worm) dangling, then the bobber in the water ----------------------------------
	local seed = m:GetAttribute("Seed") or 1
	local target = F.bobber(e.base, e.slot, seed)
	local water = Layout.WATER_Y + 0.05
	local tackleOn = near and e.tipAtt ~= nil
	if tackleOn then guard(e, function()
		if not e.tackle then
			e.tackle = makeTackle()
			e.line = makeLine(e.tipAtt, e.tackle.PrimaryPart:FindFirstChild("Line"))
		end
		local tk = e.tackle
		local tip = e.tipAtt.WorldPosition
		local bobPos, showBobber, hookPos, wormOn = nil, true, nil, false
		local curve0 = 0
		-- the hook still in the fish's mouth (caught, then until it's popped out while unhooking)
		local hooked = e.mouthPos ~= nil and (phase == "Catch" or (phase == "Unhook" and x < 1.85))
		-- just popped out: pinched in the right hand, then let go to dangle again
		local inHand = phase == "Unhook" and x >= 1.85 and x < 2.6 and e.handR ~= nil
		if hooked or inHand then
			hookPos = if hooked then e.mouthPos else e.handR.WorldPosition
			-- the bobber rides up the line, a bit above the hook
			local up = tip - hookPos
			bobPos = hookPos + (if up.Magnitude > 0.01 then up.Unit else V3(0, 1, 0)) * math.min(1.3, up.Magnitude * 0.5)
			wormOn = false
			curve0 = if hooked and phase == "Catch" then sin(t * 30) * 0.1 else 0
		elseif phase ~= "Bait" and phase ~= "Cast" and phase ~= "Wait" and phase ~= "Reel" then
			-- walking / carrying: the empty hook dangles under the rod tip, swaying with the steps
			local swing = V3(sin(t * 3.1) * 0.3, 0, cos(t * 2.6) * 0.25)
			hookPos = tip - V3(0, 1.5, 0) + swing
			hookPos = V3(hookPos.X, math.max(hookPos.Y, Layout.DOCK_TOP_Y + 0.25), hookPos.Z) -- never through the planks
			bobPos = hookPos + V3(0, 0.75, 0)
		elseif phase == "Bait" then
			-- the hook hangs from the tip, then is held between the hands while threading
			local swing = V3(sin(t * 2.2) * 0.25, 0, cos(t * 1.7) * 0.2)
			local hang = tip - V3(0, 1.6, 0) + swing
			local between = if e.handL and e.handR then (e.handL.WorldPosition + e.handR.WorldPosition) / 2 else hang
			local hold = Easing.sineInOut(clamp((x - 0.85) / 0.3, 0, 1)) * (1 - Easing.sineInOut(clamp((x - 2.0) / 0.3, 0, 1)))
			hookPos = hang:Lerp(between, hold)
			wormOn = x > 1.4
			bobPos = hookPos + V3(0, 0.7, 0)
			curve0 = 0
		elseif phase == "Cast" then
			-- flies out in an arc from the rod tip... plop
			local k2 = clamp((x - 0.8) / 0.62, 0, 1)
			if k2 <= 0 then
				hookPos = tip - V3(0, 1.4, 0)
				hookPos = V3(hookPos.X, math.max(hookPos.Y, Layout.DOCK_TOP_Y + 0.25), hookPos.Z) -- never through the planks
				bobPos = hookPos + V3(0, 0.7, 0)
			else
				bobPos = tip:Lerp(target, Easing.quadOut(k2)) + V3(0, sin(k2 * PI) * 3.6, 0)
			end
			wormOn = true
			if k2 >= 1 and not e.plopped then
				e.plopped = true
				Fx.splash(target, 0.5)
				Sound.play("Splash", { at = target, volume = 0.5, pitch = 1.3 })
			end
		elseif phase == "Wait" then
			e.plopped = false
			-- floating, the line SAGGING in a lazy curve
			bobPos = target + V3(0, sin(t * 2.4) * 0.07, 0)
			curve0 = -2.2
			e.rippleT = (e.rippleT or 0) - dt
			if e.rippleT <= 0 then
				e.rippleT = 2.4
				Fx.ripple(bobPos, 0.6)
			end
		else
			-- REEL: yanked under, the line snaps TAUT and vibrates, the fish fights its way in
			local k2 = clamp(w / d, 0, 1)
			local edge = feet + face * 2.2 + V3(0, water - feet.Y, 0)
			bobPos = target:Lerp(edge, Easing.sineIn(k2)) + V3(sin(t * 11) * 0.5, -0.4 - abs(sin(t * 7)) * 0.25, cos(t * 9) * 0.4)
			curve0 = sin(t * 40) * 0.12
			e.splashT -= dt
			if e.splashT <= 0 then
				e.splashT = 0.2
				Fx.blocks(bobPos + V3(0, 0.4, 0), Color3.fromRGB(150, 210, 255), 4, 9, 0.18, { life = 0.5, up = 2.2, spread = 1.2, gravity = 45 })
				if e.entered or math.random() < 0.3 then Sound.play("Splash", { at = bobPos, volume = 0.35, pitch = 1.5 }) end
			end
			if e.entered then
				Fx.splash(target, 0.7)
				Sound.play("Splash", { at = target, volume = 0.6 })
			end
		end
		tk.PrimaryPart.CFrame = CF(bobPos)
		local low = tk:FindFirstChild("BobberLow") :: BasePart
		low.CFrame = CF(bobPos - V3(0, 0.22, 0))
		local hook = tk:FindFirstChild("Hook") :: BasePart
		local worm = tk:FindFirstChild("HookWorm") :: BasePart
		local hp = hookPos or (bobPos - V3(0, 0.9, 0))
		hook.CFrame = CF(hp)
		worm.CFrame = CF(hp - V3(0, 0.15, 0)) * CFrame.Angles(sin(t * 9) * 0.4, 0, cos(t * 7) * 0.4)
		tk.PrimaryPart.LocalTransparencyModifier = if showBobber then 0 else 1
		worm.LocalTransparencyModifier = if wormOn or phase == "Bait" and x > 1.4 then 0 else 1
		if e.line then
			e.line.CurveSize0 = curve0
			e.line.CurveSize1 = curve0 * 0.3
		end
		-- hook glints at the mouth corner / in the fingers
		if hooked then hook.CFrame = CF(hookPos) * CFrame.Angles(0, t * 0.5, 0.6) end
		if inHand and not e.hookShown then
			e.hookShown = true
			Fx.blocks(hookPos, Color3.fromRGB(200, 200, 210), 2, 4, 0.08, { life = 0.35, up = 1.2, gravity = 30 })
		end
		if not inHand then e.hookShown = false end
	end) elseif e.tackle then
		e.tackle:Destroy()
		e.tackle = nil
		e.line = nil
	end

	-- the fish ----------------------------------------------------------------------------------
	local carryPhase = phase == "Catch" or phase == "Unhook" or phase == "ToBucket" or phase == "Full" or phase == "Drop"
	if near then setFish(e, carryPhase) elseif e.fish then setFish(e, false) end
	if e.fish and e.fish.PrimaryPart then guard(e, function()
		local f = e.fish
		local len = f:GetAttribute("Len") or 1.5
		local hl = if e.handL then e.handL.WorldCFrame else rootCF * CF(-1.3, -0.2, -0.6)
		local hr = if e.handR then e.handR.WorldCFrame else rootCF * CF(1.3, -0.2, -0.6)
		local right = rootCF.RightVector
		-- held by the gills: head up at the hand, body hanging below
		local gills = CF(hl.Position - V3(0, len * 0.42, 0)) * CFrame.Angles(PI / 2, 0, 0) * CFrame.Angles(0, 0, sin(t * 6) * 0.25)
		-- held in both arms, lying across them
		local mid = (hl.Position + hr.Position) / 2 + V3(0, 0.15, 0)
		local arms = CFrame.lookAt(mid, mid + right) * CFrame.Angles(0, 0, sin(t * 5) * 0.12)
		local fcf
		if phase == "Catch" then
			local k2 = Easing.cubicOut(clamp(x / 0.8, 0, 1))
			local fromW = feet + face * 2.4 + V3(0, Layout.WATER_Y - feet.Y, 0)
			local pos = fromW:Lerp(hl.Position, k2) + V3(0, sin(k2 * PI) * 2.6, 0)
			fcf = CF(pos) * CFrame.Angles(t * 6, t * 4, 0)
			f:SetAttribute("Anim", "Flop")
			if e.entered then
				Fx.splash(fromW, 0.75)
				Sound.play("BigSplash", { at = fromW, volume = 0.6 })
			end
		elseif phase == "Unhook" then
			if x < 2.2 then
				-- flopping and BOUNCING on the planks in front of his knees
				local planks = rootCF * CF(0, -HIP_H - c.rootY + Layout.DOCK_TOP_Y - feet.Y + 0.3, -1.6)
				local pinned = clamp((x - 0.7) / 0.25, 0, 1)
				local hop = abs(sin(t * 9)) * (0.55 * (1 - pinned) + 0.08 * pinned)
				local twist = sin(t * 11) * (0.7 * (1 - pinned) + 0.25 * pinned)
				fcf = planks * CF(0, hop, 0) * CFrame.Angles(0, PI / 2 + twist * 0.4, PI / 2 + twist)
				f:SetAttribute("Anim", "Flop")
				if hop < 0.06 and (1 - pinned) > 0.5 and math.random() < 0.15 then
					Sound.play("Flop", { at = fcf.Position, volume = 0.5, pitch = 1.1 + math.random() * 0.3 })
					Fx.blocks(fcf.Position, Color3.fromRGB(160, 210, 255), 2, 5, 0.12, { life = 0.4, up = 1.5, gravity = 40 })
				end
				if x > 1.85 and not e.popped then
					e.popped = true
					Sound.play("Snap", { at = fcf.Position, volume = 0.45, pitch = 2 })
				end
			else
				-- grabbed by the gills and lifted / shown off
				e.popped = false
				local lift = Easing.cubicInOut(clamp((x - 2.2) / 0.35, 0, 1))
				fcf = gills
				f:SetAttribute("Anim", if lift < 1 then "Flop" else "Held")
			end
		elseif phase == "Drop" then
			local rel = 0.8
			local b = F.bucketPos(e.base)
			local bm = e.bucketModel
			local top = if bm then (bm:GetAttribute("Top") or 2) else 2
			local hold = if big then arms else gills
			if x < rel then
				fcf = hold
			else
				-- falls in... and lands ELASTIC: squash / stretch bounce + jelly wobble
				local k2 = clamp((x - rel) / 0.3, 0, 1)
				local into = b + V3(0, top - 0.2, 0)
				local pos = hold.Position:Lerp(into, Easing.quadIn(k2))
				local land = x - rel - 0.3
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
				fcf = CF(pos) * CFrame.Angles(wob * 0.6, PI / 2 + wob * 0.4, PI / 2 * k2 + wob * 0.5)
				f:SetAttribute("Anim", "Flop")
			end
		else
			e.landed = false
			fcf = if big then arms else gills
			f:SetAttribute("Anim", "Held")
		end
		f:PivotTo(fcf)
		-- water dripping off the fish
		e.dripT -= dt
		if e.dripT <= 0 and phase ~= "Drop" then
			e.dripT = 0.18
			Fx.blocks(fcf.Position - V3(0, 0.3, 0), Color3.fromRGB(170, 215, 255), 1, 1, 0.08, { life = 0.6, up = -0.5, spread = 0.2, gravity = 40 })
		end
		e.mouthPos = if e.mouth then e.mouth.WorldPosition else fcf.Position
	end) end
	if phase ~= "Drop" then e.landed = false end

	-- pipe smoke (old salts)
	if e.pipe and near and (phase == "Wait" or phase == "Bait") then
		e.smokeT -= dt
		if e.smokeT <= 0 then
			e.smokeT = 1.6 + math.random()
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
				if not ok then
					e.errs = e.errs or {}
					local key = tostring(err)
					if not e.errs[key] then
						e.errs[key] = true
						warn("[TFB] fisher anim", key)
					end
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
