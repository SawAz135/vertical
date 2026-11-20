--[[ Weighted randomness helpers. Server uses its own Random object for every
     reward roll; clients only use these helpers for cosmetic variation. ]]
local Rng = {}

-- entries: array of {weight = number, ...}; returns the picked entry and index
function Rng.pickWeighted(rand: Random, entries: { any }, weightKey: string?)
	local key = weightKey or "weight"
	local total = 0
	for _, e in entries do
		total += math.max(0, e[key])
	end
	if total <= 0 then
		return entries[1], 1
	end
	local r = rand:NextNumber() * total
	for i, e in entries do
		r -= math.max(0, e[key])
		if r <= 0 then
			return e, i
		end
	end
	return entries[#entries], #entries
end

-- map form: { [id] = weight } -> id
function Rng.pickMap(rand: Random, map: { [string]: number }): string
	local total = 0
	local keys = {}
	for k, w in map do
		if w > 0 then
			total += w
			table.insert(keys, k)
		end
	end
	table.sort(keys) -- deterministic order for a given seed
	local r = rand:NextNumber() * total
	for _, k in keys do
		r -= map[k]
		if r <= 0 then
			return k
		end
	end
	return keys[#keys]
end

-- normalised probabilities of a { [id] = weight } map
function Rng.normalise(map: { [string]: number }): { [string]: number }
	local total = 0
	for _, w in map do total += math.max(0, w) end
	local out = {}
	for k, w in map do
		out[k] = if total > 0 then math.max(0, w) / total else 0
	end
	return out
end

-- skewed value in [min, max]; bias > 1 favours small values, < 1 favours large
function Rng.skewed(rand: Random, min: number, max: number, bias: number): number
	local u = rand:NextNumber() ^ bias
	return min + (max - min) * u
end

function Rng.guid(rand: Random): string
	local chars = "0123456789abcdefghijklmnopqrstuvwxyz"
	local out = table.create(12)
	for i = 1, 12 do
		local k = rand:NextInteger(1, #chars)
		out[i] = chars:sub(k, k)
	end
	return table.concat(out)
end

return Rng
