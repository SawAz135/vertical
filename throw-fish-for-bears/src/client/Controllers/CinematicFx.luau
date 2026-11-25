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

-- CINEMATIC MODE: every other interface disappears (HUD, menus, notifications, Roblox
-- chat / leaderboard / backpack, mobile joystick + jump) and comes back afterwards.
-- The cinematic's own screens stay (letterbox, skip, reveal stages, bear unlocked).
local KEEP_GUI = { TFBCinematic = true, TFBReveal = true, TFBRevealStages = true, TFBRevealCounters = true, BearUnlock = true, TFBEyelids = true }
local hudHidden = false
local hiddenGuis = {}
local hudConn = nil
function Cine.hideHud(on: boolean)
	if on == hudHidden then return end
	hudHidden = on
	local pg = player:FindFirstChild("PlayerGui")
	local StarterGui = game:GetService("StarterGui")
	local GuiService = game:GetService("GuiService")
	local function hide(g: Instance)
		if g:IsA("ScreenGui") and g.Enabled and not KEEP_GUI[g.Name] and not g.Name:find("^TFBCine") then
			hiddenGuis[g] = true
			g.Enabled = false
		end
	end
	if on then
		if pg then
			for _, g in pg:GetChildren() do hide(g) end
			-- anything opened during the cinematic (a notification...) stays hidden too
			hudConn = pg.ChildAdded:Connect(function(g)
				task.defer(function()
					if hudHidden and g.Parent then hide(g) end
				end)
			end)
		end
		pcall(function() StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.All, false) end)
		pcall(function() GuiService.TouchControlsEnabled = false end)
	else
		if hudConn then
			hudConn:Disconnect()
			hudConn = nil
		end
		for g in hiddenGuis do
			if g.Parent then g.Enabled = true end
		end
		hiddenGuis = {}
		pcall(function() StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.All, true) end)
		pcall(function() GuiService.TouchControlsEnabled = true end)
	end
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
	if true then return end -- light effects disabled
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
	Fx.blocks(pos + Vector3.new(0, 1, 0), color, 26, 24 * s, 0.45, { life = 1, up = 0.6, spread = 3, gravity = 30 })
end

-- full screen white (or coloured) impact frame
function Cine.flash(strength: number?, color: Color3?)
	-- disabled: no more full-screen light flashes
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

-- COMPACT zone banner for the throw flight: a small pill at the top centre, sized for the
-- screen (phones get a smaller one) and ONLY ONE at a time: a new zone replaces the previous
-- banner at once, so banners never pile up or overlap during a long throw.
local zoneBannerHolder: Frame? = nil
function Cine.zoneBanner(text: string, color: Color3?)
	ensure()
	if zoneBannerHolder then
		zoneBannerHolder:Destroy()
		zoneBannerHolder = nil
	end
	local cam = workspace.CurrentCamera
	local vp = if cam then cam.ViewportSize else Vector2.new(1280, 720)
	local k = math.clamp(math.min(vp.X / 1280, vp.Y / 720) * 1.15, 0.7, 1) -- phones ~0.7
	local h = math.floor(40 * k)
	local w = math.floor((#text * 12 + 28) * k)
	local holder = Instance.new("Frame")
	holder.Name = "ZoneBanner"
	holder.AnchorPoint = Vector2.new(0.5, 0)
	holder.BackgroundColor3 = color or RGB(255, 200, 40)
	holder.BorderSizePixel = 0
	holder.Size = UDim2.fromOffset(w, h)
	holder.Position = UDim2.new(0.5, 0, 0.14, -h)
	holder.ZIndex = 15
	holder.Parent = gui
	zoneBannerHolder = holder
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0.3, 0)
	corner.Parent = holder
	local st = Instance.new("UIStroke")
	st.Thickness = math.max(2, math.floor(3 * k))
	st.Color = RGB(255, 255, 255)
	st.Parent = holder
	local g = Instance.new("UIGradient")
	g.Color = ColorSequence.new(Color3.new(1, 1, 1), Color3.new(0.7, 0.7, 0.7))
	g.Rotation = 90
	g.Parent = holder
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Size = UDim2.new(1, -8, 0.8, 0)
	label.Position = UDim2.fromScale(0, 0.1)
	label.Font = Enum.Font.FredokaOne
	label.TextScaled = true
	label.Text = text
	label.TextColor3 = Color3.new(1, 1, 1)
	label.ZIndex = 16
	label.Parent = holder
	local ts = Instance.new("UIStroke")
	ts.Thickness = math.max(2, math.floor(3 * k))
	ts.Parent = label
	tween(holder, 0.25, { Position = UDim2.new(0.5, 0, 0.14, 0) }, Enum.EasingStyle.Back)
	task.delay(1.1, function()
		if zoneBannerHolder ~= holder then return end
		tween(holder, 0.2, { Position = UDim2.new(0.5, 0, 0.14, -h) }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
		task.wait(0.22)
		if zoneBannerHolder == holder then zoneBannerHolder = nil end
		holder:Destroy()
	end)
end

------------------------------------------------------------------------------------------
-- FISH POV: eyelids that blink (faster with stress), red stress edges, blur
------------------------------------------------------------------------------------------
local lids
function Cine.eyelids(on: boolean)
	ensure()
	if on and not lids then
		lids = {}
		for _, top in { true, false } do
			-- wide rounded black shapes = curved eyelid edges
			local f = Instance.new("Frame")
			f.BackgroundColor3 = Color3.fromRGB(8, 4, 6)
			f.BorderSizePixel = 0
			f.Size = UDim2.new(1.6, 0, 0.6, 0)
			f.AnchorPoint = Vector2.new(0.5, if top then 1 else 0)
			f.Position = UDim2.fromScale(0.5, if top then 0 else 1)
			f.ZIndex = 12
			local c = Instance.new("UICorner")
			c.CornerRadius = UDim.new(0.5, 0)
			c.Parent = f
			f.Parent = gui
			lids[if top then "top" else "bot"] = f
		end
		lids.blur = Instance.new("BlurEffect")
		lids.blur.Size = 2
		lids.blur.Parent = workspace.CurrentCamera
	elseif not on and lids then
		for _, k in { "top", "bot" } do
			local f = lids[k]
			tween(f, 0.3, { Position = UDim2.fromScale(0.5, if k == "top" then 0 else 1) })
			task.delay(0.35, function() f:Destroy() end)
		end
		lids.blur:Destroy()
		lids = nil
		Cine.stress(0)
	end
end

-- openness 0 (shut) .. 1 (wide open)
function Cine.setLids(open: number)
	if not lids then return end
	local cover = (1 - math.clamp(open, 0, 1)) * 0.52 -- each lid covers up to half the screen (+ overlap)
	lids.top.Position = UDim2.fromScale(0.5, cover + 0.02)
	lids.bot.Position = UDim2.fromScale(0.5, 1 - cover - 0.02)
end

function Cine.setBlur(size: number)
	if lids and lids.blur then lids.blur.Size = size end
end

-- red edges for panic (0..1), set every frame by the POV
function Cine.stress(level: number)
	ensure()
	for _, f in vignette do
		f.BackgroundColor3 = Color3.fromRGB(200, 0, 20)
		f.BackgroundTransparency = 1 - math.clamp(level, 0, 1) * 0.55
	end
end

------------------------------------------------------------------------------------------
-- BLOCKBUSTER TOOLBOX: colour grading, lightning, facing shockwaves, light pillars, slams
------------------------------------------------------------------------------------------
local Lighting = game:GetService("Lighting")
local grade, bloom, blurFx

local function ensureGrade()
	if grade and grade.Parent then return end
	grade = Instance.new("ColorCorrectionEffect")
	grade.Name = "TFB_Grade"
	grade.Parent = Lighting
	bloom = Instance.new("BloomEffect")
	bloom.Name = "TFB_Bloom"
	bloom.Intensity = 0
	bloom.Size = 24
	bloom.Threshold = 1
	bloom.Parent = Lighting
	blurFx = Instance.new("BlurEffect")
	blurFx.Name = "TFB_GradeBlur"
	blurFx.Size = 0
	blurFx.Parent = Lighting
end

-- tween the screen look: { tint, saturation, contrast, brightness, bloom, blur }
function Cine.grade(o: any, t: number?)
	ensureGrade()
	t = t or 0.4
	local g = {}
	if o.tint then g.TintColor = o.tint end
	if o.saturation then g.Saturation = o.saturation end
	if o.contrast then g.Contrast = o.contrast end
	if o.brightness then g.Brightness = o.brightness end
	tween(grade, t, g)
	if o.blur then tween(blurFx, t, { Size = o.blur }) end
end

-- immediate (per-frame safe): no tween objects created
function Cine.gradeSet(o: any)
	ensureGrade()
	if o.tint then grade.TintColor = o.tint end
	if o.saturation then grade.Saturation = o.saturation end
	if o.contrast then grade.Contrast = o.contrast end
	if o.brightness then grade.Brightness = o.brightness end
	if o.blur then blurFx.Size = o.blur end
end

function Cine.gradeOff(t: number?)
	if not grade or not grade.Parent then return end
	t = t or 0.8
	local g0, b0, bl0 = grade, bloom, blurFx
	tween(g0, t, { TintColor = Color3.new(1, 1, 1), Saturation = 0, Contrast = 0, Brightness = 0 })
	tween(b0, t, { Intensity = 0, Threshold = 1 })
	tween(bl0, t, { Size = 0 })
	task.delay(t + 0.1, function()
		if grade == g0 then
			g0:Destroy() b0:Destroy() bl0:Destroy()
			grade, bloom, blurFx = nil, nil, nil
		end
	end)
end

local function fxPart(size: Vector3, cf: CFrame, color: Color3, shape: Enum.PartType?)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Material = Enum.Material.Neon
	p.Color = color
	p.Shape = shape or Enum.PartType.Block
	p.Size = size
	p.CFrame = cf
	p.Parent = Fx.folder
	return p
end

-- jagged lightning bolt between two points
function Cine.bolt(a: Vector3, b: Vector3, color: Color3, life: number?, width: number?, jag: number?)
	if true then return end -- light effects disabled
	life = life or 0.22
	width = (width or 0.35) * 0.45 -- thinner, softer lightning
	local segs = math.clamp(math.floor((b - a).Magnitude / 4), 3, 9)
	local jagged = jag or ((b - a).Magnitude / segs) * 0.45
	local pts = { a }
	for i = 1, segs - 1 do
		local p = a:Lerp(b, i / segs)
		pts[#pts + 1] = p + Vector3.new((math.random() - 0.5) * 2, (math.random() - 0.5) * 2, (math.random() - 0.5) * 2) * jagged
	end
	pts[#pts + 1] = b
	for i = 1, #pts - 1 do
		local p0, p1 = pts[i], pts[i + 1]
		local len = (p1 - p0).Magnitude
		if len > 0.05 then
			local part = fxPart(Vector3.new(width, width, len), CFrame.lookAt((p0 + p1) / 2, p1), color)
			part.Transparency = 0.6
			tween(part, life, { Transparency = 1, Size = Vector3.new(width * 0.2, width * 0.2, len) })
			task.delay(life + 0.05, function() part:Destroy() end)
		end
	end
end

-- a ring standing UP, facing `dir` (sonic boom / portal look)
function Cine.ringFacing(pos: Vector3, dir: Vector3, color: Color3, fromR: number, toR: number, life: number, thick: number?)
	if true then return end -- light effects disabled
	local th = thick or 0.4
	local base = CFrame.lookAt(pos, pos + dir) * CFrame.Angles(0, math.rad(90), 0)
	local p = fxPart(Vector3.new(th, fromR * 2, fromR * 2), base, color, Enum.PartType.Cylinder)
	p.Transparency = 0.15
	tween(p, life, { Size = Vector3.new(th * 0.3, toR * 2, toR * 2), Transparency = 1 })
	task.delay(life + 0.05, function() p:Destroy() end)
end

-- giant beam of light shooting into the sky
function Cine.pillar(pos: Vector3, color: Color3, height: number, radius: number, life: number)
	if true then return end -- light effects disabled
	local base = CFrame.new(pos + Vector3.new(0, height / 2, 0)) * CFrame.Angles(0, 0, math.rad(90))
	local p = fxPart(Vector3.new(height, radius * 0.4, radius * 0.4), base, color, Enum.PartType.Cylinder)
	p.Transparency = 0.1
	tween(p, life * 0.25, { Size = Vector3.new(height, radius * 2, radius * 2) }, Enum.EasingStyle.Back)
	task.delay(life * 0.35, function()
		tween(p, life * 0.65, { Size = Vector3.new(height, radius * 0.1, radius * 0.1), Transparency = 1 }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
	end)
	local l = Instance.new("PointLight")
	l.Color = color
	l.Range = 40
	l.Brightness = 8
	l.Parent = p
	tween(l, life, { Brightness = 0 })
	task.delay(life + 0.1, function() p:Destroy() end)
end

-- a crown of lightning bolts around a point
function Cine.crown(pos: Vector3, color: Color3, n: number, radius: number, height: number)
	if true then return end -- light effects disabled
	n = math.max(2, math.floor(n * 0.4)) -- fewer lightning bolts
	for i = 1, n do
		local ang = (i / n) * math.pi * 2 + math.random() * 0.4
		local a = pos + Vector3.new(math.cos(ang) * radius, 0.3, math.sin(ang) * radius)
		local b = pos + Vector3.new(math.cos(ang) * radius * 0.35, height * (0.7 + math.random() * 0.6), math.sin(ang) * radius * 0.35)
		task.delay(i * 0.015, function() Cine.bolt(a, b, color, 0.28, 0.45) end)
	end
end

-- big plain text slammed on the screen ("MAX POWER!!!", "432 STUDS!", rarity name)
function Cine.slam(text: string, color: Color3?, size: number?, dur: number?)
	ensure()
	local d = dur or 1.3
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.AnchorPoint = Vector2.new(0.5, 0.5)
	l.Position = UDim2.fromScale(0.5, 0.3)
	l.Size = UDim2.fromOffset(900, size or 90)
	l.Font = Enum.Font.GothamBlack
	l.Text = text
	l.TextSize = size or 90
	l.TextColor3 = color or Color3.new(1, 1, 1)
	l.TextStrokeTransparency = 0
	l.ZIndex = 15
	l.Rotation = (math.random() - 0.5) * 8
	l.Parent = gui
	local sc = Instance.new("UIScale")
	sc.Scale = 3.2
	sc.Parent = l
	local st = Instance.new("UIStroke")
	st.Thickness = 5
	st.Color = Color3.fromRGB(10, 8, 20)
	st.Parent = l
	tween(sc, 0.22, { Scale = 1 }, Enum.EasingStyle.Back)
	task.delay(d, function()
		tween(sc, 0.3, { Scale = 1.4 }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
		tween(l, 0.3, { TextTransparency = 1, TextStrokeTransparency = 1 })
		tween(st, 0.3, { Transparency = 1 })
		task.delay(0.35, function() l:Destroy() end)
	end)
end

-- two glowing eyes (the unseen bear watching from the dark)
function Cine.eyes(pos: Vector3, right: Vector3, scale: number, color: Color3?)
	local col = color or Color3.fromRGB(255, 40, 30)
	local list = {}
	for _, sgn in { -1, 1 } do
		local p = fxPart(Vector3.new(0.7, 0.45, 0.7) * scale, CFrame.new(pos + right * sgn * 0.7 * scale), col, Enum.PartType.Ball)
		local l = Instance.new("PointLight")
		l.Color = col
		l.Range = 12 * scale
		l.Brightness = 3
		l.Parent = p
		list[#list + 1] = p
	end
	local obj = { alive = true }
	task.spawn(function()
		while obj.alive do
			task.wait(0.9 + math.random())
			if not obj.alive then break end
			for _, p in list do p.Transparency = 1 end
			task.wait(0.12)
			for _, p in list do p.Transparency = 0 end
		end
	end)
	function obj.destroy()
		obj.alive = false
		for _, p in list do
			tween(p, 0.3, { Transparency = 1 })
			task.delay(0.35, function() p:Destroy() end)
		end
	end
	return obj
end

-- a dark disc on the ground that follows something unseen (the shadow of the bear)
function Cine.shadow()
	local p = fxPart(Vector3.new(0.1, 1, 1), CFrame.new(0, -100, 0) * CFrame.Angles(0, 0, math.rad(90)), Color3.new(0, 0, 0), Enum.PartType.Cylinder)
	p.Material = Enum.Material.SmoothPlastic
	p.Transparency = 1
	local obj = {}
	function obj.set(pos: Vector3, radius: number, alpha: number)
		p.Size = Vector3.new(0.1, radius * 2, radius * 2)
		p.CFrame = CFrame.new(pos.X, 0.18, pos.Z) * CFrame.Angles(0, 0, math.rad(90))
		p.Transparency = 1 - math.clamp(alpha, 0, 0.75)
	end
	function obj.destroy()
		tween(p, 0.4, { Transparency = 1 })
		task.delay(0.45, function() p:Destroy() end)
	end
	return obj
end

------------------------------------------------------------------------------------------
-- FILM TOOLS (no glowing effects): depth of field, motion blur, dark vignette, skip button
------------------------------------------------------------------------------------------
local dofFx, motion
-- depth of field: focus distance (studs) + how much the rest is blurred (0 = off)
function Cine.dof(focus: number?, intensity: number?, radius: number?)
	if not intensity or intensity <= 0 then
		if dofFx then
			local d0 = dofFx
			dofFx = nil
			tween(d0, 0.4, { FarIntensity = 0, NearIntensity = 0 })
			task.delay(0.45, function() d0:Destroy() end)
		end
		return
	end
	if not dofFx then
		dofFx = Instance.new("DepthOfFieldEffect")
		dofFx.Name = "TFB_DOF"
		dofFx.InFocusRadius = 6
		dofFx.Parent = workspace.CurrentCamera
	end
	dofFx.FocusDistance = focus or 10
	dofFx.InFocusRadius = radius or 6
	dofFx.FarIntensity = intensity
	dofFx.NearIntensity = intensity * 0.6
end

-- motion blur kick (decays by itself)
local motionConn
function Cine.motion(size: number)
	if not motion then
		motion = Instance.new("BlurEffect")
		motion.Name = "TFB_Motion"
		motion.Size = 0
		motion.Parent = workspace.CurrentCamera
	end
	motion.Size = math.max(motion.Size, math.min(size * 0.45, 9))
	if not motionConn then
		motionConn = RunService.RenderStepped:Connect(function(dt)
			motion.Size = math.max(0, motion.Size - dt * 40)
			if motion.Size <= 0 then
				motionConn:Disconnect()
				motionConn = nil
			end
		end)
	end
end

-- dark film vignette (0..1), set every frame
function Cine.dark(level: number)
	ensure()
	for _, f in vignette do
		f.BackgroundColor3 = Color3.new(0, 0, 0)
		f.BackgroundTransparency = 1 - math.clamp(level, 0, 1) * 0.85
	end
end

-- "SKIP" button (bottom right) while a cinematic plays
local skipBtn
local skipFn = nil
-- skip from a key / gamepad button (returns true if a skip was possible)
function Cine.trySkip(): boolean
	if skipBtn and skipFn then
		skipFn()
		return true
	end
	return false
end
function Cine.skipButton(onSkip)
	ensure()
	if skipBtn then skipBtn:Destroy() skipBtn = nil end
	if not onSkip then return end
	local b = Instance.new("TextButton")
	b.Name = "Skip"
	b.AnchorPoint = Vector2.new(1, 1)
	b.Position = UDim2.new(1, -24, 0.89, -12)
	b.Size = UDim2.fromOffset(150, 48)
	b.BackgroundColor3 = Color3.fromRGB(20, 20, 24)
	b.BackgroundTransparency = 0.25
	b.Font = Enum.Font.FredokaOne
	b.TextColor3 = Color3.new(1, 1, 1)
	b.TextScaled = true
	b.Text = "SKIP  ▶▶"
	b.ZIndex = 30
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 10)
	corner.Parent = b
	local st = Instance.new("UIStroke")
	st.Thickness = 2.5
	st.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	st.Color = Color3.new(1, 1, 1)
	st.Transparency = 0.4
	st.Parent = b
	local pad = Instance.new("UIPadding")
	pad.PaddingTop = UDim.new(0.18, 0)
	pad.PaddingBottom = UDim.new(0.18, 0)
	pad.Parent = b
	b.Parent = gui
	b.Activated:Connect(function()
		b:Destroy()
		if skipBtn == b then skipBtn = nil end
		onSkip()
	end)
	skipBtn = b
	skipFn = function()
		if skipBtn ~= b then return end
		b:Destroy()
		skipBtn = nil
		onSkip()
	end
end

-- full black (eaten / cut to black)
local black
function Cine.blackout(on: boolean, fade: number?)
	ensure()
	if not black then
		black = Instance.new("Frame")
		black.BackgroundColor3 = Color3.new(0, 0, 0)
		black.BorderSizePixel = 0
		black.Size = UDim2.fromScale(1, 1)
		black.BackgroundTransparency = 1
		black.ZIndex = 18
		black.Parent = gui
	end
	tween(black, fade or 0.15, { BackgroundTransparency = if on then 0 else 1 })
end

function Cine.resetEaten()
	if black then black.BackgroundTransparency = 1 end
	Cine.dark(0)
end

-- clean every film effect (end of a cinematic / skip / failure)
--[[ CLEAR SHOT: the decor (bushes, trees, rocks, flowers...) that would block a cinematic
     camera is faded out LOCALLY (LocalTransparencyModifier: only this player sees it gone).
     pos / radius: everything around the subject; segEnd: also everything along the line from
     the subject to where the camera is (a capsule of `radius`). The corridor walls, the floor
     and the mountains are never touched. Cine.restoreClear() brings everything back. ]]
local cleared = {}
function Cine.clearAround(pos: Vector3, radius: number, segEnd: Vector3?, segRadius: number?)
	local map = workspace:FindFirstChild("Map")
	local decor = map and map:FindFirstChild("Decor")
	if not decor then return end
	local function distToSeg(p: Vector3): number
		if not segEnd then return math.huge end
		local a, b = Vector3.new(pos.X, 0, pos.Z), Vector3.new(segEnd.X, 0, segEnd.Z)
		local q = Vector3.new(p.X, 0, p.Z)
		local ab = b - a
		local t = math.clamp((q - a):Dot(ab) / math.max(ab:Dot(ab), 1e-6), 0, 1)
		return (a + ab * t - q).Magnitude
	end
	for _, p in decor:GetDescendants() do
		if p:IsA("BasePart") and cleared[p] == nil then
			local sz = p.Size
			local pp = p.Position
			-- only things standing in the corridor (not the walls, floor, mountains or wall-top trees)
			if sz.X < 30 and sz.Z < 30 and sz.Y < 40 and pp.Y < pos.Y + 22 and p.Name ~= "ZoneGround" and p.Name ~= "ZoneBlend"
				and not p:FindFirstAncestor("Backdrop") and not p:FindFirstAncestor("Cliff") then
				local flat = Vector3.new(pp.X - pos.X, 0, pp.Z - pos.Z).Magnitude
				if flat < radius or distToSeg(pp) < (segRadius or radius) then
					cleared[p] = p.LocalTransparencyModifier
					p.LocalTransparencyModifier = 1
				end
			end
		end
	end
end
function Cine.restoreClear()
	for p, v in cleared do
		if p.Parent then p.LocalTransparencyModifier = v end
	end
	cleared = {}
end

function Cine.resetAll()
	Cine.dof(nil, 0)
	Cine.skipButton(nil)
	if motion then motion.Size = 0 end
	Cine.speedLines(false)
	Cine.eyelids(false)
	Cine.stress(0)
	Cine.gradeOff(0.6)
end

return Cine
