// LOOPLAB — app shell: home, template editor with live preview, export, "Mes vidéos".
import { Engine, W, H, DEFAULT_ENTRIES } from './core/engine.js';
import { THEMES, MATERIALS, GLOWS, EFFECTS } from './core/themes.js';
import { drawBall } from './core/materials.js';
import { composeSong, silentSong, SongPlayer } from './core/music.js';
import { analyzeTrack, decodeFile } from './core/analysis.js';
import { Synth, hitCursorAt } from './core/synth.js';
import { exportVideo, probeExport } from './core/export.js';
import { TEMPLATES, TOP, CATEGORIES } from './templates/index.js';
import * as DB from './core/db.js';

const $ = (s, r = document) => r.querySelector(s);
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const store = {
  get(k, d) { try { const v = localStorage.getItem('looplab:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('looplab:' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
};
const view = $('#view');
const fontsReady = (async () => {
  try { await Promise.all([document.fonts.load('800 40px Unbounded'), document.fonts.load('900 40px Unbounded'), document.fonts.load('700 20px Inter')]); } catch (e) { /* offline */ }
})();
const lowPower = matchMedia('(max-width: 700px)').matches || (navigator.hardwareConcurrency || 8) <= 4;

// ------------------------------------------------------------------------------------
// Settings per template
// ------------------------------------------------------------------------------------
function defaults(tpl) {
  const opts = {};
  for (const o of tpl.options || []) if (o.type !== 'images') opts[o.id] = o.def;
  return {
    theme: 'neon', mat: 'glossy', glow: 'strong', opts,
    entries: DEFAULT_ENTRIES.map((e) => ({ ...e })),
    music: { mode: 'gen', seed: 1 + Math.floor(Math.random() * 9999), play: 'continuous', hold: 0.3, start: 0 },
    text: { mode: 'auto', custom: '', counter: true },
    effects: Object.fromEntries(EFFECTS.map((e) => [e.id, e.def])),
    mix: { music: 1, sfx: 1, hitMode: 'synth' },
    trails: true, dur: 20, res: 720, fps: 30, watermark: false,
    seed: 1 + Math.floor(Math.random() * 99999),
  };
}
function loadSettings(tpl) {
  const d = defaults(tpl);
  const s = store.get('tpl:' + tpl.id, null);
  if (!s) return d;
  return { ...d, ...s, opts: { ...d.opts, ...(s.opts || {}) }, music: { ...d.music, ...(s.music || {}), mode: s.music?.mode === 'track' ? 'gen' : s.music?.mode || 'gen' }, text: { ...d.text, ...(s.text || {}) }, mix: { ...d.mix, ...(s.mix || {}), hitMode: 'synth' }, effects: { ...d.effects, ...(s.effects || {}) }, entries: (s.entries || d.entries).map((e) => ({ ...e, img: null })) };
}
function saveSettings(tpl, st) {
  const { entries, ...rest } = st;
  store.set('tpl:' + tpl.id, { ...rest, entries: entries.map(({ img, imgUrl, ...e }) => e) });
}

// runtime-only assets (photos, tracks) per template
const assets = { images: {}, entryImgs: {}, track: null, hit: null };

function buildSong(tpl, st) {
  const frac = tpl.dropAt || 0.5;
  if (st.music.mode === 'track' && assets.track) {
    const key = `${assets.track.name}|${st.dur}|${frac}`;
    if (assets.track.songKey !== key) { assets.track.song = analyzeTrack(assets.track.buffer, st.dur, frac); assets.track.songKey = key; }
    return assets.track.song;
  }
  if (st.music.mode === 'none') return silentSong(st.dur, frac);
  return composeSong(st.music.seed, st.dur, { dropFrac: frac });
}
function audioOf(st) {
  const mix = st.mix || { music: 1, sfx: 1, hitMode: 'synth' };
  const custom = mix.hitMode !== 'synth' && assets.hit ? assets.hit.buffer : null;
  const hitTrack = st.music.mode === 'track' && st.music.play === 'hits' && assets.track && !st._noHits
    ? { buffer: assets.track.buffer, start: st.music.start || 0, hold: st.music.hold || 0.3 } : null;
  return { music: mix.music, sfx: mix.sfx, custom, customMode: mix.hitMode === 'replace' ? 'replace' : 'mix', hitTrack };
}
const AUDIO_ACCEPT = 'audio/*,video/*,.mp3,.m4a,.mp4,.m4v,.mov,.wav,.aac,.ogg,.oga,.opus,.flac,.webm,.caf,.aif,.aiff,.amr,.3gp';
function engineCfg(tpl, st, size) {
  return {
    tpl, opts: st.opts, seed: st.seed, dur: st.dur, theme: st.theme, mat: st.mat, glow: st.glow,
    effects: st.effects, trails: st.trails, text: st.text, song: buildSong(tpl, st), size,
    entries: st.entries.map((e) => ({ ...e, img: assets.entryImgs[e._id] || null })),
    images: assets.images, watermark: st.watermark, fps: st.fps, audio: audioOf({ ...st, _noHits: !!tpl.noHits }),
    customEntries: true,
  };
}

// ------------------------------------------------------------------------------------
// Live preview with sound
// ------------------------------------------------------------------------------------
let audioCtx = null;
function getCtx() {
  if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; audioCtx = new AC({ latencyHint: 'interactive' }); }
  return audioCtx;
}

class Preview {
  constructor(canvas, onTime) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, { live: true, quality: lowPower ? 'mid' : 'high' });
    this.onTime = onTime;
    this.playing = false; this.muted = store.get('muted', false);
    this.raf = 0; this.synth = null; this.player = null;
    this.res = 720; this.slow = 0;
    this.engine.onSfx = (ev) => { if (this.playing && this.synth && !this.muted) this.synth.play(ev, getCtx().currentTime + 0.01); };
  }
  load(cfg, keepTime = false) {
    const t = keepTime && this.engine.S ? this.engine.S.vt : 0;
    this.cfg = { ...cfg, size: [this.res, Math.round((this.res * 16) / 9)] };
    this.engine.configure(this.cfg);
    if (t > 0.05) this.seek(t, true);
    this.engine.render();
    this.restartAudio();
    this.emit();
  }
  setAudio(a) { const hitChange = !!a.hitTrack !== !!this.cfg.audio?.hitTrack; this.cfg.audio = a; this.engine.cfg.audio = a; if (hitChange || a.hitTrack) this.restartAudio(); else if (this.synth) this.synth.setAudio(a); }
  hot(patch) { this.engine.hot(patch); this.cfg = this.engine.cfg; if (!this.playing) this.engine.render(); }
  emit() { this.onTime?.(this.engine.S.vt, this.cfg.dur, this.cfg.song.dropT); }
  seek(t, silent = false) {
    this.engine.configure(this.cfg);
    const fps = 30;
    const sfx = this.engine.onSfx;
    this.engine.onSfx = null; // fast-forward silently
    while (this.engine.S.vt + 1 / fps <= t) this.engine.advance(1 / fps);
    this.engine.onSfx = sfx;
    this.engine.render();
    if (!silent) { this.restartAudio(); this.emit(); }
  }
  restartAudio() {
    if (this.synth) { this.synth.stopAll(); this.synth = null; }
    if (!this.playing) return;
    const ctx = getCtx();
    const audio = { ...(this.cfg.audio || {}) };
    if (audio.hitTrack) audio.hitTrack = { ...audio.hitTrack, cursor0: hitCursorAt(this.engine.S.events, this.engine.S.vt, audio.hitTrack) };
    this.synth = new Synth(ctx, ctx.destination, audio);
    this.synth.master.gain.value = this.muted ? 0 : 0.72;
    const song = this.cfg.song;
    this.player = new SongPlayer(this.synth, song, song.buffer || null, song.bufOffset || 0);
    this.t0 = ctx.currentTime + 0.06 - this.engine.S.vt;
    if (song.kind !== 'none' || song.buffer) this.player.start(this.t0 + this.engine.S.vt, this.engine.S.vt);
  }
  async play() {
    const ctx = getCtx();
    if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) { /* blocked */ } }
    if (this.engine.S.vt >= this.cfg.dur - 0.05) this.seek(0, true);
    this.playing = true;
    this.restartAudio();
    this.lastPerf = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.tick());
  }
  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    if (this.synth) { this.synth.stopAll(); this.synth = null; }
  }
  setMuted(m) { this.muted = m; store.set('muted', m); if (this.synth) this.synth.master.gain.value = m ? 0 : 0.72; }
  tick() {
    if (!this.playing) return;
    const ctx = getCtx();
    const S = this.engine.S;
    const t0p = performance.now();
    let target = ctx.state === 'running' ? ctx.currentTime - this.t0 : S.vt + (t0p - this.lastPerf) / 1000;
    this.lastPerf = t0p;
    if (target - S.vt > 0.3) { this.t0 += target - S.vt - 0.03; target = S.vt + 0.03; } // device too slow: stay in sync
    let n = 0;
    while (S.vt + 1 / 60 <= target && n++ < 8) this.engine.advance(1 / 60);
    this.player?.pump(ctx.currentTime);
    this.engine.render();
    this.emit();
    // adaptive resolution
    const ms = performance.now() - t0p;
    this.slow = this.slow * 0.95 + (ms > 22 ? 1 : 0) * 0.05;
    if (this.slow > 0.5 && this.res > 360) { this.res = this.res === 720 ? 540 : 360; this.engine.resize(this.res, Math.round((this.res * 16) / 9)); this.slow = 0; }
    if (S.vt >= this.cfg.dur) {
      // loop with a short hold on the last frame
      this.pause();
      this.ended = true;
      setTimeout(() => { if (this.ended && this.alive) { this.ended = false; this.seek(0, true); this.play(); } }, 900);
      return;
    }
    this.raf = requestAnimationFrame(() => this.tick());
  }
  destroy() { this.alive = false; this.pause(); }
}

// ------------------------------------------------------------------------------------
// Thumbnails & mini live previews (home)
// ------------------------------------------------------------------------------------
const thumbCache = new Map();
const thumbQueue = [];
let thumbBusy = false;
function queueThumb(tpl, img) {
  if (thumbCache.has(tpl.id)) { img.src = thumbCache.get(tpl.id); img.classList.remove('loading'); return; }
  thumbQueue.push([tpl, img]);
  pumpThumbs();
}
async function pumpThumbs() {
  if (thumbBusy) return;
  thumbBusy = true;
  await fontsReady;
  while (thumbQueue.length) {
    const [tpl, img] = thumbQueue.shift();
    if (!img.isConnected) continue;
    if (!thumbCache.has(tpl.id)) {
      const c = document.createElement('canvas');
      const e = new Engine(c, { quality: 'mid' });
      const st = defaults(tpl);
      st.seed = 7;
      st.text = { mode: 'none', custom: '', counter: false };
      const at = tpl.thumbAt ?? Math.min(4.5, (tpl.dropAt || 0.5) * 20 * 0.55);
      e.configure({ ...engineCfg(tpl, { ...st, music: { mode: 'gen', seed: 3 }, dur: 20 }, [270, 480]) });
      while (e.S.vt < at) e.advance(1 / 20);
      e.render();
      // crop 9:13 like the card
      const out = document.createElement('canvas');
      out.width = 270; out.height = 390;
      out.getContext('2d').drawImage(c, 0, 45, 270, 390, 0, 0, 270, 390);
      thumbCache.set(tpl.id, out.toDataURL('image/jpeg', 0.82));
      await new Promise((r) => setTimeout(r, 0));
    }
    img.src = thumbCache.get(tpl.id);
    img.classList.remove('loading');
  }
  thumbBusy = false;
}

class MiniLive {
  constructor(canvas, tpl) {
    this.c = canvas; this.tpl = tpl;
    this.e = new Engine(canvas, { quality: 'low' });
    const st = defaults(tpl);
    st.seed = 11; st.dur = 14; st.effects.shake = false;
    this.e.configure(engineCfg(tpl, { ...st, music: { mode: 'gen', seed: 5 } }, [270, 480]));
    this.e.render();
    this.on = false; this.last = 0;
  }
  start() { if (this.on) return; this.on = true; this.last = performance.now(); const loop = (t) => { if (!this.on) return; const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t; this.e.advance(dt); if (this.e.S.vt > this.e.cfg.dur) this.e.reset(); this.e.render(); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
  stop() { this.on = false; cancelAnimationFrame(this.raf); }
}

// ------------------------------------------------------------------------------------
// Pages
// ------------------------------------------------------------------------------------
let cleanup = [];
function onLeave(fn) { cleanup.push(fn); }

function greeting() {
  const hr = new Date().getHours();
  return hr < 5 ? 'Bonne nuit 🌙' : hr < 12 ? 'Bonjour ☀️' : hr < 18 ? 'Bon après-midi 👋' : 'Bonsoir 👋';
}

function homePage() {
  const el = h(`<div class="view">
    <section class="hero">
      <div class="hi">${greeting()}</div>
      <h1 class="display">Qu’est-ce qu’on crée <span class="grad">aujourd’hui</span> ?</h1>
      <p>🎉 <b>Tout est gratuit et illimité.</b> Les ${TEMPLATES.length} modèles, tes propres musiques et photos, rendu sur ton appareil en <b>720p ou 1080p</b>, 30 ou 60 i/s, <b>sans filigrane</b>.</p>
    </section>
    <div class="sec"><h2 class="display">🔥 Les plus performants</h2><p>Le petit dernier et les deux formats les plus viraux.</p></div>
    <div class="top3" id="top3"></div>
    <div class="chips" id="chips"></div>
    <div id="cats"></div>
  </div>`);
  const top3 = $('#top3', el);
  const minis = [];
  for (const t of TOP) {
    const badgeCls = t.badge?.includes('Nouveau') ? 'new' : 'hot';
    const card = h(`<a class="tcard" href="#/t/${t.id}">
      <canvas class="live" width="270" height="480"></canvas>
      <div class="meta"><span class="badge ${badgeCls}">${esc(t.badge || '')}</span>${t.music ? ' <span class="badge">♪ Synchro drop</span>' : ''}
      <h3 class="display">${esc(t.name)}</h3><p>${esc(t.desc)}</p><span class="cta-sm">Créer →</span></div></a>`);
    top3.append(card);
    fontsReady.then(() => { const m = new MiniLive($('canvas', card), t); minis.push(m); io.observe(card); card._mini = m; });
  }
  const io = new IntersectionObserver((ents) => { for (const e of ents) { const m = e.target._mini; if (!m) continue; if (e.isIntersecting) m.start(); else m.stop(); } }, { threshold: 0.2 });
  onLeave(() => { io.disconnect(); minis.forEach((m) => m.stop()); });

  const chips = $('#chips', el), cats = $('#cats', el);
  let filter = store.get('filter', 'all');
  const renderCats = () => {
    chips.innerHTML = '';
    for (const c of [{ id: 'all', name: 'Tous', icon: '✨' }, ...CATEGORIES]) {
      const b = h(`<button class="chip ${filter === c.id ? 'on' : ''}">${c.icon} ${esc(c.name)}</button>`);
      b.onclick = () => { filter = c.id; store.set('filter', filter); renderCats(); };
      chips.append(b);
    }
    cats.innerHTML = '';
    for (const c of CATEGORIES) {
      if (filter !== 'all' && filter !== c.id) continue;
      const list = TEMPLATES.filter((t) => t.cat === c.id);
      const sec = h(`<div><div class="sec"><h2 class="display">${c.icon} ${esc(c.name)} <span class="cnt">${list.length}</span></h2><p>${esc(c.desc)}</p></div><div class="grid"></div></div>`);
      const grid = $('.grid', sec);
      for (const t of list) {
        const tags = [];
        if (t.badge) tags.push(`<span class="badge">${esc(t.badge)}</span>`);
        if (t.ending) tags.push('<span class="badge">⏱ Fin naturelle</span>');
        const card = h(`<a class="card" href="#/t/${t.id}"><img class="thumb loading" alt=""><div class="tags">${tags.join('')}</div>
          <div class="body"><h4>${esc(t.name)} <span>Créer →</span></h4><p>${esc(t.desc)}</p></div></a>`);
        grid.append(card);
        thumbIO.observe(card);
        card._tpl = t;
      }
      cats.append(sec);
    }
  };
  const thumbIO = new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) { thumbIO.unobserve(e.target); queueThumb(e.target._tpl, $('img', e.target)); }
  }, { rootMargin: '300px' });
  onLeave(() => thumbIO.disconnect());
  renderCats();
  return el;
}

// ---------- editor ----------
const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 10v4h4l5 4V6L8 10z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 10v4h4l5 4V6L8 10z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  dice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="15" cy="15" r="1.4" fill="currentColor"/><circle cx="15" cy="9" r="1.4" fill="currentColor"/><circle cx="9" cy="15" r="1.4" fill="currentColor"/></svg>',
};

function fmtT(t) { const s = Math.max(0, t); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }

function editorPage(tpl) {
  let st = loadSettings(tpl);
  st.entries.forEach((e, i) => (e._id = e._id || `e${i}_${Math.random().toString(36).slice(2, 7)}`));
  const el = h(`<div class="view">
    <a class="back" href="#/">← Tous les modèles</a>
    <div class="ed-head"><h1 class="display">${esc(tpl.name)}</h1><p>${esc(tpl.desc)}</p></div>
    <div class="editor">
      <div class="stage">
        <div class="phone"><div class="notch"></div><canvas id="pv"></canvas><div class="ov" id="ov"><div class="big">${ICON.play.replace('<svg', '<svg width="30" height="30" style="margin-left:4px"')}</div></div></div>
        <div class="ctrl">
          <button class="ib" id="bplay" title="Lecture">${ICON.play}</button>
          <div class="tl" id="tl"><div class="fill"></div><div class="drop"></div><div class="time">0:00</div></div>
          <button class="ib" id="bres" title="Recommencer">${ICON.restart}</button>
          <button class="ib" id="bmute" title="Son">${ICON.sound}</button>
          <button class="ib" id="bseed" title="Nouvelle variante">${ICON.dice}</button>
        </div>
        <div class="hint">Aperçu en direct, image réelle du rendu final. 🎲 = nouvelle variante du mouvement.</div>
      </div>
      <div class="panels" id="panels"></div>
    </div>
    <div class="gen"><button id="bgen">Générer ma vidéo →</button></div>
  </div>`);
  const pv = $('#pv', el), ov = $('#ov', el), tl = $('#tl', el);
  const preview = new Preview(pv, (t, dur, drop) => {
    $('.fill', tl).style.width = `${Math.min(100, (t / dur) * 100)}%`;
    $('.drop', tl).style.left = `${(drop / dur) * 100}%`;
    $('.time', tl).textContent = `${fmtT(t)} / ${fmtT(dur)}`;
  });
  preview.alive = true;
  onLeave(() => preview.destroy());
  const setPlayUI = () => {
    $('#bplay', el).innerHTML = preview.playing ? ICON.pause : ICON.play;
    ov.classList.toggle('hide', preview.playing);
    $('#bmute', el).innerHTML = preview.muted ? ICON.mute : ICON.sound;
  };
  const toggle = async () => { if (preview.playing) preview.pause(); else await preview.play(); setPlayUI(); };
  ov.onclick = toggle; $('#bplay', el).onclick = toggle;
  pv.onclick = () => { if (preview.playing) { preview.pause(); setPlayUI(); } };
  $('#bres', el).onclick = async () => { preview.seek(0); if (!preview.playing) await preview.play(); setPlayUI(); };
  $('#bmute', el).onclick = () => { preview.setMuted(!preview.muted); setPlayUI(); };
  $('#bseed', el).onclick = () => { st.seed = 1 + Math.floor(Math.random() * 99999); commit(true); };
  // timeline scrub
  const scrub = (ev) => {
    const r = tl.getBoundingClientRect();
    const k = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    preview.seek(k * st.dur);
  };
  tl.onpointerdown = (ev) => { tl.setPointerCapture(ev.pointerId); scrub(ev); };

  let commitT = 0;
  const reload = () => { fontsReady.then(() => { preview.load(engineCfg(tpl, st, null)); setPlayUI(); describeMusic(); }); };
  // structural change → restart; design change → hot swap
  function commit(structural, patch) {
    saveSettings(tpl, st);
    if (structural) { clearTimeout(commitT); commitT = setTimeout(reload, 60); }
    else preview.hot(patch);
    renderOutput();
  }

  const panels = $('#panels', el);
  // ---- design ----
  const pDesign = h('<section class="panel"><h3 class="display">Design</h3><div class="themes"></div></section>');
  const themesEl = $('.themes', pDesign);
  for (const t of THEMES) {
    const b = h(`<button class="th ${st.theme === t.id ? 'on' : ''}"><div class="sw" style="background:${t.bg[0]}">${t.cols.map((c) => `<i style="background:${c}"></i>`).join('')}</div><span>${esc(t.name)}</span></button>`);
    b.onclick = () => { st.theme = t.id; themesEl.querySelectorAll('.th').forEach((x) => x.classList.remove('on')); b.classList.add('on'); commit(false, { theme: t.id }); };
    themesEl.append(b);
  }
  panels.append(pDesign);
  // ---- material + glow ----
  const pMat = h('<section class="panel"><h3 class="display">Matière</h3><div class="mats"></div><div class="olabel" style="margin-top:14px">Lueur</div><div class="seg" id="glow"></div></section>');
  const matsEl = $('.mats', pMat);
  for (const m of MATERIALS) {
    const b = h(`<button class="mat ${st.mat === m.id ? 'on' : ''}"><canvas width="92" height="92"></canvas>${esc(m.name)}</button>`);
    const g = $('canvas', b).getContext('2d');
    drawBall(g, 46, 46, 38, '#ff3fd0', { mat: m.id, glow: 0 });
    b.onclick = () => { st.mat = m.id; matsEl.querySelectorAll('.mat').forEach((x) => x.classList.remove('on')); b.classList.add('on'); commit(false, { mat: m.id }); };
    matsEl.append(b);
  }
  segInto($('#glow', pMat), GLOWS.map((g) => [g.id, g.name]), st.glow, (v) => { st.glow = v; commit(false, { glow: v }); });
  panels.append(pMat);
  // ---- template options ----
  const opts = (tpl.options || []);
  if (opts.length) {
    const pOpt = h(`<section class="panel"><h3 class="display">Options · ${esc(tpl.name)}</h3></section>`);
    for (const o of opts) {
      if (o.type === 'choice') {
        pOpt.append(h(`<div class="olabel">${esc(o.label)}</div>`));
        const seg = h('<div class="seg"></div>');
        segInto(seg, o.choices, st.opts[o.id], (v) => { st.opts[o.id] = v; commit(true); });
        pOpt.append(seg);
      } else if (o.type === 'bool') {
        const row = h(`<div class="row"><label>${esc(o.label)}</label><button class="tog ${st.opts[o.id] ? 'on' : ''}"></button></div>`);
        $('button', row).onclick = (ev) => { st.opts[o.id] = !st.opts[o.id]; ev.currentTarget.classList.toggle('on', st.opts[o.id]); commit(true); };
        pOpt.append(row);
      } else if (o.type === 'images') {
        pOpt.append(h(`<div class="olabel">${esc(o.label)} <span style="color:var(--mu);font-weight:600">(facultatif)</span></div>`));
        const grid = h('<div class="imgs"></div>');
        o.names.forEach((name, i) => {
          const key = 'level' + i;
          const lab = h(`<label>${esc(name)}<input type="file" accept="image/*"></label>`);
          if (assets.images[key]) lab.style.backgroundImage = `url(${assets.images[key].src})`;
          $('input', lab).onchange = async (ev) => {
            const f = ev.target.files[0]; if (!f) return;
            const img = await loadImage(f);
            assets.images[key] = img;
            lab.style.backgroundImage = `url(${img.src})`;
            commit(true);
          };
          grid.append(lab);
        });
        pOpt.append(grid);
      }
    }
    panels.append(pOpt);
  }
  // ---- entries ----
  if (tpl.entries) {
    const pEnt = h('<section class="panel"><h3 class="display">Participants <small>noms, drapeaux, photos</small></h3><div id="ents"></div><button class="btn2" id="addE">+ Ajouter</button><div class="seg" style="margin-top:10px" id="presets"></div></section>');
    const list = $('#ents', pEnt);
    const renderEnts = () => {
      list.innerHTML = '';
      st.entries.forEach((e, i) => {
        const img = assets.entryImgs[e._id];
        const row = h(`<div class="ent"><input type="color" value="${e.col}"><input class="field emo" maxlength="4" value="${esc(e.emoji || '')}" placeholder="🙂"><input class="field" value="${esc(e.name)}" maxlength="18"><label class="ph" style="${img ? `background-image:url(${img.src})` : ''}">${img ? '' : '📷'}<input class="filein" type="file" accept="image/*"></label><button class="x" title="Retirer">✕</button></div>`);
        const [col, emo, name] = row.querySelectorAll('input');
        col.oninput = () => { e.col = col.value; e.colSet = true; commit(true); };
        emo.oninput = () => { e.emoji = emo.value; commit(true); };
        name.oninput = () => { e.name = name.value || '?'; commit(true); };
        $('.filein', row).onchange = async (ev) => { const f = ev.target.files[0]; if (!f) return; assets.entryImgs[e._id] = await loadImage(f, 320); renderEnts(); commit(true); };
        $('.x', row).onclick = () => { if (st.entries.length <= 2) return; st.entries.splice(i, 1); renderEnts(); commit(true); };
        list.append(row);
      });
    };
    $('#addE', pEnt).onclick = () => {
      if (st.entries.length >= 60) return;
      const n = st.entries.length;
      st.entries.push({ name: `Joueur ${n + 1}`, emoji: '', col: THEMES[0].cols[n % 5], _id: `e${Date.now()}` });
      renderEnts(); commit(true);
    };
    const PRESETS = {
      'Pays': DEFAULT_ENTRIES,
      'Prénoms': ['Léa', 'Hugo', 'Inès', 'Noah', 'Jade', 'Adam', 'Emma', 'Liam', 'Chloé', 'Sacha'].map((n, i) => ({ name: n, emoji: '', col: ['#ff4d8d', '#3d8bff', '#22d36e', '#ffc021', '#a855f7', '#ff7a1a', '#14d9d9', '#f43f5e', '#84cc16', '#e879f9'][i] })),
      'Couleurs': [['Rouge', '#ff3b3b'], ['Bleu', '#2f7bff'], ['Vert', '#1fd36a'], ['Jaune', '#ffd021'], ['Violet', '#9b5cff'], ['Orange', '#ff8a1a'], ['Rose', '#ff5cc8'], ['Cyan', '#19d9ff']].map(([n, c]) => ({ name: n, emoji: '', col: c })),
    };
    segInto($('#presets', pEnt), Object.keys(PRESETS).map((k) => [k, k]), null, (k) => {
      st.entries = PRESETS[k].map((e, i) => ({ ...e, _id: `p${i}_${Date.now()}` }));
      renderEnts(); commit(true);
    });
    renderEnts();
    panels.append(pEnt);
  }
  // ---- music ----
  const pMus = h(`<section class="panel"><h3 class="display">Musique</h3><div class="seg" id="mmode"></div>
    <input class="filein" id="mfile" type="file" accept="${AUDIO_ACCEPT}">
    <div class="musicinfo" id="minfo"></div></section>`);
  const minfo = $('#minfo', pMus);
  const describeMusic = () => {
    const song = preview.cfg?.song;
    if (st.music.mode === 'gen') minfo.innerHTML = `Bande-son originale générée pour ta vidéo · <b>${song?.bpm || '…'} BPM</b> · drop à <b>${song ? fmtT(song.dropT) : '…'}</b> <button class="btn" id="mnew" style="padding:6px 10px;margin-left:6px;font-size:12px">🎲 Autre mélodie</button>`;
    else if (st.music.mode === 'track') minfo.innerHTML = assets.track ? `🎧 <b>${esc(assets.track.name)}</b><br>Drop détecté et calé à <b>${song ? fmtT(song.dropT) : '…'}</b> de la vidéo (extrait à partir de ${song ? fmtT(song.bufOffset || 0) : '…'}) · ~${song?.bpm || '…'} BPM` : 'Choisis un fichier son ou vidéo (MP3, M4A, MP4, MOV, WAV, AAC, OGG, FLAC…). Le son est extrait, tout reste sur ton appareil.';
    else minfo.innerHTML = 'Pas de musique : seuls les effets sonores de la simulation sont gardés.';
    const nb = $('#mnew', minfo);
    if (nb) nb.onclick = () => { st.music.seed = 1 + Math.floor(Math.random() * 9999); commit(true); };
  };
  segInto($('#mmode', pMus), [['gen', 'Générée'], ['track', 'Ma musique'], ['none', 'Aucune']], st.music.mode, (v, setOn) => {
    if (v === 'track') { $('#mfile', pMus).click(); if (!assets.track) return false; }
    st.music.mode = v; commit(true); setTimeout(showHit); return true;
  });
  // ---- how the user's track is played ----
  const hitEl = h(`<div id="hitopts" style="margin-top:12px">
    <div class="olabel">Lecture de ma musique</div><div class="seg" id="mplay"></div>
    <div id="hitmore"><div class="olabel">Durée jouée par impact</div><div class="seg" id="mhold"></div>
    <div class="row"><label>La musique démarre à</label><span class="slider-v" id="mstv">${fmtT(st.music.start || 0)}</span></div>
    <input type="range" id="mst" min="0" max="300" step="1" value="${st.music.start || 0}"></div>
    <div class="sub" id="hitsub"></div></div>`);
  const showHit = () => {
    hitEl.style.display = st.music.mode === 'track' && assets.track ? '' : 'none';
    $('#hitmore', hitEl).style.display = st.music.play === 'hits' ? '' : 'none';
    if (assets.track) $('#mst', hitEl).max = Math.floor(assets.track.buffer.duration);
    $('#hitsub', hitEl).innerHTML = tpl.noHits && st.music.play === 'hits'
      ? 'Ce modèle n’a pas de collisions : la musique y est jouée en continu.'
      : st.music.play === 'hits' ? 'À chaque rebond, cassure ou contact, ta musique reprend là où elle s’était arrêtée. Sans contact : silence.' : 'Ta musique joue en continu, le drop est calé sur la vidéo.';
  };
  segInto($('#mplay', hitEl), [['continuous', 'En continu'], ['hits', 'À chaque impact']], st.music.play || 'continuous', (v) => { st.music = { ...st.music, play: v }; showHit(); pushAudio(); });
  segInto($('#mhold', hitEl), [[0.15, 'Court'], [0.3, 'Moyen'], [0.6, 'Long']], st.music.hold || 0.3, (v) => { st.music = { ...st.music, hold: v }; pushAudio(); });
  const mst = $('#mst', hitEl);
  mst.oninput = () => { $('#mstv', hitEl).textContent = fmtT(+mst.value); };
  mst.onchange = () => { st.music = { ...st.music, start: +mst.value }; pushAudio(); };
  pMus.append(hitEl);
  $('#mfile', pMus).onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    minfo.innerHTML = 'Extraction et analyse du son… (tempo, drop, notes)';
    try {
      const buffer = await decodeFile(getCtx(), f);
      assets.track = { name: f.name, buffer };
      st.music.mode = 'track';
      $('#mmode', pMus).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === 'track'));
      commit(true);
      showHit();
    } catch (e) { minfo.innerHTML = '<span class="err">Ce navigateur ne sait pas lire le son de ce fichier. Essaie MP3, M4A, MP4 ou WAV.</span>'; }
  };
  // ---- mix & custom impact sounds ----
  const mixEl = h(`<div>
    <div class="row"><label>Volume musique</label><span class="slider-v" id="vmv">${Math.round(st.mix.music * 100)} %</span></div>
    <input type="range" id="vm" min="0" max="1.5" step="0.05" value="${st.mix.music}">
    <div class="row"><label>Volume des effets sonores</label><span class="slider-v" id="vsv">${Math.round(st.mix.sfx * 100)} %</span></div>
    <input type="range" id="vs" min="0" max="1.5" step="0.05" value="${st.mix.sfx}">
    <div class="olabel">Sons d’impact (rebonds, cassures, fusions…)</div><div class="seg" id="hmode"></div>
    <input class="filein" id="hfile" type="file" accept="${AUDIO_ACCEPT}">
    <div class="sub" id="hinfo"></div></div>`);
  const pushAudio = () => { saveSettings(tpl, st); preview.setAudio(audioOf({ ...st, _noHits: !!tpl.noHits })); };
  const vm = $('#vm', mixEl), vs = $('#vs', mixEl);
  vm.oninput = () => { st.mix = { ...st.mix, music: +vm.value }; $('#vmv', mixEl).textContent = `${Math.round(vm.value * 100)} %`; pushAudio(); };
  vs.oninput = () => { st.mix = { ...st.mix, sfx: +vs.value }; $('#vsv', mixEl).textContent = `${Math.round(vs.value * 100)} %`; pushAudio(); };
  const hinfo = $('#hinfo', mixEl);
  const descHit = () => {
    hinfo.textContent = st.mix.hitMode === 'synth' ? 'Sons synthétisés, accordés sur la musique.'
      : `🔊 ${assets.hit ? assets.hit.name : ''} · rejoué à chaque impact, à la bonne hauteur de note${st.mix.hitMode === 'mix' ? ', mélangé aux sons d’origine' : ''}.`;
  };
  let pendingHit = null;
  segInto($('#hmode', mixEl), [['synth', 'Synthé'], ['mix', 'Mon son + synthé'], ['replace', 'Mon son seul']], 'synth', (v) => {
    if (v !== 'synth' && !assets.hit) { pendingHit = v; $('#hfile', mixEl).click(); return false; }
    st.mix = { ...st.mix, hitMode: v }; pushAudio(); descHit(); return true;
  });
  $('#hfile', mixEl).onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const buffer = await decodeFile(getCtx(), f);
      assets.hit = { name: f.name, buffer };
      st.mix = { ...st.mix, hitMode: pendingHit || 'mix' };
      $('#hmode', mixEl).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === st.mix.hitMode));
      pushAudio(); descHit();
    } catch (e) { hinfo.innerHTML = '<span class="err">Impossible de lire ce son.</span>'; }
  };
  if (assets.hit && st.mix.hitMode !== 'synth') $('#hmode', mixEl).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === st.mix.hitMode));
  descHit();
  showHit();
  pMus.append(mixEl);
  panels.append(pMus);
  // ---- text ----
  const pTxt = h(`<section class="panel"><h3 class="display">Texte</h3><div class="seg" id="tmode"></div>
    <input class="field" id="tcustom" style="margin-top:10px" maxlength="80" placeholder="Ton accroche…" value="${esc(st.text.custom)}">
    <div class="row"><label>Afficher le compteur</label><button class="tog ${st.text.counter ? 'on' : ''}" id="tcount"></button></div></section>`);
  const tc = $('#tcustom', pTxt);
  tc.style.display = st.text.mode === 'custom' ? '' : 'none';
  segInto($('#tmode', pTxt), [['auto', 'Accroche auto'], ['custom', 'Mon texte'], ['none', 'Aucun']], st.text.mode, (v) => { st.text = { ...st.text, mode: v }; tc.style.display = v === 'custom' ? '' : 'none'; commit(false, { text: st.text }); });
  tc.oninput = () => { st.text = { ...st.text, custom: tc.value }; commit(false, { text: st.text }); };
  $('#tcount', pTxt).onclick = (ev) => { st.text = { ...st.text, counter: !st.text.counter }; ev.currentTarget.classList.toggle('on', st.text.counter); commit(false, { text: st.text }); };
  panels.append(pTxt);
  // ---- effects ----
  const pFx = h('<section class="panel"><h3 class="display">Effets</h3><div class="fx"></div><div class="row"><label>Traînée derrière les balles</label><button class="tog" id="ttrail"></button></div></section>');
  for (const f of EFFECTS) {
    const b = h(`<button class="${st.effects[f.id] ? 'on' : ''}">${esc(f.name)}</button>`);
    b.onclick = () => { st.effects = { ...st.effects, [f.id]: !st.effects[f.id] }; b.classList.toggle('on', st.effects[f.id]); commit(false, { effects: st.effects }); };
    $('.fx', pFx).append(b);
  }
  const tt = $('#ttrail', pFx); tt.classList.toggle('on', st.trails);
  tt.onclick = () => { st.trails = !st.trails; tt.classList.toggle('on', st.trails); commit(false, { trails: st.trails }); };
  panels.append(pFx);
  // ---- video ----
  const pVid = h(`<section class="panel"><h3 class="display">Vidéo</h3>
    <div class="row" style="margin-top:0"><label>Durée</label><span class="slider-v" id="durv">${st.dur} s</span></div>
    <input type="range" id="dur" min="5" max="60" step="1" value="${st.dur}">
    <div class="olabel">Résolution</div><div class="seg" id="res"></div>
    <div class="olabel">Images par seconde</div><div class="seg" id="fps"></div>
    <div class="row"><label>Filigrane « fait avec LOOPLAB »</label><button class="tog ${st.watermark ? 'on' : ''}" id="wm"></button></div>
    <div class="out" id="out"></div></section>`);
  const durIn = $('#dur', pVid);
  durIn.oninput = () => { $('#durv', pVid).textContent = durIn.value + ' s'; };
  durIn.onchange = () => { st.dur = +durIn.value; commit(true); };
  segInto($('#res', pVid), [[720, '720p'], [1080, '1080p']], st.res, (v) => { st.res = v; saveSettings(tpl, st); renderOutput(); });
  segInto($('#fps', pVid), [[30, '30 i/s'], [60, '60 i/s']], st.fps, (v) => { st.fps = v; saveSettings(tpl, st); renderOutput(); });
  $('#wm', pVid).onclick = (ev) => { st.watermark = !st.watermark; ev.currentTarget.classList.toggle('on', st.watermark); commit(false, { watermark: st.watermark }); };
  panels.append(pVid);
  async function renderOutput() {
    const [w, hh] = st.res === 1080 ? [1080, 1920] : [720, 1280];
    const p = await probeExport(w, hh, st.fps);
    const out = $('#out', pVid);
    if (out) out.textContent = `Sortie : ${w}×${hh} · ${st.fps} i/s · ${st.dur} s · ${p.label}`;
  }
  // ---- generate ----
  $('#bgen', el).onclick = () => { preview.pause(); setPlayUI(); openRender(tpl, st); };

  reload();
  renderOutput();
  setPlayUI();
  return el;
}

function segInto(seg, items, cur, onPick) {
  seg.innerHTML = '';
  for (const [v, label] of items) {
    const b = h(`<button class="${String(v) === String(cur) ? 'on' : ''}">${esc(label)}</button>`);
    b.dataset.v = v;
    b.onclick = () => {
      const val = typeof v === 'number' ? v : v;
      const ok = onPick(val);
      if (ok === false) return;
      seg.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    };
    seg.append(b);
  }
}

function loadImage(file, max = 512) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // downscale big photos so they stay light in memory and fast to draw
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const out = new Image();
      out.onload = () => res(out);
      out.src = c.toDataURL('image/jpeg', 0.9);
      URL.revokeObjectURL(url);
    };
    img.onerror = rej;
    img.src = url;
  });
}

// ---------- render modal ----------
function openRender(tpl, st) {
  const [w, hh] = st.res === 1080 ? [1080, 1920] : [720, 1280];
  const ac = new AbortController();
  const m = h(`<div class="modal"><div class="mbox">
    <h3 class="display">Rendu en cours</h3><p>Chaque image est calculée sur ton appareil, en qualité maximale.</p>
    <div class="rwrap"><canvas width="270" height="480"></canvas>
      <svg class="ring" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="rg" x1="0" x2="1"><stop offset="0" stop-color="#c6ff3d"/><stop offset=".5" stop-color="#3de1ff"/><stop offset="1" stop-color="#8b5cff"/></linearGradient></defs>
      <rect x="1.5" y="1.5" width="97" height="97" rx="12" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1.2"/>
      <rect id="rr" x="1.5" y="1.5" width="97" height="97" rx="12" fill="none" stroke="url(#rg)" stroke-width="1.6" pathLength="100" stroke-dasharray="0 100" stroke-linecap="round"/></svg></div>
    <div class="pct" id="pct">0 %</div><div class="stage-l" id="stl">Préparation…</div>
    <div class="mrow"><button class="btn" id="cancel">Annuler</button></div>
  </div></div>`);
  document.body.append(m);
  const cv = $('canvas', m).getContext('2d');
  const set = (k, label) => {
    $('#pct', m).textContent = `${Math.round(k * 100)} %`;
    $('#rr', m).setAttribute('stroke-dasharray', `${(k * 100).toFixed(1)} 100`);
    if (label) $('#stl', m).textContent = label;
  };
  $('#cancel', m).onclick = () => { ac.abort(); m.remove(); };
  const cfg = engineCfg(tpl, st, [w, hh]);
  const started = performance.now();
  (async () => {
    await fontsReady;
    try {
      const res = await exportVideo(cfg, {
        signal: ac.signal,
        onProgress: (stage, k, canvas) => {
          if (canvas) cv.drawImage(canvas, 0, 0, 270, 480);
          if (stage === 'video') {
            const el = (performance.now() - started) / 1000;
            const eta = k > 0.03 ? Math.max(0, el / k - el) : 0;
            set(k * 0.9, `Images · ${Math.round(k * st.dur * st.fps)}/${st.dur * st.fps}${eta ? ` · ~${Math.ceil(eta)} s restantes` : ''}`);
          } else if (stage === 'audio') set(0.9 + k * 0.08, 'Mixage de la bande-son…');
          else set(0.99, 'Assemblage du fichier…');
        },
      });
      const id = `v${Date.now()}`;
      const name = `${tpl.name} · ${new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
      try { await DB.saveVideo({ id, tpl: tpl.id, name, created: Date.now(), blob: res.blob, thumb: res.thumb, mime: res.mime, ext: res.ext, dur: st.dur, w, h: hh, fps: st.fps, size: res.blob.size }); refreshCount(); } catch (e) { /* storage full */ }
      showResult(m, { blob: res.blob, mime: res.mime, ext: res.ext, name, tplId: tpl.id, codec: res.codec, secs: (performance.now() - started) / 1000 });
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error(e);
      $('.mbox', m).innerHTML = `<h3 class="display">Oups</h3><p class="err">${esc(e.message || e)}</p><button class="btn" id="cl">Fermer</button>`;
      $('#cl', m).onclick = () => m.remove();
    }
  })();
}

function showResult(m, r) {
  const url = URL.createObjectURL(r.blob);
  const file = `looplab-${r.tplId}-${Date.now()}.${r.ext}`;
  const mb = (r.blob.size / 1048576).toFixed(1);
  $('.mbox', m).innerHTML = `<h3 class="display">C’est prêt ✨</h3><p>${esc(r.codec || '')} · ${mb} Mo${r.secs ? ` · rendu en ${Math.round(r.secs)} s` : ''} · enregistrée dans « Mes vidéos »</p>
    <video class="res" src="${url}" controls autoplay loop playsinline></video>
    <div class="mrow" style="margin-top:12px"><a class="btn p" href="${url}" download="${file}">⬇ Télécharger</a><button class="btn" id="share">↗ Partager</button></div>
    <div class="mrow" style="margin-top:8px"><button class="btn" id="close">Fermer</button></div>`;
  const f = new File([r.blob], file, { type: r.mime });
  const canShare = navigator.canShare && navigator.canShare({ files: [f] });
  if (!canShare) $('#share', m).style.display = 'none';
  $('#share', m).onclick = async () => { try { await navigator.share({ files: [f], title: r.name }); } catch (e) { /* cancelled */ } };
  $('#close', m).onclick = () => { m.remove(); URL.revokeObjectURL(url); };
}

// ---------- my videos ----------
async function videosPage() {
  const el = h(`<div class="view"><a class="back" href="#/">← Tous les modèles</a><div class="ed-head"><h1 class="display">Mes vidéos</h1><p>Gardées sur cet appareil uniquement.</p></div><div class="vgrid" id="vg"></div></div>`);
  const vids = await DB.listVideos();
  const g = $('#vg', el);
  if (!vids.length) { g.replaceWith(h('<div class="empty">Aucune vidéo pour l’instant.<br><br><a class="cta-sm" href="#/">Créer ma première vidéo →</a></div>')); return el; }
  for (const v of vids) {
    const turl = v.thumb ? URL.createObjectURL(v.thumb) : '';
    const c = h(`<button class="vcard"><img src="${turl}" alt=""><div><b>${esc(v.name)}</b>${v.w}×${v.h} · ${v.fps} i/s · ${(v.size / 1048576).toFixed(1)} Mo</div></button>`);
    c.onclick = () => {
      const m = h('<div class="modal"><div class="mbox"></div></div>');
      document.body.append(m);
      showResult(m, { blob: v.blob, mime: v.mime, ext: v.ext, name: v.name, tplId: v.tpl, codec: `${v.w}×${v.h} · ${v.dur} s` });
      const del = h('<div class="mrow" style="margin-top:8px"><button class="btn" style="color:#ff8aa8">🗑 Supprimer</button></div>');
      $('.mbox', m).append(del);
      $('button', del).onclick = async () => { await DB.deleteVideo(v.id); m.remove(); refreshCount(); route(); };
      m.onclick = (ev) => { if (ev.target === m) m.remove(); };
    };
    g.append(c);
  }
  return el;
}

async function refreshCount() {
  const n = (await DB.listVideos()).length;
  const b = $('#vcount');
  b.hidden = !n; b.textContent = n;
}

// ------------------------------------------------------------------------------------
// Router
// ------------------------------------------------------------------------------------
async function route() {
  for (const f of cleanup) { try { f(); } catch (e) { /* noop */ } }
  cleanup = [];
  const hash = location.hash || '#/';
  let page;
  const m = hash.match(/^#\/t\/([\w-]+)/);
  if (m) {
    const tpl = TEMPLATES.find((t) => t.id === m[1]);
    page = tpl ? editorPage(tpl) : homePage();
  } else if (hash.startsWith('#/videos')) page = await videosPage();
  else page = homePage();
  view.replaceChildren(page);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();
refreshCount();
