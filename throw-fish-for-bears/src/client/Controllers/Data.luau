--[[ Data: client mirror of the player's save data + current gameplay state.
     The server pushes keys through the "Data" remote; UI listens to Changed(key). ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Net = require(ReplicatedStorage.Shared.Net)
local Signal = require(ReplicatedStorage.Shared.Util.Signal)

local Data = {}
Data.values = {}
Data.state = "Loading"
Data.Changed = Signal.new() -- (key)
Data.StateChanged = Signal.new() -- (state, previous)
Data.Ready = Signal.new()
Data.ready = false

function Data.get(key: string)
	return Data.values[key]
end

function Data.init()
	Net.event("Data").OnClientEvent:Connect(function(key, value)
		if key == "*" then
			Data.values = value
			Data.ready = true
			Data.Ready:Fire()
			Data.Changed:Fire("*")
		else
			Data.values[key] = value
			Data.Changed:Fire(key)
		end
	end)
	Net.event("State").OnClientEvent:Connect(function(state)
		local prev = Data.state
		Data.state = state
		Data.StateChanged:Fire(state, prev)
	end)
	Net.event("Ready"):FireServer()
end

function Data.fishById(id: string?)
	if not id then return nil end
	for _, f in Data.values.fish or {} do
		if f.id == id then return f end
	end
	return nil
end

return Data
