--[[ CaptureController: the local player's "1 IN ?" reveal (the server decided everything:
     species, rarity, mutation, weight, the real odds; this script only PLAYS it).

     TRANSFORM (0.55 s) the landed fish hops, spins and turns BLACK; a white stud star bursts
                        open behind it; "1 IN ?" slams on screen
     SPIN      (5.2 s)  the black silhouette morphs from animal to animal (fast, then slower
                        and slower), growing from the size of the fish to the size of the
                        result; tremble + a heartbeat that speeds up
     HOLD      (0.9 s)  the last silhouette shakes harder and harder... a beat of silence
     RESULT             the shell breaks: the animal in colour, standing where the fish fell.
                        Text only (no panel): rarity, NAME, luck · kg, NEW!, $/s, 1 IN X
     GO BACK            big blue button (gamepad: selected, A / Enter): back to the base,
                        the animal goes to the base.
     Also: the placement ghost / tap-to-place for a carried animal. ]]
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local GuiService = game:GetService("GuiService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local Layout = require(Shared.Layout)
local GameConfig = require(Shared.Config.GameConfig)
local BearConfig = require(Shared.Config.BearConfig)
local BearBuilder = require(Shared.Models.BearBuilder)
local FishBuilder = require(Shared.Models.FishBuilder)
local RarityConfig = require(Shared.Config.RarityConfig)
local Easing = require(Shared.Util.Easing)
local Format = require(Shared.Util.Format)
local Fx = require(script.Parent.Fx)
local Sound = require(script.Parent.Sound)
local Actions = require(script.Parent.Actions)
local CameraController = require(script.Parent.CameraController)
local Haptics = require(script.Parent.Haptics)
local Cine = require(script.Parent.CinematicFx)
local Clock = require(script.Parent.Clock)
local Sim = require(script.Parent.Parent.UI.Sim)
local Data = require(script.Parent.Data)

local Capture = {}
local player = Players.LocalPlayer
local ghost
local reveal = nil -- the running reveal (one at a time)

Capture.Reveal = nil -- set by ClientMain (kept for compatibility)
Capture.Flash = nil
Capture.Unlock = nil
-- the "1 IN" suspense effect (same look, different motion): "classic", "reels", "wave", "echo"
Capture.SpinStyle = "classic"

local RV = GameConfig.Capture.Reveal
local T_SPIN = RV.transform
local T_HOLD = RV.transform + RV.spin
local T_RESULT = RV.transform + RV.spin + RV.hold
local SHADOW = Color3.fromRGB(14, 12, 18)
local WHITE, BLACK = Color3.new(1, 1, 1), Color3.new(0, 0, 0)

-- AMBIANCE: the music melts away during the reveal, comes back after
local function duckMusic(on: boolean)
	local m = game:GetService("SoundService"):FindFirstChild("TFB_Music")
	if not m or not m:IsA("Sound") then return end
	if on then
		if m:GetAttribute("TFBVol") == nil then m:SetAttribute("TFBVol", m.Volume) end
		TweenService:Create(m, TweenInfo.new(0.8), { Volume = (m:GetAttribute("TFBVol") or 0.2) * 0.15 }):Play()
	else
		local v = m:GetAttribute("TFBVol")
		if v then
			TweenService:Create(m, TweenInfo.new(1.5), { Volume = v }):Play()
			m:SetAttribute("TFBVol", nil)
		end
	end
end

local function commas(n: number): string
	local s = tostring(math.floor(n + 0.5))
	local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	if out:sub(1, 1) == "," then out = out:sub(2) end
	return out
end

local function luckText(v: number): string
	if v < 10 then return ("x%.2f"):format(v) end
	if v < 1000 then return ("x%.1f"):format(v) end
	return "x" .. Format.short(v)
end

local function tw(o: Instance, t: number, goal, style: Enum.EasingStyle?, dir: Enum.EasingDirection?)
	local x = TweenService:Create(o, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), goal)
	x:Play()
	return x
end

-- MODELS ------------------------------------------------------------------------------
-- anchored root, jointed body (the animator still breathes it), never collides, no glow
local function prepModel(m: Model)
	for _, x in m:GetDescendants() do
		if x:IsA("BasePart") then
			x.Anchored = false
			x.CanCollide = false
			x.CanQuery = false
			x.CanTouch = false
		elseif x:IsA("ParticleEmitter") or x:IsA("Light") or x:IsA("Sparkles") or x:IsA("Beam") or x:IsA("Trail") then
			x:Destroy()
		end
	end
	if m.PrimaryPart then m.PrimaryPart.Anchored = true end
end

-- the black slot-machine silhouette: every part pitch black (studs still read on it)
local function blacken(m: Model)
	for _, x in m:GetDescendants() do
		if x:IsA("BasePart") then
			x.Color = SHADOW
			x.Material = Enum.Material.SmoothPlastic
			x.Reflectance = 0
			-- completely black: smooth faces (studs would catch the light in grey dots)
			if x:IsA("Part") then
				x.TopSurface = Enum.SurfaceType.Smooth
				x.BottomSurface = Enum.SurfaceType.Smooth
				x.FrontSurface = Enum.SurfaceType.Smooth
				x.BackSurface = Enum.SurfaceType.Smooth
				x.LeftSurface = Enum.SurfaceType.Smooth
				x.RightSurface = Enum.SurfaceType.Smooth
			end
		elseif x:IsA("Decal") or x:IsA("Texture") or x:IsA("SurfaceGui") or x:IsA("BillboardGui") then
			x:Destroy()
		end
	end
end

local function scaleTo(m: Model, g: number)
	local cur = m:GetAttribute("TFBScale") or 1
	if math.abs(cur - g) > 0.002 then
		pcall(function() m:ScaleTo(g) end)
		m:SetAttribute("TFBScale", g)
	end
end

local function heightOf(m: Model): number
	local ok, size = pcall(function() return m:GetExtentsSize() end)
	return if ok and size then math.max(0.5, size.Y) else 4
end

-- stand the model on the ground at `face` (+ a tremble / hop offset)
local function stand(m: Model, face: CFrame, extra: CFrame?)
	local r = m.PrimaryPart
	if not r then return end
	local fa = r:FindFirstChild("Feet")
	local fy = if fa then (fa :: Attachment).Position.Y - 0.1 else -2
	r.CFrame = face * (extra or CFrame.identity) + Vector3.new(0, -fy, 0)
end

-- THE STAR BURST: white stud rays (stepped taper, no glow) behind the silhouette, always
-- facing the camera, slowly turning; pulses on every heartbeat
local STAR_RAYS = 16
local SEG = { { 0, 0.5, 1 }, { 0.5, 0.78, 0.62 }, { 0.78, 1, 0.3 } } -- from, to (x radius), width
local function newPart(parent: Instance, shape: Enum.PartType?): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Material = Enum.Material.SmoothPlastic
	p.Color = WHITE
	p.TopSurface = Enum.SurfaceType.Studs
	p.BottomSurface = Enum.SurfaceType.Smooth
	if shape then p.Shape = shape end
	p.Parent = parent
	return p
end

local function buildStar()
	local m = Instance.new("Model")
	m.Name = "TFBStar"
	local st = { model = m, rays = {}, lastR = -1 }
	for i = 1, STAR_RAYS do
		for k = 1, 3 do
			table.insert(st.rays, { p = newPart(m), a = (i - 1) / STAR_RAYS * math.pi * 2, k = k, long = i % 2 == 1 })
		end
	end
	st.disc = newPart(m, Enum.PartType.Cylinder)
	m.Parent = Fx.folder
	return st
end

local function placeStar(st, center: Vector3, camCF: CFrame, R: number, spin: number, depth: number)
	local look, right, up = camCF.LookVector, camCF.RightVector, camCF.UpVector
	local back = center + look * depth
	local resize = math.abs(R - st.lastR) > st.lastR * 0.035
	if resize then st.lastR = R end
	for _, ray in st.rays do
		local len = R * (if ray.long then 1 else 0.6)
		local a = ray.a + spin
		local dir = right * math.cos(a) + up * math.sin(a)
		local across = dir:Cross(look)
		local s = SEG[ray.k]
		local mid = back + dir * len * (s[1] + s[2]) / 2 + look * (0.02 * ray.k)
		if resize then
			ray.p.Size = Vector3.new(math.max(0.12, len * (if ray.long then 0.36 else 0.3) * s[3]), len * (s[2] - s[1]) + 0.04, 0.12)
		end
		ray.p.CFrame = CFrame.fromMatrix(mid, across, dir)
	end
	if resize then st.disc.Size = Vector3.new(0.12, R * 0.95, R * 0.95) end
	st.disc.CFrame = CFrame.fromMatrix(back + look * 0.06, look, up)
end

-- TEXT (no panel, Fredoka + thick black outline) -----------------------------------------
local function buildUi()
	local g = Sim.new("ScreenGui", { Name = "TFBReveal", ResetOnSpawn = false, DisplayOrder = 13, IgnoreGuiInset = true,
		ScreenInsets = Enum.ScreenInsets.None, ZIndexBehavior = Enum.ZIndexBehavior.Sibling }, player:WaitForChild("PlayerGui"))
	local stage = Sim.root(g, "Stage", Vector2.new(1000, 560), UDim2.fromScale(0.5, 0.5), Vector2.new(0.5, 0.5))
	local ui = { gui = g, stage = stage }
	local function text(name: string, y: number, w: number, h: number, max: number, color: Color3, stroke: number)
		local holder = Sim.new("Frame", { Name = name, BackgroundTransparency = 1, Size = UDim2.fromOffset(w, h), Position = UDim2.fromOffset(500, y),
			AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 8 }, stage)
		local sc = Sim.new("UIScale", { Scale = 0 }, holder)
		local l = Sim.new("TextLabel", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Position = UDim2.fromScale(0.5, 0.5),
			AnchorPoint = Vector2.new(0.5, 0.5), Font = Sim.FONT, Text = "", TextScaled = true,
			TextColor3 = color, ZIndex = 9 }, holder)
		Sim.new("UITextSizeConstraint", { MaxTextSize = max, MinTextSize = 8 }, l)
		local s = Sim.new("UIStroke", { Thickness = stroke, Color = BLACK, LineJoinMode = Enum.LineJoinMode.Round }, l)
		return { holder = holder, scale = sc, label = l, stroke = s, y = y }
	end
	ui.spin = text("Spin", 378, 700, 120, 120, WHITE, 7) -- under the shape's feet
	ui.spin.label.Size = UDim2.fromScale(0.84, 0.84)
	-- the result texts sit in a compact stack at the TOP: the animal stays fully visible
	ui.rarity = text("Rarity", 24, 520, 28, 26, WHITE, 4)
	ui.name = text("Name", 60, 940, 52, 52, WHITE, 6)
	ui.sub = text("Sub", 94, 620, 20, 19, WHITE, 3)
	ui.new = text("New", 120, 220, 28, 27, Color3.fromRGB(255, 70, 70), 4)
	ui.income = text("Income", 150, 420, 34, 32, Color3.fromRGB(110, 255, 70), 4)
	ui.odds = text("Odds", 192, 620, 56, 54, WHITE, 6)
	ui.nameGrad = Sim.new("UIGradient", { Rotation = 90, Color = ColorSequence.new(WHITE, WHITE) }, ui.name.label)
	for _, k in { "spin", "odds" } do
		ui[k].grad = Sim.new("UIGradient", { Rotation = 90, Color = ColorSequence.new(WHITE, WHITE) }, ui[k].label)
		ui[k].holder.ClipsDescendants = false
	end
	ui.new.holder.Rotation = -4
	return ui
end

-- a POP: from nothing to a little too big, back to its size
local function pop(t, dur: number?, from: number?)
	t.scale.Scale = from or 0
	tw(t.scale, dur or 0.34, { Scale = 1 }, Enum.EasingStyle.Back)
end
-- a SLAM: from huge to its size, very fast, with a shake
local function slam(t, rs, from: number?)
	t.scale.Scale = from or 2.4
	tw(t.scale, 0.16, { Scale = 1 }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
	task.delay(0.16, function()
		if rs.done then return end
		rs.kick = 1
		tw(t.scale, 0.08, { Scale = 1.08 }).Completed:Connect(function()
			if t.scale.Parent then tw(t.scale, 0.18, { Scale = 1 }, Enum.EasingStyle.Back) end
		end)
	end)
end

--[[ "1 IN X" COLOURS: the rarer, the wilder. Plain tones for common odds, a shine sweep for
     rare ones, then animated FIRE (flames rolling up the letters + embers), GALACTIC
     (cosmic colours turning + twinkling stars) and PRISM (rainbow + stars) at the top.
     Pure UI (gradients, little studded squares): no glow. ]]
local RGB = Color3.fromRGB
local ODDS_TIERS = {
	{ max = 10, kind = "plain", a = WHITE, b = RGB(220, 220, 230) },
	{ max = 100, kind = "plain", a = RGB(214, 255, 170), b = RGB(70, 215, 50) },
	{ max = 1000, kind = "plain", a = RGB(180, 230, 255), b = RGB(40, 140, 255) },
	{ max = 10000, kind = "shine", a = RGB(236, 190, 255), b = RGB(150, 60, 240) },
	{ max = 100000, kind = "shine", a = RGB(255, 244, 160), b = RGB(250, 150, 20) },
	{ max = 1000000, kind = "fire" },
	{ max = 10000000, kind = "galaxy" },
	{ max = math.huge, kind = "prism" },
}
local function oddsTier(x: number?)
	if not x then return 0, nil end
	for i, t in ODDS_TIERS do
		if x < t.max then return i, t end
	end
	return #ODDS_TIERS, ODDS_TIERS[#ODDS_TIERS]
end

-- a little effect square around the text (ember / star), animated with tweens
local function oddsParticle(holder: Frame, kind: string)
	local W, H = holder.AbsoluteSize.X, holder.AbsoluteSize.Y
	W = if W > 2 then holder.Size.X.Offset else holder.Size.X.Offset
	H = holder.Size.Y.Offset
	if kind == "fire" then
		local sz = math.random(6, 13)
		local f = Sim.new("Frame", { BackgroundColor3 = ({ RGB(255, 210, 60), RGB(255, 130, 30), RGB(255, 70, 30) })[math.random(1, 3)], BorderSizePixel = 0,
			Size = UDim2.fromOffset(sz, sz), Position = UDim2.fromOffset(W * (0.15 + math.random() * 0.7), H * (0.55 + math.random() * 0.3)),
			AnchorPoint = Vector2.new(0.5, 0.5), Rotation = math.random(0, 90), ZIndex = 8 }, holder)
		Sim.stroke(f, 2, RGB(120, 20, 10))
		local dur = 0.7 + math.random() * 0.6
		tw(f, dur, { Position = f.Position + UDim2.fromOffset(math.random(-20, 20), -H * (0.9 + math.random() * 0.6)), Rotation = f.Rotation + math.random(-180, 180),
			Size = UDim2.fromOffset(2, 2), BackgroundColor3 = RGB(255, 60, 20) }, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
		task.delay(dur, function() f:Destroy() end)
	else
		-- a 4-point star (two crossed bars) that pops in and out
		local sz = math.random(10, 22)
		local col = if kind == "prism" then Color3.fromHSV(math.random(), 0.5, 1) else ({ WHITE, RGB(170, 220, 255), RGB(255, 170, 240) })[math.random(1, 3)]
		local holderF = Sim.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(sz, sz),
			Position = UDim2.fromOffset(W * (-0.05 + math.random() * 1.1), H * (-0.2 + math.random() * 1.4)), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 10 }, holder)
		local sc = Sim.new("UIScale", { Scale = 0 }, holderF)
		for _, rot in { 0, 90 } do
			Sim.new("Frame", { BackgroundColor3 = col, BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, math.max(2, sz // 5)), Position = UDim2.fromScale(0.5, 0.5),
				AnchorPoint = Vector2.new(0.5, 0.5), Rotation = rot, ZIndex = 10 }, holderF)
		end
		tw(sc, 0.22, { Scale = 1 }, Enum.EasingStyle.Back)
		tw(holderF, 0.9, { Rotation = 90 })
		task.delay(0.5, function() if holderF.Parent then tw(sc, 0.35, { Scale = 0 }, Enum.EasingStyle.Back, Enum.EasingDirection.In) end end)
		task.delay(0.9, function() holderF:Destroy() end)
	end
end

-- per frame: colour / animate a "1 IN" label for its odds (o = ui.spin / ui.odds, x = the number)
local function styleOdds(o, x: number?, now: number, dt: number)
	local i, tier = oddsTier(x)
	if not tier then
		-- "1 IN ?": white, black outline
		o.grad.Color = ColorSequence.new(WHITE, WHITE)
		o.grad.Rotation = 90
		o.grad.Offset = Vector2.zero
		o.stroke.Color = BLACK
		o.tier = 0
		return
	end
	o.tier = i
	o.fxAcc = (o.fxAcc or 0) + dt
	if tier.kind == "plain" then
		o.grad.Color = ColorSequence.new(tier.a, tier.b)
		o.grad.Rotation = 90
		o.grad.Offset = Vector2.zero
		o.stroke.Color = BLACK
	elseif tier.kind == "shine" then
		local lite = tier.a:Lerp(WHITE, 0.8)
		local band = ((now * 0.7) % 1.6) - 0.3 -- a bright band crossing the letters every 1.6 s
		o.grad.Rotation = 20
		o.grad.Color = ColorSequence.new({ ColorSequenceKeypoint.new(0, tier.b), ColorSequenceKeypoint.new(0.4, tier.a), ColorSequenceKeypoint.new(0.5, lite),
			ColorSequenceKeypoint.new(0.6, tier.a), ColorSequenceKeypoint.new(1, tier.b) })
		o.grad.Offset = Vector2.new(band * 2 - 1, 0)
		o.stroke.Color = BLACK
	elseif tier.kind == "fire" then
		-- flames roll up through the letters, flickering
		local flick = math.noise(now * 9, 1.7) * 0.12
		o.grad.Rotation = 90
		o.grad.Color = ColorSequence.new({ ColorSequenceKeypoint.new(0, RGB(255, 250, 200)), ColorSequenceKeypoint.new(0.3, RGB(255, 220, 60)),
			ColorSequenceKeypoint.new(0.62, RGB(255, 120, 20)), ColorSequenceKeypoint.new(1, RGB(210, 30, 20)) })
		o.grad.Offset = Vector2.new(0, -0.15 + ((now * 1.3) % 1) * 0.3 + flick)
		o.stroke.Color = RGB(70, 8, 4):Lerp(RGB(140, 30, 10), 0.5 + 0.5 * math.sin(now * 14))
		if o.fxAcc > 0.05 then
			o.fxAcc = 0
			oddsParticle(o.holder, "fire")
		end
	elseif tier.kind == "galaxy" then
		-- deep space colours slowly turning through the letters, stars twinkle around
		o.grad.Rotation = (now * 40) % 360
		o.grad.Color = ColorSequence.new({ ColorSequenceKeypoint.new(0, RGB(40, 20, 120)), ColorSequenceKeypoint.new(0.3, RGB(120, 60, 255)),
			ColorSequenceKeypoint.new(0.5, RGB(255, 140, 240)), ColorSequenceKeypoint.new(0.7, RGB(80, 200, 255)), ColorSequenceKeypoint.new(1, RGB(30, 10, 90)) })
		o.grad.Offset = Vector2.new(math.sin(now * 0.8) * 0.25, math.cos(now * 0.6) * 0.2)
		o.stroke.Color = RGB(14, 4, 40)
		if o.fxAcc > 0.09 then
			o.fxAcc = 0
			oddsParticle(o.holder, "galaxy")
		end
	else
		-- PRISM: the whole rainbow flowing through, stars of every colour
		local h0 = now * 0.35
		local kps = {}
		for k = 0, 5 do
			table.insert(kps, ColorSequenceKeypoint.new(k / 5, Color3.fromHSV((h0 + k * 0.17) % 1, 0.65, 1)))
		end
		o.grad.Rotation = 15
		o.grad.Color = ColorSequence.new(kps)
		o.grad.Offset = Vector2.zero
		o.stroke.Color = RGB(20, 10, 30)
		if o.fxAcc > 0.06 then
			o.fxAcc = 0
			oddsParticle(o.holder, "prism")
		end
	end
end

--[[ SUSPENSE NUMBER EFFECTS (same font / outline / colours, a different motion):
     reels : every character sits in its own little window; when it changes, the old one rolls
             out upward and the new one rolls in from below, like a slot machine
     wave  : every character dances in a travelling wave (up / down + tilt), wilder the rarer
     echo  : coloured ghost copies trail behind the number as it shakes, and a big copy blasts
             out of it on every new rarity tier ]]
local function charsOf(text: string): { string }
	local out = {}
	for _, cp in utf8.codes(text) do table.insert(out, utf8.char(cp)) end
	return out
end
local function newChar(parent: Instance, ch: string, size: Vector2, z: number)
	local l = Sim.new("TextLabel", { BackgroundTransparency = 1, Size = UDim2.fromOffset(size.X, size.Y), AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5), Font = Sim.FONT, Text = ch, TextScaled = true, TextColor3 = WHITE, ZIndex = z }, parent)
	Sim.new("UIStroke", { Name = "S", Thickness = 6, Color = BLACK, LineJoinMode = Enum.LineJoinMode.Round }, l)
	Sim.new("UIGradient", { Name = "G", Rotation = 90 }, l)
	return l
end
local function copyLook(from, l: TextLabel)
	local g, st = l:FindFirstChild("G") :: UIGradient, l:FindFirstChild("S") :: UIStroke
	if g then g.Color = from.grad.Color g.Rotation = from.grad.Rotation g.Offset = from.grad.Offset end
	if st then st.Color = from.stroke.Color end
end
local function spinFx(style: string, o, rs, t: number, dt: number)
	if style == "classic" then return end
	local text = o.label.Text
	local chars = charsOf(text)
	local tier = o.tier or 0
	local H = o.holder.Size.Y.Offset * 0.84
	local CW = H * 0.62 -- the width of one character cell
	if style == "reels" or style == "wave" then
		-- the characters are drawn by their own labels: hide the main one
		o.label.TextTransparency = 1
		o.stroke.Transparency = 1
		if not o.row then
			o.row = Sim.new("Frame", { Name = "Row", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 9 }, o.holder)
			o.cells = {}
		end
		-- each character gets a cell as wide as it really is (thin "1", "I", ",", spaces)
		local function wOf(ch: string): number
			if ch == " " then return CW * 0.45 end
			if ch == "," or ch == "." then return CW * 0.42 end
			if ch == "1" or ch == "I" then return CW * 0.62 end
			if ch == "N" then return CW * 1.08 end
			return CW * 0.92
		end
		local n = #chars
		local total = 0
		for _, ch in chars do total += wOf(ch) end
		local xs = {}
		local x = -total / 2
		for k, ch in chars do
			xs[k] = x + wOf(ch) / 2
			x += wOf(ch)
		end
		for i = 1, math.max(n, #o.cells) do
			local cell = o.cells[i]
			if i > n then
				if cell then cell.frame:Destroy() o.cells[i] = nil end
				continue
			end
			if not cell then
				local f = Sim.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(CW * 1.15, H * 1.05), AnchorPoint = Vector2.new(0.5, 0.5),
					ClipsDescendants = style == "reels", ZIndex = 9 }, o.row)
				cell = { frame = f, ch = "", lab = nil }
				o.cells[i] = cell
			end
			cell.frame.Position = UDim2.new(0.5, xs[i], 0.5, 0)
			if cell.ch ~= chars[i] then
				local old = cell.lab
				local new = newChar(cell.frame, chars[i], Vector2.new(CW * 1.1, H), 10)
				copyLook(o, new)
				if style == "reels" and old then
					-- roll: the old character slides out the top, the new one in from the bottom
					new.Position = UDim2.fromScale(0.5, 1.5)
					tw(new, 0.09, { Position = UDim2.fromScale(0.5, 0.5) }, Enum.EasingStyle.Quad)
					tw(old, 0.09, { Position = UDim2.fromScale(0.5, -0.5) }, Enum.EasingStyle.Quad)
					task.delay(0.1, function() old:Destroy() end)
				elseif old then
					old:Destroy()
				end
				cell.lab = new
				cell.ch = chars[i]
			end
			if cell.lab then
				copyLook(o, cell.lab)
				if style == "wave" then
					local amp = (4 + tier * 2.2)
					local k = t * (6 + tier * 0.8) - i * 0.7
					cell.lab.Position = UDim2.new(0.5, 0, 0.5, math.sin(k) * amp)
					cell.lab.Rotation = math.sin(k + 0.8) * (4 + tier * 1.5)
					local sc = 1 + 0.08 * math.max(0, math.sin(k))
					cell.lab.Size = UDim2.fromOffset(CW * 1.1 * sc, H * sc)
				end
			end
		end
	elseif style == "echo" then
		-- ghost copies lag behind the shaking number, in the tier colour
		if not o.ghosts then
			o.ghosts = {}
			for k = 1, 3 do
				local g = Sim.new("TextLabel", { BackgroundTransparency = 1, Size = UDim2.fromScale(0.84, 0.84), AnchorPoint = Vector2.new(0.5, 0.5),
					Position = UDim2.fromScale(0.5, 0.5), Font = Sim.FONT, TextScaled = true, TextColor3 = WHITE, ZIndex = 8 - k }, o.holder.Parent)
				Sim.new("UITextSizeConstraint", { MaxTextSize = 120, MinTextSize = 8 }, g)
				table.insert(o.ghosts, { lab = g, hist = {} })
			end
			o.hist = {}
		end
		table.insert(o.hist, 1, { p = o.holder.Position, r = o.holder.Rotation })
		if #o.hist > 12 then table.remove(o.hist) end
		local kps = o.grad.Color.Keypoints
		local col = if kps and kps[1] then kps[#kps].Value else WHITE
		for k, gh in o.ghosts do
			local h = o.hist[math.min(#o.hist, k * 3)]
			gh.lab.Text = text
			gh.lab.Size = o.holder.Size
			gh.lab.Position = h.p
			gh.lab.Rotation = h.r
			gh.lab.TextColor3 = col
			gh.lab.TextTransparency = 0.35 + k * 0.17
		end
		-- a new tier: a big copy blasts out of the number
		if tier > (o.echoTier or 0) then
			o.echoTier = tier
			if tier > 1 then
				local b = Sim.new("TextLabel", { BackgroundTransparency = 1, Size = o.holder.Size, AnchorPoint = Vector2.new(0.5, 0.5), Position = o.holder.Position,
					Font = Sim.FONT, Text = text, TextScaled = true, TextColor3 = col, TextTransparency = 0.2, ZIndex = 5 }, o.holder.Parent)
				local sc = Sim.new("UIScale", { Scale = 1 }, b)
				tw(sc, 0.5, { Scale = 2.4 }, Enum.EasingStyle.Quart)
				tw(b, 0.5, { TextTransparency = 1 }, Enum.EasingStyle.Quad)
				task.delay(0.55, function() b:Destroy() end)
			end
		end
	end
end
local function spinFxClear(o)
	if o.row then o.row:Destroy() o.row = nil o.cells = nil end
	if o.ghosts then for _, g in o.ghosts do g.lab:Destroy() end o.ghosts = nil end
end

local VARIANT_GRAD = {
	Golden = { Color3.fromRGB(255, 246, 170), Color3.fromRGB(255, 176, 20) },
	Diamond = { Color3.fromRGB(230, 252, 255), Color3.fromRGB(70, 196, 255) },
	Ancient = { Color3.fromRGB(210, 236, 170), Color3.fromRGB(96, 150, 70) },
	Clockwork = { Color3.fromRGB(255, 226, 150), Color3.fromRGB(190, 120, 40) },
}

-- CAMERA --------------------------------------------------------------------------------
local camParams = RaycastParams.new()
camParams.FilterType = Enum.RaycastFilterType.Include
-- the side the camera films from: behind the thrower (+Z), else the first clear side
local function pickSide(at: Vector3, dist: number, height: number): Vector3
	local map = workspace:FindFirstChild("Map")
	for _, a in { 0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.9, -1.9, math.pi } do
		local dir = Vector3.new(math.sin(a), 0, math.cos(a))
		local p = at + dir * dist + Vector3.new(0, height, 0)
		local inside = math.abs(p.X) < Layout.CORRIDOR_HALF - 3 and p.Z < Layout.CORRIDOR_START_Z - 3 and p.Z > Layout.CORRIDOR_END_Z + 3
		if inside then
			if not map then return dir end
			camParams.FilterDescendantsInstances = { map }
			local from = at + Vector3.new(0, height, 0)
			local hit = workspace:Raycast(from, p - from, camParams)
			if not hit then return dir end
		end
	end
	return Vector3.new(0, 0, 1)
end

-- THE REVEAL ----------------------------------------------------------------------------
local function cleanup(rs, instant: boolean?)
	if rs.done then return end
	rs.done = true
	if rs.conn then rs.conn:Disconnect() end
	if rs.inputConn then rs.inputConn:Disconnect() end
	if reveal == rs then reveal = nil end
	pcall(function()
		if GuiService.SelectedObject and rs.ui and GuiService.SelectedObject:IsDescendantOf(rs.ui.gui) then GuiService.SelectedObject = nil end
	end)
	local function kill()
		if rs.ui then rs.ui.gui:Destroy() end
		if rs.star then rs.star.model:Destroy() end
		for _, c in rs.pool do if c.model then c.model:Destroy() end end
		if rs.fish then rs.fish:Destroy() end
		if rs.final then rs.final:Destroy() end
	end
	if instant then
		kill()
	else
		-- the animal leaves for the base: a puff of white studs where it stood
		-- (no puff: the animal simply goes home with you)
		if rs.ui then
			for _, k in { "rarity", "name", "sub", "new", "income", "odds", "spin" } do
				local t = rs.ui[k]
				if t then tw(t.scale, 0.2, { Scale = 0 }, Enum.EasingStyle.Back, Enum.EasingDirection.In) end
			end
		end
		task.delay(0.22, kill)
	end
	Cine.skipButton(nil)
	duckMusic(false)
	Cine.hideHud(false)
	Cine.dof(nil, 0)
	Cine.gradeOff(0.6)
	Cine.restoreClear()
end

local function goBack(rs)
	if rs.done or rs.pressed or not rs.canGoBack then return end
	rs.pressed = true
	Sound.play("Click")
	if rs.btn then Sim.disable(rs.btn, true) end
	Cine.blackout(true, 0.18)
	Net.event("CaptureGoBack"):FireServer()
	-- the server answers with "Captured"; never stay black if it does not
	task.delay(3, function()
		if reveal == rs then Cine.blackout(false, 0.3) end
	end)
end

local function showGoBack(rs)
	if rs.done or rs.btn then return end
	rs.canGoBack = true
	local holder = Sim.new("Frame", { Name = "GoBackHolder", BackgroundTransparency = 1, Size = UDim2.fromOffset(330, 78),
		Position = UDim2.fromOffset(500, 512), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 20 }, rs.ui.stage)
	local sc = Sim.new("UIScale", { Scale = 0 }, holder)
	rs.btn = Sim.button(holder, { Name = "GoBack", Text = "GO BACK", Grad = "blue", Size = Vector2.new(320, 70), Position = UDim2.fromScale(0.5, 0.5),
		Max = 46, Corner = 6, Stroke = 4, TextStroke = 4, Tile = 30, ZIndex = 21 }, function() goBack(rs) end)
	rs.btn.Selectable = true
	tw(sc, 0.42, { Scale = 1 }, Enum.EasingStyle.Back)
	Sound.play("Open")
	if UserInputService.GamepadEnabled then
		pcall(function() GuiService.SelectedObject = rs.btn end)
	end
end

local function startReveal(d)
	if reveal then cleanup(reveal, true) end
	local o = d.outcome
	-- THE CLIMB PLAN: 1 -> each colour step below the real odds (10, 100, 1k...) -> the odds.
	-- The number climbs between steps (log scale) and STOPS on every step for RV.pause s, so
	-- the suspense lasts longer the rarer the animal is (the server waits just as long).
	local target = math.max(1, d.oneIn or 1)
	local SPIN_LEN = RV.spin + GameConfig.revealPauses(target) * RV.pause
	local T_HOLD = T_SPIN + SPIN_LEN
	local T_RESULT = T_HOLD + RV.hold
	local climb = {}
	do
		-- each stop is a RANDOM-looking number just past the colour step (13, 147, 1 384...),
		-- never a round one, always below the next stop and below the real odds
		local pts = { 1 }
		local steps = {}
		for _, v in RV.tierSteps do
			if target > v then table.insert(steps, v) end
		end
		for k, v in steps do
			local cap = math.min(target, steps[k + 1] or target) * 0.97
			local x = v * (1.08 + math.random() * 0.8)
			x = math.max(v + 1, math.min(x, cap))
			if x >= 1000 then x = math.floor(x) + math.random(1, 9) end -- no trailing zeros
			x = math.floor(x)
			if x % 10 == 0 then x += math.random(1, 9) end
			x = math.min(x, math.floor(cap))
			if x <= pts[#pts] then x = pts[#pts] + 1 end
			table.insert(pts, x)
		end
		table.insert(pts, target)
		local spans, tot = {}, 0
		for k = 2, #pts do
			spans[k] = math.max(0.35, math.log10(math.max(pts[k], 1.0001)) - math.log10(pts[k - 1]))
			tot += spans[k]
		end
		local tt = T_SPIN
		for k = 2, #pts do
			local dur = RV.spin * spans[k] / tot
			table.insert(climb, { t0 = tt, t1 = tt + dur, x0 = pts[k - 1], x1 = pts[k] })
			tt += dur
			if k < #pts then
				table.insert(climb, { t0 = tt, t1 = tt + RV.pause, x0 = pts[k], x1 = pts[k], pause = true })
				tt += RV.pause
			end
		end
	end
	local function climbAt(t: number): (number, boolean, number)
		for i, seg in climb do
			if t < seg.t1 then
				if seg.pause then return seg.x0, true, i end
				local k = math.clamp((t - seg.t0) / (seg.t1 - seg.t0), 0, 1)
				k = Easing.sineInOut(k)
				return seg.x0 * (seg.x1 / seg.x0) ^ k, false, i
			end
		end
		return target, true, #climb + 1
	end
	local spec = BearConfig.get(o.s)
	local tier = RarityConfig.get(o.r)
	local rs = { d = d, pool = {}, t0 = os.clock(), kick = nil, beatKick = 0, done = false, pressed = false, canGoBack = false }
	reveal = rs
	Cine.letterbox(false) -- the normal scenery stays visible: no black bars
	Cine.hideHud(true)
	-- a richer picture for the reveal: livelier colours, a touch of contrast (no glow)
	Cine.grade({ saturation = 0.18, contrast = 0.1, brightness = 0.02 }, 0.8)
	duckMusic(true)
	if d.canSkip then
		Cine.skipButton(function() Net.event("SkipCapture"):FireServer() end)
	end
	local ground = d.landing

	-- 1) the FISH (the very fish that was thrown; rebuilt if it is not there any more)
	local fish = Fx.folder:FindFirstChild("TFBLandedFish") :: Model?
	if not fish then
		local ok, f = pcall(FishBuilder.build, d.fish.s, { weight = d.fish.w, variant = d.fish.v })
		if ok and f then
			fish = f
			prepModel(f)
			local fh = f:GetAttribute("Height") or 1
			f:PivotTo(CFrame.new(ground + Vector3.new(0, fh * 0.32 + 0.1, 0)) * CFrame.Angles(0, math.random() * 6.28, math.pi / 2))
			f:SetAttribute("Anim", "Flop")
			f.Parent = Fx.folder
		end
	end
	if fish then fish.Name = "TFBRevealFish" end
	rs.fish = fish
	local fishCF = if fish then fish:GetPivot() else CFrame.new(ground)
	local fishH = 1.2
	local fishCols = {}
	if fish then
		local ok, sz = pcall(function() return fish:GetExtentsSize() end)
		if ok and sz then fishH = math.max(1.2, sz.Magnitude * 0.45) end
		for _, x in fish:GetDescendants() do
			if x:IsA("BasePart") and x.Transparency < 1 then table.insert(fishCols, { p = x, c = x.Color }) end
		end
	end

	-- 2) the RESULT, built now but kept hidden (no hitch at the big moment)
	local final: Model? = nil
	do
		local ok, m = pcall(BearBuilder.build, o.s, { weight = o.w, variant = o.v })
		if ok and m and m.PrimaryPart then
			prepModel(m)
			m.Name = "TFBRevealAnimal"
			final = m
		end
	end
	rs.final = final
	local finalH = if final then heightOf(final) else 6
	local finalW = 4
	if final then
		local ok, sz = pcall(function() return final:GetExtentsSize() end)
		if ok and sz then finalW = math.max(sz.X, sz.Z) end
	end

	-- 3) the silhouettes: other animals + the real one last (built over a few frames)
	local others = {}
	for _, id in BearConfig.Order do
		local s = BearConfig.get(id)
		if id ~= o.s and not s.fixedRarity then table.insert(others, id) end
	end
	for i = #others, 2, -1 do
		local j = math.random(1, i)
		others[i], others[j] = others[j], others[i]
	end
	local wanted = {}
	for i = 1, math.min(6, #others) do table.insert(wanted, others[i]) end
	local function makeSil(id: string)
		local ok, m = pcall(BearBuilder.build, id, { scale = 1, brickBudget = 60 })
		if not ok or not m or not m.PrimaryPart then return nil end
		prepModel(m)
		blacken(m)
		m.Name = "TFBSilhouette"
		local ok2, ext = pcall(function() return m:GetExtentsSize() end)
		local wide = if ok2 and ext then math.max(ext.X, ext.Z) else 4
		return { model = m, base = heightOf(m), wide = wide, id = id }
	end
	rs.finalSil = makeSil(o.s)
	task.spawn(function()
		for _, id in wanted do
			if rs.done then return end
			local c = makeSil(id)
			if c then
				if rs.done then c.model:Destroy() return end
				table.insert(rs.pool, c)
			end
			task.wait()
		end
	end)

	-- 4) camera side + framing
	local function distFor(x: number): number
		return math.clamp(5 + x * 1.9, 7, 46)
	end
	local dist = distFor(finalH)
	local side = pickSide(ground, dist * 1.2, 2 + finalH * 0.5)
	-- nothing between the camera and the creature: bushes / trees / rocks on the camera side
	-- (a wide band, the camera drifts a little) and right around the creature fade out locally
	Cine.clearAround(ground, math.max(6, finalW * 0.7 + 3), ground + side * (dist * 1.9 + 10), 9 + finalW * 0.3)
	local faceDir = CFrame.Angles(0, 0.38, 0):VectorToWorldSpace(side) -- a 3/4 view, never flat profile
	local faceCF = CFrame.lookAt(ground, ground + faceDir)

	local ui = buildUi()
	rs.ui = ui
	local star = nil
	local cur = nil -- { model, base }
	local nextSwap, swaps = T_SPIN, 0
	local finalShown, resultDone = false, false
	local nextBeat = 0.25
	local hop = 0
	local spinRot = 0
	local h = fishH
	local lastScaleAt = 0
	local camShake = 0

	local function heightAt(t: number): number
		local u = math.clamp((t - T_SPIN) / (T_HOLD - T_SPIN), 0, 1)
		return fishH + (finalH - fishH) * Easing.sineInOut(u)
	end

	-- the base odds of a species in this zone (same rules as the server: every species the
	-- same weight, x ZoneAffinity in its home zones): shown on the slot machine while it spins
	local zoneHere = Layout.zoneAt(ground) or 1
	local wTotal = 0
	local function wOf(id: string): number
		local sp = BearConfig.get(id)
		if not sp or sp.fixedRarity then return 0 end
		return if table.find(sp.zones, zoneHere) then BearConfig.ZoneAffinity else 1
	end
	for _, id in BearConfig.Order do wTotal += wOf(id) end
	local function show(c)
		if cur and cur ~= c then cur.model.Parent = nil end
		local _ = wOf -- (the "1 IN" counter climbs on its own, see CLIMB below)
		cur = c
		c.model.Parent = Fx.folder
		c.model:SetAttribute("Anim", "Idle")
		-- each new shape POPS in a bit too big; the next re-scale (~0.09 s later) settles it
		scaleTo(c.model, h / c.base * (if c == rs.finalSil then 1.2 else 1.14))
		lastScaleAt = os.clock()
		hop = 1
		swaps += 1
		Sound.play("Tick", { pitch = 0.9 + math.min(0.7, swaps * 0.02), volume = 0.7 })
	end

	-- RESULT ---------------------------------------------------------------------------
	local function result()
		resultDone = true
		Haptics.pulse(math.clamp(0.4 + math.log10(math.max(1, d.oneIn or 1)) * 0.08, 0.4, 1), 0.35) -- the reveal: a longer buzz, stronger when rarer
		local center = ground + Vector3.new(0, finalH * 0.5, 0)
		-- no burst: the shadow simply BECOMES the animal (same place, black, then the colour
		-- washes up while it leaps)
		local _ = center
		if cur then cur.model.Parent = nil end
		if rs.finalSil then rs.finalSil.model.Parent = nil end
		CameraController.shake(0.5, 0.3)
		CameraController.punch(10)
		Sound.play("Transform")
		Sound.play("Reveal" .. math.clamp(tier.reveal or 1, 1, 4))
		if final then
			-- THE APPEARANCE: the animal bursts out of its shadow still black, leaps up spinning,
			-- the colour washes up from its feet to its head while it flies, it lands with a
			-- bounce (dust ring, confetti, thud), then celebrates
			local paint = {}
			for _, x in final:GetDescendants() do
				if x:IsA("BasePart") and x.Transparency < 1 then
					table.insert(paint, { p = x, c = x.Color, h = x.Position.Y })
				end
			end
			local lo, hi = math.huge, -math.huge
			for _, e in paint do lo = math.min(lo, e.h) hi = math.max(hi, e.h) end
			for _, e in paint do
				e.h = (e.h - lo) / math.max(0.01, hi - lo)
				e.p.Color = SHADOW
			end
			rs.paint = paint
			final.Parent = Fx.folder
			final:SetAttribute("Anim", "Happy")
			final:SetAttribute("AnimT", Clock.now())
			scaleTo(final, 0.55)
			stand(final, faceCF)
			rs.popT = os.clock()
			rs.landed = false
			-- it keeps celebrating while you look at it
			task.spawn(function()
				task.wait(2.6)
				while final.Parent and not rs.done do
					final:SetAttribute("Anim", "Look")
					final:SetAttribute("AnimT", Clock.now())
					task.wait(3 + math.random() * 1.5)
					if not final.Parent or rs.done then break end
					final:SetAttribute("Anim", "Happy")
					final:SetAttribute("AnimT", Clock.now())
					task.wait(2.4)
				end
			end)
		end
		-- the star flies apart and is gone
		if star then
			local s = star
			star = nil
			for _, ray in s.rays do
				tw(ray.p, 0.35, { Transparency = 1, Size = ray.p.Size * Vector3.new(0.2, 1.6, 1) })
			end
			tw(s.disc, 0.25, { Transparency = 1 })
			task.delay(0.4, function() s.model:Destroy() end)
		end
		-- "1 IN ?" bursts away
		tw(ui.spin.scale, 0.18, { Scale = 1.6 })
		tw(ui.spin.label, 0.18, { TextTransparency = 1 })
		tw(ui.spin.stroke, 0.18, { Transparency = 1 })
		-- the texts, in order
		local rarityCol = Sim.RARITY_TEXT[o.r] or tier.color
		ui.rarity.label.Text = tier.name:upper()
		ui.rarity.label.TextColor3 = rarityCol
		if o.r == "Secret" then ui.rarity.stroke.Color = WHITE end
		local variant = if o.v and o.v ~= "Normal" then o.v else nil
		ui.name.label.Text = ((if variant then variant:upper() .. " " else "") .. spec.name:upper())
		local vg = variant and VARIANT_GRAD[variant]
		if vg then ui.nameGrad.Color = ColorSequence.new(vg[1], vg[2]) end
		ui.sub.label.Text = ("LUCK %s  ·  %s"):format(luckText(d.luck or 1), Format.kg(d.weight or o.w))
		ui.new.label.Text = "NEW!"
		task.delay(0.05, function() if not rs.done then pop(ui.rarity, 0.3) end end)
		task.delay(0.18, function()
			if rs.done then return end
			slam(ui.name, rs, 1.7)
			Sound.play("Place")
		end)
		task.delay(0.4, function() if not rs.done then pop(ui.sub, 0.3) end end)
		if d.isNew then
			task.delay(0.58, function()
				if rs.done then return end
				slam(ui.new, rs)
				Sound.play("Reward")
			end)
		end
		-- $/s counts up
		task.delay(0.72, function()
			if rs.done then return end
			pop(ui.income, 0.3)
			local t0 = os.clock()
			while not rs.done and os.clock() - t0 < 0.5 do
				ui.income.label.Text = Format.perSec((d.income or 0) * Easing.quadOut((os.clock() - t0) / 0.5))
				task.wait()
			end
			if not rs.done then ui.income.label.Text = Format.perSec(d.income or 0) end
		end)
		-- 1 IN X rolls up like a casino counter, then slams
		task.delay(0.95, function()
			if rs.done then return end
			pop(ui.odds, 0.25, 0.6)
			local target = math.max(1, d.oneIn or 1)
			local from = math.max(1, math.min(target, (rs.spinX or 1) * 0.5))
			local t0 = os.clock()
			local lastTick = 0
			while not rs.done and os.clock() - t0 < 0.6 do
				local k = Easing.cubicOut(math.min(1, (os.clock() - t0) / 0.6))
				rs.oddsX = from + (target - from) * k -- the colour climbs with the number
				ui.odds.label.Text = "1 IN " .. commas(rs.oddsX)
				if os.clock() - lastTick > 0.06 then
					lastTick = os.clock()
					Sound.play("Tick", { pitch = 1.2 + k * 0.6, volume = 0.5 })
				end
				task.wait()
			end
			if rs.done then return end
			ui.odds.label.Text = "1 IN " .. commas(target)
			rs.oddsX = target
			local ti = oddsTier(target)
			if ti >= 6 then
				-- fire / galactic / prism odds: a bigger hit
				CameraController.shake(0.6 + 0.2 * (ti - 6), 0.4)
				Sound.play("Reveal4")
			end
			slam(ui.odds, rs)
			Sound.play("Land", { pitch = 0.8 })
		end)
		task.delay(RV.result + 0.05, function() showGoBack(rs) end)
	end

	-- CAMERA: low, behind the throw, the animal in the middle; it creeps in while the
	-- silhouette grows, pushes in on the hold, pulls back for the result (texts above it)
	CameraController.run(function(_t, dt)
		local t = os.clock() - rs.t0
		local hh = if resultDone then finalH else h
		local follow = distFor(hh) * 0.75 + dist * 0.25 -- the camera backs off slower than it grows
		local d0, camY, lookY, fov
		if t < T_SPIN then
			-- close on the fish as it turns into the shadow
			local k = Easing.sineOut(t / T_SPIN)
			d0 = follow * (1.25 - 0.15 * k)
			camY = 0.9 + fishH * 0.7
			lookY = fishH * 0.5
			fov = 60
		elseif t < T_RESULT then
			-- the WHOLE shape is framed in the upper middle of the screen (about a third of its
			-- height), its feet on the ground well above the "1 IN X" text; the frame follows each
			-- new shape (tall heron, long orca...), creeps in, and pushes in on the hold
			local u = Easing.sineInOut(math.clamp((t - T_SPIN) / SPIN_LEN, 0, 1))
			local k = Easing.quadIn(math.clamp((t - T_HOLD) / RV.hold, 0, 1))
			local sc = if cur then h / cur.base else 1
			local wide = if cur then cur.wide * sc else hh
			rs.fitS = rs.fitS or math.max(hh / 0.3, wide / 1.5, 5)
			local want = math.max(hh / 0.3, wide / 1.5, 5)
			rs.fitS += (want - rs.fitS) * Easing.damp(5, dt or 0.016)
			local fit = rs.fitS * (1.08 - 0.06 * u - 0.08 * k)
			d0 = fit
			lookY = hh * 0.5 - 0.115 * fit -- look below the middle: the shape sits higher on screen
			camY = hh * 0.45 + 0.04 * fit
			fov = 60 - 2 * u - 5 * k
		else
			-- the result: a springy pull back that fits the WHOLE animal between its texts (top
			-- half of the screen) and the GO BACK button: ~26 % of the screen height, centred
			-- 14 % under the middle (a tall heron or a long orca never hides under the texts)
			local k = Easing.backOut(math.clamp((t - T_RESULT) / 0.55, 0, 1))
			local fit = math.max(finalH / 0.34, finalW / 1.7, 8)
			d0 = dist * 0.9 + (fit - dist * 0.9) * k
			lookY = hh * 0.5 + 0.075 * fit * k
			camY = 1 + hh * 0.5 + (0.06 * fit) * k
			fov = 52 + 6 * k
		end
		local yaw = 0.16 * math.sin(t * 0.33) + (if t > T_RESULT then (t - T_RESULT) * 0.035 else 0)
		local dir = CFrame.Angles(0, yaw, 0):VectorToWorldSpace(side)
		local pos = ground + dir * d0 + Vector3.new(0, camY, 0)
		local look = ground + Vector3.new(0, lookY, 0)
		-- a wall (or anything solid left) between the creature and the lens: the camera comes
		-- in front of it
		local map = workspace:FindFirstChild("Map")
		if map then
			camParams.FilterDescendantsInstances = { map }
			local hit = workspace:Raycast(look, pos - look, camParams)
			if hit and hit.Instance.LocalTransparencyModifier < 0.5 and hit.Instance.Transparency < 0.5 then
				pos = hit.Position - (pos - look).Unit * 1.2
			end
		end
		camShake = math.max(0, camShake - (dt or 0.016) * 4)
		if camShake > 0 then
			pos += Vector3.new(math.noise(t * 30, 1) * camShake * 0.25, math.noise(t * 30, 2) * camShake * 0.25, 0)
		end
		-- the scenery behind melts into a soft blur, the creature stays sharp (cinema look)
		local subjectSize = math.max(hh, if t >= T_RESULT then finalW * 0.6 else 1)
		Cine.dof((pos - look).Magnitude, if t < T_SPIN then 0.25 else 0.42, math.max(4, subjectSize * 0.9))
		return CFrame.lookAt(pos, look), fov
	end, 600, { smooth = 7, blendIn = 0.45 })

	Sound.play("Transform", { pitch = 1.2 })

	-- PER FRAME --------------------------------------------------------------------------
	rs.conn = RunService.RenderStepped:Connect(function(dt)
		dt = math.min(dt, 0.1)
		local t = os.clock() - rs.t0
		local camCF = workspace.CurrentCamera.CFrame
		-- TRANSFORM: the fish hops, spins, turns black; the star opens; "1 IN ?" slams
		if t < T_SPIN and fish and fish.Parent then
			local k = t / T_SPIN
			local up = Easing.bump(math.clamp(k * 1.1, 0, 1)) * (0.8 + fishH * 0.4)
			fish:PivotTo(CFrame.new(fishCF.Position + Vector3.new(0, up, 0)) * CFrame.Angles(0, k * math.pi * 3, 0) * fishCF.Rotation)
			local b = math.clamp(k / 0.5, 0, 1)
			for _, fc in fishCols do fc.p.Color = fc.c:Lerp(SHADOW, b) end
		end
		if not rs.starOpen and t > T_SPIN * 0.35 then
			-- (no star burst behind the shape: just the black shadow and its "1 IN ?")
			rs.starOpen = os.clock()
			ui.spin.label.Text = "1 IN ?"
			slam(ui.spin, rs)
			Sound.play("Land", { pitch = 0.65, volume = 0.9 })
			camShake = 1
		end
		-- SPIN: switch silhouettes on an accelerating -> slowing schedule
		if t >= T_SPIN and not resultDone then
			h = heightAt(t)
			if fish and fish.Parent then
				fish:Destroy()
				fish = nil
				rs.fish = nil
			end
			if not finalShown and t >= nextSwap then
				local u = math.clamp((t - T_SPIN) / SPIN_LEN, 0, 1)
				local interval = 0.075 + ((math.max(0, u - 0.4) / 0.6) ^ 2.2) * 0.65
				if (u >= 0.92 or t + interval > T_HOLD - 0.1) and rs.finalSil then
					finalShown = true
					show(rs.finalSil)
				else
					local choices = {}
					for _, c in rs.pool do if c ~= cur then table.insert(choices, c) end end
					if #choices == 0 and rs.finalSil and cur ~= rs.finalSil then table.insert(choices, rs.finalSil) end
					if #choices > 0 then show(choices[math.random(1, #choices)]) end
				end
				nextSwap = t + interval
			end
			-- keep the current silhouette at the growing size (throttled: re-scaling is heavy)
			if cur and os.clock() - lastScaleAt > 0.09 and not rs.squeezed then
				lastScaleAt = os.clock()
				scaleTo(cur.model, h / cur.base)
			end
		end
		-- CLIMB: "1 IN X" counts UP the whole suspense towards the real odds of what is coming:
		-- a common animal crawls up in white / green, a rare one rockets through gold, fire,
		-- galaxy... (slow start, faster and faster, the last digits rolling like a slot reel)
		local tierNow = ui.spin.tier or 0
		if t >= T_SPIN and not resultDone then
			local u = math.clamp((t - T_SPIN) / SPIN_LEN, 0, 1)
			local x, paused, segIdx = climbAt(t)
			if not paused then
				x *= 1 + math.noise(t * 25, 9.1) * 0.05 -- reel wobble between the steps
			end
			x = math.max(1, math.min(target, x))
			rs.spinX = x
			ui.spin.label.Text = "1 IN " .. commas(x)
			local ti = oddsTier(x)
			if paused and segIdx ~= rs.lastStop and segIdx <= #climb then
				-- the number STOPS on its new colour: it SLAMS, the screen kicks, the sound climbs
				rs.lastStop = segIdx
				do
					-- the number STOPS on the new colour for a second: slam, kick, sound
					slam(ui.spin, rs, 1.6 + 0.08 * ti)
					Sound.play("Reveal" .. math.clamp(ti - 2, 1, 4))
					Sound.play("Land", { pitch = 0.6 + 0.05 * ti, volume = 0.9 })
					CameraController.shake(0.25 + 0.14 * ti, 0.35)
					CameraController.punch(-4 - ti)
					-- phone / controller vibration, stronger at each colour step
					Haptics.pulse(0.25 + 0.1 * ti)
				end
			end
			rs.tickAcc = (rs.tickAcc or 0) + dt
			if not paused and rs.tickAcc > 0.07 then
				rs.tickAcc = 0
				Sound.play("Tick", { pitch = 0.9 + 0.8 * u, volume = 0.45 })
			end
		end
		-- HEARTBEAT: faster and faster (and faster still when the odds are high); silence just
		-- before the result
		local stress = math.clamp(t / (T_RESULT - 0.3), 0, 1)
		local hype = 1 + 0.22 * tierNow -- the rarer it is getting, the more intense everything is
		if not resultDone and t >= nextBeat and t < T_RESULT - 0.3 then
			nextBeat = t + (0.9 - 0.6 * stress) / (1 + 0.08 * tierNow)
			rs.beatKick = 1
			Sound.play("Heartbeat", { volume = 0.5 + 0.5 * stress, pitch = 0.5 + 0.1 * stress })
			if t > T_SPIN then CameraController.shake((0.08 + 0.3 * stress) * hype, 0.1) end
		end
		rs.beatKick = math.max(0, rs.beatKick - dt * 6)
		hop = math.max(0, hop - dt * 9)
		-- the silhouette: tremble (stronger and stronger) + a hop on every switch
		if cur and not resultDone and cur.model.Parent then
			local holdK = math.clamp((t - T_HOLD) / RV.hold, 0, 1)
			local amp = (0.02 + 0.06 * stress + 0.18 * holdK) * h * 0.25 * hype
			if t > T_RESULT - 0.25 then amp *= 1.6 end
			local n1, n2 = math.noise(t * 23, 1.1), math.noise(t * 23, 7.7)
			-- the shake slides it on the ground and twists it a little: the feet never leave the floor
			local extra = CFrame.new(n1 * amp, 0, n2 * amp * 0.5)
				* CFrame.Angles(0, math.noise(t * 17, 3.3) * (0.05 + 0.12 * holdK) + hop * hop * 0.12, 0)
			stand(cur.model, faceCF, extra)
		end
		-- the star: behind the silhouette, turning, pulsing on the beat
		if star then
			spinRot += dt * (0.25 + 1.4 * stress)
			local open = Easing.backOut(math.clamp((os.clock() - (rs.starOpen or os.clock())) / 0.35, 0, 1))
			local sc = if cur then h / cur.base else 1
			local wide = if cur then cur.wide * sc else fishH
			local big = math.max(h, fishH, wide * 0.6)
			local R = (big * 0.95 + 1.6) * open * (1 + 0.12 * rs.beatKick)
			local center = ground + Vector3.new(0, math.max(h, fishH) * 0.5, 0)
			-- pushed back past the whole body: no ray ever crosses in front of the black shape
			placeStar(star, center, camCF, math.max(0.05, R), spinRot, math.max(h, fishH, wide) * 0.7 + 1.5)
		end
		-- "1 IN ?" breathes with the heart, shakes with the stress
		if not resultDone then
			-- the heartbeat swells the letters (on the label: the holder keeps its slam / pop scale)
			local b = 0.84 * (1 + 0.14 * rs.beatKick) * (1 + 0.035 * tierNow) -- bigger letters as it climbs
			ui.spin.label.Size = UDim2.fromScale(b, b)
			local amp = (2 + 9 * stress) * hype
			ui.spin.holder.Position = UDim2.fromOffset(500 + math.noise(t * 13, 2) * amp, ui.spin.y + math.noise(t * 13, 5) * amp)
			ui.spin.holder.Rotation = math.noise(t * 9, 4) * (1 + 3 * stress)
		end
		-- ANTICIPATION: the last shadow squeezes in (a crouch) right before it bursts
		if cur and not resultDone and t > T_RESULT - 0.22 and not rs.squeezed then
			rs.squeezed = true
			scaleTo(cur.model, h / cur.base * 0.86)
			stand(cur.model, faceCF)
		end
		-- RESULT: when the hold ends
		if not resultDone and t >= T_RESULT then result() end
		-- the animal pops up to its full size (springy), throttled re-scaling
		if final and rs.popT then
			local el = os.clock() - rs.popT
			local JUMP = 0.62
			local k = math.clamp(el / JUMP, 0, 1)
			if k < 1 or not rs.landed then
				-- grows while it flies (springy), leaps in an arc, one full spin that slows down
				scaleTo(final, 0.55 + 0.45 * Easing.backOut(math.clamp(el / 0.45, 0, 1)))
				local up = Easing.bump(k) * finalH * 0.55
				local spin = (1 - Easing.cubicOut(k)) * math.pi * 2
				stand(final, faceCF, CFrame.new(0, up, 0) * CFrame.Angles(0, spin, 0))
				if k >= 1 and not rs.landed then
					-- LANDING: a thud and a little dust under the feet, a camera hit (no burst)
					rs.landed = true
					stand(final, faceCF)
					Fx.dust(ground, 0.8 + finalH * 0.12)
					CameraController.shake(0.7, 0.3)
					CameraController.punch(-6)
					Sound.play("Place")
					Sound.play("Land", { pitch = 0.7, volume = 1.1 })
				end
			end
			-- the colour wash: from the feet up to the head, each part flashes a little lighter
			-- as the wave reaches it, then settles on its true colour
			if rs.paint then
				local w = el / 0.55
				local doneAll = true
				for _, e in rs.paint do
					local kk = math.clamp((w - e.h * 0.6) / 0.4, 0, 1)
					if kk < 1 then doneAll = false end
					local flash = Easing.bump(kk) * 0.35
					e.p.Color = SHADOW:Lerp(e.c, kk):Lerp(WHITE, flash)
				end
				if doneAll then
					for _, e in rs.paint do e.p.Color = e.c end
					rs.paint = nil
				end
			end
		end
		-- the "1 IN" colours (spinning number / final odds)
		if not resultDone then
			styleOdds(ui.spin, rs.spinX, os.clock(), dt)
			if t >= T_SPIN then spinFx(Capture.SpinStyle, ui.spin, rs, os.clock(), dt) end
		elseif not rs.fxCleared then
			rs.fxCleared = true
			spinFxClear(ui.spin)
		end
		if rs.oddsX then styleOdds(ui.odds, rs.oddsX, os.clock(), dt) end
		-- rainbow tiers keep cycling
		if resultDone and tier.rainbow then
			ui.rarity.label.TextColor3 = RarityConfig.color(o.r, os.clock())
		end
		if resultDone and o.v == "Rainbow" then
			local hue = os.clock() * 0.3
			ui.nameGrad.Color = ColorSequence.new(Color3.fromHSV(hue % 1, 0.6, 1), Color3.fromHSV((hue + 0.25) % 1, 0.8, 1))
		end
		-- the slammed texts shake a moment
		if rs.kick and rs.kick > 0 then
			rs.kick = math.max(0, rs.kick - dt * 5)
			local a = rs.kick * 8
			ui.stage.Position = UDim2.new(0.5, math.noise(t * 40, 1) * a, 0.5, math.noise(t * 40, 2) * a)
			if rs.kick == 0 then
				rs.kick = nil
				ui.stage.Position = UDim2.fromScale(0.5, 0.5)
			end
		end
	end)

	-- keyboard / gamepad: Enter, A or X = GO BACK once it is there
	rs.inputConn = UserInputService.InputBegan:Connect(function(input, processed)
		if not rs.canGoBack then return end
		local kc = input.KeyCode
		if kc == Enum.KeyCode.Return or kc == Enum.KeyCode.KeypadEnter or kc == Enum.KeyCode.ButtonX
			or (kc == Enum.KeyCode.ButtonA and not processed) then
			goBack(rs)
		end
	end)
end

local function onFx(phase: string, d)
	if phase == "Reveal" then
		startReveal(d)
	elseif phase == "Captured" then
		local rs = reveal
		CameraController.stop(true)
		if rs then cleanup(rs) end
		Cine.letterbox(false)
		task.delay(0.15, function() Cine.blackout(false, 0.35) end)
		task.delay(0.35, function()
			local char = player.Character
			local root = char and char:FindFirstChild("HumanoidRootPart")
			local _ = root
			Sound.play("Place")
		end)
	elseif phase == "Failed" then
		if reveal then cleanup(reveal, true) end
		CameraController.stop()
		Cine.blackout(false, 0.2)
		Cine.letterbox(false)
		Cine.hideHud(false)
		duckMusic(false)
	end
end

-- PLACEMENT ghost (a carried animal) -------------------------------------------------------
local function step(_dt: number)
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	local base = player:GetAttribute("Base")
	if Data.state == "CarryingCapturedBear" and root and base and Layout.isInBase(base, root.Position, 6) then
		if not ghost then
			ghost = Instance.new("Part")
			ghost.Shape = Enum.PartType.Cylinder
			ghost.Anchored = true
			ghost.CanCollide = false
			ghost.CanQuery = false
			ghost.Material = Enum.Material.SmoothPlastic
			ghost.Transparency = 0.45
			ghost.Size = Vector3.new(0.15, 5, 5)
			ghost.Parent = Fx.folder
		end
		local p = Capture.placePosition()
		local ok = Layout.isInBase(base, p, 6)
		for _, m in workspace:WaitForChild("Bears"):GetChildren() do
			if m:GetAttribute("Owner") == player.UserId and m.PrimaryPart then
				local q = m.PrimaryPart.Position
				if Vector3.new(q.X - p.X, 0, q.Z - p.Z).Magnitude < GameConfig.Base.minBearSpacing then ok = false end
			end
		end
		ghost.Color = if ok then Color3.fromRGB(110, 255, 110) else Color3.fromRGB(255, 80, 80)
		local pulse = 1 + math.sin(os.clock() * 5) * 0.08
		ghost.Size = Vector3.new(0.15, 5 * pulse, 5 * pulse)
		ghost.CFrame = CFrame.new(p + Vector3.new(0, 0.15, 0)) * CFrame.Angles(0, 0, math.pi / 2)
	elseif ghost then
		ghost:Destroy()
		ghost = nil
	end
end

-- ground point under a screen position (map only)
local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Include
local function groundAt(screen: Vector2): Vector3?
	local map = workspace:FindFirstChild("Map")
	if not map then return nil end
	rayParams.FilterDescendantsInstances = { map }
	local ray = workspace.CurrentCamera:ViewportPointToRay(screen.X, screen.Y)
	local hit = workspace:Raycast(ray.Origin, ray.Direction * 600, rayParams)
	return hit and Vector3.new(hit.Position.X, 0, hit.Position.Z) or nil
end

-- where PLACE puts the animal: under the mouse on PC (ghost follows the cursor), else in front of you
function Capture.placePosition(): Vector3
	local base = player:GetAttribute("Base")
	if base and UserInputService.MouseEnabled then
		local p = groundAt(UserInputService:GetMouseLocation())
		if p and Layout.isInBase(base, p, 6) then return p end
	end
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then return Vector3.zero end
	local p = root.Position + root.CFrame.LookVector * 6
	return Vector3.new(p.X, 0, p.Z)
end

function Capture.isRevealing(): boolean
	return reveal ~= nil
end

function Capture.init()
	Net.event("CaptureFx").OnClientEvent:Connect(onFx)
	RunService.RenderStepped:Connect(function(dt)
		step(math.min(dt, 0.1))
	end)
	Actions.on("Place", function()
		Net.event("PlaceBear"):FireServer(Capture.placePosition())
	end)
	-- click / tap anywhere in your base to place the carried animal there
	UserInputService.InputBegan:Connect(function(input, gameProcessed)
		if gameProcessed or Data.state ~= "CarryingCapturedBear" then return end
		if input.UserInputType ~= Enum.UserInputType.MouseButton1 and input.UserInputType ~= Enum.UserInputType.Touch then return end
		local base = player:GetAttribute("Base")
		local screen = if input.UserInputType == Enum.UserInputType.Touch then Vector2.new(input.Position.X, input.Position.Y + GuiService:GetGuiInset().Y) else UserInputService:GetMouseLocation()
		local p = groundAt(screen)
		if base and p and Layout.isInBase(base, p, 6) then
			Fx.ring(p + Vector3.new(0, 0.2, 0), Color3.fromRGB(120, 255, 120), 0.5, 4, 0.4, { transparency = 0.2 })
			Net.event("PlaceBear"):FireServer(p)
		end
	end)
	player.CharacterAdded:Connect(function(char)
		if not char:GetAttribute("IsBear") then
			workspace.CurrentCamera.CameraSubject = char:WaitForChild("Humanoid", 5)
		end
	end)
end

return Capture
