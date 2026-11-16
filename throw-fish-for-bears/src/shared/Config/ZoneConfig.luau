--[[ ZoneConfig: natural zones along the corridor (slice: zone 1 only).
     luck      : bear rarity luck multiplier for fish landing in this zone
     depthLuck : extra luck reached at the far end of the zone (rewards strong throws)
     ambient   : species roaming in the zone as decoration (never the responder)
     theme     : read by the server map builder and the client ambience controller ]]
local ZoneConfig = {}
local C = Color3.fromRGB

ZoneConfig.Zones = {
	{
		id = "GreenForest", name = "Green Forest",
		luck = 1, depthLuck = 1.6,
		ambient = { "BrownBear", "BlackBear", "BrownBear" },
		ground = C(66, 140, 44), groundAlt = C(58, 126, 38), path = C(150, 116, 74),
		fog = C(196, 226, 255), tint = C(255, 255, 250), atmosphere = 0.28,
		ambience = "Forest",
		particles = "Leaves",
	},
}

function ZoneConfig.get(i: number)
	return ZoneConfig.Zones[i]
end

return ZoneConfig
