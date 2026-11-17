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
local FishConfig = require(ReplicatedStorage.Shared.Config.FishConfig)
local BearConfig = require(ReplicatedStorage.Shared.Config.BearConfig)
local Fx = require(script.Parent.Fx)
local Clock = require(script.Parent.Clock)
local GameConfig = require(ReplicatedStorage.Shared.Config.GameConfig)

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

local function registerBear(model: Model, into: any?)
	into = into or bears
	if into[model] then return into[model] end
	local motors = {}
	for _, d in model:GetDescendants() do
		if d:IsA("Motor6D") and table.find(JOINTS, d.Name) then
			motors[d.Name] = d
		end
	end
	if not motors.BodyJoint or not motors.Neck then
		-- not all streamed in yet: try again when joints arrive
		if not model:GetAttribute("TFBWaitJoints") then
			model:SetAttribute("TFBWaitJoints", true)
			local conn
			conn = model.DescendantAdded:Connect(function(d)
				if d:IsA("Motor6D") then
					local e = registerBear(model, into)
					if e then conn:Disconnect() end
				end
			end)
		end
		return
	end
	local lids = {}
	for _, d in model:GetDescendants() do
		if d.Name == "Eyelid" then table.insert(lids, d) end
	end
	local seed = math.random() * 1000
	into[model] = {
		model = model, root = model.PrimaryPart, motors = motors, lids = lids,
		scale = model:GetAttribute("Scale") or 1, gait = model:GetAttribute("Gait") or 1,
		legLen = model:GetAttribute("HipHeight") or 1.6,
		cur = newPose(), phase = math.random() * TAU, speed = 0, seed = seed,
		blinkAt = os.clock() + 1 + math.random() * 3, blinkUntil = 0, earTwitch = 0, earSide = 1,
		vy = 0, squash = 0, lastPos = model.PrimaryPart and model.PrimaryPart.Position, t = 0,
	}
	-- PERSONALITY from the species: light bears are playful, big ones heavy and proud,
	-- round ones (pandas...) lazy
	local e = into[model]
	local spec = BearConfig.get(model:GetAttribute("Species") or "")
	local g = e.gait
	e.playful = clamp((g - 1.0) / 0.25, 0, 1)
	e.heavy = clamp((1.02 - g) / 0.22, 0, 1)
	e.lazy = if spec and (spec.traits.panda or spec.body.w / spec.body.l > 0.8) then 1 else 0
	-- joints / eyelids that stream in LATE (jaw, ears...) are picked up as they arrive
	model.DescendantAdded:Connect(function(d)
		if d:IsA("Motor6D") and table.find(JOINTS, d.Name) then
			e.motors[d.Name] = d
		elseif d.Name == "Eyelid" and d:IsA("BasePart") then
			table.insert(e.lids, d)
		end
	end)
	model.Destroying:Connect(function() into[model] = nil end)
	return into[model]
end

local function registerFish(model: Model, into: any?)
	into = into or fishes
	if into[model] then return end
	local m = {}
	for _, d in model:GetDescendants() do
		if d:IsA("Motor6D") then m[d.Name] = d end
	end
	if not m.Tail then return end
	into[model] = { model = model, motors = m, phase = math.random() * TAU, root = model.PrimaryPart }
	model.DescendantAdded:Connect(function(d)
		if d:IsA("Motor6D") then m[d.Name] = d end
	end)
	model.Destroying:Connect(function() into[model] = nil end)
	return into[model]
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
	-- CARTOON STARTLE: a tiny flinch down, then the whole bear JOLTS up (front paws off the
	-- ground, ears shoot up, head snaps round), lands, and drops into a coiled "ready to
	-- charge" crouch: head low, shoulders down, rump up, trembling with intent
	local flinch = Easing.bump(clamp(t / 0.1, 0, 1))
	local jolt = Easing.bump(clamp((t - 0.06) / 0.3, 0, 1))
	local ready = Easing.backOut(clamp((t - 0.32) / 0.25, 0, 1))
	local quiver = sin(t * 47) * 0.025 * ready
	pos(p, "BodyJoint", 0, (-0.12 * flinch + 0.55 * jolt - 0.18 * ready) * s, -0.15 * s * ready)
	rot(p, "BodyJoint", 0.5 * jolt - 0.16 * ready + quiver)
	rot(p, "LegFL", -0.9 * jolt + 0.35 * ready) rot(p, "LegFR", -0.75 * jolt + 0.35 * ready)
	rot(p, "LegBL", -0.25 * jolt - 0.3 * ready) rot(p, "LegBR", -0.25 * jolt - 0.3 * ready)
	rot(p, "Neck", 0.55 * jolt - 0.3 * ready + quiver, 0, 0)
	rot(p, "Jaw", -0.35 * jolt - 0.15 * ready)
	rot(p, "EarL", -0.7 * jolt - 0.4 * ready, 0, 0.35 * jolt) rot(p, "EarR", -0.7 * jolt - 0.4 * ready, 0, -0.35 * jolt)
	rot(p, "Tail", 0.9 * jolt + 0.5 * ready, sin(t * 30) * 0.3 * ready)
end

-- nose BOOP times inside the Sniff state (shared with the capture camera)
Animator.BOOPS = { 0.4, 0.85 }
STATES.Sniff = function(p, e, t, s)
	-- head down to the fish, sniffing fast, then two big NOSE BOOPS (the snout jabs forward
	-- and down, the body follows), mouth twitching
	local k = Easing.sineInOut(clamp(t / 0.35, 0, 1))
	local boop = 0
	for _, bt in Animator.BOOPS do
		local u = (t - bt + 0.1) / 0.28
		if u > 0 and u < 1 then
			-- quick wind-back, sharp jab, slow return
			boop += if u < 0.3 then -0.4 * Easing.sineInOut(u / 0.3) else (if u < 0.45 then -0.4 + 1.4 * Easing.cubicOut((u - 0.3) / 0.15) else 1 - Easing.sineInOut((u - 0.45) / 0.55))
		end
	end
	rot(p, "Neck", -0.62 * k - 0.25 * boop + sin(t * 17) * 0.05 * (1 - abs(boop)), sin(t * 2.1) * 0.25 * k * (1 - abs(boop)))
	pos(p, "Neck", 0, (-0.15 * k - 0.12 * boop) * s, (-0.2 * k - 0.55 * boop) * s)
	rot(p, "BodyJoint", -0.05 * k - 0.06 * boop)
	pos(p, "BodyJoint", 0, 0, -0.25 * boop * s)
	rot(p, "Jaw", -0.08 - abs(sin(t * 17)) * 0.08 - 0.35 * math.max(0, boop))
	rot(p, "EarL", 0.15 * k - 0.3 * math.max(0, boop)) rot(p, "EarR", 0.15 * k - 0.3 * math.max(0, boop))
	rot(p, "Tail", 0, sin(t * 6) * 0.3)
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

-- joy in 3 beats: rears up roaring and pawing the air -> drops into two bouncy hops
-- (squash on landing) -> a happy left-right wiggle, then keeps bouncing
STATES.Happy = function(p, e, t, s)
	-- 1) HUGE rear-up roar (crouch first, then up past vertical, paws flailing)
	if t < 0.65 then
		local crouch = Easing.bump(clamp(t / 0.12, 0, 1))
		local k = Easing.backOut(clamp((t - 0.08) / 0.28, 0, 1))
		local paw = sin(t * 26) * 0.45 * k
		pos(p, "BodyJoint", 0, (-0.2 * crouch + 0.75 * k) * s, 0.65 * s * k)
		rot(p, "BodyJoint", -0.12 * crouch + 1.15 * k)
		rot(p, "LegFL", -1.5 * k + paw, 0, 0.35 * k) rot(p, "LegFR", -1.5 * k - paw, 0, -0.35 * k)
		rot(p, "LegBL", -1.05 * k) rot(p, "LegBR", -1.05 * k)
		rot(p, "Neck", -0.7 * k + sin(t * 40) * 0.04 * k, sin(t * 9) * 0.2)
		rot(p, "Jaw", -1.4 * k) -- the roar: jaws all the way open
		rot(p, "EarL", -0.6 * k) rot(p, "EarR", -0.6 * k)
		rot(p, "Tail", 0.9 * k, sin(t * 25) * 0.6)
		return
	end
	local u = t - 0.65
	if u < 1.05 then
		-- 2) three big bouncy hops: stretch in the air, SQUASH on every landing
		local ph = (u / 0.35) % 1
		local air = sin(ph * math.pi)
		local squash = if ph < 0.18 then (1 - ph / 0.18) else 0
		pos(p, "BodyJoint", 0, (air * 1.05 - squash * 0.3) * s, 0)
		rot(p, "BodyJoint", -0.18 + air * 0.3 - squash * 0.12, 0, sin(u * 14) * 0.1)
		rot(p, "LegFL", -0.85 * air + 0.25 * squash) rot(p, "LegFR", -0.85 * air + 0.25 * squash)
		rot(p, "LegBL", 0.75 * air - 0.2 * squash) rot(p, "LegBR", 0.75 * air - 0.2 * squash)
		rot(p, "Neck", 0.4 - squash * 0.35, sin(u * 6) * 0.2)
		rot(p, "Jaw", -0.45 - air * 0.2)
		rot(p, "Tail", 0.8, sin(u * 24) * 0.8)
		rot(p, "EarL", sin(u * 18) * 0.45 - squash * 0.3) rot(p, "EarR", -sin(u * 18) * 0.45 - squash * 0.3)
		return
	end
	local v = u - 1.05
	-- 3) happy wiggle (whole body swings left / right) then little bounces
	local spin = sin(clamp(v / 0.7, 0, 1) * math.pi * 2) * 0.75
	local hop = abs(sin(v * 7.5))
	pos(p, "BodyJoint", 0, hop * 0.5 * s, 0)
	rot(p, "BodyJoint", -0.1 + hop * 0.16, spin, sin(v * 7.5) * 0.12)
	rot(p, "LegFL", -0.5 * hop) rot(p, "LegFR", -0.5 * hop)
	rot(p, "LegBL", 0.45 * hop) rot(p, "LegBR", 0.45 * hop)
	rot(p, "Neck", 0.32, sin(v * 4) * 0.28)
	rot(p, "Jaw", -0.38)
	rot(p, "Tail", 0.6, sin(v * 20) * 0.8)
	rot(p, "EarL", sin(v * 15) * 0.35) rot(p, "EarR", -sin(v * 15) * 0.35)
end

STATES.Eat = function(p, e, t, s)
	-- CARTOON TOSS & CATCH, keyed on the server timeline (GameConfig.Capture):
	--  0.00 head dives at the fish, jaws gaping
	--  0.35 SNATCH + TOSS: the head whips UP and flings the fish high in the air
	--  apex  the bear rears a little, head thrown back, jaws WIDE open toward the sky,
	--        everything in slow motion (slow sway, slow breathing) while the fish falls back
	--  chomp head snaps forward/down with overshoot, jaw shuts hard, body squashes,
	--        violent dog-shake, heavy chewing, then GULP (everything stretches) and a lick
	local G = GameConfig.Capture
	local A, C, W = G.tossApex, G.chompAt, G.swallowAt
	local dive = Easing.cubicOut(clamp(t / 0.28, 0, 1))
	local toss = Easing.backOut(clamp((t - 0.33) / 0.18, 0, 1))
	local waitK = Easing.sineInOut(clamp((t - A) / math.max(0.1, C - 0.15 - A), 0, 1)) -- follows the falling fish down a bit
	local chomp = Easing.expoOut(clamp((t - (C - 0.06)) / 0.1, 0, 1))
	local settle = Easing.cubicInOut(clamp((t - (C + 0.08)) / 0.35, 0, 1))
	local slow = if t > A and t < C then 1 else 0
	local sway = sin(t * 2.2) * 0.05 * slow
	-- head: down -> flung way up -> lowers slightly to catch -> slammed down -> level
	rot(p, "Neck", -0.85 * dive + 1.55 * toss - 0.35 * waitK - 0.95 * chomp + 0.6 * settle + sway, sway * 0.6)
	pos(p, "Neck", 0, (-0.3 * dive + 0.4 * toss - 0.1 * waitK - 0.3 * chomp + 0.3 * settle) * s,
		(-0.4 * dive + 0.25 * toss - 0.45 * chomp + 0.6 * settle) * s)
	-- body: leans in, rears with the toss (stays up while waiting), squashes on the chomp
	rot(p, "BodyJoint", -0.12 * dive + 0.42 * toss - 0.1 * waitK - 0.4 * chomp + 0.2 * settle + sway * 0.4)
	pos(p, "BodyJoint", 0, (0.32 * toss - 0.08 * waitK - 0.4 * chomp + 0.16 * settle) * s, 0)
	rot(p, "LegFL", -0.45 * toss + 0.1 * waitK + 0.35 * chomp) rot(p, "LegFR", -0.45 * toss + 0.1 * waitK + 0.35 * chomp)
	-- jaw: gaping, WIDE open to the sky while the fish falls, shut hard on the chomp
	local open = (0.9 * dive * (1 - toss) + 1.5 * toss) * (1 - chomp)
	local chewing = t > C + 0.06 and t < W
	local ct = t - (C + 0.06)
	local shake = if ct > 0 and ct < 0.22 then sin(ct * 70) * (1 - ct / 0.22) else 0
	local chew = if chewing then abs(sin(ct * 12)) else 0
	local grind = if chewing then sin(ct * 6) else 0
	rot(p, "Jaw", -open - chew * 0.42 - abs(sin(t * 3)) * 0.06 * slow, grind * 0.22, grind * 0.1)
	if chewing then
		rot(p, "Neck", -chew * 0.12, grind * 0.16 + shake * 0.45, grind * 0.14 + shake * 0.3)
		rot(p, "BodyJoint", 0, shake * 0.1, shake * 0.08)
		rot(p, "EarL", -chew * 0.45) rot(p, "EarR", -chew * 0.45)
	end
	-- the swallow: everything stretches up, a big gulp
	local gulp = Easing.bump(clamp((t - W) / 0.45, 0, 1))
	rot(p, "Neck", 0.5 * gulp)
	pos(p, "Neck", 0, 0.22 * s * gulp, 0)
	pos(p, "BodyJoint", 0, 0.14 * s * gulp, 0)
	rot(p, "Jaw", 0.06 * gulp)
	-- satisfied lick (jaw drops twice)
	local lick = Easing.bump(clamp((t - (W + 0.35)) / 0.4, 0, 1))
	rot(p, "Jaw", -0.3 * lick * (0.6 + 0.4 * abs(sin(t * 14))))
	rot(p, "Neck", 0, sin(t * 7) * 0.12 * lick)
	local earsBack = (0.35 * dive * (1 - toss) - 0.5 * toss * (1 - chomp) - 0.5 * chomp * (1 - settle))
	rot(p, "EarL", earsBack) rot(p, "EarR", earsBack)
	rot(p, "Tail", 0.5 * toss * (1 - settle), sin(t * (if slow > 0 then 2.5 else 9)) * (0.3 + 0.5 * gulp))
	e.eyesClosed = (chewing and (ct % 0.32) < 0.14) or gulp > 0.3 or (chomp > 0.5 and settle < 0.2)
end

-- REVEAL (the colours climb the black silhouette): the bear builds up power like a storm,
-- crouching lower and lower, breathing harder and faster, trembling more and more... and at
-- the peak (with the name slam) it EXPLODES into a giant rear-up roar, then crashes back
-- down on its front paws (ground stomp) and holds a proud hero stance.
STATES.Reveal = function(p, e, t, s)
	local G = GameConfig.Capture
	local T = G.revealLimb * 6
	local peak = T + 0.38 -- freeze (0.2) + cut to black (0.16) on the client
	if t < peak then
		local k = clamp(t / T, 0, 1)
		local kk = k * k
		local breath = sin(t * (2.5 + kk * 9))
		local tremble = sin(t * 53) * 0.04 * kk + sin(t * 31) * 0.025 * kk
		pos(p, "BodyJoint", 0, (-0.32 * kk + breath * (0.03 + 0.05 * kk)) * s, 0)
		rot(p, "BodyJoint", -0.1 * kk + tremble, 0, tremble * 0.6)
		rot(p, "LegFL", 0.25 * kk) rot(p, "LegFR", 0.25 * kk)
		rot(p, "LegBL", -0.35 * kk) rot(p, "LegBR", -0.35 * kk)
		rot(p, "Neck", -0.35 * kk + breath * 0.05 + tremble, sin(t * 0.9) * 0.3 * (1 - k))
		rot(p, "Jaw", -0.08 - 0.12 * kk - abs(breath) * 0.08 * kk)
		rot(p, "EarL", -0.55 * kk) rot(p, "EarR", -0.55 * kk)
		rot(p, "Tail", -0.3 * kk)
		e.eyesClosed = k > 0.85
		return
	end
	local u = t - peak
	-- the ROAR: shoots up past vertical (overshoot), paws spread wide, head thrown back
	local up = Easing.backOut(clamp(u / 0.22, 0, 1))
	local down = Easing.quadIn(clamp((u - 0.95) / 0.16, 0, 1)) -- crash back down
	local stomp = if u > 1.11 then Easing.bump(clamp((u - 1.11) / 0.25, 0, 1)) else 0
	local proud = Easing.cubicOut(clamp((u - 1.3) / 0.4, 0, 1))
	local roar = up * (1 - down)
	local shiver = sin(u * 60) * 0.05 * roar * (1 - clamp(u / 0.95, 0, 1))
	if not e.revealStomp and u > 1.11 then
		e.revealStomp = true
		if e.root then Fx.dust(e.root.Position - Vector3.new(0, e.legLen + 0.6 * s, 0) + e.root.CFrame.LookVector * 1.2 * s, 0.9 * s) end
	elseif u < 1 then
		e.revealStomp = nil
	end
	pos(p, "BodyJoint", 0, (0.95 * roar - 0.32 * stomp + 0.08 * proud) * s, 0.75 * s * roar)
	rot(p, "BodyJoint", 1.3 * roar + shiver - 0.18 * stomp + 0.05 * proud)
	rot(p, "LegFL", -1.65 * roar + 0.4 * stomp, 0, 0.5 * roar) rot(p, "LegFR", -1.65 * roar + 0.4 * stomp, 0, -0.5 * roar)
	rot(p, "LegBL", -1.15 * roar - 0.25 * stomp) rot(p, "LegBR", -1.15 * roar - 0.25 * stomp)
	rot(p, "Neck", -0.85 * roar + shiver * 1.5 - 0.3 * stomp + 0.3 * proud, sin(u * 1.4) * 0.12 * proud)
	rot(p, "Jaw", -1.45 * roar - 0.35 * stomp - 0.15 * proud)
	rot(p, "EarL", -0.8 * roar + 0.1 * proud) rot(p, "EarR", -0.8 * roar + 0.1 * proud)
	rot(p, "Tail", 1.0 * roar + 0.4 * proud, sin(u * 22) * 0.5 * roar)
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
	local pl, hv, lz = e.playful or 0, e.heavy or 0, e.lazy or 0
	-- big bears breathe slow and deep, small ones quick
	local breathe = sin(t * (1.7 + pl * 0.9 - hv * 0.5) + e.seed)
	pos(p, "BodyJoint", 0, breathe * (0.035 + hv * 0.025) * s, 0)
	rot(p, "BodyJoint", breathe * 0.012)
	if still then
		local look = 0.18 + pl * 0.12 - lz * 0.08
		local hs = 1 + pl * 0.8 - hv * 0.35 - lz * 0.4 -- how fast the head moves
		rot(p, "Neck", noise(e.seed, t * 0.18 * hs) * look - lz * 0.22 + hv * 0.08, noise(e.seed + 10, t * 0.22 * hs) * (0.55 + pl * 0.3), noise(e.seed + 20, t * 0.2) * (0.08 + pl * 0.1))
		-- weight shift between paws (playful ones fidget and tap a paw)
		local shift = noise(e.seed + 40, t * 0.15 * hs) * 0.06
		rot(p, "LegFL", shift) rot(p, "LegFR", -shift)
		if pl > 0 then
			local tap = math.max(0, sin(t * 3.1 + e.seed) - 0.7) * 2.2 * pl
			rot(p, "LegFR", -tap * 0.4)
			pos(p, "LegFR", 0, tap * 0.12 * s, 0)
		end
		-- proud chest of the big ones, sleepy droop of the lazy ones
		rot(p, "BodyJoint", -hv * 0.05 + lz * 0.04)
		rot(p, "Tail", 0, sin(t * (1.1 + pl * 3) + e.seed) * (0.12 + pl * 0.3))
		if lz > 0 and (t + e.seed) % 9 < 1.4 then e.eyesClosed = true end -- dozes off now and then
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
	-- body motion: heavy bears pound the ground (deep bob, squash on each footfall,
	-- rolling shoulders, spine flexing), light bears bounce
	local hv = e.heavy or 0
	local weight = 1 + hv * 0.8
	local bob = abs(sin(ph)) * (0.05 + runK * 0.22 * weight) * s * walkK
	local footfall = math.max(0, -cos(ph * 2)) ^ 4 * runK * (0.08 + hv * 0.12) * s
	pos(p, "BodyJoint", 0, bob - 0.04 * s * walkK - footfall, runK * sin(ph) * 0.08 * s)
	rot(p, "BodyJoint", sin(ph * 2) * 0.015 * walkK + sin(ph) * (0.09 + hv * 0.06) * runK + 0.06 * runK, sin(ph) * 0.04 * runK * weight, sin(ph) * 0.05 * (1 - runK) * walkK + cos(ph) * 0.07 * runK * weight)
	-- head: stabilised but nodding into each stride, lowered for power
	rot(p, "Neck", -sin(ph) * 0.07 * runK - 0.05 * walkK - 0.12 * runK * hv + footfall * 1.5, sin(ph) * 0.06 * (1 - runK) * walkK)
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

local PLANTED = { Sniff = true, Eat = true, Reveal = true, Happy = true, Transform = true, Alert = true, Arrive = true, Look = true }
-- states driven by a bouncy spring: { speed, damping }
local SPRINGY = { Alert = { 16, 0.78 }, Eat = { 17, 0.8 }, Happy = { 15, 0.74 }, Reveal = { 13, 0.8 }, Transform = { 14, 0.8 }, Sniff = { 15, 0.82 }, Arrive = { 12, 0.9 } }
local AXES = { "x", "y", "z", "px", "py", "pz" }

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
	-- planted moments (eating, sniffing, the reveal...): the bear stands still, so replication
	-- jitter must NOT be read as walking (that used to fade the jaw / head poses out)
	local planted = PLANTED[anim] == true
	local flat = Vector3.new(v.X, 0, v.Z).Magnitude
	if carried or planted then
		flat = 0
		e.speed = 0
	end
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

	-- smooth toward the target pose and apply. The big cartoon moments use an under-damped
	-- SPRING (overshoot and wobble, like a squash-and-stretch animator would key it);
	-- everything else keeps the calm critically-smoothed blend.
	if SPRINGY[anim] and moving < 0.3 then
		local sp = SPRINGY[anim]
		e.vel = e.vel or newPose()
		local steps = math.max(1, math.ceil(dt * 120))
		local h = dt / steps
		local w2, d2 = sp[1] * sp[1], 2 * sp[2] * sp[1]
		for name, m in e.motors do
			local tgt, c, vv = p[name], e.cur[name], e.vel[name]
			for _ = 1, steps do
				for _, f in AXES do
					vv[f] += ((tgt[f] - c[f]) * w2 - vv[f] * d2) * h
					c[f] += vv[f] * h
				end
			end
			m.Transform = CFrame.new(c.px, c.py, c.pz) * CFrame.Angles(c.x, c.y, c.z)
		end
		return
	end
	if e.vel then
		for _, vv in e.vel do vv.x, vv.y, vv.z, vv.px, vv.py, vv.pz = 0, 0, 0, 0, 0, 0 end
	end
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
		-- panicked flops with short pauses, and it never stops shivering
		local cyc = (now * 1.6 + e.phase) % 1
		local active = if cyc < 0.55 then 1 else 0.25
		speed, amp = 16, 0.6 * active
		e.shiver = 0.06
	elseif anim == "Leap" then
		speed, amp = 18, 0.6
		e.shiver = 0
	elseif anim == "Eaten" then
		speed, amp = 22, 0.45
	elseif anim == "Thrown" then
		-- big S-bends in the air, fins flared; the thrower drives "FlyPanic" (0 stiff arrow /
		-- frozen apex .. 1 frantic fall) so the body acting follows the flight beats
		local panic = e.model:GetAttribute("FlyPanic") or 0.6
		speed, amp = 6 + 14 * panic, 0.15 + 0.6 * panic
		e.flare = 1 + 1.2 * panic
	elseif anim == "Swim" then
		speed, amp = 7, 0.32
	elseif anim == "Held" then
		-- calm, with an occasional wiggle burst
		local burst = math.max(0, sin(now * 0.8 + e.phase) - 0.85) * 6.6
		speed, amp = 4 + burst * 10, 0.12 + burst * 0.35
	end
	if e.ui then
		-- living thumbnail: species tempo / amplitude, small fish dart now and then
		local burst = if e.ui.darty then math.max(0, sin(now * 0.9 + e.ui.seed) - 0.82) * 5.5 else 0
		speed = (e.ui.tempoNow or e.ui.tempo) * (1 + burst * 1.4)
		amp = e.ui.amp * (1 + burst * 0.8)
	end
	e.phase += dt * speed
	local a = sin(e.phase)
	local style = e.style
	if style == nil then
		style = e.model:GetAttribute("SwimStyle") or ""
		e.style = style
	end
	if style == "Flap" then
		-- rays: wings beat up and down in a travelling wave, tail whips behind
		local wing = sin(e.phase * 0.55) * (0.35 + amp)
		if m.FinL then m.FinL.Transform = CFrame.Angles(0, 0, -wing) end
		if m.FinR then m.FinR.Transform = CFrame.Angles(0, 0, wing) end
		if m.Spine then m.Spine.Transform = CFrame.Angles(sin(e.phase * 0.55 - 0.8) * amp * 0.3, 0, 0) end
		if m.Tail then m.Tail.Transform = CFrame.Angles(sin(e.phase * 0.55 - 1.6) * amp * 0.6, sin(e.phase * 0.3) * amp * 0.8, 0) end
		return
	elseif style == "Upright" then
		-- seahorse: body bobs, tail curls and uncurls, tiny fins buzz
		if m.Spine then m.Spine.Transform = CFrame.Angles(a * amp * 0.25, 0, 0) end
		if m.Tail then m.Tail.Transform = CFrame.Angles(sin(e.phase - 0.9) * amp * 0.9, 0, 0) end
		local buzz = sin(now * 30 + e.phase) * 0.5
		if m.FinL then m.FinL.Transform = CFrame.Angles(0, -buzz, 0) end
		if m.FinR then m.FinR.Transform = CFrame.Angles(0, buzz, 0) end
		return
	end
	local shiver = if anim == "Flop" then sin(now * 70 + e.phase) * 0.06 else 0
	if m.Spine then m.Spine.Transform = CFrame.Angles(0, a * amp * 0.45 + shiver, 0) end
	if m.Tail then m.Tail.Transform = CFrame.Angles(0, sin(e.phase - 0.9) * amp * 1.1 + shiver * 1.5, 0) end
	local fin = sin(now * (if anim == "Thrown" then 14 else 6) + e.phase) * 0.35 * (if anim == "Thrown" then 1.8 else 1)
	if m.FinL then m.FinL.Transform = CFrame.Angles(0, -fin, 0) end
	if m.FinR then m.FinR.Transform = CFrame.Angles(0, fin, 0) end
end

------------------------------------------------------------------------------------------
-- living 3D thumbnails (ViewportFrames): fish swim in place with their species' own
-- rhythm, bears go through their own idle life (look, sniff, sit, scratch, stretch...)
------------------------------------------------------------------------------------------
local uiBears, uiFish = {}, {}

local function swimParams(id: string?)
	local spec = id and FishConfig.get(id)
	local look = spec and spec.look or {}
	local L, H = look.length or 2.5, look.height or 0.9
	local slender = L / math.max(0.3, H)
	local p = {
		tempo = math.clamp(9.2 - L * 1.15, 3.2, 8.8), -- small fish beat fast, sharks slowly
		amp = 0.15 + math.clamp((slender - 2.2) * 0.03, 0, 0.14),
		sway = 0.22, bob = 0.05 + H * 0.04, roll = 0.05, darty = L < 2.3, seed = math.random() * 50,
	}
	local n = look.profile and #look.profile or 8
	if n >= 12 then p.amp = 0.34 p.tempo = 4.6 p.sway = 0.35 end -- eels / oarfish: big S-waves
	if look.special == "puffer" then p.tempo = 11 p.amp = 0.07 p.bob = 0.12 p.sway = 0.12 p.darty = false end
	if look.special == "ray" then p.tempo = 3.4 p.amp = 0.25 p.bob = 0.1 p.roll = 0.12 end
	if look.special == "seahorse" then p.tempo = 3 p.amp = 0.3 p.bob = 0.16 p.sway = 0.08 p.roll = 0.02 end
	if look.shark then p.tempo = 3.4 p.amp = 0.2 p.sway = 0.3 p.darty = false end
	return p
end

local IDLE_UI = {
	{ "Idle", 26 }, { "Look", 22 }, { "Sniff", 12 }, { "Scratch", 8 }, { "Stretch", 7 }, { "Sit", 11 }, { "Happy", 6 }, { "Lie", 5 },
}

function Animator.trackUI(model: Model, vp: ViewportFrame, kind: string, id: string?)
	if kind == "Bear" then
		local e = registerBear(model, uiBears)
		if not e then return end
		e.vp = vp
		e.nextIdle = os.clock() + 0.5 + math.random() * 2
		-- personality: light / young bears are livelier, heavy ones calmer
		e.lively = math.clamp(e.gait, 0.75, 1.3)
		model:SetAttribute("Anim", "Idle")
	elseif kind == "Fish" then
		local e = registerFish(model, uiFish)
		if not e then return end
		e.vp = vp
		e.ui = swimParams(id)
		e.base = model:GetPivot()
		e.t = math.random() * 10
		model:SetAttribute("Anim", "Swim")
	end
end

-- a thumbnail is animated only while it is really on screen
local function shown(vp: GuiObject?): boolean
	if not vp or not vp.Parent or vp.AbsoluteSize.X < 2 then return false end
	local o: Instance? = vp
	while o do
		if o:IsA("GuiObject") and not o.Visible then return false end
		if o:IsA("LayerCollector") then return (o :: any).Enabled ~= false end
		o = o.Parent
	end
	return false
end

local function updateUI(dt: number, now: number)
	for model, e in uiBears do
		if model.Parent and shown(e.vp) then
			local c = os.clock()
			if c >= e.nextIdle then
				local total = 0
				local function weight(name: string, base: number): number
					local m = 1
					if name == "Happy" or name == "Look" then m *= e.lively * (1 + (e.playful or 0)) end
					if name == "Sit" or name == "Lie" then m *= (1 + (e.lazy or 0) * 2.5) / e.lively end
					if name == "Stretch" or name == "Idle" then m *= 1 + (e.heavy or 0) end
					return base * m
				end
				for _, w in IDLE_UI do total += weight(w[1], w[2]) end
				local roll = math.random() * total
				local pick = "Idle"
				for _, w in IDLE_UI do
					roll -= weight(w[1], w[2])
					if roll <= 0 then pick = w[1] break end
				end
				model:SetAttribute("Anim", pick)
				model:SetAttribute("AnimT", now)
				local hold = if pick == "Sit" or pick == "Lie" then 4 + math.random() * 3 else 2 + math.random() * 2.5
				e.nextIdle = c + hold / e.lively
			end
			updateBear(e, dt, now)
		end
	end
	for model, e in uiFish do
		if model.Parent and shown(e.vp) then
			local u = e.ui
			e.t += dt
			local t = e.t
			-- little life events: a turn, a startled dart, a rise or dive, a hover
			u.nextEvent = u.nextEvent or (t + 1 + math.random() * 2)
			if t >= u.nextEvent then
				u.nextEvent = t + 1.2 + math.random() * 2.8
				local roll = math.random()
				if roll < 0.3 then
					u.turnTo = (math.random() - 0.5) * 1.1
				elseif roll < 0.55 and u.darty ~= false then
					u.dart = 1
				elseif roll < 0.8 then
					u.pitchTo = (math.random() - 0.5) * 0.4
				else
					u.hover = 1.2
				end
			end
			u.turn = (u.turn or 0) + ((u.turnTo or 0) - (u.turn or 0)) * math.min(1, dt * 2)
			u.pitch = (u.pitch or 0) + ((u.pitchTo or 0) - (u.pitch or 0)) * math.min(1, dt * 1.5)
			u.dart = math.max(0, (u.dart or 0) - dt * 2.2)
			u.hover = math.max(0, (u.hover or 0) - dt)
			if u.dart > 0.95 then u.pitchTo = 0 end
			local dartKick = math.sin(u.dart * math.pi) * 0.25
			local yaw = math.noise(u.seed, t * 0.35) * u.sway * 2 + u.turn + math.sin(t * 40) * u.dart * 0.12
			local off = CFrame.new(0, sin(t * 1.3 + u.seed) * u.bob + u.pitch * 0.3, -dartKick)
				* CFrame.Angles(sin(t * 0.9) * 0.05 + u.pitch, yaw, sin(t * 1.7 + u.seed) * u.roll)
			model:PivotTo(e.base * off)
			-- tail beats faster when darting, slower while hovering
			u.tempoNow = u.tempo * (1 + u.dart * 2.5) * (if u.hover > 0 then 0.45 else 1)
			updateFish(e, dt, now)
		end
	end
end

function Animator.init()
	for _, d in workspace:GetDescendants() do register(d) end
	workspace.DescendantAdded:Connect(register)
	local rainbowAcc = 0
	RunService.PreSimulation:Connect(function(dt)
		frame += 1
		dt = math.min(dt, 0.1)
		local now = Clock.now()
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
		updateUI(dt, now)
		rainbowAcc += dt
		if rainbowAcc > 0.08 then
			rainbowAcc = 0
			local h = now * 0.12
			for model in rainbow do
				if model.Parent and not model:GetAttribute("Silhouette") then
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
