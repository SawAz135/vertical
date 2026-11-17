--[[ ThrowController: hold THROW to charge (meter + pose + rising sound), release to
     throw. Every client renders the flying fish (spinning, tail flapping, trail);
     the thrower's camera follows the whole flight: shoulder shot -> chase cam ->
     impact punch, then hands over to the bear cinematic. ]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local GameConfig = require(Shared.Config.GameConfig)
local FishBuilder = require(Shared.Models.FishBuilder)
local Formulas = require(Shared.Formulas)
local Easing = require(Shared.Util.Easing)
local Signal = require(Shared.Util.Signal)
local Fx = require(script.Parent.Fx)
local Sound = require(script.Parent.Sound)
local Actions = require(script.Parent.Actions)
local CameraController = require(script.Parent.CameraController)
local HumanPose = require(script.Parent.HumanPose)
local Cine = require(script.Parent.CinematicFx)
local Layout = require(Shared.Layout)
local ZoneConfig = require(Shared.Config.ZoneConfig)
local FishConfig = require(Shared.Config.FishConfig)
local RarityConfig = require(Shared.Config.RarityConfig)

local Throw = {}
Throw.ChargeChanged = Signal.new() -- (power 0..1 | nil when hidden)
Throw.Flight = Signal.new() -- (throw data) local player's fish is flying: distance counter
local localPlayer = Players.LocalPlayer
local charging = nil

local function addTrail(part: BasePart, color: Color3)
	local a0 = Instance.new("Attachment")
	a0.Position = Vector3.new(0, 0.4, 0)
	a0.Parent = part
	local a1 = Instance.new("Attachment")
	a1.Position = Vector3.new(0, -0.4, 0)
	a1.Parent = part
	local tr = Instance.new("Trail")
	tr.Attachment0 = a0
	tr.Attachment1 = a1
	tr.Lifetime = 0.35
	tr.Color = ColorSequence.new(color)
	tr.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.2), NumberSequenceKeypoint.new(1, 1) })
	tr.LightEmission = 0.5
	tr.FaceCamera = true
	tr.Parent = part
end

local function onThrow(player: Player, d)
	local isLocal = player == localPlayer
	local model = FishBuilder.build(d.fish.s, { weight = d.fish.w, variant = d.fish.v })
	for _, p in model:GetDescendants() do
		if p:IsA("BasePart") then p.Anchored = false p.CanCollide = false p.CanQuery = false p.Massless = true end
	end
	model.PrimaryPart.Anchored = true
	model:SetAttribute("Anim", "Thrown")
	model:PivotTo(CFrame.new(d.from))
	model.Parent = Fx.folder
	local fishTier = RarityConfig.get(FishConfig.get(d.fish.s).rarity)
	addTrail(model.PrimaryPart, if fishTier.index >= 3 then (fishTier.textColor or fishTier.color) else Color3.fromRGB(255, 255, 255))
	local sparkAcc = 0
	local dir = d.to - d.from
	local yaw = math.atan2(-dir.X, -dir.Z)
	local spinRate = 4 + d.power * 6
	if isLocal then
		Sound.play("Throw")
		CameraController.punch(8)
		Throw.Flight:Fire(d)
	else
		Sound.play("Throw", { parent = model.PrimaryPart, volume = 0.6 })
	end

	-- the thrower's camera: an over-the-top 7-shot sequence --------------------------
	--  1 wind-up   : low dutch angle swinging around the thrower, FOV squeezes in
	--  2 release   : impact frame (flash + shockwave + shake), cinema bars, speed lines
	--  3 launch    : rocket chase right behind the fish, FOV blows wide
	--  4 apex      : slow orbit around the spinning fish against the sky
	--  5 descent   : camera dives ahead and waits at the landing spot
	--  6 impact    : ground-level hero shot, shockwave, shake, dust
	--  zone banners pop when the fish crosses into a new zone
	if isLocal then
		local char = localPlayer.Character
		local root = char and char:FindFirstChild("HumanoidRootPart")
		local startT = d.t0
		local travel = Vector3.new(dir.X, 0, dir.Z).Unit
		local side = Vector3.new(-travel.Z, 0, travel.X)
		local released, landed = false, false
		local lastZone = Layout.zoneAt(d.from) or 0
		local tier = RarityConfig.get(FishConfig.get(d.fish.s).rarity)
		local col = tier.textColor or tier.color
		Cine.letterbox(true)
		CameraController.run(function(t)
			local now = workspace:GetServerTimeNow()
			local fp = model.Parent and model.PrimaryPart.Position or d.to
			if now < startT then
				-- 1) wind-up: low angle swinging around the thrower
				if not root then return nil, 60 end
				local k = 1 - math.clamp((startT - now) / 0.32, 0, 1)
				local orbit = CFrame.Angles(0, -0.9 + k * 0.6, 0):VectorToWorldSpace(side)
				local p = root.Position + orbit * 7 - travel * 3 + Vector3.new(0, 1.2 + k * 1.2, 0)
				return CFrame.lookAt(p, root.Position + Vector3.new(0, 1.5, 0) + travel * 4 * k), 58 - 14 * k
			end
			if not released then
				-- 2) release: impact frame
				released = true
				Cine.flash(0.75)
				Cine.speedLines(true)
				CameraController.shake(1.1, 0.35)
				CameraController.punch(16)
				if root then Cine.shockwave(root.Position - Vector3.new(0, 2.8, 0), col, 0.8) end
				Sound.play("Transform", { volume = 0.6 })
			end
			local u = math.clamp((now - startT) / d.flight, 0, 1)
			-- zone banners
			local z = Layout.zoneAt(fp)
			if z and z ~= lastZone then
				lastZone = z
				local zc = ZoneConfig.get(z)
				Cine.banner(("ZONE %d · %s"):format(z, zc.name:upper()), zc.sign, nil)
				Sound.play("Notify")
			end
			local lead = travel * (8 + d.power * 6)
			if u < 0.28 then
				-- 3) rocket chase right behind the fish
				local k = u / 0.28
				local p = fp - travel * (6 + 6 * k) + Vector3.new(0, 2 + 2 * k, 0) + side * 1.5
				return CFrame.lookAt(p, fp + lead), 72 + 22 * Easing.sineOut(k)
			elseif u < 0.72 then
				-- 4) apex: slow orbit around the spinning fish
				local k = (u - 0.28) / 0.44
				local ang = -0.9 + Easing.sineInOut(k) * 1.8
				local around = CFrame.Angles(0, ang, 0):VectorToWorldSpace(side)
				local p = fp + around * 11 + Vector3.new(0, 3 - 4 * k, 0) - travel * 4
				return CFrame.lookAt(p, fp + travel * 2), 70
			else
				-- 5) descent: camera waits at the landing spot, looking back at the incoming fish
				local k = Easing.cubicOut((u - 0.72) / 0.28)
				local spot = d.to + side * 9 + travel * 10 + Vector3.new(0, 2.2, 0)
				local from = fp + side * 6 + Vector3.new(0, 4, 0)
				local p = from:Lerp(spot, k)
				if u >= 1 and not landed then
					-- 6) impact
					landed = true
					Cine.speedLines(false)
					Cine.flash(0.45, col)
					Cine.shockwave(d.to, col, 1 + d.power * 0.5)
					CameraController.shake(1.3, 0.45)
					CameraController.punch(-10)
					if not d.ok then Cine.letterbox(false) end
				end
				return CFrame.lookAt(p, fp:Lerp(d.to, 0.5) + Vector3.new(0, 0.5, 0)), 66 - 10 * k
			end
		end, 0.32 + d.flight + 0.7, { smooth = 11, blendIn = 0.15 })
	end

	local conn
	conn = RunService.RenderStepped:Connect(function()
		local now = workspace:GetServerTimeNow()
		local u = math.clamp((now - d.t0) / d.flight, 0, 1)
		if now < d.t0 then
			-- held up during the release frames
			local char = player.Character
			local hand = char and (char:FindFirstChild("RightHand") or char:FindFirstChild("Right Arm"))
			if hand then
				model:PivotTo(CFrame.new((hand :: BasePart).Position + Vector3.new(0, 0.6, 0)) * CFrame.Angles(0, yaw, 0))
			end
			return
		end
		local p = Formulas.arc(d.from, d.to, d.apex, u)
		sparkAcc += 1
		if sparkAcc % 4 == 0 and isLocal then
			-- glitter stream behind the fish (rarity coloured for rare fish)
			Fx.blocks(p, if fishTier.index >= 3 then fishTier.color else Color3.fromRGB(255, 255, 255), 1, 2, 0.25, { life = 0.6, up = 0.2, spread = 1 })
		end
		model:PivotTo(CFrame.new(p) * CFrame.Angles(0, yaw, 0) * CFrame.Angles(-u * spinRate * math.pi, 0, math.sin(u * 20) * 0.2))
		if u >= 1 then
			conn:Disconnect()
			Fx.dust(d.to, 1.2)
			Sound.play("Land", { at = d.to })
			if isLocal then
				CameraController.shake(0.8, 0.3)
				CameraController.punch(-5)
			end
			if d.ok then
				-- the server spawns the real fish on the ground: hide ours
				task.delay(0.12, function() model:Destroy() end)
			else
				-- too weak: little bounce then poof
				local t0 = os.clock()
				local c2
				c2 = RunService.RenderStepped:Connect(function()
					local k = (os.clock() - t0) / 0.5
					if k >= 1 then
						c2:Disconnect()
						Fx.puff(d.to + Vector3.new(0, 1, 0), Color3.new(1, 1, 1), 8, 2)
						model:Destroy()
						return
					end
					model:PivotTo(CFrame.new(d.to + Vector3.new(0, 2.5 * Easing.bump(k), 0)) * CFrame.Angles(0, yaw, k * 6))
				end)
			end
		end
	end)
end

function Throw.init()
	Net.event("ThrowFx").OnClientEvent:Connect(onThrow)
	Actions.on("Throw", function()
		if charging then return end
		Net.event("ChargeStart"):FireServer()
		charging = { t0 = os.clock() }
		HumanPose.localPose = "ThrowCharge"
		HumanPose.localPoseT = workspace:GetServerTimeNow()
		Sound.play("Charge")
		local maxed = false
		local lastRing, lastTone = 0, 0
		charging.conn = RunService.RenderStepped:Connect(function()
			local power = math.clamp((os.clock() - charging.t0) / GameConfig.Throw.chargeTime, 0, 1)
			HumanPose.charge = power
			Throw.ChargeChanged:Fire(power)
			local now = os.clock()
			local char = localPlayer.Character
			local root = char and char:FindFirstChild("HumanoidRootPart")
			-- rising tone while charging
			if now - lastTone > 0.16 - power * 0.08 then
				lastTone = now
				Sound.play("Reel", { pitch = 0.7 + power * 1.3, volume = 0.5 + power * 0.5 })
			end
			-- energy rings on the ground + sparks around the player, faster with power
			if root and now - lastRing > 0.32 - power * 0.2 then
				lastRing = now
				local feet = root.Position - Vector3.new(0, 2.9, 0)
				local col = Color3.fromRGB(255, 220, 60):Lerp(Color3.fromRGB(255, 70, 40), power)
				Fx.ring(feet, col, 5.5 - power * 2, 1.2, 0.35, { neon = true, transparency = 0.35, thick = 0.15 })
				Fx.sparkle(root.Position + Vector3.new(0, 1.5, 0), col, math.floor(2 + power * 6), 8 + power * 10)
			end
			-- camera tightens a little as the throw charges
			CameraController.punch(-0.25 * power)
			if power >= 1 and not maxed then
				maxed = true
				Sound.play("Charge", { pitch = 1.8 })
				Sound.play("Bite", { pitch = 0.8 })
				CameraController.punch(-4)
				CameraController.shake(0.5, 0.25)
				if root then Fx.burst(root.Position - Vector3.new(0, 2.8, 0), Color3.fromRGB(255, 120, 40), 0.45) end
			end
		end)
		CameraController.punch(-4)
	end, function()
		if not charging then return end
		charging.conn:Disconnect()
		local camLook = workspace.CurrentCamera.CFrame.LookVector
		local aim = math.clamp(camLook.X * 2.5, -1, 1)
		charging = nil
		Throw.ChargeChanged:Fire(nil)
		HumanPose.localPose = "Throw"
		HumanPose.localPoseT = workspace:GetServerTimeNow()
		task.delay(1.25, function()
			if HumanPose.localPose == "Throw" then HumanPose.localPose = nil end
		end)
		Net.event("Throw"):FireServer(aim)
	end)
end

return Throw
