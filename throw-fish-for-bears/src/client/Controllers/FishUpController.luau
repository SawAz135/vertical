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

-- the rep counter: text only (no panel), chunky outline, pops on every rep
local counter = nil
local function buildCounter()
	if counter then return counter end
	local g = Instance.new("ScreenGui")
	g.Name = "TFBRepCounter"
	g.ResetOnSpawn = false
	g.IgnoreGuiInset = true
	g.DisplayOrder = 9
	g.Enabled = false
	g.Parent = player:WaitForChild("PlayerGui")
	local function label(size: UDim2, pos: UDim2, max: number, stroke: number)
		local t = Instance.new("TextLabel")
		t.BackgroundTransparency = 1
		t.AnchorPoint = Vector2.new(0.5, 0.5)
		t.Size = size
		t.Position = pos
		t.Font = Enum.Font.FredokaOne
		t.TextScaled = true
		t.TextColor3 = Color3.new(1, 1, 1)
		local c = Instance.new("UITextSizeConstraint")
		c.MaxTextSize = max
		c.Parent = t
		local st = Instance.new("UIStroke")
		st.Thickness = stroke
		st.LineJoinMode = Enum.LineJoinMode.Round
		st.Parent = t
		t.Parent = g
		return t
	end
	local title = label(UDim2.fromScale(0.5, 0.05), UDim2.fromScale(0.5, 0.15), 30, 3)
	title.Text = "R E P S"
	local num = label(UDim2.fromScale(0.5, 0.13), UDim2.fromScale(0.5, 0.23), 96, 6)
	local grad = Instance.new("UIGradient")
	grad.Rotation = 90
	grad.Parent = num
	local sub = label(UDim2.fromScale(0.5, 0.045), UDim2.fromScale(0.5, 0.31), 30, 3)
	local sc = Instance.new("UIScale")
	sc.Parent = num
	counter = { gui = g, num = num, grad = grad, sub = sub, scale = sc, title = title }
	return counter
end

local function showCounter(on: boolean)
	local c = buildCounter()
	c.gui.Enabled = on
	if on then
		c.num.Text = "0"
		c.sub.Text = ("+%d 💪 PER LIFT"):format(Data.values.strengthGain or 1)
	end
end

-- TRAINING CAMERA: a slow, low orbit around you that tightens as the streak grows
local function trainingCamera(root: BasePart)
	local look = root.CFrame.LookVector
	CameraController.run(function(t)
		if not training.on or not root.Parent then return nil, 60 end
		-- FIXED front view: straight in front of you, slightly low; only the lens tightens
		local heat = math.clamp(training.streak / 40, 0, 1)
		local p = root.Position + look * 10 + Vector3.new(0, 0.8, 0)
		return CFrame.lookAt(p, root.Position + Vector3.new(0, 1.4, 0)), 56 - 8 * heat
	end, 3600, { smooth = 5, blendIn = 0.5 })
end

local function introCinematic(root: BasePart)
	local col = tierColor()
	local pos = stationPos() or root.Position
	Cine.letterbox(true)
	Fx.dust(pos + Vector3.new(0, 0.3, 0), 1.2)
	CameraController.shake(0.5, 0.3)
	local _ = col
	Sound.play("Transform", { volume = 0.7 })
	local look = root.CFrame.LookVector
	-- low hero angle in front, sweeping up and around... then the training orbit takes over
	CameraController.run(function(t)
		local r = root.Parent and root or nil
		if not r then return nil, 60 end
		-- push-in from the front to the fixed training view
		local k = Easing.cubicInOut(math.clamp(t / 1.7, 0, 1))
		local p = r.Position + look * (16 - 6 * k) + Vector3.new(0, 2.5 - 1.7 * k, 0)
		return CFrame.lookAt(p, r.Position + Vector3.new(0, 1.4, 0)), 48 + 8 * k
	end, 1.8, { smooth = 9, blendIn = 0.3 })
	task.delay(1.8, function()
		Cine.letterbox(false)
		if training.on then trainingCamera(root) end
	end)
end

local function startTraining()
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not root then return end
	training.on = true
	training.streak = 0
	training.gained = 0
	showCounter(true)
	if os.clock() - training.lastIntro > 25 and not CameraController.isBusy() then
		training.lastIntro = os.clock()
		introCinematic(root)
	else
		trainingCamera(root)
	end
end

local function stopTraining()
	if not training.on then return end
	training.on = false
	showCounter(false)
	CameraController.stop()
	Cine.dark(0)
	if training.streak >= 5 then
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
	local hot = math.clamp(n / 40, 0, 1)
	-- the counter: number slams in, hotter and bigger with the streak
	local c = buildCounter()
	c.num.Text = tostring(n)
	local hotCol = Color3.fromRGB(255, 230, 80):Lerp(Color3.fromRGB(255, 70, 50), hot)
	c.grad.Color = ColorSequence.new(Color3.new(1, 1, 1), hotCol)
	c.scale.Scale = 1.45 + hot * 0.3
	tween(c.scale, 0.28, { Scale = 1 + hot * 0.15 }, Enum.EasingStyle.Back)
	c.num.Rotation = (if n % 2 == 0 then 1 else -1) * (4 + hot * 4)
	tween(c.num, 0.3, { Rotation = 0 }, Enum.EasingStyle.Back)
	c.sub.Text = ("+%s 💪  ·  TOTAL +%s"):format(tostring(amount), tostring(training.gained))
	Cine.pop(head or root, ("+%d 💪"):format(amount), hotCol, 100 + math.min(60, n), 1)
	-- the effort hits the ground: dust and clods fly off the circle, sweat drops
	local feet = (stationPos() or root.Position) + Vector3.new(0, 0.3, 0)
	Fx.blocks(feet, Color3.fromRGB(150, 120, 80), 6 + math.floor(hot * 10), 9 + hot * 8, 0.22, { life = 0.7, up = 1.2, spread = 2.4, gravity = 50,
		colors = { Color3.fromRGB(150, 120, 80), Color3.fromRGB(110, 150, 70), Color3.fromRGB(120, 95, 60) } })
	if head then
		Fx.blocks(head.Position + Vector3.new(0, 0.5, 0), Color3.fromRGB(150, 220, 255), 3 + math.floor(hot * 4), 6, 0.16, { life = 0.6, up = 1.2, spread = 2, gravity = 30 })
	end
	CameraController.punch(-2 - hot * 3)
	CameraController.shake(0.15 + hot * 0.45, 0.18)
	Sound.play("Lift", { volume = 0.5, pitch = 1 + hot * 0.15 })
	if hot > 0.3 then Sound.play("Heartbeat", { pitch = 0.9 + hot * 0.5, volume = 0.3 + hot * 0.4 }) end
	Cine.dark(hot * 0.35)
	if MILESTONES[n] then
		Fx.dust(feet, 1.4)
		CameraController.shake(0.8, 0.35)
		CameraController.punch(-8)
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
