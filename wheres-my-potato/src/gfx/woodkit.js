import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../core/util.js';

// =====================================================================================
// WOOD KIT — carpentry-grade building blocks:
//  • painted plank textures (straight grain, growth rings, knots, saw marks) with a
//    normal map derived from the grain height and a roughness map;
//  • rounded-edge boxes (bevelled planks/posts) with box-projected UVs in metres, grain
//    following the longest axis, a random tint per piece (vertex colour);
//  • a merger that keeps the colours so a whole structure is a handful of draw calls.
// =====================================================================================

function heightToNormal(h, w, hh, strength) {
  const c = document.createElement('canvas'); c.width = w; c.height = hh; const x = c.getContext('2d'); const out = x.createImageData(w, hh);
  for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
    const l = h[j * w + ((i - 1 + w) % w)], r = h[j * w + ((i + 1) % w)], u = h[((j - 1 + hh) % hh) * w + i], d = h[((j + 1) % hh) * w + i];
    let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1; const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const k = (j * w + i) * 4; out.data[k] = (nx * 0.5 + 0.5) * 255; out.data[k + 1] = (ny * 0.5 + 0.5) * 255; out.data[k + 2] = (nz * 0.5 + 0.5) * 255; out.data[k + 3] = 255;
  }
  x.putImageData(out, 0, 0); return c;
}
const CACHE = {};
// tone: base colour of the species; the texture covers 0.3 m across × 1.2 m along the grain
export function woodMaterial(name = 'oak', o = {}) {
  if (CACHE[name]) return CACHE[name];
  const tones = { oak: ['#a5763f', '#8a5d2e', '#c08b4e'], dark: ['#6b4424', '#55341b', '#7d5230'], weathered: ['#9a8a72', '#7f705c', '#b3a487'], red: ['#a8402e', '#8a3122', '#b8513a'], cream: ['#e6dcc4', '#d4c8ad', '#efe6d2'] }[o.tone || name] || ['#a5763f', '#8a5d2e', '#c08b4e'];
  const W = 256, H = 1024, r = rng(name.length * 77 + 3);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const hgt = new Float32Array(W * H);
  x.fillStyle = tones[0]; x.fillRect(0, 0, W, H);
  // long grain lines (wavy), alternating early/late wood
  for (let k = 0; k < 140; k++) {
    const x0 = r() * W, amp = 2 + r() * 6, fr = 0.002 + r() * 0.006, ph = r() * 6, w = 0.6 + r() * 2.4, dark = r() < 0.6;
    x.strokeStyle = dark ? tones[1] : tones[2]; x.globalAlpha = 0.18 + r() * 0.35; x.lineWidth = w;
    x.beginPath(); for (let y = 0; y <= H; y += 8) { const xx = x0 + Math.sin(y * fr + ph) * amp + Math.sin(y * fr * 3.1) * amp * 0.3; y ? x.lineTo(xx, y) : x.moveTo(xx, y); } x.stroke();
  }
  x.globalAlpha = 1;
  // knots with swirling grain around them
  for (let k = 0; k < (o.knots ?? 2); k++) {
    const kx = 30 + r() * (W - 60), ky = 80 + r() * (H - 160), kr = 6 + r() * 9;
    for (let s = 6; s >= 0; s--) { x.strokeStyle = tones[1]; x.globalAlpha = 0.25 + s * 0.05; x.lineWidth = 1.5; x.beginPath(); x.ellipse(kx, ky, kr + s * 4, (kr + s * 4) * 2.4, 0, 0, 7); x.stroke(); }
    const g = x.createRadialGradient(kx, ky, 0, kx, ky, kr); g.addColorStop(0, '#2a1608'); g.addColorStop(1, tones[1]); x.globalAlpha = 0.9; x.fillStyle = g; x.beginPath(); x.ellipse(kx, ky, kr, kr * 1.5, 0, 0, 7); x.fill();
  }
  x.globalAlpha = 1;
  // pores + saw marks
  for (let k = 0; k < 2500; k++) { x.fillStyle = `rgba(40,20,8,${0.05 + r() * 0.1})`; x.fillRect(r() * W, r() * H, 1, 2 + r() * 5); }
  for (let k = 0; k < 18; k++) { x.strokeStyle = 'rgba(255,240,210,0.05)'; x.lineWidth = 3; const y = r() * H; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y + (r() - 0.5) * 20); x.stroke(); }
  // height from luminance (grain grooves) → normal map
  const id = x.getImageData(0, 0, W, H).data; for (let i = 0; i < W * H; i++) hgt[i] = (id[i * 4] + id[i * 4 + 1] + id[i * 4 + 2]) / 765;
  const nC = heightToNormal(hgt, W, H, 3.2);
  const rC = document.createElement('canvas'); rC.width = W; rC.height = H; { const y = rC.getContext('2d'); const im = y.createImageData(W, H); for (let i = 0; i < W * H; i++) { const v = 150 + (1 - hgt[i]) * 90; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } y.putImageData(im, 0, 0); }
  const tex = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const m = new THREE.MeshStandardMaterial({ map: tex(c, true), normalMap: tex(nC), roughnessMap: tex(rC), normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1, metalness: 0, vertexColors: true, color: o.color ?? 0xffffff });
  CACHE[name] = m; return m;
}

// rounded-edge box with metric box-projected UVs (grain along the longest axis) + a tint
export function rbox(w, h, d, r = 0.008, tint = [1, 1, 1], seg = 2) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, v = new THREE.Vector3(), c = new THREE.Vector3();
  const long = w >= h && w >= d ? 0 : h >= d ? 1 : 2;
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
    const dir = v.clone().sub(c); if (dir.lengthSq() < 1e-12) dir.set(n.getX(i), n.getY(i), n.getZ(i)); dir.normalize();
    v.copy(c).addScaledVector(dir, r); p.setXYZ(i, v.x, v.y, v.z); n.setXYZ(i, dir.x, dir.y, dir.z);
    // box projection: pick the dominant normal axis, grain (v) = longest axis
    const ax = Math.abs(dir.x), ay = Math.abs(dir.y), az = Math.abs(dir.z), dom = ax > ay && ax > az ? 0 : ay > az ? 1 : 2;
    const co = [v.x, v.y, v.z]; const other = [0, 1, 2].filter(k => k !== dom);
    let a = other[0], b = other[1]; if (a === long) { const t = a; a = b; b = t; }
    uv.setXY(i, co[a] / 0.3, co[b] / 1.2);
  }
  const col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { col[i * 3] = tint[0]; col[i * 3 + 1] = tint[1]; col[i * 3 + 2] = tint[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// random warm tint per piece
export function woodTint(r, k = 0.14) { const t = 1 - k / 2 + r() * k; return [t, t * (0.97 + r() * 0.05), t * (0.94 + r() * 0.08)]; }

// collects transformed geometries per material and merges them (keeps colours)
export class Kit {
  constructor() { this.groups = new Map(); }
  add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(m);
    if (!g.attributes.color) { const c = new Float32Array(g.attributes.position.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!this.groups.has(mat)) this.groups.set(mat, []);
    this.groups.get(mat).push(g); return this;
  }
  build(parent, { cast = true, receive = true } = {}) {
    for (const [mat, list] of this.groups) {
      const g = mergeGeometries(list, false); if (!g) continue; g.computeBoundingSphere();
      if (!mat.vertexColors) g.deleteAttribute('color'); // only wood (vertexColors) uses the per-piece tint
      const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = receive; parent.add(m);
    }
    this.groups.clear();
  }
}
