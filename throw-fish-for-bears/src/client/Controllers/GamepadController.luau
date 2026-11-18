--[[ GamepadController: full controller support (PS5 / Xbox / any gamepad).
       R2            : the contextual action (cast, reel, throw, place, sprint) - Actions
       D-pad left    : equip the rod          D-pad right : equip a fish
       D-pad up      : Bears + Fish inventory D-pad down  : close the open menu
       Circle (B)    : close the open menu, or SKIP a cinematic
       Cross  (A)    : jump / press the selected button in menus / continue screens
       Square (X)    : world interactions (sell, shop, collect, hire...)
       Triangle (Y)  : upgrade interactions (bucket...)
     Menus are navigable with the stick / d-pad: when a window opens with a gamepad, its
     first button is selected automatically. ]]
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local ContextActionService = game:GetService("ContextActionService")
local GuiService = game:GetService("GuiService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Net = require(ReplicatedStorage.Shared.Net)
local Cine = require(script.Parent.CinematicFx)

local Gamepad = {}
local player = Players.LocalPlayer
local PASS = Enum.ContextActionResult.Pass
local SINK = Enum.ContextActionResult.Sink

local function usingGamepad(): boolean
	local t = UserInputService:GetLastInputType()
	return t == Enum.UserInputType.Gamepad1 or t == Enum.UserInputType.Gamepad2
end

function Gamepad.init(Menus)
	local function openWindow()
		for name, w in Menus.windows do
			if w.menu and w.menu.IsOpen then return name, w end
		end
		return nil, nil
	end
	local function closeOpen(): boolean
		local _, w = openWindow()
		if w then
			w.menu.Close()
			GuiService.SelectedObject = nil
			return true
		end
		return false
	end
	local function bind(name, keys, fn)
		ContextActionService:BindAction(name, function(_, state)
			if state ~= Enum.UserInputState.Begin then return PASS end
			return if fn() then SINK else PASS
		end, false, table.unpack(keys))
	end
	bind("TFB_GP_Rod", { Enum.KeyCode.DPadLeft }, function()
		if openWindow() then return false end -- the d-pad navigates the menu
		Net.event("EquipSlot"):FireServer("Rod")
		return true
	end)
	bind("TFB_GP_Fish", { Enum.KeyCode.DPadRight }, function()
		if openWindow() then return false end
		Net.event("EquipSlot"):FireServer("Fish")
		return true
	end)
	bind("TFB_GP_Inventory", { Enum.KeyCode.DPadUp }, function()
		if openWindow() then return false end
		Menus.open("Inventory")
		return true
	end)
	bind("TFB_GP_Close", { Enum.KeyCode.DPadDown }, function()
		if not openWindow() then return false end
		return false -- let the d-pad navigate; Circle closes
	end)
	bind("TFB_GP_Back", { Enum.KeyCode.ButtonB }, function()
		if closeOpen() then return true end
		return Cine.trySkip()
	end)

	-- menus: keep a button selected while a window is open (gamepad only)
	task.spawn(function()
		while true do
			task.wait(0.15)
			local _, w = openWindow()
			if w and usingGamepad() then
				local sel = GuiService.SelectedObject
				if not sel or not sel:IsDescendantOf(w.frame.Parent or w.frame) or not sel.Visible then
					local best
					for _, d in w.frame:GetDescendants() do
						if d:IsA("GuiButton") and d.Visible and d.Selectable and d.AbsoluteSize.X > 20 then
							best = d
							break
						end
					end
					if best then GuiService.SelectedObject = best end
				end
			elseif not w and GuiService.SelectedObject and usingGamepad() then
				-- nothing open: release the selection so A jumps again
				local gui = GuiService.SelectedObject
				local pg = player:FindFirstChild("PlayerGui")
				if pg and gui:IsDescendantOf(pg) then GuiService.SelectedObject = nil end
			end
		end
	end)
end

return Gamepad
