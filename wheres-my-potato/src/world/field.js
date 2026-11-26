import * as THREE from 'three';
import { PotatoDB, PotatoField } from './potatoes.js';
import { Batcher, boxGeo } from './build.js';
import { bareTree, fence } from './props.js';
import { rng, fbm2, clamp, smooth, TAU, easeOutBack } from '../core/util.js';
import { canvasTex, textCanvas } from '../gfx/textures.js';

// =====================================================================================
// OPEN-AIR POTATO FIELD: terrain with furrows, sky dome + sun, trees, barn, animated grass,
// fence, and the field potatoes (instanced) that regrow after being picked.
// =====================================================================================
export const FIELD = { x0: -30, x1: 30, z0: -36, z1: 12 };
const FURROW = 0.9;

export function fieldMask(x, z) {
  const e = 1.2;
  return smooth(clamp(Math.min(x - FIELD.x0, FIELD.x1 - x, z - FIELD.z0, FIELD.z1 - z) / e, 0, 1));
}
export function ground(x, z) {
  const base = fbm2(x * 0.025 + 3, z * 0.025 - 2, 3) * 0.9;
  const yard = smooth(clamp((z - 14) / 6, 0, 1));            // flatten the farmyard
  const flatYard = base * (1 - yard) + yard * 0.0;
  const f = fieldMask(x, z);
  const furrow = (Math.cos(z * TAU / FURROW) * 0.5 + 0.5) * 0.16 * f;
  // rise towards the horizon outside the playable area
  const out = Math.max(0, Math.hypot(x, z - 2) - 48);
  return flatYard * (0.6 + 0.4 * f) + furrow + out * out * 0.02 - 0.08 * f;
}
export function inField(x, z) { return x > FIELD.x0 + 0.3 && x < FIELD.x1 - 0.3 && z > FIELD.z0 + 0.3 && z < FIELD.z1 - 0.3; }

export class FieldWorld {
  constructor(scene, M, quality, seed = 1987) {
    this.scene = scene; this.M = M; this.q = quality; this.seed = seed;
    this.colliders = []; // player: {min,max} boxes and {x,z,r} circles
    this.time = 0;
    this._sky(); this._lights(); this._terrain(); this._grass(); this._scenery(); this._potatoes();
  }

  // ---------------- sky ----------------
  _sky() {
    const sunDir = new THREE.Vector3(-0.55, 0.42, -0.72).normalize(); this.sunDir = sunDir;
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uSun: { value: sunDir }, uTime: { value: 0 } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }`,
      fragmentShader: `varying vec3 vP; uniform vec3 uSun; uniform float uTime;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
        void main(){
          vec3 d = normalize(vP); float y = d.y;
          vec3 zen = vec3(0.16,0.36,0.72), hor = vec3(0.86,0.8,0.68), gnd = vec3(0.42,0.4,0.33);
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
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(450, 48, 24), mat); this.sky.frustumCulled = false; this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog(0xcfc7b0, 70, 300);
    this.scene.background = new THREE.Color(0xcfc7b0);
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
  }
  followSun(p) { // shadow frustum follows the player, snapped to texels to avoid shimmering
    const s = 56 / this.q.shadowMap; const x = Math.round(p.x / s) * s, z = Math.round(p.z / s) * s;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.sunDir.x * 80, this.sunDir.y * 80, z + this.sunDir.z * 80);
  }

  // ---------------- terrain ----------------
  _terrain() {
    const M = this.M;
    // field (soil, high resolution for furrows)
    const fw = FIELD.x1 - FIELD.x0 + 4, fd = FIELD.z1 - FIELD.z0 + 4;
    const fg = new THREE.PlaneGeometry(fw, fd, Math.round(fw / 0.5), Math.round(fd / 0.15)); fg.rotateX(-Math.PI / 2);
    fg.translate((FIELD.x0 + FIELD.x1) / 2, 0, (FIELD.z0 + FIELD.z1) / 2);
    this._shape(fg, M.soil.userData.tile, 0);
    const soil = this.M.soil.clone(); soil.userData = { tile: 3 };
    // blend soil → grass at the field border via a mask in the shader (no hard seam)
    const grassMap = M.grass.map;
    soil.onBeforeCompile = sh => {
      sh.uniforms.uGrass = { value: grassMap }; sh.uniforms.uF = { value: new THREE.Vector4(FIELD.x0, FIELD.x1, FIELD.z0, FIELD.z1) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; uniform sampler2D uGrass; uniform vec4 uF;')
        .replace('#include <map_fragment>', `#include <map_fragment>
        float e = min(min(vW.x-uF.x, uF.y-vW.x), min(vW.z-uF.z, uF.w-vW.z));
        float gm = 1.0 - smoothstep(-0.6, 1.0, e + (texture2D(uGrass, vW.xz*0.13).g-0.3)*1.5);
        vec4 gc = texture2D(uGrass, vW.xz/2.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, gc.rgb, gm);
        // furrow crests drier/lighter, troughs darker and damp
        float fr = cos(vW.z*6.2831853/${FURROW.toFixed(2)})*0.5+0.5;
        diffuseColor.rgb *= mix(1.0, mix(0.78, 1.12, fr), 1.0-gm);`);
    };
    const fm = new THREE.Mesh(fg, soil); fm.receiveShadow = true; this.scene.add(fm);
    // surroundings (grass, coarse)
    const og = new THREE.PlaneGeometry(320, 320, 160, 160); og.rotateX(-Math.PI / 2); og.translate(0, 0, 2);
    this._shape(og, M.grass.userData.tile, 1);
    const gm = new THREE.Mesh(og, M.grass); gm.receiveShadow = true; this.scene.add(gm);
    // gravel farmyard under machine + shop
    const gravel = M.gravel.clone(); gravel.transparent = true; gravel.userData = M.gravel.userData;
    const alpha = canvasTex(textCanvas(256, 256, (x, w, h) => { const gr = x.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(0.8, '#fff'); gr.addColorStop(1, '#000'); x.fillStyle = gr; x.fillRect(0, 0, w, h); }), false);
    alpha.wrapS = alpha.wrapT = THREE.ClampToEdgeWrapping;
    gravel.alphaMap = alpha; gravel.depthWrite = false; gravel.polygonOffset = true; gravel.polygonOffsetFactor = -2;
    const yg = new THREE.PlaneGeometry(34, 18, 34, 18); yg.rotateX(-Math.PI / 2); yg.translate(0, 0, 24);
    const p = yg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), p.getZ(i)) + 0.012);
    yg.computeVertexNormals();
    gravel.map = gravel.map.clone(); gravel.map.repeat.set(34 / 2.2, 18 / 2.2); gravel.map.needsUpdate = true;
    gravel.normalMap = gravel.normalMap.clone(); gravel.normalMap.repeat.copy(gravel.map.repeat); gravel.normalMap.needsUpdate = true;
    gravel.roughnessMap = gravel.roughnessMap.clone(); gravel.roughnessMap.repeat.copy(gravel.map.repeat); gravel.roughnessMap.needsUpdate = true;
    const ym = new THREE.Mesh(yg, gravel); ym.receiveShadow = true; ym.renderOrder = 1; this.scene.add(ym);
  }
  _shape(g, tile, sink, lift = 0) {
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      let y = ground(x, z) + lift;
      if (sink && fieldMask(x, z) > 0.98) y -= 0.25; // hide under the field mesh
      p.setY(i, y); uv.setXY(i, x / tile, z / tile);
    }
    g.computeVertexNormals();
  }

  // ---------------- animated grass tufts ----------------
  _grass() {
    const n = this.q.grass; if (!n) return;
    const tex = canvasTex(textCanvas(128, 128, (x, w, h) => {
      x.clearRect(0, 0, w, h); const r = rng(5);
      for (let k = 0; k < 34; k++) {
        const bx = 20 + r() * 88, lean = (r() - 0.5) * 40, ht = 60 + r() * 64, g = 90 + r() * 70 | 0;
        const gr = x.createLinearGradient(0, h, 0, h - ht); gr.addColorStop(0, `rgb(40,${g - 30},20)`); gr.addColorStop(1, `rgb(${120 + r() * 60 | 0},${g + 40},50)`);
        x.fillStyle = gr; x.beginPath(); x.moveTo(bx - 3, h); x.quadraticCurveTo(bx + lean * 0.3, h - ht * 0.6, bx + lean, h - ht); x.quadraticCurveTo(bx + lean * 0.3 + 2, h - ht * 0.6, bx + 3, h); x.fill();
      }
    }), true);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const blade = new THREE.PlaneGeometry(0.7, 0.55); blade.translate(0, 0.27, 0);
    const b2 = blade.clone().rotateY(Math.PI / 2), b3 = blade.clone().rotateY(Math.PI / 4);
    const geo = new THREE.BufferGeometry();
    const merge = [blade, b2, b3]; const pos = [], nor = [], uv = [], idx = []; let off = 0;
    for (const g of merge) { pos.push(...g.attributes.position.array); for (let i = 0; i < g.attributes.position.count; i++) nor.push(0, 1, 0); uv.push(...g.attributes.uv.array); idx.push(...Array.from(g.index.array, v => v + off)); off += g.attributes.position.count; }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 });
    this.windU = { value: 0 };
    mat.onBeforeCompile = sh => {
      sh.uniforms.uWind = this.windU;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
        float sway = sin(uWind*1.7 + wp.x*0.35 + wp.z*0.22) * 0.5 + sin(uWind*3.1 + wp.x*0.9) * 0.18;
        transformed.x += sway * position.y * 0.32; transformed.z += sway * position.y * 0.12;`);
    };
    const im = new THREE.InstancedMesh(geo, mat, n); const r = rng(this.seed + 3); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let k = 0, tries = 0;
    while (k < n && tries++ < n * 8) {
      const x = (r() - 0.5) * 110, z = (r() - 0.5) * 110 + 2;
      if (fieldMask(x, z) > 0.05) continue;
      if (z > 14 && z < 34 && x > -17 && x < 17 && r() < 0.85) continue; // keep the yard mostly clear
      const s = 0.6 + r() * 0.9; e.set(0, r() * TAU, 0); q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, ground(x, z) - 0.02, z), q, new THREE.Vector3(s, s * (0.7 + r() * 0.6), s)); im.setMatrixAt(k++, m);
    }
    im.count = k; im.receiveShadow = true; this.scene.add(im);
  }

  // ---------------- scenery ----------------
  _scenery() {
    const M = this.M, B = new Batcher(), r = rng(this.seed + 9);
    // leafy trees around the farm
    const leafMats = [0x4f6e2a, 0x5f7d33, 0x3f5d27].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
    const blob = new THREE.IcosahedronGeometry(1, 1);
    for (let k = 0; k < 46; k++) {
      const a = r() * TAU, d = 44 + r() * 30; const x = Math.cos(a) * d, z = Math.sin(a) * d + 2;
      const t = new THREE.Group(); t.position.set(x, ground(x, z) - 0.1, z); const s = 0.8 + r() * 0.7; t.scale.setScalar(s);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 3.4, 8).translate(0, 1.7, 0), M.bark); trunk.castShadow = true; t.add(trunk);
      for (let b = 0; b < 7; b++) {
        const lm = new THREE.Mesh(blob, leafMats[(b + k) % 3]); lm.castShadow = true;
        lm.position.set((r() - 0.5) * 2.4, 3.6 + r() * 2.2, (r() - 0.5) * 2.4); lm.scale.set(1.3 + r(), 1.1 + r() * 0.7, 1.3 + r()); lm.rotation.set(r() * 3, r() * 3, r() * 3);
        t.add(lm);
      }
      B.addTree(t, { cast: true });
    }
    // a few bare old trees for silhouette variety
    for (let k = 0; k < 6; k++) { const a = r() * TAU, d = 40 + r() * 12; const t = bareTree(M, 50 + k, 7); t.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); B.addTree(t, { cast: true }); }
    // red barn + silo backdrop
    const barn = new THREE.Group(); barn.position.set(-24, 0, 33); barn.rotation.y = 0.15;
    const red = M.corrugatedRed, roofMat = M.corrugated;
    barn.add(Object.assign(new THREE.Mesh(boxGeo(12, 6, 9, 3), red), { castShadow: true })).children.at(-1).position.set(0, 3, 0);
    const roofG = new THREE.CylinderGeometry(0.01, 7.4, 3.4, 4, 1, true); roofG.rotateY(Math.PI / 4); roofG.scale(1.25, 1, 0.9);
    const roof = new THREE.Mesh(roofG, roofMat); roof.position.set(0, 7.7, 0); roof.castShadow = true; barn.add(roof);
    const white = new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.7 });
    const door = new THREE.Mesh(boxGeo(4, 4.4, 0.1, 2), M.woodDark); door.position.set(0, 2.2, -4.55); barn.add(door);
    for (const [w, h, x, y, rz] of [[4.4, 0.15, 0, 4.45, 0], [0.15, 4.4, -2.1, 2.2, 0], [0.15, 4.4, 2.1, 2.2, 0], [5.6, 0.15, 0, 2.2, 0.83], [5.6, 0.15, 0, 2.2, -0.83]]) { const b = new THREE.Mesh(boxGeo(w, h, 0.12, 1), white); b.position.set(x, y, -4.62); b.rotation.z = rz; barn.add(b); }
    B.addTree(barn, { cast: true });
    const silo = new THREE.Group(); silo.position.set(-15.5, 0, 37);
    silo.add(new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 11, 24, 1, true).translate(0, 5.5, 0), M.metal));
    silo.add(new THREE.Mesh(new THREE.SphereGeometry(2.3, 24, 10, 0, TAU, 0, Math.PI / 2).translate(0, 11, 0), M.paintGrey));
    B.addTree(silo, { cast: true });
    this.colliders.push({ min: new THREE.Vector3(-30.5, 0, 28), max: new THREE.Vector3(-17.5, 8, 38) }, { x: -15.5, z: 37, r: 2.5 });
    // fence around the farm (also the playable boundary)
    const L = 92, half = L / 2, cz = 3;
    for (const [x, z, ry] of [[0, cz - half, 0], [0, cz + half, 0], [-half, cz, Math.PI / 2], [half, cz, Math.PI / 2]]) {
      for (let s = -half + 6; s < half; s += 12) {
        const f = fence(M, 12); const ox = ry ? 0 : s, oz = ry ? s : 0; f.position.set(x + ox, ground(x + ox, z + oz), z + oz); f.rotation.y = ry;
        B.addTree(f, { cast: false });
      }
    }
    this.bounds = { x0: -half + 0.6, x1: half - 0.6, z0: cz - half + 0.6, z1: cz + half - 0.6 };
    // stray potato sacks and a wooden cart near the field edge
    for (let k = 0; k < 5; k++) {
      const x = -26 + k * 1.1, z = 15.5 + (k % 2) * 0.6;
      const jute = new THREE.MeshStandardMaterial({ map: M.canvas.map, normalMap: M.canvas.normalMap, color: 0xd8b887, roughness: 1 });
      const sack = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.26, 0.02], [0.31, 0.2], [0.29, 0.5], [0.17, 0.68], [0.05, 0.74], [0, 0.8]].map(p => new THREE.Vector2(...p)), 14), jute);
      sack.position.set(x, ground(x, z), z); sack.scale.set(1, 0.9 + (k % 3) * 0.1, 0.75); sack.rotation.y = k; sack.castShadow = true; B.addMesh(sack);
    }
    this.colliders.push({ min: new THREE.Vector3(-26.4, 0, 15.1), max: new THREE.Vector3(-21.3, 1, 16.5) });
    B.build(this.scene);
  }

  // ---------------- potatoes ----------------
  _potatoes() {
    const n = this.q.field;
    this.db = new PotatoDB(n + 64);
    const r = rng(this.seed); this.rand = r;
    for (let k = 0; k < n; k++) { const i = this.db.add(); this.db.randomTraits(i, r); this._randomSpot(i, r); }
    this.field = new PotatoField(this.scene, this.db, {});
    this.field.build();
    this.regrow = []; this.growing = [];
  }
  _randomSpot(i, r, near) {
    let x, z;
    if (near) { x = clamp(near.x + (r() - 0.5) * 6, FIELD.x0 + 0.5, FIELD.x1 - 0.5); z = clamp(near.z + (r() - 0.5) * 6, FIELD.z0 + 0.5, FIELD.z1 - 0.5); }
    else { x = FIELD.x0 + 0.5 + r() * (FIELD.x1 - FIELD.x0 - 1); z = FIELD.z0 + 0.5 + r() * (FIELD.z1 - FIELD.z0 - 1); }
    // potatoes sit on the furrow crests, half sunk in the soil
    if (r() < 0.8) z = Math.round(z / FURROW) * FURROW + r.gauss() * 0.12;
    const d = this.db; d.px[i] = x; d.pz[i] = z; d.py[i] = ground(x, z) + d.size[i] * 0.052 * d.flat[i] * 0.45;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.5, r() * TAU, (r() - 0.5) * 0.4)); d.setQuat(i, q);
  }
  take(i) { // a field potato was picked: hide it, schedule regrowth
    this.field.remove(i); this.db.state[i] = 1;
    this.regrow.push({ i, at: this.time + this.regrowDelay() });
  }
  regrowDelay() { return (14 + this.rand() * 22) * (this.growthMul || 1); }
  update(dt, camPos, fx) {
    this.time += dt; if (this.windU) this.windU.value += dt; this.sky.material.uniforms.uTime.value += dt;
    this.sky.position.copy(camPos);
    // regrowth: new random traits, pops out of the soil with a bounce + dirt puff
    for (let k = this.regrow.length - 1; k >= 0; k--) {
      const g = this.regrow[k]; if (g.at > this.time) continue;
      this.regrow.splice(k, 1);
      const i = g.i; this.db.randomTraits(i, this.rand);
      if (this.goldBoost && this.rand() < this.goldBoost) this.db.variety[i] = 5;
      this._randomSpot(i, this.rand, this.rand() < 0.5 ? { x: this.db.px[i], z: this.db.pz[i] } : null);
      this.field.place(i); this.growing.push({ i, t: 0 });
      if (fx && Math.hypot(this.db.px[i] - camPos.x, this.db.pz[i] - camPos.z) < 18) fx.dirt(this.db.px[i], this.db.py[i], this.db.pz[i], 6);
    }
    const m = new THREE.Matrix4(), sv = new THREE.Vector3();
    for (let k = this.growing.length - 1; k >= 0; k--) {
      const g = this.growing[k]; g.t += dt;
      if (this.db.state[g.i] !== 0) { this.growing.splice(k, 1); continue; }
      const s = Math.max(0.001, easeOutBack(Math.min(1, g.t / 0.7), 2.2));
      this.db.matrix(g.i, m); m.scale(sv.set(s, s, s)); this.field.setMatrix(g.i, m);
      if (g.t >= 0.7) { this.growing.splice(k, 1); }
    }
    this.field.update(camPos, this.q, dt);
  }
}
