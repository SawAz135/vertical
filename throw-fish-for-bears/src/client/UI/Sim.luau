--[[ Sim: the simulator stud UI of the reference screenshots ("Boutique de pioches" /
     "Boutique de gemmes"), rebuilt 1:1 for this game:
       - solid coloured header (top light -> bottom dark) with tiled studs + diagonal
         light bands, big white FredokaOne title with a thick black outline, red square X
       - dark grey body covered with dark studs, thick black frame
       - item cards: light studded gradient by rarity, title on top, rarity label, the
         item in the middle, dark translucent stat bar, big green "Equip" button
       - section titles "-- Name --" in orange/yellow gradient text
     Pixel sizes for a 1050 x 620 screen, scaled by one UIScale per root (StudMotion).
     Motion (open / close bounce + blur, hover / press) comes from StudMotion. ]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local Motion = require(ReplicatedStorage.Shared.StudKit.StudMotion)
local StudUI = require(ReplicatedStorage.Shared.StudKit.StudUI)
local Viewport = require(script.Parent.Viewport)

local Sim = {}
Sim.Motion = Motion
local RGB = Color3.fromRGB
local WHITE = Color3.new(1, 1, 1)
local BLACK = Color3.new(0, 0, 0)
Sim.STUDS = StudUI.Assets.Studs -- tileable stud texture
Sim.FONT = Enum.Font.FredokaOne
Sim.sounds = nil

-- one shared sound folder for every Sim button (StudMotion sound set)
function Sim.init(playerGui: Instance)
	local holder = Instance.new("Folder")
	holder.Name = "TFB_SimSounds"
	holder.Parent = playerGui
	Sim.sounds = Motion.CreateSounds(holder)
end

-- gradients (top, bottom)
Sim.G = {
	green = { RGB(176, 255, 64), RGB(70, 205, 20) },
	blue = { RGB(96, 214, 255), RGB(26, 120, 235) },
	orange = { RGB(255, 178, 46), RGB(246, 104, 12) },
	red = { RGB(255, 74, 74), RGB(205, 16, 22) },
	yellow = { RGB(255, 236, 90), RGB(246, 176, 18) },
	purple = { RGB(220, 120, 255), RGB(140, 40, 225) },
	pink = { RGB(255, 120, 210), RGB(220, 30, 150) },
	teal = { RGB(90, 255, 205), RGB(20, 175, 150) },
	grey = { RGB(150, 150, 158), RGB(92, 92, 100) },
	light = { RGB(252, 252, 252), RGB(206, 208, 214) },
	dark = { RGB(64, 64, 70), RGB(40, 40, 46) },
	gold = { RGB(255, 236, 130), RGB(232, 164, 20) },
	navy = { RGB(76, 96, 190), RGB(30, 40, 116) },
}

-- card backgrounds per rarity (like "Commun" white / "Peu commun" green)
Sim.RARITY_CARD = {
	Common = { RGB(255, 255, 255), RGB(212, 214, 220) },
	Uncommon = { RGB(214, 255, 150), RGB(110, 222, 50) },
	Rare = { RGB(170, 226, 255), RGB(60, 150, 245) },
	Epic = { RGB(230, 180, 255), RGB(150, 70, 235) },
	Legendary = { RGB(255, 240, 150), RGB(250, 170, 20) },
	Mythic = { RGB(255, 170, 190), RGB(235, 50, 90) },
	Secret = { RGB(110, 110, 120), RGB(30, 30, 36) },
	UltraSecret = { RGB(255, 200, 255), RGB(120, 200, 255) },
}
Sim.RARITY_TEXT = {
	Common = RGB(255, 255, 255), Uncommon = RGB(140, 255, 60), Rare = RGB(90, 190, 255), Epic = RGB(210, 120, 255),
	Legendary = RGB(255, 205, 40), Mythic = RGB(255, 80, 110), Secret = RGB(40, 40, 46), UltraSecret = RGB(255, 255, 255),
}

function Sim.new(class: string, props: any, parent: Instance?)
	local o = Instance.new(class)
	for k, v in props or {} do (o :: any)[k] = v end
	if parent then o.Parent = parent end
	return o
end
local new = Sim.new

function Sim.corner(parent, r) return new("UICorner", { CornerRadius = UDim.new(0, r or 4) }, parent) end
function Sim.stroke(parent, th, color, transparency)
	return new("UIStroke", { Thickness = th or 3, Color = color or BLACK, Transparency = transparency or 0,
		ApplyStrokeMode = Enum.ApplyStrokeMode.Border, LineJoinMode = Enum.LineJoinMode.Round }, parent)
end
function Sim.gradient(parent, pair, rot)
	local seq = if typeof(pair) == "ColorSequence" then pair else ColorSequence.new(pair[1], pair[2])
	return new("UIGradient", { Color = seq, Rotation = rot or 90 }, parent)
end

-- Studs drawn with GUI objects (no image asset needed, always visible):
-- each stud is a rounded-square ring whose outline goes light (top-left) -> dark
-- (bottom-right), like the moulded studs of the reference menus.
-- light = studs on coloured surfaces, dark = studs on the dark grey bodies.
local MAX_STUDS = 360
local function rootScale(obj: Instance): number
	local p = obj
	while p do
		local sc = p:FindFirstChild("WindowScale")
		if sc and sc:IsA("UIScale") then return sc.Scale end
		p = p.Parent
	end
	return 1
end

function Sim.studs(parent: GuiObject, opts)
	opts = opts or {}
	local cfg = require(ReplicatedStorage.Shared.Config.GameConfig).UI
	local dark = opts.dark == true
	-- 1) real tiled texture (exact reference look, one instance)
	if cfg.StudImage ~= "" then
		local pitch = cfg.StudPitch * (if opts.big then 1.3 else 1)
		return new("ImageLabel", {
			Name = "Studs", BackgroundTransparency = 1, Image = cfg.StudImage, ScaleType = Enum.ScaleType.Tile,
			TileSize = UDim2.fromOffset(pitch, pitch), ImageTransparency = if dark then 0.4 else 0.55, -- subtle
			Size = UDim2.new(1, -4, 1, -4), Position = UDim2.fromOffset(2, 2), ZIndex = opts.z or parent.ZIndex,
		}, parent)
	end
	-- 2) fallback: carved rounded squares drawn with frames (shadow bottom-left, light top-right)
	local layer = new("Frame", {
		Name = "Studs", BackgroundTransparency = 1, Size = UDim2.new(1, -6, 1, -6), Position = UDim2.fromOffset(3, 3),
		ClipsDescendants = true, ZIndex = opts.z or parent.ZIndex,
	}, parent)
	local grid = new("UIGridLayout", { SortOrder = Enum.SortOrder.LayoutOrder, HorizontalAlignment = Enum.HorizontalAlignment.Center,
		VerticalAlignment = Enum.VerticalAlignment.Center }, layer)
	local count = 0
	local function fill()
		local k = math.max(rootScale(layer), 0.05)
		local w, h = layer.AbsoluteSize.X / k, layer.AbsoluteSize.Y / k
		if w < 4 or h < 4 then return end
		local t = cfg.StudPitch * (if opts.big then 1.3 else 1)
		while math.ceil(w / t) * math.ceil(h / t) > MAX_STUDS do t *= 1.08 end
		local need = math.ceil(w / t) * math.ceil(h / t)
		grid.CellSize = UDim2.fromOffset(t * 0.62, t * 0.62)
		grid.CellPadding = UDim2.fromOffset(t * 0.38, t * 0.38)
		if need == count then return end
		for _, c in layer:GetChildren() do
			if c:IsA("Frame") then c:Destroy() end
		end
		for _ = 1, need do
			local stud = new("Frame", { BackgroundColor3 = BLACK, BackgroundTransparency = 0.96, BorderSizePixel = 0, ZIndex = layer.ZIndex }, layer)
			new("UICorner", { CornerRadius = UDim.new(0.22, 0) }, stud)
			local st = new("UIStroke", { Thickness = 1.4, Color = WHITE, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, stud)
			new("UIGradient", { Rotation = -45,
				Color = ColorSequence.new(RGB(255, 255, 255), RGB(0, 0, 0)),
				Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, if dark then 0.88 else 0.8),
					NumberSequenceKeypoint.new(0.45, 1), NumberSequenceKeypoint.new(1, if dark then 0.5 else 0.75) }) }, st)
		end
		count = need
	end
	layer:GetPropertyChangedSignal("AbsoluteSize"):Connect(fill)
	task.defer(fill)
	return layer
end

-- outlined white text (FredokaOne, black outline)
function Sim.text(parent, text, p)
	p = p or {}
	local t = new("TextLabel", {
		Name = p.Name or "Label", BackgroundTransparency = 1, Font = p.Font or Sim.FONT, Text = text or "", RichText = p.Rich == true,
		TextColor3 = p.Color or WHITE, TextScaled = true, Size = p.Size or UDim2.fromScale(1, 1),
		Position = p.Position or UDim2.fromScale(0.5, 0.5), AnchorPoint = p.AnchorPoint or Vector2.new(0.5, 0.5),
		TextXAlignment = p.AlignX or Enum.TextXAlignment.Center, TextYAlignment = p.AlignY or Enum.TextYAlignment.Center,
		ZIndex = p.ZIndex or 5, Rotation = p.Rotation or 0, TextWrapped = p.Wrap == true, LayoutOrder = p.LayoutOrder or 0,
	}, parent)
	new("UITextSizeConstraint", { MaxTextSize = p.Max or 30, MinTextSize = 6 }, t)
	new("UIStroke", { Thickness = p.Stroke or 3, Color = p.StrokeColor or BLACK, LineJoinMode = Enum.LineJoinMode.Round }, t)
	if p.Gradient then Sim.gradient(t, p.Gradient, 90) end
	return t
end

-- "-- Title --" section header (orange/yellow gradient text)
function Sim.section(parent, text, p)
	p = p or {}
	return Sim.text(parent, "-- " .. text .. " --", { Size = p.Size or UDim2.fromOffset(600, 44), Position = p.Position or UDim2.new(0.5, 0, 0, 26),
		Max = p.Max or 40, Stroke = 3.5, Gradient = { RGB(255, 232, 60), RGB(255, 140, 0) }, ZIndex = p.ZIndex or 6, LayoutOrder = p.LayoutOrder })
end

-- coloured studded block with black outline
function Sim.panel(parent, p)
	local f = new("Frame", {
		Name = p.Name or "Panel", BackgroundColor3 = WHITE, BorderSizePixel = 0, Size = p.Size, Position = p.Position or UDim2.new(),
		AnchorPoint = p.AnchorPoint or Vector2.zero, ZIndex = p.ZIndex or 2, LayoutOrder = p.LayoutOrder or 0,
		BackgroundTransparency = p.Transparency or 0, ClipsDescendants = p.Clip == true,
	}, parent)
	if p.Color then f.BackgroundColor3 = p.Color else Sim.gradient(f, p.Gradient or Sim.G.light, p.Rotation or 90) end
	Sim.corner(f, p.Corner or 4)
	Sim.stroke(f, p.Stroke or 3, p.StrokeColor)
	if p.Studs ~= false then Sim.studs(f, { dark = p.DarkStuds, tile = p.Tile, transparency = p.StudTransparency, z = f.ZIndex }) end
	return f
end

-- diagonal light bands (header / big buttons)
function Sim.bands(parent: GuiObject, x: number, z: number?)
	for i, w in { 30, 12, 22 } do
		new("Frame", { Name = "Band", BackgroundColor3 = WHITE, BackgroundTransparency = 0.78, BorderSizePixel = 0,
			Size = UDim2.new(0, w, 3, 0), Position = UDim2.new(x + (i - 1) * 0.045, 0, -1, 0), Rotation = 28, ZIndex = z or parent.ZIndex }, parent)
	end
end

--[[ Button: gradient + studs + black outline + top gloss, outlined label, optional icon.
	p: Size (Vector2), Position, AnchorPoint, Grad (name or pair), Text, Max, Icon (image id), IconSize, ZIndex, LayoutOrder ]]
function Sim.button(parent, p, onClick)
	local size = p.Size or Vector2.new(180, 56)
	local b = new("ImageButton", {
		Name = p.Name or "Button", AutoButtonColor = false, Image = "", BackgroundColor3 = WHITE, BorderSizePixel = 0,
		Size = UDim2.fromOffset(size.X, size.Y), Position = p.Position or UDim2.new(), AnchorPoint = p.AnchorPoint or Vector2.new(0.5, 0.5),
		ZIndex = p.ZIndex or 3, LayoutOrder = p.LayoutOrder or 0, ClipsDescendants = false,
	}, parent)
	local grad = if type(p.Grad) == "string" then Sim.G[p.Grad] else (p.Grad or Sim.G.green)
	b:SetAttribute("Grad", if type(p.Grad) == "string" then p.Grad else "custom")
	Sim.gradient(b, grad, 90).Name = "Fill"
	Sim.corner(b, p.Corner or 4)
	Sim.stroke(b, p.Stroke or 3)
	-- inner clip holding studs + gloss + bands
	local face = new("Frame", { Name = "Face", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ClipsDescendants = true, ZIndex = b.ZIndex }, b)
	Sim.corner(face, p.Corner or 4)
	Sim.studs(face, { tile = p.Tile or 26, z = b.ZIndex })
	local gloss = new("Frame", { Name = "Gloss", BackgroundColor3 = WHITE, BackgroundTransparency = 0.72, BorderSizePixel = 0,
		Size = UDim2.new(1, -6, 0.34, 0), Position = UDim2.fromOffset(3, 3), ZIndex = b.ZIndex }, face)
	Sim.corner(gloss, 3)
	-- bottom shade (thickness)
	local shade = new("Frame", { Name = "Shade", BackgroundColor3 = BLACK, BackgroundTransparency = 0.78, BorderSizePixel = 0,
		Size = UDim2.new(1, 0, 0, 4), Position = UDim2.new(0, 0, 1, -4), ZIndex = b.ZIndex }, face)
	local _ = shade
	local textLeft = 0
	if p.Icon then
		local s = math.floor(size.Y * (p.IconSize or 0.92))
		new("ImageLabel", { Name = "Icon", BackgroundTransparency = 1, Image = p.Icon, ScaleType = Enum.ScaleType.Fit, Size = UDim2.fromOffset(s, s),
			Position = UDim2.new(0, math.floor(size.Y * 0.5), 0.5, 0), AnchorPoint = Vector2.new(0.5, 0.5), Rotation = p.IconRotation or -6, ZIndex = b.ZIndex + 2 }, b)
		textLeft = math.floor(size.Y * 0.92)
	end
	if p.Text then
		Sim.text(b, p.Text, { Name = "Label", Size = UDim2.new(1, -textLeft - 12, 0.72, 0), Position = UDim2.new(0, textLeft + (size.X - textLeft) / 2, 0.5, -1),
			Max = p.Max or 30, Stroke = p.TextStroke or 3, ZIndex = b.ZIndex + 3, Rich = p.Rich })
	end
	new("UIScale", { Name = "ButtonScale" }, b)
	Motion.BindButton(b, p.Hover or 1.05, Sim.sounds, onClick)
	return b
end

function Sim.setText(b: Instance, text: string)
	local l = b:FindFirstChild("Label")
	if l then l.Text = text end
end

function Sim.recolor(b: Instance, grad)
	local g = b:FindFirstChild("Fill")
	local pair = if type(grad) == "string" then Sim.G[grad] else grad
	if g and pair then g.Color = ColorSequence.new(pair[1], pair[2]) end
end

function Sim.disable(b: GuiObject, off: boolean)
	b:SetAttribute("Disabled", off)
	local g = b:FindFirstChild("Fill")
	if g then
		if off then
			g:SetAttribute("Orig", g:GetAttribute("Orig") or b:GetAttribute("Grad"))
			g.Color = ColorSequence.new(Sim.G.grey[1], Sim.G.grey[2])
		end
	end
end

-- red notification badge "!" (pulses)
function Sim.badge(parent: GuiObject)
	local f = new("Frame", { Name = "Badge", BackgroundColor3 = RGB(230, 20, 30), Size = UDim2.fromOffset(28, 28), Position = UDim2.new(1, -2, 0, 2),
		AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = parent.ZIndex + 8, Visible = false }, parent)
	new("UICorner", { CornerRadius = UDim.new(1, 0) }, f)
	Sim.stroke(f, 2.5, WHITE)
	Sim.text(f, "!", { Size = UDim2.fromScale(0.8, 0.8), Max = 22, Stroke = 2, ZIndex = f.ZIndex + 1 })
	local sc = new("UIScale", { Name = "Pulse" }, f)
	Motion.PulseScale(sc, 0.1, 4)
	return f
end

-- dark translucent info bar (the "15 Puissance" bar of the cards)
function Sim.infoBar(parent, text, p)
	p = p or {}
	local f = new("Frame", { Name = p.Name or "Info", BackgroundColor3 = RGB(40, 40, 44), BackgroundTransparency = 0.2, BorderSizePixel = 0,
		Size = p.Size, Position = p.Position, AnchorPoint = p.AnchorPoint or Vector2.new(0.5, 0.5), ZIndex = p.ZIndex or 4 }, parent)
	Sim.corner(f, 3)
	Sim.stroke(f, 2.5, RGB(20, 20, 22))
	Sim.studs(f, { dark = true, tile = 20, transparency = 0.6, z = f.ZIndex })
	Sim.text(f, text, { Name = "Text", Size = UDim2.new(1, -10, 0.78, 0), Max = p.Max or 24, Rich = true, ZIndex = f.ZIndex + 1 })
	return f
end

-- a real 3D model shown inside a GUI element
function Sim.model(parent: GuiObject, opts)
	opts.size = opts.size or UDim2.fromScale(0.85, 0.85)
	opts.position = opts.position or UDim2.fromScale(0.5, 0.5)
	opts.zindex = opts.zindex or (parent.ZIndex + 2)
	return Viewport.create(parent, opts)
end

-- responsive root
function Sim.root(parent, name, size: Vector2, position: UDim2, anchor: Vector2, factor: number?)
	local f = new("Frame", { Name = name, BackgroundTransparency = 1, Size = UDim2.fromOffset(size.X, size.Y), Position = position, AnchorPoint = anchor }, parent)
	local sc = new("UIScale", { Name = "WindowScale" }, f)
	Motion.BindResponsive(sc, factor or 1)
	return f
end

--[[ Window like the references. Returns { gui, frame, header, body, menu, W, H, HH }.
	opts: name, title, grad, size (Vector2), headerHeight ]]
function Sim.window(opts)
	local player = Players.LocalPlayer
	local W, H = opts.size.X, opts.size.Y
	local HH = opts.headerHeight or 74
	local gui = new("ScreenGui", { Name = "Menu" .. opts.name, ResetOnSpawn = false, DisplayOrder = 11, IgnoreGuiInset = true,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling, ScreenInsets = Enum.ScreenInsets.DeviceSafeInsets }, player:WaitForChild("PlayerGui"))
	new("Folder", { Name = "Sons" }, gui)
	new("BindableEvent", { Name = "Basculer" }, gui)
	local frame = new("Frame", { Name = "Fenetre", BackgroundColor3 = RGB(28, 28, 32), BorderSizePixel = 0, Size = UDim2.fromOffset(W, H),
		Position = UDim2.fromScale(0.5, 0.52), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 1 }, gui)
	Sim.corner(frame, 4)
	Sim.stroke(frame, 5, RGB(18, 18, 20))
	new("UIScale", { Name = "WindowScale" }, frame)
	-- header
	local header = new("Frame", { Name = "Entete", BackgroundColor3 = WHITE, BorderSizePixel = 0, Size = UDim2.fromOffset(W - 8, HH),
		Position = UDim2.fromOffset(4, 4), ZIndex = 4, ClipsDescendants = true }, frame)
	Sim.gradient(header, Sim.G[opts.grad or "blue"], 90)
	Sim.corner(header, 3)
	Sim.studs(header, { tile = 26, transparency = 0.8, z = 4 })
	Sim.bands(header, 0.58, 4)
	new("Frame", { Name = "Shade", BackgroundColor3 = BLACK, BackgroundTransparency = 0.75, BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 5),
		Position = UDim2.new(0, 0, 1, -5), ZIndex = 5 }, header)
	local titleRoot = new("Frame", { Name = "TitleRoot", BackgroundTransparency = 1, Size = UDim2.fromOffset(W - 8, HH), Position = UDim2.fromOffset(4, 4), ZIndex = 6 }, frame)
	Sim.text(titleRoot, opts.title, { Name = "Title", Size = UDim2.fromOffset(opts.titleWidth or (W * 0.62), HH * 0.66), Position = UDim2.fromOffset(24, HH / 2),
		AnchorPoint = Vector2.new(0, 0.5), AlignX = Enum.TextXAlignment.Left, Max = 52, Stroke = 4, ZIndex = 8 })
	local close = Sim.button(titleRoot, { Name = "Fermer", Grad = "red", Size = Vector2.new(HH - 12, HH - 12), Position = UDim2.new(1, -(HH - 12) / 2 - 8, 0.5, 0),
		Text = "X", Max = 48, ZIndex = 9, Hover = 1.08 })
	-- body
	local body = new("Frame", { Name = "Corps", BackgroundColor3 = RGB(52, 52, 56), BorderSizePixel = 0, Size = UDim2.fromOffset(W - 8, H - HH - 12),
		Position = UDim2.fromOffset(4, HH + 8), ZIndex = 2, ClipsDescendants = false }, frame)
	Sim.corner(body, 3)
	Sim.stroke(body, 2, RGB(20, 20, 22))
	Sim.studs(body, { dark = true, tile = 30, transparency = 0.45, z = 2 })
	local content = new("Frame", { Name = "Content", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 3 }, body)
	local menu = Motion.Window(gui, frame, { Keep = { Overlay = true, ReturnHUD = true }, OnOpen = opts.onOpen })
	-- Motion.Window binds the close button it finds named "Fermer" (ours) and plays the sounds
	local _ = close
	return { gui = gui, frame = frame, header = header, titleRoot = titleRoot, body = body, content = content, menu = menu, W = W, H = H, HH = HH }
end

--[[ Item card (pickaxe-shop style): rarity gradient, studs, title top, rarity line, centre area
	for a 3D model, dark stat bar, big button. Returns card, centre frame. ]]
function Sim.card(parent, p)
	local size = p.Size or Vector2.new(250, 320)
	local card = Sim.panel(parent, { Name = p.Name or "Card", Size = UDim2.fromOffset(size.X, size.Y), Gradient = Sim.RARITY_CARD[p.Rarity or "Common"] or Sim.RARITY_CARD.Common,
		LayoutOrder = p.LayoutOrder or 0, ZIndex = 3, Stroke = 3, Tile = 34 })
	card.ClipsDescendants = false
	-- inner white rim like the reference cards
	Sim.stroke(new("Frame", { Name = "Rim", BackgroundTransparency = 1, Size = UDim2.new(1, -8, 1, -8), Position = UDim2.fromOffset(4, 4), ZIndex = 3 }, card), 2, WHITE, 0.4)
	Sim.text(card, p.Title or "", { Name = "Title", Size = UDim2.new(1, 0, 0, 44), Position = UDim2.new(0.5, 0, 0, 26), Max = 36, Stroke = 3.5, ZIndex = 8 })
	if p.RarityText then
		Sim.text(card, p.RarityText, { Name = "Rarity", Size = UDim2.new(1, -20, 0, 28), Position = UDim2.new(0.5, 0, 0, 58), Max = 26, Stroke = 3,
			Color = Sim.RARITY_TEXT[p.Rarity or "Common"] or WHITE, ZIndex = 8 })
	end
	local centre = new("Frame", { Name = "Centre", BackgroundTransparency = 1, Size = UDim2.new(1, -10, 1, -(p.CenterCut or 170)),
		Position = UDim2.fromOffset(5, p.CenterTop or 70), ZIndex = 4 }, card)
	return card, centre
end

return Sim
