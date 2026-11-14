// Roblox Forge - Pet Studio. Everything you see maps 1:1 to real Roblox objects on export.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function toast(m, ms = 2200) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), ms); }
const Store = {
  get(k, d) { try { const v = localStorage.getItem('forge.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('forge.' + k, JSON.stringify(v)); } catch {} },
};

/* =====================================================================
   1. DATA: shapes, materials, body presets, effects, rarities
   ===================================================================== */
const SHAPES = { Ellipsoid: 'Ovale', Ball: 'Boule', Block: 'Bloc', Cylinder: 'Cylindre', Wedge: 'Coin' };
const MATERIALS = ['SmoothPlastic', 'Plastic', 'Neon', 'Glass', 'Metal', 'ForceField', 'Foil', 'Ice'];
let uid = 1; const nid = () => 'p' + (uid++) + Math.random().toString(36).slice(2, 5);
// part(name, shape, size[x,y,z] studs, pos, rotDeg, color token or hex, material, transparency)
const P = (name, shape, size, pos, rot = [0, 0, 0], color = 'c1', material = 'SmoothPlastic', transparency = 0) => ({ name, shape, size, pos, rot, color, material, transparency });
const eyes = (y, z, gap = 0.34, w = 0.26, h = 0.36) => [
  P('EyeL', 'Ellipsoid', [w, h, 0.14], [-gap, y, z], [0, 0, 0], '#14102a', 'SmoothPlastic'),
  P('EyeR', 'Ellipsoid', [w, h, 0.14], [gap, y, z], [0, 0, 0], '#14102a', 'SmoothPlastic'),
  P('ShineL', 'Ball', [0.1, 0.1, 0.1], [-gap + 0.05, y + 0.09, z - 0.06], [0, 0, 0], '#ffffff', 'Neon'),
  P('ShineR', 'Ball', [0.1, 0.1, 0.1], [gap + 0.05, y + 0.09, z - 0.06], [0, 0, 0], '#ffffff', 'Neon'),
];
const BODIES = {
  cat: { label: 'Chat', e: '🐱', parts: () => [
    P('Body', 'Ellipsoid', [1.7, 1.35, 2.0], [0, 0.85, 0.25]), P('Belly', 'Ellipsoid', [1.15, 0.9, 1.3], [0, 0.72, -0.05], [0, 0, 0], 'c2'),
    P('Head', 'Ellipsoid', [1.55, 1.4, 1.4], [0, 1.85, -0.75]),
    P('EarL', 'Wedge', [0.42, 0.55, 0.42], [-0.42, 2.62, -0.72], [0, 90, 0]), P('EarR', 'Wedge', [0.42, 0.55, 0.42], [0.42, 2.62, -0.72], [0, 90, 0]),
    ...eyes(1.95, -1.42), P('Nose', 'Ellipsoid', [0.16, 0.12, 0.1], [0, 1.74, -1.47], [0, 0, 0], '#ff7aa8'),
    P('Tail', 'Ellipsoid', [0.32, 0.32, 1.5], [0, 1.25, 1.3], [-50, 0, 0]),
    P('PawFL', 'Ellipsoid', [0.45, 0.3, 0.55], [-0.45, 0.15, -0.4], [0, 0, 0], 'c2'), P('PawFR', 'Ellipsoid', [0.45, 0.3, 0.55], [0.45, 0.15, -0.4], [0, 0, 0], 'c2'),
    P('PawBL', 'Ellipsoid', [0.45, 0.3, 0.55], [-0.45, 0.15, 0.8], [0, 0, 0], 'c2'), P('PawBR', 'Ellipsoid', [0.45, 0.3, 0.55], [0.45, 0.15, 0.8], [0, 0, 0], 'c2')] },
  dog: { label: 'Chien', e: '🐶', parts: () => [
    P('Body', 'Ellipsoid', [1.7, 1.4, 2.1], [0, 0.85, 0.25]), P('Belly', 'Ellipsoid', [1.1, 0.9, 1.3], [0, 0.72, -0.05], [0, 0, 0], 'c2'),
    P('Head', 'Ellipsoid', [1.5, 1.35, 1.35], [0, 1.85, -0.7]), P('Snout', 'Ellipsoid', [0.8, 0.55, 0.65], [0, 1.65, -1.32], [0, 0, 0], 'c2'),
    P('Nose', 'Ball', [0.22, 0.22, 0.22], [0, 1.78, -1.66], [0, 0, 0], '#1a1222', 'Glass'),
    P('EarL', 'Ellipsoid', [0.36, 0.85, 0.2], [-0.78, 1.85, -0.65], [0, 0, 22], 'c2'), P('EarR', 'Ellipsoid', [0.36, 0.85, 0.2], [0.78, 1.85, -0.65], [0, 0, -22], 'c2'),
    ...eyes(2.02, -1.34, 0.33), P('Tail', 'Ellipsoid', [0.3, 0.3, 1.1], [0, 1.3, 1.3], [-60, 0, 0]),
    P('PawFL', 'Ellipsoid', [0.45, 0.3, 0.55], [-0.45, 0.15, -0.4], [0, 0, 0], 'c2'), P('PawFR', 'Ellipsoid', [0.45, 0.3, 0.55], [0.45, 0.15, -0.4], [0, 0, 0], 'c2'),
    P('PawBL', 'Ellipsoid', [0.45, 0.3, 0.55], [-0.45, 0.15, 0.85], [0, 0, 0], 'c2'), P('PawBR', 'Ellipsoid', [0.45, 0.3, 0.55], [0.45, 0.15, 0.85], [0, 0, 0], 'c2')] },
  bunny: { label: 'Lapin', e: '🐰', parts: () => [
    P('Body', 'Ellipsoid', [1.6, 1.5, 1.7], [0, 0.9, 0.2]), P('Belly', 'Ellipsoid', [1.0, 1.0, 1.1], [0, 0.8, -0.15], [0, 0, 0], 'c2'),
    P('Head', 'Ellipsoid', [1.4, 1.3, 1.3], [0, 2.0, -0.45]),
    P('EarL', 'Ellipsoid', [0.34, 1.25, 0.22], [-0.32, 3.15, -0.45], [0, 0, 10]), P('EarR', 'Ellipsoid', [0.34, 1.25, 0.22], [0.32, 3.15, -0.45], [0, 0, -10]),
    P('EarInL', 'Ellipsoid', [0.18, 0.95, 0.06], [-0.31, 3.12, -0.57], [0, 0, 10], 'c2'), P('EarInR', 'Ellipsoid', [0.18, 0.95, 0.06], [0.31, 3.12, -0.57], [0, 0, -10], 'c2'),
    ...eyes(2.08, -1.06, 0.3, 0.24, 0.32), P('Nose', 'Ellipsoid', [0.14, 0.1, 0.08], [0, 1.88, -1.1], [0, 0, 0], '#ff7aa8'),
    P('Tail', 'Ball', [0.55, 0.55, 0.55], [0, 0.85, 1.1], [0, 0, 0], 'c2'),
    P('FootL', 'Ellipsoid', [0.45, 0.28, 0.8], [-0.45, 0.14, -0.25], [0, 0, 0], 'c2'), P('FootR', 'Ellipsoid', [0.45, 0.28, 0.8], [0.45, 0.14, -0.25], [0, 0, 0], 'c2')] },
  dragon: { label: 'Dragon', e: '🐉', parts: () => [
    P('Body', 'Ellipsoid', [1.6, 1.45, 2.2], [0, 1.0, 0.2]), P('Belly', 'Ellipsoid', [1.0, 1.0, 1.6], [0, 0.85, -0.1], [0, 0, 0], 'c2'),
    P('Head', 'Ellipsoid', [1.25, 1.05, 1.4], [0, 2.05, -1.05]), P('Snout', 'Ellipsoid', [0.85, 0.55, 0.85], [0, 1.85, -1.7]),
    P('HornL', 'Wedge', [0.18, 0.65, 0.4], [-0.35, 2.75, -0.8], [-25, 90, 0], '#f5e6c8'), P('HornR', 'Wedge', [0.18, 0.65, 0.4], [0.35, 2.75, -0.8], [-25, 90, 0], '#f5e6c8'),
    ...eyes(2.25, -1.62, 0.33, 0.22, 0.3),
    P('WingL', 'Wedge', [0.08, 1.3, 1.7], [-1.15, 1.9, 0.3], [0, 0, 38], 'c2'), P('WingR', 'Wedge', [0.08, 1.3, 1.7], [1.15, 1.9, 0.3], [0, 0, -38], 'c2'),
    P('Tail1', 'Ellipsoid', [0.62, 0.62, 1.0], [0, 0.95, 1.45], [-18, 0, 0]), P('Tail2', 'Ellipsoid', [0.42, 0.42, 0.9], [0, 0.75, 2.15], [-10, 0, 0]),
    P('TailTip', 'Wedge', [0.1, 0.5, 0.5], [0, 0.85, 2.65], [0, 90, 0], 'c2'),
    P('Spike1', 'Wedge', [0.1, 0.35, 0.35], [0, 1.78, -0.2], [0, 90, 0], 'c2'), P('Spike2', 'Wedge', [0.1, 0.35, 0.35], [0, 1.8, 0.35], [0, 90, 0], 'c2'),
    P('PawFL', 'Ellipsoid', [0.42, 0.3, 0.55], [-0.5, 0.15, -0.45]), P('PawFR', 'Ellipsoid', [0.42, 0.3, 0.55], [0.5, 0.15, -0.45]),
    P('PawBL', 'Ellipsoid', [0.42, 0.3, 0.55], [-0.5, 0.15, 0.85]), P('PawBR', 'Ellipsoid', [0.42, 0.3, 0.55], [0.5, 0.15, 0.85])] },
  slime: { label: 'Slime', e: '🟢', parts: () => [
    P('Body', 'Ellipsoid', [2.3, 1.7, 2.3], [0, 0.85, 0], [0, 0, 0], 'c1', 'Glass', 0.3), P('Core', 'Ball', [0.9, 0.9, 0.9], [0, 0.9, 0.1], [0, 0, 0], 'c2', 'Neon'),
    ...eyes(1.2, -1.05, 0.38, 0.28, 0.4), P('Mouth', 'Ellipsoid', [0.34, 0.14, 0.08], [0, 0.88, -1.12], [0, 0, 0], '#14102a')] },
  spirit: { label: 'Esprit', e: '👻', parts: () => [
    P('Body', 'Ball', [1.15, 1.15, 1.15], [0, 1.7, 0], [0, 0, 0], 'c1', 'Neon'), P('Shell', 'Ball', [1.9, 1.9, 1.9], [0, 1.7, 0], [0, 0, 0], 'c2', 'Glass', 0.55),
    P('Wisp', 'Ellipsoid', [0.55, 0.9, 0.55], [0, 0.65, 0.2], [20, 0, 0], 'c1', 'Neon', 0.35),
    ...eyes(1.82, -0.92, 0.3, 0.22, 0.32)] },
  robot: { label: 'Robot', e: '🤖', parts: () => [
    P('Body', 'Block', [1.6, 1.3, 1.4], [0, 0.95, 0], [0, 0, 0], 'c1', 'Metal'), P('Head', 'Block', [1.3, 1.0, 1.1], [0, 2.1, -0.1], [0, 0, 0], 'c1', 'Metal'),
    P('Visor', 'Block', [1.05, 0.38, 0.06], [0, 2.12, -0.68], [0, 0, 0], '#0b1020', 'Glass'),
    P('EyeL', 'Block', [0.24, 0.12, 0.05], [-0.25, 2.12, -0.72], [0, 0, 0], 'c2', 'Neon'), P('EyeR', 'Block', [0.24, 0.12, 0.05], [0.25, 2.12, -0.72], [0, 0, 0], 'c2', 'Neon'),
    P('Antenna', 'Cylinder', [0.6, 0.08, 0.08], [0, 2.9, -0.1], [0, 0, 90], '#c9cfe0', 'Metal'), P('Tip', 'Ball', [0.26, 0.26, 0.26], [0, 3.25, -0.1], [0, 0, 0], 'c2', 'Neon'),
    P('Chest', 'Block', [0.6, 0.35, 0.05], [0, 1.05, -0.73], [0, 0, 0], 'c2', 'Neon'),
    P('ArmL', 'Cylinder', [0.9, 0.3, 0.3], [-1.0, 1.0, 0], [0, 0, 90], '#c9cfe0', 'Metal'), P('ArmR', 'Cylinder', [0.9, 0.3, 0.3], [1.0, 1.0, 0], [0, 0, 90], '#c9cfe0', 'Metal'),
    P('WheelL', 'Cylinder', [0.3, 0.6, 0.6], [-0.55, 0.3, 0], [0, 0, 0], '#1b1f2e', 'Plastic'), P('WheelR', 'Cylinder', [0.3, 0.6, 0.6], [0.55, 0.3, 0], [0, 0, 0], '#1b1f2e', 'Plastic')] },
};
const TEX = { sparkle: 'rbxasset://textures/particles/sparkles_main.dds', fire: 'rbxasset://textures/particles/fire_main.dds', smoke: 'rbxasset://textures/particles/smoke_main.dds' };
// Effect definitions: params drive both the preview and the Roblox export.
const FX = [
  { id: 'aura', ico: '🌌', label: 'Aura', hint: 'nuage de particules autour du pet', p: { c1: '#a78bff', c2: '#3ee6ff', rate: 34, size: 0.55, speed: 0.9, life: 1.4, tex: 'sparkle' } },
  { id: 'sparkles', ico: '✨', label: 'Étincelles', hint: 'petites étoiles scintillantes', p: { c1: '#fff3b0', rate: 16, size: 0.28 } },
  { id: 'flames', ico: '🔥', label: 'Flammes', hint: 'feu qui monte du pet', p: { c1: '#ffb347', c2: '#ff3d6e', rate: 28, size: 0.75 } },
  { id: 'rings', ico: '💍', label: 'Anneau', hint: 'perles lumineuses en orbite', p: { c1: '#ffd45c', count: 12, radius: 2.4, speed: 1.6, dot: 0.22, tilt: true } },
  { id: 'orbs', ico: '🔮', label: 'Orbes', hint: 'sphères qui tournent et éclairent', p: { c1: '#3ee6ff', count: 3, radius: 3.0, speed: 1.0, size: 0.5 } },
  { id: 'trail', ico: '🌠', label: 'Traînée', hint: 'sillage quand le pet bouge', p: { c1: '#ffffff', c2: '#7c5cff', length: 0.7 } },
  { id: 'glow', ico: '💡', label: 'Lueur', hint: 'lumière autour du pet', p: { c1: '#b9a8ff', brightness: 3, range: 10 } },
  { id: 'outline', ico: '🔲', label: 'Contour', hint: 'contour lumineux (Highlight)', p: { c1: '#ffd45c' } },
  { id: 'lightning', ico: '⚡', label: 'Éclairs', hint: 'arcs électriques', p: { c1: '#9be8ff', rate: 2 } },
  { id: 'rainbow', ico: '🌈', label: 'Arc-en-ciel', hint: 'couleurs qui défilent', p: { speed: 0.2 } },
  { id: 'pulse', ico: '💓', label: 'Pulsation', hint: 'lumière qui bat', p: { amount: 0.5, speed: 3 } },
  { id: 'float', ico: '🎈', label: 'Lévitation', hint: 'flotte de haut en bas', p: { height: 0.5, speed: 2 } },
  { id: 'spin', ico: '🌀', label: 'Rotation', hint: 'tourne sur lui-même', p: { speed: 60 } },
];
const RANGES = { rate: [1, 150, 1], size: [0.05, 2.5, 0.05], speed: [0, 8, 0.1], life: [0.2, 4, 0.1], count: [1, 24, 1], radius: [0.8, 6, 0.1], dot: [0.08, 0.8, 0.02],
  length: [0.1, 2, 0.05], brightness: [0.2, 10, 0.1], range: [2, 30, 0.5], amount: [0.05, 1.5, 0.05], height: [0.05, 2, 0.05] };
const LABELS = { c1: 'Couleur', c2: 'Couleur 2', rate: 'Densité', size: 'Taille', speed: 'Vitesse', life: 'Durée', tex: 'Texture', count: 'Nombre', radius: 'Rayon', dot: 'Perles',
  tilt: 'Incliné', length: 'Longueur', brightness: 'Intensité', range: 'Portée', amount: 'Force', height: 'Hauteur' };
const RARITIES = [
  { id: 'Commun', bg: 'linear-gradient(135deg,#d7dce6,#9aa3b5)', c1: '#c9ced8', c2: '#f4f6fa', fx: { float: {} } },
  { id: 'Rare', bg: 'linear-gradient(135deg,#7cc7ff,#2f7bff)', c1: '#6fb6ff', c2: '#e3f2ff', fx: { float: {}, sparkles: { c1: '#cfe8ff' }, glow: { c1: '#6fb6ff', brightness: 2 } } },
  { id: 'Épique', bg: 'linear-gradient(135deg,#c08bff,#7c3aff)', c1: '#a26bff', c2: '#f0e4ff', fx: { float: {}, sparkles: { c1: '#f0d9ff' }, aura: { c1: '#b98bff', c2: '#6b2fff' }, glow: { c1: '#a26bff' } } },
  { id: 'Légendaire', bg: 'linear-gradient(135deg,#ffe27a,#ff9f1c)', c1: '#ffcc33', c2: '#fff4cc', fx: { float: {}, sparkles: { c1: '#fff1a8' }, aura: { c1: '#ffd45c', c2: '#ff8a00' }, rings: { c1: '#ffd45c', count: 10 }, glow: { c1: '#ffcc33', brightness: 4 }, outline: { c1: '#ffd45c' }, trail: { c1: '#fff1a8', c2: '#ff9f1c' } } },
  { id: 'Mythique', bg: 'linear-gradient(135deg,#ff7ab6,#ff2d55)', c1: '#ff4f8b', c2: '#ffe0ec', fx: { float: {}, flames: { c1: '#ffb347', c2: '#ff2d55' }, aura: { c1: '#ff7ab6', c2: '#ff2d55' }, rings: { c1: '#ff9ccc', count: 14, tilt: true }, orbs: { c1: '#ff4f8b', count: 3 }, glow: { c1: '#ff4f8b', brightness: 5 }, outline: { c1: '#ff7ab6' }, pulse: {}, trail: { c1: '#ffd0e4', c2: '#ff2d55' } } },
  { id: 'Divin', bg: 'linear-gradient(135deg,#ffffff,#7df9ff)', c1: '#e8fbff', c2: '#7df9ff', fx: { float: {}, spin: {}, sparkles: { c1: '#ffffff', rate: 30 }, aura: { c1: '#ffffff', c2: '#7df9ff', rate: 50 }, rings: { c1: '#ffffff', count: 16 }, orbs: { c1: '#7df9ff', count: 4 }, lightning: { c1: '#bff8ff', rate: 3 }, glow: { c1: '#bff8ff', brightness: 6 }, outline: { c1: '#7df9ff' }, pulse: {}, trail: { c1: '#ffffff', c2: '#7df9ff' } } },
  { id: 'Secret 1/1B', bg: 'linear-gradient(135deg,#ff3d6e,#ffd45c,#3dffa8,#3ee6ff,#7c5cff)', c1: '#7c5cff', c2: '#ffd45c', fx: { float: { height: 0.7 }, spin: { speed: 90 }, rainbow: { speed: 0.35 }, sparkles: { rate: 40, size: 0.32 }, aura: { rate: 80, size: 0.7, speed: 1.6 }, flames: { rate: 36 }, rings: { count: 18, tilt: true, speed: 2.2 }, orbs: { count: 6, radius: 3.4 }, lightning: { rate: 5 }, glow: { brightness: 8, range: 16 }, outline: { c1: '#ffffff' }, pulse: { amount: 0.8, speed: 5 }, trail: { length: 1.2 } } },
];

function defaultFx() { const o = {}; for (const f of FX) o[f.id] = { on: false, ...clone(f.p) }; return o; }
function makeParts(bodyId, c1, c2) {
  return BODIES[bodyId].parts().map((p) => ({ id: nid(), ...p, color: p.color === 'c1' ? c1 : p.color === 'c2' ? c2 : p.color, tint: p.color === 'c1' }));
}
function newPet(bodyId = 'cat', rarity = 'Légendaire') {
  const r = RARITIES.find((x) => x.id === rarity);
  const pet = { v: 1, name: BODIES[bodyId].label + ' ' + rarity.split(' ')[0], body: bodyId, rarity, c1: r.c1, c2: r.c2, parts: makeParts(bodyId, r.c1, r.c2), fx: defaultFx(), scripts: {} };
  applyRarityFx(pet, r);
  return pet;
}
function autoName() { if (!pet.customName) pet.name = BODIES[pet.body].label + ' ' + pet.rarity; }
function applyRarityFx(pet, r) {
  pet.fx = defaultFx();
  for (const [k, v] of Object.entries(r.fx)) Object.assign(pet.fx[k], v, { on: true });
}

/* =====================================================================
   2. STATE + undo/redo
   ===================================================================== */
let pet = Store.get('pet', null) || newPet();
let undoStack = [], redoStack = [], selId = null;
function commit(label) {
  undoStack.push(JSON.stringify(pet)); if (undoStack.length > 80) undoStack.shift(); redoStack = [];
  Store.set('pet', pet); syncUndo();
}
function snapshot() { undoStack.push(JSON.stringify(pet)); if (undoStack.length > 80) undoStack.shift(); redoStack = []; syncUndo(); }
function save() { Store.set('pet', pet); }
function syncUndo() { $('undo').disabled = !undoStack.length; $('redo').disabled = !redoStack.length; }
$('undo').onclick = () => { if (!undoStack.length) return; redoStack.push(JSON.stringify(pet)); pet = JSON.parse(undoStack.pop()); save(); rebuild(); renderPane(); syncUndo(); };
$('redo').onclick = () => { if (!redoStack.length) return; undoStack.push(JSON.stringify(pet)); pet = JSON.parse(redoStack.pop()); save(); rebuild(); renderPane(); syncUndo(); };

/* =====================================================================
   3. THREE.JS SCENE
   ===================================================================== */
const view = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
view.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07051a); scene.fog = new THREE.Fog(0x07051a, 18, 42);
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200); camera.position.set(-4.2, 3.4, -6.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.4, 0); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 2.5; controls.maxDistance = 22;
controls.autoRotate = true; controls.autoRotateSpeed = 0.9;
scene.add(new THREE.HemisphereLight(0x8f7dff, 0x120b2a, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-4, 8, -5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); scene.add(key);
const rim = new THREE.DirectionalLight(0x3ee6ff, 1.6); rim.position.set(5, 3, 6); scene.add(rim);
// floor: glowing pedestal + grid rings
const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ color: 0x0d0a24, roughness: 0.85, metalness: 0.1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.18, 64), new THREE.MeshStandardMaterial({ color: 0x1a1440, roughness: 0.35, metalness: 0.6 }));
pedestal.position.y = 0.09; pedestal.receiveShadow = true; scene.add(pedestal);
const ringGlow = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.03, 8, 96), new THREE.MeshBasicMaterial({ color: 0x7c5cff })); ringGlow.rotation.x = Math.PI / 2; ringGlow.position.y = 0.19; scene.add(ringGlow);
for (let i = 1; i <= 5; i++) { const g = new THREE.Mesh(new THREE.RingGeometry(3 + i * 1.6, 3.02 + i * 1.6, 96), new THREE.MeshBasicMaterial({ color: 0x2a2160, transparent: true, opacity: 0.5 - i * 0.07 })); g.rotation.x = -Math.PI / 2; g.position.y = 0.005; scene.add(g); }
// starfield
{ const n = 900, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const r = 60 + Math.random() * 40, a = Math.random() * Math.PI * 2, y = Math.random() * 50 + 2; pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, fog: false }))); }
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 0.86); composer.addPass(bloom); composer.addPass(new OutputPass());

// unit geometries -> scaled to Roblox sizes
const GEO = {
  Ellipsoid: new THREE.SphereGeometry(0.5, 40, 28), Ball: new THREE.SphereGeometry(0.5, 40, 28), Block: new THREE.BoxGeometry(1, 1, 1),
  Cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 40).rotateZ(Math.PI / 2), // Roblox cylinders run along X
  Wedge: (() => { // Roblox WedgePart: slope rises from the front (-Z) bottom to the back (+Z) top
    const s = new THREE.Shape(); s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, 0.5); s.lineTo(-0.5, -0.5);
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); g.rotateY(-Math.PI / 2); g.computeVertexNormals(); return g; })(),
};
function matFor(p) {
  const color = new THREE.Color(p.color); const t = p.transparency || 0;
  const base = { color, transparent: t > 0, opacity: 1 - t };
  switch (p.material) {
    case 'Neon': return new THREE.MeshStandardMaterial({ ...base, emissive: color, emissiveIntensity: 2.2, roughness: 0.4 });
    case 'Glass': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.05, metalness: 0, clearcoat: 1, transparent: true, opacity: Math.min(0.85, 1 - t * 0.9) });
    case 'Metal': return new THREE.MeshStandardMaterial({ ...base, roughness: 0.28, metalness: 0.92 });
    case 'Foil': return new THREE.MeshStandardMaterial({ ...base, roughness: 0.15, metalness: 1 });
    case 'Ice': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.12, clearcoat: 1, transparent: true, opacity: Math.min(0.9, 1 - t) });
    case 'ForceField': return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 * (1 - t), wireframe: true });
    case 'Plastic': return new THREE.MeshStandardMaterial({ ...base, roughness: 0.6 });
    default: return new THREE.MeshStandardMaterial({ ...base, roughness: 0.42, metalness: 0.05 });
  }
}
const petGroup = new THREE.Group(); scene.add(petGroup);   // moves (float/spin/walk)
const partGroup = new THREE.Group(); petGroup.add(partGroup);
const outlineGroup = new THREE.Group(); petGroup.add(outlineGroup);
const meshes = new Map();
const glowLight = new THREE.PointLight(0xffffff, 0, 10, 2); petGroup.add(glowLight);
function rebuild() {
  for (const m of meshes.values()) { m.material.dispose(); partGroup.remove(m); }
  meshes.clear(); outlineGroup.clear();
  for (const p of pet.parts) {
    const m = new THREE.Mesh(GEO[p.shape] || GEO.Block, matFor(p));
    m.position.fromArray(p.pos); m.rotation.set(...p.rot.map(THREE.MathUtils.degToRad), 'XYZ'); m.scale.fromArray(p.size);
    m.castShadow = p.material !== 'Neon' && p.material !== 'ForceField'; m.userData.id = p.id;
    partGroup.add(m); meshes.set(p.id, m);
  }
  if (pet.fx.outline.on) {
    const om = new THREE.MeshBasicMaterial({ color: pet.fx.outline.c1, side: THREE.BackSide });
    for (const p of pet.parts) { if (p.size[0] < 0.15 && p.size[1] < 0.15) continue;
      const m = new THREE.Mesh(GEO[p.shape] || GEO.Block, om); m.position.fromArray(p.pos); m.rotation.set(...p.rot.map(THREE.MathUtils.degToRad), 'XYZ');
      m.scale.fromArray(p.size.map((s) => s + 0.09)); outlineGroup.add(m); }
  }
  rebuildFx(); attachGizmo(); updateHud();
}

/* ---------- selection + gizmo ---------- */
const gizmo = new TransformControls(camera, renderer.domElement);
gizmo.setSize(1.15); scene.add(gizmo.getHelper());
gizmo.addEventListener('dragging-changed', (e) => { controls.enabled = !e.value; if (e.value) snapshot(); else { save(); renderPane(); } });
gizmo.addEventListener('objectChange', () => {
  const m = gizmo.object; const p = pet.parts.find((x) => x.id === m.userData.id); if (!p) return;
  p.pos = m.position.toArray().map((v) => +v.toFixed(3));
  p.rot = [m.rotation.x, m.rotation.y, m.rotation.z].map((v) => +THREE.MathUtils.radToDeg(v).toFixed(1));
  p.size = m.scale.toArray().map((v) => +Math.max(0.05, Math.abs(v)).toFixed(3));
  if (p.shape === 'Ball') { const s = Math.max(...p.size); p.size = [s, s, s]; m.scale.set(s, s, s); }
  updateHud();
});
function attachGizmo() { const m = selId && meshes.get(selId); if (m) gizmo.attach(m); else gizmo.detach(); }
function select(id) { selId = id; attachGizmo(); updateHud(); controls.autoRotate = !id && !walking; if (currentTab === 'parts') renderPane(); }
const ray = new THREE.Raycaster(); let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || gizmo.dragging) return; const [x, y, t] = downAt; downAt = null;
  if (Math.hypot(e.clientX - x, e.clientY - y) > 6 || performance.now() - t > 450) return; // it was an orbit drag
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObjects([...meshes.values()], false)[0];
  select(hit ? hit.object.userData.id : null); if (hit && currentTab !== 'parts') setTab('parts');
});
document.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { gizmo.setMode(b.dataset.mode); document.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b)); });
$('addBtn').onclick = () => $('addMenu').classList.toggle('hidden');
document.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => {
  $('addMenu').classList.add('hidden'); snapshot();
  if (b.dataset.add === 'dup') { const src = pet.parts.find((p) => p.id === selId); if (!src) return toast('Sélectionne d\'abord une pièce');
    const c = { ...clone(src), id: nid(), name: src.name + 'Copie', pos: [src.pos[0] + 0.4, src.pos[1], src.pos[2]] }; pet.parts.push(c); save(); rebuild(); select(c.id); return; }
  const shape = b.dataset.add, s = shape === 'Block' ? [0.8, 0.8, 0.8] : shape === 'Cylinder' ? [1, 0.4, 0.4] : shape === 'Wedge' ? [0.4, 0.6, 0.6] : [0.7, 0.7, 0.7];
  const p = { id: nid(), name: SHAPES[shape] + (pet.parts.length + 1), shape, size: s, pos: [0, 2.6, -0.4], rot: [0, 0, 0], color: pet.c2, material: 'SmoothPlastic', transparency: 0, tint: false };
  pet.parts.push(p); save(); rebuild(); select(p.id); toast(SHAPES[shape] + ' ajouté : déplace-le avec les flèches');
});
function updateHud() {
  $('petName').textContent = pet.name;
  const r = RARITIES.find((x) => x.id === pet.rarity) || RARITIES[0]; $('rarBadge').textContent = pet.rarity; $('rarBadge').style.background = r.bg;
  const p = pet.parts.find((x) => x.id === selId); $('selBadge').classList.toggle('hidden', !p);
  if (p) $('selBadge').textContent = `${p.name} · ${SHAPES[p.shape]} · ${p.size.map((v) => v.toFixed(2)).join('×')}`;
}

/* =====================================================================
   4. EFFECT PREVIEW (mirrors what the exported Roblox objects do)
   ===================================================================== */
const SPRITE_FS = `uniform int shapeKind; varying vec3 vColor; varying float vAlpha;
void main(){ vec2 p = gl_PointCoord*2.0-1.0; float d = length(p); float a;
  if(shapeKind==0){ float star = max(0.0, 1.0 - abs(p.x*p.y)*14.0) * (1.0 - d); a = max(star, pow(max(0.0,1.0-d),3.0)); }
  else if(shapeKind==1){ a = pow(max(0.0, 1.0 - d), 1.6) * (0.7 + 0.3*smoothstep(1.0,0.0,abs(p.x))); }
  else { a = pow(max(0.0, 1.0 - d), 2.2) * 0.55; }
  if(a < 0.01) discard; gl_FragColor = vec4(vColor * (0.55 + 0.6*a), a * vAlpha * 0.85); }`;
const SPRITE_VS = `attribute float size; attribute float alpha; attribute vec3 pcolor; varying vec3 vColor; varying float vAlpha;
void main(){ vColor = pcolor; vAlpha = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * (360.0 / -mv.z); gl_Position = projectionMatrix * mv; }`;
class Emitter {
  constructor(max, kind) {
    this.max = max; this.kind = kind; this.n = 0; this.acc = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.age = new Float32Array(max); this.life = new Float32Array(max); this.s0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ uniforms: { shapeKind: { value: kind } }, vertexShader: SPRITE_VS, fragmentShader: SPRITE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.obj = new THREE.Points(g, this.mat); this.obj.frustumCulled = false; this.g = g;
  }
  update(dt, cfg, center, radius, rainbowHue) {
    const { rate, size, speed, life, up, c1, c2 } = cfg;
    this.acc += rate * dt;
    while (this.acc >= 1 && this.n < this.max) { this.acc -= 1; const i = this.n++;
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), dir = [s * Math.cos(a), u, s * Math.sin(a)];
      const r = radius * (0.7 + Math.random() * 0.35);
      this.p.set([center.x + dir[0] * r, center.y + dir[1] * r * (up ? 0.6 : 1), center.z + dir[2] * r], i * 3);
      const sp = speed * (0.5 + Math.random());
      this.v.set(up ? [dir[0] * 0.3, sp + 0.8, dir[2] * 0.3] : [dir[0] * sp, dir[1] * sp + 0.15, dir[2] * sp], i * 3);
      this.age[i] = 0; this.life[i] = life * (0.6 + Math.random() * 0.8); this.s0[i] = size * (0.6 + Math.random() * 0.8); }
    if (this.acc > 1) this.acc = 1;
    const P = this.g.attributes.position.array, S = this.g.attributes.size.array, A = this.g.attributes.alpha.array, C = this.g.attributes.pcolor.array;
    const ca = new THREE.Color(c1), cb = new THREE.Color(c2 || c1), tmp = new THREE.Color();
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { const j = --this.n; // swap-remove
        this.p.copyWithin(i * 3, j * 3, j * 3 + 3); this.v.copyWithin(i * 3, j * 3, j * 3 + 3); this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.s0[i] = this.s0[j]; i--; continue; }
      const k = this.age[i] / this.life[i];
      if (up) this.v[i * 3 + 1] += 1.6 * dt;
      for (let a = 0; a < 3; a++) this.p[i * 3 + a] += this.v[i * 3 + a] * dt;
      P[i * 3] = this.p[i * 3]; P[i * 3 + 1] = this.p[i * 3 + 1]; P[i * 3 + 2] = this.p[i * 3 + 2];
      S[i] = this.s0[i] * (this.kind === 2 ? 0.6 + k : this.kind === 1 ? 1.1 - k * 0.8 : Math.sin(Math.PI * k));
      A[i] = (1 - k) * (k < 0.12 ? k / 0.12 : 1);
      if (rainbowHue != null) tmp.setHSL((rainbowHue + k * 0.3) % 1, 0.85, 0.6); else tmp.copy(ca).lerp(cb, k);
      C[i * 3] = tmp.r; C[i * 3 + 1] = tmp.g; C[i * 3 + 2] = tmp.b;
    }
    this.g.setDrawRange(0, this.n);
    for (const k of ['position', 'size', 'alpha', 'pcolor']) this.g.attributes[k].needsUpdate = true;
  }
  clear() { this.n = 0; this.g.setDrawRange(0, 0); }
}
const fxRoot = new THREE.Group(); scene.add(fxRoot);
const emit = { aura: new Emitter(1600, 0), sparkles: new Emitter(600, 0), flames: new Emitter(900, 1) };
for (const e of Object.values(emit)) fxRoot.add(e.obj);
const orbitGroup = new THREE.Group(); scene.add(orbitGroup);
const ballGeo = new THREE.SphereGeometry(0.5, 18, 12);
let ringMeshes = [], orbMeshes = [];
const boltGroup = new THREE.Group(); scene.add(boltGroup);
let boltNext = 0;
// trail ribbon
const TRAIL_N = 60; const trailPos = new Float32Array(TRAIL_N * 2 * 3); const trailCol = new Float32Array(TRAIL_N * 2 * 4);
const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 4));
{ const idx = []; for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(idx); }
const trailMesh = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
trailMesh.frustumCulled = false; scene.add(trailMesh); const trailHist = [];
function rebuildFx() {
  for (const m of [...ringMeshes, ...orbMeshes]) { orbitGroup.remove(m); m.material.dispose(); }
  ringMeshes = []; orbMeshes = [];
  const fx = pet.fx;
  if (fx.rings.on) for (let i = 0; i < fx.rings.count; i++) { const m = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(fx.rings.c1).multiplyScalar(1.6) })); m.scale.setScalar(fx.rings.dot); orbitGroup.add(m); ringMeshes.push(m); }
  if (fx.orbs.on) for (let i = 0; i < fx.orbs.count; i++) { const m = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(fx.orbs.c1).multiplyScalar(2.4) })); m.scale.setScalar(fx.orbs.size);
    const l = new THREE.PointLight(fx.orbs.c1, 2.5, 5, 2); m.add(l); orbitGroup.add(m); orbMeshes.push(m); }
  for (const k of Object.keys(emit)) if (!fx[k].on) emit[k].clear();
  if (!fx.trail.on) { trailHist.length = 0; trailGeo.setDrawRange(0, 0); }
}
let walking = false; $('walk').onclick = () => { walking = !walking; $('walk').classList.toggle('on', walking); controls.autoRotate = !walking && !selId; if (walking) select(null); toast(walking ? 'Balade : le pet se déplace pour montrer la traînée' : 'Balade arrêtée'); };
const clock = new THREE.Clock(); let t = 0;
function bodyCenter() { const b = pet.parts.find((p) => p.name === 'Body') || pet.parts[0]; return b ? new THREE.Vector3(...b.pos) : new THREE.Vector3(0, 1, 0); }
function bodyRadius() { const b = pet.parts.find((p) => p.name === 'Body') || pet.parts[0]; return b ? Math.max(...b.size) * 0.62 : 1; }
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta()); t += dt;
  const fx = pet.fx;
  // pet motion (float / spin / walk) - matches the server controller
  const bob = fx.float.on ? Math.sin(t * fx.float.speed) * fx.float.height : 0;
  if (walking) { const a = t * 0.6; petGroup.position.set(Math.cos(a) * 3.2, bob, Math.sin(a) * 3.2); petGroup.rotation.y = -a + Math.PI; }
  else { petGroup.position.set(0, bob, 0); petGroup.rotation.y = fx.spin.on && !gizmo.dragging ? petGroup.rotation.y + THREE.MathUtils.degToRad(fx.spin.speed) * dt : (selId ? 0 : petGroup.rotation.y); }
  if (selId && !fx.spin.on) petGroup.rotation.y = 0;
  const hue = fx.rainbow.on ? (t * fx.rainbow.speed) % 1 : null;
  if (hue != null) for (const p of pet.parts) if (p.tint) { const m = meshes.get(p.id); if (m) { m.material.color.setHSL(hue, 0.8, 0.55); if (m.material.emissive && p.material === 'Neon') m.material.emissive.setHSL(hue, 0.8, 0.55); } }
  const center = bodyCenter().applyMatrix4(petGroup.matrixWorld); petGroup.updateMatrixWorld();
  const R = bodyRadius();
  const pulse = fx.pulse.on ? 1 + Math.sin(t * fx.pulse.speed) * fx.pulse.amount : 1;
  // glow
  glowLight.intensity = fx.glow.on ? fx.glow.brightness * 2.2 * pulse : 0; glowLight.distance = fx.glow.range; glowLight.color.set(hue != null ? new THREE.Color().setHSL(hue, 0.8, 0.6) : fx.glow.c1);
  glowLight.position.copy(bodyCenter());
  // particles
  if (fx.aura.on) emit.aura.update(dt, { rate: fx.aura.rate, size: fx.aura.size, speed: fx.aura.speed, life: fx.aura.life, c1: fx.aura.c1, c2: fx.aura.c2 }, center, R, hue);
  if (fx.sparkles.on) emit.sparkles.update(dt, { rate: fx.sparkles.rate, size: fx.sparkles.size, speed: 0.4, life: 0.9, c1: fx.sparkles.c1, c2: '#ffffff' }, center, R * 1.1, hue);
  if (fx.flames.on) emit.flames.update(dt, { rate: fx.flames.rate, size: fx.flames.size, speed: 0.6, life: 0.9, up: true, c1: fx.flames.c1, c2: fx.flames.c2 }, center.clone().add(new THREE.Vector3(0, -R * 0.4, 0)), R * 0.8, hue);
  // orbiters
  ringMeshes.forEach((m, i) => { const r = fx.rings.radius, a = t * fx.rings.speed + (i / ringMeshes.length) * Math.PI * 2;
    m.position.set(center.x + Math.cos(a) * r, center.y + (fx.rings.tilt ? Math.sin(a) * r * 0.35 : 0) + Math.sin(a * 3) * 0.08, center.z + Math.sin(a) * r);
    if (hue != null) m.material.color.setHSL(hue, 0.85, 0.6).multiplyScalar(2); });
  orbMeshes.forEach((m, i) => { const r = fx.orbs.radius, a = -t * fx.orbs.speed + (i / orbMeshes.length) * Math.PI * 2;
    m.position.set(center.x + Math.cos(a) * r, center.y + 1 + Math.sin(t * 2 + i) * 0.5 - R * 0.3, center.z + Math.sin(a) * r);
    if (hue != null) m.material.color.setHSL((hue + 0.5) % 1, 0.85, 0.6).multiplyScalar(2); });
  // lightning arcs
  for (const b of [...boltGroup.children]) { b.userData.ttl -= dt; if (b.userData.ttl <= 0) { boltGroup.remove(b); b.geometry.dispose(); b.material.dispose(); } }
  if (fx.lightning.on && t > boltNext) { boltNext = t + (1 / fx.lightning.rate) * (0.5 + Math.random());
    const pts = [center.clone()]; const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize();
    for (let k = 0; k < 7; k++) pts.push(pts[pts.length - 1].clone().addScaledVector(dir, 0.55).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.55)));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color(fx.lightning.c1).multiplyScalar(3) }));
    line.userData.ttl = 0.12; boltGroup.add(line); }
  // trail
  if (fx.trail.on) {
    const up = new THREE.Vector3(0, R * 0.55, 0); trailHist.unshift([center.clone().add(up), center.clone().sub(up)]);
    const keep = Math.max(2, Math.min(TRAIL_N, Math.round(fx.trail.length * 60))); trailHist.length = Math.min(trailHist.length, keep);
    const ca = new THREE.Color(fx.trail.c1), cb = new THREE.Color(fx.trail.c2);
    trailHist.forEach(([a, b], i) => { const k = i / (keep - 1 || 1); trailPos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
      const c = hue != null ? new THREE.Color().setHSL((hue + k * 0.4) % 1, 0.85, 0.6) : ca.clone().lerp(cb, k); const al = (1 - k) * 0.85;
      trailCol.set([c.r, c.g, c.b, al, c.r, c.g, c.b, al], i * 8); });
    trailGeo.setDrawRange(0, Math.max(0, trailHist.length - 1) * 6); trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;
  }
  outlineGroup.children.forEach((m) => m.material.color.set(hue != null ? new THREE.Color().setHSL(hue, 0.9, 0.6) : fx.outline.c1));
  ringGlow.material.color.set(hue != null ? new THREE.Color().setHSL(hue, 0.8, 0.6) : (fx.glow.on ? fx.glow.c1 : '#7c5cff'));
  bloom.strength = 0.55 + (fx.glow.on ? 0.15 : 0);
  controls.update(); composer.render();
}

/* =====================================================================
   5. LAYOUT: resizable split between viewport and panel
   ===================================================================== */
function resize() {
  const vh = view.getBoundingClientRect().height, w = innerWidth;
  renderer.setSize(w, vh, false); composer.setSize(w, vh); bloom.setSize(w / 2, vh / 2);
  camera.aspect = w / vh; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
{ let y0 = null, h0 = 0; const grip = $('grip');
  grip.addEventListener('pointerdown', (e) => { y0 = e.clientY; h0 = view.getBoundingClientRect().height; grip.setPointerCapture(e.pointerId); });
  grip.addEventListener('pointermove', (e) => { if (y0 == null) return; const h = Math.max(innerHeight * 0.25, Math.min(innerHeight * 0.8, h0 + e.clientY - y0)); document.documentElement.style.setProperty('--vh', h + 'px'); resize(); });
  grip.addEventListener('pointerup', () => (y0 = null)); }

/* =====================================================================
   6. PANES
   ===================================================================== */
let currentTab = 'rar';
function setTab(id) { currentTab = id; document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === id)); renderPane(); $('pane').scrollTop = 0; }
document.querySelectorAll('.tab').forEach((b) => b.onclick = () => setTab(b.dataset.tab));
const pane = $('pane');
function renderPane() { ({ rar: paneRarity, body: paneBody, parts: paneParts, fx: paneFx, code: paneCode, lib: paneLib, export: paneExport })[currentTab](); }

function paneRarity() {
  pane.innerHTML = `<div class="sec"><h3>Rareté <small>change couleurs + effets</small></h3><div class="grid2">${RARITIES.map((r) => `<button class="rarbtn${r.id === pet.rarity ? ' on' : ''}" data-r="${esc(r.id)}" style="background:${r.bg}">${esc(r.id)}</button>`).join('')}</div></div>
    <div class="sec"><h3>Couleurs du pet</h3>
      <div class="row"><label>Principale</label><input type="color" id="c1" value="${pet.c1}"><span class="note">les pièces « teintes »</span></div>
      <div class="row"><label>Secondaire</label><input type="color" id="c2" value="${pet.c2}"><span class="note">ventre, oreilles…</span></div></div>
    <div class="sec"><h3>Nom</h3><div class="row"><input type="text" id="pname" maxlength="40" value="${esc(pet.name)}"></div></div>`;
  pane.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { snapshot(); const r = RARITIES.find((x) => x.id === b.dataset.r);
    const oldC1 = pet.c1, oldC2 = pet.c2; pet.rarity = r.id; pet.c1 = r.c1; pet.c2 = r.c2;
    for (const p of pet.parts) { if (p.color === oldC1) p.color = r.c1; else if (p.color === oldC2) p.color = r.c2; }
    applyRarityFx(pet, r); autoName(); save(); rebuild(); renderPane(); toast(r.id + ' appliqué'); });
  for (const k of ['c1', 'c2']) { const el = $(k); let first = true; el.oninput = () => { if (first) { snapshot(); first = false; } const old = pet[k]; pet[k] = el.value;
    for (const p of pet.parts) if (p.color === old) p.color = el.value; save(); rebuild(); }; }
  $('pname').oninput = (e) => { pet.name = e.target.value || 'Pet'; pet.customName = true; save(); updateHud(); };
}
function paneBody() {
  pane.innerHTML = `<div class="sec"><h3>Corps <small>remplace toutes les pièces</small></h3><div class="grid2">${Object.entries(BODIES).map(([id, b]) => `<button class="preset${id === pet.body ? ' on' : ''}" data-b="${id}"><span class="e">${b.e}</span>${b.label}</button>`).join('')}</div></div>
    <div class="sec"><h3>Taille globale</h3><div class="row"><label>Échelle</label><input type="range" id="gscale" min="0.5" max="2" step="0.05" value="1"><span class="val" id="gscaleV">×1</span></div>
    <div class="btns"><button class="btn" id="applyScale">Appliquer l'échelle</button></div></div>
    <div class="note">Astuce : l'onglet <b>Pièces</b> permet de modifier chaque morceau, d'en ajouter, de les déplacer avec les flèches dans la vue 3D.</div>`;
  pane.querySelectorAll('[data-b]').forEach((b) => b.onclick = () => { snapshot(); pet.body = b.dataset.b; pet.parts = makeParts(pet.body, pet.c1, pet.c2); selId = null; autoName(); save(); rebuild(); renderPane(); });
  $('gscale').oninput = (e) => ($('gscaleV').textContent = '×' + (+e.target.value).toFixed(2));
  $('applyScale').onclick = () => { const k = +$('gscale').value; if (k === 1) return; snapshot();
    for (const p of pet.parts) { p.size = p.size.map((v) => +(v * k).toFixed(3)); p.pos = p.pos.map((v) => +(v * k).toFixed(3)); } save(); rebuild(); toast('Échelle ×' + k.toFixed(2)); };
}
function vecRow(label, key, arr, step) { return `<div class="row"><label>${label}</label><div class="vec" data-vec="${key}">${arr.map((v, i) => `<input type="number" inputmode="decimal" step="${step}" data-i="${i}" value="${(+v).toFixed(2)}">`).join('')}</div></div>`; }
function paneParts() {
  const p = pet.parts.find((x) => x.id === selId);
  pane.innerHTML = (p ? `<div class="sec"><h3>${esc(p.name)} <small>${SHAPES[p.shape]}</small></h3>
      <div class="row"><label>Nom</label><input type="text" id="pn" value="${esc(p.name)}"></div>
      <div class="row"><label>Forme</label><select id="psh">${Object.entries(SHAPES).map(([k, v]) => `<option value="${k}"${k === p.shape ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
      ${vecRow('Position', 'pos', p.pos, 0.05)}${vecRow('Rotation°', 'rot', p.rot, 5)}${vecRow('Taille', 'size', p.size, 0.05)}
      <div class="row"><label>Couleur</label><input type="color" id="pc" value="${p.color}"><label style="width:auto">Teinte pet</label><button class="sw${p.tint ? ' on' : ''}" id="ptint"></button></div>
      <div class="row"><label>Matériau</label><select id="pm">${MATERIALS.map((m) => `<option${m === p.material ? ' selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="row"><label>Transparence</label><input type="range" id="pt" min="0" max="0.95" step="0.05" value="${p.transparency || 0}"><span class="val" id="ptv">${(p.transparency || 0).toFixed(2)}</span></div>
      <div class="btns"><button class="btn" id="pdup">⧉ Dupliquer</button><button class="btn" id="pmir">⇋ Miroir</button><button class="btn danger" id="pdel">🗑 Supprimer</button><button class="btn" id="pdesel">✓ Terminé</button></div></div>`
    : '<div class="note" style="margin:10px 2px">Touche une pièce dans la vue 3D, ou dans la liste, pour la modifier. Le bouton <b>＋</b> ajoute des formes.</div>')
    + `<div class="sec"><h3>Hiérarchie <small>${pet.parts.length} pièces</small></h3><ul class="tree">${pet.parts.map((x) => `<li data-id="${x.id}" class="${x.id === selId ? 'on' : ''}"><span class="dot" style="background:${x.color}"></span>${esc(x.name)}<span class="sh">${SHAPES[x.shape]} · ${x.material}</span></li>`).join('')}</ul></div>`;
  pane.querySelectorAll('.tree li').forEach((li) => li.onclick = () => select(li.dataset.id));
  if (!p) return;
  let snapped = false; const once = () => { if (!snapped) { snapshot(); snapped = true; } };
  const apply = () => { save(); rebuild(); };
  $('pn').oninput = (e) => { once(); p.name = e.target.value.replace(/[^\w\- ]/g, '') || 'Piece'; save(); updateHud(); };
  $('psh').onchange = (e) => { once(); p.shape = e.target.value; if (p.shape === 'Ball') { const s = Math.max(...p.size); p.size = [s, s, s]; } apply(); renderPane(); };
  pane.querySelectorAll('[data-vec]').forEach((box) => box.querySelectorAll('input').forEach((inp) => inp.onchange = () => { once();
    const v = parseFloat(inp.value); if (!isFinite(v)) return; p[box.dataset.vec][+inp.dataset.i] = box.dataset.vec === 'size' ? Math.max(0.05, v) : v;
    if (p.shape === 'Ball' && box.dataset.vec === 'size') p.size = [v, v, v].map((x) => Math.max(0.05, x)); apply(); }));
  $('pc').oninput = (e) => { once(); p.color = e.target.value; apply(); };
  $('ptint').onclick = () => { once(); p.tint = !p.tint; $('ptint').classList.toggle('on', p.tint); save(); };
  $('pm').onchange = (e) => { once(); p.material = e.target.value; apply(); };
  $('pt').oninput = (e) => { once(); p.transparency = +e.target.value; $('ptv').textContent = p.transparency.toFixed(2); apply(); };
  $('pdup').onclick = () => { snapshot(); const c = { ...clone(p), id: nid(), name: p.name + 'Copie', pos: [p.pos[0] + 0.4, p.pos[1], p.pos[2]] }; pet.parts.push(c); apply(); select(c.id); };
  $('pmir').onclick = () => { snapshot(); const c = { ...clone(p), id: nid(), name: p.name.replace(/L$/, 'R').replace(/Left/, 'Right') + (/[LR]$/.test(p.name) ? '' : 'Miroir'), pos: [-p.pos[0], p.pos[1], p.pos[2]], rot: [p.rot[0], -p.rot[1], -p.rot[2]] }; pet.parts.push(c); apply(); select(c.id); toast('Copie en miroir créée'); };
  $('pdel').onclick = () => { if (pet.parts.length <= 1) return toast('Il faut au moins une pièce'); snapshot(); pet.parts = pet.parts.filter((x) => x.id !== p.id); if (p.name === 'Body' && pet.parts[0]) pet.parts[0].name = 'Body'; selId = null; apply(); renderPane(); };
  $('pdesel').onclick = () => select(null);
}
function fxControls(f, cfg) {
  return Object.keys(f.p).map((k) => {
    if (k === 'c1' || k === 'c2') return `<div class="row"><label>${LABELS[k]}</label><input type="color" data-k="${k}" value="${cfg[k]}"></div>`;
    if (k === 'tex') return `<div class="row"><label>${LABELS[k]}</label><select data-k="tex">${Object.keys(TEX).map((x) => `<option${x === cfg.tex ? ' selected' : ''}>${x}</option>`).join('')}</select></div>`;
    if (k === 'tilt') return `<div class="row"><label>${LABELS[k]}</label><button class="sw${cfg.tilt ? ' on' : ''}" data-k="tilt"></button></div>`;
    const [mn, mx, st] = RANGES[k] || (f.id === 'spin' ? [5, 360, 5] : f.id === 'rainbow' ? [0.02, 2, 0.02] : f.id === 'lightning' ? [0.2, 12, 0.2] : f.id === 'pulse' ? [0.5, 12, 0.5] : f.id === 'float' ? [0.3, 6, 0.1] : [0, 10, 0.1]);
    return `<div class="row"><label>${LABELS[k] || k}</label><input type="range" data-k="${k}" min="${mn}" max="${mx}" step="${st}" value="${cfg[k]}"><span class="val">${(+cfg[k]).toFixed(st < 1 ? 2 : 0)}</span></div>`;
  }).join('');
}
const openFx = new Set(['aura']);
function paneFx() {
  pane.innerHTML = `<div class="note" style="margin:8px 2px">Chaque effet devient un vrai objet Roblox (ParticleEmitter, PointLight, Highlight, Trail…) ou est animé par le script d'effets. Combine-les librement.</div>`
    + FX.map((f) => { const c = pet.fx[f.id]; return `<div class="fx${openFx.has(f.id) ? ' open' : ''}" data-fx="${f.id}"><div class="fxh"><span class="ico">${f.ico}</span><b>${f.label}<small>${f.hint}</small></b><button class="sw${c.on ? ' on' : ''}" data-on></button></div><div class="fxb">${fxControls(f, c)}</div></div>`; }).join('');
  pane.querySelectorAll('.fx').forEach((box) => {
    const id = box.dataset.fx, cfg = pet.fx[id]; let snapped = false; const once = () => { if (!snapped) { snapshot(); snapped = true; } };
    box.querySelector('.fxh').onclick = (e) => { if (e.target.closest('[data-on]')) return; box.classList.toggle('open'); box.classList.contains('open') ? openFx.add(id) : openFx.delete(id); };
    box.querySelector('[data-on]').onclick = (e) => { once(); cfg.on = !cfg.on; e.target.classList.toggle('on', cfg.on); if (cfg.on) { box.classList.add('open'); openFx.add(id); } save(); rebuild(); };
    box.querySelectorAll('[data-k]').forEach((el) => {
      const k = el.dataset.k;
      if (el.classList.contains('sw')) el.onclick = () => { once(); cfg[k] = !cfg[k]; el.classList.toggle('on', cfg[k]); save(); rebuild(); };
      else el.oninput = () => { once(); cfg[k] = el.type === 'range' ? +el.value : el.value; const v = el.nextElementSibling; if (v && v.classList.contains('val')) v.textContent = (+el.value).toFixed(+el.step < 1 ? 2 : 0);
        if (!cfg.on) { cfg.on = true; box.querySelector('[data-on]').classList.add('on'); } save(); if (['count', 'dot', 'size', 'c1', 'tilt'].includes(k) || id === 'outline') rebuild(); };
    });
  });
}

/* ---------- scripts (all editable) ---------- */
let KIT = null;
async function loadKit() {
  if (KIT) return KIT;
  const [ctrl, fxs] = await Promise.all(['kit/ForgePetController.server.lua', 'kit/ForgePetFX.client.lua'].map((u) => fetch(u, { cache: 'no-cache' }).then((r) => r.text())));
  return (KIT = { ctrl, fxs });
}
function configLua() { return `-- Roblox Forge - configuration\nreturn {\n\t-- Pet given to players who have no "ForgePet" attribute\n\tDefaultPet = ${JSON.stringify(safeName(pet.name))},\n\t-- Where the pet floats, relative to the player (right, up, back)\n\tOffset = Vector3.new(3, 1.5, 3),\n}\n`; }
function scriptFiles() {
  return [
    { id: 'ctrl', name: 'ForgePetController.server.lua', where: 'ServerScriptService', text: pet.scripts.ctrl ?? KIT.ctrl },
    { id: 'fxs', name: 'ForgePetFX.client.lua', where: 'StarterPlayerScripts', text: pet.scripts.fxs ?? KIT.fxs },
    { id: 'cfg', name: 'ForgeConfig.lua', where: 'ReplicatedStorage', text: pet.scripts.cfg ?? configLua() },
    { id: 'model', name: safeName(pet.name) + '.model.json', where: 'ReplicatedStorage/ForgePets', text: JSON.stringify(modelJson(), null, 2), readonly: true },
  ];
}
const LUAU_K = /\b(local|function|end|if|then|else|elseif|for|in|do|while|repeat|until|return|and|or|not|nil|true|false|break|continue|export|type)\b/g;
function highlight(src) {
  let out = '', i = 0; const re = /(--\[\[[\s\S]*?\]\]|--[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\[\[[\s\S]*?\]\])|(\b\d+(?:\.\d+)?\b)|\b(game|workspace|script|Instance|Vector3|CFrame|Color3|ColorSequence|NumberSequence|NumberSequenceKeypoint|Enum|task|math|table|string|os|require|pcall|print|warn)\b|\b(local|function|end|if|then|else|elseif|for|in|do|while|repeat|until|return|and|or|not|nil|true|false|break|continue|export|type)\b/g;
  let m; while ((m = re.exec(src))) { out += esc(src.slice(i, m.index)); const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : m[4] ? 'g' : 'k'; out += `<span class="tk-${cls}">${esc(m[0])}</span>`; i = re.lastIndex; }
  return out + esc(src.slice(i)) + '\n';
}
let codeFile = 'ctrl';
async function paneCode() {
  pane.innerHTML = '<div class="note">Chargement des scripts…</div>'; await loadKit(); if (currentTab !== 'code') return;
  const files = scriptFiles(), f = files.find((x) => x.id === codeFile) || files[0];
  pane.innerHTML = `<div class="filetabs">${files.map((x) => `<button class="tab${x.id === f.id ? ' on' : ''}" data-f="${x.id}">${esc(x.name)}</button>`).join('')}</div>
    <div class="note" style="margin-bottom:8px">📍 ${esc(f.where)} ${f.readonly ? '· généré depuis le modèle 3D (lecture seule)' : '· modifiable : tes changements partent dans l\'export'}</div>
    <div class="code"><pre id="hl"></pre><textarea id="ta" spellcheck="false" autocapitalize="off" autocomplete="off" ${f.readonly ? 'readonly' : ''}></textarea></div>
    <div class="btns" style="margin-top:8px">${f.readonly ? '' : '<button class="btn" id="reset">↺ Version d\'origine</button>'}<button class="btn" id="copy">⧉ Copier</button></div>`;
  pane.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { codeFile = b.dataset.f; paneCode(); });
  const ta = $('ta'), hl = $('hl'); ta.value = f.text; hl.innerHTML = highlight(f.text);
  ta.oninput = () => { hl.innerHTML = highlight(ta.value); pet.scripts[f.id] = ta.value; save(); };
  ta.onscroll = () => { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; };
  ta.onkeydown = (e) => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('\t', s, ta.selectionEnd, 'end'); ta.oninput(); } };
  if ($('reset')) $('reset').onclick = () => { if (!confirm('Revenir à la version d\'origine de ce script ?')) return; delete pet.scripts[f.id]; save(); paneCode(); };
  $('copy').onclick = async () => { try { await navigator.clipboard.writeText(ta.value); toast('Copié ✓'); } catch { toast('Copie impossible'); } };
}

/* ---------- library (the whole catalog inside the editor) ---------- */
let CAT = null, libQ = '', libCat = 'all';
const LIBCATS = { all: '✨ Tout', vfx: '💥 Effets', pets: '🐾 Pets', animation: '🌀 Animations', ui: '🎛️ UI', systems: '🧩 Systèmes', map: '🗺️ Maps', physics: '⚙️ Physique', camera: '🎥 Caméra', audio: '🔊 Son', network: '📡 Réseau', framework: '🏗️ Frameworks', tools: '🛠️ Outils', utility: '🧰 Utilitaires' };
async function paneLib() {
  if (!CAT) { pane.innerHTML = '<div class="note">Chargement de la bibliothèque…</div>'; try { CAT = await (await fetch('../library/catalog.json', { cache: 'no-cache' })).json(); } catch { pane.innerHTML = '<div class="note">Bibliothèque indisponible hors connexion.</div>'; return; } if (currentTab !== 'lib') return; }
  pane.innerHTML = `<input class="lsearch" id="lq" type="search" placeholder="Rechercher parmi ${CAT.count.toLocaleString('fr-FR')} ressources…" value="${esc(libQ)}">
    <div class="filetabs" style="margin-top:8px">${Object.entries(LIBCATS).map(([k, v]) => `<button class="tab${k === libCat ? ' on' : ''}" data-c="${k}">${v}</button>`).join('')}</div><div id="lres"></div>`;
  const draw = () => {
    const terms = libQ.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/).filter(Boolean);
    const res = CAT.items.filter((e) => (libCat === 'all' || e.category === libCat) && terms.every((tt) => (e.id + ' ' + e.description).toLowerCase().includes(tt))).slice(0, 60);
    $('lres').innerHTML = res.map((e) => `<div class="lcard"><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.id)}</a><div class="m">${e.curated ? '<span class="b s">Recommandée</span>' : ''}<span class="b l">${esc(e.license)}</span>${e.stars ? `<span class="b s">★ ${e.stars}</span>` : ''}</div>${e.description ? `<p>${esc(e.description)}</p>` : ''}${e.wally ? `<code>${esc(e.wally)}</code>` : ''}</div>`).join('')
      || '<div class="note">Rien trouvé.</div>';
  };
  let deb; $('lq').oninput = (e) => { libQ = e.target.value; clearTimeout(deb); deb = setTimeout(draw, 150); };
  pane.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { libCat = b.dataset.c; pane.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b)); draw(); });
  draw();
}

/* =====================================================================
   7. EXPORT: Rojo pack (.zip) that Roblox Push turns into a game
   ===================================================================== */
const safeName = (s) => (String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '_') || 'ForgePet').slice(0, 40);
const rgb = (hex) => { const c = new THREE.Color(hex); return [+c.r.toFixed(4), +c.g.toFixed(4), +c.b.toFixed(4)]; };
function orientation(rotDeg) { // rows of the rotation matrix, Euler XYZ like CFrame.Angles
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotDeg.map(THREE.MathUtils.degToRad), 'XYZ')); const e = m.elements;
  return [[e[0], e[4], e[8]], [e[1], e[5], e[9]], [e[2], e[6], e[10]]].map((r) => r.map((v) => +v.toFixed(6)));
}
const NS = (pairs) => ({ NumberSequence: { keypoints: pairs.map(([time, value]) => ({ time, value, envelope: 0 })) } });
const CS = (a, b) => ({ ColorSequence: { keypoints: [{ time: 0, color: rgb(a) }, { time: 1, color: rgb(b || a) }] } });
function modelJson() {
  const fx = pet.fx, body = pet.parts.find((p) => p.name === 'Body') || pet.parts[0];
  const parts = [body, ...pet.parts.filter((p) => p !== body)];
  const children = parts.map((p) => {
    const isWedge = p.shape === 'Wedge', node = { name: p === body ? 'Body' : p.name, className: isWedge ? 'WedgePart' : 'Part', properties: {
      Size: p.shape === 'Ball' ? [p.size[0], p.size[0], p.size[0]] : p.size, CFrame: { CFrame: { position: p.pos, orientation: orientation(p.rot) } },
      Color: rgb(p.color), Material: p.material, Transparency: p.transparency || 0, Anchored: false, CanCollide: false, CastShadow: p.material !== 'Neon',
      TopSurface: 'Smooth', BottomSurface: 'Smooth' }, children: [] };
    if (p.shape === 'Ball') node.properties.Shape = 'Ball';
    if (p.shape === 'Cylinder') node.properties.Shape = 'Cylinder';
    if (p.shape === 'Ellipsoid') node.children.push({ name: 'Mesh', className: 'SpecialMesh', properties: { MeshType: 'Sphere' } });
    if (p.tint) node.attributes = { ForgeTint: true };
    return node;
  });
  const b = children[0];
  if (fx.aura.on) b.children.push({ name: 'Aura', className: 'ParticleEmitter', properties: { Texture: TEX[fx.aura.tex] || TEX.sparkle, Color: CS(fx.aura.c1, fx.aura.c2), LightEmission: 1,
    Size: NS([[0, 0], [0.15, fx.aura.size], [1, 0]]), Transparency: NS([[0, 1], [0.12, 0.1], [1, 1]]), Lifetime: { NumberRange: [fx.aura.life * 0.6, fx.aura.life * 1.4] },
    Speed: { NumberRange: [fx.aura.speed * 0.5, fx.aura.speed * 1.5] }, Rate: fx.aura.rate, SpreadAngle: [180, 180], Shape: 'Sphere', ShapeStyle: 'Surface', RotSpeed: { NumberRange: [-120, 120] }, Rotation: { NumberRange: [0, 360] } } });
  if (fx.sparkles.on) b.children.push({ name: 'Sparkles', className: 'ParticleEmitter', properties: { Texture: TEX.sparkle, Color: CS(fx.sparkles.c1, '#ffffff'), LightEmission: 1,
    Size: NS([[0, 0], [0.5, fx.sparkles.size], [1, 0]]), Transparency: NS([[0, 0], [1, 1]]), Lifetime: { NumberRange: [0.5, 1.1] }, Speed: { NumberRange: [0.2, 0.8] }, Rate: fx.sparkles.rate,
    SpreadAngle: [180, 180], Shape: 'Sphere', ShapeStyle: 'Surface' } });
  if (fx.flames.on) b.children.push({ name: 'Flames', className: 'ParticleEmitter', properties: { Texture: TEX.fire, Color: CS(fx.flames.c1, fx.flames.c2), LightEmission: 1,
    Size: NS([[0, fx.flames.size], [1, fx.flames.size * 0.2]]), Transparency: NS([[0, 0.2], [1, 1]]), Lifetime: { NumberRange: [0.5, 1.0] }, Speed: { NumberRange: [0.6, 1.4] },
    Acceleration: [0, 4, 0], Rate: fx.flames.rate, SpreadAngle: [25, 25], EmissionDirection: 'Top', RotSpeed: { NumberRange: [-60, 60] } } });
  if (fx.glow.on) b.children.push({ name: 'Glow', className: 'PointLight', properties: { Color: rgb(fx.glow.c1), Brightness: fx.glow.brightness, Range: fx.glow.range, Shadows: false } });
  if (fx.outline.on) children.push({ name: 'Outline', className: 'Highlight', properties: { FillTransparency: 1, OutlineColor: rgb(fx.outline.c1), OutlineTransparency: 0, DepthMode: 'Occluded' } });
  const runtime = {}; for (const k of ['rings', 'orbs', 'trail', 'lightning', 'rainbow', 'pulse', 'float', 'spin']) runtime[k] = fx[k];
  return { className: 'Model', attributes: { ForgeFX: JSON.stringify(runtime), ForgeRarity: pet.rarity, ForgeStudio: 'Roblox Forge Pet Studio' }, children };
}
// minimal ZIP writer (stored entries) - no dependency
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.path), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
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
  await loadKit(); const n = safeName(pet.name), files = scriptFiles();
  return zip([
    { path: `ReplicatedStorage/ForgePets/${n}.model.json`, data: JSON.stringify(modelJson(), null, 2) },
    { path: 'ReplicatedStorage/ForgeConfig.lua', data: files.find((f) => f.id === 'cfg').text },
    { path: 'ServerScriptService/ForgePetController.server.lua', data: files.find((f) => f.id === 'ctrl').text },
    { path: 'StarterPlayerScripts/ForgePetFX.client.lua', data: files.find((f) => f.id === 'fxs').text },
    { path: 'LISEZ-MOI.txt', data: `Pack Roblox Forge : ${pet.name} (${pet.rarity})\n\n- ReplicatedStorage/ForgePets : le modèle du pet (pièces, particules, lumière, contour)\n- ServerScriptService : donne le pet à chaque joueur et le fait suivre\n- StarterPlayerScripts : anime les effets (anneaux, orbes, arc-en-ciel, éclairs…)\n- ReplicatedStorage/ForgeConfig : pet par défaut et position\n\nPour donner un autre pet à un joueur : player:SetAttribute("ForgePet", "NomDuPet")\nPublie ce .zip avec Roblox Push (tu peux y ajouter les fichiers de ton jeu).\n` },
  ]);
}
function paneExport() {
  const parts = pet.parts.length, fxOn = FX.filter((f) => pet.fx[f.id].on).map((f) => f.ico + ' ' + f.label);
  pane.innerHTML = `<div class="sec"><h3>${esc(pet.name)} <small>${esc(pet.rarity)}</small></h3>
      <div class="note">${parts} pièces · ${fxOn.length} effets : ${fxOn.join(', ') || 'aucun'}</div>
      <button class="btn pri big" id="dl">📦 Télécharger le pack Roblox (.zip)</button>
      <button class="btn big" id="copyModel">⧉ Copier le modèle (JSON Rojo)</button></div>
    <div class="sec"><h3>Mettre le pet dans ton jeu</h3><div class="note">
      1. Télécharge le pack.<br>2. Dans <b>Roblox Push</b>, publie-le (seul pour tester, ou ajoute ses dossiers au zip de ton jeu).<br>
      3. Chaque joueur reçoit ce pet, qui le suit avec tous ses effets.<br><br>
      Contenu : <b>ReplicatedStorage/ForgePets</b> (modèle), <b>ServerScriptService</b> (suivi), <b>StarterPlayerScripts</b> (effets), <b>ForgeConfig</b> (réglages).</div></div>
    <div class="sec"><h3>Projet</h3><div class="btns"><button class="btn" id="newp">＋ Nouveau pet</button><button class="btn" id="saveCopy">💾 Garder une copie</button></div><div id="saved"></div></div>`;
  $('dl').onclick = async () => { const blob = await buildPack(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = safeName(pet.name) + '.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Pack téléchargé ✓'); };
  $('copyModel').onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(modelJson(), null, 2)); toast('Modèle copié ✓'); } catch { toast('Copie impossible'); } };
  $('newp').onclick = () => { if (!confirm('Commencer un nouveau pet ? (le pet actuel est remplacé, garde une copie avant)')) return; snapshot(); pet = newPet(); selId = null; save(); rebuild(); setTab('rar'); };
  const lib = Store.get('saved', []);
  $('saved').innerHTML = lib.length ? `<ul class="tree" style="margin-top:8px">${lib.map((s, i) => `<li data-i="${i}"><span class="dot" style="background:${s.c1}"></span>${esc(s.name)}<span class="sh">${esc(s.rarity)} · ouvrir</span></li>`).join('')}</ul>` : '';
  $('saveCopy').onclick = () => { const l = Store.get('saved', []); l.unshift(clone(pet)); Store.set('saved', l.slice(0, 30)); toast('Copie gardée ✓'); paneExport(); };
  pane.querySelectorAll('#saved li').forEach((li) => li.onclick = () => { snapshot(); pet = clone(Store.get('saved', [])[+li.dataset.i]); selId = null; save(); rebuild(); toast('Ouvert : ' + pet.name); });
}

/* ---------- boot ---------- */
resize(); rebuild(); renderPane(); syncUndo(); loop();
window.__forge = { get pet() { return pet; }, modelJson, buildPack, select, setTab }; // used by automated tests
