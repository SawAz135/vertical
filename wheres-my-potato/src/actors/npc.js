import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp, easeInOutCubic } from '../core/util.js';
import { Hand, POSES, skinMaterial } from './handmesh.js';
import { makeHead, makeMoustache, makeBrow, makeFringe, makeCap, makeEyeball, makeTorso, makeApron, makeSleeve, makeForearm } from './gerardparts.js';

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
    const skin = skinMaterial(0xe8a888);                 // hands / forearms (multiplied by their vertex tint)
    const faceSkin = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color(0xff9a80), sheenRoughness: 0.5, clearcoat: 0.08, clearcoatRoughness: 0.5 });
    const lidSkin = new THREE.MeshPhysicalMaterial({ color: 0xeab094, roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color(0xff9a80) });
    const shirt = M.plaid, jeans = M.denim, boot = M.leather;
    const frame = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.3, metalness: 0.4 });
    const lens = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.02, metalness: 0.6 });

    const root = this.root = new THREE.Group();
    const hips = this.hips = joint(root, 0, 0.98, 0);
    // pelvis + belt
    hips.add(lathe([[0, -0.12], [0.17, -0.1], [0.19, 0.0], [0.18, 0.08], [0, 0.1]], jeans, 28));
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.025, 8, 40).rotateX(Math.PI / 2), M.leather); belt.position.y = 0.06; belt.scale.z = 0.8; hips.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.045, 0.01), M.brass); buckle.position.set(0, 0.06, 0.15); hips.add(buckle);
    // torso: sculpted belly + chest + shoulders in a plaid shirt, canvas apron on top
    const spine = this.spine = joint(hips, 0, 0.08, 0);
    const torso = makeTorso(shirt); spine.add(torso); this.torso = torso; this.torsoZ = 1;
    torso.add(makeApron());
    const chest = this.chest = joint(spine, 0, 0.5, 0);
    // neck + head (one sculpt, skinned to head + jaw)
    const neck = this.neck = joint(chest, 0, 0.06, 0.01);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 10, 28).rotateX(Math.PI / 2), shirt); collar.position.y = 0.01; neck.add(collar);
    const head = this.head = joint(neck, 0, 0.12, 0);
    const H = makeHead(faceSkin); head.add(H.mesh); this.jaw = H.jaw; this.mouthIn = null;
    // eyes with painted irises, blinking lids, bushy brows
    this.eyes = []; this.lids = []; this.brows = [];
    for (const sx of [-1, 1]) {
      const eye = joint(head, sx * 0.037, 0.123, 0.089); const eb = makeEyeball(); eb.scale.setScalar(0.92); eye.add(eb); this.eyes.push(eye);
      const lidU = joint(head, sx * 0.037, 0.123, 0.089); const lidM = new THREE.Mesh(new THREE.SphereGeometry(0.0205, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), lidSkin); lidU.add(lidM); this.lids.push(lidU);
      const brow = joint(head, sx * 0.04, 0.155, 0.093); const bm = makeBrow(sx); bm.position.x = sx * 0.0; brow.add(bm); this.brows.push(brow);
    }
    head.add(makeMoustache(), makeFringe());
    // reading glasses (on the nose tip)
    const glasses = joint(head, 0, 0.118, 0.128);
    for (const sx of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0016, 8, 32), frame); rim.position.x = sx * 0.036; rim.scale.y = 0.78; glasses.add(rim);
      const ln = new THREE.Mesh(new THREE.CircleGeometry(0.022, 24), lens); ln.position.x = sx * 0.036; ln.scale.y = 0.78; glasses.add(ln);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.14), frame); arm.position.set(sx * 0.058, 0.004, -0.07); glasses.add(arm);
    }
    const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.002, 6, 12, Math.PI), frame); bridge.position.y = 0.004; glasses.add(bridge);
    // worn cap
    const cap = joint(head, 0, 0, 0); cap.rotation.x = -0.06; cap.add(makeCap());
    // arms: plaid sleeve rolled above the elbow, sculpted forearm, rigged hand
    this.arms = [];
    for (const sx of [-1, 1]) {
      const sh = joint(chest, sx * 0.23, -0.02, 0);
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 16), shirt); sh.add(shoulder);
      sh.add(makeSleeve(shirt));
      const el = joint(sh, 0, -0.29, 0);
      el.add(makeForearm(skin));
      const wr = joint(el, 0, -0.235, 0);
      // his left arm is at +x (he faces +z): the hand models are mirrored accordingly
      const hand = new Hand(sx > 0 ? -1 : 1, skin); hand.group.scale.setScalar(1.12);
      const g1 = joint(wr, 0, 0.01, 0); g1.rotation.y = -sx * Math.PI / 2; const g2 = joint(g1, 0, 0, 0); g2.rotation.x = -Math.PI / 2; g2.add(hand.group);
      hand.mesh.castShadow = true;
      const fingers = { rotation: { x: 0 }, scale: { y: 1 } }, th = joint(wr, 0, 0, 0);
      this.arms.push({ sh, el, wr, fingers, th, side: sx, hand });
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
    const wp = this._wp || (this._wp = new THREE.Vector3()); this.head.getWorldPosition(wp);
    const inv = (this._inv || (this._inv = new THREE.Matrix4())).copy(this.root.matrixWorld).invert();
    const lp = (this._lp || (this._lp = new THREE.Vector3())).copy(playerPos).applyMatrix4(inv), hp = wp.applyMatrix4(inv);
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
    this.torso.scale.set(1 + br * 0.012, 1 + br * 0.006, 1 + br * 0.02);
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
    this.lids.forEach(l => (l.rotation.x = lerp(1.25, 0.05, lidOpen) + 0.12)); // heavy, kind lids
    // ---- face acting ----
    this.talk = damp(this.talk, talkAmp, 18, dt);
    this.jaw.rotation.x = this.talk * 0.3;
    this.browUp = Math.max(this.talk * 0.5, damp(this.browUp, 0, 2, dt));
    this.brows.forEach((b, k) => { b.position.y = 0.155 + this.browUp * 0.012; b.rotation.z = (k ? -1 : 1) * this.browUp * 0.12; });
    // ---- arms (idle: hands resting on the counter-height belly area) ----
    const [L, R] = this.arms;
    const idleSw = Math.sin(t * 1.6 + 0.5) * 0.03;
    L.sh.rotation.set(-0.25 + idleSw + g.lSh[0], g.lSh[1], -0.2 - g.lSh[2]); L.el.rotation.x = -0.55 + g.lEl; L.wr.rotation.set(g.lWr[0], g.lWr[1], g.lWr[2]);
    R.sh.rotation.set(-0.25 + idleSw + g.rSh[0], g.rSh[1], 0.2 - g.rSh[2]); R.el.rotation.x = -0.55 + g.rEl; R.wr.rotation.set(g.rWr[0], g.rWr[1], g.rWr[2]);
    // fingers: pointing / thumbs-up / relaxed, blended
    const kf = 1 - Math.exp(-dt * 10);
    R.hand.blend(this.gesture === 'point' && g.rFing > 0.3 ? POSES.point : this.gesture === 'thumbs' && g.rFing > 0.3 ? POSES.thumbs : this.gesture === 'wave' ? POSES.reach : POSES.relaxed, kf);
    L.hand.blend(this.gesture === 'cheer' || this.gesture === 'wave' ? POSES.reach : POSES.relaxed, kf);
    L.sh.position.y = -0.02 + g.shrug * 0.06; R.sh.position.y = -0.02 + g.shrug * 0.06;
  }
}
