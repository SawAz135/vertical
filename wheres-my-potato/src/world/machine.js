import * as THREE from 'three';
import { boxGeo, Batcher } from './build.js';
import { ST } from './dynpotatoes.js';
import { canvasTex, textCanvas } from '../gfx/textures.js';
import { TAU, clamp } from '../core/util.js';

// =====================================================================================
// THE MACHINE: wooden bin → paddle wheel → inclined conveyor → giant glass jar.
// The jar is a real physical container (see dynpotatoes.js jar constraints): potatoes
// pile up inside, the mound rises, and once it passes the rim they spill and roll out.
// =====================================================================================
export const BIN = { x: 2, z: 21.5, w: 1.7, d: 1.7, h: 0.85, t: 0.08, floor: 0.12 };
export const JAR = { x: 9.6, z: 21.5, R: 1.15, th: 0.07, y0: 0, yb: 0.16, rim: 2.7 };
const S = new THREE.Vector3(3.15, 1.02, 21.5), E = new THREE.Vector3(JAR.x, 3.5, 21.5);

export class Machine {
  constructor(scene, M, world) {
    this.scene = scene; this.M = M; this.world = world;
    this.dir = E.clone().sub(S); this.len = this.dir.length(); this.dir.normalize();
    this.speed = 1.2; this.feedEvery = 0.55; this.feedT = 0; this.wheelA = 0; this.cleatOff = 0;
    this.boxes = []; this.colliders = [];
    this.queue = 0;
    this._bin(); this._conveyor(); this._jar(); this._lights();
    const self = this;
    this.belt = {
      get speed() { return self.speed; }, len: this.len, dirX: this.dir.x, dirZ: this.dir.z,
      pos(s, lat, out) { return out.copy(S).addScaledVector(self.dir, s).add(_side.set(0, 0, lat)).add(_up.set(-self.dir.y, self.dir.x, 0).multiplyScalar(0.06)); },
      exit(i) { self._exit(i); },
    };
    this.onPay = () => {}; this.onFeed = () => {};
  }
  inBin(x, y, z) { return Math.abs(x - BIN.x) < BIN.w / 2 && Math.abs(z - BIN.z) < BIN.d / 2 && y < BIN.h + 0.4; }
  binTarget(r, out) { return out.set(BIN.x + (r() - 0.5) * 1.0, BIN.h + 0.25, BIN.z + (r() - 0.5) * 1.0); }

  // ---------- bin + paddle wheel ----------
  _bin() {
    const M = this.M, g = new THREE.Group(), b = BIN, B = new Batcher();
    const add = (w, h, d, x, y, z, mat = M.crate) => { const m = new THREE.Mesh(boxGeo(w, h, d, mat.userData.tile), mat); m.position.set(b.x + x, y, b.z + z); m.castShadow = m.receiveShadow = true; B.addMesh(m); this.boxes.push({ min: new THREE.Vector3(b.x + x - w / 2, y - h / 2, b.z + z - d / 2), max: new THREE.Vector3(b.x + x + w / 2, y + h / 2, b.z + z + d / 2), kind: 'wood' }); };
    add(b.w + 0.2, b.floor, b.d + 0.2, 0, b.floor / 2, 0);
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

  // ---------- inclined conveyor ----------
  _conveyor() {
    const M = this.M, B = new Batcher();
    const mid = S.clone().add(E).multiplyScalar(0.5), ang = Math.atan2(this.dir.y, this.dir.x);
    const frame = new THREE.Group(); frame.position.copy(mid); frame.rotation.z = ang;
    const L = this.len + 0.6;
    // belt (scrolling texture)
    const tex = M.rubber.map.clone(); tex.repeat.set(L / 0.5, 0.6 / 0.5); tex.needsUpdate = true; this.beltTex = tex;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(L, 0.05, 0.62), new THREE.MeshStandardMaterial({ map: tex, color: 0x333333, roughness: 0.75 }));
    belt.receiveShadow = true; belt.castShadow = true; frame.add(belt);
    this.scene.add(frame); this.frame = frame;
    // side rails (static)
    const rails = new THREE.Group(); rails.position.copy(mid); rails.rotation.z = ang;
    for (const sz of [-1, 1]) {
      const r1 = new THREE.Mesh(boxGeo(L, 0.22, 0.05, 1), M.paintGreen); r1.position.set(0, 0.06, sz * 0.34); r1.castShadow = true; rails.add(r1);
      const lip = new THREE.Mesh(boxGeo(L, 0.03, 0.12, 1), M.metal); lip.position.set(0, 0.18, sz * 0.31); rails.add(lip);
    }
    for (let x = -L / 2 + 0.2; x < L / 2; x += 0.45) { const rl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.64, 10).rotateX(Math.PI / 2), M.chrome); rl.position.set(x, -0.06, 0); rails.add(rl); }
    // motor housing with pulley at the top end + chute over the jar
    const motor = new THREE.Mesh(boxGeo(0.55, 0.45, 0.5, 1), M.paintYellow); motor.position.set(L / 2 - 0.1, -0.05, 0.6); motor.castShadow = true; rails.add(motor);
    const chute = new THREE.Mesh(boxGeo(0.5, 0.04, 0.7, 1), M.metal); chute.position.set(L / 2 + 0.25, -0.1, 0); chute.rotation.z = -0.9; rails.add(chute);
    B.addTree(rails, { cast: true });
    // legs from the ground up to the frame
    for (let s = 0.4; s < this.len - 0.3; s += 1.6) {
      const p = S.clone().addScaledVector(this.dir, s);
      for (const sz of [-1, 1]) {
        const h = p.y - 0.1; const leg = new THREE.Mesh(boxGeo(0.08, h, 0.08, 1), M.paintGreen); leg.position.set(p.x, h / 2, p.z + sz * 0.36); leg.castShadow = true; B.addMesh(leg);
        this.colliders.push({ x: p.x, z: p.z + sz * 0.36, r: 0.12 });
      }
      const brace = new THREE.Mesh(boxGeo(0.05, 0.05, 0.75, 1), M.paintGreen); brace.position.set(p.x, (p.y - 0.1) * 0.45, p.z); B.addMesh(brace);
    }
    B.build(this.scene);
    // moving cleats on the belt (instanced)
    this.cleatGap = 0.55; const n = Math.ceil(this.len / this.cleatGap) + 1;
    this.cleats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.05, 0.58), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6 }), n);
    this.cleats.castShadow = true; this.cleats.frustumCulled = false; this.scene.add(this.cleats);
    // pulley drum (spins)
    this.drum = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.64, 16).rotateX(Math.PI / 2), M.chrome);
    this.drum.position.copy(E).addScaledVector(this.dir, 0.25); this.scene.add(this.drum);
  }

  // ---------- giant glass jar ----------
  _jar() {
    const J = JAR, M = this.M;
    // lathe profile: outer wall, rounded bottom, thick rolled lip, inner wall
    const o = J.R + J.th, pts = [];
    pts.push([0, J.y0]); for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI / 2; pts.push([o - 0.18 + Math.sin(a) * 0.18, J.y0 + 0.18 - Math.cos(a) * 0.18]); }
    pts.push([o, J.rim - 0.25], [o + 0.05, J.rim - 0.12], [o + 0.04, J.rim], [J.R + J.th * 0.5, J.rim + 0.03], [J.R, J.rim]);
    for (let k = 6; k >= 0; k--) { const a = k / 6 * Math.PI / 2; pts.push([J.R - 0.14 + Math.sin(a) * 0.14, J.yb + 0.14 - Math.cos(a) * 0.14]); }
    pts.push([0, J.yb]);
    const geo = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 64);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xe8f6ff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2.2, clearcoat: 1, clearcoatRoughness: 0.05, specularIntensity: 1 });
    glass.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      float fres = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0,0.0,1.0))), 3.0);
      gl_FragColor.a = clamp(gl_FragColor.a + fres*0.55, 0.0, 0.9);
      gl_FragColor.rgb += vec3(0.65,0.8,0.9)*fres*0.35;`);
    };
    const jar = new THREE.Mesh(geo, glass); jar.position.set(J.x, 0, J.z); jar.renderOrder = 10; this.scene.add(jar); this.jarMesh = jar;
    // graduations painted on the glass + live counter label
    this.gradTex = canvasTex(textCanvas(1024, 512, () => {}), true);
    const grad = new THREE.Mesh(new THREE.CylinderGeometry(o + 0.003, o + 0.003, J.rim - 0.35, 64, 1, true, -0.55, 1.1), new THREE.MeshBasicMaterial({ map: this.gradTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    grad.position.set(J.x, (J.rim - 0.35) / 2 + 0.2, J.z); grad.rotation.y = -Math.PI / 2; grad.renderOrder = 11; this.scene.add(grad);
    this._drawGrad();
    // wooden plinth ring + brass band below the lip
    const ring = new THREE.Mesh(new THREE.TorusGeometry(o + 0.06, 0.06, 10, 64).rotateX(Math.PI / 2), M.brass); ring.position.set(J.x, J.rim - 0.32, J.z); this.scene.add(ring);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(o + 0.3, o + 0.42, 0.12, 40), M.woodDark); plinth.position.set(J.x, -0.03, J.z); plinth.receiveShadow = true; this.scene.add(plinth);
    // signboard with the total
    this.labelCanvas = textCanvas(512, 256, () => {}); this.labelTex = canvasTex(this.labelCanvas, true);
    const board = new THREE.Group(); board.position.set(J.x - 1.9, 0, J.z - 1.6); board.rotation.y = 0.65;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.65), new THREE.MeshStandardMaterial({ map: this.labelTex, roughness: 0.7 })); pl.position.y = 1.7; pl.rotation.y = Math.PI; board.add(pl);
    const back = new THREE.Mesh(boxGeo(1.4, 0.75, 0.05, 1), M.woodDark); back.position.set(0, 1.7, 0.03); back.castShadow = true; board.add(back);
    for (const sx of [-0.55, 0.55]) { const p = new THREE.Mesh(boxGeo(0.07, 1.4, 0.07, 1), M.woodDark); p.position.set(sx, 0.7, 0.05); p.castShadow = true; board.add(p); }
    this.scene.add(board);
    this.setCount(0);
    this.colliders.push({ x: J.x, z: J.z, r: o + 0.2 }, { x: board.position.x, z: board.position.z, r: 0.4 });
  }
  _drawGrad() {
    const c = this.gradTex.image, x = c.getContext('2d'), J = JAR, w = c.width, h = c.height;
    x.clearRect(0, 0, w, h);
    // capacity estimate per metre of height: area * packing / mean potato volume
    const perM = Math.PI * J.R * J.R * 0.6 / ((4 / 3) * Math.PI * Math.pow(0.058, 3));
    const H = J.rim - 0.35, y0px = h;
    x.strokeStyle = 'rgba(255,255,255,0.75)'; x.fillStyle = 'rgba(255,255,255,0.85)'; x.font = '700 30px Georgia'; x.textAlign = 'left';
    for (let m = 0.1; m <= H + 0.001; m += 0.1) {
      const py = y0px - (m - 0.05) / H * h; const major = Math.round(m * 10) % 5 === 0;
      x.lineWidth = major ? 5 : 3; x.beginPath(); x.moveTo(w / 2 - (major ? 70 : 40), py); x.lineTo(w / 2, py); x.stroke();
      if (major) x.fillText(String(Math.round(perM * m / 100) * 100), w / 2 + 12, py + 10);
    }
    this.gradTex.needsUpdate = true;
  }
  setCount(n) {
    if (n === this._lastCount) return; this._lastCount = n;
    const x = this.labelCanvas.getContext('2d'), w = 512, h = 256;
    x.fillStyle = '#f0e2c0'; x.fillRect(0, 0, w, h); x.strokeStyle = '#6b3a1a'; x.lineWidth = 12; x.strokeRect(8, 8, w - 16, h - 16);
    x.fillStyle = '#6b3a1a'; x.textAlign = 'center'; x.font = '900 40px Georgia'; x.fillText('LE BOCAL GÉANT', w / 2, 62);
    x.font = '900 92px Georgia'; x.fillStyle = '#a1401c'; x.fillText(n.toLocaleString('fr-FR'), w / 2, 160);
    x.font = 'italic 700 30px Georgia'; x.fillStyle = '#6b3a1a'; x.fillText('patates récoltées', w / 2, 210);
    this.labelTex.needsUpdate = true;
  }
  _lights() {
    // warm spotlight on the jar so the glass sparkles
    const sp = new THREE.SpotLight(0xfff0d0, 25, 14, 0.5, 0.6, 1.5); sp.position.set(JAR.x - 3, 6.5, JAR.z - 3); sp.target.position.set(JAR.x, 1.2, JAR.z);
    this.scene.add(sp, sp.target);
  }

  // ---------- runtime ----------
  update(dt, dyn, t) {
    // feeder: paddle wheel lifts one potato from the bin onto the belt at a time
    this.feedT += dt;
    const inBin = [];
    for (const i of dyn.live) if (dyn.st[i] === ST.FREE && this.inBin(dyn.db.px[i], dyn.db.py[i], dyn.db.pz[i])) inBin.push(i);
    this.queue = inBin.length;
    const spinning = inBin.length > 0;
    this.wheelA += dt * (spinning ? TAU / (this.feedEvery * 6) : 0.4);
    this.wheel.rotation.z = -this.wheelA;
    if (this.feedT >= this.feedEvery && inBin.length) {
      this.feedT = 0;
      // the potato nearest the wheel goes first
      let best = inBin[0], bd = 1e9; for (const i of inBin) { const d = Math.abs(dyn.db.px[i] - (BIN.x + BIN.w / 2)); if (d < bd) { bd = d; best = i; } }
      const lat = (Math.random() - 0.5) * 0.34;
      const target = S.clone().add(new THREE.Vector3(0, 0.1, lat));
      dyn.fly(best, target, 0.42, 0.55, i => { dyn.st[i] = ST.BELT; dyn.t[i] = 0; dyn.aux[i] = lat; });
      this.onFeed(best);
    } else if (!inBin.length) this.feedT = Math.min(this.feedT, this.feedEvery);
    // belt + cleats + drum
    this.cleatOff = (this.cleatOff + dt * this.speed) % this.cleatGap;
    this.beltTex.offset.x = -this.cleatOff / 0.5 * 1;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(this.dir.y, this.dir.x));
    const p = new THREE.Vector3(), up = new THREE.Vector3(-this.dir.y, this.dir.x, 0).multiplyScalar(0.05), one = new THREE.Vector3(1, 1, 1);
    for (let k = 0; k < this.cleats.count; k++) {
      const s = k * this.cleatGap + this.cleatOff; if (s > this.len) { m.makeScale(0, 0, 0); this.cleats.setMatrixAt(k, m); continue; }
      p.copy(S).addScaledVector(this.dir, s).add(up); m.compose(p, q, one); this.cleats.setMatrixAt(k, m);
    }
    this.cleats.instanceMatrix.needsUpdate = true;
    this.drum.rotation.z -= dt * this.speed / 0.1;
    void t;
  }
  _exit(i) {
    const dyn = this.dyn;
    dyn.setFree(i, this.dir.x * this.speed * 0.8 + (Math.random() - 0.5) * 0.3, this.dir.y * this.speed * 0.4, (Math.random() - 0.5) * 0.3);
    dyn.wx[i] = (Math.random() - 0.5) * 10; dyn.wz[i] = (Math.random() - 0.5) * 10;
    this.onPay(i, dyn.db.px[i], dyn.db.py[i], dyn.db.pz[i]);
  }
  // the jar is "overflowing" when the mound reaches the rim
  fillRatio(dyn) { const perM = Math.PI * JAR.R * JAR.R * 0.6 / ((4 / 3) * Math.PI * Math.pow(0.058, 3)); return clamp(dyn.totalJar / (perM * (JAR.rim - JAR.yb)), 0, 1.2); }
}
const _side = new THREE.Vector3(), _up = new THREE.Vector3();

