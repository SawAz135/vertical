--[[ Notify: stacked toast lines in the lower middle of the screen (reference:
     outlined message lines that fade). Kinds: info (white), good (green),
     warn (orange). Also the full-screen white flash used by cinematics. ]]
local Theme = require(script.Parent.Theme)
local Sound = require(script.Parent.Parent.Controllers.Sound)

local Notify = {}
local holder
local flashFrame
local COLORS = {
	info = Color3.fromRGB(255, 255, 255),
	good = Color3.fromRGB(130, 255, 90),
	warn = Color3.fromRGB(255, 170, 60),
}

function Notify.mount(gui: ScreenGui)
	holder = Theme.new("Frame", {
		Name = "Notifications", BackgroundTransparency = 1, Size = UDim2.fromOffset(560, 120),
		Position = UDim2.new(0.5, 0, 0.74, 0), AnchorPoint = Vector2.new(0.5, 1),
	})
	Theme.new("UIListLayout", { VerticalAlignment = Enum.VerticalAlignment.Bottom, HorizontalAlignment = Enum.HorizontalAlignment.Center, Padding = UDim.new(0, 2), SortOrder = Enum.SortOrder.LayoutOrder }).Parent = holder
	holder.Parent = gui
	flashFrame = Theme.new("Frame", {
		Name = "Flash", BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 1,
		Size = UDim2.fromScale(3, 3), Position = UDim2.fromScale(-1, -1), ZIndex = 100, BorderSizePixel = 0,
	})
	flashFrame.Parent = gui
end

local order = 0
function Notify.show(text: string, kind: string?)
	if not holder then return end
	order += 1
	local label = Theme.text({
		Text = text, Size = UDim2.fromOffset(560, 24), Max = 22, Stroke = 2.5, Color = COLORS[kind or "info"] or COLORS.info,
		LayoutOrder = order,
	})
	local scale = Theme.new("UIScale", { Scale = 0.6, Parent = label })
	label.Parent = holder
	Theme.tween(scale, 0.25, { Scale = 1 }, Enum.EasingStyle.Back)
	if kind == "warn" then Sound.play("Error") else Sound.play("Notify") end
	-- keep at most 4 lines
	local lines = {}
	for _, c in holder:GetChildren() do
		if c:IsA("TextLabel") then table.insert(lines, c) end
	end
	table.sort(lines, function(a, b) return a.LayoutOrder < b.LayoutOrder end)
	while #lines > 4 do
		table.remove(lines, 1):Destroy()
	end
	task.delay(2.8, function()
		if not label.Parent then return end
		Theme.tween(label, 0.5, { TextTransparency = 1 })
		local st = label:FindFirstChildOfClass("UIStroke")
		if st then Theme.tween(st, 0.5, { Transparency = 1 }) end
		task.wait(0.5)
		label:Destroy()
	end)
end

function Notify.flash(strength: number?)
	if not flashFrame then return end
	flashFrame.BackgroundTransparency = 1 - (strength or 0.6)
	Theme.tween(flashFrame, 0.45, { BackgroundTransparency = 1 })
end

return Notify
