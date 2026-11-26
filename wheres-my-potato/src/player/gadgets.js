import * as THREE from 'three';
import { ST } from '../world/dynpotatoes.js';
import { BIN } from '../world/machine.js';
import { ground } from '../world/field.js';
import { audio } from '../audio/audio.js';
import { clamp } from '../core/util.js';

// =====================================================================================
// GADGETS: the potato VACUUM (cone suction, visible glass tank, vortex) and the potato
// CANNON (real ballistic shots, live trajectory preview that turns green on the bin).
// =====================================================================================
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _d = new THREE.Vector3();

export function makeVacuum(M) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0xffb81c, roughness: 0.35, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.5, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfefff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false });
  const glow = new THREE.MeshStandardMaterial({ color: 0x002020, emissive: 0x30fff0, emissiveIntensity: 2.2 });
  const motor = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 6, 16).rotateX(Math.PI / 2), body); motor.position.set(0, 0, 0.05); g.add(motor);
  for (let k = 0; k < 5; k++) { const fin = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.006, 6, 20), dark); fin.position.z = 0.02 + k * 0.03; g.add(fin); }
  const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.08, 4, 10), dark); grip.position.set(0, -0.1, 0.09); grip.rotation.x = 0.3; g.add(grip);
  const trig = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: 0xd02020 })); trig.position.set(0, -0.06, 0.05); g.add(trig);
  // tapered nozzle tube with ribbed hose rings
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.42, 18, 1, true).rotateX(Math.PI / 2), body); tube.position.z = -0.24; g.add(tube);
  for (let k = 0; k < 6; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.036 + k * 0.0022, 0.005, 6, 18), dark); r.position.z = -0.1 - k * 0.06; g.add(r); }
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.035, 0.08, 20, 1, true).rotateX(Math.PI / 2), dark); mouth.position.z = -0.47; g.add(mouth);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 8, 28), glow); ring.position.z = -0.51; g.add(ring);
  // glass tank on top (potatoes visible inside) + spinning fan
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 24, 1, true), glass); tank.rotation.x = Math.PI / 2; tank.position.set(0, 0.11, 0.04); tank.renderOrder = 12; g.add(tank);
  for (const z of [-0.06, 0.14]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 24).rotateX(Math.PI / 2), dark); cap.position.set(0, 0.11, z); g.add(cap); }
  const fan = new THREE.Group(); fan.position.set(0, 0.11, -0.05); for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.004), dark); b.position.y = 0.03; const p = new THREE.Group(); p.rotation.z = k * Math.PI / 2; p.add(b); fan.add(p); } g.add(fan);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), glow); led.position.set(0.06, 0.03, 0.12); g.add(led);
  g.userData = { ring, fan, led, tankCenter: new THREE.Vector3(0, 0.11, 0.04), mouth: new THREE.Vector3(0, 0, -0.52) };
  g.traverse(o => (o.castShadow = false));
  return g;
}
export function makeCannon(M) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x6a7480, roughness: 0.3, metalness: 0.9 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd8261c, roughness: 0.3, metalness: 0.3 });
  const wood = M.woodDark, brass = M.brass;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.62, 22, 1, true).rotateX(Math.PI / 2), metal); barrel.position.z = -0.25; g.add(barrel);
  const bore = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), new THREE.MeshStandardMaterial({ color: 0x050505 })); bore.position.z = -0.559; bore.rotation.y = Math.PI; g.add(bore);
  for (const z of [-0.54, -0.3, -0.02]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.012, 8, 24), brass); band.position.z = z; g.add(band); }
  const chamber = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14), metal); chamber.scale.z = 1.3; chamber.position.z = 0.08; g.add(chamber);
  const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.2, 6, 14).rotateX(Math.PI / 2), red); tank.position.set(0, -0.11, -0.12); g.add(tank);
  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.015, 20).rotateX(Math.PI / 2), M.paintCream); gauge.position.set(0.07, 0.06, 0.04); gauge.rotation.y = -0.6; g.add(gauge);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.024, 0.002), red); needle.position.set(0.075, 0.06, 0.035); needle.rotation.y = -0.6; g.add(needle);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.26), wood); stock.position.set(0, -0.04, 0.26); stock.rotation.x = 0.12; g.add(stock);
  const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.08, 4, 10), wood); grip.position.set(0, -0.1, 0.12); grip.rotation.x = 0.35; g.add(grip);
  const valve = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 16), red); valve.position.set(-0.075, 0.03, 0.06); valve.rotation.y = Math.PI / 2; g.add(valve);
  g.userData = { needle, muzzle: new THREE.Vector3(0, 0, -0.58) };
  g.traverse(o => (o.castShadow = false));
  return g;
}

export class Gadgets {
  constructor(player) {
    this.p = player; const g = player.g;
    this.vac = makeVacuum(g.M); this.can = makeCannon(g.M);
    this.vac.visible = this.can.visible = false; player.vm.add(this.vac, this.can);
    this.suckT = 0; this.fireT = 0; this.recoil = 0; this.spin = 0; this.sucking = 0;
    // trajectory preview dots (world space)
    this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }), 48);
    this.dots.frustumCulled = false; this.dots.count = 0; this.dots.renderOrder = 15; g.scene.add(this.dots);
    this.dotCol = new THREE.Color();
  }
  tankCap() { return this.p.g.val('vacuum', 'cap') || 0; }
  mouthWorld(out) { return this.vac.localToWorld(out.copy(this.vac.userData.mouth)); }
  muzzleWorld(out) { return this.can.localToWorld(out.copy(this.can.userData.muzzle)); }
  // k-th potato inside the vacuum glass tank (a little jumbled column)
  tankSlot(k, out) {
    const c = this.vac.userData.tankCenter, n = 7, ring = k % n, layer = Math.floor(k / n) % 5;
    const a = ring / n * Math.PI * 2 + layer * 0.5 + this.spin * 0.2;
    out.set(c.x + Math.cos(a) * 0.04 * (ring ? 1 : 0), c.y + Math.sin(a) * 0.04 * (ring ? 1 : 0), c.z - 0.07 + layer * 0.035);
    return this.vac.localToWorld(out);
  }

  // ---------------- vacuum ----------------
  vacuum(dt, use) {
    const P = this.p, g = P.g; this.suckT -= dt;
    this.sucking = Math.max(0, this.sucking - dt * 3);
    if (P.tank.length >= this.tankCap()) { if (!P.prompt) P.prompt = `🌀 Réservoir plein (${P.tank.length}) — va au bac !`; return; }
    if (!P.prompt) P.prompt = '🌀 Aspirer (maintenir)';
    if (!use) return;
    this.sucking = 1;
    const range = g.val('vacuum', 'range'), rate = g.val('vacuum', 'rate');
    const cam = P.cam, fwd = cam.getWorldDirection(_d);
    // vortex particles converging on the nozzle
    const mouth = this.mouthWorld(_v2);
    for (let k = 0; k < 3; k++) {
      const s = 0.8 + Math.random() * range * 0.7, a = Math.random() * Math.PI * 2, r = Math.random() * s * 0.35;
      const px = mouth.x + fwd.x * s + Math.cos(a) * r, py = Math.max(ground(mouth.x + fwd.x * s, mouth.z + fwd.z * s) + 0.05, mouth.y + fwd.y * s + Math.sin(a) * r * 0.6), pz = mouth.z + fwd.z * s + Math.sin(a) * r;
      const t = 0.35; g.fx.soft.emit(px, py, pz, (mouth.x - px) / t, (mouth.y - py) / t, (mouth.z - pz) / t, t, 0.05, -0.6, 0, 0, 0.75, 0.7, 0.6, 0.35);
    }
    if (this.suckT > 0) return;
    this.suckT = 1 / rate;
    // candidates in a cone along the view direction
    const cx = cam.position.x + fwd.x * range * 0.5, cz = cam.position.z + fwd.z * range * 0.5;
    const ids = g.field.field.query(cx, cz, range * 0.6, P._q2 || (P._q2 = []));
    let best = -1, bd = 1e9; const db = g.field.db;
    for (const i of ids) {
      _v.set(db.px[i] - cam.position.x, db.py[i] - cam.position.y, db.pz[i] - cam.position.z); const d = _v.length();
      if (d > range + 1.6) continue; const dot = _v.dot(fwd) / d; if (dot < 0.86) continue;
      const score = d * (1.6 - dot); if (score < bd) { bd = score; best = i; }
    }
    if (best < 0) return;
    const i = g.dyn.spawnFrom(db, best); if (i < 0) return;
    g.ach?.collect(db.variety[best], db.special[best]);
    const gold = db.variety[best] === 5;
    g.fx.dirt(db.px[best], db.py[best], db.pz[best], 4, 0.6);
    g.field.take(best); g.stats.picked++;
    if (gold) { g.stats.gold++; g.ui.toast('✨ Patate DORÉE aspirée !', 'gold'); g.say('gold'); }
    const k = P.tank.length; P.tank.push(i); g.dyn.vscale[i] = 0.32;
    const dist = Math.sqrt(bd);
    g.dyn.fly(i, out => this.mouthWorld(out), clamp(dist * 0.09, 0.18, 0.55), 0.05, id => { g.dyn.fly(id, out => this.tankSlot(k, out), 0.08, 0, j => g.dyn.hold(j, ST.BUCKET)); });
    audio.pickup(null, 1.5 + Math.random() * 0.3); g.onPick?.();
  }

  // ---------------- cannon ----------------
  cannon(dt, use) {
    const P = this.p, g = P.g; this.fireT -= dt; this.recoil = Math.max(0, this.recoil - dt * 6);
    const ammo = P.tank.length + P.bucket.length + P.hands.length;
    const power = g.val('cannon', 'power'), rate = g.val('cannon', 'rate');
    // live trajectory preview
    const fwd = P.cam.getWorldDirection(_d).clone(), m = this.muzzleWorld(new THREE.Vector3());
    const vel = fwd.multiplyScalar(power).add(new THREE.Vector3(0, power * 0.18, 0));
    let hitBin = false, n = 0; const p = m.clone(), v = vel.clone(), mt = new THREE.Matrix4();
    for (let s = 0; s < 140 && n < 48; s++) {
      const h = 0.025; v.y -= 9.81 * h; p.addScaledVector(v, h);
      if (v.y < 0 && Math.abs(p.x - BIN.x) < BIN.w / 2 - 0.1 && Math.abs(p.z - BIN.z) < BIN.d / 2 - 0.1 && p.y < BIN.h + 0.05 && p.y > 0.15) { hitBin = true; break; }
      if (Math.abs(p.x - BIN.x) < BIN.w / 2 + 0.1 && Math.abs(p.z - BIN.z) < BIN.d / 2 + 0.1 && p.y < BIN.h + 0.06) break; // clips the rim
      if (p.y < ground(p.x, p.z)) break;
      if (s % 3 === 0) { const sc = 1 - n / 60; mt.makeScale(sc, sc, sc).setPosition(p); this.dots.setMatrixAt(n++, mt); }
    }
    this.dots.count = ammo ? n : 0; this.dots.instanceMatrix.needsUpdate = true;
    this.dots.material.color.set(hitBin ? 0x4dff6a : 0xffb84a);
    this.hitBin = hitBin;
    if (!P.prompt) P.prompt = ammo ? (hitBin ? `🎯 Dans le bac ! Tirer (${ammo})` : `💥 Tirer (${ammo} munitions)`) : '💥 Plus de munitions — ramasse des patates (mains, seau, aspirateur)';
    if (!use || !ammo || this.fireT > 0) return;
    this.fireT = 1 / rate;
    const shots = g.level('cannon') >= 2 ? 2 : 1;
    for (let s = 0; s < shots; s++) {
      const list = P.tank.length ? P.tank : P.bucket.length ? P.bucket : P.hands; const i = list.pop(); if (i === undefined) break;
      g.dyn.setPose(i, m.x, m.y, m.z); g.dyn.vscale[i] = 1;
      const spread = s ? 0.6 : 0.15;
      g.dyn.setFree(i, vel.x + (Math.random() - 0.5) * spread, vel.y + (Math.random() - 0.5) * spread, vel.z + (Math.random() - 0.5) * spread);
      g.dyn.wx[i] = (Math.random() - 0.5) * 40; g.dyn.wy[i] = (Math.random() - 0.5) * 40; g.dyn.wz[i] = (Math.random() - 0.5) * 40;
      g.dyn.age[i] = 0; g.coop?.onShot(m, vel, g.dyn.db.variety[i]);
    }
    this.recoil = 1; g.shake(0.12); g.stats.shots = (g.stats.shots || 0) + 1;
    for (let k = 0; k < 10; k++) g.fx.soft.emit(m.x, m.y, m.z, fwd.x * (1 + Math.random() * 2) + (Math.random() - 0.5), fwd.y * 2 + Math.random(), fwd.z * (1 + Math.random() * 2) + (Math.random() - 0.5), 0.9 + Math.random() * 0.6, 0.12, 4, -0.2, 2.5, 0.85, 0.85, 0.85, 0.45);
    g.fx.sparkle(m.x, m.y, m.z, 6, [1, 0.7, 0.3], 2);
    audio.cannon(m);
  }

  // ---------------- viewmodel animation ----------------
  animate(dt, tool, arms, sw, swY, lagX, lagY, swap) {
    const [L, R] = arms;
    this.vac.visible = tool === 'vacuum'; this.can.visible = tool === 'cannon';
    if (tool !== 'cannon') this.dots.count = 0;
    if (tool === 'vacuum') {
      const shake = this.sucking ? (Math.random() - 0.5) * 0.006 : 0;
      this.vac.position.set(0.18 + lagX + sw + shake, -0.22 + swY + lagY - swap + shake, -0.42);
      this.vac.rotation.set(0.04 - lagY * 0.5, -0.06, sw * 2);
      this.spin += dt * (this.sucking ? 40 : 2); this.vac.userData.fan.rotation.z = this.spin;
      this.vac.userData.ring.material.emissiveIntensity = 1.2 + this.sucking * 3 + Math.sin(this.spin * 0.3) * 0.3;
      R.target.copy(this.vac.position).add(_v.set(0, -0.1, 0.1)); L.target.copy(this.vac.position).add(_v.set(-0.1, -0.02, -0.22));
    } else if (tool === 'cannon') {
      const r = this.recoil;
      this.can.position.set(0.16 + lagX + sw, -0.2 + swY + lagY - swap + r * 0.03, -0.4 + r * 0.09);
      this.can.rotation.set(0.05 + r * 0.25 - lagY * 0.5, -0.05, sw * 2);
      this.can.userData.needle.rotation.z = -0.8 + (1 - Math.min(1, this.fireT * 6)) * 1.6;
      R.target.copy(this.can.position).add(_v.set(0, -0.12, 0.13)); L.target.copy(this.can.position).add(_v.set(-0.05, -0.06, -0.25));
    }
  }
}
