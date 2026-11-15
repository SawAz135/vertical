--[[
	Roblox Forge - voxel figurine look (ServerScriptService)

	Voxel pets and animals are made of merged blocks. Every part with the
	attribute ForgeVox (the size of one little cube, in studs) gets the
	MaterialVariant "ForgeVoxel": a light tile of 8×8 cubes with bevelled edges
	and a slightly different tint per cube, tinted by the part's Color. So the
	blocks show the little cubes they are made of, without adding parts.

	The robot (Roblox Push) uploads the tile and puts MaterialService/ForgeVoxel
	in the place when it builds it. Without it, this script does nothing.
	A copy of the material is made per cube size (pets and map animals differ).
]]
local MaterialService = game:GetService("MaterialService")

local base = MaterialService:WaitForChild("ForgeVoxel", 20)
if not base or not base:IsA("MaterialVariant") then
	return
end
local CUBES = base:GetAttribute("Cubes") or 8

local made: { [string]: boolean } = {}
local function variantFor(cube: number): string
	local name = string.format("ForgeVoxel_%d", math.floor(cube * 1000 + 0.5))
	if not made[name] then
		made[name] = true
		if not MaterialService:FindFirstChild(name) then
			local ok, mv = pcall(function()
				return base:Clone()
			end)
			if ok and mv then
				mv.Name = name
				mv.StudsPerTile = cube * CUBES
				mv.Parent = MaterialService
			else
				return base.Name -- clone refused: the base size is still better than nothing
			end
		end
	end
	return name
end

local function scaleOf(part: BasePart): number
	local model = part:FindFirstAncestorOfClass("Model")
	local ok, s = pcall(function()
		return model and model:GetScale() or 1
	end)
	return ok and s or 1
end

local function apply(inst: Instance)
	if not inst:IsA("BasePart") then
		return
	end
	local cube = inst:GetAttribute("ForgeVox")
	if typeof(cube) ~= "number" or cube <= 0 then
		return
	end
	if inst.Material ~= base.BaseMaterial then
		return -- the variant only applies on its base material (eyes, neon… keep their own)
	end
	inst.MaterialVariant = variantFor(cube * scaleOf(inst))
end

for _, d in workspace:GetDescendants() do
	apply(d)
end
workspace.DescendantAdded:Connect(apply)
