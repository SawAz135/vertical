--[[
	Roblox Forge - map gameplay (server, ServerScriptService).
	Runs the pieces placed in Forge Map Studio. Every piece is a part with the
	attribute ForgeRole (and Forge<Param> attributes), inside a folder with the
	attribute ForgeMap = true. You can add the same attributes to your own parts.

	  kill        touching it kills
	  checkpoint  ForgeStage: respawn point, leaderstats.Stage
	  jumppad     ForgePower: launches up (along the cylinder axis for cylinders)
	  conveyor    ForgeSpeed: pushes along the part's front (LookVector)
	  mover       ForgeDx/Dy/Dz, ForgePeriod: moving platform that carries players
	  spinner     ForgeSpeed (deg/s): spinning bar on a motor
	  teleporter  ForgePair: sends to the other pad with the same code
	  coin        ForgeValue, ForgeStat, ForgeRespawn: collectible
	  gate        ForgeStat, ForgeNeed: opens per player (see ForgeMap.client)
	  claim / dropper / upgrader / collector / buybutton: tycoon (inside a Model with ForgeTycoon)
]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ServerStorage = game:GetService("ServerStorage")
local Lighting = game:GetService("Lighting")
local Debris = game:GetService("Debris")

local maps = {}
for _, d in workspace:GetDescendants() do
	if d:GetAttribute("ForgeMap") then table.insert(maps, d) end
end
if #maps == 0 then return end

-- lighting saved by the studio --------------------------------------------
do
	local m = maps[1]
	local function hex(name)
		local v = m:GetAttribute(name)
		local ok, c = pcall(Color3.fromHex, v or "")
		return ok and c or nil
	end
	if m:GetAttribute("ForgeClockTime") then Lighting.ClockTime = m:GetAttribute("ForgeClockTime") end
	if m:GetAttribute("ForgeBrightness") then Lighting.Brightness = m:GetAttribute("ForgeBrightness") end
	Lighting.Ambient = hex("ForgeAmbient") or Lighting.Ambient
	Lighting.OutdoorAmbient = hex("ForgeOutdoorAmbient") or Lighting.OutdoorAmbient
end

-- pieces --------------------------------------------------------------------
local pieces, usedStats = {}, {}
for _, m in maps do
	for _, d in m:GetDescendants() do
		if d:IsA("BasePart") and d:GetAttribute("ForgeRole") then table.insert(pieces, d) end
	end
end
for _, p in pieces do
	local r = p:GetAttribute("ForgeRole")
	if r == "checkpoint" then usedStats.Stage = true end
	if r == "coin" or r == "gate" or r == "collector" or r == "buybutton" then usedStats[p:GetAttribute("ForgeStat") or (r == "collector" or r == "buybutton") and "Cash" or "Coins"] = true end
end

local function statOf(player, name)
	local ls = player:FindFirstChild("leaderstats")
	if not ls then
		ls = Instance.new("Folder")
		ls.Name = "leaderstats"
		ls.Parent = player
	end
	local v = ls:FindFirstChild(name)
	if not v then
		v = Instance.new("IntValue")
		v.Name = name
		v.Parent = ls
	end
	return v
end

local function playerFrom(hit)
	local char = hit and hit:FindFirstAncestorOfClass("Model")
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not hum or hum.Health <= 0 then return nil end
	return Players:GetPlayerFromCharacter(char), char, hum
end

local function label(part, text, color)
	local gui = part:FindFirstChild("ForgeLabelGui")
	if not gui then
		gui = Instance.new("BillboardGui")
		gui.Name = "ForgeLabelGui"
		gui.Size = UDim2.fromOffset(220, 46)
		gui.StudsOffsetWorldSpace = Vector3.new(0, part.Size.Y / 2 + 3, 0)
		gui.AlwaysOnTop = false
		gui.MaxDistance = 140
		local t = Instance.new("TextLabel")
		t.Name = "Text"
		t.Size = UDim2.fromScale(1, 1)
		t.BackgroundTransparency = 1
		t.TextScaled = true
		t.Font = Enum.Font.GothamBlack
		t.TextColor3 = Color3.new(1, 1, 1)
		t.TextStrokeTransparency = 0.3
		t.Parent = gui
		gui.Parent = part
	end
	gui.Text.Text = text
	if color then gui.Text.TextColor3 = color end
	return gui
end

local function upAxis(p)
	if p:IsA("Part") and p.Shape == Enum.PartType.Cylinder then return p.CFrame.RightVector end
	return p.CFrame.UpVector
end

local checkpoints, cooldown = {}, {}
local function cool(key, t)
	local now = os.clock()
	if cooldown[key] and now < cooldown[key] then return false end
	cooldown[key] = now + t
	return true
end

-- tycoons --------------------------------------------------------------------
local tycoons = {}
local function tycoonOf(p)
	local x = p.Parent
	while x and x ~= workspace do
		if x:GetAttribute("ForgeTycoon") then return x end
		x = x.Parent
	end
	return nil
end
local storage = ServerStorage:FindFirstChild("ForgeTycoonStorage") or Instance.new("Folder")
storage.Name = "ForgeTycoonStorage"
storage.Parent = ServerStorage

local function ownerOf(t) return t and Players:GetPlayerByUserId(t:GetAttribute("ForgeOwner") or 0) end

local function setupTycoon(t)
	if tycoons[t] then return tycoons[t] end
	local st = { model = t, buttons = {}, drops = 0 }
	tycoons[t] = st
	return st
end

local function resetTycoon(t)
	local st = setupTycoon(t)
	t:SetAttribute("ForgeOwner", nil)
	for _, b in st.buttons do
		if b.target then b.target.Parent = storage end
		b.part.Transparency = b.baseT
		b.part.CanTouch = true
		label(b.part, "🛒 " .. b.name .. " · " .. b.price .. " " .. b.stat)
	end
	for _, p in t:GetDescendants() do
		if p:GetAttribute("ForgeRole") == "claim" then label(p, "🏳️ Réclamer ce tycoon", Color3.fromRGB(120, 255, 160)) end
	end
end

-- wiring -------------------------------------------------------------------
local movers, upgraderIds = {}, 0
for _, p in pieces do
	local r = p:GetAttribute("ForgeRole")
	if p:GetAttribute("ForgeLabel") then label(p, p:GetAttribute("ForgeLabel")) end
	if r == "kill" then
		local follow = p:GetAttribute("ForgeFollow")
		local target = follow and p.Parent:FindFirstChild(follow)
		if target then
			p.Anchored = false
			p.Massless = true
			local w = Instance.new("WeldConstraint")
			w.Part0, w.Part1 = target, p
			w.Parent = p
		end
		p.Touched:Connect(function(hit)
			local _, _, hum = playerFrom(hit)
			if hum then hum.Health = 0 end
		end)
	elseif r == "checkpoint" then
		p.Touched:Connect(function(hit)
			local player = playerFrom(hit)
			if not player then return end
			local stage = p:GetAttribute("ForgeStage") or 1
			local s = statOf(player, "Stage")
			if stage >= s.Value then
				if stage > s.Value then
					local c = p.Color
					p.Color = Color3.fromRGB(255, 255, 255)
					task.delay(0.15, function() p.Color = c end)
				end
				s.Value = stage
				checkpoints[player] = p
			end
		end)
	elseif r == "jumppad" then
		p.Touched:Connect(function(hit)
			local _, char = playerFrom(hit)
			local hrp = char and char:FindFirstChild("HumanoidRootPart")
			if hrp and cool(char, 0.4) then hrp.AssemblyLinearVelocity = upAxis(p) * (p:GetAttribute("ForgePower") or 90) end
		end)
	elseif r == "conveyor" then
		p.Anchored = true
		p.AssemblyLinearVelocity = p.CFrame.LookVector * (p:GetAttribute("ForgeSpeed") or 16)
	elseif r == "mover" then
		local origin = p.CFrame
		p.Anchored = false
		local a = Instance.new("Attachment")
		a.Parent = p
		local ap = Instance.new("AlignPosition")
		ap.Mode = Enum.PositionAlignmentMode.OneAttachment
		ap.Attachment0 = a
		ap.MaxForce = math.huge
		ap.MaxVelocity = math.huge
		ap.Responsiveness = 60
		ap.Position = origin.Position
		ap.Parent = p
		local ao = Instance.new("AlignOrientation")
		ao.Mode = Enum.OrientationAlignmentMode.OneAttachment
		ao.Attachment0 = a
		ao.RigidityEnabled = true
		ao.CFrame = origin.Rotation
		ao.Parent = p
		pcall(function() p:SetNetworkOwner(nil) end)
		table.insert(movers, { align = ap, origin = origin.Position, off = Vector3.new(p:GetAttribute("ForgeDx") or 0, p:GetAttribute("ForgeDy") or 0, p:GetAttribute("ForgeDz") or 0), period = p:GetAttribute("ForgePeriod") or 4 })
	elseif r == "spinner" then
		local base = Instance.new("Part")
		base.Name = "ForgeSpinnerBase"
		base.Anchored = true
		base.CanCollide = false
		base.Transparency = 1
		base.Size = Vector3.one
		base.CFrame = CFrame.new(p.Position)
		base.Parent = p.Parent
		local up = CFrame.new(p.Position) * CFrame.Angles(0, 0, math.rad(90)) -- hinge axis (X) pointing up
		local a0, a1 = Instance.new("Attachment"), Instance.new("Attachment")
		a0.CFrame = base.CFrame:ToObjectSpace(up)
		a1.CFrame = p.CFrame:ToObjectSpace(up)
		a0.Parent, a1.Parent = base, p
		local h = Instance.new("HingeConstraint")
		h.Attachment0, h.Attachment1 = a0, a1
		h.ActuatorType = Enum.ActuatorType.Motor
		h.AngularVelocity = math.rad(p:GetAttribute("ForgeSpeed") or 120)
		h.MotorMaxTorque = math.huge
		h.MotorMaxAcceleration = math.huge
		h.Parent = p
		p.Anchored = false
		pcall(function() p:SetNetworkOwner(nil) end)
	elseif r == "teleporter" then
		p.Touched:Connect(function(hit)
			local _, char = playerFrom(hit)
			if not char or not cool(char, 1.5) then return end
			for _, q in pieces do
				if q ~= p and q:GetAttribute("ForgeRole") == "teleporter" and q:GetAttribute("ForgePair") == p:GetAttribute("ForgePair") then
					cooldown[char] = os.clock() + 1.5
					char:PivotTo(CFrame.new(q.Position + Vector3.new(0, 5, 0)) * char:GetPivot().Rotation)
					break
				end
			end
		end)
	elseif r == "coin" then
		local baseT = p.Transparency
		p.Touched:Connect(function(hit)
			local player = playerFrom(hit)
			if not player or not p.CanTouch then return end
			p.CanTouch = false
			p.Transparency = 1
			local s = statOf(player, p:GetAttribute("ForgeStat") or "Coins")
			s.Value += p:GetAttribute("ForgeValue") or 1
			local snd = Instance.new("Sound")
			snd.SoundId = "rbxasset://sounds/electronicpingshort.wav"
			snd.Volume = 0.5
			snd.Parent = p
			snd:Play()
			Debris:AddItem(snd, 2)
			task.delay(p:GetAttribute("ForgeRespawn") or 8, function()
				p.Transparency = baseT
				p.CanTouch = true
			end)
		end)
	elseif r == "gate" then
		label(p, "🔒 " .. (p:GetAttribute("ForgeNeed") or 0) .. " " .. (p:GetAttribute("ForgeStat") or "Coins"))
	elseif r == "claim" then
		local t = tycoonOf(p)
		if t then
			setupTycoon(t)
			p.Touched:Connect(function(hit)
				local player = playerFrom(hit)
				if not player or t:GetAttribute("ForgeOwner") then return end
				for other in tycoons do
					if other:GetAttribute("ForgeOwner") == player.UserId then return end
				end
				t:SetAttribute("ForgeOwner", player.UserId)
				statOf(player, "Cash")
				label(p, "🏭 Tycoon de " .. player.DisplayName, Color3.fromRGB(255, 220, 90))
			end)
		end
	elseif r == "buybutton" then
		local t = tycoonOf(p)
		if t then
			local st = setupTycoon(t)
			local name = p:GetAttribute("ForgeTarget") or ""
			local target = t:FindFirstChild(name, true)
			local b = { part = p, name = name, price = p:GetAttribute("ForgePrice") or 100, stat = p:GetAttribute("ForgeStat") or "Cash", target = target, baseT = p.Transparency }
			table.insert(st.buttons, b)
			p.Touched:Connect(function(hit)
				local player = playerFrom(hit)
				if not player or player ~= ownerOf(t) or not p.CanTouch or not cool(p, 0.5) then return end
				local s = statOf(player, b.stat)
				if s.Value < b.price then
					label(p, "❌ Il faut " .. b.price .. " " .. b.stat, Color3.fromRGB(255, 90, 110))
					task.delay(1.2, function() if p.CanTouch then label(p, "🛒 " .. b.name .. " · " .. b.price .. " " .. b.stat, Color3.new(1, 1, 1)) end end)
					return
				end
				s.Value -= b.price
				if b.target then b.target.Parent = t end
				p.Transparency = 1
				p.CanTouch = false
				label(p, "")
			end)
		end
	elseif r == "upgrader" then
		upgraderIds += 1
		local key = "ForgeUp" .. upgraderIds
		p.Touched:Connect(function(hit)
			local v = hit:GetAttribute("ForgeValue")
			if v and not hit:GetAttribute(key) then
				hit:SetAttribute(key, true)
				hit:SetAttribute("ForgeValue", v * (p:GetAttribute("ForgeMult") or 2))
				hit.Material = Enum.Material.Neon
			end
		end)
	elseif r == "collector" then
		local t = tycoonOf(p)
		p.Touched:Connect(function(hit)
			local v = hit:GetAttribute("ForgeValue")
			if not v then return end
			hit:SetAttribute("ForgeValue", nil)
			hit:Destroy()
			local owner = ownerOf(t)
			if owner then statOf(owner, p:GetAttribute("ForgeStat") or "Cash").Value += math.floor(v) end
			if t and tycoons[t] then tycoons[t].drops -= 1 end
		end)
	end
end
for t in tycoons do resetTycoon(t) end

-- droppers: only while their model is in the world and the tycoon has an owner
local COLORS = { Color3.fromRGB(255, 211, 77), Color3.fromRGB(90, 209, 255), Color3.fromRGB(200, 107, 255), Color3.fromRGB(61, 255, 168) }
for _, p in pieces do
	if p:GetAttribute("ForgeRole") == "dropper" then
		local t = tycoonOf(p)
		task.spawn(function()
			while true do
				task.wait(p:GetAttribute("ForgeInterval") or 2)
				if p:IsDescendantOf(workspace) and t and ownerOf(t) and tycoons[t].drops < 60 then
					local d = Instance.new("Part")
					d.Name = "Drop"
					d.Size = Vector3.new(1, 1, 1)
					d.Material = Enum.Material.SmoothPlastic
					d.Color = COLORS[math.random(#COLORS)]
					d.CFrame = p.CFrame * CFrame.new(0, -p.Size.Y / 2 - 0.7, 0)
					d:SetAttribute("ForgeValue", p:GetAttribute("ForgeValue") or 5)
					d.Parent = workspace
					tycoons[t].drops += 1
					local tt = tycoons[t]
					task.delay(30, function() if d.Parent then d:Destroy(); tt.drops -= 1 end end)
				end
			end
		end)
	end
end

-- players --------------------------------------------------------------------
local function onPlayer(player)
	for name in usedStats do statOf(player, name) end
	player.CharacterAdded:Connect(function(char)
		local cp = checkpoints[player]
		if cp then
			task.wait()
			char:PivotTo(CFrame.new(cp.Position + Vector3.new(0, cp.Size.Y / 2 + 3.5, 0)))
		end
	end)
end
Players.PlayerAdded:Connect(onPlayer)
for _, p in Players:GetPlayers() do onPlayer(p) end
Players.PlayerRemoving:Connect(function(player)
	checkpoints[player] = nil
	for t in tycoons do
		if t:GetAttribute("ForgeOwner") == player.UserId then resetTycoon(t) end
	end
end)

RunService.Heartbeat:Connect(function()
	local t = os.clock()
	for _, m in movers do
		local k = 0.5 - 0.5 * math.cos(2 * math.pi * t / m.period)
		m.align.Position = m.origin + m.off * k
	end
end)
