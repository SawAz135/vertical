--[[ Potions: the luck potions in the BOTTOM-RIGHT corner of the screen.
     No panel, no background: just the 3D studded potion bottles standing in the corner.
       - a potion you own but did not drink: still bottle, "x3" count under it.
         Tap once -> "TAP AGAIN" (no accidental drinks), tap again -> drink.
       - an active potion: the bottle sways and turns slowly, the time left counts down
         under it ("9:41"), and it blinks during its last 30 seconds.
       - above the bottles, "LUCK x10": your total luck multiplier (potions x gamepass x event).
     Drinking: the bottle pops up, tips over like it is being drunk, and studded bubbles
     rise out of it. A new potion (drop / purchase) pops in with a bounce. ]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local PotionConfig = require(Shared.Config.PotionConfig)
local Format = require(Shared.Util.Format)
local Sim = require(script.Parent.Sim)
local Data = require(script.Parent.Parent.Controllers.Data)

local Potions = {}
local player = Players.LocalPlayer
local new = Sim.new
local RGB = Color3.fromRGB
local SLOT_W, SLOT_H = 84, 112

local slots = {}
local stamp = os.clock() -- when the "potions" values were received (client countdown)
local lastInv, lastActive = {}, {}
local luckPill

local function tween(o, t, goal, style, dir)
	local tw = TweenService:Create(o, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), goal)
	tw:Play()
	return tw
end

local function values()
	local p = Data.values.potions
	return (p and p.inv) or {}, (p and p.active) or {}
end

-- seconds left of an active potion, counted down locally between two server pushes
local function leftOf(id: string): number
	local _, active = values()
	local left = active[id]
	if not left then return 0 end
	return math.max(0, left - (os.clock() - stamp))
end

-- studded bubbles rising out of a bottle (small squares with a stud dot, no glow)
local function bubbles(slot, color: Color3)
	for i = 1, 9 do
		local sz = math.random(8, 14)
		local b = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1):Lerp(color, 0.55), BorderSizePixel = 0, Size = UDim2.fromOffset(sz, sz),
			AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromOffset(SLOT_W / 2 + math.random(-14, 14), 46), ZIndex = 12, Rotation = math.random(-20, 20) }, slot.frame)
		Sim.corner(b, 3)
		Sim.stroke(b, 2, RGB(20, 20, 24))
		local dot = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.25, BorderSizePixel = 0, Size = UDim2.fromScale(0.42, 0.42),
			AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), ZIndex = 13 }, b)
		Sim.corner(dot, 99)
		local delay = (i - 1) * 0.06
		local dx = math.random(-46, 46)
		local rise = math.random(70, 130)
		task.delay(delay, function()
			if not b.Parent then return end
			-- up with a little wobble, slows near the top, then shrinks away
			tween(b, 0.9, { Position = b.Position + UDim2.fromOffset(dx, -rise), Rotation = b.Rotation + math.random(-90, 90) }, Enum.EasingStyle.Quint)
			task.delay(0.55, function()
				if b.Parent then tween(b, 0.4, { Size = UDim2.fromOffset(0, 0), BackgroundTransparency = 1 }, Enum.EasingStyle.Back, Enum.EasingDirection.In) end
			end)
			task.delay(1, function() b:Destroy() end)
		end)
	end
end

-- drink: pop up, tip over like a drink, bubbles, then settle back with a bounce
local function drinkFx(slot)
	local spec = PotionConfig.get(slot.id)
	slot.scale.Scale = 1.35
	tween(slot.scale, 0.55, { Scale = 1 }, Enum.EasingStyle.Back)
	slot.tilt = 1
	bubbles(slot, spec.liquid)
end

local function popFx(slot)
	slot.scale.Scale = 0.2
	tween(slot.scale, 0.5, { Scale = 1 }, Enum.EasingStyle.Back)
end

local function buildSlot(root, id: string, order: number)
	local spec = PotionConfig.get(id)
	local frame = new("Frame", { Name = id, BackgroundTransparency = 1, Size = UDim2.fromOffset(SLOT_W, SLOT_H), LayoutOrder = order, Visible = false }, root)
	local scale = new("UIScale", {}, frame)
	local stage = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(SLOT_W, 84), Position = UDim2.fromOffset(0, 0) }, frame)
	local vp, model = Sim.model(stage, { kind = "Potion", id = id, size = UDim2.fromScale(1.18, 1.18), position = UDim2.fromScale(0.5, 0.5),
		yaw = math.rad(-24), pitch = math.rad(14), zoom = 0.82, zindex = 6 })
	local mult = Sim.text(frame, "x" .. spec.mult, { Size = UDim2.fromOffset(46, 26), Position = UDim2.fromOffset(18, 12), Max = 24, Stroke = 3.5, ZIndex = 9,
		Gradient = { Color3.new(1, 1, 1), spec.liquid } })
	mult.Rotation = -10
	local label = Sim.text(frame, "", { Size = UDim2.fromOffset(SLOT_W + 10, 24), Position = UDim2.fromOffset(SLOT_W / 2, 94), Max = 22, Stroke = 3, ZIndex = 9 })
	local hint = Sim.text(frame, "TAP AGAIN", { Size = UDim2.fromOffset(96, 18), Position = UDim2.fromOffset(SLOT_W / 2, -6), Max = 16, Stroke = 2.5, ZIndex = 10,
		Gradient = { RGB(255, 250, 200), RGB(255, 196, 40) } })
	hint.Visible = false
	local btn = new("TextButton", { BackgroundTransparency = 1, Text = "", Size = UDim2.fromScale(1, 1), ZIndex = 11, AutoButtonColor = false }, frame)
	local slot = { id = id, frame = frame, scale = scale, vp = vp, model = model, label = label, hint = hint, armed = 0, tilt = 0, t = math.random() * 5,
		rest = model and model:GetPivot() }
	btn.Activated:Connect(function()
		local inv = values()
		if (inv[id] or 0) <= 0 then return end
		if os.clock() - slot.armed < 2.2 then
			slot.armed = 0
			hint.Visible = false
			Net.event("UsePotion"):FireServer(id)
		else
			slot.armed = os.clock()
			hint.Visible = true
			slot.scale.Scale = 1.12
			tween(slot.scale, 0.3, { Scale = 1 }, Enum.EasingStyle.Back)
		end
	end)
	slots[id] = slot
	return slot
end

local function refresh()
	local inv, active = values()
	stamp = os.clock()
	for id, slot in slots do
		local n, on = inv[id] or 0, (active[id] or 0) > 0
		local was = slot.frame.Visible
		slot.frame.Visible = n > 0 or on
		-- reactions: drank (active went up) / got a new one (count went up)
		if (active[id] or 0) > (lastActive[id] or 0) + 5 then
			drinkFx(slot)
		elseif n > (lastInv[id] or 0) and slot.frame.Visible then
			popFx(slot)
		elseif slot.frame.Visible and not was then
			popFx(slot)
		end
	end
	lastInv = table.clone(inv)
	lastActive = table.clone(active)
end

function Potions.mount(gui: ScreenGui)
	local root = Sim.root(gui, "Potions", Vector2.new(3 * SLOT_W + 16, SLOT_H + 34), UDim2.new(1, -6, 1, -2), Vector2.new(1, 1))
	local row = new("Frame", { Name = "Row", BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, SLOT_H), Position = UDim2.new(0, 0, 1, -SLOT_H) }, root)
	new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Right,
		VerticalAlignment = Enum.VerticalAlignment.Bottom, SortOrder = Enum.SortOrder.LayoutOrder, Padding = UDim.new(0, 4) }, row)
	for i, id in PotionConfig.Order do buildSlot(row, id, i) end
	luckPill = Sim.text(root, "", { Size = UDim2.fromOffset(200, 28), Position = UDim2.new(1, -100, 0, 14), Max = 24, Stroke = 3.5, ZIndex = 9, Rich = true,
		Gradient = { RGB(210, 255, 170), RGB(70, 214, 92) } })
	luckPill.Visible = false
	local pillScale = new("UIScale", {}, luckPill)

	Data.Changed:Connect(function(key)
		if key == "potions" or key == "*" then refresh() end
	end)
	local function luck()
		local m = player:GetAttribute("LuckMult") or 1
		luckPill.Visible = m > 1.001
		luckPill.Text = ("LUCK x%s"):format(Format.short(m))
		pillScale.Scale = 1.3
		tween(pillScale, 0.45, { Scale = 1 }, Enum.EasingStyle.Back)
	end
	player:GetAttributeChangedSignal("LuckMult"):Connect(luck)
	luck()
	refresh()

	local acc = 0
	RunService.RenderStepped:Connect(function(dt)
		acc += dt
		local now = os.clock()
		for id, slot in slots do
			if not slot.frame.Visible then continue end
			local left = leftOf(id)
			local inv = values()
			local n = inv[id] or 0
			-- 3D bottle: active = slow turn + sway; drinking = tip over then back
			slot.t += dt
			slot.tilt = math.max(0, slot.tilt - dt * 1.4)
			if slot.model and slot.rest then
				local k = slot.tilt
				local drink = math.sin(math.min(1, (1 - k) * 1.6) * math.pi) * (if k > 0 then 1 else 0)
				local yaw = if left > 0 then slot.t * 0.9 else math.sin(slot.t * 0.8) * 0.12
				local sway = if left > 0 then math.sin(slot.t * 2.2) * 0.08 else 0
				slot.model:PivotTo(CFrame.Angles(0, yaw, 0) * CFrame.Angles(0, 0, sway - drink * 0.75) * slot.rest)
			end
			if os.clock() - slot.armed > 2.2 then slot.hint.Visible = false end
			if acc >= 0.1 then
				if left > 0 then
					slot.label.Text = Format.time(left) .. (if n > 0 then (" +%d"):format(n) else "")
					slot.label.TextColor3 = if left < 30 then RGB(255, 120, 110) else Color3.new(1, 1, 1)
					slot.frame.Visible = true
					slot.vp.ImageTransparency = if left < 30 and math.floor(now * 3) % 2 == 0 then 0.45 else 0
				else
					slot.label.Text = "x" .. n
					slot.label.TextColor3 = RGB(225, 230, 240)
					slot.vp.ImageTransparency = 0.12
					if n <= 0 then slot.frame.Visible = false end
				end
			end
		end
		if acc >= 0.1 then acc = 0 end
	end)
end

return Potions
