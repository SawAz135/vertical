--[[ BearBaseService: the player's bear collection inside their base.
     Free placement (validated: own base, spacing, capacity), pick up, store,
     take from storage, place best, sell (with confirmation). Placed bears roam
     with BearAI (mode "Base") and show a small overhead label (name + $/s). ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local Layout = require(Shared.Layout)
local BearConfig = require(Shared.Config.BearConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local GameConfig = require(Shared.Config.GameConfig)
local Formulas = require(Shared.Formulas)
local Format = require(Shared.Util.Format)
local R = require(script.Parent.Parent.Registry)

local BearBase = {}
local agentsByPlayer: { [Player]: { [string]: any } } = {}
local rand = Random.new()

local function rects(base: number)
	local r = Layout.baseRect(base)
	local m = 5
	return { { minX = r.minX + m, maxX = r.maxX - m, minZ = r.minZ + m, maxZ = r.maxZ - m } }
end

local function label(agent, bear)
	local root = agent.root
	local att = root:FindFirstChild("Overhead")
	local tier = RarityConfig.get(bear.r)
	local gui = Instance.new("BillboardGui")
	gui.Name = "BearLabel"
	gui.Size = UDim2.fromOffset(150, 46)
	gui.StudsOffsetWorldSpace = Vector3.new(0, 1.2, 0)
	gui.MaxDistance = 75
	gui.AlwaysOnTop = false
	gui.LightInfluence = 0
	gui.Adornee = att
	local function line(text, y, h, color, size)
		local t = Instance.new("TextLabel")
		t.BackgroundTransparency = 1
		t.Size = UDim2.new(1, 0, h, 0)
		t.Position = UDim2.fromScale(0, y)
		t.Font = Enum.Font.FredokaOne
		t.TextScaled = true
		t.Text = text
		t.TextColor3 = color
		local st = Instance.new("UIStroke")
		st.Thickness = 2
		st.Parent = t
		local c = Instance.new("UITextSizeConstraint")
		c.MaxTextSize = size
		c.Parent = t
		t.Parent = gui
		return t
	end
	local variant = if bear.v ~= "Normal" then (bear.v .. " ") else ""
	local nameLine = line(variant .. BearConfig.get(bear.s).name, 0, 0.5, if tier.textColor then tier.textColor else tier.color, 18)
	if tier.rainbow then nameLine:SetAttribute("Rainbow", true) end
	line(Format.perSec(Formulas.bearIncome(bear)), 0.5, 0.48, Color3.fromRGB(110, 255, 110), 16)
	gui.Parent = root
	-- pick-up prompt (clients hide it on bears they do not own)
	local p = Instance.new("ProximityPrompt")
	p.Name = "TFBPrompt"
	p.ActionText = "Pick Up"
	p.ObjectText = BearConfig.get(bear.s).name
	p.KeyboardKeyCode = Enum.KeyCode.F
	p.MaxActivationDistance = 10 + 2 * agent.scale
	p.HoldDuration = 0.25
	p.RequiresLineOfSight = false
	p:SetAttribute("TFBPrompt", "PickupBear")
	p:SetAttribute("BearId", bear.id)
	p:SetAttribute("Owner", agent.owner and agent.owner.UserId or 0)
	p.Parent = root
end

local function spawnAgent(player: Player, bear)
	local base = R.BaseService.get(player)
	if not base then return end
	local c = Layout.BASE_CENTERS[base]
	local pos = Vector3.new(c.X + (bear.x or 0), 0, c.Z + (bear.z or 0))
	local agent = R.BearAI.spawn({
		species = bear.s, weight = bear.w, variant = bear.v, rarity = bear.r,
		cf = CFrame.new(pos) * CFrame.Angles(0, rand:NextNumber() * 6.28, 0),
		mode = "Base", rects = rects(base), owner = player, bearId = bear.id,
	})
	label(agent, bear)
	agentsByPlayer[player] = agentsByPlayer[player] or {}
	agentsByPlayer[player][bear.id] = agent
	return agent
end

local function despawn(player: Player, id: string)
	local list = agentsByPlayer[player]
	if list and list[id] then
		list[id]:destroy()
		list[id] = nil
	end
end

function BearBase.placedCount(player: Player): number
	local data = R.PlayerData.get(player)
	local n = 0
	for _, b in data.bears do
		if b.placed then n += 1 end
	end
	return n
end

function BearBase.storedCount(player: Player): number
	local data = R.PlayerData.get(player)
	local n = 0
	for _ in data.bears do n += 1 end
	return n - BearBase.placedCount(player)
end

function BearBase.loadPlayer(player: Player)
	local data = R.PlayerData.get(player)
	local cap = Formulas.capacity(data.capacity)
	local n = 0
	for _, b in data.bears do
		if b.placed then
			n += 1
			if n > cap then
				b.placed = false -- never more placed bears than capacity (never deleted)
			else
				spawnAgent(player, b)
			end
		end
	end
	R.EconomyService.recompute(player)
end

local function spacingOk(player: Player, pos: Vector3, ignore: string?): boolean
	local list = agentsByPlayer[player]
	if not list then return true end
	for id, a in list do
		if id ~= ignore then
			local p = a.root.Position
			if Vector3.new(p.X - pos.X, 0, p.Z - pos.Z).Magnitude < GameConfig.Base.minBearSpacing then
				return false
			end
		end
	end
	return true
end

local function carried(player: Player)
	local data = R.PlayerData.get(player)
	local char = player.Character
	if not data or not char or char:GetAttribute("Holding") ~= "Bear" then return nil end
	return data.bears[char:GetAttribute("HeldId")]
end

function BearBase.place(player: Player, pos: Vector3)
	if not R.State.is(player, "CarryingCapturedBear") then return end
	local bear = carried(player)
	local base = R.BaseService.get(player)
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not bear or not base or not root then return end
	local data = R.PlayerData.get(player)
	local cap = Formulas.capacity(data.capacity)
	if BearBase.placedCount(player) >= cap then
		R.Notify(player, ("Base full (%d/%d)! Upgrade capacity in the SHOP or store this bear."):format(cap, cap), "warn")
		return
	end
	pos = Vector3.new(pos.X, 0, pos.Z)
	if (pos - Vector3.new(root.Position.X, 0, root.Position.Z)).Magnitude > 22 then return end
	if not Layout.isInBase(base, pos, 6) then
		R.Notify(player, "Place the bear inside YOUR base.", "warn")
		return
	end
	if not spacingOk(player, pos) then
		R.Notify(player, "Too close to another bear!", "warn")
		return
	end
	local c = Layout.BASE_CENTERS[base]
	bear.placed = true
	bear.x = math.floor((pos.X - c.X) * 10) / 10
	bear.z = math.floor((pos.Z - c.Z) * 10) / 10
	R.EquipService.clear(player)
	R.State.set(player, "Idle", true)
	local agent = spawnAgent(player, bear)
	if agent then
		agent:setAnim("Happy")
		agent.timer = 1.4
		agent.state = "Idle"
	end
	R.PlayerData.push(player, "bears")
	R.EconomyService.recompute(player)
	R.Sfx(player, "Place", pos)
end

function BearBase.store(player: Player)
	if not R.State.is(player, "CarryingCapturedBear") then return end
	local bear = carried(player)
	R.EquipService.clear(player)
	R.State.set(player, "Idle", true)
	if bear then
		R.Notify(player, BearConfig.get(bear.s).name .. " stored in your collection.", "info")
	end
end

local function canTakeBear(player: Player): boolean
	if not R.State.is(player, "Idle") then return false end
	local base = R.BaseService.get(player)
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not base or not root or char:GetAttribute("IsBear") then return false end
	return Layout.isInBase(base, root.Position, -4)
end

function BearBase.pickup(player: Player, id: string)
	local data = R.PlayerData.get(player)
	local bear = data and data.bears[id]
	if not bear or not bear.placed or not canTakeBear(player) then return end
	despawn(player, id)
	bear.placed = false
	R.EquipService.equipBear(player, bear)
	R.State.set(player, "CarryingCapturedBear", true)
	R.PlayerData.push(player, "bears")
	R.EconomyService.recompute(player)
end

function BearBase.takeFromStorage(player: Player, id: string)
	local data = R.PlayerData.get(player)
	local bear = data and data.bears[id]
	if not bear or bear.placed then return end
	if not canTakeBear(player) then
		R.Notify(player, "Go inside your base to place a bear.", "warn")
		return
	end
	R.EquipService.equipBear(player, bear)
	R.State.set(player, "CarryingCapturedBear", true)
end

function BearBase.placeBest(player: Player)
	if not R.State.is(player, "Idle", "CarryingCapturedBear") then return end
	local data = R.PlayerData.get(player)
	local base = R.BaseService.get(player)
	if not base then return end
	local cap = Formulas.capacity(data.capacity)
	local heldId = player.Character and player.Character:GetAttribute("HeldId")
	if R.State.is(player, "CarryingCapturedBear") then
		R.EquipService.clear(player)
		R.State.set(player, "Idle", true)
	end
	local stored = {}
	for _, b in data.bears do
		if not b.placed then table.insert(stored, b) end
	end
	table.sort(stored, function(a, b) return Formulas.bearIncome(a) > Formulas.bearIncome(b) end)
	local placed = 0
	local c = Layout.BASE_CENTERS[base]
	for _, b in stored do
		if BearBase.placedCount(player) >= cap then break end
		for _ = 1, 25 do
			local pos = Vector3.new(c.X + (rand:NextNumber() - 0.5) * (Layout.BASE_SIZE - 16), 0, c.Z + (rand:NextNumber() - 0.5) * (Layout.BASE_SIZE - 16))
			if spacingOk(player, pos) then
				b.placed = true
				b.x = math.floor((pos.X - c.X) * 10) / 10
				b.z = math.floor((pos.Z - c.Z) * 10) / 10
				spawnAgent(player, b)
				placed += 1
				break
			end
		end
	end
	local _ = heldId
	R.PlayerData.push(player, "bears")
	R.EconomyService.recompute(player)
	if placed > 0 then
		R.Notify(player, ("Placed %d bear%s!"):format(placed, if placed > 1 then "s" else ""), "good")
	else
		R.Notify(player, if #stored == 0 then "No stored bears." else "Base full! Upgrade capacity in the SHOP.", "warn")
	end
end

function BearBase.sell(player: Player, id: string, confirm: boolean)
	if not confirm then return end
	local data = R.PlayerData.get(player)
	local bear = data and data.bears[id]
	if not bear then return end
	if R.State.is(player, "ControllingBear", "WatchingEatingCinematic") then return end
	local char = player.Character
	if char and char:GetAttribute("Holding") == "Bear" and char:GetAttribute("HeldId") == id then
		R.EquipService.clear(player)
		R.State.set(player, "Idle", true)
	end
	if bear.placed then despawn(player, id) end
	local value = Formulas.bearSellValue(bear)
	data.bears[id] = nil
	R.EconomyService.add(player, value)
	R.PlayerData.push(player, "bears")
	R.EconomyService.recompute(player)
	R.Notify(player, ("Sold %s for %s"):format(BearConfig.get(bear.s).name, Format.money(value)), "good")
	R.Sfx(player, "Sell")
end

Players.PlayerRemoving:Connect(function(player)
	local list = agentsByPlayer[player]
	if list then
		for _, a in list do a:destroy() end
	end
	agentsByPlayer[player] = nil
end)

return BearBase
