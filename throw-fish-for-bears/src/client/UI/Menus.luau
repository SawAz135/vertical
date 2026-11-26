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
local PotionConfig = require(Shared.Config.PotionConfig)
local MonetizationConfig = require(Shared.Config.MonetizationConfig)
local MarketplaceService = game:GetService("MarketplaceService")
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
			SortOrder = Enum.SortOrder.LayoutOrder, HorizontalAlignment = if p.Left then Enum.HorizontalAlignment.Left else Enum.HorizontalAlignment.Center }, s)
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
local potionRefresh = nil -- live update of the Potions page $ buttons
local potionBuys = {}
local function buildShop()
	local w = makeWindow("Shop", { title = "Rod Shop", grad = "orange", size = Vector2.new(860, 470), titleWidth = 300 })
	local tabs = {}
	for i, name in { "Rods", "Strength", "Potions", "Passes" } do -- Base tab removed (capacity: "+1 Slot" in the bears panel)
		tabs[name] = Sim.button(w.titleRoot, { Name = "Tab" .. name, Grad = "grey", Size = Vector2.new(116, 48), Position = UDim2.fromOffset(372 + (i - 1) * 122, w.HH / 2),
			Text = name, Max = 26, ZIndex = 9 }, function()
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

	-- $ buttons of the Potions page, recoloured live when your money changes (no rebuild)
	potionBuys = {}
	potionRefresh = function()
		local money = Data.values.money or 0
		for _, e in potionBuys do
			if e.b.Parent then Sim.recolor(e.b, if money >= e.price then "green" else "light") end
		end
	end

	-- Robux buttons: an id of 0 = not set up on Roblox yet -> "SOON", never prompts
	local function robuxButton(parent, p, kind, key)
		local cfg = if kind == "Pass" then MonetizationConfig.Passes[key] else MonetizationConfig.Products[key]
		local ready = cfg and cfg.id ~= 0
		p.Grad = if ready then "green" else "grey"
		p.Text = if ready then p.Text or ("R$ " .. cfg.price) else "SOON"
		return Sim.button(parent, p, function()
			if not ready then
				require(script.Parent.Notify).show("Coming soon!", "info")
				return
			end
			if kind == "Pass" then
				MarketplaceService:PromptGamePassPurchase(player, cfg.id)
			else
				MarketplaceService:PromptProductPurchase(player, cfg.id)
			end
		end)
	end

	--[[ Potions page: one card per luck potion (3D studded bottle), what it does, how
	     many you own, BUY with $ (price follows your income), DRINK, and Robux (x1 / x3). ]]
	local function potionsTab(animate)
		table.clear(potionBuys)
		local d = Data.values
		local inv = (d.potions and d.potions.inv) or {}
		local active = (d.potions and d.potions.active) or {}
		local income = player:GetAttribute("Income") or 0
		local list = scroller(body, { Size = UDim2.fromScale(1, 1), X = true, Gap = 16, PadTop = 16 })
		for i, id in PotionConfig.Order do
			local spec = PotionConfig.get(id)
			local card, centre = Sim.card(list, { Name = id, LayoutOrder = i, Size = Vector2.new(250, 344), Rarity = spec.rarity, Title = spec.name,
				RarityText = ("%d min  ·  Animals + Fish"):format(spec.minutes), CenterTop = 74, CenterCut = 214 })
			Sim.model(centre, { kind = "Potion", id = id, spin = true, spinSpeed = 0.8, zoom = 0.78, pitch = math.rad(14), size = UDim2.fromScale(1.1, 1.25) })
			local n = inv[id] or 0
			local left = active[id] or 0
			Sim.infoBar(card, if left > 0 then ('Owned <font color="#7CFF46">%d</font>  ·  <font color="#FFD23F">%s left</font>'):format(n, Format.time(left))
				else ('Owned <font color="#7CFF46">%d</font>'):format(n), { Size = UDim2.fromOffset(226, 30), Position = UDim2.fromOffset(125, 214), Max = 18, ZIndex = 6 })
			local price = PotionConfig.price(id, income)
			local can = (d.money or 0) >= price
			local buy = Sim.button(card, { Grad = if can then "green" else "light", Size = Vector2.new(140, 44), Position = UDim2.fromOffset(84, 258), ZIndex = 7,
				Text = Format.money(price), Max = 24, Icon = K.Icons.Cash, IconSize = 0.8 }, function() Net.event("BuyPotion"):FireServer(id) end)
			table.insert(potionBuys, { b = buy, price = price })
			Sim.button(card, { Grad = if n > 0 then "yellow" else "light", Size = Vector2.new(80, 44), Position = UDim2.fromOffset(198, 258), ZIndex = 7,
				Text = "DRINK", Max = 20 }, function()
				if (((Data.values.potions or {}).inv or {})[id] or 0) > 0 then Net.event("UsePotion"):FireServer(id) end
			end)
			local one, three = MonetizationConfig.forPotion(id)
			robuxButton(card, { Size = Vector2.new(110, 40), Position = UDim2.fromOffset(66, 306), ZIndex = 7, Max = 20 }, "Product", one)
			local p3 = MonetizationConfig.Products[three]
			robuxButton(card, { Size = Vector2.new(110, 40), Position = UDim2.fromOffset(184, 306), ZIndex = 7, Max = 18,
				Text = if p3 then ("3x  R$ %d"):format(p3.price) else nil }, "Product", three)
		end
		if animate then K.cascade(list, 0.06) end
	end

	-- Passes page: the two gamepasses as big trophy cards
	local function passesTab(animate)
		local list = scroller(body, { Size = UDim2.fromScale(1, 1), X = true, Gap = 22, PadTop = 16, Pad = 40 })
		for i, key in MonetizationConfig.PassOrder do
			local pass = MonetizationConfig.Passes[key]
			local owned = player:GetAttribute("Pass_" .. key) == true
			local card, centre = Sim.card(list, { Name = key, LayoutOrder = i, Size = Vector2.new(360, 344), Rarity = if key == "Luck2x" then "Mythic" else "Legendary",
				Title = pass.name, RarityText = "GAMEPASS  ·  FOREVER", CenterTop = 74, CenterCut = 206 })
			Sim.model(centre, { kind = "Pass", id = key, spin = true, spinSpeed = 0.7, zoom = 0.8, pitch = math.rad(10), size = UDim2.fromScale(1, 1.2) })
			Sim.text(card, pass.desc, { Size = UDim2.fromOffset(330, 44), Position = UDim2.fromOffset(180, 238), Max = 18, Wrap = true, Stroke = 2.5, ZIndex = 7 })
			if owned then
				Sim.button(card, { Grad = "grey", Size = Vector2.new(320, 56), Position = UDim2.fromOffset(180, 302), ZIndex = 7, Text = "OWNED", Max = 30 })
			else
				local b = robuxButton(card, { Size = Vector2.new(320, 56), Position = UDim2.fromOffset(180, 302), ZIndex = 7, Max = 30 }, "Pass", key)
				K.shine(b, 2.4)
			end
		end
		if animate then K.cascade(list, 0.08) end
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
		if titleLabel then
			titleLabel.Text = if shopTab == "Strength" then "Strength" elseif shopTab == "Potions" then "Potions" elseif shopTab == "Passes" then "Passes" else "Rod Shop"
		end
		local d = Data.values
		if shopTab == "Rods" then
			rodsTab(animate)
		elseif shopTab == "Potions" then
			potionsTab(animate)
		elseif shopTab == "Passes" then
			passesTab(animate)
		elseif shopTab == "Strength" then
			strengthPage(animate)
		else
			local lvl = d.capacity or 1
			local maxed = lvl >= E.Capacity.maxLevel
			local cost = E.Capacity.cost(lvl)
			local placed = 0
			for _, b in d.bears or {} do if b.placed then placed += 1 end end
			statPage(animate, {
				section = "Base", rarity = "Uncommon", big = Formulas.capacity(lvl) .. " Animals", small = "Capacity", icon = K.Icons.House,
				rows = {
					{ "Animals placed", ("%d / %d"):format(placed, Formulas.capacity(lvl)) },
					{ "Next capacity", ("%d animals"):format(Formulas.capacity(math.min(lvl + 1, E.Capacity.maxLevel))) },
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

local function fishCards(w, mode, left)
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
		local list = scroller(w.content, { Size = UDim2.new(1, 0, 1, -56), Position = UDim2.fromOffset(0, 54), Grid = Vector2.new(196, 268), Gap = 14, PadTop = 10, Left = left })
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

local indexPage = {} -- [cat .. variant] = section page shown
local function buildIndex()
	--[[ INDEX (one section per page, like a collector's book):
	     inside  : LEFT the section card (name, its colours, a 3D creature, ◀ page ▶) ·
	               a 4 x 2 grid of tiles (name on top, live 3D, black shape + ??? if not found;
	               scrolls when a section has more) · the section bar "4/8" ·
	               the total bar "Unlocked: 104/134" (+ COLLECT discoveries) ·
	               RIGHT the selected creature (3D, name, rarity, $/s) and the section REWARDS
	               (square reward tiles + CLAIM)
	     outside : RIGHT  ANIMALS (top) / FISH (under) · LEFT  NORMAL + every mutation ]]
	local w = makeWindow("Index", { title = "Index", grad = "blue", size = Vector2.new(960, 520), factor = 0.72 }) -- smaller: the tabs outside stay on screen
	local VAR_ORDER = { "Normal" }
	for _, v in IndexConfig.Variants do table.insert(VAR_ORDER, v) end
	local rainbowGrads = {}
	task.spawn(function()
		while w.frame.Parent do
			if w.menu.IsOpen then
				local h = (os.clock() * 0.25) % 1
				for g in rainbowGrads do
					if g.Parent then g.Color = ColorSequence.new(Color3.fromHSV(h, 0.55, 1), Color3.fromHSV((h + 0.35) % 1, 0.75, 1)) else rainbowGrads[g] = nil end
				end
			end
			task.wait(0.05)
		end
	end)
	-- OUTSIDE RIGHT: Animals (top), Fish (under)
	local catTabs = {}
	for i, cat in { "Animals", "Fish" } do
		catTabs[cat] = Sim.button(w.frame, { Name = "Tab" .. cat, Grad = if cat == "Fish" then "blue" else "teal", Size = Vector2.new(156, 60),
			Position = UDim2.fromOffset(w.W + 84, 110 + (i - 1) * 72), Text = cat:upper(), Max = 24, Icon = if cat == "Fish" then K.Icons.Bait else K.Icons.Paw, IconSize = 0.75 }, function()
			if indexCat == cat then return end
			indexCat = cat
			indexSel = nil
			renderers.Index(true)
		end)
	end
	-- OUTSIDE LEFT: Normal + every mutation
	local varTabs = {}
	for i, v in VAR_ORDER do
		local b = Sim.button(w.frame, { Name = "Var" .. v, Grad = "light", Size = Vector2.new(150, 52),
			Position = UDim2.fromOffset(-82, 84 + (i - 1) * 62), Text = v:upper(), Max = 22 }, function()
			local nv = if v == "Normal" then nil else v
			if indexVar == nv then return end
			indexVar = nv
			indexSel = nil
			renderers.Index(true)
		end)
		local g = b:FindFirstChildWhichIsA("UIGradient", true)
		if g then
			local look = VAR_LOOK[v] or { RGB(245, 245, 248), RGB(176, 178, 188) }
			g.Color = ColorSequence.new(look[1], look[2])
			if v == "Rainbow" then rainbowGrads[g] = true end
		end
		varTabs[v] = b
	end

	local TILE_W, TILE_H, GAP = 118, 130, 8
	renderers.Index = function(animate)
		clear(w.content)
		-- selected tabs slide out a little and get a white outline
		for cat, b in catTabs do
			b.Position = UDim2.fromOffset(if cat == indexCat then w.W + 94 else w.W + 84, b.Position.Y.Offset)
			local st = b:FindFirstChildOfClass("UIStroke")
			if st then st.Color = if cat == indexCat then Color3.new(1, 1, 1) else Color3.new(0, 0, 0) end
		end
		for v, b in varTabs do
			local on = (indexVar or "Normal") == v
			b.Position = UDim2.fromOffset(if on then -92 else -82, b.Position.Y.Offset)
			local st = b:FindFirstChildOfClass("UIStroke")
			if st then st.Color = if on then Color3.new(1, 1, 1) else Color3.new(0, 0, 0) end
		end
		local d = Data.values
		local index = d.index or { fish = {}, bears = {} }
		local claims = d.indexClaims or {}
		local isFish = indexCat == "Fish"
		local book = if isFish then (index.fish or {}) else (index.bears or {})
		local sections = IndexConfig.sections(indexCat, indexVar)
		local pendKey = if indexCat == "Animals" then "Bears" else indexCat
		if #sections == 0 then return end
		local pageKey = indexCat .. (indexVar or "")
		local page = math.clamp(indexPage[pageKey] or 1, 1, #sections)
		indexPage[pageKey] = page
		local s = sections[page]
		local n, total = IndexConfig.progress(index, s)
		local done = n >= total
		local claimed = claims[s.key] == true
		local col = s.color or RGB(120, 120, 130)

		-- the dark "book" plate behind the page
		local plate = new("Frame", { BackgroundColor3 = RGB(34, 36, 44), BorderSizePixel = 0, Size = UDim2.fromOffset(662, 346), Position = UDim2.fromOffset(8, 10), ZIndex = 3 }, w.content)
		Sim.corner(plate, 6)
		Sim.stroke(plate, 3)
		Sim.studs(plate, { dark = true, tile = 26, transparency = 0.6, z = 3 })

		-- 1 · LEFT: the section card
		local card = Sim.panel(w.content, { Size = UDim2.fromOffset(150, 330), Position = UDim2.fromOffset(16, 18), Gradient = { col:Lerp(Color3.new(1, 1, 1), 0.25), col:Lerp(Color3.new(0, 0, 0), 0.4) },
			Stroke = 3, ZIndex = 4, Clip = true })
		Sim.bands(card, 0.55, 4)
		Sim.text(card, s.title, { Size = UDim2.fromOffset(136, 62), Position = UDim2.fromOffset(75, 40), Max = 28, Wrap = true, Stroke = 3.5, ZIndex = 7 })
		-- a creature of the section stands on the card (the first one found, else its shadow)
		local heroId, heroFound = s.ids[1], false
		for _, id in s.ids do
			if IndexConfig.found(index, indexCat, id, indexVar) then heroId, heroFound = id, true break end
		end
		local stage = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(150, 170), Position = UDim2.fromOffset(0, 84), ZIndex = 5 }, card)
		if heroId then
			Sim.model(stage, { kind = if isFish then "Fish" else "Bear", id = heroId, variant = if indexVar and heroFound then indexVar else nil, silhouette = not heroFound,
				size = UDim2.fromScale(1.1, 1.1), zindex = 6 })
		end
		-- page arrows + "3 / 10"
		local function turn(dir)
			indexPage[pageKey] = (page - 1 + dir) % #sections + 1
			indexSel = nil
			renderers.Index(true)
		end
		Sim.button(card, { Name = "Prev", Grad = "yellow", Size = Vector2.new(44, 40), Position = UDim2.fromOffset(28, 300), Text = "<", Max = 26, ZIndex = 8 }, function() turn(-1) end)
		Sim.button(card, { Name = "Next", Grad = "yellow", Size = Vector2.new(44, 40), Position = UDim2.fromOffset(122, 300), Text = ">", Max = 26, ZIndex = 8 }, function() turn(1) end)
		Sim.text(card, ("%d/%d"):format(page, #sections), { Size = UDim2.fromOffset(50, 24), Position = UDim2.fromOffset(75, 300), Max = 20, Stroke = 2.5, ZIndex = 8 })

		-- 2 · the tiles (4 per row, scrolls when the section has more than 8)
		local grid = new("ScrollingFrame", { Name = "Grid", BackgroundTransparency = 1, BorderSizePixel = 0, Size = UDim2.fromOffset(4 * TILE_W + 3 * GAP + 14, 2 * TILE_H + GAP),
			Position = UDim2.fromOffset(176, 18), ZIndex = 4, ScrollBarThickness = 8, ScrollBarImageColor3 = RGB(230, 230, 230), ScrollingDirection = Enum.ScrollingDirection.Y,
			CanvasSize = UDim2.fromOffset(0, math.ceil(#s.ids / 4) * (TILE_H + GAP) - GAP) }, w.content)
		local firstId = nil
		for ti, id in s.ids do
			firstId = firstId or id
			local entry = book[id]
			local found = IndexConfig.found(index, indexCat, id, indexVar)
			local spec = if isFish then FishConfig.get(id) else BearConfig.get(id)
			local rar = if isFish then spec.rarity else (spec.fixedRarity or bestRarity(entry) or nil)
			local pair
			if rar then
				pair = Sim.RARITY_CARD[rar] or Sim.RARITY_CARD.Common
			else
				pair = { col:Lerp(Color3.new(1, 1, 1), 0.15), col:Lerp(Color3.new(0, 0, 0), 0.35) }
			end
			if not found then pair = { pair[1]:Lerp(RGB(20, 20, 26), 0.25), pair[2]:Lerp(RGB(20, 20, 26), 0.35) } end
			local sel = indexSel == id or (indexSel == nil and ti == 1)
			local tile = new("ImageButton", { Name = id, AutoButtonColor = false, Image = "", BackgroundColor3 = Color3.new(1, 1, 1), ZIndex = 5,
				Size = UDim2.fromOffset(TILE_W, TILE_H), Position = UDim2.fromOffset(((ti - 1) % 4) * (TILE_W + GAP) + TILE_W / 2, ((ti - 1) // 4) * (TILE_H + GAP) + TILE_H / 2),
				AnchorPoint = Vector2.new(0.5, 0.5), ClipsDescendants = true }, grid)
			local tg = Sim.gradient(tile, pair, 90)
			if found and rar and RarityConfig.get(rar).rainbow then rainbowGrads[tg] = true end
			Sim.corner(tile, 4)
			Sim.stroke(tile, if sel then 4 else 3, if sel then Color3.new(1, 1, 1) elseif indexVar and found then VAR_LOOK[indexVar][2] else nil)
			Sim.studs(tile, { tile = 20, transparency = 0.75, z = 5 })
			Sim.text(tile, if found or entry then spec.name else "???", { Size = UDim2.new(1, -8, 0, 22), Position = UDim2.new(0.5, 0, 0, 15), Max = 18, Stroke = 2.5, ZIndex = 10 })
			Sim.model(tile, { kind = if isFish then "Fish" else "Bear", id = id, variant = if indexVar and found then indexVar else nil, silhouette = not found,
				size = UDim2.fromScale(1.05, 0.92), position = UDim2.new(0.5, 0, 0.58, 0) })
			if found and rar and RarityConfig.index(rar) >= 5 then K.shine(tile, 3.5) end
			new("UIScale", { Name = "ButtonScale" }, tile)
			Motion.BindButton(tile, 1.06, Sim.sounds, function()
				indexSel = id
				renderers.Index(false)
			end)
			if sel and indexSel == id then
				local sc = tile:FindFirstChild("ButtonScale")
				if sc then
					sc.Scale = 1.12
					game:GetService("TweenService"):Create(sc, TweenInfo.new(0.35, Enum.EasingStyle.Back), { Scale = 1 }):Play()
				end
			end
		end

		-- 3 · the section bar "4/8"
		local function bigBar(x, y, wd, ht, frac, text, pair, icon)
			local b = new("Frame", { BackgroundColor3 = RGB(24, 24, 28), BorderSizePixel = 0, Size = UDim2.fromOffset(wd, ht), Position = UDim2.fromOffset(x, y), ZIndex = 5, ClipsDescendants = true }, w.content)
			Sim.corner(b, 4)
			Sim.stroke(b, 3)
			local f = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, Size = UDim2.fromScale(if animate then 0 else frac, 1), ZIndex = 6 }, b)
			Sim.gradient(f, pair, 90)
			Sim.studs(f, { tile = 18, transparency = 0.65, z = 6 })
			if animate then
				game:GetService("TweenService"):Create(f, TweenInfo.new(0.8, Enum.EasingStyle.Quint, Enum.EasingDirection.Out), { Size = UDim2.fromScale(frac, 1) }):Play()
			end
			Sim.text(b, text, { Size = UDim2.new(1, -20, 0.8, 0), Max = math.floor(ht * 0.7), Stroke = 3.5, ZIndex = 8 })
			if icon then
				new("ImageLabel", { BackgroundTransparency = 1, Image = icon, ScaleType = Enum.ScaleType.Fit, Size = UDim2.fromOffset(ht + 14, ht + 14),
					Position = UDim2.fromOffset(x - 6, y + ht / 2), AnchorPoint = Vector2.new(0.5, 0.5), Rotation = -12, ZIndex = 9 }, w.content)
			end
			return b
		end
		bigBar(176, 300, 4 * TILE_W + 3 * GAP, 48, n / math.max(1, total), ("%d/%d"):format(n, total), if done then Sim.G.green else Sim.G.green)
		-- 4 · the total bar "Unlocked: 104/134" (+ collect the discovery money)
		local all, got = 0, 0
		for _, sec in sections do
			local a, b = IndexConfig.progress(index, sec)
			got += a
			all += b
		end
		local accent = if indexVar then VAR_LOOK[indexVar] else Sim.G.blue
		bigBar(38, 372, 470, 56, got / math.max(1, all), ("Unlocked: %d/%d"):format(got, all), accent, K.Icons.Index)
		local pending = d.indexPending and d.indexPending[pendKey] or 0
		local claim = Sim.button(w.content, { Grad = if pending > 0 then "green" else "grey", Size = Vector2.new(152, 56), Position = UDim2.fromOffset(594, 400),
			Text = if pending > 0 then Format.money(pending) else "COLLECTED", Max = 22, Icon = K.Icons.Cash, IconSize = 0.8, ZIndex = 6 }, function()
			Net.event("ClaimIndex"):FireServer(pendKey)
		end)
		if pending > 0 then K.shine(claim, 1.6) end

		-- 5 · RIGHT: the selected creature (or the section's exclusive rod)
		local CX = 680
		local sel = indexSel or firstId
		local info = Sim.panel(w.content, { Size = UDim2.fromOffset(264, 232), Position = UDim2.fromOffset(CX, 10), Color = RGB(44, 46, 54), DarkStuds = true, Stroke = 3, ZIndex = 4, Clip = true })
		local rodSel = if type(sel) == "string" and string.sub(sel, 1, 4) == "rod:" then string.sub(sel, 5) else nil
		local showStage = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(264, 150), Position = UDim2.fromOffset(0, 2), ZIndex = 5 }, info)
		if rodSel and RodConfig.get(rodSel) then
			local rod = RodConfig.get(rodSel)
			Sim.model(showStage, { kind = "Rod", id = rodSel, showcase = true, tilt = 0.4, zoom = 0.6, size = UDim2.fromScale(1, 1.1), zindex = 6 })
			Sim.text(info, rod.name, { Size = UDim2.fromOffset(250, 30), Position = UDim2.fromOffset(132, 166), Max = 26, Stroke = 3, ZIndex = 7 })
			Sim.text(info, "EXCLUSIVE ROD", { Size = UDim2.fromOffset(250, 22), Position = UDim2.fromOffset(132, 194), Max = 20, Stroke = 2.5, ZIndex = 7, Color = RGB(255, 156, 240) })
			Sim.text(info, ('x%.2f Speed  ·  x%.2f Luck'):format(rod.speed, rod.luck), { Size = UDim2.fromOffset(250, 20), Position = UDim2.fromOffset(132, 218), Max = 18, Stroke = 2.5, ZIndex = 7, Color = RGB(124, 255, 70) })
		elseif sel then
			local id = sel
			local entry = book[id]
			local found = IndexConfig.found(index, indexCat, id, indexVar)
			local spec = if isFish then FishConfig.get(id) else BearConfig.get(id)
			if spec then
				local rar = if isFish then spec.rarity else (spec.fixedRarity or bestRarity(entry) or "Common")
				Sim.model(showStage, { kind = if isFish then "Fish" else "Bear", id = id, variant = if indexVar and found then indexVar else nil, silhouette = not found, spin = found,
					size = UDim2.fromScale(1, 1.1), zindex = 6 })
				Sim.text(info, if found or entry then spec.name else "???", { Size = UDim2.fromOffset(250, 30), Position = UDim2.fromOffset(132, 166), Max = 26, Stroke = 3, ZIndex = 7 })
				Sim.text(info, if found or entry then RarityConfig.get(rar).name else "Not found yet", { Size = UDim2.fromOffset(250, 22), Position = UDim2.fromOffset(132, 194), Max = 20, Stroke = 2.5, ZIndex = 7,
					Color = if found or entry then (Sim.RARITY_TEXT[rar] or Color3.new(1, 1, 1)) else RGB(180, 180, 190) })
				local line
				if not (found or entry) then
					line = "???"
				elseif isFish then
					line = ("Sells %s"):format(Format.money(Formulas.fishValue({ s = id, w = spec.weight.avg, v = indexVar or "Normal" })))
				else
					line = Format.perSec(Formulas.bearIncome({ s = id, r = rar, v = indexVar or "Normal", w = spec.weight.ref }))
				end
				Sim.text(info, line, { Size = UDim2.fromOffset(250, 22), Position = UDim2.fromOffset(132, 218), Max = 20, Stroke = 2.5, ZIndex = 7, Color = RGB(124, 255, 70) })
				if animate == false then Motion.PopIn(showStage, 0.3) end
			end
		end

		-- 6 · RIGHT: the section REWARDS (square tiles) + CLAIM
		local rbox = Sim.panel(w.content, { Size = UDim2.fromOffset(264, 176), Position = UDim2.fromOffset(CX, 250), Color = RGB(28, 70, 44), DarkStuds = true, Stroke = 3,
			StrokeColor = RGB(60, 200, 90), ZIndex = 4 })
		Sim.text(rbox, "Rewards:", { Size = UDim2.fromOffset(150, 22), Position = UDim2.fromOffset(12, 16), AnchorPoint = Vector2.new(0, 0.5), AlignX = Enum.TextXAlignment.Left,
			Max = 20, Stroke = 2.5, ZIndex = 7 })
		local rw = s.reward
		local items = {
			-- every reward is shown by a real 3D studded model of the game (no flat icon)
			{ model = { kind = "Pass", id = "Money2x" }, text = Format.money(rw.money) },
			{ model = { kind = "Pass", id = "Luck2x" }, text = ("+%.0f%% Luck"):format(rw.luck * 100) },
		}
		if rw.fish then
			local fid = fishOfRarity(rw.fish)
			table.insert(items, { model = if fid then { kind = "Fish", id = fid } else nil, text = RarityConfig.get(rw.fish).name })
		end
		local hasRod = rw.rod ~= nil and RodConfig.get(rw.rod) ~= nil
		if hasRod then table.insert(items, { model = { kind = "Rod", id = rw.rod }, text = "ROD", rod = rw.rod }) end
		local SQ = 58
		local x0 = (264 - (#items * SQ + (#items - 1) * 6)) / 2
		for i, it in items do
			local sq = new("ImageButton", { AutoButtonColor = false, Image = "", BackgroundColor3 = RGB(30, 34, 38), BorderSizePixel = 0, Size = UDim2.fromOffset(SQ, SQ),
				Position = UDim2.fromOffset(x0 + (i - 1) * (SQ + 6), 34), ZIndex = 6 }, rbox)
			Sim.corner(sq, 4)
			Sim.stroke(sq, 2.5)
			Sim.studs(sq, { dark = true, tile = 16, transparency = 0.5, z = 6 })
			if it.icon then
				new("ImageLabel", { BackgroundTransparency = 1, Image = it.icon, ScaleType = Enum.ScaleType.Fit, Size = UDim2.fromOffset(40, 40),
					Position = UDim2.fromOffset(SQ / 2, 22), AnchorPoint = Vector2.new(0.5, 0.5), Rotation = -8, ZIndex = 8 }, sq)
			elseif it.model then
				Sim.model(sq, { kind = it.model.kind, id = it.model.id, alive = false, spin = true, spinSpeed = 0.9, zoom = 0.8,
					size = UDim2.fromScale(1.15, 1.15), position = UDim2.fromScale(0.5, 0.42), zindex = 8 })
			end
			Sim.text(sq, it.text, { Size = UDim2.new(1, -4, 0, 18), Position = UDim2.new(0.5, 0, 1, -10), Max = 15, Stroke = 2.5, ZIndex = 9 })
			if it.rod then
				new("UIScale", { Name = "ButtonScale" }, sq)
				Motion.BindButton(sq, 1.08, Sim.sounds, function()
					indexSel = "rod:" .. it.rod
					renderers.Index(false)
				end)
			end
		end
		local cb = Sim.button(rbox, { Grad = if claimed then "grey" elseif done then "green" else "dark", Size = Vector2.new(190, 50), Position = UDim2.fromOffset(132, 136),
			Text = if claimed then "CLAIMED!" elseif done then "CLAIM!" else ("%d/%d"):format(n, total), Icon = if claimed then K.Icons.Check elseif done then nil else K.Icons.Lock,
			IconSize = 0.7, Max = 24, ZIndex = 8 }, function()
			if done and not claimed then Net.event("ClaimIndexSection"):FireServer(s.key) end
		end)
		if done and not claimed then K.shine(cb, 1.3) end

		if animate then
			K.cascade(grid, 0.04)
			Motion.PopIn(card, 0.35)
		end
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
local function bearCards(w, left)
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
			emptyText(w.content, "No animals yet!\nThrow a fish into the corridor: it turns into an animal!")
			return
		end
		local grid = scroller(w.content, { Size = UDim2.new(1, 0, 1, -56), Position = UDim2.fromOffset(0, 54), Grid = Vector2.new(196, 292), Gap = 14, PadTop = 10, Left = left })
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
	local w = makeWindow("Bears", { title = "My Animals", grad = "purple", size = Vector2.new(860, 480) })
	renderers.Bears = bearCards(w)
end

------------------------------------------------------------------------------------------
-- Inventory : "Bears + Fish" (replaces the default Roblox inventory button)
-- Bears tab = collection cards (Pick Up / Place / Sell), Fish tab = fish bag cards (Hold)
------------------------------------------------------------------------------------------
-- Inventory skin: lake decor (Fish tab) / pine-forest decor (Bears tab), built from studded blocks
local function invBox(parent, x, y, w, h, col, tr, r, stroke)
	local f = new("Frame", { BackgroundColor3 = col, BackgroundTransparency = tr or 0, BorderSizePixel = 0,
		Size = UDim2.fromOffset(w, h), Position = UDim2.fromOffset(x, y), ZIndex = parent.ZIndex }, parent)
	if r then new("UICorner", { CornerRadius = if r < 0 then UDim.new(1, 0) else UDim.new(0, r) }, f) end
	if stroke then new("UIStroke", { Thickness = stroke, Color = RGB(17, 17, 20), ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, f) end
	return f
end
local function invIcon(parent, img, x, y, s, tr, rot)
	return new("ImageLabel", { BackgroundTransparency = 1, Image = img, ImageTransparency = tr, Size = UDim2.fromOffset(s, s),
		Position = UDim2.fromOffset(x, y), Rotation = rot or 0, ZIndex = parent.ZIndex }, parent)
end
local function invPine(parent, x, base, s, dark)
	local g1, g2, g3 = RGB(30, 130, 48), RGB(44, 160, 58), RGB(70, 190, 70)
	if dark then g1, g2, g3 = RGB(14, 90, 34), RGB(22, 118, 42), RGB(34, 140, 52) end
	invBox(parent, x - 4 * s, base - 10 * s, 8 * s, 10 * s, RGB(110, 70, 34), 0, 1, 1.5)
	invBox(parent, x - 23 * s, base - 22 * s, 46 * s, 12 * s, g1, 0, 2, 1.5)
	invBox(parent, x - 17 * s, base - 34 * s, 34 * s, 12 * s, g2, 0, 2, 1.5)
	invBox(parent, x - 11 * s, base - 46 * s, 22 * s, 12 * s, g3, 0, 2, 1.5)
end
local function invWeed(parent, x, base, n, col)
	for k = 0, n - 1 do invBox(parent, x + (k % 2) * 4, base - (k + 1) * 11, 9, 13, col or RGB(47, 180, 58), 0, 4, 1.5) end
end
local invWhite = Color3.new(1, 1, 1)
local PINE = {
	near = { RGB(110, 70, 34), RGB(30, 130, 48), RGB(44, 160, 58), RGB(70, 190, 70), RGB(150, 235, 110) },
	mid = { RGB(80, 52, 30), RGB(18, 92, 40), RGB(26, 116, 48), RGB(38, 138, 58), RGB(60, 160, 70) },
	far = { RGB(60, 60, 90), RGB(40, 74, 100), RGB(46, 86, 112), RGB(54, 98, 124), RGB(70, 114, 138) },
}
local function invPine2(parent, x, base, s, pal, outline)
	local st = if outline then 1.5 else nil
	invBox(parent, x - 3.5 * s, base - 9 * s, 7 * s, 9 * s, pal[1], 0, 1, st)
	invBox(parent, x - 21 * s, base - 21 * s, 42 * s, 12 * s, pal[2], 0, 2, st)
	invBox(parent, x - 16 * s, base - 32 * s, 32 * s, 12 * s, pal[3], 0, 2, st)
	invBox(parent, x - 10 * s, base - 43 * s, 20 * s, 12 * s, pal[4], 0, 2, st)
	invBox(parent, x - 4 * s, base - 50 * s, 8 * s, 8 * s, pal[5], 0, 2, st)
end
local function invMountain(parent, cx, base, w, h, col, snow)
	local n = 6
	for k = 0, n - 1 do
		local ww = w * (1 - k / n)
		local c = col:Lerp(invWhite, k * 0.04)
		if snow and k >= n - 2 then c = RGB(240, 246, 255) end
		invBox(parent, cx - ww / 2, base - (k + 1) * h / n, ww, h / n + 1, c, 0, 1)
	end
end
local function invCloud(parent, x, y, s)
	invBox(parent, x, y + 10 * s, 60 * s, 14 * s, invWhite, 0.55, 7 * s)
	invBox(parent, x + 10 * s, y, 28 * s, 16 * s, invWhite, 0.55, 8 * s)
	invBox(parent, x + 30 * s, y + 4 * s, 22 * s, 14 * s, invWhite, 0.55, 7 * s)
end
local function invBird(parent, x, y, s)
	local a = invBox(parent, x, y, 9 * s, 2 * s, RGB(20, 24, 40), 0, 1)
	a.Rotation = 25
	local b = invBox(parent, x + 8 * s, y, 9 * s, 2 * s, RGB(20, 24, 40), 0, 1)
	b.Rotation = -25
end
local function invFire(parent, x, base)
	invBox(parent, x - 34, base - 52, 68, 68, RGB(255, 160, 60), 0.86, -1)
	local l1 = invBox(parent, x - 16, base - 6, 32, 7, RGB(110, 70, 34), 0, 2, 1.5)
	l1.Rotation = 8
	local l2 = invBox(parent, x - 16, base - 6, 32, 7, RGB(90, 56, 28), 0, 2, 1.5)
	l2.Rotation = -8
	for _, f in { { 16, 12, RGB(235, 70, 30) }, { 11, 9, RGB(255, 150, 30) }, { 6, 7, RGB(255, 230, 90) } } do
		local d = invBox(parent, x - f[1] / 2, base - 8 - f[2] - f[1] / 2, f[1], f[1], f[3], 0, 3, if f[1] == 16 then 1.5 else nil)
		d.Rotation = 45
	end
end
local function invShroom(parent, x, base, s)
	invBox(parent, x - 3 * s, base - 8 * s, 6 * s, 8 * s, RGB(240, 226, 200), 0, 1, 1.5)
	invBox(parent, x - 8 * s, base - 16 * s, 16 * s, 9 * s, RGB(220, 50, 50), 0, 6 * s, 1.5)
	invBox(parent, x - 4 * s, base - 14 * s, 3 * s, 3 * s, invWhite, 0, -1)
	invBox(parent, x + 2 * s, base - 13 * s, 3 * s, 3 * s, invWhite, 0, -1)
end
local function invFlower(parent, x, base, col)
	invBox(parent, x - 1, base - 10, 2, 10, RGB(30, 130, 48), 0)
	for _, o in { { -4, -14 }, { 2, -14 }, { -1, -17 }, { -1, -11 } } do invBox(parent, x + o[1] - 1.5, base + o[2], 5, 5, col, 0, -1) end
	invBox(parent, x - 2, base - 15, 4, 4, RGB(255, 220, 60), 0, -1)
end
local function invHoney(parent, x, base)
	invBox(parent, x - 12, base - 22, 24, 22, RGB(150, 92, 40), 0, 8, 1.5)
	invBox(parent, x - 14, base - 28, 28, 9, RGB(255, 200, 50), 0, 4, 1.5)
	invBox(parent, x - 5, base - 20, 6, 12, RGB(255, 200, 50), 0, 3)
	invBox(parent, x - 8, base - 12, 16, 8, RGB(255, 235, 150), 0, 3)
end
local function invRock(parent, x, base, s)
	invBox(parent, x, base - 10 * s, 22 * s, 10 * s, RGB(150, 150, 160), 0, 4, 1.5)
	invBox(parent, x + 4 * s, base - 8 * s, 8 * s, 3 * s, RGB(200, 200, 210), 0, 1)
end
local function skinBears(bodyB, hdrB, bw, bh, HH)
	-- twilight sky
	local sky = invBox(bodyB, 0, 0, bw, bh, invWhite)
	new("UIGradient", { Rotation = 90, Color = ColorSequence.new({
		ColorSequenceKeypoint.new(0, RGB(22, 36, 84)), ColorSequenceKeypoint.new(0.45, RGB(96, 72, 144)),
		ColorSequenceKeypoint.new(0.78, RGB(255, 150, 100)), ColorSequenceKeypoint.new(1, RGB(255, 205, 125)) }) }, sky)
	for _, s in { { 30, 12 }, { 90, 40 }, { 150, 8 }, { 210, 30 }, { 275, 10 }, { 330, 44 }, { 392, 14 }, { 440, 36 }, { 500, 8 }, { 560, 30 }, { 610, 14 }, { 640, 46 }, { 120, 24 }, { 360, 26 } } do
		invBox(bodyB, s[1], s[2], 3, 3, invWhite, 0.15)
	end
	for _, s in { { 190, 18 }, { 520, 20 }, { 70, 44 } } do
		invBox(bodyB, s[1] - 5, s[2], 11, 2, invWhite, 0.1)
		invBox(bodyB, s[1], s[2] - 5, 2, 11, invWhite, 0.1)
	end
	-- sun (half hidden by the mountains) + glow
	local sx, sy = bw * 0.74, bh - 118
	invBox(bodyB, sx - 95, sy - 95, 190, 190, RGB(255, 170, 90), 0.9, -1)
	invBox(bodyB, sx - 70, sy - 70, 140, 140, RGB(255, 180, 90), 0.84, -1)
	invBox(bodyB, sx - 50, sy - 50, 100, 100, RGB(255, 216, 92), 0, -1)
	invCloud(bodyB, 40, 22, 1)
	invCloud(bodyB, 330, 44, 0.8)
	invCloud(bodyB, 520, 70, 1.1)
	invBird(bodyB, 180, 70, 1)
	invBird(bodyB, 205, 58, 0.8)
	invBird(bodyB, 560, 38, 1)
	-- stepped mountains (far, then near)
	for _, m in { { 70, 230, 150 }, { 250, 260, 190 }, { 450, 250, 160 }, { 620, 220, 170 } } do
		invMountain(bodyB, m[1], bh - 70, m[2], m[3], RGB(98, 84, 148), true)
	end
	for _, m in { { 160, 200, 100 }, { 360, 230, 120 }, { 560, 210, 105 } } do
		invMountain(bodyB, m[1], bh - 56, m[2], m[3], RGB(56, 94, 122), false)
	end
	-- three depths of pine forest
	for i = 0, math.ceil(bw / 26) do invPine2(bodyB, 10 + i * 26, bh - 54 + (i % 2) * 3, 0.5, PINE.far, false) end
	for i = 0, math.ceil(bw / 34) do invPine2(bodyB, 18 + i * 34, bh - 34 + ((i * 5) % 3) * 3, 0.8 + ((i * 7) % 3) * 0.1, PINE.mid, true) end
	local meadow = invBox(bodyB, 0, bh - 40, bw, 40, RGB(48, 150, 44))
	Sim.studs(meadow, { z = 2 })
	local sizes = { 1, 0.85, 1.15, 0.95 }
	for i = 0, math.ceil(bw / 44) do invPine2(bodyB, 20 + i * 44, bh - 8, sizes[i % 4 + 1], PINE.near, true) end
	-- ground details
	for i = 0, 14 do
		local p = invIcon(bodyB, K.Icons.Paw, 70 + i * 40, bh - 22 + (i % 2) * 4, 16, 0.35, (i % 2) * 20 - 10)
		p.ImageColor3 = RGB(80, 50, 25)
	end
	invFire(bodyB, 46, bh - 3)
	invHoney(bodyB, bw - 36, bh - 3)
	for _, x in { 120, 300, 520 } do invShroom(bodyB, x, bh - 3, 1) end
	for i, x in { 90, 180, 360, 440, 580 } do invFlower(bodyB, x, bh - 3, if i % 2 == 0 then RGB(255, 120, 190) else RGB(255, 240, 110)) end
	invRock(bodyB, 210, bh - 3, 1)
	invRock(bodyB, 470, bh - 3, 0.8)
	for _, p in { { 250, 0 }, { 330, 1 }, { 400, 2 }, { 550, 1 }, { 610, 0 } } do
		for k = 0, 2 do
			local t = invBox(bodyB, p[1] + k * 4, bh - 12, 2, 9, RGB(30, 150, 50), 0)
			t.Rotation = (k - 1) * 22
		end
	end
	-- fireflies and falling leaves
	for _, f in { { 140, 170 }, { 230, 120 }, { 310, 210 }, { 390, 150 }, { 470, 230 }, { 540, 140 }, { 600, 190 }, { 80, 230 }, { 430, 90 }, { 620, 110 } } do
		invBox(bodyB, f[1] - 8, f[2] - 8, 16, 16, RGB(200, 255, 120), 0.82, -1)
		invBox(bodyB, f[1] - 2, f[2] - 2, 4, 4, RGB(255, 255, 170), 0, -1)
	end
	for i, f in { { 100, 90 }, { 260, 150 }, { 350, 95 }, { 500, 160 }, { 580, 80 }, { 40, 150 }, { 640, 230 } } do
		local lf = invBox(bodyB, f[1], f[2], 8, 8, if i % 2 == 0 then RGB(240, 120, 40) else RGB(210, 60, 40), 0, 2)
		lf.Rotation = 25 + i * 17
	end
	-- wooden plank border + top shade
	local wood = RGB(140, 88, 40)
	for _, r in { { 0, 0, bw, 7 }, { 0, 0, 7, bh }, { bw - 7, 0, 7, bh } } do invBox(bodyB, r[1], r[2], r[3], r[4], wood, 0, 1, 1.5) end
	for x = 40, bw - 40, 60 do invBox(bodyB, x, 0, 2, 7, RGB(96, 58, 24), 0) end
	for y = 40, bh - 40, 60 do
		invBox(bodyB, 0, y, 7, 2, RGB(96, 58, 24), 0)
		invBox(bodyB, bw - 7, y, 7, 2, RGB(96, 58, 24), 0)
	end
	local vg = invBox(bodyB, 0, 0, bw, 90, Color3.new(0, 0, 0), 0)
	new("UIGradient", { Rotation = 90, Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.5), NumberSequenceKeypoint.new(1, 1) }) }, vg)
	-- header: sun, birds, two rows of pines, leaves
	invBox(hdrB, 346, -4, 60, 60, RGB(255, 200, 90), 0.75, -1)
	invBox(hdrB, 360, 10, 32, 32, RGB(255, 226, 110), 0, -1, 1.5)
	invBird(hdrB, 300, 14, 1)
	invBird(hdrB, 318, 28, 0.8)
	for i = 0, math.ceil(bw / 28) do invPine2(hdrB, 8 + i * 28, HH + 2, 0.5, PINE.mid, true) end
	for i = 0, math.ceil(bw / 28) do invPine2(hdrB, 22 + i * 28, HH + 6, 0.4, PINE.near, true) end
	for i, x in { 430, 540, 600 } do
		local lf = invBox(hdrB, x, 8 + i * 9, 7, 7, if i % 2 == 0 then RGB(240, 120, 40) else RGB(210, 60, 40), 0, 2)
		lf.Rotation = 30 + i * 20
	end
end

local function skinInventory(w)
	local bw, bh, HH = w.W - 8, w.H - w.HH - 12, w.HH
	local function group(parent, z)
		return new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ClipsDescendants = true, ZIndex = z }, parent)
	end
	local bodyF, bodyB = group(w.body, 2), group(w.body, 2)
	local hdrF, hdrB = group(w.header, 4), group(w.header, 4)
	local white = Color3.new(1, 1, 1)
	-- FISH / lake: light rays, fish, bubbles, seaweed, studded sand
	for i, x in { 200, 320, 460 } do
		local ray = invBox(bodyF, x, -40, 30 + i * 8, bh + 80, RGB(150, 220, 255), 0.9)
		ray.Rotation = 18
	end
	for _, f in { { 250, 100, 70, -10 }, { 400, 215, 56, 12 }, { 500, 110, 44, -6 }, { 120, 250, 50, 8 } } do
		invIcon(bodyF, K.Icons.Bait, f[1], f[2], f[3], 0.88, f[4])
	end
	for _, b in { { 236, 230, 14 }, { 258, 256, 9 }, { 596, 280, 22 }, { 36, 320, 16 }, { 556, 50, 14 }, { 586, 80, 9 }, { 300, 40, 10 } } do
		local c = invBox(bodyF, b[1], b[2], b[3], b[3], white, 1, -1)
		new("UIStroke", { Thickness = 2.5, Color = white, Transparency = 0.45 }, c)
	end
	local sand = invBox(bodyF, 0, bh - 22, bw, 22, RGB(230, 194, 122))
	Sim.studs(sand, { z = 2 })
	for _, p in { { 250, 10 }, { 272, 7 }, { 420, 9 }, { 520, 11 }, { 560, 7 }, { 330, 8 } } do
		invBox(bodyF, p[1], bh - 16, p[2], p[2], RGB(185, 141, 76), 0, -1, 1.5)
	end
	invWeed(bodyF, 22, bh - 14, 6)
	invWeed(bodyF, 36, bh - 14, 4, RGB(31, 154, 53))
	invWeed(bodyF, bw - 52, bh - 14, 6)
	invWeed(bodyF, bw - 38, bh - 14, 4, RGB(31, 154, 53))
	for _, s in { { 300, bh - 20, RGB(255, 138, 92) }, { 470, bh - 18, RGB(255, 210, 63) } } do
		local st = invBox(bodyF, s[1], s[2], 16, 16, s[3], 0, 2, 1.5)
		st.Rotation = 45
	end
	for i = 0, math.ceil(bw / 18) do
		invBox(hdrF, i * 18 - 9, HH - 22, 26, 26, white, 0.72, -1)
		invBox(hdrF, i * 18, HH - 12, 26, 26, white, 0.6, -1)
	end
	invIcon(hdrF, K.Icons.Bait, 330, 8, 30, 0.2)
	invIcon(hdrF, K.Icons.Bait, 380, 30, 22, 0.3, 8)
	skinBears(bodyB, hdrB, bw, bh, HH)
	-- gold gems on the four window corners
	for _, c in { { -9, -9 }, { w.W - 9, -9 }, { -9, w.H - 9 }, { w.W - 9, w.H - 9 } } do
		local g = invBox(w.frame, c[1], c[2], 18, 18, RGB(255, 210, 63), 0, -1, 2)
		g.ZIndex = 20
	end
	local gradObj = w.header:FindFirstChildOfClass("UIGradient")
	local strokeObj = w.frame:FindFirstChildOfClass("UIStroke")
	return function(cat)
		local bears = cat == "Bears"
		bodyB.Visible, hdrB.Visible = bears, bears
		bodyF.Visible, hdrF.Visible = not bears, not bears
		if gradObj then
			gradObj.Color = if bears then ColorSequence.new(RGB(134, 232, 95), RGB(28, 138, 44)) else ColorSequence.new(RGB(116, 220, 255), RGB(31, 95, 230))
		end
		if strokeObj then strokeObj.Color = if bears then RGB(61, 35, 14) else RGB(12, 53, 96) end
		w.body.BackgroundColor3 = if bears then RGB(60, 52, 46) else RGB(42, 58, 82)
	end
end

local invTab = "Bears"
local function buildInventory()
	local w = makeWindow("Inventory", { title = "Animals + Fish", grad = "purple", size = Vector2.new(668, 470), titleWidth = 380 })
	local sub = { Bears = bearCards(w, true), Fish = fishCards(w, "Bag", true) }
	local skin = skinInventory(w)
	local tabs = {}
	for i, cat in { "Bears", "Fish" } do
		tabs[cat] = Sim.button(w.frame, { Name = "Tab" .. cat, Grad = if cat == "Fish" then "blue" else "orange", Size = Vector2.new(170, 62),
			Position = UDim2.fromOffset(w.W + 100, 120 + (i - 1) * 76), Text = if cat == "Bears" then "Animals" else cat, Max = if cat == "Bears" then 28 else 34,
			Icon = if cat == "Fish" then K.Icons.Bait else K.Icons.Paw }, function()
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
		skin(invTab)
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
		Shop = { rods = true, strength = true, strengthGain = true, capacity = true, money = "throttle", potions = true },
		Sell = { fish = true }, Bag = { fish = true, selectedFish = true },
		Index = { index = true, indexPending = true, indexClaims = true }, Bears = { bears = true, capacity = true }, Inventory = { bears = true, capacity = true, fish = true, selectedFish = true }, Daily = { daily = true },
	}
	local lastMoney = 0
	-- a gamepass bought: the Passes page shows OWNED at once
	player.AttributeChanged:Connect(function(attr)
		if attr:sub(1, 5) == "Pass_" and windows.Shop.menu.IsOpen and shopTab == "Passes" then renderers.Shop(false) end
	end)
	Data.Changed:Connect(function(key)
		for name, w in windows do
			if w.menu.IsOpen and renderers[name] then
				local rule = KEYS[name] and KEYS[name][key]
				if name == "Shop" and shopTab == "Strength" and strengthRefresh and (key == "strength" or key == "money") then
					strengthRefresh() -- texts only: the 3D dumbbell keeps spinning
				elseif key == "potions" and name == "Shop" and shopTab ~= "Potions" then
					-- (potion timers only matter on the Potions page)
				elseif key == "*" or rule == true then
					renderers[name](false)
				elseif name == "Shop" and shopTab == "Potions" and key == "money" then
					if potionRefresh then potionRefresh() end
				elseif rule == "throttle" and shopTab ~= "Rods" and shopTab ~= "Passes" and os.clock() - lastMoney > 1.5 then
					lastMoney = os.clock()
					renderers[name](false)
				end
			end
		end
	end)
end

-- open the inventory on a tab ("Fish" / "Bears"): switches tab if it is already open
function Menus.openInventory(cat: string)
	local w = windows.Inventory
	if not w then return end
	if w.menu.IsOpen and invTab == cat then
		w.menu.Close()
		return
	end
	invTab = cat
	if w.menu.IsOpen then
		renderers.Inventory(true)
	else
		w.menu.Open()
	end
end

function Menus.open(name: string)
	local w = windows[name]
	if not w then return end
	if w.menu.IsOpen then w.menu.Close() else w.menu.Open() end
end

Menus.windows = windows
return Menus
