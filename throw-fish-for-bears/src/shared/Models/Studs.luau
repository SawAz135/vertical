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

-- FULL STUDS: every studded block of a model gets studs on all 6 faces (sides and bottom
-- too), like a real brick toy. Smooth parts (eyes, glass, details) are left smooth.
function Studs.allStuds(model: Instance)
	for _, d in model:GetDescendants() do
		if d:IsA("Part") and d.Shape == Enum.PartType.Block and d.TopSurface == STUDS then
			d.FrontSurface = STUDS
			d.BackSurface = STUDS
			d.LeftSurface = STUDS
			d.RightSurface = STUDS
			d.BottomSurface = STUDS
		end
	end
end

-- toy-like vivid colours for the world: boosts saturation (and a little brightness)
-- of coloured parts; whites, greys and blacks stay as they are
Studs.VIVID_SAT = 1.4
Studs.VIVID_VAL = 1.09
function Studs.vivid(c: Color3): Color3
	local r, g, b = c.R, c.G, c.B
	local hi, lo = math.max(r, g, b), math.min(r, g, b)
	if hi - lo < 0.06 then return c end -- greys / whites / blacks
	-- push each channel away from the grey average (= more saturation), then brighten
	local m = (r + g + b) / 3
	local k, v = Studs.VIVID_SAT, Studs.VIVID_VAL
	return Color3.new(math.clamp((m + (r - m) * k) * v, 0, 1), math.clamp((m + (g - m) * k) * v, 0, 1), math.clamp((m + (b - m) * k) * v, 0, 1))
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
	p.Color = if opts and opts.raw then color else Studs.vivid(color)
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

--[[ BRICK DETAIL ("lots of small bricks" look): covers the big body blocks of a creature
     with little studded bricks (1x1 / 1x2 plates) that stick out a bit, in slightly lighter
     or darker tones of the block they sit on: real 3D relief, feathers / fur texture, studs
     everywhere. Only body roles (no eyes, beaks, teeth...). Each brick is welded to its
     block, so it follows every animation. `budget` = max bricks for the whole model. ]]
local BRICK_ROLES = { fur = true, fur2 = true, belly = true, mark = true, accent = true, muzzle = true, paw = true, patch = true }
-- the face stays clean (eyes, nose, beak must read): no bricks on head pieces
local HEAD_PIECES = { Skull = true, Cranium = true, Melon = true, Head = true, Face = true, Snout = true, Muzzle = true, MuzzleBridge = true,
	Cheek = true, CheekTuft = true, Hammer = true, Crown = true, BackHead = true, Chin = true, Brow = true, Rostrum = true, FacePatch = true }
local FACES = {
	{ n = Vector3.new(0, 1, 0), a = Vector3.new(1, 0, 0), b = Vector3.new(0, 0, 1), w = 3 }, -- top (counts more)
	{ n = Vector3.new(1, 0, 0), a = Vector3.new(0, 1, 0), b = Vector3.new(0, 0, 1), w = 1 },
	{ n = Vector3.new(-1, 0, 0), a = Vector3.new(0, 1, 0), b = Vector3.new(0, 0, 1), w = 1 },
	{ n = Vector3.new(0, 0, 1), a = Vector3.new(1, 0, 0), b = Vector3.new(0, 1, 0), w = 1 },
	{ n = Vector3.new(0, 0, -1), a = Vector3.new(1, 0, 0), b = Vector3.new(0, 1, 0), w = 1 },
}
local function absV(v: Vector3): Vector3
	return Vector3.new(math.abs(v.X), math.abs(v.Y), math.abs(v.Z))
end
function Studs.brickify(model: Model, scale: number, seed: number, budget: number)
	local cell = math.clamp(0.46 * scale, 0.2, 1)
	local rnd = Random.new(seed)
	-- candidate faces, weighted by area
	local cands, total = {}, 0
	for _, p in model:GetDescendants() do
		if p:IsA("Part") and p.Shape ~= Enum.PartType.Ball and p.Shape ~= Enum.PartType.Cylinder and p.Transparency == 0
			and p.Name ~= "Brick" and not HEAD_PIECES[p.Name] and BRICK_ROLES[p:GetAttribute("Role") or ""] then
			local sz = p.Size
			if math.min(sz.X, sz.Y, sz.Z) >= cell * 0.6 then
				for _, f in FACES do
					local du = math.abs(sz:Dot(f.a))
					local dv = math.abs(sz:Dot(f.b))
					if du >= cell * 1.2 and dv >= cell * 1.2 then
						local area = du * dv * f.w
						table.insert(cands, { p = p, f = f, du = du, dv = dv, half = math.abs(sz:Dot(f.n)) / 2, area = area })
						total += area
					end
				end
			end
		end
	end
	if total <= 0 then return 0 end
	local made = 0
	for _, cd in cands do
		local n = math.floor(budget * cd.area / total + rnd:NextNumber())
		for _ = 1, n do
			if made >= budget then return made end
			local long = rnd:NextNumber() < 0.45
			local su = cell * (if long and cd.du >= cell * 2.4 then 2 else 1)
			local sv = cell
			if rnd:NextNumber() < 0.5 then su, sv = sv, su end
			if su > cd.du * 0.9 or sv > cd.dv * 0.9 then continue end
			local th = cell * (0.34 + rnd:NextNumber() * 0.3) -- chunky relief
			local f = cd.f
			local ou = (rnd:NextNumber() - 0.5) * (cd.du - su)
			local ov = (rnd:NextNumber() - 0.5) * (cd.dv - sv)
			-- snap to a half-cell grid: the bricks line up like real plates
			ou = math.floor(ou / (cell * 0.5) + 0.5) * cell * 0.5
			ov = math.floor(ov / (cell * 0.5) + 0.5) * cell * 0.5
			local localPos = f.n * (cd.half + th / 2 - 0.01) + f.a * ou + f.b * ov
			local size = absV(f.a * su + f.b * sv + f.n * th)
			local k = if rnd:NextNumber() < 0.5 then 1.08 + rnd:NextNumber() * 0.1 else 0.8 + rnd:NextNumber() * 0.1
			local b = Studs.piece(model, "Brick", size, cd.p.CFrame * CFrame.new(localPos), Studs.shade(cd.p.Color, k), cd.p:GetAttribute("Role"))
			Studs.weld(cd.p, b)
			made += 1
		end
	end
	return made
end

-- move a freshly built model (parts in model space around the origin) to `cf`
function Studs.place(model: Model, cf: CFrame)
	model:PivotTo(cf)
end

return Studs
