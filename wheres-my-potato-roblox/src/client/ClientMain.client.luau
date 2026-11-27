--[[ WHERE'S MY POTATO? — client entry: loading → title → (first time) the 3D tutorial book
     in your hands → first-person play. Wires the network events to the controllers. ]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local SocialService = game:GetService("SocialService")
local StarterGui = game:GetService("StarterGui")

local Net = require(ReplicatedStorage.Shared.Net)
local Config = require(ReplicatedStorage.Shared.Config)
local Potato = require(ReplicatedStorage.Shared.Potato)

local C = script.Parent.Controllers
local State = require(C.State)
local Carpet = require(C.Carpet)
local VM = require(C.Viewmodel)
local Interact = require(C.Interact)
local Fx = require(C.Fx)
local Sound = require(C.Sound)
local Book = require(C.Book)
local GerardAnim = require(C.GerardAnim)
local HUD = require(script.Parent.UI.HUD)
local Shop = require(script.Parent.UI.ShopUI)
local Menu = require(script.Parent.UI.Menu)

local player = Players.LocalPlayer
pcall(function() StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false) end)
pcall(function() StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Health, false) end)

Menu.loading(true)
HUD.mount(); Shop.mount()
Carpet.setRadius(if State.isMobile then Config.POTATO.Radius.Mobile else Config.POTATO.Radius.PC)

-- ---------------------------------------------------------------- network
Net.event("Data").OnClientEvent:Connect(function(d)
	local first = State.data == nil
	State.data = d
	if first and d.carry and d.carry.tool then State.tool = d.carry.tool end
	State.Changed:Fire()
end)
Net.event("Field").OnClientEvent:Connect(function(delta, full)
	local now = os.clock()
	if full then State.layer = {}; State.empty = {} end
	for i = 1, #delta, 3 do
		local key, layer, emptyIn = delta[i], delta[i + 1], delta[i + 2]
		local before = State.layer[key] or 0
		State.layer[key] = if layer > 0 then layer else nil
		if emptyIn > 0 then State.empty[key] = now + emptyIn else State.empty[key] = nil end
		State.predicted[key] = nil
		Carpet.refreshAround(key)
		task.delay(0.25, Carpet.refreshAround, key) -- once the carved terrain has replicated
		if not full and layer > before and math.random() < 0.35 then
			local ix, iz = Potato.unkey(key)
			local x, z = Potato.cell(ix, iz, 0)
			local cam = workspace.CurrentCamera
			if (cam.CFrame.Position - Vector3.new(x, cam.CFrame.Position.Y, z)).Magnitude < 40 then
				task.delay(0.3, Fx.collapse, Vector3.new(x, cam.CFrame.Position.Y - 4, z))
			end
		end
	end
end)
Net.event("Fx").OnClientEvent:Connect(function(e)
	if e.kind == "picked" then
		for _, v in e.list do
			if v == 6 then Sound.play("Gold"); Fx.sparkle(VM.handPoint(), 30); HUD.toast("✨ Patate DORÉE ! (60 ₣)", "gold")
			elseif v == 5 then Sound.play("Purple"); Fx.sparkle(VM.handPoint(), 24, Color3.fromRGB(190, 120, 255)); HUD.toast("🟣 Vitelotte violette trouvée en creusant ! (25 ₣)", "gold") end
		end
	end
end)
Net.event("Pay").OnClientEvent:Connect(function(value, pos, variety)
	Fx.coin(pos, value, variety); HUD.bump(); Sound.rate("Coin", 70, 0.8)
end)
Net.event("Notify").OnClientEvent:Connect(function(text, kind) HUD.toast(text, kind) end)
Net.event("Say").OnClientEvent:Connect(function(text, gesture) GerardAnim.say(text, gesture) end)
Net.event("Star").OnClientEvent:Connect(function() Sound.play("Star", 1) end)
Net.event("Session").OnClientEvent:Connect(function(s)
	if s.teleporting ~= nil then
		Menu.loading(s.teleporting)
	end
	if s.invite ~= nil then
		local ok, err = pcall(function()
			local opts = Instance.new("ExperienceInviteOptions")
			opts.PromptMessage = "Viens m’aider à remplir le bocal géant !"
			if s.invite then opts.LaunchData = s.invite end
			SocialService:PromptGameInvite(player, opts)
		end)
		if not ok then HUD.toast("Invitation impossible ici : " .. tostring(err), "warn") end
	end
end)

-- ---------------------------------------------------------------- wiring
HUD.onTool = function(id) Interact.setTool(id) end
HUD.onUse = function(v) Interact.setUsing(v) end
HUD.onBook = function()
	if State.mode ~= "play" then return end
	HUD.show(false)
	Book.show(function() HUD.show(true) end)
end
HUD.onInvite = function()
	local ok, can = pcall(function() return SocialService:CanSendGameInviteAsync(player) end)
	if ok and not can then HUD.toast("Les invitations ne sont pas disponibles sur ce compte.", "warn"); return end
	Net.event("Invite"):FireServer()
end
Shop.onClose = function() State.mode = "play" end
local function bindShopPrompt()
	local world = workspace:WaitForChild("World")
	local shop = world:WaitForChild("Shop")
	local talk = shop:WaitForChild("TalkPoint")
	local prompt = talk:WaitForChild("ProximityPrompt") :: ProximityPrompt
	prompt.Triggered:Connect(function()
		if State.mode ~= "play" then return end
		State.mode = "shop"; Shop.open()
	end)
end
task.spawn(bindShopPrompt)

-- ---------------------------------------------------------------- main loop
RunService.RenderStepped:Connect(function(dt)
	HUD.update(dt, if State.mode == "play" then Interact.prompt else "")
	if State.mode == "play" then
		local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
		Fx.update(dt, workspace.CurrentCamera.CFrame, hum ~= nil and hum.MoveDirection.Magnitude > 0.1)
	end
end)

-- ---------------------------------------------------------------- boot
local ready = ReplicatedStorage:WaitForChild("WorldReady") :: BoolValue
GerardAnim.start()
Carpet.start()
VM.start()
Interact.start()
Sound.ambience()
while not ready.Value do ready.Changed:Wait() end
while not State.data do task.wait(0.1) end
Net.event("Ready"):FireServer()
State.mode = "menu"
Menu.title(function()
	State.mode = "play"
	HUD.show(true)
	if not State.data.tutorial then
		HUD.show(false)
		Book.show(function()
			HUD.show(true)
			Net.event("TutorialDone"):FireServer()
		end)
	end
end)

