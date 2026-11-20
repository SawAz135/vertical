/* =====================================================================
   Roblox Forge · Jouer — Roblox place / model reader.
   Reads the files Roblox Studio saves, in the browser, with no server:
   - binary .rbxl / .rbxm: header, then INST / PROP / PRNT / SSTR chunks,
     each LZ4 or zstd compressed; values are byte-interleaved, integers
     zig-zag encoded, floats in Roblox's rotated layout, CFrames with the
     24 "special" axis-aligned rotations;
   - XML .rbxlx / .rbxmx.
   The instances become a Forge map: every BasePart (Part, Wedge, Corner
   wedge, Truss, Spawn, Seat, MeshPart / Union as their bounding box) with
   its Size, CFrame, Color, Material, Transparency, CanCollide, Shape and
   attributes (Forge roles work), Lighting (ClockTime, Brightness,
   Ambient…), and the Forge game config (ReplicatedStorage.ForgeGame.Config)
   when the place was made with Roblox Forge.
   Luau scripts are not run: only the Forge rules are played.
   ===================================================================== */
import { decompress as zstd } from './vendor/fzstd.js?v=9';

const dec = new TextDecoder();

/* ---------- LZ4 block ---------- */
function lz4(src, outLen) {
  const out = new Uint8Array(outLen); let i = 0, o = 0;
  while (i < src.length) {
    const tok = src[i++]; let lit = tok >> 4;
    if (lit === 15) { let b; do { b = src[i++]; lit += b; } while (b === 255); }
    out.set(src.subarray(i, i + lit), o); i += lit; o += lit; if (i >= src.length) break;
    const off = src[i] | (src[i + 1] << 8); i += 2; let ml = tok & 15;
    if (ml === 15) { let b; do { b = src[i++]; ml += b; } while (b === 255); } ml += 4;
    for (let k = 0; k < ml; k++) { out[o] = out[o - off]; o++; }
  }
  return out;
}

/* ---------- byte reader ---------- */
class R {
  constructor(u8) { this.u = u8; this.d = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); this.p = 0; }
  u8() { return this.u[this.p++]; } u32() { const v = this.d.getUint32(this.p, true); this.p += 4; return v; } i32() { const v = this.d.getInt32(this.p, true); this.p += 4; return v; }
  f32() { const v = this.d.getFloat32(this.p, true); this.p += 4; return v; } f64() { const v = this.d.getFloat64(this.p, true); this.p += 8; return v; }
  bytes(n) { const b = this.u.subarray(this.p, this.p + n); this.p += n; return b; } str() { return dec.decode(this.bytes(this.u32())); }
  left() { return this.u.length - this.p; }
  // N values of `size` bytes stored byte-plane by byte-plane, big-endian
  inter(n, size = 4) { const b = this.bytes(n * size), out = new Uint32Array(n); for (let i = 0; i < n; i++) { let v = 0; for (let k = 0; k < size; k++) v = (v * 256) + b[k * n + i]; out[i] = v >>> 0; } return out; }
  ints(n) { return Array.from(this.inter(n), (u) => (u >>> 1) ^ -(u & 1)); }
  floats(n) { const u = this.inter(n), dv = new DataView(new ArrayBuffer(4)); return Array.from(u, (x) => { dv.setUint32(0, ((x >>> 1) | (x << 31)) >>> 0); return dv.getFloat32(0); }); }
  refs(n) { const v = this.ints(n); for (let i = 1; i < n; i++) v[i] += v[i - 1]; return v; }
}

/* the 24 axis-aligned rotations: id-1 = 6 * right normal + up normal (Right, Top, Back, Left, Bottom, Front) */
const NORM = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]];
function specialRot(id) { const x = NORM[Math.floor((id - 1) / 6)], y = NORM[(id - 1) % 6]; if (!x || !y) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]]; return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]; }

/* ---------- attributes (AttributesSerialize) ---------- */
export function readAttributes(u8) {
  const out = {}; if (!u8 || u8.length < 4) return out; const r = new R(u8);
  try { const n = r.u32();
    for (let i = 0; i < n; i++) { const k = r.str(), t = r.u8(); let v;
      switch (t) { case 0x02: v = r.str(); break; case 0x03: v = !!r.u8(); break; case 0x04: v = r.i32(); break; case 0x05: v = r.f32(); break; case 0x06: v = r.f64(); break;
        case 0x09: r.f32(); r.i32(); v = null; break; case 0x0A: r.f32(); r.i32(); r.f32(); r.i32(); v = null; break; case 0x0E: v = r.u32(); break;
        case 0x0F: { const c = [r.f32(), r.f32(), r.f32()]; v = '#' + c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join(''); break; }
        case 0x10: v = [r.f32(), r.f32()]; break; case 0x11: v = [r.f32(), r.f32(), r.f32()]; break;
        case 0x14: { r.f32(); r.f32(); r.f32(); const id = r.u8(); if (id === 0) for (let k = 0; k < 9; k++) r.f32(); v = null; break; }
        case 0x15: r.str(); r.u32(); v = null; break;
        case 0x17: { const c = r.u32(); r.bytes(c * 12); v = null; break; } case 0x19: { const c = r.u32(); r.bytes(c * 20); v = null; break; }
        case 0x1B: v = [r.f32(), r.f32()]; break; case 0x1C: r.bytes(16); v = null; break;
        case 0x21: { r.bytes(3); r.str(); r.str(); v = null; break; }
        default: return out; } // unknown type: its size is unknown, stop here
      out[k] = v; } } catch {}
  return out;
}

/* =====================================================================
   Binary format
   ===================================================================== */
export function readBinary(buf) {
  const u8 = new Uint8Array(buf), h = new R(u8);
  if (dec.decode(u8.subarray(0, 8)) !== '<roblox!' || u8[8] !== 0x89) throw new Error('fichier Roblox binaire invalide');
  h.p = 14; h.u16 = h.d.getUint16(h.p, true); h.p = 32;
  const classes = new Map(), inst = new Map(), shared = [];
  while (h.left() >= 16) {
    const name = dec.decode(h.bytes(4)).replace(/\0/g, ''), clen = h.u32(), ulen = h.u32(); h.u32();
    let data = h.bytes(clen || ulen);
    if (clen) data = data[0] === 0x28 && data[1] === 0xb5 && data[2] === 0x2f && data[3] === 0xfd ? zstd(data) : lz4(data, ulen);
    const r = new R(data);
    if (name === 'END') break;
    if (name === 'SSTR') { r.u32(); const n = r.u32(); for (let i = 0; i < n; i++) { r.bytes(16); shared.push(r.bytes(r.u32())); } }
    else if (name === 'INST') { const id = r.u32(), cls = r.str(); r.u8(); const n = r.u32(), refs = r.refs(n); classes.set(id, { cls, refs }); for (const ref of refs) inst.set(ref, { cls, ref, props: {}, children: [] }); }
    else if (name === 'PROP') { const c = classes.get(r.u32()); if (!c) continue; const prop = r.str(), t = r.u8(), n = c.refs.length; let vals = null;
      try { vals = readValues(r, t, n, shared); } catch { vals = null; }
      if (vals) c.refs.forEach((ref, i) => { inst.get(ref).props[prop] = vals[i]; }); }
    else if (name === 'PRNT') { r.u8(); const n = r.u32(), kids = r.refs(n), pars = r.refs(n);
      for (let i = 0; i < n; i++) { const k = inst.get(kids[i]), p = inst.get(pars[i]); if (k && p) { p.children.push(k); k.parent = p; } } }
  }
  return [...inst.values()].filter((x) => !x.parent);
}
function readValues(r, t, n, shared) {
  switch (t) {
    case 0x01: { const v = []; for (let i = 0; i < n; i++) v.push(r.bytes(r.u32())); return v; } // String / ProtectedString / BinaryString: raw bytes
    case 0x02: return Array.from(r.bytes(n), (b) => !!b);
    case 0x03: return r.ints(n);
    case 0x04: return r.floats(n);
    case 0x05: { const v = []; for (let i = 0; i < n; i++) v.push(r.f64()); return v; }
    case 0x0B: return Array.from(r.inter(n)).map((x) => ({ brick: x }));
    case 0x0C: { const a = r.floats(n), b = r.floats(n), c = r.floats(n); return a.map((x, i) => ({ rgb: [x, b[i], c[i]] })); }
    case 0x0E: { const a = r.floats(n), b = r.floats(n), c = r.floats(n); return a.map((x, i) => [x, b[i], c[i]]); }
    case 0x10: case 0x1E: { // CFrame (OptionalCFrame has the same layout plus a trailing bool array)
      const rots = []; for (let i = 0; i < n; i++) { const id = r.u8(); if (id === 0) { const m = []; for (let k = 0; k < 9; k++) m.push(r.f32()); rots.push(m); } else rots.push(specialRot(id)); }
      const x = r.floats(n), y = r.floats(n), z = r.floats(n); const v = rots.map((m, i) => ({ pos: [x[i], y[i], z[i]], rot: m })); if (t === 0x1E) r.bytes(n); return v; }
    case 0x12: return Array.from(r.inter(n));
    case 0x13: return r.refs(n).map((x) => (x === -1 ? null : { ref: x }));
    case 0x1A: { const a = r.bytes(n), b = r.bytes(n), c = r.bytes(n); return Array.from(a, (x, i) => ({ rgb8: [x, b[i], c[i]] })); }
    case 0x1C: return Array.from(r.inter(n), (i) => shared[i]);
    case 0x06: { const sc = r.floats(n), of = r.ints(n); return sc.map((x, i) => ({ udim: [x, of[i]] })); }
    case 0x07: { const xs = r.floats(n), ys = r.floats(n), xo = r.ints(n), yo = r.ints(n); return xs.map((x, i) => ({ udim2: [x, xo[i], ys[i], yo[i]] })); }
    case 0x08: { const v = []; for (let i = 0; i < n; i++) { const a = []; for (let k = 0; k < 6; k++) a.push(r.f32()); v.push({ ray: a }); } return v; }
    case 0x09: case 0x0A: return Array.from(r.bytes(n), (b) => ({ faces: b }));
    case 0x0D: { const x = r.floats(n), y = r.floats(n); return x.map((v, i) => ({ v2: [v, y[i]] })); }
    case 0x14: { const v = []; for (let i = 0; i < n; i++) { v.push([r.d.getInt16(r.p, true), r.d.getInt16(r.p + 2, true), r.d.getInt16(r.p + 4, true)]); r.p += 6; } return v; }
    case 0x15: { const v = []; for (let i = 0; i < n; i++) { const c = r.u32(), k = []; for (let j = 0; j < c; j++) k.push([r.f32(), r.f32(), r.f32()]); v.push({ nseq: k }); } return v; }
    case 0x16: { const v = []; for (let i = 0; i < n; i++) { const c = r.u32(), k = []; for (let j = 0; j < c; j++) k.push([r.f32(), r.f32(), r.f32(), r.f32(), r.f32()]); v.push({ cseq: k }); } return v; }
    case 0x17: { const v = []; for (let i = 0; i < n; i++) v.push({ nrange: [r.f32(), r.f32()] }); return v; }
    case 0x18: { const a = r.floats(n), b = r.floats(n), c = r.floats(n), d = r.floats(n); return a.map((x, i) => ({ rect: [x, b[i], c[i], d[i]] })); }
    case 0x1B: { const b = r.bytes(n * 8), out = []; for (let i = 0; i < n; i++) { let v = 0n; for (let k = 0; k < 8; k++) v = (v << 8n) | BigInt(b[k * n + i]); const z = (v >> 1n) ^ -(v & 1n); out.push(Number(z)); } return out; }
    case 0x20: { const v = []; for (let i = 0; i < n; i++) { const family = r.str(), weight = r.d.getUint16(r.p, true); r.p += 2; const style = r.u8(); r.str(); v.push({ font: { family, weight, style } }); } return v; }
    case 0x22: { // Content: a source type per value, then the URIs (and object / external refs, unused here)
      const types = r.ints(n), nu = r.u32(), uris = []; for (let i = 0; i < nu; i++) uris.push(r.str()); let u = 0; return types.map((t) => (t === 1 ? uris[u++] : null)); }
    default: return null;
  }
}

/* =====================================================================
   XML format
   ===================================================================== */
export function readXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml'); if (doc.querySelector('parsererror')) throw new Error('fichier Roblox XML invalide');
  const b64 = (s) => { try { const bin = atob(String(s).replace(/\s/g, '')), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; } catch { return new Uint8Array(); } };
  const shared = {}; doc.querySelectorAll('SharedStrings > SharedString').forEach((s) => (shared[s.getAttribute('md5')] = b64(s.textContent)));
  const num = (el, tag) => parseFloat(el.getElementsByTagName(tag)[0]?.textContent || '0');
  const item = (el) => { const o = { cls: el.getAttribute('class'), ref: el.getAttribute('referent'), props: {}, children: [] };
    const P = [...el.children].find((c) => c.tagName === 'Properties');
    if (P) for (const p of P.children) { const name = p.getAttribute('name'); if (!name) continue; const tag = p.tagName; let v;
      if (tag === 'Vector3') v = ['X', 'Y', 'Z'].map((k) => num(p, k));
      else if (tag === 'CoordinateFrame' || tag === 'OptionalCoordinateFrame') { const c = tag === 'OptionalCoordinateFrame' ? p.getElementsByTagName('CFrame')[0] || p : p; v = { pos: ['X', 'Y', 'Z'].map((k) => num(c, k)), rot: ['R00', 'R01', 'R02', 'R10', 'R11', 'R12', 'R20', 'R21', 'R22'].map((k) => num(c, k)) }; }
      else if (tag === 'Color3uint8') { const u = parseInt(p.textContent, 10) >>> 0; v = { rgb8: [(u >> 16) & 255, (u >> 8) & 255, u & 255] }; }
      else if (tag === 'Color3') v = { rgb: ['R', 'G', 'B'].map((k) => num(p, k)) };
      else if (tag === 'token' || tag === 'int' || tag === 'int64' || tag === 'BrickColor') v = tag === 'BrickColor' ? { brick: parseInt(p.textContent, 10) } : parseInt(p.textContent, 10);
      else if (tag === 'float' || tag === 'double') v = parseFloat(p.textContent);
      else if (tag === 'bool') v = p.textContent.trim() === 'true';
      else if (tag === 'BinaryString') v = b64(p.textContent);
      else if (tag === 'SharedString') v = shared[p.textContent.trim()] || new Uint8Array();
      else if (tag === 'string' || tag === 'ProtectedString') v = new TextEncoder().encode(p.textContent);
      else if (tag === 'Content' || tag === 'ContentId') { const u = p.getElementsByTagName('url')[0] || p.getElementsByTagName('uri')[0]; v = u ? u.textContent.trim() : p.getElementsByTagName('null')[0] ? null : p.textContent.trim(); }
      else if (tag === 'Vector2') v = { v2: ['X', 'Y'].map((k) => num(p, k)) };
      else if (tag === 'Vector3int16') v = ['X', 'Y', 'Z'].map((k) => num(p, k));
      else if (tag === 'UDim') v = { udim: [num(p, 'S'), num(p, 'O')] };
      else if (tag === 'UDim2') v = { udim2: [num(p, 'XS'), num(p, 'XO'), num(p, 'YS'), num(p, 'YO')] };
      else if (tag === 'Rect2D') { const mn = p.getElementsByTagName('min')[0], mx = p.getElementsByTagName('max')[0]; v = { rect: [mn ? num(mn, 'X') : 0, mn ? num(mn, 'Y') : 0, mx ? num(mx, 'X') : 0, mx ? num(mx, 'Y') : 0] }; }
      else if (tag === 'NumberRange') { const a = p.textContent.trim().split(/\s+/).map(Number); v = { nrange: [a[0] || 0, a[1] ?? a[0] ?? 0] }; }
      else if (tag === 'NumberSequence') { const a = p.textContent.trim().split(/\s+/).map(Number), k = []; for (let i = 0; i + 2 < a.length; i += 3) k.push([a[i], a[i + 1], a[i + 2]]); v = { nseq: k }; }
      else if (tag === 'ColorSequence') { const a = p.textContent.trim().split(/\s+/).map(Number), k = []; for (let i = 0; i + 4 < a.length; i += 5) k.push([a[i], a[i + 1], a[i + 2], a[i + 3], a[i + 4]]); v = { cseq: k }; }
      else if (tag === 'Ref') { const t = p.textContent.trim(); v = t && t !== 'null' ? { ref: t } : null; }
      else if (tag === 'Font') { const f = p.getElementsByTagName('Family')[0], w = p.getElementsByTagName('Weight')[0], st = p.getElementsByTagName('Style')[0]; const fu = f && (f.getElementsByTagName('url')[0] || f.getElementsByTagName('uri')[0]); v = { font: { family: fu ? fu.textContent.trim() : f ? f.textContent.trim() : '', weight: w ? parseInt(w.textContent, 10) : 400, style: st && /italic/i.test(st.textContent) ? 1 : 0 } }; }
      else if (tag === 'Faces' || tag === 'Axes') v = { faces: parseInt((p.getElementsByTagName('faces')[0] || p.getElementsByTagName('axes')[0] || p).textContent, 10) || 0 };
      else continue;
      o.props[name] = v; }
    for (const c of el.children) if (c.tagName === 'Item') o.children.push(item(c)); return o; };
  return [...doc.documentElement.children].filter((c) => c.tagName === 'Item').map(item);
}

/* =====================================================================
   Instances → Forge map (+ Forge game config if present)
   ===================================================================== */
const MATERIAL = { 256: 'Plastic', 272: 'SmoothPlastic', 288: 'Neon', 512: 'Wood', 528: 'WoodPlanks', 784: 'Marble', 788: 'Basalt', 800: 'Slate', 804: 'CrackedLava', 816: 'Concrete', 820: 'Limestone', 832: 'Granite',
  836: 'Pavement', 848: 'Brick', 864: 'Pebble', 880: 'Cobblestone', 896: 'Rock', 912: 'Sandstone', 1040: 'CorrodedMetal', 1056: 'DiamondPlate', 1072: 'Foil', 1088: 'Metal', 1280: 'Grass', 1284: 'LeafyGrass',
  1296: 'Sand', 1312: 'Fabric', 1328: 'Snow', 1344: 'Mud', 1360: 'Ground', 1376: 'Asphalt', 1392: 'Salt', 1536: 'Ice', 1552: 'Glacier', 1568: 'Glass', 1584: 'ForceField', 1792: 'Plastic', 2048: 'Glass' };
const KNOWN = new Set(['Plastic', 'SmoothPlastic', 'Neon', 'Wood', 'WoodPlanks', 'Brick', 'Cobblestone', 'Concrete', 'Slate', 'Granite', 'Marble', 'Basalt', 'Rock', 'Pebble', 'Grass', 'LeafyGrass', 'Sand', 'Snow', 'Ice', 'Glacier', 'Glass', 'ForceField', 'Metal', 'DiamondPlate', 'CorrodedMetal', 'Foil', 'Fabric', 'Asphalt', 'Pavement', 'CrackedLava', 'Sandstone']);
const MAT_ALIAS = { Limestone: 'Sandstone', Mud: 'Ground', Ground: 'Grass', Salt: 'Sand' };
const SHAPE = { 0: 'Ball', 1: 'Block', 2: 'Cylinder', 3: 'Wedge', 4: 'CornerWedge' };
/* the classic BrickColor palette entries that old places still use */
const BRICK = { 1: '#f2f3f3', 5: '#d7c59a', 9: '#e8bac8', 18: '#cc8e69', 21: '#c4281c', 23: '#0d69ac', 24: '#f5cd30', 26: '#1b2a35', 28: '#287f47', 29: '#a1c48c', 37: '#4b974b', 38: '#a05f35', 45: '#b4d2e4', 101: '#da867a', 102: '#6e99ca',
  104: '#6b327c', 105: '#e29b40', 106: '#da8541', 107: '#008f9c', 119: '#a4bd47', 125: '#eac5a4', 135: '#74869d', 141: '#27462d', 151: '#789082', 153: '#957977', 192: '#694028', 194: '#a3a2a5', 199: '#635f62',
  208: '#e5e4df', 217: '#7c5c46', 226: '#fdea8d', 1001: '#f8f8f8', 1002: '#cdcdcd', 1003: '#111111', 1004: '#ff0000', 1005: '#ffaf00', 1006: '#b480ff', 1007: '#a34b4b', 1009: '#ffff00', 1010: '#0000ff', 1011: '#002060',
  1012: '#2154b9', 1013: '#04afec', 1014: '#aa5500', 1015: '#aa00aa', 1016: '#ff66cc', 1017: '#ffaf00', 1018: '#12eed4', 1019: '#00ffff', 1020: '#00ff00', 1021: '#3a7d15', 1022: '#7f8e64', 1023: '#8c5b9f', 1024: '#afddff',
  1025: '#ffc9c9', 1026: '#b1a7ff', 1027: '#9fe7ff', 1028: '#ccffcc', 1029: '#ffffcc', 1030: '#ffcc99', 1031: '#6225d1', 1032: '#ff00bf' };
const PARTS = new Set(['Part', 'WedgePart', 'CornerWedgePart', 'TrussPart', 'SpawnLocation', 'Seat', 'VehicleSeat', 'SkateboardPlatform', 'MeshPart', 'UnionOperation', 'PartOperation', 'IntersectOperation']);
const hex = (c) => '#' + c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const s = (v) => (v instanceof Uint8Array ? dec.decode(v) : v == null ? '' : String(v));
const P = (o, ...names) => { for (const n of names) { if (o.props[n] !== undefined) return o.props[n]; const k = Object.keys(o.props).find((x) => x.toLowerCase() === n.toLowerCase()); if (k) return o.props[k]; } return undefined; };
let seq = 0; const nid = () => 'rb' + (seq++).toString(36);
const D = 180 / Math.PI;
function euler(m) { // rows of R (= Rx·Ry·Rz, three.js Euler XYZ) → degrees
  const m13 = Math.max(-1, Math.min(1, m[2])); const y = Math.asin(m13); let x, z;
  if (Math.abs(m13) < 0.9999999) { x = Math.atan2(-m[5], m[8]); z = Math.atan2(-m[1], m[0]); } else { x = Math.atan2(m[7], m[4]); z = 0; }
  return [x * D, y * D, z * D].map((v) => +v.toFixed(2)); }

export function placeToGame(roots, fileName = 'Jeu') {
  const stats = { parts: 0, meshes: 0, terrain: false, scripts: 0, skipped: 0 }, limit = 80000;
  const node = (o) => {
    if (o.cls === 'Terrain') { stats.terrain = true; return null; }
    if (/Script$/.test(o.cls)) stats.scripts++;
    const name = s(P(o, 'Name')) || o.cls, kids = () => o.children.map(node).filter(Boolean);
    if (PARTS.has(o.cls)) {
      if (stats.parts >= limit) { stats.skipped++; return null; }
      const cf = P(o, 'CFrame'), size = P(o, 'size', 'Size', 'InitialSize'); if (!cf || !size) return null;
      const col = P(o, 'Color3uint8', 'Color'), brick = P(o, 'BrickColor', 'brickColor'), matE = P(o, 'Material'), shapeE = P(o, 'shape', 'Shape');
      let color = '#a3a2a5'; if (col?.rgb8) color = hex(col.rgb8); else if (col?.rgb) color = hex(col.rgb.map((x) => x * 255)); else if (brick?.brick != null) color = BRICK[brick.brick] || color;
      let material = typeof matE === 'number' ? MATERIAL[matE] || 'Plastic' : 'Plastic'; material = MAT_ALIAS[material] || material; if (!KNOWN.has(material)) material = 'Plastic';
      const shape = o.cls === 'Part' || o.cls === 'Seat' || o.cls === 'SpawnLocation' ? SHAPE[shapeE] || 'Block' : 'Block';
      const cls = o.cls === 'WedgePart' || (o.cls === 'Part' && shape === 'Wedge') ? 'WedgePart' : o.cls === 'CornerWedgePart' || (o.cls === 'Part' && shape === 'CornerWedge') ? 'CornerWedgePart' : o.cls === 'TrussPart' ? 'TrussPart' : o.cls === 'SpawnLocation' ? 'SpawnLocation' : 'Part';
      if (o.cls === 'MeshPart' || /Operation$/.test(o.cls)) stats.meshes++;
      const p = { id: nid(), cls, name, size: size.map((v) => +(+v).toFixed(3)), pos: cf.pos.map((v) => +(+v).toFixed(3)), rot: euler(cf.rot), color, material,
        transparency: +(P(o, 'Transparency') || 0), anchored: P(o, 'Anchored') !== false, canCollide: P(o, 'CanCollide') !== false, shape: shape === 'Wedge' || shape === 'CornerWedge' ? 'Block' : shape };
      const refl = P(o, 'Reflectance'); if (refl) p.reflectance = +refl;
      const A = readAttributes(P(o, 'AttributesSerialize', 'Attributes')); const attrs = {};
      for (const [k, v] of Object.entries(A)) { if (k === 'ForgeRole' || v == null) continue; if (k === 'ForgeLabel') { p.label = v; continue; } if (k === 'ForgeVox') { p.vox = v; continue; } if (k === 'ForgeFollow') { p.follow = v; continue; }
        if (A.ForgeRole && /^Forge/.test(k) && !/^ForgeGame/.test(k)) continue; attrs[k] = v; }
      if (A.ForgeRole) { p.role = { type: A.ForgeRole }; for (const [k, v] of Object.entries(A)) if (/^Forge/.test(k) && !['ForgeRole', 'ForgeLabel', 'ForgeVox', 'ForgeFollow'].includes(k) && !/^ForgeGame/.test(k)) p.role[k.charAt(5).toLowerCase() + k.slice(6)] = v; }
      if (Object.keys(attrs).length) p.attrs = attrs;
      const light = o.children.find((c) => /^(Point|Spot|Surface)Light$/.test(c.cls)); if (light) p.light = { range: +(P(light, 'Range') || 16), brightness: +(P(light, 'Brightness') || 1) };
      if (!p.label) { const bb = o.children.find((c) => c.cls === 'BillboardGui'); const tl = bb && bb.children.find((c) => /^Text(Label|Button)$/.test(c.cls)); const t = tl && s(P(tl, 'Text')); if (t) p.label = t.slice(0, 40); }
      stats.parts++;
      const sub = kids(); return sub.length ? { id: nid(), cls: 'Model', name, children: [p, ...sub] } : p;
    }
    const sub = kids(); if (!sub.length) return null;
    const out = { id: nid(), cls: 'Model', name, children: sub }; const A = readAttributes(P(o, 'AttributesSerialize')); if (A.ForgeTycoon) out.tycoon = true; return out;
  };
  const find = (cls) => roots.find((r) => r.cls === cls);
  // the map: Workspace first, plus parts and models left at the root of the file (models, some exports);
  // if that holds no part, look everywhere else (ServerStorage, ReplicatedStorage maps…) except the player's own containers
  const SVC = new Set(['Players', 'StarterPlayer', 'StarterPack', 'StarterGui', 'CoreGui', 'Lighting', 'SoundService', 'Chat', 'Teams', 'TestService']);
  const ws = find('Workspace'); const top = [...(ws ? ws.children : []), ...roots.filter((r) => PARTS.has(r.cls) || r.cls === 'Model' || r.cls === 'Folder')];
  let children = top.filter((c) => c.cls !== 'Camera').map(node).filter(Boolean);
  if (!stats.parts) { const rest = roots.filter((r) => r !== ws && !SVC.has(r.cls) && !PARTS.has(r.cls) && r.cls !== 'Model' && r.cls !== 'Folder'); children = rest.flatMap((r) => r.children).map(node).filter(Boolean); }
  if (!stats.parts) { const all = {}; const cnt = (o) => { all[o.cls] = (all[o.cls] || 0) + 1; o.children.forEach(cnt); }; roots.forEach(cnt);
    const total = Object.values(all).reduce((a, b) => a + b, 0), list = Object.entries(all).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ×${v}`).join(', ');
    throw new Error(stats.terrain ? 'cette place n’a que du Terrain (le terrain lisse de Roblox ne peut pas encore être affiché) : ajoute des pièces' : `aucune pièce trouvée dans ce fichier (${total} objets : ${list})`); }
  // Lighting
  const L = find('Lighting'), over = {}; let preset = 'jour';
  if (L) { const ct = P(L, 'ClockTime'), tod = s(P(L, 'TimeOfDay')); const clock = typeof ct === 'number' ? ct : /^\d+:\d+/.test(tod) ? (+tod.split(':')[0] + +tod.split(':')[1] / 60) : null;
    const c3 = (v) => (v?.rgb ? hex(v.rgb.map((x) => x * 255)) : undefined);
    if (clock != null) { over.ClockTime = clock; preset = clock >= 5.5 && clock <= 18.5 ? (clock > 16.5 ? 'coucher' : clock < 8 ? 'aube' : 'jour') : 'nuit'; }
    const br = P(L, 'Brightness'); if (typeof br === 'number') over.Brightness = Math.max(0.6, br); const am = c3(P(L, 'Ambient')), oa = c3(P(L, 'OutdoorAmbient')); if (am) over.Ambient = am; if (oa) over.OutdoorAmbient = oa;
    const atm = L.children.find((c) => c.cls === 'Atmosphere'); if (atm) over.atmo = { Density: +(P(atm, 'Density') ?? 0.3), Haze: +(P(atm, 'Haze') ?? 0), Glare: +(P(atm, 'Glare') ?? 0), Color: c3(P(atm, 'Color')) || '#c7d7ec', Decay: c3(P(atm, 'Decay')) || '#5c6e87' };
    else over.atmo = { Density: 0.05, Haze: 0 };
    const bl = L.children.find((c) => c.cls === 'BloomEffect'); if (bl) over.bloom = { Intensity: +(P(bl, 'Intensity') ?? 1), Size: +(P(bl, 'Size') ?? 24), Threshold: +(P(bl, 'Threshold') ?? 2) }; }
  // Forge game config (ReplicatedStorage.ForgeGame.Config)
  let configSrc = null; const walk = (o, path) => { if (configSrc) return; const name = s(P(o, 'Name')); if (o.cls === 'ModuleScript' && name === 'Config' && /ForgeGame/.test(path)) { configSrc = s(P(o, 'Source')); return; } o.children.forEach((c) => walk(c, path + '/' + name)); };
  roots.forEach((r) => walk(r, ''));
  const title = fileName.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim() || 'Jeu';
  return { map: { v: 1, name: title, theme: null, lighting: { preset, over }, gen: { id: 'import' }, root: { id: nid(), cls: 'Folder', name: title, children } }, configSrc, stats };
}

function placeToGameSafe(roots, fileName) { try { return placeToGame(roots, fileName); } catch (e) { return { map: null, configSrc: null, stats: { parts: 0, terrain: false, scripts: 0 }, error: e.message }; } }
/** does the place build its world with server scripts? */
export function hasServerScripts(roots) { let n = 0; const w = (o, svc) => { if (o.cls === 'Script' && (svc === 'ServerScriptService' || svc === 'Workspace') && o.props.Disabled !== true) n++; o.children.forEach((c) => w(c, svc)); }; roots.forEach((r) => w(r, r.cls)); return n; }
/** a Roblox file (binary or XML, place or model) → { roots, map, configSrc, stats } */
export function readRoblox(buf, fileName) {
  const u8 = new Uint8Array(buf); const head = dec.decode(u8.subarray(0, 64));
  const roots = head.startsWith('<roblox!') ? readBinary(buf) : /<roblox[\s>]/.test(head) || head.includes('<?xml') ? readXml(dec.decode(u8)) : null;
  if (!roots) throw new Error('ce n’est pas un fichier Roblox (.rbxl, .rbxlx, .rbxm, .rbxmx)');
  return { roots, ...placeToGameSafe(roots, fileName) };
}
