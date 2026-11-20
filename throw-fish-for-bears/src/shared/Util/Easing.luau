--[[ Easing curves (same maths as Roblox EasingStyle) + smooth helpers for procedural animation. ]]
local Easing = {}

local C1, C3 = 1.70158, 2.70158

function Easing.linear(x) return x end
function Easing.sineInOut(x) return -(math.cos(math.pi * x) - 1) / 2 end
function Easing.sineOut(x) return math.sin(x * math.pi / 2) end
function Easing.sineIn(x) return 1 - math.cos(x * math.pi / 2) end
function Easing.quadOut(x) return 1 - (1 - x) * (1 - x) end
function Easing.quadIn(x) return x * x end
function Easing.quadInOut(x) return if x < 0.5 then 2 * x * x else 1 - (-2 * x + 2) ^ 2 / 2 end
function Easing.cubicOut(x) return 1 - (1 - x) ^ 3 end
function Easing.cubicIn(x) return x ^ 3 end
function Easing.cubicInOut(x) return if x < 0.5 then 4 * x ^ 3 else 1 - (-2 * x + 2) ^ 3 / 2 end
function Easing.quintOut(x) return 1 - (1 - x) ^ 5 end
function Easing.expoOut(x) return if x >= 1 then 1 else 1 - 2 ^ (-10 * x) end
function Easing.backOut(x) return 1 + C3 * (x - 1) ^ 3 + C1 * (x - 1) ^ 2 end
function Easing.backIn(x) return C3 * x ^ 3 - C1 * x * x end
function Easing.elasticOut(x)
	if x == 0 or x == 1 then return x end
	return 2 ^ (-10 * x) * math.sin((x * 10 - 0.75) * (2 * math.pi) / 3) + 1
end

function Easing.clamp01(x) return math.clamp(x, 0, 1) end

-- normalised progress of t inside [a, b]
function Easing.range(t, a, b)
	if b <= a then return if t >= b then 1 else 0 end
	return math.clamp((t - a) / (b - a), 0, 1)
end

-- frame-rate independent exponential smoothing factor
function Easing.damp(speed, dt)
	return 1 - math.exp(-speed * dt)
end

function Easing.lerp(a, b, t) return a + (b - a) * t end

-- a bump 0 -> 1 -> 0 over [0,1]
function Easing.bump(x) return math.sin(math.clamp(x, 0, 1) * math.pi) end

return Easing
