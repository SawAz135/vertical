import * as THREE from 'three';
import { Ink, artCanvases } from './book.js';
import { audio } from '../audio/audio.js';
import { rng, clamp, isTouch } from '../core/util.js';

// =====================================================================================
// THE 3D TUTORIAL BOOK — a real hardcover book held in the player's two hands, right in
// front of the camera, open on a two-page spread that fills the screen.
//  • choreography: rises from below while closed (cover facing you) → the cover swings
//    open around the spine → the book settles and breathes in your hands;
//  • click/tap the right page to turn forward, the left page to go back: the leaf lifts
//    from its outer corner, curls (the corner leads, the spine side follows), throws a
//    soft shadow on the pages under it and lands flat;
//  • on the last spread, a click closes the book (the left half folds over) and it is
//    lowered out of view.
// Pages are painted on canvases: aged paper, fibres, foxing, gutter shadow, inked
// watercolour illustrations, hand-lettered titles.
// =====================================================================================

const W = 0.2, H = 0.272, PW = 1024, PH = Math.round(1024 * H / W); // layout units
const CW = 896, CH = Math.round(CW * H / W), CK = CW / PW;              // actual canvas (lighter on GPU memory) // page size (m) + canvas
const SEG = 36; // leaf columns
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);

// ---------------- page painting ----------------
function paper(x, side, seed) {
  const r = rng(seed);
  const g = x.createLinearGradient(0, 0, PW, PH); g.addColorStop(0, '#f6ead0'); g.addColorStop(1, '#efdcb8');
  x.fillStyle = g; x.fillRect(0, 0, PW, PH);
  // fibres + speckles
  for (let k = 0; k < 900; k++) { x.strokeStyle = `rgba(120,90,50,${0.03 + r() * 0.05})`; x.lineWidth = 0.6 + r(); x.beginPath(); const px = r() * PW, py = r() * PH, a = r() * 6.28, l = 4 + r() * 14; x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  for (let k = 0; k < 500; k++) { x.fillStyle = `rgba(90,60,30,${0.05 + r() * 0.12})`; x.fillRect(r() * PW, r() * PH, 1 + r() * 1.6, 1 + r() * 1.6); }
  // foxing stains
  for (let k = 0; k < 7; k++) { const px = r() * PW, py = r() * PH, rr = 10 + r() * 46; const rg = x.createRadialGradient(px, py, 0, px, py, rr); rg.addColorStop(0, 'rgba(170,110,50,0.16)'); rg.addColorStop(0.7, 'rgba(170,110,50,0.06)'); rg.addColorStop(1, 'rgba(170,110,50,0)'); x.fillStyle = rg; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  // aged edges + gutter shadow (spine side)
  const e = x.createLinearGradient(side > 0 ? 0 : PW, 0, side > 0 ? PW : 0, 0);
  e.addColorStop(0, 'rgba(70,40,15,0.42)'); e.addColorStop(0.06, 'rgba(70,40,15,0.12)'); e.addColorStop(0.14, 'rgba(70,40,15,0)'); e.addColorStop(0.95, 'rgba(120,80,30,0)'); e.addColorStop(1, 'rgba(120,80,30,0.2)');
  x.fillStyle = e; x.fillRect(0, 0, PW, PH);
  const v = x.createLinearGradient(0, 0, 0, PH); v.addColorStop(0, 'rgba(120,80,30,0.16)'); v.addColorStop(0.04, 'rgba(120,80,30,0)'); v.addColorStop(0.96, 'rgba(120,80,30,0)'); v.addColorStop(1, 'rgba(120,80,30,0.18)');
  x.fillStyle = v; x.fillRect(0, 0, PW, PH);
}
function frame(x, r) {
  x.strokeStyle = 'rgba(107,58,26,0.55)'; x.lineWidth = 3; x.strokeRect(54, 54, PW - 108, PH - 108);
  x.lineWidth = 1.2; x.strokeRect(66, 66, PW - 132, PH - 132);
  // corner flourishes
  for (const [cx, cy, sx, sy] of [[66, 66, 1, 1], [PW - 66, 66, -1, 1], [66, PH - 66, 1, -1], [PW - 66, PH - 66, -1, -1]]) {
    x.beginPath(); x.moveTo(cx, cy + 40 * sy); x.quadraticCurveTo(cx + 6 * sx, cy + 6 * sy, cx + 40 * sx, cy); x.stroke();
    x.beginPath(); x.arc(cx + 14 * sx, cy + 14 * sy, 5, 0, 7); x.fillStyle = 'rgba(184,71,28,0.6)'; x.fill();
  }
  void r;
}
// rich text: **bold**, [k]key[/k] chips, \n new line
function richText(x, text, x0, y0, maxW, size, lh, col = '#3a2414') {
  const words = []; text.split('\n').forEach((line, li) => { if (li) words.push({ br: true }); line.split(' ').forEach(w => words.push({ w })); });
  let cx = x0, cy = y0, bold = false;
  for (const it of words) {
    if (it.br) { cx = x0; cy += lh; continue; }
    let w = it.w; if (!w) continue;
    const chips = w.match(/^\[k\](.*)\[\/k\](.*)$/);
    if (chips) {
      x.font = `700 ${size * 0.78}px Fred, system-ui, sans-serif`; const tw = x.measureText(chips[1]).width + size * 0.7;
      if (cx + tw > x0 + maxW) { cx = x0; cy += lh; }
      x.fillStyle = '#fff6e0'; x.strokeStyle = '#6b3a1a'; x.lineWidth = 3; x.beginPath(); x.roundRect(cx, cy - size * 0.86, tw, size * 1.12, 10); x.fill(); x.stroke();
      x.fillStyle = '#6b3a1a'; x.fillText(chips[1], cx + size * 0.35, cy - size * 0.05); cx += tw + size * 0.3;
      if (chips[2]) { x.font = `${bold ? 800 : 500} ${size}px Fred, system-ui, sans-serif`; x.fillStyle = col; x.fillText(chips[2], cx - size * 0.25, cy); cx += x.measureText(chips[2]).width; }
      continue;
    }
    const parts = w.split('**');
    let pieceW = 0; x.font = `500 ${size}px Fred, system-ui, sans-serif`;
    for (let k = 0; k < parts.length; k++) { x.font = `${(bold !== (k % 2 === 1)) ? 800 : 500} ${size}px Fred, system-ui, sans-serif`; pieceW += x.measureText(parts[k]).width; }
    if (cx + pieceW > x0 + maxW && cx > x0) { cx = x0; cy += lh; }
    for (let k = 0; k < parts.length; k++) {
      if (k > 0) bold = !bold;
      x.font = `${bold ? 800 : 500} ${size}px Fred, system-ui, sans-serif`; x.fillStyle = bold ? '#8a2e10' : col;
      x.fillText(parts[k], cx, cy); cx += x.measureText(parts[k]).width;
    }
    x.font = `500 ${size}px Fred, system-ui, sans-serif`; cx += x.measureText(' ').width;
  }
  return cy;
}
function titleBlock(x, t, sub, num) {
  x.textAlign = 'center'; x.fillStyle = '#6b3a1a'; x.font = `86px Marker, "Permanent Marker", cursive`; x.fillText(t, PW / 2, 190);
  x.font = 'italic 600 40px Georgia, serif'; x.fillStyle = 'rgba(107,58,26,0.75)'; x.fillText(sub, PW / 2, 248);
  // ink underline
  x.strokeStyle = '#b8471c'; x.lineWidth = 4; x.beginPath(); x.moveTo(PW / 2 - 170, 272); x.quadraticCurveTo(PW / 2, 262, PW / 2 + 170, 274); x.stroke();
  x.textAlign = 'center'; x.font = '34px Marker, cursive'; x.fillStyle = 'rgba(107,58,26,0.7)'; x.fillText(`— ${num} —`, PW / 2, PH - 92);
  x.textAlign = 'left';
}
function artDig() {
  const k = new Ink(560, 380, 9);
  // cross-section of the potato pile: golden layers on top, purple ones deep down
  k.wash([[0, 90], [560, 90], [560, 380], [0, 380]], '#8a5a30', 0.18);
  for (let row = 0; row < 6; row++) for (let i = 0; i < 9; i++) {
    const x = 32 + i * 62 + (row % 2) * 30 + k.jit(6), y = 110 + row * 46 + k.jit(4);
    if (i >= 3 && i <= 5 && row < 4 + (i === 4 ? 1 : 0)) continue; // the hole
    const purple = row >= 3 && k.r() < 0.18 + row * 0.05;
    k.potato(x, y, 0.62, (k.r() - 0.5) * 0.7, purple ? '#7a4a96' : '#e9b85a');
  }
  k.potato(280, 296, 0.75, 0.4, '#7a4a96'); k.potato(250, 330, 0.6, 1.9, '#e9b85a');
  k.line([[180, 92], [196, 160], [214, 250], [246, 330], [312, 340], [342, 250], [362, 160], [380, 92]], 2.6);
  k.arrow(470, 60, 330, 280, -50, 2.8);
  k.text('creuse !', 470, 40, 34, '#b8471c', 0.06);
  k.text('rare = 25 ₣', 120, 40, 30, '#7a4a96', -0.06);
  return k.c;
}

// ---------------- the book ----------------
export class Book3D {
  constructor(game) {
    this.g = game; this.cam = game.camera; this.open = false; this.built = false;
    this.root = new THREE.Group(); this.root.visible = false; this.cam.add(this.root);
    this.lamp = new THREE.PointLight(0xffe2b0, 0, 1.2, 1.4); this.lamp.layers.enable(1); this.lamp.position.set(0.05, 0.16, 0.12); this.cam.add(this.lamp);
    this.hint = document.createElement('div'); this.hint.className = 'book3d-hint hidden'; document.body.appendChild(this.hint);
    this._onDown = e => this._click(e);
    this._onKey = e => { if (!this.open || this.phase !== 'read') return; if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.next(); else if (e.key === 'ArrowLeft' || e.key === 'q' || e.key === 'a') this.prev(); else if (e.key === 'Escape') { e.stopPropagation(); this.close(); } };
    addEventListener('keydown', this._onKey, true);
  }
  // ---------- content ----------
  _pages() {
    const A = artCanvases(), touch = isTouch(), name = this.g.coop?.lastName || this.g.profileName?.() || 'toi';
    const K = s => `[k]${s}[/k]`;
    return [
      { plate: name },
      { letter: true, t: 'Bienvenue !', s: 'avant-propos', body: `Mon cher récolteur,\n\nCe désert est **fait de patates**. Des millions. Ton travail est simple : **ramasser**, **verser dans le bac**, et regarder mon **bocal géant** se remplir.\n\nQuand il déborde… eh bien, il déborde. C’est le plus beau spectacle du canton.` },
      { t: '1. Ramasser', s: 'à la main', art: A.pick, body: `Vise une patate et ${touch ? 'appuie sur **✋**' : `${K('Clic')} ou ${K('E')}`}. Elle saute dans tes mains. Sans gants, tu en portes **3**. Dessus, il n’y a que des **dorées**.` },
      { t: '2. Creuser', s: 'les violettes', art: artDig(), body: `Ramasse **toujours au même endroit** : une autre patate apparaît dessous. Plus tu creuses, plus tu as de chances de trouver une **violette**. Rare, et **25 fois plus chère** !` },
      { t: '3. Seau & outils', s: 'beaucoup plus vite', art: A.bucket, body: `Achète un **seau** chez Gérard (${touch ? '**⇄**' : `${K('2')}`}), puis **maintiens** : tout autour du point visé vole dedans. Plus tard : **aspirateur** ${touch ? '' : K('3')} et **canon** ${touch ? '' : K('4')}.` },
      { t: '4. Le bac', s: 'verser la récolte', art: A.bin, body: `Approche-toi du **bac en bois** au pied du bocal, regarde-le et ${touch ? 'maintiens **✋**' : 'maintiens le clic'} : tes patates s’envolent dedans. ${touch ? '**↯**' : K('G')} lance tout devant toi.` },
      { t: '5. Le bocal', s: 'le grand spectacle', art: A.jar, body: `Le tapis monte la spirale jusqu’au sommet **en une seconde**. Chaque patate qui tombe dans le **bocal** te rapporte des francs. Plein ? Elles **débordent** et roulent partout !` },
      { t: '6. Chez Gérard', s: 'la boutique', art: A.shop, body: `Parle-moi au comptoir : **seaux**, **gants**, **râteau aimanté**, **moteur** du tapis, **engrais** et **contrats** qui multiplient tes gains.` },
      { t: 'Commandes', s: touch ? 'écran tactile' : 'clavier & souris', body: touch
        ? `Glisser à gauche : **marcher**\nGlisser à droite : **regarder**\n**✋** ramasser · verser · parler\n**⤒** sauter · **»** courir\n**⇄** changer d’outil · **↯** lancer`
        : `${K('Z')} ${K('Q')} ${K('S')} ${K('D')} marcher\n${K('Maj')} courir · ${K('Espace')} sauter\n${K('Clic')} ${K('E')} ramasser · verser · parler\n${K('1')} ${K('2')} ${K('3')} ${K('4')} outils · ${K('G')} lancer\n${K('Échap')} pause` },
      { letter: true, t: 'Bonne récolte !', s: 'dernier conseil', body: `Les patates **repoussent** toutes seules, et l’engrais les fait repousser plus vite.\n\nEt si un jour le bocal déborde vraiment beaucoup… marche dedans. Tu verras.\n\n**Clique sur cette page pour fermer le livre.**`, sign: '— G.' },
    ];
  }
  _paint(p, idx) {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH; const x = c.getContext('2d'); x.scale(CK, CK);
    const side = idx % 2 === 0 ? -1 : 1; // even pages on the left
    paper(x, side, 100 + idx * 17);
    if (p.plate) { // inside cover: marbled endpaper + ex-libris plate
      const r = rng(5); x.globalAlpha = 0.5;
      for (let k = 0; k < 260; k++) { x.strokeStyle = ['#8a3a20', '#3a5a6a', '#c49a4a', '#5a2a3a'][k % 4]; x.lineWidth = 2 + r() * 6; x.beginPath(); let px = r() * PW, py = r() * PH; x.moveTo(px, py); for (let s = 0; s < 6; s++) { px += (r() - 0.5) * 120; py += (r() - 0.3) * 60; x.quadraticCurveTo(px + 40, py - 30, px, py); } x.stroke(); }
      x.globalAlpha = 1;
      const bx = 172, by = PH / 2 - 260, bw = PW - 344, bh = 520;
      x.fillStyle = '#f7ecd2'; x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = 24; x.shadowOffsetY = 8; x.fillRect(bx, by, bw, bh); x.shadowColor = 'transparent';
      x.strokeStyle = '#6b3a1a'; x.lineWidth = 5; x.strokeRect(bx + 18, by + 18, bw - 36, bh - 36); x.lineWidth = 1.5; x.strokeRect(bx + 30, by + 30, bw - 60, bh - 60);
      x.textAlign = 'center'; x.fillStyle = '#6b3a1a'; x.font = '70px Marker, cursive'; x.fillText('EX-LIBRIS', PW / 2, by + 130);
      const ink = new Ink(300, 200, 3); ink.potato(150, 100, 1.9, -0.2, '#e9b85a', true); x.drawImage(ink.c, PW / 2 - 150, by + 160);
      x.font = 'italic 36px Georgia, serif'; x.fillText('Ce manuel appartient à', PW / 2, by + 412);
      x.font = '62px Marker, cursive'; x.fillStyle = '#b8471c'; x.fillText(String(p.plate).slice(0, 18), PW / 2, by + 478);
      x.textAlign = 'left';
      return c;
    }
    frame(x);
    titleBlock(x, p.t, p.s, idx);
    let y = 330;
    if (p.art) { const aw = PW - 220, ah = aw * p.art.height / p.art.width; x.drawImage(p.art, 110, y, aw, ah); y += ah + 60; }
    else y += 40;
    const size = p.letter ? 48 : 46;
    if (p.letter) { x.font = '44px Marker, cursive'; }
    const end = richText(x, p.body, 120, y + 10, PW - 240, size, size * 1.45);
    if (p.sign) { x.textAlign = 'right'; x.font = '56px Marker, cursive'; x.fillStyle = '#6b3a1a'; x.fillText(p.sign, PW - 140, Math.min(PH - 170, end + 110)); x.textAlign = 'left'; }
    return c;
  }
  _pageTex(i) {
    if (i < 0 || i >= this.pageCv.length) return null;
    let t = this.texCache.get(i); if (!t) { t = this._tex(this.pageCv[i]); this.texCache.set(i, t); }
    return t;
  }
  _trimTex(keep) { for (const [i, t] of this.texCache) if (!keep.includes(i)) { t.dispose(); this.texCache.delete(i); } }
  _tex(canvas, flip = false) {
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    if (flip) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
    return t;
  }
  _coverTex() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * (H + 0.012) / (W + 0.008)); const x = c.getContext('2d'), w = c.width, h = c.height, r = rng(77);
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#6e2a16'); g.addColorStop(0.5, '#5a2010'); g.addColorStop(1, '#3e150a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 9000; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,220,180'},${0.03 + r() * 0.05})`; x.fillRect(r() * w, r() * h, 2 + r() * 3, 1 + r() * 2); } // leather grain
    for (let k = 0; k < 40; k++) { x.strokeStyle = `rgba(0,0,0,${0.08 + r() * 0.1})`; x.lineWidth = 1 + r() * 2; x.beginPath(); const px = r() * w, py = r() * h; x.moveTo(px, py); x.bezierCurveTo(px + r() * 80, py + r() * 40, px - r() * 60, py + r() * 90, px + r() * 40, py + r() * 120); x.stroke(); } // creases
    const gold = x.createLinearGradient(0, 0, w, h); gold.addColorStop(0, '#f8dd8a'); gold.addColorStop(0.45, '#c8932e'); gold.addColorStop(0.55, '#ffe9a8'); gold.addColorStop(1, '#a87420');
    x.strokeStyle = gold; x.lineWidth = 8; x.strokeRect(46, 46, w - 92, h - 92); x.lineWidth = 3; x.strokeRect(66, 66, w - 132, h - 132);
    x.fillStyle = gold; x.textAlign = 'center'; x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 6; x.shadowOffsetY = 4;
    x.font = '96px Marker, cursive'; x.fillText('LE PETIT MANUEL', w / 2, h * 0.24); x.fillText('DU RÉCOLTEUR', w / 2, h * 0.24 + 108);
    x.font = 'italic 44px Georgia, serif'; x.fillText('par Gérard Bouchard · 1987', w / 2, h * 0.86);
    x.shadowColor = 'transparent';
    // embossed gold potato medallion
    x.beginPath(); x.ellipse(w / 2, h * 0.56, 190, 140, -0.12, 0, 7); x.lineWidth = 7; x.strokeStyle = gold; x.stroke();
    x.beginPath(); x.ellipse(w / 2, h * 0.56, 150, 104, -0.12, 0, 7); x.fillStyle = 'rgba(248,221,138,0.85)'; x.fill();
    x.fillStyle = '#5a2010'; for (let k = 0; k < 6; k++) { x.beginPath(); x.ellipse(w / 2 - 80 + r() * 160, h * 0.56 - 50 + r() * 100, 7, 4, r() * 3, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  _build() {
    const pages = this._pages(); this.pageCv = pages.map((p, i) => this._paint(p, i)); this.texCache = new Map();
    // GPU textures are created only for the pages on screen and released afterwards (phones have little GPU memory)
    const self = this; this.tex = new Proxy([], { get: (t, k) => typeof k === 'string' && /^\d+$/.test(k) ? self._pageTex(+k) : t[k] }); this.texFlip = this.tex;
    this.spreads = Math.ceil(pages.length / 2); // spread k shows pages 2k (left) and 2k+1 (right)
    const R = this.root;
    const leather = new THREE.MeshStandardMaterial({ map: this._coverTex(), roughness: 0.62, metalness: 0.05 });
    const leatherIn = new THREE.MeshStandardMaterial({ color: 0x4a1a0c, roughness: 0.8 });
    const edgeC = document.createElement('canvas'); edgeC.width = 64; edgeC.height = 256; { const x = edgeC.getContext('2d'); x.fillStyle = '#e9d6ae'; x.fillRect(0, 0, 64, 256); for (let k = 0; k < 64; k += 2) { x.fillStyle = `rgba(120,90,50,${0.12 + Math.random() * 0.2})`; x.fillRect(k, 0, 1, 256); } }
    const edgeT = new THREE.CanvasTexture(edgeC); edgeT.colorSpace = THREE.SRGBColorSpace;
    const edge = new THREE.MeshStandardMaterial({ map: edgeT, roughness: 0.9 });
    this.paperMats = [];
    // paper: matte, a little self-lit (reading lamp) so it stays readable by day and by night without blowing out
    const pageMat = tex => { const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(0.2, 0.19, 0.17), color: new THREE.Color(0.6, 0.6, 0.6), roughness: 0.95, metalness: 0, envMapIntensity: 0.25 }); this.paperMats.push(m); return m; };
    const T = 0.011; this.T = T; // page block thickness per side
    // the two halves pivot on the spine (x = 0)
    const half = side => {
      const g = new THREE.Group();
      const board = new THREE.Mesh(new THREE.BoxGeometry(W + 0.008, H + 0.012, 0.0035), side < 0 ? [leatherIn, leatherIn, leatherIn, leatherIn, leatherIn, leather] : [leatherIn, leatherIn, leatherIn, leatherIn, leatherIn, leatherIn]);
      board.position.set(side * (W + 0.008) / 2, 0, -T - 0.0018); g.add(board);
      // page block with a gutter curve (pages dive into the spine)
      const blk = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, H - 0.002, T), edge); blk.position.set(side * (W / 2 + 0.018), 0, -T / 2 - 0.0016); g.add(blk); // kept clear of the gutter curve
      const top = new THREE.Mesh(this._curvedPage(side), pageMat(null)); top.position.z = 0.0002; g.add(top);
      return { g, top };
    };
    const L = half(-1), Rr = half(1);
    this.left = L; this.right = Rr; R.add(L.g, Rr.g);
    // spine: rounded leather back
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(T + 0.006, T + 0.006, H + 0.012, 24, 1, true, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ map: leather.map, roughness: 0.6, side: THREE.DoubleSide }));
    spine.position.set(0, 0, -T); R.add(spine); this.spine = spine;
    // the turning leaf (front = right page, back = next left page)
    const lg = new THREE.PlaneGeometry(W, H, SEG, 6); lg.translate(W / 2, 0, 0); this.leafBase = lg.attributes.position.array.slice();
    this.leafFront = new THREE.Mesh(lg, pageMat(null)); this.leafBack = new THREE.Mesh(lg, pageMat(null)); this.leafBack.material.side = THREE.BackSide;
    this.leafBack.material.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.x = 1.0 - vMapUv.x;\n#endif\n#ifdef USE_EMISSIVEMAP\nvEmissiveMapUv.x = 1.0 - vEmissiveMapUv.x;\n#endif'); };
    this.leafBack.material.customProgramCacheKey = () => 'wmp-leafback';
    this.leaf = new THREE.Group(); this.leaf.add(this.leafFront, this.leafBack); this.leaf.visible = false; this.leaf.position.z = 0.0016; R.add(this.leaf);
    // soft shadow the leaf throws on the pages below
    const sc = document.createElement('canvas'); sc.width = 256; sc.height = 4; { const x = sc.getContext('2d'); const gr = x.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 4); }
    const shT = new THREE.CanvasTexture(sc);
    this.shadowR = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: shT, transparent: true, opacity: 0, depthWrite: false })); this.shadowR.position.set(W / 2, 0, 0.0008); R.add(this.shadowR);
    this.shadowL = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: shT, transparent: true, opacity: 0, depthWrite: false })); this.shadowL.scale.x = -1; this.shadowL.position.set(-W / 2, 0, 0.0008); R.add(this.shadowL);
    R.traverse(o => { o.layers.set(1); if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.renderOrder = 60; o.material.fog = false; } });
    this.built = true;
  }
  _curvedPage(side) {
    const g = new THREE.PlaneGeometry(W, H, 24, 1); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + W / 2; // 0 at the spine … W at the edge
      const z = -0.0085 * Math.exp(-u / 0.012); // pages dive into the gutter; flat elsewhere so the turning leaf never intersects them
      p.setXYZ(i, side * u, p.getY(i), z);
    }
    if (side < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
    g.computeVertexNormals(); return g;
  }
  _map(m, t) { m.map = m.emissiveMap = t || null; m.needsUpdate = true; }
  _setSpread(k) {
    this._trimTex([2 * k - 2, 2 * k - 1, 2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 3]);
    const L = this.tex[2 * k], Rt = this.tex[2 * k + 1];
    this._map(this.left.top.material, L); this._map(this.right.top.material, Rt);
    this.left.top.material.needsUpdate = this.right.top.material.needsUpdate = true;
  }
  // leaf deformation: angle th (0 = lying on the right, π = on the left), curl lag of the outer edge
  _bendLeaf(th, curl) {
    const p = this.leafFront.geometry.attributes.position, b = this.leafBase, du = W / SEG;
    for (let row = 0; row <= 6; row++) {
      const v = row / 6; // 0 top … 1 bottom (PlaneGeometry rows go top→bottom)
      let x = 0, z = 0;
      for (let col = 0; col <= SEG; col++) {
        const i = row * (SEG + 1) + col, u = col / SEG;
        if (col > 0) {
          // the outer bottom corner leads the turn; the leaf arcs like real paper
          const lag = curl * Math.sin(th) * Math.pow(u, 1.4) * (0.75 + 0.5 * v);
          const a = th + lag;
          x += Math.cos(a) * du; z += Math.sin(a) * du;
        }
        p.setXYZ(i, x, b[i * 3 + 1], z);
      }
    }
    p.needsUpdate = true; this.leafFront.geometry.computeVertexNormals();
  }
  // ---------- layout: fit the open spread to the screen ----------
  _fit() {
    const fov = this.cam.fov * Math.PI / 180, asp = this.cam.aspect, th = Math.tan(fov / 2);
    const dW = (2 * W + 0.03) / 0.94 / (2 * th * asp), dH = (H + 0.02) / 0.86 / (2 * th);
    this.dist = Math.max(dW, dH, 0.12);
  }
  // ---------- API ----------
  show(onDone, { fromStart = true } = {}) {
    if (!this.built) this._build();
    this._fit(); this.onDone = onDone; this.open = true; this.root.visible = true; this.k = 0; this._setSpread(0);
    this.phase = 'intro'; this.t = 0; this.turn = null; this.coverA = Math.PI; // closed: left half folded over the right
    this.g.player.book = this; this.hint.classList.remove('hidden'); this._hint();
    addEventListener('pointerdown', this._onDown, true);
    audio.ui('open'); this.lamp.intensity = 0;
    void fromStart;
  }
  _hint() {
    const last = this.k >= this.spreads - 1;
    this.hint.innerHTML = this.phase === 'read'
      ? `<span>◀ page de gauche : reculer</span><b>${this.k + 1} / ${this.spreads}</b><span>${last ? 'page de droite : fermer le livre ✕' : 'page de droite : avancer ▶'}</span>`
      : '';
  }
  _click(e) {
    if (!this.open) return;
    if (e.target.closest && e.target.closest('button, .panel, #shop')) return;
    e.preventDefault(); e.stopPropagation();
    if (this.phase !== 'read') return;
    if (e.clientX > innerWidth / 2) this.next(); else this.prev();
  }
  next() {
    if (this.turn) return;
    if (this.k >= this.spreads - 1) { this.close(); return; }
    this.turn = { dir: 1, t: 0, from: this.k }; this._startTurn(); audio.ui('page');
  }
  prev() { if (this.turn || this.k <= 0) return; this.turn = { dir: -1, t: 0, from: this.k }; this._startTurn(); audio.ui('page'); }
  _startTurn() {
    const tr = this.turn, k = tr.from;
    if (tr.dir > 0) { // right page lifts: front = page 2k+1, back = page 2k+2; underneath: next right page
      this._map(this.leafFront.material, this.tex[2 * k + 1]); this._map(this.leafBack.material, this.texFlip[2 * k + 2]);
      this._map(this.right.top.material, this.tex[2 * k + 3]);
    } else { // left page lifts back: front = page 2k-1, back = 2k; underneath on the left: page 2k-2
      this._map(this.leafFront.material, this.tex[2 * k - 1]); this._map(this.leafBack.material, this.texFlip[2 * k]);
      this._map(this.left.top.material, this.tex[2 * k - 2]);
    }
    this.leafFront.material.needsUpdate = this.leafBack.material.needsUpdate = this.right.top.material.needsUpdate = this.left.top.material.needsUpdate = true;
    this.leaf.visible = true;
  }
  close() { if (this.phase !== 'read' || this.turn) return; this.phase = 'outro'; this.t = 0; audio.ui('click'); this._hint(); }
  _finish() {
    this.open = false; this.root.visible = false; this.lamp.intensity = 0; this.hint.classList.add('hidden');
    removeEventListener('pointerdown', this._onDown, true); this.g.player.book = null;
    this._trimTex([]); // free all page textures until the book is opened again
    const cb = this.onDone; this.onDone = null; cb?.();
  }
  // where each hand holds the book (camera space): wrist position + hand orientation.
  // The palm presses on the back cover, the fingers spread behind the book, the thumb
  // wraps over the edge onto the page.
  grip(side, pos, quat) {
    const G = this.gripCfg || (this.gripCfg = { x: 0.006, y: -0.014, z: -0.034, up: 0.75, tilt: 0.12 });
    pos.set(side * (W + G.x), -H / 2 + G.y, G.z).applyMatrix4(this.root.matrix);
    const Z = _Z.set(side * 1, -G.up, G.tilt).normalize(), Y = _Y.set(0, 0, -1);
    Y.addScaledVector(Z, -Y.dot(Z)).normalize(); const X = _X.crossVectors(Y, Z);
    _M4.makeBasis(X, Y, Z); quat.setFromRotationMatrix(_M4).premultiply(this.root.quaternion);
    return pos;
  }
  update(dt, t) {
    if (!this.open) return;
    this.t += dt;
    this._fit(); // the camera fov can change (menu → play, sprint): keep the spread framed
    const R = this.root, d = this.dist;
    let y = 0, z = -d, rx = -0.08, ry = 0, rz = 0, s = 1;
    if (this.phase === 'intro') {
      const a = clamp(this.t / 0.75, 0, 1), b = clamp((this.t - 0.75) / 0.95, 0, 1);
      // rise from below, closed, slightly turned; then the cover swings open while the book centres
      y = -0.42 * (1 - easeOut(a)) - 0.02 * (1 - b); z = -d - 0.06 * (1 - b); rx = -0.5 * (1 - easeOut(a)) - 0.08; ry = 0.25 * (1 - ease(b)); rz = 0.08 * (1 - easeOut(a));
      R.position.x = -W / 2 * (1 - ease(b)); // closed book is centred on its cover
      this.coverA = Math.PI * (1 - ease(b));
      if (b > 0 && !this.cOpenSnd) { this.cOpenSnd = 1; audio.ui('page'); }
      if (b >= 1) { this.phase = 'read'; this.cOpenSnd = 0; this._hint(); }
      this.lamp.intensity = 0.3 * a;
    } else if (this.phase === 'outro') {
      const a = clamp(this.t / 0.7, 0, 1), b = clamp((this.t - 0.6) / 0.6, 0, 1);
      this.coverA = Math.PI * ease(a); R.position.x = -W / 2 * ease(a);
      y = -0.5 * ease(b); rx = -0.08 - 0.6 * ease(b); rz = -0.1 * ease(b);
      this.lamp.intensity = 0.3 * (1 - b);
      if (b >= 1) { this._finish(); return; }
    } else R.position.x = 0;
    // breathing hands: tiny sway
    y += Math.sin(t * 1.3) * 0.0025; rz += Math.sin(t * 0.9) * 0.008; rx += Math.sin(t * 1.1) * 0.006;
    R.position.y = y - 0.004; R.position.z = z; R.rotation.set(rx, ry, rz); R.scale.setScalar(s);
    // left half pivots on the spine (cover open/close)
    this.left.g.rotation.y = this.coverA * 0.999;
    this.shadowL.visible = this.coverA < 0.05;
    // page turn
    if (this.turn) {
      const tr = this.turn; tr.t += dt / 0.82; const k = ease(clamp(tr.t, 0, 1));
      const th = tr.dir > 0 ? k * Math.PI : (1 - k) * Math.PI;
      this._bendLeaf(th, tr.dir > 0 ? 0.55 : -0.55);
      const sh = Math.sin(th);
      this.shadowR.material.opacity = th < Math.PI / 2 ? sh * 0.5 : 0; this.shadowL.material.opacity = th >= Math.PI / 2 ? sh * 0.5 : 0;
      if (tr.t >= 1) {
        this.k += tr.dir; this.turn = null; this.leaf.visible = false; this._setSpread(this.k);
        this.shadowR.material.opacity = this.shadowL.material.opacity = 0; this._hint();
      }
    }
    R.updateMatrix();
  }
}

const _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3(), _M4 = new THREE.Matrix4();
