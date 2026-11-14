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

/* ---------- species anatomy (studs; front = -Z, up = +Y) ---------- */
export const VOX_SPECIES = {
  loup: { fr: 'Loup', body: 1.0, legs: 0.95, neckDrop: 0.3, snout: 1.25, ears: 'pointy', tail: 'bushy', cols: { back: '#7d828c', side: '#a7acb5', belly: '#f3f3f3', muzzle: '#f3f3f3', dark: '#3b3f47', nose: '#141418', eye: '#f2a52b', socks: '#f3f3f3' }, mask: true, snarl: true },
  tigre: { fr: 'Tigre', body: 1.12, legs: 0.88, pawsOnly: true, neckDrop: 0.12, snout: 0.95, ears: 'round', tail: 'long', cols: { back: '#f28a1b', side: '#f7a23a', belly: '#fbfaf5', muzzle: '#fbfaf5', dark: '#1d1715', nose: '#e8b04b', eye: '#f2c94c', socks: '#fbfaf5' }, stripes: true },
  renard: { fr: 'Renard', body: 0.85, legs: 0.9, neckDrop: 0.0, snout: 1.35, ears: 'big', tail: 'bushy', cols: { back: '#e8621f', side: '#f07a30', belly: '#fbf6ef', muzzle: '#fbf6ef', dark: '#2a1f1d', nose: '#141418', eye: '#c98a1a', socks: '#2a1f1d' }, tailTip: '#fbf6ef' },
  chat: { fr: 'Chat', body: 0.75, legs: 0.85, neckDrop: -0.05, snout: 0.7, ears: 'pointy', tail: 'long', cols: { back: '#f2a14a', side: '#f6b46a', belly: '#fff3e3', muzzle: '#fff3e3', dark: '#8a4f1d', nose: '#ff8fa3', eye: '#7ad36b', socks: '#fff3e3' }, stripes: 'soft' },
  chien: { fr: 'Chien', body: 0.95, legs: 0.95, neckDrop: -0.05, snout: 1.1, ears: 'floppy', tail: 'up', cols: { back: '#c4813f', side: '#d6995a', belly: '#f7ead8', muzzle: '#f7ead8', dark: '#5b3a1f', nose: '#141418', eye: '#5b3a1f', socks: '#f7ead8' } },
  ours: { fr: 'Ours', body: 1.3, legs: 0.9, neckDrop: 0.1, snout: 0.95, ears: 'round', tail: 'stub', cols: { back: '#6b4a2f', side: '#7d5838', belly: '#8f6a48', muzzle: '#c9a27a', dark: '#2a1d14', nose: '#141418', eye: '#1b1310', socks: '#5b3d26' } },
  lion: { fr: 'Lion', body: 1.1, legs: 1.0, neckDrop: 0.0, snout: 0.95, ears: 'round', tail: 'tuft', cols: { back: '#e0a24a', side: '#e8b25e', belly: '#f6e0b5', muzzle: '#f6e0b5', dark: '#7a3f12', nose: '#5b2f1d', eye: '#f2c94c', socks: '#e0a24a' }, mane: '#9a4f1a' },
  panda: { fr: 'Panda', body: 1.15, legs: 0.85, neckDrop: 0.05, snout: 0.75, ears: 'round', tail: 'stub', cols: { back: '#f6f6f6', side: '#f6f6f6', belly: '#f6f6f6', muzzle: '#f6f6f6', dark: '#1b1b20', nose: '#141418', eye: '#141418', socks: '#1b1b20' }, panda: true },
  cerf: { fr: 'Cerf', body: 0.95, legs: 1.35, neckDrop: -0.35, snout: 1.15, ears: 'leaf', tail: 'stub', cols: { back: '#a8703f', side: '#b98250', belly: '#f4e6d2', muzzle: '#f4e6d2', dark: '#3b2716', nose: '#141418', eye: '#1b1310', socks: '#8a5a33' }, antlers: '#e8dcc2', spots: true },
  licorne: { fr: 'Licorne', body: 1.0, legs: 1.35, neckDrop: -0.45, snout: 1.25, ears: 'leaf', tail: 'mane', cols: { back: '#fbf7ff', side: '#f4ecff', belly: '#ffffff', muzzle: '#ffffff', dark: '#d9c9f0', nose: '#ffb3d1', eye: '#7c5cff', socks: '#e9dcff' }, horn: '#ffd45c', rainbow: true },
  dragon: { fr: 'Dragon', body: 1.15, legs: 0.95, neckDrop: -0.3, snout: 1.45, ears: 'horns', tail: 'dragon', cols: { back: '#2f9e57', side: '#3fb36b', belly: '#e8f2b0', muzzle: '#3fb36b', dark: '#1d5c33', nose: '#1d1d1d', eye: '#ff5a1f', socks: '#2f9e57' }, wings: true, spikes: '#f2e6c9' },
};

/* ---------- anatomy SDF + colour, with a bone tag per voxel ---------- */
function anatomy(sp, k) {
  const L = sp.legs, B = sp.body, s = (v) => v * k;
  const chest = [0, s(1.42 * L), s(-0.62 * B)], hip = [0, s(1.5 * L), s(0.72 * B)], headC = [0, s((2.0 - sp.neckDrop) * L + 0.1), s(-1.5 * B - 0.2)];
  const legs = [['LegFL', -1, -0.72], ['LegFR', 1, -0.72], ['LegBL', -1, 0.72], ['LegBR', 1, 0.72]].map(([n, sx, fz]) => { const x = s(0.33 * sx * B), z = s(fz * B), back = fz > 0;
    return { n, top: [x, s(1.35 * L), z], knee: [x, s((back ? 0.7 : 0.6) * L), z + s(back ? 0.28 : 0.1)], foot: [x, s(0.1), z - s(back ? 0.05 : 0.1)], r: s((back ? 0.34 : 0.27) * B), back }; });
  const tailBase = [0, s(1.65 * L), s(1.12 * B)];
  const tailEnd = { bushy: [0, s(0.85 * L), s(2.15 * B)], long: [0, s(1.2 * L), s(2.5 * B)], up: [0, s(2.45 * L), s(1.75 * B)], stub: [0, s(1.55 * L), s(1.55 * B)], tuft: [0, s(1.1 * L), s(2.6 * B)], mane: [0, s(0.75 * L), s(2.2 * B)], dragon: [s(0.6), s(0.9 * L), s(2.95 * B)] }[sp.tail];
  const tailMid = [tailEnd[0] * 0.4, (tailBase[1] + tailEnd[1]) / 2 + s(sp.tail === 'up' ? 0.2 : 0.25), (tailBase[2] + tailEnd[2]) / 2 + s(0.2)];
  const snoutTip = [0, headC[1] - s(0.12), headC[2] - s(0.6 * sp.snout)];
  return function evalAt(p) {
    let d = sdCone(p, chest, hip, s(0.58 * B), s(0.52 * B)), bone = 'Body';
    d = smin(d, sdEll(p, [0, chest[1] - s(0.05), chest[2] - s(0.15)], [s(0.55 * B), s(0.66 * B), s(0.55 * B)]), s(0.25));
    const neck = sdCone(p, [0, chest[1] + s(0.25), chest[2] - s(0.2)], [0, headC[1] - s(0.05), headC[2] + s(0.25)], s(0.4 * B), s(0.33));
    d = smin(d, neck, s(0.2));
    const head = smin(sdEll(p, headC, [s(0.47), s(0.44), s(0.5)]), sdCone(p, [0, headC[1] - s(0.06), headC[2] - s(0.2)], snoutTip, s(0.31), s(0.2)), s(0.14));
    if (head < d + s(0.04)) bone = 'Head'; d = smin(d, head, s(0.08));
    for (const g of legs) { const l = Math.min(sdCone(p, g.top, g.knee, g.r, g.r * 0.62), sdCone(p, g.knee, g.foot, g.r * 0.6, g.r * 0.55), sdEll(p, [g.foot[0], s(0.1), g.foot[2] - s(0.08)], [g.r * 0.7, s(0.12), g.r * 1.05]));
      if (l < d && p[1] < s(1.15 * L)) bone = g.n; d = smin(d, l, s(0.1)); }
    if (sp.tail !== 'stub' || true) { const tr = sp.tail === 'bushy' ? (t) => s(0.16 + Math.sin(t * Math.PI) * 0.2) : sp.tail === 'stub' ? () => s(0.18) : sp.tail === 'dragon' ? (t) => s(0.3 - t * 0.24) : sp.tail === 'mane' ? (t) => s(0.18 + t * 0.12) : () => s(0.1);
      let td = 1e9; for (let i = 0; i < 6; i++) { const a = bez(tailBase, tailMid, tailEnd, i / 6), b = bez(tailBase, tailMid, tailEnd, (i + 1) / 6); td = Math.min(td, sdCone(p, a, b, tr(i / 6), tr((i + 1) / 6))); }
      if (td < d) bone = 'Tail1'; d = smin(d, td, s(0.08)); }
    // ears / horns
    for (const sx of [-1, 1]) { const base = [s(0.2 * sx), headC[1] + s(0.28), headC[2] + s(0.12)];
      let e = 1e9;
      if (sp.ears === 'pointy' || sp.ears === 'big') { const h = sp.ears === 'big' ? 0.5 : 0.36; e = sdCone(p, base, [base[0] + s(0.05 * sx), base[1] + s(h), base[2] + s(0.05)], s(0.15), s(0.02)); }
      else if (sp.ears === 'round') e = sdEll(p, [base[0] + s(0.06 * sx), base[1] + s(0.06), base[2]], [s(0.14), s(0.14), s(0.08)]);
      else if (sp.ears === 'floppy') e = sdCone(p, [base[0] + s(0.12 * sx), base[1], base[2]], [base[0] + s(0.24 * sx), base[1] - s(0.4), base[2] - s(0.02)], s(0.12), s(0.1));
      else if (sp.ears === 'leaf') e = sdCone(p, base, [base[0] + s(0.3 * sx), base[1] + s(0.2), base[2] + s(0.1)], s(0.1), s(0.03));
      else if (sp.ears === 'horns') e = sdCone(p, base, [base[0] + s(0.15 * sx), base[1] + s(0.45), base[2] + s(0.5)], s(0.11), s(0.02));
      if (e < d) bone = 'Ear' + (sx < 0 ? 'L' : 'R'); d = Math.min(d, e); }
    if (sp.horn) { const h = sdCone(p, [0, headC[1] + s(0.3), headC[2] - s(0.2)], [0, headC[1] + s(0.95), headC[2] - s(0.45)], s(0.09), s(0.015)); if (h < d) bone = 'Horn'; d = Math.min(d, h); }
    if (sp.antlers) for (const sx of [-1, 1]) { const b0 = [s(0.18 * sx), headC[1] + s(0.3), headC[2] + s(0.1)], b1 = [s(0.5 * sx), headC[1] + s(0.85), headC[2] + s(0.15)], b2 = [s(0.6 * sx), headC[1] + s(1.25), headC[2] - s(0.1)];
      const a = Math.min(sdCone(p, b0, b1, s(0.06), s(0.05)), sdCone(p, b1, b2, s(0.05), s(0.03)), sdCone(p, b1, [s(0.35 * sx), headC[1] + s(1.15), headC[2] + s(0.35)], s(0.04), s(0.02)));
      if (a < d) bone = 'Antler' + (sx < 0 ? 'L' : 'R'); d = Math.min(d, a); }
    if (sp.mane) { const m = sdEll(p, [0, headC[1] - s(0.05), headC[2] + s(0.2)], [s(0.68), s(0.7), s(0.5)]); if (m < d && p[2] > headC[2] - s(0.15)) bone = 'Head'; if (p[2] > headC[2] - s(0.15)) d = smin(d, m, s(0.1)); }
    if (sp.wings) for (const sx of [-1, 1]) { const w0 = [s(0.45 * sx), s(2.0 * L), s(-0.3)], w1 = [s(1.6 * sx), s(2.9 * L), s(0.0)], w2 = [s(2.0 * sx), s(2.2 * L), s(0.6)];
      const w = Math.min(sdCone(p, w0, w1, s(0.09), s(0.05)), Math.max(sdEll(p, [s(1.15 * sx), s(2.15 * L), s(0.25)], [s(0.85), s(0.62), s(0.06)]), -(p[1] - s(1.65 * L))));
      if (w < d) bone = 'Wing' + (sx < 0 ? 'L' : 'R'); d = Math.min(d, w); }
    return [d, bone, { headC, snoutTip, chest, hip, tailEnd, tailBase }];
  };
}
function colourAt(sp, p, bone, A, k, e) {
  const c = sp.cols, s = (v) => v * k, x = Math.abs(p[0]);
  const { headC, snoutTip, tailEnd } = A;
  // eyes, nose, mouth on the head
  const eyeC = [s(0.2) * Math.sign(p[0] || 1), headC[1] + s(0.08), headC[2] - s(0.3)];
  const de = len(p[0] - eyeC[0], p[1] - eyeC[1], p[2] - eyeC[2]);
  if (bone === 'Head' && de < s(0.11)) return de < s(0.055) ? '#0d0b10' : (e?.eye || c.eye);
  if (bone === 'Head' && len(p[0], p[1] - (snoutTip[1] + s(0.06)), p[2] - snoutTip[2]) < s(0.12)) return c.nose;
  if (bone === 'Head' && sp.snarl && Math.abs(p[1] - (snoutTip[1] - s(0.08))) < s(0.03) && p[2] < headC[2] - s(0.3)) return x < s(0.1) ? '#ffffff' : '#c43a3a';
  if (bone === 'Head' && Math.abs(p[1] - (snoutTip[1] - s(0.06))) < s(0.022) && p[2] < headC[2] - s(0.25)) return '#1b1215';
  if (sp.panda) { if (bone === 'Head' && len(x - s(0.2), p[1] - (headC[1] + s(0.06)), p[2] - (headC[2] - s(0.27))) < s(0.17)) return c.dark;
    if (bone.startsWith('Ear') || bone.startsWith('Leg') || (bone === 'Body' && p[2] < A.chest[2] + s(0.45) && p[1] > s(1.2))) return c.dark; }
  if (bone.startsWith('Ear')) return p[1] > headC[1] + s(0.42) ? c.dark : (p[2] < headC[2] + s(0.1) && x < s(0.28) ? mixc(c.muzzle, '#ffb3c1', 0.35) : c.back);
  if (bone === 'Horn') return sp.horn; if (bone.startsWith('Antler')) return sp.antlers;
  if (bone.startsWith('Wing')) return p[1] > s(2.3) ? c.back : mixc(c.belly, c.side, 0.3);
  // tail tip
  if (bone === 'Tail1') { const tt = len(p[0] - tailEnd[0], p[1] - tailEnd[1], p[2] - tailEnd[2]); if (sp.tailTip && tt < s(0.35)) return sp.tailTip; if (sp.tail === 'tuft' && tt < s(0.25)) return c.dark;
    if (sp.rainbow) return ['#ff7ab6', '#ffd45c', '#7cf7ff', '#b98bff'][Math.floor(tt / s(0.2)) % 4]; if (sp.stripes === true && Math.sin(p[2] / s(0.12)) > 0.55) return c.dark; return p[1] > tailEnd[1] + s(0.2) || sp.tail !== 'bushy' ? c.back : c.side; }
  // mane
  if (sp.mane && bone === 'Head' && p[2] > headC[2] - s(0.05) && len(p[0], p[1] - headC[1], p[2] - headC[2]) > s(0.4)) return mixc(sp.mane, '#5b2a0a', Math.max(0, Math.sin(p[1] * 9) * 0.3));
  if (sp.rainbow && bone === 'Body' && p[1] > s(2.0) && p[2] < s(-0.6)) return ['#ff7ab6', '#ffd45c', '#7cf7ff', '#b98bff'][Math.floor((p[2] + 10) / s(0.15)) % 4];
  // muzzle / chest / belly / legs
  if (bone === 'Head') { if (p[2] < headC[2] - s(0.22) && p[1] < headC[1] - s(0.0)) return c.muzzle; if (sp.mask && p[1] < headC[1] + s(0.02) && x > s(0.18)) return c.muzzle; return p[1] > headC[1] + s(0.15) ? c.back : c.side; }
  if (bone.startsWith('Leg')) { if (p[1] < s(0.05) && p[2] < A.chest[2] - s(0.05) + (bone.includes('B') ? s(1.9) : 0) && sp.ears !== 'round') return '#141418';
    if (p[1] < s(sp.pawsOnly ? 0.24 : 0.55)) return sp.pawsOnly ? c.belly : c.socks; if (sp.stripes === true && Math.sin(p[1] / s(0.09)) > 0.55) return c.dark; return c.side; }
  if (p[1] < s(sp.pawsOnly ? 1.02 : 1.18) && (bone === 'Body')) return c.belly;
  if (bone === 'Body' && p[2] < A.chest[2] + s(0.1) && p[1] < s(1.65) && x < s(0.4)) return c.belly;
  if (sp.stripes) { const ph = Math.sin(p[2] / s(0.13) + Math.sin(p[1] * 3) * 0.6); if (sp.stripes === true ? ph > 0.62 : ph > 0.85) return c.dark; }
  if (sp.spots && (Math.sin(p[0] * 31) * Math.sin(p[2] * 27) * Math.sin(p[1] * 23)) > 0.55 && p[1] > s(1.6)) return '#fbf3e6';
  if (sp.spikes && x < s(0.08) && p[1] > s(2.0)) return sp.spikes;
  return p[1] > s(1.85) ? c.back : c.side;
}

/* ---------- voxelise + greedy merge ---------- */
function greedy(grid, nx, ny, nz) {
  const boxes = [], used = new Uint8Array(nx * ny * nz), at = (x, y, z) => x + nx * (y + ny * z);
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const i = at(x, y, z); if (used[i] || !grid[i]) continue; const key = grid[i];
    let w = 1; while (x + w < nx && !used[at(x + w, y, z)] && grid[at(x + w, y, z)] === key) w++;
    let h = 1; grow: while (y + h < ny) { for (let k = 0; k < w; k++) { const j = at(x + k, y + h, z); if (used[j] || grid[j] !== key) break grow; } h++; }
    let d = 1; deep: while (z + d < nz) { for (let yy = 0; yy < h; yy++) for (let k = 0; k < w; k++) { const j = at(x + k, y + yy, z + d); if (used[j] || grid[j] !== key) break deep; } d++; }
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
      rot: [0, 0, 0], color, material: mat || 'SmoothPlastic', transparency: 0, vol: b.w * b.h * b.d };
    const cur = byBone.get(bone); if (!cur || p.vol > cur.vol) byBone.set(bone, p); return p; });
  for (const p of parts) { const rep = byBone.get(p.name); if (rep !== p) { p.name = p.name + '_v'; p.parentKey = rep.key; p.weld = true; } delete p.vol; }
  // body first (the rig root)
  parts.sort((a, b) => (a.name === 'Body' ? -1 : b.name === 'Body' ? 1 : 0));
  return parts;
}
export function voxelAnimal(speciesId, opts = {}) {
  const sp = VOX_SPECIES[speciesId] || VOX_SPECIES.loup, k = opts.scale || 1, v = (opts.voxel || 0.11) * k, f = anatomy(sp, k), e = opts.palette;
  const sp2 = e ? { ...sp, cols: { ...sp.cols, ...e } } : sp;
  const min = [-2.6 * k, 0, -3.1 * k], max = [2.6 * k, 3.6 * k, 3.6 * k], nx = Math.ceil((max[0] - min[0]) / v), ny = Math.ceil((max[1] - min[1]) / v), nz = Math.ceil((max[2] - min[2]) / v);
  const grid = new Uint16Array(nx * ny * nz), keys = [], keyIdx = new Map();
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const p = [min[0] + (x + 0.5) * v, min[1] + (y + 0.5) * v, min[2] + (z + 0.5) * v], [d, bone, A] = f(p); if (d > 0) continue;
    let col = colourAt(sp2, p, bone, A, k, opts); const mat = opts.glowEyes && /^#(f2|ff)/.test(col) && bone === 'Head' && col === (opts.eye || sp2.cols.eye) ? 'Neon' : 'SmoothPlastic';
    const key = `${bone}|${col}|${mat}`; let id = keyIdx.get(key); if (!id) { keys.push(key); id = keys.length; keyIdx.set(key, id); } grid[x + nx * (y + ny * z)] = id; }
  // mirror check: keep the pet symmetric even when the grid is odd
  const boxes = greedy(grid, nx, ny, nz);
  return { parts: toParts(boxes, keys, min, v), voxels: grid.reduce((s, g) => s + (g ? 1 : 0), 0), name: sp.fr };
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
