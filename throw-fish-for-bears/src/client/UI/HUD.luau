--[[ HUD in the reference simulator style (UI/Sim): same layout as the screenshots.
       top centre  : title + "Lucky Lake" timer
       left middle : Shop (green) / Index (blue) with badges + Low FX switch
       right middle: square tiles (Gifts / Daily / Bears) + red ">" tab -> bears panel
       bottom left : strength (red) + money (green, +$/s)
       bottom mid  : dark green hotbar slots with 3D models, Bag / Store buttons
       bottom right: speed + contextual action button; throw meter; reel mini-game ]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local E = require(Shared.Config.EconomyConfig)
local FishConfig = require(Shared.Config.FishConfig)
local BearConfig = require(Shared.Config.BearConfig)
local RodConfig = require(Shared.Config.RodConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local Sim = require(script.Parent.Sim)
local K = require(script.Parent.Kit)
local Data = require(script.Parent.Parent.Controllers.Data)
local Actions = require(script.Parent.Parent.Controllers.Actions)
local Sound = require(script.Parent.Parent.Controllers.Sound)
local Fx = require(script.Parent.Parent.Controllers.Fx)

local Motion = Sim.Motion
local new = Sim.new
local HUD = {}
local player = Players.LocalPlayer
local RGB = Color3.fromRGB
HUD.menus = nil

local gui: ScreenGui
local refs = {}

local function tween(o, t, goal, style, dir)
	local tw = TweenService:Create(o, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), goal)
	tw:Play()
	return tw
end

------------------------------------------------------------------------------------------
local function buildTitle()
	local root = Sim.root(gui, "Title", Vector2.new(520, 110), UDim2.new(0.5, 0, 0, 2), Vector2.new(0.5, 0), 0.85)
	refs.title = Sim.text(root, '<font color="#3CA0FF">THROW</font> <font color="#52F05A">FISH</font> <font color="#FFD23C">FOR</font> <font color="#FF6EC8">BEARS</font>',
		{ Rich = true, Size = UDim2.fromOffset(520, 56), Position = UDim2.new(0.5, 0, 0, 32), Max = 52, Stroke = 4, ZIndex = 3 })
	refs.timer = Sim.infoBar(root, "", { Size = UDim2.fromOffset(330, 34), Position = UDim2.new(0.5, 0, 0, 84), Max = 22, ZIndex = 3 })
end

local function buildLeft()
	local root = Sim.root(gui, "Left", Vector2.new(260, 220), UDim2.new(0, 14, 0.45, 0), Vector2.new(0, 0.5))
	local shop = Sim.button(root, { Name = "Shop", Grad = "green", Size = Vector2.new(200, 62), Position = UDim2.fromOffset(102, 34), Text = "Shop", Max = 34,
		Icon = K.Icons.Shop }, function() HUD.menus.open("Shop") end)
	local index = Sim.button(root, { Name = "Index", Grad = "blue", Size = Vector2.new(200, 62), Position = UDim2.fromOffset(102, 108), Text = "Index", Max = 34,
		Icon = K.Icons.Index }, function() HUD.menus.open("Index") end)
	refs.shopBadge = Sim.badge(shop)
	refs.indexBadge = Sim.badge(index)
	K.shine(shop:FindFirstChild("Face"), 4)
	-- Low FX switch (like "Mode lent")
	local sw = new("ImageButton", { Name = "LowFx", AutoButtonColor = false, Image = "", BackgroundColor3 = RGB(54, 54, 60), Size = UDim2.fromOffset(92, 44),
		Position = UDim2.fromOffset(4, 160), BorderSizePixel = 0, ZIndex = 3 }, root)
	Sim.corner(sw, 4)
	Sim.stroke(sw, 3)
	Sim.studs(sw, { dark = true, tile = 20, z = 3 })
	local knob = new("Frame", { Name = "Knob", BackgroundColor3 = Color3.new(1, 1, 1), Size = UDim2.fromOffset(38, 36), Position = UDim2.fromOffset(4, 4), ZIndex = 4 }, sw)
	local knobGrad = Sim.gradient(knob, Sim.G.red, 90)
	Sim.corner(knob, 3)
	Sim.stroke(knob, 2.5)
	Sim.studs(knob, { tile = 18, z = 4 })
	Sim.text(root, "Low FX", { Size = UDim2.fromOffset(140, 32), Position = UDim2.fromOffset(106, 182), AnchorPoint = Vector2.new(0, 0.5),
		AlignX = Enum.TextXAlignment.Left, Max = 28, ZIndex = 3 })
	new("UIScale", { Name = "ButtonScale" }, sw)
	local function render()
		local on = Data.values.settings and Data.values.settings.lowFx == true
		Fx.low = on
		tween(knob, 0.22, { Position = UDim2.fromOffset(if on then 50 else 4, 4) }, Enum.EasingStyle.Back)
		local pair = if on then Sim.G.green else Sim.G.red
		knobGrad.Color = ColorSequence.new(pair[1], pair[2])
	end
	Motion.BindButton(sw, 1.05, Sim.sounds, function()
		local on = not (Data.values.settings and Data.values.settings.lowFx)
		Data.values.settings = Data.values.settings or {}
		Data.values.settings.lowFx = on
		render()
		Net.event("SetSetting"):FireServer("lowFx", on)
	end)
	refs.renderLowFx = render
end

local function buildRight()
	local root = Sim.root(gui, "Right", Vector2.new(492, 340), UDim2.new(1, -12, 0.45, 0), Vector2.new(1, 0.5))
	local tiles = new("Frame", { Name = "Tiles", BackgroundTransparency = 1, Size = UDim2.fromOffset(100, 330), Position = UDim2.fromOffset(390, 5) }, root)
	local function tile(name, grad, icon, y, open)
		local b = Sim.button(tiles, { Name = name, Grad = grad, Size = Vector2.new(84, 84), Position = UDim2.fromOffset(50, y), Hover = 1.07 },
			function()
				if open == "Bears" then
					if refs.togglePanel then refs.togglePanel() end -- small "X/13 Active" panel
				elseif open == "Fish" then
					if HUD.menus and HUD.menus.openInventory then HUD.menus.openInventory("Fish") end
				else
					HUD.menus.open(open)
				end
			end)
		new("ImageLabel", { Name = "Icon", BackgroundTransparency = 1, Image = icon, ScaleType = Enum.ScaleType.Fit, Size = UDim2.fromOffset(70, 70),
			Position = UDim2.fromScale(0.5, 0.45), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 7 }, b)
		Sim.text(b, name, { Size = UDim2.new(1, 4, 0, 24), Position = UDim2.new(0.5, 0, 1, -12), Max = 22, ZIndex = 9 })
		return b, Sim.badge(b)
	end
	-- (Gifts + Daily removed) the FISH inventory sits where Daily was, Bears under it
	tile("Fish", "blue", K.Icons.Bait, 164, "Fish")
	tile("Bears", "teal", K.Icons.Paw, 272, "Bears")

	local tab = Sim.button(root, { Name = "PanelTab", Grad = "red", Size = Vector2.new(46, 64), Position = UDim2.fromOffset(34, 164), Text = "<", Max = 40 })
	tab.Visible = false -- the red arrow only exists while the Bears panel is open
	-- MY BEARS panel: a forest-green studded board, teal header, rarity-coloured bear rows
	local panel = new("Frame", { Name = "BearsPanel", BackgroundColor3 = Color3.new(1, 1, 1), Size = UDim2.fromOffset(420, 334),
		Position = UDim2.fromOffset(66, 3), Visible = false, ZIndex = 3 }, root)
	Sim.gradient(panel, { RGB(46, 128, 96), RGB(16, 54, 44) }, 90)
	Sim.corner(panel, 6)
	Sim.stroke(panel, 4)
	Sim.studs(panel, { dark = true, tile = 26, z = 3 })
	local rim = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, -8, 1, -8), Position = UDim2.fromOffset(4, 4), ZIndex = 3 }, panel)
	Sim.corner(rim, 4)
	Sim.stroke(rim, 2, Color3.new(1, 1, 1), 0.6)
	local head = Sim.panel(panel, { Size = UDim2.fromOffset(408, 58), Position = UDim2.fromOffset(6, 6), Gradient = Sim.G.teal, ZIndex = 4 })
	Sim.bands(head, 0.42, 4)
	head.ClipsDescendants = true
	new("ImageLabel", { BackgroundTransparency = 1, Image = K.Icons.Paw, ScaleType = Enum.ScaleType.Fit, Size = UDim2.fromOffset(44, 44),
		Position = UDim2.fromOffset(28, 29), AnchorPoint = Vector2.new(0.5, 0.5), Rotation = -10, ZIndex = 6 }, head)
	Sim.text(head, "MY BEARS", { Size = UDim2.fromOffset(140, 26), Position = UDim2.fromOffset(54, 19), AnchorPoint = Vector2.new(0, 0.5),
		AlignX = Enum.TextXAlignment.Left, Max = 26, Stroke = 3.5, Gradient = { RGB(255, 255, 255), RGB(255, 226, 110) }, ZIndex = 6 })
	refs.panelTitle = Sim.text(head, "0/5 Active", { Size = UDim2.fromOffset(130, 18), Position = UDim2.fromOffset(55, 42), AnchorPoint = Vector2.new(0, 0.5),
		AlignX = Enum.TextXAlignment.Left, Max = 17, Stroke = 2.5, ZIndex = 6 })
	refs.slotButton = Sim.button(head, { Name = "Slot", Grad = "green", Size = Vector2.new(116, 38), Position = UDim2.fromOffset(250, 29), Text = "+1 Slot", Max = 17, ZIndex = 6 },
		function() Net.event("UpgradeCapacity"):FireServer() end)
	-- top right: put your best bears in the base in one click
	Sim.button(head, { Name = "EquipBest", Grad = "yellow", Size = Vector2.new(92, 38), Position = UDim2.fromOffset(357, 29), Text = "Equip Best", Max = 15, ZIndex = 6 },
		function() Net.event("EquipBest"):FireServer() end)
	local list = new("ScrollingFrame", { BackgroundTransparency = 1, BorderSizePixel = 0, Size = UDim2.fromOffset(410, 226), Position = UDim2.fromOffset(6, 70),
		CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 6, ScrollBarImageColor3 = RGB(230, 240, 230), ZIndex = 4 }, panel)
	new("UIListLayout", { Padding = UDim.new(0, 7), SortOrder = Enum.SortOrder.LayoutOrder }, list)
	new("UIPadding", { PaddingTop = UDim.new(0, 2), PaddingLeft = UDim.new(0, 2), PaddingBottom = UDim.new(0, 4) }, list)
	-- footer: total income of the active bears
	refs.panelIncome = Sim.infoBar(panel, "", { Size = UDim2.fromOffset(300, 28), Position = UDim2.fromOffset(210, 314), Max = 18, ZIndex = 5 })
	refs.panelList = list
	local function toggle()
		local open = not panel.Visible
		panel.Visible = open
		tiles.Visible = not open
		tab.Visible = open
		if open then
			local sc = panel:FindFirstChild("PopScale") or new("UIScale", { Name = "PopScale" }, panel)
			sc.Scale = 0.75
			tween(sc, 0.32, { Scale = 1 }, Enum.EasingStyle.Back)
			HUD.renderPanel()
		end
	end
	tab.Activated:Connect(toggle)
	refs.togglePanel = toggle
	refs.panel = panel
end

function HUD.renderPanel()
	local list = refs.panelList
	if not list or not refs.panel.Visible then return end
	for _, c in list:GetChildren() do
		if c:IsA("GuiObject") then c:Destroy() end
	end
	local bears = {}
	for _, b in Data.values.bears or {} do
		if b.placed then table.insert(bears, b) end
	end
	table.sort(bears, function(a, b) return Formulas.bearIncome(a) > Formulas.bearIncome(b) end)
	local total = 0
	for i, b in bears do
		local inc = Formulas.bearIncome(b)
		total += inc
		local spec = BearConfig.get(b.s)
		local row = Sim.panel(list, { Name = "Row" .. i, Size = UDim2.fromOffset(392, 72), Gradient = Sim.RARITY_CARD[b.r] or Sim.RARITY_CARD.Common,
			LayoutOrder = i, ZIndex = 5, Tile = 24 })
		-- portrait: a dark studded frame with the live 3D bear, the rarity colour as its border
		local pic = Sim.panel(row, { Size = UDim2.fromOffset(62, 62), Position = UDim2.fromOffset(5, 5), Color = RGB(30, 34, 40), DarkStuds = true, Stroke = 3,
			StrokeColor = Sim.RARITY_TEXT[b.r], ZIndex = 6 })
		pic.ClipsDescendants = true
		Sim.model(pic, { kind = "Bear", id = b.s, variant = b.v, size = UDim2.fromScale(1.25, 1.25), position = UDim2.fromScale(0.5, 0.56) })
		if b.v and b.v ~= "Normal" then
			local vc = (RarityConfig.Variants[b.v] or {}).color or Color3.new(1, 1, 1)
			local pill = new("Frame", { BackgroundColor3 = vc, Size = UDim2.fromOffset(58, 16), Position = UDim2.fromOffset(36, 66), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 9 }, row)
			Sim.corner(pill, 8)
			Sim.stroke(pill, 2)
			Sim.text(pill, b.v:upper(), { Size = UDim2.new(1, -6, 0.9, 0), Max = 11, Stroke = 1.5, ZIndex = 10 })
		end
		Sim.text(row, spec.name, { Size = UDim2.fromOffset(200, 24), Position = UDim2.fromOffset(76, 18), AnchorPoint = Vector2.new(0, 0.5),
			AlignX = Enum.TextXAlignment.Left, Max = 21, Stroke = 3, ZIndex = 8 })
		Sim.text(row, RarityConfig.get(b.r).name:upper(), { Size = UDim2.fromOffset(120, 15), Position = UDim2.fromOffset(77, 36), AnchorPoint = Vector2.new(0, 0.5),
			AlignX = Enum.TextXAlignment.Left, Max = 13, Stroke = 2, Color = Sim.RARITY_TEXT[b.r] or Color3.new(1, 1, 1), ZIndex = 8 })
		Sim.infoBar(row, ('<font color="#7CFF46">%s</font>  ·  %s'):format(Format.perSec(inc), Format.kg(b.w)),
			{ Size = UDim2.fromOffset(176, 24), Position = UDim2.fromOffset(76, 56), AnchorPoint = Vector2.new(0, 0.5), Max = 16, ZIndex = 7 })
		Sim.button(row, { Name = "Unequip", Grad = "orange", Size = Vector2.new(112, 42), Position = UDim2.fromOffset(326, 36), Text = "Unequip", Max = 19, ZIndex = 7 },
			function() Net.event("UnequipBear"):FireServer(b.id) end)
	end
	if refs.panelIncome then
		local tl = refs.panelIncome:FindFirstChild("Text")
		if tl then tl.Text = ('Total  <font color="#7CFF46">%s</font>'):format(Format.perSec(total)) end
	end
	if #bears == 0 then
		Sim.text(list, "No bear in your base yet!", { Size = UDim2.fromOffset(392, 60), Max = 22, ZIndex = 6 })
	end
	K.cascade(list, 0.03)
end

------------------------------------------------------------------------------------------
local function buildStats()
	local root = Sim.root(gui, "Stats", Vector2.new(440, 130), UDim2.new(0, 10, 1, -6), Vector2.new(0, 1))
	-- flexed arm emoji for strength
	new("TextLabel", { BackgroundTransparency = 1, Text = "💪", TextScaled = true, Font = Enum.Font.FredokaOne, Size = UDim2.fromOffset(48, 48),
		Position = UDim2.fromOffset(26, 26), AnchorPoint = Vector2.new(0.5, 0.5), Rotation = -8, ZIndex = 3 }, root)
	refs.strength = Sim.text(root, "", { Size = UDim2.fromOffset(380, 42), Position = UDim2.fromOffset(54, 24), AnchorPoint = Vector2.new(0, 0.5),
		AlignX = Enum.TextXAlignment.Left, Max = 40, Stroke = 3.5, Gradient = { RGB(255, 140, 120), RGB(230, 30, 40) }, ZIndex = 3 })
	new("ImageLabel", { BackgroundTransparency = 1, Image = K.Icons.Cash, ScaleType = Enum.ScaleType.Fit, Size = UDim2.fromOffset(54, 54),
		Position = UDim2.fromOffset(28, 98), AnchorPoint = Vector2.new(0.5, 0.5), Rotation = -8, ZIndex = 3 }, root)
	local mh = new("Frame", { Name = "Money", BackgroundTransparency = 1, Size = UDim2.fromOffset(240, 54), Position = UDim2.fromOffset(58, 72) }, root)
	refs.money = Sim.text(mh, "$0", { Size = UDim2.fromScale(1, 1), Position = UDim2.fromScale(0, 0.5), AnchorPoint = Vector2.new(0, 0.5),
		AlignX = Enum.TextXAlignment.Left, Max = 50, Stroke = 4, Gradient = { RGB(200, 255, 80), RGB(60, 220, 30) }, ZIndex = 3 })
	refs.moneyScale = new("UIScale", {}, mh)
	refs.income = Sim.text(root, "", { Size = UDim2.fromOffset(160, 36), Position = UDim2.fromOffset(268, 102), AnchorPoint = Vector2.new(0, 0.5),
		AlignX = Enum.TextXAlignment.Left, Max = 32, Stroke = 3.5, Gradient = { RGB(200, 255, 80), RGB(60, 220, 30) }, ZIndex = 3 })
end

------------------------------------------------------------------------------------------
local slots = {}
local iconKeys = {}
local function slot(parent, i)
	local b = new("ImageButton", { Name = "Slot" .. i, AutoButtonColor = false, Image = "", BackgroundColor3 = RGB(40, 90, 36), BackgroundTransparency = 0.2,
		Size = UDim2.fromOffset(88, 88), LayoutOrder = i, ZIndex = 3 }, parent)
	Sim.corner(b, 6)
	local st = Sim.stroke(b, 3, RGB(18, 40, 16))
	Sim.studs(b, { dark = true, tile = 22, transparency = 0.6, z = 3 })
	local icon = new("Frame", { Name = "Icon", BackgroundTransparency = 1, Size = UDim2.new(1, -8, 1, -24), Position = UDim2.fromOffset(4, 4), ZIndex = 4 }, b)
	local label = Sim.text(b, "", { Size = UDim2.new(1, -6, 0, 20), Position = UDim2.new(0.5, 0, 1, -12), Max = 17, Stroke = 2.5, ZIndex = 8 })
	Sim.text(b, tostring(i), { Size = UDim2.fromOffset(18, 18), Position = UDim2.fromOffset(12, 12), Max = 16, Stroke = 2.5, ZIndex = 8 })
	local count = Sim.text(b, "", { Size = UDim2.fromOffset(40, 18), Position = UDim2.new(1, -22, 0, 12), Max = 16, Stroke = 2.5, ZIndex = 8 })
	new("UIScale", { Name = "ButtonScale" }, b)
	slots[i] = { button = b, icon = icon, label = label, stroke = st, count = count }
	return b
end

local function buildHotbar()
	local root = Sim.root(gui, "Hotbar", Vector2.new(330, 200), UDim2.new(0.5, 0, 1, -6), Vector2.new(0.5, 1))
	local row = new("Frame", { Name = "Row", BackgroundTransparency = 1, Size = UDim2.fromOffset(330, 90), Position = UDim2.fromOffset(0, 108) }, root)
	new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Center, Padding = UDim.new(0, 10),
		SortOrder = Enum.SortOrder.LayoutOrder }, row)
	for i = 1, 3 do slot(row, i) end
	Motion.BindButton(slots[1].button, 1.06, Sim.sounds, function() Net.event("EquipSlot"):FireServer("Rod") end)
	-- slot 2: tap = hold your fish; tap again while holding = open the fish bag to pick another
	Motion.BindButton(slots[2].button, 1.06, Sim.sounds, function()
		local char = player.Character
		if char and char:GetAttribute("Holding") == "Fish" then
			HUD.menus.open("Bag")
		else
			Net.event("EquipSlot"):FireServer("Fish")
		end
	end)
	Motion.BindButton(slots[3].button, 1.06, Sim.sounds, function() HUD.menus.open("Inventory") end)
	refs.hotbarRoot = root
end

-- the tutorial points at hotbar slots
function HUD.slotButton(i: number): GuiObject?
	return slots[i] and slots[i].button
end

local function setSlotModel(i: number, key: string?, opts)
	local s = slots[i]
	if iconKeys[i] == key then return end
	iconKeys[i] = key
	for _, c in s.icon:GetChildren() do c:Destroy() end
	if key and opts then
		Sim.model(s.icon, opts)
		Motion.PopIn(s.button, 0.3)
	end
end

function HUD.renderHotbar()
	local d = Data.values
	local char = player.Character
	local holding = char and char:GetAttribute("Holding") or ""
	local isBear = char and char:GetAttribute("IsBear")
	local rodId = d.rods and d.rods.equipped or "Starter"
	setSlotModel(1, "rod:" .. rodId, { kind = "Rod", id = rodId, zoom = 0.85, size = UDim2.fromScale(1, 1) })
	slots[1].label.Text = RodConfig.get(rodId).name
	local fish = Data.fishById(d.selectedFish) or (d.fish and d.fish[1])
	slots[2].button.Visible = fish ~= nil
	if fish then
		setSlotModel(2, "fish:" .. fish.s .. (fish.v or ""), { kind = "Fish", id = fish.s, variant = fish.v, size = UDim2.fromScale(1, 1) })
		slots[2].label.Text = FishConfig.get(fish.s).name
		slots[2].count.Text = "x" .. #d.fish
	end
	local heldBear = holding == "Bear" and d.bears and d.bears[char:GetAttribute("HeldId")] or nil
	slots[3].button.Visible = heldBear ~= nil
	if heldBear then
		setSlotModel(3, "bear:" .. heldBear.s .. (heldBear.v or ""), { kind = "Bear", id = heldBear.s, variant = heldBear.v, size = UDim2.fromScale(1, 1) })
		slots[3].label.Text = BearConfig.get(heldBear.s).name
	end
	for i, s in slots do
		local active = (i == 1 and holding == "Rod") or (i == 2 and holding == "Fish") or (i == 3 and holding == "Bear")
		s.stroke.Color = if active then RGB(255, 255, 255) else RGB(18, 40, 16)
		s.stroke.Thickness = if active then 4 else 3
		s.button.BackgroundColor3 = if active then RGB(70, 150, 50) else RGB(40, 90, 36)
	end
	refs.hotbarRoot.Visible = not isBear
end

------------------------------------------------------------------------------------------
local function buildActionAndSpeed()
	local root = Sim.root(gui, "Action", Vector2.new(250, 240), UDim2.new(1, -10, 1, -6), Vector2.new(1, 1))
	new("ImageLabel", { BackgroundTransparency = 1, Image = K.Icons.Shoe, ScaleType = Enum.ScaleType.Fit, Size = UDim2.fromOffset(44, 44),
		Position = UDim2.fromOffset(150, 214), AnchorPoint = Vector2.new(0.5, 0.5), Rotation = -8, ZIndex = 3 }, root)
	refs.speed = Sim.text(root, "20", { Size = UDim2.fromOffset(80, 38), Position = UDim2.fromOffset(174, 214), AnchorPoint = Vector2.new(0, 0.5),
		AlignX = Enum.TextXAlignment.Left, Max = 36, Stroke = 3.5, Gradient = { RGB(160, 230, 255), RGB(40, 140, 255) }, ZIndex = 3 })
	-- no action button: a small hint tells what to do (tap the lake, hold to reel / throw...)
	local hintRoot = Sim.root(gui, "Hint", Vector2.new(520, 50), UDim2.new(0.5, 0, 1, -214), Vector2.new(0.5, 1))
	local hint = Sim.infoBar(hintRoot, "", { Size = UDim2.fromOffset(500, 44), Position = UDim2.fromScale(0.5, 0.5), Max = 26, ZIndex = 3 })
	hintRoot.Visible = false
	local pop = new("UIScale", {}, hint)
	Actions.ContextChanged:Connect(function(ctx)
		local c = ctx and Actions.CONTEXTS[ctx]
		if not c or not c.hint then
			hintRoot.Visible = false
			return
		end
		hint.Text.Text = c.hint
		hintRoot.Visible = false -- no on-screen action hints (removed on request)
		pop.Scale = 0.5
		tween(pop, 0.35, { Scale = 1 }, Enum.EasingStyle.Back)
		if ctx == "Hook" then Sound.play("Bite") end
	end)
	RunService.RenderStepped:Connect(function()
		if hintRoot.Visible then
			hint.Rotation = math.sin(os.clock() * 3) * 1.2
		end
	end)
end

------------------------------------------------------------------------------------------
local function buildMeter()
	local root = Sim.root(gui, "PowerMeter", Vector2.new(90, 320), UDim2.new(0.5, 190, 0.5, 0), Vector2.new(0.5, 0.5))
	root.Visible = false
	local box = new("Frame", { BackgroundColor3 = RGB(40, 40, 44), Size = UDim2.fromOffset(52, 250), Position = UDim2.fromOffset(19, 36), ClipsDescendants = true, ZIndex = 3 }, root)
	Sim.corner(box, 6)
	Sim.stroke(box, 4)
	Sim.studs(box, { dark = true, tile = 20, z = 3 })
	local fill = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 4, 1, -4),
		Size = UDim2.new(1, -8, 0, 0), ZIndex = 4 }, box)
	Sim.corner(fill, 4)
	Sim.gradient(fill, ColorSequence.new({ ColorSequenceKeypoint.new(0, RGB(255, 50, 40)), ColorSequenceKeypoint.new(0.5, RGB(255, 220, 40)), ColorSequenceKeypoint.new(1, RGB(110, 255, 60)) }), 90)
	Sim.studs(fill, { tile = 18, z = 5 })
	refs.meterText = Sim.text(root, "", { Size = UDim2.fromOffset(170, 30), Position = UDim2.new(0.5, 0, 0, 16), Max = 28, ZIndex = 6 })
	Sim.text(root, "POWER", { Size = UDim2.fromOffset(120, 26), Position = UDim2.new(0.5, 0, 1, -16), Max = 24, ZIndex = 6 })
	refs.meter = { root = root, fill = fill, pop = new("UIScale", {}, box), stroke = box:FindFirstChildOfClass("UIStroke") }
end

local wasMax = false
local lastStrength = nil
function HUD.setCharge(power: number?)
	local m = refs.meter
	if not power then
		if m.root.Visible then
			-- release: the meter bursts away and "THROW!" pops
			local box = m.pop
			tween(box, 0.18, { Scale = 1.35 }, Enum.EasingStyle.Quad)
			task.delay(0.18, function()
				m.root.Visible = false
			end)
			-- THROW! replaces MAX! (they used to stack on top of each other)
			if refs.chargePopup and refs.chargePopup.Parent then refs.chargePopup:Destroy() end
			refs.chargePopup = HUD.popup("THROW!", RGB(255, 190, 40))
		end
		wasMax = false
		return
	end
	local t = os.clock()
	if not m.root.Visible then
		m.root.Visible = true
		m.pop.Scale = 0.3
		tween(m.pop, 0.3, { Scale = 1 }, Enum.EasingStyle.Back)
		wasMax = false
	end
	m.fill.Size = UDim2.new(1, -8, power, -8 * power)
	local d = Data.values
	local fish = Data.fishById(player.Character and player.Character:GetAttribute("HeldId"))
	refs.meterText.Text = math.floor(Formulas.throwDistance(power, d.strength or 1, fish and fish.w or 1)) .. " studs"
	-- the meter breathes faster and shakes harder as power grows
	local pulse = 1 + math.sin(t * (6 + power * 18)) * 0.03 * (0.4 + power)
	m.root.Rotation = math.sin(t * (20 + power * 40)) * power * power * 3
	m.stroke.Color = RGB(0, 0, 0):Lerp(if power >= 1 then Color3.fromHSV((t * 2) % 1, 0.7, 1) else RGB(255, 210, 60), math.min(1, power * 1.2))
	m.stroke.Thickness = 4 + power * 3
	if power >= 1 then
		pulse += 0.06
		if not wasMax then
			wasMax = true
			if refs.chargePopup and refs.chargePopup.Parent then refs.chargePopup:Destroy() end
			refs.chargePopup = HUD.popup("MAX!", RGB(255, 80, 60))
		end
	end
	if m.pop.Scale > 0.95 and m.pop.Scale < 1.2 then m.pop.Scale = pulse end
end

------------------------------------------------------------------------------------------
--[[ Reel mini-game UI (stud style): a water track with the green catch zone you
     push with the screen, the hooked fish swimming inside it, a studded catch bar,
     combo counter. Rare fish glow in their rarity colour. ]]
local function buildReel()
	local root = Sim.root(gui, "Reel", Vector2.new(540, 196), UDim2.new(0.5, 0, 0.7, 0), Vector2.new(0.5, 0.5))
	root.Visible = false
	local inner = new("Frame", { Name = "Inner", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1) }, root)
	local pop = new("UIScale", {}, inner)
	local panel = Sim.panel(inner, { Size = UDim2.fromOffset(530, 186), Position = UDim2.fromOffset(5, 5), Gradient = Sim.G.blue, Stroke = 4, ZIndex = 3, Clip = true })
	Sim.bands(panel, 0.62, 4)
	local title = Sim.text(panel, "", { Size = UDim2.fromOffset(500, 34), Position = UDim2.new(0.5, 0, 0, 24), Max = 30, ZIndex = 7, Rich = true })
	-- water track
	local track = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), Size = UDim2.fromOffset(500, 62), Position = UDim2.fromOffset(15, 48), ClipsDescendants = true, ZIndex = 5 }, panel)
	Sim.gradient(track, { RGB(40, 120, 220), RGB(14, 50, 120) }, 90)
	Sim.corner(track, 5)
	local trackStroke = Sim.stroke(track, 3.5)
	Sim.studs(track, { dark = true, tile = 20, z = 5 })
	-- little waves on the water
	local waves = {}
	for i = 0, 5 do
		local wv = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.75, BorderSizePixel = 0, Size = UDim2.fromOffset(34, 4),
			Position = UDim2.fromOffset(i * 90, 10 + (i % 2) * 36), ZIndex = 5 }, track)
		Sim.corner(wv, 2)
		waves[i + 1] = wv
	end
	-- catch zone
	local zone = new("Frame", { BackgroundColor3 = RGB(110, 255, 90), BackgroundTransparency = 0.25, Size = UDim2.new(0.3, 0, 1, -8), Position = UDim2.new(0, 0, 0.5, 0),
		AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 6, BorderSizePixel = 0 }, track)
	Sim.corner(zone, 4)
	local zoneStroke = Sim.stroke(zone, 3.5, Color3.new(1, 1, 1))
	Sim.studs(zone, { tile = 18, z = 6, strong = true })
	-- fish
	local fish = Sim.text(track, "🐟", { Size = UDim2.fromOffset(46, 46), Position = UDim2.fromScale(0.5, 0.5), Max = 40, Stroke = 0, ZIndex = 9 })
	local fishGlow = new("Frame", { BackgroundColor3 = RGB(255, 220, 60), BackgroundTransparency = 1, Size = UDim2.fromOffset(52, 52), AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5), ZIndex = 8, BorderSizePixel = 0 }, track)
	Sim.corner(fishGlow, 26)
	-- catch bar
	local bar = new("Frame", { BackgroundColor3 = RGB(30, 30, 34), Size = UDim2.fromOffset(400, 26), Position = UDim2.fromOffset(15, 124), ClipsDescendants = true, ZIndex = 5 }, panel)
	Sim.corner(bar, 4)
	Sim.stroke(bar, 3)
	local fill = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, Size = UDim2.fromScale(0.3, 1), ZIndex = 6 }, bar)
	local fillGrad = Sim.gradient(fill, Sim.G.green, 90)
	Sim.studs(fill, { tile = 18, z = 6, strong = true })
	local pct = Sim.text(bar, "", { Size = UDim2.new(1, -10, 0.8, 0), Max = 18, ZIndex = 8 })
	local combo = Sim.text(panel, "", { Size = UDim2.fromOffset(100, 30), Position = UDim2.fromOffset(470, 137), Max = 26, Stroke = 3, ZIndex = 8,
		Gradient = { RGB(255, 255, 200), RGB(255, 190, 30) } })
	local comboScale = new("UIScale", {}, combo)
	Sim.text(panel, "HOLD = push right  ·  RELEASE = slide back", { Size = UDim2.fromOffset(500, 18), Position = UDim2.new(0.5, 0, 0, 170), Max = 15, Stroke = 2, Color = RGB(215, 235, 255), ZIndex = 6 })

	local ui = {}
	local rarityCol = Color3.new(1, 1, 1)
	local lastCombo = 0
	function ui.show(difficulty)
		root.Visible = true
		pop.Scale = 0.4
		tween(pop, 0.35, { Scale = 1 }, Enum.EasingStyle.Back)
		local order = RarityConfig.Order
		local tier = RarityConfig.get(order[math.clamp(difficulty, 1, #order)])
		rarityCol = tier.textColor or tier.color
		title.Text = if difficulty >= 5 then ('<font color="#%s">%s FISH!</font> Keep it in the zone!'):format(rarityCol:ToHex(), tier.name:upper())
			elseif difficulty >= 3 then "Strong fish! Keep it in the zone!" else "Keep the fish in the zone!"
		fishGlow.BackgroundColor3 = rarityCol
		fishGlow.BackgroundTransparency = if difficulty >= 3 then 0.45 else 1
		lastCombo = 0
		combo.Text = ""
	end
	function ui.hide() root.Visible = false end
	function ui.update(r)
		local t = os.clock()
		zone.Size = UDim2.new(r.zoneSize, 0, 1, -8)
		zone.Position = UDim2.new(r.zone, 0, 0.5, 0)
		local fx = r.fish
		fish.Position = UDim2.fromScale(fx, 0.5 + math.sin(t * 7) * 0.08)
		fishGlow.Position = fish.Position
		-- faces where it swims, wiggles harder when darting
		fish.Rotation = math.sin(t * (10 + r.fishSpeed * 20)) * (8 + r.fishSpeed * 30)
		fishGlow.Size = UDim2.fromOffset(48 + math.sin(t * 6) * 6, 48 + math.sin(t * 6) * 6)
		if r.inside then
			zone.BackgroundColor3 = RGB(110, 255, 90)
			zoneStroke.Color = Color3.new(1, 1, 1)
			trackStroke.Color = Color3.new(0, 0, 0)
		else
			local blink = (math.sin(t * 18) + 1) / 2
			zone.BackgroundColor3 = RGB(255, 120, 90):Lerp(RGB(255, 200, 80), blink)
			zoneStroke.Color = RGB(255, 60, 60)
			trackStroke.Color = RGB(160, 0, 0):Lerp(Color3.new(0, 0, 0), blink)
		end
		for i, wv in waves do
			local x = ((i * 90 + t * 60) % 560) - 40
			wv.Position = UDim2.fromOffset(x, 10 + ((i % 2) * 36))
		end
		fill.Size = UDim2.fromScale(r.progress, 1)
		local danger = r.progress < 0.2
		local col = if danger then Sim.G.red elseif r.progress > 0.75 then Sim.G.yellow else Sim.G.green
		fillGrad.Color = ColorSequence.new(col[1], col[2])
		pct.Text = ("%d%%"):format(math.floor(r.progress * 100))
		-- combo
		local c = math.floor(r.combo)
		if c ~= lastCombo then
			if c > lastCombo and c >= 1 then
				comboScale.Scale = 1.5
				tween(comboScale, 0.25, { Scale = 1 }, Enum.EasingStyle.Back)
			end
			lastCombo = c
			combo.Text = if c >= 1 then ("x%d"):format(c + 1) else ""
		end
		-- low catch bar: panel trembles
		panel.Rotation = if danger and not r.inside then math.sin(t * 50) * 1.2 else 0
	end
	return ui
end

------------------------------------------------------------------------------------------
function HUD.popup(text: string, color: Color3?)
	local holder = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(300, 50), Position = UDim2.new(0.5, math.random(-80, 80), 0.46, 0),
		AnchorPoint = Vector2.new(0.5, 0.5) }, gui)
	local sc = new("UIScale", { Scale = 0.3 }, holder)
	local t = Sim.text(holder, text, { Size = UDim2.fromScale(1, 1), Max = 40, Stroke = 4,
		Gradient = if color then { color:Lerp(Color3.new(1, 1, 1), 0.5), color } else { RGB(255, 210, 120), RGB(255, 100, 40) }, ZIndex = 30 })
	tween(sc, 0.3, { Scale = 1.15 }, Enum.EasingStyle.Back)
	tween(holder, 1.0, { Position = holder.Position - UDim2.fromOffset(0, 80), Rotation = math.random(-8, 8) })
	task.delay(0.65, function()
		tween(t, 0.3, { TextTransparency = 1 })
		tween(t:FindFirstChildOfClass("UIStroke"), 0.3, { Transparency = 1 })
		task.wait(0.32)
		holder:Destroy()
	end)
	return holder
end

function HUD.renderStats()
	local d = Data.values
	local power = d.strength or 0
	local gain = d.strengthGain or 1
	refs.strength.Text = ("%s (x%d)"):format(Format.short(power), gain)
	local rate = player:GetAttribute("Income") or 0
	refs.income.Text = if rate > 0 then "+" .. Format.short(rate) .. "/s" else ""
	local placed = 0
	for _, b in d.bears or {} do if b.placed then placed += 1 end end
	refs.panelTitle.Text = ("%d/%d Active"):format(placed, Formulas.capacity(d.capacity or 1))
	Sim.setText(refs.slotButton, if (d.capacity or 1) >= E.Capacity.maxLevel then "MAX" else "+1 [" .. Format.money(E.Capacity.cost(d.capacity or 1)) .. "]")
	local pend = d.indexPending or {}
	refs.indexBadge.Visible = (pend.Fish or 0) + (pend.Bears or 0) > 0
	local daily = d.daily
	if refs.dailyBadge then refs.dailyBadge.Visible = daily ~= nil and os.time() - (daily.last or 0) >= E.Daily.cooldown end
	local nextRod
	for _, id in RodConfig.Order do
		if not (d.rods and d.rods.owned[id]) then nextRod = RodConfig.get(id) break end
	end
	refs.shopBadge.Visible = (nextRod ~= nil and (d.money or 0) >= nextRod.price) or (d.money or 0) >= E.Strength.gainCost(gain)
end

-- subtle distance counter while your fish flies: "123 m" counts up with the fish,
-- small pop on landing; beating your best shows a discreet "NEW RECORD!" pill.
local STUD_M = 0.28 -- 1 stud ~ 28 cm
local throwToken = 0
function HUD.throwDistance(d)
	if not d or not d.dist then return end
	throwToken += 1
	local my = throwToken
	local old = gui:FindFirstChild("ThrowDistance")
	if old then old:Destroy() end
	-- at the very top of the screen; the title steps aside while the counter is shown
	local root = Sim.root(gui, "ThrowDistance", Vector2.new(320, 90), UDim2.new(0.5, 0, 0, 2), Vector2.new(0.5, 0))
	local title = gui:FindFirstChild("Title")
	if title then title.Visible = false end
	local function restoreTitle()
		if my == throwToken and title then title.Visible = true end
	end
	-- inner box: the root already has its responsive WindowScale (one UIScale per object)
	local box = new("Frame", { Name = "Box", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1) }, root)
	local pop = new("UIScale", { Scale = 0.6 }, box)
	tween(pop, 0.25, { Scale = 1 }, Enum.EasingStyle.Back)
	local label = Sim.text(box, "0 m", { Size = UDim2.fromOffset(300, 44), Position = UDim2.fromOffset(160, 24), Max = 38, Stroke = 3.5,
		Gradient = { RGB(255, 255, 255), RGB(150, 220, 255) }, ZIndex = 5 })
	local total = d.dist * STUD_M
	local conn
	conn = RunService.RenderStepped:Connect(function()
		if my ~= throwToken or not root.Parent then conn:Disconnect() return end
		local u = math.clamp((workspace:GetServerTimeNow() - d.t0) / d.flight, 0, 1)
		label.Text = ("%d m"):format(math.floor(total * u + 0.5))
		if u >= 1 then
			conn:Disconnect()
			label.Text = ("%d m"):format(math.floor(total + 0.5))
			pop.Scale = 1.15
			tween(pop, 0.3, { Scale = 1 }, Enum.EasingStyle.Back)
			if d.record then
				local pill = Sim.infoBar(box, '<font color="#FFD23F">NEW RECORD!</font>', { Size = UDim2.fromOffset(180, 28), Position = UDim2.fromOffset(160, 68), Max = 20, ZIndex = 4 })
				local ps = new("UIScale", { Scale = 0 }, pill)
				tween(ps, 0.35, { Scale = 1 }, Enum.EasingStyle.Back)
				local grad = label:FindFirstChildOfClass("UIGradient")
				if grad then grad.Color = ColorSequence.new(RGB(255, 250, 200), RGB(255, 200, 40)) end
				Sound.play("Reveal1")
			elseif (d.best or 0) > 0 then
				Sim.text(box, ("Best %d m"):format(math.floor(math.max(d.best, if d.ok then d.dist else 0) * STUD_M + 0.5)), { Size = UDim2.fromOffset(160, 22), Position = UDim2.fromOffset(160, 66), Max = 18, Stroke = 2.5,
					Color = RGB(220, 230, 240), ZIndex = 4 })
			end
			task.delay(if d.record then 3 else 2.2, function()
				if my ~= throwToken or not root.Parent then return end
				tween(pop, 0.25, { Scale = 0 }, Enum.EasingStyle.Back, Enum.EasingDirection.In)
				task.wait(0.3)
				if root.Parent then root:Destroy() end
				restoreTitle()
			end)
		end
	end)
end

function HUD.setGiftBadge(on: boolean)
	if refs.giftBadge then refs.giftBadge.Visible = on end
end

-- "Bears + Fish" inventory button: sits in the Roblox top bar, right next to the chat icon,
-- and replaces the default Roblox inventory/backpack button.
-- placed with GuiService.TopbarInset = the free space right after Roblox's own top-bar
-- buttons (menu, chat...), so it never sits under the chat icon on any device
local GuiService = game:GetService("GuiService")
local function buildInventoryButton()
	local ig = new("ScreenGui", { Name = "InventoryButton", ResetOnSpawn = false, DisplayOrder = 2, IgnoreGuiInset = true,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling, ScreenInsets = Enum.ScreenInsets.None }, player:WaitForChild("PlayerGui"))
	local b = new("TextButton", { Name = "Inventory", Text = "", AutoButtonColor = false, BackgroundColor3 = RGB(18, 18, 21), BackgroundTransparency = 0.3,
		Size = UDim2.fromOffset(44, 44), Position = UDim2.fromOffset(180, 12), BorderSizePixel = 0 }, ig)
	local function place()
		local inset = GuiService.TopbarInset
		local h = inset.Max.Y - inset.Min.Y
		if inset.Max.X <= inset.Min.X or h <= 0 then return end
		local size = math.clamp(h - 12, 32, 48)
		b.Size = UDim2.fromOffset(size, size)
		-- the Roblox "Shop" bag button already sits at inset.Min.X: put ours RIGHT of it (one slot over)
		b.Position = UDim2.fromOffset(inset.Min.X + 8 + (size + 8), inset.Min.Y + (h - size) / 2 + 6)
	end
	place()
	GuiService:GetPropertyChangedSignal("TopbarInset"):Connect(place)
	new("UICorner", { CornerRadius = UDim.new(1, 0) }, b)
	new("ImageLabel", { Name = "Icon", BackgroundTransparency = 1, Image = K.Icons.Bag, ScaleType = Enum.ScaleType.Fit, Size = UDim2.fromOffset(28, 28),
		Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5) }, b)
	local sc = new("UIScale", {}, b)
	b.MouseButton1Down:Connect(function() tween(sc, 0.06, { Scale = 0.9 }) end)
	b.MouseButton1Up:Connect(function() tween(sc, 0.12, { Scale = 1 }, Enum.EasingStyle.Back) end)
	b.Activated:Connect(function()
		Sound.play("Click")
		if HUD.menus then HUD.menus.open("Inventory") end
	end)
	refs.inventoryButton = b
end

function HUD.mount(g: ScreenGui)
	gui = g
	local _ = buildInventoryButton -- (top-left inventory button removed: the Fish / Bears tiles open it)
	buildTitle()
	buildLeft()
	buildRight()
	buildStats()
	buildHotbar()
	buildActionAndSpeed()
	buildMeter()
	HUD.reelUI = buildReel()

	Data.Changed:Connect(function(key)
		if key == "*" or key == "settings" then refs.renderLowFx() end
		if key == "strength" and Data.ready then
			local now = Data.values.strength or 0
			if lastStrength and now > lastStrength then HUD.popup("+" .. Format.short(now - lastStrength) .. " STRENGTH") end
			lastStrength = now
		elseif key == "*" then
			lastStrength = Data.values.strength or 0
		end
		HUD.renderStats()
		HUD.renderHotbar()
		if key == "bears" or key == "*" then HUD.renderPanel() end
	end)
	Data.StateChanged:Connect(function() HUD.renderHotbar() end)
	player:GetAttributeChangedSignal("Income"):Connect(HUD.renderStats)

	local shown, acc = 0, 0
	RunService.RenderStepped:Connect(function(dt)
		refs.title.Rotation = math.sin(os.clock() * 1.4) * 1
		local target = Data.values.money or 0
		if math.abs(target - shown) > 0.5 then
			if target > shown + 0.5 then refs.moneyScale.Scale = 1.1 end
			shown += (target - shown) * math.min(1, dt * 8)
			if math.abs(target - shown) < 1 then shown = target end
			refs.money.Text = Format.money(shown)
		end
		refs.moneyScale.Scale += (1 - refs.moneyScale.Scale) * math.min(1, dt * 9)
		acc += dt
		if acc < 0.2 then return end
		acc = 0
		local epoch = ReplicatedStorage:GetAttribute("LuckyEpoch")
		if epoch then
			local period, dur = E.Lucky.period, E.Lucky.duration
			local lt = (workspace:GetServerTimeNow() - epoch) % period
			local tl = refs.timer:FindFirstChild("Text")
			if tl then
				tl.Text = if lt >= period - dur
					then ('<font color="#7CFF46">LUCKY LAKE x2!</font> <font color="#FFD23F">%s</font>'):format(Format.time(period - lt))
					else ('Lucky Lake in <font color="#FFD23F">%s</font>'):format(Format.time(period - dur - lt))
			end
		end
		local char = player.Character
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		refs.speed.Text = tostring(if hum then math.floor(hum.WalkSpeed + 0.5) else 0)
		HUD.renderHotbar()
	end)
	HUD.renderStats()
end

UserInputService.InputBegan:Connect(function(input, gp)
	if gp then return end
	if input.KeyCode == Enum.KeyCode.One then
		Net.event("EquipSlot"):FireServer("Rod")
	elseif input.KeyCode == Enum.KeyCode.Two then
		Net.event("EquipSlot"):FireServer("Fish")
	elseif input.KeyCode == Enum.KeyCode.Three then
		if HUD.menus then HUD.menus.open("Inventory") end
	end
end)

return HUD
