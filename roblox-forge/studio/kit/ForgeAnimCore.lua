--[[
	Roblox Forge - animation core (ModuleScript, ReplicatedStorage).
	Exact Luau twin of the studio's anim-core.js: same easing curves, same
	quaternion maths, same blending. Pure functions, no services.

	A pet's ForgeAnimData module returns:
	  rig   = { [PartName] = { parent = "Body" | nil, pos = {x,y,z}, rot = {x,y,z} (deg), pivot = {x,y,z} } }
	  clips = { { name, length, when = "idle"|"move"|"spawn"|"manual", loop, speed,
	              tracks = { [PartName] = { { t, pos = {..}, rot = {..}, ease, dir }, ... } } } }

	Every part hangs from its parent with a Motor6D (C0 = rest offset, C1 = identity).
	For a key offset K the motor gets  Transform = Rest^-1 * (T(pivot) * K * T(-pivot)) * Rest.
]]
local Core = {}

local C1 = 1.70158
local C3 = C1 + 1
local C4 = (2 * math.pi) / 3

local function bounceOut(x: number): number
	local n, d = 7.5625, 2.75
	if x < 1 / d then
		return n * x * x
	elseif x < 2 / d then
		x -= 1.5 / d
		return n * x * x + 0.75
	elseif x < 2.5 / d then
		x -= 2.25 / d
		return n * x * x + 0.9375
	end
	x -= 2.625 / d
	return n * x * x + 0.984375
end

local IN = {
	Linear = function(x) return x end,
	Sine = function(x) return 1 - math.cos(x * math.pi / 2) end,
	Quad = function(x) return x * x end,
	Cubic = function(x) return x * x * x end,
	Quart = function(x) return x * x * x * x end,
	Quint = function(x) return x * x * x * x * x end,
	Exponential = function(x) return x == 0 and 0 or 2 ^ (10 * x - 10) end,
	Circular = function(x) return 1 - math.sqrt(math.max(0, 1 - x * x)) end,
	Back = function(x) return C3 * x * x * x - C1 * x * x end,
	Elastic = function(x)
		if x == 0 or x == 1 then return x end
		return -(2 ^ (10 * x - 10)) * math.sin((x * 10 - 10.75) * C4)
	end,
	Bounce = function(x) return 1 - bounceOut(1 - x) end,
}

function Core.ease(style: string?, dir: string?, x: number): number
	x = math.clamp(x, 0, 1)
	if style == "Constant" then return x >= 1 and 1 or 0 end
	local f = IN[style or "Sine"] or IN.Linear
	if dir == "In" then return f(x) end
	if dir == "Out" then return 1 - f(1 - x) end
	if x < 0.5 then return f(2 * x) / 2 end
	return 1 - f(2 - 2 * x) / 2
end

-- Euler XYZ in degrees (= CFrame.Angles) -> quaternion {x, y, z, w}
function Core.quat(r)
	local hx, hy, hz = math.rad(r[1]) / 2, math.rad(r[2]) / 2, math.rad(r[3]) / 2
	local c1, c2, c3 = math.cos(hx), math.cos(hy), math.cos(hz)
	local s1, s2, s3 = math.sin(hx), math.sin(hy), math.sin(hz)
	return {
		s1 * c2 * c3 + c1 * s2 * s3,
		c1 * s2 * c3 - s1 * c2 * s3,
		c1 * c2 * s3 + s1 * s2 * c3,
		c1 * c2 * c3 - s1 * s2 * s3,
	}
end

function Core.slerp(a, b, t: number)
	local bx, by, bz, bw = b[1], b[2], b[3], b[4]
	local cos = a[1] * bx + a[2] * by + a[3] * bz + a[4] * bw
	if cos < 0 then
		cos, bx, by, bz, bw = -cos, -bx, -by, -bz, -bw
	end
	local ka, kb
	if cos > 0.9995 then
		ka, kb = 1 - t, t
	else
		local th = math.acos(math.min(1, cos))
		local s = math.sin(th)
		ka, kb = math.sin((1 - t) * th) / s, math.sin(t * th) / s
	end
	local x, y, z, w = a[1] * ka + bx * kb, a[2] * ka + by * kb, a[3] * ka + bz * kb, a[4] * ka + bw * kb
	local n = math.sqrt(x * x + y * y + z * z + w * w)
	if n == 0 then n = 1 end
	return { x / n, y / n, z / n, w / n }
end

local function ident()
	return { p = { 0, 0, 0 }, q = { 0, 0, 0, 1 } }
end

local function mix(a, b, w: number)
	return {
		p = { a.p[1] + (b.p[1] - a.p[1]) * w, a.p[2] + (b.p[2] - a.p[2]) * w, a.p[3] + (b.p[3] - a.p[3]) * w },
		q = Core.slerp(a.q, b.q, w),
	}
end

-- keys sorted by t -> offset {p, q} at time t (nil when the part has no track)
function Core.sample(keys, t: number)
	if not keys or #keys == 0 then return nil end
	local first, last = keys[1], keys[#keys]
	if #keys == 1 or t <= first.t then
		return { p = { first.pos[1], first.pos[2], first.pos[3] }, q = Core.quat(first.rot) }
	end
	if t >= last.t then
		return { p = { last.pos[1], last.pos[2], last.pos[3] }, q = Core.quat(last.rot) }
	end
	local i = 1
	while i < #keys - 1 and keys[i + 1].t <= t do
		i += 1
	end
	local a, b = keys[i], keys[i + 1]
	local span = b.t - a.t
	local e = span > 1e-6 and Core.ease(a.ease or "Sine", a.dir or "InOut", (t - a.t) / span) or 1
	return {
		p = { a.pos[1] + (b.pos[1] - a.pos[1]) * e, a.pos[2] + (b.pos[2] - a.pos[2]) * e, a.pos[3] + (b.pos[3] - a.pos[3]) * e },
		q = Core.slerp(Core.quat(a.rot), Core.quat(b.rot), e),
	}
end

function Core.clipTime(clip, time: number): number
	local len = math.max(0.05, clip.length or 1)
	if clip.loop then
		return time % len
	end
	return math.min(time, len)
end

-- layers = { { clip, t, w, over } }: base layers are averaged by weight (no track = rest),
-- "over" layers (one-shots) override only the parts they animate.
function Core.blend(layers, partNames)
	local out, wsum = {}, {}
	for _, L in layers do
		if not L.clip or L.w <= 1e-4 then continue end
		local t = Core.clipTime(L.clip, L.t)
		local tracks = L.clip.tracks or {}
		for _, name in partNames do
			local s = Core.sample(tracks[name], t)
			if L.over then
				if s then out[name] = mix(out[name] or ident(), s, L.w) end
			else
				local ws = (wsum[name] or 0) + L.w
				wsum[name] = ws
				local acc = out[name]
				out[name] = acc and mix(acc, s or ident(), L.w / ws) or (s or ident())
			end
		end
	end
	return out
end

local function cframeFromQuat(px: number, py: number, pz: number, q)
	local x, y, z, w = q[1], q[2], q[3], q[4]
	return CFrame.new(
		px, py, pz,
		1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
		2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
		2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)
	)
end
Core.cframeFromQuat = cframeFromQuat

function Core.rest(info)
	return CFrame.new(info.pos[1], info.pos[2], info.pos[3])
		* CFrame.Angles(math.rad(info.rot[1]), math.rad(info.rot[2]), math.rad(info.rot[3]))
end

-- Precompute rest CFrames and pivots once per pet.
function Core.prepare(data)
	local rig = { names = {}, rest = {}, restInv = {}, pivot = {}, parent = {} }
	for name, info in data.rig or {} do
		local r = Core.rest(info)
		table.insert(rig.names, name)
		rig.rest[name] = r
		rig.restInv[name] = r:Inverse()
		rig.pivot[name] = Vector3.new(info.pivot[1], info.pivot[2], info.pivot[3])
		rig.parent[name] = info.parent
	end
	table.sort(rig.names)
	return rig
end

-- offset {p, q} -> Motor6D.Transform for that part
function Core.transform(rig, name: string, off)
	if not off then return CFrame.identity end
	local pv = rig.pivot[name]
	local K = cframeFromQuat(off.p[1], off.p[2], off.p[3], off.q)
	local D = CFrame.new(pv) * K * CFrame.new(-pv)
	return rig.restInv[name] * D * rig.rest[name]
end

return Core
