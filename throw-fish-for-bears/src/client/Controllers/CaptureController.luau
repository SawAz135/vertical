--[[ CaptureController: the local player's bear sequence.
     Spawned  -> establishing shot of the landing spot and the den
     Alert    -> push-in on the bear's face (growl)
     Run      -> side tracking shot of the running bear (footsteps)
     Eat      -> low side angle (arrive + sniff), close 3/4 on the mouth (bite,
                 chew, crumbs), front pull-back (happy), 360 orbit + flash (transform)
     Controlling -> you ARE the bear: return HUD (distance, progress, timer), 3D arrow
                 to your base, SPRINT (Shift / button), dust + footsteps
     Arrived / Captured -> celebration, reveal card, carry the bear home and PLACE it
     Placement ghost: a ring under the spot where PLACE will put the bear. ]]
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local Layout = require(Shared.Layout)
local GameConfig = require(Shared.Config.GameConfig)
local BearConfig = require(Shared.Config.BearConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local Easing = require(Shared.Util.Easing)
local Format = require(Shared.Util.Format)
local Fx = require(script.Parent.Fx)
local Sound = require(script.Parent.Sound)
local Actions = require(script.Parent.Actions)
local CameraController = require(script.Parent.CameraController)
local Cine = require(script.Parent.CinematicFx)
local TweenService = game:GetService("TweenService")
local Sim = require(script.Parent.Parent.UI.Sim)
local K = require(script.Parent.Parent.UI.Kit)
local Data = require(script.Parent.Data)
local Theme = require(script.Parent.Parent.UI.Theme)

local Capture = {}
local player = Players.LocalPlayer
local current = nil -- { bear, fish, landing, den }
local returnGui, returnFill, returnText, returnTimer, returnName
local arrow
local controlling = nil
local sprinting = false
local ghost

Capture.Reveal = nil -- set by ClientMain (UI.Reveal)
Capture.Flash = nil -- set by ClientMain (screen flash function)
Capture.Unlock = nil -- set by ClientMain (UI.BearUnlock.show)

local function headOf(bear: Model): BasePart?
	return bear and bear:FindFirstChild("Head") :: BasePart?
end

local function rootOf(m: Model?): BasePart?
	return m and m.PrimaryPart
end

local function rarityOf(bear: Model?)
	return RarityConfig.get(bear and bear:GetAttribute("Rarity") or "Common")
end

local function bearPitch(bear: Model): number
	return Sound.BearPitch[bear:GetAttribute("Species") or ""] or 1
end

-- FISH POV + bear reveal ---------------------------------------------------------------
-- The bear arrives as a black silhouette; its body parts get their colours back one by
-- one as it comes closer (legs, tail, body, head, jaw, ears). Rarity effects (aura,
-- lights, rainbow) stay hidden until the rarity roulette lands.
-- 6 "members": 4 legs, the body (+ tail), the head (+ jaw, ears)
local REVEAL_ORDER = { "LegFLBone", "LegFRBone", "LegBLBone", "LegBRBone", "Torso", "Head" }
local GROUP_OF = { TailBone = "Torso", JawBone = "Head", EarBoneL = "Head", EarBoneR = "Head" }
local SHADOW = Color3.fromRGB(12, 10, 16)

local function prepareReveal(bear: Model)
	local rv = { groups = {}, saved = {}, fx = {}, idx = 0, bear = bear }
	for _, d in bear:GetDescendants() do
		if d:IsA("BasePart") and d.Transparency < 1 then
			local w = d:FindFirstChildOfClass("WeldConstraint")
			local bone = if w and w.Part0 then w.Part0.Name else "Torso"
			bone = GROUP_OF[bone] or bone
			if not table.find(REVEAL_ORDER, bone) then bone = "Torso" end
			rv.groups[bone] = rv.groups[bone] or {}
			table.insert(rv.groups[bone], d)
			rv.saved[d] = { d.Color, d.Material }
			d.Color = SHADOW
			d.Material = Enum.Material.SmoothPlastic
		elseif d:IsA("ParticleEmitter") or d:IsA("PointLight") or d:IsA("Sparkles") then
			rv.fx[d] = d.Enabled
			d.Enabled = false
		end
	end
	bear:SetAttribute("Silhouette", true)
	return rv
end

local function revealGroup(rv, bone: string, loud: boolean)
	local parts = rv.groups[bone]
	if not parts then return end
	rv.groups[bone] = nil
	local at
	for _, part in parts do
		local sv = rv.saved[part]
		if sv and part.Parent then
			part.Material = sv[2]
			part.Color = Color3.new(1, 1, 1)
			TweenService:Create(part, TweenInfo.new(0.35, Enum.EasingStyle.Quad), { Color = sv[1] }):Play()
			at = at or part.Position
		end
	end
	if at and loud then
		Fx.blocks(at, Color3.new(1, 1, 1), 5, 7, 0.22, { life = 0.5, up = 1, spread = 2 })
		Sound.play("Tick", { pitch = 0.8 + rv.idx * 0.08, volume = 0.6 })
	end
end

local function revealNext(rv)
	rv.idx += 1
	local bone = REVEAL_ORDER[rv.idx]
	if bone then revealGroup(rv, bone, true) end
end

local function revealAll(rv)
	for _, bone in REVEAL_ORDER do revealGroup(rv, bone, false) end
	for bone in rv.groups do revealGroup(rv, bone, false) end
end

local function revealAura(rv)
	for inst, en in rv.fx do
		if inst.Parent then inst.Enabled = en end
	end
	rv.fx = {}
	if rv.bear then rv.bear:SetAttribute("Silhouette", nil) end
end

-- the fish's eyes: lying on the ground, looking at what comes out of the forest
local function fishPOV()
	local c = current
	c.pov = true
	c.rv = prepareReveal(c.bear)
	-- hide the fish itself (the camera is in its head)
	if c.fish then
		for _, d in c.fish:GetDescendants() do
			if d:IsA("BasePart") then d.LocalTransparencyModifier = 1 end
		end
	end
	Cine.letterbox(false)
	Cine.eyelids(true)
	Cine.setLids(0)
	local startDist = math.max(8, (Vector3.new(c.den.X, 0, c.den.Z) - Vector3.new(c.landing.X, 0, c.landing.Z)).Magnitude)
	local nextBlink, blinkT, beatT = 0.25, 0.3, 0.6
	CameraController.run(function(t, dt)
		local r = rootOf(c.bear)
		local h = headOf(c.bear)
		local eye = c.landing + Vector3.new(0, 0.85, 0)
		local target = if h then h.Position else c.den + Vector3.new(0, 3, 0)
		local dist = if r then (Vector3.new(r.Position.X, 0, r.Position.Z) - Vector3.new(c.landing.X, 0, c.landing.Z)).Magnitude else startDist
		local p = 1 - math.clamp((dist - 4) / startDist, 0, 1) -- 0 far .. 1 right here
		if c.revealing then p = 1 end -- the bear is right over the fish: maximum panic
		-- panic: red edges, blur, heartbeat, shake
		local stress = math.clamp(0.12 + p * 0.95, 0, 1)
		Cine.stress(stress * 0.9)
		Cine.setBlur(1.5 + stress * 5)
		beatT -= dt
		if beatT <= 0 then
			beatT = 1.15 - stress * 0.8
			Sound.play("Heartbeat", { pitch = 0.85 + stress * 0.35 })
			task.delay(0.17, function() Sound.play("Heartbeat", { volume = 0.3, pitch = 0.95 + stress * 0.35 }) end)
			CameraController.shake(0.04 + stress * 0.22, 0.12)
		end
		-- eyelids: opening at the start, squinting with fear, blinking faster and faster
		local open = math.min(1, t / 0.6) * (1 - stress * 0.2)
		nextBlink -= dt
		if nextBlink <= 0 then
			blinkT = 0.2
			nextBlink = math.max(0.22, (2.7 - stress * 2.4)) * (0.7 + math.random() * 0.6)
		end
		if blinkT > 0 then
			blinkT -= dt
			open *= math.abs((blinkT / 0.2) * 2 - 1)
		end
		Cine.setLids(open)
		-- fish eye: low, breathing sway, the view tunnels in as the bear gets close
		local sway = Vector3.new(math.sin(t * 2.1) * 0.08, math.sin(t * 3.3) * 0.06, 0)
		return CFrame.lookAt(eye + sway, target + Vector3.new(0, -0.2, 0)), 80 - p * 22
	end, 60, { smooth = 8, blendIn = 0.25 })
end

-- REVEAL COUNTERS (stud GUI, top of the screen): LUCK and SIZE climb a little with every
-- uncovered body part; after the 6th the name + rarity card slams in.
local function buildCounters()
	local g = Sim.new("ScreenGui", { Name = "TFBRevealCounters", ResetOnSpawn = false, DisplayOrder = 13, IgnoreGuiInset = true,
		ScreenInsets = Enum.ScreenInsets.DeviceSafeInsets, ZIndexBehavior = Enum.ZIndexBehavior.Sibling }, player:WaitForChild("PlayerGui"))
	local root = Sim.root(g, "Counters", Vector2.new(560, 130), UDim2.new(0.5, 0, 0, 10), Vector2.new(0.5, 0))
	local inner = Sim.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1) }, root)
	local pop = Sim.new("UIScale", { Scale = 0 }, inner)
	TweenService:Create(pop, TweenInfo.new(0.4, Enum.EasingStyle.Back), { Scale = 1 }):Play()
	local function box(x, title, grad)
		local b = Sim.panel(inner, { Size = UDim2.fromOffset(260, 96), Position = UDim2.fromOffset(x, 4), Gradient = grad, Stroke = 4, ZIndex = 4, Clip = true })
		Sim.bands(b, 0.6, 5)
		Sim.text(b, title, { Size = UDim2.fromOffset(240, 26), Position = UDim2.fromOffset(130, 18), Max = 22, ZIndex = 7 })
		local v = Sim.text(b, "", { Size = UDim2.fromOffset(240, 54), Position = UDim2.fromOffset(130, 60), Max = 50, Stroke = 4.5, ZIndex = 7,
			Gradient = { Color3.new(1, 1, 1), Color3.fromRGB(255, 236, 140) } })
		return b, v, Sim.new("UIScale", {}, v)
	end
	local _, luckV, luckS = box(10, "🍀 LUCK", Sim.G.green)
	local _, sizeV, sizeS = box(290, "⚖️ SIZE", Sim.G.blue)
	-- 6 member pips under the counters
	local pips = {}
	for i = 1, 6 do
		local pip = Sim.panel(inner, { Size = UDim2.fromOffset(52, 18), Position = UDim2.fromOffset(98 + (i - 1) * 62, 108), Color = Color3.fromRGB(40, 40, 46), Stroke = 2.5, ZIndex = 4 })
		pips[i] = pip
	end
	local stamp = Sim.text(g, "", { Size = UDim2.fromOffset(460, 70), Position = UDim2.new(0.5, 0, 0, 190), Max = 60, Stroke = 5, ZIndex = 9,
		Gradient = { Color3.fromRGB(255, 255, 200), Color3.fromRGB(255, 190, 20) } })
	local ss = Sim.new("UIScale", { Scale = 0 }, stamp)
	local ui = {}
	local function bump(sc)
		sc.Scale = 1.45
		TweenService:Create(sc, TweenInfo.new(0.3, Enum.EasingStyle.Back), { Scale = 1 }):Play()
	end
	function ui.set(luck: number, kg: number, i: number, popIt: boolean)
		luckV.Text = ("x%.1f"):format(luck)
		sizeV.Text = Format.kg(kg)
		if popIt then
			bump(luckS)
			bump(sizeS)
			local pip = pips[i]
			if pip then
				pip.BackgroundColor3 = Color3.fromRGB(255, 220, 60)
				local ps = Sim.new("UIScale", { Scale = 1.6 }, pip)
				TweenService:Create(ps, TweenInfo.new(0.3, Enum.EasingStyle.Back), { Scale = 1 }):Play()
			end
		end
	end
	function ui.shake(amount: number)
		local t = os.clock()
		inner.Position = UDim2.fromOffset(math.sin(t * 61) * amount, math.cos(t * 47) * amount)
	end
	function ui.stamp(text: string)
		stamp.Text = text
		ss.Scale = 3
		TweenService:Create(ss, TweenInfo.new(0.3, Enum.EasingStyle.Back), { Scale = 1 }):Play()
	end
	function ui.close()
		TweenService:Create(pop, TweenInfo.new(0.25, Enum.EasingStyle.Back, Enum.EasingDirection.In), { Scale = 0 }):Play()
		TweenService:Create(ss, TweenInfo.new(0.25), { Scale = 0 }):Play()
		task.delay(0.3, function() g:Destroy() end)
	end
	return ui
end

-- the big name + rarity card after the 6th member
local function nameCard(d)
	local tier = RarityConfig.get(d.final)
	local col = tier.textColor or tier.color
	local spec = BearConfig.get(d.species or "BrownBear")
	local variant = if d.variant and d.variant ~= "Normal" then d.variant .. " " else ""
	local g = Sim.new("ScreenGui", { Name = "TFBNameCard", ResetOnSpawn = false, DisplayOrder = 13, IgnoreGuiInset = true,
		ScreenInsets = Enum.ScreenInsets.DeviceSafeInsets, ZIndexBehavior = Enum.ZIndexBehavior.Sibling }, player:WaitForChild("PlayerGui"))
	local root = Sim.root(g, "NameCard", Vector2.new(560, 150), UDim2.new(0.5, 0, 0, 14), Vector2.new(0.5, 0))
	local inner = Sim.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1) }, root)
	local pop = Sim.new("UIScale", { Scale = 2.4 }, inner)
	TweenService:Create(pop, TweenInfo.new(0.35, Enum.EasingStyle.Back), { Scale = 1 }):Play()
	local card = Sim.panel(inner, { Size = UDim2.fromOffset(540, 130), Position = UDim2.fromOffset(10, 6), Gradient = Sim.RARITY_CARD[d.final] or Sim.G.light, Stroke = 5, StrokeColor = col, ZIndex = 4, Clip = true })
	Sim.bands(card, 0.55, 5)
	K.shine(card, 1.4)
	Sim.text(card, variant .. spec.name, { Size = UDim2.fromOffset(520, 58), Position = UDim2.fromOffset(270, 40), Max = 52, Stroke = 4.5, ZIndex = 8 })
	Sim.text(card, tier.name:upper(), { Size = UDim2.fromOffset(500, 44), Position = UDim2.fromOffset(270, 96), Max = 40, Stroke = 4.5, ZIndex = 8,
		Color = if d.final == "Secret" then Color3.fromRGB(30, 30, 36) else Color3.new(1, 1, 1), Gradient = if d.final == "Secret" then nil else { Color3.new(1, 1, 1), col } })
	task.delay(math.max(0.5, (d.duration or 6) - GameConfig.Capture.revealLimb * 6 - 0.2), function()
		TweenService:Create(pop, TweenInfo.new(0.25, Enum.EasingStyle.Back, Enum.EasingDirection.In), { Scale = 0 }):Play()
		task.delay(0.3, function() g:Destroy() end)
	end)
end

local function revealSequence(d)
	local c = current
	if not c then return end
	local G = GameConfig.Capture
	c.revealing = true
	local ui = buildCounters()
	local luck, kg = d.luck or 1, d.weight or 0
	ui.set(1, 0, 0, false)
	local alive = true
	local shakeConn = RunService.RenderStepped:Connect(function()
		if alive then ui.shake(2 + (c.rv and c.rv.idx or 0) * 0.8) end
	end)
	task.spawn(function()
		for i = 1, 6 do
			task.wait(G.revealLimb)
			if not current or not c.bear.Parent then break end
			-- uncover one member, counters climb with a small random overshoot feel
			if c.rv then revealNext(c.rv) end
			local k = i / 6
			local shownLuck = 1 + (luck - 1) * (k ^ 1.6)
			if i == 6 and d.mult then
				-- the luck bonus explodes on the last member
				shownLuck = luck
				ui.stamp(("LUCK x%d!"):format(d.mult))
				Cine.flash(0.55, Color3.fromRGB(255, 210, 50))
				Sound.play("Transform")
			end
			ui.set(shownLuck, kg * (0.35 + 0.65 * k), i, true)
			Sound.play("Heartbeat", { pitch = 1 + i * 0.08 })
			CameraController.shake(0.15 + i * 0.08, 0.2)
			CameraController.punch(-2 - i * 0.6)
		end
		-- all 6 members uncovered: eyes shut... and open on the full bear
		alive = false
		shakeConn:Disconnect()
		task.wait(0.15)
		Cine.setLids(0)
		task.wait(0.18)
		Cine.eyelids(false)
		Cine.stress(0)
		Cine.letterbox(true)
		if c.fish then
			for _, dd in c.fish:GetDescendants() do
				if dd:IsA("BasePart") then dd.LocalTransparencyModifier = 0 end
			end
		end
		if c.rv then
			revealAll(c.rv)
			revealAura(c.rv)
		end
		ui.close()
		local tier = RarityConfig.get(d.final)
		local col = tier.textColor or tier.color
		Cine.flash(0.6, col)
		local r = rootOf(c.bear)
		if r then
			Cine.shockwave(r.Position - Vector3.new(0, r.Position.Y - 0.3, 0), col, 1 + tier.index * 0.1)
			Fx.sparkle(r.Position, col, 12 + tier.index * 4, 18)
		end
		if tier.index >= 4 then Cine.rarityTint(col, 0.4 + tier.index * 0.04) end
		Sound.play("Reveal" .. math.max(1, tier.reveal))
		CameraController.shake(0.5 + tier.index * 0.08, 0.4)
		nameCard(d)
		-- hero shot of the revealed bear until the eating cinematic takes over
		CameraController.run(function(t)
			local rr = rootOf(c.bear)
			local h = headOf(c.bear)
			if not rr then return nil, 55 end
			local sc = c.bear:GetAttribute("Scale") or 1
			local fwd = rr.CFrame.LookVector
			local dir = CFrame.Angles(0, 0.5 - t * 0.2, 0):VectorToWorldSpace(fwd)
			local p = rr.Position + dir * (9 + t * 1.5) * sc + Vector3.new(0, 0.8 * sc, 0)
			return CFrame.lookAt(p, if h then h.Position else rr.Position), 52
		end, 4, { smooth = 8, blendIn = 0.25 })
	end)
end

-- shots --------------------------------------------------------------------------
local function alertShot()
	local c = current
	CameraController.run(function(t)
		local r = rootOf(c.bear)
		local h = headOf(c.bear)
		if not r or not h then return nil, 55 end
		local fwd = r.CFrame.LookVector
		local right = r.CFrame.RightVector
		-- "vertigo" dolly zoom: the camera backs off while the lens zooms in
		local k = Easing.cubicOut(math.clamp(t / 0.7, 0, 1))
		local d = 7 + k * 6
		local fov = 62 - k * 26
		local p = h.Position + fwd * d + right * 3.2 + Vector3.new(0, 1.1, 0)
		return CFrame.lookAt(p, h.Position), fov
	end, 60, { smooth = 9, blendIn = 0.35 })
	CameraController.punch(-5)
	Cine.pop(headOf(c.bear), "!", Color3.fromRGB(255, 225, 50), 130, 1.1)
end

local function runShot()
	local c = current
	local stepT = 0
	local whip = false
	Cine.speedLines(true)
	CameraController.run(function(t, dt)
		local r = rootOf(c.bear)
		if not r then return nil, 60 end
		local fwd = r.CFrame.LookVector
		local right = r.CFrame.RightVector
		local sc = c.bear:GetAttribute("Scale") or 1
		stepT += dt
		if stepT > 0.26 / math.max(0.8, (c.bear:GetAttribute("Gait") or 1)) then
			stepT = 0
			Sound.play("Footstep", { at = r.Position, pitch = 0.8 / sc })
			Fx.dust(r.Position - Vector3.new(0, r.Position.Y - 0.2, 0), 0.45 * sc)
			CameraController.shake(0.25 * sc, 0.12) -- heavy paws hit the ground
		end
		if t < 1.0 then
			-- low ground shot in front: the bear charges straight at the lens
			local p = r.Position + fwd * (9 + t * 6) * sc + Vector3.new(0, -r.Position.Y + 1.2, 0) + right * 1.5
			return CFrame.lookAt(p, r.Position + Vector3.new(0, 0.6 * sc, 0)), 70
		end
		if not whip then
			whip = true
			CameraController.punch(6) -- whip pan to the tracking shot
		end
		-- side tracking shot with a little handheld sway
		local sway = Vector3.new(math.sin(t * 9) * 0.25, math.abs(math.sin(t * 9)) * 0.35, 0)
		local p = r.Position + right * (10 * sc) + Vector3.new(0, 3.5 * sc, 0) - fwd * 2.5 + sway
		return CFrame.lookAt(p, r.Position + fwd * 5), 66
	end, 60, { smooth = 7, blendIn = 0.3 })
end

local function eatSequence(d)
	local c = current
	local tl = d.tl
	local start = d.start
	local bitten, swallowed, happy, transformed = false, false, false, false
	local nextChew = 0
	local shocked = false
	Cine.speedLines(false)
	local tier = rarityOf(c.bear)
	CameraController.run(function()
		local now = workspace:GetServerTimeNow()
		local t = now - start
		local r = rootOf(c.bear)
		local h = headOf(c.bear)
		if not r or not h then return nil, 55 end
		local fwd = r.CFrame.LookVector
		local right = r.CFrame.RightVector
		local up = Vector3.new(0, 1, 0)
		local sc = c.bear:GetAttribute("Scale") or 1
		local mouth = h:FindFirstChild("MouthAtt") and (h:FindFirstChild("MouthAtt") :: Attachment).WorldPosition or h.Position
		if t < tl.eat then
			-- low side angle, slow dolly in over arrive + sniff
			local k = Easing.sineInOut(math.clamp(t / tl.eat, 0, 1))
			local p = mouth + right * (8 - 2.5 * k) * sc + up * (0.6 * sc) + fwd * (1.5 * sc)
			if t > tl.sniff and t < tl.sniff + 0.1 then Sound.play("Sniff", { at = mouth }) end
			return CFrame.lookAt(p, mouth + Vector3.new(0, -0.6, 0)), 52 - 6 * k
		elseif t < tl.happy then
			-- close 3/4 on the mouth: bite + chew
			local te = t - tl.eat
			if not bitten and te > GameConfig.Capture.pickupAt - 0.1 then
				bitten = true
				Sound.play("Chomp", { at = mouth, pitch = bearPitch(c.bear) })
				CameraController.shake(0.9, 0.25)
				CameraController.punch(-7)
				Cine.pop(h, "CHOMP!", Color3.fromRGB(255, 150, 40), 150, 0.9)
				nextChew = te + 0.35
			end
			if bitten and te >= nextChew and te < GameConfig.Capture.swallowAt + 0.3 then
				nextChew = te + 0.32
				Cine.pop(h, if math.random() < 0.5 then "NOM!" else "nom", Color3.fromRGB(255, 255, 255), 90, 0.7)
				Fx.blocks(mouth, Color3.fromRGB(255, 190, 170), 3, 6, 0.18, { life = 0.5, up = 1 })
				CameraController.punch(-1.5)
			end
			if not swallowed and te > GameConfig.Capture.swallowAt then
				swallowed = true
				Fx.blocks(mouth, Color3.fromRGB(255, 160, 140), 10, 8, 0.22, { life = 0.6, up = 1.2 })
				Sound.play("Chomp", { at = mouth, pitch = bearPitch(c.bear) * 1.2, volume = 0.6 })
			end
			local p = mouth + fwd * 5.5 * sc + right * 3 * sc + up * 1.4 * sc
			return CFrame.lookAt(p, mouth), 44
		elseif t < tl.transform then
			if not happy then
				happy = true
				Sound.play("Happy", { at = mouth, pitch = bearPitch(c.bear) })
				Cine.pop(h, "♥", Color3.fromRGB(255, 90, 130), 120, 1.2)
				Cine.hearts(h.Position + up * 1.5, 8)
			end
			local k = Easing.cubicOut(math.clamp((t - tl.happy) / (tl.transform - tl.happy), 0, 1))
			local p = r.Position + fwd * (9 + 6 * k) * sc + up * (3 + 4 * k) * sc + right * 2 * sc
			return CFrame.lookAt(p, r.Position + up * sc), 54
		else
			-- 360 orbit rising around the bear, flash at the end
			local k = math.clamp((t - tl.transform) / GameConfig.Capture.transform, 0, 1)
			if not transformed then
				transformed = true
				Sound.play("Transform")
			end
			local ang = Easing.cubicInOut(k) * math.pi * 2
			local radius = (13 - 4 * k) * sc
			local dir = CFrame.Angles(0, ang, 0):VectorToWorldSpace(fwd)
			local p = r.Position + dir * radius + up * (3 + 5 * k) * sc
			if k > 0.8 and not shocked then
				shocked = true
				Cine.shockwave(r.Position - Vector3.new(0, r.Position.Y - 0.3, 0), tier.textColor or tier.color, sc)
				if tier.index >= 4 then Cine.rarityTint(tier.textColor or tier.color, 0.6) end
			end
			if k > 0.85 and Capture.Flash then
				Capture.Flash(0.25)
			end
			return CFrame.lookAt(p, r.Position + up * sc), 56 + 12 * k
		end
	end, tl.total + 1.5, { smooth = 10, blendIn = 0.3 })
end

-- return HUD ----------------------------------------------------------------------
local function buildReturnHud()
	returnGui = Theme.new("ScreenGui", { Name = "ReturnHUD", ResetOnSpawn = false, IgnoreGuiInset = false, Enabled = false, DisplayOrder = 5 })
	local frame = Theme.block({
		Name = "Banner", Size = UDim2.fromOffset(360, 74), Position = UDim2.new(0.5, 0, 0, 58), AnchorPoint = Vector2.new(0.5, 0),
		Gradient = Theme.G.orange, Corner = 10, StrokeWidth = 3, Studs = 14, Parent = returnGui,
	})
	Theme.new("UIScale", { Name = "RootScale", Parent = returnGui })
	Theme.text({ Text = "RUN BACK TO YOUR BASE!", Size = UDim2.new(1, -16, 0, 26), Position = UDim2.fromOffset(8, 4), Max = 26, Stroke = 3, Parent = frame, Font = Theme.FontBold })
	returnName = Theme.text({ Text = "", Size = UDim2.new(1, -16, 0, 16), Position = UDim2.fromOffset(8, 30), Max = 16, Parent = frame, RichText = true })
	local bar = Theme.block({ Name = "Bar", Size = UDim2.new(1, -20, 0, 16), Position = UDim2.fromOffset(10, 50), Color = Color3.fromRGB(30, 30, 34), Corner = 8, StrokeWidth = 2, Parent = frame })
	returnFill = Theme.block({ Name = "Fill", Size = UDim2.fromScale(0, 1), Gradient = Theme.G.green, Corner = 8, StrokeWidth = 0, Parent = bar })
	returnText = Theme.text({ Text = "", Size = UDim2.fromScale(1, 1), Max = 13, Parent = bar, ZIndex = 3 })
	returnTimer = Theme.text({ Text = "", Size = UDim2.fromOffset(120, 22), Position = UDim2.new(0.5, 0, 1, 4), AnchorPoint = Vector2.new(0.5, 0), Max = 18, Parent = frame })
	returnGui.Parent = player:WaitForChild("PlayerGui")
	local function rescale()
		local vp = workspace.CurrentCamera.ViewportSize
		returnGui.RootScale.Scale = math.clamp(math.min(vp.X / 900, vp.Y / 420), 0.75, 1.6)
	end
	workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(rescale)
	rescale()
end

local function buildArrow()
	local m = Instance.new("Model")
	m.Name = "BaseArrow"
	local function part(size, cf, wedge)
		local p = Instance.new(if wedge then "WedgePart" else "Part")
		p.Size = size
		p.CFrame = cf
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.CastShadow = false
		p.Color = Color3.fromRGB(110, 255, 90)
		p.Material = Enum.Material.Neon
		p.Parent = m
		return p
	end
	local shaft = part(Vector3.new(0.9, 0.5, 2.6), CFrame.new(0, 0, 1.3))
	part(Vector3.new(0.5, 1.2, 1.2), CFrame.new(0.6, 0, -0.6) * CFrame.Angles(0, 0, math.pi / 2) * CFrame.Angles(math.pi, 0, 0), true)
	part(Vector3.new(0.5, 1.2, 1.2), CFrame.new(-0.6, 0, -0.6) * CFrame.Angles(0, 0, -math.pi / 2) * CFrame.Angles(math.pi, 0, 0), true)
	m.PrimaryPart = shaft
	m.WorldPivot = CFrame.new()
	return m
end

local function startControlling(d)
	controlling = d
	current = nil
	CameraController.resetOffset()
	CameraController.stop()
	workspace.CurrentCamera.CameraSubject = d.bear:FindFirstChildOfClass("Humanoid")
	if not returnGui then buildReturnHud() end
	local tier = RarityConfig.get(d.outcome.r)
	local name = BearConfig.get(d.outcome.s).name
	local variant = if d.outcome.v ~= "Normal" then d.outcome.v .. " " else ""
	local hex = (if tier.textColor then tier.textColor else tier.color):ToHex()
	returnName.Text = ('<font color="#%s">%s</font> %s%s · %s · %s'):format(hex, tier.name, variant, name, Format.kg(d.outcome.w), Format.perSec(d.income))
	returnGui.Enabled = true
	d.started = os.clock()
	arrow = buildArrow()
	arrow.Parent = Fx.folder
	if Capture.Flash then Capture.Flash(0.5) end
	local r = rootOf(d.bear)
	if r then
		Fx.burst(r.Position - Vector3.new(0, (d.bear:GetAttribute("HipHeight") or 1.6), 0), tier.color, (d.bear:GetAttribute("Scale") or 1))
		Fx.puff(r.Position, Color3.new(1, 1, 1), 18, 4)
	end
	if Capture.Reveal then Capture.Reveal.bearToast(d.outcome, d.income) end
	Sound.play("Growl", { pitch = bearPitch(d.bear) })
end

local function stopControlling()
	controlling = nil
	sprinting = false
	if returnGui then returnGui.Enabled = false end
	if arrow then arrow:Destroy() arrow = nil end
end

local function onFx(phase: string, d)
	if phase == "Spawned" then
		current = { bear = d.bear, fish = d.fish, landing = d.landing, den = d.den }
		fishPOV()
	elseif phase == "Alert" and current then
		if current.pov then
			Cine.pop(headOf(current.bear), "!", Color3.fromRGB(255, 225, 50), 130, 1.1)
			CameraController.punch(-6)
		else
			alertShot()
		end
		Sound.play("Growl", { at = rootOf(current.bear) and rootOf(current.bear).Position, pitch = bearPitch(current.bear) })
	elseif phase == "Run" and current then
		if not current.pov then runShot() end
	elseif phase == "Reveal" and current then
		revealSequence(d)
	elseif phase == "Eat" and current then
		eatSequence(d)
	elseif phase == "Controlling" then
		startControlling(d)
	elseif phase == "Arrived" then
		local r = controlling and rootOf(controlling.bear)
		if r then
			Fx.blocks(r.Position + Vector3.new(0, 4, 0), Color3.new(1, 1, 1), 40, 26, 0.45, {
				colors = { Color3.fromRGB(255, 80, 80), Color3.fromRGB(255, 220, 60), Color3.fromRGB(80, 200, 255), Color3.fromRGB(120, 255, 120), Color3.fromRGB(255, 120, 230) },
				life = 1.6, up = 2.5, gravity = 40,
			})
		end
		Sound.play("Arrive")
		stopControlling()
	elseif phase == "Captured" then
		-- poof where the bear was, then it pops into your arms
		current = nil
		Cine.letterbox(false)
		if d.from then
			Fx.puff(d.from + Vector3.new(0, 3, 0), Color3.new(1, 1, 1), 22, 5)
			Fx.sparkle(d.from + Vector3.new(0, 3, 0), Color3.fromRGB(255, 230, 120), 18, 20)
		end
		CameraController.stop()
		if Capture.Flash then Capture.Flash(0.35) end
		task.delay(0.35, function()
			local char = player.Character
			local root = char and char:FindFirstChild("HumanoidRootPart")
			if root then
				Fx.burst(root.Position - Vector3.new(0, 2.8, 0), Color3.fromRGB(255, 220, 90), 0.7)
				Fx.blocks(root.Position + Vector3.new(0, 6, 0), Color3.new(1, 1, 1), 30, 22, 0.4, {
					colors = { Color3.fromRGB(255, 80, 80), Color3.fromRGB(255, 220, 60), Color3.fromRGB(80, 200, 255), Color3.fromRGB(120, 255, 120) },
					life = 1.4, up = 2.5, gravity = 40,
				})
			end
			Sound.play("Happy", { pitch = 1.1 })
			Sound.play("Arrive")
			-- full "BEAR UNLOCKED!" screen that waits for a tap
			if Capture.Unlock then
				Capture.Unlock(d.bear, d.income, d.isNew)
			elseif Capture.Reveal then
				Capture.Reveal.bear(d.bear, d.income, d.isNew)
			end
		end)
	elseif phase == "Failed" then
		if current and current.rv then revealAll(current.rv) revealAura(current.rv) end
		current = nil
		Cine.eyelids(false)
		Cine.letterbox(false)
		stopControlling()
		CameraController.stop()
	end
end

-- per frame: return HUD, arrow, sprint, placement ghost
local stepAcc = 0
local function step(dt: number)
	if controlling then
		local bear = controlling.bear
		local r = rootOf(bear)
		local base = player:GetAttribute("Base")
		if r and base then
			local c = Layout.BASE_CENTERS[base]
			local target = Vector3.new(c.X, 0, c.Z - Layout.BASE_HALF + 4)
			local total = controlling.total or (Vector3.new(r.Position.X, 0, r.Position.Z) - target).Magnitude
			controlling.total = total
			local dist = (Vector3.new(r.Position.X, 0, r.Position.Z) - target).Magnitude
			local prog = math.clamp(1 - dist / math.max(total, 1), 0, 1)
			returnFill.Size = UDim2.fromScale(prog, 1)
			returnText.Text = ("%d studs to go"):format(math.floor(dist))
			local left = (controlling.timeout or 300) - (os.clock() - controlling.started)
			returnTimer.Text = "⏱ " .. Format.time(left)
			returnTimer.TextColor3 = if left < 30 then Color3.fromRGB(255, 80, 80) else Color3.new(1, 1, 1)
			-- arrow floating above the bear, pointing home (route via the corridor)
			local aim = target
			if Layout.zoneAt(r.Position) then
				aim = Vector3.new(0, 0, Layout.CORRIDOR_START_Z + 20)
			end
			local hh = (bear:GetAttribute("HipHeight") or 1.6) + 4 * (bear:GetAttribute("Scale") or 1)
			local ap = r.Position + Vector3.new(0, hh + math.sin(os.clock() * 4) * 0.3, 0)
			local flat = Vector3.new(aim.X - ap.X, 0, aim.Z - ap.Z)
			if flat.Magnitude > 0.1 and arrow then
				arrow:PivotTo(CFrame.lookAt(ap, ap + flat.Unit))
			end
			-- sprint
			local hum = bear:FindFirstChildOfClass("Humanoid")
			if hum then
				local baseSpeed = bear:GetAttribute("BaseSpeed") or 28
				local want = if sprinting then baseSpeed * GameConfig.Capture.sprintMultiplier else baseSpeed
				if hum.WalkSpeed > 0.5 then hum.WalkSpeed = want end
				stepAcc += dt
				local moving = hum.MoveDirection.Magnitude > 0.1
				local interval = if sprinting then 0.22 else 0.32
				if moving and stepAcc > interval then
					stepAcc = 0
					Sound.play("Footstep", { at = r.Position, pitch = 0.75 / (bear:GetAttribute("Scale") or 1) })
					if sprinting then Fx.dust(Vector3.new(r.Position.X, 0.2, r.Position.Z) - r.CFrame.LookVector * 2, 0.5) end
				end
			end
		end
	end
	-- placement ghost
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	local base = player:GetAttribute("Base")
	if Data.state == "CarryingCapturedBear" and root and base and Layout.isInBase(base, root.Position, 6) then
		if not ghost then
			ghost = Instance.new("Part")
			ghost.Shape = Enum.PartType.Cylinder
			ghost.Anchored = true
			ghost.CanCollide = false
			ghost.CanQuery = false
			ghost.Material = Enum.Material.Neon
			ghost.Transparency = 0.45
			ghost.Size = Vector3.new(0.15, 5, 5)
			ghost.Parent = Fx.folder
		end
		local p = Capture.placePosition()
		local ok = Layout.isInBase(base, p, 6)
		for _, m in workspace:WaitForChild("Bears"):GetChildren() do
			if m:GetAttribute("Owner") == player.UserId and m.PrimaryPart then
				local q = m.PrimaryPart.Position
				if Vector3.new(q.X - p.X, 0, q.Z - p.Z).Magnitude < GameConfig.Base.minBearSpacing then ok = false end
			end
		end
		ghost.Color = if ok then Color3.fromRGB(110, 255, 110) else Color3.fromRGB(255, 80, 80)
		local pulse = 1 + math.sin(os.clock() * 5) * 0.08
		ghost.Size = Vector3.new(0.15, 5 * pulse, 5 * pulse)
		ghost.CFrame = CFrame.new(p + Vector3.new(0, 0.15, 0)) * CFrame.Angles(0, 0, math.pi / 2)
	elseif ghost then
		ghost:Destroy()
		ghost = nil
	end
end

-- ground point under a screen position (map only)
local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Include
local function groundAt(screen: Vector2): Vector3?
	local map = workspace:FindFirstChild("Map")
	if not map then return nil end
	rayParams.FilterDescendantsInstances = { map }
	local ray = workspace.CurrentCamera:ViewportPointToRay(screen.X, screen.Y)
	local hit = workspace:Raycast(ray.Origin, ray.Direction * 600, rayParams)
	return hit and Vector3.new(hit.Position.X, 0, hit.Position.Z) or nil
end

-- where PLACE puts the bear: under the mouse on PC (ghost follows the cursor), else in front of you
function Capture.placePosition(): Vector3
	local base = player:GetAttribute("Base")
	if base and UserInputService.MouseEnabled then
		local p = groundAt(UserInputService:GetMouseLocation())
		if p and Layout.isInBase(base, p, 6) then return p end
	end
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then return Vector3.zero end
	local p = root.Position + root.CFrame.LookVector * 6
	return Vector3.new(p.X, 0, p.Z)
end

function Capture.init()
	Net.event("CaptureFx").OnClientEvent:Connect(onFx)
	RunService.RenderStepped:Connect(function(dt)
		step(math.min(dt, 0.1))
	end)
	Actions.on("Sprint", function()
		sprinting = true
		CameraController.punch(6)
	end, function()
		sprinting = false
	end)
	Actions.on("Place", function()
		Net.event("PlaceBear"):FireServer(Capture.placePosition())
	end)
	-- click / tap anywhere in your base to place the carried bear there
	UserInputService.InputBegan:Connect(function(input, gameProcessed)
		if gameProcessed or Data.state ~= "CarryingCapturedBear" then return end
		if input.UserInputType ~= Enum.UserInputType.MouseButton1 and input.UserInputType ~= Enum.UserInputType.Touch then return end
		local base = player:GetAttribute("Base")
		local screen = if input.UserInputType == Enum.UserInputType.Touch then Vector2.new(input.Position.X, input.Position.Y + game:GetService("GuiService"):GetGuiInset().Y) else UserInputService:GetMouseLocation()
		local p = groundAt(screen)
		if base and p and Layout.isInBase(base, p, 6) then
			Fx.ring(p + Vector3.new(0, 0.2, 0), Color3.fromRGB(120, 255, 120), 0.5, 4, 0.4, { neon = true, transparency = 0.2 })
			Net.event("PlaceBear"):FireServer(p)
		end
	end)
	player.CharacterAdded:Connect(function(char)
		if not char:GetAttribute("IsBear") then
			workspace.CurrentCamera.CameraSubject = char:WaitForChild("Humanoid", 5)
		end
	end)
end

return Capture
