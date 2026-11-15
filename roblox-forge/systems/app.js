/* Roblox Forge - Systems Studio (mobile-first).
   Eggs + odds with live Monte Carlo, pets (import from Pet Studio and the Index),
   rarities, economy, daily rewards, quests, codes, Robux ids, a preview of the
   casino hatch cinematic, and the export to Roblox Push ("Ajouter à mon jeu").
   Every number shown here comes from sys-core.js, the exact twin of ForgeLogic.lua. */
import * as S from './sys-core.js';
import * as PG from '../studio/pet-gen.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clone = (o) => JSON.parse(JSON.stringify(o));
const KEY = 'forge.systems';
function loadCfg() {
  const def = S.defaultConfig();
  try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && c.v === 1) { for (const k of Object.keys(def)) if (c[k] === undefined) c[k] = def[k]; return c; } } catch {}
  return def;
}
let cfg = loadCfg();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} };
let tab = 'eggs', eggSel = cfg.eggs[0]?.id, luckSel = 1, sim = null;
let tt; function toast(m, ms = 2200) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), ms); }
const rarColor = (name) => (cfg.rarities.find((r) => r.name === name) || { color: '#ffffff' }).color;
const petLabel = (id) => { const p = S.petById(cfg, id); return p ? `${p.emoji || '❔'} ${p.name}` : id; };
const pct = (p) => (p * 100 >= 1 ? (p * 100).toFixed(1) : (p * 100).toPrecision(2)) + ' %';
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'pet';
const safeName = (s) => (String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '_') || 'ForgePet').slice(0, 40);

/* ======================= hatch cinematic preview (same phases as ForgeSystems.client.lua) ======================= */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * (skip ? 0.25 : 1)));
let busy = false, skip = false; const pityPreview = {}, seenPreview = new Set();
$('stage').addEventListener('pointerdown', () => { if (busy) skip = true; });
async function cinematic(egg, results) {
  busy = true; skip = false; $('hint').style.opacity = 0;
  const cols = $('cols'); cols.innerHTML = '';
  const top = Math.max(...results.map((r) => S.tierOf(cfg, S.petById(cfg, r.pet).rarity))), topRar = cfg.rarities[top - 1];
  const epic = top >= Math.max(4, cfg.rarities.length - 2);
  const dim = $('dim'), tint = $('tint'), flash = $('flash');
  dim.style.transition = 'opacity .35s'; dim.style.opacity = 0.35; tint.style.background = topRar.color;
  const C = results.map((r) => {
    const pet = S.petById(cfg, r.pet), tier = S.tierOf(cfg, pet.rarity), rar = cfg.rarities[tier - 1];
    const el = document.createElement('div'); el.className = 'col' + (results.length > 1 ? ' small' : '');
    el.style.setProperty('--ec', egg.color); el.style.setProperty('--rc', rar.color); el.style.setProperty('--gc', egg.color);
    el.innerHTML = `<div class="rays"></div><div class="glow"></div><div class="egg"><span>${esc(egg.emoji || '🥚')}</span></div>`;
    cols.appendChild(el); const shell = el.querySelector('.egg');
    shell.animate([{ transform: 'translateY(-160%)' }, { transform: 'translateY(6%)', offset: 0.7 }, { transform: 'translateY(0) scale(1.12,.86)', offset: 0.85 }, { transform: 'scale(1)' }], { duration: 750, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'forwards' });
    return { el, shell, glow: el.querySelector('.glow'), rays: el.querySelector('.rays'), pet, tier, rar, r };
  });
  await sleep(800);
  // suspense
  const shakes = 3 + Math.min(5, top);
  for (let s = 1; s <= shakes; s++) {
    const k = s / shakes, amp = 5 + k * 16, dt = 360 - k * 220, side = s % 2 ? -1 : 1;
    for (const c of C) {
      c.shell.animate([{ transform: 'rotate(0)' }, { transform: `translateX(${side * amp * 0.6}px) rotate(${side * amp}deg)` }, { transform: 'rotate(0)' }], { duration: dt, easing: 'ease-in-out' });
      const crack = document.createElement('i'); crack.style.left = 30 + Math.random() * 40 + '%'; crack.style.top = 25 + Math.random() * 45 + '%'; crack.style.rotate = (Math.random() * 140 - 70) + 'deg';
      c.shell.appendChild(crack); requestAnimationFrame(() => { crack.style.width = 18 + k * 22 + '%'; crack.style.height = 3 + k * 3 + 'px'; });
      const tease = k > 0.55 && c.tier >= 3; c.glow.style.background = tease ? c.rar.color : egg.color;
      c.glow.animate([{ opacity: 0.2, scale: 1 }, { opacity: 0.75 - (1 - k) * 0.4, scale: 1 + k * 0.35 }, { opacity: 0.2, scale: 1 }], { duration: dt });
    }
    if (epic && k > 0.5) { tint.animate([{ opacity: 0 }, { opacity: 0.18 }, { opacity: 0 }], { duration: dt }); $('stage').animate([{ transform: 'translate(0,0)' }, { transform: `translate(${(Math.random() - 0.5) * 12 * k}px,${(Math.random() - 0.5) * 12 * k}px)` }, { transform: 'translate(0,0)' }], { duration: dt }); }
    await sleep(dt);
  }
  if (epic) await sleep(350);
  // burst
  flash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, easing: 'ease-out' });
  for (const c of C) {
    c.shell.style.display = 'none'; c.glow.style.background = c.rar.color; c.glow.animate([{ opacity: 0.9, scale: 0.8 }, { opacity: 0.55, scale: 1.6 }], { duration: 450, fill: 'forwards' });
    c.rays.animate([{ opacity: 0, scale: 0.2 }, { opacity: 0.85, scale: 1 }], { duration: 500, easing: 'cubic-bezier(.3,1.5,.5,1)', fill: 'forwards' });
    c.rays.animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: 12000 / (1 + c.tier * 0.4), iterations: Infinity });
    if (c.tier >= cfg.rarities.length) c.rays.animate([{ filter: 'hue-rotate(0deg)' }, { filter: 'hue-rotate(360deg)' }], { duration: 1500, iterations: Infinity });
    for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, sh = document.createElement('b'); sh.className = 'shard'; sh.style.rotate = Math.random() * 360 + 'deg'; c.el.appendChild(sh);
      requestAnimationFrame(() => { sh.style.transform = `translate(${Math.cos(a) * 160}%,${Math.sin(a) * 160}%) translate(-50%,-50%) rotate(${Math.random() * 500 - 250}deg)`; sh.style.opacity = 0; }); }
    for (let i = 0; i < 8 + c.tier * 2; i++) { const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 70, st = document.createElement('b'); st.className = 'star'; st.textContent = '✦'; c.el.appendChild(st);
      requestAnimationFrame(() => { st.style.transform = `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) rotate(${Math.random() * 360}deg)`; st.style.opacity = 0; }); }
  }
  if (epic) $('stage').animate(Array.from({ length: 7 }, (_, i) => ({ transform: i === 6 ? 'none' : `translate(${(Math.random() - 0.5) * 24}px,${(Math.random() - 0.5) * 24}px)` })), { duration: 340 });
  if (epic) tint.animate([{ opacity: 0.3 }, { opacity: 0 }], { duration: 1000 });
  // reveal
  for (const c of C) {
    const p = document.createElement('div'); p.className = 'pet'; p.textContent = c.pet.emoji || '❔'; c.el.appendChild(p);
    p.animate([{ scale: 0 }, { scale: 1.25, offset: 0.7 }, { scale: 1 }], { duration: 550, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'forwards' });
    p.animate([{ translate: '-50% -54%', rotate: '-4deg' }, { translate: '-50% -46%', rotate: '4deg' }], { duration: 1300, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out', composite: 'replace' });
    const rl = document.createElement('div'); rl.className = 'rar' + (c.tier >= cfg.rarities.length ? ' rainbow' : ''); rl.textContent = c.rar.name.toUpperCase(); c.el.appendChild(rl);
    const chance = c.r.chance > 0 ? '1 sur ' + S.abbreviate(Math.max(1, Math.round(1 / c.r.chance))) : '';
    const info = document.createElement('div'); info.className = 'info'; info.textContent = `${c.pet.name} · ${chance}${c.r.forced ? ' · PITY' : ''}`; c.el.appendChild(info);
    setTimeout(() => { rl.animate([{ opacity: 0, scale: 2.2 }, { opacity: 1, scale: 1 }], { duration: 450, easing: 'cubic-bezier(.3,1.5,.5,1)', fill: 'forwards' }); info.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 200, fill: 'forwards' }); }, 250);
    if (!seenPreview.has(c.pet.id)) { seenPreview.add(c.pet.id); const n = document.createElement('div'); n.className = 'new'; n.textContent = 'NOUVEAU !'; c.el.appendChild(n); setTimeout(() => (n.style.scale = 1), 600); }
  }
  await sleep(1500 + Math.min(top, 6) * 250);
  cols.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8%)' }], { duration: 380, fill: 'forwards' }).finished.then(() => { cols.innerHTML = ''; cols.getAnimations().forEach((a) => a.cancel()); });
  dim.style.opacity = 0; await sleep(420); busy = false; $('hint').style.opacity = 1;
}
function previewHatch(n) {
  if (busy) return; const egg = S.eggById(cfg, eggSel); if (!egg) return toast('Ajoute un œuf');
  const issues = S.validate(cfg); if (issues.length) return toast('⚠️ ' + issues[0]);
  const odds = S.eggOdds(cfg, egg, luckSel), results = [];
  for (let i = 0; i < n; i++) { const h = S.hatch(cfg, egg, luckSel, pityPreview[egg.id] || 0, Math.random()); pityPreview[egg.id] = h.pity; results.push({ pet: h.pet, forced: h.forced, chance: (odds.find((o) => o.pet === h.pet) || { p: 0 }).p }); }
  cinematic(egg, results);
}
$('h1').onclick = () => previewHatch(1); $('h3').onclick = () => previewHatch(3);
function fillEggSel() { const s = $('eggSel'); s.innerHTML = cfg.eggs.map((e) => `<option value="${esc(e.id)}"${e.id === eggSel ? ' selected' : ''}>${esc(e.emoji)} ${esc(e.name)} · ${S.abbreviate(e.price)} ${esc(e.currency)}</option>`).join(''); s.onchange = () => { eggSel = s.value; sim = null; render(); }; }

/* ======================= panes ======================= */
const TABS = { eggs: '🥚 Œufs', pets: '🐾 Pets', rar: '💎 Raretés', eco: '💰 Économie', rew: '🎁 Récompenses', robux: '💳 Robux', adv: '🛡️ Avancé', export: '📦 Export' };
function tabs() { $('tabs').innerHTML = Object.entries(TABS).map(([k, l]) => `<button class="tab${k === tab ? ' on' : ''}" data-t="${k}">${l}</button>`).join(''); $('tabs').querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { tab = b.dataset.t; render(); }); }
function render() { tabs(); fillEggSel(); ({ eggs: paneEggs, pets: panePets, rar: paneRar, eco: paneEco, rew: paneRew, robux: paneRobux, adv: paneAdv, export: paneExport })[tab](); }
const pane = () => $('pane');
const curOpts = (sel) => cfg.currencies.map((c) => `<option${c.name === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
// generic binder: inputs with data-k="path.to.value" edit cfg
function bindAll(root, after) {
  root.querySelectorAll('[data-k]').forEach((el) => {
    const ev = el.tagName === 'SELECT' || el.type === 'color' || el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(ev, () => { const path = el.dataset.k.split('.'); let o = cfg; for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
      const last = path[path.length - 1]; o[last] = el.type === 'number' ? (+el.value || 0) : el.type === 'checkbox' ? el.checked : el.value; save(); sim = null; if (after) after(el); });
  });
}

function paneEggs() {
  const egg = S.eggById(cfg, eggSel) || cfg.eggs[0]; if (egg) eggSel = egg.id;
  const ei = cfg.eggs.indexOf(egg);
  const odds = egg ? S.eggOdds(cfg, egg, luckSel).sort((a, b) => b.p - a.p) : [];
  pane().innerHTML = `<div class="sec"><h3>Œufs <small>${cfg.eggs.length}</small></h3><div class="chips">${cfg.eggs.map((e) => `<button class="chip${e.id === eggSel ? ' on' : ''}" data-egg="${esc(e.id)}">${esc(e.emoji)} ${esc(e.name)}</button>`).join('')}<button class="chip" id="addEgg">＋ Œuf</button></div></div>
    ${egg ? `<div class="sec"><h3>${esc(egg.emoji)} ${esc(egg.name)}</h3>
      <div class="row"><label>Nom</label><input type="text" data-k="eggs.${ei}.name" value="${esc(egg.name)}"><input type="text" data-k="eggs.${ei}.emoji" value="${esc(egg.emoji)}" style="max-width:56px;text-align:center"><input type="color" data-k="eggs.${ei}.color" value="${esc(egg.color)}"></div>
      <div class="row"><label>Prix</label><input type="number" data-k="eggs.${ei}.price" value="${egg.price}"><select class="f" data-k="eggs.${ei}.currency">${curOpts(egg.currency)}</select></div>
      <div class="row"><label>Position</label><input type="number" data-k="eggs.${ei}.pos.0" value="${egg.pos[0]}" title="X"><input type="number" data-k="eggs.${ei}.pos.1" value="${egg.pos[1]}" title="Z"></div>
      <div class="row"><label>Pity</label><input type="number" data-k="eggs.${ei}.pity.after" value="${egg.pity.after}" title="après N œufs (0 = off)"><select class="f" data-k="eggs.${ei}.pity.tier">${cfg.rarities.map((r, i) => `<option value="${i + 1}"${i + 1 === egg.pity.tier ? ' selected' : ''}>${esc(r.name)}+</option>`).join('')}</select></div>
      <div class="note">Pity : après ${egg.pity.after || '∞'} œufs sans ${esc((cfg.rarities[egg.pity.tier - 1] || {}).name || '?')} ou mieux, le suivant est garanti.</div>
      <h3 style="margin-top:12px">Contenu <small>poids → chances</small></h3>
      ${egg.entries.map((x, i) => `<div class="ent"><select class="f" data-k="eggs.${ei}.entries.${i}.pet">${cfg.pets.map((p) => `<option value="${esc(p.id)}"${p.id === x.pet ? ' selected' : ''}>${esc(p.emoji)} ${esc(p.name)} · ${esc(p.rarity)}</option>`).join('')}</select><input type="number" step="any" data-k="eggs.${ei}.entries.${i}.weight" value="${x.weight}"><button class="x" data-del="${i}">✕</button></div>`).join('')}
      <div class="btns"><button class="btn" id="addEnt">＋ Pet dans l'œuf</button><button class="btn danger" id="delEgg">🗑 Supprimer l'œuf</button></div></div>
    <div class="sec"><h3>Chances réelles <small>chance ×${luckSel}</small></h3>
      <div class="chips" style="margin-bottom:8px">${[1, 2, 5, 10].map((l) => `<button class="chip${l === luckSel ? ' on' : ''}" data-luck="${l}">🍀 ×${l}</button>`).join('')}</div>
      <table><tr><th>Pet</th><th>Rareté</th><th class="n">Chance</th><th class="n">1 sur</th></tr>
      ${odds.map((o) => { const p = S.petById(cfg, o.pet); return `<tr><td>${esc(p.emoji)} ${esc(p.name)}</td><td><span class="dot" style="background:${esc(rarColor(p.rarity))}"></span>${esc(p.rarity)}</td><td class="n">${pct(o.p)}</td><td class="n">${S.oneIn(o.p)}</td></tr>`; }).join('')}</table>
      <div class="note" style="margin-top:6px">La chance (gamepass Chance ×2…) multiplie le poids des raretés marquées « boostées ».</div></div>
    <div class="sec"><h3>Monte Carlo <small>vrais tirages, même code que le serveur</small></h3>
      <div class="btns"><button class="btn pri" data-sim="10000">▶ 10 000 œufs</button><button class="btn pri" data-sim="100000">▶ 100 000 œufs</button></div><div id="simOut" style="margin-top:8px">${simHtml(egg, odds)}</div></div>` : '<div class="note">Aucun œuf.</div>'}`;
  bindAll(pane(), (el) => { if (/entries|pity|price|currency|name|emoji/.test(el.dataset.k)) { fillEggSel(); if (el.tagName === 'SELECT' || el.type === 'number') paneEggs(); } });
  pane().querySelectorAll('[data-egg]').forEach((b) => b.onclick = () => { eggSel = b.dataset.egg; sim = null; render(); });
  pane().querySelectorAll('[data-luck]').forEach((b) => b.onclick = () => { luckSel = +b.dataset.luck; sim = null; paneEggs(); });
  $('addEgg').onclick = () => { const id = 'egg' + (cfg.eggs.length + 1) + Math.random().toString(36).slice(2, 5); cfg.eggs.push({ id, name: 'Nouvel Œuf', emoji: '🥚', price: 500, currency: cfg.main, color: '#9be8ff', pos: [cfg.eggs.length * 18 - 18, 40], pity: { after: 0, tier: 4 }, entries: cfg.pets.slice(0, 3).map((p, i) => ({ pet: p.id, weight: [60, 30, 10][i] })) }); eggSel = id; save(); render(); };
  if (!egg) return;
  pane().querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { egg.entries.splice(+b.dataset.del, 1); save(); sim = null; paneEggs(); });
  $('addEnt').onclick = () => { egg.entries.push({ pet: cfg.pets[0].id, weight: 1 }); save(); paneEggs(); };
  $('delEgg').onclick = () => { if (cfg.eggs.length < 2) return toast('Garde au moins un œuf'); if (!confirm('Supprimer ' + egg.name + ' ?')) return; cfg.eggs.splice(ei, 1); eggSel = cfg.eggs[0].id; save(); render(); };
  pane().querySelectorAll('[data-sim]').forEach((b) => b.onclick = () => runSim(egg, +b.dataset.sim));
}
function simHtml(egg, odds) {
  if (!sim || sim.egg !== egg.id || sim.luck !== luckSel) return '<div class="note">Lance une simulation pour comparer les chances affichées aux tirages réels (avec le pity).</div>';
  if (sim.running) return `<div class="note">Simulation… ${Math.round((sim.done / sim.n) * 100)} %</div>`;
  const max = Math.max(...Object.values(sim.counts));
  return `<table><tr><th>Pet</th><th class="n">Obtenus</th><th class="n">Réel</th><th class="n">Prévu</th><th>1er à</th></tr>${odds.map((o) => { const c = sim.counts[o.pet] || 0, p = S.petById(cfg, o.pet);
    return `<tr><td>${esc(p.emoji)} ${esc(p.name)}<div class="barc"><i style="width:${(c / max) * 100}%;background:${esc(rarColor(p.rarity))}"></i></div></td><td class="n">${c.toLocaleString('fr')}</td><td class="n">${pct(c / sim.n)}</td><td class="n">${pct(o.p)}</td><td class="n">${sim.firstAt[o.pet] ? '#' + sim.firstAt[o.pet].toLocaleString('fr') : '—'}</td></tr>`; }).join('')}</table>
    <div class="note" style="margin-top:6px">${sim.n.toLocaleString('fr')} œufs · ${sim.forced.toLocaleString('fr')} pets garantis par le pity · coût total ${S.abbreviate(sim.n * egg.price)} ${esc(egg.currency)}</div>`;
}
function runSim(egg, n) {
  // chunked so the page stays fluid; identical draws to S.simulate (same rng, same hatch)
  const r = S.rngFrom(Date.now() & 0xffff), counts = {}, firstAt = {}; let pity = 0, forced = 0, i = 0;
  sim = { egg: egg.id, luck: luckSel, n, done: 0, running: true, counts, firstAt, forced: 0 };
  const step = () => { const end = Math.min(n, i + 20000);
    for (; i < end; i++) { const h = S.hatch(cfg, egg, luckSel, pity, r()); pity = h.pity; if (h.forced) forced++; counts[h.pet] = (counts[h.pet] || 0) + 1; if (!firstAt[h.pet]) firstAt[h.pet] = i + 1; }
    sim.done = i; sim.forced = forced; if (i < n) { if ($('simOut')) $('simOut').innerHTML = simHtml(egg); setTimeout(step, 0); } else { sim.running = false; if (tab === 'eggs' && $('simOut')) $('simOut').innerHTML = simHtml(egg, S.eggOdds(cfg, egg, luckSel).sort((a, b) => b.p - a.p)); toast('✓ ' + n.toLocaleString('fr') + ' œufs simulés'); } };
  step();
}

function panePets() {
  pane().innerHTML = `<div class="sec"><h3>Importer <small>depuis tes studios</small></h3>
      <div class="btns"><button class="btn pri" id="impIdx">📖 Index Pet Studio (100)</button><button class="btn" id="impSaved">🐾 Mes pets gardés</button></div>
      <div class="note" style="margin-top:6px">Chaque pet importé garde le nom de son modèle 3D : exporte aussi l'Index (ou ton pet) depuis Pet Studio et le pet équipé suivra le joueur dans le jeu.</div></div>
    <div class="sec"><h3>Pets <small>${cfg.pets.length}</small></h3><div class="list">${cfg.pets.map((p, i) => `<div class="it"><span style="font-size:22px">${esc(p.emoji)}</span><b>${esc(p.name)}<br><small class="note"><span class="dot" style="background:${esc(rarColor(p.rarity))}"></span>${esc(p.rarity)} · puissance ${p.power}${p.model ? ' · 🧊 ' + esc(p.model) : ''}</small></b><button class="btn" data-ed="${i}" style="height:34px">✏️</button><button class="x" data-del="${i}">✕</button></div><div id="ed${i}"></div>`).join('')}</div>
      <button class="btn big" id="addPet">＋ Nouveau pet</button></div>`;
  pane().querySelectorAll('[data-ed]').forEach((b) => b.onclick = () => { const i = +b.dataset.ed, box = $('ed' + i), p = cfg.pets[i]; if (box.innerHTML) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="sec" style="margin:4px 0 8px"><div class="row"><label>Nom</label><input type="text" data-k="pets.${i}.name" value="${esc(p.name)}"><input type="text" data-k="pets.${i}.emoji" value="${esc(p.emoji)}" style="max-width:56px;text-align:center"></div>
      <div class="row"><label>Rareté</label><select class="f" data-k="pets.${i}.rarity">${cfg.rarities.map((r) => `<option${r.name === p.rarity ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
      <div class="row"><label>Puissance</label><input type="number" data-k="pets.${i}.power" value="${p.power}"><span class="note">+${p.power} % de gains équipé</span></div>
      <div class="row"><label>Modèle 3D</label><input type="text" data-k="pets.${i}.model" value="${esc(p.model || '')}" placeholder="nom dans ReplicatedStorage.ForgePets"></div></div>`;
    bindAll(box); });
  pane().querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { const p = cfg.pets[+b.dataset.del]; if (cfg.eggs.some((e) => e.entries.some((x) => x.pet === p.id)) && !confirm(p.name + ' est dans un œuf : le retirer aussi ?')) return;
    cfg.pets.splice(+b.dataset.del, 1); for (const e of cfg.eggs) e.entries = e.entries.filter((x) => x.pet !== p.id); save(); panePets(); });
  $('addPet').onclick = () => { let id = 'pet' + (cfg.pets.length + 1); while (S.petById(cfg, id)) id += 'x'; cfg.pets.push({ id, name: 'Nouveau pet', emoji: '🐣', rarity: cfg.rarities[0].name, power: 5 }); save(); panePets(); };
  $('impIdx').onclick = () => importPets(PG.index100().map((e) => { const g = PG.generate(e.text, e.seed); g.rarity = e.rarity; return g; }), 'Index');
  $('impSaved').onclick = () => { let saved = []; try { saved = JSON.parse(localStorage.getItem('forge.saved') || '[]'); } catch {} const cur = (() => { try { return JSON.parse(localStorage.getItem('forge.pet') || 'null'); } catch { return null; } })();
    if (cur) saved.unshift(cur); if (!saved.length) return toast('Aucun pet gardé dans Pet Studio'); importPets(saved.map((p) => ({ name: p.name, rarity: p.rarity, species: p.gen && p.gen.species })), 'Pet Studio'); };
}
// map Pet Studio rarities onto this game's rarities (same name, else by rank)
function mapRarity(name) {
  if (cfg.rarities.some((r) => r.name === name)) return name;
  const clean = String(name || '').split(' ')[0]; const hit = cfg.rarities.find((r) => r.name === clean); if (hit) return hit.name;
  const i = PG.RARITIES.indexOf(name), t = i < 0 ? 0 : Math.round((i / Math.max(1, PG.RARITIES.length - 1)) * (cfg.rarities.length - 1)); return cfg.rarities[t].name;
}
const POWER = [5, 12, 30, 70, 180, 450, 1500, 4000];
function importPets(list, from) {
  let added = 0;
  for (const g of list) { const name = String(g.name || 'Pet').slice(0, 40), model = safeName(name); if (cfg.pets.some((p) => p.model === model || p.name === name)) continue;
    let id = slug(name); while (S.petById(cfg, id)) id += '_2'; const rarity = mapRarity(g.rarity), tier = S.tierOf(cfg, rarity);
    const sp = g.species && PG.SPECIES[g.species]; cfg.pets.push({ id, name, emoji: g.emoji || (sp && sp.e) || '🐾', rarity, power: Math.round(POWER[Math.min(tier - 1, POWER.length - 1)] * (0.85 + ((added * 37) % 30) / 100)), model }); added++; }
  save(); panePets(); toast(added ? `✓ ${added} pets importés depuis ${from}` : 'Déjà importés');
}

function paneRar() {
  pane().innerHTML = `<div class="sec"><h3>Raretés <small>de la plus commune à la plus rare</small></h3>${cfg.rarities.map((r, i) => `<div class="row"><input type="color" data-k="rarities.${i}.color" value="${esc(r.color)}"><input type="text" data-k="rarities.${i}.name" value="${esc(r.name)}" data-old="${esc(r.name)}"><input type="number" data-k="rarities.${i}.sell" value="${r.sell}" title="prix de vente"><label style="min-width:auto"><input type="checkbox" data-k="rarities.${i}.lucky"${r.lucky ? ' checked' : ''}> 🍀</label></div>`).join('')}
    <div class="note">Nombre = prix de revente. 🍀 = boostée par la chance. Les 3 plus rares ont la cinématique complète (écran qui tremble, flash de couleur) et la dernière est arc-en-ciel.</div>
    <div class="btns" style="margin-top:8px"><button class="btn" id="addR">＋ Rareté</button><button class="btn danger" id="delR">− Dernière</button></div></div>`;
  pane().querySelectorAll('[data-old]').forEach((el) => el.addEventListener('change', () => { const o = el.dataset.old, n = el.value; for (const p of cfg.pets) if (p.rarity === o) p.rarity = n; el.dataset.old = n; save(); }));
  bindAll(pane());
  $('addR').onclick = () => { cfg.rarities.push({ name: 'Rareté ' + (cfg.rarities.length + 1), color: '#ff7ad9', lucky: true, sell: (cfg.rarities.at(-1)?.sell || 10) * 10 }); save(); paneRar(); };
  $('delR').onclick = () => { if (cfg.rarities.length < 3) return; const r = cfg.rarities.pop(); for (const p of cfg.pets) if (p.rarity === r.name) p.rarity = cfg.rarities.at(-1).name; save(); paneRar(); };
}

function paneEco() {
  const rb = cfg.rebirth;
  pane().innerHTML = `<div class="sec"><h3>Monnaies</h3>${cfg.currencies.map((c, i) => `<div class="row"><input type="text" data-k="currencies.${i}.name" value="${esc(c.name)}"><input type="number" data-k="currencies.${i}.start" value="${c.start}" title="au départ"><label style="min-width:auto"><input type="checkbox" data-k="currencies.${i}.leaderstat"${c.leaderstat ? ' checked' : ''}> classement</label></div>`).join('')}
      <div class="row"><label>Principale</label><select class="f" data-k="main">${curOpts(cfg.main)}</select></div><button class="btn" id="addC">＋ Monnaie</button></div>
    <div class="sec"><h3>Revenus</h3><div class="row"><label>Gain</label><input type="number" data-k="income.amount" value="${cfg.income.amount}"><span class="note">${esc(cfg.main)} toutes les</span><input type="number" step="0.5" data-k="income.every" value="${cfg.income.every}"><span class="note">s</span></div>
      <div class="note">Multiplié par les rebirths, la puissance des pets équipés et le gamepass Pièces ×2.</div></div>
    <div class="sec"><h3>Rebirth</h3><div class="row"><label>Prix de base</label><input type="number" data-k="rebirth.base" value="${rb.base}"><span class="note">×</span><input type="number" step="0.1" data-k="rebirth.growth" value="${rb.growth}"></div>
      <div class="row"><label>Bonus</label><input type="number" step="0.1" data-k="rebirth.step" value="${rb.step}"><span class="note">gains par rebirth</span></div>
      <div class="row"><label>Récompense</label><input type="number" data-k="rebirth.reward.amount" value="${rb.reward.amount}"><select class="f" data-k="rebirth.reward.currency">${curOpts(rb.reward.currency)}</select></div>
      <div class="note">${[0, 1, 2, 5, 10].map((n) => `#${n + 1} : ${S.abbreviate(S.rebirthCost(cfg, n))}`).join(' · ')}</div></div>
    <div class="sec"><h3>Inventaire & sauvegarde</h3><div class="row"><label>Places</label><input type="number" data-k="inventory.max" value="${cfg.inventory.max}"><label style="min-width:auto">Équipés</label><input type="number" data-k="inventory.equip" value="${cfg.inventory.equip}"></div>
      <div class="row"><label>DataStore</label><input type="text" data-k="datastore" value="${esc(cfg.datastore)}"></div><div class="row"><label>Autosave</label><input type="number" data-k="autosave" value="${cfg.autosave}"><span class="note">s</span></div>
      <div class="note">⚠️ Changer le nom du DataStore = repartir de zéro pour tous les joueurs.</div></div>
    <div class="sec"><h3>Classement</h3><div class="row"><label><input type="checkbox" data-k="leaderboard.enabled"${cfg.leaderboard.enabled ? ' checked' : ''}> Activé</label><select class="f" data-k="leaderboard.stat">${curOpts(cfg.leaderboard.stat)}</select></div>
      <div class="row"><label>Position</label><input type="number" data-k="leaderboard.pos.0" value="${cfg.leaderboard.pos[0]}"><input type="number" data-k="leaderboard.pos.1" value="${cfg.leaderboard.pos[1]}"></div></div>`;
  bindAll(pane(), (el) => { if (/rebirth\.(base|growth)/.test(el.dataset.k)) { const n = pane().querySelector('.sec:nth-child(3) .note:last-child'); if (n) n.textContent = [0, 1, 2, 5, 10].map((k) => `#${k + 1} : ${S.abbreviate(S.rebirthCost(cfg, k))}`).join(' · '); } });
  $('addC').onclick = () => { cfg.currencies.push({ name: 'Monnaie' + (cfg.currencies.length + 1), start: 0, leaderstat: false }); save(); paneEco(); };
}

function paneRew() {
  pane().innerHTML = `<div class="sec"><h3>Cadeau du jour <small>${cfg.daily.length} jours, en boucle</small></h3>${cfg.daily.map((d, i) => `<div class="row"><label>Jour ${i + 1}</label><input type="number" data-k="daily.${i}.amount" value="${d.amount}"><select class="f" data-k="daily.${i}.currency">${curOpts(d.currency)}</select><button class="x" data-dd="${i}">✕</button></div>`).join('')}
      <button class="btn" id="addD">＋ Jour</button><div class="note" style="margin-top:6px">Un jour raté remet la série au jour 1.</div></div>
    <div class="sec"><h3>Quêtes du jour</h3>${cfg.quests.map((q, i) => `<div class="sec" style="margin:6px 0"><div class="row"><input type="text" data-k="quests.${i}.name" value="${esc(q.name)}"><button class="x" data-dq="${i}">✕</button></div>
      <div class="row"><select class="f" data-k="quests.${i}.type">${Object.entries(S.QUEST_TYPES).map(([k, l]) => `<option value="${k}"${k === q.type ? ' selected' : ''}>${l}</option>`).join('')}</select><input type="number" data-k="quests.${i}.target" value="${q.target}"></div>
      <div class="row"><label>Récompense</label><input type="number" data-k="quests.${i}.amount" value="${q.amount}"><select class="f" data-k="quests.${i}.currency">${curOpts(q.currency)}</select></div></div>`).join('')}<button class="btn" id="addQ">＋ Quête</button></div>
    <div class="sec"><h3>Codes</h3>${cfg.codes.map((c, i) => `<div class="row"><input type="text" data-k="codes.${i}.code" value="${esc(c.code)}" style="text-transform:uppercase"><input type="number" data-k="codes.${i}.amount" value="${c.amount}"><select class="f" data-k="codes.${i}.currency">${curOpts(c.currency)}</select><button class="x" data-dc="${i}">✕</button></div>`).join('')}
      <button class="btn" id="addCode">＋ Code</button><div class="note" style="margin-top:6px">Un code s'utilise une fois par joueur. Majuscules et espaces ignorés.</div></div>`;
  bindAll(pane());
  const del = (attr, arr) => pane().querySelectorAll(`[${attr}]`).forEach((b) => b.onclick = () => { arr.splice(+b.getAttribute(attr), 1); save(); paneRew(); });
  del('data-dd', cfg.daily); del('data-dq', cfg.quests); del('data-dc', cfg.codes);
  $('addD').onclick = () => { cfg.daily.push({ currency: cfg.main, amount: 1000 }); save(); paneRew(); };
  $('addQ').onclick = () => { cfg.quests.push({ id: 'q' + Date.now().toString(36), name: 'Nouvelle quête', type: 'hatch', target: 10, currency: cfg.main, amount: 500 }); save(); paneRew(); };
  $('addCode').onclick = () => { cfg.codes.push({ code: 'CODE' + (cfg.codes.length + 1), currency: cfg.main, amount: 100, expires: 0 }); save(); paneRew(); };
}

function paneRobux() {
  pane().innerHTML = `<div class="sec"><h3>Gamepasses <small>id 0 = pas encore créé</small></h3>${cfg.gamepasses.map((g, i) => `<div class="row"><input type="text" data-k="gamepasses.${i}.name" value="${esc(g.name)}"><select class="f" data-k="gamepasses.${i}.perk">${Object.entries(S.PERKS).map(([k, l]) => `<option value="${k}"${k === g.perk ? ' selected' : ''}>${l}</option>`).join('')}</select></div><div class="row"><label>Id</label><input type="number" data-k="gamepasses.${i}.id" value="${g.id}" style="max-width:none"><button class="x" data-dg="${i}">✕</button></div>`).join('')}
      <button class="btn" id="addG">＋ Gamepass</button></div>
    <div class="sec"><h3>Produits (achats répétables)</h3>${cfg.products.map((p, i) => `<div class="row"><input type="text" data-k="products.${i}.name" value="${esc(p.name)}"><input type="number" data-k="products.${i}.amount" value="${p.amount}"><select class="f" data-k="products.${i}.currency">${curOpts(p.currency)}</select></div><div class="row"><label>Id</label><input type="number" data-k="products.${i}.id" value="${p.id}" style="max-width:none"><button class="x" data-dp="${i}">✕</button></div>`).join('')}
      <button class="btn" id="addP">＋ Produit</button></div>
    <div class="sec"><div class="note">Crée les gamepasses et produits sur create.roblox.com (ton jeu → Monétisation), puis colle leurs numéros ici. Le serveur vérifie chaque achat auprès de Roblox (ProcessReceipt) et ne donne jamais deux fois le même achat. Rien n'est vendu tant qu'un id vaut 0.</div></div>`;
  bindAll(pane());
  const del = (attr, arr) => pane().querySelectorAll(`[${attr}]`).forEach((b) => b.onclick = () => { arr.splice(+b.getAttribute(attr), 1); save(); paneRobux(); });
  del('data-dg', cfg.gamepasses); del('data-dp', cfg.products);
  $('addG').onclick = () => { cfg.gamepasses.push({ id: 0, name: 'Nouveau pass', perk: 'storage' }); save(); paneRobux(); };
  $('addP').onclick = () => { cfg.products.push({ id: 0, name: 'Pack', currency: cfg.currencies[1]?.name || cfg.main, amount: 100 }); save(); paneRobux(); };
}

function paneAdv() {
  cfg.badges ||= []; cfg.trading ||= { enabled: true, max: 8 }; cfg.antiCheat ||= { speed: true }; if (cfg.analytics === undefined) cfg.analytics = true;
  pane().innerHTML = `<div class="sec"><h3>🏅 Badges <small>id 0 = pas encore créé</small></h3>${cfg.badges.map((b, i) => `<div class="sec" style="margin:6px 0"><div class="row"><input type="text" data-k="badges.${i}.name" value="${esc(b.name)}"><button class="x" data-db="${i}">✕</button></div>
      <div class="row"><select class="f" data-k="badges.${i}.when">${Object.entries(S.BADGE_WHEN).map(([k, l]) => `<option value="${k}"${k === b.when ? ' selected' : ''}>${l}</option>`).join('')}</select>${b.when === 'rarity' ? `<select class="f" data-k="badges.${i}.value">${cfg.rarities.map((r) => `<option${r.name === b.value ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select>` : b.when === 'join' ? '' : `<input type="number" data-k="badges.${i}.value" value="${+b.value || 1}">`}</div>
      <div class="row"><label>Id badge</label><input type="number" data-k="badges.${i}.id" value="${b.id}" style="max-width:none"></div></div>`).join('')}
      <button class="btn" id="addB">＋ Badge</button><div class="note" style="margin-top:6px">Crée les badges sur create.roblox.com (ton jeu → Badges), colle leurs numéros. Le serveur les donne une fois (BadgeService).</div></div>
    <div class="sec"><h3>🤝 Échanges entre joueurs</h3><div class="row"><label><input type="checkbox" data-k="trading.enabled"${cfg.trading.enabled ? ' checked' : ''}> Activés</label><label style="min-width:auto">Max pets</label><input type="number" data-k="trading.max" value="${cfg.trading.max}"></div>
      <div class="note">Les deux joueurs s'invitent, posent leurs pets, puis « Prêt » des deux côtés : le serveur revérifie tout et fait l'échange d'un coup, puis sauvegarde les deux.</div></div>
    <div class="sec"><h3>🛡️ Anti-triche</h3><div class="row"><label><input type="checkbox" data-k="antiCheat.speed"${cfg.antiCheat.speed ? ' checked' : ''}> Vitesse anormale → retour en arrière</label></div>
      <div class="note">Ne kicke jamais. Pour tes propres téléportations : player:SetAttribute("ForgeTeleporting", true) pendant le saut. Les remotes sont déjà validés et limités côté serveur.</div></div>
    <div class="sec"><h3>📊 Statistiques Roblox</h3><div class="row"><label><input type="checkbox" data-k="analytics"${cfg.analytics ? ' checked' : ''}> Activées</label></div>
      <div class="note">Dépenses et gains (œufs, ventes, cadeaux, codes, achats Robux) et parcours des nouveaux joueurs (arrivée → 1er œuf → 1er pet équipé → 1er rebirth), visibles dans Creator Hub → Analytics.</div></div>
    <div class="sec"><h3>✏️ Noms de pets</h3><div class="note">Les joueurs peuvent renommer leurs pets (20 caractères) : chaque nom passe par le filtre Roblox (TextService) avant d'être affiché.</div></div>`;
  bindAll(pane(), (el) => { if (/\.when$/.test(el.dataset.k)) { const i = +el.dataset.k.split('.')[1]; cfg.badges[i].value = cfg.badges[i].when === 'rarity' ? cfg.rarities.at(-3)?.name || cfg.rarities[0].name : 1; save(); paneAdv(); } });
  pane().querySelectorAll('[data-db]').forEach((b) => b.onclick = () => { cfg.badges.splice(+b.dataset.db, 1); save(); paneAdv(); });
  $('addB').onclick = () => { cfg.badges.push({ id: 0, name: 'Nouveau badge', when: 'hatch', value: 10 }); save(); paneAdv(); };
}

/* ======================= export ======================= */
let KIT = null;
async function loadKit() { if (KIT) return KIT; const get = async (f) => (await fetch('kit/' + f, { cache: 'no-cache' })).text();
  const [logic, server, client] = await Promise.all(['ForgeLogic.lua', 'ForgeSystems.server.lua', 'ForgeSystems.client.lua'].map(get)); KIT = { logic, server, client }; return KIT; }
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.path), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name); off += 30 + name.length + data.length;
  }
  const csize = central.reduce((s, a) => s + a.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
function packFiles(kit) {
  return [
    { path: 'ReplicatedStorage/ForgeSystems/Config.lua', data: S.configLua(cfg) },
    { path: 'ReplicatedStorage/ForgeSystems/Logic.lua', data: kit.logic },
    { path: 'ServerScriptService/ForgeSystems.server.lua', data: kit.server },
    { path: 'StarterPlayerScripts/ForgeSystems.client.lua', data: kit.client },
    { path: 'LISEZ-MOI.txt', data: `Systèmes Roblox Forge : ${cfg.eggs.length} œufs, ${cfg.pets.length} pets, ${cfg.rarities.length} raretés.\n\n- ReplicatedStorage/ForgeSystems/Config : tous tes réglages (modifiables)\n- ReplicatedStorage/ForgeSystems/Logic : les règles (mêmes calculs que le studio)\n- ServerScriptService/ForgeSystems : sauvegarde (DataStore + verrou de session), leaderstats, œufs, ventes, rebirth, cadeau du jour, quêtes, codes, gamepasses, produits, classement\n- StarterPlayerScripts/ForgeSystems : cinématique d'ouverture, panneau Pets / Quêtes / Cadeau / Codes / Rebirth, branchement des fenêtres de GUI Studio\n\nPour tester la sauvegarde dans Studio : Game Settings > Security > Enable Studio Access to API Services.\nPets 3D : exporte l'Index (ou tes pets) depuis Pet Studio, le pet équipé le plus fort suit le joueur.\n` },
  ];
}
async function buildPack() { const kit = await loadKit(); return zip(packFiles(kit)); }
function paneExport() {
  const issues = S.validate(cfg);
  pane().innerHTML = `<div class="sec"><h3>${esc(cfg.name)} <small>${cfg.eggs.length} œufs · ${cfg.pets.length} pets · ${cfg.quests.length} quêtes · ${cfg.codes.length} codes</small></h3>
      ${issues.length ? issues.map((x) => `<div class="warn">⚠️ ${esc(x)}</div>`).join('') : '<div class="okc">✓ Configuration valide</div>'}
      <button class="btn ok big" id="toGame"${issues.length ? ' disabled' : ''}>🎮 Ajouter à mon jeu</button>
      <button class="btn big" id="dl"${issues.length ? ' disabled' : ''}>📦 Télécharger le pack (.zip)</button>
      <button class="btn big" id="copyCfg">⧉ Copier la config (Luau)</button></div>
    <div class="sec"><h3>Dans ton jeu</h3><div class="note"><b>🎮 Ajouter à mon jeu</b> ouvre Roblox Push : choisis ton jeu, les systèmes sont <b>ajoutés</b> sans rien effacer. Les supports d'œufs apparaissent aux positions choisies, avec leurs chances affichées au-dessus.<br><br>Ajoute aussi le kit <b>Stud</b> de GUI Studio : ses boutons Récompenses, Index, Rebirth et ses fenêtres sont branchés automatiquement.</div></div>
    <div class="sec"><h3>Projet</h3><div class="btns"><button class="btn danger" id="reset">↺ Config de départ</button></div></div>`;
  $('toGame').onclick = async () => { const blob = await buildPack(); const buf = new Uint8Array(await blob.arrayBuffer()); let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    try { localStorage.setItem('rp2.pendingPack', JSON.stringify({ name: 'ForgeSystems', label: 'Systèmes du jeu', rarity: 'Systèmes', b64: btoa(bin), at: Date.now() })); }
    catch { return toast('Mémoire du navigateur pleine : télécharge plutôt le pack.'); }
    toast('Ouverture de Roblox Push…'); setTimeout(() => (location.href = '../../roblox-push/'), 450); };
  $('dl').onclick = async () => { const blob = await buildPack(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ForgeSystems.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Pack téléchargé ✓'); };
  $('copyCfg').onclick = async () => { try { await navigator.clipboard.writeText(S.configLua(cfg)); toast('Config copiée ✓'); } catch { toast('Copie impossible'); } };
  $('reset').onclick = () => { if (!confirm('Revenir à la config de départ ?')) return; cfg = S.defaultConfig(); save(); eggSel = cfg.eggs[0].id; render(); };
}

/* ======================= sheet resize ======================= */
(() => { const grip = $('grip'); let y0 = null, h0 = 0;
  grip.addEventListener('pointerdown', (e) => { y0 = e.clientY; h0 = $('view').offsetHeight; grip.setPointerCapture(e.pointerId); });
  grip.addEventListener('pointermove', (e) => { if (y0 == null) return; const h = Math.max(innerHeight * 0.28, Math.min(innerHeight * 0.75, h0 + e.clientY - y0)); document.documentElement.style.setProperty('--vh', h + 'px'); });
  grip.addEventListener('pointerup', () => (y0 = null)); })();

render();
window.__sys = { get cfg() { return cfg; }, S, buildPack, packFiles, loadKit, previewHatch, render, get busy() { return busy; }, setTab: (t) => { tab = t; render(); } }; // used by automated tests
