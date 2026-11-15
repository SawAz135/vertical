/* =====================================================================
   Roblox Forge - detailed map models (all real Roblox parts) + scenery
   + the text-to-map "générateur intelligent".
   Every builder returns a Model; sizes are in studs, ground at y.
   ===================================================================== */
import { P, block, cyl, ball, model, rng, THEMES, GENERATORS, role } from './map-core.js';
import { parseScene, buildScene } from './map-scene.js';
import { voxelScenery, voxelTag } from './map-voxel.js';

const M = (c, m) => ({ c, m });
const D = 180 / Math.PI;
const mixC = (a, b, t) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), c = (s) => [(s >> 16) & 255, (s >> 8) & 255, s & 255], p = c(x), q = c(y);
  return '#' + p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const pick = (r, a) => a[Math.floor(r() * a.length)];
// rotate local offsets around a model origin
function place(x, y, z, rotY) { const c = Math.cos(rotY / D), s = Math.sin(rotY / D); return (dx, dy, dz) => [x + dx * c + dz * s, y + dy, z - dx * s + dz * c]; }

/* ---------- vegetation ---------- */
export function pine(T, x, z, r, y = 0, s = 1) {
  const h = (14 + r() * 8) * s, kids = [cyl('Trunk', h * 0.45, 1.4 * s, [x, y + h * 0.22, z], M('#5b3d26', 'Wood'))], leaf = T.leaf.m === 'Neon' ? T.leaf : M(mixC(T.leaf.c, '#1d4d2b', 0.35), 'LeafyGrass');
  for (let k = 0; k < 4; k++) { const ry = y + h * (0.3 + k * 0.17), w = (9 - k * 2) * s;
    for (let a = 0; a < 4; a++) kids.push(P('WedgePart', 'Needles', [w, h * 0.2, w * 0.5], [x + Math.sin(a * Math.PI / 2) * w * 0.25, ry, z + Math.cos(a * Math.PI / 2) * w * 0.25], [0, a * 90, 0], leaf, { canCollide: false })); }
  if (T.ground.m === 'Snow') for (let k = 0; k < 3; k++) kids.push(ball('Snow', (4 - k) * s, [x, y + h * (0.42 + k * 0.17), z], M('#ffffff', 'Snow'), { canCollide: false }));
  return model('Pine', kids);
}
export function oak(T, x, z, r, y = 0, s = 1, blossom = false) {
  const h = (9 + r() * 5) * s, kids = [cyl('Trunk', h, 2 * s, [x, y + h / 2, z], M('#6b4a2b', 'Wood'))];
  for (let b = 0; b < 3; b++) { const a = b * 2.1 + r(); kids.push(P('Part', 'Branch', [5 * s, 0.9 * s, 0.9 * s], [x + Math.cos(a) * 2 * s, y + h * 0.75, z + Math.sin(a) * 2 * s], [0, -a * D, 30], M('#6b4a2b', 'Wood'), { shape: 'Cylinder' })); }
  const leaf = blossom ? M('#ffb7d5', 'SmoothPlastic') : T.leaf;
  for (let k = 0; k < 7; k++) { const a = k * 0.9 + r(), d = k ? 3.2 * s : 0, sz = (k ? 6 : 8) * s * (0.8 + r() * 0.4);
    kids.push(ball('Leaves', sz, [x + Math.cos(a) * d, y + h + (k ? r() * 2 - 1 : 1.5) * s, z + Math.sin(a) * d], k % 2 ? leaf : M(mixC(leaf.c, '#ffffff', blossom ? 0.4 : 0.12), leaf.m), { canCollide: k === 0 })); }
  if (blossom) for (let k = 0; k < 6; k++) kids.push(ball('Petal', 0.5, [x + (r() - 0.5) * 12 * s, y + 0.3, z + (r() - 0.5) * 12 * s], M('#ffd1e6', 'SmoothPlastic'), { canCollide: false }));
  return model(blossom ? 'CherryTree' : 'Oak', kids);
}
export function cactus(x, z, r, y = 0) {
  const h = 7 + r() * 5, g = M('#4e9a4a', 'Grass'), kids = [cyl('Body', h, 2.2, [x, y + h / 2, z], g), ball('Top', 2.2, [x, y + h, z], g)];
  for (const s of [-1, 1]) if (r() < 0.8) { const ah = 2 + r() * 2, ay = y + h * (0.4 + r() * 0.25); kids.push(P('Part', 'ArmOut', [2, 1.6, 1.6], [x + s * 1.6, ay, z], [0, 0, 0], g, { shape: 'Cylinder' }), cyl('ArmUp', ah, 1.6, [x + s * 2.6, ay + ah / 2, z], g), ball('ArmTop', 1.6, [x + s * 2.6, ay + ah, z], g)); }
  if (r() < 0.5) kids.push(ball('Flower', 0.9, [x, y + h + 1, z], M('#ff6bab', 'SmoothPlastic')));
  return model('Cactus', kids);
}
export function rocks(T, x, z, r, y = 0, s = 1) { const kids = [];
  for (let k = 0; k < 3 + Math.floor(r() * 3); k++) { const d = 2 + r() * 4 * s; kids.push(P('Part', 'Rock', [d * (1 + r() * 0.6), d * (0.6 + r() * 0.5), d], [x + (r() - 0.5) * 6 * s, y + d * 0.25, z + (r() - 0.5) * 6 * s], [r() * 20, r() * 360, r() * 20], T.rock)); }
  if (r() < 0.6) kids.push(P('Part', 'Moss', [3, 0.4, 3], [x, y + 1.6 * s, z], [0, r() * 90, 0], M(mixC(T.leaf.c, '#3a6b2a', 0.4), 'LeafyGrass'), { canCollide: false }));
  return model('Rocks', kids); }
export function crystals(T, x, z, r, y = 0, s = 1) { const kids = [], c = T.glow;
  for (let k = 0; k < 5; k++) { const h = (3 + r() * 6) * s; kids.push(P('WedgePart', 'Crystal', [1.4 * s, h, 1.6 * s], [x + (r() - 0.5) * 3 * s, y + h / 2, z + (r() - 0.5) * 3 * s], [(r() - 0.5) * 30, r() * 360, (r() - 0.5) * 30], k % 2 ? c : M(mixC(c.c, '#ffffff', 0.4), 'Glass'), { light: k === 0 ? { range: 14, brightness: 2 } : null })); }
  kids.push(P('Part', 'Base', [5 * s, 1, 5 * s], [x, y + 0.3, z], [0, 0, 0], T.rock)); return model('Crystals', kids); }
export function flowers(x, z, r, y = 0, n = 10) { const kids = [], cols = ['#ff6bab', '#ffd84d', '#ffffff', '#9a7bff', '#ff8a3d'];
  for (let k = 0; k < n; k++) { const fx = x + (r() - 0.5) * 10, fz = z + (r() - 0.5) * 10, c = pick(r, cols);
    kids.push(cyl('Stem', 1.2, 0.18, [fx, y + 0.6, fz], M('#3f8f3a', 'Grass'), { canCollide: false }), ball('Bloom', 0.7, [fx, y + 1.3, fz], M(c, 'SmoothPlastic'), { canCollide: false }), ball('Heart', 0.3, [fx, y + 1.4, fz - 0.25], M('#ffd84d', 'Neon'), { canCollide: false })); }
  return model('Flowers', kids); }

/* ---------- buildings ---------- */
export function house(T, x, z, rotY, r, y = 0) {
  const at = place(x, y, z, rotY), W = 16 + Math.round(r() * 4) * 2, Dd = 12 + Math.round(r() * 3) * 2, H = 10, wall = pick(r, [M('#f3e7d3', 'Plastic'), M('#d9c2a3', 'Brick'), T.wall]), roof = pick(r, [M('#b23a3a', 'Slate'), M('#3b4b6b', 'Slate'), M('#5b3d26', 'WoodPlanks')]), kids = [];
  kids.push(P('Part', 'Floor', [W + 2, 1, Dd + 2], at(0, 0.5, 0), [0, rotY, 0], M('#8a8f9c', 'Cobblestone')));
  kids.push(P('Part', 'WallBack', [W, H, 1], at(0, H / 2 + 1, Dd / 2), [0, rotY, 0], wall), P('Part', 'WallL', [1, H, Dd], at(-W / 2, H / 2 + 1, 0), [0, rotY, 0], wall), P('Part', 'WallR', [1, H, Dd], at(W / 2, H / 2 + 1, 0), [0, rotY, 0], wall));
  kids.push(P('Part', 'WallFrontL', [W / 2 - 2.5, H, 1], at(-W / 4 - 1.25, H / 2 + 1, -Dd / 2), [0, rotY, 0], wall), P('Part', 'WallFrontR', [W / 2 - 2.5, H, 1], at(W / 4 + 1.25, H / 2 + 1, -Dd / 2), [0, rotY, 0], wall), P('Part', 'WallFrontTop', [5, H - 7, 1], at(0, 7 + (H - 7) / 2 + 1, -Dd / 2), [0, rotY, 0], wall));
  kids.push(P('Part', 'Door', [4, 7, 0.4], at(0, 4.5, -Dd / 2 - 0.4), [0, rotY, 0], M('#6b3f22', 'WoodPlanks'), { canCollide: false }), P('Part', 'Knob', [0.4, 0.4, 0.4], at(1.3, 4.5, -Dd / 2 - 0.7), [0, 0, 0], M('#ffcf3d', 'Foil'), { shape: 'Ball' }));
  for (const sx of [-1, 1]) for (const wz of [-Dd / 2 - 0.3, Dd / 2 + 0.3]) { kids.push(P('Part', 'Window', [3, 3, 0.3], at(sx * W / 4 - (wz < 0 ? sx * 1.2 : 0), 6.5, wz), [0, rotY, 0], M('#ffe9a8', 'Neon'), { transparency: 0.1, light: wz < 0 && sx < 0 ? { range: 12, brightness: 1.5 } : null }),
    P('Part', 'Frame', [3.6, 0.4, 0.5], at(sx * W / 4 - (wz < 0 ? sx * 1.2 : 0), 4.8, wz), [0, rotY, 0], M('#ffffff', 'WoodPlanks'))); }
  const rh = 6; for (const s of [-1, 1]) kids.push(P('WedgePart', 'Roof', [W + 3, rh, Dd / 2 + 1.5], at(0, H + 1 + rh / 2, s * (Dd / 4 + 0.75)), [0, rotY + (s < 0 ? 0 : 180), 0], roof));
  kids.push(P('Part', 'Ridge', [W + 3.2, 0.8, 0.8], at(0, H + 1 + rh, 0), [0, rotY, 0], M('#3a2b20', 'WoodPlanks')));
  kids.push(P('Part', 'Chimney', [2, 6, 2], at(W / 3, H + 4, Dd / 5), [0, rotY, 0], M('#9a5a3a', 'Brick')));
  kids.push(P('Part', 'Step', [6, 0.6, 2], at(0, 0.3, -Dd / 2 - 1.8), [0, rotY, 0], M('#9aa1ad', 'Concrete')), lampPost(T, ...at(-W / 2 - 3, 0, -Dd / 2 - 3).filter((_, i) => i !== 1), y));
  return model('House', kids);
}
export function lampPost(T, x, z, y = 0) { return model('Lantern', [cyl('Pole', 9, 0.5, [x, y + 4.5, z], M('#2b2b30', 'Metal')), P('Part', 'Arm', [2.4, 0.3, 0.3], [x + 1, y + 9, z], [0, 0, 0], M('#2b2b30', 'Metal')),
  P('Part', 'Lamp', [1.2, 1.6, 1.2], [x + 2, y + 8.2, z], [0, 0, 0], M('#ffe9a8', 'Neon'), { light: { range: 16, brightness: 2 } }), P('WedgePart', 'Cap', [1.6, 0.6, 1.6], [x + 2, y + 9.3, z], [0, 0, 0], M('#2b2b30', 'Metal'))]); }
export function castle(T, x, z, r, y = 0) {
  const kids = [], st = M('#9aa1ad', 'Cobblestone'), dark = M('#6b7280', 'Slate'), S = 60;
  kids.push(block('Courtyard', [S, 1, S], [x, y + 0.5, z], M('#8a8f9c', 'Pebble')));
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const tx = x + dx * S / 2, tz = z + dz * S / 2;
    kids.push(cyl('Tower', 34, 12, [tx, y + 17, tz], st), cyl('TowerTop', 2, 13.5, [tx, y + 35, tz], dark));
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; kids.push(block('Merlon', [2.2, 2.5, 2.2], [tx + Math.cos(a) * 6, y + 37, tz + Math.sin(a) * 6], st)); }
    for (let k = 0; k < 4; k++) kids.push(P('WedgePart', 'Spire', [10, 12, 5], [tx + (k % 2 ? 0 : (k ? 2.5 : -2.5)), y + 42, tz + (k % 2 ? (k > 1 ? 2.5 : -2.5) : 0)], [0, k * 90, 0], M('#3b4b9b', 'Slate')));
    kids.push(P('Part', 'Flag', [0.2, 3, 5], [tx, y + 51, tz + 2.5], [0, 0, 0], M('#e63946', 'Fabric')), cyl('FlagPole', 6, 0.3, [tx, y + 50, tz], M('#2b2b30', 'Metal'))); }
  for (const [dx, dz, w, d] of [[0, -1, S, 3], [0, 1, S, 3], [-1, 0, 3, S], [1, 0, 3, S]]) { const wx = x + dx * S / 2, wz = z + dz * S / 2;
    if (dz === -1) { kids.push(block('GateWallL', [S / 2 - 7, 22, 3], [x - S / 4 - 3.5, y + 11, wz], st), block('GateWallR', [S / 2 - 7, 22, 3], [x + S / 4 + 3.5, y + 11, wz], st), block('GateTop', [14, 8, 3], [x, y + 18, wz], st), block('Portcullis', [14, 13, 0.6], [x, y + 7.5, wz - 1], M('#3a3a42', 'DiamondPlate'), { transparency: 0.2, canCollide: false })); }
    else kids.push(block('Wall', [w, 22, d], [wx, y + 11, wz], st));
    for (let k = -S / 2 + 4; k < S / 2 - 3; k += 5) kids.push(block('Merlon', dz ? [2.4, 2.5, 3.2] : [3.2, 2.5, 2.4], [dz ? x + k : wx, y + 23.2, dz ? wz : z + k], st)); }
  kids.push(block('Keep', [22, 30, 22], [x, y + 15, z + 8], st), P('WedgePart', 'KeepRoofA', [24, 10, 12], [x, y + 35, z + 2], [0, 0, 0], M('#3b4b9b', 'Slate')), P('WedgePart', 'KeepRoofB', [24, 10, 12], [x, y + 35, z + 14], [0, 180, 0], M('#3b4b9b', 'Slate')));
  for (let k = 0; k < 3; k++) kids.push(block('KeepWindow', [3, 5, 0.4], [x - 6 + k * 6, y + 20, z - 3.2], M('#ffe9a8', 'Neon')));
  kids.push(block('Banner', [5, 10, 0.3], [x, y + 13, z - 3.3], M('#e63946', 'Fabric')), block('Emblem', [2.5, 2.5, 0.3], [x, y + 15, z - 3.5], M('#ffcf3d', 'Foil')));
  return model('Castle', kids);
}
export function temple(T, x, z, r, y = 0) { const kids = [], st = M('#e9e2d0', 'Marble');
  for (let k = 0; k < 4; k++) kids.push(block('Stair' + (k + 1), [40 - k * 4, 1.5, 30 - k * 4], [x, y + 0.75 + k * 1.5, z], st));
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) kids.push(cyl('Column', 16, 2.4, [x - 12.5 + i * 5, y + 14, z + s * 9], st), block('Capital', [3.2, 1, 3.2], [x - 12.5 + i * 5, y + 22.5, z + s * 9], st));
  kids.push(block('Beam', [32, 2, 22], [x, y + 24, z], st), P('WedgePart', 'PedimentA', [32, 5, 11], [x, y + 27.5, z - 5.5], [0, 0, 0], st), P('WedgePart', 'PedimentB', [32, 5, 11], [x, y + 27.5, z + 5.5], [0, 180, 0], st));
  kids.push(ball('Orb', 3, [x, y + 9, z], T.glow, { light: { range: 26, brightness: 3 } }), cyl('Altar', 3, 5, [x, y + 7, z], M('#c9b98f', 'Marble'))); return model('Temple', kids); }
export function windmill(T, x, z, r, y = 0) { const kids = [cyl('Tower', 24, 10, [x, y + 12, z], M('#f3e7d3', 'Plastic')), cyl('Cap', 4, 11, [x, y + 25, z], M('#b23a3a', 'Slate')), ball('Dome', 9, [x, y + 27, z], M('#b23a3a', 'Slate'))];
  kids.push(P('Part', 'Hub', [2, 2, 2], [x, y + 22, z - 6], [0, 0, 0], M('#5b3d26', 'Wood'), { canCollide: false }));
  for (let k = 0; k < 4; k++) kids.push(P('Part', 'Blade', [2.4, 14, 0.4], [x + Math.sin(k * Math.PI / 2) * 7, y + 22 + Math.cos(k * Math.PI / 2) * 7, z - 6.5], [0, 0, -k * 90], M('#f7f1e6', 'WoodPlanks'), { canCollide: false }));
  kids.push(block('Door', [4, 6, 0.4], [x, y + 3, z - 5], M('#6b3f22', 'WoodPlanks'))); return model('Windmill', kids); }
export function statue(T, x, z, r, y = 0) { const st = M('#d9d4c7', 'Marble'), kids = [block('Plinth', [8, 4, 8], [x, y + 2, z], M('#9aa1ad', 'Granite')), block('Plaque', [5, 1.2, 0.3], [x, y + 2.5, z - 4.1], M('#ffcf3d', 'Foil'))];
  kids.push(block('Legs', [3, 5, 1.6], [x, y + 6.5, z], st), block('Torso', [4, 4.5, 2], [x, y + 11.2, z], st), ball('Head', 2.4, [x, y + 14.6, z], st), block('ArmL', [1.2, 4.5, 1.2], [x - 2.6, y + 11, z], st), P('Part', 'ArmR', [1.2, 5, 1.2], [x + 2.8, y + 13.5, z], [0, 0, -150], st), P('WedgePart', 'Sword', [0.3, 6, 1], [x + 3.6, y + 17.5, z], [0, 90, 0], M('#cfd6e2', 'Metal')));
  return model('Statue', kids); }
export function bridge(T, x1, z1, x2, z2, y = 0) { const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), a = Math.atan2(dx, dz) * D, kids = [], n = Math.ceil(len / 2.2);
  for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, arc = Math.sin(t * Math.PI) * len * 0.08; kids.push(P('Part', 'Plank', [8, 0.6, len / n - 0.15], [x1 + dx * t, y + arc, z1 + dz * t], [-Math.cos(t * Math.PI) * 12, a, 0], M('#8a6239', 'WoodPlanks'))); }
  for (const s of [-1, 1]) for (let k = 0; k <= 4; k++) { const t = k / 4, arc = Math.sin(t * Math.PI) * len * 0.08, ox = Math.cos(a / D) * 4 * s, oz = -Math.sin(a / D) * 4 * s; kids.push(cyl('Post', 3, 0.6, [x1 + dx * t + ox, y + arc + 1.5, z1 + dz * t + oz], M('#5b3d26', 'Wood'))); }
  return model('Bridge', kids); }
export function volcano(T, x, z, r, y = 0, s = 1) { const kids = [], rock = M('#3a3332', 'Basalt');
  for (let k = 0; k < 7; k++) kids.push(cyl('Slope' + (k + 1), 6 * s, (70 - k * 8.5) * s, [x, y + 3 * s + k * 6 * s, z], k % 2 ? rock : M('#2b2524', 'Basalt')));
  kids.push(cyl('Crater', 1.5 * s, 16 * s, [x, y + 44 * s, z], M('#ff4800', 'Neon'), { light: { range: 60, brightness: 4 }, role: role('kill') }));
  for (let k = 0; k < 5; k++) { const a = k * 1.256 + r(), l = 30 * s; kids.push(P('Part', 'LavaFlow', [3 * s, 0.8, l], [x + Math.sin(a) * l * 0.55, y + 22 * s, z + Math.cos(a) * l * 0.55], [-38, a * D, 0], M('#ff5a1f', 'Neon'), { canCollide: false })); }
  return model('Volcano', kids); }
// a square pyramid made of 4 wedges whose high edges meet in the middle
function pyramid(name, cx, cy, cz, w, h, mat, rot = 0) { const out = [];
  for (let k = 0; k < 4; k++) { const a = rot + k * Math.PI / 2, dx = Math.sin(a), dz = Math.cos(a), th = Math.atan2(-dx, -dz) * D;
    out.push(P('WedgePart', name, [w, h, w / 2], [cx + dx * w / 4, cy + h / 2, cz + dz * w / 4], [0, th, 0], mat)); } return out; }
export function mountains(T, cx, cz, R, r, y = 0) { const kids = [], n = 14, snow = M('#ffffff', 'Snow'), rock2 = M(mixC(T.rock.c, '#000000', 0.15), T.rock.m);
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + r() * 0.2, d = R + r() * R * 0.18, h = 45 + r() * 75, w = 70 + r() * 50, px = cx + Math.cos(a) * d, pz = cz + Math.sin(a) * d, rot = r() * Math.PI;
    kids.push(...pyramid('Mountain', px, y, pz, w, h * 0.6, T.rock, rot), ...pyramid('Peak', px + (r() - 0.5) * 8, y + h * 0.45, pz + (r() - 0.5) * 8, w * 0.55, h * 0.55, rock2, rot + 0.3));
    if (h > 80 || T.ground.m === 'Snow') kids.push(...pyramid('SnowCap', px, y + h * 0.78, pz, w * 0.2, h * 0.22, snow, rot + 0.3)); }
  return model('Mountains', kids); }
export function waterfall(T, x, z, r, y = 0) { return model('Waterfall', [block('Cliff', [30, 40, 14], [x, y + 20, z + 6], T.rock), block('Fall', [10, 38, 1], [x, y + 20, z - 1.4], M('#bfeaff', 'Glass'), { transparency: 0.35, canCollide: false }),
  block('Foam', [14, 1.6, 6], [x, y + 0.8, z - 3], M('#ffffff', 'SmoothPlastic'), { transparency: 0.25, canCollide: false }), cyl('Pool', 1, 24, [x, y + 0.3, z - 8], M('#3aa8ff', 'Glass'), { transparency: 0.3 }), rocks(T, x + 12, z - 6, r, y, 0.7), rocks(T, x - 12, z - 8, r, y, 0.7)]); }
export function fence(T, x1, z1, x2, z2, y = 0) { const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), n = Math.max(1, Math.round(len / 6)), a = Math.atan2(dx, dz) * D, kids = [];
  for (let k = 0; k <= n; k++) kids.push(block('Post', [0.8, 4, 0.8], [x1 + dx * k / n, y + 2, z1 + dz * k / n], M('#8a6239', 'Wood')));
  for (const h of [1.6, 3.2]) kids.push(P('Part', 'Rail', [0.4, 0.5, len], [x1 + dx / 2, y + h, z1 + dz / 2], [0, a, 0], M('#a87a4f', 'WoodPlanks'))); return model('Fence', kids); }
export function cloud(x, y, z, r, s = 1) { const kids = []; for (let k = 0; k < 6; k++) kids.push(ball('Puff', (7 + r() * 6) * s, [x + (k - 2.5) * 4 * s, y + (r() - 0.5) * 3 * s, z + (r() - 0.5) * 5 * s], M('#ffffff', 'SmoothPlastic'), { canCollide: false, transparency: 0.08 }));
  return model('Cloud', kids); }

/* ---------- scenery around any generated map ---------- */
export const SCENERY = {
  plaine: ['oak', 'oak', 'pine', 'flowers', 'rocks', 'house', 'windmill', 'cherry'], desert: ['cactus', 'cactus', 'rocks', 'temple', 'rocks'], neige: ['pine', 'pine', 'rocks', 'house', 'crystals'],
  lave: ['rocks', 'crystals', 'volcano', 'rocks'], bonbon: ['cherry', 'flowers', 'oak', 'crystals'], neon: ['crystals', 'house', 'rocks'], espace: ['crystals', 'rocks', 'crystals'],
};
const BUILD = { oak: (T, x, z, r, y) => oak(T, x, z, r, y), cherry: (T, x, z, r, y) => oak(T, x, z, r, y, 1, true), pine: (T, x, z, r, y) => pine(T, x, z, r, y), cactus: (T, x, z, r, y) => cactus(x, z, r, y),
  rocks: (T, x, z, r, y) => rocks(T, x, z, r, y), crystals: (T, x, z, r, y) => crystals(T, x, z, r, y), flowers: (T, x, z, r, y) => flowers(x, z, r, y), house: (T, x, z, r, y) => house(T, x, z, r() * 360, r, y),
  windmill: (T, x, z, r, y) => windmill(T, x, z, r, y), temple: (T, x, z, r, y) => temple(T, x, z, r, y), volcano: (T, x, z, r, y) => volcano(T, x, z, r, y, 0.8), castle: (T, x, z, r, y) => castle(T, x, z, r, y),
  statue: (T, x, z, r, y) => statue(T, x, z, r, y), waterfall: (T, x, z, r, y) => waterfall(T, x, z, r, y) };
/** Dress up a generated map: ground skirt, scattered scenery around (not on) the gameplay, mountains and clouds. */
export function scenery(T, themeId, bounds, r, density = 1, extras = []) {
  const out = [], [x0, z0, x1, z1] = bounds, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, R = Math.max(x1 - x0, z1 - z0) / 2 + 60;
  out.push(block('Ground', [R * 2.6, 2, R * 2.6], [cx, -1.5, cz], T.ground));
  // set dressing in clusters (groves, rock fields, flower beds) with Poisson-style spacing:
  // a few cluster centres around the play area, 2–6 props of the SAME kind per cluster,
  // plus a sprinkle of singles so the ring never looks tiled
  const kinds = SCENERY[themeId] || SCENERY.plaine, n = Math.round(26 * density), placed = [];
  const free = (x, z, gap) => !(x > x0 - 20 && x < x1 + 20 && z > z0 - 20 && z < z1 + 20) && !placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < gap);
  const clusters = Math.max(3, Math.round(n / 5));
  for (let c = 0; c < clusters && placed.length < n; c++) {
    const a = r() * Math.PI * 2, d = R * (0.6 + r() * 0.5), ccx = cx + Math.cos(a) * d, ccz = cz + Math.sin(a) * d, kind = pick(r, kinds), want = 2 + Math.floor(r() * 5);
    for (let k = 0, got = 0; k < want * 6 && got < want && placed.length < n; k++) {
      const aa = r() * Math.PI * 2, dd = 6 + r() * 24, x = ccx + Math.cos(aa) * dd, z = ccz + Math.sin(aa) * dd;
      if (!free(x, z, 12)) continue; placed.push([x, z]); got++; out.push(BUILD[kind](T, x, z, r, -0.5)); }
  }
  for (let k = 0; k < n * 3 && placed.length < n; k++) { const a = r() * Math.PI * 2, d = R * (0.55 + r() * 0.6), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (!free(x, z, 22)) continue; placed.push([x, z]); out.push(BUILD[pick(r, kinds)](T, x, z, r, -0.5)); }
  for (const e of extras) { const a = r() * Math.PI * 2, d = R * 0.9, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (BUILD[e]) out.push(BUILD[e](T, x, z, r, -0.5)); }
  out.push(mountains(T, cx, cz, R * 1.45, r, -1));
  for (let k = 0; k < Math.round(8 * density); k++) out.push(cloud(cx + (r() - 0.5) * R * 2.6, 90 + r() * 60, cz + (r() - 0.5) * R * 2.6, r, 1 + r()));
  return out;
}

/* ---------- text -> map ---------- */
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const WORDS = {
  gen: { obby: 'obby parcours obstacle', tycoon: 'tycoon usine factory', simulator: 'simulator simulateur zones farm', lobby: 'lobby hub accueil spawn', arena: 'arene arena combat pvp', island: 'ile island plage tropical', city: 'ville city urbain cite', cave: 'grotte cave mine tunnel', sky: 'ciel sky nuages flottant' },
  theme: { plaine: 'plaine prairie foret champ campagne tropical tropicale jungle', desert: 'desert sable dune egypte', neige: 'neige enneige hiver glace snow polaire montagne', lave: 'volcan lave enfer feu magma', bonbon: 'bonbon candy sucre kawaii pastel', neon: 'neon cyber cyberpunk futur nuit', espace: 'espace space lune galaxie cosmos' },
  extra: { castle: 'chateau castle forteresse', temple: 'temple ruines', volcano: 'volcan volcano', windmill: 'moulin windmill', waterfall: 'cascade waterfall chute', statue: 'statue monument', house: 'maison village house' },
};
export function parseMap(text) {
  const t = ' ' + norm(text).replace(/[^\w\s-]/g, ' ') + ' ', has = (w) => w.split(' ').some((x) => x && t.includes(' ' + x));
  const out = { gen: null, theme: null, extras: [], big: /\b(grand|geant|immense|enorme|big|huge)\b/.test(t), small: /\b(petit|mini|small)\b/.test(t) };
  for (const [k, w] of Object.entries(WORDS.gen)) if (has(w)) { out.gen = k; break; }
  for (const [k, w] of Object.entries(WORDS.theme)) if (has(w)) { out.theme = k; break; }
  for (const [k, w] of Object.entries(WORDS.extra)) if (has(w)) out.extras.push(k);
  return out;
}
export function generateFromText(text, seed, o = {}) {
  const q = parseMap(text), r = rng(seed ?? [...String(text)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)), scene = parseScene(text);
  const sceneIds = new Set(scene.items.map((i) => i.id)); q.extras = q.extras.filter((e) => !sceneIds.has(e));
  if ((scene.farm || scene.items.length) && !q.gen) q.gen = 'lobby';
  if (scene.farm && !q.theme) q.theme = 'plaine';
  const wantsIsland = /\b(ile|island|plage)\b/.test(norm(text)) && q.gen !== 'island';
  const gen = q.gen || (q.extras.length ? 'lobby' : pick(r, ['obby', 'lobby', 'island', 'arena', 'simulator'])), theme = q.theme || (o.theme && THEMES[o.theme] ? o.theme : null) || pick(r, Object.keys(THEMES)), T = THEMES[theme], G = GENERATORS[gen];
  const opts = { ...Object.fromEntries(Object.entries(G.opts).map(([k, [a, b, d]]) => [k, Math.round(q.big ? b * 0.85 : q.small ? a : d)])), ...(o.gen === gen && o.opts ? o.opts : {}) };
  const core = G.make(T, r, opts), bx = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (n) => { if (n.children) n.children.forEach(walk); else { bx[0] = Math.min(bx[0], n.pos[0]); bx[1] = Math.min(bx[1], n.pos[2]); bx[2] = Math.max(bx[2], n.pos[0]); bx[3] = Math.max(bx[3], n.pos[2]); } };
  core.forEach(walk);
  const extras = q.extras.flatMap((e) => (e === 'house' ? ['house', 'house', 'house', 'house', 'house'] : [e]));
  const density = (q.big ? 1.4 : q.small ? 0.6 : 1) * (o.density || 1);
  let deco;
  if (o.voxel) { // 🧊 voxel style: cube terrain + voxel trees, rocks, flowers, clouds; landmarks keep their detailed models
    deco = voxelScenery(theme, bx, r, density, []);
    extras.forEach((e, i) => { const a = (i / Math.max(1, extras.length)) * Math.PI * 2 + 0.7, R = Math.max(bx[2] - bx[0], bx[3] - bx[1]) / 2 + 70, x = (bx[0] + bx[2]) / 2 + Math.cos(a) * R, z = (bx[1] + bx[3]) / 2 + Math.sin(a) * R;
      if (BUILD[e]) deco.push(BUILD[e](T, x, z, r, -0.5)); });
  } else deco = scenery(T, theme, bx, r, density, extras);
  if (scene.farm || scene.items.length) { const center = [bx[2] + 48, (bx[1] + bx[3]) / 2]; deco.push(model(scene.farm ? 'Farm' : 'Scene', buildScene(T, scene, center, r))); }
  if (wantsIsland) { const land = GENERATORS.island.make(T, r, { size: 160 }); deco.push(model('Island', land.filter((n) => n.name !== 'Ocean' && n.name !== 'SeaFloor' && n.name !== 'Spawn')));
    deco.push(block('Ocean', [1400, 1, 1400], [0, -3.4, 0], { c: T.water, m: 'Glass' }, { transparency: 0.25, canCollide: false })); }
  if (o.voxel) { voxelTag(core); voxelTag(deco.filter((m) => m.name !== 'Terrain' && !/^(Oak|Pine|Birch|CherryTree|SnowyPine|Palm|Cactus|DeadTree|Lollipop|Crystal|Mushroom|Rock|Bush|Cloud|Flowers)$/.test(m.name))); }
  return { gen, theme, opts, children: [model('Gameplay', core), model('Scenery', deco)], light: T.light };
}
