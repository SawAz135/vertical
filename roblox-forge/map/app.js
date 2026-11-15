// Roblox Forge - Map Studio. Every block is a real Roblox part; ▶ plays the map with the same rules as the game scripts.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as MC from './map-core.js';
import * as MM from './map-models.js';
import * as MV from './map-voxel.js';
import { PROPS, PROP_CATS } from './map-props.js';
import { createLibrary } from '../library/forge-lib.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const D2R = Math.PI / 180;
function toast(m, ms = 2200) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), ms); }
const Store = {
  get(k, d) { try { const v = localStorage.getItem('forgemap.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('forgemap.' + k, JSON.stringify(v)); } catch { toast('Mémoire du navigateur pleine : exporte ta carte'); } },
};

/* =====================================================================
   1. STATE
   ===================================================================== */
let map = Store.get('map', null) || MC.newMap('obby', 'plaine', 7);
let sel = new Set(), undoStack = [], redoStack = [];
/* complete maps: one tap, everything placed (gameplay + buildings + animals + voxel world) */
const FULL_MAPS = [
  { e: '🏝️', name: 'Île Simulator', desc: 'œufs, boutique, coffre, palmiers, perroquets', text: 'simulator sur une île tropicale avec 4 socles d\u2019œuf, une boutique, un coffre, 6 palmiers et 3 perroquets' },
  { e: '🌲', name: 'Village de la forêt', desc: 'maisons, puits, feu de camp, cerfs, renards', text: 'lobby dans une forêt avec un village de 6 maisons, un puits, un feu de camp, 3 cerfs et 2 renards' },
  { e: '🐄', name: 'Grande ferme', desc: 'grange, silo, champs, vaches, cochons, poules', text: 'une ferme avec 4 vaches, 3 cochons, 2 moutons, 5 poules, un canard et un tracteur' },
  { e: '🏰', name: 'Royaume enneigé', desc: 'arène, château, loups, ours polaires, pingouins', text: 'arène enneigée avec un château, 3 loups, 2 ours polaires et 4 pingouins' },
  { e: '🏜️', name: 'Tycoon du désert', desc: 'usine, temple, chameaux, cactus', text: 'tycoon dans le désert avec un temple, 3 chameaux et 4 cactus' },
  { e: '☁️', name: 'Obby des nuages', desc: 'parcours, arc-en-ciel, pégases', text: 'obby dans le ciel avec un arc-en-ciel, 3 pégases et 2 papillons' },
  { e: '🍭', name: 'Monde bonbon', desc: 'simulator, licornes, sucettes', text: 'simulator bonbon avec 4 licornes, 6 sucettes, 3 papillons et un coffre' },
  { e: '🌋', name: 'Arène du volcan', desc: 'combat, dragons, cristaux, cascade', text: 'arène volcan avec 2 dragons, des cristaux et une cascade' },
];
const ui = { tab: 'gen', snap: 1, multi: false, gen: { id: map.gen?.id || 'obby', theme: map.theme || 'plaine', seed: map.gen?.seed || 7, opts: clone(map.gen?.opts || {}) }, open: new Set(), mapStyle: (() => { try { return localStorage.getItem('forge.mapStyle') || 'voxel'; } catch { return 'voxel'; } })() };
function snapshot() { undoStack.push(JSON.stringify(map)); if (undoStack.length > 40) undoStack.shift(); redoStack = []; syncUndo(); }
let saveT = 0; function save() { clearTimeout(saveT); saveT = setTimeout(() => Store.set('map', map), 250); }
function syncUndo() { $('undo').disabled = !undoStack.length; $('redo').disabled = !redoStack.length; }
$('undo').onclick = () => { if (!undoStack.length || play.on) return; redoStack.push(JSON.stringify(map)); map = JSON.parse(undoStack.pop()); restore(); };
$('redo').onclick = () => { if (!redoStack.length || play.on) return; undoStack.push(JSON.stringify(map)); map = JSON.parse(redoStack.pop()); restore(); };
function restore() { for (const id of [...sel]) if (!MC.find(map.root, id)) sel.delete(id); save(); syncUndo(); rebuildAll(); applyLighting(); selectionChanged(); renderPane(); }
const T = () => MC.THEMES[map.theme] || MC.THEMES.plaine;

/* =====================================================================
   2. MATERIAL TEXTURES (procedural, multiplied by the part colour like Roblox)
   ===================================================================== */
const texCache = new Map();
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
    case 'Spawn': g.fillStyle = '#e0e0e0'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 46, 0, 7); g.fill(); g.fillStyle = '#9a9a9a'; g.font = '900 64px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⟳', 64, 68); break;
    default: noise(g, 600, 215, 250, 128, 0.5, 1.2);
  }
  return c;
}
function matTex(m) { if (texCache.has(m)) return texCache.get(m); const t = new THREE.CanvasTexture(matCanvas(m)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(m, t); return t; }
const matCache = new Map();
function material(p, special) {
  const key = `${special || p.material}|${p.color}|${p.transparency || 0}|${p.reflectance || 0}`; if (matCache.has(key)) return matCache.get(key);
  const color = new THREE.Color(p.color), t = p.transparency || 0, base = { color, transparent: t > 0, opacity: 1 - t, depthWrite: t < 0.5 };
  let m;
  switch (special || p.material) {
    case 'Neon': m = new THREE.MeshStandardMaterial({ ...base, emissive: color, emissiveIntensity: 2.4, roughness: 0.5 }); break;
    case 'Glass': m = new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.04, metalness: 0, clearcoat: 1, transparent: true, opacity: Math.min(0.75, 1 - t * 0.9), depthWrite: false }); break;
    case 'ForceField': m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 * (1 - t) + 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); break;
    case 'Metal': case 'DiamondPlate': case 'CorrodedMetal': m = new THREE.MeshStandardMaterial({ ...base, map: matTex(p.material), roughness: 0.35, metalness: 0.85 }); break;
    case 'Foil': m = new THREE.MeshStandardMaterial({ ...base, map: matTex('Foil'), roughness: 0.12, metalness: 1 }); break;
    case 'Ice': case 'Glacier': m = new THREE.MeshPhysicalMaterial({ ...base, map: matTex(p.material), roughness: 0.15, clearcoat: 1, transparent: true, opacity: Math.min(0.92, 1 - t) }); break;
    case 'CrackedLava': m = new THREE.MeshStandardMaterial({ ...base, map: matTex('CrackedLava'), emissive: new THREE.Color('#ff5a1f'), emissiveMap: matTex('CrackedLava'), emissiveIntensity: 1.6, roughness: 0.9 }); break;
    case 'Truss': m = new THREE.MeshStandardMaterial({ color, map: matTex('Truss'), alphaTest: 0.5, transparent: false, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.6 }); break;
    case 'Spawn': m = new THREE.MeshStandardMaterial({ ...base, map: matTex('Spawn'), roughness: 0.5 }); break;
    case 'SmoothPlastic': m = new THREE.MeshStandardMaterial({ ...base, roughness: 0.32, metalness: 0.02 }); break;
    case 'Plastic': m = new THREE.MeshStandardMaterial({ ...base, map: matTex('Plastic'), roughness: 0.55 }); break;
    default: m = new THREE.MeshStandardMaterial({ ...base, map: matTex(p.material), roughness: { Marble: 0.25, Slate: 0.8, Granite: 0.6, Sand: 0.95, Snow: 0.9, Grass: 0.95 }[p.material] ?? 0.8, metalness: 0 });
  }
  if (p.reflectance) { m.metalness = Math.max(m.metalness || 0, p.reflectance); m.roughness = Math.min(m.roughness ?? 1, 1 - p.reflectance * 0.8); }
  matCache.set(key, m); return m;
}
// matTex canvases as data URLs for the material picker
const matPreview = (m) => matCanvas(m).toDataURL();

/* =====================================================================
   3. SCENE
   ===================================================================== */
const view = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; view.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 4000); camera.position.set(60, 55, 80);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.09; controls.maxPolarAngle = Math.PI * 0.495; controls.screenSpacePanning = false;
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
Object.assign(sun.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 1, far: 900 }); scene.add(sun, sun.target);
const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, stars: { value: 0 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform float stars; varying vec3 vP;
    float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
    void main(){ float k = smoothstep(-0.15, 0.7, vP.y); vec3 c = mix(bottom, top, k);
      float s = max(dot(vP, normalize(sunDir)), 0.0); c += vec3(1.0,0.92,0.75) * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.25) * step(0.0, sunDir.y + 0.08);
      vec3 q = floor(vP * 240.0); float st = step(0.9965, h(q)) * stars * smoothstep(0.0, 0.3, vP.y); c += vec3(st);
      gl_FragColor = vec4(c, 1.0); }` });
const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), skyMat); scene.add(sky);
const grid = new THREE.GridHelper(600, 150, 0x8f7bff, 0x3a3560); grid.material.transparent = true; grid.material.opacity = 0.22; grid.position.y = 0.02; scene.add(grid);
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.85); composer.addPass(bloom); composer.addPass(new OutputPass());
function applyLighting() {
  const L = MC.lightingOf(map), day = L.ClockTime;
  const ang = ((day - 6) / 12) * Math.PI, dir = new THREE.Vector3(Math.cos(ang) * 0.6, Math.sin(ang), -0.55).normalize(); // sunrise 6h, sunset 18h
  const isDay = dir.y > -0.05;
  sun.position.copy(dir.clone().multiplyScalar(400)); sun.intensity = isDay ? L.Brightness * 0.95 : 0.35 * L.Brightness; sun.color.set(isDay ? (dir.y < 0.3 ? '#ffc58f' : '#fff6e8') : '#9fb4ff');
  if (!isDay) sun.position.set(-dir.x * 400, 300, -dir.z * 400); // moonlight
  hemi.color.set(L.OutdoorAmbient).lerp(new THREE.Color(L.sky[0]), 0.35); hemi.groundColor.set(L.Ambient); hemi.intensity = 0.55 + L.Brightness * 0.22;
  skyMat.uniforms.top.value.set(L.sky[0]); skyMat.uniforms.bottom.value.set(L.sky[1]); skyMat.uniforms.sunDir.value.copy(dir); skyMat.uniforms.stars.value = isDay ? 0 : 1;
  const fogD = (0.00025 + L.atmo.Density * 0.0016 + L.atmo.Haze * 0.00012) * (play.on ? 1 : 0.45); // editing keeps the overview readable
  if (!scene.fog) scene.fog = new THREE.FogExp2(0xffffff, fogD); scene.fog.color.set(L.atmo.Color).lerp(new THREE.Color(L.sky[1]), 0.4); scene.fog.density = fogD;
  bloom.strength = 0.2 + L.bloom.Intensity * 0.38; bloom.threshold = 0.9 + Math.min(0.3, L.bloom.Threshold * 0.06); bloom.radius = 0.55; // only neon / glowing parts bloom, like Roblox
  renderer.toneMappingExposure = 0.95 + L.cc.Contrast * 0.6 + (isDay ? 0.1 : 0);
}

/* =====================================================================
   4. MESHES (one per Roblox part)
   ===================================================================== */
const root = new THREE.Group(); scene.add(root);
const meshes = new Map(), labels = new Map(), extras = [];
function boxGeo(w, h, d) { const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / 8, uv.getY(i) * dims[f][1] / 8); } return g; }
const WEDGE = (() => { const s = new THREE.Shape(); s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, 0.5); s.lineTo(-0.5, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); g.rotateY(-Math.PI / 2); g.computeVertexNormals(); return g; })();
const CORNER = (() => { // CornerWedgePart: tall corner at (+X, top, -Z), slopes facing -X and +Z
  const v = [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5], [0.5, 0.5, -0.5]], f = [[0, 2, 1], [0, 3, 2], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]];
  const pos = []; for (const t of f) for (const i of t) pos.push(...v[i]); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const uv = []; for (let i = 0; i < pos.length / 3; i++) uv.push(pos[i * 3] + 0.5, pos[i * 3 + 1] + 0.5); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; })();
function scaledUV(g, s) { g = g.clone(); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s); return g; }
/* voxel animals: show the little cubes of each merged block (bevel + own tint), same as Pet Studio and the ForgeVoxel material in Roblox */
function voxMat(p) { // shared per colour: the cube size / block corner / half size travel as vertex attributes
  const key = 'vox|' + p.color + '|' + (p.transparency || 0); if (matCache.has(key)) return matCache.get(key);
  const m = material(p).clone();
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec4 voxA; attribute vec3 voxH; varying vec3 vVoxL; varying vec3 vVoxN; varying vec4 vVoxA; varying vec3 vVoxH;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vVoxL = position; vVoxN = normal; vVoxA = voxA; vVoxH = voxH;');
    sh.fragmentShader = 'varying vec3 vVoxL; varying vec3 vVoxN; varying vec4 vVoxA; varying vec3 vVoxH;\nfloat vh(vec3 c){ return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n'
      + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 n = abs(vVoxN); vec3 g = (vVoxL + vVoxH) / vVoxA.w - sign(vVoxN) * n * 0.5; vec3 c = floor(g + 1e-3); vec3 f = g - c;
        vec3 e3 = min(f, 1.0 - f) + n * 9.0; float e = min(min(e3.x, e3.y), e3.z);
        diffuseColor.rgb *= (0.9 + 0.17 * vh(c + vVoxA.xyz)) * mix(0.72, 1.0, smoothstep(0.0, 0.14, e)); }`);
  };
  m.customProgramCacheKey = () => 'forgeVoxelMap'; matCache.set(key, m); return m;
}
function voxGeo(p) { const g = boxGeo(p.size[0], p.size[1], p.size[2]), n = g.attributes.position.count, A = new Float32Array(n * 4), H = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) { A[i * 4 + k] = Math.round((p.pos[k] - p.size[k] / 2) / p.vox); H[i * 3 + k] = p.size[k] / 2; } A[i * 4 + 3] = p.vox; }
  g.setAttribute('voxA', new THREE.BufferAttribute(A, 4)); g.setAttribute('voxH', new THREE.BufferAttribute(H, 3)); return g; }
function makeMesh(p) {
  const isVox = p.vox && p.cls === 'Part' && (!p.shape || p.shape === 'Block') && p.material === 'SmoothPlastic';
  let geo, mat = isVox ? voxMat(p) : material(p), scale = [1, 1, 1];
  if (p.cls === 'WedgePart') { geo = scaledUV(WEDGE, Math.max(...p.size) / 8); scale = p.size; }
  else if (p.cls === 'CornerWedgePart') { geo = scaledUV(CORNER, Math.max(...p.size) / 8); scale = p.size; }
  else if (p.cls === 'TrussPart') { geo = boxGeo(p.size[0], p.size[1], p.size[2]); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 4); mat = material(p, 'Truss'); }
  else if (p.shape === 'Cylinder') { geo = scaledUV(new THREE.CylinderGeometry(0.5, 0.5, 1, 40).rotateZ(Math.PI / 2), Math.max(...p.size) / 8); scale = p.size; }
  else if (p.shape === 'Ball') { geo = scaledUV(new THREE.SphereGeometry(0.5, 32, 20), p.size[0] / 6); scale = [p.size[0], p.size[0], p.size[0]]; }
  else geo = isVox ? voxGeo(p) : boxGeo(p.size[0], p.size[1], p.size[2]);
  if (p.cls === 'SpawnLocation') mat = [mat, mat, material(p, 'Spawn'), mat, mat, mat];
  const m = new THREE.Mesh(geo, mat); m.scale.fromArray(scale); m.position.fromArray(p.pos); m.rotation.set(p.rot[0] * D2R, p.rot[1] * D2R, p.rot[2] * D2R, 'XYZ');
  m.castShadow = p.material !== 'Neon' && p.material !== 'ForceField' && (p.transparency || 0) < 0.6; m.receiveShadow = true; m.userData.id = p.id; m.userData.baseScale = scale;
  return m;
}
function labelSprite(text, color = '#ffffff') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d'); g.font = '900 54px system-ui,-apple-system,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(text, 256, 50); g.fillStyle = color; g.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true })); s.scale.set(12, 2.25, 1); return s;
}
let lightCount = 0;
function addPart(p) {
  const m = makeMesh(p); root.add(m); meshes.set(p.id, m); partIndex.set(p.id, p);
  if (p.light && lightCount < 24) { const l = new THREE.PointLight(p.color, (p.light.brightness || 2) * 6, p.light.range || 16, 1.6); l.position.copy(m.position); root.add(l); extras.push(l); lightCount++; m.userData.light = l; }
  const txt = p.label || (p.role ? { buybutton: `🛒 ${p.role.target} · ${p.role.price}`, claim: '🏳️ Réclamer', gate: `🔒 ${p.role.need} ${p.role.stat}` }[p.role.type] : null);
  if (txt) { const s = labelSprite(txt); s.position.set(p.pos[0], p.pos[1] + p.size[1] / 2 + 3, p.pos[2]); root.add(s); labels.set(p.id, s); }
}
/* ---------- render batching for voxel worlds ----------
   A voxel map has ~10 000 cube blocks. Each part keeps its own (hidden) mesh for selection, collisions and
   editing, but every voxel model (tree, rock, terrain, animal…) is DRAWN as one merged mesh: ~150 draw calls
   instead of 10 000. Touching a model (move, resize, hide) splits it back into its parts. */
const batches = new Map(), batchOf = new Map();
const batchMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05 });
batchMat.onBeforeCompile = (sh) => {
  sh.vertexShader = 'attribute vec3 voxL; attribute vec3 voxN; attribute vec4 voxA; attribute vec3 voxH; varying vec3 vVoxL; varying vec3 vVoxN; varying vec4 vVoxA; varying vec3 vVoxH;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vVoxL = voxL; vVoxN = voxN; vVoxA = voxA; vVoxH = voxH;');
  sh.fragmentShader = 'varying vec3 vVoxL; varying vec3 vVoxN; varying vec4 vVoxA; varying vec3 vVoxH;\nfloat vh(vec3 c){ return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n'
    + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    { vec3 n = abs(vVoxN); vec3 g = (vVoxL + vVoxH) / vVoxA.w - sign(vVoxN) * n * 0.5; vec3 c = floor(g + 1e-3); vec3 f = g - c;
      vec3 e3 = min(f, 1.0 - f) + n * 9.0; float e = min(min(e3.x, e3.y), e3.z);
      diffuseColor.rgb *= (0.9 + 0.17 * vh(c + vVoxA.xyz)) * mix(0.72, 1.0, smoothstep(0.0, 0.14, e)); }`);
};
batchMat.customProgramCacheKey = () => 'forgeVoxelBatch';
function clearBatches() { for (const b of batches.values()) { root.remove(b.mesh); b.mesh.geometry.dispose(); } batches.clear(); batchOf.clear(); }
function buildBatches() {
  clearBatches();
  const walk = (n) => { if (!n.children) return; const ps = n.children.filter((c) => !c.children && c.vox && c.cls === 'Part' && (!c.shape || c.shape === 'Block') && c.material === 'SmoothPlastic' && !c.role && !c.label && !c.light && (c.transparency || 0) === 0 && meshes.get(c.id));
    if (n.cls === 'Model' && ps.length >= 8) makeBatch(n.id, ps); n.children.forEach(walk); };
  walk(map.root);
}
function makeBatch(id, ps) {
  let nv = 0, ni = 0; for (const p of ps) { const g = meshes.get(p.id).geometry; nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), L = new Float32Array(nv * 3), N = new Float32Array(nv * 3), A = new Float32Array(nv * 4), H = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let ov = 0, oi = 0; const v = new THREE.Vector3(), nm = new THREE.Matrix3(), c = new THREE.Color();
  for (const p of ps) { const m = meshes.get(p.id); m.updateMatrixWorld(); const g = m.geometry, gp = g.attributes.position, gn = g.attributes.normal, ga = g.attributes.voxA, gh = g.attributes.voxH; nm.getNormalMatrix(m.matrixWorld); c.set(p.color);
    for (let i = 0; i < gp.count; i++) { v.fromBufferAttribute(gp, i); L.set([v.x, v.y, v.z], (ov + i) * 3); v.applyMatrix4(m.matrixWorld); pos.set([v.x, v.y, v.z], (ov + i) * 3);
      v.fromBufferAttribute(gn, i); N.set([v.x, v.y, v.z], (ov + i) * 3); v.applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (ov + i) * 3); col.set([c.r, c.g, c.b], (ov + i) * 3);
      A.set([ga.getX(i), ga.getY(i), ga.getZ(i), ga.getW(i)], (ov + i) * 4); H.set([gh.getX(i), gh.getY(i), gh.getZ(i)], (ov + i) * 3); }
    for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + ov; ov += gp.count; oi += g.index.count; m.visible = false; batchOf.set(p.id, id); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('voxL', new THREE.BufferAttribute(L, 3)); geo.setAttribute('voxN', new THREE.BufferAttribute(N, 3)); geo.setAttribute('voxA', new THREE.BufferAttribute(A, 4)); geo.setAttribute('voxH', new THREE.BufferAttribute(H, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, batchMat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.raycast = () => {}; // picking stays on the per-part meshes
  root.add(mesh); batches.set(id, { mesh, ids: ps.map((p) => p.id) });
}
function unbatch(partId) { const id = batchOf.get(partId); if (!id) return; const b = batches.get(id); batches.delete(id); root.remove(b.mesh); b.mesh.geometry.dispose();
  for (const pid of b.ids) { batchOf.delete(pid); const m = meshes.get(pid); if (m) m.visible = !(play.hidden && play.hidden.has(pid)); } }
function rebuildAll() {
  clearBatches();
  for (const m of meshes.values()) { root.remove(m); m.geometry.dispose(); } for (const s of labels.values()) { root.remove(s); s.material.map.dispose(); s.material.dispose(); }
  for (const e of extras) root.remove(e); meshes.clear(); partIndex.clear(); labels.clear(); extras.length = 0; lightCount = 0;
  for (const p of MC.partsOf(map.root)) addPart(p);
  buildBatches(); refreshOutlines(); updateInfo(); if (gizmo.object) placePivot();
}
function rebuildPart(p) { unbatch(p.id); const old = meshes.get(p.id); if (old) { root.remove(old); old.geometry.dispose(); if (old.userData.light) root.remove(old.userData.light); }
  const s = labels.get(p.id); if (s) { root.remove(s); labels.delete(p.id); } addPart(p); }
function updateInfo() { const s = MC.stats(map); $('mapName').textContent = map.name; $('mapInfo').textContent = `${s.parts} pièces · ${Object.values(s.roles).reduce((a, b) => a + b, 0)} gameplay · ${T().label}`; }

/* =====================================================================
   5. SELECTION + GIZMO (multi-select moves around a shared pivot)
   ===================================================================== */
const pivot = new THREE.Object3D(); scene.add(pivot);
const gizmo = new TransformControls(camera, renderer.domElement); gizmo.setSize(1.1); scene.add(gizmo.getHelper());
const outlines = new Map(); const outlineMat = new THREE.LineBasicMaterial({ color: 0x3ee6ff, depthTest: false, transparent: true });
function selParts() { const out = []; for (const id of sel) { const n = MC.find(map.root, id); if (n) out.push(...MC.partsOf(n)); } return [...new Map(out.map((p) => [p.id, p])).values()]; }
function refreshOutlines() {
  for (const [, l] of outlines) { l.parent && l.parent.remove(l); l.geometry.dispose(); } outlines.clear();
  for (const p of selParts().slice(0, 400)) { const m = meshes.get(p.id); if (!m) continue; const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), outlineMat); l.renderOrder = 5; m.add(l); outlines.set(p.id, l); }
}
function placePivot() {
  const ps = selParts(); if (!ps.length) { gizmo.detach(); return; }
  const c = new THREE.Vector3(); ps.forEach((p) => c.add(new THREE.Vector3(...p.pos))); c.divideScalar(ps.length);
  pivot.position.copy(c); pivot.scale.set(1, 1, 1);
  if (ps.length === 1) pivot.rotation.set(ps[0].rot[0] * D2R, ps[0].rot[1] * D2R, ps[0].rot[2] * D2R, 'XYZ'); else pivot.rotation.set(0, 0, 0);
  pivot.updateMatrixWorld(); if (!play.on) gizmo.attach(pivot);
}
function selectionChanged() {
  refreshOutlines(); placePivot();
  const ps = selParts(), b = $('selBadge'); b.classList.toggle('hidden', !ps.length);
  if (ps.length === 1) { const p = ps[0]; b.textContent = `${p.name} · ${MC.PART_CLASSES[p.cls]}${p.role ? ' · ' + MC.ROLES[p.role.type].e + ' ' + MC.ROLES[p.role.type].fr : ''} · ${p.size.map((v) => +v.toFixed(1)).join('×')}`; }
  else if (ps.length) b.textContent = `${sel.size} sélectionné(s) · ${ps.length} pièces`;
  if (['props', 'tools', 'obj'].includes(ui.tab)) renderPane();
}
function select(id, add = ui.multi) { if (!add) sel.clear(); if (id) { if (add && sel.has(id)) sel.delete(id); else sel.add(id); } selectionChanged(); }
let drag0 = null;
gizmo.addEventListener('dragging-changed', (e) => {
  controls.enabled = !e.value;
  if (e.value) { snapshot(); const ps = selParts(); ps.forEach((p) => unbatch(p.id)); drag0 = { inv: pivot.matrixWorld.clone().invert(), parts: ps.map((p) => ({ p, m: meshes.get(p.id).matrixWorld.clone(), size: p.size.slice() })) }; }
  else { if (gizmo.getMode() === 'scale' && drag0) { for (const { p } of drag0.parts) rebuildPart(p); placePivot(); refreshOutlines(); } drag0 = null; save(); if (ui.tab === 'props') renderPane(); selectionChanged(); }
});
gizmo.addEventListener('objectChange', () => {
  if (!drag0) return; pivot.updateMatrixWorld();
  if (gizmo.getMode() === 'scale') { // single part: the gizmo scale factor applies to the size captured at drag start
    const k = [Math.abs(pivot.scale.x), Math.abs(pivot.scale.y), Math.abs(pivot.scale.z)], snap = ui.snap || 0.05;
    for (const { p, size } of drag0.parts) {
      p.size = size.map((v, i) => +Math.max(0.05, Math.round((v * k[i]) / snap) * snap).toFixed(3));
      if (p.cls === 'TrussPart') p.size = p.size.map((v) => Math.max(2, Math.round(v / 2) * 2));
      if (p.shape === 'Ball') { const d = p.size[0] === size[0] ? Math.max(...p.size) : p.size[0]; p.size = [d, d, d]; }
      const m = meshes.get(p.id), bs = m.userData.baseScale;
      if (bs[0] === 1 && bs[1] === 1 && bs[2] === 1) m.scale.set(p.size[0] / size[0], p.size[1] / size[1], p.size[2] / size[2]); else m.scale.fromArray(p.shape === 'Ball' ? [p.size[0], p.size[0], p.size[0]] : p.size);
    }
    updateBadge(); return; }
  const delta = pivot.matrixWorld.clone().multiply(drag0.inv), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), e = new THREE.Euler();
  for (const { p, m } of drag0.parts) { const nm = delta.clone().multiply(m); nm.decompose(pos, q, sc); e.setFromQuaternion(q, 'XYZ');
    p.pos = pos.toArray().map((v) => +v.toFixed(3)); p.rot = [e.x, e.y, e.z].map((v) => +(v / D2R).toFixed(2));
    const mesh = meshes.get(p.id); mesh.position.copy(pos); mesh.quaternion.copy(q); if (mesh.userData.light) mesh.userData.light.position.copy(pos);
    const lab = labels.get(p.id); if (lab) lab.position.set(pos.x, pos.y + p.size[1] / 2 + 3, pos.z); }
  updateBadge();
});
function updateBadge() { const ps = selParts(); if (ps.length === 1) $('selBadge').textContent = `${ps[0].name} · ${ps[0].pos.map((v) => +v.toFixed(1)).join(', ')} · ${ps[0].size.map((v) => +v.toFixed(1)).join('×')}`; }
function setSnap(v) { ui.snap = v; gizmo.setTranslationSnap(v || null); gizmo.setRotationSnap(v ? 15 * D2R : null); $('snap').textContent = '🧲 ' + (v || 'off'); }
setSnap(1);
$('snap').onclick = () => { const steps = [0, 0.5, 1, 2, 4]; setSnap(steps[(steps.indexOf(ui.snap) + 1) % steps.length]); toast(ui.snap ? `Aimant ${ui.snap} stud${ui.snap > 1 ? 's' : ''} · 15°` : 'Aimant coupé'); };
document.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { if (b.dataset.mode === 'scale' && selParts().length > 1) return toast('La taille se règle pièce par pièce (ou en Propriétés)');
  gizmo.setMode(b.dataset.mode); gizmo.setSpace(b.dataset.mode === 'translate' ? 'world' : 'local'); document.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b)); });
$('multi').onclick = () => { ui.multi = !ui.multi; $('multi').classList.toggle('on', ui.multi); toast(ui.multi ? 'Multi : touche plusieurs pièces' : 'Sélection simple'); };
$('upSel').onclick = () => { if (sel.size !== 1) return toast('Sélectionne une pièce'); const par = MC.parentOf(map.root, [...sel][0]); if (!par || par === map.root) return toast('Pas de groupe au-dessus'); sel = new Set([par.id]); selectionChanged(); toast('Groupe ' + par.name); };
$('focus').onclick = () => focusOn(selParts().length ? selParts() : MC.partsOf(map.root));
function focusOn(ps) { if (!ps.length) return; const b = new THREE.Box3(); ps.forEach((p) => { const m = meshes.get(p.id); if (m) b.expandByObject(m); }); const c = b.getCenter(new THREE.Vector3()), r = Math.max(8, b.getSize(new THREE.Vector3()).length() * 0.6);
  const dir = camera.position.clone().sub(controls.target).normalize(); controls.target.copy(c); camera.position.copy(c).addScaledVector(dir, r * 1.6); }
const ray = new THREE.Raycaster(); let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY, performance.now()]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || gizmo.dragging || play.on) return; const [x, y, t] = down; down = null; if (Math.hypot(e.clientX - x, e.clientY - y) > 6 || performance.now() - t > 500) return;
  const r = renderer.domElement.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObjects([...meshes.values()], false)[0]; select(hit ? hit.object.userData.id : null);
});

/* =====================================================================
   6. PLAY MODE: avatar, physics, and the same gameplay rules as the Luau scripts
   ===================================================================== */
const GRAV = 196.2, WALK = 16, JUMP = 50;
const play = { on: false, fly: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: false, ground: null, input: new THREE.Vector2(), jump: false, downKey: false, stats: {}, cp: null, spawn: null,
  dyn: [], parent: new Map(), hidden: new Set(), owned: null, drops: [], coinsOff: new Map(), cool: new Map(), t: 0, avatar: null, solids: [] };
function buildAvatar() {
  const g = new THREE.Group(), M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
  const part = (s, p, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(...s), M(c)); m.position.set(...p); m.castShadow = true; g.add(m); return m; };
  part([2, 2, 1], [0, 3, 0], '#3a7bd5'); part([1, 2, 1], [-1.5, 3, 0], '#f2c48d'); part([1, 2, 1], [1.5, 3, 0], '#f2c48d'); part([1, 2, 1], [-0.5, 1, 0], '#2c3e50'); part([1, 2, 1], [0.5, 1, 0], '#2c3e50');
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.2, 24), M('#f2c48d')); head.position.set(0, 4.6, 0); head.castShadow = true; g.add(head);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), new THREE.MeshBasicMaterial({ color: '#1b1b1b' })); face.position.set(0, 4.55, -0.63); face.rotation.y = Math.PI; g.add(face);
  return g;
}
const partIndex = new Map();
function partFor(id) { return partIndex.get(id) || MC.find(map.root, id); }
function ancestors(id) { const out = []; let p = play.parent.get(id); while (p) { out.push(p); p = play.parent.get(p.id); } return out; }
function tycoonOf(id) { return ancestors(id).find((a) => a.tycoon) || null; }
function rebuildSolids() { play.all = [...meshes.entries()].filter(([id]) => { const p = partFor(id); return p && p.canCollide !== false && !play.hidden.has(id) && !(p.role?.type === 'gate' && gateOpen(p)); }).map(([, m]) => m);
  play.nearAt = null; play.solids = play.all; nearSolids(); }
/* only test collisions against parts around the player (a voxel world has ~10 000 parts) */
function nearSolids() { const P = play, at = P.pos; if (!at || !P.all) return P.solids;
  if (P.nearAt && P.nearAt.distanceTo(at) < 12 && P.t - (P.nearT || 0) < 0.5) return P.solids;
  const b = new THREE.Sphere(); P.solids = P.all.filter((m) => { const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); b.copy(g.boundingSphere).applyMatrix4(m.matrixWorld); return b.center.distanceTo(at) < b.radius + 60; });
  P.nearAt = at.clone(); P.nearT = P.t; return P.solids; }
const gateOpen = (p) => (play.stats[p.role.stat] || 0) >= p.role.need;
function setHidden(n, hide) { for (const p of MC.partsOf(n)) { unbatch(p.id); const m = meshes.get(p.id); if (m) m.visible = !hide; if (hide) play.hidden.add(p.id); else play.hidden.delete(p.id); const l = labels.get(p.id); if (l) l.visible = !hide; } }
function addStat(name, v) { play.stats[name] = (play.stats[name] || 0) + v; drawStats(); }
function drawStats() { $('stats').innerHTML = Object.entries(play.stats).map(([k, v]) => `<div><span>${esc(k)}</span><b>${MC_abbrev(v)}</b></div>`).join('') || '<div><span>▶ Jeu</span><b>OK</b></div>'; }
const MC_abbrev = (v) => { const u = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']].find(([n]) => Math.abs(v) >= n); return u ? (v / u[0]).toFixed(1).replace(/\.0$/, '') + u[1] : String(Math.floor(v)); };
function banner(text, ms = 1400) { const b = $('banner'); b.textContent = text; b.classList.add('on'); clearTimeout(banner.t); banner.t = setTimeout(() => b.classList.remove('on'), ms); }
function startPlay() {
  if (play.on) return; play.on = true; document.body.classList.add('playing'); $('play').textContent = '■'; gizmo.detach(); sel.clear(); refreshOutlines(); $('selBadge').classList.add('hidden'); $('tools').classList.add('hidden'); $('playui').classList.remove('hidden'); $('addMenu').classList.add('hidden');
  resize(); play.parent.clear(); MC.walk(map.root, (n, p) => { if (p) play.parent.set(n.id, p); });
  play.stats = {}; play.hidden.clear(); play.drops = []; play.owned = null; play.cp = null; play.cool.clear(); play.coinsOff.clear(); play.dyn = []; play.t = 0;
  const roles = MC.partsOf(map.root).filter((p) => p.role);
  play.roled = roles; play.coins = roles.filter((p) => p.role.type === 'coin'); play.gates = roles.filter((p) => p.role.type === 'gate');
  play.droppers = roles.filter((p) => p.role.type === 'dropper'); play.dropMats = roles.filter((p) => ['conveyor', 'collector', 'upgrader'].includes(p.role.type));
  for (const p of roles) { const r = p.role.type;
    if (r === 'checkpoint') play.stats.Stage = 0; if (r === 'coin' || r === 'gate') play.stats[p.role.stat || 'Coins'] = 0; if (['collector', 'buybutton'].includes(r)) play.stats[p.role.stat || 'Cash'] = 0;
    if (r === 'buybutton') { const ty = tycoonOf(p.id); let tgt = null; if (ty) MC.walk(ty, (n) => { if (!tgt && n.name === p.role.target && n !== p) tgt = n; }); if (tgt) { setHidden(tgt, true); p._target = tgt.id; } }
    if (r === 'mover' || r === 'spinner') { const m = meshes.get(p.id); play.dyn.push({ p, m, origin: m.position.clone(), q0: m.quaternion.clone(), followers: [] }); } }
  for (const p of roles) if (p.follow) { const par = play.parent.get(p.id), tgt = par && par.children.find((c) => c.name === p.follow); const d = tgt && play.dyn.find((x) => x.p.id === tgt.id); if (d) d.followers.push({ m: meshes.get(p.id), off: meshes.get(p.id).position.clone().sub(d.origin) }); }
  const sp = MC.partsOf(map.root).find((p) => p.cls === 'SpawnLocation'); play.spawn = sp ? new THREE.Vector3(sp.pos[0], sp.pos[1] + sp.size[1] / 2 + 0.05, sp.pos[2]) : new THREE.Vector3(0, 12, 0);
  play.avatar = buildAvatar(); scene.add(play.avatar); respawn(); rebuildSolids(); drawStats();
  controls.enablePan = false; controls.minDistance = 6; controls.maxDistance = 70; applyLighting(); banner('▶ ' + map.name);
}
function stopPlay() {
  play.on = false; document.body.classList.remove('playing'); $('play').textContent = '▶'; $('tools').classList.remove('hidden'); $('playui').classList.add('hidden'); scene.remove(play.avatar); play.drops.forEach((d) => scene.remove(d.mesh)); play.drops = [];
  controls.enablePan = true; controls.minDistance = 0; controls.maxDistance = Infinity; resize(); rebuildAll(); applyLighting();
}
$('play').onclick = () => (play.on ? stopPlay() : startPlay());
function respawn() { const p = play.cp ? new THREE.Vector3(play.cp.pos[0], play.cp.pos[1] + play.cp.size[1] / 2 + 0.05, play.cp.pos[2]) : play.spawn.clone(); play.pos.copy(p); play.vel.set(0, 0, 0);
  controls.target.copy(p).add(new THREE.Vector3(0, 3, 0)); camera.position.copy(controls.target).add(new THREE.Vector3(0, 10, 22)); }
function die() { const f = $('flash'); f.style.opacity = 0.55; setTimeout(() => (f.style.opacity = 0), 160); banner('💀'); respawn(); }
const _inv = new THREE.Matrix4(), _lp = new THREE.Vector3();
function touching(m, p, pts, margin = 0.35) { _inv.copy(m.matrixWorld).invert(); const hs = [p.size[0] / 2 + margin, p.size[1] / 2 + margin, p.size[2] / 2 + margin], sc = m.scale;
  for (const w of pts) { _lp.copy(w).applyMatrix4(_inv); const x = _lp.x * sc.x, y = _lp.y * sc.y, z = _lp.z * sc.z;
    if (Math.abs(x) <= hs[0] && Math.abs(y) <= hs[1] && Math.abs(z) <= hs[2]) return true; } return false; }
function upAxis(p, m) { const v = new THREE.Vector3(p.shape === 'Cylinder' ? 1 : 0, p.shape === 'Cylinder' ? 0 : 1, 0); return v.applyQuaternion(m.quaternion).normalize(); }
const rc = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0);
function playTick(dt) {
  play.t += dt; const P = play;
  // moving + spinning platforms (carry the avatar standing on them)
  for (const d of P.dyn) { const before = d.m.matrixWorld.clone();
    if (d.p.role.type === 'mover') { const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * P.t) / (d.p.role.period || 4)); d.m.position.copy(d.origin).add(new THREE.Vector3(d.p.role.dx, d.p.role.dy, d.p.role.dz).multiplyScalar(k)); }
    else { d.m.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), P.t * (d.p.role.speed || 120) * D2R).multiply(d.q0)); }
    d.m.updateMatrixWorld(); for (const f of d.followers) { f.m.position.copy(f.off).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.p.role.type === 'spinner' ? P.t * (d.p.role.speed || 120) * D2R : 0)).add(d.m.position); f.m.quaternion.copy(d.m.quaternion); f.m.updateMatrixWorld(); }
    if (P.ground === d.m && P.grounded) P.pos.applyMatrix4(d.m.matrixWorld.clone().multiply(before.invert())); }
  // coins spin
  const now = P.t;
  for (const p of play.coins) { const m = meshes.get(p.id); if (m) { m.rotation.y = p.rot[1] * D2R + now * 2.2; m.position.y = p.pos[1] + Math.sin(now * 2 + p.pos[0]) * 0.35; } }
  // input -> camera-relative move
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const mv = fwd.multiplyScalar(-P.input.y).add(right.multiplyScalar(P.input.x)); if (mv.lengthSq() > 1) mv.normalize();
  if (P.fly) { P.pos.addScaledVector(mv, 48 * dt); P.pos.y += ((P.jump ? 1 : 0) - (P.downKey ? 1 : 0)) * 36 * dt; P.vel.set(0, 0, 0); P.grounded = false; }
  else {
    nearSolids();
    let push = new THREE.Vector3();
    if (P.grounded && P.ground) { const gp = partFor(P.ground.userData.id); if (gp?.role?.type === 'conveyor') push = new THREE.Vector3(0, 0, -1).applyQuaternion(P.ground.quaternion).multiplyScalar(gp.role.speed || 16); }
    P.vel.x = mv.x * WALK + push.x; P.vel.z = mv.z * WALK + push.z; P.vel.y -= GRAV * dt;
    if (P.jump && P.grounded) { P.vel.y = JUMP; P.grounded = false; }
    // horizontal with wall rays at knee / waist / head, sliding along walls
    const step = new THREE.Vector3(P.vel.x * dt, 0, P.vel.z * dt);
    const blocked = (v) => { if (v.lengthSq() < 1e-8) return false; const dir = v.clone().normalize();
      for (const h of [0.7, 2.6, 4.4]) { rc.set(P.pos.clone().add(new THREE.Vector3(0, h, 0)), dir); rc.far = v.length() + 0.9; const hit = rc.intersectObjects(P.solids, false)[0];
        if (hit && (!hit.face || Math.abs(hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y) < 0.6)) return true; } return false; };
    if (!blocked(step)) P.pos.add(step); else { const sx = new THREE.Vector3(step.x, 0, 0), sz = new THREE.Vector3(0, 0, step.z); if (!blocked(sx)) P.pos.add(sx); else if (!blocked(sz)) P.pos.add(sz); }
    // vertical: ground ray from above the feet (also climbs small steps and ramps)
    const ny = P.pos.y + P.vel.y * dt; rc.set(new THREE.Vector3(P.pos.x, P.pos.y + 2.4, P.pos.z), DOWN); rc.far = Math.max(0.1, P.pos.y + 2.4 - ny) + 0.06;
    const g = P.vel.y <= 0 ? rc.intersectObjects(P.solids, false)[0] : null;
    if (g) { P.pos.y = g.point.y; P.vel.y = 0; P.grounded = true; P.ground = g.object; } else { P.pos.y = ny; P.grounded = false; P.ground = null; }
    // trusses: climb when pushing against one
    const truss = P.solids.find((m) => partFor(m.userData.id)?.cls === 'TrussPart' && touching(m, partFor(m.userData.id), [P.pos.clone().add(new THREE.Vector3(0, 2.5, 0))], 1.2));
    if (truss && mv.lengthSq() > 0.1) { P.vel.y = 12; }
  }
  if (P.pos.y < -80) die();
  // gameplay touches
  const pts = [P.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), P.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), P.pos.clone().add(new THREE.Vector3(0, 4.6, 0))];
  const cool = (k, s) => { const t = P.cool.get(k) || 0; if (P.t < t) return false; P.cool.set(k, P.t + s); return true; };
  for (const p of play.roled) { if (P.hidden.has(p.id)) continue; const m = meshes.get(p.id); if (!m || !m.visible) continue; const r = p.role.type;
    if (['dropper', 'upgrader', 'collector', 'conveyor', 'mover', 'spinner'].includes(r)) continue;
    if (!touching(m, p, pts)) continue;
    if (r === 'kill') { die(); break; }
    if (r === 'checkpoint' && (!P.cp || p.role.stage >= (P.cp.role?.stage || 0))) { if (P.cp !== p) { P.cp = p; P.stats.Stage = Math.max(P.stats.Stage || 0, p.role.stage); drawStats(); banner('🚩 Étape ' + p.role.stage, 900); } }
    if (r === 'jumppad' && cool('pad', 0.4)) { P.vel.copy(upAxis(p, m).multiplyScalar(p.role.power || 90)); P.grounded = false; P.pos.y += 0.3; }
    if (r === 'teleporter' && cool('tp', 1.5)) { const o = play.roled.find((q) => q !== p && q.role.type === 'teleporter' && q.role.pair === p.role.pair); if (o) { P.pos.set(o.pos[0], o.pos[1] + 5, o.pos[2]); P.vel.set(0, 0, 0); banner('🌀', 600); } }
    if (r === 'coin' && !P.coinsOff.has(p.id)) { P.coinsOff.set(p.id, P.t + (p.role.respawn || 8)); m.visible = false; addStat(p.role.stat || 'Coins', p.role.value || 1); }
    if (r === 'gate' && !gateOpen(p) && cool('gate', 1.2)) banner(`🔒 Il faut ${p.role.need} ${p.role.stat}`, 1000);
    if (r === 'claim' && !P.owned) { const ty = tycoonOf(p.id); if (ty) { P.owned = ty.id; P.stats.Cash = P.stats.Cash || 0; drawStats(); banner('🏭 Ce tycoon est à toi !'); } }
    if (r === 'buybutton' && P.owned && tycoonOf(p.id)?.id === P.owned && cool('buy' + p.id, 0.6)) {
      if ((P.stats[p.role.stat || 'Cash'] || 0) >= p.role.price) { addStat(p.role.stat || 'Cash', -p.role.price); const tgt = p._target && MC.find(map.root, p._target); if (tgt) setHidden(tgt, false); setHidden(p, true); rebuildSolids(); banner('✅ ' + p.role.target + ' acheté !'); }
      else banner(`❌ Il faut ${p.role.price} ${p.role.stat || 'Cash'}`, 900); }
  }
  for (const [id, t] of P.coinsOff) if (P.t >= t) { P.coinsOff.delete(id); const m = meshes.get(id); if (m) m.visible = true; }
  // gates react to stats
  for (const p of play.gates) { const m = meshes.get(p.id), open = gateOpen(p); if (m && m.userData.open !== open) { m.userData.open = open; m.material = open ? material({ ...p, transparency: 0.85 }) : material(p); rebuildSolids(); const l = labels.get(p.id); if (l && open) l.visible = false; } }
  tycoonTick(dt);
  // avatar + camera follow
  const av = P.avatar; av.position.copy(P.pos); if (mv.lengthSq() > 0.01) { const yaw = Math.atan2(-mv.x, -mv.z); av.rotation.y += ((yaw - av.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 12); }
  const walk = Math.min(1, mv.length()) * (P.grounded ? 1 : 0.2), sw = Math.sin(P.t * 10) * 0.6 * walk; av.children[1].rotation.x = sw; av.children[2].rotation.x = -sw; av.children[3].rotation.x = -sw; av.children[4].rotation.x = sw;
  const tgt = P.pos.clone().add(new THREE.Vector3(0, 3.2, 0)), d = tgt.clone().sub(controls.target); controls.target.add(d); camera.position.add(d);
  const L = MC.lightingOf(map); sun.target.position.copy(P.pos); sun.position.copy(P.pos).add(new THREE.Vector3().copy(skyMat.uniforms.sunDir.value).multiplyScalar(300)); void L;
}
function tycoonTick(dt) {
  const P = play;
  if (P.owned) for (const p of play.droppers) { if ( P.hidden.has(p.id) || tycoonOf(p.id)?.id !== P.owned) continue;
    p._next = (p._next ?? P.t) ; if (P.t < p._next || P.drops.length > 60) continue; p._next = P.t + (p.role.interval || 2);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: ['#ffd34d', '#5ad1ff', '#c86bff', '#3dffa8'][Math.floor(Math.random() * 4)], roughness: 0.4 }));
    mesh.castShadow = true; mesh.position.set(p.pos[0], p.pos[1] - p.size[1] / 2 - 0.7, p.pos[2]); scene.add(mesh); P.drops.push({ mesh, vel: new THREE.Vector3(), value: p.role.value || 5, ups: new Set(), born: P.t }); }
  const mats = play.dropMats.filter((p) => !P.hidden.has(p.id));
  for (const d of [...P.drops]) {
    d.vel.y -= GRAV * 0.5 * dt; const m = d.mesh; rc.set(m.position.clone().add(new THREE.Vector3(0, 0.4, 0)), DOWN); rc.far = 0.95 + Math.max(0, -d.vel.y * dt);
    const hit = rc.intersectObjects(P.solids, false)[0];
    if (hit && d.vel.y <= 0) { m.position.y = hit.point.y + 0.5; d.vel.y = 0; const gp = partFor(hit.object.userData.id);
      if (gp?.role?.type === 'conveyor') { const v = new THREE.Vector3(0, 0, -1).applyQuaternion(hit.object.quaternion).multiplyScalar(gp.role.speed || 10); d.vel.x = v.x; d.vel.z = v.z; } else { d.vel.x *= 0.8; d.vel.z *= 0.8; } }
    m.position.addScaledVector(d.vel, dt);
    for (const q of mats) { const qm = meshes.get(q.id); if (!touching(qm, q, [m.position], 0.6)) continue;
      if (q.role.type === 'upgrader' && !d.ups.has(q.id)) { d.ups.add(q.id); d.value *= q.role.mult || 2; m.material.emissive = new THREE.Color('#ffffff'); m.material.emissiveIntensity = 0.6; }
      if (q.role.type === 'collector') { addStat(q.role.stat || 'Cash', Math.floor(d.value)); scene.remove(m); P.drops.splice(P.drops.indexOf(d), 1); break; } }
    if (P.t - d.born > 30 && P.drops.includes(d)) { scene.remove(m); P.drops.splice(P.drops.indexOf(d), 1); }
  }
}
// touch controls
{ const stick = $('stick'), knob = $('knob'); let id = null, c = null;
  stick.addEventListener('pointerdown', (e) => { id = e.pointerId; stick.setPointerCapture(id); const r = stick.getBoundingClientRect(); c = [r.left + r.width / 2, r.top + r.height / 2]; mvStick(e); });
  const mvStick = (e) => { if (e.pointerId !== id) return; let dx = e.clientX - c[0], dy = e.clientY - c[1]; const l = Math.hypot(dx, dy), mx = 48; if (l > mx) { dx *= mx / l; dy *= mx / l; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; play.input.set(dx / mx, dy / mx); };
  stick.addEventListener('pointermove', mvStick);
  const end = () => { id = null; knob.style.transform = ''; play.input.set(0, 0); }; stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  const hold = (el, k) => { el.addEventListener('pointerdown', (e) => { e.preventDefault(); play[k] = true; }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => (play[k] = false)); };
  hold($('jump'), 'jump'); hold($('down'), 'downKey');
  const keys = new Set(); const kupd = () => { play.input.set((keys.has('d') ? 1 : 0) - (keys.has('a') || keys.has('q') ? 1 : 0), (keys.has('s') ? 1 : 0) - (keys.has('w') || keys.has('z') ? 1 : 0)); play.jump = keys.has(' '); play.downKey = keys.has('shift'); };
  addEventListener('keydown', (e) => { if (!play.on || e.target.closest('input,textarea')) return; keys.add(e.key.toLowerCase()); if (e.key.toLowerCase() === 'f') toggleFly(); kupd(); });
  addEventListener('keyup', (e) => { keys.delete(e.key.toLowerCase()); if (play.on) kupd(); });
  const fly = document.createElement('button'); fly.className = 'pbtn'; fly.id = 'flyBtn'; fly.textContent = '🕊️'; Object.assign(fly.style, { right: 'calc(22px + env(safe-area-inset-right))', bottom: 'calc(118px + env(safe-area-inset-bottom))', width: '58px', height: '58px', fontSize: '22px' });
  $('playui').appendChild(fly); fly.onclick = () => toggleFly(); }
function toggleFly() { play.fly = !play.fly; $('down').classList.toggle('hidden', !play.fly); $('flyBtn').style.background = play.fly ? 'rgba(124,92,255,.7)' : ''; banner(play.fly ? '🕊️ Vol libre' : '🚶 Marche', 800); }

/* =====================================================================
   7. LOOP + LAYOUT
   ===================================================================== */
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop); const dt = Math.min(0.25, clock.getDelta());
  if (play.on) { let rem = dt; while (rem > 1e-4) { const s = Math.min(1 / 60, rem); playTick(s); rem -= s; } } // fixed sub-steps: same speed on slow devices
  else { sun.target.position.copy(controls.target); sun.position.copy(controls.target).add(skyMat.uniforms.sunDir.value.clone().multiplyScalar(300)); }
  sky.position.copy(camera.position); controls.update(); composer.render();
}
function resize() { const r = view.getBoundingClientRect(), w = Math.round(r.width) || innerWidth, h = r.height; renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w / 2, h / 2); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
{ let y0 = null, h0 = 0; const grip = $('grip');
  grip.addEventListener('pointerdown', (e) => { y0 = e.clientY; h0 = view.getBoundingClientRect().height; grip.setPointerCapture(e.pointerId); });
  grip.addEventListener('pointermove', (e) => { if (y0 == null) return; const h = Math.max(innerHeight * 0.28, Math.min(innerHeight * 0.82, h0 + e.clientY - y0)); document.documentElement.style.setProperty('--vh', h + 'px'); resize(); });
  grip.addEventListener('pointerup', () => (y0 = null)); }

/* =====================================================================
   8. PANES
   ===================================================================== */
const pane = $('pane');
function setTab(id) { ui.tab = id; document.querySelectorAll('.tab[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === id)); renderPane(); pane.scrollTop = 0; }
document.querySelectorAll('.tab[data-tab]').forEach((b) => b.onclick = () => setTab(b.dataset.tab));
const LIB = createLibrary({ studio: 'map', toast });
function renderPane() { ({ gen: paneGen, obj: paneObj, props: paneProps, tools: paneTools, light: paneLight, lib: () => LIB.render(pane), code: paneCode, export: paneExport })[ui.tab](); }
function vecRow(label, key, arr, step) { return `<div class="row"><label>${label}</label><div class="vec" data-vec="${key}">${arr.map((v, i) => `<input type="number" inputmode="decimal" step="${step}" data-i="${i}" value="${+(+v).toFixed(3)}">`).join('')}</div></div>`; }
const OPT_FR = { stages: 'Étapes', plots: 'Parcelles', zones: 'Zones', size: 'Taille', blocks: 'Pâtés', length: 'Longueur', islands: 'Îles' };

/* ---------- generators ---------- */
function paneGen() {
  const g = MC.GENERATORS[ui.gen.id]; for (const [k, v] of Object.entries(g.opts)) if (ui.gen.opts[k] == null) ui.gen.opts[k] = v[2];
  pane.innerHTML = `<div class="sec"><h3>🧠 Décris ta map <small>le générateur s'occupe du reste</small></h3>
      <textarea id="mapQ" class="lsearch" rows="2" style="width:100%;resize:none" placeholder="Écris tout ce que tu veux : ferme avec 3 vaches et 3 cochons bleus avec des ailes · île tropicale avec un obby · village enneigé avec 2 loups géants…">${esc(ui.mapQ || '')}</textarea>
      <div class="btns" style="margin-top:8px"><button class="btn pri" id="mapGo" style="flex:1">✨ Générer la map</button><button class="btn" id="mapDice">🎲</button></div>
      <div class="chips" style="margin-top:8px">${['une ferme avec 3 vaches et 3 cochons bleus avec des ailes', '2 dragons dorés géants, un château et une forêt', 'village avec 5 tentes rouges, un puits et un feu de camp', 'simulator avec 4 socles d\'œuf, une boutique et un coffre', 'tycoon dans le désert avec 3 moutons et des tonneaux'].map((x) => `<button class="chip" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <div class="note" style="margin-top:6px">Comprend plus de 2764 mots (français et anglais, singulier et pluriel) : genre de jeu, thème, animaux (zèbre, pégase, loup-garou…), bâtiments (école, hôpital, pizzeria…), véhicules, meubles, nourriture, plantes, objets — avec le nombre (3, trois, quelques), la couleur (bleu, doré, turquoise…), « avec des ailes », géant / petit. Un mot inconnu compté (« 4 xylophones ») devient un objet avec son nom.</div></div>
    <div class="sec"><h3>🎨 Style de la carte</h3><div class="chips">${[['classic', '🧱 Classique'], ['voxel', '🧊 Voxel']].map(([k, l]) => `<button class="chip${(ui.mapStyle || 'voxel') === k ? ' on' : ''}" data-mst="${k}">${l}</button>`).join('')}</div>
      <div class="note" style="margin-top:6px">${(ui.mapStyle || 'voxel') === 'voxel' ? 'Voxel : terrain en cubes (collines, falaises, lacs, mer), arbres, rochers, buissons, fleurs, champignons et nuages sculptés en petits cubes, et toutes les pièces montrent leurs cubes (bord biseauté + nuance), comme les pets voxel.' : 'Classique : pièces lisses, arbres et décors faits de formes simples.'}</div>
      <button class="btn big" id="toVoxel" style="margin-top:8px">🧊 Passer ma carte actuelle en voxel</button></div>
    <div class="sec"><h3>🗺️ Cartes complètes <small>prêtes à jouer, un seul appui</small></h3><div class="cards">${FULL_MAPS.map((m, i) => `<button class="card fullmap" data-full="${i}"><span class="e">${m.e}</span><b>${m.name}</b><small>${m.desc}</small></button>`).join('')}</div></div>
    <div class="sec"><h3>Genre de jeu <small>tout est jouable</small></h3><div class="cards">${Object.entries(MC.GENERATORS).map(([id, x]) => `<button class="card${id === ui.gen.id ? ' on' : ''}" data-gen="${id}"><span class="e">${x.e}</span>${x.fr}</button>`).join('')}</div></div>
    <div class="sec"><h3>Thème <small>matériaux, couleurs, ambiance</small></h3><div class="chips">${Object.entries(MC.THEMES).map(([id, t]) => `<button class="chip${id === ui.gen.theme ? ' on' : ''}" data-th="${id}">${t.e} ${t.label}</button>`).join('')}</div>
      ${Object.entries(g.opts).map(([k, [a, b]]) => `<div class="row"><label>${OPT_FR[k] || k}</label><input type="range" data-opt="${k}" min="${a}" max="${b}" step="1" value="${ui.gen.opts[k]}"><span class="val">${ui.gen.opts[k]}</span></div>`).join('')}
      <div class="row"><label>Graine</label><input type="number" id="seed" value="${ui.gen.seed}"><button class="btn" id="dice">🎲</button></div>
      <div class="row"><label>Décor autour</label><button class="sw${ui.scenery !== false ? ' on' : ''}" id="scen"></button><span class="note">arbres, maisons, montagnes, nuages</span></div>
      <button class="btn pri big" id="genNew">${g.e} Créer la carte ${g.fr}</button><button class="btn big" id="genAdd">＋ Ajouter à côté de ma carte</button></div>
    <div class="sec"><div class="note">${{ obby: 'Parcours avec sauts, lave, tourniquets, plateformes mobiles, tremplins, échelles, tapis et checkpoints (Stage dans le classement).', tycoon: 'Parcelles à réclamer : droppers → tapis → upgrader → collecteur qui donne du <b>Cash</b>. Les boutons verts achètent les droppers, murs et tour.', simulator: 'Zones de plus en plus riches remplies de pièces. Les portes s\'ouvrent quand tu as assez de <b>Coins</b>.', lobby: 'Place centrale avec fontaine, piliers lumineux, bancs et portails vers un balcon secret.', arena: 'Arène circulaire avec murs néon, couvertures, rampes et 4 points d\'apparition.', island: 'Île tropicale : océan, plage, palmiers, rochers, ponton.', city: 'Quartier : routes, trottoirs, immeubles éclairés, lampadaires.', cave: 'Tunnel de roche avec cristaux lumineux, bassins de lave et pièces.', sky: 'Îles flottantes reliées par des tremplins, avec checkpoints et nuages.' }[ui.gen.id]}</div></div>`;
  $('mapQ').oninput = (e) => (ui.mapQ = e.target.value);
  pane.querySelectorAll('[data-ex]').forEach((b) => b.onclick = () => { ui.mapQ = b.dataset.ex; $('mapQ').value = ui.mapQ; });
  const fromText = (txt, o = {}, title) => { if (MC.partsOf(map.root).length > 0 && !confirm('Remplacer la carte actuelle ? (↶ pour revenir)')) return; snapshot();
    const g = MM.generateFromText(txt, Math.floor(Math.random() * 1e9), { voxel: (ui.mapStyle || 'voxel') === 'voxel', ...o }); if (title) map.name = title.replace(/[^\p{L}\p{N}]+/gu, ''); map.theme = g.theme; map.lighting = { preset: g.light, over: {} }; map.gen = { id: g.gen, seed: 0, opts: g.opts, text: txt };
    map.root.children = g.children; sel.clear(); save(); rebuildAll(); applyLighting(); selectionChanged(); focusOn(MC.partsOf(map.root.children[0]));
    toast(`✨ ${MC.GENERATORS[g.gen].fr} · ${MC.THEMES[g.theme].label} · ${MC.stats(map).parts} pièces`); };
  $('mapGo').onclick = () => fromText(ui.mapQ || '');
  pane.querySelectorAll('[data-mst]').forEach((b) => b.onclick = () => { ui.mapStyle = b.dataset.mst; try { localStorage.setItem('forge.mapStyle', ui.mapStyle); } catch {} paneGen(); });
  pane.querySelectorAll('[data-full]').forEach((b) => b.onclick = () => { const m = FULL_MAPS[+b.dataset.full]; ui.mapQ = m.text; fromText(m.text, { density: 1.3, voxel: true }, m.name); });
  $('toVoxel').onclick = () => { if (!MC.partsOf(map.root).length) return toast('Crée d\u2019abord une carte'); snapshot(); toast('🧊 Conversion en voxel…', 1500);
    setTimeout(() => { const kids = map.root.children, game = kids.find((k) => k.name === 'Gameplay') || null, scen = kids.find((k) => k.name === 'Scenery');
      const ps = MC.partsOf(game || { children: kids.filter((k) => k !== scen) }), bx = [Infinity, Infinity, -Infinity, -Infinity];
      for (const p of ps) { bx[0] = Math.min(bx[0], p.pos[0]); bx[1] = Math.min(bx[1], p.pos[2]); bx[2] = Math.max(bx[2], p.pos[0]); bx[3] = Math.max(bx[3], p.pos[2]); }
      if (!isFinite(bx[0])) bx.splice(0, 4, -40, -40, 40, 40);
      MV.voxelTag(kids.filter((k) => k !== scen));
      if (scen) { const keep = scen.children.filter((c) => !/^(Ground|Mountains|Cloud|Oak|Pine|Tree|Rocks|Flowers|Cactus|Crystals)/.test(c.name) && c.cls === 'Model'); MV.voxelTag(keep);
        scen.children = [...MV.voxelScenery(map.theme || 'plaine', bx, MC.rng(Date.now() % 99991), 1, []), ...keep]; }
      else map.root.children.push(MC.model('Scenery', MV.voxelScenery(map.theme || 'plaine', bx, MC.rng(Date.now() % 99991), 1, [])));
      save(); rebuildAll(); selectionChanged(); toast('🧊 Carte en voxel · ' + MC.stats(map).parts + ' pièces'); }, 30); };
  $('mapDice').onclick = () => { const r = Math.random, g = ['obby', 'tycoon', 'simulator', 'lobby', 'arène', 'île', 'ville', 'grotte', 'ciel'], t = ['prairie', 'désert', 'neige', 'volcan', 'bonbon', 'néon', 'espace'], e = ['château', 'temple', 'cascade', 'moulin', 'statue', 'village', 'volcan'];
    ui.mapQ = `${g[Math.floor(r() * g.length)]} ${t[Math.floor(r() * t.length)]} avec ${e[Math.floor(r() * e.length)]} et ${e[Math.floor(r() * e.length)]}`; $('mapQ').value = ui.mapQ; fromText(ui.mapQ); };
  pane.querySelectorAll('[data-gen]').forEach((b) => b.onclick = () => { ui.gen.id = b.dataset.gen; ui.gen.opts = {}; paneGen(); });
  pane.querySelectorAll('[data-th]').forEach((b) => b.onclick = () => { ui.gen.theme = b.dataset.th; paneGen(); });
  pane.querySelectorAll('[data-opt]').forEach((i) => i.oninput = () => { ui.gen.opts[i.dataset.opt] = +i.value; i.nextElementSibling.textContent = i.value; });
  $('scen').onclick = () => { ui.scenery = ui.scenery === false; $('scen').classList.toggle('on', ui.scenery !== false); };
  $('seed').onchange = (e) => (ui.gen.seed = +e.target.value || 1); $('dice').onclick = () => { ui.gen.seed = Math.floor(Math.random() * 99999); $('seed').value = ui.gen.seed; };
  $('genNew').onclick = () => { if (MC.partsOf(map.root).length > 0 && !confirm('Remplacer la carte actuelle ? (↶ pour revenir)')) return; snapshot();
    const th = MC.THEMES[ui.gen.theme]; map.theme = ui.gen.theme; map.lighting = { preset: th.light, over: {} }; map.gen = clone(ui.gen);
    { const r = MC.rng(ui.gen.seed), core = g.make(th, r, ui.gen.opts), bx = [Infinity, Infinity, -Infinity, -Infinity];
      for (const p of core.flatMap((n) => MC.partsOf(n))) { bx[0] = Math.min(bx[0], p.pos[0]); bx[1] = Math.min(bx[1], p.pos[2]); bx[2] = Math.max(bx[2], p.pos[0]); bx[3] = Math.max(bx[3], p.pos[2]); }
      const vox = (ui.mapStyle || 'voxel') === 'voxel'; if (vox) MV.voxelTag(core);
      map.root.children = ui.scenery === false ? core : [MC.model('Gameplay', core), MC.model('Scenery', vox ? MV.voxelScenery(ui.gen.theme, bx, r, 1, []) : MM.scenery(th, ui.gen.theme, bx, r, 1))]; } sel.clear(); save(); rebuildAll(); applyLighting(); selectionChanged(); focusOn(MC.partsOf(map.root)); toast(g.e + ' ' + g.fr + ' créé · ' + MC.stats(map).parts + ' pièces'); };
  $('genAdd').onclick = () => { snapshot(); const th = MC.THEMES[ui.gen.theme], kids = g.make(th, MC.rng(ui.gen.seed), ui.gen.opts), grp = MC.model(g.fr.replace(/\W/g, '') || 'Zone', kids);
    const cur = new THREE.Box3(); MC.partsOf(map.root).forEach((p) => cur.expandByPoint(new THREE.Vector3(...p.pos)));
    const nb = new THREE.Box3(); MC.partsOf(grp).forEach((p) => nb.expandByPoint(new THREE.Vector3(...p.pos)));
    const dx = cur.isEmpty() ? 0 : cur.max.x - nb.min.x + 40; MC.partsOf(grp).forEach((p) => (p.pos[0] = +(p.pos[0] + dx).toFixed(3)));
    MC.partsOf(grp).forEach((p) => { if (p.cls === 'SpawnLocation') { p.cls = 'Part'; p.name = 'Pad'; } }); // one spawn per game
    map.root.children.push(grp); save(); rebuildAll(); sel = new Set([grp.id]); selectionChanged(); focusOn(MC.partsOf(grp)); toast(g.e + ' ajouté à côté'); };
}

/* ---------- objects: palette + hierarchy ---------- */
const PALETTE = [
  ['Part', 'Block', '🧱 Bloc'], ['Part', 'Cylinder', '🛢️ Cylindre'], ['Part', 'Ball', '⚪ Boule'], ['WedgePart', null, '◢ Coin'], ['CornerWedgePart', null, '◣ Coin d\'angle'], ['TrussPart', null, '🪜 Échelle'], ['SpawnLocation', null, '🔆 Apparition']];
function rolePiece(type, at) {
  const t = T(), x = at.x, z = at.z, y = at.y;
  const base = { kill: () => MC.block('KillBrick', [8, 1, 8], [x, y + 0.5, z], { c: '#ff3b1f', m: 'Neon' }), checkpoint: () => MC.block('Checkpoint', [8, 1, 8], [x, y + 0.5, z], { c: '#3dd16b', m: 'SmoothPlastic' }),
    jumppad: () => MC.P('Part', 'JumpPad', [0.6, 5, 5], [x, y + 0.3, z], [0, 0, 90], t.glow, { shape: 'Cylinder' }), conveyor: () => MC.block('Conveyor', [6, 1, 20], [x, y + 0.5, z], { c: '#2d2d35', m: 'DiamondPlate' }),
    mover: () => MC.block('MovingPlatform', [8, 1, 8], [x, y + 4, z], t.accent2), spinner: () => MC.block('Spinner', [16, 1.2, 1.2], [x, y + 1.6, z], { c: '#ff3b5c', m: 'Neon' }),
    teleporter: () => MC.P('Part', 'Teleporter', [1, 8, 8], [x, y + 0.5, z], [0, 0, 90], t.glow, { shape: 'Cylinder' }), coin: () => MC.P('Part', 'Coin', [0.4, 2.2, 2.2], [x, y + 3, z], [0, 90, 0], { c: '#ffd34d', m: 'Neon' }, { shape: 'Cylinder', canCollide: false }),
    gate: () => MC.block('Gate', [2, 14, 20], [x, y + 7, z], { c: '#7cf7ff', m: 'ForceField' }, { transparency: 0.3 }), claim: () => MC.block('ClaimPad', [8, 1, 8], [x, y + 0.5, z], { c: '#3dd16b', m: 'Neon' }),
    dropper: () => MC.block('DropperOutput', [2, 1, 2], [x, y + 8, z], { c: '#20202a', m: 'Metal' }), upgrader: () => MC.block('Upgrader', [5, 4, 0.6], [x, y + 3, z], { c: '#7cf7ff', m: 'ForceField' }, { canCollide: false }),
    collector: () => MC.block('Collector', [8, 3, 4], [x, y + 1.5, z], { c: '#3dffa8', m: 'Neon' }), buybutton: () => MC.block('BuyButton', [5, 1, 5], [x, y + 0.5, z], { c: '#3dd16b', m: 'Neon' }) }[type]();
  base.role = MC.role(type); return base;
}
function dropPoint() { // where new things land: on whatever is under the camera target
  const t = controls.target.clone(); rc.set(t.clone().add(new THREE.Vector3(0, 200, 0)), DOWN); rc.far = 400; const h = rc.intersectObjects([...meshes.values()], false)[0];
  const s = ui.snap || 1; return new THREE.Vector3(Math.round(t.x / s) * s, h ? h.point.y : 0, Math.round(t.z / s) * s); }
function insert(nodes, msg) { snapshot(); map.root.children.push(...nodes); save(); for (const n of nodes) for (const p of MC.partsOf(n)) addPart(p); updateInfo(); sel = new Set(nodes.map((n) => n.id)); selectionChanged(); toast(msg); }
function paneObj() {
  const rows = []; const walk = (n, d) => { for (const c of n.children || []) { rows.push({ n: c, d }); if (c.cls === 'Model' && ui.open.has(c.id)) walk(c, d + 1); } }; walk(map.root, 0);
  pane.innerHTML = `<div class="sec"><h3>Pièces Roblox</h3><div class="cards">${PALETTE.map(([c, s, l], i) => `<button class="card" data-pal="${i}">${l.split(' ')[0]}<small>${l.split(' ').slice(1).join(' ')}</small></button>`).join('')}</div></div>
    <div class="sec"><h3>Gameplay <small>scripts inclus</small></h3><div class="cards">${Object.entries(MC.ROLES).map(([k, r]) => `<button class="card" data-role="${k}"><span class="e">${r.e}</span>${r.fr}</button>`).join('')}</div></div>
    <div class="sec"><h3>Décor</h3><div class="cards"><button class="card" data-deco="tree"><span class="e">🌳</span>Arbre</button><button class="card" data-deco="palm"><span class="e">🌴</span>Palmier</button><button class="card" data-deco="lamp"><span class="e">💡</span>Lampadaire</button>
      <button class="card" data-deco="coins"><span class="e">🪙</span>5 pièces</button><button class="card" data-deco="portals"><span class="e">🌀</span>Portails</button>
      ${[['pine', '🌲', 'Sapin'], ['oak', '🌳', 'Chêne'], ['cherry', '🌸', 'Cerisier'], ['cactus', '🌵', 'Cactus'], ['rocks', '🪨', 'Rochers'], ['crystals', '💎', 'Cristaux'], ['flowers', '🌷', 'Fleurs'], ['house', '🏠', 'Maison'],
        ['castle', '🏰', 'Château'], ['temple', '🏛️', 'Temple'], ['windmill', '🌬️', 'Moulin'], ['statue', '🗽', 'Statue'], ['waterfall', '💧', 'Cascade'], ['volcano', '🌋', 'Volcan'], ['fence', '🚧', 'Clôture'], ['bridge', '🌉', 'Pont'], ['cloud', '☁️', 'Nuage']]
        .map(([k, e, l]) => `<button class="card" data-deco="${k}"><span class="e">${e}</span>${l}</button>`).join('')}</div></div>
    <div class="sec"><h3>🧰 Ressources <small>${Object.keys(PROPS).length} modèles</small></h3>
      <div class="chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${Object.entries(PROP_CATS).map(([k, l]) => `<button class="card" style="width:auto;padding:6px 10px" data-pcat="${k}"${(ui.propCat || 'village') === k ? ' aria-pressed="true"' : ''}>${l}${(ui.propCat || 'village') === k ? ' ✓' : ''}</button>`).join('')}</div>
      <div class="cards">${Object.entries(PROPS).filter(([, p]) => p.cat === (ui.propCat || 'village')).map(([k, p]) => `<button class="card" data-prop="${k}"><span class="e">${p.e}</span>${p.fr}</button>`).join('')}</div></div>
    <div class="sec"><h3>Hiérarchie <small>${rows.length} éléments</small></h3><ul class="tree">${rows.slice(0, 600).map(({ n, d }) => `<li data-id="${n.id}" class="${sel.has(n.id) ? 'on' : ''}" style="padding-left:${8 + d * 14}px">${n.cls === 'Model' ? `<span class="tw" data-tw="${n.id}">${ui.open.has(n.id) ? '▾' : '▸'}</span>📦` : `<span class="tw"></span>${n.role ? MC.ROLES[n.role.type].e : '▫️'}`} ${esc(n.name)}<span class="cl">${n.cls === 'Model' ? MC.partsOf(n).length + ' pièces' : MC.PART_CLASSES[n.cls]}</span></li>`).join('')}</ul></div>`;
  pane.querySelectorAll('[data-pal]').forEach((b) => b.onclick = () => { const [cls, shape] = PALETTE[+b.dataset.pal], at = dropPoint();
    const size = cls === 'TrussPart' ? [2, 10, 2] : cls === 'SpawnLocation' ? [6, 1, 6] : shape === 'Cylinder' ? [6, 4, 4] : shape === 'Ball' ? [4, 4, 4] : [4, 4, 4];
    const p = MC.P(cls, { Part: shape === 'Block' ? 'Part' : shape, WedgePart: 'Wedge', CornerWedgePart: 'CornerWedge', TrussPart: 'Truss', SpawnLocation: 'Spawn' }[cls], size, [at.x, at.y + size[1] / 2, at.z], [0, 0, 0], cls === 'SpawnLocation' ? T().glow : T().accent, { shape: shape || 'Block' });
    insert([p], PALETTE[+b.dataset.pal][2] + ' ajouté'); });
  pane.querySelectorAll('[data-role]').forEach((b) => b.onclick = () => { const at = dropPoint(), type = b.dataset.role;
    if (type === 'teleporter') { const a = rolePiece(type, at), c = rolePiece(type, at.clone().add(new THREE.Vector3(20, 0, 0))); const code = String.fromCharCode(65 + Math.floor(Math.random() * 26)); a.role.pair = c.role.pair = code; insert([a, c], '🌀 2 téléporteurs (code ' + code + ')'); return; }
    insert([rolePiece(type, at)], MC.ROLES[type].e + ' ' + MC.ROLES[type].fr + ' ajouté'); });
  pane.querySelectorAll('[data-deco]').forEach((b) => b.onclick = () => { const at = dropPoint(), r = MC.rng(Math.floor(Math.random() * 1e6)), t = T();
    const n = { tree: () => [MC.tree(t, at.x, at.z, r, at.y)], palm: () => [MC.palm(t, at.x, at.z, r, at.y)], lamp: () => [MC.lamp(t, at.x, at.z, at.y)], coins: () => [MC.model('Coins', MC.coinRow(5, [at.x - 6, at.y + 3, at.z], [3, 0, 0]))],
      portals: () => MC.portalPair(t, [at.x - 12, at.y, at.z], [at.x + 12, at.y, at.z], String.fromCharCode(65 + Math.floor(Math.random() * 26))),
      pine: () => [MM.pine(t, at.x, at.z, r, at.y)], oak: () => [MM.oak(t, at.x, at.z, r, at.y)], cherry: () => [MM.oak(t, at.x, at.z, r, at.y, 1, true)], cactus: () => [MM.cactus(at.x, at.z, r, at.y)],
      rocks: () => [MM.rocks(t, at.x, at.z, r, at.y)], crystals: () => [MM.crystals(t, at.x, at.z, r, at.y)], flowers: () => [MM.flowers(at.x, at.z, r, at.y)], house: () => [MM.house(t, at.x, at.z, 0, r, at.y)],
      castle: () => [MM.castle(t, at.x, at.z, r, at.y)], temple: () => [MM.temple(t, at.x, at.z, r, at.y)], windmill: () => [MM.windmill(t, at.x, at.z, r, at.y)], statue: () => [MM.statue(t, at.x, at.z, r, at.y)],
      waterfall: () => [MM.waterfall(t, at.x, at.z, r, at.y)], volcano: () => [MM.volcano(t, at.x, at.z, r, at.y, 0.6)], fence: () => [MM.fence(t, at.x - 15, at.z, at.x + 15, at.z, at.y)], bridge: () => [MM.bridge(t, at.x, at.z - 15, at.x, at.z + 15, at.y)],
      cloud: () => [MM.cloud(at.x, at.y + 40, at.z, r)] }[b.dataset.deco]();
    insert(n, 'Décor ajouté'); });
  pane.querySelectorAll('[data-pcat]').forEach((b) => b.onclick = () => { ui.propCat = b.dataset.pcat; paneObj(); });
  pane.querySelectorAll('[data-prop]').forEach((b) => b.onclick = () => { const at = dropPoint(), r = MC.rng(Math.floor(Math.random() * 1e6)), p = PROPS[b.dataset.prop];
    insert([p.build(T(), at.x, at.z, r, at.y)], p.e + ' ' + p.fr + ' ajouté'); });
  pane.querySelectorAll('[data-tw]').forEach((s) => s.onclick = (e) => { e.stopPropagation(); const id = s.dataset.tw; ui.open.has(id) ? ui.open.delete(id) : ui.open.add(id); paneObj(); });
  pane.querySelectorAll('.tree li').forEach((li) => li.onclick = () => { select(li.dataset.id); focusOn(selParts()); });
}

/* ---------- properties ---------- */
const MAT_FR = { Plastic: 'Plastique', SmoothPlastic: 'Lisse', Neon: 'Néon', Wood: 'Bois', WoodPlanks: 'Planches', Brick: 'Brique', Cobblestone: 'Pavés', Concrete: 'Béton', Slate: 'Ardoise', Granite: 'Granit', Marble: 'Marbre', Basalt: 'Basalte', Rock: 'Roche',
  Pebble: 'Galets', Grass: 'Herbe', LeafyGrass: 'Feuillage', Sand: 'Sable', Snow: 'Neige', Ice: 'Glace', Glacier: 'Glacier', Glass: 'Verre', ForceField: 'Champ', Metal: 'Métal', DiamondPlate: 'Tôle', CorrodedMetal: 'Rouille', Foil: 'Chrome', Fabric: 'Tissu',
  Asphalt: 'Asphalte', Pavement: 'Dalles', CrackedLava: 'Lave', Sandstone: 'Grès' };
let matURLs = null;
function paneProps() {
  const ps = selParts();
  if (!ps.length) { pane.innerHTML = '<div class="note" style="margin:12px 2px">Touche une pièce dans la vue 3D (ou ⧉ Multi pour en prendre plusieurs). Tout se règle ici : taille, position, rotation, couleur, matériau, collisions, gameplay…</div>'; return; }
  if (!matURLs) matURLs = Object.fromEntries(MC.MATERIALS.map((m) => [m, matPreview(m)]));
  const p = ps[0], one = ps.length === 1, t = T(), sw = [t.ground.c, t.path.c, t.wall.c, t.deco.c, t.accent.c, t.accent2.c, t.glow.c, t.rock.c, '#ffffff', '#1b1b1f', '#ff3b1f', '#3dd16b', '#ffd34d', '#3aa8ff'];
  pane.innerHTML = `<div class="sec"><h3>${one ? esc(p.name) : ps.length + ' pièces'} <small>${one ? MC.PART_CLASSES[p.cls] : 'modification groupée'}</small></h3>
    ${one ? `<div class="row"><label>Nom</label><input type="text" id="pName" value="${esc(p.name)}"></div>
      <div class="row"><label>Classe</label><select id="pCls">${Object.entries(MC.PART_CLASSES).map(([k, v]) => `<option value="${k}"${k === p.cls ? ' selected' : ''}>${v} (${k})</option>`).join('')}</select></div>
      ${p.cls === 'Part' ? `<div class="row"><label>Forme</label><select id="pShape">${Object.entries(MC.SHAPES).map(([k, v]) => `<option value="${k}"${k === p.shape ? ' selected' : ''}>${v}</option>`).join('')}</select></div>` : ''}
      ${vecRow('Taille', 'size', p.size, ui.snap || 0.1)}${vecRow('Position', 'pos', p.pos, ui.snap || 0.1)}${vecRow('Rotation°', 'rot', p.rot, 15)}` : ''}
    <div class="row"><label>Couleur</label><input type="color" id="pColor" value="${p.color}"><div class="swatches">${sw.map((c) => `<button data-sw="${c}" style="background:${c}"></button>`).join('')}</div></div>
    <div class="row"><label>Transparence</label><input type="range" id="pT" min="0" max="1" step="0.05" value="${p.transparency || 0}"><span class="val">${(p.transparency || 0).toFixed(2)}</span></div>
    <div class="row"><label>Reflet</label><input type="range" id="pR" min="0" max="1" step="0.05" value="${p.reflectance || 0}"><span class="val">${(p.reflectance || 0).toFixed(2)}</span></div>
    <div class="row"><label>Ancrée</label><button class="sw${p.anchored !== false ? ' on' : ''}" id="pA"></button><label style="width:auto">Collisions</label><button class="sw${p.canCollide !== false ? ' on' : ''}" id="pC"></button></div>
    <div class="row"><label>Lumière</label><button class="sw${p.light ? ' on' : ''}" id="pL"></button>${p.light ? `<input type="range" id="pLR" min="4" max="60" step="1" value="${p.light.range || 16}"><span class="val">${p.light.range || 16}</span>` : ''}</div>
    ${one ? `<div class="row"><label>Texte au-dessus</label><input type="text" id="pLabel" placeholder="(aucun)" value="${esc(p.label || '')}"></div>` : ''}</div>
    <div class="sec"><h3>Matériau <small>${MAT_FR[p.material] || p.material}</small></h3><div class="mats">${MC.MATERIALS.map((m) => `<button class="mat${m === p.material ? ' on' : ''}" data-mat="${m}"><i style="background-image:url(${matURLs[m]});background-color:${p.color};background-blend-mode:multiply"></i>${MAT_FR[m] || m}</button>`).join('')}</div></div>
    ${one ? `<div class="sec"><h3>Gameplay <small>${p.role ? MC.ROLES[p.role.type].hint : 'aucun'}</small></h3>
      <div class="row"><label>Rôle</label><select id="pRole"><option value="">— Décor —</option>${Object.entries(MC.ROLES).map(([k, r]) => `<option value="${k}"${p.role?.type === k ? ' selected' : ''}>${r.e} ${r.fr}</option>`).join('')}</select></div>
      ${p.role ? Object.keys(MC.ROLES[p.role.type].p).map((k) => `<div class="row"><label>${MC.ROLE_FR_PARAM[k] || k}</label><input type="${typeof MC.ROLES[p.role.type].p[k] === 'number' ? 'number' : 'text'}" data-rp="${k}" value="${esc(p.role[k])}" step="any"></div>`).join('') : ''}</div>` : ''}`;
  let sn = false; const once = () => { if (!sn) { snapshot(); sn = true; } };
  const each = (fn, rebuild = true) => { once(); ps.forEach(fn); save(); if (rebuild) { ps.forEach(rebuildPart); refreshOutlines(); } };
  if (one) {
    $('pName').onchange = (e) => { once(); p.name = e.target.value.replace(/[^\w ]/g, '').trim() || 'Part'; save(); selectionChanged(); };
    $('pCls').onchange = (e) => each((x) => { x.cls = e.target.value; if (x.cls === 'TrussPart') x.size = x.size.map((v) => Math.max(2, Math.round(v / 2) * 2)); if (x.cls !== 'Part') x.shape = 'Block'; }) || paneProps();
    if ($('pShape')) $('pShape').onchange = (e) => { each((x) => { x.shape = e.target.value; if (x.shape === 'Ball') { const d = Math.max(...x.size); x.size = [d, d, d]; } }); paneProps(); };
    pane.querySelectorAll('[data-vec]').forEach((box) => box.querySelectorAll('input').forEach((inp) => inp.onchange = () => { const v = parseFloat(inp.value); if (!isFinite(v)) return;
      each((x) => { x[box.dataset.vec][+inp.dataset.i] = box.dataset.vec === 'size' ? Math.max(0.05, v) : v; if (x.shape === 'Ball' && box.dataset.vec === 'size') x.size = [v, v, v]; }); placePivot(); }));
    $('pLabel').onchange = (e) => each((x) => { x.label = e.target.value.trim() || undefined; if (!x.label) delete x.label; });
    $('pRole').onchange = (e) => { each((x) => { if (e.target.value) x.role = MC.role(e.target.value); else delete x.role; }); paneProps(); selectionChanged(); };
    pane.querySelectorAll('[data-rp]').forEach((i) => i.onchange = () => each((x) => { const d = MC.ROLES[x.role.type].p[i.dataset.rp]; x.role[i.dataset.rp] = typeof d === 'number' ? +i.value || 0 : i.value.trim(); }));
  }
  $('pColor').oninput = (e) => each((x) => (x.color = e.target.value));
  pane.querySelectorAll('[data-sw]').forEach((b) => b.onclick = () => { each((x) => (x.color = b.dataset.sw)); paneProps(); });
  $('pT').oninput = (e) => { e.target.nextElementSibling.textContent = (+e.target.value).toFixed(2); each((x) => (x.transparency = +e.target.value)); };
  $('pR').oninput = (e) => { e.target.nextElementSibling.textContent = (+e.target.value).toFixed(2); each((x) => (x.reflectance = +e.target.value)); };
  $('pA').onclick = () => { each((x) => (x.anchored = !(x.anchored !== false)), false); paneProps(); };
  $('pC').onclick = () => { each((x) => (x.canCollide = !(x.canCollide !== false)), false); paneProps(); };
  $('pL').onclick = () => { each((x) => { if (x.light) delete x.light; else x.light = { range: 16, brightness: 2 }; }); paneProps(); };
  if ($('pLR')) $('pLR').onchange = (e) => each((x) => { if (x.light) x.light.range = +e.target.value; });
  pane.querySelectorAll('[data-mat]').forEach((b) => b.onclick = () => { each((x) => (x.material = b.dataset.mat)); paneProps(); });
}

/* ---------- tools ---------- */
function paneTools() {
  const n = sel.size;
  pane.innerHTML = `<div class="sec"><h3>Sélection <small>${n ? selParts().length + ' pièces' : 'rien'}</small></h3><div class="btns">
      <button class="btn" id="tDup">⧉ Dupliquer</button><button class="btn" id="tMirX">⇋ Miroir X</button><button class="btn" id="tMirZ">⇅ Miroir Z</button><button class="btn" id="tGround">⤓ Poser au sol</button>
      <button class="btn" id="tGroup">📦 Grouper</button><button class="btn" id="tUngroup">📤 Dégrouper</button><button class="btn" id="tGrid">🧲 Aligner grille</button><button class="btn danger" id="tDel">🗑 Supprimer</button><button class="btn" id="tAll">☑︎ Tout</button></div></div>
    <div class="sec"><h3>Réseau <small>copies en série</small></h3>
      <div class="row"><label>Copies</label><input type="range" id="aN" min="1" max="30" step="1" value="5"><span class="val" id="aNv">5</span></div>
      ${vecRow('Décalage', 'aOff', [0, 0, -8], 1)}<div class="row"><label>Rotation Y°</label><input type="number" id="aRot" value="0" step="15"></div>
      <div class="row"><label>Monter Y</label><input type="number" id="aRise" value="0" step="0.5"></div>
      <button class="btn pri big" id="aGo">⫶ Créer le réseau</button><div class="note" style="margin-top:6px">Exemple : un escalier = décalage Z −4 et monter Y 1 ; une spirale = rotation 20°.</div></div>`;
  const need = () => { if (!sel.size) { toast('Sélectionne d\'abord quelque chose'); return false; } return true; };
  const topNodes = () => [...sel].map((id) => MC.find(map.root, id)).filter(Boolean);
  const detach = (node) => { const par = MC.parentOf(map.root, node.id); par.children.splice(par.children.indexOf(node), 1); };
  $('tDup').onclick = () => { if (!need()) return; const copies = topNodes().map((x) => { const c = MC.cloneNode(x); MC.partsOf(c).forEach((p) => (p.pos[0] += 4)); return c; }); insert(copies, '⧉ Dupliqué (décalé de 4 en X)'); };
  const mirror = (axis) => { if (!need()) return; snapshot(); const ps = selParts(), c = ps.reduce((s, p) => s + p.pos[axis], 0) / ps.length;
    const copies = topNodes().map((x) => { const k = MC.cloneNode(x); MC.partsOf(k).forEach((p) => { p.pos[axis] = +(2 * c - p.pos[axis]).toFixed(3); if (axis === 0) { p.rot[1] = -p.rot[1]; p.rot[2] = -p.rot[2]; } else { p.rot[0] = -p.rot[0]; p.rot[1] = 180 - p.rot[1]; } p.name = p.name.replace(/L$/, '#').replace(/R$/, 'L').replace(/#$/, 'R'); }); return k; });
    undoStack.pop(); insert(copies, 'Copie miroir créée'); };
  $('tMirX').onclick = () => mirror(0); $('tMirZ').onclick = () => mirror(2);
  $('tGround').onclick = () => { if (!need()) return; snapshot(); const ps = selParts(), ids = new Set(ps.map((p) => p.id)), others = [...meshes.entries()].filter(([id]) => !ids.has(id)).map(([, m]) => m);
    let minDrop = Infinity; for (const p of ps) { const m = meshes.get(p.id), b = new THREE.Box3().setFromObject(m); rc.set(new THREE.Vector3(p.pos[0], b.min.y + 0.01, p.pos[2]), DOWN); rc.far = 500; const h = rc.intersectObjects(others, false)[0]; minDrop = Math.min(minDrop, h ? b.min.y - h.point.y : b.min.y); }
    if (!isFinite(minDrop)) return; ps.forEach((p) => (p.pos[1] = +(p.pos[1] - minDrop).toFixed(3))); save(); ps.forEach(rebuildPart); refreshOutlines(); placePivot(); toast('⤓ Posé'); };
  $('tGroup').onclick = () => { if (!need()) return; snapshot(); const nodes = topNodes(); nodes.forEach(detach); const g = MC.model('Group', nodes); map.root.children.push(g); sel = new Set([g.id]); save(); selectionChanged(); toast('📦 Groupé en Model'); };
  $('tUngroup').onclick = () => { if (!need()) return; const models = topNodes().filter((x) => x.cls === 'Model'); if (!models.length) return toast('Sélectionne un groupe'); snapshot();
    for (const m of models) { const par = MC.parentOf(map.root, m.id); par.children.splice(par.children.indexOf(m), 1, ...m.children); } sel = new Set(models.flatMap((m) => m.children.map((c) => c.id))); save(); selectionChanged(); toast('📤 Dégroupé'); };
  $('tGrid').onclick = () => { if (!need()) return; snapshot(); const s = ui.snap || 1; selParts().forEach((p) => { p.pos = p.pos.map((v) => Math.round(v / s) * s); p.rot = p.rot.map((v) => Math.round(v / 15) * 15); }); save(); selParts().forEach(rebuildPart); refreshOutlines(); placePivot(); };
  $('tDel').onclick = () => { if (!need()) return; snapshot(); topNodes().forEach(detach); sel.clear(); save(); rebuildAll(); selectionChanged(); toast('Supprimé (↶ pour annuler)'); };
  $('tAll').onclick = () => { sel = new Set(map.root.children.map((c) => c.id)); selectionChanged(); };
  $('aN').oninput = (e) => ($('aNv').textContent = e.target.value);
  $('aGo').onclick = () => { if (!need()) return; const N = +$('aN').value, off = [...pane.querySelectorAll('[data-vec="aOff"] input')].map((i) => +i.value || 0), rot = +$('aRot').value || 0, rise = +$('aRise').value || 0;
    const ps = selParts(), c = ps.reduce((s, p) => s.add(new THREE.Vector3(...p.pos)), new THREE.Vector3()).divideScalar(ps.length), out = [];
    for (let k = 1; k <= N; k++) for (const x of topNodes()) { const cp = MC.cloneNode(x), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot * k * D2R);
      MC.partsOf(cp).forEach((p) => { const v = new THREE.Vector3(...p.pos).sub(c).applyQuaternion(q).add(c).add(new THREE.Vector3(off[0] * k, off[1] * k + rise * k, off[2] * k));
        p.pos = v.toArray().map((u) => +u.toFixed(3)); const e = new THREE.Euler().setFromQuaternion(q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.rot.map((r) => r * D2R), 'XYZ'))), 'XYZ'); p.rot = [e.x, e.y, e.z].map((r) => +(r / D2R).toFixed(2)); });
      out.push(cp); }
    insert(out, `⫶ ${out.length} copies`); };
}

/* ---------- lighting ---------- */
function paneLight() {
  const L = MC.lightingOf(map), o = map.lighting.over || (map.lighting.over = {});
  pane.innerHTML = `<div class="sec"><h3>Ambiance <small>Lighting + Atmosphere + effets</small></h3><div class="cards">${Object.entries(MC.LIGHTS).map(([k, l]) => `<button class="card${k === map.lighting.preset ? ' on' : ''}" data-lp="${k}"><span class="e">${l.e}</span>${l.fr}</button>`).join('')}</div></div>
    <div class="sec"><h3>Réglages fins</h3>
      <div class="row"><label>Heure</label><input type="range" data-l="ClockTime" min="0" max="24" step="0.1" value="${L.ClockTime}"><span class="val">${L.ClockTime.toFixed(1)}h</span></div>
      <div class="row"><label>Luminosité</label><input type="range" data-l="Brightness" min="0" max="6" step="0.1" value="${L.Brightness}"><span class="val">${L.Brightness}</span></div>
      <div class="row"><label>Brouillard</label><input type="range" data-a="Density" min="0" max="0.9" step="0.01" value="${L.atmo.Density}"><span class="val">${L.atmo.Density}</span></div>
      <div class="row"><label>Brume</label><input type="range" data-a="Haze" min="0" max="5" step="0.1" value="${L.atmo.Haze}"><span class="val">${L.atmo.Haze}</span></div>
      <div class="row"><label>Éclat (bloom)</label><input type="range" data-b="Intensity" min="0" max="3" step="0.05" value="${L.bloom.Intensity}"><span class="val">${L.bloom.Intensity}</span></div>
      <div class="row"><label>Saturation</label><input type="range" data-c="Saturation" min="-1" max="1" step="0.05" value="${L.cc.Saturation}"><span class="val">${L.cc.Saturation}</span></div>
      <div class="row"><label>Ciel haut</label><input type="color" id="sk0" value="${L.sky[0]}"><label style="width:auto">bas</label><input type="color" id="sk1" value="${L.sky[1]}"></div>
      <div class="row"><label>Ambiante</label><input type="color" id="amb" value="${L.Ambient}"><label style="width:auto">extérieure</label><input type="color" id="oamb" value="${L.OutdoorAmbient}"></div>
      <div class="row"><label>Teinte</label><input type="color" id="tint" value="${L.cc.TintColor}"><button class="btn" id="lReset">↺ Preset</button></div>
      <div class="note">Exporté en vrai : <b>Lighting</b> (heure, luminosité, ambiance), <b>Atmosphere</b>, <b>Bloom</b>, <b>ColorCorrection</b>, <b>SunRays</b>.</div></div>`;
  let sn = false; const once = () => { if (!sn) { snapshot(); sn = true; } };
  const upd = () => { save(); applyLighting(); };
  pane.querySelectorAll('[data-lp]').forEach((b) => b.onclick = () => { snapshot(); map.lighting = { preset: b.dataset.lp, over: {} }; upd(); paneLight(); });
  const bind = (sel, set) => pane.querySelectorAll(sel).forEach((i) => i.oninput = () => { once(); set(i); i.nextElementSibling.textContent = i.dataset.l === 'ClockTime' ? (+i.value).toFixed(1) + 'h' : i.value; upd(); });
  bind('[data-l]', (i) => (o[i.dataset.l] = +i.value)); bind('[data-a]', (i) => ((o.atmo = o.atmo || {})[i.dataset.a] = +i.value)); bind('[data-b]', (i) => ((o.bloom = o.bloom || {})[i.dataset.b] = +i.value)); bind('[data-c]', (i) => ((o.cc = o.cc || {})[i.dataset.c] = +i.value));
  $('sk0').oninput = $('sk1').oninput = () => { once(); o.sky = [$('sk0').value, $('sk1').value]; upd(); };
  $('amb').oninput = (e) => { once(); o.Ambient = e.target.value; upd(); }; $('oamb').oninput = (e) => { once(); o.OutdoorAmbient = e.target.value; upd(); };
  $('tint').oninput = (e) => { once(); (o.cc = o.cc || {}).TintColor = e.target.value; upd(); };
  $('lReset').onclick = () => { snapshot(); map.lighting.over = {}; upd(); paneLight(); };
}

/* ---------- scripts ---------- */
let KIT = null;
async function loadKit() { if (!KIT) { const [server, client] = await Promise.all(['kit/ForgeMap.server.lua', 'kit/ForgeMap.client.lua'].map((u) => fetch(u, { cache: 'no-cache' }).then((r) => r.text()))); KIT = { server, client }; } return KIT; }
function highlight(src) {
  let out = '', i = 0; const re = /(--\[\[[\s\S]*?\]\]|--[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\[\[[\s\S]*?\]\])|(\b\d+(?:\.\d+)?\b)|\b(game|workspace|script|Instance|Vector3|CFrame|Color3|Enum|task|math|table|string|require|pcall|print|warn)\b|\b(local|function|end|if|then|else|elseif|for|in|do|while|repeat|until|return|and|or|not|nil|true|false|break|continue)\b/g;
  let m; while ((m = re.exec(src))) { out += esc(src.slice(i, m.index)); const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : m[4] ? 'g' : 'k'; out += `<span class="tk-${cls}">${esc(m[0])}</span>`; i = re.lastIndex; }
  return out + esc(src.slice(i)) + '\n';
}
let codeFile = 'server';
async function paneCode() {
  await loadKit(); if (ui.tab !== 'code') return; const sc = map.scripts || {};
  const files = [{ id: 'server', name: 'ForgeMap.server.lua', where: 'ServerScriptService', text: sc.server ?? KIT.server }, { id: 'client', name: 'ForgeMap.client.lua', where: 'StarterPlayerScripts', text: sc.client ?? KIT.client },
    { id: 'model', name: map.name + '.model.json', where: 'Workspace', text: JSON.stringify(MC.mapModel(map), null, 1).slice(0, 40000), readonly: true }];
  const f = files.find((x) => x.id === codeFile) || files[0];
  pane.innerHTML = `<div class="filetabs">${files.map((x) => `<button class="tab${x.id === f.id ? ' on' : ''}" data-f="${x.id}">${esc(x.name)}</button>`).join('')}</div>
    <div class="note" style="margin-bottom:8px">📍 ${esc(f.where)} ${f.readonly ? '· généré depuis ta carte (aperçu, lecture seule)' : '· modifiable : tes changements partent dans l\'export'}</div>
    <div class="code"><pre id="hl"></pre><textarea id="ta" spellcheck="false" autocapitalize="off" autocomplete="off" ${f.readonly ? 'readonly' : ''}></textarea></div>
    <div class="btns" style="margin-top:8px">${f.readonly ? '' : '<button class="btn" id="reset">↺ Version d\'origine</button>'}<button class="btn" id="copy">⧉ Copier</button></div>`;
  pane.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { codeFile = b.dataset.f; paneCode(); });
  const ta = $('ta'), hl = $('hl'); ta.value = f.text; hl.innerHTML = highlight(f.text);
  ta.oninput = () => { hl.innerHTML = highlight(ta.value); (map.scripts = map.scripts || {})[f.id] = ta.value; save(); };
  ta.onscroll = () => { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; };
  if ($('reset')) $('reset').onclick = () => { if (!confirm('Revenir au script d\'origine ?')) return; delete map.scripts[f.id]; save(); paneCode(); };
  $('copy').onclick = async () => { try { await navigator.clipboard.writeText(ta.value); toast('Copié ✓'); } catch { toast('Copie impossible'); } };
}

/* ---------- export ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.path), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name); off += 30 + name.length + data.length;
  }
  const csize = central.reduce((s, a) => s + a.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
async function buildPack() {
  await loadKit(); const sc = map.scripts || {}, L = MC.lightingModels(map), lib = await LIB.packFiles();
  const hasVox = (n) => n.vox || (n.children || []).some(hasVox), look = hasVox(map.root) ? await (await import('../studio/voxel-look.js')).voxelLookFiles('../studio/') : [];
  return zip([...lib, ...look,
    { path: `Workspace/${map.name}.model.json`, data: JSON.stringify(MC.mapModel(map)) },
    ...Object.entries(L).map(([n, v]) => ({ path: `Lighting/${n}.model.json`, data: JSON.stringify(v, null, 1) })),
    { path: 'ServerScriptService/ForgeMap.server.lua', data: sc.server ?? KIT.server },
    { path: 'StarterPlayerScripts/ForgeMap.client.lua', data: sc.client ?? KIT.client },
    { path: 'LISEZ-MOI.txt', data: `Pack Roblox Forge : carte ${map.name} (${T().label}, ${MC.stats(map).parts} pièces)\n\n- Workspace/${map.name} : la carte (pièces, groupes, pièces de gameplay)\n- Lighting : Atmosphere, Bloom, ColorCorrection, SunRays (l'heure et la luminosité sont appliquées par le script)\n- ServerScriptService/ForgeMap : pièges, checkpoints, tremplins, tapis, plateformes, tourniquets, téléporteurs, pièces, tycoon\n- StarterPlayerScripts/ForgeMap : pièces qui tournent, portes qui s'ouvrent selon tes stats\n\nTes propres pièces peuvent aussi utiliser l'attribut ForgeRole (voir le haut du script serveur).\nPublie ce .zip avec Roblox Push (bouton « Ajouter à mon jeu »).\n` },
  ]);
}
function paneExport() {
  const s = MC.stats(map);
  pane.innerHTML = `<div class="sec"><h3>Carte <small>${s.parts} pièces · ${s.models} groupes</small></h3>
      <div class="row"><label>Nom</label><input type="text" id="mName" value="${esc(map.name)}"></div>
      <div class="note">${Object.entries(s.roles).map(([k, v]) => `${MC.ROLES[k].e} ${MC.ROLES[k].fr} ×${v}`).join(' · ') || 'Aucune pièce de gameplay'}</div>
      <button class="btn pri big" id="toGame">🎮 Ajouter à mon jeu</button><button class="btn big" id="dl">📦 Télécharger le pack Roblox (.zip)</button></div>
    <div class="sec"><h3>Dans ton jeu</h3><div class="note"><b>🎮 Ajouter à mon jeu</b> ouvre Roblox Push : la carte va dans <b>Workspace</b> (une carte du même nom est remplacée), l'ambiance dans <b>Lighting</b>, et les scripts qui font marcher tout le gameplay. Rien d'autre n'est effacé.</div></div>
    <div class="sec"><h3>Projet</h3><div class="btns"><button class="btn danger" id="clear">🧹 Carte vide</button></div></div>`;
  $('mName').onchange = (e) => { snapshot(); map.name = map.root.name = e.target.value.replace(/[^\w]/g, '') || 'ForgeMap'; save(); updateInfo(); };
  $('toGame').onclick = async () => { const blob = await buildPack(); const buf = new Uint8Array(await blob.arrayBuffer()); let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    try { localStorage.setItem('rp2.pendingPack', JSON.stringify({ name: map.name, label: 'Carte ' + map.name, rarity: 'Map', b64: btoa(bin), at: Date.now() })); }
    catch { return toast('Carte trop grosse pour le navigateur : télécharge plutôt le pack.'); }
    toast('Ouverture de Roblox Push…'); setTimeout(() => (location.href = '../../roblox-push/'), 450); };
  $('dl').onclick = async () => { const blob = await buildPack(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = map.name + '.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Pack téléchargé ✓'); };
  $('clear').onclick = () => { if (!confirm('Vider la carte ?')) return; snapshot(); map.root.children = [MC.block('Baseplate', [256, 2, 256], [0, -1, 0], T().ground), MC.P('SpawnLocation', 'Spawn', [6, 1, 6], [0, 0.5, 0], [0, 0, 0], T().glow)]; sel.clear(); save(); rebuildAll(); selectionChanged(); };
}

/* ---------- add menu (viewport) ---------- */
{ const menu = $('addMenu'); menu.innerHTML = PALETTE.map(([c, s, l], i) => `<button data-q="${i}">${l}</button>`).join('') + '<button data-qr="kill">☠️ Piège</button><button data-qr="jumppad">🦘 Tremplin</button><button data-qr="coin">🪙 Pièce</button>';
  $('addBtn').onclick = () => menu.classList.toggle('hidden');
  menu.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { menu.classList.add('hidden'); const prev = ui.tab; ui.tab = 'obj'; paneObj(); pane.querySelector(`[data-pal="${b.dataset.q}"]`).click(); ui.tab = prev; renderPane(); });
  menu.querySelectorAll('[data-qr]').forEach((b) => b.onclick = () => { menu.classList.add('hidden'); insert([rolePiece(b.dataset.qr, dropPoint())], MC.ROLES[b.dataset.qr].e + ' ajouté'); }); }

/* ---------- boot ---------- */
resize(); applyLighting(); rebuildAll(); syncUndo(); renderPane(); focusOn(MC.partsOf(map.root)); loop(); LIB.prompt();
window.__map = { LIB, MM, get map() { return map; }, MC, scene, bloom, renderer, sky, skyMat, play, startPlay, stopPlay, select, setTab, buildPack, meshes, get sel() { return sel; }, gizmo, pivot, controls, camera, rebuildAll };
