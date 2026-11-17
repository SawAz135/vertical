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
		apexBase = 14, apexPerStud = 0.16,
		flightBase = 1.0, flightPerSqrtStud = 0.12,
		minLandingDepth = 8, -- studs past the throw line to count as "in the zone"
	},
	Capture = {
		alert = 0.9, -- bear notices the fish
		runSpeed = 26, -- studs/s at scale 1
		arrive = 0.45, sniff = 1.0, eat = 1.6, happy = 1.4, transform = 0.6, -- transform = the "poof" before the bear appears in your hands
		pickupAt = 0.35, swallowAt = 1.15, -- seconds into the eat stage
		returnTimeout = 300,
		sprintMultiplier = 1.35,
		maxSpeedTolerance = 1.7, -- anti teleport (x max legal speed)
		arrivalHappy = 0.7,
	},
	Base = {
		minBearSpacing = 3.5,
		wanderInterval = { 2.5, 6 },
	},
}
