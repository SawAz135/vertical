--[[ HumanPose: code-driven arm / torso poses layered over the default avatar
     animations for EVERY player (R15 + R6), driven by replicated attributes:
       Pose  = RodIdle | Cast | Reel | HoldFish | ThrowCharge | Throw | CarryBear | Lift
       PoseT = server time the pose started (timed actions: cast, throw, lift reps)
     Applied in PreSimulation (after the Animator), blended in/out with a weight so
     poses never snap. Training ("Lift") also shows a local fish dumbbell. ]]
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Easing = require(ReplicatedStorage.Shared.Util.Easing)
local FishBuilder = require(ReplicatedStorage.Shared.Models.FishBuilder)
local E = require(ReplicatedStorage.Shared.Config.EconomyConfig)

local HumanPose = {}
local rigs = {}
local sin, clamp = math.sin, math.clamp

-- local override for the own character (instant feedback before the server echo)
HumanPose.localPose = nil
HumanPose.localPoseT = 0
HumanPose.charge = 0 -- 0..1 throw charge (own character)

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
			W = m("UpperTorso", "Waist"),
		}
	else
		r = { r15 = false, RS = m("Torso", "Right Shoulder"), LS = m("Torso", "Left Shoulder"), W = nil }
	end
	r.w = 0
	r.cur = { RS = Vector3.zero, LS = Vector3.zero, RE = 0, LE = 0, W = 0 }
	rigs[char] = r
	char.Destroying:Connect(function() rigs[char] = nil end)
	return r
end

-- arm angles: x = forward raise (rad), z = outward (abduction), elbow = bend
local function target(pose: string, t: number, now: number, char: Model)
	local RS, LS, RE, LE, W = Vector3.zero, Vector3.zero, 0, 0, 0
	if pose == "RodIdle" then
		RS = Vector3.new(0.95, 0, 0.08) RE = 0.5
		LS = Vector3.new(0.55, 0, 0.35) LE = 0.9
		RS += Vector3.new(sin(now * 1.3) * 0.03, 0, 0)
	elseif pose == "Cast" then
		-- wind up over the shoulder, whip forward, settle
		local up = Easing.cubicOut(clamp(t / 0.35, 0, 1))
		local whip = Easing.backOut(clamp((t - 0.38) / 0.22, 0, 1))
		local a = 0.95 + 1.9 * up - 2.15 * whip
		RS = Vector3.new(a, 0, 0.1) RE = 0.5 - 0.3 * up + 0.3 * whip
		LS = Vector3.new(0.55 + up * 0.8 - whip * 0.8, 0, 0.35) LE = 0.9
		W = 0.18 * up - 0.25 * whip
		if t > 1.0 then
			RS = Vector3.new(0.95, 0, 0.08) RE = 0.5 LS = Vector3.new(0.55, 0, 0.35) LE = 0.9 W = 0
		end
	elseif pose == "Reel" then
		local crank = now * 9
		RS = Vector3.new(1.2 + sin(now * 3) * 0.12, 0, 0.05) RE = 0.35
		LS = Vector3.new(0.75 + sin(crank) * 0.28, 0, 0.3 + math.cos(crank) * 0.18) LE = 1.0 + math.cos(crank) * 0.2
		W = 0.22 + sin(now * 3) * 0.05
	elseif pose == "HoldFish" then
		RS = Vector3.new(1.15, 0, -0.38) RE = 0.75
		LS = Vector3.new(1.15, 0, -0.38) LE = 0.75
		RS += Vector3.new(sin(now * 1.6) * 0.04, 0, 0)
	elseif pose == "ThrowCharge" then
		local c = if char == Players.LocalPlayer.Character then HumanPose.charge else clamp(t / 1.4, 0, 1)
		local shake = if c >= 0.99 then sin(now * 60) * 0.05 else 0
		RS = Vector3.new(2.8 + c * 0.5 + shake, 0, 0.1) RE = 0.4 + c * 0.6
		LS = Vector3.new(2.8 + c * 0.5 - shake, 0, 0.1) LE = 0.4 + c * 0.6
		W = 0.1 + c * 0.32
	elseif pose == "Throw" then
		local f = Easing.cubicIn(clamp(t / 0.16, 0, 1))
		local rec = Easing.cubicOut(clamp((t - 0.25) / 0.45, 0, 1))
		local a = 3.3 - 2.8 * f + (0.0 * rec)
		RS = Vector3.new(a * (1 - rec) + 0.2 * rec, 0, 0.1) RE = 0.9 * (1 - f)
		LS = Vector3.new(a * (1 - rec) + 0.2 * rec, 0, 0.1) LE = 0.9 * (1 - f)
		W = (0.42 - 0.85 * f) * (1 - rec)
	elseif pose == "CarryBear" then
		RS = Vector3.new(2.95, 0, 0.32) RE = 0.35
		LS = Vector3.new(2.95, 0, 0.32) LE = 0.35
		W = sin(now * 2) * 0.03 + 0.05
	elseif pose == "Lift" then
		-- training reps: fish at the chest -> pressed overhead -> back down
		local rep = (t % E.Strength.repTime) / E.Strength.repTime
		local press = Easing.sineInOut(if rep < 0.5 then rep * 2 else (1 - rep) * 2)
		local a = 1.35 + press * 1.75
		RS = Vector3.new(a, 0, -0.2 + press * 0.3) RE = 1.3 - press * 1.0
		LS = Vector3.new(a, 0, -0.2 + press * 0.3) LE = 1.3 - press * 1.0
		W = -0.06 + press * 0.12
	end
	return RS, LS, RE, LE, W
end

local function armCF(v: Vector3, right: boolean, r15: boolean): CFrame
	if r15 then
		return CFrame.Angles(v.X, 0, if right then v.Z else -v.Z)
	end
	-- R6 shoulders are rotated 90deg: forward raise is about Z
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
				rigs[char] = nil -- limbs not loaded yet: retry next frame
				continue
			end
			local active = pose ~= ""
			r.w += ((if active then 1 else 0) - r.w) * Easing.damp(10, dt)
			if r.w < 0.01 and not active then continue end
			if active then
				local RS, LS, RE, LE, W = target(pose, now - poseT, now, char)
				local k = Easing.damp(18, dt)
				local c = r.cur
				c.RS = c.RS:Lerp(RS, k)
				c.LS = c.LS:Lerp(LS, k)
				c.RE += (RE - c.RE) * k
				c.LE += (LE - c.LE) * k
				c.W += (W - c.W) * k
			end
			local c = r.cur
			local w = r.w
			r.RS.Transform = r.RS.Transform:Lerp(armCF(c.RS, true, r.r15), w)
			r.LS.Transform = r.LS.Transform:Lerp(armCF(c.LS, false, r.r15), w)
			if r.RE then r.RE.Transform = r.RE.Transform:Lerp(CFrame.Angles(c.RE, 0, 0), w) end
			if r.LE then r.LE.Transform = r.LE.Transform:Lerp(CFrame.Angles(c.LE, 0, 0), w) end
			if r.W then r.W.Transform = r.W.Transform:Lerp(CFrame.Angles(c.W, 0, 0), w) end
		end
	end)
end

return HumanPose
