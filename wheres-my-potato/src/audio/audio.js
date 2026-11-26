import { settings } from '../core/settings.js';
import { clamp } from '../core/util.js';

// =====================================================================================
// AUDIO ENGINE — everything is synthesised with WebAudio (no sample files).
// Buses: master → music / sfx / voice / ambience. Positional sounds use HRTF panners
// and the listener follows the camera.
// =====================================================================================
class Audio {
  constructor() { this.ok = false; this.last = {}; }
  init() {
    if (this.ok) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(this.master); this.comp = comp;
    this.bus = {};
    for (const b of ['music', 'sfx', 'voice', 'ambience']) { this.bus[b] = c.createGain(); this.bus[b].connect(comp); }
    // shared reverb (outdoor short slap) for sfx
    this.verb = c.createConvolver(); this.verb.buffer = this._impulse(1.4, 3); const vg = c.createGain(); vg.gain.value = 0.18; this.verb.connect(vg); vg.connect(comp);
    this.noise = this._noiseBuf(2);
    this.applyVolumes(); settings.on('change', () => this.applyVolumes());
    this.ok = true;
    this._ambience(); this._music();
  }
  applyVolumes() {
    if (!this.ctx) return; const v = settings.v, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(v.volMaster, t, 0.05);
    this.bus.music.gain.setTargetAtTime(v.volMusic * 0.5, t, 0.1); this.bus.sfx.gain.setTargetAtTime(v.volSfx, t, 0.05);
    this.bus.voice.gain.setTargetAtTime(v.volVoice, t, 0.05); this.bus.ambience.gain.setTargetAtTime(v.volAmbience * 0.6, t, 0.1);
  }
  _noiseBuf(sec) { const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  _impulse(sec, decay) { const c = this.ctx, n = c.sampleRate * sec, b = c.createBuffer(2, n, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); } return b; }
  setListener(cam) {
    if (!this.ok) return; const L = this.ctx.listener, p = cam.position, t = this.ctx.currentTime;
    const f = cam.getWorldDirection(this._f || (this._f = cam.position.clone()));
    if (L.positionX) { L.positionX.setTargetAtTime(p.x, t, 0.02); L.positionY.setTargetAtTime(p.y, t, 0.02); L.positionZ.setTargetAtTime(p.z, t, 0.02); L.forwardX.setTargetAtTime(f.x, t, 0.02); L.forwardY.setTargetAtTime(f.y, t, 0.02); L.forwardZ.setTargetAtTime(f.z, t, 0.02); L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
    this.lp = p;
  }
  // output node: positional (panner) or direct
  _out(pos, bus = 'sfx', send = 0.3, ref = 2) {
    const c = this.ctx, g = c.createGain();
    if (pos) {
      const p = c.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.maxDistance = 80; p.rolloffFactor = 1.2;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
      g.connect(p); p.connect(this.bus[bus]); if (send) { const s = c.createGain(); s.gain.value = send; p.connect(s); s.connect(this.verb); }
    } else { g.connect(this.bus[bus]); if (send) { const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(this.verb); } }
    return g;
  }
  _far(pos, d = 45) { return pos && this.lp && Math.hypot(pos.x - this.lp.x, pos.y - this.lp.y, pos.z - this.lp.z) > d; }
  _rate(k, ms) { const n = performance.now(); if (this.last[k] && n - this.last[k] < ms) return false; this.last[k] = n; return true; }
  _nz(dst, t, dur, type, f, q, gain, attack = 0.002) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dst); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    return fl;
  }
  _tone(dst, t, f0, f1, dur, type = 'sine', gain = 0.3, attack = 0.003) {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dst); o.start(t); o.stop(t + dur + 0.05); return o;
  }

  // ---------------- SFX ----------------
  footstep(surface, speed, pos) {
    if (!this.ok) return; const t = this.ctx.currentTime, o = this._out(pos, 'sfx', 0.1), v = clamp(0.25 + speed * 0.09, 0.2, 0.9);
    const p = 0.85 + Math.random() * 0.3;
    if (surface === 'soil') { this._nz(o, t, 0.16, 'lowpass', 700 * p, 0.8, v * 0.7); this._tone(o, t, 90 * p, 50, 0.09, 'sine', v * 0.5); this._nz(o, t + 0.03, 0.08, 'bandpass', 2400 * p, 1.5, v * 0.12); }
    else if (surface === 'grass') { this._nz(o, t, 0.2, 'highpass', 2500 * p, 0.6, v * 0.25); this._nz(o, t, 0.1, 'lowpass', 400, 1, v * 0.3); }
    else if (surface === 'gravel') { for (let k = 0; k < 4; k++) this._nz(o, t + k * 0.012 + Math.random() * 0.01, 0.06, 'bandpass', 2800 + Math.random() * 2500, 4, v * 0.28); this._nz(o, t, 0.12, 'lowpass', 600, 1, v * 0.35); }
    else if (surface === 'wood') { this._tone(o, t, 180 * p, 120, 0.12, 'triangle', v * 0.5); this._nz(o, t, 0.07, 'bandpass', 900 * p, 2, v * 0.4); }
    else if (surface === 'potatoes') { for (let k = 0; k < 3; k++) { this._tone(o, t + k * 0.03, 160 + Math.random() * 120, 90, 0.08, 'sine', v * 0.35); } this._nz(o, t, 0.14, 'lowpass', 900, 1, v * 0.4); }
  }
  land(surface, h) { if (!this.ok) return; this.footstep(surface, 6 + h * 4); const t = this.ctx.currentTime, o = this._out(null, 'sfx', 0.1); this._tone(o, t, 70, 40, 0.2, 'sine', clamp(h * 0.3, 0.1, 0.6)); }
  pickup(pos, pitch = 1) {
    if (!this.ok || !this._rate('pick', 25)) return; const t = this.ctx.currentTime, o = this._out(pos, 'sfx', 0.15);
    this._nz(o, t, 0.09, 'bandpass', 1600, 1.2, 0.25); // soil rustle
    this._tone(o, t + 0.02, 420 * pitch, 900 * pitch, 0.09, 'sine', 0.22); // cheerful pop
  }
  // potato lands in a container / hits something
  thud(kind, pos, speed = 2) {
    if (!this.ok || this._far(pos)) return; if (!this._rate('thud' + kind, kind === 'glass' ? 28 : 18)) return;
    const t = this.ctx.currentTime, o = this._out(pos, 'sfx', 0.25), v = clamp(speed / 6, 0.05, 0.6), p = 0.8 + Math.random() * 0.45;
    if (kind === 'glass') { // clink: inharmonic partials of a thick glass wall + soft thump
      const base = 1150 * p; [1, 2.32, 4.25, 6.63].forEach((m, k) => this._tone(o, t, base * m, base * m * 0.995, 0.5 / (k + 1) + 0.15, 'sine', v * 0.16 / (k + 1)));
      this._tone(o, t, 140 * p, 80, 0.1, 'sine', v * 0.5);
    } else if (kind === 'metal') { [1, 2.76, 5.4].forEach((m, k) => this._tone(o, t, 520 * p * m, 510 * p * m, 0.35 / (k + 1), 'sine', v * 0.2 / (k + 1))); this._tone(o, t, 150, 90, 0.08, 'sine', v * 0.5); }
    else if (kind === 'wood') { this._tone(o, t, 220 * p, 140, 0.1, 'triangle', v * 0.55); this._nz(o, t, 0.06, 'bandpass', 1200, 2, v * 0.3); }
    else if (kind === 'potato') { this._tone(o, t, 260 * p, 150, 0.07, 'sine', v * 0.45); this._nz(o, t, 0.05, 'lowpass', 1500, 1, v * 0.25); }
    else { this._tone(o, t, 110 * p, 60, 0.12, 'sine', v * 0.6); this._nz(o, t, 0.1, 'lowpass', 600, 1, v * 0.4); }
  }
  coin(pos, big = false) {
    if (!this.ok || !this._rate('coin', 45)) return; const t = this.ctx.currentTime, o = this._out(pos, 'sfx', 0.3, 4);
    const f = big ? 1318 : 1046 + Math.random() * 60;
    this._tone(o, t, f, f, 0.12, 'square', 0.06); this._tone(o, t + 0.07, f * 1.5, f * 1.5, 0.35, 'square', 0.06);
    this._tone(o, t + 0.07, f * 3, f * 3, 0.25, 'sine', 0.05);
    if (big) [0, 0.08, 0.16, 0.24].forEach((d, k) => this._tone(o, t + 0.3 + d, 1046 * [1, 1.25, 1.5, 2][k], 1046 * [1, 1.25, 1.5, 2][k], 0.25, 'triangle', 0.08));
  }
  cannon(pos) {
    if (!this.ok || !this._rate('cannon', 60)) return; const t = this.ctx.currentTime, o = this._out(pos, 'sfx', 0.35, 4);
    this._tone(o, t, 120, 38, 0.35, 'sine', 0.7); this._nz(o, t, 0.25, 'lowpass', 900, 0.8, 0.6); // boom
    const f = this._nz(o, t + 0.02, 0.4, 'bandpass', 3200, 1.2, 0.18, 0.01); f.frequency.exponentialRampToValueAtTime(900, t + 0.4); // pneumatic hiss
    this._tone(o, t + 0.05, 600, 300, 0.12, 'triangle', 0.08); // cork pop
  }
  boing(pos, power = 1) {
    if (!this.ok || !this._rate('boing', 70)) return; const t = this.ctx.currentTime, o = this._out(pos, 'sfx', 0.2, 3);
    const osc = this._tone(o, t, 140 * power, 420 * power, 0.32, 'sine', 0.35); osc.frequency.setValueAtTime(140 * power, t); osc.frequency.exponentialRampToValueAtTime(420 * power, t + 0.12); osc.frequency.exponentialRampToValueAtTime(260 * power, t + 0.3);
    this._nz(o, t, 0.08, 'lowpass', 400, 1, 0.3);
  }
  rain(level) {
    if (!this.ok) return;
    if (!this.rainNode) { const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900; const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 7000; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(f2); f2.connect(g); g.connect(this.bus.ambience); s.start(); this.rainNode = g; }
    this.rainNode.gain.setTargetAtTime(level * 0.5, this.ctx.currentTime, 0.4);
  }
  thunder() {
    if (!this.ok) return; const t = this.ctx.currentTime, o = this._out(null, 'ambience', 0.6);
    this._nz(o, t, 3.5, 'lowpass', 180, 0.7, 0.9, 0.05); this._nz(o, t + 0.1, 1.2, 'lowpass', 600, 0.7, 0.4, 0.02); this._tone(o, t, 55, 30, 2.5, 'sine', 0.4);
  }
  whoosh(pos) { if (!this.ok || !this._rate('wh', 60)) return; const t = this.ctx.currentTime, o = this._out(pos, 'sfx', 0.1); const f = this._nz(o, t, 0.25, 'bandpass', 600, 2, 0.18, 0.08); f.frequency.exponentialRampToValueAtTime(2400, t + 0.22); }
  bucketClank(pos) { if (!this.ok || !this._rate('clank', 80)) return; const t = this.ctx.currentTime, o = this._out(pos, 'sfx', 0.2); [1, 2.4, 3.9].forEach((m, k) => this._tone(o, t, 380 * m, 375 * m, 0.4 / (k + 1), 'sine', 0.12 / (k + 1))); }
  ui(kind = 'click') {
    if (!this.ok) return; const t = this.ctx.currentTime, o = this._out(null, 'sfx', 0);
    if (kind === 'click') this._tone(o, t, 900, 700, 0.05, 'triangle', 0.12);
    else if (kind === 'hover') this._tone(o, t, 1400, 1400, 0.03, 'sine', 0.04);
    else if (kind === 'page') { const f = this._nz(o, t, 0.35, 'bandpass', 1800, 0.7, 0.25, 0.06); f.frequency.exponentialRampToValueAtTime(4000, t + 0.3); this._nz(o, t + 0.22, 0.08, 'lowpass', 500, 1, 0.2); }
    else if (kind === 'buy') { [523, 659, 784, 1046].forEach((f, k) => this._tone(o, t + k * 0.07, f, f, 0.3, 'triangle', 0.12)); this.coin(null, false); }
    else if (kind === 'deny') { this._tone(o, t, 220, 180, 0.15, 'square', 0.06); this._tone(o, t + 0.12, 180, 140, 0.2, 'square', 0.06); }
    else if (kind === 'open') { this._tone(o, t, 300, 600, 0.18, 'sine', 0.12); this._nz(o, t, 0.2, 'bandpass', 2000, 1, 0.08); }
    else if (kind === 'fanfare') { [392, 523, 659, 784, 1046].forEach((f, k) => { this._tone(o, t + k * 0.11, f, f, 0.5, 'sawtooth', 0.04); this._tone(o, t + k * 0.11, f * 2, f * 2, 0.4, 'triangle', 0.05); }); }
  }

  // ---------------- Gérard's voice: formant babble synced to returned amplitude ----------------
  speak(text, pos) {
    if (!this.ok) return 1.5;
    const c = this.ctx, o = this._out(pos, 'voice', 0.08, 3), syl = Math.max(3, Math.round(text.length / 3.2)), dur = syl * 0.11;
    const src = c.createOscillator(); src.type = 'sawtooth';
    const f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(); f1.type = f2.type = 'bandpass'; f1.Q.value = 6; f2.Q.value = 8;
    const g = c.createGain(); g.gain.value = 0;
    src.connect(f1); src.connect(f2); f1.connect(g); f2.connect(g); g.connect(o);
    const t0 = c.currentTime + 0.02, vowels = [[700, 1220], [400, 2000], [550, 900], [300, 2300], [480, 1700]];
    const base = 105;
    this.voiceEnv = [];
    for (let k = 0; k < syl; k++) {
      const t = t0 + k * 0.11, v = vowels[Math.floor(Math.random() * vowels.length)], q = text.endsWith('?') && k > syl - 3 ? 1.25 : 1;
      src.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.25) * q * (k === syl - 1 ? 0.85 : 1), t);
      f1.frequency.setValueAtTime(v[0], t); f2.frequency.setValueAtTime(v[1], t);
      const a = 0.11 + Math.random() * 0.05;
      g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(a, t + 0.025); g.gain.linearRampToValueAtTime(a * 0.6, t + 0.07); g.gain.linearRampToValueAtTime(0.0, t + 0.1);
      this.voiceEnv.push(t);
    }
    src.start(t0); src.stop(t0 + dur + 0.1);
    this.voiceEnd = t0 + dur;
    return dur;
  }
  voiceAmp() {
    if (!this.ok || !this.voiceEnd) return 0; const t = this.ctx.currentTime; if (t > this.voiceEnd) return 0;
    const ph = ((t - this.voiceEnv[0]) % 0.11) / 0.11; return Math.sin(ph * Math.PI) * 0.9;
  }

  // ---------------- loops ----------------
  // conveyor motor: positional, pitch & rattle follow the speed and the load
  motor(pos) {
    if (!this.ok || this.motorNode) return;
    const c = this.ctx, o = this._out(pos, 'sfx', 0.15, 2.5);
    const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 48;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const g = c.createGain(); g.gain.value = 0.08;
    const rat = c.createBufferSource(); rat.buffer = this.noise; rat.loop = true; const rf = c.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 1800; rf.Q.value = 3;
    const rg = c.createGain(); rg.gain.value = 0.02; const lfo = c.createOscillator(); lfo.frequency.value = 9; const lg = c.createGain(); lg.gain.value = 0.015; lfo.connect(lg); lg.connect(rg.gain);
    osc.connect(lp); lp.connect(g); g.connect(o); rat.connect(rf); rf.connect(rg); rg.connect(o);
    osc.start(); rat.start(); lfo.start();
    this.motorNode = { osc, lfo, g, rg };
  }
  setMotor(speed, load) {
    if (!this.motorNode) return; const t = this.ctx.currentTime, m = this.motorNode;
    m.osc.frequency.setTargetAtTime(38 + speed * 16 + load * 4, t, 0.3); m.lfo.frequency.setTargetAtTime(6 + speed * 5, t, 0.3);
    m.g.gain.setTargetAtTime(0.05 + speed * 0.02 + load * 0.02, t, 0.3);
  }
  _ambience() {
    const c = this.ctx;
    // wind: filtered noise with a slow random gust envelope
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; const g = c.createGain(); g.gain.value = 0.12;
    s.connect(f); f.connect(g); g.connect(this.bus.ambience); s.start();
    const gust = () => { if (!this.ctx) return; const t = c.currentTime; f.frequency.setTargetAtTime(300 + Math.random() * 700, t, 1.5); g.gain.setTargetAtTime(0.06 + Math.random() * 0.12, t, 1.8); setTimeout(gust, 2500 + Math.random() * 4000); };
    gust();
    // birds: chirp phrases from random directions
    const bird = () => {
      if (!this.ctx) return; const t = c.currentTime + 0.05, ang = Math.random() * Math.PI * 2;
      const p = this.lp ? { x: this.lp.x + Math.cos(ang) * 25, y: 8, z: this.lp.z + Math.sin(ang) * 25 } : null;
      const o = this._out(p, 'ambience', 0.2, 10); const type = Math.random();
      const n = 2 + Math.floor(Math.random() * 5), base = 2500 + Math.random() * 2000;
      for (let k = 0; k < n; k++) {
        const tt = t + k * (type < 0.5 ? 0.09 : 0.16);
        if (type < 0.5) this._tone(o, tt, base, base * 1.4, 0.06, 'sine', 0.05);
        else this._tone(o, tt, base * 1.3, base * 0.8, 0.12, 'sine', 0.04);
      }
      setTimeout(bird, 1500 + Math.random() * 5000);
    };
    setTimeout(bird, 1000);
  }
  // light acoustic loop (plucked strings via Karplus-Strong)
  _pluckBuf(freq) {
    const c = this.ctx, sr = c.sampleRate, len = Math.floor(sr * 1.6), b = c.createBuffer(1, len, sr), d = b.getChannelData(0), N = Math.floor(sr / freq), ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    for (let i = 0, k = 0; i < len; i++, k = (k + 1) % N) { const nx = (k + 1) % N; ring[k] = (ring[k] + ring[nx]) * 0.4985; d[i] = ring[k]; }
    return b;
  }
  _music() {
    const c = this.ctx, notes = { G3: 196, A3: 220, B3: 246.9, C4: 261.6, D4: 293.7, E4: 329.6, Fs4: 370, G4: 392, A4: 440, B4: 493.9, D5: 587.3 };
    const bufs = {}; for (const k in notes) bufs[k] = this._pluckBuf(notes[k]);
    const prog = [['G3', 'D4', 'G4', 'B4'], ['E4', 'B3', 'G4', 'B4'], ['C4', 'G4', 'E4', 'A4'], ['D4', 'A3', 'Fs4', 'A4']];
    const mel = ['B4', 'A4', 'G4', 'A4', 'B4', 'D5', 'B4', 'A4', 'G4', 'E4', 'G4', 'A4', 'Fs4', 'A4', 'G4', null];
    let step = 0; const bpm = 92, dt = 60 / bpm / 2;
    let next = c.currentTime + 0.5;
    const play = (name, t, vol, pan = 0) => { const s = c.createBufferSource(); s.buffer = bufs[name]; const g = c.createGain(); g.gain.value = vol; const p = c.createStereoPanner(); p.pan.value = pan; s.connect(g); g.connect(p); p.connect(this.bus.music); s.start(t); };
    const tick = () => {
      if (!this.ctx) return;
      while (next < c.currentTime + 0.3) {
        const bar = Math.floor(step / 8) % 4, chord = prog[bar], b = step % 8;
        play(chord[b % 4], next, b === 0 ? 0.32 : 0.18, (b % 2 ? 0.3 : -0.3));
        if (step % 2 === 0 && Math.floor(step / 32) % 2 === 1) { const m = mel[(step / 2) % 16]; if (m) play(m, next, 0.22, 0.1); }
        step++; next += dt;
      }
      setTimeout(tick, 100);
    };
    tick();
  }
}
export const audio = new Audio();
