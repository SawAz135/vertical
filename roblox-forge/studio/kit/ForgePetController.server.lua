--[[
	Roblox Forge - pet controller (server).
	Gives every player a pet from ReplicatedStorage.ForgePets and makes it follow them.
	Pick a pet per player with:  player:SetAttribute("ForgePet", "PetName")
	Play an animation made in the studio:  player:SetAttribute("ForgePetAnim", "Danse")
	The pet moves with physics (AlignPosition / AlignOrientation), so it glides smoothly.
]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local CollectionService = game:GetService("CollectionService")
local HttpService = game:GetService("HttpService")

local Pets = ReplicatedStorage:WaitForChild("ForgePets")
local Config = require(ReplicatedStorage:WaitForChild("ForgeConfig"))

local function readFx(model)
	local ok, fx = pcall(HttpService.JSONDecode, HttpService, model:GetAttribute("ForgeFX") or "{}")
	return ok and fx or {}
end

-- Joins the parts with Motor6Ds following the bone hierarchy made in Forge Studio
-- (ForgeAnimData.rig). An invisible ForgeRoot carries the physics, so even the Body
-- can be animated by ForgePetAnim (client). Without animation data every part hangs
-- from the Body and stays rigid.
local function readRig(model)
	local data = model:FindFirstChild("ForgeAnimData")
	if not data then return {} end
	local ok, result = pcall(require, data)
	return ok and type(result) == "table" and result.rig or {}
end

local function rigTogether(model)
	local body = model:FindFirstChild("Body") or model:FindFirstChildWhichIsA("BasePart", true)
	local rig = readRig(model)
	local root = Instance.new("Part")
	root.Name = "ForgeRoot"
	root.Size = Vector3.new(0.4, 0.4, 0.4)
	root.Transparency = 1
	root.CFrame = body.CFrame
	root.Parent = model
	model.PrimaryPart = root
	local function joint(part0, part1)
		local motor = Instance.new("Motor6D")
		motor.Name = "ForgeJoint"
		motor.Part0 = part0
		motor.Part1 = part1
		motor.C0 = part0.CFrame:Inverse() * part1.CFrame
		motor.C1 = CFrame.identity
		motor.Parent = part1
	end
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") then
			d.Anchored = false
			d.CanCollide = false
			d.CanQuery = false
			d.CanTouch = false
			d.Massless = d ~= root
		end
	end
	joint(root, body)
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") and d ~= body and d ~= root then
			local info = rig[d.Name]
			local parent = info and info.parent and model:FindFirstChild(info.parent)
			joint(parent and parent:IsA("BasePart") and parent or body, d)
		end
	end
	return root, body
end

local function addTrail(body, fx)
	local tr = fx.trail
	if not (tr and tr.on) then return end
	local half = body.Size.Y * 0.35
	local a0 = Instance.new("Attachment")
	a0.Position = Vector3.new(0, half, 0)
	a0.Parent = body
	local a1 = Instance.new("Attachment")
	a1.Position = Vector3.new(0, -half, 0)
	a1.Parent = body
	local trail = Instance.new("Trail")
	trail.Attachment0 = a0
	trail.Attachment1 = a1
	trail.Lifetime = tr.length or 0.6
	trail.LightEmission = 1
	trail.FaceCamera = true
	trail.Color = ColorSequence.new(Color3.fromHex(tr.c1 or "#ffffff"), Color3.fromHex(tr.c2 or tr.c1 or "#ffffff"))
	trail.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.15), NumberSequenceKeypoint.new(1, 1) })
	trail.WidthScale = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(1, 0) })
	trail.Parent = body
end

local active = {}

local function removePet(player)
	local state = active[player]
	if state then
		state.model:Destroy()
		active[player] = nil
	end
end

local function spawnPet(player, character)
	removePet(player)
	local root = character:WaitForChild("HumanoidRootPart", 10)
	if not root or not player.Parent then return end
	local name = player:GetAttribute("ForgePet") or Config.DefaultPet
	local template = Pets:FindFirstChild(name) or Pets:FindFirstChildWhichIsA("Model")
	if not template then return end

	local model = template:Clone()
	local petRoot, body = rigTogether(model)
	local fx = readFx(model)
	model.Name = player.Name .. "_Pet"
	model:SetAttribute("ForgeOwner", player.UserId)
	model:PivotTo(root.CFrame * CFrame.new(Config.Offset))

	local attachment = Instance.new("Attachment")
	attachment.Name = "ForgeAlign"
	attachment.Parent = petRoot
	local align = Instance.new("AlignPosition")
	align.Mode = Enum.PositionAlignmentMode.OneAttachment
	align.Attachment0 = attachment
	align.MaxForce = 1e6
	align.MaxVelocity = 80
	align.Responsiveness = 18
	align.Parent = petRoot
	local orient = Instance.new("AlignOrientation")
	orient.Mode = Enum.OrientationAlignmentMode.OneAttachment
	orient.Attachment0 = attachment
	orient.MaxTorque = 1e6
	orient.Responsiveness = 14
	orient.Parent = petRoot

	addTrail(body, fx)
	model.Parent = workspace
	pcall(function() petRoot:SetNetworkOwner(nil) end)
	CollectionService:AddTag(model, "ForgePet")
	active[player] = { model = model, body = body, align = align, orient = orient, fx = fx, root = root, seed = math.random() * 10 }
end

RunService.Heartbeat:Connect(function()
	local t = os.clock()
	for _, s in active do
		if not s.root.Parent then continue end
		local fx = s.fx
		local floatOn = fx.float and fx.float.on
		local bob = floatOn and math.sin(t * (fx.float.speed or 2) + s.seed) * (fx.float.height or 0.6) or 0
		local target = s.root.CFrame * CFrame.new(Config.Offset + Vector3.new(0, bob, 0))
		s.align.Position = target.Position
		local spin = (fx.spin and fx.spin.on) and t * math.rad(fx.spin.speed or 90) or 0
		s.orient.CFrame = s.root.CFrame.Rotation * CFrame.Angles(0, spin, 0)
	end
end)

local function hook(player)
	player.CharacterAdded:Connect(function(character)
		task.wait(0.5)
		spawnPet(player, character)
	end)
	if player.Character then task.spawn(spawnPet, player, player.Character) end
	player:GetAttributeChangedSignal("ForgePetAnim"):Connect(function()
		local state = active[player]
		local name = player:GetAttribute("ForgePetAnim")
		if state and type(name) == "string" and name ~= "" then
			state.model:SetAttribute("ForgeAnimPlay", name .. "#" .. string.format("%.3f", os.clock()))
			player:SetAttribute("ForgePetAnim", nil)
		end
	end)
	player:GetAttributeChangedSignal("ForgePet"):Connect(function()
		if player.Character then spawnPet(player, player.Character) end
	end)
end
Players.PlayerAdded:Connect(hook)
for _, player in Players:GetPlayers() do hook(player) end
Players.PlayerRemoving:Connect(removePet)
