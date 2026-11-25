--[[ EventService: the live LIMITED EVENT (Shared/Events decides which one, from the clock).
     Publishes it on ReplicatedStorage attributes (EventId / EventEnds) for the HUD and
     tells the whole server when a new one starts. ]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Events = require(Shared.Events)
local EventConfig = require(Shared.Config.EventConfig)
local R = require(script.Parent.Parent.Registry)

local EventService = {}
local current = nil

local function now(): number
	return DateTime.now().UnixTimestamp
end

function EventService.current()
	return current or (Events.at(now()))
end

function EventService.luckMult(): number
	local ev = EventService.current()
	return ev and ev.luck or 1
end

function EventService.speciesBoost(id: string): number
	local ev = EventService.current()
	if ev and table.find(ev.featured, id) then return EventConfig.SpeciesBoost end
	return 1
end

local function update(first: boolean)
	local ev, endsAt = Events.at(now())
	ReplicatedStorage:SetAttribute("EventId", ev.id)
	ReplicatedStorage:SetAttribute("EventEnds", endsAt)
	if current and current.id ~= ev.id and not first then
		for _, p in Players:GetPlayers() do
			R.Notify(p, ("NEW EVENT: %s! Featured animals are x%d more likely!"):format(ev.name, EventConfig.SpeciesBoost), "good")
			if R.PotionService then R.PotionService.refresh(p) end
		end
	end
	current = ev
end

update(true)
task.spawn(function()
	while true do
		task.wait(15)
		update(false)
	end
end)

return EventService
