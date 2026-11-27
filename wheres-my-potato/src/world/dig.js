import * as THREE from 'three';

// =====================================================================================
// DIG MAP — the potato desert really caves in where you harvest.
//  • a height-offset grid (0.25 m cells, ±32 m) added to the terrain everywhere it is
//    sampled: physics (player, loose potatoes), the 3D potato carpet, the support floor;
//  • every harvested potato removes a little Gaussian of material;
//  • a granular solver (angle of repose ≈ 34°) runs on the active region only: crater walls
//    that are too steep slump, material slides in from the rim, the hole widens and softens
//    exactly like a pile of potatoes would;
//  • the slump is made visible: potatoes lying on a collapsing rim are released and roll
//    into the crater, extra rollers tumble down the walls;
//  • holes slowly refill over a few minutes (the desert "breathes" back);
//  • the GPU copy (half-float texture) is re-uploaded at most ~12 times per second.
// =====================================================================================
export const DIG = { N: 256, CELL: 0.25, HALF: 32 };
const N = DIG.N, CELL = DIG.CELL, HALF = DIG.HALF;
const REPOSE = Math.tan(34 * Math.PI / 180) * CELL;      // max height step between neighbours
const MAXD = 1.6;                                           // deepest hole

export class DigMap {
  constructor() {
    this.h = new Float32Array(N * N);                       // ≤ 0: removed depth
    this.half = new Uint16Array(N * N).fill(THREE.DataUtils.toHalfFloat(0));
    this.tex = new THREE.DataTexture(this.half, N, N, THREE.RedFormat, THREE.HalfFloatType);
    this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter; this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping; this.tex.needsUpdate = true;
    this.uniforms = { uDig: { value: this.tex }, uDigI: { value: new THREE.Vector3(HALF, N, CELL) } };
    this.box = null;            // active region [i0, j0, i1, j1]
    this.upT = 0; this.dirtyTex = false; this.relaxT = 0; this.refillT = 0; this.any = false;
    this.slides = [];           // cells where material slid this step (for visual rollers)
  }
  // --- sampling (bilinear, world coordinates) ---
  at(x, z) {
    if (!this.any) return 0;
    const fx = (x + HALF) / CELL - 0.5, fz = (z + HALF) / CELL - 0.5;
    if (fx < 0 || fz < 0 || fx >= N - 1 || fz >= N - 1) return 0;
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, h = this.h, k = j * N + i;
    return (h[k] * (1 - tx) + h[k + 1] * tx) * (1 - tz) + (h[k + N] * (1 - tx) + h[k + N + 1] * tx) * tz;
  }
  // --- digging: remove a soft disc of material ---
  dig(x, z, depth = 0.03, radius = 0.32) {
    const ci = (x + HALF) / CELL - 0.5, cj = (z + HALF) / CELL - 0.5, r = radius / CELL, R = Math.ceil(r * 2);
    const i0 = Math.max(1, Math.floor(ci - R)), i1 = Math.min(N - 2, Math.ceil(ci + R)), j0 = Math.max(1, Math.floor(cj - R)), j1 = Math.min(N - 2, Math.ceil(cj + R));
    if (i0 > i1 || j0 > j1) return;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d2 = ((i - ci) ** 2 + (j - cj) ** 2) / (r * r), k = j * N + i;
      this.h[k] = Math.max(-MAXD, this.h[k] - depth * Math.exp(-d2 * 1.6));
    }
    this._grow(i0, j0, i1, j1); this.any = true; this.dirtyTex = true;
  }
  _grow(i0, j0, i1, j1) {
    const p = 6; i0 = Math.max(1, i0 - p); j0 = Math.max(1, j0 - p); i1 = Math.min(N - 2, i1 + p); j1 = Math.min(N - 2, j1 + p);
    if (!this.box) this.box = [i0, j0, i1, j1];
    else { const b = this.box; b[0] = Math.min(b[0], i0); b[1] = Math.min(b[1], j0); b[2] = Math.max(b[2], i1); b[3] = Math.max(b[3], j1); }
  }
  // --- granular relaxation on the active region (mass-conserving) ---
  _relax() {
    const b = this.box; if (!b) return 0;
    const h = this.h; let moved = 0, i0 = 1e9, j0 = 1e9, i1 = -1, j1 = -1;
    this.slides.length = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let j = b[1]; j <= b[3]; j++) for (let i = b[0]; i <= b[2]; i++) {
        const k = j * N + i, hc = h[k];
        // the highest of the 4 neighbours gives material down to this cell
        let best = -1, bd = REPOSE;
        const d1 = h[k - 1] - hc, d2 = h[k + 1] - hc, d3 = h[k - N] - hc, d4 = h[k + N] - hc;
        if (d1 > bd) { bd = d1; best = k - 1; } if (d2 > bd) { bd = d2; best = k + 1; } if (d3 > bd) { bd = d3; best = k - N; } if (d4 > bd) { bd = d4; best = k + N; }
        if (best < 0) continue;
        const m = (bd - REPOSE) * 0.45; h[best] -= m; h[k] += m; moved += m;
        if (m > 0.012 && this.slides.length < 24) this.slides.push(best, k, m);
        if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j;
      }
    }
    if (moved > 1e-4) { this._grow(i0, j0, i1, j1); this.dirtyTex = true; }
    return moved;
  }
  // --- slow refill (the desert closes its holes over a few minutes) ---
  _refill(dt) {
    const b = this.box; if (!b) return;
    const k = Math.exp(-dt / 140), h = this.h; let deepest = 0;
    for (let j = b[1]; j <= b[3]; j++) for (let i = b[0]; i <= b[2]; i++) { const q = j * N + i; h[q] *= k; if (h[q] > -0.002) h[q] = 0; else if (h[q] < deepest) deepest = h[q]; }
    this.dirtyTex = true;
    if (deepest === 0) { this.box = null; this.any = false; }
  }
  cellPos(k, out) { const i = k % N, j = (k / N) | 0; return out.set((i + 0.5) * CELL - HALF, 0, (j + 0.5) * CELL - HALF); }
  update(dt) {
    if (!this.box) return;
    this.relaxT -= dt; if (this.relaxT <= 0) { this.relaxT = 1 / 30; this.lastMoved = this._relax(); }
    this.refillT -= dt; if (this.refillT <= 0) { this.refillT = 1; this._refill(1); }
    this.upT -= dt;
    if (this.dirtyTex && this.upT <= 0) {
      this.upT = 1 / 12; this.dirtyTex = false;
      const b = this.box || [0, 0, N - 1, N - 1], h = this.h, o = this.half, toH = THREE.DataUtils.toHalfFloat;
      for (let j = Math.max(0, b[1] - 2); j <= Math.min(N - 1, b[3] + 2); j++) for (let i = Math.max(0, b[0] - 2); i <= Math.min(N - 1, b[2] + 2); i++) { const k = j * N + i; o[k] = toH(h[k]); }
      this.tex.needsUpdate = true;
    }
  }
}
export const digMap = new DigMap();

// GLSL: bilinear dig offset at a world xz (hardware-filtered half-float texture)
export const DIG_GLSL = /* glsl */`
uniform sampler2D uDig; uniform vec3 uDigI; // half extent, texels, cell
float wmpDig(vec2 p){
  vec2 uv = (p + uDigI.x) / (2.0 * uDigI.x);
  if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return 0.0;
  return texture(uDig, uv).r;
}`;
