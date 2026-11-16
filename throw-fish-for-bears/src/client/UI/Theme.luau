--[[ Theme: the stud simulator UI kit (matches the reference screenshots):
     saturated two-stop gradients, thick black outlines, white text with black
     stroke (FredokaOne), rounded corners, real stud dots on panels, bouncy
     press / hover feedback, window pop-in. Sizes are in "points" for a phone
     landscape layout (900 x 420); the root UIScale adapts to every screen. ]]
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Sound = require(script.Parent.Parent.Controllers.Sound)
local Spring = require(ReplicatedStorage.Shared.Util.Spring)

local Theme = {}
local C = Color3.fromRGB

Theme.Font = Enum.Font.FredokaOne
Theme.FontBold = Enum.Font.LuckiestGuy

-- gradient pairs (top, bottom)
Theme.G = {
	green = { C(150, 255, 60), C(40, 190, 30) },
	blue = { C(80, 230, 255), C(20, 130, 230) },
	red = { C(255, 90, 90), C(200, 20, 30) },
	orange = { C(255, 190, 70), C(240, 110, 20) },
	yellow = { C(255, 240, 90), C(240, 170, 20) },
	purple = { C(230, 120, 255), C(150, 40, 230) },
	pink = { C(255, 130, 220), C(220, 40, 160) },
	teal = { C(90, 255, 210), C(20, 170, 150) },
	grey = { C(110, 110, 118), C(66, 66, 72) },
	dark = { C(70, 70, 76), C(42, 42, 48) },
	wood = { C(230, 170, 90), C(170, 100, 40) },
	gold = { C(255, 236, 140), C(230, 160, 20) },
	magenta = { C(240, 90, 255), C(190, 30, 220) },
	navy = { C(70, 90, 180), C(30, 40, 110) },
}
Theme.BODY = C(48, 48, 54)
Theme.BODY_STUD = C(36, 36, 41)
Theme.GREEN_TEXT = C(130, 255, 60)
Theme.MONEY = C(110, 255, 90)

function Theme.new(class: string, props: any?, children: { Instance }?)
	local o = Instance.new(class)
	for k, v in props or {} do
		(o :: any)[k] = v
	end
	for _, c in children or {} do
		c.Parent = o
	end
	return o
end
local new = Theme.new

function Theme.corner(r: number?)
	return new("UICorner", { CornerRadius = UDim.new(0, r or 8) })
end

function Theme.stroke(th: number?, color: Color3?, mode: Enum.ApplyStrokeMode?)
	return new("UIStroke", {
		Thickness = th or 3, Color = color or C(0, 0, 0),
		ApplyStrokeMode = mode or Enum.ApplyStrokeMode.Border, LineJoinMode = Enum.LineJoinMode.Round,
	})
end

function Theme.gradient(pair, rot: number?)
	return new("UIGradient", {
		Color = ColorSequence.new(pair[1], pair[2]), Rotation = rot or 90,
	})
end

function Theme.pad(px: number)
	return new("UIPadding", {
		PaddingLeft = UDim.new(0, px), PaddingRight = UDim.new(0, px),
		PaddingTop = UDim.new(0, px), PaddingBottom = UDim.new(0, px),
	})
end

-- white text with a thick black stroke (the signature simulator text)
function Theme.text(props: any)
	local t = new("TextLabel", {
		BackgroundTransparency = 1, Font = props.Font or Theme.Font, TextScaled = true,
		TextColor3 = props.Color or C(255, 255, 255), Text = props.Text or "",
		Size = props.Size or UDim2.fromScale(1, 1), Position = props.Position or UDim2.new(),
		AnchorPoint = props.AnchorPoint or Vector2.zero, TextXAlignment = props.XAlign or Enum.TextXAlignment.Center,
		TextYAlignment = props.YAlign or Enum.TextYAlignment.Center, ZIndex = props.ZIndex or 1,
		Name = props.Name or "Text", RichText = props.RichText or false, LayoutOrder = props.LayoutOrder or 0,
		TextWrapped = props.Wrapped or false,
	})
	new("UIStroke", { Thickness = props.Stroke or 2.5, Color = props.StrokeColor or C(0, 0, 0), LineJoinMode = Enum.LineJoinMode.Round }).Parent = t
	if props.Max then
		new("UITextSizeConstraint", { MaxTextSize = props.Max, MinTextSize = props.Min or 6 }).Parent = t
	end
	if props.Parent then t.Parent = props.Parent end
	return t
end

-- real stud dots (UIGridLayout of round frames), refilled when the size changes
function Theme.studs(frame: GuiObject, px: number, color: Color3, transparency: number?)
	local layer = new("Frame", {
		Name = "Studs", BackgroundTransparency = 1, Size = UDim2.new(1, -6, 1, -6),
		Position = UDim2.fromOffset(3, 3), ClipsDescendants = true, ZIndex = frame.ZIndex,
	})
	local grid = new("UIGridLayout", {
		CellSize = UDim2.fromOffset(px * 0.62, px * 0.62), CellPadding = UDim2.fromOffset(px * 0.38, px * 0.38),
		HorizontalAlignment = Enum.HorizontalAlignment.Center, VerticalAlignment = Enum.VerticalAlignment.Center,
		SortOrder = Enum.SortOrder.LayoutOrder,
	})
	grid.Parent = layer
	layer.Parent = frame
	local count = 0
	local function fill()
		local scale = 1
		local s = frame:FindFirstAncestorWhichIsA("ScreenGui")
		local ui = s and s:FindFirstChild("RootScale")
		if ui then scale = ui.Scale end
		local abs = layer.AbsoluteSize / math.max(scale, 0.1)
		local cols = math.ceil(abs.X / px) + 1
		local rows = math.ceil(abs.Y / px) + 1
		local need = math.min(cols * rows, 260)
		if need == count then return end
		for _, c in layer:GetChildren() do
			if c:IsA("Frame") then c:Destroy() end
		end
		for _ = 1, need do
			local dot = new("Frame", {
				BackgroundColor3 = color, BackgroundTransparency = transparency or 0.55,
				BorderSizePixel = 0, ZIndex = frame.ZIndex,
			})
			Theme.corner(px).Parent = dot
			dot.Parent = layer
		end
		count = need
	end
	layer:GetPropertyChangedSignal("AbsoluteSize"):Connect(fill)
	task.defer(fill)
	return layer
end

-- a coloured block with gradient + black outline (+ optional studs)
function Theme.block(props: any)
	local f = new("Frame", {
		Name = props.Name or "Block", Size = props.Size or UDim2.fromScale(1, 1),
		Position = props.Position or UDim2.new(), AnchorPoint = props.AnchorPoint or Vector2.zero,
		BackgroundColor3 = C(255, 255, 255), BorderSizePixel = 0, ZIndex = props.ZIndex or 1,
		LayoutOrder = props.LayoutOrder or 0, ClipsDescendants = props.Clip or false,
		BackgroundTransparency = props.Transparency or 0,
	})
	if props.Gradient then
		Theme.gradient(props.Gradient, props.GradRot).Parent = f
	elseif props.Color then
		f.BackgroundColor3 = props.Color
	end
	Theme.corner(props.Corner or 8).Parent = f
	if props.StrokeWidth ~= 0 then
		Theme.stroke(props.StrokeWidth or 3, props.StrokeColor).Parent = f
	end
	if props.Studs then
		Theme.studs(f, props.Studs, props.StudColor or C(255, 255, 255), props.StudTransparency or 0.86)
	end
	if props.Parent then f.Parent = props.Parent end
	return f
end

-- press / hover feedback on any GuiButton (UIScale based, layout safe)
function Theme.bounce(button: GuiButton, sound: string?)
	local scale = button:FindFirstChildOfClass("UIScale") or new("UIScale", { Parent = button })
	local spring = Spring.new(1, 26, 0.45)
	local hovering, pressing = false, false
	local conn
	local function target()
		spring.Target = if pressing then 0.88 elseif hovering then 1.07 else 1
		if not conn then
			conn = game:GetService("RunService").RenderStepped:Connect(function(dt)
				local v = spring:Step(dt)
				scale.Scale = v
				if math.abs(v - spring.Target) < 0.001 and math.abs(spring.Velocity) < 0.001 then
					conn:Disconnect()
					conn = nil
					scale.Scale = spring.Target
				end
			end)
		end
	end
	button.MouseEnter:Connect(function() hovering = true target() end)
	button.MouseLeave:Connect(function() hovering = false pressing = false target() end)
	button.InputBegan:Connect(function(i)
		if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then
			pressing = true
			target()
		end
	end)
	button.InputEnded:Connect(function(i)
		if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then
			pressing = false
			target()
		end
	end)
	if sound ~= "" then
		button.Activated:Connect(function()
			Sound.play(sound or "Click")
		end)
	end
	return scale
end

-- gradient button with outlined text
function Theme.button(props: any)
	local b = new("TextButton", {
		Name = props.Name or "Button", Size = props.Size or UDim2.fromOffset(120, 40),
		Position = props.Position or UDim2.new(), AnchorPoint = props.AnchorPoint or Vector2.zero,
		BackgroundColor3 = C(255, 255, 255), Text = "", AutoButtonColor = false, BorderSizePixel = 0,
		LayoutOrder = props.LayoutOrder or 0, ZIndex = props.ZIndex or 1,
	})
	Theme.gradient(props.Gradient or Theme.G.green).Parent = b
	Theme.corner(props.Corner or 8).Parent = b
	Theme.stroke(props.StrokeWidth or 3).Parent = b
	-- glossy top highlight
	local gloss = new("Frame", {
		Name = "Gloss", BackgroundColor3 = C(255, 255, 255), BackgroundTransparency = 0.72,
		Size = UDim2.new(1, -8, 0.32, 0), Position = UDim2.fromOffset(4, 3), BorderSizePixel = 0, ZIndex = b.ZIndex,
	})
	Theme.corner(6).Parent = gloss
	gloss.Parent = b
	if props.Studs then Theme.studs(b, props.Studs, C(255, 255, 255), 0.85) end
	local label = Theme.text({
		Text = props.Text or "", Size = props.TextSize or UDim2.new(1, -10, 0.78, 0),
		Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), Max = props.Max or 28,
		Stroke = props.Stroke or 2.5, ZIndex = b.ZIndex + 1, Name = "Label", RichText = props.RichText,
	})
	label.Parent = b
	Theme.bounce(b, props.Sound)
	if props.OnClick then b.Activated:Connect(props.OnClick) end
	if props.Parent then b.Parent = props.Parent end
	return b, label
end

function Theme.setGradient(obj: GuiObject, pair)
	local g = obj:FindFirstChildOfClass("UIGradient")
	if g then g.Color = ColorSequence.new(pair[1], pair[2]) end
end

-- red notification badge ("!" or a number) in the top right corner
function Theme.badge(parent: GuiObject)
	local b = new("Frame", {
		Name = "Badge", Size = UDim2.fromOffset(20, 20), Position = UDim2.new(1, -6, 0, -8),
		BackgroundColor3 = C(230, 30, 40), Visible = false, ZIndex = parent.ZIndex + 5,
	})
	Theme.corner(10).Parent = b
	Theme.stroke(2, C(255, 255, 255)).Parent = b
	Theme.text({ Text = "!", Size = UDim2.fromScale(0.8, 0.8), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), Max = 16, ZIndex = b.ZIndex + 1 }).Parent = b
	b.Parent = parent
	return b
end

function Theme.tween(obj: Instance, t: number, props: any, style: Enum.EasingStyle?, dir: Enum.EasingDirection?)
	local tw = TweenService:Create(obj, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), props)
	tw:Play()
	return tw
end

function Theme.isTouch(): boolean
	return UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled
end

return Theme
