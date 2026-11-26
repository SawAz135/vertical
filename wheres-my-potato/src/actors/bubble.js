import * as THREE from 'three';
import { easeOutBack, clamp } from '../core/util.js';

// =====================================================================================
// 3D SPEECH BUBBLE — a comic bubble floating above a character's head in the world:
// pops in with an overshoot, types the text letter by letter, wobbles gently, then
// shrinks away. Always faces the camera (sprite), readable from far (screen-size clamp).
// =====================================================================================
export class Bubble {
  constructor(scene) {
    this.c = document.createElement('canvas'); this.c.width = 1024; this.c.height = 512; this.x = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false }));
    this.sprite.renderOrder = 40; this.sprite.visible = false; scene.add(this.sprite);
    this.t = 0; this.dur = 0; this.text = ''; this.shown = -1; this.anchor = new THREE.Vector3();
  }
  show(text, dur, name = 'Gérard') { this.text = text; this.name = name; this.t = 0; this.dur = Math.max(2.8, dur + 2.2); this.shown = -1; this.sprite.visible = true; this._lines(); }
  _lines() {
    const x = this.x; x.font = '700 52px Fred, system-ui, sans-serif';
    const words = this.text.split(' '), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > 860 && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); this.lines = lines.slice(0, 4);
  }
  _draw(nChars) {
    const x = this.x, W = 1024, H = 512, lines = this.lines, lh = 62;
    const bh = 70 + lines.length * lh + 20, bw = Math.min(980, Math.max(...lines.map(l => (x.font = '700 52px Fred, system-ui, sans-serif', x.measureText(l).width))) + 90);
    const bx = (W - bw) / 2, by = H - bh - 70;
    x.clearRect(0, 0, W, H);
    // shadow + bubble + tail
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.roundRect(bx + 8, by + 12, bw, bh, 46); x.fill();
    x.fillStyle = '#fff8e8'; x.strokeStyle = '#3a2414'; x.lineWidth = 8;
    x.beginPath(); x.roundRect(bx, by, bw, bh, 46); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(W / 2 - 40, by + bh - 4); x.lineTo(W / 2 - 10, H - 18); x.lineTo(W / 2 + 34, by + bh - 4); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(W / 2 - 40, by + bh); x.lineTo(W / 2 - 10, H - 18); x.lineTo(W / 2 + 34, by + bh); x.stroke();
    x.fillStyle = '#fff8e8'; x.fillRect(W / 2 - 36, by + bh - 10, 66, 10);
    // name tag
    x.font = '700 40px Marker, "Permanent Marker", cursive'; x.fillStyle = '#b8471c'; x.textAlign = 'left'; x.fillText(this.name, bx + 40, by + 52);
    // typed text
    x.font = '700 52px Fred, system-ui, sans-serif'; x.fillStyle = '#3a2414';
    let left = nChars;
    lines.forEach((l, k) => { if (left <= 0) return; x.fillText(l.slice(0, left), bx + 40, by + 70 + (k + 1) * lh - 8); left -= l.length + 1; });
    this.tex.needsUpdate = true;
  }
  update(dt, anchor, camera) {
    if (!this.sprite.visible) return;
    this.t += dt;
    const total = this.text.length, n = Math.min(total, Math.floor(this.t * 38));
    if (n !== this.shown) { this.shown = n; this._draw(n); }
    const pop = this.t < 0.35 ? easeOutBack(this.t / 0.35, 2.4) : this.t > this.dur - 0.3 ? clamp((this.dur - this.t) / 0.3, 0, 1) : 1;
    // keep a readable size on screen whatever the distance
    const d = camera.position.distanceTo(anchor), s = clamp(d * 0.12, 1.1, 7) * pop;
    this.sprite.scale.set(s * 2, s, 1);
    this.sprite.position.set(anchor.x, anchor.y + 0.35 + s * 0.45 + Math.sin(this.t * 2.2) * 0.03, anchor.z);
    if (this.t > this.dur) this.sprite.visible = false;
  }
}
