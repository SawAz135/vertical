import * as THREE from 'three';
import { GLSL_NOISE, hash32, clamp, TAU } from '../core/util.js';

// =====================================================================================
// POTATO DATABASE + GPU INSTANCED RENDERING
// - Every potato is a record in struct-of-arrays typed arrays (≈140k records).
// - Rendering: one InstancedMesh pair (near/far LOD) per 10 m chunk. The vertex shader
//   deforms a unit icosphere per instance (lumps, curve, dent, sprout nub) so each potato
//   is unique with a single geometry; the fragment shader paints skin, eyes, dark spots,
//   dirt and the orange chalk mark of candidates.
// - Interaction converts an instance into a detailed "actor" (same material, high-res mesh)
//   and back (see PotatoActors).
// =====================================================================================

export const VARIETIES = [
  { id: 'bintje', name: { fr: 'Bintje', en: 'Bintje' }, col: [0.8, 0.64, 0.41], price: 1, weight: 66 },
  { id: 'charlotte', name: { fr: 'Charlotte', en: 'Charlotte' }, col: [0.86, 0.72, 0.48], price: 1.4, weight: 20 },
  { id: 'rosabelle', name: { fr: 'Rosabelle', en: 'Rosabelle' }, col: [0.66, 0.32, 0.26], price: 2, weight: 4 },
  { id: 'russet', name: { fr: 'Russet', en: 'Russet' }, col: [0.68, 0.52, 0.34], price: 1.6, weight: 8 },
  { id: 'vitelotte', name: { fr: 'Vitelotte', en: 'Vitelotte' }, col: [0.24, 0.14, 0.26], price: 6, weight: 1.5 },
  { id: 'doree', name: { fr: 'Dorée de Bouchard', en: 'Bouchard Gold' }, col: [1.0, 0.74, 0.16], price: 60, weight: 0.12 },
];
export const SPECIAL = { NONE: 0, FACE: 1, HEART: 2, TWIN: 3 };
const VCOLS = VARIETIES.map(v => new THREE.Vector3(...v.col));

export const R0 = 0.052; // base radius in metres (≈10–16 cm potatoes, a touch larger than life for readability)
export const CHUNK = 10;
const SPARE = 900; // free slots per chunk for potatoes that move in / are dug up


const F = Float32Array;
export class PotatoDB {
  constructor(cap) {
    this.cap = cap; this.n = 0;
    const f = () => new F(cap), u8 = () => new Uint8Array(cap), i32 = () => new Int32Array(cap).fill(-1);
    Object.assign(this, {
      px: f(), py: f(), pz: f(), qx: f(), qy: f(), qz: f(), qw: f(),
      size: f(), elong: f(), flat: f(), bend: f(), lump: f(), seed: f(),
      variety: u8(), special: u8(), spots: u8(), spotT: f(), spotP: f(), spotR: f(), spot2T: f(), spot2P: f(),
      dent: f(), dentT: f(), dentP: f(), sprout: f(), sprT: f(), sprP: f(),
      state: u8(), marked: u8(), zone: u8(), heap: new Int16Array(cap).fill(-1), chunk: i32(), slot: i32(),
    });
  }
  add() { if (this.n >= this.cap) return -1; const i = this.n++; this.qw[i] = 1; return i; }
  // Random but plausible traits
  randomTraits(i, r) {
    let w = r() * VARIETIES.reduce((s, v) => s + v.weight, 0), vi = 0;
    for (; vi < VARIETIES.length - 1; vi++) { w -= VARIETIES[vi].weight; if (w <= 0) break; }
    this.variety[i] = vi;
    this.size[i] = clamp(0.95 + r.gauss() * 0.17, 0.62, 1.45);
    this.elong[i] = clamp(1.22 + r.gauss() * 0.16, 0.95, 1.7);
    this.flat[i] = clamp(0.86 + r.gauss() * 0.06, 0.7, 1.0);
    this.bend[i] = r() < 0.75 ? r() * 0.12 : 0.12 + r() * 0.42;
    this.lump[i] = 0.04 + r() * 0.12;
    this.seed[i] = (hash32(i * 7919 + 13) % 997) / 9.7;
    const sp = r(); this.spots[i] = sp < 0.86 ? 0 : sp < 0.97 ? 1 : 2;
    this.spotT[i] = r() * TAU; this.spotP[i] = 0.4 + r() * 2.3; this.spotR[i] = 0.18 + r() * 0.16;
    this.spot2T[i] = r() * TAU; this.spot2P[i] = 0.4 + r() * 2.3;
    this.dent[i] = r() < 0.3 ? 0.08 + r() * 0.12 : 0;
    this.dentT[i] = r() * TAU; this.dentP[i] = 0.6 + r() * 1.9;
    const s = r(); this.sprout[i] = s < 0.72 ? 0 : 0.25 + r() * 0.6;
    this.sprT[i] = r() * TAU; this.sprP[i] = 0.3 + r() * 1.0;
    this.special[i] = 0;
    if (r() < 0.0009) this.special[i] = SPECIAL.FACE;
    else if (r() < 0.0007) { this.special[i] = SPECIAL.HEART; this.dent[i] = 0.22; this.dentT[i] = 0; this.dentP[i] = 0.2; }
    else if (r() < 0.0007) { this.special[i] = SPECIAL.TWIN; this.lump[i] = 0.05; }
  }
  quat(i, q) { return q.set(this.qx[i], this.qy[i], this.qz[i], this.qw[i]); }
  setQuat(i, q) { this.qx[i] = q.x; this.qy[i] = q.y; this.qz[i] = q.z; this.qw[i] = q.w; }
  matrix(i, m) {
    const s = this.size[i] * R0;
    _v.set(this.px[i], this.py[i], this.pz[i]); _q.set(this.qx[i], this.qy[i], this.qz[i], this.qw[i]);
    _s.set(s * this.elong[i], s * this.flat[i], s);
    return m.compose(_v, _q, _s);
  }
  // physics-ish bounding radius
  radius(i) { return this.size[i] * R0 * (0.62 + this.elong[i] * 0.3); }
}
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();

// ---------------- material ----------------
const sph = (t, p) => new THREE.Vector3(Math.sin(p) * Math.cos(t), Math.cos(p), Math.sin(p) * Math.sin(t));
export const potatoUniforms = { uTime: { value: 0 }, uVarCols: { value: VCOLS }, uWet: { value: 0 } };

export function makePotatoMaterial(opts = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.0, color: 0xffffff });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, potatoUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aShape;  // elong(unused here), flat(unused), bend, lump
attribute vec4 aMisc;   // seed, variety + 8*special + 64*marked, dent depth, sprout length
attribute vec4 aDirs;   // spot theta/phi, dent theta/phi
attribute vec4 aDirs2;  // spot radius, sprout theta/phi, spot count + 10*spot2 phi packing
attribute vec2 aDirs3;  // spot2 theta/phi
varying vec3 vDir; varying vec4 vMisc; varying vec3 vSpot; varying vec3 vSpot2; varying vec3 vSprout; varying vec3 vDentDir; varying float vSpotR; varying float vSpotN;
${GLSL_NOISE}
vec3 wmpSph(float t, float p){ return vec3(sin(p)*cos(t), cos(p), sin(p)*sin(t)); }
vec3 gDent; vec3 gSpr;
vec3 wmpDeform(vec3 n){
  float r = 1.0;
  float sp = floor(aMisc.y/8.0);
  float special = mod(sp, 8.0);
  r += aShape.w * wmpNoise(n*2.1 + aMisc.x) + aShape.w*0.35*wmpNoise(n*5.3 + aMisc.x*1.7);
  r -= 0.018 * smoothstep(0.55, 0.9, wmpNoise(n*9.0 + aMisc.x*3.1)); // eye dimples
  r -= aMisc.z * smoothstep(0.82, 0.985, dot(n, gDent));
  r += aMisc.w * 0.55 * pow(max(dot(n, gSpr), 0.0), 120.0);
  vec3 q = n * r;
  if (special > 2.5) { q.x *= 1.0 + 0.25*abs(q.x); q.y *= 1.0 - 0.35*smoothstep(0.35,0.0,abs(q.x)); } // twin lobes
  if (special > 1.5 && special < 2.5) { q.y *= 1.0 - 0.25*(1.0-abs(q.x)); q.y += 0.25*abs(q.x)-0.1; } // heart
  q.y += aShape.z * (q.x*q.x) * 1.35 - aShape.z*0.32;
  return q;
}`)
      .replace('#include <beginnormal_vertex>', `
gDent = wmpSph(aDirs.z, aDirs.w); gSpr = wmpSph(aDirs2.y, aDirs2.z);
vec3 wn = normalize(position);
vec3 wt = normalize(abs(wn.y) < 0.95 ? cross(wn, vec3(0.0,1.0,0.0)) : cross(wn, vec3(1.0,0.0,0.0)));
vec3 wb = cross(wn, wt);
vec3 wP = wmpDeform(wn);
vec3 wP1 = wmpDeform(normalize(wn + wt*0.03));
vec3 wP2 = wmpDeform(normalize(wn + wb*0.03));
vec3 objectNormal = normalize(cross(wP1 - wP, wP2 - wP));
if (dot(objectNormal, wP) < 0.0) objectNormal = -objectNormal;
#ifdef USE_TANGENT
vec3 objectTangent = vec3(1.0,0.0,0.0);
#endif
vDir = wn; vMisc = aMisc; vSpot = wmpSph(aDirs.x, aDirs.y); vDentDir = gDent; vSprout = gSpr; vSpotR = aDirs2.x;
vSpotN = aDirs2.w; vSpot2 = wmpSph(aDirs3.x, aDirs3.y);
`)
      .replace('#include <begin_vertex>', 'vec3 transformed = wP;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vDir; varying vec4 vMisc; varying vec3 vSpot; varying vec3 vSpot2; varying vec3 vSprout; varying vec3 vDentDir; varying float vSpotR; varying float vSpotN;
uniform vec3 uVarCols[6]; uniform float uTime; uniform float uWet;
${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float vf = mod(vMisc.y, 8.0); float flags = floor(vMisc.y/8.0); float special = mod(flags, 8.0); float marked = floor(flags/8.0);
  vec3 base = uVarCols[int(vf+0.5)];
  vec3 n = normalize(vDir);
  float tone = wmpNoise(n*3.0 + vMisc.x) * 0.5 + 0.5;
  float fine = wmpNoise(n*24.0 + vMisc.x*2.0);
  vec3 col = base * (0.86 + tone*0.22) + fine*0.025;
  // netted/russet texture
  col *= 1.0 - 0.04*smoothstep(0.2, 0.7, abs(wmpNoise(n*14.0+vMisc.x)));
  // eyes: small dark pits with a pinkish rim
  float e = wmpNoise(n*9.0 + vMisc.x*3.1);
  col = mix(col, col*vec3(0.72,0.6,0.5), smoothstep(0.7, 0.9, e) * 0.8);
  // lenticels: tiny dark-brown specks all over the skin (as on real washed potatoes)
  float sp1 = wmpNoise(n*46.0 + vMisc.x*4.0), sp2 = wmpNoise(n*71.0 - vMisc.x*2.0);
  col = mix(col, vec3(0.38,0.27,0.16), smoothstep(0.84, 0.93, sp1) * 0.7 + smoothstep(0.87, 0.95, sp2) * 0.45);
  // soil dirt patches
  float d = wmpNoise(n*4.2 + vMisc.x*5.0 + 10.0);
  col = mix(col, vec3(0.5,0.38,0.24), smoothstep(0.35, 0.85, d) * 0.28);
  // dark spot(s)
  float sr = cos(vSpotR);
  if (vSpotN > 0.5) {
    float sd = dot(n, vSpot) + wmpNoise(n*7.0+vMisc.x)*0.035;
    float s1 = smoothstep(sr - 0.012, sr + 0.02, sd);
    col = mix(col, vec3(0.13,0.08,0.06), s1*0.92);
  }
  if (vSpotN > 1.5) {
    float sd2 = dot(n, vSpot2) + wmpNoise(n*6.0+vMisc.x+3.0)*0.035;
    col = mix(col, vec3(0.15,0.1,0.07), smoothstep(cos(vSpotR*0.8)-0.01, cos(vSpotR*0.8)+0.02, sd2)*0.9);
  }
  // dent shading (soil collects in it)
  col = mix(col, col*0.62, smoothstep(0.86, 0.97, dot(n, vDentDir)) * step(0.01, vMisc.z));
  // sprout: pale violet-green tip
  float sp = pow(max(dot(n, vSprout), 0.0), 110.0) * step(0.05, vMisc.w);
  col = mix(col, vec3(0.75,0.82,0.55), clamp(sp*3.0, 0.0, 1.0));
  // potato with a face
  if (special > 0.5 && special < 1.5) {
    vec3 f = vec3(0.0, 0.0, 1.0);
    float eL = dot(n, normalize(vec3(-0.3, 0.25, 0.9))), eR = dot(n, normalize(vec3(0.3, 0.25, 0.9)));
    col = mix(col, vec3(0.05), smoothstep(0.985, 0.992, max(eL, eR)));
    float m = dot(n, f); float my = n.y + 0.22; float mx = abs(n.x);
    col = mix(col, vec3(0.1,0.05,0.04), step(0.8, m) * smoothstep(0.03, 0.0, abs(my - mx*mx*1.6)) * step(mx, 0.3));
  }
  // golden potato sparkle
  if (vf > 4.5) col += vec3(1.0,0.7,0.2) * pow(max(fine,0.0), 6.0) * (0.6 + 0.4*sin(uTime*6.0 + vMisc.x));
  // orange chalk X of candidate
  if (marked > 0.5) {
    vec2 uv = vec2(atan(n.z, n.x), n.y);
    float x1 = abs(uv.x*0.25 - uv.y*0.9 + 0.0), x2 = abs(uv.x*0.25 + uv.y*0.9);
    float mk = (1.0 - smoothstep(0.03, 0.07, min(x1, x2))) * step(abs(uv.y), 0.55) * step(0.0, n.z);
    col = mix(col, vec3(1.0,0.42,0.05), mk * (0.75 + 0.25*fine));
  }
  diffuseColor.rgb = pow(clamp(col, 0.0, 1.5), vec3(2.2)); // palette is authored in sRGB
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(0.72, 0.5, smoothstep(0.3, 0.8, wmpNoise(normalize(vDir)*6.0+vMisc.x))) - uWet*0.35;
if (mod(vMisc.y, 8.0) > 4.5) roughnessFactor = 0.32;`);
  };
  m.customProgramCacheKey = () => 'wmp-potato' + (opts.key || '');
  return m;
}

// fresnel ghost used for the hovered potato (same deformation, additive rim glow)
export function makeHoverMaterial() {
  const m = makePotatoMaterial({ key: 'hover' });
  m.transparent = true; m.depthWrite = false; m.blending = THREE.AdditiveBlending; m.side = THREE.BackSide;
  const ob = m.onBeforeCompile;
  m.onBeforeCompile = sh => {
    ob(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
float fr = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0,0.0,1.0))), 1.5);
gl_FragColor = vec4(vec3(1.0,0.72,0.3) * (0.25 + fr*1.6) * (0.75 + 0.25*sin(uTime*7.0)), 1.0);`);
  };
  return m;
}

// --------------- instancing helpers ---------------
const ATTRS = [['aShape', 4], ['aMisc', 4], ['aDirs', 4], ['aDirs2', 4], ['aDirs3', 2]];
export function writeAttrs(db, i, arrs, slot) {
  const [s, m, d, d2, d3] = arrs;
  s[slot * 4] = db.elong[i]; s[slot * 4 + 1] = db.flat[i]; s[slot * 4 + 2] = db.bend[i]; s[slot * 4 + 3] = db.lump[i];
  m[slot * 4] = db.seed[i]; m[slot * 4 + 1] = db.variety[i] + 8 * db.special[i] + 64 * db.marked[i]; m[slot * 4 + 2] = db.dent[i]; m[slot * 4 + 3] = db.sprout[i];
  d[slot * 4] = db.spotT[i]; d[slot * 4 + 1] = db.spotP[i]; d[slot * 4 + 2] = db.dentT[i]; d[slot * 4 + 3] = db.dentP[i];
  d2[slot * 4] = db.spotR[i]; d2[slot * 4 + 1] = db.sprT[i]; d2[slot * 4 + 2] = db.sprP[i]; d2[slot * 4 + 3] = db.spots[i];
  d3[slot * 2] = db.spot2T[i]; d3[slot * 2 + 1] = db.spot2P[i];
}
function makeInstAttrs(cap) { return ATTRS.map(([, k]) => new THREE.InstancedBufferAttribute(new Float32Array(cap * k), k).setUsage(THREE.DynamicDrawUsage)); }
function geomWith(base, attrs) {
  const g = new THREE.BufferGeometry();
  g.setIndex(base.index); g.setAttribute('position', base.attributes.position); g.setAttribute('normal', base.attributes.normal); g.setAttribute('uv', base.attributes.uv);
  ATTRS.forEach(([n], k) => g.setAttribute(n, attrs[k]));
  return g;
}

// ---------------- World potato field ----------------
export class PotatoField {
  constructor(scene, db, opts) {
    this.scene = scene; this.db = db; this.opts = opts;
    this.mat = makePotatoMaterial();
    this.geoNear = mergedIndexed(2); this.geoFar = mergedIndexed(1); this.geoXFar = mergedIndexed(0);
    this.chunks = new Map();
    this.cells = new Map(); // 2 m pick cells -> ids
    this.dirtyChunks = new Set();
    this.group = new THREE.Group(); this.group.name = 'potatoes'; scene.add(this.group);
    this.hover = new THREE.InstancedMesh(geomWith(mergedIndexed(3), makeInstAttrs(1)), makeHoverMaterial(), 1);
    this.hover.frustumCulled = false; this.hover.visible = false; this.hover.renderOrder = 5; scene.add(this.hover);
  }
  chunkKey(x, z) { return (Math.floor(x / CHUNK) + 2048) * 4096 + (Math.floor(z / CHUNK) + 2048); }
  cellKey(x, z) { return Math.floor(x / 2) * 8192 + Math.floor(z / 2); }
  // Build all chunks from db (after generation)
  build() {
    const db = this.db, counts = new Map();
    for (let i = 0; i < db.n; i++) if (db.state[i] === 0) { const k = this.chunkKey(db.px[i], db.pz[i]); counts.set(k, (counts.get(k) || 0) + 1); }
    for (const [k, c] of counts) this._makeChunk(k, c + SPARE);
    for (let i = 0; i < db.n; i++) if (db.state[i] === 0) this.place(i);
    for (const ch of this.chunks.values()) this._flush(ch, true);
  }
  _makeChunk(k, cap) {
    const cx = Math.floor(k / 4096) - 2048, cz = (k % 4096) - 2048;
    const attrs = makeInstAttrs(cap);
    const near = new THREE.InstancedMesh(geomWith(this.geoNear, attrs), this.mat, cap);
    const far = new THREE.InstancedMesh(geomWith(this.geoFar, attrs), this.mat, cap);
    const xfar = new THREE.InstancedMesh(geomWith(this.geoXFar, attrs), this.mat, cap);
    far.instanceMatrix = near.instanceMatrix; xfar.instanceMatrix = near.instanceMatrix; near.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const center = new THREE.Vector3((cx + 0.5) * CHUNK, 1.5, (cz + 0.5) * CHUNK);
    for (const m of [near, far, xfar]) {
      m.count = 0; m.boundingSphere = new THREE.Sphere(center, CHUNK * 0.75 + 2.5); m.receiveShadow = true; m.castShadow = false;
      m.matrixAutoUpdate = false; this.group.add(m);
    }
    const ch = { k, cx, cz, center, cap, near, far, xfar, attrs, idAt: new Int32Array(cap).fill(-1), free: [], hi: 0, dirty: false, minSlot: 1e9, maxSlot: -1 };
    this.chunks.set(k, ch);
    return ch;
  }
  place(i) {
    const db = this.db, k = this.chunkKey(db.px[i], db.pz[i]);
    let ch = this.chunks.get(k);
    if (!ch) ch = this._makeChunk(k, SPARE);
    let slot = ch.free.length ? ch.free.pop() : (ch.hi < ch.cap ? ch.hi++ : -1);
    if (slot < 0) { // chunk overflow: grow by rebuilding this chunk with more room
      this._grow(ch); return this.place(i);
    }
    ch.idAt[slot] = i; db.chunk[i] = k; db.slot[i] = slot; db.state[i] = 0;
    this._writeSlot(ch, slot, i);
    const ck = this.cellKey(db.px[i], db.pz[i]);
    let cell = this.cells.get(ck); if (!cell) this.cells.set(ck, cell = []); cell.push(i);
    return slot;
  }
  _writeSlot(ch, slot, i) {
    ch.near.setMatrixAt(slot, this.db.matrix(i, _m));
    writeAttrs(this.db, i, ch.attrs.map(a => a.array), slot);
    ch.minSlot = Math.min(ch.minSlot, slot); ch.maxSlot = Math.max(ch.maxSlot, slot);
    ch.dirty = true; this.dirtyChunks.add(ch);
  }
  refresh(i) { // traits/mark changed while in world
    const ch = this.chunks.get(this.db.chunk[i]); if (!ch || this.db.state[i] !== 0) return;
    this._writeSlot(ch, this.db.slot[i], i);
  }
  // overwrite the instance matrix of a world potato (grow animation)
  setMatrix(i, m) {
    const ch = this.chunks.get(this.db.chunk[i]); if (!ch) return;
    const slot = this.db.slot[i]; ch.near.setMatrixAt(slot, m);
    ch.minSlot = Math.min(ch.minSlot, slot); ch.maxSlot = Math.max(ch.maxSlot, slot); ch.dirty = true; this.dirtyChunks.add(ch);
  }
  remove(i) {
    const db = this.db; const ch = this.chunks.get(db.chunk[i]); if (!ch) return;
    const slot = db.slot[i];
    if (slot >= 0 && ch.idAt[slot] === i) {
      ch.idAt[slot] = -1; ch.free.push(slot);
      _m.makeScale(0, 0, 0); ch.near.setMatrixAt(slot, _m);
      ch.minSlot = Math.min(ch.minSlot, slot); ch.maxSlot = Math.max(ch.maxSlot, slot); ch.dirty = true; this.dirtyChunks.add(ch);
    }
    const cell = this.cells.get(this.cellKey(db.px[i], db.pz[i]));
    if (cell) { const p = cell.indexOf(i); if (p >= 0) { cell[p] = cell[cell.length - 1]; cell.pop(); } }
    db.chunk[i] = -1; db.slot[i] = -1;
  }
  _grow(ch) {
    const old = ch; const ids = []; for (let s = 0; s < old.hi; s++) if (old.idAt[s] >= 0) ids.push(old.idAt[s]);
    this.group.remove(old.near, old.far, old.xfar); old.near.geometry.dispose(); old.far.geometry.dispose(); old.xfar.geometry.dispose();
    this.chunks.delete(old.k); this.dirtyChunks.delete(old);
    const ch2 = this._makeChunk(old.k, old.cap * 2);
    for (const i of ids) { const cell = this.cells.get(this.cellKey(this.db.px[i], this.db.pz[i])); if (cell) { const p = cell.indexOf(i); if (p >= 0) cell.splice(p, 1); } this.place(i); }
    this._flush(ch2, true);
  }
  _flush(ch, all = false) {
    const n = ch.hi; ch.near.count = ch.far.count = ch.xfar.count = n;
    if (!ch.dirty && !all) return;
    const lo = all ? 0 : ch.minSlot, hi = all ? n - 1 : ch.maxSlot;
    if (hi >= lo) {
      const set = (attr, k) => { attr.clearUpdateRanges(); attr.addUpdateRange(lo * k, (hi - lo + 1) * k); attr.needsUpdate = true; };
      set(ch.near.instanceMatrix, 16); ch.attrs.forEach((a, j) => set(a, ATTRS[j][1]));
    }
    ch.dirty = false; ch.minSlot = 1e9; ch.maxSlot = -1;
  }
  update(camPos, quality, dt) {
    potatoUniforms.uTime.value += dt;
    for (const ch of this.dirtyChunks) this._flush(ch);
    this.dirtyChunks.clear();
    const R = quality.potatoRadius, NL = quality.nearLod;
    for (const ch of this.chunks.values()) {
      const d = Math.hypot(ch.center.x - camPos.x, ch.center.z - camPos.z) - CHUNK * 0.7;
      const vis = d < R && ch.hi > 0;
      const near = vis && d < NL;
      const mid = vis && !near && d < NL * 2.2;
      ch.near.visible = near; ch.far.visible = mid; ch.xfar.visible = vis && !near && !mid;
      ch.near.castShadow = near && quality.shadows && d < 4;
    }
  }
  showHover(i) {
    if (i < 0) { this.hover.visible = false; return; }
    const m = this.db.matrix(i, _m); _s.setFromMatrixScale(m); m.scale(_v.set(1.08, 1.08, 1.08));
    this.hover.setMatrixAt(0, m); this.hover.instanceMatrix.needsUpdate = true;
    const g = this.hover.geometry; writeAttrs(this.db, i, ATTRS.map(([n]) => g.attributes[n].array), 0); ATTRS.forEach(([n]) => (g.attributes[n].needsUpdate = true));
    this.hover.visible = true;
  }
  // ray pick among world potatoes near origin (max dist)
  pick(ray, maxDist, skip) {
    const db = this.db; let best = -1, bt = maxDist;
    const o = ray.origin, d = ray.direction;
    const steps = Math.ceil(maxDist / 1.0); const seen = new Set();
    for (let s = 0; s <= steps; s++) {
      const x = o.x + d.x * s, z = o.z + d.z * s;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const ck = Math.floor(x / 2 + a) * 8192 + Math.floor(z / 2 + b);
        if (seen.has(ck)) continue; seen.add(ck);
        const cell = this.cells.get(ck); if (!cell) continue;
        for (const i of cell) {
          if (i === skip) continue;
          const r = db.radius(i) * 0.95;
          const ox = db.px[i] - o.x, oy = db.py[i] - o.y, oz = db.pz[i] - o.z;
          const tc = ox * d.x + oy * d.y + oz * d.z; if (tc < 0 || tc - r > bt) continue;
          const d2 = ox * ox + oy * oy + oz * oz - tc * tc; if (d2 > r * r) continue;
          const t = tc - Math.sqrt(r * r - d2); if (t < bt) { bt = t; best = i; }
        }
      }
    }
    return best >= 0 ? { id: best, dist: bt } : null;
  }
  // all world potatoes within radius of point
  query(x, z, r, out = []) {
    const db = this.db; out.length = 0;
    const x0 = Math.floor((x - r) / 2), x1 = Math.floor((x + r) / 2), z0 = Math.floor((z - r) / 2), z1 = Math.floor((z + r) / 2);
    for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) {
      const cell = this.cells.get(a * 8192 + b); if (!cell) continue;
      for (const i of cell) { const dx = db.px[i] - x, dz = db.pz[i] - z; if (dx * dx + dz * dz <= r * r) out.push(i); }
    }
    return out;
  }
}
function mergedIndexed(detail) {
  // IcosahedronGeometry is non-indexed; merge vertices so the vertex shader deforms a watertight surface
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position, map = new Map(), verts = [], idx = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let j = map.get(key); if (j === undefined) { j = verts.length / 3; verts.push(x, y, z); map.set(key, j); }
    idx.push(j);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(verts.slice(), 3));
  const uv = []; for (let i = 0; i < verts.length; i += 3) uv.push(Math.atan2(verts[i + 2], verts[i]) / TAU + 0.5, verts[i + 1] * 0.5 + 0.5);
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

// ---------------- Detailed interactive actors ----------------
// An actor renders one potato with a high-res mesh + a real sprout, using the same shader.
const actorGeo = () => geomWith(mergedIndexed(4), makeInstAttrs(1));
export class PotatoActor {
  constructor(mat) {
    this.mesh = new THREE.InstancedMesh(actorGeo(), mat, 1);
    this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.root = new THREE.Group(); this.root.add(this.mesh);
    this.sprout = new THREE.Mesh(sproutGeo(), sproutMat()); this.sprout.castShadow = true; this.root.add(this.sprout);
    this.id = -1;
  }
  bind(db, i) {
    this.id = i;
    const g = this.mesh.geometry; writeAttrs(db, i, ATTRS.map(([n]) => g.attributes[n].array), 0); ATTRS.forEach(([n]) => (g.attributes[n].needsUpdate = true));
    const s = db.size[i] * R0;
    this.mesh.setMatrixAt(0, _m.makeScale(s * db.elong[i], s * db.flat[i], s)); this.mesh.instanceMatrix.needsUpdate = true;
    if (db.sprout[i] > 0.1) {
      const dir = sph(db.sprT[i], db.sprP[i]);
      // place the sprout on the deformed surface (approx: unit dir scaled by axes)
      const tip = dir.clone().multiplyScalar(1.0 + db.sprout[i] * 0.4);
      tip.y += db.bend[i] * tip.x * tip.x * 1.35 - db.bend[i] * 0.32;
      this.sprout.position.set(tip.x * s * db.elong[i], tip.y * s * db.flat[i], tip.z * s);
      this.sprout.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      this.sprout.scale.setScalar(s * (0.6 + db.sprout[i]));
      this.sprout.visible = true;
    } else this.sprout.visible = false;
    return this;
  }
  setMarked(db) { if (this.id >= 0) this.bind(db, this.id); }
}
function sproutGeo() {
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(Math.sin(t * 2.2) * 0.25, t * 0.9, 0)); }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.07, 6, false);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 - y * 0.75; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  g.computeVertexNormals(); return g;
}
let _sm; function sproutMat() { return _sm || (_sm = new THREE.MeshStandardMaterial({ color: 0xc7c7a0, roughness: 0.6, emissive: 0x1a1a08 })); }

