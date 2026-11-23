/* =====================================================================
   Roblox Forge · Jouer — Roblox meshes (MeshPart / SpecialMesh FileMesh).
   Reads every Roblox mesh file version:
     1.00 / 1.01  text ([x,y,z][nx,ny,nz][u,v,w] per corner)
     2.00         binary, vertices + faces
     3.00 / 3.01  + levels of detail (only the finest is drawn)
     4.00 / 4.01  + skinning data (bones / envelopes, skipped)
     5.00         + facial animation data (skipped)
     6.00 / 7.00  chunked: COREMESH (plain, or Draco-compressed in 7.00),
                  LODS, SKINNING, FACS, HSRAVIS
   and turns it into a three.js geometry. Like Roblox, the mesh is centred
   on its bounding box; a MeshPart stretches it to its Size, a FileMesh uses
   its Scale and Offset. Textures (TextureID / TextureId / SurfaceAppearance
   ColorMap) come through the asset relay; transparent texels show the
   part's Color, as in Roblox.
   ===================================================================== */
import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { fetchAsset, assetId, imageURL } from '../assets.js?v=10';

const dec = new TextDecoder();
/* ---------- parsing ---------- */
function vertsFrom(dv, off, n, stride, out) {
  for (let i = 0; i < n; i++) { const o = off + i * stride;
    out.pos.push(dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true));
    out.nrm.push(dv.getFloat32(o + 12, true), dv.getFloat32(o + 16, true), dv.getFloat32(o + 20, true));
    out.uv.push(dv.getFloat32(o + 24, true), 1 - dv.getFloat32(o + 28, true));
    if (stride >= 40) out.col.push(dv.getUint8(o + 36) / 255, dv.getUint8(o + 37) / 255, dv.getUint8(o + 38) / 255); else out.col.push(1, 1, 1); }
  return off + n * stride;
}
function facesFrom(dv, off, n, out, from = 0, to = n) { for (let i = from; i < to; i++) { const o = off + i * 12; out.idx.push(dv.getUint32(o, true), dv.getUint32(o + 4, true), dv.getUint32(o + 8, true)); } return off + n * 12; }
function parseText(txt, version) {
  const lines = txt.split(/\r?\n/); const nums = (lines[2] || '').match(/\[[^\]]*\]/g) || []; const out = { pos: [], nrm: [], uv: [], col: [], idx: [] }; const k = version === '1.00' ? 0.5 : 1;
  for (let i = 0; i + 2 < nums.length; i += 3) { const p = nums[i].slice(1, -1).split(',').map(Number), n = nums[i + 1].slice(1, -1).split(',').map(Number), t = nums[i + 2].slice(1, -1).split(',').map(Number);
    out.pos.push(p[0] * k, p[1] * k, p[2] * k); out.nrm.push(n[0], n[1], n[2]); out.uv.push(t[0], t[1]); out.col.push(1, 1, 1); out.idx.push(out.idx.length); } // 1.x stores V already flipped
  return out;
}
let draco = null;
function dracoLoader() { if (!draco) { draco = new DRACOLoader(); draco.setDecoderPath(new URL('../../studio/vendor/three/jsm/libs/draco/', import.meta.url).href); draco.setWorkerLimit(2); } return draco; }
const decodeDraco = (bytes) => new Promise((res, rej) => dracoLoader().parse(bytes.slice().buffer, res, rej));
async function parseChunked(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); let off = dec.decode(b.subarray(0, 16)).indexOf('\n') + 1; const out = { pos: [], nrm: [], uv: [], col: [], idx: [] }; let lods = null, geo = null;
  while (off + 16 <= b.length) {
    const type = dec.decode(b.subarray(off, off + 8)).replace(/\0+$/, ''), ver = dv.getUint32(off + 8, true), size = dv.getUint32(off + 12, true), at = off + 16; off = at + size;
    if (type === 'COREMESH') {
      if (ver === 1) { const nv = dv.getUint32(at, true); let o = vertsFrom(dv, at + 4, nv, 40, out); const nf = dv.getUint32(o, true); o += 4; out.faceAt = o; out.nf = nf; out.dv = dv; }
      else { const chunk = b.subarray(at, at + size); let s = 0; for (let i = 0; i < Math.min(64, chunk.length - 5); i++) if (dec.decode(chunk.subarray(i, i + 5)) === 'DRACO') { s = i; break; } geo = await decodeDraco(chunk.subarray(s)); }
    } else if (type === 'LODS' && ver === 1) { const n = dv.getUint32(at + 3, true); lods = []; for (let i = 0; i < n; i++) lods.push(dv.getUint32(at + 7 + i * 4, true)); }
  }
  if (geo) { if (lods && lods.length > 1 && geo.index && lods[1] * 3 < geo.index.count) geo.setIndex(new THREE.BufferAttribute(geo.index.array.slice(0, lods[1] * 3), 1)); return { geo }; }
  if (out.dv) { const to = lods && lods.length > 1 ? Math.min(out.nf, lods[1]) : out.nf; facesFrom(out.dv, out.faceAt, out.nf, out, 0, to); }
  return out;
}
export async function parseMesh(b) {
  const head = dec.decode(b.subarray(0, 13)); const m = head.match(/^version (\d\.\d\d)/); if (!m) throw new Error('not a Roblox mesh'); const v = m[1];
  if (v.startsWith('1.')) return parseText(dec.decode(b), v);
  if (v.startsWith('6.') || v.startsWith('7.')) return parseChunked(b);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); let off = head.indexOf('\n') + 1; const out = { pos: [], nrm: [], uv: [], col: [], idx: [] };
  if (v.startsWith('2.')) { const hs = dv.getUint16(off, true), vs = dv.getUint8(off + 2), nv = dv.getUint32(off + 4, true), nf = dv.getUint32(off + 8, true); off += hs; off = vertsFrom(dv, off, nv, vs, out); facesFrom(dv, off, nf, out); return out; }
  if (v.startsWith('3.')) { const hs = dv.getUint16(off, true), vs = dv.getUint8(off + 2), nl = dv.getUint16(off + 6, true), nv = dv.getUint32(off + 8, true), nf = dv.getUint32(off + 12, true); off += hs; off = vertsFrom(dv, off, nv, vs, out);
    const fAt = off; off += nf * 12; const lods = []; for (let i = 0; i < nl; i++) lods.push(dv.getUint32(off + i * 4, true)); facesFrom(dv, fAt, nf, out, 0, nl > 1 ? Math.min(nf, lods[1]) : nf); return out; }
  if (v.startsWith('4.') || v.startsWith('5.')) { const hs = dv.getUint16(off, true), nv = dv.getUint32(off + 4, true), nf = dv.getUint32(off + 8, true), nl = dv.getUint16(off + 12, true), nb = dv.getUint16(off + 14, true); off += hs; off = vertsFrom(dv, off, nv, 40, out);
    if (nb > 0) off += nv * 8; const fAt = off; off += nf * 12; const lods = []; for (let i = 0; i < nl; i++) lods.push(dv.getUint32(off + i * 4, true)); facesFrom(dv, fAt, nf, out, 0, nl > 1 && lods[1] > 0 ? Math.min(nf, lods[1]) : nf); return out; }
  throw new Error('mesh version ' + v);
}
function toGeometry(r) {
  if (r.geo) { const g = r.geo; if (!g.attributes.normal) g.computeVertexNormals(); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); else { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); } return g; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(r.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(r.nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(r.uv, 2)); g.setAttribute('vcol', new THREE.Float32BufferAttribute(r.col, 3));
  const n = r.pos.length / 3; g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(r.idx, 1) : new THREE.Uint16BufferAttribute(r.idx, 1)); return g;
}
/* ---------- cache: mesh id → { geo, box } ---------- */
const meshes = new Map(), meshP = new Map();
export function meshOf(id) { return meshes.get(id); }
export function loadMesh(id) {
  if (!id) return Promise.resolve(null); if (meshP.has(id)) return meshP.get(id);
  const p = fetchAsset(id).then(async (b) => { if (!b) return null; const g = toGeometry(await parseMesh(b)); g.computeBoundingBox(); const box = g.boundingBox; const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3()); const m = { geo: g, size, center }; meshes.set(id, m); return m; })
    .catch((e) => { console.warn('mesh', id, e.message); meshes.set(id, null); return null; });
  meshP.set(id, p); return p;
}
/* what a part shows as its mesh: { id, kind: 'part'|'file', scale, offset, tex, vertexColor } or null */
export function meshSpec(o) {
  if (o.cls === 'MeshPart') { const id = assetId(o.props.get('MeshId') || o.props.get('MeshContent')); if (!id) return null; const sa = o.kids.find((k) => k.cls === 'SurfaceAppearance');
    return { id, kind: 'part', tex: assetId((sa && sa.props.get('ColorMap')) || o.props.get('TextureID') || o.props.get('TextureContent')) }; }
  const sm = o.kids.find((k) => k.cls === 'SpecialMesh'); if (!sm) return null; const mt = sm.props.get('MeshType'); if (mt && mt.name && mt.name !== 'FileMesh') return null; const id = assetId(sm.props.get('MeshId')); if (!id) return null;
  return { id, kind: 'file', scale: sm.props.get('Scale'), offset: sm.props.get('Offset'), vc: sm.props.get('VertexColor'), tex: assetId(sm.props.get('TextureId')) };
}
/* the part's geometry in its local space, or undefined while the mesh loads, or null if it cannot load */
export function meshGeometry(o, spec, onReady) {
  const m = meshes.get(spec.id); if (m === null) return null; if (!m) { loadMesh(spec.id).then(() => onReady?.()); return undefined; }
  const g = m.geo.clone(); g.translate(-m.center.x, -m.center.y, -m.center.z);
  if (spec.kind === 'part') { const s = o.props.get('Size') || { x: 1, y: 1, z: 1 }; g.scale(s.x / Math.max(1e-4, m.size.x), s.y / Math.max(1e-4, m.size.y), s.z / Math.max(1e-4, m.size.z)); }
  else { const s = spec.scale || { x: 1, y: 1, z: 1 }, of = spec.offset || { x: 0, y: 0, z: 0 }; g.scale(s.x, s.y, s.z); g.translate(of.x, of.y, of.z); }
  return g;
}
/* a texture for the part: the image over the part's colour (Roblox shows the Color through transparent texels) */
const texs = new Map();
export function meshTexture(texId, color, onReady) {
  const key = texId + '|' + color; if (texs.has(key)) return texs.get(key);
  texs.set(key, undefined); const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => { const c = document.createElement('canvas'); const w = Math.min(1024, im.naturalWidth || 256), h = Math.min(1024, im.naturalHeight || 256); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; texs.set(key, t); onReady?.(); };
  im.onerror = () => { texs.set(key, null); }; im.src = imageURL(texId, '512x512'); return undefined;
}
