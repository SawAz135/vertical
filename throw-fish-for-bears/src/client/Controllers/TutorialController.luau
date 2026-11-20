--[[ TutorialController: the first-minutes guide, 100% stud style.
     - Bubble (stud GUI): Baby Bear mascot in 3D, typewriter text, "TUTORIAL" tab,
       skip button. Steps follow each other in order, no step counter is shown.
     - World guide: a voxel stud arrow (black outline) bobbing over the target, a
       spinning ring of stud tiles on the ground and a path of stud tiles from the
       player to the target (PathfindingService, refreshed), wave travelling forward.
     - Screen guide: a stud arrow over the hotbar slot to tap, and an arrow on the
       screen edge (with distance) when the target is off screen.
     Steps check the real game state every frame, can go back (e.g. the line snapped)
     and the furthest step is saved by the server (TutorialStep remote). ]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local PathfindingService = game:GetService("PathfindingService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local Layout = require(Shared.Layout)
local E = require(Shared.Config.EconomyConfig)
local Data = require(script.Parent.Data)
local Sound = require(script.Parent.Sound)

local Tutorial = {}
local player = Players.LocalPlayer
local RGB = Color3.fromRGB
local YELLOW = RGB(255, 214, 40)
local DONE = E.TutorialDone

local Sim, HUD, Menus
local ui: any = {}
local world: any = {}
local current = 0 -- active step index (0 = not running)
local saved = 0
local entered = {} -- snapshot taken when a step starts

local function tween(o, t, goal, style, dir)
	local tw = TweenService:Create(o, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), goal)
	tw:Play()
	return tw
end

------------------------------------------------------------------------------------------
-- game state helpers
------------------------------------------------------------------------------------------
local function root(): BasePart?
	local c = player.Character
	return c and c:FindFirstChild("HumanoidRootPart") :: BasePart?
end
local function holding(): string
	local c = player.Character
	return c and c:GetAttribute("Holding") or ""
end
local function base(): number?
	return player:GetAttribute("Base")
end
local function fishCount(): number
	return #(Data.values.fish or {})
end
local function bearCounts(): (number, number)
	local all, placed = 0, 0
	for _, b in Data.values.bears or {} do
		all += 1
		if b.placed then placed += 1 end
	end
	return all, placed
end
local function state(): string
	return Data.state or ""
end
local AFTER_THROW = { Throwing = true, WaitingForBear = true, WatchingEatingCinematic = true, ControllingBear = true, ReturningToBase = true, CarryingCapturedBear = true }

------------------------------------------------------------------------------------------
-- steps: text, target (world Vector3 or "slot1"/"slot2"), done(), back() -> step
------------------------------------------------------------------------------------------
local STEPS
STEPS = {
	{ -- 1
		icon = "🎣", text = 'Tap slot <font color="#FFD23F">1</font> to grab your <font color="#FFD23F">fishing rod</font>!',
		ui = 1,
		done = function() return holding() == "Rod" end,
	},
	{ -- 2
		icon = "🚶", text = 'Walk to the end of <font color="#7CFF46">YOUR dock</font>, behind your base!',
		target = function() local b = base() return b and Layout.dockEnd(b) end,
		done = function() local r, b = root(), base() return r ~= nil and b ~= nil and holding() == "Rod" and Layout.isAtFishingSpot(b, r.Position) end,
		back = function() if holding() ~= "Rod" then return 1 end return nil end,
	},
	{ -- 3
		icon = "💧", text = '<font color="#3CB4FF">Tap the lake</font> to cast your line!',
		target = function() local b = base() return b and Layout.dockEnd(b) + Vector3.new(0, -1, 15) end,
		done = function() local s = state() return s == "Fishing" or s == "Bite" or s == "Reeling" end,
		back = function()
			local r, b = root(), base()
			if holding() ~= "Rod" then return 1 end
			if r and b and not Layout.isAtFishingSpot(b, r.Position) then return 2 end
			return nil
		end,
	},
	{ -- 4
		icon = "🌀", text = 'Wait for a bite... then <font color="#FFD23F">HOLD the screen</font> to reel! Let go when it turns <font color="#FF5050">red</font>!',
		enter = function() entered.fish = fishCount() end,
		done = function() return fishCount() > (entered.fish or 0) end,
		back = function()
			local s = state()
			if s == "Idle" and holding() == "Rod" then return 3 end
			if s == "Idle" then return 1 end
			return nil
		end,
	},
	{ -- 5
		icon = "🐟", text = 'Nice catch! Tap slot <font color="#FFD23F">2</font> to <font color="#FFD23F">hold your fish</font>!',
		ui = 2,
		done = function() return holding() == "Fish" end,
		back = function() if fishCount() == 0 then return 1 end return nil end,
	},
	{ -- 6
		icon = "🎯", text = 'Carry it to the <font color="#FF6E50">THROW ZONE</font> in front of the forest!',
		target = function() local a = Layout.THROW_AREA return Vector3.new(0, 0, (a.minZ + a.maxZ) / 2) end,
		done = function() local r = root() return r ~= nil and holding() == "Fish" and Layout.isInThrowArea(r.Position) end,
		back = function() if holding() ~= "Fish" then return if fishCount() > 0 then 5 else 1 end return nil end,
	},
	{ -- 7
		icon = "💪", text = '<font color="#FFD23F">HOLD the screen</font> to charge... <font color="#FF5050">release</font> to THROW it into the forest!',
		done = function() return AFTER_THROW[state()] == true end,
		back = function()
			local r = root()
			if state() == "Idle" and (holding() ~= "Fish" or (r and not Layout.isInThrowArea(r.Position))) then return 6 end
			return nil
		end,
	},
	{ -- 8
		icon = "🐻", text = 'A bear smells your fish... <font color="#7CFF46">watch it come!</font>',
		enter = function() entered.bears = bearCounts() end,
		done = function() return state() == "CarryingCapturedBear" or (bearCounts()) > (entered.bears or 0) end,
		back = function()
			if state() == "Idle" and (bearCounts()) <= (entered.bears or 0) then
				return if holding() == "Fish" then 6 elseif fishCount() > 0 then 5 else 1
			end
			return nil
		end,
	},
	{ -- 9
		icon = "🏠", text = 'It\'s yours! Go home and <font color="#7CFF46">tap inside your base</font> to place it!',
		target = function() local b = base() return b and Layout.BASE_CENTERS[b] end,
		enter = function() local _, placed = bearCounts() entered.placed = placed end,
		done = function() local _, placed = bearCounts() return placed > (entered.placed or 0) or (placed > 0 and state() == "Idle" and holding() ~= "Bear") end,
		back = function()
			local all = bearCounts()
			if all == 0 and state() == "Idle" then return 1 end
			return nil
		end,
	},
	{ -- 10
		icon = "🏋", text = 'Your bear makes <font color="#7CFF46">$ every second</font>! Now stand on your <font color="#FFD23F">FISH-UP</font> to get stronger!',
		target = function() local b = base() return b and Layout.trainPos(b) end,
		enter = function() entered.strength = Data.values.strength or 0 end,
		done = function() return (Data.values.strength or 0) > (entered.strength or 0) end,
	},
}
local FINAL = #STEPS + 1

------------------------------------------------------------------------------------------
-- stud GUI: bubble, slot pointer, edge arrow
------------------------------------------------------------------------------------------
local function studArrowGui(parent, z: number)
	-- voxel arrow pointing down: shaft + 3 stepped rows, yellow, black outline, studs
	local a = Sim.new("Frame", { Name = "StudArrow", BackgroundTransparency = 1, Size = UDim2.fromOffset(60, 70), AnchorPoint = Vector2.new(0.5, 1), ZIndex = z }, parent)
	local function block(x, y, w, h)
		local f = Sim.new("Frame", { BackgroundColor3 = YELLOW, BorderSizePixel = 0, Size = UDim2.fromOffset(w, h), Position = UDim2.fromOffset(x, y), ZIndex = z }, a)
		Sim.stroke(f, 3)
		Sim.studs(f, { tile = 18, z = z, strong = true })
		return f
	end
	block(20, 0, 20, 28)
	block(4, 28, 52, 14)
	block(14, 42, 32, 14)
	block(24, 56, 12, 12)
	return a
end

local function buildUI(gui: ScreenGui)
	local r = Sim.root(gui, "Tutorial", Vector2.new(600, 150), UDim2.new(0.5, 0, 0, 112), Vector2.new(0.5, 0))
	r.Visible = false
	ui.root = r
	-- inner frame carries the pop scale (the root already has its WindowScale)
	local inner = Sim.new("Frame", { Name = "Inner", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1) }, r)
	ui.pop = Sim.new("UIScale", { Name = "Pop", Scale = 1 }, inner)
	local panel = Sim.panel(inner, { Size = UDim2.fromOffset(580, 108), Position = UDim2.fromOffset(10, 26), Gradient = Sim.G.blue, Stroke = 4, ZIndex = 3 })
	Sim.bands(panel, 0.6, 4)
	panel.ClipsDescendants = true
	ui.panel = panel
	-- tab
	local tab = Sim.panel(inner, { Size = UDim2.fromOffset(220, 36), Position = UDim2.fromOffset(28, 6), Gradient = Sim.G.orange, ZIndex = 6 })
	ui.tab = Sim.text(tab, "TUTORIAL", { Size = UDim2.new(1, -14, 0.8, 0), Max = 22, ZIndex = 7 })
	-- mascot (3D Baby Bear) in a dark studded box
	local box = Sim.panel(panel, { Size = UDim2.fromOffset(88, 88), Position = UDim2.fromOffset(10, 10), Color = RGB(36, 60, 110), DarkStuds = true, ZIndex = 5 })
	Sim.model(box, { kind = "Bear", id = "BabyBear", size = UDim2.fromScale(1.15, 1.15), yaw = math.rad(-28), pitch = math.rad(8) })
	ui.mascot = box
	ui.icon = Sim.text(panel, "", { Size = UDim2.fromOffset(34, 34), Position = UDim2.fromOffset(92, 84), Max = 28, Stroke = 0, ZIndex = 8 })
	-- text
	ui.text = Sim.text(panel, "", { Size = UDim2.fromOffset(440, 80), Position = UDim2.fromOffset(330, 54), Max = 28, Rich = true, Wrap = true, ZIndex = 7,
		AlignX = Enum.TextXAlignment.Left })
	-- skip
	Sim.button(inner, { Name = "Skip", Grad = "red", Size = Vector2.new(40, 40), Position = UDim2.fromOffset(584, 30), Text = "X", Max = 24, ZIndex = 9 }, function()
		Menus.confirm("Skip the tutorial?", function()
			Tutorial.finish(true)
		end)
	end)

	-- hotbar slot pointer
	ui.slotArrow = studArrowGui(gui, 40)
	ui.slotArrow.Visible = false
	ui.slotRing = Sim.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(100, 100), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 39, Visible = false }, gui)
	Sim.corner(ui.slotRing, 8)
	ui.slotRingStroke = Sim.stroke(ui.slotRing, 5, YELLOW)

	-- edge arrow (own full-screen gui so viewport coordinates match)
	local edgeGui = Sim.new("ScreenGui", { Name = "TFBTutorialEdge", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 3, ScreenInsets = Enum.ScreenInsets.None }, player:WaitForChild("PlayerGui"))
	local edge = Sim.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(70, 70), AnchorPoint = Vector2.new(0.5, 0.5), Visible = false }, edgeGui)
	local arrow = studArrowGui(edge, 5)
	arrow.AnchorPoint = Vector2.new(0.5, 0.5)
	arrow.Position = UDim2.fromScale(0.5, 0.5)
	ui.edge = edge
	ui.edgeArrow = arrow
	ui.edgeDist = Sim.text(edgeGui, "", { Size = UDim2.fromOffset(110, 26), Max = 22, ZIndex = 6 })
	ui.edgeDist.Visible = false
	ui.edgeGui = edgeGui
end

------------------------------------------------------------------------------------------
-- world guide (local parts)
------------------------------------------------------------------------------------------
local function part(parent, size, color, shape)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Size = size
	p.Color = color
	p.Material = Enum.Material.Plastic
	p.TopSurface = Enum.SurfaceType.Studs
	p.BottomSurface = Enum.SurfaceType.Inlet
	if shape then p.Shape = shape end
	p.Parent = parent
	return p
end

local PATH_TILES = 34
local function buildWorld()
	local folder = Instance.new("Folder")
	folder.Name = "TFBTutorialGuide"
	folder.Parent = workspace
	world.folder = folder
	-- voxel arrow (stud blocks) with a black cartoon outline
	local arrow = Instance.new("Model")
	arrow.Name = "Arrow"
	arrow.Parent = folder
	world.arrowParts = {
		{ part(arrow, Vector3.new(1.2, 2.6, 1.2), YELLOW), Vector3.new(0, 2.6, 0) },
		{ part(arrow, Vector3.new(3.6, 0.8, 1.2), YELLOW), Vector3.new(0, 0.9, 0) },
		{ part(arrow, Vector3.new(2.4, 0.8, 1.2), YELLOW), Vector3.new(0, 0.1, 0) },
		{ part(arrow, Vector3.new(1.2, 0.8, 1.2), YELLOW), Vector3.new(0, -0.7, 0) },
	}
	local hl = Instance.new("Highlight")
	hl.FillTransparency = 1
	hl.OutlineColor = Color3.new(0, 0, 0)
	hl.OutlineTransparency = 0
	hl.DepthMode = Enum.HighlightDepthMode.Occluded
	hl.Adornee = arrow
	hl.Parent = arrow
	world.arrow = arrow
	-- spinning ring of stud tiles on the ground
	world.ring = {}
	for i = 1, 10 do
		world.ring[i] = part(folder, Vector3.new(1.3, 0.35, 1.3), if i % 2 == 0 then YELLOW else RGB(255, 255, 255))
	end
	-- path tiles (pooled)
	world.tiles = {}
	for i = 1, PATH_TILES do
		local t = part(folder, Vector3.new(1.1, 0.25, 1.1), YELLOW)
		t.Transparency = 1
		world.tiles[i] = t
	end
	world.points = {}
	world.lastPath = 0
	world.pathTarget = nil
end

local function setWorldVisible(on: boolean)
	if not world.folder then return end
	for _, ap in world.arrowParts do ap[1].Transparency = if on then 0 else 1 end
	world.arrow:FindFirstChildOfClass("Highlight").Enabled = on
	for _, p in world.ring do p.Transparency = if on then 0 else 1 end
	if not on then
		for _, t in world.tiles do t.Transparency = 1 end
	end
end

-- path from the player to the target (pathfinding, straight line fallback)
local computing = false
local function refreshPath(from: Vector3, to: Vector3)
	if computing then return end
	computing = true
	task.spawn(function()
		local pts = {}
		local ok = pcall(function()
			local path = PathfindingService:CreatePath({ AgentRadius = 2, AgentHeight = 5, AgentCanJump = true, WaypointSpacing = 3.5 })
			path:ComputeAsync(from, to)
			if path.Status == Enum.PathStatus.Success then
				for _, wp in path:GetWaypoints() do table.insert(pts, wp.Position) end
			end
		end)
		if not ok or #pts < 2 then
			pts = {}
			local d = (to - from)
			local n = math.max(2, math.floor(d.Magnitude / 3.5))
			for i = 0, n do table.insert(pts, from:Lerp(to, i / n)) end
		end
		world.points = pts
		computing = false
	end)
end

------------------------------------------------------------------------------------------
-- step flow
------------------------------------------------------------------------------------------
local typeToken = 0
local function setText(text: string, icon: string)
	typeToken += 1
	local my = typeToken
	ui.text.Text = text
	ui.icon.Text = icon
	ui.text.MaxVisibleGraphemes = 0
	task.spawn(function()
		local n = utf8.len((ui.text.ContentText or text)) or #text
		for i = 1, n do
			if my ~= typeToken then return end
			ui.text.MaxVisibleGraphemes = i
			if i % 3 == 0 then task.wait(1 / 60) end
		end
		ui.text.MaxVisibleGraphemes = -1
	end)
end

local function goTo(step: number, celebrate: boolean?)
	current = step
	local st = STEPS[step]
	if not st then return end
	if st.enter then st.enter() end
	setText(st.text, st.icon)
	-- pop the bubble
	ui.pop.Scale = 0.85
	tween(ui.pop, 0.35, { Scale = 1 }, Enum.EasingStyle.Back)
	local m = ui.mascot
	m.Rotation = -8
	tween(m, 0.6, { Rotation = 0 }, Enum.EasingStyle.Elastic)
	if celebrate then
		Sound.play("Reward")
		if HUD and HUD.popup then HUD.popup("NICE!", RGB(110, 240, 60)) end
	end
	world.pathTarget = nil
	world.points = {}
	if step > saved and step <= #STEPS then
		saved = step
		Net.event("TutorialStep"):FireServer(step)
	end
end

function Tutorial.finish(skipped: boolean?)
	if current == 0 then return end
	current = 0
	ui.slotArrow.Visible = false
	ui.slotRing.Visible = false
	ui.edge.Visible = false
	ui.edgeDist.Visible = false
	setWorldVisible(false)
	saved = DONE
	Net.event("TutorialStep"):FireServer(DONE)
	if skipped then
		tween(ui.pop, 0.25, { Scale = 0 }, Enum.EasingStyle.Back, Enum.EasingDirection.In).Completed:Connect(function() ui.root.Visible = false end)
		return
	end
	-- final message, then the bubble leaves
	ui.tab.Text = "GOOD JOB!"
	setText('You\'re ready! Catch <font color="#FF6EC8">rarer fish</font>, throw <font color="#FFD23F">farther</font> and collect <font color="#7CFF46">every bear</font>!', "🏆")
	Sound.play("Arrive")
	if HUD and HUD.popup then HUD.popup("TUTORIAL DONE!", RGB(255, 210, 60)) end
	task.delay(6, function()
		tween(ui.pop, 0.3, { Scale = 0 }, Enum.EasingStyle.Back, Enum.EasingDirection.In).Completed:Connect(function() ui.root.Visible = false end)
	end)
end

local function start(fromStep: number)
	ui.root.Visible = true
	ui.pop.Scale = 0
	goTo(math.clamp(fromStep, 1, #STEPS), false)
end

------------------------------------------------------------------------------------------
-- per-frame guide update
------------------------------------------------------------------------------------------
local function update(dt: number)
	if current == 0 then return end
	local st = STEPS[current]
	if not st then return end
	-- progress / regress
	if st.done() then
		if current + 1 >= FINAL then
			Tutorial.finish(false)
		else
			goTo(current + 1, true)
		end
		return
	end
	if st.back then
		local b = st.back()
		if b and b ~= current then
			goTo(b, false)
			return
		end
	end
	local t = os.clock()
	-- hotbar slot pointer
	local slotBtn = st.ui and HUD and HUD.slotButton and HUD.slotButton(st.ui)
	if slotBtn and slotBtn.Visible and slotBtn.AbsoluteSize.X > 0 then
		local gui = ui.slotArrow.Parent :: ScreenGui
		local p = slotBtn.AbsolutePosition - gui.AbsolutePosition
		local sz = slotBtn.AbsoluteSize
		ui.slotArrow.Visible = true
		ui.slotArrow.Position = UDim2.fromOffset(p.X + sz.X / 2, p.Y - 6 - math.abs(math.sin(t * 4)) * 14)
		ui.slotRing.Visible = true
		ui.slotRing.Size = UDim2.fromOffset(sz.X + 10 + math.sin(t * 6) * 4, sz.Y + 10 + math.sin(t * 6) * 4)
		ui.slotRing.Position = UDim2.fromOffset(p.X + sz.X / 2, p.Y + sz.Y / 2)
		ui.slotRingStroke.Transparency = 0.2 + math.abs(math.sin(t * 3)) * 0.5
	else
		ui.slotArrow.Visible = false
		ui.slotRing.Visible = false
	end
	-- world target
	local target = st.target and st.target()
	local r = root()
	if not target or not r then
		setWorldVisible(false)
		ui.edge.Visible = false
		ui.edgeDist.Visible = false
		return
	end
	setWorldVisible(true)
	-- arrow bob + spin
	local bob = math.sin(t * 3) * 0.8
	local cf = CFrame.new(target + Vector3.new(0, 8 + bob, 0)) * CFrame.Angles(0, t * 1.6, 0)
	for _, ap in world.arrowParts do ap[1].CFrame = cf * CFrame.new(ap[2]) end
	-- ground ring
	local n = #world.ring
	local rad = 3.4 + math.sin(t * 4) * 0.25
	for i, p in world.ring do
		local a = t * 1.2 + i * math.pi * 2 / n
		p.CFrame = CFrame.new(target + Vector3.new(math.cos(a) * rad, 0.35 + math.max(0, math.sin(t * 5 + i)) * 0.25, math.sin(a) * rad)) * CFrame.Angles(0, -a, 0)
	end
	-- path tiles
	local dist = (Vector3.new(target.X, 0, target.Z) - Vector3.new(r.Position.X, 0, r.Position.Z)).Magnitude
	world.lastPath += dt
	if world.lastPath > 1.2 or world.pathTarget ~= target then
		world.lastPath = 0
		world.pathTarget = target
		refreshPath(r.Position - Vector3.new(0, 2.5, 0), target)
	end
	local pts = world.points
	for i, tile in world.tiles do
		local p = pts[i + 1]
		if p and dist > 6 and (Vector3.new(p.X, 0, p.Z) - Vector3.new(target.X, 0, target.Z)).Magnitude > 3.5 then
			local wave = math.sin(t * 7 - i * 0.7)
			tile.Transparency = 0
			tile.Color = YELLOW:Lerp(Color3.new(1, 1, 1), math.max(0, wave) * 0.8)
			local nextP = pts[i + 2] or target
			local dir = Vector3.new(nextP.X - p.X, 0, nextP.Z - p.Z)
			local look = if dir.Magnitude > 0.05 then CFrame.lookAt(Vector3.zero, dir.Unit) else CFrame.new()
			tile.CFrame = CFrame.new(Vector3.new(p.X, p.Y + 0.15 + math.max(0, wave) * 0.35, p.Z)) * look.Rotation
		else
			tile.Transparency = 1
		end
	end
	-- off-screen edge arrow
	local cam = workspace.CurrentCamera
	local vp = cam.ViewportSize
	local sp, onScreen = cam:WorldToViewportPoint(target + Vector3.new(0, 4, 0))
	local inside = onScreen and sp.X > 40 and sp.X < vp.X - 40 and sp.Y > 40 and sp.Y < vp.Y - 40
	if inside or dist < 8 then
		ui.edge.Visible = false
		ui.edgeDist.Visible = false
	else
		local c = Vector2.new(vp.X / 2, vp.Y / 2)
		local v = Vector2.new(sp.X, sp.Y) - c
		if sp.Z < 0 then v = -v end
		if v.Magnitude < 1 then v = Vector2.new(0, 1) end
		local u = v.Unit
		local m = math.min((vp.X / 2 - 70) / math.max(math.abs(u.X), 1e-3), (vp.Y / 2 - 70) / math.max(math.abs(u.Y), 1e-3))
		local pos = c + u * m
		ui.edge.Visible = true
		ui.edge.Position = UDim2.fromOffset(pos.X, pos.Y)
		-- arrow art points down (+Y) -> rotate toward u
		ui.edgeArrow.Rotation = math.deg(math.atan2(u.Y, u.X)) - 90
		ui.edge.Size = UDim2.fromOffset(70 + math.sin(t * 6) * 6, 70 + math.sin(t * 6) * 6)
		ui.edgeDist.Visible = true
		ui.edgeDist.Position = UDim2.fromOffset(pos.X - u.X * 56, pos.Y - u.Y * 56)
		ui.edgeDist.Text = ("%d studs"):format(math.floor(dist))
	end
end

------------------------------------------------------------------------------------------
function Tutorial.init(hudGui: ScreenGui, simModule, hudModule, menusModule)
	Sim, HUD, Menus = simModule, hudModule, menusModule
	buildUI(hudGui)
	buildWorld()
	setWorldVisible(false)
	local function begin()
		saved = math.floor(tonumber(Data.values.tutorial) or 0)
		if saved >= DONE or current ~= 0 then return end
		-- give the HUD a moment to appear, then start (or resume)
		task.delay(1.5, function()
			if current == 0 and saved < DONE then start(math.max(1, saved)) end
		end)
	end
	if Data.ready then begin() else Data.Ready:Connect(begin) end
	RunService.RenderStepped:Connect(function(dt)
		local ok, err = pcall(update, dt)
		if not ok then warn("[TFB] tutorial", err) end
	end)
end

return Tutorial
