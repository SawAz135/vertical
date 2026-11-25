--[[ Events: WHEN the limited events change (pure maths, same result on server and clients).
     Switch times, Quebec time (America/Toronto):
       TUESDAY 18:00 and SATURDAY 13:00
     Daylight saving (US / Canada rules): EDT (UTC-4) from the 2nd Sunday of March 2:00
     to the 1st Sunday of November 2:00, EST (UTC-5) otherwise.
     Events.at(unixUtc) -> slot index (counts every switch since 1970), event, ends (unix). ]]
local EventConfig = require(script.Parent.Config.EventConfig)

local Events = {}
local DAY = 86400
local TUE = 2 * DAY + 18 * 3600 -- seconds after Sunday 00:00 local
local SAT = 6 * DAY + 13 * 3600

-- days since 1970-01-01 for a civil date (Howard Hinnant's algorithm)
local function daysFromCivil(y: number, m: number, d: number): number
	y = if m <= 2 then y - 1 else y
	local era = (if y >= 0 then y else y - 399) // 400
	local yoe = y - era * 400
	local mp = (m + 9) % 12
	local doy = (153 * mp + 2) // 5 + d - 1
	local doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
	return era * 146097 + doe - 719468
end

local function civilFromDays(z: number): (number, number, number)
	z += 719468
	local era = (if z >= 0 then z else z - 146096) // 146097
	local doe = z - era * 146097
	local yoe = (doe - doe // 1460 + doe // 36524 - doe // 146096) // 365
	local y = yoe + era * 400
	local doy = doe - (365 * yoe + yoe // 4 - yoe // 100)
	local mp = (5 * doy + 2) // 153
	local d = doy - (153 * mp + 2) // 5 + 1
	local m = if mp < 10 then mp + 3 else mp - 9
	return (if m <= 2 then y + 1 else y), m, d
end

-- the n-th Sunday (n >= 1) of a month, as days since epoch
local function nthSunday(y: number, m: number, n: number): number
	local first = daysFromCivil(y, m, 1)
	local wd = (first + 4) % 7 -- 0 = Sunday (1970-01-01 was a Thursday)
	return first + (7 - wd) % 7 + (n - 1) * 7
end

-- UTC offset in hours of Quebec time at a UTC instant
function Events.offset(utc: number): number
	local y = civilFromDays(utc // DAY)
	local startUtc = nthSunday(y, 3, 2) * DAY + 7 * 3600 -- 2:00 EST = 7:00 UTC
	local endUtc = nthSunday(y, 11, 1) * DAY + 6 * 3600 -- 2:00 EDT = 6:00 UTC
	return if utc >= startUtc and utc < endUtc then -4 else -5
end

local function localToUtc(localSec: number): number
	-- try both offsets, keep the one that round-trips (switch times are never in the DST gap)
	local u = localSec + 5 * 3600
	if Events.offset(u) == -5 then return u end
	return localSec + 4 * 3600
end

-- slot index at a UTC instant + the UTC time the slot started / ends
function Events.slot(utc: number): (number, number, number)
	local loc = utc + Events.offset(utc) * 3600
	local days = loc // DAY
	local week = (days + 4) // 7 -- weeks starting on Sunday
	local sunday = week * 7 - 4
	local pos = loc - sunday * DAY
	local idx, startL, endL
	if pos >= SAT then
		idx = week * 2 + 1
		startL = sunday * DAY + SAT
		endL = (sunday + 7) * DAY + TUE
	elseif pos >= TUE then
		idx = week * 2
		startL = sunday * DAY + TUE
		endL = sunday * DAY + SAT
	else
		idx = week * 2 - 1
		startL = (sunday - 7) * DAY + SAT
		endL = sunday * DAY + TUE
	end
	return idx, localToUtc(startL), localToUtc(endL)
end

function Events.at(utc: number)
	local idx, startsAt, endsAt = Events.slot(utc)
	local list = EventConfig.List
	local ev = list[idx % #list + 1]
	local nextEv = list[(idx + 1) % #list + 1]
	return ev, endsAt, idx, startsAt, nextEv
end

Events._civil = civilFromDays
return Events
