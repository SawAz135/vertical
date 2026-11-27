// LOOPLAB — VFX: pooled particles, shockwaves, lightning, popups, trails.
import { TAU, clamp, lerp, alpha, lighten, easeOutCubic, easeOutBack } from './util.js';
import { glowSprite } from './materials.js';

const P_DOT = 0, P_SPARK = 1, P_SHARD = 2, P_SMOKE = 3, P_CONFETTI = 4;

export class FX {
  constructor(S, cap = 2400) {
    this.S = S;
    this.cap = cap;
    const F = (n) => new Float32Array(n);
    this.x = F(cap); this.y = F(cap); this.vx = F(cap); this.vy = F(cap);
    this.life = F(cap); this.max = F(cap); this.size = F(cap); this.drag = F(cap);
    this.grav = F(cap); this.rot = F(cap); this.vr = F(cap);
    this.type = new Uint8Array(cap);
    this.col = new Array(cap).fill('#fff');
    this.n = 0;
    this.shocks = [];
    this.bolts = [];
    this.pops = [];
    this.rayList = [];
  }
  get on() { return this.S.effects; }

  spawn(type, x, y, vx, vy, life, size, col, drag = 1.5, grav = 0, rot = 0, vr = 0) {
    let i = this.n;
    if (i >= this.cap) {
      // overwrite the oldest-looking slot (cheap ring replacement)
      i = (this._ring = ((this._ring || 0) + 1) % this.cap);
    } else this.n++;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.col[i] = col;
    this.drag[i] = drag; this.grav[i] = grav; this.type[i] = type; this.rot[i] = rot; this.vr[i] = vr;
  }

  /** Multi-layer explosion: hot core dots, streak sparks, shards and smoke. */
  burst(x, y, col, n = 24, speed = 520, o = {}) {
    const r = this.S.rng;
    const q = this.S.fxScale;
    n = Math.max(2, Math.round(n * q));
    const grav = o.grav ?? 600;
    const size = o.size ?? 1;
    for (let k = 0; k < n; k++) {
      const a = r() * TAU, s = speed * (0.25 + r() * 0.85);
      this.spawn(P_DOT, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + r() * 0.55, (2 + r() * 4) * size, k % 3 ? col : lighten(col, 0.6), 2.2, grav);
    }
    if (this.on.sparks) {
      const ns = Math.round(n * 0.7);
      for (let k = 0; k < ns; k++) {
        const a = r() * TAU, s = speed * (0.8 + r() * 1.2);
        this.spawn(P_SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.2 + r() * 0.35, 1.5 + r() * 1.5, lighten(col, 0.5), 3.2, grav * 0.5);
      }
    }
    if (o.shards !== false) {
      const nsh = Math.round(n * 0.35);
      for (let k = 0; k < nsh; k++) {
        const a = r() * TAU, s = speed * (0.3 + r() * 0.7);
        this.spawn(P_SHARD, x, y, Math.cos(a) * s, Math.sin(a) * s - 120, 0.6 + r() * 0.7, (4 + r() * 7) * size, col, 1.2, grav * 1.6, r() * TAU, (r() - 0.5) * 18);
      }
    }
    if (o.smoke) {
      for (let k = 0; k < 6 * q; k++) {
        const a = r() * TAU, s = 40 + r() * 90;
        this.spawn(P_SMOKE, x, y, Math.cos(a) * s, Math.sin(a) * s - 30, 0.9 + r() * 0.8, 18 + r() * 26 * size, o.smoke, 1.2, -40);
      }
    }
  }

  /** Directional spark spray (impacts, grinding). */
  sparks(x, y, dirx, diry, col, n = 8, speed = 600, spread = 0.9) {
    if (!this.on.sparks) return;
    const r = this.S.rng;
    const base = Math.atan2(diry, dirx);
    n = Math.max(1, Math.round(n * this.S.fxScale));
    for (let k = 0; k < n; k++) {
      const a = base + (r() - 0.5) * spread * 2, s = speed * (0.4 + r() * 0.9);
      this.spawn(P_SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.15 + r() * 0.3, 1.2 + r() * 1.6, col, 2.5, 900);
    }
  }

  confetti(x, y, cols, n = 120, speed = 900) {
    const r = this.S.rng;
    n = Math.round(n * this.S.fxScale);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.2, s = speed * (0.4 + r() * 0.8);
      this.spawn(P_CONFETTI, x, y, Math.cos(a) * s, Math.sin(a) * s, 2 + r() * 1.5, 6 + r() * 6, cols[k % cols.length], 1.6, 520, r() * TAU, (r() - 0.5) * 16);
    }
  }

  dust(x, y, col, n = 6, speed = 80) {
    const r = this.S.rng;
    for (let k = 0; k < n * this.S.fxScale; k++) {
      const a = r() * TAU, s = speed * r();
      this.spawn(P_DOT, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + r() * 0.6, 1.5 + r() * 2.5, col, 1.5, 0);
    }
  }

  shock(x, y, col, maxR = 220, life = 0.55, width = 10) {
    if (!this.on.shock) return;
    this.shocks.push({ x, y, col, maxR, life, t: 0, width });
    if (this.shocks.length > 40) this.shocks.shift();
  }

  /** Jagged lightning bolt with branches, regenerated every frame for flicker. */
  lightning(x1, y1, x2, y2, col, life = 0.25, width = 3) {
    if (!this.on.lightning) return;
    this.bolts.push({ x1, y1, x2, y2, col, life, t: 0, width, seed: (this.S.rng() * 1e9) | 0 });
    if (this.bolts.length > 24) this.bolts.shift();
  }

  pop(x, y, text, col, size = 42, life = 0.9) {
    this.pops.push({ x, y, text, col, size, life, t: 0 });
    if (this.pops.length > 30) this.pops.shift();
  }

  /** Light rays burst (god rays) for big reveals. */
  rays(x, y, col, life = 1.6, n = 14, len = 900) {
    this.rayList.push({ x, y, col, life, t: 0, n, len, rot: this.S.rng() * TAU });
  }

  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;
        this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j];
        this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.size[i] = this.size[j]; this.col[i] = this.col[j];
        this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j]; this.type[i] = this.type[j]; this.rot[i] = this.rot[j]; this.vr[i] = this.vr[j];
        continue;
      }
      const d = Math.exp(-this.drag[i] * dt);
      this.vx[i] *= d; this.vy[i] = this.vy[i] * d + this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
      this.rot[i] += this.vr[i] * dt;
      i++;
    }
    for (const a of [this.shocks, this.bolts, this.pops, this.rayList]) {
      for (let k = a.length - 1; k >= 0; k--) {
        a[k].t += dt;
        if (a[k].t >= a[k].life) a.splice(k, 1);
      }
    }
  }

  draw(g) {
    const S = this.S;
    // rays (behind)
    for (const r of this.rayList) {
      const k = r.t / r.life;
      const a = Math.sin(k * Math.PI) * 0.5;
      g.save();
      g.translate(r.x, r.y);
      g.rotate(r.rot + k * 0.6);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < r.n; i++) {
        g.rotate(TAU / r.n);
        const gr = g.createLinearGradient(0, 0, r.len, 0);
        gr.addColorStop(0, alpha(r.col, a));
        gr.addColorStop(1, alpha(r.col, 0));
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(r.len, -r.len * 0.07); g.lineTo(r.len, r.len * 0.07); g.closePath(); g.fill();
      }
      g.restore();
    }
    // shockwaves
    for (const s of this.shocks) {
      const k = s.t / s.life;
      const e = easeOutCubic(k);
      const rad = s.maxR * e;
      g.globalCompositeOperation = S.theme.dark ? 'lighter' : 'source-over';
      g.strokeStyle = alpha(s.col, (1 - k) * 0.9);
      g.lineWidth = s.width * (1 - k) + 1;
      g.beginPath(); g.arc(s.x, s.y, rad, 0, TAU); g.stroke();
      g.strokeStyle = alpha(lighten(s.col, 0.6), (1 - k) * 0.5);
      g.lineWidth = Math.max(1, s.width * 0.35 * (1 - k));
      g.beginPath(); g.arc(s.x, s.y, rad * 0.82, 0, TAU); g.stroke();
      g.globalCompositeOperation = 'source-over';
    }
    // particles
    const add = S.theme.dark;
    for (let i = 0; i < this.n; i++) {
      const k = this.life[i] / this.max[i];
      const t = this.type[i];
      const x = this.x[i], y = this.y[i], sz = this.size[i], col = this.col[i];
      if (t === P_SPARK) {
        g.globalCompositeOperation = add ? 'lighter' : 'source-over';
        g.strokeStyle = col;
        g.globalAlpha = Math.min(1, k * 2);
        g.lineWidth = sz;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - this.vx[i] * 0.03, y - this.vy[i] * 0.03); g.stroke();
      } else if (t === P_DOT) {
        g.globalCompositeOperation = add ? 'lighter' : 'source-over';
        g.globalAlpha = Math.min(1, k * 1.6);
        const s = sz * (0.5 + k * 0.5);
        if (add) g.drawImage(glowSprite(col), x - s * 2.2, y - s * 2.2, s * 4.4, s * 4.4);
        g.fillStyle = col;
        g.fillRect(x - s * 0.5, y - s * 0.5, s, s);
      } else if (t === P_SHARD) {
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = Math.min(1, k * 2.5);
        g.fillStyle = col;
        g.save(); g.translate(x, y); g.rotate(this.rot[i]);
        g.beginPath(); g.moveTo(-sz * 0.6, -sz * 0.4); g.lineTo(sz * 0.7, -sz * 0.1); g.lineTo(-sz * 0.1, sz * 0.6); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath(); g.moveTo(-sz * 0.6, -sz * 0.4); g.lineTo(sz * 0.7, -sz * 0.1); g.lineTo(0, 0); g.closePath(); g.fill();
        g.restore();
      } else if (t === P_SMOKE) {
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = k * 0.35;
        g.fillStyle = col;
        const s = sz * (1.6 - k * 0.6);
        g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
      } else if (t === P_CONFETTI) {
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = Math.min(1, k * 2);
        g.fillStyle = col;
        g.save(); g.translate(x, y); g.rotate(this.rot[i]);
        g.scale(1, Math.abs(Math.cos(this.rot[i] * 1.7)) + 0.15);
        g.fillRect(-sz * 0.5, -sz * 0.3, sz, sz * 0.6);
        g.restore();
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // lightning
    for (const b of this.bolts) this.drawBolt(g, b);
    // popups
    for (const p of this.pops) {
      const k = p.t / p.life;
      const sc = k < 0.25 ? easeOutBack(k / 0.25, 2.4) : 1;
      g.save();
      g.translate(p.x, p.y - easeOutCubic(k) * 70);
      g.scale(sc, sc);
      g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      S.text(g, p.text, 0, 0, p.size, p.col, { align: 'center', stroke: true });
      g.restore();
    }
    g.globalAlpha = 1;
  }

  drawBolt(g, b) {
    let s = b.seed + Math.floor(b.t * 40) * 7919;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const pts = [[b.x1, b.y1], [b.x2, b.y2]];
    let disp = Math.hypot(b.x2 - b.x1, b.y2 - b.y1) * 0.25;
    for (let it = 0; it < 5; it++) {
      for (let i = pts.length - 1; i > 0; i--) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const nx = -(by - ay), ny = bx - ax, L = Math.hypot(nx, ny) || 1;
        const o = (rnd() - 0.5) * disp;
        pts.splice(i, 0, [mx + (nx / L) * o, my + (ny / L) * o]);
      }
      disp *= 0.5;
    }
    const k = 1 - b.t / b.life;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineJoin = 'round';
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); };
    g.strokeStyle = alpha(b.col, 0.35 * k); g.lineWidth = b.width * 5; path(); g.stroke();
    g.strokeStyle = alpha(b.col, 0.8 * k); g.lineWidth = b.width * 1.8; path(); g.stroke();
    g.strokeStyle = `rgba(255,255,255,${k})`; g.lineWidth = b.width * 0.7; path(); g.stroke();
    // a branch
    const bi = Math.floor(pts.length * (0.3 + rnd() * 0.4));
    if (pts[bi]) {
      const [px, py] = pts[bi];
      const ang = Math.atan2(b.y2 - b.y1, b.x2 - b.x1) + (rnd() - 0.5) * 1.6;
      const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1) * 0.3;
      g.strokeStyle = alpha(b.col, 0.6 * k); g.lineWidth = b.width * 0.8;
      g.beginPath(); g.moveTo(px, py);
      let cx = px, cy = py;
      for (let i = 1; i <= 5; i++) {
        cx = px + Math.cos(ang) * len * (i / 5) + (rnd() - 0.5) * 20;
        cy = py + Math.sin(ang) * len * (i / 5) + (rnd() - 0.5) * 20;
        g.lineTo(cx, cy);
      }
      g.stroke();
    }
    g.restore();
  }
}

/** Fading ribbon trail behind a moving object. */
export class Trail {
  constructor(len = 18) { this.len = len; this.pts = []; }
  push(x, y) { this.pts.push(x, y); if (this.pts.length > this.len * 2) this.pts.splice(0, 2); }
  clear() { this.pts.length = 0; }
  draw(g, col, width, add = true, a = 0.8) {
    const p = this.pts, n = p.length / 2;
    if (n < 2) return;
    g.save();
    if (add) g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (let i = 1; i < n; i++) {
      const k = i / n;
      g.strokeStyle = alpha(col, a * k * k);
      g.lineWidth = width * k;
      g.beginPath(); g.moveTo(p[i * 2 - 2], p[i * 2 - 1]); g.lineTo(p[i * 2], p[i * 2 + 1]); g.stroke();
    }
    g.restore();
  }
}

export { lerp, clamp };
