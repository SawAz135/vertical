import * as THREE from 'three';
import { net, makeCode } from './net.js';
import { Farmer } from '../actors/farmer.js';
import { ST } from '../world/dynpotatoes.js';
import { BIN } from '../world/machine.js';
import { rng } from '../core/util.js';
import { audio } from '../audio/audio.js';

// =====================================================================================
// CO-OP GLUE between the Net layer and the game.
// Batched events: picks (field ids), dumps (visual potatoes flying to the bin), pays
// (shared wallet + jar), shots, purchases, grand sale. Host snapshots every 3 s.
// Guests never write their own save; leaving a session reloads your own save.
// =====================================================================================
export const COLORS = ['#e8572a', '#2a9de8', '#6ac23a', '#c23aa8', '#e8c22a', '#2ae8c2'];

export class Coop {
  constructor(game) {
    this.g = game; this.remotes = new Map(); this.sendT = 0; this.syncT = 0; this.flushT = 0;
    this.picks = []; this.dumps = []; this.payN = 0; this.payV = 0; this.payGold = 0; this.applying = false;
    net.on('msg', (t, d, from) => this._msg(t, d, from));
    net.on('joined', m => { if (this.g.state !== 'menu') this.g.ui.toast(`👋 ${m.name} a rejoint la récolte`); audio.ui('open'); if (net.isHost) this._snapshot(true); });
    net.on('left', id => { const r = this.remotes.get(id); if (r) { this.g.ui.toast(`🚪 ${r.name} est parti`); r.f.dispose(); this.remotes.delete(id); } });
    net.on('host', () => this.g.ui.toast('👑 Tu es maintenant l’hôte de la session'));
    net.on('full', () => this.g.ui.toast('Session pleine (4 joueurs max).', 'warn'));
    net.on('members', list => this.g.ui.players?.(list, net));
  }
  get active() { return net.active; }
  get guest() { return net.active && !net.isHost; }

  // ---------------- session control ----------------
  async loadSupabase() {
    if (window.supabase) return true;
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/supabase.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    return !!window.supabase;
  }
  async host({ name, color, kind, visibility }) {
    if (kind === 'online') await this.loadSupabase();
    const code = makeCode();
    const ok = await net.join(code, { name, color, kind, visibility, create: true });
    return ok ? code : null;
  }
  async join(code, { name, color, kind }) {
    if (kind === 'online') await this.loadSupabase();
    const ok = await net.join(code.toUpperCase(), { name, color, kind, visibility: 'private' });
    if (ok) { this.waitingSnap = true; setTimeout(() => net.send('hello', {}), 400); }
    return ok;
  }
  async leave() { const wasGuest = this.guest; await net.leave(); for (const r of this.remotes.values()) r.f.dispose(); this.remotes.clear(); if (wasGuest) location.href = location.pathname; }
  inviteLink() { return `${location.origin}${location.pathname}?room=${net.room}&net=${net.kind}`; }

  // ---------------- outgoing hooks (called by the game) ----------------
  onTake(j) { if (net.active && !this.applying) this.picks.push(j); }
  onDump(i) { if (!net.active) return; const d = this.g.dyn.db; this.dumps.push(d.variety[i], Math.round(d.size[i] * 100)); }
  onShot(p, v, variety) { if (net.active) net.send('shot', { p: p.toArray().map(x => +x.toFixed(2)), v: v.toArray().map(x => +x.toFixed(2)), k: variety }); }
  onPay(value, gold) { if (!net.active) return; this.payN++; this.payV += value; if (gold) this.payGold++; }
  onBuy(id, lv, price) { if (net.active) net.send('buy', { id, lv, price }); }
  onSale(bonus) { if (net.active) net.send('sale', { bonus }); }

  // ---------------- incoming ----------------
  _msg(t, d, from) {
    const g = this.g;
    if (t === 'st') { this._remoteState(from, d); return; }
    if (t === 'pick') { this.applying = true; for (const j of d.ids) if (j < g.field.db.n && g.field.db.state[j] === 0) g.field.take(j); this.applying = false; return; }
    if (t === 'dump') { this._remoteDump(from, d); return; }
    if (t === 'shot') { const i = g.dyn.spawnRandom(rng((Math.random() * 1e9) | 0), d.p[0], d.p[1], d.p[2]); if (i >= 0) { g.dyn.db.variety[i] = d.k; g.dyn.remote[i] = 1; g.dyn.setFree(i, d.v[0], d.v[1], d.v[2]); audio.cannon({ x: d.p[0], y: d.p[1], z: d.p[2] }); } return; }
    if (t === 'pay') { g.money += d.v; g.stats.jar += d.n; g.stats.earned += d.v; g.ui.gain(d.v); if (d.gold) g.ui.toast('✨ Un coéquipier a trouvé une patate dorée !', 'gold'); g._milestones?.(); return; }
    if (t === 'buy') { if ((g.levels[d.id] || 0) < d.lv) { g.levels[d.id] = d.lv; g.money -= d.price; g._applyUpgrades(); g.shop.drawChalk(g.levels); if (g.ui.shopOpen) g.ui.renderShop(); g.ui.toast(`🛒 ${this.remotes.get(from)?.name || 'Un coéquipier'} a acheté une amélioration`); } return; }
    if (t === 'sale') { if (g.state === 'play') g.grandSale(true, d.bonus); return; }
    if (t === 'hello') { if (net.isHost) this._snapshot(true); return; }
    if (t === 'snap') { if (!net.isHost && from === net.hostId) this._applySnap(d); return; }
  }
  _remoteState(id, s) {
    let r = this.remotes.get(id);
    if (!r) { const m = net.members.find(x => x.id === id); r = { name: s.n || m?.name || 'Joueur', f: new Farmer(this.g.scene, this.g.M, s.n || m?.name || 'Joueur', s.col || m?.color || '#e8572a') }; this.remotes.set(id, r); }
    r.f.setState(s);
  }
  _remoteDump(id, d) {
    const g = this.g, r = this.remotes.get(id); const from = r ? r.f.pos.clone().add(new THREE.Vector3(0, 1.1, 0)) : new THREE.Vector3(BIN.x, 2, BIN.z - 2);
    for (let k = 0; k < d.v.length; k += 2) {
      const i = g.dyn.spawnRandom(rng((Math.random() * 1e9) | 0), from.x, from.y, from.z); if (i < 0) break;
      g.dyn.db.variety[i] = d.v[k]; g.dyn.db.size[i] = d.v[k + 1] / 100; g.dyn.remote[i] = 1;
      const tg = new THREE.Vector3(); g.machine.binTarget(Math.random, tg);
      setTimeout(() => g.dyn.fly(i, tg, 0.45 + Math.random() * 0.15, 0.7, id2 => g.dyn.setFree(id2, 0, -2.5, 0)), k * 18);
    }
  }
  _snapshot(full) {
    const g = this.g, db = g.field.db, taken = [];
    for (let i = 0; i < db.n; i++) if (db.state[i] !== 0) taken.push(i);
    const snap = { money: Math.round(g.money * 10) / 10, levels: g.levels, jar: g.stats.jar, prestige: g.stats.prestige || 0, hour: +g.stats.hour.toFixed(2), over: g.overflowed, taken };
    if (full) { const gens = []; for (let i = 0; i < db.n; i++) if (g.field.gen[i]) gens.push(i, g.field.gen[i]); snap.gens = gens; const deps = []; for (let i = 0; i < db.n; i++) if (g.field.depth[i]) deps.push(i, g.field.depth[i]); snap.deps = deps; snap.full = 1; }
    net.send('snap', snap);
  }
  _applySnap(s) {
    const g = this.g, F = g.field, db = F.db;
    g.money = s.money; g.levels = s.levels || {}; g.stats.prestige = s.prestige; g.overflowed = s.over;
    if (Math.abs(g.stats.hour - s.hour) > 0.3) g.stats.hour = s.hour;
    g._applyUpgrades(); g.shop.drawChalk(g.levels);
    if (s.full) {
      for (let k = 0; k < (s.gens || []).length; k += 2) if (s.gens[k] < db.n) F.gen[s.gens[k]] = s.gens[k + 1];
      for (let k = 0; k < (s.deps || []).length; k += 2) if (s.deps[k] < db.n) F.depth[s.deps[k]] = s.deps[k + 1];
      if (this.waitingSnap) { // first snapshot: rebuild the jar to the shared count
        this.waitingSnap = false; g.stats.jar = s.jar;
        for (const i of [...g.dyn.settled]) if (g.dyn.inJar[i]) g.dyn.free(i);
        g.machine.setFill(s.jar);
        g.ui.toast('🤝 Synchronisé avec l’hôte'); g.say('Bienvenue dans l’équipe ! Plus on est de fous, plus on ramasse.', 'wave', true);
      }
    }
    if (s.jar > g.stats.jar) g.stats.jar = s.jar;
    // field reconciliation
    const hostTaken = new Set(s.taken);
    this.applying = true;
    for (const j of s.taken) if (j < db.n && db.state[j] === 0) F.take(j);
    for (const r of F.regrow) if (!hostTaken.has(r.i)) r.at = Math.min(r.at, F.time);
    this.applying = false;
    if (g.ui.shopOpen) g.ui.renderShop();
  }

  // ---------------- per frame ----------------
  update(dt) {
    if (!net.active) return;
    const g = this.g, p = g.player;
    this.sendT -= dt;
    if (this.sendT <= 0 && g.state !== 'menu') {
      this.sendT = 1 / 12;
      net.send('st', { n: net.name, col: net.color, p: [+p.pos.x.toFixed(2), +p.pos.y.toFixed(2), +p.pos.z.toFixed(2)], y: +p.yaw.toFixed(3), pi: +p.pitch.toFixed(2), v: +Math.hypot(p.vel.x, p.vel.z).toFixed(1), t: p.tool, c: p.carried() });
    }
    this.flushT -= dt;
    if (this.flushT <= 0) {
      this.flushT = 0.15;
      if (this.picks.length) { net.send('pick', { ids: this.picks }); this.picks = []; }
      if (this.dumps.length) { net.send('dump', { v: this.dumps }); this.dumps = []; }
      if (this.payN) { net.send('pay', { n: this.payN, v: Math.round(this.payV * 10) / 10, gold: this.payGold }); this.payN = 0; this.payV = 0; this.payGold = 0; }
    }
    if (net.isHost) { this.syncT -= dt; if (this.syncT <= 0) { this.syncT = 3; this._snapshot(false); } }
    for (const [id, r] of this.remotes) { if (performance.now() - r.f.last > 8000) { r.f.dispose(); this.remotes.delete(id); continue; } r.f.update(dt); }
  }
}
export { net };
