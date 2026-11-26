import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Geometry helpers: world-scaled UVs + static batching (merge by material → few draw calls).

export function scaleUVs(geo, sx, sy, tile) {
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx / tile, uv.getY(i) * sy / tile);
  return geo;
}
// Box with per-face UVs scaled to real dimensions
export function boxGeo(w, h, d, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // face order: +x,-x,+y,-y,+z,-z ; 4 verts each
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  return g;
}
export function cylGeo(rt, rb, h, seg = 16, tile = 1, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  return scaleUVs(g, Math.PI * 2 * Math.max(rt, rb), h, tile);
}

export class Batcher {
  constructor() { this.items = new Map(); }
  add(geo, mat, matrix, { cast = true, receive = true } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    // keep only common attributes so merges succeed
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const key = mat.uuid + (cast ? 'c' : '') + (receive ? 'r' : '');
    if (!this.items.has(key)) this.items.set(key, { mat, cast, receive, geos: [] });
    this.items.get(key).geos.push(g);
  }
  addMesh(mesh, opts) { mesh.updateMatrixWorld(true); this.add(mesh.geometry, mesh.material, mesh.matrixWorld, opts); }
  // Adds every mesh in an object tree (used for composite props)
  addTree(obj, opts) { obj.updateMatrixWorld(true); obj.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !o.userData.dynamic) this.add(o.geometry, o.material, o.matrixWorld, { cast: o.castShadow || opts?.cast, receive: true }); }); }
  build(parent) {
    const out = [];
    for (const it of this.items.values()) {
      // split into ~65k-vertex groups for mobile GPUs
      let cur = [], cnt = 0;
      const flush = () => {
        if (!cur.length) return;
        const g = mergeGeometries(cur, false);
        if (g) {
          g.computeBoundingSphere(); g.computeBoundingBox();
          const m = new THREE.Mesh(g, it.mat); m.castShadow = it.cast; m.receiveShadow = it.receive; m.matrixAutoUpdate = false;
          parent.add(m); out.push(m);
        }
        cur = []; cnt = 0;
      };
      for (const g of it.geos) { cur.push(g); cnt += g.attributes.position.count; if (cnt > 60000) flush(); }
      flush();
    }
    this.items.clear();
    return out;
  }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
export function mat4(x, y, z, ry = 0, rx = 0, rz = 0, s = 1) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(s, s, s);
  return _m.clone().compose(_p, _q, _s);
}
