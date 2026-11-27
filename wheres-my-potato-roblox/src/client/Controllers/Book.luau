--[[ Book: the tutorial as a real hardcover book held in both hands, right in front of the
     camera, open on a two-page spread that fills the screen.
     - rises from below while closed (gilded leather cover facing you), the cover swings
       open around the spine, the book settles and sways gently in your hands
     - tap / click the right page → next, the left page → back: the leaf lifts from its
       outer edge and curls (6 hinged strips, the outer edge leads), lands flat
     - last spread: tapping the right page closes the book (the left half folds over) and
       lowers it; depth of field keeps the book sharp and the world softly blurred ]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Lighting = game:GetService("Lighting")
local State = require(script.Parent.State)
local VM = require(script.Parent.Viewmodel)
local Sound = require(script.Parent.Sound)

local Book = {}
local cam = workspace.CurrentCamera
local W, H = 1.6, 2.2 -- page size (studs)
local PPU = 420
local NS = 6 -- leaf strips
local PAPER = Color3.fromRGB(246, 236, 212)
local INK = Color3.fromRGB(58, 36, 20)
local BROWN = Color3.fromRGB(107, 58, 26)
local RUST = Color3.fromRGB(184, 71, 28)

local model, parts
local open, phase, t = false, "idle", 0
local k, spreads = 0, 5
local coverA = math.pi
local turn = nil :: any
local onDone: (() -> ())? = nil
local dof: DepthOfFieldEffect? = nil
local camCF = CFrame.new()

-- ---------------------------------------------------------------- page content
local function pages()
	local touch = State.isMobile
	local key = function(s) return "<font color=\"#6b3a1a\">[" .. s .. "]</font>" end
	return {
		{ plate = Players.LocalPlayer.DisplayName },
		{ letter = true, t = "Bienvenue !", s = "avant-propos", body = "Mon cher récolteur,\n\nCe désert est <b>fait de patates</b>. Des milliards. Ton travail est simple : <b>ramasser</b>, <b>verser dans le bac</b>, et regarder mon <b>bocal géant</b> se remplir.\n\nQuand il déborde… eh bien, il déborde. C’est le plus beau spectacle du canton." },
		{ t = "1. Ramasser", s = "à la main", art = "pick", body = "Vise une patate et " .. (if touch then "appuie sur <b>✋</b>" else key("Clic") .. " ou " .. key("E")) .. ". Elle saute dans tes mains. Sans gants, tu en portes <b>3</b>. Dessus, il n’y a que des <b>dorées</b>." },
		{ t = "2. Creuser", s = "les violettes", art = "dig", body = "Ramasse <b>toujours au même endroit</b> : le tas se creuse et une autre patate apparaît dessous. Plus tu creuses, plus tu as de chances de trouver une <b>violette</b>. Rare, et <b>25 fois plus chère</b> !" },
		{ t = "3. Seau & outils", s = "beaucoup plus vite", art = "bucket", body = "Achète un <b>seau</b> chez Gérard, puis <b>maintiens</b> : tout autour du point visé vole dedans. Plus tard : <b>aspirateur</b> et <b>canon</b>." .. (if touch then "" else " " .. key("1") .. key("2") .. key("3") .. key("4") .. " ou la molette.") },
		{ t = "4. Le bac", s = "verser la récolte", art = "bin", body = "Approche-toi du <b>bac en bois</b> au pied du bocal, regarde-le et <b>maintiens</b> : tes patates s’envolent dedans." },
		{ t = "5. Le bocal", s = "le grand spectacle", art = "jar", body = "Le tapis monte la spirale jusqu’au sommet <b>en une seconde</b>. Chaque patate qui tombe dans le <b>bocal</b> te rapporte des francs. Plein ? Il <b>déborde</b> !" },
		{ t = "6. Chez Gérard", s = "la boutique", art = "shop", body = "Parle-moi au comptoir : <b>seaux</b>, <b>gants</b>, <b>râteau aimanté</b>, <b>moteur</b> du tapis, <b>engrais</b> et <b>contrats</b> qui multiplient tes gains." },
		{ t = "Multijoueur", s = "à plusieurs", art = "friends", body = "Tu joues dans <b>ton propre serveur</b>. Touche <b>👥</b> pour <b>inviter un ami</b> : il arrive directement dans ton désert, et vous remplissez le bocal ensemble." },
		{ letter = true, t = "Bonne récolte !", s = "dernier conseil", body = "Les patates <b>repoussent</b> toutes seules.\n\nEt la nuit, regarde le ciel : les <b>patates filantes</b> sont en or.\n\n<b>Touche cette page pour fermer le livre.</b>", sign = "— G." },
	}
end

local function lbl(parent, props)
	local t2 = Instance.new("TextLabel"); t2.BackgroundTransparency = 1; t2.TextColor3 = INK; t2.Font = Enum.Font.FredokaOne; t2.TextScaled = true; t2.RichText = true
	for a, b in props do (t2 :: any)[a] = b end
	t2.Parent = parent; return t2
end
local function dot(parent, x, y, r, col)
	local f = Instance.new("Frame"); f.AnchorPoint = Vector2.new(0.5, 0.5); f.Position = UDim2.fromScale(x, y); f.Size = UDim2.fromScale(r, r * 0.72); f.BackgroundColor3 = col
	local c = Instance.new("UICorner"); c.CornerRadius = UDim.new(0.5, 0); c.Parent = f
	local s = Instance.new("UIStroke"); s.Color = INK; s.Thickness = 2; s.Parent = f
	f.Parent = parent; return f
end
local function art(parent: Frame, kind: string)
	local box = Instance.new("Frame"); box.Position = UDim2.fromScale(0.08, 0.27); box.Size = UDim2.fromScale(0.84, 0.33); box.BackgroundColor3 = Color3.fromRGB(236, 214, 170); box.BackgroundTransparency = 0.2; box.Parent = parent
	local c = Instance.new("UICorner"); c.CornerRadius = UDim.new(0.06, 0); c.Parent = box
	local s = Instance.new("UIStroke"); s.Color = BROWN; s.Thickness = 2; s.Transparency = 0.4; s.Parent = box
	local GOLD, PURP = Color3.fromRGB(233, 184, 90), Color3.fromRGB(122, 74, 150)
	if kind == "dig" then
		for row = 0, 5 do for i = 0, 9 do
			local x, y = 0.06 + i * 0.098 + (row % 2) * 0.045, 0.12 + row * 0.155
			local inHole = math.abs(x - 0.5) < 0.22 - row * 0.03 and row < 4
			if not inHole then dot(box, x, y, 0.075, if row >= 3 and (i * 7 + row * 3) % 5 == 0 then PURP else GOLD) end
		end end
		dot(box, 0.5, 0.75, 0.09, PURP)
		lbl(box, { Position = UDim2.fromScale(0.62, -0.02), Size = UDim2.fromScale(0.36, 0.16), Text = "creuse ! ↓", Font = Enum.Font.PermanentMarker, TextColor3 = RUST })
		lbl(box, { Position = UDim2.fromScale(0.02, -0.02), Size = UDim2.fromScale(0.36, 0.16), Text = "rare = 25 ₣", Font = Enum.Font.PermanentMarker, TextColor3 = PURP })
	else
		local emo = ({ pick = "🥔  ✋", bucket = "🥔🥔🥔 → 🪣", bin = "🪣 → 📦", jar = "🥔 ⤴︎ 🫙", shop = "🧑‍🌾 🛒 ₣", friends = "🧑‍🌾 + 🧑‍🌾 = 🫙" })[kind] or "🥔"
		lbl(box, { Position = UDim2.fromScale(0.05, 0.1), Size = UDim2.fromScale(0.9, 0.62), Text = emo, Font = Enum.Font.FredokaOne })
		lbl(box, { Position = UDim2.fromScale(0.05, 0.74), Size = UDim2.fromScale(0.9, 0.2), Text = ({ pick = "clic / ✋", bucket = "maintenir", bin = "près du bac : maintenir !", jar = "ça déborde !", shop = "améliore tout !", friends = "invite tes amis" })[kind] or "", Font = Enum.Font.PermanentMarker, TextColor3 = RUST })
	end
end

-- one page as a GUI tree (pixel size W*PPU × H*PPU), optionally shifted left (for leaf strips)
local function buildPage(gui: SurfaceGui, p, idx: number, shiftPx: number)
	local f = Instance.new("Frame"); f.Size = UDim2.fromOffset(W * PPU, H * PPU); f.Position = UDim2.fromOffset(-shiftPx, 0); f.BackgroundColor3 = PAPER; f.BorderSizePixel = 0; f.Parent = gui
	local g = Instance.new("UIGradient"); g.Color = ColorSequence.new({ ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 255, 255)), ColorSequenceKeypoint.new(1, Color3.fromRGB(226, 208, 174)) }); g.Rotation = if idx % 2 == 0 then 0 else 180; g.Parent = f
	if not p then return f end
	if p.plate then
		f.BackgroundColor3 = Color3.fromRGB(140, 60, 40)
		local plate = Instance.new("Frame"); plate.AnchorPoint = Vector2.new(0.5, 0.5); plate.Position = UDim2.fromScale(0.5, 0.5); plate.Size = UDim2.fromScale(0.7, 0.42); plate.BackgroundColor3 = PAPER; plate.Parent = f
		local s = Instance.new("UIStroke"); s.Color = BROWN; s.Thickness = 5; s.Parent = plate
		lbl(plate, { Position = UDim2.fromScale(0.05, 0.06), Size = UDim2.fromScale(0.9, 0.2), Text = "EX-LIBRIS", Font = Enum.Font.PermanentMarker, TextColor3 = BROWN })
		lbl(plate, { Position = UDim2.fromScale(0.1, 0.3), Size = UDim2.fromScale(0.8, 0.28), Text = "🥔" })
		lbl(plate, { Position = UDim2.fromScale(0.05, 0.62), Size = UDim2.fromScale(0.9, 0.1), Text = "Ce manuel appartient à", Font = Enum.Font.Merriweather, TextColor3 = BROWN })
		lbl(plate, { Position = UDim2.fromScale(0.05, 0.75), Size = UDim2.fromScale(0.9, 0.17), Text = p.plate, Font = Enum.Font.PermanentMarker, TextColor3 = RUST })
		return f
	end
	local inner = Instance.new("Frame"); inner.Position = UDim2.fromScale(0.05, 0.035); inner.Size = UDim2.fromScale(0.9, 0.93); inner.BackgroundTransparency = 1; inner.Parent = f
	local st = Instance.new("UIStroke"); st.Color = BROWN; st.Thickness = 2; st.Transparency = 0.45; st.Parent = inner
	lbl(f, { Position = UDim2.fromScale(0.08, 0.07), Size = UDim2.fromScale(0.84, 0.09), Text = p.t, Font = Enum.Font.LuckiestGuy, TextColor3 = BROWN })
	lbl(f, { Position = UDim2.fromScale(0.2, 0.165), Size = UDim2.fromScale(0.6, 0.045), Text = "<i>" .. p.s .. "</i>", Font = Enum.Font.Merriweather, TextColor3 = Color3.fromRGB(140, 96, 60) })
	local line = Instance.new("Frame"); line.Position = UDim2.fromScale(0.3, 0.22); line.Size = UDim2.fromScale(0.4, 0.004); line.BackgroundColor3 = RUST; line.BorderSizePixel = 0; line.Parent = f
	if p.art then art(f, p.art) end
	local y0 = if p.art then 0.63 else 0.27
	lbl(f, { Position = UDim2.fromScale(0.1, y0), Size = UDim2.fromScale(0.8, 0.88 - y0), Text = p.body, TextScaled = false, TextSize = 30, TextWrapped = true, TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, Font = if p.letter then Enum.Font.PermanentMarker else Enum.Font.FredokaOne })
	if p.sign then lbl(f, { Position = UDim2.fromScale(0.55, 0.84), Size = UDim2.fromScale(0.35, 0.06), Text = p.sign, Font = Enum.Font.PermanentMarker, TextColor3 = BROWN, TextXAlignment = Enum.TextXAlignment.Right }) end
	lbl(f, { Position = UDim2.fromScale(0.4, 0.93), Size = UDim2.fromScale(0.2, 0.035), Text = "— " .. idx .. " —", Font = Enum.Font.PermanentMarker, TextColor3 = Color3.fromRGB(140, 96, 60) })
	return f
end

local PAGES
local function surface(part: BasePart, face: Enum.NormalId): SurfaceGui
	local g = Instance.new("SurfaceGui"); g.Face = face; g.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud; g.PixelsPerStud = PPU
	g.LightInfluence = 0.35; g.Brightness = 1; g.ClipsDescendants = true; g.Parent = part
	return g
end
local function setPage(g: SurfaceGui, idx: number, shiftPx: number)
	g:ClearAllChildren()
	buildPage(g, PAGES[idx + 1], idx, shiftPx)
end

local function mk(size, color, mat): BasePart
	local p = Instance.new("Part"); p.Anchored = true; p.CanCollide = false; p.CanQuery = false; p.CanTouch = false; p.CastShadow = false
	p.Size = size; p.Color = color; p.Material = mat or Enum.Material.SmoothPlastic; p.TopSurface = Enum.SurfaceType.Smooth; p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = model; return p
end

local function build()
	PAGES = pages()
	spreads = math.ceil(#PAGES / 2)
	model = Instance.new("Model"); model.Name = "TutorialBook"; model.Parent = cam
	local LEATHER = Color3.fromRGB(110, 36, 22)
	parts = {}
	parts.coverL = mk(Vector3.new(W + 0.05, H + 0.08, 0.035), LEATHER, Enum.Material.Leather)
	parts.coverR = mk(Vector3.new(W + 0.05, H + 0.08, 0.035), LEATHER, Enum.Material.Leather)
	parts.blockL = mk(Vector3.new(W - 0.04, H - 0.02, 0.07), Color3.fromRGB(232, 218, 186))
	parts.blockR = mk(Vector3.new(W - 0.04, H - 0.02, 0.07), Color3.fromRGB(232, 218, 186))
	parts.pageL = mk(Vector3.new(W, H, 0.004), PAPER); parts.pageR = mk(Vector3.new(W, H, 0.004), PAPER)
	parts.spine = mk(Vector3.new(H + 0.08, 0.16, 0.16), LEATHER, Enum.Material.Leather); parts.spine.Shape = Enum.PartType.Cylinder
	parts.gL = surface(parts.pageL, Enum.NormalId.Back); parts.gR = surface(parts.pageR, Enum.NormalId.Back)
	-- the cover (outside of the left board, seen when the book is closed)
	local cg = surface(parts.coverL, Enum.NormalId.Front)
	local cf = Instance.new("Frame"); cf.Size = UDim2.fromScale(1, 1); cf.BackgroundColor3 = LEATHER; cf.Parent = cg
	local gr = Instance.new("UIGradient"); gr.Color = ColorSequence.new(Color3.fromRGB(130, 46, 26), Color3.fromRGB(70, 22, 12)); gr.Rotation = 60; gr.Parent = cf
	local border = Instance.new("Frame"); border.Position = UDim2.fromScale(0.06, 0.05); border.Size = UDim2.fromScale(0.88, 0.9); border.BackgroundTransparency = 1; border.Parent = cf
	local bs = Instance.new("UIStroke"); bs.Color = Color3.fromRGB(226, 182, 90); bs.Thickness = 6; bs.Parent = border
	local t1 = lbl(cf, { Position = UDim2.fromScale(0.1, 0.12), Size = UDim2.fromScale(0.8, 0.22), Text = "LE PETIT MANUEL\nDU RÉCOLTEUR", Font = Enum.Font.LuckiestGuy, TextColor3 = Color3.fromRGB(248, 214, 128) })
	local g2 = Instance.new("UIGradient"); g2.Color = ColorSequence.new({ ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 240, 176)), ColorSequenceKeypoint.new(0.5, Color3.fromRGB(216, 166, 64)), ColorSequenceKeypoint.new(1, Color3.fromRGB(168, 116, 28)) }); g2.Rotation = 90; g2.Parent = t1
	lbl(cf, { Position = UDim2.fromScale(0.25, 0.4), Size = UDim2.fromScale(0.5, 0.3), Text = "🥔" })
	lbl(cf, { Position = UDim2.fromScale(0.1, 0.82), Size = UDim2.fromScale(0.8, 0.06), Text = "<i>par Gérard Bouchard · 1987</i>", Font = Enum.Font.Merriweather, TextColor3 = Color3.fromRGB(240, 210, 150) })
	-- the turning leaf: NS hinged strips, front = right page slice, back = next left page slice
	parts.strips = {}
	for s = 0, NS - 1 do
		local p = mk(Vector3.new(W / NS + 0.002, H, 0.004), PAPER)
		parts.strips[s] = { p = p, front = surface(p, Enum.NormalId.Back), back = surface(p, Enum.NormalId.Front) }
	end
end

local function setSpread(n: number)
	setPage(parts.gL, 2 * n, 0); setPage(parts.gR, 2 * n + 1, 0)
end
local function startTurn(dir: number)
	local a, b, under
	if dir > 0 then a, b = 2 * k + 1, 2 * k + 2; under = 2 * k + 3; setPage(parts.gR, under, 0)
	else a, b = 2 * k - 1, 2 * k; under = 2 * k - 2; setPage(parts.gL, under, 0) end
	local sw = W / NS * PPU
	for s = 0, NS - 1 do
		local st = parts.strips[s]
		setPage(st.front, a, s * sw); setPage(st.back, b, (NS - 1 - s) * sw)
	end
	turn = { dir = dir, t = 0 }
	Sound.play("Page")
end

function Book.next()
	if phase ~= "read" or turn then return end
	if k >= spreads - 1 then phase = "outro"; t = 0; Sound.play("BookClose"); return end
	startTurn(1)
end
function Book.prev() if phase ~= "read" or turn or k <= 0 then return end; startTurn(-1) end

-- book frame in camera space
local function fitDistance(): number
	local fov = math.rad(cam.FieldOfView); local asp = cam.ViewportSize.X / math.max(1, cam.ViewportSize.Y)
	local th = math.tan(fov / 2)
	return math.max((2 * W + 0.1) / 0.94 / (2 * th * asp), (H + 0.1) / 0.86 / (2 * th), 1.2)
end
local function ease(x) x = math.clamp(x, 0, 1); return if x < 0.5 then 4 * x * x * x else 1 - (-2 * x + 2) ^ 3 / 2 end
local function easeOut(x) x = math.clamp(x, 0, 1); return 1 - (1 - x) ^ 3 end

local bookLocal = CFrame.new()
local function frame(dt: number)
	t += dt
	local d = fitDistance()
	local y, z, rx, ry, rz, x = 0, -d, -0.08, 0, 0, 0
	if phase == "intro" then
		local a, b = math.clamp(t / 0.75, 0, 1), math.clamp((t - 0.75) / 0.95, 0, 1)
		y = -2.6 * (1 - easeOut(a)) - 0.1 * (1 - b); z = -d - 0.3 * (1 - b); rx = -0.5 * (1 - easeOut(a)) - 0.08; ry = 0.25 * (1 - ease(b)); rz = 0.08 * (1 - easeOut(a))
		x = -W / 2 * (1 - ease(b)); coverA = math.pi * (1 - ease(b))
		if b > 0 and not Book._snd then Book._snd = true; Sound.play("Page") end
		if b >= 1 then phase = "read"; Book._snd = false end
	elseif phase == "outro" then
		local a, b = math.clamp(t / 0.7, 0, 1), math.clamp((t - 0.6) / 0.6, 0, 1)
		coverA = math.pi * ease(a); x = -W / 2 * ease(a)
		y = -2.8 * ease(b); rx = -0.08 - 0.6 * ease(b); rz = -0.1 * ease(b)
		if b >= 1 then Book.finish(); return end
	end
	local tt = os.clock()
	y += math.sin(tt * 1.3) * 0.012; rz += math.sin(tt * 0.9) * 0.008; rx += math.sin(tt * 1.1) * 0.006
	bookLocal = CFrame.new(x, y - 0.02, z) * CFrame.Angles(rx, ry, rz)
	local B = camCF * bookLocal
	local list, cfs = {}, {}
	local function put(p, cf) table.insert(list, p); table.insert(cfs, cf) end
	-- right half (fixed), left half (rotates around the spine: coverA = π closed, 0 open)
	put(parts.coverR, B * CFrame.new(W / 2 + 0.02, 0, -0.1))
	put(parts.blockR, B * CFrame.new(W / 2 + 0.02, 0, -0.045))
	put(parts.pageR, B * CFrame.new(W / 2, 0, 0.0))
	local L = B * CFrame.Angles(0, coverA * 0.999, 0)
	put(parts.coverL, L * CFrame.new(-W / 2 - 0.02, 0, -0.1))
	put(parts.blockL, L * CFrame.new(-W / 2 - 0.02, 0, -0.045))
	put(parts.pageL, L * CFrame.new(-W / 2, 0, 0.0))
	put(parts.spine, B * CFrame.new(0, 0, -0.1) * CFrame.Angles(0, 0, math.pi / 2))
	-- turning leaf
	local sw = W / NS
	if turn then
		turn.t += dt / 0.8
		local kk = ease(turn.t)
		local th = if turn.dir > 0 then kk * math.pi else (1 - kk) * math.pi
		local curl = if turn.dir > 0 then 0.55 else -0.55
		local px, pz = 0, 0
		for s = 0, NS - 1 do
			local u = (s + 0.5) / NS
			local a = th + curl * math.sin(th) * u ^ 1.4
			local cx, cz = px + math.cos(a) * sw / 2, pz + math.sin(a) * sw / 2
			put(parts.strips[s].p, B * CFrame.new(cx, 0, cz + 0.012) * CFrame.Angles(0, -a, 0))
			px += math.cos(a) * sw; pz += math.sin(a) * sw
		end
		if turn.t >= 1 then
			k += turn.dir; turn = nil; setSpread(k)
		end
	else
		for s = 0, NS - 1 do put(parts.strips[s].p, CFrame.new(0, -1000, 0)) end
	end
	workspace:BulkMoveTo(list, cfs, Enum.BulkMoveMode.FireCFrameChanged)
end

-- hands holding the bottom corners (thumbs on the pages)
local function hold(side: number)
	local w = bookLocal * CFrame.new(side * (W + 0.02), -H / 2 + 0.1, -0.18)
	local f = (bookLocal.Rotation * Vector3.new(-side * 0.45, 1, 0.1)).Unit -- fingers up/inward behind the book
	local n = (bookLocal.Rotation * Vector3.new(0, 0, 1)).Unit -- palm faces the book's back
	local Z = -f; local Y = -n; local X = Y:Cross(Z).Unit; Y = Z:Cross(X).Unit
	return w.Position, CFrame.fromMatrix(Vector3.zero, X, Y, Z), 0.12
end

function Book.show(done: (() -> ())?)
	if open then return end
	if not model then build() end
	open = true; phase = "intro"; t = 0; k = 0; turn = nil; coverA = math.pi; onDone = done
	setSpread(0)
	State.mode = "book"
	camCF = cam.CFrame
	cam.CameraType = Enum.CameraType.Scriptable; cam.CFrame = camCF
	dof = Instance.new("DepthOfFieldEffect"); dof.FocusDistance = fitDistance(); dof.InFocusRadius = 1.6; dof.FarIntensity = 0.75; dof.NearIntensity = 0; dof.Parent = Lighting
	VM.override = function(side) return hold(side) end
	RunService:BindToRenderStep("WMP_Book", Enum.RenderPriority.Camera.Value + 3, frame)
	Sound.play("Open")
end
function Book.finish()
	RunService:UnbindFromRenderStep("WMP_Book")
	open = false; phase = "idle"
	for _, p in model:GetChildren() do if p:IsA("BasePart") then p.CFrame = CFrame.new(0, -1000, 0) end end
	VM.override = nil
	if dof then dof:Destroy(); dof = nil end
	cam.CameraType = Enum.CameraType.Custom
	State.mode = "play"
	local cb = onDone; onDone = nil
	if cb then cb() end
end
function Book.isOpen() return open end

UserInputService.InputBegan:Connect(function(input, gp)
	if not open or phase ~= "read" then return end
	if input.KeyCode == Enum.KeyCode.Right or input.KeyCode == Enum.KeyCode.D then Book.next()
	elseif input.KeyCode == Enum.KeyCode.Left or input.KeyCode == Enum.KeyCode.A then Book.prev()
	elseif input.KeyCode == Enum.KeyCode.ButtonR1 then Book.next() elseif input.KeyCode == Enum.KeyCode.ButtonL1 then Book.prev()
	elseif input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
		if gp then return end
		if input.Position.X > cam.ViewportSize.X / 2 then Book.next() else Book.prev() end
	end
end)

return Book
