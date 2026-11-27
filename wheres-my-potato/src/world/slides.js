import * as THREE from 'three';
import { ground } from './field.js';
import { digMap } from './dig.js';
import { audio } from '../audio/audio.js';

// =====================================================================================
// SLIDES — potatoes obey the shape of the pile:
//  • digging: field potatoes left hanging over a fresh hole drop and roll into it;
//  • crater collapse: where the dig solver moves material down a wall, the potatoes on
//    that rim are released (or a few extra ones tumble) toward the bottom;
//  • dunes & mountains: on steep slopes around the player, small avalanches start on
//    their own (more often when you walk on a slope): a handful of potatoes break loose
//    at the crest and roll/slide down to the foot of the slope with real physics.
// All of it is budgeted (live bodies, rollers per second) to stay smooth on phones.
// =====================================================================================
const _q = new THREE.Quaternion(), _p = new THREE.Vector3();
const slope = (x, z, e = 0.4) => { const gx = (ground(x + e, z) - ground(x - e, z)) / (2 * e), gz = (ground(x, z + e) - ground(x, z - e)) / (2 * e); return [gx, gz, Math.hypot(gx, gz)]; };

export class Slides {
  constructor(game) { this.g = game; this.t = 0; this.avT = 2; this.budget = 0; this.seed = 1; }
  _room(n = 1) { const d = this.g.dyn; return d.live.length + n < d.liveCap - 160; }
  // release a field potato into the physics, pushed with (vx, vy, vz)
  release(j, vx, vy, vz) {
    const g = this.g, F = g.field, fdb = F.db;
    if (!this._room() || !F.kick(j)) return false;
    const i = g.dyn.spawnFrom(fdb, j); if (i < 0) { F.restore(j, fdb.px[j], fdb.py[j], fdb.pz[j], fdb.quat(j, _q)); return false; }
    g.dyn.fieldId[i] = j; g.dyn.setFree(i, vx, vy, vz);
    g.dyn.wx[i] = (Math.random() - 0.5) * 10; g.dyn.wz[i] = (Math.random() - 0.5) * 10;
    return true;
  }
  // an extra potato breaking loose from the pile (the visual carpet is "infinite")
  roller(x, z, vx, vz) {
    if (!this._room() || this.budget <= 0) return -1;
    const g = this.g, i = g.dyn.spawnRandom(g.rng((this.seed = (this.seed * 16807) % 2147483647)), x, ground(x, z) + 0.08, z); if (i < 0) return -1;
    if (g.dyn.db.variety[i] === 5) g.dyn.db.variety[i] = 0; // no free golden potatoes from avalanches
    g.dyn.setFree(i, vx, 0.3, vz); g.dyn.wx[i] = (Math.random() - 0.5) * 12; g.dyn.wz[i] = (Math.random() - 0.5) * 12;
    this.budget--; return i;
  }
  // called by the field when a potato is harvested at (x, z): neighbours over the hole fall in
  onDig(x, z) {
    const g = this.g, F = g.field, fdb = F.db, ids = F.field.query(x, z, 0.55, this._qa || (this._qa = []));
    let n = 0;
    for (const j of ids) {
      if (n >= 4) break;
      const gy = ground(fdb.px[j], fdb.pz[j]);
      if (fdb.py[j] - gy > 0.07) { // hanging over the new hole
        const dx = x - fdb.px[j], dz = z - fdb.pz[j], d = Math.hypot(dx, dz) + 0.01;
        if (this.release(j, dx / d * 0.6, 0.1, dz / d * 0.6)) n++;
      }
    }
  }
  update(dt) {
    const g = this.g; this.t += dt;
    this.budget = Math.min(30, this.budget + dt * 14);
    // ---- crater walls collapsing (from the dig solver) ----
    const S = digMap.slides;
    if (S.length) {
      for (let k = 0; k < S.length; k += 3) {
        const from = digMap.cellPos(S[k], _p).clone(), to = digMap.cellPos(S[k + 1], _p), m = S[k + 2];
        const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1;
        const ids = g.field.field.query(from.x, from.z, 0.3, this._qb || (this._qb = []));
        let rel = false;
        for (const j of ids) if (this.release(j, dx / d * 1.2, 0.05, dz / d * 1.2)) { rel = true; break; }
        if (!rel && m > 0.025 && Math.random() < 0.5) this.roller(from.x, from.z, dx / d * 1.4, dz / d * 1.4);
      }
      S.length = 0;
      if (Math.random() < 0.15) audio.footstep('potatoes', 3, null);
    }
    // ---- dunes & mountains: spontaneous avalanches on steep slopes near the player ----
    if (g.state !== 'play') return;
    const P = g.player, walkSlope = slope(P.pos.x, P.pos.z)[2], moving = Math.hypot(P.vel.x, P.vel.z) > 1.5;
    this.avT -= dt * (moving && walkSlope > 0.3 ? 4 : 1);
    if (this.avT > 0) return;
    this.avT = 1.1 + Math.random() * 1.6;
    const fwd = g.camera.getWorldDirection(_p), a0 = Math.atan2(fwd.z, fwd.x);
    for (let tries = 0; tries < 10; tries++) {
      const a = a0 + (Math.random() - 0.5) * 1.6, r = 4 + Math.random() * 22;
      const x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
      const [gx, gz, s] = slope(x, z);
      if (s < 0.42) continue;
      // start a little below the crest, roll down the fall line
      const n = 4 + ((Math.random() * 7) | 0), dx = -gx / s, dz = -gz / s;
      for (let k = 0; k < n; k++) { const ox = (Math.random() - 0.5) * 0.9, oz = (Math.random() - 0.5) * 0.9; this.roller(x + ox - dx * k * 0.12, z + oz - dz * k * 0.12, dx * (1 + Math.random() * 1.5), dz * (1 + Math.random() * 1.5)); }
      if (r < 12) audio.footstep('potatoes', 5, null);
      break;
    }
  }
}
