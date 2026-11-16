--[[ AnimalAnimator: procedural animation for every bear and fish on this client.
     Runs locally (Motor6D.Transform is not replicated), so every player sees fluid
     motion with zero network cost. Each animal is driven by:
       - its velocity (walk / run blend, gait phase, airborne, landing squash)
       - its "Anim" attribute + "AnimT" start time (set by the server: Idle, Look,
         Sniff, Sit, Lie, Sleep, Scratch, Stretch, Happy, Alert, Arrive, Eat,
         Transform, Carried) for the fish: Held, Flop, Eaten, Thrown
     Poses are layered, then every joint is smoothed toward its target (no snapping).
     Distance LOD: far animals update less often, very far animals are skipped. ]]
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Easing = require(ReplicatedStorage.Shared.Util.Easing)

local Animator = {}
local bears = {}
local fishes = {}
local rainbow = {}
local camera = workspace.CurrentCamera
local frame = 0

local sin, cos, abs, clamp, noise = math.sin, math.cos, math.abs, math.clamp, math.noise
local TAU = math.pi * 2
local JOINTS = { "BodyJoint", "Neck", "Jaw", "EarL", "EarR", "LegFL", "LegFR", "LegBL", "LegBR", "Tail" }

local function newPose()
	local p = {}
	for _, j in JOINTS do
		p[j] = { x = 0, y = 0, z = 0, px = 0, py = 0, pz = 0 }
	end
	return p
end

local function registerBear(model: Model)
	if bears[model] then return end
	local motors = {}
	for _, d in model:GetDescendants() do
		if d:IsA("Motor6D") and table.find(JOINTS, d.Name) then
			motors[d.Name] = d
		end
	end
	if not motors.BodyJoint or not motors.Neck then return end
	local lids = {}
	for _, d in model:GetDescendants() do
		if d.Name == "Eyelid" then table.insert(lids, d) end
	end
	local seed = math.random() * 1000
	bears[model] = {
		model = model, root = model.PrimaryPart, motors = motors, lids = lids,
		scale = model:GetAttribute("Scale") or 1, gait = model:GetAttribute("Gait") or 1,
		legLen = model:GetAttribute("HipHeight") or 1.6,
		cur = newPose(), phase = math.random() * TAU, speed = 0, seed = seed,
		blinkAt = os.clock() + 1 + math.random() * 3, blinkUntil = 0, earTwitch = 0, earSide = 1,
		vy = 0, squash = 0, lastPos = model.PrimaryPart and model.PrimaryPart.Position, t = 0,
	}
	model.Destroying:Connect(function() bears[model] = nil end)
end

local function registerFish(model: Model)
	if fishes[model] then return end
	local m = {}
	for _, d in model:GetDescendants() do
		if d:IsA("Motor6D") then m[d.Name] = d end
	end
	if not m.Tail then return end
	fishes[model] = { model = model, motors = m, phase = math.random() * TAU, root = model.PrimaryPart }
	model.Destroying:Connect(function() fishes[model] = nil end)
end

local function register(inst: Instance)
	if not inst:IsA("Model") then return end
	local kind = inst:GetAttribute("Kind")
	if kind == "Bear" then
		task.defer(registerBear, inst)
	elseif kind == "Fish" then
		task.defer(registerFish, inst)
	end
	if inst:GetAttribute("Rainbow") then
		rainbow[inst] = true
		inst.Destroying:Connect(function() rainbow[inst] = nil end)
	end
end

function Animator.track(model: Model)
	register(model)
end

-- set helpers ---------------------------------------------------------------------
local function rot(p, j, x, y, z)
	local q = p[j]
	q.x += x or 0
	q.y += y or 0
	q.z += z or 0
end
local function pos(p, j, x, y, z)
	local q = p[j]
	q.px += x or 0
	q.py += y or 0
	q.pz += z or 0
end

-- per-state pose layers ----------------------------------------------------------
local STATES = {}

STATES.Look = function(p, e, t, s)
	local sweep = sin(t * 1.4) * 0.65
	rot(p, "Neck", 0.12, sweep, sweep * 0.1)
	rot(p, "EarL", -0.2) rot(p, "EarR", -0.2)
end

STATES.Alert = function(p, e, t, s)
	local k = Easing.backOut(clamp(t / 0.35, 0, 1))
	rot(p, "Neck", 0.32 * k, 0, 0)
	pos(p, "BodyJoint", 0, 0.12 * s * k, 0)
	rot(p, "BodyJoint", 0.06 * k)
	rot(p, "LegFL", -0.06 * k) rot(p, "LegFR", -0.06 * k)
	rot(p, "EarL", -0.35 * k, 0, 0.2 * k) rot(p, "EarR", -0.35 * k, 0, -0.2 * k)
	rot(p, "Tail", 0.6 * k)
	-- quick sniff of the air
	rot(p, "Neck", sin(t * 18) * 0.03 * k)
end

STATES.Sniff = function(p, e, t, s)
	local k = Easing.sineInOut(clamp(t / 0.4, 0, 1))
	rot(p, "Neck", -0.62 * k + sin(t * 17) * 0.05, sin(t * 2.1) * 0.25 * k)
	pos(p, "Neck", 0, -0.15 * s * k, -0.2 * s * k)
	rot(p, "BodyJoint", -0.05 * k)
	rot(p, "Jaw", -0.04 - abs(sin(t * 17)) * 0.04)
	rot(p, "EarL", 0.15 * k) rot(p, "EarR", 0.15 * k)
end

STATES.Arrive = function(p, e, t, s)
	local k = Easing.cubicOut(clamp(t / 0.4, 0, 1))
	rot(p, "Neck", -0.35 * k, 0, 0)
	pos(p, "BodyJoint", 0, -0.05 * s * k, 0)
	rot(p, "EarL", -0.2 * k) rot(p, "EarR", -0.2 * k)
end

local function sitPose(p, s, legLen, k)
	rot(p, "BodyJoint", 0.62 * k)
	pos(p, "BodyJoint", 0, -legLen * 0.42 * k, 0.35 * s * k)
	rot(p, "LegFL", -0.55 * k) rot(p, "LegFR", -0.55 * k)
	rot(p, "LegBL", 1.25 * k, 0, -0.18 * k) rot(p, "LegBR", 1.25 * k, 0, 0.18 * k)
	rot(p, "Neck", -0.42 * k)
	rot(p, "Tail", -0.5 * k)
end

STATES.Sit = function(p, e, t, s)
	local k = Easing.cubicInOut(clamp(t / 0.6, 0, 1))
	sitPose(p, s, e.legLen, k)
	rot(p, "Neck", 0, noise(e.seed, t * 0.3) * 0.7 * k, noise(e.seed + 3, t * 0.25) * 0.15 * k)
	-- swaying front paws
	rot(p, "LegFL", sin(t * 0.9) * 0.05 * k) rot(p, "LegFR", -sin(t * 0.9) * 0.05 * k)
end

STATES.Scratch = function(p, e, t, s)
	local k = Easing.cubicInOut(clamp(t / 0.4, 0, 1))
	sitPose(p, s, e.legLen, k)
	-- back leg scratches behind the ear
	local sc = sin(t * 26) * 0.35
	rot(p, "LegBR", (0.6 + sc) * k, 0, 0.5 * k)
	pos(p, "LegBR", 0, 0.4 * s * k, -0.3 * s * k)
	rot(p, "Neck", 0.05 * k, 0.3 * k, 0.4 * k)
	rot(p, "EarR", 0.4 * k)
	rot(p, "Jaw", -0.15 * k)
end

local function liePose(p, s, legLen, k)
	pos(p, "BodyJoint", 0, -legLen * 0.86 * k, 0)
	rot(p, "LegFL", 1.35 * k, 0, -0.1 * k) rot(p, "LegFR", 1.35 * k, 0, 0.1 * k)
	rot(p, "LegBL", -1.35 * k, 0, -0.1 * k) rot(p, "LegBR", -1.35 * k, 0, 0.1 * k)
	pos(p, "LegFL", 0, 0.15 * s * k, 0) pos(p, "LegFR", 0, 0.15 * s * k, 0)
	rot(p, "Tail", -0.3 * k)
end

STATES.Lie = function(p, e, t, s)
	local k = Easing.cubicInOut(clamp(t / 0.8, 0, 1))
	liePose(p, s, e.legLen, k)
	rot(p, "Neck", -0.2 * k, noise(e.seed, t * 0.25) * 0.6 * k, 0)
	pos(p, "BodyJoint", 0, sin(t * 1.3) * 0.03 * s, 0)
end

STATES.Sleep = function(p, e, t, s)
	local k = Easing.cubicInOut(clamp(t / 1.0, 0, 1))
	liePose(p, s, e.legLen, k)
	rot(p, "BodyJoint", 0, 0, 0.16 * k)
	rot(p, "Neck", -0.5 * k, 0.35 * k, 0.25 * k)
	pos(p, "Neck", 0, -0.2 * s * k, 0)
	-- slow deep breathing + occasional ear flick
	pos(p, "BodyJoint", 0, sin(t * 0.9) * 0.06 * s, 0)
	local flick = math.max(0, sin(t * 0.7 + e.seed) - 0.94) * 8
	rot(p, "EarL", flick * 0.5)
	e.eyesClosed = k > 0.6
end

STATES.Stretch = function(p, e, t, s)
	local k = Easing.bump(clamp(t / 2.2, 0, 1))
	rot(p, "BodyJoint", -0.32 * k)
	pos(p, "BodyJoint", 0, -0.2 * s * k, 0)
	rot(p, "LegFL", 0.95 * k) rot(p, "LegFR", 0.95 * k)
	rot(p, "LegBL", -0.2 * k) rot(p, "LegBR", -0.2 * k)
	rot(p, "Neck", 0.35 * k)
	rot(p, "Jaw", -0.5 * Easing.bump(clamp((t - 0.5) / 1.2, 0, 1))) -- big yawn
	rot(p, "Tail", 0.8 * k)
	e.eyesClosed = k > 0.7
end

STATES.Happy = function(p, e, t, s)
	local hop = abs(sin(t * 7.5))
	local k = clamp(t / 0.15, 0, 1)
	pos(p, "BodyJoint", 0, hop * 0.45 * s * k, 0)
	rot(p, "BodyJoint", -0.08 + hop * 0.12, 0, sin(t * 7.5) * 0.08)
	rot(p, "LegFL", -0.4 * hop) rot(p, "LegFR", -0.4 * hop)
	rot(p, "LegBL", 0.35 * hop) rot(p, "LegBR", 0.35 * hop)
	rot(p, "Neck", 0.28, sin(t * 4) * 0.2)
	rot(p, "Jaw", -0.32)
	rot(p, "Tail", 0.5, sin(t * 20) * 0.6)
	rot(p, "EarL", sin(t * 15) * 0.25) rot(p, "EarR", -sin(t * 15) * 0.25)
end

STATES.Eat = function(p, e, t, s)
	-- head goes down, big bite, lifts the fish, chews
	local down = Easing.cubicOut(clamp(t / 0.3, 0, 1))
	local lift = Easing.cubicInOut(clamp((t - 0.45) / 0.35, 0, 1))
	rot(p, "Neck", -0.8 * down + 0.6 * lift)
	pos(p, "Neck", 0, -0.25 * s * down * (1 - lift), -0.35 * s * down * (1 - lift))
	rot(p, "BodyJoint", -0.1 * down * (1 - lift))
	local bite = Easing.bump(clamp((t - 0.12) / 0.3, 0, 1))
	local chew = if t > 0.6 then abs(sin((t - 0.6) * 11)) * 0.28 else 0
	rot(p, "Jaw", -0.55 * bite - chew)
	rot(p, "Neck", 0, 0, if t > 0.6 then sin(t * 5.5) * 0.08 else 0)
	rot(p, "EarL", 0.3 * down) rot(p, "EarR", 0.3 * down)
	rot(p, "Tail", 0, sin(t * 9) * 0.3)
	e.eyesClosed = t > 0.7 and (t % 0.8) < 0.4
end

STATES.Transform = function(p, e, t, s)
	-- rears up on the hind legs, front paws up, then a little spin of joy
	local k = Easing.backOut(clamp(t / 0.5, 0, 1))
	rot(p, "BodyJoint", 0.95 * k)
	pos(p, "BodyJoint", 0, 0.5 * s * k, 0.6 * s * k)
	rot(p, "LegFL", -1.1 * k + sin(t * 12) * 0.25) rot(p, "LegFR", -1.1 * k - sin(t * 12) * 0.25)
	rot(p, "LegBL", -0.9 * k) rot(p, "LegBR", -0.9 * k)
	rot(p, "Neck", -0.6 * k)
	rot(p, "Jaw", -0.35 * k)
	rot(p, "Tail", -0.4 * k)
end

STATES.Carried = function(p, e, t, s)
	local sw = sin(t * 2.2)
	rot(p, "LegFL", 0.35 + sw * 0.25) rot(p, "LegFR", 0.35 - sw * 0.25)
	rot(p, "LegBL", -0.3 - sw * 0.2) rot(p, "LegBR", -0.3 + sw * 0.2)
	rot(p, "Neck", 0.1 + sin(t * 1.3) * 0.08, noise(e.seed, t * 0.5) * 0.8)
	rot(p, "BodyJoint", 0, 0, sin(t * 1.6) * 0.06)
	rot(p, "Tail", 0, sin(t * 8) * 0.4)
	rot(p, "Jaw", -0.12 - abs(sin(t * 1.1)) * 0.08)
end

-- base layer: breathing, idle look-around, blink, ear twitch ---------------------
local function idleLayer(p, e, t, s, still)
	local breathe = sin(t * 1.7 + e.seed)
	pos(p, "BodyJoint", 0, breathe * 0.035 * s, 0)
	rot(p, "BodyJoint", breathe * 0.012)
	if still then
		rot(p, "Neck", noise(e.seed, t * 0.18) * 0.18, noise(e.seed + 10, t * 0.22) * 0.55, noise(e.seed + 20, t * 0.2) * 0.08)
		-- weight shift between paws
		local shift = noise(e.seed + 40, t * 0.15) * 0.06
		rot(p, "LegFL", shift) rot(p, "LegFR", -shift)
		rot(p, "Tail", 0, sin(t * 1.1 + e.seed) * 0.12)
	end
	-- ear twitch impulses
	if e.earTwitch > 0 then
		local tw = sin(e.earTwitch * 30) * e.earTwitch * 1.6
		rot(p, if e.earSide > 0 then "EarR" else "EarL", tw, 0, tw * 0.5 * e.earSide)
	end
end

local function locomotion(p, e, t, s, speed, dt)
	local sNorm = speed / math.max(0.4, s)
	local runK = clamp((sNorm - 9) / 8, 0, 1)
	local walkK = clamp(sNorm / 2.5, 0, 1)
	if walkK <= 0.001 then return 0 end
	local stride = 2.6 * (1 + runK * 0.6)
	local freq = sNorm / stride * e.gait
	e.phase = (e.phase + dt * freq * TAU) % TAU
	local ph = e.phase
	-- walk: 4 beat lateral sequence; run: bounding gallop (pairs) with spine flex
	local amp = (0.42 + runK * 0.35) * walkK
	local walkOff = { LegFL = 0, LegBR = 0.25, LegFR = 0.5, LegBL = 0.75 }
	local runOff = { LegFL = 0, LegFR = 0.08, LegBL = 0.5, LegBR = 0.58 }
	for leg, off in walkOff do
		local o = off * (1 - runK) + runOff[leg] * runK
		local a = ph + o * TAU
		local swing = sin(a)
		local liftAmt = math.max(0, cos(a)) * (0.22 + runK * 0.25) * s * walkK
		rot(p, leg, swing * amp)
		pos(p, leg, 0, liftAmt, 0)
	end
	-- body motion
	local bob = abs(sin(ph)) * (0.05 + runK * 0.22) * s * walkK
	pos(p, "BodyJoint", 0, bob - 0.04 * s * walkK, 0)
	rot(p, "BodyJoint", sin(ph * 2) * 0.015 * walkK + sin(ph) * 0.09 * runK + 0.06 * runK, 0, sin(ph) * 0.05 * (1 - runK) * walkK)
	-- head stabilisation (counter motion) and lean
	rot(p, "Neck", -sin(ph) * 0.07 * runK - 0.05 * walkK, sin(ph) * 0.06 * (1 - runK) * walkK)
	rot(p, "Tail", 0.2 * runK, sin(ph) * 0.3 * walkK)
	rot(p, "EarL", -0.25 * runK) rot(p, "EarR", -0.25 * runK)
	rot(p, "Jaw", -0.12 * runK - abs(sin(ph)) * 0.05 * runK)
	return walkK
end

local function airLayer(p, e, s, vy)
	local k = clamp(abs(vy) / 25, 0, 1)
	rot(p, "LegFL", 0.6 * k) rot(p, "LegFR", 0.6 * k)
	rot(p, "LegBL", -0.65 * k) rot(p, "LegBR", -0.65 * k)
	rot(p, "BodyJoint", clamp(vy / 60, -0.25, 0.25))
	rot(p, "Neck", 0.1 * k)
end

local function updateBear(e, dt, now)
	local model = e.model
	local root = e.root
	if not root or not root.Parent then return end
	local s = e.scale
	e.t += dt
	local t = e.t
	-- velocity: physics velocity (NPCs, players) or measured (carried / anchored)
	local p0 = root.Position
	local v
	if e.lastPos and dt > 0 then
		v = (p0 - e.lastPos) / dt
	else
		v = Vector3.zero
	end
	e.lastPos = p0
	local anim = model:GetAttribute("Anim") or "Idle"
	local carried = anim == "Carried"
	local flat = Vector3.new(v.X, 0, v.Z).Magnitude
	if carried then flat = 0 end
	e.speed += (math.min(flat, 60) - e.speed) * Easing.damp(10, dt)
	-- airborne / landing
	local vy = if carried then 0 else v.Y
	local air = abs(vy) > 7
	if e.wasAir and not air and e.vy < -12 then
		e.squash = 1
	end
	e.wasAir = air
	e.vy = vy
	e.squash = math.max(0, e.squash - dt * 4)

	local animT = now - (model:GetAttribute("AnimT") or 0)
	local p = newPose()
	local moving = locomotion(p, e, t, s, e.speed, dt)
	local stateFn = STATES[anim]
	e.eyesClosed = false
	if stateFn and moving < 0.6 then
		-- state poses fade out while the bear moves
		local w = 1 - moving / 0.6
		local sp = newPose()
		stateFn(sp, e, math.max(0, animT), s)
		for j, q in sp do
			local d = p[j]
			d.x += q.x * w d.y += q.y * w d.z += q.z * w
			d.px += q.px * w d.py += q.py * w d.pz += q.pz * w
		end
	end
	idleLayer(p, e, t, s, moving < 0.2 and (anim == "Idle" or anim == "Walk" or anim == "Run"))
	if air and not carried then airLayer(p, e, s, vy) end
	if e.squash > 0 then
		local q = Easing.bump(1 - e.squash)
		pos(p, "BodyJoint", 0, -0.35 * s * q, 0)
		rot(p, "Neck", -0.15 * q)
	end

	-- ear twitch timer
	e.earTwitch = math.max(0, e.earTwitch - dt * 2.5)
	if math.random() < dt * 0.25 then
		e.earTwitch = 1
		e.earSide = if math.random() < 0.5 then -1 else 1
	end
	-- blink
	if now > e.blinkAt then
		e.blinkUntil = now + 0.13
		e.blinkAt = now + 1.8 + math.random() * 3.5
	end
	local closed = e.eyesClosed or now < e.blinkUntil
	if closed ~= e.lidsClosed then
		e.lidsClosed = closed
		for _, lid in e.lids do lid.Transparency = if closed then 0 else 1 end
	end

	-- smooth toward the target pose and apply
	local k = Easing.damp(14, dt)
	for name, m in e.motors do
		local tgt = p[name]
		local c = e.cur[name]
		c.x += (tgt.x - c.x) * k
		c.y += (tgt.y - c.y) * k
		c.z += (tgt.z - c.z) * k
		c.px += (tgt.px - c.px) * k
		c.py += (tgt.py - c.py) * k
		c.pz += (tgt.pz - c.pz) * k
		m.Transform = CFrame.new(c.px, c.py, c.pz) * CFrame.Angles(c.x, c.y, c.z)
	end
end

local function updateFish(e, dt, now)
	local m = e.motors
	local anim = e.model:GetAttribute("Anim") or "Held"
	local speed, amp = 3, 0.18
	if anim == "Flop" then
		-- violent flops with pauses
		local cyc = (now * 1.3 + e.phase) % 1
		local active = if cyc < 0.45 then 1 else 0.15
		speed, amp = 14, 0.55 * active
	elseif anim == "Eaten" then
		speed, amp = 22, 0.45
	elseif anim == "Thrown" then
		speed, amp = 9, 0.35
	elseif anim == "Swim" then
		speed, amp = 7, 0.32
	elseif anim == "Held" then
		-- calm, with an occasional wiggle burst
		local burst = math.max(0, sin(now * 0.8 + e.phase) - 0.85) * 6.6
		speed, amp = 4 + burst * 10, 0.12 + burst * 0.35
	end
	e.phase += dt * speed
	local a = sin(e.phase)
	if m.Spine then m.Spine.Transform = CFrame.Angles(0, a * amp * 0.45, 0) end
	if m.Tail then m.Tail.Transform = CFrame.Angles(0, sin(e.phase - 0.9) * amp * 1.1, 0) end
	local fin = sin(now * 6 + e.phase) * 0.35
	if m.FinL then m.FinL.Transform = CFrame.Angles(0, -fin, 0) end
	if m.FinR then m.FinR.Transform = CFrame.Angles(0, fin, 0) end
end

function Animator.init()
	for _, d in workspace:GetDescendants() do register(d) end
	workspace.DescendantAdded:Connect(register)
	local rainbowAcc = 0
	RunService.PreSimulation:Connect(function(dt)
		frame += 1
		dt = math.min(dt, 0.1)
		local now = workspace:GetServerTimeNow()
		local camPos = camera.CFrame.Position
		for model, e in bears do
			local root = e.root
			if root and model.Parent then
				local d = (root.Position - camPos).Magnitude
				local every = if d < 90 then 1 elseif d < 200 then 3 else 0
				if every > 0 and (frame + (e.seed // 1)) % every == 0 then
					e.acc = (e.acc or 0) + dt
					updateBear(e, e.acc, now)
					e.acc = 0
				else
					e.acc = (e.acc or 0) + dt
					e.lastPos = root.Position
				end
			end
		end
		for model, e in fishes do
			if model.Parent and e.root and (e.root.Position - camPos).Magnitude < 160 then
				updateFish(e, dt, now)
			end
		end
		rainbowAcc += dt
		if rainbowAcc > 0.08 then
			rainbowAcc = 0
			local h = now * 0.12
			for model in rainbow do
				if model.Parent then
					for _, d in model:GetDescendants() do
						local tt = d:GetAttribute("RainbowT")
						if tt then
							(d :: BasePart).Color = Color3.fromHSV((tt * 0.85 + h) % 1, 0.62, d:GetAttribute("RainbowV") or 1)
						end
					end
				end
			end
		end
	end)
end

Animator._players = Players
return Animator
