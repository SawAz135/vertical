--[[ Clock: a SMOOTH server clock for animation and cinematics.
     workspace:GetServerTimeNow() is re-synced all the time and wobbles by a few ms every
     frame: poses and cameras keyed on it stutter. This clock runs on the steady local
     os.clock() and drifts very gently toward the server time (big jumps snap). ]]
local Clock = {}
local offset: number? = nil
local lastT = 0

function Clock.now(): number
	local t = os.clock()
	local target = workspace:GetServerTimeNow() - t
	if offset == nil or math.abs(target - (offset :: number)) > 0.25 then
		offset = target
	elseif t > lastT then
		offset = (offset :: number) + (target - (offset :: number)) * math.min(1, (t - lastT) * 0.3)
	end
	lastT = t
	return t + (offset :: number)
end

return Clock
