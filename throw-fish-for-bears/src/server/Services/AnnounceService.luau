--[[ AnnounceService: tells the whole server when someone gets something rare.
     Tiers (by rarity index, Rainbow variant counts as one tier higher):
       5 Legendary -> "Rare" banner, 6 Mythic -> big banner + pillar of light,
       7 Secret / 8 Ultra Secret -> full-screen cinematic banner for everyone.
     The server decides; clients only render (UI/Announce + chat system line). ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local RarityConfig = require(Shared.Config.RarityConfig)
local FishConfig = require(Shared.Config.FishConfig)

local Announce = {}
Announce.MIN_TIER = 5

local VARIANT_BONUS = { Normal = 0, Golden = 0, Diamond = 1, Rainbow = 1 }

local function level(rarity: string, variant: string?): number
	return RarityConfig.get(rarity).index + (VARIANT_BONUS[variant or "Normal"] or 0)
end

local function send(player: Player, payload)
	payload.player = player.DisplayName
	payload.userId = player.UserId
	Net.event("Announce"):FireAllClients(payload)
end

function Announce.fish(player: Player, fish)
	local spec = FishConfig.get(fish.s)
	if not spec then return end
	local lv = level(spec.rarity, fish.v)
	if lv < Announce.MIN_TIER then return end
	send(player, { kind = "Fish", id = fish.s, rarity = spec.rarity, variant = fish.v, weight = fish.w, level = math.min(lv, 8) })
end

function Announce.bear(player: Player, bear)
	local lv = level(bear.r, bear.v)
	if lv < Announce.MIN_TIER then return end
	send(player, { kind = "Bear", id = bear.s, rarity = bear.r, variant = bear.v, weight = bear.w, level = math.min(lv, 8) })
end

return Announce
