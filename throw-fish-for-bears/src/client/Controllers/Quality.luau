--[[ Quality: AUTOMATIC graphics level, so weak phones stay smooth.
     Measures the frame rate in 5 s windows (after the first 12 s of loading):
       - two slow windows in a row (< 38 FPS)  -> one level down
       - a long smooth streak (> 56 FPS for 45 s, 60 s after the last drop) -> one level up,
         but never back to a level that was already too slow twice
     Levels:
       3 HIGH   : everything
       2 MEDIUM : fewer particles (same as Low FX), no depth-of-field blur in cinematics,
                  far animals (> 90 studs) lose their small relief bricks
       1 LOW    : + every animal loses its relief bricks (the body keeps its full shape
                  and colours), no shadows
     Purely local: nothing is saved or sent to the server. ]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local Lighting = game:GetService("Lighting")
local Fx = require(script.Parent.Fx)

local Quality = {}
Quality.level = 3
Quality.Changed = Instance.new("BindableEvent")

local WINDOW = 5
local SLOW, FAST = 38, 56
local FAR = 90

local userLow = false -- the Low FX switch (HUD)
local tooSlow = {} -- [level] = times this level was too slow
local bricks: { [Model]: { BasePart } } = {}
local hidden: { [Model]: boolean } = {}
local shadowsBefore = nil
local orig = setmetatable({}, { __mode = "k" }) -- brick -> its own transparency before hiding

local function setHidden(model: Model, on: boolean)
	if (hidden[model] == true) == on then return end
	hidden[model] = on or nil
	for _, b in bricks[model] or {} do
		if b.Parent then
			if on then
				if orig[b] == nil then orig[b] = b.Transparency end
				b.Transparency = 1
			else
				b.Transparency = orig[b] or 0
				orig[b] = nil
			end
		end
	end
end

local function track(b: Instance)
	if b.Name ~= "Brick" or not b:IsA("BasePart") then return end
	local model = b:FindFirstAncestorOfClass("Model")
	if not model then return end
	local list = bricks[model]
	if not list then
		list = {}
		bricks[model] = list
		model.Destroying:Connect(function()
			bricks[model] = nil
			hidden[model] = nil
		end)
	end
	table.insert(list, b)
	if hidden[model] then
		orig[b] = b.Transparency
		b.Transparency = 1
	end
end

local function applyFx()
	Fx.low = userLow or Quality.level <= 2
end

local function apply()
	applyFx()
	if Quality.level <= 1 then
		if shadowsBefore == nil then shadowsBefore = Lighting.GlobalShadows end
		Lighting.GlobalShadows = false
	elseif shadowsBefore ~= nil then
		Lighting.GlobalShadows = shadowsBefore
		shadowsBefore = nil
	end
	Quality.Changed:Fire(Quality.level)
end

-- the Low FX switch keeps working on top of the automatic level
function Quality.setUserLow(on: boolean)
	userLow = on
	applyFx()
end

function Quality.allowsDof(): boolean
	return Quality.level >= 3
end

local function step(delta: number)
	local nl = math.clamp(Quality.level + delta, 1, 3)
	if nl == Quality.level then return end
	Quality.level = nl
	apply()
	if delta < 0 and Quality.onLowered then Quality.onLowered(nl) end
end

function Quality.init()
	for _, d in workspace:GetDescendants() do track(d) end
	workspace.DescendantAdded:Connect(track)

	local frames, t0 = 0, os.clock()
	local started = os.clock()
	local slowStreak, fastTime, lastDrop = 0, 0, 0
	RunService.RenderStepped:Connect(function()
		frames += 1
		local now = os.clock()
		if now - t0 < WINDOW then return end
		local fps = frames / (now - t0)
		frames, t0 = 0, now
		if now - started < 12 then return end -- loading: not representative
		if fps < SLOW then
			slowStreak += 1
			fastTime = 0
			if slowStreak >= 2 and Quality.level > 1 then
				tooSlow[Quality.level] = (tooSlow[Quality.level] or 0) + 1
				slowStreak = 0
				lastDrop = now
				step(-1)
			end
		else
			slowStreak = 0
			if fps > FAST then fastTime += WINDOW else fastTime = 0 end
			local up = Quality.level + 1
			if up <= 3 and fastTime >= 45 and now - lastDrop > 60 and (tooSlow[up] or 0) < 2 then
				fastTime = 0
				step(1)
			end
		end
	end)

	-- far animals lose their bricks at MEDIUM, every animal at LOW (checked every 2 s per model)
	task.spawn(function()
		while true do
			task.wait(2)
			local cam = workspace.CurrentCamera
			local camPos = cam and cam.CFrame.Position or Vector3.zero
			for model in bricks do
				if not model.Parent then
					bricks[model] = nil
					hidden[model] = nil
				elseif Quality.level >= 3 then
					setHidden(model, false)
				elseif Quality.level <= 1 then
					setHidden(model, true)
				else
					local ok, pivot = pcall(model.GetPivot, model)
					setHidden(model, ok and (pivot.Position - camPos).Magnitude > FAR)
				end
			end
		end
	end)
	local _ = Players
end

return Quality
