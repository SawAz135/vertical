--[[
	Roblox Push - add packs to a built game (runs with Lune inside GitHub Actions).

	  lune run merge.luau <base.rbxl|rbxlx> <out.rbxl> <pack1.rbxm> [pack2.rbxm ...]

	Each pack model is a Folder whose children are named after where they go:
	ReplicatedStorage, ServerScriptService, StarterPlayerScripts, Workspace, ...
	Their contents are moved into the game: an object with the same name is
	replaced, two Folders with the same name are merged. Nothing else changes.
]]
local fs = require("@lune/fs")
local process = require("@lune/process")
local roblox = require("@lune/roblox")

local args = process.args
assert(#args >= 3, "usage: merge.luau <base> <out> <pack.rbxm> ...")
local game = roblox.deserializePlace(fs.readFile(args[1]))

local PLAYER = { StarterPlayerScripts = true, StarterCharacterScripts = true }
local function container(name: string)
	if PLAYER[name] then
		local sp = game:GetService("StarterPlayer")
		local c = sp:FindFirstChild(name)
		if not c then
			c = roblox.Instance.new(name)
			c.Parent = sp
		end
		return c
	end
	local ok, service = pcall(function()
		return game:GetService(name)
	end)
	return ok and service or nil
end

local added, replaced = 0, 0
local function mergeInto(dst, src)
	for _, child in src:GetChildren() do
		local existing = dst:FindFirstChild(child.Name)
		if existing and existing.ClassName == "Folder" and child.ClassName == "Folder" then
			mergeInto(existing, child)
		else
			if existing then
				existing:Destroy()
				replaced += 1
			end
			child.Parent = dst
			added += 1
		end
	end
end

for i = 3, #args do
	for _, root in roblox.deserializeModel(fs.readFile(args[i])) do
		for _, group in root:GetChildren() do
			local target = container(group.Name)
			if target then
				mergeInto(target, group)
			else
				print("skipped unknown container " .. group.Name)
			end
		end
	end
end

fs.writeFile(args[2], roblox.serializePlace(game))
print(string.format("merged %d pack(s): %d object(s) added, %d replaced", #args - 2, added, replaced))
