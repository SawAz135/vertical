--[[
	Offline tests, no Roblox Studio and no Roblox account needed.
	Run from the project root:

	  rojo build default.project.json -o build/place.rbxl
	  lune run tests/lune/run.luau build/place.rbxl

	1. Opens the built place file and checks every script landed where it should.
	2. Runs tests/smoke.luau (the exact cloud test) against that place, with
	   `require` wired to the ModuleScripts inside the file.
	3. Walks the generated course and checks every jump is physically possible
	   for a default Roblox character.
]]

local fs = require("@lune/fs")
local luau = require("@lune/luau")
local process = require("@lune/process")
local roblox = require("@lune/roblox")

local placePath = process.args[1] or "build/place.rbxl"
local game = roblox.deserializePlace(fs.readFile(placePath))

local failures = 0
local function check(condition: boolean, message: string)
	if condition then
		print("  ok   " .. message)
	else
		failures += 1
		print("  FAIL " .. message)
	end
end

-- Globals a Roblox script expects, taken from Lune's Roblox library.
local environment: { [string]: any } = {
	game = game,
	workspace = game:GetService("Workspace"),
	Instance = roblox.Instance,
	Vector3 = roblox.Vector3,
	Vector2 = roblox.Vector2,
	CFrame = roblox.CFrame,
	Color3 = roblox.Color3,
	Enum = roblox.Enum,
	UDim = roblox.UDim,
	UDim2 = roblox.UDim2,
}

-- `require(ModuleScript)` → compile that ModuleScript's Source with the same globals.
local moduleCache: { [any]: any } = {}
local function requireModule(moduleScript: any): any
	if moduleCache[moduleScript] ~= nil then
		return moduleCache[moduleScript]
	end
	assert(moduleScript.ClassName == "ModuleScript", "require expects a ModuleScript")
	local chunk = luau.load(moduleScript.Source, {
		debugName = moduleScript:GetFullName(),
		environment = environment,
	})
	local result = chunk()
	moduleCache[moduleScript] = result
	return result
end
environment.require = requireModule

---------------------------------------------------------------------------
print("1. place structure (" .. placePath .. ")")
local function find(path: { string }): any
	local node: any = game
	for _, name in path do
		node = node and node:FindFirstChild(name)
	end
	return node
end

local main = find({ "ServerScriptService", "Server", "Main" })
check(main ~= nil and main.ClassName == "Script", "ServerScriptService.Server.Main is a Script")
check(main ~= nil and string.find(main.Source, "MapBuilder.build", 1, true) ~= nil, "Main calls MapBuilder.build")
local hud = find({ "StarterPlayer", "StarterPlayerScripts", "Client", "Hud" })
check(hud ~= nil and hud.ClassName == "LocalScript", "StarterPlayerScripts.Client.Hud is a LocalScript")
local config = find({ "ReplicatedStorage", "Shared", "Config" })
check(config ~= nil and config.ClassName == "ModuleScript", "ReplicatedStorage.Shared.Config is a ModuleScript")
local builder = find({ "ServerStorage", "Modules", "MapBuilder" })
check(builder ~= nil and builder.ClassName == "ModuleScript", "ServerStorage.Modules.MapBuilder is a ModuleScript")

---------------------------------------------------------------------------
print("2. cloud smoke test, run offline")
local smoke = luau.load(fs.readFile("tests/smoke.luau"), { debugName = "smoke", environment = environment })
local ok, result = pcall(smoke)
check(ok, "tests/smoke.luau passes" .. (if ok then "" else ": " .. tostring(result)))

---------------------------------------------------------------------------
print("3. every jump is possible")
local Config = requireModule(config)
local MapBuilder = requireModule(builder)
local course = MapBuilder.build(nil, Config.SEED, Config)

-- Default character: jump height ≈ 7.2 studs, walk speed 16. A running jump
-- clears roughly 11-12 studs edge to edge on the flat; we keep a safe margin.
local MAX_GAP = 9.5
local MAX_RISE = 4.5

local walkable = {}
for _, part in course.model:GetDescendants() do
	if part:IsA("BasePart") then
		local kind = part:GetAttribute("Kind")
		if kind == "Static" or kind == "Mover" or kind == "Checkpoint" or kind == "Finish" then
			table.insert(walkable, part)
		end
	end
end
table.sort(walkable, function(a, b)
	return a.CFrame.Position.Z < b.CFrame.Position.Z
end)

local worstGap, worstRise = 0, 0
for i = 2, #walkable do
	local a, b = walkable[i - 1], walkable[i]
	-- Edge-to-edge distance on the ground plane between two axis-aligned pads.
	local dx = math.max(0, math.abs(b.CFrame.Position.X - a.CFrame.Position.X) - (a.Size.X + b.Size.X) / 2)
	local dz = math.max(0, math.abs(b.CFrame.Position.Z - a.CFrame.Position.Z) - (a.Size.Z + b.Size.Z) / 2)
	local gap = math.sqrt(dx * dx + dz * dz)
	local rise = (b.CFrame.Position.Y + b.Size.Y / 2) - (a.CFrame.Position.Y + a.Size.Y / 2)
	worstGap = math.max(worstGap, gap)
	worstRise = math.max(worstRise, rise)
	if gap > MAX_GAP or rise > MAX_RISE then
		check(false, string.format("%s -> %s gap %.1f rise %.1f", a.Name, b.Name, gap, rise))
	end
end
check(worstGap <= MAX_GAP, string.format("largest gap %.1f studs (limit %.1f)", worstGap, MAX_GAP))
check(worstRise <= MAX_RISE, string.format("largest rise %.1f studs (limit %.1f)", worstRise, MAX_RISE))
check(#course.movers > 0, string.format("%d moving platforms", #course.movers))
check(#course.spinners > 0, string.format("%d spinning lasers", #course.spinners))
print(string.format("  course: %d parts, %d walkable pads", course.partCount, #walkable))

-- Same seed must give the same map (multiplayer servers must agree).
local again = MapBuilder.build(nil, Config.SEED, Config)
check(again.partCount == course.partCount and again.finish.CFrame.Position == course.finish.CFrame.Position, "same seed, same map")

print()
if failures > 0 then
	print(string.format("%d check(s) failed", failures))
	process.exit(1)
end
print("all checks passed")
