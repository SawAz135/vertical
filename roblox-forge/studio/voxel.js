/* =====================================================================
   Roblox Forge - voxel pets (the "realistic voxel" style).
   1. Anatomy: each animal is a smooth signed-distance volume (torso, chest,
      neck, head with muzzle and jaw, jointed legs, curved tail, ears…)
      with a colour function (back, belly, muzzle, nose, eyes, stripes…).
   2. Voxelise on a grid (≈ 36 voxels nose to tail).
   3. Greedy merge: neighbouring voxels of the same colour and bone become one
      block, so a pet is a few hundred real Roblox parts, still pixel-sharp.
   Any part-based pet can also be voxelised (voxelizeParts).
   ===================================================================== */
const r3 = (v) => +v.toFixed(3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mixc = (a, b, t) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), c = (s) => [(s >> 16) & 255, (s >> 8) & 255, s & 255], p = c(x), q = c(y);
  return '#' + p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

/* ---------- signed distance helpers ---------- */
const len = (x, y, z) => Math.hypot(x, y, z);
function sdEll(p, c, r) { const x = (p[0] - c[0]) / r[0], y = (p[1] - c[1]) / r[1], z = (p[2] - c[2]) / r[2], k0 = len(x, y, z), k1 = len(x / r[0], y / r[1], z / r[2]); return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(...r); }
function sdCone(p, a, b, ra, rb) { // round cone (capsule with two radii)
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2], pax = p[0] - a[0], pay = p[1] - a[1], paz = p[2] - a[2], l2 = bax * bax + bay * bay + baz * baz;
  const h = clamp((pax * bax + pay * bay + paz * baz) / l2, 0, 1); return len(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h); }
const smin = (a, b, k) => { const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); };
const bez = (p0, p1, p2, t) => [0, 1, 2].map((i) => (1 - t) * (1 - t) * p0[i] + 2 * (1 - t) * t * p1[i] + t * t * p2[i]);

/* ---------- species anatomy (studs; front = -Z, up = +Y) ----------
   Each species is a set of proportions plus "features": muzzle shape (canine, feline, equine, bovine, pig,
   trunk), feet (paw with toes and claws, hoof, pad), ears, tail, fur tufts, manes and colour patterns.
   A "morph" (elephant, giraffe, horse…) is a ready-made set of features any species can borrow, so the
   lexicon can say « zèbre = horse morph + zebra stripes » without a new rig. */
const SP = (o) => ({ head: 1, neckLen: 0, paw: 'paw', claws: true, muzzle: 'canine', ridge: 0, ruff: 0, ...o });
export const VOX_SPECIES = {
  loup: SP({ fr: 'Loup', body: 0.88, legs: 1.05, neckDrop: 0.3, snout: 1.2, head: 1.15, bellyHi: 1.45, sockHi: 0.85, ears: 'pointy', tail: 'bushy', ridge: 1, ruff: 1,
    cols: { back: '#6c717a', saddle: '#555a63', side: '#80858e', belly: '#f4f4f4', muzzle: '#f4f4f4', dark: '#373b43', nose: '#141418', eye: '#4fa8ff', socks: '#f4f4f4' }, mask: true, snarl: true, brows: true, irisRing: true, tongue: true }),
  tigre: SP({ fr: 'Tigre', body: 1.0, legs: 0.98, pawsOnly: true, neckDrop: 0.12, snout: 0.85, muzzle: 'feline', ears: 'round', tail: 'long', ruff: 0.6, head: 1.22, bellyHi: 1.22,
    cols: { back: '#f2861b', side: '#f79d34', belly: '#fbfaf5', muzzle: '#fbfaf5', dark: '#1d1715', nose: '#e8a090', eye: '#f2c94c', socks: '#fbfaf5' }, stripes: true }),
  renard: SP({ fr: 'Renard', body: 0.85, legs: 0.9, neckDrop: 0.0, snout: 1.35, ears: 'big', tail: 'bushy', ruff: 0.8, ridge: 0.4,
    cols: { back: '#e2591a', side: '#ef7a30', belly: '#fbf6ef', muzzle: '#fbf6ef', dark: '#2a1f1d', nose: '#141418', eye: '#c98a1a', socks: '#2a1f1d' }, tailTip: '#fbf6ef', mask: true }),
  chat: SP({ fr: 'Chat', body: 0.75, legs: 0.85, neckDrop: -0.05, snout: 0.62, muzzle: 'feline', ears: 'pointy', tail: 'long', claws: false, head: 1.08,
    cols: { back: '#f2a14a', side: '#f6b46a', belly: '#fff3e3', muzzle: '#fff3e3', dark: '#b8642a', nose: '#ff8fa3', eye: '#7ad36b', socks: '#fff3e3' }, stripes: 'soft' }),
  chien: SP({ fr: 'Chien', body: 0.95, legs: 0.95, neckDrop: -0.05, snout: 1.05, ears: 'floppy', tail: 'up', claws: false, head: 1.05,
    cols: { back: '#c4813f', side: '#d6995a', belly: '#f7ead8', muzzle: '#f7ead8', dark: '#5b3a1f', nose: '#141418', eye: '#4a2c14', socks: '#f7ead8' }, tongue: true }),
  ours: SP({ fr: 'Ours', body: 1.3, legs: 0.9, neckDrop: 0.1, snout: 0.9, ears: 'round', tail: 'stub', ridge: 0.5, head: 1.08,
    cols: { back: '#6b4a2f', side: '#7d5838', belly: '#8f6a48', muzzle: '#c9a27a', dark: '#2a1d14', nose: '#141418', eye: '#1b1310', socks: '#5b3d26' }, hump: true }),
  lion: SP({ fr: 'Lion', body: 1.1, legs: 1.0, neckDrop: 0.0, snout: 0.92, muzzle: 'feline', ears: 'round', tail: 'tuft',
    cols: { back: '#e0a24a', side: '#e8b25e', belly: '#f6e0b5', muzzle: '#f6e0b5', dark: '#7a3f12', nose: '#6b3a2a', eye: '#f2c94c', socks: '#e0a24a' }, mane: '#9a4f1a' }),
  panda: SP({ fr: 'Panda', body: 1.15, legs: 0.85, neckDrop: 0.05, snout: 0.7, ears: 'round', tail: 'stub', claws: false, head: 1.15,
    cols: { back: '#f6f6f6', side: '#f6f6f6', belly: '#f6f6f6', muzzle: '#f6f6f6', dark: '#1b1b20', nose: '#141418', eye: '#141418', socks: '#1b1b20' }, panda: true }),
  cerf: SP({ fr: 'Cerf', body: 0.95, legs: 1.35, neckDrop: -0.35, snout: 1.1, muzzle: 'equine', ears: 'leaf', tail: 'stub', paw: 'hoof', sideEyes: true,
    cols: { back: '#a8703f', side: '#b98250', belly: '#f4e6d2', muzzle: '#f4e6d2', dark: '#3b2716', nose: '#141418', eye: '#2a1a10', socks: '#8a5a33', hoof: '#2b2420' }, antlers: '#e8dcc2', spots: true }),
  licorne: SP({ fr: 'Licorne', body: 1.0, legs: 1.35, neckDrop: -0.45, snout: 1.25, muzzle: 'equine', ears: 'leaf', tail: 'horse', paw: 'hoof', sideEyes: true, horseMane: true,
    cols: { back: '#fbf7ff', side: '#f4ecff', belly: '#ffffff', muzzle: '#ffffff', dark: '#d9c9f0', nose: '#ffb3d1', eye: '#7c5cff', socks: '#e9dcff', hoof: '#ffd45c', mane: '#ff9ad5' }, horn: '#ffd45c', rainbow: true }),
  vache: SP({ fr: 'Vache', body: 1.25, legs: 0.95, neckDrop: 0.2, snout: 0.8, muzzle: 'bovine', ears: 'side', tail: 'tuft', paw: 'hoof', sideEyes: true, head: 1.05,
    cols: { back: '#f6f3ec', side: '#f6f3ec', belly: '#f6f3ec', muzzle: '#f2b3b3', dark: '#2b2523', nose: '#e08f95', eye: '#1b1310', socks: '#f6f3ec', hoof: '#3a302c' }, cowSpots: '#2b2523', hornsSmall: '#f1e6c8', udder: true }),
  cochon: SP({ fr: 'Cochon', body: 1.1, legs: 0.7, neckDrop: 0.3, snout: 0.45, muzzle: 'pig', ears: 'pig', tail: 'curl', paw: 'hoof', head: 1.05,
    cols: { back: '#f59fb3', side: '#f7aec0', belly: '#fac2cf', muzzle: '#f28aa3', dark: '#c9677f', nose: '#f28aa3', eye: '#1b1310', socks: '#f59fb3', hoof: '#b85a70' }, pigNose: true }),
  mouton: SP({ fr: 'Mouton', body: 1.15, legs: 0.8, neckDrop: 0.25, snout: 0.75, muzzle: 'equine', ears: 'side', tail: 'stub', paw: 'hoof', sideEyes: true,
    cols: { back: '#f7f5f0', side: '#efece5', belly: '#e9e5dc', muzzle: '#3b3432', dark: '#2e2827', nose: '#1c1716', eye: '#1b1310', socks: '#3b3432', hoof: '#1c1716' }, wool: true }),
  dragon: SP({ fr: 'Dragon', body: 1.15, legs: 0.95, neckDrop: -0.3, snout: 1.45, ears: 'horns', tail: 'dragon', ridge: 0,
    cols: { back: '#2f9e57', side: '#3fb36b', belly: '#e8f2b0', muzzle: '#3fb36b', dark: '#1d5c33', nose: '#1d1d1d', eye: '#ff5a1f', socks: '#2f9e57' }, wings: true, spikes: '#f2e6c9', scales: true, brows: true }),
};
/* morphs: body plans the lexicon can put on any species (flags: { morph: 'elephant' }) */
export const VOX_MORPHS = {
  elephant: { body: 1.3, legs: 1.0, neckDrop: 0.45, snout: 0.35, head: 1.3, muzzle: 'trunk', ears: 'elephant', tail: 'tuft', paw: 'pad', claws: false, ridge: 0, ruff: 0, sideEyes: true, tusks: '#f4eedd',
    stripes: false, mane: null, spots: false, cowSpots: null, hump: false, pigNose: false, wool: false, panda: false, mask: false, snarl: false, udder: false, hornsSmall: null, horn: null, antlers: null,
    cols: { back: '#8e939c', side: '#9ca1aa', belly: '#b3b7be', muzzle: '#9ca1aa', dark: '#5d626b', nose: '#7d828b', eye: '#1b1310', socks: '#8e939c' } },
  girafe: { body: 0.95, legs: 1.5, neckDrop: -0.3, neckLen: 1.5, snout: 1.05, muzzle: 'equine', ears: 'leaf', tail: 'tuft', paw: 'hoof', claws: false, ridge: 0, ruff: 0, sideEyes: true, ossicones: true, giraffe: true, shortMane: true,
    stripes: false, spots: false, antlers: null, horn: null, cols: { back: '#e8b84a', side: '#efc560', belly: '#f6e8c0', muzzle: '#f6e8c0', dark: '#7a4a1e', nose: '#4a3020', eye: '#1b1310', socks: '#f6e8c0', hoof: '#3a2a1e', patch: '#b8681e', mane: '#7a4a1e' } },
  cheval: { body: 1.05, legs: 1.38, neckDrop: -0.45, snout: 1.3, muzzle: 'equine', ears: 'leaf', tail: 'horse', paw: 'hoof', claws: false, sideEyes: true, horseMane: true, horn: null, rainbow: false,
    cols: { back: '#8a5a33', side: '#9a6a40', belly: '#b07c4c', muzzle: '#6b4426', dark: '#2b1d14', nose: '#2b1d14', eye: '#1b1310', socks: '#f2e6d4', hoof: '#2b2420', mane: '#2b1d14' } },
  lapin: { body: 0.72, legs: 0.62, neckDrop: 0.15, snout: 0.5, head: 1.15, muzzle: 'feline', ears: 'bunny', tail: 'cotton', claws: false, ridge: 0, ruff: 0.4, stripes: false, hop: true,
    cols: { back: '#e9e4dc', side: '#e1dbd1', belly: '#ffffff', muzzle: '#ffffff', dark: '#9a8f82', nose: '#ff8fa3', eye: '#2b1d14', socks: '#ffffff' } },
  souris: { body: 0.7, legs: 0.55, neckDrop: 0.2, snout: 0.85, head: 1.1, ears: 'mouse', tail: 'long', claws: false, ridge: 0, ruff: 0, stripes: false,
    cols: { back: '#a8a29a', side: '#b8b2aa', belly: '#efe9e0', muzzle: '#efe9e0', dark: '#6a645c', nose: '#ff8fa3', eye: '#141418', socks: '#efc9c9' } },
  singe: { body: 0.9, legs: 1.0, neckDrop: -0.1, snout: 0.6, head: 1.15, muzzle: 'feline', ears: 'round', tail: 'long', claws: false, ridge: 0, ruff: 0.5, face: true,
    cols: { back: '#6b4a33', side: '#7a5640', belly: '#c9a07a', muzzle: '#e6c3a0', dark: '#3a2618', nose: '#4a3022', eye: '#2b1d14', socks: '#6b4a33' } },
};

/* ---------- small SDF extras ---------- */
function sdCylZ(p, c, r, h) { const dx = Math.hypot(p[0] - c[0], p[1] - c[1]) - r, dz = Math.abs(p[2] - c[2]) - h; return Math.min(Math.max(dx, dz), 0) + Math.hypot(Math.max(dx, 0), Math.max(dz, 0)); }
function sdCylY(p, c, r, h) { const dx = Math.hypot(p[0] - c[0], p[2] - c[2]) - r, dy = Math.abs(p[1] - c[1]) - h; return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)); }
const hash2 = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, z) { // smooth value noise for organic patches (cow, giraffe)
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi, u = (t) => t * t * (3 - 2 * t);
  const n = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const l = (a, b, t) => a + (b - a) * t, X = u(fx), Y = u(fy), Z = u(fz);
  return l(l(l(n(xi, yi, zi), n(xi + 1, yi, zi), X), l(n(xi, yi + 1, zi), n(xi + 1, yi + 1, zi), X), Y), l(l(n(xi, yi, zi + 1), n(xi + 1, yi, zi + 1), X), l(n(xi, yi + 1, zi + 1), n(xi + 1, yi + 1, zi + 1), X), Y), Z); }
function voronoi(x, y, z) { // [nearest, second] distances to jittered cell points (giraffe patches, leopard rosettes)
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let d1 = 9, d2 = 9;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const X = xi + a, Y = yi + b, Z = zi + c;
    const px = X + hash2(X * 7 + Z, Y) * 0.8 + 0.1, py = Y + hash2(Y * 13 + X, Z) * 0.8 + 0.1, pz = Z + hash2(Z * 5 + Y, X) * 0.8 + 0.1, d = Math.hypot(x - px, y - py, z - pz);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return [d1, d2]; }

/* ---------- anatomy SDF, with a bone + a surface tag per voxel ---------- */
/* rounded boxes: the chunky "voxel figure" look of the references (boxy torso, block head, block muzzle, pillar legs, flat paws) */
function sdRBox(p, c, h, r) { const qx = Math.abs(p[0] - c[0]) - h[0] + r, qy = Math.abs(p[1] - c[1]) - h[1] + r, qz = Math.abs(p[2] - c[2]) - h[2] + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r; }
function sdRBoxX(p, c, h, r, a) { const dy = p[1] - c[1], dz = p[2] - c[2], co = Math.cos(a), si = Math.sin(a); return sdRBox([p[0], dy * co + dz * si, -dy * si + dz * co], [c[0], 0, 0], h, r); }
/* a box "beam" between two points (stepped neck, thighs), as a few boxes for a crisp voxel silhouette */
function sdBeam(p, a, b, ha, hb, r, n = 4) { let d = 1e9; for (let i = 0; i <= n; i++) { const t = i / n, c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], h = [ha[0] + (hb[0] - ha[0]) * t, ha[1] + (hb[1] - ha[1]) * t, ha[2] + (hb[2] - ha[2]) * t]; d = Math.min(d, sdRBox(p, c, h, r)); } return d; }

function anatomy(sp, k) {
  const L = sp.legs, B = sp.body, s = (v) => v * k, hs = sp.head || 1, nl = sp.neckLen || 0, W = sp.wide || 1;
  const hoof = sp.paw === 'hoof', pad = sp.paw === 'pad';
  const chest = [0, s(1.42 * L), s(-0.55 * B)], hip = [0, s(1.36 * L), s(0.62 * B)];
  const headC = [0, s((1.98 - sp.neckDrop) * L + 0.1 + nl), s(-1.42 * B - 0.25 - nl * 0.28)];
  const HB = sp.muzzle === 'equine' ? [s(0.36 * hs), s(0.4 * hs), s(0.42 * hs)] : [s(0.5 * hs * W), s(0.44 * hs), s(0.47 * hs)]; // cranium half-size
  const mz = sp.muzzle, snLen = s(0.56 * sp.snout * hs), front = headC[2] - HB[2];
  const MH = { canine: [0.23, 0.17], feline: [0.24, 0.16], equine: [0.29, 0.24], bovine: [0.4, 0.27], pig: [0.3, 0.26], trunk: [0.26, 0.24] }[mz] || [0.27, 0.19]; // muzzle half w/h
  const muzC = [0, headC[1] - s((mz === 'equine' ? 0.2 : mz === 'bovine' ? 0.16 : 0.14) * hs), front - snLen / 2 + s(0.12)];
  const snoutTip = [0, muzC[1], front - snLen + s(0.08)];
  const eyeC = sp.sideEyes ? [s(0.38 * hs), headC[1] + s(0.13 * hs), headC[2] - s(0.2 * hs)] : [s(0.25 * hs * W), headC[1] + s(0.1 * hs), front - s(0.01)];
  const legs = [['LegFL', -1, -0.7], ['LegFR', 1, -0.7], ['LegBL', -1, 0.72], ['LegBR', 1, 0.72]].map(([n, sx, fz]) => { const back = fz > 0;
    const w = s((hoof ? 0.13 : pad ? 0.24 : 0.17) * B * W * (sp.hop && back ? 1.3 : 1)), x = s(0.31 * sx * B * W), z = s(fz * B);
    return { n, sx, x, z, w, back }; });
  const tailBase = [0, s(1.62 * L), s(1.12 * B)];
  const tailEnd = { bushy: [0, s(0.85 * L), s(1.95 * B)], long: [0, s(1.25 * L), s(2.45 * B)], up: [0, s(2.45 * L), s(1.75 * B)], stub: [0, s(1.55 * L), s(1.5 * B)], tuft: [0, s(0.95 * L), s(2.2 * B)],
    mane: [0, s(0.75 * L), s(2.2 * B)], horse: [0, s(0.55 * L), s(1.75 * B)], dragon: [s(0.6), s(0.9 * L), s(2.95 * B)], curl: [0, s(1.55 * L), s(1.4 * B)], cotton: [0, s(1.45 * L), s(1.3 * B)] }[sp.tail] || [0, s(1.55 * L), s(1.55 * B)];
  const tailMid = [tailEnd[0] * 0.4, (tailBase[1] + tailEnd[1]) / 2 + s(sp.tail === 'up' ? 0.2 : sp.tail === 'horse' ? 0.35 : 0.25), (tailBase[2] + tailEnd[2]) / 2 + s(sp.tail === 'horse' ? 0.0 : 0.2)];
  const neckTop0 = [0, headC[1] + s(0.36 * hs), headC[2] + s(0.36 * hs)], neckTop1 = [0, chest[1] + s(0.5 * B), chest[2] + s(0.25 * B)];
  const ears = [-1, 1].map((sx) => [s((sp.ears === 'pointy' || sp.ears === 'big' ? 0.3 : 0.26) * sx * hs * W), headC[1] + s(0.38 * hs), headC[2] + s(0.1 * hs)]);
  const trunk = mz === 'trunk' ? [[0, headC[1] - s(0.12 * hs), front - s(0.02)], [0, headC[1] - s(0.7 * hs), front - s(0.4 * hs)], [0, s(0.55 * L), front - s(0.2 * hs)]] : null;
  const bellyLow = s(1.0 * L); // underside of the torso
  return function evalAt(p) {
    let tag = '', bone = 'Body';
    // ----- torso: deep chest block + lighter rear block, stepped together
    let d = smin(sdRBox(p, [0, chest[1] + s(sp.hump ? 0.1 : 0.04), chest[2]], [s(0.5 * B * W), s(0.48 * B), s(0.6 * B)], s(0.3 * B)), sdRBox(p, hip, [s(0.44 * B * W), s(0.42 * B), s(0.56 * B)], s(0.28 * B)), s(0.25));
    if (sp.ruff >= 1 || sp.mask) d = smin(d, sdRBox(p, [0, chest[1] - s(0.12), chest[2] - s(0.42 * B)], [s(0.46 * B * W), s(0.5 * B), s(0.3 * B)], s(0.12)), s(0.1)); // fluffy chest
    if (sp.hump) d = smin(d, sdRBox(p, [0, chest[1] + s(0.5 * B), chest[2] + s(0.1)], [s(0.32 * B), s(0.2 * B), s(0.36 * B)], s(0.12)), s(0.15));
    if (sp.wool) d -= s(0.06) * (0.5 + 0.5 * Math.sign(Math.sin(p[0] / s(0.16)) * Math.sin(p[1] / s(0.16)) * Math.sin(p[2] / s(0.16))));
    if (sp.udder) { const u = sdRBox(p, [0, hip[1] - s(0.48 * B), hip[2] - s(0.2)], [s(0.2), s(0.12), s(0.22)], s(0.06)); if (u < d) tag = 'udder'; d = Math.min(d, u); }
    // ----- neck: stepped boxes from the shoulders to the back of the head
    const nk = sdBeam(p, [0, chest[1] + s(0.12), chest[2] - s(0.25 * B)], [0, headC[1] - s(0.06), headC[2] + s(0.18 * hs)], [s(0.36 * B * W), s(0.42 * B), s(0.32 * B)], [s(0.32 * hs * W * (nl ? 0.75 : 1)), s(0.34 * hs), s(0.3 * hs)], s(0.1), nl ? 7 : 3);
    d = smin(d, nk, s(0.12));
    // ----- head: cranium block, muzzle block, jaw, cheeks, nose
    let head = sdRBox(p, headC, HB, s(0.2 * hs)), htag = '';
    if (mz === 'pig') { head = smin(head, sdRBox(p, muzC, [s(MH[0] * hs), s(MH[1] * hs), snLen / 2 + s(0.05)], s(0.06)), s(0.06)); const disc = sdCylZ(p, [0, snoutTip[1], snoutTip[2] - s(0.04)], s(0.25 * hs), s(0.07)); if (disc < head) htag = 'disc'; head = Math.min(head, disc); }
    else if (mz === 'trunk') { let td = 1e9; for (let i = 0; i < 7; i++) { const a = bez(...trunk, i / 7), b = bez(...trunk, (i + 1) / 7); td = Math.min(td, sdRBox(p, a, [s((0.24 - i * 0.022) * hs), s(0.12 * hs), s((0.24 - i * 0.022) * hs)], s(0.06)), sdCone(p, a, b, s((0.22 - i * 0.022) * hs), s((0.22 - (i + 1) * 0.022) * hs))); }
      if (td < head) htag = 'trunk'; head = smin(head, td, s(0.08)); }
    else {
      head = smin(head, sdRBox(p, muzC, [s(MH[0] * hs), s(MH[1] * hs), snLen / 2], s(0.06)), s(0.05));
      if (mz === 'canine' || mz === 'feline') { // lower jaw (opened a little for snarling species)
        const jy = muzC[1] - s(MH[1] * hs) - s((sp.snarl ? 0.1 : 0.04) * hs), jaw = sdRBox(p, [0, jy, muzC[2] + s(0.06)], [s((MH[0] - 0.05) * hs), s(0.07 * hs), snLen / 2 - s(0.04)], s(0.04));
        if (sp.snarl) { const gum = sdRBox(p, [0, (jy + muzC[1] - s(MH[1] * hs)) / 2, snoutTip[2] + s(0.1) + snLen * 0.25], [s((MH[0] - 0.1) * hs), s(0.06 * hs), snLen * 0.24], s(0.02)); if (gum < head) htag = 'gum'; head = Math.min(head, gum); }
        head = smin(head, jaw, s(0.03)); }
      if (mz === 'feline') for (const sx of [-1, 1]) head = smin(head, sdRBox(p, [s(0.14 * sx * hs), muzC[1] - s(0.04), snoutTip[2] + s(0.14)], [s(0.13 * hs), s(0.13 * hs), s(0.12 * hs)], s(0.05)), s(0.04)); // whisker pads
      const nose = sdRBox(p, [0, muzC[1] + s((mz === 'equine' || mz === 'bovine' ? 0.02 : MH[1] - 0.06) * hs), snoutTip[2] - s(0.02)], [s((mz === 'bovine' ? 0.24 : mz === 'equine' ? 0.2 : mz === 'feline' ? 0.1 : 0.13) * hs), s((mz === 'feline' ? 0.06 : 0.08) * hs), s(0.07 * hs)], s(0.02));
      if (nose < head + s(0.01)) htag = 'nose'; head = Math.min(head, nose); }
    if (sp.brows) for (const sx of [-1, 1]) head = smin(head, sdRBox(p, [eyeC[0] * sx, eyeC[1] + s(0.13 * hs), front + s(0.02)], [s(0.12 * hs), s(0.05 * hs), s(0.06 * hs)], s(0.02)), s(0.02));
    if (sp.ruff) for (const sx of [-1, 1]) for (const [dy, l2] of [[0.02, 1], [-0.18, 0.9], [0.2, 0.6]]) { // cheek fur blocks, stepping back and out
      const c0 = [s((0.46 + 0.1 * l2 * sp.ruff) * sx * hs * W), headC[1] - s((0.14 - dy) * hs), headC[2] + s(0.1 + 0.12 * l2 * sp.ruff)];
      head = smin(head, sdRBox(p, c0, [s(0.12 * hs), s(0.1 * hs), s(0.2 * l2 * hs)], s(0.03)), s(0.03)); }
    if (sp.tusks) for (const sx of [-1, 1]) { const t = Math.min(sdCone(p, [s(0.2 * sx * hs), headC[1] - s(0.3 * hs), front - s(0.05)], [s(0.25 * sx * hs), headC[1] - s(0.62 * hs), front - s(0.4 * hs)], s(0.08 * hs), s(0.05 * hs)),
      sdCone(p, [s(0.25 * sx * hs), headC[1] - s(0.62 * hs), front - s(0.4 * hs)], [s(0.22 * sx * hs), headC[1] - s(0.5 * hs), front - s(0.62 * hs)], s(0.05 * hs), s(0.02))); if (t < head) htag = 'tusk'; head = Math.min(head, t); }
    if (sp.snarl) for (const sx of [-1, 1]) for (const [tz, ty] of [[0.02, -1], [0.02, 1]]) { // upper and lower fangs
      const by = muzC[1] - s(MH[1] * hs) - s(0.05 * hs), f = sdRBox(p, [s(0.15 * sx * hs), by + ty * s(0.0) - (ty > 0 ? 0 : s(0.0)), snoutTip[2] + s(tz + (ty > 0 ? 0.04 : 0.14))], [s(0.035), s(0.07), s(0.035)], s(0.005));
      if (f < head) htag = 'tooth'; head = Math.min(head, f); }
    if (sp.tongue) { const t = sdRBox(p, [s(0.06), muzC[1] - s(0.3 * hs), snoutTip[2] + s(0.14)], [s(0.07), s(0.11), s(0.05)], s(0.03)); if (t < head) htag = 'tongue'; head = Math.min(head, t); }
    if (head < d + s(0.04)) { bone = 'Head'; tag = htag; } d = smin(d, head, s(0.06));
    // ----- legs: pillar + flat paw with claws (or hoof / elephant pad)
    for (const g of legs) {
      let l, ltag = ''; const topY = s(1.3 * L);
      if (g.back && !pad) { // haunch + shin + hock (bent back leg)
        const knee = [g.x, s(0.62 * L), g.z + s(0.3 * B)];
        l = Math.min(sdBeam(p, [g.x * 1.04, hip[1] - s(0.08), hip[2] - s(0.02)], knee, [g.w * 1.25, s(0.28 * B), s(0.3 * B)], [g.w * 0.95, g.w * 0.9, g.w * 1.0], s(0.06), 3),
          sdBeam(p, knee, [g.x, s(0.22), g.z + s(0.16 * B)], [g.w * 0.9, g.w * 0.9, g.w * 0.95], [g.w * 0.8, g.w * 0.8, g.w * 0.85], s(0.05), 3)); }
      else l = sdRBox(p, [g.x, (topY + s(0.2)) / 2, g.z], [g.w, (topY - s(0.2)) / 2, g.w * 1.1], s(0.06));
      const fz = g.z + (g.back && !pad ? s(0.12 * B) : 0);
      if (pad) { l = Math.min(l, sdCylY(p, [g.x, s(0.13), fz], g.w * 1.12, s(0.13)));
        for (const cx of [-0.55, 0, 0.55]) { const nail = sdRBox(p, [g.x + g.w * cx, s(0.08), fz - g.w * 1.08], [s(0.06), s(0.06), s(0.03)], s(0.01)); if (nail < l) ltag = 'nail'; l = Math.min(l, nail); } }
      else if (hoof) { const h = sdRBox(p, [g.x, s(0.12), fz - s(0.01)], [g.w * 1.12, s(0.12), g.w * 1.2], s(0.03)); if (h < l) ltag = 'hoof'; l = Math.min(l, h);
        l = smin(l, sdRBox(p, [g.x, s(0.32), fz], [g.w * 1.15, s(0.08), g.w * 1.15], s(0.04)), s(0.03)); } // fetlock
      else { const pw = g.w * 1.28, pl = g.w * 1.65, pc = [g.x, s(0.1), fz - g.w * 0.5];
        l = smin(l, sdRBox(p, pc, [pw, s(0.1), pl], s(0.04)), s(0.04));
        if (sp.claws !== false) for (const cx of [-0.68, -0.23, 0.23, 0.68]) { const cl = sdRBox(p, [g.x + pw * cx, s(0.05), pc[2] - pl - s(0.03)], [s(0.035), s(0.05), s(0.05)], s(0.005)); if (cl < l) ltag = 'claw'; l = Math.min(l, cl); }
        else for (const cx of [-0.6, 0, 0.6]) l = Math.max(l, -sdRBox(p, [g.x + pw * cx * 0.95 + pw * 0.3 * Math.sign(cx || 1) * 0, s(0.14), pc[2] - pl], [s(0.012), s(0.06), s(0.08)], 0)); } // toe grooves
      if (l < d && p[1] < s(1.12 * L)) { bone = g.n; tag = ltag; } else if (l < d && ltag) tag = ltag;
      d = smin(d, l, s(0.08)); }
    // ----- tail
    { const tt = sp.tail, tr = tt === 'bushy' ? (t) => s((0.17 + Math.sin(t * Math.PI * 0.85) * 0.3) * (1 + 0.18 * (Math.floor(t * 9) % 2))) : tt === 'stub' ? () => s(0.18) : tt === 'dragon' ? (t) => s(0.3 - t * 0.24)
      : tt === 'mane' || tt === 'horse' ? (t) => s(0.13 + t * 0.12) : tt === 'curl' ? () => s(0.06) : (t) => s(0.15 - t * 0.04);
      let td = 1e9;
      if (tt === 'curl') for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 3, b = ((i + 1) / 10) * Math.PI * 3, P = (u, ang) => [Math.cos(ang) * s(0.12), tailBase[1] + Math.sin(ang) * s(0.12), tailBase[2] + s(0.08) + u * s(0.2)]; td = Math.min(td, sdCone(p, P(i / 10, a), P((i + 1) / 10, b), s(0.06), s(0.06))); }
      else if (tt === 'cotton') td = sdEll(p, [0, tailBase[1], tailBase[2] + s(0.05)], [s(0.24), s(0.24), s(0.2)]);
      else for (let i = 0; i < 6; i++) { const a = bez(tailBase, tailMid, tailEnd, i / 6), b = bez(tailBase, tailMid, tailEnd, (i + 1) / 6); td = Math.min(td, sdCone(p, a, b, tr(i / 6), tr((i + 1) / 6))); }
      if (tt === 'tuft') td = smin(td, sdEll(p, tailEnd, [s(0.15), s(0.22), s(0.15)]), s(0.05));
      if (td < d) { bone = 'Tail1'; tag = tt === 'horse' ? 'mane' : ''; } d = smin(d, td, s(0.08)); }
    // ----- ridge of fur tufts along the neck / back (the "voxel wolf" look)
    if (sp.ridge) for (let i = 0; i < 6; i++) { const t = i / 5, b0 = [0, neckTop0[1] + (neckTop1[1] - neckTop0[1]) * t - s(0.08), neckTop0[2] + (neckTop1[2] - neckTop0[2]) * t];
      const tuft = sdCone(p, b0, [0, b0[1] + s(0.2 * sp.ridge * (1 - t * 0.4)), b0[2] + s(0.2)], s(0.17), s(0.03)); d = smin(d, tuft, s(0.03)); }
    // ----- manes
    if (sp.horseMane || sp.shortMane) { const h = sp.shortMane ? 0.1 : 0.2;
      for (let i = 0; i < 8; i++) { const t = i / 7, b0 = [0, neckTop0[1] + (neckTop1[1] - neckTop0[1]) * t * 0.9, neckTop0[2] + (neckTop1[2] - neckTop0[2]) * t * 0.9];
        const m = sdCone([p[0] * 1.9, p[1], p[2]], b0, [0, b0[1] + s(h * (i % 2 ? 0.8 : 1.1)), b0[2] + s(0.22)], s(0.15), s(0.05)); if (m < d) { tag = 'mane'; bone = t < 0.3 ? 'Head' : 'Body'; } d = Math.min(d, m); }
      if (sp.horseMane) { const f = sdCone(p, [0, headC[1] + s(0.48 * hs), headC[2] + s(0.1)], [s(0.06), headC[1] + s(0.3 * hs), headC[2] - s(0.32 * hs)], s(0.12), s(0.05)); if (f < d) { tag = 'mane'; bone = 'Head'; } d = Math.min(d, f); } }
    // ----- ears / horns
    for (const [ei, base] of ears.entries()) { const sx = ei ? 1 : -1; let e = 1e9;
      if (sp.ears === 'pointy' || sp.ears === 'big') { const h = (sp.ears === 'big' ? 0.62 : 0.5) * hs; e = sdBeam(p, [base[0], base[1] + s(0.02), base[2]], [base[0] + s(0.04 * sx), base[1] + s(h), base[2] + s(0.04)], [s(0.25 * hs), s(0.07), s(0.12 * hs)], [s(0.06), s(0.07), s(0.07)], s(0.01), 6); }
      else if (sp.ears === 'round') e = sdRBox(p, [base[0] + s(0.1 * sx * hs), base[1] + s(0.16 * hs), base[2] + s(0.04)], [s(0.13 * hs), s(0.12 * hs), s(0.07 * hs)], s(0.05));
      else if (sp.ears === 'mouse') e = sdEll(p, [base[0] + s(0.12 * sx), base[1] + s(0.1), base[2]], [s(0.24), s(0.24), s(0.06)]);
      else if (sp.ears === 'floppy') e = sdCone(p, [base[0] + s(0.12 * sx), base[1], base[2]], [base[0] + s(0.26 * sx), base[1] - s(0.44), base[2] - s(0.02)], s(0.13), s(0.11));
      else if (sp.ears === 'leaf') e = Math.max(sdCone(p, base, [base[0] + s(0.12 * sx), base[1] + s(0.32), base[2] + s(0.06)], s(0.12), s(0.03)), Math.abs(p[2] - base[2] - s(0.03)) - s(0.07));
      else if (sp.ears === 'side') e = Math.max(sdCone(p, [base[0] + s(0.1 * sx), base[1] - s(0.12), base[2] + s(0.05)], [base[0] + s(0.42 * sx), base[1] - s(0.02), base[2] + s(0.1)], s(0.1), s(0.06)), Math.abs(p[1] - base[1] + s(0.06)) - s(0.06) - Math.abs(p[0]) * 0.02);
      else if (sp.ears === 'pig') e = Math.max(sdCone(p, [base[0], base[1] - s(0.02), base[2]], [base[0] + s(0.12 * sx), base[1] + s(0.06), base[2] - s(0.24)], s(0.16), s(0.05)), Math.abs(p[1] - base[1] - s(0.03)) - s(0.06));
      else if (sp.ears === 'bunny') e = Math.max(sdCone(p, [base[0] - s(0.04 * sx), base[1], base[2]], [base[0] + s(0.1 * sx), base[1] + s(0.95), base[2] + s(0.15)], s(0.14), s(0.11)), Math.abs(p[2] - base[2] - s(0.08)) - s(0.07));
      else if (sp.ears === 'elephant') e = Math.max(sdEll(p, [s(0.62 * sx * hs), headC[1] - s(0.02), headC[2] + s(0.18 * hs)], [s(0.3), s(0.62 * hs), s(0.52 * hs)]), Math.abs(p[0] - s(0.62 * sx * hs)) - s(0.07));
      else if (sp.ears === 'horns') e = sdCone(p, base, [base[0] + s(0.15 * sx), base[1] + s(0.45), base[2] + s(0.5)], s(0.11), s(0.02));
      if (e < d) { bone = 'Ear' + (sx < 0 ? 'L' : 'R'); tag = ''; } d = Math.min(d, e); }
    if (sp.ossicones) for (const sx of [-1, 1]) { const b = [s(0.14 * sx * hs), headC[1] + s(0.42 * hs), headC[2] + s(0.1)], o = sdCone(p, b, [b[0] + s(0.03 * sx), b[1] + s(0.3), b[2] + s(0.06)], s(0.065), s(0.05)), kn = sdEll(p, [b[0] + s(0.03 * sx), b[1] + s(0.34), b[2] + s(0.06)], [s(0.085), s(0.08), s(0.085)]);
      if (o < d) { bone = 'Horn'; tag = ''; } d = Math.min(d, o); if (kn < d) { bone = 'Horn'; tag = 'knob'; } d = Math.min(d, kn); }
    if (sp.hornsSmall) for (const sx of [-1, 1]) { const h = Math.min(sdCone(p, [s(0.22 * sx), headC[1] + s(0.38), headC[2] + s(0.05)], [s(0.42 * sx), headC[1] + s(0.5), headC[2] - s(0.02)], s(0.08), s(0.05)), sdCone(p, [s(0.42 * sx), headC[1] + s(0.5), headC[2] - s(0.02)], [s(0.46 * sx), headC[1] + s(0.7), headC[2] - s(0.1)], s(0.05), s(0.02))); if (h < d) { bone = 'Horn'; tag = ''; } d = Math.min(d, h); }
    if (sp.horn) { const h = sdCone(p, [0, headC[1] + s(0.3), headC[2] - s(0.2)], [0, headC[1] + s(0.95), headC[2] - s(0.45)], s(0.09), s(0.015)); if (h < d) { bone = 'Horn'; tag = ''; } d = Math.min(d, h); }
    if (sp.antlers) for (const sx of [-1, 1]) { const b0 = [s(0.18 * sx), headC[1] + s(0.3), headC[2] + s(0.1)], b1 = [s(0.5 * sx), headC[1] + s(0.85), headC[2] + s(0.15)], b2 = [s(0.6 * sx), headC[1] + s(1.25), headC[2] - s(0.1)];
      const a = Math.min(sdCone(p, b0, b1, s(0.06), s(0.05)), sdCone(p, b1, b2, s(0.05), s(0.03)), sdCone(p, b1, [s(0.35 * sx), headC[1] + s(1.15), headC[2] + s(0.35)], s(0.04), s(0.02)), sdCone(p, [s(0.32 * sx), headC[1] + s(0.55), headC[2] + s(0.12)], [s(0.3 * sx), headC[1] + s(0.75), headC[2] - s(0.2)], s(0.035), s(0.02)));
      if (a < d) { bone = 'Antler' + (sx < 0 ? 'L' : 'R'); tag = ''; } d = Math.min(d, a); }
    if (sp.mane) { const ang = Math.atan2(p[1] - headC[1], p[0]), spike = s(0.13) * Math.max(0, Math.sin(ang * 9 + p[2] * 4)) + s(0.05) * hash2(Math.floor(ang * 6), Math.floor(p[2] / s(0.15)));
      const m = Math.min(sdEll(p, [0, headC[1] - s(0.02), headC[2] + s(0.2)], [s(0.88), s(0.92), s(0.55)]), sdEll(p, [0, headC[1] - s(0.55), headC[2] + s(0.35)], [s(0.55), s(0.6), s(0.45)])) - spike;
      if (p[2] > headC[2] - s(0.1)) { if (m < d) { bone = 'Head'; tag = 'mane'; } d = smin(d, m, s(0.06)); } }
    if (sp.wings) for (const sx of [-1, 1]) { const w0 = [s(0.45 * sx), s(2.0 * L), s(-0.3)], w1 = [s(1.6 * sx), s(2.9 * L), s(0.0)];
      let w = sdCone(p, w0, w1, s(0.09), s(0.05)), wt = 'wingBone';
      for (const [fy, fz, fr] of [[2.35, 0.05, 0.62], [2.1, 0.32, 0.55], [1.92, 0.58, 0.45]]) { const f = Math.max(sdEll(p, [s(1.15 * sx), s(fy * L), s(fz)], [s(0.85), s(fr), s(0.06)]), -(p[1] - s(1.65 * L))); if (f < w) { w = f; wt = 'feather' + Math.round(fz * 10); } }
      if (w < d) { bone = 'Wing' + (sx < 0 ? 'L' : 'R'); tag = wt; } d = Math.min(d, w); }
    return [d, bone, { headC, snoutTip, eyeC, chest, hip, tailEnd, tailBase, tag, earX: ears[1][0], earZ: ears[1][2] }];
  };
}

/* ---------- colours: per-voxel paint ---------- */
const RAINBOW = ['#ff7ab6', '#ffd45c', '#7cf7ff', '#b98bff'];
const i0 = (p) => (p[0] > 0 ? 1.3 : 0), ears0 = (A) => A.earX;
function colourAt(sp, p, bone, A, k, e) {
  const c = sp.cols, s = (v) => v * k, x = Math.abs(p[0]), hs = sp.head || 1, L = sp.legs, tag = A.tag;
  const { headC, snoutTip, tailEnd, eyeC } = A;
  const jag = (hash2(Math.floor(p[0] / s(0.11)) * 3 + Math.floor(p[2] / s(0.11)) * 7, 11) - 0.5) * s(0.16); // ragged colour borders (fur)
  // tagged surfaces first
  if (tag === 'claw') return '#141418';
  if (tag === 'hoof') return c.hoof || '#2b2420';
  if (tag === 'nail') return '#e9e1cf';
  if (tag === 'tusk') return sp.tusks;
  if (tag === 'tooth') return '#ffffff';
  if (tag === 'gum') return '#8a1f2a';
  if (tag === 'tongue') return '#ff6f8a';
  if (tag === 'udder') return '#f2a7b5';
  if (tag === 'knob') return c.dark;
  if (tag === 'mane' && sp.mane) { const h = hash2(Math.floor(p[0] / s(0.1)) + Math.floor(p[2] / s(0.1)) * 13, Math.floor(p[1] / s(0.1))); return h < 0.3 ? shadeHex(sp.mane, 0.72) : h > 0.8 ? mixc(sp.mane, '#e0a24a', 0.45) : sp.mane; }
  if (tag === 'mane') return sp.rainbow ? RAINBOW[Math.floor((p[1] + p[2] + 20) / s(0.18)) % 4] : (c.mane || c.dark);
  if (tag === 'disc') return len(x - s(0.08 * hs), p[1] - snoutTip[1] - s(0.02), 0) < s(0.05) && p[2] < snoutTip[2] ? '#7a2d40' : c.nose;
  if (tag === 'nose') { if (p[2] < snoutTip[2] - s(0.05) && p[1] < snoutTip[1] + s(0.06 * hs) && x > s(0.03) && x < s(0.09 * hs) && sp.muzzle !== 'canine' && sp.muzzle !== 'feline') return '#1b1215'; return c.nose; }
  if (tag === 'trunk') return Math.sin(len(p[0], p[1] - headC[1], p[2] - headC[2]) / s(0.07)) > 0.75 ? shadeHex(c.side, 0.86) : c.side;
  if (tag.startsWith('feather')) return sp.rainbow ? RAINBOW[+tag.slice(7) % 4] : tag === 'feather0' ? c.back : tag === 'feather3' ? mixc(c.side, c.belly, 0.4) : mixc(c.belly, c.side, 0.25);
  if (tag === 'wingBone') return c.back;
  // eyes. Front-facing hunters: a square amber eye with a black pupil, a dark rim and (wolf) a pale brow, like the reference figures.
  if (bone === 'Head' && !sp.sideEyes) { const ex = eyeC[0], dx = x - ex, dy = p[1] - eyeC[1], R = s(0.12 * hs), onFace = p[2] < eyeC[2] + s(0.14);
    if (onFace && Math.abs(dx) < R && Math.abs(dy) < R * 1.05) { // big glossy eye: black pupil, white glint, coloured ring for light-eyed species
      if (dx > R * 0.3 && dy > R * 0.35) return '#ffffff';
      if (sp.irisRing && (Math.abs(dx) > R * 0.55 || dy < -R * 0.5)) return e?.eye || c.eye; return '#0d0b10'; }
    if (sp.brows && onFace && Math.abs(dx) < R * 1.1 && dy > R * 1.05 && dy < R * 1.9) return c.muzzle; }
  if (bone === 'Head' && sp.sideEyes) { const ex = eyeC[0] * Math.sign(p[0] || 1), de = len(p[0] - ex, p[1] - eyeC[1], p[2] - eyeC[2]), R = s(0.12 * hs);
    if (de < R) { if (len(p[0] - ex, p[1] - eyeC[1] - R * 0.4, p[2] - eyeC[2] + R * 0.35) < R * 0.4) return '#ffffff'; return de < R * 0.8 ? '#0d0b10' : (e?.eye || c.eye); }
    if (de < R * 1.3 && p[1] > eyeC[1] + R * 0.5) return c.dark; }
  // mouth
  if (bone === 'Head' && (sp.muzzle === 'equine' || sp.muzzle === 'bovine')) { const my = snoutTip[1] - s((sp.muzzle === 'equine' || sp.muzzle === 'bovine' ? 0.16 : 0.08) * hs);
    if (Math.abs(p[1] - my) < s(0.024) && p[2] < snoutTip[2] + (headC[2] - snoutTip[2]) * 0.62 && p[2] > snoutTip[2] - s(0.02) + 0 * x) return sp.snarl && x < s(0.16) && p[1] < my ? '#c43a3a' : '#1b1215'; }
  if (sp.panda) { if (bone === 'Head' && len(x - s(0.22 * hs), p[1] - (headC[1] + s(0.06)), p[2] - (headC[2] - s(0.27 * hs))) < s(0.19 * hs)) return c.dark;
    if (bone.startsWith('Ear') || bone.startsWith('Leg') || (bone === 'Body' && p[2] < A.chest[2] + s(0.45) && p[1] > s(1.2))) return c.dark; }
  if (bone.startsWith('Ear')) { const inner = p[2] < headC[2] + s(0.12 * hs) && sp.ears !== 'horns';
    if (sp.ears === 'pointy' || sp.ears === 'big') { if (p[1] > headC[1] + s((sp.ears === 'big' ? 0.86 : 0.78) * hs)) return c.dark; return inner && Math.abs(x - Math.abs(ears0(A))) < s(0.12 * hs) && p[2] < A.earZ - s(0.04) ? (sp.mask ? '#f4f4f4' : '#f6c9cf') : c.back; }
    if (sp.ears === 'bunny' || sp.ears === 'mouse' || sp.ears === 'round' || sp.ears === 'leaf') return inner && x < s((sp.ears === 'mouse' ? 0.42 : 0.33) * hs) && x > s(0.18 * hs) ? '#f6c3cc' : sp.wool ? c.muzzle : c.back;
    if (sp.ears === 'elephant') return x < s(0.6 * hs) ? mixc(c.side, '#d9a0a8', 0.35) : c.side;
    return sp.wool ? c.muzzle : c.back; }
  if (bone === 'Horn') return sp.ossicones ? c.back : sp.horn || sp.hornsSmall; if (bone.startsWith('Antler')) return sp.antlers;
  if (bone.startsWith('Wing')) return p[1] > s(2.3) ? c.back : mixc(c.belly, c.side, 0.3);
  // tail
  if (bone === 'Tail1') { const tt = len(p[0] - tailEnd[0], p[1] - tailEnd[1], p[2] - tailEnd[2]); if (sp.tailTip && tt < s(0.38)) return sp.tailTip; if (sp.tail === 'tuft' && tt < s(0.26)) return c.dark;
    if (sp.rainbow) return RAINBOW[Math.floor(tt / s(0.2)) % 4]; if (sp.zebra && Math.sin(tt / s(0.08)) > 0.3) return c.dark; if (sp.stripes === true && Math.sin(tt / s(0.11)) > 0.45) return c.dark;
    if (sp.tail === 'bushy') return p[1] < tailEnd[1] + s(0.28) + jag ? c.side : (c.saddle || c.back); return c.back; }
  if (sp.mane && bone === 'Head' && p[2] > headC[2] - s(0.05) && len(p[0], p[1] - headC[1], p[2] - headC[2]) > s(0.42)) return mixc(sp.mane, '#5b2a0a', hash2(Math.floor(p[1] / s(0.11)), Math.floor(Math.atan2(p[1] - headC[1], p[0]) * 4)) * 0.45);
  if (sp.rainbow && bone === 'Body' && p[1] > s(2.0) && p[2] < s(-0.6)) return RAINBOW[Math.floor((p[2] + 10) / s(0.15)) % 4];
  // wool coat, dark face and legs
  if (sp.wool) { if (bone === 'Head') return p[1] > headC[1] + s(0.3) && p[2] > headC[2] - s(0.15) ? c.back : c.muzzle; if (bone.startsWith('Leg') && p[1] < s(0.85 * L)) return c.socks;
    return hash2(Math.floor(p[0] / s(0.22)) + Math.floor(p[2] / s(0.22)) * 31, Math.floor(p[1] / s(0.22))) > 0.55 ? c.side : c.back; }
  // coat patterns
  const torso = bone === 'Body' || (bone === 'Head' && p[2] > headC[2] + s(0.25)), bellyY = s((sp.bellyHi || (sp.pawsOnly ? 1.1 : 1.2)) * L) + jag;
  if (sp.cowSpots && (torso || (bone === 'Head' && p[2] > headC[2] - s(0.1) && p[1] > headC[1])) && vnoise(p[0] / s(0.42) + 3, p[1] / s(0.42), p[2] / s(0.45)) > 0.56) return sp.cowSpots;
  if (sp.giraffe && (torso || bone.startsWith('Leg') && p[1] > s(0.8 * L) || bone === 'Head' && p[2] > headC[2])) { const [d1, d2] = voronoi(p[0] / s(0.5), p[1] / s(0.5), p[2] / s(0.5)); if (p[1] > s(0.9 * L)) return d2 - d1 < 0.12 ? c.belly : mixc(c.patch, '#8a4a14', hash2(Math.floor(p[1] * 3), 2) * 0.3); }
  if (sp.rosettes && (torso || bone.startsWith('Leg') || bone === 'Tail1') && p[1] > bellyY - s(0.1)) { const [d1] = voronoi(p[0] / s(0.2), p[1] / s(0.2), p[2] / s(0.2)); if (d1 > 0.2 && d1 < 0.38 && hash2(Math.floor(p[0] / s(0.2)), Math.floor(p[2] / s(0.2))) > 0.25) return c.dark; }
  if (sp.zebra) { const muz = bone === 'Head' && p[2] < snoutTip[2] + s(0.3);
    if (muz) return c.dark; if (bone === 'Head') return Math.sin(p[1] / s(0.065)) > 0.2 ? c.dark : c.back;
    if (bone.startsWith('Leg')) return Math.sin(p[1] / s(0.07)) > 0.15 ? c.dark : c.back;
    if (bone === 'Body') { const neckish = p[2] < A.chest[2] + s(0.1); return Math.sin((neckish ? p[1] * 0.9 - p[2] * 0.5 : p[2] + Math.sin(p[1] / s(0.4)) * s(0.08)) / s(0.075)) > 0.15 ? c.dark : c.back; } }
  // face: muzzle, mask, cheeks
  if (bone === 'Head') {
    if (sp.face && p[2] < headC[2] - s(0.05) && p[1] < headC[1] + s(0.28)) return c.muzzle;
    if (sp.muzzle === 'pig' && p[2] < headC[2] - s(0.35 * hs)) return c.muzzle;
    if (sp.muzzle === 'bovine' && p[2] < snoutTip[2] + s(0.25)) return c.muzzle;
    if (sp.muzzle === 'equine' && p[2] < snoutTip[2] + s(0.2) && !sp.giraffe) return mixc(c.muzzle, c.dark, 0.25);
    if ((sp.muzzle === 'canine' || sp.muzzle === 'feline') && p[2] < headC[2] - s(0.22 * hs) && p[1] < headC[1] - s(0.02) + jag * 0.4) return c.muzzle;
    if (sp.mask && p[1] < eyeC[1] - s(0.04) + jag * 0.3 && x > s(0.16 * hs)) return c.muzzle;
    if (sp.ruff && x > s(0.38 * hs) && p[1] < headC[1] + s(0.05) && p[2] > headC[2] - s(0.1)) return sp.mask ? c.muzzle : c.side; // cheek fur
    if (sp.brows && !sp.snarl && p[1] > eyeC[1] + s(0.1) && len(x - eyeC[0], p[1] - eyeC[1] - s(0.17), p[2] - eyeC[2]) < s(0.07)) return c.muzzle; // eyebrow dots
    if (sp.stripes) { const top = p[1] > eyeC[1] + s(0.12 * hs);
      if (top && p[2] < headC[2] + s(0.2) && Math.sin(x / s(0.055)) > 0.55 && x < s(0.32 * hs)) return c.dark; // forehead marks
      if (!top && x > s(0.36 * hs) && Math.sin((p[1] + p[2] * 0.6) / s(0.06)) > (sp.stripes === true ? 0.6 : 0.8)) return c.dark; } // cheek stripes
    if (sp.scales && p[1] < headC[1] - s(0.1)) return c.belly;
    return p[1] > headC[1] + s(0.15) ? (c.saddle && p[1] > headC[1] + s(0.3) ? c.saddle : c.back) : c.side; }
  // legs: stockings with a ragged edge, darker paws for some
  if (bone.startsWith('Leg')) { const sock = s(sp.sockHi ? sp.sockHi * L : sp.pawsOnly ? 0.26 : sp.paw === 'hoof' ? 0.5 : 0.55) + jag * 0.6;
    if (p[1] < sock) return sp.pawsOnly ? c.belly : c.socks;
    if (sp.stripes === true && p[1] > s(0.42) && ((p[1] + p[2] * 0.4) / s(0.3)) % 1 < 0.2 && hash2(Math.floor((p[1] + p[2] * 0.4) / s(0.3)), bone.length + (p[0] > 0 ? 7 : 0)) > 0.25) return c.dark;
    if (sp.ruff && sp.mask && bone.includes('F') && p[2] < A.chest[2] - s(0.1)) return c.belly; // white front of the forelegs (wolf)
    return c.side; }
  // torso: belly, chest bib, saddle, back
  if (bone === 'Body') {
    if (p[1] < bellyY) return c.belly;
    if (p[2] < A.chest[2] - s(0.42 * sp.body) + jag && p[1] < s(1.75 * L) && x < s(0.36 * sp.body)) return c.belly; // chest bib
    if (sp.scales && x < s(0.08) && p[1] > s(2.0)) return sp.spikes;
    if (sp.stripes) { const h = clamp((p[1] - bellyY) / s(0.9), 0, 1), P = s(sp.stripes === true ? 0.27 : 0.45), u = p[2] - (p[1] - bellyY) * 0.45 + Math.sin(p[1] / s(0.25) + i0(p)) * s(0.06), i = Math.floor(u / P), band = u / P - i;
      if (h > 0.1 && band < (sp.stripes === true ? 0.1 + 0.2 * h : 0.05 + 0.08 * h) && !(h < 0.45 && hash2(i, p[0] > 0 ? 5 : 9) < 0.35)) return c.dark; }
    if (sp.spots && (Math.sin(p[0] * 31) * Math.sin(p[2] * 27) * Math.sin(p[1] * 23)) > 0.55 && p[1] > s(1.6)) return '#fbf3e6';
    if (sp.spikes && x < s(0.08) && p[1] > s(2.0)) return sp.spikes;
    if (c.saddle && p[1] > s(1.95 * L) + jag) return c.saddle;
    return p[1] > s(1.75 * L) + jag * 0.8 ? c.back : c.side; }
  return c.side;
}
/* ---------- voxelise + greedy merge ---------- */
// WILD cells (hidden interior voxels) match any colour, so visible blocks can grow through them;
// a WILD cell no visible block needs is simply left out (nobody can see it).
const WILD = 0xffff;
// grid values: 0 empty, 1..0x7fff visible colour keys, WILD (any bone) or 0x8000|boneId (hidden cell of one bone).
// wildOf(key) gives the hidden-cell value a key may grow through, so a Head block never tunnels through the Body.
const isWild = (g) => g === WILD || (g & 0x8000) !== 0;
function greedy(grid, nx, ny, nz, wildOf = () => WILD) {
  const boxes = [], used = new Uint8Array(nx * ny * nz), at = (x, y, z) => x + nx * (y + ny * z);
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const i = at(x, y, z); if (used[i] || !grid[i] || isWild(grid[i])) continue; const key = grid[i], wk = wildOf(key);
    const ok = (j) => !used[j] && (grid[j] === key || grid[j] === wk || grid[j] === WILD);
    const vis = (j) => grid[j] === key;
    let w = 1; while (x + w < nx && ok(at(x + w, y, z))) w++;
    let h = 1; grow: while (y + h < ny) { for (let k = 0; k < w; k++) if (!ok(at(x + k, y + h, z))) break grow; h++; }
    let d = 1; deep: while (z + d < nz) { for (let yy = 0; yy < h; yy++) for (let k = 0; k < w; k++) if (!ok(at(x + k, y + yy, z + d))) break deep; d++; }
    // trim trailing slabs holding no visible cell of this key (they would only add hidden volume and swing out when the bone moves)
    const slabZ = (zz) => { for (let yy = 0; yy < h; yy++) for (let k = 0; k < w; k++) if (vis(at(x + k, y + yy, z + zz))) return true; return false; };
    while (d > 1 && !slabZ(d - 1)) d--;
    const slabY = (yy) => { for (let zz = 0; zz < d; zz++) for (let k = 0; k < w; k++) if (vis(at(x + k, y + yy, z + zz))) return true; return false; };
    while (h > 1 && !slabY(h - 1)) h--;
    const slabX = (k) => { for (let zz = 0; zz < d; zz++) for (let yy = 0; yy < h; yy++) if (vis(at(x + k, y + yy, z + zz))) return true; return false; };
    while (w > 1 && !slabX(w - 1)) w--;
    for (let zz = 0; zz < d; zz++) for (let yy = 0; yy < h; yy++) for (let k = 0; k < w; k++) used[at(x + k, y + yy, z + zz)] = 1;
    boxes.push({ x, y, z, w, h, d, key });
  }
  return boxes;
}
function toParts(boxes, keys, origin, v) {
  // one "bone" part per bone (the biggest block keeps the bone name, the others are welded to it)
  const byBone = new Map();
  const parts = boxes.map((b, i) => { const [bone, color, mat] = keys[b.key - 1].split('|');
    const p = { key: 'v' + i, name: bone, shape: 'Block', size: [r3(b.w * v), r3(b.h * v), r3(b.d * v)], pos: [r3(origin[0] + (b.x + b.w / 2) * v), r3(origin[1] + (b.y + b.h / 2) * v), r3(origin[2] + (b.z + b.d / 2) * v)],
      rot: [0, 0, 0], color, material: mat || 'SmoothPlastic', transparency: 0, vox: r3(v), vol: b.w * b.h * b.d };
    const cur = byBone.get(bone); if (!cur || p.vol > cur.vol) byBone.set(bone, p); return p; });
  for (const p of parts) { const rep = byBone.get(p.name); if (rep !== p) { p.name = p.name + '_v'; p.parentKey = rep.key; p.weld = true; } delete p.vol; }
  // body first (the rig root)
  parts.sort((a, b) => (a.name === 'Body' ? -1 : b.name === 'Body' ? 1 : 0));
  return parts;
}
/* ---------- painterly voxel shading (MagicaVoxel-style, baked into the block colours) ----------
   ambient occlusion in creases, height gradient (darker towards the ground), soft top highlight,
   2x2x2 patch noise for a hand-painted fur feel. Shades are quantised so blocks still merge. */
const shadeHex = (hex, f) => { const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) * 1.6 : v * f))).toString(16).padStart(2, '0')).join(''); };
const noise3 = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const FLAT = /^#(0d0b10|141418|1b1215|ffffff|c43a3a|8a1f2a|ff6f8a)$/; // eyes, claws, mouth, teeth: keep pure
/* generic voxeliser: SDF field + painter -> shaded, greedy-merged Roblox parts (animals, critters) */
export function voxelizeField(f, paint, min, max, v, opts = {}) {
  const nx = Math.ceil((max[0] - min[0]) / v), ny = Math.ceil((max[1] - min[1]) / v), nz = Math.ceil((max[2] - min[2]) / v);
  const N = nx * ny * nz, at = (x, y, z) => x + nx * (y + ny * z);
  // pass 1: shape, bone, base colour
  const fill = new Uint8Array(N), info = new Array(N);
  let ymax = 0;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const p = [min[0] + (x + 0.5) * v, min[1] + (y + 0.5) * v, min[2] + (z + 0.5) * v], [d, bone, A] = f(p); if (d > 0) continue;
    const [col, mat] = paint(p, bone, A);
    const i = at(x, y, z); fill[i] = 1; info[i] = [bone, col, mat]; if (y > ymax) ymax = y; }
  const filled = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < nx && y < ny && z < nz && fill[at(x, y, z)] === 1;
  // pass 2: shade the visible voxels
  const grid = new Uint16Array(N), keys = [], keyIdx = new Map(), boneIdx = new Map(), shading = opts.shading !== false;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const i = at(x, y, z); if (!fill[i]) continue; let [bone, col, mat] = info[i];
    const visible = !(filled(x + 1, y, z) && filled(x - 1, y, z) && filled(x, y + 1, z) && filled(x, y - 1, z) && filled(x, y, z + 1) && filled(x, y, z - 1));
    if (shading && visible && mat !== 'Neon' && !FLAT.test(col)) {
      let open = 0; for (let dz = -2; dz <= 2; dz++) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy || dz) && !filled(x + dx, y + dy, z + dz)) open++;
      const ao = Math.min(1, open / 50);                                   // ~50 of 124 cells are open on a flat face
      let fct = ao < 0.42 ? 0.86 : 1;                                        // only deep creases (armpits, under the jaw) darken
      if (!filled(x, y + 1, z) && ao > 0.9) fct *= 1.04;                     // sun-lit tops
      if (opts.texture === true) { const h = noise3(x, y, z); fct *= h < 0.22 ? 0.9 : h > 0.84 ? 1.08 : 1; } // per-cube tint: the hand-made voxel figurine look
      fct = Math.round(fct / 0.06) * 0.06;                                   // quantised so blocks still merge
      if (Math.abs(fct - 1) > 0.01) col = shadeHex(col, fct);
    }
    if (!visible) { let b = boneIdx.get(bone); if (b === undefined) { b = boneIdx.size + 1; boneIdx.set(bone, b); } grid[i] = 0x8000 | b; continue; } // hidden inside: blocks of the same bone grow through it
    const key = `${bone}|${col}|${mat}`; let id = keyIdx.get(key); if (!id) { keys.push(key); id = keys.length; keyIdx.set(key, id); } grid[i] = id; }
  const boxes = greedy(grid, nx, ny, nz, (key) => { const b = boneIdx.get(keys[key - 1].split('|')[0]); return b ? 0x8000 | b : -1; });
  return { parts: toParts(boxes, keys, min, v), voxels: fill.reduce((s, g) => s + g, 0) };
}
export function voxelAnimal(speciesId, opts = {}) {
  const sp = VOX_SPECIES[speciesId] || VOX_SPECIES.loup, k = opts.scale || 1, v = (opts.voxel || 0.085) * k, e = opts.palette;
  const morph = (opts.flags && opts.flags.morph && VOX_MORPHS[opts.flags.morph]) || null;
  let sp2 = morph ? { ...sp, ...morph, cols: { ...sp.cols, ...morph.cols } } : sp; // body plan first (elephant, giraffe, horse…)
  if (e) sp2 = { ...sp2, cols: { ...sp2.cols, ...e } };
  if (opts.wings) sp2 = { ...sp2, wings: true }; // « avec des ailes » on any animal
  if (opts.flags) sp2 = { ...sp2, ...opts.flags }; // lexicon variants: zebra = horse + stripes, leopard = tiger + rosettes…
  const f = anatomy(sp2, k), top = 3.6 + (sp2.neckLen || 0) + (sp2.ears === 'bunny' ? 0.6 : 0) + (sp2.horn || sp2.antlers ? 0.6 : 0);
  const min = [-2.6 * k, 0, -3.3 * k], max = [2.6 * k, top * k, 3.6 * k];
  const paint = (p, bone, A) => { const col = colourAt(sp2, p, bone, A, k, opts); return [col, opts.glowEyes && /^#(f2|ff)/.test(col) && bone === 'Head' && col === (opts.eye || sp2.cols.eye) ? 'Neon' : 'SmoothPlastic']; };
  const out = voxelizeField(f, paint, min, max, v, opts);
  return { ...out, name: (morph && morph.fr) || sp.fr };
}
/** Voxelise any part-based pet (the existing smooth generator), keeping bones and colours. */
export function voxelizeParts(parts, voxel = 0.13) {
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  const xf = parts.map((p) => { const [ax, ay, az] = p.rot.map((d) => (d * Math.PI) / 180), cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
    const R = [[cy * cz, -cy * sz, sy], [cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy], [sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy]];
    const size = p.shape === 'Ball' ? [p.size[0], p.size[0], p.size[0]] : p.size, rad = Math.hypot(...size) / 2;
    for (let i = 0; i < 3; i++) { box[i] = Math.min(box[i], p.pos[i] - rad); box[i + 3] = Math.max(box[i + 3], p.pos[i] + rad); }
    return { p, R, size, small: Math.min(...size) < voxel * 1.2 }; });
  const min = box.slice(0, 3).map((v) => v - voxel), nx = Math.ceil((box[3] - box[0]) / voxel) + 2, ny = Math.ceil((box[4] - box[1]) / voxel) + 2, nz = Math.ceil((box[5] - box[2]) / voxel) + 2;
  const grid = new Uint16Array(nx * ny * nz), keys = [], keyIdx = new Map();
  const inside = (t, q) => { const d = [q[0] - t.p.pos[0], q[1] - t.p.pos[1], q[2] - t.p.pos[2]], R = t.R, l = [R[0][0] * d[0] + R[1][0] * d[1] + R[2][0] * d[2], R[0][1] * d[0] + R[1][1] * d[1] + R[2][1] * d[2], R[0][2] * d[0] + R[1][2] * d[1] + R[2][2] * d[2]];
    const pad = t.small ? voxel * 0.6 : 0, n = l.map((v, i) => v / (t.size[i] / 2 + pad)), sh = t.p.shape;
    if (sh === 'Ellipsoid' || sh === 'Ball') return n[0] * n[0] + n[1] * n[1] + n[2] * n[2] <= 1;
    if (sh === 'Cylinder') return Math.abs(n[0]) <= 1 && n[1] * n[1] + n[2] * n[2] <= 1;
    if (Math.abs(n[0]) > 1 || Math.abs(n[1]) > 1 || Math.abs(n[2]) > 1) return false;
    return sh === 'Wedge' ? n[1] <= n[2] : true; };
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const q = [min[0] + (x + 0.5) * voxel, min[1] + (y + 0.5) * voxel, min[2] + (z + 0.5) * voxel]; let hit = null;
    for (const t of xf) if (t.p.transparency < 0.6 && inside(t, q)) hit = t.p; // later (detail) parts win
    if (!hit) continue; const bone = hit.name.replace(/\d+$/, (m) => (/^(Tail|Horn)/.test(hit.name) ? m : '')).replace(/_v$/, '');
    const key = `${bone}|${hit.color}|${hit.material === 'Neon' ? 'Neon' : hit.material === 'Glass' ? 'Glass' : 'SmoothPlastic'}`; let id = keyIdx.get(key); if (!id) { keys.push(key); id = keys.length; keyIdx.set(key, id); } grid[x + nx * (y + ny * z)] = id; }
  return { parts: toParts(greedy(grid, nx, ny, nz), keys, min, voxel) };
}

// shared with the mesh importer (Meshy / any .glb)
export { sdRBox, greedy as greedyMerge, toParts as partsFromBoxes, WILD, sdEll, sdCone, smin, bez, mixc, shadeHex, sdCylY, sdCylZ, vnoise, voronoi, hash2 };
