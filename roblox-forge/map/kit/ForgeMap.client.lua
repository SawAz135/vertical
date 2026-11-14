--[[
	Roblox Forge - map effects (client, StarterPlayerScripts).
	- coins spin and bob (locally, no network cost);
	- gates open only for you when your leaderstats value is high enough;
	- jump pads and checkpoints pulse.
]]
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local player = Players.LocalPlayer

local coins, gates, pulses = {}, {}, {}
local function add(p)
	if not p:IsA("BasePart") then return end
	local r = p:GetAttribute("ForgeRole")
	if r == "coin" then table.insert(coins, { part = p, base = p.CFrame, seed = math.random() * 6 })
	elseif r == "gate" then table.insert(gates, { part = p, baseT = p.Transparency })
	elseif r == "jumppad" or r == "checkpoint" or r == "claim" then table.insert(pulses, { part = p, base = p.Color }) end
end
for _, d in workspace:GetDescendants() do add(d) end
workspace.DescendantAdded:Connect(add)

local function statValue(name)
	local ls = player:FindFirstChild("leaderstats")
	local v = ls and ls:FindFirstChild(name)
	return v and v.Value or 0
end

local function refreshGates()
	for _, g in gates do
		local p = g.part
		local open = statValue(p:GetAttribute("ForgeStat") or "Coins") >= (p:GetAttribute("ForgeNeed") or 0)
		p.CanCollide = not open
		p.Transparency = open and math.max(g.baseT, 0.85) or g.baseT
		local gui = p:FindFirstChild("ForgeLabelGui")
		if gui and gui:FindFirstChild("Text") then
			gui.Text.Text = open and "✅ Ouvert" or ("🔒 " .. (p:GetAttribute("ForgeNeed") or 0) .. " " .. (p:GetAttribute("ForgeStat") or "Coins"))
		end
	end
end
task.spawn(function()
	local ls = player:WaitForChild("leaderstats", 30)
	if not ls then return end
	local function hook(v) if v:IsA("ValueBase") then v.Changed:Connect(refreshGates) end end
	for _, v in ls:GetChildren() do hook(v) end
	ls.ChildAdded:Connect(function(v) hook(v); refreshGates() end)
	refreshGates()
end)

RunService.RenderStepped:Connect(function()
	local t = os.clock()
	for _, c in coins do
		if c.part.Parent then
			c.part.CFrame = c.base * CFrame.new(0, math.sin(t * 2 + c.seed) * 0.35, 0) * CFrame.Angles(0, (t * 2.2 + c.seed) % (2 * math.pi), 0)
		end
	end
	local k = 0.5 + 0.5 * math.sin(t * 4)
	for _, q in pulses do
		if q.part.Parent then q.part.Color = q.base:Lerp(Color3.new(1, 1, 1), 0.25 * k) end
	end
end)
