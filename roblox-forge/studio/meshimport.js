/* =====================================================================
   Roblox Forge - import a 3D model (.glb from Meshy's free plan, Sketchfab,
   Blender…) and turn it into a pet Roblox can show without any upload:
   1. every triangle is sampled (area-weighted) and coloured from its texture,
      vertex colours or material colour;
   2. the surface voxels are flood-filled from outside: what is not reached is
      the hidden interior (wildcards for the block merge);
   3. colours are clustered into a small palette (k-means) so blocks merge;
   4. greedy merge -> parts, same format as every other Forge pet.
   The original .glb can also go to the Roblox Push robot (Blender) to become
   a real HD mesh in the game.
   ===================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { greedyMerge, partsFromBoxes, WILD } from './voxel.js';

const loadGLB = (buffer) => new Promise((res, rej) => new GLTFLoader().parse(buffer, '', res, rej));

// texture -> pixel reader (canvas), cached per texture
function texReader(tex) {
  const img = tex && tex.image; if (!img || !img.width) return null;
  const c = document.createElement('canvas'), w = Math.min(img.width, 1024), h = Math.min(img.height, 1024);
  c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h).data, flip = tex.flipY;
  return (u, v) => { u = ((u % 1) + 1) % 1; v = ((v % 1) + 1) % 1; const x = Math.min(w - 1, Math.floor(u * w)), y = Math.min(h - 1, Math.floor((flip ? 1 - v : v) * h)), i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
}

/** @returns {Promise<{parts, voxels, palette, triangles, size}>} */
export async function voxelizeGLB(buffer, { height = 3.4, res = 40, colors = 14, smooth = 1 } = {}) {
  const gltf = await loadGLB(buffer), root = gltf.scene; root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  if (!(size.y > 0)) throw new Error('modèle vide');
  // Meshy / glTF models face +Z; Roblox pets face -Z: turn 180° around Y. Scale to the wanted height.
  const k = height / Math.max(size.y, size.x * 0.75, size.z * 0.75), v = Math.max(size.x, size.y, size.z) * k / res;
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const toPet = (p) => [-(p.x - cx) * k, (p.y - box.min.y) * k, -(p.z - cz) * k];
  const min = [-(size.x * k) / 2 - v, -v, -(size.z * k) / 2 - v], nx = Math.ceil((size.x * k) / v) + 3, ny = Math.ceil((size.y * k) / v) + 3, nz = Math.ceil((size.z * k) / v) + 3;
  const N = nx * ny * nz, at = (x, y, z) => x + nx * (y + ny * z);
  const sum = new Float32Array(N * 3), cnt = new Uint16Array(N);
  let triangles = 0;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const geo = o.geometry, pos = geo.attributes.position, uv = geo.attributes.uv, col = geo.attributes.color, idx = geo.index;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }];
    for (const grp of groups) {
      const m = mats[grp.materialIndex || 0] || {}, read = texReader(m.map), base = m.color ? [m.color.r * 255, m.color.g * 255, m.color.b * 255] : [200, 200, 200];
      for (let t = grp.start; t + 2 < grp.start + grp.count; t += 3) {
        const ia = idx ? idx.getX(t) : t, ib = idx ? idx.getX(t + 1) : t + 1, ic = idx ? idx.getX(t + 2) : t + 2; triangles++;
        A.fromBufferAttribute(pos, ia).applyMatrix4(o.matrixWorld); B.fromBufferAttribute(pos, ib).applyMatrix4(o.matrixWorld); C.fromBufferAttribute(pos, ic).applyMatrix4(o.matrixWorld);
        const pa = toPet(A), pb = toPet(B), pc = toPet(C);
        const ab = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], ac = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
        const area = 0.5 * Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]);
        const steps = Math.min(60, Math.max(1, Math.ceil(Math.sqrt(area / (v * v)) * 2.2)));
        for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps - i; j++) {
          const a = i / steps, b = j / steps, c = 1 - a - b, p = [pa[0] * c + pb[0] * a + pc[0] * b, pa[1] * c + pb[1] * a + pc[1] * b, pa[2] * c + pb[2] * a + pc[2] * b];
          const x = Math.floor((p[0] - min[0]) / v), y = Math.floor((p[1] - min[1]) / v), z = Math.floor((p[2] - min[2]) / v);
          if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) continue;
          let rgb = base;
          if (read && uv) { const u = uv.getX(ia) * c + uv.getX(ib) * a + uv.getX(ic) * b, w = uv.getY(ia) * c + uv.getY(ib) * a + uv.getY(ic) * b, tx = read(u, w); rgb = [tx[0] * base[0] / 255, tx[1] * base[1] / 255, tx[2] * base[2] / 255]; }
          else if (col) rgb = [col.getX(ia) * 255, col.getY(ia) * 255, col.getZ(ia) * 255];
          const q = at(x, y, z); sum[q * 3] += rgb[0]; sum[q * 3 + 1] += rgb[1]; sum[q * 3 + 2] += rgb[2]; cnt[q] = Math.min(65000, cnt[q] + 1);
        }
      }
    }
  });
  // outside flood fill (6-connected) from the grid border
  const outside = new Uint8Array(N), stack = [];
  const push = (x, y, z) => { if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) return; const i = at(x, y, z); if (outside[i] || cnt[i]) return; outside[i] = 1; stack.push(i); };
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) { push(0, y, z); push(nx - 1, y, z); }
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) { push(x, 0, z); push(x, ny - 1, z); }
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { push(x, y, 0); push(x, y, nz - 1); }
  while (stack.length) { const i = stack.pop(), x = i % nx, y = Math.floor(i / nx) % ny, z = Math.floor(i / (nx * ny)); push(x + 1, y, z); push(x - 1, y, z); push(x, y + 1, z); push(x, y - 1, z); push(x, y, z + 1); push(x, y, z - 1); }
  // palette (k-means on surface colours)
  const surf = []; for (let i = 0; i < N; i++) if (cnt[i]) surf.push(i);
  if (!surf.length) throw new Error('aucune surface trouvée');
  const rgbOf = (i) => [sum[i * 3] / cnt[i], sum[i * 3 + 1] / cnt[i], sum[i * 3 + 2] / cnt[i]];
  let cent = Array.from({ length: Math.min(colors, surf.length) }, (_, j) => rgbOf(surf[Math.floor((j + 0.5) * surf.length / Math.min(colors, surf.length))]));
  const assign = new Uint8Array(N);
  for (let it = 0; it < 8; it++) {
    const acc = cent.map(() => [0, 0, 0, 0]);
    for (const i of surf) { const c = rgbOf(i); let best = 0, bd = Infinity; for (let j = 0; j < cent.length; j++) { const d = (c[0] - cent[j][0]) ** 2 * 0.3 + (c[1] - cent[j][1]) ** 2 * 0.59 + (c[2] - cent[j][2]) ** 2 * 0.11; if (d < bd) { bd = d; best = j; } } assign[i] = best; const a = acc[best]; a[0] += c[0]; a[1] += c[1]; a[2] += c[2]; a[3]++; }
    cent = cent.map((c, j) => (acc[j][3] ? [acc[j][0] / acc[j][3], acc[j][1] / acc[j][3], acc[j][2] / acc[j][3]] : c));
  }
  // majority filter: each surface voxel takes the most common colour around it (cleaner patches, far fewer blocks)
  for (let pass = 0; pass < smooth; pass++) {
    const next = assign.slice();
    for (const i of surf) { const x = i % nx, y = Math.floor(i / nx) % ny, z = Math.floor(i / (nx * ny)), votes = new Map();
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy, Z = z + dz;
        if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue; const j = at(X, Y, Z); if (!cnt[j]) continue; votes.set(assign[j], (votes.get(assign[j]) || 0) + (j === i ? 1.5 : 1)); }
      let best = assign[i], bv = 0; for (const [c, n] of votes) if (n > bv) { bv = n; best = c; } next[i] = best; }
    assign.set(next);
  }
  const hex = (c) => '#' + c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  const keys = cent.map((c) => `Body|${hex(c)}|SmoothPlastic`), grid = new Uint16Array(N);
  let voxels = 0;
  for (let i = 0; i < N; i++) { if (cnt[i]) { grid[i] = assign[i] + 1; voxels++; } else if (!outside[i]) { grid[i] = WILD; voxels++; } }
  const parts = partsFromBoxes(greedyMerge(grid, nx, ny, nz), keys, min, v);
  return { parts, voxels, palette: cent.map(hex), triangles, size: [nx * v, ny * v, nz * v] };
}
