/* =====================================================================
   Roblox Forge - animation core (pure maths, shared by the editor).
   kit/ForgeAnimCore.lua is the exact Luau twin used in the game, so what
   you see in the studio is what players see in Roblox.

   Model:
   - every part has a parent (bone hierarchy) and a pivot (model space);
   - a key stores an offset {pos, rot (deg, Euler XYZ = CFrame.Angles)};
   - offset K -> delta D = T(pivot) * K * T(-pivot);
   - world pose G(part) = G(parent) * D, final transform M = G * Rest;
   - in Roblox: Motor6D(Part0 = parent, C0 = rest relative, C1 = I)
     Transform = Rest^-1 * D * Rest gives exactly the same world pose.
   - easing of a segment comes from its first key (Roblox Pose semantics).
   ===================================================================== */
import * as THREE from 'three';

export const EASES = ['Linear', 'Sine', 'Quad', 'Cubic', 'Quart', 'Quint', 'Exponential', 'Circular', 'Back', 'Elastic', 'Bounce', 'Constant'];
export const EASE_FR = { Linear: 'Linéaire', Sine: 'Douce', Quad: 'Quad', Cubic: 'Cubique', Quart: 'Quart', Quint: 'Quint', Exponential: 'Expo', Circular: 'Cercle', Back: 'Recul', Elastic: 'Élastique', Bounce: 'Rebond', Constant: 'Fixe' };
export const DIRS = ['In', 'Out', 'InOut'];
export const DIR_FR = { In: 'Entrée', Out: 'Sortie', InOut: 'Les deux' };

const C1 = 1.70158, C3 = C1 + 1, C4 = (2 * Math.PI) / 3;
function bounceOut(x) {
  const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) { x -= 1.5 / d; return n * x * x + 0.75; }
  if (x < 2.5 / d) { x -= 2.25 / d; return n * x * x + 0.9375; }
  x -= 2.625 / d; return n * x * x + 0.984375;
}
const IN = {
  Linear: (x) => x,
  Sine: (x) => 1 - Math.cos((x * Math.PI) / 2),
  Quad: (x) => x * x,
  Cubic: (x) => x * x * x,
  Quart: (x) => x * x * x * x,
  Quint: (x) => x * x * x * x * x,
  Exponential: (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
  Circular: (x) => 1 - Math.sqrt(Math.max(0, 1 - x * x)),
  Back: (x) => C3 * x * x * x - C1 * x * x,
  Elastic: (x) => (x === 0 ? 0 : x === 1 ? 1 : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * C4)),
  Bounce: (x) => 1 - bounceOut(1 - x),
};
export function ease(style, dir, x) {
  x = Math.min(1, Math.max(0, x));
  if (style === 'Constant') return x >= 1 ? 1 : 0;
  const f = IN[style] || IN.Linear;
  if (dir === 'In') return f(x);
  if (dir === 'Out') return 1 - f(1 - x);
  return x < 0.5 ? f(2 * x) / 2 : 1 - f(2 - 2 * x) / 2;
}

/* ---------- quaternions (same formulas as ForgeAnimCore.lua) ---------- */
const D2R = Math.PI / 180;
export function quatFromEulerDeg(r) { // Euler XYZ = CFrame.Angles(x, y, z)
  const c1 = Math.cos((r[0] * D2R) / 2), c2 = Math.cos((r[1] * D2R) / 2), c3 = Math.cos((r[2] * D2R) / 2);
  const s1 = Math.sin((r[0] * D2R) / 2), s2 = Math.sin((r[1] * D2R) / 2), s3 = Math.sin((r[2] * D2R) / 2);
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3];
}
export function slerp(a, b, t) {
  let [bx, by, bz, bw] = b; let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let ka, kb;
  if (cos > 0.9995) { ka = 1 - t; kb = t; }
  else { const th = Math.acos(Math.min(1, cos)), s = Math.sin(th); ka = Math.sin((1 - t) * th) / s; kb = Math.sin(t * th) / s; }
  const q = [a[0] * ka + bx * kb, a[1] * ka + by * kb, a[2] * ka + bz * kb, a[3] * ka + bw * kb];
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}
const ID = () => ({ p: [0, 0, 0], q: [0, 0, 0, 1] });

/* ---------- sampling ---------- */
export function sampleTrack(keys, t) {
  if (!keys || !keys.length) return null;
  const first = keys[0], last = keys[keys.length - 1];
  if (keys.length === 1 || t <= first.t) return { p: first.pos.slice(), q: quatFromEulerDeg(first.rot) };
  if (t >= last.t) return { p: last.pos.slice(), q: quatFromEulerDeg(last.rot) };
  let i = 0; while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
  const a = keys[i], b = keys[i + 1], span = b.t - a.t;
  const e = span > 1e-6 ? ease(a.ease || 'Sine', a.dir || 'InOut', (t - a.t) / span) : 1;
  return { p: [0, 1, 2].map((k) => a.pos[k] + (b.pos[k] - a.pos[k]) * e), q: slerp(quatFromEulerDeg(a.rot), quatFromEulerDeg(b.rot), e) };
}
export function clipTime(clip, time) {
  const len = Math.max(0.05, clip.length || 1);
  return clip.loop ? ((time % len) + len) % len : Math.min(time, len);
}
/** layers: [{ clip, t, w, over }] -> Map(partKey -> {p, q}). Base layers are averaged by weight
 *  (a part with no track counts as rest); "over" layers (one-shots) override only the parts they animate. */
export function blend(layers, keysOf) {
  const out = new Map(), wsum = new Map();
  for (const L of layers) {
    if (!L || !L.clip || L.w <= 1e-4) continue;
    const t = clipTime(L.clip, L.t);
    for (const k of keysOf()) {
      const s = sampleTrack(L.clip.tracks && L.clip.tracks[k], t);
      if (L.over) { if (!s) continue; const acc = out.get(k) || ID(); out.set(k, mix(acc, s, L.w)); continue; }
      const acc = out.get(k), ws = (wsum.get(k) || 0) + L.w; wsum.set(k, ws);
      out.set(k, acc ? mix(acc, s || ID(), L.w / ws) : (s || ID()));
    }
  }
  return out;
}
function mix(a, b, w) { return { p: [0, 1, 2].map((k) => a.p[k] + (b.p[k] - a.p[k]) * w), q: slerp(a.q, b.q, w) }; }

/* ---------- rig (bones + pivots) ---------- */
const HEAD_KIDS = /^(ear|eye|shine|pupil|nose|snout|horn|visor|antenna|mouth|brow|cheek|hat|crown|tip)/i;
export function bodyOf(parts) { return parts.find((p) => p.name === 'Body') || parts[0]; }
function autoParent(p, parts, body) {
  if (p === body) return null;
  const by = (n) => parts.find((x) => x.name === n && x !== p);
  const name = p.name;
  let m;
  if ((m = /^EarIn([LR])$/i.exec(name)) && by('Ear' + m[1])) return by('Ear' + m[1]).id;
  if ((m = /^Shine([LR])$/i.exec(name)) && by('Eye' + m[1])) return by('Eye' + m[1]).id;
  if (/^Tip$/i.test(name) && by('Antenna')) return by('Antenna').id;
  if ((m = /^Tail(\d+)$/i.exec(name)) && +m[1] > 1 && by('Tail' + (+m[1] - 1))) return by('Tail' + (+m[1] - 1)).id;
  if (/^TailTip$/i.test(name)) { const segs = parts.filter((x) => /^Tail\d+$/i.test(x.name)).sort((a, b) => +b.name.slice(4) - +a.name.slice(4)); if (segs[0]) return segs[0].id; }
  const head = by('Head');
  if (head && HEAD_KIDS.test(name)) return head.id;
  return body.id;
}
function ellipsoidReach(p, dirWorld) { // distance from the centre to the surface along a direction
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.rot.map((v) => v * D2R), 'XYZ'));
  const u = dirWorld.clone().applyQuaternion(q.invert());
  const s = [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2].map((v) => Math.max(v, 0.01));
  return 1 / Math.sqrt((u.x / s[0]) ** 2 + (u.y / s[1]) ** 2 + (u.z / s[2]) ** 2);
}
function autoPivot(p, parent) {
  if (!parent) return [p.pos[0], +(p.pos[1] - p.size[1] / 2).toFixed(3), p.pos[2]]; // body: rocks on its base
  const c = new THREE.Vector3(...p.pos), d = new THREE.Vector3(...parent.pos).sub(c), len = d.length();
  if (len < 1e-4) return p.pos.slice();
  d.divideScalar(len);
  const r = Math.min(len, ellipsoidReach(p, d) * 0.92);
  return c.addScaledVector(d, r).toArray().map((v) => +v.toFixed(3));
}
/** Effective rig: Map(id -> { parent, pivot, depth }) plus ordered ids (parents first). Cycles are cut. */
export function rigOf(parts) {
  const body = bodyOf(parts); const byId = new Map(parts.map((p) => [p.id, p]));
  const parentOf = new Map();
  for (const p of parts) {
    let par = p === body ? null : (p.parent && byId.has(p.parent) && p.parent !== p.id ? p.parent : autoParent(p, parts, body));
    parentOf.set(p.id, par);
  }
  // cut cycles: walk up, if we come back to ourselves attach to the body
  for (const p of parts) { const seen = new Set([p.id]); let c = parentOf.get(p.id);
    while (c) { if (seen.has(c)) { parentOf.set(p.id, p === body ? null : body.id); break; } seen.add(c); c = parentOf.get(c); } }
  const kids = new Map(); for (const p of parts) { const par = parentOf.get(p.id); if (par) (kids.get(par) || kids.set(par, []).get(par)).push(p.id); }
  const order = [], depth = new Map();
  const walk = (id, d) => { order.push(id); depth.set(id, d); for (const k of kids.get(id) || []) walk(k, d + 1); };
  if (body) walk(body.id, 0);
  for (const p of parts) if (!depth.has(p.id)) { parentOf.set(p.id, body.id); walk(p.id, 1); } // safety
  const rig = new Map();
  for (const id of order) { const p = byId.get(id), par = parentOf.get(id);
    rig.set(id, { parent: par, depth: depth.get(id), pivot: Array.isArray(p.pivot) ? p.pos.map((v, i) => +(v + (+p.pivot[i] || 0)).toFixed(4)) : autoPivot(p, par ? byId.get(par) : null), autoPivot: !Array.isArray(p.pivot) }); }
  return { rig, order, body };
}

/* ---------- pose: offsets -> rigid model-space matrices ---------- */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
export function restMatrix(p, out = new THREE.Matrix4()) {
  return out.compose(_v.set(...p.pos), _q.setFromEuler(_e.set(p.rot[0] * D2R, p.rot[1] * D2R, p.rot[2] * D2R, 'XYZ')), _one);
}
export function deltaMatrix(pivot, off, out = new THREE.Matrix4()) {
  // T(pivot + p) * R(q) * T(-pivot)
  out.makeRotationFromQuaternion(_q.set(...off.q));
  const pv = _v.set(...pivot).applyQuaternion(_q);
  out.setPosition(pivot[0] + off.p[0] - pv.x, pivot[1] + off.p[1] - pv.y, pivot[2] + off.p[2] - pv.z);
  return out;
}
/** Map(id -> {G (accumulated delta), M (final rigid pose)}) */
export function computePose(parts, R, offsets) {
  const byId = new Map(parts.map((p) => [p.id, p])), res = new Map();
  for (const id of R.order) {
    const info = R.rig.get(id), off = offsets.get(id);
    const D = off ? deltaMatrix(info.pivot, off) : new THREE.Matrix4();
    const G = info.parent && res.has(info.parent) ? res.get(info.parent).G.clone().multiply(D) : D;
    res.set(id, { G, M: G.clone().multiply(restMatrix(byId.get(id), _m)) });
  }
  return res;
}
/** Inverse: the offset that puts part `id` at rigid pose Mw (model space) given the current pose of its parent. */
export function offsetFromPose(parts, R, pose, id, Mw) {
  const p = parts.find((x) => x.id === id), info = R.rig.get(id);
  const Gp = info.parent && pose.has(info.parent) ? pose.get(info.parent).G : new THREE.Matrix4();
  const D = Gp.clone().invert().multiply(Mw).multiply(restMatrix(p).invert());
  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); D.decompose(pos, q, s);
  const pv = new THREE.Vector3(...info.pivot), rpv = pv.clone().applyQuaternion(q);
  const off = pos.sub(pv).add(rpv);
  const eul = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return { pos: off.toArray().map((v) => +v.toFixed(4)), rot: [eul.x, eul.y, eul.z].map((v) => +(v / D2R).toFixed(2)) };
}
