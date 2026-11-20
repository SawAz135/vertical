--[[ WaterFlow: the corridor's water really FLOWS (client only, no network).
     Streams ("Stream"): pale foam streaks slide along the stream and loop, with a soft
     wobble; waterfalls ("Fall"): white streaks pour down the face of the fall. Only the
     water near the camera is animated; the streaks are recycled (fixed count per part). ]]
local RunService = game:GetService("RunService")

local WaterFlow = {}
local items = {} -- { part, kind, streaks }
local folder

local function streak(size: Vector3, color: Color3, transparency: number): Part
	local p = Instance.new("Part")
	p.Name = "FlowStreak"
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Size = size
	p.Color = color
	p.Transparency = transparency
	p.Material = Enum.Material.SmoothPlastic
	p.Parent = folder
	return p
end

local function add(part: BasePart)
	if part:GetAttribute("FlowDone") then return end
	part:SetAttribute("FlowDone", true)
	local kind = if part.Name == "Stream" then "Stream" else "Fall"
	local list = {}
	local n = if kind == "Stream" then 9 else 5
	for i = 1, n do
		local s
		if kind == "Stream" then
			s = streak(Vector3.new(0.5 + math.random() * 0.8, 0.06, 2.5 + math.random() * 3), Color3.fromRGB(215, 240, 255), 0.35)
		else
			s = streak(Vector3.new(0.12, 2 + math.random() * 2.5, 0.35 + math.random() * 0.5), Color3.fromRGB(235, 248, 255), 0.25)
		end
		list[i] = { p = s, off = (i - 1) / n + math.random() * 0.08, lane = math.random() * 2 - 1, speed = 0.8 + math.random() * 0.4 }
	end
	table.insert(items, { part = part, kind = kind, list = list, visible = true })
end

function WaterFlow.init()
	folder = Instance.new("Folder")
	folder.Name = "TFBWaterFlow"
	folder.Parent = workspace
	local function scan(d: Instance)
		if d:IsA("BasePart") and (d.Name == "Stream" or d.Name == "Fall") then add(d) end
	end
	for _, d in workspace:GetDescendants() do scan(d) end
	workspace.DescendantAdded:Connect(scan)
	RunService.RenderStepped:Connect(function()
		local cam = workspace.CurrentCamera
		if not cam then return end
		local camPos = cam.CFrame.Position
		local now = os.clock()
		for _, it in items do
			local part = it.part
			local near = part.Parent ~= nil and (part.Position - camPos).Magnitude < 170 + part.Size.Magnitude * 0.5
			if near ~= it.visible then
				it.visible = near
				for _, s in it.list do s.p.Transparency = if near then (if it.kind == "Stream" then 0.35 else 0.25) else 1 end
			end
			if near then
				local cf, size = part.CFrame, part.Size
				for _, s in it.list do
					local u = ((now * 0.12 * s.speed * (if it.kind == "Stream" then 1 else 2.2)) + s.off) % 1
					if it.kind == "Stream" then
						-- along the stream (its long axis = Z), lanes across, gentle wobble
						local z = (u - 0.5) * size.Z
						local x = s.lane * size.X * 0.38 + math.sin(now * 1.3 + s.off * 9) * 0.3
						s.p.CFrame = cf * CFrame.new(x, size.Y / 2 + 0.03, z) * CFrame.Angles(0, math.sin(now + s.off * 7) * 0.08, 0)
					else
						-- down the face of the fall (local X = thickness): top -> bottom
						local y = (0.5 - u) * size.Y
						local z = s.lane * size.Z * 0.4
						local toward = if cf.Position.X > 0 then -1 else 1 -- the face looking at the corridor
						s.p.CFrame = CFrame.new(cf.Position + Vector3.new(toward * (size.X / 2 + 0.25), y, z))
					end
				end
			end
		end
	end)
end

return WaterFlow
