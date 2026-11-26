/* =====================================================================
   Roblox Forge · Jouer — every Humanoid, not only the player's.
   - NPCs walk: Humanoid:MoveTo / Humanoid:Move with WalkSpeed, turn to face
     where they go (AutoRotate), fall with gravity, stand on the ground,
     jump (Jump = true), MoveToFinished(reached) after arriving or 8 s;
     Running / StateChanged fire; NPCs without their own Animate script play
     Roblox's default animations (R15 or R6 clips by rig);
   - death for any Humanoid: Health 0 → Died once, joints break
     (BreakJointsOnDeath) and the parts fall;
   - Seats and VehicleSeats: a character touching one sits (SeatWeld, Sit,
     SeatPart, Occupant), jumping gets up; a VehicleSeat gets Throttle /
     Steer from the player's controls;
   - PathfindingService: a real path (A* over a ground grid that respects
     walls, steps and gaps) with Walk / Jump waypoints, NoPath when blocked.
   ===================================================================== */
import { Instance, Vector3, CFrame, enumItem, isA } from './roblox.js?v=12';
import { LuaTable } from './luau.js?v=12';
import { preloadClip } from './anim.js?v=12';

const fn = (f) => f;
const R15_ANIMS = { idle: 507766388, walk: 507777826, run: 507767714, jump: 507765000, fall: 507767968, sit: 2506281703 };
const R6_ANIMS = { idle: 180435571, walk: 180426354, run: 180426354, jump: 125750702, fall: 180436148, sit: 178130996 };
export class Humanoids {
  constructor(engine) { this.E = engine; this.rt = engine.rt; this.list = new Set(); this.install(); }
  hums() { // every Humanoid in the world (refreshed twice a second)
    if (!this.cache || this.E.frameN % 30 === 0) this.cache = this.rt.workspace.descendants().filter((d) => d.cls === 'Humanoid' && d.parent && d.parent.cls === 'Model');
    return this.cache;
  }
  rootOf(h) { const m = h.parent; return h.props.get('RootPart') || m.kids.find((k) => k.props.get('Name') === 'HumanoidRootPart') || (m.props.get('PrimaryPart')) || m.kids.find((k) => isA(k.cls, 'BasePart') && /Torso/.test(String(k.props.get('Name')))); }
  /* the highest solid surface under (x, y, z), or null */
  ground(x, y, z, model) {
    if (this.E.groundAt) { const g = this.E.groundAt(x, y, z); if (g !== null && g !== undefined) return g; }
    const parts = this.E.contacts.inBox(new CFrame([x, y - 50, z]), new Vector3(1.6, 100, 1.6), null); let best = null;
    for (const p of parts) { if (p.props.get('CanCollide') === false || (model && p.parent === model) || (model && model.descendants().includes(p))) continue; const cf = p.props.get('CFrame'), s = p.props.get('Size'); const top = cf.p[1] + Math.abs(cf.r[4]) * s.y / 2 + Math.abs(cf.r[3]) * s.x / 2 + Math.abs(cf.r[5]) * s.z / 2; if (top <= y + 0.5 && (best === null || top > best)) best = top; }
    return best;
  }
  step(dt) {
    const E = this.E, me = E.char && E.char.humanoid;
    for (const h of this.hums()) {
      this.health(h);
      if (h === me || h.dead) continue; const root = this.rootOf(h); if (!root || root.props.get('Anchored')) continue;
      const st = (h.npc ||= { vy: 0, t: 0, grounded: true });
      // where to go: MoveTo target, or Humanoid:Move direction
      let dir = null, ws = h.props.get('WalkSpeed') ?? 16; const cf = root.props.get('CFrame'); const p = cf.p;
      if (h.moveTo) { const t = h.moveTo, dx = t.x - p[0], dz = t.z - p[2], d = Math.hypot(dx, dz); st.t += dt;
        if (d < 1.2 || st.t > 8) { const ok = d < 1.2; h.moveTo = null; st.t = 0; this.fire(h, 'MoveToFinished', [ok]); } else dir = [dx / d, dz / d]; }
      else { st.t = 0; const md = h.moveDir; if (md && Math.hypot(md.x, md.z) > 0.01) { const l = Math.hypot(md.x, md.z); dir = [md.x / l, md.z / l]; } }
      const speed = dir ? ws : 0; h.props.set('MoveDirection', dir ? new Vector3(dir[0], 0, dir[1]) : new Vector3());
      if (Math.abs(speed - (st.speed || 0)) > 0.5) { st.speed = speed; this.fire(h, 'Running', [speed]); }
      // vertical: gravity, ground, jump
      const hip = (h.props.get('HipHeight') ?? 2) + ((root.props.get('Size') || { y: 2 }).y / 2); const g = this.ground(p[0], p[1], p[2], h.parent);
      if (h.props.get('Jump') && st.grounded) { st.vy = h.props.get('UseJumpPower') === false ? Math.sqrt(2 * 196.2 * (h.props.get('JumpHeight') || 7.2)) : (h.props.get('JumpPower') ?? 50); st.grounded = false; h.props.set('Jump', false); this.state(h, 'Jumping'); }
      let ny = p[1]; if (!st.grounded || g === null || p[1] - hip > g + 0.1) { st.vy -= (E.workspace.props.get('Gravity') || 196.2) * dt; ny = p[1] + st.vy * dt; st.grounded = false; }
      if (g !== null && ny - hip <= g + 0.05 && st.vy <= 0) { ny = g + hip; st.vy = 0; if (!st.grounded) { st.grounded = true; this.state(h, 'Landed'); } } else if (g === null && ny < (E.workspace.props.get('FallenPartsDestroyHeight') ?? -500)) { h.$newindex('Health', 0); continue; }
      let r = cf.r; if (dir && h.props.get('AutoRotate') !== false) { const yaw = Math.atan2(-dir[0], -dir[1]), c = Math.cos(yaw), s = Math.sin(yaw); r = [c, 0, s, 0, 1, 0, -s, 0, c]; }
      root.props.set('CFrame', new CFrame([p[0] + (dir ? dir[0] * speed * dt : 0), ny, p[2] + (dir ? dir[1] * speed * dt : 0)], r)); root.props.set('AssemblyLinearVelocity', new Vector3(dir ? dir[0] * speed : 0, st.vy, dir ? dir[1] * speed : 0));
      this.animate(h, st, speed);
    }
    this.seats();
  }
  /* death for every Humanoid */
  health(h) { if (h.dead || (h.props.get('Health') ?? 100) > 0) return; if (h === (this.E.char && this.E.char.humanoid)) return; // the player's own death is handled by the game
    h.dead = true; this.state(h, 'Dead'); this.fire(h, 'Died', []);
    if (h.props.get('BreakJointsOnDeath') !== false) { for (const d of h.parent.descendants()) if (d.cls === 'Motor6D' || d.cls === 'Weld' || d.cls === 'WeldConstraint') d.props.set('Enabled', false);
      for (const d of h.parent.descendants()) if (isA(d.cls, 'BasePart')) d.props.set('AssemblyLinearVelocity', new Vector3((Math.random() - 0.5) * 12, 8 + Math.random() * 10, (Math.random() - 0.5) * 12)); this.E.rebuildAssemblies(); }
  }
  state(h, s) { const old = h.state || 'Running'; if (old === s) return; h.state = s; this.fire(h, 'StateChanged', [enumItem('HumanoidStateType', old), enumItem('HumanoidStateType', s)]); }
  fire(o, ev, args) { const s = o.sigs.get(ev); if (!s || (!s.conns.length && !s.waiters?.length)) return; const I = this.E.I, prev = I.side; I.side = 'server'; try { s.fire(args); } finally { I.side = prev; } }
  /* NPCs without an Animate script play Roblox's default clips */
  animate(h, st, speed) {
    const m = h.parent; if (m.kids.some((k) => /Script$/.test(k.cls) && k.props.get('Name') === 'Animate' && k.source)) return;
    const r15 = !!m.kids.find((k) => k.props.get('Name') === 'UpperTorso'), ids = r15 ? R15_ANIMS : R6_ANIMS; if (!st.tracks) { st.tracks = {}; st.ready = false; Promise.all(Object.values(ids).map((id) => preloadClip(id))).then((r) => { st.ready = r.some(Boolean); }); }
    if (!st.ready) return; const A = this.E.anims;
    const want = h.props.get('Sit') ? 'sit' : !st.grounded ? (st.vy > 0 ? 'jump' : 'fall') : speed > 0.5 ? (speed > 12 && r15 ? 'run' : 'walk') : 'idle'; if (st.cur === want) return;
    const track = (k) => { if (!st.tracks[k]) { const a = new Instance('Animation', this.rt); a.props.set('AnimationId', 'rbxassetid://' + ids[k]); st.tracks[k] = A.load(h, a); } return st.tracks[k]; };
    if (st.cur) A.stop(track(st.cur), 0.2); A.play(track(want), 0.2, 1, want === 'walk' || want === 'run' ? Math.max(0.4, speed / 16) : 1); st.cur = want;
  }
  /* Seats: a character whose root touches a free seat sits on it */
  seats() {
    const E = this.E; for (const h of this.hums()) { if (h.dead) continue; const root = this.rootOf(h); if (!root) continue;
      const seat = h.props.get('SeatPart');
      if (seat) { const weld = seat.kids.find((k) => k.props.get('Name') === 'SeatWeld'); if (!weld || h.props.get('Jump') || !seat.parent || seat.props.get('Disabled')) { this.unsit(h, seat, weld); } continue; }
      if (h.sitCool && E.t < h.sitCool) continue; if (h.props.get('Sit') === false && h.state === 'Jumping') continue;
      const rs = (root.props.get('Size') || { y: 2 }).y, hh = h.props.get('HipHeight') ?? 2; const near = E.contacts.inBox(root.props.get('CFrame'), new Vector3(2.4, rs + hh * 2 + 1.5, 2.4), null); // down to just under the feet
      for (const s of near) if ((s.cls === 'Seat' || s.cls === 'VehicleSeat') && !s.props.get('Disabled') && !s.props.get('Occupant')) { this.sit(h, s, root); break; }
    }
    // VehicleSeat controls from the player
    const me = E.char && E.char.humanoid, vs = me && me.props.get('SeatPart'); if (vs && vs.cls === 'VehicleSeat') { const inp = E.input.move || { x: 0, z: 0 }; const th = Math.round(-inp.z), sr = Math.round(inp.x);
      if (vs.props.get('Throttle') !== th) vs.$newindex('Throttle', th); if (vs.props.get('Steer') !== sr) vs.$newindex('Steer', sr); vs.props.set('ThrottleFloat', -inp.z); vs.props.set('SteerFloat', inp.x); }
  }
  sit(h, s, root) {
    const w = new Instance('Weld', this.rt); w.props.set('Name', 'SeatWeld'); w.props.set('Part0', s); w.props.set('Part1', root); w.props.set('C0', new CFrame([0, ((s.props.get('Size') || { y: 1 }).y / 2) + 1.5, 0])); w.props.set('C1', new CFrame()); w.setParent(s);
    s.$newindex('Occupant', h); h.$newindex('SeatPart', s); h.$newindex('Sit', true); this.state(h, 'Seated'); this.fire(h, 'Seated', [true, s]); this.E.jointsDirty = true;
  }
  unsit(h, s, weld) { if (weld) Instance.methods.Destroy([weld]); if (s && s.props) s.$newindex('Occupant', undefined); h.$newindex('SeatPart', undefined); h.$newindex('Sit', false); h.sitCool = this.E.t + 1; this.state(h, 'Jumping'); this.fire(h, 'Seated', [false, s]); this.E.jointsDirty = true; }
  /* ---------------- PathfindingService ---------------- */
  path(from, to, opts) {
    const sp = Math.max(2, (opts && opts.WaypointSpacing) || 4), canJump = !(opts && opts.AgentCanJump === false), climb = canJump ? 7 : 1.6, h = (opts && opts.AgentHeight) || 5, rad = (opts && opts.AgentRadius) || 2;
    const minX = Math.min(from.x, to.x) - 60, minZ = Math.min(from.z, to.z) - 60, nx = Math.min(160, Math.ceil((Math.abs(to.x - from.x) + 120) / sp)), nz = Math.min(160, Math.ceil((Math.abs(to.z - from.z) + 120) / sp));
    const topY = Math.max(from.y, to.y) + 30; const cell = new Map();
    const info = (i, j) => { const k = i * 1000 + j; if (cell.has(k)) return cell.get(k); const x = minX + (i + 0.5) * sp, z = minZ + (j + 0.5) * sp; const g = this.ground(x, topY, z, null); let ok = g !== null;
      if (ok) { const block = this.E.contacts.inBox(new CFrame([x, g + 0.4 + h / 2, z]), new Vector3(rad * 1.6, h, rad * 1.6), null).some((p) => p.props.get('CanCollide') !== false && isA(p.cls, 'BasePart') && !p.parent?.kids.some((k) => k.cls === 'Humanoid')); ok = !block; }
      const v = { ok, y: g }; cell.set(k, v); return v; };
    const idx = (p) => [Math.max(0, Math.min(nx - 1, Math.floor((p.x - minX) / sp))), Math.max(0, Math.min(nz - 1, Math.floor((p.z - minZ) / sp)))];
    const [si, sj] = idx(from), [ti, tj] = idx(to); const key = (i, j) => i * 1000 + j; const open = [[si, sj]], g = new Map([[key(si, sj), 0]]), came = new Map(); const hfn = (i, j) => Math.hypot(i - ti, j - tj); let found = false, n = 0;
    while (open.length && n++ < 12000) { let bi = 0; for (let q = 1; q < open.length; q++) if (g.get(key(...open[q])) + hfn(...open[q]) < g.get(key(...open[bi])) + hfn(...open[bi])) bi = q; const [i, j] = open.splice(bi, 1)[0]; if (i === ti && j === tj) { found = true; break; }
      const here = info(i, j);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const c = info(a, b); if (!c.ok) continue; if (here.y !== null && c.y - here.y > climb) continue; if (di && dj && (!info(i + di, j).ok || !info(i, j + dj).ok)) continue;
        const ng = g.get(key(i, j)) + Math.hypot(di, dj); if (ng < (g.get(key(a, b)) ?? Infinity)) { g.set(key(a, b), ng); came.set(key(a, b), [i, j]); if (!open.some((o) => o[0] === a && o[1] === b)) open.push([a, b]); } } }
    if (!found) return null; const cells = []; let c = [ti, tj]; while (c) { cells.unshift(c); c = came.get(key(...c)); }
    const pts = cells.map(([i, j], q) => { const v = info(i, j); const prev = q ? info(...cells[q - 1]) : v; return { p: new Vector3(minX + (i + 0.5) * sp, (v.y ?? from.y) , minZ + (j + 0.5) * sp), jump: q > 0 && v.y - prev.y > 1.6 }; });
    pts[0].p = new Vector3(from.x, from.y, from.z); pts[pts.length - 1].p = new Vector3(to.x, to.y, to.z); return pts;
  }
  install() {
    const rt = this.rt, CM = rt.classMethods, self = this;
    CM.Humanoid = { ...(CM.Humanoid || {}), Move: fn((a) => { a[0].moveDir = a[1]; return []; }), MoveTo: fn((a) => { const h = a[0]; h.moveTo = a[1]; if (h.npc) h.npc.t = 0; return []; }),
      GetMoveVelocity: fn((a) => [a[0].props.get('MoveDirection') || new Vector3()]) };
    const mkWp = (w) => { const o = new Instance('PathWaypoint', rt); o.props.set('Position', w.p); o.props.set('Action', enumItem('PathWaypointAction', w.jump ? 'Jump' : 'Walk')); o.props.set('Label', ''); return o; };
    CM.PathfindingService = { CreatePath: fn((a) => { const p = new Instance('Path', rt); p.opts = a[1] instanceof LuaTable ? Object.fromEntries(a[1].hash) : {}; p.props.set('Status', enumItem('PathStatus', 'NoPath')); return [p]; }),
      FindPathAsync: fn((a) => { const p = new Instance('Path', rt); p.opts = {}; CM.Path.ComputeAsync([p, a[1], a[2]]); return [p]; }) };
    CM.Path = { ComputeAsync: fn((a) => { const p = a[0], pts = self.path(a[1], a[2], p.opts); p.wps = pts; p.props.set('Status', enumItem('PathStatus', pts ? 'Success' : 'NoPath')); return []; }),
      GetWaypoints: fn((a) => [LuaTable.from((a[0].wps || []).map(mkWp))]), CheckOcclusionAsync: fn(() => [-1]), Destroy: fn(() => []) };
  }
}
