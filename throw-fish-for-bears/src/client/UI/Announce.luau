--[[ Announce: server-wide rare catch announcements.
     Every rare catch (Legendary+) = a coloured system line in the Roblox chat.
     IMPOSSIBLE only (Cosmic Bear / Cosmic Koi) = full-screen stud cinematic for
     everyone: dark vignette, rotating rays, studded rarity banner with the spinning
     3D model, "IMPOSSIBLE!!!" stamp, stud confetti, pillar of light on the catcher. ]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local TextChatService = game:GetService("TextChatService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local FishConfig = require(Shared.Config.FishConfig)
local BearConfig = require(Shared.Config.BearConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local Format = require(Shared.Util.Format)
local Sim = require(script.Parent.Sim)
local K = require(script.Parent.Kit)
local Sound = require(script.Parent.Parent.Controllers.Sound)
local Fx = require(script.Parent.Parent.Controllers.Fx)

local Announce = {}
local RGB = Color3.fromRGB
local new = Sim.new
local gui: ScreenGui
local queue = {}
local busy = false

local function tween(o, t, goal, style, dir)
	local tw = TweenService:Create(o, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), goal)
	tw:Play()
	return tw
end

local function rarityColor(rarity: string): Color3
	local tier = RarityConfig.get(rarity)
	return if tier.rainbow then Color3.fromHSV((os.clock() * 0.3) % 1, 0.6, 1) else tier.color
end

local function hex(c: Color3): string
	return string.format("%02X%02X%02X", math.floor(c.R * 255), math.floor(c.G * 255), math.floor(c.B * 255))
end

-- pillar of light on the catcher (seen from anywhere on the map)
local function pillar(userId: number, color: Color3, duration: number)
	local who = Players:GetPlayerByUserId(userId)
	local char = who and who.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then return end
	local beam = Instance.new("Part")
	beam.Name = "TFBRarePillar"
	beam.Anchored = true
	beam.CanCollide = false
	beam.CanQuery = false
	beam.CanTouch = false
	beam.CastShadow = false
	beam.Shape = Enum.PartType.Cylinder
	beam.Material = Enum.Material.Neon
	beam.Color = color
	beam.Size = Vector3.new(260, 5, 5)
	beam.Transparency = 1
	beam.Parent = workspace
	local core = beam:Clone()
	core.Size = Vector3.new(260, 2, 2)
	core.Color = Color3.new(1, 1, 1)
	core.Parent = workspace
	local light = Instance.new("PointLight")
	light.Color = color
	light.Range = 30
	light.Brightness = 2
	light.Parent = core
	local t0 = os.clock()
	local conn
	conn = RunService.RenderStepped:Connect(function()
		local t = os.clock() - t0
		local r = char.Parent and char:FindFirstChild("HumanoidRootPart")
		if t > duration or not r then
			conn:Disconnect()
			beam:Destroy()
			core:Destroy()
			return
		end
		-- grow in, breathe, fade out
		local k = math.min(1, t / 0.5) * math.clamp((duration - t) / 1.2, 0, 1)
		local cf = CFrame.new(r.Position + Vector3.new(0, 127, 0)) * CFrame.Angles(0, 0, math.pi / 2)
		beam.CFrame = cf
		core.CFrame = cf
		local w = 4 + math.sin(t * 6) * 0.8
		beam.Size = Vector3.new(260, w * k + 0.01, w * k + 0.01)
		beam.Transparency = 1 - 0.45 * k
		core.Transparency = 1 - 0.7 * k
	end)
	-- rising stud blocks around the catcher
	for i = 0, math.floor(duration / 0.5) do
		task.delay(i * 0.5, function()
			local r = char.Parent and char:FindFirstChild("HumanoidRootPart")
			if r then Fx.blocks(r.Position - Vector3.new(0, 2, 0), color, 6, 14, 0.6, { life = 1.4, up = 3, spread = 1.4, gravity = -2 }) end
		end)
	end
end

-- falling stud confetti over the whole screen
local function confetti(parent: GuiObject, colors, n: number)
	for _ = 1, n do
		local s = math.random(10, 20)
		local f = new("Frame", { BackgroundColor3 = colors[math.random(1, #colors)], Size = UDim2.fromOffset(s, s), BorderSizePixel = 0,
			Position = UDim2.new(math.random(), 0, -0.05 - math.random() * 0.25, 0), Rotation = math.random(0, 90), ZIndex = 60 }, parent)
		Sim.corner(f, 2)
		Sim.stroke(f, 1.5)
		-- the stud on top
		local stud = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.7, Size = UDim2.fromScale(0.5, 0.5),
			Position = UDim2.fromScale(0.25, 0.25), BorderSizePixel = 0, ZIndex = 61 }, f)
		Sim.corner(stud, 3)
		local dur = 1.8 + math.random() * 1.6
		tween(f, dur, { Position = UDim2.new(f.Position.X.Scale + (math.random() - 0.5) * 0.2, 0, 1.1, 0), Rotation = f.Rotation + math.random(-360, 360) },
			Enum.EasingStyle.Quad, Enum.EasingDirection.In)
		task.delay(dur, function() f:Destroy() end)
	end
end

local function chatLine(d)
	local name = if d.kind == "Fish" then FishConfig.get(d.id).name else BearConfig.get(d.id).name
	local tier = RarityConfig.get(d.rarity)
	local variant = if d.variant and d.variant ~= "Normal" then d.variant .. " " else ""
	local col = if tier.rainbow then "FF8CF0" elseif d.rarity == "Secret" then "B4B4C8" else hex(tier.textColor or tier.color)
	local verb = if d.kind == "Fish" then "caught" else "captured"
	pcall(function()
		local ch = TextChatService:FindFirstChild("TextChannels")
		local general = ch and ch:FindFirstChild("RBXGeneral")
		if general then
			general:DisplaySystemMessage(('<font color="#%s"><b>[%s]</b> %s %s a %s%s! (%s)</font>'):format(col, tier.name:upper(), d.player, verb, variant, name, Format.kg(d.weight or 0)))
		end
	end)
end

local function play(d)
	local tier = RarityConfig.get(d.rarity)
	local name = if d.kind == "Fish" then FishConfig.get(d.id).name else BearConfig.get(d.id).name
	local variant = if d.variant and d.variant ~= "Normal" then d.variant .. " " else ""
	local col = rarityColor(d.rarity)
	local big = true
	local epic = true
	local W, H = if epic then 760 elseif big then 660 else 580, if epic then 156 elseif big then 132 else 116

	local k = Sim.Motion.ScreenScale() -- same responsive factor as every stud window
	local layer = new("Frame", { Name = "Announce", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 50 }, gui)
	local vignette, rays
	if epic then
		vignette = new("Frame", { BackgroundColor3 = RGB(0, 0, 0), BackgroundTransparency = 1, Size = UDim2.fromScale(1.2, 1.2), Position = UDim2.fromScale(-0.1, -0.1), ZIndex = 50, BorderSizePixel = 0 }, layer)
		tween(vignette, 0.4, { BackgroundTransparency = 0.45 })
		-- rotating sun rays behind the banner
		rays = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(900 * k, 900 * k), Position = UDim2.new(0.5, 0, 0, (146 + H / 2) * k), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 51 }, layer)
		for i = 0, 11 do
			local ray = new("Frame", { BackgroundColor3 = col, BackgroundTransparency = 0.55, BorderSizePixel = 0, Size = UDim2.fromScale(0.066, 1),
				Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), Rotation = i * 15, ZIndex = 51 }, rays)
			new("UIGradient", { Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.5, 0.2), NumberSequenceKeypoint.new(1, 1) }) }, ray)
		end
		local rs = new("UIScale", { Scale = 0 }, rays)
		tween(rs, 0.6, { Scale = 1 }, Enum.EasingStyle.Back)
	end

	-- banner ---------------------------------------------------------------------------
	local holder = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(W, H + 40), Position = UDim2.new(0.5, 0, 0, (-H - 60) * k), AnchorPoint = Vector2.new(0.5, 0), ZIndex = 52 }, layer)
	local scale = new("UIScale", { Scale = k }, holder)
	local panel = Sim.panel(holder, { Size = UDim2.fromOffset(W, H), Position = UDim2.fromOffset(0, 26), Gradient = Sim.RARITY_CARD[d.rarity] or Sim.G.gold, Stroke = 4, ZIndex = 53, Clip = true })
	local grad = panel:FindFirstChildOfClass("UIGradient")
	Sim.bands(panel, 0.55, 54)
	K.shine(panel, if epic then 1.2 else 2)
	-- header tab
	local tab = Sim.panel(holder, { Size = UDim2.fromOffset(280, 34), Position = UDim2.fromOffset(W / 2 - 140, 6), Color = RGB(40, 40, 46), DarkStuds = true, ZIndex = 56 })
	Sim.text(tab, if epic then "★ SERVER ANNOUNCEMENT ★" else "SERVER ANNOUNCEMENT", { Size = UDim2.new(1, -16, 0.8, 0), Max = 20, ZIndex = 57, Gradient = { RGB(255, 240, 120), RGB(255, 170, 30) } })
	-- 3D model box
	local box = Sim.panel(panel, { Size = UDim2.fromOffset(H - 20, H - 20), Position = UDim2.fromOffset(10, 10), Color = RGB(36, 36, 42), DarkStuds = true, ZIndex = 55 })
	Sim.model(box, { kind = d.kind, id = d.id, variant = d.variant, spin = true, spinSpeed = 1.6, size = UDim2.fromScale(1.05, 1.05) })
	-- texts
	local tx = H
	local tw = W - tx - 16
	Sim.text(panel, ("%s %s"):format(d.player, if d.kind == "Fish" then "caught" else "captured"), { Size = UDim2.fromOffset(tw, H * 0.24), Position = UDim2.fromOffset(tx + tw / 2, H * 0.2),
		Max = 28, ZIndex = 58 })
	local rarityLabel = Sim.text(panel, tier.name:upper() .. "!", { Size = UDim2.fromOffset(tw, H * 0.34), Position = UDim2.fromOffset(tx + tw / 2, H * 0.48), Max = if epic then 60 else 48, Stroke = 4.5,
		Color = if d.rarity == "Secret" then RGB(30, 30, 36) else Color3.new(1, 1, 1), StrokeColor = if d.rarity == "Secret" then RGB(255, 255, 255) else nil,
		Gradient = if d.rarity == "Secret" then nil else { Color3.new(1, 1, 1), col }, ZIndex = 58 })
	Sim.infoBar(panel, ('%s%s  ·  <font color="#FFD23F">%s</font>'):format(variant, name, Format.kg(d.weight or 0)), { Size = UDim2.fromOffset(tw, H * 0.22), Position = UDim2.fromOffset(tx + tw / 2, H * 0.81),
		Max = 24, ZIndex = 57 })

	-- entrance: drop with overshoot, small tilt that settles, stud burst
	local target = UDim2.new(0.5, 0, 0, (if epic then 120 else 96) * k)
	holder.Rotation = -4
	tween(holder, 0.55, { Position = target }, Enum.EasingStyle.Back)
	tween(holder, 0.9, { Rotation = 0 }, Enum.EasingStyle.Elastic)
	Sound.play(if epic then "Reveal4" elseif big then "Reveal3" else "Reveal2")
	task.delay(0.45, function()
		if not layer.Parent then return end
		scale.Scale = k * 1.08
		tween(scale, 0.3, { Scale = k }, Enum.EasingStyle.Back)
		if big then confetti(layer, { col, RGB(255, 255, 255), RGB(255, 220, 60) }, if epic then 70 else 28) end
	end)
	if epic then
		-- "SECRET!" stamp slams in over the banner
		local stamp = Sim.text(layer, "IMPOSSIBLE!!!", { Size = UDim2.fromOffset(820, 110),
			Position = UDim2.new(0.5, 0, 0, (120 + H + 80) * k), Max = 96, Stroke = 6, Gradient = { RGB(255, 255, 255), col }, ZIndex = 62 })
		local ss = new("UIScale", { Scale = 3 }, stamp)
		stamp.TextTransparency = 1
		task.delay(0.7, function()
			if not stamp.Parent then return end
			stamp.TextTransparency = 0
			tween(ss, 0.28, { Scale = k }, Enum.EasingStyle.Back)
			Sound.play("Transform")
			-- UI shake
			for i = 1, 8 do
				task.delay(i * 0.03, function()
					if holder.Parent then holder.Position = target + UDim2.fromOffset(math.random(-8, 8), math.random(-6, 6)) end
				end)
			end
			task.delay(0.3, function() if holder.Parent then holder.Position = target end end)
		end)
		task.delay(4.6, function()
			if stamp.Parent then tween(stamp, 0.4, { TextTransparency = 1 }) end
		end)
	end
	if big then pillar(d.userId, col, if epic then 10 else 7) end

	-- live effects: rainbow cycling, ray spin, label pulse
	local alive = true
	local conn = RunService.RenderStepped:Connect(function(dt)
		if not alive then return end
		local t = os.clock()
		if tier.impossible and grad then
			-- cosmic: deep purple / night blue nebula that breathes, cyan-pink title
			grad.Color = ColorSequence.new(Color3.fromHSV(0.74 + math.sin(t * 1.3) * 0.06, 0.8, 0.62), Color3.fromHSV(0.64 + math.sin(t * 0.9) * 0.05, 0.9, 0.16))
			local g2 = rarityLabel:FindFirstChildOfClass("UIGradient")
			if g2 then g2.Color = ColorSequence.new(Color3.fromRGB(150, 240, 255), Color3.fromHSV(0.85 + math.sin(t * 2) * 0.08, 0.7, 1)) end
		elseif tier.rainbow and grad then
			grad.Color = ColorSequence.new(Color3.fromHSV((t * 0.35) % 1, 0.45, 1), Color3.fromHSV((t * 0.35 + 0.3) % 1, 0.7, 1))
			local g2 = rarityLabel:FindFirstChildOfClass("UIGradient")
			if g2 then g2.Color = ColorSequence.new(Color3.new(1, 1, 1), Color3.fromHSV((t * 0.5) % 1, 0.8, 1)) end
		end
		if rays then rays.Rotation += dt * 14 end
		rarityLabel.Rotation = math.sin(t * 3) * 2
	end)

	local hold = if epic then 6 elseif big then 5 else 4
	task.wait(hold)
	tween(holder, 0.4, { Position = UDim2.new(0.5, 0, 0, (-H - 80) * k) }, Enum.EasingStyle.Back, Enum.EasingDirection.In)
	if vignette then tween(vignette, 0.5, { BackgroundTransparency = 1 }) end
	if rays then tween(rays:FindFirstChildOfClass("UIScale"), 0.4, { Scale = 0 }, Enum.EasingStyle.Back, Enum.EasingDirection.In) end
	task.wait(0.5)
	alive = false
	conn:Disconnect()
	layer:Destroy()
end

local function pump()
	if busy then return end
	busy = true
	task.spawn(function()
		while #queue > 0 do
			local d = table.remove(queue, 1)
			local ok, err = pcall(play, d)
			if not ok then warn("[TFB] announce", err) end
		end
		busy = false
	end)
end

function Announce.mount(g: ScreenGui)
	gui = g
end

function Announce.show(d)
	if not gui then return end
	chatLine(d)
	if not d.banner then return end -- everything below Impossible: chat only
	if #queue >= 4 then table.remove(queue, 1) end
	table.insert(queue, d)
	pump()
end

return Announce
