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
	-- rarer fish leap higher and hang longer in the air
	local dur = 1.0 + tier.index * 0.05
	local apex = 8 + tier.index * 0.8
	local t0 = os.clock()
	local conn
	if isLocal and tier.index >= 3 then
		-- quick cinematic focus on the leaping fish (slow push-in, a beat of hang time)
		local lastP = from
		CameraController.run(function(t)
			local u = math.clamp(t / dur, 0, 1)
			local pp = model.Parent and model.PrimaryPart
			if pp then lastP = pp.Position end
			local p = lastP
			local side = (root.CFrame.RightVector * (7 - 2 * u) + Vector3.new(0, 1.5 + u, 0))
			return CFrame.lookAt(p + side + (root.Position - p).Unit * 4, p), 52 - u * 10
		end, dur + 0.25, { smooth = 10, blendIn = 0.25 })
		CameraController.punch(-6)
	end
	local dropAcc = 0
	local lastP = from
	conn = RunService.RenderStepped:Connect(function(dt)
		-- eased: bursts out, hangs at the top, then drops into the hands
		local raw = math.clamp((os.clock() - t0) / dur, 0, 1)
		local u = Easing.sineInOut(raw)
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
			HumanPose.localPoseT = workspace:GetServerTimeNow()
			task.delay(1.35, function()
				if HumanPose.localPose == "Cast" then HumanPose.localPose = nil end
			end)
		end
		Sound.play("Cast", { parent = player.Character and player.Character:FindFirstChild("HumanoidRootPart") })
		local s = newSession(player, data.bobber, data.rod)
		s.phase = "Windup"
		s.t = 0
	elseif phase == "Bite" then
		local s = sessions[player]
		if not s then return end
		s.phase = "Bite"
		s.t = 0
		Fx.splash(data.bobber, 0.8)
		Fx.bubbles(data.bobber, 10)
		if isLocal then
			Sound.play("Bite")
			CameraController.shake(0.6, 0.25)
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
		if isLocal then Fishing.startReel(data.difficulty) end
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
			if phase == "Snap" then
				Sound.play("Snap")
				CameraController.shake(1, 0.3)
			end
		end
	elseif phase == "Reset" then
		cleanup(sessions[player])
		sessions[player] = nil
		if isLocal then Fishing.stopReel() end
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
		r.combo = math.min(5, r.inTime / Rc.comboTime)
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
	HumanPose.tension = r.tension
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
