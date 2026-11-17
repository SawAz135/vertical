--[[ CaptureController: the local player's bear sequence.
     Spawned  -> wide shot of the FISH on the ground; the bear is completely INVISIBLE (no POV, no bear yet)
     Alert    -> push-in on the fish, a growl comes from the forest
     Run      -> camera stays on the fish; footsteps, dust clouds and shaking show the unseen bear coming
     Eat      -> you only see the FISH GETTING EATEN: it is yanked up by an unseen mouth,
                 thrashes, gulp. The bear is still invisible
     Reveal   -> the bear APPEARS now (black silhouette pop), crane shot ABOVE it: 6 members get their colours back one by one
     Happy    -> hero orbit + flash, then the bear lands in your arms
     Controlling -> you ARE the bear: return HUD (distance, progress, timer), 3D arrow
                 to your base, SPRINT (Shift / button), dust + footsteps
     Arrived / Captured -> celebration, reveal card, carry the bear home and PLACE it
     Placement ghost: a ring under the spot where PLACE will put the bear. ]]
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local Layout = require(Shared.Layout)
local GameConfig = require(Shared.Config.GameConfig)
local BearConfig = require(Shared.Config.BearConfig)
local RarityConfig = require(Shared.Config.RarityConfig)
local Easing = require(Shared.Util.Easing)
local Format = require(Shared.Util.Format)
local Formulas = require(Shared.Formulas)
local Fx = require(script.Parent.Fx)
local Sound = require(script.Parent.Sound)
local Actions = require(script.Parent.Actions)
local CameraController = require(script.Parent.CameraController)
local Cine = require(script.Parent.CinematicFx)
local TweenService = game:GetService("TweenService")
local Sim = require(script.Parent.Parent.UI.Sim)
local K = require(script.Parent.Parent.UI.Kit)
local Data = require(script.Parent.Data)
local Theme = require(script.Parent.Parent.UI.Theme)

local Capture = {}
local player = Players.LocalPlayer
local current = nil -- { bear, fish, landing, den }
local returnGui, returnFill, returnText, returnTimer, returnName
local arrow
local controlling = nil
local sprinting = false
local ghost

Capture.Reveal = nil -- set by ClientMain (UI.Reveal)
Capture.Flash = nil -- set by ClientMain (screen flash function)
Capture.Unlock = nil -- set by ClientMain (UI.BearUnlock.show)

local function headOf(bear: Model): BasePart?
	return bear and bear:FindFirstChild("Head") :: BasePart?
end

local function rootOf(m: Model?): BasePart?
	return m and m.PrimaryPart
end

local function rarityOf(bear: Model?)
	return RarityConfig.get(bear and bear:GetAttribute("Rarity") or "Common")
end

local function bearPitch(bear: Model): number
	return Sound.BearPitch[bear:GetAttribute("Species") or ""] or 1
end

-- FISH POV + bear reveal ---------------------------------------------------------------
-- The bear arrives as a black silhouette; its body parts get their colours back one by
-- one as it comes closer (legs, tail, body, head, jaw, ears). Rarity effects (aura,
-- lights, rainbow) stay hidden until the rarity roulette lands.
-- 6 "members": 4 legs, the body (+ tail), the head (+ jaw, ears)
local REVEAL_ORDER = { "LegFLBone", "LegFRBone", "LegBLBone", "LegBRBone", "Torso", "Head" }
local GROUP_OF = { TailBone = "Torso", JawBone = "Head", EarBoneL = "Head", EarBoneR = "Head" }
local SHADOW = Color3.fromRGB(12, 10, 16)

local function prepareReveal(bear: Model)
	local rv = { groups = {}, saved = {}, fx = {}, idx = 0, bear = bear }
	for _, d in bear:GetDescendants() do
		if d:IsA("BasePart") and d.Transparency < 1 then
			local w = d:FindFirstChildOfClass("WeldConstraint")
			local bone = if w and w.Part0 then w.Part0.Name else "Torso"
			bone = GROUP_OF[bone] or bone
			if not table.find(REVEAL_ORDER, bone) then bone = "Torso" end
			rv.groups[bone] = rv.groups[bone] or {}
			table.insert(rv.groups[bone], d)
			rv.saved[d] = { d.Color, d.Material }
			d.Color = SHADOW
			d.Material = Enum.Material.SmoothPlastic
		elseif d:IsA("ParticleEmitter") or d:IsA("PointLight") or d:IsA("Sparkles") then
			rv.fx[d] = d.Enabled
			d.Enabled = false
		end
	end
	bear:SetAttribute("Silhouette", true)
	return rv
end

local function revealGroup(rv, bone: string, loud: boolean)
	local parts = rv.groups[bone]
	if not parts then return end
	rv.groups[bone] = nil
	local at
	for _, part in parts do
		local sv = rv.saved[part]
		if sv and part.Parent then
			part.Material = sv[2]
			part.Color = Color3.new(1, 1, 1)
			TweenService:Create(part, TweenInfo.new(0.35, Enum.EasingStyle.Quad), { Color = sv[1] }):Play()
			at = at or part.Position
		end
	end
	if at and loud then
		Fx.blocks(at, Color3.new(1, 1, 1), 5, 7, 0.22, { life = 0.5, up = 1, spread = 2 })
		Sound.play("Tick", { pitch = 0.8 + rv.idx * 0.08, volume = 0.6 })
	end
	return at
end

local function revealNext(rv)
	rv.idx += 1
	local bone = REVEAL_ORDER[rv.idx]
	if bone then return revealGroup(rv, bone, true), bone end
	return nil, nil
end

local function revealAll(rv)
	for _, bone in REVEAL_ORDER do revealGroup(rv, bone, false) end
	for bone in rv.groups do revealGroup(rv, bone, false) end
end

local restoreTeeth
local function revealAura(rv)
	if restoreTeeth then restoreTeeth(rv) end
	for inst, en in rv.fx do
		if inst.Parent then inst.Enabled = en end
	end
	rv.fx = {}
	if rv.bear then rv.bear:SetAttribute("Silhouette", nil) end
end

-- the bear exists for the server, but the local player must not see it (only hear it)
-- until the reveal. Transparency is overridden locally AND the local modifier is set, so
-- nothing the animator does (blinking eyelids...) can make a piece show up.
local function setPartsHidden(parts: { BasePart }, hidden: boolean)
	for _, d in parts do
		if d.Parent then
			if hidden then
				if d:GetAttribute("TFBTr") == nil then d:SetAttribute("TFBTr", d.Transparency) end
				d.Transparency = 1
				d.LocalTransparencyModifier = 1
			else
				local tr = d:GetAttribute("TFBTr")
				if tr ~= nil then
					d.Transparency = tr
					d:SetAttribute("TFBTr", nil)
				end
				d.LocalTransparencyModifier = 0
			end
		end
	end
end

local function bearParts(bear: Model): { BasePart }
	local list = {}
	for _, d in bear:GetDescendants() do
		if d:IsA("BasePart") then table.insert(list, d) end
	end
	return list
end

local function setBearHidden(bear: Model, hidden: boolean)
	setPartsHidden(bearParts(bear), hidden)
	for _, d in bear:GetDescendants() do
		if d:IsA("BillboardGui") or d:IsA("SurfaceGui") then d.Enabled = not hidden end
	end
end

local function fishPosOf(c)
	return if c.fish and c.fish.PrimaryPart and c.fish.Parent then c.fish.PrimaryPart.Position else c.landing
end

local function dirToDen(c)
	local v = Vector3.new(c.den.X - c.landing.X, 0, c.den.Z - c.landing.Z)
	return if v.Magnitude > 0.1 then v.Unit else Vector3.new(0, 0, -1)
end

local MOUTH_PARTS = { MouthInside = true, Tongue = true, TongueTip = true }
local function isMouthPart(p: BasePart): boolean
	return MOUTH_PARTS[p.Name] == true or p.Name:sub(1, 5) == "Tooth"
end

------------------------------------------------------------------------------------------
-- 1) THE FISH'S EYES. The fish lies on the ground; the camera IS its eye. The bear is
-- never shown: you only HEAR it (growl, heavy steps getting louder, breathing), you feel
-- the ground shake, the fish panics: trembling view, glances everywhere, blinking faster,
-- heartbeat, the world darkening at the edges, tunnel vision.
------------------------------------------------------------------------------------------
local function povStart()
	local c = current
	c.mode = "pov"
	c.panic = 0.15
	c.rv = prepareReveal(c.bear) -- black silhouette colours + rarity effects off, for later
	setBearHidden(c.bear, true)
	if c.fish then setPartsHidden(bearParts(c.fish), true) end -- the camera is inside the fish
	Cine.speedLines(false)
	Cine.letterbox(false)
	Cine.eyelids(true)
	Cine.setLids(0)
	Cine.grade({ tint = Color3.fromRGB(225, 232, 240), saturation = -0.25, contrast = 0.15, brightness = -0.04 }, 0.8)
	local toDen = dirToDen(c)
	local side = Vector3.new(-toDen.Z, 0, toDen.X)
	local nextBlink, blinkT, beatT, stepT = 0.4, 0.3, 0.7, 0
	local lastBear = nil
	local glance = Vector2.zero
	local snapTo = nil -- a sound makes the fish look that way
	c.snapLook = function(world: Vector3)
		snapTo = world
		task.delay(0.9, function() if snapTo == world then snapTo = nil end end)
	end
	CameraController.run(function(t, dt)
		if c.mode ~= "pov" then return nil, 70 end
		local fp = fishPosOf(c)
		local eye = c.eyePos or (fp + Vector3.new(0, 0.7, 0))
		c.eyePos = eye
		-- how close is the (invisible) bear?
		local r = rootOf(c.bear)
		local near = 0
		if r then
			local dist = (Vector3.new(r.Position.X, 0, r.Position.Z) - Vector3.new(fp.X, 0, fp.Z)).Magnitude
			c.startDist = c.startDist or math.max(dist, 10)
			near = 1 - math.clamp((dist - 3) / c.startDist, 0, 1)
			-- heavy steps you only hear (and feel)
			local moved = if lastBear then (r.Position - lastBear).Magnitude / math.max(dt, 1e-3) else 0
			lastBear = r.Position
			if moved > 2 then
				stepT -= dt
				if stepT <= 0 then
					local sc = c.bear:GetAttribute("Scale") or 1
					stepT = 0.3 / math.max(0.75, c.bear:GetAttribute("Gait") or 1)
					Sound.play("Footstep", { at = r.Position, pitch = 0.75 / sc, volume = 0.6 + near * 1.2 })
					CameraController.shake((0.05 + near * 0.45) * sc, 0.12)
				end
			end
		end
		c.panic = math.max(c.panic, 0.15 + near * 0.85)
		local panic = c.panic
		-- heartbeat (double thump), quicker and louder with panic
		beatT -= dt
		if beatT <= 0 then
			beatT = 1.1 - panic * 0.78
			Sound.play("Heartbeat", { pitch = 0.85 + panic * 0.35, volume = 0.45 + panic * 0.5 })
			task.delay(0.16, function() Sound.play("Heartbeat", { pitch = 0.95 + panic * 0.35, volume = 0.3 + panic * 0.3 }) end)
		end
		-- eyelids: wide open with fear, blinking faster and faster
		local open = math.min(1, t / 0.5)
		nextBlink -= dt
		if nextBlink <= 0 then
			blinkT = 0.16
			nextBlink = math.max(0.2, 2.8 - panic * 2.55) * (0.7 + math.random() * 0.6)
		end
		if blinkT > 0 then
			blinkT -= dt
			open *= math.abs((blinkT / 0.16) * 2 - 1)
		end
		Cine.setLids(open)
		Cine.setBlur(0.5 + panic * 3)
		Cine.dark(0.15 + panic * 0.65)
		Cine.gradeSet({ saturation = -0.25 - panic * 0.35, contrast = 0.15 + panic * 0.2, brightness = -0.04 - panic * 0.06 })
		-- where the fish looks: the sky and the treetops, panicked glances that get wilder
		local speed = 0.7 + panic * 3
		local target = Vector2.new(math.noise(t * speed, 1.3), math.noise(t * speed, 7.7)) * (0.35 + panic * 1.1)
		glance = glance:Lerp(target, math.min(1, dt * (3 + panic * 8)))
		local look = toDen * 6 + side * glance.X * 5 + Vector3.new(0, 4.5 + glance.Y * 2.5, 0)
		if snapTo then look = (snapTo - eye).Unit * 6 + Vector3.new(0, 1.5, 0) end
		-- trembling (the fish shivers) + breathing gills
		local tremble = Vector3.new(math.noise(t * 25, 0, 2), math.noise(t * 25, 3, 0), math.noise(0, t * 25, 5)) * (0.02 + panic * 0.09)
		local breathe = Vector3.new(0, math.sin(t * (3 + panic * 6)) * 0.04, 0)
		return CFrame.lookAt(eye + tremble + breathe, eye + look), 74 - panic * 20 + math.sin(t * 2) * 1.5
	end, 120, { smooth = 0, blendIn = 0.25 })
end

local function povAlert()
	local c = current
	local r = rootOf(c.bear)
	c.panic = math.max(c.panic or 0, 0.5)
	if r then
		Sound.play("Growl", { at = r.Position, pitch = bearPitch(c.bear), volume = 1.2 })
		if c.snapLook then c.snapLook(r.Position + Vector3.new(0, 2, 0)) end -- the fish looks toward the noise... nothing there
	end
	CameraController.shake(0.5, 0.35)
	CameraController.punch(-8)
	Cine.motion(10)
end

------------------------------------------------------------------------------------------
-- 2) EATEN. Still from the fish: a dark muzzle comes down sniffing (head + front of the
-- body, black, only the mouth in colour), the jaws open (teeth, tongue), the fish is lifted
-- INTO the mouth, CHOMP, black. Muffled gulp from inside.
------------------------------------------------------------------------------------------
-- the WHOLE bear appears as a black silhouette (it was hidden until now); only what makes
-- it terrifying keeps its real colours: teeth, tongue, inside of the mouth, the shine in
-- the eyes. The teeth are blown up (cartoon fangs) so they read from far away.
local TOOTH_GROW = 1.9
local function showWhole(c)
	local rv = c.rv
	if not rv or not c.bear then return end
	setBearHidden(c.bear, false)
	-- keep the rarity effects / name tags off during the meal
	for _, d in c.bear:GetDescendants() do
		if d:IsA("BillboardGui") or d:IsA("SurfaceGui") then d.Enabled = false end
	end
	rv.teeth = rv.teeth or {}
	for _, d in c.bear:GetDescendants() do
		if d:IsA("BasePart") then
			local sv = rv.saved[d]
			if sv and (isMouthPart(d) or d.Name:sub(1, 8) == "EyeShine") then
				d.Color = sv[1]
				d.Material = sv[2]
			end
			if d.Name == "Eyelid" and not rv.lids then rv.lids = {} end
			if d.Name == "Eyelid" and rv.lids[d] == nil then
				rv.lids[d] = d.Color -- blinking / squeezed eyes stay black on the silhouette
				d.Color = SHADOW
			end
			if d.Name:sub(1, 5) == "Tooth" and not rv.teeth[d] then
				rv.teeth[d] = d.Size
				-- longer + wider fangs, grown downward/upward from the gum so they show
				d.Size = Vector3.new(d.Size.X * 1.5, d.Size.Y * TOOTH_GROW, d.Size.Z * 1.3)
			end
		end
	end
end

-- teeth back to their real size (at the reveal slam / cleanup)
function restoreTeeth(rv)
	if rv and rv.lids then
		for lid, col in rv.lids do
			if lid.Parent then lid.Color = col end
		end
		rv.lids = nil
	end
	if not rv or not rv.teeth then return end
	for part, size in rv.teeth do
		if part.Parent then
			TweenService:Create(part, TweenInfo.new(0.3, Enum.EasingStyle.Back), { Size = size }):Play()
		end
	end
	rv.teeth = nil
end

local function eatSequence(d)
	local c = current
	if not c then return end
	local tl = d.tl
	local start = d.start
	local G = GameConfig.Capture
	local tChomp = tl.eat + 1.0
	local fired = {}
	local function once(key, fn)
		if not fired[key] then
			fired[key] = true
			fn()
		end
	end
	local ground = fishPosOf(c) + Vector3.new(0, 0.7, 0)
	local freezeUntil, lastCF, lastFov = 0, nil, 60
	c.mode = "eat"
	c.panic = 1
	-- framing reference: the bear's facing when the meal starts (stable, the head moves a lot)
	local r0 = rootOf(c.bear)
	local baseFwd = if r0 then r0.CFrame.LookVector else -dirToDen(c)
	baseFwd = Vector3.new(baseFwd.X, 0, baseFwd.Z)
	baseFwd = if baseFwd.Magnitude > 0.05 then baseFwd.Unit else Vector3.new(0, 0, -1)
	local baseSide = Vector3.new(-baseFwd.Z, 0, baseFwd.X)
	local UP = Vector3.new(0, 1, 0)
	-- SHOTS (all wide enough to see the WHOLE black bear):
	--  S1 sniff   : low on the ground, 3/4 front, the black mass looming over the fish, slow push
	--  S2 dive    : closer, the head dives at the lens, jaws gaping (big white fangs)
	--  S3 snatch  : low hero angle looking UP, the bear rears with the fish in its jaws
	--  S4 chomp   : the lens is SUCKED into the mouth -> hit-stop -> black
	CameraController.run(function(t, dt)
		if os.clock() < freezeUntil and lastCF then return lastCF, lastFov end
		local now = workspace:GetServerTimeNow() - start
		local h = headOf(c.bear)
		local r = rootOf(c.bear)
		if not h or not r then return lastCF, lastFov end
		local sc = c.bear:GetAttribute("Scale") or 1
		local bl = math.max(c.bear:GetAttribute("BodyLength") or 6 * sc, 4)
		local mouthAtt = h:FindFirstChild("MouthAtt")
		local mouth = if mouthAtt then (mouthAtt :: Attachment).WorldPosition else h.Position
		local panicT = os.clock()
		-- the fish's eyes: wide open in terror, trembling (no more heavy tunnel: we SEE the bear)
		Cine.setLids(if now > tChomp then 0 else (0.93 + math.sin(panicT * 30) * 0.05))
		Cine.dark(0.42)
		local tremble = Vector3.new(math.noise(panicT * 30, 1), math.noise(panicT * 30, 2), math.noise(panicT * 30, 3)) * 0.08 * sc
		if now >= tl.sniff - 0.15 then
			once("show", function()
				showWhole(c)
				Sound.play("Growl", { at = mouth, pitch = bearPitch(c.bear) * 0.8, volume = 1.3 })
				Sound.play("Sniff", { at = mouth, pitch = 0.6, volume = 1.2 })
				CameraController.shake(0.8, 0.35)
				CameraController.punch(-8)
				Cine.motion(10)
				-- backlit look: bright cold world, so the black silhouette reads hard
				Cine.grade({ tint = Color3.fromRGB(225, 232, 255), saturation = -0.3, contrast = 0.35, brightness = 0.06 }, 0.15)
			end)
		end
		if now >= tl.sniff + 0.45 then once("sniff2", function() Sound.play("Sniff", { at = mouth, pitch = 0.55, volume = 1.2 }) end) end
		local body = r.Position
		local feet = Vector3.new(body.X, ground.Y - 0.2, body.Z)
		local cf, fov
		if now < tl.eat then
			-- S1: low 3/4 front, whole silhouette, slow menacing push-in
			local k = Easing.sineInOut(math.clamp((now - tl.sniff) / math.max(0.1, tl.eat - tl.sniff), 0, 1))
			local eye = ground + baseFwd * bl * (1.35 - 0.25 * k) + baseSide * bl * (0.95 - 0.2 * k) + UP * (0.2 + 0.3 * k) * sc
			cf = CFrame.lookAt(eye + tremble, body:Lerp(h.Position, 0.45) + UP * 0.2 * sc)
			fov = 64 - 6 * k
		elseif now < tl.eat + G.pickupAt + 0.08 then
			-- S2: the dive. closer and lower, more frontal: gaping jaws coming at us, body behind
			local k = Easing.cubicOut(math.clamp((now - tl.eat) / (G.pickupAt + 0.08), 0, 1))
			once("dive", function()
				CameraController.shake(1.1, 0.3)
				CameraController.punch(10)
				Cine.motion(14)
				Sound.play("Growl", { at = mouth, pitch = bearPitch(c.bear) * 0.7, volume = 1.4 })
			end)
			local eye = ground + baseFwd * bl * (1.0 - 0.15 * k) + baseSide * bl * 0.42 + UP * 0.15 * sc
			cf = CFrame.lookAt(eye + tremble * 1.5, mouth:Lerp(body, 0.4))
			fov = 70 - 4 * k
		elseif now < tChomp - 0.22 then
			-- S3: the snatch. low hero angle looking UP: the whole bear rears with the fish in its
			-- raised jaws, fangs against the sky
			once("lift", function()
				CameraController.shake(1.0, 0.3)
				Cine.motion(12)
				Sound.play("Splash", { volume = 0.4, pitch = 1.5 })
			end)
			local k = Easing.sineInOut(math.clamp((now - (tl.eat + G.pickupAt + 0.08)) / math.max(0.1, tChomp - 0.22 - (tl.eat + G.pickupAt + 0.08)), 0, 1))
			local eye = feet + baseFwd * bl * (1.05 - 0.15 * k) + baseSide * bl * (0.6 - 0.25 * k) + UP * 0.35 * sc
			cf = CFrame.lookAt(eye + tremble, mouth:Lerp(body, 0.35))
			fov = 66 - 6 * k
		else
			-- S4: sucked into the mouth -> CHOMP
			local pull = Easing.cubicIn(math.clamp((now - (tChomp - 0.22)) / 0.22, 0, 1))
			local fl = Vector3.new(h.CFrame.LookVector.X, 0, h.CFrame.LookVector.Z)
			fl = if fl.Magnitude > 0.05 then fl.Unit else baseFwd
			local eye = mouth + fl * (2.6 - 2.2 * pull) * sc + UP * (-0.3 * sc)
			eye = Vector3.new(eye.X, math.max(eye.Y, ground.Y + 0.1), eye.Z)
			cf = CFrame.lookAt(eye + tremble * 0.5, mouth)
			fov = 70 - 14 * pull
			if now >= tChomp then
				once("chomp", function()
					Sound.play("Chomp", { at = mouth, pitch = bearPitch(c.bear) * 0.85, volume = 1.4 })
					CameraController.shake(1.8, 0.45)
					CameraController.punch(-14)
					freezeUntil = os.clock() + 0.12 -- hit-stop on the bite
					Cine.blackout(true, 0.05)
					Cine.eyelids(false)
				end)
			end
		end
		if now >= tl.eat + G.swallowAt then
			once("gulp", function() Sound.play("Chomp", { pitch = 0.5, volume = 0.6 }) end) -- muffled, from inside
		end
		-- never under the ground
		local pp = cf.Position
		if pp.Y < ground.Y - 0.5 then cf = CFrame.lookAt(Vector3.new(pp.X, ground.Y - 0.5, pp.Z), pp + cf.LookVector) end
		lastCF, lastFov = cf, fov
		return cf, fov
	end, tl.total + 1, { smooth = 10, blendIn = 0.15 })
end

------------------------------------------------------------------------------------------
-- 3) THE REVEAL. From black, a crane shot high above the bear: a black silhouette.
-- Colours sweep up the body from the paws to the ears while LUCK and SIZE roll up
-- NON-STOP (never back down), faster and faster to their peak. The camera spirals down,
-- the shaking and the heartbeat build... hit-stop... SLAM onto the bear's face.
------------------------------------------------------------------------------------------
local function buildCounters()
	local g = Sim.new("ScreenGui", { Name = "TFBRevealCounters", ResetOnSpawn = false, DisplayOrder = 13, IgnoreGuiInset = true,
		ScreenInsets = Enum.ScreenInsets.DeviceSafeInsets, ZIndexBehavior = Enum.ZIndexBehavior.Sibling }, player:WaitForChild("PlayerGui"))
	local root = Sim.root(g, "Counters", Vector2.new(560, 120), UDim2.new(0.5, 0, 0, 12), Vector2.new(0.5, 0))
	local inner = Sim.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1) }, root)
	local pop = Sim.new("UIScale", { Scale = 0 }, inner)
	TweenService:Create(pop, TweenInfo.new(0.4, Enum.EasingStyle.Back), { Scale = 1 }):Play()
	local function box(x, title, grad)
		local b = Sim.panel(inner, { Size = UDim2.fromOffset(260, 100), Position = UDim2.fromOffset(x, 4), Gradient = grad, Stroke = 4, ZIndex = 4, Clip = true })
		Sim.bands(b, 0.6, 5)
		Sim.text(b, title, { Size = UDim2.fromOffset(240, 26), Position = UDim2.fromOffset(130, 18), Max = 22, ZIndex = 7 })
		local v = Sim.text(b, "", { Size = UDim2.fromOffset(240, 56), Position = UDim2.fromOffset(130, 62), Max = 52, Stroke = 4.5, ZIndex = 7 })
		return b, v, Sim.new("UIScale", {}, v)
	end
	local luckB, luckV, luckS = box(10, "🍀 LUCK", Sim.G.green)
	local sizeB, sizeV, sizeS = box(290, "⚖️ SIZE", Sim.G.blue)
	local stamp = Sim.text(g, "", { Size = UDim2.fromOffset(460, 70), Position = UDim2.new(0.5, 0, 0, 180), Max = 60, Stroke = 5, ZIndex = 9,
		Gradient = { Color3.fromRGB(255, 255, 200), Color3.fromRGB(255, 190, 20) } })
	local ss = Sim.new("UIScale", { Scale = 0 }, stamp)
	local ui = {}
	-- heat 0..1: the numbers swell and turn gold as they climb
	function ui.set(luck: number, kg: number, heat: number)
		luckV.Text = ("x%.1f"):format(luck)
		sizeV.Text = Format.kg(kg)
		local hot = Color3.new(1, 1, 1):Lerp(Color3.fromRGB(255, 214, 60), heat)
		luckV.TextColor3 = hot
		sizeV.TextColor3 = hot
		local sc = 1 + heat * 0.18
		luckS.Scale = sc
		sizeS.Scale = sc
	end
	function ui.shake(amount: number)
		local t = os.clock()
		inner.Position = UDim2.fromOffset(math.noise(t * 22, 1) * amount * 2, math.noise(t * 22, 2) * amount * 2)
		luckB.Rotation = math.noise(t * 9, 3) * amount * 0.5
		sizeB.Rotation = math.noise(t * 9, 4) * amount * 0.5
	end
	function ui.lock()
		for _, s2 in { luckS, sizeS } do
			s2.Scale = 1.5
			TweenService:Create(s2, TweenInfo.new(0.35, Enum.EasingStyle.Back), { Scale = 1.1 }):Play()
		end
		luckB.Rotation, sizeB.Rotation = 0, 0
		inner.Position = UDim2.new()
	end
	function ui.stamp(text: string)
		stamp.Text = text
		ss.Scale = 3
		TweenService:Create(ss, TweenInfo.new(0.3, Enum.EasingStyle.Back), { Scale = 1 }):Play()
	end
	function ui.close()
		TweenService:Create(pop, TweenInfo.new(0.25, Enum.EasingStyle.Back, Enum.EasingDirection.In), { Scale = 0 }):Play()
		TweenService:Create(ss, TweenInfo.new(0.25), { Scale = 0 }):Play()
		task.delay(0.3, function() g:Destroy() end)
	end
	return ui
end

local function revealPartNow(rv, part: BasePart)
	local sv = rv.saved[part]
	if not sv or not part.Parent then return end
	rv.saved[part] = nil
	part.Material = sv[2]
	TweenService:Create(part, TweenInfo.new(0.45, Enum.EasingStyle.Quad), { Color = sv[1] }):Play()
end

local function revealSequence(d)
	local c = current
	if not c then return end
	local G = GameConfig.Capture
	c.mode = "reveal"
	-- the whole black silhouette, out of the darkness
	if c.rv then
		for _, parts in c.rv.groups do
			for _, part in parts do
				local sv = c.rv.saved[part]
				if sv then part.Color = SHADOW part.Material = Enum.Material.SmoothPlastic end
			end
		end
	end
	setBearHidden(c.bear, false)
	if c.fish then setPartsHidden(bearParts(c.fish), false) end
	Cine.eyelids(false)
	Cine.dark(0.35)
	Cine.letterbox(true)
	Cine.blackout(false, 0.6)
	Cine.grade({ tint = Color3.fromRGB(220, 222, 240), saturation = -0.35, contrast = 0.3, brightness = -0.08 }, 0.4)
	local T = G.revealLimb * 6
	local ui = buildCounters()
	local luck, kg = d.luck or 1, d.weight or 0
	ui.set(1, 0, 0)
	-- sweep list: every part bottom -> top
	local list, minY, maxY = {}, math.huge, -math.huge
	if c.rv then
		for _, parts in c.rv.groups do
			for _, part in parts do
				if part.Parent then
					table.insert(list, { part = part, y = part.Position.Y })
					minY = math.min(minY, part.Position.Y)
					maxY = math.max(maxY, part.Position.Y)
				end
			end
		end
	end
	table.sort(list, function(a, b) return a.y < b.y end)
	local span = math.max(maxY - minY, 0.5)
	local progress = 0
	local spin = 0
	local slam = nil -- set when the reveal finishes: the slam-zoom shot takes over
	CameraController.run(function(t, dt)
		local rr = rootOf(c.bear)
		local h = headOf(c.bear)
		if not rr then return nil, 55 end
		local sc = c.bear:GetAttribute("Scale") or 1
		local fwd = rr.CFrame.LookVector
		if slam then
			-- SLAM: low hero angle right in front of the face, lens punching in
			local k = Easing.expoOut(math.clamp((os.clock() - slam) / 0.35, 0, 1))
			local side = rr.CFrame.RightVector
			local face = if h then h.Position else rr.Position
			local p = face + fwd * (9 - 4.5 * k) * sc + side * 1.6 * sc + Vector3.new(0, -0.8 * sc, 0)
			p = Vector3.new(p.X, math.max(p.Y, 1), p.Z)
			Cine.dof((p - face).Magnitude, 0.6)
			return CFrame.lookAt(p, face + Vector3.new(0, 0.4 * sc, 0)), 70 - 32 * k
		end
		-- crane: very high and straight down, spiralling lower and faster as the colours climb
		local pe = progress
		spin += dt * (0.25 + pe * pe * 2.6)
		local focusY = minY + span * pe
		local focus = Vector3.new(rr.Position.X, focusY, rr.Position.Z)
		local dirv = CFrame.Angles(0, spin, 0):VectorToWorldSpace(fwd)
		local height = (30 - 22 * Easing.sineIn(pe)) * sc
		local radius = (5 + 6 * pe) * sc
		local p = focus + dirv * radius + Vector3.new(0, height, 0)
		Cine.dof((p - focus).Magnitude, 0.35 + pe * 0.4)
		if pe > 0.5 then Cine.motion(pe * 6) end
		return CFrame.lookAt(p, focus), 60 - 16 * pe
	end, d.duration + 0.6, { smooth = 5, blendIn = 0.2 })
	task.spawn(function()
		local rng = Random.new()
		local shownL, shownK = 1, 0
		local t0 = os.clock()
		local nextPart = 1
		local tickT, beatT, shakeT = 0, 0, 0
		local last = os.clock()
		while current == c and c.bear.Parent do
			local now = os.clock()
			local dt = now - last
			last = now
			local p = math.clamp((now - t0) / T, 0, 1)
			-- slow start, then it runs away towards the peak
			local ease = p ^ 2.1
			progress = Easing.sineInOut(p)
			-- colours climb the body
			local yNow = minY + span * progress
			while c.rv and nextPart <= #list and list[nextPart].y <= yNow + 0.001 do
				revealPartNow(c.rv, list[nextPart].part)
				nextPart += 1
			end
			-- LUCK / SIZE: always up, never down; uneven RNG-like jumps around the curve
			local targetL = 1 + (luck - 1) * ease
			local targetK = kg * ease
			shownL = math.max(shownL, shownL + (targetL - shownL) * rng:NextNumber(0.05, 0.55) + (if p < 1 then rng:NextNumber(0, 0.004) * luck * dt * 60 * (1 - p) else 0))
			shownK = math.max(shownK, shownK + (targetK - shownK) * rng:NextNumber(0.05, 0.55))
			shownL = math.min(shownL, luck)
			shownK = math.min(shownK, kg)
			ui.set(shownL, shownK, p)
			ui.shake(1 + p * 7)
			-- rolling ticks, heartbeat, building shake
			tickT -= dt
			if tickT <= 0 then
				tickT = 0.11 - p * 0.08
				Sound.play("Tick", { pitch = 0.8 + p * 1.2, volume = 0.35 + p * 0.3 })
			end
			beatT -= dt
			if beatT <= 0 then
				beatT = 0.8 - p * 0.55
				Sound.play("Heartbeat", { pitch = 0.9 + p * 0.4, volume = 0.5 + p * 0.4 })
			end
			shakeT -= dt
			if shakeT <= 0 then
				shakeT = 0.18
				CameraController.shake(0.05 + p * p * 0.6, 0.2)
			end
			Cine.gradeSet({ saturation = -0.35 + p * 0.45, contrast = 0.3 + p * 0.1, brightness = -0.08 + p * 0.06 })
			Cine.dark(0.35 + p * 0.3)
			if p >= 1 then break end
			task.wait()
		end
		if current ~= c then ui.close() return end
		-- PEAK. Everything stops for a heartbeat... then SLAM.
		if c.rv then
			revealAll(c.rv)
		end
		ui.set(luck, kg, 1)
		ui.lock()
		CameraController.shake(0, 0)
		task.wait(0.22)
		if current ~= c then ui.close() return end
		if c.rv then revealAura(c.rv) end
		slam = os.clock()
		local tier = RarityConfig.get(d.final)
		local col = tier.textColor or tier.color
		if d.mult then ui.stamp(("LUCK x%d!"):format(d.mult)) end
		Sound.play("Reveal" .. math.max(1, tier.reveal))
		Sound.play("Growl", { pitch = bearPitch(c.bear), volume = 1.2 })
		CameraController.shake(1.2 + tier.index * 0.1, 0.5)
		Cine.motion(18)
		Cine.dark(0.2)
		-- the colour of the world comes back, warmer for the rarer bears (no light effects)
		Cine.grade({ tint = Color3.new(1, 1, 1):Lerp(col, 0.12), saturation = 0.15 + tier.index * 0.03, contrast = 0.18, brightness = 0.02 }, 0.25)
		local spec = BearConfig.get(d.species or "BrownBear")
		local variant = if d.variant and d.variant ~= "Normal" then d.variant .. " " else ""
		Cine.banner((variant .. spec.name):upper(), col, tier.name:upper())
		task.wait(G.revealFinal - 0.4)
		ui.close()
	end)
end

-- 4) FINALE: the happy bear, the camera pulls back and circles up, then it pops into your arms
local function happyShot(d)
	local c = current
	if not c then return end
	c.mode = "happy"
	Cine.dof(nil, 0)
	local total = d.duration
	local tHappy = GameConfig.Capture.happy
	local happy, transformed = false, false
	CameraController.run(function(t)
		local r = rootOf(c.bear)
		local h = headOf(c.bear)
		if not r or not h then return nil, 55 end
		local sc = c.bear:GetAttribute("Scale") or 1
		local fwd = r.CFrame.LookVector
		local up = Vector3.new(0, 1, 0)
		if t < tHappy then
			if not happy then
				happy = true
				Sound.play("Happy", { at = h.Position, pitch = bearPitch(c.bear) })
				Cine.hearts(h.Position + up * 1.5, 6)
			end
			local k = Easing.cubicOut(math.clamp(t / tHappy, 0, 1))
			local p = r.Position + fwd * (8 + 6 * k) * sc + up * (1.5 + 3.5 * k) * sc + r.CFrame.RightVector * 2.5 * sc
			return CFrame.lookAt(p, r.Position + up * sc), 50 + 6 * k
		end
		local k = math.clamp((t - tHappy) / math.max(0.1, total - tHappy), 0, 1)
		if not transformed then
			transformed = true
			Sound.play("Transform", { volume = 0.6 })
			Cine.motion(10)
		end
		local ang = Easing.cubicInOut(k) * math.pi
		local dirv = CFrame.Angles(0, ang, 0):VectorToWorldSpace(fwd)
		local p = r.Position + dirv * (14 - 3 * k) * sc + up * (3 + 5 * k) * sc
		if k > 0.5 and not c.gradeCleared then
			c.gradeCleared = true
			Cine.gradeOff(1.0)
		end
		return CFrame.lookAt(p, r.Position + up * sc), 56 + 10 * k
	end, total + 1.5, { smooth = 9, blendIn = 0.3 })
end

-- return HUD ----------------------------------------------------------------------
local function buildReturnHud()
	returnGui = Theme.new("ScreenGui", { Name = "ReturnHUD", ResetOnSpawn = false, IgnoreGuiInset = false, Enabled = false, DisplayOrder = 5 })
	local frame = Theme.block({
		Name = "Banner", Size = UDim2.fromOffset(360, 74), Position = UDim2.new(0.5, 0, 0, 58), AnchorPoint = Vector2.new(0.5, 0),
		Gradient = Theme.G.orange, Corner = 10, StrokeWidth = 3, Studs = 14, Parent = returnGui,
	})
	Theme.new("UIScale", { Name = "RootScale", Parent = returnGui })
	Theme.text({ Text = "RUN BACK TO YOUR BASE!", Size = UDim2.new(1, -16, 0, 26), Position = UDim2.fromOffset(8, 4), Max = 26, Stroke = 3, Parent = frame, Font = Theme.FontBold })
	returnName = Theme.text({ Text = "", Size = UDim2.new(1, -16, 0, 16), Position = UDim2.fromOffset(8, 30), Max = 16, Parent = frame, RichText = true })
	local bar = Theme.block({ Name = "Bar", Size = UDim2.new(1, -20, 0, 16), Position = UDim2.fromOffset(10, 50), Color = Color3.fromRGB(30, 30, 34), Corner = 8, StrokeWidth = 2, Parent = frame })
	returnFill = Theme.block({ Name = "Fill", Size = UDim2.fromScale(0, 1), Gradient = Theme.G.green, Corner = 8, StrokeWidth = 0, Parent = bar })
	returnText = Theme.text({ Text = "", Size = UDim2.fromScale(1, 1), Max = 13, Parent = bar, ZIndex = 3 })
	returnTimer = Theme.text({ Text = "", Size = UDim2.fromOffset(120, 22), Position = UDim2.new(0.5, 0, 1, 4), AnchorPoint = Vector2.new(0.5, 0), Max = 18, Parent = frame })
	returnGui.Parent = player:WaitForChild("PlayerGui")
	local function rescale()
		local vp = workspace.CurrentCamera.ViewportSize
		returnGui.RootScale.Scale = math.clamp(math.min(vp.X / 900, vp.Y / 420), 0.75, 1.6)
	end
	workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(rescale)
	rescale()
end

local function buildArrow()
	local m = Instance.new("Model")
	m.Name = "BaseArrow"
	local function part(size, cf, wedge)
		local p = Instance.new(if wedge then "WedgePart" else "Part")
		p.Size = size
		p.CFrame = cf
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.CastShadow = false
		p.Color = Color3.fromRGB(110, 255, 90)
		p.Material = Enum.Material.Neon
		p.Parent = m
		return p
	end
	local shaft = part(Vector3.new(0.9, 0.5, 2.6), CFrame.new(0, 0, 1.3))
	part(Vector3.new(0.5, 1.2, 1.2), CFrame.new(0.6, 0, -0.6) * CFrame.Angles(0, 0, math.pi / 2) * CFrame.Angles(math.pi, 0, 0), true)
	part(Vector3.new(0.5, 1.2, 1.2), CFrame.new(-0.6, 0, -0.6) * CFrame.Angles(0, 0, -math.pi / 2) * CFrame.Angles(math.pi, 0, 0), true)
	m.PrimaryPart = shaft
	m.WorldPivot = CFrame.new()
	return m
end

local function startControlling(d)
	controlling = d
	current = nil
	CameraController.resetOffset()
	CameraController.stop()
	workspace.CurrentCamera.CameraSubject = d.bear:FindFirstChildOfClass("Humanoid")
	if not returnGui then buildReturnHud() end
	local tier = RarityConfig.get(d.outcome.r)
	local name = BearConfig.get(d.outcome.s).name
	local variant = if d.outcome.v ~= "Normal" then d.outcome.v .. " " else ""
	local hex = (if tier.textColor then tier.textColor else tier.color):ToHex()
	returnName.Text = ('<font color="#%s">%s</font> %s%s · %s · %s'):format(hex, tier.name, variant, name, Format.kg(d.outcome.w), Format.perSec(d.income))
	returnGui.Enabled = true
	d.started = os.clock()
	arrow = buildArrow()
	arrow.Parent = Fx.folder
	if Capture.Flash then Capture.Flash(0.5) end
	local r = rootOf(d.bear)
	if r then
		Fx.burst(r.Position - Vector3.new(0, (d.bear:GetAttribute("HipHeight") or 1.6), 0), tier.color, (d.bear:GetAttribute("Scale") or 1))
		Fx.puff(r.Position, Color3.new(1, 1, 1), 18, 4)
	end
	if Capture.Reveal then Capture.Reveal.bearToast(d.outcome, d.income) end
	Sound.play("Growl", { pitch = bearPitch(d.bear) })
end

local function stopControlling()
	controlling = nil
	sprinting = false
	if returnGui then returnGui.Enabled = false end
	if arrow then arrow:Destroy() arrow = nil end
end

local function onFx(phase: string, d)
	if phase == "Spawned" then
		current = { bear = d.bear, fish = d.fish, landing = d.landing, den = d.den }
		povStart()
		if d.canSkip then
			Cine.skipButton(function() Net.event("SkipCapture"):FireServer() end)
		end
	elseif phase == "Alert" and current then
		povAlert()
	elseif phase == "Run" and current then
		-- nothing to show: the bear is only heard (the POV camera handles everything)
	elseif phase == "Eat" and current then
		eatSequence(d)
	elseif phase == "Reveal" and current then
		revealSequence(d)
	elseif phase == "Happy" and current then
		happyShot(d)
	elseif phase == "Controlling" then
		startControlling(d)
	elseif phase == "Arrived" then
		local r = controlling and rootOf(controlling.bear)
		if r then
			Fx.blocks(r.Position + Vector3.new(0, 4, 0), Color3.new(1, 1, 1), 40, 26, 0.45, {
				colors = { Color3.fromRGB(255, 80, 80), Color3.fromRGB(255, 220, 60), Color3.fromRGB(80, 200, 255), Color3.fromRGB(120, 255, 120), Color3.fromRGB(255, 120, 230) },
				life = 1.6, up = 2.5, gravity = 40,
			})
		end
		Sound.play("Arrive")
		stopControlling()
	elseif phase == "Captured" then
		-- poof where the bear was, then it pops into your arms
		if current and current.bear then setBearHidden(current.bear, false) end
		if current and current.rv then revealAll(current.rv) revealAura(current.rv) end
		if current and current.fish then setPartsHidden(bearParts(current.fish), false) end
		current = nil
		Cine.resetAll()
		Cine.resetEaten()
		Cine.letterbox(false)
		if d.from then
			Fx.puff(d.from + Vector3.new(0, 3, 0), Color3.new(1, 1, 1), 22, 5)
		end
		CameraController.stop()
		task.delay(0.35, function()
			local char = player.Character
			local root = char and char:FindFirstChild("HumanoidRootPart")
			if root then
				Fx.burst(root.Position - Vector3.new(0, 2.8, 0), Color3.fromRGB(255, 220, 90), 0.7)
				Fx.blocks(root.Position + Vector3.new(0, 6, 0), Color3.new(1, 1, 1), 30, 22, 0.4, {
					colors = { Color3.fromRGB(255, 80, 80), Color3.fromRGB(255, 220, 60), Color3.fromRGB(80, 200, 255), Color3.fromRGB(120, 255, 120) },
					life = 1.4, up = 2.5, gravity = 40,
				})
			end
			Sound.play("Happy", { pitch = 1.1 })
			Sound.play("Arrive")
			-- full "BEAR UNLOCKED!" screen that waits for a tap
			if Capture.Unlock then
				Capture.Unlock(d.bear, d.income, d.isNew)
			elseif Capture.Reveal then
				Capture.Reveal.bear(d.bear, d.income, d.isNew)
			end
		end)
	elseif phase == "Failed" then
		Cine.resetAll()
		Cine.resetEaten()
		if current and current.bear then setBearHidden(current.bear, false) end
		if current and current.fish then setPartsHidden(bearParts(current.fish), false) end
		if current and current.rv then revealAll(current.rv) revealAura(current.rv) end
		current = nil
		Cine.eyelids(false)
		Cine.letterbox(false)
		stopControlling()
		CameraController.stop()
	end
end

-- per frame: return HUD, arrow, sprint, placement ghost
local stepAcc = 0
local function step(dt: number)
	if controlling then
		local bear = controlling.bear
		local r = rootOf(bear)
		local base = player:GetAttribute("Base")
		if r and base then
			local c = Layout.BASE_CENTERS[base]
			local target = Vector3.new(c.X, 0, c.Z - Layout.BASE_HALF + 4)
			local total = controlling.total or (Vector3.new(r.Position.X, 0, r.Position.Z) - target).Magnitude
			controlling.total = total
			local dist = (Vector3.new(r.Position.X, 0, r.Position.Z) - target).Magnitude
			local prog = math.clamp(1 - dist / math.max(total, 1), 0, 1)
			returnFill.Size = UDim2.fromScale(prog, 1)
			returnText.Text = ("%d studs to go"):format(math.floor(dist))
			local left = (controlling.timeout or 300) - (os.clock() - controlling.started)
			returnTimer.Text = "⏱ " .. Format.time(left)
			returnTimer.TextColor3 = if left < 30 then Color3.fromRGB(255, 80, 80) else Color3.new(1, 1, 1)
			-- arrow floating above the bear, pointing home (route via the corridor)
			local aim = target
			if Layout.zoneAt(r.Position) then
				aim = Vector3.new(0, 0, Layout.CORRIDOR_START_Z + 20)
			end
			local hh = (bear:GetAttribute("HipHeight") or 1.6) + 4 * (bear:GetAttribute("Scale") or 1)
			local ap = r.Position + Vector3.new(0, hh + math.sin(os.clock() * 4) * 0.3, 0)
			local flat = Vector3.new(aim.X - ap.X, 0, aim.Z - ap.Z)
			if flat.Magnitude > 0.1 and arrow then
				arrow:PivotTo(CFrame.lookAt(ap, ap + flat.Unit))
			end
			-- sprint
			local hum = bear:FindFirstChildOfClass("Humanoid")
			if hum then
				local baseSpeed = bear:GetAttribute("BaseSpeed") or 28
				local want = if sprinting then baseSpeed * GameConfig.Capture.sprintMultiplier else baseSpeed
				if hum.WalkSpeed > 0.5 then hum.WalkSpeed = want end
				stepAcc += dt
				local moving = hum.MoveDirection.Magnitude > 0.1
				local interval = if sprinting then 0.22 else 0.32
				if moving and stepAcc > interval then
					stepAcc = 0
					Sound.play("Footstep", { at = r.Position, pitch = 0.75 / (bear:GetAttribute("Scale") or 1) })
					if sprinting then Fx.dust(Vector3.new(r.Position.X, 0.2, r.Position.Z) - r.CFrame.LookVector * 2, 0.5) end
				end
			end
		end
	end
	-- placement ghost
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	local base = player:GetAttribute("Base")
	if Data.state == "CarryingCapturedBear" and root and base and Layout.isInBase(base, root.Position, 6) then
		if not ghost then
			ghost = Instance.new("Part")
			ghost.Shape = Enum.PartType.Cylinder
			ghost.Anchored = true
			ghost.CanCollide = false
			ghost.CanQuery = false
			ghost.Material = Enum.Material.Neon
			ghost.Transparency = 0.45
			ghost.Size = Vector3.new(0.15, 5, 5)
			ghost.Parent = Fx.folder
		end
		local p = Capture.placePosition()
		local ok = Layout.isInBase(base, p, 6)
		for _, m in workspace:WaitForChild("Bears"):GetChildren() do
			if m:GetAttribute("Owner") == player.UserId and m.PrimaryPart then
				local q = m.PrimaryPart.Position
				if Vector3.new(q.X - p.X, 0, q.Z - p.Z).Magnitude < GameConfig.Base.minBearSpacing then ok = false end
			end
		end
		ghost.Color = if ok then Color3.fromRGB(110, 255, 110) else Color3.fromRGB(255, 80, 80)
		local pulse = 1 + math.sin(os.clock() * 5) * 0.08
		ghost.Size = Vector3.new(0.15, 5 * pulse, 5 * pulse)
		ghost.CFrame = CFrame.new(p + Vector3.new(0, 0.15, 0)) * CFrame.Angles(0, 0, math.pi / 2)
	elseif ghost then
		ghost:Destroy()
		ghost = nil
	end
end

-- ground point under a screen position (map only)
local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Include
local function groundAt(screen: Vector2): Vector3?
	local map = workspace:FindFirstChild("Map")
	if not map then return nil end
	rayParams.FilterDescendantsInstances = { map }
	local ray = workspace.CurrentCamera:ViewportPointToRay(screen.X, screen.Y)
	local hit = workspace:Raycast(ray.Origin, ray.Direction * 600, rayParams)
	return hit and Vector3.new(hit.Position.X, 0, hit.Position.Z) or nil
end

-- where PLACE puts the bear: under the mouse on PC (ghost follows the cursor), else in front of you
function Capture.placePosition(): Vector3
	local base = player:GetAttribute("Base")
	if base and UserInputService.MouseEnabled then
		local p = groundAt(UserInputService:GetMouseLocation())
		if p and Layout.isInBase(base, p, 6) then return p end
	end
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then return Vector3.zero end
	local p = root.Position + root.CFrame.LookVector * 6
	return Vector3.new(p.X, 0, p.Z)
end

function Capture.init()
	Net.event("CaptureFx").OnClientEvent:Connect(onFx)
	RunService.RenderStepped:Connect(function(dt)
		step(math.min(dt, 0.1))
	end)
	Actions.on("Sprint", function()
		sprinting = true
		CameraController.punch(6)
	end, function()
		sprinting = false
	end)
	Actions.on("Place", function()
		Net.event("PlaceBear"):FireServer(Capture.placePosition())
	end)
	-- click / tap anywhere in your base to place the carried bear there
	UserInputService.InputBegan:Connect(function(input, gameProcessed)
		if gameProcessed or Data.state ~= "CarryingCapturedBear" then return end
		if input.UserInputType ~= Enum.UserInputType.MouseButton1 and input.UserInputType ~= Enum.UserInputType.Touch then return end
		local base = player:GetAttribute("Base")
		local screen = if input.UserInputType == Enum.UserInputType.Touch then Vector2.new(input.Position.X, input.Position.Y + game:GetService("GuiService"):GetGuiInset().Y) else UserInputService:GetMouseLocation()
		local p = groundAt(screen)
		if base and p and Layout.isInBase(base, p, 6) then
			Fx.ring(p + Vector3.new(0, 0.2, 0), Color3.fromRGB(120, 255, 120), 0.5, 4, 0.4, { neon = true, transparency = 0.2 })
			Net.event("PlaceBear"):FireServer(p)
		end
	end)
	player.CharacterAdded:Connect(function(char)
		if not char:GetAttribute("IsBear") then
			workspace.CurrentCamera.CameraSubject = char:WaitForChild("Humanoid", 5)
		end
	end)
end

return Capture
