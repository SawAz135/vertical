/* =====================================================================
   Roblox Forge · Jouer — the player app.
   Home (your games, imports, samples) → join screen → the game, running in
   the browser like the Roblox client: R15-style avatar, Humanoid physics
   (WalkSpeed 16, JumpPower 50, gravity 196.2), classic follow camera,
   dynamic thumbstick + jump button on phones, WASD + mouse on PC, topbar,
   player list, chat with bubbles, emotes, Esc menu, death + respawn.
   The game rules are the ones the Forge Luau scripts run in Roblox:
   ForgeGame (train, sell, shop, rebirth, eggs, boosts, codes, daily, auto,
   combat, leaderboard) and ForgeMap (coins, gates, checkpoints, kill parts,
   jump pads, conveyors, movers, spinners, teleporters, tycoons).
   ===================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World, labelSprite, voxMat } from './world.js';
import { Avatar, DEFAULT_LOOK, HATS, FACES, petMesh } from './avatar.js';
import * as LIB from './library.js';
import * as MC from '../map/map-core.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const Store = { get(k, d) { try { const v = localStorage.getItem('forgeplay.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('forgeplay.' + k, JSON.stringify(v)); } catch {} } };
const toast = (t, ms = 2400) => { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), ms); };
const abbrev = (v) => { v = Math.floor(v || 0); const u = [[1e15, 'Qa'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']].find(([n]) => Math.abs(v) >= n); return u ? (v / u[0]).toFixed(v / u[0] < 10 ? 2 : 1).replace(/\.?0+$/, '') + u[1] : String(v); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const D2R = Math.PI / 180, GRAV = 196.2, JUMP = 50;
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (!TOUCH) document.body.classList.add('desktop');

/* =====================================================================
   SOUND (synthesised, starts after the first tap like any web audio)
   ===================================================================== */
const SFX = (() => { let ac = null, master = null; const vol = () => Store.get('vol', 0.7);
  const ctx = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.connect(ac.destination); } catch { return null; } } master.gain.value = vol(); if (ac.state === 'suspended') ac.resume(); return ac; };
  const tone = (f0, f1, dur, type = 'sine', g = 0.25, delay = 0) => { const a = ctx(); if (!a) return; const t = a.currentTime + delay, o = a.createOscillator(), v = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + 0.012); v.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(v); v.connect(master); o.start(t); o.stop(t + dur + 0.02); };
  const noise = (dur, f, g = 0.2, delay = 0, q = 1) => { const a = ctx(); if (!a) return; const t = a.currentTime + delay, b = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = a.createBufferSource(), fl = a.createBiquadFilter(), v = a.createGain(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q; s.buffer = b; v.gain.value = g; s.connect(fl); fl.connect(v); v.connect(master); s.start(t); };
  return { unlock: ctx, setVol: () => { if (master) master.gain.value = vol(); },
    jump: () => { noise(0.18, 900, 0.12, 0, 0.8); tone(260, 520, 0.16, 'sine', 0.08); }, land: () => noise(0.08, 300, 0.15, 0, 0.7),
    coin: () => { tone(988, 988, 0.08, 'square', 0.07); tone(1319, 1319, 0.25, 'square', 0.07, 0.07); }, click: () => tone(700, 500, 0.05, 'triangle', 0.12),
    train: () => { tone(320, 640, 0.09, 'triangle', 0.12); noise(0.06, 2400, 0.05); }, sell: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.14, 'triangle', 0.12, i * 0.06)); noise(0.3, 5000, 0.04, 0.1, 0.5); },
    buy: () => { tone(880, 880, 0.08, 'square', 0.06); tone(1175, 1175, 0.08, 'square', 0.06, 0.08); tone(1568, 1568, 0.22, 'square', 0.06, 0.16); }, error: () => { tone(220, 180, 0.12, 'square', 0.06); tone(180, 150, 0.16, 'square', 0.06, 0.1); },
    die: () => { tone(420, 90, 0.5, 'sawtooth', 0.08); noise(0.5, 400, 0.15, 0, 0.6); }, swing: () => noise(0.18, 1800, 0.18, 0, 1.4), hit: () => { noise(0.1, 600, 0.3); tone(160, 60, 0.15, 'square', 0.1); },
    shake: (k) => { noise(0.07, 500 + k * 400, 0.12 + k * 0.05); tone(200 + k * 120, 150 + k * 100, 0.08, 'triangle', 0.08); },
    hatch: (r) => { noise(0.4, 3000, 0.25); [0, 4, 7, 12, 16].forEach((s, i) => tone(392 * 2 ** (s / 12), 392 * 2 ** (s / 12), 0.35, 'triangle', 0.1, 0.05 + i * 0.07)); if (r >= 2) [0, 7, 12, 19, 24].forEach((s, i) => tone(523 * 2 ** (s / 12), 523 * 2 ** (s / 12), 0.5, 'sine', 0.08, 0.5 + i * 0.09)); },
    rebirth: () => { for (let i = 0; i < 10; i++) tone(200 + i * 90, 260 + i * 110, 0.25, 'sawtooth', 0.04, i * 0.05); tone(1047, 1047, 0.8, 'triangle', 0.1, 0.55); }, tp: () => tone(300, 1500, 0.35, 'sine', 0.1), chat: () => tone(1200, 1500, 0.06, 'sine', 0.06) };
})();
addEventListener('pointerdown', () => SFX.unlock(), { once: true });

/* =====================================================================
   AVATAR LOOK + PREVIEW RENDERER (avatar editor, headshots, pet images)
   ===================================================================== */
let look = { ...DEFAULT_LOOK, ...Store.get('look', {}) };
const PV = (() => {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.setPixelRatio(Math.min(2, devicePixelRatio));
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.5)); const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 6, -6); sc.add(key); const rim = new THREE.DirectionalLight(0x9fc0ff, 1.4); rim.position.set(-5, 4, 5); sc.add(rim);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100); return { r, sc, cam };
})();
const imgCache = new Map();
function snap(obj, { w = 256, h = 256, camPos, at } = {}) { const { r, sc, cam } = PV; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); sc.add(obj); cam.position.copy(camPos); cam.lookAt(at); r.render(sc, cam); const url = r.domElement.toDataURL('image/png'); sc.remove(obj); return url; }
function headshot() { const a = new Avatar(look); a.root.rotation.y = Math.PI + 0.35; const u = snap(a.root, { w: 160, h: 160, camPos: new THREE.Vector3(0, 4.7, -5.2), at: new THREE.Vector3(0, 4.3, 0) }); a.dispose(); return u; }
function petImage(name) { if (imgCache.has('p' + name)) return imgCache.get('p' + name); const g = petMesh(name, voxMat); g.rotation.y = Math.PI * 0.82; const b = new THREE.Box3().setFromObject(g), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), d = Math.max(s.x, s.y, s.z);
  const u = snap(g, { w: 200, h: 200, camPos: c.clone().add(new THREE.Vector3(0, d * 0.35, -d * 2.4)), at: c }); imgCache.set('p' + name, u); return u; }
let meShot = headshot(); $('meImg').src = meShot;

/* =====================================================================
   HOME
   ===================================================================== */
let dbGames = [];
const thumbOf = (id) => Store.get('thumb.' + id, null);
const allGames = () => [...LIB.localGames(), ...dbGames.sort((a, b) => (b.playedAt || b.createdAt || 0) - (a.playedAt || a.createdAt || 0)), ...LIB.FEATURED.map(LIB.featuredGame)];
function findGame(id) { return allGames().find((g) => g.id === id); }
function tile(g) { const th = thumbOf(g.id), gen = LIB.GENRE_FR[g.genre] || 'Jeu';
  return `<button class="tile" data-g="${esc(g.id)}"><div class="thumb" style="${th ? '' : LIB.coverStyle(g)}">${th ? `<img src="${th}" alt="">` : `<span class="gl">${LIB.genreEmoji(g.genre)}</span>`}${g.live ? '<span class="badge live">EN COURS</span>' : g.source === 'file' ? '<span class="badge">IMPORTÉ</span>' : ''}</div>
    <b>${esc(g.title)}</b><small><span>${esc(gen)}</span><span>· ${g.source === 'featured' ? 'Exemple' : g.source === 'file' ? 'Fichier' : 'Forge'}</span></small></button>`; }
async function renderHome() {
  dbGames = await LIB.dbAll(); const loc = LIB.localGames(), recent = dbGames.slice().sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0)).filter((g) => g.playedAt).slice(0, 8);
  const F = LIB.FEATURED.map(LIB.featuredGame);
  $('feed').innerHTML = `
    ${loc.length ? `<div class="sec"><h2>Tes créations <small>depuis Forge</small></h2><div class="row">${loc.map(tile).join('')}</div></div>` : ''}
    ${recent.length ? `<div class="sec"><h2>Continuer</h2><div class="row">${recent.map(tile).join('')}</div></div>` : ''}
    <div class="sec"><h2>Mes jeux <small>${dbGames.length} jeu${dbGames.length > 1 ? 'x' : ''}</small></h2>${dbGames.length ? `<div class="row">${dbGames.map(tile).join('')}</div>` : '<div class="empty">Aucun jeu ici pour l’instant. Mets le fichier de ton jeu (le pack <b>.zip</b> de « Créer tout » ou de Map Studio, ou une carte <b>.json</b>) : il apparaît ici et tu peux y jouer.</div>'}
      <button class="drop" id="dropBtn"><span class="di"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4 16v2.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V16"/></svg></span><span><b>Ajouter un jeu</b><small>Choisis le fichier .zip ou .json · ou glisse-le ici</small></span></button></div>
    <div class="sec"><h2>Découvrir <small>faits avec Roblox Forge</small></h2><div class="wide">${F.map(tile).join('')}</div></div>`;
  $('feed').querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { SFX.click(); openSheet(findGame(b.dataset.g)); }));
  $('dropBtn').onclick = () => $('file').click();
}
$('importBtn').onclick = () => $('file').click();
$('file').onchange = async () => { const f = $('file').files[0]; $('file').value = ''; if (f) await importIt(f); };
async function importIt(f) {
  try { toast('Lecture de « ' + f.name + ' »…', 8000); const g = await LIB.importFile(f); g.createdAt = Date.now(); await LIB.dbPut(g); await renderHome(); toast('✅ « ' + g.title + ' » ajouté à tes jeux'); openSheet(g); }
  catch (e) { console.error(e); toast('❌ ' + (e.message || e), 4200); }
}
addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dragging'); });
addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
addEventListener('drop', (e) => { e.preventDefault(); document.body.classList.remove('dragging'); const f = e.dataTransfer.files[0]; if (f) importIt(f); });

/* game page (bottom sheet) */
function openSheet(g) {
  if (!g) return; const th = thumbOf(g.id), feats = g.spec ? describeSpec(g.spec) : mapFeatures(g);
  const saved = Store.get('save.' + g.id, null);
  $('pane').innerHTML = `<div class="hero" style="${th ? '' : LIB.coverStyle(g)}">${th ? `<img src="${th}" alt="">` : `<span class="gl">${LIB.genreEmoji(g.genre)}</span>`}<span class="grab"></span><button class="x" id="shX" aria-label="Fermer">✕</button></div>
    <div class="info"><h3>${esc(g.title)}</h3><div class="by">par <b>@${esc(look.name)}</b> · ${esc(LIB.GENRE_FR[g.genre] || 'Jeu')}${g.file ? ' · ' + esc(g.file) : ''}</div>
      <button class="play" id="shPlay"><svg viewBox="0 0 24 24" fill="#fff"><path d="M7 4.5v15l12.5-7.5z"/></svg>${saved ? 'Reprendre' : 'Jouer'}</button>
      <div class="stats3"><div><b>${saved ? abbrev(saved.playtime / 60) + ' min' : '—'}</b><small>Joué</small></div><div><b>${g.spec ? (g.spec.buttons || []).length : '—'}</b><small>Boutons</small></div><div><b>Solo</b><small>Serveur</small></div></div>
      <ul class="feat">${feats.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      <div class="btnrow">${saved ? '<button class="btn2" id="shReset">Effacer la progression</button>' : ''}${g.source === 'file' || g.source === 'saved' ? '<button class="btn2 red" id="shDel">Supprimer</button>' : ''}</div></div>`;
  const sh = $('sheet'); sh.classList.add('on'); $('shX').onclick = closeSheet; sh.onclick = (e) => { if (e.target === sh) closeSheet(); };
  $('shPlay').onclick = () => { closeSheet(); startGame(g); };
  if ($('shReset')) $('shReset').onclick = () => { try { localStorage.removeItem('forgeplay.save.' + g.id); } catch {} toast('Progression effacée'); openSheet(g); };
  if ($('shDel')) $('shDel').onclick = async () => { if ($('shDel').dataset.ok !== '1') { $('shDel').dataset.ok = '1'; $('shDel').textContent = 'Appuie encore pour supprimer'; return; } await LIB.dbDel(g.id); closeSheet(); renderHome(); toast('Jeu supprimé'); };
}
function closeSheet() { $('sheet').classList.remove('on'); }
function describeSpec(s) { const o = [], S = (s.stats || []).map((x) => x.e + ' ' + x.id).join(', '), M = (s.money || []).map((x) => x.e + ' ' + x.id).join(', ');
  if (S) o.push('Stats : ' + S); if (M) o.push('Argent : ' + M); if (s.train) o.push(`Entraînement : +${s.train.perClick} ${s.train.stat} par clic`); if (s.sell) o.push(`Vente : ${s.sell.from} → ${s.sell.to}`);
  if (s.shop) o.push('Boutique : ' + s.shop.items.map((i) => i.e + ' ' + i.name).join(', ')); if (s.rebirth) o.push(`Rebirth dès ${abbrev(s.rebirth.cost)} ${s.rebirth.costStat}`); if (s.eggs) o.push('Œufs : ' + s.eggs.pets.map((p) => p.name).join(', '));
  if (s.zones) o.push(s.zones + ' zones à débloquer'); if (s.daily) o.push('Cadeau quotidien'); if (s.codes?.length) o.push('Codes : ' + s.codes.map((c) => c.code).join(', ')); if (s.combat) o.push('Combat à l’épée'); if (s.autoTrain) o.push('Auto-entraînement');
  return o; }
function mapFeatures(g) { const m = g.map; if (!m) return ['Carte']; const st = MC.stats(m), R = { coin: '🪙 pièces', checkpoint: '🚩 checkpoints', kill: '☠️ pièges', jumppad: '🦘 tremplins', gate: '🔒 portes', mover: '↔️ plateformes mobiles', spinner: '🌀 tourniquets', teleporter: '🌀 téléporteurs', dropper: '⬇️ droppers', buybutton: '🛒 boutons d’achat', conveyor: '➡️ tapis' };
  return [`${st.parts.toLocaleString('fr')} pièces`, ...Object.entries(st.roles).map(([k, v]) => `${v} ${R[k] || k}`)]; }

/* tabs */
document.querySelectorAll('#tabs [data-tab]').forEach((b) => (b.onclick = () => { SFX.click(); const t = b.dataset.tab; if (t === 'import') return $('file').click(); showTab(t); }));
function showTab(t) { document.querySelectorAll('#tabs [data-tab]').forEach((x) => x.classList.toggle('on', x.dataset.tab === t)); $('home').hidden = t !== 'home'; $('avatar').hidden = t !== 'avatar'; if (t === 'avatar') openAvatar(); else AV.on = false; }
$('meBtn').onclick = () => showTab('avatar'); $('avBack').onclick = () => showTab('home');

/* =====================================================================
   AVATAR EDITOR
   ===================================================================== */
const AV = { on: false, av: null, yaw: Math.PI + 0.5, drag: null };
const SKINS = ['#f5cd9a', '#eab88a', '#c98e5e', '#a5683e', '#6b4226', '#f2d7c6', '#ffcc00', '#a3a2a5', '#56c271', '#5a9bff'];
const CLOTH = ['#2f7de1', '#e8423f', '#2bb673', '#ffb02e', '#9b59ff', '#ff7ab6', '#14b8c4', '#f7f7f8', '#3a3f4b', '#1b1d22', '#8b5a2b', '#ffd45c'];
function openAvatar() {
  const st = $('avStage'); if (!AV.av) { st.appendChild(PV.r.domElement); }
  const o = $('avOpts'), sw = (k, list) => `<div class="sw">${list.map((c) => `<button style="background:${c}" class="${look[k] === c ? 'on' : ''}" data-k="${k}" data-v="${c}" aria-label="${c}"></button>`).join('')}</div>`;
  o.innerHTML = `<div class="fld"><label for="avName">Pseudo</label><input class="tinput" id="avName" maxlength="20" value="${esc(look.name)}"></div>
    <div class="fld"><label>Peau</label>${sw('skin', SKINS)}</div><div class="fld"><label>T-shirt</label>${sw('shirt', CLOTH)}</div><div class="fld"><label>Pantalon</label>${sw('pants', CLOTH)}</div><div class="fld"><label>Chaussures</label>${sw('shoes', CLOTH)}</div>
    <div class="fld"><label>Visage</label><div class="chips">${Object.keys(FACES).map((f) => `<button data-k="face" data-v="${f}" class="${look.face === f ? 'on' : ''}">${f}</button>`).join('')}</div></div>
    <div class="fld"><label>Accessoire</label><div class="chips">${Object.entries(HATS).map(([k, v]) => `<button data-k="hat" data-v="${k}" class="${look.hat === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
    <div class="fld"><label>Couleur de l’accessoire</label>${sw('hatColor', CLOTH)}</div><div class="fld"><label>Cheveux</label>${sw('hair', ['#3b2416', '#1b1b1b', '#e6c27a', '#b5562b', '#f2f2f2', '#ff7ab6', '#5a9bff'])}</div>`;
  o.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { SFX.click(); look[b.dataset.k] = b.dataset.v; saveLook(); openAvatar(); AV.av.emote('wave'); }));
  $('avName').onchange = () => { look.name = $('avName').value.trim().slice(0, 20) || 'Joueur'; saveLook(); };
  if (!AV.av) AV.av = new Avatar(look); else AV.av.setLook(look); AV.on = true;
  if (!AV.loop) { AV.loop = true; let last = performance.now();
    const tick = (now) => { requestAnimationFrame(tick); if (!AV.on) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; const { r, sc, cam } = PV, w = st.clientWidth, h = st.clientHeight; if (!w) return;
      if (r.domElement.parentNode !== st) st.appendChild(r.domElement); if (r.domElement.width !== Math.round(w * r.getPixelRatio())) r.setSize(w, h, false);
      cam.aspect = w / h; cam.updateProjectionMatrix(); if (!AV.drag) AV.yaw += dt * 0.25; AV.av.root.rotation.y = AV.yaw; AV.av.update(dt); if (AV.av.root.parent !== sc) sc.add(AV.av.root);
      cam.position.set(0, 3.4, 13); cam.lookAt(0, 2.7, 0); r.render(sc, cam); };
    requestAnimationFrame(tick);
    st.addEventListener('pointerdown', (e) => { AV.drag = e.clientX; st.setPointerCapture(e.pointerId); }); st.addEventListener('pointermove', (e) => { if (AV.drag == null) return; AV.yaw += (e.clientX - AV.drag) * 0.012; AV.drag = e.clientX; });
    st.addEventListener('pointerup', () => (AV.drag = null)); st.addEventListener('dblclick', () => AV.av.emote('dance')); }
}
function saveLook() { Store.set('look', look); meShot = headshot(); $('meImg').src = meShot; }

/* =====================================================================
   GAME RUNTIME
   ===================================================================== */
let renderer = null, composer = null, bloom = null, camera = null, G = null;
function quality() { const q = Store.get('quality', TOUCH ? 5 : 8); return { level: q, pr: Math.min(devicePixelRatio, q >= 8 ? 2 : q >= 5 ? 1.5 : 1), shadows: q >= 3, shadowMap: q >= 8 ? 2048 : 1024, bloom: q >= 5 }; }
function ensureRenderer() {
  if (renderer) return; renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.domElement.className = 'view'; $('game').prepend(renderer.domElement);
  camera = new THREE.PerspectiveCamera(70, 1, 0.2, 3000);
}
function resize() { if (!renderer || $('game').hidden) return; const q = quality(), w = innerWidth, h = innerHeight; renderer.setPixelRatio(q.pr); renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 78 : 70; camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(q.pr); composer.setSize(w, h); bloom.setSize(w / 2, h / 2); }
  document.documentElement.style.setProperty('--gs', Math.max(0.56, Math.min(1, Math.min(w / 760, h / 640))).toFixed(3)); }
addEventListener('resize', resize);

const loadStep = (t, p) => { $('lText').textContent = t; $('lBar').style.width = Math.round(p * 100) + '%'; return sleep(40); };
async function startGame(g) {
  SFX.unlock(); const th = thumbOf(g.id); const L = $('loading'); L.hidden = false; L.classList.remove('out');
  $('lBg').style.backgroundImage = th ? `url(${th})` : ''; $('lThumb').innerHTML = th ? `<img src="${th}" alt="">` : `<div style="${LIB.coverStyle(g)};width:100%;height:100%;display:grid;place-items:center;font-size:84px">${LIB.genreEmoji(g.genre)}</div>`; $('lTitle').textContent = g.title;
  try {
    await loadStep('Préparation du serveur…', 0.08);
    const full = g.map ? g : (g.id.startsWith('imp-') || g.source === 'saved' ? (await LIB.dbGet(g.id)) || g : g);
    await loadStep('Construction de la carte…', 0.2); const map = LIB.mapOf(full);
    await loadStep('Chargement des pièces…', 0.45); ensureRenderer(); $('game').hidden = false; $('home').hidden = true; $('tabs').hidden = true; resize();
    G = new Game(full, map); await G.load((t, p) => loadStep(t, p));
    await loadStep('Chargement de ton avatar…', 0.92); renderer.compile(G.world.scene, camera); G.render(); await loadStep('C’est parti !', 1);
    if (g.source === 'file' || g.source === 'saved') { const rec = await LIB.dbGet(g.id); if (rec) { rec.playedAt = Date.now(); LIB.dbPut(rec); } }
    else if (g.source !== 'featured') { /* live games: nothing stored */ }
    L.classList.add('out'); setTimeout(() => (L.hidden = true), 650); G.start();
  } catch (e) { console.error(e); L.hidden = true; leaveGame(); toast('❌ Impossible de lancer : ' + (e.message || e), 5000); }
}
function leaveGame() { if (G) { G.dispose(); G = null; } $('game').hidden = true; $('home').hidden = false; $('tabs').hidden = false; showTab('home'); renderHome(); }

class Game {
  constructor(g, map) {
    this.g = g; this.map = map; this.spec = g.spec || null; this.id = g.id; this.t = 0; this.clock = new THREE.Clock(false);
    const def = { values: {}, perClick: this.spec?.train?.perClick || 1, mult: 1, sellMult: 1, capacity: 0, speed: 0, damage: 0, health: 0, owned: {}, rebirths: 0, pets: [], codes: {}, lastDaily: 0, petMult: 1, playtime: 0, stage: 0, auto: false };
    this.save = { ...def, ...Store.get('save.' + this.id, {}) }; this.V = this.save.values;
    if (this.spec) for (const s of [...this.spec.stats, ...this.spec.money]) if (this.V[s.id] == null) this.V[s.id] = s.start || 0;
    this.P = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: false, ground: null, input: new THREE.Vector2(), keyIn: new THREE.Vector2(), jump: false, jumpHeld: false, coyote: 0, yaw: 0, dead: false, airT: 0, climbing: false };
    this.cam = { yaw: Math.PI, pitch: 0.32, dist: 16, target: new THREE.Vector3(), cur: new THREE.Vector3() };
    this.hidden = new Set(); this.cool = new Map(); this.coinsOff = new Map(); this.drops = []; this.bodies = []; this.inZone = new Set(); this.dummies = []; this.fx = []; this.bubbles = [];
    this.tool = null; this.equipped = false; this.boostUntil = 0; this.boostMult = 1; this.cp = null; this.owned = null;
  }
  async load(step) {
    const q = quality(); this.world = new World(renderer, q); const W = this.world;
    // what stays a separate mesh: gameplay parts and the parts tycoon buttons reveal
    const tyc = new Set(); MC.walk(this.map.root, (n) => { if (n.tycoon) MC.walk(n, (x) => { if (!x.children) tyc.add(x.id); }); });
    this.parent = new Map(); MC.walk(this.map.root, (n, p) => { if (p) this.parent.set(n.id, p); });
    W.load(this.map, (p) => !!p.role || !!p.attrs?.ForgeGameZone || !!p.attrs?.ForgeGameBoard || tyc.has(p.id));
    await step('Lumière et ciel…', 0.7); W.lighting(); renderer.toneMappingExposure = 0.95 + W.L.cc.Contrast * 0.6 + (W.isDay ? 0.1 : 0);
    if (q.bloom) { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(W.scene, camera)); bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.85); composer.addPass(bloom); composer.addPass(new OutputPass());
      bloom.strength = 0.12 + W.L.bloom.Intensity * 0.22; bloom.threshold = 0.96; bloom.radius = 0.4; } else { composer = null; bloom = null; }
    resize();
    // gameplay parts
    const parts = MC.partsOf(this.map.root); this.roled = parts.filter((p) => p.role);
    this.coins = this.roled.filter((p) => p.role.type === 'coin'); this.gates = this.roled.filter((p) => p.role.type === 'gate'); this.droppers = this.roled.filter((p) => p.role.type === 'dropper');
    this.dropMats = this.roled.filter((p) => ['conveyor', 'collector', 'upgrader'].includes(p.role.type)); this.zones = parts.filter((p) => p.attrs?.ForgeGameZone);
    this.movers = []; for (const p of this.roled) if (p.role.type === 'mover' || p.role.type === 'spinner') { const m = W.dyn.get(p.id); if (m) this.movers.push({ p, m, origin: m.position.clone(), q0: m.quaternion.clone(), col: W.colliderOf(p.id), followers: [] }); }
    for (const p of this.roled) if (p.follow) { const par = this.parent.get(p.id), tgt = par && par.children.find((c) => c.name === p.follow), d = tgt && this.movers.find((x) => x.p.id === tgt.id), m = W.dyn.get(p.id); if (d && m) d.followers.push({ m, off: m.position.clone().sub(d.origin), col: W.colliderOf(p.id) }); }
    for (const p of this.roled) { const r = p.role.type;
      if (r === 'checkpoint' && this.V.Stage == null) this.V.Stage = 0; if ((r === 'coin' || r === 'gate') && this.V[p.role.stat || 'Coins'] == null) this.V[p.role.stat || 'Coins'] = 0; if (['collector', 'buybutton'].includes(r) && this.V[p.role.stat || 'Cash'] == null) this.V[p.role.stat || 'Cash'] = 0;
      if (r === 'buybutton') { const ty = this.tycoonOf(p.id); let tgt = null; if (ty) MC.walk(ty, (n) => { if (!tgt && n.name === p.role.target && n !== p) tgt = n; }); if (tgt) { this.setHidden(tgt, true); p._target = tgt; } } }
    const sp = parts.find((p) => p.cls === 'SpawnLocation'); this.spawn = sp ? new THREE.Vector3(sp.pos[0], sp.pos[1] + sp.size[1] / 2 + 0.05, sp.pos[2]) : new THREE.Vector3(0, 30, 0);
    if (this.save.stage && this.roled.some((p) => p.role.type === 'checkpoint')) this.cp = this.roled.filter((p) => p.role.type === 'checkpoint' && p.role.stage <= this.save.stage).sort((a, b) => b.role.stage - a.role.stage)[0] || null;
    // tools
    if (this.spec?.train?.tool !== false && this.spec?.train) this.tool = { name: this.spec.train.toolName || 'Entraînement', kind: 'train', e: (this.spec.stats.find((s) => s.id === this.spec.train.stat) || {}).e || '💪', color: '#3a3a46' };
    if (this.spec?.combat) this.sword = { name: 'Épée', kind: 'sword', e: '🗡️', color: '#c9d2e0' };
    // avatar
    this.av = new Avatar(look); W.scene.add(this.av.root); this.nameTag = null;
    if (this.spec?.combat) this.spawnDummies();
    this.board = parts.find((p) => p.attrs?.ForgeGameBoard); if (this.board) { this.boardSprite = null; }
    this.respawn(true); this.cam.cur.copy(this.P.pos).add(new THREE.Vector3(0, 4.5, 0));
    this.buildHUD(); this.bindInput(); this.updatePets();
  }
  start() { this.clock.start(); this.running = true; this.sys(`Bienvenue dans ${this.g.title} !`); if (this.spec?.train) this.sys(`Appuie sur 1 ou sur l’outil « ${this.tool?.name} » puis touche l’écran pour t’entraîner.`); else if (this.roled.some((p) => p.role.type === 'checkpoint')) this.sys('Atteins les drapeaux 🚩 pour sauvegarder ton étape.');
    const loop = () => { if (!this.running) return; this.raf = requestAnimationFrame(loop); this.frame(); }; loop(); this.thumbAt = 1.4; this.saveT = 0; }
  dispose() { this.running = false; cancelAnimationFrame(this.raf); this.persist(); this.unbind?.(); this.world.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); this.av.dispose(); composer = null; $('gui').querySelectorAll('.gpanel').forEach((x) => x.remove()); $('hud').querySelectorAll('.esc,.hatch,.emotes').forEach((x) => x.remove()); }
  persist() { this.save.stage = this.V.Stage || this.save.stage || 0; Store.set('save.' + this.id, this.save); }

  /* ---------------- helpers ---------------- */
  tycoonOf(id) { let p = this.parent.get(id); while (p) { if (p.tycoon) return p; p = this.parent.get(p.id); } return null; }
  setHidden(n, hide) { for (const p of MC.partsOf(n)) { const m = this.world.dyn.get(p.id); if (m) m.visible = !hide; if (hide) this.hidden.add(p.id); else this.hidden.delete(p.id); const l = this.world.labels.get(p.id); if (l) l.visible = !hide; } }
  gateOpen(p) { return (this.V[p.role.stat || 'Coins'] || 0) >= p.role.need; }
  solids() { const s = this.world.near(this.P.pos, 14, this._near || (this._near = new Set())); const out = this._arr || (this._arr = []); out.length = 0;
    for (const m of s) { const p = m.userData.part; if (this.hidden.has(p.id)) continue; if (p.role?.type === 'gate' && this.gateOpen(p)) continue; out.push(m); } return out; }
  mult() { let m = this.save.mult || 1; if (this.spec?.rebirth) m *= 1 + (this.spec.rebirth.bonus || 0.5) * (this.save.rebirths || 0); m *= this.save.petMult || 1; if (Date.now() < this.boostUntil) m *= this.boostMult; return m; }
  add(name, n, at) { this.V[name] = (this.V[name] || 0) + n; this.drawCounters(name); this.drawBoard(); if (n > 0 && at !== false) this.floatText(`+${abbrev(n)} ${this.emojiOf(name)}`, at); }
  emojiOf(id) { const s = this.spec && [...this.spec.stats, ...this.spec.money].find((x) => x.id === id); return s ? s.e : { Coins: '🪙', Cash: '💵', Stage: '🚩', Kills: '⚔️' }[id] || '⭐'; }
  notify(text, kind = 'info') { const c = { good: '#3dd68c', warn: '#ff9f1a', info: '#5aa9ff', bad: '#ff4d6d' }[kind] || '#5aa9ff'; const box = $('gtoast'); const el = document.createElement('div'); el.className = 'gt'; el.style.setProperty('--c', c); el.textContent = text; box.prepend(el);
    while (box.children.length > 3) box.lastChild.remove(); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 360); }, 2400); if (kind === 'warn' || kind === 'bad') SFX.error(); }
  floatText(t, at) { const el = document.createElement('div'); el.className = 'float'; el.textContent = t; let x = innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.25, y = innerHeight * 0.48;
    if (at && at.isVector3) { const v = at.clone().project(camera); x = (v.x * 0.5 + 0.5) * innerWidth; y = (-v.y * 0.5 + 0.5) * innerHeight; } $('floats').appendChild(el); el.style.left = x + 'px'; el.style.top = y + 'px'; setTimeout(() => el.remove(), 1000); }
  cooldown(k, s) { const t = this.cool.get(k) || 0; if (this.t < t) return false; this.cool.set(k, this.t + s); return true; }
  headPos() { return this.P.pos.clone().add(new THREE.Vector3(0, 5.6, 0)); }

  /* ---------------- ForgeGame actions (same rules as ForgeGame.server.lua) ---------------- */
  act(kind, arg) {
    const S = this.spec, d = this.save;
    switch (kind) {
      case 'train': { if (!S?.train || !this.cooldown('train', (S.train.cooldown || 0.2) * 0.8)) return; const st = S.train.stat, cur = this.V[st] || 0; let gain = (d.perClick || 1) * this.mult();
        if (d.capacity > 0 && cur >= d.capacity) { if (this.cooldown('full', 1.5)) this.notify('🎒 Sac plein ! Va vendre.', 'warn'); return; } if (d.capacity > 0) gain = Math.min(gain, d.capacity - cur);
        this.add(st, gain, this.headPos()); SFX.train(); if (this.equipped) this.av.swing(); this.puff(); return; }
      case 'add': { const b = S.buttons.find((x) => x.id === arg); if (!b || !this.cooldown('add' + arg, Math.max(0.1, (b.cooldown || 0.25) * 0.8))) return; if (!this.pay(b.cost)) return; this.add(b.stat, b.amount || 1, this.headPos()); SFX.coin(); return; }
      case 'boost': { const b = S.buttons.find((x) => x.id === arg); if (!b) return; if (Date.now() < this.boostUntil) return this.notify('Un boost est déjà actif', 'warn'); if (!this.pay(b.cost)) return;
        this.boostUntil = Date.now() + (b.duration || 30) * 1000; this.boostMult = b.mult || 2; this.notify(`🚀 Boost ×${b.mult || 2} pendant ${b.duration || 30} s !`, 'good'); SFX.buy(); this.ring('#ff9f1a'); return; }
      case 'sell': { if (!S?.sell || !this.cooldown('sell', 0.5)) return; const amount = this.V[S.sell.from] || 0; if (amount <= 0) return this.notify('Rien à vendre : entraîne-toi d’abord !', 'warn');
        const earned = Math.floor(amount * (S.sell.rate || 1) * (d.sellMult || 1)); if (!S.sell.keep) this.V[S.sell.from] = 0; this.drawCounters(S.sell.from); this.add(S.sell.to, earned, this.headPos()); this.notify(`💰 +${abbrev(earned)} ${S.sell.to}`, 'good'); SFX.sell(); this.ring('#3dd68c'); return; }
      case 'buy': { const it = S.shop.items.find((x) => x.id === arg); if (!it || d.owned[it.id]) return; if ((this.V[it.money] || 0) < it.price) return this.notify(`Il te manque ${abbrev(it.price - (this.V[it.money] || 0))} ${it.money}`, 'warn');
        this.add(it.money, -it.price, false); d.owned[it.id] = true;
        if (it.effect === 'perClick') d.perClick += it.value; else if (it.effect === 'mult') d.mult *= it.value; else if (it.effect === 'sellMult') d.sellMult *= it.value; else if (it.effect === 'capacity') d.capacity = (d.capacity || 0) + it.value * 100;
        else if (it.effect === 'damage') d.damage = (d.damage || 0) + it.value; else if (it.effect === 'health') d.health = (d.health || 0) + it.value; else if (it.effect === 'speed') d.speed = (d.speed || 0) + it.value;
        this.notify('✅ ' + it.name + ' acheté !', 'good'); SFX.buy(); this.persist(); return true; }
      case 'rebirth': { const r = S?.rebirth; if (!r) return; const cost = this.rebirthCost(); if ((this.V[r.costStat] || 0) < cost) return this.notify(`Rebirth : il faut ${abbrev(cost)} ${r.costStat}`, 'warn');
        for (const s of [...S.stats, ...S.money]) this.V[s.id] = s.start || 0; d.rebirths += 1; this.V.Rebirths = d.rebirths; this.drawCounters(); this.notify(`🔁 Rebirth ${d.rebirths} ! Gains ×${this.mult().toFixed(1)}`, 'good'); SFX.rebirth(); this.rebirthFX(); this.persist(); return true; }
      case 'egg': return this.hatchEgg();
      case 'daily': { if (!S?.daily) return; const left = d.lastDaily + 20 * 3600e3 - Date.now(); if (left > 0) return this.notify(`🎁 Reviens dans ${Math.ceil(left / 3600e3)} h`, 'warn'); d.lastDaily = Date.now(); this.add(S.daily.money, S.daily.amount, this.headPos()); this.notify(`🎁 +${abbrev(S.daily.amount)} ${S.daily.money}`, 'good'); SFX.buy(); this.persist(); return; }
      case 'code': { const want = String(arg || '').replace(/\s/g, '').toUpperCase(); const c = (S?.codes || []).find((x) => x.code === want); if (!c) return this.notify('Code invalide', 'warn'); if (d.codes[want]) return this.notify('Code déjà utilisé', 'warn');
        d.codes[want] = true; this.add(c.money, c.amount, this.headPos()); this.notify(`🎟️ Code ${want} : +${abbrev(c.amount)} ${c.money}`, 'good'); SFX.buy(); this.persist(); return true; }
      case 'home': { this.P.pos.copy(this.spawn).add(new THREE.Vector3(0, 0.2, 0)); this.P.vel.set(0, 0, 0); SFX.tp(); this.ring('#5aa9ff'); return; }
      case 'auto': { d.auto = !d.auto; this.renderButtons(); this.notify(d.auto ? '🤖 Auto-entraînement activé' : '🤖 Auto-entraînement coupé', 'info'); return; }
      default: return;
    }
  }
  pay(cost) { if (!cost) return true; if ((this.V[cost.money] || 0) < cost.amount) { this.notify(`Il te manque ${abbrev(cost.amount - (this.V[cost.money] || 0))} ${cost.money}`, 'warn'); return false; } this.add(cost.money, -cost.amount, false); return true; }
  rebirthCost() { const r = this.spec.rebirth; return Math.floor(r.cost * (r.growth || 2.5) ** (this.save.rebirths || 0)); }

  /* ---------------- HUD ---------------- */
  buildHUD() {
    const S = this.spec; this.counterIds = S ? [...S.stats.map((s) => s.id), ...S.money.map((m) => m.id), ...(S.rebirth ? ['Rebirths'] : [])] : [];
    for (const k of Object.keys(this.V)) if (!this.counterIds.includes(k) && k !== 'Rebirths') this.counterIds.push(k);
    if (S && S.genre === 'obby' && this.counterIds.includes('Stage')) this.counterIds = ['Stage', ...this.counterIds.filter((k) => k !== 'Stage')];
    if (S?.rebirth) this.V.Rebirths = this.save.rebirths;
    const COL = ['#ff5c5c', '#5aa9ff', '#3dd68c', '#b46bff', '#ffb02e'];
    $('counters').innerHTML = this.counterIds.map((id, i) => { const isM = S && S.money.some((m) => m.id === id), c = id === 'Rebirths' ? '#b46bff' : isM ? (id === 'Gems' ? '#3ee6ff' : '#ffc02e') : COL[i % COL.length];
      return `<div class="cnt" data-c="${esc(id)}" style="--c:${c}"><span class="ce">${id === 'Rebirths' ? '🔁' : this.emojiOf(id)}</span><span class="cv">0</span></div>`; }).join('');
    this.drawCounters(); this.renderButtons(); this.drawLB(); this.renderHotbar();
    $('chatLog').innerHTML = ''; document.body.classList.toggle('chatoff', !Store.get('chatOpen', !TOUCH));
  }
  drawCounters(only) { for (const el of $('counters').children) { const id = el.dataset.c; if (only && only !== id) continue; let v = this.V[id] || 0; if (id === this.spec?.train?.stat && this.save.capacity > 0) { el.querySelector('.cv').textContent = abbrev(v) + ' / ' + abbrev(this.save.capacity); } else el.querySelector('.cv').textContent = abbrev(v);
      if (only) { el.classList.add('bump'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('bump'), 160); } } if (!only || this.lbCols?.includes(only)) this.drawLB(); }
  buttons() { const S = this.spec; if (!S) return [];
    const extra = [...(S.daily ? [{ id: '_daily', label: '🎁 Cadeau', color: '#ff7ab6', action: 'daily' }] : []), ...(S.codes?.length ? [{ id: '_codes', label: '🎟️ Codes', color: '#5aa9ff', action: 'codes' }] : []),
      ...(S.eggs && !S.buttons.some((b) => b.action === 'egg') ? [{ id: '_egg', label: '🥚 Œufs', color: '#ff7ab6', action: 'egg' }] : []), ...(S.autoTrain ? [{ id: '_auto', label: '🤖 Auto : ' + (this.save.auto ? 'ON' : 'OFF'), color: this.save.auto ? '#3dd68c' : '#6b7280', action: 'auto' }] : [])];
    return [...S.buttons, ...extra]; }
  renderButtons() { const list = this.buttons(); $('gbtns').innerHTML = list.map((b) => `<button class="gb" data-b="${esc(b.id)}" style="--c:${esc(b.color)}">${esc(b.label)}</button>`).join('');
    $('gbtns').querySelectorAll('[data-b]').forEach((el) => { const b = list.find((x) => x.id === el.dataset.b);
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); SFX.click(); el.classList.add('press'); setTimeout(() => el.classList.remove('press'), 140);
        if (b.action === 'shop') this.panelShop(); else if (b.action === 'rebirth') this.panelRebirth(); else if (b.action === 'egg') this.panelEggs(); else if (b.action === 'codes') this.panelCodes(); else if (b.action === 'add' || b.action === 'boost') this.act(b.action, b.id); else this.act(b.action); }); }); }
  drawLB() { const S = this.spec; this.lbCols = S ? [...S.stats.filter((s) => s.id !== 'Kills' || S.combat).map((s) => s.id), ...S.money.map((m) => m.id), ...(S.rebirth ? ['Rebirths'] : [])].slice(0, innerWidth < 600 ? 2 : 4) : Object.keys(this.V).slice(0, innerWidth < 600 ? 2 : 3);
    const lb = $('lb'); if (!lb) return; lb.innerHTML = `<table><tr><th>${this.lbCols.length ? 'Joueurs' : 'Joueurs'}</th>${this.lbCols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>
      <tr class="you"><td><i style="background-image:url(${meShot})"></i>${esc(look.name)}</td>${this.lbCols.map((c) => `<td>${abbrev(this.V[c] || 0)}</td>`).join('')}</tr>
      ${this.dummies.length ? this.dummies.map((d) => `<tr><td><i style="background:#888"></i>${esc(d.name)} <small style="color:#999">(PNJ)</small></td>${this.lbCols.map(() => '<td>—</td>').join('')}</tr>`).join('') : ''}</table>`; }
  renderHotbar() { const tools = [this.tool, this.sword].filter(Boolean); this.tools = tools;
    $('hotbar').innerHTML = tools.map((t, i) => `<button class="slot${this.equipped === t ? ' on' : ''}" data-t="${i}"><i>${i + 1}</i>${t.e}<span>${esc(t.name)}</span></button>`).join('');
    $('hotbar').querySelectorAll('[data-t]').forEach((b) => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.equip(this.tools[+b.dataset.t]); })); }
  equip(t) { SFX.click(); this.equipped = this.equipped === t ? false : t; this.av.state.tool = !!this.equipped; this.av.holdTool(this.equipped ? { kind: this.equipped.kind, color: this.equipped.color } : null); this.renderHotbar(); }
  activate() { if (!this.equipped || this.P.dead) return; if (this.equipped.kind === 'train') this.act('train'); else if (this.cooldown('sword', 0.55)) { this.av.swing(); SFX.swing(); setTimeout(() => this.swordHit(), 140); } }

  /* panels: same layout as the ForgeGame client GUI */
  panel(title, color, html) { $('gui').querySelectorAll('.gpanel').forEach((x) => x.remove()); const p = document.createElement('div'); p.className = 'gpanel'; p.style.setProperty('--c', color);
    p.innerHTML = `<h4>${title}</h4><button class="gx" aria-label="Fermer">✕</button><div class="gbody">${html}</div>`; $('gui').appendChild(p);
    p.querySelector('.gx').onclick = () => { SFX.click(); p.classList.add('out'); setTimeout(() => p.remove(), 240); }; p.addEventListener('pointerdown', (e) => e.stopPropagation()); return p; }
  panelShop() { const S = this.spec; if (!S?.shop) return; const EF = { perClick: '+%s par clic', mult: '×%s gains', sellMult: '×%s vente', capacity: '+%s00 sac', speed: '+%s vitesse', damage: '+%s dégâts', health: '+%s vie' };
    const draw = () => { const p = this.panel('🛒 Boutique', '#ffb02e', `<div class="items">${S.shop.items.map((it) => { const own = this.save.owned[it.id], can = (this.V[it.money] || 0) >= it.price;
      return `<div class="item"><span class="ie">${it.e || '⭐'}</span><b>${esc(it.name)}</b><small>${(EF[it.effect] || '%s').replace('%s', it.value)}</small><button class="gbuy" data-buy="${esc(it.id)}" ${own ? 'disabled' : ''} style="${own ? '' : can ? '' : 'background:#e5484d'}">${own ? '✓ Acheté' : abbrev(it.price) + ' ' + this.emojiOf(it.money)}</button></div>`; }).join('')}</div>`);
      p.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => { if (this.act('buy', b.dataset.buy)) { const sc = p.querySelector('.gbody').scrollTop; draw(); $('gui').querySelector('.gpanel .gbody').scrollTop = sc; } })); };
    draw(); }
  panelRebirth() { const S = this.spec; if (!S?.rebirth) return; const r = S.rebirth, cost = this.rebirthCost(), have = this.V[r.costStat] || 0;
    const p = this.panel('🔁 Rebirth', '#b46bff', `<div class="gtxt">Rebirth ${this.save.rebirths + 1}<br>Il faut ${abbrev(cost)} ${r.costStat} (tu as ${abbrev(have)})<br>Gains : ×${(1 + r.bonus * this.save.rebirths).toFixed(1)} → ×${(1 + r.bonus * (this.save.rebirths + 1)).toFixed(1)}<br><span style="color:#ffe08a;font-size:16px">tes stats et ton argent repartent de zéro</span></div><button class="gbuy gbig" id="doReb" ${have >= cost ? '' : 'style="background:#e5484d"'}>🔁 Faire un rebirth</button>`);
    p.querySelector('#doReb').onclick = () => { if (this.act('rebirth')) p.querySelector('.gx').click(); }; }
  panelEggs() { const E = this.spec?.eggs; if (!E) return; const tot = E.pets.reduce((s, x) => s + x.w, 0);
    const p = this.panel('🥚 Œufs', '#ff7ab6', `<div class="odds">${E.pets.map((x) => `<div><img src="${petImage(x.name)}" alt=""><span>${esc(x.name)} <em>×${x.mult}</em></span><b>${(x.w / tot * 100).toFixed(x.w / tot < 0.1 ? 1 : 0)} %</b></div>`).join('')}</div>
      <button class="gbuy gbig" id="hatchGo">🥚 Ouvrir · ${abbrev(E.price)} ${this.emojiOf(E.money)}</button>${this.save.pets.length ? `<div class="gtxt" style="margin:12px 0 0;font-size:17px">Tes pets (${this.save.pets.length})</div><div class="pets">${this.save.pets.slice(-24).map((n) => `<img src="${petImage(n)}" alt="${esc(n)}" title="${esc(n)}">`).join('')}</div>` : ''}`);
    p.querySelector('#hatchGo').onclick = () => { if ((this.V[E.money] || 0) < E.price) return this.notify(`Œuf : il faut ${abbrev(E.price)} ${E.money}`, 'warn'); p.remove(); this.hatchEgg(); }; }
  panelCodes() { const p = this.panel('🎟️ Codes', '#5aa9ff', `<input class="ginput" id="codeIn" maxlength="30" placeholder="Entre un code…" autocomplete="off"><button class="gbuy gbig" id="codeGo">Valider</button>`);
    const go = () => { if (this.act('code', p.querySelector('#codeIn').value)) p.querySelector('.gx').click(); }; p.querySelector('#codeGo').onclick = go; p.querySelector('#codeIn').onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); }; }

  /* egg hatch: casino-style reveal */
  hatchEgg() {
    const E = this.spec?.eggs, d = this.save; if (!E || this.hatching) return; if ((this.V[E.money] || 0) < E.price) return this.notify(`Œuf : il faut ${abbrev(E.price)} ${E.money}`, 'warn'); if (d.pets.length >= 60) return this.notify('Inventaire de pets plein', 'warn');
    this.add(E.money, -E.price, false); const tot = E.pets.reduce((s, x) => s + x.w, 0); let roll = Math.random() * tot, pick = E.pets[E.pets.length - 1]; for (const p of E.pets) { roll -= p.w; if (roll <= 0) { pick = p; break; } }
    d.pets.push(pick.name); d.petMult = Math.max(1, ...d.pets.map((n) => (E.pets.find((p) => p.name === n) || { mult: 1 }).mult)); this.persist();
    const ch = pick.w / tot, R = ch <= 0.02 ? [3, 'LÉGENDAIRE', '#ffcc33'] : ch <= 0.08 ? [2, 'ÉPIQUE', '#b46bff'] : ch <= 0.25 ? [1, 'RARE', '#3ea6ff'] : [0, 'COMMUN', '#9aa3b2'];
    this.hatching = true; const h = document.createElement('div'); h.className = 'hatch'; h.style.setProperty('--rc', R[2]); const pal = [['#fff6d8', '#ffb3d9'], ['#e1f4ff', '#7cc6ff'], ['#f2e1ff', '#b46bff'], ['#fff3c4', '#ffb02e']][R[0]];
    h.innerHTML = `<div class="rays"></div><div class="egg" style="--ec1:${pal[0]};--ec2:${pal[1]}"><svg viewBox="0 0 150 190" fill="none" stroke="#14101f" stroke-width="4" stroke-linejoin="round"><path class="k1" d="M30 95 L52 82 L64 100 L80 84 L94 102"/><path class="k2" d="M94 102 L110 88 L122 104"/><path class="k3" d="M64 100 L58 125 M80 84 L86 60"/></svg></div>
      <div class="petr"><img src="${petImage(pick.name)}" alt=""></div><div class="hname"><b>${esc(pick.name)}</b><em>${R[1]}</em><small>×${pick.mult} gains · ${(ch * 100).toFixed(ch < 0.1 ? 1 : 0)} %</small></div><div class="tap">Touche pour continuer</div>`;
    $('hud').appendChild(h); const egg = h.querySelector('.egg');
    // shake crescendo (3 cracks), then burst
    const shakes = [[0, 2, 120], [520, 3, 110], [980, 4, 95], [1380, 6, 80], [1720, 8, 70], [2000, 11, 60]];
    shakes.forEach(([at, amp, dur], i) => setTimeout(() => { SFX.shake(i / 2); egg.animate([{ transform: 'rotate(0)' }, { transform: `rotate(${-amp * 2}deg) translateX(${-amp}px)` }, { transform: `rotate(${amp * 2}deg) translateX(${amp}px)` }, { transform: 'rotate(0)' }], { duration: dur * 3, easing: 'ease-in-out' });
      if (i === 2) egg.classList.add('c1'); if (i === 4) { egg.classList.remove('c1'); egg.classList.add('c2'); } if (i === 5) { egg.classList.remove('c2'); egg.classList.add('c3'); } }, at));
    setTimeout(() => { egg.classList.add('boom'); const f = $('flash'); f.style.transition = 'none'; f.style.opacity = 0.95; requestAnimationFrame(() => { f.style.transition = 'opacity .7s'; f.style.opacity = 0; }); SFX.hatch(R[0]); h.classList.add('reveal');
      for (let i = 0; i < 28 + R[0] * 14; i++) { const s = document.createElement('i'); s.className = 'spark'; h.appendChild(s); const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 260;
        s.animate([{ transform: 'translate(-50%,-50%) scale(1) rotate(0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * r - 5}px,${Math.sin(a) * r - 5}px) scale(.2) rotate(${Math.random() * 720}deg)`, opacity: 0 }], { duration: 900 + Math.random() * 700, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }); }
      this.notify(`🥚 Tu obtiens ${pick.name} (×${pick.mult}) !`, 'good'); this.updatePets(); }, 2350);
    const close = () => { if (!h.classList.contains('reveal')) return; h.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).onfinish = () => { h.remove(); this.hatching = false; }; };
    h.addEventListener('pointerdown', (e) => { e.stopPropagation(); close(); }); setTimeout(close, 6500);
  }
  updatePets() { const W = this.world; (this.petObjs || []).forEach((p) => W.scene.remove(p.g)); this.petObjs = [];
    const E = this.spec?.eggs; if (!E) return; const best = [...this.save.pets].sort((a, b) => ((E.pets.find((p) => p.name === b) || {}).mult || 0) - ((E.pets.find((p) => p.name === a) || {}).mult || 0)).slice(0, 3);
    best.forEach((n, i) => { const g = petMesh(n, voxMat); g.scale.setScalar(1.15); g.position.copy(this.P.pos); W.scene.add(g); this.petObjs.push({ g, i, ph: Math.random() * 6 }); }); }

  /* ---------------- effects ---------------- */
  ring(color) { const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(this.P.pos).add(new THREE.Vector3(0, 0.15, 0)); this.world.scene.add(m); this.fx.push({ m, t: 0, life: 0.7, kind: 'ring' }); }
  puff() { for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe08a').multiplyScalar(1.8), transparent: true })); m.position.copy(this.P.pos).add(new THREE.Vector3((Math.random() - 0.5) * 2, 3 + Math.random() * 2, (Math.random() - 0.5) * 2));
    this.world.scene.add(m); this.fx.push({ m, t: 0, life: 0.6, kind: 'puff', v: new THREE.Vector3((Math.random() - 0.5) * 6, 6 + Math.random() * 4, (Math.random() - 0.5) * 6) }); } }
  rebirthFX() { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = 0.8; requestAnimationFrame(() => { f.style.transition = 'opacity 1s'; f.style.opacity = 0; });
    for (let k = 0; k < 4; k++) setTimeout(() => this.ring('#b46bff'), k * 120); const col = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#c79bff').multiplyScalar(2), transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    col.position.copy(this.P.pos).add(new THREE.Vector3(0, 30, 0)); this.world.scene.add(col); this.fx.push({ m: col, t: 0, life: 1.4, kind: 'beam' }); }
  forceField() { const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#8fd3ff').multiplyScalar(1.6), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 40; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), mat); s.userData.a = Math.random() * 6.3; s.userData.h = Math.random() * 5.6; s.userData.r = 1.6 + Math.random() * 0.6; g.add(s); }
    this.world.scene.add(g); this.fx.push({ m: g, t: 0, life: 3, kind: 'ff' }); }
  tickFX(dt) { for (const f of [...this.fx]) { f.t += dt; const k = f.t / f.life; if (k >= 1) { this.world.scene.remove(f.m); f.m.traverse?.((o) => o.geometry?.dispose()); this.fx.splice(this.fx.indexOf(f), 1); continue; }
    if (f.kind === 'ring') { const s = 1 + k * 9; f.m.scale.set(s, s, s); f.m.material.opacity = 1 - k; f.m.position.copy(this.P.pos).add(new THREE.Vector3(0, 0.15, 0)); }
    else if (f.kind === 'puff') { f.v.y -= 30 * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.x += dt * 8; f.m.material.opacity = 1 - k; f.m.scale.setScalar(1 - k * 0.6); }
    else if (f.kind === 'beam') { f.m.scale.set(1 + k * 2, 1, 1 + k * 2); f.m.material.opacity = 0.7 * (1 - k); f.m.position.x = this.P.pos.x; f.m.position.z = this.P.pos.z; }
    else if (f.kind === 'ff') { f.m.position.copy(this.P.pos); f.m.children.forEach((s, i) => { const a = s.userData.a + this.t * (1.5 + (i % 3) * 0.5); s.position.set(Math.cos(a) * s.userData.r, (s.userData.h + this.t * 2) % 5.8, Math.sin(a) * s.userData.r); s.scale.setScalar(0.6 + 0.6 * Math.sin(this.t * 10 + i)); }); f.m.children[0].material.opacity = 0.7 * (1 - Math.max(0, k - 0.7) / 0.3); } } }

  /* ---------------- combat: training dummies ---------------- */
  spawnDummies() { const names = ['Mannequin', 'Rival', 'Garde']; for (let i = 0; i < 3; i++) { const a = new Avatar({ name: names[i], skin: '#a3a2a5', shirt: ['#7a7f8a', '#8a5a5a', '#5a6a8a'][i], pants: '#4a4d55', shoes: '#2b2d33', face: i === 1 ? 'malin' : 'sourire', hat: i === 2 ? 'chapeau' : 'aucun', hatColor: '#e8423f' });
    const d = { av: a, name: names[i], hp: 100, max: 100, home: this.spawn.clone().add(new THREE.Vector3(-10 + i * 10, 0, -16)), dead: false, t: Math.random() * 5 }; a.root.position.copy(d.home); this.world.scene.add(a.root);
    d.tag = this.makeTag(d.name, 1); this.world.scene.add(d.tag); this.dummies.push(d); } }
  makeTag(name, hp) { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); s.scale.set(6, 1.5, 1); s.userData.c = c; this.drawTag(s, name, hp); return s; }
  drawTag(s, name, hp) { const c = s.userData.c, g = c.getContext('2d'); g.clearRect(0, 0, 512, 128); g.font = '700 50px "F-Mont",system-ui,sans-serif'; g.textAlign = 'center'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(name, 256, 52); g.fillStyle = '#fff'; g.fillText(name, 256, 52);
    if (hp < 1) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(96, 78, 320, 26); g.fillStyle = hp > 0.5 ? '#3dd68c' : hp > 0.25 ? '#ffb02e' : '#ff4d4d'; g.fillRect(100, 82, 312 * Math.max(0, hp), 18); } s.material.map.colorSpace = THREE.SRGBColorSpace; s.material.map.needsUpdate = true; }
  swordHit() { const C = this.spec.combat, fwd = new THREE.Vector3(Math.sin(this.av.root.rotation.y + Math.PI), 0, Math.cos(this.av.root.rotation.y + Math.PI));
    for (const d of this.dummies) { if (d.dead) continue; const to = d.av.root.position.clone().sub(this.P.pos); to.y = 0; const dist = to.length(); if (dist > (C.range || 7) || to.normalize().dot(fwd) < 0.2) continue;
      const dmg = (C.damage || 20) + (this.save.damage || 0); d.hp -= dmg; SFX.hit(); this.floatText('-' + dmg, d.av.root.position.clone().add(new THREE.Vector3(0, 6, 0))); d.knock = to.multiplyScalar(14); d.av.state.land = 0.6; this.drawTag(d.tag, d.name, d.hp / d.max);
      if (d.hp <= 0) { d.dead = true; this.bodies.push(...d.av.breakApart(this.world.scene, d.knock).map((b) => ({ ...b, life: 3 }))); d.tag.visible = false; this.add('Kills', 1, false); const rw = Math.floor((C.reward || 25) * this.mult()); this.add(C.money || 'Coins', rw, d.av.root.position.clone().add(new THREE.Vector3(0, 5, 0)));
        this.notify(`⚔️ ${d.name} vaincu ! +${abbrev(rw)} ${C.money}`, 'good'); SFX.die(); setTimeout(() => { d.av.dispose(); this.world.scene.remove(d.av.root); const na = new Avatar(d.av.look); na.root.position.copy(d.home); this.world.scene.add(na.root); d.av = na; d.hp = d.max; d.dead = false; d.tag.visible = true; this.drawTag(d.tag, d.name, 1); }, 4000); } } }
  tickDummies(dt) { for (const d of this.dummies) { if (d.dead) continue; d.t += dt; const r = d.av.root; if (d.knock) { r.position.addScaledVector(d.knock, dt); d.knock.multiplyScalar(Math.max(0, 1 - dt * 6)); if (d.knock.lengthSq() < 0.1) d.knock = null; }
    const to = d.home.clone().sub(r.position); to.y = 0; const wander = new THREE.Vector3(Math.sin(d.t * 0.4) * 5, 0, Math.cos(d.t * 0.3) * 4).add(d.home).sub(r.position); wander.y = 0; const goal = to.length() > 12 ? to : wander;
    const sp = goal.length() > 1.2 ? 7 : 0; if (sp) { goal.normalize(); r.position.addScaledVector(goal, sp * dt); const yaw = Math.atan2(-goal.x, -goal.z); r.rotation.y += (((yaw - r.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 6); }
    d.av.state.speed = sp; d.av.state.grounded = true; d.av.update(dt); d.tag.position.copy(r.position).add(new THREE.Vector3(0, 6.6, 0)); } }

  /* ---------------- input ---------------- */
  bindInput() {
    const game = $('game'), P = this.P, C = this.cam, ptr = new Map(); let stickId = null, stickC = null, pinch = null; const offs = [];
    const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
    const sens = () => Store.get('sens', 1);
    on(game, 'pointerdown', (e) => {
      if (e.target.closest('button,input,form,.gpanel,.esc,.hatch,.chat,.lb,.emotes')) return; SFX.unlock();
      const inStick = TOUCH && e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.45;
      if (inStick && stickId == null) { stickId = e.pointerId; stickC = [e.clientX, e.clientY]; const s = $('stick'); s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px'; s.classList.add('on'); game.setPointerCapture(e.pointerId); return; }
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: 0 }); game.setPointerCapture(e.pointerId);
      if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: C.dist }; }
    });
    on(game, 'pointermove', (e) => {
      if (e.pointerId === stickId) { let dx = e.clientX - stickC[0], dy = e.clientY - stickC[1]; const l = Math.hypot(dx, dy), mx = 52; if (l > mx) { dx *= mx / l; dy *= mx / l; } $('knob').style.transform = `translate(${dx}px,${dy}px)`; P.input.set(dx / mx, dy / mx); return; }
      const p = ptr.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; p.moved += Math.abs(dx) + Math.abs(dy);
      if (ptr.size === 2 && pinch) { const [a, b] = [...ptr.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); C.dist = Math.max(4, Math.min(60, pinch.dist * pinch.d / Math.max(20, d))); return; }
      if (ptr.size === 1 && (e.pointerType !== 'mouse' || e.buttons)) { C.yaw -= dx * 0.0065 * sens(); C.pitch = Math.max(-1.25, Math.min(1.35, C.pitch + dy * 0.005 * sens())); }
    });
    const up = (e) => { if (e.pointerId === stickId) { stickId = null; P.input.set(0, 0); $('knob').style.transform = ''; $('stick').classList.remove('on'); placeStick(); return; }
      const p = ptr.get(e.pointerId); if (!p) return; ptr.delete(e.pointerId); if (ptr.size < 2) pinch = null; if (p.moved < 10 && performance.now() - p.t < 350) this.activate(); };
    on(game, 'pointerup', up); on(game, 'pointercancel', up);
    const placeStick = () => { const s = $('stick'); s.style.left = (88 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sal')) || 0)) + 'px'; s.style.top = (innerHeight - 120) + 'px'; }; placeStick();
    on(game, 'wheel', (e) => { e.preventDefault(); C.dist = Math.max(4, Math.min(60, C.dist * (1 + Math.sign(e.deltaY) * 0.12))); }, { passive: false });
    on(game, 'contextmenu', (e) => e.preventDefault());
    const jb = $('jumpBtn'); on(jb, 'pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); P.jumpHeld = true; P.jump = true; jb.classList.add('on'); }); const jup = () => { P.jumpHeld = false; jb.classList.remove('on'); }; on(jb, 'pointerup', jup); on(jb, 'pointercancel', jup); on(jb, 'pointerleave', jup);
    const keys = new Set(); const kupd = () => { P.keyIn.set((keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('q') || keys.has('arrowleft') ? 1 : 0), (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('z') || keys.has('arrowup') ? 1 : 0)); };
    on(window, 'keydown', (e) => { if (e.target.closest && e.target.closest('input')) return; const k = e.key.toLowerCase();
      if (k === 'escape') { e.preventDefault(); return this.menu(); } if (this.paused) { if (k === 'r') this.reset(); if (k === 'l') leaveGame(); return; }
      if (k === '/') { e.preventDefault(); document.body.classList.remove('chatoff'); $('chatIn').focus(); return; }
      if (k === ' ') { e.preventDefault(); if (!P.jumpHeld) P.jump = true; P.jumpHeld = true; } if (k === '1' && this.tools?.[0]) this.equip(this.tools[0]); if (k === '2' && this.tools?.[1]) this.equip(this.tools[1]);
      if (k === 'e' && this.spec?.train) this.act('train'); if (k === 'i') C.dist = Math.max(4, C.dist * 0.8); if (k === 'o') C.dist = Math.min(60, C.dist * 1.25); keys.add(k); kupd(); });
    on(window, 'keyup', (e) => { const k = e.key.toLowerCase(); keys.delete(k); if (k === ' ') P.jumpHeld = false; kupd(); });
    on(window, 'blur', () => { keys.clear(); kupd(); P.jumpHeld = false; });
    on(document, 'visibilitychange', () => { if (document.hidden) this.persist(); });
    // topbar
    $('menuBtn').onclick = () => { SFX.click(); this.menu(); };
    $('chatBtn').onclick = () => { SFX.click(); const off = !document.body.classList.toggle('chatoff'); Store.set('chatOpen', off); $('chatDot').hidden = true; };
    $('emoteBtn').onclick = (e) => { e.stopPropagation(); SFX.click(); this.emoteMenu(); };
    $('chatForm').onsubmit = (e) => { e.preventDefault(); const t = $('chatIn').value.trim(); $('chatIn').value = ''; $('chatIn').blur(); if (t) this.say(t); };
    $('chatIn').onkeydown = (e) => e.stopPropagation();
    this.unbind = () => offs.forEach((f) => f());
  }
  emoteMenu() { const old = $('hud').querySelector('.emotes'); if (old) return old.remove(); const m = document.createElement('div'); m.className = 'emotes';
    Object.assign(m.style, { position: 'absolute', left: 'max(10px, env(safe-area-inset-left))', top: 'calc(env(safe-area-inset-top) + 60px)', display: 'flex', gap: '6px', padding: '6px', borderRadius: '12px', background: 'rgba(18,18,21,.75)', zIndex: 8 });
    m.innerHTML = [['wave', '👋 Saluer'], ['dance', '🕺 Danser'], ['point', '👉 Pointer']].map(([k, l]) => `<button data-e="${k}" style="border:0;border-radius:9px;padding:10px 12px;background:rgba(255,255,255,.12);font-weight:800">${l}</button>`).join('');
    $('hud').appendChild(m); m.querySelectorAll('[data-e]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); this.av.emote(b.dataset.e); m.remove(); })); }

  /* chat + bubbles */
  sys(t) { this.chatLine(`<b style="color:#ffd45c">[Système]</b> ${esc(t)}`); }
  chatLine(html) { const log = $('chatLog'), d = document.createElement('div'); d.innerHTML = html; log.appendChild(d); while (log.children.length > 60) log.firstChild.remove(); log.scrollTop = log.scrollHeight; if (document.body.classList.contains('chatoff')) $('chatDot').hidden = false; }
  say(t) { const cmd = t.match(/^\/e\s+(\w+)/i); if (cmd) { const k = { wave: 'wave', saluer: 'wave', dance: 'dance', danse: 'dance', danser: 'dance', point: 'point' }[cmd[1].toLowerCase()]; if (k) this.av.emote(k); return; }
    if (/^\/(reset|r)$/i.test(t)) return this.reset();
    this.chatLine(`<b style="color:#7fb2ff">${esc(look.name)}:</b> ${esc(t)}`); SFX.chat(); this.bubble(t); }
  bubble(text) { const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = '600 40px "F-Mont",system-ui,sans-serif'; const words = text.split(/\s+/), lines = []; let cur = '';
    for (const w of words) { const n = cur ? cur + ' ' + w : w; if (g.measureText(n).width > 560 && cur) { lines.push(cur); cur = w; } else cur = n; } lines.push(cur); const L = lines.slice(0, 4), W = Math.min(620, Math.max(...L.map((l) => g.measureText(l).width)) + 56), H = L.length * 48 + 44;
    c.width = 640; c.height = H + 30; g.font = '600 40px "F-Mont",system-ui,sans-serif'; const x0 = (640 - W) / 2; g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x0, 4, W, H, 26); g.fill(); g.beginPath(); g.moveTo(300, H + 2); g.lineTo(320, H + 26); g.lineTo(340, H + 2); g.fill();
    g.fillStyle = '#1b1b1f'; g.textAlign = 'center'; L.forEach((l, i) => g.fillText(l, 320, 54 + i * 48)); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.renderOrder = 10; const sc = 0.016; s.scale.set(640 * sc, c.height * sc, 1); s.center.set(0.5, 0);
    this.bubbles.forEach((b) => (b.lift += c.height * sc + 0.2)); this.bubbles.push({ s, t: 0, lift: 0 }); this.world.scene.add(s); if (this.bubbles.length > 3) { const o = this.bubbles.shift(); this.world.scene.remove(o.s); } }

  /* Esc menu (Players · Settings · Help) */
  menu(tab = 'players') {
    const old = $('hud').querySelector('.esc'); if (old) { old.remove(); this.paused = false; return; } this.paused = true; const m = document.createElement('div'); m.className = 'esc'; $('hud').appendChild(m);
    const draw = () => { const q = Store.get('quality', TOUCH ? 5 : 8);
      m.innerHTML = `<div class="etabs">${[['players', 'Joueurs'], ['settings', 'Paramètres'], ['help', 'Aide']].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div class="ebody">${
        tab === 'players' ? `<div class="prow"><i style="background-image:url(${meShot})"></i><b>${esc(look.name)}<small>@${esc(look.name.toLowerCase().replace(/\s+/g, ''))} · toi</small></b></div>${this.dummies.map((d) => `<div class="prow"><i style="background:#888"></i><b>${esc(d.name)}<small>personnage non-joueur</small></b></div>`).join('')}<div class="help">Serveur solo : ce jeu tourne entièrement sur ton appareil. Ta progression est sauvegardée automatiquement.</div>`
        : tab === 'settings' ? `<div class="set"><b>Qualité graphique</b><input type="range" min="1" max="10" value="${q}" id="sQ"><span style="width:22px;text-align:right">${q}</span></div>
          <div class="set"><b>Sensibilité de la caméra</b><input type="range" min="0.3" max="2.5" step="0.1" value="${Store.get('sens', 1)}" id="sS"></div>
          <div class="set"><b>Volume</b><input type="range" min="0" max="1" step="0.05" value="${Store.get('vol', 0.7)}" id="sV"></div>
          <div class="set"><b>Afficher les FPS</b><button class="tog${Store.get('fps', false) ? ' on' : ''}" id="sF" aria-label="FPS"></button></div>
          <div class="set"><b>Discussion ouverte</b><button class="tog${!document.body.classList.contains('chatoff') ? ' on' : ''}" id="sC" aria-label="Discussion"></button></div>`
        : `<div class="help"><b>Téléphone</b> : pouce gauche = joystick, bouton ⌃ = sauter, glisse ailleurs pour tourner la caméra, pince pour zoomer, touche l’écran pour utiliser l’outil.<br><b>PC</b> : <kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> ou <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> bouger · <kbd>Espace</kbd> sauter · souris = caméra · molette = zoom · <kbd>1</kbd> outil · clic = utiliser · <kbd>E</kbd> s’entraîner · <kbd>/</kbd> discuter · <kbd>Échap</kbd> menu.<br>Commandes de chat : <kbd>/e wave</kbd> <kbd>/e dance</kbd> <kbd>/e point</kbd> <kbd>/reset</kbd></div>`}</div>
        <div class="eacts"><button class="res" id="eRes">Réinitialiser<small>R</small></button><button class="quit" id="eQuit">Quitter<small>L</small></button><button id="eBack">Reprendre<small>Échap</small></button></div>`;
      m.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
      m.querySelector('#eRes').onclick = () => { m.remove(); this.paused = false; this.reset(); }; m.querySelector('#eQuit').onclick = () => leaveGame(); m.querySelector('#eBack').onclick = () => { m.remove(); this.paused = false; };
      const sQ = m.querySelector('#sQ'); if (sQ) { sQ.oninput = () => { sQ.nextElementSibling.textContent = sQ.value; }; sQ.onchange = () => { Store.set('quality', +sQ.value); resize(); toast('Qualité ' + sQ.value + ' : la lumière se met à jour au prochain lancement'); };
        m.querySelector('#sS').oninput = (e) => Store.set('sens', +e.target.value); m.querySelector('#sV').oninput = (e) => { Store.set('vol', +e.target.value); SFX.setVol(); };
        m.querySelector('#sF').onclick = (e) => { const v = !Store.get('fps', false); Store.set('fps', v); e.target.classList.toggle('on', v); $('fps').hidden = !v; };
        m.querySelector('#sC').onclick = (e) => { const off = document.body.classList.toggle('chatoff'); e.target.classList.toggle('on', !off); Store.set('chatOpen', !off); }; } };
    draw(); m.addEventListener('pointerdown', (e) => e.stopPropagation()); }

  /* ---------------- life & death ---------------- */
  respawn(first) { const P = this.P, c = this.cp; const p = c ? new THREE.Vector3(c.pos[0], c.pos[1] + c.size[1] / 2 + 0.05, c.pos[2]) : this.spawn.clone(); P.pos.copy(p); P.vel.set(0, 0, 0); P.dead = false;
    if (!first) { this.av.dispose(); this.world.scene.remove(this.av.root); this.av = new Avatar(look); this.world.scene.add(this.av.root); if (this.equipped) { this.av.state.tool = true; this.av.holdTool({ kind: this.equipped.kind, color: this.equipped.color }); } }
    this.av.root.position.copy(P.pos); this.forceField(); this.ffUntil = this.t + 3; $('respawnT').classList.remove('on'); $('vign').style.opacity = 0; }
  die() { if (this.P.dead || this.t < (this.ffUntil || 0)) return; this.P.dead = true; SFX.die(); $('vign').style.opacity = 1; this.bodies.push(...this.av.breakApart(this.world.scene, this.P.vel.clone().multiplyScalar(0.3)).map((b) => ({ ...b, life: 5 })));
    setTimeout(() => $('respawnT').classList.add('on'), 900); setTimeout(() => { if (G === this) this.respawn(); }, 3000); }
  reset() { this.ffUntil = 0; this.die(); }

  /* ---------------- frame ---------------- */
  frame() {
    const raw = Math.min(0.1, this.clock.getDelta()); let rem = raw; this.save.playtime = (this.save.playtime || 0) + raw;
    if (!this.paused || true) while (rem > 1e-4) { const s = Math.min(1 / 90, rem); this.step(s); rem -= s; }
    this.visual(raw); this.render();
    if ((this.saveT += raw) > 5) { this.saveT = 0; this.persist(); }
    if (this.thumbAt != null && (this.thumbAt -= raw) <= 0) { this.thumbAt = null; this.captureThumb(); }
    if (Store.get('fps', false)) { this.fpsN = (this.fpsN || 0) + 1; this.fpsT = (this.fpsT || 0) + raw; if (this.fpsT > 0.5) { $('fps').hidden = false; $('fps').textContent = Math.round(this.fpsN / this.fpsT) + ' FPS · ' + renderer.info.render.calls + ' appels'; this.fpsN = 0; this.fpsT = 0; } }
  }
  render() { if (composer) composer.render(); else renderer.render(this.world.scene, camera); }
  captureThumb() { try { this.render(); const src = renderer.domElement, c = document.createElement('canvas'); c.width = c.height = 320; const s = Math.min(src.width, src.height), g = c.getContext('2d'); g.drawImage(src, (src.width - s) / 2, (src.height - s) / 2, s, s, 0, 0, 320, 320);
    Store.set('thumb.' + this.id, c.toDataURL('image/jpeg', 0.72)); } catch {} }
  step(dt) {
    this.t += dt; const P = this.P, W = this.world;
    // moving / spinning platforms carry what stands on them
    for (const d of this.movers) { const before = d.m.matrixWorld.clone();
      if (d.p.role.type === 'mover') { const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * this.t) / (d.p.role.period || 4)); d.m.position.copy(d.origin).add(new THREE.Vector3(d.p.role.dx || 0, d.p.role.dy || 0, d.p.role.dz || 0).multiplyScalar(k)); }
      else d.m.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.t * (d.p.role.speed || 120) * D2R).multiply(d.q0));
      d.m.updateMatrixWorld(); if (d.col) W.moveCollider(d.col, d.m);
      for (const f of d.followers) { f.m.position.copy(f.off).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.p.role.type === 'spinner' ? this.t * (d.p.role.speed || 120) * D2R : 0)).add(d.m.position); f.m.quaternion.copy(d.m.quaternion); f.m.updateMatrixWorld(); if (f.col) W.moveCollider(f.col, f.m); }
      if (P.grounded && P.ground && P.ground.userData.id === d.p.id) { const delta = d.m.matrixWorld.clone().multiply(before.invert()); P.pos.applyMatrix4(delta); if (d.p.role.type === 'spinner') this.av.root.rotation.y += (d.p.role.speed || 120) * D2R * dt; } }
    if (P.dead) return;
    // move relative to the camera
    const inp = P.input.lengthSq() > P.keyIn.lengthSq() ? P.input : P.keyIn, C = this.cam;
    const fwd = new THREE.Vector3(-Math.sin(C.yaw), 0, -Math.cos(C.yaw)), right = new THREE.Vector3(Math.cos(C.yaw), 0, -Math.sin(C.yaw));
    const mv = fwd.multiplyScalar(-inp.y).add(right.multiplyScalar(inp.x)); if (mv.lengthSq() > 1) mv.normalize(); this.mv = mv;
    const ws = 16 + (this.save.speed || 0); const solids = this.solids(), rc = this.rc || (this.rc = new THREE.Raycaster());
    let push = new THREE.Vector3(); if (P.grounded && P.ground) { const gp = P.ground.userData.part; if (gp?.role?.type === 'conveyor') push = new THREE.Vector3(0, 0, -1).applyQuaternion(P.ground.quaternion).multiplyScalar(gp.role.speed || 16); }
    // Humanoid: snappy accel on ground, less control in the air
    const ctl = P.grounded ? 1 : 0.9, tx = mv.x * ws + push.x, tz = mv.z * ws + push.z; P.vel.x += (tx - P.vel.x) * Math.min(1, dt * (P.grounded ? 28 : 10) * ctl); P.vel.z += (tz - P.vel.z) * Math.min(1, dt * (P.grounded ? 28 : 10) * ctl);
    P.vel.y -= GRAV * dt; P.coyote = P.grounded ? 0.1 : P.coyote - dt;
    if ((P.jump || P.jumpHeld) && P.coyote > 0 && P.vel.y <= 1) { P.vel.y = JUMP; P.grounded = false; P.coyote = 0; SFX.jump(); } P.jump = false;
    // horizontal: rays at knee / waist / head, slide along walls
    const step = new THREE.Vector3(P.vel.x * dt, 0, P.vel.z * dt), up = new THREE.Vector3(0, 1, 0);
    const blocked = (v) => { if (v.lengthSq() < 1e-10) return false; const dir = v.clone().normalize();
      for (const h of [0.6, 2.4, 4.6]) for (const s of [-0.7, 0, 0.7]) { const o = P.pos.clone().add(new THREE.Vector3(0, h, 0)).addScaledVector(new THREE.Vector3(-dir.z, 0, dir.x), s); rc.set(o, dir); rc.far = v.length() + 1; const hit = rc.intersectObjects(solids, false)[0];
        if (hit && (!hit.face || Math.abs(hit.face.normal.clone().transformDirection(hit.object.matrixWorld).dot(up)) < 0.65)) return true; } return false; };
    if (!blocked(step)) P.pos.add(step); else { const sx = new THREE.Vector3(step.x, 0, 0), sz = new THREE.Vector3(0, 0, step.z); if (!blocked(sx)) P.pos.add(sx); else if (!blocked(sz)) P.pos.add(sz); else { P.vel.x = 0; P.vel.z = 0; } }
    // ceiling
    if (P.vel.y > 0) { rc.set(P.pos.clone().add(new THREE.Vector3(0, 4.8, 0)), up); rc.far = P.vel.y * dt + 0.5; if (rc.intersectObjects(solids, false)[0]) P.vel.y = 0; }
    // ground: ray from the hips down (steps up to ~2 studs, ramps)
    const ny = P.pos.y + P.vel.y * dt; const wasGround = P.grounded; let best = null;
    for (const [ox, oz] of [[0, 0], [0.7, 0], [-0.7, 0], [0, 0.45], [0, -0.45]]) { rc.set(new THREE.Vector3(P.pos.x + ox, P.pos.y + 2.2, P.pos.z + oz), new THREE.Vector3(0, -1, 0)); rc.far = Math.max(0.1, P.pos.y + 2.2 - ny) + (wasGround ? 0.45 : 0.05);
      const h = P.vel.y <= 0 ? rc.intersectObjects(solids, false)[0] : null; if (h && (!best || h.point.y > best.point.y)) best = h; }
    if (best) { if (!wasGround && P.airT > 0.35) { this.av.state.land = Math.min(1, P.airT * 0.9); SFX.land(); } P.pos.y = best.point.y; P.vel.y = 0; P.grounded = true; P.ground = best.object; P.airT = 0; }
    else { P.pos.y = ny; P.grounded = false; P.ground = null; P.airT += dt; }
    // truss climbing
    P.climbing = false; for (const m of solids) { const p = m.userData.part; if (p.cls !== 'TrussPart') continue; if (m.userData.box.distanceToPoint(P.pos.clone().add(new THREE.Vector3(0, 2.5, 0))) < 1.3 && mv.lengthSq() > 0.1) { P.vel.y = 13; P.climbing = true; break; } }
    if (P.pos.y < -150) this.die();
    this.touches(dt); this.tycoon(dt);
    // auto train
    if (this.save.auto && this.spec?.autoTrain) { this.autoT = (this.autoT || 0) - dt; if (this.autoT <= 0) { this.autoT = Math.max(0.3, this.spec.train?.cooldown || 0.2); this.act('train'); } }
  }
  touches() {
    const P = this.P, pts = [P.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), P.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), P.pos.clone().add(new THREE.Vector3(0, 4.8, 0))];
    const inside = (p, margin = 0.4) => { const c = this.world.colliderOf(p.id) || null; const m = c || this.world.dyn.get(p.id); if (!m) return false; const inv = new THREE.Matrix4().copy(m.matrixWorld).invert(), sz = p.shape === 'Ball' ? [p.size[0], p.size[0], p.size[0]] : p.size;
      for (const w of pts) { const l = w.clone().applyMatrix4(inv); const x = c ? l.x * sz[0] : l.x, y = c ? l.y * sz[1] : l.y, z = c ? l.z * sz[2] : l.z; if (Math.abs(x) <= sz[0] / 2 + margin && Math.abs(y) <= sz[1] / 2 + margin && Math.abs(z) <= sz[2] / 2 + margin) return true; } return false; };
    const nearby = (p, r = 30) => Math.abs(p.pos[0] - P.pos.x) < r + p.size[0] && Math.abs(p.pos[2] - P.pos.z) < r + p.size[2];
    for (const p of this.roled) { if (this.hidden.has(p.id) || !nearby(p)) continue; const r = p.role.type; if (['dropper', 'upgrader', 'collector', 'conveyor', 'mover', 'spinner'].includes(r)) continue; if (!inside(p)) continue;
      if (r === 'kill') { this.die(); return; }
      if (r === 'checkpoint' && (!this.cp || p.role.stage >= (this.cp.role?.stage || 0)) && this.cp !== p) { this.cp = p; if ((p.role.stage || 0) > (this.V.Stage || 0)) { this.V.Stage = p.role.stage; this.drawCounters('Stage'); this.notify('🚩 Étape ' + p.role.stage, 'good'); SFX.coin(); this.persist(); } }
      if (r === 'jumppad' && this.cooldown('pad', 0.4)) { const m = this.world.dyn.get(p.id); const ax = new THREE.Vector3(p.shape === 'Cylinder' ? 1 : 0, p.shape === 'Cylinder' ? 0 : 1, 0).applyQuaternion(m.quaternion).normalize(); P.vel.copy(ax.multiplyScalar(p.role.power || 90)); P.grounded = false; P.pos.y += 0.3; SFX.jump(); }
      if (r === 'teleporter' && this.cooldown('tp', 1.5)) { const o = this.roled.find((q) => q !== p && q.role.type === 'teleporter' && q.role.pair === p.role.pair); if (o) { P.pos.set(o.pos[0], o.pos[1] + 5, o.pos[2]); P.vel.set(0, 0, 0); SFX.tp(); this.ring('#c86bff'); } }
      if (r === 'coin' && !this.coinsOff.has(p.id)) { this.coinsOff.set(p.id, this.t + (p.role.respawn || 8)); const m = this.world.dyn.get(p.id); if (m) m.visible = false; this.add(p.role.stat || 'Coins', Math.floor((p.role.value || 1) * (this.spec ? this.mult() : 1)), new THREE.Vector3(...p.pos)); SFX.coin(); }
      if (r === 'gate' && !this.gateOpen(p) && this.cooldown('gate', 1.2)) this.notify(`🔒 Il faut ${abbrev(p.role.need)} ${p.role.stat || 'Coins'}`, 'warn');
      if (r === 'claim' && !this.owned) { const ty = this.tycoonOf(p.id); if (ty) { this.owned = ty.id; if (this.V.Cash == null) this.V.Cash = 0; this.drawCounters(); this.notify('🏭 Ce tycoon est à toi !', 'good'); SFX.buy(); } }
      if (r === 'buybutton' && this.owned && this.tycoonOf(p.id)?.id === this.owned && this.cooldown('buy' + p.id, 0.6)) { const st = p.role.stat || 'Cash';
        if ((this.V[st] || 0) >= p.role.price) { this.add(st, -p.role.price, false); if (p._target) this.setHidden(p._target, false); this.setHidden(p, true); this.notify('✅ ' + p.role.target + ' acheté !', 'good'); SFX.buy(); } else this.notify(`❌ Il faut ${abbrev(p.role.price)} ${st}`, 'warn'); } }
    for (const [id, t] of this.coinsOff) if (this.t >= t) { this.coinsOff.delete(id); const m = this.world.dyn.get(id); if (m) m.visible = true; }
    // ForgeGame pads
    for (const p of this.zones) { if (!nearby(p, 12)) { this.inZone.delete(p.id); continue; } const z = p.attrs.ForgeGameZone, hit = inside(p, 1.2);
      if (!hit) { this.inZone.delete(p.id); continue; } const first = !this.inZone.has(p.id); this.inZone.add(p.id);
      if (z === 'Sell' && this.cooldown('padsell', 1)) this.act('sell'); else if (z === 'Train' && this.cooldown('padtrain', 0.35)) this.act('train');
      else if (first) { if (z === 'Shop') this.panelShop(); else if (z === 'Egg') this.panelEggs(); else if (z === 'Rebirth') this.panelRebirth(); } }
  }
  tycoon(dt) { if (!this.owned) return; const W = this.world;
    for (const p of this.droppers) { if (this.hidden.has(p.id) || this.tycoonOf(p.id)?.id !== this.owned) continue; p._next ??= this.t; if (this.t < p._next || this.drops.length > 60) continue; p._next = this.t + (p.role.interval || 2);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: ['#ffd34d', '#5ad1ff', '#c86bff', '#3dffa8'][Math.floor(Math.random() * 4)], roughness: 0.4 })); mesh.castShadow = true; mesh.position.set(p.pos[0], p.pos[1] - p.size[1] / 2 - 0.7, p.pos[2]); W.scene.add(mesh);
      this.drops.push({ mesh, vel: new THREE.Vector3(), value: p.role.value || 5, ups: new Set(), born: this.t }); }
    const rc = this.rc2 || (this.rc2 = new THREE.Raycaster()), mats = this.dropMats.filter((p) => !this.hidden.has(p.id));
    for (const d of [...this.drops]) { d.vel.y -= GRAV * 0.5 * dt; const m = d.mesh; const near = [...W.near(m.position, 4)]; rc.set(m.position.clone().add(new THREE.Vector3(0, 0.4, 0)), new THREE.Vector3(0, -1, 0)); rc.far = 0.95 + Math.max(0, -d.vel.y * dt);
      const hit = rc.intersectObjects(near.filter((c) => !this.hidden.has(c.userData.id)), false)[0];
      if (hit && d.vel.y <= 0) { m.position.y = hit.point.y + 0.5; d.vel.y = 0; const gp = hit.object.userData.part; if (gp?.role?.type === 'conveyor') { const v = new THREE.Vector3(0, 0, -1).applyQuaternion(hit.object.quaternion).multiplyScalar(gp.role.speed || 10); d.vel.x = v.x; d.vel.z = v.z; } else { d.vel.x *= 0.8; d.vel.z *= 0.8; } }
      m.position.addScaledVector(d.vel, dt);
      for (const q of mats) { const c = W.colliderOf(q.id); if (!c || !c.userData.box.clone().expandByScalar(0.6).containsPoint(m.position)) continue;
        if (q.role.type === 'upgrader' && !d.ups.has(q.id)) { d.ups.add(q.id); d.value *= q.role.mult || 2; m.material.emissive = new THREE.Color('#ffffff'); m.material.emissiveIntensity = 0.6; }
        if (q.role.type === 'collector') { this.add(q.role.stat || 'Cash', Math.floor(d.value), false); W.scene.remove(m); this.drops.splice(this.drops.indexOf(d), 1); break; } }
      if (this.t - d.born > 30 && this.drops.includes(d)) { W.scene.remove(m); this.drops.splice(this.drops.indexOf(d), 1); } } }
  drawBoard() { if (!this.board || !this.spec?.board) return; const st = this.spec.board.stat, v = this.V[st] || 0; if (this._bv === v) return; this._bv = v; const W = this.world;
    if (this.boardSprite) { W.scene.remove(this.boardSprite); this.boardSprite.material.map.dispose(); } const s = labelSprite(`🏆 1. ${look.name} : ${abbrev(v)} ${st}`, { color: '#ffd45c', scale: 0.85 }); s.position.set(this.board.pos[0], this.board.pos[1], this.board.pos[2] + 0.8); W.scene.add(s); this.boardSprite = s; }
  /* visuals once per frame: avatar, camera, coins, gates, pets, debris, bubbles */
  visual(dt) {
    const P = this.P, W = this.world, C = this.cam, av = this.av;
    if (!P.dead) { av.root.position.copy(P.pos); const hv = Math.hypot(P.vel.x, P.vel.z);
      if (this.mv && this.mv.lengthSq() > 0.01) { const yaw = Math.atan2(-this.mv.x, -this.mv.z); av.root.rotation.y += ((((yaw - av.root.rotation.y) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 14); }
      av.state.speed = P.grounded ? hv : 0; av.state.grounded = P.grounded; av.state.vy = P.vel.y; av.state.climbing = P.climbing; av.update(dt); }
    // coins spin + bob, gates react to stats
    for (const p of this.coins) { const m = W.dyn.get(p.id); if (m && m.visible) { m.rotation.y = this.t * 2.6 + p.pos[0]; m.position.y = p.pos[1] + Math.sin(this.t * 2.2 + p.pos[0]) * 0.35; } }
    for (const p of this.gates) { const m = W.dyn.get(p.id), open = this.gateOpen(p); if (m && m.userData.open !== open) { m.userData.open = open; m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = open ? 0.12 : 1 - (p.transparency || 0); const l = W.labels.get(p.id); if (l) l.visible = !open; if (open && this.t > 1) { this.notify('🔓 Zone débloquée !', 'good'); SFX.buy(); } } }
    for (const p of this.zones) { const m = W.dyn.get(p.id); if (m && p.material === 'Neon') m.material.emissiveIntensity = 1.1 + Math.sin(this.t * 3 + p.pos[0]) * 0.3; }
    // pets: follow in an arc behind, hop when moving
    (this.petObjs || []).forEach((o, i) => { const back = new THREE.Vector3(Math.sin(av.root.rotation.y), 0, Math.cos(av.root.rotation.y)), side = new THREE.Vector3(back.z, 0, -back.x);
      const goal = P.pos.clone().addScaledVector(back, 4.2 + (i === 0 ? 0 : 1.2)).addScaledVector(side, i === 0 ? 0 : i === 1 ? 3 : -3); o.g.position.x += (goal.x - o.g.position.x) * Math.min(1, dt * 5); o.g.position.z += (goal.z - o.g.position.z) * Math.min(1, dt * 5);
      const moving = goal.distanceTo(o.g.position) > 0.6; o.ph += dt * (moving ? 12 : 3); o.g.position.y += (P.pos.y + (moving ? Math.abs(Math.sin(o.ph)) * 1 : 0.4 + Math.sin(o.ph) * 0.25) - o.g.position.y) * Math.min(1, dt * 10);
      const look = P.pos.clone().sub(o.g.position); o.g.rotation.y = Math.atan2(look.x, look.z) + Math.PI; });
    // debris of broken avatars: gravity + bounce on the ground
    const rc = this.rc3 || (this.rc3 = new THREE.Raycaster());
    for (const b of [...this.bodies]) { b.life -= dt; b.v.y -= GRAV * 0.6 * dt; const next = b.m.position.clone().addScaledVector(b.v, dt); rc.set(b.m.position.clone().add(new THREE.Vector3(0, 0.3, 0)), new THREE.Vector3(0, -1, 0)); rc.far = 0.6 + Math.max(0, -b.v.y * dt);
      const h = b.v.y < 0 ? rc.intersectObjects([...W.near(b.m.position, 3)], false)[0] : null; if (h) { next.y = h.point.y + 0.3; b.v.y *= -0.35; b.v.x *= 0.7; b.v.z *= 0.7; b.w.multiplyScalar(0.7); }
      b.m.position.copy(next); b.m.rotation.x += b.w.x * dt; b.m.rotation.y += b.w.y * dt; b.m.rotation.z += b.w.z * dt; if (b.life < 0.6) b.m.traverse((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = Math.max(0, b.life / 0.6); } });
      if (b.life <= 0) { W.scene.remove(b.m); this.bodies.splice(this.bodies.indexOf(b), 1); } }
    this.tickDummies(dt); this.tickFX(dt);
    for (const b of [...this.bubbles]) { b.t += dt; b.s.position.copy(P.pos).add(new THREE.Vector3(0, 6.4 + b.lift, 0)); if (b.t > 8) { b.s.material.opacity = Math.max(0, 1 - (b.t - 8)); if (b.t > 9) { W.scene.remove(b.s); this.bubbles.splice(this.bubbles.indexOf(b), 1); } } }
    // classic follow camera with collision (pulls in when a wall is in the way)
    const tgt = (P.dead ? (this.bodies[0]?.m.position || P.pos) : P.pos).clone().add(new THREE.Vector3(0, 4.5, 0)); C.cur.lerp(tgt, Math.min(1, dt * 18));
    const dir = new THREE.Vector3(Math.sin(C.yaw) * Math.cos(C.pitch), Math.sin(C.pitch), Math.cos(C.yaw) * Math.cos(C.pitch)); let dist = C.dist;
    const crc = this.crc || (this.crc = new THREE.Raycaster()); crc.set(C.cur, dir); crc.far = C.dist; const hit = crc.intersectObjects([...W.near(C.cur, C.dist + 4)].filter((m) => (m.userData.part.transparency || 0) < 0.5 && !this.hidden.has(m.userData.id)), false)[0];
    if (hit) dist = Math.max(1.2, hit.distance - 0.6); C.shown = C.shown == null ? dist : dist < C.shown ? dist : C.shown + (dist - C.shown) * Math.min(1, dt * 6);
    camera.position.copy(C.cur).addScaledVector(dir, C.shown); camera.lookAt(C.cur);
    av.root.visible = !P.dead && C.shown > 2.2; // first person: hide the body
    W.follow(P.pos, this.t);
    if (Date.now() < this.boostUntil) { const left = Math.ceil((this.boostUntil - Date.now()) / 1000); if (left !== this._bl) { this._bl = left; this.notifyBoost = left; } }
  }
}

/* boot: home + deep links (« ▶ Jouer » from Créer tout / Map Studio opens #play=<id>) */
(async () => {
  await renderHome(); const m = location.hash.match(/play=([\w-]+)/);
  if (m) { history.replaceState(null, '', location.pathname); const g = findGame(m[1]); if (g) startGame(g); }
  window.__play = { get game() { return G; }, startGame, findGame, LIB }; // used by automated tests
})();
