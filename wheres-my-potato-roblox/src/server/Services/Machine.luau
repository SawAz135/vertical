--[[ Machine: bin → paddle wheel → ramp → 4-turn spiral → chute → the giant jar.
     - dumped / cannon-shot potatoes are real physics bodies in the bin (at most BIN_LIVE at
       once, the rest wait in a virtual queue so a 160-potato dump never lags)
     - the motor takes one every `feed` seconds; it rides the whole belt in `travel` seconds
       (1 s with the stock motor), is paid when it leaves the chute, then falls into the jar
     - in the jar: physics until it rests on the pile, then it is absorbed into the fill
       (rising pebble pile + a top layer of real 3D potatoes)
     - when the jar is full, newcomers bounce off the dome and spill over the rim ]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)
local Potato = require(ReplicatedStorage.Shared.Potato)
local Net = require(ReplicatedStorage.Shared.Net)
local Data = require(script.Parent.Data)
local Session = require(script.Parent.Session)
local S = require(script.Parent.Parent.World.Structures)

local M = {}
M.count = 0 -- potatoes in the jar (paid)
M.onOverflow = nil :: (() -> ())?
local J, BIN = Config.JAR, Config.BIN
local BIN_LIVE, JAR_LIVE, SPILL_LIVE = 46, 60, 120
local queue = {} -- { variety, owner } waiting outside the physics
local binParts, belt, inJar, spill = {}, {}, {}, {}
local feedT = 0
local folder = Instance.new("Folder"); folder.Name = "MachinePotatoes"; folder.Parent = workspace

local PHYS = PhysicalProperties.new(0.7, 0.55, 0.15, 1, 1)
local function body(variety: number, owner: number, pos: Vector3): BasePart
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Ball; p.Size = Vector3.new(1, 1, 1)
	p.Color = Potato.color(variety, math.random()); p.Material = Enum.Material.Sand
	p.TopSurface = Enum.SurfaceType.Smooth; p.BottomSurface = Enum.SurfaceType.Smooth
	local mesh = Instance.new("SpecialMesh"); mesh.MeshType = Enum.MeshType.Sphere; mesh.Scale = Vector3.new(1.32, 0.82, 1.0); mesh.Parent = p
	p.CustomPhysicalProperties = PHYS; p.CastShadow = false
	p:SetAttribute("v", variety); p:SetAttribute("o", owner)
	p.CFrame = CFrame.new(pos) * CFrame.Angles(math.random() * 6, math.random() * 6, math.random() * 6)
	p.Parent = folder
	pcall(function() p:SetNetworkOwner(nil) end)
	if variety == 6 then p.Material = Enum.Material.Metal; p.Reflectance = 0.15 end
	Potato.tagSkin(p, math.random())
	return p
end

local function motorLevels()
	local best = 0
	for _, pl in Players:GetPlayers() do local d = Data.get(pl); if d then best = math.max(best, d.levels.motor or 0) end end
	return { motor = best }
end
local function mult(owner: number): number
	local pl = Players:GetPlayerByUserId(owner); local d = pl and Data.get(pl)
	return if d then Config.val(d.levels, "contract", "mult") else 1
end

-- ---------------------------------------------------------------- inputs
function M.dump(p: Player, variety: number)
	table.insert(queue, { variety, p.UserId })
end
function M.shot(p: Player, variety: number, from: Vector3, vel: Vector3)
	local b = body(variety, p.UserId, from)
	b.AssemblyLinearVelocity = vel
	b:SetAttribute("shot", os.clock())
	table.insert(spill, b)
end

-- ---------------------------------------------------------------- jar fill visuals
local fillUnits = -1
function M.setFill(n: number)
	M.count = n
	local fr = math.clamp(n / J.Cap, 0, 1)
	local h = J.Base + fr * (J.Rim - 2.5 - J.Base)
	if math.abs(n - fillUnits) < 3 and fillUnits >= 0 and n < J.Cap then return end
	fillUnits = n
	local c = J.Pos
	local fill = S.fill
	if fr <= 0 then fill.Transparency = 1 else fill.Transparency = 0 end
	fill.Size = Vector3.new(math.max(0.2, h - J.Base), fill.Size.Y, fill.Size.Z)
	fill.CFrame = CFrame.new(c + Vector3.new(0, J.Base + (h - J.Base) / 2, 0)) * CFrame.Angles(0, 0, math.pi / 2)
	local dome = math.clamp((n / J.Cap - 0.85) / 0.15, 0, 1) * 5
	local parts, cfs = {}, {}
	for _, pt in S.fillTop:GetChildren() do
		local rx, rz, ry = pt:GetAttribute("rx"), pt:GetAttribute("rz"), pt:GetAttribute("ry")
		local d2 = (rx * rx + rz * rz) / (J.R * J.R)
		local y = if fr <= 0 then -50 else h + 0.25 + dome * math.max(0, 1 - d2)
		table.insert(parts, pt); table.insert(cfs, CFrame.new(c + Vector3.new(rx, y, rz)) * CFrame.Angles(0.2, ry, 0.15))
	end
	workspace:BulkMoveTo(parts, cfs, Enum.BulkMoveMode.FireCFrameChanged)
	local digits = tostring(n):reverse():gsub("(%d%d%d)", "%1 "):reverse()
	S.countLabel.Text = (digits:gsub("^ ", "")) .. " patates dans le bocal"
	S.fillTopY = h + dome
end

-- ---------------------------------------------------------------- loop
local function pay(b: BasePart)
	local v, owner = b:GetAttribute("v") :: number, b:GetAttribute("o") :: number
	local value = math.floor(Potato.price(v) * mult(owner) * 10 + 0.5) / 10
	local pl = Players:GetPlayerByUserId(owner)
	local d = pl and Data.get(pl)
	if d and pl then
		d.money += value; d.stats.earned += value
		Net.event("Pay"):FireClient(pl, value, b.Position, v)
	end
	M.setFill(M.count + 1)
	local od = Players:GetPlayerByUserId(Session.ownerId)
	local odd = od and Data.get(od)
	if odd then odd.jar = M.count end
	if M.count == J.Cap and M.onOverflow then M.onOverflow() end
end

local t = 0
RunService.Heartbeat:Connect(function(dt)
	t += dt
	-- virtual queue → physics in the bin
	while #queue > 0 and #binParts < BIN_LIVE do
		local q = table.remove(queue, 1)
		local pos = BIN.Pos + Vector3.new((math.random() - 0.5) * (BIN.W - 1.4), BIN.H + 2 + math.random() * 1.5, (math.random() - 0.5) * (BIN.D - 1.4))
		local b = body(q[1], q[2], pos); b.AssemblyLinearVelocity = Vector3.new(0, -6, 0)
		table.insert(binParts, b)
	end
	-- feed the belt
	local L = motorLevels()
	local feed, travel = Config.val(L, "motor", "feed"), Config.val(L, "motor", "travel")
	feedT += dt
	if S.wheel and S.wheel.PrimaryPart then S.wheel:PivotTo(S.wheel:GetPivot() * CFrame.Angles(dt * (if #binParts > 0 then 6 else 0.6), 0, 0)) end
	if feedT >= feed and #binParts > 0 then
		feedT = 0
		local best, bi = nil, 0
		for i, b in binParts do
			if b.Parent and S.inBin(b.Position) then best, bi = b, i; break end
		end
		if best then
			table.remove(binParts, bi)
			best.Anchored = true; best.CanCollide = false
			table.insert(belt, { b = best, s = 0, lat = (math.random() - 0.5) * 1.6, spin = math.random() * 6 })
		end
	elseif #binParts == 0 then feedT = math.min(feedT, feed) end
	-- ride the belt (whole path in `travel` seconds)
	local speed = S.PathLength / travel
	for i = #belt, 1, -1 do
		local e = belt[i]
		e.s += speed * dt; e.spin += dt * 9
		if e.s >= S.PathLength then
			table.remove(belt, i)
			local b = e.b
			b.CFrame = CFrame.new(S.ChuteEnd + Vector3.new(0, 1, 0)); b.Anchored = false; b.CanCollide = true
			b.AssemblyLinearVelocity = Vector3.new((math.random() - 0.5) * 6, -4, 5 + math.random() * 4)
			pcall(function() b:SetNetworkOwner(nil) end)
			pay(b)
			b:SetAttribute("jarT", os.clock())
			table.insert(inJar, b)
		else
			e.b.CFrame = CFrame.new(S.pathPos(e.s, e.lat)) * CFrame.Angles(e.spin, e.spin * 0.6, 0)
		end
	end
	-- in the jar: absorb resting ones (or the oldest if too many); overflow spills
	local full = M.count >= J.Cap
	for i = #inJar, 1, -1 do
		local b = inJar[i]
		if not b.Parent then table.remove(inJar, i); continue end
		local age = os.clock() - (b:GetAttribute("jarT") or 0)
		local resting = b.AssemblyLinearVelocity.Magnitude < 1.5 and age > 0.8
		if full and b.Position.Y > (S.fillTopY or 0) - 1 and age > 0.4 and not b:GetAttribute("pushed") then
			-- the dome throws it over the rim
			local out = Vector3.new(b.Position.X - J.Pos.X, 0, b.Position.Z - J.Pos.Z)
			if out.Magnitude < 0.1 then out = Vector3.new(1, 0, 0) end
			b.AssemblyLinearVelocity = out.Unit * 22 + Vector3.new(0, 26, 0)
			b:SetAttribute("pushed", true); table.remove(inJar, i); table.insert(spill, b); b:SetAttribute("shot", os.clock())
		elseif not full and (resting or age > 4 or #inJar > JAR_LIVE) then
			b:Destroy(); table.remove(inJar, i)
		end
	end
	-- spills / cannon shots: into the bin if they land there, otherwise vanish after a while
	if math.floor(t * 4) ~= math.floor((t - dt) * 4) then
		for i = #spill, 1, -1 do
			local b = spill[i]
			if not b.Parent then table.remove(spill, i); continue end
			local age = os.clock() - (b:GetAttribute("shot") or 0)
			if S.inBin(b.Position) and b.AssemblyLinearVelocity.Magnitude < 8 then
				table.remove(spill, i); table.insert(binParts, b)
			elseif age > 25 or #spill > SPILL_LIVE then
				b:Destroy(); table.remove(spill, i)
			end
		end
	end
	-- beacon blink
	if S.beacon then S.beacon.Material = if (t * 2) % 1 < 0.5 then Enum.Material.Neon else Enum.Material.SmoothPlastic end
end)

return M
