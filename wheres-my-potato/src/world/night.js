import * as THREE from 'three';
import { ground } from './field.js';
import { audio } from '../audio/audio.js';
import { rng } from '../core/util.js';

// =====================================================================================
// NIGHT EVENT — "les patates filantes": at night, golden shooting-star potatoes streak
// across the sky (glowing trail) and crash into the potato sea not far from the player.
// Each one stays lit by a soft light beam until somebody picks it up (worth a golden
// potato). One at a time, a few per night: a fun bonus, never in the way.
// =====================================================================================
export class NightEvents {
  constructor(game) {
    this.g = game; this.next = 6; this.star = null; this.announced = false;
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.6, 14, 20, 1, true).translate(0, 7, 0), beamMat); this.beam.visible = false; game.scene.add(this.beam);
    this.light = new THREE.PointLight(0xffc860, 0, 9, 1.6); game.scene.add(this.light);
  }
  update(dt) {
    const g = this.g, night = g.field.night || 0, d = g.dyn;
    if (night < 0.6) { this.announced = false; this.beam.visible = false; this.light.intensity = 0; this.landed = -1; return; }
    // flying star
    if (this.star) {
      const s = this.star; s.t += dt; const k = Math.min(1, s.t / s.dur);
      const p = s.from.clone().lerp(s.to, k); p.y += Math.sin(k * Math.PI) * 6;
      d.setPose(s.id, p.x, p.y, p.z);
      for (let n = 0; n < 4; n++) g.fx.glow.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0.7 + Math.random() * 0.5, 0.18 - n * 0.03, -0.7, 0, 1, 1, 0.75 + Math.random() * 0.2, 0.3, 1);
      if (k >= 1) {
        d.setFree(s.id, (Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2); d.vscale[s.id] = 1.25;
        g.fx.sparkle(p.x, p.y, p.z, 60, [1, 0.85, 0.35], 4); g.fx.ring(p.x, p.y + 0.1, p.z, [1, 0.8, 0.3], 40, 4); g.fx.dirt(p.x, p.y, p.z, 14, 1.5);
        audio.thud('ground', p, 8); audio.coin(p, true); g.shake(0.12);
        this.landed = s.id; this.star = null;
        if (!this.announced) { this.announced = true; g.say('Une patate filante ! Fais un vœu… et va la ramasser, elle est en or !', 'point', true); g.ui.toast('🌠 Une patate filante est tombée près de toi !', 'gold'); }
      }
      return;
    }
    // beam over the landed star until it is picked up / dumped
    if (this.landed >= 0) {
      const i = this.landed;
      if (d.st[i] === 0 /* freed */ || d.st[i] === 3 || d.st[i] === 4 || d.st[i] === 2 || d.st[i] === 5) { this.landed = -1; this.beam.visible = false; this.light.intensity = 0; }
      else {
        this.beam.visible = true; this.beam.position.set(d.db.px[i], d.db.py[i], d.db.pz[i]); this.beam.material.opacity = 0.18 + Math.sin(performance.now() / 300) * 0.06;
        this.light.position.set(d.db.px[i], d.db.py[i] + 0.6, d.db.pz[i]); this.light.intensity = 6;
        if (Math.random() < dt * 8) g.fx.glow.emit(d.db.px[i], d.db.py[i] + 0.1, d.db.pz[i], (Math.random() - 0.5) * 0.3, 0.8, (Math.random() - 0.5) * 0.3, 1.2, 0.06, 0, -0.3, 0.5, 1, 0.85, 0.4, 1);
      }
      return;
    }
    this.next -= dt;
    if (this.next > 0 || g.state !== 'play') return;
    this.next = 14 + Math.random() * 18;
    // spawn far in the sky, land 8-22 m from the player
    const c = g.player.pos, a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 14;
    const tx = c.x + Math.cos(a) * r, tz = c.z + Math.sin(a) * r;
    const to = new THREE.Vector3(tx, ground(tx, tz) + 0.1, tz), from = new THREE.Vector3(tx - Math.cos(a + 1) * 90, 70, tz - Math.sin(a + 1) * 90);
    const id = d.spawnRandom(rng((Math.random() * 1e9) | 0), from.x, from.y, from.z); if (id < 0) return;
    d.db.variety[id] = 5; d.hold(id, 4); d.vscale[id] = 1.6;
    this.star = { id, from, to, t: 0, dur: 2.6 };
    audio.whoosh(to);
  }
}
