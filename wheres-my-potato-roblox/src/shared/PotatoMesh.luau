--[[ PotatoMesh: real potato shapes generated in the game (EditableMesh → MeshPart), no
     uploaded asset. 8 variants, each a subdivided sphere sculpted like the web version:
     two octaves of lumps, a curved (banana) axis, a soft dent, eye dimples, elongated and
     slightly flattened, smooth normals. Every carpet potato clones one variant (tinted, sized,
     rotated per cell) so thousands of them still share 8 meshes (GPU instancing).
     If EditableMesh is not available (account / platform limits), returns nothing and the
     game keeps the smooth ellipsoid potatoes. ]]
local AssetService = game:GetService("AssetService")

local PM = {}
PM.templates = {} :: { MeshPart }

-- icosphere (subdivided, shared vertices)
local function icosphere(sub: number)
	local t = (1 + math.sqrt(5)) / 2
	local V = { Vector3.new(-1, t, 0), Vector3.new(1, t, 0), Vector3.new(-1, -t, 0), Vector3.new(1, -t, 0), Vector3.new(0, -1, t), Vector3.new(0, 1, t),
		Vector3.new(0, -1, -t), Vector3.new(0, 1, -t), Vector3.new(t, 0, -1), Vector3.new(t, 0, 1), Vector3.new(-t, 0, -1), Vector3.new(-t, 0, 1) }
	for i, v in V do V[i] = v.Unit end
	local F = { { 1, 12, 6 }, { 1, 6, 2 }, { 1, 2, 8 }, { 1, 8, 11 }, { 1, 11, 12 }, { 2, 6, 10 }, { 6, 12, 5 }, { 12, 11, 3 }, { 11, 8, 7 }, { 8, 2, 9 },
		{ 4, 10, 5 }, { 4, 5, 3 }, { 4, 3, 7 }, { 4, 7, 9 }, { 4, 9, 10 }, { 5, 10, 6 }, { 3, 5, 12 }, { 7, 3, 11 }, { 9, 7, 8 }, { 10, 9, 2 } }
	for _ = 1, sub do
		local mid, NF = {}, {}
		local function m(a, b)
			local k = if a < b then a * 100000 + b else b * 100000 + a
			if mid[k] then return mid[k] end
			table.insert(V, ((V[a] + V[b]) / 2).Unit); mid[k] = #V; return #V
		end
		for _, f in F do
			local a, b, c = f[1], f[2], f[3]
			local ab, bc, ca = m(a, b), m(b, c), m(c, a)
			table.insert(NF, { a, ab, ca }); table.insert(NF, { b, bc, ab }); table.insert(NF, { c, ca, bc }); table.insert(NF, { ab, bc, ca })
		end
		F = NF
	end
	return V, F
end

local function sculpt(n: Vector3, seed: number, sh): Vector3
	local r = 1 + sh.lump * math.noise(n.X * 2.1 + seed, n.Y * 2.1, n.Z * 2.1) + sh.lump * 0.4 * math.noise(n.X * 5.3, n.Y * 5.3 + seed, n.Z * 5.3)
	-- eye dimples
	local e = math.noise(n.X * 9 + seed * 3.1, n.Y * 9, n.Z * 9)
	if e > 0.32 then r -= 0.035 * math.clamp((e - 0.32) / 0.2, 0, 1) end
	-- soft dent
	local d = n:Dot(sh.dentDir)
	if d > 0.82 then r -= sh.dent * math.clamp((d - 0.82) / 0.16, 0, 1) end
	local q = n * r
	q = Vector3.new(q.X, q.Y + sh.bend * q.X * q.X * 1.35 - sh.bend * 0.32, q.Z)
	return Vector3.new(q.X * sh.elong, q.Y * sh.flat, q.Z) -- long axis = X
end

function PM.build(): boolean
	local ok = pcall(function()
		local base, faces = icosphere(3)
		local rnd = Random.new(1987)
		for vI = 1, 8 do
			local sh = {
				lump = 0.06 + rnd:NextNumber() * 0.08, bend = if rnd:NextNumber() < 0.6 then rnd:NextNumber() * 0.12 else 0.12 + rnd:NextNumber() * 0.25,
				dent = if rnd:NextNumber() < 0.5 then 0.06 + rnd:NextNumber() * 0.08 else 0, dentDir = Vector3.new(rnd:NextNumber(-1, 1), rnd:NextNumber(-1, 1), rnd:NextNumber(-1, 1)).Unit,
				elong = 1.15 + rnd:NextNumber() * 0.4, flat = 0.78 + rnd:NextNumber() * 0.12,
			}
			local seed = vI * 13.7
			local em = (AssetService :: any):CreateEditableMesh()
			local P, ids = {}, {}
			for i, n in base do P[i] = sculpt(n, seed, sh); ids[i] = em:AddVertex(P[i]) end
			-- outward counter-clockwise triangles + smooth outward normals
			local acc = table.create(#base, Vector3.zero)
			local tris = {}
			for _, f in faces do
				local a, b, c = f[1], f[2], f[3]
				local nrm = (P[b] - P[a]):Cross(P[c] - P[a])
				if nrm:Dot(P[a] + P[b] + P[c]) < 0 then b, c = c, b; nrm = -nrm end
				table.insert(tris, { a, b, c })
				acc[a] += nrm; acc[b] += nrm; acc[c] += nrm
			end
			local nid = {}
			for i = 1, #base do nid[i] = em:AddNormal(acc[i].Unit) end
			for _, f in tris do
				local fid = em:AddTriangle(ids[f[1]], ids[f[2]], ids[f[3]])
				em:SetFaceNormals(fid, { nid[f[1]], nid[f[2]], nid[f[3]] })
			end
			local mp = (AssetService :: any):CreateMeshPartAsync((Content :: any).fromObject(em))
			mp.Anchored = true; mp.CanCollide = false; mp.CanTouch = false; mp.CanQuery = true; mp.CastShadow = false
			mp.Material = Enum.Material.Sand
			mp.Size = Vector3.new(1.3, 0.78, 0.98)
			table.insert(PM.templates, mp)
		end
	end)
	if not ok then table.clear(PM.templates) end
	return #PM.templates > 0
end

-- a potato part (fancy mesh if available)
function PM.make(r: number): BasePart?
	if #PM.templates == 0 then return nil end
	return PM.templates[math.floor(r * 7.999) + 1]:Clone()
end

return PM
