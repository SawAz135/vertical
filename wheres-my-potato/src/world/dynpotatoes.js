import * as THREE from 'three';
import { PotatoDB, writeAttrs, R0, makePotatoMaterial } from './potatoes.js';
import { clamp, rng, TAU } from '../core/util.js';

// =====================================================================================
// DYNAMIC POTATOES
// Every potato that leaves the field lives here: flying to the hand / bucket, carried,
// thrown into the bin, riding the conveyor, falling into the giant jar, overflowing.
//
// Physics: sphere bodies (radius from the potato's real shape), gravity, restitution,
// Coulomb-like friction, rolling (ω = n×v / r), sleeping. A potato that comes to rest is
// "settled": moved to a cheap static instanced mesh and inserted in a persistent spatial
// hash, so it becomes a support for the next ones → potatoes really stack up in the jar,
// form a mound, spill over the rim and roll onto the ground.
// =====================================================================================

export const ST = { NONE: 0, FREE: 1, FLY: 2, HAND: 3, BUCKET: 4, BELT: 5, SETTLED: 6, SHRINK: 7, GROW: 8 };
const CS = 0.16; // hash cell size
export const JAR_RAD = 0.052, JAR_LAYER = 0.088;
// potatoes per metre of jar height for the packed fill (also used for the glass graduations)
export function jarPerMeter(R) { const step = JAR_RAD * 2; let n = 0; for (let gz = -R; gz <= R; gz += step * 0.866) for (let gx = -R; gx <= R; gx += step) if (Math.hypot(gx, gz) <= R - JAR_RAD) n++; return n / JAR_LAYER; }
const key = (x, y, z) => ((Math.floor(x / CS) + 2048) * 4096 + (Math.floor(z / CS) + 2048)) * 512 + (Math.floor(y / CS) + 64);

export class DynPotatoes {
  constructor(scene, { liveCap = 900, settledCap = 8000, world, onImpact, onSettleInJar }) {
    const cap = liveCap + settledCap + 64;
    this.db = new PotatoDB(cap);
    this.world = world; this.onImpact = onImpact || (() => {}); this.onSettleInJar = onSettleInJar || (() => {});
    const f = () => new Float32Array(cap);
    Object.assign(this, {
      vx: f(), vy: f(), vz: f(), wx: f(), wy: f(), wz: f(), t: f(), sleep: f(), aux: f(), age: f(),
      st: new Uint8Array(cap), lslot: new Int32Array(cap).fill(-1), sslot: new Int32Array(cap).fill(-1),
      f0x: f(), f0y: f(), f0z: f(), fdur: f(), farc: f(), fex: f(), fey: f(), fez: f(), inJar: new Uint8Array(cap), paid: new Uint8Array(cap), remote: new Uint8Array(cap), fieldId: new Int32Array(cap).fill(-1), vscale: new Float32Array(cap).fill(1),
    });
    this.flyTarget = new Map(); // id -> fn(outVec) for moving targets
    this.flyDone = new Map();   // id -> callback
    this.freeIds = [];
    this.live = []; this.settled = []; this.settledCap = settledCap; this.liveCap = liveCap;
    this.hash = new Map(); this.freeHash = new Map();
    this.mat = makePotatoMaterial({ key: 'dyn' });
    const g2 = indexedIco(2), g1 = indexedIco(1);
    this.liveMesh = makeMesh(g2, this.mat, liveCap); this.liveMesh.castShadow = true;
    this.setMesh = makeMesh(g1, this.mat, settledCap); this.setMesh.castShadow = true;
    scene.add(this.liveMesh, this.setMesh);
    this.player = null; // {x,y,z,vx,vz} feet info for pushing
    this._m = new THREE.Matrix4(); this._v = new THREE.Vector3(); this._q = new THREE.Quaternion();
    this.impactBudget = 0;
    this.totalJar = 0; this.jarTop = world.jar.yb;
  }

  // ------------- lifecycle -------------
  alloc() {
    let i = this.freeIds.length ? this.freeIds.pop() : this.db.add();
    if (i < 0) return -1;
    this.db.qw[i] = 1; this.db.marked[i] = 0; this.inJar[i] = 0; this.age[i] = 0; this.paid[i] = 0; this.remote[i] = 0; this.fieldId[i] = -1; this.vscale[i] = 1;
    return i;
  }
  // copies traits from another DB (the field) so the potato looks identical
  spawnFrom(src, j) {
    const i = this.alloc(); if (i < 0) return -1;
    const d = this.db;
    for (const k of ['px', 'py', 'pz', 'qx', 'qy', 'qz', 'qw', 'size', 'elong', 'flat', 'bend', 'lump', 'seed', 'variety', 'special', 'spots', 'spotT', 'spotP', 'spotR', 'spot2T', 'spot2P', 'dent', 'dentT', 'dentP', 'sprout', 'sprT', 'sprP']) d[k][i] = src[k][j];
    this._toLive(i);
    return i;
  }
  spawnRandom(r, x, y, z) {
    const i = this.alloc(); if (i < 0) return -1;
    this.db.randomTraits(i, r); this.db.px[i] = x; this.db.py[i] = y; this.db.pz[i] = z;
    const q = this._q.setFromEuler(new THREE.Euler(r() * TAU, r() * TAU, r() * TAU)); this.db.setQuat(i, q);
    return i;
  }
  free(i) {
    this._leave(i);
    this.st[i] = ST.NONE; this.flyTarget.delete(i); this.flyDone.delete(i);
    this.freeIds.push(i);
  }
  _toLive(i) {
    if (this.lslot[i] >= 0) return true;
    if (this.live.length >= this.liveCap) return false;
    this.lslot[i] = this.live.length; this.live.push(i);
    writeAttrs(this.db, i, this.liveMesh.userData.arrs, this.lslot[i]); this.liveMesh.userData.dirtyAttrs = true;
    return true;
  }
  _leave(i) { // remove from live or settled containers
    if (this.lslot[i] >= 0) {
      const s = this.lslot[i], last = this.live.pop();
      if (last !== i) { this.live[s] = last; this.lslot[last] = s; writeAttrs(this.db, last, this.liveMesh.userData.arrs, s); this.liveMesh.userData.dirtyAttrs = true; }
      this.lslot[i] = -1;
    }
    if (this.sslot[i] >= 0) {
      this._unhash(i);
      const s = this.sslot[i], last = this.settled.pop();
      if (last !== i) { this.settled[s] = last; this.sslot[last] = s; this._writeSettled(last); }
      this.sslot[i] = -1; this.setMesh.count = this.settled.length;
      if (this.inJar[i]) this.totalJar--;
    }
  }

  // ------------- state changes -------------
  setFree(i, vx = 0, vy = 0, vz = 0) {
    if (this.sslot[i] >= 0) this._leave(i);
    if (!this._toLive(i)) { this.free(i); return; }
    this.vscale[i] = 1; this.age[i] = 0; this.st[i] = ST.FREE; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz; this.sleep[i] = 0; this.t[i] = 0;
  }
  // fly along an arc to a fixed point or a moving target fn(out)
  fly(i, target, dur, arc, done) {
    if (this.fieldId[i] >= 0) { this.onDetach?.(this.fieldId[i]); this.fieldId[i] = -1; } // picked / fed: the sea will regrow it
    this._toLive(i);
    const d = this.db; this.st[i] = ST.FLY; this.t[i] = 0; this.fdur[i] = dur; this.farc[i] = arc;
    this.f0x[i] = d.px[i]; this.f0y[i] = d.py[i]; this.f0z[i] = d.pz[i];
    if (typeof target === 'function') this.flyTarget.set(i, target); else { this.flyTarget.delete(i); this.fex[i] = target.x; this.fey[i] = target.y; this.fez[i] = target.z; }
    if (done) this.flyDone.set(i, done); else this.flyDone.delete(i);
    this.wx[i] = (Math.random() - 0.5) * 14; this.wy[i] = (Math.random() - 0.5) * 14; this.wz[i] = (Math.random() - 0.5) * 14;
  }
  hold(i, state) { this._toLive(i); this.st[i] = state; }
  setPose(i, x, y, z, q) { const d = this.db; d.px[i] = x; d.py[i] = y; d.pz[i] = z; if (q) d.setQuat(i, q); }
  radius(i) { return this.db.radius(i); }

  settle(i) {
    // a sea potato that was only kicked around goes back into the sea once it rests
    if (this.fieldId[i] >= 0 && !this.paid[i] && this.onRestore && !this.world.inBin(this.db.px[i], this.db.py[i], this.db.pz[i]) && Math.hypot(this.db.px[i] - this.world.jar.x, this.db.pz[i] - this.world.jar.z) > this.world.jar.R + 0.5) { this.onRestore(i); return; }
    if (this.settled.length >= this.settledCap) this._evictOldest();
    if (this.settled.length >= this.settledCap) { this.free(i); return; } // budget exhausted: the potato quietly vanishes
    if (this.lslot[i] >= 0) this._leave(i);
    this.st[i] = ST.SETTLED; this.sslot[i] = this.settled.length; this.settled.push(i);
    this._writeSettled(i); writeAttrs(this.db, i, this.setMesh.userData.arrs, this.sslot[i]);
    this.setMesh.userData.dirtyAttrs = true; this.setMesh.count = this.settled.length;
    this._hash(i);
    const J = this.world.jar;
    const inJar = Math.hypot(this.db.px[i] - J.x, this.db.pz[i] - J.z) < J.R + 0.02 && this.db.py[i] < J.rim + 0.6;
    this.inJar[i] = inJar ? 1 : 0;
    if (inJar) { this.totalJar++; this.jarTop = Math.max(this.jarTop, this.db.py[i]); this.onSettleInJar(i); }
    else if (this.paid[i] && Math.hypot(this.db.px[i] - J.x, this.db.pz[i] - J.z) < J.R + 3) this.onSpill?.(i);
  }
  _evictOldest() {
    // remove the oldest potato lying OUTSIDE the jar (overflow pile on the ground), with a shrink animation
    for (let k = 0; k < this.settled.length; k++) {
      const i = this.settled[k];
      if (!this.inJar[i]) { this._leave(i); if (this._toLive(i)) { this.st[i] = ST.SHRINK; this.t[i] = 0; } else this.free(i); return; }
    }
  }
  unsettle(i, vx, vy, vz) { this._leave(i); this.setFree(i, vx, vy, vz); }

  _writeSettled(i) { this.setMesh.setMatrixAt(this.sslot[i], this.db.matrix(i, this._m)); this.setMesh.userData.dirtyMat = true; }
  _hash(i) { const k = key(this.db.px[i], this.db.py[i], this.db.pz[i]); let c = this.hash.get(k); if (!c) this.hash.set(k, c = []); c.push(i); this.aux[i] = k; }
  _unhash(i) { const c = this.hash.get(this.aux[i]); if (c) { const p = c.indexOf(i); if (p >= 0) { c[p] = c[c.length - 1]; c.pop(); } } }

  // Instantly fill the jar with n settled potatoes (used when loading a save): hexagonal layers
  // with jitter, never above the rim. Returns how many were placed.
  fillJar(n, seed) {
    const J = this.world.jar, r = rng(seed), rad = JAR_RAD, step = rad * 2, lh = JAR_LAYER;
    let y = J.yb + rad, placed = 0, layer = 0;
    while (placed < n && y < J.rim - rad * 0.5) {
      const row = step * 0.866;
      for (let gz = -J.R; gz <= J.R && placed < n; gz += row) {
        const odd = (Math.round((gz + J.R) / row) + layer) % 2;
        for (let gx = -J.R + odd * step * 0.5; gx <= J.R && placed < n; gx += step) {
          const x = gx + (r() - 0.5) * 0.025, z = gz + (r() - 0.5) * 0.025;
          if (Math.hypot(x, z) > J.R - rad) continue;
          const i = this.spawnRandom(r, J.x + x, y + (r() - 0.5) * 0.02, J.z + z); if (i < 0) return placed;
          this.settle(i); placed++;
        }
      }
      y += lh; layer++;
    }
    return placed;
  }

  // ------------- simulation -------------
  update(dt, ctx) {
    dt = Math.min(dt, 1 / 20);
    this.impactBudget = Math.min(8, this.impactBudget + dt * 30);
    const subs = dt > 1 / 45 ? 3 : 2, h = dt / subs;
    for (let s = 0; s < subs; s++) this._step(h);
    this._scripted(dt, ctx);
    this._upload();
  }
  _step(h) {
    const d = this.db, W = this.world, J = W.jar;
    // free-body hash
    const fh = this.freeHash; fh.clear();
    for (const i of this.live) if (this.st[i] === ST.FREE) { const k = key(d.px[i], d.py[i], d.pz[i]); let c = fh.get(k); if (!c) fh.set(k, c = []); c.push(i); }
    const P = this.player;
    const L = this.live.slice();
    for (let li = 0; li < L.length; li++) {
      const i = L[li]; if (this.st[i] !== ST.FREE) continue;
      const r = d.radius(i);
      this.vy[i] -= 9.81 * h;
      this.vx[i] *= 1 - 0.05 * h; this.vz[i] *= 1 - 0.05 * h;
      d.px[i] += this.vx[i] * h; d.py[i] += this.vy[i] * h; d.pz[i] += this.vz[i] * h;
      this.age[i] += h;
      let contact = false, cnx = 0, cny = 0, cnz = 0;
      const resolve = (nx, ny, nz, e, mu, ovx = 0, ovy = 0, ovz = 0, kind) => {
        const rvx = this.vx[i] - ovx, rvy = this.vy[i] - ovy, rvz = this.vz[i] - ovz;
        const vn = rvx * nx + rvy * ny + rvz * nz;
        if (vn < 0) {
          if (-vn > 1.3 && this.impactBudget > 1) { this.impactBudget--; this.onImpact(d.px[i], d.py[i], d.pz[i], -vn, kind); }
          const j = -(1 + (-vn > 0.6 ? e : 0)) * vn;
          this.vx[i] += nx * j; this.vy[i] += ny * j; this.vz[i] += nz * j;
          const tx = rvx - vn * nx, ty = rvy - vn * ny, tz = rvz - vn * nz;
          const f = Math.min(1, mu * Math.abs(vn) * 8 + mu * h * 40);
          this.vx[i] -= tx * f; this.vy[i] -= ty * f; this.vz[i] -= tz * f;
        }
        contact = true; cnx += nx; cny += ny; cnz += nz;
      };
      // ground (terrain)
      const g = W.ground(d.px[i], d.pz[i]);
      if (d.py[i] - r < g) {
        // real terrain normal (dunes, crater walls): potatoes roll and slide down slopes
        const e = 0.12, gx = (W.ground(d.px[i] + e, d.pz[i]) - W.ground(d.px[i] - e, d.pz[i])) / (2 * e), gz = (W.ground(d.px[i], d.pz[i] + e) - W.ground(d.px[i], d.pz[i] - e)) / (2 * e);
        const nl = Math.hypot(gx, 1, gz); d.py[i] = g + r; resolve(-gx / nl, 1 / nl, -gz / nl, 0.25, 0.3, 0, 0, 0, 'ground');
      }
      // trampoline mat: springy bounce
      const T = W.tramp;
      if (T && Math.hypot(d.px[i] - T.x, d.pz[i] - T.z) < T.r - 0.15 && d.py[i] - r < T.h && d.py[i] > T.h - 0.3 && this.vy[i] < 0) {
        d.py[i] = T.h + r; this.vy[i] = Math.max(-this.vy[i] * 0.85, 2.2); W.onTramp?.(-this.vy[i]);
        if (this.impactBudget > 1) { this.impactBudget--; this.onImpact(d.px[i], d.py[i], d.pz[i], 3, 'tramp'); }
      }
      // static boxes (bin walls, belt frame, shop...) — swept in sub-steps for fast potatoes (no tunnelling)
      const sp0 = Math.abs(this.vx[i]) + Math.abs(this.vy[i]) + Math.abs(this.vz[i]);
      const nSub = Math.min(8, Math.ceil(sp0 * h / 0.03));
      if (nSub > 1) { d.px[i] -= this.vx[i] * h; d.py[i] -= this.vy[i] * h; d.pz[i] -= this.vz[i] * h; }
      for (let sub = 0; sub < Math.max(1, nSub); sub++) {
        if (nSub > 1) { const k = h / nSub; d.px[i] += this.vx[i] * k; d.py[i] += this.vy[i] * k; d.pz[i] += this.vz[i] * k; }
        for (const b of W.boxes) {
          const x = d.px[i], y = d.py[i], z = d.pz[i];
          if (x < b.min.x - r || x > b.max.x + r || y < b.min.y - r || y > b.max.y + r || z < b.min.z - r || z > b.max.z + r) continue;
          const cx = clamp(x, b.min.x, b.max.x), cy = clamp(y, b.min.y, b.max.y), cz = clamp(z, b.min.z, b.max.z);
          let dx = x - cx, dy = y - cy, dz = z - cz, dd = Math.hypot(dx, dy, dz), pen;
          if (dd >= r) continue;
          if (dd < 1e-5) { // centre inside the box: leave through the face of least penetration
            const f = [x - b.min.x, b.max.x - x, y - b.min.y, b.max.y - y, z - b.min.z, b.max.z - z], m = Math.min(...f), a = f.indexOf(m);
            dx = a === 0 ? -1 : a === 1 ? 1 : 0; dy = a === 2 ? -1 : a === 3 ? 1 : 0; dz = a === 4 ? -1 : a === 5 ? 1 : 0; pen = m + r;
          } else { pen = r - dd; dx /= dd; dy /= dd; dz /= dd; }
          d.px[i] += dx * pen; d.py[i] += dy * pen; d.pz[i] += dz * pen;
          resolve(dx, dy, dz, 0.3, 0.3, 0, 0, 0, b.kind || 'wood');
        }
      }
      // jar: inner wall / outer wall / bottom / rim torus
      {
        const x = d.px[i] - J.x, z = d.pz[i] - J.z, y = d.py[i], dist = Math.hypot(x, z) || 1e-5;
        const nx = x / dist, nz = z / dist;
        if (y < J.rim) {
          if (dist < J.R + J.th * 0.5) { // inside
            if (dist > J.R - r) { const pen = dist - (J.R - r); d.px[i] -= nx * pen; d.pz[i] -= nz * pen; resolve(-nx, 0, -nz, 0.35, 0.15, 0, 0, 0, 'glass'); }
            const fy = W.jarFloor ? W.jarFloor(d.px[i], d.pz[i]) : J.yb;
            if (y - r < fy && dist < J.R) {
              d.py[i] = fy + r;
              if (W.jarSlope) { const [sx, sz] = W.jarSlope(d.px[i], d.pz[i]); const l = Math.hypot(sx, 1, sz); resolve(-sx / l, 1 / l, -sz / l, 0.25, 0.08, 0, 0, 0, fy > J.yb + 0.05 ? 'potato' : 'glass'); }
              else resolve(0, 1, 0, 0.3, 0.2, 0, 0, 0, 'glass');
            }
          } else if (dist < J.R + J.th + r && y > J.y0) { // outside wall
            const pen = J.R + J.th + r - dist; d.px[i] += nx * pen; d.pz[i] += nz * pen; resolve(nx, 0, nz, 0.35, 0.15, 0, 0, 0, 'glass');
          }
        }
        // rim lip (torus ring at rim height)
        const rx = dist - (J.R + J.th * 0.5), ry = y - J.rim, rd = Math.hypot(rx, ry), rr = r + J.th * 0.5;
        if (rd < rr && rd > 1e-5) { const pen = rr - rd, ux = rx / rd, uy = ry / rd; d.px[i] += nx * ux * pen; d.pz[i] += nz * ux * pen; d.py[i] += uy * pen; resolve(nx * ux, uy, nz * ux, 0.4, 0.1, 0, 0, 0, 'glass'); }
      }
      // potato-potato: settled (static) and free (both move)
      const x0 = Math.floor((d.px[i] - 0.13) / CS), x1 = Math.floor((d.px[i] + 0.13) / CS);
      const y0 = Math.floor((d.py[i] - 0.13) / CS), y1 = Math.floor((d.py[i] + 0.13) / CS);
      const z0 = Math.floor((d.pz[i] - 0.13) / CS), z1 = Math.floor((d.pz[i] + 0.13) / CS);
      for (let a = x0; a <= x1; a++) for (let c = z0; c <= z1; c++) for (let b = y0; b <= y1; b++) {
        const k = ((a + 2048) * 4096 + (c + 2048)) * 512 + (b + 64);
        const sc = this.hash.get(k);
        if (sc) for (const j of sc) {
          const dx = d.px[i] - d.px[j], dy = d.py[i] - d.py[j], dz = d.pz[i] - d.pz[j], rr = r + d.radius(j) * 0.98;
          const dd2 = dx * dx + dy * dy + dz * dz; if (dd2 >= rr * rr || dd2 < 1e-10) continue;
          const dd = Math.sqrt(dd2), pen = rr - dd, nx = dx / dd, ny = dy / dd, nz = dz / dd;
          d.px[i] += nx * pen; d.py[i] += ny * pen; d.pz[i] += nz * pen;
          resolve(nx, ny, nz, 0.2, 0.45, 0, 0, 0, 'potato');
        }
        const fc = this.freeHash.get(k);
        if (fc) for (const j of fc) {
          if (j <= i) continue;
          const dx = d.px[i] - d.px[j], dy = d.py[i] - d.py[j], dz = d.pz[i] - d.pz[j], rr = r + d.radius(j);
          const dd2 = dx * dx + dy * dy + dz * dz; if (dd2 >= rr * rr || dd2 < 1e-10) continue;
          const dd = Math.sqrt(dd2), pen = (rr - dd) * 0.5, nx = dx / dd, ny = dy / dd, nz = dz / dd;
          d.px[i] += nx * pen; d.py[i] += ny * pen; d.pz[i] += nz * pen; d.px[j] -= nx * pen; d.py[j] -= ny * pen; d.pz[j] -= nz * pen;
          const rvn = (this.vx[i] - this.vx[j]) * nx + (this.vy[i] - this.vy[j]) * ny + (this.vz[i] - this.vz[j]) * nz;
          if (rvn < 0) { const im = -rvn * 0.6; this.vx[i] += nx * im; this.vy[i] += ny * im; this.vz[i] += nz * im; this.vx[j] -= nx * im; this.vy[j] -= ny * im; this.vz[j] -= nz * im; }
          contact = true; cny += ny;
        }
      }
      // player legs push potatoes away
      if (P && this.age[i] > 0.4 && Math.abs(this.vx[i]) + Math.abs(this.vz[i]) < 4) {
        const dx = d.px[i] - P.x, dz = d.pz[i] - P.z, dd = Math.hypot(dx, dz), R = 0.32 + r;
        if (dd < R && d.py[i] < P.y + 1.2 && d.py[i] > P.y - 0.3 && dd > 1e-4) {
          const pen = R - dd; d.px[i] += dx / dd * pen; d.pz[i] += dz / dd * pen;
          this.vx[i] += dx / dd * (1.5 + Math.abs(P.vx) * 0.6); this.vz[i] += dz / dd * (1.5 + Math.abs(P.vz) * 0.6); this.vy[i] += 0.4;
        }
      }
      // rolling: angular velocity follows contact, free spin decays
      if (contact) {
        const l = Math.hypot(cnx, cny, cnz) || 1; cnx /= l; cny /= l; cnz /= l;
        const tx = (cny * this.vz[i] - cnz * this.vy[i]) / r, ty = (cnz * this.vx[i] - cnx * this.vz[i]) / r, tz = (cnx * this.vy[i] - cny * this.vx[i]) / r;
        this.wx[i] += (tx - this.wx[i]) * Math.min(1, h * 30); this.wy[i] += (ty - this.wy[i]) * Math.min(1, h * 30); this.wz[i] += (tz - this.wz[i]) * Math.min(1, h * 30);
        // rolling resistance (a potato is not a ball)
        this.vx[i] *= 1 - h * 1.6; this.vz[i] *= 1 - h * 1.6;
      } else { this.wx[i] *= 1 - h * 0.3; this.wy[i] *= 1 - h * 0.3; this.wz[i] *= 1 - h * 0.3; }
      integrateQuat(d, i, this.wx[i], this.wy[i], this.wz[i], h);
      const sp = Math.hypot(this.vx[i], this.vy[i], this.vz[i]);
      if (contact && sp < 0.14) this.sleep[i] += h; else this.sleep[i] = Math.max(0, this.sleep[i] - h * 2);
      const inBin = W.inBin(d.px[i], d.py[i], d.pz[i]);
      if (!inBin && (this.sleep[i] > 0.3 || (this.age[i] > 9 && contact) || this.age[i] > 30) && this.st[i] === ST.FREE) { this.vx[i] = this.vy[i] = this.vz[i] = 0; this.settle(i); }
      if (d.py[i] < -5) this.free(i); // safety
    }
  }
  recomputeTop() { let t = this.world.jar.yb; for (const i of this.settled) if (this.inJar[i] && this.db.py[i] > t) t = this.db.py[i]; this.jarTop = t; }
  // nearest unpaid loose potato (thrown on the ground) around a point — can be picked up again
  pickNear(x, y, z, r) {
    let best = -1, bd = r * r; const d = this.db;
    const test = i => { if (this.paid[i] || this.inJar[i]) return; if (this.world.inBin(d.px[i], d.py[i], d.pz[i])) return; const dx = d.px[i] - x, dy = d.py[i] - y, dz = d.pz[i] - z, q = dx * dx + dy * dy * 0.25 + dz * dz; if (q < bd) { bd = q; best = i; } };
    for (const i of this.live) if (this.st[i] === ST.FREE) test(i);
    const n = Math.ceil(r / CS);
    for (let a = -n; a <= n; a++) for (let c = -n; c <= n; c++) for (let b = -n; b <= n; b++) {
      const cell = this.hash.get(((Math.floor(x / CS) + a + 2048) * 4096 + (Math.floor(z / CS) + c + 2048)) * 512 + (Math.floor(y / CS) + b + 64));
      if (cell) for (const i of cell) test(i);
    }
    return best;
  }
  // kick settled ground potatoes near the player (overflow pile reacts to walking through it)
  kick(x, y, z, vx, vz) {
    let n = 0; const J = this.world.jar;
    for (let a = -3; a <= 3; a++) for (let c = -3; c <= 3; c++) for (let b = -1; b <= 3; b++) {
      const k = ((Math.floor(x / CS) + a + 2048) * 4096 + (Math.floor(z / CS) + c + 2048)) * 512 + (Math.floor(y / CS) + b + 64);
      const cell = this.hash.get(k); if (!cell) continue;
      for (let m = cell.length - 1; m >= 0; m--) {
        const i = cell[m]; if (this.inJar[i]) continue;
        const dx = this.db.px[i] - x, dz = this.db.pz[i] - z, dd = Math.hypot(dx, dz);
        if (dd < 0.36 && Math.hypot(this.db.px[i] - J.x, this.db.pz[i] - J.z) > J.R + 0.1) {
          this.unsettle(i, dx / (dd + 0.01) * 1.6 + vx * 0.5, 0.6, dz / (dd + 0.01) * 1.6 + vz * 0.5);
          if (++n > 6) return n;
        }
      }
    }
    return n;
  }

  _scripted(dt, ctx) {
    const d = this.db, v = this._v;
    for (let li = this.live.length - 1; li >= 0; li--) {
      const i = this.live[li]; const s = this.st[i];
      if (s === ST.FLY) {
        this.t[i] += dt; const k = clamp(this.t[i] / this.fdur[i], 0, 1);
        const fn = this.flyTarget.get(i);
        if (fn) { fn(v); this.fex[i] = v.x; this.fey[i] = v.y; this.fez[i] = v.z; }
        const e = k < 1 ? 1 - Math.pow(1 - k, 2.2) : 1;
        d.px[i] = this.f0x[i] + (this.fex[i] - this.f0x[i]) * e;
        d.pz[i] = this.f0z[i] + (this.fez[i] - this.f0z[i]) * e;
        d.py[i] = this.f0y[i] + (this.fey[i] - this.f0y[i]) * e + Math.sin(k * Math.PI) * this.farc[i];
        integrateQuat(d, i, this.wx[i], this.wy[i], this.wz[i], dt);
        if (k >= 1) {
          const cb = this.flyDone.get(i); this.flyDone.delete(i); this.flyTarget.delete(i);
          if (cb) cb(i); else this.setFree(i, 0, 0, 0);
        }
      } else if (s === ST.BELT && ctx?.belt) {
        this.t[i] += dt * ctx.belt.speed;
        if (this.t[i] >= ctx.belt.len) { ctx.belt.exit(i); continue; }
        ctx.belt.pos(this.t[i], this.aux[i], v);
        d.px[i] = v.x; d.py[i] = v.y + d.radius(i) * 0.8; d.pz[i] = v.z;
        integrateQuat(d, i, ctx.belt.dirZ * 0.4, 0, -ctx.belt.dirX * 0.4, dt); // slow tumble as it rides
      } else if (s === ST.SHRINK) {
        this.t[i] += dt; if (this.t[i] > 0.5) this.free(i);
      }
    }
  }
  _upload() {
    const d = this.db, lm = this.liveMesh, m = this._m;
    for (let s = 0; s < this.live.length; s++) {
      const i = this.live[s]; d.matrix(i, m);
      let k = this.vscale[i]; if (this.st[i] === ST.SHRINK) k *= Math.max(0, 1 - this.t[i] / 0.5);
      if (k !== 1) m.scale(this._v.set(k, k, k));
      lm.setMatrixAt(s, m);
    }
    lm.count = this.live.length; lm.instanceMatrix.needsUpdate = true;
    for (const mm of [lm, this.setMesh]) {
      if (mm.userData.dirtyAttrs) { mm.userData.attrs.forEach(a => (a.needsUpdate = true)); mm.userData.dirtyAttrs = false; }
    }
    if (this.setMesh.userData.dirtyMat) { this.setMesh.instanceMatrix.needsUpdate = true; this.setMesh.userData.dirtyMat = false; }
  }
}

function integrateQuat(d, i, wx, wy, wz, h) {
  const qx = d.qx[i], qy = d.qy[i], qz = d.qz[i], qw = d.qw[i], k = 0.5 * h;
  let nx = qx + k * (wx * qw + wy * qz - wz * qy), ny = qy + k * (wy * qw + wz * qx - wx * qz), nz = qz + k * (wz * qw + wx * qy - wy * qx), nw = qw + k * (-wx * qx - wy * qy - wz * qz);
  const l = Math.hypot(nx, ny, nz, nw) || 1; d.qx[i] = nx / l; d.qy[i] = ny / l; d.qz[i] = nz / l; d.qw[i] = nw / l;
}

const ATTRS = [['aShape', 4], ['aMisc', 4], ['aDirs', 4], ['aDirs2', 4], ['aDirs3', 2]];
function makeMesh(base, mat, cap) {
  const g = new THREE.BufferGeometry(); g.setIndex(base.index); g.setAttribute('position', base.attributes.position); g.setAttribute('normal', base.attributes.normal);
  const attrs = ATTRS.map(([n, k]) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * k), k).setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, a); return a; });
  const m = new THREE.InstancedMesh(g, mat, cap); m.count = 0; m.frustumCulled = false; m.receiveShadow = true;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.userData.attrs = attrs; m.userData.arrs = attrs.map(a => a.array);
  return m;
}
export function indexedIco(detail) {
  const g = new THREE.IcosahedronGeometry(1, detail), pos = g.attributes.position, map = new Map(), verts = [], idx = [];
  for (let i = 0; i < pos.count; i++) {
    const kx = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    let j = map.get(kx); if (j === undefined) { j = verts.length / 3; verts.push(pos.getX(i), pos.getY(i), pos.getZ(i)); map.set(kx, j); }
    idx.push(j);
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(verts.slice(), 3)); out.setIndex(idx);
  return out;
}
export { R0 };
