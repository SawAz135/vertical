// LOOPLAB — satisfying physics: Tri des couleurs, Plinko, Cercle qui rétrécit, Sable arc-en-ciel.
import { TAU, clamp, lerp, alpha, lighten, darken, ramp, easeOutCubic, easeOutBack, makeCanvas, hexToRgb, hslToRgb, roundRect } from '../core/util.js';
import { World, Body, Seg } from '../core/physics.js';
import { drawGlow } from '../core/materials.js';

const W = 720, H = 1280;

// =====================================================================================
// TRI DES COULEURS — a spout drops every marble into the tube of its colour.
// =====================================================================================
export const colorSort = {
  id: 'colorsort', name: 'Tri des couleurs', cat: 'phys', music: true,
  desc: 'Un bec verse chaque bille dans le tube de sa couleur. Le tas se vide, les tubes se remplissent.',
  options: [
    { id: 'colors', label: 'Couleurs', type: 'choice', def: 5, choices: [[3, '3'], [4, '4'], [5, '5']] },
    { id: 'per', label: 'Billes par couleur', type: 'choice', def: 14, choices: [[8, '8'], [14, '14'], [20, '20']] },
  ],
  hook: 'Le tri le plus satisfaisant du monde',
  init(S) {
    const C = (S.C = S.opts.colors || 5), per = (S.per = S.opts.per || 14);
    const w = (S.world = new World({ g: 1400, iter: 4, damp: 0.6 }));
    // hopper: a funnel at the top
    S.hop = { cx: W / 2, top: 230, bot: 520, wTop: 300, wBot: 34 };
    const h = S.hop;
    w.addSeg(new Seg(h.cx - h.wTop, h.top, h.cx - h.wBot, h.bot, { th: 6, e: 0.1 }));
    w.addSeg(new Seg(h.cx + h.wTop, h.top, h.cx + h.wBot, h.bot, { th: 6, e: 0.1 }));
    S.gate = w.addSeg(new Seg(h.cx - h.wBot - 4, h.bot + 4, h.cx + h.wBot + 4, h.bot + 4, { th: 5, e: 0.05 }));
    S.mr = 13;
    const r = S.rng;
    const order = [];
    for (let c = 0; c < C; c++) for (let i = 0; i < per; i++) order.push(c);
    r.shuffle(order);
    order.forEach((c, i) => {
      const b = new Body(h.cx + (r() - 0.5) * 360, h.top - 40 - i * 9, S.mr, { e: 0.1, f: 0.4, data: { c } });
      w.add(b);
    });
    // tubes
    const tw = 74, gap = (W - 80 - C * tw) / Math.max(1, C - 1);
    // let the marbles settle in the hopper before the video starts
    for (let i = 0; i < 360; i++) w.step(1 / 120);
    S.tubes = Array.from({ length: C }, (_, c) => ({ x: 40 + tw / 2 + c * (tw + gap), n: 0, glow: 0 }));
    S.tubeTop = 820; S.tubeBot = 1190; S.tw = tw;
    S.car = { x: W / 2, tx: W / 2, ball: null, state: 'wait', t: 0 };
    S.falling = [];
    S.sorted = 0; S.total = C * per;
    S.releaseT = 1.2;
    S.setCounter(`0/${S.total}`, { style: 'top', label: 'Triées :' });
  },
  update(S, dt) {
    const w = S.world;
    w.step(dt);
    const car = S.car;
    const T = Math.max(3, S.dur - 1.5);
    const interval = Math.max(0.12, (T - 1.2) / S.total);
    car.t += dt;
    S.releaseT -= dt;
    if (car.state === 'wait') {
      if (S.releaseT <= 0) {
        // take the marble closest to the outlet
        const h = S.hop;
        let best = null, bd = 1e9;
        for (const b of w.bodies) if (b.alive) { const d = Math.hypot(b.x - h.cx, b.y - h.bot); if (d < bd) { bd = d; best = b; } }
        if (best) {
          best.alive = false;
          car.ball = { c: best.data.c, x: h.cx, y: h.bot + 40 };
          car.tx = S.tubes[best.data.c].x;
          car.state = 'move'; car.t = 0;
          S.sfx('tick', { v: 0.4 });
        }
        S.releaseT += interval;
        if (S.releaseT < 0) S.releaseT = 0;
      }
    } else if (car.state === 'move') {
      const k = clamp(car.t / (interval * 0.55), 0, 1);
      car.x = lerp(car.x, car.tx, Math.min(1, dt * 24));
      if (k >= 1 || Math.abs(car.x - car.tx) < 2) {
        car.x = car.tx;
        const tb = S.tubes[car.ball.c];
        S.falling.push({ c: car.ball.c, x: car.x, y: 700, vy: 200, target: S.tubeBot - S.mr - tb.n * S.mr * 1.95 - 4 });
        tb.n++;
        car.ball = null; car.state = 'wait';
        S.sfx('whoosh', { d: 0.2, v: 0.2 }, 0.1);
      }
    }
    for (const f of S.falling) {
      f.vy += 2400 * dt; f.y += f.vy * dt;
      if (f.y >= f.target) {
        f.y = f.target;
        if (f.vy > 300) {
          f.vy *= -0.32;
          if (!f.landed) {
            f.landed = true;
            S.sorted++;
            const col = S.col(f.c);
            S.tubes[f.c].glow = 1;
            S.note(f.c * 2 + Math.floor(S.tubes[f.c].n / 4), 0.6, 'marimba');
            S.fx.burst(f.x, f.y, col, 6, 200, { grav: 400, shards: false });
            S.setCounter(`${S.sorted}/${S.total}`, { style: 'top', label: 'Triées :' });
            if (S.tubes[f.c].n === S.per) this.tubeFull(S, f.c);
          }
        } else { f.vy = 0; f.done = true; }
      }
    }
    for (const t of S.tubes) t.glow = Math.max(0, t.glow - dt * 3);
    if (S.sorted === S.total && !S.allDone) {
      S.allDone = true;
      S.fx.rays(W / 2, 1000, S.col(0), 2.2, 18, 900);
      S.flash(0.5, '#ffffff'); S.punchHook(); S.shake(0.4);
      S.sfx('win', { m: S.song.root + 24 });
    }
  },
  tubeFull(S, c) {
    const t = S.tubes[c], col = S.col(c);
    S.fx.burst(t.x, S.tubeTop, col, 40, 600, { grav: 600 });
    S.fx.shock(t.x, (S.tubeTop + S.tubeBot) / 2, col, 240, 0.6, 8);
    S.fx.pop(t.x, S.tubeTop - 50, '✓', '#ffffff', 56);
    S.sfx('pop', { v: 0.8 }); S.shake(0.15);
  },
  draw(S, g) {
    const h = S.hop;
    // hopper glass
    g.fillStyle = alpha(S.theme.fg, 0.05);
    g.beginPath(); g.moveTo(h.cx - h.wTop, h.top); g.lineTo(h.cx - h.wBot, h.bot); g.lineTo(h.cx + h.wBot, h.bot); g.lineTo(h.cx + h.wTop, h.top); g.closePath(); g.fill();
    S.neon(g, () => { g.beginPath(); g.moveTo(h.cx - h.wTop, h.top - 60); g.lineTo(h.cx - h.wTop, h.top); g.lineTo(h.cx - h.wBot, h.bot); g.moveTo(h.cx + h.wTop, h.top - 60); g.lineTo(h.cx + h.wTop, h.top); g.lineTo(h.cx + h.wBot, h.bot); }, S.theme.fg, 5, 0.7);
    for (const b of S.world.bodies) if (b.alive) S.ball(g, b.x, b.y, b.r, S.col(b.data.c), { glow: 0.3 });
    // rail + carriage
    g.strokeStyle = alpha(S.theme.fg, 0.35); g.lineWidth = 4;
    g.beginPath(); g.moveTo(40, 620); g.lineTo(W - 40, 620); g.stroke();
    const car = S.car;
    g.save();
    g.translate(car.x, 620);
    g.fillStyle = darken(S.col(4), 0.2);
    roundRect(g, -34, -16, 68, 32, 10); g.fill();
    g.fillStyle = lighten(S.col(4), 0.2);
    g.beginPath(); g.moveTo(-18, 16); g.lineTo(18, 16); g.lineTo(9, 60); g.lineTo(-9, 60); g.closePath(); g.fill();
    g.restore();
    if (car.ball) S.ball(g, car.x, 604, S.mr, S.col(car.ball.c), { glow: 0.6 });
    // tubes
    for (let c = 0; c < S.C; c++) {
      const t = S.tubes[c], col = S.col(c);
      const x0 = t.x - S.tw / 2, x1 = t.x + S.tw / 2;
      g.fillStyle = alpha(col, 0.08 + t.glow * 0.15);
      roundRect(g, x0, S.tubeTop, S.tw, S.tubeBot - S.tubeTop + 10, 30); g.fill();
      S.neon(g, () => { g.beginPath(); g.moveTo(x0, S.tubeTop); g.lineTo(x0, S.tubeBot - 20); g.arcTo(x0, S.tubeBot + 10, t.x, S.tubeBot + 10, 36); g.arcTo(x1, S.tubeBot + 10, x1, S.tubeBot - 20, 36); g.lineTo(x1, S.tubeTop); }, col, 4 + t.glow * 3);
      // fill level gauge
      const k = t.n / S.per;
      g.fillStyle = col;
      roundRect(g, t.x - 20, S.tubeTop - 34, 40 * k + 0.1, 8, 4); g.fill();
      g.strokeStyle = alpha(col, 0.5); g.lineWidth = 1.5;
      roundRect(g, t.x - 20, S.tubeTop - 34, 40, 8, 4); g.stroke();
    }
    for (const f of S.falling) S.ball(g, f.x, f.y, S.mr, S.col(f.c), { glow: 0.4, vx: 0, vy: f.vy });
  },
};

// =====================================================================================
// PLINKO — hundreds of marbles fall through pegs and pile into a perfect bell curve.
// =====================================================================================
export const plinko = {
  id: 'plinko', dropAt: 0.72, name: 'Plinko', cat: 'phys', music: true,
  desc: 'Des centaines de billes tombent entre les picots et forment une courbe en cloche parfaite.',
  options: [
    { id: 'count', label: 'Billes', type: 'choice', def: 300, choices: [[150, '150'], [300, '300'], [500, '500']] },
    { id: 'rows', label: 'Rangées de picots', type: 'choice', def: 13, choices: [[9, '9'], [13, '13'], [17, '17']] },
  ],
  hook: 'Le hasard dessine toujours la même forme',
  init(S) {
    const rows = S.opts.rows || 13;
    const w = (S.world = new World({ g: 1500, iter: 3, damp: 0.25, maxV: 1800, ccd: true }));
    S.total = S.opts.count || 300;
    const top = 300, spacing = Math.min(46, 560 / rows);
    S.pegs = [];
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i <= r + 2; i++) {
        const x = W / 2 + (i - (r + 2) / 2) * spacing;
        if (x < 30 || x > W - 30) continue;
        S.pegs.push(w.addPeg(x, top + r * spacing * 0.9, 5, 0.35));
      }
    }
    S.binTop = top + rows * spacing * 0.9 + 30;
    const nb = (S.nb = rows + 3);
    const bw = (S.bw = spacing);
    S.bx0 = W / 2 - (nb * bw) / 2;
    for (let i = 0; i <= nb; i++) {
      const x = S.bx0 + i * bw;
      w.addSeg(new Seg(x, S.binTop, x, 1200, { th: 2.5, e: 0.2 }));
    }
    w.addSeg(new Seg(S.bx0 - 6, 1200, S.bx0 + nb * bw + 6, 1200, { th: 6, e: 0.1 }));
    // funnel walls toward the board
    w.addSeg(new Seg(80, 120, W / 2 - 40, top - 40, { th: 5, e: 0.2 }));
    w.addSeg(new Seg(W - 80, 120, W / 2 + 40, top - 40, { th: 5, e: 0.2 }));
    w.addSeg(new Seg(S.bx0 - 6, S.binTop - 200, S.bx0 - 6, 1200, { th: 4 }));
    w.addSeg(new Seg(S.bx0 + nb * bw + 6, S.binTop - 200, S.bx0 + nb * bw + 6, 1200, { th: 4 }));
    S.mr = Math.max(4, Math.min(8, bw * 0.2 * Math.sqrt(300 / S.total)));
    // side walls for the whole board: no marble can leave the machine
    w.bounds = { x0: S.bx0 - 12, x1: S.bx0 + nb * bw + 12, e: 0.35 };
    S.spawned = 0;
    S.pegNoteT = 0;
    w.onPeg = (b, p, imp) => {
      p.hit = 1;
      if (S.vt - S.pegNoteT > 0.05 && imp > 200) { S.pegNoteT = S.vt; S.note(Math.floor((p.x / W) * 12), 0.3, 'glass', 0.4); }
    };
    S.setCounter(0, { style: 'top', label: 'Billes :' });
  },
  update(S, dt) {
    const T = Math.max(2, S.dropT - 1.5);
    const want = Math.min(S.total, Math.floor(S.total * clamp(S.vt / T, 0, 1)));
    while (S.spawned < want) {
      const r = S.rng;
      const b = new Body(W / 2 + (r() - 0.5) * 300, 130 + r() * 40, S.mr, { e: 0.35, f: 0.2, data: { i: S.spawned, born: S.vt } });
      b.vy = 100;
      S.world.add(b);
      S.spawned++;
    }
    S.world.step(dt);
    for (const p of S.pegs) p.hit = Math.max(0, p.hit - dt * 4);
    for (const b of S.world.bodies) if (b.y > H + 50) b.alive = false;
    S.setCounter(S.spawned, { style: 'top', label: 'Billes :', punch: false });
    if (S.justDropped) { S.showCurve = S.vt; S.flash(0.4, S.col(0)); S.punchHook(); S.sfx('impact', { v: 0.7 }); }
  },
  draw(S, g) {
    for (const p of S.pegs) {
      if (p.hit > 0) S.glowAt(g, p.x, p.y, 26, S.col(1), p.hit);
      g.fillStyle = p.hit > 0 ? lighten(S.col(1), 0.5) : alpha(S.theme.fg, 0.75);
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
    }
    // bins
    g.strokeStyle = alpha(S.theme.fg, 0.4); g.lineWidth = 3;
    for (let i = 0; i <= S.nb; i++) { const x = S.bx0 + i * S.bw; g.beginPath(); g.moveTo(x, S.binTop); g.lineTo(x, 1200); g.stroke(); }
    S.neon(g, () => { g.beginPath(); g.moveTo(80, 120); g.lineTo(W / 2 - 40, 260); g.moveTo(W - 80, 120); g.lineTo(W / 2 + 40, 260); }, S.col(0), 5);
    for (const b of S.world.bodies) if (b.alive) S.ball(g, b.x, b.y, b.r, ramp(S.cols.concat(S.cols[0]), (b.data.i / S.total) % 1), { glow: 0.2 });
    // bell curve reveal
    if (S.showCurve) {
      const k = clamp((S.vt - S.showCurve) / 1.2, 0, 1);
      const sigma = Math.sqrt((S.opts.rows || 13) / 4) * S.bw;
      const peak = Math.min(1200 - S.binTop - 20, (S.total * S.mr * S.mr * 3.2) / (sigma * 2.5));
      g.save();
      g.beginPath();
      for (let i = 0; i <= 80 * k; i++) {
        const x = S.bx0 + (i / 80) * S.nb * S.bw;
        const z = (x - W / 2) / sigma;
        const y = 1200 - peak * Math.exp(-0.5 * z * z) - 10;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      S.neon(g, () => {}, '#ffffff', 4);
      g.lineWidth = 4; g.strokeStyle = '#ffffff'; g.stroke();
      g.restore();
      if (k > 0.5) S.text(g, 'Courbe de Gauss', W / 2, S.binTop - 40, 30, S.theme.fg, { align: 'center', stroke: true, alpha: (k - 0.5) * 2 });
    }
  },
};

// =====================================================================================
// CERCLE QUI RÉTRÉCIT — the circle tightens on every bounce, leaving ghost rings behind.
// =====================================================================================
export const shrinking = {
  id: 'shrinking', dropAt: 0.75, name: 'Cercle qui rétrécit', cat: 'phys', music: true,
  desc: 'Le cercle se resserre à chaque rebond et laisse des anneaux fantômes derrière lui.',
  options: [{ id: 'balls', label: 'Balles', type: 'choice', def: 1, choices: [[1, '1'], [2, '2'], [3, '3']] }],
  hook: 'Chaque rebond, le cercle rétrécit',
  init(S) {
    S.cx = W / 2; S.cy = H / 2 + 60;
    S.R0 = 320; S.R = S.R0; S.Rmin = 34;
    S.ghosts = [];
    const n = S.opts.balls || 1;
    S.balls = Array.from({ length: n }, (_, i) => ({ x: S.cx + (i - (n - 1) / 2) * 60, y: S.cy - 120, vx: S.rng.range(-300, 300), vy: 0, r: 16, trail: S.newTrail(14), col: S.col(i + 1) }));
    S.bounces = 0;
    S.popped = false;
    S.setCounter(0, { style: 'center', size: 80, y: S.cy, alpha: 0.4 });
  },
  update(S, dt) {
    if (S.popped) {
      for (const gh of S.ghosts) gh.a = Math.max(0, gh.a - dt * 0.15);
      if (S.beat) S.ghosts.forEach((gh, i) => (gh.pulse = 1 - i / S.ghosts.length));
      for (const gh of S.ghosts) gh.pulse = Math.max(0, (gh.pulse || 0) - dt * 2);
      return;
    }
    const T = Math.max(2, S.dropT);
    const target = lerp(S.R0, S.Rmin, Math.pow(clamp(S.vt / T, 0, 1), 1.15));
    for (const b of S.balls) {
      b.vy += 1500 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.trail.push(b.x, b.y);
      const dx = b.x - S.cx, dy = b.y - S.cy, d = Math.hypot(dx, dy);
      if (d + b.r > S.R) {
        const nx = dx / d, ny = dy / d;
        const vn = b.vx * nx + b.vy * ny;
        if (vn > 0) {
          b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny;
          const sp = Math.hypot(b.vx, b.vy), want = clamp(sp, 700, 1300);
          b.vx *= want / sp; b.vy *= want / sp;
          S.bounces++;
          // shrink: leave a ghost at the old radius
          if (S.R - target > 2) {
            S.ghosts.push({ R: S.R, col: ramp(S.cols.slice(0, 4), S.ghosts.length / 40 % 1), a: 1 });
            if (S.ghosts.length > 80) S.ghosts.shift();
            S.R = Math.max(target, S.R - (S.R - target) * 0.9);
          }
          S.note(S.bounces, 0.55, 'bell', 0.7);
          S.fx.sparks(b.x + nx * b.r, b.y + ny * b.r, -nx, -ny, b.col, 8, 450);
          S.fx.shock(S.cx, S.cy, b.col, S.R + 40, 0.35, 4);
          S.setCounter(S.bounces, { style: 'center', size: 80, y: S.cy, alpha: 0.4 });
        }
        b.x = S.cx + nx * (S.R - b.r); b.y = S.cy + ny * (S.R - b.r);
      }
    }
    for (const gh of S.ghosts) gh.a = Math.max(0.18, gh.a - dt * 0.6);
    if (S.vt >= S.dropT) this.pop(S);
  },
  pop(S) {
    S.popped = true;
    for (const b of S.balls) S.fx.burst(b.x, b.y, b.col, 80, 1100, { grav: 300 });
    for (let i = 0; i < 5; i++) S.fx.shock(S.cx, S.cy, S.col(i), 500 + i * 120, 0.8, 14);
    S.fx.rays(S.cx, S.cy, S.col(0), 2.2, 16, 900);
    S.flash(0.9, '#ffffff'); S.shake(0.8); S.glitch(1); S.punchHook();
    S.sfx('impact', { v: 1 });
    S.setCounter('POP !', { style: 'center', size: 110, y: S.cy, alpha: 1 });
  },
  draw(S, g) {
    for (const gh of S.ghosts) {
      g.strokeStyle = alpha(gh.col, gh.a * 0.7 + (gh.pulse || 0) * 0.3);
      g.lineWidth = 2 + (gh.pulse || 0) * 4;
      g.beginPath(); g.arc(S.cx, S.cy, gh.R, 0, TAU); g.stroke();
    }
    if (!S.popped) {
      S.neon(g, () => { g.beginPath(); g.arc(S.cx, S.cy, S.R, 0, TAU); }, S.col(0), 7);
      for (const b of S.balls) {
        if (S.trails) b.trail.draw(g, b.col, b.r * 1.6, S.theme.dark);
        S.ball(g, b.x, b.y, b.r, b.col, { vx: b.vx, vy: b.vy, glow: 1 });
      }
    }
  },
};

// =====================================================================================
// SABLE ARC-EN-CIEL — neon sand flows over obstacles and fills the screen in rainbow layers.
// =====================================================================================
export const rainbowSand = {
  id: 'rainbowsand', name: 'Sable arc-en-ciel', cat: 'phys', music: true,
  desc: 'Du sable néon coule sur des obstacles et remplit l’écran en couches arc-en-ciel.',
  options: [
    { id: 'spouts', label: 'Becs verseurs', type: 'choice', def: 2, choices: [[1, '1'], [2, '2'], [3, '3']] },
    { id: 'grain', label: 'Taille des grains', type: 'choice', def: 5, choices: [[4, 'Fin'], [5, 'Moyen'], [7, 'Gros']] },
  ],
  hook: 'Attends que l’écran soit rempli…',
  init(S) {
    const cell = (S.cell = S.opts.grain || 5);
    const gw = (S.gw = Math.floor(W / cell)), gh = (S.gh = Math.floor(H / cell));
    S.grid = new Uint32Array(gw * gh); // 0 empty, 1 wall, else ABGR colour
    S.img = makeCanvas(gw, gh);
    S.ig = S.img.getContext('2d');
    S.idata = S.ig.createImageData(gw, gh);
    S.u32 = new Uint32Array(S.idata.data.buffer);
    const r = S.rng;
    // obstacles: tilted shelves and pegs (solid cells)
    const wall = (x, y) => { if (x >= 0 && y >= 0 && x < gw && y < gh) S.grid[y * gw + x] = 1; };
    const shelves = r.int(4, 6);
    for (let i = 0; i < shelves; i++) {
      const y = Math.floor(gh * (0.3 + 0.12 * i)), len = Math.floor(gw * (0.25 + r() * 0.2));
      const x0 = i % 2 ? gw - len - 4 : 4, slope = (i % 2 ? -1 : 1) * (0.12 + r() * 0.2);
      for (let k = 0; k < len; k++) { const yy = Math.round(y + k * slope); wall(x0 + k, yy); wall(x0 + k, yy + 1); }
    }
    for (let i = 0; i < 7; i++) {
      const cx = Math.floor(r() * gw), cy = Math.floor(gh * (0.3 + r() * 0.5)), rad = r.int(2, 4);
      for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y <= rad * rad) wall(cx + x, cy + y);
    }
    S.filled = 0;
    S.capacity = gw * gh * 0.8;
    const ns = S.opts.spouts || 2;
    S.spouts = Array.from({ length: ns }, (_, i) => ({ x: ((i + 1) / (ns + 1)) * gw, ph: r() * TAU, sp: 0.4 + r() * 0.5 }));
    S.hue = r() * 360;
    S.flip = 0;
    S.setCounter('0 %', { style: 'top', label: 'Rempli :' });
  },
  update(S, dt) {
    S.flip += dt;
    if (S.flip < 1 / 60) return;
    S.flip -= 1 / 60;
    const { gw, gh, grid } = S;
    const T = Math.max(3, S.dur - 1);
    // pour rate follows the schedule so the screen is full right at the end
    const want = S.capacity * clamp(S.vt / T, 0, 1);
    let toPour = Math.min(320, Math.max(0, Math.round((want - S.filled) * 0.6)) + 3);
    S.hue = (S.hue + 0.9) % 360;
    const rgb = hslToRgb(S.hue, 1, 0.58);
    for (const sp of S.spouts) {
      sp.x = clamp(gw / 2 + Math.sin(S.vt * sp.sp + sp.ph) * gw * 0.46, 3, gw - 4);
      const per = Math.ceil(toPour / S.spouts.length);
      const width = clamp(6 + per / 6, 6, 26);
      for (let k = 0; k < per; k++) {
        const x = Math.round(sp.x + (S.rng() - 0.5) * width), y = 1 + Math.floor(S.rng() * 6);
        const i = y * gw + x;
        if (x >= 0 && x < gw && grid[i] === 0) {
          const j = (S.rng() - 0.5) * 30;
          grid[i] = (255 << 24) | (clamp(rgb[2] + j, 0, 255) << 16) | (clamp(rgb[1] + j, 0, 255) << 8) | clamp(rgb[0] + j, 0, 255);
          S.filled++;
        }
      }
    }
    // cellular automaton, bottom-up with alternating scan direction
    const ltr = (S.frame & 1) === 0;
    for (let y = gh - 2; y >= 0; y--) {
      for (let xi = 0; xi < gw; xi++) {
        const x = ltr ? xi : gw - 1 - xi;
        const i = y * gw + x;
        const v = grid[i];
        if (v <= 1) continue;
        const below = i + gw;
        if (grid[below] === 0) { grid[below] = v; grid[i] = 0; continue; }
        const dl = x > 0 && grid[below - 1] === 0, dr = x < gw - 1 && grid[below + 1] === 0;
        if (dl && dr) { const t = S.rng() < 0.5 ? below - 1 : below + 1; grid[t] = v; grid[i] = 0; }
        else if (dl) { grid[below - 1] = v; grid[i] = 0; }
        else if (dr) { grid[below + 1] = v; grid[i] = 0; }
      }
    }
    if (S.beat) S.note((S.beatIndex * 3) % 10, 0.25, 'glass', 0.6);
    const pct = Math.min(100, Math.round((S.filled / S.capacity) * 100));
    S.setCounter(`${pct} %`, { style: 'top', label: 'Rempli :', punch: false });
    if (pct >= 100 && !S.full) { S.full = true; S.flash(0.6, '#ffffff'); S.punchHook(); S.sfx('impact', { v: 0.8 }); S.fx.rays(W / 2, H / 2, '#ffffff', 2, 16, 900); }
  },
  draw(S, g) {
    const { gw, gh, grid, u32 } = S;
    const wallCol = S.theme.dark ? 0xff3a3a3a : 0xff9a9a9a;
    for (let i = 0; i < gw * gh; i++) u32[i] = grid[i] === 1 ? wallCol : grid[i];
    S.ig.putImageData(S.idata, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(S.img, 0, 0, gw * S.cell, gh * S.cell);
    g.imageSmoothingEnabled = true;
    if (S.theme.dark) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.25 * S.glow;
      g.drawImage(S.img, 0, 0, gw * S.cell, gh * S.cell);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    for (const sp of S.spouts) {
      const x = sp.x * S.cell;
      g.fillStyle = alpha(S.theme.fg, 0.85);
      roundRect(g, x - 16, -10, 32, 30, 8); g.fill();
      const rgb = hslToRgb(S.hue, 1, 0.6);
      drawGlow(g, x, 24, 40, `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`, 0.8);
    }
  },
};
