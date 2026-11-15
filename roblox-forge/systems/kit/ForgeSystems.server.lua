--[[
	Roblox Forge - game systems (server, ServerScriptService).
	Made with Forge Systems Studio. Reads ReplicatedStorage.ForgeSystems.Config
	and uses ReplicatedStorage.ForgeSystems.Logic for every rule (same code the
	studio tested), so the odds you saw in the studio are the odds in the game.

	- Saving: DataStore with a session lock (no duplication when a player hops
	  servers), retries with backoff, autosave, save on leave and on shutdown.
	- leaderstats for every currency marked "leaderstat", plus Rebirths.
	- One RemoteFunction (ForgeSystemsRemotes.Request): every action is validated
	  and rate limited here; the client never decides anything.
	- Gamepasses (perks) and developer products (ProcessReceipt, idempotent).
	  Ids come from the config: an id of 0 means "not set up yet" and is ignored.
	- Egg stands with a ProximityPrompt, a global leaderboard (OrderedDataStore).
	- Equipped pets: if ReplicatedStorage.ForgePets has a model with the pet's
	  name (Pet Studio / Index), the strongest equipped one follows the player
	  (player attribute ForgePet, read by ForgePetController).
]]
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local MarketplaceService = game:GetService("MarketplaceService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")
local BadgeService = game:GetService("BadgeService")
local AnalyticsService = game:GetService("AnalyticsService")
local TextService = game:GetService("TextService")

local folder = ReplicatedStorage:WaitForChild("ForgeSystems")
local cfg = require(folder:WaitForChild("Config"))
local L = require(folder:WaitForChild("Logic"))

-- remotes -------------------------------------------------------------------
local remotes = Instance.new("Folder")
remotes.Name = "ForgeSystemsRemotes"
local request = Instance.new("RemoteFunction")
request.Name = "Request"
request.Parent = remotes
local push = Instance.new("RemoteEvent") -- server -> client: state snapshots
push.Name = "State"
push.Parent = remotes
local hatched = Instance.new("RemoteEvent") -- server -> client: hatch results (cinematic)
hatched.Name = "Hatched"
hatched.Parent = remotes
local notify = Instance.new("RemoteEvent")
notify.Name = "Notify"
notify.Parent = remotes
remotes.Parent = ReplicatedStorage

-- data store ----------------------------------------------------------------
local store, board
local storeOk = pcall(function()
	store = DataStoreService:GetDataStore(cfg.datastore or "ForgeSystems_v1")
	if cfg.leaderboard and cfg.leaderboard.enabled then
		board = DataStoreService:GetOrderedDataStore((cfg.datastore or "ForgeSystems_v1") .. "_board_" .. cfg.leaderboard.stat)
	end
end)
if not storeOk then warn("[ForgeSystems] DataStores unavailable (Studio without API access?): progress will not be saved") end

local AUTOSAVE = math.max(30, cfg.autosave or 60)
local LOCK_EXPIRE = AUTOSAVE * 3 + 60 -- a lock older than this belongs to a dead server

local function retry(what, fn, tries)
	tries = tries or 5
	local lastErr
	for i = 1, tries do
		local ok, a, b = pcall(fn)
		if ok then return true, a, b end
		lastErr = a
		warn(("[ForgeSystems] %s failed (%d/%d): %s"):format(what, i, tries, tostring(a)))
		task.wait(math.min(2 ^ i, 20))
	end
	return false, lastErr
end

local sessions = {} -- [player] = { data, perks, limiter, loaded, saving, dirty, joined }
local JOB = game.JobId ~= "" and game.JobId or ("studio-" .. HttpService:GenerateGUID(false))

local function keyOf(player) return "p_" .. player.UserId end

-- load with session lock: refuses data that another live server is using
local function load(player)
	if not store then return L.defaultData(cfg), false end
	for attempt = 1, 8 do
		local locked = false
		local ok, result = retry("load " .. player.Name, function()
			return store:UpdateAsync(keyOf(player), function(old)
				old = type(old) == "table" and old or { data = nil }
				local lock = old.lock
				if lock and lock.job ~= JOB and os.time() - (lock.t or 0) < LOCK_EXPIRE then
					locked = true
					return nil -- cancel: someone else holds it
				end
				old.lock = { job = JOB, t = os.time() }
				return old
			end)
		end)
		if not ok then return nil, "store" end
		if not locked then
			local data = L.migrate(result and result.data, cfg)
			return data, true
		end
		if not player.Parent then return nil, "left" end
		task.wait(math.min(3 * attempt, 12)) -- the previous server is still saving
	end
	return nil, "locked"
end

local function save(player, release)
	local s = sessions[player]
	if not s or not s.loaded or not store or not s.canSave or s.released then return true end
	if s.saving then
		while s.saving do task.wait(0.2) end
		if not release then return true end
	end
	s.saving = true
	local snapshot = s.data
	local ok = retry("save " .. player.Name, function()
		return store:UpdateAsync(keyOf(player), function(old)
			old = type(old) == "table" and old or {}
			if old.lock and old.lock.job ~= JOB and os.time() - (old.lock.t or 0) < LOCK_EXPIRE then
				return nil -- we lost the lock: never overwrite newer data
			end
			old.data = snapshot
			old.lock = (not release) and { job = JOB, t = os.time() } or nil
			return old
		end)
	end, release and 6 or 4)
	s.saving = false
	if ok and release then s.released = true end -- never re-lock after letting go
	return ok
end

-- leaderstats ---------------------------------------------------------------
local function syncStats(player)
	local s = sessions[player]
	local ls = player:FindFirstChild("leaderstats")
	if not s or not ls then return end
	for _, c in cfg.currencies do
		local v = ls:FindFirstChild(c.name)
		if v then v.Value = math.floor(s.data.currencies[c.name] or 0) end
	end
	local rb = ls:FindFirstChild("Rebirths")
	if rb then rb.Value = s.data.rebirths end
end

local function makeStats(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	for _, c in cfg.currencies do
		if c.leaderstat then
			local v = Instance.new("NumberValue")
			v.Name = c.name
			v.Parent = ls
		end
	end
	local rb = Instance.new("IntValue")
	rb.Name = "Rebirths"
	rb.Parent = ls
	ls.Parent = player
end

-- state sent to the client (only what the UI needs)
local function today() return math.floor(os.time() / 86400) end
local tradeView -- defined with the trading actions below
local closeTradeOnLeave = function() end
local function stateOf(player)
	local s = sessions[player]
	local d = s.data
	local maxPets, maxEquip = L.limits(cfg, s.perks)
	local q = L.questsForDay(d, today())
	local dailyReady, _, dailyNext = L.daily(d, today(), #cfg.daily)
	return {
		currencies = d.currencies, rebirths = d.rebirths, pets = d.pets, pity = d.pity,
		maxPets = maxPets, maxEquip = maxEquip, perks = s.perks, multiplier = L.multiplier(cfg, d, s.perks),
		rebirthCost = L.rebirthCost(cfg, d.rebirths), daily = { streak = d.daily.streak, ready = dailyReady, next = dailyNext },
		quests = { progress = q.progress, claimed = q.claimed }, saved = s.canSave, trade = tradeView(player),
	}
end
local function sendState(player)
	if sessions[player] and sessions[player].loaded then push:FireClient(player, stateOf(player)) end
end

-- analytics (Creator Hub > Analytics): economy sources/sinks and the onboarding funnel ----
local ANALYTICS = cfg.analytics ~= false
local function economy(player, source, currency, amount, kind, sku)
	if not ANALYTICS or amount == 0 then return end
	local s = sessions[player]
	pcall(AnalyticsService.LogEconomyEvent, AnalyticsService, player,
		source and Enum.AnalyticsEconomyFlowType.Source or Enum.AnalyticsEconomyFlowType.Sink,
		currency, math.abs(amount), s and s.data.currencies[currency] or 0, kind, sku)
end
local FUNNEL = { "Arrivée", "Premier œuf", "Premier pet équipé", "Premier rebirth" }
local function funnel(player, step)
	local s = sessions[player]
	if not ANALYTICS or not s or (s.data.funnel or 0) >= step then return end
	s.data.funnel = step
	pcall(AnalyticsService.LogOnboardingFunnelStepEvent, AnalyticsService, player, step, FUNNEL[step])
end

-- badges: { id = <real badge id>, name, when = "join"|"hatch"|"rebirth"|"pets"|"rarity", value } ----
local function checkBadges(player)
	local s = sessions[player]
	if not s or not s.loaded then return end
	for _, b in cfg.badges or {} do
		if b.id and b.id > 0 and not s.badges[b.id] then
			local d, ok = s.data, false
			if b.when == "join" then ok = true
			elseif b.when == "hatch" then ok = d.stats.hatched >= (b.value or 1)
			elseif b.when == "rebirth" then ok = d.rebirths >= (b.value or 1)
			elseif b.when == "pets" then ok = L.count(d) >= (b.value or 1)
			elseif b.when == "rarity" then
				for _, p in d.pets do
					local def = L.petById(cfg, p.id)
					if def and L.tierOf(cfg, def.rarity) >= L.tierOf(cfg, b.value) then ok = true break end
				end
			end
			if ok then
				s.badges[b.id] = true -- once per session, even if Roblox is slow
				task.spawn(function()
					local okHas, has = pcall(BadgeService.UserHasBadgeAsync, BadgeService, player.UserId, b.id)
					if okHas and not has then
						local okAward = pcall(BadgeService.AwardBadge, BadgeService, player.UserId, b.id)
						if okAward then notify:FireClient(player, "🏅 Badge : " .. (b.name or "?"), "good") end
					end
				end)
			end
		end
	end
end

local function give(player, currency, amount, kind, sku)
	local s = sessions[player]
	if not s or type(amount) ~= "number" or amount ~= amount then return end
	if s.data.currencies[currency] == nil then return end
	s.data.currencies[currency] += amount
	if kind then economy(player, true, currency, amount, kind, sku) end
	if currency == cfg.main and amount > 0 then
		s.data.stats.collected += amount
		L.addProgress(s.data, today(), "collect", amount, cfg.quests)
	end
end

-- the pet that follows the player: strongest equipped one that has a model
local petModels = ReplicatedStorage:FindFirstChild("ForgePets")
local function followPet(player)
	local s = sessions[player]
	if not s or not petModels then return end
	-- every equipped pet that has a 3D model follows (strongest first)
	local list = {}
	for _, p in s.data.pets do
		if p.eq then
			local def = L.petById(cfg, p.id)
			local model = def and (petModels:FindFirstChild(def.model or def.name) or petModels:FindFirstChild(def.id))
			if model then table.insert(list, { name = model.Name, power = def.power }) end
		end
	end
	table.sort(list, function(x, y) return x.power > y.power end)
	local names = {}
	for _, it in list do table.insert(names, it.name) end
	local joined = #names > 0 and table.concat(names, ",") or nil
	if player:GetAttribute("ForgePets") ~= joined then player:SetAttribute("ForgePets", joined) end
	local best = names[1]
	if player:GetAttribute("ForgePet") ~= best then player:SetAttribute("ForgePet", best) end
end

-- gamepasses ----------------------------------------------------------------
local function refreshPerks(player)
	local s = sessions[player]
	if not s then return end
	for _, gp in cfg.gamepasses do
		if gp.id and gp.id > 0 and gp.perk then
			local ok, owns = pcall(MarketplaceService.UserOwnsGamePassAsync, MarketplaceService, player.UserId, gp.id)
			if ok and owns then s.perks[gp.perk] = true end
		end
	end
end
MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, bought)
	if not bought then return end
	for _, gp in cfg.gamepasses do
		if gp.id == passId and sessions[player] then
			sessions[player].perks[gp.perk] = true
			notify:FireClient(player, "🎉 " .. gp.name .. " activé !", "good")
			sendState(player)
		end
	end
end)

-- developer products: granted once per purchase id, saved before confirming
MarketplaceService.ProcessReceipt = function(info)
	local player = Players:GetPlayerByUserId(info.PlayerId)
	local s = player and sessions[player]
	if not s or not s.loaded or s.released then return Enum.ProductPurchaseDecision.NotProcessedYet end
	local product
	for _, p in cfg.products do
		if p.id == info.ProductId then product = p end
	end
	if not product then return Enum.ProductPurchaseDecision.NotProcessedYet end
	local receipts = s.data.receipts
	if not receipts[info.PurchaseId] then
		give(player, product.currency, product.amount, "IAP", "product_" .. tostring(product.id))
		receipts[info.PurchaseId] = os.time()
		-- keep the receipt list small
		local list = {}
		for id, t in receipts do table.insert(list, { id = id, t = t }) end
		if #list > 60 then
			table.sort(list, function(a, b) return a.t > b.t end)
			for i = 61, #list do receipts[list[i].id] = nil end
		end
	end
	if s.canSave and not save(player, false) then
		return Enum.ProductPurchaseDecision.NotProcessedYet -- Roblox retries later: never lost
	end
	syncStats(player)
	sendState(player)
	notify:FireClient(player, "🎉 +" .. L.abbreviate(product.amount) .. " " .. product.currency, "good")
	return Enum.ProductPurchaseDecision.PurchaseGranted
end

-- egg stands ----------------------------------------------------------------
local standsFolder = Instance.new("Folder")
standsFolder.Name = "ForgeEggStands"
local stands = {} -- [eggId] = Vector3

local function hex(h) return Color3.fromHex(h or "#ffffff") end
local function buildStand(egg)
	local pos = egg.pos or { 0, 0 }
	local origin = Vector3.new(pos[1], 0, pos[2])
	local ray = workspace:Raycast(origin + Vector3.new(0, 200, 0), Vector3.new(0, -400, 0))
	local ground = ray and ray.Position.Y or 0
	local model = Instance.new("Model")
	model.Name = egg.name
	local base = Instance.new("Part")
	base.Name = "Base"
	base.Shape = Enum.PartType.Cylinder
	base.Size = Vector3.new(1.4, 9, 9)
	base.CFrame = CFrame.new(origin.X, ground + 0.7, origin.Z) * CFrame.Angles(0, 0, math.rad(90))
	base.Color = Color3.fromRGB(40, 36, 62)
	base.Material = Enum.Material.SmoothPlastic
	base.Anchored = true
	base.Parent = model
	local ring = Instance.new("Part")
	ring.Name = "Ring"
	ring.Shape = Enum.PartType.Cylinder
	ring.Size = Vector3.new(0.3, 9.6, 9.6)
	ring.CFrame = CFrame.new(origin.X, ground + 0.2, origin.Z) * CFrame.Angles(0, 0, math.rad(90))
	ring.Color = hex(egg.color)
	ring.Material = Enum.Material.Neon
	ring.Anchored = true
	ring.CanCollide = false
	ring.Parent = model
	local shell = Instance.new("Part")
	shell.Name = "Egg"
	shell.Size = Vector3.new(4.2, 5.4, 4.2)
	shell.CFrame = CFrame.new(origin.X, ground + 4.3, origin.Z)
	shell.Color = hex(egg.color)
	shell.Material = Enum.Material.SmoothPlastic
	shell.Anchored = true
	shell.Parent = model
	local mesh = Instance.new("SpecialMesh")
	mesh.MeshType = Enum.MeshType.Sphere
	mesh.Parent = shell
	local light = Instance.new("PointLight")
	light.Color = hex(egg.color)
	light.Range = 14
	light.Brightness = 1.5
	light.Parent = shell
	-- billboard: name, price and the top odds ("1 in N")
	local bb = Instance.new("BillboardGui")
	bb.Name = "Info"
	bb.Size = UDim2.fromOffset(240, 190)
	bb.StudsOffset = Vector3.new(0, 5.5, 0)
	bb.MaxDistance = 70
	bb.AlwaysOnTop = false
	bb.Parent = shell
	local layout = Instance.new("UIListLayout")
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
	layout.Padding = UDim.new(0, 2)
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Parent = bb
	local function line(text, color, h, order)
		local t = Instance.new("TextLabel")
		t.BackgroundTransparency = 1
		t.Size = UDim2.new(1, 0, 0, h)
		t.Font = Enum.Font.FredokaOne
		t.TextScaled = true
		t.Text = text
		t.TextColor3 = color
		t.TextStrokeTransparency = 0.2
		t.LayoutOrder = order
		t.Parent = bb
		return t
	end
	line((egg.emoji or "🥚") .. " " .. egg.name, Color3.new(1, 1, 1), 30, 0)
	line(L.abbreviate(egg.price) .. " " .. egg.currency, Color3.fromRGB(255, 221, 87), 22, 1)
	local odds = L.eggOdds(cfg, egg, 1)
	table.sort(odds, function(a, b) return a.p > b.p end)
	for i, o in odds do
		local def = L.petById(cfg, o.pet)
		local rar = cfg.rarities[o.tier]
		local pct = o.p * 100
		local txt = ("%s %s  %s%%  (1 sur %s)"):format(def.emoji or "", def.name, pct >= 1 and string.format("%.1f", pct) or string.format("%.3g", pct), L.abbreviate(math.max(1, math.floor(1 / o.p + 0.5))))
		line(txt, hex(rar and rar.color), 15, 1 + i)
	end
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "Hatch"
	prompt.ActionText = "Ouvrir"
	prompt.ObjectText = egg.name
	prompt.HoldDuration = 0.2
	prompt.MaxActivationDistance = 12
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.Parent = shell
	local triple = prompt:Clone()
	triple.Name = "Hatch3"
	triple.ActionText = "Ouvrir ×3"
	triple.KeyboardKeyCode = Enum.KeyCode.R
	triple.UIOffset = Vector2.new(0, 70)
	triple.Parent = shell
	model:SetAttribute("ForgeEgg", egg.id)
	model.Parent = standsFolder
	stands[egg.id] = shell.Position
	return prompt, triple
end

-- actions -------------------------------------------------------------------
local rng = Random.new()
local COOLDOWN = { rename = 3, tradeRequest = 2, tradeOffer = 0.3, tradeReady = 0.5, tradeCancel = 0.5, hatch = 0.45, equip = 0.12, unequip = 0.12, equipBest = 0.8, sell = 0.12, sellAll = 1.5, rebirth = 1, daily = 1.5, claimQuest = 0.5, redeem = 2, state = 0.5 }

local function nearEgg(player, eggId)
	local pos = stands[eggId]
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not pos or not root then return false end
	return (root.Position - pos).Magnitude <= (cfg.hatchRange or 22)
end

local actions = {}
function actions.hatch(player, s, eggId, count)
	local egg = type(eggId) == "string" and L.eggById(cfg, eggId)
	if not egg then return { ok = false, err = "Œuf inconnu" } end
	if not nearEgg(player, egg.id) then return { ok = false, err = "Approche-toi de l'œuf" } end
	count = (count == 3 and s.perks.triple) and 3 or 1
	local cost = egg.price * count
	if (s.data.currencies[egg.currency] or 0) < cost then return { ok = false, err = "Pas assez de " .. egg.currency } end
	local maxPets = L.limits(cfg, s.perks)
	if L.count(s.data) + count > maxPets then return { ok = false, err = "Inventaire plein : vends des pets" } end
	s.data.currencies[egg.currency] -= cost
	economy(player, false, egg.currency, cost, "Shop", "egg_" .. egg.id)
	funnel(player, 2)
	local luck = L.luck(cfg, s.perks)
	local results = {}
	for _ = 1, count do
		local pet, nextPity, forced = L.hatch(cfg, egg, luck, s.data.pity[egg.id] or 0, rng:NextNumber())
		s.data.pity[egg.id] = nextPity
		local uid = "p" .. s.data.nextUid
		s.data.nextUid += 1
		L.addPet(s.data, uid, pet, maxPets)
		s.data.stats.hatched += 1
		local odds = L.eggOdds(cfg, egg, luck)
		local p = 0
		for _, o in odds do if o.pet == pet then p = o.p end end
		table.insert(results, { uid = uid, pet = pet, forced = forced, chance = p })
	end
	L.addProgress(s.data, today(), "hatch", count, cfg.quests)
	-- auto-equip into free slots
	local _, maxEquip = L.limits(cfg, s.perks)
	for _, r in results do
		if L.equip(s.data, r.uid, maxEquip) and s.data.pets[r.uid].eq then funnel(player, 3) end
	end
	hatched:FireClient(player, egg.id, results)
	return { ok = true }
end
function actions.equip(player, s, uid)
	if type(uid) ~= "string" then return { ok = false } end
	local _, maxEquip = L.limits(cfg, s.perks)
	local ok, err = L.equip(s.data, uid, maxEquip)
	if ok then funnel(player, 3) end
	return { ok = ok, err = err == "limit" and ("Maximum " .. maxEquip .. " pets équipés") or err }
end
function actions.unequip(player, s, uid)
	if type(uid) ~= "string" then return { ok = false } end
	return { ok = (L.unequip(s.data, uid)) }
end
function actions.equipBest(player, s)
	local _, maxEquip = L.limits(cfg, s.perks)
	return { ok = true, n = L.equipBest(cfg, s.data, maxEquip) }
end
function actions.sell(player, s, uid)
	if type(uid) ~= "string" or not s.data.pets[uid] then return { ok = false, err = "Pet introuvable" } end
	if s.data.pets[uid].eq then return { ok = false, err = "Déséquipe-le d'abord" } end
	local value = L.sell(cfg, s.data, uid)
	give(player, cfg.main, value, "Gameplay", "sell")
	return { ok = true, value = value }
end
function actions.sellAll(player, s, maxTier)
	maxTier = math.clamp(tonumber(maxTier) or 2, 1, #cfg.rarities)
	local total, n = 0, 0
	for uid, p in s.data.pets do
		local def = L.petById(cfg, p.id)
		if not p.eq and def and L.tierOf(cfg, def.rarity) <= maxTier then
			total += L.sell(cfg, s.data, uid)
			n += 1
		end
	end
	give(player, cfg.main, total, "Gameplay", "sellAll")
	return { ok = true, value = total, n = n }
end
function actions.rebirth(player, s)
	local rb = cfg.rebirth
	local cost = L.rebirthCost(cfg, s.data.rebirths)
	if (s.data.currencies[rb.currency] or 0) < cost then return { ok = false, err = "Il faut " .. L.abbreviate(cost) .. " " .. rb.currency } end
	s.data.currencies[rb.currency] = 0
	s.data.rebirths += 1
	if rb.reward then give(player, rb.reward.currency, rb.reward.amount, "Gameplay", "rebirth") end
	funnel(player, 4)
	L.addProgress(s.data, today(), "rebirth", 1, cfg.quests)
	return { ok = true, rebirths = s.data.rebirths }
end
function actions.daily(player, s)
	local ok, streak, index = L.daily(s.data, today(), #cfg.daily)
	if not ok then return { ok = false, err = "Reviens demain !" } end
	local reward = cfg.daily[index]
	s.data.daily.last = today()
	s.data.daily.streak = streak
	give(player, reward.currency, reward.amount, "TimedReward", "daily")
	return { ok = true, day = index, streak = streak, currency = reward.currency, amount = reward.amount }
end
function actions.claimQuest(player, s, qid)
	for _, quest in cfg.quests do
		if quest.id == qid then
			if not L.canClaimQuest(s.data, today(), quest) then return { ok = false, err = "Quête pas finie" } end
			L.questsForDay(s.data, today()).claimed[quest.id] = true
			give(player, quest.currency, quest.amount, "TimedReward", "quest_" .. quest.id)
			return { ok = true, currency = quest.currency, amount = quest.amount }
		end
	end
	return { ok = false, err = "Quête inconnue" }
end
function actions.redeem(player, s, code)
	local c, err = L.redeem(cfg, s.data, code, os.time())
	if not c then return { ok = false, err = ({ used = "Code déjà utilisé", expired = "Code expiré", unknown = "Code inconnu", invalid = "Code invalide" })[err] or err } end
	give(player, c.currency, c.amount, "Gameplay", "code")
	return { ok = true, currency = c.currency, amount = c.amount }
end
-- pet names typed by players are always filtered by Roblox before anyone sees them
function actions.rename(player, s, uid, text)
	local pet = type(uid) == "string" and s.data.pets[uid]
	if not pet then return { ok = false, err = "Pet introuvable" } end
	if type(text) ~= "string" then return { ok = false } end
	text = string.gsub(text, "^%s+", ""):gsub("%s+$", "")
	if #text == 0 then pet.nick = nil return { ok = true } end
	if utf8.len(text) == nil or utf8.len(text) > 20 then return { ok = false, err = "20 caractères maximum" } end
	local ok, result = pcall(TextService.FilterStringAsync, TextService, text, player.UserId)
	if not ok then return { ok = false, err = "Filtre Roblox indisponible, réessaie" } end
	local ok2, clean = pcall(result.GetNonChatStringForBroadcastAsync, result)
	if not ok2 then return { ok = false, err = "Filtre Roblox indisponible, réessaie" } end
	pet.nick = clean
	return { ok = true, nick = clean }
end

-- trading: both players invite each other, put pets on the table, both press ready;
-- the swap is re-validated and done in one step on the server, then both saves run
local trades, invites = {}, {}
local TRADE_MAX = (cfg.trading and cfg.trading.max) or 8
tradeView = function(player)
	local t = trades[player]
	if not t then return nil end
	local o = trades[t.with]
	local theirs = {}
	for _, uid in (o and o.offer) or {} do
		local p = sessions[t.with] and sessions[t.with].data.pets[uid]
		if p then table.insert(theirs, { id = p.id, nick = p.nick }) end
	end
	return { with = t.with.Name, withId = t.with.UserId, mine = t.offer, theirs = theirs, ready = t.ready, theirReady = o and o.ready or false }
end
local function closeTrade(player, msg)
	local t = trades[player]
	if not t then return end
	trades[player] = nil
	local other = t.with
	if trades[other] and trades[other].with == player then
		trades[other] = nil
		if msg then notify:FireClient(other, msg, "bad") end
		sendState(other)
	end
end
function actions.tradeRequest(player, s, userId)
	if cfg.trading and cfg.trading.enabled == false then return { ok = false, err = "Échanges désactivés" } end
	local other = Players:GetPlayerByUserId(tonumber(userId) or 0)
	if not other or other == player or not sessions[other] or not sessions[other].loaded then return { ok = false, err = "Joueur introuvable" } end
	if trades[player] or trades[other] then return { ok = false, err = "Déjà en échange" } end
	invites[player] = invites[player] or {}
	invites[player][other.UserId] = os.clock()
	local back = invites[other] and invites[other][player.UserId]
	if back and os.clock() - back < 60 then
		invites[player][other.UserId], invites[other][player.UserId] = nil, nil
		trades[player] = { with = other, offer = {}, ready = false }
		trades[other] = { with = player, offer = {}, ready = false }
		notify:FireClient(other, "🤝 Échange ouvert avec " .. player.Name, "good")
		sendState(other)
		return { ok = true, opened = true }
	end
	notify:FireClient(other, "🤝 " .. player.Name .. " veut échanger : ouvre Échange et invite-le aussi", "info")
	return { ok = true, opened = false }
end
function actions.tradeOffer(player, s, list)
	local t = trades[player]
	if not t then return { ok = false, err = "Pas d'échange en cours" } end
	if type(list) ~= "table" or #list > TRADE_MAX then return { ok = false, err = "Maximum " .. TRADE_MAX .. " pets" } end
	local clean, seen = {}, {}
	for _, uid in list do
		local p = type(uid) == "string" and s.data.pets[uid]
		if not p or seen[uid] then return { ok = false, err = "Pet invalide" } end
		if p.eq then return { ok = false, err = "Déséquipe d'abord tes pets à échanger" } end
		seen[uid] = true
		table.insert(clean, uid)
	end
	t.offer = clean
	t.ready = false
	if trades[t.with] then trades[t.with].ready = false end
	sendState(t.with)
	return { ok = true }
end
local function commitTrade(a, b)
	local sa, sb, ta, tb = sessions[a], sessions[b], trades[a], trades[b]
	local function stillOwned(sess, offer)
		for _, uid in offer do
			local p = sess.data.pets[uid]
			if not p or p.eq then return false end
		end
		return true
	end
	if not (sa and sb and stillOwned(sa, ta.offer) and stillOwned(sb, tb.offer)) then return false, "Les pets ont changé" end
	local maxA = L.limits(cfg, sa.perks)
	local maxB = L.limits(cfg, sb.perks)
	if L.count(sa.data) - #ta.offer + #tb.offer > maxA or L.count(sb.data) - #tb.offer + #ta.offer > maxB then return false, "Inventaire plein" end
	local moveA, moveB = {}, {}
	for _, uid in ta.offer do table.insert(moveA, sa.data.pets[uid]); sa.data.pets[uid] = nil end
	for _, uid in tb.offer do table.insert(moveB, sb.data.pets[uid]); sb.data.pets[uid] = nil end
	local function receive(sess, pets)
		for _, p in pets do
			local uid = "p" .. sess.data.nextUid
			sess.data.nextUid += 1
			sess.data.pets[uid] = { id = p.id, eq = false, nick = p.nick }
		end
	end
	receive(sa, moveB)
	receive(sb, moveA)
	sa.dirty, sb.dirty = true, true
	return true
end
function actions.tradeReady(player, s)
	local t = trades[player]
	if not t then return { ok = false, err = "Pas d'échange en cours" } end
	t.ready = true
	local other = t.with
	local o = trades[other]
	if o and o.ready then
		local done, why = commitTrade(player, other)
		trades[player], trades[other] = nil, nil
		if done then
			task.spawn(save, player, false)
			task.spawn(save, other, false)
			for _, p in { player, other } do
				notify:FireClient(p, "🤝 Échange terminé !", "good")
				followPet(p)
				syncStats(p)
				checkBadges(p)
			end
		else
			notify:FireClient(other, "Échange annulé : " .. why, "bad")
		end
		sendState(other)
		return { ok = done, err = not done and ("Échange annulé : " .. why) or nil, done = done }
	end
	sendState(other)
	return { ok = true }
end
closeTradeOnLeave = function(player)
	closeTrade(player, "🤝 " .. player.Name .. " est parti : échange annulé")
	invites[player] = nil
end
function actions.tradeCancel(player)
	closeTrade(player, "🤝 " .. player.Name .. " a annulé l'échange")
	return { ok = true }
end

function actions.state() return { ok = true } end

request.OnServerInvoke = function(player, action, a, b)
	local s = sessions[player]
	if not s or not s.loaded then return { ok = false, err = "Chargement…" } end
	if type(action) ~= "string" or not actions[action] then return { ok = false, err = "Action inconnue" } end
	if not s.limiter(action, os.clock(), COOLDOWN[action] or 0.3) then return { ok = false, err = "Doucement !", slow = true } end
	local ok, result = pcall(actions[action], player, s, a, b)
	if not ok then
		warn("[ForgeSystems] " .. action .. " error: " .. tostring(result))
		return { ok = false, err = "Erreur serveur" }
	end
	if result.ok then
		s.dirty = true
		syncStats(player)
		followPet(player)
		checkBadges(player)
	end
	sendState(player)
	return result
end

-- players -------------------------------------------------------------------
local function onJoin(player)
	if sessions[player] then return end
	local s = { perks = {}, badges = {}, limiter = L.newLimiter(), loaded = false, canSave = store ~= nil, joined = os.clock() }
	sessions[player] = s
	makeStats(player)
	local data, why = load(player)
	if not player.Parent then sessions[player] = nil return end
	if not data then
		if why == "locked" then
			player:Kick("Ta partie est encore ouverte sur un autre serveur. Reviens dans une minute.")
			sessions[player] = nil
			return
		end
		-- DataStore down: play with fresh data but never overwrite the real save
		data = L.defaultData(cfg)
		s.canSave = false
		notify:FireClient(player, "⚠️ Sauvegarde indisponible : ta progression de cette partie ne sera pas enregistrée", "bad")
	end
	s.data = data
	refreshPerks(player)
	s.loaded = true
	syncStats(player)
	followPet(player)
	funnel(player, 1)
	checkBadges(player)
	sendState(player)
end

local function onLeave(player)
	closeTradeOnLeave(player)
	local s = sessions[player]
	if not s then return end
	if s.loaded then
		if board and s.canSave then pcall(board.SetAsync, board, tostring(player.UserId), math.floor(s.data.currencies[cfg.leaderboard.stat] or s.data.rebirths or 0)) end
		save(player, true)
	end
	sessions[player] = nil
end

Players.PlayerAdded:Connect(onJoin)
Players.PlayerRemoving:Connect(onLeave)
for _, p in Players:GetPlayers() do task.spawn(onJoin, p) end

game:BindToClose(function()
	local pending = 0
	for player, s in sessions do
		if s.loaded then
			pending += 1
			task.spawn(function()
				save(player, true)
				pending -= 1
			end)
		end
	end
	local t0 = os.clock()
	while pending > 0 and os.clock() - t0 < 25 do task.wait(0.2) end
end)

-- egg stands + prompts --------------------------------------------------------
for _, egg in cfg.eggs do
	local prompt, triple = buildStand(egg)
	local function run(player, n)
		local s = sessions[player]
		if not s or not s.loaded then return end
		if not s.limiter("hatch", os.clock(), COOLDOWN.hatch) then return end
		if n == 3 and not s.perks.triple then
			-- not owned: offer the gamepass if it is set up
			for _, gp in cfg.gamepasses do
				if gp.perk == "triple" and gp.id > 0 then MarketplaceService:PromptGamePassPurchase(player, gp.id) return end
			end
			notify:FireClient(player, "Ouvrir ×3 : gamepass pas encore configuré", "bad")
			return
		end
		local result = actions.hatch(player, s, egg.id, n)
		if result.ok then
			s.dirty = true
			syncStats(player)
			followPet(player)
		else
			notify:FireClient(player, result.err, "bad")
		end
		sendState(player)
	end
	prompt.Triggered:Connect(function(player) run(player, 1) end)
	triple.Triggered:Connect(function(player) run(player, 3) end)
end
standsFolder.Parent = workspace

-- leaderboard board -------------------------------------------------------------
local boardText
if board then
	local lb = cfg.leaderboard
	local part = Instance.new("Part")
	part.Name = "ForgeLeaderboard"
	part.Size = Vector3.new(14, 18, 1)
	part.Anchored = true
	part.CFrame = CFrame.new(lb.pos[1], 9.5, lb.pos[2])
	part.Color = Color3.fromRGB(24, 20, 48)
	part.Material = Enum.Material.SmoothPlastic
	local sg = Instance.new("SurfaceGui")
	sg.Face = Enum.NormalId.Back
	sg.CanvasSize = Vector2.new(560, 720)
	sg.Parent = part
	boardText = Instance.new("TextLabel")
	boardText.Size = UDim2.fromScale(1, 1)
	boardText.BackgroundColor3 = Color3.fromRGB(24, 20, 48)
	boardText.TextColor3 = Color3.new(1, 1, 1)
	boardText.Font = Enum.Font.FredokaOne
	boardText.TextSize = 34
	boardText.TextYAlignment = Enum.TextYAlignment.Top
	boardText.Text = "🏆 Top " .. lb.stat .. "\n…"
	boardText.Parent = sg
	local front = sg:Clone()
	front.Face = Enum.NormalId.Front
	front.Parent = part
	part.Parent = workspace
	task.spawn(function()
		while true do
			-- publish everyone's value, then read the top 10
			for player, s in sessions do
				if s.loaded and s.canSave then
					pcall(board.SetAsync, board, tostring(player.UserId), math.floor(s.data.currencies[lb.stat] or (lb.stat == "Rebirths" and s.data.rebirths) or 0))
				end
			end
			local ok, pages = pcall(board.GetSortedAsync, board, false, 10)
			if ok then
				local lines = { "🏆 Top " .. lb.stat }
				for rank, entry in pages:GetCurrentPage() do
					local okName, name = pcall(Players.GetNameFromUserIdAsync, Players, tonumber(entry.key))
					table.insert(lines, ("%d. %s  %s"):format(rank, okName and name or "?", L.abbreviate(entry.value)))
				end
				local text = table.concat(lines, "\n")
				for _, g in part:GetChildren() do
					if g:IsA("SurfaceGui") then g:FindFirstChildOfClass("TextLabel").Text = text end
				end
			end
			task.wait(75)
		end
	end)
end

-- income + playtime + autosave ---------------------------------------------------
local income = cfg.income or { amount = 0, every = 1 }
task.spawn(function()
	local tick, minuteAcc = 0, {}
	while true do
		task.wait(math.max(0.5, income.every or 1))
		tick += 1
		for player, s in sessions do
			if s.loaded then
				if (income.amount or 0) > 0 then
					give(player, cfg.main, income.amount * L.multiplier(cfg, s.data, s.perks))
					s.dirty = true
				end
				minuteAcc[player] = (minuteAcc[player] or 0) + (income.every or 1)
				if minuteAcc[player] >= 60 then
					minuteAcc[player] -= 60
					L.addProgress(s.data, today(), "playtime", 1, cfg.quests)
				end
				syncStats(player)
				if tick % 5 == 0 then sendState(player) end
			end
		end
		for player in minuteAcc do
			if not sessions[player] then minuteAcc[player] = nil end
		end
	end
end)
task.spawn(function()
	while true do
		task.wait(AUTOSAVE)
		for player, s in sessions do
			if s.loaded and s.dirty then
				s.dirty = false
				task.spawn(save, player, false)
			end
		end
	end
end)

if RunService:IsStudio() and not store then
	print("[ForgeSystems] running without DataStores (enable Studio API access to test saving)")
end

-- anti-cheat: horizontal speed check (rubber-band, never kicks; set the player
-- attribute ForgeTeleporting = true around your own teleports) ----------------
if not (cfg.antiCheat and cfg.antiCheat.speed == false) then
	local last, strikes = {}, {}
	task.spawn(function()
		while true do
			task.wait(0.5)
			for _, player in Players:GetPlayers() do
				local char = player.Character
				local root = char and char:FindFirstChild("HumanoidRootPart")
				local hum = char and char:FindFirstChildOfClass("Humanoid")
				if not root or not hum or hum.Health <= 0 or hum.SeatPart or player:GetAttribute("ForgeTeleporting") then
					last[player] = root and root.Position or nil
					strikes[player] = 0
				else
					local pos, prev = root.Position, last[player]
					local moved = prev and Vector3.new(pos.X - prev.X, 0, pos.Z - prev.Z).Magnitude or 0
					local allowed = (hum.WalkSpeed * 1.5 + 24) * 0.5
					if prev and moved > allowed then
						strikes[player] = (strikes[player] or 0) + 1
						if strikes[player] >= 2 then
							root.CFrame = CFrame.new(prev) * root.CFrame.Rotation
							root.AssemblyLinearVelocity = Vector3.zero
							strikes[player] = 0
						else
							last[player] = pos
						end
					else
						strikes[player] = math.max(0, (strikes[player] or 0) - 1)
						last[player] = pos
					end
				end
			end
			for player in last do
				if not player.Parent then last[player], strikes[player] = nil, nil end
			end
		end
	end)
end
