// LOOPLAB — headline templates: Fusion, 3 000 anneaux, Vortex.
import { TAU, clamp, lerp, angNorm, alpha, lighten, darken, mix, ramp, easeOutCubic, easeInCubic, smooth, hsl, fmtInt } from '../core/util.js';
import { World, Body, Seg } from '../core/physics.js';
import { drawGlow } from '../core/materials.js';

const W = 720, H = 1280;

// =====================================================================================
// 3 000 ANNEAUX — a ball inside thousands of rotating rings, breaking free on the drop.
// =====================================================================================
export const rings3000 = {
  id: 'anneaux3000', dropAt: 0.72, name: '3 000 anneaux', cat: 'top', badge: '🔥 N°1 viral', music: true,
  desc: 'Une balle piégée dans 1 000 à 10 000 anneaux qui tournent. Elle se libère pile sur le drop.',
  options: [
    { id: 'count', label: "Nombre d'anneaux", type: 'choice', def: 3000, choices: [[1000, '1 000'], [3000, '3 000'], [10000, '10 000']] },
    { id: 'difficulty', label: 'Couleur selon la difficulté (rouge = sortie étroite)', type: 'bool', def: false },
  ],
  hook: (S) => `${fmtInt(S.opts.count || 3000)} anneaux. Une balle. Zéro triche.`,
  init(S) {
    const N = S.opts.count || 3000;
    S.N = N;
    S.k = 0; // index of the innermost unbroken ring
    S.kAnim = 0;
    S.inner = 128; // screen radius of the innermost ring
    S.gapPx = N > 5000 ? 1.6 : N > 2000 ? 2.6 : 4.2;
    S.cx = W / 2; S.cy = H / 2 + 40;
    const r = S.rng;
    S.pb = { x: S.cx, y: S.cy, vx: r.range(-1, 1) * 520, vy: -560, r: 15 };
    S.trail = S.newTrail(16);
    S.spin = r.sign();
    S.phase = r() * TAU;
    S.delta = r.range(0.035, 0.06) * r.sign(); // gap offset between consecutive rings → spiral
    S.gapW = new Float32Array(Math.min(N, 12000));
    for (let i = 0; i < S.gapW.length; i++) S.gapW[i] = 0.5 + 0.35 * Math.sin(i * 0.071) + r() * 0.12;
    S.free = false; S.freeT = 0;
    S.breakFlash = [];
    S.lastNote = 0;
    S.setCounter(N, { style: 'center', size: 92, y: S.cy, alpha: 0.85 });
  },
  ringAngle(S, j) { return S.phase + j * S.delta + S.vt * (1.1 + 0.25 * Math.sin(j * 0.013)) * S.spin; },
  update(S, dt) {
    const b = S.pb;
    if (S.free) {
      S.freeT += dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.vx *= 0.995; b.vy *= 0.995;
      // after escaping, the ball orbits the screen centre in a victory lap
      const ang = S.freeT * 3.2;
      const tx = S.cx + Math.cos(ang) * 210, ty = S.cy + Math.sin(ang) * 210;
      b.vx += (tx - b.x) * dt * 18; b.vy += (ty - b.y) * dt * 18;
      b.vx *= 0.97; b.vy *= 0.97;
      S.trail.push(b.x, b.y);
      // after the escape the rings become a beat-driven tunnel the ball dances through
      S.tunnel = S.tunnel || [];
      if (S.beat) {
        S.tunnel.push({ r: 50, col: S.col(S.beatIndex), a: S.rng() * TAU, w: 0.8 + S.rng() * 0.8 });
        S.fx.burst(b.x, b.y, S.col(S.beatIndex + 1), 10, 400, { grav: 0 });
      }
      for (const t of S.tunnel) { t.r += dt * (260 + t.r * 1.7); t.a += dt * 1.5; }
      S.tunnel = S.tunnel.filter((t) => t.r < 900);
      if (S.kick) S.shake(0.18);
      S.setCounter('LIBRE !', { style: 'center', size: 110 });
      return;
    }
    // schedule: broken(t) follows an accelerating curve that finishes on the drop
    const T = Math.max(1, S.dropT);
    const prog = clamp(S.vt / T, 0, 1);
    const target = S.N * (0.82 * Math.pow(prog, 2.2) + 0.18 * prog);
    const deficit = target - S.k;
    // ball keeps a lively speed that grows with urgency
    const sp = Math.hypot(b.vx, b.vy);
    const want = 620 + Math.min(900, Math.max(0, deficit) * 4);
    b.vx *= want / sp; b.vy *= want / sp;
    b.x += b.vx * dt; b.y += b.vy * dt;
    S.trail.push(b.x, b.y);
    const dx = b.x - S.cx, dy = b.y - S.cy;
    const d = Math.hypot(dx, dy);
    const R = S.inner;
    if (d + b.r >= R) {
      const a = Math.atan2(dy, dx);
      let broke = 0;
      // chain: keep breaking while the ball sits in a gap (or the schedule needs it)
      let budget = Math.max(1, Math.ceil(deficit * 0.35));
      while (S.k < S.N && budget > 0) {
        const ga = this.ringAngle(S, S.k);
        const w = S.gapW[S.k % S.gapW.length] * (deficit > 0 ? 1 + Math.min(1.5, deficit / 60) : 0.6);
        const inGap = Math.abs(angNorm(a - ga)) < w / 2;
        if (!inGap && !(deficit > 2 && broke === 0 && S.rng() < Math.min(0.9, deficit / 80))) break;
        S.k++; broke++; budget--;
        if (!inGap) budget = Math.min(budget, Math.ceil(deficit * 0.2));
      }
      if (broke > 0) {
        S.lastBreak = S.vt;
        const col = this.ringCol(S, S.k);
        S.fx.burst(S.cx + Math.cos(a) * R, S.cy + Math.sin(a) * R, col, Math.min(40, 8 + broke), 520, { grav: 0 });
        if (broke > 3 || S.rng() < 0.4) S.fx.shock(S.cx, S.cy, col, R * 1.6, 0.45, 6);
        if (S.effects.lightning && broke > 8) S.fx.lightning(b.x, b.y, S.cx + Math.cos(a) * 640, S.cy + Math.sin(a) * 640, col, 0.2, 3);
        S.breakFlash.push({ a, t: 0, col, n: broke });
        S.note(Math.floor(S.k / 7) % 12, 0.5 + Math.min(0.4, broke / 30), 'glass', 0.5);
        S.sfx('shatter', { v: Math.min(0.9, 0.3 + broke / 40) }, 0.06);
        S.counterPunch = 0.6;
        if (S.N - S.k < 1) this.escape(S);
      } else {
        // bounce on the wall: reflect + small random scatter for organic motion
        const nx = dx / d, ny = dy / d;
        const vn = b.vx * nx + b.vy * ny;
        b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny;
        const rot = (S.rng() - 0.5) * 0.5;
        const c = Math.cos(rot), s = Math.sin(rot);
        [b.vx, b.vy] = [b.vx * c - b.vy * s, b.vx * s + b.vy * c];
        b.x = S.cx + nx * (R - b.r - 0.5); b.y = S.cy + ny * (R - b.r - 0.5);
        S.fx.sparks(b.x + nx * b.r, b.y + ny * b.r, -nx, -ny, this.ringCol(S, S.k), 5, 420);
        if (S.vt - S.lastNote > 0.08) { S.lastNote = S.vt; S.note(S.k % 10, 0.45, 'pluck'); }
      }
    }
    // drop arrives: blow every remaining ring in a cascade
    if (S.justDropped || (S.vt >= S.dropT && !S.free)) this.escape(S);
    S.kAnim += (S.k - S.kAnim) * Math.min(1, dt * 14);
    for (const f of S.breakFlash) f.t += dt;
    S.breakFlash = S.breakFlash.filter((f) => f.t < 0.5);
    S.setCounter(S.N - S.k, { style: 'center', size: 92, y: S.cy });
  },
  escape(S) {
    if (S.free) return;
    S.free = true; S.k = S.N; S.freeT = 0;
    const b = S.pb;
    const a = Math.atan2(b.vy, b.vx);
    b.vx = Math.cos(a) * 1400; b.vy = Math.sin(a) * 1400;
    for (let i = 0; i < 6; i++) S.fx.shock(S.cx, S.cy, S.col(i), 300 + i * 160, 0.6 + i * 0.12, 14);
    S.fx.burst(S.cx, S.cy, S.col(0), 120, 1300, { grav: 0, size: 1.4 });
    S.fx.burst(S.cx, S.cy, S.col(2), 80, 900, { grav: 0 });
    S.fx.rays(S.cx, S.cy, S.col(1), 2.2, 18, 1000);
    for (let i = 0; i < 6; i++) {
      const aa = (i / 6) * TAU;
      S.fx.lightning(S.cx, S.cy, S.cx + Math.cos(aa) * 700, S.cy + Math.sin(aa) * 700, S.col(i), 0.4, 4);
    }
    S.flash(0.9, lighten(S.col(0), 0.4));
    S.shake(0.9); S.glitch(1);
    S.punchHook();
    S.sfx('impact', { v: 1 }); S.sfx('shatter', { v: 1 });
    S.cam.zoom = 1.25; S.camTo(W / 2, H / 2, 1, 3);
  },
  ringCol(S, j) {
    if (S.opts.difficulty) {
      const w = S.gapW[j % S.gapW.length];
      return hsl(clamp((w - 0.3) / 0.6, 0, 1) * 130, 95, 58);
    }
    return ramp(S.cols.slice(0, 3).concat(S.cols[0]), ((j * 0.004) % 1 + 1) % 1);
  },
  draw(S, g) {
    const { cx, cy } = S;
    if (!S.free || S.freeT < 1.2) {
      const fade = S.free ? clamp(1 - S.freeT / 0.6, 0, 1) : 1;
      const expand = S.free ? 1 + easeOutCubic(clamp(S.freeT / 0.9, 0, 1)) * 2.4 : 1;
      const maxR = 760;
      const start = Math.floor(S.kAnim);
      const visible = Math.min(S.N - start, Math.ceil((maxR - S.inner) / S.gapPx) + 2);
      g.lineCap = 'butt';
      const lw = Math.max(0.9, S.gapPx * 0.62);
      const step = S.N > 5000 ? 2 : 1;
      // glow underlay for the whole stack
      if (S.theme.dark) drawGlow(g, cx, cy, maxR, S.col(1), 0.25 * S.glow * fade);
      for (let i = visible - 1; i >= 0; i -= step) {
        const j = start + i;
        if (j >= S.N) continue;
        const rr = (S.inner + (j - S.kAnim) * S.gapPx) * expand;
        if (rr < S.inner * 0.9 || rr > maxR * expand) continue;
        const ga = this.ringAngle(S, j);
        const w = S.gapW[j % S.gapW.length] * 0.9;
        g.strokeStyle = this.ringCol(S, j);
        g.globalAlpha = fade * (0.55 + 0.45 * (1 - i / visible));
        g.lineWidth = lw * (j === S.k ? 3 : 1);
        g.beginPath();
        g.arc(cx, cy, rr, ga + w / 2, ga + TAU - w / 2);
        g.stroke();
      }
      g.globalAlpha = 1;
      // innermost ring: thick neon so the cage reads clearly
      if (!S.free) {
        const ga = this.ringAngle(S, S.k), w = S.gapW[S.k % S.gapW.length] * 0.9;
        const col = this.ringCol(S, S.k);
        S.neon(g, () => { g.beginPath(); g.arc(cx, cy, S.inner + (S.k - S.kAnim) * S.gapPx, ga + w / 2, ga + TAU - w / 2); }, lighten(col, 0.2), 6);
        for (const f of S.breakFlash) {
          const k = f.t / 0.5;
          g.strokeStyle = alpha(lighten(f.col, 0.5), 1 - k);
          g.lineWidth = 10 * (1 - k) + 1;
          g.beginPath(); g.arc(cx, cy, S.inner + k * 60, f.a - 0.4, f.a + 0.4); g.stroke();
        }
      }
    }
    if (S.free && S.tunnel) {
      const e = S.song.energy(S.vt);
      for (const t of S.tunnel) {
        const a = Math.max(0, 1 - t.r / 900);
        S.neon(g, () => { g.beginPath(); g.arc(cx, cy, t.r, t.a + t.w / 2, t.a + TAU - t.w / 2); }, t.col, 3 + a * 6, a);
      }
      S.glowAt(g, cx, cy, 160 + e * 120, S.col(1), 0.5 + e * 0.5);
    }
    // ball
    const b = S.pb;
    const col = S.free ? S.col(3) : '#ffffff';
    if (S.trails) S.trail.draw(g, S.col(2), b.r * 1.6, S.theme.dark, 0.7);
    S.ball(g, b.x, b.y, b.r, col, { vx: b.vx, vy: b.vy, glow: 1 });
  },
};

// =====================================================================================
// VORTEX — hundreds of thin rings spiral around a starry core; a comet breaks them in chains.
// =====================================================================================
export const vortex = {
  id: 'vortex', dropAt: 0.72, name: 'Vortex', cat: 'top', badge: '🔥 N°2 viral', music: true,
  desc: 'Des centaines d’anneaux fins tournent en spirale autour d’un cœur étoilé. Une comète les brise en chaîne.',
  options: [
    { id: 'count', label: "Nombre d'anneaux", type: 'choice', def: 400, choices: [[200, '200'], [400, '400'], [800, '800']] },
    { id: 'arms', label: 'Bras de la spirale', type: 'choice', def: 3, choices: [[2, '2'], [3, '3'], [5, '5']] },
  ],
  hook: (S) => `${S.opts.count || 400} anneaux. Une comète. Combien en reste-t-il ?`,
  init(S) {
    const N = S.opts.count || 400, arms = S.opts.arms || 3;
    const r = S.rng;
    S.cx = W / 2; S.cy = H / 2 + 60;
    S.rings = [];
    for (let i = 0; i < N; i++) {
      const arm = i % arms;
      const k = i / N;
      const rad = 90 + Math.pow(k, 0.8) * 520 + r.gauss() * 10;
      const ang = (arm / arms) * TAU + k * 9.5 + r.gauss() * 0.08;
      S.rings.push({ rad, ang, size: 9 + k * 16 + r() * 6, alive: true, hue: k, tilt: r() * TAU, pulse: 0, id: i });
    }
    S.stars = Array.from({ length: 220 }, () => ({ x: r() * W, y: r() * H, s: r() * 1.8 + 0.3, tw: r() * TAU }));
    S.comet = { x: S.cx, y: 160, vx: 0, vy: 0, trail: S.newTrail(30), target: null };
    S.broken = 0; S.N = N;
    S.chains = [];
    S.rot = 0;
    S.nova = false; S.novaT = 0;
    S.setCounter(N, { style: 'top', label: 'Anneaux :' });
  },
  pos(S, ring) {
    const a = ring.ang + S.rot * (1.6 - ring.rad / 600);
    return [S.cx + Math.cos(a) * ring.rad, S.cy + Math.sin(a) * ring.rad * 0.92];
  },
  update(S, dt) {
    S.rot += dt * (0.35 + (S.dropped ? 0.4 : 0));
    const c = S.comet;
    if (S.nova) {
      S.novaT += dt;
      if (S.beat) { S.fx.shock(S.cx, S.cy, S.col(S.beatIndex), 600, 0.8, 10); S.fx.burst(S.cx, S.cy, S.col(S.beatIndex + 2), 18, 700, { grav: 0 }); }
      if (S.kick) S.shake(0.15);
      const a = S.novaT * 2;
      c.x = S.cx + Math.cos(a) * 260; c.y = S.cy + Math.sin(a) * 260;
      c.trail.push(c.x, c.y);
      S.setCounter('SUPERNOVA', { style: 'top', label: '', punch: false });
      return;
    }
    // schedule: target broken count rises toward N at the drop
    const prog = clamp(S.vt / Math.max(1, S.dropT - 0.2), 0, 1);
    const target = S.N * (0.9 * Math.pow(prog, 1.8) + 0.1 * prog);
    const deficit = target - S.broken;
    // steer the comet to the nearest living ring (homing with inertia)
    if (!c.target || !c.target.alive) {
      let best = null, bd = 1e9;
      for (const rg of S.rings) {
        if (!rg.alive) continue;
        const [x, y] = this.pos(S, rg);
        const d = Math.hypot(x - c.x, y - c.y) + S.rng() * 120;
        if (d < bd) { bd = d; best = rg; }
      }
      c.target = best;
    }
    if (c.target) {
      const [tx, ty] = this.pos(S, c.target);
      const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy) || 1;
      const speed = 700 + Math.min(1600, Math.max(0, deficit) * 18);
      c.vx += ((dx / d) * speed - c.vx) * Math.min(1, dt * 5);
      c.vy += ((dy / d) * speed - c.vy) * Math.min(1, dt * 5);
    }
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.trail.push(c.x, c.y);
    // hits
    for (const rg of S.rings) {
      if (!rg.alive) continue;
      const [x, y] = this.pos(S, rg);
      if (Math.hypot(x - c.x, y - c.y) < rg.size + 14) {
        this.breakRing(S, rg, x, y, 0);
        // chain reaction size depends on how far behind schedule we are
        const chain = Math.max(0, Math.round(Math.min(40, deficit * 0.6)));
        if (chain > 0) S.chains.push({ x, y, left: chain, t: 0, gen: 1 });
      }
    }
    // chain propagation: lightning hops to nearest rings
    for (const ch of S.chains) {
      ch.t += dt;
      while (ch.t > 0.035 && ch.left > 0) {
        ch.t -= 0.035;
        let best = null, bd = 1e9, bx = 0, by = 0;
        for (const rg of S.rings) {
          if (!rg.alive) continue;
          const [x, y] = this.pos(S, rg);
          const d = Math.hypot(x - ch.x, y - ch.y);
          if (d < bd) { bd = d; best = rg; bx = x; by = y; }
        }
        if (!best || bd > 260) { ch.left = 0; break; }
        S.fx.lightning(ch.x, ch.y, bx, by, S.col(2), 0.18, 2.2);
        this.breakRing(S, best, bx, by, ch.gen);
        ch.x = bx; ch.y = by; ch.left--; ch.gen++;
      }
    }
    S.chains = S.chains.filter((c2) => c2.left > 0);
    for (const rg of S.rings) rg.pulse = Math.max(0, rg.pulse - dt * 3);
    if (S.kick) for (const rg of S.rings) rg.pulse = Math.max(rg.pulse, 0.4);
    if (S.justDropped || (S.vt >= S.dropT && !S.nova)) this.supernova(S);
    S.setCounter(S.N - S.broken, { style: 'top', label: 'Anneaux :' });
  },
  breakRing(S, rg, x, y, gen) {
    rg.alive = false; S.broken++;
    const col = ramp(S.cols, rg.hue);
    S.fx.burst(x, y, col, 10, 380, { grav: 0 });
    if (gen === 0) S.fx.shock(x, y, col, 90, 0.35, 5);
    S.note((S.broken * 3) % 14, 0.35 + Math.min(0.4, gen / 30), 'glass', 0.5);
    if (gen % 4 === 0) S.sfx('zap', { v: 0.4 }, 0.05);
  },
  supernova(S) {
    S.nova = true;
    for (const rg of S.rings) if (rg.alive) {
      const [x, y] = this.pos(S, rg);
      rg.alive = false; S.broken++;
      S.fx.burst(x, y, ramp(S.cols, rg.hue), 3, 900, { grav: 0, shards: false });
    }
    for (let i = 0; i < 5; i++) S.fx.shock(S.cx, S.cy, S.col(i), 400 + i * 200, 0.7 + i * 0.15, 16);
    S.fx.rays(S.cx, S.cy, '#ffffff', 2.4, 20, 1100);
    S.fx.burst(S.cx, S.cy, '#ffffff', 90, 1500, { grav: 0, size: 1.5 });
    S.flash(1, '#ffffff'); S.shake(1); S.glitch(1); S.punchHook();
    S.sfx('impact', { v: 1 });
    S.cam.zoom = 1.35; S.camTo(W / 2, H / 2, 1, 2.5);
    S.setCounter('SUPERNOVA', { style: 'top', label: '' });
  },
  background(S, g) {
    for (const s of S.stars) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(S.vt * 1.5 + s.tw));
      g.fillStyle = alpha(S.theme.dark ? '#ffffff' : darken(S.theme.fg, 0.1), a * 0.8);
      g.fillRect(s.x, s.y, s.s, s.s);
    }
  },
  draw(S, g) {
    // core: layered star with corona
    const e = S.song.energy(S.vt), bass = S.song.bass(S.vt);
    const coreR = 46 + bass * 18 + (S.nova ? Math.min(140, S.novaT * 200) : 0);
    drawGlow(g, S.cx, S.cy, coreR * 5, S.col(1), 0.6 + e * 0.4);
    drawGlow(g, S.cx, S.cy, coreR * 2.5, S.col(0), 0.9);
    g.save();
    g.translate(S.cx, S.cy);
    g.rotate(S.vt * 0.6);
    g.globalCompositeOperation = S.theme.dark ? 'lighter' : 'source-over';
    for (let i = 0; i < 12; i++) {
      g.rotate(TAU / 12);
      g.fillStyle = alpha(lighten(S.col(i), 0.5), 0.25);
      g.beginPath(); g.moveTo(0, -coreR * 0.3); g.lineTo(coreR * (1.8 + 0.6 * Math.sin(S.vt * 3 + i)), 0); g.lineTo(0, coreR * 0.3); g.fill();
    }
    g.restore();
    S.ball(g, S.cx, S.cy, coreR * 0.75, '#ffffff', { mat: 'glossy', glow: 1 });
    // rings: thin ellipses (tilted) for depth
    g.lineWidth = 2.2;
    for (const rg of S.rings) {
      if (!rg.alive) continue;
      const [x, y] = this.pos(S, rg);
      const col = ramp(S.cols, rg.hue);
      const sz = rg.size * (1 + rg.pulse * 0.35);
      g.strokeStyle = col;
      g.beginPath();
      g.ellipse(x, y, sz, sz * (0.45 + 0.4 * Math.abs(Math.sin(rg.tilt + S.vt))), rg.tilt + S.vt * 0.8, 0, TAU);
      g.stroke();
    }
    // comet
    const c = S.comet;
    if (S.trails) c.trail.draw(g, S.col(3), 22, S.theme.dark, 0.85);
    S.ball(g, c.x, c.y, 14, lighten(S.col(3), 0.5), { glow: 1.2, vx: c.vx, vy: c.vy });
  },
};

// =====================================================================================
// FUSION — objects fall and merge two by two up to the final form.
// =====================================================================================
const LEVELS = [
  { name: 'Poussière', r: 18 }, { name: 'Caillou', r: 24 }, { name: 'Lune', r: 32 }, { name: 'Mercure', r: 41 },
  { name: 'Mars', r: 52 }, { name: 'Terre', r: 64 }, { name: 'Neptune', r: 78 }, { name: 'Saturne', r: 94 },
  { name: 'Jupiter', r: 112 }, { name: 'Soleil', r: 134 }, { name: 'Trou noir', r: 150 },
];

export const fusion = {
  id: 'fusion', dropAt: 0.75, name: 'Fusion', cat: 'top', badge: '✨ Nouveau', music: true,
  desc: 'Des objets tombent et fusionnent deux par deux jusqu’à la forme finale. Tes images et tes sons à chaque niveau.',
  options: [
    { id: 'levels', label: 'Niveaux jusqu’à la forme finale', type: 'choice', def: 11, choices: [[8, '8'], [10, '10'], [11, '11']] },
    { id: 'levelImages', label: 'Mes images par niveau', type: 'images', count: 11, names: LEVELS.map((l) => l.name) },
  ],
  hook: '2 identiques = 1 plus gros',
  init(S) {
    S.L = S.opts.levels || 11;
    S.levels = LEVELS.slice(LEVELS.length - S.L).map((l, i) => ({ ...l, r: 16 + i * (136 / (S.L - 1)) }));
    S.levels.forEach((l, i) => (l.name = LEVELS[LEVELS.length - S.L + i].name));
    const box = (S.box = { x0: 70, x1: 650, y0: 300, y1: 1180 });
    const w = (S.world = new World({ g: 1500, iter: 4, damp: 0.25 }));
    w.addSeg(new Seg(box.x0, box.y0, box.x0, box.y1, { th: 8, e: 0.2 }));
    w.addSeg(new Seg(box.x1, box.y0, box.x1, box.y1, { th: 8, e: 0.2 }));
    w.addSeg(new Seg(box.x0, box.y1, box.x1, box.y1, { th: 8, e: 0.2 }));
    S.merges = 0;
    S.dropX = W / 2; S.dropTX = W / 2;
    S.nextDrop = 0.6;
    S.held = this.pickLevel(S);
    S.finalReached = false;
    S.mergeQueue = [];
    w.onHit = (a, b) => {
      if (a.data.lv === b.data.lv && a.alive && b.alive && !a.data.m && !b.data.m && a.data.lv < S.L - 1) {
        a.data.m = b.data.m = 1;
        S.mergeQueue.push([a, b]);
      }
    };
    w.onSeg = (b, s, imp) => { if (imp > 300) S.sfx('thud', { v: Math.min(0.6, imp / 1500) }, 0.05); };
    S.setCounter(0, { style: 'top', label: 'Fusions :' });
  },
  pickLevel(S) {
    // assist: the biggest piece gets its twin on schedule so the chain climbs to the final
    // form by the drop; otherwise drop what completes a pair among the small ones.
    const counts = new Array(S.L).fill(0);
    let best = 0;
    for (const b of S.world.bodies) if (b.alive) { counts[b.data.lv]++; best = Math.max(best, b.data.lv); }
    const prog = clamp(S.vt / Math.max(2, S.dropT - 0.4), 0, 1);
    const target = Math.floor(Math.pow(prog, 0.85) * (S.L - 1));
    if (best < target && best < S.L - 1 && S.rng() < 0.55) return best;
    const cap = Math.max(1, Math.min(best, 3));
    for (let lv = 0; lv <= cap; lv++) if (counts[lv] % 2 === 1) return lv;
    return Math.floor(S.rng() * (cap + 1));
  },
  update(S, dt) {
    const w = S.world;
    // aim: slide the dropper over a body of the same level as the held one
    if (!S.finalReached) {
      S.nextDrop -= dt;
      const prog = clamp(S.vt / Math.max(2, S.dropT), 0, 1);
      if (S.nextDrop <= 0) {
        const r = S.levels[S.held].r;
        const x = clamp(S.dropX, S.box.x0 + r + 6, S.box.x1 - r - 6);
        const b = new Body(x, S.box.y0 - 90, r, { e: 0.15, f: 0.3, data: { lv: S.held, born: S.vt } });
        b.vy = 300;
        w.add(b);
        S.sfx('whoosh', { d: 0.25, v: 0.3 }, 0.1);
        S.held = this.pickLevel(S);
        S.nextDrop = lerp(0.5, 0.2, prog);
        // choose next target column
        let tx = S.box.x0 + 80 + S.rng() * (S.box.x1 - S.box.x0 - 160);
        let best = 1e9;
        for (const o of w.bodies) if (o.alive && o.data.lv === S.held && o.y < S.box.y1 && o.y > S.box.y0 - 40) {
          const score = o.y * -1 + Math.abs(o.x - S.dropX) * 0.3;
          if (score < best) { best = score; tx = o.x; }
        }
        S.dropTX = tx;
      }
      S.dropX += (S.dropTX - S.dropX) * Math.min(1, dt * 7);
    }
    w.step(dt);
    // resolve merges after the physics step
    for (const [a, b] of S.mergeQueue) {
      if (!a.alive || !b.alive) continue;
      a.alive = b.alive = false;
      const lv = a.data.lv + 1;
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      const nb = new Body(x, y, S.levels[lv].r * 0.6, { e: 0.15, f: 0.3, data: { lv, born: S.vt, grow: 0 } });
      nb.vx = (a.vx + b.vx) / 2; nb.vy = (a.vy + b.vy) / 2 - 220;
      w.add(nb);
      S.merges++;
      const col = this.levelCol(S, lv);
      S.fx.burst(x, y, col, 14 + lv * 3, 300 + lv * 60, { grav: 300 });
      S.fx.shock(x, y, col, S.levels[lv].r * 2.6, 0.45, 6 + lv);
      S.fx.pop(x, y - S.levels[lv].r - 10, S.levels[lv].name, lighten(col, 0.3), 26 + lv * 2.4);
      S.note(lv * 2, 0.5 + lv * 0.04, lv > 6 ? 'bell' : 'marimba', 0.8);
      S.sfx('pop', { v: 0.7, pitch: 1.4 - lv * 0.07 });
      if (lv >= S.L - 4) { S.shake(0.25 + (lv - S.L + 4) * 0.1); S.flash(0.25, col); }
      if (lv === S.L - 1) this.final(S, nb);
    }
    S.mergeQueue.length = 0;
    w.clean();
    for (const b of w.bodies) {
      const tr = S.levels[b.data.lv].r;
      if (b.r < tr && !b.static) b.r = Math.min(tr, b.r + dt * tr * 4);
      if (b.y > H + 300) b.alive = false;
    }
    // overflow guard: oldest small pieces pop if the cup is too full
    let top = 1e9;
    for (const b of w.bodies) if (S.vt - b.data.born > 1.2) top = Math.min(top, b.y - b.r);
    if (top < S.box.y0 + 20) {
      const small = w.bodies.filter((b) => b.alive).sort((a, b) => a.data.lv - b.data.lv)[0];
      if (small) { small.alive = false; S.fx.burst(small.x, small.y, this.levelCol(S, small.data.lv), 10, 300); S.sfx('pop', { v: 0.4 }); }
    }
    // make sure the final form lands on the drop
    if (!S.finalReached && S.vt >= S.dropT - 0.05) this.forceFinal(S);
    if (S.finalReached && S.finalBody) {
      const f = S.finalBody;
      f.x += (W / 2 - f.x) * Math.min(1, dt * 3);
      f.y += (720 - f.y) * Math.min(1, dt * 3);
      f.r += (S.levels[S.L - 1].r * 1.25 - f.r) * Math.min(1, dt * 2);
      f.ang += dt * 0.6;
      S.camTo(W / 2, 700, 1.05, 2.5);
      if (S.beat) S.fx.shock(f.x, f.y, S.col(S.beatIndex), 420, 0.6, 8);
      // the final form swallows what is left, one piece per beat-ish
      S.absorbT = (S.absorbT || 0) - dt;
      if (S.absorbT <= 0) {
        S.absorbT = 0.14;
        let near = null, nd = 1e9;
        for (const b of w.bodies) if (b.alive && b !== f) { const d = Math.hypot(b.x - f.x, b.y - f.y); if (d < nd) { nd = d; near = b; } }
        if (near) {
          const col = this.levelCol(S, near.data.lv);
          S.fx.lightning(near.x, near.y, f.x, f.y, col, 0.25, 2.5);
          S.fx.burst(near.x, near.y, col, 10, 320);
          near.alive = false;
          S.note(near.data.lv + 3, 0.4, 'glass', 0.5);
        }
      }
    }
    S.setCounter(S.merges, { style: 'top', label: 'Fusions :' });
  },
  forceFinal(S) {
    // collapse everything into the final form: the biggest piece absorbs the rest
    const w = S.world;
    const alive = w.bodies.filter((b) => b.alive);
    let big = alive.sort((a, b) => b.data.lv - a.data.lv)[0];
    if (!big) { big = w.add(new Body(W / 2, H / 2, 40, { data: { lv: 0, born: S.vt } })); }
    for (const b of alive) if (b !== big) {
      S.fx.lightning(b.x, b.y, big.x, big.y, this.levelCol(S, b.data.lv), 0.3, 2.5);
      S.fx.burst(b.x, b.y, this.levelCol(S, b.data.lv), 8, 300);
      b.alive = false;
      S.merges++;
    }
    big.data.lv = S.L - 1;
    this.final(S, big);
  },
  final(S, b) {
    if (S.finalReached) return;
    S.finalReached = true;
    S.finalBody = b;
    // the final form is lifted to the centre of the cup for its reveal
    b.static = true; b.vx = b.vy = 0;
    const col = this.levelCol(S, S.L - 1);
    S.fx.rays(b.x, b.y, col, 2.5, 20, 1000);
    for (let i = 0; i < 4; i++) S.fx.shock(b.x, b.y, S.col(i), 380 + i * 180, 0.7 + i * 0.15, 14);
    S.fx.burst(b.x, b.y, col, 120, 1200, { grav: 200, size: 1.4 });
    S.flash(1, lighten(col, 0.3)); S.shake(0.9); S.glitch(0.8);
    S.sfx('impact', { v: 1 }); S.sfx('win', { m: S.song.root + 24 });
    S.slowmo(0.3, 1.1);
    S.punchHook();
    S.camTo(b.x, b.y - 40, 1.25, 3);
    S.fx.pop(b.x, b.y - 200, `${S.levels[S.L - 1].name} !`, '#ffffff', 64, 2.4);
  },
  levelCol(S, lv) { return ramp(S.cols.concat(S.cols[0]), lv / Math.max(1, S.L - 1)); },
  drawLevel(S, g, x, y, r, lv, b) {
    const col = this.levelCol(S, lv);
    const img = S.images['level' + (S.L === 11 ? lv : LEVELS.length - S.L + lv)];
    if (img) { S.ball(g, x, y, r, col, { img }); return; }
    const name = S.levels[lv].name;
    if (name === 'Trou noir') {
      // accretion disk + event horizon
      g.save(); g.translate(x, y); g.rotate(S.vt * 1.5);
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = alpha(S.col(i), 0.8);
        g.lineWidth = r * 0.12;
        g.beginPath(); g.ellipse(0, 0, r * (1.5 + i * 0.2), r * (0.42 + i * 0.05), 0.3, 0, TAU); g.stroke();
      }
      g.restore();
      drawGlow(g, x, y, r * 3, S.col(1), 0.9);
      g.fillStyle = '#000'; g.beginPath(); g.arc(x, y, r * 0.85, 0, TAU); g.fill();
      g.strokeStyle = lighten(S.col(0), 0.6); g.lineWidth = 3; g.beginPath(); g.arc(x, y, r * 0.86, 0, TAU); g.stroke();
      return;
    }
    if (name === 'Soleil') {
      drawGlow(g, x, y, r * 2.6, '#ffb300', 1);
      S.ball(g, x, y, r, '#ffcc33', { mat: 'glossy', glow: 1 });
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const a = S.vt * 0.7 + i * 0.7;
        g.fillStyle = 'rgba(255,140,0,0.25)';
        g.beginPath(); g.arc(x + Math.cos(a) * r * 0.45, y + Math.sin(a * 1.3) * r * 0.45, r * 0.25, 0, TAU); g.fill();
      }
      g.restore();
      return;
    }
    S.ball(g, x, y, r, col, { rot: b ? b.ang : 0 });
    // planet detailing: bands / craters / rings
    g.save();
    g.beginPath(); g.arc(x, y, r * 0.98, 0, TAU); g.clip();
    if (lv % 3 === 0) {
      for (let i = -2; i <= 2; i++) {
        g.fillStyle = alpha(i % 2 ? darken(col, 0.25) : lighten(col, 0.2), 0.35);
        g.fillRect(x - r, y + i * r * 0.32 - r * 0.08, r * 2, r * 0.16);
      }
    } else if (lv % 3 === 1) {
      for (let i = 0; i < 4; i++) {
        const a = i * 1.9 + lv, d = r * (0.2 + (i % 2) * 0.35);
        g.fillStyle = alpha(darken(col, 0.35), 0.45);
        g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.12 + (i % 3) * 0.05), 0, TAU); g.fill();
      }
    }
    g.restore();
    if (name === 'Saturne') {
      g.strokeStyle = alpha(lighten(col, 0.4), 0.85); g.lineWidth = r * 0.12;
      g.beginPath(); g.ellipse(x, y, r * 1.55, r * 0.38, -0.35, Math.PI * 1.05, Math.PI * 1.95 + TAU, false); g.stroke();
    }
  },
  draw(S, g) {
    const bx = S.box;
    // glass cup with rim light
    g.save();
    g.fillStyle = alpha(S.theme.fg, 0.04);
    g.fillRect(bx.x0, bx.y0, bx.x1 - bx.x0, bx.y1 - bx.y0);
    S.neon(g, () => { g.beginPath(); g.moveTo(bx.x0, bx.y0 - 30); g.lineTo(bx.x0, bx.y1); g.lineTo(bx.x1, bx.y1); g.lineTo(bx.x1, bx.y0 - 30); }, S.col(1), 7);
    g.setLineDash([10, 12]);
    g.strokeStyle = alpha(S.col(0), 0.35); g.lineWidth = 2;
    g.beginPath(); g.moveTo(bx.x0, bx.y0 + 20); g.lineTo(bx.x1, bx.y0 + 20); g.stroke();
    g.setLineDash([]);
    g.restore();
    // dropper
    if (!S.finalReached) {
      const r = S.levels[S.held].r;
      g.strokeStyle = alpha(S.theme.fg, 0.25); g.lineWidth = 2; g.setLineDash([4, 10]);
      g.beginPath(); g.moveTo(S.dropX, S.box.y0 - 60); g.lineTo(S.dropX, S.box.y1); g.stroke(); g.setLineDash([]);
      this.drawLevel(S, g, S.dropX, S.box.y0 - 90 + Math.sin(S.vt * 6) * 4, r, S.held);
    }
    for (const b of S.world.bodies) if (b.alive) this.drawLevel(S, g, b.x, b.y, b.r, b.data.lv, b);
  },
  overlay(S, g) {
    // evolution strip at the bottom
    const n = S.L, y = 1228, x0 = 60, x1 = 660;
    let best = 0;
    for (const b of S.world.bodies) if (b.alive) best = Math.max(best, b.data.lv);
    for (let i = 0; i < n; i++) {
      const x = lerp(x0, x1, i / (n - 1));
      const on = i <= best;
      g.globalAlpha = on ? 1 : 0.3;
      this.drawLevel(S, g, x, y, 15, i);
    }
    g.globalAlpha = 1;
  },
};
