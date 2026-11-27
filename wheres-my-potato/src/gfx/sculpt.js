import * as THREE from 'three';

// =====================================================================================
// SCULPT — turns a signed-distance function into a clean, smooth mesh (Surface Nets +
// Newton projection onto the surface + gradient normals) with optional vertex colours,
// UVs and skin weights. Used for every organic model (hands, Gérard's head and body…).
// =====================================================================================

// ---------- SDF primitives (all in metres) ----------
export function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
export function smax(a, b, k) { return -smin(-a, -b, k); }
export function sdSphere(x, y, z, cx, cy, cz, r) { return Math.hypot(x - cx, y - cy, z - cz) - r; }
export function sdEll(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
  const k0 = Math.sqrt(px * px + py * py + pz * pz), k1 = Math.sqrt((px / rx) ** 2 + (py / ry) ** 2 + (pz / rz) ** 2);
  return k0 * (k0 - 1) / Math.max(1e-9, k1);
}
export function sdCone(x, y, z, ax, ay, az, bx, by, bz, ra, rb) { // capsule with linear taper
  const bax = bx - ax, bay = by - ay, baz = bz - az, pax = x - ax, pay = y - ay, paz = z - az;
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
}
export function sdRBox(x, y, z, cx, cy, cz, hx, hy, hz, r) {
  const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

// ---------- surface nets ----------
export function surfaceNets(sdf, min, max, step) {
  const nx = Math.ceil((max.x - min.x) / step) + 1, ny = Math.ceil((max.y - min.y) / step) + 1, nz = Math.ceil((max.z - min.z) / step) + 1;
  const F = new Float32Array(nx * ny * nz);
  // coarse-to-fine: sample every S voxels first; voxels whose nearest coarse sample is far
  // from the surface keep that value (same sign, only cells crossing the surface matter)
  const S = 4, cx = Math.ceil((nx - 1) / S) + 1, cy = Math.ceil((ny - 1) / S) + 1, cz = Math.ceil((nz - 1) / S) + 1;
  const Cg = new Float32Array(cx * cy * cz);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) Cg[i + cx * (j + cy * k)] = sdf(min.x + i * S * step, min.y + j * S * step, min.z + k * S * step);
  const far = S * step * 1.6;
  for (let k = 0; k < nz; k++) { const ck = Math.min(cz - 1, Math.round(k / S)); for (let j = 0; j < ny; j++) { const cj = Math.min(cy - 1, Math.round(j / S)); for (let i = 0; i < nx; i++) {
    const dc = Cg[Math.min(cx - 1, Math.round(i / S)) + cx * (cj + cy * ck)];
    F[i + nx * (j + ny * k)] = Math.abs(dc) > far ? dc : sdf(min.x + i * step, min.y + j * step, min.z + k * step);
  } } }
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
  const idx = [], at = (i, j, k) => vid[i + nx * (j + ny * k)];
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = F[i + nx * (j + ny * k)];
    for (let a = 0; a < 3; a++) {
      const v1 = a === 0 ? F[(i + 1) + nx * (j + ny * k)] : a === 1 ? F[i + nx * ((j + 1) + ny * k)] : F[i + nx * (j + ny * (k + 1))];
      if ((v0 < 0) === (v1 < 0)) continue;
      let q;
      if (a === 0) q = [at(i, j - 1, k - 1), at(i, j, k - 1), at(i, j, k), at(i, j - 1, k)];
      else if (a === 1) q = [at(i - 1, j, k - 1), at(i - 1, j, k), at(i, j, k), at(i, j, k - 1)];
      else q = [at(i - 1, j - 1, k), at(i, j - 1, k), at(i, j, k), at(i - 1, j, k)];
      if (q[0] < 0 || q[1] < 0 || q[2] < 0 || q[3] < 0) continue;
      if (v0 < 0) idx.push(q[0], q[1], q[2], q[0], q[2], q[3]); else idx.push(q[0], q[2], q[1], q[0], q[3], q[2]);
    }
  }
  return { pos, idx };
}

// colours are authored in sRGB and stored linear (what three.js expects for vertex colours)
const lin = c => Math.pow(Math.max(0, c), 2.2);
// sculpt(sdf, min, max, step, { color(x,y,z,nx,ny,nz) → [r,g,b], uv(x,y,z,nx,ny,nz) → [u,v] })
export function sculpt(sdf, min, max, step, opts = {}) {
  const { pos, idx } = surfaceNets(sdf, min, max, step);
  const n = pos.length / 3, nor = new Float32Array(n * 3), e = step * 0.35;
  for (let v = 0; v < n; v++) {
    let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], gx = 0, gy = 1, gz = 0;
    for (let it = 0; it < 1; it++) {
      const d = sdf(x, y, z); gx = sdf(x + e, y, z) - sdf(x - e, y, z); gy = sdf(x, y + e, z) - sdf(x, y - e, z); gz = sdf(x, y, z + e) - sdf(x, y, z - e);
      const l = Math.hypot(gx, gy, gz) || 1; gx /= l; gy /= l; gz /= l; x -= gx * d; y -= gy * d; z -= gz * d;
    }
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; nor[v * 3] = gx; nor[v * 3 + 1] = gy; nor[v * 3 + 2] = gz;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (opts.color) { const c = new Float32Array(n * 3); for (let v = 0; v < n; v++) { const r = opts.color(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]); c[v * 3] = lin(r[0]); c[v * 3 + 1] = lin(r[1]); c[v * 3 + 2] = lin(r[2]); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  if (opts.uv) { const u = new Float32Array(n * 2); for (let v = 0; v < n; v++) { const r = opts.uv(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]); u[v * 2] = r[0]; u[v * 2 + 1] = r[1]; } g.setAttribute('uv', new THREE.BufferAttribute(u, 2)); }
  g.setIndex(idx);
  return g;
}
