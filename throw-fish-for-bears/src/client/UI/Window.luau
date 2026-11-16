--[[ Window: stud style menu window (reference "Boutique" / "Index" windows).
     Coloured studded header with a big outlined title and a red X, dark studded
     body. One window at a time; pop-in with a springy scale + slight rise. ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Theme = require(script.Parent.Theme)
local Sound = require(script.Parent.Parent.Controllers.Sound)
local Signal = require(ReplicatedStorage.Shared.Util.Signal)
local Spring = require(ReplicatedStorage.Shared.Util.Spring)

local Window = {}
Window.__index = Window
Window.root = nil :: ScreenGui?
Window.current = nil
Window.Opened = Signal.new()

local C = Color3.fromRGB

function Window.setRoot(gui: ScreenGui)
	Window.root = gui
end

--[[ Window.new({ name, title, gradient, size = Vector2 (points), studs = true }) ]]
function Window.new(opts)
	local self = setmetatable({}, Window)
	self.name = opts.name
	self.OnOpen = Signal.new()
	self.OnClose = Signal.new()
	local size = opts.size or Vector2.new(560, 330)
	local frame = Theme.new("Frame", {
		Name = opts.name, Size = UDim2.fromOffset(size.X, size.Y), AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5), BackgroundColor3 = C(20, 20, 24), Visible = false, ZIndex = 20,
	})
	Theme.corner(10).Parent = frame
	Theme.stroke(4).Parent = frame
	self.scale = Theme.new("UIScale", { Scale = 1, Parent = frame })
	-- header
	local headerH = opts.headerHeight or 54
	local header = Theme.block({
		Name = "Header", Size = UDim2.new(1, 0, 0, headerH), Gradient = opts.gradient or Theme.G.green,
		Corner = 10, StrokeWidth = 3, Studs = 16, StudTransparency = 0.82, ZIndex = 21, Parent = frame, Clip = true,
	})
	-- diagonal shine stripes like the reference header
	for i = 0, 2 do
		local stripe = Theme.new("Frame", {
			BackgroundColor3 = C(255, 255, 255), BackgroundTransparency = 0.8, BorderSizePixel = 0,
			Size = UDim2.new(0, 22, 2, 0), Position = UDim2.new(0.55 + i * 0.07, 0, -0.5, 0), Rotation = 25, ZIndex = 21,
		})
		stripe.Parent = header
	end
	Theme.text({
		Text = opts.title, Size = UDim2.new(0.7, 0, 0.82, 0), Position = UDim2.new(0, 16, 0.5, 0),
		AnchorPoint = Vector2.new(0, 0.5), XAlign = Enum.TextXAlignment.Left, Max = 44, Stroke = 4, ZIndex = 23,
		Font = Theme.FontBold, Parent = header,
	})
	local close = Theme.button({
		Name = "Close", Text = "X", Gradient = Theme.G.red, Size = UDim2.fromOffset(headerH - 10, headerH - 10),
		Position = UDim2.new(1, -6, 0.5, 0), AnchorPoint = Vector2.new(1, 0.5), Max = 34, ZIndex = 24, Sound = "Close",
		Corner = 6, Parent = header,
	})
	close.Activated:Connect(function() self:close() end)
	-- body
	local body = Theme.block({
		Name = "Body", Size = UDim2.new(1, -10, 1, -headerH - 10), Position = UDim2.fromOffset(5, headerH + 5),
		Color = Theme.BODY, Corner = 8, StrokeWidth = 0, Studs = 18, StudColor = Theme.BODY_STUD, StudTransparency = 0.1,
		ZIndex = 20, Parent = frame,
	})
	local content = Theme.new("Frame", {
		Name = "Content", BackgroundTransparency = 1, Size = UDim2.new(1, -16, 1, -16), Position = UDim2.fromOffset(8, 8), ZIndex = 22,
	})
	content.Parent = body
	self.frame = frame
	self.header = header
	self.body = body
	self.content = content
	frame.Parent = Window.root
	self.spring = Spring.new(1, 22, 0.55)
	return self
end

function Window:isOpen(): boolean
	return self.frame.Visible
end

function Window:animate(target: number, onDone)
	if self.conn then self.conn:Disconnect() end
	self.spring.Target = target
	self.conn = RunService.RenderStepped:Connect(function(dt)
		local v = self.spring:Step(dt)
		self.scale.Scale = math.max(0.01, v)
		self.frame.Position = UDim2.new(0.5, 0, 0.5, (1 - math.min(v, 1)) * 40)
		if math.abs(v - target) < 0.002 and math.abs(self.spring.Velocity) < 0.01 then
			self.conn:Disconnect()
			self.conn = nil
			self.scale.Scale = math.max(0.01, target)
			if onDone then onDone() end
		end
	end)
end

function Window:open()
	if Window.current and Window.current ~= self then
		Window.current:close(true)
	end
	Window.current = self
	if self.frame.Visible then return end
	self.frame.Visible = true
	self.spring:Snap(0.55)
	self.spring.Velocity = 2
	self:animate(1)
	Sound.play("Open")
	self.OnOpen:Fire()
	Window.Opened:Fire(self)
end

function Window:close(instant: boolean?)
	if not self.frame.Visible then return end
	if Window.current == self then Window.current = nil end
	self.OnClose:Fire()
	if instant then
		self.frame.Visible = false
		return
	end
	self.spring.Velocity = -1
	self:animate(0.7, function()
		self.frame.Visible = false
	end)
	task.delay(0.25, function()
		if Window.current ~= self then self.frame.Visible = false end
	end)
end

function Window:toggle()
	if self:isOpen() then self:close() else self:open() end
end

function Window.closeAll()
	if Window.current then Window.current:close() end
end

-- scrolling grid helper inside a window
function Window.scroll(parent: Instance, props: any)
	local sf = Theme.new("ScrollingFrame", {
		Name = props.Name or "Scroll", BackgroundTransparency = 1, BorderSizePixel = 0,
		Size = props.Size or UDim2.fromScale(1, 1), Position = props.Position or UDim2.new(),
		CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 6,
		ScrollBarImageColor3 = C(255, 255, 255), ScrollingDirection = Enum.ScrollingDirection.Y, ZIndex = 22,
	})
	if props.Grid then
		Theme.new("UIGridLayout", {
			CellSize = props.Grid, CellPadding = props.Padding or UDim2.fromOffset(8, 8),
			SortOrder = Enum.SortOrder.LayoutOrder, HorizontalAlignment = Enum.HorizontalAlignment.Center,
		}).Parent = sf
	else
		Theme.new("UIListLayout", { Padding = UDim.new(0, props.Gap or 8), SortOrder = Enum.SortOrder.LayoutOrder, HorizontalAlignment = Enum.HorizontalAlignment.Center }).Parent = sf
	end
	Theme.new("UIPadding", { PaddingTop = UDim.new(0, 6), PaddingBottom = UDim.new(0, 8), PaddingLeft = UDim.new(0, 4), PaddingRight = UDim.new(0, 8) }).Parent = sf
	sf.Parent = parent
	return sf
end

return Window
