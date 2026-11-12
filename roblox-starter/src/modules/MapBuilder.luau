--!strict
--[[
	MapBuilder: builds the whole obby course from code, deterministically from a seed.

	It only creates Instances and sets properties (no services, no task library),
	so the exact same code runs:
	  * in the live game (Main.server.luau),
	  * in a Roblox Open Cloud Luau Execution task (tests/smoke.luau),
	  * locally under Lune for offline tests (tests/lune/run.luau).

	Behaviour (moving, spinning, killing, checkpoints) is attached later by the
	server, driven by the attributes written here:
	  Kind = "Static" | "Mover" | "Spinner" | "Kill" | "Checkpoint" | "Finish" | "Decor"
	  Stage (number)            on checkpoints
	  MoverAxis (Vector3)       on movers
	  MoverPhase (number)       on movers, 0..1 so they do not all move in sync
	  SpinDirection (number)    on spinners, 1 or -1
]]

export type Course = {
	model: Model,
	spawn: BasePart,
	checkpoints: { BasePart },
	movers: { BasePart },
	spinners: { BasePart },
	kills: { BasePart },
	finish: BasePart,
	partCount: number,
}

type ConfigShape = {
	STAGES: number,
	STAGE_LENGTH: number,
	PLATFORMS_PER_STAGE: number,
	START_POSITION: Vector3,
	MOVER_TRAVEL: number,
	COLORS: { [string]: Color3 },
}

local MapBuilder = {}

-- Small deterministic generator (LCG). Roblox's Random is not available in every
-- runtime this module is tested in, and we want identical maps everywhere.
local function makeRng(seed: number)
	local state = math.floor(math.abs(seed)) % 2147483647
	if state == 0 then
		state = 1
	end
	local rng = {}
	function rng.next(): number
		state = (state * 48271) % 2147483647
		return state / 2147483647
	end
	function rng.range(minValue: number, maxValue: number): number
		return minValue + (maxValue - minValue) * rng.next()
	end
	return rng
end

local function makePart(
	parent: Instance,
	name: string,
	size: Vector3,
	cframe: CFrame,
	color: Color3,
	material: Enum.Material,
	kind: string
): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Anchored = true
	part.Size = size
	part.CFrame = cframe
	part.Color = color
	part.Material = material
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part:SetAttribute("Kind", kind)
	part.Parent = parent
	return part
end

-- A thin glowing frame under a pad: gives every platform a neon silhouette.
local function addTrim(parent: Instance, base: BasePart, color: Color3)
	local s = base.Size
	local trim = makePart(
		parent,
		base.Name .. "_Trim",
		Vector3.new(s.X + 0.6, 0.3, s.Z + 0.6),
		base.CFrame * CFrame.new(0, -s.Y / 2 - 0.1, 0),
		color,
		Enum.Material.Neon,
		"Decor"
	)
	trim.CanCollide = false
	trim.CanTouch = false
	trim.CanQuery = false
	return trim
end

function MapBuilder.build(parent: Instance?, seed: number, config: ConfigShape): Course
	local rng = makeRng(seed)
	local colors = config.COLORS
	local start = config.START_POSITION

	local model = Instance.new("Model")
	model.Name = "BeyondCourse"

	local course: Course = {
		model = model,
		spawn = (nil :: any),
		checkpoints = {},
		movers = {},
		spinners = {},
		kills = {},
		finish = (nil :: any),
		partCount = 0,
	}

	local platforms = Instance.new("Folder")
	platforms.Name = "Platforms"
	platforms.Parent = model
	local hazards = Instance.new("Folder")
	hazards.Name = "Hazards"
	hazards.Parent = model
	local checkpoints = Instance.new("Folder")
	checkpoints.Name = "Checkpoints"
	checkpoints.Parent = model

	-- Start pad: the only SpawnLocation. Later stages respawn via the server.
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "StartSpawn"
	spawn.Anchored = true
	spawn.Size = Vector3.new(14, 1, 14)
	spawn.CFrame = CFrame.new(start)
	spawn.Color = colors.Base
	spawn.Material = Enum.Material.SmoothPlastic
	spawn.Neutral = true
	spawn.Duration = 0 -- no force field bubble
	spawn:SetAttribute("Kind", "Checkpoint")
	spawn:SetAttribute("Stage", 0)
	spawn.Parent = checkpoints
	addTrim(checkpoints, spawn, colors.Trim)
	course.spawn = spawn

	local previous = start
	for stage = 1, config.STAGES do
		local difficulty = (stage - 1) / math.max(config.STAGES - 1, 1) -- 0 .. 1
		local stageBaseZ = start.Z + (stage - 1) * config.STAGE_LENGTH
		local step = config.STAGE_LENGTH / (config.PLATFORMS_PER_STAGE + 1)

		for index = 1, config.PLATFORMS_PER_STAGE do
			local position = Vector3.new(
				rng.range(-7, 7),
				previous.Y + rng.range(0.6, 1.6),
				stageBaseZ + index * step
			)
			-- Pads shrink as the course goes on.
			local width = 8 - difficulty * 3.5 + rng.range(-0.5, 0.5)
			local name = string.format("S%02d_P%d", stage, index)
			local roll = rng.next()

			if stage > 1 and roll < 0.18 + difficulty * 0.22 then
				-- Moving platform, slides sideways along X.
				local mover = makePart(
					platforms,
					name .. "_Mover",
					Vector3.new(width, 1, width),
					CFrame.new(position),
					colors.Trim,
					Enum.Material.Neon,
					"Mover"
				)
				mover:SetAttribute("MoverAxis", Vector3.new(1, 0, 0))
				mover:SetAttribute("MoverPhase", rng.next())
				local light = Instance.new("PointLight")
				light.Color = colors.Trim
				light.Range = 12
				light.Brightness = 1.4
				light.Parent = mover
				table.insert(course.movers, mover)
			elseif stage > 2 and roll < 0.42 + difficulty * 0.2 then
				-- Static pad with a spinning laser bar sweeping over it.
				local pad = makePart(
					platforms,
					name,
					Vector3.new(width + 3, 1, width + 3),
					CFrame.new(position),
					colors.Base,
					Enum.Material.SmoothPlastic,
					"Static"
				)
				addTrim(platforms, pad, colors.Kill)
				local bar = makePart(
					hazards,
					name .. "_Spinner",
					Vector3.new(width + 2.5, 0.6, 0.6),
					CFrame.new(position + Vector3.new(0, 1.6, 0)),
					colors.Kill,
					Enum.Material.Neon,
					"Spinner"
				)
				bar.CanCollide = false
				bar:SetAttribute("SpinDirection", if rng.next() < 0.5 then -1 else 1)
				table.insert(course.spinners, bar)
				table.insert(course.kills, bar)
			else
				local pad = makePart(
					platforms,
					name,
					Vector3.new(width, 1, width),
					CFrame.new(position),
					colors.Base,
					Enum.Material.SmoothPlastic,
					"Static"
				)
				addTrim(platforms, pad, colors.Trim)
			end
			previous = position
		end

		-- Checkpoint at the end of the stage.
		local checkpointPosition =
			Vector3.new(0, previous.Y + 1, stageBaseZ + config.STAGE_LENGTH)
		local checkpoint = makePart(
			checkpoints,
			string.format("Checkpoint_%02d", stage),
			Vector3.new(10, 1, 10),
			CFrame.new(checkpointPosition),
			colors.Checkpoint,
			Enum.Material.Glass,
			"Checkpoint"
		)
		checkpoint:SetAttribute("Stage", stage)
		addTrim(checkpoints, checkpoint, colors.Checkpoint)
		table.insert(course.checkpoints, checkpoint)
		previous = checkpointPosition
	end

	-- Finish pad + a gate of two neon pillars and a lintel.
	local finishPosition = previous + Vector3.new(0, 2, config.STAGE_LENGTH * 0.6)
	local finish = makePart(
		model,
		"Finish",
		Vector3.new(16, 1, 16),
		CFrame.new(finishPosition),
		colors.Finish,
		Enum.Material.Neon,
		"Finish"
	)
	course.finish = finish
	for side = -1, 1, 2 do
		local pillar = makePart(
			model,
			if side < 0 then "GatePillarL" else "GatePillarR",
			Vector3.new(1.2, 14, 1.2),
			CFrame.new(finishPosition + Vector3.new(side * 7.4, 7.5, 0)),
			colors.Finish,
			Enum.Material.Neon,
			"Decor"
		)
		pillar.CanCollide = false
	end
	local lintel = makePart(
		model,
		"GateLintel",
		Vector3.new(16, 1.2, 1.2),
		CFrame.new(finishPosition + Vector3.new(0, 14.6, 0)),
		colors.Finish,
		Enum.Material.Neon,
		"Decor"
	)
	lintel.CanCollide = false

	-- Invisible kill plane under the whole course so falls respawn quickly.
	local courseLength = finishPosition.Z - start.Z
	local killPlane = makePart(
		hazards,
		"KillPlane",
		Vector3.new(400, 2, courseLength + 200),
		CFrame.new(0, start.Y - 40, start.Z + courseLength / 2),
		colors.Kill,
		Enum.Material.ForceField,
		"Kill"
	)
	killPlane.Transparency = 1
	killPlane.CanCollide = false
	table.insert(course.kills, killPlane)

	local count = 0
	for _, descendant in model:GetDescendants() do
		if descendant:IsA("BasePart") then
			count += 1
		end
	end
	course.partCount = count

	if parent then
		model.Parent = parent
	end
	return course
end

return MapBuilder
