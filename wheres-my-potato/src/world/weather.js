import * as THREE from 'three';
import { ground } from './field.js';
import { potatoUniforms } from './potatoes.js';
import { clamp, damp } from '../core/util.js';

// =====================================================================================
// WEATHER: random rain showers (instanced falling streaks around the camera, ground
// splashes, darker sky, closer fog, wet shiny potatoes & soil, lightning + thunder).
// Rain doubles the regrowth speed of the field.
// TRAMPOLINE: a sprung trampoline in the yard; player and potatoes really bounce on it.
// =====================================================================================
const N = 1400;
export class Weather {
  constructor(game) {
    this.g = game; this.rain = 0; this.target = 0; this.next = 150 + Math.random() * 150; this.dur = 0; this.flash = 0; this.thunderT = 8;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 6); geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.0, depthWrite: false }));
    this.lines.frustumCulled = false; game.scene.add(this.lines);
    this.drops = new Float32Array(N * 3); for (let i = 0; i < N; i++) this._reset(i, true);
  }
  _reset(i, any) {
    const c = this.g.camera.position;
    this.drops[i * 3] = c.x + (Math.random() - 0.5) * 36; this.drops[i * 3 + 2] = c.z + (Math.random() - 0.5) * 36;
    this.drops[i * 3 + 1] = c.y + (any ? Math.random() * 18 - 4 : 14 + Math.random() * 4);
  }
  start(d = 80) { this.target = 1; this.dur = d; }
  update(dt) {
    const g = this.g, F = g.field;
    this.next -= dt; if (this.next < 0 && this.target === 0) { this.start(60 + Math.random() * 70); this.next = 260 + Math.random() * 260; if (g.state === 'play') { g.ui.toast('🌧️ Il pleut ! Les patates repoussent deux fois plus vite.'); g.say('Ah, la pluie ! Les patates vont pousser comme des champignons.', null, true); } }
    if (this.target) { this.dur -= dt; if (this.dur < 0) this.target = 0; }
    this.rain = damp(this.rain, this.target, 0.5, dt);
    const r = this.rain;
    // world response
    F.rainMul = 1 / (1 + r);
    potatoUniforms.uWet.value = r * 0.9;
    F.soilWet = r; if (F.soilMat) { F.soilMat.roughness = 1 - r * 0.6; F.soilMat.color.setScalar(1 - r * 0.32); }
    if (F.sky) F.sky.material.uniforms.uDay.value *= 1 - r * 0.45;
    g.scene.fog.near = 80 - r * 60; g.scene.fog.far = 320 - r * 220;
    g.scene.fog.color.lerp(new THREE.Color(0x6a7480), r * 0.6);
    F.sun.intensity *= 1 - r * 0.7; F.hemi.intensity *= 1 - r * 0.3;
    // lightning + thunder during heavy rain
    if (r > 0.7) { this.thunderT -= dt; if (this.thunderT < 0) { this.thunderT = 9 + Math.random() * 14; this.flash = 1; setTimeout(() => g.audioThunder?.(), 300 + Math.random() * 1500); } }
    this.flash = Math.max(0, this.flash - dt * 4);
    if (this.flash > 0) F.hemi.intensity += this.flash * (Math.random() < 0.5 ? 3 : 1.5);
    g.audioRain?.(r);
    // streaks
    this.lines.material.opacity = clamp(r * 0.5, 0, 0.5);
    this.lines.visible = r > 0.02;
    if (!this.lines.visible) return;
    const n = Math.floor(N * r), P = this.pos, D = this.drops, wind = 1.2;
    for (let i = 0; i < N; i++) {
      if (i >= n) { P.fill(0, i * 6, i * 6 + 6); continue; }
      D[i * 3 + 1] -= 16 * dt; D[i * 3] += wind * dt;
      const gx = D[i * 3], gz = D[i * 3 + 2], gy = ground(gx, gz);
      if (D[i * 3 + 1] < gy) { if (Math.random() < 0.15) g.fx.soft.emit(gx, gy + 0.02, gz, (Math.random() - 0.5) * 0.6, 0.8, (Math.random() - 0.5) * 0.6, 0.25, 0.03, 1, 6, 1, 0.75, 0.82, 0.95, 0.5); this._reset(i); continue; }
      const c = g.camera.position; if (Math.abs(gx - c.x) > 20 || Math.abs(gz - c.z) > 20) { this._reset(i); continue; }
      P[i * 6] = gx; P[i * 6 + 1] = D[i * 3 + 1]; P[i * 6 + 2] = gz; P[i * 6 + 3] = gx - wind * 0.03; P[i * 6 + 4] = D[i * 3 + 1] + 0.45; P[i * 6 + 5] = gz;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}

export const TRAMP = { x: 1.5, z: 31, r: 1.6, h: 0.75 };
export class Trampoline {
  constructor(scene, M) {
    const g = new THREE.Group(); g.position.set(TRAMP.x, 0, TRAMP.z); scene.add(g);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(TRAMP.r, 0.05, 10, 48).rotateX(Math.PI / 2), M.paintBlue); frame.position.y = TRAMP.h; frame.castShadow = true; g.add(frame);
    const pad = new THREE.Mesh(new THREE.TorusGeometry(TRAMP.r - 0.06, 0.09, 8, 48).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2aa0ff, roughness: 0.6 })); pad.scale.y = 0.4; pad.position.y = TRAMP.h + 0.02; g.add(pad);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, TRAMP.h, 8), M.paintBlue); leg.position.set(Math.cos(a) * (TRAMP.r - 0.05), TRAMP.h / 2, Math.sin(a) * (TRAMP.r - 0.05)); leg.castShadow = true; g.add(leg); }
    // the mat is a disc whose centre dips when something lands, then rings like a spring
    const mg = new THREE.CircleGeometry(TRAMP.r - 0.18, 40, 0, Math.PI * 2); mg.rotateX(-Math.PI / 2);
    this.base = mg.attributes.position.array.slice();
    this.mat = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.7, side: THREE.DoubleSide })); this.mat.position.y = TRAMP.h; this.mat.receiveShadow = true; g.add(this.mat);
    const springs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6).rotateZ(Math.PI / 2), M.chrome, 36); const m = new THREE.Matrix4();
    for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2; m.makeRotationY(-a).setPosition(Math.cos(a) * (TRAMP.r - 0.1), TRAMP.h, Math.sin(a) * (TRAMP.r - 0.1)); springs.setMatrixAt(k, m); }
    g.add(springs);
    this.dip = 0; this.vel = 0; this.group = g;
  }
  hit(strength) { this.vel -= strength * 0.25; }
  update(dt) {
    // damped spring for the mat
    this.vel += (-this.dip * 90 - this.vel * 6) * dt; this.dip += this.vel * dt;
    const p = this.mat.geometry.attributes.position.array, b = this.base, R = TRAMP.r - 0.18;
    for (let i = 0; i < p.length; i += 3) { const d = Math.hypot(b[i], b[i + 2]) / R; p[i + 1] = this.dip * (1 - d * d); }
    this.mat.geometry.attributes.position.needsUpdate = true;
  }
}
