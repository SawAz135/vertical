--[[ Structures: the giant glass jar (a skyscraper), the spiral conveyor wrapped around it,
     the ramp from the wooden bin, the chute + motor house on the rim, and the bin itself.
     Also exposes the conveyor path used by the Machine (bin → ramp → 4-turn helix → chute). ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)
local Potato = require(ReplicatedStorage.Shared.Potato)
local B = require(script.Parent.Build)

local S = {}
local J, BIN, SP = Config.JAR, Config.BIN, Config.SPIRAL
local TAU = math.pi * 2

local GLASS = Color3.fromRGB(214, 238, 250)
local RED = Color3.fromRGB(205, 36, 28)
local STEEL = Color3.fromRGB(160, 166, 172)
local WOOD = Color3.fromRGB(165, 112, 60)
local WOOD_D = Color3.fromRGB(108, 70, 38)

-- ---------------------------------------------------------------- conveyor path
local P0 = BIN.Pos + Vector3.new(BIN.W / 2 + 1.2, 3.6, 0)
local H0 = Vector3.new(math.cos(SP.Theta0) * SP.R, SP.Y0, math.sin(SP.Theta0) * SP.R)
local H1 = Vector3.new(math.cos(SP.Theta0) * SP.R, SP.Y1, math.sin(SP.Theta0) * SP.R)
local C1 = Vector3.new(J.Pos.X, SP.Y1 - 2, J.Pos.Z - 6)
local L0 = (H0 - P0).Magnitude
local L1 = math.sqrt((TAU * SP.R * SP.Turns) ^ 2 + (SP.Y1 - SP.Y0) ^ 2)
local L2 = (C1 - H1).Magnitude
S.PathLength = L0 + L1 + L2
S.ChuteEnd = C1

local function helix(t: number, r: number): Vector3
	local a = SP.Theta0 + t * TAU * SP.Turns
	return Vector3.new(math.cos(a) * r, SP.Y0 + t * (SP.Y1 - SP.Y0), math.sin(a) * r)
end
-- position on the belt at travelled distance s (studs), lateral offset lat (studs)
function S.pathPos(s: number, lat: number): Vector3
	if s <= L0 then
		local d = (H0 - P0).Unit
		local side = Vector3.new(-d.Z, 0, d.X).Unit
		return P0:Lerp(H0, s / L0) + side * lat + Vector3.new(0, 0.9, 0)
	end
	s -= L0
	if s <= L1 then return helix(s / L1, SP.R + lat) + Vector3.new(0, 0.9, 0) end
	s -= L1
	return H1:Lerp(C1, math.clamp(s / L2, 0, 1)) + Vector3.new(lat, 1, 0)
end

-- ---------------------------------------------------------------- jar
function S.jar(parent: Instance)
	local m = Instance.new("Model"); m.Name = "Jar"; m.Parent = parent
	local c = J.Pos
	local outer = J.R + J.Wall
	-- plinth
	B.part(m, { Shape = Enum.PartType.Cylinder, Size = Vector3.new(2.2, outer * 2 + 7, outer * 2 + 7), CFrame = CFrame.new(c + Vector3.new(0, 0.6, 0)) * CFrame.Angles(0, 0, math.pi / 2), Material = Enum.Material.Concrete, Color = Color3.fromRGB(176, 168, 156) })
	B.part(m, { Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.6, outer * 2 + 3.4, outer * 2 + 3.4), CFrame = CFrame.new(c + Vector3.new(0, 1.9, 0)) * CFrame.Angles(0, 0, math.pi / 2), Material = Enum.Material.Metal, Color = Color3.fromRGB(196, 160, 82), Reflectance = 0.15 })
	-- floor inside
	B.part(m, { Name = "Floor", Shape = Enum.PartType.Cylinder, Size = Vector3.new(J.Base, J.R * 2, J.R * 2), CFrame = CFrame.new(c + Vector3.new(0, J.Base / 2, 0)) * CFrame.Angles(0, 0, math.pi / 2), Material = Enum.Material.Glass, Color = GLASS, Transparency = 0.4 })
	-- the glass: one big refractive cylinder for the look...
	local glass = B.part(m, { Name = "Glass", Shape = Enum.PartType.Cylinder, Size = Vector3.new(J.Rim, outer * 2, outer * 2), CFrame = CFrame.new(c + Vector3.new(0, J.Rim / 2, 0)) * CFrame.Angles(0, 0, math.pi / 2), Material = Enum.Material.Glass, Color = GLASS, Transparency = 0.72, CanCollide = false, CastShadow = false, Reflectance = 0.08 })
	glass.CanQuery = false
	-- ...and invisible wall segments for the physics (potatoes stay inside, players outside)
	local NS = 48
	for k = 0, NS - 1 do
		local a = k / NS * TAU
		local w = 2 * (J.R + J.Wall / 2) * math.tan(math.pi / NS) + 0.2
		B.part(m, { Name = "Wall", Size = Vector3.new(w, J.Rim, J.Wall), CFrame = CFrame.new(c + Vector3.new(math.cos(a) * (J.R + J.Wall / 2), J.Rim / 2, math.sin(a) * (J.R + J.Wall / 2))) * CFrame.Angles(0, -a + math.pi / 2, 0), Transparency = 1, CastShadow = false })
	end
	-- rolled glass lip + brass bands
	for k = 0, 63 do
		local a0, a1 = k / 64 * TAU, (k + 1) / 64 * TAU
		local p0, p1 = Vector3.new(math.cos(a0), 0, math.sin(a0)) * (outer + 0.2), Vector3.new(math.cos(a1), 0, math.sin(a1)) * (outer + 0.2)
		B.rod(m, c + p0 + Vector3.new(0, J.Rim, 0), c + p1 + Vector3.new(0, J.Rim, 0), 1.4, { Material = Enum.Material.Glass, Color = GLASS, Transparency = 0.45, CanCollide = false })
		for _, y in { 4.5, J.Rim - 7 } do
			B.rod(m, c + p0 * 1.004 + Vector3.new(0, y, 0), c + p1 * 1.004 + Vector3.new(0, y, 0), 0.7, { Material = Enum.Material.Metal, Color = Color3.fromRGB(198, 158, 70), Reflectance = 0.2, CanCollide = false })
		end
	end
	-- graduations (every 10 % of the height) on the front
	for k = 1, 9 do
		local y = J.Base + (J.Rim - J.Base) * k / 10
		local tick = B.part(m, { Size = Vector3.new(if k % 5 == 0 then 5 else 3, 0.25, 0.05), CFrame = CFrame.new(c + Vector3.new(-8, y, -(outer + 0.06))), Color = Color3.new(1, 1, 1), Material = Enum.Material.SmoothPlastic, Transparency = 0.15, CanCollide = false })
		B.surfaceText(B.part(m, { Size = Vector3.new(8, 2, 0.05), CFrame = CFrame.new(c + Vector3.new(-14.5, y, -(outer + 0.06))), Transparency = 1, CanCollide = false }), Enum.NormalId.Front, tostring(math.floor(J.Cap * k / 10)), { color = Color3.new(1, 1, 1), stroke = 0.6, ppu = 30 })
		tick.CanQuery = false
	end
	-- ONE piece of brown packing tape with BOCAL written in marker
	local tape = B.part(m, { Name = "Tape", Size = Vector3.new(19, 6.4, 0.08), CFrame = CFrame.new(c + Vector3.new(4, 44, -(outer + 0.12))) * CFrame.Angles(0, 0, math.rad(-3)), Color = Color3.fromRGB(205, 160, 88), Material = Enum.Material.SmoothPlastic, CanCollide = false })
	B.surfaceText(tape, Enum.NormalId.Front, "BOCAL", { font = Enum.Font.PermanentMarker, color = Color3.fromRGB(22, 16, 12), ppu = 30, pad = 0.04 })
	-- fill: a golden pile (pebbles) + a top layer of real 3D potatoes that rises with it
	local fill = B.part(m, { Name = "Fill", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.2, J.R * 2 - 0.6, J.R * 2 - 0.6), CFrame = CFrame.new(c + Vector3.new(0, J.Base, 0)) * CFrame.Angles(0, 0, math.pi / 2), Material = Enum.Material.Pebble, Color = Color3.fromRGB(226, 172, 78), Transparency = 1 })
	local top = Instance.new("Folder"); top.Name = "FillTop"; top.Parent = m
	local r = Random.new(5)
	local NT = 260
	for k = 0, NT - 1 do
		local t = (k + 0.5) / NT
		local rr = (J.R - 1.2) * math.sqrt(t)
		local a = k * 2.39996323
		local p = Potato.make(if r:NextNumber() < 0.7 then 1 else 2, 1.1 + r:NextNumber() * 0.5, r:NextNumber())
		p.Anchored = true; p.CanCollide = false; p.CanQuery = false
		p:SetAttribute("rx", math.cos(a) * rr); p:SetAttribute("rz", math.sin(a) * rr); p:SetAttribute("ry", r:NextNumber() * 6.28)
		p.CFrame = CFrame.new(c + Vector3.new(math.cos(a) * rr, -50, math.sin(a) * rr))
		p.Parent = top
	end
	-- count board at the foot of the jar
	local board = B.part(m, { Name = "CountBoard", Size = Vector3.new(16, 4.2, 0.6), CFrame = CFrame.new(c + Vector3.new(14, 4.4, -(outer + 4))) * CFrame.Angles(0, math.rad(-12), 0), Color = WOOD_D, Material = Enum.Material.Wood })
	B.part(m, { Size = Vector3.new(0.5, 4, 0.5), CFrame = board.CFrame * CFrame.new(-6, -3.5, 0.3), Color = WOOD_D, Material = Enum.Material.Wood })
	B.part(m, { Size = Vector3.new(0.5, 4, 0.5), CFrame = board.CFrame * CFrame.new(6, -3.5, 0.3), Color = WOOD_D, Material = Enum.Material.Wood })
	local _, label = B.surfaceText(board, Enum.NormalId.Front, "0 patates dans le bocal", { font = Enum.Font.FredokaOne, color = Color3.fromRGB(255, 228, 160), ppu = 30, pad = 0.05, stroke = 0.5 })
	S.jarModel = m; S.fill = fill; S.fillTop = top; S.countLabel = label
	return m
end

-- ---------------------------------------------------------------- spiral conveyor
function S.spiral(parent: Instance)
	local m = Instance.new("Model"); m.Name = "Spiral"; m.Parent = parent
	local N = SP.Turns * 44
	local W = SP.Width
	local rubber = Color3.fromRGB(44, 44, 48)
	for k = 0, N - 1 do
		local t0, t1 = k / N, (k + 1) / N
		local a, b = helix(t0, SP.R), helix(t1, SP.R)
		local belt = B.beam(m, a, b, W * 2, 0.35, { Material = Enum.Material.Rubber, Color = rubber })
		belt.Size += Vector3.new(0, 0, 0.12)
		for _, side in { -1, 1 } do
			local ra, rb = helix(t0, SP.R + side * (W + 0.15)) + Vector3.new(0, 0.55, 0), helix(t1, SP.R + side * (W + 0.15)) + Vector3.new(0, 0.55, 0)
			B.beam(m, ra, rb, 0.3, 1.3, { Material = Enum.Material.Metal, Color = RED, Reflectance = 0.05 }).Size += Vector3.new(0, 0, 0.1)
		end
		-- polished guard tube on the outside + posts
		local ga, gb = helix(t0, SP.R + W + 0.15) + Vector3.new(0, 2.6, 0), helix(t1, SP.R + W + 0.15) + Vector3.new(0, 2.6, 0)
		B.rod(m, ga, gb, 0.32, { Material = Enum.Material.Metal, Color = Color3.fromRGB(232, 230, 224), Reflectance = 0.25, CanCollide = false })
		if k % 2 == 0 then
			B.rod(m, helix(t0, SP.R + W + 0.15) + Vector3.new(0, 0.6, 0), ga, 0.22, { Material = Enum.Material.Metal, Color = STEEL, CanCollide = false })
		end
		-- brackets bolting the belt to the jar
		if k % 4 == 0 then
			local inner = helix(t0, J.R + J.Wall + 0.2) - Vector3.new(0, 0.6, 0)
			B.beam(m, inner, helix(t0, SP.R + W) - Vector3.new(0, 0.6, 0), 0.5, 0.5, { Material = Enum.Material.Metal, Color = STEEL })
			B.beam(m, inner - Vector3.new(0, 3, 0), helix(t0, SP.R - W * 0.2) - Vector3.new(0, 0.7, 0), 0.35, 0.35, { Material = Enum.Material.Metal, Color = STEEL })
		end
	end
	-- foot pillars under the first half turn
	for k = 0, 10 do
		local t = k / (N) * 4
		local p = helix(t, SP.R)
		if p.Y > 2 then B.rod(m, Vector3.new(p.X, 0, p.Z), p - Vector3.new(0, 0.3, 0), 0.6, { Material = Enum.Material.Metal, Color = RED }) end
	end
	-- chute into the jar + motor house + beacon on the rim
	local chute = B.beam(m, H1 + Vector3.new(0, 0.4, 0), C1 + Vector3.new(0, 0.4, 0), 4, 0.3, { Material = Enum.Material.Metal, Color = Color3.fromRGB(200, 208, 216), Reflectance = 0.2 })
	for _, side in { -1, 1 } do
		local off = chute.CFrame.RightVector * side * 2
		B.beam(m, H1 + off + Vector3.new(0, 1, 0), C1 + off + Vector3.new(0, 1, 0), 0.25, 1.4, { Material = Enum.Material.Metal, Color = Color3.fromRGB(200, 208, 216) })
	end
	local house = B.part(m, { Name = "MotorHouse", Size = Vector3.new(5, 4, 4.4), CFrame = CFrame.new(H1 + Vector3.new(4.5, 1.5, -1)), Material = Enum.Material.Metal, Color = Color3.fromRGB(240, 176, 30) })
	for k = 0, 4 do B.part(m, { Size = Vector3.new(5.1, 0.2, 4.5), CFrame = house.CFrame * CFrame.new(0, -1.6 + k * 0.8, 0), Material = Enum.Material.Metal, Color = Color3.fromRGB(60, 60, 64) }) end
	local beacon = B.part(m, { Name = "Beacon", Shape = Enum.PartType.Ball, Size = Vector3.new(1.4, 1.4, 1.4), CFrame = house.CFrame * CFrame.new(0, 2.8, 0), Material = Enum.Material.Neon, Color = Color3.fromRGB(255, 40, 20) })
	local bl = Instance.new("PointLight"); bl.Color = Color3.fromRGB(255, 60, 30); bl.Range = 40; bl.Brightness = 3; bl.Parent = beacon
	S.beacon = beacon
	return m
end

-- ---------------------------------------------------------------- ramp (bin → helix)
function S.ramp(parent: Instance)
	local m = Instance.new("Model"); m.Name = "Ramp"; m.Parent = parent
	local d = (H0 - P0)
	local dir = d.Unit
	local side = Vector3.new(-dir.Z, 0, dir.X).Unit
	B.beam(m, P0, H0, 5.4, 0.35, { Material = Enum.Material.Rubber, Color = Color3.fromRGB(44, 44, 48) })
	for _, s in { -1, 1 } do
		B.beam(m, P0 + side * s * 2.9 + Vector3.new(0, 0.5, 0), H0 + side * s * 2.9 + Vector3.new(0, 0.5, 0), 0.25, 1.4, { Material = Enum.Material.Metal, Color = RED })
	end
	local L = d.Magnitude
	for s = 1, L - 1, 3.5 do
		local p = P0 + dir * s
		for _, k in { -1, 1 } do
			local q = p + side * k * 2.6
			B.part(m, { Size = Vector3.new(0.45, q.Y, 0.45), CFrame = CFrame.new(q.X, q.Y / 2, q.Z), Material = Enum.Material.Metal, Color = RED })
			B.part(m, { Size = Vector3.new(1.4, 0.15, 1.4), CFrame = CFrame.new(q.X, 0.1, q.Z), Material = Enum.Material.Metal, Color = STEEL })
		end
		B.beam(m, p - side * 2.6 - Vector3.new(0, p.Y * 0.5, 0), p + side * 2.6 - Vector3.new(0, p.Y * 0.5, 0), 0.3, 0.3, { Material = Enum.Material.Metal, Color = STEEL })
		B.rod(m, p - side * 2.7 - Vector3.new(0, 0.25, 0), p + side * 2.7 - Vector3.new(0, 0.25, 0), 0.45, { Material = Enum.Material.Metal, Color = STEEL, CanCollide = false })
	end
	-- paddle wheel lifting potatoes from the bin onto the belt
	local wheel = Instance.new("Model"); wheel.Name = "Wheel"; wheel.Parent = m
	local hub = B.part(wheel, { Name = "Hub", Shape = Enum.PartType.Cylinder, Size = Vector3.new(2.6, 0.7, 0.7), CFrame = CFrame.new(P0 - Vector3.new(1.2, 0.8, 0)) * CFrame.Angles(0, math.pi / 2, 0), Material = Enum.Material.Metal, Color = STEEL })
	for k = 0, 5 do
		local bl = B.part(wheel, { Size = Vector3.new(0.18, 1.8, 2.4), CFrame = hub.CFrame * CFrame.Angles(k / 6 * TAU, 0, 0) * CFrame.new(0, 1, 0), Material = Enum.Material.Metal, Color = RED, CanCollide = false })
		bl.Anchored = false; B.weld(hub, bl)
	end
	wheel.PrimaryPart = hub
	S.wheel = wheel
	return m
end

-- ---------------------------------------------------------------- the wooden bin on its deck
function S.bin(parent: Instance)
	local m = Instance.new("Model"); m.Name = "Bin"; m.Parent = parent
	local c, r = BIN.Pos, Random.new(14)
	-- deck boards with gaps on sleepers
	for k = 0, 16 do
		B.part(m, { Size = Vector3.new(16, 0.3, 0.82), CFrame = CFrame.new(c + Vector3.new(2.4 + (r:NextNumber() - 0.5) * 0.2, 0.3, -7 + k * 0.875)), Material = Enum.Material.Wood, Color = B.tint(Color3.fromRGB(168, 150, 120), r, 0.18) })
	end
	for _, dx in { -4.8, 2.4, 9.6 } do B.part(m, { Size = Vector3.new(0.6, 0.4, 15), CFrame = CFrame.new(c + Vector3.new(dx, 0.05, 0)), Material = Enum.Material.Wood, Color = WOOD_D }) end
	-- walls: horizontal boards, corner posts, top rim
	local hw, hd, h = BIN.W / 2, BIN.D / 2, BIN.H
	for k = 0, 3 do
		local y = 0.45 + h / 4 * (k + 0.5)
		for _, s in { -1, 1 } do
			B.part(m, { Size = Vector3.new(BIN.W + 0.8, h / 4 - 0.06, 0.32), CFrame = CFrame.new(c + Vector3.new(0, y, s * (hd + 0.16))), Material = Enum.Material.Wood, Color = B.tint(WOOD, r) })
			B.part(m, { Size = Vector3.new(0.32, h / 4 - 0.06, BIN.D), CFrame = CFrame.new(c + Vector3.new(s * (hw + 0.16), y, 0)), Material = Enum.Material.Wood, Color = B.tint(WOOD, r) })
		end
	end
	B.part(m, { Size = Vector3.new(BIN.W, 0.3, BIN.D), CFrame = CFrame.new(c + Vector3.new(0, 0.45 + 0.15, 0)), Material = Enum.Material.WoodPlanks, Color = WOOD_D })
	for _, sx in { -1, 1 } do for _, sz in { -1, 1 } do
		B.part(m, { Size = Vector3.new(0.5, h + 0.9, 0.5), CFrame = CFrame.new(c + Vector3.new(sx * (hw + 0.3), (h + 0.9) / 2 + 0.3, sz * (hd + 0.3))), Material = Enum.Material.Wood, Color = WOOD_D })
		for _, y in { 0.9, h - 0.2 } do
			B.part(m, { Size = Vector3.new(0.9, 0.3, 0.05), CFrame = CFrame.new(c + Vector3.new(sx * (hw + 0.05), y, sz * (hd + 0.34))), Material = Enum.Material.Metal, Color = Color3.fromRGB(52, 48, 44) })
		end
	end end
	for _, s in { -1, 1 } do
		B.part(m, { Size = Vector3.new(BIN.W + 1.4, 0.22, 0.6), CFrame = CFrame.new(c + Vector3.new(0, h + 0.55, s * (hd + 0.3))), Material = Enum.Material.Wood, Color = WOOD_D })
		B.part(m, { Size = Vector3.new(0.6, 0.22, BIN.D + 0.2), CFrame = CFrame.new(c + Vector3.new(s * (hw + 0.3), h + 0.55, 0)), Material = Enum.Material.Wood, Color = WOOD_D })
	end
	-- sign on a post
	B.part(m, { Size = Vector3.new(0.3, 5.4, 0.3), CFrame = CFrame.new(c + Vector3.new(-hw - 1.6, 2.7, -2.2)), Material = Enum.Material.Wood, Color = WOOD_D })
	local sign = B.part(m, { Size = Vector3.new(4.2, 1.6, 0.2), CFrame = CFrame.new(c + Vector3.new(-hw - 1.6, 5.4, -2.2)) * CFrame.Angles(0, math.rad(-70), 0), Material = Enum.Material.Wood, Color = Color3.fromRGB(236, 220, 186) })
	B.surfaceText(sign, Enum.NormalId.Front, "LE BAC ↓", { font = Enum.Font.PermanentMarker, color = Color3.fromRGB(107, 58, 26), ppu = 40, pad = 0.06 })
	B.surfaceText(sign, Enum.NormalId.Back, "LE BAC ↓", { font = Enum.Font.PermanentMarker, color = Color3.fromRGB(107, 58, 26), ppu = 40, pad = 0.06 })
	S.binModel = m
	return m
end

function S.inBin(p: Vector3): boolean
	local c = BIN.Pos
	return math.abs(p.X - c.X) < BIN.W / 2 + 0.2 and math.abs(p.Z - c.Z) < BIN.D / 2 + 0.2 and p.Y < BIN.H + 2.5 and p.Y > -1
end

return S
