/* =====================================================================
   Roblox Forge · Jouer — contacts and spatial queries.
   - a spatial hash of every part in Workspace (kept up to date when a part
     moves, grows, enters or leaves the world);
   - exact overlap of oriented boxes (separating axis test; balls and
     cylinders use their box) with a small contact margin, like Roblox's
     "touching" surfaces;
   - Touched / TouchEnded fire on both parts when a pair starts / stops
     touching, as Roblox does: at least one of them must be moving (not
     anchored, or moved by a script / joint), both need CanTouch;
     Humanoid.Touched fires for the character's limbs;
   - WorldRoot:GetPartBoundsInBox / GetPartBoundsInRadius / GetPartsInPart,
     BasePart:GetTouchingParts, with OverlapParams (filter list, Include /
     Exclude, MaxParts, RespectCanCollide);
   - WorldRoot:Blockcast / Spherecast / Shapecast (swept along the
     direction, first part hit returned as a RaycastResult).
   ===================================================================== */
import { Instance, Vector3, CFrame, isA } from './roblox.js?v=12';
import { LuaTable } from './luau.js?v=12';

const fn = (f) => f;
const CELL = 12;
const isPart = (o) => o && o.cls !== 'Terrain' && isA(o.cls, 'BasePart');
/* the oriented box of a part: centre, 3 axes, half sizes */
function obb(p, grow = 0) {
  const cf = p.props.get('CFrame'), s = p.props.get('Size'); if (!cf || !s) return null; const r = cf.r;
  let sx = s.x, sy = s.y, sz = s.z; const sh = p.props.get('Shape'); if (sh && sh.name === 'Ball') sx = sy = sz = s.x;
  return { c: cf.p, a: [[r[0], r[3], r[6]], [r[1], r[4], r[7]], [r[2], r[5], r[8]]], h: [sx / 2 + grow, sy / 2 + grow, sz / 2 + grow] };
}
function boxOf(cf, size, grow = 0) { const r = cf.r; return { c: cf.p, a: [[r[0], r[3], r[6]], [r[1], r[4], r[7]], [r[2], r[5], r[8]]], h: [size.x / 2 + grow, size.y / 2 + grow, size.z / 2 + grow] }; }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/* separating axis test between two oriented boxes */
export function obbOverlap(A, B) {
  const t = [B.c[0] - A.c[0], B.c[1] - A.c[1], B.c[2] - A.c[2]];
  const axes = [...A.a, ...B.a]; for (const u of A.a) for (const v of B.a) { const c = cross(u, v); if (dot(c, c) > 1e-8) axes.push(c); }
  for (const L of axes) { const ra = A.h[0] * Math.abs(dot(A.a[0], L)) + A.h[1] * Math.abs(dot(A.a[1], L)) + A.h[2] * Math.abs(dot(A.a[2], L)); const rb = B.h[0] * Math.abs(dot(B.a[0], L)) + B.h[1] * Math.abs(dot(B.a[1], L)) + B.h[2] * Math.abs(dot(B.a[2], L)); if (Math.abs(dot(t, L)) > ra + rb) return false; }
  return true;
}
function aabb(B) { const e = [0, 1, 2].map((k) => B.h[0] * Math.abs(B.a[0][k]) + B.h[1] * Math.abs(B.a[1][k]) + B.h[2] * Math.abs(B.a[2][k])); return [B.c[0] - e[0], B.c[1] - e[1], B.c[2] - e[2], B.c[0] + e[0], B.c[1] + e[1], B.c[2] + e[2]]; }
function sphereBox(cx, cy, cz, r, B) { // distance from a point to an oriented box ≤ r
  const d = [cx - B.c[0], cy - B.c[1], cz - B.c[2]]; let q = 0; for (let i = 0; i < 3; i++) { const x = dot(d, B.a[i]), e = Math.max(0, Math.abs(x) - B.h[i]); q += e * e; } return q <= r * r;
}

export class Contacts {
  constructor(engine) {
    this.E = engine; this.rt = engine.rt; this.cells = new Map(); this.where = new Map(); this.dirty = new Set(); this.touching = new Map(); this.moved = new Set(); this.built = false;
    const prev = this.rt.onChange; this.rt.onChange = (o, k) => { prev?.(o, k); if ((k === 'CFrame' || k === 'Size' || k === 'Position' || k === 'Shape') && isPart(o)) { this.dirty.add(o); this.moved.add(o); } };
    // remember every part / Humanoid that gets a Touched or TouchEnded signal (only those are tested)
    this.listened = new Set(); const self = this, sig0 = Instance.prototype.sig;
    if (!Instance.prototype.sig.contactsHook) { Instance.prototype.sig = function (name) { if ((name === 'Touched' || name === 'TouchEnded') && this.rt && this.rt.contacts) this.rt.contacts.listened.add(this); return sig0.call(this, name); }; Instance.prototype.sig.contactsHook = true; }
    this.rt.contacts = this; void self;
    this.install();
  }
  /* ---- spatial hash ---- */
  key(x, y, z) { return x + ',' + y + ',' + z; }
  remove(p) { const ks = this.where.get(p); if (!ks) return; for (const k of ks) { const s = this.cells.get(k); if (s) { s.delete(p); if (!s.size) this.cells.delete(k); } } this.where.delete(p); }
  insert(p) {
    this.remove(p); if (!p.parent || !this.E.inWorld(p)) return; const B = obb(p); if (!B) return; const bb = aabb(B), ks = [];
    const x0 = Math.floor(bb[0] / CELL), x1 = Math.floor(bb[3] / CELL), y0 = Math.floor(bb[1] / CELL), y1 = Math.floor(bb[4] / CELL), z0 = Math.floor(bb[2] / CELL), z1 = Math.floor(bb[5] / CELL);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 4000) { ks.push('big'); } else for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) ks.push(this.key(x, y, z));
    for (const k of ks) { let s = this.cells.get(k); if (!s) this.cells.set(k, (s = new Set())); s.add(p); } this.where.set(p, ks);
  }
  build() { this.built = true; for (const d of this.rt.workspace.descendants()) if (isPart(d)) this.insert(d); }
  track(o, inWorld) { if (!this.built) return; const each = (x) => { if (isPart(x)) { if (inWorld) { this.insert(x); this.moved.add(x); } else { this.remove(x); this.endAll(x); } } for (const k of x.kids) each(k); }; each(o); }
  near(bb) { // parts whose cells meet an axis-aligned box
    if (!this.built) this.build(); this.flush(); const out = new Set(), big = this.cells.get('big'); if (big) for (const p of big) out.add(p);
    const x0 = Math.floor(bb[0] / CELL), x1 = Math.floor(bb[3] / CELL), y0 = Math.floor(bb[1] / CELL), y1 = Math.floor(bb[4] / CELL), z0 = Math.floor(bb[2] / CELL), z1 = Math.floor(bb[5] / CELL);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 20000) { for (const p of this.where.keys()) out.add(p); return out; }
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const s = this.cells.get(this.key(x, y, z)); if (s) for (const p of s) out.add(p); }
    return out;
  }
  flush() { for (const p of this.dirty) this.insert(p); this.dirty.clear(); }
  /* ---- per frame: Touched / TouchEnded ---- */
  step() {
    if (!this.built) this.build();
    // parts moved by physics, joints or the character this frame (their CFrame is set without a change event)
    for (const j of this.E.joints) { const p1 = j.props.get('Part1'); if (p1) this.moved.add(p1); }
    for (const r of this.E.freeRoots || []) this.moved.add(r);
    if (this.E.char) for (const p of Object.values(this.E.char.parts || {})) this.moved.add(p);
    // re-file a moving part in the hash only when it really travelled (cells are 12 studs wide)
    for (const p of this.moved) { const cf = p.props.get('CFrame'); if (!cf) continue; const l = p.$cfl; if (!l || Math.abs(l[0] - cf.p[0]) + Math.abs(l[1] - cf.p[1]) + Math.abs(l[2] - cf.p[2]) > 0.75 || this.dirty.has(p)) { p.$cfl = cf.p.slice(); this.dirty.add(p); } }
    this.flush();
    const humOf = (p) => { const m = p.parent; return m && m.kids.find((k) => k.cls === 'Humanoid'); };
    const live = (sg) => sg && sg.conns.length;
    // parts something listens to: their own Touched / TouchEnded, or a Humanoid's Touched for its limbs
    const watch = new Set(); for (const p of this.listened) { if (!p.parent) { this.listened.delete(p); continue; } if (p.cls === 'Humanoid') { if (live(p.sigs.get('Touched')) && p.parent) for (const k of p.parent.kids) if (isPart(k)) watch.add(k); } else if (live(p.sigs.get('Touched')) || live(p.sigs.get('TouchEnded'))) watch.add(p); }
    const now = new Map();
    for (const p of watch) {
      if (p.props.get('CanTouch') === false || !this.E.inWorld(p)) continue; const B = obb(p, 0.05); if (!B) continue; const hum = humOf(p), pm = this.moved.has(p);
      for (const q of this.near(aabb(B))) {
        if (q === p || q.props.get('CanTouch') === false || (hum && q.parent === p.parent)) continue; // a character does not touch itself
        const [x, y] = p.id < q.id ? [p, q] : [q, p]; const k = x.id + ':' + y.id; if (now.has(k)) continue;
        if (!pm && !this.moved.has(q) && q.props.get('Anchored') !== false && p.props.get('Anchored') !== false && !this.touching.has(k)) continue; // two still anchored parts never start touching
        const Q = obb(q); if (!Q || !obbOverlap(B, Q)) continue; now.set(k, [x, y]);
      }
    }
    const fire = (part, ev, other) => { const s = part.sigs.get(ev); if (s && s.conns.length) { const I = this.E.I, prev = I.side; I.side = 'server'; try { s.fire([other]); } finally { I.side = prev; } }
      const hum = humOf(part); if (hum && ev === 'Touched') { const h = hum.sigs.get('Touched'); if (h && h.conns.length) { const I = this.E.I, prev = I.side; I.side = 'server'; try { h.fire([other, part]); } finally { I.side = prev; } } } };
    for (const [k, [a, b]] of now) if (!this.touching.has(k)) { fire(a, 'Touched', b); fire(b, 'Touched', a); }
    for (const [k, [a, b]] of this.touching) if (!now.has(k)) { fire(a, 'TouchEnded', b); fire(b, 'TouchEnded', a); }
    this.touching = now; this.moved = new Set();
  }
  endAll(p) { for (const [k, [a, b]] of this.touching) if (a === p || b === p) this.touching.delete(k); }
  /* ---- queries ---- */
  filterFn(params) {
    const f = params && params.f ? params.f : {}; const list = f.FilterDescendantsInstances instanceof LuaTable ? f.FilterDescendantsInstances.arr : []; const incl = f.FilterType && f.FilterType.name === 'Include';
    const coll = !!f.RespectCanCollide;
    return (p) => { if (p.props.get('CanQuery') === false) return false; if (coll && p.props.get('CanCollide') === false) return false; if (!list.length) return !incl; let o = p, hit = false; while (o) { if (list.includes(o)) { hit = true; break; } o = o.parent; } return incl ? hit : !hit; };
  }
  query(B, params, test) { const ok = this.filterFn(params), max = (params && params.f && params.f.MaxParts) || 0, out = []; for (const p of this.near(aabb(B))) { if (!ok(p)) continue; if (test(p)) { out.push(p); if (max && out.length >= max) break; } } return out; }
  inBox(cf, size, params) { const B = boxOf(cf, size); return this.query(B, params, (p) => { const Q = obb(p); return Q && obbOverlap(B, Q); }); }
  inRadius(pos, r, params) { const B = { c: [pos.x, pos.y, pos.z], a: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], h: [r, r, r] }; return this.query(B, params, (p) => { const Q = obb(p); return Q && sphereBox(pos.x, pos.y, pos.z, r, Q); }); }
  inPart(part, params) { const B = obb(part); if (!B) return []; return this.query(B, params, (p) => { if (p === part) return false; const Q = obb(p); return Q && obbOverlap(B, Q); }); }
  touchingParts(part) { const B = obb(part, 0.05); if (!B) return []; return [...this.near(aabb(B))].filter((p) => p !== part && p.props.get('CanTouch') !== false && (() => { const Q = obb(p); return Q && obbOverlap(B, Q); })()); }
  /* a box swept from cf along dir: the first part it meets */
  sweep(cf, size, dir, params) {
    const len = Math.hypot(dir.x, dir.y, dir.z); if (len < 1e-6) return undefined; const ok = this.filterFn(params), steps = Math.min(200, Math.max(2, Math.ceil(len / Math.max(0.25, Math.min(size.x, size.y, size.z) / 2))));
    for (let i = 0; i <= steps; i++) { const t = (len * i) / steps, c = new CFrame([cf.p[0] + dir.x / len * t, cf.p[1] + dir.y / len * t, cf.p[2] + dir.z / len * t], cf.r); const B = boxOf(c, size);
      for (const p of this.near(aabb(B))) { if (!ok(p)) continue; const Q = obb(p); if (Q && obbOverlap(B, Q)) { const R = new Instance('RaycastResult', this.rt); R.props.set('Instance', p); R.props.set('Position', new Vector3(...c.p)); R.props.set('Distance', t); R.props.set('Normal', new Vector3(-dir.x / len, -dir.y / len, -dir.z / len)); R.props.set('Material', p.props.get('Material')); return R; } } }
    return undefined;
  }
  install() {
    const CM = this.rt.classMethods, self = this, T = (arr) => [LuaTable.from(arr)];
    const W = { GetPartBoundsInBox: fn((a) => T(self.inBox(a[1], a[2], a[3]))), GetPartBoundsInRadius: fn((a) => T(self.inRadius(a[1], a[2], a[3]))), GetPartsInPart: fn((a) => T(self.inPart(a[1], a[2]))),
      Blockcast: fn((a) => [self.sweep(a[1], a[2], a[3], a[4])]), Spherecast: fn((a) => [self.sweep(new CFrame([a[1].x, a[1].y, a[1].z]), new Vector3(a[2] * 2, a[2] * 2, a[2] * 2), a[3], a[4])]),
      Shapecast: fn((a) => [self.sweep(a[1].props.get('CFrame'), a[1].props.get('Size'), a[2], a[3])]),
      FindPartsInRegion3: fn((a) => { const r = a[1], c = r && r.f && r.f.CFrame, s = r && r.f && r.f.Size; return T(c && s ? self.inBox(c, s, null).slice(0, a[3] || 20) : []); }),
      FindPartsInRegion3WithIgnoreList: fn((a) => { const r = a[1], c = r && r.f && r.f.CFrame, s = r && r.f && r.f.Size, ign = a[2] instanceof LuaTable ? a[2].arr : []; return T(c && s ? self.inBox(c, s, null).filter((p) => !ign.some((g) => { let o = p; while (o) { if (o === g) return true; o = o.parent; } return false; })).slice(0, a[3] || 20) : []); }),
      ArePartsTouchingOthers: fn((a) => [(a[1] instanceof LuaTable ? a[1].arr : []).some((p) => self.touchingParts(p).length > 0)]) };
    CM.Workspace = { ...(CM.Workspace || {}), ...W }; CM.WorldRoot = CM.Workspace; CM.Model = { ...(CM.Model || {}) };
    const parts = { GetTouchingParts: fn((a) => T(self.touchingParts(a[0]))) }; Instance.methods.GetTouchingParts = parts.GetTouchingParts; // Instance methods win over class methods
    for (const c of ['Part', 'MeshPart', 'WedgePart', 'CornerWedgePart', 'TrussPart', 'SpawnLocation', 'Seat', 'VehicleSeat', 'UnionOperation', 'NegateOperation', 'IntersectOperation', 'SkateboardPlatform']) CM[c] = { ...(CM[c] || {}), ...parts };
  }
}
