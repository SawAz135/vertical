--[[ FishUpController: the "FISH-UP" sign floating above every training station.
     Built locally (stud GUI style) on each station anchor (attribute FishUpBase).
     It is hidden from afar and pops in with a bounce when you walk close, shows
     your gain per lift on YOUR station, and pulses on every rep while training. ]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Data = require(script.Parent.Data)

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
		return ('<font color="#FFD23F">LIFTING!</font>  +%d 💪 / lift'):format(gain)
	end
	return ('Stand here: <font color="#7CFF46">+%d 💪</font> / lift'):format(gain)
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

	-- rep pulse: strength went up while training on my station
	local last = nil
	Data.Changed:Connect(function(key)
		if key ~= "strength" and key ~= "*" then return end
		local now = Data.values.strength or 0
		if last and now > last and player:GetAttribute("Training") then
			for _, s in signs do
				if s.base == player:GetAttribute("Base") then s.pulse = 1 end
			end
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
