/* =====================================================================
   Roblox Forge · Jouer — the 3D view of script-built Terrain.
   Each 16³ chunk that changed becomes one mesh: only the voxel faces that
   touch air (or water) are drawn, coloured by the material's terrain
   colour with a little per-voxel variation; water is a separate
   translucent mesh you can walk through. Solid chunks join the collision
   grid, so the player walks on terrain and raycasts hit it.
   ===================================================================== */
import * as THREE from 'three';
import { VOX, CH, MATS } from '../luau/terrain.js?v=12';

const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const WATER = MATS.indexOf('Water');
export class TerrainView {
  constructor(world, data) { this.W = world; this.T = data; this.meshes = new Map(); this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }); this.water = new THREE.MeshStandardMaterial({ color: '#0c545c', transparent: true, opacity: 0.7, roughness: 0.1, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }); }
  update() {
    if (!this.T.dirty.size) return; let n = 0;
    for (const c of [...this.T.dirty]) { this.T.dirty.delete(c); this.build(c); if (++n >= 3) break; } // a few chunks per frame keeps the frame rate
  }
  drop(k) { const e = this.meshes.get(k); if (!e) return; for (const m of [e.solid, e.wet]) if (m) { this.W.root.remove(m); m.geometry.dispose(); this.unGrid(m); } this.meshes.delete(k); }
  unGrid(m) { const ks = m.userData.cells; if (!ks) return; for (const k of ks) { const l = this.W.grid.get(k); if (l) { const i = l.indexOf(m); if (i >= 0) l.splice(i, 1); } } }
  build(c) {
    const key = c.cx + ',' + c.cy + ',' + c.cz; this.drop(key); const T = this.T, base = [c.cx * CH, c.cy * CH, c.cz * CH];
    const solid = { p: [], n: [], c: [] }, wet = { p: [], n: [], c: [] }; const col = new THREE.Color(); const wc = this.T.inst.props.get('WaterColor'); if (wc) this.water.color.setRGB(wc.r, wc.g, wc.b, THREE.SRGBColorSpace);
    for (let x = 0; x < CH; x++) for (let y = 0; y < CH; y++) for (let z = 0; z < CH; z++) {
      const i = (x * CH + y) * CH + z, m = c.m[i]; if (!m || c.o[i] < 40) continue; const wx = base[0] + x, wy = base[1] + y, wz = base[2] + z; const isW = m === WATER, out = isW ? wet : solid;
      const rgb = T.colors[MATS[m]] || [128, 128, 128]; const v = 0.93 + (((wx * 73856093) ^ (wy * 19349663) ^ (wz * 83492791)) & 15) / 140; col.setRGB(rgb[0] / 255 * v, rgb[1] / 255 * v, rgb[2] / 255 * v, THREE.SRGBColorSpace);
      for (const d of DIRS) { const [nm, no] = T.get(wx + d[0], wy + d[1], wz + d[2]); const open = !nm || no < 40 || (!isW && nm === WATER); if (!open || (isW && nm)) continue; face(out, wx, wy, wz, d, col, isW && d[1] === 1 ? 0.85 : 1); }
    }
    const e = {}; const mk = (b, mat, collide) => { if (!b.p.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
      const m = new THREE.Mesh(g, mat); m.castShadow = !!collide; m.receiveShadow = true; this.W.root.add(m); g.computeBoundingBox(); g.computeBoundingSphere();
      if (collide) { m.updateMatrixWorld(true); m.userData = { inst: this.T.inst, box: g.boundingBox.clone(), terrain: true }; const cs = this.W.cell, bb = g.boundingBox, ks = [];
        for (let x = Math.floor(bb.min.x / cs); x <= Math.floor(bb.max.x / cs); x++) for (let z = Math.floor(bb.min.z / cs); z <= Math.floor(bb.max.z / cs); z++) { const k = x + ',' + z; if (!this.W.grid.has(k)) this.W.grid.set(k, []); this.W.grid.get(k).push(m); ks.push(k); } m.userData.cells = ks; }
      return m; };
    e.solid = mk(solid, this.mat, true); e.wet = mk(wet, this.water, false); this.meshes.set(key, e);
  }
}
function face(b, x, y, z, d, col, top) {
  const s = VOX, X = x * s, Y = y * s, Z = z * s; const quads = {
    '1,0,0': [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], '-1,0,0': [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], '0,1,0': [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
    '0,-1,0': [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], '0,0,1': [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], '0,0,-1': [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }[d.join(',')];
  const q = quads.map((v) => [X + v[0] * s, Y + (v[1] === 1 ? top : v[1]) * s, Z + v[2] * s]); const shade = d[1] === 1 ? 1 : d[1] === -1 ? 0.6 : 0.82;
  for (const i of [0, 1, 2, 0, 2, 3]) { b.p.push(...q[i]); b.n.push(...d); b.c.push(col.r * shade, col.g * shade, col.b * shade); }
}
