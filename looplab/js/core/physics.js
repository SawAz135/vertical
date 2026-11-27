// LOOPLAB — small 2D rigid-circle physics: circles, static/moving capsules, pegs,
// sweep-and-prune broadphase, restitution and friction, contact callbacks.
import { clamp, closestOnSeg, TAU } from './util.js';

let UID = 1;
export class Body {
  constructor(x, y, r, o = {}) {
    this.id = UID++;
    this.x = x; this.y = y; this.vx = o.vx || 0; this.vy = o.vy || 0;
    this.r = r; this.m = o.m ?? r * r;
    this.e = o.e ?? 0.6; this.f = o.f ?? 0.05;
    this.col = o.col || '#fff';
    this.alive = true; this.static = !!o.static;
    this.data = o.data || {};
    this.spin = 0; this.ang = 0;
    this.press = 0; // accumulated squeeze this step (for crushers)
    this.n1x = 0; this.n1y = 0; this.contacts = 0;
  }
}

/** Capsule segment. Moving segments carry their velocity so hits transfer momentum. */
export class Seg {
  constructor(ax, ay, bx, by, o = {}) {
    this.ax = ax; this.ay = ay; this.bx = bx; this.by = by;
    this.th = o.th ?? 4;
    this.e = o.e ?? 0.5;
    this.vx = 0; this.vy = 0; // linear velocity
    this.cx = 0; this.cy = 0; this.w = 0; // rotation about (cx,cy) with angular velocity w
    this.kin = !!o.kin;
    this.tag = o.tag || '';
    this.active = true;
    this.oneWay = o.oneWay || null;
  }
  set(ax, ay, bx, by, dt) {
    if (dt) { this.vx = ((ax + bx) / 2 - (this.ax + this.bx) / 2) / dt; this.vy = ((ay + by) / 2 - (this.ay + this.by) / 2) / dt; }
    this.ax = ax; this.ay = ay; this.bx = bx; this.by = by;
  }
  velAt(px, py) {
    return [this.vx - this.w * (py - this.cy), this.vy + this.w * (px - this.cx)];
  }
}

export class World {
  constructor(o = {}) {
    this.g = o.g ?? 1400;
    this.bodies = [];
    this.segs = [];
    this.pegs = []; // {x,y,r,e,hit:0}
    this.iter = o.iter ?? 3;
    this.damp = o.damp ?? 0.02;
    this.onHit = null; // (a,b,imp)
    this.onSeg = null; // (body, seg, imp, nx, ny)
    this.onPeg = null; // (body, peg, imp)
    this.maxV = o.maxV ?? 4000;
    this.bounds = o.bounds || null; // {x0,y0,x1,y1,e}
  }
  add(b) { this.bodies.push(b); return b; }
  addSeg(s) { this.segs.push(s); return s; }
  addPeg(x, y, r, e = 0.55) { const p = { x, y, r, e, hit: 0 }; this.pegs.push(p); return p; }
  clean() { if (this.bodies.some((b) => !b.alive)) this.bodies = this.bodies.filter((b) => b.alive); }

  step(dt) {
    const B = this.bodies;
    const dd = Math.exp(-this.damp * dt);
    for (const b of B) {
      if (b.static || !b.alive) continue;
      b.vy += this.g * dt;
      b.vx *= dd; b.vy *= dd;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > this.maxV) { b.vx *= this.maxV / sp; b.vy *= this.maxV / sp; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.ang += b.spin * dt;
      b.press = 0; b.contacts = 0;
    }
    for (let it = 0; it < this.iter; it++) {
      this.collideBodies(it === 0);
      this.collideSegs(it === 0);
      if (this.pegs.length) this.collidePegs(it === 0);
      if (this.bounds) this.collideBounds();
    }
  }

  collideBodies(report) {
    const B = this.bodies;
    B.sort((a, b) => a.x - a.r - (b.x - b.r));
    const n = B.length;
    for (let i = 0; i < n; i++) {
      const a = B[i];
      if (!a.alive) continue;
      const ax1 = a.x + a.r;
      for (let j = i + 1; j < n; j++) {
        const b = B[j];
        if (b.x - b.r > ax1) break;
        if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = rr - d;
        const ima = a.static ? 0 : 1 / a.m, imb = b.static ? 0 : 1 / b.m, ims = ima + imb;
        if (ims === 0) continue;
        const corr = (pen / ims) * 0.8;
        a.x -= nx * corr * ima; a.y -= ny * corr * ima;
        b.x += nx * corr * imb; b.y += ny * corr * imb;
        a.press += pen * (b.static ? 2 : 1); b.press += pen * (a.static ? 2 : 1);
        a.contacts++; b.contacts++;
        const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn > 0) continue;
        const e = Math.min(a.e, b.e);
        const jn = (-(1 + e) * vn) / ims;
        a.vx -= jn * nx * ima; a.vy -= jn * ny * ima;
        b.vx += jn * nx * imb; b.vy += jn * ny * imb;
        // friction
        const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
        const jt = clamp(-vt / ims, -jn * 0.1, jn * 0.1);
        a.vx -= jt * tx * ima; a.vy -= jt * ty * ima;
        b.vx += jt * tx * imb; b.vy += jt * ty * imb;
        if (report && this.onHit && jn > 0) this.onHit(a, b, jn / Math.min(a.m, b.m), nx, ny);
      }
    }
  }

  collideSegs(report) {
    for (const s of this.segs) {
      if (!s.active) continue;
      const minx = Math.min(s.ax, s.bx) - s.th, maxx = Math.max(s.ax, s.bx) + s.th;
      const miny = Math.min(s.ay, s.by) - s.th, maxy = Math.max(s.ay, s.by) + s.th;
      for (const b of this.bodies) {
        if (b.static || !b.alive) continue;
        if (b.x + b.r < minx || b.x - b.r > maxx || b.y + b.r < miny || b.y - b.r > maxy) continue;
        const [qx, qy] = closestOnSeg(b.x, b.y, s.ax, s.ay, s.bx, s.by);
        let dx = b.x - qx, dy = b.y - qy;
        const d2 = dx * dx + dy * dy, rr = b.r + s.th;
        if (d2 >= rr * rr) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-6) { dx = -(s.by - s.ay); dy = s.bx - s.ax; d = Math.hypot(dx, dy); }
        const nx = dx / d, ny = dy / d;
        if (s.oneWay && nx * s.oneWay[0] + ny * s.oneWay[1] < 0) continue;
        const pen = rr - d;
        b.x += nx * pen; b.y += ny * pen;
        b.press += pen * (s.kin ? 3 : 2);
        b.contacts++;
        const [svx, svy] = s.velAt(qx, qy);
        const rvx = b.vx - svx, rvy = b.vy - svy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const e = Math.min(b.e, s.e);
          b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
          const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
          const fr = Math.min(Math.abs(vt), Math.abs(vn) * b.f * 4) * Math.sign(vt);
          b.vx -= fr * tx; b.vy -= fr * ty;
          if (report && this.onSeg) this.onSeg(b, s, -vn, nx, ny);
        }
      }
    }
  }

  collidePegs(report) {
    for (const p of this.pegs) {
      for (const b of this.bodies) {
        if (b.static || !b.alive) continue;
        const dx = b.x - p.x, dy = b.y - p.y, rr = b.r + p.r;
        if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
        b.x += nx * (rr - d); b.y += ny * (rr - d);
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= (1 + p.e) * vn * nx; b.vy -= (1 + p.e) * vn * ny;
          p.hit = 1;
          if (report && this.onPeg) this.onPeg(b, p, -vn);
        }
      }
    }
  }

  collideBounds() {
    const k = this.bounds;
    for (const b of this.bodies) {
      if (b.static || !b.alive) continue;
      const cb = this.onBound;
      if (b.x - b.r < k.x0) { b.x = k.x0 + b.r; if (b.vx < 0) { cb && cb(b, -b.vx); b.vx *= -(k.e ?? 0.5); } }
      if (b.x + b.r > k.x1) { b.x = k.x1 - b.r; if (b.vx > 0) { cb && cb(b, b.vx); b.vx *= -(k.e ?? 0.5); } }
      if (k.y0 != null && b.y - b.r < k.y0) { b.y = k.y0 + b.r; if (b.vy < 0) { cb && cb(b, -b.vy); b.vy *= -(k.e ?? 0.5); } }
      if (k.y1 != null && b.y + b.r > k.y1) { b.y = k.y1 - b.r; if (b.vy > 0) { cb && cb(b, b.vy); b.vy *= -(k.e ?? 0.5); } }
    }
  }

  /** Keeps bodies inside a circle of radius R around (cx,cy). Returns hit list. */
  containCircle(cx, cy, R, e = 0.9, cb) {
    for (const b of this.bodies) {
      if (b.static || !b.alive) continue;
      const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
      if (d + b.r > R) {
        const nx = dx / (d || 1), ny = dy / (d || 1);
        b.x = cx + nx * (R - b.r); b.y = cy + ny * (R - b.r);
        const vn = b.vx * nx + b.vy * ny;
        if (vn > 0) {
          b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
          if (cb) cb(b, vn, nx, ny);
          else if (this.onBound) this.onBound(b, vn);
        }
        b.press += (d + b.r - R) * 2;
      }
    }
  }

  /** Splits a body into two of equal area, pushed apart along `ang`. */
  split(b, ang, kick = 260, minR = 5) {
    const r2 = b.r / Math.SQRT2;
    if (r2 < minR) return null;
    b.alive = false;
    const nx = Math.cos(ang), ny = Math.sin(ang);
    const o = { e: b.e, f: b.f, col: b.col, data: { ...b.data } };
    const c1 = new Body(b.x + nx * r2 * 0.55, b.y + ny * r2 * 0.55, r2, { ...o, vx: b.vx + nx * kick, vy: b.vy + ny * kick });
    const c2 = new Body(b.x - nx * r2 * 0.55, b.y - ny * r2 * 0.55, r2, { ...o, vx: b.vx - nx * kick, vy: b.vy - ny * kick });
    c1.data.born = c2.data.born = 0;
    this.bodies.push(c1, c2);
    return [c1, c2];
  }
}

export function randInCircle(rng, R) {
  const a = rng() * TAU, d = Math.sqrt(rng()) * R;
  return [Math.cos(a) * d, Math.sin(a) * d];
}
