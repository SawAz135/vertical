// LOOPLAB — procedural soundtrack with a real build-up and drop, plus a spectrum model
// so visualizers and drop-synced templates react to exactly what you hear.
import { makeRng, clamp } from './util.js';
import { mtof } from './synth.js';

export const NB = 48; // spectrum bands
const FPS = 60;

const CHORDS = [
  [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], // i VI III VII
  [[0, 3, 7], [10, 14, 17], [8, 12, 15], [7, 10, 14]], // i VII VI v
  [[0, 3, 7], [5, 8, 12], [8, 12, 15], [10, 14, 17]], // i iv VI VII
];
const PENTA = [0, 3, 5, 7, 10];

/** Band index (0..NB-1) for a frequency, log spaced 30 Hz .. 14 kHz. */
export function bandOf(freq) {
  const x = Math.log(freq / 30) / Math.log(14000 / 30);
  return clamp(Math.floor(x * NB), 0, NB - 1);
}

export function composeSong(seed, dur, opts = {}) {
  const r = makeRng(seed * 7 + 3);
  const bpm = opts.bpm || r.pick([118, 120, 122, 124, 126, 128]);
  const spb = 60 / bpm, bar = spb * 4;
  const root = r.pick([45, 46, 47, 48, 49, 50, 52]); // A2..E3 (minor)
  const prog = r.pick(CHORDS);
  const dropFrac = opts.dropFrac ?? 0.5;
  let dropBar = Math.round((dur * dropFrac) / bar);
  dropBar = clamp(dropBar, 1, Math.max(1, Math.floor(dur / bar) - 1));
  if (dropBar * bar > dur - 1.5) dropBar = Math.max(1, Math.floor((dur - 1.5) / bar));
  const dropT = dropBar * bar;
  const totalBars = Math.ceil((dur + 1) / bar) + 1;
  const drums = [], notes = [], fx = [], filt = [];
  const beats = [], downbeats = [];
  // lead hook: 2-bar motif on pentatonic, 8th-note grid
  const motif = [];
  for (let i = 0; i < 16; i++) {
    if (i === 0 || r() < 0.55) motif.push({ s: i, deg: r.int(0, 7), len: r() < 0.3 ? 2 : 1 });
  }
  const arpPat = r.pick([[0, 1, 2, 1], [0, 2, 1, 2], [0, 1, 2, 3], [2, 1, 0, 1]]);

  for (let b = 0; b < totalBars; b++) {
    const t0 = b * bar;
    const chord = prog[b % 4];
    const isDrop = t0 >= dropT;
    const barsToDrop = dropBar - b;
    for (let q = 0; q < 4; q++) {
      beats.push(t0 + q * spb);
      if (q === 0) downbeats.push(t0);
    }
    const inGap = (t) => !isDrop && t >= dropT - spb * 0.5 && t < dropT;
    // pads always
    notes.push({ t: t0, d: bar, m: chord.map((c) => root + 12 + c), inst: 'pad', v: isDrop ? 1 : 0.8 });
    if (!isDrop) {
      // intro / build: arp plucks, light hats, heartbeat kick
      for (let i = 0; i < 8; i++) {
        const t = t0 + i * spb * 0.5;
        if (inGap(t)) continue;
        const ci = arpPat[i % 4];
        const m = root + 24 + (chord[ci] ?? chord[0] + 12);
        notes.push({ t, d: spb * 0.5, m, inst: 'pluck', v: 0.6 + 0.4 * (1 - Math.min(1, barsToDrop / 6)) });
      }
      if (b >= 1) for (let q = 0; q < 4; q++) { const t = t0 + q * spb + spb * 0.5; if (!inGap(t)) drums.push({ t, n: 'hat', v: 0.5 }); }
      if (barsToDrop > 2 && b >= 1) { drums.push({ t: t0, n: 'kick', v: 0.6 }); drums.push({ t: t0 + spb * 2, n: 'kick', v: 0.45 }); }
      if (barsToDrop <= 2) {
        // snare roll that accelerates into the drop
        const div = barsToDrop === 2 ? 4 : 8;
        const half = barsToDrop === 1;
        for (let i = 0; i < div * 2; i++) {
          const sub = half && i >= div ? 2 : 1;
          for (let k = 0; k < sub; k++) {
            const t = t0 + (i * bar) / (div * 2) + (k * bar) / (div * 2 * sub);
            if (inGap(t)) continue;
            drums.push({ t, n: 'snare', v: 0.35 + 0.6 * ((t - (dropT - 2 * bar)) / (2 * bar)) });
          }
        }
      }
      // bass pulse on beats during intro (quiet)
      if (b >= 1 && barsToDrop > 1) notes.push({ t: t0, d: spb * 1.9, m: root + chord[0] - 12 + 12, inst: 'bass', v: 0.5 });
    } else {
      // drop: four on the floor, claps, 16th hats, offbeat bass, lead hook
      for (let q = 0; q < 4; q++) {
        drums.push({ t: t0 + q * spb, n: 'kick', v: 1 });
        if (q % 2 === 1) drums.push({ t: t0 + q * spb, n: 'clap', v: 0.9 });
        for (let s = 0; s < 4; s++) drums.push({ t: t0 + q * spb + (s * spb) / 4, n: 'hat', v: s === 2 ? 0.8 : 0.4, open: s === 2 });
        notes.push({ t: t0 + q * spb + spb * 0.5, d: spb * 0.45, m: root + chord[0], inst: 'bass', v: 1 });
        notes.push({ t: t0 + q * spb + spb * 0.75, d: spb * 0.22, m: root + chord[0] + 12, inst: 'bass', v: 0.7 });
      }
      const half = (b - dropBar) % 2;
      for (const n of motif) {
        if ((n.s >= 8) !== (half === 1)) continue;
        const s = n.s % 8;
        const deg = n.deg;
        const m = root + 24 + PENTA[deg % 5] + 12 * Math.floor(deg / 5);
        notes.push({ t: t0 + s * spb * 0.5, d: spb * 0.5 * n.len, m, inst: 'lead', v: 0.9 });
      }
    }
    if (b === dropBar) { fx.push({ t: t0, n: 'crash' }); fx.push({ t: t0, n: 'impact' }); }
  }
  if (dropBar >= 2) fx.push({ t: dropT - 2 * bar, n: 'riser', d: 2 * bar - spb * 0.5 });
  else fx.push({ t: Math.max(0, dropT - bar), n: 'riser', d: bar - spb * 0.5 });
  // filter: muffled intro opening up into the drop
  filt.push({ t: 0, f: 900 });
  filt.push({ t: Math.max(0.01, dropT - 2 * bar), f: 1400 });
  filt.push({ t: Math.max(0.02, dropT - spb * 0.5), f: 7000 });
  filt.push({ t: dropT, f: 20000 });

  const song = {
    kind: 'gen', seed, bpm, spb, bar, root, dur, dropT, beats, downbeats, drums, notes, fx, filt,
    scale: (deg, oct = 0) => root + 24 + 12 * oct + PENTA[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5),
  };
  sortSong(song);
  song.kicks = drums.filter((d) => d.n === 'kick').map((d) => d.t);
  buildSpectrum(song);
  return song;
}

/** Virtual spectrum built from the score itself (frame-exact for any time t). */
function buildSpectrum(song) {
  const n = Math.ceil((song.dur + 1) * FPS);
  const spec = new Float32Array(n * NB);
  const add = (f0, f1, band, amt, attack, decay, width = 1) => {
    const a = Math.max(0, Math.floor(f0 * FPS)), b = Math.min(n - 1, Math.ceil(f1 * FPS));
    for (let i = a; i <= b; i++) {
      const tt = i / FPS - f0;
      if (tt < 0) continue;
      const env = tt < attack ? tt / attack : Math.exp(-(tt - attack) / decay);
      for (let w = -width; w <= width; w++) {
        const k = band + w;
        if (k < 0 || k >= NB) continue;
        spec[i * NB + k] += amt * env * (1 - Math.abs(w) / (width + 1));
      }
    }
  };
  const filtAt = (t) => {
    const F = song.filt;
    for (let i = F.length - 1; i >= 0; i--) if (t >= F[i].t) {
      const nx = F[i + 1];
      if (!nx) return F[i].f;
      return F[i].f + (nx.f - F[i].f) * ((t - F[i].t) / (nx.t - F[i].t));
    }
    return 20000;
  };
  for (const d of song.drums) {
    if (d.n === 'kick') { add(d.t, d.t + 0.4, 1, 1.0 * d.v, 0.005, 0.12, 2); add(d.t, d.t + 0.1, 12, 0.3 * d.v, 0.002, 0.03, 3); }
    else if (d.n === 'snare' || d.n === 'clap') { add(d.t, d.t + 0.25, 22, 0.55 * d.v, 0.003, 0.08, 6); add(d.t, d.t + 0.2, 34, 0.4 * d.v, 0.002, 0.06, 5); }
    else if (d.n === 'hat') add(d.t, d.t + (d.open ? 0.3 : 0.08), 42, 0.45 * d.v, 0.002, d.open ? 0.12 : 0.03, 4);
  }
  for (const nt of song.notes) {
    const ms = Array.isArray(nt.m) ? nt.m : [nt.m];
    const lpk = Math.min(1, filtAt(nt.t) / 6000);
    for (const m of ms) {
      const b = bandOf(mtof(m));
      const amt = nt.inst === 'pad' ? 0.18 : nt.inst === 'bass' ? 0.75 : nt.inst === 'lead' ? 0.6 : 0.45;
      const dec = nt.inst === 'pad' ? 3 : nt.inst === 'pluck' ? 0.12 : nt.inst === 'lead' ? 0.25 : 0.2;
      add(nt.t, nt.t + nt.d + 0.2, b, amt * (nt.v || 1) * (nt.inst === 'bass' ? 1 : 0.4 + 0.6 * lpk), 0.01, dec, 1);
      add(nt.t, nt.t + nt.d, Math.min(NB - 1, b + 6), amt * 0.35 * lpk, 0.01, dec, 2); // harmonics
    }
  }
  for (const f of song.fx) {
    if (f.n === 'riser') {
      const a = Math.floor(f.t * FPS), b = Math.min(n - 1, Math.floor((f.t + f.d) * FPS));
      for (let i = a; i <= b; i++) {
        const k = (i - a) / Math.max(1, b - a);
        const band = Math.floor(10 + k * 30);
        for (let w = -4; w <= 4; w++) if (band + w < NB) spec[i * NB + band + w] += 0.5 * k * (1 - Math.abs(w) / 5);
      }
    }
    if (f.n === 'crash') add(f.t, f.t + 1.6, 40, 0.7, 0.003, 0.5, 7);
  }
  song.specTable = spec;
  song.nFrames = n;
  finishSpectrum(song);
}

export function finishSpectrum(song) {
  const spec = song.specTable, n = song.nFrames;
  const energy = new Float32Array(n), bass = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let e = 0, lo = 0;
    for (let k = 0; k < NB; k++) {
      const v = Math.max(0, Math.min(1.2, spec[i * NB + k]));
      spec[i * NB + k] = v;
      e += v;
      if (k < 6) lo += v;
    }
    energy[i] = e / NB;
    bass[i] = lo / 6;
  }
  // normalise energy to 0..1
  let mx = 1e-6;
  for (let i = 0; i < n; i++) mx = Math.max(mx, energy[i]);
  for (let i = 0; i < n; i++) energy[i] /= mx;
  let mb = 1e-6;
  for (let i = 0; i < n; i++) mb = Math.max(mb, bass[i]);
  for (let i = 0; i < n; i++) bass[i] = Math.min(1, bass[i] / mb);
  song.energyTable = energy;
  song.bassTable = bass;
  const idx = (t) => clamp(Math.round(t * FPS), 0, n - 1);
  song.spectrum = (t, out) => {
    const i = idx(t);
    out = out || new Float32Array(NB);
    for (let k = 0; k < NB; k++) out[k] = spec[i * NB + k];
    return out;
  };
  song.energy = (t) => energy[idx(t)];
  song.bass = (t) => bass[idx(t)];
}

/** Silent tempo map used when the user picks "no music": templates still get beats and a drop. */
export function silentSong(dur, dropFrac = 0.5) {
  const s = composeSong(1, dur, { bpm: 120, dropFrac });
  s.kind = 'none';
  return s;
}

/**
 * Plays a song on a Synth. Live mode pumps a 0.35 s look-ahead window; offline mode
 * schedules everything at once.
 */
export class SongPlayer {
  constructor(synth, song, buffer = null, bufferOffset = 0) {
    this.s = synth; this.song = song; this.buffer = buffer; this.bufOff = bufferOffset;
    this.cursor = { d: 0, n: 0, f: 0 };
    this.src = null;
  }
  /** t0: context time that corresponds to song time `from`. */
  start(t0, from = 0) {
    if (this.s.o && this.s.o.hitTrack) return; // music is driven by impacts, not by time
    this.t0 = t0 - from;
    this.from = from;
    const song = this.song;
    this.cursor.d = lowerBound(song.drums, from);
    this.cursor.n = lowerBound(song.notes, from);
    this.cursor.f = lowerBound(song.fx, from - 4);
    if (this.buffer) {
      const src = this.s.ctx.createBufferSource();
      src.buffer = this.buffer;
      src.connect(this.s.music);
      const off = this.bufOff + from;
      if (off >= 0) src.start(t0, off);
      else src.start(t0 - off, 0);
      this.s.track(src);
      this.src = src;
      // fade-out at the end of the video
      return;
    }
  }
  pump(ctxNow, horizon = 0.35) {
    if (this.t0 == null) return;
    const song = this.song;
    if (this.buffer || song.kind === 'none') return;
    const tEnd = ctxNow - this.t0 + horizon;
    const s = this.s;
    const at = (t) => Math.max(ctxNow, this.t0 + t);
    while (this.cursor.d < song.drums.length && song.drums[this.cursor.d].t < tEnd) {
      const d = song.drums[this.cursor.d++];
      if (d.t < this.from - 0.01) continue;
      if (d.n === 'kick') s.kick(at(d.t), d.v);
      else if (d.n === 'snare') s.snare(at(d.t), d.v);
      else if (d.n === 'clap') s.clap(at(d.t), d.v);
      else if (d.n === 'hat') s.hat(at(d.t), d.v, d.open);
    }
    while (this.cursor.n < song.notes.length && song.notes[this.cursor.n].t < tEnd) {
      const n = song.notes[this.cursor.n++];
      if (n.t < this.from - 0.01) continue;
      if (n.inst === 'pad') s.pad(at(n.t), n.m, n.d, n.v);
      else if (n.inst === 'bass') s.bass(at(n.t), n.m, n.d, n.v);
      else if (n.inst === 'lead') s.lead(at(n.t), n.m, n.d, n.v);
      else if (n.inst === 'pluck') s.pluck(at(n.t), n.m, n.d, n.v);
    }
    while (this.cursor.f < song.fx.length && song.fx[this.cursor.f].t < tEnd) {
      const f = song.fx[this.cursor.f++];
      if (f.n === 'riser') {
        const end = f.t + f.d;
        if (end <= this.from) continue;
        const st = Math.max(f.t, this.from);
        s.riser(at(st), end - st);
      } else if (f.t >= this.from - 0.01) {
        if (f.n === 'crash') s.crash(at(f.t), 0.9);
        else if (f.n === 'impact') s.impact(at(f.t), 0.8);
      }
    }
    // filter automation
    const ft = ctxNow - this.t0 + 0.05;
    const p = s.musicLP.frequency;
    const fv = filterAt(song, ft);
    p.setTargetAtTime(fv, ctxNow, 0.04);
  }
  scheduleAll() {
    if (this.t0 == null) return;
    this.pump(this.t0 + this.from, 1e6);
    if (!this.buffer && this.song.kind !== 'none') {
      const p = this.s.musicLP.frequency;
      p.setValueAtTime(this.song.filt[0].f, this.t0);
      for (const f of this.song.filt) p.exponentialRampToValueAtTime(f.f, this.t0 + f.t);
    }
  }
}

function filterAt(song, t) {
  const F = song.filt;
  if (!F || !F.length) return 20000;
  if (t <= F[0].t) return F[0].f;
  for (let i = 0; i < F.length - 1; i++) {
    if (t < F[i + 1].t) {
      const k = (t - F[i].t) / (F[i + 1].t - F[i].t);
      return F[i].f * Math.pow(F[i + 1].f / F[i].f, k);
    }
  }
  return F[F.length - 1].f;
}

function lowerBound(arr, t) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].t < t) lo = m + 1; else hi = m; }
  return lo;
}

export function sortSong(song) {
  song.drums.sort((a, b) => a.t - b.t);
  song.notes.sort((a, b) => a.t - b.t);
  song.fx.sort((a, b) => a.t - b.t);
  return song;
}
