// LOOPLAB — music visualizers: Spectre, Pulsation, Piano roll, Machine à billes.
import { TAU, clamp, lerp, alpha, lighten, darken, ramp, easeOutCubic, roundRect } from '../core/util.js';
import { NB } from '../core/music.js';
import { drawGlow } from '../core/materials.js';

const W = 720, H = 1280;

// =====================================================================================
// SPECTRE — a giant equalizer with dancing bars, reflections and falling caps.
// =====================================================================================
export const spectrum = {
  id: 'spectrum', noHits: true, name: 'Spectre', cat: 'music', badge: '♪ Synchro musique', music: true,
  desc: 'Un égaliseur géant : barres dansantes, reflets et capuchons qui retombent.',
  options: [
    { id: 'bars', label: 'Barres', type: 'choice', def: 32, choices: [[24, '24'], [32, '32'], [48, '48']] },
    { id: 'mirror', label: 'Miroir central (basses au centre)', type: 'bool', def: true },
  ],
  hook: 'Monte le son 🔊',
  init(S) {
    S.nb = S.opts.bars || 32;
    S.h = new Float32Array(S.nb); S.cap = new Float32Array(S.nb); S.capV = new Float32Array(S.nb); S.peak = new Float32Array(S.nb).fill(0.25);
    S.spec = new Float32Array(NB);
    S.base = 860;
  },
  bandVal(S, i) {
    // map bars onto bands (low bands get more bars)
    const f = Math.pow(i / S.nb, 1.25) * (NB - 1);
    const a = Math.floor(f), t = f - a;
    return lerp(S.spec[a], S.spec[Math.min(NB - 1, a + 1)], t);
  },
  update(S, dt) {
    S.song.spectrum(S.vt, S.spec);
    for (let i = 0; i < S.nb; i++) {
      let v = this.bandVal(S, i);
      if (S.opts.mirror !== false) { const m = S.nb / 2; v = this.bandVal(S, Math.floor(Math.abs(i - m + 0.5) * 2)); }
      // automatic gain per bar so every bar dances, whatever the mix
      S.peak[i] = Math.max(S.peak[i] * (1 - dt * 0.25), v, 0.08);
      v = Math.pow(v / S.peak[i], 1.3) * (0.55 + 0.45 * S.song.energy(S.vt));
      const target = Math.min(1.05, v) * 560;
      S.h[i] += (target - S.h[i]) * Math.min(1, dt * (target > S.h[i] ? 30 : 7));
      // caps: pushed up by the bar, then fall with gravity
      if (S.h[i] > S.cap[i]) { S.cap[i] = S.h[i]; S.capV[i] = 0; }
      else { S.capV[i] += 1300 * dt; S.cap[i] = Math.max(S.h[i], S.cap[i] - S.capV[i] * dt); }
    }
    if (S.kick) {
      const i = Math.floor(S.rng() * S.nb);
      const bw = W / S.nb;
      S.fx.burst(bw * (i + 0.5), S.base - S.h[i], ramp(S.cols, i / S.nb), 10, 400, { grav: 900, shards: false });
    }
    if (S.justDropped) { S.flash(0.5, S.col(0)); S.punchHook(); S.shake(0.4); S.fx.shock(W / 2, S.base, S.col(1), 700, 0.8, 12); }
  },
  background(S, g) {
    const b = S.song.bass(S.vt);
    drawGlow(g, W / 2, S.base, 700, S.col(1), 0.25 + b * 0.5);
  },
  draw(S, g) {
    const bw = W / S.nb, gap = Math.max(2, bw * 0.18);
    for (let i = 0; i < S.nb; i++) {
      const h = Math.max(6, S.h[i]), x = i * bw + gap / 2, w = bw - gap;
      const col = ramp(S.cols.slice(0, 4), i / (S.nb - 1));
      const gr = g.createLinearGradient(0, S.base - h, 0, S.base);
      gr.addColorStop(0, lighten(col, 0.35)); gr.addColorStop(1, darken(col, 0.25));
      if (S.theme.dark) drawGlow(g, x + w / 2, S.base - h / 2, h * 0.7 + 40, col, 0.25 * S.glow);
      g.fillStyle = gr;
      roundRect(g, x, S.base - h, w, h, Math.min(6, w / 2)); g.fill();
      // segmented LED look
      g.fillStyle = alpha('#000', 0.22);
      for (let y = S.base - 10; y > S.base - h; y -= 14) g.fillRect(x, y, w, 3);
      // cap
      g.fillStyle = lighten(col, 0.6);
      roundRect(g, x, S.base - S.cap[i] - 14, w, 7, 3); g.fill();
      // reflection
      const rg = g.createLinearGradient(0, S.base, 0, S.base + h * 0.6);
      rg.addColorStop(0, alpha(col, 0.35)); rg.addColorStop(1, alpha(col, 0));
      g.fillStyle = rg;
      g.fillRect(x, S.base + 6, w, h * 0.6);
    }
    // floor line
    S.neon(g, () => { g.beginPath(); g.moveTo(0, S.base + 3); g.lineTo(W, S.base + 3); }, S.theme.fg, 2, 0.6);
  },
};

// =====================================================================================
// PULSATION — a hypnotic visualizer that breathes with the music.
// =====================================================================================
export const pulse = {
  id: 'pulse', noHits: true, name: 'Pulsation', cat: 'music', badge: '♪ Synchro musique', music: true,
  desc: 'Un visualiseur hypnotique qui respire avec la musique.',
  options: [{ id: 'sym', label: 'Symétrie', type: 'choice', def: 2, choices: [[1, 'Aucune'], [2, 'Miroir'], [4, 'Quadruple']] }],
  hook: 'Laisse-toi hypnotiser',
  init(S) {
    S.cx = W / 2; S.cy = H / 2 + 40;
    S.hist = [];
    S.tunnel = [];
    S.stars = Array.from({ length: 160 }, () => ({ a: S.rng() * TAU, d: S.rng() * 600, s: 0.5 + S.rng() * 2 }));
    S.rot = 0;
  },
  update(S, dt) {
    const sp = S.song.spectrum(S.vt);
    S.hist.unshift(sp);
    if (S.hist.length > 24) S.hist.pop();
    const e = S.song.energy(S.vt);
    S.rot += dt * (0.1 + e * 0.5);
    if (S.beat) S.tunnel.push({ r: 60, col: S.col(S.beatIndex), w: S.dropped ? 6 : 3 });
    for (const t of S.tunnel) t.r += dt * (220 + t.r * 1.6);
    S.tunnel = S.tunnel.filter((t) => t.r < 1100);
    for (const s of S.stars) { s.d += dt * (60 + e * 900) * s.s * 0.4; if (s.d > 900) s.d = 10; }
    if (S.justDropped) { S.flash(0.6, S.col(0)); S.punchHook(); S.fx.rays(S.cx, S.cy, S.col(1), 2, 20, 1000); S.shake(0.5); }
  },
  wave(S, g, sp, R, amp, col, width, a) {
    const n = 160, sym = S.opts.sym || 2;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      let u = (t * sym) % 1;
      if (sym > 1 && Math.floor(t * sym) % 2 === 1) u = 1 - u;
      const band = Math.floor(u * (NB - 8)) + 2;
      const v = sp[band];
      const ang = t * TAU + S.rot;
      const rr = R + v * amp;
      const x = S.cx + Math.cos(ang) * rr, y = S.cy + Math.sin(ang) * rr;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    S.neon(g, () => {}, col, width, a);
  },
  draw(S, g) {
    const e = S.song.energy(S.vt), b = S.song.bass(S.vt);
    // star streaks
    g.save();
    g.globalCompositeOperation = S.theme.dark ? 'lighter' : 'source-over';
    for (const s of S.stars) {
      const x = S.cx + Math.cos(s.a + S.rot * 0.3) * s.d, y = S.cy + Math.sin(s.a + S.rot * 0.3) * s.d;
      const l = 4 + e * 30 * s.s;
      g.strokeStyle = alpha(S.theme.fg, Math.min(1, s.d / 300) * 0.6);
      g.lineWidth = s.s;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(s.a + S.rot * 0.3) * l, y + Math.sin(s.a + S.rot * 0.3) * l); g.stroke();
    }
    g.restore();
    for (const t of S.tunnel) {
      g.strokeStyle = alpha(t.col, Math.max(0, 1 - t.r / 1100) * 0.7);
      g.lineWidth = t.w;
      g.beginPath();
      const sides = 6;
      for (let i = 0; i <= sides; i++) { const a = (i / sides) * TAU + S.rot * 2; const x = S.cx + Math.cos(a) * t.r, y = S.cy + Math.sin(a) * t.r; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    // layered waveforms from older spectra (echo)
    for (let k = Math.min(S.hist.length - 1, 12); k >= 0; k -= 3) {
      const col = S.col(k / 3);
      this.wave(S, g, S.hist[k], 150 + k * 10 + b * 30, 170, col, k === 0 ? 4 : 2, k === 0 ? 1 : 0.5);
    }
    // core
    const r = 80 + b * 40;
    S.glowAt(g, S.cx, S.cy, r * 3, S.col(0), 1);
    S.ball(g, S.cx, S.cy, r, S.col(1), { mat: S.mat === 'flat' ? 'glass' : S.mat, glow: 0.8 });
    g.save(); g.translate(S.cx, S.cy); g.rotate(-S.rot * 3);
    g.strokeStyle = alpha('#ffffff', 0.5); g.lineWidth = 2;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(0, 0, r * 1.25, r * 0.35, (i * TAU) / 6, 0, TAU); g.stroke(); }
    g.restore();
  },
};

function melody(song, minGap = 0.11) {
  const src = song.notes.filter((n) => n.inst === 'lead' || n.inst === 'pluck' || n.inst === 'bass');
  src.sort((a, b) => a.t - b.t);
  const out = [];
  let last = -1;
  for (const n of src) {
    if (Array.isArray(n.m)) continue;
    if (n.t - last < minGap) continue;
    out.push(n);
    last = n.t;
  }
  return out;
}

// =====================================================================================
// PIANO ROLL — glowing notes fall onto a keyboard right when the music plays them.
// =====================================================================================
export const pianoRoll = {
  id: 'pianoroll', noHits: true, name: 'Piano roll', cat: 'music', badge: '♪ Synchro musique', music: true,
  desc: 'Des notes lumineuses tombent sur un clavier pile quand la musique les joue.',
  options: [{ id: 'speed', label: 'Vitesse de chute', type: 'choice', def: 420, choices: [[300, 'Lente'], [420, 'Normale'], [600, 'Rapide']] }],
  hook: 'Chaque note tombe pile au bon moment',
  init(S) {
    const notes = S.song.notes.filter((n) => n.inst !== 'pad' && !Array.isArray(n.m));
    let lo = 127, hi = 0;
    for (const n of notes) { lo = Math.min(lo, n.m); hi = Math.max(hi, n.m); }
    if (!notes.length) { lo = 48; hi = 84; }
    lo = Math.max(21, lo - 2); hi = Math.min(108, Math.max(lo + 24, hi + 2));
    // start on a C for a natural-looking keyboard
    lo -= lo % 12; hi += 11 - (hi % 12);
    S.lo = lo; S.hi = hi;
    S.notes = notes;
    S.keyY = 1040;
    S.speed = S.opts.speed || 420;
    S.white = [];
    for (let m = lo; m <= hi; m++) if (![1, 3, 6, 8, 10].includes(m % 12)) S.white.push(m);
    S.kw = W / S.white.length;
    S.lit = new Float32Array(128);
    S.hitIdx = 0;
    // pads light the background on chords
    S.pads = S.song.notes.filter((n) => n.inst === 'pad');
  },
  keyX(S, m) {
    const black = [1, 3, 6, 8, 10].includes(m % 12);
    if (!black) { const i = S.white.indexOf(m); return [i * S.kw, S.kw, false]; }
    const i = S.white.indexOf(m - 1);
    return [(i + 1) * S.kw - S.kw * 0.32, S.kw * 0.64, true];
  },
  update(S, dt) {
    for (let m = 0; m < 128; m++) S.lit[m] = Math.max(0, S.lit[m] - dt * 2.5);
    while (S.hitIdx < S.notes.length && S.notes[S.hitIdx].t <= S.vt) {
      const n = S.notes[S.hitIdx++];
      if (n.m < S.lo || n.m > S.hi) continue;
      S.lit[n.m] = 1;
      const [x, w] = this.keyX(S, n.m);
      const col = this.col(S, n);
      S.fx.burst(x + w / 2, S.keyY, col, 8, 340, { grav: -200, shards: false });
      S.fx.sparks(x + w / 2, S.keyY, 0, -1, lighten(col, 0.4), 5, 500, 0.5);
    }
    if (S.justDropped) { S.flash(0.5, S.col(0)); S.punchHook(); S.fx.shock(W / 2, S.keyY, S.col(1), 700, 0.8, 10); }
  },
  col(S, n) { return n.inst === 'bass' ? S.col(2) : n.inst === 'lead' ? S.col(0) : S.col(1); },
  draw(S, g) {
    // lane guides
    g.strokeStyle = alpha(S.theme.fg, 0.06); g.lineWidth = 1;
    for (let i = 0; i <= S.white.length; i++) { g.beginPath(); g.moveTo(i * S.kw, 160); g.lineTo(i * S.kw, S.keyY); g.stroke(); }
    // falling notes
    const tTop = S.vt + S.keyY / S.speed;
    for (const n of S.notes) {
      if (n.t > tTop) break;
      if (n.t + n.d < S.vt - 0.05 || n.m < S.lo || n.m > S.hi) continue;
      const yBot = S.keyY - (n.t - S.vt) * S.speed;
      const hh = Math.max(14, n.d * S.speed);
      const [x, w] = this.keyX(S, n.m);
      const yTop = yBot - hh;
      const col = this.col(S, n);
      const y0 = Math.max(150, yTop), y1 = Math.min(S.keyY, yBot);
      if (y1 <= y0) continue;
      if (S.theme.dark) drawGlow(g, x + w / 2, (y0 + y1) / 2, Math.max(w, y1 - y0) * 0.8, col, 0.25 * S.glow);
      const gr = g.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, lighten(col, 0.3)); gr.addColorStop(1, col);
      g.fillStyle = gr;
      roundRect(g, x + 2, y0, w - 4, y1 - y0, Math.min(8, w / 3)); g.fill();
      g.strokeStyle = alpha('#ffffff', 0.5); g.lineWidth = 1.5; g.stroke();
    }
    // hit line
    S.neon(g, () => { g.beginPath(); g.moveTo(0, S.keyY); g.lineTo(W, S.keyY); }, S.col(1), 3);
    // keyboard
    const kh = 200;
    for (const m of S.white) {
      const [x, w] = this.keyX(S, m);
      const l = S.lit[m];
      const gr = g.createLinearGradient(0, S.keyY, 0, S.keyY + kh);
      gr.addColorStop(0, l > 0 ? lighten(S.col(0), 0.5 - l * 0.2) : '#f4f4f6'); gr.addColorStop(1, l > 0 ? S.col(0) : '#c9cad2');
      g.fillStyle = gr;
      roundRect(g, x + 1, S.keyY + 4 + l * 4, w - 2, kh - l * 4, 6); g.fill();
      if (l > 0) drawGlow(g, x + w / 2, S.keyY + 10, w * 2, S.col(0), l);
    }
    for (let m = S.lo; m <= S.hi; m++) {
      const [x, w, black] = this.keyX(S, m);
      if (!black) continue;
      const l = S.lit[m];
      g.fillStyle = l > 0 ? S.col(1) : '#15151b';
      roundRect(g, x, S.keyY + 4 + l * 3, w, kh * 0.62, 4); g.fill();
      g.fillStyle = alpha('#ffffff', 0.12); g.fillRect(x + 3, S.keyY + 8, w - 6, 6);
      if (l > 0) drawGlow(g, x + w / 2, S.keyY + 10, w * 2.5, S.col(1), l);
    }
  },
};

// =====================================================================================
// MACHINE À BILLES — two cannons fire marbles onto a xylophone, exactly on each note.
// =====================================================================================
function steel2(g, x, y, w, h) {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, '#c9cfdb'); gr.addColorStop(1, '#4a5163');
  g.fillStyle = gr; roundRect(g, x, y, w, h, 10); g.fill();
}

export const marbleMachine = {
  id: 'marblemachine', name: 'Machine à billes', cat: 'music', badge: '♪ Synchro musique', music: true,
  desc: 'Deux canons tirent des billes sur un xylophone, exactement sur chaque note.',
  options: [{ id: 'flight', label: 'Temps de vol', type: 'choice', def: 0.9, choices: [[0.7, 'Court'], [0.9, 'Moyen'], [1.2, 'Long']] }],
  hook: 'Chaque bille tombe pile sur la note',
  init(S) {
    S.T = S.opts.flight || 0.9;
    S.g = 1400;
    const mel = melody(S.song, 0.13).filter((n) => n.t > S.T + 0.05);
    let lo = 127, hi = 0;
    for (const n of mel) { lo = Math.min(lo, n.m); hi = Math.max(hi, n.m); }
    if (!mel.length) { lo = 60; hi = 72; }
    const pitches = [...new Set(mel.map((n) => n.m))].sort((a, b) => a - b);
    S.bars = pitches.slice(0, 16).map((m, i, a) => {
      const k = a.length > 1 ? i / (a.length - 1) : 0.5;
      const x = 95 + k * 530;
      const y = 720 - Math.sin(k * Math.PI) * 200;
      return { m, x, y, w: 92 - k * 34, hit: 0, col: ramp(S.cols.slice(0, 4), k) };
    });
    const barOf = (m) => S.bars.reduce((best, b) => (Math.abs(b.m - m) < Math.abs(best.m - m) ? b : best), S.bars[0]);
    S.cannons = [{ x: 90, y: 1010, ang: -1, recoil: 0 }, { x: W - 90, y: 1010, ang: -2, recoil: 0 }];
    S.shots = mel.map((n) => {
      const bar = barOf(n.m);
      const c = S.cannons[bar.x < W / 2 ? 1 : 0];
      // ballistic launch that lands on the bar exactly at the note time
      const vx = (bar.x - c.x) / S.T, vy = (bar.y - 30 - c.y - 0.5 * S.g * S.T * S.T) / S.T;
      return { t0: n.t - S.T, tHit: n.t, bar, c, vx, vy, m: n.m, col: bar.col, fired: false, done: false };
    });
    S.si = 0;
    S.balls = [];
  },
  update(S, dt) {
    while (S.si < S.shots.length && S.shots[S.si].t0 <= S.vt) {
      const s = S.shots[S.si++];
      const c = s.c;
      c.ang = Math.atan2(s.vy, s.vx);
      c.recoil = 1;
      S.balls.push({ x: c.x + Math.cos(c.ang) * 60, y: c.y + Math.sin(c.ang) * 60, vx: s.vx, vy: s.vy, s, bounced: false, life: 3, trail: S.newTrail(10) });
      // exact: start from the cannon at t0 and integrate analytically
      const b = S.balls[S.balls.length - 1];
      b.x = c.x; b.y = c.y; b.age = S.vt - s.t0;
      S.fx.burst(c.x + Math.cos(c.ang) * 84, c.y + Math.sin(c.ang) * 84, '#ffd27a', 6, 260, { grav: -100, shards: false });
      S.sfx('thud', { v: 0.25 }, 0.05);
    }
    for (const c of S.cannons) c.recoil = Math.max(0, c.recoil - dt * 5);
    for (const b of S.balls) {
      b.life -= dt;
      if (!b.bounced) {
        b.age += dt;
        const t = b.age, s = b.s;
        b.x = s.c.x + s.vx * t; b.y = s.c.y + s.vy * t + 0.5 * S.g * t * t;
        b.vx = s.vx; b.vy = s.vy + S.g * t;
        if (S.vt >= s.tHit) {
          b.bounced = true;
          b.x = s.bar.x; b.y = s.bar.y - 30;
          b.vy = -Math.abs(b.vy) * 0.45; b.vx = (W / 2 - b.x) * 0.9; // drops toward the catch tray
          s.bar.hit = 1;
          S.noteMidi(s.m + 12, 0.5, 'xylo');
          S.fx.burst(b.x, b.y, s.col, 8, 280, { grav: 500, shards: false });
          S.fx.shock(b.x, b.y, s.col, 60, 0.3, 4);
        }
      } else {
        b.vy += S.g * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      }
      b.trail.push(b.x, b.y);
    }
    for (const b of S.balls) if (b.bounced && b.y > 1075 && !b.caught) { b.caught = true; b.life = 0; S.fx.burst(b.x, 1075, b.s.col, 5, 160, { grav: 400, shards: false }); }
    S.balls = S.balls.filter((b) => b.life > 0 && b.y < H + 50);
    for (const bar of S.bars) bar.hit = Math.max(0, bar.hit - dt * 3);
    if (S.justDropped) { S.flash(0.4, S.col(0)); S.punchHook(); }
  },
  background(S, g) {
    // stage floor with reflection glow
    const fg = g.createLinearGradient(0, 1060, 0, H);
    fg.addColorStop(0, alpha(S.col(1), 0.18)); fg.addColorStop(1, alpha(S.col(1), 0));
    g.fillStyle = fg; g.fillRect(0, 1060, W, H - 1060);
    drawGlow(g, W / 2, 640, 520, S.col(0), 0.18 + S.song.energy(S.vt) * 0.25);
  },
  draw(S, g) {
    // xylophone frame
    g.strokeStyle = alpha(S.theme.fg, 0.3); g.lineWidth = 6;
    g.beginPath();
    S.bars.forEach((b, i) => (i ? g.lineTo(b.x, b.y + 30) : g.moveTo(b.x, b.y + 30)));
    g.stroke();
    for (const b of S.bars) {
      const wob = Math.sin(S.vt * 60) * b.hit * 3;
      g.save();
      g.translate(b.x, b.y + wob);
      if (b.hit > 0) drawGlow(g, 0, 0, 130, b.col, b.hit);
      const gr = g.createLinearGradient(0, -18, 0, 18);
      gr.addColorStop(0, lighten(b.col, 0.4 + b.hit * 0.3)); gr.addColorStop(1, darken(b.col, 0.2));
      g.fillStyle = gr;
      roundRect(g, -b.w / 2, -16, b.w, 32, 10); g.fill();
      g.fillStyle = alpha('#ffffff', 0.4); g.fillRect(-b.w / 2 + 8, -12, b.w - 16, 5);
      g.fillStyle = '#c0c0c8';
      g.beginPath(); g.arc(-b.w / 2 + 8, 0, 3, 0, TAU); g.arc(b.w / 2 - 8, 0, 3, 0, TAU); g.fill();
      g.restore();
    }
    for (const b of S.balls) {
      if (S.trails) b.trail.draw(g, b.s.col, 18, S.theme.dark, 0.5);
      S.ball(g, b.x, b.y, 14, b.s.col, { glow: 0.7 });
    }
    // cannons: barrel aims, recoils
    for (const c of S.cannons) {
      g.save();
      g.translate(c.x, c.y);
      g.rotate(c.ang);
      g.translate(-c.recoil * 14, 0);
      const gr = g.createLinearGradient(0, -20, 0, 20);
      gr.addColorStop(0, '#8b93a7'); gr.addColorStop(0.5, '#e8ecf5'); gr.addColorStop(1, '#4a5163');
      g.fillStyle = gr;
      roundRect(g, -14, -28, 110, 56, 14); g.fill();
      g.fillStyle = darken(S.col(3), 0.2); g.fillRect(30, -28, 14, 56);
      g.fillStyle = '#2a2f3b'; g.beginPath(); g.ellipse(96, 0, 8, 24, 0, 0, TAU); g.fill();
      if (c.recoil > 0.5) drawGlow(g, 110, 0, 70, '#ffcf6b', c.recoil);
      g.restore();
      S.ball(g, c.x, c.y, 48, S.col(3), { mat: 'chrome', glow: 0.2 });
      steel2(g, c.x - 60, c.y + 30, 120, 40);
    }
  },
};
