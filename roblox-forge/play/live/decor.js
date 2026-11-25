/* =====================================================================
   Roblox Forge · Jouer — what Roblox draws on and around parts.
   - Decal: the image on one face (Face), tinted by Color3, Transparency;
   - Texture: the image tiled on a face (StudsPerTileU / V, OffsetStudsU / V);
   - Highlight: fill + outline around a model or part (FillColor,
     FillTransparency, OutlineColor, OutlineTransparency, DepthMode
     AlwaysOnTop shows it through walls, Occluded does not), max 31 like Roblox;
   - SelectionBox / SelectionSphere: the adornee's box edges and surface.
   Everything follows its part every frame.
   ===================================================================== */
import * as THREE from 'three';
import { partGeo } from '../world.js?v=11';
import { meshSpec, meshGeometry } from './mesh.js?v=11';
import { assetId, imageURL } from '../assets.js?v=11';
import { isA, Color3 } from '../luau/engine.js?v=11';

const FACES = { Front: { n: [0, 0, -1], r: [-1, 0, 0], u: [0, 1, 0] }, Back: { n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0] }, Right: { n: [1, 0, 0], r: [0, 0, -1], u: [0, 1, 0] }, Left: { n: [-1, 0, 0], r: [0, 0, 1], u: [0, 1, 0] },
  Top: { n: [0, 1, 0], r: [1, 0, 0], u: [0, 0, -1] }, Bottom: { n: [0, -1, 0], r: [1, 0, 0], u: [0, 0, 1] } };
const col = (c, d = '#ffffff') => (c instanceof Color3 ? c.hex() : d);
const texCache = new Map();
function tex(id) { if (!texCache.has(id)) { const t = new THREE.TextureLoader().load(imageURL(id)); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; texCache.set(id, t); } return texCache.get(id); }
const cfMat = (cf, m = new THREE.Matrix4()) => { const r = cf.r, p = cf.p; return m.set(r[0], r[1], r[2], p[0], r[3], r[4], r[5], p[1], r[6], r[7], r[8], p[2], 0, 0, 0, 1); };
function partShape(o) { // the part's own geometry in its local space (mesh when loaded, else its block / ball / wedge)
  const ms = meshSpec(o); if (ms) { const g = meshGeometry(o, ms); if (g) return g; }
  const P = o.props, s = P.get('Size') || { x: 1, y: 1, z: 1 }, sh = P.get('Shape'); return partGeo({ cls: o.cls === 'WedgePart' ? 'WedgePart' : o.cls === 'CornerWedgePart' ? 'CornerWedgePart' : 'Part', shape: sh && sh.name === 'Ball' ? 'Ball' : sh && sh.name === 'Cylinder' ? 'Cylinder' : 'Block', size: [s.x, s.y, s.z] });
}
export class Decor {
  constructor(world, engine) { this.W = world; this.E = engine; this.items = new Map(); this.group = new THREE.Group(); world.scene.add(this.group); }
  scan() {
    const seen = new Set(); let hl = 0;
    const visit = (o) => { for (const k of o.kids) { const c = k.cls;
      if ((c === 'Decal' || c === 'Texture') && k.parent && isA(k.parent.cls, 'BasePart') && !(c === 'Decal' && /^face$/i.test(String(k.props.get('Name'))) && k.parent.props.get('Name') === 'Head')) seen.add(k);
      else if (c === 'Highlight' && hl < 31) { seen.add(k); hl++; } else if (c === 'SelectionBox' || c === 'SelectionSphere') seen.add(k);
      if (k.kids.length) visit(k); } };
    visit(this.E.workspace); const pg = this.E.player && this.E.player.child('PlayerGui'); if (pg) for (const k of pg.descendants()) if (k.cls === 'Highlight' || k.cls === 'SelectionBox' || k.cls === 'SelectionSphere') seen.add(k);
    for (const [o, it] of this.items) if (!seen.has(o)) { this.drop(it); this.items.delete(o); }
    for (const o of seen) if (!this.items.has(o)) this.items.set(o, { o, obj: null, key: '' });
  }
  drop(it) { if (!it.obj) return; this.group.remove(it.obj); it.obj.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) [].concat(m.material).forEach((x) => x.dispose()); }); it.obj = null; }
  update() {
    if (this.E.frameN % 15 === 0 || !this.scanned) { this.scan(); this.scanned = true; }
    for (const it of this.items.values()) { try { this[it.o.cls === 'Texture' ? 'Decal' : it.o.cls === 'SelectionSphere' ? 'SelectionBox' : it.o.cls](it); } catch (e) { console.warn(e); } }
  }
  /* ---- Decal / Texture ---- */
  Decal(it) {
    const o = it.o, part = o.parent, P = o.props, cf = part.props.get('CFrame'), size = part.props.get('Size'); if (!cf || !size) return;
    const id = assetId(P.get('Texture') || P.get('TextureContent') || P.get('ColorMap')), face = (P.get('Face') && P.get('Face').name) || 'Front', tr = P.get('Transparency') || 0, ptr = part.props.get('Transparency') || 0;
    const key = [id, face, size.x, size.y, size.z, tr, col(P.get('Color3')), P.get('StudsPerTileU'), P.get('StudsPerTileV'), P.get('OffsetStudsU'), P.get('OffsetStudsV')].join('|');
    if (key !== it.key) { this.drop(it); it.key = key; if (!id) return; const F = FACES[face] || FACES.Front; const fw = Math.abs(F.r[0] * size.x + F.r[1] * size.y + F.r[2] * size.z), fh = Math.abs(F.u[0] * size.x + F.u[1] * size.y + F.u[2] * size.z);
      const g = new THREE.PlaneGeometry(fw, fh); const n = new THREE.Vector3(...F.n), r = new THREE.Vector3(...F.r), u = new THREE.Vector3(...F.u); const basis = new THREE.Matrix4().makeBasis(r, u, n);
      g.applyMatrix4(basis); g.translate(F.n[0] * (size.x / 2 + 0.002), F.n[1] * (size.y / 2 + 0.002), F.n[2] * (size.z / 2 + 0.002));
      let t = tex(id); if (o.cls === 'Texture') { t = new THREE.TextureLoader().load(imageURL(id)); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; /* its own tiling */ const su = P.get('StudsPerTileU') || 2, sv = P.get('StudsPerTileV') || 2; t.repeat.set(fw / su, fh / sv); t.offset.set(-(P.get('OffsetStudsU') || 0) / su, (P.get('OffsetStudsV') || 0) / sv); }
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, color: col(P.get('Color3')), transparent: true, opacity: 1 - tr, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.matrixAutoUpdate = false; m.renderOrder = 2; it.obj = m; this.group.add(m); }
    if (it.obj) { cfMat(cf, it.obj.matrix); it.obj.matrixWorldNeedsUpdate = true; it.obj.visible = tr < 1 && ptr < 1 && !!part.parent; }
  }
  /* ---- Highlight ---- */
  Highlight(it) {
    const o = it.o, P = o.props; const ad = P.get('Adornee') || o.parent; if (!ad || !ad.props) { this.drop(it); return; }
    const parts = isA(ad.cls, 'BasePart') ? [ad] : ad.descendants().filter((d) => isA(d.cls, 'BasePart') && (d.props.get('Transparency') || 0) < 1 && d.props.get('Name') !== 'HumanoidRootPart').slice(0, 300);
    const enabled = P.get('Enabled') !== false, top = !(P.get('DepthMode') && P.get('DepthMode').name === 'Occluded');
    const ft = P.get('FillTransparency') ?? 0.5, ot = P.get('OutlineTransparency') ?? 0, key = [parts.length, col(P.get('FillColor'), '#ff0000'), ft, col(P.get('OutlineColor')), ot, top, ...parts.map((p) => { const s = p.props.get('Size'); return s ? s.x + ',' + s.y + ',' + s.z : ''; })].join('|');
    if (key !== it.key) { this.drop(it); it.key = key; const grp = new THREE.Group(); it.parts = parts;
      // 1) the silhouette marks the stencil, 2) the slightly bigger outline only draws outside it, 3) the fill on top
      const sref = 1 + (this.hlN = ((this.hlN || 0) + 1) % 200);
      const mask = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: !top, transparent: true, stencilWrite: true, stencilRef: sref, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
      const fill = new THREE.MeshBasicMaterial({ color: col(P.get('FillColor'), '#ff0000'), transparent: true, opacity: 1 - ft, depthTest: !top, depthWrite: false });
      const line = new THREE.MeshBasicMaterial({ color: col(P.get('OutlineColor')), transparent: true, opacity: 1 - ot, side: THREE.BackSide, depthTest: !top, depthWrite: false, stencilWrite: true, stencilRef: sref, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.KeepStencilOp });
      for (const p of parts) { const g = partShape(p); const s = p.props.get('Size'); const holder = new THREE.Group(); holder.matrixAutoUpdate = false;
        const mk = new THREE.Mesh(g, mask); mk.renderOrder = 18; holder.add(mk);
        if (ot < 1) { const k = 0.16; const ol = new THREE.Mesh(g, line); ol.scale.set(1 + k / Math.max(0.2, s.x), 1 + k / Math.max(0.2, s.y), 1 + k / Math.max(0.2, s.z)); ol.renderOrder = 19; holder.add(ol); }
        if (ft < 1) { const f = new THREE.Mesh(g, fill); f.renderOrder = 20; holder.add(f); }
        grp.add(holder); }
      it.obj = grp; this.group.add(grp); }
    if (!it.obj) return; it.obj.visible = enabled; it.obj.children.forEach((h, i) => { const p = it.parts[i], cf = p && p.parent && p.props.get('CFrame'); h.visible = !!cf; if (cf) { cfMat(cf, h.matrix); h.matrixWorldNeedsUpdate = true; } });
  }
  /* ---- SelectionBox / SelectionSphere ---- */
  SelectionBox(it) {
    const o = it.o, P = o.props, ad = P.get('Adornee'); const box = ad && ad.props ? (isA(ad.cls, 'BasePart') ? { cf: ad.props.get('CFrame'), s: ad.props.get('Size') } : (() => { const r = ad.$index && ad.$index('GetBoundingBox'); if (!r) return null; const [cf, s] = r([ad]); return { cf, s }; })()) : null;
    if (!box || !box.cf || !box.s || P.get('Visible') === false) { if (it.obj) it.obj.visible = false; return; }
    const sphere = o.cls === 'SelectionSphere', key = [sphere, box.s.x, box.s.y, box.s.z, col(P.get('Color3'), '#0d69ac'), P.get('SurfaceTransparency') ?? 1, col(P.get('SurfaceColor3'), '#0d69ac'), P.get('Transparency') || 0].join('|');
    if (key !== it.key) { this.drop(it); it.key = key; const grp = new THREE.Group(); grp.matrixAutoUpdate = false; const s = box.s, pad = sphere ? 0 : (P.get('LineThickness') ?? 0.15) / 2;
      const g = sphere ? new THREE.SphereGeometry(Math.max(s.x, s.y, s.z) / 2 + 0.05, 24, 16) : new THREE.BoxGeometry(s.x + pad * 2, s.y + pad * 2, s.z + pad * 2);
      grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: col(P.get('Color3'), '#0d69ac'), transparent: true, opacity: 1 - (P.get('Transparency') || 0) })));
      const st = P.get('SurfaceTransparency') ?? 1; if (st < 1) grp.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col(P.get('SurfaceColor3'), '#0d69ac'), transparent: true, opacity: 1 - st, depthWrite: false })));
      it.obj = grp; this.group.add(grp); }
    it.obj.visible = true; cfMat(box.cf, it.obj.matrix); it.obj.matrixWorldNeedsUpdate = true;
  }
}
