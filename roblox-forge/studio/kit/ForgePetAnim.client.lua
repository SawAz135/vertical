--[[
	Roblox Forge - pet animations (client, StarterPlayerScripts).
	Plays the keyframe animations made in Forge Studio on every pet tagged "ForgePet":
	  - "idle" clips loop while the pet hovers, "move" clips fade in when it travels;
	  - "spawn" clips play once when the pet appears;
	  - "manual" clips play once on demand:  player:SetAttribute("ForgePetAnim", "Danse")
	The server rig (ForgePetController) joins parts with Motor6Ds; this script only
	sets Motor6D.Transform, locally on each device, so it costs no network at all.
]]
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local Core = require(ReplicatedStorage:WaitForChild("ForgeAnimCore"))

local MAX_DISTANCE = 220 -- pets further away than this from the camera are not animated (saves CPU)
local FADE = 0.18 -- seconds to blend a one-shot in and out

local pets = {}

local function findClip(data, when: string?, name: string?)
	for _, clip in data.clips or {} do
		if (name and clip.name == name) or (not name and clip.when == when) then
			return clip
		end
	end
	return nil
end

local function setup(model: Model)
	if pets[model] then return end
	local dataModule = model:WaitForChild("ForgeAnimData", 10)
	local root = model:WaitForChild("ForgeRoot", 10)
	if not dataModule or not root or not model.Parent then return end
	local ok, data = pcall(require, dataModule)
	if not ok or type(data) ~= "table" or not data.clips or #data.clips == 0 then return end

	local rig = Core.prepare(data)
	local motors = {}
	for _, name in rig.names do
		local part = model:FindFirstChild(name)
		local motor = part and part:FindFirstChild("ForgeJoint")
		if motor and motor:IsA("Motor6D") then motors[name] = motor end
	end

	local st = {
		model = model, root = root, data = data, rig = rig, motors = motors,
		idle = findClip(data, "idle"), move = findClip(data, "move"),
		time = math.random() * 3, moveW = 0, shot = nil,
	}
	local spawnClip = findClip(data, "spawn")
	if spawnClip then st.shot = { clip = spawnClip, t = 0, w = 1 } end
	pets[model] = st

	model:GetAttributeChangedSignal("ForgeAnimPlay"):Connect(function()
		local v = model:GetAttribute("ForgeAnimPlay")
		local name = type(v) == "string" and string.match(v, "^([^#]+)") or nil
		local clip = name and findClip(data, nil, name)
		if clip then st.shot = { clip = clip, t = 0, w = 0 } end
	end)
	model.AncestryChanged:Connect(function(_, parent)
		if not parent then pets[model] = nil end
	end)
end

RunService.PreSimulation:Connect(function(dt)
	local camera = Workspace.CurrentCamera
	local eye = camera and camera.CFrame.Position
	for model, st in pets do
		if not st.root.Parent then
			pets[model] = nil
			continue
		end
		if eye and (st.root.Position - eye).Magnitude > MAX_DISTANCE then continue end
		st.time += dt

		-- fade the "move" clip in with the pet's speed
		local speed = st.root.AssemblyLinearVelocity.Magnitude
		local target = math.clamp((speed - 1.5) / 6, 0, 1)
		st.moveW += (target - st.moveW) * math.min(1, dt * 6)

		local layers = {}
		if st.idle then
			table.insert(layers, { clip = st.idle, t = st.time * (st.idle.speed or 1), w = st.move and (1 - st.moveW) or 1 })
		end
		if st.move and st.moveW > 0.001 then
			table.insert(layers, { clip = st.move, t = st.time * (st.move.speed or 1), w = st.moveW })
		end
		local shot = st.shot
		if shot then
			local clip = shot.clip
			local len = math.max(0.05, clip.length or 1) / (clip.speed or 1)
			shot.t += dt
			local left = len - shot.t
			shot.w = math.min(1, shot.t / FADE, math.max(0, left) / FADE)
			if clip.when == "spawn" and shot.t < FADE then shot.w = 1 end
			if left <= 0 then
				st.shot = nil
			else
				table.insert(layers, { clip = clip, t = shot.t * (clip.speed or 1), w = shot.w, over = true })
			end
		end

		local offsets = Core.blend(layers, st.rig.names)
		for name, motor in st.motors do
			motor.Transform = Core.transform(st.rig, name, offsets[name])
		end
	end
end)

for _, model in CollectionService:GetTagged("ForgePet") do
	task.spawn(setup, model)
end
CollectionService:GetInstanceAddedSignal("ForgePet"):Connect(function(model)
	task.spawn(setup, model)
end)
