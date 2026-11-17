--[[ Ambience: per-area atmosphere on this client - zone tint / haze when walking
     into a zone, falling stud leaves around the camera in the forest, gentle
     sparkles on the lake. Respects Low FX. ]]
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Layout = require(ReplicatedStorage.Shared.Layout)
local ZoneConfig = require(ReplicatedStorage.Shared.Config.ZoneConfig)
local Fx = require(script.Parent.Fx)

local Ambience = {}
local PARTICLES = {
	Leaves = { colors = { Color3.fromRGB(80, 170, 60), Color3.fromRGB(120, 200, 70), Color3.fromRGB(230, 180, 60) }, size = 0.35, life = 3.5, up = -0.2, gravity = 2.5, n = 2 },
	Needles = { colors = { Color3.fromRGB(70, 120, 60), Color3.fromRGB(150, 110, 60) }, size = 0.22, life = 3, up = -0.3, gravity = 3, n = 2 },
	Snow = { colors = { Color3.fromRGB(255, 255, 255), Color3.fromRGB(230, 240, 255) }, size = 0.3, life = 5, up = -0.15, gravity = 1.2, n = 4 },
	Petals = { colors = { Color3.fromRGB(255, 180, 210), Color3.fromRGB(255, 220, 235) }, size = 0.3, life = 4.5, up = -0.1, gravity = 1.5, n = 3 },
	Fireflies = { colors = { Color3.fromRGB(230, 255, 120), Color3.fromRGB(255, 240, 140) }, size = 0.22, life = 3, up = 0.25, gravity = -0.4, n = 2, low = true, neon = true },
	Mist = { colors = { Color3.fromRGB(230, 240, 250) }, size = 0.6, life = 3, up = 0.05, gravity = 0, n = 1, low = true },
	Dust = { colors = { Color3.fromRGB(190, 180, 160) }, size = 0.25, life = 2.5, up = 0.1, gravity = 0.4, n = 1, low = true },
	Sand = { colors = { Color3.fromRGB(250, 230, 180) }, size = 0.2, life = 2.5, up = 0.05, gravity = 0.6, n = 1, low = true },
}

function Ambience.init()
	local acc = 0
	local current = nil
	RunService.Heartbeat:Connect(function(dt)
		acc += dt
		if acc < 0.35 then return end
		acc = 0
		local char = Players.LocalPlayer.Character
		local root = char and char:FindFirstChild("HumanoidRootPart")
		if not root then return end
		local zone = Layout.zoneAt(root.Position)
		if zone ~= current then
			current = zone
			local atmo = Lighting:FindFirstChildOfClass("Atmosphere")
			local cfg = zone and ZoneConfig.get(zone)
			local ti = TweenInfo.new(1.5)
			if atmo then
				TweenService:Create(atmo, ti, {
					Density = if cfg then cfg.atmosphere * 0.6 else 0.16,
					Color = if cfg then cfg.fog else Color3.fromRGB(196, 226, 255),
				}):Play()
			end
			local cc = Lighting:FindFirstChild("TFBColor")
			if cc then
				TweenService:Create(cc, ti, { TintColor = if cfg and cfg.tint then cfg.tint else Color3.new(1, 1, 1) }):Play()
			end
		end
		local cfg = zone and ZoneConfig.get(zone)
		local p = cfg and PARTICLES[cfg.particles]
		if p and not Fx.low then
			local cam = workspace.CurrentCamera.CFrame.Position
			for _ = 1, p.n do
				local pos = cam + Vector3.new(math.random(-30, 30), if p.low then math.random(-6, 4) else math.random(10, 20), math.random(-30, 30))
				if p.low then pos = Vector3.new(pos.X, math.max(1, pos.Y), pos.Z) end
				Fx.blocks(pos, p.colors[math.random(1, #p.colors)], 1, 2, p.size, { life = p.life, up = p.up, spread = 3, gravity = p.gravity, neon = p.neon })
			end
		end
	end)
end

return Ambience
