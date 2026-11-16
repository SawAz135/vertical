--[[ Viewport: 3D thumbnails (ViewportFrame + fitted camera) for fish, bears and rods.
     Spinning thumbnails are animated by one shared RenderStepped loop and only
     while visible. Models are built by the shared builders (exact game models). ]]
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local FishBuilder = require(Shared.Models.FishBuilder)
local BearBuilder = require(Shared.Models.BearBuilder)
local RodBuilder = require(Shared.Models.RodBuilder)

local Viewport = {}
local spinning = {}

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
	local model
	if opts.kind == "Fish" then
		model = FishBuilder.build(opts.id, { scale = opts.scale or 1, variant = opts.variant })
	elseif opts.kind == "Bear" then
		model = BearBuilder.build(opts.id, { scale = opts.scale or 1, variant = opts.variant })
	else
		model = RodBuilder.build(opts.id)
	end
	model:PivotTo(CFrame.new())
	if opts.silhouette then
		for _, d in model:GetDescendants() do
			if d:IsA("BasePart") then
				d.Color = Color3.fromRGB(14, 14, 18)
				d.Material = Enum.Material.SmoothPlastic
				d.Reflectance = 0
			elseif d:IsA("ParticleEmitter") then
				d:Destroy()
			end
		end
		vp.Ambient = Color3.fromRGB(10, 10, 10)
		vp.LightColor = Color3.fromRGB(30, 30, 30)
	end
	for _, d in model:GetDescendants() do
		if d:IsA("ParticleEmitter") or d:IsA("PointLight") then d:Destroy() end
	end
	model.Parent = vp
	local yaw = opts.yaw or (if opts.kind == "Fish" then math.rad(-70) elseif opts.kind == "Rod" then math.rad(-80) else math.rad(-145))
	local pitch = opts.pitch or math.rad(if opts.kind == "Bear" then 12 else 18)
	local zoom = opts.zoom or 1
	fit(vp, model, yaw, pitch, zoom)
	vp.Parent = parent
	if opts.spin then
		local entry = { vp = vp, model = model, yaw = yaw, pitch = pitch, zoom = zoom, speed = opts.spinSpeed or 0.8 }
		spinning[vp] = entry
		vp.Destroying:Connect(function() spinning[vp] = nil end)
	end
	return vp, model
end

RunService.RenderStepped:Connect(function(dt)
	for vp, e in spinning do
		if vp.Parent and vp.Visible and vp.AbsoluteSize.X > 1 then
			e.yaw += dt * e.speed
			fit(vp, e.model, e.yaw, e.pitch, e.zoom)
		end
	end
end)

return Viewport
