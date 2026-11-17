--[[ HumanPose: full-body code-driven animation for EVERY player (R15 full body, R6 arms + neck),
     layered over the default avatar animations and driven by replicated attributes:
       Pose  = RodIdle | Cast | Bite | Reel | Catch | HoldFish | ThrowCharge | Throw | CarryBear | Lift
       PoseT = server time the pose started
     Every action is keyframed like a real animation (anticipation -> action -> follow-through
     -> settle) on arms, elbows, torso twist / lean, head, hips, knees and pelvis height.
     Each channel is driven by an under-damped spring, which gives natural overshoot and
     secondary motion. Legs and pelvis fade out while the player walks (the run cycle wins). ]]
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Easing = require(ReplicatedStorage.Shared.Util.Easing)
local FishBuilder = require(ReplicatedStorage.Shared.Models.FishBuilder)
local E = require(ReplicatedStorage.Shared.Config.EconomyConfig)

local HumanPose = {}
local rigs = {}
local sin, cos, clamp, abs = math.sin, math.cos, math.clamp, math.abs
local V3 = Vector3.new

HumanPose.localPose = nil
HumanPose.localPoseT = 0
HumanPose.charge = 0 -- 0..1 throw charge (own character)
HumanPose.tension = nil -- 0..1 reel tension (own character, set by the reel game)

-- channels: RS/LS arms (x forward raise, y twist, z outward), RE/LE elbows,
-- W waist (x lean back, y twist left, z roll), N neck, RH/LH hips (x forward), RK/LK knees (x bend),
-- P pelvis (y height offset, x pitch)
local CHANNELS = { "RS", "LS", "RE", "LE", "W", "N", "RH", "LH", "RK", "LK", "P" }
local function zero()
	return { RS = Vector3.zero, LS = Vector3.zero, RE = Vector3.zero, LE = Vector3.zero, W = Vector3.zero, N = Vector3.zero,
		RH = Vector3.zero, LH = Vector3.zero, RK = Vector3.zero, LK = Vector3.zero, P = Vector3.zero }
end

-- keyframe interpolation: keys = { {time, value, easeFn?}, ... } (value: number or Vector3)
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

------------------------------------------------------------------------------------------
-- poses (each returns a full target table)
------------------------------------------------------------------------------------------
local P = {}

local function fishingStance(o, now)
	-- relaxed angler stance: rod forward-up in the right hand, left hand on the reel,
	-- slight knee bend, weight on the back foot, breathing, rod tip bobbing
	local br = sin(now * 1.6)
	o.RS = V3(0.95 + br * 0.03, 0.05, 0.08)
	o.RE = V3(0.5 + br * 0.03, 0, 0)
	o.LS = V3(0.6, -0.15, 0.32)
	o.LE = V3(0.95, 0, 0)
	o.W = V3(0.04 + br * 0.015, -0.12, 0)
	o.N = V3(-0.12, 0.05 + sin(now * 0.4) * 0.12, 0)
	o.RH = V3(-0.08, 0, 0)
	o.LH = V3(0.18, 0, 0)
	o.RK = V3(-0.18, 0, 0)
	o.LK = V3(-0.1, 0, 0)
	o.P = V3(-0.06 + br * 0.015, 0, 0)
	return o
end

function P.RodIdle(o, t, now)
	fishingStance(o, now)
	-- every few seconds: check the line (small rod tug + look)
	local c = (now * 0.33) % 1
	if c > 0.85 then
		local k = Easing.bump((c - 0.85) / 0.15)
		o.RS += V3(0.35 * k, 0, 0)
		o.RE += V3(0.25 * k, 0, 0)
		o.N += V3(0.12 * k, -0.15 * k, 0)
	end
	return o
end

-- the cast: crouch + twist + rod over the shoulder (anticipation), explosive whip forward,
-- step onto the front foot, follow-through past the target, settle back into the stance
function P.Cast(o, t, now)
	local up = Easing.cubicOut
	local whip = Easing.backOut
	o.RS = V3(
		kf(t, { { 0, 0.95 }, { 0.32, 3.15, up }, { 0.42, 3.25 }, { 0.56, 0.45, Easing.expoOut }, { 0.75, 0.55 }, { 1.15, 0.95 } }),
		kf(t, { { 0, 0 }, { 0.32, -0.35, up }, { 0.56, 0.25, whip }, { 1.15, 0.05 } }),
		kf(t, { { 0, 0.08 }, { 0.32, 0.3 }, { 0.56, 0.05 }, { 1.15, 0.08 } }))
	o.RE = V3(kf(t, { { 0, 0.5 }, { 0.32, 1.25, up }, { 0.48, 0.15, Easing.expoOut }, { 1.15, 0.5 } }), 0, 0)
	o.LS = V3(kf(t, { { 0, 0.6 }, { 0.32, 1.35 }, { 0.56, 0.35, whip }, { 1.15, 0.6 } }), 0, kf(t, { { 0, 0.32 }, { 0.32, 0.6 }, { 0.56, 0.2 }, { 1.15, 0.32 } }))
	o.LE = V3(kf(t, { { 0, 0.95 }, { 0.32, 0.6 }, { 0.56, 1.2 }, { 1.15, 0.95 } }), 0, 0)
	-- torso: coil right + lean back, then uncoil hard to the left and fold forward
	o.W = V3(
		kf(t, { { 0, 0.04 }, { 0.32, 0.28, up }, { 0.5, -0.32, Easing.expoOut }, { 0.75, -0.18 }, { 1.15, 0.04 } }),
		kf(t, { { 0, -0.12 }, { 0.32, -0.55, up }, { 0.5, 0.35, Easing.expoOut }, { 0.8, 0.12 }, { 1.15, -0.12 } }),
		kf(t, { { 0, 0 }, { 0.32, 0.08 }, { 0.5, -0.08 }, { 1.15, 0 } }))
	-- head watches the rod tip go up, then follows the bobber out over the water
	o.N = V3(kf(t, { { 0, -0.12 }, { 0.3, 0.3 }, { 0.55, -0.15 }, { 0.9, -0.28 }, { 1.15, -0.12 } }),
		kf(t, { { 0, 0.05 }, { 0.3, 0.35 }, { 0.55, -0.15 }, { 1.15, 0.05 } }), 0)
	-- legs: sit into the back leg, then step / push onto the front leg
	o.RK = V3(kf(t, { { 0, -0.18 }, { 0.32, -0.55 }, { 0.5, -0.15 }, { 1.15, -0.18 } }), 0, 0)
	o.LK = V3(kf(t, { { 0, -0.1 }, { 0.32, -0.25 }, { 0.5, -0.45 }, { 0.8, -0.25 }, { 1.15, -0.1 } }), 0, 0)
	o.RH = V3(kf(t, { { 0, -0.08 }, { 0.32, 0.22 }, { 0.5, -0.3 }, { 1.15, -0.08 } }), 0, 0)
	o.LH = V3(kf(t, { { 0, 0.18 }, { 0.32, 0.35 }, { 0.5, 0.45 }, { 1.15, 0.18 } }), 0, 0)
	o.P = V3(kf(t, { { 0, -0.06 }, { 0.32, -0.32, up }, { 0.5, -0.12, Easing.expoOut }, { 1.15, -0.06 } }), 0, 0)
	if t > 1.15 then fishingStance(o, now) end
	return o
end

-- the bite: a sharp startled jerk back on the rod
function P.Bite(o, t, now)
	fishingStance(o, now)
	local jerk = Easing.bump(clamp(t / 0.32, 0, 1))
	local shake = sin(now * 38) * 0.05
	o.RS += V3(0.85 * jerk + shake, 0, 0)
	o.RE += V3(0.55 * jerk, 0, 0)
	o.LS += V3(0.5 * jerk, 0, 0)
	o.W += V3(0.22 * jerk, 0, 0)
	o.N += V3(0.2 * jerk, 0, 0)
	o.P += V3(0.12 * jerk, 0, 0)
	return o
end

-- the fight: braced stance, rocking back with the tension, left hand cranking,
-- rod hand fighting, body twisting with the fish's pulls
function P.Reel(o, t, now, char)
	local tension = if char == Players.LocalPlayer.Character and HumanPose.tension then HumanPose.tension else 0.45 + sin(now * 2.3) * 0.25
	local crank = now * (9 + tension * 6)
	local fight = sin(now * 3.1) * (0.08 + tension * 0.12)
	local pull = sin(now * 1.7)
	o.RS = V3(1.35 + tension * 0.45 + fight, 0.1 + pull * 0.08, 0.06)
	o.RE = V3(0.35 + tension * 0.25, 0, 0)
	o.LS = V3(0.75 + sin(crank) * 0.3, 0, 0.3 + cos(crank) * 0.2)
	o.LE = V3(1.05 + cos(crank) * 0.25, 0, 0)
	o.W = V3(0.18 + tension * 0.22 + fight * 0.5, -0.1 + pull * 0.15, pull * 0.05)
	o.N = V3(-0.2 + tension * 0.1, -0.05 + pull * 0.1, 0)
	o.RH = V3(-0.25, 0, 0)
	o.LH = V3(0.4, 0, 0)
	o.RK = V3(-0.55 - tension * 0.2, 0, 0)
	o.LK = V3(-0.35, 0, 0)
	o.P = V3(-0.22 - tension * 0.12 + abs(sin(crank * 0.5)) * 0.03, 0, 0)
	return o
end

-- the catch: one huge heave (rod up high, lean right back) then arms up in victory
function P.Catch(o, t, now)
	local heave = Easing.backOut(clamp(t / 0.3, 0, 1))
	local cheer = Easing.backOut(clamp((t - 0.45) / 0.35, 0, 1))
	local settle = Easing.sineInOut(clamp((t - 1.3) / 0.4, 0, 1))
	fishingStance(o, now)
	o.RS = V3(0.95 + 1.9 * heave + 0.3 * cheer, 0, 0.08 + 0.25 * cheer):Lerp(o.RS, settle)
	o.RE = V3(0.5 - 0.35 * heave, 0, 0):Lerp(o.RE, settle)
	o.LS = V3(0.6 + 2.3 * cheer, 0, 0.32 + 0.35 * cheer + sin(now * 14) * 0.08 * cheer):Lerp(o.LS, settle)
	o.LE = V3(0.95 - 0.7 * cheer, 0, 0):Lerp(o.LE, settle)
	o.W = V3(0.35 * heave * (1 - cheer) + 0.12 * cheer, 0, sin(now * 7) * 0.06 * cheer):Lerp(o.W, settle)
	o.N = V3(0.35 * heave, 0, 0):Lerp(o.N, settle)
	o.P = V3(-0.3 * heave * (1 - cheer) + abs(sin(now * 8)) * 0.12 * cheer, 0, 0):Lerp(o.P, settle)
	o.RK = V3(-0.6 * heave * (1 - cheer), 0, 0):Lerp(o.RK, settle)
	return o
end

function P.HoldFish(o, t, now)
	local br = sin(now * 1.6)
	o.RS = V3(1.15 + br * 0.04, 0, -0.38)
	o.LS = V3(1.15 - br * 0.04, 0, -0.38)
	o.RE = V3(0.75, 0, 0)
	o.LE = V3(0.75, 0, 0)
	o.W = V3(0.06, 0, sin(now * 1.1) * 0.03)
	o.N = V3(-0.15, 0, 0)
	return o
end

-- throw wind-up: coil the whole body, fish pulled back behind the head, back leg loaded;
-- the coil deepens with the charge and trembles at full power
function P.ThrowCharge(o, t, now, char)
	local c = if char == Players.LocalPlayer.Character then HumanPose.charge else clamp(t / 1.4, 0, 1)
	local enter = Easing.backOut(clamp(t / 0.3, 0, 1))
	local tremble = if c >= 0.99 then sin(now * 55) * 0.05 else sin(now * 20) * 0.01 * c
	local arm = 2.75 + c * 0.6
	o.RS = V3(arm * enter + tremble, -0.15 * c, 0.15)
	o.LS = V3(arm * enter - tremble, 0.15 * c, 0.15)
	o.RE = V3(0.5 + c * 0.8, 0, 0)
	o.LE = V3(0.5 + c * 0.8, 0, 0)
	o.W = V3(0.12 + c * 0.38, -0.25 - c * 0.45, 0.05 * c)
	o.N = V3(-0.05 - c * 0.15, 0.25 + c * 0.35, 0)
	o.RH = V3(-0.15 - c * 0.2, 0, 0)
	o.LH = V3(0.25 + c * 0.35, 0, 0)
	o.RK = V3(-0.3 - c * 0.55, 0, 0)
	o.LK = V3(-0.2 - c * 0.25, 0, 0)
	o.P = V3(-0.12 - c * 0.3 + tremble * 0.5, 0, 0)
	return o
end

-- release: explosive uncoil, arms whip over and down past the body, weight crashes onto the
-- front leg, back leg kicks up, long follow-through, then recover
function P.Throw(o, t, now)
	local fast = Easing.expoOut
	o.RS = V3(kf(t, { { 0, 3.35 }, { 0.14, 0.2, fast }, { 0.3, -0.25 }, { 0.75, -0.1 }, { 1.2, 0 } }), 0, kf(t, { { 0, 0.15 }, { 0.14, 0.3 }, { 1.2, 0 } }))
	o.LS = V3(kf(t, { { 0, 3.35 }, { 0.16, 0.5, fast }, { 0.32, 0.1 }, { 1.2, 0 } }), 0, kf(t, { { 0, 0.15 }, { 0.16, 0.35 }, { 1.2, 0 } }))
	o.RE = V3(kf(t, { { 0, 1.3 }, { 0.1, 0.05, fast }, { 0.5, 0.25 }, { 1.2, 0 } }), 0, 0)
	o.LE = V3(kf(t, { { 0, 1.3 }, { 0.12, 0.1, fast }, { 0.5, 0.3 }, { 1.2, 0 } }), 0, 0)
	o.W = V3(kf(t, { { 0, 0.5 }, { 0.14, -0.45, fast }, { 0.45, -0.3 }, { 1.2, 0 } }),
		kf(t, { { 0, -0.7 }, { 0.14, 0.55, fast }, { 0.45, 0.3 }, { 1.2, 0 } }),
		kf(t, { { 0, 0.05 }, { 0.14, -0.1 }, { 1.2, 0 } }))
	o.N = V3(kf(t, { { 0, -0.2 }, { 0.14, 0.15 }, { 0.5, 0.1 }, { 1.2, 0 } }), kf(t, { { 0, 0.6 }, { 0.14, -0.3 }, { 1.2, 0 } }), 0)
	o.RH = V3(kf(t, { { 0, -0.35 }, { 0.14, -0.55, fast }, { 0.45, -0.4 }, { 1.2, 0 } }), 0, 0)
	o.RK = V3(kf(t, { { 0, -0.85 }, { 0.14, -0.95 }, { 0.45, -0.5 }, { 1.2, 0 } }), 0, 0)
	o.LH = V3(kf(t, { { 0, 0.6 }, { 0.14, 0.35 }, { 0.45, 0.3 }, { 1.2, 0 } }), 0, 0)
	o.LK = V3(kf(t, { { 0, -0.45 }, { 0.14, -0.55 }, { 0.45, -0.3 }, { 1.2, 0 } }), 0, 0)
	o.P = V3(kf(t, { { 0, -0.42 }, { 0.14, -0.2, fast }, { 0.45, -0.15 }, { 1.2, 0 } }), 0, 0)
	return o
end

function P.CarryBear(o, t, now)
	local br = sin(now * 2)
	o.RS = V3(2.95 + br * 0.04, 0, 0.32)
	o.LS = V3(2.95 - br * 0.04, 0, 0.32)
	o.RE = V3(0.35, 0, 0)
	o.LE = V3(0.35, 0, 0)
	o.W = V3(0.06 + br * 0.03, 0, 0)
	o.N = V3(0.1, 0, 0)
	return o
end

-- training reps: squat with the fish at the chest, drive up and press it overhead
function P.Lift(o, t, now)
	local rep = (t % E.Strength.repTime) / E.Strength.repTime
	local press = Easing.sineInOut(if rep < 0.5 then rep * 2 else (1 - rep) * 2)
	local a = 1.35 + press * 1.75
	o.RS = V3(a, 0, -0.2 + press * 0.3)
	o.LS = V3(a, 0, -0.2 + press * 0.3)
	o.RE = V3(1.3 - press * 1.0, 0, 0)
	o.LE = V3(1.3 - press * 1.0, 0, 0)
	o.W = V3(-0.08 + press * 0.14, 0, 0)
	o.N = V3(press * 0.25, 0, 0)
	local squat = 1 - press
	o.RH = V3(0.55 * squat, 0, 0.08)
	o.LH = V3(0.55 * squat, 0, -0.08)
	o.RK = V3(-1.0 * squat, 0, 0)
	o.LK = V3(-1.0 * squat, 0, 0)
	o.P = V3(-0.28 * squat, 0, 0)
	return o
end

------------------------------------------------------------------------------------------
-- rig access
------------------------------------------------------------------------------------------
local function joints(char: Model)
	local r = rigs[char]
	if r then return r end
	local function m(part, name)
		local p = char:FindFirstChild(part)
		return p and p:FindFirstChild(name)
	end
	local r15 = char:FindFirstChild("UpperTorso") ~= nil
	if r15 then
		r = {
			r15 = true,
			RS = m("RightUpperArm", "RightShoulder"), LS = m("LeftUpperArm", "LeftShoulder"),
			RE = m("RightLowerArm", "RightElbow"), LE = m("LeftLowerArm", "LeftElbow"),
			W = m("UpperTorso", "Waist"), N = m("Head", "Neck"),
			RH = m("RightUpperLeg", "RightHip"), LH = m("LeftUpperLeg", "LeftHip"),
			RK = m("RightLowerLeg", "RightKnee"), LK = m("LeftLowerLeg", "LeftKnee"),
			P = m("LowerTorso", "Root"),
		}
	else
		r = { r15 = false, RS = m("Torso", "Right Shoulder"), LS = m("Torso", "Left Shoulder"), N = m("Torso", "Neck") }
	end
	r.w = 0
	r.leg = 1
	r.springs = {}
	for _, ch in CHANNELS do
		r.springs[ch] = { pos = Vector3.zero, vel = Vector3.zero }
	end
	rigs[char] = r
	char.Destroying:Connect(function() rigs[char] = nil end)
	return r
end

-- under-damped spring step (natural overshoot / follow-through)
local function stepSpring(s, target: Vector3, dt: number, speed: number, damping: number)
	local steps = math.max(1, math.ceil(dt / (1 / 120)))
	local h = dt / steps
	for _ = 1, steps do
		local acc = (target - s.pos) * (speed * speed) - s.vel * (2 * damping * speed)
		s.vel += acc * h
		s.pos += s.vel * h
	end
	return s.pos
end

local function armCF(v: Vector3, right: boolean, r15: boolean): CFrame
	if r15 then
		return CFrame.Angles(v.X, if right then v.Y else -v.Y, if right then v.Z else -v.Z)
	end
	return if right then CFrame.Angles(0, 0, v.X) else CFrame.Angles(0, 0, -v.X)
end

-- local training fish dumbbell
local function trainingFish(char: Model, on: boolean)
	local existing = char:FindFirstChild("TFBTrainFish")
	if on and not existing then
		local hand = char:FindFirstChild("RightHand") or char:FindFirstChild("Right Arm")
		if not hand then return end
		local fish = FishBuilder.build("Salmon", { scale = 1.25 })
		fish.Name = "TFBTrainFish"
		for _, d in fish:GetDescendants() do
			if d:IsA("BasePart") then d.Massless = true d.CanCollide = false d.CanQuery = false d.Anchored = false end
		end
		fish:SetAttribute("Anim", "Held")
		local c0 = if hand.Name == "RightHand" then CFrame.new(-0.9, -0.2, 0) * CFrame.Angles(0, math.pi / 2, 0) else CFrame.new(-0.9, -1, 0) * CFrame.Angles(0, math.pi / 2, 0)
		fish:PivotTo(hand.CFrame * c0)
		local w = Instance.new("Weld")
		w.Part0 = hand
		w.Part1 = fish.PrimaryPart
		w.C0 = c0
		w.Parent = fish.PrimaryPart
		fish.Parent = char
	elseif not on and existing then
		existing:Destroy()
	end
end

-- a few poses (legs / pelvis) only make sense standing still
local LEGS = { Cast = true, Bite = true, Reel = true, Catch = true, ThrowCharge = true, Throw = true, Lift = true, RodIdle = true }

function HumanPose.init()
	RunService.PreSimulation:Connect(function(dt)
		dt = math.min(dt, 0.1)
		local now = workspace:GetServerTimeNow()
		local me = Players.LocalPlayer.Character
		for _, player in Players:GetPlayers() do
			local char = player.Character
			if not char or char:GetAttribute("IsBear") then continue end
			local pose = char:GetAttribute("Pose") or ""
			local poseT = char:GetAttribute("PoseT") or now
			if char == me and HumanPose.localPose then
				pose = HumanPose.localPose
				poseT = HumanPose.localPoseT
			end
			trainingFish(char, pose == "Lift")
			local r = joints(char)
			if not r.RS then
				rigs[char] = nil
				continue
			end
			local active = pose ~= "" and P[pose] ~= nil
			r.w += ((if active then 1 else 0) - r.w) * Easing.damp(9, dt)
			if r.w < 0.01 and not active then continue end
			-- legs fade out while walking so the run cycle stays clean
			local hum = char:FindFirstChildOfClass("Humanoid")
			local moving = hum and hum.MoveDirection.Magnitude > 0.1
			local legTarget = if active and LEGS[pose] and not moving then 1 else 0
			r.leg += (legTarget - r.leg) * Easing.damp(8, dt)
			local target = zero()
			if active then target = P[pose](target, now - poseT, now, char) end
			for _, ch in CHANNELS do
				stepSpring(r.springs[ch], target[ch], dt, if ch == "P" or ch == "W" then 16 else 20, 0.62)
			end
			local s = r.springs
			local w = r.w
			r.RS.Transform = r.RS.Transform:Lerp(armCF(s.RS.pos, true, r.r15), w)
			r.LS.Transform = r.LS.Transform:Lerp(armCF(s.LS.pos, false, r.r15), w)
			if r.RE then r.RE.Transform = r.RE.Transform:Lerp(CFrame.Angles(s.RE.pos.X, 0, 0), w) end
			if r.LE then r.LE.Transform = r.LE.Transform:Lerp(CFrame.Angles(s.LE.pos.X, 0, 0), w) end
			if r.W then r.W.Transform = r.W.Transform:Lerp(CFrame.Angles(s.W.pos.X, s.W.pos.Y, s.W.pos.Z), w) end
			if r.N then
				local n = s.N.pos
				r.N.Transform = r.N.Transform:Lerp(if r.r15 then CFrame.Angles(n.X, n.Y, n.Z) else CFrame.Angles(-n.X, 0, n.Y), w * 0.9)
			end
			local lw = w * r.leg
			if lw > 0.01 and r.r15 then
				if r.RH then r.RH.Transform = r.RH.Transform:Lerp(CFrame.Angles(s.RH.pos.X, 0, s.RH.pos.Z), lw) end
				if r.LH then r.LH.Transform = r.LH.Transform:Lerp(CFrame.Angles(s.LH.pos.X, 0, s.LH.pos.Z), lw) end
				if r.RK then r.RK.Transform = r.RK.Transform:Lerp(CFrame.Angles(s.RK.pos.X, 0, 0), lw) end
				if r.LK then r.LK.Transform = r.LK.Transform:Lerp(CFrame.Angles(s.LK.pos.X, 0, 0), lw) end
				if r.P then
					-- pelvis drops into the crouch; knees and hips above keep the feet planted
					r.P.Transform = r.P.Transform:Lerp(CFrame.new(0, s.P.pos.X, 0), lw)
				end
			end
		end
	end)
end

return HumanPose
