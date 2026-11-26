import { settings } from './settings.js';
import { clamp, isTouch } from './util.js';

// Unified action input: keyboard + mouse (pointer lock), gamepad (standard mapping), touch (virtual stick + look pad + buttons).
// Actions are polled each frame: input.down(a), input.pressed(a), input.released(a). Look deltas are in radians.
const KEYMAP = {
  KeyW: 'fwd', ArrowUp: 'fwd', KeyZ: 'fwd', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', KeyQ: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', ControlLeft: 'crouch', KeyC: 'crouch',
  KeyE: 'interact', KeyF: 'flashlight', KeyR: 'inspect', KeyG: 'drop', KeyV: 'pocket', KeyX: 'mark', KeyP: 'photo', Tab: 'notebook', KeyJ: 'notebook',
  Escape: 'pause', Enter: 'confirm', KeyT: 'chat',
  Digit1: 'tool1', Digit2: 'tool2', Digit3: 'tool3', Digit4: 'tool4', Digit5: 'tool5', Digit6: 'tool6', Digit7: 'tool7',
};

class Input {
  constructor() {
    this.held = new Set(); this.prev = new Set(); this.cur = new Set();
    this.lookX = 0; this.lookY = 0; this.wheel = 0;
    this.moveX = 0; this.moveY = 0;
    this.locked = false; this.enabled = true; this.uiCapture = false;
    this.touch = isTouch();
    this.mode = this.touch ? 'touch' : 'kbm';
    this._pending = new Set();
    this._released = new Set();
    this.listeners = [];
  }
  attach(canvas, touchRoot) {
    this.canvas = canvas;
    addEventListener('keydown', e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return; // typing in a form field
      if (this.uiCapture && e.code !== 'Escape') return;
      const a = KEYMAP[e.code];
      if (a) { if (!this.held.has(a)) this._pending.add(a); this.held.add(a); this.mode = 'kbm'; if (a !== 'pause' || this.locked) e.preventDefault(); }
    });
    addEventListener('keyup', e => { const a = KEYMAP[e.code]; if (a) { this.held.delete(a); this._released.add(a); } });
    addEventListener('blur', () => { this.held.clear(); });
    canvas.addEventListener('mousedown', e => {
      if (!this.locked && !this.touch && this.wantLock) { this.lock(); return; }
      const a = e.button === 0 ? 'use' : e.button === 2 ? 'alt' : 'interact';
      this.held.add(a); this._pending.add(a); this.mode = 'kbm';
    });
    addEventListener('mouseup', e => { const a = e.button === 0 ? 'use' : e.button === 2 ? 'alt' : 'interact'; this.held.delete(a); this._released.add(a); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => {
      if (!this.locked) return;
      const s = 0.0022 * settings.v.mouseSens;
      this.lookX += e.movementX * s; this.lookY += e.movementY * s * (settings.v.invertY ? -1 : 1);
    });
    addEventListener('wheel', e => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.listeners.forEach(f => f(this.locked));
    });
    if (touchRoot) this._buildTouch(touchRoot);
  }
  onLock(f) { this.listeners.push(f); }
  lock() { if (this.touch) return; try { const p = this.canvas.requestPointerLock?.({ unadjustedMovement: true }); p?.catch?.(() => this.canvas.requestPointerLock()); } catch { /* ignored */ } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  _buildTouch(root) {
    root.classList.add('touch-on');
    const stick = root.querySelector('.t-stick'), knob = root.querySelector('.t-knob');
    let sid = null, sx = 0, sy = 0, lid = null, lx = 0, ly = 0;
    const R = 56;
    root.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        const btn = t.target.closest?.('[data-act]');
        if (btn) { const a = btn.dataset.act; btn.classList.add('on'); btn._tid = t.identifier; this.held.add(a); this._pending.add(a); continue; }
        if (t.clientX < innerWidth * 0.42 && sid === null) {
          sid = t.identifier; sx = t.clientX; sy = t.clientY;
          stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; stick.classList.add('on');
        } else if (lid === null) { lid = t.identifier; lx = t.clientX; ly = t.clientY; }
      }
      this.mode = 'touch'; e.preventDefault();
    }, { passive: false });
    root.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === sid) {
          let dx = t.clientX - sx, dy = t.clientY - sy; const d = Math.hypot(dx, dy);
          if (d > R) { dx *= R / d; dy *= R / d; }
          knob.style.transform = `translate(${dx}px,${dy}px)`;
          this.moveX = dx / R; this.moveY = -dy / R;
          if (d > R * 0.98 && this._autoSprint) this.held.add('sprint');
        } else if (t.identifier === lid) {
          const s = 0.0042 * settings.v.touchSens;
          this.lookX += (t.clientX - lx) * s; this.lookY += (t.clientY - ly) * s * (settings.v.invertY ? -1 : 1);
          lx = t.clientX; ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === sid) { sid = null; this.moveX = this.moveY = 0; knob.style.transform = ''; stick.classList.remove('on'); }
        else if (t.identifier === lid) lid = null;
        root.querySelectorAll('[data-act]').forEach(b => { if (b._tid === t.identifier) { b.classList.remove('on'); this.held.delete(b.dataset.act); this._released.add(b.dataset.act); b._tid = null; } });
      }
    };
    root.addEventListener('touchend', end); root.addEventListener('touchcancel', end);
  }

  _pollPad(dt) {
    const pads = navigator.getGamepads?.() || [];
    const p = [...pads].find(x => x && x.connected);
    if (!p) return;
    const dz = v => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
    const lx = dz(p.axes[0] || 0), ly = dz(p.axes[1] || 0), rx = dz(p.axes[2] || 0), ry = dz(p.axes[3] || 0);
    if (lx || ly || rx || ry) this.mode = 'pad';
    if (this.mode === 'pad') { this.moveX = lx; this.moveY = -ly; }
    const s = 3.2 * settings.v.padSens * dt;
    this.lookX += Math.sign(rx) * rx * rx * s; this.lookY += Math.sign(ry) * ry * ry * s * (settings.v.invertY ? -1 : 1);
    const map = { 0: 'jump', 1: 'crouch', 2: 'interact', 3: 'inspect', 4: 'toolPrev', 5: 'toolNext', 6: 'alt', 7: 'use', 8: 'notebook', 9: 'pause', 10: 'sprint', 11: 'flashlight', 12: 'photo', 13: 'drop', 14: 'pocket', 15: 'mark' };
    for (const i in map) {
      const a = map[i], b = p.buttons[i];
      const on = b && (b.pressed || b.value > 0.5);
      const k = 'pad:' + a;
      if (on) { if (!this.held.has(k)) { this._pending.add(a); this.held.add(k); this.mode = 'pad'; } this.held.add(a); }
      else if (this.held.has(k)) { this.held.delete(k); this.held.delete(a); this._released.add(a); }
    }
  }

  update(dt) {
    this._pollPad(dt);
    if (this.mode === 'kbm') {
      this.moveX = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
      this.moveY = (this.held.has('fwd') ? 1 : 0) - (this.held.has('back') ? 1 : 0);
      const l = Math.hypot(this.moveX, this.moveY); if (l > 1) { this.moveX /= l; this.moveY /= l; }
    }
    this.cur = this._pending; this._pending = new Set();
    this.rel = this._released; this._released = new Set();
    this.moveX = clamp(this.moveX, -1, 1); this.moveY = clamp(this.moveY, -1, 1);
  }
  consumeLook() { const r = [this.lookX, this.lookY]; this.lookX = 0; this.lookY = 0; return r; }
  consumeWheel() { const w = this.wheel; this.wheel = 0; return w; }
  down(a) { return this.enabled && this.held.has(a); }
  pressed(a) { return this.enabled && this.cur.has(a); }
  released(a) { return this.enabled && this.rel?.has(a); }
  eat(a) { this.cur.delete(a); }
  clear() { this.held.clear(); this.cur.clear(); this.lookX = this.lookY = 0; this.moveX = this.moveY = 0; }
}
export const input = new Input();
