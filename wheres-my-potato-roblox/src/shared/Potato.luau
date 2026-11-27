--[[ Potato: deterministic potatoes of the desert grid + the 3D potato model.
     A cell (ix, iz) of the grid always holds the same potato (shape, tint, jitter) on
     every machine, so the server only has to tell clients which cells were dug. ]]
local Config = require(script.Parent.Config)
local Potato = {}

local S = Config.POTATO.Spacing
Potato.S = S

-- 32-bit integer hash → [0, 1)
local function hash(a: number, b: number, c: number): number
	local h = bit32.bxor(bit32.band(a * 374761393, 0xFFFFFFFF), bit32.band(b * 668265263, 0xFFFFFFFF), bit32.band(c * 2246822519, 0xFFFFFFFF))
	h = bit32.band(bit32.bxor(h, bit32.rshift(h, 13)) * 1274126177, 0xFFFFFFFF)
	h = bit32.bxor(h, bit32.rshift(h, 16))
	return h / 4294967296
end
Potato.hash = hash

function Potato.key(ix: number, iz: number): number return (ix + 32768) * 65536 + (iz + 32768) end
function Potato.unkey(k: number): (number, number) return k // 65536 - 32768, k % 65536 - 32768 end
function Potato.cellOf(x: number, z: number): (number, number) return math.floor(x / S), math.floor(z / S) end

-- position (x, z) + traits of the potato of a cell, for a given dig depth (layer)
function Potato.cell(ix: number, iz: number, layer: number?)
	local L = layer or 0
	local a, b = ix % 65536, iz % 65536
	local r1, r2, r3, r4 = hash(a, b, 1 + L * 11), hash(a, b, 2 + L * 11), hash(a, b, 3 + L * 11), hash(a, b, 4 + L * 11)
	local x = (ix + 0.5 + (r1 - 0.5) * 0.5) * S
	local z = (iz + 0.5 + (r2 - 0.5) * 0.5) * S
	local size = 0.85 + r3 * 0.35
	local variety = if r4 < 0.72 then 1 else 2
	if L > 0 and hash(a, b, 5 + L * 11) < (Config.PURPLE[math.min(L, #Config.PURPLE - 1) + 1] or 0) then variety = 5 end
	return x, z, size, variety, hash(a, b, 6 + L * 11), hash(a, b, 7 + L * 11)
end

-- the 3D model: an ellipsoid with a slight random tilt (SpecialMesh sphere = smooth, cheap)
function Potato.make(variety: number, size: number, rnd: number?): BasePart
	local r = rnd or 0.5
	local p = Instance.new("Part")
	p.Name = "Potato"
	p.Size = Vector3.new(Config.POTATO.Len * size * (1.05 + r * 0.25), 0.78 * size, 0.98 * size)
	p.Color = Potato.color(variety, r)
	p.Material = Enum.Material.Sand
	p.TopSurface = Enum.SurfaceType.Smooth; p.BottomSurface = Enum.SurfaceType.Smooth
	p.CastShadow = false
	local m = Instance.new("SpecialMesh"); m.MeshType = Enum.MeshType.Sphere; m.Parent = p
	return p
end
function Potato.color(variety: number, r: number): Color3
	local base = Config.VARIETIES[variety].color
	local k = 0.9 + r * 0.18
	return Color3.new(math.clamp(base.R * k, 0, 1), math.clamp(base.G * k, 0, 1), math.clamp(base.B * k, 0, 1))
end
function Potato.price(variety: number): number return Config.VARIETIES[variety].price end

return Potato
