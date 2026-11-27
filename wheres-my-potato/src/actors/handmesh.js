import * as THREE from 'three';

// =====================================================================================
// SCULPTED, RIGGED HAND — a smooth organic hand built once at boot:
//  1. a signed-distance sculpt (tapered phalanges, padded palm, thenar muscle, knuckles,
//     wrist) blended with smooth unions;
//  2. polygonised with Surface Nets, each vertex projected back onto the surface, normals
//     taken from the SDF gradient (no faceting at all);
//  3. vertex colours paint nails, knuckle/fingertip blush and the lighter palm;
//  4. skinned to a 16-bone rig (wrist, 4×3 finger bones, 3 thumb bones) with smooth
//     distance weights, so poses (grip, cup, relaxed, hold a book…) bend like a real hand.
// Frame: wrist at the origin, fingers toward −Z, palm facing −Y, right hand (thumb at −X).
// =====================================================================================

const FINGERS = [ // x at the knuckle, splay, phalanx lengths, base radius
  { x: -0.0255, splay: -0.1, len: [0.040, 0.024, 0.021], r: 0.0094 },
  { x: -0.0085, splay: -0.03, len: [0.044, 0.028, 0.023], r: 0.0097 },
  { x: 0.0085, splay: 0.04, len: [0.041, 0.026, 0.022], r: 0.0092 },
  { x: 0.0245, splay: 0.12, len: [0.032, 0.02, 0.019], r: 0.0081 },
];
const KNUCKLE_Z = -0.088, KNUCKLE_Y = 0.0;
const THUMB = { base: new THREE.Vector3(-0.026, -0.006, -0.018), dir: new THREE.Vector3(-0.62, -0.22, -0.75).normalize(), len: [0.03, 0.025, 0.021], r: 0.0115 };

// ---------- sdf helpers ----------
function sdRoundCone(px, py, pz, a, b, ra, rb) {
  // capsule with linearly varying radius (good approximation for small taper)
  const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z, pax = px - a.x, pay = py - a.y, paz = pz - a.z;
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * h);
}
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function sdEllipsoid(px, py, pz, c, r) {
  const x = (px - c.x) / r.x, y = (py - c.y) / r.y, z = (pz - c.z) / r.z;
  const k0 = Math.sqrt(x * x + y * y + z * z), k1 = Math.sqrt((x / r.x) ** 2 + (y / r.y) ** 2 + (z / r.z) ** 2);
  return k0 * (k0 - 1) / Math.max(1e-9, k1);
}

// ---------- the skeleton (rest pose) ----------
function restSkeleton() {
  const bones = []; // { name, parent, head, tail, r0, r1 }
  bones.push({ name: 'wrist', parent: -1, head: new THREE.Vector3(0, 0, 0.012), tail: new THREE.Vector3(0, 0, -0.05), r0: 0.024, r1: 0.03 });
  FINGERS.forEach((f, k) => {
    let head = new THREE.Vector3(f.x, KNUCKLE_Y, KNUCKLE_Z + Math.abs(f.x) * 0.25 + (k === 3 ? 0.008 : 0));
    const dir = new THREE.Vector3(Math.sin(f.splay), -0.04, -Math.cos(f.splay)).normalize();
    let parent = 0, r = f.r;
    f.len.forEach((L, j) => {
      const tail = head.clone().addScaledVector(dir, L), r1 = r * (j === 2 ? 0.86 : 0.92);
      bones.push({ name: `f${k}${j}`, parent, head: head.clone(), tail, r0: r, r1 }); parent = bones.length - 1; head = tail; r = r1;
    });
  });
  let head = THUMB.base.clone(), parent = 0, r = THUMB.r;
  THUMB.len.forEach((L, j) => {
    const d = THUMB.dir.clone(); if (j > 0) d.add(new THREE.Vector3(0.18 * j, 0, -0.1 * j)).normalize();
    const tail = head.clone().addScaledVector(d, L), r1 = r * 0.86;
    bones.push({ name: `t${j}`, parent, head: head.clone(), tail, r0: r, r1 }); parent = bones.length - 1; head = tail; r = r1;
  });
  return bones;
}

// ---------- the sculpt ----------
function makeSdf(bones) {
  const palmC = new THREE.Vector3(0, 0.0, -0.048), palmR = new THREE.Vector3(0.046, 0.0155, 0.05);
  const thenarC = new THREE.Vector3(-0.022, -0.009, -0.03), thenarR = new THREE.Vector3(0.019, 0.013, 0.026);
  const hypoC = new THREE.Vector3(0.025, -0.008, -0.045), hypoR = new THREE.Vector3(0.014, 0.011, 0.03);
  const knuck = FINGERS.map((f, k) => bones[1 + k * 3].head.clone().add(new THREE.Vector3(0, 0.005, 0.003)));
  const fingerBones = bones.filter(b => b.name[0] === 'f'), thumbBones = bones.filter(b => b.name[0] === 't');
  return (x, y, z) => {
    // palm: flattened ellipsoid, a bit hollow on the palm side, padded muscles
    let d = sdEllipsoid(x, y, z, palmC, palmR);
    d += Math.max(0, -y) * 0.0 + 0.0025 * Math.exp(-((x * x) / 0.0004 + ((z + 0.05) ** 2) / 0.0009)) * (y < 0 ? 1 : 0);
    d = smin(d, sdEllipsoid(x, y, z, thenarC, thenarR), 0.014);
    d = smin(d, sdEllipsoid(x, y, z, hypoC, hypoR), 0.012);
    // wrist / forearm stub
    d = smin(d, sdRoundCone(x, y, z, new THREE.Vector3(0, 0.002, 0.06), new THREE.Vector3(0, 0.001, -0.01), 0.025, 0.027), 0.02);
    // knuckles on the back
    for (const c of knuck) d = smin(d, Math.hypot(x - c.x, y - c.y, z - c.z) - 0.0085, 0.008);
    // fingers: smooth into the palm, but kept apart from each other (hard union)
    let fd = 1;
    for (const b of fingerBones) {
      let s = sdRoundCone(x, y, z, b.head, b.tail, b.r0, b.r1);
      // finger pad bulge on the palm side
      s -= 0.0011 * Math.max(0, -(y - (b.head.y + b.tail.y) / 2)) / b.r0;
      fd = Math.min(fd, s);
    }
    d = smin(d, fd, 0.0075);
    let td = 1; for (const b of thumbBones) td = smin(td, sdRoundCone(x, y, z, b.head, b.tail, b.r0, b.r1), 0.006);
    d = smin(d, td, 0.014);
    return d;
  };
}

// ---------- surface nets ----------
function surfaceNets(sdf, min, max, step) {
  const nx = Math.ceil((max.x - min.x) / step) + 1, ny = Math.ceil((max.y - min.y) / step) + 1, nz = Math.ceil((max.z - min.z) / step) + 1;
  const F = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[i + nx * (j + ny * k)] = sdf(min.x + i * step, min.y + j * step, min.z + k * step);
  const vid = new Int32Array(nx * ny * nz).fill(-1), pos = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const val = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let inside = 0;
    for (let c = 0; c < 8; c++) { const v = F[(i + C[c][0]) + nx * ((j + C[c][1]) + ny * (k + C[c][2]))]; val[c] = v; if (v < 0) inside++; }
    if (inside === 0 || inside === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      if ((val[a] < 0) === (val[b] < 0)) continue;
      const t = val[a] / (val[a] - val[b]);
      sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++;
    }
    vid[i + nx * (j + ny * k)] = pos.length / 3;
    pos.push(min.x + (i + sx / n) * step, min.y + (j + sy / n) * step, min.z + (k + sz / n) * step);
  }
  const idx = [];
  const at = (i, j, k) => vid[i + nx * (j + ny * k)];
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = F[i + nx * (j + ny * k)];
    // edges along +x, +y, +z from this grid point
    const dirs = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let a = 0; a < 3; a++) {
      const [dx, dy, dz] = dirs[a]; const v1 = F[(i + dx) + nx * ((j + dy) + ny * (k + dz))];
      if ((v0 < 0) === (v1 < 0)) continue;
      // the 4 cells sharing this edge
      let q;
      if (a === 0) q = [at(i, j - 1, k - 1), at(i, j, k - 1), at(i, j, k), at(i, j - 1, k)];
      else if (a === 1) q = [at(i - 1, j, k - 1), at(i - 1, j, k), at(i, j, k), at(i, j, k - 1)];
      else q = [at(i - 1, j - 1, k), at(i, j - 1, k), at(i, j, k), at(i - 1, j, k)];
      if (q.some(v => v < 0)) continue;
      if (v0 < 0) idx.push(q[0], q[1], q[2], q[0], q[2], q[3]); else idx.push(q[0], q[2], q[1], q[0], q[3], q[2]);
    }
  }
  return { pos, idx };
}

// ---------- build (cached) ----------
let CACHE = null;
function buildBase() {
  if (CACHE) return CACHE;
  const bones = restSkeleton(), sdf = makeSdf(bones);
  const { pos, idx } = surfaceNets(sdf, new THREE.Vector3(-0.08, -0.04, -0.2), new THREE.Vector3(0.06, 0.035, 0.07), 0.0017);
  const n = pos.length / 3, nor = new Float32Array(n * 3), col = new Float32Array(n * 3), e = 0.0006;
  for (let v = 0; v < n; v++) {
    let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    // project onto the surface (2 Newton steps) and take the gradient as normal
    for (let it = 0; it < 2; it++) {
      const d = sdf(x, y, z), gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e);
      const l = Math.hypot(gx, gy, gz) || 1; x -= gx / l * d; y -= gy / l * d; z -= gz / l * d;
      if (it === 1) { nor[v * 3] = gx / l; nor[v * 3 + 1] = gy / l; nor[v * 3 + 2] = gz / l; }
    }
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
  }
  // skin weights: smooth inverse-distance to the bone segments, 4 strongest
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), P = new THREE.Vector3();
  const segD = (b, p) => { const ab = b.tail.clone().sub(b.head), t = Math.min(1, Math.max(0, p.clone().sub(b.head).dot(ab) / ab.lengthSq())); return { d: p.distanceTo(b.head.clone().addScaledVector(ab, t)) - (b.r0 + (b.r1 - b.r0) * t), t }; };
  for (let v = 0; v < n; v++) {
    P.set(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
    const ws = bones.map((b, k) => {
      const { d, t } = segD(b, P);
      let w = 1 / Math.pow(Math.max(0.0008, d + 0.004), 4);
      if (b.name === 'wrist') w *= 0.45;
      if (b.name !== 'wrist' && t <= 0) w *= 0.35; // behind a joint: let the parent bone win
      return [k, w];
    }).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const s = ws.reduce((a, [, w]) => a + w, 0);
    ws.forEach(([k, w], j) => { si[v * 4 + j] = k; sw[v * 4 + j] = w / s; });
    // vertex colour: nails, blush on knuckles and finger tips, lighter palm
    const top = ws[0][0], b = bones[top];
    let r = 1, g = 1, bl = 1; const ny = nor[v * 3 + 1];
    if (ny < -0.2) { const k = Math.min(1, (-ny - 0.2) * 1.6); r = 1 + 0.06 * k; g = 1 + 0.03 * k; bl = 1 + 0.02 * k; } // palm side lighter
    if (b.name.length === 3 && b.name[2] === '2' || b.name === 't2') {
      const { t } = segD(b, P);
      if (ny > 0.45 && t > 0.3) { const k = Math.min(1, (ny - 0.45) * 5) * Math.min(1, (t - 0.3) * 6); r = r * (1 - k) + 1.2 * k; g = g * (1 - k) + 1.02 * k; bl = bl * (1 - k) + 1.0 * k; } // nail
      else if (t > 0.6) { r *= 1.03; g *= 0.93; bl *= 0.92; } // pinker tip
    }
    if (b.name.length === 3 && b.name[2] === '0') { const { t } = segD(b, P); if (t < 0.25 && ny > 0.3) { r *= 1.02; g *= 0.94; bl *= 0.93; } }
    col[v * 3] = r; col[v * 3 + 1] = g; col[v * 3 + 2] = bl;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(idx);
  CACHE = { geo, bones };
  return CACHE;
}

export function skinMaterial(color = 0xd99a78) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.52, metalness: 0, vertexColors: true, sheen: 0.6, sheenColor: new THREE.Color(0xff8a6a), sheenRoughness: 0.55, clearcoat: 0.06, clearcoatRoughness: 0.6 });
}
export function gloveMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: 0x8a5a2e, roughness: 0.82, metalness: 0, sheen: 0.4, sheenColor: new THREE.Color(0xc89060), sheenRoughness: 0.8 });
}

// A posable hand. side: 1 = right, −1 = left (mirrored).
export class Hand {
  constructor(side = 1, material = skinMaterial()) {
    const { geo, bones } = buildBase();
    let g = geo;
    if (side < 0) { // mirror: flip x and the winding
      g = geo.clone(); const p = g.attributes.position, n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) { p.setX(i, -p.getX(i)); n.setX(i, -n.getX(i)); }
      const ix = g.index.array.slice(); for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.setIndex(Array.from(ix));
    }
    this.side = side;
    this.bones = bones.map(b => { const o = new THREE.Bone(); o.name = b.name; return o; });
    bones.forEach((b, k) => {
      const head = b.head.clone(); if (side < 0) head.x = -head.x;
      if (b.parent < 0) this.bones[k].position.copy(head);
      else { const ph = bones[b.parent].head.clone(); if (side < 0) ph.x = -ph.x; this.bones[k].position.copy(head).sub(ph); this.bones[b.parent].add(this.bones[k]); }
    });
    this.mesh = new THREE.SkinnedMesh(g, material);
    this.mesh.add(this.bones[0]); this.mesh.bind(new THREE.Skeleton(this.bones));
    this.mesh.frustumCulled = false; this.mesh.castShadow = false;
    this.group = new THREE.Group(); this.group.add(this.mesh);
    this.cur = { curl: [0.15, 0.15, 0.18, 0.22], thumb: 0.1, opp: 0.2, spread: 0 };
    this.apply(this.cur);
  }
  setMaterial(m) { this.mesh.material = m; }
  // curl: 0 = straight, 1 = fist (per finger); thumb: flexion; opp: thumb swing across the palm
  apply(p) {
    const s = this.side, B = this.bones;
    for (let k = 0; k < 4; k++) {
      const c = p.curl[k], sp = (p.spread || 0) * (k - 1.5) * 0.12;
      B[1 + k * 3].rotation.set(-c * 1.35, s * sp, 0);
      B[2 + k * 3].rotation.set(-c * 1.6, 0, 0);
      B[3 + k * 3].rotation.set(-c * 1.1, 0, 0);
    }
    const t = p.thumb, o = p.opp;
    B[13].rotation.set(-o * 0.2, -s * o * 0.9, s * o * 0.6);
    B[14].rotation.set(-t * 0.9, s * t * 0.3, 0);
    B[15].rotation.set(-t * 1.0, 0, 0);
  }
  // smooth blend toward a target pose
  blend(target, k) {
    const c = this.cur;
    for (let i = 0; i < 4; i++) c.curl[i] += (target.curl[i] - c.curl[i]) * k;
    c.thumb += (target.thumb - c.thumb) * k; c.opp += (target.opp - c.opp) * k; c.spread += ((target.spread || 0) - c.spread) * k;
    this.apply(c);
  }
}
export const POSES = {
  relaxed: { curl: [0.22, 0.26, 0.3, 0.36], thumb: 0.15, opp: 0.15, spread: 0.2 },
  cup: { curl: [0.32, 0.3, 0.32, 0.36], thumb: 0.2, opp: 0.55, spread: 0 },
  grip: { curl: [0.8, 0.85, 0.88, 0.9], thumb: 0.55, opp: 0.75, spread: 0 },
  reach: { curl: [0.05, 0.05, 0.08, 0.12], thumb: 0.05, opp: 0.1, spread: 0.6 },
  book: { curl: [0.04, 0.05, 0.07, 0.1], thumb: 0.45, opp: 0.75, spread: 0.15 },
};
