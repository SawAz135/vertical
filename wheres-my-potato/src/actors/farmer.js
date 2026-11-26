import * as THREE from 'three';
import { makeBucket } from '../world/shop.js';
import { makeVacuum, makeCannon } from '../player/gadgets.js';
import { damp, dampAngle, clamp } from '../core/util.js';

// =====================================================================================
// FARMER — the other players, seen in third person: procedural jointed body tinted with
// their colour, walk / run cycle with arm swing, head pitch from their camera, the tool
// they hold, a floating name tag and a carried-count badge. Smoothly interpolated.
// =====================================================================================
function label(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.font = '700 54px Fred, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(500, g.measureText(text).width + 60);
  g.fillStyle = 'rgba(20,12,5,0.72)'; g.beginPath(); g.roundRect(256 - w / 2, 18, w, 84, 42); g.fill();
  g.fillStyle = color; g.beginPath(); g.arc(256 - w / 2 + 40, 60, 14, 0, 7); g.fill();
  g.fillStyle = '#fff4dc'; g.fillText(text, 256 + 14, 62);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(1.6, 0.4, 1); s.renderOrder = 30; return s;
}
const cap = (r, l, m) => { const x = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 10), m); x.castShadow = true; return x; };
const J = (p, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };

export class Farmer {
  constructor(scene, M, name, color) {
    this.scene = scene; this.M = M;
    const shirt = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(1.15), roughness: 0.75 });
    const jeans = M.denim, skin = new THREE.MeshStandardMaterial({ color: 0xc98d68, roughness: 0.6 }), boot = M.leather;
    const hatM = new THREE.MeshStandardMaterial({ color: 0xe2c27a, roughness: 0.9 });
    const root = this.root = new THREE.Group(); scene.add(root);
    const hips = this.hips = J(root, 0, 0.95, 0);
    const torso = cap(0.17, 0.32, shirt); torso.scale.z = 0.75; torso.position.y = 0.28; hips.add(torso);
    this.chest = J(hips, 0, 0.5, 0);
    const head = this.head = J(this.chest, 0, 0.16, 0);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), skin); skull.scale.y = 1.1; skull.castShadow = true; head.add(skull);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), skin); nose.position.set(0, -0.01, 0.105); head.add(nose);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshStandardMaterial({ color: 0x111111 })); e.position.set(sx * 0.04, 0.025, 0.095); head.add(e); }
    // straw hat
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.02, 24), hatM); brim.position.y = 0.09; head.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.1, 20), hatM); crown.position.y = 0.14; head.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.122, 0.03, 20), shirt); band.position.y = 0.11; head.add(band);
    this.arms = [-1, 1].map(sx => {
      const sh = J(this.chest, sx * 0.22, -0.02, 0); const u = cap(0.05, 0.22, shirt); u.position.y = -0.14; sh.add(u);
      const el = J(sh, 0, -0.3, 0); const f = cap(0.042, 0.2, skin); f.position.y = -0.12; el.add(f);
      const hand = J(el, 0, -0.27, 0); const hm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin); hm.scale.set(0.9, 1.1, 0.6); hand.add(hm);
      return { sh, el, hand, sx };
    });
    this.legs = [-1, 1].map(sx => {
      const hp = J(hips, sx * 0.1, 0, 0); const t = cap(0.075, 0.3, jeans); t.position.y = -0.22; hp.add(t);
      const kn = J(hp, 0, -0.45, 0); const s = cap(0.062, 0.3, jeans); s.position.y = -0.2; kn.add(s);
      const an = J(kn, 0, -0.44, 0); const b = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.25), boot); b.position.set(0, -0.03, 0.05); b.castShadow = true; an.add(b);
      return { hp, kn, an, sx };
    });
    this.tag = label(name, color); scene.add(this.tag);
    this.badge = null; this.tool = null; this.toolName = '';
    this.pos = new THREE.Vector3(); this.to = new THREE.Vector3(); this.yaw = 0; this.toYaw = 0; this.pitch = 0; this.phase = 0; this.speed = 0; this.last = performance.now();
  }
  setState(s) {
    this.to.set(s.p[0], s.p[1], s.p[2]); this.toYaw = s.y; this.toPitch = s.pi || 0; this.speedNet = s.v || 0; this.last = performance.now();
    if (s.t !== this.toolName) this._setTool(s.t);
    if (s.c !== this.count) { this.count = s.c; this._badge(); }
    if (!this.init) { this.pos.copy(this.to); this.yaw = this.toYaw; this.init = true; }
  }
  _setTool(t) {
    this.toolName = t; if (this.tool) this.arms[1].hand.remove(this.tool); this.tool = null;
    if (t === 'bucket') { this.tool = makeBucket(this.M, 2); this.tool.position.y = -0.36; }
    else if (t === 'vacuum') { this.tool = makeVacuum(this.M); this.tool.scale.setScalar(1.4); this.tool.rotation.x = Math.PI / 2; this.tool.position.set(0, -0.05, 0.1); }
    else if (t === 'cannon') { this.tool = makeCannon(this.M); this.tool.scale.setScalar(1.4); this.tool.rotation.x = Math.PI / 2; this.tool.position.set(0, -0.05, 0.1); }
    if (this.tool) { this.tool.traverse(o => (o.castShadow = true)); this.arms[1].hand.add(this.tool); }
  }
  _badge() {
    if (this.badge) { this.scene.remove(this.badge); this.badge.material.map.dispose(); this.badge = null; }
    if (!this.count) return;
    this.badge = label(`🥔 ${this.count}`, '#ffc83a'); this.badge.scale.set(1.0, 0.25, 1); this.scene.add(this.badge);
  }
  update(dt) {
    this.pos.lerp(this.to, Math.min(1, dt * 10)); this.yaw = dampAngle(this.yaw, this.toYaw, 10, dt); this.pitch = damp(this.pitch, this.toPitch || 0, 8, dt);
    const sp = damp(this.speed, this.speedNet || 0, 8, dt); this.speed = sp;
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw + Math.PI;
    // walk / run cycle
    this.phase += dt * clamp(sp, 0, 8) * 2.2;
    const a = Math.sin(this.phase) * clamp(sp / 4, 0, 1.2) * 0.6, run = sp > 5 ? 1 : 0;
    this.legs[0].hp.rotation.x = a; this.legs[1].hp.rotation.x = -a;
    this.legs[0].kn.rotation.x = Math.max(0, -a) * 1.3 + run * 0.2; this.legs[1].kn.rotation.x = Math.max(0, a) * 1.3 + run * 0.2;
    this.hips.position.y = 0.95 + Math.abs(Math.cos(this.phase)) * 0.04 * clamp(sp / 4, 0, 1);
    this.chest.rotation.x = 0.05 + run * 0.18; this.chest.rotation.y = Math.sin(this.phase) * 0.08 * clamp(sp / 4, 0, 1);
    this.head.rotation.x = clamp(-this.pitch, -0.7, 0.7) * 0.8;
    const [L, R] = this.arms;
    L.sh.rotation.set(-a * 0.8, 0, -0.12); L.el.rotation.x = -0.3 - run * 0.6;
    if (this.tool) { R.sh.rotation.set(this.toolName === 'bucket' ? 0.1 : -1.1 - this.pitch * 0.8, 0, 0.12); R.el.rotation.x = this.toolName === 'bucket' ? -0.1 : -0.4; if (this.toolName !== 'bucket') { L.sh.rotation.set(-1.0 - this.pitch * 0.8, 0, 0.5); L.el.rotation.x = -0.9; } }
    else { R.sh.rotation.set(a * 0.8, 0, 0.12); R.el.rotation.x = -0.3 - run * 0.6; }
    this.tag.position.set(this.pos.x, this.pos.y + 2.25, this.pos.z);
    if (this.badge) this.badge.position.set(this.pos.x, this.pos.y + 2.0, this.pos.z);
  }
  dispose() { this.scene.remove(this.root, this.tag); if (this.badge) this.scene.remove(this.badge); }
}
