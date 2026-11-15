/* =====================================================================
   Roblox Forge - parametric model families for the scene generator.
   One family covers many words: building({sign:'École'}) for école, hôpital,
   banque…; vehicle({type:'car', color}) for voiture, taxi, jeep…; food({shape})
   for pomme, orange, gâteau… Every builder: (T, x, z, r, y, o) -> Model.
   Kenney-style rules: 3-tone colours, dark trims, chunky readable shapes.
   ===================================================================== */
import { P, block, cyl, ball, model } from './map-core.js';
import { voxelCritter } from '../studio/voxel-critters.js';

const M = (c, m) => ({ c, m });
const noCol = { canCollide: false };
export const shade = (hex, f) => { const n = parseInt(String(hex).slice(1), 16); return '#' + [16, 8, 0].map((k) => { const v = (n >> k) & 255; return Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f))); }).map((v) => v.toString(16).padStart(2, '0')).join(''); };
const pick = (r, a) => a[Math.floor(r() * a.length)];
const CAR = ['#e8413a', '#3f86ff', '#ffd84d', '#4cc46a', '#f6f6f6', '#2b2b33', '#ff9a3c'];

/* ---------- vehicles ---------- */
export function vehicle(T, x, z, r, y = 0, o = {}) {
  const c = o.color || pick(r, CAR), body = M(c, 'SmoothPlastic'), dark = M('#2b2b33', 'Plastic'), glass = M('#bfe3ff', 'Glass'), t = o.type || 'car', s = o.scale || 1, k = [];
  const wheel = (dx, dz, d = 1.6) => k.push(cyl('Wheel', 0.9 * s, d * s, [x + dx * s, y + d * 0.5 * s, z + dz * s], dark, { rot: [0, 0, 0] }), cyl('Hub', 0.95 * s, d * 0.45 * s, [x + dx * s, y + d * 0.5 * s, z + dz * s], M('#c9d1dd', 'Metal'), { canCollide: false, rot: [0, 0, 0] }));
  if (t === 'car' || t === 'taxi' || t === 'police' || t === 'jeep') {
    k.push(block('Body', [4.2 * s, 1.5 * s, 8 * s], [x, y + 1.6 * s, z], body), block('Cabin', [3.8 * s, 1.5 * s, 4 * s], [x, y + 3 * s, z + 0.4 * s], body),
      block('Windshield', [3.6 * s, 1.2 * s, 0.2 * s], [x, y + 3 * s, z - 1.65 * s], glass, noCol), block('Bumper', [4.4 * s, 0.5 * s, 0.4 * s], [x, y + 1.1 * s, z - 4.1 * s], M('#c9d1dd', 'Metal'), noCol),
      ...[-1.4, 1.4].map((dx) => block('Headlight', [0.8 * s, 0.4 * s, 0.2 * s], [x + dx * s, y + 1.8 * s, z - 4.05 * s], M('#fff3c4', 'Neon'), noCol)));
    if (t === 'taxi') k.push(block('Sign', [1.6 * s, 0.6 * s, 0.6 * s], [x, y + 4.1 * s, z + 0.4 * s], M('#2b2b33', 'SmoothPlastic'), noCol));
    if (t === 'police') k.push(block('Siren', [0.8 * s, 0.5 * s, 0.5 * s], [x - 0.5 * s, y + 4 * s, z + 0.4 * s], M('#ff3b3b', 'Neon'), noCol), block('Siren', [0.8 * s, 0.5 * s, 0.5 * s], [x + 0.5 * s, y + 4 * s, z + 0.4 * s], M('#3f86ff', 'Neon'), noCol));
    for (const dx of [-2, 2]) for (const dz of [-2.6, 2.6]) wheel(dx, dz);
  } else if (t === 'truck' || t === 'bus' || t === 'firetruck') {
    const L = t === 'bus' ? 14 : 12; k.push(block('Body', [4.6 * s, t === 'bus' ? 5 * s : 4 * s, L * s], [x, y + (t === 'bus' ? 3.4 : 3) * s, z], body));
    if (t === 'bus') for (let i = 0; i < 5; i++) k.push(block('Window', [4.7 * s, 1.4 * s, 1.8 * s], [x, y + 4.4 * s, z - 5 * s + i * 2.5 * s], glass, noCol));
    else k.push(block('Cab', [4.6 * s, 2 * s, 3 * s], [x, y + 5.8 * s, z - 4.2 * s], body), block('Windshield', [4 * s, 1.4 * s, 0.2 * s], [x, y + 5.8 * s, z - 5.75 * s], glass, noCol));
    if (t === 'firetruck') k.push(block('Ladder', [1.2 * s, 0.5 * s, 9 * s], [x, y + 5.3 * s, z + 1.5 * s], M('#c9d1dd', 'Metal'), noCol));
    for (const dx of [-2.2, 2.2]) for (const dz of [-L / 2 + 2, L / 2 - 2]) wheel(dx, dz, 2);
  } else if (t === 'boat' || t === 'sailboat') {
    k.push(block('Hull', [5 * s, 2 * s, 12 * s], [x, y + 1 * s, z], body), P('WedgePart', 'Bow', [5 * s, 2 * s, 3 * s], [x, y + 1 * s, z - 7.5 * s], [0, 180, 0], body),
      block('Deck', [4.4 * s, 0.3 * s, 11 * s], [x, y + 2.1 * s, z], M('#b8794a', 'WoodPlanks')));
    if (t === 'sailboat') k.push(block('Mast', [0.4 * s, 12 * s, 0.4 * s], [x, y + 8 * s, z], M('#6b4426', 'Wood')), P('WedgePart', 'Sail', [0.2 * s, 9 * s, 6 * s], [x, y + 7.5 * s, z + 3 * s], [0, 0, 0], M('#f6f6f6', 'Fabric'), noCol));
    else k.push(block('Cabin', [3.6 * s, 2.4 * s, 4 * s], [x, y + 3.4 * s, z + 2 * s], M('#f6f6f6', 'SmoothPlastic')));
  } else if (t === 'plane' || t === 'jet') {
    k.push(cyl('Fuselage', 3 * s, 14 * s, [x, y + 4 * s, z], body, { rot: [0, 90, 0] }), P('WedgePart', 'Nose', [3 * s, 3 * s, 2.5 * s], [x, y + 4 * s, z - 8.2 * s], [0, 180, 0], body),
      block('Wing', [18 * s, 0.4 * s, 3.4 * s], [x, y + 3.6 * s, z], M(shade(c, 0.85), 'SmoothPlastic')), block('Tail', [6 * s, 0.4 * s, 2 * s], [x, y + 4.4 * s, z + 6.2 * s], M(shade(c, 0.85), 'SmoothPlastic')),
      block('Fin', [0.4 * s, 3 * s, 2.4 * s], [x, y + 6.2 * s, z + 6.2 * s], M(shade(c, 0.85), 'SmoothPlastic')), block('Cockpit', [2.2 * s, 1 * s, 2 * s], [x, y + 5.4 * s, z - 5 * s], glass, noCol));
  } else if (t === 'helicopter') {
    k.push(ball('Body', 5 * s, [x, y + 3.5 * s, z], body), block('TailBoom', [0.8 * s, 0.8 * s, 7 * s], [x, y + 4 * s, z + 5.5 * s], body), block('Rotor', [12 * s, 0.2 * s, 0.6 * s], [x, y + 6.4 * s, z], dark, noCol),
      block('Rotor', [0.6 * s, 0.2 * s, 12 * s], [x, y + 6.4 * s, z], dark, noCol), ...[-1.6, 1.6].map((dx) => block('Skid', [0.3 * s, 0.3 * s, 6 * s], [x + dx * s, y + 0.3 * s, z], dark)));
  } else if (t === 'rocket') {
    k.push(cyl('Body', 16 * s, 4 * s, [x, y + 9 * s, z], M('#f6f6f6', 'SmoothPlastic')), P('Part', 'Nose', [4 * s, 4 * s, 4 * s], [x, y + 17.5 * s, z], [0, 0, 0], body, { shape: 'Ball' }),
      ...[0, 120, 240].map((a) => block('Fin', [0.4 * s, 4 * s, 3 * s], [x + Math.sin(a / 57.3) * 2.2 * s, y + 2.5 * s, z + Math.cos(a / 57.3) * 2.2 * s], body, { rot: [0, a, 0] })),
      ball('Window', 1.6 * s, [x, y + 12 * s, z - 1.8 * s], glass, noCol), P('WedgePart', 'Flame', [2 * s, 3 * s, 2 * s], [x, y - 0.5 * s, z], [180, 0, 0], M('#ff9a1a', 'Neon'), noCol));
  } else if (t === 'bike') {
    for (const dz of [-1.6, 1.6]) k.push(cyl('Wheel', 0.25 * s, 2.4 * s, [x, y + 1.2 * s, z + dz * s], dark, { rot: [0, 90, 0] }));
    k.push(block('Frame', [0.3 * s, 0.3 * s, 3.4 * s], [x, y + 1.9 * s, z], body), block('Seat', [0.7 * s, 0.25 * s, 1 * s], [x, y + 2.8 * s, z + 0.7 * s], dark), block('Bar', [2 * s, 0.25 * s, 0.25 * s], [x, y + 2.9 * s, z - 1.3 * s], dark));
  } else if (t === 'train') {
    k.push(block('Loco', [5 * s, 5 * s, 10 * s], [x, y + 3.5 * s, z], body), cyl('Boiler', 9 * s, 4 * s, [x, y + 4 * s, z - 2 * s], M('#2b2b33', 'Metal'), { rot: [0, 90, 0] }), cyl('Chimney', 2.4 * s, 1.4 * s, [x, y + 7 * s, z - 5 * s], M('#2b2b33', 'Metal')),
      ...[-4, -1.3, 1.3, 4].map((dz) => cyl('Wheel', 0.8 * s, 2.2 * s, [x - 2.6 * s, y + 1.1 * s, z + dz * s], M('#c0392b', 'Metal'), { rot: [0, 0, 0] })), ...[-4, -1.3, 1.3, 4].map((dz) => cyl('Wheel', 0.8 * s, 2.2 * s, [x + 2.6 * s, y + 1.1 * s, z + dz * s], M('#c0392b', 'Metal'), { rot: [0, 0, 0] })));
  }
  return model(o.name || ({ car: 'Car', taxi: 'Taxi', police: 'PoliceCar', jeep: 'Jeep', truck: 'Truck', bus: 'Bus', firetruck: 'FireTruck', boat: 'Boat', sailboat: 'Sailboat', plane: 'Plane', jet: 'Jet', helicopter: 'Helicopter', rocket: 'Rocket', bike: 'Bike', train: 'Train' })[t] || 'Vehicle', k);
}

/* ---------- buildings: one family, many signs ---------- */
export function building(T, x, z, r, y = 0, o = {}) {
  const floors = o.floors || 2, w = o.w || 16, d = o.d || 14, h = floors * 6, wall = M(o.color || pick(r, ['#f4e3c3', '#e8d0b0', '#cfd8e3', '#f2c4b5', '#d8e6c8']), o.mat || 'Brick'), trim = M('#f4efe6', 'SmoothPlastic'), k = [];
  k.push(block('Walls', [w, h, d], [x, y + h / 2, z], wall), block('Base', [w + 0.6, 1, d + 0.6], [x, y + 0.5, z], M('#7d7f86', 'Concrete')), block('Roof', [w + 1, 0.8, d + 1], [x, y + h + 0.4, z], M(o.roof || '#5a606e', 'Slate')));
  for (let f = 0; f < floors; f++) for (let i = 0; i < Math.floor(w / 4); i++) { const wx = x - w / 2 + 2 + i * 4; if (f === 0 && Math.abs(wx - x) < 2.5) continue;
    k.push(block('Window', [2, 2.4, 0.2], [wx, y + 3.4 + f * 6, z - d / 2 - 0.05], M('#9fd3ff', 'Glass'), noCol), block('Sill', [2.4, 0.3, 0.4], [wx, y + 2.1 + f * 6, z - d / 2 - 0.15], trim, noCol)); }
  k.push(block('Door', [3, 4.4, 0.3], [x, y + 2.2, z - d / 2 - 0.1], M('#6b4426', 'WoodPlanks'), noCol), block('Awning', [5, 0.4, 1.6], [x, y + 4.8, z - d / 2 - 0.8], M(o.accent || '#c0392b', 'Fabric'), noCol));
  if (o.sign) k.push(block('SignBoard', [Math.min(w - 2, 2 + o.sign.length * 0.9), 2, 0.4], [x, y + h - 1.2, z - d / 2 - 0.3], M(o.accent || '#c0392b', 'SmoothPlastic'), { canCollide: false, label: o.sign }));
  if (o.cross) k.push(block('CrossV', [1, 3.6, 0.3], [x, y + h + 2.6, z - d / 2 + 1], M('#ff3b3b', 'Neon'), noCol), block('CrossH', [3.6, 1, 0.3], [x, y + h + 2.6, z - d / 2 + 1], M('#ff3b3b', 'Neon'), noCol));
  if (o.tower) k.push(block('Tower', [5, 10, 5], [x + w / 2 - 3, y + h + 5, z], wall), P('WedgePart', 'Spire', [5, 6, 2.5], [x + w / 2 - 3, y + h + 13, z - 1.25], [0, 0, 0], M(o.roof || '#5a606e', 'Slate')), P('WedgePart', 'Spire', [5, 6, 2.5], [x + w / 2 - 3, y + h + 13, z + 1.25], [0, 180, 0], M(o.roof || '#5a606e', 'Slate')));
  return model(o.name || 'Building', k);
}
export function skyscraper(T, x, z, r, y = 0, o = {}) { const floors = o.floors || 14, c = o.color || pick(r, ['#9fb4c9', '#7e8fa3', '#c4cfdb', '#5f7d99']), k = [block('Tower', [14, floors * 4, 14], [x, y + floors * 2, z], M(c, 'Concrete'))];
  for (let f = 1; f < floors; f++) k.push(block('Band', [14.3, 1.4, 14.3], [x, y + f * 4, z], M('#bfe3ff', 'Glass'), noCol));
  k.push(block('Top', [8, 4, 8], [x, y + floors * 4 + 2, z], M(shade(c, 0.8), 'Concrete')), block('Antenna', [0.5, 8, 0.5], [x, y + floors * 4 + 8, z], M('#2b2b33', 'Metal'), noCol), ball('Beacon', 1, [x, y + floors * 4 + 12.4, z], M('#ff3b3b', 'Neon'), noCol));
  return model('Skyscraper', k); }
export function roundTower(T, x, z, r, y = 0, o = {}) { const lh = !!o.lighthouse, c = o.color || (lh ? '#f6f6f6' : '#a7adb8'), k = [cyl('Tower', 24, 8, [x, y + 12, z], M(c, lh ? 'SmoothPlastic' : 'Cobblestone'))];
  if (lh) for (const h of [5, 13, 21]) k.push(cyl('Stripe', 3, 8.1, [x, y + h, z], M('#e8413a', 'SmoothPlastic'), noCol));
  k.push(cyl('Top', 3, 9.5, [x, y + 25.5, z], M('#3a3f4a', 'Metal')), cyl('Lamp', 3, 5, [x, y + 28.5, z], M(lh ? '#fff3c4' : '#9fd3ff', lh ? 'Neon' : 'Glass'), noCol), ball('Dome', 5.5, [x, y + 30.5, z], M('#e8413a', 'Metal')));
  return model(lh ? 'Lighthouse' : 'Tower', k); }
export function hut(T, x, z, r, y = 0, o = {}) { const k = [];
  for (let i = 0; i < 6; i++) k.push(block('Log', [8, 1.1, 1.1], [x, y + 0.6 + i * 1.1, z - 3.5], M(i % 2 ? '#8a5a33' : '#7d5232', 'Wood'), { shape: 'Cylinder' }), block('Log', [8, 1.1, 1.1], [x, y + 0.6 + i * 1.1, z + 3.5], M(i % 2 ? '#7d5232' : '#8a5a33', 'Wood'), { shape: 'Cylinder' }),
    block('Log', [1.1, 1.1, 8], [x - 3.5, y + 1.15 + i * 1.1, z], M(i % 2 ? '#8a5a33' : '#7d5232', 'Wood')), block('Log', [1.1, 1.1, 8], [x + 3.5, y + 1.15 + i * 1.1, z], M(i % 2 ? '#7d5232' : '#8a5a33', 'Wood')));
  for (const s of [-1, 1]) k.push(block('Roof', [5.6, 0.5, 9.4], [x + s * 2.3, y + 8.3, z], M(o.roof || '#5a606e', 'Slate'), { rot: [0, 0, s * -35] }));
  k.push(block('Door', [0.2, 3.4, 2], [x - 4.1, y + 1.8, z], M('#4a2d1a', 'Wood'), noCol));
  return model(o.name || 'Cabin', k); }

/* ---------- furniture ---------- */
export function furniture(T, x, z, r, y = 0, o = {}) { const t = o.type || 'table', c = M(o.color || '#a96c40', o.color ? 'SmoothPlastic' : 'WoodPlanks'), k = [], s = o.scale || 1;
  const legs = (w, d, h) => { for (const dx of [-w / 2 + 0.3, w / 2 - 0.3]) for (const dz of [-d / 2 + 0.3, d / 2 - 0.3]) k.push(block('Leg', [0.4, h, 0.4], [x + dx, y + h / 2, z + dz], M('#6b4426', 'Wood'))); };
  if (t === 'table') { legs(6 * s, 4 * s, 3 * s); k.push(block('Top', [6 * s, 0.4, 4 * s], [x, y + 3.1 * s, z], c)); }
  else if (t === 'chair') { legs(2.2, 2.2, 2); k.push(block('Seat', [2.4, 0.3, 2.4], [x, y + 2.1, z], c), block('Back', [2.4, 2.6, 0.3], [x, y + 3.4, z + 1.05], c)); }
  else if (t === 'bed') k.push(block('Frame', [5, 1.4, 8], [x, y + 0.7, z], M('#8a5a33', 'WoodPlanks')), block('Mattress', [4.6, 0.8, 7.6], [x, y + 1.8, z], M('#f6f6f6', 'Fabric')), block('Blanket', [4.7, 0.3, 5], [x, y + 2.3, z + 1.2], M(o.color || '#3f86ff', 'Fabric')), block('Pillow', [3, 0.6, 1.4], [x, y + 2.5, z - 3], M('#ffffff', 'Fabric')), block('Head', [5, 3, 0.5], [x, y + 2.2, z - 4], M('#8a5a33', 'WoodPlanks')));
  else if (t === 'sofa') k.push(block('Seat', [8, 1.6, 3.4], [x, y + 1.3, z], M(o.color || '#c0392b', 'Fabric')), block('Back', [8, 2.6, 1], [x, y + 2.6, z + 1.4], M(shade(o.color || '#c0392b', 0.85), 'Fabric')), ...[-3.7, 3.7].map((dx) => block('Arm', [0.8, 2.4, 3.4], [x + dx, y + 1.8, z], M(shade(o.color || '#c0392b', 0.85), 'Fabric'))));
  else if (t === 'shelf') { k.push(block('Case', [6, 8, 2], [x, y + 4, z], M('#8a5a33', 'WoodPlanks'))); for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) k.push(block('Book', [0.55, 1.5 + r() * 0.4, 1.6], [x - 2.6 + j * 0.7, y + 1.1 + i * 1.9, z - 0.15], M(pick(r, ['#e8413a', '#3f86ff', '#ffd84d', '#4cc46a', '#9a5cff']), 'SmoothPlastic'), noCol)); }
  else if (t === 'lamp') k.push(cyl('Pole', 6, 0.4, [x, y + 3, z], M('#2b2b33', 'Metal')), cyl('Shade', 1.8, 2.4, [x, y + 6.3, z], M(o.color || '#ffd27a', 'Fabric')), ball('Bulb', 0.8, [x, y + 5.8, z], M('#fff3c4', 'Neon'), noCol));
  else if (t === 'tv') k.push(block('Screen', [7, 4, 0.4], [x, y + 4, z], M('#14141c', 'SmoothPlastic')), block('Glow', [6.4, 3.4, 0.1], [x, y + 4, z - 0.25], M('#3ee6ff', 'Neon'), noCol), block('Stand', [2, 2, 1.4], [x, y + 1, z], M('#2b2b33', 'Metal')));
  else if (t === 'computer') k.push(block('Desk', [6, 0.4, 3], [x, y + 3, z], M('#a96c40', 'WoodPlanks')), ...[-2.7, 2.7].map((dx) => block('Leg', [0.4, 3, 2.6], [x + dx, y + 1.5, z], M('#6b4426', 'Wood'))), block('Monitor', [3, 2, 0.3], [x, y + 4.6, z + 0.6], M('#14141c', 'SmoothPlastic')), block('Glow', [2.7, 1.7, 0.1], [x, y + 4.6, z + 0.4], M('#9fd3ff', 'Neon'), noCol), block('Keyboard', [2.4, 0.15, 0.8], [x, y + 3.3, z - 0.6], M('#2b2b33', 'Plastic'), noCol));
  else if (t === 'piano') k.push(block('Body', [7, 4, 3], [x, y + 3, z], M('#14141c', 'SmoothPlastic')), block('Keys', [6.4, 0.3, 1.2], [x, y + 3.1, z - 2], M('#f6f6f6', 'SmoothPlastic'), noCol), ...[-3, 3].map((dx) => block('Leg', [0.5, 2, 0.5], [x + dx, y + 1, z - 1], M('#14141c', 'SmoothPlastic'))));
  else k.push(block('Box', [4 * s, 6 * s, 2.4 * s], [x, y + 3 * s, z], c), ...[-0.9, 0.9].map((dx) => block('Knob', [0.3, 0.3, 0.2], [x + dx * s, y + 3 * s, z - 1.25 * s], M('#ffc93c', 'Metal'), noCol)));
  return model(o.name || ({ table: 'Table', chair: 'Chair', bed: 'Bed', sofa: 'Sofa', shelf: 'Bookshelf', lamp: 'FloorLamp', tv: 'TV', computer: 'Computer', piano: 'Piano', wardrobe: 'Wardrobe' })[t] || 'Furniture', k); }

/* ---------- food (giant, simulator-style) ---------- */
export function food(T, x, z, r, y = 0, o = {}) { const t = o.type || 'apple', c = o.color, s = o.scale || 1.6, k = [];
  if (t === 'apple' || t === 'orange' || t === 'cherry' || t === 'tomato') { const col = c || { apple: '#e8413a', orange: '#ff9a3c', cherry: '#c0102a', tomato: '#e83a2a' }[t]; k.push(ball('Fruit', 3 * s, [x, y + 1.5 * s, z], M(col, 'SmoothPlastic')), block('Stem', [0.2 * s, 0.8 * s, 0.2 * s], [x, y + 3.2 * s, z], M('#6b4426', 'Wood'), noCol), P('WedgePart', 'Leaf', [0.2 * s, 0.7 * s, 1 * s], [x + 0.4 * s, y + 3.2 * s, z], [0, 90, 30], M('#4cc46a', 'Grass'), noCol)); }
  else if (t === 'watermelon') k.push(ball('Melon', 4 * s, [x, y + 2 * s, z], M('#3e9a48', 'SmoothPlastic')), ...[0, 60, 120].map((a) => cyl('Stripe', 4.05 * s, 0.4 * s, [x, y + 2 * s, z], M('#2a6e33', 'SmoothPlastic'), { canCollide: false, rot: [0, a, 0] })));
  else if (t === 'banana') for (let i = 0; i < 3; i++) k.push(block('Banana', [0.9 * s, 0.9 * s, 4 * s], [x + i * 0.9 * s, y + 0.5 * s, z], M(c || '#ffd84d', 'SmoothPlastic'), { rot: [0, i * 12, 18] }));
  else if (t === 'cake') { k.push(cyl('Layer', 1.6 * s, 6 * s, [x, y + 0.8 * s, z], M('#f2c18a', 'SmoothPlastic')), cyl('Cream', 0.4 * s, 6.2 * s, [x, y + 1.7 * s, z], M('#ffffff', 'SmoothPlastic')), cyl('Layer', 1.4 * s, 4.4 * s, [x, y + 2.6 * s, z], M(c || '#ff8ac0', 'SmoothPlastic')));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.push(ball('Cherry', 0.6 * s, [x + Math.cos(a) * 1.6 * s, y + 3.5 * s, z + Math.sin(a) * 1.6 * s], M('#e8413a', 'SmoothPlastic'), noCol)); } k.push(cyl('Candle', 1.2 * s, 0.3 * s, [x, y + 3.9 * s, z], M('#3f86ff', 'SmoothPlastic'), noCol), ball('Flame', 0.4 * s, [x, y + 4.7 * s, z], M('#ffb347', 'Neon'), noCol)); }
  else if (t === 'donut') { k.push(cyl('Dough', 1.2 * s, 4 * s, [x, y + 0.6 * s, z], M('#d9a066', 'SmoothPlastic')), cyl('Icing', 0.4 * s, 3.9 * s, [x, y + 1.3 * s, z], M(c || '#ff8ac0', 'SmoothPlastic')), cyl('Hole', 1.7 * s, 1.3 * s, [x, y + 0.85 * s, z], M('#2b2b33', 'SmoothPlastic'), { canCollide: false, transparency: 1 })); for (let i = 0; i < 8; i++) k.push(block('Sprinkle', [0.4 * s, 0.12 * s, 0.12 * s], [x + (r() - 0.5) * 3 * s, y + 1.55 * s, z + (r() - 0.5) * 3 * s], M(pick(r, ['#3f86ff', '#ffd84d', '#4cc46a', '#ffffff']), 'SmoothPlastic'), { canCollide: false, rot: [0, r() * 180, 0] })); }
  else if (t === 'pizza') { k.push(cyl('Crust', 0.4 * s, 6 * s, [x, y + 0.2 * s, z], M('#e6b56a', 'SmoothPlastic')), cyl('Sauce', 0.15 * s, 5.4 * s, [x, y + 0.45 * s, z], M('#d6312b', 'SmoothPlastic'), noCol), cyl('Cheese', 0.12 * s, 5 * s, [x, y + 0.55 * s, z], M('#ffd84d', 'SmoothPlastic'), noCol)); for (let i = 0; i < 7; i++) k.push(cyl('Pepperoni', 0.12 * s, 0.9 * s, [x + (r() - 0.5) * 3.6 * s, y + 0.65 * s, z + (r() - 0.5) * 3.6 * s], M('#a8281f', 'SmoothPlastic'), noCol)); }
  else if (t === 'burger') k.push(P('Part', 'BunTop', [4 * s, 1.6 * s, 4 * s], [x, y + 3 * s, z], [0, 0, 0], M('#e6a95c', 'SmoothPlastic'), { shape: 'Ball' }), cyl('Lettuce', 0.3 * s, 4.2 * s, [x, y + 2.1 * s, z], M('#5fd38a', 'Grass'), noCol), cyl('Cheese', 0.25 * s, 4 * s, [x, y + 1.8 * s, z], M('#ffd84d', 'SmoothPlastic'), noCol), cyl('Patty', 0.7 * s, 3.9 * s, [x, y + 1.35 * s, z], M('#6b3f1d', 'SmoothPlastic')), cyl('BunBottom', 0.9 * s, 4 * s, [x, y + 0.45 * s, z], M('#e6a95c', 'SmoothPlastic')));
  else if (t === 'icecream') k.push(P('WedgePart', 'Cone', [2 * s, 4 * s, 2 * s], [x, y + 2 * s, z], [180, 0, 0], M('#e6b56a', 'WoodPlanks')), ball('Scoop', 2.4 * s, [x, y + 4.6 * s, z], M(c || '#ff8ac0', 'SmoothPlastic')), ball('Scoop2', 2 * s, [x, y + 6.2 * s, z], M('#fff3c4', 'SmoothPlastic')), ball('Cherry', 0.6 * s, [x, y + 7.4 * s, z], M('#e8413a', 'SmoothPlastic'), noCol));
  else if (t === 'candy' || t === 'lollipop') k.push(cyl('Stick', 5 * s, 0.3 * s, [x, y + 2.5 * s, z], M('#f6f6f6', 'SmoothPlastic')), cyl('Candy', 0.6 * s, 3.4 * s, [x, y + 5.6 * s, z], M(c || '#ff6bab', 'SmoothPlastic'), { rot: [90, 0, 0] }), cyl('Swirl', 0.65 * s, 1.6 * s, [x, y + 5.6 * s, z], M('#ffffff', 'SmoothPlastic'), { canCollide: false, rot: [90, 0, 0] }));
  else if (t === 'cookie') { k.push(cyl('Cookie', 0.6 * s, 4 * s, [x, y + 0.3 * s, z], M('#d9a066', 'SmoothPlastic'))); for (let i = 0; i < 6; i++) k.push(ball('Chip', 0.5 * s, [x + (r() - 0.5) * 2.8 * s, y + 0.65 * s, z + (r() - 0.5) * 2.8 * s], M('#4a2d1a', 'SmoothPlastic'), noCol)); }
  else k.push(ball('Food', 3 * s, [x, y + 1.5 * s, z], M(c || '#ffb347', 'SmoothPlastic')));
  return model(o.name || 'Food', k); }

/* ---------- small creatures not in the voxel engine ---------- */
export function critter(T, x, z, r, y = 0, o = {}) { // voxel sculptures (studio/voxel-critters.js), same look as the voxel pets
  const sc = (o.scale || 1) * 1.4, yaw = r() * Math.PI * 2, c = Math.cos(yaw), sn = Math.sin(yaw);
  const vc = voxelCritter(o.type || 'bird', { color: o.color || null, scale: sc, voxel: 0.17 / sc });
  const k = vc.parts.map((p) => P('Part', p.name.replace(/_v$/, ''), p.size, [x + p.pos[0] * c + p.pos[2] * sn, y + p.pos[1], z - p.pos[0] * sn + p.pos[2] * c], [0, (yaw * 180) / Math.PI, 0], M(p.color, p.material), noCol));
  return model(o.name || (o.type || 'critter').replace(/^./, (ch) => ch.toUpperCase()), k); }

/* ---------- play & sport & fun ---------- */
export function fun(T, x, z, r, y = 0, o = {}) { const t = o.type || 'balloon', c = o.color || pick(r, ['#e8413a', '#3f86ff', '#ffd84d', '#4cc46a', '#ff8ac0']), k = [];
  if (t === 'balloon') k.push(P('Part', 'Balloon', [3, 3, 3], [x, y + 9, z], [0, 0, 0], M(c, 'SmoothPlastic'), { shape: 'Ball', canCollide: false }), block('String', [0.1, 7, 0.1], [x, y + 4, z], M('#f6f6f6', 'Fabric'), noCol));
  else if (t === 'gift') k.push(block('Box', [3, 3, 3], [x, y + 1.5, z], M(c, 'SmoothPlastic')), block('Ribbon', [3.05, 3.05, 0.5], [x, y + 1.5, z], M('#ffd84d', 'SmoothPlastic'), noCol), block('Ribbon', [0.5, 3.05, 3.05], [x, y + 1.5, z], M('#ffd84d', 'SmoothPlastic'), noCol), ball('Bow', 1, [x, y + 3.3, z], M('#ffd84d', 'SmoothPlastic'), noCol));
  else if (t === 'flag') k.push(cyl('Pole', 12, 0.4, [x, y + 6, z], M('#c9d1dd', 'Metal')), block('Flag', [0.2, 2.6, 4], [x, y + 10.4, z + 2.1], M(c, 'Fabric'), noCol), ball('Top', 0.8, [x, y + 12.2, z], M('#ffc93c', 'Metal'), noCol));
  else if (t === 'goal') k.push(...[-5, 5].map((dx) => block('Post', [0.5, 6, 0.5], [x + dx, y + 3, z], M('#f6f6f6', 'SmoothPlastic'))), block('Bar', [10.5, 0.5, 0.5], [x, y + 6, z], M('#f6f6f6', 'SmoothPlastic')), block('Net', [10, 6, 0.1], [x, y + 3, z + 3], M('#f6f6f6', 'ForceField'), { canCollide: false, transparency: 0.5 }), ball('Ball', 1.4, [x + 2, y + 0.7, z - 4], M('#f6f6f6', 'SmoothPlastic')));
  else if (t === 'hoop') k.push(block('Pole', [0.5, 10, 0.5], [x, y + 5, z], M('#2b2b33', 'Metal')), block('Board', [5, 3.4, 0.3], [x, y + 10.4, z - 0.5], M('#f6f6f6', 'SmoothPlastic')), cyl('Rim', 0.2, 2.2, [x, y + 9.4, z - 1.8], M('#ff7a1a', 'Metal'), noCol), ball('Ball', 1.6, [x + 1.5, y + 0.8, z - 3], M('#ff7a1a', 'SmoothPlastic')));
  else if (t === 'slide') k.push(block('Ladder', [2.4, 8, 0.4], [x - 4, y + 4, z], M('#ffd84d', 'SmoothPlastic')), block('Platform', [3, 0.5, 3], [x - 3, y + 8, z], M('#3f86ff', 'SmoothPlastic')), block('Slide', [2.6, 0.4, 10], [x + 1.5, y + 4.2, z], M(c, 'SmoothPlastic'), { rot: [0, 90, -38] }));
  else if (t === 'swing') k.push(...[-3.4, 3.4].map((dx) => block('Leg', [0.5, 9, 0.5], [x + dx, y + 4.5, z], M('#c0392b', 'Metal'), { rot: [0, 0, dx > 0 ? -8 : 8] })), block('Bar', [8, 0.5, 0.5], [x, y + 8.8, z], M('#c0392b', 'Metal')), block('RopeL', [0.15, 5, 0.15], [x - 0.9, y + 6, z], M('#d8c08a', 'Fabric'), noCol), block('RopeR', [0.15, 5, 0.15], [x + 0.9, y + 6, z], M('#d8c08a', 'Fabric'), noCol), block('Seat', [2.2, 0.3, 0.9], [x, y + 3.4, z], M(c, 'SmoothPlastic')));
  else if (t === 'trampoline') k.push(cyl('Frame', 1.2, 8, [x, y + 1.6, z], M('#3f86ff', 'SmoothPlastic')), cyl('Mat', 0.2, 7, [x, y + 2.25, z], M('#2b2b33', 'Fabric'), { attributes: undefined }));
  else if (t === 'pool') k.push(block('Rim', [16, 1.2, 10], [x, y + 0.6, z], M('#f6f6f6', 'Concrete')), block('Water', [15, 0.4, 9], [x, y + 1.05, z], M('#3ee6ff', 'Glass'), { transparency: 0.25, canCollide: false }), block('Board', [1.4, 0.3, 4], [x - 6, y + 1.6, z - 6], M('#3f86ff', 'SmoothPlastic')));
  else if (t === 'umbrella') k.push(cyl('Pole', 7, 0.3, [x, y + 3.5, z], M('#f6f6f6', 'Metal')), cyl('Canopy', 0.6, 7, [x, y + 7, z], M(c, 'Fabric'), noCol), cyl('Canopy2', 0.6, 4, [x, y + 7.5, z], M('#ffffff', 'Fabric'), noCol), block('Towel', [3, 0.1, 6], [x + 3, y + 0.05, z], M(shade(c, 1.2), 'Fabric'), noCol));
  else if (t === 'snowman') k.push(ball('Bottom', 5, [x, y + 2.5, z], M('#f6f6f6', 'Snow')), ball('Middle', 3.6, [x, y + 6.2, z], M('#f6f6f6', 'Snow')), ball('Head', 2.6, [x, y + 8.9, z], M('#f6f6f6', 'Snow')), P('WedgePart', 'Nose', [0.4, 0.4, 1.2], [x, y + 8.9, z - 1.7], [0, 180, 0], M('#ff7a1a', 'SmoothPlastic'), noCol), cyl('Hat', 1.6, 1.6, [x, y + 10.8, z], M('#14141c', 'SmoothPlastic')), cyl('Brim', 0.2, 2.6, [x, y + 10, z], M('#14141c', 'SmoothPlastic')), block('Scarf', [2.8, 0.6, 2.8], [x, y + 7.8, z], M(c, 'Fabric'), noCol));
  else if (t === 'xmastree') { for (let i = 0; i < 4; i++) k.push(P('Part', 'Layer', [9 - i * 2, 3, 9 - i * 2], [x, y + 2 + i * 2.4, z], [0, 45, 0], M('#2f8a45', 'LeafyGrass'), { shape: 'Ball' })); k.push(block('Trunk', [1.4, 2, 1.4], [x, y + 1, z], M('#6b4426', 'Wood')), P('WedgePart', 'Star', [1.2, 1.4, 0.4], [x, y + 11.4, z], [0, 0, 0], M('#ffd84d', 'Neon'), noCol)); for (let i = 0; i < 10; i++) { const a = r() * Math.PI * 2, h = r() * 8, rr = (9 - h) / 2; k.push(ball('Bauble', 0.6, [x + Math.cos(a) * rr * 0.9, y + 2 + h, z + Math.sin(a) * rr * 0.9], M(pick(r, ['#e8413a', '#ffd84d', '#3f86ff', '#ff8ac0']), 'Neon'), noCol)); } }
  else if (t === 'grave') k.push(block('Stone', [3, 4, 0.8], [x, y + 2, z], M('#9aa1ad', 'Slate')), ball('Top', 3, [x, y + 4, z], M('#9aa1ad', 'Slate')), block('Dirt', [3, 0.3, 5], [x, y + 0.15, z - 2.8], M('#5a3720', 'Ground'), noCol));
  else if (t === 'sun' || t === 'moon' || t === 'star' || t === 'heart') { const col = { sun: '#ffd84d', moon: '#f4f1d0', star: '#ffd84d', heart: '#ff3b6e' }[t]; if (t === 'heart') k.push(ball('Lobe', 4, [x - 1.5, y + 12, z], M(c || col, 'Neon'), noCol), ball('Lobe', 4, [x + 1.5, y + 12, z], M(c || col, 'Neon'), noCol), P('WedgePart', 'Tip', [6, 4, 0.8], [x, y + 9, z], [180, 0, 0], M(c || col, 'Neon'), noCol));
    else if (t === 'star') for (let i = 0; i < 5; i++) k.push(P('WedgePart', 'Point', [0.8, 4, 2.4], [x + Math.sin(i * 1.2566) * 2, y + 12 + Math.cos(i * 1.2566) * 2, z], [0, 90, i * 72], M(c || col, 'Neon'), noCol));
    else k.push(ball(t === 'sun' ? 'Sun' : 'Moon', t === 'sun' ? 16 : 10, [x, y + 60, z], M(c || col, 'Neon'), noCol)); }
  else if (t === 'rainbow') { const cols = ['#e8413a', '#ff9a3c', '#ffd84d', '#4cc46a', '#3f86ff', '#9a5cff']; cols.forEach((col, i) => { for (let a = 0; a <= 12; a++) { const ang = a / 12 * Math.PI, R = 30 - i * 1.6; k.push(block('Arc', [2.6, 1.6, 1.6], [x + Math.cos(ang) * R, y + Math.sin(ang) * R, z], M(col, 'Neon'), { canCollide: false, rot: [0, 0, ang * 57.3 + 90] })); } }); }
  return model(o.name || ({ balloon: 'Balloon', gift: 'Gift', flag: 'Flag', goal: 'SoccerGoal', hoop: 'BasketHoop', slide: 'Slide', swing: 'Swing', trampoline: 'Trampoline', pool: 'Pool', umbrella: 'BeachUmbrella', snowman: 'Snowman', xmastree: 'ChristmasTree', grave: 'Grave', sun: 'Sun', moon: 'Moon', star: 'Star', heart: 'Heart', rainbow: 'Rainbow' })[t] || 'Fun', k); }

/* ---------- plants ---------- */
export function plant(T, x, z, r, y = 0, o = {}) { const t = o.type || 'potted', c = o.color, k = [];
  if (t === 'palm') { for (let i = 0; i < 6; i++) k.push(cyl('Trunk', 2.2, 1.4 - i * 0.08, [x + i * 0.3, y + 1.1 + i * 2.1, z], M(i % 2 ? '#a77a4a' : '#8a6238', 'Wood')));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.push(block('Frond', [1.4, 0.3, 6], [x + 1.8 + Math.cos(a) * 2.6, y + 12.6, z + Math.sin(a) * 2.6], M('#3e9a48', 'LeafyGrass'), { canCollide: false, rot: [-20, -a * 57.3 + 90, 0] })); }
    k.push(...[0, 1, 2].map((i) => ball('Coconut', 0.9, [x + 1.3 + (i - 1) * 0.6, y + 12.2, z + 0.5], M('#6b4426', 'SmoothPlastic'), noCol))); }
  else if (t === 'dead') { k.push(cyl('Trunk', 8, 1.4, [x, y + 4, z], M('#5a4636', 'Wood'))); for (let i = 0; i < 4; i++) k.push(block('Branch', [0.4, 3.4, 0.4], [x + (i % 2 ? 1 : -1) * 1.2, y + 6 + i * 0.8, z + (i < 2 ? 0.4 : -0.4)], M('#5a4636', 'Wood'), { canCollide: false, rot: [0, i * 90, i % 2 ? -40 : 40] })); }
  else if (t === 'bamboo') for (let i = 0; i < 6; i++) { const dx = (r() - 0.5) * 3, dz = (r() - 0.5) * 3, h = 8 + r() * 6; k.push(cyl('Stalk', h, 0.5, [x + dx, y + h / 2, z + dz], M('#7bc75a', 'Grass'))); for (let j = 1; j < h / 2; j++) k.push(cyl('Node', 0.2, 0.6, [x + dx, y + j * 2, z + dz], M('#4e9a3a', 'Grass'), noCol)); }
  else if (t === 'flower') { for (let i = 0; i < 7; i++) { const dx = (r() - 0.5) * 4, dz = (r() - 0.5) * 4, col = c || pick(r, ['#ff6bab', '#ffd84d', '#ffffff', '#9a7bff', '#ff8a3d']); k.push(cyl('Stem', 1.6, 0.2, [x + dx, y + 0.8, z + dz], M('#4e9a4a', 'Grass'), noCol));
    for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; k.push(ball('Petal', 0.55, [x + dx + Math.cos(a) * 0.4, y + 1.7, z + dz + Math.sin(a) * 0.4], M(col, 'SmoothPlastic'), noCol)); } k.push(ball('Heart', 0.4, [x + dx, y + 1.75, z + dz], M('#ffd84d', 'SmoothPlastic'), noCol)); } }
  else if (t === 'cactusPot' || t === 'potted') { k.push(cyl('Pot', 2, 2.6, [x, y + 1, z], M('#c96b3e', 'SmoothPlastic')), cyl('Soil', 0.2, 2.3, [x, y + 2, z], M('#4a2d1a', 'Ground'), noCol)); for (let i = 0; i < 5; i++) k.push(P('WedgePart', 'Leaf', [0.3, 2.4, 1], [x + (r() - 0.5), y + 3.1, z + (r() - 0.5)], [0, i * 72, (r() - 0.5) * 30], M(c || '#4cc46a', 'LeafyGrass'), noCol)); }
  else if (t === 'hedge') k.push(block('Hedge', [10, 3.4, 2.6], [x, y + 1.7, z], M('#3e9a48', 'LeafyGrass')), ...[-3, 0, 3].map((dx) => ball('Bump', 3, [x + dx, y + 3.2, z], M('#4cc46a', 'LeafyGrass'), noCol)));
  else if (t === 'vine') for (let i = 0; i < 5; i++) k.push(ball('Leaf', 1.4, [x + (r() - 0.5) * 2, y + 1 + i * 1.4, z], M('#3e9a48', 'LeafyGrass'), noCol));
  return model(o.name || ({ palm: 'PalmTree', dead: 'DeadTree', bamboo: 'Bamboo', flower: 'Flowers', potted: 'PottedPlant', cactusPot: 'PottedCactus', hedge: 'Hedge', vine: 'Vine' })[t] || 'Plant', k); }

/* ---------- any other word: a plinth with the word, so nothing is ever ignored ---------- */
export function labelled(T, x, z, r, y = 0, o = {}) { const c = o.color || '#ffd84d';
  return model(o.name || 'Object', [block('Plinth', [5, 2, 5], [x, y + 1, z], M('#5f6673', 'Granite')), block('Body', [3, 4, 3], [x, y + 4, z], M(c, 'SmoothPlastic'), { rot: [0, 45, 0] }),
    ball('Top', 2.6, [x, y + 6.6, z], M(shade(c, 1.2), 'SmoothPlastic')), block('Plaque', [4.6, 1.2, 0.3], [x, y + 1.2, z - 2.6], M('#1d2140', 'SmoothPlastic'), { canCollide: false, label: o.word || '?' })]); }
