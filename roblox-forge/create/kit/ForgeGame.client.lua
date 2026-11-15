--[[
	Roblox Forge « Créer tout » - game interface (client, StarterPlayerScripts).
	Builds the whole GUI from ReplicatedStorage.ForgeGame.Config: stat / money
	counters, every button you asked for (« +1 Force », Vendre, Boutique,
	Rebirth…), the shop, rebirth, eggs, codes and daily panels, toasts and
	« +N » pop-ups. Phone and PC: UIScale follows the screen size, buttons are
	big enough for thumbs. The client only asks; the server decides.
]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local cfg = require(ReplicatedStorage:WaitForChild("ForgeGame"):WaitForChild("Config"))
local remotes = ReplicatedStorage:WaitForChild("ForgeGameRemotes")
local Action, State, Notify, Open = remotes:WaitForChild("Action"), remotes:WaitForChild("State"), remotes:WaitForChild("Notify"), remotes:WaitForChild("Open")

local FONT = Enum.Font.FredokaOne
local WHITE = Color3.new(1, 1, 1)
local function hex(h: string): Color3
	h = (h or "#7c5cff"):gsub("#", "")
	return Color3.fromRGB(tonumber(h:sub(1, 2), 16), tonumber(h:sub(3, 4), 16), tonumber(h:sub(5, 6), 16))
end
local function abbrev(n: number): string
	n = math.floor(n or 0)
	local s = { "", "K", "M", "B", "T", "Qa", "Qi" }
	local i = 1
	local v = n
	while math.abs(v) >= 1000 and i < #s do
		v /= 1000
		i += 1
	end
	return (i == 1 and tostring(n)) or string.format(v < 10 and "%.2f%s" or v < 100 and "%.1f%s" or "%.0f%s", v, s[i])
end
local function new(class, props, children)
	local o = Instance.new(class)
	for k, v in props or {} do
		o[k] = v
	end
	for _, c in children or {} do
		c.Parent = o
	end
	return o
end
local function corner(r)
	return new("UICorner", { CornerRadius = UDim.new(0, r or 14) })
end
local function stroke(t, c)
	return new("UIStroke", { Thickness = t or 3, Color = c or Color3.fromRGB(20, 16, 34), ApplyStrokeMode = Enum.ApplyStrokeMode.Border })
end
local function grad(c)
	return new("UIGradient", { Color = ColorSequence.new(c:Lerp(WHITE, 0.25), c:Lerp(Color3.new(0, 0, 0), 0.15)), Rotation = 90 })
end
local function label(text, size, props)
	local l = new("TextLabel", { BackgroundTransparency = 1, Text = text, Font = FONT, TextColor3 = WHITE, TextScaled = true, Size = size or UDim2.fromScale(1, 1) })
	new("UIStroke", { Thickness = 2, Color = Color3.fromRGB(20, 16, 34) }).Parent = l
	for k, v in props or {} do
		l[k] = v
	end
	return l
end
local function pop(o)
	local s = o:FindFirstChildOfClass("UIScale") or new("UIScale", { Parent = o })
	s.Scale = 0.88
	TweenService:Create(s, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()
end

-- root -------------------------------------------------------------------------------
local gui = new("ScreenGui", { Name = "ForgeGameGui", ResetOnSpawn = false, IgnoreGuiInset = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling })
local scale = new("UIScale", { Parent = gui })
local function rescale()
	local cam = workspace.CurrentCamera
	local v = cam and cam.ViewportSize or Vector2.new(1280, 720)
	scale.Scale = math.clamp(math.min(v.X / 1280, v.Y / 720) * 1.25, 0.62, 1.15)
end
rescale()
if workspace.CurrentCamera then
	workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(rescale)
end

-- counters (top left) --------------------------------------------------------------------
local counters = new("Frame", { Name = "Counters", BackgroundTransparency = 1, Position = UDim2.fromOffset(12, 12), Size = UDim2.fromOffset(240, 400), Parent = gui }, {
	new("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder }),
})
local valueLabels = {}
local function counter(id, icon, color, order)
	local f = new("Frame", { Size = UDim2.fromOffset(220, 46), BackgroundColor3 = color, LayoutOrder = order, Parent = counters }, { corner(14), stroke(3), grad(color) })
	label(icon or "⭐", UDim2.fromOffset(40, 40), { Position = UDim2.fromOffset(4, 3), Parent = f })
	local v = label("0", UDim2.new(1, -56, 0, 34), { Position = UDim2.fromOffset(48, 6), TextXAlignment = Enum.TextXAlignment.Left, Parent = f })
	valueLabels[id] = v
end
local COLORS = { "#ff5c5c", "#5aa9ff", "#3dd68c", "#b46bff", "#ffb02e" }
for i, s in cfg.stats or {} do
	counter(s.id, s.e, hex(COLORS[(i - 1) % #COLORS + 1]), i)
end
for i, m in cfg.money or {} do
	counter(m.id, m.e, hex(m.id == "Gems" and "#3ee6ff" or "#ffc02e"), 10 + i)
end
if cfg.rebirth then
	counter("Rebirths", "🔁", hex("#b46bff"), 30)
end

-- buttons (right side) --------------------------------------------------------------------
local bar = new("Frame", { Name = "Buttons", BackgroundTransparency = 1, AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -12, 0.55, 0), Size = UDim2.fromOffset(200, 520), Parent = gui }, {
	new("UIListLayout", { Padding = UDim.new(0, 10), VerticalAlignment = Enum.VerticalAlignment.Center, HorizontalAlignment = Enum.HorizontalAlignment.Right }),
})
local panels = {}
local function openPanel(name)
	for n, p in panels do
		p.Visible = n == name and not p.Visible
		if p.Visible then
			pop(p)
		end
	end
end
local busy = false
local function ask(kind, arg)
	if busy then
		return
	end
	busy = true
	local ok, res = pcall(function()
		return Action:InvokeServer(kind, arg)
	end)
	busy = false
	return ok and res
end
local floatLayer = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Parent = gui })
local function floatText(text, color)
	local l = label(text, UDim2.fromOffset(160, 44), { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5 + (math.random() - 0.5) * 0.2, 0.55), TextColor3 = color or WHITE, Parent = floatLayer })
	TweenService:Create(l, TweenInfo.new(0.9, Enum.EasingStyle.Quad), { Position = l.Position - UDim2.fromScale(0, 0.12), TextTransparency = 1 }):Play()
	task.delay(0.95, function()
		l:Destroy()
	end)
end
local function button(text, color, onClick)
	local b = new("TextButton", { Size = UDim2.fromOffset(190, 58), BackgroundColor3 = color, Text = "", AutoButtonColor = false, Parent = bar }, { corner(16), stroke(3), grad(color) })
	label(text, UDim2.new(1, -16, 1, -12), { Position = UDim2.fromOffset(8, 6), Parent = b })
	b.MouseButton1Down:Connect(function()
		TweenService:Create(b, TweenInfo.new(0.08), { Size = UDim2.fromOffset(180, 54) }):Play()
	end)
	b.MouseButton1Up:Connect(function()
		TweenService:Create(b, TweenInfo.new(0.2, Enum.EasingStyle.Back), { Size = UDim2.fromOffset(190, 58) }):Play()
	end)
	b.Activated:Connect(onClick)
	return b
end
for _, b in cfg.buttons or {} do
	local color = hex(b.color)
	if b.action == "add" then
		button(b.label, color, function()
			local ok, gain = ask("add", b.id)
			if ok then
				floatText("+" .. abbrev(gain) .. " " .. b.stat, color)
			end
		end)
	elseif b.action == "train" then
		button(b.label, color, function()
			local ok, gain = ask("train")
			if ok then
				floatText("+" .. abbrev(gain), color)
			end
		end)
	elseif b.action == "sell" or b.action == "home" then
		button(b.label, color, function()
			ask(b.action)
		end)
	else -- shop / rebirth / egg: open their panel
		button(b.label, color, function()
			openPanel(b.action)
		end)
	end
end
if cfg.daily then
	button("🎁 Cadeau", hex("#ff7ab6"), function()
		ask("daily")
	end)
end
if cfg.codes and #cfg.codes > 0 then
	button("🎟️ Codes", hex("#5aa9ff"), function()
		openPanel("codes")
	end)
end

-- panels -------------------------------------------------------------------------------
local function panel(name, title, color)
	local p = new("Frame", { Name = name, Visible = false, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(560, 380), BackgroundColor3 = color, Parent = gui }, { corner(22), stroke(4), grad(color) })
	label(title, UDim2.new(1, -120, 0, 48), { Position = UDim2.fromOffset(20, 10), TextXAlignment = Enum.TextXAlignment.Left, Parent = p })
	local close = new("TextButton", { Text = "", AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -12, 0, 12), Size = UDim2.fromOffset(44, 44), BackgroundColor3 = hex("#ff4d6d"), Parent = p }, { corner(12), stroke(3) })
	label("✕", UDim2.fromScale(0.8, 0.8), { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Parent = close })
	close.Activated:Connect(function()
		p.Visible = false
	end)
	local body = new("ScrollingFrame", { BackgroundTransparency = 1, Position = UDim2.fromOffset(16, 68), Size = UDim2.new(1, -32, 1, -84), CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 6, Parent = p })
	panels[name] = p
	return p, body
end
local state = { values = {}, owned = {} }
local shopCards = {}
if cfg.shop then
	local _, body = panel("shop", "🛒 Boutique", hex("#ffb02e"))
	new("UIGridLayout", { CellSize = UDim2.fromOffset(160, 190), CellPadding = UDim2.fromOffset(10, 10), Parent = body })
	local EFFECT = { perClick = "+%s par clic", mult = "Gains ×%s", sellMult = "Vente ×%s", capacity = "Sac +%s00", speed = "Vitesse +%s" }
	for _, it in cfg.shop.items do
		local c = new("Frame", { BackgroundColor3 = hex("#2b2340"), Parent = body }, { corner(16), stroke(3) })
		label(it.e or "⭐", UDim2.fromOffset(60, 60), { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 8), Parent = c })
		label(it.name, UDim2.new(1, -12, 0, 26), { Position = UDim2.fromOffset(6, 70), Parent = c })
		label(string.format(EFFECT[it.effect] or "%s", tostring(it.value)), UDim2.new(1, -12, 0, 20), { Position = UDim2.fromOffset(6, 98), TextColor3 = hex("#ffe08a"), Parent = c })
		local buy = new("TextButton", { Text = "", Position = UDim2.new(0, 10, 1, -54), Size = UDim2.new(1, -20, 0, 44), BackgroundColor3 = hex("#3dd68c"), Parent = c }, { corner(12), stroke(3) })
		local bl = label(abbrev(it.price) .. " " .. it.money, UDim2.new(1, -10, 1, -10), { Position = UDim2.fromOffset(5, 5), Parent = buy })
		buy.Activated:Connect(function()
			if not state.owned[it.id] then
				ask("buy", it.id)
			end
		end)
		shopCards[it.id] = { btn = buy, label = bl, item = it }
	end
end
local rebirthInfo
if cfg.rebirth then
	local _, body = panel("rebirth", "🔁 Rebirth", hex("#b46bff"))
	rebirthInfo = label("", UDim2.new(1, 0, 0, 90), { Parent = body, TextWrapped = true })
	local go = new("TextButton", { Text = "", Position = UDim2.fromOffset(0, 110), Size = UDim2.new(1, 0, 0, 64), BackgroundColor3 = hex("#3dd68c"), Parent = body }, { corner(16), stroke(3) })
	label("🔁 Faire un rebirth", UDim2.new(1, -16, 1, -12), { Position = UDim2.fromOffset(8, 6), Parent = go })
	go.Activated:Connect(function()
		ask("rebirth")
	end)
end
if cfg.eggs then
	local _, body = panel("egg", "🥚 Œuf · " .. abbrev(cfg.eggs.price) .. " " .. cfg.eggs.money, hex("#ff7ab6"))
	new("UIListLayout", { Padding = UDim.new(0, 6), Parent = body })
	local total = 0
	for _, p in cfg.eggs.pets do
		total += p.w
	end
	for _, p in cfg.eggs.pets do
		label(string.format("%s · ×%s · %.1f%%", p.name, tostring(p.mult), p.w / total * 100), UDim2.new(1, 0, 0, 30), { Parent = body })
	end
	local hatch = new("TextButton", { Text = "", Size = UDim2.new(1, 0, 0, 60), BackgroundColor3 = hex("#3dd68c"), Parent = body }, { corner(16), stroke(3) })
	label("🥚 Ouvrir", UDim2.new(1, -16, 1, -12), { Position = UDim2.fromOffset(8, 6), Parent = hatch })
	hatch.Activated:Connect(function()
		ask("egg")
	end)
	button("🥚 Œufs", hex("#ff7ab6"), function()
		openPanel("egg")
	end)
end
if cfg.codes and #cfg.codes > 0 then
	local _, body = panel("codes", "🎟️ Codes", hex("#5aa9ff"))
	local box = new("TextBox", { PlaceholderText = "Entre un code…", Text = "", Font = FONT, TextScaled = true, Size = UDim2.new(1, 0, 0, 56), BackgroundColor3 = WHITE, TextColor3 = Color3.fromRGB(30, 24, 50), Parent = body }, { corner(14), stroke(3) })
	local go = new("TextButton", { Text = "", Position = UDim2.fromOffset(0, 70), Size = UDim2.new(1, 0, 0, 56), BackgroundColor3 = hex("#3dd68c"), Parent = body }, { corner(14), stroke(3) })
	label("Valider", UDim2.new(1, -16, 1, -12), { Position = UDim2.fromOffset(8, 6), Parent = go })
	go.Activated:Connect(function()
		ask("code", box.Text)
		box.Text = ""
	end)
end

-- auto-train toggle ------------------------------------------------------------------------
if cfg.autoTrain and cfg.train then
	local on = false
	local b
	b = button("🤖 Auto : OFF", hex("#6b7280"), function()
		on = not on
		b:FindFirstChildOfClass("TextLabel").Text = on and "🤖 Auto : ON" or "🤖 Auto : OFF"
		b.BackgroundColor3 = on and hex("#3dd68c") or hex("#6b7280")
	end)
	task.spawn(function()
		while true do
			task.wait(math.max(0.25, cfg.train.cooldown or 0.25))
			if on then
				ask("train")
			end
		end
	end)
end

-- training tool -------------------------------------------------------------------------------
local function hookTool(tool)
	if tool:IsA("Tool") and tool.Name == "ForgeTrain" then
		tool.Activated:Connect(function()
			local ok, gain = ask("train")
			if ok then
				floatText("+" .. abbrev(gain))
			end
		end)
	end
end
local function hookChar(char)
	char.ChildAdded:Connect(hookTool)
	for _, c in char:GetChildren() do
		hookTool(c)
	end
end
player.CharacterAdded:Connect(hookChar)
if player.Character then
	hookChar(player.Character)
end

-- toasts -----------------------------------------------------------------------------------------
local toasts = new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 14), Size = UDim2.fromOffset(460, 200), Parent = gui }, {
	new("UIListLayout", { Padding = UDim.new(0, 6), HorizontalAlignment = Enum.HorizontalAlignment.Center }),
})
Notify.OnClientEvent:Connect(function(text, kind)
	local c = hex(kind == "good" and "#3dd68c" or kind == "warn" and "#ff9f43" or "#5aa9ff")
	local t = new("Frame", { Size = UDim2.fromOffset(440, 44), BackgroundColor3 = c, Parent = toasts }, { corner(14), stroke(3), grad(c) })
	label(text, UDim2.new(1, -20, 1, -10), { Position = UDim2.fromOffset(10, 5), Parent = t })
	pop(t)
	task.delay(2.6, function()
		t:Destroy()
	end)
end)
Open.OnClientEvent:Connect(function(zone)
	local map = { Shop = "shop", Egg = "egg", Rebirth = "rebirth" }
	if map[zone] and panels[map[zone]] and not panels[map[zone]].Visible then
		openPanel(map[zone])
	end
end)

-- state -------------------------------------------------------------------------------------------
State.OnClientEvent:Connect(function(s)
	state = s
	for id, v in s.values or {} do
		if valueLabels[id] then
			valueLabels[id].Text = abbrev(v)
		end
	end
	if valueLabels.Rebirths then
		valueLabels.Rebirths.Text = tostring(s.rebirths or 0)
	end
	for id, card in shopCards do
		local owned = s.owned and s.owned[id]
		card.label.Text = owned and "✅ Acheté" or (abbrev(card.item.price) .. " " .. card.item.money)
		card.btn.BackgroundColor3 = owned and hex("#6b7280") or ((s.values[card.item.money] or 0) >= card.item.price and hex("#3dd68c") or hex("#ff9f43"))
	end
	if rebirthInfo and s.rebirthCost then
		local bonus = cfg.rebirth.bonus or 0.5
		rebirthInfo.Text = string.format("Il faut %s %s.\nBonus de rebirth : ×%.1f → ×%.1f", abbrev(s.rebirthCost), cfg.rebirth.costStat, 1 + bonus * (s.rebirths or 0), 1 + bonus * ((s.rebirths or 0) + 1))
	end
end)

-- PC shortcuts: E = first stat button, Q = sell ---------------------------------------------------
UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	if input.KeyCode == Enum.KeyCode.E and cfg.train then
		ask("train")
	elseif input.KeyCode == Enum.KeyCode.Q and cfg.sell then
		ask("sell")
	end
end)

gui.Parent = player:WaitForChild("PlayerGui")
