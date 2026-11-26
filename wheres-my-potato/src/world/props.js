import * as THREE from 'three';
import { boxGeo, cylGeo } from './build.js';
import { canvasTex, textCanvas, paperTexture } from '../gfx/textures.js';
import { rng } from '../core/util.js';

// Detailed prop builders. Each returns a Group; meshes flagged userData.dynamic stay separate
// (animated / interactive), everything else is merged by the static batcher.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; return m; }
export function bx(w, h, d, mat, x, y, z, tile) { return mesh(boxGeo(w, h, d, tile ?? mat.userData?.tile ?? 1), mat, x, y, z); }
function cy(rt, rb, h, mat, x, y, z, seg = 16) { return mesh(cylGeo(rt, rb, h, seg, mat.userData?.tile ?? 1), mat, x, y, z); }
function lathe(points, mat, seg = 24) { const g = new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), seg); return mesh(g, mat); }
const dyn = o => { o.userData.dynamic = true; o.traverse(c => (c.userData.dynamic = true)); return o; };

// ---------- OFFICE ----------
export function desk(M) {
  const g = new THREE.Group();
  const top = bx(1.7, 0.05, 0.85, M.woodDark, 0, 0.76, 0); g.add(top);
  // modesty panel + pedestal with drawers
  g.add(bx(1.6, 0.6, 0.03, M.woodDark, 0, 0.44, 0.38));
  g.add(bx(0.03, 0.73, 0.8, M.woodDark, -0.83, 0.37, 0));
  const ped = new THREE.Group(); ped.position.set(0.55, 0, 0); g.add(ped);
  ped.add(bx(0.03, 0.73, 0.8, M.woodDark, -0.27, 0.37, 0)); ped.add(bx(0.03, 0.73, 0.8, M.woodDark, 0.27, 0.37, 0));
  g.userData.drawers = [];
  for (let k = 0; k < 3; k++) {
    const dr = new THREE.Group(); dr.position.set(0, 0.16 + k * 0.21, -0.39);
    dr.add(bx(0.52, 0.19, 0.02, M.woodDark, 0, 0, 0));
    dr.add(bx(0.5, 0.15, 0.7, M.wood, 0, -0.01, 0.36));
    const handle = cy(0.008, 0.008, 0.12, M.brass, 0, 0.02, -0.035, 8); handle.rotation.z = Math.PI / 2; dr.add(handle);
    dyn(dr); ped.add(dr); g.userData.drawers.push(dr);
  }
  return g;
}
export function crtComputer(M, screenTex) {
  const g = new THREE.Group();
  const beige = new THREE.MeshStandardMaterial({ color: 0xcfc6ad, roughness: 0.55 });
  const body = bx(0.4, 0.36, 0.42, beige, 0, 0.18, 0.05); g.add(body);
  g.add(bx(0.3, 0.28, 0.22, beige, 0, 0.17, 0.32)); // CRT tube back
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.24), new THREE.MeshStandardMaterial({ map: screenTex, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.9, roughness: 0.15 }));
  scr.position.set(0, 0.2, -0.161); scr.rotation.y = Math.PI; g.add(dyn(scr)); g.userData.screen = scr;
  g.add(bx(0.36, 0.03, 0.02, beige, 0, 0.05, -0.16));
  // keyboard with keys
  const kb = new THREE.Group(); kb.position.set(0, 0, -0.38); g.add(kb);
  kb.add(bx(0.46, 0.025, 0.16, beige, 0, 0.012, 0));
  const keyMat = new THREE.MeshStandardMaterial({ color: 0xe6dfcb, roughness: 0.6 });
  const kg = boxGeo(0.022, 0.012, 0.022, 1);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 17; c++) kb.add(mesh(kg, keyMat, -0.2 + c * 0.025, 0.03, -0.055 + r * 0.026, false));
  // floppy drive slot
  g.add(bx(0.12, 0.01, 0.01, M.black, 0.1, 0.06, -0.16));
  return g;
}
export function oldPhone(M) {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0x3a3330, roughness: 0.35 });
  g.add(bx(0.2, 0.06, 0.22, red, 0, 0.03, 0));
  const dial = cy(0.06, 0.06, 0.01, M.chrome, 0, 0.065, 0.02, 20); g.add(dial);
  const hand = new THREE.Group(); hand.position.set(0, 0.09, -0.02);
  hand.add(bx(0.24, 0.035, 0.05, red, 0, 0, 0)); hand.add(bx(0.06, 0.05, 0.06, red, -0.1, -0.02, 0)); hand.add(bx(0.06, 0.05, 0.06, red, 0.1, -0.02, 0));
  g.add(dyn(hand)); g.userData.handset = hand;
  // coiled cord
  const pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120; pts.push(V(-0.13 - t * 0.12 + Math.cos(t * 60) * 0.012, 0.03 + Math.sin(t * Math.PI) * 0.02, -0.02 + Math.sin(t * 60) * 0.012)); }
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.003, 4), red));
  return g;
}
export function mug(M, color = 0xe8e0d0) {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color, roughness: 0.25 });
  g.add(lathe([[0, 0], [0.04, 0], [0.043, 0.005], [0.045, 0.1], [0.04, 0.1], [0.038, 0.01], [0, 0.012]], m));
  const h = mesh(new THREE.TorusGeometry(0.025, 0.006, 8, 16, Math.PI), m, 0.045, 0.05, 0); h.rotation.z = -Math.PI / 2; g.add(h);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.039, 20), new THREE.MeshStandardMaterial({ color: 0x1a0d05, roughness: 0.05 }));
  coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.085; g.add(coffee);
  return g;
}
export function deskLamp(M) {
  const g = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({ color: 0x1f4a33, roughness: 0.3, metalness: 0.5 });
  g.add(cy(0.08, 0.09, 0.025, green, 0, 0.012, 0));
  const arm1 = cy(0.008, 0.008, 0.32, M.chrome, 0, 0.17, 0, 8); arm1.rotation.z = 0.35; arm1.position.x = -0.05; g.add(arm1);
  const arm2 = cy(0.008, 0.008, 0.3, M.chrome, 0.02, 0.38, 0, 8); arm2.rotation.z = -0.9; arm2.position.set(0.04, 0.36, 0); g.add(arm2);
  const shade = lathe([[0.01, 0], [0.03, 0.01], [0.09, -0.07], [0.095, -0.08]], green); shade.position.set(0.17, 0.44, 0); shade.rotation.z = -0.5; g.add(shade);
  const bulb = mesh(new THREE.SphereGeometry(0.025, 12, 8), M.lampOn, 0.18, 0.4, 0, false); g.add(bulb);
  g.userData.bulb = bulb;
  return g;
}
export function brokenFan(M) {
  const g = new THREE.Group();
  g.add(cy(0.07, 0.09, 0.03, M.paintCream, 0, 0.015, 0));
  g.add(cy(0.012, 0.012, 0.22, M.chrome, 0, 0.13, 0, 8));
  const head = new THREE.Group(); head.position.set(0, 0.26, 0); head.rotation.set(0.25, 0.4, 0.18); // drooping head
  const motor = cy(0.045, 0.05, 0.12, M.paintCream, 0, 0, 0.05, 12); motor.rotation.x = Math.PI / 2; head.add(motor);
  const cage = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.35), new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 1, roughness: 0.3, wireframe: true }));
  cage.rotation.x = -Math.PI / 2; cage.position.z = -0.03; head.add(cage);
  const blades = new THREE.Group(); blades.position.z = -0.02;
  for (let k = 0; k < 3; k++) { const b = bx(0.035, 0.1, 0.004, M.paintCream, 0, 0.055, 0); const p = new THREE.Group(); p.rotation.z = k * 2.1 + (k === 1 ? 0.5 : 0); p.add(b); if (k === 2) b.rotation.x = 0.6; blades.add(p); }
  head.add(dyn(blades)); g.add(head); g.userData.blades = blades;
  return g;
}
export function filingCabinet(M) {
  const g = new THREE.Group();
  g.add(bx(0.48, 1.32, 0.62, M.paintGrey, 0, 0.66, 0));
  for (let k = 0; k < 4; k++) {
    g.add(bx(0.44, 0.29, 0.01, M.paintGrey, 0, 0.18 + k * 0.32, -0.315));
    g.add(bx(0.12, 0.02, 0.025, M.chrome, 0, 0.26 + k * 0.32, -0.33));
    g.add(bx(0.07, 0.04, 0.005, M.paper, 0, 0.22 + k * 0.32, -0.322));
  }
  return g;
}
export function cardboardBox(M, w = 0.5, h = 0.35, d = 0.4, open = false) {
  const g = new THREE.Group(); g.add(bx(w, h, d, M.cardboard, 0, h / 2, 0, 0.6));
  const tape = new THREE.MeshStandardMaterial({ color: 0xb68a4a, roughness: 0.4 });
  if (!open) g.add(bx(0.06, 0.003, d + 0.01, tape, 0, h + 0.001, 0));
  else { const f = bx(w, 0.005, d / 2, M.cardboard, 0, h + 0.1, -d / 2 - 0.08); f.rotation.x = -1.1; g.add(f); }
  return g;
}
export function coatHanger(M, coatMat) {
  const g = new THREE.Group();
  g.add(cy(0.012, 0.012, 1.8, M.woodDark, 0, 0.9, 0, 8));
  g.add(cy(0.2, 0.22, 0.03, M.woodDark, 0, 0.015, 0, 12));
  for (let k = 0; k < 4; k++) { const p = cy(0.008, 0.008, 0.18, M.woodDark, Math.cos(k * 1.57) * 0.06, 1.72, Math.sin(k * 1.57) * 0.06, 6); p.rotation.set(Math.sin(k * 1.57) * 0.9, 0, -Math.cos(k * 1.57) * 0.9); g.add(p); }
  // hanging coat (lathe drape)
  const coat = lathe([[0.02, 0], [0.12, -0.05], [0.2, -0.3], [0.22, -0.7], [0.24, -1.0], [0.0, -1.0]], coatMat, 14);
  coat.position.set(0.12, 1.75, 0); coat.scale.set(1, 1, 0.55); g.add(coat);
  // old cap on top hook
  const cap = lathe([[0, 0.09], [0.08, 0.07], [0.1, 0.0], [0, 0]], new THREE.MeshStandardMaterial({ color: 0x2a3b5a, roughness: 0.9 }), 14); cap.position.set(-0.1, 1.75, 0); g.add(cap);
  return g;
}
export function keyRing(M) {
  const g = new THREE.Group();
  g.add(bx(0.25, 0.12, 0.02, M.woodDark, 0, 0, 0));
  for (let k = 0; k < 5; k++) {
    const hook = cy(0.003, 0.003, 0.03, M.brass, -0.1 + k * 0.05, 0.02, -0.02, 6); hook.rotation.x = Math.PI / 2; g.add(hook);
    const key = new THREE.Group(); key.position.set(-0.1 + k * 0.05, 0.0, -0.025);
    key.add(new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.002, 6, 12), M.brass));
    const blade = bx(0.006, 0.05, 0.002, M.brass, 0, -0.035, 0); key.add(blade);
    key.rotation.z = (k - 2) * 0.12; g.add(key);
  }
  return g;
}
export function picFrame(M, tex, w = 0.18, h = 0.13, standing = true) {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 0.4 });
  g.add(bx(w + 0.03, h + 0.03, 0.015, frame, 0, 0, 0));
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.2 }));
  pic.position.z = -0.009; pic.rotation.y = Math.PI; g.add(pic);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.02, metalness: 0.5 }));
  glass.position.z = -0.0095; glass.rotation.y = Math.PI; g.add(glass);
  if (standing) { const leg = bx(0.02, h * 0.9, 0.01, frame, 0, -0.01, 0.05); leg.rotation.x = -0.35; g.add(leg); g.rotation.x = 0.18; }
  return g;
}
export function paperStack(M, tex, n = 6, w = 0.21, d = 0.297) {
  const g = new THREE.Group(); const r = rng(n * 17);
  const pm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
  for (let k = 0; k < n; k++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), k === n - 1 ? pm : M.paper);
    p.rotation.x = -Math.PI / 2; p.rotation.z = (r() - 0.5) * 0.3; p.position.set((r() - 0.5) * 0.02, 0.002 + k * 0.0012, (r() - 0.5) * 0.02); p.receiveShadow = true; g.add(p);
  }
  return g;
}
export function notebookProp(M, tex) {
  const g = new THREE.Group();
  const cover = new THREE.MeshStandardMaterial({ color: 0x5a2418, roughness: 0.7 });
  g.add(bx(0.3, 0.012, 0.21, cover, 0, 0.006, 0));
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  page.rotation.x = -Math.PI / 2; page.position.y = 0.0135; g.add(page);
  const pen = cy(0.004, 0.004, 0.14, M.black, 0.04, 0.02, 0.05, 6); pen.rotation.set(Math.PI / 2, 0, 0.4); g.add(pen);
  return g;
}
export function calendarTex() {
  return canvasTex(textCanvas(384, 560, (x, w, h) => {
    x.fillStyle = '#f1ead6'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#7a1c12'; x.fillRect(0, 0, w, 56); x.fillStyle = '#fff'; x.font = '700 28px Georgia'; x.textAlign = 'center'; x.fillText('NOVEMBRE 1998', w / 2, 38);
    // drawing of "potato of the month"
    x.fillStyle = '#c69a5a'; x.beginPath(); x.ellipse(w / 2, 170, 110, 70, -0.25, 0, 7); x.fill();
    x.fillStyle = '#7a5a30'; for (let k = 0; k < 9; k++) { x.beginPath(); x.arc(w / 2 - 70 + k * 18, 160 + Math.sin(k * 2) * 30, 3.5, 0, 7); x.fill(); }
    x.fillStyle = '#333'; x.font = 'italic 20px Georgia'; x.fillText('La Bintje du mois', w / 2, 270);
    x.font = '16px Georgia'; x.textAlign = 'left';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) { const d = r * 7 + c - 6; x.strokeStyle = '#bbb'; x.strokeRect(14 + c * 51, 290 + r * 52, 51, 52); if (d > 0 && d <= 30) x.fillText(String(d), 18 + c * 51, 308 + r * 52); }
    x.strokeStyle = '#c0392b'; x.lineWidth = 3; x.beginPath(); x.arc(14 + 3 * 51 + 25, 290 + 2 * 52 + 26, 22, 0, 7); x.stroke(); // circled day
    x.fillStyle = '#c0392b'; x.font = 'italic 13px Georgia'; x.fillText('O. ♥', 14 + 3 * 51 + 10, 290 + 3 * 52 - 6);
  }), true);
}
export function photoTex(kind, seed = 1) {
  // Small "family photographs": silhouettes in faded colour, drawn procedurally
  return canvasTex(textCanvas(256, 192, (x, w, h) => {
    const r = rng(seed);
    const sky = kind === 'wedding' ? ['#d8cfb8', '#a99f88'] : kind === 'warehouse' ? ['#b9c4c8', '#7c8a8c'] : ['#cbb79a', '#8d7a5c'];
    const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    if (kind === 'warehouse') { x.fillStyle = '#5d4b3b'; x.fillRect(30, 70, 200, 90); x.fillStyle = '#7a1c12'; x.fillRect(80, 52, 100, 18); x.fillStyle = '#eee'; x.font = '9px Georgia'; x.fillText('BOUCHARD 1987', 92, 65); }
    if (kind === 'field') { x.fillStyle = '#6b5a32'; x.fillRect(0, 120, w, 72); x.strokeStyle = '#4d6b2f'; for (let k = 0; k < 12; k++) { x.beginPath(); x.moveTo(k * 24, 192); x.lineTo(128, 120); x.stroke(); } }
    const person = (px, s, col, hair) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, 150, 18 * s, 40 * s, 0, 0, 7); x.fill(); x.fillStyle = '#e0b89a'; x.beginPath(); x.arc(px, 100 - (1 - s) * 30, 12 * s, 0, 7); x.fill(); x.fillStyle = hair; x.beginPath(); x.arc(px, 96 - (1 - s) * 30, 12 * s, Math.PI, 0); x.fill(); };
    person(100, 1, kind === 'wedding' ? '#222' : '#5a3a2a', '#3a2a1a');
    person(150, 0.95, kind === 'wedding' ? '#f4f0e8' : '#8a4a5a', '#7a4a2a');
    if (kind === 'field') person(190, 0.6, '#3a5a8a', '#5a3a1a');
    // fade, vignette, grain
    const id = x.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const i = (y * w + xx) * 4, l = (id.data[i] + id.data[i + 1] + id.data[i + 2]) / 3, v = 1 - Math.pow(Math.hypot(xx / w - 0.5, y / h - 0.5) * 1.4, 3);
      const g = (r() - 0.5) * 22;
      id.data[i] = (l * 0.4 + id.data[i] * 0.6 + 30) * v + g; id.data[i + 1] = (l * 0.4 + id.data[i + 1] * 0.6 + 12) * v + g; id.data[i + 2] = (l * 0.5 + id.data[i + 2] * 0.5) * v + g;
    }
    x.putImageData(id, 0, 0);
  }), true);
}

// ---------- WAREHOUSE ----------
export function pallet(M) {
  const g = new THREE.Group();
  for (let k = 0; k < 7; k++) g.add(bx(1.2, 0.022, 0.1, M.crate, 0, 0.133, -0.45 + k * 0.15, 1.2));
  for (let k = 0; k < 3; k++) { g.add(bx(1.2, 0.022, 0.1, M.crate, 0, 0.011, -0.45 + k * 0.45, 1.2)); g.add(bx(0.1, 0.1, 1.0, M.crate, -0.55 + k * 0.55, 0.072, 0, 1.2)); }
  return g;
}
export function bin(M, w = 2.2, h = 1.25, d = 2.2) {
  const g = new THREE.Group(); const t = 0.06;
  g.add(bx(w, t, d, M.crate, 0, 0.12, 0));
  g.add(bx(w, h, t, M.crate, 0, h / 2, -d / 2 + t / 2)); g.add(bx(w, h, t, M.crate, 0, h / 2, d / 2 - t / 2));
  g.add(bx(t, h, d, M.crate, -w / 2 + t / 2, h / 2, 0)); g.add(bx(t, h, d, M.crate, w / 2 - t / 2, h / 2, 0));
  // corner posts + skids + stencil
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(bx(0.1, h + 0.02, 0.1, M.woodDark, sx * (w / 2 - 0.05), h / 2, sz * (d / 2 - 0.05)));
  for (const sz of [-1, 0, 1]) g.add(bx(w, 0.1, 0.1, M.woodDark, 0, 0.05, sz * (d / 2 - 0.1)));
  return g;
}
export function binStencil(text) {
  return canvasTex(textCanvas(256, 96, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(25,20,15,0.78)'; x.font = '900 42px "Courier New", monospace'; x.textAlign = 'center'; x.fillText(text, w / 2, 62); }), true);
}
export function forklift(M) {
  const g = new THREE.Group();
  g.add(bx(1.2, 0.55, 2.1, M.paintYellow, 0, 0.55, 0));
  g.add(bx(1.15, 0.5, 0.55, M.paintGrey, 0, 0.75, 0.85)); // counterweight
  g.add(bx(0.5, 0.12, 0.5, M.black, 0, 0.92, 0.25)); g.add(bx(0.5, 0.45, 0.1, M.black, 0, 1.15, 0.5)); // seat
  // overhead guard
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(bx(0.06, 1.35, 0.06, M.paintYellow, sx * 0.55, 1.5, sz * 0.55 + 0.1));
  for (let k = 0; k < 5; k++) g.add(bx(1.16, 0.04, 0.06, M.paintYellow, 0, 2.18, -0.45 + k * 0.27));
  // mast + forks
  for (const sx of [-1, 1]) g.add(bx(0.1, 2.6, 0.12, M.paintGrey, sx * 0.4, 1.3, -1.1));
  g.add(bx(0.9, 0.5, 0.06, M.paintGrey, 0, 0.45, -1.2));
  for (const sx of [-1, 1]) g.add(bx(0.12, 0.05, 1.1, M.metal, sx * 0.3, 0.2, -1.75));
  // wheels
  const wg = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 20); wg.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(wg, M.rubberBlack, sx * 0.6, 0.3, sz * 0.7));
  // steering wheel + warning light
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 8, 20), M.black); sw.position.set(0, 1.3, -0.25); sw.rotation.x = -0.9; g.add(sw);
  const beacon = mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshStandardMaterial({ color: 0x441800, emissive: 0xff7a00, emissiveIntensity: 0.4 }), 0, 2.27, 0.3); g.add(dyn(beacon));
  g.userData.beacon = beacon;
  return g;
}
export function conveyor(M, len) {
  const g = new THREE.Group();
  const beltTex = M.rubber.map.clone(); beltTex.needsUpdate = true; beltTex.repeat.set(1, len);
  const beltMat = new THREE.MeshStandardMaterial({ map: beltTex, color: 0x2c2c2c, roughness: 0.8 });
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, len), beltMat); belt.position.y = 0.98; belt.receiveShadow = true; g.add(dyn(belt));
  g.userData.beltTex = beltTex;
  for (const sx of [-1, 1]) { g.add(bx(0.06, 0.18, len, M.paintGreen, sx * 0.44, 1.0, 0)); g.add(bx(0.03, 0.25, len, M.metal, sx * 0.47, 1.18, 0)); }
  for (let z = -len / 2 + 0.5; z < len / 2; z += 1.6) for (const sx of [-1, 1]) g.add(bx(0.07, 0.95, 0.07, M.paintGreen, sx * 0.4, 0.47, z));
  const rg = new THREE.CylinderGeometry(0.04, 0.04, 0.82, 10); rg.rotateZ(Math.PI / 2);
  for (let z = -len / 2 + 0.2; z < len / 2; z += 0.4) g.add(mesh(rg, M.chrome, 0, 0.93, z, false));
  return g;
}
export function sorter(M) {
  const g = new THREE.Group();
  g.add(bx(2.6, 2.4, 2.2, M.paintGreen, 0, 1.2, 0));
  g.add(bx(2.0, 0.3, 1.8, M.paintGrey, 0, 2.55, 0));
  const hop = lathe([[0.4, 0], [1.1, 0.9], [1.15, 0.92]], M.metal, 4); hop.rotation.y = Math.PI / 4; hop.position.y = 2.7; g.add(hop);
  // control panel w/ buttons and gauge
  g.add(bx(0.7, 0.5, 0.12, M.paintCream, 0.7, 1.4, -1.16));
  const cols = [0xff2222, 0x22cc33, 0xffcc00];
  cols.forEach((c, k) => g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 12).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.4 }), 0.5 + k * 0.12, 1.3, -1.23)));
  const gauge = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 20).rotateX(Math.PI / 2), M.paintCream, 0.85, 1.52, -1.23); g.add(gauge);
  const needle = bx(0.005, 0.07, 0.005, M.paintRed, 0.85, 1.55, -1.245); g.add(dyn(needle)); g.userData.needle = needle;
  // hazard stripes
  const hz = canvasTex(textCanvas(256, 64, (x, w, h) => { x.fillStyle = '#f2b90c'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; for (let k = -2; k < 10; k++) { x.beginPath(); x.moveTo(k * 32, h); x.lineTo(k * 32 + 16, h); x.lineTo(k * 32 + 32 + 16, 0); x.lineTo(k * 32 + 32, 0); x.fill(); } }), true);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.2), new THREE.MeshStandardMaterial({ map: hz, roughness: 0.6 })); stripe.position.set(0, 0.2, -1.105); stripe.rotation.y = Math.PI; g.add(stripe);
  const beacon = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0x401000, emissive: 0xff6a00, emissiveIntensity: 0.3, transparent: true, opacity: 0.9 }), 1.1, 2.8, -0.8);
  g.add(dyn(beacon)); g.userData.beacon = beacon;
  return g;
}
export function pendantLamp(M, mat) {
  const g = new THREE.Group();
  g.add(cy(0.01, 0.01, 1.6, M.black, 0, 0.8, 0, 6));
  const sh = lathe([[0.04, 0], [0.1, -0.05], [0.32, -0.3], [0.34, -0.32]], M.paintGreen, 20); g.add(sh);
  g.add(mesh(new THREE.SphereGeometry(0.07, 12, 8), mat || M.lampSodium, 0, -0.2, 0, false));
  return g;
}
export function ibeam(M, h) {
  const g = new THREE.Group();
  g.add(bx(0.3, h, 0.02, M.paintBlue, 0, h / 2, 0)); g.add(bx(0.02, h, 0.28, M.paintBlue, -0.14, h / 2, 0)); g.add(bx(0.02, h, 0.28, M.paintBlue, 0.14, h / 2, 0));
  return g;
}
export function truss(M, span, rise) {
  const g = new THREE.Group(); const t = 0.12;
  const seg = (x0, y0, x1, y1) => { const l = Math.hypot(x1 - x0, y1 - y0); const b = bx(l, t, t, M.paintBlue, (x0 + x1) / 2, (y0 + y1) / 2, 0); b.rotation.z = Math.atan2(y1 - y0, x1 - x0); g.add(b); };
  seg(-span / 2, 0, span / 2, 0); seg(-span / 2, 0, 0, rise); seg(0, rise, span / 2, 0);
  const n = 8; for (let k = 1; k < n; k++) { const x = -span / 2 + k * span / n; const y = rise * (1 - Math.abs(x) / (span / 2)); seg(x, 0, x, y); if (k < n - 1) { const x2 = x + span / n; const y2 = rise * (1 - Math.abs(x2) / (span / 2)); seg(x, 0, x2, y2); } }
  return g;
}
export function hayBale(M) { const g = new THREE.Group(); g.add(bx(1.0, 0.5, 0.5, M.hay, 0, 0.25, 0, 0.9)); const tw = new THREE.MeshStandardMaterial({ color: 0x6a4a1a }); for (const x of [-0.25, 0.25]) g.add(bx(0.02, 0.51, 0.51, tw, x, 0.25, 0)); return g; }
export function plasticCrate(M, w = 1.2, h = 0.75, d = 0.8, mat) {
  const g = new THREE.Group(); const m = mat || M.plastic; const t = 0.04;
  g.add(bx(w, 0.05, d, m, 0, 0.025, 0));
  g.add(bx(w, h, t, m, 0, h / 2, -d / 2)); g.add(bx(w, h, t, m, 0, h / 2, d / 2)); g.add(bx(t, h, d, m, -w / 2, h / 2, 0)); g.add(bx(t, h, d, m, w / 2, h / 2, 0));
  return g;
}
export function fridgeUnit(M) {
  const g = new THREE.Group();
  g.add(bx(2.4, 0.9, 0.7, M.paintCream, 0, 0, 0));
  const fans = [];
  for (const x of [-0.6, 0.6]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 8, 24), M.paintGrey); ring.position.set(x, 0, -0.36); g.add(ring);
    const fan = new THREE.Group(); fan.position.set(x, 0, -0.38);
    for (let k = 0; k < 5; k++) { const b = bx(0.1, 0.28, 0.01, M.metal, 0, 0.15, 0); b.rotation.y = 0.4; const p = new THREE.Group(); p.rotation.z = k * 1.2566; p.add(b); fan.add(p); }
    g.add(dyn(fan)); fans.push(fan);
    const grill = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), M.grate); grill.position.set(x, 0, -0.4); grill.rotation.y = Math.PI; g.add(grill);
  }
  g.userData.fans = fans;
  return g;
}
export function stripCurtain(M, w, h) {
  const g = new THREE.Group(); const strips = [];
  const mat = new THREE.MeshStandardMaterial({ color: 0xcfe2e8, transparent: true, opacity: 0.45, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const n = Math.round(w / 0.22);
  for (let k = 0; k < n; k++) {
    const p = new THREE.Group(); p.position.set(-w / 2 + 0.11 + k * (w / n), h, 0);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.2, h), mat); s.position.y = -h / 2; p.add(s);
    g.add(p); strips.push({ p, ang: 0, vel: 0 });
  }
  dyn(g); g.userData.strips = strips;
  return g;
}
export function workbench(M) {
  const g = new THREE.Group();
  g.add(bx(2.4, 0.08, 0.9, M.woodDark, 0, 0.9, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(bx(0.08, 0.9, 0.08, M.woodDark, sx * 1.1, 0.45, sz * 0.38));
  g.add(bx(2.3, 0.04, 0.8, M.woodDark, 0, 0.25, 0));
  g.add(bx(2.4, 1.2, 0.04, M.woodDark, 0, 1.5, 0.45)); // pegboard
  // tools on pegboard (silhouettes)
  g.add(bx(0.04, 0.35, 0.02, M.metal, -0.8, 1.6, 0.42)); g.add(bx(0.18, 0.05, 0.02, M.metal, -0.8, 1.76, 0.42));
  g.add(bx(0.03, 0.3, 0.02, M.woodDark, -0.5, 1.55, 0.42)); g.add(bx(0.12, 0.05, 0.03, M.metal, -0.5, 1.7, 0.42));
  const trowel = bx(0.1, 0.16, 0.01, M.metal, -0.2, 1.5, 0.42); g.add(trowel);
  return g;
}
export function radio(M) {
  const g = new THREE.Group();
  g.add(bx(0.4, 0.26, 0.16, M.woodDark, 0, 0.13, 0));
  const grille = canvasTex(textCanvas(128, 96, (x, w, h) => { x.fillStyle = '#4a3a24'; x.fillRect(0, 0, w, h); x.strokeStyle = '#2a1e10'; for (let k = 0; k < 12; k++) { x.beginPath(); x.moveTo(0, k * 8); x.lineTo(w, k * 8); x.stroke(); } }), true);
  const gp = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.17), new THREE.MeshStandardMaterial({ map: grille })); gp.position.set(-0.06, 0.13, -0.081); gp.rotation.y = Math.PI; g.add(gp);
  const dial = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16).rotateX(Math.PI / 2), M.brass, 0.13, 0.17, -0.09); g.add(dial);
  const dial2 = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 16).rotateX(Math.PI / 2), M.brass, 0.13, 0.08, -0.09); g.add(dial2);
  const ant = cy(0.003, 0.003, 0.5, M.chrome, 0.15, 0.48, 0.05, 6); ant.rotation.z = -0.4; g.add(ant);
  return g;
}
export function shovelRack(M) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) { const s = cy(0.018, 0.018, 1.3, M.wood, k * 0.25, 0.85, 0, 8); s.rotation.z = 0.12; g.add(s); g.add(bx(0.22, 0.28, 0.02, M.metal, k * 0.25 + 0.07, 0.15, 0)); }
  return g;
}

// ---------- EXTERIOR ----------
export function bareTree(M, seed, height = 7) {
  const g = new THREE.Group(); const r = rng(seed);
  const branch = (base, dir, len, rad, depth) => {
    const end = base.clone().addScaledVector(dir, len);
    const c = new THREE.CylinderGeometry(rad * 0.65, rad, len, 6); c.translate(0, len / 2, 0);
    const m = new THREE.Mesh(c, M.bark); m.position.copy(base); m.quaternion.setFromUnitVectors(V(0, 1, 0), dir); m.castShadow = true; g.add(m);
    if (depth <= 0 || rad < 0.02) return;
    const n = depth > 2 ? 2 : 3;
    for (let k = 0; k < n; k++) {
      const nd = dir.clone().add(V((r() - 0.5) * 1.3, r() * 0.5, (r() - 0.5) * 1.3)).normalize();
      branch(end, nd, len * (0.62 + r() * 0.15), rad * 0.62, depth - 1);
    }
  };
  branch(V(0, 0, 0), V(0, 1, 0), height * 0.35, 0.22, 4);
  return g;
}
export function fence(M, len) {
  const g = new THREE.Group();
  const meshTex = canvasTex(textCanvas(64, 64, (x, w, h) => { x.clearRect(0, 0, w, h); x.strokeStyle = '#9aa3a6'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, h); x.moveTo(w, 0); x.lineTo(0, h); x.stroke(); }), true);
  meshTex.repeat.set(len / 0.15, 2.0 / 0.15);
  const mm = new THREE.MeshStandardMaterial({ map: meshTex, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.4 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.0), mm); p.position.y = 1.05; g.add(p);
  for (let x = -len / 2; x <= len / 2 + 0.01; x += 3) g.add(cy(0.04, 0.04, 2.2, M.metal, x, 1.1, 0, 8));
  const rail = cy(0.025, 0.025, len, M.metal, 0, 2.1, 0, 6); rail.rotation.z = Math.PI / 2; g.add(rail);
  return g;
}
export function lampPost(M) {
  const g = new THREE.Group();
  g.add(cy(0.08, 0.11, 6.5, M.paintGrey, 0, 3.25, 0, 10));
  const arm = bx(1.4, 0.08, 0.08, M.paintGrey, 0.65, 6.4, 0); g.add(arm);
  const head = bx(0.55, 0.12, 0.28, M.paintGrey, 1.3, 6.35, 0); g.add(head);
  const glow = bx(0.45, 0.02, 0.2, M.lampSodium, 1.3, 6.28, 0); g.add(glow);
  return g;
}
export function van(M) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.35, metalness: 0.3, envMapIntensity: 1.0 });
  g.add(bx(1.9, 1.5, 4.6, paint, 0, 1.15, 0)); g.add(bx(1.9, 0.9, 1.1, paint, 0, 0.85, -2.8));
  const win = new THREE.MeshStandardMaterial({ color: 0x1a2428, roughness: 0.05, metalness: 0.8 });
  g.add(bx(1.75, 0.6, 0.05, win, 0, 1.55, -2.33)); g.add(bx(0.05, 0.5, 0.8, win, 0.96, 1.6, -1.8)); g.add(bx(0.05, 0.5, 0.8, win, -0.96, 1.6, -1.8));
  const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.25, 18); wg.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) for (const sz of [-2.3, 1.5]) g.add(mesh(wg, M.rubberBlack, sx * 0.85, 0.36, sz));
  g.add(bx(1.9, 0.2, 0.15, M.chrome, 0, 0.5, -3.37));
  for (const sx of [-1, 1]) g.add(bx(0.3, 0.15, 0.05, M.lampOn, sx * 0.7, 0.85, -3.36));
  // side lettering
  const lt = canvasTex(textCanvas(512, 128, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#7a1c12'; x.font = '900 52px Georgia'; x.fillText('BOUCHARD', 20, 60); x.font = '700 30px Georgia'; x.fillText('Pommes de terre — depuis 1987', 20, 105); }), true);
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshStandardMaterial({ map: lt, transparent: true, roughness: 0.4 })); p.position.set(sx * 0.955, 1.2, 0.3); p.rotation.y = sx * Math.PI / 2; if (sx < 0) p.scale.x = -1; g.add(p); }
  return g;
}
export function truck(M) {
  const g = new THREE.Group();
  const cab = new THREE.MeshStandardMaterial({ color: 0x2c5d8a, roughness: 0.35, metalness: 0.4 });
  g.add(bx(2.4, 2.4, 2.2, cab, 0, 1.6, -3.6));
  g.add(bx(2.5, 2.8, 6.2, M.paintCream, 0, 1.9, 0.8));
  const win = new THREE.MeshStandardMaterial({ color: 0x0d1418, roughness: 0.05, metalness: 0.9 });
  g.add(bx(2.2, 0.9, 0.05, win, 0, 2.2, -4.71));
  const wg = new THREE.CylinderGeometry(0.5, 0.5, 0.35, 18); wg.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-3.5, 1.6, 2.9]) { const w = mesh(wg, M.rubberBlack, sx * 1.1, 0.5, sz); g.add(w); wheels.push(w); }
  const head = [];
  for (const sx of [-1, 1]) { const h = bx(0.35, 0.22, 0.05, M.lampOn, sx * 0.85, 1.0, -4.72); g.add(h); head.push(h); }
  dyn(g); g.userData.wheels = wheels;
  return g;
}
export function counterShop(M) {
  const g = new THREE.Group();
  g.add(bx(6, 1.05, 0.7, M.woodDark, 0, 0.525, 0)); g.add(bx(6.2, 0.06, 0.85, M.wood, 0, 1.08, 0));
  // cash register
  const reg = new THREE.Group(); reg.position.set(1.8, 1.11, 0.05);
  reg.add(bx(0.45, 0.18, 0.4, M.paintGrey, 0, 0.09, 0)); const top = bx(0.4, 0.15, 0.25, M.paintGrey, 0, 0.25, 0.05); top.rotation.x = -0.4; reg.add(top);
  reg.add(bx(0.25, 0.08, 0.02, M.screen, 0, 0.35, 0.12)); g.add(reg);
  // bell
  const bell = lathe([[0, 0.06], [0.03, 0.055], [0.05, 0.02], [0.055, 0]], M.brass); bell.position.set(-1.2, 1.11, -0.1); g.add(bell);
  g.add(cy(0.06, 0.06, 0.01, M.black, -1.2, 1.115, -0.1));
  return g;
}
export function shelfUnit(M, w = 2.4, h = 2.2) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) g.add(bx(0.06, h, 0.5, M.paintGrey, sx * w / 2, h / 2, 0));
  for (let k = 0; k < 4; k++) g.add(bx(w, 0.03, 0.5, M.paintGrey, 0, 0.3 + k * 0.6, 0));
  return g;
}
export function potatoSack(M, seed) {
  const g = new THREE.Group(); const r = rng(seed);
  const jute = new THREE.MeshStandardMaterial({ map: M.canvas.map, normalMap: M.canvas.normalMap, color: 0xc8a878, roughness: 1 });
  const pts = [[0, 0], [0.25, 0.02], [0.3, 0.2], [0.28, 0.5], [0.18, 0.66], [0.06, 0.72], [0.07, 0.8], [0, 0.82]];
  const s = lathe(pts, jute, 14); s.scale.set(1, 0.9 + r() * 0.2, 0.75); s.rotation.z = (r() - 0.5) * 0.2; g.add(s);
  return g;
}
export function cobweb() {
  const c = textCanvas(256, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.strokeStyle = 'rgba(230,230,230,0.55)'; x.lineWidth = 1;
    for (let k = 0; k < 9; k++) { x.beginPath(); x.moveTo(0, 0); const a = k / 8 * Math.PI / 2; x.lineTo(Math.cos(a) * w, Math.sin(a) * h); x.stroke(); }
    for (let r = 20; r < 250; r += 18) { x.beginPath(); for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI / 2; const rr = r + Math.sin(k * 3 + r) * 4; k ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.stroke(); }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: canvasTex(c), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.userData.dynamic = true; return m;
}
export function screenTexture(lines) {
  const c = textCanvas(320, 240, (x, w, h) => {
    x.fillStyle = '#041008'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#58ff86'; x.font = '15px "Courier New", monospace';
    lines.forEach((l, i) => x.fillText(l, 12, 24 + i * 19));
    for (let y = 0; y < h; y += 3) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, y, w, 1); }
  });
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.userData = { canvas: c };
  return t;
}
export { paperTexture };
