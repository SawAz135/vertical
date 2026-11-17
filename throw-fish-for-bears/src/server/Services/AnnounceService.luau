--[[ AnnounceService: tells the whole server when someone gets something rare.
     Legendary and above (Diamond / Rainbow variants count one tier higher) -> a coloured
     line in the Roblox chat for everyone. Only the IMPOSSIBLE tier (Cosmic Bear,
     Cosmic Koi) also plays the full-screen announcement for the whole server.
     The server decides; clients only render (UI/Announce). ]]
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
	payload.banner = payload.rarity == "Impossible"
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

function Announce.bear(player: Player, bear)
	local lv = level(bear.r, bear.v)
	if lv < Announce.MIN_TIER then return end
	send(player, { kind = "Bear", id = bear.s, rarity = bear.r, variant = bear.v, weight = bear.w, level = math.min(lv, 9) })
end

return Announce
