--[[
	Roblox Forge - pet effects (client).
	Animates every pet tagged "ForgePet": orbiting rings and orbs, rainbow colours,
	pulsing light and lightning arcs. Runs on each player's device, every frame.
]]
local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")
local Debris = game:GetService("Debris")

local running = {}

local function readFx(model)
	local ok, fx = pcall(HttpService.JSONDecode, HttpService, model:GetAttribute("ForgeFX") or "{}")
	return ok and fx or {}
end

local function glowBall(color, size)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Material = Enum.Material.Neon
	p.Shape = Enum.PartType.Ball
	p.Size = Vector3.one * size
	p.Color = color
	return p
end

local function setup(model)
	if running[model] then return end
	local body = model:WaitForChild("Body", 5)
	if not body then return end
	local fx = readFx(model)
	local folder = Instance.new("Folder")
	folder.Name = "ForgeFX_" .. model.Name
	folder.Parent = workspace
	local st = { model = model, body = body, fx = fx, folder = folder, orbiters = {}, tint = {}, lights = {}, emitters = {}, nextBolt = 0 }

	if fx.rings and fx.rings.on then
		local n = fx.rings.count or 10
		for i = 1, n do
			local p = glowBall(Color3.fromHex(fx.rings.c1 or "#ffd45c"), fx.rings.dot or 0.22)
			p.Parent = folder
			table.insert(st.orbiters, { part = p, kind = "ring", i = i, n = n })
		end
	end
	if fx.orbs and fx.orbs.on then
		local n = fx.orbs.count or 3
		for i = 1, n do
			local p = glowBall(Color3.fromHex(fx.orbs.c1 or "#3ee6ff"), fx.orbs.size or 0.5)
			local light = Instance.new("PointLight")
			light.Color = p.Color
			light.Range = 6
			light.Brightness = 2
			light.Parent = p
			p.Parent = folder
			table.insert(st.orbiters, { part = p, kind = "orb", i = i, n = n })
		end
	end
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") and d:GetAttribute("ForgeTint") then table.insert(st.tint, d) end
		if d:IsA("PointLight") then table.insert(st.lights, { light = d, base = d.Brightness }) end
		if d:IsA("ParticleEmitter") or d:IsA("Trail") then table.insert(st.emitters, d) end
	end
	running[model] = st
	model.AncestryChanged:Connect(function(_, parent)
		if not parent then
			folder:Destroy()
			running[model] = nil
		end
	end)
end

local function bolt(st)
	local color = Color3.fromHex(st.fx.lightning.c1 or "#9be8ff")
	local origin = st.body.Position
	local dir = Vector3.new(math.random() - 0.5, math.random() * 0.8, math.random() - 0.5).Unit
	local points = { origin }
	for _ = 1, 6 do
		local jitter = Vector3.new(math.random() - 0.5, math.random() - 0.5, math.random() - 0.5) * 0.6
		table.insert(points, points[#points] + dir * 0.6 + jitter)
	end
	for k = 1, #points - 1 do
		local a, b = points[k], points[k + 1]
		local seg = Instance.new("Part")
		seg.Anchored = true
		seg.CanCollide = false
		seg.CanQuery = false
		seg.CanTouch = false
		seg.CastShadow = false
		seg.Material = Enum.Material.Neon
		seg.Color = color
		seg.Size = Vector3.new(0.07, 0.07, (b - a).Magnitude)
		seg.CFrame = CFrame.lookAt((a + b) / 2, b)
		seg.Parent = st.folder
		Debris:AddItem(seg, 0.12)
	end
end

RunService.RenderStepped:Connect(function()
	local t = os.clock()
	for _, st in running do
		local fx = st.fx
		local center = st.body.Position
		for _, o in st.orbiters do
			if o.kind == "ring" then
				local r = fx.rings.radius or 2.4
				local a = t * (fx.rings.speed or 1.5) + (o.i / o.n) * math.pi * 2
				local tilt = fx.rings.tilt and math.sin(a) * r * 0.35 or 0
				o.part.CFrame = CFrame.new(center + Vector3.new(math.cos(a) * r, tilt + math.sin(a * 3) * 0.08, math.sin(a) * r))
			else
				local r = fx.orbs.radius or 3
				local a = -t * (fx.orbs.speed or 1) + (o.i / o.n) * math.pi * 2
				o.part.CFrame = CFrame.new(center + Vector3.new(math.cos(a) * r, 1 + math.sin(t * 2 + o.i) * 0.5, math.sin(a) * r))
			end
		end
		if fx.rainbow and fx.rainbow.on then
			local speed = fx.rainbow.speed or 0.2
			local c1 = Color3.fromHSV((t * speed) % 1, 0.8, 1)
			local c2 = Color3.fromHSV((t * speed + 0.33) % 1, 0.8, 1)
			for _, p in st.tint do p.Color = c1 end
			for _, e in st.emitters do e.Color = ColorSequence.new(c1, c2) end
			for _, o in st.orbiters do o.part.Color = c1 end
		end
		if fx.pulse and fx.pulse.on then
			local k = 1 + math.sin(t * (fx.pulse.speed or 3)) * (fx.pulse.amount or 0.5)
			for _, l in st.lights do l.light.Brightness = l.base * k end
		end
		if fx.lightning and fx.lightning.on and t > st.nextBolt then
			st.nextBolt = t + (1 / (fx.lightning.rate or 2)) * (0.5 + math.random())
			bolt(st)
		end
	end
end)

for _, model in CollectionService:GetTagged("ForgePet") do task.spawn(setup, model) end
CollectionService:GetInstanceAddedSignal("ForgePet"):Connect(function(model) task.spawn(setup, model) end)
