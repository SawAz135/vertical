/* =====================================================================
   Roblox Forge · Jouer — world renderer.
   Turns a Forge map (real Roblox parts: Size, CFrame, Color, Material…) into a
   three.js scene that looks like the Roblox client: Roblox materials, sky,
   sun + shadows, atmosphere, bloom on Neon. Static parts are merged into a few
   big meshes (a voxel map has ~10 000 parts → ~20 draw calls); gameplay parts
   (coins, gates, movers, pads…) stay separate so they can move and hide.
   Collisions use one invisible collider per part in a spatial grid.
   ===================================================================== */
import * as THREE from 'three';
import * as MC from '../map/map-core.js';

const D2R = Math.PI / 180;

/* ---------- Roblox material textures (procedural, multiplied by the part colour) ---------- */
function noise(g, n, a, b, size = 128, r0 = 0.6, r1 = 2) { for (let i = 0; i < n; i++) { const v = Math.floor(a + Math.random() * (b - a)); g.fillStyle = `rgb(${v},${v},${v})`; const r = r0 + Math.random() * r1; g.fillRect(Math.random() * size, Math.random() * size, r, r); } }
function matCanvas(m) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 128, 128);
  const lines = (n, col, w, horiz = true, jitter = 0) => { g.strokeStyle = col; g.lineWidth = w; for (let i = 0; i < n; i++) { const p = (i + 0.5) * (128 / n) + (Math.random() - 0.5) * jitter; g.beginPath(); if (horiz) { g.moveTo(0, p); g.lineTo(128, p); } else { g.moveTo(p, 0); g.lineTo(p, 128); } g.stroke(); } };
  switch (m) {
    case 'Grass': case 'LeafyGrass': g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, 128, 128); noise(g, 1400, 170, 255, 128, 0.5, 1.6); if (m === 'LeafyGrass') noise(g, 160, 120, 170, 128, 2, 4); break;
    case 'Sand': case 'Snow': noise(g, 2200, m === 'Snow' ? 225 : 195, 255, 128, 0.4, 1.1); break;
    case 'Wood': g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(90,90,90,${0.15 + Math.random() * 0.25})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * 128; g.moveTo(0, y); g.bezierCurveTo(40, y + 6, 80, y - 6, 128, y); g.stroke(); } break;
    case 'WoodPlanks': g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, 128, 128); lines(4, 'rgba(60,60,60,.55)', 2); for (let r = 0; r < 4; r++) { const x = Math.random() * 128; g.fillStyle = 'rgba(60,60,60,.5)'; g.fillRect(x, r * 32, 2, 32); } noise(g, 300, 160, 220); break;
    case 'Brick': g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#efefef'; for (let r = 0; r < 8; r++) for (let k = -1; k < 4; k++) g.fillRect(k * 40 + (r % 2) * 20 + 2, r * 16 + 2, 36, 12); noise(g, 300, 170, 240); break;
    case 'Cobblestone': case 'Pebble': g.fillStyle = '#a8a8a8'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < (m === 'Pebble' ? 90 : 40); i++) { const v = 190 + Math.random() * 60; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.ellipse(Math.random() * 128, Math.random() * 128, (m === 'Pebble' ? 4 : 9) + Math.random() * 6, (m === 'Pebble' ? 3 : 7) + Math.random() * 5, Math.random() * 3, 0, 7); g.fill(); } break;
    case 'Concrete': case 'Pavement': case 'Asphalt': noise(g, 2600, m === 'Asphalt' ? 150 : 190, 250, 128, 0.4, 1.4); if (m === 'Pavement') { lines(4, 'rgba(90,90,90,.5)', 1.5); lines(4, 'rgba(90,90,90,.5)', 1.5, false); } break;
    case 'Slate': case 'Rock': case 'Basalt': case 'Granite': case 'Sandstone': g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 60; i++) { const v = 170 + Math.random() * 80; g.fillStyle = `rgba(${v},${v},${v},.6)`; g.beginPath(); g.ellipse(Math.random() * 128, Math.random() * 128, 6 + Math.random() * 18, 3 + Math.random() * 8, Math.random() * 3, 0, 7); g.fill(); }
      if (m === 'Sandstone') lines(10, 'rgba(120,120,120,.25)', 3, true, 6); if (m === 'Granite') noise(g, 900, 80, 255, 128, 0.6, 1.4); break;
    case 'Marble': g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 9; i++) { g.strokeStyle = `rgba(120,120,120,${0.2 + Math.random() * 0.3})`; g.lineWidth = 0.6 + Math.random() * 1.6; g.beginPath(); let x = Math.random() * 128, y = 0; g.moveTo(x, y); while (y < 128) { x += (Math.random() - 0.5) * 20; y += 8 + Math.random() * 10; g.lineTo(x, y); } g.stroke(); } break;
    case 'Metal': case 'CorrodedMetal': case 'Foil': for (let i = 0; i < 128; i++) { const v = 205 + Math.random() * 45; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, i, 128, 1); } if (m === 'CorrodedMetal') for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(110,90,70,${Math.random() * 0.5})`; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 9, 0, 7); g.fill(); } break;
    case 'DiamondPlate': g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#f5f5f5'; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.save(); g.translate(x * 16 + 8 + (y % 2) * 8, y * 16 + 8); g.rotate(y % 2 ? 0.8 : -0.8); g.fillRect(-6, -1.5, 12, 3); g.restore(); } break;
    case 'Fabric': for (let y = 0; y < 128; y += 4) for (let x = 0; x < 128; x += 4) { const v = ((x + y) / 4) % 2 ? 235 : 200; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 4, 4); } break;
    case 'CrackedLava': g.fillStyle = '#333'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#ffffff'; for (let i = 0; i < 18; i++) { g.lineWidth = 1 + Math.random() * 2.5; g.beginPath(); let x = Math.random() * 128, y = Math.random() * 128; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); } break;
    case 'Ice': case 'Glacier': g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(255,255,255,${0.5 + Math.random() * 0.5})`; g.lineWidth = 1 + Math.random() * 3; g.beginPath(); const x = Math.random() * 128; g.moveTo(x, 0); g.lineTo(x + 30, 128); g.stroke(); } noise(g, 200, 200, 230); break;
    case 'Truss': g.clearRect(0, 0, 128, 128); g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.strokeRect(6, 6, 116, 116); g.lineWidth = 9; g.beginPath(); g.moveTo(6, 6); g.lineTo(122, 122); g.moveTo(122, 6); g.lineTo(6, 122); g.stroke(); break;
    case 'Spawn': g.fillStyle = '#e0e0e0'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 46, 0, 7); g.fill(); g.strokeStyle = '#9a9a9a'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 26, 0.3, 5.6); g.stroke(); g.fillStyle = '#9a9a9a'; g.beginPath(); g.moveTo(90, 50); g.lineTo(98, 70); g.lineTo(78, 66); g.fill(); break;
    default: noise(g, 600, 215, 250, 128, 0.5, 1.2); // Plastic: the faint Roblox speckle
  }
  return c;
}
const texCache = new Map();
export function matTex(m) { if (texCache.has(m)) return texCache.get(m); const t = new THREE.CanvasTexture(matCanvas(m)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(m, t); return t; }

/* one material per (Roblox material, colour); "vc" variants take the colour from vertex colours (merged meshes) */
const matCache = new Map();
const ROUGH = { Marble: 0.25, Slate: 0.8, Granite: 0.6, Sand: 0.95, Snow: 0.9, Grass: 0.95, LeafyGrass: 0.95, SmoothPlastic: 0.32, Plastic: 0.55 };
export function material(p, special, vc = false) {
  const kind = special || p.material, key = `${vc ? 'vc' : p.color}|${kind}|${p.transparency || 0}|${p.reflectance || 0}`; if (matCache.has(key)) return matCache.get(key);
  const color = new THREE.Color(vc ? '#ffffff' : p.color), t = p.transparency || 0, base = { color, transparent: t > 0, opacity: 1 - t, depthWrite: t < 0.5, vertexColors: vc };
  let m;
  switch (kind) {
    case 'Neon': m = vc ? new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 1.35, 1.35), vertexColors: true }) : new THREE.MeshStandardMaterial({ ...base, emissive: color, emissiveIntensity: 1.25, roughness: 0.5 }); break;
    case 'Glass': m = new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.04, metalness: 0, clearcoat: 1, transparent: true, opacity: Math.min(0.7, 1 - t * 0.9), depthWrite: false }); break;
    case 'ForceField': m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 * (1 - t) + 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); break;
    case 'Metal': case 'DiamondPlate': case 'CorrodedMetal': m = new THREE.MeshStandardMaterial({ ...base, map: matTex(kind), roughness: 0.35, metalness: 0.8 }); break;
    case 'Foil': m = new THREE.MeshStandardMaterial({ ...base, map: matTex('Foil'), roughness: 0.12, metalness: 1 }); break;
    case 'Ice': case 'Glacier': m = new THREE.MeshPhysicalMaterial({ ...base, map: matTex(kind), roughness: 0.15, clearcoat: 1, transparent: true, opacity: Math.min(0.92, 1 - t) }); break;
    case 'CrackedLava': m = new THREE.MeshStandardMaterial({ ...base, map: matTex('CrackedLava'), emissive: new THREE.Color('#ff5a1f'), emissiveMap: matTex('CrackedLava'), emissiveIntensity: 1.6, roughness: 0.9 }); break;
    case 'Truss': m = new THREE.MeshStandardMaterial({ color, map: matTex('Truss'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.6, vertexColors: vc }); break;
    case 'Spawn': m = new THREE.MeshStandardMaterial({ ...base, map: matTex('Spawn'), roughness: 0.5 }); break;
    case 'SmoothPlastic': m = new THREE.MeshStandardMaterial({ ...base, roughness: 0.32, metalness: 0.02 }); break;
    default: m = new THREE.MeshStandardMaterial({ ...base, map: matTex(kind === 'Plastic' ? 'Plastic' : kind), roughness: ROUGH[kind] ?? 0.8, metalness: 0 });
  }
  if (p.reflectance) { m.metalness = Math.max(m.metalness || 0, p.reflectance); m.roughness = Math.min(m.roughness ?? 1, 1 - p.reflectance * 0.8); }
  matCache.set(key, m); return m;
}

/* voxel look: every merged voxel block shows its little cubes (bevel + per-cube tint), like the ForgeVoxel material */
export const voxMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05 });
voxMat.onBeforeCompile = (sh) => {
  sh.vertexShader = 'attribute vec3 voxL; attribute vec3 voxN; attribute vec4 voxA; attribute vec3 voxH; varying vec3 vVoxL; varying vec3 vVoxN; varying vec4 vVoxA; varying vec3 vVoxH;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vVoxL = voxL; vVoxN = voxN; vVoxA = voxA; vVoxH = voxH;');
  sh.fragmentShader = 'varying vec3 vVoxL; varying vec3 vVoxN; varying vec4 vVoxA; varying vec3 vVoxH;\nfloat vh(vec3 c){ return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n'
    + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    { vec3 n = abs(vVoxN); vec3 g = (vVoxL + vVoxH) / vVoxA.w - sign(vVoxN) * n * 0.5; vec3 c = floor(g + 1e-3); vec3 f = g - c;
      vec3 e3 = min(f, 1.0 - f) + n * 9.0; float e = min(min(e3.x, e3.y), e3.z);
      diffuseColor.rgb *= (0.9 + 0.17 * vh(c + vVoxA.xyz)) * mix(0.72, 1.0, smoothstep(0.0, 0.14, e)); }`);
};
voxMat.customProgramCacheKey = () => 'playVoxel';

/* ---------- geometry ---------- */
export function boxGeo(w, h, d) { const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / 8, uv.getY(i) * dims[f][1] / 8); } return g; }
const WEDGE = (() => { const s = new THREE.Shape(); s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, 0.5); s.lineTo(-0.5, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); g.rotateY(-Math.PI / 2); g.computeVertexNormals(); return g.toNonIndexed(); })();
const CORNER = (() => { const v = [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5], [0.5, 0.5, -0.5]], f = [[0, 2, 1], [0, 3, 2], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]];
  const pos = []; for (const t of f) for (const i of t) pos.push(...v[i]); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const uv = []; for (let i = 0; i < pos.length / 3; i++) uv.push(pos[i * 3] + 0.5, pos[i * 3 + 1] + 0.5); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; })();
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 28).rotateZ(Math.PI / 2), BALL = new THREE.SphereGeometry(0.5, 24, 16), UNIT = new THREE.BoxGeometry(1, 1, 1);
function scaledUV(g, s) { g = g.clone(); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s); return g; }
const sizeOf = (p) => (p.shape === 'Ball' ? [p.size[0], p.size[0], p.size[0]] : p.size);
/** geometry already scaled to the part size (rotation / position are applied by the caller) */
function partGeo(p) {
  const s = sizeOf(p), mx = Math.max(...s);
  if (p.cls === 'WedgePart') return scaledUV(WEDGE, mx / 8).scale(...s);
  if (p.cls === 'CornerWedgePart') return scaledUV(CORNER, mx / 8).scale(...s);
  if (p.shape === 'Cylinder') return scaledUV(CYL, mx / 8).scale(...s);
  if (p.shape === 'Ball') return scaledUV(BALL, s[0] / 6).scale(...s);
  const g = boxGeo(...s); if (p.cls === 'TrussPart') { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 4); } return g;
}
const colliderGeo = (p) => (p.cls === 'WedgePart' ? WEDGE : p.cls === 'CornerWedgePart' ? CORNER : p.shape === 'Cylinder' ? CYL : p.shape === 'Ball' ? BALL : UNIT);
export const partMatrix = (p) => new THREE.Matrix4().compose(new THREE.Vector3().fromArray(p.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rot[0] * D2R, p.rot[1] * D2R, p.rot[2] * D2R, 'XYZ')), new THREE.Vector3(1, 1, 1));

/* ---------- labels (BillboardGui-like, Roblox font with dark stroke) ---------- */
export function labelSprite(text, { color = '#ffffff', scale = 1, font = '"F-Fredoka", system-ui, sans-serif' } = {}) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 192; const g = c.getContext('2d'); g.font = `700 104px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 104; while (g.measureText(text).width > 980 && size > 30) { size -= 6; g.font = `700 ${size}px ${font}`; }
  g.lineJoin = 'round'; g.lineWidth = size * 0.2; g.strokeStyle = '#14101f'; g.strokeText(text, 512, 100); g.fillStyle = color; g.fillText(text, 512, 100);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(13 * scale, 2.44 * scale, 1); s.renderOrder = 5; return s;
}

/* =====================================================================
   World
   ===================================================================== */
export class World {
  constructor(renderer, quality) {
    this.renderer = renderer; this.quality = quality; this.scene = new THREE.Scene();
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1); s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.6); this.sun.castShadow = quality.shadows; const sh = this.sun.shadow;
    sh.mapSize.set(quality.shadowMap, quality.shadowMap); sh.bias = -0.0005; sh.normalBias = 0.5; Object.assign(sh.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 900 }); s.add(this.sun, this.sun.target);
    this.skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, stars: { value: 0 }, time: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform float stars; uniform float time; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); float a = h(vec3(i,1.0)), b = h(vec3(i+vec2(1,0),1.0)), c = h(vec3(i+vec2(0,1),1.0)), d = h(vec3(i+vec2(1,1),1.0)); return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
        void main(){ float k = smoothstep(-0.12, 0.65, vP.y); vec3 c = mix(bottom, top, k);
          vec3 sd = normalize(sunDir); float s = max(dot(vP, sd), 0.0); float up = step(-0.08, sd.y);
          c += vec3(1.0,0.93,0.78) * (smoothstep(0.9993, 0.9996, s) * 3.0 + pow(s, 10.0) * 0.28) * up;
          if (vP.y > 0.02) { vec2 uv = vP.xz / (vP.y + 0.18) * 1.6 + vec2(time * 0.006, time * 0.002); float cl = n2(uv) * 0.6 + n2(uv * 2.3) * 0.3 + n2(uv * 5.1) * 0.1;
            cl = smoothstep(0.52, 0.78, cl) * smoothstep(0.02, 0.25, vP.y) * (1.0 - stars * 0.85); c = mix(c, vec3(1.0) * (0.92 + 0.08 * up), cl * 0.85); }
          vec3 q = floor(vP * 260.0); float st = step(0.9965, h(q)) * stars * smoothstep(0.0, 0.3, vP.y); c += vec3(st);
          gl_FragColor = vec4(c, 1.0); }` });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), this.skyMat); this.sky.renderOrder = -10; this.sky.frustumCulled = false; s.add(this.sky);
    this.root = new THREE.Group(); s.add(this.root);
    this.parts = new Map(); this.dyn = new Map(); this.labels = new Map(); this.colliders = []; this.grid = new Map(); this.cell = 24; this.dynColliders = new Set(); this.colById = new Map();
  }
  /** build every part; `isDynamic(p)` decides what stays a separate mesh */
  load(map, isDynamic) {
    this.map = map; const parts = MC.partsOf(map.root);
    const groups = new Map(); // key → { mat, geos: [] }
    const voxGeos = [];
    const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3(), col = new THREE.Color();
    for (const p of parts) {
      this.parts.set(p.id, p);
      const t = p.transparency || 0, special = ['Glass', 'ForceField', 'Ice', 'Glacier'].includes(p.material);
      const mtx = partMatrix(p);
      if (p.canCollide !== false && t < 1) this.addCollider(p, mtx);
      if (t >= 1) continue;
      const dyn = isDynamic(p) || p.cls === 'SpawnLocation' || special || t > 0.02 || p.label || p.light;
      if (dyn) { this.addDynamic(p, mtx); continue; }
      const isVox = p.vox && p.cls === 'Part' && (!p.shape || p.shape === 'Block') && p.material === 'SmoothPlastic';
      const g = partGeo(p); col.set(p.color);
      if (isVox) { // keep local coordinates for the cube pattern
        const pos = g.attributes.position, nor = g.attributes.normal, cnt = pos.count, L = new Float32Array(cnt * 3), N = new Float32Array(cnt * 3), A = new Float32Array(cnt * 4), H = new Float32Array(cnt * 3);
        for (let i = 0; i < cnt; i++) { L[i * 3] = pos.getX(i); L[i * 3 + 1] = pos.getY(i); L[i * 3 + 2] = pos.getZ(i); N[i * 3] = nor.getX(i); N[i * 3 + 1] = nor.getY(i); N[i * 3 + 2] = nor.getZ(i);
          for (let k = 0; k < 3; k++) { A[i * 4 + k] = Math.round((p.pos[k] - p.size[k] / 2) / p.vox); H[i * 3 + k] = p.size[k] / 2; } A[i * 4 + 3] = p.vox; }
        g.setAttribute('voxL', new THREE.BufferAttribute(L, 3)); g.setAttribute('voxN', new THREE.BufferAttribute(N, 3)); g.setAttribute('voxA', new THREE.BufferAttribute(A, 4)); g.setAttribute('voxH', new THREE.BufferAttribute(H, 3));
      }
      g.applyMatrix4(mtx);
      const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) { c[i] = col.r; c[i + 1] = col.g; c[i + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      if (isVox) { voxGeos.push(g); continue; }
      const kind = p.cls === 'TrussPart' ? 'Truss' : p.material, key = kind + '|' + (p.reflectance || 0);
      if (!groups.has(key)) groups.set(key, { mat: material({ ...p, color: '#ffffff' }, kind === 'Truss' ? 'Truss' : undefined, true), geos: [] });
      groups.get(key).geos.push(g);
    }
    for (const { mat, geos } of groups.values()) this.addMerged(geos, mat, mat.vertexColors && !(mat instanceof THREE.MeshBasicMaterial));
    if (voxGeos.length) this.addMerged(voxGeos, voxMat, true, ['voxL', 'voxN', 'voxA', 'voxH']);
    void v; void n; void nm;
  }
  addMerged(geos, mat, shadows, extra = []) {
    // chunks of ~60k vertices so huge maps stay within index limits and get frustum culling
    const chunks = []; let cur = [], cnt = 0;
    for (const g of geos) { const c = g.attributes.position.count; if (cnt + c > 60000 && cur.length) { chunks.push(cur); cur = []; cnt = 0; } cur.push(g); cnt += c; }
    if (cur.length) chunks.push(cur);
    for (const ch of chunks) {
      const attrs = ['position', 'normal', 'uv', 'color', ...extra], sizes = { position: 3, normal: 3, uv: 2, color: 3, voxL: 3, voxN: 3, voxA: 4, voxH: 3 };
      const total = ch.reduce((s, g) => s + g.attributes.position.count, 0), idxTotal = ch.reduce((s, g) => s + (g.index ? g.index.count : g.attributes.position.count), 0);
      const out = {}; for (const a of attrs) out[a] = new Float32Array(total * sizes[a]);
      const idx = new Uint32Array(idxTotal); let ov = 0, oi = 0;
      for (const g of ch) { const c = g.attributes.position.count;
        for (const a of attrs) { const src = g.attributes[a]; if (src) out[a].set(src.array.subarray(0, c * sizes[a]), ov * sizes[a]); }
        if (g.index) for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + ov; else for (let i = 0; i < c; i++) idx[oi + i] = ov + i;
        oi += g.index ? g.index.count : c; ov += c; g.dispose(); }
      const geo = new THREE.BufferGeometry(); for (const a of attrs) geo.setAttribute(a, new THREE.BufferAttribute(out[a], sizes[a])); geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere(); geo.computeBoundingBox();
      const m = new THREE.Mesh(geo, mat); m.castShadow = shadows; m.receiveShadow = true; m.matrixAutoUpdate = false; this.root.add(m);
    }
  }
  addDynamic(p, mtx) {
    const isVox = p.vox && p.cls === 'Part' && (!p.shape || p.shape === 'Block') && p.material === 'SmoothPlastic';
    const geo = partGeo(p); let mat = material(p, p.cls === 'TrussPart' ? 'Truss' : undefined);
    if (isVox) { void 0; }
    if (p.cls === 'SpawnLocation') mat = [mat, mat, material(p, 'Spawn'), mat, mat, mat];
    const m = new THREE.Mesh(geo, mat); mtx.decompose(m.position, m.quaternion, m.scale);
    m.castShadow = p.material !== 'Neon' && p.material !== 'ForceField' && (p.transparency || 0) < 0.6; m.receiveShadow = true; m.userData.id = p.id; this.root.add(m); this.dyn.set(p.id, m);
    if (p.light) { const l = new THREE.PointLight(p.color, (p.light.brightness || 2) * 6, p.light.range || 16, 1.6); l.position.copy(m.position); this.root.add(l); m.userData.light = l; }
    const txt = p.label || (p.role ? { buybutton: `🛒 ${p.role.target} · ${p.role.price}`, claim: '🏳️ Réclamer', gate: `🔒 ${p.role.need} ${p.role.stat}` }[p.role.type] : null);
    if (txt) { const s = labelSprite(txt); s.position.set(p.pos[0], p.pos[1] + sizeOf(p)[1] / 2 + 2.6, p.pos[2]); this.root.add(s); this.labels.set(p.id, s); }
    return m;
  }
  addCollider(p, mtx) {
    const m = new THREE.Mesh(colliderGeo(p)); mtx.decompose(m.position, m.quaternion, m.scale); m.scale.fromArray(sizeOf(p)); m.updateMatrixWorld(true);
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    m.userData.id = p.id; m.userData.part = p; this.colById.set(p.id, m); const box = new THREE.Box3().setFromObject(m); m.userData.box = box; this.colliders.push(m);
    const c = this.cell, x0 = Math.floor(box.min.x / c), x1 = Math.floor(box.max.x / c), z0 = Math.floor(box.min.z / c), z1 = Math.floor(box.max.z / c);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 400) { this.dynColliders.add(m); return m; } // huge baseplates: always tested
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = x + ',' + z; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(m); }
    return m;
  }
  colliderOf(id) { return this.colById.get(id); }
  /** colliders near a point (grid cells within r) */
  near(pos, r = 16, out = new Set()) {
    out.clear(); const c = this.cell, x0 = Math.floor((pos.x - r) / c), x1 = Math.floor((pos.x + r) / c), z0 = Math.floor((pos.z - r) / c), z1 = Math.floor((pos.z + r) / c);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const l = this.grid.get(x + ',' + z); if (l) for (const m of l) out.add(m); }
    for (const m of this.dynColliders) out.add(m); return out;
  }
  /** keep a collider in sync with a moving dynamic mesh */
  moveCollider(col, mesh) { col.position.copy(mesh.position); col.quaternion.copy(mesh.quaternion); col.updateMatrixWorld(true); col.userData.box.setFromObject(col); }
  lighting() {
    const L = MC.lightingOf(this.map), day = L.ClockTime;
    const ang = ((day - 6) / 12) * Math.PI, dir = new THREE.Vector3(Math.cos(ang) * 0.6, Math.sin(ang), -0.55).normalize(), isDay = dir.y > -0.05;
    this.sunDir = isDay ? dir.clone() : new THREE.Vector3(-dir.x, 0.75, -dir.z).normalize();
    this.sun.intensity = isDay ? L.Brightness * 0.95 : 0.7 * L.Brightness; this.sun.color.set(isDay ? (dir.y < 0.3 ? '#ffc58f' : '#fff6e8') : '#9fb4ff');
    this.hemi.color.set(L.OutdoorAmbient).lerp(new THREE.Color(L.sky[0]), 0.35); this.hemi.groundColor.set(L.Ambient); this.hemi.intensity = (0.55 + L.Brightness * 0.22) * (isDay ? 1 : 2.1);
    this.skyMat.uniforms.top.value.set(L.sky[0]); this.skyMat.uniforms.bottom.value.set(L.sky[1]); this.skyMat.uniforms.sunDir.value.copy(dir); this.skyMat.uniforms.stars.value = isDay ? 0 : 1;
    const fogD = 0.00025 + L.atmo.Density * 0.0016 + L.atmo.Haze * 0.00012;
    this.scene.fog = new THREE.FogExp2(new THREE.Color(L.atmo.Color).lerp(new THREE.Color(L.sky[1]), 0.4), fogD);
    this.L = L; this.isDay = isDay; return L;
  }
  follow(pos, t) { this.sun.target.position.copy(pos); this.sun.position.copy(pos).addScaledVector(this.sunDir, 300); this.skyMat.uniforms.time.value = t; }
}
