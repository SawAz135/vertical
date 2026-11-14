--[[
	Roblox Forge - game systems logic (ModuleScript, ReplicatedStorage).
	Pure functions only (no services, no randomness inside): the server passes
	random numbers in, so every rule is testable and the studio's JavaScript twin
	(systems/sys-core.js) gives exactly the same results.
]]
local L = {}
L.VERSION = 1

-- rarities ----------------------------------------------------------------
function L.tierOf(cfg, rarityName)
	for i, r in cfg.rarities do
		if r.name == rarityName then return i end
	end
	return 1
end

function L.petById(cfg, id)
	for _, p in cfg.pets do
		if p.id == id then return p end
	end
	return nil
end

function L.eggById(cfg, id)
	for _, e in cfg.eggs do
		if e.id == id then return e end
	end
	return nil
end

-- odds of an egg for a luck multiplier: "lucky" rarities get their weight multiplied
function L.eggOdds(cfg, egg, luck, minTier)
	local list, total = {}, 0
	for _, entry in egg.entries do
		local pet = L.petById(cfg, entry.pet)
		if pet and entry.weight > 0 then
			local tier = L.tierOf(cfg, pet.rarity)
			if not minTier or tier >= minTier then
				local rar = cfg.rarities[tier]
				local w = entry.weight * ((rar and rar.lucky) and (luck or 1) or 1)
				table.insert(list, { pet = pet.id, w = w, tier = tier })
				total += w
			end
		end
	end
	for _, o in list do o.p = (total > 0) and o.w / total or 0 end
	return list, total
end

-- r in [0, 1): walks the cumulative probabilities
function L.pick(odds, r)
	local acc = 0
	for _, o in odds do
		acc += o.p
		if r < acc then return o end
	end
	return odds[#odds]
end

-- one hatch: returns pet id, the new pity counter and whether pity forced the result
function L.hatch(cfg, egg, luck, pityCount, r)
	local pity = egg.pity
	local forced = false
	local odds = L.eggOdds(cfg, egg, luck)
	if pity and pity.after and pity.after > 0 and (pityCount or 0) + 1 >= pity.after then
		local high = L.eggOdds(cfg, egg, luck, pity.tier)
		if #high > 0 then
			odds = high
			forced = true
		end
	end
	local o = L.pick(odds, r)
	local nextCount = (pityCount or 0) + 1
	if pity and o.tier >= (pity.tier or math.huge) then nextCount = 0 end
	return o.pet, nextCount, forced
end

-- economy -----------------------------------------------------------------
function L.rebirthCost(cfg, n)
	local rb = cfg.rebirth
	return math.floor(rb.base * rb.growth ^ n + 0.5)
end

function L.petBoost(cfg, data)
	local sum = 0
	for _, pet in data.pets do
		if pet.eq then
			local def = L.petById(cfg, pet.id)
			sum += def and def.power or 0
		end
	end
	return 1 + sum / 100
end

function L.multiplier(cfg, data, perks)
	local m = (1 + (data.rebirths or 0) * cfg.rebirth.step) * L.petBoost(cfg, data)
	if perks and perks.coins2x then m *= 2 end
	return m
end

function L.luck(cfg, perks, boost)
	local l = 1
	if perks and perks.luck2x then l *= 2 end
	if boost then l *= boost end
	return l
end

-- inventory ---------------------------------------------------------------
function L.count(data)
	local n, eq = 0, 0
	for _, p in data.pets do
		n += 1
		if p.eq then eq += 1 end
	end
	return n, eq
end

function L.limits(cfg, perks)
	local maxPets, maxEquip = cfg.inventory.max, cfg.inventory.equip
	if perks and perks.storage then maxPets += 100 end
	if perks and perks.equip then maxEquip += 2 end
	return maxPets, maxEquip
end

function L.addPet(data, uid, petId, maxPets)
	local n = L.count(data)
	if n >= maxPets then return false, "full" end
	data.pets[uid] = { id = petId, eq = false }
	return true
end

function L.equip(data, uid, maxEquip)
	local pet = data.pets[uid]
	if not pet then return false, "missing" end
	if pet.eq then return true end
	local _, eq = L.count(data)
	if eq >= maxEquip then return false, "limit" end
	pet.eq = true
	return true
end

function L.unequip(data, uid)
	local pet = data.pets[uid]
	if not pet then return false, "missing" end
	pet.eq = false
	return true
end

function L.sellValue(cfg, petId)
	local pet = L.petById(cfg, petId)
	if not pet then return 0 end
	local rar = cfg.rarities[L.tierOf(cfg, pet.rarity)]
	return rar and rar.sell or 0
end

function L.sell(cfg, data, uid)
	local pet = data.pets[uid]
	if not pet then return nil, "missing" end
	local value = L.sellValue(cfg, pet.id)
	data.pets[uid] = nil
	return value
end

-- equip the strongest pets automatically
function L.equipBest(cfg, data, maxEquip)
	local list = {}
	for uid, p in data.pets do
		p.eq = false
		local def = L.petById(cfg, p.id)
		table.insert(list, { uid = uid, power = def and def.power or 0 })
	end
	table.sort(list, function(a, b)
		if a.power == b.power then return a.uid < b.uid end
		return a.power > b.power
	end)
	for i = 1, math.min(maxEquip, #list) do data.pets[list[i].uid].eq = true end
	return math.min(maxEquip, #list)
end

-- daily reward: day = floor(unix / 86400)
function L.daily(data, day, rewardsCount)
	local d = data.daily
	if d.last == day then return false, d.streak, 0 end
	local streak = (d.last == day - 1) and d.streak + 1 or 1
	local index = ((streak - 1) % rewardsCount) + 1
	return true, streak, index
end

-- quests: reset every day, progress is per quest type
function L.questsForDay(data, day)
	if data.quests.day ~= day then
		data.quests = { day = day, progress = {}, claimed = {} }
	end
	return data.quests
end

function L.addProgress(data, day, kind, amount, quests)
	local q = L.questsForDay(data, day)
	for _, quest in quests do
		if quest.type == kind and not q.claimed[quest.id] then
			q.progress[quest.id] = math.min(quest.target, (q.progress[quest.id] or 0) + amount)
		end
	end
end

function L.canClaimQuest(data, day, quest)
	local q = L.questsForDay(data, day)
	return not q.claimed[quest.id] and (q.progress[quest.id] or 0) >= quest.target
end

-- codes -------------------------------------------------------------------
function L.normalizeCode(s)
	if type(s) ~= "string" or #s > 40 then return nil end
	s = string.upper((string.gsub(s, "%s+", "")))
	if s == "" then return nil end
	return s
end

function L.redeem(cfg, data, code, now)
	code = L.normalizeCode(code)
	if not code then return nil, "invalid" end
	for _, c in cfg.codes do
		if L.normalizeCode(c.code) == code then
			if data.codes[code] then return nil, "used" end
			if c.expires and c.expires > 0 and now > c.expires then return nil, "expired" end
			data.codes[code] = true
			return c
		end
	end
	return nil, "unknown"
end

-- data --------------------------------------------------------------------
function L.defaultData(cfg)
	local cur = {}
	for _, c in cfg.currencies do cur[c.name] = c.start or 0 end
	return {
		v = L.VERSION, currencies = cur, rebirths = 0, pets = {}, nextUid = 1, pity = {},
		daily = { last = -1, streak = 0 }, quests = { day = -1, progress = {}, claimed = {} },
		codes = {}, receipts = {}, stats = { hatched = 0, collected = 0 },
	}
end

-- fills anything missing (new currencies, new fields) without touching saved values
function L.migrate(data, cfg)
	local def = L.defaultData(cfg)
	if type(data) ~= "table" then return def end
	for k, v in def do
		if data[k] == nil then data[k] = v end
	end
	for name, start in def.currencies do
		if type(data.currencies[name]) ~= "number" then data.currencies[name] = start end
	end
	data.v = L.VERSION
	return data
end

-- numbers -------------------------------------------------------------------
function L.abbreviate(n)
	local units = { { 1e15, "Qa" }, { 1e12, "T" }, { 1e9, "B" }, { 1e6, "M" }, { 1e3, "K" } }
	for _, u in units do
		if math.abs(n) >= u[1] then
			local x = n / u[1]
			local s = string.format(x >= 100 and "%.0f" or "%.1f", x)
			return (string.gsub(s, "%.0$", "")) .. u[2]
		end
	end
	return tostring(math.floor(n))
end

-- per player / action cooldowns (server side)
function L.newLimiter()
	local last = {}
	return function(key, now, cooldown)
		local t = last[key]
		if t and now - t < cooldown then return false end
		last[key] = now
		return true
	end
end

return L
