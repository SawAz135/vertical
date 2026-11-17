--[[ Studs: helpers that build classic Roblox Plastic + Studs geometry.
     Every animal, rod and prop in the game is made with these, so the whole world
     shares one construction language (Plastic, studs on top, inlets underneath). ]]
local Studs = {}

local STUDS = Enum.SurfaceType.Studs
local INLET = Enum.SurfaceType.Inlet
local SMOOTH = Enum.SurfaceType.Smooth

function Studs.shade(c: Color3, k: number): Color3
	return Color3.new(math.clamp(c.R * k, 0, 1), math.clamp(c.G * k, 0, 1), math.clamp(c.B * k, 0, 1))
end

function Studs.mix(a: Color3, b: Color3, t: number): Color3
	return a:Lerp(b, t)
end

-- a loose (unanchored, massless, non-colliding) model piece, used for animals and tools
function Studs.piece(parent: Instance, name: string, size: Vector3, cf: CFrame, color: Color3, role: string?, opts: any?)
	local p = Instance.new(if opts and opts.wedge then "WedgePart" else "Part")
	p.Name = name
	p.Size = Vector3.new(math.max(size.X, 0.05), math.max(size.Y, 0.05), math.max(size.Z, 0.05))
	p.CFrame = cf
	p.Color = color
	p.Material = opts and opts.material or Enum.Material.Plastic
	p.Anchored = false
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.Massless = true
	p.CastShadow = not (opts and opts.noShadow)
	if opts and opts.smooth then
		p.TopSurface = SMOOTH
		p.BottomSurface = SMOOTH
	else
		p.TopSurface = STUDS
		p.BottomSurface = INLET
	end
	if opts and opts.transparency then p.Transparency = opts.transparency end
	if opts and opts.reflectance then p.Reflectance = opts.reflectance end
	if opts and opts.shape then
		(p :: Part).Shape = opts.shape
	end
	if role then p:SetAttribute("Role", role) end
	p.Parent = parent
	return p
end

-- an anchored, colliding map part
function Studs.static(parent: Instance, name: string, size: Vector3, cf: CFrame, color: Color3, opts: any?)
	if size.X > 2048 or size.Y > 2048 or size.Z > 2048 then
		warn("[TFB] part larger than 2048 studs gets clamped by Roblox:", name, size)
	end
	local p = Instance.new(if opts and opts.wedge then "WedgePart" else "Part")
	p.Name = name
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = opts and opts.material or Enum.Material.Plastic
	p.Anchored = true
	p.CanCollide = not (opts and opts.noCollide)
	p.CanTouch = opts and opts.touch or false
	p.CanQuery = not (opts and opts.noQuery)
	p.CastShadow = not (opts and opts.noShadow)
	local allSides = opts and opts.allStuds
	p.TopSurface = if opts and opts.smooth then SMOOTH else STUDS
	p.BottomSurface = if opts and opts.smooth then SMOOTH else INLET
	if allSides then
		p.FrontSurface = STUDS
		p.BackSurface = STUDS
		p.LeftSurface = STUDS
		p.RightSurface = STUDS
	end
	if opts and opts.transparency then p.Transparency = opts.transparency end
	if opts and opts.reflectance then p.Reflectance = opts.reflectance end
	if opts and opts.shape then (p :: Part).Shape = opts.shape end
	p.Parent = parent
	return p
end

function Studs.weld(a: BasePart, b: BasePart)
	local w = Instance.new("WeldConstraint")
	w.Part0 = a
	w.Part1 = b
	w.Parent = b
	return w
end

-- Motor6D whose pivot is the world frame `pivot` (rotation axes = pivot axes)
function Studs.motor(name: string, part0: BasePart, part1: BasePart, pivot: CFrame)
	local m = Instance.new("Motor6D")
	m.Name = name
	m.Part0 = part0
	m.Part1 = part1
	m.C0 = part0.CFrame:ToObjectSpace(pivot)
	m.C1 = part1.CFrame:ToObjectSpace(pivot)
	m.Parent = part0
	return m
end

-- invisible bone part used as the rigid body of a limb
function Studs.bone(parent: Instance, name: string, cf: CFrame, size: Vector3?)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size or Vector3.new(0.2, 0.2, 0.2)
	p.CFrame = cf
	p.Transparency = 1
	p.Anchored = false
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.Massless = true
	p.CastShadow = false
	p.Parent = parent
	return p
end

-- weld every BasePart in `parts` to `bone`
function Studs.weldAll(bone: BasePart, parts: { BasePart })
	for _, p in parts do
		if p ~= bone then Studs.weld(bone, p) end
	end
end

-- move a freshly built model (parts in model space around the origin) to `cf`
function Studs.place(model: Model, cf: CFrame)
	model:PivotTo(cf)
end

return Studs
