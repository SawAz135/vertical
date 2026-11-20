/* =====================================================================
   Roblox Forge · Jouer — Roblox Sound objects that really play.
   Sound:Play / Stop / Pause / Resume, SoundService:PlayLocalSound, with
   Volume, PlaybackSpeed, Looped, TimePosition, TimeLength, IsLoaded,
   IsPlaying, PlayOnRemove, SoundGroup volume, and the Played / Paused /
   Resumed / Stopped / Ended / DidLoop / Loaded events. The audio file comes
   through the asset relay (decoded once, shared by every Sound with that
   id). A Sound inside a part fades with the distance to the camera
   (RollOffMinDistance / RollOffMaxDistance). Without Web Audio (tests) the
   objects keep working silently.
   ===================================================================== */
import { assetId, fetchAsset } from '../assets.js?v=9';
import { isA } from './roblox.js?v=9';

const fn = (f) => f;
let ctx = null; const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
function audio() { if (!ctx && AC) { ctx = new AC(); const unlock = () => { if (ctx.state !== 'running') ctx.resume().catch(() => {}); }; for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { passive: true }); } return ctx; }
const buffers = new Map();
function bufferOf(id) {
  if (buffers.has(id)) return buffers.get(id);
  const p = fetchAsset(id).then((b) => { const c = audio(); if (!b || !c) return null; return new Promise((res) => c.decodeAudioData(b.slice().buffer, res, () => res(null))); }).catch(() => null);
  buffers.set(id, p); return p;
}
export class SoundSystem {
  constructor(rt, engine) { this.rt = rt; this.E = engine; this.live = new Set(); this.install(); }
  fire(s, ev, args = []) { const sig = s.sigs.get(ev); if (!sig || (!sig.conns.length && !sig.waiters?.length)) return; const I = this.E.I, prev = I.side; I.side = 'client'; try { sig.fire(args); } finally { I.side = prev; } }
  st(s) { return (s.snd ||= { src: null, gain: null, startAt: 0, offset: 0, buf: null, id: null }); }
  load(s) { const id = assetId(s.props.get('SoundId')); const st = this.st(s); if (!id) return Promise.resolve(null); if (st.id === id && st.bufP) return st.bufP;
    st.id = id; st.bufP = bufferOf(id).then((buf) => { if (st.id !== id) return null; st.buf = buf; if (buf) { s.props.set('TimeLength', buf.duration); s.props.set('IsLoaded', true); this.fire(s, 'Loaded', [s.props.get('SoundId')]); } return buf; }); return st.bufP; }
  volumeOf(s) { let v = s.props.get('Volume') ?? 0.5; const g = s.props.get('SoundGroup'); if (g && g.props) v *= g.props.get('Volume') ?? 1; return Math.max(0, Math.min(10, v)); }
  play(s, fromStart = true) {
    const st = this.st(s); if (fromStart) st.offset = s.props.get('TimePosition') || 0; this.stopNode(s); s.props.set('IsPlaying', true); s.props.set('Playing', true); s.props.set('IsPaused', false); this.live.add(s);
    this.fire(s, fromStart ? 'Played' : 'Resumed', [s.props.get('SoundId')]);
    this.load(s).then((buf) => { const c = audio(); if (!buf || !c || !s.props.get('IsPlaying') || st.src) return;
      const src = c.createBufferSource(); src.buffer = buf; src.loop = !!s.props.get('Looped'); src.playbackRate.value = s.props.get('PlaybackSpeed') ?? 1; const gain = c.createGain(); gain.gain.value = this.volumeOf(s) * this.fall(s); src.connect(gain).connect(c.destination);
      const off = Math.min(st.offset, Math.max(0, buf.duration - 0.01)); src.start(0, off); st.src = src; st.gain = gain; st.startAt = c.currentTime - off / (src.playbackRate.value || 1);
      src.onended = () => { if (st.src !== src) return; st.src = null; if (!src.loop) { s.props.set('IsPlaying', false); s.props.set('Playing', false); s.props.set('TimePosition', 0); st.offset = 0; this.live.delete(s); this.fire(s, 'Ended', [s.props.get('SoundId')]); } }; });
  }
  stopNode(s) { const st = this.st(s); if (st.src) { const src = st.src; st.src = null; try { src.onended = null; src.stop(); } catch { /* already stopped */ } } }
  pos(s) { const c = audio(); const st = this.st(s); if (!st.src || !c) return st.offset; const d = (c.currentTime - st.startAt) * (st.src.playbackRate.value || 1), L = st.buf ? st.buf.duration : 0; return L > 0 && st.src.loop ? d % L : d; }
  stop(s) { this.stopNode(s); const st = this.st(s); st.offset = 0; s.props.set('IsPlaying', false); s.props.set('Playing', false); s.props.set('TimePosition', 0); this.live.delete(s); this.fire(s, 'Stopped', [s.props.get('SoundId')]); }
  pause(s) { const st = this.st(s); st.offset = this.pos(s); this.stopNode(s); s.props.set('IsPlaying', false); s.props.set('Playing', false); s.props.set('IsPaused', true); s.props.set('TimePosition', st.offset); this.live.delete(s); this.fire(s, 'Paused', [s.props.get('SoundId')]); }
  /* distance roll-off for sounds inside a part (inverse, like Roblox's default) */
  fall(s) { const p = s.parent; if (!p || !p.props || !isA(p.cls, 'BasePart') && p.cls !== 'Attachment') return 1; const cam = this.E.workspace.props.get('CurrentCamera'), cf = cam && cam.props.get('CFrame'); const part = p.cls === 'Attachment' ? p.parent : p; const pc = part && part.props && part.props.get('CFrame'); if (!cf || !pc) return 1;
    const d = Math.hypot(cf.p[0] - pc.p[0], cf.p[1] - pc.p[1], cf.p[2] - pc.p[2]), mn = s.props.get('RollOffMinDistance') ?? s.props.get('EmitterSize') ?? 10, mx = s.props.get('RollOffMaxDistance') ?? s.props.get('MaxDistance') ?? 10000; if (d >= mx) return 0; return d <= mn ? 1 : mn / d; }
  /* per frame: follow Volume / PlaybackSpeed / Looped / Playing changes, the distance, and the TimePosition clock */
  step() {
    for (const s of this.live) { const st = this.st(s); if (!s.parent && !s.props.get('PlayOnRemove')) { this.stopNode(s); this.live.delete(s); continue; }
      if (st.src) { st.gain.gain.value = this.volumeOf(s) * this.fall(s); const sp = s.props.get('PlaybackSpeed') ?? 1; if (st.src.playbackRate.value !== sp) st.src.playbackRate.value = sp; st.src.loop = !!s.props.get('Looped'); const t = this.pos(s); if (st.lastT != null && t < st.lastT - 0.05 && st.src.loop) this.fire(s, 'DidLoop', [s.props.get('SoundId'), 1]); st.lastT = t; s.props.set('TimePosition', t); } }
  }
  install() {
    const rt = this.rt, self = this, CM = rt.classMethods;
    CM.Sound = { Play: fn((a) => { self.play(a[0], true); return []; }), Stop: fn((a) => { self.stop(a[0]); return []; }), Pause: fn((a) => { self.pause(a[0]); return []; }), Resume: fn((a) => { self.play(a[0], false); return []; }) };
    CM.SoundService = { ...(CM.SoundService || {}), PlayLocalSound: fn((a) => { if (a[1]) self.play(a[1], true); return []; }), SetListener: fn(() => []) };
    // properties scripts set directly: Playing = true starts it, SoundId changes reload it, TimePosition seeks
    const prev = rt.onChange; rt.onChange = (o, k) => { prev?.(o, k); if (o.cls !== 'Sound') return;
      if (k === 'Playing') { const on = !!o.props.get('Playing'); if (on && !self.st(o).src && !o.props.get('IsPlaying')) self.play(o, true); else if (!on && o.props.get('IsPlaying')) self.pause(o); }
      else if (k === 'SoundId') { self.stopNode(o); o.props.set('IsLoaded', false); if (o.props.get('IsPlaying')) self.play(o, true); else self.load(o); }
      else if (k === 'TimePosition' && self.st(o).src && Math.abs(self.pos(o) - (o.props.get('TimePosition') || 0)) > 0.1) { self.st(o).offset = o.props.get('TimePosition') || 0; self.stopNode(o); self.play(o, false); } };
  }
  /* Sounds that start by themselves: Playing / IsPlaying saved in the place, or Playing set before the world started */
  autoplay(root) { for (const d of root.descendants()) if (d.cls === 'Sound' && (d.props.get('Playing') || d.props.get('IsPlaying'))) { d.props.set('IsPlaying', false); this.play(d, true); } }
}
