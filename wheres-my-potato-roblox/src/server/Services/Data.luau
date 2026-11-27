--[[ Data: versioned save data with session locking (no duplication across servers).
     - UpdateAsync load: refuses while another live server holds the lock, takes over a stale
       lock (older than LOCK_STALE s)
     - autosave every AUTOSAVE s, save on leave and on BindToClose
     - Studio / unpublished place: in-memory fallback (warns once) ]]
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local Signal = require(ReplicatedStorage.Shared.Util.Signal)

local Data = {}
Data.Loaded = Signal.new()

local VERSION, STORE, AUTOSAVE, LOCK_STALE = 1, "WMP_PlayerData_v1", 75, 600
local store
local memory = {}
local jobId = if game.JobId ~= "" then game.JobId else ("studio-" .. HttpService:GenerateGUID(false))
local profiles: { [Player]: any } = {}

local ok, res = pcall(function() return DataStoreService:GetDataStore(STORE) end)
if ok then store = res else warn("[WMP] DataStore unavailable, memory store:", res) end

local function template()
	local levels = {}
	for _, it in Config.ITEMS do levels[it.id] = 0 end
	return {
		v = VERSION, money = 0, levels = levels, jar = 0, tutorial = false,
		stats = { picked = 0, dumped = 0, gold = 0, purple = 0, earned = 0, time = 0, overflow = 0 },
	}
end
local function sanitize(d)
	local t = template()
	if type(d) ~= "table" then return t end
	t.money = math.max(0, tonumber(d.money) or 0)
	t.jar = math.max(0, math.floor(tonumber(d.jar) or 0))
	t.tutorial = d.tutorial == true
	if type(d.levels) == "table" then
		for _, it in Config.ITEMS do t.levels[it.id] = math.clamp(math.floor(tonumber(d.levels[it.id]) or 0), 0, #it.levels - 1) end
	end
	if type(d.stats) == "table" then for k in t.stats do t.stats[k] = math.max(0, tonumber(d.stats[k]) or 0) end end
	return t
end

local function key(p: Player) return "u_" .. p.UserId end

local function load(p: Player)
	if not store or game.PlaceId == 0 then return sanitize(memory[p.UserId]), true end
	for attempt = 1, 6 do
		local result, busy
		local s, err = pcall(function()
			store:UpdateAsync(key(p), function(old)
				old = old or {}
				local lock = old.lock
				if lock and lock.job ~= jobId and os.time() - (lock.t or 0) < LOCK_STALE then busy = true; return nil end
				old.lock = { job = jobId, t = os.time() }
				result = old
				return old
			end)
		end)
		if s and result then return sanitize(result.data), true end
		if not s then warn("[WMP] load error", err) end
		if busy then task.wait(3) else task.wait(1 + attempt) end
		if not p.Parent then return nil end
	end
	return sanitize(nil), false -- could not lock: play with a fresh profile that is never saved
end

local function save(p: Player, release: boolean)
	local prof = profiles[p]; if not prof or prof.noSave then return end
	if not store or game.PlaceId == 0 then memory[p.UserId] = prof.data; return end
	pcall(function()
		store:UpdateAsync(key(p), function(old)
			old = old or {}
			if old.lock and old.lock.job ~= jobId and os.time() - (old.lock.t or 0) < LOCK_STALE then return nil end
			old.data = prof.data
			old.lock = if release then nil else { job = jobId, t = os.time() }
			return old
		end)
	end)
end

function Data.get(p: Player) local prof = profiles[p]; return prof and prof.data end

Players.PlayerAdded:Connect(function(p)
	local d, locked = load(p)
	if not d or not p.Parent then return end
	profiles[p] = { data = d, t0 = os.clock(), noSave = not locked }
	Data.Loaded:Fire(p, d)
end)
Players.PlayerRemoving:Connect(function(p)
	local prof = profiles[p]
	if prof then prof.data.stats.time += os.clock() - prof.t0; prof.t0 = os.clock() end
	save(p, true); profiles[p] = nil
end)
game:BindToClose(function()
	local n = 0
	for p in profiles do n += 1; task.spawn(function() save(p, true); n -= 1 end) end
	local t = os.clock(); while n > 0 and os.clock() - t < 20 do task.wait(0.2) end
end)
task.spawn(function()
	while true do
		task.wait(AUTOSAVE)
		for p, prof in profiles do prof.data.stats.time += os.clock() - prof.t0; prof.t0 = os.clock(); task.spawn(save, p, false) end
	end
end)

return Data
