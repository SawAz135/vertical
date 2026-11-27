--[[ Menu: loading screen while the desert is generated, then the title screen — the camera
     glides around the skyscraper jar at golden hour, the logo bounces in (stud panels, gold
     gradient, extruded letters), a big 3D JOUER stud button. Pressing it flies the camera
     down into your eyes and the game begins. ]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UI = require(ReplicatedStorage.Shared.StudKit.StudUI)
local Motion = require(ReplicatedStorage.Shared.StudKit.StudMotion)
local Sound = require(script.Parent.Parent.Controllers.Sound)

local Menu = {}
local RGB = Color3.fromRGB
local cam = workspace.CurrentCamera
local gui = UI.ScreenGui("Titre", 20, { Menu = false })
local fade = UI.new("Frame", { Name = "Fondu", BackgroundColor3 = RGB(20, 12, 6), Size = UDim2.fromScale(1, 1), ZIndex = 50 }, gui)
local loadT = UI.Text(fade, "Le désert de patates se prépare…", { Size = UDim2.fromOffset(600, 40), Position = UDim2.fromScale(0.5, 0.56), Max = 28, Font = "Gotham", ZIndex = 51 })
local loadP = UI.Text(fade, "🥔", { Size = UDim2.fromOffset(90, 90), Position = UDim2.fromScale(0.5, 0.44), Max = 80, ZIndex = 51, Thickness = 0 })

local box = UI.new("Frame", { Name = "Logo", BackgroundTransparency = 1, Size = UDim2.fromOffset(640, 420), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.46), Visible = false }, gui)
local sc = UI.new("UIScale", { Name = "WindowScale" }, box)
local anim = Instance.new("NumberValue"); anim.Value = 1
Motion.BindResponsive(sc, 1, anim)
local plate = UI.StudPanel(box, { Size = UDim2.fromOffset(600, 170), Position = UDim2.fromOffset(20, 30), Gradient = UI.seq(RGB(255, 226, 120), RGB(244, 176, 52), RGB(214, 124, 20)), Corner = 16, Stroke = 4 })
plate.Rotation = -2
UI.ShadowText(plate, "WHERE'S MY", { Size = UDim2.new(1, -40, 0, 50), Position = UDim2.new(0.5, 0, 0, 44), Max = 46, Font = "Gotham", Stroke = RGB(90, 40, 0), Thickness = 4, ZIndex = 9 })
UI.ShadowText(plate, "POTATO?", { Size = UDim2.new(1, -40, 0, 84), Position = UDim2.new(0.5, 0, 0, 112), Max = 82, Font = "Gotham", Stroke = RGB(90, 40, 0), Thickness = 5, ZIndex = 9, Offset = 4 })
UI.Text(box, "🥔", { Size = UDim2.fromOffset(120, 120), Position = UDim2.fromOffset(600, 40), Max = 110, Rotation = 14, ZIndex = 12, Thickness = 0 })
UI.Pill(box, "Ramasse · Creuse · Remplis le bocal géant", { Width = 430, Height = 34, Position = UDim2.fromOffset(320, 232), TextSize = 18, ZIndex = 12 })
local play = UI.Button(box, { Style = "Stud", Theme = "orange", Size = Vector2.new(300, 92), Text = "JOUER", TextSize = 54, Position = UDim2.fromOffset(320, 330) })
Motion.BindButton(play, 1.06)

local orbit = true
local oT = 0
function Menu.loading(show: boolean)
	fade.Visible = true
	TweenService:Create(fade, TweenInfo.new(0.6), { BackgroundTransparency = if show then 0 else 1 }):Play()
	TweenService:Create(loadT, TweenInfo.new(0.4), { TextTransparency = if show then 0 else 1 }):Play()
	TweenService:Create(loadP, TweenInfo.new(0.4), { TextTransparency = if show then 0 else 1 }):Play()
	for _, s in loadT:GetChildren() do if s:IsA("UIStroke") then s.Transparency = if show then 0 else 1 end end
	if not show then task.delay(0.6, function() fade.Visible = false end) end
end

function Menu.title(onPlay: () -> ())
	gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")
	cam.CameraType = Enum.CameraType.Scriptable
	orbit = true
	RunService:BindToRenderStep("WMP_Menu", Enum.RenderPriority.Camera.Value + 1, function(dt)
		if not orbit then return end
		oT += dt
		local a = oT * 0.06 - 1.2
		local pos = Vector3.new(math.cos(a) * 120, 46 + math.sin(oT * 0.2) * 8, math.sin(a) * 120)
		cam.CFrame = CFrame.lookAt(pos, Vector3.new(0, 52, 0))
		loadP.Rotation = math.sin(oT * 4) * 12
	end)
	Menu.loading(false)
	box.Visible = true
	anim.Value = 0.5
	TweenService:Create(anim, TweenInfo.new(0.6, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Value = 1 }):Play()
	local con
	con = play.Activated:Connect(function()
		con:Disconnect()
		Sound.play("Open")
		TweenService:Create(anim, TweenInfo.new(0.25, Enum.EasingStyle.Back, Enum.EasingDirection.In), { Value = 0.01 }):Play()
		-- fly the camera down to the player's eyes
		local char = Players.LocalPlayer.Character or Players.LocalPlayer.CharacterAdded:Wait()
		local head = char:WaitForChild("Head") :: BasePart
		orbit = false
		local from, t0 = cam.CFrame, os.clock()
		local fly
		fly = RunService.RenderStepped:Connect(function()
			local k = math.min(1, (os.clock() - t0) / 1.6)
			local e = 1 - (1 - k) ^ 3
			local to = head.CFrame * CFrame.new(0, 0.4, 0)
			cam.CFrame = from:Lerp(CFrame.lookAt(to.Position, to.Position + head.CFrame.LookVector), e)
			if k >= 1 then
				fly:Disconnect()
				RunService:UnbindFromRenderStep("WMP_Menu")
				box.Visible = false
				cam.CameraType = Enum.CameraType.Custom
				onPlay()
			end
		end)
	end)
end
return Menu
