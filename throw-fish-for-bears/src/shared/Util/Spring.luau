--[[ Critically-damped / under-damped spring for numbers and Vector3 (camera, UI). ]]
local Spring = {}
Spring.__index = Spring

function Spring.new(initial, speed: number?, damping: number?)
	return setmetatable({
		Position = initial,
		Velocity = initial * 0,
		Target = initial,
		Speed = speed or 12,
		Damping = damping or 1,
	}, Spring)
end

function Spring:Step(dt: number)
	-- semi-implicit integration in small steps for stability at low fps
	local steps = math.max(1, math.ceil(dt / (1 / 120)))
	local h = dt / steps
	local w = self.Speed
	local z = self.Damping
	for _ = 1, steps do
		local accel = (self.Target - self.Position) * (w * w) - self.Velocity * (2 * z * w)
		self.Velocity += accel * h
		self.Position += self.Velocity * h
	end
	return self.Position
end

function Spring:Snap(value)
	self.Position = value
	self.Target = value
	self.Velocity = value * 0
end

function Spring:Impulse(v)
	self.Velocity += v
end

return Spring
