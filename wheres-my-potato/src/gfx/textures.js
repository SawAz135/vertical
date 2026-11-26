import * as THREE from 'three';
import { rng, clamp, lerp } from '../core/util.js';

// Procedural, tileable texture factory. No external image assets: every surface is painted here
// (albedo + height-derived normal map + roughness), so the game ships as code only.

const cache = new Map();
let MAXA = 8;
export function setAniso(renderer) { MAXA = Math.min(8, renderer.capabilities.getMaxAnisotropy()); }

// --- tileable value noise on a periodic lattice
class TNoise {
  constructor(seed, period = 64) {
    this.p = period; const r = rng(seed);
    this.g = new Float32Array(period * period);
    for (let i = 0; i < this.g.length; i++) this.g[i] = r();
  }
  v(x, y) { // x,y in lattice units, wraps at period
    const p = this.p;
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
    const g = this.g;
    const a = g[y0 * p + x0], b = g[y0 * p + x1], c = g[y1 * p + x0], d = g[y1 * p + x1];
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
  }
  // fbm sampled in uv [0,1) with base frequency f (integer so it tiles)
  fbm(u, v, f, oct = 4, gain = 0.5) {
    let s = 0, a = 0.5, tot = 0;
    for (let i = 0; i < oct; i++) { s += a * this.v(u * f, v * f); tot += a; f *= 2; a *= gain; }
    return s / tot;
  }
}

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Builds albedo / height / rough buffers by a per-pixel painter fn(u,v,out) -> out = [r,g,b,height,rough]
function paint(size, fn) {
  const alb = new Uint8ClampedArray(size * size * 4), hgt = new Float32Array(size * size), rgh = new Uint8ClampedArray(size * size * 4);
  const o = [0, 0, 0, 0, 0];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    fn(x / size, y / size, o, x, y);
    const i = y * size + x;
    alb[i * 4] = o[0] * 255; alb[i * 4 + 1] = o[1] * 255; alb[i * 4 + 2] = o[2] * 255; alb[i * 4 + 3] = 255;
    hgt[i] = o[3];
    const r = clamp(o[4], 0, 1) * 255; rgh[i * 4] = 255; rgh[i * 4 + 1] = r; rgh[i * 4 + 2] = 0; rgh[i * 4 + 3] = 255; // G = roughness (three.js reads G)
  }
  return { size, alb, hgt, rgh };
}
function toTex(data, size, srgb, repeat = 1) {
  const c = canvas(size, size); const ctx = c.getContext('2d');
  ctx.putImageData(new ImageData(data, size, size), 0, 0);
  return canvasTex(c, srgb, repeat);
}
export function canvasTex(c, srgb = true, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = MAXA; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}
function normalFromHeight(hgt, size, strength) {
  const out = new Uint8ClampedArray(size * size * 4);
  const H = (x, y) => hgt[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * size + x) * 4;
    out[i] = (-dx / l * 0.5 + 0.5) * 255; out[i + 1] = (dy / l * 0.5 + 0.5) * 255; out[i + 2] = (1 / l * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  return out;
}
function set(name, size, fn, nStrength = 2) {
  const p = paint(size, fn);
  return {
    map: toTex(p.alb, size, true),
    normalMap: toTex(normalFromHeight(p.hgt, size, nStrength * size / 256), size, false),
    roughnessMap: toTex(p.rgh, size, false),
  };
}
const mix3 = (o, a, b, t) => { o[0] = lerp(a[0], b[0], t); o[1] = lerp(a[1], b[1], t); o[2] = lerp(a[2], b[2], t); };
const hex = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

export function getSet(name, size = 512) {
  const key = name + size;
  if (cache.has(key)) return cache.get(key);
  const s = BUILDERS[name](size);
  cache.set(key, s);
  return s;
}

const BUILDERS = {
  concrete(size) {
    const n = new TNoise(11), m = new TNoise(12), k = new TNoise(13, 32);
    return set('concrete', size, (u, v, o) => {
      const base = n.fbm(u, v, 8, 5), blot = m.fbm(u, v, 3, 3), fine = n.v(u * 180, v * 180);
      // expansion joint along the tile border
      const ju = Math.min(u, 1 - u), jv = Math.min(v, 1 - v), joint = Math.min(ju, jv) < 0.004 ? 1 : 0;
      // hairline cracks: ridges of a noise field
      const cr = Math.abs(k.fbm(u, v, 4, 4) - 0.5); const crack = cr < 0.008 ? (1 - cr / 0.008) * (k.fbm(u + 0.3, v, 2, 2) > 0.5 ? 1 : 0) : 0;
      const c = 0.5 + base * 0.18 + fine * 0.05 - blot * 0.12;
      mix3(o, [c * 0.95, c * 0.94, c * 0.9], [c * 0.78, c * 0.74, c * 0.66], clamp((blot - 0.45) * 3, 0, 1)); // oil/dirt stains
      const dark = 1 - joint * 0.55 - crack * 0.4; o[0] *= dark; o[1] *= dark; o[2] *= dark;
      o[3] = base * 0.6 + fine * 0.15 - joint * 1.2 - crack * 0.8 + (n.v(u * 90, v * 90) > 0.93 ? -0.6 : 0); // pores
      o[4] = 0.82 + fine * 0.1 - blot * 0.15;
    }, 2.2);
  },
  plaster(size) {
    const n = new TNoise(21);
    return set('plaster', size, (u, v, o) => {
      const b = n.fbm(u, v, 6, 5), grime = clamp(1 - v * 1.4 + n.fbm(u, v, 3, 3) * 0.6, 0, 1);
      const c = 0.78 + b * 0.08;
      mix3(o, [c, c * 0.97, c * 0.9], [c * 0.62, c * 0.58, c * 0.48], grime * grime * 0.8);
      o[3] = b * 0.5; o[4] = 0.9;
    }, 1);
  },
  corrugated(size) {
    const n = new TNoise(31), r = new TNoise(32);
    return set('corrugated', size, (u, v, o) => {
      const wave = Math.sin(u * Math.PI * 2 * 8) * 0.5 + 0.5;
      const rust = clamp((r.fbm(u, v, 4, 5) - 0.52) * 4 + (1 - v) * 0.4 - 0.3, 0, 1);
      const streak = clamp(n.fbm(u * 0.2 + u, v * 0.05, 16, 3) - 0.4, 0, 1);
      const c = 0.55 + wave * 0.12 + n.v(u * 200, v * 200) * 0.04;
      mix3(o, [c * 0.82, c * 0.86, c * 0.88], [0.42, 0.23, 0.12], rust * 0.9);
      o[0] -= streak * 0.15; o[1] -= streak * 0.15; o[2] -= streak * 0.12;
      o[3] = wave * 1.2 + rust * 0.2; o[4] = lerp(0.45, 0.85, rust);
    }, 3);
  },
  wood(size) {
    const n = new TNoise(41), g = new TNoise(42, 128);
    return set('wood', size, (u, v, o) => {
      const plank = Math.floor(u * 4), pu = (u * 4) % 1;
      const off = plank * 0.37;
      const grain = g.fbm(pu * 0.6 + plank, v + off, 4, 3);
      const rings = Math.sin((v * 30 + grain * 8 + plank * 3) * Math.PI) * 0.5 + 0.5;
      const seam = pu < 0.02 || pu > 0.98 ? 1 : 0;
      const endSeam = Math.abs(((v + off * 0.5) % 0.5)) < 0.006 ? 1 : 0;
      const tone = 0.42 + n.fbm(u, v, 5, 4) * 0.2 + plank % 2 * 0.04;
      mix3(o, [tone * 0.95, tone * 0.66, tone * 0.4], [tone * 0.7, tone * 0.45, tone * 0.25], rings * 0.6);
      const d = 1 - (seam + endSeam) * 0.6; o[0] *= d; o[1] *= d; o[2] *= d;
      o[3] = rings * 0.3 + grain * 0.4 - (seam + endSeam) * 1.5; o[4] = 0.78 + rings * 0.12;
    }, 2);
  },
  crateWood(size) {
    const n = new TNoise(43), g = new TNoise(44, 128);
    return set('crateWood', size, (u, v, o) => {
      const board = Math.floor(v * 5), pv = (v * 5) % 1;
      const grain = g.fbm(u + board * 0.3, pv * 0.3, 8, 3);
      const gap = pv < 0.05 ? 1 : 0;
      const tone = 0.52 + grain * 0.18 + n.fbm(u, v, 6, 3) * 0.12 - (board % 2) * 0.05;
      const dirt = clamp(n.fbm(u, v, 3, 4) - 0.45, 0, 1) * 1.6;
      o[0] = tone * 0.9 - dirt * 0.18; o[1] = tone * 0.7 - dirt * 0.16; o[2] = tone * 0.46 - dirt * 0.1;
      if (gap) { o[0] *= 0.25; o[1] *= 0.22; o[2] *= 0.2; }
      // nail heads
      const nu = (u * 2) % 1; if (Math.abs(nu - 0.08) < 0.012 && Math.abs(pv - 0.5) < 0.04) { o[0] = o[1] = o[2] = 0.25; }
      o[3] = grain * 0.6 - gap * 2; o[4] = 0.85;
    }, 2.5);
  },
  metal(size) {
    const n = new TNoise(51);
    return set('metal', size, (u, v, o) => {
      const brush = n.fbm(u * 0.05, v, 64, 3), scr = n.v(u * 300, v * 7) > 0.97 ? 1 : 0, rust = clamp((n.fbm(u, v, 3, 5) - 0.6) * 3, 0, 1);
      const c = 0.55 + brush * 0.1 + scr * 0.15;
      mix3(o, [c, c * 1.01, c * 1.03], [0.4, 0.22, 0.1], rust);
      o[3] = brush * 0.2; o[4] = 0.35 + brush * 0.2 + rust * 0.5 - scr * 0.2;
    }, 0.6);
  },
  paintedMetal(size) {
    const n = new TNoise(52);
    return set('paintedMetal', size, (u, v, o) => {
      const chip = n.fbm(u, v, 16, 4), worn = chip > 0.74 ? 1 : 0, edge = chip > 0.7 && !worn ? 1 : 0;
      const c = 0.9 + n.v(u * 100, v * 100) * 0.05;
      if (worn) { o[0] = 0.32; o[1] = 0.3; o[2] = 0.3; } else { o[0] = c; o[1] = c; o[2] = c; }
      if (edge) { o[0] *= 0.8; o[1] *= 0.8; o[2] *= 0.8; }
      o[3] = worn ? -0.6 : 0; o[4] = worn ? 0.4 : 0.55;
    }, 1.5);
  },
  grate(size) {
    const n = new TNoise(53);
    const p = paint(size, (u, v, o) => {
      const bu = (u * 12) % 1, bv = (v * 3) % 1;
      const bar = bu < 0.22 || bv < 0.06;
      const c = 0.38 + n.fbm(u, v, 8, 3) * 0.2;
      o[0] = c * 1.05; o[1] = c * 0.95; o[2] = c * 0.88; o[3] = bar ? 1 : 0; o[4] = 0.55;
    });
    const a = new Uint8ClampedArray(p.alb); for (let i = 0; i < p.hgt.length; i++) a[i * 4 + 3] = p.hgt[i] > 0.5 ? 255 : 0;
    return { map: toTex(a, size, true), normalMap: toTex(normalFromHeight(p.hgt, size, 3), size, false), roughnessMap: toTex(p.rgh, size, false) };
  },
  gravel(size) {
    const n = new TNoise(61), cells = [];
    const r = rng(62); for (let i = 0; i < 900; i++) cells.push([r(), r(), r(), r() * 0.5 + 0.5]);
    // grid-accelerated worley for pebbles
    const G = 24, grid = Array.from({ length: G * G }, () => []);
    cells.forEach(c => grid[Math.floor(c[1] * G) * G + Math.floor(c[0] * G)].push(c));
    return set('gravel', size, (u, v, o) => {
      let d1 = 9, best = null; const gx = Math.floor(u * G), gy = Math.floor(v * G);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = (gx + i + G) % G, cy = (gy + j + G) % G;
        for (const c of grid[cy * G + cx]) {
          let dx = Math.abs(u - c[0]); dx = Math.min(dx, 1 - dx); let dy = Math.abs(v - c[1]); dy = Math.min(dy, 1 - dy);
          const d = Math.hypot(dx, dy) / (c[3] * 0.032); if (d < d1) { d1 = d; best = c; }
        }
      }
      const peb = clamp(1 - d1, 0, 1), t = best ? best[2] : 0.5;
      const g = 0.38 + t * 0.3;
      const soil = [0.3, 0.25, 0.2];
      mix3(o, soil, [g * 1.02, g, g * 0.94], Math.min(1, peb * 3));
      o[0] += n.v(u * 300, v * 300) * 0.05; o[3] = Math.sqrt(peb) * 1.2; o[4] = 0.92 - peb * 0.2;
    }, 3);
  },
  soil(size) {
    const n = new TNoise(71), m = new TNoise(72);
    return set('soil', size, (u, v, o) => {
      const b = n.fbm(u, v, 8, 6), clump = m.fbm(u, v, 24, 3), stone = n.v(u * 150, v * 150) > 0.95 ? 1 : 0;
      const c = 0.28 + b * 0.12;
      o[0] = c * 1.15 + stone * 0.15; o[1] = c * 0.88 + stone * 0.14; o[2] = c * 0.62 + stone * 0.12;
      o[3] = b * 0.8 + clump * 0.5 + stone * 0.6; o[4] = 0.95;
    }, 2.5);
  },
  grass(size) {
    const n = new TNoise(75), m = new TNoise(76), b = new TNoise(77, 128);
    return set('grass', size, (u, v, o) => {
      const big = n.fbm(u, v, 4, 4), blade = b.v(u * 128, v * 40), blade2 = b.v(u * 90 + 7, v * 140), dry = clamp((m.fbm(u, v, 3, 4) - 0.5) * 2.5, 0, 1);
      const bl = Math.max(blade, blade2);
      const g = 0.6 + bl * 0.4;
      o[0] = (0.14 + dry * 0.16 + big * 0.05) * g; o[1] = (0.42 + dry * 0.1 + big * 0.12) * g; o[2] = (0.07 + dry * 0.04) * g;
      o[3] = bl * 0.8 + big * 0.3; o[4] = 0.9;
    }, 1.6);
  },
  mud(size) {
    const n = new TNoise(81), m = new TNoise(82);
    return set('mud', size, (u, v, o) => {
      const b = n.fbm(u, v, 6, 5), wet = m.fbm(u, v, 4, 4), pud = wet > 0.58 ? 1 : 0;
      const c = 0.2 + b * 0.08;
      o[0] = c * 1.15; o[1] = c * 0.9; o[2] = c * 0.65;
      if (pud) { o[0] *= 0.7; o[1] *= 0.7; o[2] *= 0.72; }
      o[3] = pud ? 0.1 : b * 1.1; o[4] = pud ? 0.08 : lerp(0.55, 0.3, wet);
    }, 2);
  },
  straw(size) {
    const r = rng(91), n = new TNoise(92);
    const c = canvas(size, size), ctx = c.getContext('2d');
    ctx.fillStyle = '#6a5228'; ctx.fillRect(0, 0, size, size);
    const hc = canvas(size, size), hx = hc.getContext('2d'); hx.fillStyle = '#000'; hx.fillRect(0, 0, size, size);
    for (let i = 0; i < size * 9; i++) {
      const x = r() * size, y = r() * size, a = r() * Math.PI, l = size * (0.04 + r() * 0.12), w = 1 + r() * 2.2;
      const t = r(); const col = `rgb(${190 + t * 50 | 0},${150 + t * 50 | 0},${70 + t * 40 | 0})`;
      for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); ctx.stroke();
        hx.strokeStyle = `rgba(255,255,255,${0.3 + i / (size * 9) * 0.7})`; hx.lineWidth = w; hx.beginPath(); hx.moveTo(x + ox, y + oy); hx.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); hx.stroke();
      }
    }
    void n;
    const hd = hx.getImageData(0, 0, size, size).data, hgt = new Float32Array(size * size);
    for (let i = 0; i < hgt.length; i++) hgt[i] = hd[i * 4] / 255;
    const rg = new Uint8ClampedArray(size * size * 4); for (let i = 0; i < hgt.length; i++) { rg[i * 4 + 1] = 230; rg[i * 4 + 3] = 255; }
    return { map: canvasTex(c, true), normalMap: toTex(normalFromHeight(hgt, size, 4), size, false), roughnessMap: toTex(rg, size, false) };
  },
  cardboard(size) {
    const n = new TNoise(101);
    return set('cardboard', size, (u, v, o) => {
      const flute = Math.sin(v * Math.PI * 2 * 40) * 0.5 + 0.5, b = n.fbm(u, v, 6, 4), stain = clamp((n.fbm(u, v, 2, 3) - 0.55) * 3, 0, 1);
      const c = 0.62 + b * 0.08;
      mix3(o, [c * 0.92, c * 0.72, c * 0.47], [c * 0.6, c * 0.42, c * 0.25], stain * 0.8);
      o[3] = flute * 0.25 + b * 0.2; o[4] = 0.95;
    }, 1);
  },
  rubber(size) {
    const n = new TNoise(111);
    return set('rubber', size, (u, v, o) => {
      const du = (u * 16) % 1, dv = (v * 16) % 1, dot = Math.hypot(du - 0.5, dv - 0.5) < 0.22 ? 1 : 0;
      const c = 0.1 + n.fbm(u, v, 8, 3) * 0.05;
      o[0] = c; o[1] = c; o[2] = c * 1.05; o[3] = dot; o[4] = 0.75 - dot * 0.1;
    }, 2.5);
  },
  plastic(size) {
    const n = new TNoise(121);
    return set('plastic', size, (u, v, o) => {
      const rib = (u * 10) % 1 < 0.15 || (v * 10) % 1 < 0.15 ? 1 : 0;
      const c = n.fbm(u, v, 6, 3) * 0.05;
      o[0] = 0.12 + c; o[1] = 0.32 + c; o[2] = 0.52 + c; o[3] = rib; o[4] = 0.4;
    }, 2);
  },
  snow(size) {
    const n = new TNoise(131);
    return set('snow', size, (u, v, o) => {
      const b = n.fbm(u, v, 6, 5), sp = n.v(u * 400, v * 400) > 0.96 ? 1 : 0;
      const c = 0.86 + b * 0.1;
      o[0] = c * 0.97; o[1] = c * 0.99; o[2] = c * 1.03 > 1 ? 1 : c * 1.03; o[3] = b; o[4] = 0.7 - sp * 0.5;
    }, 1);
  },
  asphalt(size) {
    const n = new TNoise(141);
    return set('asphalt', size, (u, v, o) => {
      const b = n.fbm(u, v, 16, 4), g = n.v(u * 260, v * 260), line = Math.abs(u - 0.5) < 0.012 && (v * 3) % 1 < 0.55 ? 1 : 0;
      const c = 0.16 + b * 0.07 + (g > 0.8 ? 0.1 : 0);
      o[0] = c; o[1] = c; o[2] = c * 1.03;
      if (line) { o[0] = 0.75; o[1] = 0.7; o[2] = 0.55; }
      o[3] = g * 0.4 + b * 0.3; o[4] = 0.88;
    }, 2);
  },
  brick(size) {
    const n = new TNoise(151);
    return set('brick', size, (u, v, o) => {
      const row = Math.floor(v * 8), bu = (u * 4 + (row % 2) * 0.5) % 1, bv = (v * 8) % 1;
      const mortar = bu < 0.04 || bv < 0.08;
      const id = Math.floor(u * 4 + (row % 2) * 0.5) * 13 + row * 7;
      const t = ((Math.sin(id * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const c = n.fbm(u, v, 12, 4);
      if (mortar) { o[0] = 0.55; o[1] = 0.52; o[2] = 0.47; o[3] = -0.5; }
      else { o[0] = 0.45 + t * 0.12 + c * 0.1; o[1] = 0.22 + t * 0.06 + c * 0.05; o[2] = 0.16 + c * 0.04; o[3] = c * 0.4; }
      o[4] = 0.9;
    }, 2);
  },
  potatoPile(size) {
    // Seamless "sea of potatoes" used on heap bodies under the instanced top layers.
    const r = rng(161), n = new TNoise(162);
    const blobs = []; for (let i = 0; i < 420; i++) blobs.push([r(), r(), 0.025 + r() * 0.02, r() * 0.6 + 0.4, r()]);
    const G = 16, grid = Array.from({ length: G * G }, () => []);
    blobs.forEach(b => grid[Math.floor(b[1] * G) * G + Math.floor(b[0] * G)].push(b));
    return set('potatoPile', size, (u, v, o) => {
      let best = 0, tone = 0.5; const gx = Math.floor(u * G), gy = Math.floor(v * G);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const b of grid[((gy + j + G) % G) * G + (gx + i + G) % G]) {
        let dx = Math.abs(u - b[0]); dx = Math.min(dx, 1 - dx); let dy = Math.abs(v - b[1]); dy = Math.min(dy, 1 - dy);
        const e = 1 - (dx * dx / (b[2] * b[2] * 1.4) + dy * dy / (b[2] * b[2] * b[3] * b[3] + 0.0001)) * 0.8;
        if (e > best) { best = e; tone = b[4]; }
      }
      const h = clamp(best, 0, 1), sh = Math.sqrt(h);
      const skin = n.v(u * 220, v * 220);
      o[0] = (0.6 + tone * 0.15 + skin * 0.05) * (0.15 + sh * 0.85); o[1] = (0.44 + tone * 0.1 + skin * 0.04) * (0.15 + sh * 0.85); o[2] = (0.24 + tone * 0.06) * (0.15 + sh * 0.85);
      o[3] = sh * 1.6; o[4] = 0.8;
    }, 3);
  },
  fabricPlaid(size) {
    const n = new TNoise(171);
    return set('plaid', size, (u, v, o) => {
      const su = (u * 6) % 1, sv = (v * 6) % 1;
      const band = (x) => (x < 0.25 ? 1 : x < 0.32 ? 0.3 : x > 0.6 && x < 0.66 ? 0.6 : 0);
      const a = band(su), b = band(sv);
      const weave = ((Math.floor(u * size / 2) + Math.floor(v * size / 2)) % 2) * 0.06;
      const base = [0.55, 0.1, 0.09], dark = [0.08, 0.1, 0.14], light = [0.8, 0.7, 0.55];
      mix3(o, base, dark, clamp(a * 0.5 + b * 0.5, 0, 1) * 0.85);
      if ((a === 0.6 || b === 0.6)) mix3(o, o.slice(0, 3), light, 0.45);
      const nn = n.v(u * 400, v * 400) * 0.06; o[0] += nn - weave; o[1] += nn - weave; o[2] += nn - weave;
      o[3] = weave * 6 + nn; o[4] = 0.92;
    }, 1.2);
  },
  fabricCanvas(size) { // worn warehouse jacket (dark olive canvas)
    const n = new TNoise(181);
    return set('canvas', size, (u, v, o) => {
      const tw = Math.sin((u + v) * size * 0.8) * 0.5 + 0.5, wear = clamp((n.fbm(u, v, 3, 4) - 0.55) * 3, 0, 1), dirt = clamp(n.fbm(u, v, 5, 3) - 0.5, 0, 1);
      o[0] = 0.26 + wear * 0.12 - dirt * 0.1; o[1] = 0.27 + wear * 0.1 - dirt * 0.1; o[2] = 0.18 + wear * 0.08 - dirt * 0.08;
      o[3] = tw * 0.3; o[4] = 0.95;
    }, 1.2);
  },
  denim(size) {
    const n = new TNoise(191);
    return set('denim', size, (u, v, o) => {
      const tw = Math.sin((u * 1.0 - v) * size * 1.2) * 0.5 + 0.5, fade = n.fbm(u, v, 3, 4);
      o[0] = 0.18 + tw * 0.05 + fade * 0.08; o[1] = 0.2 + tw * 0.05 + fade * 0.08; o[2] = 0.24 + tw * 0.06 + fade * 0.06;
      o[3] = tw * 0.3; o[4] = 0.92;
    }, 1);
  },
  skin(size) {
    const n = new TNoise(201), m = new TNoise(202);
    return set('skin', size, (u, v, o) => {
      const b = n.fbm(u, v, 10, 4), pore = m.v(u * 260, v * 260), blot = m.fbm(u, v, 4, 3);
      o[0] = 0.78 + b * 0.06 + blot * 0.05; o[1] = 0.58 + b * 0.04; o[2] = 0.48 + b * 0.03;
      o[3] = pore * 0.4 + b * 0.2; o[4] = 0.55 + pore * 0.15;
    }, 0.8);
  },
  leather(size) {
    const n = new TNoise(211);
    return set('leather', size, (u, v, o) => {
      const b = n.fbm(u, v, 16, 5), c = 0.22 + b * 0.08;
      o[0] = c * 1.2; o[1] = c * 0.85; o[2] = c * 0.6; o[3] = b; o[4] = 0.6 + b * 0.2;
    }, 1.5);
  },
};

// ---------- Single images (signs, documents, decals) ----------
export function shoePrintTexture() {
  if (cache.has('shoe')) return cache.get('shoe');
  // Work boot sole: heel + forefoot lugs in an alpha mask. R=depth(height), A=coverage
  const W = 128, H = 256, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  x.save(); x.translate(W / 2, H / 2);
  const sole = new Path2D();
  sole.moveTo(-34, 70); sole.bezierCurveTo(-46, 20, -48, -40, -36, -88); sole.bezierCurveTo(-26, -122, 26, -124, 38, -88);
  sole.bezierCurveTo(50, -40, 40, 10, 30, 30); sole.bezierCurveTo(26, 48, 30, 70, 30, 84); sole.bezierCurveTo(30, 116, -32, 118, -34, 84); sole.closePath();
  x.clip(sole);
  x.fillStyle = 'rgba(255,255,255,0.35)'; x.fill(sole);
  x.fillStyle = '#fff';
  for (let row = -5; row < 7; row++) for (let col = -2; col <= 2; col++) {
    const yy = row * 18 - 20, xx = col * 18 + (row % 2) * 9;
    if (yy > 40 && yy < 58) continue; // arch gap between forefoot and heel
    x.save(); x.translate(xx, yy); x.rotate(row % 2 ? 0.5 : -0.5); x.fillRect(-6, -4, 12, 8); x.restore();
  }
  x.restore();
  const t = canvasTex(c, false); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  cache.set('shoe', t);
  return t;
}

export function textCanvas(w, h, draw) { const c = canvas(w, h); draw(c.getContext('2d'), w, h); return c; }

export function signTexture() {
  return canvasTex(textCanvas(1024, 256, (x, w, h) => {
    const r = rng(7), n = new TNoise(8);
    x.fillStyle = '#e9dcc0'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#7a1c12'; x.lineWidth = 14; x.strokeRect(14, 14, w - 28, h - 28);
    x.fillStyle = '#7a1c12'; x.textAlign = 'center'; x.font = '900 86px Georgia, serif'; x.fillText('BOUCHARD', w / 2, 112);
    x.font = '700 44px Georgia, serif'; x.fillText('POTATO STORAGE — EST. 1987', w / 2, 184);
    // rust & peeling
    const id = x.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const i = (y * w + xx) * 4, f = n.fbm(xx / w, y / h, 8, 5), streak = n.fbm(xx / w * 3, y / h * 0.3, 8, 3);
      const rust = clamp((f - 0.56) * 5, 0, 1) + clamp((streak - 0.6) * 3, 0, 1) * (y / h);
      id.data[i] = lerp(id.data[i], 110, rust); id.data[i + 1] = lerp(id.data[i + 1], 55, rust); id.data[i + 2] = lerp(id.data[i + 2], 30, rust);
      if (r() < 0.002) { id.data[i] *= 0.6; id.data[i + 1] *= 0.6; id.data[i + 2] *= 0.6; }
    }
    x.putImageData(id, 0, 0);
  }), true);
}

export function paperTexture(lines, opts = {}) {
  const { w = 512, h = 680, bg = '#efe6cf', ink = '#2a2420', title = null, font = '22px "Courier New", monospace', hand = false, stain = true } = opts;
  return canvasTex(textCanvas(w, h, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    const n = new TNoise(lines.length * 13 + 5);
    const id = x.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const i = (y * w + xx) * 4, f = n.fbm(xx / w, y / h, 4, 4) * 30 - 15; id.data[i] += f; id.data[i + 1] += f; id.data[i + 2] += f * 1.2; }
    x.putImageData(id, 0, 0);
    if (stain) { x.strokeStyle = 'rgba(120,70,30,0.25)'; x.lineWidth = 9; x.beginPath(); x.arc(w * 0.75, h * 0.8, 52, 0.3, 5.9); x.stroke(); }
    x.fillStyle = ink; let y = 60;
    if (title) { x.font = hand ? 'italic 700 30px "Segoe Script", "Brush Script MT", cursive' : '700 28px Georgia, serif'; x.fillText(title, 36, y); y += 44; }
    x.font = hand ? 'italic 22px "Segoe Script", "Brush Script MT", cursive' : font;
    for (const ln of lines) { x.fillText(ln, 36, y); y += hand ? 34 : 30; }
  }), true);
}
