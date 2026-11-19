/* =====================================================================
   Roblox Forge · Jouer — other players in your server.
   Each player broadcasts its avatar state ~10 times a second (position,
   facing, speed, grounded, vertical speed, emote, held tool). Here every
   remote player is an animated R15 avatar with its own look, smoothly
   interpolated, with a name tag and chat bubbles.
   ===================================================================== */
import * as THREE from 'three';
import { Avatar } from '../avatar.js?v=8';
import { online } from './online.js?v=8';

function tag(name) { const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d'); g.font = '700 46px "F-Mont",system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(name, 256, 50); g.fillStyle = '#fff'; g.fillText(name, 256, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(6, 1.1, 1); s.renderOrder = 6; return s; }
function bubble(text) { const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = '600 38px "F-Mont",system-ui,sans-serif'; const w = Math.min(600, g.measureText(text).width + 50); c.width = 640; c.height = 110; g.font = '600 38px "F-Mont",system-ui,sans-serif';
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect((640 - w) / 2, 6, w, 76, 26); g.fill(); g.beginPath(); g.moveTo(300, 80); g.lineTo(320, 104); g.lineTo(340, 80); g.fill(); g.fillStyle = '#1b1b1f'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text.slice(0, 40), 320, 46);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(9.6, 1.65, 1); s.renderOrder = 10; return s; }

export class RemotePlayers {
  constructor(scene, { onChat, onList } = {}) { this.scene = scene; this.players = new Map(); this.onChat = onChat; this.onList = onList; this.sendT = 0; }
  async join(gameId, title, serverId) {
    if (!online.user) return null;
    this.sid = await online.joinServer(gameId, title, serverId, {
      state: (s) => this.state(s), chat: (m) => { const p = this.players.get(m.from); if (p) this.say(p, m.text); this.onChat?.(m); },
      players: (list) => { this.list = list; this.onList?.(list); for (const id of [...this.players.keys()]) if (!list.some((x) => x.id === id)) this.drop(id); },
      left: (id) => this.drop(id),
    });
    return this.sid;
  }
  state(s) {
    let p = this.players.get(s.from);
    if (!p) { const av = new Avatar(s.look || {}); this.scene.add(av.root); const t = tag(s.name || 'Joueur'); this.scene.add(t); p = { av, tag: t, pos: new THREE.Vector3(...s.p), to: new THREE.Vector3(...s.p), yaw: s.y || 0, toYaw: s.y || 0, bubbles: [] }; this.players.set(s.from, p); }
    p.to.set(...s.p); p.toYaw = s.y || 0; p.speed = s.v || 0; p.grounded = s.g !== 0; p.vy = s.vy || 0; p.last = performance.now(); if (s.e && s.e !== p.emote) { p.emote = s.e; p.av.emote(s.e); }
    if (!!s.tool !== !!p.tool) { p.tool = s.tool; p.av.state.tool = !!s.tool; p.av.holdTool(s.tool ? { kind: s.tool } : null); }
  }
  say(p, text) { const b = bubble(text); this.scene.add(b); p.bubbles.push({ s: b, t: 0 }); if (p.bubbles.length > 2) { const o = p.bubbles.shift(); this.scene.remove(o.s); } }
  drop(id) { const p = this.players.get(id); if (!p) return; this.scene.remove(p.av.root); this.scene.remove(p.tag); p.bubbles.forEach((b) => this.scene.remove(b.s)); p.av.dispose(); this.players.delete(id); }
  /* send my own state (10 Hz) and animate everyone */
  update(dt, me) {
    if (me && online.server) { this.sendT -= dt; if (this.sendT <= 0) { this.sendT = 0.1; online.send('st', { name: online.profile?.username, look: online.profile?.look, p: [+me.pos.x.toFixed(2), +me.pos.y.toFixed(2), +me.pos.z.toFixed(2)], y: +me.yaw.toFixed(3), v: +me.speed.toFixed(1), g: me.grounded ? 1 : 0, vy: +me.vy.toFixed(1), e: me.emote || 0, tool: me.tool || 0 }); } }
    for (const [id, p] of this.players) {
      if (performance.now() - p.last > 8000) { this.drop(id); continue; }
      p.pos.lerp(p.to, Math.min(1, dt * 10)); let d = p.toYaw - p.yaw; d = ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI; p.yaw += d * Math.min(1, dt * 10);
      p.av.root.position.copy(p.pos); p.av.root.rotation.y = p.yaw; p.av.state.speed = p.grounded ? p.speed : 0; p.av.state.grounded = p.grounded; p.av.state.vy = p.vy; p.av.update(dt);
      p.tag.position.copy(p.pos).add(new THREE.Vector3(0, 6.3, 0));
      let lift = 0; for (const b of [...p.bubbles].reverse()) { b.t += dt; b.s.position.copy(p.pos).add(new THREE.Vector3(0, 7.4 + lift, 0)); lift += 1.8; if (b.t > 9) { this.scene.remove(b.s); p.bubbles.splice(p.bubbles.indexOf(b), 1); } }
    }
  }
  chat(text) { online.send('chat', { name: online.profile?.username, text: String(text).slice(0, 200) }); }
  count() { return this.players.size + 1; }
  async leave() { for (const id of [...this.players.keys()]) this.drop(id); await online.leaveServer(); }
}
