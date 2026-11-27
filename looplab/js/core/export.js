// LOOPLAB — video export.
// Fast path: WebCodecs (H.264/VP9/AV1 + AAC/Opus) muxed to MP4, rendered frame by frame
// faster than real time, soundtrack mixed in an OfflineAudioContext from the same events.
// Fallback: MediaRecorder capture in real time (Safari/Firefox without AudioEncoder).
import { Engine } from './engine.js';
import { Synth } from './synth.js';
import { SongPlayer } from './music.js';
import { makeCanvas } from './util.js';

const SR = 48000;

function muxerLib() { return typeof window !== 'undefined' ? window.Mp4Muxer : null; }

export async function probeExport(w = 720, h = 1280, fps = 30) {
  const out = { path: 'recorder', video: null, audio: null, label: '' };
  if (typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && muxerLib()) {
    const bitrate = w * h * fps * 0.14;
    const vids = [
      ['avc', 'avc1.640028', 'H.264'], ['avc', 'avc1.4d0028', 'H.264'], ['avc', 'avc1.42001f', 'H.264'],
      ['vp9', 'vp09.00.40.08', 'VP9'], ['av1', 'av01.0.08M.08', 'AV1'],
    ];
    for (const [mux, codec, name] of vids) {
      try {
        const r = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate, framerate: fps });
        if (r.supported) { out.video = { mux, codec, name, bitrate }; break; }
      } catch (e) { /* try next */ }
    }
    for (const [mux, codec, name] of [['aac', 'mp4a.40.2', 'AAC'], ['opus', 'opus', 'Opus']]) {
      try {
        const r = await AudioEncoder.isConfigSupported({ codec, sampleRate: SR, numberOfChannels: 2, bitrate: 160000 });
        if (r.supported) { out.audio = { mux, codec, name }; break; }
      } catch (e) { /* try next */ }
    }
    if (out.video && out.audio) {
      out.path = 'webcodecs';
      out.label = `MP4 (${out.video.name} + ${out.audio.name})`;
      return out;
    }
  }
  const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  out.mime = typeof MediaRecorder !== 'undefined' ? types.find((t) => MediaRecorder.isTypeSupported(t)) : null;
  out.label = out.mime ? (out.mime.startsWith('video/mp4') ? 'MP4 (enregistrement temps réel)' : 'WebM (enregistrement temps réel)') : 'Export indisponible sur ce navigateur';
  if (!out.mime) out.path = 'none';
  return out;
}

/** Renders the soundtrack (music + every recorded sound event) offline. */
export async function renderAudio(cfg, events) {
  const dur = cfg.dur;
  const len = Math.ceil(dur * SR);
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oac = new OAC(2, len, SR);
  const s = new Synth(oac, oac.destination, cfg.audio || {});
  if (cfg.song.kind !== 'none' || cfg.song.buffer) {
    const p = new SongPlayer(s, cfg.song, cfg.song.buffer || null, cfg.song.bufOffset || 0);
    p.start(0, 0);
    p.scheduleAll();
  }
  for (const ev of events) if (ev.t < dur - 0.02) s.play(ev, ev.t);
  // gentle fade-out so the loop point is clean
  s.master.gain.setValueAtTime(s.master.gain.value, Math.max(0, dur - 0.45));
  s.master.gain.linearRampToValueAtTime(0.0001, dur);
  return await oac.startRendering();
}

/**
 * @param cfg engine config (tpl, opts, seed, dur, theme, …, song, size, fps)
 * @param o { onProgress(stage, k, canvas), signal }
 * @returns { blob, mime, ext, thumb }
 */
export async function exportVideo(cfg, o = {}) {
  const [w, h] = cfg.size;
  const fps = cfg.fps || 30;
  const probe = await probeExport(w, h, fps);
  if (probe.path === 'webcodecs') return exportWebCodecs(cfg, probe, o);
  if (probe.path === 'recorder') return exportRecorder(cfg, probe, o);
  throw new Error("Ce navigateur ne sait pas encoder de vidéo. Essaie Chrome, Edge ou Safari récent.");
}

async function exportWebCodecs(cfg, probe, o) {
  const [w, h] = cfg.size;
  const fps = cfg.fps || 30;
  const M = muxerLib();
  const target = new M.ArrayBufferTarget();
  const muxer = new M.Muxer({
    target,
    video: { codec: probe.video.mux, width: w, height: h, frameRate: fps },
    audio: { codec: probe.audio.mux, numberOfChannels: 2, sampleRate: SR },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  let encErr = null;
  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (encErr = e) });
  venc.configure({ codec: probe.video.codec, width: w, height: h, bitrate: probe.video.bitrate, framerate: fps, latencyMode: 'quality', avc: probe.video.mux === 'avc' ? { format: 'avc' } : undefined });
  const canvas = makeCanvas(w, h);
  const eng = new Engine(canvas, { quality: 'high' });
  eng.configure(cfg);
  const N = Math.round(cfg.dur * fps);
  let thumb = null;
  const t0 = performance.now();
  for (let f = 0; f < N; f++) {
    if (o.signal?.aborted) { try { venc.close(); } catch (e) { /* closed */ } throw new DOMException('Annulé', 'AbortError'); }
    if (encErr) throw encErr;
    if (f > 0) eng.advance(1 / fps);
    eng.render();
    const frame = new VideoFrame(canvas, { timestamp: Math.round((f * 1e6) / fps), duration: Math.round(1e6 / fps) });
    venc.encode(frame, { keyFrame: f % (fps * 2) === 0 });
    frame.close();
    if (f === Math.round(N * 0.42)) thumb = await snapshot(canvas);
    if (venc.encodeQueueSize > 6 || f % 4 === 0) {
      while (venc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 1));
      o.onProgress?.('video', (f + 1) / N, canvas, (performance.now() - t0) / 1000);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  await venc.flush();
  venc.close();
  if (encErr) throw encErr;
  // ---- audio ----
  o.onProgress?.('audio', 0, canvas);
  const abuf = await renderAudio(cfg, eng.S.events);
  o.onProgress?.('audio', 0.5, canvas);
  let aerr = null;
  const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => (aerr = e) });
  aenc.configure({ codec: probe.audio.codec, sampleRate: SR, numberOfChannels: 2, bitrate: 160000 });
  const L = abuf.getChannelData(0), R = abuf.getChannelData(1);
  const CH = 4800;
  for (let i = 0; i < abuf.length; i += CH) {
    const n = Math.min(CH, abuf.length - i);
    const data = new Float32Array(n * 2);
    data.set(L.subarray(i, i + n), 0);
    data.set(R.subarray(i, i + n), n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / SR) * 1e6), data });
    aenc.encode(ad);
    ad.close();
    if (aerr) throw aerr;
  }
  await aenc.flush();
  aenc.close();
  o.onProgress?.('mux', 1, canvas);
  muxer.finalize();
  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  return { blob, mime: 'video/mp4', ext: 'mp4', thumb, codec: probe.label };
}

async function exportRecorder(cfg, probe, o) {
  const [w, h] = cfg.size;
  const fps = cfg.fps || 30;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const eng = new Engine(canvas, { quality: 'high' });
  eng.configure(cfg);
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC({ sampleRate: SR });
  await ctx.resume();
  const dest = ctx.createMediaStreamDestination();
  const synth = new Synth(ctx, dest, cfg.audio || {});
  const player = new SongPlayer(synth, cfg.song, cfg.song.buffer || null, cfg.song.bufOffset || 0);
  eng.onSfx = (ev) => synth.play(ev, ctx.currentTime + 0.02);
  const stream = canvas.captureStream(fps);
  for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
  const rec = new MediaRecorder(stream, { mimeType: probe.mime, videoBitsPerSecond: w * h * fps * 0.16, audioBitsPerSecond: 160000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise((res) => (rec.onstop = res));
  eng.render();
  rec.start(250);
  const t0 = ctx.currentTime + 0.05;
  if (cfg.song.kind !== 'none' || cfg.song.buffer) player.start(t0, 0);
  let thumb = null;
  await new Promise((resolve, reject) => {
    let frames = 0;
    const tick = () => {
      if (o.signal?.aborted) { rec.stop(); reject(new DOMException('Annulé', 'AbortError')); return; }
      const vt = ctx.currentTime - t0;
      while (eng.S.vt + 1 / fps <= vt && eng.S.vt < cfg.dur) { eng.advance(1 / fps); frames++; }
      player.pump(ctx.currentTime);
      eng.render();
      if (!thumb && vt > cfg.dur * 0.42) snapshot(canvas).then((t) => (thumb = t));
      o.onProgress?.('video', Math.min(1, vt / cfg.dur), canvas, vt);
      if (vt >= cfg.dur) { setTimeout(() => rec.stop(), 120); resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await done;
  synth.stopAll();
  ctx.close();
  const mime = probe.mime.split(';')[0];
  return { blob: new Blob(chunks, { type: mime }), mime, ext: mime === 'video/mp4' ? 'mp4' : 'webm', thumb, codec: probe.label };
}

async function snapshot(canvas) {
  const c = makeCanvas(270, 480);
  c.getContext('2d').drawImage(canvas, 0, 0, 270, 480);
  if (c.convertToBlob) return await c.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  return await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
}
