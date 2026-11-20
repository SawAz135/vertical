--[[ Maid: collects connections, instances, threads and callbacks and cleans them in one call. ]]
local Maid = {}
Maid.__index = Maid

function Maid.new()
	return setmetatable({ _tasks = {} }, Maid)
end

function Maid:Give(task_)
	table.insert(self._tasks, task_)
	return task_
end

local function clean(t)
	local kind = typeof(t)
	if kind == "RBXScriptConnection" then
		t:Disconnect()
	elseif kind == "Instance" then
		t:Destroy()
	elseif kind == "thread" then
		pcall(task.cancel, t)
	elseif kind == "function" then
		t()
	elseif kind == "table" then
		if t.Destroy then t:Destroy() elseif t.Disconnect then t:Disconnect() end
	end
end

function Maid:Clean()
	local tasks = self._tasks
	self._tasks = {}
	for i = #tasks, 1, -1 do
		clean(tasks[i])
	end
end

Maid.Destroy = Maid.Clean
return Maid
