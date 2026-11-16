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
	Cast = { label = "CAST", color = "blue", hold = false, icon = "🎣" },
	Stop = { label = "REEL IN", color = "grey", hold = false, icon = "✋" },
	Hook = { label = "HOOK!", color = "red", hold = false, icon = "❗" },
	Reel = { label = "REEL", color = "orange", hold = true, icon = "🌀" },
	Throw = { label = "THROW", color = "red", hold = true, icon = "💪" },
	Place = { label = "PLACE", color = "green", hold = false, icon = "🐻" },
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
