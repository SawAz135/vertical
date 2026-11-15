/* =====================================================================
   Roblox Forge - Map core: data model = real Roblox parts and Models.
   - parts: Part (Block / Cylinder / Ball), WedgePart, CornerWedgePart,
     TrussPart, SpawnLocation with Size, CFrame (pos + Euler XYZ deg),
     Color, Material, Transparency, Anchored, CanCollide;
   - gameplay "roles" are attributes (ForgeRole …) run by kit/ForgeMap.server.lua
     and kit/ForgeMap.client.lua: obby, tycoon and simulator mechanics;
   - generators build whole maps for a genre, in a theme, from a seed;
   - toPack() writes the Rojo files (Workspace map + Lighting effects).
   ===================================================================== */
let seq = 1;
export const nid = () => 'm' + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
export const PART_CLASSES = { Part: 'Bloc', WedgePart: 'Coin', CornerWedgePart: 'Coin d\'angle', TrussPart: 'Échelle', SpawnLocation: 'Apparition' };
export const SHAPES = { Block: 'Bloc', Cylinder: 'Cylindre', Ball: 'Boule' };
export const MATERIALS = ['Plastic', 'SmoothPlastic', 'Neon', 'Wood', 'WoodPlanks', 'Brick', 'Cobblestone', 'Concrete', 'Slate', 'Granite', 'Marble', 'Basalt', 'Rock',
  'Pebble', 'Grass', 'LeafyGrass', 'Sand', 'Snow', 'Ice', 'Glacier', 'Glass', 'ForceField', 'Metal', 'DiamondPlate', 'CorrodedMetal', 'Foil', 'Fabric', 'Asphalt', 'Pavement', 'CrackedLava', 'Sandstone'];

/* ---------- gameplay roles (attributes read by the Luau runtime) ---------- */
export const ROLES = {
  kill: { e: '☠️', fr: 'Piège mortel', p: {}, hint: 'Tue le joueur qui le touche.' },
  checkpoint: { e: '🚩', fr: 'Checkpoint', p: { stage: 1 }, hint: 'Le joueur réapparaît ici. Stage visible dans le classement.' },
  jumppad: { e: '🦘', fr: 'Tremplin', p: { power: 90 }, hint: 'Propulse vers le haut de la pièce.' },
  conveyor: { e: '➡️', fr: 'Tapis roulant', p: { speed: 16 }, hint: 'Pousse vers l\'avant (-Z) de la pièce.' },
  mover: { e: '↔️', fr: 'Plateforme mobile', p: { dx: 0, dy: 0, dz: 16, period: 4 }, hint: 'Va et vient, emporte les joueurs.' },
  spinner: { e: '🌀', fr: 'Tourniquet', p: { speed: 120 }, hint: 'Tourne sur lui-même (degrés/s).' },
  teleporter: { e: '🌀', fr: 'Téléporteur', p: { pair: 'A' }, hint: 'Envoie vers l\'autre téléporteur du même code.' },
  coin: { e: '🪙', fr: 'Pièce', p: { value: 1, respawn: 8, stat: 'Coins' }, hint: 'Donne des points puis réapparaît.' },
  gate: { e: '🔒', fr: 'Porte à débloquer', p: { stat: 'Coins', need: 50 }, hint: 'S\'ouvre pour les joueurs qui ont assez.' },
  claim: { e: '🏳️', fr: 'Réclamer le tycoon', p: {}, hint: 'Le premier qui marche dessus possède ce tycoon.' },
  dropper: { e: '⬇️', fr: 'Dropper', p: { interval: 2, value: 5 }, hint: 'Fait tomber des blocs qui rapportent.' },
  upgrader: { e: '✨', fr: 'Upgrader', p: { mult: 2 }, hint: 'Multiplie la valeur des blocs qui le traversent.' },
  collector: { e: '💰', fr: 'Collecteur', p: { stat: 'Cash' }, hint: 'Transforme les blocs en argent pour le propriétaire.' },
  buybutton: { e: '🛒', fr: 'Bouton d\'achat', p: { price: 100, target: 'Dropper2', stat: 'Cash' }, hint: 'Achète et fait apparaître le modèle cible.' },
};
export const ROLE_FR_PARAM = { stage: 'Étape', power: 'Puissance', speed: 'Vitesse', dx: 'Décalage X', dy: 'Décalage Y', dz: 'Décalage Z', period: 'Période (s)', pair: 'Code', value: 'Valeur',
  respawn: 'Réapparition (s)', stat: 'Statistique', need: 'Il faut', interval: 'Intervalle (s)', mult: 'Multiplicateur', price: 'Prix', target: 'Modèle à acheter' };

/* ---------- themes ---------- */
const M = (c, m) => ({ c, m });
export const THEMES = {
  plaine: { label: 'Plaine', e: '🌿', ground: M('#4b9a3c', 'Grass'), path: M('#b9a27a', 'Pebble'), wall: M('#8d8a86', 'Cobblestone'), deco: M('#7a5232', 'WoodPlanks'), trunk: M('#6b4a2b', 'Wood'),
    leaf: M('#3f8f3a', 'LeafyGrass'), accent: M('#f2c94c', 'SmoothPlastic'), accent2: M('#ff7a59', 'SmoothPlastic'), glow: M('#ffe28a', 'Neon'), water: '#3aa8ff', rock: M('#7d7d7d', 'Slate'), light: 'jour' },
  desert: { label: 'Désert', e: '🏜️', ground: M('#e3c48f', 'Sand'), path: M('#c79f6a', 'Sandstone'), wall: M('#c9905a', 'Sandstone'), deco: M('#a8693b', 'Brick'), trunk: M('#8a6239', 'Wood'),
    leaf: M('#6d9b42', 'LeafyGrass'), accent: M('#ff9f1c', 'SmoothPlastic'), accent2: M('#2ec4b6', 'SmoothPlastic'), glow: M('#ffbf47', 'Neon'), water: '#34c3d6', rock: M('#b07d4f', 'Sandstone'), light: 'coucher' },
  neige: { label: 'Neige', e: '❄️', ground: M('#f2f7ff', 'Snow'), path: M('#bcd6ee', 'Glacier'), wall: M('#9fb6cc', 'Slate'), deco: M('#6e4b2f', 'WoodPlanks'), trunk: M('#5b3d26', 'Wood'),
    leaf: M('#2f6b4f', 'LeafyGrass'), accent: M('#7cc6ff', 'Ice'), accent2: M('#ff5c7a', 'SmoothPlastic'), glow: M('#9be8ff', 'Neon'), water: '#8fd3ff', rock: M('#8a97a6', 'Rock'), light: 'aube' },
  lave: { label: 'Volcan', e: '🌋', ground: M('#2a2524', 'Basalt'), path: M('#3c3330', 'Slate'), wall: M('#1c1919', 'Basalt'), deco: M('#4a2b20', 'CorrodedMetal'), trunk: M('#2b1d18', 'Wood'),
    leaf: M('#5b2a1d', 'Rock'), accent: M('#ff5a1f', 'CrackedLava'), accent2: M('#ffb02e', 'SmoothPlastic'), glow: M('#ff6a00', 'Neon'), water: '#ff4800', rock: M('#3a3332', 'Basalt'), light: 'enfer' },
  bonbon: { label: 'Bonbon', e: '🍭', ground: M('#ffd1e8', 'SmoothPlastic'), path: M('#fff3b0', 'SmoothPlastic'), wall: M('#c7a6ff', 'SmoothPlastic'), deco: M('#ff8fc7', 'SmoothPlastic'), trunk: M('#ffffff', 'SmoothPlastic'),
    leaf: M('#7ef0c5', 'SmoothPlastic'), accent: M('#5ad1ff', 'SmoothPlastic'), accent2: M('#ff6b9a', 'SmoothPlastic'), glow: M('#ff7ad9', 'Neon'), water: '#8ae6ff', rock: M('#ffffff', 'SmoothPlastic'), light: 'pastel' },
  neon: { label: 'Néon', e: '🌃', ground: M('#15151c', 'Asphalt'), path: M('#22222c', 'Pavement'), wall: M('#1d1d27', 'Metal'), deco: M('#2c2c3a', 'DiamondPlate'), trunk: M('#2a2a33', 'Metal'),
    leaf: M('#00ffd5', 'Neon'), accent: M('#7c5cff', 'Neon'), accent2: M('#ff2fb4', 'Neon'), glow: M('#3ee6ff', 'Neon'), water: '#2b6bff', rock: M('#30303c', 'Metal'), light: 'neon' },
  espace: { label: 'Espace', e: '🪐', ground: M('#2b2f3a', 'DiamondPlate'), path: M('#3a4152', 'Metal'), wall: M('#1b1e27', 'Metal'), deco: M('#4a5266', 'Foil'), trunk: M('#2b2f3a', 'Metal'),
    leaf: M('#7cf7ff', 'Glass'), accent: M('#4d7cff', 'Neon'), accent2: M('#c86bff', 'Neon'), glow: M('#9ad7ff', 'Neon'), water: '#4d7cff', rock: M('#545b6b', 'Rock'), light: 'espace' },
};

/* ---------- lighting presets (Roblox Lighting + effects) ---------- */
export const LIGHTS = {
  jour: { fr: 'Plein jour', e: '☀️', ClockTime: 14, Brightness: 3, Ambient: '#6e6e78', OutdoorAmbient: '#8a8a96', sky: ['#4ea6ff', '#cfe8ff'], atmo: { Density: 0.28, Haze: 0.6, Glare: 0.2, Color: '#c7d7ec', Decay: '#5c6e87' }, bloom: { Intensity: 0.6, Size: 24, Threshold: 1.6 }, cc: { Saturation: 0.08, Contrast: 0.06, TintColor: '#ffffff' }, rays: 0.06 },
  coucher: { fr: 'Coucher de soleil', e: '🌇', ClockTime: 17.8, Brightness: 2.6, Ambient: '#6b4d4a', OutdoorAmbient: '#9a6b5c', sky: ['#5a3e8f', '#ffb36b'], atmo: { Density: 0.35, Haze: 1.6, Glare: 0.9, Color: '#ffb48a', Decay: '#9a4f6b' }, bloom: { Intensity: 0.9, Size: 30, Threshold: 1.2 }, cc: { Saturation: 0.15, Contrast: 0.1, TintColor: '#ffe6d6' }, rays: 0.15 },
  aube: { fr: 'Aube glacée', e: '🌅', ClockTime: 7.2, Brightness: 2.4, Ambient: '#5e6c80', OutdoorAmbient: '#9aa9c2', sky: ['#6f8fd6', '#ffd8e8'], atmo: { Density: 0.4, Haze: 1.2, Glare: 0.5, Color: '#dbe6ff', Decay: '#8f9dbf' }, bloom: { Intensity: 0.7, Size: 26, Threshold: 1.4 }, cc: { Saturation: 0, Contrast: 0.05, TintColor: '#eef4ff' }, rays: 0.1 },
  nuit: { fr: 'Nuit étoilée', e: '🌙', ClockTime: 0, Brightness: 1.2, Ambient: '#2b3047', OutdoorAmbient: '#3c4466', sky: ['#05071a', '#1d2a5c'], atmo: { Density: 0.32, Haze: 0.4, Glare: 0, Color: '#1d2a5c', Decay: '#05071a' }, bloom: { Intensity: 1.1, Size: 32, Threshold: 0.9 }, cc: { Saturation: -0.05, Contrast: 0.1, TintColor: '#dfe6ff' }, rays: 0 },
  neon: { fr: 'Nuit néon', e: '🌆', ClockTime: 0.5, Brightness: 1, Ambient: '#3b2a5c', OutdoorAmbient: '#4a2f7a', sky: ['#120428', '#5b1a7a'], atmo: { Density: 0.42, Haze: 1.8, Glare: 0, Color: '#5b1a7a', Decay: '#120428' }, bloom: { Intensity: 1.6, Size: 40, Threshold: 0.7 }, cc: { Saturation: 0.3, Contrast: 0.15, TintColor: '#f2e6ff' }, rays: 0 },
  enfer: { fr: 'Volcan', e: '🔥', ClockTime: 18.6, Brightness: 1.8, Ambient: '#5a2418', OutdoorAmbient: '#7a3020', sky: ['#2a0a05', '#ff5a1f'], atmo: { Density: 0.5, Haze: 2.4, Glare: 0.6, Color: '#ff7a3d', Decay: '#5a1408' }, bloom: { Intensity: 1.4, Size: 36, Threshold: 0.8 }, cc: { Saturation: 0.25, Contrast: 0.15, TintColor: '#ffd9c7' }, rays: 0.12 },
  pastel: { fr: 'Pastel', e: '🍬', ClockTime: 13, Brightness: 3.2, Ambient: '#8c7a96', OutdoorAmbient: '#b39ccf', sky: ['#a7c8ff', '#ffd6f0'], atmo: { Density: 0.25, Haze: 1, Glare: 0.3, Color: '#ffe0f4', Decay: '#c7b3ff' }, bloom: { Intensity: 0.8, Size: 28, Threshold: 1.3 }, cc: { Saturation: 0.2, Contrast: 0, TintColor: '#fff2fb' }, rays: 0.08 },
  espace: { fr: 'Espace', e: '🪐', ClockTime: 0, Brightness: 1.4, Ambient: '#2e3550', OutdoorAmbient: '#3d4870', sky: ['#000005', '#0b1440'], atmo: { Density: 0.05, Haze: 0, Glare: 0, Color: '#0b1440', Decay: '#000005' }, bloom: { Intensity: 1.3, Size: 36, Threshold: 0.8 }, cc: { Saturation: 0.1, Contrast: 0.12, TintColor: '#e6ecff' }, rays: 0 },
  brume: { fr: 'Brume', e: '🌫️', ClockTime: 9, Brightness: 1.6, Ambient: '#6b7178', OutdoorAmbient: '#8c939b', sky: ['#8c939b', '#c9ced3'], atmo: { Density: 0.72, Haze: 3, Glare: 0, Color: '#c9ced3', Decay: '#7d858c' }, bloom: { Intensity: 0.5, Size: 24, Threshold: 1.8 }, cc: { Saturation: -0.2, Contrast: 0.05, TintColor: '#f0f2f4' }, rays: 0 },
};
export const lightingOf = (map) => { const b = LIGHTS[map.lighting?.preset] || LIGHTS.jour, o = map.lighting?.over || {};
  return { ...b, ...o, atmo: { ...b.atmo, ...(o.atmo || {}) }, bloom: { ...b.bloom, ...(o.bloom || {}) }, cc: { ...b.cc, ...(o.cc || {}) }, sky: o.sky || b.sky }; };

/* ---------- builders ---------- */
export function P(cls, name, size, pos, rot = [0, 0, 0], mat = M('#a3a2a5', 'Plastic'), extra = {}) {
  return { id: nid(), cls, name, size: size.map((v) => +(+v).toFixed(3)), pos: pos.map((v) => +(+v).toFixed(3)), rot: rot.map((v) => +(+v).toFixed(2)), color: mat.c, material: mat.m,
    transparency: 0, anchored: true, canCollide: true, shape: 'Block', ...extra };
}
export const block = (name, size, pos, mat, extra) => P('Part', name, size, pos, [0, 0, 0], mat, extra);
export const cyl = (name, h, d, pos, mat, extra) => P('Part', name, [h, d, d], pos, [0, 0, 90], mat, { shape: 'Cylinder', ...extra }); // vertical cylinder
export const ball = (name, d, pos, mat, extra) => P('Part', name, [d, d, d], pos, [0, 0, 0], mat, { shape: 'Ball', ...extra });
export const model = (name, children, extra = {}) => ({ id: nid(), cls: 'Model', name, children, ...extra });
export const role = (type, params = {}) => ({ type, ...ROLES[type].p, ...params });
export function rng(seed) { let a = seed >>> 0 || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];

/* ---------- reusable pieces ---------- */
export function tree(T, x, z, r, y = 0, s = 1) {
  const h = (8 + r() * 6) * s, kids = [cyl('Trunk', h, 1.6 * s, [x, y + h / 2, z], T.trunk)];
  for (let k = 0; k < 3; k++) kids.push(ball('Leaves', (7 - k * 1.6) * s, [x + (r() - 0.5) * 1.5, y + h + k * 2.2 * s - 1, z + (r() - 0.5) * 1.5], T.leaf, { canCollide: k === 0 }));
  return model('Tree', kids);
}
export function palm(T, x, z, r, y = 0) {
  const kids = []; let px = x, py = y, pz = z; const lean = (r() - 0.5) * 20, dir = r() * 360;
  for (let k = 0; k < 5; k++) { kids.push(P('Part', 'Trunk', [2.6, 1.3, 1.3], [px, py + 1.3, pz], [0, dir, 90 + lean * (k / 5)], T.trunk, { shape: 'Cylinder' })); px += Math.sin(dir * Math.PI / 180) * lean / 30; py += 2.5; }
  for (let k = 0; k < 6; k++) { const a = k * 60 + r() * 20; kids.push(P('WedgePart', 'Leaf', [0.4, 1.2, 6], [px + Math.sin(a * Math.PI / 180) * 3, py + 0.4, pz + Math.cos(a * Math.PI / 180) * 3], [12, a + 180, 0], T.leaf, { canCollide: false })); }
  kids.push(ball('Coconut', 1.1, [px, py - 0.4, pz], M('#6b4a2b', 'Wood')));
  return model('Palm', kids);
}
export function coinRow(n, start, step, value = 1, stat = 'Coins', color = '#ffd34d') {
  return Array.from({ length: n }, (_, k) => P('Part', 'Coin', [0.4, 2.2, 2.2], [start[0] + step[0] * k, start[1] + step[1] * k, start[2] + step[2] * k], [0, 90, 0], M(color, 'Neon'),
    { shape: 'Cylinder', canCollide: false, role: role('coin', { value, stat }) }));
}
export function lamp(T, x, z, y = 0) { return model('Lamp', [cyl('Pole', 10, 0.6, [x, y + 5, z], M('#2b2b30', 'Metal')), ball('Light', 1.8, [x, y + 10.6, z], T.glow, { light: { range: 18, brightness: 2 } })]); }
export function portalPair(T, a, b, code) {
  const ring = (p, name) => model(name, [P('Part', 'Pad', [1, 8, 8], [p[0], p[1] + 0.5, p[2]], [0, 0, 90], T.glow, { shape: 'Cylinder', role: role('teleporter', { pair: code }) }),
    P('Part', 'Halo', [0.4, 10, 10], [p[0], p[1] + 6, p[2]], [0, 0, 90], { c: T.glow.c, m: 'ForceField' }, { shape: 'Cylinder', canCollide: false, transparency: 0.2 })]);
  return [ring(a, 'Portal' + code + '1'), ring(b, 'Portal' + code + '2')];
}

/* ---------- generators ---------- */
export const GENERATORS = {
  obby: { e: '🧗', fr: 'Obby', tags: 'parcours obstacle obby course sauts checkpoints', opts: { stages: [8, 40, 20] }, make(T, r, o) {
    const out = [], n = o.stages; let x = 0, y = 4, z = 0;
    out.push(model('Start', [block('StartPad', [24, 2, 24], [0, 3, 0], T.ground), P('SpawnLocation', 'Spawn', [8, 1, 8], [0, 4.5, 0], [0, 0, 0], T.glow), block('Arch', [24, 2, 2], [0, 14, -11], T.accent), block('PillarL', [2, 12, 2], [-11, 9, -11], T.wall), block('PillarR', [2, 12, 2], [11, 9, -11], T.wall)]));
    z = -14;
    for (let s = 1; s <= n; s++) {
      const kind = pick(r, ['jumps', 'killfloor', 'spinner', 'mover', 'pad', 'truss', 'beam', 'conveyor', 'wedges']), seg = [];
      const P0 = (name, size, pos, mat, extra) => seg.push(block(name, size, pos, mat, extra));
      if (kind === 'jumps') { for (let k = 0; k < 3; k++) { z -= 9; x += (r() - 0.5) * 8; P0('Jump', [5, 1, 5], [x, y, z], k % 2 ? T.accent : T.accent2); } }
      else if (kind === 'killfloor') { z -= 6; P0('Lava', [12, 1, 22], [x, y - 1.5, z - 9], { c: '#ff3b1f', m: 'Neon' }, { role: role('kill') }); for (let k = 0; k < 4; k++) P0('Stone', [3, 1, 3], [x + (k % 2 ? 3 : -3), y, z - k * 6], T.path); z -= 20; }
      else if (kind === 'spinner') { z -= 14; P0('Disc', [18, 1, 18], [x, y, z], T.ground); seg.push(P('Part', 'Spinner', [16, 1.2, 1.2], [x, y + 1.6, z], [0, 0, 0], { c: '#ff3b5c', m: 'Neon' }, { role: role('spinner', { speed: 110 }) }));
        seg.push(P('Part', 'Hub', [2, 3, 3], [x, y + 1, z], [0, 0, 90], T.wall, { shape: 'Cylinder' })); seg.push(block('SpinnerKill', [15.8, 1, 1], [x, y + 1.6, z], { c: '#ff3b5c', m: 'Neon' }, { role: role('kill'), transparency: 1, canCollide: false, follow: 'Spinner' })); z -= 10; }
      else if (kind === 'mover') { z -= 8; P0('MovingPlatform', [8, 1, 8], [x, y, z], T.accent2, { role: role('mover', { dz: -16, period: 4 }) }); z -= 24; }
      else if (kind === 'pad') { z -= 8; P0('Base', [8, 1, 8], [x, y, z], T.path); seg.push(P('Part', 'JumpPad', [0.6, 5, 5], [x, y + 0.8, z], [0, 0, 90], T.glow, { shape: 'Cylinder', role: role('jumppad', { power: 95 }) })); y += 14; z -= 12; P0('Landing', [10, 1, 10], [x, y, z], T.accent); }
      else if (kind === 'truss') { z -= 8; P0('Base', [8, 1, 8], [x, y, z], T.path); seg.push(P('TrussPart', 'Truss', [2, 16, 2], [x, y + 8.5, z - 3], [0, 0, 0], M('#7d7d82', 'Metal'))); y += 16; P0('Top', [8, 1, 8], [x, y, z - 6], T.accent); z -= 6; }
      else if (kind === 'beam') { z -= 4; P0('Beam', [1.4, 1, 24], [x, y, z - 12], T.deco); z -= 26; P0('Rest', [8, 1, 6], [x, y, z], T.path); }
      else if (kind === 'conveyor') { z -= 6; seg.push(P('Part', 'Conveyor', [6, 1, 26], [x, y, z - 13], [0, 180, 0], { c: '#2d2d35', m: 'DiamondPlate' }, { role: role('conveyor', { speed: 14 }) }));
        P0('ConveyorKill', [14, 1, 26], [x, y - 3, z - 13], { c: '#ff3b1f', m: 'Neon' }, { role: role('kill') }); z -= 28; }
      else if (kind === 'wedges') { z -= 6; seg.push(P('WedgePart', 'Ramp', [8, 6, 12], [x, y + 2.5, z - 6], [0, 180, 0], T.accent)); y += 5.5; z -= 14; P0('Ledge', [8, 1, 6], [x, y, z], T.path); }
      if (s % 5 === 0 || s === n) { z -= 10; seg.push(block('Checkpoint', [10, 1, 10], [x, y, z], s === n ? { c: '#ffd34d', m: 'Neon' } : M('#3dd16b', 'SmoothPlastic'), { role: role('checkpoint', { stage: s }) })); if (s % 10 === 0) seg.push(...coinRow(3, [x - 3, y + 3, z], [3, 0, 0])); }
      out.push(model('Stage' + s, seg));
    }
    z -= 14; out.push(model('Finish', [block('FinishPad', [20, 2, 20], [x, y - 0.5, z], T.glow), block('Trophy', [3, 6, 3], [x, y + 3.5, z], M('#ffd34d', 'Foil')), ...coinRow(8, [x - 7, y + 3, z - 6], [2, 0, 0], 5)]));
    return out; } },
  tycoon: { e: '🏭', fr: 'Tycoon', tags: 'tycoon usine dropper argent cash acheter boutons convoyeur', opts: { plots: [1, 4, 2] }, make(T, r, o) {
    const out = [];
    for (let k = 0; k < o.plots; k++) {
      const ox = k * 90, kids = [], B = (name, s, p, m, e) => kids.push(block(name, s, [p[0] + ox, p[1], p[2]], m, e));
      B('Plot', [72, 2, 72], [0, 0, 0], T.ground); B('Border', [74, 1, 74], [0, -0.6, 0], T.path);
      kids.push(P('SpawnLocation', 'Spawn', [6, 1, 6], [ox, 1.5, 30], [0, 0, 0], T.glow));
      B('ClaimPad', [8, 1, 8], [-26, 1.5, 30], M('#3dd16b', 'Neon'), { role: role('claim') });
      // free starter line: conveyor + collector + one dropper
      kids.push(P('Part', 'Conveyor', [6, 1.4, 48], [ox + 8, 1.7, -4], [0, 0, 0], M('#2d2d35', 'DiamondPlate'), { role: role('conveyor', { speed: 10 }) }));
      B('RailL', [0.6, 1.2, 48], [4.7, 2.9, -4], M('#ffd34d', 'Metal')); B('RailR', [0.6, 1.2, 48], [11.3, 2.9, -4], M('#ffd34d', 'Metal'));
      B('Collector', [8, 3, 4], [8, 2.5, -30], M('#3dffa8', 'Neon'), { role: role('collector') });
      const dropper = (name, dz, val, mat) => model(name, [block('Base', [6, 1, 6], [ox + 16, 10, dz], T.wall), block('Body', [5, 5, 5], [ox + 16, 13, dz], mat), P('WedgePart', 'Chute', [4, 3, 4], [ox + 12.5, 11, dz], [0, 90, 0], T.wall),
        block('Arm', [8, 1, 2], [ox + 12, 9, dz], M('#3a3a42', 'Metal')), block('Output', [2, 1, 2], [ox + 8, 8, dz], M('#20202a', 'Metal'), { role: role('dropper', { interval: 2, value: val }) }),
        block('Pole', [2, 9, 2], [ox + 16, 4.5, dz], M('#3a3a42', 'Metal'))]);
      kids.push(dropper('Dropper1', 14, 5, T.accent));
      const buys = [['Dropper2', 120, 4], ['Upgrader', 300, 0], ['Dropper3', 600, -8], ['Walls', 900, 0], ['Dropper4', 2000, -18], ['Tower', 5000, 0]];
      buys.forEach(([name, price], i) => kids.push(block('Buy' + name, [5, 1, 5], [ox - 26 + (i % 3) * 7, 1.5, 6 - Math.floor(i / 3) * 8], M('#3dd16b', 'Neon'), { role: role('buybutton', { price, target: name }) })));
      kids.push(dropper('Dropper2', 4, 10, T.accent2)); kids.push(dropper('Dropper3', -8, 25, T.glow)); kids.push(dropper('Dropper4', -18, 80, M('#c86bff', 'Neon')));
      kids.push(model('Upgrader', [block('Frame', [8, 6, 1], [ox + 8, 5, 6], T.wall, { canCollide: false, transparency: 0 }), block('Field', [5, 4, 0.6], [ox + 8, 4, 6], M('#7cf7ff', 'ForceField'), { canCollide: false, role: role('upgrader', { mult: 2 }) })]));
      kids.push(model('Walls', [B2('WallN', [72, 10, 2], [ox, 6, -36], T.wall), B2('WallW', [2, 10, 72], [ox - 36, 6, 0], T.wall), B2('WallE', [2, 10, 72], [ox + 36, 6, 0], T.wall), B2('WallS1', [26, 10, 2], [ox - 23, 6, 36], T.wall), B2('WallS2', [26, 10, 2], [ox + 23, 6, 36], T.wall)]));
      kids.push(model('Tower', [block('Tower', [16, 34, 16], [ox - 20, 18, -20], T.deco), block('Roof', [18, 2, 18], [ox - 20, 36, -20], T.accent), block('Sign', [12, 4, 1], [ox - 20, 28, -11.4], T.glow)]));
      out.push(model('Tycoon' + (k + 1), kids, { tycoon: true }));
    }
    return out;
    function B2(name, s, p, m) { return block(name, s, p, m); } } },
  simulator: { e: '💎', fr: 'Simulator', tags: 'simulator simulateur zones farm collecter pieces portes debloquer', opts: { zones: [2, 6, 4] }, make(T, r, o) {
    const out = [], zcol = ['#ffd34d', '#5ad1ff', '#c86bff', '#ff5c7a', '#3dffa8', '#ffffff'], zmat = [T.ground, T.path, T.accent, T.deco, T.wall, T.rock];
    for (let k = 0; k < o.zones; k++) {
      const ox = k * 80, kids = [block('Floor', [78, 2, 90], [ox, 0, 0], zmat[k % zmat.length])];
      if (k === 0) kids.push(P('SpawnLocation', 'Spawn', [8, 1, 8], [ox, 1.5, 30], [0, 0, 0], T.glow));
      const val = [1, 4, 15, 60, 250, 1000][k];
      for (let i = 0; i < 26; i++) kids.push(P('Part', 'Coin', [0.5, 3, 3], [ox - 32 + r() * 64, 3, -38 + r() * 70], [0, r() * 180, 0], M(zcol[k % zcol.length], 'Neon'), { shape: 'Cylinder', canCollide: false, role: role('coin', { value: val, respawn: 6 }) }));
      for (let i = 0; i < 5; i++) kids.push(k % 2 ? model('Crystal', [P('WedgePart', 'Shard', [3, 8, 3], [ox - 34 + r() * 68, 5, -40 + r() * 80], [0, r() * 360, 0], M(zcol[k % zcol.length], 'Glass'))]) : tree(T, ox - 34 + r() * 68, -40 + r() * 80, r, 1));
      kids.push(block('Sign', [20, 6, 1], [ox, 9, 44], M(zcol[k % zcol.length], 'Neon'), { label: `ZONE ${k + 1} · ×${val}` }));
      if (k > 0) { const need = [0, 50, 400, 3000, 20000, 150000][k];
        kids.push(block('Gate', [2, 14, 88], [ox - 39, 8, 0], M(zcol[k % zcol.length], 'ForceField'), { transparency: 0.3, role: role('gate', { need }), label: `🔒 ${need} Coins` }));
        kids.push(block('GateTop', [4, 2, 90], [ox - 39, 16, 0], T.wall)); }
      out.push(model('Zone' + (k + 1), kids));
    }
    return out; } },
  lobby: { e: '🏛️', fr: 'Lobby', tags: 'lobby accueil hub spawn portails fontaine', opts: { size: [60, 160, 100] }, make(T, r, o) {
    const R = o.size / 2, out = [cyl('Floor', 2, o.size, [0, 0, 0], T.path), cyl('Rim', 1.6, o.size + 4, [0, -0.2, 0], T.wall), P('SpawnLocation', 'Spawn', [10, 1, 10], [0, 1.5, 18], [0, 0, 0], T.glow)];
    out.push(model('Fountain', [cyl('Basin', 3, 22, [0, 1.5, 0], T.wall), cyl('Water', 2.6, 19, [0, 2, 0], { c: T.water, m: 'Glass' }, { transparency: 0.35 }), cyl('Column', 10, 2.5, [0, 6, 0], T.rock), ball('Orb', 4, [0, 12.5, 0], T.glow, { light: { range: 26, brightness: 3 } })]));
    const n = 12; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, x = Math.sin(a) * (R - 6), z = Math.cos(a) * (R - 6);
      out.push(model('Pillar', [cyl('Shaft', 18, 3, [x, 10, z], T.wall), cyl('Cap', 1, 4.5, [x, 19.5, z], T.accent), ball('Glow', 2, [x, 21, z], T.glow)])); }
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.26, x = Math.sin(a) * 26, z = Math.cos(a) * 26; out.push(P('Part', 'Bench', [7, 1, 2.4], [x, 2, z], [0, (a * 180) / Math.PI, 0], T.deco)); }
    out.push(...portalPair(T, [0, 1, -(R - 16)], [0, 61, -(R - 16)], 'A'));
    out.push(model('Balcony', [cyl('Deck', 2, 30, [0, 60, -(R - 16)], T.accent), ...coinRow(10, [-9, 63, -(R - 16)], [2, 0, 0], 3)]));
    return out; } },
  arena: { e: '⚔️', fr: 'Arène', tags: 'arena arene combat pvp duel battle', opts: { size: [60, 200, 120] }, make(T, r, o) {
    const R = o.size / 2, out = [cyl('Floor', 2, o.size, [0, 0, 0], T.ground)], segs = 28;
    for (let k = 0; k < segs; k++) { const a = (k / segs) * Math.PI * 2, w = (2 * Math.PI * R) / segs + 1;
      out.push(P('Part', 'Wall', [w, 18, 3], [Math.sin(a) * R, 9, Math.cos(a) * R], [0, (a * 180) / Math.PI, 0], T.wall)); if (k % 2 === 0) out.push(P('Part', 'Trim', [w, 1, 3.4], [Math.sin(a) * R, 18.5, Math.cos(a) * R], [0, (a * 180) / Math.PI, 0], T.glow)); }
    out.push(model('Center', [cyl('Dais', 4, 26, [0, 2, 0], T.accent), cyl('Ring', 0.6, 28, [0, 4.1, 0], T.glow)]));
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      out.push(P('WedgePart', 'Ramp', [10, 4, 12], [Math.sin(a) * 19, 2, Math.cos(a) * 19], [0, (a * 180) / Math.PI, 0], T.path));
      out.push(P('SpawnLocation', 'Spawn' + (k + 1), [6, 1, 6], [Math.sin(a + Math.PI / 4) * (R - 10), 1.5, Math.cos(a + Math.PI / 4) * (R - 10)], [0, 0, 0], T.glow)); }
    for (let k = 0; k < 10; k++) { const a = r() * Math.PI * 2, d = 24 + r() * (R - 34); out.push(block('Cover', [4 + r() * 6, 5 + r() * 4, 2 + r() * 4], [Math.sin(a) * d, 4, Math.cos(a) * d], pick(r, [T.rock, T.deco, T.wall]))); }
    return out; } },
  island: { e: '🏝️', fr: 'Île', tags: 'island ile plage mer palmiers tropical', opts: { size: [60, 220, 120] }, make(T, r, o) {
    const D = o.size, out = [block('Ocean', [D * 4, 1, D * 4], [0, -3, 0], { c: T.water, m: 'Glass' }, { transparency: 0.25, canCollide: false }), block('SeaFloor', [D * 4, 1, D * 4], [0, -9, 0], M('#d8c08f', 'Sand'))];
    out.push(model('Land', [cyl('Beach', 4, D, [0, -1, 0], M('#e8d3a0', 'Sand')), cyl('Grass', 3, D * 0.78, [0, 1.5, 0], T.ground), cyl('Hill', 5, D * 0.4, [D * 0.08, 5, -D * 0.06], T.ground)]));
    out.push(P('SpawnLocation', 'Spawn', [8, 1, 8], [0, 3.5, D * 0.25], [0, 0, 0], T.glow));
    for (let k = 0; k < Math.round(D / 12); k++) { const a = r() * Math.PI * 2, d = D * (0.2 + r() * 0.26); out.push(palm(T, Math.sin(a) * d, Math.cos(a) * d, r, 3)); }
    for (let k = 0; k < 8; k++) { const a = r() * Math.PI * 2, d = D * 0.44; out.push(ball('Rock', 3 + r() * 5, [Math.sin(a) * d, 0.5, Math.cos(a) * d], T.rock)); }
    const dz = D / 2; out.push(model('Dock', [block('Deck', [8, 1, 30], [0, 0.8, dz + 12], M('#8a6239', 'WoodPlanks')), ...[0, 1, 2, 3].flatMap((i) => [cyl('Post', 6, 1, [-3.6, -1.5, dz + i * 9], T.trunk), cyl('Post', 6, 1, [3.6, -1.5, dz + i * 9], T.trunk)])]));
    out.push(...coinRow(10, [-9, 5, 0], [2, 0, 0], 2));
    return out; } },
  city: { e: '🏙️', fr: 'Ville', tags: 'city ville immeubles routes urbain rue', opts: { blocks: [2, 6, 4] }, make(T, r, o) {
    const n = o.blocks, cell = 60, out = [], off = ((n - 1) * cell) / 2;
    out.push(block('Ground', [n * cell + 20, 1, n * cell + 20], [0, -0.5, 0], M('#2b2b30', 'Asphalt')));
    for (let i = 0; i <= n; i++) { const c = i * cell - off - cell / 2;
      out.push(block('RoadX', [n * cell + 20, 0.2, 14], [0, 0.1, c], M('#232327', 'Asphalt'))); out.push(block('RoadZ', [14, 0.2, n * cell + 20], [c, 0.11, 0], M('#232327', 'Asphalt')));
      for (let k = 0; k < n * 4; k++) { out.push(block('Line', [6, 0.05, 0.5], [k * 15 - off - 22, 0.25, c], M('#f5f5f5', 'SmoothPlastic'), { canCollide: false })); } }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const cx = i * cell - off, cz = j * cell - off, kids = [block('Sidewalk', [44, 1, 44], [cx, 0.5, cz], M('#9a9aa0', 'Concrete'))];
      for (let b = 0; b < 4; b++) { const bx = cx + (b % 2 ? 10 : -10), bz = cz + (b > 1 ? 10 : -10), h = 16 + r() * 60, mat = pick(r, [M('#9fb4c7', 'Glass'), M('#7a7a80', 'Concrete'), M('#b0623b', 'Brick'), T.wall]);
        kids.push(block('Building', [16, h, 16], [bx, h / 2 + 1, bz], mat)); for (let f = 6; f < h - 2; f += 6) kids.push(block('Windows', [16.2, 1, 16.2], [bx, f + 1, bz], r() < 0.5 ? T.glow : M('#ffe9a8', 'Neon'), { canCollide: false }));
        kids.push(block('Roof', [17, 1, 17], [bx, h + 1.5, bz], M('#2b2b30', 'Metal'))); }
      kids.push(lamp(T, cx - 21, cz - 21, 1)); out.push(model('Block' + (i + 1) + '_' + (j + 1), kids)); }
    out.push(P('SpawnLocation', 'Spawn', [10, 1, 10], [-off - cell / 2, 0.8, -off - cell / 2], [0, 0, 0], T.glow));
    return out; } },
  cave: { e: '🕳️', fr: 'Grotte', tags: 'cave grotte tunnel mine cristaux souterrain', opts: { length: [6, 30, 14] }, make(T, r, o) {
    const out = [P('SpawnLocation', 'Spawn', [8, 1, 8], [0, 1, 6], [0, 0, 0], T.glow)], R = 14;
    for (let s = 0; s < o.length; s++) { const z = -s * 10, kids = [block('Floor', [26, 2, 10.5], [Math.sin(s * 0.4) * 4, 0, z], T.path)];
      for (let k = 0; k <= 8; k++) { const a = Math.PI * (k / 8), x = Math.cos(a) * R + Math.sin(s * 0.4) * 4, y = Math.sin(a) * R * 0.9 + 1;
        kids.push(P('Part', 'Rock', [5 + r() * 2, 2.5 + r(), 10.5], [x, y, z], [0, 0, (a * 180) / Math.PI + 90], T.rock)); }
      if (r() < 0.6) kids.push(P('WedgePart', 'Crystal', [1.5, 3 + r() * 3, 2], [Math.sin(s * 0.4) * 4 + (r() < 0.5 ? -9 : 9), 3, z], [0, r() * 360, (r() - 0.5) * 40], pick(r, [T.glow, T.accent, M('#7cf7ff', 'Neon')]), { light: r() < 0.5 ? { range: 14, brightness: 2 } : null }));
      if (s % 4 === 2) kids.push(block('LavaPool', [8, 0.6, 6], [Math.sin(s * 0.4) * 4, 1.1, z], M('#ff4800', 'Neon'), { role: role('kill') }));
      if (s % 3 === 1) kids.push(...coinRow(2, [Math.sin(s * 0.4) * 4 - 2, 3, z], [4, 0, 0], 2));
      out.push(model('Segment' + (s + 1), kids)); }
    return out; } },
  sky: { e: '☁️', fr: 'Îles du ciel', tags: 'sky ciel iles flottantes nuages jump', opts: { islands: [4, 16, 8] }, make(T, r, o) {
    const out = [], pos = [[0, 30, 0]];
    for (let k = 1; k < o.islands; k++) { const p = pos[k - 1], a = r() * Math.PI - Math.PI / 2; pos.push([p[0] + Math.sin(a) * 34, p[1] + 6 + r() * 10, p[2] - Math.cos(a) * 34 - 6]); }
    pos.forEach((p, k) => { const d = 20 + r() * 12, kids = [cyl('Top', 3, d, p, T.ground), cyl('Under', 6, d * 0.7, [p[0], p[1] - 4, p[2]], T.rock), cyl('Tip', 6, d * 0.35, [p[0], p[1] - 9, p[2]], T.rock)];
      if (k === 0) kids.push(P('SpawnLocation', 'Spawn', [8, 1, 8], [p[0], p[1] + 2, p[2]], [0, 0, 0], T.glow));
      if (k < pos.length - 1) kids.push(P('Part', 'JumpPad', [0.6, 5, 5], [p[0], p[1] + 1.8, p[2] - d / 2 + 4], [0, 0, 90], T.glow, { shape: 'Cylinder', role: role('jumppad', { power: 110 }) }));
      if (k % 3 === 2) kids.push(block('Checkpoint', [8, 1, 8], [p[0] + 5, p[1] + 2, p[2] + 3], M('#3dd16b', 'SmoothPlastic'), { role: role('checkpoint', { stage: k }) }));
      if (r() < 0.7) kids.push(tree(T, p[0] + (r() - 0.5) * d * 0.5, p[2] + (r() - 0.5) * d * 0.5, r, p[1] + 1.5, 0.7));
      kids.push(...coinRow(3, [p[0] - 3, p[1] + 4, p[2]], [3, 0, 0], 2)); out.push(model('Island' + (k + 1), kids)); });
    for (let k = 0; k < o.islands * 2; k++) out.push(ball('Cloud', 8 + r() * 10, [(r() - 0.5) * 120, 10 + r() * 60, -r() * 34 * o.islands], M('#ffffff', 'SmoothPlastic'), { transparency: 0.25, canCollide: false }));
    out.push(block('Abyss', [600, 1, 600], [0, -40, -100], M('#000000', 'Neon'), { role: role('kill'), transparency: 1 }));
    return out; } },
};

/* ---------- tree helpers ---------- */
export function walk(n, fn, parent = null, depth = 0) { if (fn(n, parent, depth) === false) return; for (const c of n.children || []) walk(c, fn, n, depth + 1); }
export function find(root, id) { let r = null; walk(root, (n) => { if (n.id === id) { r = n; return false; } }); return r; }
export function parentOf(root, id) { let r = null; walk(root, (n, p) => { if (n.id === id) { r = p; return false; } }); return r; }
export function partsOf(n) { const out = []; walk(n, (x) => { if (x.cls !== 'Model' && x.cls !== 'Folder') out.push(x); }); return out; }
export function cloneNode(n) { const c = JSON.parse(JSON.stringify(n)); walk(c, (x) => { x.id = nid(); }); return c; }
export function newMap(gen = 'obby', theme = 'plaine', seed = 7) {
  const T = THEMES[theme], g = GENERATORS[gen], opts = Object.fromEntries(Object.entries(g.opts).map(([k, v]) => [k, v[2]]));
  return { v: 1, name: 'ForgeMap', theme, lighting: { preset: T.light, over: {} }, gen: { id: gen, seed, opts }, root: { id: nid(), cls: 'Folder', name: 'ForgeMap', children: g.make(T, rng(seed), opts) } };
}

/* ---------- Rojo export ---------- */
const hex01 = (h) => { const n = parseInt(String(h).slice(1, 7), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => +v.toFixed(4)); };
const D2R = Math.PI / 180;
export function orientation(r) { // rows of R = Rx * Ry * Rz (CFrame.Angles, three.js Euler XYZ)
  const [a, b, c] = r.map((v) => v * D2R), ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
  return [[cb * cc, -cb * sc, sb], [ca * sc + sa * sb * cc, ca * cc - sa * sb * sc, -sa * cb], [sa * sc - ca * sb * cc, sa * cc + ca * sb * sc, ca * cb]].map((row) => row.map((v) => +v.toFixed(6)));
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);
function partJson(p) {
  const props = { Size: p.shape === 'Ball' ? [p.size[0], p.size[0], p.size[0]] : p.size, CFrame: { CFrame: { position: p.pos, orientation: orientation(p.rot) } },
    Color: hex01(p.color), Material: p.material, Transparency: +(p.transparency || 0), Anchored: p.anchored !== false, CanCollide: p.canCollide !== false,
    TopSurface: 'Smooth', BottomSurface: 'Smooth' };
  if (p.cls === 'Part' && p.shape && p.shape !== 'Block') props.Shape = p.shape;
  if (p.cls === 'SpawnLocation') { props.Neutral = true; props.Duration = 0; }
  if (p.reflectance) props.Reflectance = +p.reflectance;
  const node = { name: p.name, className: p.cls, properties: props, children: [] };
  const attrs = {};
  if (p.role) { attrs.ForgeRole = p.role.type; for (const [k, v] of Object.entries(p.role)) if (k !== 'type') attrs['Forge' + cap(k)] = typeof v === 'number' ? v : String(v); }
  if (p.label) attrs.ForgeLabel = p.label;
  if (p.follow) attrs.ForgeFollow = p.follow;
  if (p.vox) attrs.ForgeVox = p.vox;
  if (p.attrs) Object.assign(attrs, p.attrs);
  if (Object.keys(attrs).length) node.attributes = attrs;
  if (p.light) node.children.push({ name: 'Light', className: 'PointLight', properties: { Color: hex01(p.color), Range: p.light.range || 16, Brightness: p.light.brightness || 2, Shadows: false } });
  return node;
}
function nodeJson(n) {
  if (n.cls === 'Model' || n.cls === 'Folder') { const out = { name: n.name, className: n.cls, children: (n.children || []).map(nodeJson) }; if (n.tycoon || n.attributes) out.attributes = { ...(n.attributes || {}), ...(n.tycoon ? { ForgeTycoon: true } : {}) }; return out; }
  return partJson(n);
}
export function mapModel(map) {
  const L = lightingOf(map), m = nodeJson(map.root);
  m.attributes = { ...(m.attributes || {}), ForgeMap: true, ForgeClockTime: L.ClockTime, ForgeBrightness: L.Brightness, ForgeAmbient: L.Ambient, ForgeOutdoorAmbient: L.OutdoorAmbient };
  delete m.name; return m;
}
export function lightingModels(map) {
  const L = lightingOf(map);
  return {
    Atmosphere: { className: 'Atmosphere', properties: { Density: L.atmo.Density, Offset: 0.1, Color: hex01(L.atmo.Color), Decay: hex01(L.atmo.Decay), Glare: L.atmo.Glare, Haze: L.atmo.Haze } },
    ForgeBloom: { className: 'BloomEffect', properties: { Intensity: L.bloom.Intensity, Size: L.bloom.Size, Threshold: L.bloom.Threshold } },
    ForgeColor: { className: 'ColorCorrectionEffect', properties: { Saturation: L.cc.Saturation, Contrast: L.cc.Contrast, TintColor: hex01(L.cc.TintColor), Brightness: 0 } },
    ForgeSunRays: { className: 'SunRaysEffect', properties: { Intensity: L.rays || 0, Spread: 0.6 } },
  };
}
export function stats(map) { const c = { parts: 0, models: 0, roles: {} }; walk(map.root, (n) => { if (n.cls === 'Model') c.models++; else if (n.cls !== 'Folder') { c.parts++; if (n.role) c.roles[n.role.type] = (c.roles[n.role.type] || 0) + 1; } }); return c; }
