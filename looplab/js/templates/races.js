// LOOPLAB — races & battles. Entries (names, flags, photos) come from the editor.
import { TAU, clamp, lerp, angNorm, alpha, lighten, darken, ramp, easeOutCubic, closestOnSeg, roundRect, fmtInt } from '../core/util.js';
import { World, Body, Seg } from '../core/physics.js';
import { drawGlow } from '../core/materials.js';

const W = 720, H = 1280;

function entries(S, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const e = S.entries[i % S.entries.length];
    const name = i < S.entries.length ? e.name : `${e.name} ${Math.floor(i / S.entries.length) + 1}`;
    out.push({ name, emoji: e.emoji, img: e.img, col: e.col || S.col(i), colSet: e.colSet });
  }
  return out;
}

/** Ball with flag/photo/initial and a name tag. */
function drawEntity(S, g, x, y, r, e, o = {}) {
  S.ball(g, x, y, r, e.col, { img: e.img, glow: o.glow ?? 0.6, vx: o.vx, vy: o.vy, alpha: o.alpha });
  if (!e.img) {
    if (e.emoji) S.text(g, e.emoji, x, y + r * 0.05, r * 1.05, '#fff', { align: 'center', emoji: true, alpha: o.alpha });
    else S.text(g, e.name.slice(0, 1).toUpperCase(), x, y + 2, r * 1.0, '#ffffff', { align: 'center', stroke: true, weight: 900, alpha: o.alpha });
  }
  if (o.label !== false) S.text(g, e.name, x, y - r - 16, Math.max(16, Math.min(26, r * 0.7)), '#ffffff', { align: 'center', stroke: true, weight: 800, alpha: o.alpha, maxW: 180 });
}

function scoreboard(S, g, list, y0 = 1110, fmt) {
  const n = list.length;
  const cols = Math.min(n, 5), rows = Math.ceil(n / cols);
  const cw = 660 / cols;
  list.forEach((it, i) => {
    const cx = 30 + cw * (i % cols) + cw / 2, cy = y0 + Math.floor(i / cols) * 54 - (rows - 1) * 27;
    g.globalAlpha = it.dead ? 0.35 : 1;
    g.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(g, cx - cw / 2 + 4, cy - 22, cw - 8, 44, 22); g.fill();
    S.ball(g, cx - cw / 2 + 28, cy, 15, it.col, { img: it.img, glow: 0 });
    if (!it.img && it.emoji) S.text(g, it.emoji, cx - cw / 2 + 28, cy + 1, 16, '#fff', { align: 'center', emoji: true });
    S.text(g, fmt(it), cx + 14, cy + 1, 20, '#ffffff', { align: 'center', weight: 800, maxW: cw - 64 });
    if (it.dead) { g.strokeStyle = '#ff4d6d'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - cw / 2 + 12, cy); g.lineTo(cx + cw / 2 - 12, cy); g.stroke(); }
    g.globalAlpha = 1;
  });
}

// =====================================================================================
// THREADS family — balls tied by threads; a ball crossing another's thread cuts it.
// =====================================================================================
function makeThreads(cfg) {
  return {
    ...cfg, cat: 'race', music: true,
    init(S) {
      const n = cfg.fixedN || clamp(S.opts.count || cfg.defN, 2, 10);
      S.ents = entries(S, n);
      S.cx = W / 2; S.cy = H / 2 + 30; S.R = 300;
      const r = S.rng;
      const K = cfg.threads;
      S.tri = cfg.triangle ? [0, 1, 2].map((i) => [S.cx + Math.cos(-Math.PI / 2 + (i * TAU) / 3) * 360, S.cy + 20 + Math.sin(-Math.PI / 2 + (i * TAU) / 3) * 360]) : null;
      const rad = cfg.radius(n);
      S.ents.forEach((e, i) => {
        const a = (i / n) * TAU + r() * 0.3;
        e.x = S.cx + Math.cos(a) * S.R * 0.45; e.y = S.cy + Math.sin(a) * S.R * 0.45;
        const sp = 520;
        const va = r() * TAU;
        e.vx = Math.cos(va) * sp; e.vy = Math.sin(va) * sp;
        e.r = rad; e.alive = true; e.falling = false; e.out = false;
        e.trail = S.newTrail(12);
        e.threads = [];
        for (let k = 0; k < K; k++) {
          let ax, ay;
          if (S.tri) [ax, ay] = S.tri[k % 3];
          else { const aa = a + ((k - (K - 1) / 2) / K) * 2.4 + r.range(-0.2, 0.2); ax = S.cx + Math.cos(aa) * (S.R + 40); ay = S.cy + Math.sin(aa) * (S.R + 40); }
          e.threads.push({ ax, ay, len: S.R * (cfg.triangle ? 1.25 : 1.35) + r() * 60, alive: true });
        }
      });
      S.cuts = [];
      S.elims = 0;
      S.focus = null;
    },
    update(S, dt) {
      const ents = S.ents;
      const alive = ents.filter((e) => !e.falling && !e.out);
      const n = ents.length;
      // schedule: eliminations spread over the video, last one ~3 s before the end
      const T = Math.max(4, S.dur - 3);
      const want = (n - 1) * clamp(S.vt / T, 0, 1);
      const deficit = want - S.elims;
      for (const e of ents) {
        if (e.out) continue;
        if (e.falling) {
          e.vy += 1900 * dt; e.x += e.vx * dt; e.y += e.vy * dt;
          if (e.y > H + 120) { e.out = true; }
          continue;
        }
        if (S.winner) {
          // victory lap
          const a = S.vt * 2;
          e.vx += (S.cx + Math.cos(a) * 120 - e.x) * dt * 10; e.vy += (S.cy + Math.sin(a) * 120 - e.y) * dt * 10;
          e.vx *= 0.95; e.vy *= 0.95;
        } else {
          // homing toward the closest enemy thread when the fight is too slow
          if (deficit > 0.15) {
            let bx = 0, by = 0, bd = 1e9;
            for (const o of alive) if (o !== e) for (const t of o.threads) if (t.alive) {
              const mx = lerp(t.ax, o.x, 0.55), my = lerp(t.ay, o.y, 0.55);
              const d = Math.hypot(mx - e.x, my - e.y);
              if (d < bd) { bd = d; bx = mx; by = my; }
            }
            if (bd < 1e9) { const f = Math.min(1600, deficit * 1400); e.vx += ((bx - e.x) / bd) * f * dt; e.vy += ((by - e.y) / bd) * f * dt; }
          }
          const sp = Math.hypot(e.vx, e.vy) || 1;
          const want2 = (deficit < -0.3 ? 420 : 520) + Math.max(0, deficit) * 280;
          e.vx += (e.vx / sp) * (want2 - sp) * dt * 2; e.vy += (e.vy / sp) * (want2 - sp) * dt * 2;
        }
        e.x += e.vx * dt; e.y += e.vy * dt;
        e.trail.push(e.x, e.y);
        // rope constraints
        for (const t of e.threads) {
          if (!t.alive) continue;
          const dx = e.x - t.ax, dy = e.y - t.ay, d = Math.hypot(dx, dy);
          if (d > t.len) {
            const nx = dx / d, ny = dy / d;
            e.x = t.ax + nx * t.len; e.y = t.ay + ny * t.len;
            const vn = e.vx * nx + e.vy * ny;
            if (vn > 0) { e.vx -= 1.7 * vn * nx; e.vy -= 1.7 * vn * ny; t.twang = 1; }
          }
          t.twang = Math.max(0, (t.twang || 0) - dt * 5);
        }
        // arena
        if (S.tri) {
          for (let k = 0; k < 3; k++) {
            const [ax, ay] = S.tri[k], [bx, by] = S.tri[(k + 1) % 3];
            const [qx, qy] = closestOnSeg(e.x, e.y, ax, ay, bx, by);
            let nx = S.cx - qx, ny = S.cy + 20 - qy; const L = Math.hypot(nx, ny); nx /= L; ny /= L;
            const d = (e.x - qx) * nx + (e.y - qy) * ny;
            if (d < e.r) { e.x += nx * (e.r - d); e.y += ny * (e.r - d); const vn = e.vx * nx + e.vy * ny; if (vn < 0) { e.vx -= 2 * vn * nx; e.vy -= 2 * vn * ny; } }
          }
        } else {
          const dx = e.x - S.cx, dy = e.y - S.cy, d = Math.hypot(dx, dy);
          if (d + e.r > S.R) {
            const nx = dx / d, ny = dy / d;
            e.x = S.cx + nx * (S.R - e.r); e.y = S.cy + ny * (S.R - e.r);
            const vn = e.vx * nx + e.vy * ny;
            if (vn > 0) { e.vx -= 2 * vn * nx; e.vy -= 2 * vn * ny; }
          }
        }
      }
      // ball vs ball
      for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), rr = a.r + b.r;
        if (d < rr && d > 0) {
          const nx = dx / d, ny = dy / d, p = (rr - d) / 2;
          a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p;
          const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (vn < 0) { a.vx += vn * nx; a.vy += vn * ny; b.vx -= vn * nx; b.vy -= vn * ny; S.sfx('thud', { v: 0.5 }, 0.08); S.fx.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, nx, ny, '#ffffff', 6, 400, 1.4); }
        }
      }
      // cutting: threads are elastic (they only twang) while the fight is ahead of schedule.
      // The last thread of a ball can only go when an elimination is due.
      const totalThreads = ents.reduce((s, e) => s + e.threads.length, 0);
      const cutsWanted = (totalThreads - cfg.threads) * clamp(S.vt / T, 0, 1);
      const cutsDone = ents.reduce((s, e) => s + e.threads.filter((t) => !t.alive).length, 0);
      if (!S.winner) for (const cutter of alive) for (const o of alive) {
        if (o === cutter) continue;
        for (const t of o.threads) {
          if (!t.alive) continue;
          const [qx, qy, u] = closestOnSeg(cutter.x, cutter.y, t.ax, t.ay, o.x, o.y);
          const L = Math.hypot(o.x - t.ax, o.y - t.ay);
          if (u * L > L - (o.r + cutter.r) * 1.05) continue;
          if (Math.hypot(cutter.x - qx, cutter.y - qy) < cutter.r * 0.9) {
            const last = o.threads.filter((tt) => tt.alive).length === 1;
            const allowed = last ? deficit > -0.25 : cutsDone < cutsWanted + 1.2;
            if (allowed) this.cut(S, o, t, qx, qy, cutter);
            else if (!t.twang || t.twang < 0.2) { t.twang = 1; S.sfx('tick', { v: 0.25 }, 0.08); }
          }
        }
      }
      for (const c of S.cuts) c.t += dt;
      S.cuts = S.cuts.filter((c) => c.t < 0.6);
      // focus camera on a fall
      if (S.focus) {
        S.focus.t += dt;
        const f = S.focus.e;
        S.camTo(lerp(S.cx, f.x, 0.5), lerp(S.cy, Math.min(f.y, H - 200), 0.5), 1.35, 5);
        if (S.focus.t > 1.4) { S.focus = null; S.camTo(W / 2, H / 2, 1, 3); }
      }
      const left = ents.filter((e) => !e.falling && !e.out);
      if (left.length === 1 && !S.winner) {
        const w = left[0];
        S.win(w, { sub: cfg.winSub });
        S.camTo(W / 2, H / 2, 1, 3);
      }
      if (!S.winner && S.vt > S.dur - 1.2 && left.length > 1) {
        // out of time: the ball with the most threads wins on points
        left.sort((a, b) => b.threads.filter((t) => t.alive).length - a.threads.filter((t) => t.alive).length);
        for (const e of left.slice(1)) for (const t of e.threads) if (t.alive) this.cut(S, e, t, (t.ax + e.x) / 2, (t.ay + e.y) / 2, left[0]);
      }
    },
    cut(S, o, t, x, y, cutter) {
      t.alive = false;
      S.cuts.push({ ax: t.ax, ay: t.ay, x, y, o, t: 0, col: o.col });
      S.fx.sparks(x, y, cutter.vx, cutter.vy, '#ffffff', 14, 600, 1.2);
      S.fx.burst(x, y, o.col, 8, 260, { grav: 400, shards: false });
      S.sfx('snap', { v: 0.8 });
      S.note(o.threads.filter((tt) => tt.alive).length + 4, 0.5, 'pluck');
      S.shake(0.12);
      if (!o.threads.some((tt) => tt.alive)) {
        o.falling = true;
        S.elims++;
        S.slowmo(0.22, 1.25);
        S.focus = { e: o, t: 0 };
        S.fx.burst(o.x, o.y, o.col, 30, 500, { grav: 600 });
        S.fx.pop(o.x, o.y - o.r - 40, `${o.name} éliminé`, '#ff5a6e', 34, 1.4);
        S.sfx('whoosh', { d: 0.9, v: 0.7 });
        S.flash(0.25, o.col);
        if (S.effects.lightning) S.fx.lightning(cutter.x, cutter.y, o.x, o.y, cutter.col, 0.3, 3);
      }
    },
    draw(S, g) {
      // arena
      if (S.tri) {
        S.neon(g, () => { g.beginPath(); S.tri.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }, S.col(1), 6, 0.9);
        for (const [x, y] of S.tri) S.ball(g, x, y, 14, '#ffffff', { mat: 'chrome', glow: 0.5 });
      } else {
        g.fillStyle = alpha(S.theme.fg, 0.04);
        g.beginPath(); g.arc(S.cx, S.cy, S.R, 0, TAU); g.fill();
        S.neon(g, () => { g.beginPath(); g.arc(S.cx, S.cy, S.R, 0, TAU); }, S.col(1), 5, 0.8);
      }
      // threads (tension = brightness)
      g.lineCap = 'round';
      for (const e of S.ents) {
        if (e.out) continue;
        for (const t of e.threads) {
          if (!t.alive) continue;
          const tension = clamp(Math.hypot(e.x - t.ax, e.y - t.ay) / t.len, 0, 1);
          // a slack thread sags with a quadratic curve
          const mx = (t.ax + e.x) / 2, my = (t.ay + e.y) / 2 + (1 - tension) * 70;
          S.neon(g, () => { g.beginPath(); g.moveTo(t.ax, t.ay); g.quadraticCurveTo(mx, my, e.x, e.y); }, lighten(e.col, 0.15 + tension * 0.3 + (t.twang || 0) * 0.3), 2.2 + tension * 1.4, 0.95);
          if (!S.tri) S.ball(g, t.ax, t.ay, 6, e.col, { mat: 'chrome', glow: 0.2 });
        }
      }
      // snapped thread halves recoil
      for (const c of S.cuts) {
        const k = easeOutCubic(c.t / 0.6);
        g.strokeStyle = alpha(c.col, 1 - k); g.lineWidth = 2.5;
        const px = lerp(c.x, c.ax, k), py = lerp(c.y, c.ay, k) + k * k * 40;
        g.beginPath(); g.moveTo(c.ax, c.ay); g.lineTo(px, py); g.stroke();
        const qx = lerp(c.x, c.o.x, k), qy = lerp(c.y, c.o.y, k) + k * 30;
        g.beginPath(); g.moveTo(qx, qy); g.lineTo(c.o.x, c.o.y); g.stroke();
      }
      for (const e of S.ents) {
        if (e.out) continue;
        if (S.trails && !e.falling) e.trail.draw(g, e.col, e.r * 1.2, S.theme.dark, 0.5);
        drawEntity(S, g, e.x, e.y, e.r, e, { vx: e.vx, vy: e.vy });
        // remaining threads as pips
        const k = e.threads.filter((t) => t.alive).length;
        for (let i = 0; i < e.threads.length; i++) {
          g.fillStyle = i < k ? lighten(e.col, 0.4) : 'rgba(255,255,255,0.18)';
          g.beginPath(); g.arc(e.x + (i - (e.threads.length - 1) / 2) * 11, e.y + e.r + 12, 4, 0, TAU); g.fill();
        }
      }
    },
    overlay(S, g) {
      if (S.ents.length > 2) scoreboard(S, g, S.ents.map((e) => ({ ...e, dead: e.falling || e.out })), 1150, (it) => (it.dead ? it.name : `${it.name} · ${it.threads.filter((t) => t.alive).length}`));
    },
  };
}

export const threadClash = makeThreads({
  id: 'threadclash', name: 'Duel de fils', badge: '🖼 Drapeaux & photos', ending: true,
  desc: 'Pays, photos ou prénoms au bout de fils. Coupe ceux des autres. Ralenti avant chaque chute.',
  options: [{ id: 'count', label: 'Participants', type: 'choice', def: 4, choices: [[2, '2'], [3, '3'], [4, '4'], [6, '6']] }],
  defN: 4, threads: 4, radius: (n) => (n <= 2 ? 46 : n <= 4 ? 38 : 30), entries: true,
  hook: 'Qui gardera ses fils jusqu’au bout ?',
});
export const threadRoyale = makeThreads({
  id: 'threadroyale', name: 'Royale de fils', badge: '🖼 Drapeaux & photos', ending: true,
  desc: 'Jusqu’à 10 balles dans un seul enchevêtrement de fils, comme une coupe du monde. La dernière accrochée gagne.',
  options: [{ id: 'count', label: 'Participants', type: 'choice', def: 8, choices: [[5, '5'], [8, '8'], [10, '10']] }],
  defN: 8, threads: 3, radius: (n) => (n <= 6 ? 30 : 25), entries: true,
  hook: 'Coupe du monde des fils : qui reste accroché ?',
});
export const photoDuel = makeThreads({
  id: 'photoduel', name: 'Duel de photos', badge: '🖼 Drapeaux & photos', ending: true,
  desc: 'Tes deux photos deviennent des balles géantes qui coupent les fils de l’autre, jusqu’au dernier.',
  options: [], fixedN: 2, threads: 6, radius: () => 72, entries: true,
  hook: 'Le duel ultime. Qui gagne ?',
});
export const friendsTriangle = makeThreads({
  id: 'friendstriangle', name: 'Triangle d’amis', badge: '🖼 Drapeaux & photos', ending: true,
  desc: 'Trois prénoms dans un triangle de fils. Règle n’importe quel débat en une vidéo.',
  options: [], fixedN: 3, threads: 3, radius: () => 40, triangle: true, entries: true,
  hook: 'On règle ça une bonne fois pour toutes',
});

// =====================================================================================
// BATTLE ROYALE — 40 marbles, one shrinking safe zone. Touch the zone and you're out.
// =====================================================================================
export const battleRoyale = {
  id: 'battleroyale', name: 'Battle royale', cat: 'race', badge: '💬 Prénoms', music: true, entries: true, ending: true,
  desc: '40 billes, une zone sûre qui rétrécit. Touche la zone et tu sors. La dernière gagne.',
  options: [{ id: 'count', label: 'Billes', type: 'choice', def: 40, choices: [[20, '20'], [40, '40'], [60, '60']] }],
  hook: (S) => `${S.opts.count || 40} billes. 1 seule survivante.`,
  init(S) {
    const n = S.opts.count || 40;
    S.ents = entries(S, n);
    S.cx = W / 2; S.cy = H / 2 + 40; S.R = 320;
    S.zone = { x: S.cx, y: S.cy, r: S.R - 10 };
    const r = S.rng;
    const br = n > 45 ? 12 : n > 30 ? 14 : 17;
    S.ents.forEach((e, i) => {
      const a = r() * TAU, d = Math.sqrt(r()) * (S.R - 60);
      Object.assign(e, { x: S.cx + Math.cos(a) * d, y: S.cy + Math.sin(a) * d, vx: r.range(-1, 1) * 380, vy: r.range(-1, 1) * 380, r: br, alive: true, idx: i });
    });
    S.left = n;
    S.setCounter(n, { style: 'top', label: 'Restants :' });
  },
  update(S, dt) {
    const alive = S.ents.filter((e) => e.alive);
    const T = Math.max(4, S.dur - 3);
    const k = clamp(S.vt / T, 0, 1);
    // zone shrinks and drifts
    const zr = lerp(S.R - 10, 40, Math.pow(k, 0.9));
    S.zone.r = zr;
    S.zone.x = S.cx + Math.sin(S.vt * 0.4) * (S.R - zr) * 0.35;
    S.zone.y = S.cy + Math.cos(S.vt * 0.33) * (S.R - zr) * 0.3;
    for (const e of alive) {
      if (S.winner) {
        e.vx += (S.zone.x - e.x) * dt * 6; e.vy += (S.zone.y - e.y) * dt * 6; e.vx *= 0.94; e.vy *= 0.94;
      }
      const sp = Math.hypot(e.vx, e.vy) || 1;
      const want = 320;
      e.vx += (e.vx / sp) * (want - sp) * dt; e.vy += (e.vy / sp) * (want - sp) * dt;
      e.x += e.vx * dt; e.y += e.vy * dt;
      const dx = e.x - S.cx, dy = e.y - S.cy, d = Math.hypot(dx, dy);
      if (d + e.r > S.R) { const nx = dx / d, ny = dy / d; e.x = S.cx + nx * (S.R - e.r); e.y = S.cy + ny * (S.R - e.r); const vn = e.vx * nx + e.vy * ny; if (vn > 0) { e.vx -= 2 * vn * nx; e.vy -= 2 * vn * ny; } }
    }
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, rr = a.r + b.r;
      if (d2 < rr * rr && d2 > 0) {
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, p = (rr - d) / 2;
        a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) { a.vx += vn * nx; a.vy += vn * ny; b.vx -= vn * nx; b.vy -= vn * ny; S.sfx('tick', { v: 0.25 }, 0.05); }
      }
    }
    const wantOut = (S.ents.length - 1) * clamp(S.vt / T, 0, 1);
    S.armed = !S.winner && wantOut - (S.ents.length - S.left) > 0;
    if (!S.winner) {
      // the zone edge kills only while it is armed (red); otherwise it is a wall
      const touching = alive.filter((e) => Math.hypot(e.x - S.zone.x, e.y - S.zone.y) + e.r > S.zone.r);
      const out = [];
      for (const e of touching) {
        if (S.armed && out.length < Math.ceil(wantOut - (S.ents.length - S.left))) { out.push(e); continue; }
        const dx = e.x - S.zone.x, dy = e.y - S.zone.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
        e.x = S.zone.x + nx * (S.zone.r - e.r); e.y = S.zone.y + ny * (S.zone.r - e.r);
        const vn = e.vx * nx + e.vy * ny;
        if (vn > 0) { e.vx -= 2 * vn * nx; e.vy -= 2 * vn * ny; S.fx.sparks(e.x + nx * e.r, e.y + ny * e.r, -nx, -ny, '#7dffb2', 3, 260); }
      }
      for (const e of out) {
        if (S.left <= 1) break;
        e.alive = false; S.left--;
        S.fx.burst(e.x, e.y, e.col, 22, 480, { grav: 300 });
        S.fx.shock(e.x, e.y, '#ff4d6d', 70, 0.4, 5);
        S.fx.pop(e.x, e.y - 30, e.name, '#ff6b7e', 24, 0.9);
        S.note(S.left % 12, 0.5, 'pluck');
        S.sfx('pop', { v: 0.6, pitch: 0.8 });
        S.shake(0.08);
      }
      if (S.left === 1) {
        const w = S.ents.find((e) => e.alive);
        S.win(w, { sub: `a survécu à ${S.ents.length - 1} billes` });
      }
    }
    S.setCounter(S.left, { style: 'top', label: 'Restants :' });
  },
  draw(S, g) {
    // storm outside the safe zone
    g.save();
    g.beginPath(); g.arc(S.cx, S.cy, S.R, 0, TAU); g.clip();
    g.fillStyle = alpha('#ff2d55', S.theme.dark ? 0.22 : 0.14);
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(S.zone.x, S.zone.y, S.zone.r, 0, TAU); g.fill();
    g.restore();
    // storm streaks
    g.save();
    g.beginPath(); g.arc(S.cx, S.cy, S.R, 0, TAU); g.arc(S.zone.x, S.zone.y, S.zone.r, 0, TAU, true); g.clip('evenodd');
    g.strokeStyle = alpha('#ff6b8a', 0.25); g.lineWidth = 2;
    for (let i = 0; i < 30; i++) {
      const a = i * 0.7 + S.vt * 0.8, rr = S.R * (0.3 + ((i * 37) % 70) / 100);
      g.beginPath(); g.arc(S.cx, S.cy, rr, a, a + 0.4); g.stroke();
    }
    g.restore();
    S.neon(g, () => { g.beginPath(); g.arc(S.cx, S.cy, S.R, 0, TAU); }, alpha(S.theme.fg, 0.5), 4);
    const pulse = 0.5 + 0.5 * Math.sin(S.vt * 8);
    S.neon(g, () => { g.beginPath(); g.arc(S.zone.x, S.zone.y, S.zone.r, 0, TAU); }, S.armed ? '#ff3b5c' : '#7dffb2', S.armed ? 6 + pulse * 3 : 4);
    for (const e of S.ents) if (e.alive) drawEntity(S, g, e.x, e.y, e.r, e, { label: S.left <= 12, glow: 0.3 });
  },
};

// =====================================================================================
// COURSE À 100 — four balls bounce through pegs, every hit is a point. First to 100.
// =====================================================================================
export const raceTo100 = {
  id: 'race100', name: 'Course à 100', cat: 'race', badge: '💬 Prénoms', music: true, entries: true, ending: true,
  desc: 'Quatre balles rebondissent entre des picots, chaque contact vaut un point. Premier à 100.',
  options: [{ id: 'goal', label: 'Objectif', type: 'choice', def: 100, choices: [[50, '50'], [100, '100'], [200, '200']] }],
  hook: (S) => `Premier à ${S.opts.goal || 100} points. Qui gagne ?`,
  init(S) {
    S.goal = S.opts.goal || 100;
    S.ents = entries(S, 4);
    const w = (S.world = new World({ g: 1300, iter: 3, damp: 0.1, maxV: 1500 }));
    S.pegs = [];
    const rows = 10, cols = 7;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols + (r % 2); c++) {
      const x = 90 + c * 90 - (r % 2) * 45, y = 330 + r * 76;
      if (x < 50 || x > W - 50) continue;
      S.pegs.push(w.addPeg(x, y, 11, 0.75));
    }
    w.bounds = { x0: 30, x1: W - 30, e: 0.8 };
    S.ents.forEach((e, i) => {
      e.score = 0;
      e.body = w.add(new Body(160 + i * 135, 230, 21, { e: 0.7, data: { e } }));
      e.body.vx = (S.rng() - 0.5) * 300;
      e.trail = S.newTrail(12);
    });
    S.boost = 1;
    w.onPeg = (b, p, imp) => {
      if (S.winner || imp < 60) return;
      const e = b.data.e;
      e.score = Math.min(S.goal, e.score + 1);
      p.hit = 1; p.col = e.col;
      S.note(e.score % 15, 0.45, 'xylo');
      S.fx.sparks(p.x, p.y, b.vx, b.vy, e.col, 4, 300);
      if (e.score % 10 === 0) S.fx.pop(b.x, b.y - 36, String(e.score), lighten(e.col, 0.4), 30);
      if (e.score >= S.goal) {
        S.win(e, { sub: `${S.goal} points en premier` });
        S.fx.burst(b.x, b.y, e.col, 60, 900);
      }
    };
    w.onHit = (a, b, imp) => { if (imp > 200) S.sfx('thud', { v: 0.4 }, 0.06); };
  },
  update(S, dt) {
    const w = S.world;
    // pacing: the leader should reach the goal ~2.5 s before the end
    const lead = Math.max(...S.ents.map((e) => e.score));
    const T = Math.max(4, S.dur - 2.5);
    const want = S.goal * clamp(S.vt / T, 0, 1);
    S.boost = clamp(S.boost + (want - lead) * dt * 0.02, 0.7, 2.2);
    for (const p of S.pegs) p.e = 0.62 + 0.25 * (S.boost - 1);
    w.g = 1300 * S.boost;
    w.step(dt);
    for (const e of S.ents) {
      const b = e.body;
      e.trail.push(b.x, b.y);
      if (b.y > 1150) {
        // portal back to the top
        S.fx.burst(b.x, 1150, e.col, 10, 300, { grav: -200 });
        b.y = 200; b.x = 120 + S.rng() * (W - 240); b.vy = 0; b.vx = (S.rng() - 0.5) * 400;
        e.trail.clear();
        S.sfx('whoosh', { d: 0.25, v: 0.25 }, 0.1);
      }
    }
    for (const p of S.pegs) p.hit = Math.max(0, (p.hit || 0) - dt * 3);
  },
  draw(S, g) {
    for (const p of S.pegs) {
      const pc = p.col || S.col(1);
      if (p.hit > 0) S.glowAt(g, p.x, p.y, 40, pc, p.hit);
      S.ball(g, p.x, p.y, p.r, p.hit > 0 ? lighten(pc, 0.3) : S.theme.dark ? '#d9dce6' : '#444b5a', { mat: 'chrome', glow: 0 });
    }
    // portal at the bottom
    const pg = g.createLinearGradient(0, 1140, 0, 1200);
    pg.addColorStop(0, alpha(S.col(1), 0)); pg.addColorStop(1, alpha(S.col(1), 0.6));
    g.fillStyle = pg; g.fillRect(30, 1140, W - 60, 60);
    for (const e of S.ents) {
      if (S.trails) e.trail.draw(g, e.col, 26, S.theme.dark, 0.5);
      drawEntity(S, g, e.body.x, e.body.y, e.body.r, e, { vx: e.body.vx, vy: e.body.vy, label: false });
    }
  },
  overlay(S, g) {
    // score bars
    const sorted = [...S.ents].sort((a, b) => b.score - a.score);
    S.ents.forEach((e, i) => {
      const y = 196 + i * 30;
      const rank = sorted.indexOf(e);
      g.fillStyle = 'rgba(0,0,0,0.4)';
      roundRect(g, 60, y - 12, 600, 24, 12); g.fill();
      g.fillStyle = e.col;
      roundRect(g, 60, y - 12, Math.max(24, 600 * (e.score / S.goal)), 24, 12); g.fill();
      S.text(g, `${rank === 0 && e.score > 0 ? '👑 ' : ''}${e.name}`, 76, y + 1, 17, '#fff', { weight: 800, stroke: true, maxW: 300 });
      S.text(g, String(e.score), 646, y + 1, 18, '#fff', { align: 'right', weight: 900, stroke: true });
    });
  },
};

// =====================================================================================
// ÉLIMINATION — named marbles in a spinning arena. Out through the gap = eliminated.
// =====================================================================================
export const elimination = {
  id: 'elimination', name: 'Élimination', cat: 'race', badge: '💬 Prénoms', music: true, entries: true, ending: true,
  desc: 'Des billes nommées dans une arène qui tourne. Sortie par la brèche = éliminée.',
  options: [{ id: 'count', label: 'Billes', type: 'choice', def: 10, choices: [[6, '6'], [10, '10'], [16, '16']] }],
  hook: 'Une seule restera dans l’arène',
  init(S) {
    const n = S.opts.count || 10;
    S.ents = entries(S, n);
    S.cx = W / 2; S.cy = H / 2; S.R = 290;
    S.ang = 0; S.gap = 0.35;
    const r = S.rng;
    S.ents.forEach((e) => {
      const a = r() * TAU, d = Math.sqrt(r()) * 180;
      Object.assign(e, { x: S.cx + Math.cos(a) * d, y: S.cy + Math.sin(a) * d, vx: r.range(-300, 300), vy: r.range(-300, 0), r: n > 12 ? 20 : 26, state: 'in', trail: S.newTrail(10) });
    });
    S.left = n;
    S.setCounter(n, { style: 'top', label: 'Restants :' });
  },
  update(S, dt) {
    const T = Math.max(4, S.dur - 3);
    const want = (S.ents.length - 1) * clamp(S.vt / T, 0, 1);
    const deficit = want - (S.ents.length - S.left);
    const gapT = deficit > 0 ? clamp(0.32 + deficit * 0.5, 0.32, 1.1) : 0.05;
    S.gap += (gapT - S.gap) * Math.min(1, dt * 4);
    S.ang += dt * (1.1 + S.vt * 0.02);
    const inside = S.ents.filter((e) => e.state === 'in');
    for (const e of S.ents) {
      if (e.state === 'gone') continue;
      e.vy += 1350 * dt;
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.trail.push(e.x, e.y);
      if (e.state === 'out') { if (e.y > H + 80) e.state = 'gone'; continue; }
      const dx = e.x - S.cx, dy = e.y - S.cy, d = Math.hypot(dx, dy);
      if (d + e.r > S.R) {
        const a = Math.atan2(dy, dx);
        const inGap = Math.abs(angNorm(a - S.ang)) < S.gap / 2 && S.gap * S.R > e.r * 2.1;
        if (inGap && !S.winner && S.left > 1) {
          e.state = 'out'; S.left--;
          S.fx.burst(e.x, e.y, e.col, 26, 500, { grav: 600 });
          S.fx.pop(e.x, e.y - 40, `${e.name} éliminé`, '#ff6b7e', 28, 1.2);
          S.sfx('whoosh', { d: 0.5, v: 0.6 }); S.note(S.left, 0.6, 'pluck');
          S.slowmo(0.35, 0.6); S.shake(0.2);
          if (S.left === 1) S.win(S.ents.find((x) => x.state === 'in'), { sub: 'dernière dans l’arène' });
        } else {
          const nx = dx / d, ny = dy / d;
          e.x = S.cx + nx * (S.R - e.r); e.y = S.cy + ny * (S.R - e.r);
          const vn = e.vx * nx + e.vy * ny;
          if (vn > 0) {
            e.vx -= 1.95 * vn * nx; e.vy -= 1.95 * vn * ny;
            // the spinning wall drags the marble along
            const tx = -ny, ty = nx; e.vx += tx * 120; e.vy += ty * 120;
            if (vn > 250) { S.note(Math.floor(((a + Math.PI) / TAU) * 10), 0.3, 'marimba'); S.fx.sparks(e.x + nx * e.r, e.y + ny * e.r, -nx, -ny, e.col, 4, 300); }
          }
        }
      }
    }
    for (let i = 0; i < inside.length; i++) for (let j = i + 1; j < inside.length; j++) {
      const a = inside[i], b = inside[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), rr = a.r + b.r;
      if (d < rr && d > 0) {
        const nx = dx / d, ny = dy / d, p = (rr - d) / 2;
        a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) { a.vx += vn * nx * 0.95; a.vy += vn * ny * 0.95; b.vx -= vn * nx * 0.95; b.vy -= vn * ny * 0.95; }
      }
    }
    // keep everyone lively
    for (const e of inside) { const sp = Math.hypot(e.vx, e.vy); if (sp < 300) { e.vx *= 1.02; e.vy -= 20; } }
    S.setCounter(S.left, { style: 'top', label: 'Restants :' });
  },
  draw(S, g) {
    g.fillStyle = alpha(S.theme.fg, 0.04);
    g.beginPath(); g.arc(S.cx, S.cy, S.R, 0, TAU); g.fill();
    S.neon(g, () => { g.beginPath(); g.arc(S.cx, S.cy, S.R, S.ang + S.gap / 2, S.ang + TAU - S.gap / 2); }, S.col(0), 9);
    for (const s of [-1, 1]) { const a = S.ang + (s * S.gap) / 2; S.ball(g, S.cx + Math.cos(a) * S.R, S.cy + Math.sin(a) * S.R, 9, '#ffffff', { mat: 'chrome', glow: 0.6 }); }
    // tick marks spinning with the wall
    g.strokeStyle = alpha(S.col(0), 0.4); g.lineWidth = 2;
    for (let i = 0; i < 48; i++) {
      const a = S.ang + (i / 48) * TAU;
      if (Math.abs(angNorm(a - S.ang)) < S.gap / 2 + 0.05) continue;
      g.beginPath(); g.moveTo(S.cx + Math.cos(a) * (S.R + 10), S.cy + Math.sin(a) * (S.R + 10)); g.lineTo(S.cx + Math.cos(a) * (S.R + 22), S.cy + Math.sin(a) * (S.R + 22)); g.stroke();
    }
    for (const e of S.ents) if (e.state !== 'gone') {
      if (S.trails) e.trail.draw(g, e.col, e.r, S.theme.dark, 0.4);
      drawEntity(S, g, e.x, e.y, e.r, e, { vx: e.vx, vy: e.vy, alpha: e.state === 'out' ? 0.7 : 1 });
    }
  },
  overlay(S, g) { scoreboard(S, g, S.ents.map((e) => ({ ...e, dead: e.state !== 'in' })), 1160, (it) => it.name); },
};

// =====================================================================================
// GUERRE DES COULEURS — teams bounce and repaint the enemy's ground. Live percentages.
// =====================================================================================
export const colorWar = {
  id: 'colorwar', name: 'Guerre des couleurs', cat: 'race', badge: '💬 Prénoms', music: true, entries: true,
  desc: 'Les équipes rebondissent et repeignent le terrain ennemi. Pourcentages en direct, un seul vainqueur.',
  options: [
    { id: 'teams', label: 'Équipes', type: 'choice', def: 4, choices: [[2, '2'], [3, '3'], [4, '4']] },
    { id: 'balls', label: 'Balles par équipe', type: 'choice', def: 2, choices: [[1, '1'], [2, '2'], [3, '3']] },
  ],
  hook: 'Quelle couleur va dominer ?',
  init(S) {
    const T = (S.T = S.opts.teams || 4);
    const VIVID = ['#ff3b5c', '#2f7bff', '#1fd36a', '#ffc021'];
    S.teams = entries(S, T).map((e, i) => ({ ...e, col: e.colSet ? e.col : VIVID[i], pct: 0 }));
    S.gx = 36; S.gy = 48; S.cs = 18;
    S.x0 = (W - S.gx * S.cs) / 2; S.y0 = 250;
    S.cells = new Uint8Array(S.gx * S.gy);
    for (let y = 0; y < S.gy; y++) for (let x = 0; x < S.gx; x++) {
      let t;
      if (T === 2) t = y < S.gy / 2 ? 0 : 1;
      else if (T === 3) t = y < S.gy / 3 ? 0 : y < (2 * S.gy) / 3 ? 1 : 2;
      else t = (y < S.gy / 2 ? 0 : 2) + (x < S.gx / 2 ? 0 : 1);
      S.cells[y * S.gx + x] = t;
    }
    S.flips = new Float32Array(S.gx * S.gy);
    S.balls = [];
    const r = S.rng;
    const per = S.opts.balls || 2;
    for (let t = 0; t < T; t++) for (let k = 0; k < per; k++) {
      // spawn inside own territory
      let cx, cy;
      for (let tries = 0; tries < 200; tries++) {
        cx = r.int(2, S.gx - 3); cy = r.int(2, S.gy - 3);
        if (S.cells[cy * S.gx + cx] === t) break;
      }
      const a = r() * TAU;
      S.balls.push({ t, x: S.x0 + (cx + 0.5) * S.cs, y: S.y0 + (cy + 0.5) * S.cs, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, r: 11, trail: S.newTrail(8) });
    }
  },
  update(S, dt) {
    const { gx, gy, cs, x0, y0, cells } = S;
    for (const b of S.balls) {
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const bs = 600 * (b.boost || 1);
      b.vx *= bs / sp; b.vy *= bs / sp;
      // axis-separated stepping for clean reflections against cells
      for (const ax of [0, 1]) {
        const nx = b.x + (ax === 0 ? b.vx * dt : 0), ny = b.y + (ax === 1 ? b.vy * dt : 0);
        const ex = nx + (ax === 0 ? Math.sign(b.vx) * b.r : 0), ey = ny + (ax === 1 ? Math.sign(b.vy) * b.r : 0);
        const cx = Math.floor((ex - x0) / cs), cy = Math.floor((ey - y0) / cs);
        if (cx < 0 || cy < 0 || cx >= gx || cy >= gy) { if (ax === 0) b.vx = -b.vx; else b.vy = -b.vy; continue; }
        const i = cy * gx + cx;
        if (cells[i] !== b.t && !S.winner) {
          cells[i] = b.t; S.flips[i] = 1;
          // a boosted ball plows through enemy ground instead of bouncing
          if (b.boost > 1 && S.rng() < 0.75) { b.x = nx; b.y = ny; continue; }
          if (ax === 0) b.vx = -b.vx; else b.vy = -b.vy;
          b.vx += (S.rng() - 0.5) * 30; b.vy += (S.rng() - 0.5) * 30;
          S.note((b.t * 3 + cx) % 10, 0.25, 'glass', 0.35);
          S.fx.sparks(ex, ey, -b.vx, -b.vy, S.teams[b.t].col, 2, 200);
        } else { b.x = nx; b.y = ny; }
      }
      b.trail.push(b.x, b.y);
    }
    // power-ups keep the war swinging: a random team gets a speed surge
    S.boostT = (S.boostT ?? 2.5) - dt;
    if (S.boostT <= 0 && !S.winner) {
      S.boostT = 2.2 + S.rng() * 1.5;
      const t = Math.floor(S.rng() * S.T);
      for (const b of S.balls) b.boost = b.t === t ? 1.6 : 1;
      const b0 = S.balls.find((b) => b.t === t);
      if (b0) { S.fx.pop(b0.x, b0.y - 30, '⚡ BOOST', '#ffffff', 30, 1); S.fx.shock(b0.x, b0.y, S.teams[t].col, 120, 0.5, 6); S.sfx('zap', { v: 0.6 }); }
    }
    for (let i = 0; i < S.flips.length; i++) if (S.flips[i] > 0) S.flips[i] = Math.max(0, S.flips[i] - dt * 3);
    const counts = new Array(S.T).fill(0);
    for (let i = 0; i < cells.length; i++) counts[cells[i]]++;
    S.teams.forEach((t, i) => (t.pct = (counts[i] / cells.length) * 100));
    if (S.vt >= S.dur - 2.5 && !S.winner) {
      const best = [...S.teams].sort((a, b) => b.pct - a.pct)[0];
      S.win(best, { sub: `${best.pct.toFixed(1)} % du terrain` });
    }
  },
  draw(S, g) {
    const { gx, gy, cs, x0, y0, cells } = S;
    for (let y = 0; y < gy; y++) for (let x = 0; x < gx; x++) {
      const i = y * gx + x, t = S.teams[cells[i]], f = S.flips[i];
      g.fillStyle = f > 0 ? lighten(t.col, f * 0.6) : ((x + y) & 1 ? t.col : darken(t.col, 0.08));
      g.fillRect(x0 + x * cs, y0 + y * cs, cs + 0.5, cs + 0.5);
    }
    g.strokeStyle = alpha('#000', 0.35); g.lineWidth = 4; g.strokeRect(x0, y0, gx * cs, gy * cs);
    for (const b of S.balls) {
      const t = S.teams[b.t];
      if (S.trails) b.trail.draw(g, '#ffffff', b.r * 1.2, false, 0.35);
      S.ball(g, b.x, b.y, b.r, darken(t.col, 0.25), { img: t.img, glow: 0.4 });
      g.strokeStyle = '#ffffff'; g.lineWidth = 2.5; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.stroke();
    }
  },
  overlay(S, g) {
    // live percentage bar
    let x = 40;
    const y = 1150, wTot = 640;
    S.teams.forEach((t) => {
      const w = (t.pct / 100) * wTot;
      g.fillStyle = t.col; g.fillRect(x, y, w, 30);
      if (w > 70) S.text(g, `${t.pct.toFixed(0)}%`, x + w / 2, y + 16, 18, '#fff', { align: 'center', stroke: true, weight: 900 });
      x += w;
    });
    S.teams.forEach((t, i) => S.text(g, `${t.emoji || '●'} ${t.name}`, 40 + (i * 640) / S.T + 320 / S.T, 1210, 20, t.col, { align: 'center', stroke: true, weight: 800, maxW: 640 / S.T - 10, emoji: false }));
  },
};

// =====================================================================================
// COURSE D'ÉVASION — four named marbles race out of spinning rings. Who escapes first?
// =====================================================================================
export const escapeRace = {
  id: 'escaperace', name: "Course d'évasion", cat: 'race', badge: '💬 Prénoms', music: true, entries: true, ending: true,
  desc: 'Quatre billes nommées s’échappent d’anneaux qui tournent. Qui sort en premier ?',
  options: [{ id: 'rings', label: 'Anneaux', type: 'choice', def: 8, choices: [[5, '5'], [8, '8'], [12, '12']] }],
  hook: 'Laquelle s’échappe en premier ?',
  init(S) {
    S.N = S.opts.rings || 8;
    S.cx = W / 2; S.cy = H / 2 + 20;
    S.rings = Array.from({ length: S.N }, (_, j) => ({ R: 90 + j * (300 / S.N), ang: S.rng() * TAU, w: (j % 2 ? -1 : 1) * (0.8 + j * 0.06), gap: 0.62 }));
    S.ents = entries(S, 4);
    S.ents.forEach((e, i) => Object.assign(e, { x: S.cx + (i - 1.5) * 24, y: S.cy, vx: (S.rng() - 0.5) * 400, vy: -200, r: 14, lvl: 0, done: false, trail: S.newTrail(12) }));
    S.finished = [];
  },
  update(S, dt) {
    const T = Math.max(4, S.dur - 3);
    const prog = clamp(S.vt / T, 0, 1);
    for (const rg of S.rings) { rg.ang += rg.w * dt; rg.gap = lerp(0.62, 1.4, prog * prog); }
    for (const e of S.ents) {
      e.vy += 1200 * dt;
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.trail.push(e.x, e.y);
      if (e.done) { if (e.y > H + 100) { e.y = H + 100; e.vy = 0; e.vx = 0; } continue; }
      const rg = S.rings[e.lvl];
      const dx = e.x - S.cx, dy = e.y - S.cy, d = Math.hypot(dx, dy);
      if (d + e.r > rg.R) {
        const a = Math.atan2(dy, dx);
        if (Math.abs(angNorm(a - rg.ang)) < rg.gap / 2) {
          e.lvl++;
          S.fx.burst(e.x, e.y, e.col, 14, 300);
          S.note(e.lvl * 2, 0.6, 'bell');
          S.fx.pop(e.x, e.y - 30, `${e.lvl}/${S.N}`, lighten(e.col, 0.4), 24, 0.7);
          if (e.lvl >= S.N) {
            e.done = true; S.finished.push(e);
            if (S.finished.length === 1) { S.win(e, { sub: 'première évadée' }); S.slowmo(0.3, 1); }
          }
        } else {
          const nx = dx / d, ny = dy / d;
          e.x = S.cx + nx * (rg.R - e.r); e.y = S.cy + ny * (rg.R - e.r);
          const vn = e.vx * nx + e.vy * ny;
          if (vn > 0) {
            e.vx -= 2 * vn * nx; e.vy -= 2 * vn * ny;
            const sp = Math.hypot(e.vx, e.vy), want = clamp(sp, 550, 1000);
            e.vx *= want / sp; e.vy *= want / sp;
            S.sfx('tick', { v: 0.3 }, 0.04);
          }
        }
      }
      // the outer side of the previous ring
      if (e.lvl > 0) {
        const pr = S.rings[e.lvl - 1];
        const d2 = Math.hypot(e.x - S.cx, e.y - S.cy);
        if (d2 - e.r < pr.R) {
          const nx = (e.x - S.cx) / d2, ny = (e.y - S.cy) / d2;
          const a = Math.atan2(ny, nx);
          if (Math.abs(angNorm(a - pr.ang)) >= pr.gap / 2) {
            e.x = S.cx + nx * (pr.R + e.r); e.y = S.cy + ny * (pr.R + e.r);
            const vn = e.vx * nx + e.vy * ny;
            if (vn < 0) { e.vx -= 2 * vn * nx; e.vy -= 2 * vn * ny; }
          }
        }
      }
    }
    // marble collisions within the same band
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const a = S.ents[i], b = S.ents[j];
      if (a.lvl !== b.lvl || a.done || b.done) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), rr = a.r + b.r;
      if (d < rr && d > 0) {
        const nx = dx / d, ny = dy / d, p = (rr - d) / 2;
        a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) { a.vx += vn * nx; a.vy += vn * ny; b.vx -= vn * nx; b.vy -= vn * ny; }
      }
    }
  },
  draw(S, g) {
    S.rings.forEach((rg, j) => {
      const col = ramp(S.cols.slice(0, 4), j / Math.max(1, S.N - 1));
      S.neon(g, () => { g.beginPath(); g.arc(S.cx, S.cy, rg.R, rg.ang + rg.gap / 2, rg.ang + TAU - rg.gap / 2); }, col, 6);
    });
    for (const e of S.ents) {
      if (S.trails) e.trail.draw(g, e.col, e.r * 1.4, S.theme.dark, 0.6);
      drawEntity(S, g, e.x, e.y, e.r, e, { vx: e.vx, vy: e.vy, label: true });
    }
  },
  overlay(S, g) {
    const order = [...S.ents].sort((a, b) => b.lvl - a.lvl);
    scoreboard(S, g, order.map((e) => ({ ...e, dead: false })), 1160, (it) => `${it.name} ${it.lvl}/${S.N}`);
  },
};

// =====================================================================================
// COURSE DE COULEURS — coloured marbles race through pegs and spinners down a long course.
// =====================================================================================
export const colorRace = {
  id: 'colorrace', name: 'Course de couleurs', cat: 'race', badge: '💬 Prénoms', music: true, entries: true, ending: true,
  desc: 'Des billes colorées dévalent un parcours de picots et de moulinets. Les spectateurs parient en commentaire.',
  options: [{ id: 'count', label: 'Billes', type: 'choice', def: 6, choices: [[4, '4'], [6, '6'], [8, '8']] }],
  hook: 'Choisis ta couleur en commentaire 👇',
  init(S) {
    const n = S.opts.count || 6;
    S.ents = entries(S, n);
    const w = (S.world = new World({ g: 900, iter: 3, damp: 0.35, maxV: 900 }));
    w.bounds = { x0: 40, x1: W - 40, e: 0.5 };
    const r = S.rng;
    // course length scales with the video duration
    const L = (S.L = Math.max(2600, (S.dur - 3) * 260));
    S.spinners = [];
    S.pegs = [];
    let y = 420;
    while (y < L - 200) {
      const kind = r.pick(['pegs', 'spinner', 'zig', 'pegs', 'bumpers']);
      if (kind === 'pegs') {
        for (let rr = 0; rr < 4; rr++) for (let c = 0; c < 7; c++) S.pegs.push(w.addPeg(90 + c * 90 + (rr % 2) * 45, y + rr * 60, 9, 0.5));
        y += 300;
      } else if (kind === 'spinner') {
        for (const x of [W * 0.3, W * 0.7]) {
          const s = w.addSeg(new Seg(x - 90, y, x + 90, y, { th: 7, e: 0.6, kin: true }));
          s.cx = x; s.cy = y; s.w = (x < W / 2 ? 1 : -1) * 3.2; s.len = 90; s.a = r() * TAU;
          S.spinners.push(s);
        }
        y += 260;
      } else if (kind === 'zig') {
        w.addSeg(new Seg(40, y, W - 160, y + 120, { th: 6, e: 0.3 }));
        w.addSeg(new Seg(W - 40, y + 220, 160, y + 340, { th: 6, e: 0.3 }));
        y += 460;
      } else {
        for (let c = 0; c < 4; c++) S.pegs.push(w.addPeg(130 + c * 155 + (r() - 0.5) * 40, y + (c % 2) * 80, 22, 1.05));
        y += 260;
      }
    }
    S.finishY = L;
    S.ents.forEach((e, i) => {
      e.body = w.add(new Body(160 + (i % 4) * 130 + r() * 20, 200 + Math.floor(i / 4) * 50, 17, { e: 0.45, data: { e } }));
      e.done = false; e.trail = S.newTrail(14);
    });
    S.order = [];
    S.camY = H / 2;
    w.onPeg = (b, p, imp) => { if (imp > 200) { p.hit = 1; S.note(Math.floor((p.x / W) * 8), 0.3, p.r > 15 ? 'bell' : 'xylo', 0.4); } };
    w.onSeg = (b, s, imp) => { if (s.kin && imp > 200) S.sfx('clank', { v: 0.35 }, 0.08); };
  },
  update(S, dt) {
    const w = S.world;
    for (const s of S.spinners) {
      s.a += s.w * dt;
      const c = Math.cos(s.a) * s.len, sn = Math.sin(s.a) * s.len;
      s.ax = s.cx - c; s.ay = s.cy - sn; s.bx = s.cx + c; s.by = s.cy + sn;
    }
    // pacing: if the leader is behind schedule, gravity grows a little
    const lead = Math.max(...S.ents.map((e) => e.body.y));
    const T = Math.max(4, S.dur - 3);
    const want = 200 + (S.finishY - 200) * clamp(S.vt / T, 0, 1);
    w.g = clamp(900 + (want - lead) * 1.2, 500, 2200);
    w.step(dt);
    for (const e of S.ents) {
      const b = e.body;
      e.trail.push(b.x, b.y);
      if (!e.done && b.y >= S.finishY) {
        e.done = true; S.order.push(e);
        S.fx.burst(b.x, b.y, e.col, 30, 600);
        S.fx.pop(b.x, b.y - 40, `${S.order.length}${S.order.length === 1 ? 'er' : 'e'}`, '#ffffff', 34);
        S.sfx('pop', { v: 0.8 });
        if (S.order.length === 1) { S.win(e, { sub: 'franchit la ligne en premier' }); S.slowmo(0.3, 1); }
      }
      if (b.y > S.finishY + 300) { b.y = S.finishY + 300; b.vy = 0; }
    }
    for (const p of S.pegs) p.hit = Math.max(0, (p.hit || 0) - dt * 3);
    // camera follows the leader (look-ahead)
    const target = clamp(lead + 120, H / 2, S.finishY + 100);
    S.camY += (target - S.camY) * Math.min(1, dt * 4);
    S.camTo(W / 2, S.camY, 1, 50);
    S.camSnap();
  },
  draw(S, g) {
    const top = S.camY - H / 2 - 50, bot = S.camY + H / 2 + 50;
    // side rails with distance marks
    g.strokeStyle = alpha(S.theme.fg, 0.25); g.lineWidth = 6;
    g.beginPath(); g.moveTo(40, top); g.lineTo(40, bot); g.moveTo(W - 40, top); g.lineTo(W - 40, bot); g.stroke();
    for (let y = Math.ceil(top / 200) * 200; y < bot; y += 200) S.text(g, `${Math.round((S.finishY - y) / 10)} m`, 58, y, 16, alpha(S.theme.fg, 0.4), { weight: 700 });
    for (const p of S.pegs) {
      if (p.y < top - 30 || p.y > bot + 30) continue;
      if (p.r > 15) { S.ball(g, p.x, p.y, p.r * (1 + (p.hit || 0) * 0.2), S.col(3), { mat: 'glossy', glow: 0.5 + (p.hit || 0) }); }
      else { g.fillStyle = p.hit ? lighten(S.col(1), 0.5) : alpha(S.theme.fg, 0.8); g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); }
    }
    for (const s of S.world.segs) {
      if (Math.max(s.ay, s.by) < top || Math.min(s.ay, s.by) > bot) continue;
      S.neon(g, () => { g.beginPath(); g.moveTo(s.ax, s.ay); g.lineTo(s.bx, s.by); }, s.kin ? S.col(0) : S.col(2), s.th * 2);
      if (s.kin) S.ball(g, s.cx, s.cy, 10, '#ffffff', { mat: 'chrome', glow: 0 });
    }
    // finish line (checkerboard)
    if (S.finishY > top && S.finishY < bot) {
      for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? '#ffffff' : '#111111';
        g.fillRect(40 + i * 20, S.finishY + j * 20, 20, 20);
      }
    }
    for (const e of S.ents) {
      if (S.trails) e.trail.draw(g, e.col, 22, S.theme.dark, 0.5);
      drawEntity(S, g, e.body.x, e.body.y, e.body.r, e, { vx: e.body.vx, vy: e.body.vy, label: true });
    }
  },
  overlay(S, g) {
    // live ranking
    const order = [...S.ents].sort((a, b) => (a.done && b.done ? S.order.indexOf(a) - S.order.indexOf(b) : b.body.y - a.body.y));
    scoreboard(S, g, order.map((e) => ({ ...e })), 1170, (it) => `${order.indexOf(S.ents.find((x) => x.name === it.name)) + 1}. ${it.name}`);
  },
};
