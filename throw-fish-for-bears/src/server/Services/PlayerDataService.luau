--[[ PlayerDataService: versioned save data with session locking.
     - load with UpdateAsync: refuses to load while another live server holds the
       lock (retries, then takes over a stale lock older than LOCK_STALE seconds)
     - autosave every AUTOSAVE seconds, save on leave and on BindToClose
     - migrations by version number, validation of every field on load
     - Studio / unpublished place: falls back to an in-memory store (warns once)
     Temporary state (fishing, captures, controlled bears) is never saved. ]]
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")

local Net = require(ReplicatedStorage.Shared.Net)
local E = require(ReplicatedStorage.Shared.Config.EconomyConfig)
local RodConfig = require(ReplicatedStorage.Shared.Config.RodConfig)
local FishConfig = require(ReplicatedStorage.Shared.Config.FishConfig)
local BearConfig = require(ReplicatedStorage.Shared.Config.BearConfig)
local RarityConfig = require(ReplicatedStorage.Shared.Config.RarityConfig)
local Signal = require(ReplicatedStorage.Shared.Util.Signal)

local PlayerData = {}
PlayerData.Loaded = Signal.new() -- (player, data)

local VERSION = 2
local STORE_NAME = "TFB_PlayerData_v1"
local AUTOSAVE = 90
local LOCK_STALE = 900

local store
local memory = {} -- fallback store
local jobId = if game.JobId ~= "" then game.JobId else ("studio-" .. HttpService:GenerateGUID(false))
local profiles: { [Player]: any } = {}
local loading: { [Player]: boolean } = {}

local ok, res = pcall(function()
	return DataStoreService:GetDataStore(STORE_NAME)
end)
if ok then store = res else warn("[TFB] DataStore unavailable, using memory store:", res) end

local function template()
	return {
		v = VERSION,
		money = E.StartMoney,
		earned = 0,
		rods = { owned = { Starter = true }, equipped = "Starter" },
		strength = 1,
		strengthGain = 1, -- strength added per lift
		capacity = 1,
		fish = {}, -- array of { id, s, r, w, v }
		selectedFish = nil,
		bears = {}, -- map id -> { id, s, r, w, v, placed, x, z, t }
		index = { fish = {}, bears = {} }, -- fish[s] = { n = count, best = kg, v = {variant=true} }; bears[s] = { [rarity]=true, n }
		indexPending = { Fish = 0, Bears = 0 },
		daily = { streak = 0, last = 0 },
		settings = { lowFx = false },
		stats = { fish = 0, bears = 0, throws = 0 },
		bestThrow = 0, -- longest successful throw (studs)
		tutorial = 0, -- tutorial step reached (TUTORIAL_DONE = finished)
		tutorialPaid = false,
		fishers = { n = 0, lv = { 1, 1 }, bucket = 1, stored = {} }, -- hired fishermen + their bucket
		indexClaims = {}, -- [section key] = true (Index completion rewards taken)
		indexLuck = 0, -- permanent fishing luck bonus from Index rewards (+0.05 = +5%)
		nextId = 1,
	}
end

local function migrate(data)
	if type(data) ~= "table" then return template() end
	data.v = data.v or 0
	if data.v < 2 then -- economy x100: bring the old savings / pending rewards to the new scale
		data.money = (tonumber(data.money) or 0) * E.MoneyMult
		data.earned = (tonumber(data.earned) or 0) * E.MoneyMult
		if type(data.indexPending) == "table" then
			data.indexPending.Fish = (tonumber(data.indexPending.Fish) or 0) * E.MoneyMult
			data.indexPending.Bears = (tonumber(data.indexPending.Bears) or 0) * E.MoneyMult
		end
	end
	data.v = VERSION
	return data
end

-- validation: clamp / drop anything malformed so a corrupt save never breaks the game
local function sanitize(d)
	local t = template()
	for k, v in t do
		if type(d[k]) ~= type(v) and not (k == "selectedFish") then
			d[k] = v
		end
	end
	d.money = math.max(0, tonumber(d.money) or 0)
	d.strength = math.max(0, math.floor(tonumber(d.strength) or 0))
	d.strengthGain = math.clamp(math.floor(tonumber(d.strengthGain) or 1), 1, E.Strength.maxGain)
	d.capacity = math.clamp(math.floor(tonumber(d.capacity) or 1), 1, E.Capacity.maxLevel)
	if type(d.rods.owned) ~= "table" then d.rods.owned = { Starter = true } end
	d.rods.owned.Starter = true
	for id in d.rods.owned do
		if not RodConfig.Rods[id] then d.rods.owned[id] = nil end
	end
	if not d.rods.owned[d.rods.equipped] then d.rods.equipped = "Starter" end
	local fish = {}
	for _, f in d.fish do
		if type(f) == "table" and FishConfig.get(f.s) and type(f.id) == "string" and type(f.w) == "number" then
			f.v = if RarityConfig.Variants[f.v] then f.v else "Normal"
			table.insert(fish, f)
		end
	end
	d.fish = fish
	-- fishermen + bucket
	local fd = d.fishers
	fd.n = math.clamp(math.floor(tonumber(fd.n) or 0), 0, 2)
	if type(fd.lv) ~= "table" then fd.lv = { 1, 1 } end
	for i = 1, 2 do fd.lv[i] = math.clamp(math.floor(tonumber(fd.lv[i]) or 1), 1, 10) end
	fd.bucket = math.clamp(math.floor(tonumber(fd.bucket) or 1), 1, 5)
	local stored = {}
	if type(fd.stored) == "table" then
		for _, f in fd.stored do
			if type(f) == "table" and FishConfig.get(f.s) and type(f.id) == "string" and type(f.w) == "number" then
				f.v = if RarityConfig.Variants[f.v] then f.v else "Normal"
				table.insert(stored, f)
			end
		end
	end
	fd.stored = stored
	for id, b in d.bears do
		if type(b) ~= "table" or not BearConfig.get(b.s) or not RarityConfig.Tiers[b.r] or type(b.w) ~= "number" then
			d.bears[id] = nil
		else
			b.id = id
			b.v = if RarityConfig.Variants[b.v] then b.v else "Normal"
			b.placed = b.placed == true
		end
	end
	return d
end

local function key(player: Player) return "u_" .. player.UserId end

local function loadRaw(player: Player)
	if not store then
		return memory[key(player)] and table.clone(memory[key(player)]) or nil, true
	end
	for attempt = 1, 6 do
		local result, lockedByOther
		local ok2, err = pcall(function()
			store:UpdateAsync(key(player), function(old)
				old = old or template()
				local lock = old._lock
				if lock and lock.job ~= jobId and os.time() - (lock.t or 0) < LOCK_STALE and attempt < 6 then
					lockedByOther = true
					return nil -- do not write
				end
				old._lock = { job = jobId, t = os.time() }
				result = old
				return old
			end)
		end)
		if ok2 and result then
			return result, true
		end
		if not ok2 then warn("[TFB] load attempt", attempt, err) end
		if lockedByOther then
			warn("[TFB] save is locked by another server, retrying", player.Name)
		end
		task.wait(attempt * 1.5)
		if not player.Parent then return nil, false end
	end
	return nil, false
end

function PlayerData.load(player: Player)
	if profiles[player] or loading[player] then return profiles[player] end
	loading[player] = true
	local raw, success = loadRaw(player)
	loading[player] = nil
	if not player.Parent then return nil end
	if not success then
		player:Kick("Your data could not be loaded. Please rejoin in a moment.")
		return nil
	end
	local data = sanitize(migrate(raw or template()))
	data._lock = nil
	profiles[player] = data
	PlayerData.Loaded:Fire(player, data)
	return data
end

function PlayerData.get(player: Player)
	return profiles[player]
end

local function snapshot(data)
	local copy = table.clone(data)
	copy._lock = nil
	return HttpService:JSONDecode(HttpService:JSONEncode(copy)) -- deep copy, JSON safe
end

function PlayerData.save(player: Player, release: boolean?)
	local data = profiles[player]
	if not data then return end
	local snap = snapshot(data)
	if not store then
		memory[key(player)] = snap
		return
	end
	for attempt = 1, 4 do
		local ok2, err = pcall(function()
			store:UpdateAsync(key(player), function(old)
				if old and old._lock and old._lock.job ~= jobId and os.time() - (old._lock.t or 0) < LOCK_STALE then
					return nil -- another server owns this save now: never overwrite it
				end
				snap._lock = if release then nil else { job = jobId, t = os.time() }
				return snap
			end)
		end)
		if ok2 then return end
		warn("[TFB] save attempt", attempt, err)
		task.wait(attempt)
	end
end

-- replicate one top level key (or everything with "*") to the owner
function PlayerData.push(player: Player, k: string)
	local data = profiles[player]
	if not data then return end
	if k == "*" then
		Net.event("Data"):FireClient(player, "*", snapshot(data))
	else
		Net.event("Data"):FireClient(player, k, data[k])
	end
end

function PlayerData.newId(player: Player): string
	local data = profiles[player]
	local n = data.nextId
	data.nextId += 1
	return string.format("%x%x", n, math.random(16, 255))
end

Players.PlayerRemoving:Connect(function(player)
	if profiles[player] then
		PlayerData.save(player, true)
		profiles[player] = nil
	end
end)

game:BindToClose(function()
	if RunService:IsStudio() and not store then return end
	local threads = {}
	for player in profiles do
		table.insert(threads, task.spawn(function()
			PlayerData.save(player, true)
		end))
	end
	local t0 = os.clock()
	while os.clock() - t0 < 25 do
		local busy = false
		for _, th in threads do
			if coroutine.status(th) ~= "dead" then busy = true end
		end
		if not busy then break end
		task.wait(0.2)
	end
end)

task.spawn(function()
	while true do
		task.wait(AUTOSAVE)
		for player in profiles do
			task.spawn(PlayerData.save, player, false)
		end
	end
end)

return PlayerData
