import * as THREE from 'three';
import { woodMaterial, rbox, woodTint, Kit } from '../gfx/woodkit.js';
import { sculpt, smin, sdEll, sdCone } from '../gfx/sculpt.js';
import { canvasTex, textCanvas } from '../gfx/textures.js';
import { rng } from '../core/util.js';

// =====================================================================================
// GÉRARD'S STALL — a carpenter-built market stall: individual bevelled deck boards with
// gaps, a counter of vertical boards on battens under a thick oak top, turned posts with
// knee braces, a plank back wall with three shelves on forged brackets, a sagging striped
// canvas awning with a scalloped valance, a carved and gilded sign hanging from chains,
// burlap potato sacks, a crate of golden potatoes, a brass scale, a vintage till and a
// lantern that lights up at night.
// =====================================================================================
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function turnedPost(h, r = 0.075) {
  const P = [[0, 0], [r * 1.5, 0], [r * 1.5, 0.08], [r * 1.25, 0.1], [r * 1.05, 0.16], [r, 0.22]];
  const n = Math.floor((h - 0.6) / 0.5);
  for (let k = 0; k < n; k++) { const y = 0.3 + k * ((h - 0.7) / n); P.push([r, y], [r * 1.18, y + 0.03], [r, y + 0.06]); }
  P.push([r, h - 0.3], [r * 1.12, h - 0.24], [r * 1.35, h - 0.12], [r * 1.4, h - 0.04], [r * 1.25, h], [0, h]);
  const g = new THREE.LatheGeometry(P.map(p => new THREE.Vector2(p[0], p[1])), 20);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * r / 0.3, uv.getY(i) * h / 1.2);
  const c = new Float32Array(g.attributes.position.count * 3).fill(0.92); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function burlapTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), r = rng(8);
  x.fillStyle = '#b89366'; x.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 256; k += 4) { x.fillStyle = `rgba(90,60,30,${0.18 + r() * 0.1})`; x.fillRect(k, 0, 1.5, 256); x.fillRect(0, k + 2, 256, 1.5); }
  for (let k = 0; k < 1500; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '60,40,20' : '230,210,170'},${0.1 + r() * 0.15})`; x.fillRect(r() * 256, r() * 256, 2 + r() * 3, 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function sackGeo(seed) {
  const r = rng(seed), lean = (r() - 0.5) * 0.08;
  const sdf = (x, y, z) => {
    let d = sdEll(x - lean * y, y, z, 0, 0.27, 0, 0.21, 0.28, 0.17);
    d = smin(d, sdEll(x, y, z, 0, 0.1, 0, 0.23, 0.13, 0.19), 0.08);
    d = smin(d, sdCone(x, y, z, lean * 0.5, 0.48, 0, lean * 0.6, 0.6, 0, 0.06, 0.08), 0.06);        // gathered neck
    d += 0.004 * Math.sin(Math.atan2(x, z) * 9 + y * 20) * (y > 0.45 ? 2 : 0.5);                   // folds
    return Math.max(d, -y);
  };
  return sculpt(sdf, V(-0.3, -0.02, -0.25), V(0.3, 0.66, 0.25), 0.012, { uv: (x, y, z) => [Math.atan2(x, z) * 0.5, y * 2.2] });
}

export function buildStall(shop) {
  const M = shop.M, G = shop.group, r = rng(1987);
  const oak = woodMaterial('oak'), dark = woodMaterial('dark', { knots: 1 }), weathered = woodMaterial('weathered', { knots: 3 });
  const K = new Kit();
  // ---- deck: boards along x with gaps, on joists ----
  for (let k = 0; k < 14; k++) { const z = -1.12 + k * 0.252; K.add(rbox(5.3, 0.05, 0.24, 0.008, woodTint(r)), weathered, (r() - 0.5) * 0.04, 0.115, z); }
  for (const z of [-1.0, 0.6, 2.2]) K.add(rbox(5.3, 0.09, 0.09, 0.006, woodTint(r)), dark, 0, 0.045, z);
  // ---- counter: vertical boards, battens, thick top ----
  for (let k = 0; k < 24; k++) { const x = -2.07 + k * 0.18; K.add(rbox(0.17, 0.96, 0.03, 0.006, woodTint(r, 0.2)), oak, x, 0.62, -0.47 + (r() - 0.5) * 0.004); }
  for (const y of [0.32, 0.92]) K.add(rbox(4.3, 0.09, 0.035, 0.008, woodTint(r)), dark, 0, y, -0.5);
  K.add(rbox(4.3, 0.08, 0.04, 0.008, woodTint(r)), dark, 0, 0.18, -0.5);
  for (const x of [-2.15, 2.15]) K.add(rbox(0.04, 0.96, 0.62, 0.008, woodTint(r)), oak, x, 0.62, -0.18);
  K.add(rbox(4.6, 0.085, 0.86, 0.02, [0.95, 0.9, 0.86]), dark, 0, 1.135, -0.2);
  K.add(rbox(4.5, 0.05, 0.05, 0.015, woodTint(r)), dark, 0, 1.075, -0.6);
  // ---- posts, beams, knee braces ----
  for (const [x, z, h] of [[-2.45, -0.95, 3.0], [2.45, -0.95, 3.0], [-2.45, 2.2, 3.3], [2.45, 2.2, 3.3]]) K.add(turnedPost(h), oak, x, 0.14, z);
  K.add(rbox(5.3, 0.18, 0.14, 0.012, woodTint(r)), dark, 0, 3.1, -0.95); K.add(rbox(5.3, 0.18, 0.14, 0.012, woodTint(r)), dark, 0, 3.4, 2.2);
  for (const x of [-2.45, 2.45]) K.add(rbox(0.12, 0.16, 3.4, 0.012, woodTint(r)), dark, x, 3.22, 0.62, -0.09, 0, 0);
  for (const sx of [-1, 1]) K.add(rbox(0.07, 0.75, 0.07, 0.01, woodTint(r)), dark, sx * 2.2, 2.82, -0.95, 0, 0, sx * 0.78);
  // ---- back wall: vertical planks + battens, shelves ----
  for (let k = 0; k < 26; k++) { const x = -2.4 + k * 0.192; K.add(rbox(0.185, 3.2, 0.035, 0.006, woodTint(r, 0.22)), weathered, x, 1.74, 2.3); }
  for (const y of [0.5, 1.6, 2.8]) K.add(rbox(4.9, 0.1, 0.035, 0.008, woodTint(r)), dark, 0, y, 2.33);
  for (const y of [0.95, 1.7, 2.4]) {
    K.add(rbox(4.4, 0.045, 0.42, 0.01, woodTint(r)), oak, 0, y, 2.05);
    K.add(rbox(4.4, 0.06, 0.02, 0.006, woodTint(r)), dark, 0, y + 0.04, 1.85);
  }
  K.build(G);
  // forged shelf brackets (curved iron)
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.55, metalness: 0.8 });
  const bk = new Kit();
  for (const y of [0.95, 1.7, 2.4]) for (const x of [-1.9, 0, 1.9]) {
    const curve = new THREE.QuadraticBezierCurve3(V(0, -0.28, 0.24), V(0, -0.02, 0.22), V(0, -0.025, -0.15));
    bk.add(new THREE.TubeGeometry(curve, 12, 0.012, 6), iron, x, y, 2.07);
    bk.add(rbox(0.03, 0.3, 0.02, 0.004), iron, x, y - 0.15, 2.28);
  }
  // ---- sagging striped awning on rails ----
  for (let k = 0; k <= 4; k++) { const z = -1.0 + k * 0.82; bk.add(new THREE.CylinderGeometry(0.018, 0.018, 5.1, 8), iron, 0, 3.2 + (k / 4) * 0.3 - 0.02, z, 0, 0, Math.PI / 2); }
  bk.build(G);
  const stripe = canvasTex(textCanvas(1024, 256, (x, w, h) => {
    for (let k = 0; k < 10; k++) { x.fillStyle = k % 2 ? '#f4ecd8' : '#b8322a'; x.fillRect(k * w / 10, 0, w / 10, h); }
    const rr = rng(3); for (let k = 0; k < 6000; k++) { x.fillStyle = `rgba(${rr() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + rr() * 0.04})`; x.fillRect(rr() * w, rr() * h, 2, 1); }
    for (let k = 0; k < w; k += 3) { x.fillStyle = 'rgba(0,0,0,0.04)'; x.fillRect(k, 0, 1, h); }
  }), true);
  const aw = new THREE.PlaneGeometry(5.5, 3.5, 40, 24), ap = aw.attributes.position;
  for (let i = 0; i < ap.count; i++) {
    const x = ap.getX(i), y = ap.getY(i), v = y / 3.5 + 0.5;
    const bay = v * 4, sag = Math.sin((bay - Math.floor(bay)) * Math.PI) * 0.07;           // sags between the rails
    ap.setZ(i, -sag + Math.sin(x * 2.3 + y) * 0.012);
  }
  aw.computeVertexNormals();
  const awm = new THREE.Mesh(aw, new THREE.MeshStandardMaterial({ map: stripe, side: THREE.DoubleSide, roughness: 0.88 }));
  awm.position.set(0, 3.38, 0.62); awm.rotation.x = -Math.PI / 2 + 0.086; awm.castShadow = true; awm.receiveShadow = true; G.add(awm);
  const val = canvasTex(textCanvas(1024, 128, (x, w, h) => { x.clearRect(0, 0, w, h); for (let k = 0; k < 14; k++) { x.fillStyle = k % 2 ? '#f4ecd8' : '#b8322a'; x.beginPath(); x.moveTo(k * w / 14, 0); x.lineTo((k + 1) * w / 14, 0); x.lineTo((k + 1) * w / 14, h * 0.45); x.arc((k + 0.5) * w / 14, h * 0.45, w / 28, 0, Math.PI); x.fill(); x.strokeStyle = 'rgba(80,20,10,0.5)'; x.lineWidth = 3; x.beginPath(); x.arc((k + 0.5) * w / 14, h * 0.45, w / 28 - 6, 0, Math.PI); x.stroke(); } }), true);
  const vg = new THREE.PlaneGeometry(5.5, 0.42, 60, 2), vp = vg.attributes.position; for (let i = 0; i < vp.count; i++) vp.setZ(i, Math.sin(vp.getX(i) * 9) * 0.015);
  vg.computeVertexNormals();
  const vm = new THREE.Mesh(vg, new THREE.MeshStandardMaterial({ map: val, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.88 }));
  vm.position.set(0, 3.02, -1.13); vm.castShadow = true; G.add(vm); shop.valance = vm;
  // ---- carved, gilded sign on chains ----
  const sg = new THREE.Group(); sg.position.set(0, 4.15, -1.0); G.add(sg); shop.sign = sg;
  const signTex = canvasTex(textCanvas(1024, 320, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5a361a'); g.addColorStop(1, '#3e2410'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const rr = rng(9); for (let k = 0; k < 120; k++) { x.strokeStyle = `rgba(20,10,4,${0.15 + rr() * 0.2})`; x.lineWidth = 1 + rr() * 2; x.beginPath(); const y = rr() * h; x.moveTo(0, y); x.bezierCurveTo(w / 3, y + (rr() - 0.5) * 12, 2 * w / 3, y + (rr() - 0.5) * 12, w, y + (rr() - 0.5) * 8); x.stroke(); }
    x.strokeStyle = '#c9a046'; x.lineWidth = 6; x.strokeRect(22, 22, w - 44, h - 44);
    const gold = x.createLinearGradient(0, 60, 0, 170); gold.addColorStop(0, '#fff0b0'); gold.addColorStop(0.5, '#d8a640'); gold.addColorStop(1, '#a8741c');
    x.textAlign = 'center'; x.font = '900 118px Georgia, serif';
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillText('CHEZ GÉRARD', w / 2 + 4, 162); x.fillStyle = gold; x.fillText('CHEZ GÉRARD', w / 2, 156);
    x.font = 'italic 700 46px Georgia, serif'; x.fillStyle = '#f1e2bd'; x.fillText('Outils · Améliorations · Conseils', w / 2, 232);
    x.font = '30px Georgia, serif'; x.fillStyle = '#d8b878'; x.fillText('— depuis 1987 —', w / 2, 280);
  }), true);
  const board = new THREE.Mesh(rbox(2.7, 0.86, 0.07, 0.03), [dark][0]); board.material = new THREE.MeshStandardMaterial({ color: 0x4a2c16, roughness: 0.7 }); sg.add(board);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.62, 0.8), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.55, metalness: 0.05 })); face.position.z = -0.036; face.rotation.y = Math.PI; sg.add(face);
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.4, metalness: 0.9 });
  for (const x of [-1.1, 1.1]) for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 12), chainMat); l.position.set(x, 0.47 + k * 0.05, 0); l.rotation.y = k % 2 ? Math.PI / 2 : 0; l.scale.y = 1.5; sg.add(l); }
  sg.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // ---- props: burlap sacks, crate of golden potatoes, scale, till, lantern ----
  const burlap = new THREE.MeshStandardMaterial({ map: burlapTexture(), roughness: 0.95, color: 0xffffff });
  for (const [x, z, s, ry] of [[-2.75, -1.25, 1, 0.3], [-3.15, -0.9, 0.85, -0.5], [2.8, -1.35, 0.95, 0.8]]) {
    const m = new THREE.Mesh(sackGeo((x * 100) | 0), burlap); m.position.set(x, 0.0, z); m.scale.setScalar(s); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; G.add(m);
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 16), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 })); rope.rotation.x = Math.PI / 2; rope.position.set(x, 0.5 * s, z); G.add(rope);
  }
  const crate = new Kit();
  for (const [w, d, x, z] of [[0.62, 0.03, 0, -0.2], [0.62, 0.03, 0, 0.2], [0.03, 0.4, -0.3, 0], [0.03, 0.4, 0.3, 0]]) for (let k = 0; k < 3; k++) crate.add(rbox(w, 0.085, d, 0.006, woodTint(r)), oak, x, 0.05 + k * 0.1, z);
  crate.add(rbox(0.62, 0.02, 0.42, 0.004), dark, 0, 0.01, 0);
  const cg = new THREE.Group(); cg.position.set(1.55, 1.18, -0.35); cg.rotation.y = 0.15; crate.build(cg); G.add(cg);
  const potM = new THREE.MeshStandardMaterial({ color: 0xe0a83c, roughness: 0.55, metalness: 0.15, emissive: 0x2a1600 });
  const pg = new THREE.IcosahedronGeometry(0.06, 2); { const pp = pg.attributes.position; for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i); const k = 1 + 0.08 * Math.sin(x * 60 + z * 40) * Math.cos(y * 50); pp.setXYZ(i, x * k * 1.3, y * k * 0.85, z * k); } pg.computeVertexNormals(); }
  const pots = new THREE.InstancedMesh(pg, potM, 14), mm = new THREE.Matrix4();
  for (let k = 0; k < 14; k++) { mm.compose(V(-0.22 + (k % 5) * 0.11 + (r() - 0.5) * 0.03, 0.29 + Math.floor(k / 5) * 0.04, -0.13 + Math.floor(k / 5) * 0.12 + (r() - 0.5) * 0.04), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 0.6, r() * 6, r() * 0.5)), V(1, 1, 1)); pots.setMatrixAt(k, mm); }
  pots.castShadow = true; cg.add(pots);
  // brass scale
  const brass = M.brass, sc = new THREE.Group(); sc.position.set(-0.6, 1.18, -0.42);
  sc.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.03, 24), brass));
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.34, 10), brass); col.position.y = 0.18; sc.add(col);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.46, 8), brass); beam.rotation.z = Math.PI / 2 + 0.06; beam.position.y = 0.35; sc.add(beam);
  for (const sx of [-1, 1]) { const pan = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 8, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.4), brass); pan.position.set(sx * 0.22, 0.24 - sx * 0.013, 0); sc.add(pan); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; const str = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.12, 4), chainMat); str.position.set(sx * 0.22 + Math.cos(a) * 0.035, 0.3 - sx * 0.006, Math.sin(a) * 0.035); sc.add(str); } }
  sc.traverse(o => { if (o.isMesh) o.castShadow = true; }); G.add(sc);
  // vintage till
  const till = new THREE.Group(); till.position.set(1.0, 1.18, 0.05); till.rotation.y = Math.PI + 0.2;
  const tb = new THREE.Mesh(rbox(0.42, 0.2, 0.34, 0.02), brass); tb.position.y = 0.1; till.add(tb);
  const top = new THREE.Mesh(rbox(0.36, 0.16, 0.12, 0.02), brass); top.position.set(0, 0.27, -0.09); top.rotation.x = -0.25; till.add(top);
  const keyM = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.4 });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const kk = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 12), keyM); kk.position.set(-0.11 + i * 0.075, 0.215 + j * 0.012, 0.05 + j * 0.045); kk.rotation.x = -0.25; till.add(kk); }
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshStandardMaterial({ color: 0xffffff, map: canvasTex(textCanvas(128, 64, (x) => { x.fillStyle = '#f4ecd8'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#b8322a'; x.font = '900 40px Georgia'; x.textAlign = 'center'; x.fillText('₣ 0', 64, 46); }), true) })); flag.position.set(0, 0.38, -0.1); till.add(flag);
  till.traverse(o => { if (o.isMesh) o.castShadow = true; }); G.add(till);
  // lantern on the front beam (lights up at night)
  const lan = new THREE.Group(); lan.position.set(-1.6, 2.72, -0.95);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 6, 12), chainMat); hook.position.y = 0.3; lan.add(hook);
  const capL = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.1, 6), chainMat); capL.position.y = 0.2; lan.add(capL);
  const baseL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.03, 6), chainMat); baseL.position.y = -0.05; lan.add(baseL);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.24, 4), chainMat); bar.position.set(Math.cos(a) * 0.085, 0.07, Math.sin(a) * 0.085); lan.add(bar); }
  const glassL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.25, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false })); glassL.position.y = 0.07; lan.add(glassL);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc060, emissiveIntensity: 0 })); flame.scale.y = 1.6; flame.position.y = 0.06; lan.add(flame);
  const lampLight = new THREE.PointLight(0xffb060, 0, 7, 1.6); lampLight.position.y = 0.06; lan.add(lampLight);
  G.add(lan); shop.lantern = { flame, light: lampLight };
  // bell on the counter
  const bell = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.085], [0.012, 0.085], [0.014, 0.075], [0.035, 0.07], [0.058, 0.035], [0.066, 0.006], [0.07, 0]].map(p => new THREE.Vector2(...p)), 28), brass); bell.position.set(-1.3, 1.178, -0.4); bell.castShadow = true; G.add(bell); shop.bell = bell;
  const bellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.085, 0.012, 28), new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.4 })); bellBase.position.set(-1.3, 1.178, -0.4); G.add(bellBase);
  // chalkboard A-frame
  shop.chalkCanvas = textCanvas(512, 640, () => {}); shop.chalkTex = canvasTex(shop.chalkCanvas, true);
  const cb = new THREE.Group(); cb.position.set(3.15, 0.14, -1.25); cb.rotation.y = -0.4; G.add(cb);
  const fk = new Kit();
  for (const [x, rz] of [[-0.52, 0.0], [0.52, 0.0]]) fk.add(rbox(0.06, 1.75, 0.05, 0.01, woodTint(r)), dark, x, 0.86, -0.08, -0.16, 0, rz);
  fk.add(rbox(1.1, 0.07, 0.05, 0.01, woodTint(r)), dark, 0, 1.72, -0.22, -0.16); fk.add(rbox(1.1, 0.07, 0.05, 0.01, woodTint(r)), dark, 0, 0.42, 0.0, -0.16);
  for (const x of [-0.52, 0.52]) fk.add(rbox(0.05, 1.6, 0.04, 0.01, woodTint(r)), dark, x, 0.78, 0.28, 0.2);
  fk.build(cb);
  const chalk = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 1.22), new THREE.MeshStandardMaterial({ map: shop.chalkTex, roughness: 0.95 })); chalk.position.set(0, 1.07, -0.15); chalk.rotation.set(-0.16, Math.PI, 0); cb.add(chalk);
}
