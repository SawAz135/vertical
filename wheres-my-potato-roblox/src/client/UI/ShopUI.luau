--[[ ShopUI — Stud style window "CHEZ GÉRARD": gold stud header, dark studded body, one
     colored stud panel per item (big emoji sticker, current → next level, description) and a
     glossy green price button (grey when you can't afford it, MAX when maxed). Opens with the
     kit's bounce + blur (StudMotion.Window). ]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)
local Net = require(ReplicatedStorage.Shared.Net)
local UI = require(ReplicatedStorage.Shared.StudKit.StudUI)
local Motion = require(ReplicatedStorage.Shared.StudKit.StudMotion)
local State = require(script.Parent.Parent.Controllers.State)
local Sound = require(script.Parent.Parent.Controllers.Sound)
local HUD = require(script.Parent.HUD)

local Shop = {}
local RGB = Color3.fromRGB
local gui = UI.ScreenGui("MenuShop", 12)
local win = UI.Window(gui, { Size = Vector2.new(700, 520), Title = "CHEZ GÉRARD", Header = "gold", Close = true })
local menu
local moneyPill = UI.Pill(win.Entete, "0 ₣", { Width = 170, Height = 34, Position = UDim2.fromOffset(win.Width - 175, 39), TextSize = 20, ZIndex = 14 })
local list = UI.ScrollList(win.Corps, { Size = UDim2.new(1, -8, 1, -8), Padding = 10, PadTop = 12, PadLeft = 12, PadRight = 14 })
local PANELS = { "amber", "cyan", "lime", "violet", "magenta", "blue", "money", "green", "gold" }

local rows = {}
for i, it in Config.ITEMS do
	local p = UI.StudPanel(list, { Name = it.id, Size = UDim2.new(1, -10, 0, 92), Gradient = PANELS[(i - 1) % #PANELS + 1], Corner = 8, LayoutOrder = i })
	UI.Text(p, it.icon, { Name = "Sticker", Size = UDim2.fromOffset(64, 64), Position = UDim2.fromOffset(44, 46), Max = 56, Rotation = -8, ZIndex = 9, Thickness = 0 })
	local name = UI.Text(p, it.name, { Name = "Nom", Size = UDim2.new(1, -270, 0, 28), Position = UDim2.fromOffset(84, 22), AnchorPoint = Vector2.new(0, 0.5), AlignX = Enum.TextXAlignment.Left, Max = 24, ZIndex = 9 })
	local desc = UI.Text(p, "", { Name = "Desc", Font = "Bold", Size = UDim2.new(1, -270, 0, 48), Position = UDim2.fromOffset(84, 62), AnchorPoint = Vector2.new(0, 0.5), AlignX = Enum.TextXAlignment.Left, AlignY = Enum.TextYAlignment.Top, Max = 16, Rich = true, ZIndex = 9 })
	desc.TextWrapped = true
	local buy = UI.Button(p, { Name = "Acheter", Style = "Glossy", Theme = "cash", Size = Vector2.new(160, 60), Text = "", Position = UDim2.new(1, -92, 0.5, 0), ZIndex = 10 })
	local price = UI.Text(buy, "", { Name = "Prix", Size = UDim2.new(1, -16, 0, 34), Position = UDim2.new(0.5, 0, 0.5, -3), Max = 28, Font = "Gotham", Stroke = RGB(20, 40, 4), Thickness = 2.6, ZIndex = 20 })
	Motion.BindButton(buy, 1.05, gui.Sons, function()
		local lv = State.data and State.data.levels[it.id] or 0
		local nx = it.levels[lv + 2]
		if not nx then return end
		if State.data.money < nx.price then Motion.Shake(buy); Sound.play("Error"); Motion.Float(buy, "Pas assez de ₣ !", UI.Colors.FloatError); return end
		Sound.play("Buy"); Net.event("Buy"):FireServer(it.id); Motion.Float(buy, "Acheté !", UI.Colors.FloatSuccess)
	end)
	rows[it.id] = { name = name, desc = desc, buy = buy, price = price, it = it }
end

function Shop.refresh()
	local d = State.data; if not d then return end
	local mt = moneyPill:FindFirstChild("Texte") :: TextLabel
	if mt then mt.Text = "<font color=\"#B4FF8C\">" .. HUD.fmt(d.money) .. " ₣</font>" end
	for id, r in rows do
		local lv = d.levels[id] or 0
		local cur, nx = r.it.levels[lv + 1], r.it.levels[lv + 2]
		r.name.Text = r.it.name .. " · " .. cur.name
		if nx then
			r.desc.Text = "<font color=\"#FFD23F\">→ " .. nx.name .. "</font> : " .. nx.desc
			r.price.Text = HUD.fmt(nx.price) .. " ₣"
			local can = d.money >= nx.price
			UI.Recolor(r.buy, if can then "cash" else "gray")
		else
			r.desc.Text = cur.desc; r.price.Text = "MAX"; UI.Recolor(r.buy, "purple")
		end
	end
end

Shop.onClose = nil :: (() -> ())?
function Shop.open() Shop.refresh(); Sound.play("Open"); menu.Open() end
function Shop.close() if menu.IsOpen then menu.Close() end end
function Shop.isOpen() return menu and menu.IsOpen end
function Shop.mount()
	gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")
	Motion.CreateSounds(gui.Sons)
	menu = Motion.Window(gui, win.Fenetre, { Keep = { HUD = false } })
	if win.Fermer then Motion.BindButton(win.Fermer, 1.06, gui.Sons, function() Shop.close() end) end
	local origClose = menu.Close
	menu.Close = function(...) origClose(...); if Shop.onClose then Shop.onClose() end end
	State.Changed:Connect(function() if menu.IsOpen then Shop.refresh() end end)
end

return Shop
