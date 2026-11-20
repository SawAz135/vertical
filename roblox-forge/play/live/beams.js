/* =====================================================================
   Roblox Forge · Jouer — Beam and Trail objects.
   Beam: a ribbon between Attachment0 and Attachment1, bent like Roblox's
   (cubic Bézier: CurveSize0 / CurveSize1 along each attachment's Axis),
   Segments, Width0 / Width1, Color and Transparency sequences, FaceCamera,
   LightEmission, Texture with TextureLength / TextureMode / TextureSpeed.
   Trail: a ribbon left behind by two attachments for Lifetime seconds,
   coloured and faded along its age, MinLength, WidthScale.
   ===================================================================== */
import * as THREE from 'three';
import { assetId, imageURL } from '../assets.js?v=10';

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
/* sample a Roblox ColorSequence / NumberSequence (or a plain value) at t ∈ [0, 1] */
function seq(v, t, fallback) {
  if (v == null) return fallback; if (typeof v === 'number') return v; if (v.r !== undefined) return v;
  const kps = v.f && v.f.Keypoints && v.f.Keypoints.arr; if (!kps || !kps.length) return fallback;
  let a = kps[0], b = kps[kps.length - 1]; for (let i = 0; i < kps.length - 1; i++) if (t >= kps[i].f.Time && t <= kps[i + 1].f.Time) { a = kps[i]; b = kps[i + 1]; break; }
  const u = b.f.Time > a.f.Time ? Math.max(0, Math.min(1, (t - a.f.Time) / (b.f.Time - a.f.Time))) : 0, x = a.f.Value, y = b.f.Value;
  if (typeof x === 'number') return x + (y - x) * u; return { r: x.r + (y.r - x.r) * u, g: x.g + (y.g - x.g) * u, b: x.b + (y.b - x.b) * u };
}
function attWorld(a) { // world position and axis (right vector) of an Attachment
  const cf = a.props.get('CFrame'), part = a.parent, pc = part && part.props && part.props.get('CFrame'); if (!pc) return null;
  const p = cf ? cf.p : [0, 0, 0], r = cf ? cf.r : [1, 0, 0, 0, 1, 0, 0, 0, 1]; const R = pc.r;
  const pos = new THREE.Vector3(pc.p[0] + R[0] * p[0] + R[1] * p[1] + R[2] * p[2], pc.p[1] + R[3] * p[0] + R[4] * p[1] + R[5] * p[2], pc.p[2] + R[6] * p[0] + R[7] * p[1] + R[8] * p[2]);
  const ax = [r[0], r[3], r[6]]; const axis = new THREE.Vector3(R[0] * ax[0] + R[1] * ax[1] + R[2] * ax[2], R[3] * ax[0] + R[4] * ax[1] + R[5] * ax[2], R[6] * ax[0] + R[7] * ax[1] + R[8] * ax[2]);
  return { pos, axis };
}
const texCache = new Map();
function texture(id) { if (!id) return null; if (texCache.has(id)) return texCache.get(id); const t = new THREE.TextureLoader().load(imageURL(id)); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; texCache.set(id, t); return t; }
function ribbonMesh(maxPts) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxPts * 2 * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxPts * 2 * 4), 4)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(maxPts * 2 * 2), 2));
  const idx = []; for (let i = 0; i < maxPts - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx); g.setDrawRange(0, 0);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.frustumCulled = false; m.renderOrder = 3; return m;
}
export class BeamSystem {
  constructor(world, engine) { this.W = world; this.E = engine; this.items = new Map(); this.t = 0; }
  scan() {
    const seen = new Set();
    for (const d of this.E.workspace.descendants()) if (d.cls === 'Beam' || d.cls === 'Trail') { seen.add(d); if (!this.items.has(d)) { const it = { o: d, mesh: ribbonMesh(d.cls === 'Beam' ? 64 : 128), pts: [] }; this.W.root.add(it.mesh); this.items.set(d, it); } }
    for (const [o, it] of this.items) if (!seen.has(o)) { this.W.root.remove(it.mesh); it.mesh.geometry.dispose(); it.mesh.material.dispose(); this.items.delete(o); }
  }
  camPos() { const cam = this.E.workspace.props.get('CurrentCamera'), cf = cam && cam.props.get('CFrame'); return cf ? new THREE.Vector3(cf.p[0], cf.p[1], cf.p[2]) : new THREE.Vector3(0, 50, 50); }
  update(dt) {
    this.t += dt; if (this.E.frameN % 20 === 0 || this.dirty) { this.scan(); this.dirty = false; } const cam = this.camPos();
    for (const it of this.items.values()) { const o = it.o; it.mesh.visible = false; if (!o.parent || o.props.get('Enabled') === false) { it.pts.length = 0; continue; } if (o.cls === 'Beam') this.beam(it, cam); else this.trail(it, cam, dt); }
  }
  material(it) { const P = it.o.props, m = it.mesh.material, tid = assetId(P.get('Texture')); const tex = texture(tid); if (m.map !== tex) { m.map = tex; m.needsUpdate = true; }
    const add = (P.get('LightEmission') ?? 0) > 0.5; const blend = add ? THREE.AdditiveBlending : THREE.NormalBlending; if (m.blending !== blend) { m.blending = blend; m.needsUpdate = true; } }
  write(it, centers, widths, normals, cam, colorAt, alphaAt, vAt, sides = null) {
    const g = it.mesh.geometry, pos = g.attributes.position.array, col = g.attributes.color.array, uv = g.attributes.uv.array, n = centers.length; if (n < 2) return;
    for (let i = 0; i < n; i++) {
      const c = centers[i], tan = tmpA.copy(centers[Math.min(n - 1, i + 1)]).sub(centers[Math.max(0, i - 1)]).normalize(); let side;
      if (sides) side = sides[i].clone(); else if (normals) side = normals[i].clone().cross(tan).normalize(); else side = tmpB.copy(cam).sub(c).cross(tan).normalize().clone();
      if (!isFinite(side.x) || side.lengthSq() < 1e-6) side = new THREE.Vector3(1, 0, 0);
      const w = widths[i] / 2; pos.set([c.x + side.x * w, c.y + side.y * w, c.z + side.z * w, c.x - side.x * w, c.y - side.y * w, c.z - side.z * w], i * 6);
      const t = i / (n - 1), k = colorAt(t), a = Math.max(0, Math.min(1, 1 - alphaAt(t))); col.set([k.r, k.g, k.b, a, k.r, k.g, k.b, a], i * 8); const v = vAt(t, i); uv.set([v, 0, v, 1], i * 4);
    }
    g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.uv.needsUpdate = true; g.setDrawRange(0, (n - 1) * 6); it.mesh.visible = true;
  }
  beam(it, cam) {
    const P = it.o.props, a0 = P.get('Attachment0'), a1 = P.get('Attachment1'); if (!a0 || !a1 || !a0.props || !a1.props) return; const A = attWorld(a0), B = attWorld(a1); if (!A || !B) return;
    const c0 = P.get('CurveSize0') || 0, c1 = P.get('CurveSize1') || 0, seg = Math.max(1, Math.min(63, Math.round(P.get('Segments') ?? 10)));
    const p1 = A.pos.clone().addScaledVector(A.axis, c0), p2 = B.pos.clone().addScaledVector(B.axis, -c1), curve = new THREE.CubicBezierCurve3(A.pos, p1, p2, B.pos);
    const centers = curve.getPoints(seg), w0 = P.get('Width0') ?? 1, w1 = P.get('Width1') ?? 1, widths = centers.map((_, i) => w0 + (w1 - w0) * (i / seg));
    const face = P.get('FaceCamera') !== false && P.get('FaceCamera') !== undefined ? null : centers.map((_, i) => A.axis.clone().lerp(B.axis, i / seg).normalize()); // not facing: the ribbon lies across the attachments' axes
    this.material(it); const len = A.pos.distanceTo(B.pos), mode = P.get('TextureMode'), tl = P.get('TextureLength') ?? 1, sp = P.get('TextureSpeed') ?? 1, scroll = this.t * sp;
    const rep = mode && mode.name === 'Static' ? 1 : mode && mode.name === 'Wrap' ? len / Math.max(0.01, tl) : 1 / Math.max(0.01, tl) * (mode && mode.name === 'Stretch' ? 1 : 1);
    const col = P.get('Color'), tr = P.get('Transparency');
    this.write(it, centers, widths, P.get('FaceCamera') ? null : face, cam, (t) => seq(col, t, { r: 1, g: 1, b: 1 }), (t) => seq(tr, t, 0.5), (t) => t * rep - scroll);
  }
  trail(it, cam, dt) {
    const P = it.o.props, a0 = P.get('Attachment0'), a1 = P.get('Attachment1'); if (!a0 || !a1 || !a0.props || !a1.props) return; const A = attWorld(a0), B = attWorld(a1); if (!A || !B) return;
    const life = Math.max(0.01, P.get('Lifetime') ?? 2), minLen = P.get('MinLength') ?? 0.1, mid = A.pos.clone().add(B.pos).multiplyScalar(0.5), half = A.pos.distanceTo(B.pos) / 2 * (P.get('WidthScale') ? seq(P.get('WidthScale'), 0, 1) : 1);
    for (const q of it.pts) q.age += dt; while (it.pts.length && it.pts[it.pts.length - 1].age > life) it.pts.pop();
    if (!it.pts.length || it.pts[0].p.distanceTo(mid) >= minLen) { it.pts.unshift({ p: mid, w: half, n: B.pos.clone().sub(A.pos).normalize(), age: 0 }); if (it.pts.length > 127) it.pts.pop(); } else { it.pts[0].p = mid; }
    if (it.pts.length < 2) return; this.material(it); const col = P.get('Color'), tr = P.get('Transparency'), face = !!P.get('FaceCamera');
    const centers = it.pts.map((q) => q.p), widths = it.pts.map((q) => q.w), ages = it.pts.map((q) => q.age / life);
    // a trail spans the two attachments (or faces the camera when FaceCamera is on)
    this.write(it, centers, widths.map((w) => w * 2), null, cam, (t) => seq(col, ages[Math.round(t * (ages.length - 1))], { r: 1, g: 1, b: 1 }), (t) => seq(tr, ages[Math.round(t * (ages.length - 1))], 0), (t) => t, face ? null : it.pts.map((q) => q.n));
  }
}
