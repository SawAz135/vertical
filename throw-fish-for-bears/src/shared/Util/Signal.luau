--[[ Signal: tiny synchronous-safe event object (connect / once / fire / wait). ]]
local Signal = {}
Signal.__index = Signal

export type Connection = { Connected: boolean, Disconnect: (self: any) -> () }

function Signal.new()
	return setmetatable({ _handlers = {} }, Signal)
end

function Signal:Connect(fn)
	local conn = { Connected = true }
	local handlers = self._handlers
	function conn:Disconnect()
		if not self.Connected then return end
		self.Connected = false
		local i = table.find(handlers, fn)
		if i then table.remove(handlers, i) end
	end
	table.insert(handlers, fn)
	return conn
end

function Signal:Once(fn)
	local conn
	conn = self:Connect(function(...)
		conn:Disconnect()
		fn(...)
	end)
	return conn
end

function Signal:Fire(...)
	-- copy so handlers may disconnect while firing
	local list = table.clone(self._handlers)
	for _, fn in list do
		task.spawn(fn, ...)
	end
end

function Signal:Wait()
	local thread = coroutine.running()
	self:Once(function(...)
		task.spawn(thread, ...)
	end)
	return coroutine.yield()
end

function Signal:DisconnectAll()
	table.clear(self._handlers)
end

return Signal
