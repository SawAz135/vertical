--[[ Fx: client world effects in the stud style - block droplets, ripple rings,
     shockwaves, sparkle bursts, dust puffs. Everything is pooled into one
     simulation loop (no per-effect threads) and capped for mobile. LowFx halves
     every particle count. ]]
local RunService = game:GetService("RunService")
local Debris = game:GetService("Debris")

local Fx = {}
Fx.low = false
local live = {} -- simulated block particles
local rings = {}
local MAX_BLOCKS = 220
local folder = Instance.new("Folder")
folder.Name = "TFB_ClientFx"
folder.Parent = workspace
local rand = Random.new()

local function block(color: Color3, size: number, pos: Vector3, material: Enum.Material?)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Size = Vector3.one * size
	p.Color = color
	p.Material = material or Enum.Material.Plastic
	p.TopSurface = Enum.SurfaceType.Studs
	p.CFrame = CFrame.new(pos)
	p.Parent = folder
	return p
end

local function count(n: number): number
	return if Fx.low then math.max(1, math.floor(n * 0.45)) else n
end

-- flying blocks with gravity, spin and fade
function Fx.blocks(pos: Vector3, color: Color3, n: number, speed: number, size: number, opts: any?)
	opts = opts or {}
	n = count(n)
	for _ = 1, n do
		if #live >= MAX_BLOCKS then break end
		local s = size * (0.6 + rand:NextNumber() * 0.7)
		local p = block(if opts.colors then opts.colors[rand:NextInteger(1, #opts.colors)] else color, s, pos, opts.material)
		if opts.neon then p.Material = Enum.Material.Neon end
		local dir = Vector3.new(rand:NextNumber() - 0.5, opts.up or 1, rand:NextNumber() - 0.5)
		dir = Vector3.new(dir.X * (opts.spread or 1.6), dir.Y, dir.Z * (opts.spread or 1.6))
		table.insert(live, {
			part = p, vel = dir.Unit * speed * (0.6 + rand:NextNumber() * 0.6), life = opts.life or 0.9, t = 0,
			spin = Vector3.new(rand:NextNumber() * 10, rand:NextNumber() * 10, rand:NextNumber() * 10), size = s,
			gravity = opts.gravity or 70, floor = opts.floor,
		})
	end
end

-- flat expanding ring (water ripple / shockwave)
function Fx.ring(pos: Vector3, color: Color3, fromR: number, toR: number, life: number, opts: any?)
	opts = opts or {}
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Material = if opts.neon then Enum.Material.Neon else Enum.Material.SmoothPlastic
	p.Color = color
	p.Transparency = opts.transparency or 0.3
	p.Size = Vector3.new(opts.thick or 0.12, fromR * 2, fromR * 2)
	p.CFrame = CFrame.new(pos) * CFrame.Angles(0, 0, math.pi / 2)
	p.Parent = folder
	-- hollow look: an inner disc in the ground colour is not possible on water, so
	-- rings fade fast and stay thin
	table.insert(rings, { part = p, from = fromR, to = toR, life = life, t = 0, base = opts.transparency or 0.3, thick = opts.thick or 0.12, vertical = opts.vertical, cf = p.CFrame })
	return p
end

function Fx.splash(pos: Vector3, scale: number)
	scale = scale or 1
	local water = Color3.fromRGB(110, 190, 255)
	Fx.blocks(pos, water, math.floor(12 * scale), 16 * math.sqrt(scale), 0.35 * scale, {
		colors = { water, Color3.fromRGB(200, 235, 255), Color3.fromRGB(60, 150, 240) }, life = 0.8, up = 2.4, spread = 1.2,
	})
	Fx.ring(pos + Vector3.new(0, 0.05, 0), Color3.fromRGB(230, 245, 255), 0.4 * scale, 3.5 * scale, 0.7, { transparency = 0.25 })
	task.delay(0.15, function()
		Fx.ring(pos + Vector3.new(0, 0.05, 0), Color3.fromRGB(200, 230, 255), 0.3 * scale, 5 * scale, 1.0, { transparency = 0.45 })
	end)
end

function Fx.ripple(pos: Vector3, scale: number)
	Fx.ring(pos + Vector3.new(0, 0.04, 0), Color3.fromRGB(220, 240, 255), 0.3 * scale, 2.6 * scale, 1.1, { transparency = 0.5, thick = 0.06 })
end

function Fx.bubbles(pos: Vector3, n: number)
	Fx.blocks(pos, Color3.fromRGB(220, 245, 255), n, 5, 0.18, { life = 0.6, up = 3, spread = 0.5, gravity = -6 })
end

function Fx.dust(pos: Vector3, scale: number, color: Color3?)
	Fx.blocks(pos, color or Color3.fromRGB(170, 140, 100), math.floor(8 * scale), 9, 0.4 * scale, { life = 0.6, up = 0.8, spread = 2.2, gravity = 30 })
	Fx.ring(pos + Vector3.new(0, 0.1, 0), Color3.fromRGB(240, 230, 210), 0.5 * scale, 4 * scale, 0.5, { transparency = 0.5 })
end

function Fx.sparkle(pos: Vector3, color: Color3, n: number, speed: number?)
	Fx.blocks(pos, color, n, speed or 18, 0.3, { life = 1.1, up = 0.4, spread = 2, gravity = 12, neon = true })
end

-- big transformation / reveal burst: shockwave + vertical ring + neon blocks
function Fx.burst(pos: Vector3, color: Color3, scale: number)
	Fx.ring(pos + Vector3.new(0, 0.2, 0), color, 1, 16 * scale, 0.7, { neon = true, transparency = 0.1, thick = 0.3 })
	Fx.ring(pos + Vector3.new(0, 3 * scale, 0), Color3.new(1, 1, 1), 1, 10 * scale, 0.5, { neon = true, transparency = 0.2, thick = 0.2, vertical = true })
	Fx.sparkle(pos + Vector3.new(0, 2 * scale, 0), color, 26, 24 * scale)
	Fx.sparkle(pos + Vector3.new(0, 2 * scale, 0), Color3.new(1, 1, 1), 14, 30 * scale)
end

-- temporary attachment particle emitter (cheap cloud puffs)
function Fx.puff(pos: Vector3, color: Color3, amount: number, size: number)
	local a = Instance.new("Part")
	a.Anchored = true
	a.CanCollide = false
	a.CanQuery = false
	a.Transparency = 1
	a.Size = Vector3.one
	a.CFrame = CFrame.new(pos)
	a.Parent = folder
	local e = Instance.new("ParticleEmitter")
	e.Texture = "rbxasset://textures/particles/smoke_main.dds"
	e.Color = ColorSequence.new(color)
	e.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, size * 0.5), NumberSequenceKeypoint.new(1, size * 1.6) })
	e.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.2), NumberSequenceKeypoint.new(1, 1) })
	e.Lifetime = NumberRange.new(0.6, 1)
	e.Speed = NumberRange.new(4, 9)
	e.SpreadAngle = Vector2.new(180, 180)
	e.Rate = 0
	e.Parent = a
	e:Emit(count(amount))
	Debris:AddItem(a, 2)
end

RunService.RenderStepped:Connect(function(dt)
	dt = math.min(dt, 0.05)
	for i = #live, 1, -1 do
		local b = live[i]
		b.t += dt
		if b.t >= b.life then
			b.part:Destroy()
			table.remove(live, i)
		else
			b.vel -= Vector3.new(0, b.gravity * dt, 0)
			local p = b.part.Position + b.vel * dt
			if b.floor and p.Y < b.floor then
				p = Vector3.new(p.X, b.floor, p.Z)
				b.vel = Vector3.new(b.vel.X * 0.5, -b.vel.Y * 0.3, b.vel.Z * 0.5)
			end
			local k = b.t / b.life
			b.part.CFrame = CFrame.new(p) * CFrame.Angles(b.spin.X * b.t, b.spin.Y * b.t, b.spin.Z * b.t)
			b.part.Size = Vector3.one * b.size * (1 - k * k)
		end
	end
	for i = #rings, 1, -1 do
		local r = rings[i]
		r.t += dt
		local k = r.t / r.life
		if k >= 1 then
			r.part:Destroy()
			table.remove(rings, i)
		else
			local e = 1 - (1 - k) ^ 3
			local rad = r.from + (r.to - r.from) * e
			r.part.Size = Vector3.new(r.thick, rad * 2, rad * 2)
			if r.vertical then
				r.part.CFrame = CFrame.new(r.cf.Position) * CFrame.Angles(0, os.clock() * 2, 0)
			end
			r.part.Transparency = r.base + (1 - r.base) * k
		end
	end
end)

Fx.folder = folder
return Fx
