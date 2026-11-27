--[[ State: what the client knows (player data from the server, dug cells, current tool). ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Signal = require(ReplicatedStorage.Shared.Util.Signal)

local State = {
	data = nil :: any, -- money, levels, stats, carry, jar, tutorial
	layer = {} :: { [number]: number },
	empty = {} :: { [number]: number }, -- key → os.clock() when the potato is back
	predicted = {} :: { [number]: number }, -- locally hidden before the server confirms
	tool = "hands",
	mode = "boot", -- boot | menu | book | play | shop
	Changed = Signal.new(),
	FieldChanged = Signal.new(), -- (keys)
	isMobile = false,
	teleporting = false,
}
return State
