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
	local root = Sim.root(gui, "Right", Vector2.new(420, 340), UDim2.new(1, -12, 0.45, 0), Vector2.new(1, 0.5))
	local tiles = new("Frame", { Name = "Tiles", BackgroundTransparency = 1, Size = UDim2.fromOffset(100, 330), Position = UDim2.fromOffset(318, 5) }, root)
	local function tile(name, grad, icon, y, open)
		local b = Sim.button(tiles, { Name = name, Grad = grad, Size = Vector2.new(84, 84), Position = UDim2.fromOffset(50, y), Hover = 1.07 },
			function()
				if open == "Bears" then
					if refs.togglePanel then refs.togglePanel() end -- small "X/13 Active" panel with Pick Up
				else
					HUD.menus.open(open)
				end
			end)
		new("ImageLabel", { Name = "Icon", BackgroundTransparency = 1, Image = icon, ScaleType = Enum.ScaleType.Fit, Size = UDim2.fromOffset(70, 70),
			Position = UDim2.fromScale(0.5, 0.45), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 7 }, b)
		Sim.text(b, name, { Size = UDim2.new(1, 4, 0, 24), Position = UDim2.new(0.5, 0, 1, -12), Max = 22, ZIndex = 9 })
		return b, Sim.badge(b)
	end
	local _, giftBadge = tile("Gifts", "red", K.Icons.Gift, 56, "Rewards")
	local _, dailyBadge = tile("Daily", "orange", K.Icons.Daily, 164, "Daily")
	tile("Bears", "teal", K.Icons.Paw, 272, "Bears")
	refs.giftBadge = giftBadge
	refs.dailyBadge = dailyBadge

	local tab = Sim.button(root, { Name = "PanelTab", Grad = "red", Size = Vector2.new(46, 64), Position = UDim2.fromOffset(34, 164), Text = "<", Max = 40 })
	tab.Visible = false -- the red arrow only exists while the Bears panel is open
	local panel = new("Frame", { Name = "BearsPanel", BackgroundColor3 = RGB(52, 52, 56), Size = UDim2.fromOffset(350, 300),
		Position = UDim2.fromOffset(66, 6), Visible = false, ZIndex = 3 }, root)
	Sim.corner(panel, 4)
	Sim.stroke(panel, 4)
	Sim.studs(panel, { dark = true, tile = 26, z = 3 })
	local head = Sim.panel(panel, { Size = UDim2.fromOffset(338, 50), Position = UDim2.fromOffset(6, 6), Gradient = Sim.G.yellow, ZIndex = 4 })
	refs.panelTitle = Sim.text(head, "0/5 Active", { Size = UDim2.fromOffset(160, 38), Position = UDim2.fromOffset(12, 25), AnchorPoint = Vector2.new(0, 0.5),
		AlignX = Enum.TextXAlignment.Left, Max = 30, ZIndex = 6 })
	refs.slotButton = Sim.button(head, { Name = "Slot", Grad = "green", Size = Vector2.new(150, 38), Position = UDim2.fromOffset(256, 25), Text = "+1 Slot", Max = 20, ZIndex = 6 },
		function() Net.event("UpgradeCapacity"):FireServer() end)
	local list = new("ScrollingFrame", { BackgroundTransparency = 1, BorderSizePixel = 0, Size = UDim2.fromOffset(338, 232), Position = UDim2.fromOffset(6, 62),
		CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 6, ZIndex = 4 }, panel)
	new("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }, list)
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
	for i, b in bears do
		local row = Sim.panel(list, { Name = "Row" .. i, Size = UDim2.fromOffset(326, 66), Gradient = Sim.G.gold, LayoutOrder = i, ZIndex = 5 })
		local pic = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(60, 60), Position = UDim2.fromOffset(4, 3), ZIndex = 6 }, row)
		Sim.model(pic, { kind = "Bear", id = b.s, variant = b.v, size = UDim2.fromScale(1, 1) })
		Sim.text(row, BearConfig.get(b.s).name, { Size = UDim2.fromOffset(150, 26), Position = UDim2.fromOffset(68, 20), AnchorPoint = Vector2.new(0, 0.5),
			AlignX = Enum.TextXAlignment.Left, Max = 22, Color = Sim.RARITY_TEXT[b.r] or Color3.new(1, 1, 1), ZIndex = 8 })
		Sim.text(row, "(" .. Format.perSec(Formulas.bearIncome(b)) .. ")", { Size = UDim2.fromOffset(150, 24), Position = UDim2.fromOffset(68, 46), AnchorPoint = Vector2.new(0, 0.5),
			AlignX = Enum.TextXAlignment.Left, Max = 20, Color = RGB(120, 255, 70), ZIndex = 8 })
		Sim.button(row, { Name = "Pick", Grad = "red", Size = Vector2.new(100, 42), Position = UDim2.fromOffset(268, 33), Text = "Pick Up", Max = 20, ZIndex = 7 },
			function() Net.event("PickupBear"):FireServer(b.id) end)
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
			HUD.popup("THROW!", RGB(255, 190, 40))
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
			HUD.popup("MAX!", RGB(255, 80, 60))
		end
	end
	if m.pop.Scale > 0.95 and m.pop.Scale < 1.2 then m.pop.Scale = pulse end
end

------------------------------------------------------------------------------------------
local function buildReel()
	local root = Sim.root(gui, "Reel", Vector2.new(460, 160), UDim2.new(0.5, 0, 0.68, 0), Vector2.new(0.5, 0.5))
	root.Visible = false
	local panel = Sim.panel(root, { Size = UDim2.fromOffset(450, 150), Position = UDim2.fromOffset(5, 5), Gradient = Sim.G.blue, ZIndex = 3 })
	local title = Sim.text(panel, "HOLD REEL!", { Size = UDim2.fromOffset(420, 32), Position = UDim2.new(0.5, 0, 0, 22), Max = 30, ZIndex = 6 })
	local function bar(y, h, grad)
		local b = new("Frame", { BackgroundColor3 = RGB(30, 30, 34), Size = UDim2.fromOffset(420, h), Position = UDim2.fromOffset(15, y), ClipsDescendants = true, ZIndex = 5 }, panel)
		Sim.corner(b, 4)
		Sim.stroke(b, 3)
		local f = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, Size = UDim2.fromScale(0, 1), ZIndex = 6 }, b)
		Sim.gradient(f, grad, 90)
		Sim.studs(f, { tile = 18, z = 6 })
		return b, f
	end
	local tBar, tFill = bar(44, 32, Sim.G.green)
	Sim.text(tBar, "TENSION", { Size = UDim2.fromScale(1, 0.8), Max = 20, ZIndex = 8 })
	new("Frame", { BackgroundColor3 = RGB(255, 40, 40), BackgroundTransparency = 0.5, BorderSizePixel = 0, Size = UDim2.fromScale(0.18, 1), Position = UDim2.fromScale(0.82, 0), ZIndex = 7 }, tBar)
	local pBar, pFill = bar(92, 38, Sim.G.blue)
	local fishIcon = new("ImageLabel", { BackgroundTransparency = 1, Image = K.Icons.Bait, Size = UDim2.fromOffset(44, 44), Position = UDim2.fromScale(0, 0.5),
		AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 9 }, pBar)
	local pop = new("UIScale", {}, panel)
	local ui = {}
	function ui.show(difficulty)
		root.Visible = true
		pop.Scale = 0.4
		tween(pop, 0.35, { Scale = 1 }, Enum.EasingStyle.Back)
		title.Text = if difficulty >= 4 then "HEAVY FISH! Hold REEL, release on red!" else "HOLD REEL! Release when red!"
	end
	function ui.hide() root.Visible = false end
	function ui.update(r)
		tFill.Size = UDim2.new(r.tension, 0, 1, 0)
		tFill.BackgroundColor3 = Color3.new(1, 1, 1):Lerp(RGB(255, 110, 110), math.clamp((r.tension - 0.5) * 2, 0, 1))
		pFill.Size = UDim2.new(r.progress, 0, 1, 0)
		fishIcon.Position = UDim2.fromScale(r.progress, 0.5)
		fishIcon.Rotation = math.sin(os.clock() * 22) * 18 * (0.3 + r.tension)
		panel.Rotation = if r.tension > 0.82 then math.sin(os.clock() * 60) * 1.6 else 0
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
	refs.dailyBadge.Visible = daily ~= nil and os.time() - (daily.last or 0) >= E.Daily.cooldown
	local nextRod
	for _, id in RodConfig.Order do
		if not (d.rods and d.rods.owned[id]) then nextRod = RodConfig.get(id) break end
	end
	refs.shopBadge.Visible = (nextRod ~= nil and (d.money or 0) >= nextRod.price) or (d.money or 0) >= E.Strength.gainCost(gain)
end

function HUD.setGiftBadge(on: boolean)
	if refs.giftBadge then refs.giftBadge.Visible = on end
end

-- "Bears + Fish" inventory button: sits in the Roblox top bar, right next to the chat icon,
-- and replaces the default Roblox inventory/backpack button.
local INV_BUTTON_X, INV_BUTTON_Y = 172, 12 -- placed right after the chat pill (measured on a phone). Raise X if it overlaps.
local function buildInventoryButton()
	local ig = new("ScreenGui", { Name = "InventoryButton", ResetOnSpawn = false, DisplayOrder = 2, IgnoreGuiInset = true,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling, ScreenInsets = Enum.ScreenInsets.DeviceSafeInsets }, player:WaitForChild("PlayerGui"))
	local b = new("TextButton", { Name = "Inventory", Text = "", AutoButtonColor = false, BackgroundColor3 = RGB(18, 18, 21), BackgroundTransparency = 0.3,
		Size = UDim2.fromOffset(44, 44), Position = UDim2.fromOffset(INV_BUTTON_X, INV_BUTTON_Y), BorderSizePixel = 0 }, ig)
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
	buildInventoryButton()
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
