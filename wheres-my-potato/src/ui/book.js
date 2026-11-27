import { audio } from '../audio/audio.js';
import { rng } from '../core/util.js';

// =====================================================================================
// TUTORIAL BOOK — a paper book whose leaves really flip in CSS 3D (front/back faces).
// Every illustration is drawn procedurally in an "ink + watercolour" style.
// =====================================================================================

// ---------- ink sketch helpers ----------
export class Ink {
  constructor(w, h, seed) { this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h; this.x = this.c.getContext('2d'); this.r = rng(seed); this.w = w; this.h = h; this.x.lineCap = this.x.lineJoin = 'round'; }
  jit(a = 1.2) { return (this.r() - 0.5) * a * 2; }
  // watercolour wash: several translucent offset blobs
  wash(pts, col, a = 0.28) {
    const x = this.x;
    for (let k = 0; k < 3; k++) {
      x.fillStyle = col; x.globalAlpha = a * (0.6 + this.r() * 0.4);
      x.beginPath(); pts.forEach(([px, py], i) => { const qx = px + this.jit(5), qy = py + this.jit(5); i ? x.lineTo(qx, qy) : x.moveTo(qx, qy); }); x.closePath(); x.fill();
    }
    x.globalAlpha = 1;
  }
  blob(cx, cy, rx, ry, col, a = 0.3, rot = 0) { const p = []; for (let k = 0; k < 28; k++) { const t = k / 28 * Math.PI * 2; const rr = 1 + this.jit(0.06); p.push([cx + Math.cos(t + rot) * rx * rr * Math.cos(rot) - Math.sin(t) * ry * rr * Math.sin(rot), cy + Math.cos(t) * rx * rr * Math.sin(rot) + Math.sin(t) * ry * rr * Math.cos(rot)]); } this.wash(p, col, a); return p; }
  // wobbly pen stroke, drawn twice for a hand-inked look
  line(pts, w = 2.2, col = '#3a2414', passes = 2) {
    const x = this.x; x.strokeStyle = col;
    for (let p = 0; p < passes; p++) {
      x.lineWidth = w * (p ? 0.55 : 1); x.globalAlpha = p ? 0.5 : 0.92; x.beginPath();
      for (let i = 0; i < pts.length; i++) { const [px, py] = pts[i]; const qx = px + this.jit(0.9), qy = py + this.jit(0.9); if (!i) x.moveTo(qx, qy); else { const [ox, oy] = pts[i - 1]; x.quadraticCurveTo(ox + this.jit(1.2), oy + this.jit(1.2), (ox + qx) / 2, (oy + qy) / 2); x.lineTo(qx, qy); } }
      x.stroke();
    }
    x.globalAlpha = 1;
  }
  ellipse(cx, cy, rx, ry, w, rot = 0, a0 = 0, a1 = Math.PI * 2) { const p = []; const n = 40; for (let k = 0; k <= n; k++) { const t = a0 + (a1 - a0) * k / n; const ex = Math.cos(t) * rx, ey = Math.sin(t) * ry; p.push([cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot)]); } this.line(p, w); }
  hatch(x0, y0, x1, y1, gap = 7, ang = -0.8, w = 1, clip) {
    const x = this.x; x.save(); if (clip) { x.beginPath(); clip.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.clip(); }
    x.strokeStyle = '#3a2414'; x.globalAlpha = 0.35; x.lineWidth = w;
    const len = Math.hypot(x1 - x0, y1 - y0) * 2;
    for (let d = -len; d < len; d += gap) { x.beginPath(); const cx = (x0 + x1) / 2 + Math.cos(ang + Math.PI / 2) * d, cy = (y0 + y1) / 2 + Math.sin(ang + Math.PI / 2) * d; x.moveTo(cx - Math.cos(ang) * len, cy - Math.sin(ang) * len); x.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len); x.stroke(); }
    x.restore(); x.globalAlpha = 1;
  }
  text(s, x0, y0, size = 22, col = '#6b3a1a', rot = 0) { const x = this.x; x.save(); x.translate(x0, y0); x.rotate(rot); x.font = `${size}px Marker, "Comic Sans MS", cursive`; x.fillStyle = col; x.textAlign = 'center'; x.fillText(s, 0, 0); x.restore(); }
  arrow(x0, y0, x1, y1, bend = 30, w = 2.6) {
    const mx = (x0 + x1) / 2 - (y1 - y0) / Math.hypot(x1 - x0, y1 - y0) * bend, my = (y0 + y1) / 2 + (x1 - x0) / Math.hypot(x1 - x0, y1 - y0) * bend;
    const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push([(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1]); }
    this.line(pts, w, '#b8471c');
    const a = Math.atan2(y1 - pts[14][1], x1 - pts[14][0]);
    this.line([[x1 - Math.cos(a - 0.5) * 16, y1 - Math.sin(a - 0.5) * 16], [x1, y1], [x1 - Math.cos(a + 0.5) * 16, y1 - Math.sin(a + 0.5) * 16]], w, '#b8471c');
  }
  // the hero: a potato with eyes/spots, washed and inked
  potato(cx, cy, s = 1, rot = 0, col = '#d9a55a', face = false) {
    const p = this.blob(cx, cy, 34 * s, 24 * s, col, 0.55, rot);
    this.blob(cx - 8 * s, cy - 7 * s, 16 * s, 9 * s, '#fff2c8', 0.35, rot);
    this.line(p.concat([p[0]]), 2.2 * Math.min(1.2, s + 0.2));
    for (let k = 0; k < 4; k++) { const a = this.r() * 6.28, d = this.r() * 0.7; this.ellipse(cx + Math.cos(a) * 24 * s * d, cy + Math.sin(a) * 15 * s * d, 2.2 * s, 1.4 * s, 1.2, a); }
    if (face) { this.x.fillStyle = '#3a2414'; this.x.beginPath(); this.x.arc(cx - 9 * s, cy - 3 * s, 3 * s, 0, 7); this.x.arc(cx + 9 * s, cy - 3 * s, 3 * s, 0, 7); this.x.fill(); this.ellipse(cx, cy + 5 * s, 8 * s, 5 * s, 2, 0, 0.3, Math.PI - 0.3); }
  }
  hand(cx, cy, s = 1, open = true) {
    const p = [[cx - 40 * s, cy + 50 * s], [cx - 34 * s, cy], [cx - 30 * s, cy - 30 * s], [cx - 18 * s, cy - 36 * s], [cx - 14 * s, cy - 10 * s], [cx - 6 * s, cy - 44 * s], [cx + 4 * s, cy - 44 * s], [cx + 6 * s, cy - 12 * s], [cx + 14 * s, cy - 40 * s], [cx + 24 * s, cy - 36 * s], [cx + 22 * s, cy - 6 * s], [cx + 32 * s, cy - 22 * s], [cx + 42 * s, cy - 14 * s], [cx + 30 * s, cy + 20 * s], [cx + 26 * s, cy + 50 * s]];
    this.wash(p, '#f2c49a', 0.5); this.line(p, 2.2);
    void open;
  }
  bucket(cx, cy, s = 1, fill = 0) {
    const w0 = 50 * s, w1 = 36 * s, h = 70 * s;
    const body = [[cx - w0, cy - h / 2], [cx + w0, cy - h / 2], [cx + w1, cy + h / 2], [cx - w1, cy + h / 2]];
    this.wash(body, '#9aa6ad', 0.45); this.hatch(cx - w0, cy - h / 2, cx + w0, cy + h / 2, 8, -0.9, 1, body);
    this.line(body.concat([body[0]]), 2.4); this.ellipse(cx, cy - h / 2, w0, 9 * s, 2.2);
    this.ellipse(cx, cy - h / 2 - 8 * s, w0 * 0.98, 46 * s, 2, 0, Math.PI, Math.PI * 2);
    for (let k = 0; k < fill; k++) this.potato(cx - w0 * 0.6 + (k % 4) * w0 * 0.4, cy - h / 2 - 6 * s - Math.floor(k / 4) * 14 * s, 0.42 * s, this.r() * 2);
  }
  done() { return Ink.raw ? this.c : this.c.toDataURL('image/png'); }
}

// ---------- illustrations ----------
function artCover() {
  const k = new Ink(520, 380, 1);
  k.blob(260, 300, 200, 40, '#000', 0.15);
  k.potato(260, 190, 3.6, -0.15, '#e0ad5e', true);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.line([[260 + Math.cos(a) * 150, 190 + Math.sin(a) * 120], [260 + Math.cos(a) * 185, 190 + Math.sin(a) * 145]], 3, '#ffd25a'); }
  return k.done();
}
function artPick() {
  const k = new Ink(560, 360, 2);
  // furrows
  for (let i = 0; i < 4; i++) { const y = 220 + i * 36; const p = []; for (let x = 0; x <= 560; x += 40) p.push([x, y + Math.sin(x * 0.02 + i) * 5]); k.line(p, 1.6); k.wash([[0, y], [560, y], [560, y + 20], [0, y + 20]], '#8a5a30', 0.25); }
  for (let i = 0; i < 9; i++) k.potato(40 + i * 60 + k.jit(10), 236 + (i % 3) * 36, 0.55 + k.r() * 0.2, k.r() * 3);
  k.hand(300, 110, 1.3);
  k.potato(300, 60, 0.8, 0.3);
  k.arrow(380, 250, 320, 90, -40);
  k.text('clic / ✋', 450, 200, 30, '#b8471c', -0.1);
  return k.done();
}
function artBucket() {
  const k = new Ink(560, 360, 3);
  k.wash([[0, 250], [560, 250], [560, 360], [0, 360]], '#8a5a30', 0.3);
  for (let i = 0; i < 12; i++) k.potato(30 + i * 45, 285 + (i % 2) * 30, 0.5, k.r() * 3);
  k.bucket(200, 140, 1.4, 6);
  // magnet circle on ground
  k.x.setLineDash([10, 8]); k.ellipse(380, 300, 120, 32, 2.4); k.x.setLineDash([]);
  for (let i = 0; i < 4; i++) k.arrow(330 + i * 34, 290, 240, 110, 30 + i * 10, 2);
  k.text('maintenir', 420, 210, 30, '#b8471c', -0.08);
  return k.done();
}
function artBin() {
  const k = new Ink(560, 360, 4);
  const box = [[150, 170], [410, 170], [430, 320], [130, 320]];
  k.wash(box, '#b98a4c', 0.5); k.line(box.concat([box[0]]), 2.6);
  for (let y = 200; y < 320; y += 30) k.line([[136, y], [424, y]], 1.4);
  k.text('LE BAC', 280, 255, 34, '#6b3a1a');
  for (let i = 0; i < 6; i++) { const x = 60 + i * 24, y = 60 + Math.sin(i) * 20; k.potato(x + 200, y + 40 + i * 6, 0.45, i); }
  k.bucket(90, 90, 0.9, 2); k.x.save(); k.x.restore();
  k.arrow(140, 80, 260, 150, -50);
  k.text('près du bac : clic !', 420, 90, 28, '#b8471c', 0.06);
  return k.done();
}
function artJar() {
  const k = new Ink(560, 380, 5);
  // conveyor
  const belt = [[30, 300], [300, 120], [312, 138], [42, 318]]; k.wash(belt, '#555', 0.5); k.line(belt.concat([belt[0]]), 2.4);
  for (let i = 0; i < 6; i++) { const t = i / 6; k.potato(40 + t * 260, 294 - t * 180, 0.4, i); }
  for (let i = 0; i < 4; i++) k.line([[60 + i * 70, 310 - i * 47], [60 + i * 70, 360]], 2);
  // jar
  const jar = [[350, 130], [350, 340], [360, 352], [520, 352], [530, 340], [530, 130]];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) k.potato(377 + c * 42 + (r % 2) * 18, 330 - r * 28, 0.5, r + c);
  k.wash(jar, '#bfe3f2', 0.22); k.line(jar, 2.8); k.ellipse(440, 130, 92, 12, 2.4);
  k.line([[365, 150], [365, 320]], 3, '#ffffff', 1);
  // overflow
  k.potato(548, 360, 0.45, 1); k.potato(330, 368, 0.45, 2); k.arrow(470, 90, 540, 330, -30, 2);
  k.text('ça déborde !', 455, 60, 30, '#b8471c', 0.05);
  return k.done();
}
function artShop() {
  const k = new Ink(560, 380, 6);
  // awning
  for (let i = 0; i < 8; i++) { const x = 60 + i * 55; k.wash([[x, 40], [x + 55, 40], [x + 55, 100], [x, 100]], i % 2 ? '#f6ecd6' : '#c0392b', 0.55); }
  k.line([[60, 40], [500, 40], [500, 100], [60, 100], [60, 40]], 2.4);
  // Gérard
  k.blob(280, 230, 70, 90, '#a33a2a', 0.45); k.hatch(210, 160, 350, 320, 9, 0.8, 1);
  k.blob(280, 135, 42, 48, '#f2c49a', 0.6); k.ellipse(280, 135, 42, 48, 2.4);
  k.blob(280, 92, 46, 16, '#2a4a7a', 0.7); k.line([[236, 96], [330, 96], [345, 104]], 2.4);
  k.ellipse(266, 130, 9, 7, 2); k.ellipse(294, 130, 9, 7, 2); k.line([[275, 130], [285, 130]], 1.6);
  k.line([[258, 152], [270, 148], [280, 152], [290, 148], [302, 152]], 4, '#8a8580');
  // counter
  const ct = [[60, 280], [500, 280], [500, 360], [60, 360]]; k.wash(ct, '#7a4a22', 0.55); k.line(ct.concat([ct[0]]), 2.6);
  k.bucket(130, 245, 0.55); k.text('₣', 430, 260, 50, '#d99a1a');
  k.text('améliore tout !', 420, 340, 26, '#fff4dc', -0.04);
  return k.done();
}

// ---------- book ----------
export class Book {
  constructor(root) {
    this.root = root; this.book = root.querySelector('.book'); this.dots = root.querySelector('.book-dots');
    this.prevB = root.querySelector('.prev'); this.nextB = root.querySelector('.next');
    this.prevB.onclick = () => this.flip(-1); this.nextB.onclick = () => this.flip(1);
    root.querySelector('.book-close').onclick = () => this.close();
    this.built = false; this.cur = 0;
    addEventListener('keydown', e => { if (this.root.classList.contains('hidden')) return; if (e.key === 'ArrowRight') this.flip(1); if (e.key === 'ArrowLeft') this.flip(-1); if (e.key === 'Escape') { e.stopPropagation(); this.close(); } }, true);
    let sx = null; root.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) this.flip(dx < 0 ? 1 : -1); sx = null; });
  }
  _build() {
    const isTouch = document.body.classList.contains('touch');
    const K = (k) => `<span class="key">${k}</span>`;
    // pages in reading order: each leaf = [front, back]
    const P = [
      { cover: true, html: `<div class="cv-t">LE PETIT MANUEL<br>DU RÉCOLTEUR</div><img src="${artCover()}" alt=""><div class="cv-s">par Gérard Bouchard · édition 1987</div>` },
      { t: 'Bienvenue au désert !', s: 'avant-propos', art: null, html: `<div class="pg-text" style="font-family:Marker;font-size:clamp(12px,1.6vw,19px);line-height:1.6;margin-top:6%">Mon cher récolteur,<br><br>Ce désert est fait de patates. Des millions. Ton travail est simple : <b>ramasser</b>, <b>verser dans le bac</b>, et regarder mon <b>bocal géant</b> se remplir.<br><br>Quand il déborde… eh bien, il déborde. C’est le plus beau spectacle du canton.<br><br><span style="float:right">— Gérard</span></div>` },
      { t: '1. Ramasser', s: 'à la main', art: artPick(), html: `<div class="pg-text">Vise une patate et ${isTouch ? 'appuie sur <b>✋</b>' : `clique (${K('Clic')} ou ${K('E')})`}. Elle saute dans tes mains. Sans gants, tu en portes <b>3</b>. Les patates <b>dorées</b> valent 60 ₣ !</div>` },
      { t: '2. Le seau', s: 'beaucoup plus vite', art: artBucket(), html: `<div class="pg-text">Achète un seau chez Gérard, puis prends-le avec ${isTouch ? '<b>⇄</b>' : `${K('2')} ou la molette`}. <b>Maintiens</b> le bouton : toutes les patates autour du point visé volent dans le seau.</div>` },
      { t: '3. Le bac', s: 'verser la récolte', art: artBin(), html: `<div class="pg-text">Approche-toi du <b>bac en bois</b>, regarde-le et ${isTouch ? 'maintiens <b>✋</b>' : 'maintiens le clic'} : tes patates s’envolent dedans. ${isTouch ? '<b>↯</b>' : K('G')} lance tout devant toi.</div>` },
      { t: '4. Convoyeur & bocal', s: 'le grand spectacle', art: artJar(), html: `<div class="pg-text">La roue à aubes pose les patates sur le <b>convoyeur</b>. Chaque patate qui tombe dans le <b>bocal</b> te rapporte des francs. Plein ? Elles <b>débordent</b> et roulent partout !</div>` },
      { t: '5. Chez Gérard', s: 'la boutique', art: artShop(), html: `<div class="pg-text">Parle-moi au comptoir pour acheter : <b>seaux</b>, <b>gants</b>, <b>râteau aimanté</b>, <b>bottes</b>, <b>moteur</b> du convoyeur, <b>engrais</b> et <b>contrats</b> qui multiplient tes gains.</div>` },
      { t: 'Commandes', s: isTouch ? 'écran tactile' : 'clavier & souris', art: null, html: isTouch
        ? `<div class="pg-text" style="line-height:2.1">🕹️ Glisser à gauche : <b>marcher</b><br>👆 Glisser à droite : <b>regarder</b><br>✋ <b>Ramasser / verser / parler</b><br>⤒ <b>Sauter</b> · » <b>Courir</b><br>⇄ <b>Mains ⇄ seau</b> · ↯ <b>Lancer</b></div>`
        : `<div class="pg-text" style="line-height:2.05">${K('Z')}${K('Q')}${K('S')}${K('D')} / ${K('W')}${K('A')}${K('S')}${K('D')} marcher<br>${K('Maj')} courir · ${K('Espace')} sauter · ${K('C')} s’accroupir<br>${K('Clic')} / ${K('E')} ramasser · verser · parler<br>${K('1')} mains · ${K('2')} seau · ${K('G')} lancer<br>${K('Échap')} pause · 🎮 manette compatible</div>` },
      { t: 'Bonne récolte !', s: 'dernier conseil', art: null, html: `<div class="pg-text" style="font-family:Marker;font-size:clamp(12px,1.6vw,19px);line-height:1.6;margin-top:6%">Les patates <b>repoussent</b> toutes seules. L’engrais les fait repousser plus vite.<br><br>Et si un jour le bocal déborde vraiment beaucoup… marche dedans. Tu verras.<br><br><span style="float:right">— G.</span></div>` },
      { cover: true, html: `<div class="cv-t" style="font-size:clamp(18px,3vw,34px)">FIN</div><div class="cv-s">« Une patate à la fois. »</div>` },
    ];
    const leaves = Math.ceil(P.length / 2);
    this.leaves = [];
    for (let l = 0; l < leaves; l++) {
      const leaf = document.createElement('div'); leaf.className = 'leaf'; leaf.style.zIndex = String(leaves - l);
      leaf.append(this._page(P[l * 2], 'front', l * 2), this._page(P[l * 2 + 1], 'back', l * 2 + 1));
      const sh = document.createElement('div'); sh.className = 'shade'; leaf.appendChild(sh);
      this.book.appendChild(leaf); this.leaves.push(leaf);
    }
    this.dots.innerHTML = this.leaves.map(() => '<i></i>').join('') + '<i></i>';
    this.built = true;
  }
  _page(p, side, n) {
    const d = document.createElement('div'); d.className = 'page ' + side;
    if (!p) return d;
    if (p.cover) { d.classList.add('cover'); d.innerHTML = p.html; return d; }
    d.innerHTML = `<div class="pg-title">${p.t}<small>${p.s}</small></div>${p.art ? `<img class="pg-art" src="${p.art}" alt="">` : ''}${p.html}<div class="pg-num">— ${n} —</div>`;
    return d;
  }
  open() {
    if (!this.built) this._build();
    this.root.classList.remove('hidden'); audio.ui('open');
    this.cur = 0; this.leaves.forEach(l => l.classList.remove('flipped')); this._sync();
    this.onOpen?.();
  }
  close() { this.root.classList.add('hidden'); audio.ui('click'); this.onClose?.(); }
  flip(dir) {
    const n = this.cur + dir; if (n < 0 || n > this.leaves.length) return;
    const leaf = dir > 0 ? this.leaves[this.cur] : this.leaves[n];
    leaf.classList.add('turning'); setTimeout(() => leaf.classList.remove('turning'), 1000);
    if (dir > 0) { leaf.classList.add('flipped'); leaf.style.zIndex = String(100 + this.cur); }
    else { leaf.classList.remove('flipped'); setTimeout(() => (leaf.style.zIndex = String(this.leaves.length - n)), 520); }
    this.cur = n; audio.ui('page'); this._sync();
  }
  _sync() {
    // centre the closed book on its cover, open book in the middle, closed back at the end
    const shift = this.cur === 0 ? '-25%' : this.cur === this.leaves.length ? '25%' : '0%';
    this.book.style.transform = `rotateX(8deg) translateX(${shift})`; this.book.style.transition = 'transform 1s cubic-bezier(.45,.05,.2,1)';
    [...this.dots.children].forEach((d, i) => d.classList.toggle('on', i === this.cur));
    this.prevB.disabled = this.cur === 0; this.nextB.disabled = this.cur === this.leaves.length;
  }
}

// raw canvases of the illustrations (used by the 3D book)
export function artCanvases() {
  Ink.raw = true;
  try { return { cover: artCover(), pick: artPick(), bucket: artBucket(), bin: artBin(), jar: artJar(), shop: artShop() }; }
  finally { Ink.raw = false; }
}
