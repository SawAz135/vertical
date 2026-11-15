--[[
	Roblox Forge « Créer tout » - game engine (server, ServerScriptService).
	Everything comes from ReplicatedStorage.ForgeGame.Config, written by the app
	from your sentence: stats, money, training, GUI buttons, sell, shop, rebirth,
	eggs & pets, daily reward, codes, gamepass ×2, auto-train.

	- The server decides everything: one RemoteFunction (ForgeGameRemotes.Action)
	  validates and rate-limits every request; the client only asks.
	- Values live in leaderstats (shared with the map scripts: coins picked up on
	  the map, gates "🔒 50 Coins" use the same values).
	- Saving: DataStore with a session lock (no duplication when hopping servers),
	  retries, autosave every 60 s, save on leave and on shutdown.
	- Map pads: parts with the attribute ForgeGameZone = "Sell" | "Shop" | "Train"
	  | "Egg" | "Rebirth" (touch to use).
]]
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local MarketplaceService = game:GetService("MarketplaceService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local folder = ReplicatedStorage:WaitForChild("ForgeGame")
local cfg = require(folder:WaitForChild("Config"))

local remotes = Instance.new("Folder")
remotes.Name = "ForgeGameRemotes"
local action = Instance.new("RemoteFunction")
action.Name = "Action"
action.Parent = remotes
local stateEv = Instance.new("RemoteEvent")
stateEv.Name = "State"
stateEv.Parent = remotes
local notifyEv = Instance.new("RemoteEvent")
notifyEv.Name = "Notify"
notifyEv.Parent = remotes
local openEv = Instance.new("RemoteEvent") -- server -> client: open a panel (pads)
openEv.Name = "Open"
openEv.Parent = remotes
remotes.Parent = ReplicatedStorage

local store
pcall(function()
	store = DataStoreService:GetDataStore(cfg.datastore or "ForgeGame_v1")
end)
if not store then
	warn("[ForgeGame] DataStores unavailable (Studio without API access?): progress is not saved")
end

-- helpers --------------------------------------------------------------------
local function list(t)
	return t or {}
end
local trainStat = cfg.train and cfg.train.stat
local sellCfg = cfg.sell
local shopItems = {}
for _, it in list(cfg.shop and cfg.shop.items) do
	shopItems[it.id] = it
end
local buttons = {}
for _, b in list(cfg.buttons) do
	buttons[b.id] = b
end

local DATA: { [Player]: any } = {}
local function valueOf(player: Player, name: string): IntValue?
	local ls = player:FindFirstChild("leaderstats")
	local v = ls and ls:FindFirstChild(name)
	return v
end
local function get(player, name)
	local v = valueOf(player, name)
	return v and v.Value or 0
end
local function set(player, name, n)
	local v = valueOf(player, name)
	if v then
		v.Value = math.max(0, math.floor(n + 0.5))
	end
end
local function add(player, name, n)
	set(player, name, get(player, name) + n)
end

local function multiplier(player): number
	local d = DATA[player]
	if not d then
		return 1
	end
	local m = d.mult or 1
	if cfg.rebirth then
		m *= 1 + (cfg.rebirth.bonus or 0.5) * (d.rebirths or 0)
	end
	if d.petMult then
		m *= d.petMult
	end
	if d.passOwned and cfg.pass then
		m *= cfg.pass.mult or 2
	end
	if d.boostUntil and os.clock() < d.boostUntil then
		m *= d.boostMult or 2
	end
	return m
end

local function snapshot(player)
	local d = DATA[player]
	if not d then
		return
	end
	local values = {}
	for _, s in list(cfg.stats) do
		values[s.id] = get(player, s.id)
	end
	for _, m in list(cfg.money) do
		values[m.id] = get(player, m.id)
	end
	stateEv:FireClient(player, {
		values = values,
		perClick = d.perClick,
		mult = multiplier(player),
		owned = d.owned,
		rebirths = d.rebirths,
		rebirthCost = cfg.rebirth and math.floor(cfg.rebirth.cost * (cfg.rebirth.growth or 2.5) ^ (d.rebirths or 0)) or nil,
		capacity = d.capacity,
		sellMult = d.sellMult,
		pets = d.pets,
		dailyIn = cfg.daily and math.max(0, (d.lastDaily or 0) + 20 * 3600 - os.time()) or nil,
		boostLeft = d.boostUntil and math.max(0, d.boostUntil - os.clock()) or 0,
		damage = d.damage,
		health = d.health,
	})
end
local function notify(player, text, kind)
	notifyEv:FireClient(player, text, kind or "info")
end

-- rate limiting: every action has a minimum gap per player -----------------------
local last: { [Player]: { [string]: number } } = {}
local function allowed(player, key, gap)
	last[player] = last[player] or {}
	local t = os.clock()
	if (last[player][key] or 0) + gap > t then
		return false
	end
	last[player][key] = t
	return true
end

-- actions ----------------------------------------------------------------------
local ACTIONS = {}
function ACTIONS.train(player)
	if not trainStat then
		return false, "no training"
	end
	local d = DATA[player]
	local gain = (d.perClick or 1) * multiplier(player)
	local cur = get(player, trainStat)
	if d.capacity and d.capacity > 0 and cur >= d.capacity then
		notify(player, "🎒 Sac plein ! Va vendre.", "warn")
		return false, "full"
	end
	if d.capacity and d.capacity > 0 then
		gain = math.min(gain, d.capacity - cur)
	end
	add(player, trainStat, gain)
	return true, gain
end
local function pay(player, cost)
	if not cost then
		return true
	end
	if get(player, cost.money) < cost.amount then
		notify(player, string.format("Il te manque %d %s", cost.amount - get(player, cost.money), cost.money), "warn")
		return false
	end
	add(player, cost.money, -cost.amount)
	return true
end
function ACTIONS.add(player, id)
	local b = buttons[id]
	if not b or b.action ~= "add" then
		return false, "unknown button"
	end
	if not pay(player, b.cost) then
		return false, "poor"
	end
	add(player, b.stat, b.amount or 1)
	return true, b.amount or 1
end
function ACTIONS.boost(player, id)
	local b = buttons[id]
	local d = DATA[player]
	if not b or b.action ~= "boost" then
		return false, "unknown button"
	end
	if d.boostUntil and os.clock() < d.boostUntil then
		notify(player, "Un boost est déjà actif", "warn")
		return false, "active"
	end
	if not pay(player, b.cost) then
		return false, "poor"
	end
	d.boostUntil = os.clock() + (b.duration or 30)
	d.boostMult = b.mult or 2
	notify(player, string.format("🚀 Boost ×%s pendant %d s !", tostring(b.mult or 2), b.duration or 30), "good")
	return true, b.duration
end
function ACTIONS.sell(player)
	if not sellCfg then
		return false, "no sell"
	end
	local d = DATA[player]
	local amount = get(player, sellCfg.from)
	if amount <= 0 then
		notify(player, "Rien à vendre : entraîne-toi d'abord !", "warn")
		return false, "empty"
	end
	local earned = math.floor(amount * (sellCfg.rate or 1) * (d.sellMult or 1))
	if not sellCfg.keep then
		set(player, sellCfg.from, 0)
	end
	add(player, sellCfg.to, earned)
	notify(player, string.format("💰 +%d %s", earned, sellCfg.to), "good")
	return true, earned
end
function ACTIONS.buy(player, id)
	local it = shopItems[id]
	local d = DATA[player]
	if not it then
		return false, "unknown item"
	end
	if d.owned[id] then
		return false, "owned"
	end
	if get(player, it.money) < it.price then
		notify(player, string.format("Il te manque %d %s", it.price - get(player, it.money), it.money), "warn")
		return false, "poor"
	end
	add(player, it.money, -it.price)
	d.owned[id] = true
	if it.effect == "perClick" then
		d.perClick += it.value
	elseif it.effect == "mult" then
		d.mult *= it.value
	elseif it.effect == "sellMult" then
		d.sellMult *= it.value
	elseif it.effect == "capacity" then
		d.capacity = (d.capacity or 0) + it.value * 100
	elseif it.effect == "damage" then
		d.damage = (d.damage or 0) + it.value
	elseif it.effect == "health" then
		d.health = (d.health or 0) + it.value
		local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
		if hum then
			hum.MaxHealth = 100 + d.health
			hum.Health = hum.MaxHealth
		end
	elseif it.effect == "speed" then
		d.speed = (d.speed or 0) + it.value
		local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
		if hum then
			hum.WalkSpeed = 16 + d.speed
		end
	end
	notify(player, "✅ " .. it.name .. " acheté !", "good")
	return true
end
function ACTIONS.rebirth(player)
	local r = cfg.rebirth
	if not r then
		return false, "no rebirth"
	end
	local d = DATA[player]
	local cost = math.floor(r.cost * (r.growth or 2.5) ^ (d.rebirths or 0))
	if get(player, r.costStat) < cost then
		notify(player, string.format("Rebirth : il faut %d %s", cost, r.costStat), "warn")
		return false, "poor"
	end
	for _, s in list(cfg.stats) do
		set(player, s.id, s.start or 0)
	end
	for _, m in list(cfg.money) do
		set(player, m.id, m.start or 0)
	end
	d.rebirths += 1
	set(player, "Rebirths", d.rebirths)
	notify(player, string.format("🔁 Rebirth %d ! Gains ×%.1f", d.rebirths, multiplier(player)), "good")
	return true
end
function ACTIONS.egg(player)
	local e = cfg.eggs
	if not e then
		return false, "no eggs"
	end
	local d = DATA[player]
	if get(player, e.money) < e.price then
		notify(player, string.format("Œuf : il faut %d %s", e.price, e.money), "warn")
		return false, "poor"
	end
	if #d.pets >= 60 then
		notify(player, "Inventaire de pets plein", "warn")
		return false, "full"
	end
	add(player, e.money, -e.price)
	local total = 0
	for _, p in e.pets do
		total += p.w
	end
	local roll, pick = d.rng:NextNumber() * total, e.pets[#e.pets]
	for _, p in e.pets do
		roll -= p.w
		if roll <= 0 then
			pick = p
			break
		end
	end
	table.insert(d.pets, pick.name)
	-- the best pet multiplies every gain
	local best = 1
	for _, name in d.pets do
		for _, p in e.pets do
			if p.name == name and p.mult > best then
				best = p.mult
			end
		end
	end
	d.petMult = best
	notify(player, string.format("🥚 Tu obtiens %s (×%s) !", pick.name, tostring(pick.mult)), "good")
	return true, pick.name
end
function ACTIONS.daily(player)
	local dl = cfg.daily
	if not dl then
		return false, "no daily"
	end
	local d = DATA[player]
	if os.time() - (d.lastDaily or 0) < 20 * 3600 then
		return false, "wait"
	end
	d.lastDaily = os.time()
	add(player, dl.money, dl.amount)
	notify(player, string.format("🎁 +%d %s", dl.amount, dl.money), "good")
	return true
end
function ACTIONS.code(player, text)
	if type(text) ~= "string" or #text > 30 then
		return false, "bad"
	end
	local d = DATA[player]
	local want = string.upper(text:gsub("%s", ""))
	for _, c in list(cfg.codes) do
		if c.code == want then
			if d.codes[want] then
				notify(player, "Code déjà utilisé", "warn")
				return false, "used"
			end
			d.codes[want] = true
			add(player, c.money, c.amount)
			notify(player, string.format("🎟️ Code %s : +%d %s", want, c.amount, c.money), "good")
			return true
		end
	end
	notify(player, "Code invalide", "warn")
	return false, "invalid"
end
function ACTIONS.home(player)
	local spawn = workspace:FindFirstChildWhichIsA("SpawnLocation", true)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if spawn and root then
		root.CFrame = spawn.CFrame + Vector3.new(0, 4, 0)
		return true
	end
	return false, "no spawn"
end

local GAP = { train = (cfg.train and cfg.train.cooldown or 0.2) * 0.8, add = 0.15, boost = 1, sell = 0.5, buy = 0.3, rebirth = 1, egg = 0.6, daily = 2, code = 1, home = 2 }
action.OnServerInvoke = function(player, kind, arg)
	if type(kind) ~= "string" or not ACTIONS[kind] or not DATA[player] then
		return false, "bad request"
	end
	local b = (kind == "add" or kind == "boost") and buttons[arg]
	if not allowed(player, kind .. (b and tostring(arg) or ""), b and math.max(0.1, (b.action == "boost" and 1 or b.cooldown or 0.25) * 0.8) or GAP[kind] or 0.3) then
		return false, "too fast"
	end
	local ok, res = ACTIONS[kind](player, arg)
	snapshot(player)
	return ok, res
end

-- map pads (ForgeGameZone attribute) ------------------------------------------
local touchGap: { [Player]: { [BasePart]: number } } = {}
local function hookPad(part: BasePart)
	local zone = part:GetAttribute("ForgeGameZone")
	if not zone then
		return
	end
	part.Touched:Connect(function(hit)
		local char = hit and hit:FindFirstAncestorOfClass("Model")
		local player = char and Players:GetPlayerFromCharacter(char)
		if not player or not DATA[player] then
			return
		end
		touchGap[player] = touchGap[player] or {}
		if (touchGap[player][part] or 0) > os.clock() then
			return
		end
		touchGap[player][part] = os.clock() + 1
		if zone == "Sell" then
			ACTIONS.sell(player)
			snapshot(player)
		elseif zone == "Train" then
			ACTIONS.train(player)
			snapshot(player)
		else
			openEv:FireClient(player, zone) -- Shop / Egg / Rebirth: the client opens the panel
		end
	end)
end
for _, d in workspace:GetDescendants() do
	if d:IsA("BasePart") then
		hookPad(d)
	end
end
workspace.DescendantAdded:Connect(function(d)
	if d:IsA("BasePart") then
		hookPad(d)
	end
end)

-- training tool ------------------------------------------------------------------
local function giveTool(player)
	if not (cfg.train and cfg.train.tool) then
		return
	end
	local backpack = player:FindFirstChildOfClass("Backpack")
	if not backpack or backpack:FindFirstChild(cfg.train.toolName or "Entraînement") or (player.Character and player.Character:FindFirstChild(cfg.train.toolName or "Entraînement")) then
		return
	end
	local tool = Instance.new("Tool")
	tool.Name = cfg.train.toolName or "Entraînement"
	tool:SetAttribute("ForgeTrain", true)
	tool.ToolTip = "Entraîne-toi : " .. trainStat
	tool.CanBeDropped = false
	local handle = Instance.new("Part")
	handle.Name = "Handle"
	handle.Size = Vector3.new(1, 1, 3)
	handle.Color = Color3.fromRGB(70, 70, 80)
	handle.CanCollide = false
	handle.Parent = tool
	tool.Parent = backpack
	-- ForgeGame.client.lua sends the train request when the tool is used (server still rate-limits)
end

-- combat (PvP sword: damage, kills, reward) ---------------------------------------------
local SWORD = "Épée"
local function giveSword(player)
	if not cfg.combat then
		return
	end
	local backpack = player:FindFirstChildOfClass("Backpack")
	if not backpack or backpack:FindFirstChild(SWORD) or (player.Character and player.Character:FindFirstChild(SWORD)) then
		return
	end
	local tool = Instance.new("Tool")
	tool.Name = SWORD
	tool:SetAttribute("ForgeSword", true)
	tool.CanBeDropped = false
	local handle = Instance.new("Part")
	handle.Name = "Handle"
	handle.Size = Vector3.new(0.4, 4, 0.4)
	handle.Color = Color3.fromRGB(200, 205, 220)
	handle.CanCollide = false
	handle.Parent = tool
	local swing = -math.huge
	tool.Activated:Connect(function() -- Tool.Activated replicates to the server: the server does the hit test
		local d = DATA[player]
		if not d or os.clock() - swing < (cfg.combat.cooldown or 0.6) then
			return
		end
		swing = os.clock()
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if not root then
			return
		end
		for _, other in Players:GetPlayers() do
			local oc = other ~= player and other.Character
			local r2 = oc and oc:FindFirstChild("HumanoidRootPart")
			local hum = oc and oc:FindFirstChildOfClass("Humanoid")
			if r2 and hum and hum.Health > 0 and (r2.Position - root.Position).Magnitude <= (cfg.combat.range or 7) then
				hum:SetAttribute("ForgeLastHit", player.UserId)
				hum:TakeDamage((cfg.combat.damage or 20) + (d.damage or 0))
			end
		end
	end)
	tool.Parent = backpack
end
local function watchCharacter(player, char)
	local hum = char:FindFirstChildOfClass("Humanoid") or char:WaitForChild("Humanoid", 10)
	if not hum then
		return
	end
	local d = DATA[player]
	if d and (d.health or 0) > 0 then
		hum.MaxHealth = 100 + d.health
		hum.Health = hum.MaxHealth
	end
	if not cfg.combat then
		return
	end
	hum.Died:Connect(function()
		local id = hum:GetAttribute("ForgeLastHit")
		local killer = id and Players:GetPlayerByUserId(id)
		if killer and killer ~= player and DATA[killer] then
			add(killer, "Kills", 1)
			add(killer, cfg.combat.money, math.floor((cfg.combat.reward or 25) * multiplier(killer)))
			notify(killer, "⚔️ Tu as battu " .. player.Name .. " !", "good")
			snapshot(killer)
		end
	end)
end

-- global leaderboard (OrderedDataStore + a board in the map) ------------------------------
local board
if cfg.board then
	pcall(function()
		board = DataStoreService:GetOrderedDataStore((cfg.datastore or "ForgeGame_v1") .. "_top_" .. cfg.board.stat)
	end)
end
local function refreshBoard()
	if not board then
		return
	end
	local okP, pages = pcall(function()
		return board:GetSortedAsync(false, cfg.board.top or 10)
	end)
	if not okP or not pages then
		return
	end
	local lines = { "🏆 TOP " .. cfg.board.stat }
	for i, e in pages:GetCurrentPage() do
		local okN, name = pcall(function()
			return Players:GetNameFromUserIdAsync(tonumber(e.key))
		end)
		table.insert(lines, string.format("%d. %s  %s", i, okN and name or ("#" .. tostring(e.key)), tostring(e.value)))
	end
	for _, part in workspace:GetDescendants() do
		if part:IsA("BasePart") and part:GetAttribute("ForgeGameBoard") then
			local gui = part:FindFirstChild("ForgeBoardGui") or Instance.new("SurfaceGui")
			gui.Name = "ForgeBoardGui"
			gui.Face = Enum.NormalId.Front
			gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
			gui.PixelsPerStud = 40
			gui.Parent = part
			local label = gui:FindFirstChild("Text") or Instance.new("TextLabel")
			label.Name = "Text"
			label.Size = UDim2.fromScale(1, 1)
			label.BackgroundColor3 = Color3.fromRGB(22, 18, 42)
			label.TextColor3 = Color3.new(1, 1, 1)
			label.Font = Enum.Font.FredokaOne
			label.TextScaled = true
			label.TextXAlignment = Enum.TextXAlignment.Left
			label.Text = table.concat(lines, "\n")
			label.Parent = gui
		end
	end
	return lines
end

-- data -----------------------------------------------------------------------------
local function blank()
	return { perClick = (cfg.train and cfg.train.perClick) or 1, mult = 1, sellMult = 1, capacity = 0, speed = 0, damage = 0, health = 0, owned = {}, rebirths = 0, pets = {}, codes = {}, values = {}, lastDaily = 0 }
end
local function load(player)
	if not store then
		return blank()
	end
	local key, data = "u" .. player.UserId, nil
	for attempt = 1, 5 do
		local okLoad, err = pcall(function()
			store:UpdateAsync(key, function(old)
				old = old or blank()
				if old.lock and old.lock.job ~= game.JobId and os.time() - old.lock.t < 90 then
					data = "locked"
					return nil -- another server still holds this player: retry
				end
				old.lock = { job = game.JobId, t = os.time() }
				data = old
				return old
			end)
		end)
		if okLoad and data ~= "locked" and data then
			return data
		end
		if not okLoad then
			warn("[ForgeGame] load failed: " .. tostring(err))
		end
		task.wait(2 * attempt)
	end
	return nil
end
local function save(player, release)
	local d = DATA[player]
	if not d or not store then
		return
	end
	d.values = {}
	for _, s in list(cfg.stats) do
		d.values[s.id] = get(player, s.id)
	end
	for _, m in list(cfg.money) do
		d.values[m.id] = get(player, m.id)
	end
	if board then
		pcall(function()
			board:SetAsync(tostring(player.UserId), math.floor(get(player, cfg.board.stat)))
		end)
	end
	local copy = table.clone(d)
	copy.rng = nil
	copy.passOwned = nil
	copy.lock = (not release) and { job = game.JobId, t = os.time() } or nil
	for attempt = 1, 3 do
		local okSave = pcall(function()
			store:UpdateAsync("u" .. player.UserId, function(old)
				if old and old.lock and old.lock.job ~= game.JobId and os.time() - old.lock.t < 90 then
					return nil -- someone else owns it now: never overwrite
				end
				return copy
			end)
		end)
		if okSave then
			return
		end
		task.wait(attempt)
	end
end

local function setup(player)
	local data = load(player)
	if not data then
		player:Kick("Tes données sont encore utilisées par un autre serveur, reviens dans une minute.")
		return
	end
	for k, v in blank() do
		if data[k] == nil then
			data[k] = v
		end
	end
	data.rng = Random.new()
	DATA[player] = data
	local ls = player:FindFirstChild("leaderstats") or Instance.new("Folder")
	ls.Name = "leaderstats"
	local function value(name, start)
		local v = ls:FindFirstChild(name) or Instance.new("IntValue")
		v.Name = name
		v.Value = data.values[name] or start or 0
		v.Parent = ls
	end
	for _, s in list(cfg.stats) do
		value(s.id, s.start)
	end
	for _, m in list(cfg.money) do
		value(m.id, m.start)
	end
	if cfg.rebirth then
		value("Rebirths", data.rebirths)
	end
	ls.Parent = player
	if cfg.eggs then
		for _, name in data.pets do
			for _, p in cfg.eggs.pets do
				if p.name == name and p.mult > (data.petMult or 1) then
					data.petMult = p.mult
				end
			end
		end
	end
	if cfg.pass and (cfg.pass.id or 0) > 0 then
		local okPass, owns = pcall(MarketplaceService.UserOwnsGamePassAsync, MarketplaceService, player.UserId, cfg.pass.id)
		data.passOwned = okPass and owns or false
	end
	player.CharacterAdded:Connect(function(char)
		task.spawn(watchCharacter, player, char)
		task.wait(0.5)
		giveTool(player)
		giveSword(player)
		local hum = char:FindFirstChildOfClass("Humanoid")
		if hum and data.speed > 0 then
			hum.WalkSpeed = 16 + data.speed
		end
	end)
	if player.Character then
		giveTool(player)
		giveSword(player)
		task.spawn(watchCharacter, player, player.Character)
	end
	snapshot(player)
	-- every leaderstat change (also from the map: coins, gates) refreshes the GUI
	for _, v in ls:GetChildren() do
		v.Changed:Connect(function()
			snapshot(player)
		end)
	end
end

if MarketplaceService.PromptGamePassPurchaseFinished then
	MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, id, bought)
		if bought and cfg.pass and id == cfg.pass.id and DATA[player] then
			DATA[player].passOwned = true
			snapshot(player)
		end
	end)
end

Players.PlayerAdded:Connect(setup)
for _, p in Players:GetPlayers() do
	task.spawn(setup, p)
end
Players.PlayerRemoving:Connect(function(player)
	save(player, true)
	DATA[player] = nil
	last[player] = nil
	touchGap[player] = nil
end)
game:BindToClose(function()
	for _, p in Players:GetPlayers() do
		save(p, true)
	end
end)
task.spawn(function()
	while true do
		task.wait(60)
		for _, p in Players:GetPlayers() do
			task.spawn(save, p, false)
		end
		task.spawn(refreshBoard)
	end
end)
task.delay(5, refreshBoard)
_G.ForgeGameRefreshBoard = refreshBoard -- handy for tests / admin commands
