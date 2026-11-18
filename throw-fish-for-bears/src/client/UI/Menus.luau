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
local FishUpConfig = require(Shared.Config.FishUpConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local Sim = require(script.Parent.Sim)
local K = require(script.Parent.Kit)
local Viewport = require(script.Parent.Viewport)
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
local strengthRefresh = nil -- live update of the Strength page (no rebuild)
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
			local rar = if rod.exclusive then "Secret" else (ROD_RARITY[i] or "Common")
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
			elseif rod.exclusive then
				-- index-only rod: shows where it comes from
				bp.Grad = "dark"; bp.Text = "INDEX REWARD"; bp.Max = 26
				Sim.button(card, bp)
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

	--[[ Strength page: hero card with the 3D fish dumbbell of your FISH-UP tier,
	     "+4 -> +5 per lift" tiles, progress to the next zone, tier ladder, big upgrade. ]]
	local lastGain = nil
	local dumbbellYaw = math.rad(-20) -- kept between rebuilds so the 3D spin never restarts
	local dumbbellVp = nil
	strengthRefresh = nil
	local function strengthPage(animate)
		local d = Data.values
		local gain = d.strengthGain or 1
		local maxed = gain >= E.Strength.maxGain
		local tierIdx = FishUpConfig.tierFor(gain)
		local tier = FishUpConfig.get(tierIdx)
		local gained = lastGain ~= nil and gain > lastGain
		lastGain = gain

		-- hero card ------------------------------------------------------------------
		local hero = Sim.panel(body, { Size = UDim2.fromOffset(286, 356), Position = UDim2.fromOffset(16, 14), Gradient = { RGB(255, 132, 60), RGB(196, 26, 44) }, Stroke = 4, ZIndex = 3, Clip = true })
		Sim.bands(hero, 0.5, 4)
		local badge = Sim.panel(hero, { Size = UDim2.fromOffset(240, 40), Position = UDim2.fromOffset(23, 12), Color = RGB(36, 36, 42), DarkStuds = true, ZIndex = 6 })
		Sim.text(badge, tier.name:upper() .. " FISH-UP", { Size = UDim2.new(1, -16, 0.8, 0), Max = 24, ZIndex = 7, Gradient = { RGB(255, 255, 255), tier.color } })
		local stage = Sim.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(270, 170), Position = UDim2.fromOffset(8, 56), ZIndex = 5 }, hero)
		dumbbellVp = Sim.model(stage, { kind = "Dumbbell", id = tierIdx, spin = true, spinSpeed = 0.9, yaw = dumbbellYaw, pitch = math.rad(22), zoom = 0.78, size = UDim2.fromScale(1, 1) })
		local powerLabel = Sim.text(hero, "", { Size = UDim2.fromOffset(260, 62), Position = UDim2.fromOffset(143, 262), Max = 58, Stroke = 4.5,
			Gradient = { RGB(255, 250, 210), RGB(255, 196, 40) }, ZIndex = 7 })
		local info = Sim.infoBar(hero, "", { Size = UDim2.fromOffset(262, 34), Position = UDim2.fromOffset(143, 318), Max = 19, ZIndex = 6 })

		-- per lift tiles ---------------------------------------------------------------
		local X0 = 318
		local function tile(x, label, value, grad, glow)
			local t = Sim.panel(body, { Size = UDim2.fromOffset(200, 96), Position = UDim2.fromOffset(x, 14), Gradient = grad, Stroke = 4, ZIndex = 4 })
			Sim.text(t, label, { Size = UDim2.fromOffset(180, 24), Position = UDim2.fromOffset(100, 18), Max = 20, ZIndex = 6 })
			Sim.text(t, value, { Size = UDim2.fromOffset(190, 56), Position = UDim2.fromOffset(100, 60), Max = 54, Stroke = 4, ZIndex = 6 })
			if glow then K.shine(t, 2.2) end
			return t
		end
		tile(X0, "NOW", ("+%d"):format(gain), Sim.G.dark, false)
		Sim.text(body, "➜", { Size = UDim2.fromOffset(60, 60), Position = UDim2.fromOffset(X0 + 260, 62), Max = 54, Stroke = 4, Gradient = { RGB(255, 255, 255), RGB(255, 200, 40) }, ZIndex = 6 })
		local nextTile = tile(X0 + 318, if maxed then "MAXED" else "NEXT", if maxed then "MAX" else ("+%d"):format(gain + 1), Sim.G.green, not maxed)
		Sim.text(body, "strength per lift", { Size = UDim2.fromOffset(300, 22), Position = UDim2.fromOffset(X0 + 259, 122), Max = 20, Stroke = 2.5, Color = RGB(220, 225, 235), ZIndex = 6 })

		-- next zone progress -------------------------------------------------------------
		local barY = 148
		local head = Sim.text(body, "", { Size = UDim2.fromOffset(518, 24), Position = UDim2.fromOffset(X0, barY + 10), AnchorPoint = Vector2.new(0, 0.5), AlignX = Enum.TextXAlignment.Left, Max = 22, Rich = true, ZIndex = 6 })
		local bar = Sim.new("Frame", { BackgroundColor3 = RGB(30, 30, 34), Size = UDim2.fromOffset(518, 34), Position = UDim2.fromOffset(X0, barY + 24), ZIndex = 4, ClipsDescendants = true }, body)
		Sim.corner(bar, 4)
		Sim.stroke(bar, 3)
		local fill = Sim.new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, Size = UDim2.fromScale(0, 1), ZIndex = 5 }, bar)
		Sim.gradient(fill, Sim.G.orange, 90)
		Sim.studs(fill, { tile = 18, z = 5, strong = true })
		local barText = Sim.text(bar, "", { Size = UDim2.new(1, -12, 0.78, 0), Max = 20, ZIndex = 7 })

		-- tier ladder -----------------------------------------------------------------
		local ladderY = 218
		for i, t in FishUpConfig.Tiers do
			local on = i <= tierIdx
			local cur = i == tierIdx
			local sq = Sim.panel(body, { Size = UDim2.fromOffset(78, 40), Position = UDim2.fromOffset(X0 + (i - 1) * 86, ladderY), Color = if on then t.color else RGB(70, 70, 78),
				Stroke = if cur then 4 else 3, StrokeColor = if cur then Color3.new(1, 1, 1) else nil, ZIndex = 4 })
			Sim.text(sq, if on then t.name else ("+" .. t.minGain), { Size = UDim2.new(1, -8, 0.7, 0), Max = 18, ZIndex = 6 })
		end
		local nextTier = FishUpConfig.Tiers[tierIdx + 1]
		Sim.text(body, if nextTier then ('New FISH-UP look at <font color="#FFD23F">+%d</font> per lift'):format(nextTier.minGain) else "Your FISH-UP is fully upgraded!",
			{ Size = UDim2.fromOffset(518, 22), Position = UDim2.fromOffset(X0 + 259, ladderY + 54), Max = 19, Rich = true, Stroke = 2.5, ZIndex = 6 })

		-- upgrade button ----------------------------------------------------------------
		local btn = Sim.button(body, { Grad = "green", Size = Vector2.new(518, 72), Position = UDim2.fromOffset(X0 + 259, 330),
			Text = "", Max = 36, Icon = K.Icons.Cash, ZIndex = 6 }, function()
			local dd = Data.values
			if (dd.strengthGain or 1) < E.Strength.maxGain then Net.event("BuyStrength"):FireServer() end
		end)
		local shined = false

		-- live values: strength and money only update texts / bars (no rebuild, so the
		-- 3D dumbbell keeps spinning smoothly in a loop)
		local lastFrac = nil
		local function refresh()
			local dd = Data.values
			local power = dd.strength or 0
			local money = dd.money or 0
			local cost = E.Strength.gainCost(gain)
			powerLabel.Text = "💪 " .. Format.short(power)
			info.Text.Text = ('Throw <font color="#7CFF46">%d</font> studs  ·  Fish <font color="#FFD23F">%s</font>'):format(E.Strength.maxDistance(power), Format.kg(E.Strength.maxFishWeight(power)))
			local nextZ
			for i = 1, #ZoneConfig.Zones do
				if power < Formulas.zoneStrength(i) then nextZ = i break end
			end
			local frac
			if nextZ then
				local need = Formulas.zoneStrength(nextZ)
				local prev = if nextZ > 1 then Formulas.zoneStrength(nextZ - 1) else 0
				frac = math.clamp((power - prev) / math.max(1, need - prev), 0, 1)
				head.Text = ('Next zone: <font color="#7CFF46">%s</font>'):format(ZoneConfig.get(nextZ).name)
				barText.Text = ("%s / %s  ·  ~%s lifts"):format(Format.short(power), Format.short(need), Format.short(math.ceil(math.max(0, need - power) / gain)))
			else
				frac = 1
				head.Text = '<font color="#FFD23F">Every zone unlocked!</font>'
				barText.Text = "MAX DISTANCE"
			end
			if frac ~= lastFrac then
				lastFrac = frac
				game:GetService("TweenService"):Create(fill, TweenInfo.new(0.5, Enum.EasingStyle.Quint), { Size = UDim2.fromScale(math.max(frac, 0.02), 1) }):Play()
			end
			local can = not maxed and money >= cost
			Sim.setText(btn, if maxed then "MAXED" elseif can then ("UPGRADE  %s"):format(Format.money(cost)) else ("Need %s more"):format(Format.money(cost - money)))
			Sim.recolor(btn, if can then "green" elseif maxed then "grey" else "light")
			if can and not shined then
				shined = true
				K.shine(btn, 1.8)
			end
		end
		refresh()
		strengthRefresh = refresh

		if animate then
			for _, o in { hero, btn } do Motion.PopIn(o, 0.4) end
		end
		if gained then
			Motion.PopIn(nextTile, 0.45)
			Motion.PopIn(hero, 0.35)
		end
	end

	renderers.Shop = function(animate)
		if dumbbellVp then
			dumbbellYaw = Viewport.yawOf(dumbbellVp) or dumbbellYaw
			dumbbellVp = nil
		end
		strengthRefresh = nil
		clear(body)
		for name, b in tabs do Sim.recolor(b, if name == shopTab then "yellow" else "grey") end
		local titleLabel = w.titleRoot:FindFirstChild("Title")
		if titleLabel then titleLabel.Text = if shopTab == "Strength" then "Strength" else "Rod Shop" end
		local d = Data.values
		if shopTab == "Rods" then
			rodsTab(animate)
		elseif shopTab == "Strength" then
			strengthPage(animate)
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
		Sim.section(w.content, if mode == "Sell" then ("%d Fish  ·  %s"):format(#fish, Format.money(total)) else ("%d Fish"):format(#fish),
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
local indexVar = nil -- nil = normal index, else a mutation ("Golden", "Diamond", ...)
local indexSel = nil
local indexScroll = {}
local IndexConfig = require(Shared.Config.IndexConfig)

-- mutation pill looks (left side of the window)
local VAR_LOOK = {
	Golden = { RGB(255, 236, 130), RGB(222, 150, 20) },
	Diamond = { RGB(190, 245, 255), RGB(40, 140, 235) },
	Ancient = { RGB(170, 176, 150), RGB(70, 120, 60) },
	Rainbow = { RGB(255, 120, 200), RGB(120, 120, 255) },
	Clockwork = { RGB(232, 190, 110), RGB(150, 84, 36) },
}

-- the best rarity a bear species was caught in
local function bestRarity(entry): string?
	if not entry or not entry.r then return nil end
	local best, bi = nil, 0
	for r in entry.r do
		local t = RarityConfig.Tiers[r]
		if t and t.index > bi then best, bi = r, t.index end
	end
	return best
end

local function rewardText(rw): string
	local parts = { ('<font color="#7CFF46">%s</font>'):format(Format.money(rw.money)), ('<font color="#FFD23F">+%.1f%% luck</font>'):format(rw.luck * 100) }
	if rw.fish then table.insert(parts, ('<font color="#7CD4FF">%s fish</font>'):format(RarityConfig.get(rw.fish).name)) end
	if rw.rod then table.insert(parts, ('<font color="#FF9CF0">%s</font>'):format(RodConfig.get(rw.rod).name)) end
	return table.concat(parts, "  ·  ")
end

-- a small dark reward "chip": icon (image or mini 3D model) + coloured text
local function rewardChip(parent, width: number, text: string, icon: string?, model)
	local chip = new("Frame", { Name = "Chip", BackgroundColor3 = RGB(30, 30, 34), BorderSizePixel = 0, Size = UDim2.fromOffset(width, 34), ZIndex = 7 }, parent)
	Sim.corner(chip, 4)
	Sim.stroke(chip, 2.5, RGB(14, 14, 16))
	Sim.studs(chip, { dark = true, tile = 18, transparency = 0.55, z = 7 })
	if icon then
		new("ImageLabel", { BackgroundTransparency = 1, Image = icon, ScaleType = Enum.ScaleType.Fit, Size = UDim2.fromOffset(30, 30),
			Position = UDim2.fromOffset(18, 17), AnchorPoint = Vector2.new(0.5, 0.5), Rotation = -8, ZIndex = 9 }, chip)
	elseif model then
		local holder = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(36, 34), Position = UDim2.fromOffset(2, 0), ZIndex = 8 }, chip)
		Sim.model(holder, { kind = model.kind, id = model.id, alive = false, size = UDim2.fromScale(1.2, 1.2), zindex = 9 })
	end
	Sim.text(chip, text, { Size = UDim2.new(1, -42, 0.7, 0), Position = UDim2.new(0, 38, 0.5, 0), AnchorPoint = Vector2.new(0, 0.5),
		AlignX = Enum.TextXAlignment.Left, Max = 17, Stroke = 2.5, Rich = true, ZIndex = 9 })
	return chip
end

-- the first fish species of a rarity (picture of a "guaranteed <rarity> fish" reward)
local function fishOfRarity(r: string): string?
	for _, id in FishConfig.Order do
		if FishConfig.get(id).rarity == r then return id end
	end
	return nil
end

local function buildIndex()
	local w = makeWindow("Index", { title = "Index", grad = "pink", size = Vector2.new(960, 540), factor = 0.84 }) -- wide: pills + tabs outside
	-- RIGHT (outside the window): Fish / Bears
	local tabs = {}
	for i, cat in { "Fish", "Bears" } do
		tabs[cat] = Sim.button(w.frame, { Name = "Tab" .. cat, Grad = if cat == "Fish" then "blue" else "orange", Size = Vector2.new(170, 62),
			Position = UDim2.fromOffset(w.W + 100, 120 + (i - 1) * 76), Text = cat, Max = 34, Icon = if cat == "Fish" then K.Icons.Bait else K.Icons.Paw }, function()
			indexCat = cat
			indexSel = nil
			renderers.Index(true)
		end)
	end
	-- LEFT (outside the window): the mutation index pills (tap again: back to the normal index)
	local vtabs = {}
	for i, v in IndexConfig.Variants do
		local b = Sim.button(w.frame, { Name = "Var" .. v, Grad = "light", Size = Vector2.new(176, 58),
			Position = UDim2.fromOffset(-104, 92 + (i - 1) * 70), Text = v:upper(), Max = 28 }, function()
			indexVar = if indexVar == v then nil else v
			indexSel = nil
			renderers.Index(true)
		end)
		local g = b:FindFirstChildOfClass("UIGradient")
		if g then g.Color = ColorSequence.new(VAR_LOOK[v][1], VAR_LOOK[v][2]) end
		vtabs[v] = { b = b, g = g }
	end
	-- the rainbow pill really cycles its colours
	task.spawn(function()
		while w.frame.Parent do
			local rb = vtabs.Rainbow
			if rb and rb.g and w.menu.IsOpen then
				local h = (os.clock() * 0.25) % 1
				rb.g.Color = ColorSequence.new(Color3.fromHSV(h, 0.55, 1), Color3.fromHSV((h + 0.35) % 1, 0.75, 1))
			end
			task.wait(0.05)
		end
	end)

	local CW = 952 -- content width
	local LISTW = 664
	renderers.Index = function(animate)
		clear(w.content)
		for cat, b in tabs do
			b.Position = UDim2.fromOffset(if cat == indexCat then w.W + 110 else w.W + 100, b.Position.Y.Offset)
			local st = b:FindFirstChildOfClass("UIStroke")
			if st then st.Color = if cat == indexCat then Color3.new(1, 1, 1) else Color3.new(0, 0, 0) end
		end
		for v, t in vtabs do
			t.b.Position = UDim2.fromOffset(if v == indexVar then -116 else -104, t.b.Position.Y.Offset)
			local st = t.b:FindFirstChildOfClass("UIStroke")
			if st then st.Color = if v == indexVar then Color3.new(1, 1, 1) else Color3.new(0, 0, 0) end
		end
		local d = Data.values
		local index = d.index or { fish = {}, bears = {} }
		local claims = d.indexClaims or {}
		local isFish = indexCat == "Fish"
		local book = if isFish then (index.fish or {}) else (index.bears or {})
		local sections = IndexConfig.sections(indexCat, indexVar)
		local accent = if indexVar then VAR_LOOK[indexVar] else (if isFish then { RGB(150, 230, 255), RGB(40, 140, 240) } else { RGB(255, 214, 120), RGB(240, 130, 30) })

		-- TOP BAR: title · overall progress · pending discovery money ---------------------------
		local all, got = 0, 0
		for _, s in sections do
			local n, total = IndexConfig.progress(index, s)
			got += n
			all += total
		end
		Sim.text(w.content, ("%s%s INDEX"):format(if indexVar then indexVar:upper() .. " " else "", indexCat:upper()),
			{ Size = UDim2.fromOffset(300, 40), Position = UDim2.fromOffset(18, 34), AnchorPoint = Vector2.new(0, 0.5), AlignX = Enum.TextXAlignment.Left,
				Max = 34, Stroke = 3.5, Gradient = accent, ZIndex = 6 })
		local pct = got / math.max(1, all)
		local tb = new("Frame", { Name = "Total", BackgroundColor3 = RGB(26, 26, 30), BorderSizePixel = 0, Size = UDim2.fromOffset(330, 30),
			Position = UDim2.fromOffset(328, 19), ZIndex = 5, ClipsDescendants = true }, w.content)
		Sim.corner(tb, 5)
		Sim.stroke(tb, 3)
		local tf = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, Size = UDim2.fromScale(if animate then 0 else pct, 1), ZIndex = 6 }, tb)
		Sim.corner(tf, 5)
		Sim.gradient(tf, if pct >= 1 then Sim.G.green else accent, 90)
		Sim.studs(tf, { tile = 16, transparency = 0.7, z = 6 })
		if animate then
			game:GetService("TweenService"):Create(tf, TweenInfo.new(0.8, Enum.EasingStyle.Quint, Enum.EasingDirection.Out), { Size = UDim2.fromScale(pct, 1) }):Play()
		end
		Sim.text(tb, ("%d / %d  ·  %d%%"):format(got, all, math.floor(pct * 100 + 0.5)), { Size = UDim2.new(1, -10, 0.78, 0), Max = 20, Stroke = 2.5, ZIndex = 8 })
		local pending = d.indexPending and d.indexPending[indexCat] or 0
		local claim = Sim.button(w.content, { Grad = if pending > 0 then "green" else "grey", Size = Vector2.new(250, 40), Position = UDim2.fromOffset(810, 34),
			Text = if pending > 0 then "Collect " .. Format.money(pending) else "Discoveries collected", Max = 20, Icon = K.Icons.Cash, IconSize = 0.8, ZIndex = 6 }, function()
			Net.event("ClaimIndex"):FireServer(indexCat)
		end)
		if pending > 0 then K.shine(claim, 1.8) end

		-- SECTIONS ----------------------------------------------------------------------------
		local list = new("ScrollingFrame", { BackgroundTransparency = 1, BorderSizePixel = 0, Size = UDim2.fromOffset(LISTW, 380), Position = UDim2.fromOffset(6, 64), ZIndex = 4,
			CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollingDirection = Enum.ScrollingDirection.Y, ScrollBarThickness = 8,
			ScrollBarImageColor3 = RGB(230, 230, 230) }, w.content)
		new("UIPadding", { PaddingTop = UDim.new(0, 6), PaddingBottom = UDim.new(0, 12), PaddingRight = UDim.new(0, 14), PaddingLeft = UDim.new(0, 6) }, list)
		new("UIListLayout", { Padding = UDim.new(0, 18), SortOrder = Enum.SortOrder.LayoutOrder }, list)
		local scrollKey = indexCat .. (indexVar or "")
		if indexScroll[scrollKey] then
			task.defer(function() if list.Parent then list.CanvasPosition = indexScroll[scrollKey] end end)
		end
		list:GetPropertyChangedSignal("CanvasPosition"):Connect(function() indexScroll[scrollKey] = list.CanvasPosition end)
		local SW = LISTW - 22 -- section width
		local firstId = nil
		for si, s in sections do
			local n, total = IndexConfig.progress(index, s)
			local done = n >= total
			local claimed = claims[s.key] == true
			local rw = s.reward
			local sec = new("Frame", { Name = "Section" .. si, BackgroundTransparency = 1, Size = UDim2.fromOffset(SW, 0), AutomaticSize = Enum.AutomaticSize.Y, LayoutOrder = si }, list)
			new("UIListLayout", { Padding = UDim.new(0, 0), SortOrder = Enum.SortOrder.LayoutOrder }, sec)
			local col = s.color or RGB(120, 120, 130)
			-- 1 · header plate in the zone / rarity colour
			local hp = Sim.panel(sec, { Size = UDim2.fromOffset(SW, 58), Gradient = { col:Lerp(Color3.new(1, 1, 1), 0.3), col:Lerp(Color3.new(0, 0, 0), 0.3) }, Stroke = 3, ZIndex = 5, LayoutOrder = 1 })
			Sim.bands(hp, 0.7, 5)
			hp.ClipsDescendants = true
			Sim.text(hp, s.title, { Size = UDim2.fromOffset(360, 26), Position = UDim2.fromOffset(14, 19), AnchorPoint = Vector2.new(0, 0.5), Max = 24, Stroke = 3, ZIndex = 7,
				AlignX = Enum.TextXAlignment.Left })
			local bar = new("Frame", { BackgroundColor3 = RGB(26, 26, 30), Size = UDim2.fromOffset(220, 14), Position = UDim2.fromOffset(14, 36), ZIndex = 6, BorderSizePixel = 0, ClipsDescendants = true }, hp)
			Sim.corner(bar, 4)
			Sim.stroke(bar, 2)
			local fill = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, Size = UDim2.fromScale(math.clamp(n / math.max(1, total), 0, 1), 1), ZIndex = 7 }, bar)
			Sim.corner(fill, 4)
			Sim.gradient(fill, if done then Sim.G.green else Sim.G.yellow, 90)
			Sim.text(hp, ("%d/%d"):format(n, total), { Size = UDim2.fromOffset(70, 20), Position = UDim2.fromOffset(244, 43), AnchorPoint = Vector2.new(0, 0.5),
				AlignX = Enum.TextXAlignment.Left, Max = 18, Stroke = 2.5, ZIndex = 7, Color = if done then RGB(140, 255, 80) else Color3.new(1, 1, 1) })
			local cb = Sim.button(hp, { Grad = if claimed then "grey" elseif done then "green" else "dark", Size = Vector2.new(140, 40), Position = UDim2.fromOffset(SW - 82, 29),
				Text = if claimed then "CLAIMED" elseif done then "CLAIM!" else "LOCKED", Icon = if claimed then K.Icons.Check elseif done then nil else K.Icons.Lock,
				IconSize = 0.7, Max = 20, ZIndex = 8 }, function()
				if done and not claimed then Net.event("ClaimIndexSection"):FireServer(s.key) end
			end)
			if done and not claimed then K.shine(cb, 1.4) end
			-- 2 · the reward strip (chips + the 3D showcase of an exclusive rod)
			local hasRod = rw.rod ~= nil and RodConfig.get(rw.rod) ~= nil
			local strip = new("Frame", { Name = "Reward", BackgroundColor3 = RGB(44, 44, 50), BorderSizePixel = 0, Size = UDim2.fromOffset(SW, if hasRod then 128 else 62),
				ZIndex = 5, LayoutOrder = 2 }, sec)
			Sim.stroke(strip, 3)
			Sim.studs(strip, { dark = true, tile = 24, transparency = 0.5, z = 5 })
			Sim.text(strip, if claimed then "REWARD  ·  CLAIMED" else "REWARD", { Size = UDim2.fromOffset(200, 16), Position = UDim2.fromOffset(12, 11), AnchorPoint = Vector2.new(0, 0.5),
				AlignX = Enum.TextXAlignment.Left, Max = 14, Stroke = 2, Color = RGB(200, 200, 210), ZIndex = 7 })
			local chips = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(if hasRod then SW - 250 else SW - 20, 34), Position = UDim2.fromOffset(10, 22), ZIndex = 6 }, strip)
			new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder,
				VerticalAlignment = Enum.VerticalAlignment.Center }, chips)
			rewardChip(chips, 120, ('<font color="#7CFF46">%s</font>'):format(Format.money(rw.money)), K.Icons.Cash).LayoutOrder = 1
			rewardChip(chips, 128, ('<font color="#FFD23F">+%.1f%%</font> Luck'):format(rw.luck * 100), K.Icons.Clover).LayoutOrder = 2
			if rw.fish then
				local fid = fishOfRarity(rw.fish)
				local tc = Sim.RARITY_TEXT[rw.fish] or Color3.new(1, 1, 1)
				rewardChip(chips, 128, ('<font color="#%s">%s</font> Fish'):format(tc:ToHex(), RarityConfig.get(rw.fish).name), nil,
					if fid then { kind = "Fish", id = fid } else nil).LayoutOrder = 3
			end
			if hasRod then
				local rod = RodConfig.get(rw.rod)
				-- the rod's stats under the chips
				Sim.text(strip, ('EXCLUSIVE ROD: <font color="#FF9CF0">%s</font>'):format(rod.name), { Size = UDim2.fromOffset(SW - 270, 22), Position = UDim2.fromOffset(12, 76),
					AnchorPoint = Vector2.new(0, 0.5), AlignX = Enum.TextXAlignment.Left, Max = 20, Stroke = 2.5, Rich = true, ZIndex = 7 })
				Sim.text(strip, ('<font color="#3CB4FF">x%.2f</font> Speed   <font color="#7CFF46">x%.2f</font> Luck   <font color="#C8C8D2">never sold</font>'):format(rod.speed, rod.luck),
					{ Size = UDim2.fromOffset(SW - 270, 18), Position = UDim2.fromOffset(12, 102), AnchorPoint = Vector2.new(0, 0.5), AlignX = Enum.TextXAlignment.Left,
						Max = 16, Stroke = 2, Rich = true, ZIndex = 7 })
				-- the SHOWCASE: a studded display case, the real 3D rod floating, turning, flourishing
				local case = new("ImageButton", { Name = "RodCase", AutoButtonColor = false, Image = "", BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0,
					Size = UDim2.fromOffset(232, 114), Position = UDim2.fromOffset(SW - 240, 7), ZIndex = 6, ClipsDescendants = true }, strip)
				Sim.gradient(case, if claimed then { RGB(120, 120, 128), RGB(60, 60, 68) } else accent, 90)
				Sim.corner(case, 4)
				Sim.stroke(case, 3, if indexSel == "rod:" .. rw.rod then Color3.new(1, 1, 1) else nil)
				Sim.studs(case, { tile = 22, transparency = 0.7, z = 6 })
				Sim.bands(case, 0.55, 6)
				-- a stud pedestal at the bottom of the case
				local ped = new("Frame", { BackgroundColor3 = RGB(36, 36, 40), BorderSizePixel = 0, Size = UDim2.fromOffset(120, 12), Position = UDim2.new(0.5, 0, 1, -8),
					AnchorPoint = Vector2.new(0.5, 1), ZIndex = 7 }, case)
				Sim.corner(ped, 3)
				Sim.stroke(ped, 2)
				Sim.model(case, { kind = "Rod", id = rw.rod, showcase = true, tilt = 0.55, zoom = 0.62, size = UDim2.fromOffset(150, 150),
					position = UDim2.new(0.5, 0, 0.5, -2), zindex = 8 })
				Sim.text(case, if claimed then "OWNED" else "EXCLUSIVE", { Size = UDim2.fromOffset(110, 18), Position = UDim2.fromOffset(8, 12), AnchorPoint = Vector2.new(0, 0.5),
					AlignX = Enum.TextXAlignment.Left, Max = 16, Stroke = 2.5, ZIndex = 9, Gradient = { RGB(255, 255, 255), RGB(255, 200, 60) } })
				if not claimed then K.shine(case, 2.6) end
				new("UIScale", { Name = "ButtonScale" }, case)
				Motion.BindButton(case, 1.04, Sim.sounds, function()
					indexSel = "rod:" .. rw.rod
					renderers.Index(false)
				end)
			end
			-- 3 · the tiles (background = the RARITY colour, dim while not found)
			local gridHolder = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(SW, 0), AutomaticSize = Enum.AutomaticSize.Y, LayoutOrder = 3 }, sec)
			new("UIPadding", { PaddingTop = UDim.new(0, 8) }, gridHolder)
			local grid = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(SW, 0), AutomaticSize = Enum.AutomaticSize.Y }, gridHolder)
			new("UIGridLayout", { CellSize = UDim2.fromOffset(98, 112), CellPadding = UDim2.fromOffset(8, 8), SortOrder = Enum.SortOrder.LayoutOrder,
				HorizontalAlignment = Enum.HorizontalAlignment.Left }, grid)
			for ti, id in s.ids do
				firstId = firstId or id
				local entry = book[id]
				local found = IndexConfig.found(index, indexCat, id, indexVar)
				local spec = if isFish then FishConfig.get(id) else BearConfig.get(id)
				local rar = if isFish then spec.rarity else (spec.fixedRarity or bestRarity(entry) or "Common")
				local pair = Sim.RARITY_CARD[rar] or Sim.RARITY_CARD.Common
				if not found then
					pair = { pair[1]:Lerp(RGB(40, 40, 46), 0.62), pair[2]:Lerp(RGB(24, 24, 28), 0.62) }
				end
				local sel = indexSel == id
				local tile = new("ImageButton", { Name = id, AutoButtonColor = false, Image = "", BackgroundColor3 = Color3.new(1, 1, 1), LayoutOrder = ti, ZIndex = 5,
					ClipsDescendants = true }, grid)
				Sim.gradient(tile, pair, 90)
				Sim.corner(tile, 4)
				Sim.stroke(tile, if sel then 4 else 3, if sel then Color3.new(1, 1, 1) elseif indexVar and found then VAR_LOOK[indexVar][2] else nil)
				Sim.studs(tile, { tile = 20, transparency = 0.75, z = 5 })
				Sim.model(tile, { kind = if isFish then "Fish" else "Bear", id = id, variant = if indexVar and found then indexVar else nil, silhouette = not found,
					size = UDim2.fromScale(1.0, 0.86), position = UDim2.new(0.5, 0, 0.44, 0) })
				-- name plate along the bottom
				local plate = new("Frame", { BackgroundColor3 = RGB(26, 26, 30), BackgroundTransparency = 0.15, BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 24),
					Position = UDim2.new(0, 0, 1, -24), ZIndex = 9 }, tile)
				Sim.text(plate, if found or entry then spec.name else "???", { Size = UDim2.new(1, -8, 0.8, 0), Max = 15, Stroke = 2, ZIndex = 10,
					Color = if found then (Sim.RARITY_TEXT[rar] or Color3.new(1, 1, 1)) else RGB(170, 170, 180) })
				if rar == "Secret" and found then plate.BackgroundColor3 = RGB(220, 220, 228) end
				new("UIScale", { Name = "ButtonScale" }, tile)
				Motion.BindButton(tile, 1.06, Sim.sounds, function()
					indexSel = id
					renderers.Index(false)
				end)
			end
		end

		-- DETAIL CARD (right) -----------------------------------------------------------------
		local sel = indexSel or firstId
		local rodSel = if type(sel) == "string" and string.sub(sel, 1, 4) == "rod:" then string.sub(sel, 5) else nil
		if rodSel and RodConfig.get(rodSel) then
			local rod = RodConfig.get(rodSel)
			local card, centre = Sim.card(w.content, { Size = Vector2.new(268, 380), Rarity = "Legendary", Title = rod.name, RarityText = "EXCLUSIVE ROD", CenterTop = 76, CenterCut = 196 })
			card.Position = UDim2.fromOffset(CW - 268 - 8, 64)
			Sim.model(centre, { kind = "Rod", id = rodSel, showcase = true, tilt = 0.4, zoom = 0.6, size = UDim2.fromScale(1.15, 1.15) })
			K.shine(card, 3)
			Sim.infoBar(card, ('<font color="#3CB4FF">x%.2f</font> Speed'):format(rod.speed), { Size = UDim2.fromOffset(244, 32), Position = UDim2.fromOffset(134, 278), ZIndex = 6 })
			Sim.infoBar(card, ('<font color="#7CFF46">x%.2f</font> Luck'):format(rod.luck), { Size = UDim2.fromOffset(244, 32), Position = UDim2.fromOffset(134, 314), ZIndex = 6 })
			Sim.infoBar(card, rod.desc or "Index reward", { Size = UDim2.fromOffset(244, 30), Position = UDim2.fromOffset(134, 350), Max = 16, ZIndex = 6 })
		elseif sel then
			local id = sel
			local entry = book[id]
			local found = IndexConfig.found(index, indexCat, id, indexVar)
			local spec = if isFish then FishConfig.get(id) else BearConfig.get(id)
			if spec then
				local rar = if isFish then spec.rarity else (spec.fixedRarity or bestRarity(entry) or "Common")
				local card, centre = Sim.card(w.content, { Size = Vector2.new(268, 380), Rarity = if found then rar else "Secret", Title = if found or entry then spec.name else "???",
					RarityText = if isFish or entry then RarityConfig.get(rar).name else "Bear", CenterTop = 76, CenterCut = 196 })
				card.Position = UDim2.fromOffset(CW - 268 - 8, 64)
				Sim.model(centre, { kind = if isFish then "Fish" else "Bear", id = id, variant = if indexVar and found then indexVar else nil, silhouette = not found, spin = found,
					size = UDim2.fromScale(1, 1.1) })
				Sim.infoBar(card, if entry then ("Caught %d"):format(entry.n) else "Not found", { Size = UDim2.fromOffset(244, 32), Position = UDim2.fromOffset(134, 278), ZIndex = 6 })
				Sim.infoBar(card, if entry then ('Best <font color="#FFD23F">%s</font>'):format(Format.kg(entry.best)) else "???", { Size = UDim2.fromOffset(244, 32), Position = UDim2.fromOffset(134, 314), ZIndex = 6 })
				local mut = {}
				if entry and entry.v then
					for _, v in IndexConfig.Variants do
						if entry.v[v] then table.insert(mut, v) end
					end
				end
				Sim.infoBar(card, if #mut > 0 then table.concat(mut, " · ") else "No mutation yet", { Size = UDim2.fromOffset(244, 30), Position = UDim2.fromOffset(134, 350), Max = 16, ZIndex = 6 })
			end
		end
		if animate then K.cascade(list, 0.04) end
	end

	-- a section reward was claimed: celebration
	Net.event("IndexReward").OnClientEvent:Connect(function(rw)
		local ok, Cine = pcall(require, script.Parent.Parent.Controllers.CinematicFx)
		local sub = ("+%s  ·  +%.1f%% LUCK"):format(Format.money(rw.money), (rw.luck or 0) * 100)
		if rw.fish then sub ..= "  ·  " .. FishConfig.get(rw.fish).name end
		if rw.rod then sub ..= "  ·  " .. rw.rod .. "!" end
		if ok and Cine then
			Cine.banner(rw.title .. " COMPLETE!", if rw.variant then VAR_LOOK[rw.variant][1] else RGB(255, 220, 90), sub)
		end
		if w.menu.IsOpen then renderers.Index(false) end
		if rw.rodId and RodConfig.get(rw.rodId) then
			Menus.rodReveal(rw.rodId)
		end
	end)
end

-- EXCLUSIVE ROD unlocked: a full-screen trophy reveal (the real 3D rod in a studded display
-- case: pops in, flourish spins, stud confetti, stats slide in; tap or wait to close)
function Menus.rodReveal(rodId: string)
	local TweenService = game:GetService("TweenService")
	local rod = RodConfig.get(rodId)
	local gui = new("ScreenGui", { Name = "RodReveal", ResetOnSpawn = false, DisplayOrder = 40, IgnoreGuiInset = true, ZIndexBehavior = Enum.ZIndexBehavior.Sibling },
		player:WaitForChild("PlayerGui"))
	local function tw(o, t, goal, style, dir)
		local x = TweenService:Create(o, TweenInfo.new(t, style or Enum.EasingStyle.Quint, dir or Enum.EasingDirection.Out), goal)
		x:Play()
		return x
	end
	local shade = new("TextButton", { Text = "", AutoButtonColor = false, BackgroundColor3 = RGB(8, 8, 12), BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 1 }, gui)
	tw(shade, 0.4, { BackgroundTransparency = 0.35 })
	local root = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(520, 560), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 2 }, gui)
	local rs = new("UIScale", {}, root)
	Motion.BindResponsive(rs, 0.95)
	local pop = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 2 }, root)
	local ps = new("UIScale", { Scale = 0.2 }, pop)
	-- title
	local title = Sim.text(pop, "EXCLUSIVE ROD UNLOCKED!", { Size = UDim2.fromOffset(520, 50), Position = UDim2.fromOffset(260, 30), Max = 44, Stroke = 4,
		Gradient = { RGB(255, 250, 200), RGB(255, 170, 30) }, ZIndex = 8 })
	-- the display case
	local case = Sim.panel(pop, { Size = UDim2.fromOffset(380, 380), Position = UDim2.fromOffset(70, 70), Gradient = { RGB(255, 226, 120), RGB(214, 120, 20) }, Stroke = 5, ZIndex = 3, Tile = 34 })
	case.ClipsDescendants = true
	Sim.bands(case, 0.6, 3)
	local inner = Sim.panel(case, { Size = UDim2.new(1, -24, 1, -24), Position = UDim2.fromOffset(12, 12), Color = RGB(40, 34, 44), DarkStuds = true, Stroke = 3, ZIndex = 4 })
	local ped = Sim.panel(inner, { Size = UDim2.fromOffset(200, 26), Position = UDim2.new(0.5, 0, 1, -14), AnchorPoint = Vector2.new(0.5, 1), Gradient = Sim.G.gold, Stroke = 3, ZIndex = 5 })
	local _ = ped
	Sim.model(inner, { kind = "Rod", id = rodId, showcase = true, tilt = 0.5, zoom = 0.56, size = UDim2.fromScale(1.1, 1.1), position = UDim2.fromScale(0.5, 0.48), zindex = 6 })
	K.shine(case, 1.6)
	-- name + stats
	local name = Sim.text(pop, rod.name, { Size = UDim2.fromOffset(480, 46), Position = UDim2.fromOffset(260, 482), Max = 42, Stroke = 4, ZIndex = 8,
		Gradient = { RGB(255, 200, 250), RGB(220, 90, 255) } })
	local stats = Sim.infoBar(pop, ('<font color="#3CB4FF">x%.2f</font> Speed    <font color="#7CFF46">x%.2f</font> Luck'):format(rod.speed, rod.luck),
		{ Size = UDim2.fromOffset(340, 40), Position = UDim2.fromOffset(260, 534), Max = 26, ZIndex = 8 })
	-- choreography: case slams in (overshoot), title drops, name and stats slide up
	tw(ps, 0.55, { Scale = 1 }, Enum.EasingStyle.Back)
	title.Position = UDim2.fromOffset(260, -30)
	tw(title, 0.6, { Position = UDim2.fromOffset(260, 30) }, Enum.EasingStyle.Back)
	for i, o in { name, stats } do
		local y = o.Position.Y.Offset
		o.Position = UDim2.fromOffset(260, y + 60)
		task.delay(0.25 + i * 0.12, function()
			if o.Parent then tw(o, 0.45, { Position = UDim2.fromOffset(260, y) }, Enum.EasingStyle.Back) end
		end)
	end
	-- stud confetti bursting out of the case
	local colors = { RGB(255, 210, 60), RGB(255, 120, 200), RGB(120, 220, 255), RGB(140, 255, 90), RGB(255, 255, 255) }
	for i = 1, 46 do
		local sz = math.random(10, 18)
		local bit = new("Frame", { BackgroundColor3 = colors[(i % #colors) + 1], BorderSizePixel = 0, Size = UDim2.fromOffset(sz, sz), Position = UDim2.fromOffset(260, 260),
			AnchorPoint = Vector2.new(0.5, 0.5), Rotation = math.random(0, 90), ZIndex = 9 }, root)
		Sim.corner(bit, 3)
		Sim.stroke(bit, 2)
		local a = math.random() * math.pi * 2
		local dist = 220 + math.random() * 200
		local tx, ty = 260 + math.cos(a) * dist, 260 + math.sin(a) * dist * 0.8
		task.delay(0.1 + math.random() * 0.15, function()
			if not bit.Parent then return end
			tw(bit, 0.9, { Position = UDim2.fromOffset(tx, ty), Rotation = bit.Rotation + math.random(-360, 360) }, Enum.EasingStyle.Quart)
			task.delay(0.9, function()
				if bit.Parent then
					tw(bit, 0.8, { Position = UDim2.fromOffset(tx, ty + 160), BackgroundTransparency = 1 }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
					task.delay(0.85, function() bit:Destroy() end)
				end
			end)
		end)
	end
	local closed = false
	local function close()
		if closed then return end
		closed = true
		tw(ps, 0.3, { Scale = 0 }, Enum.EasingStyle.Back, Enum.EasingDirection.In)
		tw(shade, 0.35, { BackgroundTransparency = 1 })
		task.delay(0.4, function() gui:Destroy() end)
	end
	shade.Activated:Connect(close)
	task.delay(6, close)
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
			{ Position = UDim2.new(0.5, -70, 0, 28) })
		if #list > 0 then
			Sim.button(w.content, { Name = "EquipBest", Grad = "green", Size = Vector2.new(160, 40), Position = UDim2.new(1, -90, 0, 28),
				Text = "Equip Best", Max = 24, ZIndex = 7 }, function()
				Net.event("EquipBest"):FireServer()
			end)
		end
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
			-- the bear you are carrying right now: one click puts it away
			local char = player.Character
			local held = char ~= nil and char:GetAttribute("Holding") == "Bear" and char:GetAttribute("HeldId") == b.id
			-- Equip = into your base (earns money) · Unequip = back to the collection ·
			-- the bear you carry in your hands: Put Away
			Sim.button(card, { Grad = if held then "orange" elseif b.placed then "yellow" else "green", Size = Vector2.new(176, 40), Position = UDim2.fromOffset(98, 234),
				Text = if held then "Put Away" elseif b.placed then "Unequip" else "Equip", Max = 26, ZIndex = 7 }, function()
				if held then
					Net.event("StoreBear"):FireServer()
					w.menu.Close()
				elseif b.placed then
					Net.event("UnequipBear"):FireServer(b.id)
				else
					Net.event("EquipBear"):FireServer(b.id)
				end
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
		Index = { index = true, indexPending = true, indexClaims = true }, Bears = { bears = true, capacity = true }, Inventory = { bears = true, capacity = true, fish = true, selectedFish = true }, Daily = { daily = true },
	}
	local lastMoney = 0
	Data.Changed:Connect(function(key)
		for name, w in windows do
			if w.menu.IsOpen and renderers[name] then
				local rule = KEYS[name] and KEYS[name][key]
				if name == "Shop" and shopTab == "Strength" and strengthRefresh and (key == "strength" or key == "money") then
					strengthRefresh() -- texts only: the 3D dumbbell keeps spinning
				elseif key == "*" or rule == true then
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
