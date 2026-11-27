// LOOPLAB — analysis of the user's own track: drop detection, tempo, beats, onsets,
// pitch of melodic hits and a per-frame spectrum. Everything runs locally.
import { NB, finishSpectrum } from './music.js';
import { clamp } from './util.js';

const FPS = 60;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

export async function decodeFile(ctx, file) {
  const ab = await file.arrayBuffer();
  return await new Promise((res, rej) => {
    const p = ctx.decodeAudioData(ab, res, rej);
    if (p && p.then) p.then(res, rej);
  });
}

function mono(buf) {
  const n = buf.length, out = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i] / buf.numberOfChannels;
  }
  return out;
}

/** Finds the strongest "drop" (sudden rise of bass + loudness after a quieter section). */
function findDrop(x, sr) {
  const hop = Math.floor(sr / 20);
  const n = Math.floor(x.length / hop);
  const lo = new Float32Array(n), full = new Float32Array(n);
  let lp = 0;
  const a = Math.exp((-2 * Math.PI * 150) / sr);
  for (let f = 0; f < n; f++) {
    let sl = 0, sf = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) {
      lp = a * lp + (1 - a) * x[i];
      sl += lp * lp; sf += x[i] * x[i];
    }
    lo[f] = Math.sqrt(sl / hop); full[f] = Math.sqrt(sf / hop);
  }
  const mean = (arr, a0, a1) => { let s = 0; a0 = Math.max(0, a0); a1 = Math.min(arr.length, a1); for (let i = a0; i < a1; i++) s += arr[i]; return s / Math.max(1, a1 - a0); };
  let best = -1, bestT = Math.min(n / 20 / 2, 10);
  const scores = [];
  for (let f = 4 * 20; f < n - 3 * 20; f += 2) {
    const s = (mean(lo, f, f + 40) - mean(lo, f - 60, f)) * 2 + (mean(full, f, f + 40) - mean(full, f - 60, f));
    scores.push([f, s]);
    if (s > best) { best = s; bestT = f / 20; }
  }
  // prefer the first drop that is nearly as strong as the strongest
  for (const [f, s] of scores) if (s >= best * 0.82) { bestT = f / 20; break; }
  // refine on the strongest bass onset within ±0.5 s
  let rf = Math.round(bestT * 20), rmax = -1;
  for (let f = rf - 10; f <= rf + 10; f++) {
    if (f < 1 || f >= n) continue;
    const d = lo[f] - lo[f - 1];
    if (d > rmax) { rmax = d; rf = f; }
  }
  return { dropT: rf / 20, length: x.length / sr };
}

/**
 * @returns song-like object used by the engine (same shape as composeSong()).
 */
export function analyzeTrack(buffer, dur, dropFrac = 0.5) {
  const sr = buffer.sampleRate;
  const x = mono(buffer);
  const { dropT: dropTrack, length } = findDrop(x, sr);
  let wantDrop = dur * dropFrac;
  let offset = dropTrack - wantDrop;
  if (offset < 0) { offset = 0; wantDrop = dropTrack; }
  if (offset + dur > length) offset = Math.max(0, length - dur);
  const dropT = clamp(dropTrack - offset, 1, dur - 0.5);

  // ---- spectrum over the used window ----
  const N = 2048, nF = Math.ceil((dur + 1) * FPS);
  const spec = new Float32Array(nF * NB);
  const flux = new Float32Array(nF), lowFlux = new Float32Array(nF);
  const re = new Float32Array(N), im = new Float32Array(N);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const bandLo = new Int32Array(NB), bandHi = new Int32Array(NB);
  for (let k = 0; k < NB; k++) {
    const f0 = 30 * Math.pow(14000 / 30, k / NB), f1 = 30 * Math.pow(14000 / 30, (k + 1) / NB);
    bandLo[k] = Math.max(1, Math.floor((f0 * N) / sr));
    bandHi[k] = Math.max(bandLo[k] + 1, Math.ceil((f1 * N) / sr));
  }
  const prev = new Float32Array(NB);
  const chromaAt = [];
  const mag = new Float32Array(N / 2);
  for (let f = 0; f < nF; f++) {
    const c = Math.floor((offset + f / FPS) * sr);
    for (let i = 0; i < N; i++) { const s = x[c - N / 2 + i] || 0; re[i] = s * win[i]; im[i] = 0; }
    fft(re, im);
    for (let i = 0; i < N / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
    let fl = 0, lf = 0;
    for (let k = 0; k < NB; k++) {
      let m = 0;
      for (let i = bandLo[k]; i < bandHi[k] && i < N / 2; i++) m = Math.max(m, mag[i]);
      const v = Math.log1p(m * 0.6) / 4;
      spec[f * NB + k] = v;
      const d = v - prev[k];
      if (d > 0) { fl += d; if (k < 6) lf += d; }
      prev[k] = v;
    }
    flux[f] = fl; lowFlux[f] = lf;
    if (f % 2 === 0) {
      // dominant pitch in 110..1800 Hz
      let bi = 0, bm = 0;
      const i0 = Math.floor((110 * N) / sr), i1 = Math.floor((1800 * N) / sr);
      for (let i = i0; i < i1; i++) if (mag[i] > bm) { bm = mag[i]; bi = i; }
      chromaAt[f >> 1] = bm > 0 ? Math.round(69 + 12 * Math.log2((bi * sr) / N / 440)) : -1;
    }
  }
  // normalise each band so visualizers use the full range
  for (let k = 0; k < NB; k++) {
    let mx = 1e-6;
    for (let f = 0; f < nF; f++) mx = Math.max(mx, spec[f * NB + k]);
    for (let f = 0; f < nF; f++) spec[f * NB + k] = Math.pow(spec[f * NB + k] / mx, 1.6);
  }
  // ---- onsets (adaptive threshold peak picking) ----
  const pick = (arr, k = 1.4, minGap = 0.09) => {
    const out = [];
    let last = -1;
    for (let f = 2; f < nF - 2; f++) {
      let m = 0;
      for (let j = Math.max(0, f - 15); j < Math.min(nF, f + 15); j++) m += arr[j];
      m /= 30;
      if (arr[f] > m * k && arr[f] >= arr[f - 1] && arr[f] >= arr[f + 1] && arr[f] > 0.02) {
        const t = f / FPS;
        if (t - last >= minGap) { out.push(t); last = t; }
      }
    }
    return out;
  };
  const onsets = pick(flux, 1.5, 0.1);
  const kicks = pick(lowFlux, 1.6, 0.2);
  // ---- tempo by autocorrelation of the flux envelope ----
  let bestLag = 30, bestR = -1;
  for (let lag = Math.round(FPS * 0.33); lag <= Math.round(FPS * 0.75); lag++) {
    let r = 0;
    for (let f = 0; f + lag < nF; f++) r += flux[f] * flux[f + lag];
    if (r > bestR) { bestR = r; bestLag = lag; }
  }
  const spb = bestLag / FPS;
  let bestPh = 0, bestS = -1;
  for (let ph = 0; ph < bestLag; ph++) {
    let s = 0;
    for (let f = ph; f < nF; f += bestLag) s += flux[f];
    if (s > bestS) { bestS = s; bestPh = ph; }
  }
  // align the beat grid to the drop
  const dropF = Math.round(dropT * FPS);
  const phase = ((dropF - bestPh) % bestLag + bestLag) % bestLag < bestLag / 2 ? dropF % bestLag : bestPh;
  const beats = [];
  for (let f = phase; f < nF; f += bestLag) beats.push(f / FPS);
  const downbeats = beats.filter((_, i) => i % 4 === Math.round(dropT / spb) % 4);
  // ---- melodic notes from onsets + pitch ----
  const hist = new Array(12).fill(0);
  const notes = [];
  for (let i = 0; i < onsets.length; i++) {
    const t = onsets[i];
    const m = chromaAt[Math.round(t * FPS) >> 1];
    if (m == null || m < 0) continue;
    hist[((m % 12) + 12) % 12]++;
    const d = Math.min(0.6, (onsets[i + 1] ?? t + 0.4) - t);
    notes.push({ t, d, m: clamp(m, 36, 96), inst: 'lead', v: 0.8 });
  }
  let rootPc = 9, hb = -1;
  hist.forEach((h, i) => { if (h > hb) { hb = h; rootPc = i; } });
  const root = 36 + rootPc;
  const PENTA = [0, 3, 5, 7, 10];
  const song = {
    kind: 'track', buffer, bufOffset: offset, bpm: Math.round(60 / spb), spb, bar: spb * 4, root, dur, dropT,
    beats, downbeats, kicks, onsets, notes, drums: kicks.map((t) => ({ t, n: 'kick', v: 1 })), fx: [], filt: [],
    specTable: spec, nFrames: nF,
    scale: (deg, oct = 0) => root + 24 + 12 * oct + PENTA[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5),
  };
  finishSpectrum(song);
  return song;
}
