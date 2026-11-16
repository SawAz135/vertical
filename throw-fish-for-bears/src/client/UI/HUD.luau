--[[ HUD: permanent interface, laid out exactly like the reference screenshots:
     top centre  : game title + event timer ("Lucky Lake")
     left middle : SHOP (green) / INDEX (blue, badge) / Low FX toggle
     right middle: 3 square icons (Rewards, Daily, Bears) + red ">" tab opening the
                   "Bears in base x/y" panel (Pick up / Place best / +1 slot)
     bottom left : strength (level, throw distance, training progress) + money (+$/s)
     bottom mid  : hotbar (Rod, Fish, carried Bear) with real 3D icons
     bottom right: speed
     plus the contextual action button, throw power meter and reel mini-game. ]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local E = require(Shared.Config.EconomyConfig)
local FishConfig = require(Shared.Config.FishConfig)
local BearConfig = require(Shared.Config.BearConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local RodConfig = require(Shared.Config.RodConfig)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local Theme = require(script.Parent.Theme)
local Viewport = require(script.Parent.Viewport)
local Data = require(script.Parent.Parent.Controllers.Data)
local Actions = require(script.Parent.Parent.Controllers.Actions)
local Sound = require(script.Parent.Parent.Controllers.Sound)
local Fx = require(script.Parent.Parent.Controllers.Fx)

local HUD = {}
local player = Players.LocalPlayer
local new = Theme.new
local C = Color3.fromRGB
HUD.menus = nil -- set by ClientMain (Menus module)

local gui: ScreenGui
local refs = {}

local function touch(): boolean
	return UserInputService.TouchEnabled
end

-- title + timer --------------------------------------------------------------------
local function buildTitle()
	local holder = new("Frame", { Name = "Title", BackgroundTransparency = 1, Size = UDim2.fromOffset(420, 62), Position = UDim2.new(0.5, 0, 0, 2), AnchorPoint = Vector2.new(0.5, 0) })
	local t = Theme.text({
		Text = '<font color="#3CA0FF">THROW</font> <font color="#52F05A">FISH</font> <font color="#FFD23C">FOR</font> <font color="#FF6EC8">BEARS</font>',
		RichText = true, Size = UDim2.fromOffset(420, 36), Max = 34, Stroke = 3.5, Font = Theme.FontBold, Parent = holder,
	})
	t.Rotation = -1
	refs.timer = Theme.text({ Text = "", Size = UDim2.fromOffset(320, 20), Position = UDim2.new(0.5, 0, 0, 38), AnchorPoint = Vector2.new(0.5, 0), Max = 18, Parent = holder })
	holder.Parent = gui
end

-- left column --------------------------------------------------------------------
local function sideButton(text: string, icon: string, grad, pos: UDim2)
	local b = Theme.button({ Name = text, Text = "", Gradient = grad, Size = UDim2.fromOffset(132, 46), Position = pos, Studs = 12, Parent = gui })
	Theme.text({ Text = icon, Size = UDim2.fromOffset(34, 34), Position = UDim2.new(0, 6, 0.5, 0), AnchorPoint = Vector2.new(0, 0.5), Max = 30, Stroke = 0, ZIndex = 3, Parent = b })
	Theme.text({ Text = text, Size = UDim2.new(1, -48, 0.7, 0), Position = UDim2.new(0, 42, 0.5, 0), AnchorPoint = Vector2.new(0, 0.5), Max = 26, Stroke = 3, XAlign = Enum.TextXAlignment.Left, ZIndex = 3, Parent = b })
	return b
end

local function buildLeft()
	local shop = sideButton("Shop", "🛒", Theme.G.green, UDim2.new(0, 70, 0.4, -50))
	local index = sideButton("Index", "📖", Theme.G.blue, UDim2.new(0, 70, 0.4, 4))
	refs.shopBadge = Theme.badge(shop)
	refs.indexBadge = Theme.badge(index)
	shop.Activated:Connect(function() HUD.menus.open("Shop") end)
	index.Activated:Connect(function() HUD.menus.open("Index") end)
	-- Low FX toggle (reference "Mode lent" switch)
	local tg = new("TextButton", { Name = "LowFx", Text = "", AutoButtonColor = false, Size = UDim2.fromOffset(62, 30), Position = UDim2.new(0, 70, 0.4, 60), BackgroundColor3 = C(60, 60, 66) })
	Theme.corner(8).Parent = tg
	Theme.stroke(3).Parent = tg
	local knob = Theme.block({ Name = "Knob", Size = UDim2.fromOffset(24, 22), Position = UDim2.fromOffset(4, 4), Gradient = Theme.G.red, Corner = 6, StrokeWidth = 2, Parent = tg })
	Theme.text({ Text = "Low FX", Size = UDim2.fromOffset(80, 24), Position = UDim2.new(1, 8, 0.5, 0), AnchorPoint = Vector2.new(0, 0.5), Max = 20, XAlign = Enum.TextXAlignment.Left, Parent = tg })
	Theme.bounce(tg)
	tg.Parent = gui
	local function render()
		local on = Data.values.settings and Data.values.settings.lowFx
		Fx.low = on == true
		Theme.tween(knob, 0.18, { Position = if on then UDim2.fromOffset(34, 4) else UDim2.fromOffset(4, 4) }, Enum.EasingStyle.Back)
		Theme.setGradient(knob, if on then Theme.G.green else Theme.G.red)
	end
	tg.Activated:Connect(function()
		local on = not (Data.values.settings and Data.values.settings.lowFx)
		Data.values.settings = Data.values.settings or {}
		Data.values.settings.lowFx = on
		render()
		Net.event("SetSetting"):FireServer("lowFx", on)
	end)
	refs.renderLowFx = render
end

-- right column + bears panel ------------------------------------------------------------
local function square(name: string, icon: string, grad, y: number)
	local b = Theme.button({ Name = name, Text = "", Gradient = grad, Size = UDim2.fromOffset(54, 54), Position = UDim2.new(1, -16, 0.42, y), AnchorPoint = Vector2.new(1, 0.5), Studs = 10, Parent = gui })
	Theme.text({ Text = icon, Size = UDim2.fromScale(0.72, 0.72), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), Max = 34, Stroke = 0, ZIndex = 3, Parent = b })
	return b
end

local function buildRight()
	local rewards = square("Rewards", "🎁", Theme.G.red, -62)
	local daily = square("Daily", "📅", Theme.G.orange, 0)
	local bears = square("Bears", "🐾", Theme.G.teal, 62)
	refs.rewardsBadge = Theme.badge(rewards)
	refs.dailyBadge = Theme.badge(daily)
	rewards.Activated:Connect(function() HUD.menus.open("Rewards") end)
	daily.Activated:Connect(function() HUD.menus.open("Daily") end)
	bears.Activated:Connect(function() HUD.menus.open("Bears") end)

	-- ">" tab + panel
	local tab = Theme.button({ Name = "PanelTab", Text = ">", Gradient = Theme.G.red, Size = UDim2.fromOffset(34, 44), Position = UDim2.new(1, -80, 0.42, 0), AnchorPoint = Vector2.new(1, 0.5), Max = 30, Parent = gui })
	local panel = Theme.block({
		Name = "BearsPanel", Size = UDim2.fromOffset(250, 236), Position = UDim2.new(1, -122, 0.42, 0), AnchorPoint = Vector2.new(1, 0.5),
		Color = Theme.BODY, Corner = 8, StrokeWidth = 4, Studs = 16, StudColor = Theme.BODY_STUD, StudTransparency = 0.1, Parent = gui,
	})
	panel.Visible = false
	local head = Theme.block({ Size = UDim2.new(1, -8, 0, 36), Position = UDim2.fromOffset(4, 4), Gradient = Theme.G.yellow, Corner = 6, StrokeWidth = 2, ZIndex = 3, Parent = panel })
	refs.panelTitle = Theme.text({ Text = "0/5 Active", Size = UDim2.new(0.55, 0, 0.8, 0), Position = UDim2.new(0, 8, 0.5, 0), AnchorPoint = Vector2.new(0, 0.5), Max = 22, XAlign = Enum.TextXAlignment.Left, ZIndex = 4, Parent = head })
	local slot, slotLabel = Theme.button({ Text = "+1 Slot", Gradient = Theme.G.green, Size = UDim2.new(0.44, 0, 0, 28), Position = UDim2.new(1, -4, 0.5, 0), AnchorPoint = Vector2.new(1, 0.5), Max = 15, ZIndex = 4, Parent = head })
	refs.slotLabel = slotLabel
	slot.Activated:Connect(function() Net.event("UpgradeCapacity"):FireServer() end)
	local list = new("ScrollingFrame", {
		BackgroundTransparency = 1, Size = UDim2.new(1, -8, 1, -88), Position = UDim2.fromOffset(4, 44), CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 4, BorderSizePixel = 0, ZIndex = 3,
	})
	new("UIListLayout", { Padding = UDim.new(0, 4), SortOrder = Enum.SortOrder.LayoutOrder }).Parent = list
	list.Parent = panel
	refs.panelList = list
	local best = Theme.button({ Text = "Place Best", Gradient = Theme.G.green, Size = UDim2.new(1, -8, 0, 36), Position = UDim2.new(0, 4, 1, -4), AnchorPoint = Vector2.new(0, 1), Max = 22, ZIndex = 3, Parent = panel })
	best.Activated:Connect(function() Net.event("PlaceBest"):FireServer() end)
	local ps = new("UIScale", { Parent = panel })
	tab.Activated:Connect(function()
		panel.Visible = not panel.Visible
		refs.tabLabel.Text = if panel.Visible then "<" else ">"
		if panel.Visible then
			ps.Scale = 0.7
			Theme.tween(ps, 0.3, { Scale = 1 }, Enum.EasingStyle.Back)
			HUD.renderPanel()
		end
	end)
	refs.tabLabel = tab:FindFirstChild("Label")
	refs.panel = panel
	-- the panel covers the 3 icons area when open (like the reference)
	panel:GetPropertyChangedSignal("Visible"):Connect(function()
		rewards.Visible = not panel.Visible
		daily.Visible = not panel.Visible
		bears.Visible = not panel.Visible
		panel.Position = if panel.Visible then UDim2.new(1, -16, 0.42, 0) else UDim2.new(1, -122, 0.42, 0)
		tab.Position = if panel.Visible then UDim2.new(1, -272, 0.42, 0) else UDim2.new(1, -80, 0.42, 0)
	end)
end

function HUD.renderPanel()
	local list = refs.panelList
	if not list or not refs.panel.Visible then return end
	for _, c in list:GetChildren() do
		if c:IsA("Frame") then c:Destroy() end
	end
	local bears = {}
	for _, b in Data.values.bears or {} do
		if b.placed then table.insert(bears, b) end
	end
	table.sort(bears, function(a, b) return Formulas.bearIncome(a) > Formulas.bearIncome(b) end)
	for i, b in bears do
		local tier = RarityConfig.get(b.r)
		local row = Theme.block({ Size = UDim2.new(1, -6, 0, 50), Gradient = Theme.G.wood, Corner = 6, StrokeWidth = 2, LayoutOrder = i, ZIndex = 4, Parent = list })
		local icon = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(46, 46), Position = UDim2.fromOffset(2, 2), ZIndex = 5 })
		icon.Parent = row
		Viewport.create(icon, { kind = "Bear", id = b.s, variant = b.v, zindex = 6 })
		Theme.text({ Text = BearConfig.get(b.s).name, Size = UDim2.new(1, -140, 0, 20), Position = UDim2.fromOffset(52, 5), Max = 17, XAlign = Enum.TextXAlignment.Left, Color = if tier.textColor then tier.textColor else tier.color, ZIndex = 6, Parent = row })
		Theme.text({ Text = "(" .. Format.perSec(Formulas.bearIncome(b)) .. ")", Size = UDim2.new(1, -140, 0, 18), Position = UDim2.fromOffset(52, 27), Max = 15, XAlign = Enum.TextXAlignment.Left, Color = Theme.MONEY, ZIndex = 6, Parent = row })
		local pick = Theme.button({ Text = "Pick Up", Gradient = Theme.G.red, Size = UDim2.fromOffset(80, 34), Position = UDim2.new(1, -6, 0.5, 0), AnchorPoint = Vector2.new(1, 0.5), Max = 15, ZIndex = 6, Parent = row })
		pick.Activated:Connect(function() Net.event("PickupBear"):FireServer(b.id) end)
	end
end

-- bottom left stats ----------------------------------------------------------------
local function buildStats()
	local holder = new("Frame", { Name = "Stats", BackgroundTransparency = 1, Size = UDim2.fromOffset(300, 84), Position = UDim2.new(0, 70, 1, -10), AnchorPoint = Vector2.new(0, 1) })
	holder.Parent = gui
	Theme.text({ Text = "💪", Size = UDim2.fromOffset(32, 32), Position = UDim2.fromOffset(0, 0), Max = 28, Stroke = 0, Parent = holder })
	refs.strength = Theme.text({ Text = "", Size = UDim2.fromOffset(250, 30), Position = UDim2.fromOffset(36, 1), Max = 28, Stroke = 3, XAlign = Enum.TextXAlignment.Left, Color = C(255, 110, 90), Font = Theme.FontBold, Parent = holder })
	local bar = Theme.block({ Size = UDim2.fromOffset(150, 8), Position = UDim2.fromOffset(38, 31), Color = C(30, 30, 34), Corner = 4, StrokeWidth = 2, Parent = holder })
	refs.repFill = Theme.block({ Size = UDim2.fromScale(0, 1), Gradient = Theme.G.orange, Corner = 4, StrokeWidth = 0, Parent = bar })
	Theme.text({ Text = "💵", Size = UDim2.fromOffset(34, 34), Position = UDim2.fromOffset(0, 44), Max = 30, Stroke = 0, Parent = holder })
	refs.money = Theme.text({ Text = "$0", Size = UDim2.fromOffset(170, 40), Position = UDim2.fromOffset(38, 42), Max = 38, Stroke = 3.5, XAlign = Enum.TextXAlignment.Left, Color = Theme.MONEY, Font = Theme.FontBold, Parent = holder })
	refs.income = Theme.text({ Text = "", Size = UDim2.fromOffset(120, 26), Position = UDim2.fromOffset(196, 50), Max = 24, Stroke = 3, XAlign = Enum.TextXAlignment.Left, Color = Theme.MONEY, Font = Theme.FontBold, Parent = holder })
	refs.moneyScale = new("UIScale", { Parent = refs.money })
end

-- hotbar --------------------------------------------------------------------------
local slots = {}
local function slotFrame(i: number)
	local b = new("TextButton", {
		Name = "Slot" .. i, Text = "", AutoButtonColor = false, Size = UDim2.fromOffset(66, 66),
		BackgroundColor3 = C(40, 70, 36), BackgroundTransparency = 0.25, LayoutOrder = i,
	})
	Theme.corner(8).Parent = b
	local st = Theme.stroke(3, C(20, 30, 18))
	st.Parent = b
	local icon = new("Frame", { Name = "Icon", BackgroundTransparency = 1, Size = UDim2.new(1, -6, 1, -18), Position = UDim2.fromOffset(3, 2), ZIndex = 2 })
	icon.Parent = b
	local label = Theme.text({ Text = "", Size = UDim2.new(1, -4, 0, 15), Position = UDim2.new(0.5, 0, 1, -2), AnchorPoint = Vector2.new(0.5, 1), Max = 13, Stroke = 2, ZIndex = 4, Parent = b })
	Theme.text({ Text = tostring(i), Size = UDim2.fromOffset(14, 14), Position = UDim2.fromOffset(4, 2), Max = 12, Stroke = 2, ZIndex = 4, Parent = b, XAlign = Enum.TextXAlignment.Left })
	local count = Theme.text({ Text = "", Size = UDim2.fromOffset(34, 16), Position = UDim2.new(1, -3, 0, 2), AnchorPoint = Vector2.new(1, 0), Max = 14, Stroke = 2, ZIndex = 4, Parent = b, XAlign = Enum.TextXAlignment.Right })
	Theme.bounce(b, "Equip")
	slots[i] = { button = b, icon = icon, label = label, stroke = st, count = count, key = nil }
	return b
end

local function buildHotbar()
	local bar = new("Frame", { Name = "Hotbar", BackgroundTransparency = 1, Size = UDim2.fromOffset(230, 70), Position = UDim2.new(0.5, 0, 1, -8), AnchorPoint = Vector2.new(0.5, 1) })
	new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Center, Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder }).Parent = bar
	bar.Parent = gui
	for i = 1, 3 do slotFrame(i).Parent = bar end
	slots[1].button.Activated:Connect(function() Net.event("EquipSlot"):FireServer("Rod") end)
	slots[2].button.Activated:Connect(function() Net.event("EquipSlot"):FireServer("Fish") end)
	slots[3].button.Activated:Connect(function() HUD.menus.open("Bears") end)
	-- bag button above the fish slot (opens the fish bag)
	local bag = Theme.button({ Name = "Bag", Text = "🎒 Bag", Gradient = Theme.G.purple, Size = UDim2.fromOffset(78, 26), Position = UDim2.new(0.5, 0, 1, -82), AnchorPoint = Vector2.new(0.5, 1), Max = 16, Parent = gui })
	bag.Activated:Connect(function() HUD.menus.open("Bag") end)
	refs.bag = bag
	-- store button while carrying a bear
	local store = Theme.button({ Name = "Store", Text = "📦 Store Bear", Gradient = Theme.G.orange, Size = UDim2.fromOffset(130, 30), Position = UDim2.new(0.5, 0, 1, -112), AnchorPoint = Vector2.new(0.5, 1), Max = 17, Parent = gui })
	store.Visible = false
	store.Activated:Connect(function() Net.event("StoreBear"):FireServer() end)
	refs.store = store
end

local iconKeys = {}
local function setIcon(i: number, key: string?, opts)
	local s = slots[i]
	if iconKeys[i] == key then return end
	iconKeys[i] = key
	for _, c in s.icon:GetChildren() do c:Destroy() end
	if key and opts then Viewport.create(s.icon, opts) end
end

function HUD.renderHotbar()
	local d = Data.values
	local char = player.Character
	local holding = char and char:GetAttribute("Holding") or ""
	local isBear = char and char:GetAttribute("IsBear")
	-- 1: rod
	local rodId = d.rods and d.rods.equipped or "Starter"
	setIcon(1, "rod:" .. rodId, { kind = "Rod", id = rodId, zoom = 0.85 })
	slots[1].label.Text = RodConfig.get(rodId).name
	-- 2: fish (selected or first) - only if the bag has fish
	local fish = Data.fishById(d.selectedFish) or (d.fish and d.fish[1])
	slots[2].button.Visible = fish ~= nil
	refs.bag.Visible = d.fish ~= nil and #d.fish > 0
	if fish then
		setIcon(2, "fish:" .. fish.s .. (fish.v or ""), { kind = "Fish", id = fish.s, variant = fish.v })
		slots[2].label.Text = FishConfig.get(fish.s).name
		slots[2].count.Text = "x" .. #d.fish
	end
	-- 3: carried bear
	local heldBear = holding == "Bear" and d.bears and d.bears[char:GetAttribute("HeldId")]
	slots[3].button.Visible = heldBear ~= nil and heldBear ~= false
	if heldBear then
		setIcon(3, "bear:" .. heldBear.s .. (heldBear.v or ""), { kind = "Bear", id = heldBear.s, variant = heldBear.v })
		slots[3].label.Text = BearConfig.get(heldBear.s).name
	end
	refs.store.Visible = Data.state == "CarryingCapturedBear"
	-- selection outline
	for i, s in slots do
		local active = (i == 1 and holding == "Rod") or (i == 2 and holding == "Fish") or (i == 3 and holding == "Bear")
		s.stroke.Color = if active then C(255, 255, 255) else C(20, 30, 18)
		s.stroke.Thickness = if active then 4 else 3
	end
	gui.Hotbar.Visible = not isBear
	refs.bag.Visible = refs.bag.Visible and not isBear
end

-- bottom right speed -------------------------------------------------------------------
local function buildSpeed()
	refs.speed = Theme.text({ Text = "👟 20", Size = UDim2.fromOffset(150, 30), Position = UDim2.new(1, -18, 1, -10), AnchorPoint = Vector2.new(1, 1), Max = 26, Stroke = 3, XAlign = Enum.TextXAlignment.Right, Font = Theme.FontBold, Parent = gui })
end

-- action button -------------------------------------------------------------------------
local function buildAction()
	local size = 92
	local b = new("TextButton", {
		Name = "Action", Text = "", AutoButtonColor = false, Size = UDim2.fromOffset(size, size),
		Position = UDim2.new(1, -24, 1, -150), AnchorPoint = Vector2.new(1, 1), BackgroundColor3 = C(255, 255, 255), Visible = false,
	})
	Theme.corner(size).Parent = b
	Theme.stroke(4).Parent = b
	local grad = Theme.gradient(Theme.G.blue)
	grad.Parent = b
	local gloss = new("Frame", { BackgroundColor3 = C(255, 255, 255), BackgroundTransparency = 0.7, Size = UDim2.new(0.7, 0, 0.3, 0), Position = UDim2.fromScale(0.15, 0.08), BorderSizePixel = 0 })
	Theme.corner(30).Parent = gloss
	gloss.Parent = b
	local icon = Theme.text({ Text = "", Size = UDim2.fromScale(0.45, 0.4), Position = UDim2.fromScale(0.5, 0.36), AnchorPoint = Vector2.new(0.5, 0.5), Max = 34, Stroke = 0, ZIndex = 3, Parent = b })
	local label = Theme.text({ Text = "", Size = UDim2.fromScale(0.86, 0.26), Position = UDim2.fromScale(0.5, 0.72), AnchorPoint = Vector2.new(0.5, 0.5), Max = 20, Stroke = 3, ZIndex = 3, Font = Theme.FontBold, Parent = b })
	-- progress ring for hold actions
	local ring = new("Frame", { Name = "Ring", BackgroundTransparency = 1, Size = UDim2.new(1, 14, 1, 14), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5) })
	Theme.corner(size).Parent = ring
	local ringStroke = Theme.stroke(5, C(255, 240, 80))
	ringStroke.Transparency = 1
	ringStroke.Parent = ring
	ring.Parent = b
	local scale = new("UIScale", { Parent = b })
	b.InputBegan:Connect(function(i)
		if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then
			scale.Scale = 0.88
			Actions.press()
		end
	end)
	b.InputEnded:Connect(function(i)
		if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then
			Theme.tween(scale, 0.25, { Scale = 1 }, Enum.EasingStyle.Back)
			Actions.release()
		end
	end)
	b.Parent = gui
	refs.action = { button = b, grad = grad, label = label, icon = icon, scale = scale, ring = ringStroke }
	local keyHint = Theme.text({ Text = "[E]", Size = UDim2.fromOffset(40, 16), Position = UDim2.new(0.5, 0, 0, -6), AnchorPoint = Vector2.new(0.5, 1), Max = 14, Parent = b })
	keyHint.Visible = UserInputService.KeyboardEnabled
	Actions.ContextChanged:Connect(function(ctx)
		local c = ctx and Actions.CONTEXTS[ctx]
		if not c then
			Theme.tween(scale, 0.15, { Scale = 0 }, Enum.EasingStyle.Back, Enum.EasingDirection.In)
			task.delay(0.16, function()
				if not Actions.context then b.Visible = false end
			end)
			return
		end
		b.Visible = true
		label.Text = c.label
		icon.Text = c.icon
		grad.Color = ColorSequence.new(Theme.G[c.color][1], Theme.G[c.color][2])
		scale.Scale = 0.4
		Theme.tween(scale, 0.35, { Scale = 1 }, Enum.EasingStyle.Back)
		if ctx == "Hook" then Sound.play("Bite") end
	end)
end

-- throw power meter ---------------------------------------------------------------------
local function buildMeter()
	local m = Theme.block({ Name = "PowerMeter", Size = UDim2.fromOffset(34, 210), Position = UDim2.new(0.5, 150, 0.5, 0), AnchorPoint = Vector2.new(0.5, 0.5), Color = C(30, 30, 34), Corner = 10, StrokeWidth = 4, Parent = gui })
	m.Visible = false
	local fill = Theme.block({ Name = "Fill", Size = UDim2.new(1, -8, 0, 0), Position = UDim2.new(0, 4, 1, -4), AnchorPoint = Vector2.new(0, 1), Corner = 6, StrokeWidth = 0, Parent = m })
	local g = new("UIGradient", { Rotation = -90, Color = ColorSequence.new({
		ColorSequenceKeypoint.new(0, C(80, 255, 80)), ColorSequenceKeypoint.new(0.55, C(255, 230, 60)), ColorSequenceKeypoint.new(1, C(255, 50, 50)),
	}) })
	g.Parent = fill
	for k = 1, 3 do
		new("Frame", { BackgroundColor3 = C(0, 0, 0), BackgroundTransparency = 0.4, BorderSizePixel = 0, Size = UDim2.new(1, -8, 0, 2), Position = UDim2.new(0, 4, k / 4, 0), ZIndex = 3 }).Parent = m
	end
	local txt = Theme.text({ Text = "", Size = UDim2.fromOffset(120, 30), Position = UDim2.new(0.5, 0, 0, -8), AnchorPoint = Vector2.new(0.5, 1), Max = 26, Font = Theme.FontBold, Parent = m })
	Theme.text({ Text = "POWER", Size = UDim2.fromOffset(90, 18), Position = UDim2.new(0.5, 0, 1, 6), AnchorPoint = Vector2.new(0.5, 0), Max = 16, Parent = m })
	local ms = new("UIScale", { Parent = m })
	refs.meter = { frame = m, fill = fill, text = txt, scale = ms }
end

function HUD.setCharge(power: number?)
	local m = refs.meter
	if not power then
		m.frame.Visible = false
		return
	end
	if not m.frame.Visible then
		m.frame.Visible = true
		m.scale.Scale = 0.5
		Theme.tween(m.scale, 0.25, { Scale = 1 }, Enum.EasingStyle.Back)
	end
	m.fill.Size = UDim2.new(1, -8, power, -8 * power)
	local d = Data.values
	local fish = Data.fishById(player.Character and player.Character:GetAttribute("HeldId"))
	local dist = Formulas.throwDistance(power, d.strength or 1, fish and fish.w or 1)
	m.text.Text = math.floor(dist) .. " studs"
	m.text.TextColor3 = if power >= 1 then Color3.fromHSV((os.clock() * 2) % 1, 0.7, 1) else C(255, 255, 255)
	m.frame.Rotation = if power >= 1 then math.sin(os.clock() * 50) * 2 else 0
end

-- reel mini-game -----------------------------------------------------------------------
local function buildReel()
	local f = Theme.block({ Name = "Reel", Size = UDim2.fromOffset(330, 84), Position = UDim2.new(0.5, 0, 0.66, 0), AnchorPoint = Vector2.new(0.5, 0.5), Gradient = Theme.G.navy, Corner = 10, StrokeWidth = 4, Studs = 14, Parent = gui })
	f.Visible = false
	local title = Theme.text({ Text = "HOLD REEL! Don't snap the line!", Size = UDim2.new(1, -12, 0, 20), Position = UDim2.fromOffset(6, 4), Max = 18, Parent = f })
	local tBar = Theme.block({ Size = UDim2.new(1, -16, 0, 18), Position = UDim2.fromOffset(8, 28), Color = C(25, 25, 30), Corner = 6, StrokeWidth = 2, Parent = f })
	local tFill = Theme.block({ Size = UDim2.fromScale(0, 1), Color = C(80, 255, 80), Corner = 6, StrokeWidth = 0, Parent = tBar })
	Theme.text({ Text = "TENSION", Size = UDim2.fromScale(1, 1), Max = 13, ZIndex = 3, Parent = tBar })
	local danger = new("Frame", { BackgroundColor3 = C(255, 40, 40), BackgroundTransparency = 0.55, BorderSizePixel = 0, Size = UDim2.fromScale(0.18, 1), Position = UDim2.fromScale(0.82, 0) })
	Theme.corner(6).Parent = danger
	danger.Parent = tBar
	local pBar = Theme.block({ Size = UDim2.new(1, -16, 0, 22), Position = UDim2.fromOffset(8, 54), Color = C(25, 25, 30), Corner = 6, StrokeWidth = 2, Parent = f })
	local pFill = Theme.block({ Size = UDim2.fromScale(0, 1), Gradient = Theme.G.teal, Corner = 6, StrokeWidth = 0, Parent = pBar })
	local fishIcon = Theme.text({ Text = "🐟", Size = UDim2.fromOffset(26, 26), Position = UDim2.fromScale(0, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), Max = 24, Stroke = 0, ZIndex = 4, Parent = pBar })
	local fs = new("UIScale", { Parent = f })
	local ui = {}
	function ui.show(difficulty)
		f.Visible = true
		fs.Scale = 0.5
		Theme.tween(fs, 0.3, { Scale = 1 }, Enum.EasingStyle.Back)
		title.Text = if difficulty >= 4 then "A HEAVY FISH! Hold REEL, release when red!" else "HOLD REEL! Release when the line is red!"
	end
	function ui.hide()
		f.Visible = false
	end
	function ui.update(r)
		tFill.Size = UDim2.fromScale(r.tension, 1)
		tFill.BackgroundColor3 = C(80, 255, 80):Lerp(C(255, 40, 40), math.clamp((r.tension - 0.4) / 0.5, 0, 1))
		pFill.Size = UDim2.fromScale(r.progress, 1)
		fishIcon.Position = UDim2.fromScale(r.progress, 0.5)
		fishIcon.Rotation = math.sin(os.clock() * 20) * 15 * r.tension
		f.Rotation = if r.tension > 0.82 then math.sin(os.clock() * 60) * 1.5 else 0
	end
	return ui
end

-- training popups ---------------------------------------------------------------------
function HUD.popup(text: string, color: Color3?)
	local t = Theme.text({ Text = text, Size = UDim2.fromOffset(160, 30), Position = UDim2.new(0.5, math.random(-60, 60), 0.5, -40), AnchorPoint = Vector2.new(0.5, 0.5), Max = 26, Color = color or C(255, 140, 80), Font = Theme.FontBold, Parent = gui })
	local s = new("UIScale", { Scale = 0.4, Parent = t })
	Theme.tween(s, 0.25, { Scale = 1 }, Enum.EasingStyle.Back)
	Theme.tween(t, 0.9, { Position = t.Position - UDim2.fromOffset(0, 60) }, Enum.EasingStyle.Quad)
	task.delay(0.6, function()
		Theme.tween(t, 0.3, { TextTransparency = 1 })
		local st = t:FindFirstChildOfClass("UIStroke")
		if st then Theme.tween(st, 0.3, { Transparency = 1 }) end
		task.wait(0.32)
		t:Destroy()
	end)
end

-- data rendering ---------------------------------------------------------------------------
local shownMoney = 0
function HUD.renderStats()
	local d = Data.values
	local lvl = d.strength or 1
	refs.strength.Text = ("Lv %d  ·  %d studs"):format(lvl, math.floor(E.Strength.maxDistance(lvl)))
	local need = E.Strength.repsNeeded(lvl)
	Theme.tween(refs.repFill, 0.2, { Size = UDim2.fromScale(math.clamp((d.strengthReps or 0) / need, 0, 1), 1) })
	local rate = player:GetAttribute("Income") or 0
	refs.income.Text = if rate > 0 then "+" .. Format.perSec(rate) else ""
	-- capacity panel header
	local placed = 0
	for _, b in d.bears or {} do if b.placed then placed += 1 end end
	local cap = Formulas.capacity(d.capacity or 1)
	refs.panelTitle.Text = ("%d/%d Active"):format(placed, cap)
	refs.slotLabel.Text = if (d.capacity or 1) >= E.Capacity.maxLevel then "MAX" else ("+1 [%s]"):format(Format.money(E.Capacity.cost(d.capacity or 1)))
	-- badges
	local pend = d.indexPending or {}
	refs.indexBadge.Visible = (pend.Fish or 0) + (pend.Bears or 0) > 0
	local daily = d.daily
	refs.dailyBadge.Visible = daily ~= nil and os.time() - (daily.last or 0) >= E.Daily.cooldown
	local nextRod
	for _, id in RodConfig.Order do
		if not (d.rods and d.rods.owned[id]) then nextRod = RodConfig.get(id) break end
	end
	refs.shopBadge.Visible = (nextRod ~= nil and (d.money or 0) >= nextRod.price) or (d.money or 0) >= E.Strength.cost(lvl)
end

function HUD.mount(g: ScreenGui)
	gui = g
	buildTitle()
	buildLeft()
	buildRight()
	buildStats()
	buildHotbar()
	buildSpeed()
	buildAction()
	buildMeter()
	HUD.reelUI = buildReel()

	Data.Changed:Connect(function(key)
		if key == "*" or key == "settings" then refs.renderLowFx() end
		if key == "strengthReps" and Data.ready then
			if (Data.values.strengthReps or 0) > 0 then HUD.popup("+1 💪") end
		end
		HUD.renderStats()
		HUD.renderHotbar()
		if key == "bears" or key == "*" then HUD.renderPanel() end
	end)
	Data.StateChanged:Connect(function() HUD.renderHotbar() end)
	player:GetAttributeChangedSignal("Income"):Connect(HUD.renderStats)

	-- frame loop: money count-up, timers, speed, hotbar holding state
	local acc = 0
	RunService.RenderStepped:Connect(function(dt)
		local target = Data.values.money or 0
		if math.abs(target - shownMoney) > 0.5 then
			local before = shownMoney
			shownMoney += (target - shownMoney) * math.min(1, dt * 8)
			if math.abs(target - shownMoney) < 1 then shownMoney = target end
			if target > before + 0.5 then
				refs.moneyScale.Scale = 1.08
			end
		end
		refs.moneyScale.Scale += (1 - refs.moneyScale.Scale) * math.min(1, dt * 10)
		refs.money.Text = Format.money(shownMoney)
		acc += dt
		if acc < 0.2 then return end
		acc = 0
		-- lucky lake timer (same maths as the server)
		local epoch = ReplicatedStorage:GetAttribute("LuckyEpoch")
		if epoch then
			local period, dur = E.Lucky.period, E.Lucky.duration
			local t = (workspace:GetServerTimeNow() - epoch) % period
			if t >= period - dur then
				refs.timer.Text = "🍀 LUCKY LAKE! x2 luck · ends in " .. Format.time(period - t)
				refs.timer.TextColor3 = Color3.fromHSV((os.clock() * 0.3) % 1, 0.6, 1)
			else
				refs.timer.Text = "🍀 Lucky Lake in " .. Format.time(period - dur - t)
				refs.timer.TextColor3 = C(255, 255, 255)
			end
		end
		local char = player.Character
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		refs.speed.Text = "👟 " .. (if hum then math.floor(hum.WalkSpeed + 0.5) else 0)
		HUD.renderHotbar()
	end)
	HUD.renderStats()
end

-- keyboard shortcuts 1 / 2 / 3
UserInputService.InputBegan:Connect(function(input, gp)
	if gp then return end
	if input.KeyCode == Enum.KeyCode.One then
		Net.event("EquipSlot"):FireServer("Rod")
	elseif input.KeyCode == Enum.KeyCode.Two then
		Net.event("EquipSlot"):FireServer("Fish")
	elseif input.KeyCode == Enum.KeyCode.Three then
		if HUD.menus then HUD.menus.open("Bears") end
	end
end)

HUD.touch = touch
return HUD
