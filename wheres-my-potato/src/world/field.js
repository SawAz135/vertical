import * as THREE from 'three';
import { PotatoDB, PotatoField } from './potatoes.js';
import { PotatoCarpet } from './proc.js';
import { rng, fbm2, clamp, smooth, TAU, easeOutBack, hash32 } from '../core/util.js';

// =====================================================================================
// THE POTATO SEA: no soil, no grass, no scenery — the whole world is an endless sea of
// potatoes. A huge textured potato surface (gentle dunes) fades into the fog, and the
// playable area is covered by tens of thousands of real instanced potatoes lying on it.
// Structures (jar, bin, shop) sit in cleared spots; potatoes regrow (pop up) after picking.
// =====================================================================================
export const FIELD = { x0: -44, x1: 44, z0: -44, z1: 44 };
// cleared zones (structures) — filled by the world builder: {x,z,r} circles or {x0,x1,z0,z1} rects
export const CLEAR = [];
function cleared(x, z, pad = 0) {
  for (const c of CLEAR) {
    if (c.r !== undefined) { if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true; }
    else if (x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad) return true;
  }
  return false;
}
export function fieldMask(x, z) { return cleared(x, z) ? 0 : 1; }
// dune height of the potato desert: asymmetric wind-built dunes (gentle windward slope,
// sharp crest, steep slip face), varying heights, small mountains on the horizon.
function dune(x, z) {
  const warp = fbm2(x * 0.012 + 11, z * 0.012 - 5, 3) * 7;
  const u = (x * 0.8 + z * 0.6) * 0.045 + warp * 0.32, ph = u - Math.floor(u);
  const prof = ph < 0.78 ? smooth(ph / 0.78) : smooth(1 - (ph - 0.78) / 0.22);   // windward / slip face
  const amp = 0.6 + 1.6 * (fbm2(x * 0.02 - 4, z * 0.02 + 9, 2) * 0.5 + 0.5);
  return prof * amp + fbm2(x * 0.05, z * 0.05, 2) * 0.35;
}
export function ground(x, z) {
  let flat = 1;
  for (const c of CLEAR) {
    const d = c.r !== undefined ? Math.hypot(x - c.x, z - c.z) - c.r : Math.max(c.x0 - x, x - c.x1, c.z0 - z, z - c.z1);
    flat = Math.min(flat, smooth(clamp(d / 5, 0, 1)));
  }
  const dist = Math.hypot(x, z), grow = 1 + Math.max(0, dist - 30) / 25;        // dunes swell with distance
  let h = dune(x, z) * grow;
  if (dist > 110) { const m = Math.min(1, (dist - 110) / 80); h += m * (14 + fbm2(x * 0.008, z * 0.008, 4) * 22) * (0.6 + 0.4 * Math.abs(Math.sin(Math.atan2(z, x) * 3.0 + 1.3))); }
  return h * flat;
}
export function inField(x, z) { return x > FIELD.x0 && x < FIELD.x1 && z > FIELD.z0 && z < FIELD.z1 && !cleared(x, z, 0.2); }

export class FieldWorld {
  constructor(scene, M, quality, seed = 1987) {
    this.scene = scene; this.M = M; this.q = quality; this.seed = seed;
    this.colliders = []; this.time = 0;
    this.bounds = { x0: FIELD.x0 + 1, x1: FIELD.x1 - 1, z0: FIELD.z0 + 1, z1: FIELD.z1 - 1 };
  }
  // built after the structures registered their cleared zones
  build() { this._sky(); this._lights(); this._sea(); this._potatoes(); this.setTime(10); }

  _sky() {
    const sunDir = new THREE.Vector3(-0.55, 0.42, -0.72).normalize(); this.sunDir = sunDir;
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uSun: { value: sunDir }, uTime: { value: 0 }, uDay: { value: 1 }, uDusk: { value: 0 }, uMoon: { value: new THREE.Vector3(0.5, 0.6, 0.6).normalize() } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }`,
      fragmentShader: `varying vec3 vP; uniform vec3 uSun; uniform float uTime; uniform float uDay; uniform float uDusk; uniform vec3 uMoon;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
        void main(){
          vec3 d = normalize(vP); float y = d.y;
          vec3 zen = mix(vec3(0.01,0.02,0.07), vec3(0.06,0.3,0.86), uDay), hor = mix(vec3(0.05,0.06,0.14), vec3(0.62,0.8,0.98), uDay), gnd = mix(vec3(0.02,0.02,0.03), vec3(0.42,0.4,0.33), uDay);
          hor = mix(hor, vec3(1.0,0.55,0.22), uDusk*0.9); zen = mix(zen, vec3(0.36,0.3,0.5), uDusk*0.55);
          hor = mix(hor, vec3(0.98,0.78,0.52), uDay*0.35);
          vec3 c = mix(hor, zen, pow(clamp(y,0.0,1.0), 0.55));
          c = mix(c, gnd, smoothstep(0.0, -0.08, y));
          float sd = max(dot(d, uSun), 0.0);
          c += vec3(1.0,0.78,0.48) * pow(sd, 6.0) * 0.45 + vec3(1.0,0.9,0.7) * pow(sd, 900.0) * 18.0;
          // drifting clouds on a flat layer
          if (y > 0.02) {
            vec2 uv = d.xz / (y + 0.12) * 1.6 + vec2(uTime*0.006, uTime*0.002);
            float cl = smoothstep(0.52, 0.78, fbm(uv*1.3));
            vec3 cc = mix(vec3(1.0,0.97,0.92), vec3(0.62,0.64,0.7), smoothstep(0.6,0.95,fbm(uv*1.3+0.4)));
            cc += vec3(1.0,0.8,0.5) * pow(sd, 8.0) * 0.6;
            c = mix(c, cc, cl * smoothstep(0.02, 0.25, y) * 0.92);
          }
          // stars + moon at night
          float night = 1.0 - uDay;
          if (night > 0.01 && y > 0.0) {
            vec3 sd3 = floor(d * 380.0); float st = fract(sin(dot(sd3, vec3(12.9898,78.233,37.719)))*43758.5453);
            c += vec3(0.9,0.95,1.0) * step(0.9975, st) * night * (0.6 + 0.4*sin(uTime*3.0 + st*80.0)) * smoothstep(0.0, 0.2, y);
            float md = max(dot(d, uMoon), 0.0);
            c += vec3(0.85,0.9,1.0) * (pow(md, 2400.0) * 6.0 + pow(md, 40.0) * 0.15) * night;
          }
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(450, 48, 24), mat); this.sky.frustumCulled = false; this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog(0xe8cfa6, 60, 330);
    this.scene.background = new THREE.Color(0xe8cfa6);
  }
  envFrom(renderer) {
    const pm = new THREE.PMREMGenerator(renderer);
    const s = new THREE.Scene(); const sk = this.sky.clone(); s.add(sk);
    const rt = pm.fromScene(s, 0.02); this.scene.environment = rt.texture; this.scene.environmentIntensity = 0.7; pm.dispose();
  }
  _lights() {
    this.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x5a4630, 0.85); this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffe2b8, 3.0); this.sun = sun;
    sun.castShadow = this.q.shadows; sun.shadow.mapSize.set(this.q.shadowMap, this.q.shadowMap);
    const c = sun.shadow.camera; c.left = -28; c.right = 28; c.top = 28; c.bottom = -28; c.near = 1; c.far = 160;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    this.moon = new THREE.DirectionalLight(0x8fa8ff, 0); this.moon.position.set(30, 60, -20); this.scene.add(this.moon);
  }
  // ---------------- day / night ----------------
  setTime(h) {
    this.hour = h;
    const a = (h - 6) / 12 * Math.PI; // sunrise 6h, sunset 18h
    const elev = Math.sin(a), az = -0.7 + (h - 6) / 12 * 1.9;
    const day = THREE.MathUtils.smoothstep(elev, -0.12, 0.18);
    const dusk = Math.max(0, 1 - Math.abs(elev) / 0.42) * (1 - 0.3 * (1 - day));
    // sun (or moon at night) drives the shadow-casting light
    if (elev > -0.05) this.sunDir.set(Math.cos(az) * Math.cos(a) * -0.9, Math.max(0.06, elev), Math.sin(az) * -0.9 - 0.3).normalize();
    else { const m = (h < 6 ? h + 24 : h) - 18; const ma = m / 12 * Math.PI; this.sunDir.set(-Math.cos(ma) * 0.6, Math.max(0.25, Math.sin(ma) * 0.8), 0.55).normalize(); }
    const U = this.sky.material.uniforms; U.uDay.value = day; U.uDusk.value = dusk; U.uSun.value.copy(this.sunDir); U.uMoon.value.copy(this.sunDir);
    const sunCol = new THREE.Color(0xffe0a8).lerp(new THREE.Color(0xff8030), dusk * 0.85);
    this.sun.color.copy(day > 0.02 ? sunCol : new THREE.Color(0x9ab4ff));
    this.sun.intensity = day > 0.02 ? 3.4 * day * (1 - dusk * 0.2) + 0.05 : 0.35;
    this.hemi.intensity = 0.12 + 0.75 * day; this.hemi.color.setHSL(0.6, 0.5, 0.45 + 0.3 * day);
    const fog = new THREE.Color(0x0b0d18).lerp(new THREE.Color(0xe8cfa6), day).lerp(new THREE.Color(0xf0a060), dusk * 0.55);
    this.scene.fog.color.copy(fog); this.scene.background.copy(fog);
    this.scene.environmentIntensity = 0.12 + 0.6 * day;
    const night = 1 - day;
    this.moon.intensity = night * 0.6;
    this.night = night; this.dusk = dusk;
  }
  followSun(p) { // shadow frustum follows the player, snapped to texels to avoid shimmering
    const s = 56 / this.q.shadowMap; const x = Math.round(p.x / s) * s, z = Math.round(p.z / s) * s;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.sunDir.x * 80, this.sunDir.y * 80, z + this.sunDir.z * 80);
  }

  // ---------------- the sea of potatoes (ground surface) ----------------
  _sea() {
    const M = this.M, size = 700, seg = 260;
    const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    // denser vertices near the centre: remap radially so the dunes stay smooth up close
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i); const r = Math.hypot(x, z) / (size / 2), k = r < 1e-6 ? 1 : Math.pow(r, 1.8) / r;
      x *= k; z *= k; p.setX(i, x); p.setZ(i, z); p.setY(i, ground(x, z) - 0.03); uv.setXY(i, x / 2.4, z / 2.4);
    }
    g.computeVertexNormals();
    // support surface under the pile: no texture at all, only the deep shadow between the
    // potatoes — everything visible above it is the real 3D potato carpet
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.2, 0.135, 0.075), roughness: 1 });
    this.seaMat = mat;
    const sea = new THREE.Mesh(g, mat); sea.receiveShadow = true; this.scene.add(sea); this.sea = sea;
    this.carpet = new PotatoCarpet(this.scene, (x, z) => ground(x, z), this.q, this.jarClear || { x: 0, z: 0, r: 7.5 });
  }

  // ---------------- potatoes ----------------
  _potatoes() {
    const n = this.q.field;
    this.db = new PotatoDB(n + 64);
    const r = rng(this.seed); this.rand = r;
    for (let k = 0; k < n; k++) { const i = this.db.add(); this.db.randomTraits(i, r); this._randomSpot(i, r); }
    this.field = new PotatoField(this.scene, this.db, {});
    this.field.build();
    this.regrow = []; this.growing = []; this.gen = new Uint16Array(this.db.cap); this.depth = new Uint8Array(this.db.cap);
  }
  // uniform over the sea (denser toward the centre), never inside a structure
  _randomSpot(i, r, near) {
    let x, z, tries = 0;
    do {
      if (near && tries < 6) { x = near.x + (r() - 0.5) * 5; z = near.z + (r() - 0.5) * 5; }
      else { const a = r() * TAU, d = Math.pow(r(), 0.62) * (FIELD.x1 - 1.5); x = Math.cos(a) * d; z = Math.sin(a) * d; }
      tries++;
    } while ((cleared(x, z, 0.3) || Math.abs(x) > FIELD.x1 - 1 || Math.abs(z) > FIELD.z1 - 1) && tries < 30);
    const d = this.db; d.px[i] = x; d.pz[i] = z; d.py[i] = ground(x, z) + 0.03 + d.size[i] * 0.052 * d.flat[i] * 0.8;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.8, r() * TAU, (r() - 0.5) * 0.7)); d.setQuat(i, q);
  }
  // a potato under the player's feet becomes a physics body for a moment (no regrowth)
  kick(i) { if (this.db.state[i] !== 0) return false; this.field.remove(i); this.db.state[i] = 2; return true; }
  // put a (kicked) potato back into the sea at its resting pose
  restore(i, x, y, z, q) {
    const d = this.db; d.px[i] = x; d.py[i] = y; d.pz[i] = z; d.setQuat(i, q); d.state[i] = 0; this.field.place(i);
  }
  take(i) { // a field potato was picked: hide it, schedule regrowth
    if (this.db.state[i] !== 0) return; this.field.remove(i); this.db.state[i] = 1; this.onTake?.(i);
    if (this.db.variety[i] === 4) this.onPurple?.(i, this.depth[i]);
    // digging: the potato that lay underneath shows up in the hole a moment later; the deeper
    // you dig at the same spot, the better the odds of a rare purple one. After DIG_MAX layers
    // the hole is exhausted and that potato regrows somewhere else on the surface.
    const dp = this.depth[i] + 1;
    if (dp < DIG_MAX) { this.depth[i] = dp; this.regrow.push({ i, at: this.time + 0.45, dig: true }); }
    else { this.depth[i] = 0; this.regrow.push({ i, at: this.time + this.regrowDelay() }); }
  }
  regrowDelay() { return (14 + this.rand() * 22) * (this.growthMul || 1) * (this.rainMul || 1); }
  update(dt, camPos, fx) {
    this.time += dt; if (this.windU) this.windU.value += dt; this.sky.material.uniforms.uTime.value += dt;
    this.sky.position.copy(camPos);
    // regrowth: new random traits, pops out of the soil with a bounce + dirt puff
    for (let k = this.regrow.length - 1; k >= 0; k--) {
      const g = this.regrow[k]; if (g.at > this.time) continue;
      this.regrow.splice(k, 1);
      // deterministic per (potato id, generation): every co-op client regrows the same potato at the same spot
      const i = g.i; this.gen[i]++; const r = rng(hash32(i * 7919 ^ this.gen[i] * 104729 ^ this.seed));
      this.db.randomTraits(i, r);
      if (g.dig) {
        const d = this.depth[i], db = this.db;
        if (r() < PURPLE[d]) db.variety[i] = 4;
        db.py[i] = ground(db.px[i], db.pz[i]) + 0.03 + db.size[i] * 0.052 * db.flat[i] * 0.8 - Math.min(0.07, d * 0.012);
        db.px[i] += (r() - 0.5) * 0.08; db.pz[i] += (r() - 0.5) * 0.08;
        _gq.setFromEuler(_ge.set((r() - 0.5) * 0.9, r() * TAU, (r() - 0.5) * 0.8)); db.setQuat(i, _gq);
      } else {
        if (this.goldBoost && r() < this.goldBoost) this.db.variety[i] = 5;
        this._randomSpot(i, r, r() < 0.5 ? { x: this.db.px[i], z: this.db.pz[i] } : null);
      }
      this.field.place(i); this.growing.push({ i, t: 0 });
      if (fx && Math.hypot(this.db.px[i] - camPos.x, this.db.pz[i] - camPos.z) < 18) fx.dirt(this.db.px[i], this.db.py[i], this.db.pz[i], 6);
    }
    const m = _gm, sv = _gv;
    for (let k = this.growing.length - 1; k >= 0; k--) {
      const g = this.growing[k]; g.t += dt;
      if (this.db.state[g.i] !== 0) { this.growing.splice(k, 1); continue; }
      const s = Math.max(0.001, easeOutBack(Math.min(1, g.t / 0.7), 2.2));
      this.db.matrix(g.i, m); m.scale(sv.set(s, s, s)); this.field.setMatrix(g.i, m);
      if (g.t >= 0.7) { this.growing.splice(k, 1); }
    }
    this.field.update(camPos, this.q, dt);
    this.carpet.update(camPos);
  }
}

const _gm = new THREE.Matrix4(), _gv = new THREE.Vector3(), _gq = new THREE.Quaternion(), _ge = new THREE.Euler();
// digging: chance of a purple potato per layer (0 = surface: never)
export const DIG_MAX = 9;
const PURPLE = [0, 0.01, 0.02, 0.035, 0.05, 0.07, 0.09, 0.12, 0.16];
