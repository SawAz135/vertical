/* =====================================================================
   Roblox Forge - prop library for Map Studio (Objets › 🧰 Ressources).
   Built from the prop-artist / set-dressing / environment-kits skills:
   readable silhouettes, chunky proportions, 3-tone palettes, real Roblox
   materials, ground at y, sizes in studs (a player is ~5 studs tall),
   collisions only where the player should stand or bump.
   Every builder returns a Model made of real parts (exports to Rojo as is).
   ===================================================================== */
import { P, block, cyl, ball, model } from './map-core.js';

const M = (c, m) => ({ c, m });
const WOOD = M('#8a5a33', 'WoodPlanks'), WOOD2 = M('#6b4426', 'Wood'), DARK = M('#3b2a1f', 'Wood'), STONE = M('#9aa1ad', 'Cobblestone'), METAL = M('#7b8494', 'Metal'),
  GOLD = M('#ffcf3d', 'Foil'), WHITE = M('#f4efe6', 'SmoothPlastic'), LEAF = M('#4caf50', 'LeafyGrass'), WATER = M('#4fb4ff', 'Glass');
const noCol = { canCollide: false };
const deco = (name, size, pos, mat, extra) => block(name, size, pos, mat, { canCollide: false, ...extra });
// Kenney-style detailing helpers: planks with dark gaps, 3-tone palettes, caps and rims
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); return '#' + [16, 8, 0].map((k) => Math.max(0, Math.min(255, Math.round(((n >> k) & 255) * f)))).map((v) => v.toString(16).padStart(2, '0')).join(''); };
const PLANK = ['#b8794a', '#a96c40', '#c4885a'];
// n boards along X, each slightly different shade, separated by a dark backing board
function planks(name, w, h, d, n, cx, cy, cz, extra = {}) { const out = [block(name + 'Back', [w - 0.1, h * 0.6, d - 0.1], [cx, cy - h * 0.15, cz], M('#4a2d1a', 'Wood'), { canCollide: false })], bw = w / n;
  for (let i = 0; i < n; i++) out.push(block(name, [bw - 0.14, h, d], [cx - w / 2 + bw * (i + 0.5), cy, cz], M(PLANK[i % 3], 'WoodPlanks'), extra)); return out; }

/* ---------- village / town ---------- */
function bench(T, x, z, r, y) { const kids = [
  ...[-0.55, 0, 0.55].map((dz, i) => block('Seat', [6.4, 0.35, 0.5], [x, y + 1.7, z + dz], M(PLANK[i], 'WoodPlanks'))),
  ...[0, 1].map((k) => block('Back', [6.4, 0.5, 0.25], [x, y + 2.6 + k * 0.75, z + 0.95], M(PLANK[k + 1], 'WoodPlanks'), { rot: [-12, 0, 0] })),
  ...[-2.9, 2.9].flatMap((dx) => [block('Leg', [0.35, 1.7, 1.6], [x + dx, y + 0.85, z], M('#3a3f4a', 'Metal')), block('Arm', [0.35, 0.3, 1.8], [x + dx, y + 2.3, z], M('#3a3f4a', 'Metal')),
    block('BackPost', [0.3, 2.1, 0.3], [x + dx, y + 2.8, z + 1], M('#3a3f4a', 'Metal'))])];
  return model('Bench', kids); }

function barrel(T, x, z, r, y) { const kids = [cyl('Core', 3.4, 2.4, [x, y + 1.7, z], M('#4a2d1a', 'Wood'), noCol)];
  // 10 staves around the core, alternating shades, bulging slightly in the middle
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; kids.push(block('Stave', [0.72, 3.5, 0.28], [x + Math.cos(a) * 1.25, y + 1.75, z + Math.sin(a) * 1.25], M(PLANK[i % 3], 'WoodPlanks'), { rot: [0, -a * 180 / Math.PI + 90, 0] })); }
  for (const h of [0.5, 1.75, 3.0]) kids.push(cyl('Hoop', 0.28, 2.85, [x, y + h, z], M('#5f6673', 'Metal'), noCol));
  kids.push(cyl('Lid', 0.15, 2.3, [x, y + 3.45, z], M('#8a5a33', 'WoodPlanks'), noCol), block('LidLine', [2.1, 0.17, 0.12], [x, y + 3.47, z], M('#4a2d1a', 'Wood'), noCol));
  return model('Barrel', kids); }

function crates(T, x, z, r, y) { const kids = [], spots = [[0, 0, 0, 3], [3.3, 0, 0.5, 3], [1.6, 3, 0.25, 2.6]];
  for (const [dx, dy, dz, d] of spots) { const cx = x + dx, cy = y + dy + d / 2, cz = z + dz, rot = (r() - 0.5) * 16, f = [0.18, 0.18, 0.18];
    kids.push(block('Crate', [d - 0.2, d - 0.2, d - 0.2], [cx, cy, cz], M('#b8794a', 'WoodPlanks'), { rot: [0, rot, 0] }));
    // dark frame on the 12 edges + a diagonal brace on the front: the classic readable crate
    for (const [sx, sy, sz] of [[d, 0.36, 0.36], [0.36, d, 0.36], [0.36, 0.36, d]]) for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const o = sx === d ? [0, a, b] : sy === d ? [a, 0, b] : [a, b, 0];
      kids.push(block('Edge', [sx, sy, sz], [cx + o[0] * (d / 2 - 0.18), cy + o[1] * (d / 2 - 0.18), cz + o[2] * (d / 2 - 0.18)], M('#6b4426', 'Wood'), { canCollide: false, rot: [0, rot, 0] })); }
    kids.push(block('Brace', [d * 1.25, 0.32, 0.2], [cx, cy, cz - d / 2], M('#6b4426', 'Wood'), { canCollide: false, rot: [0, rot, 45] })); }
  return model('Crates', kids); }

function well(T, x, z, r, y) { const kids = [], stone = ['#a7adb8', '#959ba6', '#b9bec7'];
  // ring of individual stones in 2 courses, offset like real masonry
  for (let row = 0; row < 3; row++) for (let i = 0; i < 12; i++) { const a = (i + (row % 2) * 0.5) / 12 * Math.PI * 2;
    kids.push(block('Stone', [1.9, 1.05, 1.1], [x + Math.cos(a) * 3.2, y + 0.55 + row * 1.05, z + Math.sin(a) * 3.2], M(stone[(i + row) % 3], 'Cobblestone'), { rot: [0, -a * 180 / Math.PI + 90, 0] })); }
  kids.push(cyl('Water', 0.2, 5.4, [x, y + 2.3, z], M('#3d8fe0', 'Glass'), { transparency: 0.15, canCollide: false }),
    ...[-3.2, 3.2].map((dx) => block('Post', [0.7, 6.2, 0.7], [x + dx, y + 5.3, z], M('#6b4426', 'Wood'))), block('Axle', [7.2, 0.45, 0.45], [x, y + 7.4, z], M('#6b4426', 'Wood'), { shape: 'Cylinder' }),
    block('Rope', [0.15, 2.6, 0.15], [x, y + 6, z], M('#d8c08a', 'Fabric'), noCol), cyl('Bucket', 1.1, 1.2, [x, y + 4.3, z], M('#8a5a33', 'WoodPlanks'), noCol), cyl('BucketBand', 0.18, 1.28, [x, y + 4.6, z], M('#5f6673', 'Metal'), noCol));
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) kids.push(block('Shingle', [4.8, 0.32, 2.3], [x + side * 1.95, y + 9.1 - i * 0 , z - 3 + i * 2], M(i % 2 ? '#c0432f' : '#d4553d', 'Slate'), { rot: [0, 0, side * -32] }));
  kids.push(block('RidgeBeam', [0.6, 0.6, 8.4], [x, y + 10.35, z], M('#6b4426', 'Wood'), noCol));
  return model('Well', kids); }

function stall(T, x, z, r, y) { const c = [T.accent ? T.accent.c : '#ff5a5a', '#ffffff'], kids = [
  ...planks('Counter', 8, 3, 3, 6, x, y + 1.5, z), block('Top', [8.6, 0.4, 3.6], [x, y + 3.2, z], M('#6b4426', 'Wood')),
  ...[-3.9, 3.9].map((dx) => block('Pole', [0.5, 7.4, 0.5], [x + dx, y + 3.7, z - 1.4], M('#6b4426', 'Wood')))];
  // scalloped striped awning: stripes + a row of hanging rounded flaps
  for (let i = 0; i < 9; i++) { const col = M(c[i % 2], 'Fabric'); kids.push(deco('Awning', [0.95, 0.3, 4.2], [x - 3.8 + i * 0.95, y + 7.3, z - 0.6], col, { rot: [14, 0, 0] }), ball('Flap', 0.95, [x - 3.8 + i * 0.95, y + 6.75, z - 2.65], col, noCol)); }
  // fruit crates on the counter
  for (const [dx, cols] of [[-2.2, ['#ff4d4d', '#e83b3b']], [0, ['#ffd84d', '#f5c330']], [2.2, ['#7bd35a', '#5cbf3f']]]) { kids.push(block('FruitBox', [1.9, 0.6, 1.6], [x + dx, y + 3.7, z], M('#a96c40', 'WoodPlanks'), noCol));
    for (let k = 0; k < 4; k++) kids.push(ball('Fruit', 0.65, [x + dx + (k % 2 - 0.5) * 0.8, y + 4.15, z + (Math.floor(k / 2) - 0.5) * 0.7], M(cols[k % 2], 'SmoothPlastic'), noCol)); }
  return model('MarketStall', kids); }

function tent(T, x, z, r, y) { const f = M('#e8c27a', 'Fabric');
  return model('Tent', [block('Side', [7, 0.3, 5.4], [x, y + 2.3, z - 1.55], f, { rot: [58, 0, 0] }), block('Side', [7, 0.3, 5.4], [x, y + 2.3, z + 1.55], f, { rot: [-58, 0, 0] }),
    cyl('Ridge', 7.4, 0.35, [x, y + 4.6, z], WOOD2, { canCollide: false, rot: [0, 0, 0] }), deco('Door', [0.1, 2.6, 1.4], [x - 3.4, y + 1.3, z], DARK)]); }
function lantern(T, x, z, r, y) { return model('Lantern', [cyl('Post', 8, 0.5, [x, y + 4, z], DARK), block('Arm', [1.6, 0.3, 0.3], [x + 0.7, y + 7.8, z], DARK),
  block('Cage', [1, 1.4, 1], [x + 1.4, y + 7, z], M('#2a2a2a', 'Metal'), noCol), block('Glow', [0.7, 1, 0.7], [x + 1.4, y + 7, z], M('#ffd27a', 'Neon'), noCol)]); }
function campfire(T, x, z, r, y) { const kids = [], st = ['#7d7f86', '#6a6c73', '#8f9198'];
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; kids.push(block('Stone', [1.3, 0.8, 1], [x + Math.cos(a) * 2.1, y + 0.4, z + Math.sin(a) * 2.1], M(st[i % 3], 'Rock'), { rot: [r() * 10, -a * 57.3, r() * 10] })); }
  // teepee of logs leaning to the centre
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; kids.push(block('Log', [0.55, 3, 0.55], [x + Math.cos(a) * 0.6, y + 1.2, z + Math.sin(a) * 0.6], M(i % 2 ? '#6b4426' : '#7d5232', 'Wood'), { shape: 'Cylinder', rot: [Math.sin(a) * 28, 0, 90 - Math.cos(a) * 28] })); }
  // flame: stacked glowing blobs getting smaller and yellower towards the tip
  for (const [d, h, c, t] of [[1.8, 1.4, '#ff4a1a', 0.15], [1.35, 2.2, '#ff8a1a', 0.1], [0.95, 2.9, '#ffc23a', 0.05], [0.55, 3.5, '#ffe98a', 0]]) kids.push(ball('Flame', d, [x + (r() - 0.5) * 0.2, y + h, z + (r() - 0.5) * 0.2], M(c, 'Neon'), { canCollide: false, transparency: t }));
  for (let i = 0; i < 4; i++) kids.push(ball('Ember', 0.18, [x + (r() - 0.5) * 1.6, y + 3.2 + r() * 1.6, z + (r() - 0.5) * 1.6], M('#ffb347', 'Neon'), noCol));
  return model('Campfire', kids); }

function signpost(T, x, z, r, y) { const kids = [block('Post', [0.6, 6.4, 0.6], [x, y + 3.2, z], M('#6b4426', 'Wood')), P('WedgePart', 'Cap', [0.8, 0.5, 0.8], [x, y + 6.65, z], [0, 0, 0], M('#4a2d1a', 'Wood'), noCol)];
  ['Spawn', 'Boutique', 'Œufs'].forEach((t, i) => { const dir = i % 2 ? -1 : 1, rot = i * 30 - 15;
    kids.push(block('Board', [3.2, 0.85, 0.25], [x + dir * 1.55, y + 5.4 - i * 1.15, z], M(PLANK[i], 'WoodPlanks'), { rot: [0, rot, 0] }),
      P('WedgePart', 'Tip', [0.25, 0.85, 0.6], [x + dir * 3.45, y + 5.4 - i * 1.15, z], [0, rot + (dir > 0 ? 90 : -90), 0], M(PLANK[i], 'WoodPlanks'), noCol)); });
  return model('Signpost', kids); }

function fountain(T, x, z, r, y) { return model('Fountain', [cyl('Basin', 1.6, 14, [x, y + 0.8, z], M('#d9d4c7', 'Marble')), cyl('Water', 0.2, 12.6, [x, y + 1.5, z], WATER, { transparency: 0.25, canCollide: false }),
  cyl('Pillar', 5, 1.8, [x, y + 3.5, z], M('#d9d4c7', 'Marble')), cyl('Bowl', 0.8, 5, [x, y + 6.2, z], M('#d9d4c7', 'Marble')),
  ball('Spray', 2.4, [x, y + 7.4, z], M('#bfeaff', 'Glass'), { transparency: 0.35, canCollide: false })]); }

/* ---------- nature ---------- */
function bush(T, x, z, r, y) { const kids = [], c = T.leaf || LEAF; for (let i = 0; i < 4; i++) kids.push(ball('Leaves', 2.4 + r() * 1.6, [x + (r() - 0.5) * 3, y + 1.2 + r() * 0.6, z + (r() - 0.5) * 3], c, noCol));
  if (r() < 0.6) for (let i = 0; i < 3; i++) kids.push(ball('Berry', 0.5, [x + (r() - 0.5) * 3, y + 2.2, z - 1.4], M('#ff3d6e', 'SmoothPlastic'), noCol));
  return model('Bush', kids); }
function mushroom(T, x, z, r, y) { const s = 1 + r() * 0.6;
  return model('GiantMushroom', [cyl('Stem', 7 * s, 2.2 * s, [x, y + 3.5 * s, z], WHITE), cyl('Cap', 2.4 * s, 10 * s, [x, y + 7.6 * s, z], M('#e8413a', 'SmoothPlastic')), cyl('CapTop', 1.6 * s, 7 * s, [x, y + 9.4 * s, z], M('#e8413a', 'SmoothPlastic')), cyl('Gills', 0.4 * s, 9 * s, [x, y + 6.3 * s, z], M('#f6e7d0', 'SmoothPlastic'), noCol),
    ...[[2, 1.5], [-2.4, 0.4], [0.4, -2.6], [-0.6, 2.4]].map(([dx, dz]) => ball('Spot', 1.4 * s, [x + dx * s, y + 9.9 * s, z + dz * s], WHITE, noCol))]); }
function stump(T, x, z, r, y) { return model('Stump', [cyl('Stump', 2.4, 3.2, [x, y + 1.2, z], WOOD2), cyl('Rings', 0.1, 2.6, [x, y + 2.42, z], M('#c9a06a', 'Wood'), noCol),
  block('Log', [7, 1.6, 1.6], [x + 4.6, y + 0.8, z + 1.2], WOOD2, { shape: 'Cylinder', rot: [0, 25, 0] })]); }
function pond(T, x, z, r, y) { const kids = [cyl('Water', 0.3, 14, [x, y + 0.15, z], WATER, { transparency: 0.2, canCollide: false })];
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; kids.push(ball('Stone', 1.4 + r(), [x + Math.cos(a) * 7.2, y + 0.4, z + Math.sin(a) * 7.2], M('#8f9298', 'Rock'))); }
  for (let i = 0; i < 3; i++) kids.push(cyl('LilyPad', 0.1, 1.6, [x + (r() - 0.5) * 8, y + 0.32, z + (r() - 0.5) * 8], M('#3e9a48', 'Grass'), noCol));
  return model('Pond', kids); }
function sunflowers(T, x, z, r, y) { const kids = []; for (let i = 0; i < 5; i++) { const dx = (r() - 0.5) * 6, dz = (r() - 0.5) * 6, h = 4 + r() * 2;
  kids.push(cyl('Stem', h, 0.3, [x + dx, y + h / 2, z + dz], M('#4e9a4a', 'Grass'), noCol), cyl('Petals', 0.3, 2.2, [x + dx, y + h, z + dz - 0.2], M('#ffd84d', 'SmoothPlastic'), { canCollide: false, rot: [0, 90, 0] }),
    cyl('Heart', 0.35, 1, [x + dx, y + h, z + dz - 0.35], M('#6b3f1d', 'SmoothPlastic'), { canCollide: false, rot: [0, 90, 0] })); }
  return model('Sunflowers', kids); }
function rockArch(T, x, z, r, y) { const rk = T.rock || M('#8f9298', 'Rock');
  return model('RockArch', [block('Leg', [4, 12, 4], [x - 6, y + 6, z], rk, { rot: [0, 0, 6] }), block('Leg', [4, 12, 4], [x + 6, y + 6, z], rk, { rot: [0, 0, -6] }), block('Top', [17, 4, 4.4], [x, y + 13, z], rk, { rot: [0, 0, 3] })]); }

function rockCluster(T, x, z, r, y) { const base = (T.rock && T.rock.c) || '#8f9298', kids = [];
  // faceted chunks: rotated blocks + wedges in 3 tones, biggest in the middle
  for (let i = 0; i < 6; i++) { const big = i === 0, d = big ? 5 : 2 + r() * 2.2, a = r() * Math.PI * 2, rr = big ? 0 : 2.5 + r() * 1.5;
    kids.push(block('Rock', [d, d * (big ? 0.9 : 0.7), d * 0.9], [x + Math.cos(a) * rr, y + d * 0.32, z + Math.sin(a) * rr], M(shade(base, [1, 0.86, 1.12][i % 3]), 'Rock'), { rot: [r() * 25, r() * 360, r() * 25] }));
    if (big) kids.push(P('WedgePart', 'RockTop', [d * 0.8, d * 0.5, d * 0.6], [x, y + d * 0.85, z], [0, r() * 360, 0], M(shade(base, 1.15), 'Rock'))); }
  return model('RockCluster', kids); }
function grassPlatform(T, x, z, r, y, snow = false) { const top = snow ? M('#f4f7ff', 'Snow') : M('#5fd38a', 'Grass'), drip = snow ? M('#e6ecf7', 'Snow') : M('#4cbf76', 'Grass'), dirt = M('#c9774a', 'Ground'), kids = [];
  // dirt block with a thick overhanging top and little drips, like platformer kits
  kids.push(block('Dirt', [11, 5, 11], [x, y + 2.5, z], dirt), block('Top', [12, 1.6, 12], [x, y + 5.6, z], top));
  for (let i = 0; i < 10; i++) { const side = i % 4, t = (Math.floor(i / 4) + r()) / 3 * 10 - 5, px = side === 0 ? -6 : side === 1 ? 6 : t, pz = side === 2 ? -6 : side === 3 ? 6 : t;
    kids.push(block('Drip', [side < 2 ? 0.6 : 1.4 + r(), 1 + r() * 0.8, side < 2 ? 1.4 + r() : 0.6], [x + px, y + 4.4, z + pz], drip, noCol)); }
  return model(snow ? 'SnowPlatform' : 'GrassPlatform', kids); }
function ladder(T, x, z, r, y) { const kids = [-1, 1].map((sx) => block('Rail', [0.45, 12, 0.45], [x + sx * 1.3, y + 6, z], M('#8a5a33', 'Wood')));
  for (let i = 0; i < 10; i++) kids.push(block('Rung', [2.6, 0.32, 0.36], [x, y + 0.9 + i * 1.15, z], M(PLANK[i % 3], 'WoodPlanks')));
  kids.push(P('TrussPart', 'Climb', [2, 12, 2], [x, y + 6, z + 0.5], [0, 0, 0], M('#8a5a33', 'Wood'), { transparency: 1 }));
  return model('Ladder', kids); }
function logPile(T, x, z, r, y) { const kids = []; let n = 0;
  for (const [row, count] of [[0, 4], [1, 3], [2, 2]]) for (let i = 0; i < count; i++) { const dx = (i - (count - 1) / 2) * 1.5;
    kids.push(cyl('Log', 5, 1.45, [x + dx, y + 0.72 + row * 1.25, z], M(n % 2 ? '#7d5232' : '#6b4426', 'Wood'), { rot: [90, 0, 0] }), cyl('LogEnd', 0.1, 1.2, [x + dx, y + 0.72 + row * 1.25, z - 2.52], M('#d9b07a', 'Wood'), { canCollide: false, rot: [90, 0, 0] })); n++; }
  return model('LogPile', kids); }

/* ---------- simulator gameplay dressing ---------- */
function eggPedestal(T, x, z, r, y) { const g = T.glow || M('#7c5cff', 'Neon');
  return model('EggPedestal', [cyl('Base', 1.4, 10, [x, y + 0.7, z], M('#2b2f4a', 'SmoothPlastic')), cyl('Ring', 0.3, 10.6, [x, y + 0.2, z], g, noCol),
    P('Part', 'Egg', [4.2, 5.4, 4.2], [x, y + 4.2, z], [0, 0, 0], M('#f2e6c9', 'SmoothPlastic'), { shape: 'Ball' }), block('Sign', [6, 1.6, 0.3], [x, y + 8.6, z - 0.3], M('#1d2140', 'SmoothPlastic'), noCol)]); }
function worldGate(T, x, z, r, y) { const g = T.glow || M('#3ee6ff', 'Neon'), st = M('#5b5f73', 'Cobblestone');
  return model('WorldGate', [block('PillarL', [3, 16, 3], [x - 8, y + 8, z], st), block('PillarR', [3, 16, 3], [x + 8, y + 8, z], st), block('Lintel', [19, 3, 3.4], [x, y + 17.5, z], st),
    block('Barrier', [13, 15, 0.6], [x, y + 7.5, z], g, { transparency: 0.45 }), block('PriceSign', [8, 2.4, 0.4], [x, y + 20.5, z - 0.6], M('#ffcf3d', 'SmoothPlastic'), noCol)],
  { attributes: { ForgeGate: true, Price: 1000 } }); }
function shopBooth(T, x, z, r, y) { const kids = [block('Counter', [12, 3.4, 4], [x, y + 1.7, z], M('#3b4170', 'SmoothPlastic')), block('Top', [12.4, 0.4, 4.4], [x, y + 3.6, z], M('#ffcf3d', 'SmoothPlastic')),
  ...[-5.6, 5.6].map((dx) => block('Pole', [0.6, 9, 0.6], [x + dx, y + 4.5, z + 1.6], M('#ffffff', 'SmoothPlastic'))), block('Board', [12.4, 2.6, 0.4], [x, y + 9.4, z + 1.6], M('#ff5a5a', 'SmoothPlastic'))];
  for (let i = 0; i < 8; i++) kids.push(deco('Awning', [1.55, 0.3, 4.6], [x - 5.4 + i * 1.55, y + 8, z - 0.4], M(i % 2 ? '#ffffff' : '#3fd0ff', 'Fabric'), { rot: [14, 0, 0] }));
  return model('ShopBooth', kids); }
function chest(T, x, z, r, y) { const gold = M('#ffc93c', 'Metal'), kids = [
  block('Box', [4.2, 2.3, 2.8], [x, y + 1.15, z], M('#a96c40', 'WoodPlanks')),
  ...[0.55, 1.2, 1.85].map((h, i) => deco('PlankLine', [4.25, 0.12, 2.85], [x, y + h, z], M('#5a3720', 'Wood'))),
  cyl('Lid', 4.2, 2.8, [x, y + 2.3, z], M('#b8794a', 'WoodPlanks'), { rot: [0, 0, 0] }),
  ...[-1.55, 1.55].map((dx) => block('Band', [0.45, 3.7, 2.95], [x + dx, y + 1.85, z], gold, noCol)),
  block('Lock', [0.95, 1.05, 0.4], [x, y + 2.15, z - 1.5], gold, noCol), block('Keyhole', [0.22, 0.42, 0.1], [x, y + 2.1, z - 1.72], M('#2a1a10', 'SmoothPlastic'), noCol),
  ...[0, 1, 2].map((i) => P('WedgePart', 'Gem', [0.6, 0.8, 0.6], [x - 0.8 + i * 0.8, y + 3.65, z - 0.6], [0, 45 * i, 0], M(['#3ee6ff', '#ff4d8d', '#7dff5a'][i], 'Neon'), noCol))];
  return model('TreasureChest', kids); }
function gemPile(T, x, z, r, y) { const kids = [], cols = ['#3ee6ff', '#c86bff', '#ff4d8d', '#7dff5a'];
  for (let i = 0; i < 9; i++) kids.push(P('WedgePart', 'Gem', [1.2, 1.6, 1.2], [x + (r() - 0.5) * 4, y + 0.8 + r() * 0.8, z + (r() - 0.5) * 4], [0, r() * 360, 0], M(pick(r, cols), 'Neon'), noCol));
  return model('GemPile', kids); }
function coinPile(T, x, z, r, y) { const kids = []; for (let i = 0; i < 14; i++) kids.push(cyl('Coin', 0.3, 1.6, [x + (r() - 0.5) * 3, y + 0.2 + Math.floor(i / 5) * 0.32, z + (r() - 0.5) * 3], GOLD, { canCollide: false, rot: [r() * 20, 0, 90 + r() * 20] }));
  return model('CoinPile', kids); }
function trophy(T, x, z, r, y) { return model('Trophy', [block('Base', [3, 1.2, 3], [x, y + 0.6, z], M('#2b2b2b', 'Marble')), cyl('Stem', 2, 0.8, [x, y + 2.2, z], GOLD), P('Part', 'Cup', [3, 3, 3], [x, y + 4.4, z], [0, 0, 0], GOLD, { shape: 'Ball' }),
  ...[-1.8, 1.8].map((dx) => cyl('Handle', 0.4, 1.4, [x + dx, y + 4.6, z], GOLD, { canCollide: false, rot: [0, 0, 0] }))]); }
function leaderboardStand(T, x, z, r, y) { return model('LeaderboardStand', [block('Board', [14, 18, 1], [x, y + 11, z], M('#181430', 'SmoothPlastic')), block('Frame', [15, 19, 0.6], [x, y + 11, z + 0.6], GOLD),
  ...[-6, 6].map((dx) => block('Leg', [1, 2, 1], [x + dx, y + 1, z], M('#2b2b2b', 'Metal')))], { attributes: { ForgeLeaderboard: true } }); }

/* ---------- fantasy / ruins ---------- */
function obelisk(T, x, z, r, y) { const g = T.glow || M('#7c5cff', 'Neon');
  return model('Obelisk', [block('Base', [6, 2, 6], [x, y + 1, z], M('#3a3a46', 'Slate')), block('Shaft', [3, 14, 3], [x, y + 9, z], M('#2a2a36', 'Slate')), P('WedgePart', 'Tip', [3, 3, 1.5], [x, y + 17.5, z - 0.75], [0, 0, 0], M('#2a2a36', 'Slate')),
    P('WedgePart', 'Tip', [3, 3, 1.5], [x, y + 17.5, z + 0.75], [0, 180, 0], M('#2a2a36', 'Slate')), block('Rune', [0.2, 8, 1], [x - 1.55, y + 9, z], g, noCol), block('Rune', [0.2, 8, 1], [x + 1.55, y + 9, z], g, noCol)]); }
function ruins(T, x, z, r, y) { const st = M('#d9d4c7', 'Marble'), kids = [];
  for (let i = 0; i < 4; i++) { const h = 4 + r() * 9, a = i / 4 * Math.PI * 2 + 0.4; kids.push(cyl('Pillar', h, 2.4, [x + Math.cos(a) * 7, y + h / 2, z + Math.sin(a) * 7], st)); }
  kids.push(block('Fallen', [9, 2.2, 2.2], [x + 1, y + 1.1, z - 1], st, { shape: 'Cylinder', rot: [0, 30, 0] }), block('Floor', [16, 0.6, 16], [x, y + 0.3, z], M('#bfb8a6', 'Pebble')));
  return model('Ruins', kids); }
function torch(T, x, z, r, y) { return model('Torch', [cyl('Stick', 5, 0.6, [x, y + 2.5, z], DARK), cyl('Head', 1, 1.1, [x, y + 5.2, z], M('#2a2a2a', 'Metal')),
  P('WedgePart', 'Flame', [0.9, 1.6, 0.9], [x, y + 6.4, z], [0, 45, 0], M('#ff8a1a', 'Neon'), noCol)]); }
function crystalTree(T, x, z, r, y) { const g = T.glow || M('#3ee6ff', 'Neon'), kids = [cyl('Trunk', 9, 1.6, [x, y + 4.5, z], M('#2a2440', 'Slate'))];
  for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2, d = r() * 3; kids.push(P('WedgePart', 'Crystal', [1.4, 3 + r() * 2, 1.4], [x + Math.cos(a) * d, y + 9 + r() * 3, z + Math.sin(a) * d], [r() * 30 - 15, r() * 360, 0], g, noCol)); }
  return model('CrystalTree', kids); }

/* ---------- city ---------- */
function streetLamp(T, x, z, r, y) { return model('StreetLamp', [cyl('Pole', 12, 0.6, [x, y + 6, z], M('#2b2f3a', 'Metal')), block('Arm', [3, 0.4, 0.4], [x + 1.3, y + 12, z], M('#2b2f3a', 'Metal')),
  block('Light', [1.6, 0.5, 1], [x + 2.6, y + 11.7, z], M('#fff3c4', 'Neon'), noCol)]); }
function busStop(T, x, z, r, y) { return model('BusStop', [block('Roof', [10, 0.4, 4], [x, y + 8, z], M('#2b2f3a', 'Metal')), block('Back', [10, 7, 0.3], [x, y + 4, z + 1.9], M('#cfe8ff', 'Glass'), { transparency: 0.4 }),
  ...[-4.8, 4.8].map((dx) => block('Post', [0.4, 8, 0.4], [x + dx, y + 4, z + 1.9], M('#2b2f3a', 'Metal'))), block('Bench', [7, 0.5, 1.6], [x, y + 1.8, z + 1], WOOD)]); }
function hydrant(T, x, z, r, y) { const red = M('#d6312b', 'SmoothPlastic');
  return model('Hydrant', [cyl('Body', 2.4, 1.2, [x, y + 1.2, z], red), ball('Cap', 1.3, [x, y + 2.5, z], red), cyl('Nozzle', 1.6, 0.5, [x, y + 1.6, z], red, { rot: [90, 0, 0] })]); }
function trafficCone(T, x, z, r, y) { return model('TrafficCone', [block('Foot', [1.6, 0.2, 1.6], [x, y + 0.1, z], M('#ff7a1a', 'SmoothPlastic')), cyl('Cone', 2.2, 1, [x, y + 1.3, z], M('#ff7a1a', 'SmoothPlastic')),
  cyl('Stripe', 0.4, 1.05, [x, y + 1.4, z], M('#ffffff', 'SmoothPlastic'), noCol)]); }

const pick = (r, a) => a[Math.floor(r() * a.length)];
export const PROP_CATS = { village: '🏡 Village', nature: '🌿 Nature', simu: '🥚 Simulateur', fantasy: '🔮 Fantasy', city: '🏙️ Ville' };
export const PROPS = {
  bench: { e: '🪑', fr: 'Banc', cat: 'village', build: bench }, barrel: { e: '🛢️', fr: 'Tonneau', cat: 'village', build: barrel }, crates: { e: '📦', fr: 'Caisses', cat: 'village', build: crates },
  well: { e: '🪣', fr: 'Puits', cat: 'village', build: well }, stall: { e: '🍎', fr: 'Étal de marché', cat: 'village', build: stall }, tent: { e: '⛺', fr: 'Tente', cat: 'village', build: tent },
  lantern: { e: '🏮', fr: 'Lanterne', cat: 'village', build: lantern }, campfire: { e: '🔥', fr: 'Feu de camp', cat: 'village', build: campfire }, signpost: { e: '🪧', fr: 'Panneau', cat: 'village', build: signpost },
  fountain: { e: '⛲', fr: 'Fontaine', cat: 'village', build: fountain },
  bush: { e: '🌳', fr: 'Buisson', cat: 'nature', build: bush }, mushroom: { e: '🍄', fr: 'Champignon géant', cat: 'nature', build: mushroom }, stump: { e: '🪵', fr: 'Souche et tronc', cat: 'nature', build: stump },
  pond: { e: '🪷', fr: 'Mare', cat: 'nature', build: pond }, rockCluster: { e: '⛰️', fr: 'Rochers facettés', cat: 'nature', build: rockCluster },
  grassPlatform: { e: '🟩', fr: 'Plateforme herbe', cat: 'nature', build: (T, x, z, r, y) => grassPlatform(T, x, z, r, y) }, snowPlatform: { e: '⬜', fr: 'Plateforme neige', cat: 'nature', build: (T, x, z, r, y) => grassPlatform(T, x, z, r, y, true) },
  logPile: { e: '🪵', fr: 'Tas de bûches', cat: 'nature', build: logPile }, ladder: { e: '🪜', fr: 'Échelle', cat: 'village', build: ladder }, sunflowers: { e: '🌻', fr: 'Tournesols', cat: 'nature', build: sunflowers }, rockArch: { e: '🪨', fr: 'Arche de pierre', cat: 'nature', build: rockArch },
  eggPedestal: { e: '🥚', fr: 'Socle d\'œuf', cat: 'simu', build: eggPedestal }, worldGate: { e: '🚪', fr: 'Porte de monde', cat: 'simu', build: worldGate }, shopBooth: { e: '🛍️', fr: 'Stand boutique', cat: 'simu', build: shopBooth },
  chest: { e: '🧰', fr: 'Coffre au trésor', cat: 'simu', build: chest }, gemPile: { e: '💎', fr: 'Tas de gemmes', cat: 'simu', build: gemPile }, coinPile: { e: '🪙', fr: 'Tas de pièces', cat: 'simu', build: coinPile },
  trophy: { e: '🏆', fr: 'Trophée', cat: 'simu', build: trophy }, leaderboardStand: { e: '📋', fr: 'Panneau classement', cat: 'simu', build: leaderboardStand },
  obelisk: { e: '🗿', fr: 'Obélisque', cat: 'fantasy', build: obelisk }, ruins: { e: '🏛️', fr: 'Ruines', cat: 'fantasy', build: ruins }, torch: { e: '🔦', fr: 'Torche', cat: 'fantasy', build: torch },
  crystalTree: { e: '🔮', fr: 'Arbre de cristal', cat: 'fantasy', build: crystalTree },
  streetLamp: { e: '💡', fr: 'Lampadaire', cat: 'city', build: streetLamp }, busStop: { e: '🚏', fr: 'Arrêt de bus', cat: 'city', build: busStop }, hydrant: { e: '🧯', fr: 'Bouche incendie', cat: 'city', build: hydrant },
  trafficCone: { e: '🚧', fr: 'Plot', cat: 'city', build: trafficCone },
};
