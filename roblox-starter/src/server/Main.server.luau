--!strict
-- Server entry point: builds the course, sets the mood, runs every hazard and the
-- checkpoint / respawn / finish rules. All state that matters lives on the server.

local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local ServerStorage = game:GetService("ServerStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local MapBuilder = require(ServerStorage.Modules.MapBuilder)

---------------------------------------------------------------------------
-- Remotes
---------------------------------------------------------------------------
local remotes = Instance.new("Folder")
remotes.Name = Config.REMOTES_FOLDER
local stageRemote = Instance.new("RemoteEvent")
stageRemote.Name = Config.REMOTE_STAGE
stageRemote.Parent = remotes
local finishRemote = Instance.new("RemoteEvent")
finishRemote.Name = Config.REMOTE_FINISH
finishRemote.Parent = remotes
remotes.Parent = ReplicatedStorage

---------------------------------------------------------------------------
-- Course
---------------------------------------------------------------------------
local course = MapBuilder.build(workspace, Config.SEED, Config)
print(
	string.format(
		"[Beyond] course built: %d parts, %d checkpoints, %d movers, %d spinners",
		course.partCount,
		#course.checkpoints,
		#course.movers,
		#course.spinners
	)
)

---------------------------------------------------------------------------
-- Mood: night sky, bloom, haze. Neon parts glow because of the bloom.
---------------------------------------------------------------------------
local function setupLighting()
	Lighting.ClockTime = 0.2
	Lighting.Brightness = 1.6
	Lighting.Ambient = Color3.fromRGB(40, 32, 70)
	Lighting.OutdoorAmbient = Color3.fromRGB(56, 46, 96)
	Lighting.EnvironmentDiffuseScale = 0.4
	Lighting.EnvironmentSpecularScale = 0.8
	Lighting.GlobalShadows = true

	local sky = Instance.new("Sky")
	sky.StarCount = 5000
	sky.CelestialBodiesShown = false
	sky.Parent = Lighting

	local atmosphere = Instance.new("Atmosphere")
	atmosphere.Density = 0.32
	atmosphere.Offset = 0.15
	atmosphere.Color = Color3.fromRGB(90, 70, 160)
	atmosphere.Decay = Color3.fromRGB(30, 20, 60)
	atmosphere.Glare = 0.4
	atmosphere.Haze = 1.6
	atmosphere.Parent = Lighting

	local bloom = Instance.new("BloomEffect")
	bloom.Intensity = 0.9
	bloom.Size = 30
	bloom.Threshold = 0.85
	bloom.Parent = Lighting

	local grade = Instance.new("ColorCorrectionEffect")
	grade.Contrast = 0.12
	grade.Saturation = 0.15
	grade.TintColor = Color3.fromRGB(235, 230, 255)
	grade.Parent = Lighting
end
setupLighting()

---------------------------------------------------------------------------
-- Moving platforms. Tweening an anchored part does not carry players standing on
-- it, so movers are real physics bodies held by AlignPosition / AlignOrientation.
-- The server owns them and moves the target along a sine wave.
---------------------------------------------------------------------------
type MoverState = { align: AlignPosition, origin: Vector3, axis: Vector3, phase: number }
local moverStates: { MoverState } = {}

for _, part in course.movers do
	local origin = part.Position
	local attachment = Instance.new("Attachment")
	attachment.Parent = part

	local align = Instance.new("AlignPosition")
	align.Mode = Enum.PositionAlignmentMode.OneAttachment
	align.Attachment0 = attachment
	align.MaxForce = math.huge
	align.MaxVelocity = Config.MOVER_TRAVEL * 2
	align.Responsiveness = 40
	align.Position = origin
	align.Parent = part

	local orient = Instance.new("AlignOrientation")
	orient.Mode = Enum.OrientationAlignmentMode.OneAttachment
	orient.Attachment0 = attachment
	orient.RigidityEnabled = true
	orient.CFrame = part.CFrame.Rotation
	orient.Parent = part

	part.Anchored = false
	part:SetNetworkOwner(nil)

	table.insert(moverStates, {
		align = align,
		origin = origin,
		axis = part:GetAttribute("MoverAxis") :: Vector3,
		phase = part:GetAttribute("MoverPhase") :: number,
	})
end

---------------------------------------------------------------------------
-- Spinners: anchored laser bars rotated every frame. Anchored parts moved by
-- CFrame do not fire Touched reliably, so hits are found with a spatial query.
---------------------------------------------------------------------------
type SpinnerState = { part: BasePart, origin: CFrame, direction: number }
local spinnerStates: { SpinnerState } = {}
for _, bar in course.spinners do
	table.insert(spinnerStates, {
		part = bar,
		origin = bar.CFrame,
		direction = bar:GetAttribute("SpinDirection") :: number,
	})
end

local function characterFromPart(part: BasePart): (Model?, Humanoid?)
	local model = part:FindFirstAncestorOfClass("Model")
	if model then
		local humanoid = model:FindFirstChildOfClass("Humanoid")
		if humanoid then
			return model, humanoid
		end
	end
	return nil, nil
end

local function kill(humanoid: Humanoid)
	if humanoid.Health > 0 then
		humanoid.Health = 0
	end
end

local overlap = OverlapParams.new()
overlap.FilterType = Enum.RaycastFilterType.Exclude
overlap.FilterDescendantsInstances = { course.model }

local elapsed = 0
local hazardTimer = 0
RunService.Heartbeat:Connect(function(dt: number)
	elapsed += dt
	local omega = (math.pi * 2) / (Config.MOVER_PERIOD * 2)
	for _, state in moverStates do
		local offset = math.sin(elapsed * omega + state.phase * math.pi * 2)
		state.align.Position = state.origin + state.axis * (offset * Config.MOVER_TRAVEL)
	end

	local angle = math.rad(Config.SPINNER_SPEED) * elapsed
	for _, state in spinnerStates do
		state.part.CFrame = state.origin * CFrame.Angles(0, angle * state.direction, 0)
	end

	-- Spatial hazard checks at 15 Hz are plenty and keep the server cheap.
	hazardTimer += dt
	if hazardTimer >= 1 / 15 then
		hazardTimer = 0
		for _, state in spinnerStates do
			for _, hit in workspace:GetPartsInPart(state.part, overlap) do
				local _, humanoid = characterFromPart(hit)
				if humanoid then
					kill(humanoid)
				end
			end
		end
	end
end)

for _, killPart in course.kills do
	if killPart:GetAttribute("Kind") == "Kill" then
		killPart.Touched:Connect(function(hit: BasePart)
			local _, humanoid = characterFromPart(hit)
			if humanoid then
				kill(humanoid)
			end
		end)
	end
end

---------------------------------------------------------------------------
-- Checkpoints, respawn and finish
---------------------------------------------------------------------------
local checkpointByStage: { [number]: BasePart } = { [0] = course.spawn }
for _, checkpoint in course.checkpoints do
	checkpointByStage[checkpoint:GetAttribute("Stage") :: number] = checkpoint
end

local runStart: { [Player]: number } = {}
local finished: { [Player]: boolean } = {}

local function getStageValue(player: Player): IntValue?
	local stats = player:FindFirstChild("leaderstats")
	return if stats then stats:FindFirstChild(Config.STAT_NAME) :: IntValue? else nil
end

local function onCharacterAdded(player: Player, character: Model)
	local stageValue = getStageValue(player)
	local stage = if stageValue then stageValue.Value else 0
	local checkpoint = checkpointByStage[stage]
	if stage > 0 and checkpoint then
		local root = character:WaitForChild("HumanoidRootPart", 5)
		if root then
			-- Wait one frame so the default spawn does not override our pivot.
			task.wait()
			character:PivotTo(checkpoint.CFrame * CFrame.new(0, 4, 0))
		end
	end
end

Players.PlayerAdded:Connect(function(player: Player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local stageValue = Instance.new("IntValue")
	stageValue.Name = Config.STAT_NAME
	stageValue.Value = 0
	stageValue.Parent = stats
	stats.Parent = player

	runStart[player] = os.clock()
	player.CharacterAdded:Connect(function(character)
		onCharacterAdded(player, character)
	end)
	if player.Character then
		onCharacterAdded(player, player.Character)
	end
end)

Players.PlayerRemoving:Connect(function(player: Player)
	runStart[player] = nil
	finished[player] = nil
end)

local function playerFromHit(hit: BasePart): Player?
	local character = characterFromPart(hit)
	if not character then
		return nil
	end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	if not humanoid or humanoid.Health <= 0 then
		return nil
	end
	return Players:GetPlayerFromCharacter(character)
end

for _, checkpoint in course.checkpoints do
	local stage = checkpoint:GetAttribute("Stage") :: number
	checkpoint.Touched:Connect(function(hit: BasePart)
		local player = playerFromHit(hit)
		if not player then
			return
		end
		local stageValue = getStageValue(player)
		-- Only move forward, one checkpoint at a time, so skipping is impossible.
		if stageValue and stage == stageValue.Value + 1 then
			stageValue.Value = stage
			stageRemote:FireClient(player, stage, Config.STAGES)
		end
	end)
end

course.finish.Touched:Connect(function(hit: BasePart)
	local player = playerFromHit(hit)
	if not player or finished[player] then
		return
	end
	local stageValue = getStageValue(player)
	if not stageValue or stageValue.Value < Config.STAGES then
		return
	end
	finished[player] = true
	local seconds = os.clock() - (runStart[player] or os.clock())
	print(string.format("[Beyond] %s finished in %.2fs", player.Name, seconds))
	finishRemote:FireClient(player, seconds)
end)
