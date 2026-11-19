/* =====================================================================
   Roblox Forge · Jouer — the Roblox API for the Luau interpreter.
   Datatypes (Vector3, Vector2, CFrame, Color3, UDim, UDim2, BrickColor,
   NumberRange / Sequences, TweenInfo, Random, Ray, Rect, Region3,
   RaycastParams…), Enum, Instance with the class tree, properties,
   attributes, tags, events (RBXScriptSignal), services, require of
   ModuleScripts, task scheduler. Lenient by design: an unknown member
   reads as nil and an unknown service is an empty Instance, so scripts
   get as far as they can without a full engine.
   ===================================================================== */
import { LuaTable, LuaError, call, callGen, tostr, typeOf, isTruthy } from './luau.js?v=8';

const err = (m) => { throw new LuaError(m); };
const num = (v, d = 0) => (typeof v === 'number' ? v : v === undefined || v === null ? d : +v || d);
const fn = (f) => f; // JS function (args[]) → results[]
const D2R = Math.PI / 180;

/* ---------------------------------------------------------------- userdata base */
class UD {
  $index(k) { const m = this.constructor.methods && this.constructor.methods[k]; if (m) return m; return this.get(k); }
  $newindex(k) { err(`${k} cannot be assigned to`); }
  get() { return undefined; }
}

/* ---------------------------------------------------------------- Vector3 */
export class Vector3 extends UD {
  constructor(x = 0, y = 0, z = 0) { super(); this.x = x; this.y = y; this.z = z; }
  get $type() { return 'Vector3'; }
  get(k) { switch (k) { case 'X': case 'x': return this.x; case 'Y': case 'y': return this.y; case 'Z': case 'z': return this.z; case 'Magnitude': case 'magnitude': return Math.hypot(this.x, this.y, this.z);
    case 'Unit': case 'unit': { const m = Math.hypot(this.x, this.y, this.z) || 1; return new Vector3(this.x / m, this.y / m, this.z / m); } } return undefined; }
  $op(op, o, rev) {
    if (op === 'unm') return new Vector3(-this.x, -this.y, -this.z);
    if (o instanceof Vector3) { switch (op) { case '+': return new Vector3(this.x + o.x, this.y + o.y, this.z + o.z); case '-': return rev ? new Vector3(o.x - this.x, o.y - this.y, o.z - this.z) : new Vector3(this.x - o.x, this.y - o.y, this.z - o.z);
      case '*': return new Vector3(this.x * o.x, this.y * o.y, this.z * o.z); case '/': return rev ? new Vector3(o.x / this.x, o.y / this.y, o.z / this.z) : new Vector3(this.x / o.x, this.y / o.y, this.z / o.z); case '//': return new Vector3(Math.floor(this.x / o.x), Math.floor(this.y / o.y), Math.floor(this.z / o.z)); } }
    if (typeof o === 'number') { switch (op) { case '*': return new Vector3(this.x * o, this.y * o, this.z * o); case '/': return rev ? new Vector3(o / this.x, o / this.y, o / this.z) : new Vector3(this.x / o, this.y / o, this.z / o); case '//': return new Vector3(Math.floor(this.x / o), Math.floor(this.y / o), Math.floor(this.z / o)); } }
    return undefined;
  }
  $eq(o) { return o instanceof Vector3 && o.x === this.x && o.y === this.y && o.z === this.z; }
  $tostring() { return `${fmt(this.x)}, ${fmt(this.y)}, ${fmt(this.z)}`; }
  dot(o) { return this.x * o.x + this.y * o.y + this.z * o.z; }
  cross(o) { return new Vector3(this.y * o.z - this.z * o.y, this.z * o.x - this.x * o.z, this.x * o.y - this.y * o.x); }
  static methods = {
    Dot: fn((a) => [a[0].dot(a[1])]), Cross: fn((a) => [a[0].cross(a[1])]), Lerp: fn((a) => { const [p, q, t] = a; return [new Vector3(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t, p.z + (q.z - p.z) * t)]; }),
    Min: fn((a) => [new Vector3(Math.min(...a.map((v) => v.x)), Math.min(...a.map((v) => v.y)), Math.min(...a.map((v) => v.z)))]), Max: fn((a) => [new Vector3(Math.max(...a.map((v) => v.x)), Math.max(...a.map((v) => v.y)), Math.max(...a.map((v) => v.z)))]),
    Abs: fn((a) => [new Vector3(Math.abs(a[0].x), Math.abs(a[0].y), Math.abs(a[0].z))]), Floor: fn((a) => [new Vector3(Math.floor(a[0].x), Math.floor(a[0].y), Math.floor(a[0].z))]), Ceil: fn((a) => [new Vector3(Math.ceil(a[0].x), Math.ceil(a[0].y), Math.ceil(a[0].z))]),
    Sign: fn((a) => [new Vector3(Math.sign(a[0].x), Math.sign(a[0].y), Math.sign(a[0].z))]), FuzzyEq: fn((a) => { const e = a[2] ?? 1e-5; return [Math.abs(a[0].x - a[1].x) <= e && Math.abs(a[0].y - a[1].y) <= e && Math.abs(a[0].z - a[1].z) <= e]; }),
    Angle: fn((a) => { const [u, v] = a; const c = u.dot(v) / ((u.get('Magnitude') * v.get('Magnitude')) || 1); return [Math.acos(Math.max(-1, Math.min(1, c)))]; }),
  };
}
const fmt = (n) => (Number.isInteger(n) ? String(n) : String(+n.toPrecision(7)));
export class Vector2 extends UD {
  constructor(x = 0, y = 0) { super(); this.x = x; this.y = y; }
  get $type() { return 'Vector2'; }
  get(k) { switch (k) { case 'X': case 'x': return this.x; case 'Y': case 'y': return this.y; case 'Magnitude': return Math.hypot(this.x, this.y); case 'Unit': { const m = Math.hypot(this.x, this.y) || 1; return new Vector2(this.x / m, this.y / m); } } return undefined; }
  $op(op, o, rev) { if (op === 'unm') return new Vector2(-this.x, -this.y);
    if (o instanceof Vector2) { switch (op) { case '+': return new Vector2(this.x + o.x, this.y + o.y); case '-': return rev ? new Vector2(o.x - this.x, o.y - this.y) : new Vector2(this.x - o.x, this.y - o.y); case '*': return new Vector2(this.x * o.x, this.y * o.y); case '/': return new Vector2(this.x / o.x, this.y / o.y); } }
    if (typeof o === 'number') { if (op === '*') return new Vector2(this.x * o, this.y * o); if (op === '/') return rev ? new Vector2(o / this.x, o / this.y) : new Vector2(this.x / o, this.y / o); } }
  $eq(o) { return o instanceof Vector2 && o.x === this.x && o.y === this.y; }
  $tostring() { return `${fmt(this.x)}, ${fmt(this.y)}`; }
  static methods = { Dot: fn((a) => [a[0].x * a[1].x + a[0].y * a[1].y]), Lerp: fn((a) => [new Vector2(a[0].x + (a[1].x - a[0].x) * a[2], a[0].y + (a[1].y - a[0].y) * a[2])]), Cross: fn((a) => [a[0].x * a[1].y - a[0].y * a[1].x]),
    Min: fn((a) => [new Vector2(Math.min(...a.map((v) => v.x)), Math.min(...a.map((v) => v.y)))]), Max: fn((a) => [new Vector2(Math.max(...a.map((v) => v.x)), Math.max(...a.map((v) => v.y)))]), Abs: fn((a) => [new Vector2(Math.abs(a[0].x), Math.abs(a[0].y))]) };
}

/* ---------------------------------------------------------------- CFrame (position + row-major 3x3) */
const mul3 = (a, b) => [a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8]];
const tr3 = (r) => [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]];
const rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const ID = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function quatToRot(x, y, z, w) { const n = Math.hypot(x, y, z, w) || 1; x /= n; y /= n; z /= n; w /= n;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]; }
function rotToQuat(r) { const t = r[0] + r[4] + r[8]; let x, y, z, w;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = s / 4; x = (r[7] - r[5]) / s; y = (r[2] - r[6]) / s; z = (r[3] - r[1]) / s; }
  else if (r[0] > r[4] && r[0] > r[8]) { const s = Math.sqrt(1 + r[0] - r[4] - r[8]) * 2; w = (r[7] - r[5]) / s; x = s / 4; y = (r[1] + r[3]) / s; z = (r[2] + r[6]) / s; }
  else if (r[4] > r[8]) { const s = Math.sqrt(1 + r[4] - r[0] - r[8]) * 2; w = (r[2] - r[6]) / s; x = (r[1] + r[3]) / s; y = s / 4; z = (r[5] + r[7]) / s; }
  else { const s = Math.sqrt(1 + r[8] - r[0] - r[4]) * 2; w = (r[3] - r[1]) / s; x = (r[2] + r[6]) / s; y = (r[5] + r[7]) / s; z = s / 4; } return [x, y, z, w]; }
function fromAxes(right, up, back) { return [right.x, up.x, back.x, right.y, up.y, back.y, right.z, up.z, back.z]; }
function lookAtRot(from, to, upv) { let b = new Vector3(from.x - to.x, from.y - to.y, from.z - to.z); const m = Math.hypot(b.x, b.y, b.z); if (m < 1e-9) return ID.slice(); b = new Vector3(b.x / m, b.y / m, b.z / m);
  let up = upv || new Vector3(0, 1, 0); let r = up.cross(b); if (Math.hypot(r.x, r.y, r.z) < 1e-6) { up = Math.abs(b.y) > 0.9 ? new Vector3(0, 0, b.y > 0 ? 1 : -1) : new Vector3(0, 1, 0); r = up.cross(b); }
  const rm = Math.hypot(r.x, r.y, r.z); r = new Vector3(r.x / rm, r.y / rm, r.z / rm); const u = b.cross(r); return fromAxes(r, u, b); }
export class CFrame extends UD {
  constructor(p = [0, 0, 0], r = ID) { super(); this.p = p; this.r = r; }
  get $type() { return 'CFrame'; }
  get(k) { const r = this.r;
    switch (k) { case 'Position': case 'p': return new Vector3(...this.p); case 'X': case 'x': return this.p[0]; case 'Y': case 'y': return this.p[1]; case 'Z': case 'z': return this.p[2];
      case 'LookVector': case 'lookVector': return new Vector3(-r[2], -r[5], -r[8]); case 'RightVector': case 'rightVector': case 'XVector': return new Vector3(r[0], r[3], r[6]);
      case 'UpVector': case 'upVector': case 'YVector': return new Vector3(r[1], r[4], r[7]); case 'ZVector': return new Vector3(r[2], r[5], r[8]); case 'Rotation': return new CFrame([0, 0, 0], r); }
    return undefined; }
  mulCF(o) { const r = this.r, q = o.p; return new CFrame([this.p[0] + r[0] * q[0] + r[1] * q[1] + r[2] * q[2], this.p[1] + r[3] * q[0] + r[4] * q[1] + r[5] * q[2], this.p[2] + r[6] * q[0] + r[7] * q[1] + r[8] * q[2]], mul3(r, o.r)); }
  pointToWorld(v) { const r = this.r; return new Vector3(this.p[0] + r[0] * v.x + r[1] * v.y + r[2] * v.z, this.p[1] + r[3] * v.x + r[4] * v.y + r[5] * v.z, this.p[2] + r[6] * v.x + r[7] * v.y + r[8] * v.z); }
  vecToWorld(v) { const r = this.r; return new Vector3(r[0] * v.x + r[1] * v.y + r[2] * v.z, r[3] * v.x + r[4] * v.y + r[5] * v.z, r[6] * v.x + r[7] * v.y + r[8] * v.z); }
  inverse() { const t = tr3(this.r), p = this.p; return new CFrame([-(t[0] * p[0] + t[1] * p[1] + t[2] * p[2]), -(t[3] * p[0] + t[4] * p[1] + t[5] * p[2]), -(t[6] * p[0] + t[7] * p[1] + t[8] * p[2])], t); }
  $op(op, o, rev) {
    if (rev) return undefined;
    if (op === '*' && o instanceof CFrame) return this.mulCF(o);
    if (op === '*' && o instanceof Vector3) return this.pointToWorld(o);
    if (op === '+' && o instanceof Vector3) return new CFrame([this.p[0] + o.x, this.p[1] + o.y, this.p[2] + o.z], this.r);
    if (op === '-' && o instanceof Vector3) return new CFrame([this.p[0] - o.x, this.p[1] - o.y, this.p[2] - o.z], this.r);
    return undefined;
  }
  $eq(o) { return o instanceof CFrame && o.p.every((v, i) => v === this.p[i]) && o.r.every((v, i) => v === this.r[i]); }
  $tostring() { return [...this.p, ...this.r].map(fmt).join(', '); }
  toEulerXYZ() { const m = this.r; const y = Math.asin(Math.max(-1, Math.min(1, m[2]))); let x, z; if (Math.abs(m[2]) < 0.9999999) { x = Math.atan2(-m[5], m[8]); z = Math.atan2(-m[1], m[0]); } else { x = Math.atan2(m[7], m[4]); z = 0; } return [x, y, z]; }
  toEulerYXZ() { const m = this.r; const x = Math.asin(-Math.max(-1, Math.min(1, m[5]))); let y, z; if (Math.abs(m[5]) < 0.9999999) { y = Math.atan2(m[2], m[8]); z = Math.atan2(m[3], m[4]); } else { y = Math.atan2(-m[6], m[0]); z = 0; } return [x, y, z]; }
  static methods = {
    Inverse: fn((a) => [a[0].inverse()]), inverse: fn((a) => [a[0].inverse()]),
    Lerp: fn((a) => { const [c0, c1, t] = a, q0 = rotToQuat(c0.r), q1 = rotToQuat(c1.r); let d = q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3]; if (d < 0) { q1.forEach((v, i) => (q1[i] = -v)); d = -d; }
      let q; if (d > 0.9995) q = q0.map((v, i) => v + (q1[i] - v) * t); else { const th = Math.acos(d), s = Math.sin(th), w0 = Math.sin((1 - t) * th) / s, w1 = Math.sin(t * th) / s; q = q0.map((v, i) => v * w0 + q1[i] * w1); }
      return [new CFrame(c0.p.map((v, i) => v + (c1.p[i] - v) * t), quatToRot(...q))]; }),
    ToWorldSpace: fn((a) => a.slice(1).map((c) => a[0].mulCF(c))), ToObjectSpace: fn((a) => a.slice(1).map((c) => a[0].inverse().mulCF(c))),
    PointToWorldSpace: fn((a) => a.slice(1).map((v) => a[0].pointToWorld(v))), PointToObjectSpace: fn((a) => a.slice(1).map((v) => a[0].inverse().pointToWorld(v))),
    VectorToWorldSpace: fn((a) => a.slice(1).map((v) => a[0].vecToWorld(v))), VectorToObjectSpace: fn((a) => a.slice(1).map((v) => a[0].inverse().vecToWorld(v))),
    GetComponents: fn((a) => [...a[0].p, ...a[0].r]), components: fn((a) => [...a[0].p, ...a[0].r]),
    ToEulerAnglesXYZ: fn((a) => a[0].toEulerXYZ()), toEulerAnglesXYZ: fn((a) => a[0].toEulerXYZ()), ToEulerAnglesYXZ: fn((a) => a[0].toEulerYXZ()), ToOrientation: fn((a) => a[0].toEulerYXZ()),
    ToAxisAngle: fn((a) => { const [x, y, z, w] = rotToQuat(a[0].r), ang = 2 * Math.acos(Math.max(-1, Math.min(1, w))), s = Math.sqrt(1 - w * w) || 1; return [new Vector3(x / s, y / s, z / s), ang]; }),
    Orthonormalize: fn((a) => { const q = rotToQuat(a[0].r); return [new CFrame(a[0].p, quatToRot(...q))]; }),
    FuzzyEq: fn((a) => [a[0].p.every((v, i) => Math.abs(v - a[1].p[i]) < (a[2] ?? 1e-5)) && a[0].r.every((v, i) => Math.abs(v - a[1].r[i]) < 1e-4)]),
  };
}
const cfNew = fn((a) => {
  if (a.length === 0) return [new CFrame()];
  if (a[0] instanceof Vector3) { const p = a[0]; if (a[1] instanceof Vector3) return [new CFrame([p.x, p.y, p.z], lookAtRot(p, a[1]))]; return [new CFrame([p.x, p.y, p.z])]; }
  const v = a.map((x) => num(x));
  if (a.length >= 12) return [new CFrame(v.slice(0, 3), v.slice(3, 12))];
  if (a.length === 7) return [new CFrame(v.slice(0, 3), quatToRot(v[3], v[4], v[5], v[6]))];
  return [new CFrame([v[0], v[1], v[2]])];
});
const angles = (a) => [new CFrame([0, 0, 0], mul3(mul3(rx(num(a[0])), ry(num(a[1]))), rz(num(a[2]))))];
const yxz = (a) => [new CFrame([0, 0, 0], mul3(mul3(ry(num(a[1])), rx(num(a[0]))), rz(num(a[2]))))];
const CFrameLib = { new: cfNew, Angles: fn(angles), fromEulerAnglesXYZ: fn(angles), fromEulerAngles: fn(angles), fromEulerAnglesYXZ: fn(yxz), fromOrientation: fn(yxz),
  fromAxisAngle: fn((a) => { const v = a[0], m = Math.hypot(v.x, v.y, v.z) || 1, h = num(a[1]) / 2, s = Math.sin(h); return [new CFrame([0, 0, 0], quatToRot(v.x / m * s, v.y / m * s, v.z / m * s, Math.cos(h)))]; }),
  lookAt: fn((a) => [new CFrame([a[0].x, a[0].y, a[0].z], lookAtRot(a[0], a[1], a[2]))]),
  lookAlong: fn((a) => [new CFrame([a[0].x, a[0].y, a[0].z], lookAtRot(a[0], new Vector3(a[0].x + a[1].x, a[0].y + a[1].y, a[0].z + a[1].z), a[2]))]),
  fromMatrix: fn((a) => { const [p, vx, vy, vz0] = a; const vz = vz0 || vx.cross(vy); return [new CFrame([p.x, p.y, p.z], fromAxes(vx, vy, vz))]; }),
  identity: new CFrame() };

/* ---------------------------------------------------------------- Color3, BrickColor */
export class Color3 extends UD {
  constructor(r = 0, g = 0, b = 0) { super(); this.r = r; this.g = g; this.b = b; }
  get $type() { return 'Color3'; }
  get(k) { return k === 'R' || k === 'r' ? this.r : k === 'G' || k === 'g' ? this.g : k === 'B' || k === 'b' ? this.b : undefined; }
  $eq(o) { return o instanceof Color3 && o.r === this.r && o.g === this.g && o.b === this.b; }
  $tostring() { return `${fmt(this.r)}, ${fmt(this.g)}, ${fmt(this.b)}`; }
  hex() { return '#' + [this.r, this.g, this.b].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join(''); }
  static methods = { Lerp: fn((a) => [new Color3(a[0].r + (a[1].r - a[0].r) * a[2], a[0].g + (a[1].g - a[0].g) * a[2], a[0].b + (a[1].b - a[0].b) * a[2])]),
    ToHSV: fn((a) => rgb2hsv(a[0].r, a[0].g, a[0].b)), ToHex: fn((a) => [a[0].hex().slice(1)]) };
}
function rgb2hsv(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; if (h < 0) h += 1; } return [h, mx ? d / mx : 0, mx]; }
function hsv2rgb(h, s, v) { h = ((h % 1) + 1) % 1; const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6]; }
const BRICK = { 'White': '#f2f3f3', 'Institutional white': '#f8f8f8', 'Light stone grey': '#e5e4df', 'Medium stone grey': '#a3a2a5', 'Dark stone grey': '#635f62', 'Black': '#1b2a35', 'Really black': '#111111',
  'Bright red': '#c4281c', 'Really red': '#ff0000', 'Bright yellow': '#f5cd30', 'New Yeller': '#ffff00', 'Bright blue': '#0d69ac', 'Really blue': '#0000ff', 'Bright green': '#4b974b', 'Lime green': '#00ff00', 'Bright orange': '#da8541',
  'Deep orange': '#ffaf00', 'Bright violet': '#6b327c', 'Royal purple': '#6225d1', 'Hot pink': '#ff00bf', 'Pink': '#ff66cc', 'Cyan': '#04afec', 'Toothpaste': '#00ffff', 'Teal': '#12eed4', 'Brown': '#7c5c46', 'Reddish brown': '#694028',
  'Nougat': '#cc8e69', 'Earth green': '#27462d', 'Dark green': '#287f47', 'Sand blue': '#74869d', 'Sand green': '#789082', 'Pastel blue': '#80bbdc', 'Pastel Blue': '#80bbdc', 'Light blue': '#b4d2e4', 'Electric blue': '#09137a', 'Gold': '#efb838', 'Bright bluish green': '#008f9c', 'Grime': '#7f8e64', 'Camo': '#3a7d15', 'Mid gray': '#cdcdcd', 'Smoky grey': '#5b5d69' };
const BRICK_NUM = { 1: 'White', 5: 'Brick yellow', 21: 'Bright red', 23: 'Bright blue', 24: 'Bright yellow', 26: 'Black', 28: 'Dark green', 37: 'Bright green', 106: 'Bright orange', 194: 'Medium stone grey', 199: 'Dark stone grey', 1001: 'Institutional white', 1003: 'Really black', 1004: 'Really red', 1010: 'Really blue', 1020: 'Lime green' };
class BrickColor extends UD {
  constructor(name) { super(); this.name = BRICK[name] ? name : 'Medium stone grey'; this.color = BRICK[this.name]; }
  get $type() { return 'BrickColor'; }
  get(k) { if (k === 'Name') return this.name; if (k === 'Color') { const n = parseInt(this.color.slice(1), 16); return new Color3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); } if (k === 'Number') return 194; if (k === 'r' || k === 'g' || k === 'b') return this.get('Color').get(k); return undefined; }
  $eq(o) { return o instanceof BrickColor && o.name === this.name; } $tostring() { return this.name; }
}
const nearestBrick = (c) => { let best = 'Medium stone grey', d = 9; for (const [k, h] of Object.entries(BRICK)) { const n = parseInt(h.slice(1), 16), e = ((n >> 16 & 255) / 255 - c.r) ** 2 + ((n >> 8 & 255) / 255 - c.g) ** 2 + ((n & 255) / 255 - c.b) ** 2; if (e < d) { d = e; best = k; } } return best; };

/* ---------------------------------------------------------------- small value types */
class Simple extends UD { constructor(type, fields, extra = {}) { super(); this.t = type; this.f = fields; Object.assign(this, extra); } get $type() { return this.t; } get(k) { return this.f[k]; } $eq(o) { return o instanceof Simple && o.t === this.t && JSON.stringify(o.f) === JSON.stringify(this.f); } $tostring() { return Object.values(this.f).map(tostr).join(', '); } }
const UDim = (s, o) => new Simple('UDim', { Scale: num(s), Offset: num(o) });
const UDim2 = (xs, xo, ys, yo) => { const u = new Simple('UDim2', { X: UDim(xs, xo), Y: UDim(ys, yo), Width: UDim(xs, xo), Height: UDim(ys, yo) });
  u.$op = (op, o) => (o instanceof Simple && o.t === 'UDim2' ? (op === '+' ? UDim2(u.f.X.f.Scale + o.f.X.f.Scale, u.f.X.f.Offset + o.f.X.f.Offset, u.f.Y.f.Scale + o.f.Y.f.Scale, u.f.Y.f.Offset + o.f.Y.f.Offset) : op === '-' ? UDim2(u.f.X.f.Scale - o.f.X.f.Scale, u.f.X.f.Offset - o.f.X.f.Offset, u.f.Y.f.Scale - o.f.Y.f.Scale, u.f.Y.f.Offset - o.f.Y.f.Offset) : undefined) : undefined);
  u.constructor = { methods: { Lerp: fn((a) => { const [p, q, t] = a; const l = (x, y) => x + (y - x) * t; return [UDim2(l(p.f.X.f.Scale, q.f.X.f.Scale), l(p.f.X.f.Offset, q.f.X.f.Offset), l(p.f.Y.f.Scale, q.f.Y.f.Scale), l(p.f.Y.f.Offset, q.f.Y.f.Offset))]; }) } }; return u; };
const NumberRange = (a, b) => new Simple('NumberRange', { Min: num(a), Max: num(b ?? a) });
const Keypoint = (t, v, e) => new Simple(v instanceof Color3 ? 'ColorSequenceKeypoint' : 'NumberSequenceKeypoint', { Time: num(t), Value: v, Envelope: num(e) });
const Sequence = (type, a) => { let kps; if (a[0] instanceof LuaTable) { kps = a[0].arr; } else if (a.length >= 2 && (typeof a[0] === 'number' || a[0] instanceof Color3)) kps = [Keypoint(0, a[0]), Keypoint(1, a[1])]; else kps = [Keypoint(0, a[0]), Keypoint(1, a[0])];
  return new Simple(type, { Keypoints: LuaTable.from(kps) }); };

/* ---------------------------------------------------------------- Random (deterministic xorshift128+) */
class RandomGen extends UD {
  constructor(seed) { super(); let s = Math.floor(num(seed, Date.now())) >>> 0 || 0x9e3779b9; this.s = [s ^ 0x5DEECE66, (s * 1103515245 + 12345) >>> 0 || 1, s ^ 0xdeadbeef, 0x2545f491]; for (let i = 0; i < 12; i++) this.next(); }
  get $type() { return 'Random'; }
  next() { let [a, b, c, d] = this.s; const t = b << 9; let r = (a * 5) >>> 0; r = ((r << 7) | (r >>> 25)) * 9 >>> 0; c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = (d << 11) | (d >>> 21); this.s = [a >>> 0, b >>> 0, c >>> 0, d >>> 0]; return (r >>> 0) / 4294967296; }
  static methods = {
    NextNumber: fn((a) => { const r = a[0].next(); return [a[1] === undefined ? r : num(a[1]) + r * (num(a[2], 1) - num(a[1]))]; }),
    NextInteger: fn((a) => { const lo = Math.ceil(num(a[1])), hi = Math.floor(num(a[2])); if (hi < lo) err('invalid argument #2 to \'NextInteger\' (max must be greater than or equal to min)'); return [lo + Math.floor(a[0].next() * (hi - lo + 1))]; }),
    NextUnitVector: fn((a) => { const z = a[0].next() * 2 - 1, t = a[0].next() * Math.PI * 2, r = Math.sqrt(1 - z * z); return [new Vector3(r * Math.cos(t), r * Math.sin(t), z)]; }),
    Shuffle: fn((a) => { const t = a[1], n = t.length(); for (let i = n; i > 1; i--) { const j = 1 + Math.floor(a[0].next() * i); const v = t.get(i); t.set(i, t.get(j)); t.set(j, v); } return []; }),
    Clone: fn((a) => { const r = new RandomGen(1); r.s = a[0].s.slice(); return [r]; }),
  };
}

/* ---------------------------------------------------------------- Enum */
const MATERIAL_VALUES = { Plastic: 256, SmoothPlastic: 272, Neon: 288, Wood: 512, WoodPlanks: 528, Marble: 784, Basalt: 788, Slate: 800, CrackedLava: 804, Concrete: 816, Limestone: 820, Granite: 832, Pavement: 836, Brick: 848, Pebble: 864, Cobblestone: 880, Rock: 896, Sandstone: 912,
  CorrodedMetal: 1040, DiamondPlate: 1056, Foil: 1072, Metal: 1088, Grass: 1280, LeafyGrass: 1284, Sand: 1296, Fabric: 1312, Snow: 1328, Mud: 1344, Ground: 1360, Asphalt: 1376, Salt: 1392, Ice: 1536, Glacier: 1552, Glass: 1568, ForceField: 1584, Air: 1792, Water: 2048, Cardboard: 1316, Carpet: 1318, Leather: 1320, Plaster: 820, Rubber: 1322 };
class EnumItem extends UD { constructor(type, name, value) { super(); this.type = type; this.name = name; this.value = value; } get $type() { return 'EnumItem'; }
  get(k) { if (k === 'Name') return this.name; if (k === 'Value') return this.value; if (k === 'EnumType') return Enum.get(this.type); return undefined; } $tostring() { return `Enum.${this.type}.${this.name}`; }
  static methods = { IsA: fn((a) => [a[0].type === a[1]]) }; }
class EnumType extends UD { constructor(name) { super(); this.name = name; this.items = new Map(); } get $type() { return 'Enum'; }
  item(k) { if (!this.items.has(k)) { const v = this.name === 'Material' ? MATERIAL_VALUES[k] ?? this.items.size : this.items.size; this.items.set(k, new EnumItem(this.name, k, v)); } return this.items.get(k); }
  $index(k) { if (k === 'GetEnumItems') return fn(() => [LuaTable.from([...this.items.values()])]); if (k === 'FromName') return fn((a) => [this.item(a[1])]); if (k === 'FromValue') return fn((a) => [[...this.items.values()].find((i) => i.value === a[1])]); return this.item(k); }
  $tostring() { return this.name; } }
const Enum = new Map(); const enumOf = (n) => { if (!Enum.has(n)) Enum.set(n, new EnumType(n)); return Enum.get(n); };
const EnumRoot = { $type: 'Enums', $index: (k) => (k === 'GetEnums' ? fn(() => [LuaTable.from([...Enum.values()])]) : enumOf(k)), $tostring: () => 'Enums' };
// pre-register Material so values are stable
Object.keys(MATERIAL_VALUES).forEach((k) => enumOf('Material').item(k));
['Ball', 'Block', 'Cylinder', 'Wedge', 'CornerWedge'].forEach((k) => enumOf('PartType').item(k));
export const enumItem = (t, n) => enumOf(t).item(n);

/* ---------------------------------------------------------------- signals */
export class Signal extends UD {
  constructor(name = 'Signal') { super(); this.name = name; this.conns = []; }
  get $type() { return 'RBXScriptSignal'; } $tostring() { return 'Signal ' + this.name; }
  fire(args) { for (const c of this.conns.slice()) { if (!c.connected) continue; if (c.once) c.connected = false; if (Signal.spawn) Signal.spawn(c.f, args); else try { call(c.f, args); } catch (e) { console.warn(e); } } this.conns = this.conns.filter((c) => c.connected);
    const w = this.waiters; this.waiters = []; for (const th of w || []) Signal.wake?.(th, args); }
  static methods = {
    Connect: fn((a) => { const c = new Connection(a[0], a[1]); a[0].conns.push(c); return [c]; }), connect: fn((a) => Signal.methods.Connect(a)),
    Once: fn((a) => { const c = new Connection(a[0], a[1]); c.once = true; a[0].conns.push(c); return [c]; }),
    ConnectParallel: fn((a) => Signal.methods.Connect(a)),
    Wait: Object.assign(fn(() => []), { ygen: function* (a) { const r = yield { waitSignal: a[0] }; return r || []; } }), wait: Object.assign(fn(() => []), { ygen: function* (a) { const r = yield { waitSignal: a[0] }; return r || []; } }),
  };
}
class Connection extends UD { constructor(sig, f) { super(); this.sig = sig; this.f = f; this.connected = true; } get $type() { return 'RBXScriptConnection'; }
  get(k) { return k === 'Connected' ? this.connected : undefined; } static methods = { Disconnect: fn((a) => { a[0].connected = false; return []; }), disconnect: fn((a) => { a[0].connected = false; return []; }) }; }

/* ---------------------------------------------------------------- Instance */
const CLASS_TREE = {
  Part: 'FormFactorPart', FormFactorPart: 'BasePart', WedgePart: 'FormFactorPart', CornerWedgePart: 'BasePart', TrussPart: 'BasePart', SpawnLocation: 'Part', Seat: 'Part', VehicleSeat: 'BasePart', SkateboardPlatform: 'Part',
  MeshPart: 'TriangleMeshPart', TriangleMeshPart: 'BasePart', UnionOperation: 'PartOperation', NegateOperation: 'PartOperation', IntersectOperation: 'PartOperation', PartOperation: 'TriangleMeshPart', Terrain: 'BasePart', BasePart: 'PVInstance', PVInstance: 'Instance',
  Model: 'PVInstance', Workspace: 'WorldRoot', WorldRoot: 'Model', Folder: 'Instance', Tool: 'BackpackItem', BackpackItem: 'Instance', Accessory: 'Accoutrement', Accoutrement: 'Instance',
  Script: 'BaseScript', LocalScript: 'Script', BaseScript: 'LuaSourceContainer', ModuleScript: 'LuaSourceContainer', LuaSourceContainer: 'Instance',
  ScreenGui: 'LayerCollector', BillboardGui: 'LayerCollector', SurfaceGui: 'SurfaceGuiBase', SurfaceGuiBase: 'LayerCollector', LayerCollector: 'GuiBase2d', GuiBase2d: 'GuiBase', GuiBase: 'Instance',
  Frame: 'GuiObject', ScrollingFrame: 'GuiObject', CanvasGroup: 'GuiObject', ViewportFrame: 'GuiObject', TextLabel: 'GuiObject', TextButton: 'GuiButton', ImageButton: 'GuiButton', GuiButton: 'GuiObject', ImageLabel: 'GuiObject', TextBox: 'GuiObject', GuiObject: 'GuiBase2d',
  PointLight: 'Light', SpotLight: 'Light', SurfaceLight: 'Light', Light: 'Instance', Decal: 'FaceInstance', Texture: 'Decal', FaceInstance: 'Instance',
  Humanoid: 'Instance', Attachment: 'Instance', Bone: 'Attachment', Weld: 'JointInstance', Motor6D: 'Motor', Motor: 'JointInstance', JointInstance: 'Instance', WeldConstraint: 'Instance',
  ParticleEmitter: 'Instance', Beam: 'Instance', Trail: 'Instance', Fire: 'Instance', Smoke: 'Instance', Sparkles: 'Instance', Sound: 'Instance', SoundGroup: 'Instance',
  RemoteEvent: 'BaseRemoteEvent', UnreliableRemoteEvent: 'BaseRemoteEvent', BaseRemoteEvent: 'Instance', RemoteFunction: 'Instance', BindableEvent: 'Instance', BindableFunction: 'Instance',
  StringValue: 'ValueBase', IntValue: 'ValueBase', NumberValue: 'ValueBase', BoolValue: 'ValueBase', ObjectValue: 'ValueBase', Vector3Value: 'ValueBase', CFrameValue: 'ValueBase', Color3Value: 'ValueBase', ValueBase: 'Instance',
  Atmosphere: 'Instance', Sky: 'Instance', BloomEffect: 'PostEffect', ColorCorrectionEffect: 'PostEffect', SunRaysEffect: 'PostEffect', BlurEffect: 'PostEffect', DepthOfFieldEffect: 'PostEffect', PostEffect: 'Instance',
  SpecialMesh: 'FileMesh', FileMesh: 'DataModelMesh', BlockMesh: 'BevelMesh', CylinderMesh: 'BevelMesh', BevelMesh: 'DataModelMesh', DataModelMesh: 'Instance', SelectionBox: 'Instance', Highlight: 'Instance', ProximityPrompt: 'Instance', ClickDetector: 'Instance',
  UICorner: 'UIComponent', UIStroke: 'UIComponent', UIGradient: 'UIComponent', UIPadding: 'UIComponent', UIListLayout: 'UIGridStyleLayout', UIGridLayout: 'UIGridStyleLayout', UIGridStyleLayout: 'UIComponent', UIScale: 'UIComponent', UIAspectRatioConstraint: 'UIComponent', UISizeConstraint: 'UIComponent', UITextSizeConstraint: 'UIComponent', UIComponent: 'Instance',
  Camera: 'PVInstance', Player: 'Instance', Animation: 'Instance', AnimationController: 'Instance', Animator: 'Instance', AlignPosition: 'Constraint', AlignOrientation: 'Constraint', LinearVelocity: 'Constraint', AngularVelocity: 'Constraint', VectorForce: 'Constraint', RopeConstraint: 'Constraint', HingeConstraint: 'Constraint', BallSocketConstraint: 'Constraint', Constraint: 'Instance',
};
const isA = (cls, want) => { let c = cls; while (c) { if (c === want) return true; c = CLASS_TREE[c]; } return want === 'Instance'; };
const EVENTS = new Set(['Changed', 'ChildAdded', 'ChildRemoved', 'DescendantAdded', 'DescendantRemoving', 'AncestryChanged', 'Destroying', 'AttributeChanged', 'Touched', 'TouchEnded', 'Triggered', 'TriggerEnded', 'PromptButtonHoldBegan', 'PromptShown', 'PromptHidden', 'MouseClick', 'MouseButton1Click', 'MouseButton1Down', 'MouseButton1Up', 'MouseButton2Click', 'MouseEnter', 'MouseLeave', 'Activated', 'InputBegan', 'InputEnded', 'InputChanged', 'FocusLost', 'Focused',
  'Heartbeat', 'RenderStepped', 'Stepped', 'PreRender', 'PreSimulation', 'PostSimulation', 'PlayerAdded', 'PlayerRemoving', 'CharacterAdded', 'CharacterRemoving', 'CharacterAppearanceLoaded', 'Died', 'HealthChanged', 'StateChanged', 'Running', 'Jumping', 'MoveToFinished', 'Seated',
  'OnServerEvent', 'OnClientEvent', 'Event', 'Equipped', 'Unequipped', 'Deactivated', 'Played', 'Ended', 'Stopped', 'Completed', 'DidLoop', 'KeyframeReached', 'Chatted', 'Idled', 'TextChanged', 'ReturnPressedFromOnScreenKeyboard', 'PromptTriggered', 'PromptTriggerEnded', 'TouchTap', 'TouchStarted', 'TouchEnded', 'TouchMoved', 'JumpRequest', 'LastInputTypeChanged', 'MessageReceived', 'Close', 'ChildRemoving', 'PropertyChangedSignal']);
let refN = 0;
export class Instance extends UD {
  constructor(cls, rt) { super(); this.cls = cls; this.rt = rt; this.props = new Map(); this.kids = []; this.parent = null; this.attrs = new Map(); this.tags = new Set(); this.sigs = new Map(); this.id = ++refN; this.props.set('Name', cls); this.archivable = true; defaults(this); }
  get $type() { return 'Instance'; }
  $tostring() { return this.props.get('Name'); }
  sig(name) { if (!this.sigs.has(name)) this.sigs.set(name, new Signal(name)); return this.sigs.get(name); }
  child(name) { return this.kids.find((c) => c.props.get('Name') === name); }
  descendants(out = []) { for (const c of this.kids) { out.push(c); c.descendants(out); } return out; }
  setParent(p) {
    if (p === this.parent) return; if (p && !(p instanceof Instance)) err('Parent must be an Instance');
    if (this.destroyed) err(`The Parent property of ${this.props.get('Name')} is locked`);
    const old = this.parent; if (old) { old.kids.splice(old.kids.indexOf(this), 1); old.sigs.get('ChildRemoved')?.fire([this]); }
    this.parent = p; if (p) { p.kids.push(this); p.sigs.get('ChildAdded')?.fire([this]); let a = p; while (a) { a.sigs.get('DescendantAdded')?.fire([this]); a = a.parent; } }
    this.sigs.get('AncestryChanged')?.fire([this, p]); this.rt.onParent?.(this, p, old);
  }
  $index(k) {
    if (k === 'Parent') return this.parent ?? undefined;
    if (k === 'ClassName') return this.cls; if (k === 'className') return this.cls;
    if (this.props.has(k)) return derive(this, k, this.props.get(k));
    const d = derived(this, k); if (d !== undefined) return d;
    const m = Instance.methods[k] || (this.rt.classMethods[this.cls] && this.rt.classMethods[this.cls][k]); if (m) return m;
    if (EVENTS.has(k)) return this.sig(k);
    const c = this.child(k); if (c) return c;
    const svc = this.rt.extraMember?.(this, k); if (svc !== undefined) return svc;
    return undefined;
  }
  $newindex(k, v) {
    if (k === 'Parent') { this.setParent(v ?? null); return; }
    if (setDerived(this, k, v)) { this.changed(k); return; }
    this.props.set(k, v); this.changed(k);
  }
  changed(k) { this.sigs.get('Changed')?.fire([k]); this.sigs.get('Prop:' + k)?.fire([]); this.rt.onChange?.(this, k); }
  clone() { if (!this.archivable) return undefined; const c = new Instance(this.cls, this.rt); c.props = new Map(this.props); c.attrs = new Map(this.attrs); c.tags = new Set(this.tags); c.source = this.source; c.ast = this.ast;
    for (const k of this.kids) { const kc = k.clone(); if (kc) { kc.parent = c; c.kids.push(kc); } } return c; }
  pivot() { if (isA(this.cls, 'BasePart')) return this.props.get('CFrame'); const pp = this.props.get('PrimaryPart'); if (pp && pp.props) return pp.props.get('CFrame'); const wp = this.props.get('WorldPivot'); if (wp) return wp;
    const parts = this.descendants().filter((d) => isA(d.cls, 'BasePart')); if (!parts.length) return new CFrame(); const b = bounds(parts); return new CFrame([(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]); }
  pivotTo(cf) { const cur = this.pivot(), delta = cf.mulCF(cur.inverse());
    if (isA(this.cls, 'BasePart')) { this.props.set('CFrame', cf); this.changed('CFrame'); return; }
    for (const d of this.descendants()) if (isA(d.cls, 'BasePart')) { d.props.set('CFrame', delta.mulCF(d.props.get('CFrame'))); d.changed('CFrame'); }
    if (this.props.get('WorldPivot')) this.props.set('WorldPivot', cf); }
  static methods = {};
}
function bounds(parts) { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const p of parts) { const cf = p.props.get('CFrame'), s = p.props.get('Size'); for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) { const w = cf.pointToWorld(new Vector3(s.x * sx, s.y * sy, s.z * sz)); b[0] = Math.min(b[0], w.x); b[1] = Math.min(b[1], w.y); b[2] = Math.min(b[2], w.z); b[3] = Math.max(b[3], w.x); b[4] = Math.max(b[4], w.y); b[5] = Math.max(b[5], w.z); } }
  return b; }
function defaults(o) { const c = o.cls, P = o.props;
  if (isA(c, 'BasePart')) { P.set('Size', c === 'TrussPart' ? new Vector3(2, 2, 2) : new Vector3(4, 1, 2)); P.set('CFrame', new CFrame()); P.set('Color', new Color3(163 / 255, 162 / 255, 165 / 255)); P.set('Material', enumItem('Material', 'Plastic')); P.set('Transparency', 0); P.set('Reflectance', 0); P.set('Anchored', false); P.set('CanCollide', true); P.set('CanTouch', true); P.set('CanQuery', true); P.set('CastShadow', true); P.set('Locked', false); P.set('Massless', false);
    P.set('AssemblyLinearVelocity', new Vector3()); P.set('AssemblyAngularVelocity', new Vector3()); if (c === 'Part' || c === 'SpawnLocation' || c === 'Seat') P.set('Shape', enumItem('PartType', 'Block')); }
  if (c === 'Model') { P.set('PrimaryPart', undefined); }
  if (c === 'Humanoid') { P.set('Health', 100); P.set('MaxHealth', 100); P.set('WalkSpeed', 16); P.set('JumpPower', 50); P.set('JumpHeight', 7.2); P.set('UseJumpPower', true); P.set('HipHeight', 2); P.set('DisplayName', ''); }
  if (/Value$/.test(c)) P.set('Value', c === 'StringValue' ? '' : c === 'BoolValue' ? false : c === 'ObjectValue' ? undefined : c === 'Vector3Value' ? new Vector3() : c === 'CFrameValue' ? new CFrame() : c === 'Color3Value' ? new Color3() : 0);
  if (isA(c, 'GuiObject')) { P.set('Visible', true); P.set('Size', UDim2(0, 100, 0, 100)); P.set('Position', UDim2(0, 0, 0, 0)); P.set('BackgroundTransparency', 0); P.set('BackgroundColor3', new Color3(163 / 255, 162 / 255, 165 / 255)); P.set('ZIndex', 1); P.set('LayoutOrder', 0); P.set('AnchorPoint', new Vector2()); P.set('Rotation', 0); P.set('BorderSizePixel', 1); P.set('ClipsDescendants', false); P.set('Active', false); P.set('SizeConstraint', enumItem('SizeConstraint', 'RelativeXY')); P.set('AutomaticSize', enumItem('AutomaticSize', 'None')); P.set('BorderColor3', new Color3(27 / 255, 42 / 255, 53 / 255));
    if (/^Text/.test(c)) { P.set('Text', c === 'TextLabel' ? 'Label' : c === 'TextButton' ? 'Button' : ''); P.set('TextColor3', new Color3(0, 0, 0)); P.set('TextSize', 14); P.set('TextScaled', false); P.set('TextWrapped', false); P.set('TextTransparency', 0); P.set('TextStrokeTransparency', 1); P.set('TextStrokeColor3', new Color3()); P.set('Font', enumItem('Font', 'Legacy')); P.set('TextXAlignment', enumItem('TextXAlignment', 'Center')); P.set('TextYAlignment', enumItem('TextYAlignment', 'Center')); P.set('RichText', false); P.set('LineHeight', 1); P.set('MaxVisibleGraphemes', -1); }
    if (/^Image/.test(c)) { P.set('Image', ''); P.set('ImageColor3', new Color3(1, 1, 1)); P.set('ImageTransparency', 0); P.set('ScaleType', enumItem('ScaleType', 'Stretch')); P.set('ImageRectOffset', new Vector2()); P.set('ImageRectSize', new Vector2()); }
    if (/Button$/.test(c)) { P.set('AutoButtonColor', true); P.set('Selectable', true); }
    if (c === 'ScrollingFrame') { P.set('CanvasSize', UDim2(0, 0, 2, 0)); P.set('CanvasPosition', new Vector2()); P.set('ScrollBarThickness', 12); P.set('ScrollingEnabled', true); P.set('ScrollingDirection', enumItem('ScrollingDirection', 'XY')); P.set('AutomaticCanvasSize', enumItem('AutomaticSize', 'None')); } }
  if (c === 'ScreenGui') { P.set('DisplayOrder', 0); P.set('IgnoreGuiInset', false); P.set('ResetOnSpawn', true); }
  if (c === 'BillboardGui') { P.set('Size', UDim2(0, 0, 0, 0)); P.set('StudsOffset', new Vector3()); P.set('StudsOffsetWorldSpace', new Vector3()); P.set('AlwaysOnTop', false); P.set('MaxDistance', Infinity); P.set('LightInfluence', 0); P.set('Adornee', undefined); P.set('ExtentsOffset', new Vector3()); P.set('SizeOffset', new Vector2()); }
  if (c === 'SurfaceGui') { P.set('Face', enumItem('NormalId', 'Front')); P.set('CanvasSize', new Vector2(800, 600)); P.set('PixelsPerStud', 50); P.set('SizingMode', enumItem('SurfaceGuiSizingMode', 'FixedSize')); P.set('Adornee', undefined); P.set('AlwaysOnTop', false); }
  if (c === 'UIScale') P.set('Scale', 1);
  if (c === 'UICorner') P.set('CornerRadius', new Simple('UDim', { Scale: 0, Offset: 8 }));
  if (c === 'UIStroke') { P.set('Thickness', 1); P.set('Color', new Color3()); P.set('Transparency', 0); P.set('Enabled', true); P.set('ApplyStrokeMode', enumItem('ApplyStrokeMode', 'Contextual')); }
  if (c === 'UIGradient') { P.set('Rotation', 0); P.set('Offset', new Vector2()); P.set('Enabled', true); P.set('Color', new Simple('ColorSequence', { Keypoints: LuaTable.from([new Simple('ColorSequenceKeypoint', { Time: 0, Value: new Color3(1, 1, 1) }), new Simple('ColorSequenceKeypoint', { Time: 1, Value: new Color3(1, 1, 1) })]) })); }
  if (c === 'Attachment') { P.set('CFrame', new CFrame()); }
  if (c === 'Motor6D' || c === 'Weld' || c === 'ManualWeld') { P.set('C0', new CFrame()); P.set('C1', new CFrame()); P.set('Enabled', true); if (c === 'Motor6D') P.set('Transform', new CFrame()); }
  if (c === 'WeldConstraint') P.set('Enabled', true);
  if (/Light$/.test(c)) { P.set('Brightness', 1); P.set('Range', c === 'SurfaceLight' ? 16 : 8); P.set('Color', new Color3(1, 1, 1)); P.set('Enabled', true); P.set('Shadows', false); }
  if (c === 'ProximityPrompt') { P.set('ActionText', 'Interact'); P.set('ObjectText', ''); P.set('HoldDuration', 0); P.set('MaxActivationDistance', 10); P.set('Enabled', true); P.set('RequiresLineOfSight', true); P.set('KeyboardKeyCode', enumItem('KeyCode', 'E')); P.set('UIOffset', new Vector2()); P.set('Exclusivity', enumItem('ProximityPromptExclusivity', 'OnePerButton')); }
  if (isA(c, 'LayerCollector')) P.set('Enabled', true);
  if (c === 'Lighting') { P.set('ClockTime', 14); P.set('Brightness', 2); P.set('Ambient', new Color3(0.27, 0.27, 0.27)); P.set('OutdoorAmbient', new Color3(0.5, 0.5, 0.5)); P.set('FogEnd', 100000); P.set('FogStart', 0); P.set('FogColor', new Color3(0.75, 0.75, 0.75)); P.set('ExposureCompensation', 0); P.set('GlobalShadows', true); P.set('TimeOfDay', '14:00:00'); }
  if (c === 'Sound') { P.set('Volume', 0.5); P.set('Playing', false); P.set('TimePosition', 0); P.set('IsPlaying', false); }
  if (c === 'Camera') { P.set('CFrame', new CFrame([0, 20, 20])); P.set('FieldOfView', 70); P.set('ViewportSize', new Vector2(1280, 720)); }
}
/* Position / Orientation / BrickColor / Color derived from the stored props */
function derived(o, k) {
  if (isA(o.cls, 'BasePart')) { const cf = o.props.get('CFrame');
    if (k === 'Position') return cf.get('Position'); if (k === 'Orientation' || k === 'Rotation') { const [x, y, z] = cf.toEulerYXZ(); return new Vector3(x / D2R, y / D2R, z / D2R); }
    if (k === 'BrickColor') return new BrickColor(nearestBrick(o.props.get('Color'))); if (k === 'Mass') { const s = o.props.get('Size'); return s.x * s.y * s.z * 0.7; } if (k === 'AssemblyMass') return derived(o, 'Mass'); if (k === 'ExtentsCFrame' || k === 'PivotOffset') return k === 'PivotOffset' ? new CFrame() : cf; }
  if (k === 'WorldPivot' && o.cls === 'Model') return o.pivot();
  if (o.cls === 'Attachment' || o.cls === 'Bone') { const cf = o.props.get('CFrame') || new CFrame(), par = o.parent && o.parent.props && o.parent.props.get('CFrame');
    if (k === 'Position') return cf.get('Position'); if (k === 'WorldPosition') return par ? par.pointToWorld(cf.get('Position')) : cf.get('Position'); if (k === 'WorldCFrame') return par ? par.mulCF(cf) : cf;
    if (k === 'Axis') return cf.get('RightVector'); if (k === 'SecondaryAxis') return cf.get('UpVector'); if (k === 'Orientation') { const [x, y, z] = cf.toEulerYXZ(); return new Vector3(x / D2R, y / D2R, z / D2R); } if (k === 'WorldAxis') return par ? par.vecToWorld(cf.get('RightVector')) : cf.get('RightVector'); }
  if (isA(o.cls, 'GuiBase2d')) { if (k === 'AbsoluteSize' || k === 'AbsolutePosition' || k === 'AbsoluteRotation' || k === 'AbsoluteCanvasSize' || k === 'AbsoluteWindowSize') { const a = guiAbs(o); return k === 'AbsoluteRotation' ? 0 : k === 'AbsolutePosition' ? new Vector2(a[0], a[1]) : new Vector2(a[2], a[3]); }
    if (k === 'TextBounds') { const t = String(o.props.get('Text') || ''), sz = o.props.get('TextSize') || 14; return new Vector2(t.length * sz * 0.55, sz); } if (k === 'TextFits') return true; if (k === 'GuiState') return enumItem('GuiState', 'Idle'); if (k === 'IsLoaded') return true; if (k === 'ContentText') return String(o.props.get('Text') || '').replace(/<[^>]+>/g, ''); }
  return undefined;
}
/* absolute position / size of a GUI object: the DOM measures it when it is on screen, otherwise UDim2 math */
function guiAbs(o) {
  if (o.rt.guiMeasure) { const m = o.rt.guiMeasure(o); if (m) return m; }
  if (o.cls === 'ScreenGui' || o.cls === 'PlayerGui') { const w = o.rt.viewW || 390, h = o.rt.viewH || 844, inset = o.props.get('IgnoreGuiInset') ? 0 : 58; return [0, inset, w, h - inset]; }
  if (o.cls === 'BillboardGui' || o.cls === 'SurfaceGui') { const s = o.props.get('Size'), cs = o.props.get('CanvasSize'); if (o.cls === 'SurfaceGui') return [0, 0, cs ? cs.x : 800, cs ? cs.y : 600]; return [0, 0, s ? s.f.X.f.Offset + s.f.X.f.Scale * 50 : 100, s ? s.f.Y.f.Offset + s.f.Y.f.Scale * 50 : 50]; }
  const par = o.parent && isA(o.parent.cls, 'GuiBase2d') ? guiAbs(o.parent) : [0, 0, o.rt.viewW || 390, o.rt.viewH || 844];
  const S = o.props.get('Size'), Pp = o.props.get('Position'), A = o.props.get('AnchorPoint') || new Vector2();
  let w = S ? S.f.X.f.Scale * par[2] + S.f.X.f.Offset : 100, h = S ? S.f.Y.f.Scale * par[3] + S.f.Y.f.Offset : 100;
  const ar = o.kids.find((c) => c.cls === 'UIAspectRatioConstraint'); if (ar) { const r = ar.props.get('AspectRatio') || 1; if (w / h > r) w = h * r; else h = w / r; }
  let sc = 1; let q = o; while (q && isA(q.cls, 'GuiBase2d')) { const u = q.kids.find((c) => c.cls === 'UIScale'); if (u) sc *= u.props.get('Scale') ?? 1; q = q.parent; } w *= sc; h *= sc;
  const x = par[0] + (Pp ? Pp.f.X.f.Scale * par[2] + Pp.f.X.f.Offset * sc : 0) - A.x * w, y = par[1] + (Pp ? Pp.f.Y.f.Scale * par[3] + Pp.f.Y.f.Offset * sc : 0) - A.y * h;
  return [x, y, w, h];
}
function derive(o, k, v) { return v; }
function setDerived(o, k, v) {
  if (isA(o.cls, 'BasePart')) {
    if (k === 'Position') { const cf = o.props.get('CFrame'); o.props.set('CFrame', new CFrame([v.x, v.y, v.z], cf.r)); o.changed('CFrame'); return true; }
    if (k === 'Orientation' || k === 'Rotation') { const cf = o.props.get('CFrame'), r = mul3(mul3(ry(v.y * D2R), rx(v.x * D2R)), rz(v.z * D2R)); o.props.set('CFrame', new CFrame(cf.p, r)); o.changed('CFrame'); return true; }
    if (k === 'BrickColor') { o.props.set('Color', v.get('Color')); o.changed('Color'); return true; }
    if (k === 'Size' && v instanceof Vector3) { o.props.set('Size', new Vector3(Math.max(0.001, Math.min(2048, v.x)), Math.max(0.001, Math.min(2048, v.y)), Math.max(0.001, Math.min(2048, v.z)))); return true; }
  }
  if (o.cls === 'Model' && k === 'WorldPivot') { o.props.set('WorldPivot', v); return true; }
  if (o.cls === 'Lighting' && k === 'TimeOfDay') { const m = String(v).match(/^(\d+):(\d+)/); if (m) o.props.set('ClockTime', +m[1] + +m[2] / 60); o.props.set('TimeOfDay', v); return true; }
  return false;
}
const self = (a, name) => { if (!(a[0] instanceof Instance)) err(`Expected ':' not '.' calling member function ${name}`); return a[0]; };
Object.assign(Instance.methods, {
  IsA: fn((a) => [isA(self(a, 'IsA').cls, a[1])]), isA: fn((a) => [isA(a[0].cls, a[1])]),
  FindFirstChild: fn((a) => { const o = self(a, 'FindFirstChild'); if (isTruthy(a[2])) return [o.descendants().find((d) => d.props.get('Name') === a[1])]; return [o.child(a[1])]; }),
  findFirstChild: fn((a) => Instance.methods.FindFirstChild(a)),
  FindFirstChildOfClass: fn((a) => [self(a, 'FindFirstChildOfClass').kids.find((c) => c.cls === a[1])]),
  FindFirstChildWhichIsA: fn((a) => { const o = self(a, 'FindFirstChildWhichIsA'); const l = isTruthy(a[2]) ? o.descendants() : o.kids; return [l.find((c) => isA(c.cls, a[1]))]; }),
  FindFirstAncestor: fn((a) => { let p = self(a, 'FindFirstAncestor').parent; while (p && p.props.get('Name') !== a[1]) p = p.parent; return [p ?? undefined]; }),
  FindFirstAncestorOfClass: fn((a) => { let p = a[0].parent; while (p && p.cls !== a[1]) p = p.parent; return [p ?? undefined]; }),
  FindFirstAncestorWhichIsA: fn((a) => { let p = a[0].parent; while (p && !isA(p.cls, a[1])) p = p.parent; return [p ?? undefined]; }),
  FindFirstDescendant: fn((a) => [a[0].descendants().find((d) => d.props.get('Name') === a[1])]),
  WaitForChild: fn((a) => { const o = self(a, 'WaitForChild'); const c = o.child(a[1]); if (c) return [c]; return [o.rt.waitForChild ? o.rt.waitForChild(o, a[1]) : undefined]; }),
  GetChildren: fn((a) => [LuaTable.from(self(a, 'GetChildren').kids.slice())]), getChildren: fn((a) => [LuaTable.from(a[0].kids.slice())]), children: fn((a) => [LuaTable.from(a[0].kids.slice())]),
  GetDescendants: fn((a) => [LuaTable.from(self(a, 'GetDescendants').descendants())]),
  IsDescendantOf: fn((a) => { let p = a[0].parent; while (p) { if (p === a[1]) return [true]; p = p.parent; } return [false]; }),
  IsAncestorOf: fn((a) => { let p = a[1] && a[1].parent; while (p) { if (p === a[0]) return [true]; p = p.parent; } return [false]; }),
  GetFullName: fn((a) => { const n = []; let o = a[0]; while (o && o.cls !== 'DataModel') { n.unshift(o.props.get('Name')); o = o.parent; } return [n.join('.')]; }),
  Destroy: fn((a) => { const o = self(a, 'Destroy'); const kill = (x) => { x.sigs.get('Destroying')?.fire([]); for (const c of x.kids.slice()) kill(c); x.setParent(null); x.destroyed = true; for (const s of x.sigs.values()) s.conns = []; }; kill(o); return []; }),
  Remove: fn((a) => { a[0].setParent(null); return []; }), remove: fn((a) => { a[0].setParent(null); return []; }),
  ClearAllChildren: fn((a) => { for (const c of a[0].kids.slice()) Instance.methods.Destroy([c]); return []; }),
  Clone: fn((a) => [self(a, 'Clone').clone()]), clone: fn((a) => [a[0].clone()]),
  SetAttribute: fn((a) => { const o = self(a, 'SetAttribute'); if (a[2] === undefined) o.attrs.delete(a[1]); else o.attrs.set(a[1], a[2]); o.sigs.get('AttributeChanged')?.fire([a[1]]); o.sigs.get('Attr:' + a[1])?.fire([]); return []; }),
  GetAttribute: fn((a) => [self(a, 'GetAttribute').attrs.get(a[1])]),
  GetAttributes: fn((a) => [LuaTable.from(Object.fromEntries(a[0].attrs))]),
  GetAttributeChangedSignal: fn((a) => [a[0].sig('Attr:' + a[1])]), GetPropertyChangedSignal: fn((a) => [a[0].sig('Prop:' + a[1])]),
  AddTag: fn((a) => { a[0].tags.add(a[1]); a[0].rt.tagAdded?.(a[0], a[1]); return []; }), RemoveTag: fn((a) => { a[0].tags.delete(a[1]); return []; }), HasTag: fn((a) => [a[0].tags.has(a[1])]), GetTags: fn((a) => [LuaTable.from([...a[0].tags])]),
  GetPivot: fn((a) => [self(a, 'GetPivot').pivot()]), PivotTo: fn((a) => { self(a, 'PivotTo').pivotTo(a[1]); return []; }),
  SetPrimaryPartCFrame: fn((a) => { a[0].pivotTo(a[1]); return []; }), GetPrimaryPartCFrame: fn((a) => [a[0].pivot()]),
  MoveTo: fn((a) => { const o = a[0], cur = o.pivot(); o.pivotTo(new CFrame([a[1].x, a[1].y + (isA(o.cls, 'BasePart') ? 0 : 0), a[1].z], cur.r)); return []; }),
  TranslateBy: fn((a) => { const o = a[0], cur = o.pivot(); o.pivotTo(new CFrame([cur.p[0] + a[1].x, cur.p[1] + a[1].y, cur.p[2] + a[1].z], cur.r)); return []; }),
  ScaleTo: fn((a) => { const o = a[0], k = num(a[1], 1) / (o.scale || 1), piv = o.pivot(); for (const d of o.descendants()) if (isA(d.cls, 'BasePart')) { const s = d.props.get('Size'), cf = d.props.get('CFrame'); d.props.set('Size', new Vector3(s.x * k, s.y * k, s.z * k)); const rel = piv.inverse().mulCF(cf); d.props.set('CFrame', piv.mulCF(new CFrame(rel.p.map((v) => v * k), rel.r))); } o.scale = num(a[1], 1); return []; }),
  GetScale: fn((a) => [a[0].scale || 1]),
  GetBoundingBox: fn((a) => { const parts = isA(a[0].cls, 'BasePart') ? [a[0]] : a[0].descendants().filter((d) => isA(d.cls, 'BasePart')); if (!parts.length) return [new CFrame(), new Vector3()]; const b = bounds(parts); return [new CFrame([(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]), new Vector3(b[3] - b[0], b[4] - b[1], b[5] - b[2])]; }),
  GetExtentsSize: fn((a) => [Instance.methods.GetBoundingBox(a)[1]]),
  GetConnectedParts: fn(() => [new LuaTable()]), GetTouchingParts: fn(() => [new LuaTable()]), BreakJoints: fn(() => []), MakeJoints: fn(() => []),
  SetNetworkOwner: fn(() => []), GetNetworkOwner: fn(() => []), SetNetworkOwnershipAuto: fn(() => []), CanSetNetworkOwnership: fn(() => [true]), GetMass: fn((a) => [derived(a[0], 'Mass') || 1]),
  ApplyImpulse: fn(() => []), ApplyAngularImpulse: fn(() => []), ApplyImpulseAtPosition: fn(() => []), GetVelocityAtPosition: fn(() => [new Vector3()]), GetRootPart: fn((a) => [a[0]]),
  GetActor: fn(() => []), GetDebugId: fn((a) => [String(a[0].id)]), GetStyled: fn(() => []),
});
Instance.EVENTS = EVENTS;

/* ---------------------------------------------------------------- runtime: globals, services, require, task */
export class Runtime {
  constructor(interp, G, io = {}) {
    this.I = interp; this.G = G; this.io = io; this.classMethods = {}; this.threads = new Set(); this.now = 0; this.modules = new Map(); this.errors = [];
    interp.onDetach = (it, y) => this.adopt(it, y); Signal.spawn = (f, args) => this.spawn(f, args); Signal.wake = (th, args) => this.resume(th, args);
    this.game = new Instance('DataModel', this); this.game.props.set('Name', 'Game'); this.services = new Map();
    this.workspace = this.service('Workspace'); this.workspace.props.set('Gravity', 196.2); this.workspace.props.set('CurrentCamera', undefined);
    const cam = new Instance('Camera', this); cam.props.set('Name', 'Camera'); cam.setParent(this.workspace); this.workspace.props.set('CurrentCamera', cam);
    this.install();
  }
  service(name) {
    if (this.services.has(name)) return this.services.get(name);
    const s = new Instance(name, this); s.props.set('Name', name); s.isService = true; s.setParent(this.game); this.services.set(name, s); return s;
  }
  install() {
    const G = this.G, rt = this, set = (k, v) => G.set(k, v), lib = (o) => LuaTable.from(o);
    set('game', this.game); set('Game', this.game); set('workspace', this.workspace); set('Workspace', this.workspace);
    set('Vector3', lib({ new: fn((a) => [new Vector3(num(a[0]), num(a[1]), num(a[2]))]), zero: new Vector3(), one: new Vector3(1, 1, 1), xAxis: new Vector3(1, 0, 0), yAxis: new Vector3(0, 1, 0), zAxis: new Vector3(0, 0, 1),
      fromNormalId: fn((a) => [new Vector3(...({ Right: [1, 0, 0], Left: [-1, 0, 0], Top: [0, 1, 0], Bottom: [0, -1, 0], Back: [0, 0, 1], Front: [0, 0, -1] }[a[0] && a[0].name] || [0, 0, 0]))]), fromAxis: fn(() => [new Vector3(1, 0, 0)]) }));
    set('Vector2', lib({ new: fn((a) => [new Vector2(num(a[0]), num(a[1]))]), zero: new Vector2(), one: new Vector2(1, 1), xAxis: new Vector2(1, 0), yAxis: new Vector2(0, 1) }));
    set('Vector3int16', lib({ new: fn((a) => [new Vector3(num(a[0]), num(a[1]), num(a[2]))]) })); set('Vector2int16', lib({ new: fn((a) => [new Vector2(num(a[0]), num(a[1]))]) }));
    set('CFrame', lib(CFrameLib));
    set('Color3', lib({ new: fn((a) => [new Color3(num(a[0]), num(a[1]), num(a[2]))]), fromRGB: fn((a) => [new Color3(num(a[0]) / 255, num(a[1]) / 255, num(a[2]) / 255)]), fromHSV: fn((a) => [new Color3(...hsv2rgb(num(a[0]), num(a[1]), num(a[2])))]), toHSV: fn((a) => rgb2hsv(a[0].r, a[0].g, a[0].b)),
      fromHex: fn((a) => { const h = String(a[0]).replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16); return [new Color3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)]; }) }));
    set('BrickColor', lib({ new: fn((a) => [new BrickColor(typeof a[0] === 'number' ? BRICK_NUM[a[0]] : a[0] instanceof Color3 ? nearestBrick(a[0]) : a[0])]), palette: fn(() => [new BrickColor('Medium stone grey')]), random: fn(() => [new BrickColor('Bright red')]),
      White: fn(() => [new BrickColor('White')]), Black: fn(() => [new BrickColor('Black')]), Red: fn(() => [new BrickColor('Bright red')]), Green: fn(() => [new BrickColor('Bright green')]), Blue: fn(() => [new BrickColor('Bright blue')]), Yellow: fn(() => [new BrickColor('Bright yellow')]), Gray: fn(() => [new BrickColor('Medium stone grey')]), DarkGray: fn(() => [new BrickColor('Dark stone grey')]) }));
    set('UDim', lib({ new: fn((a) => [UDim(a[0], a[1])]) }));
    set('UDim2', lib({ new: fn((a) => [a[0] instanceof Simple ? UDim2(a[0].f.Scale, a[0].f.Offset, a[1].f.Scale, a[1].f.Offset) : UDim2(a[0], a[1], a[2], a[3])]), fromScale: fn((a) => [UDim2(a[0], 0, a[1], 0)]), fromOffset: fn((a) => [UDim2(0, a[0], 0, a[1])]) }));
    set('NumberRange', lib({ new: fn((a) => [NumberRange(a[0], a[1])]) }));
    set('NumberSequence', lib({ new: fn((a) => [Sequence('NumberSequence', a)]) })); set('ColorSequence', lib({ new: fn((a) => [Sequence('ColorSequence', a)]) }));
    set('NumberSequenceKeypoint', lib({ new: fn((a) => [Keypoint(a[0], a[1], a[2])]) })); set('ColorSequenceKeypoint', lib({ new: fn((a) => [Keypoint(a[0], a[1])]) }));
    set('TweenInfo', lib({ new: fn((a) => [new Simple('TweenInfo', { Time: num(a[0], 1), EasingStyle: a[1], EasingDirection: a[2], RepeatCount: num(a[3]), Reverses: !!a[4], DelayTime: num(a[5]) })]) }));
    set('PhysicalProperties', lib({ new: fn((a) => [new Simple('PhysicalProperties', { Density: num(a[0], 0.7), Friction: num(a[1], 0.3), Elasticity: num(a[2], 0.5) })]) }));
    set('Ray', lib({ new: fn((a) => [new Simple('Ray', { Origin: a[0], Direction: a[1] })]) }));
    set('Rect', lib({ new: fn((a) => [new Simple('Rect', { Min: new Vector2(num(a[0]), num(a[1])), Max: new Vector2(num(a[2]), num(a[3])) })]) }));
    set('Region3', lib({ new: fn((a) => [new Simple('Region3', { CFrame: new CFrame([(a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2, (a[0].z + a[1].z) / 2]), Size: a[1].$op('-', a[0]) })]) }));
    set('Font', lib({ new: fn((a) => [new Simple('Font', { Family: a[0], Weight: a[1], Style: a[2] })]), fromEnum: fn((a) => [new Simple('Font', { Family: a[0] && a[0].name, Weight: undefined, Style: undefined })]), fromName: fn((a) => [new Simple('Font', { Family: a[0] })]) }));
    set('DateTime', lib({ now: fn(() => [new Simple('DateTime', { UnixTimestamp: Math.floor(Date.now() / 1000), UnixTimestampMillis: Date.now() })]) }));
    set('RaycastParams', lib({ new: fn(() => [new Bag('RaycastParams', { FilterDescendantsInstances: new LuaTable(), FilterType: enumItem('RaycastFilterType', 'Exclude'), IgnoreWater: false, CollisionGroup: 'Default', RespectCanCollide: false })]) }));
    set('OverlapParams', lib({ new: fn(() => [new Bag('OverlapParams', { FilterDescendantsInstances: new LuaTable(), FilterType: enumItem('RaycastFilterType', 'Exclude'), MaxParts: 0 })]) }));
    set('Random', lib({ new: fn((a) => [new RandomGen(a[0])]) }));
    set('Enum', EnumRoot);
    set('Instance', lib({ new: fn((a) => { const o = new Instance(String(a[0]), rt); if (a[1]) o.setParent(a[1]); return [o]; }), fromExisting: fn((a) => [a[0].clone()]) }));
    set('SharedTable', lib({ new: fn(() => [new LuaTable()]) }));
    set('require', fn((a) => rt.require(a[0])));
    set('tick', fn(() => [Date.now() / 1000])); set('time', fn(() => [rt.now])); set('elapsedTime', fn(() => [rt.now]));
    const waitY = { ygen: function* (a) { const r = yield { wait: num(a[0], 0) }; return r || [num(a[0], 0), rt.now]; } };
    set('wait', Object.assign(fn((a) => [num(a[0], 0.03), rt.now]), waitY));
    set('delay', fn((a) => { rt.start(a[1], [], num(a[0])); return []; })); set('spawn', fn((a) => { rt.start(a[0], [], 0); return []; }));
    set('settings', fn(() => [new Bag('Settings', {})])); set('UserSettings', fn(() => [new Bag('UserSettings', {})])); set('version', fn(() => ['0.650.0'])); set('printidentity', fn(() => []));
    set('task', lib({
      spawn: fn((a) => { if (a[0] instanceof Thread) { rt.resume(a[0], a.slice(1)); return [a[0]]; } return [rt.spawn(a[0], a.slice(1))]; }),
      defer: fn((a) => [rt.start(a[0], a.slice(1), 0)]),
      delay: fn((a) => [rt.start(a[1], a.slice(2), num(a[0]))]),
      wait: Object.assign(fn((a) => [num(a[0], 0)]), waitY),
      cancel: fn((a) => { if (a[0] instanceof Thread) { a[0].cancelled = true; rt.threads.delete(a[0]); } return []; }), synchronize: fn(() => []), desynchronize: fn(() => []),
    }));
    const coResume = (th, args) => { if (th.done) return [false, 'cannot resume dead coroutine']; th.resumer = true; th.coyielded = null;
      rt.resume(th, th.it ? args : undefined); if (!th.it) { /* never started */ }
      if (th.error) { const e = th.error; th.error = null; return [false, e instanceof LuaError ? e.value : String(e)]; }
      if (th.done) return [true, ...(th.result || [])]; if (th.coyielded) return [true, ...th.coyielded]; return [true]; };
    set('coroutine', lib({
      create: fn((a) => { const th = new Thread(); th.f = a[0]; th.args = []; th.it = null; return [th]; }), running: fn(() => [rt.current || new Thread()]), isyieldable: fn(() => [!!rt.current]),
      status: fn((a) => [a[0].done ? 'dead' : a[0] === rt.current ? 'running' : 'suspended']),
      resume: fn((a) => { const th = a[0]; if (!th.it) th.args = a.slice(1); return coResume(th, a.slice(1)); }),
      wrap: fn((a) => { const th = new Thread(); th.f = a[0]; th.it = null; return [fn((b) => { if (!th.it) th.args = b; const r = coResume(th, b); if (!r[0]) throw new LuaError(r[1]); return r.slice(1); })]; }),
      yield: Object.assign(fn(() => []), { ygen: function* (a) { const r = yield { coyield: a }; return r || []; } }),
      close: fn((a) => { a[0].done = true; rt.threads.delete(a[0]); return [true]; }),
    }));
  }
  /* ---- scheduler: Luau threads are generators; task.wait / Signal:Wait / coroutine.yield suspend them ---- */
  spawn(f, args) { const th = new Thread(); th.side = (f && f.side) || this.I.side; th.it = null; th.f = f; th.args = args; this.resume(th, undefined); return th; }
  start(f, args, delay = 0, th = new Thread()) { th.it = null; th.f = f; th.args = args; th.side = (f && f.side) || this.I.side; th.wakeAt = this.now + Math.max(0, delay); this.threads.add(th); return th; }
  adopt(it, y) { const th = new Thread(); th.it = it; th.side = this.I.side; this.park(th, y); return th; }
  park(th, y) {
    if (y && y.wait !== undefined) { th.wakeAt = this.now + Math.max(1 / 60, +y.wait || 0); th.waitStart = this.now; this.threads.add(th); }
    else if (y && y.waitSignal) { const s = y.waitSignal; (s.waiters ||= []).push(th); th.wakeAt = Infinity; }
    else if (y && y.coyield) { th.coyielded = y.coyield; if (th.resumer) return; th.wakeAt = this.now + 1 / 60; this.threads.add(th); }
    else { th.wakeAt = this.now + 1 / 60; this.threads.add(th); }
  }
  resume(th, val) {
    if (th.cancelled || th.done) return; this.threads.delete(th); this.I.steps = 0; const prevTh = this.current, prevSide = this.I.side; this.current = th; if (th.side) this.I.side = th.side;
    try { if (!th.it) th.it = callGen(th.f, th.args || []); const r = th.it.next(val); if (r.done) { th.done = true; th.result = r.value; } else this.park(th, r.value); }
    catch (e) { th.done = true; th.error = e; if (!th.resumer) this.report(e); }
    finally { this.current = prevTh; this.I.side = prevSide; }
  }
  step(dt) { this.now += dt; for (const th of [...this.threads]) if (th.wakeAt <= this.now) this.resume(th, th.waitStart !== undefined ? [this.now - th.waitStart, this.now] : []); }
  report(e) { const m = e instanceof LuaError ? tostr(e.value) : String(e && e.stack || e); this.errors.push(m); (this.io.warn || console.warn)(m); }
  require(mod) {
    if (!(mod instanceof Instance)) { if (typeof mod === 'number') err('require(assetId) is not supported here'); err('Attempted to call require with invalid argument(s).'); }
    const side = this.I.side, key = side + ':' + mod.id; // server and client each get their own copy, like Roblox
    if (this.modules.has(key)) { const m = this.modules.get(key); if (m.loading) err('Requested module was required recursively'); return [m.value]; }
    const entry = { loading: true }; this.modules.set(key, entry);
    try { const r = this.runScript(mod, true); entry.value = r[0]; } catch (e) { this.modules.delete(key); throw e; } finally { entry.loading = false; }
    return [entry.value];
  }
  parseScript(scr) { if (!scr.ast) scr.ast = this.io.parse(scr.source || '', Instance.methods.GetFullName([scr])[0]); return scr.ast; }
  runScript(scr, isModule = false) {
    const full = Instance.methods.GetFullName([scr])[0], fnc = this.I.load(this.parseScript(scr), full, { script: scr });
    const res = fnc([]);
    if (isModule && res.length === 0) err(`Module code did not return exactly one value (${scr.props.get('Name')})`);
    return res;
  }
}
class Thread extends UD { get $type() { return 'thread'; } get $thread() { return true; } }
class Bag extends UD { constructor(t, f) { super(); this.t = t; this.f = f; } get $type() { return this.t; } $index(k) { return this.f[k]; } $newindex(k, v) { this.f[k] = v; } static methods = {} }
Bag.prototype.$index = function (k) { if (k === 'AddToFilter') return fn((a) => { const l = this.f.FilterDescendantsInstances; l.set(l.length() + 1, a[1]); return []; }); return this.f[k]; };
export { BrickColor, Simple, UDim2, EnumItem, isA, typeOf, bounds };
