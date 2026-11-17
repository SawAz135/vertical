--[[ FishUpController: the "FISH-UP" sign floating above every training station.
     Built locally (stud GUI style) on each station anchor (attribute FishUpBase).
     It is hidden from afar and pops in with a bounce when you walk close, shows
     your gain per lift on YOUR station, and pulses on every rep while training. ]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Data = require(script.Parent.Data)
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Layout = require(ReplicatedStorage.Shared.Layout)
local Net = require(ReplicatedStorage.Shared.Net)
local FishUpConfig = require(ReplicatedStorage.Shared.Config.FishUpConfig)
local Easing = require(ReplicatedStorage.Shared.Util.Easing)
local CameraController = require(script.Parent.CameraController)
local Cine = require(script.Parent.CinematicFx)
local Fx = require(script.Parent.Fx)
local Sound = require(script.Parent.Sound)

local FishUp = {}
local player = Players.LocalPlayer
local RGB = Color3.fromRGB
local SHOW_DIST = 46
local signs = {}

local function tween(o, t, goal, style, dir)
	local tw = TweenService:Create(o, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), goal)
	tw:Play()
	return tw
end

local function build(anchor: BasePart, Sim)
	local base = anchor:GetAttribute("FishUpBase")
	local bb = Instance.new("BillboardGui")
	bb.Name = "FishUpSign"
	bb.Adornee = anchor
	bb.Size = UDim2.fromOffset(300, 132)
	bb.LightInfluence = 0
	bb.AlwaysOnTop = false
	bb.MaxDistance = SHOW_DIST + 10
	bb.ResetOnSpawn = false
	bb.Enabled = false
	bb.Parent = player:WaitForChild("PlayerGui")

	local root = Sim.new("Frame", { Name = "Root", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5) }, bb)
	local scale = Sim.new("UIScale", { Scale = 0 }, root)
	-- studded header plate
	local plate = Sim.panel(root, { Size = UDim2.fromOffset(250, 70), Position = UDim2.fromOffset(25, 4), Gradient = Sim.G.orange, ZIndex = 2 })
	Sim.bands(plate, 0.15, 3)
	plate.ClipsDescendants = true
	local title = Sim.text(root, "FISH-UP", { Size = UDim2.fromOffset(240, 64), Position = UDim2.fromOffset(150, 38), Max = 54, Stroke = 4.5,
		Gradient = { RGB(255, 255, 255), RGB(255, 226, 90) }, ZIndex = 6 })
	-- little fish emblems on each side of the title
	for _, side in { -1, 1 } do
		Sim.text(root, "🐟", { Size = UDim2.fromOffset(34, 34), Position = UDim2.fromOffset(150 + side * 108, 38), Max = 30, Stroke = 0, ZIndex = 7,
			Rotation = side * 12 })
	end
	local info = Sim.infoBar(root, "", { Size = UDim2.fromOffset(240, 36), Position = UDim2.fromOffset(150, 98), Max = 22, ZIndex = 4 })
	-- small pointer under the sign
	local arrow = Sim.text(root, "▼", { Size = UDim2.fromOffset(30, 22), Position = UDim2.fromOffset(150, 126), Max = 22, Stroke = 3, Color = RGB(255, 210, 60), ZIndex = 5 })

	local s = { anchor = anchor, base = base, bb = bb, scale = scale, title = title, info = info, arrow = arrow, plate = plate, shown = false, pulse = 0, seed = math.random() * 6 }
	signs[anchor] = s
	anchor.Destroying:Connect(function()
		bb:Destroy()
		signs[anchor] = nil
	end)
end

local function infoText(s): string
	local mine = player:GetAttribute("Base") == s.base
	if not mine then
		return "Strength training"
	end
	local gain = Data.values.strengthGain or 1
	if player:GetAttribute("Training") then
		return ('<font color="#FFD23F">+%d 💪</font> / lift  ·  <font color="#7CFF46">JUMP</font> to leave'):format(gain)
	end
	return ('Stand here: <font color="#7CFF46">+%d 💪</font> / lift'):format(gain)
end

------------------------------------------------------------------------------------------
-- TRAINING SHOW (local player): entry cinematic, a pop + ring wave + sweat on every rep,
-- a power aura that grows with the streak, streak banners, summary when you leave.
------------------------------------------------------------------------------------------
local training: any = { on = false, streak = 0, gained = 0, lastIntro = 0, aura = nil }
local MILESTONES = { [10] = true, [25] = true, [50] = true, [100] = true, [250] = true, [500] = true }

local function tierColor(): Color3
	return FishUpConfig.get(FishUpConfig.tierFor(Data.values.strengthGain or 1)).color
end

local function stationPos(): Vector3?
	local b = player:GetAttribute("Base")
	return b and Layout.trainPos(b)
end

local function makeAura(root: BasePart, col: Color3)
	local att = Instance.new("Attachment")
	att.Name = "TFBTrainAura"
	att.Position = Vector3.new(0, -2.6, 0)
	att.Parent = root
	local pe = Instance.new("ParticleEmitter")
	pe.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	pe.Color = ColorSequence.new(col, Color3.new(1, 1, 1))
	pe.LightEmission = 1
	pe.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(0.3, 0.55), NumberSequenceKeypoint.new(1, 0) })
	pe.Lifetime = NumberRange.new(0.8, 1.4)
	pe.Speed = NumberRange.new(3, 6)
	pe.SpreadAngle = Vector2.new(12, 12)
	pe.EmissionDirection = Enum.NormalId.Top
	pe.Shape = Enum.ParticleEmitterShape.Disc
	pe.ShapeStyle = Enum.ParticleEmitterShapeStyle.Surface
	pe.Rate = 4
	pe.Parent = att
	local light = Instance.new("PointLight")
	light.Color = col
	light.Range = 10
	light.Brightness = 0.4
	light.Shadows = false
	light.Parent = att
	return { att = att, pe = pe, light = light }
end

local function introCinematic(root: BasePart)
	if CameraController.isBusy() or os.clock() - training.lastIntro < 25 then return end
	training.lastIntro = os.clock()
	local col = tierColor()
	local pos = stationPos() or root.Position
	Cine.letterbox(true)
	Fx.dust(pos + Vector3.new(0, 0.5, 0), 1.2)
	CameraController.shake(0.5, 0.3)
	Cine.banner("FISH-UP!", col, ("+%d 💪 PER LIFT"):format(Data.values.strengthGain or 1))
	Sound.play("Transform", { volume = 0.7 })
	local look = root.CFrame.LookVector
	CameraController.run(function(t)
		local r = root.Parent and root or nil
		if not r then return nil, 60 end
		-- low hero angle in front, sweeping up and around to a proud 3/4 high shot
		local k = Easing.cubicInOut(math.clamp(t / 1.7, 0, 1))
		local dir = CFrame.Angles(0, -0.9 + k * 1.6, 0):VectorToWorldSpace(look)
		local p = r.Position + dir * (6 + 4 * k) + Vector3.new(0, -1.5 + 6 * k, 0)
		return CFrame.lookAt(p, r.Position + Vector3.new(0, 1 + k * 0.5, 0)), 48 + 16 * k
	end, 1.8, { smooth = 9, blendIn = 0.3 })
	task.delay(1.8, function()
		CameraController.stop()
		Cine.letterbox(false)
	end)
end

local function startTraining()
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not root then return end
	training.on = true
	training.streak = 0
	training.gained = 0
	if training.aura then training.aura.att:Destroy() end
	training.aura = makeAura(root, tierColor())
	introCinematic(root)
end

local function stopTraining()
	if not training.on then return end
	training.on = false
	if training.aura then
		local a = training.aura
		training.aura = nil
		a.pe.Enabled = false
		task.delay(1.5, function() a.att:Destroy() end)
	end
	if training.streak >= 5 then
		Cine.banner(("%d REPS!"):format(training.streak), tierColor(), ("+%s 💪 STRENGTH"):format(tostring(training.gained)))
		Sound.play("Reward")
	end
end

local function onRep(amount: number)
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	local head = char and char:FindFirstChild("Head") :: BasePart?
	if not root then return end
	training.streak += 1
	training.gained += amount
	local n = training.streak
	local col = tierColor()
	-- the number pops out of the lift, bigger and hotter as the streak grows
	local hot = math.clamp(n / 40, 0, 1)
	Cine.pop(head or root, ("+%d 💪"):format(amount), Color3.fromRGB(255, 230, 80):Lerp(Color3.fromRGB(255, 70, 50), hot), 100 + math.min(60, n), 1)
	-- ring wave on the mat, sweat drops, punch
	local feet = (stationPos() or root.Position) + Vector3.new(0, 0.5, 0)
	Fx.ring(feet, col, 1.5, 5 + math.min(4, n * 0.1), 0.45)
	if head then
		Fx.blocks(head.Position + Vector3.new(0, 0.5, 0), Color3.fromRGB(150, 220, 255), 3, 6, 0.18, { life = 0.6, up = 1.2, spread = 2, gravity = 30 })
	end
	CameraController.punch(-1.5 - hot * 2)
	if n % 3 == 0 then CameraController.shake(0.12 + hot * 0.2, 0.12) end
	Sound.play("Lift", { volume = 0.45 })
	-- the aura grows with the streak
	if training.aura then
		training.aura.pe.Rate = 4 + math.min(40, n * 0.8)
		training.aura.light.Brightness = 0.4 + math.min(2.2, n * 0.05)
		training.aura.light.Range = 10 + math.min(10, n * 0.2)
	end
	if MILESTONES[n] then
		Cine.banner(("x%d STREAK!"):format(n), col, "KEEP LIFTING!")
		Fx.dust(feet, 1)
		CameraController.shake(0.6, 0.3)
		CameraController.punch(-6)
		Sound.play("Reward")
	end
end

function FishUp.init(Sim)
	local function scan(d: Instance)
		if d:IsA("BasePart") and d:GetAttribute("FishUpBase") and not signs[d] then
			build(d, Sim)
		end
	end
	task.spawn(function()
		local map = workspace:WaitForChild("Map", 60)
		if not map then return end
		for _, d in map:GetDescendants() do scan(d) end
		map.DescendantAdded:Connect(scan)
	end)

	-- JUMP = the only way off the mat (the server locks you in the centre while lifting)
	game:GetService("UserInputService").JumpRequest:Connect(function()
		if player:GetAttribute("Training") then Net.event("LeaveTraining"):FireServer() end
	end)
	player:GetAttributeChangedSignal("Training"):Connect(function()
		if player:GetAttribute("Training") then startTraining() else stopTraining() end
	end)

	-- rep pulse: strength went up while training on my station
	local last = nil
	Data.Changed:Connect(function(key)
		if key ~= "strength" and key ~= "*" then return end
		local now = Data.values.strength or 0
		if last and now > last and player:GetAttribute("Training") then
			for _, s in signs do
				if s.base == player:GetAttribute("Base") then s.pulse = 1 end
			end
			if training.on then onRep(now - last) end
		end
		last = now
	end)

	local acc = 0
	RunService.RenderStepped:Connect(function(dt)
		local char = player.Character
		local root = char and char:FindFirstChild("HumanoidRootPart")
		acc += dt
		local t = os.clock()
		for _, s in signs do
			local near = root ~= nil and (root.Position - s.anchor.Position).Magnitude < SHOW_DIST
			if near ~= s.shown then
				s.shown = near
				if near then
					s.bb.Enabled = true
					s.scale.Scale = 0
					tween(s.scale, 0.45, { Scale = 1 }, Enum.EasingStyle.Back)
					s.info.Text.Text = infoText(s)
				else
					tween(s.scale, 0.2, { Scale = 0 }, Enum.EasingStyle.Quad, Enum.EasingDirection.In).Completed:Connect(function()
						if not s.shown then s.bb.Enabled = false end
					end)
				end
			end
			if s.bb.Enabled then
				-- idle bob + wiggle, rep pulse squash
				s.bb.StudsOffsetWorldSpace = Vector3.new(0, math.sin(t * 1.6 + s.seed) * 0.35, 0)
				s.title.Rotation = math.sin(t * 2.1 + s.seed) * 2.5
				s.arrow.Position = UDim2.fromOffset(150, 126 + math.abs(math.sin(t * 3)) * 5)
				if s.pulse > 0 then
					s.pulse = math.max(0, s.pulse - dt * 2.8)
					local k = s.pulse
					if s.shown then s.scale.Scale = 1 + math.sin(k * math.pi) * 0.14 end
					s.title.TextColor3 = RGB(255, 255, 255):Lerp(RGB(120, 255, 90), k)
				end
				if acc > 0.4 then s.info.Text.Text = infoText(s) end
			end
		end
		if acc > 0.4 then acc = 0 end
	end)
end

return FishUp
