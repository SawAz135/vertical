import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp, easeInOutCubic } from '../core/util.js';

// =====================================================================================
// GÉRARD — procedural, fully articulated NPC (no external model).
// Layers of animation: breathing, weight shift, head + eye tracking of the player with
// saccades, blinking, eyebrow acting, jaw driven by the voice amplitude, and keyed
// gestures (wave, point, shrug, thumbs-up, count money) blended on top of the idle.
// =====================================================================================
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function lathe(pts, mat, seg = 20) { const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg), mat); m.castShadow = true; m.receiveShadow = true; return m; }
function capsule(r, len, mat, seg = 12) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, seg), mat); m.castShadow = true; return m; }
function joint(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

export class Gerard {
  constructor(M) {
    const skin = new THREE.MeshStandardMaterial({ map: M.skin.map, normalMap: M.skin.normalMap, color: 0xf0c4a8, roughness: 0.58 });
    skin.map = M.skin.map.clone(); skin.map.repeat.set(3, 3); skin.map.needsUpdate = true;
    const shirt = M.plaid, vest = M.canvas, jeans = M.denim, boot = M.leather;
    const capMat = new THREE.MeshStandardMaterial({ color: 0x24406a, roughness: 0.92 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x9a958c, roughness: 0.95 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.25 });
    const iris = new THREE.MeshStandardMaterial({ color: 0x4c6a7c, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 0.2 });
    const lip = new THREE.MeshStandardMaterial({ color: 0xb27466, roughness: 0.5 });
    const frame = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.3, metalness: 0.4 });
    const lens = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.02, metalness: 0.6 });

    const root = this.root = new THREE.Group();
    const hips = this.hips = joint(root, 0, 0.98, 0);
    // pelvis + belt
    hips.add(lathe([[0, -0.12], [0.17, -0.1], [0.19, 0.0], [0.18, 0.08], [0, 0.1]], jeans));
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.025, 6, 24).rotateX(Math.PI / 2), M.leather); belt.position.y = 0.06; belt.scale.z = 0.8; hips.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.045, 0.01), M.brass); buckle.position.set(0, 0.06, 0.15); hips.add(buckle);
    // torso: generous belly, plaid shirt, open canvas vest
    const spine = this.spine = joint(hips, 0, 0.08, 0);
    const torso = lathe([[0, 0], [0.19, 0.0], [0.23, 0.12], [0.235, 0.24], [0.21, 0.36], [0.2, 0.46], [0.16, 0.54], [0.07, 0.58], [0, 0.58]], shirt, 24);
    torso.scale.set(1, 1, 0.8); spine.add(torso); this.torso = torso;
    for (const sx of [-1, 1]) { // vest panels
      const panel = lathe([[0.0, 0], [0.205, 0.0], [0.245, 0.13], [0.245, 0.25], [0.215, 0.4], [0.2, 0.5], [0.17, 0.55]], vest, 12);
      panel.geometry = new THREE.LatheGeometry([[0.0, 0], [0.21, 0.0], [0.25, 0.13], [0.25, 0.25], [0.22, 0.4], [0.205, 0.5], [0.175, 0.555]].map(p => new THREE.Vector2(p[0], p[1])), 12, sx > 0 ? -0.15 : Math.PI + 0.15, Math.PI - 0.5);
      panel.scale.set(1, 1, 0.82); spine.add(panel);
    }
    // shirt buttons
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), white); b.position.set(0, 0.12 + k * 0.11, 0.192 - Math.abs(k - 1) * 0.005 + (k === 0 ? 0.0 : 0)); spine.add(b); }
    const chest = this.chest = joint(spine, 0, 0.5, 0);
    // neck + head
    const neck = this.neck = joint(chest, 0, 0.06, 0.01);
    const nk = capsule(0.062, 0.06, skin); nk.position.y = 0.04; neck.add(nk);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 6, 16).rotateX(Math.PI / 2), shirt); collar.position.y = 0.01; neck.add(collar);
    const head = this.head = joint(neck, 0, 0.12, 0);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 32, 24), skin); skull.scale.set(0.95, 1.12, 1.02); skull.position.y = 0.09; skull.castShadow = true; head.add(skull);
    // jaw/chin (moves) + jowls
    const jaw = this.jaw = joint(head, 0, 0.05, 0.02);
    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 16, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), skin); chin.scale.set(1.05, 0.9, 1.0); chin.position.set(0, 0.0, 0.0); jaw.add(chin);
    const lowLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.04, 4, 8).rotateZ(Math.PI / 2), lip); lowLip.position.set(0, 0.0, 0.085); jaw.add(lowLip);
    const mouthIn = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), dark); mouthIn.scale.set(1.3, 0.5, 0.5); mouthIn.position.set(0, 0.03, 0.07); head.add(mouthIn); this.mouthIn = mouthIn;
    const upLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.042, 4, 8).rotateZ(Math.PI / 2), lip); upLip.position.set(0, 0.04, 0.095); head.add(upLip);
    // nose (bulbous), ears, cheeks
    const nose = lathe([[0, 0], [0.018, 0.005], [0.024, 0.03], [0.02, 0.05], [0, 0.058]], skin, 12); nose.rotation.x = Math.PI / 2 - 0.25; nose.position.set(0, 0.1, 0.1); head.add(nose);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), skin); tip.position.set(0, 0.085, 0.147); head.add(tip);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), skin); ear.scale.set(0.45, 1.1, 0.8); ear.position.set(sx * 0.1, 0.1, -0.005); head.add(ear);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), skin); cheek.position.set(sx * 0.055, 0.065, 0.07); head.add(cheek);
    }
    // eyes with lids, iris, pupils
    this.eyes = []; this.lids = []; this.brows = [];
    for (const sx of [-1, 1]) {
      const eye = joint(head, sx * 0.038, 0.122, 0.078);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.019, 16, 12), white); eye.add(ball);
      const ir = new THREE.Mesh(new THREE.CircleGeometry(0.0095, 16), iris); ir.position.z = 0.0185; eye.add(ir);
      const pu = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 12), dark); pu.position.z = 0.0187; eye.add(pu);
      this.eyes.push(eye);
      const lidU = joint(head, sx * 0.038, 0.122, 0.078); const lidM = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), skin); lidU.add(lidM);
      this.lids.push(lidU);
      const brow = joint(head, sx * 0.04, 0.155, 0.093); const bm = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.036, 4, 6).rotateZ(Math.PI / 2), hair); bm.rotation.z = sx * -0.15; brow.add(bm); this.brows.push(brow);
    }
    // grey moustache + side hair
    const mous = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.07, 6, 10).rotateZ(Math.PI / 2), hair); mous.position.set(0, 0.058, 0.103); mous.scale.set(1, 0.9, 0.7); head.add(mous);
    for (const sx of [-1, 1]) { const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), hair); tuft.scale.set(0.5, 0.9, 1.0); tuft.position.set(sx * 0.095, 0.14, -0.03); head.add(tuft); }
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), hair); back.scale.set(1, 0.7, 0.6); back.position.set(0, 0.11, -0.06); head.add(back);
    // reading glasses (on the nose tip)
    const glasses = joint(head, 0, 0.115, 0.12);
    for (const sx of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0025, 6, 20), frame); rim.position.x = sx * 0.036; rim.scale.y = 0.78; glasses.add(rim);
      const ln = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), lens); ln.position.x = sx * 0.036; ln.scale.y = 0.78; glasses.add(ln);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.13), frame); arm.position.set(sx * 0.058, 0.004, -0.065); glasses.add(arm);
    }
    const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.002, 4, 8, Math.PI), frame); bridge.position.y = 0.004; glasses.add(bridge);
    // old baseball cap
    const cap = joint(head, 0, 0.17, -0.005); cap.rotation.x = -0.12;
    cap.add(lathe([[0, 0.08], [0.05, 0.075], [0.09, 0.05], [0.112, 0.0], [0.0, 0.0]], capMat, 24));
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.008, 24, 1, false, -0.9, 1.8), capMat); visor.position.set(0, 0.004, 0.05); visor.scale.set(1, 1, 1.2); cap.add(visor);
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 4), capMat); btn.position.y = 0.08; cap.add(btn);
    // arms
    this.arms = [];
    for (const sx of [-1, 1]) {
      const sh = joint(chest, sx * 0.23, -0.02, 0);
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), shirt); sh.add(shoulder);
      const ua = capsule(0.058, 0.2, shirt); ua.position.y = -0.14; sh.add(ua);
      const el = joint(sh, 0, -0.29, 0);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.05, 0.05, 12), shirt); cuff.position.y = -0.17; el.add(cuff);
      const fa = capsule(0.045, 0.17, skin); fa.position.y = -0.1; el.add(fa); // rolled-up sleeves: forearm skin
      const roll = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 6, 12).rotateX(Math.PI / 2), shirt); roll.position.y = -0.01; el.add(roll);
      const wr = joint(el, 0, -0.25, 0);
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.035), skin); palm.position.y = -0.045; palm.castShadow = true; wr.add(palm);
      const fingers = joint(wr, 0, -0.09, 0); const fm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.03), skin); fm.position.y = -0.03; fingers.add(fm);
      for (let f = 0; f < 4; f++) { const tipm = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.02, 3, 6), skin); tipm.position.set(-0.026 + f * 0.0175, -0.066, 0); fingers.add(tipm); }
      const th = joint(wr, sx * -0.04, -0.03, 0.015); const tm = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.035, 3, 6), skin); tm.position.y = -0.025; th.add(tm); th.rotation.z = sx * 0.5;
      this.arms.push({ sh, el, wr, fingers, th, side: sx });
    }
    // legs (jeans + work boots)
    this.legs = [];
    for (const sx of [-1, 1]) {
      const hip = joint(hips, sx * 0.1, -0.06, 0);
      const th = capsule(0.085, 0.3, jeans); th.position.y = -0.22; hip.add(th);
      const kn = joint(hip, 0, -0.44, 0);
      const sn = capsule(0.07, 0.3, jeans); sn.position.y = -0.2; kn.add(sn);
      const an = joint(kn, 0, -0.43, 0);
      const bootM = lathe([[0, 0], [0.06, 0], [0.065, 0.05], [0.06, 0.1], [0, 0.11]], boot, 14); bootM.position.y = -0.06; an.add(bootM);
      const toe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.2), boot); toe.position.set(0, -0.035, 0.07); toe.castShadow = true; an.add(toe);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.28), M.rubberBlack); sole.position.set(0, -0.07, 0.04); an.add(sole);
      this.legs.push({ hip, kn, an });
    }
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // animation state
    this.t = Math.random() * 10; this.blinkT = 2; this.blink = 0; this.sacc = V(0, 0, 0); this.saccT = 0;
    this.lookYaw = 0; this.lookPitch = 0; this.talk = 0; this.browUp = 0;
    this.gesture = null; this.gT = 0; this.gW = 0; this.mood = 0;
  }
  play(name, dur = 1.8) { this.gesture = name; this.gT = 0; this.gDur = dur; }

  update(dt, playerPos, talkAmp = 0) {
    this.t += dt; const t = this.t;
    // ---- look at player (head first, then neck/chest share the rest) ----
    const wp = new THREE.Vector3(); this.head.getWorldPosition(wp);
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const lp = playerPos.clone().applyMatrix4(inv), hp = wp.clone().applyMatrix4(inv);
    const dx = lp.x - hp.x, dz = lp.z - hp.z, dy = lp.y - hp.y, dist = Math.hypot(dx, dz);
    let yaw = Math.atan2(dx, dz), pitch = -Math.atan2(dy, dist);
    const engaged = dist < 9;
    if (!engaged) { yaw = Math.sin(t * 0.21) * 0.5; pitch = 0.15 + Math.sin(t * 0.33) * 0.05; }
    yaw = clamp(yaw, -1.2, 1.2); pitch = clamp(pitch, -0.45, 0.5);
    this.lookYaw = dampAngle(this.lookYaw, yaw, 4, dt); this.lookPitch = damp(this.lookPitch, pitch, 4, dt);
    // ---- gestures ----
    let g = { lSh: [0, 0, 0], rSh: [0, 0, 0], lEl: 0, rEl: 0, rWr: [0, 0, 0], lWr: [0, 0, 0], lean: 0, shrug: 0, rFing: 0 };
    if (this.gesture) {
      this.gT += dt; const k = this.gT / this.gDur;
      const e = easeInOutCubic(clamp(k * 3, 0, 1)) * (1 - easeInOutCubic(clamp((k - 0.75) * 4, 0, 1)));
      switch (this.gesture) {
        case 'wave': g.rSh = [-0.2, 0, -2.5 * e]; g.rEl = -0.9 * e + Math.sin(this.gT * 13) * 0.35 * e; g.rWr = [0, 0, Math.sin(this.gT * 13) * 0.3 * e]; break;
        case 'point': g.rSh = [-1.45 * e, 0, -0.35 * e]; g.rEl = -0.1 * e; g.rFing = 1.2 * e; g.lean = 0.05 * e; break;
        case 'shrug': g.shrug = e; g.lSh = [-0.3 * e, 0, 0.5 * e]; g.rSh = [-0.3 * e, 0, -0.5 * e]; g.lEl = -1.6 * e; g.rEl = -1.6 * e; g.lWr = [0, 0, -0.8 * e]; g.rWr = [0, 0, 0.8 * e]; this.browUp = Math.max(this.browUp, e); break;
        case 'thumbs': g.rSh = [-0.9 * e, 0, -0.3 * e]; g.rEl = -1.5 * e; g.rFing = 1.6 * e; g.rWr = [0, 0.4 * e, 0]; this.browUp = Math.max(this.browUp, e * 0.6); break;
        case 'cheer': g.lSh = [-0.2 * e, 0, 2.7 * e]; g.rSh = [-0.2 * e, 0, -2.7 * e]; g.lEl = -0.4 * e; g.rEl = -0.4 * e; g.lean = -0.08 * e + Math.sin(this.gT * 10) * 0.03 * e; this.browUp = Math.max(this.browUp, e); break;
        case 'count': g.lSh = [-0.8 * e, 0, 0.2 * e]; g.lEl = -1.4 * e; g.rSh = [-0.85 * e, 0, -0.15 * e]; g.rEl = -1.3 * e + Math.sin(this.gT * 16) * 0.12 * e; g.lean = 0.12 * e; break;
      }
      if (k >= 1) this.gesture = null;
    }
    // ---- body idle: breathing, weight shift, belly ----
    const br = Math.sin(t * 1.6);
    this.torso.scale.set(1 + br * 0.012, 1 + br * 0.006, 0.8 + br * 0.02);
    this.chest.position.y = 0.5 + br * 0.004;
    const shift = Math.sin(t * 0.35);
    this.hips.position.x = shift * 0.025; this.hips.rotation.z = shift * 0.03;
    this.spine.rotation.z = -shift * 0.035; this.spine.rotation.x = 0.04 + g.lean;
    this.legs[0].hip.rotation.z = -shift * 0.03; this.legs[1].hip.rotation.z = -shift * 0.03;
    this.legs[0].kn.rotation.x = Math.max(0, shift) * 0.08; this.legs[1].kn.rotation.x = Math.max(0, -shift) * 0.08;
    this.legs.forEach(l => (l.an.rotation.x = -l.kn.rotation.x * 0.5));
    // ---- head / neck ----
    this.chest.rotation.y = this.lookYaw * 0.25; this.neck.rotation.y = this.lookYaw * 0.3; this.head.rotation.y = this.lookYaw * 0.45;
    this.neck.rotation.x = this.lookPitch * 0.4; this.head.rotation.x = this.lookPitch * 0.6 + Math.sin(t * 2.3) * 0.02 * (talkAmp > 0.05 ? 3 : 1);
    this.head.rotation.z = Math.sin(t * 0.7) * 0.03 + (talkAmp > 0.05 ? Math.sin(t * 5.3) * 0.04 : 0);
    // ---- eyes: saccades + blink ----
    this.saccT -= dt; if (this.saccT < 0) { this.saccT = 0.4 + Math.random() * 1.6; this.sacc.set((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.15, 0); }
    for (const e of this.eyes) { e.rotation.y = damp(e.rotation.y, this.lookYaw * 0.3 + this.sacc.x, 25, dt); e.rotation.x = damp(e.rotation.x, this.lookPitch * 0.4 + this.sacc.y, 25, dt); }
    this.blinkT -= dt; if (this.blinkT < 0) { this.blinkT = 2 + Math.random() * 3.5; this.blink = 1; }
    this.blink = Math.max(0, this.blink - dt * 7);
    const lidOpen = 1 - Math.sin(Math.min(1, this.blink) * Math.PI);
    this.lids.forEach(l => (l.rotation.x = lerp(1.25, -0.35, lidOpen) - 0.1));
    // ---- face acting ----
    this.talk = damp(this.talk, talkAmp, 18, dt);
    this.jaw.rotation.x = this.talk * 0.32; this.mouthIn.scale.y = 0.3 + this.talk * 1.4;
    this.browUp = Math.max(this.talk * 0.5, damp(this.browUp, 0, 2, dt));
    this.brows.forEach((b, k) => { b.position.y = 0.155 + this.browUp * 0.012; b.rotation.z = (k ? -1 : 1) * this.browUp * 0.12; });
    // ---- arms (idle: hands resting on the counter-height belly area) ----
    const [L, R] = this.arms;
    const idleSw = Math.sin(t * 1.6 + 0.5) * 0.03;
    L.sh.rotation.set(-0.25 + idleSw + g.lSh[0], g.lSh[1], -0.2 - g.lSh[2]); L.el.rotation.x = -0.55 + g.lEl; L.wr.rotation.set(g.lWr[0], g.lWr[1], g.lWr[2]);
    R.sh.rotation.set(-0.25 + idleSw + g.rSh[0], g.rSh[1], 0.2 - g.rSh[2]); R.el.rotation.x = -0.55 + g.rEl; R.wr.rotation.set(g.rWr[0], g.rWr[1], g.rWr[2]);
    R.fingers.rotation.x = g.rFing > 0 ? 0 : 0.4; R.fingers.scale.y = 1 - Math.min(1, g.rFing) * 0.45;
    L.fingers.rotation.x = 0.5;
    L.sh.position.y = -0.02 + g.shrug * 0.06; R.sh.position.y = -0.02 + g.shrug * 0.06;
  }
}
