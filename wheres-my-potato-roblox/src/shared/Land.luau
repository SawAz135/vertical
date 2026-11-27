--[[ Land: the shape of the potato desert, shared by the server (which writes the Terrain
     voxels) and the clients (which lay the 3D potatoes on it). Asymmetric wind-built dunes
     (gentle windward slope, sharp crest, steep slip face) that swell with distance, small
     mountains on the horizon, flattened around the structures. Pure maths: same result
     everywhere. Units: studs (internally computed in metres, 1 m = 3.5 studs). ]]
local Config = require(script.Parent.Config)
local Land = {}
local M = 3.5

local noise = math.noise
local function fbm(x: number, y: number, oct: number, seed: number): number
	local s, a, f = 0, 0.5, 1
	for i = 1, oct do
		s += a * noise(x * f, y * f, seed + i * 7.13)
		f *= 2.03; a *= 0.5
	end
	return s * 1.6 -- ≈ [-1, 1]
end
local function smooth(t: number) t = math.clamp(t, 0, 1); return t * t * (3 - 2 * t) end

local function dune(x: number, z: number): number
	local warp = fbm(x * 0.012 + 11.3, z * 0.012 - 5.1, 3, 0.5) * 7
	local u = (x * 0.8 + z * 0.6) * 0.045 + warp * 0.32
	local ph = u - math.floor(u)
	local prof = if ph < 0.78 then smooth(ph / 0.78) else smooth(1 - (ph - 0.78) / 0.22)
	local amp = 0.6 + 1.6 * (fbm(x * 0.02 - 4.2, z * 0.02 + 9.7, 2, 3.5) * 0.5 + 0.5)
	return prof * amp + fbm(x * 0.05, z * 0.05, 2, 9.1) * 0.35
end

-- flatten factor near the structures (0 = flat, 1 = free dunes)
local function flat(xs: number, zs: number): number
	local f = 1
	for _, c in Config.CLEAR do
		local d = math.sqrt((xs - c[1]) ^ 2 + (zs - c[2]) ^ 2) - c[3]
		f = math.min(f, smooth(d / 18))
	end
	return f
end

-- terrain height (studs) at a world position
function Land.height(xs: number, zs: number): number
	local x, z = xs / M, zs / M
	local dist = math.sqrt(x * x + z * z)
	local grow = 1 + math.max(0, dist - 30) / 25
	local h = dune(x, z) * grow
	if dist > 110 then
		local m = math.min(1, (dist - 110) / 80)
		h += m * (14 + fbm(x * 0.008, z * 0.008, 4, 21.7) * 22 * 0.5 + 11) * (0.6 + 0.4 * math.abs(math.sin(math.atan2(z, x) * 3 + 1.3)))
	end
	return math.max(0, h) * M * flat(xs, zs)
end

function Land.slope(xs: number, zs: number): (number, number)
	local e = 1.5
	return (Land.height(xs + e, zs) - Land.height(xs - e, zs)) / (2 * e), (Land.height(xs, zs + e) - Land.height(xs, zs - e)) / (2 * e)
end

return Land
