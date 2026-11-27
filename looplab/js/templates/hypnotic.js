// LOOPLAB — hypnotic loops: Évasion d'anneaux, Spirographe, Polyrythme, Mandala.
import { TAU, clamp, lerp, angNorm, alpha, lighten, darken, ramp, easeOutCubic, easeOutBack, smooth, makeCanvas } from '../core/util.js';
import { drawGlow } from '../core/materials.js';

const W = 720, H = 1280;

// =====================================================================================
// ÉVASION D'ANNEAUX — a ball must escape spinning rings; every ring it passes explodes.
// =====================================================================================
export const ringEscape = {
  id: 'ringescape', dropAt: 0.7, name: "Évasion d'anneaux", cat: 'hypno', badge: '📈 Tendance', music: true,
  desc: 'Une balle doit s’échapper d’anneaux qui tournent. Chaque anneau franchi explose.',
  options: [
    { id: 'rings', label: "Nombre d'anneaux", type: 'choice', def: 16, choices: [[10, '10'], [16, '16'], [24, '24'], [40, '40']] },
    { id: 'gravity', label: 'Gravité', type: 'bool', def: true },
  ],
  hook: (S) => `Peut-elle franchir les ${S.opts.rings || 16} anneaux ?`,
  init(S) {
    S.N = S.opts.rings || 16;
    S.k = 0; S.kAnim = 0;
    S.cx = W / 2; S.cy = H / 2 + 70;
    S.R0 = 140; S.sp = Math.max(18, Math.min(42, 470 / S.N));
    const r = S.rng;
    S.rings = Array.from({ length: S.N }, (_, j) => ({
      ang: r() * TAU,
      w: (j % 2 ? -1 : 1) * (0.7 + j * 0.035 + r() * 0.3),
      gap: 0.85 - Math.min(0.3, j * 0.012),
      hit: 0,
    }));
    S.pb = { x: S.cx, y: S.cy - 30, vx: r.range(-200, 200), vy: 0, r: 13 };
    S.trail = S.newTrail(18);
    S.escaped = false; S.escT = 0;
    S.lastHit = -1;
    S.level = 1; S.levelStart = 0; S.levelEnd = S.dropT;
    S.setCounter(S.N, { style: 'center', size: 84, y: S.cy, alpha: 0.35 });
  },
  radius(S, j) { return S.R0 + (j - S.kAnim) * S.sp; },
  update(S, dt) {
    const b = S.pb;
    const g = S.opts.gravity === false ? 0 : 1300;
    const T = Math.max(1.5, S.levelEnd - S.levelStart - 0.15);
    const target = S.N * clamp(Math.pow((S.vt - S.levelStart) / T, 1.25), 0, 1);
    const deficit = target - S.k;
    for (let j = S.k; j < S.N; j++) {
      const rg = S.rings[j];
      rg.ang += rg.w * dt * (1 + (S.dropped ? 0.6 : 0));
      rg.hit = Math.max(0, rg.hit - dt * 4);
    }
    S.kAnim += (S.k - S.kAnim) * Math.min(1, dt * 10);
    if (S.escaped) {
      S.escT += dt;
      b.vy += g * 0.5 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > H + 40 || b.x < -40 || b.x > W + 40) { b.x = S.cx; b.y = S.cy; b.vx = (S.rng() - 0.5) * 900; b.vy = -900; }
      S.trail.push(b.x, b.y);
      if (S.beat) S.fx.shock(S.cx, S.cy, S.col(S.beatIndex), 560, 0.7, 9);
      if (S.escT > 1.4 && S.dur - S.vt > 4) this.nextLevel(S);
      return;
    }
    // steer the current ring's gap toward the ball when behind schedule (looks like a speed-up)
    const cur = S.rings[S.k];
    const ballA = Math.atan2(b.y - S.cy, b.x - S.cx);
    if (deficit > 0.25) {
      const diff = angNorm(ballA - cur.ang);
      cur.ang += clamp(diff, -1, 1) * dt * Math.min(6, 1.5 + deficit * 3);
    }
    cur.g0 = cur.g0 || cur.gap;
    cur.gap = deficit > 0.4 ? Math.min(1.6, cur.gap + dt * 0.6) : cur.gap + (cur.g0 - cur.gap) * Math.min(1, dt * 2);
    b.vy += g * dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    S.trail.push(b.x, b.y);
    const dx = b.x - S.cx, dy = b.y - S.cy, d = Math.hypot(dx, dy);
    const R = this.radius(S, S.k);
    if (d + b.r >= R) {
      const a = Math.atan2(dy, dx);
      const inGap = Math.abs(angNorm(a - cur.ang)) < cur.gap / 2 && deficit > -0.6;
      if (inGap) {
        this.breakRing(S, S.k, a);
        S.k++;
        if (S.k >= S.N) this.escape(S);
      } else {
        const nx = dx / d, ny = dy / d;
        const vn = b.vx * nx + b.vy * ny;
        if (vn > 0) {
          // ring is shrinking toward the ball: add its inward speed
          const e = 1.0 + (deficit > 0 ? 0.02 : 0);
          b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
          // keep the energy lively
          const sp = Math.hypot(b.vx, b.vy);
          const want = clamp(sp, 650, 1200);
          b.vx *= want / sp; b.vy *= want / sp;
          S.rings[S.k].hit = 1;
          S.note(S.k + (S.lastHit = (S.lastHit + 1) % 3), 0.5, 'marimba');
          S.fx.sparks(b.x + nx * b.r, b.y + ny * b.r, -nx, -ny, this.col(S, S.k), 6, 380);
        }
        b.x = S.cx + nx * (R - b.r - 0.5); b.y = S.cy + ny * (R - b.r - 0.5);
      }
    }
    if (S.vt >= S.levelEnd && !S.escaped) {
      while (S.k < S.N) { this.breakRing(S, S.k, ballA); S.k++; }
      this.escape(S);
    }
    S.setCounter(S.N - S.k, { style: 'center', size: 84, y: S.cy, alpha: 0.35 });
  },
  nextLevel(S) {
    // a new, faster cage flies in from outside; it must be cleared before the end
    S.level++;
    S.levelStart = S.vt; S.levelEnd = S.dur - 0.7;
    const r = S.rng;
    S.rings = Array.from({ length: S.N }, (_, j) => ({ ang: r() * TAU, w: (j % 2 ? -1 : 1) * (1.1 + j * 0.05 + r() * 0.4), gap: 0.8, hit: 0 }));
    S.k = 0; S.kAnim = -S.N * 0.7;
    S.escaped = false; S.escT = 0;
    const b = S.pb; b.x = S.cx; b.y = S.cy - 20; b.vx = r.range(-300, 300); b.vy = -200;
    S.trail.clear();
    S.fx.pop(S.cx, S.cy - 60, `NIVEAU ${S.level}`, '#ffffff', 60, 1.2);
    S.sfx('whoosh', { d: 0.8, v: 0.8 });
    S.cols = S.cols.slice(1).concat(S.cols[0]);
  },
  col(S, j) { return ramp(S.cols.slice(0, 4), j / Math.max(1, S.N - 1)); },
  breakRing(S, j, a) {
    const R = this.radius(S, j), col = this.col(S, j);
    const n = Math.round(26 + R / 10);
    // burst along the whole ring: it disintegrates into shards
    for (let i = 0; i < n; i++) {
      const aa = (i / n) * TAU;
      S.fx.burst(S.cx + Math.cos(aa) * R, S.cy + Math.sin(aa) * R, col, 2, 260, { grav: 500 });
    }
    S.fx.shock(S.cx, S.cy, col, R + 160, 0.5, 10);
    S.fx.burst(S.cx + Math.cos(a) * R, S.cy + Math.sin(a) * R, lighten(col, 0.4), 26, 600, { grav: 200 });
    if (S.effects.lightning) S.fx.lightning(S.pb.x, S.pb.y, S.cx + Math.cos(a) * (R + 200), S.cy + Math.sin(a) * (R + 200), col, 0.22, 3);
    S.note(j * 2 + 4, 0.8, 'bell', 1.1);
    S.sfx('shatter', { v: 0.7 });
    S.shake(0.22); S.flash(0.2, col);
  },
  escape(S) {
    if (S.escaped) return;
    S.escaped = true;
    S.fx.rays(S.cx, S.cy, S.col(0), 2.2, 16, 900);
    for (let i = 0; i < 4; i++) S.fx.shock(S.cx, S.cy, S.col(i), 500 + i * 160, 0.7 + i * 0.12, 14);
    S.fx.burst(S.pb.x, S.pb.y, '#ffffff', 80, 1100, { grav: 300 });
    S.flash(0.9, lighten(S.col(0), 0.3)); S.shake(0.8); S.glitch(1); S.punchHook();
    S.sfx('impact', { v: 1 });
    S.setCounter('ÉVADÉE !', { style: 'center', size: 96, y: S.cy, alpha: 1 });
    S.cam.zoom = 1.2; S.camTo(W / 2, H / 2, 1, 3);
  },
  draw(S, g) {
    g.lineCap = 'round';
    for (let j = S.N - 1; j >= S.k; j--) {
      const R = this.radius(S, j);
      if (R > 900) continue;
      const rg = S.rings[j], col = this.col(S, j);
      const w = 7 + rg.hit * 5;
      S.neon(g, () => { g.beginPath(); g.arc(S.cx, S.cy, R, rg.ang + rg.gap / 2, rg.ang + TAU - rg.gap / 2); }, rg.hit > 0 ? lighten(col, rg.hit * 0.5) : col, w);
      // gap end caps
      for (const s of [-1, 1]) {
        const a = rg.ang + (s * rg.gap) / 2;
        S.ball(g, S.cx + Math.cos(a) * R, S.cy + Math.sin(a) * R, w * 0.75, lighten(col, 0.3), { glow: 0.6 });
      }
    }
    const b = S.pb;
    if (S.trails) S.trail.draw(g, S.col(1), b.r * 1.7, S.theme.dark, 0.75);
    S.ball(g, b.x, b.y, b.r, '#ffffff', { vx: b.vx, vy: b.vy, glow: 1 });
  },
};

// =====================================================================================
// SPIROGRAPHE — linked arms spin and draw a perfect rosette; every petal plays a note.
// =====================================================================================
export const spirograph = {
  id: 'spirograph', dropAt: 0.72, name: 'Spirographe', cat: 'hypno', music: true,
  desc: 'Des bras tournent et dessinent une rosace parfaite. Chaque pétale joue une note.',
  options: [
    { id: 'petals', label: 'Pétales', type: 'choice', def: 9, choices: [[5, '5'], [9, '9'], [13, '13'], [21, '21']] },
    { id: 'arms', label: 'Bras', type: 'choice', def: 3, choices: [[2, '2'], [3, '3'], [4, '4']] },
  ],
  hook: 'Regarde la rosace se refermer…',
  init(S) {
    const P = S.opts.petals || 9, A = S.opts.arms || 3;
    const r = S.rng;
    S.cx = W / 2; S.cy = H / 2 + 80;
    // integer frequency ratios guarantee the curve closes exactly when the loop ends
    const f = [1, -(P - 1), P * 2 + 1, -(P * 3 - 1)];
    const L = [220, 95, 42, 20];
    S.arms = Array.from({ length: A }, (_, i) => ({ len: L[i] * (A === 2 && i === 1 ? 1.35 : 1), f: f[i], ph: i === 0 ? -Math.PI / 2 : r() * TAU }));
    S.loops = 1;
    S.trace = makeCanvas(W, H);
    S.tg = S.trace.getContext('2d');
    S.prev = null; S.prevR = 0; S.prevDr = 0;
    S.petal = 0;
    S.done = false;
    S.setCounter(0, { style: 'top', label: 'Pétales :' });
  },
  pen(S, th) {
    let x = S.cx, y = S.cy;
    const joints = [[x, y]];
    for (const a of S.arms) {
      x += Math.cos(a.ph + a.f * th) * a.len;
      y += Math.sin(a.ph + a.f * th) * a.len;
      joints.push([x, y]);
    }
    return joints;
  },
  update(S, dt) {
    const T = Math.max(2, S.dropT);
    const k = clamp(S.vt / T, 0, 1);
    // gentle accelerate/decelerate so the closing moment lands on the drop
    const e = k < 1 ? smooth(k) * 0.15 + k * 0.85 : 1;
    const th = e * TAU * S.loops;
    S.th = th;
    const j = this.pen(S, th);
    const [px, py] = j[j.length - 1];
    if (S.prev && !S.done) {
      const tg = S.tg;
      tg.globalCompositeOperation = S.theme.dark ? 'lighter' : 'source-over';
      tg.lineCap = 'round';
      const col = ramp(S.cols.concat(S.cols[0]), (e * 3) % 1);
      tg.strokeStyle = alpha(col, 0.18); tg.lineWidth = 9;
      tg.beginPath(); tg.moveTo(S.prev[0], S.prev[1]); tg.lineTo(px, py); tg.stroke();
      tg.strokeStyle = col; tg.lineWidth = 2.6;
      tg.beginPath(); tg.moveTo(S.prev[0], S.prev[1]); tg.lineTo(px, py); tg.stroke();
      // petal tips: local maxima of distance from centre
      const R = Math.hypot(px - S.cx, py - S.cy);
      const dr = R - S.prevR;
      if (S.prevDr > 0 && dr <= 0 && R > 150) {
        S.petal++;
        S.note(S.petal % 10, 0.7, 'bell', 1.2);
        S.fx.burst(px, py, lighten(col, 0.3), 14, 300, { grav: 0 });
        S.fx.shock(px, py, col, 70, 0.4, 4);
        S.setCounter(S.petal, { style: 'top', label: 'Pétales :' });
      }
      S.prevDr = dr; S.prevR = R;
    }
    S.prev = [px, py];
    S.joints = j;
    if (!S.done && S.vt >= T) {
      S.done = true;
      S.fx.rays(S.cx, S.cy, S.col(0), 2.4, 18, 800);
      for (let i = 0; i < 4; i++) S.fx.shock(S.cx, S.cy, S.col(i), 420 + i * 120, 0.8, 12);
      S.flash(0.6, lighten(S.col(1), 0.3)); S.shake(0.4); S.punchHook();
      S.sfx('impact', { v: 0.8 });
      S.setCounter('PARFAIT', { style: 'top', label: '' });
    }
    if (S.done && S.beat) S.fx.shock(S.cx, S.cy, S.col(S.beatIndex), 520, 0.6, 6);
  },
  draw(S, g) {
    const dropK = S.done ? 1 + 0.05 * S.song.bass(S.vt) : 1;
    g.save();
    g.translate(S.cx, S.cy);
    if (S.done) g.rotate((S.vt - S.dropT) * 0.25);
    g.scale(dropK, dropK);
    g.translate(-S.cx, -S.cy);
    g.drawImage(S.trace, 0, 0);
    if (S.done && S.theme.dark) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.35 * S.song.energy(S.vt);
      g.drawImage(S.trace, 0, 0);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    g.restore();
    if (S.done) return;
    // arms: brushed metal rods with chrome joints
    const j = S.joints || [];
    for (let i = 1; i < j.length; i++) {
      const [ax, ay] = j[i - 1], [bx, by] = j[i];
      g.strokeStyle = alpha(S.theme.fg, 0.55); g.lineWidth = 9 - i * 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      g.strokeStyle = alpha('#ffffff', 0.35); g.lineWidth = 2;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      S.ball(g, ax, ay, 11 - i * 2, S.col(i), { mat: 'chrome', glow: 0.3 });
    }
    const p = j[j.length - 1];
    if (p) { S.glowAt(g, p[0], p[1], 60, S.col(0), 1); S.ball(g, p[0], p[1], 9, '#ffffff', { glow: 1 }); }
  },
};

// =====================================================================================
// POLYRYTHME — dots slide on arcs at different speeds, each hit a note, until they sync.
// =====================================================================================
export const polyrhythm = {
  id: 'polyrhythm', dropAt: 0.62, name: 'Polyrythme', cat: 'hypno', music: true,
  desc: 'Des points glissent sur des arcs à vitesses différentes, chaque contact est une note — jusqu’à la synchro.',
  options: [
    { id: 'dots', label: 'Points', type: 'choice', def: 21, choices: [[12, '12'], [21, '21'], [32, '32']] },
    { id: 'lines', label: 'Relier les points', type: 'bool', def: true },
  ],
  hook: 'Ils vont tous se retrouver… attends la fin',
  init(S) {
    const N = (S.N = S.opts.dots || 21);
    S.cx = W / 2; S.cy = 860;
    S.Rmin = 70; S.Rmax = 330;
    S.dots = Array.from({ length: N }, (_, i) => ({ n: 0, last: -1, flash: 0, x: 0, y: 0, trail: S.newTrail(10) }));
    S.syncT = Math.max(3, S.dropT);
    S.K = N + 7; // half-trips for the fastest dot during the loop
    S.synced = false;
  },
  update(S, dt) {
    const N = S.N;
    for (let i = 0; i < N; i++) {
      const d = S.dots[i];
      const trips = S.K - i; // every dot finishes an integer number of half-trips at syncT
      const ph = (S.vt / S.syncT) * trips;
      const n = Math.floor(ph);
      const f = ph - n;
      const dir = n % 2 === 0;
      const a = Math.PI + (dir ? f : 1 - f) * Math.PI; // π → 2π (upper half)
      const R = lerp(S.Rmin, S.Rmax, i / (N - 1));
      d.x = S.cx + Math.cos(a) * R; d.y = S.cy + Math.sin(a) * R;
      d.trail.push(d.x, d.y);
      d.flash = Math.max(0, d.flash - dt * 3);
      if (n !== d.n) {
        d.n = n;
        d.flash = 1;
        const col = this.col(S, i);
        S.note(N - 1 - i, 0.55, 'marimba', 0.7);
        S.fx.burst(d.x, d.y, col, 6, 220, { grav: 0, shards: false });
      }
    }
    if (!S.synced && S.vt >= S.syncT) {
      S.synced = true;
      for (let i = 0; i < 5; i++) S.fx.shock(S.cx, S.cy, S.col(i), 380 + i * 90, 0.9, 12);
      S.fx.rays(S.cx, S.cy, S.col(0), 2, 16, 900);
      S.flash(0.6, lighten(S.col(0), 0.4)); S.shake(0.5); S.punchHook();
      S.sfx('impact', { v: 0.9 });
      S.syncT2 = S.syncT; S.syncT = S.syncT * 2; // keep going, next sync far away
    }
  },
  col(S, i) { return ramp(S.cols.slice(0, 4), i / Math.max(1, S.N - 1)); },
  draw(S, g) {
    const N = S.N;
    g.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      const R = lerp(S.Rmin, S.Rmax, i / (N - 1));
      const col = this.col(S, i), d = S.dots[i];
      S.neon(g, () => { g.beginPath(); g.arc(S.cx, S.cy, R, Math.PI, TAU); }, d.flash > 0 ? lighten(col, d.flash * 0.6) : alpha(col, 0.55), 2 + d.flash * 4);
    }
    // base line
    S.neon(g, () => { g.beginPath(); g.moveTo(S.cx - S.Rmax - 30, S.cy); g.lineTo(S.cx + S.Rmax + 30, S.cy); }, S.theme.fg, 3, 0.8);
    if (S.opts.lines !== false) {
      g.strokeStyle = alpha(S.theme.fg, 0.18); g.lineWidth = 1.5;
      g.beginPath();
      S.dots.forEach((d, i) => (i ? g.lineTo(d.x, d.y) : g.moveTo(d.x, d.y)));
      g.stroke();
    }
    for (let i = 0; i < N; i++) {
      const d = S.dots[i], col = this.col(S, i);
      if (S.trails) d.trail.draw(g, col, 8, S.theme.dark, 0.6);
      S.ball(g, d.x, d.y, 9 + d.flash * 5, d.flash > 0.5 ? '#ffffff' : col, { glow: 0.7 + d.flash });
    }
    // time-to-sync hint
    if (!S.synced) {
      const left = Math.max(0, S.syncT - S.vt);
      S.text(g, left.toFixed(1) + ' s', S.cx, S.cy + 90, 34, alpha(S.theme.fg, 0.6), { align: 'center', weight: 700 });
    }
  },
};

// =====================================================================================
// MANDALA — a kaleidoscope: a new crown of petals blooms on every beat.
// =====================================================================================
export const mandala = {
  id: 'mandala', name: 'Mandala', cat: 'hypno', badge: '♪ Synchro musique', music: true,
  desc: 'Un kaléidoscope : une nouvelle couronne de pétales éclot à chaque temps.',
  options: [
    { id: 'sym', label: 'Symétrie', type: 'choice', def: 8, choices: [[6, '6'], [8, '8'], [12, '12'], [16, '16']] },
  ],
  hook: 'Respire… et regarde',
  init(S) {
    S.cx = W / 2; S.cy = H / 2 + 60;
    S.crowns = [];
    S.spin = 0;
    S.styleI = 0;
    this.bloom(S, 0);
  },
  bloom(S, strong) {
    const r = S.rng;
    const k = (S.opts.sym || 8) * (S.dropped ? 2 : 1);
    S.crowns.push({
      t: 0, k, style: S.styleI++ % 4, col: S.col(S.crowns.length), col2: S.col(S.crowns.length + 2),
      rot: r() * TAU, dir: r.sign(), len: 0.8 + r() * 0.6, wid: 0.35 + r() * 0.5, strong,
    });
    if (S.crowns.length > 22) S.crowns.shift();
  },
  update(S, dt) {
    S.spin += dt * (0.15 + (S.dropped ? 0.25 : 0));
    for (const c of S.crowns) c.t += dt;
    if (S.beat) {
      this.bloom(S, S.dropped ? 1 : 0);
      if (S.dropped) S.fx.shock(S.cx, S.cy, S.col(S.beatIndex), 380, 0.5, 5);
    }
    if (S.justDropped) {
      S.fx.rays(S.cx, S.cy, S.col(1), 2, 24, 900);
      for (let i = 0; i < 4; i++) S.fx.shock(S.cx, S.cy, S.col(i), 500 + i * 140, 0.8, 12);
      S.flash(0.6, S.col(0)); S.punchHook(); S.shake(0.4);
    }
    S.crowns = S.crowns.filter((c) => c.t < 7);
  },
  petal(g, style, L, Wd) {
    g.beginPath();
    if (style === 0) { g.moveTo(0, 0); g.quadraticCurveTo(L * 0.5, -Wd, L, 0); g.quadraticCurveTo(L * 0.5, Wd, 0, 0); }
    else if (style === 1) { g.moveTo(0, 0); g.bezierCurveTo(L * 0.2, -Wd * 1.4, L * 0.9, -Wd * 0.8, L, 0); g.bezierCurveTo(L * 0.9, Wd * 0.8, L * 0.2, Wd * 1.4, 0, 0); }
    else if (style === 2) { g.moveTo(0, 0); g.lineTo(L * 0.6, -Wd); g.lineTo(L, 0); g.lineTo(L * 0.6, Wd); g.closePath(); }
    else { g.moveTo(0, 0); g.bezierCurveTo(L * 0.3, -Wd * 1.6, L * 1.1, -Wd * 0.2, L * 0.8, Wd * 0.3); g.quadraticCurveTo(L * 0.4, Wd * 0.4, 0, 0); }
  },
  draw(S, g) {
    const bass = S.song.bass(S.vt);
    g.save();
    g.translate(S.cx, S.cy);
    g.rotate(S.spin);
    const add = S.theme.dark;
    for (const c of S.crowns) {
      const grow = easeOutCubic(clamp(c.t / 1.6, 0, 1));
      const R = 40 + grow * 110 + c.t * 70;
      const a = c.t < 0.2 ? c.t / 0.2 : Math.max(0, 1 - (c.t - 0.2) / 6.5);
      if (a <= 0) continue;
      const L = R * c.len * (0.6 + grow * 0.4) * (1 + bass * 0.08), Wd = L * c.wid * 0.45;
      g.save();
      g.rotate(c.rot + c.dir * c.t * 0.35);
      const grd = g.createLinearGradient(0, 0, L + R * 0.4, 0);
      grd.addColorStop(0, alpha(c.col, 0));
      grd.addColorStop(0.45, alpha(c.col, 0.55 * a));
      grd.addColorStop(1, alpha(c.col2, 0.95 * a));
      for (let i = 0; i < c.k; i++) {
        g.rotate(TAU / c.k);
        g.save();
        g.translate(R * 0.35, 0);
        g.fillStyle = grd;
        this.petal(g, c.style, L, Wd);
        g.fill();
        g.strokeStyle = alpha(lighten(c.col2, 0.5), 0.8 * a);
        g.lineWidth = 2;
        g.stroke();
        // inner vein
        g.strokeStyle = alpha('#ffffff', 0.35 * a); g.lineWidth = 1;
        g.beginPath(); g.moveTo(L * 0.1, 0); g.lineTo(L * 0.85, 0); g.stroke();
        g.restore();
        // jewel at petal tip
        if (c.strong || c.style === 2) {
          const jx = R * 0.35 + L * 1.05;
          if (add) drawGlow(g, jx, 0, 14, c.col2, a);
          g.fillStyle = alpha(lighten(c.col2, 0.6), a);
          g.beginPath(); g.arc(jx, 0, 3.5, 0, TAU); g.fill();
        }
      }
      g.restore();
    }
    g.restore();
    // centre jewel
    const r0 = 34 + bass * 14;
    S.glowAt(g, S.cx, S.cy, r0 * 4, S.col(0), 0.9);
    S.ball(g, S.cx, S.cy, r0, S.col(1), { mat: S.mat === 'flat' ? 'glossy' : S.mat, glow: 1 });
    g.save(); g.translate(S.cx, S.cy); g.rotate(-S.spin * 2);
    for (let i = 0; i < 12; i++) {
      g.rotate(TAU / 12);
      g.fillStyle = alpha(lighten(S.col(2), 0.4), 0.85);
      g.beginPath(); g.arc(r0 + 14, 0, 3, 0, TAU); g.fill();
    }
    g.restore();
  },
};
