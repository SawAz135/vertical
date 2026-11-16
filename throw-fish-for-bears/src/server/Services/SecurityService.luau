--[[ SecurityService: every client -> server remote goes through Security.on(),
     which enforces a per-player token bucket rate limit, type checks the
     arguments with a small schema and swallows handler errors. ]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Net = require(ReplicatedStorage.Shared.Net)

local Security = {}
local buckets: { [Player]: { [string]: { tokens: number, t: number } } } = {}

local function allow(player: Player, name: string): boolean
	local rate = Net.ClientToServer[name] or 2
	local per = buckets[player]
	if not per then
		per = {}
		buckets[player] = per
	end
	local b = per[name]
	local now = os.clock()
	if not b then
		b = { tokens = rate * 2, t = now }
		per[name] = b
	end
	b.tokens = math.min(rate * 2, b.tokens + (now - b.t) * rate)
	b.t = now
	if b.tokens < 1 then
		return false
	end
	b.tokens -= 1
	return true
end

local CHECK = {
	number = function(v) return type(v) == "number" and v == v and math.abs(v) < 1e9 end,
	string = function(v) return type(v) == "string" and #v <= 64 end,
	boolean = function(v) return type(v) == "boolean" end,
	Vector3 = function(v) return typeof(v) == "Vector3" and v.Magnitude < 1e5 and v.X == v.X end,
	table = function(v) return type(v) == "table" end,
	any = function() return true end,
	["string?"] = function(v) return v == nil or (type(v) == "string" and #v <= 64) end,
	["number?"] = function(v) return v == nil or (type(v) == "number" and v == v and math.abs(v) < 1e9) end,
	["boolean?"] = function(v) return v == nil or type(v) == "boolean" end,
}

-- Security.on("Cast", {"number"}, function(player, power) ... end)
function Security.on(name: string, schema: { string }, handler)
	local remote = Net.event(name)
	remote.OnServerEvent:Connect(function(player, ...)
		if not allow(player, name) then return end
		local args = table.pack(...)
		for i, kind in schema do
			local ok = CHECK[kind]
			if not ok or not ok(args[i]) then
				return
			end
		end
		local ok, err = pcall(handler, player, table.unpack(args, 1, #schema))
		if not ok then
			warn(("[TFB] %s handler error for %s: %s"):format(name, player.Name, tostring(err)))
		end
	end)
end

-- validates a list of short id strings
function Security.idList(v, maxLen: number): { string }?
	if type(v) ~= "table" or #v > maxLen then return nil end
	local out = {}
	for _, id in v do
		if type(id) ~= "string" or #id > 32 then return nil end
		table.insert(out, id)
	end
	return out
end

Players.PlayerRemoving:Connect(function(p)
	buckets[p] = nil
end)

return Security
