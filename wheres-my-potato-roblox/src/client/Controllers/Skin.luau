--[[ Skin: the server's potatoes (jar top layer, bin / conveyor physics potatoes, Gérard's
     golden display) are plain ellipsoids, because EditableMesh content created on the server
     never replicates to players. Every client dresses each tagged potato with its own
     sculpted mesh: a local MeshPart welded onto the server part (so it follows physics and
     the rising jar exactly), and the original hidden with LocalTransparencyModifier.
     Budgeted per frame, capped, cleaned up when the server part goes away. ]]
local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local PM = require(ReplicatedStorage.Shared.PotatoMesh)

local Skin = {}
local MAX = 700
local PER_FRAME = 24
local folder = Instance.new("Folder"); folder.Name = "PotatoSkins"; folder.Parent = workspace
local skins: { [BasePart]: BasePart } = {}
local count = 0
local queue: { BasePart } = {}

local function visualSize(p: BasePart): Vector3
	local m = p:FindFirstChildOfClass("SpecialMesh")
	-- the ellipsoid on a Part = Size × mesh Scale (a Ball's mesh is scaled to look like a potato)
	return if m then p.Size * m.Scale else p.Size
end

local function dress(p: BasePart)
	if skins[p] or not p.Parent or count >= MAX then return end
	local s = PM.make((p:GetAttribute("r") :: number?) or 0.5)
	if not s then return end
	s.Anchored = false; s.CanCollide = false; s.CanQuery = false; s.CanTouch = false; s.Massless = true
	s.Size = visualSize(p)
	s.Color = p.Color; s.Material = p.Material; s.Reflectance = p.Reflectance; s.CastShadow = p.CastShadow
	s.CFrame = p.CFrame
	local w = Instance.new("Weld"); w.Part0 = p; w.Part1 = s; w.Parent = s
	s.Parent = folder
	p.LocalTransparencyModifier = 1
	skins[p] = s; count += 1
	-- keep in sync if the server recolours / resizes it
	local c1 = p:GetPropertyChangedSignal("Color"):Connect(function() s.Color = p.Color end)
	local c2 = p:GetPropertyChangedSignal("Size"):Connect(function() s.Size = visualSize(p) end)
	local c3 = p:GetPropertyChangedSignal("LocalTransparencyModifier"):Connect(function() p.LocalTransparencyModifier = 1 end)
	s.Destroying:Connect(function() c1:Disconnect(); c2:Disconnect(); c3:Disconnect() end)
end

local function undress(p: BasePart)
	local s = skins[p]
	if s then skins[p] = nil; count -= 1; s:Destroy() end
end

function Skin.start()
	if #PM.templates == 0 and not PM.build() then return end -- no EditableMesh here: keep the ellipsoids
	CollectionService:GetInstanceAddedSignal("PotatoSkin"):Connect(function(p)
		if p:IsA("BasePart") then table.insert(queue, p) end
	end)
	CollectionService:GetInstanceRemovedSignal("PotatoSkin"):Connect(function(p)
		if p:IsA("BasePart") then undress(p) end
	end)
	for _, p in CollectionService:GetTagged("PotatoSkin") do
		if p:IsA("BasePart") then table.insert(queue, p) end
	end
	RunService.Heartbeat:Connect(function()
		local n = 0
		while n < PER_FRAME and #queue > 0 do
			local p = table.remove(queue) :: BasePart
			if p.Parent then dress(p); n += 1 end
		end
	end)
	-- server parts that are streamed out / destroyed without a tag removal
	task.spawn(function()
		while true do
			task.wait(2)
			for p in skins do if not p.Parent then undress(p) end end
		end
	end)
end

return Skin
