import * as THREE from 'three';
import { shoePrintTexture } from './textures.js';
import { clamp } from '../core/util.js';

// =====================================================================================
// VFX: CPU-simulated particle pools rendered as GPU point sprites (soft round, per-particle
// colour / size / alpha), 3D spinning coins, and footprint decals that fade over time.
// =====================================================================================
const PV = `attribute float aSize; attribute vec4 aCol; varying vec4 vCol;
void main(){ vCol = aCol; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = aSize * (520.0 / -mv.z); gl_Position = projectionMatrix*mv; }`;
const PF = `varying vec4 vCol; uniform float uSoft;
void main(){ vec2 d = gl_PointCoord-0.5; float r = length(d); if (r>0.5) discard; float a = smoothstep(0.5, uSoft, r); gl_FragColor = vec4(vCol.rgb, vCol.a*a); }`;

class Pool {
  constructor(scene, cap, additive, soft) {
    this.cap = cap; this.n = 0;
    this.p = new Float32Array(cap * 3); this.v = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap);
    this.size0 = new Float32Array(cap); this.grow = new Float32Array(cap); this.grav = new Float32Array(cap); this.drag = new Float32Array(cap); this.col = new Float32Array(cap * 4);
    const g = new THREE.BufferGeometry();
    this.posA = new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.sizeA = new THREE.BufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
    this.colA = new THREE.BufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posA); g.setAttribute('aSize', this.sizeA); g.setAttribute('aCol', this.colA);
    const m = new THREE.ShaderMaterial({ vertexShader: PV, fragmentShader: PF, uniforms: { uSoft: { value: soft } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.pts = new THREE.Points(g, m); this.pts.frustumCulled = false; this.pts.renderOrder = 20; scene.add(this.pts);
  }
  emit(x, y, z, vx, vy, vz, life, size, grow, grav, drag, r, gg, b, a) {
    let i = this.n < this.cap ? this.n++ : Math.floor(Math.random() * this.cap);
    this.p.set([x, y, z], i * 3); this.v.set([vx, vy, vz], i * 3); this.life[i] = life; this.max[i] = life;
    this.size0[i] = size; this.grow[i] = grow; this.grav[i] = grav; this.drag[i] = drag; this.col.set([r, gg, b, a], i * 4);
  }
  update(dt, ground) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { // swap-remove
        const l = --this.n; if (i !== l) { for (const [arr, k] of [[this.p, 3], [this.v, 3], [this.col, 4]]) arr.copyWithin(i * k, l * k, l * k + k); for (const arr of [this.life, this.max, this.size0, this.grow, this.grav, this.drag]) arr[i] = arr[l]; }
        i--; continue;
      }
      const k = i * 3, dr = Math.max(0, 1 - this.drag[i] * dt);
      this.v[k] *= dr; this.v[k + 1] = this.v[k + 1] * dr - this.grav[i] * dt; this.v[k + 2] *= dr;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      if (ground && this.grav[i] > 1) { const gy = ground(this.p[k], this.p[k + 2]) + 0.01; if (this.p[k + 1] < gy) { this.p[k + 1] = gy; this.v[k + 1] *= -0.25; this.v[k] *= 0.5; this.v[k + 2] *= 0.5; } }
    }
    const P = this.posA.array, S = this.sizeA.array, C = this.colA.array;
    for (let i = 0; i < this.n; i++) {
      P[i * 3] = this.p[i * 3]; P[i * 3 + 1] = this.p[i * 3 + 1]; P[i * 3 + 2] = this.p[i * 3 + 2];
      const t = 1 - this.life[i] / this.max[i];
      S[i] = this.size0[i] * (1 + this.grow[i] * t);
      C[i * 4] = this.col[i * 4]; C[i * 4 + 1] = this.col[i * 4 + 1]; C[i * 4 + 2] = this.col[i * 4 + 2];
      C[i * 4 + 3] = this.col[i * 4 + 3] * Math.min(1, (1 - t) * 3) * Math.min(1, t * 12 + 0.2);
    }
    this.pts.geometry.setDrawRange(0, this.n);
    this.posA.needsUpdate = this.sizeA.needsUpdate = this.colA.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, ground) {
    this.scene = scene; this.ground = ground;
    this.soft = new Pool(scene, 1800, false, 0.05);
    this.glow = new Pool(scene, 900, true, 0.0);
    // coins
    const cg = new THREE.CylinderGeometry(0.06, 0.06, 0.012, 20); cg.rotateX(Math.PI / 2);
    this.coins = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 1, roughness: 0.25, emissive: 0x3a2200 }), 120);
    this.coins.count = 0; this.coins.frustumCulled = false; this.coins.castShadow = true; scene.add(this.coins);
    this.coinData = [];
    // footprints
    const fg = new THREE.PlaneGeometry(0.13, 0.28); fg.rotateX(-Math.PI / 2);
    this.fpFade = new THREE.InstancedBufferAttribute(new Float32Array(260), 1).setUsage(THREE.DynamicDrawUsage); fg.setAttribute('aFade', this.fpFade);
    const fm = new THREE.MeshStandardMaterial({ color: 0x2a1a0e, transparent: true, depthWrite: false, alphaMap: shoePrintTexture(), roughness: 1, polygonOffset: true, polygonOffsetFactor: -4 });
    fm.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFade; varying float vFade;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = aFade;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFade;').replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vFade * 0.75;');
    };
    this.fp = new THREE.InstancedMesh(fg, fm, 260); this.fp.count = 0; this.fp.frustumCulled = false; this.fp.receiveShadow = true; scene.add(this.fp);
    this.fpData = []; this.fpNext = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  dirt(x, y, z, n = 8, power = 1) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random() * 1.2) * power, c = 0.18 + Math.random() * 0.1;
      this.soft.emit(x, y + 0.02, z, Math.cos(a) * s, (1 + Math.random() * 2) * power, Math.sin(a) * s, 0.5 + Math.random() * 0.4, 0.035 + Math.random() * 0.03, 0, 9.8, 0.5, c * 1.4, c, c * 0.65, 1);
    }
    for (let k = 0; k < Math.ceil(n / 2); k++) this.soft.emit(x + (Math.random() - 0.5) * 0.2, y + 0.05, z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.4, 0.2 + Math.random() * 0.3, (Math.random() - 0.5) * 0.4, 1.2 + Math.random(), 0.12, 2.5, -0.05, 1.5, 0.55, 0.47, 0.36, 0.35);
  }
  dust(x, y, z, n = 3, col = [0.6, 0.52, 0.4]) {
    for (let k = 0; k < n; k++) this.soft.emit(x + (Math.random() - 0.5) * 0.25, y + 0.03, z + (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.5, 0.15 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5, 0.8 + Math.random() * 0.8, 0.08, 3, -0.05, 2, col[0], col[1], col[2], 0.28);
  }
  sparkle(x, y, z, n = 10, col = [1, 0.8, 0.3], speed = 1.5) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 - 0.2, s = speed * (0.4 + Math.random());
      this.glow.emit(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 0.8, Math.sin(a) * Math.cos(e) * s, 0.5 + Math.random() * 0.6, 0.05 + Math.random() * 0.05, -0.6, 2.5, 1.2, col[0], col[1], col[2], 1);
    }
  }
  ring(x, y, z, col = [1, 0.85, 0.4], n = 32, speed = 3) {
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; this.glow.emit(x, y, z, Math.cos(a) * speed, 0.2, Math.sin(a) * speed, 0.6, 0.07, -0.5, 0, 2.5, col[0], col[1], col[2], 1); }
  }
  coinBurst(x, y, z, n = 3) {
    for (let k = 0; k < n; k++) {
      if (this.coinData.length >= 120) this.coinData.shift();
      const a = Math.random() * Math.PI * 2;
      this.coinData.push({ p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(Math.cos(a) * 0.9, 3 + Math.random() * 1.5, Math.sin(a) * 0.9), r: Math.random() * 6, w: 10 + Math.random() * 12, life: 1.1 });
    }
    this.sparkle(x, y, z, 6);
  }
  footprint(x, z, yaw, left, y) {
    const i = this.fpNext; this.fpNext = (this.fpNext + 1) % 260;
    const side = left ? -1 : 1;
    this.fpData[i] = { x: x + Math.cos(yaw) * 0.1 * side, z: z - Math.sin(yaw) * 0.1 * side, y: y + 0.006, yaw, left, age: 0 };
    this.fp.count = Math.max(this.fp.count, i + 1);
    const d = this.fpData[i]; this._e.set(0, yaw, 0); this._q.setFromEuler(this._e);
    this._m.compose(this._v.set(d.x, d.y, d.z), this._q, this._s.set(left ? -1 : 1, 1, 1)); this.fp.setMatrixAt(i, this._m); this.fp.instanceMatrix.needsUpdate = true;
  }
  update(dt) {
    this.soft.update(dt, this.ground); this.glow.update(dt, null);
    // coins: arc, spin, bounce, shrink
    let n = 0;
    for (let k = this.coinData.length - 1; k >= 0; k--) { const c = this.coinData[k]; c.life -= dt; if (c.life <= 0) this.coinData.splice(k, 1); }
    for (const c of this.coinData) {
      c.v.y -= 9.8 * dt; c.p.addScaledVector(c.v, dt); c.r += c.w * dt;
      const s = clamp(c.life * 3, 0, 1);
      this._e.set(0.3, c.r, 0); this._q.setFromEuler(this._e); this._m.compose(c.p, this._q, this._s.set(s, s, s)); this.coins.setMatrixAt(n++, this._m);
    }
    this.coins.count = n; this.coins.instanceMatrix.needsUpdate = true;
    // footprints fade over 45 s
    const F = this.fpFade.array;
    for (let i = 0; i < this.fp.count; i++) { const d = this.fpData[i]; if (!d) continue; d.age += dt; F[i] = clamp(1 - d.age / 45, 0, 1) * clamp(d.age * 8, 0, 1); }
    this.fpFade.needsUpdate = true;
  }
}
