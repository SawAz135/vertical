--!strict
-- Shared tuning values. Read by the server (map + rules) and the client (HUD).

local Config = {}

Config.STAGES = 12 -- number of checkpoints after the start pad
Config.SEED = 1000000000 -- map layout seed (same seed = same map)

Config.START_POSITION = Vector3.new(0, 20, 0)
Config.STAGE_LENGTH = 34 -- studs between checkpoints along +Z
Config.PLATFORMS_PER_STAGE = 3

Config.MOVER_TRAVEL = 10 -- studs a moving platform slides
Config.MOVER_PERIOD = 2.6 -- seconds for one way
Config.SPINNER_SPEED = 90 -- degrees per second

Config.COLORS = {
	Base = Color3.fromRGB(18, 18, 26),
	Trim = Color3.fromRGB(120, 92, 255),
	Checkpoint = Color3.fromRGB(64, 224, 255),
	CheckpointReached = Color3.fromRGB(255, 214, 92),
	Kill = Color3.fromRGB(255, 52, 92),
	Finish = Color3.fromRGB(255, 214, 92),
}

-- Names shared by server and client so they can never drift apart.
Config.REMOTES_FOLDER = "BeyondRemotes"
Config.REMOTE_STAGE = "StageReached"
Config.REMOTE_FINISH = "Finished"
Config.STAT_NAME = "Stage"

return Config
