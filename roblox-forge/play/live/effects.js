/* =====================================================================
   Roblox Forge · Jouer — classic Roblox effects.
   - Fire: flames rising from the part (Size, Heat, Color, SecondaryColor);
   - Smoke: soft puffs (Color, Opacity, RiseVelocity, Size);
   - Sparkles: twinkling stars (SparkleColor);
   - ForceField: the shimmering bubble around a character (Visible);
   - Explosion: blast flash, fireball, shock ring and debris for 0.8 s
     (the blast itself — Hit, broken joints, push — is in luau/explosions.js).
   Particle counts are capped for phones.
   ===================================================================== */
import * as THREE from 'three';
import { Color3 } from '../luau/engine.js?v=11';

const dot = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); t = new THREE.CanvasTexture(c); return t; }; })();
const star = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.translate(32, 32); g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(0, -30); g.lineTo(4, 0); g.lineTo(0, 30); g.lineTo(-4, 0); g.fill(); } t = new THREE.CanvasTexture(c); return t; }; })();
const c3 = (c, d) => (c instanceof Color3 ? new THREE.Color(c.r, c.g, c.b) : new THREE.Color(d));
const MAX = 90;
function cloud(additive, tex) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3)); g.setDrawRange(0, 0);
  const m = new THREE.PointsMaterial({ map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, size: 1, sizeAttenuation: true }); const p = new THREE.Points(g, m); p.frustumCulled = false; return p; }
export class Effects {
  constructor(world, engine) { this.W = world; this.E = engine; this.items = new Map(); this.blasts = []; this.group = new THREE.Group(); world.scene.add(this.group); }
  scan() { const seen = new Set(); for (const d of this.E.workspace.descendants()) if ((d.cls === 'Fire' || d.cls === 'Smoke' || d.cls === 'Sparkles' || d.cls === 'ForceField') && d.parent) seen.add(d);
    for (const [o, it] of this.items) if (!seen.has(o)) { this.group.remove(it.obj); it.obj.geometry.dispose(); it.obj.material.dispose(); this.items.delete(o); }
    for (const o of seen) if (!this.items.has(o)) { const obj = o.cls === 'ForceField' ? new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshBasicMaterial({ color: '#7fd0ff', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })) : cloud(o.cls !== 'Smoke', o.cls === 'Sparkles' ? star() : dot());
      this.group.add(obj); this.items.set(o, { o, obj, ps: [], acc: 0 }); } }
  anchor(o) { // world position and size of what the effect is attached to
    let p = o.parent; if (p && p.cls === 'Attachment') { const w = p.$index('WorldPosition'); return { pos: new THREE.Vector3(w.x, w.y, w.z), size: 1 }; }
    if (p && p.props && p.props.get('CFrame')) { const cf = p.props.get('CFrame'), s = p.props.get('Size') || { x: 2, y: 2, z: 2 }; return { pos: new THREE.Vector3(...cf.p), size: Math.max(s.x, s.y, s.z), s }; }
    if (p && p.cls === 'Model') { const cf = p.pivot(); const parts = p.descendants().filter((d) => d.props.get('Size') && d.props.get('CFrame')); return { pos: new THREE.Vector3(...cf.p), size: 5, model: p, parts }; } return null; }
  update(dt) {
    if (this.E.frameN % 20 === 0 || !this.scanned) { this.scan(); this.scanned = true; }
    for (const it of this.items.values()) { const o = it.o, P = o.props, a = this.anchor(o); if (!a || P.get('Enabled') === false || (o.cls === 'ForceField' && P.get('Visible') === false)) { it.obj.visible = false; it.ps.length = 0; continue; } it.obj.visible = true;
      if (o.cls === 'ForceField') { const r = a.model ? 3.4 : a.size * 0.75 + 0.4; it.obj.position.copy(a.pos); it.obj.scale.set(r, a.model ? 3.4 * 1.2 : r, r); it.obj.material.opacity = 0.14 + Math.sin(this.E.t * 6) * 0.05; it.obj.rotation.y += dt * 0.8; continue; }
      const sz = P.get('Size') ?? (o.cls === 'Fire' ? 5 : o.cls === 'Smoke' ? 1 : 1); const rate = o.cls === 'Fire' ? 28 : o.cls === 'Smoke' ? 10 : 14; it.acc += dt * rate;
      while (it.acc >= 1 && it.ps.length < MAX) { it.acc -= 1; const sp = (a.s ? Math.min(a.s.x, a.s.z) : 1) * 0.35;
        const q = { p: a.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * sp * 2, (Math.random() - 0.3) * 0.5, (Math.random() - 0.5) * sp * 2)), age: 0 };
        if (o.cls === 'Fire') { q.v = new THREE.Vector3((Math.random() - 0.5) * 0.8, (P.get('Heat') ?? 9) * 0.45 + Math.random(), (Math.random() - 0.5) * 0.8); q.life = 0.5 + Math.random() * 0.4; }
        else if (o.cls === 'Smoke') { q.v = new THREE.Vector3((Math.random() - 0.5) * 0.6, (P.get('RiseVelocity') ?? 1) + Math.random() * 0.6, (Math.random() - 0.5) * 0.6); q.life = 2.2 + Math.random(); }
        else { q.v = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.2) * 2, (Math.random() - 0.5) * 2); q.life = 0.7 + Math.random() * 0.5; q.p.add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2)); }
        it.ps.push(q); }
      it.acc = Math.min(it.acc, 2); it.ps = it.ps.filter((q) => (q.age += dt) < q.life); const g = it.obj.geometry, pos = g.attributes.position, col = g.attributes.color; let k = 0;
      const A = c3(P.get('Color'), o.cls === 'Fire' ? '#ec8b46' : '#c0c0c0'), B = c3(P.get('SecondaryColor'), o.cls === 'Fire' ? '#8b5014' : '#c0c0c0'), S = c3(P.get('SparkleColor'), '#90bdff'), tmp = new THREE.Color();
      for (const q of it.ps) { q.p.addScaledVector(q.v, dt); const f = q.age / q.life; pos.setXYZ(k, q.p.x, q.p.y, q.p.z);
        if (o.cls === 'Fire') tmp.copy(A).lerp(B, f).multiplyScalar((1 - f) * 1.3); else if (o.cls === 'Smoke') tmp.copy(A).multiplyScalar((P.get('Opacity') ?? 0.5) * (1 - f) * (f < 0.15 ? f / 0.15 : 1)); else tmp.copy(S).multiplyScalar(Math.abs(Math.sin(q.age * 14)) * (1 - f));
        col.setXYZ(k, tmp.r, tmp.g, tmp.b); k++; }
      g.setDrawRange(0, k); pos.needsUpdate = col.needsUpdate = true; it.obj.material.size = o.cls === 'Fire' ? sz * 0.55 : o.cls === 'Smoke' ? sz * 1.6 + 1 : 0.7;
      if (o.cls === 'Smoke') { it.obj.material.blending = THREE.NormalBlending; } }
    // explosions
    this.blasts = this.blasts.filter((b) => { b.t += dt; const k = b.t / 0.8; if (k >= 1) { this.group.remove(b.g); b.g.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }); return false; }
      const e = 1 - (1 - k) ** 3; b.ball.scale.setScalar(b.r * (0.3 + e * 0.9)); b.ball.material.opacity = (1 - k) * 0.9; b.ring.scale.setScalar(b.r * (0.4 + e * 2.2)); b.ring.material.opacity = (1 - k) * 0.7; b.light.intensity = (1 - k) * 40;
      for (const d of b.debris) { d.v.y -= 60 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += dt * 6; } return true; });
  }
  explode(pos, radius) {
    const g = new THREE.Group(); g.position.set(pos.x, pos.y, pos.z); const r = Math.max(2, Math.min(radius, 30));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); g.add(ball);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: '#fff2cc', transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); ring.rotation.x = -Math.PI / 2; g.add(ring);
    const light = new THREE.PointLight('#ffaa55', 40, r * 6, 1.6); g.add(light); const debris = [];
    for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: i % 2 ? '#3a3a3a' : '#ff7a2f', emissive: i % 2 ? '#000' : '#ff5500' })); const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.3, Math.random() - 0.5).normalize().multiplyScalar(20 + Math.random() * 25); g.add(m); debris.push({ m, v }); }
    this.group.add(g); this.blasts.push({ g, ball, ring, light, debris, r, t: 0 });
  }
}
