/* =====================================================================
   Roblox Forge · Jouer — a running Roblox place (live mode).
   LiveEngine (the place's server + client Luau) + LiveWorld (3D) +
   GuiRenderer (the game's own GUIs), driven like the Roblox client:
   Humanoid movement on the HumanoidRootPart, default R15 animations on
   the Motor6Ds (the game's own poses layer on top), Roblox camera with
   Scriptable cinematics, UserInputService / Mouse / Tool / ProximityPrompt
   input, leaderstats, health, death and respawn.
   ===================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LiveEngine, Vector3, CFrame, enumItem, isA, LuaTable } from '../luau/engine.js?v=12';
import { LiveWorld } from './render3d.js?v=12';
import { GuiRenderer, GUI_CSS } from './gui.js?v=12';
import { Avatar } from '../avatar.js?v=12';
import { preloadClip } from '../luau/anim.js?v=12';
import { imageURL as imageURLOf } from '../assets.js?v=12';
// Roblox's default R15 animations (the clips its Animate script plays)
const DEFAULT_ANIMS = { idle: [507766388, 507766666, 507766951], walk: [507777826], run: [507767714], jump: [507765000], fall: [507767968], toolnone: [507768375], sit: [2506281703] };

const GRAV = 196.2;
const MOTOR = { LowerTorso: 'Root', UpperTorso: 'Waist', Head: 'Neck', LeftUpperArm: 'LeftShoulder', LeftLowerArm: 'LeftElbow', LeftHand: 'LeftWrist', RightUpperArm: 'RightShoulder', RightLowerArm: 'RightElbow', RightHand: 'RightWrist',
  LeftUpperLeg: 'LeftHip', LeftLowerLeg: 'LeftKnee', LeftFoot: 'LeftAnkle', RightUpperLeg: 'RightHip', RightLowerLeg: 'RightKnee', RightFoot: 'RightAnkle' };
const KEYMAP = { ' ': 'Space', Enter: 'Return', Escape: 'Escape', Shift: 'LeftShift', Control: 'LeftControl', Tab: 'Tab', Backspace: 'Backspace', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' };
const keyName = (k) => KEYMAP[k] || (k.length === 1 ? (/[a-z]/i.test(k) ? k.toUpperCase() : { 0: 'Zero', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine' }[k] || 'Unknown') : 'Unknown');
let cssDone = false;

export class LiveGame {
  constructor({ renderer, camera, hud, record, roots, readAttributes, look, quality, onToast, onLeave }) {
    this.renderer = renderer; this.camera = camera; this.hud = hud; this.g = record; this.look = look; this.q = quality; this.toast = onToast; this.leave = onLeave;
    this.engine = new LiveEngine(roots, readAttributes, { look, log: () => {} });
    this.engine.rt.placeKey = String((record && (record.gid || record.cloudId || record.id)) || (record && record.title) || 'place').replace(/[^\w-]/g, '_'); // DataStores are saved per game
    this.P = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: false, input: new THREE.Vector2(), keyIn: new THREE.Vector2(), jump: false, jumpHeld: false, coyote: 0, airT: 0, yaw: Math.PI };
    this.cam = { yaw: Math.PI, pitch: 0.35, zoom: 12.5, dist: 12.5, cur: new THREE.Vector3(), lock: false };
    this.running = false; this.anim = new Avatar(look);
    if (!cssDone) { const st = document.createElement('style'); st.textContent = GUI_CSS + LIVE_CSS; document.head.appendChild(st); cssDone = true; }
  }
  async load(step) {
    const E = this.engine; E.setViewport(innerWidth, innerHeight);
    await step('Démarrage du serveur…', 0.5); await E.start({ onStep: (t) => step(t, 0.8) });
    await step('Construction du monde…', 0.85);
    this.world = new LiveWorld(this.renderer, this.q, E); this.world.build();
    E.raycast = (o, d, p) => this.world.raycast(o, d, p); E.groundAt = (x, y, z, self) => this.world.groundAt(x, y, z, self);
    E.onEmit = (em, n) => this.world.burst(em, n);
    E.worldToScreen = (v, inset = 58) => { const p = new THREE.Vector3(v.x, v.y, v.z).project(this.camera); return [new Vector3((p.x * 0.5 + 0.5) * innerWidth, (-p.y * 0.5 + 0.5) * innerHeight - inset, p.z), p.z < 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1]; };
    E.screenRay = (x, y) => { const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), this.camera); const o = rc.ray.origin, d = rc.ray.direction; return E.rt.G.get('Ray').get('new')([new Vector3(o.x, o.y, o.z), new Vector3(d.x, d.y, d.z)])[0]; };
    E.onPurchase = (info) => this.purchase(info);
    E.onSystemMessage = (t) => this.sys(t); E.onCoreGui = () => this.coreGui(); E.onCharacter = (m) => this.onCharacter(m);
    if (this.q.bloom) { this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(innerWidth * this.renderer.getPixelRatio(), innerHeight * this.renderer.getPixelRatio(), { type: THREE.HalfFloatType, stencilBuffer: true, depthBuffer: true })); /* stencil for Highlight outlines */ this.composer.addPass(new RenderPass(this.world.scene, this.camera)); this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.4, 0.95); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass()); }
    this.gui = new GuiRenderer(E, this.hud, { camera: this.camera, world: this.world });
    this.buildChrome(); this.bindInput(); this.onCharacter(E.char); this.coreGui(); this.resize();
    await step('C’est parti !', 1);
  }
  resize() { const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.composer?.setSize(w, h); this.engine.setViewport(w, h); }
  start() { this.running = true; this.clock = new THREE.Clock(); const loop = () => { if (!this.running) return; this.raf = requestAnimationFrame(loop); this.frame(Math.min(0.1, this.clock.getDelta())); }; loop(); this.sys('Tu joues à ' + this.g.title + '. Ce serveur tourne sur ton appareil.'); }
  dispose() { this.running = false; cancelAnimationFrame(this.raf); this.unbind?.(); this.chrome?.remove(); this.gui?.layer.remove(); this.gui?.bb.remove(); this.world?.scene.traverse((o) => o.geometry?.dispose()); }

  /* ---------------- online: my state for the other players, their chat ---------------- */
  mpState() { const P = this.P; return { pos: P.pos, yaw: P.yaw, speed: Math.hypot(P.vel.x, P.vel.z), grounded: P.grounded, vy: P.vel.y, emote: 0, tool: 0 }; }
  remoteChat(m) { const d = document.createElement('div'); d.innerHTML = `<b style="color:#9fe0a8">${esc(m.name)}:</b> ${esc(m.text)}`; this.$('log').appendChild(d); this.$('log').scrollTop = 1e9; }
  sysMsg(t) { this.sys(t); }
  remoteList(l) { this.others = l.filter((x) => x.id !== this.myId); this.drawLB(); }
  /* ---------------- character ---------------- */
  onCharacter(m) { if (!m) return; this.char = m; const hrp = m.parts.HumanoidRootPart.props.get('CFrame'); this.P.pos.set(hrp.p[0], hrp.p[1] - 3, hrp.p[2]); this.P.vel.set(0, 0, 0); this.lastHRP = null; this.cam.cur.copy(this.P.pos).add(new THREE.Vector3(0, 4.5, 0)); this.dead = false; }
  /* Roblox's default R15 Animate behaviour, with Roblox's own animation clips, played through the character's Animator */
  defaultAnim(dt) {
    const D = (this.dAnim ||= { ready: false, tracks: {}, cur: null, jumpT: 0 }), m = this.char, E = this.engine;
    if (!D.loading) { D.loading = Promise.all(Object.values(DEFAULT_ANIMS).flat().map((id) => preloadClip(id))).then((r) => { D.ready = r.every(Boolean); }); }
    if (!D.ready) return false;
    if (D.rig !== m) { D.rig = m; D.tracks = {}; D.cur = null; const hum = m.humanoid; for (const [k, ids] of Object.entries(DEFAULT_ANIMS)) D.tracks[k] = ids.map((id) => { const a = new E.Instance('Animation', E.rt); a.props.set('Name', k); a.props.set('AnimationId', 'rbxassetid://' + id); return E.anims.load(hum, a); }); }
    const T = D.tracks, play = (name, fade) => { if (D.cur === name) return; for (const [k, ts] of Object.entries(T)) if (k !== 'toolnone' && k !== name && !(name === 'walk' && k === 'run')) for (const t of ts) E.anims.stop(t, fade);
        if (name === 'idle') { const t = T.idle[Math.random() < 0.9 ? 0 : 1 + Math.floor(Math.random() * (T.idle.length - 1))]; E.anims.play(t, fade, 1, 1); } else if (name === 'walk') { E.anims.play(T.walk[0], fade, 1, 1); E.anims.play(T.run[0], fade, 1e-4, 1); } else E.anims.play(T[name][0], fade, 1, 1); D.cur = name; };
    const P = this.P, hv = Math.hypot(P.vel.x, P.vel.z), hum = m.humanoid;
    if (hum.props.get('Sit')) play('sit', 0.2);
    else if (!P.grounded) { if (P.vel.y > 0 && D.cur !== 'fall' && (D.cur !== 'jump' || D.jumpT > 0)) { if (D.cur !== 'jump') D.jumpT = 0.31; play('jump', 0.1); D.jumpT -= dt; } else if (D.jumpT <= 0 || P.vel.y <= 0) play('fall', 0.2); }
    else if (hv > 0.75) { play('walk', 0.2); const run = hv / 16 / Math.max(0.5, (hum.props.get('HipHeight') || 2) / 2); const w = T.walk[0], r = T.run[0];
      if (run < 0.33) { E.anims.play(w, 0.2, 1); E.anims.play(r, 0.2, 1e-4); } else if (run < 0.66) { const k = (run - 0.33) / 0.33; E.anims.play(w, 0.2, 1 - k + 1e-4); E.anims.play(r, 0.2, k + 1e-4); } else { E.anims.play(w, 0.2, 1e-4); E.anims.play(r, 0.2, 1); }
      w.props.set('Speed', run); r.props.set('Speed', run); }
    else play('idle', 0.2);
    // idle variations restart when an idle clip ends its loop
    const tool = m.kids.find((k) => k.cls === 'Tool' && k.child('Handle')); const tn = T.toolnone[0]; if (tool && !tn.track.playing) E.anims.play(tn, 0.1, 1, 1); else if (!tool && tn.track.playing) E.anims.stop(tn, 0.1);
    return true;
  }
  animate(dt) { // the character's default animations: Roblox's own clips (like its Animate script), a procedural stand-in until they load
    const m = this.char; if (!m || this.dead) return;
    if (m.kids.some((k) => k.cls === 'LocalScript' && k.props.get('Name') === 'Animate' && k.source)) return; // the game ships its own Animate script
    if (this.defaultAnim(dt)) return; const A = this.anim, hv = Math.hypot(this.P.vel.x, this.P.vel.z), hum = m.humanoid;
    A.state.speed = this.P.grounded ? hv * (16 / Math.max(8, hum.props.get('WalkSpeed') || 16)) : 0; A.state.grounded = this.P.grounded; A.state.vy = this.P.vel.y; A.state.climbing = false; A.state.tool = !!m.kids.find((k) => k.cls === 'Tool'); A.update(dt);
    for (const [jn, mn] of Object.entries(MOTOR)) { const mot = m.parts[jn] && m.parts[jn].kids.find((k) => k.cls === 'Motor6D' && k.props.get('Name') === mn); const s = A.js[jn]; if (!mot || !s) continue;
      let cf = CFrame.methods ? null : null; void cf; const ang = new THREE.Euler(s.x, s.y, s.z, 'XYZ'), q = new THREE.Matrix4().makeRotationFromEuler(ang).elements;
      const r = [q[0], q[4], q[8], q[1], q[5], q[9], q[2], q[6], q[10]]; const ty = jn === 'LowerTorso' ? (A.js.Hip.hy ?? 2.05) - 2.05 : 0; mot.props.set('Transform', new CFrame([0, ty, 0], r)); }
  }
  move(dt) {
    const m = this.char, E = this.engine; if (!m || !m.parent) return; const hum = m.humanoid, hrp = m.parts.HumanoidRootPart, P = this.P;
    if ((hum.props.get('Health') ?? 100) <= 0) { if (!this.dead) this.die(); return; }
    // sitting in a Seat / VehicleSeat: the SeatWeld carries the character; jumping gets up
    if (hum.props.get('SeatPart')) { const c = hrp.props.get('CFrame'); P.pos.set(c.p[0], c.p[1] - 3, c.p[2]); P.vel.set(0, 0, 0); if (P.jump || P.jumpHeld) { hum.props.set('Jump', true); P.jump = false; } this.lastHRP = c.p.slice(); hum.props.set('MoveDirection', new Vector3()); return; }
    // the server may teleport the character (PivotTo / CFrame): follow it
    const cur = hrp.props.get('CFrame'); if (this.lastHRP && (Math.abs(cur.p[0] - this.lastHRP[0]) > 0.01 || Math.abs(cur.p[1] - this.lastHRP[1]) > 0.01 || Math.abs(cur.p[2] - this.lastHRP[2]) > 0.01)) { P.pos.set(cur.p[0], cur.p[1] - 3, cur.p[2]); P.vel.set(0, 0, 0); const lv = cur.get('LookVector'); P.yaw = Math.atan2(-lv.x, -lv.z); }
    if (hrp.props.get('Anchored')) { this.lastHRP = cur.p.slice(); return; }
    const inp = P.input.lengthSq() > P.keyIn.lengthSq() ? P.input : P.keyIn, C = this.cam; let mv = new THREE.Vector3(-Math.sin(C.yaw), 0, -Math.cos(C.yaw)).multiplyScalar(-inp.y).add(new THREE.Vector3(Math.cos(C.yaw), 0, -Math.sin(C.yaw)).multiplyScalar(inp.x));
    if (hum.moveTo) { const t = hum.moveTo, d = new THREE.Vector3(t.x - P.pos.x, 0, t.z - P.pos.z); if (d.length() < 1.5) { hum.moveTo = null; hum.sig('MoveToFinished').fire([true]); } else if (mv.lengthSq() < 0.01) mv = d.normalize(); }
    if (mv.lengthSq() > 1) mv.normalize(); this.mv = mv; hum.props.set('MoveDirection', new Vector3(mv.x, 0, mv.z));
    const ws = hum.props.get('WalkSpeed') ?? 16, jp = hum.props.get('UseJumpPower') === false ? Math.sqrt(2 * GRAV * (hum.props.get('JumpHeight') || 7.2)) : hum.props.get('JumpPower') ?? 50;
    const solids = this.world.solidNear(P.pos, 14), rc = this.rc || (this.rc = new THREE.Raycaster()), up = new THREE.Vector3(0, 1, 0);
    const a = P.grounded ? 1 : Math.min(1, dt * 12); P.vel.x += (mv.x * ws - P.vel.x) * a; P.vel.z += (mv.z * ws - P.vel.z) * a; P.vel.y -= (E.workspace.props.get('Gravity') || GRAV) * dt;
    P.coyote = P.grounded ? 0.1 : P.coyote - dt; if (hum.props.get('Jump')) { P.jump = true; hum.props.set('Jump', false); }
    if ((P.jump || P.jumpHeld) && P.coyote > 0 && P.vel.y <= 1 && jp > 0) { P.vel.y = jp; P.grounded = false; P.coyote = 0; hum.sig('Jumping').fire([true]); hum.state = 'Jumping'; } P.jump = false;
    const step = new THREE.Vector3(P.vel.x * dt, 0, P.vel.z * dt);
    const blocked = (v) => { if (v.lengthSq() < 1e-10) return false; const dir = v.clone().normalize(); for (const h of [0.6, 2.4, 4.6]) for (const s of [-0.8, 0, 0.8]) { rc.set(P.pos.clone().add(new THREE.Vector3(0, h, 0)).addScaledVector(new THREE.Vector3(-dir.z, 0, dir.x), s), dir); rc.far = v.length() + 1; const hit = rc.intersectObjects(solids, false)[0]; if (hit && (!hit.face || Math.abs(hit.face.normal.clone().transformDirection(hit.object.matrixWorld).dot(up)) < 0.65)) return true; } return false; };
    if (!blocked(step)) P.pos.add(step); else { const sx = new THREE.Vector3(step.x, 0, 0), sz = new THREE.Vector3(0, 0, step.z); if (!blocked(sx)) P.pos.add(sx); else if (!blocked(sz)) P.pos.add(sz); else { P.vel.x = 0; P.vel.z = 0; } }
    if (P.vel.y > 0) { rc.set(P.pos.clone().add(new THREE.Vector3(0, 4.8, 0)), up); rc.far = P.vel.y * dt + 0.5; if (rc.intersectObjects(solids, false)[0]) P.vel.y = 0; }
    const ny = P.pos.y + P.vel.y * dt, was = P.grounded; let best = null;
    for (const [ox, oz] of [[0, 0], [0.7, 0], [-0.7, 0], [0, 0.45], [0, -0.45]]) { rc.set(new THREE.Vector3(P.pos.x + ox, P.pos.y + 2.2, P.pos.z + oz), new THREE.Vector3(0, -1, 0)); rc.far = Math.max(0.1, P.pos.y + 2.2 - ny) + (was ? 0.45 : 0.05); const h = P.vel.y <= 0 ? rc.intersectObjects(solids, false)[0] : null; if (h && (!best || h.point.y > best.point.y)) best = h; }
    if (best) { if (!was && P.airT > 0.3) { this.anim.state.land = Math.min(1, P.airT * 0.9); hum.state = 'Landed'; } P.pos.y = best.point.y; P.vel.y = 0; P.grounded = true; P.airT = 0; const gi = best.object.userData.inst; hum.props.set('FloorMaterial', gi ? gi.props.get('Material') : enumItem('Material', 'Plastic')); if (hum.state !== 'Running') { hum.state = 'Running'; } }
    else { P.pos.y = ny; P.grounded = false; P.airT += dt; hum.props.set('FloorMaterial', enumItem('Material', 'Air')); if (P.vel.y < 0) hum.state = 'Freefall'; }
    if (P.pos.y < (E.workspace.props.get('FallenPartsDestroyHeight') ?? -500)) { hum.$newindex('Health', 0); }
    const hv = Math.hypot(P.vel.x, P.vel.z); if (Math.abs(hv - (this.lastSpeed || 0)) > 0.5) { hum.sig('Running').fire([P.grounded ? hv : 0]); this.lastSpeed = hv; }
    // facing: move direction (or the camera in Shift Lock / first person)
    if (C.lock || C.shown < 1.2) P.yaw = C.yaw; else if (mv.lengthSq() > 0.01 && hum.props.get('AutoRotate') !== false) { const want = Math.atan2(-mv.x, -mv.z); P.yaw += ((((want - P.yaw) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 14); }
    const c = Math.cos(P.yaw), s = Math.sin(P.yaw), hip = (hum.props.get('HipHeight') ?? 2) + 1;
    hrp.props.set('CFrame', new CFrame([P.pos.x, P.pos.y + hip, P.pos.z], [c, 0, s, 0, 1, 0, -s, 0, c])); hrp.props.set('AssemblyLinearVelocity', new Vector3(P.vel.x, P.vel.y, P.vel.z)); this.lastHRP = [P.pos.x, P.pos.y + hip, P.pos.z];
  }
  die() { this.dead = true; const m = this.char; for (const d of m.descendants()) if (d.cls === 'Motor6D') d.props.set('Enabled', false); for (const p of Object.values(m.parts)) { p.props.set('AssemblyLinearVelocity', new Vector3((Math.random() - 0.5) * 20, 10 + Math.random() * 15, (Math.random() - 0.5) * 20)); }
    this.engine.rebuildAssemblies(); this.engine.freeRoots.push(...Object.values(m.parts).filter((p) => p.props.get('Name') !== 'HumanoidRootPart')); this.$('vign').style.opacity = 1; setTimeout(() => (this.$('vign').style.opacity = 0), 4500); }
  /* ---------------- camera ---------------- */
  camera_(dt) {
    const E = this.engine, cam = E.workspace.props.get('CurrentCamera'), C = this.cam, P = this.P, camObj = this.camera;
    const type = cam && cam.props.get('CameraType'); const fov = cam && cam.props.get('FieldOfView'); if (typeof fov === 'number' && Math.abs(camObj.fov - fov) > 0.01) { camObj.fov = fov; camObj.updateProjectionMatrix(); }
    if (type && type.name === 'Scriptable') { const cf = cam.props.get('CFrame'); if (cf) { const m = new THREE.Matrix4().set(cf.r[0], cf.r[1], cf.r[2], cf.p[0], cf.r[3], cf.r[4], cf.r[5], cf.p[1], cf.r[6], cf.r[7], cf.r[8], cf.p[2], 0, 0, 0, 1); m.decompose(camObj.position, camObj.quaternion, new THREE.Vector3()); }
      const lv = new THREE.Vector3(0, 0, -1).applyQuaternion(camObj.quaternion); C.yaw = Math.atan2(-lv.x, -lv.z) + Math.PI; C.pitch = Math.asin(Math.max(-1, Math.min(1, -lv.y))); C.cur.copy(camObj.position).addScaledVector(lv, C.dist); C.shown = C.dist; return; }
    C.dist += (C.zoom - C.dist) * Math.min(1, dt * 12);
    const subj = this.char && this.char.parts.HumanoidRootPart; const head = subj ? new THREE.Vector3(subj.props.get('CFrame').p[0], subj.props.get('CFrame').p[1] + 1.5, subj.props.get('CFrame').p[2]) : P.pos.clone().add(new THREE.Vector3(0, 4.5, 0));
    C.cur.lerp(head, Math.min(1, dt * 22)); const dir = new THREE.Vector3(Math.sin(C.yaw) * Math.cos(C.pitch), Math.sin(C.pitch), Math.cos(C.yaw) * Math.cos(C.pitch)), side = new THREE.Vector3(Math.cos(C.yaw), 0, -Math.sin(C.yaw));
    const pivot = C.cur.clone(); if (C.lock && C.dist > 1) pivot.addScaledVector(side, 1.75);
    let dist = C.dist; const crc = this.crc || (this.crc = new THREE.Raycaster()); crc.set(pivot, dir); crc.far = C.dist; const hit = C.dist > 1 ? crc.intersectObjects(this.world.solidNear(pivot, C.dist + 4).filter((m) => (m.userData.inst.props.get('Transparency') || 0) < 0.5), false)[0] : null;
    if (hit) dist = Math.max(0.5, hit.distance - 0.6); C.shown = C.shown == null ? dist : dist < C.shown ? dist : C.shown + (dist - C.shown) * Math.min(1, dt * 6);
    camObj.position.copy(pivot).addScaledVector(dir, C.shown); camObj.lookAt(pivot);
    if (cam) { const q = camObj.quaternion, m = new THREE.Matrix4().makeRotationFromQuaternion(q).elements; cam.props.set('CFrame', new CFrame([camObj.position.x, camObj.position.y, camObj.position.z], [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]])); cam.props.set('Focus', new CFrame([pivot.x, pivot.y, pivot.z])); }
    // first person: hide the local character
    const fade = Math.max(0, Math.min(1, (C.shown - 0.9) / 2.2)); if (this.char) for (const p of Object.values(this.char.parts)) { const e = this.world.live.get(p); if (e) e.mesh.visible = fade > 0.02 && (p.props.get('Transparency') || 0) < 1; }
  }
  /* ---------------- purchase dialog (test purchase: no Robux is spent, the game gets its receipt) ---------------- */
  purchase(info) {
    return new Promise((res) => {
      const d = document.createElement('div'); d.className = 'lv-buy'; const coin = '<svg viewBox="0 0 24 24"><path fill="#fff" d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/><path fill="#232527" d="M12 6.5l4.76 2.75v5.5L12 17.5l-4.76-2.75v-5.5z"/><rect x="10" y="10" width="4" height="4" fill="#fff"/></svg>';
      const price = info.owned ? 'Déjà possédé' : info.PriceInRobux == null ? 'Prix inconnu' : info.PriceInRobux === 0 ? 'Gratuit' : `${coin}${Number(info.PriceInRobux).toLocaleString('fr')}`;
      const icon = info.IconImageAssetId ? `background-image:url("${imageURLOf(info.IconImageAssetId)}")` : info.kind === 'asset' ? `background-image:url("${imageURLOf(info.id)}")` : '';
      const kind = info.kind === 'pass' ? 'Game Pass' : info.kind === 'product' ? 'Article du jeu' : 'Article';
      d.innerHTML = `<div class="card"><h3>${info.owned ? 'Tu l’as déjà' : 'Acheter un article'}</h3><div class="row"><div class="ic" style='${icon}'></div><div><div class="nm"></div><div style="font-size:12px;color:#b8bcc2;margin-top:2px">${kind}</div><div class="pr">${price}</div></div></div>
        <p class="note">Achat test, comme dans Roblox Studio : aucun Robux n’est dépensé.</p><div class="bt"><button class="no">${info.owned ? 'OK' : 'Annuler'}</button>${info.owned ? '' : '<button class="ok">Acheter</button>'}</div></div>`;
      d.querySelector('.nm').textContent = info.Name; const done = (v) => { d.remove(); res(v); };
      d.querySelector('.no').onclick = () => done(false); const ok = d.querySelector('.ok'); if (ok) ok.onclick = () => done(true); d.addEventListener('pointerdown', (e) => e.stopPropagation()); this.hud.appendChild(d);
    });
  }
  /* ---------------- frame ---------------- */
  frame(dt) {
    const E = this.engine;
    E.frame(dt, { input: () => this.pollInput(), camera: (d) => this.camera_(d), animate: (d) => this.animate(d), character: (d) => this.move(d) });
    this.world.update(dt); this.world.follow(this.P.pos, E.t);
    const post = this.world.post; if (post) { const f = `${post.blur > 0.5 ? `blur(${post.blur.toFixed(1)}px) ` : ''}saturate(${post.sat.toFixed(2)}) contrast(${post.con.toFixed(2)}) brightness(${post.bri.toFixed(2)})`; if (this.renderer.domElement.style.filter !== f) this.renderer.domElement.style.filter = f; }
    if (this.composer) this.composer.render(); else this.renderer.render(this.world.scene, this.camera);
    this.gui.render(innerWidth, innerHeight, 58); this.prompts(dt); if ((this.frameN = (this.frameN || 0) + 1) % 15 === 0) { this.drawLB(); this.drawHealth(); this.hotbar(); }
  }
  /* ---------------- input → UserInputService / Mouse / Tool ---------------- */
  inputObject(type, state, key, pos, delta, wheel = 0) { const E = this.engine, io = new E.Instance('InputObject', E.rt); io.props.set('UserInputType', enumItem('UserInputType', type)); io.props.set('UserInputState', enumItem('UserInputState', state)); io.props.set('KeyCode', enumItem('KeyCode', key || 'Unknown')); io.props.set('Position', new Vector3(pos ? pos[0] : 0, pos ? pos[1] - 58 : 0, wheel)); io.props.set('Delta', new Vector3(delta ? delta[0] : 0, delta ? delta[1] : 0, 0)); return io; }
  uisSig(ev, args) { const s = this.engine.service('UserInputService').sigs.get(ev); if (s && s.conns.length) { const E = this.engine, prev = E.I.side; E.I.side = 'client'; try { s.fire(args); } finally { E.I.side = prev; } } }
  mouseSig(ev, args) { const s = this.engine.mouse.sigs.get(ev); if (s && s.conns.length) { const E = this.engine, prev = E.I.side; E.I.side = 'client'; try { s.fire(args); } finally { E.I.side = prev; } } }
  ioMove(io, state, x, y, dx, dy) { io.props.set('UserInputState', enumItem('UserInputState', state)); io.props.set('Position', new Vector3(x, y - 58, 0)); io.props.set('Delta', new Vector3(dx, dy, 0)); io.changed('Position'); }
  uis(ev, io, processed = false) { const E = this.engine, s = E.service('UserInputService').sigs.get(ev); if (s && s.conns.length) { const prev = E.I.side; E.I.side = 'client'; try { s.fire([io, processed]); } finally { E.I.side = prev; } }
    if (ev === 'InputBegan' && !processed) for (const [, a] of E.actions) { if (a.inputs.some((x) => x && x.name === io.props.get('KeyCode').name || x && x.name === io.props.get('UserInputType').name)) { const prev = E.I.side; E.I.side = 'client'; try { E.rt.spawn(a.f, [undefined, enumItem('UserInputState', 'Begin'), io]); } finally { E.I.side = prev; } } } }
  pollInput() { const E = this.engine; E.input.touch = !!this.touch; const P = this.P, inp = P.input.lengthSq() > P.keyIn.lengthSq() ? P.input : P.keyIn; E.input.move = { x: inp.x, z: inp.y }; }
  activate(x, y) { // click / tap in the world: Mouse.Button1Down + the equipped Tool
    const E = this.engine, hit = this.mouseHit(x, y); E.mouse.props.set('Hit', hit.cf); E.mouse.props.set('Target', hit.inst); E.mouse.props.set('X', x); E.mouse.props.set('Y', y - 58);
    const prev = E.I.side; E.I.side = 'client'; try { if (this.touch) { E.mouse.sig('Button1Down').fire([]); E.mouse.sig('Button1Up').fire([]); } /* with a real mouse they fired on press / release */ const tool = this.char && this.char.kids.find((k) => k.cls === 'Tool'); if (tool) { tool.sig('Activated').fire([]); E.I.side = 'server'; tool.sig('Activated').fire([]); } } finally { E.I.side = prev; }
    // ClickDetectors
    if (hit.inst) { const cd = hit.inst.kids.find((k) => k.cls === 'ClickDetector'); if (cd) { E.I.side = 'server'; cd.sig('MouseClick').fire([E.player]); E.I.side = prev; } } }
  mouseHit(x, y) { const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), this.camera); const r = this.world.raycast(new Vector3(rc.ray.origin.x, rc.ray.origin.y, rc.ray.origin.z), new Vector3(rc.ray.direction.x * 1000, rc.ray.direction.y * 1000, rc.ray.direction.z * 1000), null);
    const p = r ? r.props.get('Position') : new Vector3(rc.ray.origin.x + rc.ray.direction.x * 500, rc.ray.origin.y + rc.ray.direction.y * 500, rc.ray.origin.z + rc.ray.direction.z * 500); return { cf: new CFrame([p.x, p.y, p.z]), inst: r ? r.props.get('Instance') : undefined }; }
  bindInput() {
    const view = this.renderer.domElement.parentNode, P = this.P, C = this.cam, offs = [], ptr = new Map(); let stickId = null, stickC = null, pinch = null; this.touch = matchMedia('(pointer: coarse)').matches;
    const on = (el, ev, f, o) => { el.addEventListener(ev, f, o); offs.push(() => el.removeEventListener(ev, f, o)); };
    on(view, 'pointerdown', (e) => {
      if (e.target.closest('.rx.rxbtn,.rx.rxact,input,button,.lv-menu,.lv-prompt')) return; this.touch = e.pointerType !== 'mouse';
      const inStick = this.touch && e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.45;
      if (inStick && stickId == null) { stickId = e.pointerId; stickC = [e.clientX, e.clientY]; const s = this.$('stick'); s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px'; s.classList.add('on'); return; }
      // like Roblox, one finger / button keeps the same InputObject from Began to Ended (scripts compare them)
      const io = this.inputObject(this.touch ? 'Touch' : e.button === 2 ? 'MouseButton2' : 'MouseButton1', 'Begin', null, [e.clientX, e.clientY]);
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0, b: e.button, io }); try { view.setPointerCapture(e.pointerId); } catch {}
      if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: C.zoom }; }
      this.uis('InputBegan', io);
      if (this.touch) { this.uisSig('TouchStarted', [io, false]); const pid = e.pointerId; clearTimeout(this.longT); this.longT = setTimeout(() => { const q = ptr.get(pid); if (q && q.moved < 10) { q.long = true; this.uisSig('TouchLongPress', [LuaTable.from([new Vector3(q.x, q.y - 58, 0)]), enumItem('UserInputState', 'Begin'), false]); } }, 500); }
      else this.mouseSig('Button' + (e.button === 2 ? 2 : 1) + 'Down', []);
    });
    on(view, 'pointermove', (e) => { this.engine.input.mx = e.clientX; this.engine.input.my = e.clientY;
      if (e.pointerId === stickId) { let dx = e.clientX - stickC[0], dy = e.clientY - stickC[1]; const l = Math.hypot(dx, dy), mx = 52; if (l > mx) { dx *= mx / l; dy *= mx / l; } this.$('knob').style.transform = `translate(${dx}px,${dy}px)`; P.input.set(dx / mx, dy / mx); return; }
      const p = ptr.get(e.pointerId); if (!p) { this.uis('InputChanged', this.inputObject('MouseMovement', 'Change', null, [e.clientX, e.clientY], [e.movementX, e.movementY])); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; p.moved += Math.abs(dx) + Math.abs(dy);
      if (ptr.size === 2 && pinch) { const [a, b] = [...ptr.values()]; C.zoom = Math.max(0.5, Math.min(128, pinch.z * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)))); return; }
      if (this.touch || (e.buttons & 2)) { C.yaw -= dx * 0.0065; C.pitch = Math.max(-1.4, Math.min(1.4, C.pitch + dy * 0.005)); }
      if (this.touch) { this.ioMove(p.io, 'Change', e.clientX, e.clientY, dx, dy); this.uis('InputChanged', p.io); this.uisSig('TouchMoved', [p.io, false]); if (ptr.size === 2 && pinch) { const [a, b] = [...ptr.values()]; this.uisSig('TouchPinch', [LuaTable.from([new Vector3(a.x, a.y - 58, 0), new Vector3(b.x, b.y - 58, 0)]), Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d), 0, enumItem('UserInputState', 'Change'), false]); } }
      else this.uis('InputChanged', this.inputObject('MouseMovement', 'Change', null, [e.clientX, e.clientY], [dx, dy])); });
    const up = (e) => { if (e.pointerId === stickId) { stickId = null; P.input.set(0, 0); this.$('knob').style.transform = ''; this.$('stick').classList.remove('on'); return; }
      const p = ptr.get(e.pointerId); if (!p) return; ptr.delete(e.pointerId); if (ptr.size < 2) pinch = null;
      this.ioMove(p.io, 'End', e.clientX, e.clientY, 0, 0); this.uis('InputEnded', p.io); clearTimeout(this.longT);
      if (this.touch) { this.uisSig('TouchEnded', [p.io, false]); if (p.long) this.uisSig('TouchLongPress', [LuaTable.from([new Vector3(e.clientX, e.clientY - 58, 0)]), enumItem('UserInputState', 'End'), false]);
        const sx = e.clientX - p.sx, sy = e.clientY - p.sy; if (Math.hypot(sx, sy) > 60 && performance.now() - p.t < 500) this.uisSig('TouchSwipe', [enumItem('SwipeDirection', Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? 'Right' : 'Left') : (sy > 0 ? 'Down' : 'Up')), 1, false]); }
      else this.mouseSig('Button' + (p.b === 2 ? 2 : 1) + 'Up', []);
      if (p.moved < 10 && performance.now() - p.t < 400 && p.b !== 2) { this.activate(e.clientX, e.clientY); if (this.touch) { const s = this.engine.service('UserInputService').sigs.get('TouchTap'); if (s) s.fire([LuaTable.from([new Vector3(e.clientX, e.clientY - 58, 0)]), false]); } } };
    on(view, 'pointermove', (e) => { if (e.pointerType === 'mouse') { const E = this.engine; E.mouse.props.set('X', e.clientX); E.mouse.props.set('Y', e.clientY - 58); this.mouseSig('Move', []); } });
    on(view, 'wheel', (e) => { const z = e.deltaY < 0 ? 1 : -1; this.mouseSig(z > 0 ? 'WheelForward' : 'WheelBackward', []); this.uis('InputChanged', this.inputObject('MouseWheel', 'Change', null, [e.clientX, e.clientY], [0, 0], z)); C.zoom = Math.max(0.5, Math.min(128, C.zoom * (z > 0 ? 0.9 : 1.1))); }, { passive: true });
    on(view, 'pointerup', up); on(view, 'pointercancel', up); on(view, 'contextmenu', (e) => e.preventDefault());
    on(view, 'wheel', (e) => { e.preventDefault(); C.zoom = Math.max(0.5, Math.min(128, C.zoom * (e.deltaY > 0 ? 1.25 : 0.8))); this.uis('InputChanged', this.inputObject('MouseWheel', 'Change', null, [e.clientX, e.clientY], [0, -Math.sign(e.deltaY)])); }, { passive: false });
    const jb = this.$('jump'); on(jb, 'pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); P.jumpHeld = true; P.jump = true; jb.classList.add('on'); }); const jup = () => { P.jumpHeld = false; jb.classList.remove('on'); }; on(jb, 'pointerup', jup); on(jb, 'pointercancel', jup);
    const keys = new Set(); const kupd = () => { P.keyIn.set((keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('q') || keys.has('arrowleft') ? 1 : 0), (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('z') || keys.has('arrowup') ? 1 : 0)); };
    on(window, 'keydown', (e) => { if (e.target.closest && e.target.closest('input')) return; const k = e.key.toLowerCase(); if (e.repeat) return;
      if (k === 'escape') { e.preventDefault(); return this.menu(); } if (this.menuOpen) { if (k === 'r') this.reset(); if (k === 'l') this.leave(); return; }
      if (k === ' ') { e.preventDefault(); P.jump = true; P.jumpHeld = true; } if (k === 'i') C.zoom = Math.max(0.5, C.zoom * 0.8); if (k === 'o') C.zoom = Math.min(128, C.zoom * 1.25); if (k === 'shift') { C.lock = !C.lock; }
      keys.add(k); kupd(); const kn = keyName(e.key); this.engine.input.keys.add(kn); this.uis('InputBegan', this.inputObject('Keyboard', 'Begin', kn)); if (this.promptKey(kn)) e.preventDefault(); });
    on(window, 'keyup', (e) => { const k = e.key.toLowerCase(); keys.delete(k); if (k === ' ') P.jumpHeld = false; kupd(); const kn = keyName(e.key); this.engine.input.keys.delete(kn); this.uis('InputEnded', this.inputObject('Keyboard', 'End', kn)); this.promptKeyUp(kn); });
    on(window, 'resize', () => this.resize());
    this.unbind = () => offs.forEach((f) => f());
  }
  /* ---------------- ProximityPrompts (Roblox look: key + action + object) ---------------- */
  prompts(dt) {
    const E = this.engine, me = this.char && this.char.parts.HumanoidRootPart; if (!me) return; const mp = me.props.get('CFrame').p; let best = null, bd = Infinity;
    for (const pr of E.prompts) { if (pr.props.get('Enabled') === false || !pr.parent) continue; const host = pr.parent; const cf = host.props && (host.props.get('CFrame') || (host.cls === 'Attachment' ? host.$index('WorldCFrame') : host.cls === 'Model' ? host.pivot() : null)); if (!cf) continue;
      const d = Math.hypot(cf.p[0] - mp[0], cf.p[1] - mp[1], cf.p[2] - mp[2]); if (d <= (pr.props.get('MaxActivationDistance') ?? 10) && d < bd) { bd = d; best = { pr, cf }; } }
    const el = this.$('prompt'); if (this.curPrompt && (!best || best.pr !== this.curPrompt)) { this.firePrompt(this.curPrompt, 'PromptHidden'); this.curPrompt = null; this.holding = null; }
    if (!best) { el.hidden = true; return; }
    if (this.curPrompt !== best.pr) { this.curPrompt = best.pr; this.firePrompt(best.pr, 'PromptShown'); }
    const P = best.pr.props, key = (P.get('KeyboardKeyCode') && P.get('KeyboardKeyCode').name) || 'E'; const v = new THREE.Vector3(best.cf.p[0], best.cf.p[1] + 1.5, best.cf.p[2]).project(this.camera); if (v.z > 1) { el.hidden = true; return; }
    el.hidden = false; el.style.left = (v.x * 0.5 + 0.5) * innerWidth + 'px'; el.style.top = (-v.y * 0.5 + 0.5) * innerHeight + 'px';
    const html = `<button class="lv-pk">${this.touch ? '' : key}</button><span><small>${esc(P.get('ObjectText') || '')}</small><b>${esc(P.get('ActionText') || 'Interagir')}</b></span>`; if (el.$h !== html) { el.innerHTML = html; el.$h = html; el.querySelector('.lv-pk').onpointerdown = (e) => { e.stopPropagation(); this.startHold(); }; el.querySelector('.lv-pk').onpointerup = () => this.endHold(); }
    if (this.holding) { const hd = P.get('HoldDuration') || 0; this.holding.t += dt; el.style.setProperty('--hold', Math.min(1, this.holding.t / Math.max(0.01, hd))); if (this.holding.t >= hd && !this.holding.done) { this.holding.done = true; this.trigger(best.pr); } } else el.style.setProperty('--hold', 0);
  }
  promptKey(kn) { const pr = this.curPrompt; if (!pr) return false; const key = (pr.props.get('KeyboardKeyCode') && pr.props.get('KeyboardKeyCode').name) || 'E'; if (kn !== key) return false; this.startHold(); return true; }
  promptKeyUp() { this.endHold(); }
  startHold() { if (!this.curPrompt) return; this.holding = { t: 0, done: false }; this.firePrompt(this.curPrompt, 'PromptButtonHoldBegan'); if ((this.curPrompt.props.get('HoldDuration') || 0) <= 0) { this.holding.done = true; this.trigger(this.curPrompt); } }
  endHold() { if (this.holding && this.curPrompt) { this.firePrompt(this.curPrompt, 'PromptButtonHoldEnded'); this.firePrompt(this.curPrompt, 'TriggerEnded'); } this.holding = null; }
  trigger(pr) { this.firePrompt(pr, 'Triggered'); const E = this.engine, svc = E.service('ProximityPromptService'), prev = E.I.side; try { E.I.side = 'client'; svc.sig('PromptTriggered').fire([pr, E.player]); E.I.side = 'server'; svc.sig('PromptTriggered').fire([pr, E.player]); } finally { E.I.side = prev; } }
  firePrompt(pr, ev) { const E = this.engine, prev = E.I.side; try { E.I.side = 'server'; pr.sig(ev).fire([E.player]); E.I.side = 'client'; pr.sig(ev).fire([E.player]); } finally { E.I.side = prev; } }
  /* ---------------- Roblox chrome: topbar, player list, health, chat, menu, touch controls ---------------- */
  $(id) { return this.chrome.querySelector('#lv-' + id); }
  buildChrome() {
    const c = document.createElement('div'); c.className = 'lv'; this.chrome = c;
    c.innerHTML = `<div class="lv-top"><div class="lv-pill"><button id="lv-menu" aria-label="Menu"><svg viewBox="0 0 24 24"><rect x="4.6" y="4.6" width="14.8" height="14.8" rx="2.4" fill="none" stroke="#fff" stroke-width="2.6" transform="rotate(14 12 12)"/><rect x="10.2" y="10.2" width="3.6" height="3.6" fill="#fff" transform="rotate(14 12 12)"/></svg></button></div>
      <div class="lv-pill"><button id="lv-chatb" aria-label="Discussion"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1" stroke-linejoin="round"><path d="M4 5.5h16v10H10l-4.5 3.5V15.5H4z"/></svg></button><button id="lv-lbb" aria-label="Joueurs"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><path d="M15.5 6.2a3 3 0 010 5.6M17.5 14.4c1.6.7 2.7 2.3 3 4.6"/></svg></button></div></div>
      <div class="lv-lb" id="lv-lb"></div><div class="lv-hp" id="lv-hp" hidden><i></i></div>
      <div class="lv-chat" id="lv-chat" hidden><div class="lv-log" id="lv-log"></div><form id="lv-cf"><input id="lv-ci" maxlength="200" placeholder="Pour discuter, appuie ici ou sur « / »" autocomplete="off"></form></div>
      <div class="lv-hotbar" id="lv-hotbar"></div><div class="lv-prompt" id="lv-prompt" hidden></div>
      <div class="lv-stick" id="lv-stick"><i id="lv-knob"></i></div><button class="lv-jump" id="lv-jump" aria-label="Sauter"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 14.5L12 8l6.5 6.5"/></svg></button>
      <div class="lv-vign" id="lv-vign"></div>`;
    this.hud.appendChild(c);
    this.$('menu').onclick = () => this.menu(); this.$('chatb').onclick = () => { this.$('chat').hidden = !this.$('chat').hidden; }; this.$('lbb').onclick = () => this.$('lb').classList.toggle('min');
    if (matchMedia('(pointer: coarse)').matches) this.$('lb').classList.add('min');
    this.$('cf').onsubmit = (e) => { e.preventDefault(); const t = this.$('ci').value.trim(); this.$('ci').value = ''; if (t) this.say(t); };
    this.$('ci').onkeydown = (e) => e.stopPropagation(); this.$('ci').onpointerdown = (e) => e.stopPropagation();
  }
  coreGui() { const cg = this.engine.coreGui; this.$('chatb').parentNode.style.display = cg.Chat === false && cg.PlayerList === false ? 'none' : ''; this.$('lb').style.display = cg.PlayerList === false ? 'none' : ''; this.$('lbb').style.display = cg.PlayerList === false ? 'none' : ''; this.$('hotbar').style.display = cg.Backpack === false ? 'none' : ''; this.$('chatb').style.display = cg.Chat === false ? 'none' : ''; }
  drawLB() { const E = this.engine, P = E.player, ls = P && P.child('leaderstats'); const cols = ls ? ls.kids.filter((k) => /Value$/.test(k.cls)) : [];
    const html = `<table><tr><th>Joueurs</th>${cols.map((c) => `<th>${esc(c.props.get('Name'))}</th>`).join('')}</tr><tr class="you"><td>${esc(P ? P.props.get('DisplayName') : '')}</td>${cols.map((c) => `<td>${esc(fmtStat(c.props.get('Value')))}</td>`).join('')}</tr>${(this.others || []).map((o) => `<tr><td>${esc(o.username)}</td>${cols.map(() => '<td>—</td>').join('')}</tr>`).join('')}</table>`; if (this.$('lb').$h !== html) { this.$('lb').innerHTML = html; this.$('lb').$h = html; } }
  drawHealth() { const h = this.char && this.char.humanoid; if (!h) return; const k = Math.max(0, (h.props.get('Health') ?? 100) / (h.props.get('MaxHealth') || 100)); const el = this.$('hp'); el.hidden = k >= 1 || this.engine.coreGui.Health === false; el.firstElementChild.style.width = k * 100 + '%'; el.firstElementChild.style.background = k > 0.5 ? '#2ad16b' : k > 0.25 ? '#ffb02e' : '#ff3b3b'; }
  hotbar() { if (this.engine.coreGui.Backpack === false) return; const E = this.engine, bp = E.player && E.player.child('Backpack'); const held = this.char && this.char.kids.find((k) => k.cls === 'Tool'); const tools = [...(held ? [held] : []), ...(bp ? bp.kids.filter((k) => k.cls === 'Tool') : [])];
    const html = tools.map((t, i) => `<button class="lv-slot${t === held ? ' on' : ''}" data-i="${i}"><i>${i + 1}</i><span>${esc(t.props.get('Name'))}</span></button>`).join(''); const el = this.$('hotbar'); if (el.$h === html) return; el.$h = html; el.innerHTML = html;
    el.querySelectorAll('[data-i]').forEach((b) => (b.onpointerdown = (e) => { e.stopPropagation(); const t = tools[+b.dataset.i]; t.setParent(t === held ? bp : this.char); })); }
  sys(t) { const d = document.createElement('div'); d.innerHTML = `<b style="color:#ffd45c">[Système]</b> ${esc(t)}`; this.$('log').appendChild(d); this.$('log').scrollTop = 1e9; }
  say(t) { const d = document.createElement('div'); d.innerHTML = `<b style="color:#7fb2ff">${esc(this.look.name)}:</b> ${esc(t)}`; this.$('log').appendChild(d); this.$('log').scrollTop = 1e9; this.mp?.chat(t); const E = this.engine, prev = E.I.side; E.I.side = 'server'; E.player.sig('Chatted').fire([t]); E.I.side = prev; }
  reset() { const h = this.char && this.char.humanoid; if (h) h.$newindex('Health', 0); this.closeMenu(); }
  menu() { if (this.menuOpen) return this.closeMenu(); this.menuOpen = true; const m = document.createElement('div'); m.className = 'lv-menu'; m.innerHTML = `<div class="lv-mbox"><h3>${esc(this.g.title)}</h3><p>Serveur sur ton appareil · ${this.engine.rt.errors.length} erreur(s) de script</p>
    <div class="lv-macts"><button class="res" id="lv-reset">Réinitialiser<small>R</small></button><button class="quit" id="lv-quit">Quitter<small>L</small></button><button id="lv-back">Reprendre<small>Échap</small></button></div>${this.engine.rt.errors.length ? `<details><summary>Erreurs de script</summary><pre>${esc(this.engine.rt.errors.slice(-8).join('\n'))}</pre></details>` : ''}</div>`;
    this.chrome.appendChild(m); m.querySelector('#lv-reset').onclick = () => this.reset(); m.querySelector('#lv-quit').onclick = () => this.leave(); m.querySelector('#lv-back').onclick = () => this.closeMenu(); this.menuEl = m;
    const gs = this.engine.service('GuiService'); gs.props.set('MenuIsOpen', true); gs.sig('MenuOpened').fire([]); }
  closeMenu() { this.menuOpen = false; this.menuEl?.remove(); const gs = this.engine.service('GuiService'); gs.props.set('MenuIsOpen', false); gs.sig('MenuClosed').fire([]); }
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtStat = (v) => (typeof v === 'number' ? (Math.abs(v) >= 1e3 ? Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v) : String(Math.floor(v * 100) / 100)) : String(v ?? ''));
const LIVE_CSS = `
.lv{position:absolute;inset:0;pointer-events:none;z-index:3;font-family:"F-Mont",system-ui,sans-serif}
.lv>*{pointer-events:auto}
.lv-top{position:absolute;top:calc(env(safe-area-inset-top) + 8px);left:max(10px,env(safe-area-inset-left));display:flex;gap:8px}
.lv-pill{display:flex;gap:2px;padding:3px;border-radius:14px;background:rgba(18,18,21,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.lv-pill button{width:40px;height:40px;border:0;border-radius:11px;background:none;display:grid;place-items:center;cursor:pointer}.lv-pill button:active{background:rgba(255,255,255,.16)}.lv-pill svg{width:24px;height:24px}
.lv-lb{position:absolute;top:calc(env(safe-area-inset-top) + 8px);right:max(10px,env(safe-area-inset-right));border-radius:10px;overflow:hidden;background:rgba(18,18,21,.62);font-size:13px;color:#fff;transition:transform .3s,opacity .3s;max-width:calc(100vw - 200px)}
.lv-lb.min{transform:translateX(calc(100% + 20px));opacity:0}
.lv-lb table{border-collapse:collapse}.lv-lb th{font-size:11px;color:#cfd0d6;padding:6px 10px;text-align:right;background:rgba(0,0,0,.25);font-weight:700}.lv-lb th:first-child,.lv-lb td:first-child{text-align:left}.lv-lb td{padding:7px 10px;text-align:right;font-weight:700;white-space:nowrap}.lv-lb tr.you td{background:rgba(255,255,255,.07)}
.lv-hp{position:absolute;top:calc(env(safe-area-inset-top) + 58px);right:max(10px,env(safe-area-inset-right));width:min(42vw,200px);height:10px;border-radius:5px;background:rgba(0,0,0,.55);overflow:hidden}.lv-hp i{display:block;height:100%;transition:width .25s}
.lv-chat{position:absolute;left:max(10px,env(safe-area-inset-left));top:calc(env(safe-area-inset-top) + 60px);width:min(82vw,360px);border-radius:10px;background:rgba(18,18,21,.55);color:#fff;font-size:14px}
.lv-log{max-height:150px;overflow-y:auto;padding:8px 10px;text-shadow:0 1px 2px #000}.lv-chat input{width:calc(100% - 12px);margin:6px;height:36px;border:0;border-radius:8px;background:rgba(255,255,255,.12);color:#fff;padding:0 10px;font-size:16px}
.lv-hotbar{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 14px);translate:-50% 0;display:flex;gap:6px}
.lv-slot{width:60px;height:60px;border:0;border-radius:10px;background:rgba(18,18,21,.55);box-shadow:0 0 0 2px rgba(255,255,255,.12) inset;position:relative;color:#fff;font:700 10px "F-Mont",system-ui;cursor:pointer}.lv-slot.on{box-shadow:0 0 0 3px #fff inset}.lv-slot i{position:absolute;left:6px;top:3px;font-style:normal}.lv-slot span{position:absolute;inset:auto 2px 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lv-prompt{position:absolute;translate:-50% -100%;display:flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:10px;background:rgba(18,18,21,.7);color:#fff;pointer-events:auto}
.lv-pk{width:42px;height:42px;border-radius:50%;border:0;background:conic-gradient(#fff calc(var(--hold,0)*360deg),rgba(255,255,255,.25) 0);color:#111;font:800 18px "F-Mont",system-ui;cursor:pointer;box-shadow:0 0 0 3px rgba(18,18,21,.7) inset}
.lv-prompt span{display:flex;flex-direction:column}.lv-prompt small{font-size:11px;color:#ccc}.lv-prompt b{font-size:15px}
.lv-stick{position:absolute;left:96px;top:calc(100% - 128px);width:128px;height:128px;margin:-64px 0 0 -64px;border-radius:50%;background:radial-gradient(circle,rgba(0,0,0,.18),rgba(0,0,0,.32));box-shadow:0 0 0 2px rgba(255,255,255,.35) inset;pointer-events:none;opacity:.55}.lv-stick.on{opacity:1}
.lv-stick i{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px;border-radius:50%;background:rgba(255,255,255,.55)}
.lv-jump{position:absolute;right:calc(max(18px,env(safe-area-inset-right)) + 12px);bottom:calc(env(safe-area-inset-bottom) + 34px);width:84px;height:84px;border-radius:50%;border:0;background:rgba(0,0,0,.28);box-shadow:0 0 0 2px rgba(255,255,255,.45) inset;display:grid;place-items:center}.lv-jump svg{width:40px;height:40px}.lv-jump.on{transform:scale(.9)}
@media (pointer:fine){.lv-stick,.lv-jump{display:none}}
.lv-vign{position:absolute;inset:0;pointer-events:none!important;background:radial-gradient(ellipse at center,transparent 55%,rgba(150,0,0,.55));opacity:0;transition:opacity .4s}
.lv-buy{position:absolute;inset:0;z-index:40;display:grid;place-items:center;background:rgba(0,0,0,.45);pointer-events:auto;animation:lvfade .18s ease}
.lv-buy .card{width:min(88vw,340px);border-radius:14px;background:#232527;color:#fff;padding:18px 18px 14px;box-shadow:0 18px 50px rgba(0,0,0,.5);font-family:system-ui,sans-serif;animation:lvpop .26s cubic-bezier(.2,1.4,.4,1)}
.lv-buy h3{margin:0 0 12px;font-size:17px;font-weight:700}.lv-buy .row{display:flex;gap:12px;align-items:center}
.lv-buy .ic{width:74px;height:74px;border-radius:10px;background:#393b3d center/cover no-repeat;flex:none}.lv-buy .nm{font-weight:700;font-size:15px;line-height:1.25}
.lv-buy .pr{display:flex;align-items:center;gap:5px;margin-top:6px;font-weight:800;font-size:15px}.lv-buy .pr svg{width:16px;height:16px}
.lv-buy .note{margin:12px 0 0;font-size:12px;color:#b8bcc2}.lv-buy .bt{display:flex;gap:10px;margin-top:14px}
.lv-buy button{flex:1;height:42px;border:0;border-radius:9px;font-weight:800;font-size:15px;color:#fff;background:#393b3d;cursor:pointer}.lv-buy button.ok{background:#335fff}.lv-buy button:active{transform:scale(.97)}
@keyframes lvfade{from{opacity:0}}@keyframes lvpop{from{transform:scale(.86);opacity:0}}
.lv-menu{position:absolute;inset:0;z-index:30;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:grid;place-items:center;color:#fff}
.lv-mbox{width:min(92vw,460px);text-align:center}.lv-mbox h3{margin:0 0 4px;font-size:22px}.lv-mbox p{color:#bbb;font-size:13px}
.lv-macts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.lv-macts button{height:56px;border:0;border-radius:12px;background:rgba(255,255,255,.14);color:#fff;font:800 13px "F-Mont",system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer}.lv-macts small{font-size:10.5px;color:#bbb}.lv-macts .res{background:#fff;color:#111}.lv-macts .quit{background:#e5484d}
.lv-mbox details{margin-top:12px;text-align:left}.lv-mbox pre{white-space:pre-wrap;font-size:11px;max-height:200px;overflow:auto;background:rgba(0,0,0,.4);padding:8px;border-radius:8px}
`;
