--!strict
-- Mobile-first HUD: stage counter + progress bar, checkpoint pop, finish reveal.
-- Everything is sized in screen scale so it reads well on an iPhone in landscape.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage.Shared.Config)

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui") :: PlayerGui
local remotes = ReplicatedStorage:WaitForChild(Config.REMOTES_FOLDER)
local stageRemote = remotes:WaitForChild(Config.REMOTE_STAGE) :: RemoteEvent
local finishRemote = remotes:WaitForChild(Config.REMOTE_FINISH) :: RemoteEvent

local COLORS = Config.COLORS
local FONT = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Bold)
local FONT_HEAVY = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Heavy)

local function tween(instance: Instance, seconds: number, props: { [string]: any }, style: Enum.EasingStyle?, direction: Enum.EasingDirection?): Tween
	local t = TweenService:Create(
		instance,
		TweenInfo.new(seconds, style or Enum.EasingStyle.Quint, direction or Enum.EasingDirection.Out),
		props
	)
	t:Play()
	return t
end

local function corner(parent: Instance, radius: UDim)
	local c = Instance.new("UICorner")
	c.CornerRadius = radius
	c.Parent = parent
end

local function label(parent: Instance, text: string, font: Font, maxSize: number): TextLabel
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Text = text
	l.FontFace = font
	l.TextColor3 = Color3.new(1, 1, 1)
	l.TextScaled = true
	local limit = Instance.new("UITextSizeConstraint")
	limit.MaxTextSize = maxSize
	limit.Parent = l
	l.Parent = parent
	return l
end

---------------------------------------------------------------------------
-- Root
---------------------------------------------------------------------------
local gui = Instance.new("ScreenGui")
gui.Name = "BeyondHud"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = playerGui

---------------------------------------------------------------------------
-- Stage pill (top centre)
---------------------------------------------------------------------------
local pill = Instance.new("Frame")
pill.Name = "StagePill"
pill.AnchorPoint = Vector2.new(0.5, 0)
pill.Position = UDim2.new(0.5, 0, 0, 14)
pill.Size = UDim2.new(0.34, 0, 0, 58)
pill.BackgroundColor3 = COLORS.Base
pill.BackgroundTransparency = 0.15
pill.Parent = gui
corner(pill, UDim.new(1, 0))
local pillLimit = Instance.new("UISizeConstraint")
pillLimit.MinSize = Vector2.new(220, 0)
pillLimit.MaxSize = Vector2.new(420, math.huge)
pillLimit.Parent = pill

local pillStroke = Instance.new("UIStroke")
pillStroke.Thickness = 2
pillStroke.Color = Color3.new(1, 1, 1)
pillStroke.Parent = pill
local strokeGradient = Instance.new("UIGradient")
strokeGradient.Color = ColorSequence.new({
	ColorSequenceKeypoint.new(0, COLORS.Trim),
	ColorSequenceKeypoint.new(0.5, COLORS.Checkpoint),
	ColorSequenceKeypoint.new(1, COLORS.Trim),
})
strokeGradient.Parent = pillStroke

local stageText = label(pill, "STAGE 0 / " .. Config.STAGES, FONT, 22)
stageText.Size = UDim2.new(1, -40, 0, 24)
stageText.Position = UDim2.fromOffset(20, 8)

local track = Instance.new("Frame")
track.Name = "Track"
track.Position = UDim2.new(0, 20, 1, -18)
track.Size = UDim2.new(1, -40, 0, 6)
track.BackgroundColor3 = Color3.new(1, 1, 1)
track.BackgroundTransparency = 0.85
track.Parent = pill
corner(track, UDim.new(1, 0))

local fill = Instance.new("Frame")
fill.Name = "Fill"
fill.Size = UDim2.fromScale(0, 1)
fill.BackgroundColor3 = Color3.new(1, 1, 1)
fill.Parent = track
corner(fill, UDim.new(1, 0))
local fillGradient = Instance.new("UIGradient")
fillGradient.Color = ColorSequence.new(COLORS.Trim, COLORS.Checkpoint)
fillGradient.Parent = fill

-- Slow rotation of the outline gradient: a quiet "alive" shimmer.
task.spawn(function()
	while gui.Parent do
		strokeGradient.Rotation = (strokeGradient.Rotation + 2) % 360
		task.wait(1 / 30)
	end
end)

local function setStage(stage: number, animate: boolean)
	stageText.Text = string.format("STAGE %d / %d", stage, Config.STAGES)
	local goal = UDim2.fromScale(math.clamp(stage / Config.STAGES, 0, 1), 1)
	if animate then
		tween(fill, 0.7, { Size = goal }, Enum.EasingStyle.Back)
		-- Pill "breathes" in on progress.
		local scale = pill:FindFirstChildOfClass("UIScale") or Instance.new("UIScale")
		scale.Parent = pill
		scale.Scale = 1.12
		tween(scale, 0.45, { Scale = 1 }, Enum.EasingStyle.Elastic)
	else
		fill.Size = goal
	end
end

---------------------------------------------------------------------------
-- Sparkle burst: small glowing squares flying out from a screen point.
---------------------------------------------------------------------------
local function sparkleBurst(origin: UDim2, count: number, color: Color3)
	for i = 1, count do
		local spark = Instance.new("Frame")
		spark.AnchorPoint = Vector2.new(0.5, 0.5)
		spark.Position = origin
		local size = math.random(6, 14)
		spark.Size = UDim2.fromOffset(size, size)
		spark.BackgroundColor3 = color
		spark.BorderSizePixel = 0
		spark.Rotation = math.random(0, 90)
		spark.ZIndex = 20
		spark.Parent = gui
		corner(spark, UDim.new(0.3, 0))

		local angle = (i / count) * math.pi * 2 + math.random() * 0.4
		local distance = math.random(90, 220)
		local target = origin + UDim2.fromOffset(math.cos(angle) * distance, math.sin(angle) * distance)
		tween(spark, 0.55 + math.random() * 0.35, {
			Position = target,
			Rotation = spark.Rotation + math.random(-180, 180),
			BackgroundTransparency = 1,
			Size = UDim2.fromOffset(2, 2),
		}, Enum.EasingStyle.Quart)
		task.delay(1, function()
			spark:Destroy()
		end)
	end
end

---------------------------------------------------------------------------
-- Checkpoint popup
---------------------------------------------------------------------------
local popup = label(gui, "", FONT_HEAVY, 64)
popup.Name = "CheckpointPopup"
popup.AnchorPoint = Vector2.new(0.5, 0.5)
popup.Position = UDim2.fromScale(0.5, 0.32)
popup.Size = UDim2.fromScale(0.6, 0.12)
popup.TextTransparency = 1
popup.ZIndex = 10
local popupScale = Instance.new("UIScale")
popupScale.Parent = popup
local popupStroke = Instance.new("UIStroke")
popupStroke.Color = COLORS.Trim
popupStroke.Thickness = 3
popupStroke.Transparency = 1
popupStroke.Parent = popup

local popupToken = 0
local function showCheckpoint(stage: number)
	popupToken += 1
	local token = popupToken
	popup.Text = string.format("CHECKPOINT %d", stage)
	popup.TextColor3 = COLORS.CheckpointReached
	popup.TextTransparency = 0
	popupStroke.Transparency = 0
	-- Phase 1: overshoot in. Phase 2: settle. Phase 3: drift up and fade.
	popupScale.Scale = 0.4
	popup.Position = UDim2.fromScale(0.5, 0.34)
	tween(popupScale, 0.28, { Scale = 1.15 }, Enum.EasingStyle.Back)
	task.delay(0.28, function()
		if token == popupToken then
			tween(popupScale, 0.25, { Scale = 1 }, Enum.EasingStyle.Sine)
		end
	end)
	sparkleBurst(UDim2.fromScale(0.5, 0.34), 18, COLORS.CheckpointReached)
	task.delay(1.3, function()
		if token == popupToken then
			tween(popup, 0.6, { TextTransparency = 1, Position = UDim2.fromScale(0.5, 0.28) }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
			tween(popupStroke, 0.6, { Transparency = 1 })
		end
	end)
end

-- Recolour a reached checkpoint locally (only this player sees their progress).
local function markCheckpoint(stage: number)
	local courseModel = workspace:FindFirstChild("BeyondCourse")
	local folder = courseModel and courseModel:FindFirstChild("Checkpoints")
	local part = folder and folder:FindFirstChild(string.format("Checkpoint_%02d", stage))
	if part and part:IsA("BasePart") then
		tween(part, 0.6, { Color = COLORS.CheckpointReached })
		local trim = folder:FindFirstChild(part.Name .. "_Trim")
		if trim and trim:IsA("BasePart") then
			tween(trim, 0.6, { Color = COLORS.CheckpointReached })
		end
	end
end

---------------------------------------------------------------------------
-- Finish reveal
---------------------------------------------------------------------------
local function showFinish(seconds: number)
	local overlay = Instance.new("Frame")
	overlay.Name = "FinishOverlay"
	overlay.Size = UDim2.fromScale(1, 1)
	overlay.BackgroundColor3 = Color3.new(0, 0, 0)
	overlay.BackgroundTransparency = 1
	overlay.ZIndex = 30
	overlay.Parent = gui
	tween(overlay, 0.5, { BackgroundTransparency = 0.35 })

	local word = "BEYOND"
	local letters: { TextLabel } = {}
	local holder = Instance.new("Frame")
	holder.BackgroundTransparency = 1
	holder.AnchorPoint = Vector2.new(0.5, 0.5)
	holder.Position = UDim2.fromScale(0.5, 0.42)
	holder.Size = UDim2.fromScale(0.7, 0.2)
	holder.ZIndex = 31
	holder.Parent = overlay
	for i = 1, #word do
		local letter = label(holder, string.sub(word, i, i), FONT_HEAVY, 120)
		letter.ZIndex = 32
		letter.Size = UDim2.fromScale(1 / #word, 1)
		letter.Position = UDim2.fromScale((i - 1) / #word, 0.25)
		letter.TextColor3 = COLORS.Finish
		letter.TextTransparency = 1
		table.insert(letters, letter)
	end
	-- Letters rise in one after another with a small overshoot.
	for i, letter in letters do
		task.delay(0.35 + i * 0.08, function()
			tween(letter, 0.5, { TextTransparency = 0, Position = UDim2.fromScale((i - 1) / #word, 0) }, Enum.EasingStyle.Back)
		end)
	end

	local timeLabel = label(overlay, string.format("COURSE CLEARED  ·  %.2fs", seconds), FONT, 30)
	timeLabel.ZIndex = 32
	timeLabel.AnchorPoint = Vector2.new(0.5, 0.5)
	timeLabel.Position = UDim2.fromScale(0.5, 0.58)
	timeLabel.Size = UDim2.fromScale(0.6, 0.06)
	timeLabel.TextTransparency = 1
	task.delay(1.0, function()
		tween(timeLabel, 0.6, { TextTransparency = 0 })
		sparkleBurst(UDim2.fromScale(0.5, 0.42), 36, COLORS.Finish)
	end)

	-- Camera punch: widen the field of view, then ease back.
	local camera = workspace.CurrentCamera
	if camera then
		local baseFov = camera.FieldOfView
		tween(camera, 0.35, { FieldOfView = baseFov + 18 }, Enum.EasingStyle.Quad)
		task.delay(0.35, function()
			tween(camera, 1.2, { FieldOfView = baseFov }, Enum.EasingStyle.Elastic)
		end)
	end

	task.delay(5, function()
		tween(overlay, 0.8, { BackgroundTransparency = 1 })
		for _, letter in letters do
			tween(letter, 0.6, { TextTransparency = 1 })
		end
		tween(timeLabel, 0.6, { TextTransparency = 1 })
		task.delay(0.9, function()
			overlay:Destroy()
		end)
	end)
end

---------------------------------------------------------------------------
-- Wiring
---------------------------------------------------------------------------
local stats = player:WaitForChild("leaderstats")
local stageValue = stats:WaitForChild(Config.STAT_NAME) :: IntValue
setStage(stageValue.Value, false)
for stage = 1, stageValue.Value do
	markCheckpoint(stage)
end
stageValue.Changed:Connect(function(value: number)
	setStage(value, true)
end)

stageRemote.OnClientEvent:Connect(function(stage: number)
	showCheckpoint(stage)
	markCheckpoint(stage)
end)

finishRemote.OnClientEvent:Connect(function(seconds: number)
	showFinish(seconds)
end)
