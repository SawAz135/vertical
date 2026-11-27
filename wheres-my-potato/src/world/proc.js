import * as THREE from 'three';
import { GLSL_NOISE, TAU } from '../core/util.js';
import { VARIETIES, R0 } from './potatoes.js';
import { digMap, DIG_GLSL, DIG } from './dig.js';

// =====================================================================================
// PROCEDURAL 3D POTATOES (GPU) — real, lit, shadowed, deformed 3D potatoes generated
// entirely in the vertex shader from gl_InstanceID: no per-instance buffers, no texture
// of potatoes anywhere. Two placements share the same potato shading:
//   • PotatoCarpet: the endless potato desert. Camera-centred clipmap rings (each ring
//     doubles the cell size), two staggered layers so it is a tight pile, heights from a
//     baked height field (dunes + mountains), cells are world-locked (no swimming).
//   • JarFill: the potatoes stacked against the jar glass + the domed top surface.
// Far potatoes grow slowly with distance so they never fall below ~2 px (no shimmer).
// =====================================================================================

// beige-realistic palette (golden potatoes are never part of the pile)
const PILE = VARIETIES.filter(v => v.id !== 'doree');
const COLS = PILE.map(v => new THREE.Vector3(...v.col));

const COMMON = /* glsl */`
${GLSL_NOISE}
uniform vec3 uPCol[5];
varying vec3 vPD; varying vec4 vPM;
bool gAlive; float gPurple = 0.0; // chance of a rare purple potato in this placement
mat3 wmpRotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.0,-s, 0.0,1.0,0.0, s,0.0,c); }
mat3 wmpRotX(float a){ float c=cos(a), s=sin(a); return mat3(1.0,0.0,0.0, 0.0,c,s, 0.0,-s,c); }
mat3 wmpRotZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0.0, -s,c,0.0, 0.0,0.0,1.0); }
float wmpH2(vec2 p, float k){ return wmpH3(vec3(p, k)); }
`;

// vertex body: needs the placement to define  bool wmpPlace(out vec3 P, out float S, out vec4 R, out float AO)
const VERT_NORMAL = /* glsl */`
vec3 pP; float pS; vec4 pR; float pAO;
gAlive = wmpPlace(pP, pS, pR, pAO);
vec3 wn = normalize(position);
float elong = 1.08 + pR.y * 0.42, flt = 0.78 + pR.z * 0.16, bend = pR.w < 0.7 ? pR.w * 0.14 : (pR.w - 0.7) * 1.2;
float seed = pR.x * 97.0;
vec3 q = wn;
if (gAlive) {
  float r = 1.0 + 0.09 * wmpNoise(wn * 2.1 + seed) + 0.035 * wmpNoise(wn * 5.3 + seed * 1.7);
#ifdef WMP_HQ
  r -= 0.02 * smoothstep(0.55, 0.9, wmpNoise(wn * 9.0 + seed * 3.1));
#endif
  q = wn * r; q.y += bend * q.x * q.x * 1.35 - bend * 0.32;
}
mat3 rot = wmpRotY(pR.x * 6.2831 + pR.y * 17.0) * wmpRotX((fract(pR.z * 13.7) - 0.5) * 0.7) * wmpRotZ((fract(pR.w * 7.3) - 0.5) * 0.6);
vec3 sc = vec3(elong, flt, 1.0);
vec3 objectNormal = normalize(rot * (normalize(q) / sc));
vec3 gPos = gAlive ? pP + rot * (q * sc) * (pS * ${R0.toFixed(4)}) : vec3(0.0, -1.0e4, 0.0);
// contact shading: undersides and deeper layers are darker (potatoes shadow each other)
float vy = (rot * wn).y;
float vari = fract(pR.x * 31.7 + pR.y * 5.1);
// golden potatoes on top; the rare purple ones only show up deeper in the pile
float vf = vari < 0.72 ? 0.0 : 1.0; if (fract(pR.y * 47.3 + pR.z * 3.7) < gPurple) vf = 4.0;
vPD = wn; vPM = vec4(seed, vf, pAO * mix(0.42, 1.0, smoothstep(-0.75, 0.55, vy)), pR.w);
`;

const FRAG = /* glsl */`
{
  vec3 n = normalize(vPD); float seed = vPM.x;
  vec3 base = uPCol[int(vPM.y + 0.5)];
  float tone = wmpNoise(n * 3.0 + seed) * 0.5 + 0.5;
  float fine = wmpNoise(n * 24.0 + seed * 2.0);
  vec3 col = base * (0.84 + tone * 0.24) + fine * 0.025;
  col *= 1.0 - 0.05 * smoothstep(0.2, 0.7, abs(wmpNoise(n * 14.0 + seed)));
  float e = wmpNoise(n * 9.0 + seed * 3.1);
  col = mix(col, col * vec3(0.72, 0.6, 0.5), smoothstep(0.7, 0.9, e) * 0.8);
#ifdef WMP_HQ
  float sp1 = wmpNoise(n * 46.0 + seed * 4.0);
  col = mix(col, vec3(0.38, 0.27, 0.16), smoothstep(0.84, 0.93, sp1) * 0.6);
#endif
  float d = wmpNoise(n * 4.2 + seed * 5.0 + 10.0);
  col = mix(col, vec3(0.5, 0.38, 0.24), smoothstep(0.35, 0.85, d) * 0.3);
  // occasional dark spot
  if (vPM.w > 0.86) { float sd = dot(n, normalize(vec3(sin(seed), cos(seed * 1.3), sin(seed * 2.1)))) + wmpNoise(n * 7.0 + seed) * 0.04; col = mix(col, vec3(0.14, 0.09, 0.06), smoothstep(0.93, 0.96, sd) * 0.9); }
  col *= vPM.z;
  diffuseColor.rgb = pow(clamp(col, 0.0, 1.5), vec3(2.2));
}`;

function procMaterial(key, placementGLSL, uniforms, hq) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, color: 0xffffff });
  const U = Object.assign({ uPCol: { value: COLS } }, uniforms);
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    const def = hq ? '#define WMP_HQ\n' : '';
    sh.vertexShader = def + sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + COMMON + placementGLSL)
      .replace('#include <beginnormal_vertex>', VERT_NORMAL)
      .replace('#include <begin_vertex>', 'vec3 transformed = gPos;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nif (!gAlive) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);');
    sh.fragmentShader = def + sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_NOISE}\nuniform vec3 uPCol[5]; varying vec3 vPD; varying vec4 vPM;`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = mix(0.74, 0.52, smoothstep(0.3, 0.8, wmpNoise(normalize(vPD) * 6.0 + vPM.x)));`);
  };
  m.customProgramCacheKey = () => 'wmp-proc-' + key + (hq ? '-hq' : '');
  m.userData.U = U;
  return m;
}
function potatoGeo(detail) {
  // merged icosphere so the deformation keeps a watertight surface
  const g = new THREE.IcosahedronGeometry(1, detail), pos = g.attributes.position, map = new Map(), verts = [], idx = [];
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    let j = map.get(key); if (j === undefined) { j = verts.length / 3; verts.push(pos.getX(i), pos.getY(i), pos.getZ(i)); map.set(key, j); }
    idx.push(j);
  }
  const out = new THREE.InstancedBufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(verts.slice(), 3));
  out.setIndex(idx);
  return out;
}

// ------------------------------------------------------------------------------------
// height field: baked once (near: fine grid, far: coarse grid up to the mountains)
// ------------------------------------------------------------------------------------
function heightTex(fn, half, n) {
  const data = new Uint16Array(n * n), step = (2 * half) / (n - 1);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) data[j * n + i] = THREE.DataUtils.toHalfFloat(fn(-half + i * step, -half + j * step));
  const t = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.HalfFloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
}

const CARPET_GLSL = /* glsl */`
${DIG_GLSL}
uniform vec3 uCam; uniform float uS, uSP, uN, uLvl, uLayers, uRmax, uD1, uL0;
uniform sampler2D uHN, uHF; uniform vec3 uHNI, uHFI; // half extent, texel count
uniform vec4 uJarC; // x, z, radius (no potatoes inside the jar plinth)
float wmpHgtT(sampler2D t, vec3 I, vec2 p){ vec2 uv = (p + I.x) / (2.0 * I.x); uv = (uv * (I.y - 1.0) + 0.5) / I.y; return texture(t, uv).r; }
float wmpHgt(vec2 p){ vec2 a = abs(p); return max(a.x, a.y) < uHNI.x - 1.0 ? wmpHgtT(uHN, uHNI, p) : wmpHgtT(uHF, uHFI, p); }
bool wmpPlace(out vec3 P, out float S, out vec4 R, out float AO){
  float id = float(gl_InstanceID), NN = uN * uN, layer = uL0;
  if (id >= NN) { layer = 1.0; id -= NN; }
  vec2 cc = floor(uCam.xz / uS);
  vec2 cell = cc + vec2(mod(id, uN), floor(id / uN)) - uN * 0.5;
  float k = layer * 3.0 + uLvl * 7.0;
  R = vec4(wmpH2(cell, k + 0.11), wmpH2(cell, k + 1.37), wmpH2(cell, k + 2.71), wmpH2(cell, k + 4.13));
  vec2 jit = vec2(wmpH2(cell, k + 5.9), wmpH2(cell, k + 6.7)) - 0.5;
  vec2 wp = (cell + 0.5 + layer * 0.5 + jit * 0.55) * uS; // gentle jitter: no clumps, no holes
  S = 1.0; AO = 1.0; P = vec3(0.0);
  // the finer ring already covers this cell
  if (uLvl > 0.5) { vec2 c2 = floor(wp / uSP) - floor(uCam.xz / uSP); if (all(greaterThanEqual(c2, vec2(-uN * 0.5))) && all(lessThan(c2, vec2(uN * 0.5)))) return false; }
  vec2 dc = wp - uCam.xz; float dist = length(dc);
  if (dist > uRmax) return false;
  if (length(wp - uJarC.xy) < uJarC.z) return false;
  float grow = max(1.0, dist / uD1);
  S = (0.95 + R.y * 0.35) * grow * (1.0 - layer * 0.04);
  float dug = wmpDig(wp);
  float h = wmpHgt(wp) + dug;
  P = vec3(wp.x, h + ${R0.toFixed(4)} * S * (0.34 - layer * 0.62) + (R.z - 0.5) * 0.02 * grow, wp.y);
  // cheap frustum rejection before any deformation work
  vec4 cp = projectionMatrix * viewMatrix * vec4(P, 1.0);
  float rad = ${R0.toFixed(4)} * S * 2.2;
  if (cp.w < -rad) return false;
  float m = cp.w * 1.04 + rad * 3.0;
  if (abs(cp.x) > m || abs(cp.y) > m) return false;
  AO = layer > 0.5 ? 0.72 : 1.0; gPurple = (layer > 0.5 && uLvl < 2.5 ? 0.05 : 0.0) + clamp(-dug * 0.35, 0.0, 0.3); // deeper = more purple
  AO *= 1.0 - clamp(-dug * 0.45, 0.0, 0.4); // the bottom of a hole is in shade
  return true;
}`;

export class PotatoCarpet {
  constructor(scene, ground, q, jar) {
    const N = q.carpet || 220, levels = 7, S0 = 0.1;
    this.near = heightTex(ground, 64, 513); this.far = heightTex(ground, 440, 881);
    this.levels = [];
    for (let l = 0; l < levels; l++) {
      const s = S0 * 2 ** l, layers = l === 0 ? 1 : 2;
      const U = {
        uCam: { value: new THREE.Vector3() }, uS: { value: s }, uSP: { value: s / 2 }, uN: { value: N }, uLvl: { value: l }, uLayers: { value: layers },
        uRmax: { value: 430 }, uD1: { value: Math.max(7, N * 0.07) },
        uHN: { value: this.near }, uHF: { value: this.far }, uHNI: { value: new THREE.Vector3(64, 513, 0) }, uHFI: { value: new THREE.Vector3(440, 881, 0) },
        uJarC: { value: new THREE.Vector4(jar.x, jar.z, jar.r, 0) },
        uDig: digMap.uniforms.uDig, uDigI: digMap.uniforms.uDigI,
      };
      U.uL0 = { value: 0 };
      const mat = procMaterial('carpet', CARPET_GLSL, U, l === 0);
      const geo = potatoGeo(l === 0 ? 1 : 0); geo.instanceCount = N * N * layers;
      const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false;
      mesh.matrixAutoUpdate = false; mesh.renderOrder = -1;
      scene.add(mesh); this.levels.push({ mesh, U });
      if (l === 0) { // the layer underneath, staggered half a cell: fills every gap at your feet (light mesh, mostly hidden)
        const U2 = Object.assign({}, U, { uL0: { value: 1 } });
        const g2 = potatoGeo(0); g2.instanceCount = N * N;
        const m2 = new THREE.Mesh(g2, procMaterial('carpet', CARPET_GLSL, U2, false)); m2.frustumCulled = false; m2.receiveShadow = true; m2.matrixAutoUpdate = false; m2.renderOrder = -1;
        scene.add(m2); this.levels.push({ mesh: m2, U: U2 });
      }
    }
    this.count = this.levels.reduce((s, l) => s + l.mesh.geometry.instanceCount, 0);
    // fine support floor over the diggable area: follows the holes (the coarse far floor is cut out there)
    const fg = new THREE.PlaneGeometry(2 * DIG.HALF, 2 * DIG.HALF, 256, 256); fg.rotateX(-Math.PI / 2);
    const fm = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.42, 0.29, 0.13), roughness: 1 });
    const FU = { uHN: { value: this.near }, uHNI: { value: new THREE.Vector3(64, 513, 0) }, uDig: digMap.uniforms.uDig, uDigI: digMap.uniforms.uDigI };
    fm.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, FU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
${DIG_GLSL}
uniform sampler2D uHN; uniform vec3 uHNI;
float fH(vec2 p){ vec2 uv = (p + uHNI.x) / (2.0 * uHNI.x); uv = (uv * (uHNI.y - 1.0) + 0.5) / uHNI.y; return texture(uHN, uv).r + wmpDig(p) - 0.03; }`)
        .replace('#include <beginnormal_vertex>', `vec2 fp = position.xz; float e = 0.25;
vec3 objectNormal = normalize(vec3(fH(fp - vec2(e, 0.0)) - fH(fp + vec2(e, 0.0)), 2.0 * e, fH(fp - vec2(0.0, e)) - fH(fp + vec2(0.0, e))));`)
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.x, fH(position.xz), position.z);');
    };
    fm.customProgramCacheKey = () => 'wmp-digfloor';
    this.floor = new THREE.Mesh(fg, fm); this.floor.receiveShadow = true; this.floor.frustumCulled = false; this.floor.renderOrder = -2; scene.add(this.floor);
  }
  update(camPos) { for (const l of this.levels) l.U.uCam.value.copy(camPos); }
}

// ------------------------------------------------------------------------------------
// jar fill: potatoes against the glass (staggered rings) + sunflower-packed domed top
// ------------------------------------------------------------------------------------
const JAR_GLSL = /* glsl */`
uniform vec3 uJC; uniform float uJR, uJYb, uJTop, uJDome, uJPer, uJRowH, uJTopN; uniform vec3 uCamP; uniform vec2 uLod;
bool wmpPlace(out vec3 P, out float S, out vec4 R, out float AO){
  float id = float(gl_InstanceID);
  R = vec4(wmpH2(vec2(id, 1.3), 0.7), wmpH2(vec2(id, 2.9), 1.1), wmpH2(vec2(id, 4.1), 2.3), wmpH2(vec2(id, 7.7), 3.9));
  S = 0.82 + R.y * 0.4; AO = 1.0; P = vec3(0.0);
  float fill = uJTop - uJYb; if (fill < 0.03) return false;
  if (id < uJTopN) {
    // golden-angle disc on the (domed) top
    float t = (id + 0.5) / uJTopN, r = (uJR - 0.12) * sqrt(t), a = id * 2.39996323;
    float d2 = (r * r) / (uJR * uJR);
    P = vec3(uJC.x + cos(a) * r, uJTop + uJDome * max(0.0, 1.0 - d2) + 0.02 + (R.z - 0.5) * 0.03, uJC.z + sin(a) * r);
  } else {
    float k = id - uJTopN, row = floor(k / uJPer), i = mod(k, uJPer);
    float y = uJYb + (row + 0.5) * uJRowH + (R.z - 0.5) * 0.025;
    if (y > uJTop - 0.02) return false;
    float a = (i + 0.5 * mod(row, 2.0) + (R.w - 0.5) * 0.35) / uJPer * 6.2831853;
    vec2 dir = vec2(cos(a), sin(a));
    // only the half facing the camera is visible through the glass (the dark core hides the rest)
    vec2 tc = uCamP.xz - uJC.xz; if (dot(dir, tc) < -0.35 * uJR) return false;
    float rr = uJR - 0.07 - R.x * 0.03;
    P = vec3(uJC.x + dir.x * rr, y, uJC.z + dir.y * rr);
  }
  gPurple = 0.025;
  float dl = distance(P, uCamP); if (dl < uLod.x || dl >= uLod.y) return false; // near: detailed mesh, far: light mesh
  vec4 cp = projectionMatrix * viewMatrix * vec4(P, 1.0);
  float rad = 0.15, m = cp.w * 1.04 + rad * 3.0;
  if (cp.w < -rad || abs(cp.x) > m || abs(cp.y) > m) return false;
  return true;
}`;

export class JarFill {
  constructor(scene, J) {
    const per = Math.round(TAU * (J.R - 0.08) / 0.1), rowH = 0.082, rows = Math.ceil((J.rim - J.yb) / rowH) + 1;
    const topN = Math.round(Math.PI * (J.R - 0.1) ** 2 / 0.0095);
    this.per = per; this.rowH = rowH; this.rows = rows; this.topN = topN; this.J = J;
    this.U = {
      uJC: { value: new THREE.Vector3(J.x, 0, J.z) }, uJR: { value: J.R }, uJYb: { value: J.yb }, uJTop: { value: J.yb }, uJDome: { value: 0 },
      uJPer: { value: per }, uJRowH: { value: rowH }, uJTopN: { value: topN }, uCamP: { value: new THREE.Vector3() },
    };
    // two LODs sharing the placement: detailed potatoes within 14 m of the camera, light ones beyond
    this.meshes = [[1, 0, 14, true], [0, 14, 1e9, false]].map(([det, a, b, hq]) => {
      const U = Object.assign({}, this.U, { uLod: { value: new THREE.Vector2(a, b) } });
      const geo = potatoGeo(det); geo.instanceCount = 0;
      const mesh = new THREE.Mesh(geo, procMaterial('jar' + det, JAR_GLSL, U, hq));
      mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; scene.add(mesh);
      return mesh;
    });
    this.mesh = this.meshes[0]; this.geo = this.meshes[0].geometry;
  }
  set(top, dome) {
    this.U.uJTop.value = top; this.U.uJDome.value = dome;
    const h = top - this.J.yb;
    const n = h < 0.03 ? 0 : this.topN + Math.min(this.rows, Math.ceil(h / this.rowH) + 1) * this.per;
    for (const m of this.meshes) { m.geometry.instanceCount = n; m.visible = n > 0; }
  }
  update(camPos) { this.U.uCamP.value.copy(camPos); }
}
