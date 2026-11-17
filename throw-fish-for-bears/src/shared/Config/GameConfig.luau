--[[ GameConfig: timings and gameplay tuning that are not money related. ]]
return {
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
		alert = 0.7, -- bear notices the fish
		runSpeed = 26, -- studs/s at scale 1
		arrive = 0.45, sniff = 0.8, eat = 3.4, happy = 1.2, transform = 0.5, -- transform = the "poof" before the bear appears in your hands
		-- seconds into the eat stage: snatch the fish, TOSS it up (apex), it falls back in slow
		-- motion into the open jaws (fish POV), CHOMP, swallow
		pickupAt = 0.35, tossApex = 0.85, chompAt = 2.3, swallowAt = 2.85,
		returnTimeout = 300,
		sprintMultiplier = 1.35,
		maxSpeedTolerance = 1.7, -- anti teleport (x max legal speed)
		arrivalHappy = 0.7,
		-- the rarity reveal (bear frozen in front of the fish): roulette spin, then optional luck climb
		-- reveal: 6 body parts uncovered one by one (luck + size counters climb), then name / rarity
		revealLimb = 0.85, revealFinal = 2.6, -- ~12 s for the whole capture cinematic
		-- LUCK BONUS rolled by the server during the reveal: rerolls the rarity with luck x mult
		-- and keeps the better result (only shown when it really upgrades the bear)
		luckBonus = { { mult = 25, chance = 0.003 }, { mult = 10, chance = 0.012 }, { mult = 5, chance = 0.05 }, { mult = 2, chance = 0.14 } },
	},
	Base = {
		minBearSpacing = 3.5,
		wanderInterval = { 2.5, 6 },
	},
}
