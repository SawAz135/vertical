/* =====================================================================
   Roblox Forge · Jouer — live 3D view of a running Roblox place.
   Reads the engine's Workspace every frame:
   - anchored parts that scripts leave alone are merged per model (few draw
     calls even for 30 000 parts); a merged part that a script touches
     (CFrame, Size, Color, Material, Transparency, Parent) leaves its batch
     and becomes a live mesh;
   - moving parts (unanchored assemblies, joints, characters, tools,
     thrown objects) are live meshes updated from their CFrame each frame;
   - Roblox look: materials, studs on Plastic tops, the classic head shape
     with a face, PointLights, ParticleEmitters, Lighting (ClockTime,
     Brightness, Ambient, Atmosphere, Bloom, ColorCorrection, Blur);
   - collisions for the player and Workspace:Raycast for scripts.
   ===================================================================== */
import * as THREE from 'three';
import { World, material, studMat, partGeo, colliderGeo, sizeOf, studTop, voxMat, matTex } from '../world.js?v=11';
import { headGeo, faceTex } from '../avatar.js?v=11';
import { isA, EnumItem, Color3, Vector3 } from '../luau/engine.js?v=11';
import * as MC from '../../map/map-core.js';
import { meshSpec, meshGeometry, meshTexture, unionShape } from './mesh.js?v=11';
import { readBinary } from '../rbxl.js?v=11';
import { BeamSystem } from './beams.js?v=11';
import { Decor } from './decor.js?v=11';
import { TerrainView } from './terrain3d.js?v=11';
import { Effects } from './effects.js?v=11';
import { MATS as TMATS, VOX as TVOX } from '../luau/terrain.js?v=11';

const MAT_OK = new Set(['Plastic', 'SmoothPlastic', 'Neon', 'Wood', 'WoodPlanks', 'Brick', 'Cobblestone', 'Concrete', 'Slate', 'Granite', 'Marble', 'Basalt', 'Rock', 'Pebble', 'Grass', 'LeafyGrass', 'Sand', 'Snow', 'Ice', 'Glacier', 'Glass', 'ForceField', 'Metal', 'DiamondPlate', 'CorrodedMetal', 'Foil', 'Fabric', 'Asphalt', 'Pavement', 'CrackedLava', 'Sandstone']);
const MAT_ALIAS = { Limestone: 'Sandstone', Mud: 'Grass', Ground: 'Grass', Salt: 'Sand', Cardboard: 'WoodPlanks', Carpet: 'Fabric', Leather: 'Fabric', Plaster: 'Concrete', Rubber: 'SmoothPlastic', Water: 'Glass', Air: 'Glass' };
const WATCH = new Set(['CFrame', 'Size', 'Color', 'Material', 'Transparency', 'Shape', 'Position', 'Orientation', 'Reflectance', 'BrickColor', 'Rotation']);
const hexOf = (c) => (c instanceof Color3 ? c.hex() : '#a3a2a5');
/* a BasePart Instance → the plain part record the shared geometry / material helpers use */
export function partDesc(o) {
  const P = o.props, s = P.get('Size') || { x: 4, y: 1, z: 2 }; let mat = P.get('Material'); mat = mat instanceof EnumItem ? mat.name : 'Plastic'; mat = MAT_ALIAS[mat] || mat; if (!MAT_OK.has(mat)) mat = 'Plastic';
  const sh = P.get('Shape') instanceof EnumItem ? P.get('Shape').name : 'Block'; const mesh = o.kids.find((k) => k.cls === 'SpecialMesh' || k.cls === 'BlockMesh' || k.cls === 'CylinderMesh'); const mt = mesh && mesh.props.get('MeshType') instanceof EnumItem ? mesh.props.get('MeshType').name : mesh && mesh.cls === 'CylinderMesh' ? 'Cylinder' : null;
  const cls = o.cls === 'WedgePart' || sh === 'Wedge' || mt === 'Wedge' ? 'WedgePart' : o.cls === 'CornerWedgePart' || sh === 'CornerWedge' ? 'CornerWedgePart' : o.cls === 'TrussPart' ? 'TrussPart' : o.cls === 'SpawnLocation' ? 'SpawnLocation' : 'Part';
  let size = [s.x, s.y, s.z]; if (mesh && mesh.props.get('Scale') && mt !== 'Head') { const k = mesh.props.get('Scale'); if (mt === 'FileMesh' || mt === 'Brick' || mt === 'Sphere' || mt === 'Cylinder') size = [s.x * Math.min(1, k.x), s.y * Math.min(1, k.y), s.z * Math.min(1, k.z)]; }
  const top = P.get('TopSurface');
  return { cls, size, pos: [0, 0, 0], rot: [0, 0, 0], color: hexOf(P.get('Color')), material: mat, transparency: +(P.get('Transparency') || 0), reflectance: +(P.get('Reflectance') || 0),
    shape: mt === 'Sphere' || sh === 'Ball' ? 'Ball' : mt === 'Cylinder' || sh === 'Cylinder' ? 'Cylinder' : 'Block', studs: top instanceof EnumItem && top.name === 'Studs' && mat === 'Plastic' && o.cls !== 'MeshPart' && mt !== 'FileMesh', head: mt === 'Head', canCollide: P.get('CanCollide') !== false };
}
const texMats = new Map();
const texMat = (tex, d) => { const k = tex.id + '|' + d.transparency + '|' + d.material; if (!texMats.has(k)) texMats.set(k, new THREE.MeshStandardMaterial({ map: tex, roughness: d.material === 'SmoothPlastic' || d.material === 'Glass' ? 0.35 : 0.75, metalness: /Metal|Foil|DiamondPlate/.test(d.material) ? 0.5 : 0, transparent: d.transparency > 0, opacity: 1 - d.transparency, depthWrite: d.transparency < 0.5, alphaTest: 0.02 })); return texMats.get(k); };
const cfMat = (cf, m = new THREE.Matrix4()) => { const r = cf.r, p = cf.p; return m.set(r[0], r[1], r[2], p[0], r[3], r[4], r[5], p[1], r[6], r[7], r[8], p[2], 0, 0, 0, 1); };

export class LiveWorld extends World {
  constructor(renderer, quality, engine) {
    super(renderer, quality); this.E = engine; this.THREE = THREE; this.live = new Map(); this.groups = new Map(); this.partGroup = new Map(); this.dirtyGroups = new Set(); this.colliderOf = new Map();
    this.lights = []; this.particles = []; this.beams = new BeamSystem(this, engine); this.decor = new Decor(this, engine); this.terrainView = new TerrainView(this, engine.terrain); this.effects = new Effects(this, engine); engine.onExplosion = (p, r) => this.effects.explode(p, r); this.tmpM = new THREE.Matrix4(); this.map = { lighting: { preset: 'jour', over: {} }, root: { children: [] } };
    engine.onTrack = (o, p, inWorld) => this.onTrack(o, inWorld);
    const prev = engine.rt.onChange; engine.rt.onChange = (o, k) => { prev?.(o, k); this.onChange(o, k); };
  }
  isChar(o) { let p = o.parent; while (p && p !== this.E.workspace) { if (p.kids.some((k) => k.cls === 'Humanoid')) return true; p = p.parent; } return false; }
  movable(o) { if (!o.props.get('Anchored')) return true; if (this.isChar(o)) return true; for (const k of o.kids) if (k.cls === 'Motor6D' || k.cls === 'Weld' || k.cls === 'WeldConstraint') return true; return false; }
  groupKey(o) { let p = o.parent, last = o; while (p && p !== this.E.workspace) { if (p.parent === this.E.workspace && (p.cls === 'Folder' || p.cls === 'Model') && p.kids.length > 40) return last; last = p; p = p.parent; } return last; }
  /* ---- first build ---- */
  build() {
    const parts = this.E.workspace.descendants().filter((d) => isA(d.cls, 'BasePart') && d.cls !== 'Terrain');
    for (const o of parts) { const ms = meshSpec(o); if (this.movable(o) || (ms && ms.tex) || (o.props.get('Transparency') || 0) > 0.02 || o.kids.some((k) => k.cls === 'SpecialMesh' || k.cls === 'Decal' || isA(k.cls, 'Light'))) this.addLive(o); else { const g = this.groupKey(o); if (!this.groups.has(g)) this.groups.set(g, { parts: new Set(), meshes: [] }); this.groups.get(g).parts.add(o); this.partGroup.set(o, g); } this.addCollider(o); }
    for (const g of this.groups.keys()) this.rebuildGroup(g);
    this.scanEffects(); this.applyLighting();
  }
  rebuildGroup(key) {
    const G = this.groups.get(key); if (!G) return; for (const m of G.meshes) { this.root.remove(m); m.geometry.dispose(); } G.meshes = [];
    const byMat = new Map(), studs = []; const col = new THREE.Color();
    for (const o of G.parts) { const d = partDesc(o), cf = o.props.get('CFrame'); if (!cf || d.transparency >= 1) continue; const ms = meshSpec(o); let g;
      if (ms) { g = meshGeometry(o, ms, () => this.dirtyGroups.add(key)); if (g === undefined) continue; if (g === null) g = partGeo(d); else { g = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); } } else g = (/Operation$/.test(o.cls) && unionShape(o, readBinary)) || partGeo(d);
      const mtx = cfMat(cf); g.applyMatrix4(mtx); col.set(d.color);
      const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) { c[i] = col.r; c[i + 1] = col.g; c[i + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      const kind = d.cls === 'TrussPart' ? 'Truss' : d.material; if (!byMat.has(kind)) byMat.set(kind, []); byMat.get(kind).push(g); if (d.studs && d.cls === 'Part' && d.shape === 'Block') studs.push(studTop(d, mtx, col)); }
    const add = (geos, mat, shadow) => { const before = this.root.children.length; this.addMerged(geos, mat, shadow); G.meshes.push(...this.root.children.slice(before)); };
    for (const [kind, geos] of byMat) { const mat = material({ color: '#ffffff', material: kind === 'Truss' ? 'Plastic' : kind, transparency: 0 }, kind === 'Truss' ? 'Truss' : undefined, true); add(geos, mat, !(mat instanceof THREE.MeshBasicMaterial)); }
    if (studs.length) add(studs, studMat(), false);
  }
  /* ---- live meshes ---- */
  addLive(o) {
    if (this.live.has(o)) return; const d = partDesc(o); const e = { o, d, key: '' }; this.live.set(o, e); this.makeMesh(e);
  }
  makeMesh(e) {
    const { o } = e, d = (e.d = partDesc(o)); if (e.mesh) { this.root.remove(e.mesh); e.mesh.geometry.dispose(); }
    let geo, mat;
    if (d.head) { geo = headGeo(); const s = d.size; geo.scale(s[0] / 1.2, s[1] / 1.2, s[2] / 1.2); mat = new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.62 }); }
    else { const ms = meshSpec(o); const g = ms ? meshGeometry(o, ms, () => { e.key = ''; }) : null;
      if (ms && g === undefined) { geo = new THREE.BufferGeometry(); mat = material(d); } // the mesh is on its way
      else if (g) { geo = g; const tex = ms.tex ? meshTexture(ms.tex, d.color, () => { e.key = ''; }) : null; mat = tex ? texMat(tex, d) : material(d); }
      else { geo = (/Operation$/.test(o.cls) && unionShape(o, readBinary)) || partGeo(d); mat = material(d, d.cls === 'TrussPart' ? 'Truss' : undefined); if (d.cls === 'SpawnLocation') mat = [mat, mat, material(d, 'Spawn'), mat, mat, mat]; } }
    const m = new THREE.Mesh(geo, mat); m.matrixAutoUpdate = false; m.castShadow = d.material !== 'Neon' && d.material !== 'ForceField' && d.transparency < 0.6; m.receiveShadow = true; m.visible = d.transparency < 1;
    if (d.studs && d.cls === 'Part' && d.shape === 'Block' && d.transparency <= 0) { const sm = new THREE.Mesh(studTop(d, new THREE.Matrix4(), new THREE.Color(d.color)), studMat()); sm.receiveShadow = true; m.add(sm); }
    const face = o.kids.find((k) => k.cls === 'Decal' && /face/i.test(String(k.props.get('Name')))); if (face && d.head) { const fm = new THREE.Mesh(new THREE.CylinderGeometry(0.625, 0.625, 1.05, 32, 1, true, Math.PI - 0.95, 1.9), new THREE.MeshStandardMaterial({ map: faceTex(this.E.look?.face || 'sourire'), transparent: true, depthWrite: false, roughness: 0.7 })); fm.scale.set(d.size[0] / 1.2, d.size[1] / 1.2, d.size[2] / 1.2); m.add(fm); }
    e.mesh = m; e.key = this.lookKey(o); this.root.add(m); this.place(e);
  }
  lookKey(o) { const P = o.props, s = P.get('Size'); const c = P.get('Color'); const mt = P.get('Material'); return [s && s.x, s && s.y, s && s.z, c && c.r, c && c.g, c && c.b, mt && mt.name, P.get('Transparency'), P.get('Shape') && P.get('Shape').name, P.get('Reflectance'), o.kids.length].join('|'); }
  place(e) { const cf = e.o.props.get('CFrame'); if (!cf) return; cfMat(cf, e.mesh.matrix); if (e.mesh.geometry.type === 'LatheGeometry') {/* head */} e.mesh.matrixWorldNeedsUpdate = true; }
  removeLive(o) { const e = this.live.get(o); if (!e) return; this.root.remove(e.mesh); e.mesh.geometry.dispose(); this.live.delete(o); }
  /* ---- changes from scripts ---- */
  onTrack(o, inWorld) {
    const each = (x, f) => { f(x); for (const k of x.kids) each(k, f); };
    each(o, (x) => {
      if (isA(x.cls, 'BasePart') && x.cls !== 'Terrain') {
        if (inWorld) { if (!this.live.has(x) && !this.partGroup.has(x)) this.addLive(x); this.addCollider(x); }
        else { this.removeLive(x); const g = this.partGroup.get(x); if (g) { this.groups.get(g)?.parts.delete(x); this.partGroup.delete(x); this.dirtyGroups.add(g); } this.dropCollider(x); }
      }
      if (x.cls === 'ParticleEmitter' || isA(x.cls, 'Light') || x.cls === 'Beam' || x.cls === 'Trail') this.effectsDirty = true;
    });
    const host = o.parent; if (host && this.live.has(host)) this.live.get(host).key = ''; // child added (face, mesh): refresh look
  }
  onChange(o, k) {
    if (!WATCH.has(k)) { if (o.parent && (o.cls === 'SpecialMesh' || o.cls === 'Decal') && this.live.has(o.parent)) this.live.get(o.parent).key = ''; if (o.cls === 'Lighting' || o.parent?.cls === 'Lighting') this.lightDirty = true; return; }
    const g = this.partGroup.get(o); if (g) { this.groups.get(g)?.parts.delete(o); this.partGroup.delete(o); this.dirtyGroups.add(g); this.addLive(o); }
    const c = this.colliderOf.get(o); if (c) { this.dropCollider(o); this.addCollider(o); }
  }
  /* ---- colliders (player physics + raycasts) ---- */
  addCollider(o) { if (this.colliderOf.has(o) || this.isChar(o)) return; const d = partDesc(o); if (!d.canCollide && !o.props.get('CanQuery')) return; const cf = o.props.get('CFrame'); if (!cf) return;
    const p = { id: 'i' + o.id, cls: d.cls, shape: d.shape, size: d.size, pos: cf.p, rot: [0, 0, 0], canCollide: d.canCollide, inst: o }; const m = new THREE.Mesh(colliderGeo(p)); cfMat(cf, this.tmpM).decompose(m.position, m.quaternion, m.scale); m.scale.fromArray(sizeOf(p)); m.updateMatrixWorld(true);
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); m.userData = { id: p.id, part: p, inst: o, box: new THREE.Box3().setFromObject(m) };
    const movable = !o.props.get('Anchored'); if (movable) { this.dynColliders.add(m); m.userData.dyn = true; } else { const c = this.cell, b = m.userData.box, x0 = Math.floor(b.min.x / c), x1 = Math.floor(b.max.x / c), z0 = Math.floor(b.min.z / c), z1 = Math.floor(b.max.z / c);
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 400) this.dynColliders.add(m); else for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = x + ',' + z; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(m); } m.userData.cells = [x0, x1, z0, z1]; }
    this.colliderOf.set(o, m); }
  dropCollider(o) { const m = this.colliderOf.get(o); if (!m) return; this.colliderOf.delete(o); this.dynColliders.delete(m); const c = m.userData.cells; if (c) for (let x = c[0]; x <= c[1]; x++) for (let z = c[2]; z <= c[3]; z++) { const l = this.grid.get(x + ',' + z); if (l) { const i = l.indexOf(m); if (i >= 0) l.splice(i, 1); } } }
  solidNear(pos, r = 16) { const out = []; for (const m of this.near(pos, r)) { const o = m.userData.inst; if (!o || !o.parent || o.props.get('CanCollide') === false) continue; if (m.userData.dyn) { const cf = o.props.get('CFrame'); if (cf) { cfMat(cf, this.tmpM).decompose(m.position, m.quaternion, new THREE.Vector3()); m.updateMatrixWorld(true); } } out.push(m); } return out; }
  raycast(origin, dir, params) {
    const o = new THREE.Vector3(origin.x, origin.y, origin.z), d = new THREE.Vector3(dir.x, dir.y, dir.z), len = d.length(); if (len < 1e-6) return undefined; d.normalize();
    const filt = params && params.f ? params.f.FilterDescendantsInstances : null, incl = params && params.f && params.f.FilterType && params.f.FilterType.name === 'Include', list = filt ? filt.arr : [];
    const okInst = (inst) => { if (!list.length) return true; let p = inst, hit = false; while (p) { if (list.includes(p)) { hit = true; break; } p = p.parent; } return incl ? hit : !hit; };
    const cands = new Set(), steps = Math.min(64, Math.ceil(len / this.cell) + 1); for (let i = 0; i <= steps; i++) { const t = (len * i) / steps; for (const m of this.near(o.clone().addScaledVector(d, t), this.cell)) cands.add(m); }
    for (const e of this.live.values()) if (e.o.parent && !this.colliderOf.has(e.o) && !this.isChar(e.o)) cands.add(e.mesh);
    const rc = this.rc || (this.rc = new THREE.Raycaster()); rc.set(o, d); rc.far = len; const hits = rc.intersectObjects([...cands], false);
    for (const h of hits) { const inst = h.object.userData.inst || [...this.live.values()].find((e) => e.mesh === h.object)?.o; if (!inst || !inst.parent || (params && params.f && params.f.RespectCanCollide && inst.props.get('CanCollide') === false) || inst.props.get('CanQuery') === false || !okInst(inst)) continue;
      const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0); const R = this.E.rt; void R;
      const res = new this.E.Instance('RaycastResult', this.E.rt); res.props.set('Instance', inst); res.props.set('Position', new Vector3(h.point.x, h.point.y, h.point.z)); res.props.set('Normal', new Vector3(n.x, n.y, n.z)); res.props.set('Distance', h.distance); res.props.set('Material', h.object.userData.terrain ? (() => { const q = h.point.clone().addScaledVector(d, 0.05); return this.E.enumItem('Material', TMATS[this.E.terrain.get(Math.floor(q.x / TVOX), Math.floor(q.y / TVOX), Math.floor(q.z / TVOX))[0]] || 'Grass'); })() : inst.props.get('Material')); return res; }
    return undefined;
  }
  groundAt(x, y, z, self) { const rc = this.rc2 || (this.rc2 = new THREE.Raycaster()); rc.set(new THREE.Vector3(x, y, z), new THREE.Vector3(0, -1, 0)); rc.far = 400; const hits = rc.intersectObjects(this.solidNear(new THREE.Vector3(x, y, z), 6), false); for (const h of hits) if (h.object.userData.inst !== self) return h.point.y; return null; }
  /* ---- lighting from the Lighting service ---- */
  applyLighting() {
    const L = this.E.service('Lighting'), P = L.props, ct = P.get('ClockTime'); const hx = (c) => (c instanceof Color3 ? c.hex() : undefined);
    const over = { ClockTime: typeof ct === 'number' ? ct : 14, Brightness: Math.max(0.8, P.get('Brightness') ?? 2) }; if (hx(P.get('Ambient'))) over.Ambient = hx(P.get('Ambient')); if (hx(P.get('OutdoorAmbient'))) over.OutdoorAmbient = hx(P.get('OutdoorAmbient'));
    const atm = L.kids.find((k) => k.cls === 'Atmosphere'); over.atmo = atm ? { Density: +(atm.props.get('Density') ?? 0.3), Haze: +(atm.props.get('Haze') ?? 0), Glare: +(atm.props.get('Glare') ?? 0), Color: hx(atm.props.get('Color')) || '#c7d7ec', Decay: hx(atm.props.get('Decay')) || '#5c6e87' } : { Density: 0.05, Haze: 0, Color: '#c7d7ec', Decay: '#5c6e87' };
    const bl = L.kids.find((k) => k.cls === 'BloomEffect' && k.props.get('Enabled') !== false); if (bl) over.bloom = { Intensity: +(bl.props.get('Intensity') ?? 1), Size: +(bl.props.get('Size') ?? 24), Threshold: +(bl.props.get('Threshold') ?? 2) };
    const cc = L.kids.find((k) => k.cls === 'ColorCorrectionEffect' && k.props.get('Enabled') !== false); if (cc) over.cc = { Saturation: +(cc.props.get('Saturation') || 0), Contrast: +(cc.props.get('Contrast') || 0), TintColor: hx(cc.props.get('TintColor')) || '#ffffff' };
    const preset = over.ClockTime >= 5.5 && over.ClockTime <= 18.5 ? (over.ClockTime > 16.5 ? 'coucher' : over.ClockTime < 8 ? 'aube' : 'jour') : 'nuit';
    this.map = { lighting: { preset, over }, root: { children: [] } }; this.lighting();
    // post effects read by the app (CSS filters on the canvas)
    this.updatePost(); this.lightDirty = false;
  }
  /* ---- lights and particles ---- */
  scanEffects() {
    for (const l of this.lights) this.root.remove(l.obj); this.lights = [];
    const ws = this.E.workspace.descendants(); const lights = ws.filter((d) => isA(d.cls, 'Light') && d.props.get('Enabled') !== false && d.parent && isA(d.parent.cls, 'BasePart')).slice(0, 16);
    for (const l of lights) { const P = l.props, obj = new THREE.PointLight(hexOf(P.get('Color')), (P.get('Brightness') ?? 1) * 5, P.get('Range') ?? 8, 1.6); this.root.add(obj); this.lights.push({ l, obj }); }
    const ems = ws.filter((d) => d.cls === 'ParticleEmitter'); const known = new Set(this.particles.map((p) => p.em)); for (const em of ems) if (!known.has(em)) this.particles.push(this.makeEmitter(em));
    this.particles = this.particles.filter((p) => { if (!p.em.parent || !this.E.inWorld(p.em)) { this.root.remove(p.points); p.points.geometry.dispose(); return false; } return true; }); this.effectsDirty = false;
  }
  makeEmitter(em) { const MAX = 160, geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3)); geo.setDrawRange(0, 0);
    const tex = this.dotTex || (this.dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })());
    const mat = new THREE.PointsMaterial({ size: 1.2, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }); const points = new THREE.Points(geo, mat); points.frustumCulled = false; this.root.add(points);
    return { em, points, ps: [], acc: 0, MAX }; }
  emit(p, n) { const em = p.em, P = em.props, part = em.parent; const cf = part && part.props && (part.props.get('CFrame') || (part.cls === 'Attachment' ? part.$index('WorldCFrame') : null)); if (!cf) return;
    const life = P.get('Lifetime'), sp = P.get('Speed'), size = P.get('Size'), col = P.get('Color'); const L0 = life && life.f ? life.f.Min : 1, L1 = life && life.f ? life.f.Max : 2, S0 = sp && sp.f ? sp.f.Min : 5, S1 = sp && sp.f ? sp.f.Max : 5;
    const c0 = col && col.f && col.f.Keypoints ? col.f.Keypoints.arr[0].f.Value : new Color3(1, 1, 1); const sz = size && size.f && size.f.Keypoints ? size.f.Keypoints.arr[0].f.Value : 1; const spread = (P.get('SpreadAngle') && P.get('SpreadAngle').x || 30) * Math.PI / 180;
    const ps = part.props.get('Size') || { x: 0, y: 0, z: 0 }; const up = new THREE.Vector3(cf.r[1], cf.r[4], cf.r[7]);
    for (let i = 0; i < n && p.ps.length < p.MAX; i++) { const dir = up.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), (Math.random() - 0.5) * spread * 2).applyAxisAngle(new THREE.Vector3(0, 0, 1), (Math.random() - 0.5) * spread * 2).normalize(); const s = S0 + Math.random() * (S1 - S0);
      p.ps.push({ pos: new THREE.Vector3(cf.p[0] + (Math.random() - 0.5) * (ps.x || 0), cf.p[1] + (Math.random() - 0.5) * (ps.y || 0), cf.p[2] + (Math.random() - 0.5) * (ps.z || 0)), v: dir.multiplyScalar(s), age: 0, life: L0 + Math.random() * (L1 - L0), c: c0, sz }); } }
  stepParticles(dt) {
    for (const p of this.particles) { const P = p.em.props; const rate = P.get('Enabled') === false ? 0 : P.get('Rate') ?? 0; p.acc += rate * dt; const n = Math.floor(p.acc); if (n > 0) { p.acc -= n; this.emit(p, Math.min(n, 20)); }
      const acc = P.get('Acceleration') || { x: 0, y: 0, z: 0 }, drag = P.get('Drag') || 0; const pos = p.points.geometry.attributes.position, col = p.points.geometry.attributes.color; let k = 0;
      p.ps = p.ps.filter((q) => (q.age += dt) < q.life); for (const q of p.ps) { q.v.x += acc.x * dt; q.v.y += acc.y * dt; q.v.z += acc.z * dt; if (drag) q.v.multiplyScalar(Math.max(0, 1 - drag * dt)); q.pos.addScaledVector(q.v, dt); const f = 1 - q.age / q.life;
        pos.setXYZ(k, q.pos.x, q.pos.y, q.pos.z); col.setXYZ(k, q.c.r * f * 1.4, q.c.g * f * 1.4, q.c.b * f * 1.4); k++; }
      p.points.material.size = Math.max(0.3, (p.ps[0]?.sz || 1) * 1.2); p.points.geometry.setDrawRange(0, k); pos.needsUpdate = true; col.needsUpdate = true; }
  }
  burst(em, n) { const p = this.particles.find((x) => x.em === em) || (this.particles.push(this.makeEmitter(em)), this.particles[this.particles.length - 1]); this.emit(p, n); }
  /* post effects (CSS filters on the canvas), every frame: menus tween BlurEffect / ColorCorrection sizes and they must follow at once.
     Like Roblox, every enabled effect in Lighting and in the camera adds up. */
  updatePost() {
    const L = this.E.service('Lighting'), cam = this.E.workspace.props.get('CurrentCamera'); let blur = 0, sat = 1, con = 1, bri = 1, tint = null;
    for (const k of [...L.kids, ...(cam ? cam.kids : [])]) { if (k.props.get('Enabled') === false) continue;
      if (k.cls === 'BlurEffect') blur += k.props.get('Size') ?? 24;
      else if (k.cls === 'ColorCorrectionEffect') { sat += k.props.get('Saturation') || 0; con += k.props.get('Contrast') || 0; bri += k.props.get('Brightness') || 0; const t = k.props.get('TintColor'); if (t instanceof Color3 && (t.r < 0.99 || t.g < 0.99 || t.b < 0.99)) tint = t.hex(); } }
    this.post = { blur: blur / 4, sat: Math.max(0, sat), con: Math.max(0, con), bri: Math.max(0, bri), tint };
  }
  /* ---- per frame ---- */
  update(dt) {
    for (const e of this.live.values()) { const o = e.o; if (!o.parent) continue; const k = this.lookKey(o); if (k !== e.key) this.makeMesh(e); else this.place(e); }
    let n = 0; for (const g of this.dirtyGroups) { this.rebuildGroup(g); this.dirtyGroups.delete(g); if (++n > 3) break; }
    if (this.effectsDirty) { this.scanEffects(); this.beams.dirty = true; }
    this.beams.update(dt); this.decor.update(); this.terrainView.update(); this.effects.update(dt);
    for (const { l, obj } of this.lights) { const part = l.parent, cf = part && part.props && part.props.get('CFrame'); if (cf) obj.position.set(cf.p[0], cf.p[1], cf.p[2]); obj.visible = l.props.get('Enabled') !== false; obj.intensity = (l.props.get('Brightness') ?? 1) * 5; obj.distance = l.props.get('Range') ?? 8; }
    this.stepParticles(dt);
    if (this.lightDirty || (this.E.frameN % 30 === 0)) this.applyLighting(); else this.updatePost();
  }
}
export { THREE, MC };
