// LOOPLAB — WebAudio synthesiser. Works on a live AudioContext (preview) and on an
// OfflineAudioContext (export), so the exported soundtrack is identical to the preview.

const noiseBuffers = new WeakMap();
function noiseBuf(ctx) {
  let b = noiseBuffers.get(ctx);
  if (b) return b;
  const len = ctx.sampleRate * 2;
  b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
  noiseBuffers.set(ctx, b);
  return b;
}
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Synth {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.72;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.18;
    this.master.connect(comp);
    comp.connect(out || ctx.destination);
    this.music = ctx.createGain(); this.music.gain.value = 0.62; this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.75; this.sfx.connect(this.master);
    // shared reverb send for space
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.makeImpulse(1.8);
    this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.22;
    this.verbIn.connect(this.verb); this.verb.connect(this.master);
    // music low-pass (for build-ups) — automation target
    this.musicLP = ctx.createBiquadFilter();
    this.musicLP.type = 'lowpass'; this.musicLP.frequency.value = 20000; this.musicLP.Q.value = 0.7;
    this.musicLP.connect(this.music);
    this.nodes = [];
  }
  makeImpulse(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    let s = 777;
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = ((s / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    }
    return b;
  }
  track(n) { this.nodes.push(n); if (this.nodes.length > 4000) this.nodes.splice(0, 2000); return n; }
  stopAll() {
    for (const n of this.nodes) { try { n.stop(); } catch (e) { /* already stopped */ } }
    this.nodes.length = 0;
    try { this.master.disconnect(); } catch (e) { /* noop */ }
  }

  env(param, when, a, peak, d, sustain = 0.0001) {
    param.cancelScheduledValues(when);
    param.setValueAtTime(0.0001, when);
    param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + a);
    param.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), when + a + d);
  }
  osc(type, freq, when, dur, dest) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, when);
    o.connect(dest); o.start(when); o.stop(when + dur + 0.05);
    return this.track(o);
  }
  gain(dest, v = 1) { const g = this.ctx.createGain(); g.gain.value = v; g.connect(dest); return g; }
  noise(when, dur, dest) {
    const s = this.ctx.createBufferSource();
    s.buffer = noiseBuf(this.ctx); s.loop = true;
    s.connect(dest); s.start(when, Math.random() * 1.5); s.stop(when + dur + 0.05);
    return this.track(s);
  }

  // ---------------- drums ----------------
  kick(when, vel = 1, bus = this.musicLP) {
    const g = this.gain(bus, 0);
    this.env(g.gain, when, 0.002, 1.1 * vel, 0.42);
    const o = this.osc('sine', 150, when, 0.5, g);
    o.frequency.setValueAtTime(160, when);
    o.frequency.exponentialRampToValueAtTime(42, when + 0.11);
    const cg = this.gain(bus, 0);
    this.env(cg.gain, when, 0.001, 0.35 * vel, 0.02);
    const c = this.osc('square', 1800, when, 0.03, cg);
    c.frequency.exponentialRampToValueAtTime(200, when + 0.02);
  }
  snare(when, vel = 1, bus = this.musicLP) {
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200;
    const g = this.gain(bus, 0); f.connect(g); f.connect(this.verbIn);
    this.env(g.gain, when, 0.001, 0.55 * vel, 0.18);
    this.noise(when, 0.25, f);
    const tg = this.gain(bus, 0);
    this.env(tg.gain, when, 0.001, 0.35 * vel, 0.09);
    const o = this.osc('triangle', 220, when, 0.12, tg);
    o.frequency.exponentialRampToValueAtTime(140, when + 0.08);
  }
  clap(when, vel = 1, bus = this.musicLP) {
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.9;
    const g = this.gain(bus, 0); f.connect(g); f.connect(this.verbIn);
    g.gain.setValueAtTime(0.0001, when);
    for (let i = 0; i < 3; i++) {
      g.gain.setValueAtTime(0.5 * vel, when + i * 0.012);
      g.gain.exponentialRampToValueAtTime(0.05, when + i * 0.012 + 0.01);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    this.noise(when, 0.22, f);
  }
  hat(when, vel = 1, open = false, bus = this.musicLP) {
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
    const g = this.gain(bus, 0); f.connect(g);
    this.env(g.gain, when, 0.001, 0.22 * vel, open ? 0.22 : 0.045);
    this.noise(when, open ? 0.3 : 0.08, f);
  }
  crash(when, vel = 1) {
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4000;
    const g = this.gain(this.music, 0); f.connect(g); f.connect(this.verbIn);
    this.env(g.gain, when, 0.002, 0.35 * vel, 1.6);
    this.noise(when, 1.8, f);
  }
  riser(when, dur) {
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
    f.frequency.setValueAtTime(400, when);
    f.frequency.exponentialRampToValueAtTime(9000, when + dur);
    const g = this.gain(this.music, 0); f.connect(g); f.connect(this.verbIn);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.32, when + dur * 0.97);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.04);
    this.noise(when, dur + 0.05, f);
    // pitch riser
    const og = this.gain(this.music, 0);
    og.gain.setValueAtTime(0.0001, when);
    og.gain.exponentialRampToValueAtTime(0.08, when + dur * 0.95);
    og.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.03);
    const o = this.osc('sawtooth', 110, when, dur, og);
    o.frequency.exponentialRampToValueAtTime(1760, when + dur);
  }
  impact(when, vel = 1) {
    const g = this.gain(this.master, 0);
    this.env(g.gain, when, 0.002, 1.0 * vel, 1.4);
    const o = this.osc('sine', 90, when, 1.5, g);
    o.frequency.exponentialRampToValueAtTime(28, when + 1.2);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
    const ng = this.gain(this.master, 0); f.connect(ng); f.connect(this.verbIn);
    this.env(ng.gain, when, 0.002, 0.6 * vel, 0.9);
    this.noise(when, 1, f);
  }

  // ---------------- tonal ----------------
  bass(when, midi, dur, vel = 1) {
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(180, when);
    f.frequency.exponentialRampToValueAtTime(1400 * vel, when + 0.03);
    f.frequency.exponentialRampToValueAtTime(220, when + Math.min(dur, 0.25));
    const g = this.gain(this.musicLP, 0); f.connect(g);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.42 * vel, when + 0.008);
    g.gain.setValueAtTime(0.42 * vel, when + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    this.osc('sawtooth', mtof(midi), when, dur, f);
    this.osc('square', mtof(midi - 12), when, dur, f).detune.value = 6;
  }
  pad(when, midis, dur, vel = 1) {
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; f.Q.value = 0.5;
    const g = this.gain(this.musicLP, 0); f.connect(g); f.connect(this.verbIn);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.06 * vel, when + Math.min(0.4, dur * 0.3));
    g.gain.setValueAtTime(0.06 * vel, when + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    for (const m of midis) {
      this.osc('sawtooth', mtof(m), when, dur, f).detune.value = -9;
      this.osc('sawtooth', mtof(m), when, dur, f).detune.value = 9;
    }
  }
  lead(when, midi, dur, vel = 1) {
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(5200, when);
    f.frequency.exponentialRampToValueAtTime(1200, when + dur);
    const g = this.gain(this.musicLP, 0); f.connect(g); f.connect(this.verbIn);
    this.env(g.gain, when, 0.005, 0.16 * vel, dur, 0.0001);
    this.osc('square', mtof(midi), when, dur, f);
    this.osc('sawtooth', mtof(midi + 12), when, dur, f).detune.value = 7;
  }
  pluck(when, midi, dur, vel = 1) {
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(6000, when);
    f.frequency.exponentialRampToValueAtTime(500, when + 0.18);
    const g = this.gain(this.musicLP, 0); f.connect(g); f.connect(this.verbIn);
    this.env(g.gain, when, 0.003, 0.12 * vel, Math.min(0.35, dur + 0.1));
    this.osc('sawtooth', mtof(midi), when, 0.45, f);
  }

  // ---------------- sound effects ----------------
  /** Tuned hit. timbre: bell | marimba | glass | pluck | piano | xylo */
  note(when, midi, vel = 0.8, timbre = 'bell', dur = 0.9) {
    const bus = this.sfx;
    const g = this.gain(bus, 0); g.connect(this.verbIn);
    const f = mtof(midi);
    if (timbre === 'marimba' || timbre === 'xylo') {
      this.env(g.gain, when, 0.002, 0.5 * vel, timbre === 'xylo' ? 0.5 : 0.35);
      this.osc('sine', f, when, 0.6, g);
      const g2 = this.gain(bus, 0); this.env(g2.gain, when, 0.001, 0.2 * vel, 0.06);
      this.osc('sine', f * (timbre === 'xylo' ? 3 : 4), when, 0.1, g2);
    } else if (timbre === 'glass') {
      this.env(g.gain, when, 0.002, 0.28 * vel, dur * 1.4);
      this.osc('sine', f * 2, when, dur * 1.5, g);
      this.osc('sine', f * 2 * 2.76, when, dur, g).detune.value = 4;
    } else if (timbre === 'pluck') {
      this.pluckSfx(when, midi, vel);
    } else if (timbre === 'piano') {
      this.env(g.gain, when, 0.003, 0.3 * vel, dur * 1.2);
      this.osc('triangle', f, when, dur * 1.3, g);
      const g2 = this.gain(bus, 0); this.env(g2.gain, when, 0.002, 0.12 * vel, dur * 0.5);
      this.osc('sine', f * 2, when, dur, g2);
      this.osc('sine', f * 3.01, when, dur * 0.4, g2);
    } else {
      // bell: FM-ish additive partials
      this.env(g.gain, when, 0.002, 0.3 * vel, dur);
      this.osc('sine', f, when, dur + 0.1, g);
      const g2 = this.gain(bus, 0); this.env(g2.gain, when, 0.001, 0.14 * vel, dur * 0.45);
      this.osc('sine', f * 2.0, when, dur, g2);
      this.osc('sine', f * 3.01, when, dur * 0.6, g2);
    }
  }
  pluckSfx(when, midi, vel) {
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(7000, when); f.frequency.exponentialRampToValueAtTime(700, when + 0.25);
    const g = this.gain(this.sfx, 0); f.connect(g); f.connect(this.verbIn);
    this.env(g.gain, when, 0.002, 0.3 * vel, 0.45);
    this.osc('sawtooth', mtof(midi), when, 0.5, f);
    this.osc('square', mtof(midi + 12), when, 0.3, f).detune.value = -5;
  }
  pop(when, vel = 0.8, pitch = 1) {
    const g = this.gain(this.sfx, 0);
    this.env(g.gain, when, 0.002, 0.55 * vel, 0.09);
    const o = this.osc('sine', 520 * pitch, when, 0.12, g);
    o.frequency.exponentialRampToValueAtTime(1300 * pitch, when + 0.05);
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500 * pitch;
    const ng = this.gain(this.sfx, 0); f.connect(ng);
    this.env(ng.gain, when, 0.001, 0.25 * vel, 0.04);
    this.noise(when, 0.06, f);
  }
  shatter(when, vel = 0.8) {
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000;
    const g = this.gain(this.sfx, 0); f.connect(g); f.connect(this.verbIn);
    this.env(g.gain, when, 0.001, 0.4 * vel, 0.35);
    this.noise(when, 0.4, f);
    for (let i = 0; i < 4; i++) {
      const tg = this.gain(this.sfx, 0);
      this.env(tg.gain, when + i * 0.018, 0.001, 0.12 * vel, 0.25);
      this.osc('sine', 2400 + i * 900 + ((when * 997) % 400), when + i * 0.018, 0.3, tg);
    }
  }
  crush(when, vel = 0.9) {
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = this.gain(this.sfx, 0); f.connect(g); f.connect(this.verbIn);
    this.env(g.gain, when, 0.002, 0.9 * vel, 0.3);
    this.noise(when, 0.35, f);
    const og = this.gain(this.sfx, 0);
    this.env(og.gain, when, 0.001, 0.7 * vel, 0.25);
    const o = this.osc('sine', 120, when, 0.3, og);
    o.frequency.exponentialRampToValueAtTime(38, when + 0.25);
    const cf = this.ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 3200; cf.Q.value = 3;
    const cg = this.gain(this.sfx, 0); cf.connect(cg);
    this.env(cg.gain, when + 0.01, 0.001, 0.35 * vel, 0.07);
    this.noise(when + 0.01, 0.1, cf);
  }
  clank(when, vel = 0.7) {
    const g = this.gain(this.sfx, 0); g.connect(this.verbIn);
    this.env(g.gain, when, 0.001, 0.25 * vel, 0.35);
    for (const r of [1, 2.41, 3.87, 5.3]) this.osc('square', 180 * r, when, 0.4, g);
  }
  snap(when, vel = 0.7) {
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4200; f.Q.value = 1.5;
    const g = this.gain(this.sfx, 0); f.connect(g);
    this.env(g.gain, when, 0.0008, 0.7 * vel, 0.05);
    this.noise(when, 0.07, f);
    const og = this.gain(this.sfx, 0);
    this.env(og.gain, when, 0.001, 0.25 * vel, 0.12);
    const o = this.osc('triangle', 1400, when, 0.15, og);
    o.frequency.exponentialRampToValueAtTime(300, when + 0.12);
  }
  whoosh(when, dur = 0.5, vel = 0.6) {
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, when); f.frequency.exponentialRampToValueAtTime(3000, when + dur * 0.6);
    f.frequency.exponentialRampToValueAtTime(500, when + dur);
    const g = this.gain(this.sfx, 0); f.connect(g);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.5 * vel, when + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    this.noise(when, dur, f);
  }
  zap(when, vel = 0.6) {
    const g = this.gain(this.sfx, 0);
    this.env(g.gain, when, 0.001, 0.18 * vel, 0.18);
    const o = this.osc('sawtooth', 2400, when, 0.2, g);
    o.frequency.exponentialRampToValueAtTime(90, when + 0.18);
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
    const ng = this.gain(this.sfx, 0); f.connect(ng);
    this.env(ng.gain, when, 0.001, 0.3 * vel, 0.12);
    this.noise(when, 0.15, f);
  }
  tick(when, vel = 0.5) {
    const g = this.gain(this.sfx, 0);
    this.env(g.gain, when, 0.0005, 0.3 * vel, 0.025);
    this.osc('square', 2600, when, 0.03, g);
  }
  win(when, root = 72) {
    const seq = [0, 4, 7, 12, 16, 19, 24];
    seq.forEach((s, i) => this.note(when + i * 0.07, root + s, 0.8, 'bell', 1.2));
    this.crash(when + 0.5, 0.8);
    this.impact(when, 0.6);
  }
  thud(when, vel = 0.6) {
    const g = this.gain(this.sfx, 0);
    this.env(g.gain, when, 0.002, 0.6 * vel, 0.15);
    const o = this.osc('sine', 110, when, 0.2, g);
    o.frequency.exponentialRampToValueAtTime(45, when + 0.14);
  }

  /** Plays one recorded sound event at absolute time `when`. */
  play(ev, when) {
    const p = ev.p || {};
    switch (ev.n) {
      case 'note': return this.note(when, p.m, p.v ?? 0.8, p.tb || 'bell', p.d || 0.9);
      case 'pop': return this.pop(when, p.v ?? 0.8, p.pitch || 1);
      case 'shatter': return this.shatter(when, p.v ?? 0.8);
      case 'crush': return this.crush(when, p.v ?? 0.9);
      case 'clank': return this.clank(when, p.v ?? 0.7);
      case 'snap': return this.snap(when, p.v ?? 0.7);
      case 'whoosh': return this.whoosh(when, p.d || 0.5, p.v ?? 0.6);
      case 'zap': return this.zap(when, p.v ?? 0.6);
      case 'tick': return this.tick(when, p.v ?? 0.5);
      case 'win': return this.win(when, p.m || 72);
      case 'impact': return this.impact(when, p.v ?? 1);
      case 'thud': return this.thud(when, p.v ?? 0.6);
      case 'kick': return this.kick(when, p.v ?? 1, this.sfx);
      case 'riser': return this.riser(when, p.d || 1);
      case 'crash': return this.crash(when, p.v ?? 0.8);
    }
  }
}
