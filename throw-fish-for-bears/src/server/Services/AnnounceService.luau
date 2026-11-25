--[[ AnnounceService: tells the whole server when someone gets something rare.
     Legendary and above (Diamond / Rainbow variants count one tier higher), or any animal
     rarer than 1 IN 1,000 -> a coloured line in the Roblox chat for everyone, with the
     real "1 IN X" of the pull. Chat only: no full-screen banner.
     The server decides; clients only render (UI/Announce). ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local RarityConfig = require(Shared.Config.RarityConfig)
local FishConfig = require(Shared.Config.FishConfig)

local Announce = {}
Announce.MIN_TIER = 5
Announce.MIN_ONE_IN = 1000 -- any animal at least this rare is announced

local VARIANT_BONUS = { Normal = 0, Golden = 0, Diamond = 1, Ancient = 1, Rainbow = 1, Clockwork = 2 }

local function level(rarity: string, variant: string?): number
	return RarityConfig.get(rarity).index + (VARIANT_BONUS[variant or "Normal"] or 0)
end

local function send(player: Player, payload)
	payload.banner = false -- chat line only
	payload.player = player.DisplayName
	payload.userId = player.UserId
	Net.event("Announce"):FireAllClients(payload)
end

function Announce.fish(player: Player, fish)
	local spec = FishConfig.get(fish.s)
	if not spec then return end
	local lv = level(spec.rarity, fish.v)
	if lv < Announce.MIN_TIER then return end
	send(player, { kind = "Fish", id = fish.s, rarity = spec.rarity, variant = fish.v, weight = fish.w, level = math.min(lv, 9) })
end

function Announce.bear(player: Player, bear, oneIn: number?)
	local lv = level(bear.r, bear.v)
	if lv < Announce.MIN_TIER and (oneIn or 0) < Announce.MIN_ONE_IN then return end
	send(player, { kind = "Bear", id = bear.s, rarity = bear.r, variant = bear.v, weight = bear.w, level = math.min(lv, 9), oneIn = oneIn })
end

return Announce
