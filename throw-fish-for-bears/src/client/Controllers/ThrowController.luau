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
	local RELEASE = GameConfig.Throw.releaseDelay
	local model = FishBuilder.build(d.fish.s, { weight = d.fish.w, variant = d.fish.v })
	for _, p in model:GetDescendants() do
		if p:IsA("BasePart") then p.Anchored = false p.CanCollide = false p.CanQuery = false p.Massless = true end
	end
	model.PrimaryPart.Anchored = true
	model:SetAttribute("Anim", "Thrown")
	model:PivotTo(CFrame.new(d.from))
	model.Parent = Fx.folder
	local fishTier = RarityConfig.get(FishConfig.get(d.fish.s).rarity)
	local col = fishTier.textColor or fishTier.color
	local fancy = fishTier.index >= 3
	addTrail(model.PrimaryPart, if fancy then col else Color3.fromRGB(255, 255, 255))
	local glow = Instance.new("PointLight")
	glow.Color = if fancy then col else Color3.fromRGB(255, 240, 200)
	glow.Range = 14 + d.power * 16
	glow.Brightness = 0 -- no light effect
	glow.Parent = model.PrimaryPart
	local dir = d.to - d.from
	local yaw = math.atan2(-dir.X, -dir.Z)
	local spinRate = 4 + d.power * 6
	local handStart: Vector3? = nil -- where the hand really was when the fish let go (no teleport)
	if isLocal then
		Sound.play("Throw")
		CameraController.punch(8)
		Throw.Flight:Fire(d)
		task.delay(RELEASE + d.flight + 1.6, function() Cine.gradeOff(1.0) end)
	else
		Sound.play("Throw", { parent = model.PrimaryPart, volume = 0.6 })
	end

	-- THE THROWER'S CAMERA: 8-shot sequence -------------------------------------------
	--  1 wind-up   : low hero angle, fast push-in on the throwing arm (during RELEASE)
	--  2 hit-stop  : camera freezes 0.09 s on the release frame (flash + shockwave + bars)
	--  3 launch    : rocket chase right behind the fish, dutch roll, FOV blows wide
	--  4 apex      : slow orbit around the spinning fish against the sky, FOV breathes
	--  5 descent   : the camera dives ahead of the fish and whips round to face it
	--  6 impact    : ground-level hero shot, triple shockwave, dust, shake
	--  zone banners pop when the fish crosses into a new zone
	if isLocal then
		local char = localPlayer.Character
		local root = char and char:FindFirstChild("HumanoidRootPart")
		local startT = d.t0
		local travel = Vector3.new(dir.X, 0, dir.Z).Unit
		local side = Vector3.new(-travel.Z, 0, travel.X)
		local released, landed = false, false
		local freezeUntil, frozenCF, frozenFov = 0, nil, 62
		local lastZone = Layout.zoneAt(d.from) or 0
		local lastCF, lastFov = nil, 62
		local apexDone = false
		Cine.letterbox(true)
		local function shot(t, dt)
			local now = workspace:GetServerTimeNow()
			local fp = model.Parent and model.PrimaryPart.Position or d.to
			if now < startT then
				-- 1) wind-up
				if not root then return nil, 60 end
				local k = 1 - math.clamp((startT - now) / RELEASE, 0, 1)
				local orbit = CFrame.Angles(0, -0.9 + k * 0.7, 0):VectorToWorldSpace(side)
				local p = root.Position + orbit * (7 - 2.5 * k) - travel * 3 + Vector3.new(0, 1.0 + k * 1.4, 0)
				local cf = CFrame.lookAt(p, root.Position + Vector3.new(0, 1.7, 0) + travel * 4 * k) * CFrame.Angles(0, 0, 0.12 * (1 - k))
				lastCF, lastFov = cf, 58 - 18 * k
				return cf, lastFov
			end
			if not released then
				-- 2) release frame: impact + hit-stop
				released = true
				freezeUntil = os.clock() + 0.09
				frozenCF, frozenFov = lastCF, lastFov
				Cine.flash(0.85, if fancy then col else nil)
				Cine.speedLines(true)
				CameraController.shake(1.4, 0.4)
				CameraController.punch(18)
				if root then
					local feet = root.Position - Vector3.new(0, 2.8, 0)
					Cine.shockwave(feet, col, 0.9)
					task.delay(0.08, function() Cine.shockwave(feet, Color3.new(1, 1, 1), 0.6) end)
					Fx.sparkle(root.Position + Vector3.new(0, 2, 0) + travel * 2, col, 14, 26)
				end
				Sound.play("Transform", { volume = 0.7 })
				Sound.play("Throw", { pitch = 0.6, volume = 0.8 })
				-- BLOCKBUSTER RELEASE: screen grade slam, lightning burst, 3 sonic booms, slam text
				Cine.grade({ tint = Color3.fromRGB(255, 244, 225), saturation = 0.35, contrast = 0.22, bloom = 0.9 + d.power * 0.6 }, 0.12)
				local o = d.from
				for i = 1, 5 + math.floor(d.power * 7) do
					local rv = Vector3.new(math.random() - 0.5, math.random() - 0.1, math.random() - 0.5).Unit
					task.delay(i * 0.012, function() Cine.bolt(o, o + rv * (7 + math.random() * 8), if fancy then col else Color3.fromRGB(255, 240, 160), 0.3, 0.4) end)
				end
				for i = 0, 2 do
					task.delay(i * 0.06, function() Cine.ringFacing(o + travel * (1 + i * 2), travel, if i == 1 then Color3.new(1, 1, 1) else col, 1.5, 10 + i * 5 + d.power * 8, 0.5 + i * 0.1, 0.5) end)
				end
				if d.power >= 0.97 then
					Cine.slam("MAX POWER!!!", Color3.fromRGB(255, 120, 40), 100, 1.0)
				end
			end
			if os.clock() < freezeUntil and frozenCF then
				return frozenCF, frozenFov
			end
			local u = math.clamp((now - startT) / d.flight, 0, 1)
			local z = Layout.zoneAt(fp)
			if z and z ~= lastZone then
				lastZone = z
				local zc = ZoneConfig.get(z)
				Cine.banner(("ZONE %d · %s"):format(z, zc.name:upper()), zc.sign, nil)
				Sound.play("Notify")
				CameraController.punch(6)
			end
			local lead = travel * (8 + d.power * 6)
			if u > 0.5 and not apexDone then
				-- APEX: hang-time pulse (bloom spike, ring around the fish, sparkle burst, snap zoom)
				apexDone = true
				Cine.grade({ saturation = 0.5, contrast = 0.3, bloom = 1.6 }, 0.1)
				task.delay(0.15, function() Cine.grade({ saturation = 0.2, contrast = 0.15, bloom = 0.6 }, 0.6) end)
				Cine.ringFacing(fp, travel, Color3.new(1, 1, 1), 1, 14, 0.7, 0.5)
				Cine.ringFacing(fp, travel, col, 1, 22, 0.9, 0.7)
				Fx.sparkle(fp, col, 30, 40)
				CameraController.punch(-9)
				CameraController.shake(0.7, 0.3)
				Sound.play("Transform", { pitch = 1.4, volume = 0.5 })
			end
			if u < 0.26 then
				-- 3) rocket chase, dutch roll swinging out, FOV blowing wide
				local k = u / 0.26
				local p = fp - travel * (5 + 8 * Easing.sineOut(k)) + Vector3.new(0, 1.8 + 2.4 * k, 0) + side * (2.2 - 1.2 * k)
				local roll = math.sin(k * math.pi) * 0.22
				return CFrame.lookAt(p, fp + lead) * CFrame.Angles(0, 0, roll), 66 + 34 * Easing.sineOut(k)
			elseif u < 0.7 then
				-- 4) apex orbit
				local k = (u - 0.26) / 0.44
				local ang = -1.1 + Easing.sineInOut(k) * 2.2
				local around = CFrame.Angles(0, ang, 0):VectorToWorldSpace(side)
				local radius = 12 + math.sin(k * math.pi) * 5
				local p = fp + around * radius + Vector3.new(0, 4 - 6 * k, 0) - travel * 3
				return CFrame.lookAt(p, fp + travel * 2), 78 - 10 * math.sin(k * math.pi)
			else
				-- 5/6) descent then impact
				local k = Easing.cubicOut((u - 0.7) / 0.3)
				local spot = d.to + side * 9 + travel * 10 + Vector3.new(0, 2.2, 0)
				local from = fp + side * 7 + Vector3.new(0, 5, 0)
				local p = from:Lerp(spot, k)
				if u >= 1 and not landed then
					landed = true
					Cine.speedLines(false)
					Cine.flash(0.55, col)
					Cine.shockwave(d.to, col, 1 + d.power * 0.6)
					task.delay(0.12, function() Cine.shockwave(d.to, Color3.new(1, 1, 1), 0.8 + d.power * 0.4) end)
					task.delay(0.26, function() Cine.shockwave(d.to, col, 0.6) end)
					CameraController.shake(1.6, 0.5)
					CameraController.punch(-12)
					-- MEGA IMPACT: sky pillar, 4 rings, bolt crown, debris, bloom + tint flash, distance slam
					local big = 1 + d.power
					Cine.pillar(d.to, col, 160, 5 + d.power * 5, 1.4)
					for i = 1, 4 do
						task.delay(i * 0.09, function() Cine.shockwave(d.to, if i % 2 == 0 then Color3.new(1, 1, 1) else col, big * (0.6 + i * 0.35)) end)
					end
					Cine.crown(d.to, col, 8 + math.floor(d.power * 8), 4 + d.power * 6, 18 + d.power * 20)
					Fx.blocks(d.to + Vector3.new(0, 1, 0), col, 60, 40 * big, 0.5, { life = 1.4, up = 2.2, spread = 4, gravity = 60 })
					Fx.blocks(d.to + Vector3.new(0, 1, 0), Color3.fromRGB(120, 95, 70), 40, 28 * big, 0.6, { life = 1.2, up = 1.6, spread = 3, gravity = 70 })
					Cine.grade({ tint = Color3.new(1, 1, 1):Lerp(col, 0.35), saturation = 0.45, contrast = 0.3, bloom = 2.2 }, 0.08)
					task.delay(0.2, function() Cine.grade({ saturation = 0.15, contrast = 0.1, bloom = 0.5 }, 0.9) end)
					Cine.slam((d.record and "NEW RECORD! " or "") .. ("%d STUDS!"):format(math.floor(d.dist or 0)), if d.record then Color3.fromRGB(255, 220, 60) else Color3.new(1, 1, 1), 96, 1.5)
					Sound.play("Reveal2", { volume = 0.7 })
					if not d.ok then Cine.letterbox(false) end
				end
				return CFrame.lookAt(p, fp:Lerp(d.to, 0.6) + Vector3.new(0, 0.5, 0)), 66 - 12 * k
			end
		end

		-- FISH NEVER LEAVES THE FRAME: the fish flies at 150-400 studs/s on long throws, and a
		-- camera spring on ABSOLUTE position lags 10-30 studs behind it (this is why the fish
		-- slipped off screen). So the camera is exact, and only its OFFSET from the fish is smoothed.
		local offs, lookv, upv
		-- the camera must never dip under the ground (you would see the underside of the map)
		local camParams = RaycastParams.new()
		camParams.FilterType = Enum.RaycastFilterType.Exclude
		local function guard(cf: CFrame?, fov: number)
			if not cf then return cf, fov end
			local pos = cf.Position
			camParams.FilterDescendantsInstances = { Fx.folder, model, localPlayer.Character }
			local hit = workspace:Raycast(pos + Vector3.new(0, 40, 0), Vector3.new(0, -41.5, 0), camParams)
			if hit and pos.Y < hit.Position.Y + 1.5 then
				local np = Vector3.new(pos.X, hit.Position.Y + 1.5, pos.Z)
				return CFrame.lookAt(np, np + cf.LookVector, cf.UpVector), fov
			end
			return cf, fov
		end
		CameraController.run(function(t, dt)
			local cf, fov = shot(t, dt)
			if not cf then return cf, fov end
			local following = released and os.clock() >= freezeUntil
			if not following then
				lastCF = cf
				return guard(cf, fov)
			end
			local fpNow = if model.Parent then model.PrimaryPart.Position else d.to
			if not offs then
				offs = lastCF.Position - fpNow
				lookv = lastCF.LookVector
				upv = lastCF.UpVector
			end
			offs = offs:Lerp(cf.Position - fpNow, Easing.damp(10, dt))
			lookv = lookv:Lerp(cf.LookVector, Easing.damp(12, dt)).Unit
			upv = upv:Lerp(cf.UpVector, Easing.damp(12, dt)).Unit
			local pos = fpNow + offs
			return guard(CFrame.lookAt(pos, pos + lookv, upv), fov)
		end, RELEASE + d.flight + 0.5, { smooth = 0, blendIn = 0.12 })
	end

	local conn
	local sparkAcc = 0
	conn = RunService.RenderStepped:Connect(function()
		if not model.Parent then conn:Disconnect() return end
		local now = workspace:GetServerTimeNow()
		if now < d.t0 then
			-- fish stays glued to the real hand until the release frame
			local char = player.Character
			local hand = char and (char:FindFirstChild("RightHand") or char:FindFirstChild("Right Arm"))
			if hand then
				handStart = (hand :: BasePart).Position + Vector3.new(0, 0.4, 0)
				model:PivotTo(CFrame.new(handStart) * CFrame.Angles(0, yaw, 0))
			end
			return
		end
		local u = math.clamp((now - d.t0) / d.flight, 0, 1)
		local p = Formulas.arc(d.from, d.to, d.apex, u)
		-- start the arc FROM THE HAND and blend into the real arc (this was the visible snap)
		if handStart then
			local k = 1 - math.clamp(u / 0.1, 0, 1)
			p += (handStart - d.from) * (k * k)
		end
		sparkAcc += 1
		if u > 0.03 and u < 0.97 then
			local trailDir = Vector3.new(dir.X, 0, dir.Z).Unit
			if sparkAcc % 7 == 0 and d.power > 0.35 then
				Cine.ringFacing(p, trailDir, if fancy then col else Color3.new(1, 1, 1), 1.2, 6 + d.power * 6, 0.4, 0.35)
			end
			if sparkAcc % 5 == 0 and isLocal then
				local rv = Vector3.new(math.random() - 0.5, math.random() - 0.5, math.random() - 0.5).Unit
				Cine.bolt(p, p + rv * (3 + math.random() * 3), if fancy then col else Color3.fromRGB(255, 240, 170), 0.18, 0.2)
			end
			if isLocal then CameraController.shake(0.25 + d.power * 0.3, 0.06) end
		end
		if sparkAcc % 3 == 0 and isLocal then
			Fx.blocks(p, if fancy then fishTier.color else Color3.fromRGB(255, 255, 255), 1, 2, 0.25, { life = 0.7, up = 0.2, spread = 1 })
			if u > 0.05 and sparkAcc % 9 == 0 then Fx.ring(p, if fancy then col else Color3.new(1, 1, 1), 0.6, 3.5, 0.3, { neon = true, transparency = 0.5, thick = 0.1 }) end
		end
		model:PivotTo(CFrame.new(p) * CFrame.Angles(0, yaw, 0) * CFrame.Angles(-u * spinRate * math.pi, 0, math.sin(u * 20) * 0.2))
		if u >= 1 then
			conn:Disconnect()
			Fx.dust(d.to, 1.4)
			Sound.play("Land", { at = d.to })
			if isLocal then
				CameraController.shake(0.9, 0.3)
				CameraController.punch(-5)
			end
			if d.ok then
				task.delay(0.12, function() if model.Parent then model:Destroy() end end)
			else
				local t0 = os.clock()
				local c2
				c2 = RunService.RenderStepped:Connect(function()
					local k = (os.clock() - t0) / 0.5
					if k >= 1 or not model.Parent then
						c2:Disconnect()
						Fx.puff(d.to + Vector3.new(0, 1, 0), Color3.new(1, 1, 1), 8, 2)
						if model.Parent then model:Destroy() end
						return
					end
					model:PivotTo(CFrame.new(d.to + Vector3.new(0, 1.2 + 2.5 * Easing.bump(k), 0)) * CFrame.Angles(0, yaw, k * 6))
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
			-- the whole screen charges up with you: contrast, bloom and lightning crackling around you
			Cine.gradeSet({ contrast = 0.12 * power, saturation = 0.15 * power, bloom = 0.15 + 0.7 * power, tint = Color3.new(1, 1, 1):Lerp(Color3.fromRGB(255, 190, 120), power * 0.35) })
			if root and math.random() < 0.15 + power * 0.5 then
				local a = root.Position + Vector3.new(math.random() - 0.5, -2.8, math.random() - 0.5) * 2
				local b = root.Position + Vector3.new((math.random() - 0.5) * 6, 1 + math.random() * 5, (math.random() - 0.5) * 6)
				Cine.bolt(a, b, Color3.fromRGB(255, 220, 90):Lerp(Color3.fromRGB(255, 80, 40), power), 0.16, 0.18 + power * 0.2)
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
		Cine.grade({ tint = Color3.new(1, 1, 1), saturation = 0, contrast = 0, bloom = 0.2 }, 0.2)
		HumanPose.localPose = "Throw"
		HumanPose.localPoseT = workspace:GetServerTimeNow()
		task.delay(1.25, function()
			if HumanPose.localPose == "Throw" then HumanPose.localPose = nil end
		end)
		Net.event("Throw"):FireServer(aim)
	end)
end

return Throw
