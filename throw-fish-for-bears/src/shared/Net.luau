--[[ Net: one place that declares every remote. The server creates them under
     ReplicatedStorage.Remotes; clients wait for them. Each client->server event
     has a rate limit (calls per second) enforced by the server SecurityService. ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Net = {}

Net.ClientToServer = {
	Ready = 1, EquipSlot = 6, Cast = 3, Hook = 4, ReelFinish = 3, StopFishing = 3,
	ChargeStart = 4, Throw = 3, PlaceBear = 4, StoreBear = 3, PickupBear = 4,
	TakeFromStorage = 3, PlaceBest = 2, SellFish = 4, SellBear = 4, BuyRod = 3, EquipRod = 3,
	UpgradeCapacity = 4, BuyStrength = 6, ClaimDaily = 2, ClaimPlaytime = 4,
	ClaimIndex = 2, SetSetting = 4, SelectFish = 8, TutorialStep = 4, LeaveTraining = 4, SkipCapture = 2,
}

Net.ServerToClient = {
	"Data", "Notify", "State", "FishingFx", "CatchReveal", "ThrowFx", "CaptureFx", "WorkoutFx", "Sfx", "Announce", "FisherFx",
}

local folder
local function getFolder()
	if folder then return folder end
	if RunService:IsServer() then
		folder = ReplicatedStorage:FindFirstChild("Remotes")
		if not folder then
			folder = Instance.new("Folder")
			folder.Name = "Remotes"
			folder.Parent = ReplicatedStorage
		end
	else
		folder = ReplicatedStorage:WaitForChild("Remotes")
	end
	return folder
end

function Net.setupServer()
	local f = getFolder()
	local function make(name)
		if not f:FindFirstChild(name) then
			local r = Instance.new("RemoteEvent")
			r.Name = name
			r.Parent = f
		end
	end
	for name in Net.ClientToServer do make(name) end
	for _, name in Net.ServerToClient do make(name) end
end

function Net.event(name: string): RemoteEvent
	local f = getFolder()
	if RunService:IsServer() then
		return f:FindFirstChild(name) :: RemoteEvent
	end
	return f:WaitForChild(name) :: RemoteEvent
end

return Net
