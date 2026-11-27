--[[ Sound: built-in Roblox client sounds (rbxasset://sounds/…) layered and pitch-shifted,
     so the game needs no uploaded audio. Positional sounds are pooled 3D emitters. ]]
local SoundService = game:GetService("SoundService")
local Debris = game:GetService("Debris")

local Sound = {}
local A = "rbxasset://sounds/"
local LIB = {
	Pick = { { A .. "clickfast.wav", 0.35, 1.5, 0.25 }, { A .. "swoosh.wav", 0.12, 2.2, 0.2 } },
	Scoop = { { A .. "swoosh.wav", 0.25, 0.9, 0.15 }, { A .. "clickfast.wav", 0.25, 1.1, 0.2 } },
	Dump = { { A .. "action_jump_land.mp3", 0.35, 1.5, 0.25 } },
	Coin = { { A .. "electronicpingshort.wav", 0.18, 1.5, 0.08 } },
	Gold = { { A .. "victory.wav", 0.35, 1.2, 0 }, { A .. "electronicpingshort.wav", 0.3, 1.8, 0 } },
	Purple = { { A .. "electronicpingshort.wav", 0.35, 0.8, 0 }, { A .. "electronicpingshort.wav", 0.25, 1.2, 0 } },
	Click = { { A .. "button.wav", 0.25, 0.75, 0.04 } },
	Open = { { A .. "swoosh.wav", 0.2, 0.7, 0.03 }, { A .. "electronicpingshort.wav", 0.1, 0.85, 0 } },
	Page = { { A .. "swoosh.wav", 0.32, 1.6, 0.12 } },
	BookClose = { { A .. "action_jump_land.mp3", 0.4, 0.9, 0 } },
	Buy = { { A .. "electronicpingshort.wav", 0.22, 0.85, 0 }, { A .. "electronicpingshort.wav", 0.16, 1.07, 0 }, { A .. "bass.wav", 0.08, 1.4, 0 } },
	Error = { { A .. "button.wav", 0.2, 0.45, 0 } },
	Shoot = { { A .. "Rocket shot.wav", 0.35, 1.6, 0.1 }, { A .. "swoosh.wav", 0.3, 0.8, 0.05 } },
	Vacuum = { { A .. "swoosh.wav", 0.18, 0.5, 0.05 } },
	Thud = { { A .. "action_jump_land.mp3", 0.3, 1.8, 0.3 } },
	Star = { { A .. "swoosh.wav", 0.6, 0.45, 0 }, { A .. "victory.wav", 0.3, 0.8, 0 } },
	Talk = { { A .. "clickfast.wav", 0.05, 0.6, 0.3 } },
	Rumble = { { A .. "bass.wav", 0.25, 0.5, 0.05 }, { A .. "swoosh.wav", 0.15, 0.4, 0.1 } },
}
local rnd = Random.new()

function Sound.play(name: string, vol: number?, at: Vector3?)
	local lib = LIB[name]; if not lib then return end
	local host: Instance = SoundService
	if at then
		local a = Instance.new("Attachment"); a.WorldPosition = at; a.Parent = workspace.Terrain
		Debris:AddItem(a, 3); host = a
	end
	for _, l in lib do
		local s = Instance.new("Sound")
		s.SoundId = l[1]; s.Volume = l[2] * (vol or 1)
		s.PlaybackSpeed = l[3] * (1 + (rnd:NextNumber() - 0.5) * 2 * l[4])
		if at then s.RollOffMaxDistance = 140; s.RollOffMinDistance = 8 end
		s.Parent = host; s:Play()
		Debris:AddItem(s, 4)
	end
end

local last: { [string]: number } = {}
function Sound.rate(name: string, ms: number, vol: number?, at: Vector3?)
	local t = os.clock()
	if last[name] and t - last[name] < ms / 1000 then return end
	last[name] = t; Sound.play(name, vol, at)
end

-- wind + soft desert ambience (looped)
function Sound.ambience()
	local w = Instance.new("Sound"); w.SoundId = A .. "swoosh.wav"; w.Looped = true; w.Volume = 0.04; w.PlaybackSpeed = 0.22; w.Parent = SoundService; w:Play()
	return w
end

return Sound
