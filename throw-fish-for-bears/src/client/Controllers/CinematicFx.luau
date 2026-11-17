--[[ CinematicFx: the "movie" layer of the bear sequence (local player only).
     - letterbox: black cinema bars slide in / out
     - pop(part, text): stud-style comic bubble above a part ("!", "NOM!", "♥")
     - hearts(pos): little block hearts floating up
     - shockwave(pos, color): expanding ring + flash ring on the ground
     - speedLines(on): white streaks on the screen edges while the bear charges
     - rarityTint(color): coloured vignette pulse for rare bears ]]
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")
local Fx = require(script.Parent.Fx)

local Cine = {}
local player = Players.LocalPlayer
local RGB = Color3.fromRGB
local gui, topBar, botBar, vignette, lines

local function tween(o, t, goal, style, dir)
	local tw = TweenService:Create(o, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), goal)
	tw:Play()
	return tw
end

local function ensure()
	if gui then return end
	gui = Instance.new("ScreenGui")
	gui.Name = "TFBCinematic"
	gui.ResetOnSpawn = false
	gui.IgnoreGuiInset = true
	gui.ScreenInsets = Enum.ScreenInsets.None
	gui.DisplayOrder = 4
	gui.Parent = player:WaitForChild("PlayerGui")
	local function bar(top: boolean)
		local f = Instance.new("Frame")
		f.BackgroundColor3 = Color3.new(0, 0, 0)
		f.BorderSizePixel = 0
		f.Size = UDim2.new(1, 0, 0.11, 0)
		f.AnchorPoint = Vector2.new(0, if top then 1 else 0)
		f.Position = UDim2.fromScale(0, if top then 0 else 1)
		f.ZIndex = 10
		f.Parent = gui
		return f
	end
	topBar = bar(true)
	botBar = bar(false)
	-- edge glow: 4 gradient strips around the screen (tweened together)
	vignette = {}
	for _, e in { { 0, 0, 1, 0.22, 90 }, { 0, 0.78, 1, 0.22, -90 }, { 0, 0, 0.16, 1, 0 }, { 0.84, 0, 0.16, 1, 180 } } do
		local f = Instance.new("Frame")
		f.BorderSizePixel = 0
		f.BackgroundColor3 = Color3.new(1, 1, 1)
		f.BackgroundTransparency = 1
		f.Position = UDim2.fromScale(e[1], e[2])
		f.Size = UDim2.fromScale(e[3], e[4])
		f.ZIndex = 9
		local g = Instance.new("UIGradient")
		g.Rotation = e[5]
		g.Transparency = NumberSequence.new(0, 1)
		g.Parent = f
		f.Parent = gui
		table.insert(vignette, f)
	end
	lines = Instance.new("Frame")
	lines.BackgroundTransparency = 1
	lines.Size = UDim2.fromScale(1, 1)
	lines.Visible = false
	lines.Parent = gui
	for i = 1, 14 do
		local l = Instance.new("Frame")
		l.BackgroundColor3 = Color3.new(1, 1, 1)
		l.BorderSizePixel = 0
		l.BackgroundTransparency = 0.6
		l.AnchorPoint = Vector2.new(0.5, 0.5)
		l.ZIndex = 8
		l:SetAttribute("Seed", i)
		l.Parent = lines
	end
end

function Cine.letterbox(on: boolean)
	ensure()
	tween(topBar, 0.45, { Position = UDim2.fromScale(0, if on then 0.11 else 0) }, Enum.EasingStyle.Quint)
	tween(botBar, 0.45, { Position = UDim2.fromScale(0, if on then 0.89 else 1) }, Enum.EasingStyle.Quint)
	if not on then
		Cine.speedLines(false)
		for _, f in vignette do tween(f, 0.4, { BackgroundTransparency = 1 }) end
	end
end

-- coloured edge glow for rare bears (pulses a few times)
function Cine.rarityTint(color: Color3, strength: number?)
	ensure()
	local k = strength or 0.55
	local function set(tr, t)
		for _, f in vignette do
			f.BackgroundColor3 = color
			tween(f, t, { BackgroundTransparency = tr })
		end
	end
	task.spawn(function()
		for _ = 1, 3 do
			set(1 - k, 0.35)
			task.wait(0.4)
			set(1 - k * 0.35, 0.5)
			task.wait(0.55)
		end
		set(1, 0.8)
	end)
end

-- white streaks converging to the centre (bear charging)
local linesConn
function Cine.speedLines(on: boolean)
	ensure()
	lines.Visible = on
	if linesConn then linesConn:Disconnect() linesConn = nil end
	if not on then return end
	local rand = Random.new()
	local state = {}
	for _, l in lines:GetChildren() do
		state[l] = { a = rand:NextNumber() * math.pi * 2, r = rand:NextNumber(), len = 0.08 + rand:NextNumber() * 0.12 }
	end
	linesConn = RunService.RenderStepped:Connect(function(dt)
		for l, s in state do
			s.r -= dt * 2.6
			if s.r < 0.45 then
				s.r = 1.05
				s.a = rand:NextNumber() * math.pi * 2
				s.len = 0.08 + rand:NextNumber() * 0.12
			end
			local x, y = 0.5 + math.cos(s.a) * s.r * 0.62, 0.5 + math.sin(s.a) * s.r * 0.62
			l.Position = UDim2.fromScale(x, y)
			l.Size = UDim2.new(s.len, 0, 0, 3)
			l.Rotation = math.deg(s.a)
			l.BackgroundTransparency = 0.35 + (1.05 - s.r) * 0.9
		end
	end)
end

-- comic bubble above a part, stud GUI style
function Cine.pop(adornee: BasePart?, text: string, color: Color3?, size: number?, dur: number?)
	if not adornee or not adornee.Parent then return end
	local bb = Instance.new("BillboardGui")
	bb.Adornee = adornee
	bb.Size = UDim2.fromOffset(size or 120, size or 120)
	bb.StudsOffsetWorldSpace = Vector3.new(0, 2.5, 0)
	bb.AlwaysOnTop = true
	bb.LightInfluence = 0
	bb.Parent = player:WaitForChild("PlayerGui")
	local t = Instance.new("TextLabel")
	t.BackgroundTransparency = 1
	t.Size = UDim2.fromScale(1, 1)
	t.Font = Enum.Font.FredokaOne
	t.TextScaled = true
	t.Text = text
	t.TextColor3 = color or RGB(255, 230, 60)
	t.Parent = bb
	local st = Instance.new("UIStroke")
	st.Thickness = 4
	st.Parent = t
	local sc = Instance.new("UIScale")
	sc.Scale = 0
	sc.Parent = t
	tween(sc, 0.25, { Scale = 1 }, Enum.EasingStyle.Back)
	t.Rotation = math.random(-14, 14)
	tween(bb, dur or 0.9, { StudsOffsetWorldSpace = Vector3.new(math.random(-10, 10) / 10, 4.5, 0) })
	task.delay((dur or 0.9) - 0.25, function()
		tween(t, 0.25, { TextTransparency = 1 })
		tween(st, 0.25, { Transparency = 1 })
		task.wait(0.27)
		bb:Destroy()
	end)
end

-- little red block hearts floating up
function Cine.hearts(pos: Vector3, n: number?)
	for i = 1, n or 6 do
		task.delay(i * 0.08, function()
			local p = pos + Vector3.new(math.random(-20, 20) / 10, math.random(0, 10) / 10, math.random(-20, 20) / 10)
			-- two blocks + one = heart silhouette
			Fx.blocks(p, RGB(255, 70, 110), 1, 3, 0.45, { life = 1.4, up = 4, spread = 0.4, gravity = -3 })
			Fx.blocks(p + Vector3.new(0.35, 0, 0), RGB(255, 110, 150), 1, 3, 0.4, { life = 1.3, up = 4, spread = 0.4, gravity = -3 })
		end)
	end
end

-- ground shockwave: expanding rings + flash
function Cine.shockwave(pos: Vector3, color: Color3, scale: number?)
	local s = scale or 1
	Fx.ring(pos, color, 1 * s, 16 * s, 0.6)
	task.delay(0.1, function() Fx.ring(pos, Color3.new(1, 1, 1), 0.5 * s, 11 * s, 0.5) end)
	Fx.blocks(pos + Vector3.new(0, 1, 0), color, 26, 24 * s, 0.45, { life = 1, up = 0.6, spread = 3, gravity = 30 })
end

-- full screen white (or coloured) impact frame
function Cine.flash(strength: number?, color: Color3?)
	ensure()
	local f = Instance.new("Frame")
	f.BackgroundColor3 = color or Color3.new(1, 1, 1)
	f.BorderSizePixel = 0
	f.Size = UDim2.fromScale(1, 1)
	f.BackgroundTransparency = 1 - (strength or 0.8)
	f.ZIndex = 20
	f.Parent = gui
	tween(f, 0.35, { BackgroundTransparency = 1 })
	task.delay(0.4, function() f:Destroy() end)
end

-- big stud banner sliding across the screen ("ZONE 3 · MOUNTAIN LAKE")
function Cine.banner(text: string, color: Color3?, sub: string?)
	ensure()
	local holder = Instance.new("Frame")
	holder.BackgroundTransparency = 1
	holder.Size = UDim2.new(1, 0, 0, 90)
	holder.Position = UDim2.new(-1, 0, 0.2, 0)
	holder.ZIndex = 15
	holder.Parent = gui
	local band = Instance.new("Frame")
	band.BackgroundColor3 = color or RGB(255, 200, 40)
	band.BorderSizePixel = 0
	band.Size = UDim2.new(1, 0, 1, 0)
	band.Rotation = -2
	band.ZIndex = 15
	band.Parent = holder
	local st = Instance.new("UIStroke")
	st.Thickness = 4
	st.Parent = band
	local g = Instance.new("UIGradient")
	g.Color = ColorSequence.new(Color3.new(1, 1, 1), Color3.new(0.6, 0.6, 0.6))
	g.Rotation = 90
	g.Parent = band
	local t = Instance.new("TextLabel")
	t.BackgroundTransparency = 1
	t.Size = UDim2.new(1, 0, if sub then 0.62 else 0.9, 0)
	t.Position = UDim2.fromScale(0, 0.04)
	t.Font = Enum.Font.FredokaOne
	t.TextScaled = true
	t.Text = text
	t.TextColor3 = Color3.new(1, 1, 1)
	t.ZIndex = 16
	t.Parent = band
	local ts = Instance.new("UIStroke")
	ts.Thickness = 4
	ts.Parent = t
	if sub then
		local s2 = t:Clone()
		s2.Text = sub
		s2.Size = UDim2.new(1, 0, 0.32, 0)
		s2.Position = UDim2.fromScale(0, 0.64)
		s2.Parent = band
	end
	tween(holder, 0.35, { Position = UDim2.new(0, 0, 0.2, 0) }, Enum.EasingStyle.Back)
	task.delay(1.4, function()
		tween(holder, 0.3, { Position = UDim2.new(1, 0, 0.2, 0) }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
		task.wait(0.32)
		holder:Destroy()
	end)
end

return Cine
