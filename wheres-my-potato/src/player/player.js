import * as THREE from 'three';
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { clamp, damp, lerp } from '../core/util.js';
import { ground, inField } from '../world/field.js';
import { ST } from '../world/dynpotatoes.js';
import { BIN } from '../world/machine.js';
import { SHOP, makeBucket, makeGlove } from '../world/shop.js';
import { audio } from '../audio/audio.js';

// =====================================================================================
// FIRST-PERSON PLAYER
// Movement: walk / sprint / crouch / jump with acceleration, air control, coyote time,
// step-based footsteps (surface aware), footprints and dust, collisions vs the world.
// Camera: head bob, landing dip, strafe roll, sprint FOV kick, look sway.
// Viewmodel: two arms solved with 2-bone IK toward animated hand targets, gloves,
// and the bucket hanging from the right hand; carried potatoes sit in the hands/bucket.
// =====================================================================================
const EYE = 1.66, EYE_C = 1.12, R = 0.3, VM_BUCKET = 0.6;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _ray = new THREE.Ray();

export class Player {
  constructor(game, camera) {
    this.g = game; this.cam = camera;
    this.pos = new THREE.Vector3(-1, 0, 17.5); this.vel = new THREE.Vector3();
    this.yaw = Math.PI * 0.92; this.pitch = -0.12; this.onGround = true; this.coyote = 0; this.crouch = 0; this.sprinting = false;
    this.stepPhase = 0; this.stepDist = 0; this.leftFoot = false; this.bob = 0; this.landDip = 0; this.roll = 0; this.fovKick = 0;
    this.lookLagX = 0; this.lookLagY = 0; this.airTime = 0;
    this.hands = []; this.bucket = []; this.tool = 'hands';
    this.pickT = 0; this.dumpT = 0; this.anim = { scoop: 0, dump: 0, reach: 0, throw: 0, swap: 0 };
    this.prompt = ''; this.aim = new THREE.Vector3(); this.aimOK = false; this.hoverId = -1;
    this.enabled = false;
    this._viewmodel();
  }
  get up() { return this.g.up; }
  handCap() { return this.g.val('gloves', 'cap'); }
  bucketCap() { return this.g.val('bucket', 'cap'); }
  carried() { return this.hands.length + this.bucket.length; }

  // ---------------- viewmodel ----------------
  _viewmodel() {
    const M = this.g.M, vm = this.vm = new THREE.Group(); this.cam.add(vm);
    const sleeve = new THREE.MeshStandardMaterial({ map: M.plaid.map, normalMap: M.plaid.normalMap, color: 0x4a6a9a, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb87a58, roughness: 0.62 });
    this.arms = [-1, 1].map(side => {
      const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.28, 4, 12), sleeve), fo = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.26, 4, 12), sleeve);
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.009, 6, 14), sleeve); cuff.geometry.rotateX(Math.PI / 2);
      const hand = new THREE.Group();
      const bare = new THREE.Group();
      // rounded palm + 4 two-segment fingers curled around + thumb
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), skin); palm.scale.set(0.95, 0.42, 1.1); palm.position.z = -0.025; bare.add(palm);
      const knuckle = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.055, 4, 8), skin); knuckle.rotation.z = Math.PI / 2; knuckle.position.set(0, 0.002, -0.068); bare.add(knuckle);
      for (let f = 0; f < 4; f++) {
        const fx = -0.027 + f * 0.018, len = [0.032, 0.036, 0.034, 0.027][f];
        const p1 = new THREE.Group(); p1.position.set(fx, 0, -0.072); p1.rotation.x = -0.55; bare.add(p1);
        const s1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, len, 3, 8), skin); s1.rotation.x = Math.PI / 2; s1.position.z = -len / 2; p1.add(s1);
        const p2 = new THREE.Group(); p2.position.z = -len; p2.rotation.x = -0.6; p1.add(p2);
        const s2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0078, len * 0.75, 3, 8), skin); s2.rotation.x = Math.PI / 2; s2.position.z = -len * 0.37; p2.add(s2);
        const nail = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), new THREE.MeshStandardMaterial({ color: 0xf3d2c0, roughness: 0.3 })); nail.scale.set(1, 0.4, 1.3); nail.position.set(0, 0.006, -len * 0.62); p2.add(nail);
      }
      const tb = new THREE.Group(); tb.position.set(-side * 0.04, -0.004, -0.02); tb.rotation.set(-0.3, side * 0.6, side * 0.9); bare.add(tb);
      const t1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.03, 3, 8), skin); t1.rotation.x = Math.PI / 2; t1.position.z = -0.02; tb.add(t1);
      const t2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.022, 3, 8), skin); t2.rotation.x = Math.PI / 2 + 0.4; t2.position.set(0, 0, -0.05); tb.add(t2);
      const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.03, 4, 10), skin); wrist.rotation.x = Math.PI / 2; wrist.position.z = 0.02; wrist.scale.x = 1.2; bare.add(wrist);
      hand.add(bare);
      const glove = makeGlove(M); glove.rotation.x = -Math.PI / 2; glove.scale.setScalar(0.95); glove.visible = false; hand.add(glove);
      
      vm.add(up, fo, cuff, hand);
      return { side, up, fo, cuff, hand, bare, glove, target: new THREE.Vector3(side * 0.25, -0.6, -0.3), shoulder: new THREE.Vector3(side * 0.24, -0.38, 0.12), elbow: new THREE.Vector3() };
    });
    this.bucketTier = -1;
  }
  _setBucketModel(tier) {
    if (tier === this.bucketTier) return; this.bucketTier = tier;
    if (this.bucketObj) this.vm.remove(this.bucketObj);
    this.bucketObj = tier > 0 ? makeBucket(this.g.M, tier) : null;
    if (this.bucketObj) { this.bucketObj.scale.setScalar(VM_BUCKET); this.bucketObj.traverse(o => (o.castShadow = false)); this.vm.add(this.bucketObj); }
  }
  // 2-bone IK in camera space
  _solveArm(a) {
    const S = a.shoulder, T = a.target, L1 = 0.31, L2 = 0.3;
    const d = _v.copy(T).sub(S); let dist = d.length(); dist = clamp(dist, 0.08, L1 + L2 - 0.005); d.normalize();
    const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1), A = Math.acos(cosA);
    const pole = _v2.set(a.side * 0.6, -1, 0.3).normalize(); const n = pole.sub(d.clone().multiplyScalar(pole.dot(d))).normalize();
    a.elbow.copy(S).addScaledVector(d, Math.cos(A) * L1).addScaledVector(n, Math.sin(A) * L1);
    const hand = S.clone().addScaledVector(d, dist);
    place(a.up, S, a.elbow); place(a.fo, a.elbow, hand);
    a.cuff.position.copy(a.elbow).lerp(hand, 0.88); a.cuff.quaternion.copy(a.fo.quaternion);
    a.hand.position.copy(hand);
  }

  // ---------------- per-frame ----------------
  update(dt, t) {
    const g = this.g, look = input.consumeLook();
    if (this.enabled) { this.yaw -= look[0]; this.pitch = clamp(this.pitch - look[1], -1.45, 1.45); }
    this.lookLagX = damp(this.lookLagX + look[0] * 0.6, 0, 8, dt); this.lookLagY = damp(this.lookLagY + look[1] * 0.6, 0, 8, dt);
    // tool switching
    if (this.enabled) {
      if (input.pressed('tool1')) this.setTool('hands');
      if (input.pressed('tool2')) this.setTool('bucket');
      if (input.pressed('toolNext') || input.pressed('toolPrev') || input.consumeWheel()) this.setTool(this.tool === 'hands' ? 'bucket' : 'hands');
    }
    this._move(dt);
    this._camera(dt, t);
    this._interact(dt);
    this._animateViewmodel(dt, t);
    this._carryPoses();
    this.g.dyn.player = { x: this.pos.x, y: this.pos.y, z: this.pos.z, vx: this.vel.x, vz: this.vel.z };
  }
  setTool(tl) {
    if (tl === 'bucket' && this.g.level('bucket') === 0) { this.g.ui.toast('Il te faut un seau — va voir Gérard à la boutique !', 'warn'); audio.ui('deny'); return; }
    if (tl === this.tool) return;
    // swapping keeps the carried potatoes: hands → bucket transfers what fits
    this.tool = tl; this.anim.swap = 1; audio.ui('click');
    if (tl === 'bucket') { while (this.hands.length && this.bucket.length < this.bucketCap()) this._transfer(this.hands.pop(), 'bucket'); }
  }
  _transfer(i, to) { const k = (to === 'bucket' ? this.bucket : this.hands).length; (to === 'bucket' ? this.bucket : this.hands).push(i); this.g.dyn.fly(i, out => this._slotPos(to, k, out), 0.25, 0.15, j => this.g.dyn.hold(j, to === 'bucket' ? ST.BUCKET : ST.HAND)); }

  _move(dt) {
    const g = this.g, boots = g.val('boots', 'speed');
    const crouchWant = this.enabled && input.down('crouch');
    this.crouch = damp(this.crouch, crouchWant ? 1 : 0, 12, dt);
    if (settings.v.sprintToggle) { if (input.pressed('sprint')) this.sprintLatch = !this.sprintLatch; } else this.sprintLatch = input.down('sprint');
    let mx = this.enabled ? input.moveX : 0, mz = this.enabled ? input.moveY : 0;
    const moving = Math.hypot(mx, mz) > 0.05;
    this.sprinting = this.sprintLatch && moving && mz > 0.2 && this.crouch < 0.5;
    const load = Math.min(0.25, this.carried() * 0.0015); // a full benne slows you a bit
    const speed = (this.sprinting ? 6.4 : 3.6) * boots * (1 - this.crouch * 0.5) * (1 - load);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const wx = (mx * cy - mz * sy) * speed, wz = (-mx * sy - mz * cy) * speed;
    const acc = this.onGround ? 14 : 3;
    this.vel.x = damp(this.vel.x, wx, acc, dt); this.vel.z = damp(this.vel.z, wz, acc, dt);
    // gravity + jump (coyote time)
    this.coyote = this.onGround ? 0.12 : Math.max(0, this.coyote - dt);
    if (this.enabled && input.pressed('jump') && this.coyote > 0) { this.vel.y = 4.6 * (boots > 1.3 ? 1.15 : 1); this.onGround = false; this.coyote = 0; audio.footstep(this.surface(), 3, null); }
    this.vel.y -= 13 * dt;
    const prevY = this.pos.y;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;
    // collisions (circles + boxes, xz)
    for (const c of g.colliders) {
      if (c.r !== undefined) {
        const dx = this.pos.x - c.x, dz = this.pos.z - c.z, d = Math.hypot(dx, dz), rr = c.r + R;
        if (d < rr && d > 1e-4) { this.pos.x = c.x + dx / d * rr; this.pos.z = c.z + dz / d * rr; }
      } else if (this.pos.y < c.max.y - 0.05) {
        const cx = clamp(this.pos.x, c.min.x, c.max.x), cz = clamp(this.pos.z, c.min.z, c.max.z), dx = this.pos.x - cx, dz = this.pos.z - cz, d = Math.hypot(dx, dz);
        if (d < R) {
          if (d > 1e-4) { this.pos.x = cx + dx / d * R; this.pos.z = cz + dz / d * R; }
          else { // inside: push out along the shallowest axis
            const pen = [this.pos.x - c.min.x, c.max.x - this.pos.x, this.pos.z - c.min.z, c.max.z - this.pos.z], m = Math.min(...pen), k = pen.indexOf(m);
            if (k === 0) this.pos.x = c.min.x - R; else if (k === 1) this.pos.x = c.max.x + R; else if (k === 2) this.pos.z = c.min.z - R; else this.pos.z = c.max.z + R;
          }
        }
      }
    }
    const B = g.bounds; this.pos.x = clamp(this.pos.x, B.x0, B.x1); this.pos.z = clamp(this.pos.z, B.z0, B.z1);
    // ground
    let gy = ground(this.pos.x, this.pos.z);
    if (Math.abs(this.pos.x - SHOP.x) < 2.6 && this.pos.z > SHOP.z - 1.1 && this.pos.z < SHOP.z + 2.3) gy = Math.max(gy, 0.14);
    const wasAir = !this.onGround;
    if (this.pos.y <= gy) {
      if (wasAir && this.airTime > 0.25) { const h = clamp(-this.vel.y / 7, 0, 1.5); this.landDip = Math.max(this.landDip, 0.12 * h); audio.land(this.surface(), h); g.fx.dust(this.pos.x, gy, this.pos.z, 8, this.dustCol()); if (h > 0.6) g.shake(0.25 * h); }
      this.pos.y = gy; this.vel.y = 0; this.onGround = true; this.airTime = 0;
    } else if (this.pos.y > gy + 0.06 || this.vel.y > 0) { this.onGround = false; this.airTime += dt; }
    else { this.pos.y = gy; }
    void prevY;
    // footsteps
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hs > 0.4) {
      const stride = this.sprinting ? 1.45 : 0.78 + (1 - this.crouch) * 0.05;
      this.stepDist += hs * dt; this.stepPhase += hs * dt / stride * Math.PI;
      if (this.stepDist >= stride) {
        this.stepDist = 0; this.leftFoot = !this.leftFoot;
        const surf = this.surface();
        audio.footstep(surf, hs * (this.crouch > 0.5 ? 0.4 : 1), null);
        if (surf === 'soil') g.fx.footprint(this.pos.x, this.pos.z, this.yaw, this.leftFoot, ground(this.pos.x, this.pos.z));
        if (surf !== 'wood') g.fx.dust(this.pos.x, this.pos.y, this.pos.z, this.sprinting ? 3 : 1, this.dustCol());
        if (g.dyn.kick(this.pos.x, this.pos.y + 0.1, this.pos.z, this.vel.x, this.vel.z) > 0) audio.footstep('potatoes', hs, null);
      }
    } else this.stepDist = Math.min(this.stepDist, 0.3);
  }
  surface() {
    const x = this.pos.x, z = this.pos.z;
    if (Math.abs(x - SHOP.x) < 2.6 && z > SHOP.z - 1.1 && z < SHOP.z + 2.3) return 'wood';
    if (inField(x, z)) return 'soil';
    if (z > 15 && z < 33 && Math.abs(x) < 16) return 'gravel';
    return 'grass';
  }
  dustCol() { const s = this.surface(); return s === 'soil' ? [0.55, 0.44, 0.32] : s === 'gravel' ? [0.62, 0.6, 0.56] : [0.5, 0.55, 0.4]; }

  _camera(dt, t) {
    const hs = Math.hypot(this.vel.x, this.vel.z), bobAmt = settings.v.headBob;
    const eye = lerp(EYE, EYE_C, this.crouch);
    this.landDip = damp(this.landDip, 0, 7, dt);
    const bobY = this.onGround ? Math.abs(Math.sin(this.stepPhase)) * 0.045 * clamp(hs / 4, 0, 1.4) * bobAmt : 0;
    const bobX = this.onGround ? Math.cos(this.stepPhase) * 0.025 * clamp(hs / 4, 0, 1.4) * bobAmt : 0;
    this.bob = bobY;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    this.cam.position.set(this.pos.x + cy * bobX, this.pos.y + eye - bobY - this.landDip, this.pos.z - sy * bobX);
    const strafe = (this.vel.x * cy - this.vel.z * sy);
    this.roll = damp(this.roll, -strafe * 0.006 * bobAmt - this.lookLagX * 0.4, 6, dt);
    const sh = this.g.shakeAmt * settings.v.cameraShake;
    this.cam.rotation.set(0, 0, 0); this.cam.rotation.order = 'YXZ';
    this.cam.rotation.y = this.yaw + (Math.random() - 0.5) * sh * 0.05;
    this.cam.rotation.x = this.pitch + (Math.random() - 0.5) * sh * 0.05;
    this.cam.rotation.z = this.roll;
    this.fovKick = damp(this.fovKick, this.sprinting ? 7 : 0, 5, dt);
    const fov = settings.v.fov + this.fovKick;
    if (Math.abs(this.cam.fov - fov) > 0.01) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
    this.cam.updateMatrixWorld(true);
  }

  // ---------------- interaction ----------------
  _aimPoint() {
    // march the view ray onto the terrain (max 5 m)
    _ray.origin.copy(this.cam.position); this.cam.getWorldDirection(_ray.direction);
    let prev = 0;
    for (let s = 0.2; s <= 5; s += 0.1) {
      _v.copy(_ray.origin).addScaledVector(_ray.direction, s);
      if (_v.y < ground(_v.x, _v.z) + 0.05) { this.aim.copy(_ray.origin).addScaledVector(_ray.direction, (s + prev) / 2); return true; }
      prev = s;
    }
    // looking forward: aim 2.2 m ahead on the ground
    this.aim.set(this.pos.x - Math.sin(this.yaw) * 2.2, 0, this.pos.z - Math.cos(this.yaw) * 2.2); this.aim.y = ground(this.aim.x, this.aim.z);
    return false;
  }
  lookingAt(p, maxD, cone = 0.85) {
    _v.copy(p).sub(this.cam.position); const d = _v.length(); if (d > maxD) return false;
    this.cam.getWorldDirection(_v2); return _v.normalize().dot(_v2) > cone;
  }
  _interact(dt) {
    const g = this.g; this.prompt = ''; this.hoverId = -1;
    if (!this.enabled) { g.field.field.showHover(-1); return; }
    this.aimOK = this._aimPoint();
    const binTop = _v.set(BIN.x, BIN.h, BIN.z);
    const nearBin = this.pos.distanceTo(binTop.setY(this.pos.y)) < 3.0 && this.lookingAt(new THREE.Vector3(BIN.x, BIN.h * 0.6, BIN.z), 3.6, 0.55);
    const nearShop = this.lookingAt(g.shop.talkPoint, 3.6, 0.6) && Math.abs(this.pos.x - SHOP.x) < 3.2 && this.pos.z < SHOP.z;
    const use = input.down('use') || input.down('interact');
    const usePressed = input.pressed('use') || input.pressed('interact');
    this.dumpT -= dt; this.pickT -= dt;
    if (nearShop) {
      this.prompt = '🗨️ Parler à Gérard';
      if (usePressed) { g.openShop(); }
      g.field.field.showHover(-1); return;
    }
    if (nearBin && this.carried() > 0) {
      this.prompt = `⬇️ Vider dans le bac (${this.carried()})`;
      if (use && this.dumpT <= 0) { this._dumpOne(); this.dumpT = this.tool === 'bucket' ? 0.035 : 0.09; this.anim.dump = 1; }
      g.field.field.showHover(-1); return;
    }
    if (nearBin) this.prompt = 'Le bac — apporte des patates !';
    // drop / throw everything
    if (input.pressed('drop') && this.carried()) this._throwAll();
    // picking
    const full = this.tool === 'bucket' ? this.bucket.length >= this.bucketCap() : this.hands.length >= this.handCap();
    if (this.tool === 'bucket') {
      const rad = g.val('magnet', 'radius');
      if (!full) {
        const cand = this._nearestField(this.aim, rad);
        this.hoverId = cand; g.field.field.showHover(cand);
        if (cand >= 0) this.prompt = this.prompt || '🪣 Ramasser au seau (maintenir)';
        if (use && this.pickT <= 0) {
          const rate = g.val('magnet', 'rate'); this.anim.scoop = 1;
          let n = Math.max(1, Math.round(rate * 0.08));
          while (n-- > 0 && this.bucket.length < this.bucketCap()) { const id = this._nearestField(this.aim, rad); if (id < 0) break; this._pickField(id, 'bucket'); }
          const loose = g.dyn.pickNear(this.aim.x, this.aim.y, this.aim.z, rad); if (loose >= 0 && this.bucket.length < this.bucketCap()) this._pickLoose(loose, 'bucket');
          this.pickT = 0.08;
        }
      } else { g.field.field.showHover(-1); this.prompt = this.prompt || `🪣 Seau plein (${this.bucket.length}) — va au bac !`; }
    } else {
      if (!full) {
        const hit = g.field.field.pick(_ray, 3.2) ; let cand = hit ? hit.id : this._nearestField(this.aim, 0.6);
        this.hoverId = cand; g.field.field.showHover(cand);
        const loose = cand < 0 ? g.dyn.pickNear(this.aim.x, this.aim.y, this.aim.z, 0.7) : -1;
        if (cand >= 0 || loose >= 0) this.prompt = this.prompt || '✋ Ramasser';
        if (use && this.pickT <= 0 && (cand >= 0 || loose >= 0)) {
          if (cand >= 0) this._pickField(cand, 'hands'); else this._pickLoose(loose, 'hands');
          this.pickT = this.g.level('gloves') >= 2 ? 0.16 : 0.26; this.anim.reach = 1;
        }
      } else { g.field.field.showHover(-1); this.prompt = this.prompt || `✋ Bras pleins (${this.hands.length}/${this.handCap()}) — va au bac !`; }
    }
  }
  _nearestField(p, r) {
    const ids = this.g.field.field.query(p.x, p.z, r, this._q || (this._q = [])); let best = -1, bd = 1e9; const d = this.g.field.db;
    for (const i of ids) { const q = (d.px[i] - p.x) ** 2 + (d.pz[i] - p.z) ** 2; if (q < bd) { bd = q; best = i; } }
    return best;
  }
  _pickField(j, to) {
    const g = this.g, fdb = g.field.db;
    const i = g.dyn.spawnFrom(fdb, j); if (i < 0) return;
    const gold = fdb.variety[j] === 5;
    g.field.take(j);
    const list = to === 'bucket' ? this.bucket : this.hands, k = list.length; list.push(i);
    g.dyn.vscale[i] = to === 'bucket' ? 0.75 * VM_BUCKET : 0.85;
    g.dyn.fly(i, out => this._slotPos(to, k, out), to === 'bucket' ? 0.32 : 0.24, to === 'bucket' ? 0.35 : 0.18, id => { g.dyn.hold(id, to === 'bucket' ? ST.BUCKET : ST.HAND); if (to === 'bucket' && Math.random() < 0.3) audio.bucketClank(null); });
    audio.pickup({ x: fdb.px[j], y: fdb.py[j], z: fdb.pz[j] }, 0.9 + Math.random() * 0.3);
    g.fx.dirt(fdb.px[j], fdb.py[j], fdb.pz[j], to === 'bucket' ? 3 : 6, 0.8);
    g.stats.picked++;
    if (gold) { g.fx.sparkle(fdb.px[j], fdb.py[j] + 0.1, fdb.pz[j], 30); g.ui.toast('✨ Patate DORÉE ! (60 ₣)', 'gold'); g.say('gold'); g.stats.gold++; }
    g.onPick?.();
  }
  _pickLoose(i, to) {
    const g = this.g; g.dyn.unsettle(i, 0, 0, 0);
    const list = to === 'bucket' ? this.bucket : this.hands, k = list.length; list.push(i);
    g.dyn.vscale[i] = to === 'bucket' ? 0.75 * VM_BUCKET : 0.85;
    g.dyn.fly(i, out => this._slotPos(to, k, out), 0.28, 0.2, id => g.dyn.hold(id, to === 'bucket' ? ST.BUCKET : ST.HAND));
    audio.pickup(null, 1.2);
  }
  _dumpOne() {
    const g = this.g; const from = this.bucket.length ? this.bucket : this.hands; const i = from.pop(); if (i === undefined) return;
    const target = new THREE.Vector3(); this.g.machine.binTarget(Math.random, target);
    g.dyn.vscale[i] = 1;
    g.dyn.fly(i, target, 0.42 + Math.random() * 0.12, 0.6 + Math.random() * 0.3, id => g.dyn.setFree(id, (Math.random() - 0.5) * 0.6, -2.5, (Math.random() - 0.5) * 0.6));
    if (Math.random() < 0.3) audio.whoosh(null);
    g.stats.dumped++;
  }
  _throwAll() {
    const g = this.g, dir = new THREE.Vector3(); this.cam.getWorldDirection(dir);
    const all = [...this.hands, ...this.bucket]; this.hands.length = 0; this.bucket.length = 0;
    all.forEach((i, k) => { const s = 3.5 + Math.random() * 2.5; g.dyn.setFree(i, dir.x * s + (Math.random() - 0.5) * 1.5 + this.vel.x, dir.y * s + 2.2 + Math.random(), dir.z * s + (Math.random() - 0.5) * 1.5 + this.vel.z); g.dyn.wx[i] = (Math.random() - 0.5) * 20; g.dyn.wz[i] = (Math.random() - 0.5) * 20; void k; });
    this.anim.throw = 1; audio.whoosh(null);
  }

  // where the k-th carried potato sits (world space), in the hands or in the bucket
  _slotPos(to, k, out) {
    if (to === 'hands') {
      const row = Math.floor(k / 3), col = k % 3;
      out.set(-0.07 + col * 0.07 + (row % 2) * 0.035, -0.2 + row * 0.055 + this.anim.reach * -0.05, -0.52 - row * 0.01);
      return this.cam.localToWorld(out);
    }
    const b = this.bucketObj; if (!b) return out.copy(this.cam.position);
    const inn = b.userData.inner, perLayer = Math.max(4, Math.round(inn.r1 * inn.r1 * 520));
    const layer = Math.floor(k / perLayer), idx = k % perLayer, rr = Math.max(0.01, (inn.r0 * 0.75) * (1 - layer * 0.08)) * (idx === 0 ? 0 : 1);
    const a = idx * 2.39996 + layer * 0.7;
    const ring = Math.sqrt(idx / perLayer) * rr * 1.25;
    out.set(Math.cos(a) * ring, 0.05 + layer * 0.055 * (this.bucketTier >= 3 ? 1 : 1.3), Math.sin(a) * ring);
    return b.localToWorld(out);
  }
  _carryPoses() {
    const dyn = this.g.dyn;
    const pose = (list, to) => list.forEach((i, k) => { if (dyn.st[i] === (to === 'bucket' ? ST.BUCKET : ST.HAND)) { this._slotPos(to, k, _v); dyn.setPose(i, _v.x, _v.y, _v.z); } });
    pose(this.hands, 'hands'); pose(this.bucket, 'bucket');
  }

  _animateViewmodel(dt, t) {
    const A = this.anim; for (const k in A) A[k] = Math.max(0, A[k] - dt * (k === 'dump' ? 5 : 3.2));
    const tier = this.tool === 'bucket' ? this.g.level('bucket') : 0;
    this._setBucketModel(tier);
    const gloves = this.g.level('gloves') > 0; this.arms.forEach(a => { a.glove.visible = gloves; a.bare.visible = !gloves; });
    const hs = Math.hypot(this.vel.x, this.vel.z), walk = clamp(hs / 4, 0, 1.4) * settings.v.headBob;
    const sw = Math.sin(this.stepPhase) * 0.02 * walk, swY = Math.abs(Math.cos(this.stepPhase)) * 0.015 * walk;
    const lagX = clamp(this.lookLagX, -0.2, 0.2) * 0.3, lagY = clamp(this.lookLagY, -0.2, 0.2) * 0.3;
    const swap = Math.sin(A.swap * Math.PI) * 0.25;
    const breathe = Math.sin(t * 1.8) * 0.004;
    const [L, Rt] = this.arms;
    if (this.tool === 'bucket' && this.bucketObj) {
      const scoop = Math.sin(A.scoop * Math.PI), dump = Math.sin(A.dump * Math.PI);
      const big = this.bucketTier >= 3;
      // right hand holds the handle; scoop = thrust forward & down, dump = raise & tip
      Rt.target.set(0.27 + lagX - (big ? 0.14 : 0), (big ? -0.3 : -0.17) + swY - scoop * 0.14 + dump * 0.1 - swap + lagY + breathe, -0.56 - scoop * 0.2 - dump * 0.12);
      L.target.set(big ? -0.18 : -0.3 + lagX, big ? -0.32 + swY - swap : -0.72, big ? -0.52 : -0.25);
      const b = this.bucketObj, inn = b.userData.inner;
      b.position.set(Rt.target.x, Rt.target.y - (big ? 0.05 : inn.h + inn.r1) * VM_BUCKET, Rt.target.z);
      b.rotation.set(0.42 - scoop * 0.9 - dump * 1.5 + sw * 2, 0.35, sw * 3 - lagX * 1.5);
    } else {
      const reach = Math.sin(A.reach * Math.PI), thr = Math.sin(A.throw * Math.PI), dump = Math.sin(A.dump * Math.PI);
      const carrying = this.hands.length > 0;
      const baseY = carrying ? -0.25 : -0.62, baseZ = carrying ? -0.5 : -0.32;
      L.target.set(-0.11 + lagX + sw, baseY + swY - swap + lagY + breathe + dump * 0.1 + thr * 0.25, baseZ - dump * 0.15 - thr * 0.25);
      Rt.target.set(0.11 + lagX + sw + reach * 0.05, baseY + swY - swap + lagY + breathe - reach * 0.3 + dump * 0.1 + thr * 0.25, baseZ - reach * 0.25 - dump * 0.15 - thr * 0.25);
      if (!carrying) { L.target.x -= 0.14; Rt.target.x += 0.14; }
    }
    for (const a of this.arms) {
      this._solveArm(a);
      // palms up when carrying, otherwise relaxed
      const cup = this.tool === 'hands' && this.hands.length > 0;
      a.hand.rotation.set(cup ? 0.15 : -0.6, a.side * (cup ? -0.25 : 0.2), a.side * (cup ? 0.35 : 0.1));
      if (this.tool === 'bucket' && a === Rt) a.hand.rotation.set(0.1, 0, Math.PI / 2 * a.side);
    }
  }
}
function place(mesh, a, b) { // orient a capsule (along +y) from a to b
  _v.copy(b).sub(a); const len = _v.length(); mesh.position.copy(a).add(b).multiplyScalar(0.5);
  _q.setFromUnitVectors(_v2.set(0, 1, 0), _v.normalize()); mesh.quaternion.copy(_q); mesh.scale.set(1, len / 0.36, 1);
}
