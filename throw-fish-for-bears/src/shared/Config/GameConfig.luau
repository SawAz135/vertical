--[[ GameConfig: timings and gameplay tuning that are not money related. ]]
local GameConfig = {
	UI = {
		-- rbxassetid of assets/stud_tile.png once uploaded to Roblox (Creator Hub > Decals/Images).
		-- Empty = studs are drawn with GUI frames instead (same look, heavier).
		-- Creator Store "Studs" decal 6927295857, loaded through rbxthumb (works for decals in code)
		StudImage = "rbxthumb://type=Asset&id=6927295857&w=420&h=420",
		StudPitch = 24, -- size of one texture tile in px (1050 x 620 reference screen)
	},
	Fishing = {
		waitMin = 4.5, waitMax = 10, -- seconds before a bite (divided by rod speed)
		biteWindow = 1.9, -- seconds to tap HOOK after the bobber dips
		reelMinTime = 1.0, reelMaxTime = 50,
		missRetryMin = 2.5, missRetryMax = 5,
		castDistance = { 11, 17 }, -- studs from the dock end
	},
	Reel = {
		-- client mini-game "keep the fish in the zone" (the server only checks timing).
		-- difficulty = rarity tier 1 (Common) .. 9 (Impossible)
		zoneSize = 0.34, zoneShrink = 0.02, zoneMin = 0.17, -- zone width (fraction of the track) per tier
		push = 2.6, gravity = 2.1, damping = 2.4, bounce = 0.35, -- zone physics (hold = push right)
		fishSpeed = 0.55, fishSpeedPerTier = 0.10, -- fish swim speed (track / s)
		dartChance = 0.08, dartPerTier = 0.035, -- chance per decision of a sudden dart
		fill = 0.30, drain = 0.17, drainPerTier = 0.012, start = 0.35, -- progress rates
		comboTime = 1.4, comboBoost = 1.35, -- staying in the zone builds a combo (faster fill)
	},
	Throw = {
		chargeTime = 1.4, -- seconds from 0 to full power
		minPower = 0.08,
		releaseDelay = 0.2, -- charge release -> fish leaves the hand (matches the whip at ~0.14s of the Throw pose)
		apexBase = 14, apexPerStud = 0.16,
		flightBase = 1.0, flightPerSqrtStud = 0.12,
		minLandingDepth = 8, -- studs past the throw line to count as "in the zone"
	},
	Capture = {
		-- the "1 IN ?" reveal (client timeline, the server only waits for its end):
		-- transform = the landed fish turns into a black silhouette + star burst
		-- spin      = the silhouette morphs between animals (fast, then slower and slower) and grows
		-- hold      = the last silhouette trembles, the heartbeat races, a beat of silence
		-- result    = the animal in colour + rarity / NAME / NEW! / $/s / 1 IN X
		-- the "1 IN X" climb STOPS for `pause` s on every colour step it passes (10, 100, 1k...),
		-- so a rare animal makes a longer suspense (the server waits for it too)
		Reveal = { transform = 0.55, spin = 5.2, hold = 0.9, result = 1.4, total = 8.05, autoBack = 25,
			tierSteps = { 10, 100, 1000, 10000, 100000, 1000000, 10000000 }, pause = 0.9 },
		-- LUCK BONUS rolled by the server during the reveal: rerolls the rarity with luck x mult
		-- and keeps the better result (only shown when it really upgrades the bear)
		luckBonus = { { mult = 25, chance = 0.003 }, { mult = 10, chance = 0.012 }, { mult = 5, chance = 0.05 }, { mult = 2, chance = 0.14 } },
	},
	Base = {
		minBearSpacing = 3.5,
		wanderInterval = { 2.5, 6 },
	},
}

-- how many colour steps the "1 IN X" climb stops at for these odds
function GameConfig.revealPauses(oneIn: number): number
	local n = 0
	for _, v in GameConfig.Capture.Reveal.tierSteps do
		if oneIn > v then n += 1 end
	end
	return n
end

return GameConfig
