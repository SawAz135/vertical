/* =====================================================================
   Roblox Forge · Jouer — Explosion objects, like Roblox's.
   When an Explosion enters Workspace: every part within BlastRadius fires
   Explosion.Hit(part, distance); characters whose parts are within
   BlastRadius × DestroyJointRadiusPercent lose their joints and die;
   loose parts are pushed away (BlastPressure); the 3D view shows the
   blast when Visible.
   ===================================================================== */
import { Vector3, isA } from './roblox.js?v=12';

export class Explosions {
  constructor(engine) { this.E = engine; this.queue = []; this.done = new WeakSet(); }
  track(o, inWorld) { if (!inWorld) return; const each = (x) => { if (x.cls === 'Explosion' && !this.done.has(x)) this.queue.push(x); for (const k of x.kids) each(k); }; each(o); }
  step() {
    const E = this.E; for (const ex of this.queue.splice(0)) { if (this.done.has(ex) || !ex.parent) continue; this.done.add(ex);
      const P = ex.props, pos = P.get('Position') || new Vector3(), r = P.get('BlastRadius') ?? 4, pct = P.get('DestroyJointRadiusPercent') ?? 1, pressure = P.get('BlastPressure') ?? 500000;
      if (P.get('Visible') !== false) E.onExplosion?.(pos, r);
      const parts = E.contacts.inRadius(pos, r, null); const killed = new Set(); const hit = ex.sigs.get('Hit');
      for (const p of parts) { const cf = p.props.get('CFrame'); const d = Math.hypot(cf.p[0] - pos.x, cf.p[1] - pos.y, cf.p[2] - pos.z);
        if (hit && hit.conns.length) { const I = E.I, prev = I.side; I.side = 'server'; try { hit.fire([p, d]); } finally { I.side = prev; } }
        const m = p.parent, hum = m && m.kids.find((k) => k.cls === 'Humanoid'); if (hum && d <= r * pct && !killed.has(hum) && !(m.kids.some((k) => k.cls === 'ForceField'))) { killed.add(hum); hum.$newindex('Health', 0); }
        if (!p.props.get('Anchored') && pressure > 0) { const dir = [cf.p[0] - pos.x, cf.p[1] - pos.y + 1, cf.p[2] - pos.z], l = Math.hypot(...dir) || 1, k = Math.min(120, pressure / 8000) * (1 - Math.min(1, d / Math.max(1, r)));
          const v = p.props.get('AssemblyLinearVelocity') || new Vector3(); p.props.set('AssemblyLinearVelocity', new Vector3(v.x + dir[0] / l * k, v.y + dir[1] / l * k, v.z + dir[2] / l * k)); } }
      void isA; }
  }
}
