--[[ HUD: permanent interface, same layout as before (reference screenshots), rebuilt with the
     Stud UI kit: real stud texture, 3D bevel buttons, sticker icons, extruded outlined text.
       top centre  : title + "Lucky Lake" timer pill
       left middle : SHOP / INDEX (+ badges) and the Low FX switch
       right middle: Gifts / Daily / Bears tiles + red ">" tab -> "Bears in base" panel
       bottom left : strength (level, distance, training bar) + money (+$/s)
       bottom mid  : hotbar slots (real 3D models on spinning sunbursts), Bag / Store
       bottom right: speed + the big contextual action button
     plus the throw power meter and the reel mini-game. ]]
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
local RarityConfig = require(Shared.Config.RarityConfig)
local RodConfig = require(Shared.Config.RodConfig)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local K = require(script.Parent.Kit)
local Data = require(script.Parent.Parent.Controllers.Data)
local Actions = require(script.Parent.Parent.Controllers.Actions)
local Sound = require(script.Parent.Parent.Controllers.Sound)
local Fx = require(script.Parent.Parent.Controllers.Fx)

local UI, Motion = K.UI, K.Motion
local HUD = {}
local player = Players.LocalPlayer
local RGB = Color3.fromRGB
HUD.menus = nil -- set by ClientMain

local gui: ScreenGui
local refs = {}

-- refs to extruded labels are {texte, ombre} pairs
local function setShadowText(pair, text: string)
	pair[1].Text = text
	if pair[2] then pair[2].Text = text end
end

local function tween(o, t, goal, style, dir)
	local tw = TweenService:Create(o, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), goal)
	tw:Play()
	return tw
end

------------------------------------------------------------------------------------------
-- title + timer
------------------------------------------------------------------------------------------
local function buildTitle()
	local root = K.root(gui, "Title", Vector2.new(520, 110), UDim2.new(0.5, 0, 0, 2), Vector2.new(0.5, 0), 0.85)
	local words = {
		{ "THROW", UI.seq(RGB(140, 220, 255), RGB(40, 120, 255)) },
		{ "FISH", UI.seq(RGB(200, 255, 120), RGB(40, 200, 40)) },
		{ "FOR", UI.seq(RGB(255, 240, 120), RGB(255, 160, 0)) },
		{ "BEARS", UI.seq(RGB(255, 150, 220), RGB(220, 30, 160)) },
	}
	local row = UI.new("Frame", { Name = "Row", BackgroundTransparency = 1, Size = UDim2.fromOffset(520, 56), Position = UDim2.fromOffset(0, 4) }, root)
	UI.new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Center,
		Padding = UDim.new(0, 10), SortOrder = Enum.SortOrder.LayoutOrder }, row)
	refs.titleWords = {}
	for i, w in words do
		local holder = UI.new("Frame", { Name = w[1], BackgroundTransparency = 1, Size = UDim2.fromOffset(#w[1] * 26 + 6, 56), LayoutOrder = i }, row)
		UI.ShadowText(holder, w[1], { Font = "Heavy", TextSize = 46, Stroke = RGB(14, 10, 30), Thickness = 3.6, Gradient = w[2],
			Size = UDim2.fromScale(1, 1), Position = UDim2.fromScale(0.5, 0.5), ZIndex = 2 })
		table.insert(refs.titleWords, holder)
	end
	refs.timerPill = UI.Pill(root, "", { Width = 330, Height = 32, Position = UDim2.new(0.5, 0, 0, 80), ZIndex = 5 })
end

------------------------------------------------------------------------------------------
-- left column
------------------------------------------------------------------------------------------
local function buildLeft()
	local root = K.root(gui, "Left", Vector2.new(230, 230), UDim2.new(0, 14, 0.45, 0), Vector2.new(0, 0.5))
	local shop = K.button(root, { Name = "Shop", Theme = "green", Size = Vector2.new(206, 66), Position = UDim2.fromOffset(103, 36),
		Text = "Shop", TextSize = 34, Icon = K.Icons.Shop }, function() HUD.menus.open("Shop") end)
	local index = K.button(root, { Name = "Index", Theme = "blue", Size = Vector2.new(206, 66), Position = UDim2.fromOffset(103, 114),
		Text = "Index", TextSize = 34, Icon = K.Icons.Index }, function() HUD.menus.open("Index") end)
	refs.shopBadge = UI.NotifBadge(shop)
	refs.indexBadge = UI.NotifBadge(index)
	Motion.PulseScale(refs.shopBadge.Pulse)
	Motion.PulseScale(refs.indexBadge.Pulse)
	K.shine(shop, 3.5)
	K.shine(index, 4.5)
	-- Low FX switch (reference "Mode lent")
	local sw = UI.new("ImageButton", { Name = "LowFx", AutoButtonColor = false, Image = "", BackgroundColor3 = RGB(30, 34, 40),
		Size = UDim2.fromOffset(78, 40), Position = UDim2.fromOffset(4, 168), BorderSizePixel = 0 }, root)
	UI.Corner(sw, 6)
	UI.Stroke(sw, RGB(8, 10, 12), 3)
	UI.StudsFlat(sw, 1, 0.85)
	local knob = UI.Button(sw, { Name = "Knob", Theme = "red", Size = Vector2.new(34, 32), Position = UDim2.fromOffset(21, 20), Studs = false })
	knob.Active = false
	UI.ShadowText(root, "Low FX", { Font = "Gotham", TextSize = 24, Stroke = RGB(12, 20, 26), Thickness = 3,
		AlignX = Enum.TextXAlignment.Left, AnchorPoint = Vector2.new(0, 0.5), Size = UDim2.fromOffset(120, 30), Position = UDim2.fromOffset(92, 188), ZIndex = 2 })
	Motion.BindButton(sw, 1.05, K.sounds)
	local onToggle
	local function render()
		local on = Data.values.settings and Data.values.settings.lowFx == true
		Fx.low = on
		tween(knob, 0.22, { Position = UDim2.fromOffset(if on then 57 else 21, 20) }, Enum.EasingStyle.Back)
		UI.Recolor(knob, if on then "green" else "red")
	end
	onToggle = function()
		local on = not (Data.values.settings and Data.values.settings.lowFx)
		Data.values.settings = Data.values.settings or {}
		Data.values.settings.lowFx = on
		render()
		Net.event("SetSetting"):FireServer("lowFx", on)
	end
	sw.Activated:Connect(onToggle)
	knob.Activated:Connect(onToggle)
	refs.renderLowFx = render
end

------------------------------------------------------------------------------------------
-- right column + bears panel
------------------------------------------------------------------------------------------
local function buildRight()
	local root = K.root(gui, "Right", Vector2.new(400, 330), UDim2.new(1, -12, 0.45, 0), Vector2.new(1, 0.5))
	local tiles = UI.new("Frame", { Name = "Tiles", BackgroundTransparency = 1, Size = UDim2.fromOffset(96, 320), Position = UDim2.fromOffset(304, 5) }, root)
	local function tile(name, theme, icon, y, open)
		local b = K.button(tiles, { Name = name, Theme = theme, Size = Vector2.new(92, 92), Position = UDim2.fromOffset(48, y),
			Text = name, IconLayout = "Big", Icon = icon, TextSize = 24, Hover = 1.06 }, function() HUD.menus.open(open) end)
		local badge = UI.NotifBadge(b)
		badge.Visible = false
		Motion.PulseScale(badge.Pulse)

		return b, badge
	end
	local _, giftBadge = tile("Gifts", "red", K.Icons.Gift, 52, "Rewards")
	local _, dailyBadge = tile("Daily", "yellow", K.Icons.Daily, 158, "Daily")
	tile("Bears", "blue", K.Icons.Paw, 264, "Bears")
	refs.giftBadge = giftBadge
	refs.dailyBadge = dailyBadge

	local tab = K.button(root, { Name = "PanelTab", Theme = "red", Size = Vector2.new(44, 66), Position = UDim2.fromOffset(266, 158), Text = ">", TextSize = 36 })
	-- panel: dark glass + gold stud header (reference "7/9 Actifs" panel)
	local panel = UI.new("Frame", { Name = "BearsPanel", BackgroundTransparency = 1, Size = UDim2.fromOffset(330, 320),
		Position = UDim2.fromOffset(70, 5), Visible = false }, root)
	local body = UI.new("Frame", { Name = "Corps", BackgroundColor3 = RGB(50, 50, 56), BackgroundTransparency = 0.03, BorderSizePixel = 0,
		Size = UDim2.fromOffset(330, 270), Position = UDim2.fromOffset(0, 0) }, panel)
	UI.Corner(body, 4)
	UI.Stroke(body, RGB(2, 4, 3), 3)
	UI.StudsDark(body, 1, 36)
	local head = UI.StudPanel(panel, { Name = "Head", Size = UDim2.fromOffset(322, 46), Position = UDim2.fromOffset(4, 4), Gradient = "gold", ZIndex = 3 })
	refs.panelTitle = UI.Text(head, "0/5 Active", { Size = UDim2.fromOffset(160, 36), Position = UDim2.fromOffset(12, 23), AnchorPoint = Vector2.new(0, 0.5),
		AlignX = Enum.TextXAlignment.Left, TextSize = 26, Stroke = RGB(70, 40, 0), Thickness = 3, ZIndex = 6 })
	refs.slotButton = K.button(head, { Name = "Slot", Style = "Glossy", Theme = "cash", Size = Vector2.new(140, 36), Position = UDim2.fromOffset(246, 23),
		Text = "+1 Slot", FixedTextSize = 19, ZIndex = 6 }, function() Net.event("UpgradeCapacity"):FireServer() end)
	refs.panelList = UI.ScrollList(panel, { Size = UDim2.fromOffset(322, 210), Position = UDim2.fromOffset(4, 56), Padding = 6, PadTop = 4, PadLeft = 4, ZIndex = 3 })
	K.button(panel, { Name = "PlaceBest", Theme = "green", Size = Vector2.new(300, 46), Position = UDim2.fromOffset(165, 294),
		Text = "Place Best", TextSize = 28 }, function() Net.event("PlaceBest"):FireServer() end)

	tab.Activated:Connect(function()
		local open = not panel.Visible
		panel.Visible = open
		tiles.Visible = not open
		tab.Position = UDim2.fromOffset(if open then 40 else 266, 158)
		UI.SetButtonText(tab, if open then "<" else ">")
		if open then
			local sc = panel:FindFirstChild("PopScale") or UI.new("UIScale", { Name = "PopScale" }, panel)
			sc.Scale = 0.75
			tween(sc, 0.32, { Scale = 1 }, Enum.EasingStyle.Back)
			HUD.renderPanel()
		end
	end)
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
		local tier = RarityConfig.get(b.r)
		local rk = UI.Rarities[K.rarityKey(b.r)] or UI.Rarities.Common
		local row = UI.StudPanel(list, { Name = "Row" .. i, Size = UDim2.fromOffset(308, 62), Gradient = "amber", ZIndex = 4, LayoutOrder = i })
		local slot = UI.ItemSlot(row, { Size = Vector2.new(52, 52), Position = UDim2.fromOffset(5, 5), Title = "", Button = false, ZIndex = 5 })
		K.model(slot, { kind = "Bear", id = b.s, variant = b.v, size = UDim2.fromScale(0.95, 0.95), position = UDim2.fromScale(0.5, 0.5) })
		UI.Text(row, BearConfig.get(b.s).name, { Size = UDim2.fromOffset(140, 24), Position = UDim2.fromOffset(64, 18), AnchorPoint = Vector2.new(0, 0.5),
			AlignX = Enum.TextXAlignment.Left, Max = 20, Gradient = rk.text, Stroke = RGB(30, 12, 0), Thickness = 2.4, ZIndex = 7 })
		UI.Text(row, "(" .. Format.perSec(Formulas.bearIncome(b)) .. ")", { Size = UDim2.fromOffset(140, 22), Position = UDim2.fromOffset(64, 42), AnchorPoint = Vector2.new(0, 0.5),
			AlignX = Enum.TextXAlignment.Left, Max = 18, Gradient = UI.TextGradients.Money, Stroke = RGB(15, 51, 0), Thickness = 2.4, ZIndex = 7 })
		K.button(row, { Name = "Pick", Theme = "red", Size = Vector2.new(92, 40), Position = UDim2.fromOffset(254, 31), Text = "Pick Up", TextSize = 18, ZIndex = 6 },
			function() Net.event("PickupBear"):FireServer(b.id) end)
		local _ = tier
	end
	K.cascade(list, 0.03)
end

------------------------------------------------------------------------------------------
-- bottom left stats
------------------------------------------------------------------------------------------
local function buildStats()
	local root = K.root(gui, "Stats", Vector2.new(420, 132), UDim2.new(0, 10, 1, -8), Vector2.new(0, 1))
	UI.Image(root, K.Icons.Upgrade, { Size = UDim2.fromOffset(42, 42), Position = UDim2.fromOffset(24, 24), Rotation = -8, ZIndex = 3 })
	refs.strength = { UI.ShadowText(root, "", { Font = "Gotham", TextSize = 32, Stroke = RGB(60, 6, 0), Thickness = 3,
		Gradient = UI.seq(RGB(255, 170, 120), RGB(255, 70, 40)), AlignX = Enum.TextXAlignment.Left, AnchorPoint = Vector2.zero,
		Size = UDim2.fromOffset(340, 38), Position = UDim2.fromOffset(52, 6), ZIndex = 2 }) }
	refs.repBar = UI.ProgressBar(root, { Size = UDim2.fromOffset(220, 20), Position = UDim2.fromOffset(54, 46), Progress = 0, Text = "", Max = 14, ZIndex = 3 })
	UI.Image(root, K.Icons.Cash, { Size = UDim2.fromOffset(50, 50), Position = UDim2.fromOffset(26, 100), Rotation = -8, ZIndex = 3 })
	local moneyHolder = UI.new("Frame", { Name = "Money", BackgroundTransparency = 1, AutomaticSize = Enum.AutomaticSize.X,
		Size = UDim2.fromOffset(0, 44), Position = UDim2.fromOffset(56, 76) }, root)
	refs.money = { UI.MoneyText(moneyHolder, "$0", { TextSize = 40 }) }
	refs.moneyScale = UI.new("UIScale", {}, moneyHolder)
	refs.income = { UI.ShadowText(root, "", { Font = "Gotham", TextSize = 28, Stroke = RGB(15, 51, 0), Thickness = 3, Gradient = UI.TextGradients.Money,
		AlignX = Enum.TextXAlignment.Left, AnchorPoint = Vector2.zero, Size = UDim2.fromOffset(200, 34), Position = UDim2.fromOffset(240, 86), ZIndex = 2 }) }
end

------------------------------------------------------------------------------------------
-- hotbar
------------------------------------------------------------------------------------------
local slots = {}
local iconKeys = {}
local function buildHotbar()
	local root = K.root(gui, "Hotbar", Vector2.new(320, 190), UDim2.new(0.5, 0, 1, -6), Vector2.new(0.5, 1))
	local row = UI.new("Frame", { Name = "Row", BackgroundTransparency = 1, Size = UDim2.fromOffset(320, 86), Position = UDim2.fromOffset(0, 104) }, root)
	UI.new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Center,
		VerticalAlignment = Enum.VerticalAlignment.Bottom, Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder }, row)
	for i = 1, 3 do
		local s = UI.ItemSlot(row, { Name = "Slot" .. i, LayoutOrder = i, Size = Vector2.new(86, 86), Title = "", Tag = tostring(i), TagColor = RGB(255, 255, 255), Quantity = "", TitleMax = 13 })
		Motion.BindButton(s, 1.06, K.sounds)
		slots[i] = s
	end
	Motion.SpinSunbursts(row, 25)
	slots[1].Activated:Connect(function() Net.event("EquipSlot"):FireServer("Rod") end)
	slots[2].Activated:Connect(function() Net.event("EquipSlot"):FireServer("Fish") end)
	slots[3].Activated:Connect(function() HUD.menus.open("Bears") end)
	refs.bag = K.button(root, { Name = "Bag", Theme = "purple", Size = Vector2.new(124, 44), Position = UDim2.fromOffset(160, 76),
		Text = "Bag", TextSize = 24, Icon = K.Icons.Bag }, function() HUD.menus.open("Bag") end)
	refs.store = K.button(root, { Name = "Store", Theme = "yellow", Size = Vector2.new(190, 48), Position = UDim2.fromOffset(160, 26),
		Text = "Store Bear", TextSize = 24, Icon = K.Icons.House }, function() Net.event("StoreBear"):FireServer() end)
	refs.store.Visible = false
	refs.hotbarRoot = root
end

local function setSlotModel(i: number, key: string?, opts)
	local s = slots[i]
	if iconKeys[i] == key then return end
	iconKeys[i] = key
	local old = s:FindFirstChild("Viewport")
	if old then old:Destroy() end
	if key and opts then
		opts.size = UDim2.fromScale(0.86, 0.86)
		opts.position = UDim2.fromScale(0.5, 0.44)
		K.model(s, opts)
		Motion.PopIn(s, 0.3)
	end
end

function HUD.renderHotbar()
	local d = Data.values
	local char = player.Character
	local holding = char and char:GetAttribute("Holding") or ""
	local isBear = char and char:GetAttribute("IsBear")
	local rodId = d.rods and d.rods.equipped or "Starter"
	setSlotModel(1, "rod:" .. rodId, { kind = "Rod", id = rodId, zoom = 0.85 })
	slots[1].Nom.Text = RodConfig.get(rodId).name
	local fish = Data.fishById(d.selectedFish) or (d.fish and d.fish[1])
	slots[2].Visible = fish ~= nil
	refs.bag.Visible = d.fish ~= nil and #d.fish > 0 and not isBear
	if fish then
		setSlotModel(2, "fish:" .. fish.s .. (fish.v or ""), { kind = "Fish", id = fish.s, variant = fish.v })
		slots[2].Nom.Text = FishConfig.get(fish.s).name
		slots[2].Quantite.Text = "x" .. #d.fish
	end
	local heldBear = holding == "Bear" and d.bears and d.bears[char:GetAttribute("HeldId")] or nil
	slots[3].Visible = heldBear ~= nil
	if heldBear then
		setSlotModel(3, "bear:" .. heldBear.s .. (heldBear.v or ""), { kind = "Bear", id = heldBear.s, variant = heldBear.v })
		slots[3].Nom.Text = BearConfig.get(heldBear.s).name
		slots[3].Quantite.Text = ""
	end
	local storeOn = Data.state == "CarryingCapturedBear"
	if storeOn ~= refs.store.Visible then
		refs.store.Visible = storeOn
		if storeOn then Motion.PopIn(refs.store, 0.35) end
	end
	for i, s in slots do
		local active = (i == 1 and holding == "Rod") or (i == 2 and holding == "Fish") or (i == 3 and holding == "Bear")
		local sel = s.Lisere.Selection
		if active and not sel.Enabled then
			sel.Enabled = true
			Motion.PulseStroke(sel)
		elseif not active and sel.Enabled then
			sel.Enabled = false
			Motion.StopIdle(sel)
		end
	end
	refs.hotbarRoot.Visible = not isBear
end

------------------------------------------------------------------------------------------
-- bottom right: speed + action button
------------------------------------------------------------------------------------------
local ACTION_THEME = { blue = "blue", grey = "gray", red = "red", orange = "orange", green = "green", yellow = "yellow" }
local function buildActionAndSpeed()
	local root = K.root(gui, "Action", Vector2.new(240, 230), UDim2.new(1, -10, 1, -8), Vector2.new(1, 1))
	UI.Image(root, K.Icons.Shoe, { Size = UDim2.fromOffset(40, 40), Position = UDim2.fromOffset(150, 206), Rotation = -8, ZIndex = 3 })
	refs.speed = { UI.ShadowText(root, "20", { Font = "Gotham", TextSize = 30, Stroke = RGB(2, 30, 60), Thickness = 3,
		Gradient = UI.seq(RGB(160, 230, 255), RGB(40, 140, 255)), AlignX = Enum.TextXAlignment.Left, AnchorPoint = Vector2.new(0, 0.5),
		Size = UDim2.fromOffset(70, 34), Position = UDim2.fromOffset(172, 206), ZIndex = 2 }) }
	local b = UI.Button(root, { Name = "ActionButton", Theme = "blue", Size = Vector2.new(170, 118), Position = UDim2.fromOffset(150, 110),
		Text = "CAST", TextSize = 38, Icon = K.Icons.Bait, IconLayout = "Top", IconSize = 0.62, ZIndex = 2 })
	b.Visible = false
	local sc = b.ButtonScale
	-- progress ring for hold actions (thick glowing stroke)
	local ring = UI.new("Frame", { Name = "Ring", BackgroundTransparency = 1, Size = UDim2.new(1, 12, 1, 12), Position = UDim2.fromScale(0.5, 0.5),
		AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 1 }, b)
	local ringStroke = UI.Stroke(ring, RGB(255, 240, 80), 4, 1)
	b.InputBegan:Connect(function(i)
		if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then
			tween(sc, 0.05, { Scale = 0.9 })
			Actions.press()
		end
	end)
	b.InputEnded:Connect(function(i)
		if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then
			tween(sc, 0.18, { Scale = 1 }, Enum.EasingStyle.Back)
			Actions.release()
		end
	end)
	local key = UI.Pill(b, "[E]", { Width = 54, Height = 24, Position = UDim2.new(0.5, 0, 0, -6), TextSize = 15, ZIndex = 12 })
	key.Visible = UserInputService.KeyboardEnabled
	refs.action = { button = b, ring = ringStroke, scale = sc }
	local icons = { Cast = K.Icons.Bait, Stop = K.Icons.Check, Hook = K.Icons.Lightning, Reel = K.Icons.Bait,
		Throw = K.Icons.Upgrade, Place = K.Icons.House, Sprint = K.Icons.Shoe }
	Actions.ContextChanged:Connect(function(ctx)
		local c = ctx and Actions.CONTEXTS[ctx]
		if not c then
			tween(sc, 0.14, { Scale = 0 }, Enum.EasingStyle.Back, Enum.EasingDirection.In)
			task.delay(0.15, function() if not Actions.context then b.Visible = false end end)
			return
		end
		b.Visible = true
		UI.SetButtonText(b, c.label)
		UI.Recolor(b, ACTION_THEME[c.color] or "blue")
		local ic = b:FindFirstChild("Icone")
		if ic then ic.Image = icons[ctx] or K.Icons.Bait end
		sc.Scale = 0.3
		tween(sc, 0.4, { Scale = 1 }, Enum.EasingStyle.Back)
		if ctx == "Hook" then
			Sound.play("Bite")
			Motion.Shake(b)
		end
	end)
	-- idle "breathing" + hook urgency
	RunService.RenderStepped:Connect(function()
		if not b.Visible then return end
		local t = os.clock()
		local ctx = Actions.context
		local ic = b:FindFirstChild("Icone")
		if ic then ic.Rotation = math.sin(t * 3) * 8 end
		if ctx == "Hook" then
			b.Rotation = math.sin(t * 40) * 3
			ringStroke.Transparency = 0
			ringStroke.Thickness = 4 + math.abs(math.sin(t * 10)) * 4
		elseif Actions.held and Actions.CONTEXTS[ctx or ""] and Actions.CONTEXTS[ctx].hold then
			b.Rotation = 0
			ringStroke.Transparency = 0.1
			ringStroke.Thickness = 3 + math.abs(math.sin(t * 8)) * 3
		else
			b.Rotation = 0
			ringStroke.Transparency = 1
		end
	end)
end

------------------------------------------------------------------------------------------
-- throw power meter
------------------------------------------------------------------------------------------
local function buildMeter()
	local root = K.root(gui, "PowerMeter", Vector2.new(80, 300), UDim2.new(0.5, 190, 0.5, 0), Vector2.new(0.5, 0.5))
	root.Visible = false
	local box = UI.InsetBox(root, { Size = UDim2.fromOffset(48, 240), Position = UDim2.fromOffset(16, 30), Color = UI.Colors.BarBg, Transparency = 0 })
	box.ClipsDescendants = true
	local fill = UI.new("Frame", { Name = "Fill", BackgroundColor3 = RGB(255, 255, 255), BorderSizePixel = 0, AnchorPoint = Vector2.new(0, 1),
		Position = UDim2.new(0, 3, 1, -3), Size = UDim2.new(1, -6, 0, 0), ZIndex = 4 }, box)
	UI.Corner(fill, 4)
	UI.Gradient(fill, UI.seq(RGB(255, 60, 40), RGB(255, 220, 40), RGB(110, 255, 60)), 90)
	UI.StudsFlat(fill, 5, 0.75)
	for k = 1, 3 do
		UI.new("Frame", { BackgroundColor3 = RGB(0, 0, 0), BackgroundTransparency = 0.4, BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 2),
			Position = UDim2.new(0, 0, k / 4, 0), ZIndex = 6 }, box)
	end
	refs.meterText = { UI.ShadowText(root, "", { Font = "Gotham", TextSize = 22, Stroke = RGB(12, 20, 26), Thickness = 3,
		Size = UDim2.fromOffset(160, 28), Position = UDim2.new(0.5, 0, 0, 12), ZIndex = 6 }) }
	UI.ShadowText(root, "POWER", { Font = "Gotham", TextSize = 20, Stroke = RGB(12, 20, 26), Thickness = 3,
		Size = UDim2.fromOffset(120, 24), Position = UDim2.new(0.5, 0, 1, -16), ZIndex = 6 })
	refs.meter = { root = root, fill = fill, pop = UI.new("UIScale", {}, box) }
end

function HUD.setCharge(power: number?)
	local m = refs.meter
	if not power then
		m.root.Visible = false
		return
	end
	if not m.root.Visible then
		m.root.Visible = true
		m.pop.Scale = 0.4
		tween(m.pop, 0.3, { Scale = 1 }, Enum.EasingStyle.Back)
	end
	m.fill.Size = UDim2.new(1, -6, power, -6 * power)
	local d = Data.values
	local fish = Data.fishById(player.Character and player.Character:GetAttribute("HeldId"))
	local dist = Formulas.throwDistance(power, d.strength or 1, fish and fish.w or 1)
	setShadowText(refs.meterText, math.floor(dist) .. " studs")
	m.root.Rotation = if power >= 1 then math.sin(os.clock() * 50) * 2.5 else 0
end

------------------------------------------------------------------------------------------
-- reel mini-game
------------------------------------------------------------------------------------------
local function buildReel()
	local root = K.root(gui, "Reel", Vector2.new(440, 150), UDim2.new(0.5, 0, 0.68, 0), Vector2.new(0.5, 0.5))
	root.Visible = false
	local panel = UI.StudPanel(root, { Size = UDim2.fromOffset(430, 140), Position = UDim2.fromOffset(5, 5), Gradient = "blue", ZIndex = 2 })
	local title = { UI.ShadowText(panel, "HOLD REEL!", { Font = "Gotham", TextSize = 24, Stroke = RGB(2, 20, 50), Thickness = 3,
		Size = UDim2.fromOffset(400, 28), Position = UDim2.new(0.5, 0, 0, 20), ZIndex = 6 }) }
	local tension = UI.ProgressBar(panel, { Size = UDim2.fromOffset(400, 30), Position = UDim2.fromOffset(15, 40), Progress = 0, Text = "TENSION", Max = 18, ZIndex = 4,
		Fill = UI.seq(RGB(110, 255, 60), RGB(40, 200, 40)) })
	local danger = UI.new("Frame", { BackgroundColor3 = RGB(255, 40, 40), BackgroundTransparency = 0.5, BorderSizePixel = 0,
		Size = UDim2.fromScale(0.18, 1), Position = UDim2.fromScale(0.82, 0), ZIndex = 5 }, tension)
	local _ = danger
	local prog = UI.ProgressBar(panel, { Size = UDim2.fromOffset(400, 34), Position = UDim2.fromOffset(15, 86), Progress = 0, Text = "", Max = 18, ZIndex = 4,
		Fill = UI.seq(RGB(120, 230, 255), RGB(30, 130, 255)) })
	local fishIcon = UI.Image(prog, K.Icons.Bait, { Size = UDim2.fromOffset(40, 40), Position = UDim2.fromScale(0, 0.5), ZIndex = 9 })
	local pop = UI.new("UIScale", {}, panel)
	local ui = {}
	function ui.show(difficulty)
		root.Visible = true
		pop.Scale = 0.4
		tween(pop, 0.35, { Scale = 1 }, Enum.EasingStyle.Back)
		local text = if difficulty >= 4 then "HEAVY FISH! Hold REEL, release on red!" else "HOLD REEL! Release when red!"
		setShadowText(title, text)
	end
	function ui.hide()
		root.Visible = false
	end
	function ui.update(r)
		tension.Remplissage.Size = UDim2.new(r.tension, 0, 1, 0)
		tension.Remplissage.BackgroundColor3 = RGB(255, 255, 255):Lerp(RGB(255, 120, 120), math.clamp((r.tension - 0.5) * 2, 0, 1))
		prog.Remplissage.Size = UDim2.new(r.progress, 0, 1, 0)
		fishIcon.Position = UDim2.fromScale(r.progress, 0.5)
		fishIcon.Rotation = math.sin(os.clock() * 22) * 18 * (0.3 + r.tension)
		panel.Rotation = if r.tension > 0.82 then math.sin(os.clock() * 60) * 1.6 else 0
	end
	return ui
end

------------------------------------------------------------------------------------------
-- floating popups (training reps, level ups)
------------------------------------------------------------------------------------------
function HUD.popup(text: string, color: Color3?)
	local holder = UI.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(260, 44),
		Position = UDim2.new(0.5, math.random(-80, 80), 0.46, 0), AnchorPoint = Vector2.new(0.5, 0.5) }, gui)
	local sc = UI.new("UIScale", { Scale = 0.3 }, holder)
	UI.ShadowText(holder, text, { Font = "Gotham", TextSize = 34, Stroke = RGB(60, 10, 0), Thickness = 3.2,
		Gradient = if color then UI.seq(color:Lerp(RGB(255, 255, 255), 0.5), color) else UI.seq(RGB(255, 210, 120), RGB(255, 100, 40)),
		Size = UDim2.fromScale(1, 1), ZIndex = 30 })
	tween(sc, 0.3, { Scale = 1.15 }, Enum.EasingStyle.Back)
	tween(holder, 1.0, { Position = holder.Position - UDim2.fromOffset(0, 80), Rotation = math.random(-8, 8) })
	task.delay(0.65, function()
		for _, t in holder:GetDescendants() do
			if t:IsA("TextLabel") then tween(t, 0.3, { TextTransparency = 1 }) end
			if t:IsA("UIStroke") then tween(t, 0.3, { Transparency = 1 }) end
		end
		task.wait(0.32)
		holder:Destroy()
	end)
end

------------------------------------------------------------------------------------------
-- data rendering
------------------------------------------------------------------------------------------

function HUD.renderStats()
	local d = Data.values
	local lvl = d.strength or 1
	setShadowText(refs.strength, ("Lv %d  (%d studs)"):format(lvl, math.floor(E.Strength.maxDistance(lvl))))
	local need = E.Strength.repsNeeded(lvl)
	local reps = d.strengthReps or 0
	tween(refs.repBar.Remplissage, 0.25, { Size = UDim2.new(math.clamp(reps / need, 0, 1), 0, 1, 0) })
	refs.repBar.Valeur.Text = ("%d/%d"):format(reps, need)
	local rate = player:GetAttribute("Income") or 0
	setShadowText(refs.income, if rate > 0 then "+" .. Format.perSec(rate) else "")
	local placed = 0
	for _, b in d.bears or {} do if b.placed then placed += 1 end end
	refs.panelTitle.Text = ("%d/%d Active"):format(placed, Formulas.capacity(d.capacity or 1))
	UI.SetButtonText(refs.slotButton, if (d.capacity or 1) >= E.Capacity.maxLevel then "MAX" else "+1 [" .. Format.money(E.Capacity.cost(d.capacity or 1)) .. "]")
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

function HUD.setGiftBadge(on: boolean)
	if refs.giftBadge then refs.giftBadge.Visible = on end
end

function HUD.mount(g: ScreenGui)
	gui = g
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
		if key == "strengthReps" and Data.ready and (Data.values.strengthReps or 0) > 0 then
			HUD.popup("+1 STRENGTH")
		end
		HUD.renderStats()
		HUD.renderHotbar()
		if key == "bears" or key == "*" then HUD.renderPanel() end
	end)
	Data.StateChanged:Connect(function() HUD.renderHotbar() end)
	player:GetAttributeChangedSignal("Income"):Connect(HUD.renderStats)

	local shown = 0
	local acc = 0
	RunService.RenderStepped:Connect(function(dt)
		local t = os.clock()
		-- title words bob in a wave
		for i, w in refs.titleWords do
			w.Rotation = math.sin(t * 1.5 + i * 0.8) * 1.2
		end
		-- money count-up with a bounce on gains
		local target = Data.values.money or 0
		if math.abs(target - shown) > 0.5 then
			if target > shown + 0.5 then refs.moneyScale.Scale = 1.12 end
			shown += (target - shown) * math.min(1, dt * 8)
			if math.abs(target - shown) < 1 then shown = target end
			setShadowText(refs.money, Format.money(shown))
		end
		refs.moneyScale.Scale += (1 - refs.moneyScale.Scale) * math.min(1, dt * 9)
		acc += dt
		if acc < 0.2 then return end
		acc = 0
		local epoch = ReplicatedStorage:GetAttribute("LuckyEpoch")
		if epoch then
			local period, dur = E.Lucky.period, E.Lucky.duration
			local lt = (workspace:GetServerTimeNow() - epoch) % period
			local pillText = refs.timerPill:FindFirstChild("Texte")
			if pillText then
				if lt >= period - dur then
					pillText.Text = ('<font color="#7CFF5A">LUCKY LAKE x2!</font> ends in <font color="#FFD23F">%s</font>'):format(Format.time(period - lt))
				else
					pillText.Text = ('Lucky Lake in <font color="#FFD23F">%s</font>'):format(Format.time(period - dur - lt))
				end
			end
		end
		local char = player.Character
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		setShadowText(refs.speed, tostring(if hum then math.floor(hum.WalkSpeed + 0.5) else 0))
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
		if HUD.menus then HUD.menus.open("Bears") end
	end
end)

return HUD
