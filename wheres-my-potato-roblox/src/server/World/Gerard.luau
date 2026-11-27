--[[ Gérard: the shopkeeper, an articulated model made of parts (no assets): big belly in a
     plaid shirt under a canvas apron embroidered "GÉRARD", rolled-up sleeves, round face
     with a bulbous nose, rosy cheeks, walrus moustache, bushy brows, round glasses, a worn
     cap. Every limb hangs on a Motor6D so the clients can animate him procedurally
     (breathing, looking at you, blinking, talking jaw, wave / point / thumbs-up / shrug).
     He never walks: he stays at his counter. ]]
local B = require(script.Parent.Build)

local G = {}
local SKIN = Color3.fromRGB(236, 182, 150)
local PLAID = Color3.fromRGB(170, 40, 36)
local APRON = Color3.fromRGB(201, 180, 138)
local DENIM = Color3.fromRGB(58, 82, 122)
local GREY = Color3.fromRGB(214, 210, 202)
local NAVY = Color3.fromRGB(40, 66, 112)

local function joint(name: string, p0: BasePart, p1: BasePart, c0: CFrame, c1: CFrame)
	local m = Instance.new("Motor6D"); m.Name = name; m.Part0 = p0; m.Part1 = p1; m.C0 = c0; m.C1 = c1; m.Parent = p0
	return m
end
local function weldTo(base: BasePart, p: BasePart, rel: CFrame)
	p.Anchored = false; p.CanCollide = false; p.Massless = true
	p.CFrame = base.CFrame * rel
	local w = Instance.new("Weld"); w.Part0 = base; w.Part1 = p; w.C0 = rel; w.Parent = p
	return p
end

function G.build(parent: Instance, at: CFrame)
	local m = Instance.new("Model"); m.Name = "Gerard"; m.Parent = parent
	local function part(name, size, color, mat, mesh)
		return B.part(m, { Name = name, Size = size, Color = color, Material = mat or Enum.Material.SmoothPlastic, Mesh = mesh, Anchored = false, CanCollide = false, Massless = true, CFrame = at })
	end
	local root = B.part(m, { Name = "Root", Size = Vector3.new(1, 1, 1), Transparency = 1, CanCollide = false, CFrame = at })
	m.PrimaryPart = root
	-- legs (mostly behind the counter)
	for _, s in { -1, 1 } do
		local leg = part("Leg", Vector3.new(1.05, 3.2, 1.05), DENIM, Enum.Material.Fabric)
		weldTo(root, leg, CFrame.new(s * 0.62, 1.9, 0))
		local boot = part("Boot", Vector3.new(1.1, 0.7, 1.6), Color3.fromRGB(70, 44, 26), Enum.Material.Leather)
		weldTo(root, boot, CFrame.new(s * 0.62, 0.35, -0.25))
	end
	-- torso (belly) on the waist joint
	local torso = part("Torso", Vector3.new(3.3, 3.5, 2.7), PLAID, Enum.Material.Fabric, Enum.MeshType.Sphere)
	joint("Waist", root, torso, CFrame.new(0, 5.1, 0), CFrame.new())
	local chest = part("Chest", Vector3.new(3.1, 1.6, 2.3), PLAID, Enum.Material.Fabric, Enum.MeshType.Sphere)
	weldTo(torso, chest, CFrame.new(0, 1.35, 0.1))
	local belt = part("Belt", Vector3.new(3.15, 0.4, 2.75), Color3.fromRGB(70, 44, 26), Enum.Material.Leather, Enum.MeshType.Sphere)
	weldTo(torso, belt, CFrame.new(0, -1.25, 0))
	-- apron (front, slightly curved: 3 panels)
	for k = -1, 1 do
		local ap = part("Apron", Vector3.new(1.05, 3.6, 0.12), APRON, Enum.Material.Fabric)
		weldTo(torso, ap, CFrame.new(k * 1.02, -0.1, -1.72 + math.abs(k) * 0.36) * CFrame.Angles(0, k * 0.42, 0)) -- in front of the round belly
		if k == 0 then B.surfaceText(ap, Enum.NormalId.Front, "GÉRARD", { font = Enum.Font.PermanentMarker, color = Color3.fromRGB(122, 58, 26), ppu = 60, pad = 0.05 }) end
	end
	local strap = part("Strap", Vector3.new(1.4, 0.18, 0.12), APRON, Enum.Material.Fabric)
	weldTo(torso, strap, CFrame.new(0, 1.85, -1.05))
	-- head on the neck
	local neck = part("NeckP", Vector3.new(0.9, 0.6, 0.9), SKIN, Enum.Material.SmoothPlastic, Enum.MeshType.Sphere)
	weldTo(chest, neck, CFrame.new(0, 0.75, 0.05))
	local head = part("Head", Vector3.new(1.65, 1.85, 1.7), SKIN, Enum.Material.SmoothPlastic, Enum.MeshType.Sphere)
	joint("Neck", torso, head, CFrame.new(0, 2.9, 0), CFrame.new())
	local function onHead(name, size, color, rel, mat, mesh)
		return weldTo(head, part(name, size, color, mat or Enum.Material.SmoothPlastic, mesh or Enum.MeshType.Sphere), rel)
	end
	onHead("Nose", Vector3.new(0.48, 0.42, 0.5), Color3.fromRGB(232, 150, 130), CFrame.new(0, -0.08, -0.88))
	for _, s in { -1, 1 } do
		onHead("Cheek", Vector3.new(0.5, 0.42, 0.3), Color3.fromRGB(240, 160, 140), CFrame.new(s * 0.45, -0.22, -0.68))
		onHead("Ear", Vector3.new(0.18, 0.5, 0.36), SKIN, CFrame.new(s * 0.84, 0.05, 0))
		onHead("EyeW", Vector3.new(0.3, 0.3, 0.18), Color3.fromRGB(248, 246, 240), CFrame.new(s * 0.3, 0.22, -0.77))
		onHead("Pupil", Vector3.new(0.14, 0.14, 0.06), Color3.fromRGB(40, 70, 90), CFrame.new(s * 0.3, 0.22, -0.86))
		onHead("Brow", Vector3.new(0.48, 0.13, 0.15), GREY, CFrame.new(s * 0.32, 0.47, -0.74) * CFrame.Angles(0, 0, s * -0.15), Enum.Material.Fabric)
		onHead("Lens", Vector3.new(0.44, 0.38, 0.03), Color3.fromRGB(220, 236, 240), CFrame.new(s * 0.3, 0.2, -0.9), Enum.Material.Glass, Enum.MeshType.Sphere).Transparency = 0.7
		onHead("Rim", Vector3.new(0.47, 0.41, 0.025), Color3.fromRGB(42, 28, 18), CFrame.new(s * 0.3, 0.2, -0.885), Enum.Material.Metal, Enum.MeshType.Sphere).Transparency = 0.25
		onHead("Fringe", Vector3.new(0.5, 0.75, 1.2), GREY, CFrame.new(s * 0.7, 0.35, 0.25), Enum.Material.Fabric)
		-- eyelids (blink via the Lid joints)
		local lid = part("Lid", Vector3.new(0.34, 0.18, 0.2), SKIN, Enum.Material.SmoothPlastic, Enum.MeshType.Sphere)
		joint(if s < 0 then "LidL" else "LidR", head, lid, CFrame.new(s * 0.3, 0.37, -0.79), CFrame.new())
	end
	onHead("Bridge", Vector3.new(0.18, 0.04, 0.04), Color3.fromRGB(42, 28, 18), CFrame.new(0, 0.24, -0.9), Enum.Material.Metal, nil)
	onHead("Back", Vector3.new(1.55, 0.9, 0.8), GREY, CFrame.new(0, 0.25, 0.55), Enum.Material.Fabric)
	-- moustache: walrus, three overlapping lumps
	for k = -1, 1 do
		onHead("Moustache", Vector3.new(0.6, 0.34, 0.3), GREY, CFrame.new(k * 0.34, -0.36 - math.abs(k) * 0.06, -0.8 + math.abs(k) * 0.08) * CFrame.Angles(0, 0, k * 0.25), Enum.Material.Fabric)
	end
	-- jaw (talks)
	local jaw = part("Jaw", Vector3.new(1.05, 0.5, 0.9), SKIN, Enum.Material.SmoothPlastic, Enum.MeshType.Sphere)
	joint("JawJ", head, jaw, CFrame.new(0, -0.62, -0.32), CFrame.new())
	local mouth = part("Mouth", Vector3.new(0.5, 0.12, 0.12), Color3.fromRGB(110, 40, 36), Enum.Material.SmoothPlastic, Enum.MeshType.Sphere)
	weldTo(jaw, mouth, CFrame.new(0, 0.18, -0.42))
	-- cap
	onHead("Cap", Vector3.new(1.78, 0.95, 1.85), NAVY, CFrame.new(0, 0.66, 0.02), Enum.Material.Fabric)
	onHead("Visor", Vector3.new(1.3, 0.1, 0.85), NAVY, CFrame.new(0, 0.55, -0.95) * CFrame.Angles(math.rad(-8), 0, 0), Enum.Material.Fabric)
	onHead("Patch", Vector3.new(0.4, 0.28, 0.05), Color3.fromRGB(236, 190, 90), CFrame.new(0, 0.85, -0.86), Enum.Material.Fabric)
	-- arms: plaid sleeve rolled above the elbow, forearm, hand with fingers
	for _, s in { -1, 1 } do
		local nm = if s < 0 then "R" else "L" -- he faces -Z: his right is at -X
		local up = part("Upper" .. nm, Vector3.new(0.95, 2.0, 0.95), PLAID, Enum.Material.Fabric)
		joint("Shoulder" .. nm, torso, up, CFrame.new(s * 1.85, 1.4, 0), CFrame.new(0, 0.85, 0))
		weldTo(up, part("Roll", Vector3.new(1.05, 0.35, 1.05), PLAID, Enum.Material.Fabric), CFrame.new(0, -0.95, 0))
		local fore = part("Fore" .. nm, Vector3.new(0.72, 1.7, 0.72), SKIN, Enum.Material.SmoothPlastic)
		joint("Elbow" .. nm, up, fore, CFrame.new(0, -1.0, 0), CFrame.new(0, 0.8, 0))
		local hand = part("Hand" .. nm, Vector3.new(0.62, 0.78, 0.36), SKIN, Enum.Material.SmoothPlastic, Enum.MeshType.Sphere)
		joint("Wrist" .. nm, fore, hand, CFrame.new(0, -0.85, 0), CFrame.new(0, 0.32, 0))
		for f = 0, 3 do
			local fi = part("Finger", Vector3.new(0.13, 0.42, 0.13), SKIN, Enum.Material.SmoothPlastic)
			weldTo(hand, fi, CFrame.new(-0.2 + f * 0.135, -0.45, -0.05))
		end
		weldTo(hand, part("Thumb", Vector3.new(0.15, 0.36, 0.15), SKIN, Enum.Material.SmoothPlastic), CFrame.new(-s * 0.32, -0.08, -0.12) * CFrame.Angles(0, 0, -s * 0.6))
	end
	for _, p in m:GetDescendants() do if p:IsA("BasePart") then p.CastShadow = true; p.CanQuery = false end end
	root.Anchored = true
	return m
end

return G
