--[[ Viewmodel: your two arms in first person (plaid sleeves, rolled cuffs, real hands with
     curling fingers, work gloves once bought) and the tools: the dented bucket filled with
     the potatoes you carry, the vacuum with its spinning intake, the brass potato cannon.
     Poses blend with critically damped springs: walk bob, look lag, reach / scoop / dump /
     recoil animations, cupped hands holding the potatoes you carry, holding the book. ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")
local Potato = require(ReplicatedStorage.Shared.Potato)
local State = require(script.Parent.State)

local VM = {}
local cam = workspace.CurrentCamera
local model = Instance.new("Model"); model.Name = "Viewmodel"
local parts: { BasePart } = {}
local SKIN = Color3.fromRGB(226, 168, 128)
local GLOVE = Color3.fromRGB(150, 100, 52)
local SLEEVE = Color3.fromRGB(64, 96, 150)

local function mk(size: Vector3, color: Color3, mat: Enum.Material?, shape: string?): BasePart
	local p = Instance.new("Part"); p.Anchored = true; p.CanCollide = false; p.CanQuery = false; p.CanTouch = false; p.CastShadow = false
	p.Size = size; p.Color = color; p.Material = mat or Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth; p.BottomSurface = Enum.SurfaceType.Smooth
	if shape == "ball" then local m = Instance.new("SpecialMesh"); m.MeshType = Enum.MeshType.Sphere; m.Parent = p
	elseif shape == "cyl" then p.Shape = Enum.PartType.Cylinder end
	p.Parent = model; table.insert(parts, p)
	return p
end

-- ---------------------------------------------------------------- arms
local arms = {}
for _, s in { -1, 1 } do
	local a = { side = s }
	a.sleeve = mk(Vector3.new(1.6, 0.42, 0.42), SLEEVE, Enum.Material.Fabric, "cyl")
	a.cuff = mk(Vector3.new(0.18, 0.46, 0.46), Color3.fromRGB(52, 80, 128), Enum.Material.Fabric, "cyl")
	a.fore = mk(Vector3.new(0.9, 0.3, 0.3), SKIN, Enum.Material.SmoothPlastic, "cyl")
	a.palm = mk(Vector3.new(0.36, 0.17, 0.42), SKIN, Enum.Material.SmoothPlastic, "ball")
	a.fingers = {}
	for f = 1, 4 do
		a.fingers[f] = { mk(Vector3.new(0.085, 0.085, 0.17), SKIN, nil, "ball"), mk(Vector3.new(0.078, 0.078, 0.15), SKIN, nil, "ball") }
	end
	a.thumb = { mk(Vector3.new(0.1, 0.1, 0.18), SKIN, nil, "ball"), mk(Vector3.new(0.09, 0.09, 0.14), SKIN, nil, "ball") }
	a.pos = Vector3.new(s * 0.9, -2.4, -1.2); a.vel = Vector3.zero
	a.target = a.pos; a.curl = 0.3; a.curlT = 0.3; a.rot = CFrame.new()
	arms[s] = a
end

-- ---------------------------------------------------------------- tools
local bucket = {
	body = mk(Vector3.new(0.95, 1.05, 1.05), Color3.fromRGB(150, 156, 160), Enum.Material.DiamondPlate, "cyl"),
	rim = mk(Vector3.new(0.08, 1.18, 1.18), Color3.fromRGB(176, 180, 184), Enum.Material.Metal, "cyl"),
	handle = mk(Vector3.new(0.06, 1.2, 0.06), Color3.fromRGB(120, 124, 128), Enum.Material.Metal),
	grip = mk(Vector3.new(0.38, 0.13, 0.13), Color3.fromRGB(90, 60, 34), Enum.Material.Wood, "cyl"),
	pile = {},
}
for k = 1, 14 do bucket.pile[k] = mk(Vector3.new(0.34, 0.22, 0.26), Potato.color(if k % 3 == 0 then 2 else 1, k / 14), Enum.Material.Sand, "ball") end
local vac = {
	body = mk(Vector3.new(0.8, 0.62, 0.62), Color3.fromRGB(255, 184, 28), Enum.Material.SmoothPlastic, "cyl"),
	tube = mk(Vector3.new(1.7, 0.3, 0.3), Color3.fromRGB(255, 184, 28), Enum.Material.SmoothPlastic, "cyl"),
	mouth = mk(Vector3.new(0.2, 0.62, 0.62), Color3.fromRGB(34, 36, 40), Enum.Material.Metal, "cyl"),
	ring = mk(Vector3.new(0.06, 0.66, 0.66), Color3.fromRGB(60, 255, 240), Enum.Material.Neon, "cyl"),
	tank = mk(Vector3.new(0.7, 0.6, 0.6), Color3.fromRGB(210, 240, 255), Enum.Material.Glass, "cyl"),
	grip = mk(Vector3.new(0.18, 0.5, 0.2), Color3.fromRGB(40, 40, 44), Enum.Material.SmoothPlastic),
}
vac.tank.Transparency = 0.55
local can = {
	barrel = mk(Vector3.new(2.0, 0.42, 0.42), Color3.fromRGB(70, 80, 92), Enum.Material.Metal, "cyl"),
	band1 = mk(Vector3.new(0.1, 0.5, 0.5), Color3.fromRGB(198, 160, 70), Enum.Material.Metal, "cyl"),
	band2 = mk(Vector3.new(0.1, 0.5, 0.5), Color3.fromRGB(198, 160, 70), Enum.Material.Metal, "cyl"),
	chamber = mk(Vector3.new(0.75, 0.6, 0.6), Color3.fromRGB(70, 80, 92), Enum.Material.Metal, "ball"),
	tank = mk(Vector3.new(1.1, 0.3, 0.3), Color3.fromRGB(212, 38, 28), Enum.Material.SmoothPlastic, "cyl"),
	stock = mk(Vector3.new(0.22, 0.38, 0.9), Color3.fromRGB(96, 60, 32), Enum.Material.Wood),
}
local held = {}
for k = 1, 8 do held[k] = mk(Vector3.new(0.4, 0.26, 0.3), Potato.color(if k % 3 == 0 then 2 else 1, k / 8), Enum.Material.Sand, "ball") end

-- ---------------------------------------------------------------- animation state
VM.anim = { reach = 0, scoop = 0, dump = 0, recoil = 0, swap = 0 }
VM.override = nil :: ((number, any) -> (Vector3, CFrame, number))? -- (side, arm) → wrist pos, rot, curl (book)
VM.sucking = false
local bob, t = 0, 0
local lastLook = cam.CFrame.LookVector
local lag = Vector2.zero

local HIDE = CFrame.new(0, -1000, 0)
local function springStep(a, dt)
	local k, d = 160, 2 * math.sqrt(160)
	local acc = (a.target - a.pos) * k - a.vel * d
	a.vel += acc * dt; a.pos += a.vel * dt
end

function VM.carried(): (number, number)
	local d = State.data
	local c = d and d.carry
	if not c then return 0, 0 end
	if State.tool == "bucket" then return c.bucket, c.capBucket end
	if State.tool == "vacuum" then return c.tank, c.capTank end
	return c.hands, c.capHands
end

-- the hand (world) where flying potatoes should land
function VM.handPoint(): Vector3
	local cf = cam.CFrame
	if State.tool == "bucket" then return (cf * CFrame.new(0.75, -1.3, -1.7)).Position end
	if State.tool == "vacuum" then return (cf * CFrame.new(0.7, -0.75, -1.4)).Position end
	return (cf * CFrame.new(0, -1.0, -1.5)).Position
end

local function place(list, cfs, p: BasePart, cf: CFrame) table.insert(list, p); table.insert(cfs, cf) end

function VM.start()
	model.Parent = cam
	RunService:BindToRenderStep("WMP_Viewmodel", Enum.RenderPriority.Camera.Value + 5, function(dt)
		dt = math.min(dt, 0.05); t += dt
		local cf = cam.CFrame
		local visible = State.mode == "play" or State.mode == "book" or State.mode == "shop"
		if not visible then
			local cfs = table.create(#parts, HIDE); workspace:BulkMoveTo(parts, cfs, Enum.BulkMoveMode.FireCFrameChanged); return
		end
		for k, v in VM.anim do VM.anim[k] = math.max(0, v - dt * (if k == "dump" then 4 else 3)) end
		local char = Players.LocalPlayer.Character
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		local speed = if hum and hum.MoveDirection.Magnitude > 0.1 then hum.WalkSpeed else 0
		bob += dt * speed * 0.55
		local bx, by = math.sin(bob) * 0.05 * math.min(1, speed / 16), math.abs(math.cos(bob)) * 0.05 * math.min(1, speed / 16)
		local look = cf.LookVector
		local dl = cf:VectorToObjectSpace(look - lastLook); lastLook = look
		lag = lag:Lerp(Vector2.new(-dl.X, -dl.Y) * 6, math.min(1, dt * 10))
		local lx, ly = math.clamp(lag.X, -0.25, 0.25), math.clamp(lag.Y, -0.25, 0.25)
		local A = VM.anim
		local n, capN = VM.carried()
		local tool = State.tool
		local list, cfs = {}, {}
		-- arm targets per tool (camera space)
		for s, a in arms do
			local tgt, rot, curl
			if VM.override then
				tgt, rot, curl = VM.override(s, a)
			elseif tool == "bucket" then
				if s == 1 then tgt = Vector3.new(0.78, -0.75 - A.scoop * 0.35 + A.dump * 0.3, -1.65 - A.scoop * 0.4); rot = CFrame.Angles(0.2, 0, math.pi / 2); curl = 0.9
				else tgt = Vector3.new(-0.95, -2.2, -1.0); rot = CFrame.Angles(-0.4, 0, 0); curl = 0.3 end
			elseif tool == "vacuum" or tool == "cannon" then
				if s == 1 then tgt = Vector3.new(0.72, -0.98, -1.25); rot = CFrame.Angles(0.5, 0, 1.3); curl = 0.95
				else tgt = Vector3.new(0.05, -0.92, -2.2); rot = CFrame.Angles(-0.1, 0, -0.5); curl = 0.75 end
			elseif n > 0 then -- cupped hands holding the potatoes
				tgt = Vector3.new(s * 0.27, -0.98 + A.dump * 0.3, -1.45 - A.dump * 0.2); rot = CFrame.Angles(0.15, s * -0.3, s * 0.45); curl = 0.35
			else
				tgt = Vector3.new(s * 0.85, -1.95, -1.1); rot = CFrame.Angles(-0.6, s * 0.2, s * 0.1); curl = 0.3
				if s == 1 and A.reach > 0 then local r = math.sin(A.reach * math.pi); tgt = tgt:Lerp(Vector3.new(0.35, -1.3, -2.3), r); curl = 0.3 - r * 0.25 end
			end
			a.target = tgt + Vector3.new(bx + lx, by + ly - math.sin(A.swap * math.pi) * 0.8, 0)
			springStep(a, dt)
			a.curl += (curl - a.curl) * math.min(1, dt * 12)
			a.rot = a.rot:Lerp(rot, math.min(1, dt * 12))
			-- hand
			local hand = cf * CFrame.new(a.pos) * a.rot
			local wristC = cf * CFrame.new(a.pos) * a.rot * CFrame.new(0, 0, 0.32)
			local shoulder = cf * CFrame.new(s * 1.25, -2.6, 0.6)
			local elbow = shoulder.Position:Lerp(wristC.Position, 0.5) + cf.UpVector * -0.35 + cf.RightVector * s * 0.25
			local function between(p0: Vector3, p1: Vector3) return CFrame.lookAt((p0 + p1) / 2, p1) * CFrame.Angles(0, math.pi / 2, 0), (p1 - p0).Magnitude end
			local scf, slen = between(shoulder.Position, elbow)
			a.sleeve.Size = Vector3.new(slen + 0.2, 0.44, 0.44); place(list, cfs, a.sleeve, scf)
			local fcf, flen = between(elbow, wristC.Position)
			a.fore.Size = Vector3.new(flen + 0.1, 0.29, 0.29); place(list, cfs, a.fore, fcf)
			place(list, cfs, a.cuff, CFrame.lookAt(elbow:Lerp(wristC.Position, 0.12), wristC.Position) * CFrame.Angles(0, math.pi / 2, 0))
			place(list, cfs, a.palm, hand)
			local gl = State.data and State.data.levels and (State.data.levels.gloves or 0) > 0
			local col = if gl then GLOVE else SKIN
			if a.palm.Color ~= col then
				for _, p in { a.palm, a.thumb[1], a.thumb[2] } do p.Color = col end
				for _, f in a.fingers do f[1].Color = col; f[2].Color = col end
			end
			for f = 1, 4 do
				local base = hand * CFrame.new(-0.13 + (f - 1) * 0.087, 0.01, -0.22) * CFrame.Angles(-a.curl * 1.3, 0, 0)
				place(list, cfs, a.fingers[f][1], base * CFrame.new(0, 0, -0.07))
				local tip = base * CFrame.new(0, 0, -0.15) * CFrame.Angles(-a.curl * 1.5, 0, 0)
				place(list, cfs, a.fingers[f][2], tip * CFrame.new(0, 0, -0.06))
			end
			local tb = hand * CFrame.new(-s * 0.19, -0.02, -0.06) * CFrame.Angles(-0.3 - a.curl * 0.5, -s * 0.7, -s * 0.6)
			place(list, cfs, a.thumb[1], tb * CFrame.new(0, 0, -0.07))
			place(list, cfs, a.thumb[2], tb * CFrame.new(0, 0, -0.16) * CFrame.Angles(-a.curl * 0.8, 0, 0) * CFrame.new(0, 0, -0.04))
		end
		-- tools
		local R = arms[1]
		local rh = cf * CFrame.new(R.pos)
		if tool == "bucket" and not VM.override then
			local bcf = rh * CFrame.new(0, -0.7, 0.05) * CFrame.Angles(0.35 - A.scoop * 0.8 - A.dump * 1.2, 0.3, 0)
			place(list, cfs, bucket.body, bcf * CFrame.Angles(0, 0, math.pi / 2))
			place(list, cfs, bucket.rim, bcf * CFrame.new(0, 0.5, 0) * CFrame.Angles(0, 0, math.pi / 2))
			place(list, cfs, bucket.handle, bcf * CFrame.new(0, 0.62, 0) * CFrame.Angles(0, 0, math.pi / 2) * CFrame.new(0, 0, 0))
			place(list, cfs, bucket.grip, rh * CFrame.new(0, 0, 0) * CFrame.Angles(0, 0, 0))
			local fillN = math.ceil(math.clamp(n / math.max(1, capN), 0, 1) * #bucket.pile)
			for k, p in bucket.pile do
				if k <= fillN then
					local a = k * 2.39996; local r = 0.32 * math.sqrt(k / #bucket.pile)
					place(list, cfs, p, bcf * CFrame.new(math.cos(a) * r, 0.25 + (k / #bucket.pile) * 0.2, math.sin(a) * r) * CFrame.Angles(k, k * 2, 0))
				else place(list, cfs, p, HIDE) end
			end
		else
			for _, p in { bucket.body, bucket.rim, bucket.handle, bucket.grip } do place(list, cfs, p, HIDE) end
			for _, p in bucket.pile do place(list, cfs, p, HIDE) end
		end
		if tool == "vacuum" and not VM.override then
			local shake = if VM.sucking then CFrame.new((math.random() - 0.5) * 0.02, (math.random() - 0.5) * 0.02, 0) else CFrame.new()
			local vcf = cf * CFrame.new(0.62 + bx + lx, -0.78 + by + ly, -1.6) * CFrame.Angles(0.04, 0.12, 0) * shake
			place(list, cfs, vac.body, vcf * CFrame.new(0, 0, 0.3) * CFrame.Angles(0, math.pi / 2, 0))
			place(list, cfs, vac.tank, vcf * CFrame.new(0, 0.48, 0.25) * CFrame.Angles(0, math.pi / 2, 0))
			place(list, cfs, vac.tube, vcf * CFrame.new(0, 0, -0.9) * CFrame.Angles(0, math.pi / 2, 0))
			place(list, cfs, vac.mouth, vcf * CFrame.new(0, 0, -1.8) * CFrame.Angles(0, math.pi / 2, 0))
			place(list, cfs, vac.ring, vcf * CFrame.new(0, 0, -1.92) * CFrame.Angles(t * (if VM.sucking then 30 else 2), math.pi / 2, 0))
			place(list, cfs, vac.grip, vcf * CFrame.new(0, -0.35, 0.35) * CFrame.Angles(0.3, 0, 0))
		else for _, p in vac do place(list, cfs, p, HIDE) end end
		if tool == "cannon" and not VM.override then
			local r = A.recoil
			local ccf = cf * CFrame.new(0.55 + bx + lx, -0.82 + by + ly + r * 0.08, -1.7 + r * 0.35) * CFrame.Angles(0.05 + r * 0.25, 0.1, 0)
			place(list, cfs, can.barrel, ccf * CFrame.new(0, 0, -0.6) * CFrame.Angles(0, math.pi / 2, 0))
			place(list, cfs, can.band1, ccf * CFrame.new(0, 0, -1.5) * CFrame.Angles(0, math.pi / 2, 0))
			place(list, cfs, can.band2, ccf * CFrame.new(0, 0, -0.3) * CFrame.Angles(0, math.pi / 2, 0))
			place(list, cfs, can.chamber, ccf * CFrame.new(0, 0, 0.45))
			place(list, cfs, can.tank, ccf * CFrame.new(0, -0.36, -0.4) * CFrame.Angles(0, math.pi / 2, 0))
			place(list, cfs, can.stock, ccf * CFrame.new(0, -0.15, 1.0) * CFrame.Angles(0.12, 0, 0))
		else for _, p in can do place(list, cfs, p, HIDE) end end
		-- potatoes held in cupped hands
		local showHeld = tool == "hands" and not VM.override
		for k, p in held do
			if showHeld and k <= n then
				local a = k * 2.39996; local r = 0.14 * math.sqrt(k)
				place(list, cfs, p, cf * CFrame.new(math.cos(a) * r * 1.3 + bx + lx, -0.86 + (k > 4 and 0.14 or 0) + by + ly, -1.48 + math.sin(a) * r * 0.6) * CFrame.Angles(k, k * 1.7, 0))
			else place(list, cfs, p, HIDE) end
		end
		workspace:BulkMoveTo(list, cfs, Enum.BulkMoveMode.FireCFrameChanged)
	end)
end

function VM.arm(side: number) return arms[side] end
return VM
