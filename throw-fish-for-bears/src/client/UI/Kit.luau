--[[ Kit: thin layer over the Stud UI kit (shared/StudKit, MIT) for this game:
     icon ids, a button factory with motion + sounds bound, responsive roots and
     3D model thumbnails inside kit slots. ]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UI = require(ReplicatedStorage.Shared.StudKit.StudUI)
local Motion = require(ReplicatedStorage.Shared.StudKit.StudMotion)
local Viewport = require(script.Parent.Viewport)

local K = { UI = UI, Motion = Motion }

-- real icon ids from the Check-UI icon library (catalog of the stud UI skill)
K.Icons = {
	Shop = "rbxassetid://118530114512540", -- Red Shopping Cart 1st Outline
	Index = "rbxassetid://116366045684496", -- Blue Book 1st Outline
	Daily = "rbxassetid://133003669234880", -- Calendar 1st Outline
	Gift = "rbxassetid://117389287600152", -- Red Gift 1st Outline
	Paw = "rbxassetid://133801403773046", -- Paw 1st Outline
	Cash = "rbxassetid://88694661500877", -- Green Cash 1st Outline
	GoldCash = "rbxassetid://89267825858001", -- Golden Cash 1st Outline
	Bag = "rbxassetid://128512969418141", -- Backpack 1st Outline
	Upgrade = "rbxassetid://120868141819368", -- Green Upgrade 1st Outline
	Shoe = "rbxassetid://98292714980053", -- Blue Shoe 1st Outline
	Clover = "rbxassetid://83040598127035", -- Clover 1st Outline
	Bait = "rbxassetid://81714912397250", -- Bait (Fishing) 1st Outline
	House = "rbxassetid://113557408634141", -- Green House 1st Outline
	Star = "rbxassetid://105103627769338", -- Golden Star 1st Outline
	Lightning = "rbxassetid://117522200604233", -- Blue Lighting 1st Outline
	Check = UI.Assets.Check,
	Lock = UI.Assets.Lock,
	Basket = UI.Assets.Basket,
}

K.sounds = nil -- shared "Sons" folder (created by K.init)

function K.init(playerGui: Instance)
	local holder = Instance.new("Folder")
	holder.Name = "TFB_UISounds"
	holder.Parent = playerGui
	K.sounds = Motion.CreateSounds(holder)
end

-- 3D button with hover / press / sound, returns the ImageButton
function K.button(parent: Instance, p, onClick)
	local b = UI.Button(parent, p)
	Motion.BindButton(b, p.Hover or 1.05, K.sounds, onClick)
	return b
end

-- responsive root frame (offset px designed for 1050 x 620)
function K.root(parent: Instance, name: string, size: Vector2, position: UDim2, anchor: Vector2, sizeFactor: number?)
	local f = UI.new("Frame", {
		Name = name, BackgroundTransparency = 1, Size = UDim2.fromOffset(size.X, size.Y),
		Position = position, AnchorPoint = anchor,
	}, parent)
	local sc = UI.new("UIScale", { Name = "WindowScale" }, f)
	Motion.BindResponsive(sc, sizeFactor or 1)
	return f
end

-- real 3D model inside a kit slot / panel (replaces the flat icon)
function K.model(parent: GuiObject, opts)
	opts.size = opts.size or UDim2.fromScale(0.8, 0.8)
	opts.position = opts.position or UDim2.fromScale(0.5, 0.46)
	opts.zindex = opts.zindex or (parent.ZIndex + 3)
	return Viewport.create(parent, opts)
end

-- kit rarity ladder: Common..Mythic, Divine, Cosmic (our Secret -> Divine, Ultra Secret -> Cosmic)
function K.rarityKey(r: string): string
	if r == "Secret" then return "Divine" end
	if r == "UltraSecret" then return "Cosmic" end
	return r
end

-- staggered pop-in of every child (cards / slots) for lively menus
function K.cascade(container: Instance, step: number?)
	local i = 0
	for _, c in container:GetChildren() do
		if c:IsA("GuiObject") then
			local sc = c:FindFirstChild("ButtonScale") or c:FindFirstChildOfClass("UIScale") or UI.new("UIScale", { Name = "ButtonScale" }, c)
			sc.Scale = 0
			i += 1
			task.delay(i * (step or 0.035), function()
				if sc.Parent then Motion.PopIn(c, 0.38) end
			end)
		end
	end
end

-- glossy light sweep across a 3D button every few seconds (idle shine)
function K.shine(button: GuiObject, every: number?)
	local face = button:FindFirstChild("Face") or button
	local bar = UI.new("Frame", {
		Name = "Shine", BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.55, BorderSizePixel = 0,
		Size = UDim2.new(0, 18, 2, 0), Position = UDim2.new(-0.3, 0, -0.5, 0), Rotation = 22, ZIndex = 7,
	}, face)
	task.spawn(function()
		local TweenService = game:GetService("TweenService")
		while bar.Parent do
			task.wait((every or 3) + math.random() * 2)
			if not bar.Parent then break end
			bar.Position = UDim2.new(-0.3, 0, -0.5, 0)
			TweenService:Create(bar, TweenInfo.new(0.55, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Position = UDim2.new(1.3, 0, -0.5, 0) }):Play()
		end
	end)
	return bar
end

K.player = Players.LocalPlayer
return K
