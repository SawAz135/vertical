--[[ Sound: one place for every sound effect. Uses sounds that ship inside the Roblox
     client (rbxasset://sounds/...) layered and pitch shifted, so the game works with
     no uploads. To use custom audio, put an rbxassetid in CUSTOM[name]. ]]
local SoundService = game:GetService("SoundService")
local Debris = game:GetService("Debris")

local Sound = {}

-- optional uploaded audio ids override the built-in layers (leave empty if none)
local CUSTOM: { [string]: string } = {}

local A = "rbxasset://sounds/"
-- name = list of layers { id, volume, pitch, pitchRandom }
local LIB = {
	-- COZY menu sounds: soft wooden taps and quiet two-note chimes (low volume, warm pitch)
	Click = { { A .. "button.wav", 0.22, 0.72, 0.04 }, { A .. "bass.wav", 0.07, 1.6, 0 } },
	Open = { { A .. "swoosh.wav", 0.12, 0.65, 0.03 }, { A .. "electronicpingshort.wav", 0.11, 0.8, 0 } },
	Close = { { A .. "swoosh.wav", 0.1, 0.55, 0.03 }, { A .. "button.wav", 0.12, 0.6, 0 } },
	Equip = { { A .. "unsheath.wav", 0.4, 1.3, 0.05 } },
	Cast = { { A .. "swoosh.wav", 0.6, 0.85, 0.08 } },
	Splash = { { A .. "impact_water.mp3", 0.7, 1.1, 0.1 } },
	BigSplash = { { A .. "impact_water.mp3", 0.9, 0.8, 0.05 }, { A .. "impact_water.mp3", 0.5, 1.3, 0.05 } },
	Bite = { { A .. "electronicpingshort.wav", 0.6, 1.6, 0 }, { A .. "impact_water.mp3", 0.5, 1.4, 0.1 } },
	Reel = { { A .. "clickfast.wav", 0.35, 1.0, 0.1 } },
	Snap = { { A .. "snap.wav", 0.8, 1.0, 0.05 } },
	Catch = { { A .. "electronicpingshort.wav", 0.5, 1.0, 0 }, { A .. "impact_water.mp3", 0.6, 1.2, 0.05 } },
	Reveal1 = { { A .. "electronicpingshort.wav", 0.5, 1.2, 0 } },
	Reveal2 = { { A .. "electronicpingshort.wav", 0.6, 0.9, 0 }, { A .. "electronicpingshort.wav", 0.4, 1.35, 0 } },
	Reveal3 = { { A .. "victory.wav", 0.6, 1.0, 0 }, { A .. "electronicpingshort.wav", 0.5, 0.7, 0 } },
	Reveal4 = { { A .. "victory.wav", 0.7, 0.85, 0 }, { A .. "bass.wav", 0.6, 0.6, 0 }, { A .. "electronicpingshort.wav", 0.5, 0.5, 0 } },
	Charge = { { A .. "swoosh.wav", 0.3, 0.6, 0 } },
	Throw = { { A .. "swoosh.wav", 0.9, 0.7, 0.05 }, { A .. "swoosh.wav", 0.5, 1.2, 0.05 } },
	Land = { { A .. "splat.wav", 0.7, 0.9, 0.1 } },
	Growl = { { A .. "uuhhh.mp3", 0.6, 0.38, 0.04 } },
	Sniff = { { A .. "swoosh.wav", 0.35, 2.2, 0.15 } },
	Chomp = { { A .. "splat.wav", 0.8, 0.7, 0.1 }, { A .. "snap.wav", 0.4, 0.6, 0.1 } },
	Happy = { { A .. "uuhhh.mp3", 0.5, 0.55, 0.05 } },
	Transform = { { A .. "bass.wav", 0.8, 0.8, 0 }, { A .. "swoosh.wav", 0.7, 0.5, 0 }, { A .. "electronicpingshort.wav", 0.5, 0.6, 0 } },
	Footstep = { { A .. "action_footsteps_plastic.mp3", 0.25, 0.7, 0.1 } },
	Arrive = { { A .. "victory.wav", 0.7, 1.05, 0 } },
	Place = { { A .. "action_jump_land.mp3", 0.7, 0.8, 0.05 }, { A .. "electronicpingshort.wav", 0.4, 1.4, 0 } },
	Potion = { { A .. "splat.wav", 0.35, 1.6, 0.05 }, { A .. "electronicpingshort.wav", 0.35, 1.25, 0 }, { A .. "swoosh.wav", 0.3, 1.5, 0.04 } },
	Buy = { { A .. "electronicpingshort.wav", 0.2, 0.85, 0 }, { A .. "electronicpingshort.wav", 0.14, 1.07, 0 }, { A .. "bass.wav", 0.08, 1.4, 0 } },
	Sell = { { A .. "electronicpingshort.wav", 0.18, 0.95, 0 }, { A .. "electronicpingshort.wav", 0.13, 1.2, 0 } },
	Reward = { { A .. "victory.wav", 0.32, 0.95, 0 } },
	Lift = { { A .. "action_jump.mp3", 0.6, 0.6, 0 }, { A .. "action_jump_land.mp3", 0.7, 0.5, 0 } },
	Error = { { A .. "button.wav", 0.18, 0.45, 0 } },
	Notify = { { A .. "electronicpingshort.wav", 0.13, 0.9, 0 } },
	Heartbeat = { { A .. "bass.wav", 0.55, 0.5, 0 } },
	Tick = { { A .. "clickfast.wav", 0.5, 1.4, 0 } },
	-- the "1 IN X" counter: one crisp click per number change (played on pre-loaded voices)
	Count = { { A .. "button.wav", 0.42, 1.55, 0 }, { A .. "clickfast.wav", 0.16, 1.9, 0 } },
	-- a new black shape during the suspense: a soft air swish (the clicks belong to the number)
	Swap = { { A .. "swoosh.wav", 0.22, 1.45, 0.05 } },
	Flop = { { A .. "splat.wav", 0.35, 1.6, 0.2 } },
}

-- species voice pitch so each bear sounds different
Sound.BearPitch = { BrownBear = 1.0, BlackBear = 1.08, GrizzlyBear = 0.85, PolarBear = 0.9, Panda = 1.15 }

local rand = Random.new()

-- background music (looping). "Happy Song" by APM Music on the Creator Store (1843404009).
-- Alternative calmer track: "Light Breeze Ukulele" (1839620279). Empty = no music.
Sound.MUSIC_ID = "rbxassetid://1843404009"
Sound.MUSIC_VOLUME = 0.22

function Sound.startMusic()
	if Sound.MUSIC_ID == "" or SoundService:FindFirstChild("TFB_Music") then return end
	local m = Instance.new("Sound")
	m.Name = "TFB_Music"
	m.SoundId = Sound.MUSIC_ID
	m.Looped = true
	m.Volume = Sound.MUSIC_VOLUME
	m.Parent = SoundService
	m:Play()
end
local group = Instance.new("SoundGroup")
group.Name = "TFB_Sfx"
group.Volume = 0.8
group.Parent = SoundService

--[[ INSTANT sounds: a few pre-created, pre-loaded voices per sound, restarted from 0 on
     each call. A brand new Sound has to load before it plays (a few frames, different
     every time), which made fast clicks drift away from what is on screen. ]]
local pools = {}
local function pool(name: string)
	local p = pools[name]
	if p then return p end
	local layers = LIB[name]
	if not layers then return nil end
	p = { i = 0, voices = {} }
	for v = 1, 5 do
		local set = {}
		for _, l in layers do
			local s = Instance.new("Sound")
			s.Name = "TFB_" .. name .. v
			s.SoundId = l[1]
			s.SoundGroup = group
			s.Parent = SoundService
			table.insert(set, { s = s, l = l })
		end
		p.voices[v] = set
	end
	pools[name] = p
	return p
end

-- create + preload the voices early (call once at startup)
function Sound.warm(names: { string })
	local list = {}
	for _, n in names do
		local p = pool(n)
		if p then
			for _, set in p.voices do
				for _, e in set do table.insert(list, e.s) end
			end
		end
	end
	task.spawn(function()
		pcall(function() game:GetService("ContentProvider"):PreloadAsync(list) end)
	end)
end

function Sound.instant(name: string, opts: any?)
	opts = opts or {}
	local p = pool(name)
	if not p then return end
	p.i = p.i % #p.voices + 1
	for _, e in p.voices[p.i] do
		e.s.Volume = e.l[2] * (opts.volume or 1)
		e.s.PlaybackSpeed = e.l[3] * (opts.pitch or 1)
		e.s.TimePosition = 0
		e.s:Play()
	end
end

function Sound.play(name: string, opts: any?)
	opts = opts or {}
	local layers = LIB[name]
	if CUSTOM[name] then
		layers = { { CUSTOM[name], 0.7, 1, 0 } }
	end
	if not layers then return end
	for _, l in layers do
		local s = Instance.new("Sound")
		s.SoundId = l[1]
		s.Volume = l[2] * (opts.volume or 1)
		s.PlaybackSpeed = l[3] * (opts.pitch or 1) * (1 + (rand:NextNumber() - 0.5) * 2 * l[4])
		s.SoundGroup = group
		if opts.at then
			local part = Instance.new("Part")
			part.Anchored = true
			part.CanCollide = false
			part.CanQuery = false
			part.CanTouch = false
			part.Transparency = 1
			part.Size = Vector3.one * 0.2
			part.Position = opts.at
			part.Parent = workspace
			s.RollOffMaxDistance = 220
			s.RollOffMinDistance = 10
			s.Parent = part
			Debris:AddItem(part, 6)
		elseif opts.parent then
			s.RollOffMaxDistance = 160
			s.Parent = opts.parent
			Debris:AddItem(s, 6)
		else
			s.Parent = SoundService
			Debris:AddItem(s, 6)
		end
		s:Play()
	end
end

return Sound
