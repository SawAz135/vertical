--[[ GerardAnim: brings Gérard to life on each client (Motor6D.Transform, no animation ids):
     breathing, weight shift, head + body turning to look at you, blinking, jaw synced to the
     text being typed, and gestures (wave, point, thumbs-up, shrug, cheer) blended over the
     idle. His lines appear in a comic speech bubble above his head, typed letter by letter. ]]
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Sound = require(script.Parent.Sound)

local G = {}
local model: Model? = nil
local J = {} :: { [string]: Motor6D }
local gesture, gT, gDur = nil :: string?, 0, 2.4
local talkUntil, blinkT, blink, t = 0, 2, 0, 0
local bubble, label, nameL
local typing = { text = "", shown = 0, t = 0 }

local function ease(x: number) x = math.clamp(x, 0, 1); return x * x * (3 - 2 * x) end

local function buildBubble(head: BasePart)
	bubble = Instance.new("BillboardGui"); bubble.Name = "Bubble"; bubble.Adornee = head; bubble.Size = UDim2.fromScale(11, 3.6); bubble.StudsOffsetWorldSpace = Vector3.new(0, 3.6, 0)
	bubble.LightInfluence = 0; bubble.MaxDistance = 140; bubble.AlwaysOnTop = false; bubble.Enabled = false; bubble.Parent = head
	local box = Instance.new("Frame"); box.Size = UDim2.fromScale(1, 0.82); box.BackgroundColor3 = Color3.fromRGB(255, 248, 232); box.Parent = bubble
	local cr = Instance.new("UICorner"); cr.CornerRadius = UDim.new(0.25, 0); cr.Parent = box
	local st = Instance.new("UIStroke"); st.Color = Color3.fromRGB(58, 36, 20); st.Thickness = 3; st.Parent = box
	local tail = Instance.new("TextLabel"); tail.BackgroundTransparency = 1; tail.Size = UDim2.fromScale(0.12, 0.3); tail.Position = UDim2.fromScale(0.44, 0.76); tail.Text = "▼"; tail.TextScaled = true; tail.TextColor3 = Color3.fromRGB(255, 248, 232); tail.TextStrokeColor3 = Color3.fromRGB(58, 36, 20); tail.TextStrokeTransparency = 0; tail.Parent = bubble
	nameL = Instance.new("TextLabel"); nameL.BackgroundTransparency = 1; nameL.Size = UDim2.fromScale(0.4, 0.2); nameL.Position = UDim2.fromScale(0.05, 0.05); nameL.Font = Enum.Font.PermanentMarker; nameL.TextScaled = true; nameL.TextXAlignment = Enum.TextXAlignment.Left; nameL.Text = "Gérard"; nameL.TextColor3 = Color3.fromRGB(184, 71, 28); nameL.Parent = box
	label = Instance.new("TextLabel"); label.BackgroundTransparency = 1; label.Size = UDim2.fromScale(0.9, 0.66); label.Position = UDim2.fromScale(0.05, 0.27); label.Font = Enum.Font.FredokaOne; label.TextScaled = true; label.TextWrapped = true; label.TextXAlignment = Enum.TextXAlignment.Left; label.TextYAlignment = Enum.TextYAlignment.Top; label.TextColor3 = Color3.fromRGB(58, 36, 20); label.Text = ""; label.Parent = box
	local sc = Instance.new("UIScale"); sc.Scale = 0; sc.Parent = box
	bubble:SetAttribute("ready", true)
end

function G.say(text: string, g: string?)
	if not model or not label then return end
	typing = { text = text, shown = 0, t = 0 }
	label.Text = ""; label.MaxVisibleGraphemes = 0; label.Text = text
	bubble.Enabled = true
	local box = label.Parent :: Frame
	local sc = box:FindFirstChildOfClass("UIScale") :: UIScale
	sc.Scale = 0
	TweenService:Create(sc, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()
	local dur = #text / 38 + 2.6
	talkUntil = os.clock() + #text / 38
	if g and g ~= "talk" then gesture = g; gT = 0; gDur = 2.4 end
	task.delay(dur, function()
		if typing.text == text then
			TweenService:Create(sc, TweenInfo.new(0.25, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { Scale = 0 }):Play()
			task.delay(0.26, function() if typing.text == text then bubble.Enabled = false end end)
		end
	end)
end

function G.start()
	task.spawn(function()
		local world = workspace:WaitForChild("World")
		model = world:WaitForChild("Gerard") :: Model
		for _, d in (model :: Model):GetDescendants() do if d:IsA("Motor6D") then J[d.Name] = d end end
		local head = (model :: Model):WaitForChild("Head") :: BasePart
		buildBubble(head)
	end)
	RunService.RenderStepped:Connect(function(dt)
		if not model or not J.Neck then return end
		t += dt
		local cam = workspace.CurrentCamera
		local head = (model :: Model):FindFirstChild("Head") :: BasePart
		local root = (model :: Model).PrimaryPart :: BasePart
		if not head or not root then return end
		local dist = (cam.CFrame.Position - head.Position).Magnitude
		if dist > 220 then return end -- far away: no need to animate
		-- look at the camera
		local rel = root.CFrame:PointToObjectSpace(cam.CFrame.Position)
		local yaw = math.atan2(-rel.X, -rel.Z)
		local pitch = math.atan2(rel.Y - 6.5, math.sqrt(rel.X ^ 2 + rel.Z ^ 2))
		if dist > 45 then yaw = math.sin(t * 0.21) * 0.5; pitch = -0.1 end
		yaw = math.clamp(yaw, -1.1, 1.1); pitch = math.clamp(pitch, -0.45, 0.45)
		-- gesture weights
		local g = { lSh = Vector3.zero, rSh = Vector3.zero, lEl = 0, rEl = 0, lean = 0, shrug = 0 }
		if gesture then
			gT += dt
			local k = gT / gDur
			local e = ease(k * 3) * (1 - ease((k - 0.75) * 4))
			if gesture == "wave" then g.rSh = Vector3.new(-0.2, 0, 2.5 * e); g.rEl = -0.9 * e + math.sin(gT * 13) * 0.35 * e
			elseif gesture == "point" then g.rSh = Vector3.new(-1.45 * e, 0, 0.35 * e); g.rEl = -0.1 * e; g.lean = 0.05 * e
			elseif gesture == "shrug" then g.shrug = e; g.lSh = Vector3.new(-0.3 * e, 0, -0.5 * e); g.rSh = Vector3.new(-0.3 * e, 0, 0.5 * e); g.lEl = -1.6 * e; g.rEl = -1.6 * e
			elseif gesture == "thumbs" then g.rSh = Vector3.new(-0.9 * e, 0, 0.3 * e); g.rEl = -1.5 * e
			elseif gesture == "cheer" then g.lSh = Vector3.new(-0.2 * e, 0, -2.7 * e); g.rSh = Vector3.new(-0.2 * e, 0, 2.7 * e); g.lEl = -0.4 * e; g.rEl = -0.4 * e; g.lean = -0.08 * e + math.sin(gT * 10) * 0.03 * e
			end
			if k >= 1 then gesture = nil end
		end
		local br = math.sin(t * 1.6)
		local shift = math.sin(t * 0.35)
		J.Waist.Transform = CFrame.new(shift * 0.08, br * 0.02, 0) * CFrame.Angles(0.04 + g.lean, yaw * 0.25, -shift * 0.035)
		local talking = os.clock() < talkUntil
		J.Neck.Transform = CFrame.Angles(-pitch * 0.8 + (if talking then math.sin(t * 9) * 0.03 else 0), yaw * 0.6, math.sin(t * 0.7) * 0.03 + (if talking then math.sin(t * 5.3) * 0.04 else 0))
		if J.JawJ then J.JawJ.Transform = CFrame.new(0, 0, 0) * CFrame.Angles(if talking then (0.5 + 0.5 * math.sin(t * 22)) * 0.32 else 0, 0, 0) end
		-- blink
		blinkT -= dt
		if blinkT < 0 then blinkT = 2 + math.random() * 3.5; blink = 1 end
		blink = math.max(0, blink - dt * 7)
		local lid = math.sin(math.min(1, blink) * math.pi)
		for _, n in { "LidL", "LidR" } do if J[n] then J[n].Transform = CFrame.new(0, -lid * 0.14, 0) * CFrame.Angles(0, 0, 0) end end
		-- arms (idle: resting on the belly / counter)
		local idle = math.sin(t * 1.6 + 0.5) * 0.03
		if J.ShoulderL then J.ShoulderL.Transform = CFrame.new(0, g.shrug * 0.25, 0) * CFrame.Angles(-0.35 + idle + g.lSh.X, g.lSh.Y, 0.18 + g.lSh.Z) end
		if J.ShoulderR then J.ShoulderR.Transform = CFrame.new(0, g.shrug * 0.25, 0) * CFrame.Angles(-0.35 + idle + g.rSh.X, g.rSh.Y, -0.18 + g.rSh.Z) end
		if J.ElbowL then J.ElbowL.Transform = CFrame.Angles(-0.75 + g.lEl, 0, 0) end
		if J.ElbowR then J.ElbowR.Transform = CFrame.Angles(-0.75 + g.rEl, 0, 0) end
		-- typing the bubble text
		if label and typing.shown < #typing.text then
			typing.t += dt
			local n = math.min(#typing.text, math.floor(typing.t * 38))
			if n ~= typing.shown then typing.shown = n; label.MaxVisibleGraphemes = n; if n % 3 == 0 and dist < 40 then Sound.play("Talk", 0.5) end end
		end
	end)
end
return G
