--[[ Menus: every window (stud style, like the reference "Boutique" and "Index"):
     Shop (Rods / Strength / Base tabs), Index (Fish / Bears tabs on the right side,
     silhouettes for undiscovered, progress + claim), Bears collection, Daily
     rewards, playtime Rewards, fish Bag (equip) / Sell mode, and a Confirm dialog.
     Every button sends a real request; the server validates and answers through
     the data mirror, which re-renders the open window. ]]
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
local Theme = require(script.Parent.Theme)
local Window = require(script.Parent.Window)
local Viewport = require(script.Parent.Viewport)
local Data = require(script.Parent.Parent.Controllers.Data)

local Menus = {}
local player = Players.LocalPlayer
local new = Theme.new
local C = Color3.fromRGB
local windows = {}
local renderers = {}

local CARD_GRADS = { Theme.G.blue, Theme.G.orange, Theme.G.pink, Theme.G.purple, Theme.G.teal, Theme.G.yellow, Theme.G.green, Theme.G.red }

local function clear(frame: Instance)
	for _, c in frame:GetChildren() do
		if c:IsA("GuiObject") then c:Destroy() end
	end
end

local function rarityColor(r: string): Color3
	local t = RarityConfig.get(r)
	return if t.textColor then t.textColor else t.color
end

local function sectionTitle(parent, text: string, order: number)
	return Theme.text({ Text = "~ " .. text .. " ~", Size = UDim2.new(1, 0, 0, 30), Max = 28, Color = Theme.GREEN_TEXT, Stroke = 3, LayoutOrder = order, Parent = parent, Font = Theme.FontBold })
end

------------------------------------------------------------------------------------------
-- Confirm dialog
------------------------------------------------------------------------------------------
local confirmWin
local confirmCb
local function buildConfirm()
	confirmWin = Window.new({ name = "Confirm", title = "Are you sure?", gradient = Theme.G.red, size = Vector2.new(400, 220) })
	local msg = Theme.text({ Name = "Msg", Text = "", Size = UDim2.new(1, 0, 0.55, 0), Max = 22, Wrapped = true, Parent = confirmWin.content, ZIndex = 25 })
	local yes = Theme.button({ Text = "YES", Gradient = Theme.G.green, Size = UDim2.new(0.44, 0, 0, 46), Position = UDim2.new(0.03, 0, 1, -4), AnchorPoint = Vector2.new(0, 1), ZIndex = 25, Parent = confirmWin.content })
	local no = Theme.button({ Text = "NO", Gradient = Theme.G.red, Size = UDim2.new(0.44, 0, 0, 46), Position = UDim2.new(0.97, 0, 1, -4), AnchorPoint = Vector2.new(1, 1), ZIndex = 25, Parent = confirmWin.content })
	yes.Activated:Connect(function()
		local cb = confirmCb
		confirmCb = nil
		confirmWin:close()
		if cb then cb() end
	end)
	no.Activated:Connect(function()
		confirmCb = nil
		confirmWin:close()
	end)
	confirmWin.msg = msg
end

function Menus.confirm(text: string, onYes)
	confirmCb = onYes
	confirmWin.msg.Text = text
	confirmWin:open()
end

------------------------------------------------------------------------------------------
-- Shop
------------------------------------------------------------------------------------------
local function buildShop()
	local w = Window.new({ name = "Shop", title = "Shop", gradient = Theme.G.green, size = Vector2.new(620, 350) })
	windows.Shop = w
	local tabsRow = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 36), ZIndex = 23 })
	new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 8), HorizontalAlignment = Enum.HorizontalAlignment.Center }).Parent = tabsRow
	tabsRow.Parent = w.content
	local body = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 1, -42), Position = UDim2.fromOffset(0, 42), ZIndex = 22 })
	body.Parent = w.content
	local tab = "Rods"
	local tabButtons = {}
	for i, name in { "Rods", "Strength", "Base" } do
		local b = Theme.button({ Text = name, Gradient = Theme.G.grey, Size = UDim2.fromOffset(120, 32), LayoutOrder = i, ZIndex = 24, Max = 20, Parent = tabsRow })
		tabButtons[name] = b
		b.Activated:Connect(function()
			tab = name
			renderers.Shop()
		end)
	end

	local function rodsTab()
		local sf = Window.scroll(body, { Grid = UDim2.fromOffset(282, 128), Padding = UDim2.fromOffset(10, 10) })
		local d = Data.values
		for i, id in RodConfig.Order do
			local rod = RodConfig.get(id)
			local owned = d.rods and d.rods.owned[id]
			local equipped = d.rods and d.rods.equipped == id
			local card = Theme.block({ Size = UDim2.fromScale(1, 1), Gradient = CARD_GRADS[(i - 1) % #CARD_GRADS + 1], GradRot = 45, Corner = 8, StrokeWidth = 3, Studs = 26, LayoutOrder = i, ZIndex = 23, Parent = sf })
			local circle = Theme.block({ Size = UDim2.fromOffset(104, 104), Position = UDim2.fromOffset(8, 12), Gradient = { C(255, 255, 255), C(200, 220, 255) }, Corner = 52, StrokeWidth = 3, ZIndex = 24, Parent = card })
			Viewport.create(circle, { kind = "Rod", id = id, spin = true, zoom = 0.82, zindex = 25 })
			Theme.text({ Text = rod.name, Size = UDim2.new(1, -124, 0, 28), Position = UDim2.fromOffset(118, 6), Max = 26, Stroke = 3, XAlign = Enum.TextXAlignment.Left, ZIndex = 25, Parent = card, Font = Theme.FontBold })
			Theme.text({ Text = ("⚡ Speed x%.2f   🍀 Luck x%.2f"):format(rod.speed, rod.luck), Size = UDim2.new(1, -124, 0, 20), Position = UDim2.fromOffset(118, 36), Max = 16, XAlign = Enum.TextXAlignment.Left, ZIndex = 25, Parent = card })
			Theme.text({ Text = rod.desc, Size = UDim2.new(1, -124, 0, 18), Position = UDim2.fromOffset(118, 56), Max = 14, XAlign = Enum.TextXAlignment.Left, ZIndex = 25, Color = C(240, 240, 240), Parent = card })
			local label = if equipped then "EQUIPPED" elseif owned then "EQUIP" else Format.money(rod.price)
			local grad = if equipped then Theme.G.grey elseif owned then Theme.G.blue elseif (d.money or 0) >= rod.price then Theme.G.green else Theme.G.red
			local b = Theme.button({ Text = label, Gradient = grad, Size = UDim2.new(1, -128, 0, 36), Position = UDim2.new(0, 118, 1, -8), AnchorPoint = Vector2.new(0, 1), Max = 22, ZIndex = 26, Parent = card })
			b.Activated:Connect(function()
				if equipped then return end
				if owned then
					Net.event("EquipRod"):FireServer(id)
				else
					Net.event("BuyRod"):FireServer(id)
				end
			end)
		end
	end

	local function statCard(parent, title, grad, rows, buttonText, buttonGrad, onClick, tip)
		local card = Theme.block({ Size = UDim2.new(1, -20, 1, -10), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), Gradient = grad, GradRot = 45, Corner = 10, StrokeWidth = 3, Studs = 16, ZIndex = 23, Parent = parent })
		Theme.text({ Text = title, Size = UDim2.new(1, -20, 0, 34), Position = UDim2.fromOffset(10, 6), Max = 32, Stroke = 3.5, ZIndex = 25, Font = Theme.FontBold, Parent = card })
		for i, r in rows do
			Theme.text({ Text = r[1], Size = UDim2.new(0.5, -14, 0, 24), Position = UDim2.fromOffset(14, 44 + (i - 1) * 28), Max = 20, XAlign = Enum.TextXAlignment.Left, ZIndex = 25, Parent = card })
			Theme.text({ Text = r[2], Size = UDim2.new(0.5, -14, 0, 24), Position = UDim2.new(0.5, 0, 0, 44 + (i - 1) * 28), Max = 20, XAlign = Enum.TextXAlignment.Right, Color = Theme.GREEN_TEXT, ZIndex = 25, Parent = card })
		end
		local b = Theme.button({ Text = buttonText, Gradient = buttonGrad, Size = UDim2.new(0.6, 0, 0, 44), Position = UDim2.new(0.5, 0, 1, -10), AnchorPoint = Vector2.new(0.5, 1), Max = 26, ZIndex = 26, Parent = card })
		b.Activated:Connect(onClick)
		if tip then
			Theme.text({ Text = tip, Size = UDim2.new(1, -20, 0, 16), Position = UDim2.new(0, 10, 1, -58), Max = 14, ZIndex = 25, Color = C(255, 255, 220), Parent = card })
		end
	end

	local function strengthTab()
		local d = Data.values
		local L = d.strength or 1
		local maxed = L >= E.Strength.maxLevel
		local nl = math.min(L + 1, E.Strength.maxLevel)
		local cost = E.Strength.cost(L)
		statCard(body, "💪 STRENGTH  Lv " .. L, Theme.G.red, {
			{ "Throw distance", ("%d → %d studs"):format(E.Strength.maxDistance(L), E.Strength.maxDistance(nl)) },
			{ "Max fish weight", ("%s → %s"):format(Format.kg(E.Strength.maxFishWeight(L)), Format.kg(E.Strength.maxFishWeight(nl))) },
			{ "Training", ("%d / %d reps"):format(d.strengthReps or 0, E.Strength.repsNeeded(L)) },
		}, if maxed then "MAXED" else ("BUY Lv %d · %s"):format(nl, Format.money(cost)), if maxed then Theme.G.grey elseif (d.money or 0) >= cost then Theme.G.green else Theme.G.grey, function()
			if not maxed then Net.event("BuyStrength"):FireServer() end
		end, "Free training: stand in the white circle at the corner of your base!")
	end

	local function baseTab()
		local d = Data.values
		local lvl = d.capacity or 1
		local maxed = lvl >= E.Capacity.maxLevel
		local cost = E.Capacity.cost(lvl)
		local placed = 0
		for _, b in d.bears or {} do if b.placed then placed += 1 end end
		statCard(body, "🏠 BASE CAPACITY", Theme.G.teal, {
			{ "Bears placed", ("%d / %d"):format(placed, Formulas.capacity(lvl)) },
			{ "Next capacity", ("%d bears"):format(Formulas.capacity(math.min(lvl + 1, E.Capacity.maxLevel))) },
			{ "Income now", Format.perSec(player:GetAttribute("Income") or 0) },
		}, if maxed then "MAXED" else ("+1 SLOT · %s"):format(Format.money(cost)), if maxed then Theme.G.grey elseif (d.money or 0) >= cost then Theme.G.green else Theme.G.grey, function()
			if not maxed then Net.event("UpgradeCapacity"):FireServer() end
		end)
	end

	renderers.Shop = function()
		clear(body)
		for name, b in tabButtons do
			Theme.setGradient(b, if name == tab then Theme.G.yellow else Theme.G.grey)
		end
		if tab == "Rods" then rodsTab() elseif tab == "Strength" then strengthTab() else baseTab() end
	end
	w.OnOpen:Connect(renderers.Shop)
	Menus.shopTab = function(t) tab = t end
	Menus.shopCheap = function() return tab ~= "Rods" end
end

------------------------------------------------------------------------------------------
-- Index
------------------------------------------------------------------------------------------
local function buildIndex()
	local w = Window.new({ name = "Index", title = "Index", gradient = Theme.G.magenta, size = Vector2.new(600, 340) })
	windows.Index = w
	local category = "Fish"
	local selected = nil
	-- category buttons outside on the right (reference: Normal / Limited / Mutations)
	local side = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(120, 140), Position = UDim2.new(1, 12, 0, 60), ZIndex = 21 })
	new("UIListLayout", { Padding = UDim.new(0, 8) }).Parent = side
	side.Parent = w.frame
	local catButtons = {}
	for i, cat in { "Fish", "Bears" } do
		local b = Theme.button({ Text = cat, Gradient = if cat == "Fish" then Theme.G.blue else Theme.G.orange, Size = UDim2.fromOffset(120, 44), LayoutOrder = i, Max = 24, ZIndex = 22, Parent = side, Studs = 12 })
		catButtons[cat] = b
		b.Activated:Connect(function()
			category = cat
			selected = nil
			renderers.Index()
		end)
	end
	local left = Theme.block({ Size = UDim2.new(0.66, -6, 1, 0), Color = C(30, 30, 34), Corner = 8, StrokeWidth = 3, ZIndex = 22, Parent = w.content })
	local right = Theme.block({ Size = UDim2.new(0.34, -6, 1, 0), Position = UDim2.new(0.66, 6, 0, 0), Color = C(70, 70, 76), Corner = 8, StrokeWidth = 3, ZIndex = 22, Parent = w.content })
	local grid = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, -12, 1, -70), Position = UDim2.fromOffset(6, 6), ZIndex = 23 })
	new("UIGridLayout", { CellSize = UDim2.fromOffset(70, 70), CellPadding = UDim2.fromOffset(8, 8), HorizontalAlignment = Enum.HorizontalAlignment.Center, SortOrder = Enum.SortOrder.LayoutOrder }).Parent = grid
	grid.Parent = left
	local progBar = Theme.block({ Size = UDim2.new(1, -150, 0, 38), Position = UDim2.new(0, 8, 1, -8), AnchorPoint = Vector2.new(0, 1), Color = C(40, 40, 46), Corner = 8, StrokeWidth = 3, ZIndex = 23, Parent = left })
	local progFill = Theme.block({ Size = UDim2.fromScale(0, 1), Gradient = Theme.G.green, Corner = 8, StrokeWidth = 0, ZIndex = 24, Parent = progBar })
	local progText = Theme.text({ Text = "", Size = UDim2.fromScale(1, 0.8), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), Max = 26, Font = Theme.FontBold, ZIndex = 25, Parent = progBar })
	local claim, claimLabel = Theme.button({ Text = "Claim", Gradient = Theme.G.blue, Size = UDim2.fromOffset(130, 38), Position = UDim2.new(1, -8, 1, -8), AnchorPoint = Vector2.new(1, 1), Max = 20, ZIndex = 24, Parent = left })
	claim.Activated:Connect(function() Net.event("ClaimIndex"):FireServer(category) end)

	renderers.Index = function()
		local d = Data.values
		for cat, b in catButtons do
			local st = b:FindFirstChildOfClass("UIStroke")
			if st then st.Color = if cat == category then C(255, 255, 255) else C(0, 0, 0) end
		end
		clear(grid)
		clear(right)
		local order = if category == "Fish" then FishConfig.Order else BearConfig.Order
		local found = if category == "Fish" then (d.index and d.index.fish or {}) else (d.index and d.index.bears or {})
		local n = 0
		for i, id in order do
			local entry = found[id]
			if entry then n += 1 end
			local spec = if category == "Fish" then FishConfig.get(id) else BearConfig.get(id)
			local rar = if category == "Fish" then spec.rarity else nil
			local tileColor = if entry then (if rar then RarityConfig.get(rar).color else C(120, 220, 120)) else C(50, 50, 56)
			local tile = new("TextButton", { Text = "", AutoButtonColor = false, BackgroundColor3 = tileColor, LayoutOrder = i, ZIndex = 24 })
			Theme.corner(6).Parent = tile
			Theme.stroke(if selected == id then 4 else 3, if selected == id then C(255, 255, 255) else C(0, 0, 0)).Parent = tile
			Theme.new("UIGradient", { Rotation = 90, Color = ColorSequence.new(C(255, 255, 255), C(150, 150, 160)) }).Parent = tile
			Viewport.create(tile, { kind = if category == "Fish" then "Fish" else "Bear", id = id, silhouette = entry == nil, zindex = 25 })
			Theme.text({ Text = if entry then spec.name else "???", Size = UDim2.new(1, -4, 0, 14), Position = UDim2.new(0.5, 0, 0, 2), AnchorPoint = Vector2.new(0.5, 0), Max = 12, ZIndex = 26, Parent = tile })
			Theme.bounce(tile)
			tile.Activated:Connect(function()
				selected = id
				renderers.Index()
			end)
			tile.Parent = grid
		end
		progFill.Size = UDim2.fromScale(n / #order, 1)
		progText.Text = ("%d/%d"):format(n, #order)
		local pending = d.indexPending and d.indexPending[category] or 0
		claimLabel.Text = if pending > 0 then "Claim " .. Format.money(pending) else "Claim"
		Theme.setGradient(claim, if pending > 0 then Theme.G.green else Theme.G.grey)
		-- detail panel
		local id = selected or order[1]
		local entry = found[id]
		local spec = if category == "Fish" then FishConfig.get(id) else BearConfig.get(id)
		local pic = Theme.block({ Size = UDim2.new(1, -16, 0, 120), Position = UDim2.fromOffset(8, 8), Color = C(30, 30, 34), Corner = 8, StrokeWidth = 3, ZIndex = 24, Parent = right })
		Viewport.create(pic, { kind = if category == "Fish" then "Fish" else "Bear", id = id, silhouette = entry == nil, spin = entry ~= nil, zindex = 25 })
		Theme.text({ Text = if entry then spec.name else "???", Size = UDim2.new(1, -12, 0, 30), Position = UDim2.fromOffset(6, 134), Max = 26, Font = Theme.FontBold, ZIndex = 25, Parent = right })
		if category == "Fish" then
			Theme.text({ Text = RarityConfig.get(spec.rarity).name, Size = UDim2.new(1, -12, 0, 24), Position = UDim2.fromOffset(6, 166), Max = 22, Color = rarityColor(spec.rarity), ZIndex = 25, Parent = right })
			Theme.text({ Text = if entry then ("Caught %d · Best %s"):format(entry.n, Format.kg(entry.best)) else "Not caught yet", Size = UDim2.new(1, -12, 0, 18), Position = UDim2.fromOffset(6, 194), Max = 15, ZIndex = 25, Parent = right })
		else
			local rs = {}
			if entry then
				for _, r in RarityConfig.Order do
					if entry.r and entry.r[r] then table.insert(rs, ('<font color="#%s">%s</font>'):format(rarityColor(r):ToHex(), RarityConfig.get(r).name)) end
				end
			end
			Theme.text({ Text = if entry then table.concat(rs, " ") else "???", RichText = true, Size = UDim2.new(1, -12, 0, 40), Position = UDim2.fromOffset(6, 166), Max = 15, Wrapped = true, ZIndex = 25, Parent = right })
			Theme.text({ Text = if entry then ("Caught %d · Best %s"):format(entry.n, Format.kg(entry.best)) else "Throw fish to meet it!", Size = UDim2.new(1, -12, 0, 18), Position = UDim2.fromOffset(6, 210), Max = 15, ZIndex = 25, Parent = right })
		end
		Theme.text({ Text = ("Discovery reward: %s"):format(Format.money(E.IndexReward[category])), Size = UDim2.new(1, -12, 0, 16), Position = UDim2.new(0, 6, 1, -22), Max = 13, ZIndex = 25, Color = Theme.GREEN_TEXT, Parent = right })
	end
	w.OnOpen:Connect(renderers.Index)
end

------------------------------------------------------------------------------------------
-- Bears collection
------------------------------------------------------------------------------------------
local function buildBears()
	local w = Window.new({ name = "Bears", title = "My Bears", gradient = Theme.G.teal, size = Vector2.new(600, 340) })
	windows.Bears = w
	local header = Theme.text({ Text = "", Size = UDim2.new(1, 0, 0, 24), Max = 20, Color = Theme.GREEN_TEXT, Parent = w.content, ZIndex = 23 })
	local holder = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 1, -28), Position = UDim2.fromOffset(0, 28), ZIndex = 22 })
	holder.Parent = w.content
	renderers.Bears = function()
		clear(holder)
		local d = Data.values
		local list = {}
		for _, b in d.bears or {} do table.insert(list, b) end
		table.sort(list, function(a, b)
			if a.placed ~= b.placed then return a.placed end
			return Formulas.bearIncome(a) > Formulas.bearIncome(b)
		end)
		local placed = 0
		for _, b in list do if b.placed then placed += 1 end end
		header.Text = ("%d bears · %d/%d in base · %s"):format(#list, placed, Formulas.capacity(d.capacity or 1), Format.perSec(player:GetAttribute("Income") or 0))
		if #list == 0 then
			Theme.text({ Text = "No bears yet!\nCatch a fish, throw it into the forest and bring the bear home.", Size = UDim2.fromScale(1, 0.6), Max = 22, Wrapped = true, Parent = holder, ZIndex = 24 })
			return
		end
		local sf = Window.scroll(holder, { Grid = UDim2.fromOffset(182, 176), Padding = UDim2.fromOffset(8, 8) })
		for i, b in list do
			local spec = BearConfig.get(b.s)
			local tier = RarityConfig.get(b.r)
			local card = Theme.block({ Size = UDim2.fromScale(1, 1), Gradient = { tier.color:Lerp(C(255, 255, 255), 0.25), tier.dark }, Corner = 8, StrokeWidth = 3, Studs = 24, LayoutOrder = i, ZIndex = 23, Parent = sf })
			local pic = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, -8, 0, 78), Position = UDim2.fromOffset(4, 2), ZIndex = 24 })
			pic.Parent = card
			Viewport.create(pic, { kind = "Bear", id = b.s, variant = b.v, zindex = 25 })
			local vtxt = if b.v ~= "Normal" then b.v .. " " else ""
			Theme.text({ Text = vtxt .. spec.name, Size = UDim2.new(1, -8, 0, 20), Position = UDim2.fromOffset(4, 80), Max = 18, ZIndex = 26, Parent = card })
			Theme.text({ Text = tier.name .. " · " .. Format.kg(b.w), Size = UDim2.new(1, -8, 0, 16), Position = UDim2.fromOffset(4, 100), Max = 14, ZIndex = 26, Parent = card })
			Theme.text({ Text = Format.perSec(Formulas.bearIncome(b)) .. (if b.placed then "  ✅" else "  📦"), Size = UDim2.new(1, -8, 0, 16), Position = UDim2.fromOffset(4, 117), Max = 15, Color = Theme.MONEY, ZIndex = 26, Parent = card })
			local act = Theme.button({ Text = if b.placed then "Pick Up" else "Place", Gradient = if b.placed then Theme.G.orange else Theme.G.green, Size = UDim2.new(0.56, -6, 0, 30), Position = UDim2.new(0, 4, 1, -4), AnchorPoint = Vector2.new(0, 1), Max = 16, ZIndex = 27, Parent = card })
			act.Activated:Connect(function()
				if b.placed then
					Net.event("PickupBear"):FireServer(b.id)
				else
					Net.event("TakeFromStorage"):FireServer(b.id)
				end
				w:close()
			end)
			local sell = Theme.button({ Text = "Sell", Gradient = Theme.G.red, Size = UDim2.new(0.44, -4, 0, 30), Position = UDim2.new(1, -4, 1, -4), AnchorPoint = Vector2.new(1, 1), Max = 16, ZIndex = 27, Parent = card })
			sell.Activated:Connect(function()
				Menus.confirm(("Sell %s %s for %s?"):format(tier.name, spec.name, Format.money(Formulas.bearSellValue(b))), function()
					Net.event("SellBear"):FireServer(b.id, true)
				end)
			end)
		end
	end
	w.OnOpen:Connect(renderers.Bears)
end

------------------------------------------------------------------------------------------
-- Bag / Sell
------------------------------------------------------------------------------------------
local function buildBag()
	local w = Window.new({ name = "Bag", title = "Fish Bag", gradient = Theme.G.purple, size = Vector2.new(600, 340) })
	windows.Bag = w
	local sellMode = false
	local picked = {}
	local top = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 36), ZIndex = 23 })
	top.Parent = w.content
	local info = Theme.text({ Text = "", Size = UDim2.new(0.4, 0, 1, 0), Max = 20, XAlign = Enum.TextXAlignment.Left, Parent = top, ZIndex = 24 })
	local sellAll = Theme.button({ Text = "Sell Common", Gradient = Theme.G.orange, Size = UDim2.fromOffset(150, 34), Position = UDim2.new(1, -160, 0, 0), AnchorPoint = Vector2.new(1, 0), Max = 18, ZIndex = 24, Parent = top })
	local sellSel = Theme.button({ Text = "Sell Selected", Gradient = Theme.G.green, Size = UDim2.fromOffset(150, 34), Position = UDim2.new(1, 0, 0, 0), AnchorPoint = Vector2.new(1, 0), Max = 18, ZIndex = 24, Parent = top })
	local holder = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 1, -42), Position = UDim2.fromOffset(0, 42), ZIndex = 22 })
	holder.Parent = w.content

	local function valuable(f)
		return RarityConfig.get(FishConfig.get(f.s).rarity).index >= 4 or (f.v and f.v ~= "Normal")
	end
	local function sell(ids)
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
			Menus.confirm(("These fish include rare ones! Sell %d fish for %s?"):format(#ids, Format.money(total)), function()
				Net.event("SellFish"):FireServer(ids, true)
			end)
		else
			Net.event("SellFish"):FireServer(ids, false)
		end
		table.clear(picked)
	end
	sellAll.Activated:Connect(function()
		local ids = {}
		for _, f in Data.values.fish or {} do
			if FishConfig.get(f.s).rarity == "Common" and f.v == "Normal" then table.insert(ids, f.id) end
		end
		sell(ids)
	end)
	sellSel.Activated:Connect(function()
		local ids = {}
		for id in picked do table.insert(ids, id) end
		sell(ids)
	end)

	renderers.Bag = function()
		clear(holder)
		local d = Data.values
		local fish = d.fish or {}
		sellAll.Visible = sellMode
		sellSel.Visible = sellMode
		local pickedN = 0
		for _ in picked do pickedN += 1 end
		info.Text = if sellMode then ("%d fish · %d selected"):format(#fish, pickedN) else ("%d / %d fish · tap to hold one"):format(#fish, E.FishBagMax)
		if #fish == 0 then
			Theme.text({ Text = "Your bag is empty.\nGo to the end of your dock and CAST!", Size = UDim2.fromScale(1, 0.6), Max = 22, Wrapped = true, Parent = holder, ZIndex = 24 })
			return
		end
		local sf = Window.scroll(holder, { Grid = UDim2.fromOffset(104, 118), Padding = UDim2.fromOffset(8, 8) })
		local sorted = table.clone(fish)
		table.sort(sorted, function(a, b) return Formulas.fishValue(a) > Formulas.fishValue(b) end)
		for i, f in sorted do
			local spec = FishConfig.get(f.s)
			local tier = RarityConfig.get(spec.rarity)
			local isSel = d.selectedFish == f.id
			local tile = new("TextButton", { Text = "", AutoButtonColor = false, BackgroundColor3 = C(255, 255, 255), LayoutOrder = i, ZIndex = 24 })
			Theme.corner(8).Parent = tile
			Theme.gradient({ tier.color:Lerp(C(255, 255, 255), 0.3), tier.dark }).Parent = tile
			Theme.stroke(if (sellMode and picked[f.id]) or (not sellMode and isSel) then 4 else 3, if (sellMode and picked[f.id]) or (not sellMode and isSel) then C(255, 255, 255) else C(0, 0, 0)).Parent = tile
			local pic = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, -6, 0, 62), Position = UDim2.fromOffset(3, 2), ZIndex = 25 })
			pic.Parent = tile
			Viewport.create(pic, { kind = "Fish", id = f.s, variant = f.v, zindex = 26 })
			Theme.text({ Text = (if f.v ~= "Normal" then f.v .. " " else "") .. spec.name, Size = UDim2.new(1, -6, 0, 16), Position = UDim2.fromOffset(3, 64), Max = 14, ZIndex = 27, Parent = tile })
			Theme.text({ Text = Format.kg(f.w), Size = UDim2.new(1, -6, 0, 14), Position = UDim2.fromOffset(3, 81), Max = 13, ZIndex = 27, Parent = tile })
			Theme.text({ Text = Format.money(Formulas.fishValue(f)), Size = UDim2.new(1, -6, 0, 14), Position = UDim2.fromOffset(3, 97), Max = 13, Color = Theme.MONEY, ZIndex = 27, Parent = tile })
			if sellMode and picked[f.id] then
				Theme.text({ Text = "✔", Size = UDim2.fromOffset(22, 22), Position = UDim2.new(1, -4, 0, 2), AnchorPoint = Vector2.new(1, 0), Max = 20, Color = Theme.MONEY, ZIndex = 28, Parent = tile })
			end
			Theme.bounce(tile)
			tile.Activated:Connect(function()
				if sellMode then
					picked[f.id] = if picked[f.id] then nil else true
					renderers.Bag()
				else
					Net.event("SelectFish"):FireServer(f.id)
					w:close()
				end
			end)
			tile.Parent = sf
		end
	end
	w.OnOpen:Connect(function()
		renderers.Bag()
	end)
	Menus.setSellMode = function(on)
		sellMode = on
		table.clear(picked)
	end
end

------------------------------------------------------------------------------------------
-- Daily rewards
------------------------------------------------------------------------------------------
local function buildDaily()
	local w = Window.new({ name = "Daily", title = "Daily Rewards", gradient = Theme.G.orange, size = Vector2.new(600, 300) })
	windows.Daily = w
	local grid = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 1, -56), ZIndex = 22 })
	new("UIGridLayout", { CellSize = UDim2.fromOffset(74, 120), CellPadding = UDim2.fromOffset(6, 6), HorizontalAlignment = Enum.HorizontalAlignment.Center, VerticalAlignment = Enum.VerticalAlignment.Center, SortOrder = Enum.SortOrder.LayoutOrder }).Parent = grid
	grid.Parent = w.content
	local claim, claimLabel = Theme.button({ Text = "Claim!", Gradient = Theme.G.green, Size = UDim2.fromOffset(240, 46), Position = UDim2.new(0.5, 0, 1, 0), AnchorPoint = Vector2.new(0.5, 1), Max = 26, ZIndex = 24, Parent = w.content })
	claim.Activated:Connect(function() Net.event("ClaimDaily"):FireServer() end)
	local tick
	renderers.Daily = function()
		clear(grid)
		local d = Data.values.daily or { streak = 0, last = 0 }
		local now = os.time()
		local ready = now - d.last >= E.Daily.cooldown
		local streak = if now - d.last > E.Daily.resetAfter then 0 else d.streak
		local today = streak % #E.Daily.rewards + 1
		for i, amount in E.Daily.rewards do
			local done = i < today or (i == today and not ready)
			local cur = i == today and ready
			local card = Theme.block({ Gradient = if cur then Theme.G.yellow elseif done then Theme.G.grey else Theme.G.blue, Corner = 8, StrokeWidth = if cur then 4 else 3, StrokeColor = if cur then C(255, 255, 255) else nil, Studs = 10, LayoutOrder = i, ZIndex = 23, Parent = grid })
			Theme.text({ Text = "Day " .. i, Size = UDim2.new(1, -6, 0, 22), Position = UDim2.fromOffset(3, 4), Max = 18, ZIndex = 25, Parent = card })
			Theme.text({ Text = if i == 7 then "💰" else "💵", Size = UDim2.new(1, 0, 0, 40), Position = UDim2.fromOffset(0, 30), Max = 36, Stroke = 0, ZIndex = 25, Parent = card })
			Theme.text({ Text = Format.money(amount), Size = UDim2.new(1, -6, 0, 20), Position = UDim2.fromOffset(3, 76), Max = 17, Color = Theme.MONEY, ZIndex = 25, Parent = card })
			if done then Theme.text({ Text = "✔", Size = UDim2.new(1, 0, 0, 20), Position = UDim2.fromOffset(0, 96), Max = 18, Color = Theme.MONEY, ZIndex = 25, Parent = card }) end
		end
		claimLabel.Text = if ready then "Claim Day " .. today .. "!" else "Next in " .. Format.time(E.Daily.cooldown - (now - d.last))
		Theme.setGradient(claim, if ready then Theme.G.green else Theme.G.grey)
	end
	w.OnOpen:Connect(function()
		renderers.Daily()
		tick = task.spawn(function()
			while w:isOpen() do
				task.wait(1)
				if w:isOpen() then renderers.Daily() end
			end
		end)
	end)
	local _ = tick
end

------------------------------------------------------------------------------------------
-- Playtime rewards
------------------------------------------------------------------------------------------
local function buildRewards()
	local w = Window.new({ name = "Rewards", title = "Gifts", gradient = Theme.G.red, size = Vector2.new(600, 320) })
	windows.Rewards = w
	local grid = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 22 })
	new("UIGridLayout", { CellSize = UDim2.fromOffset(132, 122), CellPadding = UDim2.fromOffset(8, 8), HorizontalAlignment = Enum.HorizontalAlignment.Center, VerticalAlignment = Enum.VerticalAlignment.Center, SortOrder = Enum.SortOrder.LayoutOrder }).Parent = grid
	grid.Parent = w.content
	renderers.Rewards = function()
		clear(grid)
		local joined = player:GetAttribute("JoinedAt") or workspace:GetServerTimeNow()
		local played = workspace:GetServerTimeNow() - joined
		local claimed = player:GetAttribute("GiftsClaimed") or ""
		for i, g in E.Playtime do
			local isClaimed = string.find("," .. claimed, "," .. i .. ",", 1, true) ~= nil
			local left = g.minutes * 60 - played
			local ready = left <= 0 and not isClaimed
			local card = Theme.block({ Gradient = if ready then Theme.G.green elseif isClaimed then Theme.G.grey else Theme.G.pink, Corner = 8, StrokeWidth = 3, Studs = 12, LayoutOrder = i, ZIndex = 23, Parent = grid })
			local icon = Theme.text({ Text = "🎁", Size = UDim2.new(1, 0, 0, 46), Position = UDim2.fromOffset(0, 6), Max = 42, Stroke = 0, ZIndex = 25, Parent = card })
			if ready then icon.Rotation = math.sin(os.clock() * 8) * 10 end
			Theme.text({ Text = Format.money(g.money) .. "+", Size = UDim2.new(1, -6, 0, 20), Position = UDim2.fromOffset(3, 54), Max = 18, Color = Theme.MONEY, ZIndex = 25, Parent = card })
			local b = Theme.button({ Text = if isClaimed then "Claimed" elseif ready then "Open!" else Format.time(left), Gradient = if ready then Theme.G.yellow else Theme.G.grey, Size = UDim2.new(1, -12, 0, 32), Position = UDim2.new(0.5, 0, 1, -6), AnchorPoint = Vector2.new(0.5, 1), Max = 18, ZIndex = 26, Parent = card })
			b.Activated:Connect(function()
				if ready then Net.event("ClaimPlaytime"):FireServer(i) end
			end)
		end
	end
	w.OnOpen:Connect(function()
		renderers.Rewards()
		task.spawn(function()
			while w:isOpen() do
				task.wait(1)
				if w:isOpen() then renderers.Rewards() end
			end
		end)
	end)
	player:GetAttributeChangedSignal("GiftsClaimed"):Connect(function()
		if w:isOpen() then renderers.Rewards() end
	end)
end

function Menus.giftReady(): boolean
	local joined = player:GetAttribute("JoinedAt")
	if not joined then return false end
	local played = workspace:GetServerTimeNow() - joined
	local claimed = player:GetAttribute("GiftsClaimed") or ""
	for i, g in E.Playtime do
		if played >= g.minutes * 60 and not string.find("," .. claimed, "," .. i .. ",", 1, true) then
			return true
		end
	end
	return false
end

------------------------------------------------------------------------------------------
function Menus.mount(gui: ScreenGui)
	Window.setRoot(gui)
	buildShop()
	buildIndex()
	buildBears()
	buildBag()
	buildDaily()
	buildRewards()
	buildConfirm()
	-- re-render the open window only when data it shows changes (money ticks
	-- every second: only cheap tabs follow it)
	local KEYS = {
		Shop = { rods = true, strength = true, strengthReps = true, capacity = true, money = "cheap" },
		Index = { index = true, indexPending = true },
		Bears = { bears = true, capacity = true },
		Bag = { fish = true, selectedFish = true },
		Daily = { daily = true },
	}
	local lastMoneyRender = 0
	Data.Changed:Connect(function(key)
		local cur = Window.current
		if not cur or not renderers[cur.name] then return end
		local k = KEYS[cur.name]
		local rule = k and k[key]
		if key == "*" or rule == true then
			renderers[cur.name]()
		elseif rule == "cheap" and Menus.shopCheap() and os.clock() - lastMoneyRender > 1.5 then
			lastMoneyRender = os.clock()
			renderers[cur.name]()
		end
	end)
	player:GetAttributeChangedSignal("Income"):Connect(function()
		local cur = Window.current
		if cur and (cur.name == "Bears" or cur.name == "Shop") then renderers[cur.name]() end
	end)
end

function Menus.open(name: string, opts: any?)
	local w = windows[name == "Sell" and "Bag" or name]
	if not w then return end
	if name == "Bag" or name == "Sell" then
		Menus.setSellMode(name == "Sell")
	end
	if name == "Shop" and opts and opts.tab then Menus.shopTab(opts.tab) end
	if w:isOpen() and name ~= "Sell" and name ~= "Bag" then
		w:close()
		return
	end
	w:open()
	if renderers[w.name] then renderers[w.name]() end
end

Menus.windows = windows
return Menus
