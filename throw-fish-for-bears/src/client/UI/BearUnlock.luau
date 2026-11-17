--[[ BearUnlock: full-screen "BEAR UNLOCKED!" screen after a capture (stud style).
     Dark backdrop, rotating rarity sun-rays, the living 3D bear popping in, its name,
     rarity (animated colours for the top tiers), weight + $/s chips, NEW! badge and
     falling stud confetti. It stays until the player taps / clicks (or presses a key):
     a full-screen button swallows the input so nothing happens in the world behind. ]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local BearConfig = require(Shared.Config.BearConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local Format = require(Shared.Util.Format)
local Sim = require(script.Parent.Sim)
local K = require(script.Parent.Kit)
local Sound = require(script.Parent.Parent.Controllers.Sound)

local BearUnlock = {}
local player = Players.LocalPlayer
local RGB = Color3.fromRGB
local new = Sim.new
local queue = {}
local busy = false

local function tween(o, t, goal, style, dir)
	local tw = TweenService:Create(o, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), goal)
	tw:Play()
	return tw
end

local function play(bear, income: number, isNew: boolean?)
	local spec = BearConfig.get(bear.s)
	local tier = RarityConfig.get(bear.r)
	local col = tier.textColor or tier.color
	local variant = if bear.v and bear.v ~= "Normal" then bear.v .. " " else ""
	local k = Sim.Motion.ScreenScale()

	local gui = new("ScreenGui", { Name = "BearUnlock", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 30,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling, ScreenInsets = Enum.ScreenInsets.None }, player:WaitForChild("PlayerGui"))
	-- full-screen catcher: swallows taps so the world behind does not react
	local catcher = new("TextButton", { Text = "", AutoButtonColor = false, BackgroundColor3 = RGB(0, 0, 0), BackgroundTransparency = 1,
		Size = UDim2.fromScale(1, 1), ZIndex = 1, Modal = true }, gui)
	tween(catcher, 0.4, { BackgroundTransparency = 0.35 })

	-- sun rays
	local rays = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(1100 * k, 1100 * k), Position = UDim2.fromScale(0.5, 0.48), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 2 }, gui)
	for i = 0, 15 do
		local ray = new("Frame", { BackgroundColor3 = col, BackgroundTransparency = 0.6, BorderSizePixel = 0, Size = UDim2.fromScale(0.05, 1),
			Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), Rotation = i * 11.25, ZIndex = 2 }, rays)
		new("UIGradient", { Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.5, 0.1), NumberSequenceKeypoint.new(1, 1) }) }, ray)
	end
	local raysScale = new("UIScale", { Scale = 0 }, rays)
	tween(raysScale, 0.6, { Scale = 1 }, Enum.EasingStyle.Back)

	-- content (scaled like every stud window)
	local root = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(640, 560), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 3 }, gui)
	local rs = new("UIScale", { Scale = k * 0.3 }, root)
	tween(rs, 0.45, { Scale = k }, Enum.EasingStyle.Back)

	-- title: text only, no banner background
	local title = Sim.text(root, "BEAR UNLOCKED!", { Size = UDim2.fromOffset(600, 72), Position = UDim2.fromOffset(320, 46), Max = 58, Stroke = 5, ZIndex = 8,
		Gradient = { RGB(255, 255, 255), RGB(255, 236, 140) } })
	local titleScale = new("UIScale", { Scale = 0 }, title)
	task.delay(0.1, function() tween(titleScale, 0.4, { Scale = 1 }, Enum.EasingStyle.Back) end)
	if isNew then
		local badge = Sim.panel(root, { Size = UDim2.fromOffset(96, 42), Position = UDim2.fromOffset(520, 0), Gradient = Sim.G.red, Stroke = 3.5, ZIndex = 9 })
		badge.Rotation = 12
		Sim.text(badge, "NEW!", { Size = UDim2.new(1, -10, 0.8, 0), Max = 28, ZIndex = 10 })
		local bs = new("UIScale", { Scale = 0 }, badge)
		task.delay(0.5, function() tween(bs, 0.35, { Scale = 1 }, Enum.EasingStyle.Back) end)
	end

	-- the living bear: NO card / white background any more, the bear floats on the screen and is turned the other way
	local stage = new("Frame", { Name = "BearStage", BackgroundTransparency = 1, Size = UDim2.fromOffset(460, 310), Position = UDim2.fromOffset(90, 84), ZIndex = 4 }, root)
	Sim.model(stage, { kind = "Bear", id = bear.s, variant = bear.v, size = UDim2.fromScale(1.05, 1.1), position = UDim2.fromScale(0.5, 0.52), yaw = math.rad(150), pitch = math.rad(10) })
	local ss = new("UIScale", { Scale = 0.2 }, stage)
	task.delay(0.15, function() tween(ss, 0.55, { Scale = 1 }, Enum.EasingStyle.Elastic) end)

	-- name + rarity
	local name = Sim.text(root, variant .. spec.name, { Size = UDim2.fromOffset(600, 56), Position = UDim2.fromOffset(320, 398), Max = 52, Stroke = 4.5, ZIndex = 6 })
	local rarity = Sim.text(root, tier.name:upper(), { Size = UDim2.fromOffset(500, 48), Position = UDim2.fromOffset(320, 448), Max = 44, Stroke = 4.5, ZIndex = 6,
		Gradient = { Color3.new(1, 1, 1), col } })
	local rgrad = rarity:FindFirstChildOfClass("UIGradient")
	local _ = name
	-- chips
	Sim.infoBar(root, ('<font color="#FFD23F">%s</font>'):format(Format.kg(bear.w)), { Size = UDim2.fromOffset(190, 38), Position = UDim2.fromOffset(215, 500), Max = 24, ZIndex = 6 })
	Sim.infoBar(root, ('<font color="#7CFF46">%s</font>'):format(Format.perSec(income)), { Size = UDim2.fromOffset(190, 38), Position = UDim2.fromOffset(425, 500), Max = 24, ZIndex = 6 })

	-- tap to continue (armed after a short delay so nobody skips it by accident)
	local tap = Sim.text(gui, "TAP TO CONTINUE", { Size = UDim2.fromOffset(420 * k, 40 * k), Position = UDim2.new(0.5, 0, 1, -50 * k), Max = 34, Stroke = 3.5, ZIndex = 9 })
	tap.TextTransparency = 1
	local tapStroke = tap:FindFirstChildOfClass("UIStroke")
	if tapStroke then tapStroke.Transparency = 1 end
	local armed = false
	task.delay(0.9, function()
		armed = true
		tween(tap, 0.3, { TextTransparency = 0 })
		if tapStroke then tween(tapStroke, 0.3, { Transparency = 0 }) end
	end)

	-- confetti
	local confettiAcc = 0
	local function confetti()
		local s = math.random(10, 18) * k
		local f = new("Frame", { BackgroundColor3 = ({ col, RGB(255, 255, 255), RGB(255, 220, 60), RGB(120, 220, 255) })[math.random(1, 4)],
			Size = UDim2.fromOffset(s, s), Position = UDim2.new(math.random(), 0, -0.05, 0), Rotation = math.random(0, 90), ZIndex = 8, BorderSizePixel = 0 }, gui)
		Sim.corner(f, 2)
		Sim.stroke(f, 1.5)
		local dur = 2.2 + math.random() * 1.6
		tween(f, dur, { Position = UDim2.new(f.Position.X.Scale + (math.random() - 0.5) * 0.15, 0, 1.08, 0), Rotation = f.Rotation + math.random(-300, 300) }, Enum.EasingStyle.Linear)
		task.delay(dur, function() f:Destroy() end)
	end
	for _ = 1, 30 do confetti() end

	Sound.play("Reveal" .. math.max(2, tier.reveal))
	Sound.play("Arrive")

	local closing = false
	local done = Instance.new("BindableEvent")
	local conn = RunService.RenderStepped:Connect(function(dt)
		local t = os.clock()
		rays.Rotation += dt * 12
		tap.Rotation = math.sin(t * 3) * 2
		if armed then
			local p = 1 + math.sin(t * 5) * 0.06
			tap.Size = UDim2.fromOffset(420 * k * p, 40 * k * p)
		end
		if (tier.rainbow or tier.impossible) and rgrad then
			rgrad.Color = ColorSequence.new(Color3.fromHSV((t * 0.4) % 1, 0.5, 1), Color3.fromHSV((t * 0.4 + 0.35) % 1, 0.8, 1))
		end
		confettiAcc += dt
		if confettiAcc > 0.12 and not closing then
			confettiAcc = 0
			confetti()
		end
	end)
	local function close()
		if closing or not armed then return end
		closing = true
		Sound.play("Close")
		tween(rs, 0.25, { Scale = k * 0.2 }, Enum.EasingStyle.Back, Enum.EasingDirection.In)
		tween(raysScale, 0.25, { Scale = 0 }, Enum.EasingStyle.Back, Enum.EasingDirection.In)
		tween(catcher, 0.3, { BackgroundTransparency = 1 })
		tween(tap, 0.2, { TextTransparency = 1 })
		task.delay(0.35, function()
			conn:Disconnect()
			gui:Destroy()
			done:Fire()
		end)
	end
	catcher.Activated:Connect(close)
	local keyConn = UserInputService.InputBegan:Connect(function(input)
		if input.KeyCode == Enum.KeyCode.Space or input.KeyCode == Enum.KeyCode.Return or input.KeyCode == Enum.KeyCode.ButtonA or input.KeyCode == Enum.KeyCode.E then
			close()
		end
	end)
	done.Event:Wait()
	keyConn:Disconnect()
	done:Destroy()
end

function BearUnlock.isOpen(): boolean
	return busy
end

function BearUnlock.show(bear, income: number, isNew: boolean?)
	table.insert(queue, { bear, income, isNew })
	if busy then return end
	busy = true
	task.spawn(function()
		while #queue > 0 do
			local q = table.remove(queue, 1)
			local ok, err = pcall(play, q[1], q[2], q[3])
			if not ok then warn("[TFB] bear unlock", err) end
		end
		busy = false
	end)
end

return BearUnlock
