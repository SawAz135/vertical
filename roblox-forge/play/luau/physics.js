/* =====================================================================
   Roblox Forge · Jouer — rigid body physics with Rapier (WebAssembly).
   Loaded only when a place has loose parts or physical constraints.
   - every unanchored assembly (parts welded together: Weld, WeldConstraint,
     Motor6D, …) is one dynamic body; each part adds its collider (Block,
     Ball, Cylinder, Wedge) with Roblox's density, CanCollide off → no
     contact; the assembly root's CFrame / AssemblyLinearVelocity follow it;
   - anchored parts near moving bodies become fixed colliders (added on
     demand, so huge maps stay light); characters are kinematic capsules
     that push things;
   - constraints between attachments: HingeConstraint (revolute, with
     motor / servo), BallSocketConstraint, RopeConstraint, RodConstraint,
     SpringConstraint, PrismaticConstraint / CylindricalConstraint (slider),
     WeldConstraint across assemblies;
   - forces: VectorForce, BodyForce, LinearVelocity, AngularVelocity,
     BodyVelocity, BodyAngularVelocity, BodyPosition, BodyGyro, Torque,
     AlignPosition / AlignOrientation on loose bodies, and
     ApplyImpulse / ApplyAngularImpulse / AssemblyLinearVelocity writes.
   Assemblies driven by the engine itself (characters, NPC roots, parts held
   by AlignPosition in an anchored-free way) keep their scripted motion.
   ===================================================================== */
import { Vector3, CFrame, isA } from './roblox.js?v=11';
import { rotToQuat, quatToRot } from './anim.js?v=11';

let R = null, loading = null;
export const loadRapier = () => (loading ||= import('../vendor/rapier/rapier.es.js').then(async (m) => { const r = m.default || m; await r.init(); R = r; return r; }).catch((e) => { console.warn('physics', e); return null; }));
const CONSTRAINTS = new Set(['HingeConstraint', 'BallSocketConstraint', 'RopeConstraint', 'RodConstraint', 'SpringConstraint', 'PrismaticConstraint', 'CylindricalConstraint']);
const FORCES = new Set(['VectorForce', 'BodyForce', 'LinearVelocity', 'AngularVelocity', 'BodyVelocity', 'BodyAngularVelocity', 'BodyPosition', 'BodyGyro', 'Torque', 'AlignPosition', 'AlignOrientation', 'BodyThrust']);
const q2 = (r) => { const [x, y, z, w] = rotToQuat(r); return { x, y, z, w }; };
export class Physics {
  constructor(engine) { this.E = engine; this.bodies = new Map(); this.statics = new Map(); this.joints = new Map(); this.kin = new Map(); this.ready = false; this.want = false; this.written = new WeakMap(); }
  /* is there anything for real physics to do? (checked twice a second) */
  needed() { if (this.want && this.E.frameN % 30) return true; const free = (this.E.freeRoots || []).some((r) => !r.props.get('Anchored') && !this.engineDriven(r)); this.want = free || this.E.constraints.size > 0; return this.want; }
  engineDriven(root) { const E = this.E; if (E.char && root.parent === E.char) return true; const m = root.parent; if (m && m.kids && m.kids.some((k) => k.cls === 'Humanoid')) return true;
    for (const k of root.kids) if (k.cls === 'AlignPosition' || k.cls === 'LinearVelocity' || k.cls === 'BodyVelocity' || k.cls === 'BodyPosition') { if (k.cls === 'AlignPosition' && k.props.get('Enabled') !== false) return true; } return false; }
  step(dt) {
    if (!this.needed() && !this.bodies.size) return false; if (!R) { loadRapier(); return false; }
    if (!this.world) { this.world = new R.World({ x: 0, y: -(this.E.workspace.props.get('Gravity') || 196.2), z: 0 }); this.ready = true; }
    const E = this.E, W = this.world; W.gravity = { x: 0, y: -(E.workspace.props.get('Gravity') || 196.2), z: 0 };
    // assemblies: root → parts
    const asm = this.assemblies();
    // drop bodies that are gone / anchored / changed shape
    for (const [root, b] of this.bodies) { const parts = asm.get(root); if (!parts || parts.length !== b.n || !root.parent) { W.removeRigidBody(b.rb); this.bodies.delete(root); } }
    for (const [root, parts] of asm) if (!this.bodies.has(root)) this.makeBody(root, parts);
    // script moved a dynamic root (PivotTo / CFrame =): teleport its body
    for (const [root, b] of this.bodies) { const cf = root.props.get('CFrame'); if (this.written.get(root) !== cf) { b.rb.setTranslation({ x: cf.p[0], y: cf.p[1], z: cf.p[2] }, true); b.rb.setRotation(q2(cf.r), true); }
      const v = root.props.get('AssemblyLinearVelocity'); if (v && b.lastV !== v) b.rb.setLinvel({ x: v.x, y: v.y, z: v.z }, true); const w = root.props.get('AssemblyAngularVelocity'); if (w && b.lastW !== w) b.rb.setAngvel({ x: w.x, y: w.y, z: w.z }, true);
      if (b.impulse) { b.rb.applyImpulse(b.impulse, true); b.impulse = null; } if (b.aImpulse) { b.rb.applyTorqueImpulse(b.aImpulse, true); b.aImpulse = null; } }
    this.staticsNear(); this.characters(); this.constraints(); this.forces(dt);
    W.timestep = Math.min(1 / 30, dt); W.step();
    for (const [root, b] of this.bodies) { const t = b.rb.translation(), r = b.rb.rotation(), lv = b.rb.linvel(), av = b.rb.angvel();
      const cf = new CFrame([t.x, t.y, t.z], quatToRot([r.x, r.y, r.z, r.w])); root.props.set('CFrame', cf); this.written.set(root, cf);
      b.lastV = new Vector3(lv.x, lv.y, lv.z); root.props.set('AssemblyLinearVelocity', b.lastV); b.lastW = new Vector3(av.x, av.y, av.z); root.props.set('AssemblyAngularVelocity', b.lastW);
      if (t.y < (E.workspace.props.get('FallenPartsDestroyHeight') ?? -500)) { this.E.rt.classMethods && root.parent && (root.$index('Destroy'))([root]); } }
    return true;
  }
  /* loose assemblies (root → its parts), rebuilt when joints change or twice a second */
  assemblies() {
    const E = this.E; if (this.asm && !E.jointsDirty && E.frameN % 30 && this.asmN === E.frameN - 1) { this.asmN = E.frameN; return this.asm; } this.asmN = E.frameN;
    const asm = new Map(), add = (root, p) => { if (!asm.has(root)) asm.set(root, new Set([root])); asm.get(root).add(p); };
    for (const r of E.freeRoots || []) if (r.parent) add(r, r);
    for (const p1 of (E.by1 || new Map()).keys()) { if (!p1.parent || !isA(p1.cls, 'BasePart')) continue; const root = E.rootOf(p1); if (!root.parent || root.props.get('Anchored')) continue; add(root, p1); }
    const out = new Map(); for (const [root, set] of asm) { const parts = [...set]; if (parts.some((p) => p.props.get('Anchored')) || this.engineDriven(root) || !E.inWorld(root)) continue; out.set(root, parts); }
    this.asm = out; return out;
  }
  shape(p, rel) { // a part's collider, placed relative to its body
    const s = p.props.get('Size') || { x: 1, y: 1, z: 1 }, sh = p.props.get('Shape'); let cd; const name = sh && sh.name;
    if (name === 'Ball') cd = R.ColliderDesc.ball(s.x / 2);
    else if (name === 'Cylinder') { cd = R.ColliderDesc.cylinder(s.x / 2, Math.min(s.y, s.z) / 2); rel = rel.mulCF(new CFrame([0, 0, 0], [0, -1, 0, 1, 0, 0, 0, 0, 1])); } // Roblox cylinders lie along X
    else if (p.cls === 'WedgePart' || (name === 'Wedge')) { const h = [s.x / 2, s.y / 2, s.z / 2]; cd = R.ColliderDesc.convexHull(new Float32Array([-h[0], -h[1], -h[2], h[0], -h[1], -h[2], -h[0], -h[1], h[2], h[0], -h[1], h[2], -h[0], h[1], h[2], h[0], h[1], h[2]])) || R.ColliderDesc.cuboid(...h); }
    else cd = R.ColliderDesc.cuboid(Math.max(0.025, s.x / 2), Math.max(0.025, s.y / 2), Math.max(0.025, s.z / 2));
    cd.setTranslation(rel.p[0], rel.p[1], rel.p[2]).setRotation(q2(rel.r)); const pp = p.props.get('CustomPhysicalProperties'); cd.setDensity(p.props.get('Massless') ? 0.0001 : 0.7); cd.setFriction(0.3); cd.setRestitution(0);
    if (pp && pp.f) { if (pp.f.Density != null) cd.setDensity(pp.f.Density); if (pp.f.Friction != null) cd.setFriction(pp.f.Friction); if (pp.f.Elasticity != null) cd.setRestitution(pp.f.Elasticity); }
    if (p.props.get('CanCollide') === false) cd.setSensor(true); return cd;
  }
  makeBody(root, parts) {
    const cf = root.props.get('CFrame'), inv = cf.inverse(); const rb = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(cf.p[0], cf.p[1], cf.p[2]).setRotation(q2(cf.r)).setCcdEnabled(true));
    for (const p of parts) this.world.createCollider(this.shape(p, inv.mulCF(p.props.get('CFrame'))), rb);
    const v = root.props.get('AssemblyLinearVelocity'); if (v) rb.setLinvel({ x: v.x, y: v.y, z: v.z }, true); const w = root.props.get('AssemblyAngularVelocity'); if (w) rb.setAngvel({ x: w.x, y: w.y, z: w.z }, true);
    this.bodies.set(root, { rb, n: parts.length, lastV: v, lastW: w }); this.written.set(root, cf);
  }
  /* anchored parts near moving bodies (and near characters) collide */
  staticsNear() {
    const C = this.E.contacts, want = new Set(); const around = (pos, r) => { for (const p of C.inRadius(new Vector3(pos.x, pos.y, pos.z), r, null)) if (p.props.get('Anchored') && p.props.get('CanCollide') !== false) want.add(p); };
    if (this.E.frameN % 6 === 0 || !this.staticsOnce) { this.staticsOnce = true; for (const b of this.bodies.values()) { const t = b.rb.translation(), v = b.rb.linvel(); around(t, 24 + Math.hypot(v.x, v.y, v.z) * 0.3); }
      for (const p of want) if (!this.statics.has(p)) { const cf = p.props.get('CFrame'), rb = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(cf.p[0], cf.p[1], cf.p[2]).setRotation(q2(cf.r))); this.world.createCollider(this.shape(p, new CFrame()), rb); this.statics.set(p, { rb, cf }); }
      for (const [p, s] of this.statics) { if (!want.has(p) || !p.parent) { this.world.removeRigidBody(s.rb); this.statics.delete(p); } else if (p.props.get('CFrame') !== s.cf) { const cf = p.props.get('CFrame'); s.rb.setTranslation({ x: cf.p[0], y: cf.p[1], z: cf.p[2] }, true); s.rb.setRotation(q2(cf.r), true); s.cf = cf; } } }
  }
  /* characters push loose parts: kinematic capsules following their root */
  characters() {
    const list = [this.E.char && this.E.char.parts && this.E.char.parts.HumanoidRootPart].filter(Boolean); for (const h of this.E.humanoids ? this.E.humanoids.hums() : []) { const r = this.E.humanoids.rootOf(h); if (r && !list.includes(r)) list.push(r); }
    const seen = new Set(); for (const r of list) { if (!r.parent) continue; seen.add(r); const cf = r.props.get('CFrame'); let k = this.kin.get(r);
      if (!k) { const rb = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(cf.p[0], cf.p[1] - 0.5, cf.p[2])); this.world.createCollider(R.ColliderDesc.capsule(1.6, 1.1), rb); k = { rb }; this.kin.set(r, k); }
      k.rb.setNextKinematicTranslation({ x: cf.p[0], y: cf.p[1] - 0.5, z: cf.p[2] }); }
    for (const [r, k] of this.kin) if (!seen.has(r)) { this.world.removeRigidBody(k.rb); this.kin.delete(r); }
  }
  bodyOf(part) { if (!part || !part.props) return null; const root = this.E.rootOf(part); const b = this.bodies.get(root); if (b) return { rb: b.rb, root }; if (part.props.get('Anchored') || root.props.get('Anchored')) { let s = this.statics.get(root); if (!s) { const cf = root.props.get('CFrame'), rb = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(cf.p[0], cf.p[1], cf.p[2]).setRotation(q2(cf.r))); s = { rb, cf, pinned: true }; this.statics.set(root, s); } return { rb: s.rb, root }; } return null; }
  /* an attachment's position in its body's frame, and its axis there */
  local(att, root) { const part = att.parent, acf = att.props.get('CFrame') || new CFrame(); const rel = root.props.get('CFrame').inverse().mulCF(part.props.get('CFrame')).mulCF(acf); return { p: { x: rel.p[0], y: rel.p[1], z: rel.p[2] }, axis: { x: rel.r[0], y: rel.r[3], z: rel.r[6] } }; }
  constraints() {
    const seen = new Set();
    for (const c of this.E.constraints) { if (!c.parent) continue; seen.add(c); const P = c.props; const a0 = P.get('Attachment0'), a1 = P.get('Attachment1');
      if (P.get('Enabled') === false || !a0 || !a1 || !a0.parent || !a1.parent) { this.dropJoint(c); continue; }
      const A = this.bodyOf(a0.parent), B = this.bodyOf(a1.parent); if (!A || !B || A.rb === B.rb) { this.dropJoint(c); continue; }
      let j = this.joints.get(c); const sig = [A.rb.handle, B.rb.handle, P.get('Length'), P.get('FreeLength'), P.get('Stiffness'), P.get('Damping'), P.get('ActuatorType') && P.get('ActuatorType').name].join('|');
      if (j && j.sig !== sig) { this.dropJoint(c); j = null; }
      if (!j) { const la = this.local(a0, A.root), lb = this.local(a1, B.root); let data;
        switch (c.cls) { case 'HingeConstraint': data = R.JointData.revolute(la.p, lb.p, la.axis); break; case 'BallSocketConstraint': data = R.JointData.spherical(la.p, lb.p); break;
          case 'RopeConstraint': data = R.JointData.rope(P.get('Length') ?? 5, la.p, lb.p); break; case 'RodConstraint': data = R.JointData.rope(P.get('Length') ?? 5, la.p, lb.p); break;
          case 'SpringConstraint': data = R.JointData.spring(P.get('FreeLength') ?? 1, (P.get('Stiffness') ?? 0) / 10, (P.get('Damping') ?? 0) / 10, la.p, lb.p); break;
          default: data = R.JointData.prismatic(la.p, lb.p, la.axis); }
        const ij = this.world.createImpulseJoint(data, A.rb, B.rb, true); j = { ij, sig }; this.joints.set(c, j); }
      // hinge motors / servos
      if (c.cls === 'HingeConstraint' && j.ij.configureMotorVelocity) { const at = P.get('ActuatorType') && P.get('ActuatorType').name;
        if (at === 'Motor') j.ij.configureMotorVelocity(P.get('AngularVelocity') ?? 0, Math.min(1e6, (P.get('MotorMaxTorque') ?? 0) / 1000) + 0.5);
        else if (at === 'Servo') j.ij.configureMotorPosition((P.get('TargetAngle') ?? 0) * Math.PI / 180, Math.min(1e5, (P.get('ServoMaxTorque') ?? 0) / 100) + 1, 2); }
    }
    for (const c of [...this.joints.keys()]) if (!seen.has(c)) this.dropJoint(c);
  }
  dropJoint(c) { const j = this.joints.get(c); if (j) { try { this.world.removeImpulseJoint(j.ij, true); } catch { /* body gone */ } this.joints.delete(c); } }
  forces(dt) {
    for (const b of this.bodies.values()) { b.rb.resetForces(true); b.rb.resetTorques(true); }
    for (const f of this.E.forces) { if (!f.parent || f.props.get('Enabled') === false) continue; const P = f.props, att = P.get('Attachment0'), host = att ? att.parent : f.parent; if (!host || !host.props) continue; const root = this.E.rootOf(host), b = this.bodies.get(root); if (!b) continue; const rb = b.rb; {
      { const cf = root.props.get('CFrame');
        const world = (v, rel) => (rel ? cf.vecToWorld(v) : v); const m = rb.mass();
        switch (f.cls) {
          case 'VectorForce': { const rel = P.get('RelativeTo') && P.get('RelativeTo').name === 'Attachment0' && att ? (att.parent.props.get('CFrame').mulCF(att.props.get('CFrame') || new CFrame())).vecToWorld(P.get('Force') || new Vector3()) : P.get('RelativeTo') && P.get('RelativeTo').name === 'World' ? P.get('Force') : world(P.get('Force') || new Vector3(), true); rb.addForce({ x: rel.x / 1, y: rel.y / 1, z: rel.z / 1 }, true); break; }
          case 'BodyForce': { const F = P.get('Force') || new Vector3(); rb.addForce({ x: F.x, y: F.y, z: F.z }, true); break; }
          case 'BodyThrust': { const F = cf.vecToWorld(P.get('Force') || new Vector3()); rb.addForce({ x: F.x, y: F.y, z: F.z }, true); break; }
          case 'Torque': { const T = P.get('Torque') || new Vector3(); rb.addTorque({ x: T.x, y: T.y, z: T.z }, true); break; }
          case 'LinearVelocity': case 'BodyVelocity': { const V = P.get(f.cls === 'LinearVelocity' ? 'VectorVelocity' : 'Velocity') || new Vector3(); const cur = rb.linvel(); const k = Math.min(1, dt * 30); rb.setLinvel({ x: cur.x + (V.x - cur.x) * k, y: cur.y + (V.y - cur.y) * k, z: cur.z + (V.z - cur.z) * k }, true); break; }
          case 'AngularVelocity': case 'BodyAngularVelocity': { const V = P.get('AngularVelocity') || new Vector3(); rb.setAngvel({ x: V.x, y: V.y, z: V.z }, true); break; }
          case 'BodyPosition': case 'AlignPosition': { const T = P.get('Position') || (P.get('Attachment1') && P.get('Attachment1').$index('WorldPosition')); if (!T) break; const t = rb.translation(), v = rb.linvel(), k = (P.get('P') ?? P.get('Responsiveness') ?? 10) / (f.cls === 'BodyPosition' ? 1000 : 1), d = P.get('D') ?? 1;
            rb.addForce({ x: ((T.x - t.x) * k * 4 - v.x * d * 2) * m, y: ((T.y - t.y) * k * 4 - v.y * d * 2) * m + m * (this.E.workspace.props.get('Gravity') || 196.2), z: ((T.z - t.z) * k * 4 - v.z * d * 2) * m }, true); break; }
          case 'BodyGyro': case 'AlignOrientation': { const tcf = P.get('CFrame') || (P.get('Attachment1') && P.get('Attachment1').$index('WorldCFrame')); if (!tcf) break; const r = rb.rotation(); const cur = [r.x, r.y, r.z, r.w], tq = rotToQuat(tcf.r); const k = Math.min(1, dt * 10);
            let dq = [tq[0] - cur[0], tq[1] - cur[1], tq[2] - cur[2], tq[3] - cur[3]]; if (cur[0] * tq[0] + cur[1] * tq[1] + cur[2] * tq[2] + cur[3] * tq[3] < 0) dq = [-tq[0] - cur[0], -tq[1] - cur[1], -tq[2] - cur[2], -tq[3] - cur[3]];
            const n = [cur[0] + dq[0] * k, cur[1] + dq[1] * k, cur[2] + dq[2] * k, cur[3] + dq[3] * k], l = Math.hypot(...n); rb.setRotation({ x: n[0] / l, y: n[1] / l, z: n[2] / l, w: n[3] / l }, true); rb.setAngvel({ x: 0, y: 0, z: 0 }, true); break; } } } }
  } }
  impulse(part, v, angular) { const root = this.E.rootOf(part), b = this.bodies.get(root); if (!b) { const cur = root.props.get('AssemblyLinearVelocity') || new Vector3(), sz = root.props.get('Size') || { x: 1, y: 1, z: 1 }, mass = Math.max(0.01, sz.x * sz.y * sz.z * 0.7); if (!angular) root.props.set('AssemblyLinearVelocity', new Vector3(cur.x + v.x / mass, cur.y + v.y / mass, cur.z + v.z / mass)); return; } /* Δv = impulse / mass, like Roblox */ if (angular) b.aImpulse = { x: v.x, y: v.y, z: v.z }; else b.impulse = { x: v.x, y: v.y, z: v.z }; }
}
