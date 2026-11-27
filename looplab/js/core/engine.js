// LOOPLAB — simulation + render engine. A fixed-step, seeded simulation drives every
// template, so the live preview and the exported video are the same performance.
import { TAU, clamp, lerp, makeRng, makeCanvas, alpha, lighten, darken, mix, easeOutBack, easeOutCubic, smooth, roundRect, fmtInt } from './util.js';
import { themeById, GLOWS } from './themes.js';
import { drawBall, drawGlow } from './materials.js';
import { FX, Trail } from './fx.js';

export const W = 720, H = 1280;
const SUB = 1 / 120;
export const FONT = '"Unbounded", "Arial Black", system-ui, sans-serif';
export const FONT_UI = '"Inter", system-ui, -apple-system, sans-serif';

const DEFAULT_ENTRIES = [
  { name: 'France', emoji: '🇫🇷', col: '#3b6cff' }, { name: 'Brésil', emoji: '🇧🇷', col: '#22c55e' },
  { name: 'Japon', emoji: '🇯🇵', col: '#ff3b5c' }, { name: 'Maroc', emoji: '🇲🇦', col: '#d61f3c' },
  { name: 'USA', emoji: '🇺🇸', col: '#4f7bff' }, { name: 'Espagne', emoji: '🇪🇸', col: '#ffc531' },
  { name: 'Italie', emoji: '🇮🇹', col: '#1fbf72' }, { name: 'Allemagne', emoji: '🇩🇪', col: '#f5b300' },
  { name: 'Canada', emoji: '🇨🇦', col: '#ff4040' }, { name: 'Algérie', emoji: '🇩🇿', col: '#17a65b' },
];
export { DEFAULT_ENTRIES };

export class Engine {
  constructor(canvas, o = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d', { alpha: false });
    this.live = !!o.live;
    this.quality = o.quality || 'high';
    this.onSfx = null;
    this.bloomC = makeCanvas(120, 214);
    this.bloomC2 = makeCanvas(45, 80);
    this.scratch = null;
    this.grain = makeGrain();
  }

  configure(cfg) {
    this.cfg = cfg;
    const [w, h] = cfg.size || [W, H];
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.scale = w / W;
    this.vign = null;
    this.reset();
  }

  reset() {
    const cfg = this.cfg;
    const theme = themeById(cfg.theme);
    const S = (this.S = new Scene(this, cfg, theme));
    S.fx = new FX(S, this.quality === 'low' ? 900 : this.quality === 'mid' ? 1800 : 3200);
    cfg.tpl.init(S);
    S.hookText = hookFor(cfg, S);
    // every physical contact is an impact (drives "music on impact" and contact sounds)
    const w = S.world;
    if (w) {
      const tick = (imp) => { if (imp > 140) S.sfx('contact', { v: Math.min(0.5, imp / 2500) }, 0.06); };
      const wrapCb = (name, f) => { const prev = w[name]; w[name] = prev ? (...a) => { prev(...a); f(...a); } : f; };
      wrapCb('onHit', (a, b, imp) => tick(imp));
      wrapCb('onSeg', (b, s, imp) => tick(imp));
      wrapCb('onPeg', (b, p, imp) => tick(imp));
      wrapCb('onBound', (b, imp) => tick(imp));
    }
  }

  /** Canvas size change without restarting the simulation. */
  resize(w, h) {
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w; this.canvas.height = h;
    this.scale = w / W; this.vign = null; this.scratch = null;
    this.cfg.size = [w, h];
  }

  /** Design-only changes (look, effects, text) applied live, the simulation keeps running. */
  hot(patch) {
    const cfg = (this.cfg = { ...this.cfg, ...patch });
    const S = this.S;
    S.cfg = cfg;
    if (patch.theme) { S.theme = themeById(cfg.theme); S.cols = S.theme.cols; }
    if (patch.mat) S.mat = cfg.mat;
    if (patch.glow) S.glowK = (GLOWS.find((x) => x.id === cfg.glow) || GLOWS[0]).k;
    S.glow = S.glowK * S.theme.glowBoost;
    if (patch.effects) S.effects = cfg.effects;
    if (patch.trails != null) S.trails = cfg.trails;
    if (patch.text) S.hookText = hookFor(cfg, S);
  }

  /** Advance by `dtv` seconds of video time. */
  advance(dtv) {
    const S = this.S;
    S.acc += dtv;
    let guard = 0;
    while (S.acc >= SUB - 1e-9 && guard++ < 40) {
      S.acc -= SUB;
      this.substep(SUB);
    }
    if (guard >= 40) S.acc = 0;
    S.frame++;
  }

  substep(dtv) {
    const S = this.S;
    // time scale (slow motion) eases toward its target
    if (S.slowT > 0) { S.slowT -= dtv; if (S.slowT <= 0) S.tsTarget = 1; }
    S.ts += (S.tsTarget - S.ts) * Math.min(1, dtv * 9);
    const dt = dtv * S.ts;
    const pvt = S.vt;
    S.vt += dtv;
    S.t += dt;
    // music clock events in this sub-step
    S.beat = S.kick = S.downbeat = false;
    const song = S.song;
    while (S.bi < song.beats.length && song.beats[S.bi] <= S.vt) { if (song.beats[S.bi] > pvt) { S.beat = true; S.beatIndex = S.bi; } S.bi++; }
    while (S.ki < song.kicks.length && song.kicks[S.ki] <= S.vt) { if (song.kicks[S.ki] > pvt) S.kick = true; S.ki++; }
    while (S.di < song.downbeats.length && song.downbeats[S.di] <= S.vt) { if (song.downbeats[S.di] > pvt) S.downbeat = true; S.di++; }
    if (!S.dropped && S.vt >= S.dropT) { S.dropped = true; S.justDropped = true; } else S.justDropped = false;
    S.tpl.update(S, dt, dtv);
    S.fx.update(dt);
    // camera smoothing
    const c = S.cam, k = Math.min(1, dtv * c.ease);
    c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k;
    c.zoom += (c.tz - c.zoom) * k; c.rot += (c.tr - c.rot) * k;
    S.trauma = Math.max(0, S.trauma - dtv * 1.6);
    S.flashA = Math.max(0, S.flashA - dtv * 3.2);
    S.glitchA = Math.max(0, S.glitchA - dtv * 2.5);
    S.hookPunch = Math.max(0, S.hookPunch - dtv * 3);
    S.counterPunch = Math.max(0, S.counterPunch - dtv * 5);
    if (S.winner) S.winner.t += dtv;
  }

  render() {
    const S = this.S, g = this.g;
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // background
    const th = S.theme;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, th.bg[0]); bg.addColorStop(1, th.bg[1]);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    if (S.tpl.background) S.tpl.background(S, g);
    // world
    g.save();
    const c = S.cam;
    const sh = S.effects.shake ? S.trauma * S.trauma : 0;
    const sx = sh * 26 * (Math.sin(S.vt * 71) + Math.sin(S.vt * 37) * 0.5);
    const sy = sh * 26 * (Math.cos(S.vt * 63) + Math.sin(S.vt * 29) * 0.5);
    g.translate(W / 2 + sx, H / 2 + sy);
    g.rotate(c.rot + sh * 0.03 * Math.sin(S.vt * 50));
    g.scale(c.zoom, c.zoom);
    g.translate(-c.x, -c.y);
    S.tpl.draw(S, g);
    S.fx.draw(g);
    g.restore();
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (S.tpl.overlay) S.tpl.overlay(S, g);
    this.drawHook(g);
    this.drawCounter(g);
    if (S.winner) this.drawWinner(g);
    this.post(g);
  }

  drawHook(g) {
    const S = this.S;
    const txt = S.hookText;
    if (!txt) return;
    const lines = wrap(g, txt, 46, 640);
    const intro = clamp(S.vt / 0.9, 0, 1);
    const punch = 1 + S.hookPunch * 0.12;
    const size = lines.length > 2 ? 40 : 46;
    let y = 118 + S.hookY;
    g.save();
    let wi = 0;
    for (const line of lines) {
      const words = line.split(' ');
      g.font = `800 ${size}px ${FONT}`;
      const total = g.measureText(line).width;
      let x = W / 2 - total / 2;
      for (const w of words) {
        const ww = g.measureText(w + ' ').width;
        const k = clamp(intro * (lines.join(' ').split(' ').length + 3) - wi, 0, 1);
        const sc = (k < 1 ? easeOutBack(k, 2.2) : 1) * punch;
        if (k > 0) {
          g.save();
          g.translate(x + ww / 2, y);
          g.scale(sc, sc);
          g.globalAlpha = Math.min(1, k * 2);
          S.text(g, w, 0, 0, size, S.theme.fg, { align: 'center', stroke: true, weight: 800 });
          g.restore();
        }
        x += ww; wi++;
      }
      y += size * 1.12;
    }
    g.restore();
  }

  drawCounter(g) {
    const S = this.S;
    const ct = S.counter;
    if (!ct || !S.cfg.text?.counter) return;
    const v = typeof ct.value === 'number' ? fmtInt(ct.value) : ct.value;
    const sc = 1 + S.counterPunch * 0.25;
    g.save();
    if (ct.style === 'center') {
      g.translate(ct.x ?? W / 2, ct.y ?? H / 2);
      g.scale(sc, sc);
      S.text(g, v, 0, 0, ct.size || 96, ct.col || S.theme.fg, { align: 'center', stroke: true, weight: 900, alpha: ct.alpha ?? 0.92 });
      if (ct.label) S.text(g, ct.label, 0, (ct.size || 96) * 0.62, 26, ct.col || S.theme.fg, { align: 'center', stroke: true, weight: 700, alpha: 0.8 });
    } else {
      const lines = S.hookText ? wrap(g, S.hookText, 46, 640).length : 0;
      const y = 118 + S.hookY + lines * 52 + (lines ? 6 : 0);
      g.translate(W / 2, y);
      g.scale(sc, sc);
      const label = ct.label ? `${ct.label} ${v}` : v;
      S.text(g, label, 0, 0, ct.size || 36, ct.col || S.theme.cols[2], { align: 'center', stroke: true, weight: 800 });
    }
    g.restore();
  }

  drawWinner(g) {
    const S = this.S, w = S.winner, t = w.t;
    if (t < w.delay) return;
    const k = t - w.delay;
    const a = clamp(k / 0.5, 0, 1);
    g.save();
    g.fillStyle = `rgba(0,0,0,${0.55 * a})`;
    g.fillRect(0, 0, W, H);
    const cy = H * 0.47;
    // rays
    g.save();
    g.translate(W / 2, cy);
    g.rotate(k * 0.35);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      g.rotate(TAU / 16);
      const gr = g.createLinearGradient(0, 0, 700, 0);
      gr.addColorStop(0, alpha(w.col, 0.35 * a)); gr.addColorStop(1, alpha(w.col, 0));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(700, -60); g.lineTo(700, 60); g.closePath(); g.fill();
    }
    g.restore();
    const ballK = easeOutBack(clamp(k / 0.7, 0, 1), 1.8);
    const R = 150 * ballK;
    if (R > 1) {
      drawGlow(g, W / 2, cy, R * 2.4, w.col, 0.8);
      drawBall(g, W / 2, cy, R, w.col, { mat: S.mat, img: w.img, glow: 0 });
      if (!w.img && w.emoji) S.text(g, w.emoji, W / 2, cy + 4, R * 0.9, '#fff', { align: 'center', emoji: true });
    }
    const tk = clamp((k - 0.35) / 0.5, 0, 1);
    if (tk > 0) {
      g.save();
      g.translate(W / 2, cy + 250);
      const s = easeOutBack(tk, 2.6);
      g.scale(s, s);
      S.text(g, w.title || '🏆 VAINQUEUR', 0, -70, 40, '#ffe27a', { align: 'center', stroke: true, weight: 800 });
      S.text(g, w.name, 0, 0, w.name.length > 12 ? 58 : 74, '#ffffff', { align: 'center', stroke: true, weight: 900, glow: w.col, maxW: 660 });
      if (w.sub) S.text(g, w.sub, 0, 62, 30, lighten(w.col, 0.5), { align: 'center', stroke: true, weight: 700 });
      g.restore();
    }
    g.restore();
  }

  post(g) {
    const S = this.S;
    const cv = this.canvas;
    // bloom: downsample + additive upscale (cheap, works everywhere)
    const bk = S.glowK * S.theme.glowBoost * (this.quality === 'low' ? 0.6 : 1);
    if (S.theme.dark && bk > 0.02) {
      const b1 = this.bloomC, b1g = b1.getContext('2d');
      b1g.globalCompositeOperation = 'copy';
      b1g.drawImage(cv, 0, 0, b1.width, b1.height);
      const b2 = this.bloomC2, b2g = b2.getContext('2d');
      b2g.globalCompositeOperation = 'copy';
      b2g.drawImage(b1, 0, 0, b2.width, b2.height);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'lighter';
      g.imageSmoothingEnabled = true;
      g.globalAlpha = 0.22 * bk;
      g.drawImage(b1, 0, 0, cv.width, cv.height);
      g.globalAlpha = 0.3 * bk;
      g.drawImage(b2, 0, 0, cv.width, cv.height);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    }
    // glitch
    if (S.effects.glitch && S.glitchA > 0.05) {
      if (!this.scratch || this.scratch.width !== cv.width) this.scratch = makeCanvas(cv.width, cv.height);
      const sg = this.scratch.getContext('2d');
      sg.globalCompositeOperation = 'copy';
      sg.drawImage(cv, 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0);
      const r = S.rng2;
      const n = Math.floor(3 + S.glitchA * 8);
      for (let i = 0; i < n; i++) {
        const y = r() * cv.height, h = (8 + r() * 60) * this.scale;
        const dx = (r() - 0.5) * 90 * S.glitchA * this.scale;
        g.drawImage(this.scratch, 0, y, cv.width, h, dx, y, cv.width, h);
      }
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.35 * S.glitchA;
      g.fillStyle = '#ff00aa';
      g.fillRect(0, r() * cv.height, cv.width, 3 * this.scale);
      g.fillStyle = '#00e5ff';
      g.fillRect(0, r() * cv.height, cv.width, 2 * this.scale);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    }
    // flash
    if (S.effects.flash && S.flashA > 0.01) {
      g.fillStyle = alpha(S.flashCol, Math.min(0.85, S.flashA));
      g.fillRect(0, 0, W, H);
    }
    // vignette
    if (!this.vign) {
      this.vign = makeCanvas(180, 320);
      const vg = this.vign.getContext('2d');
      const rg = vg.createRadialGradient(90, 160, 60, 90, 160, 200);
      rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.55)');
      vg.fillStyle = rg; vg.fillRect(0, 0, 180, 320);
    }
    g.globalAlpha = S.theme.dark ? 0.9 : 0.25;
    g.drawImage(this.vign, 0, 0, W, H);
    // grain
    g.globalAlpha = S.theme.dark ? 0.05 : 0.035;
    const ox = (S.frame * 37) % 256, oy = (S.frame * 91) % 256;
    g.save(); g.translate(-ox, -oy);
    g.fillStyle = g.createPattern(this.grain, 'repeat');
    g.fillRect(0, 0, W + 256, H + 256);
    g.restore();
    g.globalAlpha = 1;
    if (S.cfg.watermark) {
      S.text(g, 'fait avec LOOPLAB', W / 2, H - 42, 20, '#ffffff', { align: 'center', stroke: true, weight: 700, alpha: 0.55 });
    }
  }
}

function hookFor(cfg, S) {
  const t = cfg.text || {};
  if (t.mode === 'custom') return t.custom || '';
  if (t.mode === 'none') return '';
  return typeof cfg.tpl.hook === 'function' ? cfg.tpl.hook(S) : cfg.tpl.hook || '';
}

function wrap(g, txt, size, maxW) {
  g.font = `800 ${size}px ${FONT}`;
  const words = txt.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function makeGrain() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  const im = g.createImageData(256, 256);
  let s = 99;
  for (let i = 0; i < im.data.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const v = (s / 2147483647) * 255;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

/** Everything a template can use. */
export class Scene {
  constructor(engine, cfg, theme) {
    this.engine = engine;
    this.cfg = cfg;
    this.tpl = cfg.tpl;
    this.W = W; this.H = H;
    this.seed = cfg.seed;
    this.rng = makeRng(cfg.seed);
    this.rng2 = makeRng(cfg.seed ^ 0x5bd1e995);
    this.theme = theme;
    this.cols = theme.cols;
    this.mat = cfg.mat || 'glossy';
    this.glowK = (GLOWS.find((x) => x.id === cfg.glow) || GLOWS[0]).k;
    this.glow = this.glowK * theme.glowBoost;
    this.effects = cfg.effects || {};
    this.trails = cfg.trails !== false;
    this.opts = cfg.opts || {};
    this.entries = cfg.entries && cfg.entries.length ? cfg.entries : DEFAULT_ENTRIES;
    this.song = cfg.song;
    this.dur = cfg.dur;
    this.dropT = cfg.song.dropT;
    this.fxScale = engine.quality === 'low' ? 0.45 : engine.quality === 'mid' ? 0.75 : 1;
    this.t = 0; this.vt = 0; this.acc = 0; this.frame = 0;
    this.ts = 1; this.tsTarget = 1; this.slowT = 0;
    this.bi = 0; this.ki = 0; this.di = 0;
    this.beat = false; this.kick = false; this.downbeat = false; this.beatIndex = -1;
    this.dropped = false; this.justDropped = false;
    this.cam = { x: W / 2, y: H / 2, zoom: 1, rot: 0, tx: W / 2, ty: H / 2, tz: 1, tr: 0, ease: 6 };
    this.trauma = 0; this.flashA = 0; this.flashCol = '#ffffff'; this.glitchA = 0;
    this.hookText = ''; this.hookY = 0; this.hookPunch = 0;
    this.counter = null; this.counterPunch = 0;
    this.winner = null; this.ended = false;
    this.events = [];
    this.lastSfx = {};
    this.sfxWin = [];
    this.images = cfg.images || {};
  }
  get progress() { return this.vt / this.dur; }
  col(i) { i = Math.floor(i) || 0; return this.cols[((i % this.cols.length) + this.cols.length) % this.cols.length]; }
  entry(i) { return this.entries[i % this.entries.length]; }

  // ---------- audio ----------
  sfx(n, p = {}, minGap = 0.035) {
    const t = this.vt;
    if (this.lastSfx[n] != null && t - this.lastSfx[n] < minGap) return;
    // global polyphony guard: max 9 events per 100 ms
    if (n !== 'contact') {
      // global polyphony guard (plain contacts never steal room from real sounds)
      while (this.sfxWin.length && t - this.sfxWin[0] > 0.1) this.sfxWin.shift();
      if (this.sfxWin.length >= 9 && n !== 'win' && n !== 'impact') return;
      this.sfxWin.push(t);
    }
    this.lastSfx[n] = t;
    const ev = { t, n, p };
    this.events.push(ev);
    if (this.engine.onSfx) this.engine.onSfx(ev);
  }
  /** Melodic hit on the soundtrack's scale (degree may be any integer). */
  note(deg, v = 0.8, tb = 'bell', d = 0.9) {
    this.sfx('note', { m: this.song.scale(deg), v, tb, d }, 0.03);
  }
  noteMidi(m, v = 0.8, tb = 'bell', d = 0.9) { this.sfx('note', { m, v, tb, d }, 0.02); }

  // ---------- camera & screen effects ----------
  camTo(x, y, zoom = this.cam.tz, ease = 6) { const c = this.cam; c.tx = x; c.ty = y; c.tz = zoom; c.ease = ease; }
  camSnap() { const c = this.cam; c.x = c.tx; c.y = c.ty; c.zoom = c.tz; c.rot = c.tr; }
  shake(a) { this.trauma = Math.min(1, this.trauma + a); }
  flash(a = 0.6, col = '#ffffff') { this.flashA = Math.max(this.flashA, a); this.flashCol = col; }
  glitch(a = 0.8) { this.glitchA = Math.max(this.glitchA, a); }
  slowmo(scale = 0.25, dur = 1.2) { this.tsTarget = scale; this.slowT = dur; }
  punchHook() { this.hookPunch = 1; }
  setCounter(value, o = {}) {
    if (!this.counter || this.counter.value !== value) this.counterPunch = o.punch === false ? this.counterPunch : 1;
    this.counter = { ...(this.counter || {}), ...o, value };
  }
  win(e, o = {}) {
    if (this.winner) return;
    this.winner = { name: e.name, col: e.col, img: e.img, emoji: e.emoji, t: 0, delay: o.delay ?? 0.6, title: o.title, sub: o.sub };
    this.ended = true;
    this.sfx('win', { m: this.song.root + 24 });
    this.flash(0.7, e.col);
    this.shake(0.5);
    this.fx.confetti(W / 2, H * 0.62, this.cols, 160, 1100);
  }

  // ---------- drawing helpers ----------
  ball(g, x, y, r, col, o = {}) {
    drawBall(g, x, y, r, col, { mat: o.mat || this.mat, glow: o.glow ?? this.glow * 0.8, ...o });
  }
  glowAt(g, x, y, r, col, a = 1) { if (this.theme.dark) drawGlow(g, x, y, r, col, a * this.glow); }
  /** Multi-pass neon stroke; `path` builds the path. */
  neon(g, path, col, width, a = 1) {
    if (this.theme.dark && this.glow > 0.05) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = alpha(col, 0.16 * this.glow * a);
      g.lineWidth = width * 4.2; path(); g.stroke();
      g.strokeStyle = alpha(col, 0.3 * this.glow * a);
      g.lineWidth = width * 2.1; path(); g.stroke();
      g.restore();
    }
    g.strokeStyle = a < 1 ? alpha(col, a) : col;
    g.lineWidth = width; path(); g.stroke();
    if (this.theme.dark && this.glow > 0.5 && width > 2.5) {
      g.strokeStyle = alpha(lighten(col, 0.7), 0.6 * a);
      g.lineWidth = width * 0.35; path(); g.stroke();
    }
  }
  text(g, str, x, y, size, col, o = {}) {
    g.save();
    g.font = `${o.weight || 800} ${size}px ${o.emoji ? 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"' : FONT}`;
    g.textAlign = o.align || 'left';
    g.textBaseline = 'middle';
    if (o.alpha != null) g.globalAlpha *= o.alpha;
    let sx = 1;
    if (o.maxW) { const w = g.measureText(str).width; if (w > o.maxW) sx = o.maxW / w; }
    if (sx !== 1) { g.translate(x, y); g.scale(sx, sx); x = 0; y = 0; }
    if (o.glow && this.theme.dark) {
      g.save(); g.globalCompositeOperation = 'lighter';
      g.fillStyle = alpha(o.glow, 0.35);
      for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) g.fillText(str, x + dx, y + dy);
      g.restore();
    }
    if (o.stroke) {
      g.lineJoin = 'round';
      g.strokeStyle = o.strokeCol || (this.theme.dark || luminanceDark(col) ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)');
      g.lineWidth = Math.max(3, size * 0.16);
      g.strokeText(str, x, y);
    }
    g.fillStyle = col;
    g.fillText(str, x, y);
    g.restore();
  }
  label(g, str, x, y, size = 22, col = '#fff', bg = 'rgba(0,0,0,0.55)') {
    g.save();
    g.font = `700 ${size}px ${FONT}`;
    const w = g.measureText(str).width + size;
    g.fillStyle = bg;
    roundRect(g, x - w / 2, y - size * 0.75, w, size * 1.5, size * 0.75);
    g.fill();
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(str, x, y + 1);
    g.restore();
  }
  newTrail(len) { return new Trail(len); }
}

function luminanceDark(col) {
  // light text on light theme still gets a dark stroke for readability
  return col === '#ffffff' || col === '#fff';
}

export { mix, lighten, darken, alpha, smooth, lerp, clamp, TAU, easeOutCubic };
