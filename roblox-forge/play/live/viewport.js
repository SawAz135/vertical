/* =====================================================================
   Roblox Forge · Jouer — ViewportFrame rendering.
   A ViewportFrame shows the parts under it (directly, in Models or in a
   WorldModel) seen through its CurrentCamera, lit by its Ambient /
   LightColor / LightDirection. One shared offscreen WebGL renderer draws
   every visible viewport into its own 2D canvas; parts follow their CFrame
   each frame (animated thumbnails keep moving).
   ===================================================================== */
import * as THREE from 'three';
import { material, partGeo, studTop, studMat } from '../world.js?v=9';
import { partDesc } from './render3d.js?v=9';
import { isA, Color3 } from '../luau/engine.js?v=9';

let R = null;
const renderer = () => { if (!R) { R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.setPixelRatio(1); } return R; };
const cfMat = (cf, m = new THREE.Matrix4()) => m.set(cf.r[0], cf.r[1], cf.r[2], cf.p[0], cf.r[3], cf.r[4], cf.r[5], cf.p[1], cf.r[6], cf.r[7], cf.r[8], cf.p[2], 0, 0, 0, 1);
const col = (c, d) => (c instanceof Color3 ? new THREE.Color(c.r, c.g, c.b) : new THREE.Color(d));

export class ViewportRenderer {
  constructor() { this.vps = new Map(); }
  draw(o, el, w, h, frameN) {
    if (w < 2 || h < 2) return; let v = this.vps.get(o);
    if (!v) { const canvas = document.createElement('canvas'); canvas.className = 'rxvp'; el.insertBefore(canvas, el.$kids); const scene = new THREE.Scene(); const amb = new THREE.AmbientLight(0xffffff, 1); const dir = new THREE.DirectionalLight(0xffffff, 1.6); scene.add(amb, dir, dir.target);
      v = { canvas, scene, amb, dir, meshes: new Map(), cam: new THREE.PerspectiveCamera(70, 1, 0.05, 5000) }; this.vps.set(o, v); }
    if (frameN % 2 && v.drawn) return; // every other frame is enough for thumbnails
    const dpr = Math.min(2, devicePixelRatio || 1), cw = Math.round(w * dpr), ch = Math.round(h * dpr); if (v.canvas.width !== cw || v.canvas.height !== ch) { v.canvas.width = cw; v.canvas.height = ch; v.canvas.style.width = w + 'px'; v.canvas.style.height = h + 'px'; }
    // parts
    const parts = []; const walk = (x) => { for (const k of x.kids) { if (isA(k.cls, 'BasePart')) parts.push(k); if (k.cls === 'Model' || k.cls === 'WorldModel' || k.cls === 'Folder' || isA(k.cls, 'BasePart')) walk(k); } }; walk(o);
    const seen = new Set();
    for (const p of parts) { seen.add(p); const key = keyOf(p); let e = v.meshes.get(p); if (!e || e.key !== key) { if (e) { v.scene.remove(e.m); e.m.geometry.dispose(); } const d = partDesc(p); if (d.transparency >= 1) { v.meshes.delete(p); continue; }
        const m = new THREE.Mesh(partGeo(d), d.head ? new THREE.MeshStandardMaterial({ color: d.color }) : material(d)); m.matrixAutoUpdate = false; if (d.studs && d.cls === 'Part' && d.shape === 'Block') m.add(new THREE.Mesh(studTop(d, new THREE.Matrix4(), new THREE.Color(d.color)), studMat())); v.scene.add(m); e = { m, key }; v.meshes.set(p, e); }
      const cf = p.props.get('CFrame'); if (cf) { cfMat(cf, e.m.matrix); e.m.matrixWorldNeedsUpdate = true; } }
    for (const [p, e] of v.meshes) if (!seen.has(p)) { v.scene.remove(e.m); e.m.geometry.dispose(); v.meshes.delete(p); }
    // camera, light
    const cam = o.props.get('CurrentCamera'); if (cam && cam.props) { const cf = cam.props.get('CFrame'); if (cf) { cfMat(cf).decompose(v.cam.position, v.cam.quaternion, new THREE.Vector3()); } v.cam.fov = cam.props.get('FieldOfView') ?? 70; }
    v.cam.aspect = w / h; v.cam.updateProjectionMatrix();
    v.amb.color.copy(col(o.props.get('Ambient'), '#c8c8c8')); v.amb.intensity = 1.3; v.dir.color.copy(col(o.props.get('LightColor'), '#8c8c8c')); v.dir.intensity = 2.2; const ld = o.props.get('LightDirection'); v.dir.position.set(ld ? -ld.x : 1, ld ? -ld.y : 1, ld ? -ld.z : 1).multiplyScalar(50);
    const R = renderer(); R.setSize(cw, ch, false); R.setClearColor(0x000000, 0); R.render(v.scene, v.cam);
    const g = v.canvas.getContext('2d'); g.clearRect(0, 0, cw, ch); g.globalAlpha = 1 - (o.props.get('ImageTransparency') || 0); g.drawImage(R.domElement, 0, 0); v.drawn = true;
  }
  drop(o) { const v = this.vps.get(o); if (!v) return; for (const e of v.meshes.values()) e.m.geometry.dispose(); v.canvas.remove(); this.vps.delete(o); }
}
const keyOf = (p) => { const P = p.props, s = P.get('Size'), c = P.get('Color'), m = P.get('Material'); return [s && s.x, s && s.y, s && s.z, c && c.r, c && c.g, c && c.b, m && m.name, P.get('Transparency'), P.get('Shape') && P.get('Shape').name].join('|'); };
