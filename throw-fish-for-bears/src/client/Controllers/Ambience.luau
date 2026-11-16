--[[ Ambience: per-area atmosphere on this client - zone tint / haze when walking
     into a zone, falling stud leaves around the camera in the forest, gentle
     sparkles on the lake. Respects Low FX. ]]
local RunService = game:GetService("RunService")
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Layout = require(ReplicatedStorage.Shared.Layout)
local ZoneConfig = require(ReplicatedStorage.Shared.Config.ZoneConfig)
local Fx = require(script.Parent.Fx)

local Ambience = {}
local LEAVES = { Color3.fromRGB(80, 170, 60), Color3.fromRGB(120, 200, 70), Color3.fromRGB(230, 180, 60) }

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
			if atmo then
				local tw = game:GetService("TweenService"):Create(atmo, TweenInfo.new(1.5), {
					Density = if cfg then cfg.atmosphere else 0.26,
					Color = if cfg then cfg.fog else Color3.fromRGB(196, 226, 255),
				})
				tw:Play()
			end
		end
		if zone and not Fx.low then
			local cam = workspace.CurrentCamera.CFrame.Position
			for _ = 1, 2 do
				local p = cam + Vector3.new(math.random(-30, 30), math.random(10, 20), math.random(-30, 30))
				Fx.blocks(p, LEAVES[math.random(1, #LEAVES)], 1, 2, 0.35, { life = 3.5, up = -0.2, spread = 3, gravity = 2.5 })
			end
		end
	end)
end

return Ambience
