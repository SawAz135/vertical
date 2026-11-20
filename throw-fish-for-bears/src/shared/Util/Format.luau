--[[ Number / text formatting shared by HUD, menus and overhead labels. ]]
local Format = {}

local SUFFIXES = { "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc" }

function Format.short(n: number): string
	if n ~= n then return "0" end
	local neg = n < 0
	n = math.abs(n)
	if n < 1000 then
		local s = if n < 10 and n % 1 ~= 0 then string.format("%.1f", n) else tostring(math.floor(n))
		return (neg and "-" or "") .. s
	end
	local i = 1
	while n >= 1000 and i < #SUFFIXES do
		n /= 1000
		i += 1
	end
	local s
	if n >= 100 then
		s = string.format("%d", math.floor(n))
	elseif n >= 10 then
		s = string.format("%.1f", math.floor(n * 10) / 10)
	else
		s = string.format("%.2f", math.floor(n * 100) / 100)
	end
	s = s:gsub("%.?0+$", "")
	return (neg and "-" or "") .. s .. SUFFIXES[i]
end

function Format.money(n: number): string
	return "$" .. Format.short(n)
end

function Format.perSec(n: number): string
	return "$" .. Format.short(n) .. "/s"
end

function Format.kg(w: number): string
	if w >= 1000 then
		return Format.short(w) .. " kg"
	elseif w >= 100 then
		return string.format("%d kg", math.floor(w + 0.5))
	end
	return string.format("%.1f kg", w)
end

function Format.time(seconds: number): string
	seconds = math.max(0, math.floor(seconds))
	local h = seconds // 3600
	local m = (seconds % 3600) // 60
	local s = seconds % 60
	if h > 0 then
		return string.format("%d:%02d:%02d", h, m, s)
	end
	return string.format("%d:%02d", m, s)
end

function Format.odds(p: number): string
	if p <= 0 then return "—" end
	local inv = 1 / p
	if inv < 1.05 then return "100%" end
	return "1/" .. Format.short(math.floor(inv + 0.5))
end

function Format.percent(p: number): string
	if p >= 0.1 then
		return string.format("%d%%", math.floor(p * 100 + 0.5))
	elseif p >= 0.001 then
		return string.format("%.2f%%", p * 100)
	end
	return string.format("%.4f%%", p * 100)
end

return Format
