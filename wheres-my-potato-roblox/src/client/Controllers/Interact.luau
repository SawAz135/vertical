--[[ Interact: aiming and using tools in first person.
     - hands: click / tap the action button to pick the potato you aim at (one at a time)
     - bucket: hold → every potato around the aim point within the magnet radius flies in
     - vacuum: hold → a suction cone sucks the potatoes in front of you
     - cannon: click → fires a carried potato (ballistic, real physics) toward the bin
     - near the bin with potatoes: hold → they pour into it
     - golden shooting potato on the ground at night: aim + use to grab it
     Picks are predicted locally (instant feedback) and confirmed by the server. ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local RunService = game:GetService("RunService")
local Players = game:GetService("Players")
local Config = require(ReplicatedStorage.Shared.Config)
local Potato = require(ReplicatedStorage.Shared.Potato)
local Net = require(ReplicatedStorage.Shared.Net)
local State = require(script.Parent.State)
local Carpet = require(script.Parent.Carpet)
local VM = require(script.Parent.Viewmodel)
local Fx = require(script.Parent.Fx)
local Sound = require(script.Parent.Sound)

local I = {}
I.prompt = ""
I.hoverPart = nil :: BasePart?
local cam = workspace.CurrentCamera
local player = Players.LocalPlayer
local using = false
local pickT, dumpT, shootT = 0, 0, 0
local hover = Instance.new("SelectionBox"); hover.LineThickness = 0.035; hover.Color3 = Color3.fromRGB(255, 210, 90); hover.SurfaceTransparency = 1; hover.Transparency = 0.15; hover.Parent = workspace

local rayParams = RaycastParams.new(); rayParams.FilterType = Enum.RaycastFilterType.Include
local TOOLS = { "hands", "bucket", "vacuum", "cannon" }

local function levels() return (State.data and State.data.levels) or {} end
function I.unlocked(tool: string): boolean
	if tool == "hands" then return true end
	return (levels()[tool] or 0) > 0
end
function I.setTool(tool: string)
	if not I.unlocked(tool) or State.tool == tool then return end
	State.tool = tool; VM.anim.swap = 1; Sound.play("Click", 0.8)
	Net.event("SetTool"):FireServer(tool)
	State.Changed:Fire()
end

local function root(): BasePart? local c = player.Character; return c and c:FindFirstChild("HumanoidRootPart") :: BasePart? end

local function aim(): (Vector3, BasePart?)
	local cf = cam.CFrame
	rayParams.FilterDescendantsInstances = { Carpet.folder, workspace.Terrain, workspace:FindFirstChild("ShootingPotato") or Carpet.folder }
	local hit = workspace:Raycast(cf.Position, cf.LookVector * 26, rayParams)
	if hit then return hit.Position, hit.Instance :: BasePart end
	return cf.Position + cf.LookVector * 26, nil
end

-- local prediction + flight into the hand, then the request
local function pickCells(keys: { number }, tool: string)
	if #keys == 0 then return end
	local now, flat = os.clock(), {}
	for _, k in keys do
		local part = Carpet.partFor(k)
		local ix, iz = Potato.unkey(k)
		State.predicted[k] = now + 0.7
		if part then
			local _, _, size, variety = Potato.cell(ix, iz, State.layer[k] or 0)
			Fx.flyToHand(part.CFrame, variety, size, VM.handPoint, if tool == "vacuum" then 0.22 else 0.3)
			Fx.dirt(part.Position, if tool == "hands" then 6 else 2)
		end
		table.insert(flat, ix); table.insert(flat, iz)
	end
	Carpet.refresh(keys)
	Net.event("Pick"):FireServer(flat, tool)
end

local function nearBin(): boolean
	local r = root(); if not r then return false end
	local d = (r.Position - Config.BIN.Pos) * Vector3.new(1, 0, 1)
	if d.Magnitude > 11 then return false end
	local to = (Config.BIN.Pos + Vector3.new(0, 1.5, 0) - cam.CFrame.Position).Unit
	return cam.CFrame.LookVector:Dot(to) > 0.55
end

function I.update(dt: number)
	pickT -= dt; dumpT -= dt; shootT -= dt
	I.prompt = ""; hover.Adornee = nil
	if State.mode ~= "play" then using = false; return end
	local c = State.data and State.data.carry or {}
	local tool = State.tool
	local carried = (c.hands or 0) + (c.bucket or 0) + (c.tank or 0)
	local L = levels()
	-- the bin
	if nearBin() and carried > 0 then
		I.prompt = "⬇️ Vider dans le bac (" .. carried .. ")"
		if using and dumpT <= 0 then dumpT = 0.12; Net.event("Dump"):FireServer(); VM.anim.dump = 1; Sound.rate("Dump", 90, 0.8) end
		return
	end
	if nearBin() then I.prompt = "Le bac — apporte des patates !" end
	local p, part = aim()
	-- golden shooting potato
	if part and part.Name == "ShootingPotato" then
		hover.Adornee = part; I.prompt = "✨ Attraper la patate filante"
		if using and pickT <= 0 then pickT = 0.4; Net.event("Grab"):FireServer(part); VM.anim.reach = 1 end
		return
	end
	if tool == "cannon" then
		I.prompt = if carried > 0 then "💥 Tirer vers le bac (" .. carried .. ")" else "💥 Plus de munitions — ramasse des patates"
		if using and shootT <= 0 and carried > 0 then
			shootT = 1 / math.max(1, Config.val(L, "cannon", "rate"))
			local dir = (cam.CFrame.LookVector + Vector3.new(0, 0.18, 0)).Unit
			Net.event("Shoot"):FireServer(dir); VM.anim.recoil = 1; Sound.play("Shoot")
		end
		return
	end
	local capN = if tool == "bucket" then c.capBucket or 0 elseif tool == "vacuum" then c.capTank or 0 else c.capHands or 3
	local n = if tool == "bucket" then c.bucket or 0 elseif tool == "vacuum" then c.tank or 0 else c.hands or 0
	if n >= capN and capN > 0 then
		I.prompt = if tool == "bucket" then "🪣 Seau plein (" .. n .. ") — va au bac !" elseif tool == "vacuum" then "🌀 Réservoir plein — va au bac !" else "✋ Bras pleins (" .. n .. "/" .. capN .. ") — va au bac !"
		return
	end
	if tool == "hands" then
		local key = part and Carpet.keyOf[part]
		if key then
			hover.Adornee = part; I.prompt = "✋ Ramasser"
			if using and pickT <= 0 then
				pickT = if (L.gloves or 0) >= 2 then 0.16 else 0.26
				VM.anim.reach = 1; Sound.play("Pick"); pickCells({ key }, "hands")
			end
		end
	elseif tool == "bucket" then
		local rad = Config.val(L, "magnet", "radius")
		local keys = Carpet.cellsNear(p, rad, 1, nil)
		if #keys > 0 then I.prompt = "🪣 Ramasser au seau (maintenir)"; local hp = Carpet.partFor(keys[1]); if hp then hover.Adornee = hp end end
		if using and pickT <= 0 then
			pickT = 0.08
			local rate = Config.val(L, "magnet", "rate") * 1.6
			local nmax = math.min(capN - n, math.max(1, math.floor(rate * 0.08 + 0.5)))
			local list = Carpet.cellsNear(p, rad, nmax, nil)
			if #list > 0 then VM.anim.scoop = 1; Sound.rate("Scoop", 120); pickCells(list, "bucket") end
		end
	elseif tool == "vacuum" then
		local range = Config.val(L, "vacuum", "range")
		I.prompt = "🌀 Aspirer (maintenir)"
		VM.sucking = using
		if using then
			Sound.rate("Vacuum", 220, 0.7)
			if pickT <= 0 then
				pickT = 0.1
				local rate = Config.val(L, "vacuum", "rate")
				local nmax = math.min(capN - n, math.max(1, math.floor(rate * 0.1 + 0.5)))
				local origin, look = cam.CFrame.Position, cam.CFrame.LookVector
				local list = Carpet.cellsNear(origin + look * range * 0.5, range * 0.55, nmax, function(_, pos)
					local d = pos - origin
					return d.Magnitude < range and d.Unit:Dot(look) > 0.8
				end)
				pickCells(list, "vacuum")
			end
		end
	end
end

function I.start()
	-- PC: left mouse / E ; gamepad: R2 ; mobile: the big action button (HUD)
	UserInputService.InputBegan:Connect(function(input, gp)
		if gp then return end
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.KeyCode == Enum.KeyCode.E or input.KeyCode == Enum.KeyCode.ButtonR2 then using = true end
		local num = ({ [Enum.KeyCode.One] = 1, [Enum.KeyCode.Two] = 2, [Enum.KeyCode.Three] = 3, [Enum.KeyCode.Four] = 4 })[input.KeyCode]
		if num then I.setTool(TOOLS[num]) end
		if input.KeyCode == Enum.KeyCode.ButtonL1 or input.KeyCode == Enum.KeyCode.Q then I.cycle(-1) end
		if input.KeyCode == Enum.KeyCode.ButtonR1 then I.cycle(1) end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.KeyCode == Enum.KeyCode.E or input.KeyCode == Enum.KeyCode.ButtonR2 then using = false end
	end)
	UserInputService.InputChanged:Connect(function(input, gp)
		if gp or input.UserInputType ~= Enum.UserInputType.MouseWheel then return end
		I.cycle(if input.Position.Z > 0 then -1 else 1)
	end)
	RunService.Heartbeat:Connect(I.update)
end
function I.cycle(dir: number)
	local i = table.find(TOOLS, State.tool) or 1
	for _ = 1, 4 do
		i = (i - 1 + dir) % 4 + 1
		if I.unlocked(TOOLS[i]) then I.setTool(TOOLS[i]); return end
	end
end
function I.setUsing(v: boolean) using = v end
I.TOOLS = TOOLS

return I
