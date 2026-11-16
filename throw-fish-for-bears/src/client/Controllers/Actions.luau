--[[ Actions: the single contextual action (big round button on mobile, E / click
     on PC, R2 on gamepad). The context is computed every frame from the player's
     state, what they hold and where they stand, so ONE button always does the
     right thing: CAST, HOOK!, REEL (hold), THROW (hold), PLACE, SPRINT (bear). ]]
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local ContextActionService = game:GetService("ContextActionService")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Layout = require(ReplicatedStorage.Shared.Layout)
local Signal = require(ReplicatedStorage.Shared.Util.Signal)
local Data = require(script.Parent.Data)

local Actions = {}
Actions.handlers = {} -- [id] = { down = fn, up = fn }
Actions.context = nil
Actions.ContextChanged = Signal.new()
Actions.held = false
Actions.override = nil -- controllers can force a context (e.g. reel game)

local CONTEXTS = {
	Cast = { label = "CAST", color = "blue", hold = false, icon = "🎣", hint = "Tap the lake to cast!" },
	Stop = { label = "REEL IN", color = "grey", hold = false, icon = "✋", hint = "Waiting for a bite... (tap to pull the line out)" },
	Hook = { label = "HOOK!", color = "red", hold = false, icon = "❗", hint = "A bite!" },
	Reel = { label = "REEL", color = "orange", hold = true, icon = "🌀", hint = "HOLD the screen to reel! Release when red!" },
	Throw = { label = "THROW", color = "red", hold = true, icon = "💪", hint = "HOLD the screen to charge, release to THROW!" },
	Place = { label = "PLACE", color = "green", hold = false, icon = "🐻", hint = "Tap a spot in your base to place the bear!" },
	Sprint = { label = "SPRINT", color = "yellow", hold = true, icon = "💨" },
}
Actions.CONTEXTS = CONTEXTS

local function compute()
	if Actions.override then return Actions.override end
	local player = Players.LocalPlayer
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then return nil end
	local st = Data.state
	local base = player:GetAttribute("Base")
	if char:GetAttribute("IsBear") then
		return if st == "ControllingBear" then "Sprint" else nil
	end
	if st == "Bite" then return "Hook" end
	if st == "Reeling" then return "Reel" end
	if st == "Fishing" then return "Stop" end
	if st == "ChargingThrow" then return "Throw" end
	local holding = char:GetAttribute("Holding")
	if st == "Idle" then
		if holding == "Rod" and base and Layout.isAtFishingSpot(base, root.Position) then return "Cast" end
		if holding == "Fish" and Layout.isInThrowArea(root.Position) then return "Throw" end
	end
	if st == "CarryingCapturedBear" and base and Layout.isInBase(base, root.Position, 6) then
		return "Place"
	end
	return nil
end

function Actions.press()
	local id = Actions.context
	if not id then return end
	Actions.held = true
	local h = Actions.handlers[id]
	if h and h.down then task.spawn(h.down) end
end

function Actions.release()
	if not Actions.held then return end
	Actions.held = false
	local id = Actions.context
	local h = id and Actions.handlers[id]
	if h and h.up then task.spawn(h.up) end
end

function Actions.on(id: string, down, up)
	Actions.handlers[id] = { down = down, up = up }
end

function Actions.init()
	RunService.Heartbeat:Connect(function()
		local c = compute()
		if c ~= Actions.context then
			-- releasing a held action when its context disappears
			if Actions.held and Actions.context then
				local h = Actions.handlers[Actions.context]
				Actions.held = false
				if h and h.up then task.spawn(h.up) end
			end
			Actions.context = c
			Actions.ContextChanged:Fire(c)
		end
	end)
	ContextActionService:BindAction("TFB_Action", function(_, state)
		if state == Enum.UserInputState.Begin then
			Actions.press()
		elseif state == Enum.UserInputState.End or state == Enum.UserInputState.Cancel then
			Actions.release()
		end
		return Enum.ContextActionResult.Pass
	end, false, Enum.KeyCode.E, Enum.KeyCode.ButtonR2)
	-- touch / click the WORLD (no button): cast at the lake, hold to reel, hold to throw
	local rayParams = RaycastParams.new()
	rayParams.FilterType = Enum.RaycastFilterType.Include
	local function towardLake(screen: Vector2): boolean
		local cam = workspace.CurrentCamera
		local ray = cam:ViewportPointToRay(screen.X, screen.Y)
		local map = workspace:FindFirstChild("Map")
		if map then
			rayParams.FilterDescendantsInstances = { map }
			local hit = workspace:Raycast(ray.Origin, ray.Direction * 800, rayParams)
			if hit then
				local n = hit.Instance.Name
				if n == "Lake" or n == "LakeBed" or n == "LakeKill" then return true end
				return hit.Position.Z > Layout.DOCK_START_Z + 4
			end
		end
		-- in the air: aiming above the lake side counts
		return ray.Direction.Z > 0.15
	end
	local touching: InputObject? = nil
	UserInputService.InputBegan:Connect(function(input, gp)
		if gp then return end
		if input.UserInputType ~= Enum.UserInputType.MouseButton1 and input.UserInputType ~= Enum.UserInputType.Touch then return end
		local ctx = Actions.context
		if ctx == "Cast" then
			local screen = if input.UserInputType == Enum.UserInputType.Touch
				then Vector2.new(input.Position.X, input.Position.Y + game:GetService("GuiService"):GetGuiInset().Y)
				else UserInputService:GetMouseLocation()
			if towardLake(screen) then Actions.press() Actions.release() end
		elseif ctx == "Reel" or ctx == "Throw" then
			touching = input
			Actions.press()
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if touching and (input == touching or input.UserInputType == Enum.UserInputType.MouseButton1) then
			touching = nil
			Actions.release()
		end
	end)
	-- Shift = sprint as a bear on PC
	UserInputService.InputBegan:Connect(function(input, gp)
		if gp then return end
		if input.KeyCode == Enum.KeyCode.LeftShift and Actions.context == "Sprint" then
			Actions.press()
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if input.KeyCode == Enum.KeyCode.LeftShift and Actions.context == "Sprint" then
			Actions.release()
		end
	end)
end

return Actions
