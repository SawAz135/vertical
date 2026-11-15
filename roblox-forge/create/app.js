/* =====================================================================
   Roblox Forge « Créer tout » - app.
   Sentence → spec (game-spec.js) → map + pack (game-pack.js) → Roblox Push.
   Edits (« ajoute un bouton +5 vitesse ») change the spec; the map is only
   rebuilt when the game type or theme changes, or on « Autre carte ».
   ===================================================================== */
import { applyText, emptySpec, configOf } from './game-spec.js';
import { buildMap, buildPack, padsFor } from './game-pack.js';
import { aiUnderstand, hasToken, getToken, setToken } from './ai-spec.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const toast = (t, ms = 2400) => { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), ms); };
const Store = { get(k, d) { try { const v = localStorage.getItem('forge.create.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('forge.create.' + k, JSON.stringify(v)); } catch {} } };

let spec = Store.get('spec', null), seed = Store.get('seed', 7), map = null, lastDone = Store.get('done', []), lastWarn = Store.get('warn', []), lastVia = Store.get('via', '');
let mode = Store.get('mode', 'ai');

const EXAMPLES = ['map simulator avec shop fonctionnel et sell fonctionnel, ajoute un bouton +1 force',
  'simulator de vitesse dans la neige avec boutique, vente, rebirth, des oeufs et 4 zones', 'tycoon dans le désert avec une boutique avec épée, sac et potion, codes et cadeau quotidien',
  'simulator magie dans l’espace avec auto, gamepass x2, un bouton +10 magie et un bouton vendre', 'obby dans le ciel avec un bouton spawn et des codes', 'simulator bonbon avec œufs, rebirth et un bouton +1 clics'];
const EDITS = ['ajoute un bouton +5 vitesse', 'ajoute des œufs', 'ajoute un rebirth', 'ajoute un code VIP', 'ajoute un cadeau quotidien', 'ajoute auto-clic', 'enlève la boutique', 'ajoute 3 zones'];
$('ex').innerHTML = EXAMPLES.map((e) => `<button class="chip" data-ex="${esc(e)}">${esc(e.length > 46 ? e.slice(0, 44) + '…' : e)}</button>`).join('');
$('exEdit').innerHTML = EDITS.map((e) => `<button class="chip" data-ed="${esc(e)}">${esc(e)}</button>`).join('');
document.querySelectorAll('[data-ex]').forEach((b) => b.onclick = () => { $('q').value = b.dataset.ex; $('q').focus(); });
document.querySelectorAll('[data-ed]').forEach((b) => b.onclick = () => { $('edit').value = b.dataset.ed; applyEdit(); });

const busy = (on, t) => { $('busy').classList.toggle('on', on); if (t) $('busyT').textContent = t; };
const tick = () => new Promise((r) => setTimeout(r, 30));
function save() { Store.set('spec', spec); Store.set('seed', seed); Store.set('done', lastDone); Store.set('warn', lastWarn); Store.set('via', lastVia); }
/* understanding: AI when a free token is set (and the mode is AI), otherwise the rules; the AI never blocks: any failure → rules */
async function understand(text, prev) {
  if (mode === 'ai' && hasToken()) {
    try { const r = await aiUnderstand(text, prev, { onStatus: (t) => busy(true, t) }); return { ...r, via: '🧠 compris par l\u2019IA (' + r.model.split('/')[1] + ')' }; }
    catch (e) { const r = applyText(text, prev); return { ...r, unsupported: [], via: '📐 compris par les règles — IA : ' + (e.message || e) }; }
  }
  const r = applyText(text, prev); return { ...r, unsupported: [], via: mode === 'ai' ? '📐 compris par les règles (ajoute ton jeton gratuit pour l\u2019IA)' : '📐 compris par les règles' };
}
function renderMode() { document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  $('aiState').textContent = mode === 'ai' ? (hasToken() ? '✅ jeton prêt' : '→ ajoute ton jeton gratuit') : 'hors ligne, sans compte'; $('tok').value = getToken(); }
document.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { mode = b.dataset.mode; Store.set('mode', mode); if (mode === 'ai' && !hasToken()) $('tokBox').open = true; renderMode(); });
$('tok').onchange = () => { setToken($('tok').value); renderMode(); toast(hasToken() ? '🔑 Jeton gardé sur cet appareil' : $('tok').value ? 'Ce n\u2019est pas un jeton hf_ valide' : 'Jeton effacé'); };
renderMode();

async function create() {
  const text = $('q').value.trim(); if (!text) return toast('Décris ton jeu');
  busy(true, 'Construction du jeu…'); await tick();
  try { const r = await understand(text, null); spec = r.spec; lastDone = r.done; lastWarn = r.unsupported || []; lastVia = r.via; seed = Math.floor(Math.random() * 1e6); busy(true, 'Construction de la carte…'); await tick();
    map = buildMap(spec, seed); spec.theme = map.theme; save(); render(); toast('✨ Jeu créé : ' + r.done.length + ' éléments');
    document.querySelector('.grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { console.error(e); toast('Erreur : ' + (e.message || e)); } finally { busy(false); }
}
async function applyEdit() {
  const text = $('edit').value.trim(); if (!text) return toast('Écris ce que tu veux changer');
  if (!spec) { $('q').value = text; return create(); }
  const before = JSON.stringify([spec.genre, spec.theme, spec.zones, spec.voxel]);
  busy(true, 'Je modifie ton jeu…'); await tick(); const r = await understand(text, spec); busy(false); spec = r.spec; lastDone = r.done.length ? r.done : ['(rien compris : essaie « ajoute un bouton +5 vitesse »)']; lastWarn = r.unsupported || []; lastVia = r.via;
  if (JSON.stringify([spec.genre, spec.theme, spec.zones, spec.voxel]) !== before || !map) { busy(true, 'Nouvelle carte…'); await tick(); map = buildMap(spec, seed); spec.theme = map.theme; busy(false); }
  else map = withPads(map);
  save(); render(); $('edit').value = ''; toast(r.done.length ? '✏️ ' + r.done.join(' · ') : 'Rien à changer');
}
/* buttons / features that need a pad (sell, shop…) refresh the pads without rebuilding the world */
function withPads(m) { if (!m) return m; const rest = m.root.children.filter((c) => c.name !== 'GamePads'); m.root.children = [...rest, padsFor(spec, rest)]; return m; }

/* ---------- features list (each removable) ---------- */
function render() {
  document.body.classList.toggle('has', !!spec);
  if (!spec) return;
  $('done').innerHTML = lastDone.map((d) => `<li>${esc(d)}</li>`).join('');
  $('warn').innerHTML = (lastWarn || []).map((w) => `<li>pas encore possible : ${esc(w)}</li>`).join(''); $('via').textContent = lastVia || '';
  const F = [];
  F.push({ i: '🗺️', t: `Carte ${spec.genre} · ${spec.theme}`, s: `${spec.voxel === false ? 'classique' : 'voxel (terrain en cubes, arbres, fleurs…)'} · plateformes du jeu près du spawn` });
  if (spec.stats.length) F.push({ i: spec.stats[0].e, t: 'Stats', s: spec.stats.map((s) => s.e + ' ' + s.id + (s.start ? ` (départ ${s.start})` : '')).join(' · ') });
  if (spec.money.length) F.push({ i: spec.money[0].e, t: 'Argent', s: spec.money.map((s) => s.e + ' ' + s.id + (s.start ? ` (départ ${s.start})` : '')).join(' · ') });
  if (spec.train) F.push({ i: '🏋️', t: 'Entraînement', s: `+${spec.train.perClick} ${spec.train.stat} par clic (outil « ${spec.train.toolName || 'Entraînement'} », bouton, touche E)`, rm: 'train' });
  if (spec.sell) F.push({ i: '💰', t: 'Vente', s: `${spec.sell.from} → ${spec.sell.to} · plateforme + bouton + touche Q`, rm: 'sell' });
  if (spec.shop) F.push({ i: '🛒', t: `Boutique (${spec.shop.items.length})`, s: spec.shop.items.map((x) => `${x.e} ${x.name} · ${x.price} ${x.money}`).join(' · '), rm: 'shop' });
  if (spec.rebirth) F.push({ i: '🔁', t: 'Rebirth', s: `dès ${spec.rebirth.cost} ${spec.rebirth.costStat} · +${Math.round(spec.rebirth.bonus * 100)} % de gains par rebirth`, rm: 'rebirth' });
  if (spec.eggs) F.push({ i: '🥚', t: 'Œufs et pets', s: `${spec.eggs.price} ${spec.eggs.money} · ` + spec.eggs.pets.map((p) => `${p.name} ×${p.mult}`).join(', '), rm: 'eggs' });
  if (spec.zones) F.push({ i: '🚪', t: `${spec.zones} zones`, s: 'portes à débloquer avec l’argent', rm: 'zones' });
  if (spec.daily) F.push({ i: '🎁', t: 'Cadeau quotidien', s: `${spec.daily.amount} ${spec.daily.money} toutes les 20 h`, rm: 'daily' });
  if (spec.codes.length) F.push({ i: '🎟️', t: 'Codes', s: spec.codes.map((c) => `${c.code} (+${c.amount})`).join(' · '), rm: 'codes' });
  if (spec.pass) F.push({ i: '💎', t: `Gamepass ×${spec.pass.mult}`, s: 'mets l’id de ton gamepass dans Config.pass.id', rm: 'pass' });
  if (spec.autoTrain) F.push({ i: '🤖', t: 'Auto-entraînement', s: 'bouton Auto dans l’interface', rm: 'auto' });
  if (spec.combat) F.push({ i: '⚔️', t: 'Combat PvP', s: `épée (${spec.combat.damage} dégâts${spec.combat.health ? ', armure et vie' : ''}) · Kills · +${spec.combat.reward} ${spec.combat.money} par kill`, rm: 'combat' });
  if (spec.board) F.push({ i: '🏆', t: 'Classement', s: `top ${spec.board.top} des meilleurs (${spec.board.stat}), panneau près du spawn`, rm: 'board' });
  F.push({ i: '💾', t: 'Sauvegarde', s: 'DataStore, verrou de session (pas de duplication), sauvegarde auto' });
  $('fcount').textContent = F.length + ' éléments';
  $('feat').innerHTML = F.map((f) => `<div class="f"><span class="i">${f.i}</span><span class="t"><b>${esc(f.t)}</b><small>${esc(f.s)}</small></span>${f.rm ? `<button class="x" data-rm="${f.rm}" title="Enlever">✕</button>` : ''}</div>`).join('')
    + `<div class="f" style="flex-direction:column;align-items:stretch"><b style="font-size:13.5px">🔘 Boutons de l’interface (${spec.buttons.length})</b><div class="btns">${spec.buttons.map((b, i) => `<span class="bb" style="background:${esc(b.color)}">${esc(b.label)}<button data-rb="${i}" title="Enlever">✕</button></span>`).join('') || '<small class="note">aucun : « ajoute un bouton +1 force »</small>'}</div></div>`;
  $('feat').querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => removeFeature(b.dataset.rm));
  $('feat').querySelectorAll('[data-rb]').forEach((b) => b.onclick = () => { spec.buttons.splice(+b.dataset.rb, 1); lastDone = ['− bouton']; save(); render(); });
  renderPreview();
}
function removeFeature(k) {
  const drop = (a) => (spec.buttons = spec.buttons.filter((b) => b.action !== a));
  if (k === 'train') { spec.train = null; drop('train'); } else if (k === 'sell') { spec.sell = null; drop('sell'); } else if (k === 'shop') { spec.shop = null; drop('shop'); }
  else if (k === 'rebirth') { spec.rebirth = null; drop('rebirth'); } else if (k === 'eggs') { spec.eggs = null; drop('egg'); } else if (k === 'zones') spec.zones = 0;
  else if (k === 'combat') { spec.combat = null; spec.stats = spec.stats.filter((x) => x.id !== 'Kills'); } else if (k === 'board') spec.board = null; else if (k === 'daily') spec.daily = null; else if (k === 'codes') spec.codes = []; else if (k === 'pass') spec.pass = null; else if (k === 'auto') spec.autoTrain = false;
  lastDone = ['− ' + k]; map = withPads(map); save(); render();
}

/* ---------- preview: top-down map + the generated GUI ---------- */
function renderPreview() {
  const cv = $('mapc'), r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const g = cv.getContext('2d'); g.fillStyle = '#5aa0e8'; g.fillRect(0, 0, cv.width, cv.height);
  const parts = []; const walk = (n) => { if (n.children) n.children.forEach(walk); else if (n.size && n.pos && (n.transparency || 0) < 0.6) parts.push(n); }; map && walk(map.root);
  let sp = parts.find((p) => p.cls === 'SpawnLocation'), cx = sp ? sp.pos[0] : 0, cz = sp ? sp.pos[2] : 0;
  const span = 150, k = cv.width / span, H = cv.height;
  parts.sort((a, b) => (a.pos[1] + a.size[1] / 2) - (b.pos[1] + b.size[1] / 2));
  for (const p of parts) { const sx = p.size[0] * k, sz = p.size[2] * k, x = (p.pos[0] - cx) * k + cv.width / 2 - sx / 2, y = (p.pos[2] - cz) * k + H * 0.62 - sz / 2;
    if (x > cv.width || y > H || x + sx < 0 || y + sz < 0) continue; const top = p.pos[1] + p.size[1] / 2, shade = Math.max(0.6, Math.min(1.15, 0.75 + top / 60));
    g.fillStyle = p.color; g.globalAlpha = 1; g.fillRect(x, y, Math.max(1, sx), Math.max(1, sz));
    if (shade !== 1) { g.fillStyle = shade < 1 ? `rgba(0,0,0,${1 - shade})` : `rgba(255,255,255,${shade - 1})`; g.fillRect(x, y, Math.max(1, sx), Math.max(1, sz)); } }
  // pad labels
  const pads = map && map.root.children.find((c) => c.name === 'GamePads'); $('gpads').innerHTML = '';
  if (pads) $('gpads').innerHTML = pads.children.map((m) => { const p = m.children[1], x = ((p.pos[0] - cx) * k + cv.width / 2) / cv.width * 100, y = ((p.pos[2] - cz) * k + H * 0.62) / H * 100; const s = m.children[3];
    return `<span class="gpad" style="left:${x}%;top:${y}%">${esc(s && s.label || (m.name === 'Leaderboard' ? '🏆 CLASSEMENT' : m.name))}</span>`; }).join('');
  // GUI
  const COL = ['#ff5c5c', '#5aa9ff', '#3dd68c', '#b46bff', '#ffb02e'];
  $('gcount').innerHTML = [...spec.stats.map((s, i) => ({ e: s.e, v: '0', c: COL[i % COL.length] })), ...spec.money.map((m) => ({ e: m.e, v: '0', c: m.id === 'Gems' ? '#3ee6ff' : '#ffc02e' })), ...(spec.rebirth ? [{ e: '🔁', v: '0', c: '#b46bff' }] : [])]
    .map((x) => `<div class="gc" style="background:linear-gradient(${x.c},${x.c}cc)">${x.e} ${x.v}</div>`).join('');
  const extra = [...(spec.daily ? [{ label: '🎁 Cadeau', color: '#ff7ab6' }] : []), ...(spec.codes.length ? [{ label: '🎟️ Codes', color: '#5aa9ff' }] : []), ...(spec.eggs ? [{ label: '🥚 Œufs', color: '#ff7ab6' }] : []), ...(spec.autoTrain ? [{ label: '🤖 Auto : OFF', color: '#6b7280' }] : [])];
  const all = [...spec.buttons, ...extra], shown = all.slice(0, 7);
  $('gbtn').innerHTML = shown.map((b) => `<div class="gb" style="background:linear-gradient(${b.color},${b.color}d0)">${esc(b.label)}</div>`).join('') + (all.length > 7 ? `<div class="gb" style="background:#333;font-size:3.4cqh">+${all.length - 7}</div>` : '');
  const n = parts.length; $('mapInfo').textContent = `${n.toLocaleString('fr')} pièces · ${spec.buttons.length} boutons · « ${map ? map.name : ''} »`;
}

/* ---------- publish ---------- */
async function packBlob() { busy(true, 'Préparation du pack…'); await tick(); try { return await buildPack(spec, map); } finally { busy(false); } }
$('toGame').onclick = async () => { const blob = await packBlob(), buf = new Uint8Array(await blob.arrayBuffer()); let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  try { localStorage.setItem('rp2.pendingPack', JSON.stringify({ name: map.name, label: 'Jeu ' + spec.title, rarity: 'Jeu', b64: btoa(bin), at: Date.now() })); }
  catch { return toast('Jeu trop gros pour le navigateur : télécharge plutôt le pack.'); }
  toast('Ouverture de Roblox Push…'); setTimeout(() => (location.href = '../../roblox-push/'), 450); };
$('dl').onclick = async () => { const blob = await packBlob(), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = map.name + '.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('📦 Pack téléchargé'); };
$('toMap').onclick = () => { try { localStorage.setItem('forgemap.map', JSON.stringify(map)); } catch { return toast('Carte trop grosse pour être ouverte dans Map Studio'); } location.href = '../map/'; };
$('reroll').onclick = async () => { busy(true, 'Nouvelle carte…'); await tick(); seed = Math.floor(Math.random() * 1e6); map = buildMap(spec, seed); spec.theme = map.theme; busy(false); save(); render(); toast('🎲 Nouvelle carte'); };
$('reset').onclick = () => { if (!confirm('Commencer un nouveau jeu ?')) return; spec = null; map = null; lastDone = []; save(); render(); $('q').focus(); scrollTo({ top: 0, behavior: 'smooth' }); };
$('go').onclick = create; $('apply').onclick = applyEdit;
$('edit').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); applyEdit(); } });
$('q').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) create(); });
addEventListener('resize', () => spec && renderPreview());

// restore the last game
if (spec) { busy(true, 'Chargement de ton jeu…'); setTimeout(() => { try { map = buildMap(spec, seed); } catch (e) { console.error(e); } busy(false); render(); }, 30); } else render();
window.__create = { get spec() { return spec; }, get map() { return map; }, buildPack: () => buildPack(spec, map), configOf: () => configOf(spec), emptySpec }; // used by automated tests
