/* =====================================================================
   Roblox Forge · Jouer — live Roblox engine (server + client in one VM).
   - server Scripts and the client's LocalScripts run together; each Luau
     function remembers its side, so RunService:IsServer()/IsClient() and
     module copies behave like Roblox;
   - the local Player joins: PlayerAdded, StarterGui → PlayerGui,
     StarterPlayerScripts → PlayerScripts, an R15 character with Motor6D
     joints, Humanoid, Animate-like default animations (Motor6D.Transform);
   - RemoteEvent / RemoteFunction route between the two sides (tables are
     copied like the network does);
   - every frame: input → RenderStepped / BindToRenderStep → PreSimulation /
     Stepped → physics (AlignPosition / AlignOrientation, gravity, joints:
     Motor6D, Weld, WeldConstraint) → PostSimulation / Heartbeat → waiting
     threads → tweens (TweenService with all Roblox easing styles).
   ===================================================================== */
import { parse, Interpreter, createGlobals, LuaTable, LuaError, call, callGen, tostr } from './luau.js?v=12';
import { Runtime, Instance, Vector3, Vector2, CFrame, Color3, Signal, enumItem, isA, EnumItem, Simple, UDim2 } from './roblox.js?v=12';
import { installServices, loadPlace } from './runner.js?v=12';
import { AnimSystem } from './anim.js?v=12';
import { SoundSystem } from './sound.js?v=12';
import { Contacts } from './contacts.js?v=12';
import { TerrainData } from './terrain.js?v=12';
import { Humanoids } from './humanoids.js?v=12';
import { Market } from './market.js?v=12';
import { Explosions } from './explosions.js?v=12';
import { Physics } from './physics.js?v=12';
const PHYS_CONSTRAINTS = new Set(['HingeConstraint', 'BallSocketConstraint', 'RopeConstraint', 'RodConstraint', 'SpringConstraint', 'PrismaticConstraint', 'CylindricalConstraint']);
const PHYS_FORCES = new Set(['VectorForce', 'BodyForce', 'LinearVelocity', 'AngularVelocity', 'BodyVelocity', 'BodyAngularVelocity', 'BodyPosition', 'BodyGyro', 'Torque', 'AlignPosition', 'AlignOrientation', 'BodyThrust']);

const fn = (f) => f;
const D2R = Math.PI / 180;

/* ---------------------------------------------------------------- easing */
const EASE = {
  Linear: (t) => t, Sine: (t) => 1 - Math.cos((t * Math.PI) / 2), Quad: (t) => t * t, Cubic: (t) => t * t * t, Quart: (t) => t ** 4, Quint: (t) => t ** 5,
  Exponential: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)), Circular: (t) => 1 - Math.sqrt(1 - t * t), Back: (t) => 2.70158 * t ** 3 - 1.70158 * t * t,
  Elastic: (t) => (t === 0 || t === 1 ? t : -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3))),
  Bounce: (t) => 1 - bounceOut(1 - t),
};
function bounceOut(x) { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; }
export function ease(style = 'Quad', dir = 'Out', t) { const f = EASE[style] || EASE.Quad; if (dir === 'In') return f(t); if (dir === 'Out') return 1 - f(1 - t); return t < 0.5 ? f(t * 2) / 2 : 1 - f((1 - t) * 2) / 2; }
export function lerpValue(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (a instanceof Vector3 && b instanceof Vector3) return new Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
  if (a instanceof Vector2 && b instanceof Vector2) return new Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  if (a instanceof Color3 && b instanceof Color3) return new Color3(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
  if (a instanceof CFrame && b instanceof CFrame) return CFrame.methods.Lerp([a, b, t])[0];
  if (a instanceof Simple && b instanceof Simple && a.t === 'UDim2') { const l = (x, y) => x + (y - x) * t; return UDim2(l(a.f.X.f.Scale, b.f.X.f.Scale), l(a.f.X.f.Offset, b.f.X.f.Offset), l(a.f.Y.f.Scale, b.f.Y.f.Scale), l(a.f.Y.f.Offset, b.f.Y.f.Offset)); }
  if (a instanceof Simple && b instanceof Simple && a.t === 'UDim') return new Simple('UDim', { Scale: a.f.Scale + (b.f.Scale - a.f.Scale) * t, Offset: a.f.Offset + (b.f.Offset - a.f.Offset) * t });
  return t >= 1 ? b : a;
}

/* deep copy of what crosses a remote (Roblox serialises it) */
function netCopy(v, seen = new Map()) { if (!(v instanceof LuaTable)) return typeof v === 'function' ? undefined : v; if (seen.has(v)) return seen.get(v); const t = new LuaTable(); seen.set(v, t); v.arr.forEach((x, i) => t.set(i + 1, netCopy(x, seen))); for (const [k, x] of v.hash) if (typeof k !== 'object' || k instanceof Instance) t.set(k, netCopy(x, seen)); return t; }

/* ---------------------------------------------------------------- R15 blocky rig */
const R15 = {
  HumanoidRootPart: [2, 2, 1], LowerTorso: [2, 0.4, 1], UpperTorso: [2, 1.6, 1], Head: [1.2, 1.2, 1.2],
  LeftUpperArm: [1, 1.2, 1], LeftLowerArm: [1, 1.1, 1], LeftHand: [1, 0.3, 1], RightUpperArm: [1, 1.2, 1], RightLowerArm: [1, 1.1, 1], RightHand: [1, 0.3, 1],
  LeftUpperLeg: [1, 1.2, 1], LeftLowerLeg: [1, 1.1, 1], LeftFoot: [1, 0.3, 1], RightUpperLeg: [1, 1.2, 1], RightLowerLeg: [1, 1.1, 1], RightFoot: [1, 0.3, 1],
};
// joint: name, part0, part1, C0 position (in part0), C1 position (in part1)
const JOINTS = [
  ['Root', 'HumanoidRootPart', 'LowerTorso', [0, -1.07, 0], [0, -0.2, 0]], ['Waist', 'LowerTorso', 'UpperTorso', [0, 0.2, 0], [0, -0.8, 0]], ['Neck', 'UpperTorso', 'Head', [0, 0.8, 0], [0, -0.6, 0]],
  ['LeftShoulder', 'UpperTorso', 'LeftUpperArm', [-1, 0.56, 0], [0.5, 0.39, 0]], ['LeftElbow', 'LeftUpperArm', 'LeftLowerArm', [0, -0.33, 0], [0, 0.29, 0]], ['LeftWrist', 'LeftLowerArm', 'LeftHand', [0, -0.5, 0], [0, 0.125, 0]],
  ['RightShoulder', 'UpperTorso', 'RightUpperArm', [1, 0.56, 0], [-0.5, 0.39, 0]], ['RightElbow', 'RightUpperArm', 'RightLowerArm', [0, -0.33, 0], [0, 0.29, 0]], ['RightWrist', 'RightLowerArm', 'RightHand', [0, -0.5, 0], [0, 0.125, 0]],
  ['LeftHip', 'LowerTorso', 'LeftUpperLeg', [-0.5, -0.2, 0], [0, 0.42, 0]], ['LeftKnee', 'LeftUpperLeg', 'LeftLowerLeg', [0, -0.42, 0], [0, 0.29, 0]], ['LeftAnkle', 'LeftLowerLeg', 'LeftFoot', [0, -0.55, 0], [0, 0.1, 0]],
  ['RightHip', 'LowerTorso', 'RightUpperLeg', [0.5, -0.2, 0], [0, 0.42, 0]], ['RightKnee', 'RightUpperLeg', 'RightLowerLeg', [0, -0.42, 0], [0, 0.29, 0]], ['RightAnkle', 'RightLowerLeg', 'RightFoot', [0, -0.55, 0], [0, 0.1, 0]],
];
const hexC = (h) => { const n = parseInt(String(h).slice(1), 16); return new Color3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };

/* ---------------------------------------------------------------- engine */
export class LiveEngine {
  constructor(roots, readAttributes, { look = {}, log = () => {} } = {}) {
    this.logs = []; this.look = look; this.log = log;
    this.G = createGlobals({ print: (s) => this.logs.push(s), warn: (s) => this.logs.push('⚠️ ' + s) });
    this.I = new Interpreter(this.G); this.I.budget = 4e6;
    const rt = (this.rt = new Runtime(this.I, this.G, { parse: (src, name) => parse(src, name), warn: (s) => this.logs.push('❌ ' + s) }));
    rt.serviceNames = new Set(['Workspace', 'Lighting', 'ReplicatedStorage', 'ReplicatedFirst', 'ServerScriptService', 'ServerStorage', 'StarterGui', 'StarterPack', 'StarterPlayer', 'SoundService', 'Teams', 'Chat', 'TextChatService', 'Players', 'MaterialService', 'TestService', 'LocalizationService', 'HttpService', 'CollectionService', 'TweenService', 'RunService', 'ProximityPromptService', 'VoiceChatService']);
    installServices(rt); loadPlace(rt, roots, readAttributes); this.extend(); this.anims = new AnimSystem(rt, this); this.sounds = new SoundSystem(rt, this); this.contacts = new Contacts(this); this.terrain = new TerrainData(this); this.humanoids = new Humanoids(this); this.market = new Market(this); this.explosions = new Explosions(this); this.physicsSim = new Physics(this); rt.physicsSim = this.physicsSim;
    this.tweens = new Set(); this.joints = new Set(); this.aligns = new Set(); this.prompts = new Set(); this.welds = new Map(); this.constraints = new Set(); this.forces = new Set();
    rt.onParent = (o, p) => this.track(o, p); for (const d of rt.workspace.descendants()) this.track(d, d.parent);
    this.t = 0; this.frameN = 0; this.Instance = Instance; this.enumItem = enumItem; this.Vector3 = Vector3; this.CFrame = CFrame;
  }
  get workspace() { return this.rt.workspace; }
  service(n) { return this.rt.service(n); }
  /* ---- bookkeeping of joints, constraints and prompts as they enter / leave the world ---- */
  track(o, p) {
    const inWorld = !!p && this.inWorld(o);
    const visit = (x) => { const c = x.cls;
      if (c === 'Motor6D' || c === 'Weld' || c === 'ManualWeld' || c === 'Motor' || c === 'Snap' || c === 'Glue' || c === 'WeldConstraint' || c === 'RigidConstraint') { if (inWorld) this.joints.add(x); else this.joints.delete(x); }
      else if (c === 'AlignPosition' || c === 'AlignOrientation' || c === 'LinearVelocity' || c === 'BodyVelocity' || c === 'BodyPosition' || c === 'BodyGyro') { if (inWorld) this.aligns.add(x); else this.aligns.delete(x); }
      else if (c === 'ProximityPrompt') { if (inWorld) this.prompts.add(x); else this.prompts.delete(x); }
      if (PHYS_CONSTRAINTS.has(c)) { if (inWorld) this.constraints.add(x); else this.constraints.delete(x); }
      if (PHYS_FORCES.has(c)) { if (inWorld) this.forces.add(x); else this.forces.delete(x); }
      for (const k of x.kids) visit(k); };
    visit(o); this.jointsDirty = true; this.contacts?.track(o, inWorld); this.explosions?.track(o, inWorld); this.onTrack?.(o, p, inWorld);
  }
  inWorld(o) { let p = o.parent; while (p) { if (p === this.rt.workspace) return true; p = p.parent; } return false; }
  /* ---- Roblox APIs the live game needs beyond the static runner ---- */
  extend() {
    const rt = this.rt, CM = rt.classMethods, eng = this;
    CM.TweenService.Create = fn((a) => { const [, inst, info, goal] = a; const tw = new Instance('Tween', rt); tw.tween = { inst, info, goal }; tw.props.set('PlaybackState', enumItem('PlaybackState', 'Begin')); tw.props.set('Instance', inst); tw.props.set('TweenInfo', info); return [tw]; });
    CM.TweenService.GetValue = fn((a) => [ease(a[2] && a[2].name, a[3] && a[3].name, Math.max(0, Math.min(1, a[1])))]);
    rt.tweens = { play: (tw) => eng.playTween(tw), cancel: (tw) => eng.stopTween(tw, 'Cancelled') };
    CM.Tween.Pause = fn((a) => { eng.stopTween(a[0], 'Paused'); return []; });
    CM.Players.GetPlayers = fn(() => [LuaTable.from(this.service('Players').kids.filter((k) => k.cls === 'Player'))]);
    CM.Player.LoadCharacter = fn((a) => { eng.spawnCharacter(a[0]); return []; });
    CM.Player.GetMouse = fn(() => [eng.mouse]);
    CM.RemoteEvent.FireServer = fn((a) => { eng.toServer(a[0], a.slice(1)); return []; });
    CM.RemoteEvent.FireClient = fn((a) => { eng.toClient(a[0], a.slice(2)); return []; });
    CM.RemoteEvent.FireAllClients = fn((a) => { eng.toClient(a[0], a.slice(1)); return []; });
    CM.UnreliableRemoteEvent = CM.RemoteEvent;
    CM.RemoteFunction.InvokeServer = Object.assign(fn((a) => { const h = a[0].props.get('OnServerInvoke'); return h ? call(h, [eng.player, ...a.slice(1).map((x) => netCopy(x))]) : []; }),
      { ygen: function* (a) { const h = a[0].props.get('OnServerInvoke'); if (!h) return []; const prev = eng.I.side; eng.I.side = 'server'; try { return (yield* callGen(h, [eng.player, ...a.slice(1).map((x) => netCopy(x))])).map((x) => netCopy(x)); } finally { eng.I.side = prev; } } });
    CM.Workspace.Raycast = fn((a) => [eng.raycast ? eng.raycast(a[1], a[2], a[3]) : undefined]);
    CM.Workspace.GetServerTimeNow = fn(() => [eng.serverTime()]);
    // Viewport* = whole screen; Screen* = below the top bar inset (58 px), like Roblox
    CM.Camera.WorldToViewportPoint = fn((a) => eng.worldToScreen ? eng.worldToScreen(a[1], 0) : [new Vector3(0, 0, 1), true]);
    CM.Camera.WorldToScreenPoint = fn((a) => eng.worldToScreen ? eng.worldToScreen(a[1], 58) : [new Vector3(0, 0, 1), true]);
    CM.Camera.ViewportPointToRay = fn((a) => [eng.screenRay ? eng.screenRay(a[1], a[2]) : new Simple('Ray', { Origin: new Vector3(), Direction: new Vector3(0, 0, -1) })]);
    CM.Camera.ScreenPointToRay = fn((a) => [eng.screenRay ? eng.screenRay(a[1], a[2] + 58) : new Simple('Ray', { Origin: new Vector3(), Direction: new Vector3(0, 0, -1) })]);
    CM.UserInputService.GetMouseLocation = fn(() => [new Vector2(eng.input.mx, eng.input.my)]);
    CM.UserInputService.GetLastInputType = fn(() => [enumItem('UserInputType', eng.input.touch ? 'Touch' : 'MouseButton1')]);
    CM.UserInputService.IsKeyDown = fn((a) => [eng.input.keys.has(a[1] && a[1].name)]);
    CM.UserInputService.IsMouseButtonPressed = fn((a) => [!!eng.input.buttons[(a[1] && a[1].name) || '']]);
    CM.GuiService.GetGuiInset = fn(() => [new Vector2(0, 58), new Vector2()]);
    CM.StarterGui.SetCoreGuiEnabled = fn((a) => { eng.coreGui[(a[1] && a[1].name) || 'All'] = !!a[2]; if (a[1] && a[1].name === 'All') for (const k of ['Backpack', 'PlayerList', 'Chat', 'Health', 'EmotesMenu']) eng.coreGui[k] = !!a[2]; eng.onCoreGui?.(); return []; });
    CM.StarterGui.GetCoreGuiEnabled = fn((a) => [eng.coreGui[(a[1] && a[1].name) || 'All'] !== false]);
    CM.StarterGui.SetCore = fn((a) => { eng.onSetCore?.(a[1], a[2]); return []; });
    CM.ContextActionService.BindAction = fn((a) => { eng.actions.set(a[1], { f: a[2], button: a[3], inputs: a.slice(4) }); eng.onActions?.(); return []; });
    CM.ContextActionService.BindActionAtPriority = fn((a) => { eng.actions.set(a[1], { f: a[2], button: a[3], inputs: a.slice(5) }); eng.onActions?.(); return []; });
    CM.ContextActionService.UnbindAction = fn((a) => { eng.actions.delete(a[1]); eng.onActions?.(); return []; });
    CM.Humanoid.MoveTo = fn((a) => { a[0].moveTo = a[1]; return []; });
    CM.Humanoid.ChangeState = fn((a) => { if (a[1] && a[1].name === 'Jumping') a[0].props.set('Jump', true); return []; });
    CM.Humanoid.GetState = fn((a) => [enumItem('HumanoidStateType', a[0].state || 'Running')]);
    CM.Humanoid.TakeDamage = fn((a) => { const h = a[0]; if (h.parent && h.parent.$index('ForceField')) return []; h.$newindex('Health', Math.max(0, (h.props.get('Health') || 0) - a[1])); return []; });
    CM.TextChatService = { DisplayBubble: fn((a) => { eng.onBubble?.(a[1], tostr(a[2])); return []; }) };
    rt.extraMember = ((orig) => (o, k) => { if (o.cls === 'Players' && k === 'LocalPlayer') return eng.I.side === 'client' ? eng.player : undefined; if (o.cls === 'TextChannel' && k === 'DisplaySystemMessage') return fn((a) => { eng.onSystemMessage?.(tostr(a[1])); return []; }); return orig(o, k); })(rt.extraMember);
    CM.TextChannel = { DisplaySystemMessage: fn((a) => { eng.onSystemMessage?.(tostr(a[1]).replace(/<[^>]+>/g, '')); return []; }), SendAsync: fn(() => []) };
    CM.PathfindingService = { CreatePath: fn(() => { const p = new Instance('Path', rt); p.props.set('Status', enumItem('PathStatus', 'Success')); return [p]; }), FindPathAsync: fn((a) => { const p = new Instance('Path', rt); p.from = a[1]; p.to = a[2]; p.props.set('Status', enumItem('PathStatus', 'Success')); return [p]; }) };
    CM.Path = { ComputeAsync: fn((a) => { a[0].from = a[1]; a[0].to = a[2]; return []; }), GetWaypoints: fn((a) => { const p = a[0], wps = []; if (p.from && p.to) { const n = 6; for (let i = 1; i <= n; i++) { const t = i / n; const w = new Instance('PathWaypoint', rt); w.props.set('Position', new Vector3(p.from.x + (p.to.x - p.from.x) * t, p.from.y + (p.to.y - p.from.y) * t, p.from.z + (p.to.z - p.from.z) * t)); w.props.set('Action', enumItem('PathWaypointAction', 'Walk')); wps.push(w); } } return [LuaTable.from(wps)]; }), CheckOcclusionAsync: fn(() => [-1]) };
    rt.classMethods.ParticleEmitter = { Emit: fn((a) => { eng.onEmit?.(a[0], a[1] || 10); return []; }), Clear: fn(() => []) };
    CM.Sound.Play = fn((a) => { a[0].props.set('IsPlaying', true); a[0].props.set('Playing', true); eng.onSound?.(a[0]); return []; });
    this.mouse = new Instance('Mouse', rt); this.coreGui = { Backpack: true, PlayerList: true, Chat: true, Health: true, EmotesMenu: true }; this.actions = new Map();
    this.input = { mx: 0, my: 0, keys: new Set(), buttons: {}, touch: true };
    const gs = this.service('GuiService'); gs.props.set('MenuIsOpen', false); gs.props.set('SelectedObject', undefined); gs.props.set('AutoSelectGuiEnabled', false); gs.props.set('TouchControlsEnabled', true); gs.props.set('PreferredTransparency', 1); gs.props.set('ReducedMotionEnabled', false);
    this.setViewport(390, 844);
  }
  serverTime() { return this.t + 1e9; }
  /* screen size, topbar inset (Roblox: the free space to the right of the Roblox buttons) */
  setViewport(w, h) { this.vw = w; this.vh = h; this.rt.viewW = w; this.rt.viewH = h; const cam = this.rt.workspace.props.get('CurrentCamera'); if (cam) { cam.props.set('ViewportSize', new Vector2(w, h)); cam.changed('ViewportSize'); }
    const gs = this.service('GuiService'); gs.props.set('TopbarInset', new Simple('Rect', { Min: new Vector2(190, 0), Max: new Vector2(Math.max(200, w - 16), 58), Width: Math.max(10, w - 206), Height: 58 })); gs.changed('TopbarInset'); }
  /* ---- remotes ---- */
  toServer(remote, args) { const s = remote.sig('OnServerEvent'); const prev = this.I.side; this.I.side = 'server'; try { s.fire([this.player, ...args.map((x) => netCopy(x))]); } finally { this.I.side = prev; } }
  toClient(remote, args) { const s = remote.sig('OnClientEvent'); const prev = this.I.side; this.I.side = 'client'; try { s.fire(args.map((x) => netCopy(x))); } finally { this.I.side = prev; } }
  /* ---- start: server, then the player joins ---- */
  async start({ onStep } = {}) {
    const rt = this.rt; this.I.side = 'server';
    const isUnder = (o, n) => { let p = o.parent; while (p) { if (p.cls === n) return true; p = p.parent; } return false; };
    const servers = rt.game.descendants().filter((d) => d.cls === 'Script' && !d.disabled && d.source && (isUnder(d, 'ServerScriptService') || isUnder(d, 'Workspace')) && d.runContext !== 2);
    for (const s of servers) this.runScript(s, 'server');
    for (let i = 0; i < 6; i++) this.rt.step(1 / 60);
    onStep?.('Le joueur rejoint la partie…');
    // the player joins
    const players = this.service('Players'), P = new Instance('Player', rt); this.player = P;
    P.props.set('Name', this.look.name || 'Player'); P.props.set('DisplayName', this.look.name || 'Player'); P.props.set('UserId', 1); P.props.set('AccountAge', 365); P.props.set('MembershipType', enumItem('MembershipType', 'None')); P.props.set('Team', undefined); P.props.set('Character', undefined);
    for (const n of ['Backpack', 'PlayerGui', 'PlayerScripts', 'StarterGear']) { const c = new Instance(n, rt); c.props.set('Name', n); c.parent = P; P.kids.push(c); }
    P.setParent(players);
    this.I.side = 'server'; players.sig('PlayerAdded').fire([P]); for (let i = 0; i < 4; i++) this.rt.step(1 / 60);
    // client: StarterGui → PlayerGui, StarterPlayerScripts → PlayerScripts, then LocalScripts run
    this.I.side = 'client';
    const pg = P.child('PlayerGui'), ps = P.child('PlayerScripts');
    for (const g of this.service('StarterGui').kids) { const c = g.clone(); if (c) c.setParent(pg); }
    const sp = this.service('StarterPlayer'), sps = sp.child('StarterPlayerScripts');
    if (sps) for (const k of sps.kids) { const c = k.clone(); if (c) c.setParent(ps); }
    for (const k of this.service('StarterPack').kids) { const c = k.clone(); if (c) c.setParent(P.child('Backpack')); }
    this.spawnCharacter(P);
    const locals = [...ps.descendants(), ...pg.descendants(), ...this.service('ReplicatedFirst').descendants()].filter((d) => (d.cls === 'LocalScript' || (d.cls === 'Script' && d.runContext === 2)) && !d.disabled && d.source);
    for (const s of locals) this.runScript(s, 'client');
    try { this.sounds.autoplay(this.rt.workspace); this.sounds.autoplay(this.service('SoundService')); } catch (e) { console.warn(e); }
    onStep?.('C’est parti !');
  }
  runScript(s, side) { const name = Instance.methods.GetFullName([s])[0]; this.log((side === 'server' ? 'Serveur : ' : 'Client : ') + name); const prev = this.I.side; this.I.side = side;
    try { const f = this.I.load(this.rt.parseScript(s), name, { script: s }); f.side = side; this.rt.spawn(f, []); } catch (e) { this.rt.report(e); } finally { this.I.side = prev; } }
  /* ---- character ---- */
  spawnCharacter(P) {
    const rt = this.rt, L = this.look, old = P.props.get('Character'); if (old) { Instance.methods.Destroy([old]); }
    const m = new Instance('Model', rt); m.props.set('Name', P.props.get('Name')); const parts = {};
    const col = { Head: L.skin, LeftHand: L.skin, RightHand: L.skin, LeftLowerArm: L.skin, RightLowerArm: L.skin, LeftUpperArm: L.shirt, RightUpperArm: L.shirt, UpperTorso: L.shirt, LowerTorso: L.pants, LeftUpperLeg: L.pants, RightUpperLeg: L.pants, LeftLowerLeg: L.pants, RightLowerLeg: L.pants, LeftFoot: L.shoes, RightFoot: L.shoes };
    const spawnPart = rt.workspace.descendants().find((d) => d.cls === 'SpawnLocation'); const base = spawnPart ? spawnPart.props.get('CFrame').get('Position') : new Vector3(0, 10, 0);
    const rootCF = new CFrame([base.x, base.y + 4, base.z]);
    for (const [n, s] of Object.entries(R15)) { const p = new Instance(n === 'HumanoidRootPart' || n === 'Head' || /Torso/.test(n) ? 'Part' : 'MeshPart', rt); p.props.set('Name', n); p.props.set('Size', new Vector3(...s)); p.props.set('CFrame', rootCF);
      p.props.set('Color', hexC(col[n] || '#a3a2a5')); p.props.set('Material', enumItem('Material', 'SmoothPlastic')); p.props.set('Anchored', false); p.props.set('CanCollide', n === 'HumanoidRootPart' || n === 'UpperTorso' || n === 'Head');
      if (n === 'HumanoidRootPart') { p.props.set('Transparency', 1); p.props.set('CanCollide', false); }
      if (n === 'Head') { const sm = new Instance('SpecialMesh', rt); sm.props.set('MeshType', enumItem('MeshType', 'Head')); sm.props.set('Scale', new Vector3(1.25, 1.25, 1.25)); sm.parent = p; p.kids.push(sm); const face = new Instance('Decal', rt); face.props.set('Name', 'face'); face.props.set('Texture', 'rbxasset://textures/face.png'); face.props.set('Face', enumItem('NormalId', 'Front')); face.parent = p; p.kids.push(face); }
      p.parent = m; m.kids.push(p); parts[n] = p; }
    for (const [jn, p0, p1, c0, c1] of JOINTS) { const j = new Instance('Motor6D', rt); j.props.set('Name', jn); j.props.set('Part0', parts[p0]); j.props.set('Part1', parts[p1]); j.props.set('C0', new CFrame(c0)); j.props.set('C1', new CFrame(c1)); j.props.set('Transform', new CFrame()); j.props.set('Enabled', true); j.parent = parts[p1]; parts[p1].kids.push(j); }
    const att = new Instance('Attachment', rt); att.props.set('Name', 'RightGripAttachment'); att.props.set('CFrame', new CFrame([0, -0.15, 0], [1, 0, 0, 0, 0, 1, 0, -1, 0])); att.parent = parts.RightHand; parts.RightHand.kids.push(att);
    for (const [pn, an] of [['HumanoidRootPart', 'RootAttachment'], ['Head', 'HatAttachment'], ['Head', 'FaceFrontAttachment'], ['UpperTorso', 'BodyFrontAttachment'], ['UpperTorso', 'BodyBackAttachment']]) { const a = new Instance('Attachment', rt); a.props.set('Name', an); a.props.set('CFrame', new CFrame(an === 'HatAttachment' ? [0, 0.6, 0] : an === 'FaceFrontAttachment' ? [0, 0, -0.6] : an === 'BodyBackAttachment' ? [0, 0, 0.5] : an === 'BodyFrontAttachment' ? [0, 0, -0.5] : [0, 0, 0])); a.parent = parts[pn]; parts[pn].kids.push(a); }
    const hum = new Instance('Humanoid', rt); hum.props.set('Name', 'Humanoid'); hum.props.set('RootPart', parts.HumanoidRootPart); hum.props.set('DisplayName', P.props.get('DisplayName'));
    const ws = this.service('StarterPlayer').props.get('CharacterWalkSpeed'); if (typeof ws === 'number') hum.props.set('WalkSpeed', ws);
    hum.props.set('MoveDirection', new Vector3()); hum.props.set('FloorMaterial', enumItem('Material', 'Plastic')); hum.props.set('RigType', enumItem('HumanoidRigType', 'R15')); hum.props.set('Sit', false); hum.props.set('PlatformStand', false); hum.props.set('AutoRotate', true); hum.props.set('Jump', false);
    hum.parent = m; m.kids.push(hum); const animator = new Instance('Animator', rt); animator.props.set('Name', 'Animator'); animator.parent = hum; hum.kids.push(animator);
    m.props.set('PrimaryPart', parts.HumanoidRootPart); m.parts = parts; m.humanoid = hum; this.char = m;
    hum.sig('Prop:Health'); hum.onHealth = () => { if ((hum.props.get('Health') || 0) <= 0 && !hum.dead) { hum.dead = true; hum.sig('Died').fire([]); this.onDied?.(); setTimeout(() => { if (this.player) this.spawnCharacter(this.player); }, (this.service('Players').props.get('RespawnTime') || 5) * 1000); } };
    const sc = this.service('StarterPlayer').child('StarterCharacterScripts'); if (sc) for (const k of sc.kids) { const c = k.clone(); if (c) { c.parent = m; m.kids.push(c); } }
    this.solveRig(m);
    P.props.set('Character', m); m.setParent(rt.workspace);
    const prev = this.I.side; this.I.side = 'server'; P.sig('CharacterAdded').fire([m]); this.I.side = prev;
    for (const s of m.descendants().filter((d) => (d.cls === 'LocalScript' || d.cls === 'Script') && d.source && !d.disabled)) this.runScript(s, d_side(s));
    this.onCharacter?.(m);
    return m;
  }
  solveRig(m) { for (const d of m.descendants()) if (d.cls === 'Motor6D') this.applyJoint(d, false); }
  /* ---- tweens ---- */
  playTween(tw) {
    const { inst, info, goal } = tw.tween; if (!inst || !(goal instanceof LuaTable)) return;
    const f = info ? info.f : {}; const st = { tw, inst, t: -(f.DelayTime || 0), dur: Math.max(1e-4, f.Time ?? 1), style: f.EasingStyle ? f.EasingStyle.name : 'Quad', dir: f.EasingDirection ? f.EasingDirection.name : 'Out', rep: f.RepeatCount || 0, rev: !!f.Reverses, from: new Map(), to: new Map(), back: false };
    for (const [k, v] of goal.hash) { st.from.set(k, inst.$index(k)); st.to.set(k, v); }
    for (const o of this.tweens) if (o.inst === inst) for (const k of st.to.keys()) if (o.to.has(k)) { o.to.delete(k); o.from.delete(k); } // a new tween on the same property wins
    tw.props.set('PlaybackState', enumItem('PlaybackState', 'Playing')); this.tweens.add(st);
  }
  stopTween(tw, state) { for (const s of this.tweens) if (s.tw === tw) this.tweens.delete(s); tw.props.set('PlaybackState', enumItem('PlaybackState', state)); }
  stepTweens(dt) {
    for (const s of [...this.tweens]) {
      s.t += dt; if (s.t < 0) continue; let k = Math.min(1, s.t / s.dur), e = ease(s.style, s.dir, k); if (s.back) e = 1 - e;
      for (const [p, to] of s.to) { try { s.inst.$newindex(p, lerpValue(s.from.get(p), to, e)); } catch { /* read-only */ } }
      if (k >= 1) { if (s.rev && !s.back) { s.back = true; s.t = 0; continue; } if (s.rep !== 0) { s.rep = s.rep > 0 ? s.rep - 1 : s.rep; s.back = false; s.t = 0; continue; }
        this.tweens.delete(s); s.tw.props.set('PlaybackState', enumItem('PlaybackState', 'Completed')); s.tw.sig('Completed').fire([enumItem('PlaybackState', 'Completed')]); }
    }
  }
  /* ---- joints ---- */
  applyJoint(j, fire = false) {
    const P = j.props, p0 = P.get('Part0'), p1 = P.get('Part1'); if (!p0 || !p1 || P.get('Enabled') === false || !p0.props || !p1.props) return; if (p1.props.get('Anchored') && j.cls !== 'Motor6D') return; // like Roblox, joints do not drag anchored parts
    if (j.cls === 'WeldConstraint' || j.cls === 'RigidConstraint') { if (!j.offset) j.offset = p0.props.get('CFrame').inverse().mulCF(p1.props.get('CFrame')); p1.props.set('CFrame', p0.props.get('CFrame').mulCF(j.offset)); return; }
    const c0 = P.get('C0') || new CFrame(), c1 = P.get('C1') || new CFrame(), tr = j.cls === 'Motor6D' ? P.get('Transform') || new CFrame() : new CFrame();
    p1.props.set('CFrame', p0.props.get('CFrame').mulCF(c0).mulCF(tr).mulCF(c1.inverse())); void fire;
  }
  /* order joints so that every Part0 is placed before it drives its Part1 (from the assembly root) */
  orderJoints() {
    const list = [...this.joints].filter((j) => j.props.get('Part0') && j.props.get('Part1')); const by1 = new Map(); for (const j of list) by1.set(j.props.get('Part1'), j);
    const depth = (j, seen = 0) => { let d = 0, p = j.props.get('Part0'); while (by1.has(p) && d < 64) { p = by1.get(p).props.get('Part0'); d++; } return d + seen; };
    this.jointOrder = list.map((j) => [depth(j), j]).sort((a, b) => a[0] - b[0]).map((x) => x[1]); this.jointsDirty = false;
  }
  /* ---- physics (simple): constraints move assembly roots, gravity for free parts ---- */
  physics(dt) {
    for (const c of this.aligns) {
      const P = c.props; if (P.get('Enabled') === false) continue; const a0 = P.get('Attachment0'), part = a0 && a0.parent; if (!part || !isA(part.cls, 'BasePart') || part.props.get('Anchored')) continue;
      const root = this.rootOf(part), cf = root.props.get('CFrame');
      if (c.cls === 'AlignPosition') { let tgt = P.get('Position'); const a1 = P.get('Attachment1'); if (a1 && a1.parent && a1.parent.props) tgt = a1.parent.props.get('CFrame').pointToWorld(a1.props.get('Position') || (a1.props.get('CFrame') || new CFrame()).get('Position'));
        if (!(tgt instanceof Vector3)) continue; const p = cf.p, d = [tgt.x - p[0], tgt.y - p[1], tgt.z - p[2]], len = Math.hypot(...d); if (len < 1e-4) continue;
        const maxV = P.get('MaxVelocity') ?? Infinity, resp = P.get('Responsiveness') ?? 10, rigid = P.get('RigidityEnabled'); let step = rigid ? len : Math.min(len, Math.max(len * Math.min(1, resp * dt * 0.6), 0), (isFinite(maxV) ? maxV : 1e9) * dt);
        const k = step / len; root.props.set('CFrame', new CFrame([p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k], cf.r)); root.props.set('AssemblyLinearVelocity', new Vector3(d[0] * k / dt, d[1] * k / dt, d[2] * k / dt)); root.aligned = this.frameN; }
      else if (c.cls === 'AlignOrientation') { const tcf = P.get('CFrame') || (P.get('Attachment1') && P.get('Attachment1').parent ? P.get('Attachment1').parent.props.get('CFrame') : null); if (!tcf) continue;
        const resp = P.get('Responsiveness') ?? 10, rigid = P.get('RigidityEnabled'), t = rigid ? 1 : Math.min(1, resp * dt * 0.5); const cur = root.props.get('CFrame'); const blended = CFrame.methods.Lerp([new CFrame([0, 0, 0], cur.r), new CFrame([0, 0, 0], tcf.r), t])[0];
        root.props.set('CFrame', new CFrame(cur.p, blended.r)); root.aligned = this.frameN; }
      else if (c.cls === 'LinearVelocity' || c.cls === 'BodyVelocity') { const v = P.get(c.cls === 'BodyVelocity' ? 'Velocity' : 'VectorVelocity'); if (v instanceof Vector3) { const p = cf.p; root.props.set('CFrame', new CFrame([p[0] + v.x * dt, p[1] + v.y * dt, p[2] + v.z * dt], cf.r)); root.aligned = this.frameN; } }
    }
    // free roots: integrate velocity + gravity; land on the ground
    for (const root of this.freeRoots || []) {
      if (root.aligned === this.frameN || root.props.get('Anchored') || root === this.char?.parts?.HumanoidRootPart || !root.parent || this.physicsSim?.bodies.has(root) || (this.physicsSim?.want && !this.physicsSim.ready)) continue;
      let v = root.props.get('AssemblyLinearVelocity') || new Vector3(); const cf = root.props.get('CFrame'); if (root.grounded && Math.hypot(v.x, v.z) < 0.05 && Math.abs(v.y) < 0.05) continue;
      v = new Vector3(v.x, v.y - (this.rt.workspace.props.get('Gravity') || 196.2) * dt, v.z); let ny = cf.p[1] + v.y * dt;
      const hit = this.groundAt ? this.groundAt(cf.p[0], cf.p[1] + 1, cf.p[2], root) : null; const half = (root.props.get('Size') || new Vector3(1, 1, 1)).y / 2;
      if (hit !== null && ny - half <= hit) { ny = hit + half; v = new Vector3(v.x * 0.6, 0, v.z * 0.6); root.grounded = true; } else root.grounded = false;
      root.props.set('CFrame', new CFrame([cf.p[0] + v.x * dt, ny, cf.p[2] + v.z * dt], cf.r)); root.props.set('AssemblyLinearVelocity', v);
    }
  }
  rootOf(part) { let p = part, n = 0; const by1 = this.by1 || new Map(); while (by1.has(p) && n++ < 64) p = by1.get(p); return p; }
  rebuildAssemblies() { this.by1 = new Map(); for (const j of this.joints) { const p0 = j.props.get('Part0'), p1 = j.props.get('Part1'); if (p0 && p1) this.by1.set(p1, p0); }
    // free roots: unanchored parts in the world that no joint drives and that are not part of the character
    this.freeRoots = []; for (const d of this.rt.workspace.descendants()) if (isA(d.cls, 'BasePart') && !d.props.get('Anchored') && !this.by1.has(d) && !(this.char && d.parent === this.char)) this.freeRoots.push(d); }
  /* ---- one frame ---- */
  frame(dt, hooks = {}) {
    dt = Math.min(dt, 0.1); this.t += dt; this.frameN++; const rt = this.rt, RS = this.service('RunService');
    const fire = (sigName, args, side = 'client') => { const s = RS.sigs.get(sigName); if (s && s.conns.length) { const prev = this.I.side; this.I.side = side; try { s.fire(args); } finally { this.I.side = prev; } } };
    hooks.input?.();
    this.lastDt = dt;
    fire('PreRender', [dt]); fire('RenderStepped', [dt]);
    if (rt.renderSteps.size) { const prev = this.I.side; this.I.side = 'client'; for (const [, b] of [...rt.renderSteps].sort((a, b) => (a[1].pri ?? 0) - (b[1].pri ?? 0))) { try { call(b.f, [dt]); } catch (e) { rt.report(e); } } this.I.side = prev; }
    hooks.camera?.(dt);
    hooks.animate?.(dt);
    fire('PreAnimation', [dt]); this.anims.step(dt); fire('PreSimulation', [dt]); fire('Stepped', [this.t, dt]);
    hooks.character?.(dt);
    try { this.humanoids.step(dt); } catch (e) { console.warn('humanoids', e); }
    if (this.jointsDirty || !this.jointOrder || this.frameN % 30 === 0) { this.orderJoints(); this.rebuildAssemblies(); }
    this.physics(dt);
    try { this.physicsSim.step(dt); } catch (e) { console.warn('physics', e); }
    for (const j of this.jointOrder) this.applyJoint(j);
    try { this.contacts.step(); } catch (e) { console.warn('contacts', e); }
    try { this.explosions.step(); } catch (e) { console.warn('explosions', e); }
    fire('PostSimulation', [dt]); fire('Heartbeat', [dt]);
    rt.step(dt); this.stepTweens(dt); this.sounds.step();
    if (this.char && this.char.humanoid && this.char.humanoid.onHealth) this.char.humanoid.onHealth();
  }
}
const d_side = (s) => (s.cls === 'LocalScript' ? 'client' : 'server');
export { Instance, Vector3, Vector2, CFrame, Color3, enumItem, isA, EnumItem, LuaTable };
