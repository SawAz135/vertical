/* =====================================================================
   Roblox Forge - voxel critters (birds, sea life, insects, reptiles…).
   Same recipe as the voxel pets: a signed-distance sculpture with tagged
   surfaces (beak, eye, feather, fin, shell plate…), painted per voxel,
   MagicaVoxel-style shading, then greedy-merged into a few hundred parts.
   Front = -Z, up = +Y, feet on y = 0. 1 unit ≈ 1 stud at scale 1.
   ===================================================================== */
import { voxelizeField, sdRBox, sdEll, sdCone, smin, bez, mixc, shadeHex, sdCylY, voronoi, hash2 } from './voxel.js';

const len = Math.hypot;
function Field() { let d = 1e9, tag = 'body', bone = 'Body';
  return { add(x, t, k = 0, b = null) { if (x < d) { tag = t; bone = b || (t.startsWith('wing') ? (t.endsWith('R') ? 'WingR' : 'WingL') : /^(head|beak|eye|comb|wattle|tuft|antenna|tongue|mouth|stalk|crest)/.test(t) ? 'Head' : 'Body'); } d = k ? smin(d, x, k) : Math.min(d, x); },
    cut(x) { d = Math.max(d, -x); }, out: () => [d, bone, { tag }] }; }
const EYE = (F, p, c, r, k = 0) => { F.add(sdEll(p, c, [r, r, r]), 'eye', k); };

/* every critter: { box: [min, max], build(p, o) -> Field, paint(tag, p, o) -> colour } */
const BIRD = (o) => ({ body: o.color || '#ff9a3c', belly: o.belly || mixc(o.color || '#ff9a3c', '#ffffff', 0.55), wing: o.wing || shadeHex(o.color || '#ff9a3c', 0.72), beak: o.beak || '#ffb23e', leg: o.leg || '#ff9a3c' });
const CRITTERS = {
  bird: { box: [[-1.6, 0, -1.6], [1.6, 2.6, 1.9]],
    build(p, o) { const F = Field(), long = o.longLegs ? 1.6 : 0, ly = long;
      F.add(sdEll(p, [0, 1.05 + ly, 0.05], [0.56, 0.52, 0.78]), 'body');
      F.add(sdEll(p, [0, 1.12 + ly, -0.25], [0.5, 0.48, 0.5]), 'belly', 0.15);
      const hy = 1.62 + ly + (o.longNeck ? 0.9 : 0), hz = -0.62 - (o.longNeck ? 0.25 : 0);
      if (o.longNeck) for (let i = 0; i < 5; i++) { const a = bez([0, 1.3 + ly, -0.45], [0, 1.9 + ly, 0.1], [0, hy - 0.2, hz + 0.05], i / 5), b = bez([0, 1.3 + ly, -0.45], [0, 1.9 + ly, 0.1], [0, hy - 0.2, hz + 0.05], (i + 1) / 5); F.add(sdCone(p, a, b, 0.2, 0.18), 'body', 0.08); }
      F.add(sdEll(p, [0, hy, hz], [0.38, 0.38, 0.4]), 'head', 0.14);
      if (o.crest) for (let i = 0; i < 3; i++) F.add(sdCone(p, [0, hy + 0.3, hz + 0.05 + i * 0.08], [0, hy + 0.62 - i * 0.06, hz + 0.25 + i * 0.12], 0.07, 0.02), 'crest');
      const hook = o.hooked ? -0.18 : 0; F.add(sdCone(p, [0, hy - 0.04, hz - 0.3], [0, hy - 0.1 + hook, hz - 0.68], 0.13, 0.025), 'beak');
      for (const sx of [-1, 1]) { EYE(F, p, [0.25 * sx, hy + 0.08, hz - 0.2], 0.1);
        F.add(Math.max(sdEll(p, [0.5 * sx, 1.15 + ly, 0.18], [0.16, 0.38, 0.72]), -(p[1] - 0.72 - ly)), sx < 0 ? 'wingL' : 'wingR', 0.04);
        F.add(sdCone(p, [0.18 * sx, 0.7 + ly, 0.05], [0.18 * sx, 0.1, 0.0], 0.09, 0.08), 'leg');
        for (const tz of [-0.2, 0.12]) F.add(sdCone(p, [0.18 * sx, 0.07, 0], [0.18 * sx + (tz > 0 ? 0 : 0.06 * sx), 0.06, tz], 0.075, 0.07), 'leg'); }
      const fan = o.fan ? 1 : 0; // peacock fan or a normal tail
      if (fan) F.add(Math.max(sdEll(p, [0, 1.9 + ly, 1.05], [1.5, 1.35, 0.12]), -(p[1] - 0.5 - ly)), 'fan');
      else F.add(sdCone(p, [0, 1.12 + ly, 0.65], [0, 1.0 + ly, 1.35], 0.3, 0.16) + Math.max(0, Math.abs(p[0]) - 0.22) * 0.5, 'tail', 0.05);
      return F.out(); },
    paint(t, p, o) { const c = BIRD(o); if (t === 'eye') return p[1] > 0 && Math.abs(p[0]) > 0.3 && (p[2] < -0.85) ? '#ffffff' : '#14141c';
      if (t === 'beak' || t === 'leg') return t === 'beak' ? c.beak : c.leg; if (t === 'belly') return c.belly; if (t === 'head' && o.head) return o.head; if (t === 'crest') return o.crestColor || c.wing;
      if (t === 'fan' && o.fire) { const r = len(p[0], p[1] - 1.9); return ['#ffd84d', '#ff9a1a', '#ff5a1a', '#e8413a'][Math.floor(r * 3.2) % 4]; }
      if (t === 'fan') { const r = len(p[0], p[1] - 1.9 - (o.longLegs ? 1.6 : 0)); const ring = (r * 4.2) % 1; return ring > 0.72 ? (hash2(Math.floor(Math.atan2(p[1], p[0]) * 9), 3) > 0.4 ? '#1d3f8a' : '#ffd84d') : ring > 0.6 ? '#2f9e9a' : '#3fb36b'; }
      if (t.startsWith('wing') || t === 'tail') return Math.sin(p[2] * 14 + p[1] * 4) > 0.55 ? shadeHex(c.wing, 0.82) : c.wing; return c.body; } },
  chicken: { box: [[-1.2, 0, -1.2], [1.2, 3.4, 1.2]], // cube chicken (reference: tall white block, block beak, red wattle + stepped comb)
    build(p, o = {}) { const F = Field(), B = (c, h, t, r = 0.03) => F.add(sdRBox(p, c, h, r), t);
      B([0, 1.42, 0.06], [0.6, 0.48, 0.58], 'body'); B([0, 2.2, -0.04], [0.52, 0.5, 0.48], 'head');            // body block + head block (one tall white cube)
      B([0, 2.16, -0.6], [0.26, 0.13, 0.12], 'beak'); B([0, 1.86, -0.56], [0.17, 0.19, 0.06], 'wattle');       // beak, wattle under it
      F.cut(sdRBox(p, [0, 1.73, -0.6], [0.05, 0.08, 0.1], 0));                                              // notch in the wattle
      B([0, 2.8, -0.1], [0.09, 0.1, 0.22], 'comb'); B([0, 2.98, -0.18], [0.09, 0.1, 0.12], 'comb'); B([0, 2.86, 0.16], [0.09, 0.08, 0.08], 'comb');
      for (const sx of [-1, 1]) {
        B([0.66 * sx, 1.52, 0.08], [0.08, 0.32, 0.36], sx < 0 ? 'wingL' : 'wingR'); B([0.7 * sx, 1.3, 0.2], [0.07, 0.16, 0.26], sx < 0 ? 'wingL' : 'wingR');
        B([0.2 * sx, 0.5, 0.06], [0.06, 0.46, 0.06], 'leg', 0.01);
        for (const dx of [-0.13, 0, 0.13]) B([0.2 * sx + dx, 0.05, -0.1 - (dx ? 0 : 0.05)], [0.05, 0.05, 0.16], 'leg', 0.01); B([0.2 * sx, 0.05, 0.18], [0.05, 0.05, 0.09], 'leg', 0.01); }
      B([0, 1.75, 0.66], [0.3, 0.2, 0.12], 'tail');
      return F.out(); },
    paint(t, p, o) { const w = o.color || '#f2f2f2'; if (t === 'comb' || t === 'wattle') return '#e0241b'; if (t === 'beak') return '#f2b23a'; if (t === 'leg') return p[1] < 0.1 ? '#d9a038' : '#c8963a';
      const ex = Math.abs(Math.abs(p[0]) - 0.33), ey = Math.abs(p[1] - 2.38); if ((t === 'head' || t === 'eye') && p[2] < -0.38 && ex < 0.13 && ey < 0.1) return ex < 0.07 && ey < 0.06 ? '#2d6fb3' : '#b9c0c8';
      if (t.startsWith('wing') || t === 'tail') return shadeHex(w, 0.92); return w; } },
  duck: { box: [[-1.5, 0, -1.8], [1.5, 2.4, 1.6]],
    build(p, o = {}) { const F = Field();
      F.add(sdEll(p, [0, 0.95, 0.1], [0.62, 0.48, 0.95]), 'body'); F.add(sdCone(p, [0, 1.1, 0.6], [0, 1.35, 1.15], 0.28, 0.08), 'tail', 0.12);
      F.add(sdCone(p, [0, 1.15, -0.55], [0, 1.6, -0.7], 0.3, 0.24), 'neck', 0.1); F.add(sdEll(p, [0, 1.85, -0.72], [0.34, 0.33, 0.4]), 'head', 0.1);
      F.add(Math.max(sdEll(p, [0, 1.75, -1.12], [0.17, 0.08, 0.28]), -(p[2] + 0.92)), 'beak', 0.03);
      for (const sx of [-1, 1]) { EYE(F, p, [0.24 * sx, 1.95, -0.85], 0.075); F.add(sdEll(p, [0.52 * sx, 1.05, 0.25], [0.16, 0.32, 0.7]), sx < 0 ? 'wingL' : 'wingR', 0.04);
        F.add(sdCone(p, [0.2 * sx, 0.5, 0.1], [0.2 * sx, 0.1, 0.05], 0.06, 0.05), 'leg'); F.add(sdEll(p, [0.2 * sx, 0.05, -0.12], [0.18, 0.05, 0.22]), 'leg'); }
      return F.out(); },
    paint(t, p, o) { if (t === 'beak' || t === 'leg') return '#ffa526'; if (t === 'eye') return '#14141c';
      if (o.color) return t.startsWith('wing') ? shadeHex(o.color, 0.85) : o.color;
      if (t === 'head' || (t === 'neck' && p[1] > 1.45)) return '#2f8a4a'; if (t === 'neck') return p[1] > 1.36 ? '#ffffff' : '#7a4a2e';
      if (t.startsWith('wing')) return p[2] > 0.5 && p[1] > 1.0 ? '#3f5fbf' : '#9aa1ad'; if (t === 'tail') return '#2b2b33'; return p[2] < -0.4 ? '#7a4a2e' : '#c9ccd2'; } },
  owl: { box: [[-1.6, 0, -1.4], [1.6, 3.0, 1.4]],
    build(p, o = {}) { const F = Field();
      F.add(sdEll(p, [0, 1.2, 0.05], [0.72, 0.95, 0.68]), 'body'); F.add(sdEll(p, [0, 2.15, -0.05], [0.66, 0.55, 0.58]), 'head', 0.2);
      for (const sx of [-1, 1]) { F.add(sdCone(p, [0.42 * sx, 2.5, 0.05], [0.58 * sx, 2.95, 0.15], 0.15, 0.03), 'tuft');
        F.add(sdCylY(p.map((v, i) => (i === 1 ? p[2] : i === 2 ? p[1] : v)), [0.27 * sx, -0.58, 2.2], 0.24, 0.04), 'disc', 0.02); EYE(F, p, [0.27 * sx, 2.2, -0.58], 0.15);
        F.add(sdEll(p, [0.68 * sx, 1.25, 0.1], [0.17, 0.78, 0.5]), sx < 0 ? 'wingL' : 'wingR', 0.04);
        for (const tx of [-0.1, 0, 0.1]) F.add(sdCone(p, [0.25 * sx + tx, 0.25, -0.35], [0.25 * sx + tx, 0.04, -0.52], 0.07, 0.03), 'talon'); }
      F.add(sdCone(p, [0, 2.02, -0.58], [0, 1.8, -0.7], 0.08, 0.02), 'beak');
      if (!o.noProp) F.add(sdCylY(p, [0, 0.62, 0.1], 0.1, 0.62), 'branch'); // perch stump
      return F.out(); },
    paint(t, p, o) { const b = o.color || '#8a5a33'; if (t === 'eye') { const d = len(Math.abs(p[0]) - 0.27, p[1] - 2.2); return d < 0.08 ? '#14141c' : '#ffc93c'; }
      if (t === 'disc') return '#f2e2c4'; if (t === 'beak' || t === 'talon') return t === 'beak' ? '#e0a83a' : '#3a2e26'; if (t === 'branch') return '#5a3e26';
      if (t === 'tuft') return shadeHex(b, 0.75); if (t.startsWith('wing')) return hash2(Math.floor(p[1] * 6), Math.floor(p[2] * 6)) > 0.7 ? '#f2e2c4' : shadeHex(b, 0.85);
      if (t === 'body' && p[2] < -0.3) return Math.sin(p[1] * 18) > 0.6 ? shadeHex(b, 0.9) : '#e9d6b2'; return b; } },
  penguin: { box: [[-1.4, 0, -1.3], [1.4, 3.0, 1.2]],
    build(p, o = {}) { const F = Field();
      F.add(sdEll(p, [0, 1.25, 0.05], [0.7, 1.05, 0.62]), 'body'); F.add(sdEll(p, [0, 2.3, -0.05], [0.5, 0.48, 0.5]), 'head', 0.25);
      F.add(sdCone(p, [0, 2.24, -0.48], [0, 2.18, -0.82], 0.11, 0.03), 'beak');
      for (const sx of [-1, 1]) { EYE(F, p, [0.22 * sx, 2.42, -0.38], 0.08); F.add(sdCone(p, [0.62 * sx, 1.7, 0.0], [0.95 * sx, 0.95, 0.05], 0.15, 0.09), sx < 0 ? 'wingL' : 'wingR', 0.06);
        F.add(sdEll(p, [0.25 * sx, 0.07, -0.25], [0.2, 0.07, 0.32]), 'foot'); }
      return F.out(); },
    paint(t, p) { if (t === 'beak' || t === 'foot') return '#ff9a26'; if (t === 'eye') return '#14141c';
      if ((t === 'body' && p[2] < -0.18) || (t === 'head' && p[2] < -0.3 && p[1] < 2.32)) return p[1] > 1.9 && p[1] < 2.15 ? '#ffd84d' : '#f8f8f8'; return '#22222b'; } },
  bat: { box: [[-2.4, 0, -1.0], [2.4, 2.4, 1.0]],
    build(p, o = {}) { const F = Field(), y0 = 1.4;
      F.add(sdEll(p, [0, y0, 0], [0.32, 0.42, 0.3]), 'body'); F.add(sdEll(p, [0, y0 + 0.5, -0.1], [0.28, 0.26, 0.28]), 'head', 0.1);
      for (const sx of [-1, 1]) { F.add(sdCone(p, [0.14 * sx, y0 + 0.7, -0.05], [0.24 * sx, y0 + 1.05, 0.0], 0.1, 0.02), 'tuft'); EYE(F, p, [0.12 * sx, y0 + 0.56, -0.33], 0.06);
        const wing = Math.max(sdEll(p, [1.25 * sx, y0 + 0.15, 0.05], [1.1, 0.65, 0.05]), -sdEll(p, [1.3 * sx, y0 - 0.6, 0.05], [0.42, 0.5, 0.3]), -sdEll(p, [2.1 * sx, y0 - 0.35, 0.05], [0.35, 0.45, 0.3]));
        F.add(wing, sx < 0 ? 'wingL' : 'wingR'); F.add(sdCone(p, [0.25 * sx, y0 + 0.3, 0.06], [2.3 * sx, y0 + 0.55, 0.06], 0.05, 0.03), 'bone'); }
      return F.out(); },
    paint(t, p, o) { const c = o.color || '#3a3342'; if (t === 'eye') return '#ff4a6a'; if (t === 'bone') return shadeHex(c, 0.6); if (t.startsWith('wing')) return mixc(c, '#6a4a6a', 0.35); return c; } },
  fish: { box: [[-1.0, 0, -1.9], [1.0, 3.2, 2.2]],
    build(p, o) { const F = Field(), y0 = 1.6;
      F.add(sdEll(p, [0, y0, 0], [0.42, 0.85, 1.25]), 'body');
      F.add(Math.max(sdEll(p, [0, y0 + 0.1, 1.55], [0.06, 0.85, 0.5]), -(p[2] - 1.15)), 'fin', 0.05);
      F.add(Math.max(sdEll(p, [0, y0 + 0.8, 0.2], [0.05, 0.45, 0.6]), -(p[1] - y0 - 0.55)), 'fin');
      F.add(Math.max(sdEll(p, [0, y0 - 0.75, 0.4], [0.05, 0.3, 0.35]), p[1] - y0 + 0.55), 'fin');
      for (const sx of [-1, 1]) { EYE(F, p, [0.3 * sx, y0 + 0.25, -0.75], 0.13); F.add(sdEll(p, [0.45 * sx, y0 - 0.25, -0.2], [0.05, 0.22, 0.38]), 'fin'); }
      F.add(sdEll(p, [0, y0 - 0.12, -1.2], [0.16, 0.1, 0.1]), 'mouth');
      return F.out(); },
    paint(t, p, o) { const c = o.color || '#ff8a1e'; if (t === 'eye') return len(Math.abs(p[0]) - 0.38, p[1] - 1.85, p[2] + 0.8) < 0.07 ? '#14141c' : '#ffffff';
      if (t === 'mouth') return '#14141c'; if (t === 'fin') return Math.sin(p[2] * 18 + p[1] * 6) > 0.3 ? shadeHex(c, 0.75) : mixc(c, '#ffffff', 0.25);
      if (!o.color && Math.abs(Math.sin((p[2] + 0.25) * 2.6)) > 0.93) return '#ffffff'; // clown-fish bands
      if (p[1] < 1.25) return mixc(c, '#ffffff', 0.45); const sc = voronoi(p[0] * 4, p[1] * 4, p[2] * 4); return sc[1] - sc[0] < 0.08 ? shadeHex(c, 0.88) : c; } },
  shark: { box: [[-2.0, 0, -3.4], [2.0, 3.6, 3.6]],
    build(p, o) { const F = Field(), y0 = 1.4, kind = o.kind || 'shark';
      F.add(sdCone(p, [0, y0, -1.9], [0, y0, 2.2], 0.75, 0.22), 'body'); F.add(sdEll(p, [0, y0 + 0.05, -0.6], [0.88, 0.9, 1.6]), 'body', 0.6);
      if (kind === 'dolphin') F.add(sdCone(p, [0, y0 - 0.15, -2.0], [0, y0 - 0.22, -2.75], 0.25, 0.14), 'body', 0.15);
      else F.add(sdEll(p, [0, y0 + 0.02, -2.05], [0.55, 0.5, 0.75]), 'body', 0.3);
      F.add(Math.max(sdCone(p, [0, y0 + 0.6, -0.4], [0, y0 + (kind === 'whale' ? 1.0 : 1.9), 0.35], 0.42, 0.05), -(p[1] - y0 - 0.5)), 'fin', 0.06);
      F.add(Math.max(sdEll(p, [0, y0 + 0.35, 2.75], [0.08, 1.05, 0.38]), -(p[2] - 2.1)) - 0.02, 'tail', 0.08);
      for (const sx of [-1, 1]) { F.add(sdCone(p, [0.7 * sx, y0 - 0.4, -0.7], [1.6 * sx, y0 - 0.95, 0.1], 0.18, 0.06), 'fin', 0.06); EYE(F, p, [0.45 * sx, y0 + 0.25, -1.95], 0.1); }
      if (kind === 'shark') F.cut(sdEll(p, [0, y0 - 0.28, -2.75], [0.48, 0.3, 0.75])); // open jaws
      return F.out(); },
    paint(t, p, o) { const kind = o.kind || 'shark', c = o.color || { shark: '#7b8494', dolphin: '#7aa2c9', whale: '#3a5a8a', seal: '#7a7f88' }[kind];
      if (t === 'eye') return len(Math.abs(p[0]) - 0.5, p[1] - 1.72, p[2] + 2.0) < 0.07 ? '#ffffff' : '#14141c';
      if (kind === 'shark') { const dm = sdEll(p, [0, 1.12, -2.75], [0.48, 0.3, 0.75]); if (dm < 0.14 && p[2] < -1.95) return Math.abs(p[1] - 1.12) > 0.17 && (Math.floor(p[0] * 7 + 20) % 2 === 0 || Math.abs(p[1] - 1.12) > 0.24) ? '#ffffff' : '#d9455a'; }
      if (kind === 'shark' && t === 'body' && Math.abs(p[0]) > 0.55 && p[2] > -1.55 && p[2] < -1.0 && Math.sin(p[2] * 40) > 0.4 && p[1] > 1.2 && p[1] < 1.8) return shadeHex(c, 0.6); // gills
      if (kind === 'whale' && p[1] < 1.0 && Math.sin(p[0] * 30) > 0.4) return '#c9d4e0'; return p[1] < 1.2 ? '#eef2f5' : t === 'fin' || t === 'tail' ? shadeHex(c, 0.85) : c; } },
  butterfly: { box: [[-2.0, 0, -1.4], [2.0, 4.2, 1.4]],
    build(p, o = {}) { const F = Field(), y0 = 2.6;
      F.add(sdCone(p, [0, y0, -0.55], [0, y0, 0.75], 0.13, 0.07), 'body'); F.add(sdEll(p, [0, y0 + 0.02, -0.7], [0.16, 0.16, 0.16]), 'head');
      for (const sx of [-1, 1]) { F.add(sdCone(p, [0.06 * sx, y0 + 0.1, -0.8], [0.32 * sx, y0 + 0.7, -1.25], 0.06, 0.05), 'antenna'); F.add(sdEll(p, [0.33 * sx, y0 + 0.7, -1.25], [0.06, 0.06, 0.06]), 'antenna');
        const q = [p[0], p[1], p[2] - Math.abs(p[0]) * 0.25]; // wings raised in a shallow V, facing the viewer
        F.add(sdEll(q, [0.82 * sx, y0 + 0.62, -0.05], [0.8, 0.72, 0.1]), sx < 0 ? 'wingL' : 'wingR');
        F.add(sdEll(q, [0.6 * sx, y0 - 0.38, 0.05], [0.56, 0.5, 0.1]), sx < 0 ? 'wingL' : 'wingR'); }
      if (!o.noProp) { F.add(sdCylY(p, [0, y0 / 2 - 0.1, 0], 0.09, y0 / 2 - 0.15), 'stem'); F.add(sdEll(p, [0, y0 - 0.32, 0], [0.42, 0.14, 0.42]), 'flower'); } // flower it rests on
      return F.out(); },
    paint(t, p, o) { const c = o.color || '#9a5cff'; if (t === 'stem') return '#3e9a48'; if (t === 'flower') return len(p[0], p[2]) < 0.16 ? '#ffd84d' : '#ff8ac0';
      if (t.startsWith('wing')) { const y0 = 2.6, up = p[1] > y0, r = len(Math.abs(p[0]) - (up ? 0.95 : 0.65), p[1] - (up ? y0 + 0.7 : y0 - 0.4)), edge = up ? len((Math.abs(p[0]) - 0.82) / 0.8, (p[1] - y0 - 0.62) / 0.72) > 0.8 : len((Math.abs(p[0]) - 0.6) / 0.56, (p[1] - y0 + 0.38) / 0.5) > 0.78;
        if (edge) return hash2(Math.floor(p[0] * 7), Math.floor(p[2] * 7)) > 0.6 ? '#ffffff' : '#1d1b26'; return r < 0.22 ? mixc(c, '#ffffff', 0.6) : Math.abs(p[0]) < 0.35 ? shadeHex(c, 0.7) : c; }
      return '#1d1b26'; } },
  bee: { box: [[-1.6, 0, -1.4], [1.6, 3.6, 1.6]],
    build(p, o = {}) { const F = Field(), y0 = 2.2;
      F.add(sdEll(p, [0, y0, 0.3], [0.5, 0.5, 0.68]), 'body'); F.add(sdEll(p, [0, y0 + 0.08, -0.45], [0.32, 0.32, 0.3]), 'thorax', 0.06); F.add(sdEll(p, [0, y0 + 0.1, -0.85], [0.3, 0.3, 0.26]), 'head', 0.04);
      F.add(sdCone(p, [0, y0 - 0.05, 0.95], [0, y0 - 0.12, 1.25], 0.07, 0.01), 'sting');
      for (const sx of [-1, 1]) { EYE(F, p, [0.2 * sx, y0 + 0.16, -1.02], 0.11); F.add(sdCone(p, [0.1 * sx, y0 + 0.36, -0.95], [0.3 * sx, y0 + 0.85, -1.25], 0.03, 0.02), 'antenna');
        F.add(sdEll(p, [0.75 * sx, y0 + 0.62, -0.1], [0.62, 0.05, 0.38]), sx < 0 ? 'wingL' : 'wingR'); F.add(sdEll(p, [0.6 * sx, y0 + 0.55, 0.32], [0.42, 0.05, 0.26]), sx < 0 ? 'wingL' : 'wingR');
        for (const lz of [-0.55, -0.35, -0.15]) F.add(sdCone(p, [0.2 * sx, y0 - 0.25, lz], [0.45 * sx, y0 - 0.75, lz - 0.05], 0.075, 0.065), 'leg'); }
      return F.out(); },
    paint(t, p, o) { const c = o.color || '#ffc928'; if (t === 'eye' || t === 'antenna' || t === 'leg' || t === 'sting' || t === 'head') return '#1d1b26';
      if (t.startsWith('wing')) return Math.abs(p[0]) > 0.95 ? '#c9ecff' : '#eaf8ff'; if (t === 'thorax') return o.color ? shadeHex(c, 0.6) : '#c98a1e';
      return Math.sin((p[2] - 0.05) * 9.5) > 0.2 ? '#1d1b26' : c; } },
  ladybug: { box: [[-1.6, 0, -1.6], [1.6, 1.8, 1.5]],
    build(p, o) { const F = Field(), kind = o.kind || 'ladybug';
      if (kind === 'spider') { F.add(sdEll(p, [0, 0.95, 0.45], [0.62, 0.55, 0.7]), 'body'); F.add(sdEll(p, [0, 0.8, -0.4], [0.38, 0.32, 0.4]), 'head', 0.08);
        for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) { const z = -0.55 + i * 0.28, a = [0.3 * sx, 0.82, z], b = [1.0 * sx, 1.35, z + (i - 1.5) * 0.25], c2 = [1.45 * sx, 0.05, z + (i - 1.5) * 0.45];
          F.add(Math.min(sdCone(p, a, b, 0.1, 0.09), sdCone(p, b, c2, 0.09, 0.07)), 'leg'); }
        for (const sx of [-1, 1]) for (const [ex, ey] of [[0.1, 0.95], [0.22, 0.9]]) EYE(F, p, [ex * sx, ey, -0.75], 0.07); return F.out(); }
      if (kind === 'crab') { F.add(sdEll(p, [0, 0.75, 0], [1.0, 0.45, 0.7]), 'body');
        for (const sx of [-1, 1]) { F.add(sdCone(p, [0.25 * sx, 1.0, -0.4], [0.3 * sx, 1.45, -0.55], 0.05, 0.05), 'stalk'); EYE(F, p, [0.3 * sx, 1.5, -0.56], 0.11);
          F.add(Math.min(sdCone(p, [0.85 * sx, 0.7, -0.3], [1.3 * sx, 0.95, -0.9], 0.12, 0.1), sdEll(p, [1.35 * sx, 1.05, -1.2], [0.28, 0.32, 0.36])), 'claw');
          F.add(Math.max(sdEll(p, [1.35 * sx, 1.05, -1.2], [0.3, 0.34, 0.38]), -sdEll(p, [1.35 * sx, 1.05, -1.5], [0.08, 0.36, 0.22])), 'claw');
          for (let i = 0; i < 3; i++) F.add(Math.min(sdCone(p, [0.8 * sx, 0.6, 0.0 + i * 0.25], [1.35 * sx, 0.8, 0.1 + i * 0.3], 0.07, 0.06), sdCone(p, [1.35 * sx, 0.8, 0.1 + i * 0.3], [1.55 * sx, 0.05, 0.2 + i * 0.32], 0.06, 0.03)), 'leg'); }
        return F.out(); }
      F.add(Math.max(sdEll(p, [0, 0.55, 0.12], [0.95, 0.85, 1.05]), -(p[1] - 0.3)), 'shell'); F.add(sdEll(p, [0, 0.45, -0.95], [0.5, 0.36, 0.38]), 'head', 0.05);
      for (const sx of [-1, 1]) { EYE(F, p, [0.26 * sx, 0.55, -1.25], 0.09); F.add(sdCone(p, [0.15 * sx, 0.7, -1.15], [0.35 * sx, 1.05, -1.5], 0.03, 0.025), 'antenna');
        for (let i = 0; i < 3; i++) F.add(sdCone(p, [0.6 * sx, 0.35, -0.4 + i * 0.45], [1.05 * sx, 0.04, -0.5 + i * 0.5], 0.05, 0.035), 'leg'); }
      return F.out(); },
    paint(t, p, o) { const kind = o.kind || 'ladybug', c = o.color || (kind === 'crab' ? '#e8413a' : kind === 'spider' ? '#2b2b33' : '#e8413a');
      if (t === 'eye') return kind === 'crab' ? '#14141c' : kind === 'spider' ? '#ff3b3b' : '#ffffff'; if (t === 'leg' || t === 'antenna') return kind === 'crab' ? shadeHex(c, 0.85) : '#1d1b26';
      if (kind === 'spider') return t === 'body' && Math.abs(p[0]) < 0.12 && p[1] > 1.2 ? '#ff8a3c' : c;
      if (kind === 'crab') return t === 'claw' && p[2] < -1.35 ? mixc(c, '#ffffff', 0.35) : t === 'body' && p[1] < 0.55 ? mixc(c, '#ffffff', 0.4) : c;
      if (t === 'head') return '#1d1b26'; if (t === 'shell') { if (Math.abs(p[0]) < 0.05 && p[1] > 0.6) return '#1d1b26'; const [d1] = voronoi(p[0] * 1.6 + 5, p[1] * 1.6, p[2] * 1.6); return d1 < 0.3 ? '#1d1b26' : c; } return c; } },
  snake: { box: [[-1.8, 0, -2.6], [1.8, 1.6, 2.6]],
    build(p, o) { const F = Field(), lizard = o.kind === 'lizard';
      const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([Math.sin(t * Math.PI * 2.2) * (lizard ? 0.25 : 0.9) * (0.3 + t), 0.32 - t * 0.06, -1.9 + t * 4.2]); }
      for (let i = 0; i < 12; i++) F.add(sdCone(p, pts[i], pts[i + 1], 0.4 - i * 0.022 + (lizard && i < 4 ? 0.06 : 0), 0.4 - (i + 1) * 0.022 + (lizard && i < 4 ? 0.06 : 0)), 'body', 0.06);
      F.add(sdEll(p, [pts[0][0], 0.42, -2.15], [0.4, 0.3, 0.48]), 'head', 0.1);
      F.add(sdCone(p, [pts[0][0], 0.3, -2.5], [pts[0][0] + 0.06, 0.28, -2.75], 0.03, 0.02), 'tongue');
      for (const sx of [-1, 1]) { EYE(F, p, [pts[0][0] + 0.22 * sx, 0.5, -2.25], 0.07);
        if (lizard) for (const lz of [-1.45, -0.45]) F.add(Math.min(sdCone(p, [0.25 * sx, 0.3, lz], [0.6 * sx, 0.25, lz - 0.1], 0.08, 0.06), sdEll(p, [0.65 * sx, 0.04, lz - 0.18], [0.14, 0.04, 0.14])), 'leg'); }
      return F.out(); },
    paint(t, p, o) { const c = o.color || '#4cc46a'; if (t === 'eye') return '#ffd84d'; if (t === 'tongue') return '#e8413a'; if (t === 'leg') return shadeHex(c, 0.85);
      if (p[1] < 0.18) return mixc(c, '#ffffff', 0.5); const z = p[2] * 2.4, dia = Math.abs((z % 1 + 1) % 1 - 0.5) + Math.abs(p[0] - Math.sin((p[2] + 1.9) / 4.2 * Math.PI * 2.2) * 0.9 * (0.3 + (p[2] + 1.9) / 4.2)) * 1.2;
      return t === 'body' && dia < 0.28 ? shadeHex(c, 0.62) : c; } },
  worm: { box: [[-1.0, 0, -2.2], [1.0, 1.6, 2.2]],
    build(p, o = {}) { const F = Field(); for (let i = 0; i < 9; i++) F.add(sdEll(p, [Math.sin(i * 0.8) * 0.35, 0.42 + Math.max(0, Math.sin(i * 0.9)) * 0.25, -1.75 + i * 0.44], [0.38, 0.4, 0.3]), i === 0 ? 'head' : 'seg' + (i % 2), 0.06);
      for (const sx of [-1, 1]) { EYE(F, p, [0.16 * sx, 0.6, -2.0], 0.09); F.add(sdCone(p, [0.12 * sx, 0.75, -1.85], [0.22 * sx, 1.1, -2.0], 0.03, 0.03), 'antenna'); }
      return F.out(); },
    paint(t, p, o) { const c = o.color || '#ff8ac0'; if (t === 'eye') return '#14141c'; if (t === 'antenna') return shadeHex(c, 0.6); if (t === 'seg1') return shadeHex(c, 0.86); return c; } },
  frog: { box: [[-1.5, 0, -1.4], [1.5, 1.9, 1.4]],
    build(p, o = {}) { const F = Field();
      F.add(sdEll(p, [0, 0.7, 0.1], [0.85, 0.62, 0.9]), 'body'); F.add(sdEll(p, [0, 0.95, -0.55], [0.75, 0.42, 0.55]), 'body', 0.2);
      for (const sx of [-1, 1]) { F.add(sdEll(p, [0.42 * sx, 1.35, -0.62], [0.26, 0.26, 0.26]), 'eyeball', 0.05); EYE(F, p, [0.46 * sx, 1.42, -0.82], 0.1);
        F.add(sdEll(p, [0.75 * sx, 0.42, 0.45], [0.3, 0.38, 0.5]), 'leg', 0.08); F.add(sdEll(p, [0.85 * sx, 0.06, -0.05], [0.26, 0.06, 0.42]), 'foot', 0.02);
        F.add(sdCone(p, [0.5 * sx, 0.5, -0.65], [0.55 * sx, 0.06, -0.85], 0.1, 0.08), 'leg'); F.add(sdEll(p, [0.56 * sx, 0.05, -0.95], [0.18, 0.05, 0.16]), 'foot'); }
      F.add(sdEll(p, [0, 0.82, -1.08], [0.55, 0.03, 0.08]), 'mouth');
      return F.out(); },
    paint(t, p, o) { const c = o.color || '#4cc46a'; if (t === 'eye') return len(Math.abs(p[0]) - 0.5, p[1] - 1.42, p[2] + 0.9) < 0.07 ? '#14141c' : '#ffd84d'; if (t === 'mouth') return shadeHex(c, 0.5);
      if (t === 'body' && p[1] < 0.55) return mixc(c, '#fffbd0', 0.6); if (t === 'body' && hash2(Math.floor(p[0] * 4 + 9), Math.floor(p[2] * 4 + 9)) > 0.86 && p[1] > 1.0) return shadeHex(c, 0.7); return t === 'foot' ? shadeHex(c, 0.9) : c; } },
  turtle: { box: [[-1.6, 0, -2.0], [1.6, 1.9, 1.7]],
    build(p, o) { const F = Field(), snail = o.kind === 'snail';
      if (snail) { F.add(sdCone(p, [0, 0.25, -1.3], [0, 0.2, 1.3], 0.32, 0.12), 'skin'); F.add(sdEll(p, [0, 0.5, -1.45], [0.3, 0.38, 0.3]), 'skin', 0.15);
        for (const sx of [-1, 1]) { F.add(sdCone(p, [0.12 * sx, 0.8, -1.5], [0.25 * sx, 1.35, -1.7], 0.05, 0.04), 'skin'); EYE(F, p, [0.25 * sx, 1.4, -1.72], 0.09); }
        F.add(sdEll(p, [0, 1.15, 0.2], [0.5, 0.88, 0.88]), 'shell'); return F.out(); }
      F.add(Math.max(sdEll(p, [0, 0.55, 0.1], [1.1, 0.85, 1.3]), -(p[1] - 0.32)), 'shell'); F.add(sdEll(p, [0, 0.36, 0.1], [1.15, 0.14, 1.35]), 'rim', 0.04);
      F.add(sdCone(p, [0, 0.42, -1.0], [0, 0.6, -1.55], 0.24, 0.26), 'skin', 0.05); F.add(sdEll(p, [0, 0.62, -1.62], [0.3, 0.27, 0.34]), 'skin', 0.08);
      for (const sx of [-1, 1]) { EYE(F, p, [0.2 * sx, 0.72, -1.8], 0.07); for (const lz of [-0.75, 0.85]) F.add(sdEll(p, [0.85 * sx, 0.18, lz], [0.28, 0.18, 0.3]), 'skin'); }
      F.add(sdCone(p, [0, 0.3, 1.35], [0, 0.22, 1.65], 0.12, 0.04), 'skin');
      return F.out(); },
    paint(t, p, o) { const snail = o.kind === 'snail', c = o.color || (snail ? '#c9a06a' : '#3e9a48'); if (t === 'eye') return '#14141c';
      if (t === 'skin') return snail ? '#d9c4a8' : '#8bd36a'; if (t === 'rim') return '#e9d9a0';
      if (snail) { const a = Math.atan2(p[1] - 1.15, p[2] - 0.2), r = len(p[1] - 1.15, p[2] - 0.2); return Math.sin(r * 9 - a * 1.5) > 0.4 ? shadeHex(c, 0.7) : c; }
      const [d1, d2] = voronoi(p[0] * 1.4 + 3, p[1] * 0.4, p[2] * 1.4); return d2 - d1 < 0.12 ? '#e9d9a0' : d1 < 0.22 ? mixc(c, '#ffd84d', 0.25) : c; } },
  octopus: { box: [[-1.8, 0, -1.8], [1.8, 2.8, 1.8]],
    build(p, o = {}) { const F = Field();
      F.add(sdEll(p, [0, 1.75, 0.15], [0.72, 0.85, 0.8]), 'body');
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, c0 = [Math.cos(a) * 0.4, 1.1, Math.sin(a) * 0.4], c1 = [Math.cos(a) * 1.1, 0.4, Math.sin(a) * 1.1], c2 = [Math.cos(a + 0.6) * 1.45, 0.18, Math.sin(a + 0.6) * 1.45];
        for (let j = 0; j < 4; j++) F.add(sdCone(p, bez(c0, c1, c2, j / 4), bez(c0, c1, c2, (j + 1) / 4), 0.22 - j * 0.04, 0.18 - j * 0.04), 'arm', 0.05); }
      for (const sx of [-1, 1]) EYE(F, p, [0.32 * sx, 1.55, -0.5], 0.14);
      return F.out(); },
    paint(t, p, o) { const c = o.color || '#c86bff'; if (t === 'eye') return len(Math.abs(p[0]) - 0.36, p[1] - 1.55, p[2] + 0.62) < 0.08 ? '#14141c' : '#ffffff';
      if (t === 'arm' && p[1] < 0.3) return hash2(Math.floor(p[0] * 6), Math.floor(p[2] * 6)) > 0.5 ? mixc(c, '#ffffff', 0.55) : c; return hash2(Math.floor(p[0] * 5 + 9), Math.floor(p[1] * 5)) > 0.85 ? shadeHex(c, 0.78) : c; } },
  jellyfish: { box: [[-1.4, 0, -1.4], [1.4, 3.6, 1.4]],
    build(p, o = {}) { const F = Field(), y0 = 2.5;
      F.add(Math.max(sdEll(p, [0, y0, 0], [1.0, 0.85, 1.0]), -(p[1] - y0 + 0.15)), 'bell');
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; F.add(sdEll(p, [Math.cos(a) * 0.92, y0 - 0.15, Math.sin(a) * 0.92], [0.17, 0.13, 0.17]), 'rim', 0.04); }
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2, r0 = 0.62, pts = [0, 1, 2, 3, 4].map((j) => [Math.cos(a) * (r0 + Math.sin(j * 1.3 + i) * 0.14), y0 - 0.25 - j * 0.48, Math.sin(a) * (r0 + Math.cos(j * 1.1 + i) * 0.14)]);
        for (let j = 0; j < 4; j++) F.add(sdCone(p, pts[j], pts[j + 1], 0.09, 0.07), 'tentacle'); }
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.8; for (let j = 0; j < 4; j++) F.add(sdEll(p, [Math.cos(a) * 0.22 + Math.sin(j * 2 + i) * 0.08, y0 - 0.45 - j * 0.38, Math.sin(a) * 0.22], [0.15, 0.22, 0.15]), 'arm', 0.05); }
      for (const sx of [-1, 1]) EYE(F, p, [0.3 * sx, y0 + 0.05, -0.86], 0.11);
      return F.out(); },
    paint(t, p, o) { const c = o.color || '#ff8ad8'; if (t === 'eye') return p[1] > 2.58 && Math.abs(p[0]) > 0.3 ? '#ffffff' : '#14141c';
      if (t === 'bell') return hash2(Math.floor(p[0] * 4 + 9), Math.floor(p[2] * 4 + 9) + Math.floor(p[1] * 4) * 31) > 0.82 ? mixc(c, '#ffffff', 0.6) : p[1] > 3.0 ? mixc(c, '#ffffff', 0.25) : c;
      if (t === 'rim') return shadeHex(c, 0.85); if (t === 'arm') return mixc(c, '#ffffff', 0.35); return mixc(c, '#c86bff', 0.25); } },
  axolotl: { box: [[-1.6, 0, -1.6], [1.6, 2.2, 2.4]],
    build(p, o = {}) { const F = Field();
      F.add(sdCone(p, [0, 0.62, -0.2], [0, 0.55, 1.1], 0.5, 0.36), 'body'); F.add(sdEll(p, [0, 0.85, -0.75], [0.7, 0.55, 0.58]), 'head', 0.18);
      F.add(Math.max(sdEll(p, [0, 0.62, 1.55], [0.08, 0.42, 0.75]), -(p[2] - 1.0)), 'fin', 0.05);
      for (const sx of [-1, 1]) { EYE(F, p, [0.4 * sx, 0.98, -1.18], 0.1);
        for (const [gy, gz, k2] of [[1.35, -0.55, 1], [1.12, -0.48, 0.9], [0.88, -0.45, 0.8]]) { const b0 = [0.55 * sx, gy - 0.1, gz], b1 = [(0.95 + 0.15 * k2) * sx, gy + 0.32 * k2, gz + 0.2];
          F.add(sdCone(p, b0, b1, 0.08, 0.06), 'gill'); for (let j = 1; j <= 3; j++) { const q = [b0[0] + (b1[0] - b0[0]) * j / 3.3, b0[1] + (b1[1] - b0[1]) * j / 3.3, b0[2] + (b1[2] - b0[2]) * j / 3.3]; F.add(sdEll(q.map((v, i) => p[i] - v + (i === 1 ? 0 : 0)).map((v, i) => v), [0, 0, 0], [0.1, 0.07, 0.09]), 'frond'); } }
        for (const lz of [-0.25, 0.75]) F.add(Math.min(sdCone(p, [0.42 * sx, 0.45, lz], [0.7 * sx, 0.12, lz - 0.1], 0.1, 0.08), sdEll(p, [0.75 * sx, 0.06, lz - 0.16], [0.14, 0.06, 0.14])), 'leg'); }
      return F.out(); },
    paint(t, p, o) { const c = o.color || '#ffb8d2'; if (t === 'eye') return p[1] > 1.02 && Math.abs(p[0]) > 0.42 ? '#ffffff' : '#14141c';
      if (t === 'head' && p[2] < -1.25 && Math.abs(p[1] - 0.72) < 0.04 && Math.abs(p[0]) < 0.32) return shadeHex(c, 0.55); // smile
      if (t === 'gill' || t === 'frond') return t === 'frond' ? '#ff5fa8' : '#ff7ab8'; if (t === 'fin') return mixc(c, '#ffffff', 0.35);
      return hash2(Math.floor(p[0] * 5 + 9), Math.floor(p[2] * 5 + 9)) > 0.9 && p[1] > 0.9 ? '#ff9ac4' : c; } },
};
/* lexicon types that reuse a sculpture with a variant */
const ALIAS = { parrot: ['bird', { crest: true, color: '#e8413a', wing: '#2f6fdf', belly: '#ffd84d', hooked: true }], eagle: ['bird', { hooked: true, color: '#5a3a22', belly: '#5a3a22', head: '#f6f6f2', crest: false, beak: '#ffc93c', leg: '#ffc93c' }], phoenix: ['bird', { fan: true, crest: true, color: '#ff6a1a', wing: '#e8413a', belly: '#ffd84d', crestColor: '#ffd84d', beak: '#ffd84d', leg: '#e8413a', fire: true }],
  flamingo: ['bird', { longLegs: true, longNeck: true, color: '#ff8ac0', beak: '#2b2b33', leg: '#ff8ac0' }], peacock: ['bird', { fan: true, crest: true, color: '#2f6fbf', wing: '#2f9e9a', crestColor: '#2f6fbf' }],
  ostrich: ['bird', { longLegs: true, longNeck: true, color: '#3a2e28', belly: '#3a2e28', beak: '#e6b48a', leg: '#e6b48a' }],
  dolphin: ['shark', { kind: 'dolphin' }], whale: ['shark', { kind: 'whale' }], seal: ['shark', { kind: 'dolphin', color: '#7a7f88' }],
  spider: ['ladybug', { kind: 'spider' }], crab: ['ladybug', { kind: 'crab' }], lizard: ['snake', { kind: 'lizard' }], snail: ['turtle', { kind: 'snail' }] };
export const CRITTER_TYPES = [...Object.keys(CRITTERS), ...Object.keys(ALIAS)];

const cache = new Map();
/** Voxel critter as Roblox parts (cached). o: { color, scale, voxel, shading } */
export function voxelCritter(type, o = {}) {
  let t = type, extra = {}; if (ALIAS[t]) { [t, extra] = ALIAS[t]; } if (!CRITTERS[t]) t = 'bird';
  const opt = { ...extra, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v != null)) }, k = opt.scale || 1, key = type + JSON.stringify(opt);
  if (cache.has(key)) return cache.get(key);
  const C = CRITTERS[t], v = (opt.voxel || 0.12) * k, min = C.box[0].map((x) => x * k), max = C.box[1].map((x, i) => (x + (i === 1 ? (opt.longLegs ? 1.7 : 0) + (opt.longNeck ? 1.0 : 0) : 0) + (i === 1 && opt.fan ? 1.0 : 0)) * k);
  const f = (p) => C.build([p[0] / k, p[1] / k, p[2] / k], opt).map((x, i) => (i === 0 ? x * k : x));
  const paint = (p, bone, A) => [C.paint(A.tag, [p[0] / k, p[1] / k, p[2] / k], opt), 'SmoothPlastic'];
  const out = voxelizeField(f, paint, min, max, v, { shading: opt.shading !== false });
  if (cache.size > 80) cache.clear(); cache.set(key, out); return out;
}

/** Pet-generator species that have no quadruped rig get their own voxel sculpture (morph or critter). */
export const PET_VOXEL = { lapin: { animal: 'chat', flags: { morph: 'lapin' } }, hibou: { critter: 'owl' }, pingouin: { critter: 'penguin' }, poussin: { critter: 'chicken', color: '#ffd84d' },
  phenix: { critter: 'phoenix' }, serpent: { critter: 'snake' }, poisson: { critter: 'fish' }, requin: { critter: 'shark' }, pieuvre: { critter: 'octopus' }, abeille: { critter: 'bee' },
  papillon: { critter: 'butterfly' }, araignee: { critter: 'spider' }, meduse: { critter: 'jellyfish' }, axolotl: { critter: 'axolotl' } };
