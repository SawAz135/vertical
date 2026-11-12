--[[
	Exports the course built by MapBuilder (from the built place file) to JSON,
	for the three.js preview renderer.

	  lune run tools/preview/export.luau build/place.rbxl build/course.json
]]

local fs = require("@lune/fs")
local luau = require("@lune/luau")
local process = require("@lune/process")
local roblox = require("@lune/roblox")
local serde = require("@lune/serde")

local placePath = process.args[1] or "build/place.rbxl"
local outPath = process.args[2] or "build/course.json"
local game = roblox.deserializePlace(fs.readFile(placePath))

local environment = {
	Instance = roblox.Instance,
	Vector3 = roblox.Vector3,
	CFrame = roblox.CFrame,
	Color3 = roblox.Color3,
	Enum = roblox.Enum,
}
local function load(module: any): any
	return luau.load(module.Source, { debugName = module.Name, environment = environment })()
end

local Config = load(game:GetService("ReplicatedStorage").Shared.Config)
local MapBuilder = load(game:GetService("ServerStorage").Modules.MapBuilder)
local course = MapBuilder.build(nil, Config.SEED, Config)

local parts = {}
for _, part in course.model:GetDescendants() do
	if part:IsA("BasePart") and part.Transparency < 1 then
		table.insert(parts, {
			name = part.Name,
			kind = part:GetAttribute("Kind"),
			size = { part.Size.X, part.Size.Y, part.Size.Z },
			cframe = { part.CFrame:GetComponents() },
			color = { part.Color.R, part.Color.G, part.Color.B },
			material = part.Material.Name,
		})
	end
end

fs.writeFile(outPath, serde.encode("json", { seed = Config.SEED, parts = parts }, false))
print(string.format("exported %d parts to %s", #parts, outPath))
