// LOOPLAB — crush & slice: industrial machines, ASMR-level satisfying.
import { TAU, clamp, lerp, angNorm, alpha, lighten, darken, ramp, easeInCubic, easeOutCubic, roundRect, closestOnSeg } from '../core/util.js';
import { World, Body, Seg } from '../core/physics.js';
import { drawGlow } from '../core/materials.js';

const W = 720, H = 1280;
const MAX_BODIES = 380;

/** Brushed-steel rectangle with bevel + optional hazard stripes. */
function steel(g, x, y, w, h, o = {}) {
  const gr = g.createLinearGradient(x, y, x, y + h);
  gr.addColorStop(0, o.top || '#d9dee8'); gr.addColorStop(0.5, o.mid || '#9aa3b5'); gr.addColorStop(1, o.bot || '#59607a');
  g.fillStyle = gr;
  roundRect(g, x, y, w, h, o.r ?? 8); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(x + 6, y + 2); g.lineTo(x + w - 6, y + 2); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.beginPath(); g.moveTo(x + 6, y + h - 1); g.lineTo(x + w - 6, y + h - 1); g.stroke();
  if (o.hazard) {
    g.save();
    roundRect(g, x, y + h - o.hazard, w, o.hazard, 4); g.clip();
    g.fillStyle = '#ffcc00'; g.fillRect(x, y + h - o.hazard, w, o.hazard);
    g.fillStyle = '#111';
    for (let i = -2; i < w / 18 + 2; i++) { g.beginPath(); g.moveTo(x + i * 18, y + h); g.lineTo(x + i * 18 + 9, y + h); g.lineTo(x + i * 18 + 9 + o.hazard, y + h - o.hazard); g.lineTo(x + i * 18 + o.hazard, y + h - o.hazard); g.closePath(); g.fill(); }
    g.restore();
  }
  if (o.bolts) {
    for (const [bx, by] of [[x + 10, y + 10], [x + w - 10, y + 10], [x + 10, y + h - 10], [x + w - 10, y + h - 10]]) {
      g.fillStyle = '#5b6275'; g.beginPath(); g.arc(bx, by, 4, 0, TAU); g.fill();
      g.fillStyle = '#e6eaf2'; g.beginPath(); g.arc(bx - 1, by - 1, 1.6, 0, TAU); g.fill();
    }
  }
}

function crushFx(S, x, y, col, big = 1) {
  S.fx.burst(x, y, col, 18 * big, 420 * big, { grav: 900, smoke: alpha(darken(col, 0.3), 0.5) });
  S.fx.sparks(x, y, 0, -1, '#ffd27a', 10 * big, 700, 1.4);
  S.sfx('crush', { v: Math.min(1, 0.5 + big * 0.3) }, 0.05);
  S.shake(0.12 * big);
}

/** Splits a body in two (equal area). Caps the population. */
function split(S, w, b, ang, kick = 260) {
  // too small or too many: the ball resists (sparks) instead of vanishing, so counts only grow
  if (w.bodies.length >= MAX_BODIES || b.r / Math.SQRT2 < 4.5) {
    b.data.cool = 0.4;
    S.fx.sparks(b.x, b.y, Math.cos(ang), Math.sin(ang), '#ffffff', 3, 300);
    return false;
  }
  const kids = w.split(b, ang, kick, 4);
  if (!kids) return false;
  for (const k of kids) { k.data.cool = 0.25; k.col = b.col; }
  S.splits = (S.splits || 0) + 1;
  S.fx.burst(b.x, b.y, b.col, 8, 300, { grav: 400, shards: true });
  S.fx.sparks(b.x, b.y, Math.cos(ang), Math.sin(ang), '#ffffff', 5, 500, 1.2);
  S.note(S.splits % 12, 0.4, 'pluck');
  S.sfx('crush', { v: 0.45 }, 0.05);
  return true;
}

function drawBodies(S, g, w) {
  for (const b of w.bodies) if (b.alive) S.ball(g, b.x, b.y, b.r, b.col, { glow: 0.35, vx: b.vx, vy: b.vy, squash: 0.6 });
}

function cooldown(w, dt) { for (const b of w.bodies) if (b.data.cool > 0) b.data.cool -= dt; }

// =====================================================================================
// PRESSE HYDRAULIQUE — marbles ride a conveyor and a hydraulic press crushes them.
// =====================================================================================
export const hydraulicPress = {
  id: 'hydraulic', name: 'Presse hydraulique', cat: 'crush', music: true,
  desc: 'Des billes avancent sur un tapis et une presse hydraulique les écrase une par une.',
  options: [{ id: 'every', label: 'Écrase sur', type: 'choice', def: 1, choices: [[1, 'chaque temps'], [2, 'un temps sur deux']] }],
  hook: 'La presse ne rate jamais 😮‍💨',
  init(S) {
    S.beltY = 980; S.pressX = W / 2; S.belt = 0;
    S.speed = 260;
    S.marbles = [];
    S.pancakes = [];
    S.crushed = 0;
    S.press = 0; // 0 = up, 1 = down
    const every = S.opts.every || 1;
    // one marble arrives under the press on each slam beat
    S.slams = S.song.beats.filter((t, i) => i % every === 0 && t > 0.9);
    S.spawns = S.slams.map((t) => t - (S.pressX + 40) / S.speed);
    S.si = 0;
    S.setCounter(0, { style: 'top', label: 'Écrasées :' });
  },
  pressAt(S, t) {
    // descends in 0.14 s onto the beat, holds, rises over 0.35 s
    let y = 0;
    for (const sl of S.slams) {
      const d = t - sl;
      if (d < -0.14 || d > 0.5) continue;
      if (d < 0) y = Math.max(y, easeInCubic((d + 0.14) / 0.14));
      else if (d < 0.08) y = 1;
      else y = Math.max(y, 1 - easeOutCubic((d - 0.08) / 0.42));
    }
    return y;
  },
  update(S, dt) {
    S.belt += S.speed * dt;
    while (S.si < S.spawns.length && S.spawns[S.si] <= S.vt) {
      S.si++;
      S.marbles.push({ x: -40, y: S.beltY - 26 - 140, vy: 0, r: 26, col: S.col(S.si), rot: 0, landed: false });
    }
    const prev = S.press;
    S.press = this.pressAt(S, S.vt);
    const plateY = 330 + S.press * (S.beltY - 330 - 60);
    for (const m of S.marbles) {
      m.x += S.speed * dt;
      m.rot += (S.speed * dt) / m.r;
      if (m.y < S.beltY - m.r) { m.vy += 2200 * dt; m.y = Math.min(S.beltY - m.r, m.y + m.vy * dt); if (m.y >= S.beltY - m.r && !m.landed) { m.landed = true; S.sfx('thud', { v: 0.3 }, 0.05); } }
      if (!m.dead && plateY + 60 > S.beltY - m.r * 2 && Math.abs(m.x - S.pressX) < 120) {
        m.dead = true;
        S.crushed++;
        S.pancakes.push({ x: m.x, col: m.col, w: m.r * 3.2, t: 0 });
        crushFx(S, m.x, S.beltY - 10, m.col, 1.3);
        S.fx.shock(m.x, S.beltY - 10, m.col, 160, 0.35, 6);
        S.flash(0.18, m.col);
        S.setCounter(S.crushed, { style: 'top', label: 'Écrasées :' });
      }
    }
    if (prev < 0.98 && S.press >= 0.98) S.sfx('clank', { v: 0.6 }, 0.1);
    S.marbles = S.marbles.filter((m) => !m.dead && m.x < W + 60);
    for (const p of S.pancakes) { p.x += S.speed * dt; p.t += dt; }
    S.pancakes = S.pancakes.filter((p) => p.x < W + 120);
    if (S.justDropped) { S.punchHook(); S.flash(0.4, '#ffffff'); }
  },
  draw(S, g) {
    // conveyor
    const y = S.beltY;
    steel(g, -10, y, W + 20, 60, { r: 30, top: '#3a3f4e', mid: '#262a35', bot: '#14161d' });
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3;
    for (let x = -(S.belt % 40); x < W; x += 40) { g.beginPath(); g.moveTo(x, y + 6); g.lineTo(x + 14, y + 6); g.stroke(); }
    for (let x = 30; x < W; x += 110) { S.ball(g, x, y + 30, 22, '#8a93a8', { mat: 'chrome', glow: 0, rot: S.belt / 22 }); }
    // pancakes (flattened marbles riding on the belt)
    for (const p of S.pancakes) {
      const k = Math.min(1, p.t * 8);
      g.fillStyle = darken(p.col, 0.1);
      g.beginPath(); g.ellipse(p.x, y - 4, p.w * (0.6 + k * 0.4), 8, 0, 0, TAU); g.fill();
      g.fillStyle = alpha(lighten(p.col, 0.4), 0.6);
      g.beginPath(); g.ellipse(p.x - 6, y - 7, p.w * 0.4, 3, 0, 0, TAU); g.fill();
      for (let i = 0; i < 5; i++) { g.fillStyle = p.col; g.beginPath(); g.arc(p.x + Math.cos(i * 1.7) * p.w * 0.9, y - 3, 3, 0, TAU); g.fill(); }
    }
    for (const m of S.marbles) S.ball(g, m.x, m.y, m.r, m.col, { glow: 0.4, rot: m.rot });
    // press: frame, cylinder, rod, plate
    const plateY = 330 + S.press * (S.beltY - 330 - 60);
    steel(g, S.pressX - 230, 150, 40, S.beltY - 150, { r: 6 });
    steel(g, S.pressX + 190, 150, 40, S.beltY - 150, { r: 6 });
    steel(g, S.pressX - 240, 140, 480, 70, { r: 10, bolts: true });
    steel(g, S.pressX - 70, 200, 140, 120, { r: 12, top: '#e14b4b', mid: '#a8282d', bot: '#5e1316' });
    const rg = g.createLinearGradient(S.pressX - 22, 0, S.pressX + 22, 0);
    rg.addColorStop(0, '#6b7385'); rg.addColorStop(0.45, '#ffffff'); rg.addColorStop(1, '#5a6172');
    g.fillStyle = rg; g.fillRect(S.pressX - 22, 320, 44, plateY - 320);
    steel(g, S.pressX - 150, plateY, 300, 60, { r: 6, hazard: 16, bolts: true });
    if (S.press > 0.9) drawGlow(g, S.pressX, S.beltY - 8, 220, '#ffb347', 0.5);
  },
};

// =====================================================================================
// BOCARDS — a row of industrial hammers crushes marbles right on the beat.
// =====================================================================================
export const stampMill = {
  id: 'stampmill', name: 'Bocards', cat: 'crush', badge: '♪ Synchro musique', music: true,
  desc: 'Une rangée de marteaux industriels écrase les billes pile sur le rythme.',
  options: [{ id: 'hammers', label: 'Marteaux', type: 'choice', def: 5, choices: [[3, '3'], [5, '5'], [7, '7']] }],
  hook: 'Le rythme le plus lourd du monde',
  init(S) {
    S.n = S.opts.hammers || 5;
    S.trough = 940;
    S.hx = Array.from({ length: S.n }, (_, i) => 130 + (i * 480) / Math.max(1, S.n - 1));
    S.hy = new Float32Array(S.n);
    S.marbles = [];
    S.spawnT = 0;
    S.count = 0;
    S.slamQ = []; // pending slams {i, t}
    S.setCounter(0, { style: 'top', label: 'Coups :' });
  },
  update(S, dt) {
    S.spawnT -= dt;
    const tail = S.marbles.reduce((m, x) => Math.min(m, x.x - x.r), 1e9);
    if (S.spawnT <= 0 && tail > 20) {
      S.spawnT = 0.62;
      S.marbles.push({ x: -40, r: 30, col: S.col(S.spawnN = (S.spawnN || 0) + 1), y: S.trough - 30 - 60, vy: 0, cool: 0 });
    }
    // every beat: a ripple of slams across the row
    if (S.beat) for (let i = 0; i < S.n; i++) S.slamQ.push({ i, t: S.vt + i * (S.dropped ? 0.04 : 0.07) });
    for (let i = 0; i < S.n; i++) S.hy[i] = Math.max(0, S.hy[i] - dt * 2.8);
    for (const q of S.slamQ) if (!q.done && S.vt >= q.t) {
      q.done = true;
      S.hy[q.i] = 1;
      S.count++;
      S.sfx('clank', { v: 0.35 }, 0.03);
      const hx = S.hx[q.i];
      for (const m of [...S.marbles]) {
        if (m.dead || m.cool > 0 || Math.abs(m.x - hx) > 36) continue;
        m.dead = true;
        if (m.r > 10) {
          // split into two smaller pieces that keep flowing to the next hammer
          const r2 = m.r / Math.SQRT2;
          S.marbles.push({ x: m.x + r2 * 0.3, r: r2, col: m.col, y: S.trough - r2 - 40, vy: -320, cool: 0.4 });
          S.marbles.push({ x: m.x + r2 * 2.4, r: r2, col: m.col, y: S.trough - r2 - 40, vy: -420, cool: 0.4 });
          crushFx(S, m.x, S.trough - 6, m.col, m.r / 30);
        } else crushFx(S, m.x, S.trough - 4, m.col, 0.4);
        S.note(q.i * 2, 0.5, 'marimba');
      }
      S.setCounter(S.count, { style: 'top', label: 'Coups :', punch: false });
    }
    S.slamQ = S.slamQ.filter((q) => !q.done);
    for (const m of S.marbles) {
      m.cool -= dt;
      m.x += 140 * dt;
      m.vy += 2400 * dt; m.y += m.vy * dt;
      if (m.y > S.trough - m.r) { m.y = S.trough - m.r; m.vy = 0; }
    }
    S.marbles = S.marbles.filter((m) => !m.dead && m.x < W + 50);
    // single-file queue: marbles never overlap on the trough
    S.marbles.sort((a, b) => a.x - b.x);
    for (let i = 1; i < S.marbles.length; i++) {
      const a = S.marbles[i - 1], b = S.marbles[i];
      b.x = Math.max(b.x, a.x + a.r + b.r + 3); // the queue only ever pushes forward
    }
    S.marbles = S.marbles.filter((m) => m.x < W + 50);
    if (S.justDropped) { S.punchHook(); S.flash(0.4, '#ffffff'); S.shake(0.5); }
  },
  draw(S, g) {
    steel(g, 0, S.trough, W, 90, { r: 0, top: '#4a4f60', mid: '#2c303c', bot: '#15171e' });
    steel(g, 30, 190, W - 60, 60, { r: 10, bolts: true });
    // cam shaft
    g.strokeStyle = '#9aa3b5'; g.lineWidth = 16; g.beginPath(); g.moveTo(40, 290); g.lineTo(W - 40, 290); g.stroke();
    for (let i = 0; i < S.n; i++) {
      const x = S.hx[i], k = S.hy[i];
      const y = lerp(330, S.trough - 130, easeInCubic(k));
      // cam lobe
      g.save(); g.translate(x, 290); g.rotate(S.vt * 6 + i);
      g.fillStyle = '#6b7385'; g.beginPath(); g.ellipse(10, 0, 30, 18, 0, 0, TAU); g.fill(); g.restore();
      // guide rails + stem
      g.fillStyle = '#3b4150'; g.fillRect(x - 40, 250, 6, 600); g.fillRect(x + 34, 250, 6, 600);
      const rg = g.createLinearGradient(x - 10, 0, x + 10, 0);
      rg.addColorStop(0, '#5a6172'); rg.addColorStop(0.5, '#f0f2f8'); rg.addColorStop(1, '#5a6172');
      g.fillStyle = rg; g.fillRect(x - 10, 290, 20, y - 290);
      steel(g, x - 36, y, 72, 130, { r: 6, hazard: 14, top: S.col(i), mid: darken(S.col(i), 0.3), bot: darken(S.col(i), 0.6) });
      if (k > 0.85) drawGlow(g, x, S.trough - 10, 70, '#ffb347', k * 0.5);
    }
    for (const m of S.marbles) S.ball(g, m.x, m.y, m.r, m.col, { glow: 0.08, rot: m.x / m.r });
  },
};

// =====================================================================================
// BROYEUR À ROULEAUX — marbles fall into a hopper and get chewed by two toothed rollers.
// =====================================================================================
export const rollerCrusher = {
  id: 'rollercrusher', name: 'Broyeur à rouleaux', cat: 'crush', music: true,
  desc: 'Des billes tombent dans une trémie et se font mâcher par deux rouleaux dentés géants.',
  options: [{ id: 'size', label: 'Taille des billes', type: 'choice', def: 22, choices: [[16, 'Petites'], [22, 'Moyennes'], [30, 'Grosses']] }],
  hook: 'Rien ne survit aux rouleaux',
  init(S) {
    const w = (S.world = new World({ g: 1500, iter: 3, damp: 0.4 }));
    S.rr = 120; S.ry = 760; S.rx = [W / 2 - S.rr - 6, W / 2 + S.rr + 6];
    w.addSeg(new Seg(60, 250, 225, 640, { th: 7, e: 0.2 }));
    w.addSeg(new Seg(W - 60, 250, W - 225, 640, { th: 7, e: 0.2 }));
    for (const x of S.rx) w.add(new Body(x, S.ry, S.rr, { static: true, e: 0.2 }));
    S.ang = 0; S.chewing = []; S.chewed = 0; S.spawnT = 0;
    S.debris = [];
    S.setCounter(0, { style: 'top', label: 'Broyées :' });
  },
  update(S, dt) {
    const w = S.world;
    const spd = S.dropped ? 3.2 : 2;
    S.ang += dt * spd;
    S.spawnT -= dt;
    if (S.spawnT <= 0) {
      S.spawnT = S.dropped ? 0.16 : 0.3;
      const r = (S.opts.size || 22) * (0.8 + S.rng() * 0.4);
      w.add(new Body(160 + S.rng() * 400, 120, r, { e: 0.3, col: S.col(Math.floor(S.rng() * 5)), data: {} }));
    }
    // rollers drag marbles toward the nip
    for (const b of w.bodies) {
      if (b.static || !b.alive) continue;
      for (let k = 0; k < 2; k++) {
        const dx = b.x - S.rx[k], dy = b.y - S.ry, d = Math.hypot(dx, dy);
        if (d < S.rr + b.r + 3) {
          const dir = k === 0 ? 1 : -1; // left turns clockwise, right counter-clockwise → both pull down in the middle
          const tx = (-dy / d) * dir, ty = (dx / d) * dir;
          b.vx += tx * 900 * dt; b.vy += ty * 900 * dt;
        }
      }
      if (Math.abs(b.x - W / 2) < 30 + b.r * 0.4 && b.y > S.ry - S.rr * 0.75 && b.y < S.ry + 10) {
        b.alive = false;
        S.chewing.push({ x: W / 2, y: b.y, r: b.r, col: b.col, t: 0 });
        S.chewed++;
        S.sfx('crush', { v: 0.7 }, 0.05);
        S.note(S.chewed % 10, 0.45, 'pluck');
        S.setCounter(S.chewed, { style: 'top', label: 'Broyées :' });
      }
    }
    w.step(dt);
    w.clean();
    for (const c of S.chewing) {
      c.t += dt;
      c.y += 140 * dt;
      if (S.rng() < 0.6) S.fx.sparks(c.x, S.ry, (S.rng() - 0.5) * 2, 1, '#ffd27a', 2, 500, 0.6);
      if (S.rng() < 0.5) S.debris.push({ x: c.x + (S.rng() - 0.5) * 30, y: S.ry + 20, vx: (S.rng() - 0.5) * 300, vy: 200 + S.rng() * 200, s: 3 + S.rng() * 5, col: c.col, rot: S.rng() * TAU });
    }
    for (const c of S.chewing) if (c.t > 0.45 && !c.out) { c.out = true; S.fx.burst(W / 2, S.ry + 60, c.col, 16, 380, { grav: 900 }); S.shake(0.08); }
    S.chewing = S.chewing.filter((c) => c.t < 0.5);
    for (const d of S.debris) { d.vy += 1600 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += dt * 8; if (d.y > 1180) { d.y = 1180; d.vy = 0; d.vx *= 0.8; } }
    if (S.debris.length > 500) S.debris.splice(0, S.debris.length - 500);
    if (S.justDropped) { S.punchHook(); S.flash(0.4, '#ffffff'); }
  },
  roller(S, g, x, dir) {
    g.save();
    g.translate(x, S.ry);
    g.rotate(S.ang * dir);
    const n = 18;
    g.fillStyle = '#7d869a';
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * TAU, rr = i % 2 ? S.rr - 4 : S.rr + 10;
      i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
    const gr = g.createRadialGradient(-30, -30, 10, 0, 0, S.rr);
    gr.addColorStop(0, '#f2f4fa'); gr.addColorStop(0.6, '#9aa3b5'); gr.addColorStop(1, '#4a5163');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, S.rr - 10, 0, TAU); g.fill();
    g.fillStyle = '#2a2e38'; g.beginPath(); g.arc(0, 0, 24, 0, TAU); g.fill();
    for (let i = 0; i < 6; i++) { g.rotate(TAU / 6); g.fillStyle = '#c7cddb'; g.beginPath(); g.arc(50, 0, 7, 0, TAU); g.fill(); }
    g.restore();
  },
  draw(S, g) {
    S.neon(g, () => { g.beginPath(); g.moveTo(60, 250); g.lineTo(225, 640); g.moveTo(W - 60, 250); g.lineTo(W - 225, 640); }, S.col(1), 10);
    for (const d of S.debris) { g.save(); g.translate(d.x, d.y); g.rotate(d.rot); g.fillStyle = d.col; g.fillRect(-d.s / 2, -d.s / 2, d.s, d.s * 0.7); g.restore(); }
    drawBodies(S, g, S.world);
    for (const c of S.chewing) {
      const k = c.t / 0.5;
      g.save();
      g.beginPath(); g.rect(0, 0, W, S.ry); g.clip();
      S.ball(g, c.x, c.y, c.r * (1 - k * 0.6), c.col, { wobble: k * 0.5 });
      g.restore();
    }
    this.roller(S, g, S.rx[0], 1);
    this.roller(S, g, S.rx[1], -1);
  },
};

// =====================================================================================
// CONCASSEUR À MÂCHOIRES — steel jaws crack every marble into smaller and smaller pieces.
// =====================================================================================
export const jawCrusher = {
  id: 'jawcrusher', name: 'Concasseur à mâchoires', cat: 'crush', music: true,
  desc: 'Des mâchoires d’acier cassent chaque bille en morceaux de plus en plus petits.',
  options: [],
  hook: 'De plus en plus petit…',
  init(S) {
    const w = (S.world = new World({ g: 1400, iter: 4, damp: 0.5 }));
    S.fixed = w.addSeg(new Seg(150, 360, 330, 1000, { th: 14, e: 0.15 }));
    S.jaw = w.addSeg(new Seg(570, 360, 390, 1000, { th: 14, e: 0.15, kin: true }));
    w.addSeg(new Seg(330, 1180, 390, 1180, { th: 6 }));
    S.spawnT = 0; S.cracks = 0;
    S.bin = [];
    S.setCounter(0, { style: 'top', label: 'Cassures :' });
  },
  update(S, dt) {
    const w = S.world;
    S.spawnT -= dt;
    if (S.spawnT <= 0) { S.spawnT = 0.9; w.add(new Body(260 + S.rng() * 200, 150, 34 + S.rng() * 10, { e: 0.2, col: S.col(Math.floor(S.rng() * 5)), data: { cool: 0 } })); }
    // eccentric motion of the moving jaw (faster after the drop)
    const f = S.dropped ? 3.2 : 2;
    const o = Math.sin(S.vt * TAU * f / 2) * 26;
    const top = 570 + o * 0.4, bot = 390 + o;
    S.jaw.set(top, 360, bot, 1000, dt);
    S.jaw.closing = Math.cos(S.vt * TAU * f / 2) < 0;
    w.step(dt);
    cooldown(w, dt);
    // squeeze test: touching both jaws while the moving jaw closes
    for (const b of [...w.bodies]) {
      if (!b.alive || b.data.cool > 0) continue;
      const [ax, ay] = closestOnSeg(b.x, b.y, S.fixed.ax, S.fixed.ay, S.fixed.bx, S.fixed.by);
      const [bx, by] = closestOnSeg(b.x, b.y, S.jaw.ax, S.jaw.ay, S.jaw.bx, S.jaw.by);
      const d1 = Math.hypot(b.x - ax, b.y - ay) - 14, d2 = Math.hypot(b.x - bx, b.y - by) - 14;
      if (d1 < b.r + 2 && d2 < b.r + 2 && S.jaw.closing && b.r > 7) {
        if (split(S, w, b, Math.atan2(by - ay, bx - ax) + Math.PI / 2, 120)) {
          S.cracks++;
          S.setCounter(S.cracks, { style: 'top', label: 'Cassures :' });
        }
      }
    }
    for (const b of w.bodies) if (b.alive && b.y > 1060) { b.alive = false; S.bin.push({ x: 360 + (S.rng() - 0.5) * 260, col: b.col, r: b.r }); S.sfx('tick', { v: 0.3 }, 0.03); }
    if (S.bin.length > 260) S.bin.splice(0, S.bin.length - 260);
    w.clean();
    if (S.justDropped) { S.punchHook(); S.flash(0.4, '#ffffff'); }
  },
  draw(S, g) {
    const jaw = (s, toothDir) => {
      const len = Math.hypot(s.bx - s.ax, s.by - s.ay), a = Math.atan2(s.by - s.ay, s.bx - s.ax);
      g.save(); g.translate(s.ax, s.ay); g.rotate(a);
      steel(g, 0, -26, len, 52, { r: 10, bolts: true });
      g.fillStyle = '#4a5163';
      for (let x = 20; x < len - 10; x += 36) { g.beginPath(); g.moveTo(x, toothDir * 26); g.lineTo(x + 18, toothDir * 40); g.lineTo(x + 36, toothDir * 26); g.fill(); }
      g.restore();
    };
    jaw(S.fixed, -1);
    jaw(S.jaw, 1);
    // bin of gravel
    g.fillStyle = alpha(S.theme.fg, 0.08); g.fillRect(150, 1080, 420, 140);
    for (const p of S.bin) S.ball(g, p.x, 1206 - (S.bin.indexOf(p) / 260) * 60, Math.max(3, p.r), p.col, { glow: 0 });
    drawBodies(S, g, S.world);
  },
};

// =====================================================================================
// ÉTOILE À PISTONS — five pistons crush every ball against the wall; each splits in two.
// =====================================================================================
export const pistonStar = {
  id: 'pistonstar', name: 'Étoile à pistons', cat: 'crush', music: true,
  desc: 'Cinq pistons écrasent chaque balle contre la paroi. Chaque balle écrasée éclate en deux.',
  options: [{ id: 'pistons', label: 'Pistons', type: 'choice', def: 5, choices: [[3, '3'], [5, '5'], [7, '7']] }],
  hook: '1 balle… combien à la fin ?',
  init(S) {
    S.cx = W / 2; S.cy = H / 2 + 40; S.R = 310;
    S.np = S.opts.pistons || 5;
    const w = (S.world = new World({ g: 0, iter: 3, damp: 0.05 }));
    S.pistons = Array.from({ length: S.np }, (_, i) => {
      const a = -Math.PI / 2 + (i * TAU) / S.np;
      return { a, ext: 0, seg: w.addSeg(new Seg(0, 0, 1, 1, { th: 8, e: 0.6, kin: true })), ph: i / S.np };
    });
    const b = w.add(new Body(S.cx, S.cy, 80, { e: 0.95, col: S.col(0), data: {} }));
    b.vx = 420; b.vy = 260;
    S.setCounter(1, { style: 'top', label: 'Balles :' });
  },
  update(S, dt) {
    const w = S.world;
    const period = S.song.spb * 2;
    for (const p of S.pistons) {
      const ph = ((S.vt / period + p.ph) % 1 + 1) % 1;
      p.ext = ph < 0.25 ? easeInCubic(ph / 0.25) : ph < 0.35 ? 1 : 1 - (ph - 0.35) / 0.65;
      const d = S.R - p.ext * 260;
      const nx = Math.cos(p.a), ny = Math.sin(p.a), tx = -ny, ty = nx;
      const fx = S.cx + nx * d, fy = S.cy + ny * d;
      p.seg.set(fx + tx * 60, fy + ty * 60, fx - tx * 60, fy - ty * 60, dt);
      p.face = [fx, fy, nx, ny];
      p.pushing = ph < 0.35;
    }
    w.step(dt);
    cooldown(w, dt);
    w.containCircle(S.cx, S.cy, S.R, 0.95, (b, vn) => { if (vn > 300) S.note(Math.floor(b.r) % 10, 0.25, 'glass', 0.3); });
    // crush: a ball pinned between a pushing piston face and the wall/another ball
    for (const p of S.pistons) {
      if (!p.pushing) continue;
      const [fx, fy, nx, ny] = p.face;
      for (const b of [...w.bodies]) {
        if (!b.alive || b.data.cool > 0) continue;
        const along = (b.x - fx) * -nx + (b.y - fy) * -ny; // distance in front of the face (toward centre)
        const lat = Math.abs((b.x - fx) * -ny + (b.y - fy) * nx);
        if (along > -b.r * 0.3 && along < b.r + 10 && lat < 70) {
          const dWall = S.R - Math.hypot(b.x - S.cx, b.y - S.cy);
          if (b.press > b.r * 0.06 || b.contacts >= 2 || dWall < b.r * 1.3) {
            if (split(S, w, b, p.a + Math.PI / 2, 300)) S.fx.shock(b.x, b.y, b.col, 90, 0.3, 4);
          }
        }
      }
    }
    for (const b of w.bodies) { const sp = Math.hypot(b.vx, b.vy); if (sp < 250) { b.vx *= 1.05; b.vy *= 1.05; } }
    w.clean();
    S.setCounter(w.bodies.length, { style: 'top', label: 'Balles :' });
    if (S.justDropped) { S.punchHook(); S.flash(0.4, '#ffffff'); S.shake(0.5); }
  },
  draw(S, g) {
    g.fillStyle = alpha(S.theme.fg, 0.04);
    g.beginPath(); g.arc(S.cx, S.cy, S.R, 0, TAU); g.fill();
    S.neon(g, () => { g.beginPath(); g.arc(S.cx, S.cy, S.R, 0, TAU); }, S.col(1), 6);
    drawBodies(S, g, S.world);
    for (const p of S.pistons) {
      const d = S.R - p.ext * 260;
      g.save(); g.translate(S.cx, S.cy); g.rotate(p.a);
      // rod from outside the arena to the face
      const rg = g.createLinearGradient(0, -12, 0, 12);
      rg.addColorStop(0, '#5a6172'); rg.addColorStop(0.5, '#ffffff'); rg.addColorStop(1, '#5a6172');
      g.fillStyle = rg; g.fillRect(d, -12, S.R + 80 - d, 24);
      steel(g, S.R + 40, -40, 70, 80, { r: 8, top: S.col(2), mid: darken(S.col(2), 0.3), bot: darken(S.col(2), 0.6) });
      g.save(); g.translate(d, 0); g.rotate(Math.PI / 2);
      steel(g, -62, -16, 124, 26, { r: 5, hazard: 10 });
      g.restore();
      g.restore();
    }
  },
};

// =====================================================================================
// CONCASSEUR GIRATOIRE — a giant off-centre wheel hunts the balls; every squeeze makes two.
// =====================================================================================
export const gyratory = {
  id: 'gyratory', name: 'Concasseur giratoire', cat: 'crush', music: true,
  desc: 'Une roue géante excentrée chasse les balles autour du cercle. Chaque pincement en fait deux.',
  options: [],
  hook: 'La roue finit toujours par les attraper',
  init(S) {
    S.cx = W / 2; S.cy = H / 2 + 40; S.R = 320; S.rw = 170;
    S.wa = 0; S.spin = 0;
    const w = (S.world = new World({ g: 0, iter: 3, damp: 0.1 }));
    for (let i = 0; i < 3; i++) { const b = w.add(new Body(S.cx + (i - 1) * 70, S.cy - 170, 44, { e: 0.9, col: S.col(i), data: {} })); b.vx = 300 * (i - 1); b.vy = 200; }
    S.setCounter(3, { style: 'top', label: 'Balles :' });
  },
  update(S, dt) {
    const w = S.world;
    const sp = S.dropped ? 2.4 : 1.4;
    S.wa += dt * sp;
    S.spin -= dt * sp * (S.R / S.rw - 1); // rolling without slipping
    const off = S.R - S.rw - 6;
    const wx = S.cx + Math.cos(S.wa) * off, wy = S.cy + Math.sin(S.wa) * off;
    const wvx = -Math.sin(S.wa) * off * sp, wvy = Math.cos(S.wa) * off * sp;
    S.wx = wx; S.wy = wy;
    w.step(dt);
    cooldown(w, dt);
    w.containCircle(S.cx, S.cy, S.R, 0.85);
    for (const b of [...w.bodies]) {
      if (!b.alive) continue;
      const dx = b.x - wx, dy = b.y - wy, d = Math.hypot(dx, dy);
      if (d < S.rw + b.r + 8) {
        const nx = dx / d, ny = dy / d;
        if (d < S.rw + b.r) {
          b.x = wx + nx * (S.rw + b.r); b.y = wy + ny * (S.rw + b.r);
          const rvx = b.vx - wvx, rvy = b.vy - wvy, vn = rvx * nx + rvy * ny;
          if (vn < 0) { b.vx -= 1.8 * vn * nx; b.vy -= 1.8 * vn * ny; }
        }
        // pinched between wheel and wall → split
        const dw = S.R - Math.hypot(b.x - S.cx, b.y - S.cy);
        if (dw < b.r + 10 && !(b.data.cool > 0)) split(S, w, b, Math.atan2(ny, nx) + Math.PI / 2, 220);
      }
    }
    w.containCircle(S.cx, S.cy, S.R, 0.85);
    for (const b of w.bodies) { const s = Math.hypot(b.vx, b.vy); if (s < 200) { b.vx += (S.rng() - 0.5) * 60; b.vy += (S.rng() - 0.5) * 60; } }
    w.clean();
    S.setCounter(w.bodies.length, { style: 'top', label: 'Balles :' });
    if (S.justDropped) { S.punchHook(); S.flash(0.4, '#ffffff'); S.shake(0.5); }
  },
  draw(S, g) {
    g.fillStyle = alpha(S.theme.fg, 0.05);
    g.beginPath(); g.arc(S.cx, S.cy, S.R, 0, TAU); g.fill();
    S.neon(g, () => { g.beginPath(); g.arc(S.cx, S.cy, S.R, 0, TAU); }, S.col(1), 8);
    drawBodies(S, g, S.world);
    // the wheel: geared steel with spokes
    g.save(); g.translate(S.wx, S.wy); g.rotate(S.spin);
    const gr = g.createRadialGradient(-50, -50, 20, 0, 0, S.rw);
    gr.addColorStop(0, '#f0f3fa'); gr.addColorStop(0.7, '#8c95a9'); gr.addColorStop(1, '#3f4556');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, S.rw, 0, TAU); g.fill();
    g.strokeStyle = '#2b303c'; g.lineWidth = 3;
    for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * (S.rw - 14), Math.sin(a) * (S.rw - 14)); g.lineTo(Math.cos(a) * S.rw, Math.sin(a) * S.rw); g.stroke(); }
    g.fillStyle = '#2b303c';
    for (let i = 0; i < 5; i++) { g.rotate(TAU / 5); g.beginPath(); g.ellipse(S.rw * 0.5, 0, 34, 20, 0, 0, TAU); g.fill(); }
    g.fillStyle = S.col(0); g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.fill();
    g.restore();
  },
};

// =====================================================================================
// DOUBLE PRESSE — two steel plates slam shut, and the balls double: 1, 2, 4, 8, 16…
// =====================================================================================
export const twinPress = {
  id: 'twinpress', name: 'Double presse', cat: 'crush', music: true,
  desc: 'Deux plaques d’acier se referment et les balles doublent : 1, 2, 4, 8, 16…',
  options: [{ id: 'max', label: 'Objectif', type: 'choice', def: 256, choices: [[64, '64'], [256, '256'], [512, '512']] }],
  hook: 'Chaque coup de presse = ×2',
  init(S) {
    S.target = S.opts.max || 256;
    S.slams = Math.round(Math.log2(S.target));
    const w = (S.world = new World({ g: 900, iter: 2, damp: 0.1, maxV: 1600 }));
    S.box = { x0: 60, x1: W - 60, y0: 300, y1: 1160 };
    w.bounds = { x0: S.box.x0, x1: S.box.x1, y0: S.box.y0, y1: S.box.y1, e: 0.8 };
    S.r0 = 90;
    const b = w.add(new Body(W / 2, 700, S.r0, { e: 0.85, col: S.col(0), data: {} }));
    b.vx = 200;
    // slam times spread to finish by the drop (+ a few after)
    S.times = Array.from({ length: S.slams }, (_, i) => 1.2 + (i * (Math.max(3, S.dur - 2.2) - 1.2)) / Math.max(1, S.slams - 1));
    S.ti = 0;
    S.plate = 0; S.count = 1;
    S.setCounter(1, { style: 'center', size: 120, y: 730, alpha: 0.9 });
  },
  update(S, dt) {
    const w = S.world;
    // plate animation around each slam time
    let p = 0;
    for (const t of S.times) { const d = S.vt - t; if (d > -0.18 && d < 0.45) p = Math.max(p, d < 0 ? easeInCubic((d + 0.18) / 0.18) : 1 - easeOutCubic(d / 0.45)); }
    S.plate = p;
    if (S.ti < S.times.length && S.vt >= S.times[S.ti]) {
      S.ti++;
      // every ball doubles
      const list = w.bodies.filter((b) => b.alive);
      const nr = S.r0 / Math.pow(Math.SQRT2, S.ti) * 1.0;
      for (const b of list) {
        const kids = w.split(b, S.rng() * TAU, 380, 1);
        if (kids) for (const k of kids) { k.r = Math.max(3.5, nr); k.col = S.col(S.ti + (S.rng() < 0.5 ? 0 : 1)); }
      }
      S.count = w.bodies.filter((b) => b.alive).length;
      S.fx.shock(W / 2, 730, S.col(S.ti), 500, 0.5, 12);
      S.fx.burst(W / 2, 730, '#ffffff', 40, 900, { grav: 0 });
      S.sfx('crush', { v: 1 }); S.sfx('clank', { v: 0.8 });
      S.noteMidi(S.song.root + 24 + S.ti * 2, 0.8, 'bell', 1);
      S.shake(0.35); S.flash(0.3, S.col(S.ti));
      S.fx.pop(W / 2, 600, '×2', '#ffffff', 80, 0.8);
      S.setCounter(S.count, { style: 'center', size: 120, y: 730, alpha: 0.9 });
    }
    // plates squeeze the box while closing
    const gap = lerp(S.box.y1 - S.box.y0, 60, S.plate);
    const mid = (S.box.y0 + S.box.y1) / 2;
    w.bounds.y0 = mid - gap / 2; w.bounds.y1 = mid + gap / 2;
    w.step(dt);
    w.clean();
    if (S.justDropped) { S.punchHook(); S.flash(0.6, '#ffffff'); S.fx.rays(W / 2, 730, S.col(0), 2, 18, 900); }
  },
  draw(S, g) {
    const b = S.box;
    g.fillStyle = alpha(S.theme.fg, 0.04); g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    S.neon(g, () => { g.beginPath(); g.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }, S.col(1), 4, 0.7);
    for (const o of S.world.bodies) if (o.alive) S.ball(g, o.x, o.y, o.r, o.col, { glow: o.r > 10 ? 0.4 : 0, squash: 0.5, vx: o.vx, vy: o.vy });
    const gap = lerp(b.y1 - b.y0, 60, S.plate), mid = (b.y0 + b.y1) / 2;
    steel(g, b.x0 - 20, mid - gap / 2 - 90, b.x1 - b.x0 + 40, 90, { r: 6, hazard: 16, bolts: true });
    g.save(); g.translate(W / 2, mid + gap / 2 + 90); g.scale(1, -1);
    steel(g, b.x0 - 20 - W / 2, 0, b.x1 - b.x0 + 40, 90, { r: 6, hazard: 16, bolts: true });
    g.restore();
  },
};

// =====================================================================================
// COMPACTEUR — a steel box fills with marbles, then the walls close in. Pressure rises…
// =====================================================================================
export const compactor = {
  id: 'compactor', dropAt: 0.78, name: 'Compacteur', cat: 'crush', music: true,
  desc: 'Une boîte d’acier se remplit de billes, puis les parois se referment. La pression monte…',
  options: [{ id: 'count', label: 'Billes', type: 'choice', def: 120, choices: [[80, '80'], [120, '120'], [180, '180']] }],
  hook: 'Jusqu’où peut-on les compresser ?',
  init(S) {
    S.total = S.opts.count || 120;
    const w = (S.world = new World({ g: 1500, iter: 5, damp: 0.5 }));
    S.L = w.addSeg(new Seg(80, 300, 80, 1150, { th: 12, e: 0.1, kin: true }));
    S.Rw = w.addSeg(new Seg(W - 80, 300, W - 80, 1150, { th: 12, e: 0.1, kin: true }));
    S.lid = w.addSeg(new Seg(60, 180, W - 60, 180, { th: 12, e: 0.1, kin: true }));
    w.addSeg(new Seg(60, 1150, W - 60, 1150, { th: 12, e: 0.1 }));
    S.spawned = 0;
    S.pressure = 0;
    S.cubed = false;
    S.setCounter('0 bar', { style: 'top', label: 'Pression :' });
  },
  update(S, dt) {
    const w = S.world;
    const fillEnd = S.dropT * 0.45;
    if (!S.cubed) {
      const want = Math.min(S.total, Math.floor(S.total * clamp(S.vt / fillEnd, 0, 1)));
      while (S.spawned < want) {
        const r = 20 + S.rng() * 10;
        w.add(new Body(140 + S.rng() * 440, 230 - S.rng() * 40, r, { e: 0.15, f: 0.3, col: S.col(S.spawned), data: { r0: r } }));
        S.spawned++;
      }
      // walls close after filling
      const k = clamp((S.vt - fillEnd) / Math.max(0.5, S.dropT - fillEnd), 0, 1);
      const e = easeInCubic(k);
      const xl = lerp(80, 250, e), xr = lerp(W - 80, W - 250, e), ly = lerp(180, 760, e);
      S.L.set(xl, ly, xl, 1150, dt); S.Rw.set(xr, ly, xr, 1150, dt); S.lid.set(xl - 20, ly, xr + 20, ly, dt);
      // keep total area feasible: marbles shrink as the volume shrinks (compression)
      const vol0 = (W - 160) * 970, vol = (xr - xl) * (1150 - ly);
      const sq = Math.min(1, Math.sqrt((vol / vol0) * 1.15) / Math.max(0.35, Math.sqrt(Math.min(1, S.spawned / S.total))));
      for (const b of w.bodies) b.r = b.data.r0 * Math.min(1, sq * 1.05);
      S.pressure = Math.round(1 + e * 249 + (k > 0 ? Math.sin(S.vt * 40) * 2 : 0));
      if (k > 0 && S.rng() < dt * 8) { const b = w.bodies[Math.floor(S.rng() * w.bodies.length)]; if (b) S.fx.sparks(b.x, b.y, 0, -1, '#ffd27a', 3, 300); S.sfx('clank', { v: 0.2 }, 0.2); }
      if (k > 0.6 && S.rng() < dt * 12) S.shake(0.05);
      w.step(dt);
      S.xl = xl; S.xr = xr; S.ly = ly;
      if (S.vt >= S.dropT) this.cube(S);
      S.setCounter(`${S.pressure} bar`, { style: 'top', label: 'Pression :', punch: false });
    } else {
      S.cubeT += dt;
      if (S.beat) S.fx.shock(W / 2, 955, S.col(S.beatIndex), 400, 0.6, 8);
      // walls retract to reveal the cube
      const k = easeOutCubic(clamp(S.cubeT / 1, 0, 1));
      S.xl = lerp(250, 80, k); S.xr = lerp(W - 250, W - 80, k); S.ly = lerp(760, 180, k);
    }
  },
  cube(S) {
    S.cubed = true; S.cubeT = 0;
    const cols = S.world.bodies.map((b) => b.col);
    S.cubeCols = cols;
    for (const b of S.world.bodies) S.fx.burst(b.x, b.y, b.col, 3, 500, { grav: 0, shards: false });
    S.world.bodies.length = 0;
    S.fx.rays(W / 2, 955, '#ffffff', 2.4, 18, 900);
    for (let i = 0; i < 4; i++) S.fx.shock(W / 2, 955, S.col(i), 400 + i * 160, 0.8, 14);
    S.flash(1, '#ffffff'); S.shake(1); S.glitch(1); S.punchHook();
    S.sfx('impact', { v: 1 }); S.sfx('crush', { v: 1 });
    S.setCounter('CUBE !', { style: 'top', label: '' });
  },
  draw(S, g) {
    const xl = S.xl ?? 80, xr = S.xr ?? W - 80, ly = S.ly ?? 180;
    g.fillStyle = alpha(S.theme.fg, 0.05); g.fillRect(xl, ly, xr - xl, 1150 - ly);
    if (S.cubed) {
      // the compressed cube: a mosaic of every marble colour, with bevel + glow
      const k = easeOutCubic(clamp(S.cubeT / 0.6, 0, 1));
      const s = 190 * (0.6 + k * 0.4), x0 = W / 2 - s / 2, y0 = 1150 - s;
      drawGlow(g, W / 2, y0 + s / 2, s * 1.6, S.col(0), 0.8 * S.glow + 0.2);
      const n = 10, cs = s / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        g.fillStyle = S.cubeCols[(i * n + j) % S.cubeCols.length] || S.col(0);
        g.fillRect(x0 + i * cs, y0 + j * cs, cs + 0.5, cs + 0.5);
      }
      const bev = g.createLinearGradient(x0, y0, x0 + s, y0 + s);
      bev.addColorStop(0, 'rgba(255,255,255,0.45)'); bev.addColorStop(0.5, 'rgba(255,255,255,0)'); bev.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = bev; g.fillRect(x0, y0, s, s);
      g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.strokeRect(x0, y0, s, s);
    }
    drawBodies(S, g, S.world);
    steel(g, xl - 40, ly - 10, 40, 1160 - ly, { r: 4 });
    steel(g, xr, ly - 10, 40, 1160 - ly, { r: 4 });
    steel(g, xl - 60, ly - 50, xr - xl + 120, 44, { r: 6, hazard: 12, bolts: true });
    steel(g, 40, 1150, W - 80, 40, { r: 4 });
    // pressure gauge
    const p = clamp((S.pressure || 0) / 250, 0, 1);
    g.save(); g.translate(W - 110, 230);
    g.fillStyle = '#1c1f27'; g.beginPath(); g.arc(0, 0, 58, 0, TAU); g.fill();
    g.strokeStyle = '#d0d5e0'; g.lineWidth = 4; g.stroke();
    for (let i = 0; i <= 10; i++) { const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5; g.strokeStyle = i > 7 ? '#ff4d4d' : '#cfd4df'; g.lineWidth = 2; g.beginPath(); g.moveTo(Math.cos(a) * 44, Math.sin(a) * 44); g.lineTo(Math.cos(a) * 52, Math.sin(a) * 52); g.stroke(); }
    const a = Math.PI * 0.75 + p * Math.PI * 1.5;
    g.strokeStyle = '#ff3b3b'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 46, Math.sin(a) * 46); g.stroke();
    g.fillStyle = '#ddd'; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill();
    g.restore();
  },
};

// =====================================================================================
// LEVIER BROYEUR — a bar sweeps the circle like a wiper; every crushed ball splits in two.
// =====================================================================================
export const leverCrusher = {
  id: 'lever', name: 'Levier broyeur', cat: 'crush', music: true,
  desc: 'Une barre balaie le cercle comme un essuie-glace. Chaque balle écrasée se divise en deux.',
  options: [],
  hook: 'Le levier balaie tout sur son passage',
  init(S) {
    S.cx = W / 2; S.cy = H / 2 + 40; S.R = 320;
    const w = (S.world = new World({ g: 0, iter: 3, damp: 0.6 }));
    S.bar = w.addSeg(new Seg(S.cx, S.cy, S.cx + S.R, S.cy, { th: 12, e: 0.3, kin: true }));
    S.wall = w.addSeg(new Seg(S.cx, S.cy, S.cx, S.cy - S.R, { th: 10, e: 0.3 }));
    S.ang = -Math.PI / 2 + 0.3;
    for (let i = 0; i < 2; i++) { const b = w.add(new Body(S.cx + 100 + i * 60, S.cy + 80, 46, { e: 0.6, col: S.col(i), data: {} })); b.vx = 100; }
    S.setCounter(2, { style: 'top', label: 'Balles :' });
  },
  update(S, dt) {
    const w = S.world;
    const sp = S.dropped ? 3.4 : 2.1;
    S.ang += sp * dt;
    // the bar sweeps a full turn and pushes everything toward the fixed divider at -90°
    let a = S.ang;
    if (angNorm(a + Math.PI / 2) > -0.02 && angNorm(a + Math.PI / 2) < 0) a = -Math.PI / 2 - 0.02;
    const ex = S.cx + Math.cos(a) * S.R, ey = S.cy + Math.sin(a) * S.R;
    S.bar.set(S.cx, S.cy, ex, ey); S.bar.cx = S.cx; S.bar.cy = S.cy; S.bar.w = sp;
    w.step(dt);
    cooldown(w, dt);
    w.containCircle(S.cx, S.cy, S.R, 0.4);
    // crush: angular gap between bar and divider smaller than the ball
    const gapA = angNorm(-Math.PI / 2 - S.ang);
    for (const b of [...w.bodies]) {
      if (!b.alive || b.data.cool > 0) continue;
      const ba = Math.atan2(b.y - S.cy, b.x - S.cx), d = Math.hypot(b.x - S.cx, b.y - S.cy);
      const between = angNorm(ba - S.ang) > 0 && angNorm(-Math.PI / 2 - ba) > 0;
      if (between && gapA > 0 && gapA * d < b.r * 2.1) split(S, w, b, ba, 160);
    }
    if (S.ang > Math.PI * 1.5 + 0.02) { S.ang -= TAU; S.sfx('clank', { v: 0.6 }); S.shake(0.2); }
    w.clean();
    S.setCounter(w.bodies.length, { style: 'top', label: 'Balles :' });
    if (S.justDropped) { S.punchHook(); S.flash(0.4, '#ffffff'); }
  },
  draw(S, g) {
    g.fillStyle = alpha(S.theme.fg, 0.05); g.beginPath(); g.arc(S.cx, S.cy, S.R, 0, TAU); g.fill();
    S.neon(g, () => { g.beginPath(); g.arc(S.cx, S.cy, S.R, 0, TAU); }, S.col(1), 7);
    // swept area glow
    g.save(); g.globalCompositeOperation = S.theme.dark ? 'lighter' : 'source-over';
    const gr = g.createRadialGradient(S.cx, S.cy, 0, S.cx, S.cy, S.R);
    gr.addColorStop(0, alpha(S.col(0), 0)); gr.addColorStop(1, alpha(S.col(0), 0.25));
    g.fillStyle = gr; g.beginPath(); g.moveTo(S.cx, S.cy); g.arc(S.cx, S.cy, S.R, S.ang - 0.6, S.ang); g.closePath(); g.fill();
    g.restore();
    drawBodies(S, g, S.world);
    g.save(); g.translate(S.cx, S.cy); g.rotate(-Math.PI / 2); steel(g, 0, -10, S.R, 20, { r: 6, hazard: 8 }); g.restore();
    g.save(); g.translate(S.cx, S.cy); g.rotate(S.ang); steel(g, 0, -14, S.R, 28, { r: 8, bolts: true, top: S.col(2), mid: darken(S.col(2), 0.3), bot: darken(S.col(2), 0.6) }); g.restore();
    S.ball(g, S.cx, S.cy, 26, '#cfd4df', { mat: 'chrome', glow: 0 });
  },
};

// =====================================================================================
// LAME TRANCHANTE — a spinning blade slices every ball it touches into two smaller ones.
// =====================================================================================
export const bladeSlicer = {
  id: 'blade', name: 'Lame tranchante', cat: 'crush', music: true,
  desc: 'Une lame qui tourne tranche chaque balle touchée en deux plus petites.',
  options: [{ id: 'blades', label: 'Lames', type: 'choice', def: 1, choices: [[1, '1'], [2, '2']] }],
  hook: 'Tranché net ✂️',
  init(S) {
    S.cx = W / 2; S.cy = H / 2 + 40; S.R = 320;
    const w = (S.world = new World({ g: 500, iter: 2, damp: 0.05 }));
    S.ang = 0;
    S.cuts = [];
    const b = w.add(new Body(S.cx, S.cy - 220, 80, { e: 0.95, col: S.col(0), data: {} }));
    b.vx = 260;
    S.setCounter(1, { style: 'top', label: 'Morceaux :' });
  },
  update(S, dt) {
    const w = S.world;
    const sp = S.dropped ? 5 : 3;
    S.ang += sp * dt;
    w.step(dt);
    cooldown(w, dt);
    w.containCircle(S.cx, S.cy, S.R, 0.98, (b, vn) => { if (vn > 400) S.note(Math.floor(70 / b.r) % 10, 0.3, 'glass', 0.3); });
    const nb = S.opts.blades || 1;
    for (let k = 0; k < nb; k++) {
      const a = S.ang + (k * Math.PI) / 2;
      const L = S.R * 0.78;
      const ax = S.cx - Math.cos(a) * L, ay = S.cy - Math.sin(a) * L, bx = S.cx + Math.cos(a) * L, by = S.cy + Math.sin(a) * L;
      for (const b of [...w.bodies]) {
        if (!b.alive || b.data.cool > 0) continue;
        const [qx, qy] = closestOnSeg(b.x, b.y, ax, ay, bx, by);
        if (Math.hypot(b.x - qx, b.y - qy) < b.r * 0.85) {
          if (split(S, w, b, a + Math.PI / 2, 340)) {
            S.cuts.push({ x: b.x, y: b.y, a, r: b.r, t: 0, col: b.col });
            S.sfx('snap', { v: 0.6 }, 0.04);
          }
        }
      }
    }
    for (const c of S.cuts) c.t += dt;
    S.cuts = S.cuts.filter((c) => c.t < 0.35);
    // keep pieces lively
    for (const b of w.bodies) { const s = Math.hypot(b.vx, b.vy); b.data.kick = (b.data.kick || 0) - dt; if (s < 220 && b.data.kick <= 0) { b.data.kick = 0.8; b.vx += (S.rng() - 0.5) * 500; b.vy -= 450 + S.rng() * 300; } }
    w.clean();
    S.setCounter(w.bodies.length, { style: 'top', label: 'Morceaux :' });
    if (S.justDropped) { S.punchHook(); S.flash(0.4, '#ffffff'); S.shake(0.4); }
  },
  draw(S, g) {
    g.fillStyle = alpha(S.theme.fg, 0.05); g.beginPath(); g.arc(S.cx, S.cy, S.R, 0, TAU); g.fill();
    S.neon(g, () => { g.beginPath(); g.arc(S.cx, S.cy, S.R, 0, TAU); }, S.col(1), 6);
    drawBodies(S, g, S.world);
    for (const c of S.cuts) {
      const k = c.t / 0.35;
      g.save(); g.translate(c.x, c.y); g.rotate(c.a);
      g.strokeStyle = alpha('#ffffff', 1 - k); g.lineWidth = 4 * (1 - k) + 1;
      g.beginPath(); g.moveTo(-c.r * 1.6, 0); g.lineTo(c.r * 1.6, 0); g.stroke();
      g.restore();
    }
    const nb = S.opts.blades || 1;
    for (let k = 0; k < nb; k++) {
      const a = S.ang + (k * Math.PI) / 2, L = S.R * 0.78;
      g.save(); g.translate(S.cx, S.cy); g.rotate(a);
      // motion blur ghosts
      for (let i = 3; i >= 1; i--) { g.save(); g.rotate(-i * 0.07); g.globalAlpha = 0.12; g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-L, 0); g.lineTo(0, -10); g.lineTo(L, 0); g.lineTo(0, 10); g.closePath(); g.fill(); g.restore(); }
      const gr = g.createLinearGradient(0, -12, 0, 12);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#aab3c5'); gr.addColorStop(1, '#4b5263');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-L, 0); g.lineTo(0, -12); g.lineTo(L, 0); g.lineTo(0, 12); g.closePath(); g.fill();
      g.strokeStyle = alpha(S.col(0), 0.9); g.lineWidth = 2; g.stroke();
      g.restore();
    }
    S.ball(g, S.cx, S.cy, 22, '#cfd4df', { mat: 'chrome', glow: 0 });
  },
};
