--[[ Formulas: pure shared maths (server authoritative, client uses it for previews). ]]
local Shared = script.Parent
local E = require(Shared.Config.EconomyConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local BearConfig = require(Shared.Config.BearConfig)
local FishConfig = require(Shared.Config.FishConfig)
local GameConfig = require(Shared.Config.GameConfig)

local F = {}

function F.capacity(level: number): number
	return E.Capacity.start + (level - 1) * E.Capacity.perLevel
end

function F.bearIncome(bear): number
	local spec = BearConfig.get(bear.s)
	if not spec then return 0 end
	local tier = RarityConfig.get(bear.r)
	local variant = RarityConfig.Variants[bear.v or "Normal"] or RarityConfig.Variants.Normal
	local wk = (bear.w / spec.weight.ref) ^ E.WeightIncomeExp
	return spec.income * tier.bearIncome * variant.income * wk
end

function F.bearSellValue(bear): number
	return math.floor(F.bearIncome(bear) * E.BearSellFactor + 0.5)
end

function F.fishValue(fish): number
	local spec = FishConfig.get(fish.s)
	if not spec then return 0 end
	local tier = RarityConfig.get(spec.rarity)
	local variant = RarityConfig.Variants[fish.v or "Normal"] or RarityConfig.Variants.Normal
	local wk = (fish.w / spec.weight.avg) ^ E.FishValueWeightExp
	return math.max(1, math.floor(spec.value * tier.fishValue * variant.value * wk + 0.5))
end

-- landing distance for a throw
function F.throwDistance(power: number, strength: number, fishWeight: number): number
	local maxD = E.Strength.maxDistance(strength)
	local cap = E.Strength.maxFishWeight(strength)
	local wf = math.clamp(1 - 0.45 * (fishWeight / cap), 0.55, 1)
	return maxD * math.clamp(power, 0, 1) ^ 0.85 * wf
end

function F.flightTime(dist: number): number
	local g = GameConfig.Throw
	return g.flightBase + math.sqrt(math.max(0, dist)) * g.flightPerSqrtStud
end

function F.apex(dist: number): number
	-- grows fast for short throws, then flattens so 3000-stud throws stay on screen
	local g = GameConfig.Throw
	return g.apexBase + math.min(dist, 400) * g.apexPerStud + math.max(0, dist - 400) * 0.035
end

-- recommended strength to land in the middle-ish of zone i (full power, light fish)
function F.zoneStrength(i: number): number
	local Layout = require(script.Parent.Layout)
	local a = Layout.zoneRange(i)
	local dist = (Layout.THROW_AREA.maxZ - 10) - a + 60 -- from the throw zone to 60 studs into the zone
	return math.floor(E.Strength.strengthFor(dist) / 10 + 0.5) * 10
end

-- position on the throw arc at normalised time u (0..1)
function F.arc(from: Vector3, to: Vector3, apex: number, u: number): Vector3
	local p = from:Lerp(to, u)
	return Vector3.new(p.X, p.Y + 4 * apex * u * (1 - u), p.Z)
end

return F
