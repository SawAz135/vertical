--[[ WHERE'S MY POTATO? — server entry.
     Builds the world (golden potato desert in Terrain, the skyscraper jar + spiral conveyor,
     the bin, Gérard's stall), wires every service and every remote (each one rate-limited). ]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)
local Net = require(ReplicatedStorage.Shared.Net)

Net.setupServer()
local world = Instance.new("Folder"); world.Name = "World"; world.Parent = workspace
local ready = Instance.new("BoolValue"); ready.Name = "WorldReady"; ready.Value = false; ready.Parent = ReplicatedStorage

local Terrain = require(script.Parent.World.Terrain)
local Structures = require(script.Parent.World.Structures)
local ShopBuild = require(script.Parent.World.Shop)
local GerardBuild = require(script.Parent.World.Gerard)
local Data = require(script.Parent.Services.Data)
local Session = require(script.Parent.Services.Session)
local Harvest = require(script.Parent.Services.Harvest)
local Machine = require(script.Parent.Services.Machine)
local Night = require(script.Parent.Services.Night)

-- ---------------------------------------------------------------- world
Terrain.lighting()
Structures.jar(world); Structures.spiral(world); Structures.ramp(world); Structures.bin(world)
ShopBuild.build(world); ShopBuild.drawChalk()
local gerard = GerardBuild.build(world, ShopBuild.origin * CFrame.new(0, 0.55, 1.3))
local spawn = Instance.new("SpawnLocation"); spawn.Anchored = true; spawn.Size = Vector3.new(6, 1, 6); spawn.Transparency = 1; spawn.CanCollide = false
spawn.CFrame = Config.SPAWN; spawn.Neutral = true; spawn.Duration = 0; spawn.Parent = world
-- temporary floor under the spawn while the desert is being written into Terrain
local Land = require(ReplicatedStorage.Shared.Land)
local safe = Instance.new("Part"); safe.Name = "SpawnSafety"; safe.Anchored = true; safe.Transparency = 1; safe.Size = Vector3.new(60, 1, 60)
safe.Position = Vector3.new(Config.SPAWN.X, Land.height(Config.SPAWN.X, Config.SPAWN.Z) - 0.5, Config.SPAWN.Z); safe.Parent = world
spawn.CFrame = CFrame.new(Config.SPAWN.X, Land.height(Config.SPAWN.X, Config.SPAWN.Z) + 4, Config.SPAWN.Z) * Config.SPAWN.Rotation
task.spawn(function() Terrain.build(); ready.Value = true; task.wait(2); safe:Destroy() end)

-- ---------------------------------------------------------------- Gérard speaks to everybody
local lastLine = {}
local function say(key: string, gesture: string?)
	local lines = Config.LINES[key]; if not lines then return end
	local i = math.random(1, #lines)
	if #lines > 1 and i == lastLine[key] then i = i % #lines + 1 end
	lastLine[key] = i
	Net.event("Say"):FireAllClients(lines[i], gesture or "talk")
end
Harvest.onSay = say

-- ---------------------------------------------------------------- data push
local dirty: { [Player]: boolean } = {}
local function push(p: Player)
	local d = Data.get(p); if not d then return end
	Net.event("Data"):FireClient(p, { money = d.money, levels = d.levels, stats = d.stats, tutorial = d.tutorial, jar = Machine.count, carry = Harvest.snapshot(p), owner = Session.ownerId })
end
task.spawn(function()
	while true do
		task.wait(0.2)
		for _, p in Players:GetPlayers() do if dirty[p] ~= false then dirty[p] = false; push(p) end end
	end
end)
local function touch(p: Player) dirty[p] = true end

local function applyChar(p: Player)
	local d = Data.get(p); local hum = p.Character and p.Character:FindFirstChildOfClass("Humanoid")
	if not d or not hum then return end
	local sp = Config.val(d.levels, "boots", "speed")
	hum.WalkSpeed = 18 * sp; hum.UseJumpPower = true; hum.JumpPower = 46 + (sp - 1) * 30
end

-- ---------------------------------------------------------------- machine hooks
Harvest.onDump = function(p, v) Machine.dump(p, v); touch(p) end
Harvest.onShot = function(p, v, from, vel) Machine.shot(p, v, from, vel); touch(p) end
Machine.onOverflow = function() say("overflow", "cheer") end
Night.onLand = function() say("star", "point") end

-- ---------------------------------------------------------------- players
Data.Loaded:Connect(function(p, d)
	if not Session.onPlayer(p) then return end
	if p.UserId == Session.ownerId and Machine.count == 0 and d.jar > 0 then Machine.setFill(d.jar) end
	push(p); applyChar(p)
	p.CharacterAdded:Connect(function() task.wait(0.2); applyChar(p) end)
	Net.event("Field"):FireClient(p, Harvest.fullState(), true)
end)
Players.PlayerAdded:Connect(function(p) dirty[p] = true end)
Players.PlayerRemoving:Connect(function(p) dirty[p] = nil end)
Machine.setFill(0)

-- ---------------------------------------------------------------- remotes (rate limited)
local calls: { [Player]: { [string]: { number } } } = {}
local function allowed(p: Player, name: string): boolean
	local lim = Net.ClientToServer[name] or 4
	local c = calls[p] or {}; calls[p] = c
	local b = c[name] or { 0, os.clock() }; c[name] = b
	local now = os.clock()
	if now - b[2] >= 1 then b[1] = 0; b[2] = now end
	b[1] += 1
	return b[1] <= lim
end
Players.PlayerRemoving:Connect(function(p) calls[p] = nil end)
local function on(name: string, fn: (Player, ...any) -> ())
	Net.event(name).OnServerEvent:Connect(function(p, ...)
		if not allowed(p, name) or not Data.get(p) then return end
		local ok, err = pcall(fn, p, ...)
		if not ok then warn("[WMP]", name, err) end
	end)
end

on("Ready", function(p) touch(p); Net.event("Field"):FireClient(p, Harvest.fullState(), true); Machine.setFill(Machine.count) end)
on("Pick", function(p, cells, tool) Harvest.pick(p, cells, tool); touch(p) end)
on("Dump", function(p) Harvest.dump(p); touch(p) end)
on("Shoot", function(p, dir) Harvest.shoot(p, dir); touch(p) end)
on("SetTool", function(p, tool) if type(tool) == "string" then Harvest.setTool(p, tool); touch(p) end end)
on("TutorialDone", function(p) local d = Data.get(p); d.tutorial = true; touch(p); task.delay(0.8, say, "welcome", "wave") end)
on("Grab", function(p, part)
	local root = p.Character and p.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if typeof(part) ~= "Instance" or not part:IsA("BasePart") or not root then return end
	if (part.Position - root.Position).Magnitude > 22 then return end
	if part:GetAttribute("Star") and Night.takeStar(part) then
		Harvest.give(p, 6); local d = Data.get(p); d.stats.gold += 1; say("gold", "cheer")
		Net.event("Fx"):FireClient(p, { kind = "picked", list = { 6 }, tool = "hands" })
	end
	touch(p)
end)
on("Buy", function(p, id)
	local d = Data.get(p); local it = type(id) == "string" and Config.ITEM[id]
	if not it then return end
	local lv = d.levels[id] or 0
	local nx = it.levels[lv + 2]
	if not nx then say("max", "shrug"); return end
	if d.money < nx.price then say("poor", "shrug"); Net.event("Notify"):FireClient(p, "Pas assez de francs !", "warn"); return end
	d.money -= nx.price; d.levels[id] = lv + 1
	say("buy", "thumbs"); applyChar(p); touch(p)
	Net.event("Notify"):FireClient(p, it.icon .. " " .. nx.name .. " acheté !", "gold")
end)
on("Invite", function(p)
	Net.event("Session"):FireClient(p, { invite = Session.invitePayload(p) })
end)

-- greeting / idle chatter
task.spawn(function()
	local lastGreet, nextIdle = 0, os.clock() + 50
	while true do
		task.wait(1)
		for _, p in Players:GetPlayers() do
			local r = p.Character and p.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
			if r and (r.Position - Config.SHOP.Pos).Magnitude < 24 and os.clock() - lastGreet > 75 then lastGreet = os.clock(); say("greet", "wave") end
		end
		if os.clock() > nextIdle then nextIdle = os.clock() + 45 + math.random() * 50; say("idle", "point") end
	end
end)

_G.WMP_Gerard = gerard
