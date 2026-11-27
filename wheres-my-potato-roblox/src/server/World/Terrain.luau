--[[ Terrain: writes the golden potato desert into Roblox Terrain from the shared Land
     height function (dunes, slip faces, mountains on the horizon). Columns are written in
     32×32 chunks, only up to the chunk's highest point, with a fractional top voxel so the
     surface is smooth and matches the 3D potatoes laid on it by the clients.
     Also: lighting, atmosphere, volumetric clouds, post effects. ]]
local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Land = require(ReplicatedStorage.Shared.Land)
local Config = require(ReplicatedStorage.Shared.Config)

local T = {}
local RES = 4

function T.build()
	local terrain = workspace.Terrain
	terrain:Clear()
	terrain:SetMaterialColor(Enum.Material.Sand, Color3.fromRGB(214, 160, 70))
	terrain:SetMaterialColor(Enum.Material.Sandstone, Color3.fromRGB(196, 140, 62))
	terrain.Decoration = false
	local HALF = Config.WORLD
	local N = (2 * HALF) // RES
	local CH = 32
	for cz = 0, N - 1, CH do
		for cx = 0, N - 1, CH do
			-- heights of the chunk columns
			local hs, top = {}, 0
			for i = 0, CH - 1 do
				hs[i] = {}
				for k = 0, CH - 1 do
					local x = -HALF + (cx + i + 0.5) * RES
					local z = -HALF + (cz + k + 0.5) * RES
					local h = Land.height(x, z)
					hs[i][k] = h
					if h > top then top = h end
				end
			end
			local y0 = -8
			local ny = math.max(3, math.ceil((top - y0) / RES) + 1)
			local mats, occ = table.create(CH), table.create(CH)
			for i = 1, CH do
				mats[i] = table.create(ny); occ[i] = table.create(ny)
				for j = 1, ny do
					mats[i][j] = table.create(CH); occ[i][j] = table.create(CH)
					local yb = y0 + (j - 1) * RES -- voxel bottom
					for k = 1, CH do
						local h = hs[i - 1][k - 1]
						local f = math.clamp((h - yb) / RES, 0, 1)
						if f > 0 then
							mats[i][j][k] = if h > 90 and (yb > 70) then Enum.Material.Sandstone else Enum.Material.Sand
							occ[i][j][k] = math.max(f, 0.06)
						else
							mats[i][j][k] = Enum.Material.Air; occ[i][j][k] = 0
						end
					end
				end
			end
			local min = Vector3.new(-HALF + cx * RES, y0, -HALF + cz * RES)
			local region = Region3.new(min, min + Vector3.new(CH * RES, ny * RES, CH * RES)):ExpandToGrid(RES)
			terrain:WriteVoxels(region, RES, mats, occ)
		end
		task.wait() -- keep the server responsive while the desert is generated
	end
end

function T.lighting()
	Lighting.Technology = Enum.Technology.Future
	Lighting.GlobalShadows = true
	Lighting.Brightness = 3
	Lighting.EnvironmentDiffuseScale = 1; Lighting.EnvironmentSpecularScale = 1
	local function add(class, props)
		local o = Lighting:FindFirstChildOfClass(class) or Instance.new(class)
		for k, v in props do (o :: any)[k] = v end
		o.Parent = Lighting
		return o
	end
	add("Atmosphere", { Density = 0.3, Offset = 0.12, Color = Color3.fromRGB(235, 205, 160), Decay = Color3.fromRGB(190, 120, 70), Glare = 0.55, Haze = 1.7 })
	add("Sky", { SunAngularSize = 14, MoonAngularSize = 9, StarCount = 4000, CelestialBodiesShown = true })
	add("BloomEffect", { Intensity = 0.55, Size = 30, Threshold = 1.15 })
	add("ColorCorrectionEffect", { Saturation = 0.18, Contrast = 0.08, Brightness = 0.02, TintColor = Color3.fromRGB(255, 246, 232) })
	add("SunRaysEffect", { Intensity = 0.06, Spread = 0.7 })
	local clouds = workspace.Terrain:FindFirstChildOfClass("Clouds") or Instance.new("Clouds")
	clouds.Cover = 0.42; clouds.Density = 0.55; clouds.Color = Color3.fromRGB(255, 244, 228); clouds.Parent = workspace.Terrain
end

return T
