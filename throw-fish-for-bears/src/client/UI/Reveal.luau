--[[ Reveal: rarity-scaled catch reveals (fish and bears).
     tier 1 (Common/Uncommon)  : quick card sliding up from the bottom
     tier 2 (Rare/Epic)        : centred card, rotating light rays, sparkles
     tier 3-4 (Legendary+)     : full-screen dim + blur, colour rays, the 3D model
                                 scales in, rarity text slams down, star burst,
                                 screen shake, "tap to continue"
     Reveals are queued so nothing overlaps. Uses the real 3D models (Viewport). ]]
local Lighting = game:GetService("Lighting")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local FishConfig = require(Shared.Config.FishConfig)
local BearConfig = require(Shared.Config.BearConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local Format = require(Shared.Util.Format)
local Easing = require(Shared.Util.Easing)
local Theme = require(script.Parent.Theme)
local Viewport = require(script.Parent.Viewport)
local Sound = require(script.Parent.Parent.Controllers.Sound)
local CameraController = require(script.Parent.Parent.Controllers.CameraController)

local Reveal = {}
local gui: ScreenGui
local queue = {}
local busy = false

function Reveal.mount(g: ScreenGui)
	gui = g
end

local function rarityColor(r: string): Color3
	local t = RarityConfig.get(r)
	return if t.textColor then t.textColor else t.color
end

local function rays(parent: GuiObject, color: Color3, n: number, size: number)
	local holder = Theme.new("Frame", {
		Name = "Rays", BackgroundTransparency = 1, Size = UDim2.fromOffset(size, size),
		AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), ZIndex = parent.ZIndex,
	})
	for i = 1, n do
		local ray = Theme.new("Frame", {
			BackgroundColor3 = color, BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 1),
			Size = UDim2.new(0, size * 0.09, 0.5, 0), Position = UDim2.fromScale(0.5, 0.5),
			Rotation = i * 360 / n, ZIndex = parent.ZIndex,
		})
		Theme.new("UIGradient", {
			Rotation = 90,
			Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.6, 0.55), NumberSequenceKeypoint.new(1, 0.3) }),
		}).Parent = ray
		ray.Parent = holder
	end
	holder.Parent = parent
	return holder
end

local function stars(parent: GuiObject, color: Color3, n: number)
	for _ = 1, n do
		local s = Theme.text({ Text = "★", Size = UDim2.fromOffset(26, 26), Position = UDim2.fromScale(0.5, 0.45), AnchorPoint = Vector2.new(0.5, 0.5), Color = color, Max = 26, ZIndex = parent.ZIndex + 6 })
		s.Parent = parent
		local a = math.random() * math.pi * 2
		local d = 160 + math.random() * 200
		Theme.tween(s, 1.1, { Position = UDim2.new(0.5, math.cos(a) * d, 0.45, math.sin(a) * d * 0.7), Rotation = math.random(-180, 180), TextTransparency = 1 }, Enum.EasingStyle.Quart)
		task.delay(1.2, function() s:Destroy() end)
	end
end

local function pump()
	if busy or #queue == 0 then return end
	busy = true
	local job = table.remove(queue, 1)
	task.spawn(function()
		local ok, err = pcall(job)
		if not ok then warn("[TFB] reveal", err) end
		busy = false
		pump()
	end)
end

local function enqueue(fn)
	table.insert(queue, fn)
	pump()
end

--[[ info: { kind = "Fish"|"Bear", id, rarity, variant, weight, title, line2, isNew } ]]
local function play(info)
	local tier = RarityConfig.get(info.rarity)
	local level = tier.reveal
	local col = rarityColor(info.rarity)
	local variantCfg = RarityConfig.Variants[info.variant or "Normal"]
	if info.variant and info.variant ~= "Normal" then level = math.max(level, 2) end
	Sound.play("Reveal" .. level)

	if level == 1 then
		local card = Theme.block({
			Name = "RevealCard", Size = UDim2.fromOffset(330, 104), Position = UDim2.new(0.5, 0, 1, 120), AnchorPoint = Vector2.new(0.5, 1),
			Gradient = { Theme.G.dark[1], Theme.G.dark[2] }, Corner = 12, StrokeWidth = 3, Studs = 14, ZIndex = 40, Parent = gui,
		})
		local icon = Theme.block({ Size = UDim2.fromOffset(88, 88), Position = UDim2.fromOffset(8, 8), Gradient = { col, Color3.fromRGB(30, 30, 34) }, Corner = 10, ZIndex = 41, Parent = card })
		Viewport.create(icon, { kind = info.kind, id = info.id, variant = info.variant, spin = true, zindex = 42 })
		Theme.text({ Text = info.title, Size = UDim2.new(1, -110, 0, 30), Position = UDim2.fromOffset(104, 8), XAlign = Enum.TextXAlignment.Left, Max = 28, Stroke = 3, ZIndex = 42, Parent = card })
		Theme.text({ Text = tier.name .. (if info.isNew then "  · NEW!" else ""), Size = UDim2.new(1, -110, 0, 22), Position = UDim2.fromOffset(104, 40), XAlign = Enum.TextXAlignment.Left, Max = 20, Color = col, ZIndex = 42, Parent = card })
		Theme.text({ Text = info.line2, Size = UDim2.new(1, -110, 0, 20), Position = UDim2.fromOffset(104, 66), XAlign = Enum.TextXAlignment.Left, Max = 18, Color = Theme.MONEY, ZIndex = 42, Parent = card })
		Theme.tween(card, 0.35, { Position = UDim2.new(0.5, 0, 1, -112) }, Enum.EasingStyle.Back)
		task.wait(2.0)
		Theme.tween(card, 0.3, { Position = UDim2.new(0.5, 0, 1, 130) }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
		task.wait(0.32)
		card:Destroy()
		return
	end

	local big = level >= 3
	local root = Theme.new("Frame", { Name = "Reveal", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 50 })
	root.Parent = gui
	local dim = Theme.new("Frame", { BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 1, Size = UDim2.fromScale(3, 3), Position = UDim2.fromScale(-1, -1), ZIndex = 50, BorderSizePixel = 0 })
	dim.Parent = root
	Theme.tween(dim, 0.35, { BackgroundTransparency = if big then 0.35 else 0.65 })
	local blur
	if big then
		blur = Instance.new("BlurEffect")
		blur.Size = 0
		blur.Parent = Lighting
		Theme.tween(blur, 0.4, { Size = 14 })
		CameraController.punch(-8)
		CameraController.shake(1.2, 0.5)
	end
	local center = Theme.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(420, 420), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.46), ZIndex = 51 })
	center.Parent = root
	local r1 = rays(center, col, if big then 16 else 10, if big then 620 else 420)
	local r2 = big and rays(center, Color3.new(1, 1, 1), 8, 520) or nil
	local spin = RunService.RenderStepped:Connect(function(dt)
		r1.Rotation += dt * 25
		if r2 then r2.Rotation -= dt * 40 end
	end)
	-- the model
	local holder = Theme.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(260, 220), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.45), ZIndex = 55 })
	holder.Parent = center
	local hs = Theme.new("UIScale", { Scale = 0, Parent = holder })
	Viewport.create(holder, { kind = info.kind, id = info.id, variant = info.variant, spin = true, spinSpeed = 1.1, zindex = 56 })
	Theme.tween(hs, if big then 0.7 else 0.45, { Scale = 1 }, Enum.EasingStyle.Back)
	if big then stars(root, col, 18) end
	-- texts
	local rarityText = Theme.text({ Text = tier.name:upper(), Size = UDim2.fromOffset(420, 46), Position = UDim2.fromScale(0.5, 0.12), AnchorPoint = Vector2.new(0.5, 0.5), Color = col, Max = 46, Stroke = 4, ZIndex = 60, Font = Theme.FontBold })
	rarityText.Parent = root
	local rs = Theme.new("UIScale", { Scale = if big then 2.4 else 1.6, Parent = rarityText })
	rarityText.TextTransparency = 1
	task.delay(if big then 0.45 else 0.15, function()
		rarityText.TextTransparency = 0
		Theme.tween(rs, 0.3, { Scale = 1 }, Enum.EasingStyle.Back)
		if big then
			CameraController.shake(0.9, 0.25)
			Sound.play("BigSplash", { volume = 0.4 })
		end
	end)
	local title = Theme.text({ Text = info.title, Size = UDim2.fromOffset(460, 40), Position = UDim2.fromScale(0.5, 0.74), AnchorPoint = Vector2.new(0.5, 0.5), Max = 38, Stroke = 4, ZIndex = 60 })
	title.Parent = root
	local line2 = Theme.text({ Text = info.line2, Size = UDim2.fromOffset(460, 26), Position = UDim2.fromScale(0.5, 0.81), AnchorPoint = Vector2.new(0.5, 0.5), Max = 24, Color = Theme.MONEY, ZIndex = 60 })
	line2.Parent = root
	if info.variant and info.variant ~= "Normal" then
		local v = Theme.text({ Text = "✦ " .. variantCfg.name:upper() .. " ✦", Size = UDim2.fromOffset(300, 28), Position = UDim2.fromScale(0.5, 0.19), AnchorPoint = Vector2.new(0.5, 0.5), Color = variantCfg.color, Max = 26, ZIndex = 60 })
		v.Parent = root
	end
	if info.isNew then
		local n = Theme.block({ Size = UDim2.fromOffset(84, 32), Position = UDim2.new(0.5, 150, 0.3, 0), AnchorPoint = Vector2.new(0.5, 0.5), Gradient = Theme.G.red, Corner = 8, ZIndex = 61, Parent = root })
		n.Rotation = 12
		Theme.text({ Text = "NEW!", Size = UDim2.fromScale(0.9, 0.8), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), Max = 22, ZIndex = 62, Parent = n })
	end
	local hint = Theme.text({ Text = if big then "Tap to continue" else "", Size = UDim2.fromOffset(300, 20), Position = UDim2.fromScale(0.5, 0.9), AnchorPoint = Vector2.new(0.5, 0.5), Max = 18, ZIndex = 60, Color = Color3.fromRGB(220, 220, 220) })
	hint.Parent = root
	-- rainbow rarity text
	local rainbowConn
	if tier.rainbow then
		rainbowConn = RunService.RenderStepped:Connect(function()
			rarityText.TextColor3 = Color3.fromHSV((os.clock() * 0.4) % 1, 0.8, 1)
		end)
	end
	-- wait: fixed time or tap
	local done = false
	local tap = Theme.new("TextButton", { BackgroundTransparency = 1, Text = "", Size = UDim2.fromScale(1, 1), ZIndex = 70 })
	tap.Parent = root
	local t0 = os.clock()
	tap.Activated:Connect(function()
		if os.clock() - t0 > 0.8 then done = true end
	end)
	local maxT = if big then 5 else 2.6
	while not done and os.clock() - t0 < maxT do task.wait() end
	-- out
	Theme.tween(hs, 0.25, { Scale = 0 }, Enum.EasingStyle.Back, Enum.EasingDirection.In)
	Theme.tween(dim, 0.3, { BackgroundTransparency = 1 })
	for _, d in root:GetDescendants() do
		if d:IsA("TextLabel") then Theme.tween(d, 0.25, { TextTransparency = 1 }) end
		if d:IsA("UIStroke") then Theme.tween(d, 0.25, { Transparency = 1 }) end
		if d:IsA("Frame") and d.Parent and d.Parent.Name == "Rays" then Theme.tween(d, 0.25, { BackgroundTransparency = 1 }) end
	end
	if blur then Theme.tween(blur, 0.3, { Size = 0 }) end
	task.wait(0.32)
	spin:Disconnect()
	if rainbowConn then rainbowConn:Disconnect() end
	if blur then blur:Destroy() end
	root:Destroy()
end

function Reveal.fish(fish, extra)
	local spec = FishConfig.get(fish.s)
	local variant = if fish.v and fish.v ~= "Normal" then fish.v .. " " else ""
	enqueue(function()
		play({
			kind = "Fish", id = fish.s, rarity = spec.rarity, variant = fish.v, weight = fish.w,
			title = variant .. spec.name, line2 = Format.kg(fish.w) .. "  ·  " .. Format.money(extra.value or 0),
			isNew = extra.isNew,
		})
	end)
end

function Reveal.bear(bear, income: number, isNew: boolean?)
	local spec = BearConfig.get(bear.s)
	local variant = if bear.v and bear.v ~= "Normal" then bear.v .. " " else ""
	enqueue(function()
		play({
			kind = "Bear", id = bear.s, rarity = bear.r, variant = bear.v, weight = bear.w,
			title = variant .. spec.name, line2 = Format.kg(bear.w) .. "  ·  " .. Format.perSec(income),
			isNew = isNew,
		})
	end)
end

-- small banner when you become the bear
function Reveal.bearToast(outcome, income: number)
	local spec = BearConfig.get(outcome.s)
	local tier = RarityConfig.get(outcome.r)
	local col = rarityColor(outcome.r)
	local t = Theme.text({ Text = ("YOU ARE A %s %s!"):format(tier.name:upper(), spec.name:upper()), Size = UDim2.fromOffset(620, 40), Position = UDim2.fromScale(0.5, 0.36), AnchorPoint = Vector2.new(0.5, 0.5), Max = 34, Stroke = 4, Color = col, ZIndex = 45, Font = Theme.FontBold })
	t.Parent = gui
	local s = Theme.new("UIScale", { Scale = 2, Parent = t })
	Theme.tween(s, 0.35, { Scale = 1 }, Enum.EasingStyle.Back)
	if tier.index >= 4 then Sound.play("Reveal" .. tier.reveal) end
	task.delay(2.2, function()
		Theme.tween(t, 0.4, { TextTransparency = 1, Position = UDim2.fromScale(0.5, 0.3) })
		local st = t:FindFirstChildOfClass("UIStroke")
		if st then Theme.tween(st, 0.4, { Transparency = 1 }) end
		task.wait(0.45)
		t:Destroy()
	end)
end

local _ = Easing
return Reveal
