--[[ LakeLife: the lake and its shore come alive (client only, no network, cheap).
       water   : soft ripple rings drift across the surface, white foam streaks at the shore
       ducks   : little stud ducks float and bob, turn, dip their heads to feed, paddle slowly
       frogs   : sit on the sand, throat pulsing, hop into the water (splash) now and then
       dragonflies : dart along the shore in quick zig-zags and hover
     Everything is built once around the lake, updated only when the camera is near. ]]
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Layout = require(ReplicatedStorage.Shared.Layout)
local Fx = require(script.Parent.Fx)

local LakeLife = {}
local V3, CF, ANG = Vector3.new, CFrame.new, CFrame.Angles
local folder

local function part(parent, size, cf, color, shape)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = Enum.Material.Plastic
	p.TopSurface = Enum.SurfaceType.Studs
	if shape then p.Shape = shape end
	p.Parent = parent
	return p
end

-- a stud duck built from blocks (faces +Z... local -Z is forward)
local function makeDuck()
	local m = Instance.new("Model")
	m.Name = "Duck"
	local YEL, WHT, ORG = Color3.fromRGB(255, 214, 60), Color3.fromRGB(250, 250, 250), Color3.fromRGB(255, 140, 30)
	local body = part(m, V3(1.5, 0.9, 2.1), CF(0, 0, 0), WHT)
	part(m, V3(1.0, 0.45, 0.9), CF(0, 0.55, 0.85), WHT) -- tail up
	local neck = part(m, V3(0.6, 0.9, 0.6), CF(0, 0.85, -0.75), YEL)
	local head = part(m, V3(0.9, 0.8, 0.9), CF(0, 1.5, -0.85), YEL)
	part(m, V3(0.5, 0.2, 0.55), CF(0, 1.4, -1.5), ORG) -- bill
	part(m, V3(0.14, 0.14, 0.1), CF(0.3, 1.6, -1.28), Color3.new(0, 0, 0))
	part(m, V3(0.14, 0.14, 0.1), CF(-0.3, 1.6, -1.28), Color3.new(0, 0, 0))
	part(m, V3(0.25, 0.6, 1.3), CF(0.82, 0.2, 0.1), Color3.fromRGB(235, 235, 235)) -- wings
	part(m, V3(0.25, 0.6, 1.3), CF(-0.82, 0.2, 0.1), Color3.fromRGB(235, 235, 235))
	m.PrimaryPart = body
	m.Parent = folder
	return m, { neck = neck, head = head }
end

local function makeFrog()
	local m = Instance.new("Model")
	m.Name = "Frog"
	local G = Color3.fromRGB(70, 190, 70)
	local body = part(m, V3(1.2, 0.8, 1.4), CF(0, 0, 0), G)
	part(m, V3(0.9, 0.2, 0.7), CF(0, -0.35, -0.2), Color3.fromRGB(220, 240, 150))
	part(m, V3(0.4, 0.4, 0.4), CF(0.4, 0.6, -0.5), Color3.fromRGB(255, 255, 255))
	part(m, V3(0.4, 0.4, 0.4), CF(-0.4, 0.6, -0.5), Color3.fromRGB(255, 255, 255))
	part(m, V3(0.18, 0.18, 0.18), CF(0.4, 0.62, -0.72), Color3.new(0, 0, 0))
	part(m, V3(0.18, 0.18, 0.18), CF(-0.4, 0.62, -0.72), Color3.new(0, 0, 0))
	part(m, V3(0.35, 0.3, 0.9), CF(0.6, -0.3, 0.5), G)
	part(m, V3(0.35, 0.3, 0.9), CF(-0.6, -0.3, 0.5), G)
	m.PrimaryPart = body
	m.Parent = folder
	return m
end

function LakeLife.init()
	folder = Instance.new("Folder")
	folder.Name = "TFBLakeLife"
	folder.Parent = workspace
	local L, S = Layout.LAKE, Layout.SAND
	local water = Layout.WATER_Y
	local rnd = Random.new(4242)
	-- DUCKS: a few groups in the open water between / beside the docks
	local ducks = {}
	for i = 1, 9 do
		local m, bits = makeDuck()
		local cx = (rnd:NextNumber() * 2 - 1) * (L.maxX - 25)
		local cz = L.minZ + 40 + rnd:NextNumber() * (L.maxZ - L.minZ - 80)
		-- keep out of the dock lanes (x near a base centre, z < dock end)
		for _, c in Layout.BASE_CENTERS do
			if math.abs(cx - c.X) < 12 and cz < Layout.DOCK_END_Z + 12 then cx += 22 end
		end
		ducks[i] = { m = m, bits = bits, home = V3(cx, water, cz), pos = V3(cx, water, cz), yaw = rnd:NextNumber() * 6.28, seed = rnd:NextNumber() * 100,
			target = nil, dip = 0, nextDip = 2 + rnd:NextNumber() * 5 }
	end
	-- FROGS on the sand strip
	local frogs = {}
	for i = 1, 8 do
		local m = makeFrog()
		local x = (rnd:NextNumber() * 2 - 1) * (S.maxX - 15)
		local z = S.maxZ - 2 - rnd:NextNumber() * 3
		frogs[i] = { m = m, pos = V3(x, 0.45, z), yaw = math.pi, state = "sit", t = rnd:NextNumber() * 4, next = 3 + rnd:NextNumber() * 8, seed = rnd:NextNumber() * 50 }
	end
	-- DRAGONFLIES
	local flies = {}
	for i = 1, 6 do
		local m = Instance.new("Model")
		part(m, V3(0.12, 0.12, 0.9), CF(), Color3.fromRGB(60, 200, 255))
		part(m, V3(0.8, 0.05, 0.22), CF(0, 0.07, -0.15), Color3.fromRGB(220, 240, 255)).Transparency = 0.35
		m.PrimaryPart = m:FindFirstChildOfClass("Part")
		m.Parent = folder
		flies[i] = { m = m, pos = V3((rnd:NextNumber() * 2 - 1) * 150, 3, S.maxZ + rnd:NextNumber() * 14), tgt = nil, t = 0, seed = rnd:NextNumber() * 50 }
	end
	local ringT, foamT = 0, 0
	RunService.RenderStepped:Connect(function(dt)
		local cam = workspace.CurrentCamera.CFrame.Position
		if cam.Z < S.minZ - 140 then return end -- nowhere near the lake: nothing to update
		dt = math.min(dt, 0.1)
		local now = os.clock()
		-- water: ripple rings + foam at the shore, in view only
		ringT -= dt
		if ringT <= 0 and not Fx.low then
			ringT = 1.1
			local rp = V3(cam.X + (math.random() - 0.5) * 90, water + 0.05, math.clamp(cam.Z + 20 + math.random() * 50, L.minZ + 10, L.maxZ - 10))
			if math.abs(rp.X) < L.maxX then Fx.ripple(rp, 0.5 + math.random() * 0.5) end
		end
		foamT -= dt
		if foamT <= 0 and not Fx.low then
			foamT = 0.5
			local fx = math.clamp(cam.X + (math.random() - 0.5) * 80, L.minX + 5, L.maxX - 5)
			Fx.blocks(V3(fx, water + 0.15, L.minZ + 1.2), Color3.fromRGB(245, 250, 255), 1, 0.8, 0.5, { life = 1.6, up = 0.05, spread = 1.2, gravity = 0 })
		end
		-- ducks
		for _, du in ducks do
			if (du.pos - cam).Magnitude < 160 then
				-- wander toward a nearby spot, slowly, turning smoothly
				if not du.target or (du.target - du.pos).Magnitude < 1.5 then
					du.target = du.home + V3((math.random() - 0.5) * 30, 0, (math.random() - 0.5) * 30)
				end
				local to = du.target - du.pos
				local want = math.atan2(-to.X, -to.Z)
				local dy = (want - du.yaw + math.pi) % (math.pi * 2) - math.pi
				du.yaw += math.clamp(dy, -1, 1) * dt * 1.6
				if du.dip <= 0 then
					du.pos += V3(-math.sin(du.yaw), 0, -math.cos(du.yaw)) * 1.3 * dt
				end
				du.nextDip -= dt
				if du.nextDip <= 0 then du.dip = 1.1 du.nextDip = 4 + math.random() * 7 end
				du.dip = math.max(0, du.dip - dt)
				local bob = math.sin(now * 1.8 + du.seed) * 0.08
				local tip = math.sin(math.clamp(1 - du.dip / 1.1, 0, 1) * math.pi) * (if du.dip > 0 then 1 else 0)
				du.m:PivotTo(CF(du.pos.X, water + 0.35 + bob, du.pos.Z) * ANG(0, du.yaw, math.sin(now * 1.3 + du.seed) * 0.05) * ANG(tip * 0.9, 0, 0))
				if du.dip > 0.9 and not du.rippled then
					du.rippled = true
					Fx.ripple(V3(du.pos.X, water + 0.05, du.pos.Z), 0.6)
				elseif du.dip <= 0 then
					du.rippled = false
				end
			end
		end
		-- frogs
		for _, f in frogs do
			if (f.pos - cam).Magnitude < 80 then
				f.t += dt
				local y, pitch = 0, 0
				if f.state == "sit" then
					-- throat pulse (breathing) + a blink-ish head twitch
					pitch = math.sin(now * 5 + f.seed) * 0.03
					if f.t > f.next then f.state = "hop" f.t = 0 end
				else
					-- one big arc toward the water, a splash, then it is gone for a while
					local u = math.clamp(f.t / 0.7, 0, 1)
					y = 4 * 1.8 * u * (1 - u)
					f.pos += V3(0, 0, 3.2) * dt
					pitch = -0.5 * math.sin(u * math.pi)
					if u >= 1 then
						Fx.splash(V3(f.pos.X, water, f.pos.Z), 0.4)
						f.m.Parent = nil
						f.gone = now + 12 + math.random() * 10
						f.state = "gone"
					end
				end
				if f.state == "gone" then
					if now > f.gone then
						f.pos = V3(f.pos.X, 0.45, S.maxZ - 2 - math.random() * 3)
						f.state, f.t, f.next = "sit", 0, 4 + math.random() * 8
						f.m.Parent = folder
					end
				else
					f.m:PivotTo(CF(f.pos.X, f.pos.Y + y, f.pos.Z) * ANG(pitch, f.yaw, 0))
				end
			end
		end
		-- dragonflies: dart, hover, dart
		for _, d in flies do
			if (d.pos - cam).Magnitude < 90 then
				d.t -= dt
				if d.t <= 0 or not d.tgt then
					d.t = 0.6 + math.random() * 1.6
					d.tgt = V3(math.clamp(d.pos.X + (math.random() - 0.5) * 30, -190, 190), 2 + math.random() * 3.5, math.clamp(d.pos.Z + (math.random() - 0.5) * 16, S.maxZ + 1, L.minZ + 40))
					d.dart = math.random() < 0.6
				end
				local to = d.tgt - d.pos
				local sp = if d.dart then 14 else 2
				if to.Magnitude > 0.3 then d.pos += to.Unit * math.min(sp * dt, to.Magnitude) end
				local hov = V3(math.sin(now * 3 + d.seed) * 0.1, math.sin(now * 5 + d.seed) * 0.1, 0)
				d.m:PivotTo(CFrame.lookAt(d.pos + hov, d.pos + hov + (if to.Magnitude > 0.1 then to.Unit else V3(0, 0, -1))) * ANG(0, 0, math.sin(now * 60) * 0.12))
			end
		end
	end)
end

return LakeLife
