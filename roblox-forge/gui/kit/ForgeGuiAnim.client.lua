--[[
	Roblox Forge - GUI runtime (client, StarterPlayerScripts).
	Brings the ScreenGuis made in Forge GUI Studio to life (any ScreenGui with the
	attribute ForgeGui = true). Everything is driven by attributes, so you can also
	use them on your own GUIs:
	  ForgeOpen   = "pop" | "zoom" | "slideUp" | "slideDown" | "slideLeft" | "slideRight" | "drop" | "spin"
	  ForgeWindow = true   -> a window: opening it closes the other windows
	  ForgeDur    = 0.45   -> open duration (s)
	  ForgeHover  = "grow" | "lift" | "glow"        ForgePress = "squish" | "bounce"
	  ForgeIdle   = "pulse" | "float" | "spin" | "wiggle" | "shine" | "rainbow"   (ForgePeriod = s)
	  ForgeAction = "toggle" (ForgeTarget = window name) | "close" | "switch" | "roll" (ForgeTarget, ForgeRollItems)
	  ForgeBind   = "Coins" (leaderstats value) with ForgeFormat = "🪙 {v}"
	Results for your scripts: button attribute ForgeOn (switch), ScreenGui attribute ForgeLastRoll (roll).
	The easing maths are the same as the studio preview.
]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- easing (Roblox styles, same formulas as the studio)
local C1, C3, C4 = 1.70158, 2.70158, (2 * math.pi) / 3
local function bounceOut(x)
	local n, d = 7.5625, 2.75
	if x < 1 / d then return n * x * x end
	if x < 2 / d then x -= 1.5 / d; return n * x * x + 0.75 end
	if x < 2.5 / d then x -= 2.25 / d; return n * x * x + 0.9375 end
	x -= 2.625 / d
	return n * x * x + 0.984375
end
local IN = {
	Linear = function(x) return x end,
	Sine = function(x) return 1 - math.cos(x * math.pi / 2) end,
	Quad = function(x) return x * x end,
	Cubic = function(x) return x ^ 3 end,
	Quint = function(x) return x ^ 5 end,
	Back = function(x) return C3 * x ^ 3 - C1 * x * x end,
	Elastic = function(x)
		if x == 0 or x == 1 then return x end
		return -(2 ^ (10 * x - 10)) * math.sin((x * 10 - 10.75) * C4)
	end,
	Bounce = function(x) return 1 - bounceOut(1 - x) end,
}
local function ease(style, dir, x)
	x = math.clamp(x, 0, 1)
	local f = IN[style] or IN.Linear
	if dir == "In" then return f(x) end
	if dir == "Out" then return 1 - f(1 - x) end
	if x < 0.5 then return f(2 * x) / 2 end
	return 1 - f(2 - 2 * x) / 2
end

local OPEN = {
	pop = { S = 0, ease = { "Back", "Out" } }, zoom = { S = 1.35, ease = { "Quad", "Out" } },
	slideUp = { Y = 0.6, ease = { "Quint", "Out" } }, slideDown = { Y = -0.6, ease = { "Quint", "Out" } },
	slideLeft = { X = 0.6, ease = { "Quint", "Out" } }, slideRight = { X = -0.6, ease = { "Quint", "Out" } },
	drop = { Y = -0.8, ease = { "Bounce", "Out" } }, spin = { S = 0, R = -180, ease = { "Back", "Out" } },
}

local function idleAt(kind, t, period)
	local k = (t / period) % 1
	if kind == "pulse" then return { S = 1 + 0.06 * (0.5 - 0.5 * math.cos(k * math.pi * 2)) } end
	if kind == "float" then return { Yo = -6 * math.sin(k * math.pi * 2) } end
	if kind == "spin" then return { R = 360 * k } end
	if kind == "wiggle" then return { R = (k < 0.5) and 6 * math.sin(k * math.pi * 4) or 0 } end
	if kind == "shine" then return { G = (k < 0.6) and (-1 + 2 * k / 0.6) or 1 } end
	if kind == "rainbow" then return { GR = 360 * k } end
	return {}
end

local states = {} -- GuiObject -> state
local now = os.clock

local function tween(st, ch, value, dur, style, dir)
	st.tw[ch] = { from = st.v[ch], to = value, t0 = now(), dur = math.max(0.001, dur), style = style, dir = dir }
end

local function stateOf(obj)
	local st = states[obj]
	if st then return st end
	local scale = obj:FindFirstChild("ForgeScale")
	if not scale then
		scale = obj:FindFirstChildWhichIsA("UIScale")
		if not scale then
			scale = Instance.new("UIScale")
			scale.Name = "ForgeScale"
			scale.Parent = obj
		end
	end
	local stroke = obj:FindFirstChildWhichIsA("UIStroke")
	local gradient = obj:FindFirstChildWhichIsA("UIGradient")
	st = {
		obj = obj, scale = scale, baseScale = scale.Scale, basePos = obj.Position, baseRot = obj.Rotation,
		stroke = stroke, baseThick = stroke and stroke.Thickness or 0,
		gradient = gradient, baseOffset = gradient and gradient.Offset or Vector2.zero, baseGradRot = gradient and gradient.Rotation or 0,
		v = { S_open = 1, S_hover = 1, S_press = 1, X_open = 0, Y_open = 0, R_open = 0, Yo_hover = 0, G_hover = 0 },
		tw = {}, idle = obj:GetAttribute("ForgeIdle"), period = obj:GetAttribute("ForgePeriod") or 1.6,
	}
	states[obj] = st
	return st
end

local function apply(st, t)
	local busy = false
	for ch, tw in st.tw do
		local x = (t - tw.t0) / tw.dur
		st.v[ch] = tw.from + (tw.to - tw.from) * ease(tw.style, tw.dir, x)
		if x >= 1 then
			st.v[ch] = tw.to
			st.tw[ch] = nil
		else
			busy = true
		end
	end
	if not busy and not st.idle and not st.dirty then return end
	st.dirty = busy
	local v, i = st.v, st.idle and idleAt(st.idle, t, st.period) or {}
	st.scale.Scale = st.baseScale * v.S_open * v.S_hover * v.S_press * (i.S or 1)
	st.obj.Position = st.basePos + UDim2.new(v.X_open, 0, v.Y_open, v.Yo_hover + (i.Yo or 0))
	st.obj.Rotation = st.baseRot + v.R_open + (i.R or 0)
	if st.stroke then st.stroke.Thickness = st.baseThick * (1 + v.G_hover) end
	if st.gradient then
		st.gradient.Offset = Vector2.new(i.G or st.baseOffset.X, st.baseOffset.Y)
		st.gradient.Rotation = st.baseGradRot + (i.GR or 0)
	end
end

-- windows ----------------------------------------------------------------
local function openWindow(win)
	local st = stateOf(win)
	local kind = OPEN[win:GetAttribute("ForgeOpen") or ""]
	st.closing = nil
	if kind then
		local dur = win:GetAttribute("ForgeDur") or 0.45
		if kind.S then st.v.S_open = kind.S end
		if kind.X then st.v.X_open = kind.X end
		if kind.Y then st.v.Y_open = kind.Y end
		if kind.R then st.v.R_open = kind.R end
		local s, d = kind.ease[1], kind.ease[2]
		tween(st, "S_open", 1, dur, s, d); tween(st, "X_open", 0, dur, s, d)
		tween(st, "Y_open", 0, dur, s, d); tween(st, "R_open", 0, dur, s, d)
		st.dirty = true
	end
	st.openT = now() -- Visible changes can be deferred: ignore our own change below
	win.Visible = true
end

local function closeWindow(win)
	local st = stateOf(win)
	if not win.Visible or st.closing then return end
	local kind = OPEN[win:GetAttribute("ForgeOpen") or ""]
	if not kind then win.Visible = false return end
	local d = (win:GetAttribute("ForgeDur") or 0.45) * 0.6
	local token = {}
	st.closing = token
	if kind.S then tween(st, "S_open", kind.S, d, kind.ease[1] == "Bounce" and "Quad" or kind.ease[1], "In") end
	if kind.X then tween(st, "X_open", kind.X, d, "Quint", "In") end
	if kind.Y then tween(st, "Y_open", kind.Y, d, "Quint", "In") end
	if kind.R then tween(st, "R_open", kind.R, d, "Quad", "In") end
	st.dirty = true
	task.delay(d, function()
		if st.closing == token then
			st.closing = nil
			win.Visible = false
		end
	end)
end

local function windowOf(obj, gui)
	local p = obj.Parent
	while p and p ~= gui do
		if p:IsA("GuiObject") and (p:GetAttribute("ForgeWindow") or p:GetAttribute("ForgeOpen")) then return p end
		p = p.Parent
	end
	return nil
end

-- behaviours -------------------------------------------------------------
local function abbreviate(n)
	local units = { { 1e12, "T" }, { 1e9, "B" }, { 1e6, "M" }, { 1e3, "K" } }
	for _, u in units do
		if math.abs(n) >= u[1] then
			local x = n / u[1]
			local s = string.format(x >= 100 and "%.0f" or "%.1f", x)
			return (string.gsub(s, "%.0$", "")) .. u[2]
		end
	end
	return tostring(math.floor(n))
end

local function bind(label)
	local name, fmt = label:GetAttribute("ForgeBind"), label:GetAttribute("ForgeFormat") or "{v}"
	task.spawn(function()
		local stats = player:WaitForChild("leaderstats", 30)
		local value = stats and stats:WaitForChild(name, 30)
		if not value then return end
		local shown = tonumber(value.Value) or 0
		local function render(x)
			label.Text = (string.gsub(fmt, "{v}", function() return abbreviate(x) end))
		end
		render(shown)
		value.Changed:Connect(function()
			local from, to, t0 = shown, tonumber(value.Value) or 0, now()
			shown = to
			while now() - t0 < 0.45 and shown == to do -- count up / down
				render(from + (to - from) * ease("Quad", "Out", (now() - t0) / 0.45))
				RunService.RenderStepped:Wait()
			end
			if shown == to then render(to) end
			local st = stateOf(label)
			st.v.S_press = 1.18
			tween(st, "S_press", 1, 0.5, "Elastic", "Out")
		end)
	end)
end

local function parseRoll(s)
	local items, total = {}, 0
	for entry in string.gmatch(s or "", "[^,]+") do
		local name, w, c = string.match(entry, "^%s*([^:]+):%s*([%d%.]+)%s*:?%s*(#?%x*)%s*$")
		if name then
			local ok, color = pcall(Color3.fromHex, c ~= "" and c or "#ffffff")
			table.insert(items, { name = name, w = tonumber(w) or 0, c = ok and color or Color3.new(1, 1, 1) })
			total += tonumber(w) or 0
		end
	end
	return items, total
end

local rng = Random.new()
local function roll(button, gui)
	if button:GetAttribute("ForgeRolling") then return end
	local root = windowOf(button, gui) or gui
	local target = root:FindFirstChild(button:GetAttribute("ForgeTarget") or "Result", true)
	local items, total = parseRoll(button:GetAttribute("ForgeRollItems"))
	if not target or #items == 0 or total <= 0 then return end
	local nameLabel = target.Parent and target.Parent:FindFirstChild(target.Name .. "Name")
	button:SetAttribute("ForgeRolling", true)
	-- the casino spin: names flash faster then slow down (ease out), then the real pick lands
	local t0, step, last = now(), 0, nil
	while now() - t0 < 2.2 do
		local k = (now() - t0) / 2.2
		local it = items[rng:NextInteger(1, #items)]
		if it ~= last then
			target.Text = it.name
			target.TextColor3 = it.c
			last = it
		end
		step += 1
		task.wait(0.04 + 0.28 * ease("Quad", "In", k))
	end
	local r, acc, pick = rng:NextNumber() * total, 0, items[#items]
	for _, it in items do
		acc += it.w
		if r < acc then pick = it break end
	end
	target.Text = pick.name
	target.TextColor3 = pick.c
	if nameLabel then nameLabel.Text = string.format("✨ %s · 1 chance sur %s", pick.name, abbreviate(math.max(1, math.floor(total / math.max(pick.w, 1e-9) + 0.5)))) end
	local st = stateOf(target)
	st.v.S_open = 0.35
	tween(st, "S_open", 1, 0.8, "Elastic", "Out")
	if pick.w / total < 0.05 then -- rare: a shake on top
		st.v.R_open = -18
		tween(st, "R_open", 0, 0.9, "Elastic", "Out")
	end
	st.dirty = true
	gui:SetAttribute("ForgeLastRoll", pick.name)
	button:SetAttribute("ForgeRolling", nil)
end

local ON, OFF = Color3.fromHex("#3dffa8"), Color3.fromHex("#ff4d6d")
local function switch(button)
	local on = button:GetAttribute("ForgeOn")
	if on == nil then on = button.Text ~= "OFF" end
	if button:GetAttribute("ForgeOnColor") == nil then
		button:SetAttribute("ForgeOnColor", on and button.BackgroundColor3:ToHex() or ON:ToHex())
		button:SetAttribute("ForgeOffColor", on and OFF:ToHex() or button.BackgroundColor3:ToHex())
	end
	on = not on
	button:SetAttribute("ForgeOn", on)
	button.Text = on and "ON" or "OFF"
	button.BackgroundColor3 = Color3.fromHex(button:GetAttribute(on and "ForgeOnColor" or "ForgeOffColor"))
end

local function hookObject(obj, gui)
	if not obj:IsA("GuiObject") then return end
	local a = obj:GetAttributes()
	if a.ForgeIdle or a.ForgeOpen or a.ForgeHover or a.ForgePress then stateOf(obj) end
	if a.ForgeOpen then
		obj:GetPropertyChangedSignal("Visible"):Connect(function()
			local st = stateOf(obj)
			if obj.Visible and not st.closing and now() - (st.openT or 0) > 0.1 then openWindow(obj) end
		end)
		if obj.Visible then openWindow(obj) end
	end
	if a.ForgeHover then
		local st = stateOf(obj)
		obj.MouseEnter:Connect(function()
			if a.ForgeHover == "grow" then tween(st, "S_hover", 1.07, 0.15, "Quad", "Out")
			elseif a.ForgeHover == "lift" then tween(st, "Yo_hover", -4, 0.15, "Quad", "Out")
			elseif a.ForgeHover == "glow" then tween(st, "G_hover", 1, 0.2, "Quad", "Out") end
			st.dirty = true
		end)
		obj.MouseLeave:Connect(function()
			tween(st, "S_hover", 1, 0.2, "Quad", "Out"); tween(st, "Yo_hover", 0, 0.2, "Quad", "Out"); tween(st, "G_hover", 0, 0.25, "Quad", "Out")
			st.dirty = true
		end)
	end
	if a.ForgePress then
		local st = stateOf(obj)
		obj.InputBegan:Connect(function(input)
			if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
				if a.ForgePress == "squish" then tween(st, "S_press", 0.9, 0.08, "Quad", "Out")
				else st.v.S_press = 0.85; tween(st, "S_press", 1, 0.6, "Elastic", "Out") end
				st.dirty = true
			end
		end)
		obj.InputEnded:Connect(function(input)
			if a.ForgePress == "squish" and (input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch) then
				tween(st, "S_press", 1, 0.35, "Back", "Out")
				st.dirty = true
			end
		end)
	end
	if a.ForgeBind and obj:IsA("TextLabel") then bind(obj) end
	if a.ForgeAction and obj:IsA("GuiButton") then
		obj.Activated:Connect(function()
			local action = obj:GetAttribute("ForgeAction")
			if action == "toggle" then
				local win = gui:FindFirstChild(obj:GetAttribute("ForgeTarget") or "", true)
				if not win or not win:IsA("GuiObject") then
					warn("[Forge] no window named " .. tostring(obj:GetAttribute("ForgeTarget")))
					return
				end
				if win.Visible and not stateOf(win).closing then
					closeWindow(win)
				else
					if win:GetAttribute("ForgeWindow") then
						for _, other in gui:GetDescendants() do
							if other ~= win and other:IsA("GuiObject") and other:GetAttribute("ForgeWindow") and other.Visible then closeWindow(other) end
						end
					end
					openWindow(win)
				end
			elseif action == "close" then
				local win = windowOf(obj, gui)
				if win then closeWindow(win) end
			elseif action == "switch" then
				switch(obj)
			elseif action == "roll" then
				task.spawn(roll, obj, gui)
			end
		end)
	end
end

local function setup(gui)
	if not gui:IsA("ScreenGui") or not gui:GetAttribute("ForgeGui") then return end
	for _, d in gui:GetDescendants() do hookObject(d, gui) end
	gui.DescendantAdded:Connect(function(d) hookObject(d, gui) end)
end

for _, g in playerGui:GetChildren() do task.spawn(setup, g) end
playerGui.ChildAdded:Connect(setup)

RunService.RenderStepped:Connect(function()
	local t = now()
	for obj, st in states do
		if not obj.Parent then
			states[obj] = nil
		elseif obj.Visible or st.closing then
			apply(st, t)
		end
	end
end)
