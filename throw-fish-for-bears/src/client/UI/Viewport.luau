--[[ Viewport: 3D thumbnails (ViewportFrame + fitted camera) for fish, bears and rods.
     Spinning thumbnails are animated by one shared RenderStepped loop and only
     while visible. Models are built by the shared builders (exact game models). ]]
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local FishBuilder = require(Shared.Models.FishBuilder)
local BearBuilder = require(Shared.Models.BearBuilder)
local RodBuilder = require(Shared.Models.RodBuilder)
local DumbbellBuilder = require(Shared.Models.DumbbellBuilder)
local Animator = require(script.Parent.Parent.Controllers.AnimalAnimator)

local Viewport = {}
local spinning = {}
local cache: { [string]: Model } = {}

local function fit(vp: ViewportFrame, model: Model, yaw: number, pitch: number, zoom: number)
	local cam = vp.CurrentCamera
	local cf, size = model:GetBoundingBox()
	local radius = size.Magnitude / 2
	local fov = math.rad(cam.FieldOfView)
	local dist = radius / math.sin(fov / 2) * zoom
	local center = cf.Position
	local rot = CFrame.Angles(0, yaw, 0) * CFrame.Angles(-pitch, 0, 0)
	cam.CFrame = CFrame.lookAt(center + rot:VectorToWorldSpace(Vector3.new(0, 0, -dist)), center)
end

--[[ opts: kind "Fish"|"Bear"|"Rod", id, weight, variant, rarity, scale,
     spin (bool), yaw, pitch, zoom, silhouette (bool: black shape for undiscovered) ]]
function Viewport.create(parent: GuiObject, opts)
	local vp = Instance.new("ViewportFrame")
	vp.Name = "Viewport"
	vp.BackgroundTransparency = 1
	vp.Size = opts.size or UDim2.fromScale(1, 1)
	vp.Position = opts.position or UDim2.fromScale(0.5, 0.5)
	vp.AnchorPoint = Vector2.new(0.5, 0.5)
	vp.Ambient = Color3.fromRGB(170, 170, 180)
	vp.LightColor = Color3.fromRGB(255, 250, 240)
	vp.LightDirection = Vector3.new(-0.6, -1, -0.5)
	vp.ZIndex = opts.zindex or parent.ZIndex + 1
	local cam = Instance.new("Camera")
	cam.FieldOfView = 30
	cam.Parent = vp
	vp.CurrentCamera = cam
	-- built models are cached as templates and cloned (Index shows 75 bears + 43 fish)
	local key = ("%s|%s|%s|%s|%s"):format(opts.kind, tostring(opts.id), tostring(opts.variant), tostring(opts.scale or 1), tostring(opts.silhouette == true))
	local template = cache[key]
	if not template then
		local m
		if opts.kind == "Fish" then
			m = FishBuilder.build(opts.id, { scale = opts.scale or 1, variant = opts.variant })
		elseif opts.kind == "Bear" then
			m = BearBuilder.build(opts.id, { scale = opts.scale or 1, variant = opts.variant, brickBudget = 45 })
		elseif opts.kind == "Dumbbell" then
			m = DumbbellBuilder.build(opts.id or 1)
		else
			m = RodBuilder.build(opts.id)
		end
		m:PivotTo(CFrame.new())
		for _, d in m:GetDescendants() do
			if d:IsA("ParticleEmitter") or d:IsA("PointLight") or d:IsA("SpotLight") or d:IsA("Sparkles") then
				d:Destroy()
			elseif opts.silhouette and d:IsA("BasePart") then
				d.Color = Color3.fromRGB(14, 14, 18)
				d.Material = Enum.Material.SmoothPlastic
				d.Reflectance = 0
				d.Transparency = if d.Transparency >= 1 then 1 else 0
			end
		end
		template = m
		cache[key] = m
	end
	local model = template:Clone()
	if opts.silhouette then
		vp.Ambient = Color3.fromRGB(10, 10, 10)
		vp.LightColor = Color3.fromRGB(30, 30, 30)
	end
	-- animals live (swim / idle) instead of spinning: joints need a WorldModel
	local alive = (opts.kind == "Fish" or opts.kind == "Bear") and not opts.silhouette and opts.alive ~= false
	if alive then
		local world = Instance.new("WorldModel")
		world.Parent = vp
		for _, d in model:GetDescendants() do
			if d:IsA("BasePart") then d.Anchored = false end
		end
		if model.PrimaryPart then model.PrimaryPart.Anchored = true end
		model.Parent = world
	else
		model.Parent = vp
	end
	-- the camera sits on the -Z side (the models face -Z): small yaws = a 3/4 FRONT view
	local yaw = opts.yaw or (if opts.kind == "Fish" then math.rad(-55) elseif opts.kind == "Rod" then math.rad(-80) elseif opts.kind == "Dumbbell" then math.rad(-20) else math.rad(-32))
	local pitch = opts.pitch or math.rad(if opts.kind == "Bear" then 12 else 18)
	local zoom = opts.zoom or 1
	fit(vp, model, yaw, pitch, zoom)
	vp.Parent = parent
	if alive then
		Animator.trackUI(model, vp, opts.kind, opts.id)
	elseif opts.showcase then
		-- SHOWCASE (index rewards): the model floats on a fixed frame, tilted like a trophy,
		-- turns slowly, sways and bobs, and every few seconds does a fast full flourish spin
		if opts.kind == "Rod" then
			-- stand the rod up (its axis is -Z): a trophy, tip to the sky
			model:PivotTo(CFrame.Angles(math.pi / 2, 0, 0) * model:GetPivot())
			yaw = opts.yaw or 0
		end
		local cf, size = model:GetBoundingBox()
		local entry = { vp = vp, model = model, showcase = true, t = math.random() * 3, yaw = yaw, pitch = pitch, zoom = zoom,
			center = cf.Position, radius = size.Magnitude / 2, rest = model:GetPivot(), tilt = opts.tilt or 0 }
		spinning[vp] = entry
		vp.Destroying:Connect(function() spinning[vp] = nil end)
	elseif opts.spin then
		local entry = { vp = vp, model = model, yaw = yaw, pitch = pitch, zoom = zoom, speed = opts.spinSpeed or 0.8 }
		spinning[vp] = entry
		vp.Destroying:Connect(function() spinning[vp] = nil end)
	end
	return vp, model
end

-- current spin angle of a spinning thumbnail (to resume it after a rebuild)
function Viewport.yawOf(vp: ViewportFrame): number?
	local e = spinning[vp]
	return e and e.yaw
end

RunService.RenderStepped:Connect(function(dt)
	for vp, e in spinning do
		if e.showcase then
			if vp.Parent and vp.Visible and vp.AbsoluteSize.X > 1 then
				e.t += dt
				local t = e.t
				local PERIOD = 5.5
				local k = (t % PERIOD) - (PERIOD - 1.1) -- the last 1.1 s of each cycle: flourish
				local flourish = 0
				if k > 0 then
					local u = k / 1.1
					flourish = (if u < 0.5 then 4 * u * u * u else 1 - (-2 * u + 2) ^ 3 / 2) * math.pi * 2
				end
				local spin = t * 0.55 + flourish
				local bob = math.sin(t * 1.7) * e.radius * 0.05
				local sway = math.sin(t * 1.1) * 0.14
				-- the model turns around its own centre (tilted diagonally), the camera stays still
				local c = e.center
				e.model:PivotTo(CFrame.new(c + Vector3.new(0, bob, 0)) * CFrame.Angles(0, 0, e.tilt + sway) * CFrame.Angles(0, spin, 0)
					* CFrame.new(-c) * e.rest)
				local cam = vp.CurrentCamera
				local fov = math.rad(cam.FieldOfView)
				local dist = e.radius / math.sin(fov / 2) * e.zoom
				local rot = CFrame.Angles(0, e.yaw, 0) * CFrame.Angles(-(e.pitch + math.sin(t * 0.8) * 0.06), 0, 0)
				cam.CFrame = CFrame.lookAt(c + rot:VectorToWorldSpace(Vector3.new(0, 0, -dist)), c)
			end
		elseif vp.Parent and vp.Visible and vp.AbsoluteSize.X > 1 then
			e.yaw += dt * e.speed
			fit(vp, e.model, e.yaw, e.pitch, e.zoom)
		end
	end
end)

return Viewport
