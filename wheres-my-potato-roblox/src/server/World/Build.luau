--[[ Build: small helpers to assemble detailed models out of parts (no assets needed). ]]
local Build = {}

function Build.part(parent: Instance, props: { [string]: any }): BasePart
	local cls = props.Class or "Part"
	local p = Instance.new(cls) :: BasePart
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth; p.BottomSurface = Enum.SurfaceType.Smooth
	for k, v in props do if k ~= "Class" and k ~= "Mesh" and k ~= "Light" then (p :: any)[k] = v end end
	if props.Mesh then local m = Instance.new("SpecialMesh"); m.MeshType = props.Mesh; m.Parent = p end
	p.Parent = parent
	return p
end

-- a box between two points (beams, rails, legs)
function Build.beam(parent: Instance, a: Vector3, b: Vector3, w: number, h: number, props: { [string]: any }): BasePart
	local mid, len = (a + b) / 2, (b - a).Magnitude
	local p = Build.part(parent, props)
	p.Size = Vector3.new(w, h, len)
	p.CFrame = CFrame.lookAt(mid, b)
	return p
end
-- a cylinder between two points
function Build.rod(parent: Instance, a: Vector3, b: Vector3, d: number, props: { [string]: any }): BasePart
	local mid, len = (a + b) / 2, (b - a).Magnitude
	local p = Build.part(parent, props)
	p.Shape = Enum.PartType.Cylinder
	p.Size = Vector3.new(len, d, d)
	p.CFrame = CFrame.lookAt(mid, b) * CFrame.Angles(0, math.pi / 2, 0)
	return p
end

function Build.surfaceText(part: BasePart, face: Enum.NormalId, text: string, opts: { [string]: any }?)
	local o = opts or {}
	local g = Instance.new("SurfaceGui")
	g.Face = face; g.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud; g.PixelsPerStud = o.ppu or 40
	g.LightInfluence = o.light or 1; g.Brightness = o.brightness or 1
	g.Parent = part
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1); t.BackgroundTransparency = 1; t.Text = text; t.TextScaled = true
	t.Font = o.font or Enum.Font.FredokaOne; t.TextColor3 = o.color or Color3.new(1, 1, 1)
	t.TextStrokeTransparency = o.stroke or 1; t.TextStrokeColor3 = o.strokeColor or Color3.new(0, 0, 0)
	t.Parent = g
	if o.pad then local pd = Instance.new("UIPadding"); pd.PaddingLeft = UDim.new(o.pad, 0); pd.PaddingRight = UDim.new(o.pad, 0); pd.PaddingTop = UDim.new(o.pad, 0); pd.PaddingBottom = UDim.new(o.pad, 0); pd.Parent = t end
	return g, t
end

function Build.weld(a: BasePart, b: BasePart)
	local w = Instance.new("WeldConstraint"); w.Part0 = a; w.Part1 = b; w.Parent = a; return w
end

-- slight random tint for wooden planks
function Build.tint(c: Color3, r: Random, k: number?): Color3
	local f = 1 - (k or 0.12) / 2 + r:NextNumber() * (k or 0.12)
	return Color3.new(math.clamp(c.R * f, 0, 1), math.clamp(c.G * f, 0, 1), math.clamp(c.B * f, 0, 1))
end

return Build
