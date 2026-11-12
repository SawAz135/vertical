-- Cloud smoke test. Runs on Roblox's own servers through the Open Cloud
-- Luau Execution API against the published place (scripts/run-luau.sh).
-- It loads the real modules from the place, builds the course in memory and
-- checks it. Anything that errors here shows up as a FAILED task with the error.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")

-- FindFirstChild (not WaitForChild): the place is fully loaded when this runs, and
-- it keeps the script runnable offline under Lune (tests/lune/run.luau).
local function child(parent: Instance, name: string): Instance
	local found = parent:FindFirstChild(name)
	if not found then
		error(string.format("missing %s.%s in the published place", parent:GetFullName(), name))
	end
	return found
end

local Config = require(child(child(ReplicatedStorage, "Shared"), "Config"))
local MapBuilder = require(child(child(ServerStorage, "Modules"), "MapBuilder"))

local course = MapBuilder.build(nil, Config.SEED, Config)

local failures = {}
local function check(condition, message)
	if not condition then
		table.insert(failures, message)
	end
end

check(#course.checkpoints == Config.STAGES, "checkpoint count")
check(course.finish ~= nil, "finish exists")
check(course.spawn ~= nil and course.spawn:IsA("SpawnLocation"), "spawn is a SpawnLocation")
for index, checkpoint in course.checkpoints do
	check(checkpoint:GetAttribute("Stage") == index, "checkpoint " .. index .. " stage attribute")
	if index > 1 then
		local previous = course.checkpoints[index - 1]
		check(checkpoint.CFrame.Position.Z > previous.CFrame.Position.Z, "checkpoint " .. index .. " moves forward")
	end
end
check(course.finish.CFrame.Position.Z > course.checkpoints[#course.checkpoints].CFrame.Position.Z, "finish after last checkpoint")

-- The scripts that run the game must be in the published place.
local server = game:GetService("ServerScriptService"):FindFirstChild("Server")
check(server ~= nil and server:FindFirstChild("Main") ~= nil, "server Main script published")

course.model:Destroy()

if #failures > 0 then
	error("SMOKE FAILED: " .. table.concat(failures, "; "))
end

print(string.format("SMOKE OK: %d parts, %d checkpoints, %d movers, %d spinners",
	course.partCount, #course.checkpoints, #course.movers, #course.spinners))
return { ok = true, parts = course.partCount, movers = #course.movers, spinners = #course.spinners }
