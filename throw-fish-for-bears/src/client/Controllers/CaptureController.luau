--[[ CaptureController: the local player's bear sequence.
     Spawned  -> wide shot of the FISH on the ground; the bear is completely INVISIBLE (no POV, no bear yet)
     Alert    -> push-in on the fish, a growl comes from the forest
     Run      -> camera stays on the fish; footsteps, dust clouds and shaking show the unseen bear coming
     Eat      -> you only see the FISH GETTING EATEN: it is yanked up by an unseen mouth,
                 thrashes, gulp. The bear is still invisible
     Reveal   -> the bear APPEARS now (black silhouette pop), crane shot ABOVE it: 6 members get their colours back one by one
     Happy    -> hero orbit + flash, then the bear lands in your arms
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
local Formulas = require(Shared.Formulas)
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
	return at
end

local function revealNext(rv)
	rv.idx += 1
	local bone = REVEAL_ORDER[rv.idx]
	if bone then return revealGroup(rv, bone, true), bone end
	return nil, nil
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

-- the bear exists for the server, but the local player must not see it until the reveal
local function setBearHidden(bear: Model, hidden: boolean)
	for _, d in bear:GetDescendants() do
		if d:IsA("BasePart") then
			d.LocalTransparencyModifier = if hidden then 1 else 0
		elseif d:IsA("BillboardGui") or d:IsA("SurfaceGui") then
			d.Enabled = not hidden
		end
	end
end

-- opening shot: wide and low on the FISH lying on the ground. The bear is invisible.
local function establishShot()
	local c = current
	c.rv = prepareReveal(c.bear) -- silhouette colours + rarity effects off, ready for the reveal
	setBearHidden(c.bear, true)
	Cine.letterbox(true)
	Cine.grade({ tint = Color3.fromRGB(215, 200, 225), saturation = -0.15, contrast = 0.12, brightness = -0.03 }, 1.5)
	c.shadow = Cine.shadow()
	local toDen = Vector3.new(c.den.X - c.landing.X, 0, c.den.Z - c.landing.Z)
	toDen = if toDen.Magnitude > 0.1 then toDen.Unit else Vector3.new(0, 0, -1)
	local side = Vector3.new(-toDen.Z, 0, toDen.X)
	CameraController.run(function(t)
		local k = Easing.sineInOut(math.clamp(t / 1.6, 0, 1))
		local fp = if c.fish and c.fish.PrimaryPart and c.fish.Parent then c.fish.PrimaryPart.Position else c.landing
		local p = fp - toDen * (10 - 3 * k) + side * (7 - 3 * k) + Vector3.new(0, 4 - 2.4 * k, 0)
		return CFrame.lookAt(p, fp + toDen * 3 + Vector3.new(0, 0.6, 0)), 60 - 8 * k
	end, 30, { smooth = 8, blendIn = 0.3 })
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

-- the card after the 6th member: a PLAIN GUI (no studs) under the bear, which stays visible:
-- rarity, name and money per second
local function nameCard(d)
	local tier = RarityConfig.get(d.final)
	local col = tier.textColor or tier.color
	if col.R * 0.3 + col.G * 0.59 + col.B * 0.11 < 0.25 then col = tier.color end
	local spec = BearConfig.get(d.species or "BrownBear")
	local variant = if d.variant and d.variant ~= "Normal" then d.variant .. " " else ""
	local income = Formulas.bearIncome({ s = d.species, r = d.final, v = d.variant or "Normal", w = d.weight or 0 })

	local g = Instance.new("ScreenGui")
	g.Name = "TFBBearCard"
	g.ResetOnSpawn = false
	g.DisplayOrder = 13
	g.IgnoreGuiInset = true
	g.ScreenInsets = Enum.ScreenInsets.DeviceSafeInsets
	g.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	g.Parent = player:WaitForChild("PlayerGui")

	local holder = Instance.new("Frame")
	holder.BackgroundTransparency = 1
	holder.AnchorPoint = Vector2.new(0.5, 1)
	holder.Position = UDim2.new(0.5, 0, 1, 120)
	holder.Size = UDim2.fromOffset(340, 138)
	holder.Parent = g
	local vp = workspace.CurrentCamera.ViewportSize
	local scale = Instance.new("UIScale")
	scale.Scale = math.clamp(math.min(vp.X / 700, vp.Y / 420), 0.7, 1.4)
	scale.Parent = holder

	local card = Instance.new("Frame")
	card.Size = UDim2.fromScale(1, 1)
	card.BackgroundColor3 = Color3.fromRGB(22, 24, 32)
	card.BackgroundTransparency = 0.08
	card.BorderSizePixel = 0
	card.Parent = holder
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 16)
	corner.Parent = card
	local stroke = Instance.new("UIStroke")
	stroke.Color = col
	stroke.Thickness = 3
	stroke.Parent = card
	local grad = Instance.new("UIGradient")
	grad.Color = ColorSequence.new(Color3.fromRGB(46, 50, 64), Color3.fromRGB(18, 20, 28))
	grad.Rotation = 90
	grad.Parent = card

	local function label(text, y, h, size, color, font)
		local l = Instance.new("TextLabel")
		l.BackgroundTransparency = 1
		l.Position = UDim2.new(0, 10, 0, y)
		l.Size = UDim2.new(1, -20, 0, h)
		l.Font = font or Enum.Font.GothamBold
		l.Text = text
		l.TextColor3 = color
		l.TextSize = size
		l.TextScaled = false
		l.TextTruncate = Enum.TextTruncate.AtEnd
		l.Parent = card
		return l
	end
	label(tier.name:upper(), 10, 26, 22, col)
	label(variant .. spec.name, 38, 36, 30, Color3.new(1, 1, 1))
	local divider = Instance.new("Frame")
	divider.Position = UDim2.new(0.1, 0, 0, 82)
	divider.Size = UDim2.new(0.8, 0, 0, 2)
	divider.BackgroundColor3 = col
	divider.BackgroundTransparency = 0.6
	divider.BorderSizePixel = 0
	divider.Parent = card
	label(Format.perSec(income), 92, 36, 28, Color3.fromRGB(110, 255, 120))

	TweenService:Create(holder, TweenInfo.new(0.45, Enum.EasingStyle.Back, Enum.EasingDirection.Out),
		{ Position = UDim2.new(0.5, 0, 1, -16) }):Play()
	task.delay(GameConfig.Capture.revealFinal + 1.6, function()
		TweenService:Create(holder, TweenInfo.new(0.3, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
			{ Position = UDim2.new(0.5, 0, 1, 160) }):Play()
		task.delay(0.35, function() g:Destroy() end)
	end)
end

-- uncover ONE part (continuous bottom -> top sweep); revealAll later skips it
local function revealPartNow(rv, part: BasePart)
	local sv = rv.saved[part]
	if not sv or not part.Parent then return end
	rv.saved[part] = nil
	part.Material = sv[2]
	part.Color = Color3.new(1, 1, 1)
	TweenService:Create(part, TweenInfo.new(0.35, Enum.EasingStyle.Quad), { Color = sv[1] }):Play()
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
	Cine.letterbox(true)
	Cine.speedLines(false)
	Cine.stress(0)
	-- THE BEAR APPEARS: black silhouette pops into view with a flash and a shockwave
	setBearHidden(c.bear, false)
	local r0 = rootOf(c.bear)
	Cine.flash(0.5, Color3.new(1, 1, 1))
	Sound.play("Transform", { volume = 0.8 })
	if r0 then
		Cine.shockwave(r0.Position - Vector3.new(0, r0.Position.Y - 0.3, 0), Color3.fromRGB(20, 16, 28), 1.4)
		Fx.puff(r0.Position, Color3.fromRGB(30, 26, 38), 14, 5)
	end
	-- CRANE SHOT ABOVE THE BEAR: starts very high looking straight down, spirals lower while
	-- the focus slides to every member as it is uncovered (legs, then body, then head)
	local focus = nil
	local spin = 0
	local fireShake = 0
	if c.shadow then c.shadow.destroy() c.shadow = nil end
	Cine.grade({ tint = Color3.fromRGB(205, 205, 235), brightness = -0.12, contrast = 0.3, saturation = -0.1 }, 0.3)
	if r0 then
		Cine.pillar(r0.Position - Vector3.new(0, r0.Position.Y - 0.3, 0), Color3.fromRGB(190, 190, 255), 90, 4, 1.2)
		Cine.crown(r0.Position - Vector3.new(0, r0.Position.Y - 0.3, 0), Color3.fromRGB(190, 190, 255), 8, 4 * (c.bear:GetAttribute("Scale") or 1), 14)
	end
	CameraController.run(function(t, dt)
		local rr = rootOf(c.bear)
		if not rr then return nil, 55 end
		local sc = c.bear:GetAttribute("Scale") or 1
		local idx = c.rv and c.rv.idx or 0
		local want = focus or rr.Position
		c.focusNow = (c.focusNow or want):Lerp(want, Easing.damp(7, dt))
		local prog = math.clamp(idx / 6, 0, 1)
		spin += dt * (0.35 + prog * 0.9)
		local height = (24 - 11 * prog) * sc
		local radius = (6 + 5 * prog) * sc
		local fwd = rr.CFrame.LookVector
		local dirv = CFrame.Angles(0, spin, 0):VectorToWorldSpace(fwd)
		local p = c.focusNow + dirv * radius + Vector3.new(0, height, 0)
		local sway = Vector3.new(math.sin(t * 2.3) * 0.15, math.sin(t * 3.1) * 0.12, 0) * sc
		return CFrame.lookAt(p + sway, c.focusNow), 62 - 14 * prog
	end, d.duration + 0.5, { smooth = 9, blendIn = 0.5 })
	CameraController.punch(-4)
	task.spawn(function()
		-- CONTINUOUS reveal, from the BOTTOM of the bear to the TOP: a wave of light climbs the bear and
		-- uncovers every part it passes. LUCK and SIZE climb at the same time, rolling like an RNG.
		local T = G.revealLimb * 6
		local list, minY, maxY = {}, math.huge, -math.huge
		if c.rv then
			for _, parts in c.rv.groups do
				for _, part in parts do
					if part.Parent then
						local y = part.Position.Y
						table.insert(list, { part = part, y = y })
						minY = math.min(minY, y)
						maxY = math.max(maxY, y)
					end
				end
			end
		end
		table.sort(list, function(a, b) return a.y < b.y end)
		local span = math.max(maxY - minY, 0.5)
		local rng = Random.new()
		local tierNow = RarityConfig.get(d.final)
		local colNow = tierNow.textColor or tierNow.color
		local t0 = os.clock()
		local nextPart, lastPip = 1, 0
		local lastTick, lastRing, lastGrade, lastShake = 0, 0, 0, 0
		local sc = c.bear:GetAttribute("Scale") or 1
		while current and c.bear.Parent do
			local p = math.clamp((os.clock() - t0) / T, 0, 1)
			local pe = Easing.sineInOut(p)
			local yNow = minY + span * pe
			local r = rootOf(c.bear)
			if c.rv then c.rv.idx = p * 6 end
			-- uncover everything the wave has passed
			while c.rv and nextPart <= #list and list[nextPart].y <= yNow + 0.001 do
				revealPartNow(c.rv, list[nextPart].part)
				nextPart += 1
			end
			if r then
				focus = Vector3.new(r.Position.X, yNow, r.Position.Z)
				local limbCol = Color3.fromHSV(pe * 0.85, 0.45, 1):Lerp(colNow, p * 0.6)
				-- glowing rings climbing the bear
				if os.clock() - lastRing > 0.12 then
					lastRing = os.clock()
					Cine.ringFacing(focus, Vector3.new(0, 1, 0), limbCol, 1.5 * sc, (4 + 2 * p) * sc, 0.45, 0.25)
					Fx.sparkle(focus, limbCol, 4, 14)
				end
				-- member pips (6) + ground effects each time the wave passes 1/6
				local pipI = math.floor(p * 6 + 0.0001)
				if pipI > lastPip then
					lastPip = pipI
					local gp = Vector3.new(r.Position.X, r.Position.Y - (c.bear:GetAttribute("HipHeight") or 1.6), r.Position.Z)
					Cine.shockwave(gp, limbCol, 0.4 + pipI * 0.12)
					Cine.pillar(gp, limbCol, 40 + pipI * 12, 1.2 + pipI * 0.25, 0.8)
					Cine.crown(gp, limbCol, 4 + pipI, 2 + pipI * 0.4, 6 + pipI * 2)
					Sound.play("Heartbeat", { pitch = 1 + pipI * 0.08 })
					CameraController.punch(-2 - pipI * 0.6)
					ui.set(1 + (luck - 1) * (pe ^ 1.6), kg * (0.3 + 0.7 * pe), pipI, true)
				end
			end
			-- LUCK / SIZE rolling up like RNG (random jitter that fades out as the wave reaches the head)
			if os.clock() - lastTick > 0.05 then
				lastTick = os.clock()
				local noise = 1 - p
				local shownLuck = math.max(1, (1 + (luck - 1) * (pe ^ 1.6)) * (1 + rng:NextNumber(-0.25, 0.35) * noise))
				local shownKg = math.max(0, kg * (0.3 + 0.7 * pe) * (1 + rng:NextNumber(-0.15, 0.2) * noise))
				ui.set(shownLuck, shownKg, 0, false)
			end
			if os.clock() - lastShake > 0.3 then
				lastShake = os.clock()
				CameraController.shake(0.15 + p * 0.5, 0.15)
			end
			-- the whole screen climbs towards the rarity colour as the wave rises
			if os.clock() - lastGrade > 0.25 then
				lastGrade = os.clock()
				Cine.grade({ tint = Color3.new(1, 1, 1):Lerp(colNow, p * 0.45), saturation = 0.05 + p * 0.45, contrast = 0.2 + p * 0.15, brightness = -0.1 + p * 0.1 }, 0.25)
				Cine.flash(0.12 + p * 0.25, Color3.fromHSV(pe * 0.85, 0.45, 1):Lerp(colNow, p * 0.6))
			end
			if p >= 1 then break end
			task.wait()
		end
		-- the wave reached the head: everything uncovered, final luck + size
		if c.rv then c.rv.idx = 6 end
		if d.mult then
			ui.stamp(("LUCK x%d!"):format(d.mult))
			Cine.flash(0.55, Color3.fromRGB(255, 210, 50))
			Sound.play("Transform")
		end
		ui.set(luck, kg, 6, true)
		alive = false
		shakeConn:Disconnect()
		c.focusNow = nil
		Cine.stress(0)
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
		-- RARITY EXPLOSION: the better the bear, the bigger (pillars, rings, lightning, bloom)
		local gpos = if r then Vector3.new(r.Position.X, 0.3, r.Position.Z) else nil
		if gpos then
			local ti = tier.index
			Cine.pillar(gpos, col, 120 + ti * 25, 5 + ti * 1.2, 1.8)
			for i = 1, 2 + math.floor(ti / 2) do
				task.delay(i * 0.1, function() Cine.shockwave(gpos, if i % 2 == 0 then Color3.new(1, 1, 1) else col, 1.2 + i * 0.5) end)
			end
			Cine.crown(gpos, col, 8 + ti * 2, 5 + ti, 20 + ti * 4)
			Fx.blocks(gpos + Vector3.new(0, 3, 0), col, 30 + ti * 12, 30 + ti * 4, 0.45, { life = 1.6, up = 2.4, spread = 3, gravity = 40 })
		end
		Cine.grade({ tint = Color3.new(1, 1, 1):Lerp(col, 0.4), saturation = 0.5, contrast = 0.3, brightness = 0.05 }, 0.06)
		task.delay(0.25, function() Cine.grade({ saturation = 0.25, contrast = 0.15, brightness = 0 }, 1.0) end)
		-- (no more big rarity text / bottom name card: the BEAR UNLOCKED screen shows name + rarity)
		-- the crane swoops DOWN from above into a hero shot of the full bear
		CameraController.run(function(t)
			local rr = rootOf(c.bear)
			local h = headOf(c.bear)
			if not rr then return nil, 55 end
			local sc = c.bear:GetAttribute("Scale") or 1
			local k = Easing.cubicOut(math.clamp(t / 1.1, 0, 1))
			local fwd = rr.CFrame.LookVector
			local dirv = CFrame.Angles(0, 0.5 - t * 0.2, 0):VectorToWorldSpace(fwd)
			local p = rr.Position + dirv * (9 + t * 1.5) * sc + Vector3.new(0, (13 - 12.2 * k) * sc, 0)
			return CFrame.lookAt(p, if h then h.Position else rr.Position), 52 + 10 * (1 - k)
		end, 4, { smooth = 8, blendIn = 0.2 })
	end)
end

-- shots --------------------------------------------------------------------------
local function fishPosOf(c)
	return if c.fish and c.fish.PrimaryPart and c.fish.Parent then c.fish.PrimaryPart.Position else c.landing
end

local function dirToDen(c)
	local v = Vector3.new(c.den.X - c.landing.X, 0, c.den.Z - c.landing.Z)
	return if v.Magnitude > 0.1 then v.Unit else Vector3.new(0, 0, -1)
end

-- ALERT: something growls in the forest, the camera pushes in on the fish
local function alertShot()
	local c = current
	local toDen = dirToDen(c)
	local side = Vector3.new(-toDen.Z, 0, toDen.X)
	CameraController.run(function(t)
		local fp = fishPosOf(c)
		local k = Easing.cubicOut(math.clamp(t / 0.8, 0, 1))
		local p = fp - toDen * (7 - 3 * k) + side * (3.5 - 1.5 * k) + Vector3.new(0, 1.4 - 0.5 * k, 0)
		return CFrame.lookAt(p, fp + Vector3.new(0, 0.3, 0)), 56 - 16 * k
	end, 60, { smooth = 9, blendIn = 0.35 })
	CameraController.punch(-5)
	CameraController.shake(0.4, 0.3)
	Cine.grade({ tint = Color3.fromRGB(235, 175, 175), saturation = -0.2, contrast = 0.2, brightness = -0.07 }, 0.7)
	local hd, rt = headOf(c.bear), rootOf(c.bear)
	if hd and rt then
		local sc = c.bear:GetAttribute("Scale") or 1
		c.eyes = Cine.eyes(hd.Position + rt.CFrame.LookVector * 1.2 * sc + Vector3.new(0, 0.3 * sc, 0), rt.CFrame.RightVector, sc)
	end
	if c.fish and c.fish.PrimaryPart then
		Cine.pop(c.fish.PrimaryPart, "!", Color3.fromRGB(255, 225, 50), 130, 1.1)
	end
end

-- RUN: the camera never leaves the fish. You only hear and feel the unseen bear: footsteps,
-- dust clouds on its path, ground shaking harder and harder, FOV tightening, heartbeat.
local function runShot()
	local c = current
	local toDen = dirToDen(c)
	local side = Vector3.new(-toDen.Z, 0, toDen.X)
	local stepT, beatT = 0, 0.5
	local startDist
	Cine.speedLines(false)
	if c.eyes then c.eyes.destroy() c.eyes = nil end
	CameraController.run(function(t, dt)
		local r = rootOf(c.bear)
		local fp = fishPosOf(c)
		if not r then return nil, 60 end
		local sc = c.bear:GetAttribute("Scale") or 1
		local dist = (Vector3.new(r.Position.X, 0, r.Position.Z) - Vector3.new(fp.X, 0, fp.Z)).Magnitude
		startDist = startDist or math.max(dist, 8)
		local near = 1 - math.clamp(dist / startDist, 0, 1) -- 0 far .. 1 on top of the fish
		stepT += dt
		if stepT > 0.26 / math.max(0.8, (c.bear:GetAttribute("Gait") or 1)) then
			stepT = 0
			Sound.play("Footstep", { at = r.Position, pitch = 0.8 / sc, volume = 0.5 + near * 0.8 })
			Fx.dust(r.Position - Vector3.new(0, r.Position.Y - 0.2, 0), 0.5 * sc)
			CameraController.shake((0.08 + near * 0.55) * sc, 0.12)
			local ground = Vector3.new(r.Position.X, 0.25, r.Position.Z)
			Fx.ring(ground, Color3.fromRGB(70, 50, 45), 0.6, (3 + near * 3) * sc, 0.45, { transparency = 0.45 })
			if near > 0.35 then
				-- the ground jumps around the fish with every step
				Fx.blocks(fp, Color3.fromRGB(140, 110, 80), 3, 5 + near * 6, 0.22, { life = 0.6, up = 1.6, spread = 1.5, gravity = 40 })
			end
		end
		if c.shadow then c.shadow.set(r.Position, (3 + near * 5) * sc, 0.15 + near * 0.55) end
		Cine.gradeSet({ brightness = -0.07 - near * 0.12, contrast = 0.2 + near * 0.15, saturation = -0.2 - near * 0.2 })
		beatT -= dt
		if beatT <= 0 then
			beatT = 0.9 - near * 0.55
			Sound.play("Heartbeat", { pitch = 0.85 + near * 0.4, volume = 0.5 + near * 0.4 })
		end
		Cine.stress(near * 0.6)
		local p = fp - toDen * (4 - 1.2 * near) + side * (2 - 1.2 * near) + Vector3.new(0, 1.0 - 0.3 * near, 0)
		local tremble = Vector3.new(math.sin(t * 40), math.sin(t * 53), 0) * 0.03 * near
		return CFrame.lookAt(p + tremble, fp + toDen * (1.5 + 3 * (1 - near)) + Vector3.new(0, 0.5, 0)), 52 - 14 * near
	end, 60, { smooth = 10, blendIn = 0.3 })
end

-- THE FISH GETS TAKEN, SEEN FROM BEHIND (the bear stays invisible, you only see the fish yanked up),
-- then CUT to a close-up of the bear's mouth: the fish goes in, you see teeth, mouth and tongue,
-- then it CHOMPS and chews.
local MOUTH_PARTS = { MouthInside = true, Tongue = true, TongueTip = true }
local function isMouthPart(p: BasePart): boolean
	return MOUTH_PARTS[p.Name] == true or p.Name:sub(1, 5) == "Tooth"
end

-- close-up: the head is shown in its real colours (teeth, tongue, inside of the mouth all visible);
-- it is hidden again (black silhouette) right before the reveal
local function showMouth(c, on: boolean)
	local rv = c.rv
	local parts = rv and rv.groups and rv.groups.Head
	if not parts then return end
	for _, d in parts do
		if d.Parent then
			d.LocalTransparencyModifier = if on then 0 else 1
			local sv = rv.saved[d]
			if sv then
				d.Color = if on then sv[1] else SHADOW
				d.Material = if on then sv[2] else Enum.Material.SmoothPlastic
			end
		end
	end
end

local function eatSequence(d)
	local c = current
	local tl = d.tl
	local start = d.start
	local G = GameConfig.Capture
	local tCut = tl.eat + 0.7 -- cut: "fish taken from behind" -> "mouth close-up"
	local tChomp = tl.eat + 1.0 -- jaw snaps shut (matches the Eat animation)
	local tHide = tl.total - 0.15 -- back to the full silhouette before the reveal
	local bitten, swallowed, mouthShown, hidden = false, false, false, false
	local nextChew = 0
	local sniffed = false
	local groundPos = nil
	local lastCF, lastFov = nil, 50
	local freezeUntil = 0
	Cine.speedLines(false)
	Cine.letterbox(true)
	Cine.stress(0)
	Cine.grade({ tint = Color3.new(1, 1, 1), brightness = -0.04, contrast = 0.1, saturation = -0.05 }, 0.4)
	local function shot()
		local now = workspace:GetServerTimeNow()
		local t = now - start
		local r = rootOf(c.bear)
		local h = headOf(c.bear)
		if not r or not h then return nil, 55 end
		local fwd = r.CFrame.LookVector
		local right = r.CFrame.RightVector
		local up = Vector3.new(0, 1, 0)
		local sc = c.bear:GetAttribute("Scale") or 1
		local mouthAtt = h:FindFirstChild("MouthAtt")
		local mouth = if mouthAtt then (mouthAtt :: Attachment).WorldPosition else h.Position
		local fishPos = (c.fish and c.fish.PrimaryPart and c.fish.Parent) and c.fish.PrimaryPart.Position or mouth
		if not groundPos then groundPos = fishPos end
		local te = t - tl.eat

		if t < tCut then
			-- SHOT 1: low, BEHIND the fish. The bear is invisible: the fish is simply yanked up and out of frame.
			if t > tl.sniff and not sniffed then
				sniffed = true
				Sound.play("Sniff", { at = mouth })
			end
			local k = Easing.sineInOut(math.clamp(t / tCut, 0, 1))
			local p = groundPos + fwd * (8.5 - 3 * k) * sc + right * 1.1 * sc + up * (0.8 + 0.3 * k) * sc
			return CFrame.lookAt(p, fishPos + up * 0.3 * sc), 54 - 8 * k
		end

		-- SHOT 2: mouth close-up (teeth, mouth, tongue, the fish going in, CHOMP, chewing)
		if not mouthShown then
			mouthShown = true
			showMouth(c, true)
			CameraController.punch(-5)
			CameraController.shake(0.5, 0.2)
		end
		if not bitten and t >= tChomp then
			bitten = true
			Sound.play("Chomp", { at = mouth, pitch = bearPitch(c.bear) })
			CameraController.shake(1.2, 0.3)
			CameraController.punch(-10)
			freezeUntil = os.clock() + 0.1 -- hit-stop on the bite
			Cine.flash(0.5, Color3.new(1, 1, 1)) -- (soft flash, see CinematicFx)
			Cine.shockwave(Vector3.new(mouth.X, 0.3, mouth.Z), Color3.fromRGB(255, 70, 50), 1.1)
			Cine.ringFacing(mouth, fwd, Color3.fromRGB(255, 120, 60), 0.8, 9, 0.5, 0.4)
			for i = 1, 2 do
				local rv = Vector3.new(math.random() - 0.5, math.random() * 0.8, math.random() - 0.5).Unit
				task.delay(i * 0.03, function() Cine.bolt(mouth, mouth + rv * (3 + math.random() * 3), Color3.fromRGB(255, 160, 80), 0.2, 0.3) end)
			end
			Cine.slam("CHOMP!", Color3.fromRGB(255, 140, 40), 110, 0.9)
			Fx.blocks(mouth, Color3.fromRGB(255, 70, 70), 10, 9, 0.2, { life = 0.6, up = 1.2 })
			nextChew = te + 0.3
		end
		if bitten and te >= nextChew and te < G.swallowAt + 0.3 then
			nextChew = te + 0.3
			Cine.pop(h, if math.random() < 0.5 then "NOM!" else "nom", Color3.new(1, 1, 1), 90, 0.7)
			Fx.blocks(mouth, Color3.fromRGB(255, 190, 170), 3, 6, 0.18, { life = 0.5, up = 1 })
			CameraController.punch(-1.5)
			CameraController.shake(0.3, 0.1)
		end
		if not swallowed and te > G.swallowAt then
			swallowed = true
			Fx.blocks(mouth, Color3.fromRGB(255, 160, 140), 12, 9, 0.22, { life = 0.6, up = 1.2 })
			Cine.slam("GULP!", Color3.fromRGB(255, 255, 255), 90, 0.8)
			Cine.flash(0.4, Color3.new(1, 1, 1))
			Cine.shockwave(Vector3.new(mouth.X, 0.3, mouth.Z), Color3.fromRGB(255, 200, 180), 1.4)
			CameraController.shake(1.0, 0.3)
			Sound.play("Chomp", { at = mouth, pitch = bearPitch(c.bear) * 1.2, volume = 0.7 })
			CameraController.punch(-4)
		end
		if not hidden and t >= tHide then
			hidden = true
			showMouth(c, false) -- full black silhouette again: the reveal pops it in
		end
		-- the camera sits in front of the face (flattened so it never dips into the ground) and creeps in
		local hl = h.CFrame.LookVector
		local flat = Vector3.new(hl.X, 0, hl.Z)
		flat = if flat.Magnitude > 0.05 then flat.Unit else fwd
		local hr = Vector3.new(-flat.Z, 0, flat.X)
		local k = Easing.sineOut(math.clamp((t - tCut) / 1.0, 0, 1))
		local p = mouth + flat * (4.4 - 1.0 * k) * sc + hr * 1.2 * sc + up * 1.1 * sc
		p = Vector3.new(p.X, math.max(p.Y, 0.9), p.Z)
		return CFrame.lookAt(p, mouth + up * 0.15 * sc), 46 - 6 * k
	end
	CameraController.run(function()
		if os.clock() < freezeUntil and lastCF then return lastCF, lastFov end
		local cf, fov = shot()
		if cf then
			if c.shadow then
				local fp0 = (c.fish and c.fish.PrimaryPart and c.fish.Parent) and c.fish.PrimaryPart.Position or cf.Position
				c.shadow.set(fp0, 8 * (c.bear:GetAttribute("Scale") or 1), 0.7)
			end
			lastCF, lastFov = cf, fov
		end
		return cf, fov
	end, tl.total + 1.5, { smooth = 11, blendIn = 0.3 })
end

-- after the reveal: the bear is happy, hero orbit rising around it, flash, then into your arms
local function happyShot(d)
	local c = current
	if not c then return end
	local tier = rarityOf(c.bear)
	local col = tier.textColor or tier.color
	local happy, shocked, transformed = false, false, false
	local total = d.duration
	local tHappy = GameConfig.Capture.happy
	CameraController.run(function(t)
		local r = rootOf(c.bear)
		local h = headOf(c.bear)
		if not r or not h then return nil, 55 end
		local sc = c.bear:GetAttribute("Scale") or 1
		local fwd = r.CFrame.LookVector
		local up = Vector3.new(0, 1, 0)
		if t < tHappy then
			if not happy then
				happy = true
				Sound.play("Happy", { at = h.Position, pitch = bearPitch(c.bear) })
				Cine.pop(h, "♥", Color3.fromRGB(255, 90, 130), 120, 1.2)
				Cine.hearts(h.Position + up * 1.5, 8)
			end
			local k = Easing.cubicOut(math.clamp(t / tHappy, 0, 1))
			local p = r.Position + fwd * (9 + 6 * k) * sc + up * (3 + 4 * k) * sc + r.CFrame.RightVector * 2 * sc
			return CFrame.lookAt(p, r.Position + up * sc), 54
		end
		local k = math.clamp((t - tHappy) / math.max(0.1, total - tHappy), 0, 1)
		if not transformed then
			transformed = true
			Sound.play("Transform")
		end
		local ang = Easing.cubicInOut(k) * math.pi * 2
		local radius = (13 - 4 * k) * sc
		local dirv = CFrame.Angles(0, ang, 0):VectorToWorldSpace(fwd)
		local p = r.Position + dirv * radius + up * (3 + 5 * k) * sc
		if k > 0.8 and not shocked then
			shocked = true
			Cine.shockwave(r.Position - Vector3.new(0, r.Position.Y - 0.3, 0), col, sc)
			if tier.index >= 4 then Cine.rarityTint(col, 0.6) end
		end
		if k > 0.6 and not c.gradeCleared then
			c.gradeCleared = true
			Cine.gradeOff(1.2)
		end
		return CFrame.lookAt(p, r.Position + up * sc), 56 + 12 * k
	end, total + 1.5, { smooth = 10, blendIn = 0.3 })
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
		establishShot()
	elseif phase == "Alert" and current then
		alertShot()
		Sound.play("Growl", { at = rootOf(current.bear) and rootOf(current.bear).Position, pitch = bearPitch(current.bear) })
	elseif phase == "Run" and current then
		runShot()
	elseif phase == "Reveal" and current then
		revealSequence(d)
	elseif phase == "Eat" and current then
		eatSequence(d)
	elseif phase == "Happy" and current then
		happyShot(d)
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
		if current and current.shadow then current.shadow.destroy() current.shadow = nil end
		if current and current.eyes then current.eyes.destroy() current.eyes = nil end
		Cine.gradeOff(0.5)
		if current and current.bear then setBearHidden(current.bear, false) end
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
