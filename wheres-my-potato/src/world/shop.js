import * as THREE from 'three';
import { boxGeo, Batcher } from './build.js';
import { canvasTex, textCanvas } from '../gfx/textures.js';
import { Gerard } from '../actors/npc.js';
import { rng } from '../core/util.js';

// =====================================================================================
// GÉRARD'S SHOP: wooden market stall, striped awning, shelves displaying every upgrade
// (the displayed models swap as you buy them), chalkboard, bell, and Gérard himself.
// =====================================================================================
export const SHOP = { x: -8, z: 27.5 };

// Upgrade catalogue: each item has levels; value(level) gives the gameplay value.
export const ITEMS = [
  { id: 'bucket', icon: '🪣', name: 'Contenant', levels: [
    { name: 'Mains nues', price: 0, cap: 0, desc: 'Tu portes les patates dans tes bras.' },
    { name: 'Seau en fer', price: 40, cap: 12, desc: 'Un vieux seau cabossé. Ramasse 12 patates d’un coup.' },
    { name: 'Grand seau galvanisé', price: 260, cap: 30, desc: '30 patates. Ça commence à peser.' },
    { name: 'Bassine géante', price: 1100, cap: 70, desc: 'Une bassine de lessive XXL. 70 patates.' },
    { name: 'Benne à bras', price: 4200, cap: 160, desc: 'Gérard l’a soudée lui-même. 160 patates.' },
  ] },
  { id: 'gloves', icon: '🧤', name: 'Gants de récolte', levels: [
    { name: 'Sans gants', price: 0, cap: 3, desc: '3 patates dans les bras.' },
    { name: 'Gants de jardin', price: 60, cap: 5, desc: '5 patates dans les bras.' },
    { name: 'Gants de pro', price: 320, cap: 8, desc: '8 patates dans les bras, prises plus rapides.' },
  ] },
  { id: 'magnet', icon: '🧲', name: 'Râteau aimanté', levels: [
    { name: 'Aucun', price: 0, radius: 0.85, rate: 9, desc: 'Portée de ramassage normale.' },
    { name: 'Râteau aimanté', price: 190, radius: 1.3, rate: 14, desc: 'Attire les patates de plus loin.' },
    { name: 'Aimant à tubercules', price: 800, radius: 1.85, rate: 20, desc: 'Personne ne sait comment ça marche.' },
    { name: 'Vortex à patates', price: 2900, radius: 2.6, rate: 30, desc: 'Gérard décline toute responsabilité.' },
  ] },
  { id: 'boots', icon: '🥾', name: 'Bottes', levels: [
    { name: 'Chaussures de ville', price: 0, speed: 1, desc: 'Vitesse normale.' },
    { name: 'Bottes de champ', price: 130, speed: 1.2, desc: '+20 % de vitesse.' },
    { name: 'Bottes de course', price: 650, speed: 1.42, desc: '+42 % de vitesse, saut plus haut.' },
  ] },
  { id: 'motor', icon: '⚙️', name: 'Moteur du convoyeur', levels: [
    { name: 'Moteur d’origine', price: 0, feed: 0.55, speed: 1.2, desc: '≈ 2 patates / seconde.' },
    { name: 'Moteur révisé', price: 110, feed: 0.34, speed: 1.55, desc: '≈ 3 patates / seconde.' },
    { name: 'Moteur diesel', price: 380, feed: 0.22, speed: 1.95, desc: '≈ 4,5 patates / seconde.' },
    { name: 'Turbo agricole', price: 1150, feed: 0.14, speed: 2.5, desc: '≈ 7 patates / seconde.' },
    { name: 'Moteur de fusée', price: 3600, feed: 0.075, speed: 3.3, desc: '≈ 13 patates / seconde. Bruyant.' },
  ] },
  { id: 'fertilizer', icon: '🌱', name: 'Engrais', levels: [
    { name: 'Aucun', price: 0, grow: 1, gold: 0.0, desc: 'Les patates repoussent en 15-35 s.' },
    { name: 'Compost maison', price: 270, grow: 0.6, gold: 0.008, desc: 'Repousse plus vite, quelques patates dorées.' },
    { name: 'Engrais miracle', price: 980, grow: 0.33, gold: 0.025, desc: 'Repousse éclair, patates dorées fréquentes.' },
  ] },
  { id: 'contract', icon: '📜', name: 'Contrat', levels: [
    { name: 'Vente au marché', price: 0, mult: 1, desc: 'Prix normal.' },
    { name: 'Contrat friterie', price: 1600, mult: 1.5, desc: 'La friterie du village paie 50 % de plus.' },
    { name: 'Contrat national', price: 6500, mult: 2.5, desc: 'Tes patates partent dans tout le pays. ×2,5.' },
  ] },
];
export const itemById = Object.fromEntries(ITEMS.map(i => [i.id, i]));

export const LINES = {
  greet: ['Ah ! Le récolteur ! Entre, entre.', 'Bonjour bonjour ! Tu viens dépenser tes sous ?', 'Regarde-moi ce bocal… On n’a jamais vu ça dans le canton.', 'Fais attention, la boutique est fragile. Comme moi.'],
  buy: ['Excellent choix. Vraiment. Je dis pas ça à tout le monde.', 'Tu ne le regretteras pas. Probablement.', 'Ah, ça, c’est du matériel sérieux !', 'Vendu ! Fais-en bon usage.', 'Ma femme disait toujours : un bon outil, c’est la moitié du travail.'],
  poor: ['Il te manque des sous, mon grand. Va ramasser !', 'Hé non. Pas de crédit à la boutique.', 'Reviens avec plus de patates dans le bocal.'],
  max: ['Tu as déjà le meilleur, je ne peux rien faire de plus !'],
  overflow: ['IL DÉBORDE ! Le bocal déborde ! C’est magnifique !', 'Les patates tombent partout ! Continue, continue !'],
  milestone: n => `${n.toLocaleString('fr-FR')} patates ! Je vais devoir agrandir le panneau.`,
  gold: ['Une patate DORÉE ?! Ça vaut une fortune, ça !'],
  idle: ['Il fait beau pour ramasser, hein ?', 'Le convoyeur a 40 ans, sois gentil avec lui.', 'Tu sais combien de patates il faut pour remplir ce bocal ? Moi non plus.', 'N’oublie pas : le seau, c’est la vie.'],
};
const pick = a => a[Math.floor(Math.random() * a.length)];
export { pick };

export class Shop {
  constructor(scene, M) {
    this.scene = scene; this.M = M; this.colliders = [];
    this.group = new THREE.Group(); this.group.position.set(SHOP.x, 0, SHOP.z); scene.add(this.group);
    this.displays = {};
    this._stall();
    this.npc = new Gerard(M);
    this.npc.root.position.set(0, 0.0, 0.85); this.npc.root.rotation.y = Math.PI; // faces the field (-z)
    this.group.add(this.npc.root);
    this.talkPoint = new THREE.Vector3(SHOP.x, 1.5, SHOP.z - 1.2);
  }
  _stall() {
    const M = this.M, B = new Batcher(), g = new THREE.Group();
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    // floor deck
    add(boxGeo(5.2, 0.14, 3.4, 2.4), M.wood, 0, 0.07, 0.6);
    // counter (front) with planks + top
    add(boxGeo(4.2, 1.0, 0.6, 1.3), M.crate, 0, 0.57, -0.2);
    add(boxGeo(4.5, 0.07, 0.8, 2.4), M.woodDark, 0, 1.1, -0.2);
    // posts + beams
    for (const [x, z, h] of [[-2.45, -0.9, 3.0], [2.45, -0.9, 3.0], [-2.45, 2.2, 3.3], [2.45, 2.2, 3.3]]) add(boxGeo(0.16, h, 0.16, 1), M.woodDark, x, h / 2, z);
    add(boxGeo(5.1, 0.16, 0.16, 2), M.woodDark, 0, 3.0, -0.9); add(boxGeo(5.1, 0.16, 0.16, 2), M.woodDark, 0, 3.3, 2.2);
    // back wall
    add(boxGeo(5.0, 3.2, 0.1, 2.4), M.wood, 0, 1.6, 2.28);
    // shelves on the back wall
    for (const y of [0.95, 1.7, 2.4]) { add(boxGeo(4.4, 0.05, 0.42, 1.3), M.woodDark, 0, y, 2.02); for (const x of [-2.0, 0, 2.0]) add(boxGeo(0.04, 0.12, 0.38, 1), M.metal, x, y - 0.07, 2.02); }
    B.addTree(g, { cast: true }); B.build(this.group);
    // striped awning (a curved canvas)
    const stripes = canvasTex(textCanvas(512, 64, (x, w, h) => { for (let k = 0; k < 10; k++) { x.fillStyle = k % 2 ? '#f3ead6' : '#b8322a'; x.fillRect(k * w / 10, 0, w / 10, h); } }), true);
    const aw = new THREE.PlaneGeometry(5.6, 3.6, 24, 12); const p = aw.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, Math.sin((y / 3.6 + 0.5) * Math.PI) * 0.18); }
    aw.computeVertexNormals();
    const awm = new THREE.Mesh(aw, new THREE.MeshStandardMaterial({ map: stripes, side: THREE.DoubleSide, roughness: 0.85 }));
    awm.position.set(0, 3.3, 0.55); awm.rotation.x = -Math.PI / 2 - 0.12; awm.castShadow = true; this.group.add(awm);
    // scalloped valance
    const val = canvasTex(textCanvas(512, 64, (x, w, h) => { x.clearRect(0, 0, w, h); for (let k = 0; k < 10; k++) { x.fillStyle = k % 2 ? '#f3ead6' : '#b8322a'; x.beginPath(); x.moveTo(k * w / 10, 0); x.lineTo((k + 1) * w / 10, 0); x.lineTo((k + 1) * w / 10, h * 0.5); x.arc((k + 0.5) * w / 10, h * 0.5, w / 20, 0, Math.PI); x.fill(); } }), true);
    const vm = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.45), new THREE.MeshStandardMaterial({ map: val, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    vm.position.set(0, 2.88, -1.25); vm.castShadow = true; this.group.add(vm); this.valance = vm;
    // hanging sign
    const sign = canvasTex(textCanvas(768, 256, (x, w, h) => {
      x.fillStyle = '#2c1a0e'; x.fillRect(0, 0, w, h); x.fillStyle = '#4a2c16'; x.fillRect(10, 10, w - 20, h - 20);
      x.fillStyle = '#f6d78a'; x.textAlign = 'center'; x.font = '900 86px Georgia'; x.fillText('CHEZ GÉRARD', w / 2, 112);
      x.font = 'italic 700 40px Georgia'; x.fillStyle = '#f3ead6'; x.fillText('Outils · Améliorations · Conseils', w / 2, 180);
      x.font = '28px Georgia'; x.fillText('— depuis 1987 —', w / 2, 225);
    }), true);
    const sg = new THREE.Group(); sg.position.set(0, 3.95, -0.95); this.group.add(sg); this.sign = sg;
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.86), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.6 })); sm.position.y = -0.1; sm.rotation.y = Math.PI; sg.add(sm);
    const sb = new THREE.Mesh(boxGeo(2.7, 0.95, 0.06, 1), M.woodDark); sb.position.set(0, -0.1, 0.035); sb.castShadow = true; sg.add(sb);
    for (const x of [-1.1, 1.1]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4), M.metal); ch.position.set(x, 0.55, 0); sg.add(ch); }
    // chalkboard price list (redrawn when prices change)
    this.chalkCanvas = textCanvas(512, 640, () => {}); this.chalkTex = canvasTex(this.chalkCanvas, true);
    const cb = new THREE.Group(); cb.position.set(3.1, 0, -1.2); cb.rotation.y = -0.4; this.group.add(cb);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.25), new THREE.MeshStandardMaterial({ map: this.chalkTex, roughness: 0.95 })); board.position.set(0, 1.15, -0.03); board.rotation.set(-0.18, Math.PI, 0); cb.add(board);
    for (const [x, rz] of [[-0.45, 0.18], [0.45, -0.18]]) { const leg = new THREE.Mesh(boxGeo(0.05, 1.9, 0.05, 1), M.woodDark); leg.position.set(x, 0.95, 0.12); leg.rotation.set(-0.18, 0, rz * 0.2); cb.add(leg); }
    // bell on the counter
    const bell = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.08], [0.03, 0.075], [0.06, 0.03], [0.065, 0]].map(p => new THREE.Vector2(...p)), 20), M.brass); bell.position.set(-1.3, 1.135, -0.35); this.group.add(bell); this.bell = bell;
    // cash box & a crate of golden potatoes for show
    const cash = new THREE.Mesh(boxGeo(0.4, 0.18, 0.3, 1), M.paintGreen); cash.position.set(1.3, 1.22, -0.15); cash.castShadow = true; this.group.add(cash);
    this.colliders.push({ min: new THREE.Vector3(SHOP.x - 2.6, 0, SHOP.z - 0.6), max: new THREE.Vector3(SHOP.x + 2.6, 2, SHOP.z + 2.4) }, { x: SHOP.x + 3.1, z: SHOP.z - 1.2, r: 0.45 });
    this._displays();
  }
  // Display models of every upgrade on the shelves (bought ones get a "VENDU" tag... no: they glow)
  _displays() {
    const M = this.M, r = rng(4);
    const place = (id, obj, x, y) => { obj.position.set(x, y, 2.0); obj.rotation.y = Math.PI + (r() - 0.5) * 0.3; this.group.add(obj); this.displays[id] = obj; };
    place('bucket', makeBucket(M, 1), -1.5, 0.98);
    const glove = new THREE.Group(); for (const s of [-1, 1]) { const gl = makeGlove(M); gl.position.x = s * 0.09; gl.rotation.z = s * 0.3; glove.add(gl); } place('gloves', glove, -0.4, 1.73);
    const rake = new THREE.Group(); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 8), M.wood); h.rotation.z = 1.2; h.position.y = 0.2; rake.add(h); const hd = new THREE.Mesh(boxGeo(0.06, 0.05, 0.45, 1), M.paintRed); hd.position.set(0.5, 0.0, 0); rake.add(hd); place('magnet', rake, 1.2, 1.73);
    const boots = new THREE.Group(); for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.065, 0.2], [0.06, 0.28], [0, 0.28]].map(p => new THREE.Vector2(...p)), 14), M.leather); b.position.x = s * 0.08; boots.add(b); const t = new THREE.Mesh(boxGeo(0.1, 0.08, 0.18, 1), M.leather); t.position.set(s * 0.08, 0.04, 0.08); boots.add(t); } place('boots', boots, 1.6, 0.98);
    const motor = new THREE.Group(); const mb = new THREE.Mesh(boxGeo(0.4, 0.3, 0.3, 1), M.paintYellow); mb.position.y = 0.15; motor.add(mb); for (let k = 0; k < 5; k++) { const fin = new THREE.Mesh(boxGeo(0.42, 0.02, 0.32, 1), M.metal); fin.position.y = 0.04 + k * 0.06; motor.add(fin); } place('motor', motor, 0.2, 0.98);
    const sack = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.15, 0.01], [0.18, 0.12], [0.16, 0.3], [0.06, 0.38], [0, 0.4]].map(p => new THREE.Vector2(...p)), 12), new THREE.MeshStandardMaterial({ map: M.canvas.map, color: 0x8fbf5a })); place('fertilizer', sack, -1.6, 2.43);
    const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 10), new THREE.MeshStandardMaterial({ color: 0xf1e3bd })); scroll.rotation.z = Math.PI / 2; const sc = new THREE.Group(); sc.add(scroll); scroll.position.y = 0.05; place('contract', sc, 0.4, 2.43);
    this.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }
  drawChalk(levels) {
    const x = this.chalkCanvas.getContext('2d'), w = 512, h = 640;
    x.fillStyle = '#1d2a22'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#6b4a2a'; x.lineWidth = 26; x.strokeRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,0.05)'; for (let k = 0; k < 40; k++) x.fillRect(Math.random() * w, Math.random() * h, 80, 2);
    x.fillStyle = '#f1f1e8'; x.font = '700 46px "Comic Sans MS", "Segoe Print", cursive'; x.textAlign = 'center'; x.fillText('Tarifs du jour', w / 2, 70);
    x.font = '28px "Comic Sans MS", "Segoe Print", cursive'; x.textAlign = 'left';
    let y = 130;
    for (const it of ITEMS) {
      const lv = levels[it.id] || 0, next = it.levels[lv + 1];
      x.fillStyle = '#f1f1e8'; x.fillText(`${it.name}`, 34, y);
      x.textAlign = 'right'; x.fillStyle = next ? '#f6d78a' : '#8fd18f'; x.fillText(next ? `${next.price} ₣` : 'MAX', w - 34, y); x.textAlign = 'left';
      y += 64;
    }
    x.strokeStyle = '#f1f1e8'; x.lineWidth = 3; x.beginPath(); x.moveTo(40, y - 30); x.lineTo(w - 40, y - 30); x.stroke();
    x.fillStyle = '#f1f1e8'; x.font = 'italic 26px "Comic Sans MS", cursive'; x.fillText('Pas de crédit. — G.', 40, y + 10);
    this.chalkTex.needsUpdate = true;
  }
  update(dt, playerPos, talkAmp, t) {
    this.npc.update(dt, playerPos, talkAmp);
    this.sign.rotation.x = Math.sin(t * 1.3) * 0.025; this.sign.rotation.z = Math.sin(t * 0.9) * 0.015;
    this.valance.rotation.x = Math.sin(t * 1.7) * 0.04;
    for (const id in this.displays) this.displays[id].position.y += Math.sin(t * 2 + id.length) * 0.0;
  }
}

// ---------- shared tool models (used by the shop shelves AND the first-person view) ----------
export function makeBucket(M, tier = 1) {
  const g = new THREE.Group();
  const s = [1, 1, 1.25, 1.6, 2.0][tier] || 1;
  const metal = tier === 4 ? M.paintYellow : tier === 3 ? M.paintBlue : M.metal;
  const r0 = 0.11 * s, r1 = 0.15 * s, h = 0.26 * s * (tier === 3 ? 0.6 : 1);
  const pts = [[0, 0.004], [r0, 0], [r0 + 0.006, 0.01], [r1, h], [r1 + 0.008, h + 0.006], [r1 + 0.004, h + 0.014], [r1 - 0.004, h + 0.008], [r0 - 0.005, 0.016], [0, 0.016]];
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(...p)), 28), metal); body.castShadow = true; g.add(body);
  for (const y of [0.3, 0.65]) { const rib = new THREE.Mesh(new THREE.TorusGeometry(r0 + (r1 - r0) * y + 0.003, 0.004, 4, 28).rotateX(Math.PI / 2), metal); rib.position.y = h * y; g.add(rib); }
  if (tier !== 3) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(r1, 0.006 * s, 6, 24, Math.PI), M.metal); handle.position.y = h; g.add(handle); g.userData.handle = handle;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * s, 0.014 * s, 0.09 * s, 10), M.woodDark); grip.rotation.z = Math.PI / 2; grip.position.y = h + r1; g.add(grip);
  } else {
    for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.TorusGeometry(0.04 * s, 0.008, 6, 12, Math.PI), M.metal); ear.position.set(sx * (r1 + 0.01), h * 0.85, 0); ear.rotation.y = Math.PI / 2; g.add(ear); }
  }
  g.userData.inner = { r0, r1, h };
  return g;
}
export function makeGlove(M) {
  const g = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color: 0xc8a24a, roughness: 0.9 });
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.03), mat); g.add(palm);
  for (let f = 0; f < 4; f++) { const fi = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.045, 3, 6), mat); fi.position.set(-0.027 + f * 0.018, 0.08, 0); g.add(fi); }
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.035, 3, 6), mat); th.position.set(0.05, 0.02, 0); th.rotation.z = -0.7; g.add(th);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0x8a5a2a })); cuff.scale.z = 0.5; cuff.position.y = -0.075; g.add(cuff);
  return g;
}
