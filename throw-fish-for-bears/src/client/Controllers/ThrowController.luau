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
local Clock = require(script.Parent.Clock)
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
	tr.Lifetime = 0.3
	tr.Color = ColorSequence.new(color)
	tr.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.55), NumberSequenceKeypoint.new(1, 1) })
	tr.LightEmission = 0
	tr.FaceCamera = true
	tr.Parent = part
end

-- SPEED RAMP: the visible flight runs in slow motion at the release and at the landing,
-- and blasts through the middle. It is a pure re-timing of the arc: the fish still lands
-- exactly when the server says so (warp(0) = 0, warp(1) = 1, always increasing).
local RAMP = 0.78
local function warp(u: number): number
	return u - RAMP * math.sin(2 * math.pi * u) / (2 * math.pi)
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
	-- a soft white motion trail (no glow)
	addTrail(model.PrimaryPart, Color3.fromRGB(255, 255, 255))
	local dir = d.to - d.from
	local yaw = math.atan2(-dir.X, -dir.Z)
	local handStart: Vector3? = nil
	-- SMOOTH CLOCK: GetServerTimeNow() wobbles a little every frame (time sync), which made the
	-- 200-400 studs/s fish stutter. Lock the offset once and run on the steady local clock.
	local clockOffset = workspace:GetServerTimeNow() - os.clock()
	local function sNow(): number
		return os.clock() + clockOffset
	end
	-- the ONE place the flying fish's position is computed: the fish model AND the camera use it
	-- for the same instant, so the camera is never a frame behind the fish
	local function flightAt(now: number): (Vector3, number, number)
		local u = math.clamp((now - d.t0) / d.flight, 0, 1)
		local w = warp(u)
		local p = Formulas.arc(d.from, d.to, d.apex, w)
		if handStart then
			local k = 1 - math.clamp(w / 0.1, 0, 1)
			p += (handStart - d.from) * (k * k)
		end
		return p, u, w
	end
	if isLocal then
		Sound.play("Throw")
		Throw.Flight:Fire(d)
		task.delay(RELEASE + d.flight + 1.6, function() Cine.gradeOff(1.0) end)
	else
		Sound.play("Throw", { parent = model.PrimaryPart, volume = 0.6 })
	end

	-- THE THROWER'S CAMERA: a film sequence, no light gimmicks --------------------------
	--  A wind-up  : tight low angle on the thrower, lens squeezing in
	--  B release  : HIT-STOP (frozen frame), heavy shake, whip blur, deep boom
	--  C slow-mo  : side tracking right next to the fish, shallow depth of field, the fish
	--               twisting in slow motion with water drops coming off it
	--  D blast    : whip-pan behind it, the ramp kicks in, wide lens, motion blur, wind
	--  E aerial   : drone shot high above the corridor, the fish a tiny dot, the zones below
	--  F incoming : camera on the ground at the landing spot, the fish falls at the lens in
	--               slow motion... IMPACT: hit-stop, earth and grass flying, shake
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
		local whipped, droned, incoming = false, false, false
		Cine.letterbox(true)
		Cine.grade({ tint = Color3.fromRGB(255, 248, 238), saturation = 0.1, contrast = 0.18 }, 0.2)
		local function shot(t, dt)
			local now = sNow()
			local fp = if now < startT then d.from else (flightAt(now))
			if now < startT then
				-- A) wind-up
				if not root then return nil, 60 end
				local k = 1 - math.clamp((startT - now) / RELEASE, 0, 1)
				local orbit = CFrame.Angles(0, -1.0 + k * 0.5, 0):VectorToWorldSpace(side)
				local p = root.Position + orbit * (7.2 - 2.2 * k) - travel * 2 + Vector3.new(0, -0.4 + k * 1.3, 0)
				local cf = CFrame.lookAt(p, root.Position + Vector3.new(0, 1.8, 0) + travel * 3 * k)
				lastCF, lastFov = cf, 52 - 14 * k
				return cf, lastFov
			end
			if not released then
				-- B) release: hit-stop + boom
				released = true
				freezeUntil = os.clock() + 0.14
				frozenCF, frozenFov = lastCF, lastFov
				CameraController.shake(1.6, 0.45)
				CameraController.punch(14)
				Cine.motion(20)
				Sound.play("Throw", { pitch = 0.55, volume = 1 })
				Sound.play("Land", { pitch = 0.5, volume = 0.8 })
				if root then Fx.dust(root.Position - Vector3.new(0, 2.8, 0), 1.2) end
			end
			if os.clock() < freezeUntil and frozenCF then
				return frozenCF, frozenFov
			end
			local u = math.clamp((now - startT) / d.flight, 0, 1)
			local z = Layout.zoneAt(fp)
			if z and z ~= lastZone then
				lastZone = z
				local zc = ZoneConfig.get(z)
				Cine.zoneBanner(("ZONE %d · %s"):format(z, zc.name:upper()), zc.sign)
				Sound.play("Notify")
			end
			if u < 0.16 then
				-- C) slow-motion side tracking, shallow focus on the fish
				local k = u / 0.16
				local p = fp + side * (3.2 + 1.5 * k) + travel * (1.2 - 1.6 * k) + Vector3.new(0, 0.5, 0)
				Cine.dof(3.5 + 1.5 * k, 0.75)
				return CFrame.lookAt(p, fp + travel * 0.6), 46 + 6 * k
			elseif u < 0.55 then
				-- D) whip behind it as it rockets away
				if not whipped then
					whipped = true
					Cine.dof(nil, 0)
					Cine.motion(16)
					CameraController.punch(18)
					CameraController.shake(0.8, 0.3)
					Sound.play("Throw", { pitch = 1.3, volume = 0.7 })
				end
				local k = (u - 0.16) / 0.39
				local p = fp - travel * (6 + 7 * Easing.sineOut(k)) + Vector3.new(0, 1.6 + 2.2 * k, 0) + side * (1.6 - 1.2 * k)
				-- smooth wind buffeting (low-frequency noise, NOT a random shake every frame)
				local buffet = Vector3.new(math.noise(t * 3, 1.7), math.noise(t * 3, 4.2), 0) * 0.25 * math.sin(k * math.pi)
				return CFrame.lookAt(p + buffet, fp + travel * (10 + d.power * 6)), 78 + 18 * math.sin(k * math.pi)
			elseif u < 0.8 then
				-- E) drone: high above, the fish crossing the corridor, the zones under it
				if not droned then
					droned = true
					Cine.motion(10)
					CameraController.punch(-6)
				end
				local k = (u - 0.55) / 0.25
				local mid = fp:Lerp(d.to, 0.35)
				local p = mid + side * (26 - 6 * k) - travel * (14 - 10 * k) + Vector3.new(0, 30 - 8 * k, 0)
				return CFrame.lookAt(p, fp), 48 - 6 * k
			else
				-- F) incoming: low at the landing spot, the fish falling at the lens in slow-mo
				if not incoming then
					incoming = true
					Cine.motion(12)
					CameraController.punch(-8)
					Sound.play("Charge", { pitch = 0.6, volume = 0.6 }) -- the whistle of the fall
				end
				local k = Easing.sineOut((u - 0.8) / 0.2)
				local spot = d.to + side * 7 + travel * 8 + Vector3.new(0, 0.9, 0)
				Cine.dof((spot - fp).Magnitude, 0.5)
				if u >= 1 and not landed then
					-- IMPACT
					landed = true
					freezeUntil = os.clock() + 0.12
					frozenCF, frozenFov = lastCF, lastFov
					Cine.dof(nil, 0)
					CameraController.shake(2.0, 0.55)
					CameraController.punch(-14)
					Cine.motion(18)
					Sound.play("Land", { pitch = 0.6, volume = 1.2 })
					local big = 1 + d.power
					Fx.dust(d.to, 1.8 * big)
					-- earth and grass flying (natural colours, no glow)
					Fx.blocks(d.to + Vector3.new(0, 0.6, 0), Color3.fromRGB(120, 95, 70), 26, 22 * big, 0.45, { life = 1.2, up = 2, spread = 3, gravity = 70,
						colors = { Color3.fromRGB(120, 95, 70), Color3.fromRGB(95, 74, 52), Color3.fromRGB(80, 150, 55), Color3.fromRGB(65, 125, 45) } })
					if not d.ok then Cine.letterbox(false) end
				end
				local cf = CFrame.lookAt(spot, fp:Lerp(d.to, 0.35) + Vector3.new(0, 0.6, 0))
				lastCF, lastFov = cf, 62 - 16 * k
				return cf, lastFov
			end
		end

		-- the camera follows the fish exactly (only the OFFSET is smoothed), never under the ground
		local offs, lookv
		local camParams = RaycastParams.new()
		camParams.FilterType = Enum.RaycastFilterType.Exclude
		local function guard(cf: CFrame?, fov: number)
			if not cf then return cf, fov end
			local pos = cf.Position
			camParams.FilterDescendantsInstances = { Fx.folder, model, localPlayer.Character }
			local hit = workspace:Raycast(pos + Vector3.new(0, 40, 0), Vector3.new(0, -41.5, 0), camParams)
			if hit and pos.Y < hit.Position.Y + 0.8 then
				local np = Vector3.new(pos.X, hit.Position.Y + 0.8, pos.Z)
				return CFrame.lookAt(np, np + cf.LookVector), fov
			end
			return cf, fov
		end
		CameraController.run(function(t, dt)
			local cf, fov = shot(t, dt)
			if not cf then return cf, fov end
			local following = released and os.clock() >= freezeUntil and not landed
			if not following then
				lastCF = cf
				offs = nil
				return guard(cf, fov)
			end
			local fpNow = flightAt(sNow())
			if not offs then
				offs = lastCF.Position - fpNow
				lookv = lastCF.LookVector
			end
			-- cuts (whip / drone / incoming) are fast, otherwise silky
			offs = offs:Lerp(cf.Position - fpNow, Easing.damp(9, dt))
			lookv = lookv:Lerp(cf.LookVector, Easing.damp(11, dt)).Unit
			local pos = fpNow + offs
			local out = CFrame.lookAt(pos, pos + lookv)
			lastCF, lastFov = out, fov
			return guard(out, fov)
		end, RELEASE + d.flight + 0.6, { smooth = 0, blendIn = 0.12 })
	end

	-- the flying fish: re-timed by the speed ramp, twisting like a live fish (body bends,
	-- tumbles, tail lashes), a few water drops at the start
	local dropAcc = 0
	local bindName = "TFBThrowFish" .. tostring(math.random(1, 1e9))
	local function unbind()
		pcall(function() RunService:UnbindFromRenderStep(bindName) end)
	end
	RunService:BindToRenderStep(bindName, Enum.RenderPriority.Camera.Value - 1, function(dt)
		if not model.Parent then unbind() return end
		local now = sNow()
		if now < d.t0 then
			local char = player.Character
			local hand = char and (char:FindFirstChild("RightHand") or char:FindFirstChild("Right Arm"))
			if hand then
				handStart = (hand :: BasePart).Position + Vector3.new(0, 0.4, 0)
				model:PivotTo(CFrame.new(handStart) * CFrame.Angles(0, yaw, 0))
			end
			return
		end
		local p, u, w = flightAt(now)
		-- orientation: nose follows the arc, slow tumble + wriggle (the body animation comes
		-- from the "Thrown" fish anim: tail lashes, spine bends)
		local p2 = Formulas.arc(d.from, d.to, d.apex, math.min(1, w + 0.01)) + (p - Formulas.arc(d.from, d.to, d.apex, w))
		local vel = p2 - p
		local base = if vel.Magnitude > 1e-3 then CFrame.lookAt(p, p + vel) else CFrame.new(p) * CFrame.Angles(0, yaw, 0)
		-- CARTOON FLIGHT ACTING:
		--  launch : shot out like an arrow, stiff, a tight football spiral that slowly winds down
		--  climb  : starts wriggling, more and more
		--  apex   : the "uh-oh" beat: it freezes, nose tips down to look at the drop
		--  fall   : total panic, frantic lashing all the way down
		local spiral = (2.5 + d.power * 3) * math.pi * (1 - (1 - w) ^ 3)
		local stiff = 1 - math.clamp(w / 0.08, 0, 1)
		local uhoh = Easing.bump(math.clamp((w - 0.42) / 0.16, 0, 1))
		local panic = math.clamp((w - 0.55) / 0.2, 0, 1)
		local wrig = (0.18 + 0.2 * w + 0.35 * panic) * (1 - stiff) * (1 - 0.85 * uhoh)
		local freq = 26 + 30 * panic
		model:PivotTo(base * CFrame.Angles(0, 0, spiral) * CFrame.Angles(math.sin(w * freq * 1.5) * wrig * 0.6 - 0.55 * uhoh, math.sin(w * freq) * wrig, 0))
		model:SetAttribute("FlyPanic", panic * (1 - uhoh) + 0.25 * (1 - stiff))
		if isLocal and u < 0.2 then
			dropAcc += dt
			if dropAcc > 0.06 then
				dropAcc = 0
				Fx.blocks(p, Color3.fromRGB(140, 200, 255), 2, 3, 0.16, { life = 0.6, up = -0.2, spread = 1.5, gravity = 40 })
			end
		end
		if u >= 1 then
			unbind()
			Fx.dust(d.to, 1.4)
			Sound.play("Land", { at = d.to })
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
		HumanPose.localPoseT = Clock.now()
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
			-- dust kicked up at the feet, the world tightening around you (no glowing effects)
			if root and now - lastRing > 0.45 - power * 0.25 then
				lastRing = now
				Fx.dust(root.Position - Vector3.new(0, 2.8, 0), 0.4 + power * 0.6)
				CameraController.shake(0.04 + power * 0.18, 0.12)
			end
			Cine.gradeSet({ contrast = 0.18 * power, saturation = 0.1 * power })
			Cine.dark(power * 0.4)
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
		Cine.grade({ tint = Color3.new(1, 1, 1), saturation = 0, contrast = 0 }, 0.2)
		Cine.dark(0)
		HumanPose.localPose = "Throw"
		HumanPose.localPoseT = Clock.now()
		task.delay(1.65, function()
			if HumanPose.localPose == "Throw" then HumanPose.localPose = nil end
		end)
		Net.event("Throw"):FireServer(aim)
	end)
end

return Throw
