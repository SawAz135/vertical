// Shared math / random / event helpers. Everything deterministic goes through these
// so every client in a co-op session builds the exact same warehouse.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smooth = t => t * t * (3 - 2 * t);
export const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
export const easeInCubic = t => t * t * t;
export const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const easeOutElastic = t => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1);
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const dampAngle = (a, b, lambda, dt) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
};
export const TAU = Math.PI * 2;

// 32-bit integer hash (identical in the GLSL potato shader: see potatoes.js)
export function hash32(x) {
  x = x | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}
export const hash01 = x => hash32(x) / 4294967296;

// Mulberry32 seeded RNG
export function rng(seed) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a, b) => a + (b - a) * r();
  r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.sign = () => (r() < 0.5 ? -1 : 1);
  r.gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  };
  return r;
}

// Smooth 3D value noise; the same formula exists in GLSL (potato vertex shader).
function fract(x) { return x - Math.floor(x); }
function h3(x, y, z) {
  // sin-free hash, mirrored exactly in GLSL using float math
  let px = fract(x * 0.1031), py = fract(y * 0.1031), pz = fract(z * 0.1031);
  // p += dot(p, p.yzx + 33.33)
  const dd = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  px += dd; py += dd; pz += dd;
  return fract((px + py) * pz);
}
export function vnoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const a = h3(ix, iy, iz), b = h3(ix + 1, iy, iz), c = h3(ix, iy + 1, iz), d = h3(ix + 1, iy + 1, iz);
  const e = h3(ix, iy, iz + 1), f = h3(ix + 1, iy, iz + 1), g = h3(ix, iy + 1, iz + 1), h = h3(ix + 1, iy + 1, iz + 1);
  const x1 = lerp(a, b, ux), x2 = lerp(c, d, ux), x3 = lerp(e, f, ux), x4 = lerp(g, h, ux);
  return lerp(lerp(x1, x2, uy), lerp(x3, x4, uy), uz) * 2 - 1;
}
export const GLSL_NOISE = /* glsl */`
float wmpH3(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float wmpNoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); vec3 u = f*f*(3.0-2.0*f);
  float a=wmpH3(i), b=wmpH3(i+vec3(1,0,0)), c=wmpH3(i+vec3(0,1,0)), d=wmpH3(i+vec3(1,1,0));
  float e=wmpH3(i+vec3(0,0,1)), f2=wmpH3(i+vec3(1,0,1)), g=wmpH3(i+vec3(0,1,1)), h=wmpH3(i+vec3(1,1,1));
  return mix(mix(mix(a,b,u.x),mix(c,d,u.x),u.y), mix(mix(e,f2,u.x),mix(g,h,u.x),u.y), u.z)*2.0-1.0;
}`;
// 2D value noise for textures / terrain
export function vnoise2(x, y) { return vnoise3(x, y, 0.5); }
export function fbm2(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise3(x * f, y * f, i * 7.13); f *= 2.03; a *= 0.5; }
  return s;
}

export class Emitter {
  constructor() { this._l = new Map(); }
  on(ev, fn) { if (!this._l.has(ev)) this._l.set(ev, new Set()); this._l.get(ev).add(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this._l.get(ev)?.delete(fn); }
  emit(ev, ...a) { this._l.get(ev)?.forEach(fn => { try { fn(...a); } catch (e) { console.error(e); } }); }
}

export const storage = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};

export const isTouch = () => (typeof window !== 'undefined') && ('ontouchstart' in window || navigator.maxTouchPoints > 0) && matchMedia('(pointer:coarse)').matches;
export const fmtMoney = v => `${Math.round(v).toLocaleString('fr-FR')} ₣`;
