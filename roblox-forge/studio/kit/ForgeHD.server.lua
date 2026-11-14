--[[
	Roblox Forge - HD meshes (server, ServerScriptService).
	The Roblox Push robot rendered this pet in Blender, uploaded the smooth HD mesh
	to Roblox and wrote its id in ReplicatedStorage.ForgeHDMeshes.
	Here the HD mesh is loaded (InsertService works for assets owned by the game's
	creator), fitted onto the pet's own model and the original blocks are hidden:
	the pet keeps its rig, its effects and its follow logic, and the HD mesh moves
	with its Body. If loading fails, the normal pet stays as it is.
]]
local InsertService = game:GetService("InsertService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local module = ReplicatedStorage:WaitForChild("ForgeHDMeshes", 15)
local Pets = ReplicatedStorage:WaitForChild("ForgePets", 15)
if not module or not Pets then return end
local ok, meshes = pcall(require, module)
if not ok or type(meshes) ~= "table" then return end

local function dress(pet, assetId)
	local loaded, asset = pcall(InsertService.LoadAsset, InsertService, assetId)
	if not loaded then
		warn(("[ForgeHD] %s: could not load mesh %d (%s)"):format(pet.Name, assetId, tostring(asset)))
		return
	end
	local hd = asset:FindFirstChildWhichIsA("Model") or asset
	local body = pet:FindFirstChild("Body") or pet:FindFirstChildWhichIsA("BasePart", true)
	if not body then return end
	-- fit: same size and same centre as the pet made of blocks
	local cf0, size0 = pet:GetBoundingBox()
	local _, size1 = hd:GetBoundingBox()
	local k = math.max(size0.X, size0.Y, size0.Z) / math.max(size1.X, size1.Y, size1.Z, 1e-3)
	if hd:IsA("Model") then hd:ScaleTo(hd:GetScale() * k) end
	local cf1 = hd:GetBoundingBox()
	hd:PivotTo(CFrame.new(cf0.Position - cf1.Position) * hd:GetPivot())
	-- hide the blocks (they keep the rig and the effects), add the HD meshes
	for _, d in pet:GetDescendants() do
		if d:IsA("BasePart") then
			d:SetAttribute("ForgeHDHidden", d.Transparency)
			d.Transparency = 1
		elseif d:IsA("Decal") then
			d.Transparency = 1
		end
	end
	for _, m in hd:GetDescendants() do
		if m:IsA("BasePart") then
			m.Anchored = false
			m.CanCollide = false
			m.CanQuery = false
			m.CanTouch = false
			m.Massless = true
			m.Name = "HD_" .. m.Name
			m:SetAttribute("ForgeHD", true)
			m.Parent = pet -- ForgePetController joins it to the Body like any other part
		end
	end
	asset:Destroy()
	pet:SetAttribute("ForgeHD", assetId)
	print(("[ForgeHD] %s is now in HD"):format(pet.Name))
end

for name, id in meshes do
	local pet = Pets:FindFirstChild(name)
	if pet and type(id) == "number" then task.spawn(dress, pet, id) end
end
