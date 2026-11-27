--[[ Net: every remote in one place. The server creates them under ReplicatedStorage.Remotes;
     clients wait for them. Each client→server event has a rate limit (calls / second)
     enforced by the server. ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Net = {}

Net.ClientToServer = {
	Ready = 2, Pick = 40, Dump = 14, Shoot = 12, SetTool = 8, Buy = 6, TutorialDone = 2, Invite = 2, Grab = 6,
}
Net.ServerToClient = { "Data", "Field", "Notify", "Say", "Fx", "Pay", "Jar", "Star", "Session" }

local folder
local function getFolder()
	if folder then return folder end
	if RunService:IsServer() then
		folder = ReplicatedStorage:FindFirstChild("Remotes")
		if not folder then folder = Instance.new("Folder"); folder.Name = "Remotes"; folder.Parent = ReplicatedStorage end
	else
		folder = ReplicatedStorage:WaitForChild("Remotes")
	end
	return folder
end

function Net.setupServer()
	local f = getFolder()
	local function make(name)
		if not f:FindFirstChild(name) then local r = Instance.new("RemoteEvent"); r.Name = name; r.Parent = f end
	end
	for name in Net.ClientToServer do make(name) end
	for _, name in Net.ServerToClient do make(name) end
end

function Net.event(name: string): RemoteEvent
	local f = getFolder()
	if RunService:IsServer() then return f:FindFirstChild(name) :: RemoteEvent end
	return f:WaitForChild(name) :: RemoteEvent
end

return Net
