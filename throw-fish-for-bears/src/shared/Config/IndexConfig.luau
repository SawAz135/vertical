--[[ IndexConfig: how the Index is organised and what completing it gives.
     Sections:
       Bears : one section per zone (a bear's first home zone), + "Special" (cosmic...)
       Animals : the other fish eaters (pelican, otter, orca...), one section per home zone
       Fish  : one section per rarity (Common, Uncommon, ... Impossible)
     Each section exists in 4 versions: Normal (just discovered) and one per mutation
     (Golden / Diamond / Rainbow: discovered IN that mutation).
     Completing a section unlocks a reward (claimed with a CLAIM button), bigger for
     rarer zones / rarities and for rarer mutations:
       money + a PERMANENT fishing luck boost + a guaranteed rare fish, and some sections
       also give an EXCLUSIVE rod (impossible to buy). ]]
local FishConfig = require(script.Parent.FishConfig)
local BearConfig = require(script.Parent.BearConfig)
local RarityConfig = require(script.Parent.RarityConfig)
local E = require(script.Parent.EconomyConfig)
local ZoneConfig = require(script.Parent.ZoneConfig)

local I = {}

I.Variants = { "Golden", "Diamond", "Ancient", "Rainbow", "Clockwork" }
local VAR = {
	Normal = { money = 1, luck = 1, fishBonus = 0 },
	Golden = { money = 2.5, luck = 1.5, fishBonus = 1 },
	Diamond = { money = 6, luck = 2, fishBonus = 2 },
	Ancient = { money = 10, luck = 2.5, fishBonus = 3 },
	Rainbow = { money = 15, luck = 3, fishBonus = 3 },
	Clockwork = { money = 40, luck = 4, fishBonus = 4 },
}

-- exclusive rods given by some sections (key without the variant prefix -> rod id),
-- and one per mutation for its Bears zone 5
I.RodRewards = {
	["Normal:B3"] = "Forest", ["Normal:B6"] = "Glacier", ["Normal:B10"] = "Legend",
	["Normal:FRare"] = "Coral", ["Normal:FLegendary"] = "Abyss", ["Normal:FSecret"] = "Phantom",
	["Golden:B5"] = "Gilded", ["Diamond:B5"] = "Prism", ["Ancient:B5"] = "Mossback", ["Rainbow:B5"] = "Spectrum",
	["Clockwork:B5"] = "Gearwork",
}

local cache = {}

-- sections of a category ("Bears" / "Fish") for a variant (nil = Normal)
function I.sections(cat: string, variant: string?)
	local v = variant or "Normal"
	local ck = cat .. v
	if cache[ck] then return cache[ck] end
	local list = {}
	if cat == "Bears" or cat == "Animals" then
		-- Bears and Animals (pelicans, otters, orcas...) have their own tabs, both by home zone
		local animals = cat == "Animals"
		local pre = if animals then ":A" else ":B"
		local byZone = {}
		local special = {}
		for _, id in BearConfig.Order do
			local spec = BearConfig.get(id)
			if (spec.isAnimal == true) ~= animals then continue end
			local z = spec.zones and spec.zones[1]
			if z then
				byZone[z] = byZone[z] or {}
				table.insert(byZone[z], id)
			else
				table.insert(special, id)
			end
		end
		for z = 1, 10 do
			if byZone[z] then
				local zc = ZoneConfig.get(z)
				table.insert(list, { key = v .. pre .. z, title = ("ZONE %d · %s"):format(z, zc.name:upper()), ids = byZone[z], rank = z, color = zc.sign })
			end
		end
		if #special > 0 then
			table.insert(list, { key = v .. pre .. "Special", title = "SPECIAL", ids = special, rank = 11, color = Color3.fromRGB(190, 120, 255) })
		end
	else
		local byR = {}
		for _, id in FishConfig.Order do
			local r = FishConfig.get(id).rarity
			byR[r] = byR[r] or {}
			table.insert(byR[r], id)
		end
		for _, r in RarityConfig.Order do
			if byR[r] then
				local tier = RarityConfig.get(r)
				table.insert(list, { key = v .. ":F" .. r, title = tier.name:upper() .. " FISH", ids = byR[r], rank = tier.index, color = tier.color, rarity = r })
			end
		end
	end
	for _, s in list do
		s.cat = cat
		s.variant = variant
		s.reward = I.reward(s)
	end
	cache[ck] = list
	return list
end

function I.byKey(key: string)
	for _, cat in { "Bears", "Fish", "Animals" } do
		for _, v in { "Normal", "Golden", "Diamond", "Ancient", "Rainbow", "Clockwork" } do
			for _, s in I.sections(cat, if v == "Normal" then nil else v) do
				if s.key == key then return s end
			end
		end
	end
	return nil
end

-- is this species found (in this variant)?
function I.found(index, cat: string, id: string, variant: string?): boolean
	local book = if cat == "Fish" then index and index.fish else index and index.bears -- animals share the bears' book
	local e = book and book[id]
	if not e then return false end
	if variant then return e.v ~= nil and e.v[variant] == true end
	return true
end

function I.progress(index, s): (number, number)
	local n = 0
	for _, id in s.ids do
		if I.found(index, s.cat, id, s.variant) then n += 1 end
	end
	return n, #s.ids
end

function I.reward(s)
	local v = VAR[s.variant or "Normal"]
	local rank = s.rank
	local fishR = RarityConfig.Order[math.clamp(rank + v.fishBonus, 2, 8)]
	return {
		money = math.floor(2500 * 2.4 ^ (rank - 1) * v.money / 100 + 0.5) * 100 * E.MoneyMult,
		luck = math.floor((0.02 + rank * 0.004) * v.luck * 1000 + 0.5) / 1000, -- +2.4% .. +6% (x mutation)
		fish = fishR,
		rod = I.RodRewards[s.key],
	}
end

return I
