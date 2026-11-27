--[[ Session: every player plays in their OWN server; the Multiplayer button invites friends.
     - public server = a short airlock: the player is sent to a fresh reserved (private)
       server that belongs to them (TeleportData.owner)
     - an invited friend arrives with the invite's LaunchData (= the access code of the
       inviter's server) and is sent straight into it
     - in Studio or if teleporting fails, everybody simply plays where they are ]]
local Players = game:GetService("Players")
local TeleportService = game:GetService("TeleportService")
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Net = require(ReplicatedStorage.Shared.Net)

local Session = {}
Session.ownerId = 0 -- whose jar this server is
Session.code = nil -- access code of this reserved server (for invites)
Session.onFallback = nil :: ((Player) -> ())?
Session.reserved = game.PrivateServerId ~= "" and game.PrivateServerOwnerId == 0

local function tpData(p: Player)
	local ok, jd = pcall(function() return p:GetJoinData() end)
	if not ok or type(jd) ~= "table" then return nil, nil end
	return jd.TeleportData, jd.LaunchData
end

local function send(p: Player, code: string, owner: number)
	local opts = Instance.new("TeleportOptions")
	opts.ReservedServerAccessCode = code
	opts:SetTeleportData({ owner = owner, code = code })
	Net.event("Session"):FireClient(p, { teleporting = true })
	local ok, err = pcall(function() TeleportService:TeleportAsync(game.PlaceId, { p }, opts) end)
	if not ok then warn("[WMP] teleport failed, playing here:", err); Net.event("Session"):FireClient(p, { teleporting = false }) end
	return ok
end

function Session.onPlayer(p: Player): boolean -- returns true if the player stays in this server
	if RunService:IsStudio() or game.PlaceId == 0 then
		if Session.ownerId == 0 then Session.ownerId = p.UserId end
		return true
	end
	local td, launch = tpData(p)
	if Session.reserved then
		if type(td) == "table" then
			if Session.ownerId == 0 and tonumber(td.owner) then Session.ownerId = tonumber(td.owner) :: number end
			if not Session.code and type(td.code) == "string" then Session.code = td.code end
		end
		if Session.ownerId == 0 then Session.ownerId = p.UserId end
		return true
	end
	-- public airlock: invited → friend's server, otherwise → a new private server
	if type(launch) == "string" and #launch > 10 and #launch < 200 then
		local ok, inv = pcall(function() return HttpService:JSONDecode(launch) end)
		if ok and type(inv) == "table" and type(inv.code) == "string" then
			if send(p, inv.code, tonumber(inv.owner) or p.UserId) then return false end
		end
	end
	local ok, code = pcall(function() return TeleportService:ReserveServer(game.PlaceId) end)
	if ok and code and send(p, code, p.UserId) then return false end
	if Session.ownerId == 0 then Session.ownerId = p.UserId end
	return true
end

-- the invite payload the client puts in ExperienceInviteOptions.LaunchData
function Session.invitePayload(p: Player): string?
	if not Session.code then return nil end
	return HttpService:JSONEncode({ code = Session.code, owner = Session.ownerId })
end

-- a teleport that fails after TeleportAsync returned: the player simply plays here
TeleportService.TeleportInitFailed:Connect(function(p, result, msg)
	warn("[WMP] teleport init failed:", result, msg)
	if Session.ownerId == 0 then Session.ownerId = p.UserId end
	Net.event("Session"):FireClient(p, { teleporting = false })
	if Session.onFallback then Session.onFallback(p) end
end)

Players.PlayerRemoving:Connect(function(p)
	if p.UserId == Session.ownerId and #Players:GetPlayers() > 1 then
		-- the host left: the jar keeps going for the friends (owner unchanged so it saves correctly next time)
	end
end)

return Session
