// Roblox Forge - GUI Studio. What you build here is a real Roblox ScreenGui (exported 1:1 with Rojo).
import * as G from './gui-core.js';
import { TEMPLATES, defaultProject } from './templates.js';
import { STUD_ALL } from './stud.js';
import { createLibrary } from '../library/forge-lib.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function toast(m, ms = 2200) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), ms); }
const Store = {
  get(k, d) { try { const v = localStorage.getItem('forgegui.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('forgegui.' + k, JSON.stringify(v)); } catch { toast('Mémoire du navigateur pleine'); } },
};

/* =====================================================================
   1. STATE + undo / redo
   ===================================================================== */
let proj = Store.get('project', null) || defaultProject();
let selId = null, undoStack = [], redoStack = [];
const ui = { device: Store.get('device', 'phone'), unit: 'scale', bar: true, dark: false, play: false, tab: 'tpl', q: '' };
const theme = () => (proj.theme === 'custom' && proj.customTheme ? proj.customTheme : G.THEMES[proj.theme] || G.THEMES.neon);
function snapshot() { undoStack.push(JSON.stringify(proj)); if (undoStack.length > 80) undoStack.shift(); redoStack = []; syncUndo(); }
function save() { Store.set('project', proj); }
function syncUndo() { $('undo').disabled = !undoStack.length; $('redo').disabled = !redoStack.length; }
$('undo').onclick = () => { if (!undoStack.length) return; redoStack.push(JSON.stringify(proj)); proj = JSON.parse(undoStack.pop()); after(); };
$('redo').onclick = () => { if (!redoStack.length) return; undoStack.push(JSON.stringify(proj)); proj = JSON.parse(redoStack.pop()); after(); };
function after() { if (selId && !G.find(proj.root, selId)) selId = null; save(); syncUndo(); draw(); renderPane(); }
const sel = () => (selId ? G.find(proj.root, selId) : null);
const selGui = () => { const n = sel(); return n && !G.isMod(n.cls) && n.cls !== 'ScreenGui' ? n : null; };

/* =====================================================================
   2. STAGE: device, render, selection, drag / resize with guides
   ===================================================================== */
const DEVICES = { phone: [844, 390, 'iPhone (paysage)'], tablet: [1180, 820, 'iPad'], pc: [1280, 720, 'PC 720p'] };
const area = $('area'), device = $('device'), wrap = $('screenwrap'), stage = $('stage'), selBox = $('sel');
let fit = 1, elMap = new Map();
function layoutDevice() {
  const [w, h] = DEVICES[ui.device], aw = area.clientWidth - 28, ah = area.clientHeight - 24;
  fit = Math.max(0.05, Math.min(aw / w, ah / h));
  stage.style.width = w + 'px'; stage.style.height = h + 'px'; stage.style.transform = `scale(${fit})`;
  wrap.style.width = w * fit + 'px'; wrap.style.height = h * fit + 'px';
}
function draw() {
  layoutDevice();
  stage.classList.toggle('dark', ui.dark); stage.classList.toggle('edit', !ui.play); stage.classList.toggle('playing', ui.play);
  const onPath = new Set(); if (selId) { let x = G.find(proj.root, selId); while (x) { onPath.add(x.id); x = G.parentOf(proj.root, x.id); } }
  const inSel = (n) => { if (onPath.has(n.id)) return true; let x = G.parentOf(proj.root, n.id); while (x) { if (x.id === selId) return true; x = G.parentOf(proj.root, x.id); } return false; };
  elMap = G.render(proj.root, theme(), stage, { play: ui.play, isVisible: (n) => (playVis.has(n.id) ? playVis.get(n.id) : G.prop(n, 'Visible')),
    editVisible: (n) => G.prop(n, 'Visible') !== false || inSel(n) });
  if (ui.bar && G.prop(proj.root, 'IgnoreGuiInset')) { const tb = document.createElement('div'); tb.className = 'topbar'; tb.innerHTML = '<i>☰</i><i>💬</i>'; stage.appendChild(tb); }
  $('projName').textContent = proj.root.name;
  startRuntime();
  if (ui.play) reapplyPlayState();
  updateSel();
}
function updateSel() {
  const n = selGui(), el = n && elMap.get(n.id);
  if (!el || ui.play) { selBox.classList.add('hidden'); selBox.dataset.key = ''; return; }
  const r = el.getBoundingClientRect(), a = area.getBoundingClientRect();
  selBox.classList.remove('hidden');
  Object.assign(selBox.style, { left: r.left - a.left + 'px', top: r.top - a.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const inLayout = !!parentLayout(n), w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight), ap = G.prop(n, 'AnchorPoint');
  const key = [n.id, n.name, w, h, inLayout, ap].join('|'); if (selBox.dataset.key === key) return; // handles stay the same DOM nodes while animating
  selBox.dataset.key = key;
  selBox.innerHTML = `<div class="tag">${esc(n.name)} · ${w}×${h}</div>${inLayout ? '' : `<div class="h se" data-h="se"></div><div class="h e" data-h="e"></div><div class="h s" data-h="s"></div><div class="anchor" style="left:${ap[0] * 100}%;top:${ap[1] * 100}%"></div>`}`;
}
function parentLayout(n) { const p = G.parentOf(proj.root, n.id); return p && (G.mod(p, 'UIListLayout') || G.mod(p, 'UIGridLayout')); }
function select(id) { const before = closedPath(); selId = id; if (before !== closedPath()) draw(); else updateSel(); if (['tree', 'props', 'anim'].includes(ui.tab)) renderPane(); }
function closedPath() { let x = selId && G.find(proj.root, selId), k = ''; while (x) { if (G.prop(x, 'Visible') === false) k += x.id; x = G.parentOf(proj.root, x.id); } return k; }
addEventListener('resize', () => { draw(); });
document.querySelectorAll('[data-dev]').forEach((b) => b.onclick = () => { ui.device = b.dataset.dev; Store.set('device', ui.device); document.querySelectorAll('[data-dev]').forEach((x) => x.classList.toggle('on', x === b)); draw(); toast(DEVICES[ui.device][2] + ' · ' + DEVICES[ui.device].slice(0, 2).join('×')); });
document.querySelectorAll('[data-dev]').forEach((x) => x.classList.toggle('on', x.dataset.dev === ui.device));
$('unit').onclick = () => { ui.unit = ui.unit === 'scale' ? 'offset' : 'scale'; $('unit').textContent = ui.unit === 'scale' ? '％ Scale' : '⌗ Pixels'; toast(ui.unit === 'scale' ? 'Déplacer en Scale : s\'adapte à tous les écrans' : 'Déplacer en pixels (Offset)'); };
$('bar').onclick = () => { ui.bar = !ui.bar; $('bar').classList.toggle('on', ui.bar); draw(); };
$('sky').onclick = () => { ui.dark = !ui.dark; $('sky').classList.toggle('on', ui.dark); draw(); };
$('up').onclick = () => { const n = sel(); if (!n) return toast('Rien de sélectionné'); const p = G.parentOf(proj.root, n.id); if (!p || p === proj.root) return toast('Déjà tout en haut'); select(p.id); };
$('play').onclick = () => { ui.play = !ui.play; $('play').classList.toggle('on', ui.play); $('play').textContent = ui.play ? '■' : '▶'; playVis.clear(); playState.clear();
  draw(); toast(ui.play ? '▶ Test : les boutons marchent comme dans Roblox' : 'Retour à l\'édition');
  if (ui.play) for (const w of G.windows(proj.root)) if (G.prop(w, 'Visible')) playOpen(w.id); };

// pointer: select / move / resize (edit mode)
let drag = null; const guides = [];
function clearGuides() { guides.splice(0).forEach((g) => g.remove()); }
function guide(kind, px) { const g = document.createElement('div'); g.className = 'guide ' + kind; const a = area.getBoundingClientRect();
  if (kind === 'v') Object.assign(g.style, { left: px - a.left + 'px', top: 0, bottom: 0 }); else Object.assign(g.style, { top: px - a.top + 'px', left: 0, right: 0 }); area.appendChild(g); guides.push(g); }
area.addEventListener('pointerdown', (e) => {
  if (ui.play) return;
  const h = e.target.closest('.h'), gn = e.target.closest('.gn');
  const n = selGui();
  if (h && n) { drag = { kind: 'resize', h: h.dataset.h, n, x0: e.clientX, y0: e.clientY, size0: G.prop(n, 'Size').slice(), moved: false }; area.setPointerCapture(e.pointerId); return; }
  if (!gn) { select(null); return; }
  const id = gn.dataset.id, selEl = n && elMap.get(n.id);
  // inside the selected element: drag moves it, a simple tap drills down to the child (like Figma)
  if (selEl && selEl.contains(gn) && id !== selId) { drag = { kind: 'maybe', n, drill: id, x0: e.clientX, y0: e.clientY, pos0: G.prop(n, 'Position').slice(), moved: false }; }
  else { if (id !== selId) select(id); const m = G.find(proj.root, id); drag = { kind: 'maybe', n: m, x0: e.clientX, y0: e.clientY, pos0: G.prop(m, 'Position').slice(), moved: false }; }
  area.setPointerCapture(e.pointerId);
});
area.addEventListener('pointermove', (e) => {
  if (!drag) return; const dx = (e.clientX - drag.x0) / fit, dy = (e.clientY - drag.y0) / fit;
  if (!drag.moved && Math.hypot(dx * fit, dy * fit) < 5) return;
  const el = elMap.get(drag.n.id); if (!el) return;
  const pw = el.parentElement.clientWidth || 1, ph = el.parentElement.clientHeight || 1;
  if (!drag.moved) { if (drag.kind === 'maybe' && parentLayout(drag.n)) { toast('Placé par une mise en page (UIListLayout / UIGridLayout) : change l\'ordre dans l\'Arbre'); drag = null; return; } snapshot(); drag.moved = true; }
  const q = (v, scale) => (scale ? Math.round(v * 1000) / 1000 : Math.round(v));
  clearGuides();
  if (drag.kind === 'maybe') {
    let p = drag.pos0.slice();
    if (ui.unit === 'scale') { p[0] = q(p[0] + dx / pw, 1); p[2] = q(p[2] + dy / ph, 1); } else { p[1] = q(p[1] + dx); p[3] = q(p[3] + dy); }
    drag.n.props.Position = p; el.style.left = `calc(${p[0] * 100}% + ${p[1]}px)`; el.style.top = `calc(${p[2] * 100}% + ${p[3]}px)`;
    // magnetic centre guides
    const r = el.getBoundingClientRect(), pr = el.parentElement.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, pcx = pr.left + pr.width / 2, pcy = pr.top + pr.height / 2;
    if (Math.abs(cx - pcx) < 5) { const fix = (pcx - cx) / fit; if (ui.unit === 'scale') p[0] = q(p[0] + fix / pw, 1); else p[1] = q(p[1] + fix); guide('v', pcx); }
    if (Math.abs(cy - pcy) < 5) { const fix = (pcy - cy) / fit; if (ui.unit === 'scale') p[2] = q(p[2] + fix / ph, 1); else p[3] = q(p[3] + fix); guide('hz', pcy); }
    drag.n.props.Position = p; el.style.left = `calc(${p[0] * 100}% + ${p[1]}px)`; el.style.top = `calc(${p[2] * 100}% + ${p[3]}px)`;
  } else {
    const s = drag.size0.slice(), wx = drag.h !== 's', hy = drag.h !== 'e';
    if (ui.unit === 'scale') { if (wx) s[0] = Math.max(0, q(s[0] + dx / pw, 1)); if (hy) s[2] = Math.max(0, q(s[2] + dy / ph, 1)); }
    else { if (wx) s[1] = q(s[1] + dx); if (hy) s[3] = q(s[3] + dy); }
    drag.n.props.Size = s; el.style.width = `calc(${s[0] * 100}% + ${s[1]}px)`; el.style.height = `calc(${s[2] * 100}% + ${s[3]}px)`;
  }
  G.applyTransform(el, {}); updateSel();
});
const endDrag = () => { const d = drag; drag = null; clearGuides(); if (!d) return;
  if (d.moved) { save(); draw(); if (ui.tab === 'props') renderPane(); } else if (d.drill) select(d.drill); };
area.addEventListener('pointerup', endDrag); area.addEventListener('pointercancel', endDrag);
{ let y0 = null, h0 = 0; const grip = $('grip');
  grip.addEventListener('pointerdown', (e) => { y0 = e.clientY; h0 = $('view').getBoundingClientRect().height; grip.setPointerCapture(e.pointerId); });
  grip.addEventListener('pointermove', (e) => { if (y0 == null) return; const h = Math.max(innerHeight * 0.3, Math.min(innerHeight * 0.82, h0 + e.clientY - y0)); document.documentElement.style.setProperty('--vh', h + 'px'); draw(); });
  grip.addEventListener('pointerup', () => (y0 = null)); }

/* =====================================================================
   3. PREVIEW RUNTIME - same engine as kit/ForgeGuiAnim.client.lua
   ===================================================================== */
let states = new Map(); const playVis = new Map(), playState = new Map(); const t0 = performance.now(); const now = () => (performance.now() - t0) / 1000;
function startRuntime() {
  states = new Map();
  G.walk(proj.root, (n) => { const a = n.anim; if (!a || G.isMod(n.cls)) return; const el = elMap.get(n.id); if (!el) return;
    if ((a.idle && a.idle !== 'none') || a.open || a.hover || a.press) states.set(n.id, { n, el, chs: new G.Channels(), idle: a.idle && a.idle !== 'none' ? a.idle : null, period: a.period || 1.6 }); });
  if (ui.play) wirePlay();
}
function stOf(id) { let s = states.get(id); if (!s) { const n = G.find(proj.root, id), el = elMap.get(id); if (!el) return null; s = { n, el, chs: new G.Channels(), idle: null, period: 1.6 }; states.set(id, s); } return s; }
const gradOverride = (n, el, i) => { // shine / rainbow: redraw the gradient with the moving offset / rotation
  const g = G.mod(n, 'UIGradient'); if (!g) return; const g2 = { ...g, props: { ...g.props, Offset: [i.G ?? (G.prop(g, 'Offset') || [0, 0])[0], 0], Rotation: (G.prop(g, 'Rotation') || 0) + (i.GR || 0) } };
  const T = theme();
  if (G.isText(n.cls)) { const span = el.querySelector(':scope > .gc > .gt'); if (span) span.style.backgroundImage = G.gradCss(g2, T, G.color(G.prop(n, 'TextColor3'), T), 1 - G.prop(n, 'TextTransparency')); }
  else if (G.prop(n, 'BackgroundTransparency') < 1) el.style.background = G.gradCss(g2, T, G.color(G.prop(n, 'BackgroundColor3'), T), 1 - G.prop(n, 'BackgroundTransparency'));
};
function tick() {
  requestAnimationFrame(tick);
  const t = now();
  for (const st of states.values()) {
    if (!st.el.isConnected) continue;
    const busy = st.chs.step(t); if (!busy && !st.idle && !st.dirty) continue; st.dirty = busy;
    const v = st.chs.v, i = st.idle ? G.idleAt(st.idle, t, st.period) : {};
    G.applyTransform(st.el, { S: v.S_open * v.S_hover * v.S_press * (i.S ?? 1), X: v.X_open, Y: v.Y_open, Yo: v.Yo_hover + (i.Yo || 0), R: v.R_open + (i.R || 0) });
    if (i.G !== undefined || i.GR !== undefined) gradOverride(st.n, st.el, i);
    if (st.n.anim && st.n.anim.hover === 'glow') { const sk = G.mod(st.n, 'UIStroke'); if (sk) st.el.style.boxShadow = `0 0 0 ${G.prop(sk, 'Thickness') * (1 + v.G_hover)}px ${G.color(G.prop(sk, 'Color'), theme())}`; }
  }
  if (!ui.play && selId && drag == null && states.has(selId)) updateSel();
}
requestAnimationFrame(tick);
function replayOpen(id) { const n = G.find(proj.root, id), a = n && n.anim; if (!a || !a.open || a.open === 'none') return toast('Choisis d\'abord une animation d\'ouverture');
  const s = stOf(id); if (!s) return; G.openFrom(s.chs, a.open); G.openTo(s.chs, a.open, a.dur || 0.45, now()); s.dirty = true; }
// play mode: windows, buttons, binds, switches, RNG roll
function playOpen(id) { const n = G.find(proj.root, id); if (!n) return; playVis.set(id, true); draw(); const s = stOf(id); if (s && n.anim && n.anim.open && n.anim.open !== 'none') { G.openFrom(s.chs, n.anim.open); G.openTo(s.chs, n.anim.open, n.anim.dur || 0.45, now()); s.dirty = true; } }
function playClose(id) { const n = G.find(proj.root, id), s = stOf(id); if (!n) return; const kind = n.anim && n.anim.open;
  if (!s || !kind || kind === 'none') { playVis.set(id, false); draw(); return; }
  const d = G.closeTo(s.chs, kind, n.anim.dur || 0.45, now()); s.dirty = true; s.closing = true; setTimeout(() => { playVis.set(id, false); draw(); }, d * 1000); }
const visNow = (n) => (playVis.has(n.id) ? playVis.get(n.id) : G.prop(n, 'Visible'));
function windowOf(n) { let p = G.parentOf(proj.root, n.id); while (p && p !== proj.root) { if (p.anim && (p.anim.window || (p.anim.open && p.anim.open !== 'none'))) return p; p = G.parentOf(proj.root, p.id); } return null; }
const SAMPLE = { Coins: 12500, Gems: 340 };
function reapplyPlayState() {
  for (const [id, st] of playState) { const el = elMap.get(id), n = G.find(proj.root, id); if (!el || !n) continue; const span = el.querySelector(':scope > .gc > .gt');
    if (st.text != null && span) { span.textContent = st.text; if (st.color) span.style.color = st.color; }
    if (st.bg) el.style.background = st.bg; }
  G.walk(proj.root, (n) => { if (n.anim && n.anim.bind && !playState.has(n.id)) { const el = elMap.get(n.id), span = el && el.querySelector(':scope > .gc > .gt');
    if (span) span.textContent = (n.anim.format || '{v}').replace('{v}', G.abbreviate(SAMPLE[n.anim.bind] ?? 1000)); } });
  G.layoutPass(stage);
}
function wirePlay() {
  for (const [id, el] of elMap) {
    const n = G.find(proj.root, id), a = n.anim || {};
    if (a.hover && a.hover !== 'none') {
      el.addEventListener('pointerenter', () => { const s = stOf(id); if (a.hover === 'grow') s.chs.to('S_hover', 1.07, 0.15, 'Quad', 'Out', now()); else if (a.hover === 'lift') s.chs.to('Yo_hover', -4, 0.15, 'Quad', 'Out', now()); else s.chs.to('G_hover', 1, 0.2, 'Quad', 'Out', now()); s.dirty = true; });
      el.addEventListener('pointerleave', () => { const s = stOf(id); s.chs.to('S_hover', 1, 0.2, 'Quad', 'Out', now()); s.chs.to('Yo_hover', 0, 0.2, 'Quad', 'Out', now()); s.chs.to('G_hover', 0, 0.25, 'Quad', 'Out', now()); s.dirty = true; });
    }
    if (a.press && a.press !== 'none') {
      el.addEventListener('pointerdown', () => { const s = stOf(id); if (a.press === 'squish') s.chs.to('S_press', 0.9, 0.08, 'Quad', 'Out', now()); else { s.chs.set('S_press', 0.85); s.chs.to('S_press', 1, 0.6, 'Elastic', 'Out', now()); } s.dirty = true; });
      el.addEventListener('pointerup', () => { if (a.press === 'squish') { const s = stOf(id); s.chs.to('S_press', 1, 0.35, 'Back', 'Out', now()); s.dirty = true; } });
    }
    if (G.isButton(n.cls) && a.action && a.action !== 'none') el.addEventListener('click', (e) => { e.stopPropagation(); act(n); });
  }
}
function act(n) {
  const a = n.anim;
  if (a.action === 'toggle') {
    let win = null; G.walk(proj.root, (x) => { if (!win && x.name === a.target && !G.isMod(x.cls)) win = x; });
    if (!win) return toast('Aucune fenêtre nommée « ' + (a.target || '?') + ' »');
    if (visNow(win)) playClose(win.id);
    else { if (win.anim && win.anim.window) for (const o of G.windows(proj.root)) if (o !== win && visNow(o)) playClose(o.id); playOpen(win.id); }
  } else if (a.action === 'close') { const w = windowOf(n); if (w) playClose(w.id); }
  else if (a.action === 'switch') { const el = elMap.get(n.id), cur = playState.get(n.id), on = cur ? !cur.on : G.prop(n, 'Text') === 'OFF';
    const bg = on ? (G.prop(n, 'Text') === 'OFF' ? '#3dffa8' : G.color(G.prop(n, 'BackgroundColor3'), theme())) : (G.prop(n, 'Text') === 'OFF' ? G.color(G.prop(n, 'BackgroundColor3'), theme()) : '#ff4d6d');
    playState.set(n.id, { on, text: on ? 'ON' : 'OFF', bg }); reapplyPlayState(); const s = stOf(n.id); s.chs.set('S_press', 0.85); s.chs.to('S_press', 1, 0.5, 'Back', 'Out', now()); s.dirty = true; void el; }
  else if (a.action === 'roll') roll(n);
}
async function roll(btn) {
  if (btn._rolling) return; const a = btn.anim, scope = windowOf(btn) || proj.root;
  let target = null; G.walk(scope, (x) => { if (!target && x.name === (a.target || 'Result')) target = x; });
  const items = G.parseRoll(a.items); if (!target || !items.length) return toast('Tirage : choisis le texte cible et les lots');
  const nameNode = (() => { const p = G.parentOf(proj.root, target.id); return p && p.children.find((c) => c.name === target.name + 'Name'); })();
  btn._rolling = true; const t1 = performance.now(); let last = null;
  const show = (it) => { playState.set(target.id, { text: it.name, color: it.c }); reapplyPlayState(); };
  while (performance.now() - t1 < 2200) { const k = (performance.now() - t1) / 2200, it = items[Math.floor(Math.random() * items.length)]; if (it !== last) { show(it); last = it; }
    await new Promise((r) => setTimeout(r, (0.04 + 0.28 * G.ease('Quad', 'In', k)) * 1000)); }
  const pick = G.pickRoll(items, Math.random()), tot = items.reduce((s, i) => s + i.w, 0); show(pick);
  if (nameNode) { playState.set(nameNode.id, { text: `✨ ${pick.name} · 1 chance sur ${G.abbreviate(Math.max(1, Math.round(tot / Math.max(pick.w, 1e-9))))}` }); reapplyPlayState(); }
  const s = stOf(target.id); if (s) { s.chs.set('S_open', 0.35); s.chs.to('S_open', 1, 0.8, 'Elastic', 'Out', now()); if (pick.w / tot < 0.05) { s.chs.set('R_open', -18); s.chs.to('R_open', 0, 0.9, 'Elastic', 'Out', now()); } s.dirty = true; }
  btn._rolling = false; window.__lastRoll = pick.name;
}

/* =====================================================================
   4. PANES
   ===================================================================== */
const pane = $('pane');
function setTab(id) { ui.tab = id; document.querySelectorAll('.tab[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === id)); renderPane(); pane.scrollTop = 0; }
document.querySelectorAll('.tab[data-tab]').forEach((b) => b.onclick = () => setTab(b.dataset.tab));
const LIB = createLibrary({ studio: 'gui', toast });
function renderPane() { ({ tpl: paneTpl, tree: paneTree, props: paneProps, anim: paneAnim, lib: () => LIB.render(pane), code: paneCode, export: paneExport })[ui.tab](); }

/* ---------- templates + themes ---------- */
function themeDots(t) { return `<span class="dots">${['panel', 'primary', 'primary2', 'accent'].map((k) => `<i style="background:${t[k]}"></i>`).join('')}</span>`; }
function paneTpl() {
  const q = norm(ui.q), list = TEMPLATES.filter((t) => !q || norm(t.label + ' ' + t.tags).split(/\s+/).some((w) => q.split(/\s+/).every((p) => norm(t.label + ' ' + t.tags).includes(p))));
  pane.innerHTML = `<div class="sec"><h3>Thème <small>toutes les couleurs suivent</small></h3>
      <div class="themes">${Object.entries(G.THEMES).map(([id, t]) => `<button class="th${proj.theme === id ? ' on' : ''}" data-th="${id}">${themeDots(t)}${t.label}</button>`).join('')}
      ${proj.customTheme ? `<button class="th${proj.theme === 'custom' ? ' on' : ''}" data-th="custom">${themeDots(proj.customTheme)}${esc(proj.customTheme.label || 'Perso')}</button>` : ''}</div>
      <div class="btns"><label class="btn pri" style="cursor:pointer">🎨 Couleurs de mon jeu (image)<input type="file" id="themeImg" accept="image/*" hidden></label><button class="btn" id="editTheme">🖌️ Régler le thème</button></div>
      <div id="themeEd"></div></div>
    <div class="sec"><h3>🧱 Kit Stud <small>style simulateurs populaires</small></h3>
      <div class="note" style="margin-bottom:8px">Panneaux colorés à picots, gros contours noirs, police ronde : HUD + 8 fenêtres reliées à leurs boutons. Les picots sont de vrais objets créés en jeu par ForgeGuiAnim.</div>
      <div class="btns"><button class="btn pri" id="studAll" style="flex:1">🧱 Ajouter le kit Stud complet</button></div></div>
    <div class="sec"><h3>Modèles <small>${list.length} / ${TEMPLATES.length}</small></h3>
      <input class="search" id="tq" placeholder="🔎 boutique, œuf, rng, quêtes, hud…" value="${esc(ui.q)}">
      <div class="tpls" style="margin-top:10px">${list.map((t) => `<div class="tpl"><div class="mini" data-mini="${t.id}"></div><div class="meta"><span>${t.e}</span><b>${t.label}</b><button data-add="${t.id}">＋ Ajouter</button></div></div>`).join('') || '<div class="note">Aucun modèle pour cette recherche.</div>'}</div></div>`;
  $('tq').oninput = (e) => { ui.q = e.target.value; const pos = e.target.selectionStart; paneTpl(); const i = $('tq'); i.focus(); i.setSelectionRange(pos, pos); };
  pane.querySelectorAll('[data-th]').forEach((b) => b.onclick = () => { snapshot(); proj.theme = b.dataset.th; save(); draw(); paneTpl(); toast('Thème ' + theme().label); });
  pane.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => addTemplate(b.dataset.add));
  $('studAll').onclick = () => { snapshot(); proj.theme = 'stud'; const before = proj.root.children.length;
    for (const id of STUD_ALL) { const t = TEMPLATES.find((x) => x.id === id); for (const n of t.make(!t.win)) { n.name = G.uniqueName(proj.root, n.name); proj.root.children.push(n); } }
    save(); draw(); paneTpl(); toast('🧱 Kit Stud : ' + (proj.root.children.length - before) + ' éléments ajoutés · ▶ pour tester'); };
  $('themeImg').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const img = new Image(); img.onload = () => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 64, 64);
    const t = G.themeFromPixels(g.getImageData(0, 0, 64, 64).data, 'Mon jeu'); URL.revokeObjectURL(img.src); if (!t) return toast('Image illisible');
    snapshot(); proj.customTheme = t; proj.theme = 'custom'; save(); draw(); paneTpl(); toast('🎨 Thème créé depuis ton image'); }; img.src = URL.createObjectURL(f); };
  $('editTheme').onclick = () => themeEditor();
  // live mini previews of each template with the current theme
  pane.querySelectorAll('[data-mini]').forEach((box) => { const t = TEMPLATES.find((x) => x.id === box.dataset.mini), root = G.N('ScreenGui', 'M', {}, t.make(true));
    const ms = document.createElement('div'); ms.className = 'ms'; ms.style.width = '844px'; ms.style.height = '390px'; box.appendChild(ms);
    const k = box.clientWidth / 844; ms.style.transform = `scale(${k})`; box.style.height = 390 * k + 'px'; G.render(root, theme(), ms, {}); });
}
function themeEditor() {
  if (proj.theme !== 'custom') { snapshot(); proj.customTheme = { ...clone(theme()), label: theme().label + ' perso' }; proj.theme = 'custom'; save(); draw(); paneTpl(); }
  const T = proj.customTheme, box = $('themeEd');
  box.innerHTML = `<div class="modcard">${G.TOKENS.map((k) => `<div class="row"><label>${G.TOKEN_FR[k]}</label><div class="colorrow"><input type="color" data-tk="${k}" value="${T[k]}"><code class="inl">$${k}</code></div></div>`).join('')}
    <div class="row"><label>Police</label><select id="tFont">${Object.keys(G.FONTS).map((f) => `<option${f === T.font ? ' selected' : ''}>${f}</option>`).join('')}</select></div>
    <div class="row"><label>Nom</label><input type="text" id="tName" value="${esc(T.label)}"></div></div>`;
  let sn = false; const once = () => { if (!sn) { snapshot(); sn = true; } };
  box.querySelectorAll('[data-tk]').forEach((i) => i.oninput = () => { once(); T[i.dataset.tk] = i.value; save(); draw(); });
  $('tFont').onchange = (e) => { once(); T.font = e.target.value; save(); draw(); };
  $('tName').oninput = (e) => { once(); T.label = e.target.value; save(); };
}
function addTemplate(id) {
  const t = TEMPLATES.find((x) => x.id === id); snapshot();
  if (t.theme && proj.theme !== t.theme && !proj.root.children.some((c) => /^Stud|^Money$|^TopBar$/.test(c.name))) { proj.theme = t.theme; toast('🧱 Thème Stud activé'); }
  const hasHud = proj.root.children.some((c) => c.name === 'Menu' || c.name === 'Currency');
  const nodes = t.make(!(t.win && hasHud));
  for (const n of nodes) { const base = n.name; n.name = G.uniqueName(proj.root, base); if (n.name !== base) toast('Déjà un « ' + base + ' » : renommé ' + n.name); proj.root.children.push(n); }
  save(); draw(); selId = nodes[0].id; updateSel(); toast(t.e + ' ' + t.label + ' ajouté' + (t.win && hasHud ? ' (s\'ouvre avec son bouton du HUD, ▶ pour tester)' : ''));
  if (t.win && hasHud) { playVis.clear(); }
}

/* ---------- hierarchy ---------- */
const ADDABLE = ['Frame', 'TextLabel', 'TextButton', 'TextBox', 'ImageLabel', 'ImageButton', 'ScrollingFrame'];
const NEWPROPS = { Frame: { Size: [0, 160, 0, 100], BackgroundColor3: '$panel' }, TextLabel: { Size: [0, 180, 0, 40], Text: 'Texte', BackgroundTransparency: 1, TextColor3: '$text', Font: '$font' },
  TextButton: { Size: [0, 160, 0, 50], Text: 'Bouton', BackgroundColor3: '$primary', TextColor3: '$text', Font: '$font' }, TextBox: { Size: [0, 200, 0, 40], Text: '', BackgroundColor3: '$panel', TextColor3: '$text', Font: '$font' },
  ImageLabel: { Size: [0, 100, 0, 100], BackgroundTransparency: 1 }, ImageButton: { Size: [0, 100, 0, 100], BackgroundTransparency: 1 },
  ScrollingFrame: { Size: [0, 260, 0, 180], BackgroundColor3: '$panel', BackgroundTransparency: 0.2, AutomaticCanvasSize: 'Y' } };
function paneTree() {
  const rows = []; G.walk(proj.root, (n, p, d) => { rows.push({ n, d }); });
  const n = sel();
  pane.innerHTML = `<div class="sec"><h3>🌳 ${esc(proj.root.name)} <small>${rows.length - 1} objets</small></h3><ul class="tree">${rows.map(({ n: x, d }) => `<li data-id="${x.id}" class="${x.id === selId ? 'on' : ''}${G.isMod(x.cls) ? ' mod' : ''}${x.eh ? ' hid' : ''}" style="padding-left:${8 + Math.min(d, 8) * 13}px">
      <span class="ic">${G.ICON[x.cls] || '•'}</span><span class="nm">${esc(x.name)}</span>${G.isMod(x.cls) || x.cls === 'ScreenGui' ? '' : `<span class="cl">${x.cls}</span><button class="eye" data-eye="${x.id}" title="Cacher dans l'éditeur">${x.eh ? '🙈' : '👁'}</button>`}</li>`).join('')}</ul></div>
    <div class="sec"><h3>${n ? esc(n.name) : 'Rien de sélectionné'}</h3>
      <div class="btns"><button class="btn" id="tDup"${n && n !== proj.root ? '' : ' disabled'}>⧉ Dupliquer</button><button class="btn" id="tUp"${n && n !== proj.root ? '' : ' disabled'}>↑</button><button class="btn" id="tDown"${n && n !== proj.root ? '' : ' disabled'}>↓</button>
      <button class="btn" id="tOut"${n && n !== proj.root && G.parentOf(proj.root, n.id) !== proj.root ? '' : ' disabled'}>⇱ Sortir</button><button class="btn danger" id="tDel"${n && n !== proj.root ? '' : ' disabled'}>🗑</button></div>
      <div class="note" style="margin-top:8px">Ajouter dans <b>${n && !G.isMod(n.cls) ? esc(n.name) : esc(proj.root.name)}</b> :</div>
      <div class="addgrid">${ADDABLE.map((c) => `<button data-new="${c}">${G.ICON[c]} ${c}</button>`).join('')}</div></div>`;
  pane.querySelectorAll('.tree li').forEach((li) => li.onclick = (e) => { if (e.target.closest('.eye')) return; select(li.dataset.id); });
  pane.querySelectorAll('[data-eye]').forEach((b) => b.onclick = () => { const x = G.find(proj.root, b.dataset.eye); x.eh = !x.eh; save(); draw(); paneTree(); });
  pane.querySelectorAll('[data-new]').forEach((b) => b.onclick = () => { snapshot(); const parent = n && !G.isMod(n.cls) ? n : proj.root, cls = b.dataset.new;
    const x = G.N(cls, G.uniqueName(proj.root, cls), clone(NEWPROPS[cls]), cls === 'TextButton' ? [G.corner(0, 12)] : []);
    if (parent === proj.root) { x.props.Position = [0.5, 0, 0.5, 0]; x.props.AnchorPoint = [0.5, 0.5]; }
    if (cls === 'TextButton') x.anim = { hover: 'grow', press: 'squish' };
    parent.children.push(x); save(); draw(); select(x.id); setTab('props'); toast(G.ICON[cls] + ' ' + cls + ' ajouté'); });
  if (!n || n === proj.root) return;
  const p = G.parentOf(proj.root, n.id), sib = p.children, i = sib.indexOf(n);
  $('tDup').onclick = () => { snapshot(); const c = G.cloneNode(n); c.name = G.uniqueName(proj.root, n.name); if (!G.isMod(c.cls) && !parentLayout(n)) { const pp = G.prop(c, 'Position').slice(); pp[1] += 16; pp[3] += 16; c.props.Position = pp; }
    sib.splice(i + 1, 0, c); save(); draw(); select(c.id); };
  const move = (d) => { const j = i + d; if (j < 0 || j >= sib.length) return; snapshot(); [sib[i], sib[j]] = [sib[j], sib[i]];
    if (!G.isMod(n.cls) && parentLayout(n)) G.guiKids(p).forEach((c, k) => { c.props.LayoutOrder = k; }); save(); draw(); paneTree(); };
  $('tUp').onclick = () => move(-1); $('tDown').onclick = () => move(1);
  $('tOut').onclick = () => { const gp = G.parentOf(proj.root, p.id); if (!gp) return; snapshot(); sib.splice(i, 1); gp.children.splice(gp.children.indexOf(p) + 1, 0, n); save(); draw(); paneTree(); };
  $('tDel').onclick = () => { snapshot(); sib.splice(i, 1); selId = null; save(); draw(); paneTree(); toast('Supprimé (↶ pour annuler)'); };
}

/* ---------- properties (every Roblox property, modifiers inline) ---------- */
function field(n, [k, type, label]) {
  const v = G.prop(n, k), id = `f_${k}`;
  if (type === 'udim2') return `<div class="row"><label>${label}</label><div class="u2" data-k="${k}" data-t="udim2"><div class="cap"><span>X ％</span><span>X px</span><span>Y ％</span><span>Y px</span></div>${v.map((x, i) => `<input type="number" inputmode="decimal" step="${i % 2 ? 1 : 0.01}" data-i="${i}" value="${+(+x).toFixed(4)}">`).join('')}</div></div>`;
  if (type === 'udim') return `<div class="row"><label>${label}</label><div class="vec" data-k="${k}" data-t="udim"><input type="number" step="0.01" data-i="0" value="${v[0]}" title="Scale"><input type="number" step="1" data-i="1" value="${v[1]}" title="px"></div></div>`;
  if (type === 'vec2') return `<div class="row"><label>${label}</label><div class="vec" data-k="${k}" data-t="vec2"><input type="number" step="0.05" data-i="0" value="${v[0]}"><input type="number" step="0.05" data-i="1" value="${v[1]}"></div></div>`;
  if (type === 'color') { const tok = typeof v === 'string' && v[0] === '$' ? v.slice(1) : null, hex = G.color(v, theme());
    return `<div class="row"><label>${label}</label><div class="colorrow" data-k="${k}" data-t="color"><input type="color" value="${hex}">${G.TOKENS.map((t) => `<button class="tok${tok === t ? ' on' : ''}" data-tok="${t}" title="${G.TOKEN_FR[t]}" style="background:${theme()[t]}"></button>`).join('')}${tok ? `<span class="linked">🔗 ${G.TOKEN_FR[tok]}</span>` : ''}</div></div>`; }
  if (type === 't01') return `<div class="row"><label>${label}</label><input type="range" min="0" max="1" step="0.01" data-k="${k}" data-t="num" value="${v}"><span class="val">${(+v).toFixed(2)}</span></div>`;
  if (type === 'bool') return `<div class="row"><label>${label}</label><button class="sw${v ? ' on' : ''}" data-k="${k}" data-t="bool"></button></div>`;
  if (type === 'text') return k === 'Text' ? `<div class="row"><label>${label}</label><textarea data-k="${k}" data-t="text" rows="2">${esc(v)}</textarea></div>` : `<div class="row"><label>${label}</label><input type="text" data-k="${k}" data-t="text" value="${esc(v)}"></div>`;
  if (type === 'image') return `<div class="row"><label>${label}</label><input type="text" data-k="${k}" data-t="text" placeholder="rbxassetid://123456" value="${esc(v)}"></div>`;
  if (type.startsWith('enum:')) { const E = type.slice(5), opts = E === 'Font' ? ['$font', ...G.ENUMS.Font] : G.ENUMS[E];
    return `<div class="row"><label>${label}</label><select data-k="${k}" data-t="enum">${opts.map((o) => `<option value="${o}"${o === v ? ' selected' : ''}>${o === '$font' ? 'Police du thème (' + theme().font + ')' : o}</option>`).join('')}</select></div>`; }
  if (type === 'colorseq') return `<div class="row" style="align-items:flex-start"><label>${label}</label><div class="stops" data-k="${k}" data-t="colorseq"><div class="gradbar" style="background:linear-gradient(90deg,${[...v].sort((a, b) => a.t - b.t).map((s) => `${G.color(s.c, theme())} ${s.t * 100}%`).join(',')})"></div>
    ${v.map((s, i) => `<div class="stop"><input type="range" min="0" max="1" step="0.01" data-si="${i}" value="${s.t}"><input type="color" data-sc="${i}" value="${G.color(s.c, theme())}"><select data-stok="${i}"><option value="">—</option>${G.TOKENS.map((t) => `<option value="$${t}"${s.c === '$' + t ? ' selected' : ''}>${G.TOKEN_FR[t]}</option>`).join('')}</select>${v.length > 2 ? `<button class="btn" data-sdel="${i}">✕</button>` : ''}</div>`).join('')}
    <button class="btn" data-sadd="1">＋ Couleur</button></div></div>`;
  if (type === 'numseq') return `<div class="row" style="align-items:flex-start"><label>${label}</label><div class="stops" data-k="${k}" data-t="numseq">${v.map((s, i) => `<div class="stop"><input type="range" min="0" max="1" step="0.01" data-ni="${i}" value="${s.t}" title="position"><input type="range" min="0" max="1" step="0.01" data-nv="${i}" value="${s.v}" title="transparence"></div>`).join('')}<button class="btn" data-nadd="1">＋ Point</button></div></div>`;
  return `<div class="row"><label>${label}</label><input type="number" step="${type === 'int' ? 1 : 0.1}" data-k="${k}" data-t="num" value="${v}"></div>`;
}
function bindFields(box, n, rerender) {
  let sn = false; const once = () => { if (!sn) { snapshot(); sn = true; } };
  const commit = (k, v, full) => { once(); n.props = n.props || {}; n.props[k] = v; save(); draw(); if (full) rerender(); };
  box.querySelectorAll('[data-t="udim2"],[data-t="udim"],[data-t="vec2"]').forEach((g) => g.querySelectorAll('input').forEach((inp) => inp.onchange = () => { const v = G.prop(n, g.dataset.k).slice(), x = parseFloat(inp.value); if (!isFinite(x)) return; v[+inp.dataset.i] = x; commit(g.dataset.k, v); }));
  box.querySelectorAll('[data-t="color"]').forEach((g) => { g.querySelector('input').oninput = (e) => commit(g.dataset.k, e.target.value);
    g.querySelector('input').onchange = () => rerender(); g.querySelectorAll('[data-tok]').forEach((b) => b.onclick = () => commit(g.dataset.k, '$' + b.dataset.tok, true)); });
  box.querySelectorAll('input[data-t="num"]').forEach((i) => { i.oninput = () => { const x = parseFloat(i.value); if (!isFinite(x)) return; if (i.nextElementSibling && i.nextElementSibling.classList.contains('val')) i.nextElementSibling.textContent = x.toFixed(2); if (i.type === 'range') commit(i.dataset.k, x); };
    i.onchange = () => { const x = parseFloat(i.value); if (isFinite(x)) commit(i.dataset.k, x); }; });
  box.querySelectorAll('[data-t="bool"]').forEach((b) => b.onclick = () => commit(b.dataset.k, !G.prop(n, b.dataset.k), true));
  box.querySelectorAll('[data-t="text"]').forEach((i) => i.oninput = () => commit(i.dataset.k, i.value));
  box.querySelectorAll('select[data-t="enum"]').forEach((s) => s.onchange = () => commit(s.dataset.k, s.value));
  box.querySelectorAll('[data-t="colorseq"]').forEach((g) => { const k = g.dataset.k, v = () => clone(G.prop(n, k));
    g.querySelectorAll('[data-si]').forEach((r) => r.oninput = () => { const s = v(); s[+r.dataset.si].t = +r.value; commit(k, s); });
    g.querySelectorAll('[data-si]').forEach((r) => r.onchange = () => rerender());
    g.querySelectorAll('[data-sc]').forEach((c) => c.oninput = () => { const s = v(); s[+c.dataset.sc].c = c.value; commit(k, s); });
    g.querySelectorAll('[data-stok]').forEach((c) => c.onchange = () => { if (!c.value) return; const s = v(); s[+c.dataset.stok].c = c.value; commit(k, s, true); });
    g.querySelectorAll('[data-sdel]').forEach((b) => b.onclick = () => { const s = v(); s.splice(+b.dataset.sdel, 1); commit(k, s, true); });
    g.querySelector('[data-sadd]').onclick = () => { const s = v(); s.push({ t: 0.5, c: '$accent' }); commit(k, s, true); }; });
  box.querySelectorAll('[data-t="numseq"]').forEach((g) => { const k = g.dataset.k, v = () => clone(G.prop(n, k));
    g.querySelectorAll('[data-ni]').forEach((r) => r.oninput = () => { const s = v(); s[+r.dataset.ni].t = +r.value; commit(k, s); });
    g.querySelectorAll('[data-nv]').forEach((r) => r.oninput = () => { const s = v(); s[+r.dataset.nv].v = +r.value; commit(k, s); });
    g.querySelector('[data-nadd]').onclick = () => { const s = v(); s.push({ t: 0.5, v: 0.5 }); commit(k, s, true); }; });
}
const MOD_FR = { UICorner: 'Coins arrondis', UIStroke: 'Contour', UIGradient: 'Dégradé', UIPadding: 'Marges', UIListLayout: 'Liste auto', UIGridLayout: 'Grille auto', UIAspectRatioConstraint: 'Garder les proportions', UIScale: 'Échelle', UITextSizeConstraint: 'Taille texte min/max' };
function paneProps() {
  const n = sel() === proj.root ? null : sel();
  if (!n) { pane.innerHTML = '<div class="note" style="margin:12px 2px">Touche un élément dans l\'aperçu (ou dans 🌳 Arbre) pour régler <b>toutes</b> ses propriétés Roblox.</div>' + `<div class="sec"><h3>${G.ICON.ScreenGui} ${esc(proj.root.name)} <small>ScreenGui</small></h3><div id="pf"></div></div>`;
    const box = $('pf'); box.innerHTML = `<div class="row"><label>Nom</label><input type="text" id="pName" value="${esc(proj.root.name)}"></div>` + G.SCHEMA.ScreenGui.map((f) => field(proj.root, f)).join('');
    bindFields(box, proj.root, paneProps); $('pName').oninput = (e) => { proj.root.name = e.target.value.replace(/[^\w]/g, '') || 'ForgeGui'; save(); $('projName').textContent = proj.root.name; }; return; }
  if (G.isMod(n.cls)) { const p = G.parentOf(proj.root, n.id); select(p.id); return; }
  const mods = n.children.filter((c) => G.isMod(c.cls)), can = G.MODS.filter((m) => !mods.some((x) => x.cls === m) && (m !== 'UITextSizeConstraint' || G.isText(n.cls)));
  pane.innerHTML = `<div class="sec"><h3>${G.ICON[n.cls]} ${esc(n.name)} <small>${n.cls}</small></h3><div id="pf"></div></div>
    <div class="sec"><h3>Modificateurs <small>${mods.length}</small></h3><div id="mods"></div><div class="addgrid">${can.map((m) => `<button data-mod="${m}">${G.ICON[m]} ${MOD_FR[m]}</button>`).join('')}</div></div>`;
  const box = $('pf');
  box.innerHTML = `<div class="row"><label>Nom</label><input type="text" id="pName" value="${esc(n.name)}"></div>` + (G.SCHEMA[n.cls] || []).map((f) => field(n, f)).join('')
    + (parentLayout(n) ? '<div class="note">Placé par la mise en page du parent : Position est ignorée, l\'ordre vient de « Ordre » (LayoutOrder).</div>' : '');
  bindFields(box, n, paneProps);
  $('pName').onchange = (e) => { snapshot(); n.name = G.uniqueName(proj.root, e.target.value.replace(/[^\w]/g, '') || n.cls, n); save(); draw(); paneProps(); };
  const mbox = $('mods');
  mods.forEach((m) => { const card = document.createElement('div'); card.className = 'modcard'; card.innerHTML = `<h4>${G.ICON[m.cls]} ${MOD_FR[m.cls]} <small class="note">${m.cls}</small><button data-rm="${m.id}">✕</button></h4>` + G.SCHEMA[m.cls].map((f) => field(m, f)).join('');
    mbox.appendChild(card); bindFields(card, m, paneProps); });
  mbox.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { snapshot(); n.children = n.children.filter((c) => c.id !== b.dataset.rm); save(); draw(); paneProps(); });
  pane.querySelectorAll('[data-mod]').forEach((b) => b.onclick = () => { snapshot(); const cls = b.dataset.mod, init = { UIStroke: { Color: '$stroke' }, UIGradient: { Color: [{ t: 0, c: '$primary' }, { t: 1, c: '$primary2' }] } }[cls] || {};
    if (cls === 'UIGradient' && G.prop(n, 'BackgroundTransparency') < 1 && !G.isText(n.cls)) { n.props.BackgroundColor3 = '#ffffff'; }
    n.children.unshift(G.N(cls, cls, init)); save(); draw(); paneProps(); toast(G.ICON[cls] + ' ' + MOD_FR[cls] + ' ajouté'); });
}

/* ---------- animations + behaviours ---------- */
function paneAnim() {
  const n = selGui();
  if (!n) { pane.innerHTML = '<div class="note" style="margin:12px 2px">Touche un élément pour lui donner une animation d\'ouverture, de survol, d\'appui, une animation en continu, ou une action (ouvrir une fenêtre, tirage RNG…).</div>'; return; }
  const a = n.anim || (n.anim = {});
  const named = []; G.walk(proj.root, (x) => { if (x !== n && !G.isMod(x.cls) && x.cls !== 'ScreenGui' && x.anim && (x.anim.window || (x.anim.open && x.anim.open !== 'none'))) named.push(x.name); });
  const labels = []; G.walk(windowOfNode(n) || proj.root, (x) => { if (G.isText(x.cls) && x !== n) labels.push(x.name); });
  const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}"${(cur || 'none') === k ? ' selected' : ''}>${typeof v === 'string' ? v : v.fr}</option>`).join('');
  const items = G.parseRoll(a.items), tot = items.reduce((s, i) => s + i.w, 0) || 1;
  pane.innerHTML = `<div class="sec"><h3>🎬 ${esc(n.name)} <small>${n.cls}</small></h3>
      <div class="row"><label>Ouverture</label><select id="aOpen">${opt(G.OPEN, a.open)}</select><button class="btn" id="aReplay">▶</button></div>
      <div class="row"><label>Durée</label><input type="range" id="aDur" min="0.15" max="1.5" step="0.05" value="${a.dur || 0.45}"><span class="val">${(a.dur || 0.45).toFixed(2)}s</span></div>
      <div class="row"><label>Fenêtre</label><button class="sw${a.window ? ' on' : ''}" id="aWin"></button><span class="note">ferme les autres fenêtres quand elle s'ouvre</span></div>
      <div class="row"><label>Survol</label><select id="aHover">${opt(G.HOVER, a.hover)}</select></div>
      <div class="row"><label>Appui</label><select id="aPress">${opt(G.PRESS, a.press)}</select></div>
      <div class="row"><label>En continu</label><select id="aIdle">${opt(G.IDLE, a.idle)}</select></div>
      <div class="row"><label>Période</label><input type="range" id="aPer" min="0.4" max="8" step="0.1" value="${a.period || 1.6}"><span class="val">${(a.period || 1.6).toFixed(1)}s</span></div>
      ${a.idle === 'shine' || a.idle === 'rainbow' ? (G.mod(n, 'UIGradient') ? '' : '<div class="note">⚠️ Reflet / arc-en-ciel animent le <b>Dégradé</b> : ajoute-en un dans 🎛️ Propriétés.</div>') : ''}</div>
    ${G.isButton(n.cls) ? `<div class="sec"><h3>Quand on clique</h3>
      <div class="row"><label>Action</label><select id="aAct">${opt(G.ACTIONS, a.action)}</select></div>
      ${a.action === 'toggle' ? `<div class="row"><label>Fenêtre</label><select id="aTarget"><option value="">—</option>${named.map((x) => `<option${x === a.target ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></div>` : ''}
      ${a.action === 'roll' ? `<div class="row"><label>Texte résultat</label><select id="aTarget">${labels.map((x) => `<option${x === (a.target || 'Result') ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
        <div class="items" id="rollItems"><div class="note">Lots du tirage (nom · poids · couleur) — les chances se calculent seules :</div>${items.map((it, i) => `<div class="it"><input data-rn="${i}" value="${esc(it.name)}"><input data-rw="${i}" type="number" step="0.1" value="${it.w}"><input data-rc="${i}" type="color" value="${it.c}"><button data-rd="${i}">✕</button><span class="pc">${((it.w / tot) * 100).toFixed(it.w / tot < 0.01 ? 2 : 1)} % · 1 sur ${G.abbreviate(Math.round(tot / Math.max(it.w, 1e-9)))}</span></div>`).join('')}
        <button class="btn" id="rAdd">＋ Lot</button></div>` : ''}
      <div class="note" style="margin-top:6px">${{ toggle: 'Ouvre la fenêtre choisie avec son animation, la referme au 2e clic.', close: 'Ferme la fenêtre qui contient ce bouton.', roll: 'Fait défiler les lots comme une machine à sous, puis tire au sort selon les poids. Dans Roblox, le résultat est mis dans l\'attribut <code class="inl">ForgeLastRoll</code> du ScreenGui.', switch: 'Passe ON ↔ OFF. Ton script lit l\'attribut <code class="inl">ForgeOn</code> du bouton.', none: 'Aucune action automatique.' }[a.action || 'none']}</div></div>` : ''}
    ${n.cls === 'TextLabel' ? `<div class="sec"><h3>Valeur du joueur</h3><div class="row"><label>leaderstats</label><input type="text" id="aBind" placeholder="Coins" value="${esc(a.bind || '')}"></div>
      <div class="row"><label>Format</label><input type="text" id="aFmt" value="${esc(a.format || '{v}')}"></div><div class="note">Affiche <b>player.leaderstats.${esc(a.bind || 'Coins')}</b> en direct (12.5K, 3.2M…), avec un compteur animé quand ça change.</div></div>` : ''}
    <div class="sec"><div class="note">Toutes ces animations sont écrites en attributs Roblox (<code class="inl">ForgeOpen</code>, <code class="inl">ForgeIdle</code>…) et jouées par <b>ForgeGuiAnim</b> dans le jeu. Appuie sur <b>▶</b> en haut pour tout tester.</div></div>`;
  let sn = false; const once = () => { if (!sn) { snapshot(); sn = true; } };
  const set = (k, v, re) => { once(); if (v === 'none' || v === '' || v == null) delete a[k]; else a[k] = v; save(); draw(); if (re) paneAnim(); };
  $('aOpen').onchange = (e) => { set('open', e.target.value, true); if (a.open) replayOpen(n.id); };
  $('aReplay').onclick = () => replayOpen(n.id);
  $('aDur').oninput = (e) => { a.dur = +e.target.value; e.target.nextElementSibling.textContent = a.dur.toFixed(2) + 's'; once(); save(); };
  $('aDur').onchange = () => replayOpen(n.id);
  $('aWin').onclick = () => { set('window', !a.window || null, true); };
  $('aHover').onchange = (e) => set('hover', e.target.value); $('aPress').onchange = (e) => set('press', e.target.value);
  $('aIdle').onchange = (e) => set('idle', e.target.value, true);
  $('aPer').oninput = (e) => { a.period = +e.target.value; e.target.nextElementSibling.textContent = a.period.toFixed(1) + 's'; once(); save(); draw(); };
  if ($('aAct')) $('aAct').onchange = (e) => { set('action', e.target.value, true); if (a.action === 'roll' && !a.items) { a.items = 'Commun:60:#b8b8c8, Rare:25:#3ea0ff, Épique:10:#b05cff, Légendaire:4:#ffb300, Mythique:1:#ff3d6e'; save(); paneAnim(); } };
  if ($('aTarget')) $('aTarget').onchange = (e) => set('target', e.target.value);
  const writeItems = (list) => { once(); a.items = list.map((it) => `${it.name.replace(/[:,]/g, '')}:${it.w}:${it.c}`).join(', '); save(); };
  pane.querySelectorAll('[data-rn]').forEach((i) => i.onchange = () => { const l = G.parseRoll(a.items); l[+i.dataset.rn].name = i.value || 'Lot'; writeItems(l); paneAnim(); });
  pane.querySelectorAll('[data-rw]').forEach((i) => i.onchange = () => { const l = G.parseRoll(a.items); l[+i.dataset.rw].w = Math.max(0, +i.value || 0); writeItems(l); paneAnim(); });
  pane.querySelectorAll('[data-rc]').forEach((i) => i.onchange = () => { const l = G.parseRoll(a.items); l[+i.dataset.rc].c = i.value; writeItems(l); });
  pane.querySelectorAll('[data-rd]').forEach((b) => b.onclick = () => { const l = G.parseRoll(a.items); l.splice(+b.dataset.rd, 1); writeItems(l); paneAnim(); });
  if ($('rAdd')) $('rAdd').onclick = () => { const l = G.parseRoll(a.items); l.push({ name: 'Nouveau', w: 1, c: '#ffffff' }); writeItems(l); paneAnim(); };
  if ($('aBind')) { $('aBind').oninput = (e) => { once(); a.bind = e.target.value.replace(/[^\w]/g, '') || undefined; if (!a.bind) delete a.bind; save(); }; $('aFmt').oninput = (e) => { once(); a.format = e.target.value || '{v}'; save(); }; }
}
function windowOfNode(n) { return windowOf(n); }

/* ---------- scripts ---------- */
let KIT = null;
async function loadKit() { if (!KIT) KIT = { anim: await fetch('kit/ForgeGuiAnim.client.lua', { cache: 'no-cache' }).then((r) => r.text()) }; return KIT; }
function highlight(src) {
  let out = '', i = 0; const re = /(--\[\[[\s\S]*?\]\]|--[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\[\[[\s\S]*?\]\])|(\b\d+(?:\.\d+)?\b)|\b(game|workspace|script|Instance|Vector2|UDim2|Color3|Enum|task|math|table|string|require|pcall|print|warn)\b|\b(local|function|end|if|then|else|elseif|for|in|do|while|repeat|until|return|and|or|not|nil|true|false|break|continue)\b/g;
  let m; while ((m = re.exec(src))) { out += esc(src.slice(i, m.index)); const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : m[4] ? 'g' : 'k'; out += `<span class="tk-${cls}">${esc(m[0])}</span>`; i = re.lastIndex; }
  return out + esc(src.slice(i)) + '\n';
}
let codeFile = 'anim';
const modelText = () => JSON.stringify(exportModel(), null, 2);
async function paneCode() {
  await loadKit(); if (ui.tab !== 'code') return;
  const files = [{ id: 'anim', name: 'ForgeGuiAnim.client.lua', where: 'StarterPlayerScripts', text: (proj.scripts || {}).anim ?? KIT.anim },
    { id: 'model', name: proj.root.name + '.model.json', where: 'StarterGui', text: modelText(), readonly: true }];
  const f = files.find((x) => x.id === codeFile) || files[0];
  pane.innerHTML = `<div class="filetabs">${files.map((x) => `<button class="tab${x.id === f.id ? ' on' : ''}" data-f="${x.id}">${esc(x.name)}</button>`).join('')}</div>
    <div class="note" style="margin-bottom:8px">📍 ${esc(f.where)} ${f.readonly ? '· généré depuis ton interface (lecture seule)' : '· modifiable : tes changements partent dans l\'export'}</div>
    <div class="code"><pre id="hl"></pre><textarea id="ta" spellcheck="false" autocapitalize="off" autocomplete="off" ${f.readonly ? 'readonly' : ''}></textarea></div>
    <div class="btns" style="margin-top:8px">${f.readonly ? '' : '<button class="btn" id="reset">↺ Version d\'origine</button>'}<button class="btn" id="copy">⧉ Copier</button></div>`;
  pane.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { codeFile = b.dataset.f; paneCode(); });
  const ta = $('ta'), hl = $('hl'); ta.value = f.text; hl.innerHTML = highlight(f.text.length > 60000 ? f.text.slice(0, 60000) + '\n…' : f.text);
  ta.oninput = () => { hl.innerHTML = highlight(ta.value); (proj.scripts = proj.scripts || {})[f.id] = ta.value; save(); };
  ta.onscroll = () => { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; };
  if ($('reset')) $('reset').onclick = () => { if (!confirm('Revenir au script d\'origine ?')) return; delete proj.scripts[f.id]; save(); paneCode(); };
  $('copy').onclick = async () => { try { await navigator.clipboard.writeText(ta.value); toast('Copié ✓'); } catch { toast('Copie impossible'); } };
}

/* ---------- export ---------- */
function exportModel() { const m = G.toModel(proj.root, theme()); delete m.name; return m; }
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.path), data = enc.encode(f.data), crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name); off += 30 + name.length + data.length;
  }
  const csize = central.reduce((s, a) => s + a.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
async function buildPack() {
  await loadKit(); const name = proj.root.name, lib = await LIB.packFiles();
  return zip([...lib,
    { path: `StarterGui/${name}.model.json`, data: JSON.stringify(exportModel(), null, 1) },
    { path: 'StarterPlayerScripts/ForgeGuiAnim.client.lua', data: (proj.scripts || {}).anim ?? KIT.anim },
    { path: 'LISEZ-MOI.txt', data: `Pack Roblox Forge : interface ${name} (thème ${theme().label})\n\n- StarterGui/${name} : le ScreenGui (fenêtres, boutons, textes, dégradés, contours…)\n- StarterPlayerScripts/ForgeGuiAnim : anime l'interface et fait marcher les boutons\n  (ouvrir/fermer les fenêtres, tirage RNG, interrupteurs, compteurs leaderstats)\n\nRésultats pour tes scripts :\n- ScreenGui:GetAttribute("ForgeLastRoll") après un tirage\n- Bouton:GetAttribute("ForgeOn") pour les interrupteurs\nPublie ce .zip avec Roblox Push (bouton « Ajouter à mon jeu »).\n` },
  ]);
}
function stats() { const c = {}; G.walk(proj.root, (n) => { c[n.cls] = (c[n.cls] || 0) + 1; }); return c; }
function paneExport() {
  const c = stats(), total = Object.values(c).reduce((s, v) => s + v, 0) - 1, anims = (() => { let k = 0; G.walk(proj.root, (n) => { if (n.anim && Object.keys(n.anim).length) k++; }); return k; })();
  pane.innerHTML = `<div class="sec"><h3>${esc(proj.root.name)} <small>${total} objets · ${anims} animés · thème ${esc(theme().label)}</small></h3>
      <div class="note">${Object.entries(c).filter(([k]) => k !== 'ScreenGui').map(([k, v]) => `${G.ICON[k] || ''} ${k} ×${v}`).join(' · ')}</div>
      <button class="btn pri big" id="toGame">🎮 Ajouter à mon jeu</button>
      <button class="btn big" id="dl">📦 Télécharger le pack Roblox (.zip)</button>
      <button class="btn big" id="copyModel">⧉ Copier le modèle (JSON Rojo)</button></div>
    <div class="sec"><h3>Dans ton jeu</h3><div class="note"><b>🎮 Ajouter à mon jeu</b> ouvre Roblox Push : choisis ton jeu, l'interface y est <b>ajoutée</b> (StarterGui) sans rien effacer, avec le script <b>ForgeGuiAnim</b> qui fait tout marcher. Elle reste installée quand tu republies ton jeu.</div></div>
    <div class="sec"><h3>Projet</h3><div class="btns"><button class="btn danger" id="reset">↺ Recommencer (HUD + Boutique + Œuf)</button></div></div>`;
  $('toGame').onclick = async () => { const blob = await buildPack(); const buf = new Uint8Array(await blob.arrayBuffer()); let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    try { localStorage.setItem('rp2.pendingPack', JSON.stringify({ name: proj.root.name, label: 'Interface ' + proj.root.name, rarity: 'GUI', b64: btoa(bin), at: Date.now() })); }
    catch { return toast('Mémoire du navigateur pleine : télécharge plutôt le pack.'); }
    toast('Ouverture de Roblox Push…'); setTimeout(() => (location.href = '../../roblox-push/'), 450); };
  $('dl').onclick = async () => { const blob = await buildPack(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = proj.root.name + '.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Pack téléchargé ✓'); };
  $('copyModel').onclick = async () => { try { await navigator.clipboard.writeText(modelText()); toast('Modèle copié ✓'); } catch { toast('Copie impossible'); } };
  $('reset').onclick = () => { if (!confirm('Recommencer avec le projet de départ ?')) return; snapshot(); proj = defaultProject(); selId = null; save(); draw(); renderPane(); };
}

/* ---------- boot ---------- */
syncUndo(); draw(); renderPane(); LIB.prompt();
requestAnimationFrame(() => draw()); // layout settle
if (document.fonts) document.fonts.ready.then(() => { draw(); if (ui.tab === 'tpl') renderPane(); }); // TextScaled needs the real fonts
window.__gui = { LIB, get proj() { return proj; }, G, select, setTab, draw, buildPack, exportModel, ui, playVis, get elMap() { return elMap; }, act, theme };
