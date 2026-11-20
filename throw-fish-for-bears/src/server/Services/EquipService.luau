--[[ EquipService: what the human character holds (rod, fish or captured bear).
     The server builds the model and joins it to the character so every player sees
     it; clients drive the arm poses from the character attributes:
       Holding = "Rod" | "Fish" | "Bear" | ""      Pose = see HumanPose (client) ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local RodBuilder = require(Shared.Models.RodBuilder)
local FishBuilder = require(Shared.Models.FishBuilder)
local BearBuilder = require(Shared.Models.BearBuilder)
local BearConfig = require(Shared.Config.BearConfig)
local FishConfig = require(Shared.Config.FishConfig)
local Format = require(Shared.Util.Format)
local R = require(script.Parent.Parent.Registry)

local EquipService = {}

local function hand(char: Model): BasePart?
	return (char:FindFirstChild("RightHand") or char:FindFirstChild("Right Arm")) :: BasePart?
end

local function torso(char: Model): BasePart?
	return (char:FindFirstChild("UpperTorso") or char:FindFirstChild("Torso")) :: BasePart?
end

local function prep(model: Model)
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") then
			d.Massless = true
			d.CanCollide = false
			d.CanTouch = false
			d.CanQuery = false
			d.Anchored = false
		end
	end
end

function EquipService.clear(player: Player)
	local char = player.Character
	if not char then return end
	local held = char:FindFirstChild("TFBHeld")
	if held then held:Destroy() end
	char:SetAttribute("Holding", "")
	char:SetAttribute("HeldId", nil)
	char:SetAttribute("Pose", "")
end

function EquipService.holding(player: Player): string
	local char = player.Character
	return if char then (char:GetAttribute("Holding") or "") else ""
end

local function mount(char: Model, model: Model, part0: BasePart, c0: CFrame, jointName: string)
	model.Name = "TFBHeld"
	prep(model)
	local root = model.PrimaryPart
	model:PivotTo(part0.CFrame * c0)
	local m = Instance.new("Motor6D")
	m.Name = jointName
	m.Part0 = part0
	m.Part1 = root
	m.C0 = c0
	m.C1 = CFrame.identity
	m.Parent = part0
	model.Parent = char
	-- the joint lives in the character limb: remove it with the held model
	model.Destroying:Connect(function()
		m:Destroy()
	end)
end

function EquipService.equipRod(player: Player): boolean
	local data = R.PlayerData.get(player)
	local char = player.Character
	if not data or not char or char:GetAttribute("IsBear") then return false end
	local h = hand(char)
	if not h then return false end
	EquipService.clear(player)
	local rod = RodBuilder.build(data.rods.equipped)
	local isR15 = h.Name == "RightHand"
	local c0 = if isR15 then CFrame.new(0, -0.15, 0) * CFrame.Angles(math.rad(-40), 0, 0) else CFrame.new(0, -1, 0) * CFrame.Angles(math.rad(-40), 0, 0)
	mount(char, rod, h, c0, "RodGrip")
	char:SetAttribute("Holding", "Rod")
	char:SetAttribute("Pose", "RodIdle")
	return true
end

function EquipService.equipFish(player: Player, fishId: string): boolean
	local data = R.PlayerData.get(player)
	local char = player.Character
	if not data or not char or char:GetAttribute("IsBear") then return false end
	local fish
	for _, f in data.fish do
		if f.id == fishId then fish = f break end
	end
	if not fish then return false end
	local t = torso(char)
	if not t then return false end
	EquipService.clear(player)
	local model = FishBuilder.build(fish.s, { weight = fish.w, variant = fish.v })
	local width = model:GetAttribute("Height") or 1
	-- carried across the chest in both arms, head to the right
	local c0 = CFrame.new(0, -0.35, -(t.Size.Z / 2 + 0.25 + width * 0.45)) * CFrame.Angles(0, math.pi / 2, 0)
	mount(char, model, t, c0, "FishCarry")
	-- the fish's weight floats above it (+ HUGE for the giants)
	local sc = FishConfig.scaleFor(fish.s, fish.w)
	model:SetAttribute("HeldScale", sc)
	local bb = Instance.new("BillboardGui")
	bb.Name = "FishKg"
	bb.Size = UDim2.fromOffset(150, if sc >= 2.2 then 62 else 34)
	bb.StudsOffsetWorldSpace = Vector3.new(0, 1.2 + (model:GetAttribute("Height") or 1) * 0.6, 0)
	bb.AlwaysOnTop = false
	bb.LightInfluence = 0
	bb.MaxDistance = 60
	bb.Adornee = model.PrimaryPart
	local function label(text: string, y: number, h: number, c1: Color3, c2: Color3)
		local t2 = Instance.new("TextLabel")
		t2.BackgroundTransparency = 1
		t2.Size = UDim2.new(1, 0, 0, h)
		t2.Position = UDim2.fromOffset(0, y)
		t2.Font = Enum.Font.FredokaOne
		t2.TextScaled = true
		t2.Text = text
		t2.TextColor3 = Color3.new(1, 1, 1)
		local st = Instance.new("UIStroke")
		st.Thickness = 3
		st.Parent = t2
		local g = Instance.new("UIGradient")
		g.Rotation = 90
		g.Color = ColorSequence.new(c1, c2)
		g.Parent = t2
		t2.Parent = bb
	end
	if sc >= 2.2 then
		label("HUGE!", 0, 28, Color3.fromRGB(255, 240, 140), Color3.fromRGB(255, 120, 30))
	end
	label(Format.kg(fish.w), if sc >= 2.2 then 28 else 0, 34, Color3.new(1, 1, 1), Color3.fromRGB(255, 214, 60))
	bb.Parent = model
	char:SetAttribute("Holding", "Fish")
	char:SetAttribute("HeldId", fish.id)
	char:SetAttribute("Pose", "HoldFish")
	data.selectedFish = fish.id
	return true
end

-- the captured bear carried above the head (simulator style)
function EquipService.equipBear(player: Player, bear): boolean
	local char = player.Character
	if not char then return false end
	local t = torso(char)
	if not t then return false end
	EquipService.clear(player)
	local spec = BearConfig.get(bear.s)
	local scale = math.min(BearConfig.scaleFor(bear.s, bear.w), 1.2) * 0.5
	local model = BearBuilder.build(bear.s, { scale = scale, variant = bear.v, rarity = bear.r })
	model:SetAttribute("Anim", "Carried")
	local h = spec.body.h * scale
	local legLen = spec.leg.len * scale
	local lift = t.Size.Y / 2 + 2.4 + h / 2 + legLen * 0.25
	mount(char, model, t, CFrame.new(0, lift, 0), "BearCarry")
	char:SetAttribute("Holding", "Bear")
	char:SetAttribute("HeldId", bear.id)
	char:SetAttribute("Pose", "CarryBear")
	return true
end

return EquipService
