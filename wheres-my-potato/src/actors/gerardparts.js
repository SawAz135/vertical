import * as THREE from 'three';
import { sculpt, smin, smax, sdSphere, sdEll, sdCone, sdRBox } from '../gfx/sculpt.js';
import { rng } from '../core/util.js';

// =====================================================================================
// GÉRARD'S SCULPTED PARTS — the head is one smooth sculpt (skull, brow ridge, cheekbones,
// jowls, bulbous nose with nostrils, lips with a mouth crease, ears with a hollow, neck)
// skinned to a head + jaw bone so he really talks; painted with vertex colours (rosy
// nose and cheeks, lips, inner mouth). Walrus moustache, bushy brows, grey fringe and
// a worn cap are separate sculpts; the eyes have a painted iris. The body is a sculpted
// belly + chest + shoulders wearing a plaid shirt under a canvas apron.
// =====================================================================================

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = v => Math.max(0, Math.min(1, v));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------- head ----------------
function headSdf(x, y, z) {
  const ax = Math.abs(x);
  let d = sdEll(x, y, z, 0, 0.105, -0.008, 0.093, 0.106, 0.1);
  d = smin(d, sdEll(x, y, z, 0, 0.07, 0.025, 0.08, 0.086, 0.085), 0.04);
  d = smin(d, sdEll(x, y, z, 0, 0.026, 0.035, 0.068, 0.05, 0.07), 0.03);
  d = smin(d, sdEll(x, y, z, 0, 0.006, 0.074, 0.031, 0.028, 0.03), 0.02);
  d = smin(d, sdEll(ax, y, z, 0.057, 0.04, 0.035, 0.032, 0.042, 0.04), 0.02);
  d = smin(d, sdEll(ax, y, z, 0.05, 0.086, 0.07, 0.028, 0.022, 0.025), 0.018);
  d = smin(d, sdEll(x, y, z, 0, 0.143, 0.077, 0.07, 0.016, 0.025), 0.02);
  d = smax(d, -sdSphere(ax, y, z, 0.037, 0.123, 0.099, 0.02), 0.012);       // eye sockets
  // nose: bridge, bulb, wings, nostrils
  d = smin(d, sdCone(x, y, z, 0, 0.14, 0.09, 0, 0.098, 0.127, 0.011, 0.016), 0.012);
  d = smin(d, sdSphere(x, y, z, 0, 0.09, 0.133, 0.021), 0.01);
  d = smin(d, sdSphere(ax, y, z, 0.018, 0.083, 0.113, 0.012), 0.008);
  d = smax(d, -sdSphere(ax, y, z, 0.009, 0.074, 0.123, 0.0055), 0.004);
  // lips + mouth crease
  d = smin(d, sdEll(x, y, z, 0, 0.055, 0.099, 0.029, 0.009, 0.013), 0.008);
  d = smin(d, sdEll(x, y, z, 0, 0.036, 0.095, 0.026, 0.01, 0.013), 0.008);
  d = smax(d, -sdEll(x, y, z, 0, 0.0465, 0.108, 0.031, 0.0032, 0.03), 0.004);
  // ears with a hollow
  d = smin(d, sdEll(ax, y, z, 0.096, 0.11, -0.004, 0.014, 0.034, 0.023), 0.01);
  d = smax(d, -sdEll(ax, y, z, 0.107, 0.112, 0.0, 0.007, 0.02, 0.013), 0.006);
  // neck
  d = smin(d, sdCone(x, y, z, 0, -0.075, -0.012, 0, 0.05, -0.012, 0.063, 0.058), 0.03);
  return d;
}
function headColor(x, y, z, nx, ny, nz) {
  const ax = Math.abs(x);
  let r = 0.93, g = 0.75, b = 0.64;
  const rosy = Math.max(sstep(0.035, 0.0, Math.hypot(x, y - 0.09, z - 0.133)), sstep(0.04, 0.0, Math.hypot(ax - 0.05, y - 0.075, z - 0.08)) * 0.7);
  r += rosy * 0.03; g -= rosy * 0.12; b -= rosy * 0.1;
  const lip = Math.max(sstep(0.006, 0.0, sdEll(x, y, z, 0, 0.055, 0.099, 0.029, 0.009, 0.013)), sstep(0.006, 0.0, sdEll(x, y, z, 0, 0.036, 0.095, 0.026, 0.01, 0.013)));
  r = r * (1 - lip) + 0.78 * lip; g = g * (1 - lip) + 0.46 * lip; b = b * (1 - lip) + 0.42 * lip;
  const mouth = sstep(0.004, 0.0, sdEll(x, y, z, 0, 0.0465, 0.104, 0.031, 0.005, 0.03));
  r = r * (1 - mouth) + 0.3 * mouth; g = g * (1 - mouth) + 0.08 * mouth; b = b * (1 - mouth) + 0.07 * mouth;
  const sock = sstep(0.03, 0.012, Math.hypot(ax - 0.037, y - 0.123, z - 0.09)); r -= sock * 0.08; g -= sock * 0.1; b -= sock * 0.05;
  const earIn = sstep(0.01, 0.0, sdEll(ax, y, z, 0.107, 0.112, 0.0, 0.009, 0.022, 0.015)); r -= earIn * 0.12; g -= earIn * 0.2; b -= earIn * 0.16;
  // stubble on the jaw
  const st = sstep(0.06, 0.02, y) * sstep(-0.02, 0.03, z) * 0.18; r -= st * 0.4; g -= st * 0.35; b -= st * 0.3;
  void nx; void ny; void nz;
  return [r, g, b];
}
export function makeHead(skinMat) {
  const geo = sculpt(headSdf, V(-0.13, -0.08, -0.125), V(0.13, 0.225, 0.17), 0.0034, { color: headColor });
  // skin to head (0) + jaw (1)
  const p = geo.attributes.position, n = p.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let w = sstep(0.05, 0.03, y) * sstep(-0.035, 0.02, z) * sstep(-0.05, 0.0, y);
    if (Math.abs(x) > 0.075) w *= sstep(0.095, 0.075, Math.abs(x));
    si[i * 4] = 0; si[i * 4 + 1] = 1; sw[i * 4] = 1 - w; sw[i * 4 + 1] = w;
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const mesh = new THREE.SkinnedMesh(geo, skinMat);
  const root = new THREE.Bone(), jaw = new THREE.Bone(); jaw.position.set(0, 0.05, 0.0); root.add(jaw);
  mesh.add(root); mesh.bind(new THREE.Skeleton([root, jaw]));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  return { mesh, jaw };
}

// ---------------- hair pieces ----------------
const hairMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
function hairColor(base) {
  return (x, y, z, nx, ny, nz) => {
    const s = Math.sin(x * 900 + Math.sin(y * 600) * 2) * 0.5 + 0.5, k = 0.82 + s * 0.22 - Math.max(0, -ny) * 0.25;
    void z; void nz; void nx;
    return [base[0] * k, base[1] * k, base[2] * k];
  };
}
export function makeMoustache() {
  const sdf = (x, y, z) => {
    let d = 1;
    for (let k = -6; k <= 6; k++) {
      const t = k / 6, a = Math.abs(t);
      d = smin(d, sdEll(x, y, z, t * 0.046, 0.063 - 0.016 * t * t, 0.11 - 0.024 * t * t, 0.014 * (1 - 0.3 * a), 0.011 * (1 - 0.25 * a), 0.011), 0.008);
    }
    return d + 0.0006 * Math.sin(x * 700 + y * 120);
  };
  const g = sculpt(sdf, V(-0.07, 0.035, 0.07), V(0.07, 0.085, 0.13), 0.0016, { color: hairColor([0.86, 0.84, 0.8]) });
  const m = new THREE.Mesh(g, hairMat()); m.castShadow = true; return m;
}
export function makeBrow(side) {
  const sdf = (x, y, z) => {
    let d = 1;
    for (let k = 0; k <= 5; k++) { const t = k / 5; d = smin(d, sdEll(x, y, z, side * (0.012 + t * 0.042) - side * 0.04, 0.004 + Math.sin(t * Math.PI) * 0.004 - t * 0.002, -0.004 - t * 0.012, 0.009, 0.006 * (1 - t * 0.3), 0.007), 0.006); }
    return d;
  };
  const g = sculpt(sdf, V(-0.05, -0.02, -0.03), V(0.05, 0.025, 0.02), 0.0013, { color: hairColor([0.78, 0.76, 0.72]) });
  const m = new THREE.Mesh(g, hairMat()); m.castShadow = true; return m;
}
export function makeFringe() {
  const sdf = (x, y, z) => {
    const sk = sdEll(x, y, z, 0, 0.105, -0.008, 0.093, 0.106, 0.1);
    let d = Math.abs(sk - 0.006) - 0.007;
    d = smax(d, y - 0.165 - 0.02 * Math.sin(x * 60) * 0.3, 0.01);               // under the cap
    d = smax(d, 0.075 - y + 0.012 * Math.sin(Math.atan2(x, z) * 9), 0.01);      // ragged lower edge
    d = smax(d, z - 0.035, 0.02);                                                 // nothing on the face
    return d;
  };
  const g = sculpt(sdf, V(-0.12, 0.05, -0.13), V(0.12, 0.2, 0.06), 0.0026, { color: hairColor([0.75, 0.73, 0.69]) });
  const m = new THREE.Mesh(g, hairMat()); m.castShadow = true; return m;
}
export function makeCap() {
  const sdf = (x, y, z) => {
    let crown = sdEll(x, y, z, 0, 0.158, -0.01, 0.103, 0.082, 0.109);
    crown = smax(crown, 0.158 - y, 0.004);
    // visor: a flattened half-disc in front, gently tipped down
    const yv = y + (z - 0.06) * 0.22 + 1.2 * x * x;
    const visor = smax(sdEll(x, yv, z, 0, 0.163, 0.07, 0.088, 0.0055, 0.1), 0.05 - z, 0.004);
    let d = Math.min(crown, visor);
    d = smin(d, sdSphere(x, y, z, 0, 0.238, -0.01, 0.009), 0.004);
    return d;
  };
  const color = (x, y, z) => {
    const a = Math.atan2(x, z), seam = Math.abs(Math.sin(a * 3)) < 0.06 && y > 0.17 ? 0.7 : 1;
    const patch = z > 0.05 && Math.hypot(x / 0.026, (y - 0.2) / 0.018) < 1 && y > 0.17;
    const band = y < 0.172 && y > 0.158 ? 0.82 : 1;
    if (patch) { const inner = Math.hypot(x / 0.018, (y - 0.2) / 0.012) < 1; return inner ? [0.86, 0.62, 0.22] : [0.85, 0.8, 0.7]; }
    return [0.16 * seam * band, 0.27 * seam * band, 0.46 * seam * band];
  };
  const g = sculpt(sdf, V(-0.12, 0.11, -0.13), V(0.12, 0.25, 0.2), 0.0026, { color });
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); m.castShadow = true; return m;
}

// ---------------- eyes ----------------
let irisTex = null;
function irisTexture() {
  if (irisTex) return irisTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'), r = rng(12);
  x.fillStyle = '#f2ede4'; x.fillRect(0, 0, 512, 256);
  for (let k = 0; k < 40; k++) { x.strokeStyle = `rgba(190,60,50,${0.15 + r() * 0.2})`; x.lineWidth = 0.8; x.beginPath(); let px = r() * 512, py = 256 - r() * 60; x.moveTo(px, py); for (let s = 0; s < 5; s++) { px += (r() - 0.5) * 30; py -= r() * 30; x.lineTo(px, py); } x.stroke(); }
  // iris occupies the top rows (the front pole once rotated)
  const irisH = 50, pupH = 19;
  for (let y = 0; y < irisH + 4; y++) for (let X = 0; X < 512; X += 2) {
    const t = y / irisH; let col;
    if (y < pupH) col = [8, 6, 6];
    else if (y < irisH) { const streak = 0.75 + 0.25 * Math.sin(X * 0.4 + Math.sin(X * 0.13) * 3); const ring = t > 0.85 ? 0.55 : 1; col = [70 * streak * ring + 30 * (1 - t), 108 * streak * ring, 128 * streak * ring]; }
    else col = [200, 190, 180];
    x.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`; x.fillRect(X, y, 2, 1);
  }
  irisTex = new THREE.CanvasTexture(c); irisTex.colorSpace = THREE.SRGBColorSpace; return irisTex;
}
export function makeEyeball() {
  const g = new THREE.SphereGeometry(0.019, 32, 24); g.rotateX(Math.PI / 2); // texture pole looks forward (+z)
  const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ map: irisTexture(), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 }));
  return m;
}

// ---------------- torso + apron ----------------
function bodySdf(x, y, z) {
  let d = sdEll(x, y, z, 0, 0.19, 0.045, 0.215, 0.2, 0.205);                      // belly
  d = smin(d, sdEll(x, y, z, 0, 0.4, 0.0, 0.215, 0.16, 0.15), 0.08);                // chest
  d = smin(d, sdCone(x, y, z, -0.19, 0.5, -0.01, 0.19, 0.5, -0.01, 0.07, 0.07), 0.07); // shoulders
  d = smin(d, sdEll(x, y, z, 0, 0.02, 0.0, 0.19, 0.1, 0.15), 0.06);                 // waist
  d = smin(d, sdCone(x, y, z, 0, 0.5, 0.0, 0, 0.6, 0.0, 0.07, 0.065), 0.03);        // collar
  return d;
}
export function makeTorso(shirtMat) {
  const g = sculpt(bodySdf, V(-0.3, -0.1, -0.2), V(0.3, 0.64, 0.3), 0.009, {
    uv: (x, y, z) => [Math.atan2(x, z) / (2 * Math.PI) * 2.6, y * 2.6],
  });
  const m = new THREE.Mesh(g, shirtMat); m.castShadow = true; m.receiveShadow = true; return m;
}
export function makeApron() {
  const sdf = (x, y, z) => {
    let d = Math.abs(bodySdf(x, y, z) - 0.013) - 0.004;
    d = smax(d, 0.02 - z, 0.01);                                     // front only
    d = smax(d, y - (0.46 - 0.12 * Math.abs(x) * 4), 0.01);          // bib top
    d = smax(d, -0.12 - y, 0.005);
    d = smax(d, Math.abs(x) - 0.17 - Math.max(0, 0.15 - y) * 0.4, 0.01);
    // neck strap
    d = Math.min(d, Math.abs(sdCone(x, y, z, 0, 0.5, 0.0, 0, 0.6, 0.0, 0.07, 0.065) - 0.012) - 0.004 + Math.max(0, 0.44 - y) + Math.max(0, y - 0.56));
    return d;
  };
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512; const x = cv.getContext('2d'), r = rng(4);
  x.fillStyle = '#c9b48a'; x.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 4000; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '90,70,40' : '255,250,230'},${0.05 + r() * 0.06})`; x.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1); }
  for (let k = 0; k < 6; k++) { const px = r() * 512, py = 260 + r() * 250, rr = 10 + r() * 40; const gr = x.createRadialGradient(px, py, 0, px, py, rr); gr.addColorStop(0, 'rgba(90,60,30,0.35)'); gr.addColorStop(1, 'rgba(90,60,30,0)'); x.fillStyle = gr; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); } // soil stains
  x.strokeStyle = '#7a5a34'; x.setLineDash([8, 6]); x.lineWidth = 3; x.strokeRect(150, 300, 212, 120); x.strokeRect(14, 14, 484, 484); x.setLineDash([]);
  x.fillStyle = '#7a3a1a'; x.font = '54px Marker, cursive'; x.textAlign = 'center'; x.fillText('GÉRARD', 256, 230);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const g = sculpt(sdf, V(-0.26, -0.15, -0.12), V(0.26, 0.6, 0.3), 0.008, { uv: (x, y) => [x / 0.44 + 0.5, (y + 0.12) / 0.6] });
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide })); m.castShadow = true; m.receiveShadow = true; return m;
}
export function makeSleeve(shirtMat) {
  // upper-arm sleeve with soft folds, rolled up above the elbow
  const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16, y = -t * 0.27; pts.push(new THREE.Vector2(0.06 - t * 0.008 + Math.sin(t * 22) * 0.003, y)); }
  pts.push(new THREE.Vector2(0.066, -0.275), new THREE.Vector2(0.07, -0.29), new THREE.Vector2(0.066, -0.305), new THREE.Vector2(0.05, -0.31));
  const g = new THREE.LatheGeometry(pts, 24); const m = new THREE.Mesh(g, shirtMat); m.castShadow = true; return m;
}
export function makeForearm(skinMat) {
  const sdf = (x, y, z) => smin(sdCone(x, y, z, 0, -0.005, 0, 0, -0.22, 0, 0.046, 0.033), sdEll(x, y, z, 0, -0.06, 0.008, 0.05, 0.07, 0.045), 0.03);
  const g = sculpt(sdf, V(-0.07, -0.26, -0.07), V(0.07, 0.04, 0.07), 0.0045, { color: () => [1, 0.98, 0.97] });
  const m = new THREE.Mesh(g, skinMat); m.castShadow = true; return m;
}
