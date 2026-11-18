/* =====================================================================
   Roblox Forge · Jouer — blocky R15-style avatar + procedural animator.
   15 parts on real joints (hips, knees, ankles, shoulders, elbows, wrists,
   waist, neck), driven like Roblox's Animate script: idle (breathing, arm
   sway, head look), walk → run blend by speed, jump, fall, climb, land
   squash, tool hold + swing, emote wave/dance. Every joint is spring-damped
   so motions overshoot and settle instead of snapping. Death breaks the
   joints and the parts tumble with real gravity and bounces.
   ===================================================================== */
import * as THREE from 'three';
import { voxelAnimal, VOX_SPECIES } from '../studio/voxel.js';

/* rounded box (Roblox parts have slightly soft edges on avatars) */
function roundedBox(w, h, d, r = 0.08, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2), p = g.attributes.position, v = new THREE.Vector3(), hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const c = new THREE.Vector3(Math.max(-hw, Math.min(hw, v.x)), Math.max(-hh, Math.min(hh, v.y)), Math.max(-hd, Math.min(hd, v.z)));
    const dv = v.clone().sub(c); if (dv.lengthSq() > 0) { dv.normalize().multiplyScalar(r); v.copy(c).add(dv); } p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
/* classic head: a rounded cylinder (lathe profile) */
function headGeo() { const pts = []; const R = 0.62, H = 0.6, r = 0.2;
  pts.push(new THREE.Vector2(0, -H)); for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(R - r + Math.cos(a) * r, -H + r + Math.sin(a) * r)); }
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(R - r + Math.cos(a) * r, H - r + Math.sin(a) * r)); } pts.push(new THREE.Vector2(0, H));
  const g = new THREE.LatheGeometry(pts, 40); g.computeVertexNormals(); return g; }
/* faces drawn on a canvas, mapped on the front of the head */
export const FACES = {
  sourire: (g) => { eyes(g); g.lineWidth = 16; g.lineCap = 'round'; g.beginPath(); g.arc(256, 250, 80, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); },
  content: (g) => { g.lineWidth = 16; g.lineCap = 'round'; for (const x of [196, 316]) { g.beginPath(); g.arc(x, 220, 26, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } g.beginPath(); g.arc(256, 250, 90, 0.15 * Math.PI, 0.85 * Math.PI); g.fillStyle = '#1b1b1b'; g.fill(); },
  cool: (g) => { g.fillStyle = '#111'; g.beginPath(); g.roundRect(140, 175, 232, 70, 26); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(170, 190, 50, 10); g.lineWidth = 14; g.lineCap = 'round'; g.beginPath(); g.moveTo(215, 315); g.quadraticCurveTo(270, 335, 310, 300); g.stroke(); },
  surpris: (g) => { eyes(g, 34); g.beginPath(); g.ellipse(256, 320, 30, 40, 0, 0, 7); g.fillStyle = '#1b1b1b'; g.fill(); },
  malin: (g) => { g.lineWidth = 16; g.lineCap = 'round'; eyes(g); g.beginPath(); g.moveTo(170, 175); g.lineTo(225, 195); g.moveTo(342, 175); g.lineTo(287, 195); g.stroke(); g.beginPath(); g.moveTo(190, 300); g.quadraticCurveTo(270, 350, 330, 280); g.stroke(); },
};
function eyes(g, r = 22) { g.fillStyle = '#1b1b1b'; for (const x of [200, 312]) { g.beginPath(); g.ellipse(x, 215, r * 0.75, r, 0, 0, 7); g.fill(); } g.fillStyle = '#fff'; for (const x of [206, 318]) { g.beginPath(); g.arc(x, 205, r * 0.28, 0, 7); g.fill(); } g.strokeStyle = '#1b1b1b'; }
function faceTex(kind) { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.strokeStyle = '#1b1b1b'; g.fillStyle = '#1b1b1b'; (FACES[kind] || FACES.sourire)(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

export const DEFAULT_LOOK = { name: 'Joueur', skin: '#f5cd9a', shirt: '#2f7de1', pants: '#3a3f4b', shoes: '#22252b', face: 'sourire', hat: 'casquette', hatColor: '#e8423f', hair: '#3b2416' };
export const HATS = { aucun: 'Aucun', casquette: 'Casquette', couronne: 'Couronne', cheveux: 'Cheveux', cornes: 'Cornes', chapeau: 'Haut-de-forme', auréole: 'Auréole' };

const spring = (cur, vel, target, k, d, dt) => { const a = (target - cur) * k - vel * d; vel += a * dt; cur += vel * dt; return [cur, vel]; };

export class Avatar {
  constructor(look = DEFAULT_LOOK) {
    this.look = { ...DEFAULT_LOOK, ...look }; this.root = new THREE.Group(); this.joints = {}; this.parts = []; this.t = Math.random() * 10;
    this.state = { speed: 0, grounded: true, vy: 0, climbing: false, tool: false, swing: 0, land: 0, emote: null, emoteT: 0 }; this.js = {};
    this.build();
  }
  mat(c, rough = 0.62) { return new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.02 }); }
  build() {
    const L = this.look, R = this.root, J = this.joints;
    const part = (parent, name, geo, color, pos, joint) => { const m = new THREE.Mesh(geo, this.mat(color)); m.castShadow = true; m.receiveShadow = true; m.name = name; m.position.set(...pos); this.parts.push(m);
      if (joint) { const j = new THREE.Group(); j.position.set(...joint); parent.add(j); j.add(m); J[name] = j; return j; } parent.add(m); return m; };
    // HumanoidRootPart pivot at hip height: everything hangs from the LowerTorso
    const hip = new THREE.Group(); hip.position.y = 2.05; R.add(hip); J.Hip = hip;
    const lowerT = part(hip, 'LowerTorso', roundedBox(2, 0.42, 1, 0.08), L.pants, [0, 0, 0], [0, 0.18, 0]);
    const upperT = part(J.LowerTorso, 'UpperTorso', roundedBox(2, 1.58, 1, 0.1), L.shirt, [0, 0.79, 0], [0, 0.2, 0]);
    // neck + head
    const neck = part(J.UpperTorso, 'Head', headGeo(), L.skin, [0, 0.62, 0], [0, 1.58, 0]);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.625, 0.625, 1.05, 32, 1, true, Math.PI - 0.95, 1.9), new THREE.MeshStandardMaterial({ map: faceTex(L.face), transparent: true, roughness: 0.7, depthWrite: false }));
    face.position.y = 0.62; face.rotation.y = 0; J.Head.add(face); this.face = face;
    this.addHat();
    // arms (shoulder → elbow → wrist)
    for (const s of [-1, 1]) { const side = s < 0 ? 'Left' : 'Right';
      part(J.UpperTorso, side + 'UpperArm', roundedBox(0.95, 1.05, 0.95, 0.12), L.shirt, [0, -0.42, 0], [s * 1.48, 1.38, 0]);
      part(J[side + 'UpperArm'], side + 'LowerArm', roundedBox(0.9, 0.78, 0.9, 0.12), L.skin, [0, -0.36, 0], [0, -0.88, 0]);
      part(J[side + 'LowerArm'], side + 'Hand', roundedBox(0.9, 0.36, 0.9, 0.14), L.skin, [0, -0.16, 0], [0, -0.72, 0]);
      part(hip, side + 'UpperLeg', roundedBox(0.97, 0.95, 0.97, 0.1), L.pants, [0, -0.45, 0], [s * 0.5, 0, 0]);
      part(J[side + 'UpperLeg'], side + 'LowerLeg', roundedBox(0.95, 0.82, 0.95, 0.1), L.pants, [0, -0.4, 0], [0, -0.9, 0]);
      part(J[side + 'LowerLeg'], side + 'Foot', roundedBox(0.97, 0.3, 1.02, 0.1), L.shoes, [0, -0.13, -0.02], [0, -0.8, 0]); }
    void lowerT; void upperT; void neck;
    for (const k of Object.keys(J)) this.js[k] = { x: 0, vx: 0, y: 0, vy: 0, z: 0, vz: 0 };
  }
  addHat() {
    const L = this.look, H = this.joints.Head; if (this.hat) H.remove(this.hat); const g = new THREE.Group(); this.hat = g; H.add(g); const M = (c, r = 0.5, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
    const add = (geo, mat, p, r) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); if (r) m.rotation.set(...r); m.castShadow = true; g.add(m); return m; };
    switch (L.hat) {
      case 'casquette': add(new THREE.SphereGeometry(0.68, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M(L.hatColor), [0, 1.05, 0]); add(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 32, 1, false, Math.PI * 0.75, Math.PI * 0.5), M(L.hatColor), [0, 1.08, -0.38]); add(new THREE.SphereGeometry(0.08, 12, 8), M('#ffffff'), [0, 1.73, 0]); break;
      case 'couronne': { const mat = M('#ffcc33', 0.25, { metalness: 0.9, emissive: '#5a3a00', emissiveIntensity: 0.3 }); add(new THREE.CylinderGeometry(0.58, 0.6, 0.32, 32, 1, true), mat, [0, 1.38, 0]); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; add(new THREE.ConeGeometry(0.11, 0.32, 4), mat, [Math.sin(a) * 0.58, 1.68, Math.cos(a) * 0.58]); add(new THREE.SphereGeometry(0.06, 8, 6), M(['#ff3355', '#3388ff', '#33dd88'][i % 3], 0.1, { emissive: ['#ff3355', '#3388ff', '#33dd88'][i % 3], emissiveIntensity: 0.6 }), [Math.sin(a) * 0.6, 1.4, Math.cos(a) * 0.6]); } break; }
      case 'cheveux': { const mat = M(L.hair, 0.8); add(roundedBox(1.36, 0.42, 1.34, 0.18), mat, [0, 1.12, 0.03]); add(roundedBox(1.36, 0.8, 0.3, 0.12), mat, [0, 0.82, 0.55]); for (let i = 0; i < 5; i++) add(roundedBox(0.3, 0.3, 0.32, 0.1), mat, [-0.5 + i * 0.25, 0.95, -0.58], [0.3, 0, 0]); break; }
      case 'cornes': for (const s of [-1, 1]) add(new THREE.ConeGeometry(0.16, 0.7, 12), M('#f2ead7', 0.45), [s * 0.42, 1.38, -0.05], [0, 0, -s * 0.45]); break;
      case 'chapeau': add(new THREE.CylinderGeometry(0.95, 0.95, 0.07, 36), M('#1c1c22', 0.4), [0, 1.2, 0]); add(new THREE.CylinderGeometry(0.58, 0.6, 0.95, 36), M('#1c1c22', 0.4), [0, 1.7, 0]); add(new THREE.CylinderGeometry(0.61, 0.61, 0.15, 36), M(L.hatColor), [0, 1.32, 0]); break;
      case 'auréole': { const m = add(new THREE.TorusGeometry(0.5, 0.06, 12, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2, 1.1) }), [0, 1.6, 0], [Math.PI / 2, 0, 0]); m.castShadow = false; this.halo = m; break; }
      default: break;
    }
  }
  setLook(look) { const old = this.root; const parent = old.parent; const pos = old.position.clone(), rot = old.rotation.y; this.dispose(); this.look = { ...DEFAULT_LOOK, ...look }; this.root = new THREE.Group(); this.joints = {}; this.parts = []; this.build(); this.root.position.copy(pos); this.root.rotation.y = rot; if (parent) { parent.remove(old); parent.add(this.root); } if (this.toolMesh) this.holdTool(this.toolSpec); }
  dispose() { this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { m.map && m.map.dispose(); m.dispose(); }); }); }
  /** a tool held in the right hand (Roblox Tool: Handle + grip) */
  holdTool(spec) {
    this.toolSpec = spec; const hand = this.joints.RightHand; if (this.toolMesh) { this.toolMesh.parent && this.toolMesh.parent.remove(this.toolMesh); this.toolMesh = null; } if (!spec) return;
    const g = new THREE.Group(), metal = new THREE.MeshStandardMaterial({ color: spec.color || '#9aa3b2', roughness: 0.25, metalness: 0.85 }), dark = new THREE.MeshStandardMaterial({ color: '#2b2b33', roughness: 0.5, metalness: 0.4 });
    if (spec.kind === 'sword') { const blade = new THREE.Mesh(roundedBox(0.16, 3.2, 0.5, 0.05), metal); blade.position.set(0, -1.95, 0); g.add(blade);
      const guard = new THREE.Mesh(roundedBox(1.3, 0.25, 0.3, 0.06), new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.9, roughness: 0.3 })); guard.position.set(0, -0.35, 0); g.add(guard);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.8, 12), dark); grip.position.y = 0.1; g.add(grip); }
    else { // dumbbell-like training tool (bars + plates), recoloured per game
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.9, 12), metal); bar.rotation.z = Math.PI / 2; g.add(bar);
      for (const s of [-1, 1]) for (const k of [0, 1]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.5 - k * 0.12, 0.5 - k * 0.12, 0.22, 24), new THREE.MeshStandardMaterial({ color: spec.color || '#3a3a46', roughness: 0.4, metalness: 0.5 })); pl.rotation.z = Math.PI / 2; pl.position.x = s * (0.72 + k * 0.22); g.add(pl); } }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); g.position.set(0, -0.25, -0.05); hand.add(g); this.toolMesh = g;
  }
  swing() { this.state.swing = 1; }
  emote(name) { this.state.emote = name; this.state.emoteT = 0; }
  /** drive the joints from the movement state (speed in studs/s, grounded, vertical speed) */
  update(dt) {
    this.t += dt; const S = this.state, t = this.t, J = this.joints, js = this.js;
    const run = Math.min(1, S.speed / 16), moving = S.speed > 0.6 && S.grounded;
    if (S.speed > 0.6 || !S.grounded) S.emote = null;
    S.swing = Math.max(0, S.swing - dt * 3.2); S.land = Math.max(0, S.land - dt * 4);
    const freq = 4.5 + run * 4.2, ph = t * freq, amp = moving ? 0.35 + run * 0.55 : 0;
    const T = {}; // targets: [x, y, z] euler
    const set = (k, x = 0, y = 0, z = 0) => (T[k] = [x, y, z]);
    // idle base
    const breath = Math.sin(t * 1.8);
    set('Hip', 0, 0, 0); set('LowerTorso'); set('UpperTorso', 0.02 * breath, 0, 0); set('Head', Math.sin(t * 0.5) * 0.06, Math.sin(t * 0.37) * 0.18, 0);
    for (const s of [-1, 1]) { const side = s < 0 ? 'Left' : 'Right'; set(side + 'UpperArm', 0.03 * breath, 0, s * (0.06 + 0.02 * breath)); set(side + 'LowerArm', -0.08); set(side + 'Hand'); set(side + 'UpperLeg'); set(side + 'LowerLeg'); set(side + 'Foot'); }
    let hipY = 2.05 + 0.02 * breath;
    if (moving) { // walk / run cycle: legs swing, knees fold on the back swing, arms counter-swing, torso twists and leans
      const sL = Math.sin(ph), sR = Math.sin(ph + Math.PI);
      set('LeftUpperLeg', sL * amp * 1.05, 0, 0); set('RightUpperLeg', sR * amp * 1.05, 0, 0);
      set('LeftLowerLeg', -Math.max(0, -Math.cos(ph)) * amp * 1.4 - 0.05, 0, 0); set('RightLowerLeg', -Math.max(0, Math.cos(ph)) * amp * 1.4 - 0.05, 0, 0);
      set('LeftFoot', Math.max(0, sL) * 0.25 * amp); set('RightFoot', Math.max(0, sR) * 0.25 * amp);
      set('LeftUpperArm', sR * amp * 0.95, 0, -0.08); set('RightUpperArm', sL * amp * 0.95, 0, 0.08); set('LeftLowerArm', -0.2 - run * 0.7); set('RightLowerArm', -0.2 - run * 0.7);
      set('UpperTorso', -0.05 - run * 0.12, Math.sin(ph) * 0.12 * amp, 0); set('LowerTorso', 0, -Math.sin(ph) * 0.08 * amp, 0); set('Head', 0.05 + run * 0.08, -Math.sin(ph) * 0.05, 0);
      hipY = 2.05 - 0.06 * run + Math.abs(Math.cos(ph)) * 0.12 * amp;
    }
    if (!S.grounded && !S.climbing) { // jump: arms up; fall: arms flail up and out, legs dangle
      const up = S.vy > 0; const fl = Math.sin(t * 14) * (up ? 0 : 0.12);
      set('LeftUpperArm', -2.7 + fl, 0, -0.35); set('RightUpperArm', -2.7 - fl, 0, 0.35); set('LeftLowerArm', -0.25); set('RightLowerArm', -0.25);
      set('LeftUpperLeg', up ? 0.35 : -0.12, 0, -0.05); set('RightUpperLeg', up ? -0.25 : 0.18, 0, 0.05); set('LeftLowerLeg', up ? -0.7 : -0.25); set('RightLowerLeg', up ? -0.35 : -0.4);
      set('UpperTorso', up ? -0.08 : 0.06); set('Head', up ? -0.1 : 0.12);
    }
    if (S.climbing) { const c = Math.sin(t * 9); set('LeftUpperArm', -2.6 + c * 0.5, 0, -0.15); set('RightUpperArm', -2.6 - c * 0.5, 0, 0.15); set('LeftUpperLeg', -0.6 - c * 0.4); set('RightUpperLeg', -0.6 + c * 0.4); set('LeftLowerLeg', -0.9); set('RightLowerLeg', -0.9); }
    if (S.land > 0) { hipY -= S.land * 0.35; T.LeftUpperLeg[0] -= S.land * 0.6; T.RightUpperLeg[0] -= S.land * 0.6; T.LeftLowerLeg[0] -= S.land * 1.0; T.RightLowerLeg[0] -= S.land * 1.0; T.UpperTorso[0] -= S.land * 0.25; }
    if (S.tool) { // tool held forward like Roblox's toolnone; swing: wind-up then slash down
      const w = S.swing, slash = w > 0.6 ? -(1 - w) * 2.5 * 2.2 : w > 0 ? -1.4 + (0.6 - w) * 2.3 : 0;
      set('RightUpperArm', -1.57 + (w > 0 ? (w > 0.6 ? -(1 - w) * 5.5 : -2.2 + (0.6 - w) * 3.7) : 0), 0, 0.05); set('RightLowerArm', w > 0 ? -0.2 : -0.05); set('RightHand', 0);
      if (w > 0) T.UpperTorso[1] = (w > 0.6 ? 0.25 : -0.3) * Math.sin(w * Math.PI); void slash;
    }
    if (S.emote === 'wave') { S.emoteT += dt; set('RightUpperArm', -2.6, 0, 0.5 + Math.sin(S.emoteT * 9) * 0.35); set('RightLowerArm', -0.5 + Math.sin(S.emoteT * 9) * 0.3); set('Head', 0, 0.2, 0.12); if (S.emoteT > 2.6) S.emote = null; }
    if (S.emote === 'dance') { S.emoteT += dt; const b = Math.sin(S.emoteT * 8); set('LeftUpperArm', -1.2 + b * 0.8, 0, -0.6); set('RightUpperArm', -1.2 - b * 0.8, 0, 0.6); set('LeftLowerArm', -1.2); set('RightLowerArm', -1.2); set('UpperTorso', 0, b * 0.35, b * 0.1); set('Head', 0, -b * 0.3, -b * 0.12); set('LeftUpperLeg', Math.max(0, b) * 0.6); set('LeftLowerLeg', -Math.max(0, b) * 1.1); set('RightUpperLeg', Math.max(0, -b) * 0.6); set('RightLowerLeg', -Math.max(0, -b) * 1.1); hipY -= Math.abs(b) * 0.15; }
    if (S.emote === 'cheer') { S.emoteT += dt; const b = Math.abs(Math.sin(S.emoteT * 6)); set('LeftUpperArm', -2.9 + b * 0.3, 0, -0.45); set('RightUpperArm', -2.9 + b * 0.3, 0, 0.45); set('LeftLowerArm', -0.2); set('RightLowerArm', -0.2); set('Head', -0.25); hipY += b * 0.35; if (S.emoteT > 2.5) S.emote = null; }
    if (S.emote === 'laugh') { S.emoteT += dt; const b = Math.sin(S.emoteT * 22); set('UpperTorso', 0.25 + b * 0.06, 0, 0); set('Head', -0.35 + b * 0.12); set('LeftUpperArm', -0.4, 0, -0.5); set('RightUpperArm', -0.4, 0, 0.5); set('LeftLowerArm', -1.6); set('RightLowerArm', -1.6); if (S.emoteT > 2.4) S.emote = null; }
    if (S.emote === 'shrug') { S.emoteT += dt; const u = Math.min(1, S.emoteT * 4) * (S.emoteT > 1.4 ? Math.max(0, 1 - (S.emoteT - 1.4) * 4) : 1); set('LeftUpperArm', -0.3 * u, 0, -0.9 * u); set('RightUpperArm', -0.3 * u, 0, 0.9 * u); set('LeftLowerArm', -1.4 * u); set('RightLowerArm', -1.4 * u); set('Head', 0, 0, 0.25 * u); hipY += 0.12 * u; if (S.emoteT > 1.7) S.emote = null; }
    if (S.emote === 'sit') { S.emoteT += dt; set('LeftUpperLeg', -1.57); set('RightUpperLeg', -1.57); set('LeftLowerLeg', 1.4); set('RightLowerLeg', 1.4); set('LeftUpperArm', -0.3, 0, -0.1); set('RightUpperArm', -0.3, 0, 0.1); hipY = 1.05; }
    if (S.emote === 'dance2') { S.emoteT += dt; const b = Math.sin(S.emoteT * 9), c = Math.cos(S.emoteT * 4.5); set('LeftUpperArm', -2.6 * Math.max(0, b), 0, -0.3 - c * 0.3); set('RightUpperArm', -2.6 * Math.max(0, -b), 0, 0.3 + c * 0.3); set('UpperTorso', 0, c * 0.5, b * 0.15); set('LowerTorso', 0, -c * 0.3, 0); set('LeftUpperLeg', 0, 0, -0.25 * Math.max(0, c)); set('RightUpperLeg', 0, 0, 0.25 * Math.max(0, -c)); hipY -= Math.abs(b) * 0.2; }
    if (S.emote === 'point') { S.emoteT += dt; set('RightUpperArm', -1.6, 0.25, 0); set('Head', -0.05, -0.2, 0); if (S.emoteT > 2) S.emote = null; }
    // spring-damped joints: secondary motion, overshoot and settle
    const k = 260, d = 24, n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n; // stable sub-steps whatever the frame time
    for (let it = 0; it < n; it++) {
      for (const [name, tg] of Object.entries(T)) { const s = js[name]; if (!s) continue;
        [s.x, s.vx] = spring(s.x, s.vx, tg[0], k, d, h); [s.y, s.vy] = spring(s.y, s.vy, tg[1], k, d, h); [s.z, s.vz] = spring(s.z, s.vz, tg[2], k, d, h); }
      const H = js.Hip; [H.hy, H.hvy] = spring(H.hy ?? hipY, H.hvy || 0, hipY, 300, 26, h); }
    for (const name of Object.keys(T)) { const j = J[name], s = js[name]; if (j && s) j.rotation.set(s.x, s.y, s.z); }
    J.Hip.position.y = js.Hip.hy;
    if (this.halo) this.halo.position.y = 1.6 + Math.sin(t * 2) * 0.05;
  }
  /** joints break: every part becomes a free body that falls and bounces */
  breakApart(scene, impulse = new THREE.Vector3()) {
    this.root.updateMatrixWorld(true); const bodies = [];
    for (const m of this.parts) { const w = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.matrixWorld.decompose(w, q, s);
      const c = m.clone(); c.position.copy(w); c.quaternion.copy(q); scene.add(c);
      bodies.push({ m: c, v: new THREE.Vector3((Math.random() - 0.5) * 18, 8 + Math.random() * 14, (Math.random() - 0.5) * 18).add(impulse), w: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12) }); }
    if (this.hat) { const w = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); this.hat.matrixWorld.decompose(w, q, s); const c = this.hat.clone(); c.position.copy(w); c.quaternion.copy(q); scene.add(c); bodies.push({ m: c, v: new THREE.Vector3(0, 22, 0), w: new THREE.Vector3(3, 6, 2) }); }
    this.root.visible = false; return bodies;
  }
}

/* ---------- pets that follow the player (voxel engine of Pet Studio) ---------- */
const PET_SPECIES = { chat: 'chat', chien: 'chien', renard: 'renard', dragon: 'dragon', licorne: 'licorne', loup: 'loup', tigre: 'tigre', ours: 'ours', lion: 'lion', panda: 'panda', cerf: 'cerf', vache: 'vache', cochon: 'cochon', mouton: 'mouton' };
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function petSpecies(name) { const n = norm(name); for (const k of Object.keys(PET_SPECIES)) if (n.includes(k)) return PET_SPECIES[k]; const keys = Object.keys(VOX_SPECIES); let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0; return keys[h % keys.length]; }
const petCache = new Map();
export function petMesh(name, voxMat) {
  const sp = petSpecies(name);
  if (!petCache.has(sp)) {
    const parts = voxelAnimal(sp, { voxel: 0.09, scale: 0.9 }).parts; const geos = [];
    for (const p of parts) { const g = new THREE.BoxGeometry(...p.size); g.translate(...p.pos); const n = g.attributes.position.count, c = new THREE.Color(p.color), col = new Float32Array(n * 3), L = new Float32Array(n * 3), N = new Float32Array(n * 3), A = new Float32Array(n * 4), H = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col.set([c.r, c.g, c.b], i * 3); L.set([g.attributes.position.getX(i) - p.pos[0], g.attributes.position.getY(i) - p.pos[1], g.attributes.position.getZ(i) - p.pos[2]], i * 3); N.set([g.attributes.normal.getX(i), g.attributes.normal.getY(i), g.attributes.normal.getZ(i)], i * 3);
        for (let k = 0; k < 3; k++) { A[i * 4 + k] = Math.round((p.pos[k] - p.size[k] / 2) / (p.vox || 0.09)); H[i * 3 + k] = p.size[k] / 2; } A[i * 4 + 3] = p.vox || 0.09; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('voxL', new THREE.BufferAttribute(L, 3)); g.setAttribute('voxN', new THREE.BufferAttribute(N, 3)); g.setAttribute('voxA', new THREE.BufferAttribute(A, 4)); g.setAttribute('voxH', new THREE.BufferAttribute(H, 3)); geos.push(g); }
    petCache.set(sp, mergeGeos(geos));
  }
  const m = new THREE.Mesh(petCache.get(sp), voxMat); m.castShadow = true; const g = new THREE.Group(); g.add(m);
  const box = new THREE.Box3().setFromObject(m); m.position.y = -box.min.y; return g;
}
function mergeGeos(geos) { const names = ['position', 'normal', 'color', 'voxL', 'voxN', 'voxA', 'voxH']; let nv = 0, ni = 0; for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
  const out = new THREE.BufferGeometry(), idx = new Uint32Array(ni); let ov = 0, oi = 0; const arrs = names.map((n) => new Float32Array(nv * geos[0].attributes[n].itemSize));
  for (const g of geos) { names.forEach((n, i) => arrs[i].set(g.attributes[n].array, ov * g.attributes[n].itemSize)); for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + ov; ov += g.attributes.position.count; oi += g.index.count; }
  names.forEach((n, i) => out.setAttribute(n, new THREE.BufferAttribute(arrs[i], geos[0].attributes[n].itemSize))); out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere(); return out; }
