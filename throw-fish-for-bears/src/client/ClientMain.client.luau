--[[ THROW FISH FOR BEARS - client entry point. Builds the three ScreenGuis
     (MainHUD, Menus, Overlay), starts every controller and wires the remotes that
     only produce feedback (notifications, sounds, reveals, workout fx). ]]
local Players = game:GetService("Players")
local StarterGui = game:GetService("StarterGui")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ProximityPromptService = game:GetService("ProximityPromptService")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local Controllers = script.Parent:WaitForChild("Controllers")
local UI = script.Parent:WaitForChild("UI")

local Data = require(Controllers.Data)
local Sound = require(Controllers.Sound)
local Fx = require(Controllers.Fx)
local Actions = require(Controllers.Actions)
local CameraController = require(Controllers.CameraController)
local AnimalAnimator = require(Controllers.AnimalAnimator)
local HumanPose = require(Controllers.HumanPose)
local Fishing = require(Controllers.FishingController)
local Throw = require(Controllers.ThrowController)
local Capture = require(Controllers.CaptureController)
local Ambience = require(Controllers.Ambience)
local Theme = require(UI.Theme)
local HUD = require(UI.HUD)
local Menus = require(UI.Menus)
local Reveal = require(UI.Reveal)
local Notify = require(UI.Notify)

local UserInputService = game:GetService("UserInputService")
local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- custom hotbar replaces the default backpack
task.spawn(function()
	for _ = 1, 10 do
		local ok = pcall(function()
			StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
		end)
		if ok then break end
		task.wait(0.5)
	end
end)

local function screen(name: string, order: number)
	local g = Instance.new("ScreenGui")
	g.Name = name
	g.ResetOnSpawn = false
	g.DisplayOrder = order
	g.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	g.ScreenInsets = Enum.ScreenInsets.DeviceSafeInsets
	local s = Instance.new("UIScale")
	s.Name = "RootScale"
	s.Parent = g
	g.Parent = playerGui
	return g
end

local hudGui = screen("MainHUD", 1)
local overlayGui = screen("Overlay", 10)
local Kit = require(UI.Kit)
Kit.init(playerGui)
require(UI.Sim).init(playerGui)

-- one scale for every screen: designed for a 900 x 420 phone in landscape
local function rescale()
	local vp = workspace.CurrentCamera.ViewportSize
	local k = math.clamp(math.min(vp.X / 900, vp.Y / 420), 0.75, 1.6)
	if UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled then k = math.max(k * 0.72, 0.5) end -- smaller on phones
	-- the HUD and menus scale themselves (Stud kit WindowScale); only the overlay uses this
	hudGui.RootScale.Scale = 1
	overlayGui.RootScale.Scale = k
end
workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(rescale)
rescale()

-- UI ---------------------------------------------------------------------------------
HUD.menus = Menus
Menus.mount()
HUD.mount(hudGui)
Notify.mount(overlayGui)
Reveal.mount(overlayGui)

-- controllers ----------------------------------------------------------------------------
CameraController.init()
AnimalAnimator.init()
HumanPose.init()
Actions.init()
Fishing.bindUI(HUD.reelUI)
Fishing.init()
Throw.init()
Throw.ChargeChanged:Connect(HUD.setCharge)
Throw.Flight:Connect(HUD.throwDistance)
Capture.Reveal = Reveal
Capture.Unlock = require(UI.BearUnlock).show
Capture.Flash = Notify.flash
Capture.init()
Ambience.init()
require(Controllers.FishUpController).init(require(UI.Sim))
local Announce = require(UI.Announce)
Announce.mount(hudGui)
require(Controllers.TutorialController).init(hudGui, require(UI.Sim), HUD, Menus)
Data.init()
Sound.startMusic()

-- feedback remotes --------------------------------------------------------------------------
Net.event("Notify").OnClientEvent:Connect(function(text, kind)
	Notify.show(text, kind)
end)
Net.event("Sfx").OnClientEvent:Connect(function(name, pos)
	Sound.play(name, { at = pos })
end)
Net.event("Announce").OnClientEvent:Connect(function(d)
	Announce.show(d)
end)
Net.event("CatchReveal").OnClientEvent:Connect(function(fish, extra)
	Reveal.fish(fish, extra)
end)
Net.event("WorkoutFx").OnClientEvent:Connect(function(who, level)
	local char = who.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if root then
		Fx.burst(root.Position - Vector3.new(0, 2.8, 0), Color3.fromRGB(255, 120, 60), 0.6)
	end
	if who == player then
		Sound.play("Lift")
		Sound.play("Reward")
		HUD.popup("+" .. level .. " PER LIFT!", Color3.fromRGB(255, 200, 60))
		CameraController.punch(-6)
	end
end)

-- prompts: open menus locally; hide other players' pick-up prompts
ProximityPromptService.PromptTriggered:Connect(function(prompt)
	local kind = prompt:GetAttribute("TFBPrompt")
	if kind == "Sell" then
		Menus.open("Sell")
	elseif kind == "Shop" then
		Menus.open("Shop")
	end
end)
local function filterPrompt(d: Instance)
	if d:IsA("ProximityPrompt") and d:GetAttribute("TFBPrompt") == "PickupBear" then
		d.Enabled = d:GetAttribute("Owner") == player.UserId
	end
end
for _, d in workspace:GetDescendants() do filterPrompt(d) end
workspace.DescendantAdded:Connect(filterPrompt)

-- gifts badge
task.spawn(function()
	while true do
		task.wait(1)
		HUD.setGiftBadge(Menus.giftReady())
	end
end)

-- rainbow labels over Ultra Secret bears
RunService.Heartbeat:Connect(function()
	local h = (os.clock() * 0.3) % 1
	for _, m in workspace:WaitForChild("Bears"):GetChildren() do
		local root = m.PrimaryPart
		local label = root and root:FindFirstChild("BearLabel")
		if label then
			for _, t in label:GetChildren() do
				if t:GetAttribute("Rainbow") then (t :: TextLabel).TextColor3 = Color3.fromHSV(h, 0.7, 1) end
			end
		end
	end
end)

local _ = Theme
print("[TFB] client ready")
