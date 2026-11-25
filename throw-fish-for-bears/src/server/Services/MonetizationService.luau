--[[ MonetizationService: Robux purchases.
     - GAMEPASSES (MonetizationConfig.Passes): ownership checked on join and after a
       purchase prompt; stored as player attributes "Pass_<key>" (the server is the
       only one that sets them).
     - DEVELOPER PRODUCTS (luck potions): MarketplaceService.ProcessReceipt. Every grant
       is recorded by PurchaseId in the save and SAVED before Roblox is told it was
       granted, so a purchase is never given twice and never lost. ]]
local Players = game:GetService("Players")
local MarketplaceService = game:GetService("MarketplaceService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local M = require(Shared.Config.MonetizationConfig)
local PotionConfig = require(Shared.Config.PotionConfig)
local R = require(script.Parent.Parent.Registry)

local Monetization = {}
local MAX_RECEIPTS = 60

function Monetization.owns(player: Player, key: string): boolean
	return player:GetAttribute("Pass_" .. key) == true
end

local function applyPasses(player: Player)
	R.EconomyService.recompute(player)
	if R.PotionService then R.PotionService.refresh(player) end
end

local function checkPasses(player: Player)
	for key, pass in M.Passes do
		if pass.id ~= 0 then
			local ok, owned = pcall(MarketplaceService.UserOwnsGamePassAsync, MarketplaceService, player.UserId, pass.id)
			if ok and owned then player:SetAttribute("Pass_" .. key, true) end
		end
	end
	applyPasses(player)
end

function Monetization.onJoin(player: Player)
	task.spawn(checkPasses, player)
end

MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, purchased)
	if not purchased then return end
	local key = M.passById(passId)
	if not key then return end
	player:SetAttribute("Pass_" .. key, true)
	applyPasses(player)
	R.Notify(player, ("Thanks! %s is now active forever!"):format(M.Passes[key].name), "good")
	R.Sfx(player, "Reward")
end)

MarketplaceService.ProcessReceipt = function(info)
	local player = Players:GetPlayerByUserId(info.PlayerId)
	if not player then return Enum.ProductPurchaseDecision.NotProcessedYet end
	local data = R.PlayerData.get(player)
	if not data then return Enum.ProductPurchaseDecision.NotProcessedYet end
	local key, product = M.productById(info.ProductId)
	if not key then
		warn("[TFB] unknown developer product", info.ProductId)
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local rec = data.receipts
	if rec.ids[info.PurchaseId] then
		return Enum.ProductPurchaseDecision.PurchaseGranted -- already given earlier
	end
	-- grant
	data.potions.inv[product.potion] = math.clamp((data.potions.inv[product.potion] or 0) + product.count, 0, 999)
	rec.ids[info.PurchaseId] = os.time()
	table.insert(rec.order, info.PurchaseId)
	while #rec.order > MAX_RECEIPTS do
		local old = table.remove(rec.order, 1)
		rec.ids[old] = nil
	end
	-- saved BEFORE confirming: if the save fails Roblox retries later (the id makes it safe)
	local saved = R.PlayerData.saveNow(player)
	if not saved then
		data.potions.inv[product.potion] -= product.count
		rec.ids[info.PurchaseId] = nil
		table.remove(rec.order)
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	R.PotionService.refresh(player)
	local spec = PotionConfig.get(product.potion)
	R.Notify(player, ("Thanks! +%d %s potion%s"):format(product.count, spec.name, if product.count > 1 then "s" else ""), "good")
	R.Sfx(player, "Reward")
	return Enum.ProductPurchaseDecision.PurchaseGranted
end

return Monetization
