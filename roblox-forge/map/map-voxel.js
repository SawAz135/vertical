/* =====================================================================
   Roblox Forge - voxel maps.
   The "voxel figurine" style for whole maps: sculpted voxel trees, rocks,
   bushes, flowers, mushrooms, cacti and clouds (SDF → cubes → greedy merge,
   same engine as the voxel pets), a stepped cube terrain of hills, cliffs,
   lakes and beaches around the play area, and every block tagged ForgeVox so
   it shows its little cubes (bevel + own tint) in the app, in Blender renders
   and in Roblox (ForgeVoxel material). Gameplay parts keep their exact shape.
   ===================================================================== */
import { P, block, model } from './map-core.js';
import { voxelizeField, sdEll, sdCone, smin, mixc, shadeHex, hash2 } from '../studio/voxel.js';

const M = (c, m = 'SmoothPlastic') => ({ c, m });
const pick = (r, a) => a[Math.floor(r() * a.length)];
const len = Math.hypot;
const noise = (x, y, z) => { let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + Math.floor(z) * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise2(x, z) { const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = (t) => t * t * (3 - 2 * t), n = (a, b) => hash2(a * 7 + 3, b * 13 + 5);
  const a = n(xi, zi), b = n(xi + 1, zi), c = n(xi, zi + 1), d = n(xi + 1, zi + 1), X = u(fx), Z = u(fz); return a + (b - a) * X + (c - a) * Z + (a - b - c + d) * X * Z; }
function Field() { let d = 1e9, tag = 'wood';
  return { add(x, t, k = 0) { if (x < d) tag = t; d = k ? smin(d, x, k) : Math.min(d, x); }, cut(x) { d = Math.max(d, -x); }, out: () => [d, tag, { tag }] }; }

/* ---------- palettes per theme ---------- */
const PAL = {
  plaine: { leaf: ['#4fae3c', '#3f9a33', '#6cc24a', '#2f8a2c'], wood: '#7a4f2c', grass: ['#62b94a', '#58ad42', '#6fc554'], dirt: '#8a5a33', stone: '#8d8f96', sand: '#e8d29a', water: '#3fa8ff', flower: ['#ff6bab', '#ffd84d', '#ffffff', '#9a7bff', '#ff8a3d'], snow: false },
  desert: { leaf: ['#7aa83c', '#6b9a33', '#8cbc4a'], wood: '#9a6a3c', grass: ['#e8c87a', '#dcbb6c', '#f0d58c'], dirt: '#c9944f', stone: '#c98a4f', sand: '#f0d58c', water: '#3fc8d8', flower: ['#ff6b6b', '#ffd84d'], snow: false },
  neige: { leaf: ['#2f6a45', '#275c3b', '#3a7a52'], wood: '#5a3e2a', grass: ['#f4f8ff', '#e9f0fb', '#ffffff'], dirt: '#9aa6b8', stone: '#7d8794', sand: '#dfe8f5', water: '#7fc8ff', flower: ['#a8e0ff', '#ffffff'], snow: true },
  lave: { leaf: ['#ff7a1a', '#e85a12', '#ffb03a'], wood: '#2b2220', grass: ['#3a3030', '#332a2a', '#443838'], dirt: '#2a2222', stone: '#4a3a36', sand: '#5a4038', water: '#ff6a1a', flower: ['#ffb03a', '#ff5a1a'], snow: false, lavaWater: true },
  bonbon: { leaf: ['#ff9ad5', '#ffb3e0', '#ff7ac0', '#c8a8ff'], wood: '#ffffff', grass: ['#9be8c0', '#b8f0d4', '#8adcb2'], dirt: '#ffcfe3', stone: '#e0c8ff', sand: '#fff0b8', water: '#7ae0ff', flower: ['#ff6bab', '#ffd84d', '#7ae0ff', '#c8a8ff'], snow: false },
  neon: { leaf: ['#3ee6ff', '#7c5cff', '#ff4fd8'], wood: '#1a1a2e', grass: ['#22223a', '#1c1c32', '#2a2a46'], dirt: '#14142a', stone: '#3a3a5a', sand: '#2a2a46', water: '#3ee6ff', flower: ['#3ee6ff', '#ff4fd8', '#7c5cff'], snow: false, glow: true },
  espace: { leaf: ['#9a7bff', '#7c5cff', '#c8a8ff'], wood: '#4a4a6a', grass: ['#b8b4c8', '#a8a4b8', '#c8c4d8'], dirt: '#8a86a0', stone: '#6a6680', sand: '#d8d4e8', water: '#7c5cff', flower: ['#9a7bff', '#3ee6ff'], snow: false, glow: true },
};
export const palette = (theme) => PAL[theme] || PAL.plaine;

/* ---------- sculptures (local coords, feet at y = 0) ---------- */
const TREE_KINDS = { plaine: ['oak', 'oak', 'birch', 'pine', 'cherry'], desert: ['palm', 'cactus', 'palm'], neige: ['snowpine', 'snowpine', 'pine'], lave: ['dead', 'dead', 'crystal'],
  bonbon: ['candy', 'cherry', 'candy'], neon: ['crystal', 'crystal'], espace: ['crystal', 'mushroom'] };
const SCULPT = {
  oak: { box: [[-7, 0, -7], [7, 17, 7]], build(p, v) { const F = Field(), h = 6 + v * 2;
      F.add(sdCone(p, [0, 0, 0], [0.4, h + 2, 0.2], 1.3, 0.8), 'wood'); F.add(sdCone(p, [0, h - 1, 0], [2.6, h + 1.5, 0.8], 0.6, 0.4), 'wood');
      for (const [x, y, z, rr] of [[0, h + 3.5, 0, 4.6], [3, h + 2.2, 1, 3.4], [-2.8, h + 2.5, -1.2, 3.6], [0.8, h + 5.4, -1.4, 3.2], [-1, h + 2, 2.8, 3]]) F.add(sdEll(p, [x * (1 + v * 0.1), y, z], [rr, rr * 0.82, rr]) + (noise(p[0] * 0.9, p[1] * 0.9, p[2] * 0.9) - 0.5) * 0.9, 'leaf', 0.8);
      for (const [x, z] of [[1.6, 0], [-1.4, 0.6], [0, -1.6]]) F.add(sdCone(p, [x * 0.5, 0.6, z * 0.5], [x, 0, z], 0.7, 0.45), 'wood'); // roots
      return F.out(); } },
  cherry: { box: [[-7, 0, -7], [7, 16, 7]], build(p, v) { const r = SCULPT.oak.build(p, v); if (r[1] === 'leaf') r[1] = r[2].tag = 'blossom'; return r; } },
  birch: { box: [[-5, 0, -5], [5, 17, 5]], build(p, v) { const F = Field(), h = 8 + v * 2;
      F.add(sdCone(p, [0, 0, 0], [0, h + 4, 0], 0.9, 0.6), 'birch'); for (const [y, rr] of [[h + 1, 3.4], [h + 3.6, 3], [h + 5.8, 2.2]]) F.add(sdEll(p, [0, y, 0], [rr, rr * 0.9, rr]) + (noise(p[0], p[1], p[2]) - 0.5) * 0.8, 'leaf', 0.6);
      return F.out(); } },
  pine: { box: [[-5, 0, -5], [5, 18, 5]], build(p, v) { const F = Field(), h = 14 + v * 2;
      F.add(sdCone(p, [0, 0, 0], [0, 3, 0], 0.9, 0.8), 'wood');
      for (let i = 0; i < 4; i++) { const y0 = 2.5 + i * (h - 3) / 4.4, rr = 4.6 - i * 0.95; F.add(sdCone(p, [0, y0, 0], [0, y0 + 4.2, 0], rr, 0.2), i % 2 ? 'leaf' : 'leaf2', 0.2); }
      return F.out(); } },
  snowpine: { box: [[-5, 0, -5], [5, 18, 5]], build(p, v) { const r = SCULPT.pine.build(p, v); if ((r[1] === 'leaf' || r[1] === 'leaf2') && noise(p[0] * 1.3, p[1] * 2.5, p[2] * 1.3) > 0.45 && p[1] > 3) { r[1] = r[2].tag = 'snow'; } return r; } },
  palm: { box: [[-7, 0, -7], [7, 16, 7]], build(p, v) { const F = Field(), top = [2.4 + v, 12.5, 0.8];
      for (let i = 0; i < 6; i++) { const t0 = i / 6, t1 = (i + 1) / 6, at = (t) => [top[0] * t * t, top[1] * t, top[2] * t * t]; F.add(sdCone(p, at(t0), at(t1), 0.85 - t0 * 0.3, 0.85 - t1 * 0.3), i % 2 ? 'wood' : 'wood2'); }
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, d = [Math.cos(a), 0, Math.sin(a)], mid = [top[0] + d[0] * 3, top[1] + 0.9, top[2] + d[2] * 3], end = [top[0] + d[0] * 6, top[1] - 1.6, top[2] + d[2] * 6];
        F.add(Math.min(sdCone(p, top, mid, 0.5, 0.45), sdCone(p, mid, end, 0.45, 0.15)), 'leaf'); }
      F.add(sdEll(p, [top[0], top[1] - 0.8, top[2]], [1, 0.9, 1]), 'coco'); return F.out(); } },
  cactus: { box: [[-4, 0, -4], [4, 11, 4]], build(p, v) { const F = Field(); F.add(sdCone(p, [0, 0, 0], [0, 7.5 + v, 0], 1.2, 1.1), 'cactus');
      F.add(Math.min(sdCone(p, [0, 3.2, 0], [2.3, 3.4, 0], 0.7, 0.7), sdCone(p, [2.3, 3.4, 0], [2.3, 6, 0], 0.7, 0.65)), 'cactus', 0.3);
      F.add(Math.min(sdCone(p, [0, 4.6, 0], [-2, 4.8, 0], 0.65, 0.6), sdCone(p, [-2, 4.8, 0], [-2, 6.6, 0], 0.6, 0.55)), 'cactus', 0.3);
      F.add(sdEll(p, [0, 8 + v, 0], [0.7, 0.5, 0.7]), 'cflower'); return F.out(); } },
  dead: { box: [[-6, 0, -6], [6, 14, 6]], build(p, v) { const F = Field(); F.add(sdCone(p, [0, 0, 0], [0.5, 9, 0], 1.1, 0.5), 'wood');
      for (const [a, b] of [[[0.3, 5, 0], [3.6, 9, 1]], [[0.4, 6.5, 0], [-3, 10.5, -0.6]], [[0.5, 8, 0], [0.8, 12, 2.6]]]) F.add(sdCone(p, a, b, 0.5, 0.25), 'wood');
      F.add(sdEll(p, [0, 0.4, 0], [2.2, 0.6, 2.2]), 'ember'); return F.out(); } },
  candy: { box: [[-5, 0, -5], [5, 15, 5]], build(p, v) { const F = Field(); F.add(sdCone(p, [0, 0, 0], [0, 9, 0], 0.6, 0.6), 'stick');
      F.add(Math.max(sdEll(p, [0, 11, 0], [3.4, 3.4, 1.1]), 0), 'swirl'); return F.out(); } },
  crystal: { box: [[-5, 0, -5], [5, 14, 5]], build(p, v) { const F = Field();
      for (const [x, z, h, rr] of [[0, 0, 11 + v, 1.6], [2.2, 0.8, 7, 1.1], [-1.8, 1.2, 6, 1], [0.6, -2, 5, 0.9]]) F.add(sdCone(p, [x * 0.3, 0, z * 0.3], [x, h, z], rr, 0.1), 'crystal');
      F.add(sdEll(p, [0, 0.3, 0], [3, 0.8, 3]), 'stone'); return F.out(); } },
  mushroom: { box: [[-5, 0, -5], [5, 10, 5]], build(p, v) { const F = Field(); F.add(sdCone(p, [0, 0, 0], [0, 5, 0], 1.1, 0.8), 'stem');
      F.add(Math.max(sdEll(p, [0, 5.4, 0], [4, 2.6, 4]), -(p[1] - 4.6)), 'cap'); return F.out(); } },
  rock: { box: [[-5, 0, -5], [5, 6, 5]], build(p, v) { const F = Field();
      for (const [x, y, z, rr] of [[0, 1.2, 0, 2.8], [2, 0.8, 1, 1.9], [-1.6, 0.7, -1.2, 1.6]]) F.add(sdEll(p, [x, y, z], [rr * 1.1, rr * 0.8, rr]) + (noise(p[0] * 0.8, p[1] * 0.8, p[2] * 0.8) - 0.5) * 0.9, 'stone', 0.5);
      return F.out(); } },
  bush: { box: [[-4, 0, -4], [4, 5, 4]], build(p, v) { const F = Field();
      for (const [x, z, rr] of [[0, 0, 2.2], [1.6, 0.6, 1.6], [-1.5, -0.4, 1.7]]) F.add(sdEll(p, [x, rr * 0.7, z], [rr, rr * 0.8, rr]) + (noise(p[0], p[1], p[2]) - 0.5) * 0.6, 'leaf', 0.4);
      if (v > 0.5) for (const [x, y, z] of [[1, 2, 1.6], [-1, 2.4, -1.3], [0.4, 3, -0.6]]) F.add(sdEll(p, [x, y, z], [0.35, 0.35, 0.35]), 'berry');
      return F.out(); } },
  cloud: { box: [[-14, 0, -8], [14, 7, 8]], build(p, v) { const F = Field();
      for (const [x, y, z, rr] of [[0, 3, 0, 5], [-6, 2.4, 1, 3.8], [6, 2.6, -1, 4], [2, 4.6, 0.5, 3.4], [-3, 4, -1, 3]]) F.add(sdEll(p, [x, y, z], [rr * 1.3, rr * 0.7, rr]), 'cloud', 1.2);
      F.cut(p[1] - 1.2); return F.out(); } },
};
function paintFor(kind, P2) {
  return (p, tag) => {
    const h = noise(p[0] * 0.5 + 9, p[1] * 0.5, p[2] * 0.5);
    switch (tag) {
      case 'leaf': case 'leaf2': { const L = P2.leaf; return [L[Math.floor(h * L.length) % L.length] || L[0], P2.glow && h > 0.85 ? 'Neon' : 'SmoothPlastic']; }
      case 'blossom': return [['#ffb3d1', '#ff9ac4', '#ffd0e2', '#ff86b8'][Math.floor(h * 4)], 'SmoothPlastic'];
      case 'snow': return ['#f6f9ff', 'SmoothPlastic'];
      case 'wood': return [h > 0.7 ? shadeHex(P2.wood, 0.85) : P2.wood, 'SmoothPlastic'];
      case 'wood2': return [shadeHex(P2.wood, 1.12), 'SmoothPlastic'];
      case 'birch': return [noise(p[0] * 2, p[1] * 1.3, p[2] * 2) > 0.8 ? '#2b2b30' : '#f2efe8', 'SmoothPlastic'];
      case 'coco': return ['#6b4426', 'SmoothPlastic'];
      case 'cactus': return [Math.abs(Math.sin(Math.atan2(p[2], p[0]) * 5)) > 0.8 ? '#3e8a3a' : '#52a84a', 'SmoothPlastic'];
      case 'cflower': return ['#ff6bab', 'SmoothPlastic'];
      case 'ember': return [h > 0.6 ? '#ff7a1a' : '#3a2a26', h > 0.6 ? 'Neon' : 'SmoothPlastic'];
      case 'stick': return ['#ffffff', 'SmoothPlastic'];
      case 'swirl': { const a = Math.atan2(p[1] - 11, p[0]), rr = len(p[0], p[1] - 11); return [Math.sin(rr * 2.2 - a * 2) > 0 ? '#ff5fa8' : '#ffffff', 'SmoothPlastic']; }
      case 'crystal': return [P2.leaf[Math.floor(h * P2.leaf.length)], 'Neon'];
      case 'stone': return [h > 0.75 ? shadeHex(P2.stone, 0.85) : h < 0.2 ? shadeHex(P2.stone, 1.12) : P2.stone, 'SmoothPlastic'];
      case 'stem': return ['#f2e6d0', 'SmoothPlastic'];
      case 'cap': return [noise(p[0] * 0.8 + 3, p[1] * 0.8, p[2] * 0.8) > 0.78 ? '#ffffff' : '#e8413a', 'SmoothPlastic'];
      case 'berry': return ['#e8413a', 'SmoothPlastic'];
      case 'cloud': return [p[1] < 2 ? '#e9eef6' : '#ffffff', 'SmoothPlastic'];
      default: return [P2.leaf[0], 'SmoothPlastic'];
    }
  };
}
const cache = new Map();
/** a voxel sculpture as local parts (cached per kind / variant / theme) */
export function sculpt(kind, theme, variant = 0, cube = 1, scale = 1) {
  const key = [kind, theme, variant, cube, scale].join('|'); if (cache.has(key)) return cache.get(key);
  const S = SCULPT[kind] || SCULPT.oak, P2 = palette(theme), v = variant, paint = paintFor(kind, P2);
  if (kind === 'rock' && P2.snow && false) {}
  const f = (p) => { const q = [p[0] / scale, p[1] / scale, p[2] / scale], r = S.build(q, v); return [r[0] * scale, r[1], r[2]]; };
  const min = S.box[0].map((x) => x * scale), max = S.box[1].map((x, i) => (x + (i === 1 ? 2 : 0)) * scale);
  let snowTop = P2.snow && (kind === 'rock' || kind === 'bush');
  const out = voxelizeField(f, (p, bone, A) => { if (snowTop && noise(p[0], p[1] * 3, p[2]) > 0.25 && p[1] > (kind === 'rock' ? 1.4 : 2) * scale) return ['#f6f9ff', 'SmoothPlastic']; return paint([p[0] / scale, p[1] / scale, p[2] / scale], A.tag); }, min, max, cube, {});
  if (cache.size > 200) cache.clear(); cache.set(key, out.parts); return out.parts;
}
/** place a sculpture in the map (quarter-turn rotations keep the cube grid straight) */
export function placeSculpt(name, kind, theme, x, y, z, r, o = {}) {
  const parts = sculpt(kind, theme, o.variant ?? Math.floor(r() * 3), o.cube || FINE[kind] || 1, o.scale || 1), q = Math.floor(r() * 4);
  const rot = ([a, b]) => [[a, b], [-b, a], [-a, -b], [b, -a]][q];
  const kids = parts.map((p) => { const [dx, dz] = rot([p.pos[0], p.pos[2]]), sz = q % 2 ? [p.size[2], p.size[1], p.size[0]] : p.size;
    return P('Part', p.name, sz, [+(x + dx).toFixed(3), +(y + p.pos[1]).toFixed(3), +(z + dz).toFixed(3)], [0, 0, 0], M(p.color, p.material), { vox: p.vox, canCollide: kind !== 'cloud' && kind !== 'flowers' }); });
  return model(name, kids);
}
const FINE = { cactus: 0.5, mushroom: 0.5, bush: 0.5, rock: 0.5, palm: 0.5, crystal: 0.5, candy: 0.5, dead: 0.5 };
const NAMES = { oak: 'Oak', cherry: 'CherryTree', birch: 'Birch', pine: 'Pine', snowpine: 'SnowyPine', palm: 'Palm', cactus: 'Cactus', dead: 'DeadTree', candy: 'Lollipop', crystal: 'Crystal', mushroom: 'Mushroom', rock: 'Rock', bush: 'Bush', cloud: 'Cloud' };

/* ---------- flowers: single cubes on grass tufts (cheap, lots of colour) ---------- */
function flowerPatch(theme, x, y, z, r, n = 9) { const P2 = palette(theme), kids = [];
  for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = r() * 4, fx = Math.round((x + Math.cos(a) * d) * 2) / 2, fz = Math.round((z + Math.sin(a) * d) * 2) / 2, c = pick(r, P2.flower);
    kids.push(block('Stem', [0.5, 1, 0.5], [fx, y + 0.5, fz], M(P2.leaf[1]), { canCollide: false, vox: 0.5 }), block('Petals', [1, 0.5, 1], [fx, y + 1.25, fz], M(c), { canCollide: false, vox: 0.5 }), block('Heart', [0.5, 0.5, 0.5], [fx, y + 1.6, fz], M('#ffd84d'), { canCollide: false, vox: 0.5 })); }
  return model('Flowers', kids); }

/* ---------- cube terrain: hills, cliffs, lakes and beaches around a flat play area ---------- */
export function voxelTerrain(theme, bounds, r, o = {}) {
  const P2 = palette(theme), [x0, z0, x1, z1] = bounds, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, cell = o.cell || 8, step = 4;
  const R = Math.max(x1 - x0, z1 - z0) / 2 + (o.ring || 150), n = Math.ceil((2 * R) / cell), gx0 = cx - (n * cell) / 2, gz0 = cz - (n * cell) / 2;
  const seed = r() * 100, H = new Int8Array(n * n), at = (i, j) => i + n * j;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = gx0 + (i + 0.5) * cell, z = gz0 + (j + 0.5) * cell;
    const dPlay = Math.max(Math.max(x0 - 24 - x, x - x1 - 24, 0), Math.max(z0 - 24 - z, z - z1 - 24, 0)); // 0 inside the play area (+24 margin)
    const rim = len(x - cx, z - cz) / R;
    let h = 0;
    if (dPlay > 0) { const hill = vnoise2(x / 70 + seed, z / 70) * 0.7 + vnoise2(x / 28 + seed * 2, z / 28) * 0.3, ramp = Math.min(1, dPlay / 60);
      h = Math.round((hill * 7 - 1.8) * ramp + Math.max(0, rim - 0.78) * 14); }   // rolling hills, lakes in the hollows, mountains at the edge
    if (rim > 0.98) h = -3;                                                    // sea all around
    H[at(i, j)] = Math.max(-3, Math.min(9, h));
  }
  // greedy 2D merge of equal-height cells → a few hundred columns
  const used = new Uint8Array(n * n), cols = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { if (used[at(i, j)]) continue; const h = H[at(i, j)];
    let w = 1; while (i + w < n && !used[at(i + w, j)] && H[at(i + w, j)] === h) w++;
    let d = 1; grow: while (j + d < n) { for (let k = 0; k < w; k++) if (used[at(i + k, j + d)] || H[at(i + k, j + d)] !== h) break grow; d++; }
    for (let jj = 0; jj < d; jj++) for (let k = 0; k < w; k++) used[at(i + k, j + jj)] = 1; cols.push({ i, j, w, d, h }); }
  const kids = [], lakes = [], base = -0.5; // level 0 = the play area floor
  for (const c of cols) { const sx = c.w * cell, sz = c.d * cell, x = gx0 + (c.i + c.w / 2) * cell, z = gz0 + (c.j + c.d / 2) * cell;
    if (c.h <= 0) { // lake bed / sea floor / beach at level 0
      const top = base + c.h * step; kids.push(block(c.h === 0 ? 'Ground' : 'LakeBed', [sx, 2, sz], [x, top - 1, z], M(c.h === 0 ? pick(r, P2.grass) : P2.sand), { vox: 2 }));
      if (c.h < 0) lakes.push([x, z, sx, sz]); continue; }
    const top = base + c.h * step, g = P2.grass[(c.i * 7 + c.j * 3) % P2.grass.length];
    kids.push(block('Grass', [sx, 2, sz], [x, top - 1, z], M(g), { vox: 2 }));
    kids.push(block('Dirt', [sx, step * c.h - 2 + 2, sz], [x, base + (step * c.h - 2) / 2 - 1, z], M(c.h > 4 ? P2.stone : P2.dirt), { vox: 2 })); }
  if (lakes.length) kids.push(block('Water', [2 * R, 1, 2 * R], [cx, base - 1.6, cz], M(P2.water, P2.lavaWater ? 'Neon' : 'Glass'), { transparency: P2.lavaWater ? 0 : 0.3, canCollide: false }));
  const heightAt = (x, z) => { const i = Math.floor((x - gx0) / cell), j = Math.floor((z - gz0) / cell); if (i < 0 || j < 0 || i >= n || j >= n) return null; return base + H[at(i, j)] * step; };
  return { model: model('Terrain', kids), heightAt, R, lakesCount: lakes.length };
}

/* ---------- the whole voxel dressing of a map ---------- */
export function voxelScenery(theme, bounds, r, density = 1, extras = []) {
  const out = [], [x0, z0, x1, z1] = bounds, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const terr = voxelTerrain(theme, bounds, r, { ring: 140 + 40 * density }); out.push(terr.model);
  const kinds = TREE_KINDS[theme] || TREE_KINDS.plaine, placed = [], R = terr.R;
  const free = (x, z, gap) => !(x > x0 - 26 && x < x1 + 26 && z > z0 - 26 && z < z1 + 26) && !placed.some(([px, pz]) => len(px - x, pz - z) < gap);
  const put = (kind, x, z, gap, name, o = {}) => { const y = terr.heightAt(x, z); if (y == null || y < -2 || !free(x, z, gap)) return false; placed.push([x, z]); out.push(kind === 'flowers' ? flowerPatch(theme, x, y, z, r) : placeSculpt(name || NAMES[kind], kind, theme, x, y, z, r, o)); return true; };
  // groves: clusters of the same tree, with bushes and flowers at their feet
  const groves = Math.round(7 * density);
  for (let g = 0; g < groves; g++) { const a = r() * Math.PI * 2, d = R * (0.35 + r() * 0.45), gx = cx + Math.cos(a) * d, gz = cz + Math.sin(a) * d, kind = pick(r, kinds);
    for (let k = 0, got = 0; k < 30 && got < 3 + Math.floor(r() * 5); k++) { const aa = r() * Math.PI * 2, dd = 4 + r() * 22; if (put(kind, gx + Math.cos(aa) * dd, gz + Math.sin(aa) * dd, 9, null, { scale: 0.85 + r() * 0.4 })) got++; }
    for (let k = 0; k < 4; k++) { const aa = r() * Math.PI * 2, dd = 6 + r() * 20; put(r() < 0.5 ? 'bush' : 'flowers', gx + Math.cos(aa) * dd, gz + Math.sin(aa) * dd, 5, null, { variant: r() < 0.4 ? 1 : 0 }); } }
  // rocks, mushrooms, single trees, flower beds near the play area
  for (let k = 0; k < Math.round(45 * density); k++) { const a = r() * Math.PI * 2, d = R * (0.2 + r() * 0.7), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    put(pick(r, ['rock', 'rock', 'bush', 'flowers', 'flowers', ...kinds, theme === 'plaine' || theme === 'bonbon' ? 'mushroom' : 'rock']), x, z, 7, null, { scale: 0.7 + r() * 0.6 }); }
  for (const e of extras) { const a = r() * Math.PI * 2, d = R * 0.6, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (EXTRA_SCULPT[e]) put(EXTRA_SCULPT[e], x, z, 20, null, { scale: 2.2 }); }
  for (let k = 0; k < Math.round(10 * density); k++) out.push(placeSculpt('Cloud', 'cloud', theme, cx + (r() - 0.5) * R * 2, 80 + r() * 50, cz + (r() - 0.5) * R * 2, r, { cube: 2, scale: 1 + r() * 0.8 }));
  return out;
}
const EXTRA_SCULPT = { volcano: 'rock', temple: 'rock', castle: 'rock' }; // big landmarks stay the detailed models (added by the caller)

/** tag the blocks of gameplay / buildings so they show the little-cube look too (shape and size unchanged) */
export function voxelTag(nodes, cube = 1) {
  const walk = (n) => { if (n.children) n.children.forEach(walk); else if (n.cls === 'Part' && (!n.shape || n.shape === 'Block') && !n.vox && (n.material === 'SmoothPlastic' || n.material === 'Plastic' || n.material === 'Grass' || n.material === 'WoodPlanks' || n.material === 'Wood' || n.material === 'Brick' || n.material === 'Cobblestone' || n.material === 'Slate' || n.material === 'Sand' || n.material === 'Snow' || n.material === 'Ground')) {
    const big = Math.max(...n.size); n.vox = big > 40 ? 2 : big > 8 ? 1 : 0.5; n.material = 'SmoothPlastic'; } };
  nodes.forEach(walk); return nodes;
}
export { mixc };
