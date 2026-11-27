--[[ HUD — Stud style (chunky stud panels, saturated gradients, thick dark outlines,
     extruded text), kept simple like the web version:
     - top centre: the discouraging counter of potatoes left in the desert, its ridiculous
       percentage and the time it would take you at your own pace
     - top left: money
     - bottom: 3D stud buttons for the tools you own, carried count on the active one
     - centre: action prompt pill + small crosshair
     - right: 📖 manual / 👥 multiplayer stud buttons; stud toasts
     - mobile: a big orange ✋ action button (hold) ]]
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)
local UI = require(ReplicatedStorage.Shared.StudKit.StudUI)
local Motion = require(ReplicatedStorage.Shared.StudKit.StudMotion)
local State = require(script.Parent.Parent.Controllers.State)

local HUD = {}
local player = Players.LocalPlayer
local RGB = Color3.fromRGB
local gui = UI.ScreenGui("HUD", 10, { Menu = false })
gui.Enabled = false
HUD.gui = gui
local root = UI.new("Frame", { Name = "Racine", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1) }, gui)
local POTATO = UI.seq(RGB(255, 226, 120), RGB(244, 176, 52), RGB(214, 124, 20))

local function corner(o: Instance, r: number) local c = Instance.new("UICorner"); c.CornerRadius = UDim.new(r, 0); c.Parent = o end
local function stroke(o: Instance, col: Color3, th: number, tr: number?) return UI.Stroke(o, col, th, tr) end
local function label(parent: Instance, props: { [string]: any }): TextLabel
	local t = Instance.new("TextLabel"); t.BackgroundTransparency = 1; t.TextColor3 = Color3.new(1, 1, 1); t.Font = Enum.Font.FredokaOne; t.TextScaled = true
	for k, v in props do (t :: any)[k] = v end
	t.Parent = parent; return t
end
local function panel(parent: Instance, props: { [string]: any }): Frame
	local f = Instance.new("Frame"); f.BackgroundColor3 = RGB(20, 16, 12); f.BackgroundTransparency = 0.3
	for k, v in props do (f :: any)[k] = v end
	f.Parent = parent; return f
end
HUD.corner, HUD.stroke, HUD.label, HUD.panel = corner, stroke, label, panel

-- every block lives in a scaled corner container (1050×620 reference, responsive)
local function anchorBox(name: string, size: Vector2, anchor: Vector2, pos: UDim2): Frame
	local f = UI.new("Frame", { Name = name, BackgroundTransparency = 1, Size = UDim2.fromOffset(size.X, size.Y), AnchorPoint = anchor, Position = pos }, root)
	local sc = UI.new("UIScale", { Name = "WindowScale" }, f)
	Motion.BindResponsive(sc, 1)
	return f
end

-- ---------------------------------------------------------------- counter (top centre)
local topBox = anchorBox("Compteur", Vector2.new(400, 104), Vector2.new(0.5, 0), UDim2.new(0.5, 0, 0, 8))
local top = UI.StudPanel(topBox, { Name = "Panneau", Size = UDim2.fromOffset(400, 92), Gradient = POTATO, Corner = 10 })
UI.Text(top, "PATATES RESTANTES DANS LE DÉSERT", { Size = UDim2.new(1, -20, 0, 18), Position = UDim2.new(0.5, 0, 0, 14), Max = 16, Font = "Gotham", Stroke = RGB(80, 40, 4), ZIndex = 8 })
local leftN = UI.ShadowText(top, "10 000 000 000", { Size = UDim2.new(1, -20, 0, 46), Position = UDim2.new(0.5, 0, 0, 48), Max = 44, Font = "Gotham", Stroke = RGB(70, 30, 0), Thickness = 3.4, ZIndex = 8 })
local leftShadow = top:FindFirstChild("Ombre") :: TextLabel
local leftScale = UI.new("UIScale", {}, top)
local pill = UI.Pill(topBox, "0 % récolté", { Width = 360, Height = 26, Position = UDim2.new(0.5, 0, 1, -8), TextSize = 15, ZIndex = 12 })
local leftP = pill:FindFirstChild("Texte") :: TextLabel

-- ---------------------------------------------------------------- money (top left)
local moneyBox = anchorBox("Argent", Vector2.new(230, 64), Vector2.new(0, 0), UDim2.fromOffset(12, 10))
local money = UI.StudPanel(moneyBox, { Size = UDim2.fromOffset(230, 58), Gradient = "money", Corner = 10 })
local coin = UI.new("Frame", { Name = "Piece", BackgroundColor3 = Color3.new(1, 1, 1), Size = UDim2.fromOffset(46, 46), Position = UDim2.fromOffset(6, 6), ZIndex = 9 }, money)
UI.Corner(coin, 23); UI.Gradient(coin, UI.seq(RGB(255, 236, 120), RGB(255, 186, 30), RGB(220, 130, 10)), 90); UI.Stroke(coin, RGB(90, 50, 0), 3)
UI.ShadowText(coin, "₣", { Size = UDim2.fromScale(1, 1), Max = 30, Font = "Gotham", Stroke = RGB(110, 60, 0), ZIndex = 10 })
local moneyT = UI.ShadowText(money, "0", { Size = UDim2.new(1, -66, 0, 40), Position = UDim2.new(0, 60, 0.5, 0), AnchorPoint = Vector2.new(0, 0.5), AlignX = Enum.TextXAlignment.Left, Max = 36, Font = "Gotham", Stroke = RGB(15, 51, 0), Thickness = 3, Gradient = UI.TextGradients.Money, ZIndex = 9 })
local moneyShadow = money:FindFirstChild("Ombre") :: TextLabel
local moneyScale = UI.new("UIScale", {}, money)
local shown = 0

-- ---------------------------------------------------------------- prompt + crosshair
local prompt = UI.Pill(root, "", { Height = 36, Position = UDim2.fromScale(0.5, 0.63), TextSize = 20, ZIndex = 30 })
local promptT = prompt:FindFirstChild("Texte") :: TextLabel
local cross = panel(root, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(8, 8), BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.1 })
corner(cross, 0.5); UI.Stroke(cross, RGB(12, 20, 26), 2)

-- ---------------------------------------------------------------- tools (bottom)
local toolsBox = anchorBox("Outils", Vector2.new(360, 96), Vector2.new(0.5, 1), UDim2.new(0.5, 0, 1, -6))
UI.new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Center, VerticalAlignment = Enum.VerticalAlignment.Top, Padding = UDim.new(0, 10), SortOrder = Enum.SortOrder.LayoutOrder }, toolsBox)
local ICON = { hands = "✋", bucket = "🪣", vacuum = "🌀", cannon = "💥" }
local THEME = { hands = "orange", bucket = "blue", vacuum = "purple", cannon = "red" }
local toolBtn = {}
HUD.onTool = nil :: ((string) -> ())?
for i, id in { "hands", "bucket", "vacuum", "cannon" } do
	local holder = UI.new("Frame", { Name = id, BackgroundTransparency = 1, Size = UDim2.fromOffset(78, 96), LayoutOrder = i }, toolsBox)
	local b = UI.Button(holder, { Name = "Bouton", Style = "Stud", Theme = THEME[id], Size = Vector2.new(72, 68), Position = UDim2.new(0.5, 0, 0, 36) })
	UI.Text(b, ICON[id], { Name = "Emoji", Size = UDim2.fromOffset(46, 46), Position = UDim2.new(0.5, 0, 0.5, -3), Max = 40, ZIndex = 12, Thickness = 0 })
	local key = UI.Text(b, tostring(i), { Name = "Touche", Size = UDim2.fromOffset(18, 18), Position = UDim2.fromOffset(10, 10), Max = 14, Font = "Gotham", ZIndex = 13 })
	local cnt = UI.Text(holder, "", { Name = "Compte", Size = UDim2.fromOffset(90, 22), Position = UDim2.new(0.5, 0, 1, -8), Max = 18, Font = "Gotham", ZIndex = 12 })
	local sel = UI.Stroke(b, Color3.new(1, 1, 1), 0, 0, Enum.ApplyStrokeMode.Border, "Selection")
	Motion.BindButton(b, 1.06, nil, function() if HUD.onTool then HUD.onTool(id) end end)
	toolBtn[id] = { h = holder, b = b, cnt = cnt, sel = sel, key = key }
end

-- ---------------------------------------------------------------- side buttons (right)
local sideBox = anchorBox("Cote", Vector2.new(78, 170), Vector2.new(1, 0.5), UDim2.new(1, -10, 0.42, 0))
UI.new("UIListLayout", { Padding = UDim.new(0, 12), HorizontalAlignment = Enum.HorizontalAlignment.Center, SortOrder = Enum.SortOrder.LayoutOrder }, sideBox)
HUD.onBook, HUD.onInvite = nil :: (() -> ())?, nil :: (() -> ())?
local function sideBtn(order: number, icon: string, tip: string, theme: string, cb: () -> ())
	local holder = UI.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(74, 78), LayoutOrder = order }, sideBox)
	local b = UI.Button(holder, { Style = "Stud", Theme = theme, Size = Vector2.new(68, 64), Position = UDim2.new(0.5, 0, 0, 32) })
	UI.Text(b, icon, { Size = UDim2.fromOffset(40, 40), Position = UDim2.new(0.5, 0, 0.5, -3), Max = 34, ZIndex = 12, Thickness = 0 })
	UI.Text(holder, tip, { Size = UDim2.fromOffset(90, 16), Position = UDim2.new(0.5, 0, 1, -4), Max = 13, Font = "Gotham", ZIndex = 12 })
	Motion.BindButton(b, 1.06, nil, cb)
end
sideBtn(1, "📖", "Manuel", "yellow", function() if HUD.onBook then HUD.onBook() end end)
sideBtn(2, "👥", "Multijoueur", "green", function() if HUD.onInvite then HUD.onInvite() end end)

-- ---------------------------------------------------------------- mobile action button
local actBox = anchorBox("Action", Vector2.new(130, 130), Vector2.new(1, 1), UDim2.new(1, -24, 1, -140))
actBox.Visible = false
local act = UI.Button(actBox, { Style = "Stud", Theme = "orange", Size = Vector2.new(124, 124), Position = UDim2.fromScale(0.5, 0.5) })
UI.Text(act, "✋", { Size = UDim2.fromOffset(80, 80), Position = UDim2.new(0.5, 0, 0.5, -4), Max = 70, ZIndex = 12, Thickness = 0 })
UI.Corner(act, 62); for _, n in { "Biseau", "Face" } do local o = act:FindFirstChild(n); if o then UI.Corner(o, 60) end end
HUD.onUse = nil :: ((boolean) -> ())?
local actScale = UI.new("UIScale", { Name = "Press" }, act)
act.InputBegan:Connect(function(i) if i.UserInputType == Enum.UserInputType.Touch then if HUD.onUse then HUD.onUse(true) end; actScale.Scale = 0.92 end end)
act.InputEnded:Connect(function(i) if i.UserInputType == Enum.UserInputType.Touch then if HUD.onUse then HUD.onUse(false) end; TweenService:Create(actScale, Motion.RELEASE, { Scale = 1 }):Play() end end)

-- ---------------------------------------------------------------- toasts (stud panels)
local toasts = anchorBox("Notifs", Vector2.new(330, 260), Vector2.new(1, 0), UDim2.new(1, -12, 0, 12))
UI.new("UIListLayout", { HorizontalAlignment = Enum.HorizontalAlignment.Right, Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder }, toasts)
local order = 0
function HUD.toast(text: string, kind: string?)
	order += 1
	local p = UI.StudPanel(toasts, { Size = UDim2.fromOffset(320, 44), Gradient = if kind == "gold" then "gold" elseif kind == "warn" then UI.seq(RGB(255, 120, 120), RGB(220, 30, 50)) else "blue", Corner = 8, LayoutOrder = order })
	UI.Text(p, text, { Size = UDim2.new(1, -20, 1, -10), Max = 20, Font = "Gotham", ZIndex = 8, Stroke = RGB(30, 20, 6) })
	UI.new("UIScale", {}, p); Motion.PopIn(p, 0.3)
	local n = 0
	for _, c in toasts:GetChildren() do if c:IsA("Frame") then n += 1 end end
	if n > 4 then for _, c in toasts:GetChildren() do if c:IsA("Frame") and c ~= p then c:Destroy(); break end end end
	task.delay(3.4, function() if p.Parent then p:Destroy() end end)
end

-- ---------------------------------------------------------------- update
local function fmt(n: number): string
	local s = tostring(math.floor(n))
	local out = s:reverse():gsub("(%d%d%d)", "%1 "):reverse()
	return (out:gsub("^ ", ""))
end
HUD.fmt = fmt
local function setShadow(t: TextLabel, sh: TextLabel?, txt: string) t.Text = txt; if sh then sh.Text = txt end end
local lastLeft, ready = -1, nil :: string?
function HUD.update(dt: number, promptText: string)
	local d = State.data; if not d then return end
	local diff = d.money - shown
	if math.abs(diff) > 0.05 then shown += diff * math.min(1, dt * 8) + math.sign(diff) * math.min(math.abs(diff), dt * 3) else shown = d.money end
	setShadow(moneyT, moneyShadow, fmt(shown + 0.5))
	-- discouraging counter
	local picked = d.stats.picked or 0
	local left = Config.TOTAL_DESERT - picked
	if left ~= lastLeft then
		lastLeft = left; setShadow(leftN, leftShadow, fmt(left))
		leftScale.Scale = 1.06; TweenService:Create(leftScale, Motion.RELEASE, { Scale = 1 }):Play()
		local pct = picked / Config.TOTAL_DESERT * 100
		local dec = if pct > 0 then math.clamp(-math.floor(math.log10(pct)) + 1, 2, 12) else 0
		local ptxt = if pct > 0 then (string.format("%." .. dec .. "f", pct):gsub("%.", ",")) else "0"
		local rate = picked / math.max(60, (d.stats.time or 0) + os.clock() - (HUD.t0 or os.clock()))
		local years = if rate > 0 then left / rate / 31557600 else math.huge
		local ytxt = if years == math.huge or picked < 4 then "" elseif years > 1e6 then " · fini dans <font color=\"#FFD23F\">" .. fmt(years / 1e6) .. " millions d’années</font>" else " · fini dans <font color=\"#FFD23F\">" .. fmt(years) .. " ans</font>"
		leftP.Text = ptxt .. " % récolté" .. ytxt
	end
	-- tools
	local c = d.carry or {}
	for id, tb in toolBtn do
		local un = id == "hands" or (d.levels[id] or 0) > 0
		tb.h.Visible = un
		local on = State.tool == id
		tb.sel.Thickness = if on then 3 else 0
		local n = if id == "bucket" then c.bucket elseif id == "vacuum" then c.tank elseif id == "cannon" then (c.hands or 0) + (c.bucket or 0) + (c.tank or 0) else c.hands
		local capN = if id == "bucket" then c.capBucket elseif id == "vacuum" then c.capTank elseif id == "cannon" then nil else c.capHands
		tb.cnt.Text = if on then (tostring(n or 0) .. (if capN then "/" .. capN else "")) else ""
		tb.cnt.TextColor3 = if on and capN and (n or 0) >= capN then RGB(255, 150, 90) else Color3.new(1, 1, 1)
		UI.SetDisabled(tb.b, not on)
		tb.key.Visible = not State.isMobile
	end
	-- prompt
	prompt.Visible = promptText ~= ""
	if promptText ~= "" and promptT.Text ~= promptText then promptT.Text = promptText end
	-- affordable upgrade announced once
	local best
	for _, it in Config.ITEMS do local nx = it.levels[(d.levels[it.id] or 0) + 2]; if nx and (not best or nx.price < best.price) then best = { price = nx.price, name = nx.name, icon = it.icon } end end
	if best and d.money >= best.price and ready ~= best.name then ready = best.name; HUD.toast(best.icon .. " " .. best.name .. " dispo chez Gérard !", "gold") end
end
function HUD.bump() moneyScale.Scale = 1.08; TweenService:Create(moneyScale, Motion.RELEASE, { Scale = 1 }):Play() end

function HUD.mount()
	gui.Parent = player:WaitForChild("PlayerGui")
	State.isMobile = UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled
	actBox.Visible = State.isMobile
	if State.isMobile then toolsBox.AnchorPoint = Vector2.new(0, 1); toolsBox.Position = UDim2.new(0, 10, 1, -150) end
	HUD.t0 = os.clock()
end
function HUD.show(v: boolean) gui.Enabled = v end

return HUD
