// Roblox Forge - Pet Studio. Everything you see maps 1:1 to real Roblox objects on export.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as AC from './anim-core.js';
import * as PG from './pet-gen.js';
import { VOX_SPECIES, voxelAnimal, voxelizeParts } from './voxel.js';
import { createLibrary } from '../library/forge-lib.js';

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
let undoStack = [], redoStack = [], selId = null, rigDirty = true;
function commit(label) {
  undoStack.push(JSON.stringify(pet)); if (undoStack.length > 80) undoStack.shift(); redoStack = [];
  Store.set('pet', pet); syncUndo();
}
function snapshot() { undoStack.push(JSON.stringify(pet)); if (undoStack.length > 80) undoStack.shift(); redoStack = []; syncUndo(); }
function save() { rigDirty = true; Store.set('pet', pet); }
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
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.28; } // reflections for gold, chrome, metal, glass
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
const meshes = new Map(), outlineMeshes = new Map();
const glowLight = new THREE.PointLight(0xffffff, 0, 10, 2); petGroup.add(glowLight);
function rebuild() {
  ensureAnims(); rigDirty = true;
  for (const m of meshes.values()) { m.material.dispose(); partGroup.remove(m); }
  meshes.clear(); outlineGroup.clear(); outlineMeshes.clear();
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
      m.scale.fromArray(p.size.map((s) => s + 0.09)); outlineGroup.add(m); outlineMeshes.set(p.id, m); }
  }
  rebuildFx(); attachGizmo(); updateHud();
}

/* ---------- selection + gizmo ---------- */
const gizmo = new TransformControls(camera, renderer.domElement);
gizmo.setSize(1.15); scene.add(gizmo.getHelper());
gizmo.addEventListener('dragging-changed', (e) => { controls.enabled = !e.value;
  if (e.value) { snapshot(); if (currentTab === 'anim') { anim.playing = false; syncPlay(); } else sculptDragStart(); }
  else if (currentTab === 'anim') { save(); renderDope(); renderInspectors(); }
  else { sculpt.drag = null; save(); rebuild(); renderPane(); } });
gizmo.addEventListener('objectChange', () => {
  const m = gizmo.object; if (currentTab === 'anim') { if (gizmo.dragging) animGizmoChange(m); return; }
  const p = pet.parts.find((x) => x.id === m.userData.id); if (!p) return;
  p.pos = m.position.toArray().map((v) => +v.toFixed(3));
  p.rot = [m.rotation.x, m.rotation.y, m.rotation.z].map((v) => +THREE.MathUtils.radToDeg(v).toFixed(1));
  p.size = m.scale.toArray().map((v) => +Math.max(0.05, Math.abs(v)).toFixed(3));
  if (p.shape === 'Ball') { const s = Math.max(...p.size); p.size = [s, s, s]; m.scale.set(s, s, s); }
  sculptFollow(p); updateHud();
});
function attachGizmo() { const m = selId && meshes.get(selId); if (m) gizmo.attach(m); else gizmo.detach(); }
function select(id) { selId = id; attachGizmo(); updateHud(); controls.autoRotate = !id && !walking; if (currentTab === 'parts') renderPane();
  if (currentTab === 'anim') { const c = curClip(); anim.selKey = c && id && c.tracks[id] ? c.tracks[id].find((k) => Math.abs(k.t - anim.time) < 1e-3) || null : null; renderDope(); renderInspectors(); } }
const ray = new THREE.Raycaster(); let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || gizmo.dragging) return; const [x, y, t] = downAt; downAt = null;
  if (Math.hypot(e.clientX - x, e.clientY - y) > 6 || performance.now() - t > 450) return; // it was an orbit drag
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObjects([...meshes.values()], false)[0];
  select(hit ? hit.object.userData.id : null); if (hit && currentTab !== 'parts' && currentTab !== 'anim') setTab('parts');
});
function setGizmoMode(mode) { gizmo.setMode(mode); document.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x.dataset.mode === mode)); }
document.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => {
  if (currentTab === 'anim' && b.dataset.mode === 'scale') return toast('En animation on bouge et on tourne (comme les Motor6D de Roblox)');
  setGizmoMode(b.dataset.mode); });
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
  const raw = Math.min(0.25, clock.getDelta()), dt = Math.min(0.05, raw); t += dt; // effects use a capped step, animations follow real time
  const fx = pet.fx;
  // pet motion (float / spin / walk) - matches the server controller
  const bob = fx.float.on ? Math.sin(t * fx.float.speed) * fx.float.height : 0;
  if (walking) { const a = t * 0.6; petGroup.position.set(Math.cos(a) * 3.2, bob, Math.sin(a) * 3.2); petGroup.rotation.y = -a + Math.PI; }
  else { petGroup.position.set(0, bob, 0); petGroup.rotation.y = fx.spin.on && !gizmo.dragging ? petGroup.rotation.y + THREE.MathUtils.degToRad(fx.spin.speed) * dt : (selId ? 0 : petGroup.rotation.y); }
  if (selId && !fx.spin.on) petGroup.rotation.y = 0;
  const hue = fx.rainbow.on ? (t * fx.rainbow.speed) % 1 : null;
  if (hue != null) for (const p of pet.parts) if (p.tint) { const m = meshes.get(p.id); if (m) { m.material.color.setHSL(hue, 0.8, 0.55); if (m.material.emissive && p.material === 'Neon') m.material.emissive.setHSL(hue, 0.8, 0.55); } }
  applyPose(raw); animTick(raw);
  petGroup.updateMatrixWorld(); const bodyMesh = meshes.get((AC.bodyOf(pet.parts) || {}).id);
  const center = bodyMesh ? bodyMesh.getWorldPosition(new THREE.Vector3()) : bodyCenter().applyMatrix4(petGroup.matrixWorld);
  const R = bodyRadius();
  const pulse = fx.pulse.on ? 1 + Math.sin(t * fx.pulse.speed) * fx.pulse.amount : 1;
  // glow
  glowLight.intensity = fx.glow.on ? fx.glow.brightness * 2.2 * pulse : 0; glowLight.distance = fx.glow.range; glowLight.color.set(hue != null ? new THREE.Color().setHSL(hue, 0.8, 0.6) : fx.glow.c1);
  if (bodyMesh) glowLight.position.copy(bodyMesh.position); else glowLight.position.copy(bodyCenter());
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
let currentTab = 'gen';
function setTab(id) { if (id !== 'anim' && currentTab === 'anim') anim.playing = false; currentTab = id; document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === id)); renderPane(); $('pane').scrollTop = 0; }
document.querySelectorAll('.tab').forEach((b) => b.onclick = () => setTab(b.dataset.tab));
const pane = $('pane');
const LIB = createLibrary({ studio: 'pet', toast });
function renderPane() { ({ gen: paneGen, index: paneIndex, rar: paneRarity, body: paneBody, parts: paneParts, fx: paneFx, anim: paneAnim, code: paneCode, lib: () => LIB.render(pane), export: paneExport })[currentTab](); }

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
  pane.querySelectorAll('[data-b]').forEach((b) => b.onclick = () => { snapshot(); pet.body = b.dataset.b; pet.parts = makeParts(pet.body, pet.c1, pet.c2); pet.anims = defaultAnims(pet.parts); pet.animSel = pet.anims[0].id; anim.time = 0; anim.selKey = null; selId = null; autoName(); save(); rebuild(); renderPane(); });
  $('gscale').oninput = (e) => ($('gscaleV').textContent = '×' + (+e.target.value).toFixed(2));
  $('applyScale').onclick = () => { const k = +$('gscale').value; if (k === 1) return; snapshot();
    for (const p of pet.parts) { p.size = p.size.map((v) => +(v * k).toFixed(3)); p.pos = p.pos.map((v) => +(v * k).toFixed(3)); if (Array.isArray(p.pivot)) p.pivot = p.pivot.map((v) => +(v * k).toFixed(3)); }
    for (const c of pet.anims || []) for (const keys of Object.values(c.tracks)) keys.forEach((kk) => (kk.pos = kk.pos.map((v) => +(v * k).toFixed(4))));
    save(); rebuild(); toast('Échelle ×' + k.toFixed(2) + ' (animations comprises)'); };
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
      <div class="btns"><button class="btn" id="pdup">⧉ Dupliquer</button><button class="btn" id="pmir">⇋ Miroir</button><button class="btn danger" id="pdel">🗑 Supprimer</button><button class="btn" id="pdesel">✓ Terminé</button></div></div>` + sculptPane(p)
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
  $('pmir').onclick = () => { snapshot(); const c = { ...clone(p), id: nid(), name: p.name.replace(/L$/, 'R').replace(/Left/, 'Right') + (/[LR]$/.test(p.name) ? '' : 'Miroir'), pos: [-p.pos[0], p.pos[1], p.pos[2]], rot: [p.rot[0], -p.rot[1], -p.rot[2]] };
    if (Array.isArray(p.pivot)) c.pivot = [-p.pivot[0], p.pivot[1], p.pivot[2]];
    const par = p.parent && pet.parts.find((x) => x.id === p.parent), twin = par && pet.parts.find((x) => x.name === par.name.replace(/L$/, '#').replace(/R$/, 'L').replace(/#$/, 'R') && x !== par); if (twin) c.parent = twin.id;
    pet.parts.push(c); apply(); select(c.id); toast('Copie en miroir créée'); };
  $('pdel').onclick = () => { if (pet.parts.length <= 1) return toast('Il faut au moins une pièce'); snapshot(); pet.parts = pet.parts.filter((x) => x.id !== p.id); if (p.name === 'Body' && pet.parts[0]) pet.parts[0].name = 'Body'; selId = null; apply(); renderPane(); };
  $('pdesel').onclick = () => select(null);
  bindSculpt(p);
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
  const [ctrl, fxs, anim, core] = await Promise.all(['kit/ForgePetController.server.lua', 'kit/ForgePetFX.client.lua', 'kit/ForgePetAnim.client.lua', 'kit/ForgeAnimCore.lua'].map((u) => fetch(u, { cache: 'no-cache' }).then((r) => r.text())));
  return (KIT = { ctrl, fxs, anim, core });
}
function configLua() { return `-- Roblox Forge - configuration\nreturn {\n\t-- Pet given to players who have no "ForgePet" attribute\n\tDefaultPet = ${JSON.stringify(safeName(pet.name))},\n\t-- Where the pet floats, relative to the player (right, up, back)\n\tOffset = Vector3.new(3, 1.5, 3),\n}\n`; }
function scriptFiles() {
  return [
    { id: 'ctrl', name: 'ForgePetController.server.lua', where: 'ServerScriptService', text: pet.scripts.ctrl ?? KIT.ctrl },
    { id: 'fxs', name: 'ForgePetFX.client.lua', where: 'StarterPlayerScripts', text: pet.scripts.fxs ?? KIT.fxs },
    { id: 'anim', name: 'ForgePetAnim.client.lua', where: 'StarterPlayerScripts', text: pet.scripts.anim ?? KIT.anim },
    { id: 'core', name: 'ForgeAnimCore.lua', where: 'ReplicatedStorage', text: pet.scripts.core ?? KIT.core },
    { id: 'cfg', name: 'ForgeConfig.lua', where: 'ReplicatedStorage', text: pet.scripts.cfg ?? configLua() },
    { id: 'animdata', name: 'ForgeAnimData.lua', where: 'ReplicatedStorage/ForgePets/' + safeName(pet.name), text: animDataLua(), readonly: true },
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
  const parts = [body, ...pet.parts.filter((p) => p !== body)], names = exportNames();
  const children = parts.map((p) => {
    const isWedge = p.shape === 'Wedge', node = { name: names.get(p.id), className: isWedge ? 'WedgePart' : 'Part', properties: {
      Size: p.shape === 'Ball' ? [p.size[0], p.size[0], p.size[0]] : p.size, CFrame: { CFrame: { position: p.pos, orientation: orientation(p.rot) } },
      Color: rgb(p.color), Material: p.material, Transparency: p.transparency || 0, Anchored: false, CanCollide: false, CastShadow: p.material !== 'Neon',
      TopSurface: 'Smooth', BottomSurface: 'Smooth' }, children: [] };
    if (p.shape === 'Ball') node.properties.Shape = 'Ball';
    if (p.shape === 'Cylinder') node.properties.Shape = 'Cylinder';
    if (p.shape === 'Ellipsoid') node.children.push({ name: 'Mesh', className: 'SpecialMesh', properties: { MeshType: 'Sphere' } });
    if (p.tint || p.weld) node.attributes = { ...(p.tint ? { ForgeTint: true } : {}), ...(p.weld ? { ForgeWeld: true } : {}) };
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
  if ((pet.anims || []).length) children.push({ name: 'ForgeAnimData', className: 'ModuleScript', properties: { Source: animDataLua() } });
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
async function buildPack(blender) {
  await loadKit(); const n = safeName(pet.name), files = scriptFiles(), lib = await LIB.packFiles();
  // Blender job for the Roblox Push robot: HD render (always) and HD mesh uploaded to Roblox (mesh = true)
  const extra = [];
  if (blender) {
    const job = { kind: 'pet', name: n, rarity: pet.rarity, style: pet.gen && pet.gen.style === 'voxel' ? 'voxel' : pet.rarity, mesh: !!blender.mesh, render: 1280, samples: 96,
      parts: pet.parts.filter((p) => p.transparency < 0.95).map((p) => ({ name: p.name, shape: p.shape, size: p.size, pos: p.pos, rot: p.rot, color: p.tint ? pet.c1 : p.color, material: p.material, transparency: p.transparency })) };
    extra.push({ path: `ForgeBlender/${n}.json`, data: JSON.stringify(job) });
    if (blender.mesh) { if (!KIT.hd) KIT.hd = await (await fetch('kit/ForgeHD.server.lua', { cache: 'no-cache' })).text(); extra.push({ path: 'ServerScriptService/ForgeHD.server.lua', data: KIT.hd }); }
  }
  return zip([...lib, ...extra,
    { path: `ReplicatedStorage/ForgePets/${n}.model.json`, data: JSON.stringify(modelJson(), null, 2) },
    { path: 'ReplicatedStorage/ForgeConfig.lua', data: files.find((f) => f.id === 'cfg').text },
    { path: 'ServerScriptService/ForgePetController.server.lua', data: files.find((f) => f.id === 'ctrl').text },
    { path: 'StarterPlayerScripts/ForgePetFX.client.lua', data: files.find((f) => f.id === 'fxs').text },
    { path: 'StarterPlayerScripts/ForgePetAnim.client.lua', data: files.find((f) => f.id === 'anim').text },
    { path: 'ReplicatedStorage/ForgeAnimCore.lua', data: files.find((f) => f.id === 'core').text },
    { path: 'LISEZ-MOI.txt', data: `Pack Roblox Forge : ${pet.name} (${pet.rarity})\n\n- ReplicatedStorage/ForgePets : le modèle du pet (pièces, particules, lumière, contour)\n- ServerScriptService : donne le pet à chaque joueur et le fait suivre\n- StarterPlayerScripts : anime les effets (anneaux, orbes, arc-en-ciel, éclairs…) et les animations (ForgePetAnim)\n- ReplicatedStorage/ForgeAnimCore : les calculs d'animation (courbes, mélange)\n- ReplicatedStorage/ForgeConfig : pet par défaut et position\n\nPour donner un autre pet à un joueur : player:SetAttribute("ForgePet", "NomDuPet")\nPour jouer une animation « Sur commande » : player:SetAttribute("ForgePetAnim", "Danse")\nPublie ce .zip avec Roblox Push (tu peux y ajouter les fichiers de ton jeu).\n` },
  ]);
}
function paneExport() {
  const parts = pet.parts.length, fxOn = FX.filter((f) => pet.fx[f.id].on).map((f) => f.ico + ' ' + f.label);
  pane.innerHTML = `<div class="sec"><h3>${esc(pet.name)} <small>${esc(pet.rarity)}</small></h3>
      <div class="note">${parts} pièces · ${fxOn.length} effets : ${fxOn.join(', ') || 'aucun'}</div>
      <button class="btn pri big" id="toGame">🎮 Ajouter à mon jeu</button>
      <button class="btn big" id="toHD">✨ Version HD Blender dans mon jeu</button>
      <button class="btn big" id="toRender">📸 Rendu HD Blender (image)</button>
      <button class="btn big" id="dl">📦 Télécharger le pack Roblox (.zip)</button>
      <button class="btn big" id="copyModel">⧉ Copier le modèle (JSON Rojo)</button></div>
    <div class="sec"><h3>Mettre le pet dans ton jeu</h3><div class="note">
      <b>🎮 Ajouter à mon jeu</b> ouvre Roblox Push : choisis ton jeu, le pet y est <b>ajouté</b> sans rien effacer, et il reste installé quand tu republies ton jeu.<br>
      Ton jeu doit avoir été publié une fois avec Roblox Push. Chaque joueur reçoit alors ce pet, qui le suit avec tous ses effets.<br><br>
      Contenu : <b>ReplicatedStorage/ForgePets</b> (modèle), <b>ServerScriptService</b> (suivi), <b>StarterPlayerScripts</b> (effets), <b>ForgeConfig</b> (réglages).</div></div>
    <div class="sec"><h3>✨ Blender sur le robot</h3><div class="note">
      <b>Version HD</b> : le robot Roblox Push lance Blender, lisse le pet en un vrai mesh HD, l'envoie sur Roblox et l'ajoute à ton jeu : le pet HD garde ses effets et suit le joueur (les membres ne bougent plus séparément).<br>
      <b>Rendu HD</b> : une belle image studio du pet (éclairage 3 points, profondeur de champ), affichée à la fin dans Roblox Push et gardée dans ton dépôt GitHub.<br>
      Gratuit : Blender tourne sur GitHub Actions. La 1ʳᵉ fois, l'installation prend quelques minutes. Pour un pet voxel, préfère le rendu : le jeu affiche déjà les blocs.</div></div>
    <div class="sec"><h3>Projet</h3><div class="btns"><button class="btn" id="newp">＋ Nouveau pet</button><button class="btn" id="saveCopy">💾 Garder une copie</button></div><div id="saved"></div></div>`;
  const send = async (blender) => {
    const blob = await buildPack(blender); const buf = new Uint8Array(await blob.arrayBuffer()); let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    try { localStorage.setItem('rp2.pendingPack', JSON.stringify({ name: safeName(pet.name) + (blender ? (blender.mesh ? '_HD' : '_Rendu') : ''), label: pet.name + (blender ? (blender.mesh ? ' · HD Blender' : ' · rendu HD') : ''), rarity: pet.rarity, b64: btoa(bin), at: Date.now() })); }
    catch { return toast('Mémoire du navigateur pleine : télécharge plutôt le pack.'); }
    toast(blender ? 'Le robot va lancer Blender (≈ 3 à 6 min la première fois)…' : 'Ouverture de Roblox Push…', 2600); setTimeout(() => (location.href = '../../roblox-push/'), blender ? 1200 : 450);
  };
  $('toGame').onclick = () => send(null);
  $('toHD').onclick = () => send({ mesh: true });
  $('toRender').onclick = () => send({ mesh: false });
  $('dl').onclick = async () => { const blob = await buildPack(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = safeName(pet.name) + '.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Pack téléchargé ✓'); };
  $('copyModel').onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(modelJson(), null, 2)); toast('Modèle copié ✓'); } catch { toast('Copie impossible'); } };
  $('newp').onclick = () => { if (!confirm('Commencer un nouveau pet ? (le pet actuel est remplacé, garde une copie avant)')) return; snapshot(); pet = newPet(); selId = null; save(); rebuild(); setTab('rar'); };
  const lib = Store.get('saved', []);
  $('saved').innerHTML = lib.length ? `<ul class="tree" style="margin-top:8px">${lib.map((s, i) => `<li data-i="${i}"><span class="dot" style="background:${s.c1}"></span>${esc(s.name)}<span class="sh">${esc(s.rarity)} · ouvrir</span></li>`).join('')}</ul>` : '';
  $('saveCopy').onclick = () => { const l = Store.get('saved', []); l.unshift(clone(pet)); Store.set('saved', l.slice(0, 30)); toast('Copie gardée ✓'); paneExport(); };
  pane.querySelectorAll('#saved li').forEach((li) => li.onclick = () => { snapshot(); pet = clone(Store.get('saved', [])[+li.dataset.i]); selId = null; save(); rebuild(); toast('Ouvert : ' + pet.name); });
}

/* =====================================================================
   7. ANIMATION - keyframes per part, bones + pivots, 12 easing curves,
      blending (idle / move / one-shots), onion skin, Luau export.
      Maths in anim-core.js = kit/ForgeAnimCore.lua (same in the game).
   ===================================================================== */
const WHEN = {
  idle: ['💤', 'Au repos', 'Joue en boucle quand le pet flotte.'],
  move: ['🏃', 'En mouvement', 'Se mélange en douceur quand le pet se déplace.'],
  spawn: ['✨', 'Apparition', 'Une fois, quand le pet apparaît.'],
  manual: ['🎯', 'Sur commande', 'Une fois, quand ton script le demande.'],
};
const kf = (t, pos, rot, ease = 'Sine', dir = 'InOut') => ({ t, pos: pos || [0, 0, 0], rot: rot || [0, 0, 0], ease, dir });
// Presets adapt to the body: they animate the parts that exist (Head, Ears, Wings, Tail, Paws, Arms, Wheels…)
function presetBuilder(parts) {
  const tracks = {};
  const find = (m) => parts.filter((p) => (m instanceof RegExp ? m.test(p.name) : p.name === m));
  const A = {
    track(m, keys) { for (const p of find(m)) tracks[p.id] = clone(typeof keys === 'function' ? keys(p) : keys); },
    lr(base, fn) { A.track(new RegExp('^' + base + 'L$'), fn(1)); A.track(new RegExp('^' + base + 'R$'), fn(-1)); },
    has: (m) => find(m).length > 0,
  };
  return { A, tracks };
}
const PRESETS = [
  { id: 'breathe', e: '💤', label: 'Respiration', when: 'idle', length: 2.4, loop: true, build(A) {
    A.track('Body', [kf(0), kf(1.2, [0, 0.07, 0], [-2, 0, 0]), kf(2.4)]);
    A.track('Head', [kf(0), kf(1.35, [0, 0.03, 0], [4, 0, 0]), kf(2.4)]);
    A.lr('Ear', (s) => [kf(0), kf(1.3, null, [0, 0, 7 * s]), kf(2.4)]);
    A.lr('Wing', (s) => [kf(0), kf(1.2, null, [0, 0, -12 * s]), kf(2.4)]);
    A.lr('Arm', () => [kf(0), kf(1.2, null, [8, 0, 0]), kf(2.4)]);
    A.track(/^Tail1?$/, [kf(0), kf(0.6, null, [0, 14, 0]), kf(1.8, null, [0, -14, 0]), kf(2.4)]);
    A.track('Tail2', [kf(0), kf(0.8, null, [0, 18, 0]), kf(2.0, null, [0, -18, 0]), kf(2.4)]);
    A.track('Core', [kf(0), kf(1.2, [0, 0.1, 0]), kf(2.4)]);
    A.track(/^(Antenna|Wisp)$/, [kf(0), kf(1.2, null, [0, 0, 9]), kf(2.4)]);
  } },
  { id: 'hop', e: '🏃', label: 'Sautillement', when: 'move', length: 0.6, loop: true, build(A) {
    A.track('Body', [kf(0, null, null, 'Quad', 'Out'), kf(0.3, [0, 0.45, 0], [-8, 0, 0], 'Quad', 'In'), kf(0.6)]);
    A.track('Head', [kf(0), kf(0.18, null, [-6, 0, 0]), kf(0.45, null, [7, 0, 0]), kf(0.6)]);
    A.lr('Ear', (s) => [kf(0), kf(0.36, null, [-22, 0, 5 * s], 'Back', 'Out'), kf(0.6)]);
    A.lr('Wing', (s) => [kf(0), kf(0.3, null, [0, 0, -40 * s]), kf(0.6)]);
    A.track(/^Paw(FL|FR)$/, [kf(0), kf(0.3, [0, 0.05, 0], [-32, 0, 0]), kf(0.6)]);
    A.track(/^Paw(BL|BR)$/, [kf(0), kf(0.3, [0, 0.05, 0], [28, 0, 0]), kf(0.6)]);
    A.track(/^Foot[LR]$/, [kf(0), kf(0.3, null, [-30, 0, 0]), kf(0.6)]);
    A.lr('Arm', (s) => [kf(0), kf(0.3, null, [0, 0, 18 * s]), kf(0.6)]);
    A.track(/^Wheel[LR]$/, [kf(0, null, null, 'Linear'), kf(0.2, null, [-120, 0, 0], 'Linear'), kf(0.4, null, [-240, 0, 0], 'Linear'), kf(0.6, null, [-360, 0, 0], 'Linear')]);
    A.track(/^Tail1?$/, [kf(0), kf(0.3, null, [22, 0, 0]), kf(0.6)]);
    A.track('Core', [kf(0), kf(0.3, [0, -0.12, 0]), kf(0.6)]);
  } },
  { id: 'flap', e: '🪽', label: 'Battement', when: 'idle', length: 0.8, loop: true, build(A) {
    A.lr('Wing', (s) => [kf(0), kf(0.4, null, [0, 0, -42 * s]), kf(0.8)]);
    A.lr('Ear', (s) => [kf(0), kf(0.4, null, [0, 0, 25 * s]), kf(0.8)]);
    A.lr('Arm', (s) => [kf(0), kf(0.4, null, [0, 0, 35 * s]), kf(0.8)]);
    A.track('Body', [kf(0), kf(0.4, [0, -0.12, 0]), kf(0.8)]);
  } },
  { id: 'look', e: '👀', label: 'Regarde autour', when: 'idle', length: 4, loop: true, build(A) {
    const head = A.has('Head') ? 'Head' : 'Body';
    A.track(head, [kf(0), kf(0.8, null, [0, 35, 4]), kf(1.8, null, [0, 35, 4]), kf(2.6, null, [-4, -35, -4]), kf(3.4, null, [-4, -35, -4]), kf(4)]);
    A.lr('Ear', (s) => [kf(0), kf(0.9, null, [0, 0, 10 * s], 'Back', 'Out'), kf(1.8), kf(2.7, null, [0, 0, -6 * s], 'Back', 'Out'), kf(4)]);
  } },
  { id: 'sleep', e: '😴', label: 'Sommeil', when: 'idle', length: 4, loop: true, build(A) {
    A.track('Body', [kf(0, [0, -0.14, 0], [3, 0, 0]), kf(2, [0, -0.06, 0], [1, 0, 0]), kf(4, [0, -0.14, 0], [3, 0, 0])]);
    A.track('Head', [kf(0, [0, -0.1, 0], [18, 0, 7]), kf(2, [0, -0.06, 0], [14, 0, 7]), kf(4, [0, -0.1, 0], [18, 0, 7])]);
    A.lr('Ear', (s) => [kf(0, null, [30, 0, 12 * s]), kf(4, null, [30, 0, 12 * s])]);
    A.lr('Wing', (s) => [kf(0, null, [0, 0, 20 * s]), kf(4, null, [0, 0, 20 * s])]);
  } },
  { id: 'dance', e: '💃', label: 'Danse', when: 'manual', length: 2, loop: false, build(A) {
    A.track('Body', [kf(0, null, null, 'Back', 'Out'), kf(0.25, [0, 0.3, 0], [0, 0, 12], 'Quad', 'In'), kf(0.5, null, null, 'Back', 'Out'), kf(0.75, [0, 0.3, 0], [0, 0, -12], 'Quad', 'In'),
      kf(1, null, null, 'Back', 'Out'), kf(1.25, [0, 0.2, 0], [0, 35, 0]), kf(1.5), kf(1.75, [0, 0.2, 0], [0, -35, 0]), kf(2)]);
    A.track('Head', [kf(0), kf(0.3, null, [0, 0, -12]), kf(0.55), kf(0.8, null, [0, 0, 12]), kf(1.05), kf(1.3, null, [-8, 0, 0]), kf(2)]);
    A.lr('Ear', (s) => [kf(0), kf(0.25, null, [0, 0, 16 * s], 'Elastic', 'Out'), kf(1), kf(1.25, null, [0, 0, 16 * s], 'Elastic', 'Out'), kf(2)]);
    A.lr('Arm', (s) => [kf(0), kf(0.25, null, [0, 0, 60 * s]), kf(0.5), kf(0.75, null, [0, 0, 60 * s]), kf(1), kf(2)]);
    A.lr('Wing', (s) => [kf(0), kf(0.5, null, [0, 0, -45 * s]), kf(1), kf(1.5, null, [0, 0, -45 * s]), kf(2)]);
  } },
  { id: 'victory', e: '🏆', label: 'Victoire', when: 'manual', length: 1.6, loop: false, build(A) {
    A.track('Body', [kf(0, null, null, 'Quad', 'Out'), kf(0.2, [0, -0.2, 0], [10, 0, 0], 'Quad', 'Out'), kf(0.55, [0, 1.4, 0], [0, 120, 0], 'Linear'),
      kf(0.75, [0, 1.6, 0], [0, 240, 0], 'Quad', 'In'), kf(1.05, [0, 0, 0], [0, 360, 0], 'Bounce', 'Out'), kf(1.6, [0, 0, 0], [0, 360, 0])]);
    A.lr('Ear', (s) => [kf(0), kf(0.55, null, [-25, 0, 10 * s]), kf(1.05, null, [15, 0, 0], 'Elastic', 'Out'), kf(1.6)]);
    A.lr('Arm', (s) => [kf(0), kf(0.5, null, [0, 0, 80 * s]), kf(1.2, null, [0, 0, 80 * s]), kf(1.6)]);
    A.lr('Wing', (s) => [kf(0), kf(0.3, null, [0, 0, -50 * s]), kf(0.6), kf(0.9, null, [0, 0, -50 * s]), kf(1.6)]);
  } },
  { id: 'spawn', e: '✨', label: 'Apparition', when: 'spawn', length: 1.2, loop: false, build(A) {
    A.track('Body', [kf(0, [0, -2.2, 0], [0, -170, 0], 'Back', 'Out'), kf(0.8), kf(1.2)]);
    A.track('Head', [kf(0, null, [25, 0, 0]), kf(0.45, null, [25, 0, 0], 'Elastic', 'Out'), kf(1.2)]);
    A.lr('Ear', (s) => [kf(0, null, [0, 0, -30 * s]), kf(0.5, null, [0, 0, -30 * s], 'Elastic', 'Out'), kf(1.2)]);
    A.lr('Wing', (s) => [kf(0, null, [0, 0, 40 * s]), kf(0.5, null, [0, 0, 40 * s], 'Elastic', 'Out'), kf(1.2)]);
  } },
  { id: 'attack', e: '⚔️', label: 'Attaque', when: 'manual', length: 0.9, loop: false, build(A) {
    A.track('Body', [kf(0, null, null, 'Quad', 'Out'), kf(0.3, [0, 0.1, 0.5], [10, 0, 0], 'Quad', 'In'), kf(0.42, [0, 0, -1.2], [-14, 0, 0], 'Elastic', 'Out'), kf(0.9)]);
    A.track('Head', [kf(0), kf(0.3, null, [8, 0, 0]), kf(0.42, null, [-14, 0, 0], 'Elastic', 'Out'), kf(0.9)]);
    A.lr('Ear', (s) => [kf(0), kf(0.3, null, [25, 0, 0]), kf(0.45, null, [-30, 0, 8 * s], 'Back', 'Out'), kf(0.9)]);
    A.lr('Arm', (s) => [kf(0), kf(0.3, null, [40, 0, 0]), kf(0.42, null, [-70, 0, 0], 'Back', 'Out'), kf(0.9)]);
  } },
];
function makeClip(presetId, parts) {
  const pr = PRESETS.find((p) => p.id === presetId);
  const { A, tracks } = presetBuilder(parts); pr.build(A);
  return { id: 'a' + nid(), name: pr.label, when: pr.when, length: pr.length, loop: pr.loop, speed: 1, tracks };
}
function defaultAnims(parts) {
  const winged = parts.some((p) => /^Wing[LR]$/.test(p.name)); // dragons breathe with their wings
  return [makeClip(winged ? 'flap' : 'breathe', parts), makeClip('hop', parts), makeClip('dance', parts), makeClip('spawn', parts)];
}
function ensureAnims() {
  if (!Array.isArray(pet.anims)) { pet.anims = defaultAnims(pet.parts); pet.animSel = pet.anims[0].id; }
  const ids = new Set(pet.parts.map((p) => p.id));
  for (const c of pet.anims) for (const id of Object.keys(c.tracks || {})) if (!ids.has(id) || !c.tracks[id].length) delete c.tracks[id];
  if (!pet.anims.some((c) => c.id === pet.animSel)) pet.animSel = pet.anims[0] ? pet.anims[0].id : null;
}
const anim = { playing: false, time: 0, zoom: 1, pan: 0, snap: true, onion: true, bones: true, selKey: null, clip: null, lastEase: ['Sine', 'InOut'], previewT: 0, moveW: 0, shot: null, dirty: true };
const curClip = () => (pet.anims || []).find((c) => c.id === pet.animSel) || null;
const snapT = (t) => (anim.snap ? Math.round(t / 0.05) * 0.05 : Math.round(t * 1000) / 1000);
const partIds = () => pet.parts.map((p) => p.id);
let RIG = null; const getRig = () => (rigDirty || !RIG ? ((rigDirty = false), (RIG = AC.rigOf(pet.parts))) : RIG);
function setKey(clip, id, t, v) {
  const keys = clip.tracks[id] || (clip.tracks[id] = []);
  let k = keys.find((x) => Math.abs(x.t - t) < 1e-3);
  if (!k) { k = kf(+t.toFixed(3), null, null, anim.lastEase[0], anim.lastEase[1]); keys.push(k); keys.sort((a, b) => a.t - b.t); }
  k.pos = v.pos.slice(); k.rot = v.rot.slice(); return k;
}
function offsetsAt(clip, t) { return AC.blend([{ clip: { tracks: clip.tracks, length: clip.length, loop: false }, t, w: 1 }], partIds); }
// What the viewport shows: rest pose while building parts, the edited clip in the Animation tab,
// and the same blend as the game everywhere else (idle + move when you press 🚶, one-shots on ▶ Tester).
function displayOffsets(dt) {
  if (currentTab === 'parts' || !pet.anims || !pet.anims.length) return new Map();
  if (currentTab === 'anim') { const c = curClip(); return c ? offsetsAt(c, anim.time) : new Map(); }
  anim.previewT += dt; anim.moveW += ((walking ? 1 : 0) - anim.moveW) * Math.min(1, dt * 6);
  const idle = pet.anims.find((c) => c.when === 'idle'), move = pet.anims.find((c) => c.when === 'move');
  const layers = [];
  if (idle) layers.push({ clip: idle, t: anim.previewT * (idle.speed || 1), w: move ? 1 - anim.moveW : 1 });
  if (move && anim.moveW > 0.001) layers.push({ clip: move, t: anim.previewT * (move.speed || 1), w: anim.moveW });
  if (anim.shot) { const s = anim.shot, len = Math.max(0.05, s.clip.length) / (s.clip.speed || 1); s.t += dt; const left = len - s.t;
    if (left <= 0) anim.shot = null; else layers.push({ clip: s.clip, t: s.t * (s.clip.speed || 1), w: s.clip.when === 'spawn' ? Math.min(1, left / 0.18) : Math.min(1, s.t / 0.18, left / 0.18), over: true }); }
  return AC.blend(layers, partIds);
}
let lastPose = new Map();
const _s1 = new THREE.Vector3();
function applyPose(dt) {
  const R = getRig(); const offs = displayOffsets(dt);
  lastPose = AC.computePose(pet.parts, R, offs);
  const dragged = gizmo.dragging ? gizmo.object : null;
  for (const p of pet.parts) {
    const m = meshes.get(p.id), ps = lastPose.get(p.id); if (!m || !ps) continue;
    if (m !== dragged) ps.M.decompose(m.position, m.quaternion, _s1);
    const o = outlineMeshes.get(p.id); if (o) { o.position.copy(m.position); o.quaternion.copy(m.quaternion); }
  }
  updateBones(R); updateOnion(R);
}
/* ---------- bones overlay (pivots + links, like an armature) ---------- */
const boneGeo = new THREE.BufferGeometry(); boneGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 6), 3));
const bones = new THREE.LineSegments(boneGeo, new THREE.LineBasicMaterial({ color: 0x8fe9ff, transparent: true, opacity: 0.55, depthTest: false }));
bones.renderOrder = 10; partGroup.add(bones);
const jointGeo = new THREE.BufferGeometry(); jointGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3));
const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.32, '#ffffff'); gr.addColorStop(0.42, 'rgba(143,233,255,.9)'); gr.addColorStop(1, 'rgba(62,230,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const joints = new THREE.Points(jointGeo, new THREE.PointsMaterial({ map: dotTex, size: 13, sizeAttenuation: false, depthTest: false, transparent: true, depthWrite: false }));
joints.renderOrder = 11; partGroup.add(joints);
const pivotMark = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), new THREE.MeshBasicMaterial({ color: 0xffd45c, depthTest: false }));
pivotMark.renderOrder = 12; partGroup.add(pivotMark);
const _pv = new THREE.Vector3(), _pp = new THREE.Vector3();
function bonePoint(R, id, out) { const info = R.rig.get(id), ps = lastPose.get(id); return out.set(...info.pivot).applyMatrix4(ps.G); }
function updateBones(R) {
  const show = currentTab === 'anim' && anim.bones; bones.visible = joints.visible = show; pivotMark.visible = currentTab === 'anim' && !!selId && lastPose.has(selId);
  if (pivotMark.visible) { bonePoint(R, selId, pivotMark.position); pivotMark.rotation.y += 0.04; }
  if (!show) return;
  const lp = boneGeo.attributes.position.array, jp = jointGeo.attributes.position.array; let n = 0, j = 0;
  for (const id of R.order) { if (j >= 64) break; const info = R.rig.get(id); bonePoint(R, id, _pv); jp.set([_pv.x, _pv.y, _pv.z], j * 3); j++;
    if (info.parent && n < 64) { bonePoint(R, info.parent, _pp); lp.set([_pp.x, _pp.y, _pp.z, _pv.x, _pv.y, _pv.z], n * 6); n++; } }
  boneGeo.setDrawRange(0, n * 2); jointGeo.setDrawRange(0, j); boneGeo.attributes.position.needsUpdate = true; jointGeo.attributes.position.needsUpdate = true;
  boneGeo.computeBoundingSphere(); jointGeo.computeBoundingSphere();
}
/* ---------- onion skin: the selected part at its previous and next keys ---------- */
const ghosts = [0x5cb8ff, 0xffa64d].map((c) => { const g = new THREE.Mesh(GEO.Block, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.28, depthWrite: false })); g.visible = false; partGroup.add(g); return g; });
function updateOnion(R) {
  ghosts.forEach((g) => (g.visible = false));
  const c = curClip(); if (currentTab !== 'anim' || !anim.onion || !c || !selId || !c.tracks[selId]) return;
  const keys = c.tracks[selId], p = pet.parts.find((x) => x.id === selId); if (!p) return;
  const prev = [...keys].reverse().find((k) => k.t < anim.time - 1e-3), next = keys.find((k) => k.t > anim.time + 1e-3);
  [prev, next].forEach((k, i) => { if (!k) return; const g = ghosts[i]; const pose = AC.computePose(pet.parts, R, offsetsAt(c, k.t)).get(selId);
    g.geometry = GEO[p.shape] || GEO.Block; pose.M.decompose(g.position, g.quaternion, _s1); g.scale.fromArray(p.size); g.visible = true; });
}
/* ---------- gizmo -> keys (auto-key, like Blender with the record button on) ---------- */
function animGizmoChange(m) {
  const c = curClip(); if (!c) return;
  const Mw = new THREE.Matrix4().compose(m.position, m.quaternion, new THREE.Vector3(1, 1, 1));
  const v = AC.offsetFromPose(pet.parts, getRig(), lastPose, m.userData.id, Mw);
  anim.selKey = setKey(c, m.userData.id, snapT(anim.time), v); anim.dirty = true;
}
/* ---------- easing curve drawings ---------- */
function curvePath(style, dir, w, h, pad = 3) {
  const N = 48, ys = []; for (let i = 0; i <= N; i++) ys.push(AC.ease(style, dir, i / N));
  const lo = Math.min(0, ...ys), hi = Math.max(1, ...ys), sy = (h - pad * 2) / (hi - lo);
  return ys.map((y, i) => `${i ? 'L' : 'M'}${(pad + (i / N) * (w - pad * 2)).toFixed(1)},${(h - pad - (y - lo) * sy).toFixed(1)}`).join('');
}
/* ---------- the pane ---------- */
function clipChips() { return pet.anims.map((x) => `<button class="chip${x.id === pet.animSel ? ' on' : ''}" data-clip="${x.id}">${WHEN[x.when][0]} ${esc(x.name)}</button>`).join(''); }
function paneAnim() {
  ensureAnims(); const c = curClip(); if (c) anim.time = Math.max(0, Math.min(anim.time, c.length));
  if (gizmo.getMode() === 'scale') setGizmoMode('translate');
  pane.innerHTML = `<div class="sec anim">
      <div class="clips" id="clips">${clipChips()}<button class="chip add" id="clipNew">＋ Nouvelle</button></div>
      ${c ? `<div class="transport">
        <button class="ib" id="aStart" title="Début">⏮</button><button class="ib play${anim.playing ? ' on' : ''}" id="aPlay" title="Lecture">${anim.playing ? '⏸' : '▶'}</button><button class="ib" id="aEnd" title="Fin">⏭</button>
        <div class="tc"><b id="aTime">0.00</b><small>/ ${(+c.length).toFixed(2)} s</small></div>
        <button class="ib${anim.snap ? ' on' : ''}" id="aSnap" title="Aimant 0,05 s">🧲</button><button class="ib${anim.onion ? ' on' : ''}" id="aOnion" title="Pelures d'oignon">🧅</button><button class="ib${anim.bones ? ' on' : ''}" id="aBones" title="Os">🦴</button>
      </div>
      <div class="dope" id="dope"><div class="dhead"><div class="dcorner">◆ clés</div><div class="ruler" id="ruler"></div></div>
        <div class="dbody" id="dbody"><div class="dnames" id="dnames"></div><div class="dtrack" id="dtrack"></div></div>
        <div class="phead" id="phead"><i></i></div></div>
      <div class="zoomrow"><span>🔍</span><input type="range" id="aZoom" min="1" max="8" step="0.1" value="${anim.zoom}"><span>↔</span><input type="range" id="aPan" min="0" max="1" step="0.001" value="${anim.pan}" ${anim.zoom > 1 ? '' : 'disabled'}></div>
      <div class="btns keybar"><button class="btn pri" id="aKey">◆ Clé</button><button class="btn" id="aKeyAll">◆ Toutes</button><button class="btn" id="aPrev">⇤</button><button class="btn" id="aNext">⇥</button><button class="btn" id="aTest">▶ Tester comme en jeu</button></div>
      <div class="note tip">Touche une pièce (ou sa ligne), place la tête de lecture, puis bouge / tourne la pièce : une <b>clé</b> est créée toute seule. Les enfants suivent leur parent (os 🦴).</div>`
      : '<div class="note">Aucune animation. Choisis un modèle ci-dessous ou ＋ Nouvelle.</div>'}
    </div>
    <div id="keyInsp"></div><div id="boneInsp"></div>
    ${c ? `<div class="sec"><h3>Animation <small>${WHEN[c.when][2]}</small></h3>
      <div class="row"><label>Nom</label><input type="text" id="cName" value="${esc(c.name)}" maxlength="30"></div>
      <div class="row"><label>Quand</label><select id="cWhen">${Object.entries(WHEN).map(([k, v]) => `<option value="${k}"${k === c.when ? ' selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select></div>
      <div class="row"><label>Durée (s)</label><input type="number" id="cLen" min="0.1" max="30" step="0.1" value="${c.length}"><button class="btn" id="cStretch" title="Étirer les clés à la nouvelle durée">⇔ Étirer</button></div>
      <div class="row"><label>Vitesse</label><input type="range" id="cSpeed" min="0.25" max="3" step="0.05" value="${c.speed || 1}"><span class="val" id="cSpeedV">×${(c.speed || 1).toFixed(2)}</span></div>
      <div class="row"><label>En boucle</label><button class="sw${c.loop ? ' on' : ''}" id="cLoop"></button></div>
      <div class="btns"><button class="btn" id="cDup">⧉ Dupliquer</button><button class="btn" id="cMirror">⇋ Miroir G↔D</button><button class="btn" id="cRev">⇆ À l'envers</button><button class="btn danger" id="cDel">🗑 Supprimer</button></div>
      ${c.when === 'manual' ? `<div class="note" style="margin-top:8px">Dans ton jeu : <code class="inl">player:SetAttribute("ForgePetAnim", "${esc(c.name)}")</code></div>` : ''}</div>` : ''}
    <div class="sec"><h3>Modèles <small>s'adaptent au corps du pet</small></h3><div class="grid2">${PRESETS.map((p) => `<button class="preset" data-preset="${p.id}"><span class="e">${p.e}</span>${p.label}<small class="pw">${WHEN[p.when][1]}</small></button>`).join('')}</div></div>`;
  pane.querySelectorAll('[data-clip]').forEach((b) => b.onclick = () => { pet.animSel = b.dataset.clip; anim.time = 0; anim.playing = false; anim.selKey = null; save(); paneAnim(); });
  $('clipNew').onclick = () => { snapshot(); const n = { id: 'a' + nid(), name: 'Anim ' + (pet.anims.length + 1), when: 'manual', length: 1.5, loop: false, speed: 1, tracks: {} }; pet.anims.push(n); pet.animSel = n.id; anim.time = 0; save(); paneAnim(); toast('Nouvelle animation : place des clés ◆'); };
  pane.querySelectorAll('[data-preset]').forEach((b) => b.onclick = () => { snapshot(); const n = makeClip(b.dataset.preset, pet.parts);
    if (!Object.keys(n.tracks).length) return toast('Ce corps n\'a pas les pièces pour ce modèle');
    let name = n.name, i = 2; while (pet.anims.some((x) => x.name === name)) name = n.name + ' ' + i++; n.name = name;
    pet.anims.push(n); pet.animSel = n.id; anim.time = 0; anim.playing = true; save(); paneAnim(); toast(PRESETS.find((p) => p.id === b.dataset.preset).e + ' ' + n.name + ' ajoutée'); });
  if (!c) return;
  $('aPlay').onclick = () => { anim.playing = !anim.playing; if (anim.playing && anim.time >= c.length - 1e-3) anim.time = 0; syncPlay(); };
  $('aStart').onclick = () => { anim.time = 0; anim.playing = false; syncPlay(); };
  $('aEnd').onclick = () => { anim.time = c.length; anim.playing = false; syncPlay(); };
  $('aSnap').onclick = () => { anim.snap = !anim.snap; $('aSnap').classList.toggle('on', anim.snap); toast(anim.snap ? 'Aimant : 0,05 s' : 'Aimant coupé'); };
  $('aOnion').onclick = () => { anim.onion = !anim.onion; $('aOnion').classList.toggle('on', anim.onion); toast(anim.onion ? 'Pelures d\'oignon : clé d\'avant (bleu) et d\'après (orange)' : 'Pelures d\'oignon coupées'); };
  $('aBones').onclick = () => { anim.bones = !anim.bones; $('aBones').classList.toggle('on', anim.bones); };
  $('aZoom').oninput = (e) => { anim.zoom = +e.target.value; $('aPan').disabled = anim.zoom <= 1; renderDope(); };
  $('aPan').oninput = (e) => { anim.pan = +e.target.value; renderDope(); };
  $('aKey').onclick = () => { if (!selId) return toast('Touche d\'abord une pièce'); snapshot(); keyPart(c, selId); };
  $('aKeyAll').onclick = () => { snapshot(); const ids = new Set([...Object.keys(c.tracks), ...(selId ? [selId] : [])]); if (!ids.size) pet.parts.forEach((p) => ids.add(p.id)); ids.forEach((id) => keyPart(c, id, true)); toast(ids.size + ' clés posées à ' + anim.time.toFixed(2) + ' s'); };
  $('aPrev').onclick = () => jumpKey(c, -1); $('aNext').onclick = () => jumpKey(c, 1);
  $('aTest').onclick = () => { anim.shot = { clip: c, t: 0 }; anim.previewT = 0; setTab('fx'); toast('Aperçu comme dans le jeu (retour : onglet 🎬)'); };
  let sn = false; const once = () => { if (!sn) { snapshot(); sn = true; } };
  $('cName').oninput = (e) => { once(); c.name = e.target.value.replace(/[\u0000-\u001f"\\]/g, '').trim() || 'Anim'; save(); const chip = pane.querySelector(`[data-clip="${c.id}"]`); if (chip) chip.textContent = WHEN[c.when][0] + ' ' + c.name; };
  $('cWhen').onchange = (e) => { once(); c.when = e.target.value; if (c.when === 'idle' || c.when === 'move') c.loop = true; save(); paneAnim(); };
  $('cLen').onchange = (e) => { once(); const v = Math.max(0.1, Math.min(30, +e.target.value || 1)); c.length = +v.toFixed(2); anim.time = Math.min(anim.time, c.length); save(); paneAnim(); };
  $('cStretch').onclick = () => { const v = Math.max(0.1, Math.min(30, +$('cLen').value || 1)); const maxT = Math.max(0, ...Object.values(c.tracks).flat().map((k) => k.t)); if (!maxT) return;
    snapshot(); const f = v / maxT; for (const keys of Object.values(c.tracks)) keys.forEach((k) => (k.t = +(k.t * f).toFixed(3))); c.length = +v.toFixed(2); save(); paneAnim(); toast('Clés étirées ×' + f.toFixed(2)); };
  $('cSpeed').oninput = (e) => { once(); c.speed = +e.target.value; $('cSpeedV').textContent = '×' + c.speed.toFixed(2); save(); };
  $('cLoop').onclick = () => { once(); c.loop = !c.loop; $('cLoop').classList.toggle('on', c.loop); save(); };
  $('cDup').onclick = () => { snapshot(); const d = { ...clone(c), id: 'a' + nid(), name: c.name + ' copie' }; pet.anims.push(d); pet.animSel = d.id; save(); paneAnim(); };
  $('cMirror').onclick = () => { snapshot(); mirrorClip(c); save(); renderDope(); renderInspectors(); toast('Gauche et droite échangées'); };
  $('cRev').onclick = () => { snapshot(); for (const keys of Object.values(c.tracks)) { const L = c.length; keys.forEach((k) => (k.t = +(L - k.t).toFixed(3))); keys.sort((a, b) => a.t - b.t); } save(); renderDope(); toast('Animation inversée'); };
  $('cDel').onclick = () => { if (!confirm('Supprimer l\'animation « ' + c.name + ' » ?')) return; snapshot(); pet.anims = pet.anims.filter((x) => x !== c); pet.animSel = pet.anims[0] ? pet.anims[0].id : null; anim.selKey = null; save(); paneAnim(); };
  setupDope(c); renderDope(); renderInspectors(); syncPlay();
}
function syncPlay() { const b = $('aPlay'); if (b) { b.textContent = anim.playing ? '⏸' : '▶'; b.classList.toggle('on', anim.playing); } updatePlayhead(); }
function keyPart(c, id, quiet) {
  const ps = lastPose.get(id); if (!ps) return;
  const v = AC.offsetFromPose(pet.parts, getRig(), lastPose, id, ps.M);
  anim.selKey = setKey(c, id, snapT(anim.time), v); save(); renderDope(); renderInspectors(); if (!quiet) toast('◆ Clé à ' + anim.time.toFixed(2) + ' s');
}
function jumpKey(c, dir) {
  const ts = [...new Set(Object.entries(c.tracks).filter(([id]) => !selId || id === selId).flatMap(([, ks]) => ks.map((k) => k.t)))].sort((a, b) => a - b);
  const t = dir < 0 ? [...ts].reverse().find((x) => x < anim.time - 1e-3) : ts.find((x) => x > anim.time + 1e-3);
  if (t == null) return; anim.time = t; anim.playing = false;
  if (selId && c.tracks[selId]) anim.selKey = c.tracks[selId].find((k) => Math.abs(k.t - t) < 1e-3) || null;
  syncPlay(); renderDope(); renderInspectors();
}
function mirrorClip(c) {
  const byName = new Map(pet.parts.map((p) => [p.name, p])), done = new Set(), out = {};
  const flip = (keys) => keys.map((k) => ({ ...clone(k), pos: [-k.pos[0], k.pos[1], k.pos[2]], rot: [k.rot[0], -k.rot[1], -k.rot[2]] }));
  for (const p of pet.parts) {
    if (done.has(p.id)) continue; const m = /^(.*?)(L|R)$/.exec(p.name), twin = m && byName.get(m[1] + (m[2] === 'L' ? 'R' : 'L'));
    if (twin) { if (c.tracks[p.id]) out[twin.id] = flip(c.tracks[p.id]); if (c.tracks[twin.id]) out[p.id] = flip(c.tracks[twin.id]); done.add(twin.id); }
    else if (c.tracks[p.id]) out[p.id] = flip(c.tracks[p.id]);
    done.add(p.id);
  }
  c.tracks = out;
}
/* ---------- dope sheet (rows = bones, diamonds = keys) ---------- */
const NAMES_W = 104;
function trackW() { const el = $('dtrack'); return el ? el.clientWidth : 200; }
function tToX(c, t) { const W = trackW(), full = W * anim.zoom; return (t / c.length) * full - anim.pan * (full - W); }
function xToT(c, x) { const W = trackW(), full = W * anim.zoom; return Math.max(0, Math.min(c.length, ((x + anim.pan * (full - W)) / full) * c.length)); }
function renderDope() {
  const c = curClip(), dn = $('dnames'), dt = $('dtrack'), ru = $('ruler'); if (!c || !dn) return;
  anim.dirty = false; const R = getRig(), W = trackW();
  dn.innerHTML = R.order.map((id) => { const p = pet.parts.find((x) => x.id === id), d = R.rig.get(id).depth, has = !!c.tracks[id];
    return `<div class="dn${id === selId ? ' on' : ''}${has ? ' has' : ''}" data-row="${id}" style="padding-left:${6 + Math.min(d, 5) * 9}px">${d ? '<i>└</i>' : ''}${esc(p.name)}</div>`; }).join('');
  dt.innerHTML = R.order.map((id) => { const keys = c.tracks[id] || [];
    let h = `<div class="dr${id === selId ? ' on' : ''}" data-row="${id}">`;
    for (let i = 0; i < keys.length - 1; i++) { const a = tToX(c, keys[i].t), b = tToX(c, keys[i + 1].t); if (b < 0 || a > W) continue; const same = JSON.stringify([keys[i].pos, keys[i].rot]) === JSON.stringify([keys[i + 1].pos, keys[i + 1].rot]);
      h += `<b class="seg${same ? ' hold' : ''}" style="left:${a}px;width:${Math.max(0, b - a)}px"></b>`; }
    keys.forEach((k, i) => { const x = tToX(c, k.t); if (x < -8 || x > W + 8) return; h += `<i class="kd e-${k.ease}${k === anim.selKey ? ' on' : ''}" data-id="${id}" data-k="${i}" style="left:${x}px"></i>`; });
    return h + '</div>'; }).join('');
  // ruler: label step adapts to zoom
  const pps = (W * anim.zoom) / c.length, step = [0.05, 0.1, 0.25, 0.5, 1, 2, 5].find((s) => s * pps >= 44) || 5; let r = '';
  for (let t = 0; t <= c.length + 1e-6; t += step / 5) { const x = tToX(c, t); if (x < -2 || x > W + 2) continue; const major = Math.abs(t / step - Math.round(t / step)) < 1e-6;
    r += `<i class="tk${major ? ' mj' : ''}" style="left:${x}px">${major ? `<span>${+t.toFixed(2)}</span>` : ''}</i>`; }
  ru.innerHTML = r + `<i class="endmark" style="left:${tToX(c, c.length)}px"></i>`;
  updatePlayhead();
}
function updatePlayhead() {
  const c = curClip(), ph = $('phead'), tx = $('aTime'); if (!c || !ph) return;
  const x = tToX(c, anim.time); ph.style.transform = `translateX(${NAMES_W + x}px)`; ph.style.opacity = x < -1 || x > trackW() + 1 ? 0 : 1; if (tx) tx.textContent = anim.time.toFixed(2);
}
function setupDope(c) {
  const dope = $('dope'); let drag = null;
  const local = (e) => { const r = $('dtrack').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, inTrack: e.clientX >= r.left }; };
  dope.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('[data-row]'), kd = e.target.closest('.kd');
    if (row && !kd && e.target.closest('#dnames')) { select(row.dataset.row); return; }
    const L = local(e); if (!L.inTrack) return;
    anim.playing = false; syncPlay();
    if (kd) { const keys = c.tracks[kd.dataset.id], k = keys[+kd.dataset.k]; if (selId !== kd.dataset.id) select(kd.dataset.id);
      anim.selKey = k; anim.time = k.t; drag = { kind: 'key', k, keys, x0: L.x, t0: k.t, moved: false }; }
    else { if (row && row.dataset.row !== selId) select(row.dataset.row); drag = { kind: 'scrub' }; anim.time = snapT(xToT(c, L.x)); }
    dope.setPointerCapture(e.pointerId); renderDope(); renderInspectors();
  });
  dope.addEventListener('pointermove', (e) => { if (!drag) return; const L = local(e);
    if (drag.kind === 'scrub') { anim.time = snapT(xToT(c, L.x)); updatePlayhead(); autoPan(c, L.x); return; }
    if (!drag.moved && Math.abs(L.x - drag.x0) < 6) return;
    if (!drag.moved) { snapshot(); drag.moved = true; }
    const t = snapT(Math.max(0, Math.min(c.length, drag.t0 + xToT(c, L.x) - xToT(c, drag.x0))));
    if (drag.keys.some((k) => k !== drag.k && Math.abs(k.t - t) < 1e-3)) return; // never stack two keys
    drag.k.t = +t.toFixed(3); drag.keys.sort((a, b) => a.t - b.t); anim.time = drag.k.t; renderDope(); });
  const end = () => { if (drag && drag.moved) { save(); renderInspectors(); } drag = null; };
  dope.addEventListener('pointerup', end); dope.addEventListener('pointercancel', end);
}
function autoPan(c, x) { if (anim.zoom <= 1) return; const W = trackW(); if (x > W - 20) anim.pan = Math.min(1, anim.pan + 0.01); else if (x < 20) anim.pan = Math.max(0, anim.pan - 0.01); else return; const p = $('aPan'); if (p) p.value = anim.pan; renderDope(); }
/* ---------- inspectors: selected key + selected bone ---------- */
function renderInspectors() { renderKeyInsp(); renderBoneInsp(); }
function renderKeyInsp() {
  const box = $('keyInsp'), c = curClip(); if (!box) return;
  const keys = c && selId && c.tracks[selId], k = keys && keys.includes(anim.selKey) ? anim.selKey : null;
  if (!k) { box.innerHTML = ''; return; }
  const i = keys.indexOf(k), last = i === keys.length - 1;
  box.innerHTML = `<div class="sec"><h3>◆ Clé ${i + 1}/${keys.length} <small>${esc(pet.parts.find((p) => p.id === selId).name)} · ${k.t.toFixed(2)} s</small></h3>
    <div class="note" style="margin-bottom:6px">${last ? 'Dernière clé : la pièce reste dans cette pose.' : `Courbe jusqu'à la clé suivante (${keys[i + 1].t.toFixed(2)} s) :`}</div>
    ${last ? '' : `<svg class="bigcurve" viewBox="0 0 300 92" preserveAspectRatio="none"><path d="${curvePath(k.ease, k.dir, 300, 92, 8)}"/></svg>
    <div class="eases">${AC.EASES.map((e) => `<button class="ez${e === k.ease ? ' on' : ''}" data-ease="${e}"><svg viewBox="0 0 40 26"><path d="${curvePath(e, k.dir, 40, 26, 3)}"/></svg>${AC.EASE_FR[e]}</button>`).join('')}</div>
    <div class="seg3">${AC.DIRS.map((d) => `<button data-dir="${d}" class="${d === k.dir ? 'on' : ''}">${AC.DIR_FR[d]}</button>`).join('')}</div>`}
    <div class="row"><label>Temps (s)</label><input type="number" id="kT" step="0.05" min="0" max="${c.length}" value="${k.t}"></div>
    ${vecRow('Décalage', 'kpos', k.pos, 0.05)}${vecRow('Rotation°', 'krot', k.rot, 5)}
    <div class="btns"><button class="btn" id="kCopy">⧉ Copier</button><button class="btn" id="kPaste"${anim.clipboard ? '' : ' disabled'}>📋 Coller ici</button><button class="btn" id="kZero">⟲ Pose de repos</button><button class="btn danger" id="kDel">🗑 Supprimer</button></div></div>`;
  let sn = false; const once = () => { if (!sn) { snapshot(); sn = true; } };
  box.querySelectorAll('[data-ease]').forEach((b) => b.onclick = () => { once(); k.ease = b.dataset.ease; anim.lastEase = [k.ease, k.dir]; save(); renderKeyInsp(); renderDope(); });
  box.querySelectorAll('[data-dir]').forEach((b) => b.onclick = () => { once(); k.dir = b.dataset.dir; anim.lastEase = [k.ease, k.dir]; save(); renderKeyInsp(); });
  $('kT').onchange = (e) => { const t = snapT(Math.max(0, Math.min(c.length, +e.target.value || 0))); if (keys.some((x) => x !== k && Math.abs(x.t - t) < 1e-3)) return toast('Il y a déjà une clé à ce temps'); once(); k.t = t; keys.sort((a, b) => a.t - b.t); anim.time = t; save(); renderDope(); renderKeyInsp(); };
  box.querySelectorAll('[data-vec]').forEach((v) => v.querySelectorAll('input').forEach((inp) => inp.onchange = () => { const n = parseFloat(inp.value); if (!isFinite(n)) return; once(); (v.dataset.vec === 'kpos' ? k.pos : k.rot)[+inp.dataset.i] = n; save(); renderDope(); }));
  $('kCopy').onclick = () => { anim.clipboard = { pos: k.pos.slice(), rot: k.rot.slice(), ease: k.ease, dir: k.dir }; toast('Pose copiée'); renderKeyInsp(); };
  $('kPaste').onclick = () => { if (!anim.clipboard) return; snapshot(); const nk = setKey(c, selId, snapT(anim.time), anim.clipboard); nk.ease = anim.clipboard.ease; nk.dir = anim.clipboard.dir; anim.selKey = nk; save(); renderDope(); renderKeyInsp(); toast('Pose collée à ' + anim.time.toFixed(2) + ' s'); };
  $('kZero').onclick = () => { snapshot(); k.pos = [0, 0, 0]; k.rot = [0, 0, 0]; save(); renderDope(); renderKeyInsp(); };
  $('kDel').onclick = () => { snapshot(); keys.splice(keys.indexOf(k), 1); if (!keys.length) delete c.tracks[selId]; anim.selKey = null; save(); renderDope(); renderInspectors(); };
}
function renderBoneInsp() {
  const box = $('boneInsp'), c = curClip(); if (!box) return;
  const p = pet.parts.find((x) => x.id === selId); if (!p || !c) { box.innerHTML = ''; return; }
  const R = getRig(), info = R.rig.get(p.id), body = AC.bodyOf(pet.parts);
  const desc = new Set([p.id]); let grew = true; while (grew) { grew = false; for (const [id, inf] of R.rig) if (!desc.has(id) && desc.has(inf.parent)) { desc.add(id); grew = true; } }
  const rel = info.pivot.map((v, i) => +(v - p.pos[i]).toFixed(3));
  box.innerHTML = `<div class="sec"><h3>🦴 ${esc(p.name)} <small>${c.tracks[p.id] ? c.tracks[p.id].length + ' clés' : 'pas encore animée'}</small></h3>
    ${p === body ? '<div class="note">Le corps est la racine : tout le pet le suit.</div>' : `<div class="row"><label>Attaché à</label><select id="bPar">${pet.parts.filter((x) => !desc.has(x.id)).map((x) => `<option value="${x.id}"${x.id === info.parent ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>`}
    ${vecRow('Pivot', 'bpv', rel, 0.05)}
    <div class="note" style="margin:-2px 0 8px">Point autour duquel la pièce tourne (◆ jaune dans la vue), par rapport à son centre. ${info.autoPivot ? 'Placé automatiquement à la jointure.' : 'Réglé à la main.'}</div>
    <div class="btns"><button class="btn" id="bAuto"${info.autoPivot ? ' disabled' : ''}>✨ Pivot auto</button><button class="btn" id="bCenter">⊙ Au centre</button>${c.tracks[p.id] ? '<button class="btn danger" id="bClear">🗑 Effacer ses clés</button>' : ''}</div></div>`;
  if ($('bPar')) $('bPar').onchange = (e) => { snapshot(); p.parent = e.target.value; save(); renderDope(); renderBoneInsp(); toast(p.name + ' suit maintenant ' + pet.parts.find((x) => x.id === p.parent).name); };
  box.querySelectorAll('[data-vec="bpv"] input').forEach((inp) => inp.onchange = () => { const n = parseFloat(inp.value); if (!isFinite(n)) return; snapshot(); const r = rel.slice(); r[+inp.dataset.i] = n; p.pivot = r; save(); renderBoneInsp(); });
  $('bAuto').onclick = () => { snapshot(); delete p.pivot; save(); renderBoneInsp(); };
  $('bCenter').onclick = () => { snapshot(); p.pivot = [0, 0, 0]; save(); renderBoneInsp(); };
  if ($('bClear')) $('bClear').onclick = () => { snapshot(); delete c.tracks[p.id]; anim.selKey = null; save(); renderDope(); renderInspectors(); };
}
function animTick(dt) {
  if (currentTab !== 'anim') return;
  const c = curClip(); if (c && anim.time > c.length) anim.time = c.length;
  if (c && anim.playing) { anim.time += dt * (c.speed || 1); if (anim.time > c.length) { if (c.loop) anim.time %= c.length; else { anim.time = c.length; anim.playing = false; syncPlay(); } }
    if (anim.zoom > 1) { const x = tToX(c, anim.time), W = trackW(); if (x > W * 0.85 || x < 0) { anim.pan = Math.max(0, Math.min(1, anim.pan + (x - W * 0.5) / (W * (anim.zoom - 1)))); const p = $('aPan'); if (p) p.value = anim.pan; anim.dirty = true; } } }
  if (anim.dirty) renderDope(); else updatePlayhead();
}
/* ---------- export: rig + clips as a Luau table (ForgeAnimData ModuleScript) ---------- */
function exportNames() {
  const body = AC.bodyOf(pet.parts), used = new Set(['Body', 'ForgeRoot', 'ForgeAnimData', 'Outline']), names = new Map([[body.id, 'Body']]);
  for (const p of pet.parts) { if (p === body) continue; const base = (String(p.name).replace(/[^\w]/g, '') || 'Part').slice(0, 40); let n = base, i = 2; while (used.has(n)) n = base + i++; used.add(n); names.set(p.id, n); }
  return names;
}
const r4 = (v) => +(+v).toFixed(4) || 0;
function animData() {
  const names = exportNames(), R = getRig(), rig = {};
  for (const id of R.order) { const p = pet.parts.find((x) => x.id === id), info = R.rig.get(id);
    rig[names.get(id)] = p.weld && info.parent ? { parent: names.get(info.parent), weld: true } : { parent: info.parent ? names.get(info.parent) : null, pos: p.pos.map(r4), rot: p.rot.map(r4), pivot: info.pivot.map(r4) }; }
  const clips = (pet.anims || []).map((c) => { const tracks = {};
    for (const [id, keys] of Object.entries(c.tracks)) if (keys.length && names.has(id)) tracks[names.get(id)] = keys.map((k) => ({ t: r4(k.t), pos: k.pos.map(r4), rot: k.rot.map(r4), ease: k.ease, dir: k.dir }));
    return { name: c.name, when: c.when, length: r4(c.length), loop: !!c.loop, speed: r4(c.speed || 1), tracks }; });
  return { v: 1, rig, clips };
}
function lua(v, ind = '') {
  if (v === null || v === undefined) return 'nil';
  if (typeof v === 'number') return String(r4(v));
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return JSON.stringify(v.replace(/[\u0000-\u001f]/g, ''));
  const key = (k) => (/^[A-Za-z_]\w*$/.test(k) && !/^(and|break|do|else|elseif|end|false|for|function|if|in|local|nil|not|or|repeat|return|then|true|until|while|continue)$/.test(k) ? k : `[${JSON.stringify(k)}]`);
  const items = Array.isArray(v) ? v.map((x) => lua(x, ind + '\t')) : Object.entries(v).filter(([, x]) => x !== null && x !== undefined).map(([k, x]) => `${key(k)} = ${lua(x, ind + '\t')}`);
  const one = `{ ${items.join(', ')} }`;
  if (!items.length) return '{}';
  if (one.length <= 120 && !one.includes('\n')) return one;
  return `{\n${items.map((s) => ind + '\t' + s).join(',\n')},\n${ind}}`;
}
function animDataLua() { return `-- Roblox Forge - rig + animations of ${safeName(pet.name)} (generated by Forge Studio: edit them in the 🎬 tab)\n-- Read by ForgePetController (bones) and ForgePetAnim (keyframes, eased with ForgeAnimCore).\nreturn ${lua(animData())}\n`; }


/* =====================================================================
   9. SCULPT TOOLS (Blender-like): subdivide, bend, taper, twist, inflate,
      proportional editing and live X symmetry. Everything stays real
      Roblox parts, so it exports 1:1.
   ===================================================================== */
const sculpt = { prop: false, radius: 1.6, sym: false, drag: null, orig: null };
const twinName = (n) => (/L(\d*)$/.test(n) ? n.replace(/L(\d*)$/, 'R$1') : /R(\d*)$/.test(n) ? n.replace(/R(\d*)$/, 'L$1') : null);
function twinOf(p) { const tn = twinName(p.name); let t = tn && pet.parts.find((x) => x.name === tn);
  if (!t && Math.abs(p.pos[0]) > 0.05) t = pet.parts.find((x) => x !== p && Math.abs(x.pos[0] + p.pos[0]) < 0.06 && Math.abs(x.pos[1] - p.pos[1]) < 0.06 && Math.abs(x.pos[2] - p.pos[2]) < 0.06);
  return t || null; }
function sculptDragStart() { const p = pet.parts.find((x) => x.id === selId); if (!p) return;
  sculpt.drag = { id: p.id, start: p.pos.slice(), others: pet.parts.filter((x) => x !== p).map((x) => ({ x, pos: x.pos.slice() })) }; }
function sculptFollow(p) {
  const d = sculpt.drag; if (!d || d.id !== p.id) return;
  if (sculpt.prop && gizmo.getMode() === 'translate') { const delta = p.pos.map((v, i) => v - d.start[i]);
    for (const o of d.others) { const dist = Math.hypot(...o.pos.map((v, i) => v - d.start[i])) / sculpt.radius; if (dist >= 1) { o.x.pos = o.pos.slice(); } else { const f = (1 - dist * dist) ** 2; o.x.pos = o.pos.map((v, i) => +(v + delta[i] * f).toFixed(3)); }
      const m = meshes.get(o.x.id); if (m) m.position.fromArray(o.x.pos); } }
  if (sculpt.sym) { const t = twinOf(p); if (t) { t.pos = [-p.pos[0], p.pos[1], p.pos[2]]; t.rot = [p.rot[0], -p.rot[1], -p.rot[2]]; t.size = p.size.slice();
    const m = meshes.get(t.id); if (m) { m.position.fromArray(t.pos); m.rotation.set(...t.rot.map(THREE.MathUtils.degToRad), 'XYZ'); m.scale.fromArray(t.size); } } }
}
// a "chain" = parts named Base1, Base2, … (made by Subdivide or the generator's tails / horns / tentacles)
function chainOf(p) { const base = p.name.replace(/\d+$/, ''); if (base === p.name) return [p];
  const list = pet.parts.filter((x) => x.name.replace(/\d+$/, '') === base && /\d+$/.test(x.name)).sort((a, b) => +a.name.match(/\d+$/)[0] - +b.name.match(/\d+$/)[0]); return list.length > 1 ? list : [p]; }
const V = (a) => new THREE.Vector3(...a), Q = (r) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...r.map(THREE.MathUtils.degToRad), 'XYZ'));
const toRot = (q) => { const e = new THREE.Euler().setFromQuaternion(q, 'XYZ'); return [e.x, e.y, e.z].map((v) => +THREE.MathUtils.radToDeg(v).toFixed(2)); };
function longAxis(p) { const i = p.size.indexOf(Math.max(...p.size)); return [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)][i].applyQuaternion(Q(p.rot)); }
function subdivide(p, n) {
  const i = p.size.indexOf(Math.max(...p.size)), axis = longAxis(p), len = p.size[i], seg = len / n, base = p.name.replace(/\d+$/, ''), out = [];
  for (let k = 0; k < n; k++) { const c = V(p.pos).addScaledVector(axis, -len / 2 + seg * (k + 0.5)), size = p.size.slice(); size[i] = +(seg * (p.shape === 'Ellipsoid' ? 1.35 : 1)).toFixed(3);
    out.push({ ...clone(p), id: nid(), name: base + (k + 1), pos: c.toArray().map((v) => +v.toFixed(3)), size, pivot: undefined, parent: k ? undefined : p.parent }); }
  out.forEach((s, k) => { if (k) s.parent = out[k - 1].id; });
  pet.parts.splice(pet.parts.indexOf(p), 1, ...out); return out;
}
function bend(chain, deg, axisName) {
  const ax = { up: new THREE.Vector3(1, 0, 0), side: new THREE.Vector3(0, 1, 0), roll: new THREE.Vector3(0, 0, 1) }[axisName], n = chain.length; if (n < 2) return;
  const step = THREE.MathUtils.degToRad(deg) / (n - 1);
  for (let i = 1; i < n; i++) { const joint = V(chain[i - 1].pos).add(V(chain[i].pos)).multiplyScalar(0.5), q = new THREE.Quaternion().setFromAxisAngle(ax, step);
    for (let j = i; j < n; j++) { const p = chain[j]; p.pos = V(p.pos).sub(joint).applyQuaternion(q).add(joint).toArray().map((v) => +v.toFixed(3)); p.rot = toRot(q.clone().multiply(Q(p.rot))); } }
}
function taper(chain, f) { const n = chain.length; chain.forEach((p, k) => { const t = n > 1 ? k / (n - 1) : 1, s = 1 + (f - 1) * t, i = p.size.indexOf(Math.max(...p.size)); p.size = p.size.map((v, j) => (j === i ? v : +Math.max(0.04, v * s).toFixed(3))); }); }
function twist(chain, deg) { const n = chain.length; if (n < 2) return; const axis = V(chain[n - 1].pos).sub(V(chain[0].pos)).normalize(), c0 = V(chain[0].pos);
  chain.forEach((p, k) => { const q = new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(deg) * (k / (n - 1))); p.pos = V(p.pos).sub(c0).applyQuaternion(q).add(c0).toArray().map((v) => +v.toFixed(3)); p.rot = toRot(q.multiply(Q(p.rot))); }); }
function inflate(chain, f) { chain.forEach((p) => (p.size = p.size.map((v) => +Math.max(0.04, v * f).toFixed(3)))); }
function sculptPane(p) {
  const ch = chainOf(p);
  return `<div class="sec"><h3>🛠️ Sculpter <small>${ch.length > 1 ? 'chaîne de ' + ch.length + ' segments' : 'pièce seule'}</small></h3>
    <div class="row"><label>Proportionnel</label><button class="sw${sculpt.prop ? ' on' : ''}" id="sProp"></button><input type="range" id="sRad" min="0.3" max="5" step="0.1" value="${sculpt.radius}"><span class="val" id="sRadV">${sculpt.radius}</span></div>
    <div class="row"><label>Symétrie X</label><button class="sw${sculpt.sym ? ' on' : ''}" id="sSym"></button><span class="note">${twinOf(p) ? '↔ ' + esc(twinOf(p).name) : 'pas de jumelle'}</span></div>
    <div class="row"><label>Subdiviser</label><div class="btns">${[2, 3, 4, 6, 8].map((n) => `<button class="btn" data-sub="${n}">÷${n}</button>`).join('')}</div></div>
    ${[['bendUp', 'Courber ↕', -120, 120, 0, '°'], ['bendSide', 'Courber ↔', -120, 120, 0, '°'], ['twist', 'Torsion', -180, 180, 0, '°'], ['taper', 'Effiler', 0.15, 2.5, 1, '×'], ['inflate', 'Gonfler', 0.4, 2.2, 1, '×']]
      .map(([id, l, a, b, v, u]) => `<div class="row"><label>${l}</label><input type="range" data-sc="${id}" min="${a}" max="${b}" step="${u === '°' ? 1 : 0.01}" value="${v}"><span class="val">${v}${u}</span></div>`).join('')}
    <div class="note">Comme dans Blender : <b>Subdiviser</b> coupe la pièce en segments, puis <b>Courber / Torsion / Effiler</b> la déforment (queues, cornes, tentacules, oreilles…). Les curseurs agissent en direct, ↶ pour annuler. <b>Proportionnel</b> : en déplaçant une pièce, les voisines suivent en douceur.</div></div>`;
}
function bindSculpt(p) {
  $('sProp').onclick = () => { sculpt.prop = !sculpt.prop; $('sProp').classList.toggle('on', sculpt.prop); toast(sculpt.prop ? '◎ Édition proportionnelle : rayon ' + sculpt.radius : 'Proportionnel coupé'); };
  $('sRad').oninput = (e) => { sculpt.radius = +e.target.value; $('sRadV').textContent = sculpt.radius; };
  $('sSym').onclick = () => { sculpt.sym = !sculpt.sym; $('sSym').classList.toggle('on', sculpt.sym); };
  pane.querySelectorAll('[data-sub]').forEach((b) => b.onclick = () => { if (p === AC.bodyOf(pet.parts)) return toast('Le corps est la racine du squelette : subdivise plutôt une queue, une corne, une oreille…'); snapshot(); const segs = subdivide(p, +b.dataset.sub); save(); rebuild(); select(segs[0].id); toast('÷' + b.dataset.sub + ' : ' + segs.length + ' segments, prêts à courber'); });
  pane.querySelectorAll('[data-sc]').forEach((r) => {
    r.addEventListener('pointerdown', () => { snapshot(); sculpt.orig = chainOf(p).map((x) => ({ x, pos: x.pos.slice(), rot: x.rot.slice(), size: x.size.slice() })); });
    r.oninput = () => { if (!sculpt.orig) { snapshot(); sculpt.orig = chainOf(p).map((x) => ({ x, pos: x.pos.slice(), rot: x.rot.slice(), size: x.size.slice() })); }
      for (const o of sculpt.orig) { o.x.pos = o.pos.slice(); o.x.rot = o.rot.slice(); o.x.size = o.size.slice(); }
      const ch = sculpt.orig.map((o) => o.x), v = +r.value, k = r.dataset.sc;
      if (k === 'bendUp') bend(ch, v, 'up'); else if (k === 'bendSide') bend(ch, v, 'side'); else if (k === 'twist') twist(ch, v); else if (k === 'taper') taper(ch, v); else inflate(ch, v);
      if (sculpt.sym) for (const x of ch) { const t = twinOf(x); if (t && !ch.includes(t)) { t.pos = [-x.pos[0], x.pos[1], x.pos[2]]; t.rot = [x.rot[0], -x.rot[1], -x.rot[2]]; t.size = x.size.slice(); } }
      r.nextElementSibling.textContent = v + (k === 'taper' || k === 'inflate' ? '×' : '°'); rebuild(); };
    r.onchange = () => { sculpt.orig = null; save(); }; });
}

/* =====================================================================
   8. GENERATOR (🧬 Créer) + INDEX (📖 100 pets) with live 3D thumbnails
   ===================================================================== */
const thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
thumbR.setPixelRatio(1); thumbR.setSize(200, 200, false); thumbR.toneMapping = THREE.ACESFilmicToneMapping; thumbR.toneMappingExposure = 1.15;
const tScene = new THREE.Scene(); { const pm = new THREE.PMREMGenerator(thumbR); tScene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; tScene.environmentIntensity = 0.35; }
const tCam = new THREE.PerspectiveCamera(28, 1, 0.1, 200), tGroup = new THREE.Group(); tScene.add(tGroup);
tScene.add(new THREE.HemisphereLight(0xdcd6ff, 0x2a2140, 1.25)); { const k = new THREE.DirectionalLight(0xffffff, 2.6); k.position.set(-4, 7, -6); tScene.add(k); const r = new THREE.DirectionalLight(0x8fe9ff, 1.3); r.position.set(5, 3, 6); tScene.add(r); }
const thumbCache = new Map();
function thumbOf(key, parts) {
  if (thumbCache.has(key)) return thumbCache.get(key);
  for (const m of [...tGroup.children]) { tGroup.remove(m); (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose()); }
  for (const p of parts) { const m = new THREE.Mesh(GEO[p.shape] || GEO.Block, matFor(p)); m.position.fromArray(p.pos); m.rotation.set(...p.rot.map(THREE.MathUtils.degToRad), 'XYZ'); m.scale.fromArray(p.shape === 'Ball' ? [p.size[0], p.size[0], p.size[0]] : p.size); tGroup.add(m); }
  const b = new THREE.Box3().setFromObject(tGroup), c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() * 0.5;
  tCam.position.copy(c).add(new THREE.Vector3(-0.62, 0.38, -1).normalize().multiplyScalar(r / Math.sin((tCam.fov * Math.PI) / 360) * 1.05)); tCam.lookAt(c);
  thumbR.render(tScene, tCam); const url = thumbR.domElement.toDataURL('image/png'); thumbCache.set(key, url); return url;
}
/* ---------- pet styles: voxel (default, like popular simulator pets), chunky blocks, smooth ---------- */
const PET_STYLES = { voxel: '🧊 Voxel', blocs: '🟫 Gros blocs', lisse: '✨ Lisse' };
let petStyle = (() => { try { return localStorage.getItem('forge.petStyle') || 'voxel'; } catch { return 'voxel'; } })();
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)); return '#' + c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join(''); };
const styleCache = new Map();
function styled(g, style = petStyle) {
  if (style === 'lisse' || g.style) return g;
  const key = style + '|' + g.seed + '|' + g.prompt + '|' + g.rarity; if (styleCache.has(key)) return styleCache.get(key);
  let parts;
  if (style === 'voxel' && VOX_SPECIES[g.species]) {
    const hi = PG.RARITIES.indexOf(g.rarity) >= 4, E = g.element && PG.ELEMENTS[g.element], side = E ? PG.mix(g.c1, E.c[0], 0.55) : g.c1;
    const pal = E ? { back: shade(side, -0.28), side, belly: E.c[1], muzzle: E.c[1], socks: shade(side, -0.4), dark: shade(side, -0.62), eye: g.glow || undefined } : null;
    if (pal && !pal.eye) delete pal.eye;
    parts = voxelAnimal(g.species, { palette: pal, glowEyes: hi, eye: pal && pal.eye }).parts;
  } else parts = voxelizeParts(g.parts, style === 'blocs' ? 0.26 : 0.13).parts;
  const out = { ...g, parts, style }; styleCache.set(key, out); if (styleCache.size > 400) styleCache.delete(styleCache.keys().next().value); return out;
}
function fromGenerated(g) {
  g = styled(g);
  const fx = defaultFx(); for (const [k, v] of Object.entries(g.fx)) if (fx[k]) Object.assign(fx[k], v, { on: true });
  const ids = new Map(), parts = g.parts.map((p) => { const id = nid(); if (p.key) ids.set(p.key, id); return { id, ...clone(p), tint: !!p.tint }; });
  for (const p of parts) { if (p.parentKey && ids.has(p.parentKey)) p.parent = ids.get(p.parentKey); delete p.key; delete p.parentKey; }
  return { v: 1, name: g.name, customName: true, body: g.body, rarity: g.rarity, c1: g.c1, c2: g.c2, fx, scripts: {}, gen: { prompt: g.prompt, seed: g.seed, species: g.species, element: g.element, style: g.style || 'lisse' }, parts };
}
function openGenerated(g, msg) { snapshot(); pet = fromGenerated(g); selId = null; save(); rebuild(); updateHud(); toast(msg || ('✨ ' + pet.name + ' · ' + pet.rarity)); }
const RAR_BG = Object.fromEntries(RARITIES.map((r) => [r.id, r.bg]));
let genQ = '', genVars = [];
function genChip(label, word) { return `<button class="chip" data-w="${esc(word)}">${label}</button>`; }
function paneGen() {
  pane.innerHTML = `<div class="sec"><h3>🧬 Créer un pet <small>décris-le, le générateur le construit</small></h3>
      <textarea id="gq" class="lsearch" rows="2" placeholder="ex : dragon de feu légendaire · chat cosmique mignon · robot néon secret · « Kiwi » le lapin des bois">${esc(genQ)}</textarea>
      <div class="chipwrap" style="margin-top:8px">${Object.entries(PET_STYLES).map(([k, l]) => `<button class="chip${k === petStyle ? ' on' : ''}" data-st="${k}">${l}</button>`).join('')}</div>
      <div class="btns" style="margin-top:8px"><button class="btn pri" id="gGo" style="flex:1">✨ Générer 6 variantes</button><button class="btn" id="gDice">🎲 Surprise</button></div>
      <div class="vars" id="gVars">${genVars.map((g, i) => `<button class="var" data-v="${i}" style="--bg:${RAR_BG[g.rarity]}"><img alt="" src="${thumbOf(petStyle + 'v' + g.seed + g.prompt, styled(g).parts)}"><b>${esc(g.name)}</b><small>${esc(g.rarity)} · ${styled(g).parts.length} pièces</small></button>`).join('')}</div></div>
    <div class="sec"><h3>Espèces <small>${Object.keys(PG.SPECIES).length}</small></h3><div class="chipwrap">${Object.entries(PG.SPECIES).map(([k, s]) => genChip(s.e + ' ' + s.fr, s.words.split(' ')[0])).join('')}</div></div>
    <div class="sec"><h3>Éléments</h3><div class="chipwrap">${Object.entries(PG.ELEMENTS).map(([k, e]) => genChip(e.adj, e.words.split(' ')[0])).join('')}</div></div>
    <div class="sec"><h3>Styles & rareté</h3><div class="chipwrap">${Object.entries({ mignon: '🥺 Mignon', roi: '👑 Royal', ange: '😇 Ange', demon: '😈 Démon', cyber: '🦾 Cyber', ninja: '🥷 Ninja', pirate: '🏴‍☠️ Pirate', sorcier: '🧙 Sorcier', geant: '🗿 Géant', zombie: '🧟 Zombie' }).map(([w, l]) => genChip(l, w)).join('')}
      ${PG.RARITIES.map((r) => genChip(r, r.split(' ')[0].toLowerCase())).join('')}</div>
      <div class="note" style="margin-top:8px">Le générateur comprend le français et l'anglais. Même description = même pet ; « Générer » propose 6 variantes. Tout reste modifiable pièce par pièce ensuite.</div></div>`;
  const q = $('gq'); q.oninput = () => (genQ = q.value);
  pane.querySelectorAll('[data-w]').forEach((b) => b.onclick = () => { genQ = (genQ.trim() + ' ' + b.dataset.w).trim(); q.value = genQ; b.classList.add('on'); });
  const run = () => { const base = PG.hash(genQ || 'pet'); genVars = Array.from({ length: 6 }, (_, i) => PG.generate(genQ, base + i * 7919)); paneGen(); };
  $('gGo').onclick = run;
  $('gDice').onclick = () => { const sp = Object.values(PG.SPECIES), el = Object.values(PG.ELEMENTS), r = Math.random;
    genQ = `${sp[Math.floor(r() * sp.length)].words.split(' ')[0]} ${r() < 0.8 ? el[Math.floor(r() * el.length)].words.split(' ')[0] : ''} ${['', 'mignon', 'roi', 'cyber', 'demon', 'ange', 'ninja', 'sorcier'][Math.floor(r() * 8)]} ${PG.RARITIES[Math.floor(r() * r() * 7)].split(' ')[0].toLowerCase()}`.replace(/\s+/g, ' ').trim(); run(); };
  pane.querySelectorAll('[data-v]').forEach((b) => b.onclick = () => openGenerated(genVars[+b.dataset.v]));
  pane.querySelectorAll('[data-st]').forEach((b) => b.onclick = () => setPetStyle(b.dataset.st, paneGen));
}
function setPetStyle(st, redraw) { petStyle = st; try { localStorage.setItem('forge.petStyle', st); } catch {} toast(PET_STYLES[st] + ' : tous les pets passent dans ce style'); redraw(); }
const INDEX = PG.index100(); let idxFilter = 'all', idxCache = new Map();
const idxPet = (e) => { if (!idxCache.has(e.n)) { const g = PG.generate(e.text, e.seed); g.rarity = e.rarity; idxCache.set(e.n, g); } return idxCache.get(e.n); };
function paneIndex() {
  const list = INDEX.filter((e) => idxFilter === 'all' || e.rarity === idxFilter);
  pane.innerHTML = `<div class="sec"><h3>📖 Index <small>${INDEX.length} pets · ${list.length} affichés</small></h3>
      <div class="chipwrap" style="margin-bottom:6px">${Object.entries(PET_STYLES).map(([k, l]) => `<button class="chip${k === petStyle ? ' on' : ''}" data-st="${k}">${l}</button>`).join('')}</div>
      <div class="chipwrap"><button class="chip${idxFilter === 'all' ? ' on' : ''}" data-f="all">Tous</button>${PG.RARITIES.map((r) => `<button class="chip${idxFilter === r ? ' on' : ''}" data-f="${r}">${r}</button>`).join('')}</div>
      <div class="idx" id="idx">${list.map((e) => `<button class="var" data-n="${e.n}" style="--bg:${RAR_BG[e.rarity]}"><i class="num">#${e.n}</i><img alt="" data-lazy="${e.n}"><b></b><small>${esc(e.rarity)}</small></button>`).join('')}</div>
      <div class="btns" style="margin-top:10px"><button class="btn pri" id="idxZip" style="flex:1">📦 Exporter les ${INDEX.length} pets (pack Roblox)</button></div>
      <div class="note" style="margin-top:6px">Chaque pet de l'index est un vrai modèle Roblox avec ses effets et ses animations. Touche-en un pour l'ouvrir dans l'éditeur.</div></div>`;
  pane.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { idxFilter = b.dataset.f; paneIndex(); });
  pane.querySelectorAll('[data-st]').forEach((b) => b.onclick = () => setPetStyle(b.dataset.st, paneIndex));
  pane.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => openGenerated(idxPet(INDEX[+b.dataset.n - 1]), `📖 #${b.dataset.n} ${idxPet(INDEX[+b.dataset.n - 1]).name}`));
  // thumbnails rendered a few at a time so the page stays fluid
  const imgs = [...pane.querySelectorAll('img[data-lazy]')]; let i = 0;
  const step = () => { if (currentTab !== 'index') return; const t0 = performance.now();
    while (i < imgs.length && performance.now() - t0 < 30) { const im = imgs[i++], e = INDEX[+im.dataset.lazy - 1], g = idxPet(e); im.src = thumbOf(petStyle + 'i' + e.n, styled(g).parts); im.nextElementSibling.textContent = g.name; }
    if (i < imgs.length) setTimeout(step, 16); };
  step();
  $('idxZip').onclick = async () => { toast('Construction des ' + INDEX.length + ' modèles…', 4000); await new Promise((r) => setTimeout(r, 50)); const blob = await buildIndexPack();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ForgePetIndex.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('📦 Index téléchargé ✓'); };
}
async function buildIndexPack() {
  await loadKit(); const keep = pet, files = [], used = new Set();
  for (const e of INDEX) { pet = fromGenerated(idxPet(e)); ensureAnims(); rigDirty = true; let n = safeName(pet.name), k = 2; while (used.has(n)) n = safeName(pet.name) + '_' + k++; used.add(n); pet.name = n;
    files.push({ path: `ReplicatedStorage/ForgePets/${n}.model.json`, data: JSON.stringify(modelJson()) }); }
  pet = keep; rigDirty = true; ensureAnims(); const sf = scriptFiles();
  files.push({ path: 'ReplicatedStorage/ForgeConfig.lua', data: sf.find((f) => f.id === 'cfg').text }, { path: 'ServerScriptService/ForgePetController.server.lua', data: sf.find((f) => f.id === 'ctrl').text },
    { path: 'StarterPlayerScripts/ForgePetFX.client.lua', data: sf.find((f) => f.id === 'fxs').text }, { path: 'StarterPlayerScripts/ForgePetAnim.client.lua', data: sf.find((f) => f.id === 'anim').text },
    { path: 'ReplicatedStorage/ForgeAnimCore.lua', data: sf.find((f) => f.id === 'core').text },
    { path: 'LISEZ-MOI.txt', data: `Index Roblox Forge : ${INDEX.length} pets prêts (ReplicatedStorage/ForgePets).\nDonne un pet à un joueur : player:SetAttribute("ForgePet", "NomDuPet")\n` });
  return zip(files);
}

/* ---------- boot ---------- */
resize(); rebuild(); renderPane(); syncUndo(); loop(); LIB.prompt();
window.__forge = { LIB, PG, styled, get petStyle() { return petStyle; }, setPetStyle, INDEX, idxPet, openGenerated, fromGenerated, buildIndexPack, thumbOf, get pet() { return pet; }, modelJson, buildPack, select, setTab, AC, anim, animData, animDataLua, exportNames, getRig, offsetsAt, curClip, get lastPose() { return lastPose; }, gizmo, meshes, renderPane }; // used by automated tests
