--[[ Menus: every window, built with the Stud UI kit (exactly the reference "Nest Shop" style):
     stud header (pink shop texture / coloured stud header), overflowing tilted icon, big outlined
     title, chunky red X, dark glass body with the world blurred behind, product cards with rarity
     stud panels, glossy $ buttons, item slots with spinning sunbursts, bouncy open / close.
       Shop  : Rods (HORIZONTAL row of rod cards) / Strength / Base tabs in the header
       Sell  : fish product cards, one SELL button each + "Sell All"
       Bag   : fish slots, tap one to hold it
       Index : Fish / Bears tabs on the right, silhouettes for undiscovered, progress + claim
       Bears : collection cards (Pick Up / Place / Sell)
       Daily : 7 stud tiles + claim        Gifts : session gifts        Confirm dialog ]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local E = require(Shared.Config.EconomyConfig)
local FishConfig = require(Shared.Config.FishConfig)
local BearConfig = require(Shared.Config.BearConfig)
local RodConfig = require(Shared.Config.RodConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local K = require(script.Parent.Kit)
local Data = require(script.Parent.Parent.Controllers.Data)

local UI, Motion = K.UI, K.Motion
local Menus = {}
local player = Players.LocalPlayer
local RGB = Color3.fromRGB
local windows = {} -- name -> { gui, win, menu, content }
local renderers = {}
local KEEP = { Overlay = true, ReturnHUD = true }
local PANELS = { "cyan", "violet", "amber", "lime", "pink", "cosmic", "gold", "blue" }

local function clear(frame: Instance)
	for _, c in frame:GetChildren() do
		if c:IsA("GuiObject") then c:Destroy() end
	end
end

local function rarityOf(r: string)
	return UI.Rarities[K.rarityKey(r)] or UI.Rarities.Common
end

local function makeWindow(name: string, opts)
	local gui = UI.ScreenGui("Menu" .. name, 11, { Parent = player:WaitForChild("PlayerGui") })
	local win = UI.Window(gui, {
		Size = opts.size, Title = opts.title, Header = opts.header, Icon = opts.icon, TitleWidth = opts.titleWidth,
	})
	local menu = Motion.Window(gui, win.Fenetre, { Keep = KEEP, OnOpen = function()
		if renderers[name] then renderers[name](true) end
	end })
	local content = UI.new("Frame", { Name = "Content", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 2 }, win.Corps)
	if win.Icone and win.Icone.Name == "Panier" then Motion.Sway(win.Icone, 2, 1.2) end
	local w = { gui = gui, win = win, menu = menu, content = content }
	windows[name] = w
	return w
end

local function shadow(parent, text, p)
	return { UI.ShadowText(parent, text, p) }
end

------------------------------------------------------------------------------------------
-- Confirm
------------------------------------------------------------------------------------------
local confirmCb
local function buildConfirm()
	local w = makeWindow("Confirm", { size = Vector2.new(500, 290), title = "Are you sure?", header = "pink", titleWidth = 380 })
	w.msg = UI.Text(w.content, "", { Size = UDim2.fromOffset(460, 100), Position = UDim2.new(0.5, 0, 0, 62), Max = 26, ZIndex = 6 })
	w.msg.TextWrapped = true
	K.button(w.content, { Theme = "green", Size = Vector2.new(200, 64), Position = UDim2.fromOffset(130, 160), Text = "YES", TextSize = 34 }, function()
		local cb = confirmCb
		confirmCb = nil
		w.menu.Close()
		if cb then cb() end
	end)
	K.button(w.content, { Theme = "red", Size = Vector2.new(200, 64), Position = UDim2.fromOffset(365, 160), Text = "NO", TextSize = 34 }, function()
		confirmCb = nil
		w.menu.Close()
	end)
end

function Menus.confirm(text: string, onYes)
	local w = windows.Confirm
	confirmCb = onYes
	w.msg.Text = text
	w.menu.Open()
end

------------------------------------------------------------------------------------------
-- Shop: Rods (horizontal) / Strength / Base
------------------------------------------------------------------------------------------
local shopTab = "Rods"
local function buildShop()
	local w = makeWindow("Shop", { size = Vector2.new(820, 520), title = "Shop", header = "image", icon = K.Icons.Basket, titleWidth = 220 })
	local tabs = {}
	for i, name in { "Rods", "Strength", "Base" } do
		tabs[name] = K.button(w.win.Entete, { Name = "Tab" .. name, Style = "Chunky", Theme = "orange", Size = Vector2.new(124, 54),
			Position = UDim2.fromOffset(372 + (i - 1) * 132, 36), Text = name, FixedTextSize = 26, ZIndex = 8 }, function()
			shopTab = name
			renderers.Shop(true)
		end)
	end
	w.pill = UI.Pill(w.win.Fenetre, "", { Width = 300, Height = 30, Position = UDim2.new(0.5, 0, 0, w.win.HeaderHeight), ZIndex = 20 })
	local body = w.content

	local function rodsTab(animate)
		local d = Data.values
		local list = UI.ScrollList(body, { Size = UDim2.fromOffset(805, 425), Position = UDim2.fromOffset(4, 4), Direction = "X",
			Padding = 12, PadTop = 22, PadLeft = 12, PadRight = 12, ZIndex = 2 })
		for i, id in RodConfig.Order do
			local rod = RodConfig.get(id)
			local owned = d.rods and d.rods.owned[id]
			local equipped = d.rods and d.rods.equipped == id
			local card = UI.new("Frame", { Name = "Rod" .. i, BackgroundTransparency = 1, Size = UDim2.fromOffset(226, 384), LayoutOrder = i, ZIndex = 2 }, list)
			local inside = UI.new("Frame", { Name = "Interieur", BackgroundColor3 = RGB(64, 64, 72), BackgroundTransparency = 0.05, BorderSizePixel = 0,
				Size = UDim2.fromOffset(217, 375), Position = UDim2.fromOffset(4, 4), ZIndex = 2 }, card)
			UI.StudsDark(inside, 2, 34)
			UI.Stroke(UI.new("Frame", { Name = "BordNoir", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 3 }, card), RGB(4, 4, 4), 2.5)
			UI.Stroke(UI.new("Frame", { Name = "BordClair", BackgroundTransparency = 1, Size = UDim2.new(1, -5, 1, -5), Position = UDim2.fromOffset(2, 2), ZIndex = 3 }, card), Color3.new(1, 1, 1), 2.2, 0.25)
			local panel = UI.StudPanel(card, { Name = "Panneau", Size = UDim2.fromOffset(206, 168), Position = UDim2.fromOffset(10, 10),
				Gradient = PANELS[(i - 1) % #PANELS + 1], ZIndex = 3 })
			panel.ClipsDescendants = true
			UI.Sunburst(panel, 300, { Position = UDim2.fromScale(0.5, 0.5), Transparency = 0.5, ZIndex = 4 })
			K.model(panel, { kind = "Rod", id = id, spin = true, spinSpeed = 0.7, zoom = 0.78, size = UDim2.fromScale(1.05, 1.05), position = UDim2.fromScale(0.5, 0.5), zindex = 6 })
			if equipped then
				UI.Image(panel, K.Icons.Check, { Size = UDim2.fromOffset(44, 44), Position = UDim2.new(1, -24, 0, 24), ZIndex = 9 })
			end
			UI.Text(card, rod.name, { Name = "Nom", Size = UDim2.fromOffset(206, 34), Position = UDim2.fromOffset(113, 200), Max = 28,
				Stroke = UI.Colors.StrokeCard, Thickness = 2.8, ZIndex = 7 })
			UI.Text(card, ("Speed x%.2f"):format(rod.speed), { Size = UDim2.fromOffset(200, 26), Position = UDim2.fromOffset(113, 234), TextSize = 21,
				Gradient = UI.seq(RGB(160, 230, 255), RGB(50, 150, 255)), Stroke = RGB(2, 20, 50), Thickness = 2.4, ZIndex = 7 })
			UI.Text(card, ("Luck x%.2f"):format(rod.luck), { Size = UDim2.fromOffset(200, 26), Position = UDim2.fromOffset(113, 260), TextSize = 21,
				Gradient = UI.TextGradients.Owned, Stroke = RGB(10, 40, 4), Thickness = 2.4, ZIndex = 7 })
			local desc = UI.Text(card, rod.desc, { Font = "Bold", Size = UDim2.fromOffset(200, 36), Position = UDim2.fromOffset(113, 294), Max = 15,
				Stroke = UI.Colors.StrokeCard, Thickness = 2, ZIndex = 7 })
			desc.TextWrapped = true
			local bp = { Size = Vector2.new(196, 52), Position = UDim2.fromOffset(113, 346), ZIndex = 5 }
			if equipped then
				bp.Theme = "gray"; bp.Text = "EQUIPPED"; bp.TextSize = 24
				K.button(card, bp)
			elseif owned then
				bp.Theme = "blue"; bp.Text = "EQUIP"; bp.TextSize = 28
				K.button(card, bp, function() Net.event("EquipRod"):FireServer(id) end)
			else
				bp.Style = "Glossy"; bp.Theme = "cash"; bp.Text = Format.money(rod.price); bp.FixedTextSize = 30
				local b = K.button(card, bp, function() Net.event("BuyRod"):FireServer(id) end)
				if (d.money or 0) < rod.price then UI.SetDisabled(b, true) else K.shine(b, 2.5) end
			end
		end
		if animate then K.cascade(list, 0.045) end
	end

	local function statPage(animate, cfg)
		local panel = UI.StudPanel(body, { Size = UDim2.fromOffset(280, 380), Position = UDim2.fromOffset(18, 22), Gradient = cfg.panel, ZIndex = 3 })
		panel.ClipsDescendants = true
		local sun = UI.Sunburst(panel, 420, { Position = UDim2.fromScale(0.5, 0.42), Transparency = 0.45, ZIndex = 4 })
		local _ = sun
		local ic = UI.Image(panel, cfg.icon, { Size = UDim2.fromOffset(170, 170), Position = UDim2.fromScale(0.5, 0.4), Rotation = -8, ZIndex = 6 })

		shadow(panel, cfg.big, { Font = "Heavy", TextSize = 44, Stroke = RGB(12, 20, 26), Thickness = 4, Size = UDim2.fromOffset(260, 54),
			Position = UDim2.new(0.5, 0, 1, -50), ZIndex = 8 })
		local box = UI.InsetBox(body, { Size = UDim2.fromOffset(470, 250), Position = UDim2.fromOffset(318, 22), ZIndex = 3 })
		UI.Text(box, cfg.title, { Size = UDim2.fromOffset(440, 40), Position = UDim2.fromOffset(235, 30), TextSize = 32, Thickness = 3, ZIndex = 6 })
		for i, row in cfg.rows do
			local y = 76 + (i - 1) * 54
			UI.Text(box, row[1], { Size = UDim2.fromOffset(220, 32), Position = UDim2.fromOffset(20, y), AnchorPoint = Vector2.new(0, 0.5),
				AlignX = Enum.TextXAlignment.Left, TextSize = 22, ZIndex = 6 })
			UI.Text(box, row[2], { Size = UDim2.fromOffset(240, 32), Position = UDim2.fromOffset(450, y), AnchorPoint = Vector2.new(1, 0.5),
				AlignX = Enum.TextXAlignment.Right, TextSize = 24, Gradient = UI.TextGradients.Money, Stroke = RGB(15, 51, 0), ZIndex = 6 })
		end
		local b = K.button(body, { Theme = cfg.can and "green" or "gray", Size = Vector2.new(470, 78), Position = UDim2.fromOffset(553, 330),
			Text = cfg.button, TextSize = 34, Icon = K.Icons.Cash }, cfg.onClick)
		if cfg.can then K.shine(b, 2) end
		if cfg.tip then
			UI.Pill(body, cfg.tip, { Width = 470, Height = 30, Position = UDim2.fromOffset(553, 392), TextSize = 15, ZIndex = 20 })
		end
		if animate then
			for _, o in { panel, box, b } do
				local sc = o:FindFirstChild("ButtonScale") or UI.new("UIScale", { Name = "ButtonScale" }, o)
				local _ = sc
				Motion.PopIn(o, 0.4)
			end
		end
	end

	local function strengthTab(animate)
		local d = Data.values
		local L = d.strength or 1
		local maxed = L >= E.Strength.maxLevel
		local nl = math.min(L + 1, E.Strength.maxLevel)
		local cost = E.Strength.cost(L)
		statPage(animate, {
			panel = "amber", icon = K.Icons.Upgrade, big = "Lv " .. L, title = "STRENGTH",
			rows = {
				{ "Throw distance", ("%d -> %d studs"):format(E.Strength.maxDistance(L), E.Strength.maxDistance(nl)) },
				{ "Max fish weight", ("%s -> %s"):format(Format.kg(E.Strength.maxFishWeight(L)), Format.kg(E.Strength.maxFishWeight(nl))) },
				{ "Training", ("%d / %d reps"):format(d.strengthReps or 0, E.Strength.repsNeeded(L)) },
			},
			can = not maxed and (d.money or 0) >= cost,
			button = if maxed then "MAXED" else ("BUY Lv %d  %s"):format(nl, Format.money(cost)),
			onClick = function() if not maxed then Net.event("BuyStrength"):FireServer() end end,
			tip = 'Free: stand in the <font color="#FFD23F">white circle</font> by your base to train!',
		})
	end

	local function baseTab(animate)
		local d = Data.values
		local lvl = d.capacity or 1
		local maxed = lvl >= E.Capacity.maxLevel
		local cost = E.Capacity.cost(lvl)
		local placed = 0
		for _, b in d.bears or {} do if b.placed then placed += 1 end end
		statPage(animate, {
			panel = "lime", icon = K.Icons.House, big = Formulas.capacity(lvl) .. " bears", title = "BASE CAPACITY",
			rows = {
				{ "Bears placed", ("%d / %d"):format(placed, Formulas.capacity(lvl)) },
				{ "Next capacity", ("%d bears"):format(Formulas.capacity(math.min(lvl + 1, E.Capacity.maxLevel))) },
				{ "Income now", Format.perSec(player:GetAttribute("Income") or 0) },
			},
			can = not maxed and (d.money or 0) >= cost,
			button = if maxed then "MAXED" else ("+1 SLOT  %s"):format(Format.money(cost)),
			onClick = function() if not maxed then Net.event("UpgradeCapacity"):FireServer() end end,
		})
	end

	renderers.Shop = function(animate)
		clear(body)
		for name, b in tabs do UI.Recolor(b, if name == shopTab then "green" else "orange") end
		local pt = w.pill:FindFirstChild("Texte")
		if pt then pt.Text = ('Your money: <font color="#B4FF3C">%s</font>'):format(Format.money(Data.values.money or 0)) end
		if shopTab == "Rods" then rodsTab(animate) elseif shopTab == "Strength" then strengthTab(animate) else baseTab(animate) end
	end
end

------------------------------------------------------------------------------------------
-- Sell (fish product cards)
------------------------------------------------------------------------------------------
local function valuable(f)
	return RarityConfig.get(FishConfig.get(f.s).rarity).index >= 4 or (f.v and f.v ~= "Normal")
end

local function sellIds(ids)
	if #ids == 0 then return end
	local total, rare = 0, false
	for _, id in ids do
		local f = Data.fishById(id)
		if f then
			total += Formulas.fishValue(f)
			if valuable(f) then rare = true end
		end
	end
	if rare then
		Menus.confirm(("Sell %d fish (rare inside!) for %s?"):format(#ids, Format.money(total)), function()
			Net.event("SellFish"):FireServer(ids, true)
		end)
	else
		Net.event("SellFish"):FireServer(ids, false)
	end
end

local function buildSell()
	local w = makeWindow("Sell", { size = Vector2.new(700, 500), title = "Sell Fish", header = "green", icon = K.Icons.Cash, titleWidth = 300 })
	K.button(w.win.Entete, { Name = "SellAll", Style = "Chunky", Theme = "orange", Size = Vector2.new(150, 56), Position = UDim2.fromOffset(556, 37),
		Text = "Sell All", FixedTextSize = 28, ZIndex = 8 }, function()
		local ids = {}
		for _, f in Data.values.fish or {} do
			if not valuable(f) then table.insert(ids, f.id) end
		end
		sellIds(ids)
	end)
	w.pill = UI.Pill(w.win.Fenetre, "", { Width = 320, Height = 30, Position = UDim2.new(0.5, 0, 0, w.win.HeaderHeight), ZIndex = 20 })
	renderers.Sell = function(animate)
		clear(w.content)
		local fish = table.clone(Data.values.fish or {})
		table.sort(fish, function(a, b) return Formulas.fishValue(a) > Formulas.fishValue(b) end)
		local total = 0
		for _, f in fish do total += Formulas.fishValue(f) end
		local pt = w.pill:FindFirstChild("Texte")
		if pt then pt.Text = ('%d fish worth <font color="#B4FF3C">%s</font>'):format(#fish, Format.money(total)) end
		if #fish == 0 then
			UI.Text(w.content, "No fish to sell!\nGo fish at the end of your dock.", { Size = UDim2.fromOffset(600, 120), Position = UDim2.fromScale(0.5, 0.45), Max = 30, ZIndex = 6 })
			return
		end
		local list = UI.ScrollList(w.content, { Size = UDim2.fromOffset(688, 404), Position = UDim2.fromOffset(4, 4), Padding = 9, PadTop = 20, PadLeft = 12 })
		for i, f in fish do
			local spec = FishConfig.get(f.s)
			local card = UI.ProductCard(list, {
				Name = "Fish" .. i, LayoutOrder = i, Width = 650, Height = 150, Title = (if f.v ~= "Normal" then f.v .. " " else "") .. spec.name,
				Rarity = K.rarityKey(spec.rarity), Description = Format.kg(f.w) .. (if valuable(f) then "\nRare: asks to confirm" else ""),
				Stock = "x1", Icon = "", Price = Format.money(Formulas.fishValue(f)),
			})
			card.Rarete.Text = RarityConfig.get(spec.rarity).name
			card.Stock.Visible = false
			K.model(card.Panneau, { kind = "Fish", id = f.s, variant = f.v, spin = true, spinSpeed = 0.9, size = UDim2.fromScale(1, 1), position = UDim2.fromScale(0.5, 0.5), zindex = 5 })
			local buy = card:FindFirstChild("AchatArgent")
			if buy then
				Motion.BindButton(buy, 1.05, K.sounds, function() sellIds({ f.id }) end)
				K.shine(buy, 3)
			end
		end
		if animate then K.cascade(list, 0.04) end
	end
end

------------------------------------------------------------------------------------------
-- Bag (hold a fish)
------------------------------------------------------------------------------------------
local function buildBag()
	local w = makeWindow("Bag", { size = Vector2.new(700, 480), title = "Fish Bag", header = "purple", icon = K.Icons.Bag })
	w.pill = UI.Pill(w.win.Fenetre, "", { Width = 300, Height = 30, Position = UDim2.new(0.5, 0, 0, w.win.HeaderHeight), ZIndex = 20 })
	renderers.Bag = function(animate)
		clear(w.content)
		local d = Data.values
		local fish = table.clone(d.fish or {})
		table.sort(fish, function(a, b) return Formulas.fishValue(a) > Formulas.fishValue(b) end)
		local pt = w.pill:FindFirstChild("Texte")
		if pt then pt.Text = ('<font color="#FFD23F">%d / %d</font> fish - tap one to hold it'):format(#fish, E.FishBagMax) end
		if #fish == 0 then
			UI.Text(w.content, "Your bag is empty.\nGo to the end of your dock and CAST!", { Size = UDim2.fromOffset(600, 120), Position = UDim2.fromScale(0.5, 0.45), Max = 30, ZIndex = 6 })
			return
		end
		local grid = UI.ScrollList(w.content, { Size = UDim2.fromOffset(688, 384), Position = UDim2.fromOffset(4, 4), Grid = Vector2.new(122, 122), GridGap = 12, PadTop = 24, PadLeft = 14 })
		for i, f in fish do
			local spec = FishConfig.get(f.s)
			local s = UI.ItemSlot(grid, { Name = "Fish" .. i, LayoutOrder = i, Size = Vector2.new(122, 122), Icon = "", Title = spec.name,
				Quantity = Format.kg(f.w), Tag = if f.v ~= "Normal" then f.v else nil, TagColor = UI.Colors.TagGold, Selected = d.selectedFish == f.id, TitleMax = 16 })
			K.model(s, { kind = "Fish", id = f.s, variant = f.v, size = UDim2.fromScale(0.9, 0.9) })
			local rarText = UI.Text(s, RarityConfig.get(spec.rarity).name, { Size = UDim2.new(1, 0, 0, 18), Position = UDim2.new(0.5, 0, 1, -30), Max = 13,
				Gradient = rarityOf(spec.rarity).text, Stroke = UI.Colors.StrokeSlot, Thickness = 2, ZIndex = 8 })
			local _ = rarText
			if d.selectedFish == f.id then Motion.PulseStroke(s.Lisere.Selection) end
			Motion.BindButton(s, 1.06, K.sounds, function()
				Net.event("SelectFish"):FireServer(f.id)
				w.menu.Close()
			end)
		end
		Motion.SpinSunbursts(grid, 22)
		if animate then K.cascade(grid, 0.025) end
	end
end

------------------------------------------------------------------------------------------
-- Index
------------------------------------------------------------------------------------------
local indexCat = "Fish"
local indexSel = nil
local function buildIndex()
	local w = makeWindow("Index", { size = Vector2.new(780, 490), title = "Index", header = "blue", icon = K.Icons.Index })
	local tabs = {}
	for i, cat in { "Fish", "Bears" } do
		tabs[cat] = K.button(w.win.Fenetre, { Name = "Tab" .. cat, Theme = if cat == "Fish" then "blue" else "yellow", Size = Vector2.new(160, 64),
			Position = UDim2.fromOffset(780 + 96, 120 + (i - 1) * 78), Text = cat, TextSize = 30, Icon = if cat == "Fish" then K.Icons.Bait else K.Icons.Paw }, function()
			indexCat = cat
			indexSel = nil
			renderers.Index(true)
		end)
	end
	renderers.Index = function(animate)
		clear(w.content)
		for cat, b in tabs do
			b.Position = UDim2.fromOffset(if cat == indexCat then 780 + 104 else 780 + 96, b.Position.Y.Offset)
			UI.SetDisabled(b, cat ~= indexCat)
		end
		local d = Data.values
		local order = if indexCat == "Fish" then FishConfig.Order else BearConfig.Order
		local found = if indexCat == "Fish" then (d.index and d.index.fish or {}) else (d.index and d.index.bears or {})
		local left = UI.InsetBox(w.content, { Size = UDim2.fromOffset(500, 392), Position = UDim2.fromOffset(10, 10), Transparency = 0.25, ZIndex = 2 })
		local grid = UI.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(480, 290), Position = UDim2.fromOffset(10, 14), ZIndex = 3 }, left)
		UI.new("UIGridLayout", { CellSize = UDim2.fromOffset(110, 110), CellPadding = UDim2.fromOffset(10, 12), SortOrder = Enum.SortOrder.LayoutOrder,
			HorizontalAlignment = Enum.HorizontalAlignment.Center }, grid)
		local n = 0
		for i, id in order do
			local entry = found[id]
			if entry then n += 1 end
			local spec = if indexCat == "Fish" then FishConfig.get(id) else BearConfig.get(id)
			local s = UI.ItemSlot(grid, { Name = id, LayoutOrder = i, Size = Vector2.new(110, 110), Icon = "", Title = if entry then spec.name else "???",
				Selected = indexSel == id, TitleMax = 14, Check = entry ~= nil })
			K.model(s, { kind = if indexCat == "Fish" then "Fish" else "Bear", id = id, silhouette = entry == nil, size = UDim2.fromScale(0.86, 0.86) })
			if indexSel == id then Motion.PulseStroke(s.Lisere.Selection) end
			Motion.BindButton(s, 1.06, K.sounds, function()
				indexSel = id
				renderers.Index(false)
			end)
		end
		Motion.SpinSunbursts(grid, 20)
		UI.ProgressBar(left, { Size = UDim2.fromOffset(300, 48), Position = UDim2.fromOffset(14, 330), Progress = n / #order, Text = ("%d/%d"):format(n, #order), Max = 30, ZIndex = 4 })
		local pending = d.indexPending and d.indexPending[indexCat] or 0
		local claim = K.button(left, { Theme = if pending > 0 then "green" else "gray", Size = Vector2.new(160, 52), Position = UDim2.fromOffset(410, 354),
			Text = if pending > 0 then "Claim " .. Format.money(pending) else "Claim", TextSize = 22 }, function()
			Net.event("ClaimIndex"):FireServer(indexCat)
		end)
		if pending > 0 then K.shine(claim, 1.8) end
		-- detail
		local id = indexSel or order[1]
		local entry = found[id]
		local spec = if indexCat == "Fish" then FishConfig.get(id) else BearConfig.get(id)
		local right = UI.InsetBox(w.content, { Size = UDim2.fromOffset(240, 392), Position = UDim2.fromOffset(522, 10), Transparency = 0.15, ZIndex = 2 })
		local pic = UI.ItemSlot(right, { Size = Vector2.new(210, 170), Position = UDim2.fromOffset(15, 14), Icon = "", Title = "", Button = false, ZIndex = 3 })
		K.model(pic, { kind = if indexCat == "Fish" then "Fish" else "Bear", id = id, silhouette = entry == nil, spin = entry ~= nil, size = UDim2.fromScale(0.95, 0.95), position = UDim2.fromScale(0.5, 0.5) })
		Motion.SpinSunbursts(pic, 18)
		UI.Text(right, if entry then spec.name else "???", { Size = UDim2.fromOffset(220, 40), Position = UDim2.fromOffset(120, 210), Max = 32, Thickness = 3, ZIndex = 6 })
		if indexCat == "Fish" then
			UI.Text(right, RarityConfig.get(spec.rarity).name, { Size = UDim2.fromOffset(220, 34), Position = UDim2.fromOffset(120, 248), TextSize = 26,
				Gradient = rarityOf(spec.rarity).text, Stroke = RGB(14, 10, 24), ZIndex = 6 })
		else
			local parts = {}
			if entry then
				for _, r in RarityConfig.Order do
					if entry.r and entry.r[r] then table.insert(parts, RarityConfig.get(r).name) end
				end
			end
			local t = UI.Text(right, if entry then table.concat(parts, ", ") else "???", { Size = UDim2.fromOffset(220, 50), Position = UDim2.fromOffset(120, 254), Max = 20,
				Gradient = UI.TextGradients.Stock, Stroke = RGB(33, 7, 0), ZIndex = 6 })
			t.TextWrapped = true
		end
		UI.Text(right, if entry then ("Caught %d\nBest %s"):format(entry.n, Format.kg(entry.best)) else "Not found yet", { Font = "Bold", Size = UDim2.fromOffset(220, 56),
			Position = UDim2.fromOffset(120, 312), Max = 20, ZIndex = 6 })
		UI.Text(right, ('Reward <font color="#B4FF3C">%s</font>'):format(Format.money(E.IndexReward[indexCat])), { Rich = true, Size = UDim2.fromOffset(220, 26),
			Position = UDim2.fromOffset(120, 366), Max = 18, ZIndex = 6 })
		if animate then K.cascade(grid, 0.04) end
	end
end

------------------------------------------------------------------------------------------
-- Bears collection
------------------------------------------------------------------------------------------
local function buildBears()
	local w = makeWindow("Bears", { size = Vector2.new(780, 490), title = "My Bears", header = "purple", icon = K.Icons.Paw })
	w.pill = UI.Pill(w.win.Fenetre, "", { Width = 380, Height = 30, Position = UDim2.new(0.5, 0, 0, w.win.HeaderHeight), ZIndex = 20 })
	renderers.Bears = function(animate)
		clear(w.content)
		local d = Data.values
		local list = {}
		for _, b in d.bears or {} do table.insert(list, b) end
		table.sort(list, function(a, b)
			if a.placed ~= b.placed then return a.placed end
			return Formulas.bearIncome(a) > Formulas.bearIncome(b)
		end)
		local placed = 0
		for _, b in list do if b.placed then placed += 1 end end
		local pt = w.pill:FindFirstChild("Texte")
		if pt then
			pt.Text = ('%d bears  <font color="#FFD23F">%d/%d</font> in base  <font color="#B4FF3C">%s</font>'):format(#list, placed,
				Formulas.capacity(d.capacity or 1), Format.perSec(player:GetAttribute("Income") or 0))
		end
		if #list == 0 then
			UI.Text(w.content, "No bears yet!\nThrow a fish into the forest and bring the bear home.", { Size = UDim2.fromOffset(700, 140), Position = UDim2.fromScale(0.5, 0.45), Max = 30, ZIndex = 6 })
			return
		end
		local grid = UI.ScrollList(w.content, { Size = UDim2.fromOffset(768, 404), Position = UDim2.fromOffset(4, 4), Grid = Vector2.new(170, 226), GridGap = 14, PadTop = 24, PadLeft = 12 })
		for i, b in list do
			local spec = BearConfig.get(b.s)
			local tier = RarityConfig.get(b.r)
			local card = UI.new("Frame", { Name = "Bear" .. i, BackgroundTransparency = 1, LayoutOrder = i, ZIndex = 2 }, grid)
			local s = UI.ItemSlot(card, { Size = Vector2.new(170, 142), Icon = "", Title = spec.name, Quantity = Format.kg(b.w),
				Tag = if b.v ~= "Normal" then b.v else nil, TagColor = UI.Colors.TagGold, Button = false, Check = b.placed, TitleMax = 18 })
			K.model(s, { kind = "Bear", id = b.s, variant = b.v, size = UDim2.fromScale(0.92, 0.92), position = UDim2.fromScale(0.5, 0.45) })
			UI.Text(card, tier.name, { Size = UDim2.fromOffset(170, 24), Position = UDim2.fromOffset(85, 156), TextSize = 20,
				Gradient = rarityOf(b.r).text, Stroke = RGB(14, 10, 24), ZIndex = 6 })
			UI.Text(card, Format.perSec(Formulas.bearIncome(b)), { Size = UDim2.fromOffset(170, 22), Position = UDim2.fromOffset(85, 178), TextSize = 19,
				Gradient = UI.TextGradients.Money, Stroke = RGB(15, 51, 0), ZIndex = 6 })
			K.button(card, { Theme = if b.placed then "yellow" else "green", Size = Vector2.new(98, 36), Position = UDim2.fromOffset(50, 208),
				Text = if b.placed then "Pick Up" else "Place", TextSize = 18, ZIndex = 4 }, function()
				if b.placed then Net.event("PickupBear"):FireServer(b.id) else Net.event("TakeFromStorage"):FireServer(b.id) end
				w.menu.Close()
			end)
			K.button(card, { Theme = "red", Size = Vector2.new(66, 36), Position = UDim2.fromOffset(136, 208), Text = "Sell", TextSize = 18, ZIndex = 4 }, function()
				Menus.confirm(("Sell %s %s for %s?"):format(tier.name, spec.name, Format.money(Formulas.bearSellValue(b))), function()
					Net.event("SellBear"):FireServer(b.id, true)
				end)
			end)
		end
		Motion.SpinSunbursts(grid, 18)
		if animate then K.cascade(grid, 0.04) end
	end
end

------------------------------------------------------------------------------------------
-- Daily rewards
------------------------------------------------------------------------------------------
local function buildDaily()
	local w = makeWindow("Daily", { size = Vector2.new(800, 430), title = "Daily Rewards", header = "blue", icon = K.Icons.Daily, titleWidth = 420 })
	local tiles = UI.new("Frame", { Name = "Tiles", BackgroundTransparency = 1, Size = UDim2.fromOffset(780, 200), Position = UDim2.fromOffset(4, 20), ZIndex = 2 }, w.content)
	UI.new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Center, Padding = UDim.new(0, 8),
		SortOrder = Enum.SortOrder.LayoutOrder }, tiles)
	w.claim = nil
	renderers.Daily = function(animate)
		clear(tiles)
		if w.claim then w.claim:Destroy() end
		local dd = Data.values.daily or { streak = 0, last = 0 }
		local now = os.time()
		local ready = now - dd.last >= E.Daily.cooldown
		local streak = if now - dd.last > E.Daily.resetAfter then 0 else dd.streak
		local today = streak % #E.Daily.rewards + 1
		for i, amount in E.Daily.rewards do
			local done = i < today or (i == today and not ready)
			local cur = i == today and ready
			local p = UI.StudPanel(tiles, { Name = "Day" .. i, Size = UDim2.fromOffset(100, 190), Gradient = if done then "blue" else PANELS[i], LayoutOrder = i, ZIndex = 3 })
			p.ClipsDescendants = true
			if cur then
				UI.Sunburst(p, 260, { Position = UDim2.fromScale(0.5, 0.45), Transparency = 0.35, ZIndex = 4 })
				local st = p:FindFirstChildOfClass("UIStroke")
				if st then
					st.Color = UI.Colors.Selection
					Motion.PulseStroke(st, 4, 2, 5)
				end
			end
			UI.Text(p, "Day " .. i, { Size = UDim2.fromOffset(96, 28), Position = UDim2.fromOffset(50, 22), TextSize = 22, ZIndex = 7 })
			local ic = UI.Image(p, if i == 7 then K.Icons.GoldCash else K.Icons.Cash, { Size = UDim2.fromOffset(74, 74), Position = UDim2.fromOffset(50, 90), Rotation = -8, ZIndex = 6 })
			if cur then Motion.Sway(ic, 8, 2) end
			UI.Text(p, Format.money(amount), { Size = UDim2.fromOffset(96, 28), Position = UDim2.fromOffset(50, 152), TextSize = 22,
				Gradient = UI.TextGradients.Money, Stroke = RGB(15, 51, 0), ZIndex = 7 })
			if done then UI.Image(p, K.Icons.Check, { Size = UDim2.fromOffset(46, 46), Position = UDim2.fromOffset(74, 116), ZIndex = 8 }) end
		end
		Motion.SpinSunbursts(tiles, 30)
		w.claim = K.button(w.content, { Theme = if ready then "meadow" else "gray", Size = Vector2.new(360, 70), Position = UDim2.fromOffset(397, 284),
			Text = if ready then ("Claim Day %d!"):format(today) else "Next in " .. Format.time(E.Daily.cooldown - (now - dd.last)), TextSize = 32,
			Icon = K.Icons.Daily }, function() Net.event("ClaimDaily"):FireServer() end)
		if ready then K.shine(w.claim, 1.6) end
		if animate then K.cascade(tiles, 0.06) end
	end
	task.spawn(function()
		while true do
			task.wait(1)
			if w.menu.IsOpen then
				local dd = Data.values.daily or { last = 0 }
				local left = E.Daily.cooldown - (os.time() - dd.last)
				if left > 0 and w.claim then UI.SetButtonText(w.claim, "Next in " .. Format.time(left)) end
			end
		end
	end)
end

------------------------------------------------------------------------------------------
-- Gifts (session playtime)
------------------------------------------------------------------------------------------
local function claimedSet(): { [number]: boolean }
	local out = {}
	for n in string.gmatch(player:GetAttribute("GiftsClaimed") or "", "(%d+),") do out[tonumber(n)] = true end
	return out
end

local function buildGifts()
	local w = makeWindow("Rewards", { size = Vector2.new(780, 470), title = "Gifts", header = "gold", icon = K.Icons.Gift })
	w.pill = UI.Pill(w.win.Fenetre, "Stay to open more gifts!", { Width = 300, Height = 30, Position = UDim2.new(0.5, 0, 0, w.win.HeaderHeight), ZIndex = 20 })
	local slots = {}
	renderers.Rewards = function(animate)
		clear(w.content)
		table.clear(slots)
		local grid = UI.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(760, 360), Position = UDim2.fromOffset(10, 26), ZIndex = 2 }, w.content)
		UI.new("UIGridLayout", { CellSize = UDim2.fromOffset(160, 150), CellPadding = UDim2.fromOffset(18, 34), HorizontalAlignment = Enum.HorizontalAlignment.Center,
			SortOrder = Enum.SortOrder.LayoutOrder }, grid)
		for i, g in E.Playtime do
			local s = UI.ItemSlot(grid, { Name = "Gift" .. i, LayoutOrder = i, Size = Vector2.new(160, 150), Icon = K.Icons.Gift, Title = Format.money(g.money) .. "+",
				Top = "", TitleMax = 20 })
			slots[i] = s
			Motion.BindButton(s, 1.06, K.sounds, function()
				local joined = player:GetAttribute("JoinedAt") or workspace:GetServerTimeNow()
				if workspace:GetServerTimeNow() - joined >= g.minutes * 60 and not claimedSet()[i] then
					Net.event("ClaimPlaytime"):FireServer(i)
				else
					Motion.Shake(s)
				end
			end)
		end
		Motion.SpinSunbursts(grid, 24)
		renderers.RewardsTick()
		if animate then K.cascade(grid, 0.05) end
	end
	renderers.RewardsTick = function()
		local joined = player:GetAttribute("JoinedAt") or workspace:GetServerTimeNow()
		local played = workspace:GetServerTimeNow() - joined
		local claimed = claimedSet()
		for i, s in slots do
			local g = E.Playtime[i]
			local left = g.minutes * 60 - played
			local ready = left <= 0 and not claimed[i]
			s.Coche.Visible = claimed[i] == true
			s.Haut.Text = if claimed[i] then "Opened" elseif ready then "OPEN!" else Format.time(left)
			s.Haut.TextColor3 = if ready then UI.Colors.FloatSuccess else Color3.new(1, 1, 1)
			s.Icone.Rotation = if ready then math.sin(os.clock() * 9) * 12 else 0
			s.Icone.ImageTransparency = if claimed[i] then 0.5 else 0
			if ready ~= s.Lisere.Selection.Enabled then
				s.Lisere.Selection.Enabled = ready
				if ready then Motion.PulseStroke(s.Lisere.Selection) end
			end
		end
	end
	task.spawn(function()
		while true do
			task.wait(0.1)
			if w.menu.IsOpen and renderers.RewardsTick then renderers.RewardsTick() end
		end
	end)
	player:GetAttributeChangedSignal("GiftsClaimed"):Connect(function()
		if w.menu.IsOpen then renderers.RewardsTick() end
	end)
end

function Menus.giftReady(): boolean
	local joined = player:GetAttribute("JoinedAt")
	if not joined then return false end
	local played = workspace:GetServerTimeNow() - joined
	local claimed = claimedSet()
	for i, g in E.Playtime do
		if played >= g.minutes * 60 and not claimed[i] then return true end
	end
	return false
end

------------------------------------------------------------------------------------------
function Menus.mount()
	buildShop()
	buildSell()
	buildBag()
	buildIndex()
	buildBears()
	buildDaily()
	buildGifts()
	buildConfirm()
	-- re-render the open window when the data it shows changes
	local KEYS = {
		Shop = { rods = true, strength = true, strengthReps = true, capacity = true, money = "throttle" },
		Sell = { fish = true }, Bag = { fish = true, selectedFish = true },
		Index = { index = true, indexPending = true }, Bears = { bears = true, capacity = true }, Daily = { daily = true },
	}
	local lastMoney = 0
	Data.Changed:Connect(function(key)
		for name, w in windows do
			if w.menu.IsOpen and renderers[name] then
				local rule = KEYS[name] and KEYS[name][key]
				if key == "*" or rule == true then
					renderers[name](false)
				elseif rule == "throttle" and shopTab ~= "Rods" and os.clock() - lastMoney > 1.5 then
					lastMoney = os.clock()
					renderers[name](false)
				end
			end
		end
	end)
end

function Menus.open(name: string)
	local w = windows[name]
	if not w then return end
	if w.menu.IsOpen then
		w.menu.Close()
	else
		w.menu.Open()
	end
end

Menus.windows = windows
return Menus
