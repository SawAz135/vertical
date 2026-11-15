--[[
	Roblox Forge - game systems (client, StarterPlayerScripts).
	- Casino-style hatch cinematic: the egg drops in, shakes harder and harder,
	  cracks, rays spin up in the rarity colour, white flash, the pet pops out with
	  its rarity and its real chance ("1 sur N"). Rarer = longer suspense, screen
	  shake, colour pulse; Secret = rainbow. Tap to speed it up.
	- Wires the windows made in Forge GUI Studio by their names (EggOpen > Roll,
	  Inventory > Slots, Daily > Claim, Quests > Quest1.., Rebirth > DoRebirth,
	  CodesButton) and adds its own compact panel (pets, quests, gift, codes,
	  rebirth) so everything works even without GUI Studio.
	Every action is asked to the server (ForgeSystemsRemotes.Request): the client
	only shows results.
]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")
local Lighting = game:GetService("Lighting")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")
local folder = ReplicatedStorage:WaitForChild("ForgeSystems")
local cfg = require(folder:WaitForChild("Config"))
local L = require(folder:WaitForChild("Logic"))
local remotes = ReplicatedStorage:WaitForChild("ForgeSystemsRemotes")
local request = remotes:WaitForChild("Request")

local state = nil
local owned = {} -- pet ids already seen (for the "NOUVEAU" tag)
local onState = {} -- callbacks

local function hex(h) return Color3.fromHex(h or "#ffffff") end
local function tween(obj, t, props, style, dir)
	local tw = TweenService:Create(obj, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), props)
	tw:Play()
	return tw
end
local function new(class, props, children)
	local o = Instance.new(class)
	for k, v in props or {} do
		if k ~= "Parent" then o[k] = v end
	end
	for _, c in children or {} do c.Parent = o end
	if props and props.Parent then o.Parent = props.Parent end
	return o
end
local function corner(s, o) return new("UICorner", { CornerRadius = UDim.new(s or 0, o or 0) }) end
local function stroke(c, th, mode) return new("UIStroke", { Color = c or Color3.new(0, 0, 0), Thickness = th or 3, ApplyStrokeMode = mode or Enum.ApplyStrokeMode.Border }) end
local function textStroke(th) return new("UIStroke", { Color = Color3.new(0, 0, 0), Thickness = th or 2.5, ApplyStrokeMode = Enum.ApplyStrokeMode.Contextual }) end
local function label(props)
	local t = new("TextLabel", { BackgroundTransparency = 1, Font = Enum.Font.FredokaOne, TextScaled = true, TextColor3 = Color3.new(1, 1, 1) })
	for k, v in props do t[k] = v end
	textStroke(2.5).Parent = t
	return t
end
local function rarityOf(petId)
	local def = L.petById(cfg, petId)
	local tier = def and L.tierOf(cfg, def.rarity) or 1
	return def, cfg.rarities[tier], tier
end

-- sounds: Roblox built-in files (replace with your own ids in Config.sounds)
local SOUNDS = cfg.sounds or { shake = "rbxasset://sounds/button.wav", reveal = "rbxasset://sounds/electronicpingshort.wav" }
local function sfx(name, pitch, vol)
	local id = SOUNDS[name]
	if not id or id == "" then return end
	local s = new("Sound", { SoundId = id, Volume = vol or 0.6, PlaybackSpeed = pitch or 1, Parent = workspace.CurrentCamera })
	s:Play()
	s.Ended:Once(function() s:Destroy() end)
	task.delay(5, function() if s.Parent then s:Destroy() end end)
end

------------------------------------------------------------------ UI root
local ui = new("ScreenGui", { Name = "ForgeSystemsUI", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 40, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, Parent = playerGui })

-- toasts
local toastBox = new("Frame", { Name = "Toasts", BackgroundTransparency = 1, Size = UDim2.new(0.5, 0, 0.3, 0), Position = UDim2.new(0.5, 0, 0.12, 0), AnchorPoint = Vector2.new(0.5, 0), Parent = ui }, {
	new("UIListLayout", { HorizontalAlignment = Enum.HorizontalAlignment.Center, Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }),
})
local toastN = 0
local function toast(text, kind)
	toastN += 1
	local c = kind == "bad" and Color3.fromRGB(255, 70, 70) or kind == "good" and Color3.fromRGB(80, 220, 90) or Color3.fromRGB(60, 150, 255)
	local f = new("Frame", { Size = UDim2.new(1, 0, 0, 40), BackgroundColor3 = c, LayoutOrder = toastN, Parent = toastBox }, { corner(0, 10), stroke(Color3.new(0, 0, 0), 3), new("UIScale", { Scale = 0.4 }) })
	label({ Text = text, Size = UDim2.new(0.94, 0, 0.72, 0), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), Parent = f })
	tween(f.UIScale, 0.35, { Scale = 1 }, Enum.EasingStyle.Back)
	task.delay(2.6, function()
		tween(f.UIScale, 0.25, { Scale = 0 }, Enum.EasingStyle.Back, Enum.EasingDirection.In)
		task.wait(0.26)
		f:Destroy()
	end)
end
remotes:WaitForChild("Notify").OnClientEvent:Connect(toast)

local function ask(action, a, b)
	local ok, res = pcall(request.InvokeServer, request, action, a, b)
	if not ok then toast("Connexion perdue", "bad") return { ok = false } end
	if not res.ok and res.err and not res.slow then toast(res.err, "bad") end
	return res
end

------------------------------------------------------------------ hatch cinematic
local busy = false
local queue = {}
local function cinematic(eggId, results)
	local egg = L.eggById(cfg, eggId)
	if not egg then return end
	busy = true
	local skip = false
	local cam = workspace.CurrentCamera
	local fov0 = cam.FieldOfView
	local blur = new("BlurEffect", { Size = 0, Parent = Lighting })
	local top = 1
	for _, r in results do
		local _, _, tier = rarityOf(r.pet)
		top = math.max(top, tier)
	end
	local topRar = cfg.rarities[top]
	local epic = top >= math.max(4, #cfg.rarities - 2) -- the 3 rarest tiers get the full show
	local gui = new("ScreenGui", { Name = "ForgeHatch", IgnoreGuiInset = true, DisplayOrder = 100, ResetOnSpawn = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, Parent = playerGui })
	local dim = new("TextButton", { Text = "", AutoButtonColor = false, Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 1, Parent = gui })
	dim.Activated:Connect(function() skip = true end)
	local tint = new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = hex(topRar.color), BackgroundTransparency = 1, ZIndex = 2, Parent = gui })
	local root = new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, ZIndex = 3, Parent = gui })
	local flash = new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 1, ZIndex = 50, Parent = gui })
	local function wait(t) if skip then t *= 0.25 end task.wait(t) end

	tween(dim, 0.35, { BackgroundTransparency = 0.35 })
	tween(blur, 0.5, { Size = 16 })
	tween(cam, 0.6, { FieldOfView = fov0 - 12 }, Enum.EasingStyle.Sine)

	-- one column per egg (1 or 3)
	local n = #results
	local cols = {}
	for i, r in results do
		local x = n == 1 and 0.5 or (0.2 + (i - 1) * 0.3)
		local col = new("Frame", { Size = UDim2.fromScale(n == 1 and 0.36 or 0.28, 0.6), Position = UDim2.fromScale(x, 0.48), AnchorPoint = Vector2.new(0.5, 0.5), BackgroundTransparency = 1, ZIndex = 4, Parent = root }, {
			new("UIAspectRatioConstraint", { AspectRatio = 0.8 }),
		})
		-- rays (hidden until the crack)
		local rays = new("Frame", { Size = UDim2.fromScale(2.2, 2.2), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), BackgroundTransparency = 1, ZIndex = 4, Parent = col })
		local _, rar, tier = rarityOf(r.pet)
		for k = 0, 11 do
			local arm = new("Frame", { Size = UDim2.new(0, 0, 0.5, 0), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 1), Rotation = k * 30, BackgroundColor3 = hex(rar.color), BackgroundTransparency = 0.15, BorderSizePixel = 0, ZIndex = 4, Parent = rays }, {
				new("UIGradient", { Rotation = 90, Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.6, 0.4), NumberSequenceKeypoint.new(1, 0) }) }),
			})
			arm.Name = "Ray" .. k
		end
		local glow = new("Frame", { Size = UDim2.fromScale(1.15, 1.1), Position = UDim2.fromScale(0.5, 0.52), AnchorPoint = Vector2.new(0.5, 0.5), BackgroundColor3 = hex(egg.color), BackgroundTransparency = 1, ZIndex = 5, Parent = col }, { corner(0.5, 0) })
		-- the egg: an oval with a highlight and a thick outline
		local shell = new("Frame", { Size = UDim2.fromScale(0.78, 0.92), Position = UDim2.fromScale(0.5, -1.2), AnchorPoint = Vector2.new(0.5, 0.5), BackgroundColor3 = hex(egg.color), ZIndex = 6, Parent = col }, {
			corner(0.5, 0), stroke(Color3.new(0, 0, 0), 5),
			new("UIGradient", { Rotation = 35, Color = ColorSequence.new({ ColorSequenceKeypoint.new(0, Color3.new(1, 1, 1)), ColorSequenceKeypoint.new(0.35, hex(egg.color)), ColorSequenceKeypoint.new(1, hex(egg.color):Lerp(Color3.new(0, 0, 0), 0.35)) }) }),
			new("UIScale", { Scale = 1 }),
		})
		label({ Text = egg.emoji or "🥚", Size = UDim2.fromScale(0.45, 0.3), Position = UDim2.fromScale(0.5, 0.62), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 7, Parent = shell })
		cols[i] = { col = col, rays = rays, shell = shell, glow = glow, r = r, rar = rar, tier = tier, cracks = {} }
	end

	-- 1. drop in with a squash
	for i, c in cols do
		task.delay((i - 1) * 0.08, function()
			tween(c.shell, 0.55, { Position = UDim2.fromScale(0.5, 0.5) }, Enum.EasingStyle.Back)
			task.wait(0.5)
			local sc = c.shell.UIScale
			tween(sc, 0.08, { Scale = 0.86 })
			task.wait(0.08)
			tween(sc, 0.3, { Scale = 1 }, Enum.EasingStyle.Elastic)
		end)
	end
	wait(0.75 + (n - 1) * 0.08)

	-- 2. suspense: shakes that get stronger and faster, cracks appear, the glow teases the rarity
	local shakes = 3 + math.min(5, top)
	for s = 1, shakes do
		local k = s / shakes
		local amp = 5 + k * 16
		local dt = 0.36 - k * 0.22
		sfx("shake", 0.8 + k * 0.7, 0.4)
		for _, c in cols do
			tween(c.shell, dt * 0.45, { Rotation = (s % 2 == 0 and 1 or -1) * amp, Position = UDim2.new(0.5, (s % 2 == 0 and 1 or -1) * amp * 0.6, 0.5, 0) }, Enum.EasingStyle.Sine)
			-- a crack: thin dark line growing from a random point
			local crack = new("Frame", { Size = UDim2.new(0, 0, 0, 4), Position = UDim2.fromScale(0.3 + math.random() * 0.4, 0.25 + math.random() * 0.45), AnchorPoint = Vector2.new(0, 0.5), Rotation = math.random(-70, 70), BackgroundColor3 = Color3.fromRGB(25, 20, 30), BorderSizePixel = 0, ZIndex = 8, Parent = c.shell })
			tween(crack, dt, { Size = UDim2.new(0.18 + k * 0.22, 0, 0, 3 + k * 3) })
			table.insert(c.cracks, crack)
			-- glow: egg colour first, then the rarity colour for the last shakes of a rare pet
			local tease = k > 0.55 and c.tier >= 3
			c.glow.BackgroundColor3 = tease and hex(c.rar.color) or hex(egg.color)
			tween(c.glow, dt * 0.5, { BackgroundTransparency = 0.25 + (1 - k) * 0.5, Size = UDim2.fromScale(1.15 + k * 0.35, 1.1 + k * 0.35) })
		end
		if epic and k > 0.5 then
			tween(tint, dt * 0.5, { BackgroundTransparency = 0.82 })
			tween(root, dt * 0.4, { Position = UDim2.fromOffset(math.random(-8, 8) * k, math.random(-8, 8) * k) })
		end
		wait(dt)
		for _, c in cols do tween(c.glow, dt * 0.4, { BackgroundTransparency = 0.7 }) end
		if epic and k > 0.5 then tween(tint, dt * 0.4, { BackgroundTransparency = 1 }) end
	end
	if epic and not skip then wait(0.35) end -- the "it's going to be big" pause

	-- 3. burst: flash, shell shards, rays spin
	sfx("reveal", 0.7, 0.8)
	flash.BackgroundTransparency = 0
	tween(flash, 0.6, { BackgroundTransparency = 1 })
	tween(cam, 0.25, { FieldOfView = fov0 - 20 }, Enum.EasingStyle.Back)
	local spin = RunService.RenderStepped:Connect(function(dt)
		for _, c in cols do
			c.rays.Rotation += dt * (30 + c.tier * 12)
			if c.tier >= #cfg.rarities then -- Secret: rainbow rays
				local h = (os.clock() * 0.35) % 1
				for _, arm in c.rays:GetChildren() do arm.BackgroundColor3 = Color3.fromHSV((h + arm.Rotation / 360) % 1, 0.8, 1) end
			end
		end
	end)
	for _, c in cols do
		c.shell.Visible = false
		c.glow.BackgroundColor3 = hex(c.rar.color)
		tween(c.glow, 0.4, { BackgroundTransparency = 0.45, Size = UDim2.fromScale(1.6, 1.6) })
		for _, arm in c.rays:GetChildren() do tween(arm, 0.45 + math.random() * 0.2, { Size = UDim2.new(0, 14 + c.tier * 4, 0.5, 0) }, Enum.EasingStyle.Back) end
		-- shards
		for _ = 1, 10 do
			local a = math.random() * math.pi * 2
			local shard = new("Frame", { Size = UDim2.fromScale(0.09, 0.07), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), Rotation = math.random(0, 360), BackgroundColor3 = hex(egg.color), ZIndex = 9, Parent = c.col }, { stroke(Color3.new(0, 0, 0), 2.5) })
			tween(shard, 0.7, { Position = UDim2.fromScale(0.5 + math.cos(a) * 0.9, 0.5 + math.sin(a) * 0.9), Rotation = shard.Rotation + math.random(-260, 260), BackgroundTransparency = 1 }, Enum.EasingStyle.Quart)
			task.delay(0.72, function() shard:Destroy() end)
		end
		-- stars
		for _ = 1, 8 + c.tier * 2 do
			local a = math.random() * math.pi * 2
			local d = 0.6 + math.random() * 0.7
			local st = label({ Text = "✦", TextColor3 = hex(c.rar.color), Size = UDim2.fromScale(0.08, 0.08), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 10, Parent = c.col })
			tween(st, 0.9 + math.random() * 0.5, { Position = UDim2.fromScale(0.5 + math.cos(a) * d, 0.5 + math.sin(a) * d), TextTransparency = 1, Rotation = math.random(-180, 180) }, Enum.EasingStyle.Quart)
			task.delay(1.5, function() st:Destroy() end)
		end
	end
	if epic then
		for _ = 1, 6 do
			tween(root, 0.05, { Position = UDim2.fromOffset(math.random(-14, 14), math.random(-14, 14)) })
			task.wait(0.05)
		end
		tween(root, 0.1, { Position = UDim2.fromOffset(0, 0) })
		tween(tint, 0.2, { BackgroundTransparency = 0.7 })
		task.delay(0.25, function() tween(tint, 0.8, { BackgroundTransparency = 1 }) end)
	end
	tween(cam, 0.6, { FieldOfView = fov0 - 10 }, Enum.EasingStyle.Sine)

	-- 4. reveal: pet pops out, rarity, chance, NEW tag
	for _, c in cols do
		local def = L.petById(cfg, c.r.pet)
		local pet = label({ Text = def and def.emoji or "?", Size = UDim2.fromScale(0.85, 0.6), Position = UDim2.fromScale(0.5, 0.42), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 11, Parent = c.col })
		pet.UIStroke.Thickness = 4
		local sc = new("UIScale", { Scale = 0, Parent = pet })
		tween(sc, 0.55, { Scale = 1 }, Enum.EasingStyle.Back)
		task.spawn(function() -- gentle float
			local t0 = os.clock()
			while pet.Parent do
				pet.Position = UDim2.fromScale(0.5, 0.42 + math.sin((os.clock() - t0) * 2.4) * 0.02)
				pet.Rotation = math.sin((os.clock() - t0) * 1.7) * 4
				RunService.RenderStepped:Wait()
			end
		end)
		local rarL = label({ Text = string.upper(c.rar.name), TextColor3 = hex(c.rar.color), Size = UDim2.fromScale(1.3, 0.15), Position = UDim2.fromScale(0.5, 0.86), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 11, TextTransparency = 1, Parent = c.col })
		rarL.UIStroke.Thickness = 3.5
		if c.tier >= #cfg.rarities then
			local g = new("UIGradient", { Color = ColorSequence.new({ ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 80, 80)), ColorSequenceKeypoint.new(0.25, Color3.fromRGB(255, 220, 60)), ColorSequenceKeypoint.new(0.5, Color3.fromRGB(80, 255, 120)), ColorSequenceKeypoint.new(0.75, Color3.fromRGB(80, 170, 255)), ColorSequenceKeypoint.new(1, Color3.fromRGB(220, 90, 255)) }), Parent = rarL })
			rarL.TextColor3 = Color3.new(1, 1, 1)
			task.spawn(function() while rarL.Parent do g.Offset = Vector2.new(math.sin(os.clock() * 2) * 0.5, 0) RunService.RenderStepped:Wait() end end)
		end
		local chance = c.r.chance > 0 and ("1 sur " .. L.abbreviate(math.max(1, math.floor(1 / c.r.chance + 0.5)))) or ""
		local info = label({ Text = (def and def.name or "?") .. "  ·  " .. chance .. (c.r.forced and "  ·  PITY" or ""), Size = UDim2.fromScale(1.3, 0.08), Position = UDim2.fromScale(0.5, 0.98), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 11, TextTransparency = 1, Parent = c.col })
		task.delay(0.25, function()
			local rs = new("UIScale", { Scale = 2.2, Parent = rarL })
			tween(rarL, 0.3, { TextTransparency = 0 })
			tween(rs, 0.45, { Scale = 1 }, Enum.EasingStyle.Back)
			task.wait(0.2)
			tween(info, 0.3, { TextTransparency = 0 })
		end)
		if not owned[c.r.pet] then
			owned[c.r.pet] = true
			local tag = new("Frame", { Size = UDim2.fromScale(0.5, 0.11), Position = UDim2.fromScale(0.85, 0.12), AnchorPoint = Vector2.new(0.5, 0.5), Rotation = 12, BackgroundColor3 = Color3.fromRGB(255, 60, 60), ZIndex = 12, Parent = c.col }, { corner(0, 8), stroke(Color3.new(0, 0, 0), 3), new("UIScale", { Scale = 0 }) })
			label({ Text = "NOUVEAU !", Size = UDim2.fromScale(0.9, 0.75), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 13, Parent = tag })
			task.delay(0.6, function() tween(tag.UIScale, 0.4, { Scale = 1 }, Enum.EasingStyle.Back) end)
		end
	end
	wait(1.5 + math.min(top, 6) * 0.25)

	-- 5. out
	tween(cam, 0.5, { FieldOfView = fov0 }, Enum.EasingStyle.Sine)
	tween(blur, 0.4, { Size = 0 })
	tween(dim, 0.4, { BackgroundTransparency = 1 })
	for _, c in cols do
		tween(c.col, 0.35, { Position = c.col.Position + UDim2.fromScale(0, 0.08) })
		for _, d in c.col:GetDescendants() do
			if d:IsA("TextLabel") then tween(d, 0.3, { TextTransparency = 1 })
			elseif d:IsA("Frame") then tween(d, 0.3, { BackgroundTransparency = 1 })
			elseif d:IsA("UIStroke") then tween(d, 0.3, { Transparency = 1 }) end
		end
	end
	task.wait(0.45)
	spin:Disconnect()
	gui:Destroy()
	blur:Destroy()
	cam.FieldOfView = fov0
	busy = false
	local nextOne = table.remove(queue, 1)
	if nextOne then task.spawn(cinematic, nextOne[1], nextOne[2]) end
end
remotes:WaitForChild("Hatched").OnClientEvent:Connect(function(eggId, results)
	if busy then table.insert(queue, { eggId, results }) else task.spawn(cinematic, eggId, results) end
end)

------------------------------------------------------------------ built-in panel (works without GUI Studio)
local COL = { pink = { "#ff6fb5", "#e0157a" }, blue = { "#3fd0ff", "#1677ff" }, green = { "#7dff5a", "#1fbf2c" }, purple = { "#c46bff", "#7a1fe0" }, orange = { "#ffc23a", "#ff7b00" }, red = { "#ff5a5a", "#d61f1f" }, navy = { "#3b4170", "#1d2140" }, grey = { "#e6e6e6", "#9c9c9c" } }
local function grad(c) return new("UIGradient", { Rotation = 90, Color = ColorSequence.new(hex(c[1]), hex(c[2])) }) end
local function button(text, colors, props, onClick)
	local b = new("TextButton", { Text = "", AutoButtonColor = false, BackgroundColor3 = Color3.new(1, 1, 1) }, { corner(0, 8), grad(colors), stroke(Color3.new(0, 0, 0), 3), new("UIScale", { Scale = 1 }) })
	for k, v in props do b[k] = v end
	label({ Name = "Label", Text = text, Size = UDim2.fromScale(0.9, 0.7), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = b.ZIndex + 1, Parent = b })
	b.MouseEnter:Connect(function() tween(b.UIScale, 0.15, { Scale = 1.06 }) end)
	b.MouseLeave:Connect(function() tween(b.UIScale, 0.15, { Scale = 1 }) end)
	b.Activated:Connect(function()
		b.UIScale.Scale = 0.9
		tween(b.UIScale, 0.3, { Scale = 1 }, Enum.EasingStyle.Back)
		if onClick then onClick() end
	end)
	return b
end

local panel = new("Frame", { Name = "Panel", Size = UDim2.fromScale(0.5, 0.62), Position = UDim2.fromScale(0.5, 0.52), AnchorPoint = Vector2.new(0.5, 0.5), BackgroundColor3 = Color3.new(1, 1, 1), Visible = false, ZIndex = 20, Parent = ui }, {
	corner(0, 12), grad({ "#2a2f55", "#171a36" }), stroke(Color3.new(0, 0, 0), 4), new("UIAspectRatioConstraint", { AspectRatio = 1.45 }), new("UIScale", { Scale = 1 }),
})
local bar = new("Frame", { Size = UDim2.new(1, 0, 0.14, 0), BackgroundColor3 = Color3.new(1, 1, 1), ZIndex = 21, Parent = panel }, { corner(0, 12), grad(COL.purple), stroke(Color3.new(0, 0, 0), 4) })
local title = label({ Text = "Pets", Size = UDim2.fromScale(0.6, 0.66), Position = UDim2.fromScale(0.04, 0.5), AnchorPoint = Vector2.new(0, 0.5), TextXAlignment = Enum.TextXAlignment.Left, ZIndex = 22, Parent = bar })
local body = new("Frame", { Size = UDim2.fromScale(0.94, 0.8), Position = UDim2.fromScale(0.5, 0.17), AnchorPoint = Vector2.new(0.5, 0), BackgroundTransparency = 1, ZIndex = 21, Parent = panel })
local current = nil
local function closePanel()
	tween(panel.UIScale, 0.2, { Scale = 0 }, Enum.EasingStyle.Back, Enum.EasingDirection.In)
	task.delay(0.2, function() panel.Visible = false current = nil end)
end
button("✕", COL.red, { Size = UDim2.fromScale(0.1, 0.8), Position = UDim2.fromScale(0.985, 0.5), AnchorPoint = Vector2.new(1, 0.5), ZIndex = 23, Parent = bar }, closePanel).Size = UDim2.fromScale(0.09, 0.8)

local pages = {}
local petMode, renaming, tradeSel = "equip", nil, {}
local function show(name)
	for _, c in body:GetChildren() do c:Destroy() end
	current = name
	title.Text = ({ pets = "🐾 Mes pets", quests = "📜 Quêtes du jour", daily = "🎁 Cadeau du jour", codes = "🎟️ Codes", rebirth = "♻️ Rebirth", trade = "🤝 Échange", rename = "✏️ Renommer" })[name]
	pages[name]()
	if not panel.Visible then
		panel.Visible = true
		panel.UIScale.Scale = 0.3
		tween(panel.UIScale, 0.4, { Scale = 1 }, Enum.EasingStyle.Back)
	end
end
local function refresh() if current and current ~= "codes" and current ~= "rename" and panel.Visible then show(current) end end

function pages.pets()
	if not state then return end
	local n, eq = L.count(state)
	label({ Text = ("%d / %d pets · %d / %d équipés"):format(n, state.maxPets, eq, state.maxEquip), Size = UDim2.fromScale(0.6, 0.1), TextXAlignment = Enum.TextXAlignment.Left, ZIndex = 22, Parent = body })
	button("⭐ Meilleurs", COL.green, { Size = UDim2.fromScale(0.18, 0.1), Position = UDim2.fromScale(0.8, 0), AnchorPoint = Vector2.new(1, 0), ZIndex = 22, Parent = body }, function() ask("equipBest") end)
	button("💰 Vendre communs", COL.orange, { Size = UDim2.fromScale(0.2, 0.1), Position = UDim2.fromScale(1, 0), AnchorPoint = Vector2.new(1, 0), ZIndex = 22, Parent = body }, function()
		local r = ask("sellAll", 2)
		if r.ok then toast("+" .. L.abbreviate(r.value) .. " " .. cfg.main .. " (" .. r.n .. " pets)", "good") end
	end)
	button(petMode == "rename" and "✏️ Renommer : ON" or "✏️ Renommer", petMode == "rename" and COL.purple or COL.navy, { Size = UDim2.fromScale(0.2, 0.1), Position = UDim2.fromScale(0.58, 0), AnchorPoint = Vector2.new(1, 0), ZIndex = 22, Parent = body }, function()
		petMode = petMode == "rename" and "equip" or "rename"
		show("pets")
	end)
	local grid = new("ScrollingFrame", { Size = UDim2.fromScale(1, 0.86), Position = UDim2.fromScale(0, 0.14), BackgroundTransparency = 1, ScrollBarThickness = 6, AutomaticCanvasSize = Enum.AutomaticSize.Y, CanvasSize = UDim2.new(), ZIndex = 22, Parent = body }, {
		new("UIGridLayout", { CellSize = UDim2.fromScale(0.15, 0.32), CellPadding = UDim2.fromScale(0.012, 0.03), SortOrder = Enum.SortOrder.LayoutOrder }),
	})
	local list = {}
	for uid, p in state.pets do
		local def, rar, tier = rarityOf(p.id)
		table.insert(list, { uid = uid, p = p, def = def, rar = rar, tier = tier })
	end
	table.sort(list, function(a, b)
		if a.p.eq ~= b.p.eq then return a.p.eq end
		if a.tier ~= b.tier then return a.tier > b.tier end
		return a.uid < b.uid
	end)
	for i, it in list do
		local slot = button(it.def and it.def.emoji or "?", { "#3b4170", "#1d2140" }, { LayoutOrder = i, ZIndex = 23, Parent = grid }, function()
			if petMode == "rename" then renaming = it.uid show("rename") return end
			ask(it.p.eq and "unequip" or "equip", it.uid)
		end)
		if it.p.nick then label({ Text = it.p.nick, Size = UDim2.fromScale(1.1, 0.22), Position = UDim2.fromScale(0.5, 1.02), AnchorPoint = Vector2.new(0.5, 1), ZIndex = 26, Parent = slot }) end
		slot.UIStroke.Color = hex(it.rar.color)
		slot.UIStroke.Thickness = it.p.eq and 4 or 2.5
		if it.p.eq then label({ Text = "✔", TextColor3 = Color3.fromRGB(125, 255, 90), Size = UDim2.fromScale(0.35, 0.35), Position = UDim2.fromScale(1, 0), AnchorPoint = Vector2.new(0.8, 0.2), ZIndex = 25, Parent = slot }) end
		if not it.p.eq then
			button("$", COL.orange, { Size = UDim2.fromScale(0.34, 0.3), Position = UDim2.fromScale(0, 1), AnchorPoint = Vector2.new(0.2, 0.8), ZIndex = 25, Parent = slot }, function()
				local r = ask("sell", it.uid)
				if r.ok then toast("+" .. L.abbreviate(r.value) .. " " .. cfg.main, "good") end
			end)
		end
	end
end

function pages.quests()
	if not state then return end
	local box = new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, ZIndex = 22, Parent = body }, { new("UIListLayout", { Padding = UDim.new(0.025, 0), SortOrder = Enum.SortOrder.LayoutOrder }) })
	for i, q in cfg.quests do
		local prog = state.quests.progress[q.id] or 0
		local done, claimed = prog >= q.target, state.quests.claimed[q.id]
		local row = new("Frame", { Size = UDim2.fromScale(1, 0.22), BackgroundColor3 = Color3.new(1, 1, 1), LayoutOrder = i, ZIndex = 22, Parent = box }, { corner(0, 10), grad(done and COL.green or COL.navy), stroke(Color3.new(0, 0, 0), 3) })
		label({ Text = q.name, Size = UDim2.fromScale(0.55, 0.42), Position = UDim2.fromScale(0.03, 0.08), TextXAlignment = Enum.TextXAlignment.Left, ZIndex = 23, Parent = row })
		local barBg = new("Frame", { Size = UDim2.fromScale(0.55, 0.3), Position = UDim2.fromScale(0.03, 0.6), BackgroundColor3 = Color3.fromRGB(15, 15, 30), ZIndex = 23, Parent = row }, { corner(1, 0), stroke(Color3.new(0, 0, 0), 2) })
		new("Frame", { Size = UDim2.fromScale(math.clamp(prog / q.target, 0, 1), 1), BackgroundColor3 = Color3.fromRGB(255, 210, 50), ZIndex = 24, Parent = barBg }, { corner(1, 0) })
		label({ Text = L.abbreviate(prog) .. " / " .. L.abbreviate(q.target), Size = UDim2.fromScale(1, 0.9), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 25, Parent = barBg })
		if claimed then
			label({ Text = "✔ Réclamé", Size = UDim2.fromScale(0.34, 0.5), Position = UDim2.fromScale(0.97, 0.5), AnchorPoint = Vector2.new(1, 0.5), ZIndex = 23, Parent = row })
		else
			button("+" .. L.abbreviate(q.amount) .. " " .. q.currency, done and COL.green or COL.grey, { Size = UDim2.fromScale(0.34, 0.62), Position = UDim2.fromScale(0.97, 0.5), AnchorPoint = Vector2.new(1, 0.5), ZIndex = 23, Parent = row }, function()
				local r = ask("claimQuest", q.id)
				if r.ok then toast("🎉 +" .. L.abbreviate(r.amount) .. " " .. r.currency, "good") end
			end)
		end
	end
end

local function claimDaily()
	local r = ask("daily")
	if r.ok then toast(("🎁 Jour %d : +%s %s"):format(r.day, L.abbreviate(r.amount), r.currency), "good") end
end
function pages.daily()
	if not state then return end
	local grid = new("Frame", { Size = UDim2.fromScale(1, 0.72), BackgroundTransparency = 1, ZIndex = 22, Parent = body }, { new("UIGridLayout", { CellSize = UDim2.fromScale(0.13, 0.9), CellPadding = UDim2.fromScale(0.012, 0), HorizontalAlignment = Enum.HorizontalAlignment.Center, SortOrder = Enum.SortOrder.LayoutOrder }) })
	local N = #cfg.daily
	local nextDay = state.daily.ready and state.daily.next or nil
	local done = state.daily.ready and ((state.daily.next or 1) - 1) or (state.daily.streak > 0 and ((state.daily.streak - 1) % N) + 1 or 0)
	local colors = { COL.orange, COL.pink, COL.blue, COL.orange, COL.green, COL.pink, COL.purple }
	for i, d in cfg.daily do
		local f = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), LayoutOrder = i, ZIndex = 22, Parent = grid }, { corner(0, 10), grad(colors[(i - 1) % #colors + 1]), stroke(i == nextDay and Color3.new(1, 1, 1) or Color3.new(0, 0, 0), i == nextDay and 4 or 3) })
		label({ Text = "Jour " .. i, Size = UDim2.fromScale(0.9, 0.2), Position = UDim2.fromScale(0.5, 0.05), AnchorPoint = Vector2.new(0.5, 0), ZIndex = 23, Parent = f })
		label({ Text = L.abbreviate(d.amount) .. "\n" .. d.currency, Size = UDim2.fromScale(0.9, 0.4), Position = UDim2.fromScale(0.5, 0.55), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 23, Parent = f })
		if i <= done then label({ Text = "✔", TextColor3 = Color3.fromRGB(125, 255, 90), Size = UDim2.fromScale(0.6, 0.25), Position = UDim2.fromScale(0.5, 0.95), AnchorPoint = Vector2.new(0.5, 1), ZIndex = 24, Parent = f }) end
	end
	button(state.daily.ready and "🎁 Récupérer" or "⏳ Reviens demain", state.daily.ready and COL.green or COL.grey, { Size = UDim2.fromScale(0.5, 0.18), Position = UDim2.fromScale(0.5, 1), AnchorPoint = Vector2.new(0.5, 1), ZIndex = 22, Parent = body }, claimDaily)
end

function pages.codes()
	local box = new("TextBox", { Text = "", PlaceholderText = "Écris un code…", ClearTextOnFocus = false, Font = Enum.Font.FredokaOne, TextScaled = true, TextColor3 = Color3.new(1, 1, 1), PlaceholderColor3 = Color3.fromRGB(170, 175, 210), BackgroundColor3 = Color3.fromRGB(15, 16, 36), Size = UDim2.fromScale(0.8, 0.22), Position = UDim2.fromScale(0.5, 0.25), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 22, Parent = body }, { corner(0, 10), stroke(Color3.new(0, 0, 0), 3), new("UIPadding", { PaddingLeft = UDim.new(0.04, 0), PaddingRight = UDim.new(0.04, 0) }) })
	button("🎟️ Utiliser", COL.green, { Size = UDim2.fromScale(0.45, 0.2), Position = UDim2.fromScale(0.5, 0.62), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 22, Parent = body }, function()
		local r = ask("redeem", box.Text)
		if r.ok then toast("🎉 +" .. L.abbreviate(r.amount) .. " " .. r.currency, "good") box.Text = "" end
	end)
end

local function doRebirth()
	local r = ask("rebirth")
	if r.ok then toast("♻️ Rebirth " .. r.rebirths .. " !", "good") end
end
function pages.rebirth()
	if not state then return end
	local rb = cfg.rebirth
	label({ Text = tostring(state.rebirths) .. "  ➜  " .. tostring(state.rebirths + 1), Size = UDim2.fromScale(0.8, 0.26), Position = UDim2.fromScale(0.5, 0.02), AnchorPoint = Vector2.new(0.5, 0), ZIndex = 22, Parent = body })
	label({ Text = ("Coûte %s %s · gains ×%s ensuite"):format(L.abbreviate(state.rebirthCost), rb.currency, string.format("%.1f", 1 + (state.rebirths + 1) * rb.step)), TextColor3 = Color3.fromRGB(255, 140, 140), Size = UDim2.fromScale(0.9, 0.12), Position = UDim2.fromScale(0.5, 0.33), AnchorPoint = Vector2.new(0.5, 0), ZIndex = 22, Parent = body })
	local have = state.currencies[rb.currency] or 0
	local barBg = new("Frame", { Size = UDim2.fromScale(0.9, 0.14), Position = UDim2.fromScale(0.5, 0.52), AnchorPoint = Vector2.new(0.5, 0), BackgroundColor3 = Color3.fromRGB(15, 15, 30), ZIndex = 22, Parent = body }, { corner(1, 0), stroke(Color3.new(0, 0, 0), 3) })
	new("Frame", { Size = UDim2.fromScale(math.clamp(have / state.rebirthCost, 0, 1), 1), BackgroundColor3 = Color3.new(1, 1, 1), ZIndex = 23, Parent = barBg }, { corner(1, 0), grad(COL.green) })
	label({ Text = L.abbreviate(have) .. " / " .. L.abbreviate(state.rebirthCost), Size = UDim2.fromScale(1, 0.85), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 24, Parent = barBg })
	button("♻️ Rebirth", have >= state.rebirthCost and COL.green or COL.grey, { Size = UDim2.fromScale(0.45, 0.2), Position = UDim2.fromScale(0.5, 1), AnchorPoint = Vector2.new(0.5, 1), ZIndex = 22, Parent = body }, doRebirth)
end

function pages.rename()
	local p = state and renaming and state.pets[renaming]
	if not p then show("pets") return end
	local def = L.petById(cfg, p.id)
	label({ Text = (def and def.emoji or "?") .. "  " .. (def and def.name or ""), Size = UDim2.fromScale(0.8, 0.2), Position = UDim2.fromScale(0.5, 0.02), AnchorPoint = Vector2.new(0.5, 0), ZIndex = 22, Parent = body })
	local box = new("TextBox", { Text = p.nick or "", PlaceholderText = "Nouveau nom (20 max)", ClearTextOnFocus = false, Font = Enum.Font.FredokaOne, TextScaled = true, TextColor3 = Color3.new(1, 1, 1), PlaceholderColor3 = Color3.fromRGB(170, 175, 210), BackgroundColor3 = Color3.fromRGB(15, 16, 36), Size = UDim2.fromScale(0.8, 0.2), Position = UDim2.fromScale(0.5, 0.42), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 22, Parent = body }, { corner(0, 10), stroke(Color3.new(0, 0, 0), 3), new("UIPadding", { PaddingLeft = UDim.new(0.04, 0), PaddingRight = UDim.new(0.04, 0) }) })
	label({ Text = "Le nom est vérifié par le filtre Roblox", TextColor3 = Color3.fromRGB(190, 195, 230), Size = UDim2.fromScale(0.8, 0.08), Position = UDim2.fromScale(0.5, 0.58), AnchorPoint = Vector2.new(0.5, 0), ZIndex = 22, Parent = body })
	button("✔ Valider", COL.green, { Size = UDim2.fromScale(0.4, 0.18), Position = UDim2.fromScale(0.28, 0.96), AnchorPoint = Vector2.new(0.5, 1), ZIndex = 22, Parent = body }, function()
		local r = ask("rename", renaming, box.Text)
		if r.ok then toast(r.nick and ("✏️ " .. r.nick) or "Nom retiré", "good") show("pets") end
	end)
	button("Retour", COL.grey, { Size = UDim2.fromScale(0.4, 0.18), Position = UDim2.fromScale(0.72, 0.96), AnchorPoint = Vector2.new(0.5, 1), ZIndex = 22, Parent = body }, function() show("pets") end)
end

function pages.trade()
	if not state then return end
	local t = state.trade
	if not t then
		label({ Text = "Invite un joueur. L'échange s'ouvre quand il t'invite aussi.", Size = UDim2.fromScale(1, 0.12), ZIndex = 22, TextWrapped = true, Parent = body })
		local list = new("ScrollingFrame", { Size = UDim2.fromScale(1, 0.84), Position = UDim2.fromScale(0, 0.16), BackgroundTransparency = 1, ScrollBarThickness = 6, AutomaticCanvasSize = Enum.AutomaticSize.Y, CanvasSize = UDim2.new(), ZIndex = 22, Parent = body }, {
			new("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }) })
		local n = 0
		for _, other in Players:GetPlayers() do
			if other ~= player then
				n += 1
				local row = new("Frame", { Size = UDim2.new(1, 0, 0, 44), BackgroundColor3 = Color3.new(1, 1, 1), LayoutOrder = n, ZIndex = 22, Parent = list }, { corner(0, 10), grad(COL.navy), stroke(Color3.new(0, 0, 0), 3) })
				label({ Text = other.DisplayName, Size = UDim2.fromScale(0.6, 0.6), Position = UDim2.fromScale(0.04, 0.5), AnchorPoint = Vector2.new(0, 0.5), TextXAlignment = Enum.TextXAlignment.Left, ZIndex = 23, Parent = row })
				button("🤝 Inviter", COL.green, { Size = UDim2.fromScale(0.3, 0.75), Position = UDim2.fromScale(0.97, 0.5), AnchorPoint = Vector2.new(1, 0.5), ZIndex = 23, Parent = row }, function()
					local r = ask("tradeRequest", other.UserId)
					if r.ok then toast(r.opened and "🤝 Échange ouvert !" or "Invitation envoyée", "good") end
				end)
			end
		end
		if n == 0 then label({ Text = "Personne d'autre sur le serveur", TextColor3 = Color3.fromRGB(190, 195, 230), Size = UDim2.new(1, 0, 0, 30), ZIndex = 23, Parent = list }) end
		return
	end
	tradeSel = {}
	for _, uid in t.mine do tradeSel[uid] = true end
	label({ Text = "Échange avec " .. t.with, Size = UDim2.fromScale(1, 0.1), ZIndex = 22, Parent = body })
	local function column(x, titleText, ready)
		label({ Text = titleText .. (ready and "  ✔ prêt" or ""), TextColor3 = ready and Color3.fromRGB(125, 255, 90) or Color3.new(1, 1, 1), Size = UDim2.fromScale(0.48, 0.08), Position = UDim2.fromScale(x, 0.11), ZIndex = 22, Parent = body })
		return new("ScrollingFrame", { Size = UDim2.fromScale(0.48, 0.58), Position = UDim2.fromScale(x, 0.2), BackgroundColor3 = Color3.fromRGB(15, 16, 36), BackgroundTransparency = 0.2, ScrollBarThickness = 5, AutomaticCanvasSize = Enum.AutomaticSize.Y, CanvasSize = UDim2.new(), ZIndex = 22, Parent = body }, {
			corner(0, 10), new("UIGridLayout", { CellSize = UDim2.fromScale(0.3, 0.28), CellPadding = UDim2.fromScale(0.03, 0.03), SortOrder = Enum.SortOrder.LayoutOrder }) })
	end
	local mine = column(0, "Ton offre (touche tes pets)", t.ready)
	local i = 0
	for uid, p in state.pets do
		if not p.eq then
			i += 1
			local def = L.petById(cfg, p.id)
			local on = tradeSel[uid]
			local b = button(def and def.emoji or "?", on and COL.green or { "#3b4170", "#1d2140" }, { LayoutOrder = on and i or 1000 + i, ZIndex = 23, Parent = mine }, function()
				tradeSel[uid] = not tradeSel[uid] or nil
				local list = {}
				for k in tradeSel do table.insert(list, k) end
				ask("tradeOffer", list)
			end)
			b.UIStroke.Color = hex(select(2, rarityOf(p.id)).color)
		end
	end
	local theirs = column(0.52, "Son offre", t.theirReady)
	for k, p in t.theirs do
		local def = L.petById(cfg, p.id)
		local f = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), LayoutOrder = k, ZIndex = 23, Parent = theirs }, { corner(0, 8), grad({ "#3b4170", "#1d2140" }), stroke(hex(select(2, rarityOf(p.id)).color), 3) })
		label({ Text = def and def.emoji or "?", Size = UDim2.fromScale(0.8, 0.8), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 24, Parent = f })
	end
	button(t.ready and "✔ Prêt" or "Prêt", t.ready and COL.grey or COL.green, { Size = UDim2.fromScale(0.45, 0.16), Position = UDim2.fromScale(0.25, 1), AnchorPoint = Vector2.new(0.5, 1), ZIndex = 22, Parent = body }, function()
		local r = ask("tradeReady")
		if r.done then toast("🤝 Échange terminé !", "good") end
	end)
	button("Annuler", COL.red, { Size = UDim2.fromScale(0.45, 0.16), Position = UDim2.fromScale(0.75, 1), AnchorPoint = Vector2.new(0.5, 1), ZIndex = 22, Parent = body }, function() ask("tradeCancel") end)
end

-- dock (right side)
local dock = new("Frame", { Name = "Dock", Size = UDim2.fromScale(0.07, 0.6), Position = UDim2.new(1, -10, 0.55, 0), AnchorPoint = Vector2.new(1, 0.5), BackgroundTransparency = 1, Parent = ui }, {
	new("UIListLayout", { Padding = UDim.new(0.02, 0), VerticalAlignment = Enum.VerticalAlignment.Center, SortOrder = Enum.SortOrder.LayoutOrder }),
})
for i, d in { { "pets", "🐾", COL.blue }, { "trade", "🤝", COL.green }, { "quests", "📜", COL.purple }, { "daily", "🎁", COL.pink }, { "codes", "🎟️", COL.green }, { "rebirth", "♻️", COL.orange } } do
	local b = button(d[2], d[3], { Name = d[1], Size = UDim2.fromScale(1, 0.15), LayoutOrder = i, Parent = dock }, function()
		if current == d[1] and panel.Visible then closePanel() else show(d[1]) end
	end)
	new("UIAspectRatioConstraint", { AspectRatio = 1, DominantAxis = Enum.DominantAxis.Width, Parent = b })
	if d[1] == "daily" then
		local dot = new("Frame", { Name = "Dot", Size = UDim2.fromScale(0.3, 0.3), Position = UDim2.fromScale(1, 0), AnchorPoint = Vector2.new(0.7, 0.3), BackgroundColor3 = Color3.fromRGB(255, 45, 45), Visible = false, ZIndex = 5, Parent = b }, { corner(1, 0), stroke(Color3.new(0, 0, 0), 2) })
		table.insert(onState, function(s) dot.Visible = s.daily.ready end)
	end
end

------------------------------------------------------------------ wiring to Forge GUI Studio windows
local function textOf(btn, text)
	local l = btn:FindFirstChild("Label")
	if l and l:IsA("TextLabel") then l.Text = text elseif btn:IsA("TextButton") then btn.Text = text end
end
local function nearestEgg()
	local char = player.Character
	local rootPart = char and char:FindFirstChild("HumanoidRootPart")
	local stands = workspace:FindFirstChild("ForgeEggStands")
	if not rootPart or not stands then return nil end
	local best, bestD = nil, math.huge
	for _, m in stands:GetChildren() do
		local shell = m:FindFirstChild("Egg")
		if shell and m:GetAttribute("ForgeEgg") then
			local d = (shell.Position - rootPart.Position).Magnitude
			if d < bestD then best, bestD = m:GetAttribute("ForgeEgg"), d end
		end
	end
	return best
end
local hooked = setmetatable({}, { __mode = "k" })
local function takeOver(btn, fn)
	if hooked[btn] then return end
	hooked[btn] = true
	btn:SetAttribute("ForgeAction", "system") -- ForgeGuiAnim keeps the animations, the server does the logic
	btn.Activated:Connect(fn)
end
local function windowOf(obj)
	local p = obj.Parent
	while p and not p:IsA("ScreenGui") do
		if p:IsA("GuiObject") and (p:GetAttribute("ForgeWindow") or p:GetAttribute("ForgeOpen")) then return p end
		p = p.Parent
	end
	return nil
end

local function wire(gui)
	if gui == ui or not gui:IsA("ScreenGui") then return end
	for _, d in gui:GetDescendants() do
		if d:IsA("GuiButton") then
			local w = windowOf(d)
			local wn = w and w.Name or ""
			if d.Name == "Roll" and wn:match("^EggOpen") then
				takeOver(d, function()
					local egg = nearestEgg()
					if not egg then toast("Approche-toi d'un œuf", "bad") return end
					ask("hatch", egg, 1)
				end)
			elseif d.Name == "Claim" and wn:match("^Daily") then
				takeOver(d, claimDaily)
			elseif d.Name == "DoRebirth" then
				takeOver(d, doRebirth)
			elseif d.Name == "CodesButton" then
				takeOver(d, function() show("codes") end)
			end
		end
	end
end
local function updateWindows()
	if not state then return end
	for _, gui in playerGui:GetChildren() do
		if gui:IsA("ScreenGui") and gui ~= ui and gui:GetAttribute("ForgeGui") then
			-- Inventory > Slots: one slot per pet (cloned from the first slot)
			local inv = gui:FindFirstChild("Inventory", true)
			local slots = inv and inv:FindFirstChild("Slots", true)
			if slots then
				local template = slots:FindFirstChild("ForgeSlotTemplate")
				if not template then
					local first = slots:FindFirstChild("Slot1")
					if first then
						template = first:Clone()
						template.Name = "ForgeSlotTemplate"
						template.Visible = false
						template.Parent = slots
					end
				end
				if template then
					for _, c in slots:GetChildren() do
						if c:IsA("GuiObject") and c ~= template then c:Destroy() end
					end
					local i = 0
					for uid, p in state.pets do
						i += 1
						local def, rar = rarityOf(p.id)
						local s = template:Clone()
						s.Name = "Pet_" .. uid
						s.Visible = true
						s.LayoutOrder = (p.eq and 0 or 10000) + i
						local icon = s:FindFirstChild("Icon", true)
						if icon then icon.Text = (def and def.emoji or "?") .. (p.eq and "✔" or "") end
						local st = s:FindFirstChildOfClass("UIStroke")
						if st then st.Color = hex(rar.color) st.Transparency = 0 end
						if s:IsA("GuiButton") then
							s:SetAttribute("ForgeAction", "system")
							s.Activated:Connect(function() ask(p.eq and "unequip" or "equip", uid) end)
						end
						s.Parent = slots
					end
				end
				local count = inv:FindFirstChild("Count", true)
				if count and count:IsA("TextLabel") then count.Text = ("%d / %d"):format(L.count(state), state.maxPets) end
			end
			-- Quests > Quest1..N: titles, rewards, bars
			local qw = gui:FindFirstChild("Quests", true)
			if qw then
				for i, q in cfg.quests do
					local row = qw:FindFirstChild("Quest" .. i, true)
					if row then
						local prog = state.quests.progress[q.id] or 0
						local t = row:FindFirstChild("Title", true)
						if t then t.Text = q.name end
						local rw = row:FindFirstChild("Reward", true)
						if rw then rw.Text = "+" .. L.abbreviate(q.amount) .. " " .. q.currency end
						local fill = row:FindFirstChild("Fill", true)
						if fill then fill.Size = UDim2.new(math.clamp(prog / q.target, 0, 1), 0, 1, 0) end
						local pr = row:FindFirstChild("Progress", true)
						if pr then pr.Text = state.quests.claimed[q.id] and "✔ RÉCLAMÉ" or (prog >= q.target and "TOUCHE POUR RÉCLAMER" or L.abbreviate(prog) .. " / " .. L.abbreviate(q.target)) end
						if not hooked[row] and row:IsA("GuiObject") then
							hooked[row] = true
							row.Active = true
							row.InputBegan:Connect(function(input)
								if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
									local r = ask("claimQuest", q.id)
									if r.ok then toast("🎉 +" .. L.abbreviate(r.amount) .. " " .. r.currency, "good") end
								end
							end)
						end
					end
				end
			end
			-- Daily > Claim label
			local dw = gui:FindFirstChild("Daily", true)
			if dw then
				for _, d in dw:GetDescendants() do
					if d.Name == "Claim" and d:IsA("GuiButton") then textOf(d, state.daily.ready and "🎁 Récupérer" or "⏳ Demain") end
				end
			end
		end
	end
end
for _, g in playerGui:GetChildren() do task.defer(wire, g) end
playerGui.ChildAdded:Connect(function(g) task.wait(0.2) wire(g) updateWindows() end)

------------------------------------------------------------------ state
remotes:WaitForChild("State").OnClientEvent:Connect(function(s)
	local firstTime = state == nil
	state = s
	if firstTime then
		for _, p in s.pets do owned[p.id] = true end
	end
	for _, f in onState do f(s) end
	updateWindows()
	refresh()
end)
task.delay(2, function() if not state then ask("state") end end)
