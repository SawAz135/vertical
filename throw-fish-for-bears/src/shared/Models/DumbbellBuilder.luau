--[[ DumbbellBuilder: the FISH-UP "fish dumbbell" (stud bar, weight plates, a fish on
     each end) in the colours of a FishUpConfig tier. Used on the station rack and as
     the 3D hero of Shop > Strength. Built along X, centred on the origin. ]]
local Shared = script.Parent.Parent
local Studs = require(script.Parent.Studs)
local FishBuilder = require(script.Parent.FishBuilder)
local FishUpConfig = require(Shared.Config.FishUpConfig)

local DumbbellBuilder = {}
local CF = CFrame.new
local V3 = Vector3.new
local ANG = CFrame.Angles

function DumbbellBuilder.build(tierIndex: number?, scale: number?): Model
	local tier = FishUpConfig.get(tierIndex or 1)
	local s = scale or 1
	local m = Instance.new("Model")
	m.Name = "FishDumbbell"
	local bar = Studs.piece(m, "Bar", V3(5.2 * s, 0.32 * s, 0.32 * s), CF(), tier.metal, "metal", { smooth = true, reflectance = 0.15 })
	bar.Anchored = true
	m.PrimaryPart = bar
	-- grip wrap in the middle
	local grip = Studs.piece(m, "Grip", V3(1.4 * s, 0.4 * s, 0.4 * s), CF(), tier.plateB, "detail")
	grip.Anchored = true
	for _, side in { -1, 1 } do
		-- two plates + collar per side
		for k, w in { 1.5, 1.15 } do
			local plate = Studs.piece(m, "Plate", V3(0.36 * s, w * s, w * s), CF(side * (1.3 + k * 0.38) * s, 0, 0), if k == 1 then tier.plateA else tier.plateB, "detail")
			plate.Shape = Enum.PartType.Cylinder
			plate.Anchored = true
		end
		local collar = Studs.piece(m, "Collar", V3(0.18 * s, 0.6 * s, 0.6 * s), CF(side * 2.25 * s, 0, 0), tier.metal, "metal", { smooth = true })
		collar.Shape = Enum.PartType.Cylinder
		collar.Anchored = true
		-- a fish on each end, nose toward the centre
		local fish = FishBuilder.build("Trout", { scale = 0.8 * s, variant = tier.fish })
		for _, d in fish:GetDescendants() do
			if d:IsA("BasePart") then d.Anchored = true d.CanCollide = false d.CanQuery = false end
		end
		fish:PivotTo(CF(side * 3.25 * s, 0, 0) * ANG(0, side * math.pi / 2, 0))
		fish.Parent = m
	end
	m:SetAttribute("Tier", tierIndex or 1)
	return m
end

return DumbbellBuilder
