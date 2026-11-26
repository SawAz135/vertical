/* =====================================================================
   Roblox Forge · Jouer — Roblox GUI → HTML.
   Every ScreenGui / BillboardGui in the PlayerGui is laid out with
   Roblox's own rules (UDim2 Position / Size, AnchorPoint, Rotation,
   UIPadding, UIListLayout, UIGridLayout, UIScale, UIAspectRatioConstraint,
   UISizeConstraint, AutomaticSize, ScrollingFrame canvas, ClipsDescendants,
   ZIndex) into pixel rectangles, then drawn as absolutely placed DOM
   elements: backgrounds, borders, UICorner, UIStroke (border + text),
   UIGradient, text (Roblox fonts, TextScaled, wrapping, alignment, stroke,
   RichText), images (asset images cannot be downloaded: a soft tint).
   Buttons fire MouseButton1Click / Activated / MouseEnter… on the client.
   Rects are also what scripts read back as AbsolutePosition/AbsoluteSize.
   ===================================================================== */
import { isA, EnumItem, Vector2, Color3 } from '../luau/engine.js?v=12';
import { ViewportRenderer } from './viewport.js?v=12';
import { assetId, imageURL } from '../assets.js?v=12';

const FONT = { FredokaOne: '"F-Fredoka","Fredoka One",system-ui', Fredoka: '"F-Fredoka",system-ui', GothamBlack: '"F-Mont",system-ui', GothamBold: '"F-Mont",system-ui', GothamMedium: '"F-Mont",system-ui', Gotham: '"F-Mont",system-ui', GothamSemibold: '"F-Mont",system-ui',
  BuilderSans: '"F-Mont",system-ui', BuilderSansBold: '"F-Mont",system-ui', BuilderSansExtraBold: '"F-Mont",system-ui', Montserrat: '"F-Mont",system-ui', LuckiestGuy: '"F-Luckiest",system-ui', Bangers: '"F-Bangers",system-ui', PermanentMarker: '"F-Marker",system-ui',
  Creepster: '"F-Creepster",system-ui', Michroma: '"F-Michroma",system-ui', Oswald: '"F-Oswald",system-ui', PressStart2P: '"F-Press",monospace', Arcade: '"F-Press",monospace', Cartoon: '"F-Fredoka",system-ui', Highway: '"F-Oswald",system-ui',
  SciFi: '"F-Orbitron",system-ui', Orbitron: '"F-Orbitron",system-ui', Code: 'ui-monospace,monospace', RobotoMono: 'ui-monospace,monospace', SourceSans: 'system-ui,sans-serif', SourceSansBold: 'system-ui,sans-serif', SourceSansSemibold: 'system-ui,sans-serif', Legacy: 'system-ui,sans-serif', Arial: 'Arial,sans-serif', ArialBold: 'Arial,sans-serif' };
const BOLD = /Bold|Black|Heavy|ExtraBold|Semibold|FredokaOne|Luckiest|Bangers/;
const rgba = (c, t = 0) => (c instanceof Color3 ? `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${Math.max(0, Math.min(1, 1 - t))})` : `rgba(0,0,0,${1 - t})`);
const en = (v, d) => (v instanceof EnumItem ? v.name : d);
const ud = (u, size, scaleK = 1) => (u ? u.f.Scale * size + u.f.Offset * scaleK : 0);
let measureCtx = null; const textWidth = (txt, px, font) => { measureCtx ||= document.createElement('canvas').getContext('2d'); measureCtx.font = `700 ${px}px ${font}`; return measureCtx.measureText(txt).width; };
/* TextScaled like Roblox: the biggest size whose word-wrapped text fits the box (measured by the browser itself) */
let fitBox = null;
function fitText(html, plain, f, w, h, lh, minS, maxS) {
  if (!fitBox) { fitBox = document.createElement('div'); fitBox.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre-wrap;overflow-wrap:normal;word-break:normal;'; document.body.appendChild(fitBox); }
  const b = fitBox; b.style.fontFamily = f.css; b.style.fontWeight = f.weight; b.style.lineHeight = lh; b.style.width = w + 'px'; if (html) b.innerHTML = html; else b.textContent = plain || ' ';
  const fits = (px) => { b.style.fontSize = px + 'px'; return b.scrollHeight <= h + 0.5 && b.scrollWidth <= w + 0.5; };
  let lo = minS, hi = Math.max(minS, Math.min(maxS, h)); if (fits(hi)) return hi;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; } return Math.max(minS, Math.floor(lo * 4) / 4);
}
function fontOf(o) { const F = o.props.get('FontFace') || o.props.get('Font'); let fam = 'Legacy', weight = 400;
  if (F instanceof EnumItem) fam = F.name; else if (F && F.f) { const s = String(F.f.Family || ''); fam = (s.match(/\/([A-Za-z0-9]+)\.json$/) || [, s])[1] || 'Legacy'; const w = F.f.Weight; weight = w instanceof EnumItem ? ({ Thin: 100, Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Heavy: 900 }[w.name] || 400) : 400; }
  return { css: FONT[fam] || FONT[fam.replace(/[^A-Za-z]/g, '')] || 'system-ui,sans-serif', weight: BOLD.test(fam) ? Math.max(weight, 700) : weight }; }
function richToHtml(s) {
  const esc = (t) => t.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let out = '', i = 0; const re = /<(\/?)(b|i|u|s|br|font|stroke|uppercase|uc|smallcaps|sc|mark)([^>]*)>/gi; let m;
  while ((m = re.exec(s))) { out += esc(s.slice(i, m.index)); i = re.lastIndex; const close = m[1], tag = m[2].toLowerCase(), attrs = m[3];
    if (tag === 'br') { out += '<br>'; continue; } if (close) { out += tag === 'b' ? '</b>' : tag === 'i' ? '</i>' : tag === 'u' ? '</u>' : tag === 's' ? '</s>' : '</span>'; continue; }
    if (tag === 'b' || tag === 'i' || tag === 'u' || tag === 's') { out += `<${tag}>`; continue; }
    const st = []; const col = attrs.match(/color\s*=\s*["']?(#[0-9a-f]{3,8}|rgb\([^)]*\))/i); if (col) st.push((tag === 'stroke' ? '--sk:' : 'color:') + col[1]);
    const sz = attrs.match(/size\s*=\s*["']?(\d+)/i); if (sz) st.push('font-size:' + sz[1] + 'px'); const tr = attrs.match(/transparency\s*=\s*["']?([\d.]+)/i); if (tr) st.push('opacity:' + (1 - +tr[1]));
    if (tag === 'uppercase' || tag === 'uc') st.push('text-transform:uppercase'); if (tag === 'mark') st.push('background:' + (col ? col[1] : '#ff0')); out += `<span style="${st.join(';')}">`; }
  return out + esc(s.slice(i));
}

/* Roblox images (rbxassetid://123, http://www.roblox.com/asset/?id=123, a Decal id…) of any place: shown straight
   from the asset relay (the original picture, a Decal resolved to its image), kept by the browser's HTTP cache.
   The picture's real pixel size is measured once, for sprite sheets (ImageRectOffset / ImageRectSize) and 9-slices. */
export const Assets = {
  listeners: new Set(), dims: new Map(), bad: new Set(), loading: new Set(), timer: 0,
  id(src) { return assetId(src); },
  local: new Set(), ready: fetch('assets/rbx/index.json').then((r) => r.json()).then((l) => { for (const i of l) Assets.local.add(String(i)); Assets.changed(); }).catch(() => {}),
  url(src) { const id = this.id(src); if (!id || this.bad.has(id)) return null; const u = this.local.has(id) ? 'assets/rbx/' + id + '.png' : imageURL(id); this.measure(id, u); return u; },
  size(src) { const id = this.id(src); return (id && this.dims.get(id)) || null; },
  measure(id, u) { if (this.dims.has(id) || this.loading.has(id) || typeof Image === 'undefined') return; this.loading.add(id); const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { this.loading.delete(id); this.dims.set(id, { w: im.naturalWidth || 420, h: im.naturalHeight || 420 }); this.changed(); };
    im.onerror = () => { this.loading.delete(id); this.bad.add(id); this.changed(); }; im.src = u; },
  changed() { clearTimeout(this.timer); this.timer = setTimeout(() => { for (const f of this.listeners) f(); }, 30); },
};
export class GuiRenderer {
  constructor(engine, root, { camera, world } = {}) {
    this.E = engine; this.root = root; this.camera = camera; this.world = world; this.els = new Map(); this.rects = new Map(); this.frameN = 0; this.hover = null;
    this.vp = new ViewportRenderer();
    this.layer = document.createElement('div'); this.layer.className = 'rbx-gui'; root.appendChild(this.layer);
    this.bb = document.createElement('div'); this.bb.className = 'rbx-bb'; root.insertBefore(this.bb, this.layer);
    engine.rt.guiMeasure = (o) => this.rects.get(o) || null;
    this.onAssets = () => { for (const el of this.els.values()) el.$imk = null; }; Assets.listeners.add(this.onAssets);
  }
  /* ---------------- layout: Roblox rules → pixel rects ---------------- */
  layout(W, H, inset) {
    this.rects = new Map(); this.W = W; this.H = H; this.inset = inset;
    const pg = this.E.player && this.E.player.child('PlayerGui'); if (!pg) return [];
    const guis = pg.kids.filter((g) => g.cls === 'ScreenGui' && g.props.get('Enabled') !== false).sort((a, b) => (a.props.get('DisplayOrder') || 0) - (b.props.get('DisplayOrder') || 0));
    for (const g of guis) { const si = g.props.get('ScreenInsets'), ign = !!g.props.get('IgnoreGuiInset'); // ScreenInsets wins when set: CoreUISafeInsets keeps clear of the Roblox topbar, DeviceSafeInsets / None do not
      const top = si instanceof EnumItem ? (si.name === 'CoreUISafeInsets' ? inset : 0) : ign ? 0 : inset;
      const r = [0, top, W, H - top]; this.rects.set(g, [...r, 1]); this.layoutKids(g, r, this.scaleOf(g)); }
    return guis;
  }
  scaleOf(o) { const u = o.kids.find((c) => c.cls === 'UIScale'); return u ? (u.props.get('Scale') ?? 1) : 1; }
  pad(o, r, sc) { const p = o.kids.find((c) => c.cls === 'UIPadding'); if (!p) return r; const P = p.props; const L = ud(P.get('PaddingLeft'), r[2], sc), R = ud(P.get('PaddingRight'), r[2], sc), T = ud(P.get('PaddingTop'), r[3], sc), B = ud(P.get('PaddingBottom'), r[3], sc);
    return [r[0] + L, r[1] + T, Math.max(0, r[2] - L - R), Math.max(0, r[3] - T - B)]; }
  sizeOf(o, pr, sc) {
    const S = o.props.get('Size'); const sk = en(o.props.get('SizeConstraint'), 'RelativeXY'); const pw = sk === 'RelativeYY' ? pr[3] : pr[2], ph = sk === 'RelativeXX' ? pr[2] : pr[3];
    let w = S ? S.f.X.f.Scale * pw + S.f.X.f.Offset * sc : 0, h = S ? S.f.Y.f.Scale * ph + S.f.Y.f.Offset * sc : 0;
    const cons = o.kids.find((c) => c.cls === 'UISizeConstraint'); if (cons) { const mn = cons.props.get('MinSize'), mx = cons.props.get('MaxSize'); if (mn) { w = Math.max(w, mn.x * sc); h = Math.max(h, mn.y * sc); } if (mx) { w = Math.min(w, mx.x * sc); h = Math.min(h, mx.y * sc); } }
    const ar = o.kids.find((c) => c.cls === 'UIAspectRatioConstraint'); if (ar) { const ratio = ar.props.get('AspectRatio') || 1, dom = en(ar.props.get('DominantAxis'), 'Width'), at = en(ar.props.get('AspectType'), 'FitWithinMaxSize');
      if (at === 'ScaleWithParentSize') { if (dom === 'Width') h = w / ratio; else w = h * ratio; } else if (w / Math.max(1e-6, h) > ratio) w = h * ratio; else h = w / ratio; }
    return [w, h];
  }
  layoutKids(parent, pr, sc) {
    const inner = this.pad(parent, pr, sc);
    let kids = parent.kids.filter((k) => isA(k.cls, 'GuiObject'));
    const list = parent.kids.find((k) => k.cls === 'UIListLayout'), grid = parent.kids.find((k) => k.cls === 'UIGridLayout');
    if (list || grid) {
      const L = (list || grid).props; const order = en(L.get('SortOrder'), 'LayoutOrder'); kids = kids.filter((k) => k.props.get('Visible') !== false);
      kids.sort((a, b) => (order === 'Name' ? String(a.props.get('Name')).localeCompare(String(b.props.get('Name'))) : (a.props.get('LayoutOrder') || 0) - (b.props.get('LayoutOrder') || 0)));
      const dir = en(L.get('FillDirection'), grid ? 'Horizontal' : 'Vertical'), ha = en(L.get('HorizontalAlignment'), 'Left'), va = en(L.get('VerticalAlignment'), 'Top');
      if (list) {
        const padU = L.get('Padding'), gap = ud(padU, dir === 'Vertical' ? inner[3] : inner[2], sc); const sizes = kids.map((k) => this.autoSize(k, this.sizeOf(k, inner, sc), sc));
        const total = sizes.reduce((s, z) => s + (dir === 'Vertical' ? z[1] : z[0]), 0) + gap * Math.max(0, kids.length - 1);
        let cur = dir === 'Vertical' ? inner[1] + (va === 'Center' ? (inner[3] - total) / 2 : va === 'Bottom' ? inner[3] - total : 0) : inner[0] + (ha === 'Center' ? (inner[2] - total) / 2 : ha === 'Right' ? inner[2] - total : 0);
        kids.forEach((k, i) => { const [w, h] = sizes[i]; let x, y;
          if (dir === 'Vertical') { y = cur; x = inner[0] + (ha === 'Center' ? (inner[2] - w) / 2 : ha === 'Right' ? inner[2] - w : 0); cur += h + gap; }
          else { x = cur; y = inner[1] + (va === 'Center' ? (inner[3] - h) / 2 : va === 'Bottom' ? inner[3] - h : 0); cur += w + gap; }
          this.place(k, [x, y, w, h], sc); });
      } else {
        const cs = L.get('CellSize'), cp = L.get('CellPadding'); const cw = ud(cs && cs.f.X, inner[2], sc), ch = ud(cs && cs.f.Y, inner[3], sc), gx = ud(cp && cp.f.X, inner[2], sc), gy = ud(cp && cp.f.Y, inner[3], sc);
        const maxPer = L.get('FillDirectionMaxCells') || 0; let per = dir === 'Horizontal' ? Math.max(1, Math.floor((inner[2] + gx) / (cw + gx))) : Math.max(1, Math.floor((inner[3] + gy) / (ch + gy))); if (maxPer > 0) per = Math.min(per, maxPer);
        const rows = Math.ceil(kids.length / per), usedW = dir === 'Horizontal' ? Math.min(kids.length, per) * (cw + gx) - gx : rows * (cw + gx) - gx;
        const x0 = inner[0] + (ha === 'Center' ? (inner[2] - usedW) / 2 : ha === 'Right' ? inner[2] - usedW : 0);
        kids.forEach((k, i) => { const a = i % per, b = Math.floor(i / per); const [cx, cy] = dir === 'Horizontal' ? [a, b] : [b, a]; this.place(k, [x0 + cx * (cw + gx), inner[1] + cy * (ch + gy), cw, ch], sc); });
      }
      for (const k of parent.kids.filter((k) => isA(k.cls, 'GuiObject') && k.props.get('Visible') === false)) this.place(k, [0, 0, 0, 0], sc, true);
      return;
    }
    for (const k of kids) {
      let [w, h] = this.sizeOf(k, inner, sc); [w, h] = this.autoSize(k, [w, h], sc);
      const Pp = k.props.get('Position'), A = k.props.get('AnchorPoint') || new Vector2();
      const x = inner[0] + (Pp ? Pp.f.X.f.Scale * inner[2] + Pp.f.X.f.Offset * sc : 0) - A.x * w, y = inner[1] + (Pp ? Pp.f.Y.f.Scale * inner[3] + Pp.f.Y.f.Offset * sc : 0) - A.y * h;
      this.place(k, [x, y, w, h], sc);
    }
  }
  autoSize(o, [w, h], sc) {
    const a = en(o.props.get('AutomaticSize'), 'None'); if (a === 'None') return [w, h];
    let cw = 0, ch = 0;
    if (/^Text/.test(o.cls)) { const ts = (o.props.get('TextSize') || 14) * sc, f = fontOf(o), txt = String(o.props.get('ContentText') ?? o.props.get('Text') ?? '').replace(/<[^>]+>/g, ''); cw = textWidth(txt, ts, f.css) + 4; ch = ts * 1.2 * Math.max(1, txt.split('\n').length); }
    const kids = o.kids.filter((k) => isA(k.cls, 'GuiObject') && k.props.get('Visible') !== false); const list = o.kids.find((k) => k.cls === 'UIListLayout');
    if (list) { const dir = en(list.props.get('FillDirection'), 'Vertical'), gap = ud(list.props.get('Padding'), 0, sc); let sw = 0, sh = 0; for (const k of kids) { const s = this.autoSize(k, this.sizeOf(k, [0, 0, w, h], sc), sc); if (dir === 'Vertical') { sh += s[1] + gap; sw = Math.max(sw, s[0]); } else { sw += s[0] + gap; sh = Math.max(sh, s[1]); } } cw = Math.max(cw, sw - (dir === 'Vertical' ? 0 : gap)); ch = Math.max(ch, sh - (dir === 'Vertical' ? gap : 0)); }
    else for (const k of kids) { const s = this.sizeOf(k, [0, 0, w, h], sc), P = k.props.get('Position'); cw = Math.max(cw, (P ? P.f.X.f.Offset * sc : 0) + s[0]); ch = Math.max(ch, (P ? P.f.Y.f.Offset * sc : 0) + s[1]); }
    const p = o.kids.find((c) => c.cls === 'UIPadding'); if (p) { cw += ud(p.props.get('PaddingLeft'), 0, sc) + ud(p.props.get('PaddingRight'), 0, sc); ch += ud(p.props.get('PaddingTop'), 0, sc) + ud(p.props.get('PaddingBottom'), 0, sc); }
    return [a === 'X' || a === 'XY' ? Math.max(w, cw) : w, a === 'Y' || a === 'XY' ? Math.max(h, ch) : h];
  }
  place(o, r, psc, hidden) {
    const sc = psc * this.scaleOf(o); if (sc !== psc) { const A = o.props.get('AnchorPoint') || new Vector2(), k = sc / psc; const cx = r[0] + A.x * r[2], cy = r[1] + A.y * r[3]; r = [cx - (cx - r[0]) * k, cy - (cy - r[1]) * k, r[2] * k, r[3] * k]; }
    this.rects.set(o, [r[0], r[1], r[2], r[3], sc, hidden || o.props.get('Visible') === false]);
    if (o.cls === 'ScrollingFrame') { const cs = o.props.get('CanvasSize'), cp = o.props.get('CanvasPosition') || new Vector2(); let cw = ud(cs && cs.f.X, r[2], sc), ch = ud(cs && cs.f.Y, r[3], sc);
      const auto = en(o.props.get('AutomaticCanvasSize'), 'None'); const canvas = [r[0] - cp.x, r[1] - cp.y, Math.max(cw, r[2] - (auto !== 'None' ? 0 : 0)), Math.max(ch, 0)];
      this.layoutKids(o, canvas, sc); if (auto !== 'None') { let maxY = 0, maxX = 0; for (const d of o.kids) { const rr = this.rects.get(d); if (rr) { maxY = Math.max(maxY, rr[1] + rr[3] - canvas[1]); maxX = Math.max(maxX, rr[0] + rr[2] - canvas[0]); } } o.autoCanvas = [maxX, maxY]; } else o.autoCanvas = [cw, ch];
      return; }
    this.layoutKids(o, r, sc);
  }
  /* ---------------- drawing ---------------- */
  render(W, H, inset) {
    this.frameN++; const guis = this.layout(W, H, inset); const seen = new Set();
    let z = 0; for (const g of guis) { z += 1000; this.drawTree(g, this.layer, seen, z); }
    for (const [o, el] of this.els) if (!seen.has(o)) { el.remove(); this.els.delete(o); if (o.cls === 'ViewportFrame') this.vp.drop(o); }
    this.billboards(seen); this.surfaces(seen);
  }
  /* ---------------- SurfaceGuis (on a face of a part) ----------------
     laid out flat at their canvas size, then projected on the face with a CSS perspective transform
     (the homography that sends the canvas corners to the face corners on screen); buttons stay clickable */
  surfaces(seen) {
    const cam = this.camera; if (!cam || !this.world) return; const T = this.world.THREE, W = this.W, H = this.H; const sgs = []; const pg = this.E.player && this.E.player.child('PlayerGui');
    const scan = (o) => { for (const k of o.kids) { if (k.cls === 'SurfaceGui' && k.props.get('Enabled') !== false) sgs.push(k); if (k.kids.length && !isA(k.cls, 'GuiObject')) scan(k); } };
    scan(this.E.workspace); if (pg) for (const k of pg.kids) if (k.cls === 'SurfaceGui' && k.props.get('Enabled') !== false) sgs.push(k);
    for (const g of sgs) {
      const part = g.props.get('Adornee') || g.parent; const cf = part && part.props && part.props.get('CFrame'), size = part && part.props && part.props.get('Size'); if (!cf || !size) continue;
      const face = (g.props.get('Face') && g.props.get('Face').name) || 'Front'; const F = SURFACE_FACES[face] || SURFACE_FACES.Front; const fw = Math.abs(F.r[0] * size.x + F.r[1] * size.y + F.r[2] * size.z), fh = Math.abs(F.u[0] * size.x + F.u[1] * size.y + F.u[2] * size.z);
      const ppsMode = g.props.get('SizingMode'); const pps = g.props.get('PixelsPerStud') ?? 50; const cs = g.props.get('CanvasSize');
      const cw = ppsMode && ppsMode.name === 'PixelsPerStud' ? fw * pps : cs ? cs.x : 800, ch = ppsMode && ppsMode.name === 'PixelsPerStud' ? fh * pps : cs ? cs.y : 600;
      const half = [size.x / 2, size.y / 2, size.z / 2], off = (g.props.get('ZOffset') || 0) * 0.01 + 0.01; const c = [F.n[0] * (half[0] + off), F.n[1] * (half[1] + off), F.n[2] * (half[2] + off)];
      const corner = (sx, sy) => { const l = [c[0] + F.r[0] * fw / 2 * sx + F.u[0] * fh / 2 * sy, c[1] + F.r[1] * fw / 2 * sx + F.u[1] * fh / 2 * sy, c[2] + F.r[2] * fw / 2 * sx + F.u[2] * fh / 2 * sy];
        const w = cf.pointToWorld({ x: l[0], y: l[1], z: l[2] }); return new T.Vector3(w.x, w.y, w.z); };
      const pts = [corner(-1, 1), corner(1, 1), corner(-1, -1), corner(1, -1)];
      // only the front of the face shows it, and only in front of the camera
      const n = cf.vecToWorld({ x: F.n[0], y: F.n[1], z: F.n[2] }); const toCam = cam.position.clone().sub(pts[0]); if (toCam.x * n.x + toCam.y * n.y + toCam.z * n.z <= 0) continue;
      const dist = cam.position.distanceTo(pts[0]); if (dist > (g.props.get('MaxDistance') || Infinity)) continue;
      // hidden behind walls (checked a few times a second), unless AlwaysOnTop
      if (!g.props.get('AlwaysOnTop') && this.world.raycast) { if (!g.$occT || this.frameN - g.$occT > 6) { g.$occT = this.frameN; const ctr = pts[0].clone().add(pts[3]).multiplyScalar(0.5), dir = ctr.clone().sub(cam.position), len = dir.length();
          const V = this.E.Vector3, hit = this.world.raycast(new V(cam.position.x, cam.position.y, cam.position.z), new V(dir.x / len * (len - 0.3), dir.y / len * (len - 0.3), dir.z / len * (len - 0.3)), null); const hi = hit && hit.props.get('Instance');
          g.$occ = !!(hi && hi !== part && !(part.cls === 'Model' && part.descendants().includes(hi))); } if (g.$occ) continue; }
      const scr = []; let behind = false; for (const p of pts) { const q = p.clone().applyMatrix4(cam.matrixWorldInverse); if (q.z > -0.05) { behind = true; break; } const v = p.clone().project(cam); scr.push([(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H]); } if (behind) continue;
      const r = [0, 0, cw, ch]; this.rects.set(g, [...r, 1]); seen.add(g);
      let el = this.els.get(g); if (!el) { el = document.createElement('div'); el.className = 'rxbb rxsg'; el.$kids = el; this.els.set(g, el); this.bb.insertBefore(el, this.bb.firstChild); }
      const m = homography([[0, 0], [cw, 0], [0, ch], [cw, ch]], scr);
      el.style.cssText = `left:0;top:0;width:${cw}px;height:${ch}px;transform-origin:0 0;transform:matrix3d(${m.join(',')});z-index:${Math.max(0, Math.round(5000 - dist))};pointer-events:none`;
      this.layoutKids(g, r, 1); this.drawTree(g, el, seen, 0);
    }
  }
  drawTree(o, parentEl, seen, zBase) {
    for (const k of o.kids) { if (!isA(k.cls, 'GuiObject')) continue; const r = this.rects.get(k); if (!r) continue; seen.add(k);
      let el = this.els.get(k); if (!el) { el = this.create(k); this.els.set(k, el); }
      if (el.parentNode !== parentEl) parentEl.appendChild(el);
      this.style(k, el, r, o, zBase);
      if (!r[5]) this.drawTree(k, el.$kids, seen, zBase); }
  }
  create(o) {
    const el = document.createElement(o.cls === 'TextBox' ? 'div' : 'div'); el.className = 'rx'; el.$inst = o;
    el.$bg = document.createElement('i'); el.$bg.className = 'rxbg'; el.appendChild(el.$bg);
    if (/^Text/.test(o.cls)) { el.$txt = document.createElement(o.cls === 'TextBox' ? 'input' : 'span'); el.$txt.className = 'rxt'; el.appendChild(el.$txt); if (o.cls !== 'TextBox') { el.$in = document.createElement('span'); el.$in.className = 'rxi'; el.$txt.appendChild(el.$in); }
      if (o.cls === 'TextBox') { el.$txt.addEventListener('focus', () => this.fire(o, 'Focused', [])); el.$txt.addEventListener('input', () => { o.props.set('Text', el.$txt.value); o.changed('Text'); });
        el.$txt.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') el.$txt.blur(); }); el.$txt.addEventListener('blur', () => this.fire(o, 'FocusLost', [true, undefined])); } }
    el.$kids = document.createElement('div'); el.$kids.className = 'rxk'; el.appendChild(el.$kids);
    if (isA(o.cls, 'GuiButton') || o.props.get('Active')) {
      const btn = isA(o.cls, 'GuiButton');
      el.addEventListener('pointerdown', (e) => { if (!btn && !o.props.get('Active')) return; e.stopPropagation(); el.$down = true; el.classList.add('rxdown'); this.fire(o, 'MouseButton1Down', [e.clientX, e.clientY]); this.fire(o, 'InputBegan', [this.inputObj(e, 'Begin')]); });
      el.addEventListener('pointerup', (e) => { if (!el.$down) return; e.stopPropagation(); el.$down = false; el.classList.remove('rxdown'); this.fire(o, 'MouseButton1Up', [e.clientX, e.clientY]); this.fire(o, 'InputEnded', [this.inputObj(e, 'End')]);
        if (btn) { this.fire(o, 'MouseButton1Click', []); this.fire(o, 'Activated', [this.inputObj(e, 'End'), 1]); this.E.onGuiClick?.(o); } });
      el.addEventListener('pointerleave', () => { el.$down = false; el.classList.remove('rxdown'); if (this.hover === o) { this.hover = null; this.fire(o, 'MouseLeave', [0, 0]); } });
      el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { this.hover = o; this.fire(o, 'MouseEnter', [e.clientX, e.clientY]); } });
    }
    return el;
  }
  inputObj(e, state) { const io = new (this.E.Instance)('InputObject', this.E.rt); io.props.set('UserInputType', this.E.enumItem('UserInputType', e.pointerType === 'mouse' ? 'MouseButton1' : 'Touch')); io.props.set('UserInputState', this.E.enumItem('UserInputState', state)); io.props.set('Position', new (this.E.Vector3)(e.clientX, e.clientY, 0)); io.props.set('KeyCode', this.E.enumItem('KeyCode', 'Unknown')); return io; }
  fire(o, ev, args) { const s = o.sigs.get(ev); if (!s || !s.conns.length) return; const prev = this.E.I.side; this.E.I.side = 'client'; try { s.fire(args); } finally { this.E.I.side = prev; } }
  style(o, el, r, parent, zBase) {
    const P = o.props, pr = parent.cls === 'ScreenGui' ? [0, 0, 0, 0, 1] : this.rects.get(parent) || [0, 0, 0, 0, 1], sc = r[4]; // a ScreenGui has no element: its children sit on the layer
    if (r[5]) { if (el.style.display !== 'none') el.style.display = 'none'; return; } else if (el.style.display === 'none') el.style.display = '';
    const x = r[0] - pr[0], y = r[1] - pr[1], rot = P.get('Rotation') || 0, A = P.get('AnchorPoint') || new Vector2();
    const z = (P.get('ZIndex') || 1); const key = [x, y, r[2], r[3], rot, z].map((v) => Math.round(v * 10)).join(',');
    if (el.$geo !== key) { el.$geo = key; el.style.cssText = `left:${x}px;top:${y}px;width:${Math.max(0, r[2])}px;height:${Math.max(0, r[3])}px;z-index:${z};${rot ? `transform:rotate(${rot}deg);transform-origin:${A.x * 100}% ${A.y * 100}%;` : ''}`; }
    // background, border, corner, stroke, gradient
    const bt = P.get('BackgroundTransparency') ?? 0, bc = P.get('BackgroundColor3'), corner = o.kids.find((c) => c.cls === 'UICorner'), strokes = o.kids.filter((c) => c.cls === 'UIStroke' && c.props.get('Enabled') !== false), grad = o.kids.find((c) => c.cls === 'UIGradient' && c.props.get('Enabled') !== false);
    const rad = corner ? Math.min(Math.min(r[2], r[3]) / 2, ud(corner.props.get('CornerRadius'), Math.min(r[2], r[3]), sc)) : 0;
    const isText = /^Text/.test(o.cls); const borderStroke = strokes.find((s) => en(s.props.get('ApplyStrokeMode'), 'Contextual') === 'Border' || !isText); const textStroke = isText ? strokes.find((s) => en(s.props.get('ApplyStrokeMode'), 'Contextual') === 'Contextual') : null;
    let bg = bt >= 1 ? 'transparent' : rgba(bc, bt), bgImg = '';
    if (grad) { const seq = grad.props.get('Color'), tseq = grad.props.get('Transparency'), kps = seq && seq.f.Keypoints ? seq.f.Keypoints.arr : []; const tk = tseq && tseq.f && tseq.f.Keypoints ? tseq.f.Keypoints.arr : null;
      const off = grad.props.get('Offset') || new Vector2(), ang = (grad.props.get('Rotation') || 0) + 90;
      const stops = kps.map((k) => { const c = k.f.Value, t = k.f.Time; const tr = tk ? sampleNum(tk, t) : 0; const base = bc || new Color3(1, 1, 1); return `${rgba(new Color3(c.r * base.r, c.g * base.g, c.b * base.b), Math.min(1, bt + tr * (1 - bt)))} ${((t + off.x) * 100).toFixed(1)}%`; });
      if (stops.length && bt < 1) { bgImg = `linear-gradient(${ang}deg,${stops.join(',')})`; bg = 'transparent'; } }
    let bs = ''; if (borderStroke && !(isText && !bgImg && bt >= 1 && borderStroke === textStroke)) { const sp = borderStroke.props, th = (sp.get('Thickness') || 1) * sc; bs = `0 0 0 ${th}px ${rgba(sp.get('Color'), sp.get('Transparency') || 0)}`; }
    const bsp = P.get('BorderSizePixel') || 0; if (!borderStroke && bsp > 0 && bt < 1 && o.cls !== 'ScrollingFrame') bs = `0 0 0 ${bsp}px ${rgba(P.get('BorderColor3'), bt)}`;
    const look = `${bg}|${bgImg}|${rad}|${bs}|${P.get('ClipsDescendants') ? 1 : 0}`;
    if (el.$look !== look) { el.$look = look; const b = el.$bg.style; b.background = bgImg || bg; b.borderRadius = rad + 'px'; b.boxShadow = bs; el.$kids.style.overflow = P.get('ClipsDescendants') || o.cls === 'ScrollingFrame' ? 'hidden' : ''; el.$kids.style.borderRadius = rad + 'px'; }
    if (/^Image/.test(o.cls)) this.image(o, el, r, sc, rad);
    if (o.cls === 'ScrollingFrame') { const canvas = o.autoCanvas || [r[2], r[3]]; el.$kids.style.overflow = 'hidden'; void canvas; }
    if (isText) this.text(o, el, r, sc, textStroke);
    if (o.cls === 'ViewportFrame') this.vp.draw(o, el, r[2], r[3], this.frameN);
    if (isA(o.cls, 'GuiButton')) { el.classList.toggle('rxbtn', true); el.classList.toggle('rxabc', P.get('AutoButtonColor') !== false); } else el.classList.toggle('rxact', !!P.get('Active') && (o.sigs.get('InputBegan')?.conns.length > 0));
  }
  image(o, el, r, sc, rad) {
    const P = o.props, src = String(P.get('Image') || ''), it = P.get('ImageTransparency') ?? 0; let im = el.$im; if (!src || it >= 1) { if (im) im.style.display = 'none'; return; }
    const url = Assets.url(src); const st = en(P.get('ScaleType'), 'Stretch'), tint = P.get('ImageColor3') || new Color3(1, 1, 1), ro = P.get('ImageRectOffset'), rs = P.get('ImageRectSize');
    const key = [url, (Assets.size(src) || {}).w, it, st, tint.r, tint.g, tint.b, ro && ro.x, ro && ro.y, rs && rs.x, rs && rs.y, Math.round(r[2]), Math.round(r[3]), rad].join('|'); if (el.$imk === key) return; el.$imk = key;
    if (!im) { im = el.$im = document.createElement('i'); im.className = 'rxim'; el.insertBefore(im, el.$kids); } im.style.display = '';
    const s2 = im.style; s2.opacity = 1 - it; s2.borderRadius = rad + 'px';
    if (!url) { s2.background = 'none'; s2.webkitMaskImage = s2.maskImage = 'none'; return; }
    const white = tint.r > 0.98 && tint.g > 0.98 && tint.b > 0.98; let size = '100% 100%', pos = 'center', rep = 'no-repeat';
    if (st === 'Fit') size = 'contain'; else if (st === 'Crop') size = 'cover'; else if (st === 'Tile') { const ts = P.get('TileSize'); size = ts ? `${ud(ts.f.X, r[2], sc)}px ${ud(ts.f.Y, r[3], sc)}px` : '100% 100%'; rep = 'repeat'; pos = '0 0'; }
    const dim = Assets.size(src) || { w: 420, h: 420 };
    if (rs && rs.x > 0 && rs.y > 0) { /* sprite sheet: show the ImageRectSize window at ImageRectOffset, scaled to the element */ const kx = r[2] / rs.x, ky = r[3] / rs.y; size = `${dim.w * kx}px ${dim.h * ky}px`; pos = `${-(ro ? ro.x : 0) * kx}px ${-(ro ? ro.y : 0) * ky}px`; rep = 'no-repeat'; }
    if (white) { s2.background = `url("${url}") ${pos}/${size} ${rep}`; s2.webkitMaskImage = s2.maskImage = 'none'; }
    else { s2.background = rgba(tint); const m = `url("${url}")`; s2.webkitMaskImage = s2.maskImage = m; s2.webkitMaskSize = s2.maskSize = size; s2.webkitMaskPosition = s2.maskPosition = pos; s2.webkitMaskRepeat = s2.maskRepeat = rep; }
    if (st === 'Slice') { const sc2 = P.get('SliceCenter'); if (sc2 && sc2.f) { const a = sc2.f.Min, b = sc2.f.Max, k = (P.get('SliceScale') ?? 1) * sc; const t = a.y, rr = Math.max(0, dim.w - b.x), bb = Math.max(0, dim.h - b.y), l = a.x;
      s2.background = 'none'; s2.webkitMaskImage = s2.maskImage = 'none'; s2.borderStyle = 'solid'; s2.borderColor = 'transparent'; s2.borderWidth = `${t * k}px ${rr * k}px ${bb * k}px ${l * k}px`; s2.borderImage = `url("${url}") ${t} ${rr} ${bb} ${l} fill stretch`; s2.boxSizing = 'border-box'; } }
    else if (s2.borderImage) { s2.borderImage = ''; s2.borderWidth = '0'; s2.borderStyle = 'none'; }
  }
  text(o, el, r, sc, stroke) {
    const P = o.props; let txt = String(P.get('Text') ?? ''); const rich = !!P.get('RichText'); const f = fontOf(o); const tt = P.get('TextTransparency') ?? 0;
    let size = (P.get('TextSize') || 14) * sc; const plain = rich ? txt.replace(/<[^>]+>/g, '') : txt;
    if (P.get('TextScaled')) { const lim = o.kids.find((c) => c.cls === 'UITextSizeConstraint'); const maxS = lim ? (lim.props.get('MaxTextSize') || 100) * sc : 100 * sc, minS = lim ? (lim.props.get('MinTextSize') || 1) * sc : 1;
      const w = Math.max(1, r[2] - 4), h = Math.max(1, r[3]); const k = txt + '|' + Math.round(w) + '|' + Math.round(h) + '|' + f.css;
      if (el.$fitK !== k) { el.$fitK = k; el.$fit = fitText(rich ? richToHtml(txt) : null, plain, f, w, h, (P.get('LineHeight') || 1) * 1.15, minS, maxS); } size = el.$fit; }
    const xa = en(P.get('TextXAlignment'), 'Center'), ya = en(P.get('TextYAlignment'), 'Center'), wrap = !!(P.get('TextWrapped') || P.get('TextScaled'));
    let shadow = ''; const st = P.get('TextStrokeTransparency') ?? 1; if (st < 1) { const c = rgba(P.get('TextStrokeColor3'), st), w = Math.max(1, size * 0.07); shadow = textOutline(w, c); }
    if (stroke) { const sp = stroke.props, w = (sp.get('Thickness') || 1) * sc, c = rgba(sp.get('Color'), sp.get('Transparency') || 0); shadow = textOutline(w, c); }
    const key = [txt, size.toFixed(1), f.css, f.weight, xa, ya, wrap, tt, shadow, rgba(P.get('TextColor3'))].join('|'); if (el.$tk === key) return; el.$tk = key;
    const t = el.$txt, s = t.style;
    if (o.cls === 'TextBox') { if (document.activeElement !== t) t.value = txt; t.placeholder = String(P.get('PlaceholderText') || ''); }
    else if (rich) el.$in.innerHTML = richToHtml(txt); else el.$in.textContent = txt;
    s.fontFamily = f.css; s.fontWeight = f.weight; s.fontSize = size + 'px'; s.lineHeight = (P.get('LineHeight') || 1) * 1.15; s.color = rgba(P.get('TextColor3'), tt); s.textShadow = shadow; s.whiteSpace = wrap ? 'pre-wrap' : 'pre';
    s.textAlign = xa === 'Left' ? 'left' : xa === 'Right' ? 'right' : 'center'; s.justifyContent = xa === 'Left' ? 'flex-start' : xa === 'Right' ? 'flex-end' : 'center'; s.alignItems = ya === 'Top' ? 'flex-start' : ya === 'Bottom' ? 'flex-end' : 'center';
  }
  /* ---------------- BillboardGuis (in the 3D world) ---------------- */
  billboards(seen) {
    const cam = this.camera; if (!cam || !this.world) return; const W = this.W, H = this.H;
    const bbs = []; const pg = this.E.player && this.E.player.child('PlayerGui'); const scan = (o) => { for (const k of o.kids) { if (k.cls === 'BillboardGui' && k.props.get('Enabled') !== false) bbs.push(k); if (k.kids.length && !isA(k.cls, 'GuiObject')) scan(k); } };
    scan(this.E.workspace); if (pg) for (const k of pg.kids) if (k.cls === 'BillboardGui' && k.props.get('Enabled') !== false) bbs.push(k);
    const v = this.world.tmpV || (this.world.tmpV = new this.world.THREE.Vector3());
    for (const b of bbs) {
      const ad = b.props.get('Adornee') || b.parent; const cf = ad && ad.props && (ad.props.get('CFrame') || (ad.cls === 'Model' ? ad.pivot() : null)) || (ad && ad.cls === 'Attachment' ? ad.$index('WorldCFrame') : null); if (!cf) continue;
      const so = b.props.get('StudsOffset') || { x: 0, y: 0, z: 0 }, sw = b.props.get('StudsOffsetWorldSpace') || { x: 0, y: 0, z: 0 }; const sz = ad.props.get && ad.props.get('Size');
      const eo = b.props.get('ExtentsOffset'); const up = (sz && eo ? eo.y * sz.y / 2 : 0);
      const camR = new this.world.THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion), camU = new this.world.THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      v.set(cf.p[0] + sw.x, cf.p[1] + sw.y + up, cf.p[2] + sw.z).addScaledVector(camR, so.x).addScaledVector(camU, so.y);
      const dist = v.distanceTo(cam.position); if (dist > (b.props.get('MaxDistance') ?? Infinity)) continue; v.project(cam); if (v.z > 1) continue;
      const pxPerStud = H / (2 * Math.tan((cam.fov * Math.PI) / 360) * dist); const S = b.props.get('Size'); const w = S ? S.f.X.f.Scale * pxPerStud + S.f.X.f.Offset : 100, h = S ? S.f.Y.f.Scale * pxPerStud + S.f.Y.f.Offset : 50;
      const cx = (v.x * 0.5 + 0.5) * W, cy = (-v.y * 0.5 + 0.5) * H; const r = [cx - w / 2, cy - h / 2, w, h]; this.rects.set(b, [...r, 1]); seen.add(b);
      let el = this.els.get(b); if (!el) { el = document.createElement('div'); el.className = 'rxbb'; el.$kids = el; this.els.set(b, el); this.bb.appendChild(el); }
      el.style.cssText = `left:${r[0]}px;top:${r[1]}px;width:${w}px;height:${h}px;z-index:${Math.round(10000 - dist)}`;
      this.layoutKids(b, r, 1); this.drawTree(b, el, seen, 0);
    }
  }
}
/* SurfaceGui faces: outward normal, and the canvas' right / up directions as seen by someone facing that side */
const SURFACE_FACES = { Front: { n: [0, 0, -1], r: [-1, 0, 0], u: [0, 1, 0] }, Back: { n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0] }, Right: { n: [1, 0, 0], r: [0, 0, -1], u: [0, 1, 0] }, Left: { n: [-1, 0, 0], r: [0, 0, 1], u: [0, 1, 0] },
  Top: { n: [0, 1, 0], r: [1, 0, 0], u: [0, 0, -1] }, Bottom: { n: [0, -1, 0], r: [1, 0, 0], u: [0, 0, 1] } };
/* the CSS matrix3d of the projective map sending 4 points to 4 points */
function homography(src, dst) {
  const A = [], b = []; for (let i = 0; i < 4; i++) { const [x, y] = src[i], [u, v] = dst[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
  for (let i = 0; i < 8; i++) { let mx = i; for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r; [A[i], A[mx]] = [A[mx], A[i]]; [b[i], b[mx]] = [b[mx], b[i]]; const d = A[i][i] || 1e-12;
    for (let r = 0; r < 8; r++) if (r !== i) { const f = A[r][i] / d; for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; } }
  const h = b.map((v, i) => v / (A[i][i] || 1e-12)); // [a b c d e f g h]: u = (ax+by+c)/(gx+hy+1)
  return [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1];
}
function sampleNum(kps, t) { if (!kps.length) return 0; let a = kps[0]; for (const k of kps) { if (k.f.Time >= t) { const u = (t - a.f.Time) / Math.max(1e-6, k.f.Time - a.f.Time); return a.f.Value + (k.f.Value - a.f.Value) * Math.max(0, Math.min(1, u)); } a = k; } return a.f.Value; }
function textOutline(w, c) { const o = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; o.push(`${(Math.cos(a) * w).toFixed(2)}px ${(Math.sin(a) * w).toFixed(2)}px 0 ${c}`); } return o.join(','); }
export const GUI_CSS = `
.rbx-gui,.rbx-bb{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2}
.rx{position:absolute;box-sizing:border-box;pointer-events:none;margin:0;padding:0}
.rx.rxbtn,.rx.rxact{pointer-events:auto;cursor:pointer;touch-action:manipulation}
.rx>.rxbg{position:absolute;inset:0;display:block;pointer-events:none}
.rx>.rxk{position:absolute;inset:0;pointer-events:none}
.rxt{position:absolute;inset:0;display:flex;overflow:hidden;pointer-events:none;color:#fff;word-break:break-word;font-synthesis:none;padding:0 1px;margin:0;background:none;border:0;box-shadow:none;animation:none;min-height:0;width:auto;border-radius:0}
input.rxt{background:transparent;border:0;outline:none;pointer-events:auto;padding:0 6px;width:100%;height:100%}
.rx.rxbtn.rxabc.rxdown>.rxbg{filter:brightness(.72)}
.rxbb{position:absolute;pointer-events:none}
.rxi{display:block;max-width:100%;text-align:inherit}
.rxvp{position:absolute;inset:0;pointer-events:none}
.rx>.rxim{position:absolute;inset:0;display:block;pointer-events:none;box-sizing:border-box}
`;
