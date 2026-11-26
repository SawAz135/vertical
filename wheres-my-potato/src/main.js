import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GradeShader } from './gfx/grade.js';
import { settings } from './core/settings.js';
import { input } from './core/input.js';
import { storage, isTouch, rng, damp } from './core/util.js';
import { setAniso } from './gfx/textures.js';
import { createMaterials } from './gfx/materials.js';
import { FX } from './gfx/fx.js';
import { FieldWorld, ground } from './world/field.js';
import { DynPotatoes, ST } from './world/dynpotatoes.js';
import { Machine, JAR, BIN } from './world/machine.js';
import { Shop, itemById, LINES, pick, SHOP } from './world/shop.js';
import { VARIETIES } from './world/potatoes.js';
import { Player } from './player/player.js';
import { audio } from './audio/audio.js';
import { UI } from './ui/ui.js';
import { Achievements } from './game/achievements.js';
import { NightEvents } from './world/night.js';
import { Coop, net } from './net/coop.js';

// =====================================================================================
// GAME — boot, render pipeline, state machine (menu ⇄ play ⇄ pause / shop / book),
// economy, saving, milestones and Gérard's reactions.
// =====================================================================================
const SAVE_KEY = 'wmp.save.v1';
const MILESTONES = [10, 50, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000, 15000, 25000, 50000, 100000];
const tick = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

class Game {
  constructor() {
    if (isTouch()) document.body.classList.add('touch');
    this.state = 'loading'; this.money = 0; this.levels = {}; this.stats = { jar: 0, picked: 0, gold: 0, dumped: 0, earned: 0, time: 0, thrown: 0, kicked: 0, prestige: 0, lifetimeJar: 0, hour: 17.4 };
    this.shakeAmt = 0; this.fps = 60; this.renderScale = 1; this.slow = 0; this.fast = 0; this.t = 0;
    this.attract = new Set(); this.attractT = 0; this.lastGreet = -999; this.nextIdle = 40; this.overflowed = false;
  }
  level(id) { return this.levels[id] || 0; }
  val(id, key) { return itemById[id].levels[this.level(id)][key]; }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
  mult() { return this.val('contract', 'mult') * (1 + 0.25 * (this.stats.prestige || 0)); }
  saleBonus() { return Math.round(this.stats.jar * 1.5 * this.mult()); }

  async boot() {
    this.ui = new UI(this);
    this.ach = new Achievements(this);
    this.coop = new Coop(this);
    const q = settings.q;
    // ---- renderer ----
    const canvas = document.getElementById('game');
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q.antialias, powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.12;
    r.shadowMap.enabled = q.shadows; r.shadowMap.type = THREE.PCFSoftShadowMap;
    setAniso(r);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.v.fov, innerWidth / innerHeight, 0.05, 900); this.scene.add(this.camera);
    this._resize(); addEventListener('resize', () => this._resize());
    this.ui.progress(0.05, 'Chargement des polices…');
    try { await Promise.race([Promise.all(['230px Marker', '52px Fred', '40px Luck'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]); } catch { /* fonts optional */ }
    this.ui.progress(0.08, 'Peinture des textures…'); await tick();
    this.M = createMaterials(isTouch() ? 256 : 512);
    this.ui.progress(0.2, 'Formation des dunes de patates…'); await tick();
    this.field = new FieldWorld(this.scene, this.M, q);
    this.ui.progress(0.55, 'Montage du convoyeur et du bocal…'); await tick();
    this.fx = new FX(this.scene, ground);
    const world = { ground: (x, z) => ground(x, z), boxes: [], jar: JAR, inBin: (x, y, z) => this.machine.inBin(x, y, z) };
    this.machine = new Machine(this.scene, this.M, world);   // registers its cleared zones
    this.shop = new Shop(this.scene, this.M);                 // idem
    this.field.build(); this.field.envFrom(r);                // now the potato sea can be generated around them
    this.machine.build();
    world.boxes = this.machine.boxes;
    this.dyn = new DynPotatoes(this.scene, { liveCap: 900, settledCap: q.jarMax, world, onImpact: (x, y, z, s, kind) => this._impact(x, y, z, s, kind), onSettleInJar: () => {} });
    this.machine.dyn = this.dyn;
    this.dyn.onSpill = () => { if (this.machine.fillRatio(this.dyn) > 0.85) this._overflow(); };
    this.machine.onPay = (i, x, y, z) => this._pay(i, x, y, z);
    this.machine.onFeed = () => { if (Math.random() < 0.5) audio.thud('wood', { x: BIN.x + 0.8, y: 0.8, z: BIN.z }, 2); };
    this.ui.progress(0.7, 'Gérard enfile sa casquette…'); await tick();
    this.field.onTake = j => this.coop.onTake(j);
    this.colliders = [...this.field.colliders, ...this.machine.colliders, ...this.shop.colliders];
    this.bounds = this.field.bounds;
    this.player = new Player(this, this.camera);
    this.night = new NightEvents(this);
    this.dyn.onDetach = j => { const F = this.field; F.db.state[j] = 1; F.regrow.push({ i: j, at: F.time + F.regrowDelay() }); };
    this.dyn.onRestore = i => { const j = this.dyn.fieldId[i], d = this.dyn.db; this.field.restore(j, d.px[i], d.py[i] - d.radius(i) * 0.35, d.pz[i], d.quat(i, new THREE.Quaternion())); this.dyn.free(i); };
    this.player.vm.visible = false;
    // ---- post-processing ----
    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.6, 0.82);
    this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader); this.composer.addPass(this.grade);
    this._applyQuality();
    settings.on('change', k => { if (k === 'quality') this._applyQuality(); });
    // ---- save ----
    this.ui.progress(0.85, 'Remplissage du bocal…'); await tick();
    this._load();
    this.shop.drawChalk(this.levels);
    // warm up shaders so the first frames don't hitch
    r.compile(this.scene, this.camera);
    this.ui.progress(1, 'Prêt !'); await tick();
    input.attach(canvas, document.getElementById('touch'));
    input.onLock(locked => { if (!locked && this.state === 'play' && !this.ui.shopOpen && !this.ui.panelOpen) this.pause(); });
    // first user gesture starts audio
    const unlock = () => { audio.init(); audio.motor({ x: this.machine.drum.position.x, y: this.machine.drum.position.y, z: this.machine.drum.position.z }); };
    addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
    addEventListener('keydown', e => { if (e.key === 'Escape' && this.state === 'play' && !this.ui.shopOpen) this.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this._save(); if (this.state === 'play') this.pause(); } });
    this.ui.hideLoading();
    this.toMenu();
    const qs = new URLSearchParams(location.search), room = qs.get('room');
    if (room) {
      const prof = storage.get('wmp.profile', { name: 'Récolteur ' + (100 + Math.floor(Math.random() * 900)), color: '#2a9de8' });
      this.coop.join(room, { name: prof.name, color: prof.color, kind: qs.get('net') === 'local' ? 'local' : 'online' }).then(ok => { if (ok) this.startPlay(); else this.ui.toast('Impossible de rejoindre la session ' + room, 'warn'); });
    }
    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this._frame());
  }
  _resize() {
    const q = settings.q, pr = Math.min(devicePixelRatio || 1, q.pixelRatio) * this.renderScale;
    this.renderer.setPixelRatio(pr); this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.composer?.setPixelRatio(pr); this.composer?.setSize(innerWidth, innerHeight);
  }
  _applyQuality() {
    const q = settings.q; this.bloom.enabled = q.bloom;
    this.renderer.shadowMap.enabled = q.shadows; this.field.sun.castShadow = q.shadows;
    if (this.field.sun.shadow.mapSize.x !== q.shadowMap) { this.field.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap); this.field.sun.shadow.map?.dispose(); this.field.sun.shadow.map = null; }
    this.field.q = Object.assign({}, this.field.q, { potatoRadius: q.potatoRadius, nearLod: q.nearLod, shadows: q.shadows });
    this.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => (m.needsUpdate = true)); });
    this._resize();
  }

  // ---------------- save / load ----------------
  _load() {
    const s = storage.get(SAVE_KEY);
    this.hasSave = !!s;
    if (s) { this.money = s.money || 0; this.levels = s.levels || {}; Object.assign(this.stats, s.stats || {}); this.overflowed = !!s.overflowed; }
    this.ui.moneyShown = this.money; this.lastMilestone = MILESTONES.filter(n => n <= this.stats.jar).pop() || 0;
    this._applyUpgrades();
    // rebuild the jar contents (packed) to match the saved count
    this.machine.setFill(this.stats.jar);
  }
  _save() {
    if (this.state === 'loading' || this.coop?.guest) return; // guests never overwrite their own save
    storage.set(SAVE_KEY, { v: 1, money: Math.round(this.money * 100) / 100, levels: this.levels, stats: this.stats, overflowed: this.overflowed, at: Date.now() });
    this.hasSave = true;
  }
  _newGame() {
    storage.del(SAVE_KEY);
    this.money = 0; this.levels = {}; this.stats = { jar: 0, picked: 0, gold: 0, dumped: 0, earned: 0, time: 0, thrown: 0, kicked: 0, prestige: 0, lifetimeJar: 0, hour: 17.4 }; this.overflowed = false; this.ui.moneyShown = 0; this.lastMilestone = 0;
    // empty the jar and everything loose
    for (const i of [...this.dyn.settled, ...this.dyn.live]) this.dyn.free(i);
    this.machine.setFill(0);
    this.player.hands.length = 0; this.player.bucket.length = 0; this.player.tool = 'hands';
    this._applyUpgrades(); this.shop.drawChalk(this.levels);
  }
  _applyUpgrades() {
    this.machine.feedEvery = this.val('motor', 'feed'); this.machine.speed = this.val('motor', 'speed');
    this.field.growthMul = this.val('fertilizer', 'grow'); this.field.goldBoost = this.val('fertilizer', 'gold');
  }

  // ---------------- economy ----------------
  buy(id) {
    const it = itemById[id], lv = this.level(id), next = it.levels[lv + 1];
    if (!next) { this.say('max'); return false; }
    if (this.money < next.price) { audio.ui('deny'); this.say('poor', 'shrug'); return false; }
    this.money -= next.price; this.levels[id] = lv + 1; this._applyUpgrades(); this.coop.onBuy(id, lv + 1, next.price);
    audio.ui('buy'); this.say('buy', 'thumbs');
    if (id === 'bucket') { this.player.setTool('bucket'); }
    this.ui.renderShop(id, 'bought'); this.shop.drawChalk(this.levels); this._save();
    this.fx.sparkle(SHOP.x, 1.6, SHOP.z - 0.3, 24);
    return true;
  }
  _pay(i, x, y, z) {
    if (this.state === 'menu') { this.attract.add(i); return; } // demo potatoes are free
    const v = this.dyn.db.variety[i], gold = v === 5;
    const value = Math.round(VARIETIES[v].price * this.mult() * 10) / 10;
    this.dyn.paid[i] = 1;
    const p = new THREE.Vector3(x, y + 0.3, z);
    if (this.dyn.remote[i]) { audio.coin(p, gold); if (Math.random() < 0.3) this.fx.coinBurst(x, y, z, 1); return; } // a teammate's potato: they get it counted
    this.money += value; this.stats.jar++; this.stats.earned += value; this.coop.onPay(value, gold);
    this.ui.gain(value);
    if (gold || this.stats.jar % 3 === 0 || value >= 2) this.ui.floater(`+${value % 1 ? value.toFixed(1) : value} ₣`, p, gold ? '#fff2a0' : null);
    audio.coin(p, gold);
    if (gold) { this.fx.coinBurst(x, y, z, 8); this.fx.ring(x, y, z); this.shake(0.15); } else if (this.stats.jar % 4 === 0) this.fx.coinBurst(x, y, z, 1);
    this._milestones();
  }
  _milestones() {
    const m = MILESTONES.filter(n => n <= this.stats.jar).pop();
    if (m && m > (this.lastMilestone || 0)) {
      this.lastMilestone = m; if (this.stats.jar - m > 30) return; // reached long ago (loaded save / sync)
      this.ui.banner('PALIER ATTEINT', `${m.toLocaleString('fr-FR')} PATATES !`); audio.ui('fanfare'); this.say(LINES.milestone(m), 'cheer', true); this.fx.sparkle(JAR.x, JAR.rim + 0.5, JAR.z, 60, [1, 0.85, 0.4], 3); this._save();
    }
  }
  // ---------------- La Grande Vente (prestige) ----------------
  grandSale(remote = false, bonus) {
    if (!remote && this.stats.jar < 500) { audio.ui('deny'); this.say('Il faut au moins 500 patates dans le bocal pour intéresser la friterie !', 'shrug', true); return; }
    this.ui.closeShop(); this.player.enabled = false; input.wantLock = false; input.unlock();
    this.state = 'cine'; this.cineT = 0; this.ui.hideHud();
    const d = this.dyn;
    this.saleQueue = d.settled.filter(i => d.inJar[i] || d.paid[i]).sort((a, b) => d.db.py[b] - d.db.py[a]);
    this.saleBonusAmt = remote ? bonus : this.saleBonus(); this.saleCount = this.stats.jar; this.saleFill0 = this.machine.fillUnits;
    if (!remote) this.coop.onSale(this.saleBonusAmt);
    this.ui.banner('LA GRANDE VENTE', 'LA FRITERIE ACHÈTE TOUT !'); audio.ui('fanfare');
    this.say('La friterie rachète TOUT le bocal ! Regarde-moi ça !', 'cheer', true);
  }
  _saleCine(dt) {
    this.cineT += dt; const t = this.cineT, d = this.dyn;
    // orbiting crane shot: low & close, rising and pulling back
    const a = -1.9 + t * 0.25, rad = 30 + t * 2.2, h = 3 + t * 4.5;
    this.camera.position.set(JAR.x + Math.cos(a) * rad, h, JAR.z + Math.sin(a) * rad);
    this.camera.lookAt(JAR.x, 12 + t * 1.2, JAR.z); this.camera.fov = 55; this.camera.updateProjectionMatrix();
    if (t > 1.2 && this.machine.fillUnits > 0) {
      const drain = Math.max(30, this.saleFill0 / (60 * 3.5));
      this.machine.setFill(Math.max(0, this.machine.fillUnits - drain));
      for (let k = 0; k < 6; k++) { const a = Math.random() * 6.28, rr = Math.random() * JAR.R; this.fx.sparkle(JAR.x + Math.cos(a) * rr, this.machine.fillTop + 0.1, JAR.z + Math.sin(a) * rr, 1, [1, 0.85, 0.35], 2.5); }
      if (Math.random() < 0.3) { this.fx.coinBurst(JAR.x + (Math.random() - 0.5) * 4, this.machine.fillTop + 0.3, JAR.z + (Math.random() - 0.5) * 4, 2); audio.coin(null); }
    }
    if (t > 1.2) {
      const per = Math.max(8, Math.ceil(this.saleQueue.length / (60 * 3.2)));
      for (let k = 0; k < per && this.saleQueue.length; k++) {
        const i = this.saleQueue.shift(); if (d.st[i] !== ST.SETTLED) continue;
        const x = d.db.px[i], y = d.db.py[i], z = d.db.pz[i]; d.free(i);
        if (Math.random() < 0.35) this.fx.sparkle(x, y, z, 2, [1, 0.8, 0.3], 1.2);
        if (Math.random() < 0.04) { this.fx.coinBurst(x, y + 0.2, z, 2); audio.coin({ x, y, z }); }
      }
      this.shake(0.05);
    }
    if (t > 1.2 && !this.saleQueue.length && this.machine.fillUnits <= 0 && !this.saleDone) {
      this.saleDone = true; this.machine.setFill(0);
      this.money += this.saleBonusAmt; this.stats.earned += this.saleBonusAmt; this.ui.gain(this.saleBonusAmt);
      this.stats.prestige = (this.stats.prestige || 0) + 1; this.stats.lifetimeJar = (this.stats.lifetimeJar || 0) + this.saleCount; this.stats.jar = 0; this.overflowed = false;
      this.fx.ring(JAR.x, 1, JAR.z, [1, 0.85, 0.35], 64, 5); this.fx.sparkle(JAR.x, 2, JAR.z, 120, [1, 0.85, 0.4], 4); this.fx.coinBurst(JAR.x, 2.6, JAR.z, 30);
      audio.ui('fanfare'); audio.coin(null, true);
      this.ui.banner(`★ ${this.stats.prestige} · +${Math.round(this.saleBonusAmt).toLocaleString('fr-FR')} ₣`, 'VENDU !');
      this.saleEnd = t + 3;
    }
    if (this.saleDone && t > this.saleEnd) {
      this.saleDone = false; this.state = 'play'; this.ui.showHud(); this.player.enabled = true; input.wantLock = !isTouch(); input.clear(); if (!isTouch()) input.lock();
      this.say(`Tous tes gains sont maintenant multipliés par ${this.mult().toFixed(2).replace('.', ',')} ! On recommence ?`, 'thumbs', true); this._save();
    }
  }
  _overflow() {
    if (this.state !== 'play') return;
    this.spills = (this.spills || 0) + 1;
    if (!this.overflowed) { this.overflowed = true; this.ui.banner('INCROYABLE', 'LE BOCAL DÉBORDE !'); audio.ui('fanfare'); this.say('overflow', 'cheer'); this.shake(0.3); this.fx.sparkle(JAR.x, JAR.rim + 0.3, JAR.z, 80, [1, 0.85, 0.4], 3.5); this._save(); }
    else if (this.spills % 150 === 0) this.say('overflow', 'cheer');
  }
  _impact(x, y, z, s, kind) {
    const p = { x, y, z };
    if (kind === 'tramp') audio.boing(p, 1.3); else if (kind === 'glass') audio.thud('glass', p, s); else if (kind === 'wood') audio.thud('wood', p, s); else if (kind === 'potato') audio.thud('potato', p, s); else { audio.thud('ground', p, s); if (s > 2.5) this.fx.dust(x, y - 0.05, z, 2); }
  }
  // Gérard speaks (voice babble + bubble + gesture)
  say(key, gesture, raw) {
    const text = raw ? key : pick(Array.isArray(LINES[key]) ? LINES[key] : [String(key)]);
    const head = new THREE.Vector3(); this.shop.npc.head.getWorldPosition(head);
    const dur = audio.speak(text, head);
    this.shop.bubble.show(text, dur);
    if (this.camera.position.distanceTo(head) > 14 || this.ui.shopOpen) this.ui.say(text, dur); // far away: subtitle too
    const gs = gesture || { greet: 'wave', buy: 'thumbs', poor: 'shrug', gold: 'cheer', overflow: 'cheer', idle: 'point' }[key];
    if (gs) this.shop.npc.play(gs, gs === 'wave' ? 2.2 : 1.8);
  }

  // ---------------- states ----------------
  toMenu() {
    this.state = 'menu'; input.wantLock = false; input.unlock(); this.player.enabled = false; this.player.vm.visible = false;
    this.ui.hideHud(); this.ui.closePanel(); this.ui.showMenu(this.hasSave, { jar: this.stats.jar, money: this.money });
    this.menuT = 0; this.attractT = 0;
  }
  menuAction(a) {
    if (a === 'play') this.startPlay();
    else if (a === 'new') this.ui.panel('Nouvelle partie ?', '<div style="text-align:center">Ta progression, ton argent et le bocal seront remis à zéro.</div>', [['Oui, tout recommencer', () => { this.ui.closePanel(); this._newGame(); this.hasSave = false; this.startPlay(); }, true], ['Annuler', () => this.ui.closePanel()]]);
    else if (a === 'book') this.ui.book.open();
    else if (a === 'settings') this.ui.panel('Réglages', this.ui.settingsBody(), [['Retour', () => this.ui.closePanel(), true]]);
    else if (a === 'mp') this.ui.mpPanel({
      host: async o => { const code = await this.coop.host(o); if (code) { this.coop.lastName = o.name; this.ui.closePanel(); net.stopList(); this.startPlay(); setTimeout(() => this.ui.toast(`👥 Session ${code} créée — partage le code !`), 1500); } return code; },
      join: async (code, o) => { const ok = await this.coop.join(code, o); if (ok) { this.ui.closePanel(); net.stopList(); this.startPlay(); } return ok; },
      list: (kind, cb) => { const go = async () => { if (kind === 'online') { try { await this.coop.loadSupabase(); } catch { cb(null, true); return; } } net.listPublic(kind, cb); }; go(); },
      stopList: () => net.stopList(),
    });
    else if (a === 'ach') this.ui.panel('Succès & Patatothèque', this.ach.panelHtml(), [['Retour', () => this.ui.closePanel(), true]]);
    else if (a === 'credits') this.ui.panel('Crédits', this.ui.credits(), [['Retour', () => this.ui.closePanel(), true]]);
  }
  startPlay() {
    audio.init();
    this.ui.fade(true);
    setTimeout(() => {
      // remove demo potatoes thrown in during the menu
      for (const i of this.attract) if (this.dyn.st[i] !== ST.NONE && !this.dyn.paid[i]) this.dyn.free(i);
      this.attract.clear(); this.dyn.recomputeTop();
      this.ui.hideMenu(); this.ui.showHud(); this.state = 'play';
      this.player.enabled = true; this.player.vm.visible = true; input.wantLock = !isTouch(); input.clear();
      this.ui.fade(false);
      if (!isTouch()) input.lock();
      const first = !this.hasSave && this.stats.picked === 0;
      this._save();
      setTimeout(() => {
        if (first) { this.say('Bienvenue ! Ramasse les patates du désert et verse-les dans le bac, au pied du bocal. Le livre du menu explique tout !', 'wave', true); this.ui.toast('🥔 Ramasse des patates dans le désert !'); }
        else this.say('greet', 'wave');
        this.lastGreet = this.t;
      }, 700);
    }, 650);
  }
  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause'; input.wantLock = false; input.unlock(); this.player.enabled = false; this._save();
    this.ui.panel('Pause', `<div style="text-align:center;opacity:.85">🥔 ${this.stats.jar.toLocaleString('fr-FR')} dans le bocal · ${this.stats.picked.toLocaleString('fr-FR')} ramassées · ✨ ${this.stats.gold} dorées</div>`, [
      ['Reprendre', () => this.resume(), true],
      ...(net.active ? [['📋 Copier le lien d’invitation', () => { navigator.clipboard?.writeText(this.coop.inviteLink()).then(() => this.ui.toast('Lien copié !'), () => this.ui.toast(this.coop.inviteLink())); }], ['🚪 Quitter la session', () => { this.ui.closePanel(); this.coop.leave().then(() => { this.state = 'play'; this.pause(); }); }]] : []),
      ['Tutoriel', () => { this.ui.closePanel(); this.ui.book.open(); }],
      ['Succès & Patatothèque', () => this.ui.panel('Succès & Patatothèque', this.ach.panelHtml(), [['Retour', () => { this.state = 'play'; this.pause(); }, true]])],
      ['Réglages', () => this.ui.panel('Réglages', this.ui.settingsBody(), [['Retour', () => { this.state = 'play'; this.pause(); }, true]])],
      ['Menu principal', () => { this._save(); this.ui.fade(true); setTimeout(() => { this.toMenu(); this.ui.fade(false); }, 600); }],
    ]);
  }
  resume() { this.ui.closePanel(); this.state = 'play'; this.player.enabled = true; input.wantLock = !isTouch(); input.clear(); if (!isTouch()) input.lock(); }
  openShop() {
    if (this.ui.shopOpen) return;
    this.player.enabled = false; input.wantLock = false; input.unlock(); input.clear();
    audio.ui('open'); audio.thud('metal', null, 2);
    const line = pick(LINES.greet); this.ui.openShop(line); this.say(line, 'wave', true);
  }
  onOverlayClosed() {
    if (this.state === 'play' && !this.ui.shopOpen && !this.ui.panelOpen) { this.player.enabled = true; input.wantLock = !isTouch(); input.clear(); if (!isTouch()) input.lock(); }
    if (this.state === 'pause') { this.state = 'play'; this.pause(); }
  }

  // ---------------- menu cinematic ----------------
  _menuCamera(dt) {
    this.menuT += dt;
    // slow orbit-and-dolly around the jar + farm, looping smoothly
    // low, slow orbit looking UP at the building-sized jar and its elevator tower (jar framed on the right)
    const t = this.menuT * 0.03, a = -1.75 + Math.sin(t * Math.PI * 2) * 0.8;
    const rad = 36 + Math.sin(t * 4.1) * 5, h = 1.8 + Math.sin(t * 2.3) * 1.2 + 1.2;
    this.camera.position.set(JAR.x + Math.cos(a) * rad, ground(JAR.x + Math.cos(a) * rad, JAR.z + Math.sin(a) * rad) + h, JAR.z + Math.sin(a) * rad);
    this.camera.lookAt(JAR.x, 13 + Math.sin(t * 3) * 2, JAR.z);
    this.camera.rotateY(0.34); this.camera.rotateZ(Math.sin(t * 5) * 0.015);
    if (this.camera.fov !== 50) { this.camera.fov = 50; this.camera.updateProjectionMatrix(); }
    // demo: the farm runs on its own — potatoes fly from the field into the bin
    this.attractT -= dt;
    const jarFull = this.machine.fillRatio(this.dyn) > 1.05;
    if (this.attractT <= 0 && this.dyn.live.length < 300 && !jarFull) {
      this.attractT = 0.22;
      const r = Math.random, sx = BIN.x - 4 + r() * 3, sz = BIN.z - 6 - r() * 4;
      const i = this.dyn.spawnRandom(rng((r() * 1e9) | 0), sx, ground(sx, sz) + 0.1, sz);
      if (i >= 0) {
        this.attract.add(i);
        const tg = new THREE.Vector3(); this.machine.binTarget(r, tg);
        this.dyn.fly(i, tg, 1.0 + r() * 0.3, 2.5 + r(), id => this.dyn.setFree(id, 0, -2, 0));
      }
    }
  }

  // ---------------- frame ----------------
  _frame() {
    const now = performance.now(); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.fps = damp(this.fps, 1 / Math.max(dt, 1e-3), 3, dt);
    this._adaptive(dt);
    this._update(dt);
    this.grade.uniforms.uTime.value = this.t % 100;
    this.composer.render();
  }
  // advance the simulation by `sec` seconds at 60 Hz without rendering (automated tests)
  step(sec) { for (let k = 0; k < Math.round(sec * 60); k++) this._update(1 / 60); }
  _update(dt) {
    this.t += dt;
    input.update(dt);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.5);
    if (this.state === 'menu') this._menuCamera(dt);
    else {
      if (this.state === 'play' && input.pressed('pause')) this.pause();
      this.player.update(dt, this.t);
      if (this.state === 'play') { this.stats.time += dt; this._gerardAI(dt); this.ach.update(dt); }
      if (this.state === 'cine') this._saleCine(dt);
    }
    // clock: 1 in-game hour = 45 s by day, nights pass 3x faster
    const h = this.stats.hour, night = h >= 20.5 || h < 5.5, golden = h >= 15.5 && h < 19.5;
    this.stats.hour = (h + dt / (golden ? 110 : 55) * (night ? 3 : 1)) % 24; this.field.setTime(this.stats.hour); this.night.update(dt); this.coop.update(dt);
    if (this.field.night > 0.5 && Math.random() < dt * 25) { const a = Math.random() * 6.28, r = 3 + Math.random() * 14, c = this.camera.position; const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r; this.fx.glow.emit(x, ground(x, z) + 0.4 + Math.random() * 1.4, z, (Math.random() - 0.5) * 0.3, 0.05, (Math.random() - 0.5) * 0.3, 2.5 + Math.random() * 2, 0.06, 0, -0.02, 0.2, 0.75, 1, 0.35, 1); }
    this.field.followSun(this.camera.position);
    this.field.update(dt, this.camera.position, this.fx);
    this.machine.update(dt, this.dyn, this.t);
    this.dyn.update(dt, { belt: this.machine.belt });
    this.machine.setCount(this.stats.jar);
    this.shop.update(dt, this.camera.position, audio.voiceAmp(), this.t, this.camera);
    this.fx.update(dt);
    audio.setListener(this.camera); audio.setMotor(this.machine.speed, Math.min(1, this.machine.queue / 20));
    if (this.state !== 'menu' && this.state !== 'loading') this.ui.updateHud(dt);
    this.autosave = (this.autosave || 0) + dt; if (this.autosave > 15 && this.state === 'play') { this.autosave = 0; this._save(); }
  }
  _gerardAI() {
    const d = Math.hypot(this.player.pos.x - SHOP.x, this.player.pos.z - SHOP.z);
    if (d < 7 && this.t - this.lastGreet > 75) { this.lastGreet = this.t; this.say('greet', 'wave'); }
    if (this.t > this.nextIdle) { this.nextIdle = this.t + 45 + Math.random() * 50; if (d < 16) this.say('idle', Math.random() < 0.5 ? 'point' : null); }
  }
  _adaptive(dt) {
    if (!settings.v.adaptiveResolution) { if (this.renderScale !== 1) { this.renderScale = 1; this._resize(); } return; }
    if (dt > 1 / 40) { this.slow += dt; this.fast = 0; } else if (dt < 1 / 57) { this.fast += dt; this.slow = Math.max(0, this.slow - dt); }
    if (this.slow > 1.2 && this.renderScale > 0.55) { this.renderScale = Math.max(0.55, this.renderScale - 0.1); this.slow = 0; this._resize(); }
    if (this.fast > 5 && this.renderScale < 1) { this.renderScale = Math.min(1, this.renderScale + 0.05); this.fast = 0; this._resize(); }
  }
}

const game = new Game();
window.__game = game; game.rng = rng; // handy for debugging / automated tests
game.boot().catch(e => { console.error(e); const t = document.querySelector('.ld-text'); if (t) t.textContent = 'Erreur : ' + e.message; });
