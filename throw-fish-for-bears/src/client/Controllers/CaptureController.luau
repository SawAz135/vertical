--[[ CaptureController: the local player's bear sequence.
     Spawned  -> establishing shot of the landing spot and the den
     Alert    -> push-in on the bear's face (growl)
     Run      -> side tracking shot of the running bear (footsteps)
     Eat      -> low side angle (arrive + sniff), close 3/4 on the mouth (bite,
                 chew, crumbs), front pull-back (happy), 360 orbit + flash (transform)
     Controlling -> you ARE the bear: return HUD (distance, progress, timer), 3D arrow
                 to your base, SPRINT (Shift / button), dust + footsteps
     Arrived / Captured -> celebration, reveal card, carry the bear home and PLACE it
     Placement ghost: a ring under the spot where PLACE will put the bear. ]]
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local Layout = require(Shared.Layout)
local GameConfig = require(Shared.Config.GameConfig)
local BearConfig = require(Shared.Config.BearConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local Easing = require(Shared.Util.Easing)
local Format = require(Shared.Util.Format)
local Fx = require(script.Parent.Fx)
local Sound = require(script.Parent.Sound)
local Actions = require(script.Parent.Actions)
local CameraController = require(script.Parent.CameraController)
local Cine = require(script.Parent.CinematicFx)
local Data = require(script.Parent.Data)
local Theme = require(script.Parent.Parent.UI.Theme)

local Capture = {}
local player = Players.LocalPlayer
local current = nil -- { bear, fish, landing, den }
local returnGui, returnFill, returnText, returnTimer, returnName
local arrow
local controlling = nil
local sprinting = false
local ghost

Capture.Reveal = nil -- set by ClientMain (UI.Reveal)
Capture.Flash = nil -- set by ClientMain (screen flash function)

local function headOf(bear: Model): BasePart?
	return bear and bear:FindFirstChild("Head") :: BasePart?
end

local function rootOf(m: Model?): BasePart?
	return m and m.PrimaryPart
end

local function rarityOf(bear: Model?)
	return RarityConfig.get(bear and bear:GetAttribute("Rarity") or "Common")
end

local function bearPitch(bear: Model): number
	return Sound.BearPitch[bear:GetAttribute("Species") or ""] or 1
end

-- shots --------------------------------------------------------------------------
local function establishing()
	local c = current
	-- the bushes of the den shake: something is coming...
	local rustle = c.den + Vector3.new(0, 2.5, 0)
	for i = 0, 4 do
		task.delay(i * 0.12, function()
			Fx.blocks(rustle, Color3.fromRGB(90, 180, 60), 5, 9, 0.35, { life = 0.9, up = 1.4, spread = 2.2, gravity = 25,
				colors = { Color3.fromRGB(90, 180, 60), Color3.fromRGB(130, 210, 80), Color3.fromRGB(70, 140, 45) } })
		end)
	end
	Sound.play("Sniff", { at = c.den, pitch = 0.7 })
	local tier = rarityOf(c.bear)
	if tier.index >= 4 then
		-- rare bear: coloured glow pulses on the screen edges + sparkles in the den
		Cine.rarityTint(tier.textColor or tier.color, 0.35 + tier.index * 0.04)
		Fx.sparkle(rustle, tier.color, 10 + tier.index * 3, 14)
	end
	CameraController.run(function(t)
		local land = c.landing
		local mid = (land + c.den) / 2
		local side = (c.den - land)
		local perp = Vector3.new(-side.Z, 0, side.X).Unit
		-- crane shot: starts high above the fish, sweeps down and around toward the den
		local k = Easing.cubicInOut(math.clamp(t / 1.6, 0, 1))
		local orbit = CFrame.Angles(0, -0.5 + k * 0.5 + math.sin(t * 0.3) * 0.08, 0):VectorToWorldSpace(perp)
		local p = mid + orbit * (side.Magnitude * 0.55 + 14 + (1 - k) * 8) + Vector3.new(0, 9 + (1 - k) * 16, 0)
		local look = land:Lerp(c.den, 0.25 + k * 0.45) + Vector3.new(0, 1.5, 0)
		return CFrame.lookAt(p, look), 60 - 6 * k
	end, 60, { smooth = 5, blendIn = 0.6 })
end

local function alertShot()
	local c = current
	CameraController.run(function(t)
		local r = rootOf(c.bear)
		local h = headOf(c.bear)
		if not r or not h then return nil, 55 end
		local fwd = r.CFrame.LookVector
		local right = r.CFrame.RightVector
		-- "vertigo" dolly zoom: the camera backs off while the lens zooms in
		local k = Easing.cubicOut(math.clamp(t / 0.7, 0, 1))
		local d = 7 + k * 6
		local fov = 62 - k * 26
		local p = h.Position + fwd * d + right * 3.2 + Vector3.new(0, 1.1, 0)
		return CFrame.lookAt(p, h.Position), fov
	end, 60, { smooth = 9, blendIn = 0.35 })
	CameraController.punch(-5)
	local tier = rarityOf(c.bear)
	Cine.pop(headOf(c.bear), if tier.index >= 5 then "!!" else "!", if tier.index >= 5 then tier.color else Color3.fromRGB(255, 225, 50), 130, 1.1)
end

local function runShot()
	local c = current
	local stepT = 0
	local whip = false
	Cine.speedLines(true)
	CameraController.run(function(t, dt)
		local r = rootOf(c.bear)
		if not r then return nil, 60 end
		local fwd = r.CFrame.LookVector
		local right = r.CFrame.RightVector
		local sc = c.bear:GetAttribute("Scale") or 1
		stepT += dt
		if stepT > 0.26 / math.max(0.8, (c.bear:GetAttribute("Gait") or 1)) then
			stepT = 0
			Sound.play("Footstep", { at = r.Position, pitch = 0.8 / sc })
			Fx.dust(r.Position - Vector3.new(0, r.Position.Y - 0.2, 0), 0.45 * sc)
			CameraController.shake(0.25 * sc, 0.12) -- heavy paws hit the ground
		end
		if t < 1.0 then
			-- low ground shot in front: the bear charges straight at the lens
			local p = r.Position + fwd * (9 + t * 6) * sc + Vector3.new(0, -r.Position.Y + 1.2, 0) + right * 1.5
			return CFrame.lookAt(p, r.Position + Vector3.new(0, 0.6 * sc, 0)), 70
		end
		if not whip then
			whip = true
			CameraController.punch(6) -- whip pan to the tracking shot
		end
		-- side tracking shot with a little handheld sway
		local sway = Vector3.new(math.sin(t * 9) * 0.25, math.abs(math.sin(t * 9)) * 0.35, 0)
		local p = r.Position + right * (10 * sc) + Vector3.new(0, 3.5 * sc, 0) - fwd * 2.5 + sway
		return CFrame.lookAt(p, r.Position + fwd * 5), 66
	end, 60, { smooth = 7, blendIn = 0.3 })
end

local function eatSequence(d)
	local c = current
	local tl = d.tl
	local start = d.start
	local bitten, swallowed, happy, transformed = false, false, false, false
	local nextChew = 0
	local shocked = false
	Cine.speedLines(false)
	local tier = rarityOf(c.bear)
	CameraController.run(function()
		local now = workspace:GetServerTimeNow()
		local t = now - start
		local r = rootOf(c.bear)
		local h = headOf(c.bear)
		if not r or not h then return nil, 55 end
		local fwd = r.CFrame.LookVector
		local right = r.CFrame.RightVector
		local up = Vector3.new(0, 1, 0)
		local sc = c.bear:GetAttribute("Scale") or 1
		local mouth = h:FindFirstChild("MouthAtt") and (h:FindFirstChild("MouthAtt") :: Attachment).WorldPosition or h.Position
		if t < tl.eat then
			-- low side angle, slow dolly in over arrive + sniff
			local k = Easing.sineInOut(math.clamp(t / tl.eat, 0, 1))
			local p = mouth + right * (8 - 2.5 * k) * sc + up * (0.6 * sc) + fwd * (1.5 * sc)
			if t > tl.sniff and t < tl.sniff + 0.1 then Sound.play("Sniff", { at = mouth }) end
			return CFrame.lookAt(p, mouth + Vector3.new(0, -0.6, 0)), 52 - 6 * k
		elseif t < tl.happy then
			-- close 3/4 on the mouth: bite + chew
			local te = t - tl.eat
			if not bitten and te > GameConfig.Capture.pickupAt - 0.1 then
				bitten = true
				Sound.play("Chomp", { at = mouth, pitch = bearPitch(c.bear) })
				CameraController.shake(0.9, 0.25)
				CameraController.punch(-7)
				Cine.pop(h, "CHOMP!", Color3.fromRGB(255, 150, 40), 150, 0.9)
				nextChew = te + 0.35
			end
			if bitten and te >= nextChew and te < GameConfig.Capture.swallowAt + 0.3 then
				nextChew = te + 0.32
				Cine.pop(h, if math.random() < 0.5 then "NOM!" else "nom", Color3.fromRGB(255, 255, 255), 90, 0.7)
				Fx.blocks(mouth, Color3.fromRGB(255, 190, 170), 3, 6, 0.18, { life = 0.5, up = 1 })
				CameraController.punch(-1.5)
			end
			if not swallowed and te > GameConfig.Capture.swallowAt then
				swallowed = true
				Fx.blocks(mouth, Color3.fromRGB(255, 160, 140), 10, 8, 0.22, { life = 0.6, up = 1.2 })
				Sound.play("Chomp", { at = mouth, pitch = bearPitch(c.bear) * 1.2, volume = 0.6 })
			end
			local p = mouth + fwd * 5.5 * sc + right * 3 * sc + up * 1.4 * sc
			return CFrame.lookAt(p, mouth), 44
		elseif t < tl.transform then
			if not happy then
				happy = true
				Sound.play("Happy", { at = mouth, pitch = bearPitch(c.bear) })
				Cine.pop(h, "♥", Color3.fromRGB(255, 90, 130), 120, 1.2)
				Cine.hearts(h.Position + up * 1.5, 8)
			end
			local k = Easing.cubicOut(math.clamp((t - tl.happy) / (tl.transform - tl.happy), 0, 1))
			local p = r.Position + fwd * (9 + 6 * k) * sc + up * (3 + 4 * k) * sc + right * 2 * sc
			return CFrame.lookAt(p, r.Position + up * sc), 54
		else
			-- 360 orbit rising around the bear, flash at the end
			local k = math.clamp((t - tl.transform) / GameConfig.Capture.transform, 0, 1)
			if not transformed then
				transformed = true
				Sound.play("Transform")
			end
			local ang = Easing.cubicInOut(k) * math.pi * 2
			local radius = (13 - 4 * k) * sc
			local dir = CFrame.Angles(0, ang, 0):VectorToWorldSpace(fwd)
			local p = r.Position + dir * radius + up * (3 + 5 * k) * sc
			if k > 0.8 and not shocked then
				shocked = true
				Cine.shockwave(r.Position - Vector3.new(0, r.Position.Y - 0.3, 0), tier.textColor or tier.color, sc)
				if tier.index >= 4 then Cine.rarityTint(tier.textColor or tier.color, 0.6) end
			end
			if k > 0.85 and Capture.Flash then
				Capture.Flash(0.25)
			end
			return CFrame.lookAt(p, r.Position + up * sc), 56 + 12 * k
		end
	end, tl.total + 1.5, { smooth = 10, blendIn = 0.3 })
end

-- return HUD ----------------------------------------------------------------------
local function buildReturnHud()
	returnGui = Theme.new("ScreenGui", { Name = "ReturnHUD", ResetOnSpawn = false, IgnoreGuiInset = false, Enabled = false, DisplayOrder = 5 })
	local frame = Theme.block({
		Name = "Banner", Size = UDim2.fromOffset(360, 74), Position = UDim2.new(0.5, 0, 0, 58), AnchorPoint = Vector2.new(0.5, 0),
		Gradient = Theme.G.orange, Corner = 10, StrokeWidth = 3, Studs = 14, Parent = returnGui,
	})
	Theme.new("UIScale", { Name = "RootScale", Parent = returnGui })
	Theme.text({ Text = "RUN BACK TO YOUR BASE!", Size = UDim2.new(1, -16, 0, 26), Position = UDim2.fromOffset(8, 4), Max = 26, Stroke = 3, Parent = frame, Font = Theme.FontBold })
	returnName = Theme.text({ Text = "", Size = UDim2.new(1, -16, 0, 16), Position = UDim2.fromOffset(8, 30), Max = 16, Parent = frame, RichText = true })
	local bar = Theme.block({ Name = "Bar", Size = UDim2.new(1, -20, 0, 16), Position = UDim2.fromOffset(10, 50), Color = Color3.fromRGB(30, 30, 34), Corner = 8, StrokeWidth = 2, Parent = frame })
	returnFill = Theme.block({ Name = "Fill", Size = UDim2.fromScale(0, 1), Gradient = Theme.G.green, Corner = 8, StrokeWidth = 0, Parent = bar })
	returnText = Theme.text({ Text = "", Size = UDim2.fromScale(1, 1), Max = 13, Parent = bar, ZIndex = 3 })
	returnTimer = Theme.text({ Text = "", Size = UDim2.fromOffset(120, 22), Position = UDim2.new(0.5, 0, 1, 4), AnchorPoint = Vector2.new(0.5, 0), Max = 18, Parent = frame })
	returnGui.Parent = player:WaitForChild("PlayerGui")
	local function rescale()
		local vp = workspace.CurrentCamera.ViewportSize
		returnGui.RootScale.Scale = math.clamp(math.min(vp.X / 900, vp.Y / 420), 0.75, 1.6)
	end
	workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(rescale)
	rescale()
end

local function buildArrow()
	local m = Instance.new("Model")
	m.Name = "BaseArrow"
	local function part(size, cf, wedge)
		local p = Instance.new(if wedge then "WedgePart" else "Part")
		p.Size = size
		p.CFrame = cf
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.CastShadow = false
		p.Color = Color3.fromRGB(110, 255, 90)
		p.Material = Enum.Material.Neon
		p.Parent = m
		return p
	end
	local shaft = part(Vector3.new(0.9, 0.5, 2.6), CFrame.new(0, 0, 1.3))
	part(Vector3.new(0.5, 1.2, 1.2), CFrame.new(0.6, 0, -0.6) * CFrame.Angles(0, 0, math.pi / 2) * CFrame.Angles(math.pi, 0, 0), true)
	part(Vector3.new(0.5, 1.2, 1.2), CFrame.new(-0.6, 0, -0.6) * CFrame.Angles(0, 0, -math.pi / 2) * CFrame.Angles(math.pi, 0, 0), true)
	m.PrimaryPart = shaft
	m.WorldPivot = CFrame.new()
	return m
end

local function startControlling(d)
	controlling = d
	current = nil
	CameraController.resetOffset()
	CameraController.stop()
	workspace.CurrentCamera.CameraSubject = d.bear:FindFirstChildOfClass("Humanoid")
	if not returnGui then buildReturnHud() end
	local tier = RarityConfig.get(d.outcome.r)
	local name = BearConfig.get(d.outcome.s).name
	local variant = if d.outcome.v ~= "Normal" then d.outcome.v .. " " else ""
	local hex = (if tier.textColor then tier.textColor else tier.color):ToHex()
	returnName.Text = ('<font color="#%s">%s</font> %s%s · %s · %s'):format(hex, tier.name, variant, name, Format.kg(d.outcome.w), Format.perSec(d.income))
	returnGui.Enabled = true
	d.started = os.clock()
	arrow = buildArrow()
	arrow.Parent = Fx.folder
	if Capture.Flash then Capture.Flash(0.5) end
	local r = rootOf(d.bear)
	if r then
		Fx.burst(r.Position - Vector3.new(0, (d.bear:GetAttribute("HipHeight") or 1.6), 0), tier.color, (d.bear:GetAttribute("Scale") or 1))
		Fx.puff(r.Position, Color3.new(1, 1, 1), 18, 4)
	end
	if Capture.Reveal then Capture.Reveal.bearToast(d.outcome, d.income) end
	Sound.play("Growl", { pitch = bearPitch(d.bear) })
end

local function stopControlling()
	controlling = nil
	sprinting = false
	if returnGui then returnGui.Enabled = false end
	if arrow then arrow:Destroy() arrow = nil end
end

local function onFx(phase: string, d)
	if phase == "Spawned" then
		current = { bear = d.bear, fish = d.fish, landing = d.landing, den = d.den }
		Cine.letterbox(true)
		establishing()
	elseif phase == "Alert" and current then
		alertShot()
		Sound.play("Growl", { at = rootOf(current.bear) and rootOf(current.bear).Position, pitch = bearPitch(current.bear) })
	elseif phase == "Run" and current then
		runShot()
	elseif phase == "Eat" and current then
		eatSequence(d)
	elseif phase == "Controlling" then
		startControlling(d)
	elseif phase == "Arrived" then
		local r = controlling and rootOf(controlling.bear)
		if r then
			Fx.blocks(r.Position + Vector3.new(0, 4, 0), Color3.new(1, 1, 1), 40, 26, 0.45, {
				colors = { Color3.fromRGB(255, 80, 80), Color3.fromRGB(255, 220, 60), Color3.fromRGB(80, 200, 255), Color3.fromRGB(120, 255, 120), Color3.fromRGB(255, 120, 230) },
				life = 1.6, up = 2.5, gravity = 40,
			})
		end
		Sound.play("Arrive")
		stopControlling()
	elseif phase == "Captured" then
		-- poof where the bear was, then it pops into your arms
		current = nil
		Cine.letterbox(false)
		if d.from then
			Fx.puff(d.from + Vector3.new(0, 3, 0), Color3.new(1, 1, 1), 22, 5)
			Fx.sparkle(d.from + Vector3.new(0, 3, 0), Color3.fromRGB(255, 230, 120), 18, 20)
		end
		CameraController.stop()
		if Capture.Flash then Capture.Flash(0.35) end
		task.delay(0.35, function()
			local char = player.Character
			local root = char and char:FindFirstChild("HumanoidRootPart")
			if root then
				Fx.burst(root.Position - Vector3.new(0, 2.8, 0), Color3.fromRGB(255, 220, 90), 0.7)
				Fx.blocks(root.Position + Vector3.new(0, 6, 0), Color3.new(1, 1, 1), 30, 22, 0.4, {
					colors = { Color3.fromRGB(255, 80, 80), Color3.fromRGB(255, 220, 60), Color3.fromRGB(80, 200, 255), Color3.fromRGB(120, 255, 120) },
					life = 1.4, up = 2.5, gravity = 40,
				})
			end
			Sound.play("Happy", { pitch = 1.1 })
			Sound.play("Arrive")
			if Capture.Reveal then Capture.Reveal.bear(d.bear, d.income, d.isNew) end
		end)
	elseif phase == "Failed" then
		current = nil
		Cine.letterbox(false)
		stopControlling()
		CameraController.stop()
	end
end

-- per frame: return HUD, arrow, sprint, placement ghost
local stepAcc = 0
local function step(dt: number)
	if controlling then
		local bear = controlling.bear
		local r = rootOf(bear)
		local base = player:GetAttribute("Base")
		if r and base then
			local c = Layout.BASE_CENTERS[base]
			local target = Vector3.new(c.X, 0, c.Z - Layout.BASE_HALF + 4)
			local total = controlling.total or (Vector3.new(r.Position.X, 0, r.Position.Z) - target).Magnitude
			controlling.total = total
			local dist = (Vector3.new(r.Position.X, 0, r.Position.Z) - target).Magnitude
			local prog = math.clamp(1 - dist / math.max(total, 1), 0, 1)
			returnFill.Size = UDim2.fromScale(prog, 1)
			returnText.Text = ("%d studs to go"):format(math.floor(dist))
			local left = (controlling.timeout or 300) - (os.clock() - controlling.started)
			returnTimer.Text = "⏱ " .. Format.time(left)
			returnTimer.TextColor3 = if left < 30 then Color3.fromRGB(255, 80, 80) else Color3.new(1, 1, 1)
			-- arrow floating above the bear, pointing home (route via the corridor)
			local aim = target
			if Layout.zoneAt(r.Position) then
				aim = Vector3.new(0, 0, Layout.CORRIDOR_START_Z + 20)
			end
			local hh = (bear:GetAttribute("HipHeight") or 1.6) + 4 * (bear:GetAttribute("Scale") or 1)
			local ap = r.Position + Vector3.new(0, hh + math.sin(os.clock() * 4) * 0.3, 0)
			local flat = Vector3.new(aim.X - ap.X, 0, aim.Z - ap.Z)
			if flat.Magnitude > 0.1 and arrow then
				arrow:PivotTo(CFrame.lookAt(ap, ap + flat.Unit))
			end
			-- sprint
			local hum = bear:FindFirstChildOfClass("Humanoid")
			if hum then
				local baseSpeed = bear:GetAttribute("BaseSpeed") or 28
				local want = if sprinting then baseSpeed * GameConfig.Capture.sprintMultiplier else baseSpeed
				if hum.WalkSpeed > 0.5 then hum.WalkSpeed = want end
				stepAcc += dt
				local moving = hum.MoveDirection.Magnitude > 0.1
				local interval = if sprinting then 0.22 else 0.32
				if moving and stepAcc > interval then
					stepAcc = 0
					Sound.play("Footstep", { at = r.Position, pitch = 0.75 / (bear:GetAttribute("Scale") or 1) })
					if sprinting then Fx.dust(Vector3.new(r.Position.X, 0.2, r.Position.Z) - r.CFrame.LookVector * 2, 0.5) end
				end
			end
		end
	end
	-- placement ghost
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	local base = player:GetAttribute("Base")
	if Data.state == "CarryingCapturedBear" and root and base and Layout.isInBase(base, root.Position, 6) then
		if not ghost then
			ghost = Instance.new("Part")
			ghost.Shape = Enum.PartType.Cylinder
			ghost.Anchored = true
			ghost.CanCollide = false
			ghost.CanQuery = false
			ghost.Material = Enum.Material.Neon
			ghost.Transparency = 0.45
			ghost.Size = Vector3.new(0.15, 5, 5)
			ghost.Parent = Fx.folder
		end
		local p = Capture.placePosition()
		local ok = Layout.isInBase(base, p, 6)
		for _, m in workspace:WaitForChild("Bears"):GetChildren() do
			if m:GetAttribute("Owner") == player.UserId and m.PrimaryPart then
				local q = m.PrimaryPart.Position
				if Vector3.new(q.X - p.X, 0, q.Z - p.Z).Magnitude < GameConfig.Base.minBearSpacing then ok = false end
			end
		end
		ghost.Color = if ok then Color3.fromRGB(110, 255, 110) else Color3.fromRGB(255, 80, 80)
		local pulse = 1 + math.sin(os.clock() * 5) * 0.08
		ghost.Size = Vector3.new(0.15, 5 * pulse, 5 * pulse)
		ghost.CFrame = CFrame.new(p + Vector3.new(0, 0.15, 0)) * CFrame.Angles(0, 0, math.pi / 2)
	elseif ghost then
		ghost:Destroy()
		ghost = nil
	end
end

-- ground point under a screen position (map only)
local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Include
local function groundAt(screen: Vector2): Vector3?
	local map = workspace:FindFirstChild("Map")
	if not map then return nil end
	rayParams.FilterDescendantsInstances = { map }
	local ray = workspace.CurrentCamera:ViewportPointToRay(screen.X, screen.Y)
	local hit = workspace:Raycast(ray.Origin, ray.Direction * 600, rayParams)
	return hit and Vector3.new(hit.Position.X, 0, hit.Position.Z) or nil
end

-- where PLACE puts the bear: under the mouse on PC (ghost follows the cursor), else in front of you
function Capture.placePosition(): Vector3
	local base = player:GetAttribute("Base")
	if base and UserInputService.MouseEnabled then
		local p = groundAt(UserInputService:GetMouseLocation())
		if p and Layout.isInBase(base, p, 6) then return p end
	end
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then return Vector3.zero end
	local p = root.Position + root.CFrame.LookVector * 6
	return Vector3.new(p.X, 0, p.Z)
end

function Capture.init()
	Net.event("CaptureFx").OnClientEvent:Connect(onFx)
	RunService.RenderStepped:Connect(function(dt)
		step(math.min(dt, 0.1))
	end)
	Actions.on("Sprint", function()
		sprinting = true
		CameraController.punch(6)
	end, function()
		sprinting = false
	end)
	Actions.on("Place", function()
		Net.event("PlaceBear"):FireServer(Capture.placePosition())
	end)
	-- click / tap anywhere in your base to place the carried bear there
	UserInputService.InputBegan:Connect(function(input, gameProcessed)
		if gameProcessed or Data.state ~= "CarryingCapturedBear" then return end
		if input.UserInputType ~= Enum.UserInputType.MouseButton1 and input.UserInputType ~= Enum.UserInputType.Touch then return end
		local base = player:GetAttribute("Base")
		local screen = if input.UserInputType == Enum.UserInputType.Touch then Vector2.new(input.Position.X, input.Position.Y + game:GetService("GuiService"):GetGuiInset().Y) else UserInputService:GetMouseLocation()
		local p = groundAt(screen)
		if base and p and Layout.isInBase(base, p, 6) then
			Fx.ring(p + Vector3.new(0, 0.2, 0), Color3.fromRGB(120, 255, 120), 0.5, 4, 0.4, { neon = true, transparency = 0.2 })
			Net.event("PlaceBear"):FireServer(p)
		end
	end)
	player.CharacterAdded:Connect(function(char)
		if not char:GetAttribute("IsBear") then
			workspace.CurrentCamera.CameraSubject = char:WaitForChild("Humanoid", 5)
		end
	end)
end

return Capture
