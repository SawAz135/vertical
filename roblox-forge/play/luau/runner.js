/* =====================================================================
   Roblox Forge · Jouer — runs a Roblox place's server scripts to build
   its world, the way Roblox does when a server starts.
   1. the place's instances (from rbxl.js) become runtime Instances, with
      their properties, attributes, tags and script sources;
   2. services answer like Roblox (GetService, RunService, TweenService,
      CollectionService, Players, Debris, HttpService…);
   3. every enabled server Script runs; deferred tasks run for a few
      simulated seconds;
   4. Workspace's parts (and Lighting) come back as a Forge map.
   Client scripts and the game loop are not run here.
   ===================================================================== */
import { parse, Interpreter, createGlobals, LuaTable, LuaError, tostr, call } from './luau.js?v=11';
import { Runtime, Instance, Vector3, Vector2, CFrame, Color3, Signal, enumItem, isA, EnumItem, Simple, bounds, UDim2, UDim, NumberRange, Keypoint, KNOWN_VALUES } from './roblox.js?v=11';

const fn = (f) => f;
const dec = new TextDecoder();
const str = (v) => (v instanceof Uint8Array ? dec.decode(v) : v == null ? '' : String(v));
const MATERIAL_NAME = { 256: 'Plastic', 272: 'SmoothPlastic', 288: 'Neon', 512: 'Wood', 528: 'WoodPlanks', 784: 'Marble', 788: 'Basalt', 800: 'Slate', 804: 'CrackedLava', 816: 'Concrete', 820: 'Limestone', 832: 'Granite', 836: 'Pavement', 848: 'Brick', 864: 'Pebble', 880: 'Cobblestone', 896: 'Rock', 912: 'Sandstone',
  1040: 'CorrodedMetal', 1056: 'DiamondPlate', 1072: 'Foil', 1088: 'Metal', 1280: 'Grass', 1284: 'LeafyGrass', 1296: 'Sand', 1312: 'Fabric', 1328: 'Snow', 1344: 'Mud', 1360: 'Ground', 1376: 'Asphalt', 1392: 'Salt', 1536: 'Ice', 1552: 'Glacier', 1568: 'Glass', 1584: 'ForceField', 1792: 'Air', 2048: 'Water' };
const SHAPES = ['Ball', 'Block', 'Cylinder', 'Wedge', 'CornerWedge'];
const SURFACES = ['Smooth', 'Glue', 'Weld', 'Studs', 'Inlet', 'Universal', 'Hinge', 'Motor', 'SteppingMotor', 'Unjoinable', 'SmoothNoOutlines'];

/* ---------------------------------------------------------------- services */
export function installServices(rt) {
  const G = rt.G, CM = rt.classMethods, svc = (n) => rt.service(n);
  const sig = (o, n) => o.sig(n);
  rt.extraMember = (o, k) => { if (o.cls === 'DataModel') { const known = ['Workspace', 'Players', 'Lighting', 'ReplicatedStorage', 'ReplicatedFirst', 'ServerStorage', 'ServerScriptService', 'StarterGui', 'StarterPack', 'StarterPlayer', 'SoundService', 'Teams', 'Chat', 'TextChatService'];
    if (known.includes(k)) return svc(k); if (k === 'PlaceId' || k === 'GameId' || k === 'CreatorId' || k === 'PlaceVersion') return 0; if (k === 'JobId') return 'forge-jouer'; if (k === 'CreatorType') return enumItem('CreatorType', 'User'); } return undefined; };
  CM.DataModel = {
    GetService: fn((a) => [svc(String(a[1]))]), FindService: fn((a) => [svc(String(a[1]))]), getService: fn((a) => [svc(String(a[1]))]),
    IsLoaded: fn(() => [true]), BindToClose: fn(() => []), GetObjects: fn(() => [new LuaTable()]), SetPlaceId: fn(() => []), HttpGet: fn(() => ['']),
  };
  CM.RunService = { IsServer: fn(() => [rt.I.side !== 'client']), IsClient: fn(() => [rt.I.side === 'client']), IsStudio: fn(() => [false]), IsRunning: fn(() => [true]), IsRunMode: fn(() => [false]), IsEdit: fn(() => [false]),
    BindToRenderStep: fn((a) => { rt.renderSteps.set(a[1], { pri: a[2], f: a[3] }); return []; }), UnbindFromRenderStep: fn((a) => { rt.renderSteps.delete(a[1]); return []; }), Set3dRenderingEnabled: fn(() => []) };
  rt.renderSteps = new Map();
  CM.TweenService = { Create: fn((a) => { const [, inst, info, goal] = a; const tw = new Instance('Tween', rt); tw.props.set('PlaybackState', enumItem('PlaybackState', 'Begin'));
      rt.classMethods.Tween = rt.classMethods.Tween || {}; tw.tween = { inst, info, goal }; return [tw]; }),
    GetValue: fn((a) => [a[1]]), SmoothDamp: fn((a) => [a[2], a[3]]) };
  CM.Tween = { Play: fn((a) => { rt.tweens?.play(a[0]); return []; }), Cancel: fn((a) => { rt.tweens?.cancel(a[0]); return []; }), Pause: fn((a) => { rt.tweens?.cancel(a[0]); return []; }), Destroy: fn(() => []) };
  rt.tweens = rt.tweens || { play(tw) { const { inst, goal } = tw.tween; if (goal instanceof LuaTable) { for (const [k, v] of goal.hash) inst.$newindex(k, v); } tw.sig('Completed').fire([enumItem('PlaybackState', 'Completed')]); }, cancel() {} };
  CM.CollectionService = { GetTagged: fn((a) => [LuaTable.from(rt.game.descendants().filter((d) => d.tags.has(a[1])))]), AddTag: fn((a) => { a[1].tags.add(a[2]); rt.tagSig(a[2]).fire([a[1]]); return []; }), RemoveTag: fn((a) => { a[1].tags.delete(a[2]); return []; }),
    HasTag: fn((a) => [a[1].tags.has(a[2])]), GetTags: fn((a) => [LuaTable.from([...a[1].tags])]), GetInstanceAddedSignal: fn((a) => [rt.tagSig(a[1])]), GetInstanceRemovedSignal: fn((a) => [rt.tagSig('-' + a[1])]), GetAllTags: fn(() => [new LuaTable()]) };
  rt.tagSigs = new Map(); rt.tagSig = (t) => { if (!rt.tagSigs.has(t)) rt.tagSigs.set(t, new Signal('Tag ' + t)); return rt.tagSigs.get(t); }; rt.tagAdded = (o, t) => rt.tagSig(t).fire([o]);
  CM.Players = { GetPlayers: fn(() => [LuaTable.from(svc('Players').kids.filter((k) => k.cls === 'Player'))]), GetPlayerFromCharacter: fn((a) => [svc('Players').kids.find((p) => p.props.get('Character') === a[1])]),
    GetPlayerByUserId: fn((a) => [svc('Players').kids.find((p) => p.props.get('UserId') === a[1])]), GetUserIdFromNameAsync: fn(() => [1]), GetNameFromUserIdAsync: fn(() => ['Player']), GetUserThumbnailAsync: fn(() => ['', true]), GetFriendsAsync: fn(() => [new LuaTable()]), CreateHumanoidModelFromDescription: fn(() => [new Instance('Model', rt)]), GetHumanoidDescriptionFromUserId: fn(() => [new Instance('HumanoidDescription', rt)]) };
  svc('Players').props.set('MaxPlayers', 1); svc('Players').props.set('RespawnTime', 5); svc('Players').props.set('CharacterAutoLoads', true);
  CM.Debris = { AddItem: fn((a) => { rt.start(fn(() => { if (a[1] && a[1].$index) Instance.methods.Destroy([a[1]]); return []; }), [], Number(a[2] ?? 10)); return []; }) };
  CM.HttpService = { JSONEncode: fn((a) => [JSON.stringify(toJS(a[1]))]), JSONDecode: fn((a) => [fromJS(JSON.parse(str(a[1])))]), GenerateGUID: fn((a) => { const g = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2); return [a[1] === false ? g : '{' + g + '}']; }), UrlEncode: fn((a) => [encodeURIComponent(str(a[1]))]),
    GetAsync: fn(() => { throw new LuaError('HttpService is not allowed in this place'); }), PostAsync: fn(() => { throw new LuaError('HttpService is not allowed in this place'); }), RequestAsync: fn(() => { throw new LuaError('HttpService is not allowed in this place'); }) };
  /* DataStores keep their data on this device (localStorage), per game: progress survives between sessions like on Roblox */
  const LS = (() => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } })(); const mem = new Map();
  const dsKey = (name, scope, k) => `forgeplay.ds.${rt.placeKey || 'place'}.${name}.${scope || 'global'}.${k}`;
  const dsGet = (name, scope, k) => { const key = dsKey(name, scope, k); if (LS) { try { const v = LS.getItem(key); return v == null ? undefined : fromJS(JSON.parse(v)); } catch { return undefined; } } return mem.get(key); };
  const dsSet = (name, scope, k, v) => { const key = dsKey(name, scope, k); if (LS) { try { if (v === undefined) LS.removeItem(key); else LS.setItem(key, JSON.stringify(toJS(v))); } catch {} } else if (v === undefined) mem.delete(key); else mem.set(key, v); };
  const dsKeys = (name, scope) => { const pre = dsKey(name, scope, ''); const out = []; if (LS) { for (let i = 0; i < LS.length; i++) { const k = LS.key(i); if (k && k.startsWith(pre)) out.push(k.slice(pre.length)); } } else for (const k of mem.keys()) if (k.startsWith(pre)) out.push(k.slice(pre.length)); return out; };
  const info = () => { const i = new Instance('DataStoreKeyInfo', rt); i.props.set('Version', String(Date.now())); i.props.set('CreatedTime', Date.now()); i.props.set('UpdatedTime', Date.now()); return i; };
  const store = (name, scope, ordered) => { const ds = new Instance(ordered ? 'OrderedDataStore' : 'DataStore', rt); ds.props.set('Name', String(name || 'DataStore')); ds.dsName = String(name || 'DataStore'); ds.dsScope = scope; return ds; };
  const DSM = {
    GetAsync: fn((a) => [dsGet(a[0].dsName, a[0].dsScope, str(a[1])), info()]),
    SetAsync: fn((a) => { dsSet(a[0].dsName, a[0].dsScope, str(a[1]), a[2]); return [String(Date.now())]; }),
    UpdateAsync: fn((a) => { const k = str(a[1]); const v = call(a[2], [dsGet(a[0].dsName, a[0].dsScope, k), info()])[0]; if (v !== undefined) dsSet(a[0].dsName, a[0].dsScope, k, v); return [v, info()]; }),
    RemoveAsync: fn((a) => { const k = str(a[1]), v = dsGet(a[0].dsName, a[0].dsScope, k); dsSet(a[0].dsName, a[0].dsScope, k, undefined); return [v, info()]; }),
    IncrementAsync: fn((a) => { const k = str(a[1]), v = (Number(dsGet(a[0].dsName, a[0].dsScope, k)) || 0) + (a[2] ?? 1); dsSet(a[0].dsName, a[0].dsScope, k, v); return [v]; }),
    ListKeysAsync: fn((a) => { const pg = new Instance('DataStoreKeyPages', rt); pg.items = dsKeys(a[0].dsName, a[0].dsScope).map((k) => { const o = new Instance('DataStoreKey', rt); o.props.set('KeyName', k); return o; }); pg.props.set('IsFinished', true); return [pg]; }),
    GetSortedAsync: fn((a) => { const asc = !!a[1], size = Math.max(1, Math.min(100, a[2] || 50)), lo = a[3], hi = a[4];
      let items = dsKeys(a[0].dsName, a[0].dsScope).map((k) => ({ key: k, value: Number(dsGet(a[0].dsName, a[0].dsScope, k)) || 0 })).filter((e) => (lo == null || e.value >= lo) && (hi == null || e.value <= hi)).sort((x, y) => (asc ? x.value - y.value : y.value - x.value));
      const pg = new Instance('DataStorePages', rt); pg.all = items; pg.size = size; pg.at = 0; pg.props.set('IsFinished', items.length <= size); return [pg]; }),
    GetVersionAsync: fn((a) => [dsGet(a[0].dsName, a[0].dsScope, str(a[1])), info()]), ListVersionsAsync: fn(() => [new Instance('DataStoreVersionPages', rt)]), RemoveVersionAsync: fn(() => []),
  };
  CM.DataStore = DSM; CM.OrderedDataStore = DSM; CM.GlobalDataStore = DSM;
  CM.DataStoreService = { GetDataStore: fn((a) => [store(a[1], a[2])]), GetOrderedDataStore: fn((a) => [store(a[1], a[2], true)]), GetGlobalDataStore: fn(() => [store('global')]), GetRequestBudgetForRequestType: fn(() => [100]), ListDataStoresAsync: fn(() => [new Instance('DataStoreListingPages', rt)]) };
  CM.DataStorePages = { GetCurrentPage: fn((a) => { const p = a[0], page = (p.all || []).slice(p.at || 0, (p.at || 0) + (p.size || 50)); return [LuaTable.from(page.map((e) => LuaTable.from({ key: e.key, value: e.value })))]; }),
    AdvanceToNextPageAsync: fn((a) => { const p = a[0]; p.at = (p.at || 0) + (p.size || 50); p.props.set('IsFinished', p.at + (p.size || 50) >= (p.all || []).length); return []; }) };
  CM.DataStoreKeyPages = { GetCurrentPage: fn((a) => [LuaTable.from(a[0].items || [])]), AdvanceToNextPageAsync: fn(() => []) };
  svc('DataStoreService');
  /* Teams */
  CM.Teams = { GetTeams: fn(() => [LuaTable.from(svc('Teams').kids.filter((k) => k.cls === 'Team'))]) };
  CM.Team = { GetPlayers: fn((a) => [LuaTable.from(svc('Players').kids.filter((p) => p.cls === 'Player' && p.props.get('Team') === a[0]))]) };
  CM.MarketplaceService = { UserOwnsGamePassAsync: fn(() => [false]), PlayerOwnsAsset: fn(() => [false]), PromptGamePassPurchase: fn(() => []), PromptProductPurchase: fn(() => []), PromptPurchase: fn(() => []), GetProductInfo: fn(() => [LuaTable.from({ Name: 'Produit', PriceInRobux: 0 })]) };
  CM.PhysicsService = { RegisterCollisionGroup: fn(() => []), CreateCollisionGroup: fn(() => [0]), CollisionGroupSetCollidable: fn(() => []), SetPartCollisionGroup: fn(() => []), IsCollisionGroupRegistered: fn(() => [true]), GetRegisteredCollisionGroups: fn(() => [new LuaTable()]), CollisionGroupsAreCollidable: fn(() => [true]) };
  CM.TextService = { GetTextSize: fn((a) => [new Vector2(str(a[1]).length * (a[2] || 14) * 0.55, a[2] || 14)]), FilterStringAsync: fn((a) => { const r = new Instance('TextFilterResult', rt); rt.classMethods.TextFilterResult = { GetNonChatStringForBroadcastAsync: fn(() => [a[1]]), GetChatForUserAsync: fn(() => [a[1]]), GetNonChatStringForUserAsync: fn(() => [a[1]]) }; return [r]; }) };
  CM.ContentProvider = { PreloadAsync: fn(() => []) }; CM.SoundService = { PlayLocalSound: fn(() => []), SetListener: fn(() => []) };
  CM.Workspace = { Raycast: fn((a) => [rt.raycast ? rt.raycast(a[1], a[2], a[3]) : undefined]), GetPartBoundsInBox: fn(() => [new LuaTable()]), GetPartBoundsInRadius: fn(() => [new LuaTable()]), GetPartsInPart: fn(() => [new LuaTable()]),
    FindPartOnRay: fn(() => [undefined]), FindPartOnRayWithIgnoreList: fn(() => [undefined]), FindPartsInRegion3: fn(() => [new LuaTable()]), GetServerTimeNow: fn(() => [Date.now() / 1000]), BulkMoveTo: fn((a) => { const ps = a[1].arr, cfs = a[2].arr; ps.forEach((p, i) => p.$newindex('CFrame', cfs[i])); return []; }), Blockcast: fn(() => [undefined]), Spherecast: fn(() => [undefined]), Shapecast: fn(() => [undefined]) };
  CM.WorldRoot = CM.Workspace; CM.Model = { }; CM.Humanoid = { MoveTo: fn(() => []), TakeDamage: fn((a) => { const h = a[0]; h.$newindex('Health', Math.max(0, (h.props.get('Health') || 0) - a[1])); return []; }), LoadAnimation: fn(() => [animTrack(rt)]), ChangeState: fn(() => []), GetState: fn(() => [enumItem('HumanoidStateType', 'Running')]), SetStateEnabled: fn(() => []), EquipTool: fn(() => []), UnequipTools: fn(() => []), ApplyDescription: fn(() => []), GetAppliedDescription: fn(() => [new Instance('HumanoidDescription', rt)]), Move: fn(() => []), GetPlayingAnimationTracks: fn(() => [new LuaTable()]) };
  CM.Animator = { LoadAnimation: fn(() => [animTrack(rt)]), GetPlayingAnimationTracks: fn(() => [new LuaTable()]) }; CM.AnimationController = CM.Animator;
  CM.Sound = { Play: fn((a) => { a[0].props.set('IsPlaying', true); return []; }), Stop: fn((a) => { a[0].props.set('IsPlaying', false); return []; }), Pause: fn(() => []), Resume: fn(() => []) };
  CM.RemoteEvent = { FireServer: fn((a) => { rt.remote?.(a[0], 'server', a.slice(1)); return []; }), FireClient: fn((a) => { rt.remote?.(a[0], 'client', a.slice(2), a[1]); return []; }), FireAllClients: fn((a) => { rt.remote?.(a[0], 'client', a.slice(1)); return []; }) };
  CM.UnreliableRemoteEvent = CM.RemoteEvent;
  CM.RemoteFunction = { InvokeServer: fn((a) => { const h = a[0].props.get('OnServerInvoke'); return h ? call(h, [rt.localPlayer, ...a.slice(1)]) : []; }), InvokeClient: fn((a) => { const h = a[0].props.get('OnClientInvoke'); return h ? call(h, a.slice(2)) : []; }) };
  CM.BindableEvent = { Fire: fn((a) => { a[0].sig('Event').fire(a.slice(1)); return []; }) };
  CM.BindableFunction = { Invoke: fn((a) => { const h = a[0].props.get('OnInvoke'); return h ? call(h, a.slice(1)) : []; }) };
  CM.Player = { Kick: fn(() => []), LoadCharacter: fn((a) => { rt.loadCharacter?.(a[0]); return []; }), GetMouse: fn(() => [new Instance('Mouse', rt)]), IsInGroup: fn(() => [false]), GetRankInGroup: fn(() => [0]), GetRoleInGroup: fn(() => ['Guest']), IsFriendsWith: fn(() => [false]), HasAppearanceLoaded: fn(() => [true]), GetJoinData: fn(() => [new LuaTable()]), DistanceFromCharacter: fn(() => [0]), RequestStreamAroundAsync: fn(() => []), SetAttribute: Instance.methods.SetAttribute };
  CM.UserInputService = { IsKeyDown: fn(() => [false]), IsMouseButtonPressed: fn(() => [false]), GetMouseLocation: fn(() => [new Vector2()]), GetMouseDelta: fn(() => [new Vector2()]), GetLastInputType: fn(() => [enumItem('UserInputType', 'Touch')]), GetConnectedGamepads: fn(() => [new LuaTable()]), GetFocusedTextBox: fn(() => [undefined]), GetKeysPressed: fn(() => [new LuaTable()]), GetGamepadConnected: fn(() => [false]) };
  svc('UserInputService').props.set('TouchEnabled', true); svc('UserInputService').props.set('KeyboardEnabled', false); svc('UserInputService').props.set('MouseEnabled', false); svc('UserInputService').props.set('GamepadEnabled', false);
  CM.StarterGui = { SetCoreGuiEnabled: fn(() => []), SetCore: fn(() => []), GetCore: fn(() => [undefined]), GetCoreGuiEnabled: fn(() => [true]) };
  CM.ContextActionService = { BindAction: fn(() => []), UnbindAction: fn(() => []), BindActionAtPriority: fn(() => []), SetTitle: fn(() => []), SetImage: fn(() => []), SetPosition: fn(() => []), GetButton: fn(() => [undefined]) };
  CM.ProximityPromptService = {}; CM.LocalizationService = { GetTranslatorForPlayerAsync: fn(() => [undefined]) }; CM.SocialService = { CanSendGameInviteAsync: fn(() => [false]) }; CM.GuiService = { GetGuiInset: fn(() => [new Vector2(0, 58), new Vector2()]) };
  CM.AnalyticsService = new Proxy({}, { get: () => fn(() => []) }); CM.BadgeService = { AwardBadge: fn(() => [false]), UserHasBadgeAsync: fn(() => [false]), GetBadgeInfoAsync: fn(() => [new LuaTable()]) };
  CM.MessagingService = { PublishAsync: fn(() => []), SubscribeAsync: fn(() => [new Instance('Connection', rt)]) }; CM.MemoryStoreService = new Proxy({}, { get: () => fn(() => [new Instance('MemoryStore', rt)]) }); CM.TeleportService = new Proxy({}, { get: () => fn(() => []) });
  CM.Chat = { Chat: fn(() => []), FilterStringForBroadcast: fn((a) => [a[1]]) }; CM.TextChatService = { DisplayBubble: fn(() => []) };
  CM.Camera = { WorldToViewportPoint: fn((a) => [new Vector3(0, 0, 1), true]), WorldToScreenPoint: fn(() => [new Vector3(0, 0, 1), true]), ScreenPointToRay: fn(() => [new Simple('Ray', { Origin: new Vector3(), Direction: new Vector3(0, 0, -1) })]), ViewportPointToRay: fn(() => [new Simple('Ray', { Origin: new Vector3(), Direction: new Vector3(0, 0, -1) })]), GetPartsObscuringTarget: fn(() => [new LuaTable()]) };
  CM.ProximityPrompt = { InputHoldBegin: fn(() => []), InputHoldEnd: fn(() => []) };
  CM.ParticleEmitter = { Emit: fn(() => []), Clear: fn(() => []) };
  CM.Tool = { Activate: fn(() => []), Deactivate: fn(() => []) };
  CM.Mouse = {};
  const Lighting = svc('Lighting'); CM.Lighting = { GetMinutesAfterMidnight: fn(() => [(Lighting.props.get('ClockTime') || 14) * 60]), SetMinutesAfterMidnight: fn((a) => { Lighting.props.set('ClockTime', a[1] / 60); return []; }), GetSunDirection: fn(() => [new Vector3(0.3, 0.8, -0.5)]), GetMoonDirection: fn(() => [new Vector3(-0.3, 0.8, 0.5)]) };
  void G; void sig;
}
export function animTrack(rt) { const t = new Instance('AnimationTrack', rt); t.props.set('IsPlaying', false); t.props.set('Length', 1); t.props.set('Speed', 1); t.props.set('TimePosition', 0); t.props.set('WeightCurrent', 1);
  rt.classMethods.AnimationTrack = { Play: fn((a) => { a[0].props.set('IsPlaying', true); return []; }), Stop: fn((a) => { a[0].props.set('IsPlaying', false); return []; }), AdjustSpeed: fn(() => []), AdjustWeight: fn(() => []), GetMarkerReachedSignal: fn((a) => [a[0].sig('Marker')]), GetTimeOfKeyframe: fn(() => [0]) }; return t; }
const toJS = (v) => { if (v instanceof LuaTable) { if (v.hash.size === 0) return v.arr.map(toJS); const o = {}; v.arr.forEach((x, i) => (o[i + 1] = toJS(x))); for (const [k, x] of v.hash) o[k] = toJS(x); return o; } return v; };
const fromJS = (v) => (Array.isArray(v) ? LuaTable.from(v.map(fromJS)) : v && typeof v === 'object' ? LuaTable.from(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fromJS(x)]))) : v === null ? undefined : v);

/* ---------------------------------------------------------------- place → runtime */
const BYTES = new Set(['ChildData', 'ChildData2', 'MeshData', 'MeshData2', 'PhysicalConfigData', 'PhysicsData', 'SmoothGrid', 'PhysicsGrid', 'MaterialColors', 'ValuesAndTimes']); // binary payloads kept as bytes
/* saved enum properties hold a number: which enum each property uses */
const PROP_ENUM = { TextXAlignment: 'TextXAlignment', TextYAlignment: 'TextYAlignment', ScaleType: 'ScaleType', SizeConstraint: 'SizeConstraint', AutomaticSize: 'AutomaticSize', FillDirection: 'FillDirection', HorizontalAlignment: 'HorizontalAlignment',
  VerticalAlignment: 'VerticalAlignment', SortOrder: 'SortOrder', AspectType: 'AspectType', DominantAxis: 'DominantAxis', ZIndexBehavior: 'ZIndexBehavior', ApplyStrokeMode: 'ApplyStrokeMode', LineJoinMode: 'LineJoinMode', ScreenInsets: 'ScreenInsets',
  TextTruncate: 'TextTruncate', Font: 'Font', MeshType: 'MeshType', Face: 'NormalId', RigType: 'HumanoidRigType', CameraType: 'CameraType', ScrollingDirection: 'ScrollingDirection', VerticalScrollBarInset: 'ScrollBarInset', HorizontalScrollBarInset: 'ScrollBarInset',
  VerticalScrollBarPosition: 'VerticalScrollBarPosition', BorderMode: 'BorderMode', RollOffMode: 'RollOffMode', DisplayDistanceType: 'HumanoidDisplayDistanceType', SizingMode: 'SurfaceGuiSizingMode', Style: 'ProximityPromptStyle', Exclusivity: 'ProximityPromptExclusivity',
  KeyboardKeyCode: 'KeyCode', GamepadKeyCode: 'KeyCode', ResampleMode: 'ResamplerMode', ElasticBehavior: 'ElasticBehavior', SelectionBehaviorUp: 'SelectionBehavior', Orientation: null };
const ENUM_BY_VALUE = new Map(); const enumByValue = (t, v) => { if (!ENUM_BY_VALUE.has(t)) ENUM_BY_VALUE.set(t, new Map(Object.entries(KNOWN_VALUES[t] || {}).map(([n, x]) => [x, n]))); const n = ENUM_BY_VALUE.get(t).get(v); return n === undefined ? undefined : enumItem(t, n); };
const FONT_WEIGHT = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Heavy' };
function convProp(cls, k, v) {
  if (v instanceof Uint8Array) return k === 'Source' || k === 'AttributesSerialize' || k === 'Tags' || BYTES.has(k) ? v : str(v);
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if (v.udim2) return UDim2(...v.udim2);
    if (v.udim) return UDim(...v.udim);
    if (v.v2) return new Vector2(v.v2[0], v.v2[1]);
    if (v.nrange) return NumberRange(v.nrange[0], v.nrange[1]);
    if (v.rect) return new Simple('Rect', { Min: new Vector2(v.rect[0], v.rect[1]), Max: new Vector2(v.rect[2], v.rect[3]), Width: v.rect[2] - v.rect[0], Height: v.rect[3] - v.rect[1] });
    if (v.nseq) return new Simple('NumberSequence', { Keypoints: LuaTable.from(v.nseq.map((x) => Keypoint(x[0], x[1], x[2]))) });
    if (v.cseq) return new Simple('ColorSequence', { Keypoints: LuaTable.from(v.cseq.map((x) => Keypoint(x[0], new Color3(x[1], x[2], x[3])))) });
    if (v.font) return new Simple('Font', { Family: v.font.family, Weight: enumItem('FontWeight', FONT_WEIGHT[v.font.weight] || 'Regular'), Style: enumItem('FontStyle', v.font.style ? 'Italic' : 'Normal'), Bold: v.font.weight >= 600 });
    if (v.ray) return new Simple('Ray', { Origin: new Vector3(v.ray[0], v.ray[1], v.ray[2]), Direction: new Vector3(v.ray[3], v.ray[4], v.ray[5]) });
    if (v.faces !== undefined) return k === 'Axes' || cls === 'ArcHandles' ? new Simple('Axes', { X: !!(v.faces & 1), Y: !!(v.faces & 2), Z: !!(v.faces & 4) }) : new Simple('Faces', { Front: !!(v.faces & 1), Bottom: !!(v.faces & 2), Left: !!(v.faces & 4), Back: !!(v.faces & 8), Top: !!(v.faces & 16), Right: !!(v.faces & 32) });
  }
  if (typeof v === 'number' && PROP_ENUM[k]) { const e = enumByValue(PROP_ENUM[k], v); if (e) return e; }
  if (Array.isArray(v) && v.length === 3) return new Vector3(...v);
  if (v && v.pos && v.rot) return new CFrame(v.pos.slice(), v.rot.slice());
  if (v && v.rgb8) return new Color3(v.rgb8[0] / 255, v.rgb8[1] / 255, v.rgb8[2] / 255);
  if (v && v.rgb) return new Color3(...v.rgb);
  if (typeof v === 'number' && (k === 'Material' || k === 'MaterialVariant')) return enumItem('Material', MATERIAL_NAME[v] || 'Plastic');
  if (typeof v === 'number' && (k === 'shape' || k === 'Shape')) return enumItem('PartType', SHAPES[v] || 'Block');
  if (typeof v === 'number' && /Surface$/.test(k)) return enumItem('SurfaceType', SURFACES[v] || 'Smooth');
  return v;
}
const RENAME = { size: 'Size', Color3uint8: 'Color', shape: 'Shape', formFactorRaw: null, Tags: null };
export function loadPlace(rt, roots, readAttributes) {
  const byRef = new Map(), pending = [];
  const make = (o, parent) => {
    let inst;
    if (!parent && (o.cls === 'Workspace' || rt.serviceNames.has(o.cls))) inst = rt.service(o.cls);
    else { inst = new Instance(o.cls, rt); }
    if (o.ref !== undefined && o.ref !== null) byRef.set(o.ref, inst);
    for (const [k0, v] of Object.entries(o.props)) {
      const k = k0 in RENAME ? RENAME[k0] : k0; if (k === null) continue;
      if (v && typeof v === 'object' && 'ref' in v && Object.keys(v).length === 1) { pending.push([inst, k, v.ref]); continue; }
      if (k === 'AttributesSerialize') { for (const [ak, av] of Object.entries(readAttributes(v))) if (av !== null && av !== undefined) inst.attrs.set(ak, typeof av === 'string' && /^#[0-9a-f]{6}$/i.test(av) ? hexColor(av) : Array.isArray(av) && av.length === 3 ? new Vector3(...av) : av); continue; }
      if (k === 'Source') { inst.source = str(v); continue; }
      if (k0 === 'Tags' && v instanceof Uint8Array) { str(v).split('\0').filter(Boolean).forEach((t) => inst.tags.add(t)); continue; }
      const cv = convProp(o.cls, k, v); if (k === 'Name') inst.props.set('Name', str(v)); else if (cv !== undefined) inst.props.set(k, cv);
    }
    if (o.props.Disabled === true || o.props.Enabled === false) inst.disabled = true;
    if (o.props.RunContext !== undefined) inst.runContext = o.props.RunContext;
    if (!inst.isService && parent) { inst.parent = parent; parent.kids.push(inst); }
    o.children.forEach((c) => make(c, inst)); return inst;
  };
  for (const r of roots) make(r, null);
  // object references (Part0 / Part1, PrimaryPart, ObjectValue.Value, Adornee, SoundGroup…) point at the loaded Instances
  for (const [inst, k, ref] of pending) { const target = byRef.get(ref); if (target) inst.props.set(k, target); }
}
const hexColor = (h) => { const n = parseInt(h.slice(1), 16); return new Color3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };

/* ---------------------------------------------------------------- runtime → Forge map */
const MAT_OK = new Set(['Plastic', 'SmoothPlastic', 'Neon', 'Wood', 'WoodPlanks', 'Brick', 'Cobblestone', 'Concrete', 'Slate', 'Granite', 'Marble', 'Basalt', 'Rock', 'Pebble', 'Grass', 'LeafyGrass', 'Sand', 'Snow', 'Ice', 'Glacier', 'Glass', 'ForceField', 'Metal', 'DiamondPlate', 'CorrodedMetal', 'Foil', 'Fabric', 'Asphalt', 'Pavement', 'CrackedLava', 'Sandstone']);
const MAT_ALIAS = { Limestone: 'Sandstone', Mud: 'Grass', Ground: 'Grass', Salt: 'Sand', Cardboard: 'WoodPlanks', Carpet: 'Fabric', Leather: 'Fabric', Plaster: 'Concrete', Rubber: 'SmoothPlastic', Water: 'Glass' };
let nid = 0; const id = () => 'lx' + (nid++).toString(36);
function euler(m) { const y = Math.asin(Math.max(-1, Math.min(1, m[2]))); let x, z; if (Math.abs(m[2]) < 0.9999999) { x = Math.atan2(-m[5], m[8]); z = Math.atan2(-m[1], m[0]); } else { x = Math.atan2(m[7], m[4]); z = 0; } return [x, y, z].map((v) => +(v * 180 / Math.PI).toFixed(3)); }
export function worldToMap(rt, title) {
  const stats = { parts: 0, meshes: 0 }, LIMIT = 120000;
  const node = (o) => {
    if (o.cls === 'Camera' || o.cls === 'Terrain') return null;
    if (isA(o.cls, 'BasePart')) {
      if (stats.parts >= LIMIT) return null;
      const P = o.props, s = P.get('Size'), cf = P.get('CFrame'); if (!s || !cf) return null;
      let mat = P.get('Material'); mat = mat instanceof EnumItem ? mat.name : 'Plastic'; mat = MAT_ALIAS[mat] || mat; if (!MAT_OK.has(mat)) mat = 'Plastic';
      const shape = P.get('Shape') instanceof EnumItem ? P.get('Shape').name : 'Block', col = P.get('Color');
      const cls = o.cls === 'WedgePart' || shape === 'Wedge' ? 'WedgePart' : o.cls === 'CornerWedgePart' || shape === 'CornerWedge' ? 'CornerWedgePart' : o.cls === 'TrussPart' ? 'TrussPart' : o.cls === 'SpawnLocation' ? 'SpawnLocation' : 'Part';
      if (o.cls === 'MeshPart' || /Operation$/.test(o.cls)) stats.meshes++;
      const mesh = o.kids.find((k) => k.cls === 'SpecialMesh'), meshType = mesh && mesh.props.get('MeshType') instanceof EnumItem ? mesh.props.get('MeshType').name : null;
      const p = { id: id(), cls, name: P.get('Name'), size: [s.x, s.y, s.z].map((v) => +v.toFixed(3)), pos: cf.p.map((v) => +v.toFixed(3)), rot: euler(cf.r), color: col instanceof Color3 ? col.hex() : '#a3a2a5', material: mat,
        transparency: +(P.get('Transparency') || 0), anchored: P.get('Anchored') !== false, canCollide: P.get('CanCollide') !== false, shape: meshType === 'Sphere' ? 'Ball' : meshType === 'Cylinder' ? 'Cylinder' : shape === 'Ball' || shape === 'Cylinder' ? shape : 'Block' };
      if (P.get('Reflectance')) p.reflectance = P.get('Reflectance');
      const top = P.get('TopSurface'); if (top instanceof EnumItem && top.name === 'Studs' && mat === 'Plastic') p.studs = true;
      if (o.attrs.size) { const at = {}; for (const [k, v] of o.attrs) if (typeof v !== 'object') at[k] = v; if (Object.keys(at).length) p.attrs = at; }
      if (o.attrs.get('ForgeRole')) { p.role = { type: o.attrs.get('ForgeRole') }; for (const [k, v] of o.attrs) if (/^Forge/.test(k) && !['ForgeRole', 'ForgeLabel', 'ForgeVox', 'ForgeFollow'].includes(k) && !/^ForgeGame/.test(k)) p.role[k.charAt(5).toLowerCase() + k.slice(6)] = v; }
      const light = o.kids.find((k) => isA(k.cls, 'Light') && k.props.get('Enabled') !== false); if (light) p.light = { range: +(light.props.get('Range') || 16), brightness: +(light.props.get('Brightness') || 1) };
      const gui = o.kids.find((k) => (k.cls === 'SurfaceGui' || k.cls === 'BillboardGui') && k.props.get('Enabled') !== false); if (gui) { const tl = gui.descendants().find((d) => /^Text(Label|Button)$/.test(d.cls) && d.props.get('Text')); if (tl) p.label = String(tl.props.get('Text')).replace(/<[^>]+>/g, '').slice(0, 48); }
      if (p.transparency >= 1 && !p.canCollide && cls !== 'SpawnLocation') return null;
      stats.parts++; const kids = o.kids.map(node).filter(Boolean); return kids.length ? { id: id(), cls: 'Model', name: p.name, children: [p, ...kids] } : p;
    }
    const kids = o.kids.map(node).filter(Boolean); if (!kids.length) return null; return { id: id(), cls: 'Model', name: o.props.get('Name'), children: kids };
  };
  const children = rt.workspace.kids.map(node).filter(Boolean);
  const L = rt.service('Lighting'), over = {}, ct = L.props.get('ClockTime'); let preset = 'jour';
  if (typeof ct === 'number') { over.ClockTime = ct; preset = ct >= 5.5 && ct <= 18.5 ? (ct > 16.5 ? 'coucher' : ct < 8 ? 'aube' : 'jour') : 'nuit'; }
  const hx = (c) => (c instanceof Color3 ? c.hex() : undefined); if (typeof L.props.get('Brightness') === 'number') over.Brightness = Math.max(0.6, L.props.get('Brightness'));
  if (hx(L.props.get('Ambient'))) over.Ambient = hx(L.props.get('Ambient')); if (hx(L.props.get('OutdoorAmbient'))) over.OutdoorAmbient = hx(L.props.get('OutdoorAmbient'));
  const atm = L.kids.find((k) => k.cls === 'Atmosphere'); over.atmo = atm ? { Density: +(atm.props.get('Density') ?? 0.3), Haze: +(atm.props.get('Haze') ?? 0), Glare: +(atm.props.get('Glare') ?? 0), Color: hx(atm.props.get('Color')) || '#c7d7ec', Decay: hx(atm.props.get('Decay')) || '#5c6e87' } : { Density: 0.05, Haze: 0 };
  const bl = L.kids.find((k) => k.cls === 'BloomEffect'); if (bl) over.bloom = { Intensity: +(bl.props.get('Intensity') ?? 1), Size: +(bl.props.get('Size') ?? 24), Threshold: +(bl.props.get('Threshold') ?? 2) };
  const sky = L.kids.find((k) => k.cls === 'Sky'); void sky;
  return { map: { v: 1, name: title, theme: null, lighting: { preset, over }, gen: { id: 'import' }, root: { id: id(), cls: 'Folder', name: title, children } }, stats };
}

/* ---------------------------------------------------------------- run */
const SERVICES = ['Workspace', 'Lighting', 'ReplicatedStorage', 'ReplicatedFirst', 'ServerScriptService', 'ServerStorage', 'StarterGui', 'StarterPack', 'StarterPlayer', 'SoundService', 'Teams', 'Chat', 'TextChatService', 'Players', 'MaterialService', 'TestService', 'LocalizationService', 'HttpService', 'CollectionService', 'TweenService', 'RunService', 'ProximityPromptService', 'VoiceChatService'];
export function runPlace(roots, readAttributes, { title = 'Jeu', seconds = 3, log = () => {} } = {}) {
  const logs = [], G = createGlobals({ print: (s) => logs.push(s), warn: (s) => logs.push('⚠️ ' + s) }); const I = new Interpreter(G); I.maxSteps = 6e7;
  const rt = new Runtime(I, G, { parse: (src, name) => parse(src, name), warn: (s) => logs.push('❌ ' + s) }); rt.side = 'server'; rt.serviceNames = new Set(SERVICES);
  installServices(rt); loadPlace(rt, roots, readAttributes);
  const scripts = rt.game.descendants().filter((d) => d.cls === 'Script' && !d.disabled && d.source && (isUnder(d, 'ServerScriptService') || isUnder(d, 'Workspace')) && d.runContext !== 2);
  const t0 = performance.now();
  for (const s of scripts) { log('Script ' + Instance.methods.GetFullName([s])[0]); rt.start(rt.I.load(rt.parseScript(s), Instance.methods.GetFullName([s])[0], { script: s }), [], 0); }
  rt.step(0);
  for (let t = 0; t < seconds; t += 1 / 30) { rt.step(1 / 30); for (const d of [rt.service('RunService')]) { d.sigs.get('Heartbeat')?.fire([1 / 30]); d.sigs.get('Stepped')?.fire([rt.now, 1 / 30]); } if (performance.now() - t0 > 20000) break; }
  const out = worldToMap(rt, title); out.logs = logs; out.errors = rt.errors; out.scripts = scripts.length; out.ms = Math.round(performance.now() - t0); return out;
}
const isUnder = (o, svcName) => { let p = o.parent; while (p) { if (p.cls === svcName) return true; p = p.parent; } return false; };
export { tostr, bounds, Vector2 };
