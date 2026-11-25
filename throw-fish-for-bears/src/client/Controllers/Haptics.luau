--[[ Haptics: short vibrations on phones and controllers.
     Phones / tablets: a HapticEffect (Roblox's mobile haptics) - its strength grows with
     the tier. Controllers: the big motor for a short pulse. Everything is in pcall: a
     device without vibration simply ignores it. ]]
local HapticService = game:GetService("HapticService")
local UserInputService = game:GetService("UserInputService")
local SoundService = game:GetService("SoundService")

local Haptics = {}
local effects = {}

local function effect(kind: string)
	if effects[kind] ~= nil then return effects[kind] end
	local ok, e = pcall(function()
		local h = Instance.new("HapticEffect")
		h.Type = Enum.HapticEffectType[kind]
		h.Parent = SoundService
		return h
	end)
	effects[kind] = if ok then e else false
	return effects[kind]
end

-- strength 0..1
function Haptics.pulse(strength: number, duration: number?)
	strength = math.clamp(strength, 0, 1)
	duration = duration or 0.12 + 0.18 * strength
	if UserInputService.TouchEnabled then
		local e = effect(if strength > 0.6 then "GameplayExplosion" elseif strength > 0.3 then "GameplayCollision" else "UIClick")
		if e then pcall(function() e:Play() end) end
	end
	if UserInputService.GamepadEnabled then
		pcall(function()
			local pad = Enum.UserInputType.Gamepad1
			if HapticService:IsVibrationSupported(pad) and HapticService:IsMotorSupported(pad, Enum.VibrationMotor.Large) then
				HapticService:SetMotor(pad, Enum.VibrationMotor.Large, strength)
				HapticService:SetMotor(pad, Enum.VibrationMotor.Small, strength * 0.6)
				task.delay(duration, function()
					pcall(function()
						HapticService:SetMotor(pad, Enum.VibrationMotor.Large, 0)
						HapticService:SetMotor(pad, Enum.VibrationMotor.Small, 0)
					end)
				end)
			end
		end)
	end
end

return Haptics
