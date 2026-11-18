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
local BearBuilder = require(Shared.Models.BearBuilder)
local RarityConfig = require(Shared.Config.RarityConfig)
local Easing = require(Shared.Util.Easing)
local Format = require(Shared.Util.Format)
local Formulas = require(Shared.Formulas)
local Fx = require(script.Parent.Fx)
local Sound = require(script.Parent.Sound)
local Actions = require(script.Parent.Actions)
local CameraController = require(script.Parent.CameraController)
local Cine = require(script.Parent.CinematicFx)
local Clock = require(script.Parent.Clock)
local Animator = require(script.Parent.AnimalAnimator)
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

-- AMBIANCE: the music melts away during the capture cinematic, comes back after
local function duckMusic(on: boolean)
	local m = game:GetService("SoundService"):FindFirstChild("TFB_Music")
	if not m or not m:IsA("Sound") then return end
	if on then
		if m:GetAttribute("TFBVol") == nil then m:SetAttribute("TFBVol", m.Volume) end
		TweenService:Create(m, TweenInfo.new(1.2), { Volume = (m:GetAttribute("TFBVol") or 0.2) * 0.12 }):Play()
	else
		local v = m:GetAttribute("TFBVol")
		if v then
			TweenService:Create(m, TweenInfo.new(1.5), { Volume = v }):Play()
			m:SetAttribute("TFBVol", nil)
		end
	end
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
	-- the bear keeps its REAL colours now; only its rarity effects (aura motes, lights,
	-- variant sparkles) stay off until the reveal is over
	local rv = { groups = {}, saved = {}, fx = {}, idx = 0, bear = bear }
	for _, d in bear:GetDescendants() do
		if d:IsA("ParticleEmitter") or d:IsA("PointLight") or d:IsA("Sparkles") then
			rv.fx[d] = d.Enabled
			d.Enabled = false
		end
	end
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
	c.rv = prepareReveal(c.bear) -- rarity effects off until the end of the reveal
	duckMusic(true)
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
		-- before the growl the fish looks AWAY from where the bear comes from (it is never
		-- seen popping in); once it growls, the fish locks onto it and watches it charge
		local look = -toDen * 6 + side * glance.X * 5 + Vector3.new(0, 4.5 + glance.Y * 2.5, 0)
		if c.trackBear and r then
			local hb = headOf(c.bear)
			local at = if hb then hb.Position else r.Position
			c.trackLook = (c.trackLook or look):Lerp((at - eye) + Vector3.new(0, 0.6, 0) + side * glance.X * 0.6, math.min(1, dt * 5))
			look = c.trackLook
		elseif snapTo then
			look = (snapTo - eye).Unit * 6 + Vector3.new(0, 1.5, 0)
		end
		-- trembling (the fish shivers) + breathing gills
		local tremble = Vector3.new(math.noise(t * 4, 0, 2), math.noise(t * 4, 3, 0), math.noise(0, t * 4, 5)) * (0.04 + panic * 0.12) -- slow handheld sway
		local breathe = Vector3.new(0, math.sin(t * (3 + panic * 6)) * 0.04, 0)
		return CFrame.lookAt(eye + tremble + breathe, eye + look), 74 - panic * 20 + math.sin(t * 2) * 1.5
	end, 120, { smooth = 0, blendIn = 0.25 })
end

local function povAlert()
	local c = current
	local r = rootOf(c.bear)
	c.panic = math.max(c.panic or 0, 0.5)
	-- it was standing far away all along: from now on the fish SEES it, and watches it come
	setBearHidden(c.bear, false)
	for _, d in c.bear:GetDescendants() do
		if d:IsA("BillboardGui") or d:IsA("SurfaceGui") then d.Enabled = false end
	end
	c.trackBear = true
	if r then
		Sound.play("Growl", { at = r.Position, pitch = bearPitch(c.bear), volume = 1.2 })
		-- (the POV now tracks the bear itself)
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
	for _, d in c.bear:GetDescendants() do
		if d:IsA("BillboardGui") or d:IsA("SurfaceGui") then d.Enabled = false end
	end
	rv.teeth = rv.teeth or {}
	for _, d in c.bear:GetDescendants() do
		if d:IsA("BasePart") and d.Name:sub(1, 5) == "Tooth" and not rv.teeth[d] then
			rv.teeth[d] = d.Size
			d.Size = Vector3.new(d.Size.X * 1.5, d.Size.Y * TOOTH_GROW, d.Size.Z * 1.3)
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

-- unit direction from a to b (safe)
local function eye0dir(a: Vector3, b: Vector3): Vector3
	local v = b - a
	return if v.Magnitude > 1e-3 then v.Unit else Vector3.new(0, 0, -1)
end

-- depth of field is far too heavy on phones for these long shots: disabled in the capture
local function noDof(_a: any?, _b: any?) end

local function eatSequence(d)
	local c = current
	if not c then return end
	local tl = d.tl
	local start = d.start
	local G = GameConfig.Capture
	local tChomp = tl.eat + G.chompAt
	local tPick = tl.eat + G.pickupAt
	local tApex = tl.eat + G.tossApex
	local tToss = tl.eat + (G.tossAt or 0.8)
	-- the camera IS the fish: the server fish (welded in the mouth) stays hidden for us
	local toss = nil -- { start, apex }
	local function tossPos(now: number, mouth: Vector3, look: Vector3, sc: number): Vector3?
		if not toss then return nil end
		if now < tApex then
			local k = Easing.quadOut(math.clamp((now - tToss) / (tApex - tToss), 0, 1))
			return toss.start:Lerp(toss.apex, k)
		end
		-- falls back down to a point IN FRONT of the open jaws (on the mouth's axis), then
		-- straight into the mouth: so the camera (the fish's eyes) always faces the opening
		local k = math.clamp((now - tApex) / (tChomp - tApex), 0, 1)
		local front = mouth + look * 3.4 * sc
		if k < 0.6 then
			return toss.apex:Lerp(front, Easing.sineInOut(k / 0.6))
		end
		return front:Lerp(mouth + look * 0.2 * sc, Easing.quadIn((k - 0.6) / 0.4))
	end
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
		local now = Clock.now() - start
		local h = headOf(c.bear)
		local r = rootOf(c.bear)
		if not h or not r then return lastCF, lastFov end
		local sc = c.bear:GetAttribute("Scale") or 1
		local bl = math.max(c.bear:GetAttribute("BodyLength") or 6 * sc, 4)
		local mouthAtt = h:FindFirstChild("MouthAtt")
		local mouth = if mouthAtt then (mouthAtt :: Attachment).WorldPosition else h.Position
		local panicT = os.clock()
		-- the fish's eyes: wide open in terror, trembling (no more heavy tunnel: we SEE the bear)
		Cine.setLids(if now > tChomp then 0 else (0.94 + math.sin(panicT * 6) * 0.03))
		Cine.dark(0.42)
		-- slow handheld sway (a fast per-frame noise read as stutter)
		local tremble = Vector3.new(math.noise(panicT * 3.5, 1), math.noise(panicT * 3.5, 2), math.noise(panicT * 3.5, 3)) * 0.14 * sc
		if now >= 0 then
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
		if now >= tl.sniff + 0.1 then once("sniff2", function() Sound.play("Sniff", { at = mouth, pitch = 0.55, volume = 1.2 }) end) end
		-- the NOSE BOOPS: the snout jabs into the fish -> the view is knocked back and rolls
		local boopKick = 0
		-- warm BREATH on the fish while it sniffs (white puffs, no glow)
		if now >= tl.sniff and now < tl.eat then
			c.breathAt = c.breathAt or 0
			if os.clock() - c.breathAt > 0.45 then
				c.breathAt = os.clock()
				Fx.puff(mouth + h.CFrame.LookVector * 0.3 * sc - Vector3.new(0, 0.2 * sc, 0), Color3.fromRGB(235, 240, 248), 4, 0.55 * sc)
			end
		end
		for i, bt in Animator.BOOPS do
			local at = tl.sniff + bt
			if now >= at then
				once("boop" .. i, function()
					Sound.play("Flop", { pitch = 0.8, volume = 1.2 })
					Fx.blocks(ground, Color3.fromRGB(120, 95, 70), 10, 9 * sc, 0.25 * sc, { life = 0.7, up = 1.4, spread = 2, gravity = 60,
						colors = { Color3.fromRGB(120, 95, 70), Color3.fromRGB(80, 150, 55), Color3.fromRGB(95, 74, 52) } })
					Sound.play("Sniff", { at = mouth, pitch = 0.5, volume = 1.4 })
					CameraController.shake(1.3, 0.3)
					CameraController.punch(6)
					Cine.motion(8)
				end)
			end
			local u = (now - at) / 0.45
			if u > 0 and u < 1 then boopKick += math.sin(u * math.pi) * (1 - u) * 1.6 end
		end
		local body = r.Position
		local feet = Vector3.new(body.X, ground.Y - 0.2, body.Z)
		local cf, fov
		-- the lens must NEVER go inside the bear's head / snout (it used to clip on the jabs)
		local function keepOut(eye: Vector3): Vector3
			for _, part in { h, c.muzzle } do
				if part and part.Parent then
					local pp = (part :: BasePart)
					local rad = math.max(pp.Size.X, pp.Size.Y, pp.Size.Z) * 0.62 + 0.35 * sc
					local v = eye - pp.Position
					if v.Magnitude < rad then
						eye = pp.Position + (if v.Magnitude > 1e-3 then v.Unit else -baseFwd) * rad
					end
				end
			end
			return eye
		end
		if c.muzzle == nil then c.muzzle = c.bear:FindFirstChild("Muzzle", true) or false end
		-- the fish's eye on the ground: a little back from where the snout lands
		local towardBear = Vector3.new(eye0dir(ground, mouth).X, 0, eye0dir(ground, mouth).Z)
		local groundEye = ground + Vector3.new(0, 0.05, 0) - towardBear * 0.9 * sc
		if now < tl.sniff then
			-- S0: THE FISH'S EYES on the ground: the bear WALKS UP TO US, step by step
			local look = h.Position:Lerp(body, 0.35)
			local near = math.clamp(now / math.max(0.1, tl.sniff), 0, 1)
			c.stepAt = c.stepAt or 0
			if os.clock() - c.stepAt > 0.4 - 0.08 * near then
				c.stepAt = os.clock()
				CameraController.shake(0.3 + 0.45 * near * sc, 0.16)
				Sound.play("Footstep", { at = body, pitch = 0.55 / math.max(0.8, sc ^ 0.5), volume = 1.2 })
				Sound.play("Heartbeat", { pitch = 0.4, volume = 0.5 + 0.4 * near })
			end
			cf = CFrame.lookAt(keepOut(groundEye) + tremble, look)
			fov = 72
		elseif now < tl.eat then
			-- S1: the snout comes down sniffing at us... BOOP, BOOP: each nose jab knocks the
			-- view back a little and rolls it
			local eye = keepOut(groundEye - towardBear * boopKick * 0.45 * sc)
			cf = CFrame.lookAt(eye + tremble, mouth:Lerp(h.Position, 0.35)) * CFrame.Angles(0, 0, boopKick * 0.2)
			fov = 70
		elseif now < tPick then
			-- S2: THE BITE: the jaws open WIDE and come down at us (fangs, tongue, red mouth)
			local k = Easing.sineIn(math.clamp((now - tl.eat) / (tPick - tl.eat), 0, 1))
			once("dive", function()
				CameraController.shake(0.7, 0.3)
				Sound.play("Growl", { at = mouth, pitch = bearPitch(c.bear) * 0.7, volume = 1.4 })
			end)
			local aim = mouth - h.CFrame.UpVector * 0.3 * sc
			cf = CFrame.lookAt(keepOut(groundEye) + tremble, aim)
			fov = 72 + 4 * k
		elseif now < tToss then
			-- S3: CAUGHT. We are held in the jaws: the view hangs from the bear's mouth, the
			-- ground drops away as the head LIFTS us, swaying with its head
			once("grab", function()
				Sound.play("Chomp", { at = mouth, pitch = bearPitch(c.bear) * 1.2, volume = 0.9 })
				CameraController.shake(0.8, 0.25)
			end)
			local look = h.CFrame.LookVector
			local eye = mouth + look * 0.5 * sc
			local dir = look - h.CFrame.UpVector * 0.45
			cf = CFrame.lookAt(eye, eye + dir, h.CFrame.UpVector)
			fov = 70
		elseif now < tChomp then
			-- S4: the FLICK: flung into the sky, one smooth roll, the bear below with its jaws
			-- open, waiting... the slow fall... straight into the jaws, between the fangs
			once("toss", function()
				Sound.play("Throw", { pitch = 0.75, volume = 1 })
				CameraController.shake(0.9, 0.3)
				toss = { start = mouth + h.CFrame.LookVector * 0.5 * sc, apex = mouth + UP * (5 + 3 * sc) + baseFwd * 1.4 * sc }
			end)
			local look = h.CFrame.LookVector
			local fp = tossPos(now, mouth, look, sc) or mouth
			local w = math.clamp((now - tToss) / (tChomp - tToss), 0, 1)
			if now >= tApex then
				once("pov", function()
					Sound.play("Throw", { pitch = 0.32, volume = 1 }) -- stretched slow-motion whoosh
					Cine.grade({ tint = Color3.fromRGB(240, 235, 252), saturation = -0.1, contrast = 0.25, brightness = 0.04 }, 0.4)
				end)
				c.slowBeat = c.slowBeat or 0
				if os.clock() - c.slowBeat > 0.6 then
					c.slowBeat = os.clock()
					Sound.play("Heartbeat", { pitch = 0.5, volume = 0.9 })
				end
			end
			local aim = mouth - h.CFrame.UpVector * 0.25 * sc
			local upK = math.clamp((now - tToss) / (tApex - tToss), 0, 1)
			local target = if now < tApex then h.Position:Lerp(aim, upK) else aim
			local roll = Easing.sineInOut(w) * math.pi * 2
			cf = CFrame.lookAt(fp, target) * CFrame.Angles(0, 0, roll)
			fov = 70 + 4 * w
			local enter = math.clamp((w - 0.9) / 0.1, 0, 1)
			Cine.dark(0.3 + 0.45 * enter)
			Cine.setLids(1)
		else
			once("chomp", function()
				Sound.play("Chomp", { at = mouth, pitch = bearPitch(c.bear) * 0.85, volume = 1.5 })
				Sound.play("Growl", { pitch = bearPitch(c.bear) * 0.6, volume = 0.8 })
				CameraController.shake(1.6, 0.45)
				freezeUntil = os.clock() + 0.12 -- hit-stop on the bite
				Cine.blackout(true, 0.04)
				Cine.eyelids(false)
			end)
			cf, fov = lastCF or CFrame.lookAt(mouth + h.CFrame.LookVector * 0.3, mouth), lastFov
		end
		-- DROOL dripping off the fangs while the jaws are open (little drops, natural colour)
		if now > tl.eat + 0.2 and now < tChomp then
			c.droolAt = c.droolAt or 0
			if os.clock() - c.droolAt > 0.14 then
				c.droolAt = os.clock()
				Fx.blocks(mouth - h.CFrame.UpVector * 0.3 * sc + h.CFrame.LookVector * 0.15 * sc, Color3.fromRGB(205, 228, 245), 1, 1.5, 0.1 * sc,
					{ life = 0.9, up = -0.5, spread = 0.4, gravity = 45 })
			end
		end
		-- never under the ground
		local pp = cf.Position
		if pp.Y < ground.Y - 0.5 then cf = CFrame.lookAt(Vector3.new(pp.X, ground.Y - 0.5, pp.Z), pp + cf.LookVector) end
		lastCF, lastFov = cf, fov
		return cf, fov
	end, tl.total + 1, { smooth = 12, blendIn = 0.2 })
end

local function luckText(v: number): string
	if v < 10 then return ("x%.2f"):format(v) end
	if v < 1000 then return ("x%.1f"):format(v) end
	return "x" .. Format.short(v)
end

------------------------------------------------------------------------------------------
-- STAGE UI: NO panels, NO backgrounds. Pure typography over the cinematic:
--   a small spaced-out stage title with a thin accent line that draws itself, and a HUGE
--   value (thick black outline, white -> stage colour gradient) that pops on every tick.
--   When a stage lands, the value SLAMS (big -> settle, a shine sweeps through it), then
--   flies up into the results line at the top (small outlined texts with separators).
------------------------------------------------------------------------------------------
local function spaced(text: string): string
	-- letter-spaced title (UTF-8 safe)
	local out = {}
	for _, cp in utf8.codes(text) do table.insert(out, utf8.char(cp)) end
	return table.concat(out, " ")
end

local function buildStageUi()
	local g = Sim.new("ScreenGui", { Name = "TFBRevealStages", ResetOnSpawn = false, DisplayOrder = 13, IgnoreGuiInset = true,
		ScreenInsets = Enum.ScreenInsets.None, ZIndexBehavior = Enum.ZIndexBehavior.Sibling }, player:WaitForChild("PlayerGui"))
	local root = Sim.root(g, "Stages", Vector2.new(640, 260), UDim2.new(0.5, 0, 0.11, 4), Vector2.new(0.5, 0))
	local inner = Sim.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1) }, root)
	local innerScale = Sim.new("UIScale", { Scale = 1 }, inner)
	-- results line (text only)
	local row = Sim.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(640, 34) }, inner)
	Sim.new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Center,
		VerticalAlignment = Enum.VerticalAlignment.Center, Padding = UDim.new(0, 14), SortOrder = Enum.SortOrder.LayoutOrder }, row)
	-- the stage block
	local block = Sim.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(640, 170), Position = UDim2.fromOffset(0, 44) }, inner)
	local blockScale = Sim.new("UIScale", { Scale = 0 }, block)
	local title = Sim.text(block, "", { Size = UDim2.fromOffset(560, 30), Position = UDim2.fromOffset(320, 16), Max = 26, Stroke = 3.5, ZIndex = 7 })
	local tGrad = Sim.gradient(title, { Color3.new(1, 1, 1), Color3.new(1, 1, 1) }, 90)
	-- accent line under the title (draws itself from the centre)
	local line = Sim.new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, Size = UDim2.fromOffset(0, 3),
		Position = UDim2.fromOffset(320, 36), AnchorPoint = Vector2.new(0.5, 0), ZIndex = 6 }, block)
	local lGrad = Sim.new("UIGradient", { Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.5, 0), NumberSequenceKeypoint.new(1, 1) }) }, line)
	local _ = lGrad
	local value = Sim.text(block, "", { Size = UDim2.fromOffset(620, 100), Position = UDim2.fromOffset(320, 98), Max = 92, Stroke = 7, ZIndex = 8 })
	local vGrad = Sim.gradient(value, { Color3.new(1, 1, 1), Color3.new(1, 1, 1) }, 90)
	local vScale = Sim.new("UIScale", {}, value)
	-- shine: a second gradient pass on a copy of the value, swept across on the slam
	local shine = Sim.text(block, "", { Size = UDim2.fromOffset(620, 100), Position = UDim2.fromOffset(320, 98), Max = 92, Stroke = 0, ZIndex = 9 })
	local shineStroke = shine:FindFirstChildOfClass("UIStroke")
	if shineStroke then shineStroke.Enabled = false end
	shine.TextColor3 = Color3.new(1, 1, 1)
	local sGrad = Sim.new("UIGradient", { Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.42, 1),
		NumberSequenceKeypoint.new(0.5, 0.25), NumberSequenceKeypoint.new(0.58, 1), NumberSequenceKeypoint.new(1, 1) }), Rotation = 20, Offset = Vector2.new(-1, 0) }, shine)
	local sScale = Sim.new("UIScale", {}, shine)
	local stamp = Sim.text(inner, "", { Size = UDim2.fromOffset(520, 46), Position = UDim2.fromOffset(320, 232), Max = 40, Stroke = 5, ZIndex = 9,
		Gradient = { Color3.fromRGB(255, 255, 210), Color3.fromRGB(255, 186, 20) } })
	local ss = Sim.new("UIScale", { Scale = 0 }, stamp)
	local function tw(o, t, goal, style, dir)
		TweenService:Create(o, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), goal):Play()
	end
	local ui = {}
	local order = 0
	local ver = 0
	local tiltSign = 1
	local accent = Color3.new(1, 1, 1)
	function ui.stage(name: string, pair)
		ver += 1
		accent = pair[2]
		title.Text = spaced(name)
		tGrad.Color = ColorSequence.new(pair[1]:Lerp(Color3.new(1, 1, 1), 0.4), pair[1])
		line.BackgroundColor3 = pair[1]
		line.Size = UDim2.fromOffset(0, 3)
		tw(line, 0.5, { Size = UDim2.fromOffset(300, 3) }, Enum.EasingStyle.Quint)
		value.Text = ""
		shine.Text = ""
		value.Rotation = 0
		block.Position = UDim2.fromOffset(0, 60)
		blockScale.Scale = 0.6
		tw(blockScale, 0.4, { Scale = 1 }, Enum.EasingStyle.Back)
		tw(block, 0.4, { Position = UDim2.fromOffset(0, 44) }, Enum.EasingStyle.Quint)
	end
	-- color: the value's main colour; pop: a tick (small pop + alternating tilt)
	function ui.value(text: string, color: Color3?, pop: boolean?)
		value.Text = text
		shine.Text = text
		local col = color or Color3.new(1, 1, 1)
		vGrad.Color = ColorSequence.new(col:Lerp(Color3.new(1, 1, 1), 0.55), col)
		if pop then
			tiltSign = -tiltSign
			vScale.Scale = 1.22
			value.Rotation = 4 * tiltSign
			tw(vScale, 0.2, { Scale = 1 }, Enum.EasingStyle.Back)
			tw(value, 0.25, { Rotation = 0 }, Enum.EasingStyle.Back)
		end
	end
	function ui.done(chipText: string, chipColor: Color3)
		-- SLAM: big -> settle, with a shine sweeping through
		vScale.Scale = 1.9
		value.Rotation = -6
		tw(vScale, 0.35, { Scale = 1.06 }, Enum.EasingStyle.Back)
		tw(value, 0.35, { Rotation = 0 }, Enum.EasingStyle.Back)
		sScale.Scale = 1.06
		sGrad.Offset = Vector2.new(-1, 0)
		tw(sGrad, 0.55, { Offset = Vector2.new(1, 0) }, Enum.EasingStyle.Sine)
		local myVer = ver
		task.delay(0.42, function()
			if not g.Parent then return end
			if ver == myVer then
				-- fly up and shrink away into the results line
				tw(blockScale, 0.25, { Scale = 0 }, Enum.EasingStyle.Back, Enum.EasingDirection.In)
				tw(block, 0.25, { Position = UDim2.fromOffset(0, 0) }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
			end
			order += 1
			if order > 1 then
				local sep = Sim.text(row, "•", { Size = UDim2.fromOffset(14, 30), Max = 22, Stroke = 3, ZIndex = 6, LayoutOrder = order * 2 - 1 })
				sep.TextColor3 = Color3.fromRGB(220, 220, 230)
			end
			local chipHolder = Sim.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(140, 34), LayoutOrder = order * 2 }, row)
			local cs = Sim.new("UIScale", { Scale = 0 }, chipHolder)
			Sim.text(chipHolder, chipText, { Size = UDim2.fromScale(1, 1), Max = 28, Stroke = 3.5, ZIndex = 6,
				Gradient = { chipColor:Lerp(Color3.new(1, 1, 1), 0.5), chipColor } })
			tw(cs, 0.35, { Scale = 1 }, Enum.EasingStyle.Back)
		end)
	end
	function ui.shake(a: number)
		local t = os.clock()
		local k = math.clamp(a, 0, 1) * 3
		value.Position = UDim2.fromOffset(320 + math.noise(t * 14, 1) * k, 98 + math.noise(t * 14, 2) * k)
		shine.Position = value.Position
	end
	function ui.stamp(text: string)
		stamp.Text = text
		ss.Scale = 2.5
		tw(ss, 0.3, { Scale = 1 }, Enum.EasingStyle.Back)
	end
	local closed = false
	function ui.close()
		if closed then return end
		closed = true
		tw(innerScale, 0.3, { Scale = 0 }, Enum.EasingStyle.Back, Enum.EasingDirection.In)
		task.delay(0.35, function() g:Destroy() end)
	end
	local _ = accent
	return ui
end


------------------------------------------------------------------------------------------
-- 3) THE REVEAL, IN STAGES. The bear is in full colour. A LOCAL copy plays it (so it can
-- physically grow and mutate): it starts at ~45 % of its size.
--   RARITY   : casino ticker climbing tier by tier, the bear tense... ROAR when it lands
--   MUTATION : (only Golden / Diamond / Rainbow) ticker, then the mutation WASHES over the
--              bear bottom -> top, stud chips flying off the wave front, big dog-shake
--   LUCK     : x1.00 rolling up (never down) while the bear GROWS
--   KG       : the weight rolling up, the bear grows to its REAL size in heavy stomps
--   FINAL    : freeze... cut to black... SLAM under the face: giant rear-up roar, crash
--              down, the name, slow hero orbit
-- One continuous, slow orbit carries the camera through all the stages (fluid).
------------------------------------------------------------------------------------------
local function flatUnit(v: Vector3, fallback: Vector3): Vector3
	local f = Vector3.new(v.X, 0, v.Z)
	return if f.Magnitude > 0.05 then f.Unit else fallback
end

local function revealSequence(d)
	local c = current
	if not c then return end
	local G = GameConfig.Capture
	c.mode = "reveal"
	local st = d.stages or { rarity = G.revealRarity, mutation = 0, luck = G.revealLuck, kg = G.revealKg, final = G.revealFinal }
	local e1 = st.rarity
	local e2 = e1 + st.mutation
	local e3 = e2 + st.luck
	local e4 = e3 + st.kg
	local tier = RarityConfig.get(d.final or "Common")
	local tcol = tier.textColor or tier.color
	local finalIdx = tier.index
	local variant = d.variant or "Normal"
	local vIdx = math.max(1, table.find(RarityConfig.VariantOrder, variant) or 1)
	local luck, kg = d.luck or 1, d.weight or 0
	local sb = c.bear
	local sroot = rootOf(sb)
	if not sroot then return end
	local species = d.species or sb:GetAttribute("Species")
	local fullScale = sb:GetAttribute("Scale") or 1
	local fullLen = sb:GetAttribute("BodyLength") or 6 * fullScale
	local feetAtt = sroot:FindFirstChild("Feet")
	local groundY = if feetAtt then (feetAtt :: Attachment).WorldPosition.Y - 0.1 else sroot.Position.Y - 2
	local fwd = flatUnit(sroot.CFrame.LookVector, Vector3.new(0, 0, -1))
	local basePos = Vector3.new(sroot.Position.X, groundY, sroot.Position.Z)
	local baseCF = CFrame.lookAt(basePos, basePos + fwd)
	local side = baseCF.RightVector
	local UP = Vector3.new(0, 1, 0)
	local S0 = G.revealStartScale or 0.45

	-- the local copies --------------------------------------------------------------
	local function makeCopy(v: string): Model?
		local ok, m = pcall(BearBuilder.build, species, { weight = kg, variant = v })
		if not ok or not m or not m.PrimaryPart then
			warn("[TFB] reveal copy", m)
			return nil
		end
		m.Name = "TFBRevealBear"
		for _, x in m:GetDescendants() do
			if x:IsA("BasePart") then
				x.Anchored = false
				x.CanCollide = false
				x.CanQuery = false
				x.CanTouch = false
			elseif x:IsA("ParticleEmitter") or x:IsA("PointLight") or x:IsA("Sparkles") then
				x.Enabled = false -- no glow
			end
		end
		m.PrimaryPart.Anchored = true
		m:SetAttribute("Anim", "Reveal")
		m:SetAttribute("AnimT", d.start)
		m:SetAttribute("RevealMut", st.mutation)
		pcall(function() m:ScaleTo(S0) end)
		return m
	end
	local function place(m: Model?, g: number)
		if not m or not m.Parent or not m.PrimaryPart then return end
		if math.abs(m:GetScale() - g) > 0.002 then pcall(function() m:ScaleTo(g) end) end
		local r = m.PrimaryPart
		local fa = r:FindFirstChild("Feet")
		local fy = if fa then (fa :: Attachment).Position.Y - 0.1 else -2 * g
		r.CFrame = baseCF + Vector3.new(0, -fy, 0)
	end
	local normal = makeCopy("Normal")
	local mutant = if variant ~= "Normal" then makeCopy(variant) else nil
	if not normal then
		-- could not build the copy: play the reveal on the real bear (no growth / wave)
		normal = nil
	end
	local mutantParts, normalParts = {}, {}
	if mutant then
		for _, x in mutant:GetDescendants() do
			if x:IsA("BasePart") then
				x.LocalTransparencyModifier = 1
				table.insert(mutantParts, x)
			end
		end
	end
	if normal then
		for _, x in normal:GetDescendants() do
			if x:IsA("BasePart") then table.insert(normalParts, x) end
		end
	end
	local growth = S0
	if normal then
		place(normal, growth)
		normal.Parent = Fx.folder
		setBearHidden(sb, true)
	end
	if mutant then
		place(mutant, growth)
		mutant.Parent = Fx.folder
	end
	if c.rv then restoreTeeth(c.rv) end
	c.finishReveal = function()
		c.finishReveal = nil
		if normal and normal.Parent then normal:Destroy() end
		if mutant and mutant.Parent then mutant:Destroy() end
		if sb.Parent then setBearHidden(sb, false) end
		if c.rv then revealAura(c.rv) end
	end
	local shown = normal -- the copy the camera frames (switches to the mutant after the wave)

	-- look of the scene: full colour, cinematic
	Cine.eyelids(false)
	Cine.dark(0.25)
	Cine.letterbox(true)
	Cine.blackout(false, 0.6)
	Cine.grade({ tint = Color3.new(1, 1, 1), saturation = 0.08, contrast = 0.16, brightness = 0 }, 0.5)
	local ui = buildStageUi()

	local tt = 0 -- stage clock (synced with the bear's animation)
	local slam = nil
	-- ONE continuous slow orbit through all the stages; distance follows the bear's size
	CameraController.run(function(t, dt)
		local m = shown or sb
		local r = rootOf(m)
		local h = headOf(m)
		if not r then return nil, 55 end
		local g = if shown then growth else 1
		local sc = fullScale * g
		local bl = math.max(fullLen * g, 2.5)
		local face = if h then h.Position else r.Position + UP * 2 * sc
		local center = r.Position:Lerp(face, 0.35)
		if slam then
			local s2 = os.clock() - slam
			if s2 < 1.15 then
				-- SLAM + ROAR: crash-zoom to a low hero angle under the face, looking UP
				local k = Easing.expoOut(math.clamp(s2 / 0.3, 0, 1))
				local p = face + fwd * (bl * 1.3 + (6 - 2.5 * k) * sc) + side * 2.2 * sc + UP * (-1.2 * k) * sc
				p = Vector3.new(p.X, math.max(p.Y, groundY + 0.6), p.Z)
				return CFrame.lookAt(p, face:Lerp(center, 0.3) + UP * 0.3 * sc), 70 - 12 * k
			end
			local k = Easing.sineInOut(math.clamp((s2 - 1.15) / 2.2, 0, 1))
			local dirv = CFrame.Angles(0, -0.35 + k * 1.1, 0):VectorToWorldSpace(fwd)
			local p = center + dirv * (bl * 1.5 + 3 * sc) + UP * (0.6 + 1.6 * k) * sc
			p = Vector3.new(p.X, math.max(p.Y, groundY + 0.6), p.Z)
			return CFrame.lookAt(p, center:Lerp(face, 0.45)), 52 + 4 * k
		end
		-- the orbit: from 3/4 front-left, slowly round the front, to 3/4 front-right
		local ang = -0.75 + 1.5 * Easing.sineInOut(math.clamp(tt / e4, 0, 1))
		local dirv = CFrame.Angles(0, ang, 0):VectorToWorldSpace(fwd)
		-- height: low and tense (rarity), a little higher round the mutation / luck,
		-- very low hero angle for the growth (KG) so it towers over us
		local hk = Easing.bump(math.clamp((tt - e1 * 0.6) / math.max(0.1, e3 - e1 * 0.6), 0, 1))
		local lowK = Easing.sineInOut(math.clamp((tt - e3) / 0.6, 0, 1))
		local height = (0.7 + 1.8 * hk - 0.5 * lowK) * sc
		local dist = (bl * 1.45 + 4.2 * sc) * (1 - 0.1 * Easing.sineInOut(math.clamp(tt / e1, 0, 1)))
		local p = center + dirv * dist + UP * height
		p = Vector3.new(p.X, math.max(p.Y, groundY + 0.5), p.Z)
		return CFrame.lookAt(p, center + UP * 0.15 * sc), 52
	end, d.duration + 0.8, { smooth = 6, blendIn = 0.35 })

	task.spawn(function()
		local rng = Random.new()
		local rarNow, mutNow = 0, 0
		local shownL, shownK = 1, 0
		local stage = ""
		local landedR, landedM, landedL, landedK = false, false, false, false
		local wave = nil -- os.clock() when the mutation wave starts
		local lastPulse = -1
		local tickT = 0
		while current == c and sb.Parent do
			tt = Clock.now() - d.start
			if tt >= e4 then break end
			local dt = 1 / 60
			-- 1) RARITY -----------------------------------------------------------------
			if tt < e1 then
				if stage ~= "rarity" then
					stage = "rarity"
					ui.stage("RARITY", Sim.G.purple)
				end
				local p = math.clamp(tt / math.max(0.1, e1 - 0.6), 0, 1)
				local want = math.clamp(1 + math.floor((finalIdx - 1) * p ^ 1.5 + 1e-4), 1, finalIdx)
				if p < 1 then want = math.min(want, math.max(1, finalIdx - 1)) end -- the last tier waits
				if want > rarNow then
					rarNow = want
					local tr = RarityConfig.get(RarityConfig.Order[rarNow])
					ui.value(tr.name:upper(), tr.textColor or tr.color, true)
					Sound.play("Tick", { pitch = 0.9 + rarNow * 0.12, volume = 0.9 })
					CameraController.shake(0.15 + rarNow * 0.04, 0.2)
				end
				ui.shake(p * p)
				if tt >= e1 - 0.55 and not landedR then
					landedR = true
					ui.value(tier.name:upper(), tcol, true)
					ui.done(tier.name:upper(), tcol)
					Sound.play("Reveal" .. math.max(1, tier.reveal))
					Sound.play("Growl", { pitch = bearPitch(sb), volume = 1.2 })
					CameraController.shake(0.6 + tier.index * 0.08, 0.4)
					CameraController.punch(-5)
					Cine.grade({ tint = Color3.new(1, 1, 1):Lerp(tier.color, 0.1), saturation = 0.12 + tier.index * 0.02, contrast = 0.18, brightness = 0.01 }, 0.4)
				end
			-- 2) MUTATION ---------------------------------------------------------------
			elseif tt < e2 then
				if stage ~= "mutation" then
					stage = "mutation"
					ui.stage("MUTATION", Sim.G.pink)
				end
				local p = math.clamp((tt - e1) / math.max(0.1, st.mutation - 0.55), 0, 1)
				local want = math.clamp(1 + math.floor((vIdx - 1) * p ^ 1.3 + 1e-4), 1, vIdx)
				if p < 1 then want = math.min(want, math.max(1, vIdx - 1)) end
				if want > mutNow then
					mutNow = want
					local vid = RarityConfig.VariantOrder[mutNow]
					local vd = RarityConfig.Variants[vid]
					ui.value(vid:upper(), vd.color, true)
					Sound.play("Tick", { pitch = 1.1 + mutNow * 0.15, volume = 0.9 })
				end
				ui.shake(p)
				if tt >= e2 - 0.55 and not landedM then
					landedM = true
					local vd = RarityConfig.Variants[variant]
					ui.value(variant:upper(), vd.color, true)
					ui.done(variant:upper(), vd.color)
					Sound.play("Transform", { volume = 1 })
					Sound.play("Reveal3", { volume = 0.8 })
					CameraController.punch(-6)
					wave = os.clock()
				end
			-- 3) LUCK -------------------------------------------------------------------
			elseif tt < e3 then
				if stage ~= "luck" then
					stage = "luck"
					ui.stage("LUCK", Sim.G.green)
				end
				local p = math.clamp((tt - e2) / math.max(0.1, st.luck - 0.6), 0, 1)
				local ease = p ^ 1.7
				local target = 1 + (luck - 1) * ease
				shownL = math.min(luck, math.max(shownL, shownL + (target - shownL) * rng:NextNumber(0.1, 0.6)))
				ui.value(luckText(shownL), Color3.new(1, 1, 1):Lerp(Color3.fromRGB(255, 214, 60), p), false)
				ui.shake(p * 0.7)
				growth = S0 + (0.72 - S0) * Easing.sineInOut(math.clamp((tt - e2) / st.luck, 0, 1))
				tickT -= dt
				if tickT <= 0 then
					tickT = 0.1 - 0.05 * p
					Sound.play("Tick", { pitch = 0.8 + p, volume = 0.5 })
				end
				if p >= 1 and not landedL then
					landedL = true
					ui.value(luckText(luck), Color3.fromRGB(255, 214, 60), true)
					ui.done(luckText(luck), Color3.fromRGB(150, 255, 90))
					Sound.play("Reveal2", { volume = 0.8 })
					if d.mult then ui.stamp(("LUCK x%d!"):format(d.mult)) end
				end
			-- 4) KG ---------------------------------------------------------------------
			else
				if stage ~= "kg" then
					stage = "kg"
					ui.stage("SIZE", Sim.G.blue)
				end
				local q = math.clamp((tt - e3) / st.kg, 0, 1)
				local p = math.clamp((tt - e3) / math.max(0.1, st.kg - 0.3), 0, 1)
				local target = kg * p ^ 1.5
				shownK = math.min(kg, math.max(shownK, shownK + (target - shownK) * rng:NextNumber(0.1, 0.6)))
				ui.value(Format.kg(shownK), Color3.new(1, 1, 1):Lerp(Color3.fromRGB(255, 214, 60), p), false)
				-- growth in heavy STOMPS (one every 0.4 s, synced with the bear's stomps)
				local n = math.max(1, math.floor(st.kg / 0.4))
				local step = q * n
				local idx = math.floor(step)
				local frac = step - idx
				local stair = (math.min(idx, n) + (if idx < n then Easing.sineOut(math.clamp(frac / 0.35, 0, 1)) else 0)) / n
				growth = 0.72 + (1 - 0.72) * math.clamp(stair, 0, 1)
				if idx ~= lastPulse and idx < n then
					lastPulse = idx
					CameraController.shake(0.5 + 0.3 * q, 0.25)
					CameraController.punch(-1.5)
					Sound.play("Land", { pitch = 0.5 - 0.1 * q, volume = 1.1 })
					Sound.play("Lift", { pitch = 0.45, volume = 0.6 })
				end
				if p >= 1 and not landedK then
					landedK = true
					ui.value(Format.kg(kg), Color3.fromRGB(255, 214, 60), true)
					ui.done(Format.kg(kg), Color3.fromRGB(110, 210, 255))
				end
			end
			-- the MUTATION WAVE: the variant copy replaces the normal one, bottom -> top
			if wave and normal and mutant then
				local k = math.clamp((os.clock() - wave) / 0.8, 0, 1)
				local r0 = normal.PrimaryPart
				local lo = r0.Position.Y - 3 * fullScale * growth
				local hi = r0.Position.Y + 3 * fullScale * growth
				local y = lo + (hi - lo) * Easing.sineInOut(k)
				for _, x in normalParts do
					if x.Parent then x.LocalTransparencyModifier = if x.Position.Y <= y then 1 else 0 end
				end
				for _, x in mutantParts do
					if x.Parent then x.LocalTransparencyModifier = if x.Position.Y <= y then 0 else 1 end
				end
				-- stud chips of the new colour flying off the wave front
				if k < 1 and math.random() < 0.6 then
					local vd = RarityConfig.Variants[variant]
					Fx.blocks(Vector3.new(r0.Position.X, y, r0.Position.Z) + side * (math.random() - 0.5) * 2 * fullScale * growth,
						vd.color, 2, 6, 0.18 * fullScale, { life = 0.7, up = 0.8, spread = 1.6, gravity = 30 })
				end
				if k >= 1 then
					wave = nil
					shown = mutant
					normal:Destroy()
					normal = nil
				end
			end
			place(normal, growth)
			place(mutant, growth)
			task.wait()
		end
		if current ~= c then ui.close() return end
		growth = 1
		place(normal, 1)
		place(mutant, 1)
		-- PEAK: freeze... CUT TO BLACK, silence... SLAM
		CameraController.shake(0, 0)
		Sound.play("Heartbeat", { pitch = 0.45, volume = 1.2 })
		task.wait(0.2)
		if current ~= c then ui.close() return end
		Cine.blackout(true, 0.03)
		task.wait(0.16)
		if current ~= c then ui.close() return end
		Cine.blackout(false, 0)
		slam = os.clock()
		Sound.play("Reveal" .. math.max(1, tier.reveal))
		Sound.play("Growl", { pitch = bearPitch(sb) * 0.85, volume = 1.5 })
		Sound.play("Transform", { volume = 0.8 })
		CameraController.shake(1.2 + tier.index * 0.1, 0.6)
		CameraController.punch(-10)
		Cine.motion(14)
		local spec = BearConfig.get(species or "BrownBear")
		local vname = if variant ~= "Normal" then variant .. " " else ""
		task.delay(0.7, function()
			if current == c then ui.close() end
		end)
		task.delay(0.85, function()
			if current == c then Cine.banner((vname .. spec.name):upper(), tcol, tier.name:upper()) end
		end)
		-- crash back down from the roar: ground STOMP, earth flying
		task.delay(1.11, function()
			if current ~= c then return end
			local m = shown or sb
			local r = rootOf(m)
			if not r then return end
			CameraController.shake(1.4 + tier.index * 0.1, 0.5)
			CameraController.punch(-5)
			Sound.play("Land", { pitch = 0.45, volume = 1.4 })
			Fx.blocks(basePos + fwd * 1.2 * fullScale + Vector3.new(0, 0.5, 0), Color3.fromRGB(120, 95, 70), 22, 16 * fullScale, 0.4, { life = 1.1, up = 1.8, spread = 3, gravity = 70,
				colors = { Color3.fromRGB(120, 95, 70), Color3.fromRGB(95, 74, 52), Color3.fromRGB(80, 150, 55), Color3.fromRGB(65, 125, 45) } })
		end)
	end)
end

-- 4) FINALE: the happy bear, the camera pulls back and circles up, then it pops into your arms
local function happyShot(d)
	local c = current
	if not c then return end
	c.mode = "happy"
	if c.finishReveal then c.finishReveal() end
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
		if current and current.finishReveal then current.finishReveal() end
		if current and current.fish then setPartsHidden(bearParts(current.fish), false) end
		current = nil
		Cine.resetAll()
		Cine.resetEaten()
		Cine.letterbox(false)
		duckMusic(false)
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
		duckMusic(false)
		Cine.resetAll()
		Cine.resetEaten()
		if current and current.bear then setBearHidden(current.bear, false) end
		if current and current.fish then setPartsHidden(bearParts(current.fish), false) end
		if current and current.finishReveal then current.finishReveal() end
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
