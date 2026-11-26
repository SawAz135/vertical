import * as THREE from 'three';
import { settings, QUALITY } from '../core/settings.js';
import { audio } from '../audio/audio.js';
import { ITEMS, pick, LINES } from '../world/shop.js';
import { Book } from './book.js';
import { fmtMoney, clamp, storage } from '../core/util.js';
import { COLORS } from '../net/coop.js';

const $ = (s, r = document) => r.querySelector(s);
const escapeHtml = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// =====================================================================================
// UI: loading, main menu, HUD, shop, pause / settings / credits panels, toasts, floating
// money, Gérard's speech bubble and milestone banners.
// =====================================================================================
export class UI {
  constructor(game) {
    this.g = game;
    this.el = { loading: $('#loading'), menu: $('#menu'), hud: $('#hud'), shop: $('#shop'), panel: $('#panel'), touch: $('#touch'), fade: $('#fade') };
    this.book = new Book($('#book'));
    this.book.onClose = () => this.g.onOverlayClosed();
    this.moneyShown = 0; this.floaters = [];
    this._logo(); this._menu(); this._shop(); this._hud();
  }
  // ---------------- loading ----------------
  progress(p, txt) { $('.ld-fill').style.width = `${p * 100}%`; $('.ld-spud').style.left = `${p * 100}%`; if (txt) $('.ld-text').textContent = txt; }
  hideLoading() { this.el.loading.classList.add('out'); setTimeout(() => this.el.loading.classList.add('hidden'), 900); }

  // ---------------- menu ----------------
  _logo() {
    document.querySelectorAll('[data-letters]').forEach((el, li) => {
      el.innerHTML = [...el.dataset.letters].map((c, i) => `<span class="ch" style="--i:${i + li * 10}">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
    });
    document.querySelectorAll('.mbtn').forEach((b, i) => b.style.setProperty('--i', i));
  }
  _menu() {
    this.el.menu.querySelectorAll('.mbtn').forEach(b => {
      b.addEventListener('mouseenter', () => audio.ui('hover'));
      b.addEventListener('click', e => { e.stopPropagation(); audio.init(); audio.ui('click'); this.g.menuAction(b.dataset.act); });
    });
    // keyboard / pad navigation of the menu
    this.sel = 0;
    addEventListener('keydown', e => {
      if (this.el.menu.classList.contains('hidden') || !this.el.panel.classList.contains('hidden') || !$('#book').classList.contains('hidden')) return;
      const bs = [...this.el.menu.querySelectorAll('.mbtn:not(.disabled)')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { this.sel = (this.sel + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length; bs.forEach((b, i) => b.classList.toggle('sel', i === this.sel)); audio.init(); audio.ui('hover'); e.preventDefault(); }
      if (e.key === 'Enter') { bs[this.sel]?.click(); }
    });
  }
  showMenu(hasSave, stats) {
    this.el.menu.classList.remove('hidden'); this.el.hud.classList.add('hidden'); this.el.touch.classList.add('hidden');
    $('[data-act="play"] .mb-txt').textContent = hasSave ? 'Continuer' : 'Jouer';
    $('[data-act="new"]').classList.toggle('hidden', !hasSave);
    $('.menu-stats').innerHTML = hasSave ? `🥔 ${stats.jar.toLocaleString('fr-FR')} patates dans le bocal · 💰 ${fmtMoney(stats.money)}` : '';
    $('.menu-hint').textContent = document.body.classList.contains('touch') ? 'Touche « Jouer »' : 'Clique sur « Jouer » · ↑ ↓ Entrée';
  }
  hideMenu() { this.el.menu.classList.add('hidden'); }
  fade(on) { this.el.fade.classList.toggle('on', on); }

  // ---------------- HUD ----------------
  _hud() {
    this.h = { money: $('.money-val'), gain: $('.money-gain'), jarFill: $('.jm-fill'), jarCount: $('.jm-count'), jarGlass: $('.jm-glass'), cross: $('.cross'), prompt: $('.prompt'),
      carry: $('.carry'), carryFill: $('.carry-fill'), carryTxt: $('.carry-txt'), carryIco: $('.carry-ico'), tools: document.querySelectorAll('.tool'), toasts: $('.toasts'),
      bubble: $('.bubble'), bubbleTxt: $('.bubble-txt'), banner: $('.banner'), fps: $('.fps'), floaters: $('.floaters') };
    this.h.tools.forEach(t => t.addEventListener('click', () => this.g.player.setTool(t.dataset.tool)));
    $('.hud-pause').addEventListener('click', () => this.g.pause());
    this.gainAcc = 0; this.gainT = 0;
  }
  showHud() { this.el.hud.classList.remove('hidden'); if (document.body.classList.contains('touch')) this.el.touch.classList.remove('hidden'); }
  hideHud() { this.el.hud.classList.add('hidden'); this.el.touch.classList.add('hidden'); }
  updateHud(dt) {
    const g = this.g, p = g.player, h = this.h;
    // money counter rolls toward the real value
    const diff = g.money - this.moneyShown;
    if (Math.abs(diff) > 0.5) { this.moneyShown += diff * Math.min(1, dt * 8) + Math.sign(diff) * Math.min(Math.abs(diff), dt * 3); h.money.textContent = Math.round(this.moneyShown).toLocaleString('fr-FR'); }
    else if (this.moneyShown !== g.money) { this.moneyShown = g.money; h.money.textContent = Math.round(g.money).toLocaleString('fr-FR'); }
    this.gainT -= dt; if (this.gainT <= 0 && this.gainAcc > 0) { h.gain.textContent = `+${Math.round(this.gainAcc)} ₣`; h.gain.classList.remove('show'); void h.gain.offsetWidth; h.gain.classList.add('show'); h.money.classList.add('bump'); setTimeout(() => h.money.classList.remove('bump'), 120); this.gainAcc = 0; this.gainT = 0.5; }
    // jar
    const fr = g.machine.fillRatio(g.dyn);
    h.jarFill.style.height = `${clamp(fr, 0, 1) * 100}%`; h.jarCount.textContent = g.stats.jar.toLocaleString('fr-FR'); h.jarGlass.classList.toggle('full', fr >= 0.98);
    // carry
    const T = p.tool, cap = T === 'bucket' ? p.bucketCap() : T === 'vacuum' ? p.gad.tankCap() : T === 'cannon' ? Math.max(1, p.carried()) : p.handCap();
    const n = T === 'bucket' ? p.bucket.length : T === 'vacuum' ? p.tank.length : T === 'cannon' ? p.carried() : p.hands.length;
    h.carryIco.textContent = { hands: '✋', bucket: '🪣', vacuum: '🌀', cannon: '💥' }[T]; h.carryTxt.textContent = `${n} / ${cap}`; h.carryFill.style.width = `${cap ? n / cap * 100 : 0}%`; h.carry.classList.toggle('full', n >= cap && cap > 0);
    h.tools.forEach(t => { t.classList.toggle('on', t.dataset.tool === p.tool); t.classList.toggle('locked', !p.unlocked(t.dataset.tool)); });
    // prompt + crosshair
    if (p.prompt !== this._lastPrompt) { this._lastPrompt = p.prompt; h.prompt.textContent = p.prompt; h.prompt.classList.toggle('on', !!p.prompt); }
    h.cross.classList.toggle('active', p.hoverId >= 0 || !!p.prompt);
    // next unlock: potatoes still to harvest before the cheapest upgrade is affordable
    this._goal(dt);
    // floaters (3D-anchored)
    this._floaters(dt);
    if (settings.v.showFps) h.fps.textContent = `${g.fps.toFixed(0)} ips · ${g.renderScale.toFixed(2)}x · ${g.dyn.live.length}/${g.dyn.settled.length}`; else if (h.fps.textContent) h.fps.textContent = '';
  }
  gain(v) { this.gainAcc += v; }
  _goal(dt) {
    this.goalT = (this.goalT || 0) - dt; if (this.goalT > 0) return; this.goalT = 0.25;
    const g = this.g; let best = null;
    for (const it of ITEMS) { const nx = it.levels[g.level(it.id) + 1]; if (nx && (!best || nx.price < best.price)) best = { price: nx.price, name: nx.name, icon: it.icon }; }
    const el = $('.goal'); if (!el) return;
    if (!best) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const per = 1.45 * g.mult(); // average francs per potato (variety mix) with current multipliers
    const left = Math.max(0, Math.ceil((best.price - g.money) / per));
    const prev = this._goalFrom ?? g.money; if (best.name !== this._goalName) { this._goalName = best.name; this._goalFrom = Math.min(g.money, best.price); }
    const pct = clamp((g.money - this._goalFrom) / Math.max(1, best.price - this._goalFrom), 0, 1); void prev;
    $('.goal-txt').innerHTML = left > 0 ? `🥔 Encore <b>${left.toLocaleString('fr-FR')}</b> patates pour débloquer ${best.icon} <b>${best.name}</b>` : `✅ ${best.icon} <b>${best.name}</b> disponible chez Gérard !`;
    $('.goal-fill').style.width = `${left > 0 ? pct * 100 : 100}%`; el.classList.toggle('ready', left === 0);
  }
  floater(text, pos, color) {
    if (this.floaters.length > 40) this.floaters.shift().el.remove();
    const el = document.createElement('div'); el.className = 'floater'; el.textContent = text; if (color) el.style.color = color;
    this.h.floaters.appendChild(el); this.floaters.push({ el, pos: pos.clone(), t: 0, dx: (Math.random() - 0.5) * 40 });
  }
  _floaters(dt) {
    const cam = this.g.camera, v = new THREE.Vector3(), W = innerWidth, H = innerHeight;
    for (let k = this.floaters.length - 1; k >= 0; k--) {
      const f = this.floaters[k]; f.t += dt;
      if (f.t > 1.4) { f.el.remove(); this.floaters.splice(k, 1); continue; }
      v.copy(f.pos); v.y += f.t * 0.9; v.project(cam);
      if (v.z > 1) { f.el.style.opacity = 0; continue; }
      const s = f.t < 0.15 ? f.t / 0.15 * 1.3 : 1.3 - Math.min(0.3, (f.t - 0.15) * 2);
      f.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * W + f.dx * f.t}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%,-50%) scale(${s})`;
      f.el.style.opacity = String(clamp((1.4 - f.t) * 2, 0, 1));
    }
  }
  toast(msg, kind = '') {
    const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; this.h.toasts.appendChild(t);
    const max = document.body.classList.contains('touch') ? 2 : 4;
    while (this.h.toasts.children.length > max) this.h.toasts.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3200);
  }
  say(text, dur) {
    this.h.bubbleTxt.textContent = text; this.h.bubble.classList.add('on');
    clearTimeout(this._sayT); this._sayT = setTimeout(() => this.h.bubble.classList.remove('on'), Math.max(2200, dur * 1000 + 1400));
    if (!this.el.shop.classList.contains('hidden')) $('.shop-quote').textContent = `« ${text} »`;
  }
  achievement(a) {
    const t = document.createElement('div'); t.className = 'toast ach-toast'; t.innerHTML = `<div class="at-i">${a.icon}</div><div><div class="at-k">Succès débloqué</div><div class="at-n">${a.name}</div></div>`;
    this.h.toasts.appendChild(t); const max = document.body.classList.contains('touch') ? 2 : 4;
    while (this.h.toasts.children.length > max) this.h.toasts.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 4500);
  }
  banner(kicker, title) { const b = this.h.banner; $('.banner-k').textContent = kicker; $('.banner-t').textContent = title; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }

  // ---------------- shop ----------------
  _shop() {
    $('.shop-close').addEventListener('click', () => this.closeShop());
    this.el.shop.addEventListener('click', e => { if (e.target === this.el.shop) this.closeShop(); });
    addEventListener('keydown', e => { if (!this.el.shop.classList.contains('hidden') && (e.key === 'Escape' || e.key === 'e' || e.key === 'E')) { e.stopPropagation(); this.closeShop(); } }, true);
  }
  openShop(line) {
    this.el.shop.classList.remove('hidden'); this.renderShop(); $('.shop-quote').textContent = `« ${line} »`;
  }
  closeShop() { if (this.el.shop.classList.contains('hidden')) return; this.el.shop.classList.add('hidden'); audio.ui('click'); this.g.onOverlayClosed(); }
  get shopOpen() { return !this.el.shop.classList.contains('hidden'); }
  renderShop(flashId, kind) {
    const g = this.g; $('.shop-money').textContent = fmtMoney(g.money);
    const grid = $('.shop-grid'); grid.innerHTML = '';
    {
      const ok = g.stats.jar >= 500, d = document.createElement('div'); d.className = 'item sale' + (ok ? '' : ' locked'); d.style.setProperty('--i', 0);
      d.innerHTML = `<div class="it-head"><div class="it-ico">⭐</div><div><div class="it-cat">Prestige · ★ ${g.stats.prestige || 0}</div><div class="it-name">La Grande Vente</div></div></div>
        <div class="it-desc">${ok ? `La friterie rachète <b>tout le bocal</b> (${g.stats.jar.toLocaleString('fr-FR')} patates) : <b>+${fmtMoney(g.saleBonus())}</b> et <b>+25 %</b> de gains pour toujours. Le bocal repart à zéro.` : `Remplis le bocal avec au moins <b>500 patates</b> (${g.stats.jar}/500) pour débloquer la vente à la friterie.`}</div>
        <button class="it-buy ${ok ? '' : 'poor'}">${ok ? 'Tout vendre !' : '🔒 Pas encore'}</button>`;
      d.querySelector('.it-buy').addEventListener('click', () => g.grandSale());
      grid.appendChild(d);
    }
    ITEMS.forEach((it, idx) => {
      const lv = g.level(it.id), cur = it.levels[lv], next = it.levels[lv + 1];
      const d = document.createElement('div'); d.className = 'item'; d.style.setProperty('--i', idx);
      d.innerHTML = `<div class="it-head"><div class="it-ico">${it.icon}</div><div><div class="it-cat">${it.name}</div><div class="it-name">${next ? next.name : cur.name}</div></div></div>
        <div class="it-lv">${it.levels.slice(1).map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>
        <div class="it-desc">${next ? next.desc : 'Niveau maximum atteint. ' + cur.desc}</div>
        <button class="it-buy ${next ? (g.money >= next.price ? '' : 'poor') : 'max'}">${next ? `Acheter · ${fmtMoney(next.price)}` : '★ MAX'}</button>`;
      d.querySelector('.it-buy').addEventListener('click', () => { const ok = g.buy(it.id); d.classList.remove('bought', 'deny'); void d.offsetWidth; if (!ok) d.classList.add('deny'); });
      d.querySelector('.it-buy').addEventListener('mouseenter', () => audio.ui('hover'));
      grid.appendChild(d);
      if (flashId === it.id) d.classList.add(kind || 'bought');
    });
  }

  // ---------------- panels ----------------
  panel(title, body, actions) {
    const p = this.el.panel; p.classList.remove('hidden'); $('.panel-title', p).textContent = title;
    const b = $('.panel-body', p); b.innerHTML = ''; if (typeof body === 'string') b.innerHTML = body; else if (body) b.appendChild(body);
    const a = $('.panel-actions', p); a.innerHTML = '';
    for (const [label, fn, primary] of actions) { const btn = document.createElement('button'); btn.className = 'mbtn' + (primary ? ' primary' : ''); btn.innerHTML = `<span class="mb-txt">${label}</span><span class="mb-shine"></span>`; btn.onclick = () => { audio.ui('click'); fn(); }; btn.onmouseenter = () => audio.ui('hover'); a.appendChild(btn); }
  }
  closePanel() { this.el.panel.classList.add('hidden'); }
  get panelOpen() { return !this.el.panel.classList.contains('hidden'); }
  settingsBody() {
    const wrap = document.createElement('div'); wrap.style.display = 'contents';
    const sec = t => { const d = document.createElement('div'); d.className = 'set-sec'; d.textContent = t; wrap.appendChild(d); };
    const row = (label, input) => { const r = document.createElement('div'); r.className = 'set-row'; const l = document.createElement('label'); l.textContent = label; r.append(l, input); wrap.appendChild(r); };
    const range = (k, min, max, step) => { const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = settings.v[k]; i.oninput = () => settings.set(k, parseFloat(i.value)); return i; };
    const check = k => { const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!settings.v[k]; i.onchange = () => settings.set(k, i.checked); return i; };
    sec('Graphismes');
    const q = document.createElement('select'); for (const k of Object.keys(QUALITY)) { const o = document.createElement('option'); o.value = k; o.textContent = { low: 'Basse', medium: 'Moyenne', high: 'Haute', ultra: 'Ultra' }[k]; o.selected = settings.v.quality === k; q.appendChild(o); }
    q.onchange = () => { settings.set('quality', q.value); this.toast('Qualité appliquée (le nombre de patates du champ change au prochain lancement).'); };
    row('Qualité', q); row('Résolution adaptative', check('adaptiveResolution')); row('Afficher les IPS', check('showFps'));
    sec('Caméra');
    row('Champ de vision', range('fov', 60, 100, 1)); row('Balancement de tête', range('headBob', 0, 1, 0.05)); row('Tremblements', range('cameraShake', 0, 1, 0.05));
    sec('Contrôles');
    row('Sensibilité souris', range('mouseSens', 0.2, 3, 0.05)); row('Sensibilité tactile', range('touchSens', 0.2, 3, 0.05)); row('Sensibilité manette', range('padSens', 0.2, 3, 0.05));
    row('Inverser l’axe Y', check('invertY')); row('Sprint : basculer', check('sprintToggle'));
    sec('Audio');
    row('Volume général', range('volMaster', 0, 1, 0.05)); row('Musique', range('volMusic', 0, 1, 0.05)); row('Effets', range('volSfx', 0, 1, 0.05)); row('Voix de Gérard', range('volVoice', 0, 1, 0.05)); row('Ambiance', range('volAmbience', 0, 1, 0.05));
    return wrap;
  }
  credits() {
    return `<div class="credits"><b>WHERE'S MY POTATO?</b><br>Un jeu de récolte en plein air.<br><br><b>Code, modèles 3D, shaders, physique</b><br>tout est généré par le code — aucune image ni son externe<br><br><b>Audio</b><br>synthèse WebAudio (pas, verre, moteur, oiseaux, musique Karplus-Strong)<br><br><b>Bibliothèque</b><br>three.js (MIT)<br><b>Polices</b><br>Luckiest Guy, Fredoka, Permanent Marker (OFL)<br><br>Et Gérard, évidemment.</div>`;
  }
  idleLine() { return pick(LINES.idle); }

  // ---------------- multiplayer ----------------
  players(list, net) {
    const el = $('.players'); if (!el) return;
    el.classList.toggle('hidden', !net.active);
    if (!net.active) return;
    el.innerHTML = `<div class="pl-code">${net.visibility === 'public' ? '🌍' : '🔒'} <b>${net.room}</b> · ${net.kind === 'local' ? 'même appareil' : 'en ligne'}</div>` +
      list.map((m, k) => `<div class="pl"><i style="background:${m.color}"></i>${k === 0 ? '👑 ' : ''}${escapeHtml(m.name || 'Joueur')}${m.id === net.id ? ' (toi)' : ''}</div>`).join('');
  }
  mpPanel(h) {
    const prof = storage.get('wmp.profile', { name: 'Récolteur ' + (100 + Math.floor(Math.random() * 900)), color: COLORS[Math.floor(Math.random() * COLORS.length)], kind: 'online' });
    const body = document.createElement('div'); body.className = 'mp';
    body.innerHTML = `
      <div class="set-sec">Ton récolteur</div>
      <div class="set-row"><label>Nom</label><input class="mp-name" maxlength="16" value="${escapeHtml(prof.name)}"></div>
      <div class="set-row"><label>Couleur</label><div class="mp-colors">${COLORS.map(c => `<button data-c="${c}" style="background:${c}" class="${c === prof.color ? 'on' : ''}"></button>`).join('')}</div></div>
      <div class="set-row"><label>Réseau</label><select class="mp-kind"><option value="online">Internet</option><option value="local">Même appareil (onglets)</option></select></div>
      <div class="set-sec">Créer une session</div>
      <div class="mp-row"><button class="mp-btn mp-host-pub">🌍 Publique</button><button class="mp-btn mp-host-priv">🔒 Privée (code)</button></div>
      <div class="set-sec">Rejoindre</div>
      <div class="mp-row"><input class="mp-code" maxlength="5" placeholder="CODE" autocapitalize="characters"><button class="mp-btn mp-join">Rejoindre</button></div>
      <div class="set-sec">Sessions publiques</div>
      <div class="mp-list"><div class="mp-empty">Recherche…</div></div>
      <div class="mp-status"></div>`;
    const q = s => body.querySelector(s);
    q('.mp-kind').value = prof.kind;
    let color = prof.color;
    body.querySelectorAll('.mp-colors button').forEach(b => b.onclick = () => { color = b.dataset.c; body.querySelectorAll('.mp-colors button').forEach(x => x.classList.toggle('on', x === b)); audio.ui('click'); });
    const get = () => { const p = { name: q('.mp-name').value.trim().slice(0, 16) || 'Récolteur', color, kind: q('.mp-kind').value }; storage.set('wmp.profile', p); return p; };
    const status = (t, bad) => { q('.mp-status').textContent = t; q('.mp-status').classList.toggle('bad', !!bad); };
    const busy = async (fn) => { body.querySelectorAll('button').forEach(b => (b.disabled = true)); try { await fn(); } finally { body.querySelectorAll('button').forEach(b => (b.disabled = false)); } };
    q('.mp-host-pub').onclick = () => busy(async () => { status('Création de la session…'); const r = await h.host({ ...get(), visibility: 'public' }); if (!r) status('Connexion impossible au serveur de sessions.', true); });
    q('.mp-host-priv').onclick = () => busy(async () => { status('Création de la session…'); const r = await h.host({ ...get(), visibility: 'private' }); if (!r) status('Connexion impossible au serveur de sessions.', true); });
    q('.mp-join').onclick = () => busy(async () => { const code = q('.mp-code').value.trim().toUpperCase(); if (code.length < 4) { status('Entre un code de session.', true); return; } status('Connexion…'); const ok = await h.join(code, get()); if (!ok) status('Session introuvable ou serveur injoignable.', true); });
    const refresh = () => h.list(q('.mp-kind').value, (rooms, err) => {
      const L = q('.mp-list'); if (!L) return;
      if (err || !rooms) { L.innerHTML = '<div class="mp-empty">Liste indisponible (serveur injoignable).</div>'; return; }
      L.innerHTML = rooms.length ? rooms.map(r => `<button class="mp-room" data-code="${escapeHtml(r.code)}"><b>${escapeHtml(r.host || '?')}</b><span>${r.players || 1}/4 joueurs · ${escapeHtml(r.code)}</span></button>`).join('') : '<div class="mp-empty">Aucune session publique pour le moment.</div>';
      L.querySelectorAll('.mp-room').forEach(b => b.onclick = () => busy(async () => { status('Connexion…'); const ok = await h.join(b.dataset.code, get()); if (!ok) status('Impossible de rejoindre.', true); }));
    });
    q('.mp-kind').onchange = () => { get(); refresh(); };
    refresh();
    this.panel('Multijoueur', body, [['Retour', () => { h.stopList(); this.closePanel(); }, true]]);
  }
}
