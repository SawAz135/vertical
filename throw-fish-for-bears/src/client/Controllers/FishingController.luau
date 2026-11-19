--[[ FishingController: fishing visuals for every player + the local reel mini-game.
     Cast  : wind-up / whip pose, bobber flies along an arc from the rod tip, line
             (Beam with slack) stretches, splash + ripples on landing
     Wait  : bobber bobs with the water, ripple rings, rod sways
     Bite  : bobber dips 3x, bubbles, splash, "!" bubble + HOOK! button
     Reel  : "keep the fish in the zone" (hold to push the zone, rarer = harder),
             rod bends with tension, line goes taut, bobber zig-zags toward the dock,
             a fish shadow fights under the surface
     Catch : the fish leaps out (camera focus on rare catches), arcs into the player's
             arms with splash, then the reveal card. ]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local Layout = require(Shared.Layout)
local GameConfig = require(Shared.Config.GameConfig)
local FishConfig = require(Shared.Config.FishConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local RodBuilder = require(Shared.Models.RodBuilder)
local FishBuilder = require(Shared.Models.FishBuilder)
local Easing = require(Shared.Util.Easing)
local Fx = require(script.Parent.Fx)
local Sound = require(script.Parent.Sound)
local Actions = require(script.Parent.Actions)
local CameraController = require(script.Parent.CameraController)
local HumanPose = require(script.Parent.HumanPose)
local Clock = require(script.Parent.Clock)
local Cine = require(script.Parent.CinematicFx)

local Fishing = {}
local sessions = {} -- [player] = session
local localPlayer = Players.LocalPlayer
local rand = Random.new()
local ui -- reel game UI (built by the HUD, see Fishing.bindUI)
Fishing.reel = nil -- local reel game state

local function rodOf(player: Player)
	local char = player.Character
	local held = char and char:FindFirstChild("TFBHeld")
	if held and held:GetAttribute("Kind") == "Rod" then return held end
	return nil
end

local function tipPos(player: Player): Vector3?
	local rod = rodOf(player)
	if not rod then return nil end
	for _, d in rod:GetDescendants() do
		if d.Name == "TipAtt" then return (d :: Attachment).WorldPosition end
	end
	return nil
end

local function cleanup(s)
	if not s then return end
	if s.bobber then s.bobber:Destroy() end
	if s.beam then s.beam:Destroy() end
	if s.shadow then s.shadow:Destroy() end
	if s.anchor then s.anchor:Destroy() end
	s.dead = true
end

local function newSession(player: Player, bobberPos: Vector3, rodId: string)
	cleanup(sessions[player])
	local s = { player = player, target = bobberPos, phase = "Flying", t = 0, tension = 0, bend = 0 }
	local bobber = RodBuilder.buildBobber(rodId or "Starter")
	for _, d in bobber:GetDescendants() do
		if d:IsA("BasePart") then d.Anchored = true d.CanCollide = false d.CanQuery = false end
	end
	bobber.Parent = Fx.folder
	s.bobber = bobber
	-- line: beam from the rod tip (anchor part follows the tip) to the bobber eye
	local anchor = Instance.new("Part")
	anchor.Anchored = true
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.Transparency = 1
	anchor.Size = Vector3.one * 0.1
	anchor.Parent = Fx.folder
	local a0 = Instance.new("Attachment")
	a0.Parent = anchor
	local beam = Instance.new("Beam")
	beam.Attachment0 = a0
	beam.Attachment1 = bobber.PrimaryPart:FindFirstChild("BobAtt")
	beam.Width0 = 0.06
	beam.Width1 = 0.06
	beam.Color = ColorSequence.new(Color3.fromRGB(245, 245, 245))
	beam.Transparency = NumberSequence.new(0.1)
	beam.LightEmission = 0.3
	beam.Segments = 16
	beam.FaceCamera = true
	beam.Parent = anchor
	s.anchor = anchor
	s.beam = beam
	s.from = tipPos(player) or bobberPos + Vector3.new(0, 6, -12)
	sessions[player] = s
	return s
end

local function setBobber(s, p: Vector3, tilt: number?)
	s.bobber:PivotTo(CFrame.new(p) * CFrame.Angles(tilt or 0, 0, (tilt or 0) * 0.6))
	s.bobPos = p
end

------------------------------------------------------------------------------------
-- LOCAL CINEMATICS (only for your own fishing)
------------------------------------------------------------------------------------
local function myRoot(): BasePart?
	local char = localPlayer.Character
	return char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
end

local function flat(v: Vector3): Vector3
	local f = Vector3.new(v.X, 0, v.Z)
	return if f.Magnitude > 1e-3 then f.Unit else Vector3.new(0, 0, 1)
end

-- CAST: over the shoulder -> the camera chases the bobber in flight from the side -> low
-- on the water for the PLOP, then hands back to the normal camera
local function castCamera(s)
	local root = myRoot()
	if not root then return end
	local plopped = false
	CameraController.run(function(t)
		local r = myRoot()
		if not r or s.dead then return nil, 70 end
		local dir = flat(s.target - r.Position)
		local side = Vector3.new(-dir.Z, 0, dir.X)
		local up = Vector3.new(0, 1, 0)
		if s.phase == "Windup" then
			-- tight over the shoulder, the rod going back
			local k = Easing.cubicOut(math.clamp(s.t / 0.42, 0, 1))
			local p = r.Position - dir * (5.5 - 1 * k) + side * 2.2 + up * (2.6 + 0.6 * k)
			return CFrame.lookAt(p, r.Position + dir * 6 + up * 1.5), 62 - 6 * k
		elseif s.phase == "Flying" then
			-- chase: alongside the bobber, slightly behind and above
			local b = s.bobPos or s.target
			local k = math.clamp(s.t / 0.6, 0, 1)
			local p = b - dir * (4.5 - 1.5 * k) + side * (3.2 + 1.5 * k) + up * (1.6 - 0.6 * k)
			return CFrame.lookAt(p, b + dir * 2), 58 + 10 * k
		end
		-- PLOP: low over the water next to the bobber, then back out
		if not plopped then
			plopped = true
			CameraController.shake(0.35, 0.2)
			CameraController.punch(-4)
		end
		local b = s.target
		return CFrame.lookAt(b - dir * 3.4 + side * 2.4 + up * 0.9, b + up * 0.2), 54
	end, 1.55, { smooth = 9, blendIn = 0.15 })
end

-- BITE: snap zoom on the bobber going under + a huge "!" over it
local function biteCamera(s, at: Vector3)
	local r = myRoot()
	if not r then return end
	local dir = flat(at - r.Position)
	local side = Vector3.new(-dir.Z, 0, dir.X)
	CameraController.run(function(t)
		local k = Easing.expoOut(math.clamp(t / 0.18, 0, 1))
		local b = s.bobPos or at
		local p = b - dir * (6 - 3 * k) + side * 1.6 + Vector3.new(0, 1.4 - 0.6 * k, 0)
		return CFrame.lookAt(p, b), 64 - 18 * k
	end, 0.75, { smooth = 14, blendIn = 0.08 })
	CameraController.shake(0.9, 0.3)
	-- the big "!" (outlined text only)
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(160, 160)
	bb.StudsOffsetWorldSpace = Vector3.new(0, 3, 0)
	bb.AlwaysOnTop = true
	bb.Adornee = s.bobber and s.bobber.PrimaryPart
	local tl = Instance.new("TextLabel")
	tl.BackgroundTransparency = 1
	tl.Size = UDim2.fromScale(1, 1)
	tl.Font = Enum.Font.FredokaOne
	tl.TextScaled = true
	tl.Text = "!"
	tl.TextColor3 = Color3.fromRGB(255, 70, 60)
	local st = Instance.new("UIStroke")
	st.Thickness = 6
	st.Parent = tl
	local sc = Instance.new("UIScale")
	sc.Scale = 0
	sc.Parent = tl
	tl.Parent = bb
	bb.Parent = Fx.folder
	local t0 = os.clock()
	local conn
	conn = RunService.RenderStepped:Connect(function()
		local t = os.clock() - t0
		sc.Scale = if t < 0.15 then Easing.backOut(t / 0.15) * 1.3 else 1 + math.abs(math.sin(t * 16)) * 0.12
		tl.Rotation = math.sin(t * 30) * 8 * math.max(0, 1 - t)
		if t > 0.9 then
			tl.TextTransparency = (t - 0.9) / 0.25
			st.Transparency = tl.TextTransparency
		end
		if t > 1.15 then
			conn:Disconnect()
			bb:Destroy()
		end
	end)
end

-- REEL: a living camera during the fight: you + the fight in frame, swaying with the
-- tension, tightening as you win; the fish breaks the surface now and then
local function reelCamera(s)
	CameraController.run(function(t, dt)
		local r = myRoot()
		if not r or s.dead then return nil, 70 end
		local b = s.bobPos or s.target
		local dir = flat(b - r.Position)
		local side = Vector3.new(-dir.Z, 0, dir.X)
		local prog = if Fishing.reel then Fishing.reel.progress else 0.5
		local tension = s.tension or 0.5
		local dist = (b - r.Position).Magnitude
		local mid = r.Position:Lerp(b, 0.55)
		local tn = os.clock()
		local sway = Vector3.new(math.noise(tn * 1.3, 1), math.noise(tn * 1.3, 2) * 0.5, math.noise(tn * 1.3, 3)) * (0.4 + tension * 1.2)
		local p = mid + side * (dist * 0.55 + 4 - prog * 2) - dir * (dist * 0.2) + Vector3.new(0, 4.2 - prog * 1.2, 0) + sway
		return CFrame.lookAt(p, mid - Vector3.new(0, 0.8, 0)), 60 - prog * 12 - tension * 4
	end, 90, { smooth = 6, blendIn = 0.35 })
end

-- a dark fish silhouette breaking the surface during the fight (species still a mystery)
local function fightJump(s)
	local b = s.bobPos or s.target
	local m = FishBuilder.build("Salmon", { scale = 0.9 + (s.difficulty or 1) * 0.15 })
	for _, d in m:GetDescendants() do
		if d:IsA("BasePart") then
			d.Anchored = false
			d.CanCollide = false
			d.CanQuery = false
			d.Color = Color3.fromRGB(16, 30, 48)
			d.Material = Enum.Material.SmoothPlastic
		end
	end
	m.PrimaryPart.Anchored = true
	m:SetAttribute("Anim", "Leap")
	m.Parent = Fx.folder
	local from = Vector3.new(b.X, Layout.WATER_Y, b.Z)
	local to = from + Vector3.new(math.random(-3, 3), 0, math.random(-3, 3))
	Fx.splash(from, 0.9)
	Sound.play("Splash", { at = from, volume = 0.8 })
	CameraController.shake(0.4, 0.2)
	local t0 = os.clock()
	local last = from
	local conn
	conn = RunService.RenderStepped:Connect(function()
		local u = math.clamp((os.clock() - t0) / 0.75, 0, 1)
		local p = from:Lerp(to, u) + Vector3.new(0, math.sin(u * math.pi) * (2.6 + (s.difficulty or 1) * 0.3), 0)
		local vel = p - last
		last = p
		if vel.Magnitude > 1e-3 then m:PivotTo(CFrame.lookAt(p, p + vel) * CFrame.Angles(0, 0, u * math.pi)) end
		if u >= 1 or s.dead then
			conn:Disconnect()
			if not s.dead then Fx.splash(to, 0.8) end
			m:Destroy()
		end
	end)
end

-- fish leaps from the water into the player's arms
local function leap(player: Player, from: Vector3, fish, isLocal: boolean)
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then return end
	local model = FishBuilder.build(fish.s, { weight = fish.w, variant = fish.v })
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") then d.Anchored = false d.CanCollide = false d.CanQuery = false d.Massless = true end
	end
	model.PrimaryPart.Anchored = true
	model:SetAttribute("Anim", "Leap")
	model.Parent = Fx.folder
	Fx.splash(from, 1.6)
	Sound.play("BigSplash", { at = from })
	local tier = RarityConfig.get(FishConfig.get(fish.s).rarity)
	-- the water EXPLODES: a crown of spray, a ring on the surface, falling droplets
	Fx.ring(from + Vector3.new(0, 0.1, 0), Color3.fromRGB(225, 245, 255), 0.6, 4 + tier.index * 0.5, 0.6)
	Fx.blocks(from + Vector3.new(0, 0.3, 0), Color3.fromRGB(170, 220, 255), 18 + tier.index * 3, 14 + tier.index, 0.2,
		{ life = 1.1, up = 3.2, spread = 1.6, gravity = 50, colors = { Color3.fromRGB(170, 220, 255), Color3.fromRGB(235, 248, 255), Color3.fromRGB(120, 190, 245) } })
	-- rarer fish leap higher and hang longer in the air
	local dur = 1.0 + tier.index * 0.05
	local apex = 8 + tier.index * 0.8
	local t0 = os.clock()
	local conn
	-- the leap cinematic grows with the rarity: commons get a quick look, rare fish a slow,
	-- low, circling shot, the top tiers letterboxed with a hit of stillness at the apex
	if isLocal then
		local ti = tier.index
		if ti <= 1 then
			CameraController.stop()
		else
			dur = 0.9 + ti * 0.14
			apex = 7 + ti * 1.0
			local lastP = from
			local big = ti >= 5
			if big then
				Cine.letterbox(true)
				task.delay(dur + 0.5, function() Cine.letterbox(false) end)
			end
			CameraController.run(function(t)
				local u = math.clamp(t / dur, 0, 1)
				local pp = model.Parent and model.PrimaryPart
				if pp then lastP = pp.Position end
				local p = lastP
				local orbit = CFrame.Angles(0, (u - 0.5) * (0.4 + ti * 0.12), 0):VectorToWorldSpace(root.CFrame.RightVector)
				local cam = p + orbit * (7 - 2 * u) + Vector3.new(0, 1.2 + u * (0.5 + ti * 0.15), 0) + (root.Position - p).Unit * 3
				return CFrame.lookAt(cam, p), 54 - u * (6 + ti * 1.5)
			end, dur + 0.3, { smooth = 10, blendIn = 0.2 })
			CameraController.punch(-4 - ti)
			if big then CameraController.shake(0.5 + ti * 0.08, 0.4) end
		end
	end
	local dropAcc = 0
	local lastP = from
	conn = RunService.RenderStepped:Connect(function(dt)
		-- eased: bursts out, hangs at the top, then drops into the hands
		local raw = math.clamp((os.clock() - t0) / dur, 0, 1)
		local u = Easing.sineInOut(raw)
		if tier.index >= 2 then
			-- SLOW MOTION at the top of the leap (longer for rarer fish)
			u = raw + (0.5 - raw) * math.min(0.5, 0.15 + tier.index * 0.05) * math.sin(raw * math.pi)
			u = Easing.sineInOut(math.clamp(u, 0, 1))
		end
		local to = root.Position + root.CFrame.LookVector * 1.6 + Vector3.new(0, 0.6, 0)
		local p = from:Lerp(to, u) + Vector3.new(0, 4 * apex * u * (1 - u), 0)
		local vel = p - lastP
		lastP = p
		-- nose follows the flight, a full somersault twist, wild wriggle
		local base = if vel.Magnitude > 1e-3 then CFrame.lookAt(p, p + vel) else CFrame.new(p)
		model:PivotTo(base * CFrame.Angles(0, 0, raw * math.pi * 2.2) * CFrame.Angles(0, math.sin(raw * 30) * 0.3, 0))
		-- water streaming off it while it climbs
		dropAcc += dt
		if raw < 0.6 and dropAcc > 0.04 then
			dropAcc = 0
			Fx.blocks(p, Color3.fromRGB(150, 205, 255), 2, 3, 0.16, { life = 0.7, up = -0.4, spread = 1.2, gravity = 45 })
		end
		if raw >= 1 then
			conn:Disconnect()
			Fx.blocks(p, Color3.fromRGB(150, 205, 255), 8, 6, 0.16, { life = 0.6, up = 0.8, spread = 2, gravity = 45 })
			model:Destroy()
		end
	end)
end

local function onFx(player: Player, phase: string, data)
	local isLocal = player == localPlayer
	if phase == "Cast" then
		if isLocal then
			HumanPose.localPose = "Cast"
			HumanPose.localPoseT = Clock.now()
			task.delay(1.35, function()
				if HumanPose.localPose == "Cast" then HumanPose.localPose = nil end
			end)
		end
		Sound.play("Cast", { parent = player.Character and player.Character:FindFirstChild("HumanoidRootPart") })
		local s = newSession(player, data.bobber, data.rod)
		s.phase = "Windup"
		s.t = 0
		if isLocal then castCamera(s) end
	elseif phase == "Bite" then
		local s = sessions[player]
		if not s then return end
		s.phase = "Bite"
		s.t = 0
		Fx.splash(data.bobber, 0.8)
		Fx.bubbles(data.bobber, 10)
		if isLocal then
			Sound.play("Bite")
			Sound.play("BigSplash", { at = data.bobber, volume = 0.6 })
			biteCamera(s, data.bobber)
			-- the mini-game starts by itself (no HOOK button)
			task.delay(0.35, function()
				Net.event("Hook"):FireServer()
			end)
		end
	elseif phase == "Miss" then
		local s = sessions[player]
		if s then s.phase = "Wait" s.t = 0 end
	elseif phase == "Hooked" then
		local s = sessions[player]
		if not s then return end
		s.phase = "Reel"
		s.t = 0
		s.difficulty = data.difficulty
		-- fish shadow under the surface
		local sh = Instance.new("Part")
		sh.Anchored = true
		sh.CanCollide = false
		sh.CanQuery = false
		sh.Color = Color3.fromRGB(20, 50, 90)
		sh.Transparency = 0.45
		sh.Size = Vector3.new(1.2, 0.1, 3) * (0.8 + data.difficulty * 0.15)
		sh.Material = Enum.Material.SmoothPlastic
		sh.Parent = Fx.folder
		s.shadow = sh
		if isLocal then
			Fishing.startReel(data.difficulty)
			reelCamera(s)
			s.jumpAt = os.clock() + 1.4 + math.random()
		end
	elseif phase == "Catch" then
		local s = sessions[player]
		local from = (s and s.bobPos) or data.bobber
		cleanup(s)
		sessions[player] = nil
		leap(player, Vector3.new(from.X, Layout.WATER_Y, from.Z), data.fish, isLocal)
		if isLocal then Fishing.stopReel() end
	elseif phase == "Snap" or phase == "Release" then
		local s = sessions[player]
		if s and s.bobPos then Fx.splash(s.bobPos, 0.7) end
		cleanup(s)
		sessions[player] = nil
		if isLocal then
			Fishing.stopReel()
			CameraController.stop()
			if phase == "Snap" then
				Sound.play("Snap")
				CameraController.shake(1, 0.3)
			end
		end
	elseif phase == "Reset" then
		cleanup(sessions[player])
		sessions[player] = nil
		if isLocal then
			Fishing.stopReel()
			CameraController.stop()
		end
	end
end

-- per-frame visuals of all sessions
local function step(dt: number)
	local now = os.clock()
	for player, s in sessions do
		if s.dead then continue end
		s.t += dt
		local tip = tipPos(player)
		if tip then s.anchor.CFrame = CFrame.new(tip) end
		local water = Layout.WATER_Y + 0.15
		if s.phase == "Windup" then
			setBobber(s, tip or s.from)
			s.beam.Enabled = false
			if s.t > 0.42 then
				s.phase = "Flying"
				s.t = 0
				s.from = tip or s.from
				s.beam.Enabled = true
			end
		elseif s.phase == "Flying" then
			local dur = 0.6
			local u = math.clamp(s.t / dur, 0, 1)
			local p = s.from:Lerp(s.target, Easing.quadOut(u)) + Vector3.new(0, 7 * u * (1 - u) * 2, 0)
			setBobber(s, p, (1 - u) * 1.2)
			s.beam.CurveSize0 = 0
			s.beam.CurveSize1 = 0
			if u >= 1 then
				s.phase = "Wait"
				s.t = 0
				Fx.splash(s.target, 0.7)
				Sound.play("Splash", { at = s.target })
			end
		elseif s.phase == "Wait" then
			local bob = math.sin(now * 2.2 + s.target.X) * 0.12
			setBobber(s, Vector3.new(s.target.X, water + bob, s.target.Z), math.sin(now * 1.7) * 0.12)
			s.beam.CurveSize0 = -1.5
			s.beam.CurveSize1 = 0.5
			s.ripT = (s.ripT or 0) + dt
			if s.ripT > 1.8 then
				s.ripT = 0
				Fx.ripple(s.bobPos, 0.8)
			end
		elseif s.phase == "Bite" then
			-- three quick dips
			local dip = math.max(0, math.sin(s.t * 18)) * (if s.t < 1.2 then 0.7 else 0.3)
			setBobber(s, Vector3.new(s.target.X + math.sin(s.t * 30) * 0.08, water - dip, s.target.Z), math.sin(s.t * 25) * 0.4)
			s.beam.CurveSize0 = -0.6
			s.beam.CurveSize1 = 0.2
		elseif s.phase == "Reel" then
			-- bobber zig-zags toward the dock as the progress grows
			local prog = if player == localPlayer and Fishing.reel then Fishing.reel.progress else math.clamp(s.t / 4, 0, 0.9)
			local tension = if player == localPlayer and Fishing.reel then Fishing.reel.tension else 0.5 + math.sin(now * 3) * 0.2
			s.tension = tension
			local baseIdx = player:GetAttribute("Base")
			local base = if baseIdx then Layout.dockEnd(baseIdx) else s.target
			local p = s.target:Lerp(Vector3.new(base.X, water, base.Z + 2), prog * 0.85)
			local wig = math.sin(now * (5 + (s.difficulty or 1))) * (1.2 + (s.difficulty or 1) * 0.3)
			local bp = Vector3.new(p.X + wig, water - 0.25 - tension * 0.25, p.Z)
			setBobber(s, bp, math.sin(now * 14) * 0.35)
			s.beam.CurveSize0 = -0.2 * (1 - tension)
			s.beam.CurveSize1 = 0
			if s.shadow then
				s.shadow.CFrame = CFrame.new(bp + Vector3.new(math.sin(now * 3) * 1.5, -1.2, 1.5 + math.cos(now * 2.4))) * CFrame.Angles(0, now * 2, 0)
			end
			s.ripT = (s.ripT or 0) + dt
			if s.ripT > 0.25 then
				s.ripT = 0
				Fx.ripple(bp, 0.5 + tension * 0.6)
				if tension > 0.6 then Fx.bubbles(bp, 2) end
				-- heavy thrashing: water flying off the line
				if tension > 0.45 then
					Fx.blocks(bp + Vector3.new(0, 0.3, 0), Color3.fromRGB(150, 210, 255), 3, 7 + tension * 6, 0.16, { life = 0.5, up = 2, spread = 1.4, gravity = 45 })
				end
			end
			if player == localPlayer and s.jumpAt and now >= s.jumpAt then
				s.jumpAt = now + 2.2 + math.random() * 1.6
				fightJump(s)
			end
		end
		-- rod bend (tension) on every client
		local rod = rodOf(player)
		if rod then
			-- springy rod: lags back on the wind-up, whips forward on release, wobbles, bends with tension
			local target
			if s.phase == "Windup" then
				target = -0.35 * Easing.cubicOut(math.clamp(s.t / 0.42, 0, 1))
			elseif s.phase == "Flying" and s.t < 0.18 then
				target = 0.6
			elseif s.phase == "Reel" then
				target = 0.12 + s.tension * 0.5 + math.sin(now * 9) * 0.04 * s.tension
			elseif s.phase == "Bite" then
				target = 0.3 + math.abs(math.sin(s.t * 18)) * 0.2
			else
				target = 0.04 + math.sin(now * 2) * 0.015
			end
			s.bendV = (s.bendV or 0) + ((target - s.bend) * 260 - (s.bendV or 0) * 14) * dt
			s.bend += s.bendV * dt
			for i = 1, 3 do
				local m = rod:FindFirstChild("Bend" .. i, true)
				if m then (m :: Motor6D).Transform = CFrame.Angles(-s.bend * (0.4 + i * 0.3), 0, 0) end
			end
		end
	end
end

------------------------------------------------------------------------------------
-- local reel mini-game
------------------------------------------------------------------------------------
local Rc = GameConfig.Reel

function Fishing.bindUI(reelUI)
	ui = reelUI
end

--[[ "Keep the fish in the zone": hold the screen to push the green zone right,
     release and it slides back (gravity + inertia). The fish swims on its own:
     smooth glides, sudden darts, pauses, frenzies for rare fish. Progress fills
     while the fish is inside the zone (a combo speeds it up) and drains outside.
     Rarer fish = smaller zone, faster fish, more darts, faster drain. ]]
function Fishing.startReel(difficulty: number)
	local d = math.clamp(difficulty or 1, 1, 9)
	Fishing.reel = {
		difficulty = d, done = false, start = os.clock(), holding = false,
		zone = 0.3, zoneV = 0, zoneSize = math.max(Rc.zoneMin, Rc.zoneSize - Rc.zoneShrink * (d - 1)),
		fish = 0.5, fishTarget = 0.5, fishSpeed = 0, nextMove = os.clock() + 0.4, frenzy = 0,
		progress = Rc.start, inside = true, inTime = 0, combo = 0, tension = 0.3,
	}
	if ui then ui.show(d) end
end

function Fishing.stopReel()
	Fishing.reel = nil
	if ui then ui.hide() end
	HumanPose.localPose = nil
	HumanPose.tension = nil
end

local function finishReel(success: boolean)
	local r = Fishing.reel
	if not r or r.done then return end
	r.done = true
	-- server requires a minimum reel time: wait for it if needed
	local wait = GameConfig.Fishing.reelMinTime + 0.15 - (os.clock() - r.start)
	if wait > 0 then task.wait(wait) end
	Net.event("ReelFinish"):FireServer(success)
end

local function reelStep(dt: number)
	local r = Fishing.reel
	if not r or r.done then return end
	r.holding = Actions.held and Actions.context == "Reel"
	local now = os.clock()
	local d = r.difficulty
	-- zone physics
	local acc = if r.holding then Rc.push else -Rc.gravity
	r.zoneV += acc * dt
	r.zoneV -= r.zoneV * Rc.damping * dt
	r.zone += r.zoneV * dt
	local half = r.zoneSize / 2
	if r.zone < half then
		r.zone = half
		r.zoneV = -r.zoneV * Rc.bounce
	elseif r.zone > 1 - half then
		r.zone = 1 - half
		r.zoneV = -r.zoneV * Rc.bounce
	end
	-- fish brain
	if now >= r.nextMove then
		local roll = rand:NextNumber()
		local de = math.min(d, 8) -- Impossible fish swim like Ultra Secret ones (only the zone is smaller)
		local speed = Rc.fishSpeed + Rc.fishSpeedPerTier * (de - 1)
		if d >= 5 and roll < 0.07 * (de - 4) and r.frenzy <= 0 then
			r.frenzy = 1.2 + rand:NextNumber() -- rare fish: thrashing frenzy
			Sound.play("Splash", { volume = 0.5 })
		end
		if roll < Rc.dartChance + Rc.dartPerTier * (de - 1) then
			-- dart: far, fast
			r.fishTarget = math.clamp(r.fish + (if rand:NextNumber() < 0.5 then -1 else 1) * (0.35 + rand:NextNumber() * 0.4), 0.05, 0.95)
			r.fishSpeed = speed * 2.4
			r.nextMove = now + 0.35 + rand:NextNumber() * 0.4
			Sound.play("Reel", { pitch = 0.6 })
			-- the fish YANKS: the rod jerks, the view shakes, a splash at the line
			CameraController.shake(0.25 + math.min(d, 8) * 0.03, 0.18)
			r.tension = 1
			r.yankT = now
			local s = sessions[localPlayer]
			if s and s.bobPos then
				Fx.blocks(s.bobPos + Vector3.new(0, 0.3, 0), Color3.fromRGB(160, 215, 255), 6, 9, 0.16, { life = 0.5, up = 2.4, spread = 1.2, gravity = 45 })
			end
		elseif roll > 0.85 then
			-- pause (feint)
			r.fishTarget = r.fish
			r.fishSpeed = 0
			r.nextMove = now + 0.3 + rand:NextNumber() * 0.5
		else
			r.fishTarget = math.clamp(0.08 + rand:NextNumber() * 0.84, 0.05, 0.95)
			r.fishSpeed = speed * (0.7 + rand:NextNumber() * 0.6)
			r.nextMove = now + 0.6 + rand:NextNumber() * (1.4 - math.min(0.9, d * 0.1))
		end
	end
	local fs = r.fishSpeed
	if r.frenzy > 0 then
		r.frenzy -= dt
		r.fishTarget = math.clamp(r.fish + math.sin(now * 23) * 0.12, 0.05, 0.95)
		fs = math.max(fs, 1.1 + math.min(d, 8) * 0.08)
	end
	local diff = r.fishTarget - r.fish
	r.fish += math.clamp(diff, -fs * dt, fs * dt)
	-- progress
	r.inside = math.abs(r.fish - r.zone) <= half
	if r.inside then
		r.inTime += dt
		local before = math.floor(r.combo or 0)
		r.combo = math.min(5, r.inTime / Rc.comboTime)
		if math.floor(r.combo) > before then
			-- combo step: a rising "ding"
			Sound.play("Tick", { pitch = 1.2 + math.floor(r.combo) * 0.15, volume = 0.6 })
		end
		local boost = if r.combo >= 1 then Rc.comboBoost else 1
		r.progress += Rc.fill * boost * dt
		r.tension = 0.25 + math.abs(r.fish - r.zone) / half * 0.3
	else
		if r.inTime > 0 then r.inTime = 0 r.combo = 0 end
		r.progress -= (Rc.drain + Rc.drainPerTier * (math.min(d, 8) - 1)) * dt
		r.tension = math.min(1, 0.65 + math.abs(r.fish - r.zone) * 0.8)
	end
	r.progress = math.clamp(r.progress, 0, 1)
	r.reelSound = (r.reelSound or 0) + dt
	if r.holding and r.reelSound > 0.12 then
		r.reelSound = 0
		Sound.play("Reel", { volume = 0.5, pitch = 1 + (if r.inside then 0.2 else -0.1) })
	end
	if ui then ui.update(r) end
	-- a yank spikes the tension for a moment (the pose leans hard into it)
	local yank = if r.yankT then math.max(0, 1 - (now - r.yankT) / 0.35) else 0
	HumanPose.tension = math.min(1, r.tension + yank * 0.5)
	if r.progress <= 0 then
		task.spawn(finishReel, false)
	elseif r.progress >= 1 then
		task.spawn(finishReel, true)
	end
end

function Fishing.init()
	Net.event("FishingFx").OnClientEvent:Connect(onFx)
	RunService.RenderStepped:Connect(function(dt)
		dt = math.min(dt, 0.1)
		step(dt)
		reelStep(dt)
	end)
	Actions.on("Cast", function() Net.event("Cast"):FireServer() end)
	Actions.on("Stop", function() Net.event("StopFishing"):FireServer() end)
	Actions.on("Hook", function()
		Net.event("Hook"):FireServer()
		CameraController.punch(-4)
	end)
	Actions.on("Reel", function() end, function() end)
	Players.PlayerRemoving:Connect(function(p)
		cleanup(sessions[p])
		sessions[p] = nil
	end)
end

return Fishing
