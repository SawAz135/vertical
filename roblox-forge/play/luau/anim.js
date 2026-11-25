/* =====================================================================
   Roblox Forge · Jouer — Roblox animations (Animator / AnimationTrack).
   - an Animation's AnimationId is loaded like Roblox does: the
     KeyframeSequence asset (through the asset relay, cached), a
     KeyframeSequence registered with KeyframeSequenceProvider, or one
     that sits in the place;
   - LoadAnimation returns a real AnimationTrack: Play(fade, weight, speed),
     Stop(fade), AdjustSpeed, AdjustWeight, Looped, Priority, Speed,
     TimePosition, Length, IsPlaying, WeightCurrent / WeightTarget,
     KeyframeReached, GetMarkerReachedSignal, DidLoop, Stopped, Ended,
     GetTimeOfKeyframe;
   - every frame (between PreAnimation and PreSimulation, as in Roblox) the
     Animator samples each playing track (pose easing styles included),
     blends them by priority and weight, and writes Motor6D.Transform.
   ===================================================================== */
import { Instance, CFrame, Signal, enumItem, EnumItem } from './roblox.js?v=11';
import { LuaTable } from './luau.js?v=11';
import { readBinary, readXml } from '../rbxl.js?v=11';
import { assetId, fetchAsset } from '../assets.js?v=11';

const fn = (f) => f;
const dec = new TextDecoder();
const S = (v) => (v instanceof Uint8Array ? dec.decode(v) : v == null ? '' : String(v));
/* ---------- quaternion helpers (rotation part of a CFrame) ---------- */
export function rotToQuat(m) {
  const t = m[0] + m[4] + m[8]; let x, y, z, w;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = 0.25 * s; x = (m[7] - m[5]) / s; y = (m[2] - m[6]) / s; z = (m[3] - m[1]) / s; }
  else if (m[0] > m[4] && m[0] > m[8]) { const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; w = (m[7] - m[5]) / s; x = 0.25 * s; y = (m[1] + m[3]) / s; z = (m[2] + m[6]) / s; }
  else if (m[4] > m[8]) { const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; w = (m[2] - m[6]) / s; x = (m[1] + m[3]) / s; y = 0.25 * s; z = (m[5] + m[7]) / s; }
  else { const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; w = (m[3] - m[1]) / s; x = (m[2] + m[6]) / s; y = (m[5] + m[7]) / s; z = 0.25 * s; }
  const l = Math.hypot(x, y, z, w) || 1; return [x / l, y / l, z / l, w / l];
}
export function quatToRot([x, y, z, w]) {
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
}
function slerp(a, b, t, out = [0, 0, 0, 1]) {
  let bx = b[0], by = b[1], bz = b[2], bw = b[3]; let d = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw; if (d < 0) { d = -d; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let k0, k1; if (d > 0.9995) { k0 = 1 - t; k1 = t; } else { const th = Math.acos(d), s = Math.sin(th); k0 = Math.sin((1 - t) * th) / s; k1 = Math.sin(t * th) / s; }
  out[0] = a[0] * k0 + bx * k1; out[1] = a[1] * k0 + by * k1; out[2] = a[2] * k0 + bz * k1; out[3] = a[3] * k0 + bw * k1; const l = Math.hypot(...out) || 1; for (let i = 0; i < 4; i++) out[i] /= l; return out;
}
/* ---------- pose easing (Enum.PoseEasingStyle / PoseEasingDirection) ---------- */
const STYLE = ['Linear', 'Constant', 'Elastic', 'Cubic', 'Bounce', 'CubicV2'], DIR = ['In', 'Out', 'InOut'];
const bounce = (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; };
const IN = { Cubic: (t) => t * t * t, Elastic: (t) => (t === 0 || t === 1 ? t : -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3))), Bounce: (t) => 1 - bounce(1 - t) };
function poseEase(style, dir, t) {
  if (style === 'Linear') return t; if (style === 'Constant') return 0;
  // Roblox's legacy pose styles have In and Out swapped compared to TweenService; CubicV2 fixed it
  let d = dir; if (style !== 'CubicV2') d = dir === 'In' ? 'Out' : dir === 'Out' ? 'In' : dir; const f = IN[style === 'CubicV2' ? 'Cubic' : style] || ((x) => x);
  if (d === 'In') return f(t); if (d === 'Out') return 1 - f(1 - t); return t < 0.5 ? f(t * 2) / 2 : 1 - f((1 - t) * 2) / 2;
}
const enumName = (v, list) => (v instanceof EnumItem ? v.name : typeof v === 'number' ? list[v] : typeof v === 'string' ? v : undefined);
/* ---------- KeyframeSequence → clip ---------- */
const PRIORITY = { Core: 1000, Idle: 0, Movement: 1, Action: 2, Action2: 3, Action3: 4, Action4: 5 };
const RANK = (p) => (p === 1000 ? -1 : p);
const prop = (n, k) => (n.props instanceof Map ? n.props.get(k) : n.props[k]);
const kidsOf = (n) => n.kids || n.children || [];
const clsOf = (n) => n.cls;
function cfOf(v) { if (!v) return { p: [0, 0, 0], q: [0, 0, 0, 1] }; if (v instanceof CFrame) return { p: v.p.slice(), q: rotToQuat(v.r) }; if (v.pos) return { p: v.pos.slice(), q: rotToQuat(v.rot) }; return { p: [0, 0, 0], q: [0, 0, 0, 1] }; }
export function clipFrom(kfs) {
  const joints = new Map(), markers = [], names = []; let length = 0;
  for (const kf of kidsOf(kfs)) {
    if (clsOf(kf) !== 'Keyframe') continue; const t = +prop(kf, 'Time') || 0; length = Math.max(length, t); const kn = S(prop(kf, 'Name'));
    if (kn && kn !== 'Keyframe') names.push({ t, name: kn });
    const walk = (pose, parentName) => {
      for (const c of kidsOf(pose)) {
        const cc = clsOf(c);
        if (cc === 'KeyframeMarker') { markers.push({ t, name: S(prop(c, 'Name')), value: S(prop(c, 'Value')) }); continue; }
        if (cc !== 'Pose') continue; const name = S(prop(c, 'Name')); const w = prop(c, 'Weight'); const style = enumName(prop(c, 'EasingStyle'), STYLE) || 'Linear', dir = enumName(prop(c, 'EasingDirection'), DIR) || 'In';
        if (parentName && (w === undefined || w > 0)) { let j = joints.get(name); if (!j) joints.set(name, (j = { parent: parentName, keys: [] })); const cf = cfOf(prop(c, 'CFrame')); j.keys.push({ t, p: cf.p, q: cf.q, style, dir }); }
        walk(c, name);
      }
    };
    walk(kf, null);
    for (const c of kidsOf(kf)) if (clsOf(c) === 'KeyframeMarker') markers.push({ t, name: S(prop(c, 'Name')), value: S(prop(c, 'Value')) });
  }
  for (const j of joints.values()) j.keys.sort((a, b) => a.t - b.t);
  const pr = prop(kfs, 'Priority'); const priority = pr instanceof EnumItem ? pr.value : typeof pr === 'number' ? pr : 1000;
  return { length, loop: !!prop(kfs, 'Loop'), priority, joints, markers: markers.sort((a, b) => a.t - b.t), names: names.sort((a, b) => a.t - b.t) };
}
function sampleJoint(j, t, outP, outQ) {
  const k = j.keys; if (!k.length) return false; let i = 0, lo = 0, hi = k.length - 1;
  if (t <= k[0].t) { i = -1; } else if (t >= k[hi].t) { i = hi; } else { while (lo < hi - 1) { const m = (lo + hi) >> 1; if (k[m].t <= t) lo = m; else hi = m; } i = lo; }
  if (i < 0 || i >= k.length - 1) { const a = k[Math.max(0, i)]; outP[0] = a.p[0]; outP[1] = a.p[1]; outP[2] = a.p[2]; outQ[0] = a.q[0]; outQ[1] = a.q[1]; outQ[2] = a.q[2]; outQ[3] = a.q[3]; return true; }
  const a = k[i], b = k[i + 1], u = poseEase(a.style, a.dir, (t - a.t) / Math.max(1e-6, b.t - a.t));
  for (let x = 0; x < 3; x++) outP[x] = a.p[x] + (b.p[x] - a.p[x]) * u; slerp(a.q, b.q, u, outQ); return true;
}
/* ---------- loading clips ---------- */
const clips = new Map(); // asset id / provider id → Promise<clip|null>
export function parseAnimationAsset(bytes) {
  if (!bytes || bytes.length < 8) return null; const head = dec.decode(bytes.subarray(0, 8));
  let roots; try { roots = head === '<roblox!' ? readBinary(bytes) : /<roblox/.test(dec.decode(bytes.subarray(0, 200))) ? readXml(dec.decode(bytes)) : null; } catch (e) { console.warn('animation', e); return null; }
  if (!roots) return null; const find = (n) => { if (clsOf(n) === 'KeyframeSequence') return n; for (const c of kidsOf(n)) { const f = find(c); if (f) return f; } return null; };
  for (const r of roots) { const k = find(r); if (k) return clipFrom(k); } return null;
}
function loadClip(rt, animation) {
  const raw = S(animation && animation.props.get('AnimationId')); if (!raw) return Promise.resolve(null);
  const reg = rt.kfsRegistry && rt.kfsRegistry.get(raw); if (reg) return Promise.resolve(clipFrom(reg));
  const id = assetId(raw); if (!id) return Promise.resolve(null);
  if (!clips.has(id)) clips.set(id, fetchAsset(id).then(parseAnimationAsset).catch(() => null)); return clips.get(id);
}
export function preloadClip(id) { id = assetId(id); if (!id) return Promise.resolve(null); if (!clips.has(id)) clips.set(id, fetchAsset(id).then(parseAnimationAsset).catch(() => null)); return clips.get(id); }
/* ---------- Animator ---------- */
export class AnimSystem {
  constructor(rt, engine) { this.rt = rt; this.E = engine; this.animators = new Set(); this.install(); }
  /* the Animator under a Humanoid / AnimationController (created like Roblox does) */
  animatorOf(host) { if (host.cls === 'Animator') return host; let a = host.kids.find((k) => k.cls === 'Animator'); if (!a) { a = new Instance('Animator', this.rt); a.props.set('Name', 'Animator'); a.setParent(host); } return a; }
  state(an) { if (!an.anim) { an.anim = { tracks: new Set(), touched: new Set() }; this.animators.add(an); } return an.anim; }
  load(host, animation) {
    const rt = this.rt, an = this.animatorOf(host), st = this.state(an); if (!animation || !(animation instanceof Instance)) throw new Error('LoadAnimation requires an Animation object');
    const t = new Instance('AnimationTrack', rt); t.props.set('Name', S(animation.props.get('Name')) || 'AnimationTrack'); t.props.set('Animation', animation);
    for (const [k, v] of [['IsPlaying', false], ['Length', 0], ['Speed', 1], ['TimePosition', 0], ['WeightCurrent', 0], ['WeightTarget', 1], ['Looped', false], ['Priority', enumItem('AnimationPriority', 'Core')]]) t.props.set(k, v);
    const tr = (t.track = { an, clip: null, playing: false, fade: 0.1, side: this.E.I.side, loopSet: false, prioSet: false });
    t.$newindexOrig = t.$newindex; t.$newindex = (k, v) => { if (k === 'Looped') tr.loopSet = true; if (k === 'Priority') tr.prioSet = true; t.$newindexOrig(k, v); };
    loadClip(rt, animation).then((clip) => { if (!clip) return; tr.clip = clip; t.props.set('Length', clip.length); if (!tr.loopSet) t.props.set('Looped', clip.loop); if (!tr.prioSet) t.props.set('Priority', enumItem('AnimationPriority', Object.keys(PRIORITY).find((k) => PRIORITY[k] === clip.priority) || 'Core')); });
    st.tracks.add(t); return t;
  }
  play(t, fade = 0.1, weight = 1, speed) {
    const tr = t.track; tr.fade = Math.max(0, fade ?? 0.1); t.props.set('WeightTarget', weight ?? 1); if (speed !== undefined) t.props.set('Speed', speed);
    if (!tr.playing) { tr.playing = true; t.props.set('TimePosition', t.props.get('Speed') < 0 ? t.props.get('Length') : 0); tr.lastT = null; t.props.set('IsPlaying', true); if (tr.fade === 0) t.props.set('WeightCurrent', weight ?? 1); }
    tr.stopping = false; this.state(tr.an).tracks.add(t);
  }
  stop(t, fade = 0.1) { const tr = t.track; if (!tr.playing) return; tr.fade = Math.max(0, fade ?? 0.1); tr.stopping = true; tr.fromW = t.props.get('WeightCurrent'); t.props.set('WeightTarget', 0); t.props.set('IsPlaying', false); this.fire(t, 'Stopped', []); if (tr.fade === 0) this.end(t); }
  end(t) { const tr = t.track; tr.playing = false; tr.stopping = false; t.props.set('WeightCurrent', 0); this.fire(t, 'Ended', []); }
  fire(t, ev, args) { const s = t.sigs.get(ev); if (!s || !s.conns.length && !s.waiters?.length) return; const I = this.E.I, prev = I.side; I.side = t.track.side || 'client'; try { s.fire(args); } finally { I.side = prev; } }
  /* ---- per frame ---- */
  step(dt) {
    const P = [0, 0, 0], Q = [0, 0, 0, 1];
    for (const an of this.animators) {
      const st = an.anim, rig = an.parent && an.parent.parent; if (!rig || !an.parent) { this.animators.delete(an); continue; }
      const live = [];
      for (const t of st.tracks) {
        const tr = t.track; if (!tr.playing) { st.tracks.delete(t); continue; }
        // weight fade
        const w = t.props.get('WeightCurrent'), wt = t.props.get('WeightTarget'); if (w !== wt) { const step = tr.fade > 0 ? dt / tr.fade : 1; const nw = w < wt ? Math.min(wt, w + step * Math.max(wt, 0.01)) : Math.max(wt, w - step * Math.max(tr.fromW ?? 1, 0.01)); t.props.set('WeightCurrent', nw); }
        if (tr.stopping && t.props.get('WeightCurrent') <= 1e-4) { this.end(t); st.tracks.delete(t); continue; }
        const clip = tr.clip; if (!clip) continue;
        // time
        const len = clip.length, sp = t.props.get('Speed') ?? 1; let time = t.props.get('TimePosition') || 0; const prevT = tr.lastT == null ? time - 1e-6 : tr.lastT; time += dt * sp; let looped = false;
        if (len > 0) { if (time >= len || time < 0) { if (t.props.get('Looped')) { time = ((time % len) + len) % len; looped = true; } else { time = Math.max(0, Math.min(len, time)); if (!tr.stopping) { t.props.set('TimePosition', time); this.stop(t, 0.05); } } } }
        else time = 0;
        t.props.set('TimePosition', time); tr.lastT = time;
        // keyframe and marker events between the previous and the current time
        if (clip.names.length || clip.markers.length) { const crossed = (x) => (looped ? x > prevT || x <= time : x > prevT && x <= time);
          for (const k of clip.names) if (crossed(k.t)) this.fire(t, 'KeyframeReached', [k.name]);
          for (const m of clip.markers) if (crossed(m.t)) { const s = t.sigs.get('Marker:' + m.name); if (s) { const I = this.E.I, prev = I.side; I.side = tr.side || 'client'; try { s.fire([m.value]); } finally { I.side = prev; } } } }
        if (looped) this.fire(t, 'DidLoop', []);
        live.push(t);
      }
      // blend per joint: priorities low → high, tracks of one priority averaged by weight
      const motors = this.motors(rig, st); const touched = new Set();
      if (live.length) {
        live.sort((a, b) => RANK(a.props.get('Priority')?.value ?? 1000) - RANK(b.props.get('Priority')?.value ?? 1000));
        for (const [name, m] of motors) {
          let rp = [0, 0, 0], rq = [0, 0, 0, 1], any = false;
          for (let i = 0; i < live.length;) {
            const pr = RANK(live[i].props.get('Priority')?.value ?? 1000); let gw = 0; const gp = [0, 0, 0]; let gq = null;
            for (; i < live.length && RANK(live[i].props.get('Priority')?.value ?? 1000) === pr; i++) {
              const t = live[i], j = t.track.clip.joints.get(name); if (!j) continue; const w = t.props.get('WeightCurrent'); if (w <= 1e-4) continue;
              sampleJoint(j, t.props.get('TimePosition'), P, Q); const nw = gw + w;
              gp[0] = (gp[0] * gw + P[0] * w) / nw; gp[1] = (gp[1] * gw + P[1] * w) / nw; gp[2] = (gp[2] * gw + P[2] * w) / nw; gq = gq ? slerp(gq, Q, w / nw) : Q.slice(); gw = nw;
            }
            if (gw > 0) { const k = Math.min(1, gw); rp = [rp[0] + (gp[0] - rp[0]) * k, rp[1] + (gp[1] - rp[1]) * k, rp[2] + (gp[2] - rp[2]) * k]; rq = slerp(rq, gq, k); any = true; }
          }
          if (any) { m.props.set('Transform', new CFrame(rp, quatToRot(rq))); touched.add(m); }
        }
      }
      // joints no track drives any more go back to rest
      for (const m of st.touched) if (!touched.has(m)) m.props.set('Transform', new CFrame());
      st.touched = touched;
    }
  }
  /* Motor6Ds of a rig by the name of the part they move (what a Pose is named after) */
  motors(rig, st) {
    if (st.motorMap && st.motorRig === rig && st.motorN === this.E.frameN >> 6) return st.motorMap;
    const map = new Map(); for (const d of rig.descendants()) if (d.cls === 'Motor6D' || d.cls === 'Motor') { const p1 = d.props.get('Part1'); if (p1) map.set(S(p1.props.get('Name')), d); }
    st.motorMap = map; st.motorRig = rig; st.motorN = this.E.frameN >> 6; return map;
  }
  playing(an) { return [...(an.anim ? an.anim.tracks : [])].filter((t) => t.track.playing); }
  install() {
    const rt = this.rt, CM = rt.classMethods, self = this;
    const load = fn((a) => [self.load(a[0], a[1])]);
    const list = fn((a) => { const an = a[0].cls === 'Animator' ? a[0] : a[0].kids.find((k) => k.cls === 'Animator'); return [LuaTable.from(an ? self.playing(an) : [])]; });
    CM.Animator = { ...(CM.Animator || {}), LoadAnimation: load, GetPlayingAnimationTracks: list, StepAnimations: fn(() => []), ApplyJointVelocities: fn(() => []) };
    CM.Humanoid = { ...(CM.Humanoid || {}), LoadAnimation: load, GetPlayingAnimationTracks: list };
    CM.AnimationController = { ...(CM.AnimationController || {}), LoadAnimation: load, GetPlayingAnimationTracks: list };
    CM.AnimationTrack = {
      Play: fn((a) => { self.play(a[0], a[1], a[2], a[3]); return []; }), Stop: fn((a) => { self.stop(a[0], a[1]); return []; }),
      AdjustSpeed: fn((a) => { a[0].props.set('Speed', a[1] ?? 1); return []; }), AdjustWeight: fn((a) => { a[0].track.fromW = a[0].props.get('WeightCurrent'); a[0].props.set('WeightTarget', a[1] ?? 1); if (a[2] !== undefined) a[0].track.fade = a[2]; return []; }),
      GetMarkerReachedSignal: fn((a) => [a[0].sig('Marker:' + S(a[1]))]),
      GetTimeOfKeyframe: fn((a) => { const c = a[0].track.clip, k = c && c.names.find((x) => x.name === S(a[1])); if (!k) throw new Error('Keyframe "' + S(a[1]) + '" not found'); return [k.t]; }),
      Destroy: fn((a) => { self.stop(a[0], 0); return []; }),
    };
    rt.kfsRegistry = new Map(); let n = 0;
    CM.KeyframeSequenceProvider = {
      RegisterKeyframeSequence: fn((a) => { const id = `rbxassetid://9${String(++n).padStart(9, '0')}`; rt.kfsRegistry.set(id, a[1]); return [id]; }),
      RegisterActiveKeyframeSequence: fn((a) => { const id = `active://${++n}`; rt.kfsRegistry.set(id, a[1]); return [id]; }),
      GetKeyframeSequenceAsync: fn(() => [new Instance('KeyframeSequence', rt)]), GetAnimations: fn(() => [undefined]),
    };
    void Signal;
  }
}
