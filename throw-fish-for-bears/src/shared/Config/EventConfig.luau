--[[ EventConfig: LIMITED EVENTS.
     A new event starts every TUESDAY 6:00 PM and every SATURDAY 1:00 PM, Quebec time
     (America/Toronto, daylight saving handled in Shared/Events). The list loops forever;
     add new events at the end for an update and they come in the rotation.
     During an event its 3 featured animals are much more likely in EVERY zone
     (speciesBoost) and everyone's luck gets the event bonus. ]]
local EventConfig = {}

EventConfig.SpeciesBoost = 6 -- featured animals: x6 chance in every zone

EventConfig.List = {
	{ id = "SharkWeek", name = "Shark Week", color = Color3.fromRGB(64, 150, 255), luck = 1.25,
		featured = { "GreatWhite", "TigerShark", "Hammerhead" } },
	{ id = "PenguinParade", name = "Penguin Parade", color = Color3.fromRGB(120, 210, 255), luck = 1.25,
		featured = { "EmperorPenguin", "KingPenguin", "AdeliePenguin" } },
	{ id = "ArcticFreeze", name = "Arctic Freeze", color = Color3.fromRGB(180, 236, 255), luck = 1.25,
		featured = { "PolarBear", "ArcticFox", "Walrus" } },
	{ id = "JungleFever", name = "Jungle Fever", color = Color3.fromRGB(110, 220, 80), luck = 1.25,
		featured = { "Jaguar", "FishingCat", "Crocodile" } },
	{ id = "SkyHunters", name = "Sky Hunters", color = Color3.fromRGB(255, 196, 70), luck = 1.25,
		featured = { "Osprey", "Albatross", "Frigatebird" } },
	{ id = "DeepSea", name = "Deep Sea Mystery", color = Color3.fromRGB(170, 110, 255), luck = 1.25,
		featured = { "GiantSquid", "Octopus", "Jellyfish" } },
	{ id = "GoldenHour", name = "Golden Hour", color = Color3.fromRGB(255, 210, 50), luck = 1.5,
		featured = { "GoldBear", "HoneyBear", "SunBear" } },
	{ id = "SealSplash", name = "Seal Splash", color = Color3.fromRGB(150, 200, 230), luck = 1.25,
		featured = { "SeaLion", "LeopardSeal", "ElephantSeal" } },
}

return EventConfig
