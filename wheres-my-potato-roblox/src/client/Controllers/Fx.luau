--[[ Fx: everything that sells the physicality on this client only (no network cost):
     - potatoes flying from the ground into your hands / bucket (arc + spin + squash)
     - dirt puffs where you dig, sparkles for golden / purple finds
     - crater collapse: a few potatoes from the rim roll into the fresh hole
     - avalanches: on steep dunes near you, potatoes break loose at the crest and tumble
       down the slope with real physics, then settle and fade
     - floating "+1,4 ₣" coins from the top of the jar ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")
local Potato = require(ReplicatedStorage.Shared.Potato)
local Land = require(ReplicatedStorage.Shared.Land)
local Easing = require(ReplicatedStorage.Shared.Util.Easing)

local Sound = require(script.Parent.Sound)
local PM = require(game:GetService("ReplicatedStorage").Shared.PotatoMesh)

local Fx = {}
local folder = Instance.new("Folder"); folder.Name = "ClientFx"; folder.Parent = workspace
local rnd = Random.new()

-- ---------------------------------------------------------------- particles (one reusable emitter part)
local emitPart = Instance.new("Part"); emitPart.Anchored = true; emitPart.CanCollide = false; emitPart.CanQuery = false; emitPart.Transparency = 1; emitPart.Size = Vector3.one * 0.2; emitPart.Parent = folder
local function emitter(props)
	local e = Instance.new("ParticleEmitter"); e.Enabled = false
	for k, v in props do (e :: any)[k] = v end
	e.Parent = emitPart; return e
end
local dirt = emitter({ Texture = "rbxasset://textures/particles/smoke_main.dds", Color = ColorSequence.new(Color3.fromRGB(196, 150, 86)), Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.4), NumberSequenceKeypoint.new(1, 1.6) }), Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.45), NumberSequenceKeypoint.new(1, 1) }), Lifetime = NumberRange.new(0.5, 0.9), Speed = NumberRange.new(2, 6), SpreadAngle = Vector2.new(70, 70), Acceleration = Vector3.new(0, -6, 0), Drag = 3, Rotation = NumberRange.new(0, 360), RotSpeed = NumberRange.new(-90, 90) })
local spark = emitter({ Texture = "rbxasset://textures/particles/sparkles_main.dds", Color = ColorSequence.new(Color3.fromRGB(255, 214, 110)), Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(1, 0) }), LightEmission = 1, Lifetime = NumberRange.new(0.6, 1.1), Speed = NumberRange.new(4, 10), SpreadAngle = Vector2.new(180, 180), Drag = 2 })
function Fx.dirt(at: Vector3, n: number) emitPart.Position = at; dirt:Emit(n) end
function Fx.sparkle(at: Vector3, n: number, col: Color3?)
	emitPart.Position = at; spark.Color = ColorSequence.new(col or Color3.fromRGB(255, 214, 110)); spark:Emit(n)
end

-- ---------------------------------------------------------------- flying potato (ground → hand)
local flying = {}
function Fx.flyToHand(from: CFrame, variety: number, size: number, target: () -> Vector3, dur: number?)
	local r = rnd:NextNumber()
	local p = PM.make(r) or Potato.make(variety, size, r)
	p.Size = Vector3.new(1.3 * size * (1.05 + r * 0.25), 0.78 * size, 0.98 * size); p.Color = Potato.color(variety, r)
	if variety == 6 then p.Material = Enum.Material.Metal; p.Reflectance = 0.15 end
	p.Anchored = true; p.CanCollide = false; p.CanQuery = false; p.CFrame = from; p.Parent = folder
	table.insert(flying, { p = p, from = from.Position, t = 0, dur = dur or 0.28, target = target, spin = Vector3.new(rnd:NextNumber(-12, 12), rnd:NextNumber(-12, 12), rnd:NextNumber(-12, 12)) })
end
RunService.RenderStepped:Connect(function(dt)
	for i = #flying, 1, -1 do
		local f = flying[i]
		f.t += dt
		local k = math.min(1, f.t / f.dur)
		local e = Easing.cubicInOut(k)
		local to = f.target()
		local pos = f.from:Lerp(to, e) + Vector3.new(0, math.sin(k * math.pi) * 2.2, 0)
		local m = f.p:FindFirstChildOfClass("SpecialMesh") :: SpecialMesh?
		if m then local s = 1 - 0.55 * e; m.Scale = Vector3.new(s * (1 + 0.2 * math.sin(k * 9)), s, s)
		else f.base = f.base or f.p.Size; local s = 1 - 0.55 * e; f.p.Size = f.base * Vector3.new(s * (1 + 0.2 * math.sin(k * 9)), s, s) end
		f.p.CFrame = CFrame.new(pos) * CFrame.Angles(f.spin.X * f.t, f.spin.Y * f.t, f.spin.Z * f.t)
		if k >= 1 then f.p:Destroy(); table.remove(flying, i) end
	end
end)

-- ---------------------------------------------------------------- physical rollers (client-side)
local rollers = {}
local PHYS = PhysicalProperties.new(0.7, 0.45, 0.12, 1, 1)
function Fx.roller(at: Vector3, vel: Vector3, variety: number?)
	if #rollers > 70 then return end
	local p = Instance.new("Part"); p.Shape = Enum.PartType.Ball; p.Size = Vector3.one * (0.95 + rnd:NextNumber() * 0.3)
	local v = variety or (if rnd:NextNumber() < 0.72 then 1 else 2)
	p.Color = Potato.color(v, rnd:NextNumber()); p.Material = Enum.Material.Sand; p.CastShadow = false; p.CanQuery = false
	p.TopSurface = Enum.SurfaceType.Smooth; p.BottomSurface = Enum.SurfaceType.Smooth
	local m = Instance.new("SpecialMesh"); m.MeshType = Enum.MeshType.Sphere; m.Scale = Vector3.new(1.32, 0.82, 1); m.Parent = p
	p.CustomPhysicalProperties = PHYS
	p.CFrame = CFrame.new(at) * CFrame.Angles(rnd:NextNumber() * 6, rnd:NextNumber() * 6, 0)
	p.Parent = folder
	p.AssemblyLinearVelocity = vel; p.AssemblyAngularVelocity = Vector3.new(rnd:NextNumber(-8, 8), rnd:NextNumber(-8, 8), rnd:NextNumber(-8, 8))
	table.insert(rollers, { p = p, t = os.clock() })
end
task.spawn(function()
	while true do
		task.wait(0.5)
		local now = os.clock()
		for i = #rollers, 1, -1 do
			local r = rollers[i]
			if now - r.t > 9 then
				local p = r.p; table.remove(rollers, i)
				p.Anchored = true
				local m = p:FindFirstChildOfClass("SpecialMesh")
				if m then TweenService:Create(m, TweenInfo.new(0.6), { Scale = Vector3.new(0.05, 0.05, 0.05) }):Play() end
				Debris:AddItem(p, 0.7)
			end
		end
	end
end)

-- crater collapse: potatoes from the rim tumble into the fresh hole
function Fx.collapse(center: Vector3)
	for k = 1, rnd:NextInteger(1, 3) do
		local a = rnd:NextNumber() * math.pi * 2
		local from = center + Vector3.new(math.cos(a) * 2.6, 0, math.sin(a) * 2.6)
		from = Vector3.new(from.X, Land.height(from.X, from.Z) + 0.9, from.Z)
		Fx.roller(from, (center - from).Unit * 6 + Vector3.new(0, 2, 0))
	end
end

-- avalanches on steep slopes around the player
local avT = 3
function Fx.update(dt: number, camCF: CFrame, moving: boolean)
	avT -= dt * (if moving then 1.6 else 1)
	if avT > 0 then return end
	avT = 1.2 + rnd:NextNumber() * 1.8
	local look = camCF.LookVector
	local a0 = math.atan2(look.Z, look.X)
	for _ = 1, 10 do
		local a, r = a0 + (rnd:NextNumber() - 0.5) * 1.6, 14 + rnd:NextNumber() * 60
		local x, z = camCF.Position.X + math.cos(a) * r, camCF.Position.Z + math.sin(a) * r
		local gx, gz = Land.slope(x, z)
		local s = math.sqrt(gx * gx + gz * gz)
		if s > 0.42 then
			local dx, dz = -gx / s, -gz / s
			for k = 1, rnd:NextInteger(4, 9) do
				local px, pz = x + rnd:NextNumber(-1.5, 1.5) - dx * k * 0.5, z + rnd:NextNumber(-1.5, 1.5) - dz * k * 0.5
				Fx.roller(Vector3.new(px, Land.height(px, pz) + 1, pz), Vector3.new(dx, 0.2, dz) * (6 + rnd:NextNumber() * 8))
			end
			if r < 40 then Sound.play("Rumble", 0.6, Vector3.new(x, Land.height(x, z), z)) end
			break
		end
	end
end

-- floating coins from the top of the jar
function Fx.coin(at: Vector3, value: number, variety: number)
	local bb = Instance.new("BillboardGui"); bb.Size = UDim2.fromOffset(160, 50); bb.AlwaysOnTop = true; bb.LightInfluence = 0; bb.MaxDistance = 600
	local a = Instance.new("Attachment"); a.WorldPosition = at; a.Parent = workspace.Terrain; bb.Adornee = a; bb.Parent = a
	local t = Instance.new("TextLabel"); t.Size = UDim2.fromScale(1, 1); t.BackgroundTransparency = 1; t.Font = Enum.Font.LuckiestGuy; t.TextScaled = true
	t.Text = "+" .. string.format("%.1f", value):gsub("%.0$", ""):gsub("%.", ",") .. " ₣"
	t.TextColor3 = if variety == 6 then Color3.fromRGB(255, 220, 90) elseif variety == 5 then Color3.fromRGB(200, 140, 255) else Color3.fromRGB(255, 240, 200)
	t.TextStrokeTransparency = 0.2; t.Parent = bb
	TweenService:Create(bb, TweenInfo.new(1.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { StudsOffsetWorldSpace = Vector3.new(0, 9, 0) }):Play()
	TweenService:Create(t, TweenInfo.new(1.4, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	Debris:AddItem(a, 1.5)
end

Fx.folder = folder

return Fx
