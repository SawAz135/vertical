--[[ Harvest: server authority over the potato desert.
     - the desert is a deterministic grid (Shared.Potato): the server only stores which cells
       were dug (layer) and which are momentarily empty (regrowing), and broadcasts deltas
     - picking: range, rate and capacity checks per tool (hands / bucket / vacuum)
     - digging: each pick sinks the cell one layer (a real hole carved in the Terrain); the
       potato underneath appears 0.45 s later; deeper layers hide rare purple potatoes;
       after DIG_MAX layers the hole refills slowly and the cell starts over
     - carrying: what each player holds, per tool; dumping at the bin; cannon shots ]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)
local Potato = require(ReplicatedStorage.Shared.Potato)
local Land = require(ReplicatedStorage.Shared.Land)
local Net = require(ReplicatedStorage.Shared.Net)
local Data = require(script.Parent.Data)

local H = {}
H.layer = {} :: { [number]: number } -- cell key → dug layers
H.empty = {} :: { [number]: number } -- cell key → os.clock() when the next potato shows up
H.carry = {} :: { [Player]: { hands: { number }, bucket: { number }, tank: { number }, tool: string } }
H.onDump = nil :: ((Player, number) -> ())? -- set by the Machine
H.onShot = nil :: ((Player, number, Vector3, Vector3) -> ())?
H.onSay = nil :: ((string, string?) -> ())?
local LAYER = 0.55 -- studs lowered per dug layer
local lastPick: { [Player]: number } = {}
local digLog = {} -- { key, t } for the slow refill

local function lv(p: Player) local d = Data.get(p); return d and d.levels or {} end
local function cap(p: Player, tool: string): number
	local L = lv(p)
	if tool == "bucket" then return Config.val(L, "bucket", "cap") end
	if tool == "vacuum" then return Config.val(L, "vacuum", "cap") end
	return Config.val(L, "gloves", "cap")
end
local function list(p: Player, tool: string)
	local c = H.carry[p]; if not c then return nil end
	return if tool == "bucket" then c.bucket elseif tool == "vacuum" then c.tank else c.hands
end
function H.count(p: Player): number
	local c = H.carry[p]; if not c then return 0 end
	return #c.hands + #c.bucket + #c.tank
end
function H.snapshot(p: Player)
	local c = H.carry[p]; if not c then return nil end
	return { hands = #c.hands, bucket = #c.bucket, tank = #c.tank, tool = c.tool,
		capHands = cap(p, "hands"), capBucket = cap(p, "bucket"), capTank = cap(p, "vacuum") }
end

-- surface height of a cell taking the dug layers into account
function H.cellY(ix: number, iz: number): number
	local x, z = Potato.cell(ix, iz, 0)
	return Land.height(x, z) - (H.layer[Potato.key(ix, iz)] or 0) * LAYER
end

local function carve(x: number, z: number, layer: number)
	local y = Land.height(x, z) - layer * LAYER
	pcall(function() workspace.Terrain:FillBall(Vector3.new(x, y + 0.6, z), 1.9, Enum.Material.Air) end)
end

-- a batch of picks from one player: { ix, iz, ix, iz, ... }
function H.pick(p: Player, cells: { number }, tool: string)
	local char = p.Character; local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not root or type(cells) ~= "table" then return end
	if tool ~= "hands" and tool ~= "bucket" and tool ~= "vacuum" then return end
	local L = lv(p)
	if tool == "bucket" and (L.bucket or 0) < 1 then return end
	if tool == "vacuum" and (L.vacuum or 0) < 1 then return end
	local held = list(p, tool); if not held then return end
	local range = Config.POTATO.PickRange + (if tool == "vacuum" then Config.val(L, "vacuum", "range") else Config.val(L, "magnet", "radius"))
	local rate = if tool == "vacuum" then Config.val(L, "vacuum", "rate") elseif tool == "bucket" then Config.val(L, "magnet", "rate") * 1.6 else 8
	local now = os.clock()
	local budget = math.floor(math.max(1, (now - (lastPick[p] or 0)) * rate) + 0.5)
	budget = math.min(budget, if tool == "hands" then 2 else 24)
	local c, got, delta = cap(p, tool), {}, {}
	for k = 1, math.min(#cells, 48), 2 do
		if #held >= c or budget <= 0 then break end
		local ix, iz = tonumber(cells[k]), tonumber(cells[k + 1])
		if not ix or not iz or ix ~= ix or math.abs(ix) > 30000 or math.abs(iz) > 30000 then continue end
		ix, iz = math.floor(ix), math.floor(iz)
		local key = Potato.key(ix, iz)
		if (H.empty[key] or 0) > now then continue end
		local layer = H.layer[key] or 0
		local x, z, _, variety = Potato.cell(ix, iz, layer)
		local y = Land.height(x, z) - layer * LAYER
		if (Vector3.new(x, y, z) - root.Position).Magnitude > range then continue end
		-- fertilizer: a few golden potatoes on the surface
		if layer == 0 and Potato.hash(ix % 65536, iz % 65536, 77 + math.floor(now / 30)) < Config.val(L, "fertilizer", "gold") then variety = 6 end
		budget -= 1
		table.insert(held, variety)
		-- the pile caves in: next layer underneath shows up a moment later
		local nl = layer + 1
		if nl < Config.DIG_MAX then
			H.layer[key] = nl; H.empty[key] = now + 0.45
		else
			H.layer[key] = nil; H.empty[key] = now + (15 + math.random() * 20) * Config.val(L, "fertilizer", "grow")
		end
		carve(x, z, nl)
		table.insert(digLog, { key, now })
		table.insert(got, variety)
		table.insert(delta, key); table.insert(delta, H.layer[key] or 0); table.insert(delta, H.empty[key] - now)
		local d = Data.get(p)
		if d then
			d.stats.picked += 1
			if variety == 5 then d.stats.purple += 1 end
			if variety == 6 then d.stats.gold += 1 end
		end
	end
	lastPick[p] = now
	if #delta > 0 then
		Net.event("Field"):FireAllClients(delta)
		Net.event("Fx"):FireClient(p, { kind = "picked", list = got, tool = tool })
		local d = Data.get(p)
		for _, v in got do
			if v == 5 and H.onSay then H.onSay("purple", "point") end
			if v == 6 and H.onSay then H.onSay("gold", "cheer") end
		end
		if d and d.stats.picked >= 4 and not d.digHint and H.onSay then d.digHint = true; H.onSay("dig", "point") end
	end
end

-- everything at once into the bin (the client asks while holding the button near the bin)
function H.dump(p: Player)
	local char = p.Character; local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	local c = H.carry[p]; if not root or not c then return end
	if (root.Position - Config.BIN.Pos).Magnitude > 16 then return end
	local n = 0
	for _, l in { c.tank, c.bucket, c.hands } do
		while #l > 0 and n < 14 do
			local v = table.remove(l)
			n += 1
			if H.onDump then H.onDump(p, v :: number) end
		end
	end
	if n > 0 then local d = Data.get(p); if d then d.stats.dumped += n end end
end

function H.shoot(p: Player, dir: Vector3)
	if typeof(dir) ~= "Vector3" or dir.Magnitude < 0.5 then return end
	local L = lv(p); local power = Config.val(L, "cannon", "power"); if power <= 0 then return end
	local c = H.carry[p]; local char = p.Character; local head = char and char:FindFirstChild("Head") :: BasePart?
	if not c or not head then return end
	local shots = if (L.cannon or 0) >= 2 then 2 else 1
	for s = 1, shots do
		local l = if #c.tank > 0 then c.tank elseif #c.bucket > 0 then c.bucket else c.hands
		local v = table.remove(l); if not v then break end
		if H.onShot then H.onShot(p, v, head.Position + dir.Unit * 3 + Vector3.new(0, -0.5, 0), dir.Unit * power + Vector3.new((s - 1.5) * 4, 0, 0)) end
	end
end

-- golden shooting potato / loose potatoes picked up directly
function H.give(p: Player, variety: number): boolean
	local c = H.carry[p]; if not c then return false end
	local l, tool = c.hands, "hands"
	if #c.bucket < cap(p, "bucket") and (lv(p).bucket or 0) > 0 then l, tool = c.bucket, "bucket" end
	table.insert(l, variety); return true
end

-- slow refill of the holes (2 minutes after the last dig in a cell)
task.spawn(function()
	while true do
		task.wait(5)
		local now, keep, refill = os.clock(), {}, {}
		local last = {}
		for _, e in digLog do last[e[1]] = math.max(last[e[1]] or 0, e[2]) end
		for _, e in digLog do if last[e[1]] == e[2] then table.insert(keep, e) end end
		digLog = {}
		for _, e in keep do
			if now - e[2] > 120 then table.insert(refill, e[1]) else table.insert(digLog, e) end
		end
		if #refill > 0 then
			local delta = {}
			for _, key in refill do
				local layer = H.layer[key] or 0
				local ix, iz = Potato.unkey(key)
				local x, z = Potato.cell(ix, iz, 0)
				local y = Land.height(x, z)
				pcall(function() workspace.Terrain:FillBall(Vector3.new(x, y - 1.2, z), 2.0, Enum.Material.Sand) end)
				if layer > 0 then H.layer[key] = nil; table.insert(delta, key); table.insert(delta, 0); table.insert(delta, 0) end
			end
			if #delta > 0 then Net.event("Field"):FireAllClients(delta) end
		end
	end
end)

-- full state for a joining client
function H.fullState(): { number }
	local out, now = {}, os.clock()
	for key, l in H.layer do table.insert(out, key); table.insert(out, l); table.insert(out, math.max(0, (H.empty[key] or 0) - now)) end
	for key, t in H.empty do if not H.layer[key] and t > now then table.insert(out, key); table.insert(out, 0); table.insert(out, t - now) end end
	return out
end

function H.setTool(p: Player, tool: string)
	local c = H.carry[p]; if not c then return end
	if tool == "hands" or tool == "bucket" or tool == "vacuum" or tool == "cannon" then
		c.tool = tool
		-- switching to the bucket pours what the hands carry into it
		if tool == "bucket" then while #c.hands > 0 and #c.bucket < cap(p, "bucket") do table.insert(c.bucket, table.remove(c.hands)) end end
	end
end

Players.PlayerAdded:Connect(function(p) H.carry[p] = { hands = {}, bucket = {}, tank = {}, tool = "hands" } end)
for _, p in Players:GetPlayers() do H.carry[p] = { hands = {}, bucket = {}, tank = {}, tool = "hands" } end
Players.PlayerRemoving:Connect(function(p) H.carry[p] = nil; lastPick[p] = nil end)

return H
