import * as THREE from 'three';
import { boxGeo, Batcher } from './build.js';
import { ST } from './dynpotatoes.js';
import { canvasTex, textCanvas } from '../gfx/textures.js';
import { TAU, clamp, rng } from '../core/util.js';
import { CLEAR } from './field.js';

// =====================================================================================
// THE MACHINE: wooden bin → paddle wheel → short ramp → a SPIRAL conveyor that winds four
// times around the SKYSCRAPER jar (30 m tall, Ø 14 m) → chute over the mouth.
// Jar contents = a rising potato fill (textured volume + domed top) + a live layer of real
// physical potatoes on top (oldest absorbed into the fill). Full jar: the dome rolls the
// potatoes over the rim and they fall 30 m into the potato sea.
// =====================================================================================
export const JAR = { x: 0, z: 0, R: 7, th: 0.22, y0: 0, yb: 0.5, rim: 30 };
export const BIN = { x: -3.2, z: -14.5, w: 1.7, d: 1.7, h: 0.85, t: 0.08, floor: 0.12 };
export const JAR_CAP = 50000;
const DOME = 1.4, LIVE_IN_JAR = 900;
const RH = JAR.R + JAR.th + 1.25;           // spiral radius
const TURNS = 4, TH0 = -Math.PI / 2;        // spiral starts on the south side
const Y0 = 2.0, Y1 = JAR.rim + 1.2;
const P0 = new THREE.Vector3(BIN.x + BIN.w / 2 + 0.3, 1.02, BIN.z);
const H0 = new THREE.Vector3(Math.cos(TH0) * RH, Y0, Math.sin(TH0) * RH);
const H1 = new THREE.Vector3(Math.cos(TH0) * RH, Y1, Math.sin(TH0) * RH);
const C1 = new THREE.Vector3(JAR.x, Y1 - 0.5, JAR.z - 1.5);
const SPIRAL_BOOST = 7; // the spiral runs faster than the ramp

export class Machine {
  constructor(scene, M, world) {
    this.scene = scene; this.M = M; this.world = world;
    CLEAR.push({ x: JAR.x, z: JAR.z, r: RH + 0.9 }, { x0: BIN.x - 2.2, x1: BIN.x + 3.6, z0: BIN.z - 2.2, z1: BIN.z + 1.8 }, { x0: -1.6, x1: 1.6, z0: -RH - 1, z1: -RH + 1 });
    this.segLen = [P0.distanceTo(H0), Math.hypot(TAU * RH * TURNS, Y1 - Y0), H1.distanceTo(C1)];
    this.len = this.segLen.reduce((a, b) => a + b, 0); this.dir = H0.clone().sub(P0).normalize();
    this.speed = 1.2; this.feedEvery = 0.55; this.feedT = 0; this.wheelA = 0; this.cleatOff = 0; this.spiralOff = 0;
    this.boxes = []; this.colliders = []; this.queue = 0; this.fillUnits = 0; this.fillTop = JAR.yb; this.fullness = 0; this.dome = 0;
  }
  build() {
    this._bin(); this._ramp(); this._spiral(); this._chute(); this._jar(); this._lights();
    const self = this;
    this.belt = {
      get speed() { return self.speed; }, len: this.effLen, dirX: this.dir.x, dirZ: this.dir.z,
      // the spiral part moves SPIRAL_BOOST times faster: remap the travelled distance
      pos(s, lat, out) { return self._pathPos(s, lat, out); },
      exit(i) { self._exit(i); },
    };
    this.world.jarFloor = (x, z) => { const d2 = ((x - JAR.x) ** 2 + (z - JAR.z) ** 2) / (JAR.R * JAR.R); return this.fillTop + this.dome * Math.max(0, 1 - d2); };
    this.world.jarSlope = (x, z) => { const k = 2 * this.dome / (JAR.R * JAR.R); return [k * (x - JAR.x), k * (z - JAR.z)]; };
    this.onPay = this.onPay || (() => {}); this.onFeed = this.onFeed || (() => {});
  }
  inBin(x, y, z) { return Math.abs(x - BIN.x) < BIN.w / 2 && Math.abs(z - BIN.z) < BIN.d / 2 && y < BIN.h + 0.4; }
  binTarget(r, out) { return out.set(BIN.x + (r() - 0.5) * 1.0, BIN.h + 0.25, BIN.z + (r() - 0.5) * 1.0); }

  // ---------- bin + paddle wheel ----------
  _bin() {
    const M = this.M, g = new THREE.Group(), b = BIN, B = new Batcher();
    const add = (w, h, d, x, y, z, mat = M.crate) => { const m = new THREE.Mesh(boxGeo(w, h, d, mat.userData.tile), mat); m.position.set(b.x + x, y, b.z + z); m.castShadow = m.receiveShadow = true; B.addMesh(m); this.boxes.push({ min: new THREE.Vector3(b.x + x - w / 2, y - h / 2, b.z + z - d / 2), max: new THREE.Vector3(b.x + x + w / 2, y + h / 2, b.z + z + d / 2), kind: 'wood' }); };
    // wooden deck the bin stands on, laid over the potato sea
    const deck = new THREE.Mesh(boxGeo(4.6, 0.16, 4.2, M.wood.userData.tile), M.wood); deck.position.set(b.x + 0.7, 0.02, b.z); deck.receiveShadow = true; B.addMesh(deck);
    add(b.w + 0.2, b.floor, b.d + 0.2, 0, b.floor / 2 + 0.1, 0);
    add(b.w + 0.2, b.h, b.t, 0, b.h / 2, -b.d / 2 - b.t / 2); add(b.w + 0.2, b.h, b.t, 0, b.h / 2, b.d / 2 + b.t / 2);
    add(b.t, b.h, b.d, -b.w / 2 - b.t / 2, b.h / 2, 0); add(b.t, b.h, b.d, b.w / 2 + b.t / 2, b.h / 2, 0);
    // corner posts + painted sign
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = new THREE.Mesh(boxGeo(0.12, b.h + 0.1, 0.12, 1), M.woodDark); p.position.set(b.x + sx * (b.w / 2 + 0.06), (b.h + 0.1) / 2, b.z + sz * (b.d / 2 + 0.06)); p.castShadow = true; B.addMesh(p); }
    const sign = canvasTex(textCanvas(512, 160, (x, w, h) => {
      x.fillStyle = '#f2e3c2'; x.fillRect(0, 0, w, h); x.strokeStyle = '#6b3a1a'; x.lineWidth = 10; x.strokeRect(6, 6, w - 12, h - 12);
      x.fillStyle = '#6b3a1a'; x.font = '900 64px Georgia'; x.textAlign = 'center'; x.fillText('LE BAC', w / 2, 80); x.font = 'italic 700 30px Georgia'; x.fillText('versez vos patates ici ↓', w / 2, 128);
    }), true);
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.34), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.8 }));
    sm.position.set(b.x - b.w / 2 - b.t - 0.01, b.h + 0.28, b.z); sm.rotation.y = -Math.PI / 2; this.scene.add(sm);
    const post = new THREE.Mesh(boxGeo(0.06, 0.4, 0.06, 1), M.woodDark); post.position.set(b.x - b.w / 2 - b.t, b.h + 0.1, b.z); B.addMesh(post);
    B.build(this.scene);
    this.colliders.push({ min: new THREE.Vector3(b.x - b.w / 2 - 0.15, 0, b.z - b.d / 2 - 0.15), max: new THREE.Vector3(b.x + b.w / 2 + 0.15, b.h, b.z + b.d / 2 + 0.15) });
    // paddle wheel that lifts potatoes from the bin onto the belt
    const wheel = new THREE.Group(); wheel.position.set(b.x + b.w / 2 - 0.05, 0.75, b.z);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 12).rotateX(Math.PI / 2), M.paintGrey); wheel.add(hub);
    for (let k = 0; k < 6; k++) { const p = new THREE.Group(); p.rotation.z = k * TAU / 6; const blade = new THREE.Mesh(boxGeo(0.04, 0.42, 0.62, 1), M.paintRed); blade.position.y = 0.25; blade.castShadow = true; p.add(blade); wheel.add(p); }
    this.scene.add(wheel); this.wheel = wheel;
  }

  // ---------- path ----------
  // travelled distance s (belt units): ramp at 1x, spiral and chute at SPIRAL_BOOST x
  _pathPos(s, lat, out) {
    const L0 = this.segLen[0];
    if (s <= L0) { out.copy(P0).lerp(H0, s / L0).addScaledVector(_up.set(-this.dir.y, this.dir.x, 0), 0.06); out.x += lat * 0.3; return out; }
    let u = (s - L0) * SPIRAL_BOOST;
    if (u <= this.segLen[1]) { const t = u / this.segLen[1], a = TH0 + t * TAU * TURNS, r = RH + lat; return out.set(Math.cos(a) * r, Y0 + t * (Y1 - Y0) + 0.08, Math.sin(a) * r); }
    u -= this.segLen[1]; const t = clamp(u / this.segLen[2], 0, 1); out.copy(H1).lerp(C1, t); out.y += 0.12; out.x += lat * 0.4; return out;
  }
  get effLen() { return this.segLen[0] + (this.segLen[1] + this.segLen[2]) / SPIRAL_BOOST; }

  // ---------- ramp from the bin to the spiral foot ----------
  _ramp() {
    const M = this.M, B = new Batcher(), len = this.segLen[0];
    const mid = P0.clone().add(H0).multiplyScalar(0.5), dir = this.dir;
    const yaw = Math.atan2(-dir.z, dir.x), pitch = Math.asin(dir.y);
    const orient = o => { o.position.copy(mid); o.rotation.order = 'YZX'; o.rotation.set(0, yaw, pitch); };
    const tex = M.rubber.map.clone(); tex.repeat.set((len + 0.6) / 0.5, 1.2); tex.needsUpdate = true; this.beltTex = tex;
    const frame = new THREE.Group(); orient(frame);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(len + 0.6, 0.05, 0.62), new THREE.MeshStandardMaterial({ map: tex, color: 0x333333, roughness: 0.75 })); belt.receiveShadow = belt.castShadow = true; frame.add(belt);
    this.scene.add(frame);
    const rails = new THREE.Group(); orient(rails);
    for (const sz of [-1, 1]) { const r1 = new THREE.Mesh(boxGeo(len + 0.6, 0.22, 0.05, 1), M.paintRed); r1.position.set(0, 0.06, sz * 0.34); r1.castShadow = true; rails.add(r1); }
    B.addTree(rails, { cast: true });
    for (let s = 0.5; s < len; s += 1.6) {
      const p = P0.clone().addScaledVector(dir, s), side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      for (const sz of [-1, 1]) { const q = p.clone().addScaledVector(side, sz * 0.36), h = q.y; const leg = new THREE.Mesh(boxGeo(0.08, h, 0.08, 1), M.paintRed); leg.position.set(q.x, h / 2, q.z); leg.castShadow = true; B.addMesh(leg); }
    }
    B.build(this.scene);
    this.cleatGap = 0.55; const n = Math.ceil(len / this.cleatGap) + 1;
    this.cleats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.05, 0.58), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6 }), n);
    this.cleats.castShadow = true; this.cleats.frustumCulled = false; this.scene.add(this.cleats);
    this.cleatQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, pitch, 'YZX'));
  }

  // ---------- the spiral conveyor around the jar ----------
  _spiral() {
    const M = this.M, N = TURNS * 120, W = 0.42;
    const ribbon = (r0, r1, y0, y1, vScale) => { // a helical strip between radii r0..r1, heights offset y0..y1
      const pos = [], uv = [], idx = [];
      for (let k = 0; k <= N; k++) {
        const t = k / N, a = TH0 + t * TAU * TURNS, y = Y0 + t * (Y1 - Y0), c = Math.cos(a), s = Math.sin(a);
        pos.push(c * r0, y + y0, s * r0, c * r1, y + y1, s * r1); uv.push(0, t * vScale, 1, t * vScale);
        if (k < N) { const b = k * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
    };
    const tex = M.rubber.map.clone(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.needsUpdate = true; this.spiralTex = tex;
    const belt = new THREE.Mesh(ribbon(RH - W, RH + W, 0, 0, this.segLen[1] / 0.5), new THREE.MeshStandardMaterial({ map: tex, color: 0x2e2e30, roughness: 0.7, side: THREE.DoubleSide }));
    belt.receiveShadow = true; belt.castShadow = true; this.scene.add(belt);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xd8261c, roughness: 0.35, metalness: 0.4, side: THREE.DoubleSide });
    for (const r of [RH - W, RH + W]) { const rail = new THREE.Mesh(ribbon(r, r, -0.05, 0.22, 1), railMat); rail.castShadow = true; this.scene.add(rail); }
    const under = new THREE.Mesh(ribbon(RH - W, RH + W, -0.12, -0.12, 1), new THREE.MeshStandardMaterial({ color: 0x8a1a14, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide })); this.scene.add(under);
    // brackets bolting the spiral to the glass, every 15 degrees
    const B = new Batcher(); const steps = TURNS * 24;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, a = TH0 + t * TAU * TURNS, y = Y0 + t * (Y1 - Y0) - 0.2, r0 = JAR.R + JAR.th, L = RH + W - r0;
      const m = new THREE.Mesh(boxGeo(L, 0.08, 0.1, 1), M.paintGrey); m.position.set(Math.cos(a) * (r0 + L / 2), y, Math.sin(a) * (r0 + L / 2)); m.rotation.y = -a; B.addMesh(m);
      const brace = new THREE.Mesh(boxGeo(0.06, 0.7, 0.06, 1), M.paintGrey); brace.position.set(Math.cos(a) * (r0 + 0.25), y - 0.35, Math.sin(a) * (r0 + 0.25)); B.addMesh(brace);
    }
    B.build(this.scene);
    this.spiralCleats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.05, W * 2 - 0.06), new THREE.MeshStandardMaterial({ color: 0x48484c, roughness: 0.6 }), 260);
    this.spiralCleats.frustumCulled = false; this.scene.add(this.spiralCleats);
  }
  _chute() {
    const M = this.M, a = H1.clone(), b = C1.clone();
    const len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(0.5), dir = b.clone().sub(a).normalize();
    const chute = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, len, 20, 1, true, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ map: M.metal.map, color: 0xc8d0d8, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide }));
    chute.position.copy(mid); chute.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); chute.rotateY(Math.PI); chute.castShadow = true; this.scene.add(chute);
    // motor house on the rim + spinning drum + red beacon (the highest point around)
    const house = new THREE.Mesh(boxGeo(1.4, 1.1, 1.2, 1), M.paintYellow); house.position.set(H1.x + 1.2, Y1 + 0.2, H1.z - 0.3); house.castShadow = true; this.scene.add(house);
    this.drum = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 20).rotateZ(Math.PI / 2), M.chrome); this.drum.position.set(H1.x, Y1 - 0.2, H1.z); this.scene.add(this.drum);
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10), new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2010, emissiveIntensity: 2 })); this.beacon.position.set(H1.x + 1.2, Y1 + 1.0, H1.z - 0.3); this.scene.add(this.beacon);
    this.beaconLight = new THREE.PointLight(0xff3020, 0, 30, 2); this.beaconLight.position.copy(this.beacon.position); this.scene.add(this.beaconLight);
  }
  // ---------- giant glass jar ----------
  _jar() {
    const J = JAR, M = this.M, o = J.R + J.th, pts = [];
    pts.push([0, J.y0]); for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI / 2; pts.push([o - 0.6 + Math.sin(a) * 0.6, J.y0 + 0.6 - Math.cos(a) * 0.6]); }
    // shoulder + neck like a real jar, thick rolled lip
    // straight walls (so the physics matches the glass exactly) with a thick rolled lip
    pts.push([o, J.rim - 0.5], [o + 0.12, J.rim - 0.35], [o + 0.14, J.rim - 0.12], [o + 0.06, J.rim + 0.06], [J.R + J.th * 0.5, J.rim + 0.1], [J.R - 0.04, J.rim + 0.02], [J.R, J.rim - 0.2]);
    for (let k = 8; k >= 0; k--) { const a = k / 8 * Math.PI / 2; pts.push([J.R - 0.5 + Math.sin(a) * 0.5, J.yb + 0.5 - Math.cos(a) * 0.5]); }
    pts.push([0, J.yb]);
    const geo = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 96);
    const glass = new THREE.MeshStandardMaterial({ color: 0xe0f4ff, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.3 });
    glass.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      float fres = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0,0.0,1.0))), 3.0);
      gl_FragColor.a = clamp(gl_FragColor.a + fres*0.42, 0.0, 0.7);
      gl_FragColor.rgb += vec3(0.6,0.85,1.0)*fres*0.12;`);
    };
    const jar = new THREE.Mesh(geo, glass); jar.position.set(J.x, 0, J.z); jar.renderOrder = 10; this.scene.add(jar); this.jarMesh = jar;
    // fill: textured potato volume (side) + domed top surface
    const pileMat = M.pile.clone(); pileMat.map = M.pile.map.clone(); pileMat.map.repeat.set(9, 2); pileMat.map.needsUpdate = true; pileMat.normalMap = M.pile.normalMap.clone(); pileMat.normalMap.repeat.set(9, 2); pileMat.normalMap.needsUpdate = true; this.pileSideMat = pileMat;
    this.fillSide = new THREE.Mesh(new THREE.CylinderGeometry(J.R - 0.04, J.R - 0.04, 1, 72, 1, true).translate(0, 0.5, 0), pileMat);
    this.fillSide.position.set(J.x, J.yb, J.z); this.fillSide.receiveShadow = true; this.scene.add(this.fillSide);
    const topMat = M.pile.clone(); topMat.map = M.pile.map.clone(); topMat.map.repeat.set(5, 5); topMat.map.needsUpdate = true; topMat.normalMap = M.pile.normalMap.clone(); topMat.normalMap.repeat.set(5, 5); topMat.normalMap.needsUpdate = true;
    const tg = new THREE.CircleGeometry(J.R - 0.04, 64, 0, TAU); tg.rotateX(-Math.PI / 2); this.topBase = tg.attributes.position.array.slice();
    this.fillTopMesh = new THREE.Mesh(tg, topMat); this.fillTopMesh.position.set(J.x, J.yb, J.z); this.fillTopMesh.receiveShadow = true; this.scene.add(this.fillTopMesh);
    this.fillSide.visible = this.fillTopMesh.visible = false;
    // brass bands, thick base plinth, giant graduations
    for (const y of [1.2, J.rim - 1.8]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(o + 0.05, 0.09, 10, 96).rotateX(Math.PI / 2), M.brass); ring.position.set(J.x, y, J.z); ring.castShadow = true; this.scene.add(ring); }
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(o + 0.6, o + 0.85, 0.35, 64), M.concreteDark || M.woodDark); plinth.position.set(J.x, 0.0, J.z); plinth.receiveShadow = true; plinth.castShadow = true; this.scene.add(plinth);
    this.gradTex = canvasTex(textCanvas(1024, 2048, () => {}), true);
    const gh = J.rim - 2.2;
    const grad = new THREE.Mesh(new THREE.CylinderGeometry(o + 0.006, o + 0.006, gh, 64, 1, true, -0.45, 0.9), new THREE.MeshBasicMaterial({ map: this.gradTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    grad.position.set(J.x, J.yb + gh / 2, J.z); grad.rotation.y = Math.PI + 0.75; grad.renderOrder = 11; this.scene.add(grad); this.gradH = gh;
    this._drawGrad();
    // ONE piece of brown packing tape stuck on the front, "BOCAL" written on it in marker
    const tape = canvasTex(textCanvas(1024, 384, (x, W, H) => {
      const r = rng(31); x.clearRect(0, 0, W, H);
      x.fillStyle = 'rgba(205,160,88,0.95)'; x.beginPath();
      x.moveTo(18 + r() * 10, 20); for (let k = 1; k <= 30; k++) x.lineTo(k * W / 30 - (k === 30 ? 20 : 0), 16 + r() * 10);
      for (let k = 0; k <= 12; k++) x.lineTo(W - 14 - (k % 2) * 16 - r() * 8, 20 + k * (H - 40) / 12); // torn right end
      for (let k = 30; k >= 0; k--) x.lineTo(k * W / 30, H - 16 - r() * 10);
      for (let k = 12; k >= 0; k--) x.lineTo(10 + (k % 2) * 14 + r() * 8, 20 + k * (H - 40) / 12); // torn left end
      x.fill();
      x.globalAlpha = 0.2; x.strokeStyle = '#fff'; for (let k = 0; k < 18; k++) { x.lineWidth = 1 + r() * 3; x.beginPath(); const yy = 40 + r() * (H - 80); x.moveTo(30, yy); x.lineTo(W - 30, yy + (r() - 0.5) * 10); x.stroke(); }
      x.globalAlpha = 0.25; x.fillStyle = '#7a5020'; for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(80 + r() * (W - 160), 60 + r() * (H - 120), 30 + r() * 40, 12 + r() * 10, r(), 0, 7); x.fill(); }
      x.globalAlpha = 1; x.fillStyle = '#16100c'; x.font = '230px Marker, "Permanent Marker", "Comic Sans MS", cursive'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.save(); x.translate(W / 2, H / 2 + 10); x.rotate(-0.035); x.fillText('BOCAL', 0, 0); x.restore();
    }), true);
    tape.wrapS = tape.wrapT = THREE.ClampToEdgeWrapping;
    const tapeM = new THREE.Mesh(new THREE.CylinderGeometry(o + 0.03, o + 0.03, 2.4, 48, 1, true, Math.PI - 0.42, 0.84), new THREE.MeshStandardMaterial({ map: tape, transparent: true, alphaTest: 0.05, roughness: 0.4, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    tapeM.position.set(J.x, 11.5, J.z); tapeM.rotation.z = 0.025; tapeM.renderOrder = 12; this.scene.add(tapeM);
    this.colliders.push({ x: J.x, z: J.z, r: RH + 0.6 });
  }
  _drawGrad() {
    const c = this.gradTex.image, x = c.getContext('2d'), J = JAR, w = c.width, h = c.height;
    x.clearRect(0, 0, w, h);
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.fillStyle = 'rgba(255,255,255,0.9)'; x.font = '700 64px Georgia'; x.textAlign = 'left';
    const H = this.gradH, total = J.rim - J.yb;
    for (let m = 0.25; m <= H + 0.001; m += 0.25) {
      const py = h - m / H * h, major = Math.round(m * 4) % 8 === 0;
      x.lineWidth = major ? 10 : 5; x.beginPath(); x.moveTo(w / 2 - (major ? 160 : 70), py); x.lineTo(w / 2, py); x.stroke();
      if (major) x.fillText((Math.round(JAR_CAP * m / total / 500) * 500).toLocaleString('fr-FR'), w / 2 + 20, py + 22);
    }
    this.gradTex.needsUpdate = true;
  }
  setCount() {}
  _lights() {
    const sp = new THREE.SpotLight(0xfff0d0, 160, 90, 0.5, 0.7, 1.4); sp.position.set(JAR.x + 18, 42, JAR.z - 30); sp.target.position.set(JAR.x, 12, JAR.z);
    this.scene.add(sp, sp.target);
  }
  // ---------- fill (the big potato volume) ----------
  setFill(units) {
    this.fillUnits = Math.max(0, units);
    const J = JAR, top = J.yb + Math.min(1, this.fillUnits / JAR_CAP) * (J.rim - 0.25 - J.yb);
    this.fillTop = top; this.fullness = this.fillUnits / JAR_CAP;
    this.dome = DOME * clamp((this.fullness - 0.85) / 0.15, 0, 1);
    const h = top - J.yb, vis = h > 0.02;
    this.fillSide.visible = this.fillTopMesh.visible = vis;
    this.fillSide.scale.y = Math.max(0.001, h); this.pileSideMat.map.repeat.y = Math.max(0.2, h / 1.4); this.pileSideMat.normalMap.repeat.y = this.pileSideMat.map.repeat.y;
    // domed, lumpy top surface
    const p = this.fillTopMesh.geometry.attributes.position.array, b = this.topBase, R = J.R;
    for (let i = 0; i < p.length; i += 3) { const d2 = (b[i] * b[i] + b[i + 2] * b[i + 2]) / (R * R); p[i + 1] = this.dome * Math.max(0, 1 - d2) + Math.sin(b[i] * 3.1) * Math.cos(b[i + 2] * 2.7) * 0.05 * (1 - d2); }
    this.fillTopMesh.geometry.attributes.position.needsUpdate = true; this.fillTopMesh.geometry.computeVertexNormals();
    this.fillTopMesh.position.y = top;
  }
  // absorb the lowest settled jar potatoes into the fill (keeps the live layer light)
  _absorb(dyn) {
    if (this.fullness >= 1) return;
    const inJar = []; for (const i of dyn.settled) if (dyn.inJar[i]) inJar.push(i);
    if (inJar.length <= LIVE_IN_JAR) return;
    inJar.sort((a, b) => dyn.db.py[a] - dyn.db.py[b]);
    const n = Math.min(inJar.length - LIVE_IN_JAR + 40, 120);
    for (let k = 0; k < n; k++) dyn.free(inJar[k]);
    this.setFill(this.fillUnits + n);
  }
  get jarCount() { return Math.round(this.fillUnits) + (this.dyn ? this.dyn.totalJar : 0); }

  // ---------- runtime ----------
  update(dt, dyn, t) {
    this.feedT += dt;
    const inBin = [];
    for (const i of dyn.live) if (dyn.st[i] === ST.FREE && this.inBin(dyn.db.px[i], dyn.db.py[i], dyn.db.pz[i])) inBin.push(i);
    this.queue = inBin.length;
    this.wheelA += dt * (inBin.length ? TAU / (this.feedEvery * 6) : 0.4);
    this.wheel.rotation.z = -this.wheelA;
    if (this.feedT >= this.feedEvery && inBin.length && dyn.live.length < dyn.liveCap - 40) {
      this.feedT = 0;
      let best = inBin[0], bd = 1e9; for (const i of inBin) { const d = Math.abs(dyn.db.px[i] - (BIN.x + BIN.w / 2)); if (d < bd) { bd = d; best = i; } }
      const lat = (Math.random() - 0.5) * 0.34;
      dyn.fly(best, P0.clone().add(new THREE.Vector3(0, 0.1, lat)), 0.42, 0.55, i => { dyn.st[i] = ST.BELT; dyn.t[i] = 0; dyn.aux[i] = lat; });
      this.onFeed(best);
    } else if (!inBin.length) this.feedT = Math.min(this.feedT, this.feedEvery);
    const v = this.speed;
    this.cleatOff = (this.cleatOff + dt * v) % this.cleatGap;
    this.beltTex.offset.x = -this.cleatOff / 0.5;
    const m = _M, p = _P, one = _ONE, len0 = this.segLen[0];
    const up = _UP.set(-this.dir.y, this.dir.x, 0).multiplyScalar(0.05);
    for (let k = 0; k < this.cleats.count; k++) {
      const s = k * this.cleatGap + this.cleatOff; if (s > len0) { m.makeScale(0, 0, 0); this.cleats.setMatrixAt(k, m); continue; }
      p.copy(P0).lerp(H0, s / len0).add(up); m.compose(p, this.cleatQ, one); this.cleats.setMatrixAt(k, m);
    }
    this.cleats.instanceMatrix.needsUpdate = true;
    // spiral belt scroll + cleats racing up the helix
    const vs = v * SPIRAL_BOOST, L1 = this.segLen[1], gap = L1 / this.spiralCleats.count;
    this.spiralOff = (this.spiralOff + dt * vs) % gap; this.spiralTex.offset.y = -(this.spiralOff / 0.5);
    const q = _Q;
    for (let k = 0; k < this.spiralCleats.count; k++) {
      const tt = (k * gap + this.spiralOff) / L1, a = TH0 + tt * TAU * TURNS;
      p.set(Math.cos(a) * RH, Y0 + tt * (Y1 - Y0) + 0.04, Math.sin(a) * RH); q.setFromAxisAngle(_yAx, -a); m.compose(p, q, one); this.spiralCleats.setMatrixAt(k, m);
    }
    this.spiralCleats.instanceMatrix.needsUpdate = true;
    this.drum.rotation.x -= dt * vs / 0.3;
    const blink = (Math.sin(t * 4) > 0.3) ? 1 : 0; this.beacon.material.emissiveIntensity = 0.4 + blink * 3; this.beaconLight.intensity = blink * 30;
    this._absorb(dyn);
  }
  _exit(i) {
    const dyn = this.dyn;
    dyn.setFree(i, (Math.random() - 0.5) * 1.6, -0.8, 1.2 + (Math.random() - 0.5) * 1.6);
    dyn.wx[i] = (Math.random() - 0.5) * 10; dyn.wz[i] = (Math.random() - 0.5) * 10;
    this.onPay(i, dyn.db.px[i], dyn.db.py[i], dyn.db.pz[i]);
  }
  fillRatio() { return clamp(this.fullness + (this.dyn ? this.dyn.totalJar / JAR_CAP : 0), 0, 1.2); }
}
const _up = new THREE.Vector3(), _yAx = new THREE.Vector3(0, 1, 0), _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _ONE = new THREE.Vector3(1, 1, 1), _UP = new THREE.Vector3(), _Q = new THREE.Quaternion();
