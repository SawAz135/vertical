--[[ Night: the day/night clock (long golden hour, nights pass 3× faster) and the night
     event "les patates filantes": a glowing golden potato streaks across the sky with a
     trail and crashes into the desert near a player, lit by a beam until someone picks it
     up (worth a golden potato, 60 ₣). A fun bonus, never in the way. ]]
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Land = require(ReplicatedStorage.Shared.Land)
local Net = require(ReplicatedStorage.Shared.Net)

local N = {}
N.onLand = nil :: ((BasePart) -> ())?
local nextStar = 8
local star: BasePart? = nil

local function isNight(h: number) return h >= 20.5 or h < 5.5 end

local function spawnStar()
	local pls = Players:GetPlayers(); if #pls == 0 then return end
	local pl = pls[math.random(1, #pls)]
	local root = pl.Character and pl.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not root then return end
	local a, r = math.random() * math.pi * 2, 28 + math.random() * 40
	local tx, tz = root.Position.X + math.cos(a) * r, root.Position.Z + math.sin(a) * r
	local to = Vector3.new(tx, Land.height(tx, tz) + 0.6, tz)
	local from = to + Vector3.new(-math.cos(a + 1) * 300, 230, -math.sin(a + 1) * 300)
	local p = Instance.new("Part")
	p.Name = "ShootingPotato"; p.Size = Vector3.new(1.9, 1.2, 1.4); p.Color = Color3.fromRGB(255, 200, 60); p.Material = Enum.Material.Neon
	p.Anchored = true; p.CanCollide = false; p.CFrame = CFrame.new(from)
	local mesh = Instance.new("SpecialMesh"); mesh.MeshType = Enum.MeshType.Sphere; mesh.Parent = p
	local a0 = Instance.new("Attachment"); a0.Position = Vector3.new(0, 0.6, 0); a0.Parent = p
	local a1 = Instance.new("Attachment"); a1.Position = Vector3.new(0, -0.6, 0); a1.Parent = p
	local trail = Instance.new("Trail"); trail.Attachment0 = a0; trail.Attachment1 = a1; trail.Lifetime = 1.4; trail.LightEmission = 1
	trail.Color = ColorSequence.new(Color3.fromRGB(255, 230, 140), Color3.fromRGB(255, 120, 30)); trail.Transparency = NumberSequence.new(0.1, 1); trail.WidthScale = NumberSequence.new(1, 0); trail.Parent = p
	local light = Instance.new("PointLight"); light.Color = Color3.fromRGB(255, 200, 100); light.Range = 26; light.Brightness = 4; light.Parent = p
	local sp = Instance.new("ParticleEmitter"); sp.Texture = "rbxasset://textures/particles/sparkles_main.dds"; sp.Rate = 60; sp.Lifetime = NumberRange.new(0.6, 1.2); sp.Speed = NumberRange.new(1, 4); sp.SpreadAngle = Vector2.new(180, 180); sp.LightEmission = 1
	sp.Color = ColorSequence.new(Color3.fromRGB(255, 220, 120)); sp.Size = NumberSequence.new(0.5, 0); sp.Parent = p
	p:SetAttribute("Star", true)
	p.Parent = workspace
	star = p
	Net.event("Star"):FireAllClients(from, to)
	-- arc flight
	local dur, t0 = 2.6, os.clock()
	local conn
	conn = RunService.Heartbeat:Connect(function()
		local k = math.min(1, (os.clock() - t0) / dur)
		local pos = from:Lerp(to, k) + Vector3.new(0, math.sin(k * math.pi) * 25, 0)
		p.CFrame = CFrame.new(pos) * CFrame.Angles(k * 20, k * 13, 0)
		if k >= 1 then
			conn:Disconnect()
			p.CFrame = CFrame.new(to) * CFrame.Angles(0.2, math.random() * 6, 0.1)
			p.Material = Enum.Material.Metal; p.Reflectance = 0.2
			trail.Enabled = false; sp.Rate = 12
			-- beam of light over it
			local beam = Instance.new("Part"); beam.Name = "Beam"; beam.Anchored = true; beam.CanCollide = false; beam.CanQuery = false; beam.CastShadow = false
			beam.Shape = Enum.PartType.Cylinder; beam.Size = Vector3.new(60, 3, 3); beam.Material = Enum.Material.Neon; beam.Color = Color3.fromRGB(255, 214, 130); beam.Transparency = 0.82
			beam.CFrame = CFrame.new(to + Vector3.new(0, 30, 0)) * CFrame.Angles(0, 0, math.pi / 2); beam.Parent = p
			TweenService:Create(beam, TweenInfo.new(1.2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { Transparency = 0.9 }):Play()
			if N.onLand then N.onLand(p) end
		end
	end)
	task.delay(90, function() if p.Parent then p:Destroy() end; if star == p then star = nil end end)
end

function N.takeStar(part: Instance): boolean
	if part ~= star or not star or not star.Parent then return false end
	star:Destroy(); star = nil
	return true
end

local clock = 17.2
Lighting.ClockTime = clock
RunService.Heartbeat:Connect(function(dt)
	local h = clock
	local golden = h >= 15.5 and h < 19.5
	clock = (h + dt / (if golden then 110 else 55) * (if isNight(h) then 3 else 1)) % 24
	Lighting.ClockTime = clock
	-- night look: cooler, a bit dimmer
	if isNight(clock) then
		nextStar -= dt
		if nextStar <= 0 then nextStar = 16 + math.random() * 18; if not star then task.spawn(spawnStar) end end
	end
end)

return N
