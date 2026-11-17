--[[ Menus: every window in the reference simulator style (UI/Sim):
     coloured studded header + big outlined title + red X, dark studded body,
     light studded rarity cards with title / rarity / 3D model / dark stat bar / big button.
       Shop  : Rods (horizontal row of rod cards) / Strength / Base
       Sell  : fish cards, SELL button each + "Sell All"
       Bag   : fish cards, HOLD button
       Index : Fish / Bears tabs on the right, "???" silhouettes, progress + claim
       Bears : collection cards (Pick Up / Place / Sell)
       Inventory : "Bears + Fish" window (tabs Bears / Fish) opened by the inventory slot
       Daily, Gifts, Confirm ]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local E = require(Shared.Config.EconomyConfig)
local FishConfig = require(Shared.Config.FishConfig)
local BearConfig = require(Shared.Config.BearConfig)
local RodConfig = require(Shared.Config.RodConfig)
local ZoneConfig = require(Shared.Config.ZoneConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local Sim = require(script.Parent.Sim)
local K = require(script.Parent.Kit)
local Data = require(script.Parent.Parent.Controllers.Data)

local Motion = Sim.Motion
local Menus = {}
local player = Players.LocalPlayer
local RGB = Color3.fromRGB
local new = Sim.new
local windows = {}
local renderers = {}
local ROD_RARITY = { "Common", "Common", "Uncommon", "Uncommon", "Rare", "Rare", "Epic", "Epic", "Legendary", "Legendary", "Mythic", "Mythic" }

local function clear(frame: Instance)
	for _, c in frame:GetChildren() do
		if c:IsA("GuiObject") then c:Destroy() end
	end
end

local function makeWindow(name: string, opts)
	opts.name = name
	opts.onOpen = function()
		if renderers[name] then renderers[name](true) end
	end
	local w = Sim.window(opts)
	windows[name] = w
	return w
end

-- scrolling container in a window body
local function scroller(parent, p)
	local s = new("ScrollingFrame", {
		Name = "List", BackgroundTransparency = 1, BorderSizePixel = 0, Size = p.Size, Position = p.Position or UDim2.fromOffset(0, 0),
		CanvasSize = UDim2.new(), AutomaticCanvasSize = if p.X then Enum.AutomaticSize.X else Enum.AutomaticSize.Y,
		ScrollingDirection = if p.X then Enum.ScrollingDirection.X else Enum.ScrollingDirection.Y, ScrollBarThickness = 8,
		ScrollBarImageColor3 = RGB(230, 230, 230), ZIndex = 3,
	}, parent)
	new("UIPadding", { PaddingLeft = UDim.new(0, p.Pad or 14), PaddingRight = UDim.new(0, p.Pad or 14), PaddingTop = UDim.new(0, p.PadTop or 14),
		PaddingBottom = UDim.new(0, 12) }, s)
	if p.Grid then
		new("UIGridLayout", { CellSize = UDim2.fromOffset(p.Grid.X, p.Grid.Y), CellPadding = UDim2.fromOffset(p.Gap or 12, p.Gap or 14),
			SortOrder = Enum.SortOrder.LayoutOrder, HorizontalAlignment = Enum.HorizontalAlignment.Center }, s)
	else
		new("UIListLayout", { FillDirection = if p.X then Enum.FillDirection.Horizontal else Enum.FillDirection.Vertical,
			Padding = UDim.new(0, p.Gap or 12), SortOrder = Enum.SortOrder.LayoutOrder, VerticalAlignment = Enum.VerticalAlignment.Top }, s)
	end
	return s
end

local function emptyText(parent, text)
	Sim.text(parent, text, { Size = UDim2.fromOffset(620, 120), Position = UDim2.fromScale(0.5, 0.45), Max = 34, Wrap = true, ZIndex = 6 })
end

------------------------------------------------------------------------------------------
-- Confirm
------------------------------------------------------------------------------------------
local confirmCb
local function buildConfirm()
	local w = makeWindow("Confirm", { title = "Are you sure?", grad = "red", size = Vector2.new(520, 300) })
	w.msg = Sim.text(w.content, "", { Size = UDim2.fromOffset(470, 100), Position = UDim2.new(0.5, 0, 0, 66), Max = 30, Wrap = true, ZIndex = 6 })
	Sim.button(w.content, { Grad = "green", Size = Vector2.new(210, 66), Position = UDim2.fromOffset(134, 160), Text = "YES", Max = 40 }, function()
		local cb = confirmCb
		confirmCb = nil
		w.menu.Close()
		if cb then cb() end
	end)
	Sim.button(w.content, { Grad = "red", Size = Vector2.new(210, 66), Position = UDim2.fromOffset(378, 160), Text = "NO", Max = 40 }, function()
		confirmCb = nil
		w.menu.Close()
	end)
end

function Menus.confirm(text: string, onYes)
	confirmCb = onYes
	windows.Confirm.msg.Text = text
	windows.Confirm.menu.Open()
end

------------------------------------------------------------------------------------------
-- Shop
------------------------------------------------------------------------------------------
local shopTab = "Rods"
local function buildShop()
	local w = makeWindow("Shop", { title = "Rod Shop", grad = "orange", size = Vector2.new(860, 470), titleWidth = 300 })
	local tabs = {}
	for i, name in { "Rods", "Strength" } do -- Base tab removed (capacity: "+1 Slot" in the bears panel)
		tabs[name] = Sim.button(w.titleRoot, { Name = "Tab" .. name, Grad = "grey", Size = Vector2.new(130, 50), Position = UDim2.fromOffset(410 + (i - 1) * 140, w.HH / 2),
			Text = name, Max = 28, ZIndex = 9 }, function()
			shopTab = name
			renderers.Shop(true)
		end)
	end
	local body = w.content

	local function rodsTab(animate)
		local d = Data.values
		local list = scroller(body, { Size = UDim2.fromScale(1, 1), X = true, Gap = 16, PadTop = 16 })
		for i, id in RodConfig.Order do
			local rod = RodConfig.get(id)
			local owned = d.rods and d.rods.owned[id]
			local equipped = d.rods and d.rods.equipped == id
			local rar = ROD_RARITY[i] or "Common"
			local card, centre = Sim.card(list, { Name = "Rod" .. i, LayoutOrder = i, Size = Vector2.new(250, 344), Rarity = rar, Title = rod.name,
				RarityText = RarityConfig.get(rar).name, CenterTop = 74, CenterCut = 196 })
			Sim.model(centre, { kind = "Rod", id = id, spin = true, spinSpeed = 0.7, zoom = 0.72, size = UDim2.fromScale(1.05, 1.15) })
			Sim.infoBar(card, ('<font color="#3CB4FF">x%.2f</font> Speed'):format(rod.speed), { Size = UDim2.fromOffset(226, 34), Position = UDim2.fromOffset(125, 232), ZIndex = 6 })
			Sim.infoBar(card, ('<font color="#7CFF46">x%.2f</font> Luck'):format(rod.luck), { Size = UDim2.fromOffset(226, 34), Position = UDim2.fromOffset(125, 268), ZIndex = 6 })
			local bp = { Size = Vector2.new(226, 50), Position = UDim2.fromOffset(125, 314), ZIndex = 7, Max = 34 }
			if equipped then
				bp.Grad = "grey"; bp.Text = "Equipped"
				Sim.button(card, bp)
			elseif owned then
				bp.Grad = "green"; bp.Text = "Equip"
				Sim.button(card, bp, function() Net.event("EquipRod"):FireServer(id) end)
			else
				local can = (d.money or 0) >= rod.price
				bp.Grad = if can then "green" else "light"; bp.Text = Format.money(rod.price); bp.Icon = K.Icons.Cash; bp.IconSize = 0.9
				Sim.button(card, bp, function() Net.event("BuyRod"):FireServer(id) end)
			end
		end
		if animate then K.cascade(list, 0.05) end
	end

	local function statPage(animate, cfg)
		Sim.section(body, cfg.section, { Position = UDim2.new(0.5, 0, 0, 30) })
		local card, centre = Sim.card(body, { Size = Vector2.new(260, 300), Rarity = cfg.rarity, Title = cfg.big, RarityText = cfg.small, CenterTop = 80, CenterCut = 100 })
		card.Position = UDim2.fromOffset(30, 66)
		local ic = new("ImageLabel", { BackgroundTransparency = 1, Image = cfg.icon, ScaleType = Enum.ScaleType.Fit, Size = UDim2.fromScale(0.9, 0.9),
			Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), Rotation = -6, ZIndex = 6 }, centre)
		local _ = ic
		for i, row in cfg.rows do
			Sim.infoBar(body, ('%s  <font color="#7CFF46">%s</font>'):format(row[1], row[2]), { Size = UDim2.fromOffset(500, 46), Position = UDim2.fromOffset(570, 100 + (i - 1) * 58), Max = 26 })
		end
		local b = Sim.button(body, { Grad = if cfg.can then "green" else "light", Size = Vector2.new(500, 70), Position = UDim2.fromOffset(570, 300),
			Text = cfg.button, Max = 36, Icon = K.Icons.Cash }, cfg.onClick)
		K.shine(b, 2.5)
		if cfg.tip then
			Sim.text(body, cfg.tip, { Size = UDim2.fromOffset(500, 26), Position = UDim2.fromOffset(570, 356), Max = 20, Rich = true, ZIndex = 6 })
		end
		if animate then
			for _, o in { card, b } do Motion.PopIn(o, 0.4) end
		end
	end

	renderers.Shop = function(animate)
		clear(body)
		for name, b in tabs do Sim.recolor(b, if name == shopTab then "yellow" else "grey") end
		local d = Data.values
		if shopTab == "Rods" then
			rodsTab(animate)
		elseif shopTab == "Strength" then
			local power = d.strength or 0
			local gain = d.strengthGain or 1
			local maxed = gain >= E.Strength.maxGain
			local cost = E.Strength.gainCost(gain)
			statPage(animate, {
				section = "Strength", rarity = "Mythic", big = "💪 " .. Format.short(power), small = ("+%d per lift"):format(gain), icon = K.Icons.Upgrade,
				rows = {
					{ "Each lift", ("+%d -> +%d strength"):format(gain, gain + 1) },
					{ "Throw distance", ("%d studs  ·  max fish %s"):format(E.Strength.maxDistance(power), Format.kg(E.Strength.maxFishWeight(power))) },
					(function()
						local reach, nextZ = 1, nil
						for i = 1, #ZoneConfig.Zones do
							if power >= Formulas.zoneStrength(i) then reach = i elseif not nextZ then nextZ = i end
						end
						local nz = nextZ and ZoneConfig.get(nextZ)
						return { ("Reach: %s"):format(ZoneConfig.get(reach).name), if nz then ("Next: %s at 💪%s"):format(nz.name, Format.short(Formulas.zoneStrength(nextZ :: number))) else "Every zone unlocked!" }
					end)(),
				},
				can = not maxed and (d.money or 0) >= cost,
				button = if maxed then "MAX" else ("Upgrade +%d  %s"):format(gain + 1, Format.money(cost)),
				onClick = function() if not maxed then Net.event("BuyStrength"):FireServer() end end,
				tip = 'Lift at the <font color="#FFD23F">FISH-UP</font> station by your base to gain strength!',
			})
		else
			local lvl = d.capacity or 1
			local maxed = lvl >= E.Capacity.maxLevel
			local cost = E.Capacity.cost(lvl)
			local placed = 0
			for _, b in d.bears or {} do if b.placed then placed += 1 end end
			statPage(animate, {
				section = "Base", rarity = "Uncommon", big = Formulas.capacity(lvl) .. " Bears", small = "Capacity", icon = K.Icons.House,
				rows = {
					{ "Bears placed", ("%d / %d"):format(placed, Formulas.capacity(lvl)) },
					{ "Next capacity", ("%d bears"):format(Formulas.capacity(math.min(lvl + 1, E.Capacity.maxLevel))) },
					{ "Income", Format.perSec(player:GetAttribute("Income") or 0) },
				},
				can = not maxed and (d.money or 0) >= cost,
				button = if maxed then "MAX" else ("+1 Slot  %s"):format(Format.money(cost)),
				onClick = function() if not maxed then Net.event("UpgradeCapacity"):FireServer() end end,
			})
		end
	end
end

------------------------------------------------------------------------------------------
-- Sell / Bag (fish cards)
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

local function fishCards(w, mode)
	return function(animate)
		clear(w.content)
		local d = Data.values
		local fish = table.clone(d.fish or {})
		table.sort(fish, function(a, b) return Formulas.fishValue(a) > Formulas.fishValue(b) end)
		local total = 0
		for _, f in fish do total += Formulas.fishValue(f) end
		Sim.section(w.content, if mode == "Sell" then ("%d Fish  ·  %s"):format(#fish, Format.money(total)) else ("%d / %d Fish"):format(#fish, E.FishBagMax),
			{ Position = UDim2.new(0.5, 0, 0, 28) })
		if #fish == 0 then
			emptyText(w.content, if mode == "Sell" then "No fish to sell!\nFish at the end of your dock." else "Your bag is empty.\nGo to your dock and CAST!")
			return
		end
		local list = scroller(w.content, { Size = UDim2.new(1, 0, 1, -56), Position = UDim2.fromOffset(0, 54), Grid = Vector2.new(196, 268), Gap = 14, PadTop = 10 })
		for i, f in fish do
			local spec = FishConfig.get(f.s)
			local rar = spec.rarity
			local card, centre = Sim.card(list, { Name = "Fish" .. i, LayoutOrder = i, Size = Vector2.new(196, 268), Rarity = rar,
				Title = (if f.v ~= "Normal" then f.v .. " " else "") .. spec.name, RarityText = RarityConfig.get(rar).name, CenterTop = 72, CenterCut = 170 })
			Sim.model(centre, { kind = "Fish", id = f.s, variant = f.v, spin = true, spinSpeed = 0.8, size = UDim2.fromScale(1, 1.2) })
			Sim.infoBar(card, ('<font color="#FFD23F">%s</font>'):format(Format.kg(f.w)), { Size = UDim2.fromOffset(176, 32), Position = UDim2.fromOffset(98, 192), Max = 22, ZIndex = 6 })
			if mode == "Sell" then
				Sim.button(card, { Grad = "green", Size = Vector2.new(176, 46), Position = UDim2.fromOffset(98, 238), Text = Format.money(Formulas.fishValue(f)),
					Icon = K.Icons.Cash, IconSize = 0.9, Max = 30, ZIndex = 7 }, function() sellIds({ f.id }) end)
			else
				local held = d.selectedFish == f.id
				Sim.button(card, { Grad = if held then "yellow" else "green", Size = Vector2.new(176, 46), Position = UDim2.fromOffset(98, 238),
					Text = if held then "Holding" else "Hold", Max = 30, ZIndex = 7 }, function()
					Net.event("SelectFish"):FireServer(f.id)
					w.menu.Close()
				end)
			end
		end
		if animate then K.cascade(list, 0.03) end
	end
end

local function buildSell()
	local w = makeWindow("Sell", { title = "Sell Fish", grad = "green", size = Vector2.new(860, 480), titleWidth = 300 })
	Sim.button(w.titleRoot, { Name = "SellAll", Grad = "orange", Size = Vector2.new(170, 52), Position = UDim2.fromOffset(w.W - 170, w.HH / 2),
		Text = "Sell All", Max = 30, ZIndex = 9 }, function()
		local ids = {}
		for _, f in Data.values.fish or {} do
			if not valuable(f) then table.insert(ids, f.id) end
		end
		sellIds(ids)
	end)
	renderers.Sell = fishCards(w, "Sell")
end

local function buildBag()
	local w = makeWindow("Bag", { title = "Fish Bag", grad = "purple", size = Vector2.new(860, 480), titleWidth = 300 })
	renderers.Bag = fishCards(w, "Bag")
end

------------------------------------------------------------------------------------------
-- Index
------------------------------------------------------------------------------------------
local indexCat = "Fish"
local indexSel = nil
local indexScroll = {}
local function buildIndex()
	local w = makeWindow("Index", { title = "Index", grad = "pink", size = Vector2.new(820, 480) })
	local tabs = {}
	for i, cat in { "Fish", "Bears" } do
		tabs[cat] = Sim.button(w.frame, { Name = "Tab" .. cat, Grad = if cat == "Fish" then "blue" else "orange", Size = Vector2.new(170, 62),
			Position = UDim2.fromOffset(w.W + 100, 120 + (i - 1) * 76), Text = cat, Max = 34, Icon = if cat == "Fish" then K.Icons.Bait else K.Icons.Paw }, function()
			indexCat = cat
			indexSel = nil
			renderers.Index(true)
		end)
	end
	renderers.Index = function(animate)
		clear(w.content)
		for cat, b in tabs do
			b.Position = UDim2.fromOffset(if cat == indexCat then w.W + 110 else w.W + 100, b.Position.Y.Offset)
			local st = b:FindFirstChildOfClass("UIStroke")
			if st then st.Color = if cat == indexCat then Color3.new(1, 1, 1) else Color3.new(0, 0, 0) end
		end
		local d = Data.values
		local order = if indexCat == "Fish" then FishConfig.Order else BearConfig.Order
		local found = if indexCat == "Fish" then (d.index and d.index.fish or {}) else (d.index and d.index.bears or {})
		local left = Sim.panel(w.content, { Size = UDim2.fromOffset(520, 370), Position = UDim2.fromOffset(12, 12), Color = RGB(36, 36, 40), DarkStuds = true, ZIndex = 3 })
		-- scrolling grid (43 fish / 75 bears)
		local grid = new("ScrollingFrame", { BackgroundTransparency = 1, BorderSizePixel = 0, Size = UDim2.fromOffset(508, 282), Position = UDim2.fromOffset(6, 8), ZIndex = 4,
			CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollingDirection = Enum.ScrollingDirection.Y, ScrollBarThickness = 8,
			ScrollBarImageColor3 = RGB(230, 230, 230) }, left)
		new("UIPadding", { PaddingTop = UDim.new(0, 6), PaddingBottom = UDim.new(0, 8), PaddingRight = UDim.new(0, 10) }, grid)
		new("UIGridLayout", { CellSize = UDim2.fromOffset(112, 118), CellPadding = UDim2.fromOffset(10, 12), SortOrder = Enum.SortOrder.LayoutOrder,
			HorizontalAlignment = Enum.HorizontalAlignment.Center }, grid)
		if indexScroll[indexCat] then
			task.defer(function() if grid.Parent then grid.CanvasPosition = indexScroll[indexCat] end end)
		end
		grid:GetPropertyChangedSignal("CanvasPosition"):Connect(function() indexScroll[indexCat] = grid.CanvasPosition end)
		local n = 0
		for i, id in order do
			local entry = found[id]
			if entry then n += 1 end
			local spec = if indexCat == "Fish" then FishConfig.get(id) else BearConfig.get(id)
			local rar = if indexCat == "Fish" then spec.rarity else "Common"
			local tile = new("ImageButton", { Name = id, AutoButtonColor = false, Image = "", BackgroundColor3 = Color3.new(1, 1, 1), LayoutOrder = i, ZIndex = 5 }, grid)
			Sim.gradient(tile, if entry then Sim.RARITY_CARD[rar] else { RGB(80, 80, 86), RGB(46, 46, 52) }, 90)
			Sim.corner(tile, 4)
			Sim.stroke(tile, if indexSel == id then 4 else 3, if indexSel == id then Color3.new(1, 1, 1) else nil)
			Sim.studs(tile, { tile = 22, transparency = 0.75, z = 5 })
			Sim.model(tile, { kind = if indexCat == "Fish" then "Fish" else "Bear", id = id, silhouette = entry == nil, size = UDim2.fromScale(0.95, 0.8), position = UDim2.fromScale(0.5, 0.55) })
			Sim.text(tile, if entry then spec.name else "???", { Size = UDim2.new(1, -6, 0, 22), Position = UDim2.new(0.5, 0, 0, 14), Max = 18, ZIndex = 9 })
			new("UIScale", { Name = "ButtonScale" }, tile)
			Motion.BindButton(tile, 1.06, Sim.sounds, function()
				indexSel = id
				renderers.Index(false)
			end)
		end
		-- progress bar
		local bar = new("Frame", { BackgroundColor3 = RGB(30, 30, 34), Size = UDim2.fromOffset(330, 50), Position = UDim2.fromOffset(12, 306), ZIndex = 5, ClipsDescendants = true }, left)
		Sim.corner(bar, 4)
		Sim.stroke(bar, 3)
		local fill = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, Size = UDim2.fromScale(n / #order, 1), ZIndex = 6 }, bar)
		Sim.gradient(fill, Sim.G.green, 90)
		Sim.studs(fill, { tile = 22, z = 6 })
		Sim.text(bar, ("%d/%d"):format(n, #order), { Size = UDim2.fromScale(0.9, 0.8), Max = 36, ZIndex = 8 })
		local pending = d.indexPending and d.indexPending[indexCat] or 0
		local claim = Sim.button(left, { Grad = if pending > 0 then "blue" else "grey", Size = Vector2.new(160, 50), Position = UDim2.fromOffset(432, 331),
			Text = if pending > 0 then "Claim " .. Format.money(pending) else "Claim", Max = 24 }, function()
			Net.event("ClaimIndex"):FireServer(indexCat)
		end)
		if pending > 0 then K.shine(claim, 1.8) end
		-- detail panel
		local id = indexSel or order[1]
		local entry = found[id]
		local spec = if indexCat == "Fish" then FishConfig.get(id) else BearConfig.get(id)
		local rar = if indexCat == "Fish" then spec.rarity else "Common"
		local card, centre = Sim.card(w.content, { Size = Vector2.new(250, 370), Rarity = if entry then rar else "Secret", Title = if entry then spec.name else "???",
			RarityText = if indexCat == "Fish" then RarityConfig.get(rar).name else "Bear", CenterTop = 76, CenterCut = 180 })
		card.Position = UDim2.fromOffset(548, 12)
		Sim.model(centre, { kind = if indexCat == "Fish" then "Fish" else "Bear", id = id, silhouette = entry == nil, spin = entry ~= nil, size = UDim2.fromScale(1, 1.1) })
		local info = if entry then ("Caught %d"):format(entry.n) else "Not found"
		Sim.infoBar(card, info, { Size = UDim2.fromOffset(226, 34), Position = UDim2.fromOffset(125, 272), ZIndex = 6 })
		Sim.infoBar(card, if entry then ('Best <font color="#FFD23F">%s</font>'):format(Format.kg(entry.best)) else "???", { Size = UDim2.fromOffset(226, 34), Position = UDim2.fromOffset(125, 310), ZIndex = 6 })
		Sim.infoBar(card, ('Reward <font color="#7CFF46">%s</font>'):format(Format.money(E.IndexReward[indexCat])), { Size = UDim2.fromOffset(226, 30), Position = UDim2.fromOffset(125, 346), Max = 20, ZIndex = 6 })
		if animate then K.cascade(grid, 0.04) end
	end
end

------------------------------------------------------------------------------------------
-- Bears
------------------------------------------------------------------------------------------
local function bearCards(w)
	return function(animate)
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
		Sim.section(w.content, ("%d/%d In Base  ·  %s"):format(placed, Formulas.capacity(d.capacity or 1), Format.perSec(player:GetAttribute("Income") or 0)),
			{ Position = UDim2.new(0.5, 0, 0, 28) })
		if #list == 0 then
			emptyText(w.content, "No bears yet!\nThrow a fish into the forest and bring the bear home.")
			return
		end
		local grid = scroller(w.content, { Size = UDim2.new(1, 0, 1, -56), Position = UDim2.fromOffset(0, 54), Grid = Vector2.new(196, 292), Gap = 14, PadTop = 10 })
		for i, b in list do
			local spec = BearConfig.get(b.s)
			local tier = RarityConfig.get(b.r)
			local card, centre = Sim.card(grid, { Name = "Bear" .. i, LayoutOrder = i, Size = Vector2.new(196, 292), Rarity = b.r,
				Title = (if b.v ~= "Normal" then b.v .. " " else "") .. spec.name, RarityText = tier.name, CenterTop = 72, CenterCut = 190 })
			Sim.model(centre, { kind = "Bear", id = b.s, variant = b.v, size = UDim2.fromScale(1, 1.15) })
			Sim.infoBar(card, ('<font color="#7CFF46">%s</font>  %s'):format(Format.perSec(Formulas.bearIncome(b)), Format.kg(b.w)), { Size = UDim2.fromOffset(176, 32), Position = UDim2.fromOffset(98, 196), Max = 20, ZIndex = 6 })
			Sim.button(card, { Grad = if b.placed then "yellow" else "green", Size = Vector2.new(176, 40), Position = UDim2.fromOffset(98, 234),
				Text = if b.placed then "Pick Up" else "Place", Max = 26, ZIndex = 7 }, function()
				if b.placed then Net.event("PickupBear"):FireServer(b.id) else Net.event("TakeFromStorage"):FireServer(b.id) end
				w.menu.Close()
			end)
			Sim.button(card, { Grad = "red", Size = Vector2.new(176, 32), Position = UDim2.fromOffset(98, 272), Text = "Sell " .. Format.money(Formulas.bearSellValue(b)), Max = 20, ZIndex = 7 }, function()
				Menus.confirm(("Sell %s %s for %s?"):format(tier.name, spec.name, Format.money(Formulas.bearSellValue(b))), function()
					Net.event("SellBear"):FireServer(b.id, true)
				end)
			end)
		end
		if animate then K.cascade(grid, 0.04) end
	end
end

local function buildBears()
	local w = makeWindow("Bears", { title = "My Bears", grad = "purple", size = Vector2.new(860, 480) })
	renderers.Bears = bearCards(w)
end

------------------------------------------------------------------------------------------
-- Inventory : "Bears + Fish" (replaces the default Roblox inventory button)
-- Bears tab = collection cards (Pick Up / Place / Sell), Fish tab = fish bag cards (Hold)
------------------------------------------------------------------------------------------
local invTab = "Bears"
local function buildInventory()
	local w = makeWindow("Inventory", { title = "Bears + Fish", grad = "purple", size = Vector2.new(860, 480), titleWidth = 380 })
	local sub = { Bears = bearCards(w), Fish = fishCards(w, "Bag") }
	local tabs = {}
	for i, cat in { "Bears", "Fish" } do
		tabs[cat] = Sim.button(w.frame, { Name = "Tab" .. cat, Grad = if cat == "Fish" then "blue" else "orange", Size = Vector2.new(170, 62),
			Position = UDim2.fromOffset(w.W + 100, 120 + (i - 1) * 76), Text = cat, Max = 34, Icon = if cat == "Fish" then K.Icons.Bait else K.Icons.Paw }, function()
			if invTab == cat then return end
			invTab = cat
			renderers.Inventory(true)
		end)
	end
	renderers.Inventory = function(animate)
		for cat, b in tabs do
			b.Position = UDim2.fromOffset(if cat == invTab then w.W + 110 else w.W + 100, b.Position.Y.Offset)
			local st = b:FindFirstChildOfClass("UIStroke")
			if st then st.Color = if cat == invTab then Color3.new(1, 1, 1) else Color3.new(0, 0, 0) end
		end
		sub[invTab](animate)
	end
end

------------------------------------------------------------------------------------------
-- Daily rewards
------------------------------------------------------------------------------------------
local DAILY_RARITY = { "Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "UltraSecret" }
local function buildDaily()
	local w = makeWindow("Daily", { title = "Daily Rewards", grad = "blue", size = Vector2.new(860, 440), titleWidth = 420 })
	local claimBtn
	renderers.Daily = function(animate)
		clear(w.content)
		local dd = Data.values.daily or { streak = 0, last = 0 }
		local now = os.time()
		local ready = now - dd.last >= E.Daily.cooldown
		local streak = if now - dd.last > E.Daily.resetAfter then 0 else dd.streak
		local today = streak % #E.Daily.rewards + 1
		local row = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 220), Position = UDim2.fromOffset(0, 20), ZIndex = 3 }, w.content)
		new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Center, Padding = UDim.new(0, 10),
			SortOrder = Enum.SortOrder.LayoutOrder }, row)
		for i, amount in E.Daily.rewards do
			local done = i < today or (i == today and not ready)
			local cur = i == today and ready
			local card, centre = Sim.card(row, { Name = "Day" .. i, LayoutOrder = i, Size = Vector2.new(106, 210), Rarity = if done then "Secret" else DAILY_RARITY[i],
				Title = "Day " .. i, CenterTop = 44, CenterCut = 96 })
			new("ImageLabel", { BackgroundTransparency = 1, Image = if i == 7 then K.Icons.GoldCash else K.Icons.Cash, ScaleType = Enum.ScaleType.Fit,
				Size = UDim2.fromScale(0.9, 0.9), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), Rotation = -8, ZIndex = 6 }, centre)
			Sim.infoBar(card, ('<font color="#7CFF46">%s</font>'):format(Format.money(amount)), { Size = UDim2.fromOffset(94, 32), Position = UDim2.fromOffset(53, 176), Max = 20, ZIndex = 6 })
			if done then
				new("ImageLabel", { BackgroundTransparency = 1, Image = K.Icons.Check, Size = UDim2.fromOffset(54, 54), Position = UDim2.fromOffset(53, 110),
					AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 9 }, card)
			end
			if cur then
				local st = card:FindFirstChildOfClass("UIStroke")
				if st then
					st.Color = RGB(180, 255, 25)
					Motion.PulseStroke(st, 4, 2, 5)
				end
			end
		end
		claimBtn = Sim.button(w.content, { Grad = if ready then "green" else "grey", Size = Vector2.new(380, 72), Position = UDim2.new(0.5, 0, 0, 290),
			Text = if ready then ("Claim Day %d!"):format(today) else "Next in " .. Format.time(E.Daily.cooldown - (now - dd.last)), Max = 38, Icon = K.Icons.Daily },
			function() Net.event("ClaimDaily"):FireServer() end)
		if ready then K.shine(claimBtn, 1.6) end
		if animate then K.cascade(row, 0.06) end
	end
	task.spawn(function()
		while true do
			task.wait(1)
			if w.menu.IsOpen and claimBtn and claimBtn.Parent then
				local dd = Data.values.daily or { last = 0 }
				local left = E.Daily.cooldown - (os.time() - dd.last)
				if left > 0 then Sim.setText(claimBtn, "Next in " .. Format.time(left)) end
			end
		end
	end)
end

------------------------------------------------------------------------------------------
-- Gifts
------------------------------------------------------------------------------------------
local function claimedSet(): { [number]: boolean }
	local out = {}
	for n in string.gmatch(player:GetAttribute("GiftsClaimed") or "", "(%d+),") do out[tonumber(n)] = true end
	return out
end

local function buildGifts()
	local w = makeWindow("Rewards", { title = "Gifts", grad = "pink", size = Vector2.new(860, 480) })
	local cards = {}
	renderers.Rewards = function(animate)
		clear(w.content)
		table.clear(cards)
		Sim.section(w.content, "Stay To Open Gifts", { Position = UDim2.new(0.5, 0, 0, 28) })
		local grid = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, -20, 1, -64), Position = UDim2.fromOffset(10, 56), ZIndex = 3 }, w.content)
		new("UIGridLayout", { CellSize = UDim2.fromOffset(186, 164), CellPadding = UDim2.fromOffset(14, 14), HorizontalAlignment = Enum.HorizontalAlignment.Center,
			SortOrder = Enum.SortOrder.LayoutOrder }, grid)
		for i, g in E.Playtime do
			local card, centre = Sim.card(grid, { Name = "Gift" .. i, LayoutOrder = i, Size = Vector2.new(186, 164), Rarity = "Legendary",
				Title = Format.money(g.money) .. "+", CenterTop = 46, CenterCut = 96 })
			local icon = new("ImageLabel", { Name = "GiftIcon", BackgroundTransparency = 1, Image = K.Icons.Gift, ScaleType = Enum.ScaleType.Fit, Size = UDim2.fromScale(1, 1),
				Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 6 }, centre)
			local btn = Sim.button(card, { Grad = "grey", Size = Vector2.new(166, 40), Position = UDim2.fromOffset(93, 136), Text = "", Max = 24, ZIndex = 7 }, function()
				local joined = player:GetAttribute("JoinedAt") or workspace:GetServerTimeNow()
				if workspace:GetServerTimeNow() - joined >= g.minutes * 60 and not claimedSet()[i] then
					Net.event("ClaimPlaytime"):FireServer(i)
				else
					Motion.Shake(card)
				end
			end)
			cards[i] = { card = card, icon = icon, btn = btn, ready = nil }
		end
		renderers.RewardsTick()
		if animate then K.cascade(grid, 0.05) end
	end
	renderers.RewardsTick = function()
		local joined = player:GetAttribute("JoinedAt") or workspace:GetServerTimeNow()
		local played = workspace:GetServerTimeNow() - joined
		local claimed = claimedSet()
		for i, c in cards do
			local g = E.Playtime[i]
			local left = g.minutes * 60 - played
			local ready = left <= 0 and not claimed[i]
			Sim.setText(c.btn, if claimed[i] then "Opened" elseif ready then "Open!" else Format.time(left))
			if c.ready ~= ready then
				c.ready = ready
				Sim.recolor(c.btn, if ready then "green" else "grey")
			end
			c.icon.Rotation = if ready then math.sin(os.clock() * 9) * 12 else 0
			c.icon.ImageTransparency = if claimed[i] then 0.5 else 0
		end
	end
	task.spawn(function()
		while true do
			task.wait(0.1)
			if w.menu.IsOpen and renderers.RewardsTick then renderers.RewardsTick() end
		end
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
	buildInventory()
	buildDaily()
	buildGifts()
	buildConfirm()
	local KEYS = {
		Shop = { rods = true, strength = true, strengthGain = true, capacity = true, money = "throttle" },
		Sell = { fish = true }, Bag = { fish = true, selectedFish = true },
		Index = { index = true, indexPending = true }, Bears = { bears = true, capacity = true }, Inventory = { bears = true, capacity = true, fish = true, selectedFish = true }, Daily = { daily = true },
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
	if w.menu.IsOpen then w.menu.Close() else w.menu.Open() end
end

Menus.windows = windows
return Menus
