// LOOPLAB — colour designs. Every template reads its colours from here.
// bg: background gradient (top, bottom); cols: 5 lead colours; fg: text; dark: bloom allowed.

export const THEMES = [
  { id: 'neon', name: 'Néon', bg: ['#07031a', '#000000'], cols: ['#ff2bd6', '#8b3dff', '#19e3ff', '#3dff9a', '#ffe14d'], fg: '#ffffff', dark: true, glowBoost: 1 },
  { id: 'aurora', name: 'Aurore', bg: ['#021412', '#010509'], cols: ['#3dffc5', '#36b9ff', '#7a6bff', '#d26bff', '#b6ff3b'], fg: '#eafff8', dark: true, glowBoost: 1 },
  { id: 'sunset', name: 'Couchant', bg: ['#2a0b2e', '#0d0410'], cols: ['#ff5e62', '#ff9966', '#ffd36e', '#c94bff', '#ff3d8b'], fg: '#fff4ea', dark: true, glowBoost: 0.9 },
  { id: 'ocean', name: 'Océan', bg: ['#021a2b', '#00060d'], cols: ['#00d2ff', '#3a7bd5', '#00f5c4', '#7ae0ff', '#4f5bff'], fg: '#e8f8ff', dark: true, glowBoost: 0.9 },
  { id: 'synth', name: 'Synthwave', bg: ['#1b0638', '#05010d'], cols: ['#ff2a6d', '#05d9e8', '#d300c5', '#ff9e2c', '#7b2cff'], fg: '#ffe9fb', dark: true, glowBoost: 1.1 },
  { id: 'candy', name: 'Bonbon', bg: ['#fff1f7', '#e9f2ff'], cols: ['#ff6fae', '#7ac8ff', '#ffb86b', '#9b7bff', '#5ee3b5'], fg: '#2a1638', dark: false, glowBoost: 0.35 },
  { id: 'pastel', name: 'Pastel', bg: ['#f6f1ff', '#fff7ef'], cols: ['#ffadc7', '#a9c8ff', '#b9f0d2', '#ffe2a3', '#d2b5ff'], fg: '#3b2f4a', dark: false, glowBoost: 0.3 },
  { id: 'forest', name: 'Forêt', bg: ['#06150b', '#010402'], cols: ['#6cff8b', '#d8ff5e', '#2ed1a0', '#ffd34f', '#8fe36a'], fg: '#eefbe9', dark: true, glowBoost: 0.8 },
  { id: 'lava', name: 'Lave', bg: ['#1a0300', '#050000'], cols: ['#ff3c00', '#ff8a00', '#ffd000', '#ff0055', '#ff5f2e'], fg: '#fff1e6', dark: true, glowBoost: 1.15 },
  { id: 'luxe', name: 'Luxe', bg: ['#0e0b07', '#000000'], cols: ['#e9c46a', '#f6e7b5', '#b08d57', '#ffffff', '#d4a373'], fg: '#fbf3df', dark: true, glowBoost: 0.75 },
  { id: 'ice', name: 'Glace', bg: ['#e9f6ff', '#c9e3f7'], cols: ['#3aa0ff', '#7fd1ff', '#1b5dff', '#b5ecff', '#6c7dff'], fg: '#0b2540', dark: false, glowBoost: 0.4 },
  { id: 'mono', name: 'Mono', bg: ['#111111', '#000000'], cols: ['#ffffff', '#bdbdbd', '#7a7a7a', '#e0e0e0', '#9e9e9e'], fg: '#ffffff', dark: true, glowBoost: 0.7 },
  { id: 'minimal', name: 'Minimal', bg: ['#f4f2ee', '#e9e6df'], cols: ['#1d1d1f', '#ff5a36', '#3b5bdb', '#2f9e44', '#f08c00'], fg: '#1d1d1f', dark: false, glowBoost: 0.15 },
  { id: 'retro', name: 'Rétro', bg: ['#f3e6cc', '#e2cfa6'], cols: ['#d1495b', '#00798c', '#edae49', '#30638e', '#6a994e'], fg: '#2b2118', dark: false, glowBoost: 0.2 },
];

export const MATERIALS = [
  { id: 'flat', name: 'Plat' },
  { id: 'glossy', name: 'Plastique brillant' },
  { id: 'clay', name: 'Argile mate' },
  { id: 'glass', name: 'Verre' },
  { id: 'jelly', name: 'Gelée' },
  { id: 'bubble', name: 'Bulle de savon' },
  { id: 'pearl', name: 'Perle' },
  { id: 'chrome', name: 'Chrome' },
  { id: 'gold', name: 'Or' },
];

export const GLOWS = [
  { id: 'strong', name: 'Fort', k: 1 },
  { id: 'soft', name: 'Doux', k: 0.5 },
  { id: 'none', name: 'Aucun', k: 0 },
];

export const EFFECTS = [
  { id: 'lightning', name: 'Éclairs', def: false },
  { id: 'shock', name: 'Ondes de choc', def: true },
  { id: 'sparks', name: 'Étincelles', def: true },
  { id: 'flash', name: 'Flash', def: false },
  { id: 'shake', name: 'Secousses', def: false },
  { id: 'glitch', name: 'Glitch', def: false },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
