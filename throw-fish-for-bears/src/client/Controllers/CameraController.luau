--[[ CameraController: cinematic camera layer.
     Camera.run(fn, duration, opts): fn(t, dt) -> CFrame, fov  is evaluated each
     frame while the camera is Scriptable. Shots are smoothed with springs (no
     jitter), can be chained, and the exit blends back to the gameplay camera
     (restores the player's previous zoom / angle relative to their character).
     Also: restrained shake and FOV punches that work in gameplay and cinematics. ]]
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Easing = require(ReplicatedStorage.Shared.Util.Easing)

local Camera = {}
local cam = workspace.CurrentCamera
local active = nil
local shakeAmp, shakeT = 0, 0
local fovKick = 0
local savedOffset = nil
local baseFov = 70
local blendOut = nil

local function subject(): BasePart?
	local char = Players.LocalPlayer.Character
	return char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
end

function Camera.isBusy(): boolean
	return active ~= nil or blendOut ~= nil
end

--[[ opts.smooth = position spring speed (0 = exact), opts.onDone ]]
function Camera.run(fn, duration: number, opts: any?)
	opts = opts or {}
	if not active and not blendOut then
		local s = subject()
		if s then
			savedOffset = s.CFrame:ToObjectSpace(cam.CFrame)
			savedOffset = { rel = cam.CFrame.Position - s.Position, look = cam.CFrame.LookVector }
		end
		baseFov = cam.FieldOfView
	end
	blendOut = nil
	cam.CameraType = Enum.CameraType.Scriptable
	local token = {}
	active = {
		token = token, fn = fn, t = 0, duration = duration, smooth = opts.smooth or 0,
		onDone = opts.onDone, pos = cam.CFrame.Position, look = cam.CFrame.LookVector, fov = cam.FieldOfView,
		blendIn = opts.blendIn or 0.35, startCF = cam.CFrame, startFov = cam.FieldOfView,
	}
	return token
end

function Camera.stop(instant: boolean?)
	if not active then return end
	local from = cam.CFrame
	local fromFov = cam.FieldOfView
	active = nil
	if instant then
		blendOut = nil
		cam.CameraType = Enum.CameraType.Custom
		cam.FieldOfView = baseFov
		return
	end
	blendOut = { t = 0, dur = 0.55, from = from, fromFov = fromFov }
end

function Camera.shake(amount: number, duration: number)
	shakeAmp = math.max(shakeAmp, amount)
	shakeT = math.max(shakeT, duration)
end

local kickTarget = 0
function Camera.punch(deltaFov: number)
	-- the lens kick is SMOOTHED (no instant FOV jump): it eases in fast, then drifts back
	kickTarget += deltaFov
end

function Camera.init()
	RunService:BindToRenderStep("TFB_Camera", Enum.RenderPriority.Camera.Value + 2, function(dt)
		dt = math.min(dt, 0.1)
		local shakeOffset = CFrame.identity
		if shakeT > 0 then
			shakeT -= dt
			local a = shakeAmp * Easing.sineInOut(math.clamp(shakeT * 2.5, 0, 1))
			-- cinematic shake: a big slow sway + a little fine grain (no high-frequency buzz)
			local t = os.clock()
			local lo, hi = t * 7, t * 17
			shakeOffset = CFrame.Angles(
				(math.noise(lo, 0.3) * 0.8 + math.noise(hi, 4.1) * 0.2) * a * 0.03,
				(math.noise(0.7, lo) * 0.8 + math.noise(5.2, hi) * 0.2) * a * 0.03,
				math.noise(lo, lo) * a * 0.012)
			if shakeT <= 0 then shakeAmp = 0 end
		end
		fovKick += (kickTarget - fovKick) * Easing.damp(16, dt)
		kickTarget *= math.exp(-dt * 4.5)
		if active then
			local a = active
			a.t += dt
			-- a broken shot must never leave the camera stuck: stop it and give control back
			-- a buggy frame must not kill the whole cinematic: hold the last good frame and keep
			-- going (the next moments of the shot usually work); give up only after ~1 s of errors
			local ok, cf, fov = pcall(a.fn, a.t, dt)
			if not ok then
				a.errors = (a.errors or 0) + 1
				if a.errors == 1 then warn("[TFB] camera shot error:", cf) end
				if a.errors > 60 then
					Camera.stop(true)
					return
				end
				cf, fov = a.lastCF, a.lastFov
			else
				a.errors = 0
				if cf then a.lastCF, a.lastFov = cf, fov end
			end
			if cf then
				if a.smooth > 0 then
					local k = Easing.damp(a.smooth, dt)
					a.pos = a.pos:Lerp(cf.Position, k)
					a.look = a.look:Lerp(cf.LookVector, k).Unit
					cf = CFrame.lookAt(a.pos, a.pos + a.look)
				end
				-- blend in from where the camera was
				local bi = Easing.cubicInOut(math.clamp(a.t / a.blendIn, 0, 1))
				if bi < 1 then
					cf = a.startCF:Lerp(cf, bi)
					fov = a.startFov + ((fov or 70) - a.startFov) * bi
				end
				cam.CFrame = cf * shakeOffset
			end
			cam.FieldOfView = math.clamp((fov or 70) + fovKick, 20, 110)
			if a.t >= a.duration then
				local done = a.onDone
				if active == a then Camera.stop() end
				if done then task.spawn(done) end
			end
		elseif blendOut then
			local b = blendOut
			b.t += dt
			local s = subject()
			local k = Easing.cubicInOut(math.clamp(b.t / b.dur, 0, 1))
			local target
			if s and savedOffset then
				local p = s.Position + savedOffset.rel
				target = CFrame.lookAt(p, p + savedOffset.look)
			else
				target = b.from
			end
			cam.CFrame = b.from:Lerp(target, k)
			cam.FieldOfView = b.fromFov + (baseFov - b.fromFov) * k
			if b.t >= b.dur then
				blendOut = nil
				cam.CameraType = Enum.CameraType.Custom
				cam.FieldOfView = baseFov
			end
		else
			if shakeT > 0 then cam.CFrame *= shakeOffset end
			if math.abs(fovKick) > 0.05 then
				cam.FieldOfView = baseFov + fovKick
			end
		end
	end)
end

-- re-anchor the saved gameplay offset to whatever the player now controls
function Camera.resetOffset(rel: Vector3?, look: Vector3?)
	savedOffset = { rel = rel or Vector3.new(0, 9, 16), look = look or Vector3.new(0, -0.45, -0.9).Unit }
end

return Camera
