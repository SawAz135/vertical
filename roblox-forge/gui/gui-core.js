/* =====================================================================
   Roblox Forge - GUI core: the data model is a real Roblox instance tree
   (ScreenGui > Frame / TextLabel / … + UICorner / UIStroke / … modifiers).
   - colours can be theme tokens ("$primary") so a theme recolours everything;
   - render() draws it in the browser with Roblox's rules (Scale + Offset,
     AnchorPoint, UIPadding, list / grid layouts, aspect ratio, TextScaled…);
   - toModel() writes the Rojo .model.json that builds the same ScreenGui;
   - the animation engine below is the twin of kit/ForgeGuiAnim.client.lua.
   ===================================================================== */

/* ---------------- ids, classes, schema ---------------- */
let seq = 1;
export const nid = () => 'g' + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
export const GUI_CLASSES = ['Frame', 'TextLabel', 'TextButton', 'TextBox', 'ImageLabel', 'ImageButton', 'ScrollingFrame'];
export const MODS = ['UICorner', 'UIStroke', 'UIGradient', 'UIPadding', 'UIListLayout', 'UIGridLayout', 'UIAspectRatioConstraint', 'UIScale', 'UITextSizeConstraint'];
export const isMod = (c) => MODS.includes(c);
export const isText = (c) => c === 'TextLabel' || c === 'TextButton' || c === 'TextBox';
export const isButton = (c) => c === 'TextButton' || c === 'ImageButton';
export const ICON = { ScreenGui: '🖥️', Frame: '▭', TextLabel: '🔤', TextButton: '🔘', TextBox: '⌨️', ImageLabel: '🖼️', ImageButton: '🖲️', ScrollingFrame: '📜',
  UICorner: '◜', UIStroke: '◻', UIGradient: '🌈', UIPadding: '⊡', UIListLayout: '☰', UIGridLayout: '▦', UIAspectRatioConstraint: '⧈', UIScale: '⤢', UITextSizeConstraint: '🅰' };
export const FONTS = { // Roblox font -> preview font (embedded open fonts, closest match)
  GothamBlack: '900 1em "F-Montserrat","Gotham",system-ui,sans-serif', GothamBold: '700 1em "F-Montserrat","Gotham",system-ui,sans-serif',
  BuilderSansExtraBold: '800 1em "F-Montserrat",system-ui,sans-serif', FredokaOne: '700 1em "F-Fredoka",ui-rounded,sans-serif',
  LuckiestGuy: '400 1em "F-Luckiest",sans-serif', Bangers: '400 1em "F-Bangers",sans-serif', Arcade: '400 0.82em "F-Press",monospace',
  Cartoon: '700 1em "Comic Sans MS","Chalkboard SE","F-Fredoka",cursive', SciFi: '700 1em "F-Orbitron",sans-serif', Michroma: '400 1em "F-Michroma",sans-serif',
  Oswald: '700 1em "F-Oswald",sans-serif', SourceSansBold: '700 1em "Source Sans Pro",system-ui,sans-serif', Nunito: '800 1em "F-Nunito",ui-rounded,sans-serif',
  Creepster: '400 1em "F-Creepster",fantasy', PermanentMarker: '400 1em "F-Marker",cursive', RobotoMono: '700 1em ui-monospace,Menlo,monospace',
};
export const ENUMS = {
  TextXAlignment: ['Left', 'Center', 'Right'], TextYAlignment: ['Top', 'Center', 'Bottom'], FillDirection: ['Vertical', 'Horizontal'],
  HorizontalAlignment: ['Left', 'Center', 'Right'], VerticalAlignment: ['Top', 'Center', 'Bottom'], ApplyStrokeMode: ['Contextual', 'Border'],
  ScaleType: ['Stretch', 'Fit', 'Crop', 'Slice', 'Tile'], AutomaticCanvasSize: ['None', 'X', 'Y', 'XY'], DominantAxis: ['Width', 'Height'], Font: Object.keys(FONTS),
};
// [key, type, label, default]  - types: udim2 udim vec2 color num t01 bool text font enum:<E> image int
const GUIOBJ = [['Size', 'udim2', 'Taille', [0, 100, 0, 100]], ['Position', 'udim2', 'Position', [0, 0, 0, 0]], ['AnchorPoint', 'vec2', 'Ancre', [0, 0]],
  ['BackgroundColor3', 'color', 'Fond', '#ffffff'], ['BackgroundTransparency', 't01', 'Transp. fond', 0], ['Rotation', 'num', 'Rotation°', 0],
  ['ZIndex', 'int', 'Z-Index', 1], ['LayoutOrder', 'int', 'Ordre', 0], ['Visible', 'bool', 'Visible', true], ['ClipsDescendants', 'bool', 'Couper le débord', false]];
const TEXT = [['Text', 'text', 'Texte', 'Texte'], ['TextColor3', 'color', 'Couleur texte', '#ffffff'], ['Font', 'enum:Font', 'Police', 'GothamBold'], ['TextSize', 'num', 'Taille texte', 18],
  ['TextScaled', 'bool', 'Texte auto', true], ['TextXAlignment', 'enum:TextXAlignment', 'Align. X', 'Center'], ['TextYAlignment', 'enum:TextYAlignment', 'Align. Y', 'Center'],
  ['TextWrapped', 'bool', 'Retour ligne', true], ['TextStrokeTransparency', 't01', 'Contour texte', 1], ['TextStrokeColor3', 'color', 'Couleur contour', '#000000'], ['TextTransparency', 't01', 'Transp. texte', 0]];
const IMAGE = [['Image', 'image', 'Image (rbxassetid)', ''], ['ImageColor3', 'color', 'Teinte image', '#ffffff'], ['ImageTransparency', 't01', 'Transp. image', 0], ['ScaleType', 'enum:ScaleType', 'Ajustement', 'Fit']];
export const SCHEMA = {
  ScreenGui: [['ResetOnSpawn', 'bool', 'Reset au respawn', false], ['IgnoreGuiInset', 'bool', 'Sous la barre du haut', true], ['DisplayOrder', 'int', 'Ordre d\'affichage', 5]],
  Frame: GUIOBJ, TextLabel: [...GUIOBJ, ...TEXT], TextButton: [...GUIOBJ, ...TEXT, ['AutoButtonColor', 'bool', 'Assombrir au clic', false]],
  TextBox: [...GUIOBJ, ...TEXT, ['PlaceholderText', 'text', 'Indice', 'Rechercher…'], ['PlaceholderColor3', 'color', 'Couleur indice', '#9a94bd'], ['ClearTextOnFocus', 'bool', 'Vider au focus', false]],
  ImageLabel: [...GUIOBJ, ...IMAGE], ImageButton: [...GUIOBJ, ...IMAGE, ['AutoButtonColor', 'bool', 'Assombrir au clic', false]],
  ScrollingFrame: [...GUIOBJ, ['ScrollBarThickness', 'int', 'Barre (px)', 6], ['ScrollBarImageColor3', 'color', 'Couleur barre', '#ffffff'], ['AutomaticCanvasSize', 'enum:AutomaticCanvasSize', 'Toile auto', 'Y'], ['CanvasSize', 'udim2', 'Toile', [0, 0, 0, 0]]],
  UICorner: [['CornerRadius', 'udim', 'Arrondi', [0, 12]]],
  UIStroke: [['Color', 'color', 'Couleur', '#ffffff'], ['Thickness', 'num', 'Épaisseur', 2], ['Transparency', 't01', 'Transparence', 0], ['ApplyStrokeMode', 'enum:ApplyStrokeMode', 'Mode', 'Border']],
  UIGradient: [['Color', 'colorseq', 'Dégradé', [{ t: 0, c: '#ffffff' }, { t: 1, c: '#888888' }]], ['Rotation', 'num', 'Angle°', 90], ['Transparency', 'numseq', 'Transparence', [{ t: 0, v: 0 }, { t: 1, v: 0 }]], ['Offset', 'vec2', 'Décalage', [0, 0]]],
  UIPadding: [['PaddingTop', 'udim', 'Haut', [0, 8]], ['PaddingBottom', 'udim', 'Bas', [0, 8]], ['PaddingLeft', 'udim', 'Gauche', [0, 8]], ['PaddingRight', 'udim', 'Droite', [0, 8]]],
  UIListLayout: [['FillDirection', 'enum:FillDirection', 'Direction', 'Vertical'], ['Padding', 'udim', 'Espace', [0, 8]], ['HorizontalAlignment', 'enum:HorizontalAlignment', 'Align. horiz.', 'Center'],
    ['VerticalAlignment', 'enum:VerticalAlignment', 'Align. vert.', 'Top']],
  UIGridLayout: [['CellSize', 'udim2', 'Case', [0, 90, 0, 90]], ['CellPadding', 'udim2', 'Espace', [0, 8, 0, 8]], ['HorizontalAlignment', 'enum:HorizontalAlignment', 'Align. horiz.', 'Center'],
    ['VerticalAlignment', 'enum:VerticalAlignment', 'Align. vert.', 'Top'], ['FillDirection', 'enum:FillDirection', 'Remplir', 'Horizontal']],
  UIAspectRatioConstraint: [['AspectRatio', 'num', 'Ratio L/H', 1], ['DominantAxis', 'enum:DominantAxis', 'Axe dominant', 'Width']],
  UIScale: [['Scale', 'num', 'Échelle', 1]],
  UITextSizeConstraint: [['MaxTextSize', 'int', 'Taille max', 40], ['MinTextSize', 'int', 'Taille min', 8]],
};
export const DEFAULTS = Object.fromEntries(Object.entries(SCHEMA).map(([c, list]) => [c, Object.fromEntries(list.map(([k, , , d]) => [k, d]))]));
export const prop = (n, k) => (n.props && n.props[k] !== undefined ? n.props[k] : (DEFAULTS[n.cls] || {})[k]);

/* ---------------- themes ---------------- */
export const THEMES = {
  neon: { label: 'Néon', panel: '#12102a', panel2: '#1d1846', primary: '#7c5cff', primary2: '#3ee6ff', accent: '#ffd45c', text: '#ffffff', muted: '#a39bc9', good: '#3dffa8', bad: '#ff4d6d', stroke: '#8f7bff', font: 'GothamBlack' },
  casino: { label: 'Casino', panel: '#1c0f04', panel2: '#3a1e05', primary: '#ffb300', primary2: '#ff5e00', accent: '#fff1b8', text: '#fff6dc', muted: '#d9b77a', good: '#5dff7a', bad: '#ff3b3b', stroke: '#ffd36a', font: 'GothamBlack' },
  candy: { label: 'Bonbon', panel: '#fff0f7', panel2: '#ffd6ec', primary: '#ff5fb1', primary2: '#7bd8ff', accent: '#ffe066', text: '#5a1a44', muted: '#b06a95', good: '#2bd67b', bad: '#ff4f6b', stroke: '#ffffff', font: 'FredokaOne' },
  ocean: { label: 'Océan', panel: '#04213a', panel2: '#063a63', primary: '#00b4ff', primary2: '#00ffd0', accent: '#ffe08a', text: '#eafcff', muted: '#86b8d6', good: '#38f2a0', bad: '#ff6b6b', stroke: '#5fd4ff', font: 'GothamBold' },
  lava: { label: 'Lave', panel: '#1a0505', panel2: '#3b0a06', primary: '#ff3d00', primary2: '#ffb000', accent: '#ffe7a3', text: '#fff1e8', muted: '#d99a86', good: '#7dff6b', bad: '#ff2d55', stroke: '#ff7a3d', font: 'GothamBlack' },
  forest: { label: 'Forêt', panel: '#0d1f12', panel2: '#173a20', primary: '#45d16b', primary2: '#c6f36b', accent: '#ffd77a', text: '#f1ffe9', muted: '#9cc79f', good: '#6bff9a', bad: '#ff6b5e', stroke: '#7ee08f', font: 'FredokaOne' },
  ice: { label: 'Glace', panel: '#eaf6ff', panel2: '#cfe9ff', primary: '#3a8dff', primary2: '#8ae6ff', accent: '#b98bff', text: '#0e2a4a', muted: '#5c7fa3', good: '#20c98a', bad: '#ff4f6b', stroke: '#ffffff', font: 'GothamBold' },
  minimal: { label: 'Minimal', panel: '#141418', panel2: '#1d1d24', primary: '#ffffff', primary2: '#c9c9d6', accent: '#6c8cff', text: '#f4f4f8', muted: '#8a8a99', good: '#4ade80', bad: '#f87171', stroke: '#2e2e38', font: 'BuilderSansExtraBold' },
  cartoon: { label: 'Cartoon', panel: '#ffd23f', panel2: '#ffb627', primary: '#3bceac', primary2: '#0ead69', accent: '#ee4266', text: '#ffffff', muted: '#5b3f00', good: '#0ead69', bad: '#ee4266', stroke: '#1b1b1b', font: 'LuckiestGuy' },
};
export const TOKENS = ['panel', 'panel2', 'primary', 'primary2', 'accent', 'text', 'muted', 'good', 'bad', 'stroke'];
export const TOKEN_FR = { panel: 'Panneau', panel2: 'Panneau 2', primary: 'Principale', primary2: 'Secondaire', accent: 'Accent', text: 'Texte', muted: 'Doux', good: 'Succès', bad: 'Danger', stroke: 'Contour' };
export function color(v, theme) {
  if (typeof v === 'string' && v[0] === '$') { const k = v.slice(1); return (k === 'font' ? null : theme[k]) || '#ff00ff'; }
  return v || '#ffffff';
}
export const fontOf = (v, theme) => (v === '$font' ? theme.font : v) || 'GothamBold';
export const hexRgb = (h) => { const n = parseInt(String(h).slice(1, 7).padEnd(6, '0'), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${+a.toFixed(3)})`; };
const lum = (h) => { const [r, g, b] = hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mixHex = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return toHex(...x.map((v, i) => v + (y[i] - v) * t)); };
function rgbToHsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
/** Theme from a picture of the game (cover, screenshot): k-means on the pixels, then roles by darkness / saturation. */
export function themeFromPixels(data, label = 'Mon jeu') {
  const px = []; for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) px.push([data[i], data[i + 1], data[i + 2]]);
  if (px.length < 8) return null;
  let cs = Array.from({ length: 6 }, (_, k) => px[Math.floor(((k + 0.5) / 6) * px.length)].slice());
  for (let it = 0; it < 10; it++) {
    const acc = cs.map(() => [0, 0, 0, 0]);
    for (const p of px) { let bi = 0, bd = 1e9; cs.forEach((c, i) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; bi = i; } }); const a = acc[bi]; a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++; }
    cs = acc.map((a, i) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3], a[3]] : [...cs[i].slice(0, 3), 0]));
  }
  const cl = cs.filter((c) => c[3] > 0).map((c) => { const [h, s, l] = rgbToHsl(c); return { hex: toHex(c[0], c[1], c[2]), h, s, l, n: c[3] }; });
  const dark = [...cl].sort((a, b) => a.l - b.l)[0];
  const vivid = [...cl].sort((a, b) => b.s * Math.sqrt(b.n) * (1 - Math.abs(b.l - 0.55)) - a.s * Math.sqrt(a.n) * (1 - Math.abs(a.l - 0.55)));
  const primary = vivid[0] || cl[0], second = vivid.find((c) => c !== primary && Math.abs(c.h - primary.h) > 0.06) || vivid[1] || primary;
  const accent = [...cl].filter((c) => c !== primary && c !== second).sort((a, b) => b.l * b.s - a.l * a.s)[0] || second;
  const panel = mixHex(dark.hex, '#000000', dark.l > 0.25 ? 0.55 : 0.2);
  const pop = (h) => { const [r, g, b] = hexRgb(h), [hh, s, l] = rgbToHsl([r, g, b]); return l < 0.45 ? mixHex(h, '#ffffff', 0.35) : s < 0.35 ? mixHex(h, '#7c5cff', 0.4) : h; };
  return { label, panel, panel2: mixHex(panel, pop(primary.hex), 0.18), primary: pop(primary.hex), primary2: pop(second.hex), accent: mixHex(pop(accent.hex), '#ffffff', 0.25),
    text: '#ffffff', muted: mixHex('#ffffff', panel, 0.4), good: '#3dffa8', bad: '#ff4d6d', stroke: mixHex(pop(primary.hex), '#ffffff', 0.3), font: 'GothamBlack', fromImage: true };
}

/* ---------------- builders (used by the templates) ---------------- */
export function N(cls, name, props = {}, children = [], extra = {}) { return { id: nid(), cls, name, props, children, ...extra }; }
export const corner = (s, o = 0) => N('UICorner', 'UICorner', { CornerRadius: [s, o] });
export const stroke = (c, th = 2, tr = 0, mode = 'Border') => N('UIStroke', 'UIStroke', { Color: c, Thickness: th, Transparency: tr, ApplyStrokeMode: mode });
export const grad = (stops, rot = 90, tr) => N('UIGradient', 'UIGradient', { Color: stops.map((c, i) => (typeof c === 'string' ? { t: i / (stops.length - 1), c } : c)), Rotation: rot, ...(tr ? { Transparency: tr } : {}) });
export const pad = (t, r = t, b = t, l = r) => N('UIPadding', 'UIPadding', { PaddingTop: [0, t], PaddingRight: [0, r], PaddingBottom: [0, b], PaddingLeft: [0, l] });
export const list = (dir = 'Vertical', gap = 8, h = 'Center', v = 'Top') => N('UIListLayout', 'UIListLayout', { FillDirection: dir, Padding: [0, gap], HorizontalAlignment: h, VerticalAlignment: v });
export const gridL = (cell, gap = [0, 8, 0, 8], h = 'Center') => N('UIGridLayout', 'UIGridLayout', { CellSize: cell, CellPadding: gap, HorizontalAlignment: h });
export const aspect = (r) => N('UIAspectRatioConstraint', 'UIAspectRatioConstraint', { AspectRatio: r });
export const tsize = (mx, mn = 6) => N('UITextSizeConstraint', 'UITextSizeConstraint', { MaxTextSize: mx, MinTextSize: mn });

/* ---------------- tree helpers ---------------- */
export function walk(n, fn, parent = null, depth = 0) { if (fn(n, parent, depth) === false) return; for (const c of n.children || []) walk(c, fn, n, depth + 1); }
export function find(root, id) { let r = null; walk(root, (n) => { if (n.id === id) { r = n; return false; } }); return r; }
export function parentOf(root, id) { let r = null; walk(root, (n, p) => { if (n.id === id) { r = p; return false; } }); return r; }
export function cloneNode(n) { const c = JSON.parse(JSON.stringify(n)); walk(c, (x) => { x.id = nid(); }); return c; }
export const guiKids = (n) => (n.children || []).filter((c) => !isMod(c.cls));
export const mod = (n, cls) => (n.children || []).find((c) => c.cls === cls);
export function windows(root) { const out = []; walk(root, (n) => { if (n.anim && n.anim.window) out.push(n); }); return out; }
export function uniqueName(root, base, self) { const names = new Set(); walk(root, (n) => { if (n !== self) names.add(n.name); }); let n = base, i = 2; while (names.has(n)) n = base + i++; return n; }

/* ---------------- easing (same as ForgeAnimCore / Roblox styles) ---------------- */
const C1 = 1.70158, C3 = C1 + 1, C4 = (2 * Math.PI) / 3;
function bounceOut(x) { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) { x -= 1.5 / d; return n * x * x + 0.75; } if (x < 2.5 / d) { x -= 2.25 / d; return n * x * x + 0.9375; } x -= 2.625 / d; return n * x * x + 0.984375; }
const IN = { Linear: (x) => x, Sine: (x) => 1 - Math.cos((x * Math.PI) / 2), Quad: (x) => x * x, Cubic: (x) => x ** 3, Quart: (x) => x ** 4, Quint: (x) => x ** 5,
  Exponential: (x) => (x === 0 ? 0 : 2 ** (10 * x - 10)), Circular: (x) => 1 - Math.sqrt(Math.max(0, 1 - x * x)), Back: (x) => C3 * x ** 3 - C1 * x * x,
  Elastic: (x) => (x === 0 || x === 1 ? x : -(2 ** (10 * x - 10)) * Math.sin((x * 10 - 10.75) * C4)), Bounce: (x) => 1 - bounceOut(1 - x) };
export function ease(style, dir, x) { x = Math.min(1, Math.max(0, x)); const f = IN[style] || IN.Linear; if (dir === 'In') return f(x); if (dir === 'Out') return 1 - f(1 - x); return x < 0.5 ? f(2 * x) / 2 : 1 - f(2 - 2 * x) / 2; }

/* ---------------- animation presets (same table in the Luau runtime) ---------------- */
export const OPEN = { // channel start values; they tween to rest (S=1, X=0, Y=0, R=0)
  none: { fr: 'Aucune' }, pop: { fr: 'Pop', S: 0, ease: ['Back', 'Out'] }, zoom: { fr: 'Zoom', S: 1.35, ease: ['Quad', 'Out'] },
  slideUp: { fr: 'Glisse du bas', Y: 0.6, ease: ['Quint', 'Out'] }, slideDown: { fr: 'Glisse du haut', Y: -0.6, ease: ['Quint', 'Out'] },
  slideLeft: { fr: 'Glisse de droite', X: 0.6, ease: ['Quint', 'Out'] }, slideRight: { fr: 'Glisse de gauche', X: -0.6, ease: ['Quint', 'Out'] },
  drop: { fr: 'Chute rebond', Y: -0.8, ease: ['Bounce', 'Out'] }, spin: { fr: 'Tourbillon', S: 0, R: -180, ease: ['Back', 'Out'] },
};
export const HOVER = { none: 'Aucun', grow: 'Grossit', lift: 'Se soulève', glow: 'Contour brillant' };
export const PRESS = { none: 'Aucun', squish: 'S\'écrase', bounce: 'Rebondit' };
export const IDLE = { none: 'Aucun', pulse: 'Pulsation', float: 'Flotte', spin: 'Tourne', shine: 'Reflet qui passe', rainbow: 'Arc-en-ciel', wiggle: 'Frétille' };
export const ACTIONS = { none: 'Rien', toggle: 'Ouvrir / fermer une fenêtre', close: 'Fermer sa fenêtre', roll: 'Tirage RNG (casino)', switch: 'Interrupteur ON / OFF' };
/** Idle channels at time t (seconds): deterministic, identical in Luau. */
export function idleAt(kind, t, period = 1.6) {
  const k = (t / period) % 1;
  switch (kind) {
    case 'pulse': return { S: 1 + 0.06 * (0.5 - 0.5 * Math.cos(k * Math.PI * 2)) };
    case 'float': return { Yo: -6 * Math.sin(k * Math.PI * 2) };
    case 'spin': return { R: 360 * k };
    case 'wiggle': return { R: 6 * Math.sin(k * Math.PI * 4) * (k < 0.5 ? 1 : 0) };
    case 'shine': return { G: k < 0.6 ? -1 + (2 * k) / 0.6 : 1 };
    case 'rainbow': return { GR: 360 * k };
    default: return {};
  }
}
/** A small tween engine: each channel tweens from its current value; same formulas in Luau. */
export class Channels {
  constructor() { this.v = { S_open: 1, S_hover: 1, S_press: 1, X_open: 0, Y_open: 0, R_open: 0, Yo_hover: 0, G_hover: 0 }; this.tw = {}; }
  to(ch, value, dur, style, dir, now) { this.tw[ch] = { from: this.v[ch], to: value, t0: now, dur: Math.max(0.001, dur), style, dir }; }
  set(ch, value) { this.v[ch] = value; delete this.tw[ch]; }
  step(now) { let busy = false; for (const [ch, tw] of Object.entries(this.tw)) { const x = (now - tw.t0) / tw.dur; const e = ease(tw.style, tw.dir, x);
    this.v[ch] = tw.from + (tw.to - tw.from) * e; if (x >= 1) { this.v[ch] = tw.to; delete this.tw[ch]; } else busy = true; } return busy; }
}
export function openFrom(chs, kind) { const o = OPEN[kind] || OPEN.none; if (o.S !== undefined) chs.set('S_open', o.S); if (o.X !== undefined) chs.set('X_open', o.X); if (o.Y !== undefined) chs.set('Y_open', o.Y); if (o.R !== undefined) chs.set('R_open', o.R); }
export function openTo(chs, kind, dur, now) { const o = OPEN[kind] || OPEN.none, [s, d] = o.ease || ['Quad', 'Out'];
  chs.to('S_open', 1, dur, s, d, now); chs.to('X_open', 0, dur, s, d, now); chs.to('Y_open', 0, dur, s, d, now); chs.to('R_open', 0, dur, s, d, now); }
export function closeTo(chs, kind, dur, now) { const o = OPEN[kind] || OPEN.none, d = dur * 0.6, st = o.ease && o.ease[0] === 'Bounce' ? 'Quad' : (o.ease || ['Quad'])[0];
  if (o.S !== undefined) chs.to('S_open', o.S, d, st, 'In', now); if (o.X !== undefined) chs.to('X_open', o.X, d, 'Quint', 'In', now);
  if (o.Y !== undefined) chs.to('Y_open', o.Y, d, 'Quint', 'In', now); if (o.R !== undefined) chs.to('R_open', o.R, d, 'Quad', 'In', now); return d; }
/** RNG: "Commun:60:#b0b0b0, Rare:25:#3ea0ff" -> [{name, w, c}] ; weighted pick with r in [0,1). */
export function parseRoll(s) { return String(s || '').split(',').map((x) => x.trim().split(':')).filter((a) => a[0]).map(([name, w, c]) => ({ name: name.trim(), w: Math.max(0, +w || 0), c: (c || '#ffffff').trim() })); }
export function pickRoll(items, r) { const tot = items.reduce((s, i) => s + i.w, 0) || 1; let acc = 0; for (const it of items) { acc += it.w / tot; if (r < acc) return it; } return items[items.length - 1]; }
export const abbreviate = (v) => { const a = Math.abs(v), u = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']].find(([n]) => a >= n); return u ? (v / u[0]).toFixed(v / u[0] >= 100 ? 0 : 1).replace(/\.0$/, '') + u[1] : String(Math.floor(v)); };

/* ---------------- DOM renderer ---------------- */
const pct = (s, o) => `calc(${+(s * 100).toFixed(4)}% + ${+(+o).toFixed(2)}px)`;
const alignFlex = { Left: 'flex-start', Top: 'flex-start', Center: 'center', Right: 'flex-end', Bottom: 'flex-end' };
export function render(root, theme, stage, opts = {}) {
  stage.innerHTML = ''; const map = new Map();
  const build = (n, parentEl, layout, cell) => {
    if (isMod(n.cls)) return;
    if (opts.play && !(opts.isVisible ? opts.isVisible(n) : prop(n, 'Visible'))) return;
    if (!opts.play && n.eh) return; // hidden in the editor only
    if (!opts.play && opts.editVisible && !opts.editVisible(n)) return; // closed windows show when selected
    const P = (k) => prop(n, k), el = document.createElement('div'), inner = document.createElement('div');
    el.className = 'gn gn-' + n.cls; el.dataset.id = n.id; inner.className = 'gc'; el.appendChild(inner); map.set(n.id, el);
    const size = cell || P('Size'), pos = P('Position'), ap = P('AnchorPoint');
    if (layout) { el.style.position = 'relative'; el.style.flex = 'none'; el.style.order = P('LayoutOrder'); }
    else { el.style.position = 'absolute'; el.style.left = pct(pos[0], pos[1]); el.style.top = pct(pos[2], pos[3]); }
    el.style.width = pct(size[0], size[1]); el.style.height = pct(size[2], size[3]);
    el.dataset.ax = layout ? 0 : ap[0]; el.dataset.ay = layout ? 0 : ap[1]; el.dataset.rot = P('Rotation') || 0;
    el.style.zIndex = P('ZIndex'); if (!opts.play && P('Visible') === false) el.classList.add('gn-hidden');
    if (P('ClipsDescendants') || n.cls === 'ScrollingFrame') inner.style.overflow = n.cls === 'ScrollingFrame' ? 'auto' : 'hidden';
    if (n.cls === 'ScrollingFrame') { inner.style.setProperty('--sb', color(P('ScrollBarImageColor3'), theme)); inner.classList.add('gscroll'); }
    // background + gradient
    const bgT = P('BackgroundTransparency'), bg = color(P('BackgroundColor3'), theme), g = mod(n, 'UIGradient');
    if (bgT < 1) {
      if (g) el.style.background = gradCss(g, theme, bg, 1 - bgT); // Roblox: the gradient tints background AND text
      else el.style.background = rgba(bg, 1 - bgT);
    }
    const st = mod(n, 'UIStroke');
    if (st && (prop(st, 'ApplyStrokeMode') === 'Border' || !isText(n.cls))) { const th = prop(st, 'Thickness'); el.style.boxShadow = `0 0 0 ${th}px ${rgba(color(prop(st, 'Color'), theme), 1 - prop(st, 'Transparency'))}`; }
    const cr = mod(n, 'UICorner'); if (cr) el.dataset.corner = JSON.stringify(prop(cr, 'CornerRadius'));
    const ar = mod(n, 'UIAspectRatioConstraint'); if (ar) { el.dataset.ar = prop(ar, 'AspectRatio'); el.dataset.dom = prop(ar, 'DominantAxis'); }
    const sc = mod(n, 'UIScale'); el.dataset.scale = sc ? prop(sc, 'Scale') : 1;
    const pd = mod(n, 'UIPadding');
    if (pd) { const [t, b, l, r] = ['PaddingTop', 'PaddingBottom', 'PaddingLeft', 'PaddingRight'].map((k) => prop(pd, k)); inner.style.inset = `${pct(t[0], t[1])} ${pct(r[0], r[1])} ${pct(b[0], b[1])} ${pct(l[0], l[1])}`; }
    // text
    if (isText(n.cls)) {
      const span = document.createElement('span'); span.className = 'gt';
      const txt = n.cls === 'TextBox' && !P('Text') ? P('PlaceholderText') : P('Text');
      span.textContent = txt; inner.style.display = 'flex'; inner.style.justifyContent = alignFlex[P('TextXAlignment')]; inner.style.alignItems = alignFlex[P('TextYAlignment')];
      span.style.textAlign = P('TextXAlignment').toLowerCase(); span.style.font = FONTS[fontOf(P('Font'), theme)] || FONTS.GothamBold;
      const tc = n.cls === 'TextBox' && !P('Text') ? color(P('PlaceholderColor3'), theme) : color(P('TextColor3'), theme);
      span.style.color = rgba(tc, 1 - P('TextTransparency')); span.style.whiteSpace = P('TextWrapped') ? 'normal' : 'nowrap';
      if (g) { span.style.backgroundImage = gradCss(g, theme, tc, 1 - P('TextTransparency')); span.style.webkitBackgroundClip = 'text'; span.style.backgroundClip = 'text'; span.style.color = 'transparent'; }
      const outline = [];
      if (P('TextStrokeTransparency') < 1) outline.push({ c: color(P('TextStrokeColor3'), theme), a: 1 - P('TextStrokeTransparency'), w: 1 });
      if (st && prop(st, 'ApplyStrokeMode') === 'Contextual') outline.push({ c: color(prop(st, 'Color'), theme), a: 1 - prop(st, 'Transparency'), w: prop(st, 'Thickness') });
      if (outline.length) { const o = outline[outline.length - 1]; span.style.webkitTextStroke = `${o.w * 2}px ${rgba(o.c, o.a)}`; span.style.paintOrder = 'stroke fill'; }
      const tsc = mod(n, 'UITextSizeConstraint');
      el.dataset.ts = P('TextScaled') ? JSON.stringify([tsc ? prop(tsc, 'MinTextSize') : 1, tsc ? prop(tsc, 'MaxTextSize') : 100]) : '';
      span.style.fontSize = P('TextSize') + 'px'; inner.appendChild(span);
    }
    if (n.cls === 'ImageLabel' || n.cls === 'ImageButton') { const im = document.createElement('div'); im.className = 'gimg'; const id = String(P('Image') || '').match(/\d{4,}/);
      im.textContent = id ? '🖼 ' + id[0] : '🖼'; im.style.opacity = 1 - P('ImageTransparency'); im.style.color = color(P('ImageColor3'), theme); inner.appendChild(im); }
    if (isButton(n.cls) || n.cls === 'TextBox') el.classList.add('gbtn');
    // children: layouts
    const ll = mod(n, 'UIListLayout'), gl = mod(n, 'UIGridLayout'); let childLayout = null, childCell = null;
    if (ll) { const v = prop(ll, 'FillDirection') === 'Vertical', gap = prop(ll, 'Padding'); inner.style.display = 'flex'; inner.style.flexDirection = v ? 'column' : 'row';
      inner.style.gap = pct(gap[0], gap[1]); inner.style.alignItems = alignFlex[v ? prop(ll, 'HorizontalAlignment') : prop(ll, 'VerticalAlignment')];
      inner.style.justifyContent = alignFlex[v ? prop(ll, 'VerticalAlignment') : prop(ll, 'HorizontalAlignment')]; childLayout = 'list'; }
    else if (gl) { const cp = prop(gl, 'CellPadding'); inner.style.display = 'flex'; inner.style.flexWrap = 'wrap'; inner.style.flexDirection = prop(gl, 'FillDirection') === 'Vertical' ? 'column' : 'row';
      inner.style.alignContent = 'flex-start'; inner.style.justifyContent = alignFlex[prop(gl, 'HorizontalAlignment')];
      inner.style.rowGap = pct(cp[2], cp[3]); inner.style.columnGap = pct(cp[0], cp[1]); childLayout = 'grid'; childCell = prop(gl, 'CellSize'); }
    if (n.cls === 'ScrollingFrame' && childLayout) { inner.style.overflow = 'auto'; }
    for (const c of guiKids(n)) build(c, inner, childLayout, childCell);
    parentEl.appendChild(el);
  };
  const screen = document.createElement('div'); screen.className = 'gscreen'; stage.appendChild(screen);
  for (const c of guiKids(root)) build(c, screen, null, null);
  layoutPass(stage);
  return map;
}
export function gradCss(g, theme, base, alpha) {
  const stops = prop(g, 'Color'), tr = prop(g, 'Transparency'), rot = prop(g, 'Rotation') || 0, off = prop(g, 'Offset') || [0, 0];
  const b = hexRgb(base).map((v) => v / 255);
  const tAt = (t) => { const s = [...tr].sort((x, y) => x.t - y.t); if (t <= s[0].t) return s[0].v; for (let i = 0; i < s.length - 1; i++) if (t <= s[i + 1].t) { const k = (t - s[i].t) / (s[i + 1].t - s[i].t || 1); return s[i].v + (s[i + 1].v - s[i].v) * k; } return s[s.length - 1].v; };
  const cs = [...stops].sort((x, y) => x.t - y.t).map((s) => ({ t: s.t, c: hexRgb(color(s.c, theme)) }));
  const cAt = (t) => { if (t <= cs[0].t) return cs[0].c; for (let i = 0; i < cs.length - 1; i++) if (t <= cs[i + 1].t) { const k = (t - cs[i].t) / (cs[i + 1].t - cs[i].t || 1); return cs[i].c.map((v, j) => v + (cs[i + 1].c[j] - v) * k); } return cs[cs.length - 1].c; };
  // Roblox evaluates colour and transparency sequences independently: use every keypoint time of both
  const times = [...new Set([0, 1, ...cs.map((s) => s.t), ...tr.map((s) => s.t)])].sort((x, y) => x - y);
  const parts = times.map((t) => { const c = cAt(t).map((v, i) => v * b[i]), a = alpha * (1 - tAt(t));
    return `rgba(${c.map(Math.round).join(',')},${a.toFixed(3)}) ${((t + off[0]) * 100).toFixed(1)}%`; });
  return `linear-gradient(${90 + rot}deg, ${parts.join(', ')})`;
}
/** After layout: aspect ratios, corner radii, TextScaled, then transforms (anchor, rotation, UIScale). */
export function layoutPass(stage) {
  stage.querySelectorAll('.gn[data-ar]').forEach((el) => { const ar = +el.dataset.ar || 1, w = el.offsetWidth, h = el.offsetHeight;
    if (el.dataset.dom === 'Height') el.style.width = h * ar + 'px'; else el.style.height = w / ar + 'px'; });
  stage.querySelectorAll('.gn').forEach((el) => {
    if (el.dataset.corner) { const [s, o] = JSON.parse(el.dataset.corner), r = s * Math.min(el.offsetWidth, el.offsetHeight) + o; el.style.borderRadius = Math.max(0, r) + 'px'; }
    applyTransform(el, {});
  });
  stage.querySelectorAll('.gn[data-ts]').forEach((el) => { if (!el.dataset.ts) return; const [mn, mx] = JSON.parse(el.dataset.ts), span = el.querySelector(':scope > .gc > .gt'), box = el.querySelector(':scope > .gc'); if (!span) return;
    let lo = mn, hi = Math.min(mx, Math.max(mn, box.clientHeight)); span.style.fontSize = hi + 'px';
    if (span.scrollWidth > box.clientWidth + 0.5 || span.offsetHeight > box.clientHeight + 0.5) {
      for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2; span.style.fontSize = m + 'px'; if (span.scrollWidth > box.clientWidth + 0.5 || span.offsetHeight > box.clientHeight + 0.5) hi = m; else lo = m; }
      span.style.fontSize = lo + 'px'; } });
}
/** Channels -> CSS transform (anchor + Position offsets + rotation + scale), like the Luau runtime sets Position/Rotation/UIScale. */
export function applyTransform(el, c) {
  const ax = +el.dataset.ax * 100, ay = +el.dataset.ay * 100, rot = (+el.dataset.rot || 0) + (c.R || 0), sc = (+el.dataset.scale || 1) * (c.S === undefined ? 1 : c.S);
  const par = el.parentElement; const pw = par ? par.clientWidth : 0, ph = par ? par.clientHeight : 0;
  const dx = (c.X || 0) * pw, dy = (c.Y || 0) * ph + (c.Yo || 0);
  el.style.transform = `translate(${dx}px, ${dy}px) translate(${-ax}%, ${-ay}%) rotate(${rot}deg) scale(${sc})`;
  el.style.transformOrigin = `${ax}% ${ay}%`;
}

/* ---------------- Rojo export ---------------- */
const rgb01 = (h) => hexRgb(h).map((v) => +(v / 255).toFixed(4));
const r4 = (v) => +(+v).toFixed(4) || 0;
function value(type, v, theme) { // Rojo implicit forms (the property type comes from Roblox's reflection database)
  switch (type) {
    case 'udim2': return { UDim2: [[r4(v[0]), Math.round(v[1])], [r4(v[2]), Math.round(v[3])]] };
    case 'udim': return { UDim: [r4(v[0]), Math.round(v[1])] };
    case 'vec2': return { Vector2: [r4(v[0]), r4(v[1])] };
    case 'color': return rgb01(color(v, theme));
    case 'colorseq': { const s = [...v].sort((a, b) => a.t - b.t); if (s[0].t > 0) s.unshift({ ...s[0], t: 0 }); if (s[s.length - 1].t < 1) s.push({ ...s[s.length - 1], t: 1 });
      return { ColorSequence: { keypoints: s.map((k) => ({ time: r4(k.t), color: rgb01(color(k.c, theme)) })) } }; }
    case 'numseq': { const s = [...v].sort((a, b) => a.t - b.t); if (s[0].t > 0) s.unshift({ ...s[0], t: 0 }); if (s[s.length - 1].t < 1) s.push({ ...s[s.length - 1], t: 1 });
      return { NumberSequence: { keypoints: s.map((k) => ({ time: r4(k.t), value: r4(k.v), envelope: 0 })) } }; }
    case 'num': case 't01': return r4(v);
    case 'int': return Math.round(v);
    case 'bool': return !!v;
    case 'text': return String(v ?? '');
    case 'image': { const id = String(v || '').match(/\d{4,}/); return id ? 'rbxassetid://' + id[0] : ''; }
    default: return v; // enums by name
  }
}
export function toModel(root, theme, behaviours = true) {
  const conv = (n) => {
    const props = {}, schema = SCHEMA[n.cls] || [];
    for (const [k, type] of schema) {
      let v = n.props && n.props[k] !== undefined ? n.props[k] : undefined;
      if (v === undefined) { if (n.cls === 'ScreenGui' || isMod(n.cls)) v = DEFAULTS[n.cls][k]; else if (['Size', 'BackgroundColor3', 'TextColor3', 'Text', 'Font', 'TextScaled', 'TextWrapped'].includes(k)) v = DEFAULTS[n.cls][k]; else continue; }
      if (k === 'Font') v = fontOf(v, theme);
      props[k] = value(type, v, theme);
    }
    if (!isMod(n.cls) && n.cls !== 'ScreenGui') props.BorderSizePixel = 0;
    if (n.cls === 'TextButton' || n.cls === 'ImageButton') { if (!('AutoButtonColor' in props)) props.AutoButtonColor = false; }
    if (n.cls === 'ScreenGui') props.ZIndexBehavior = 'Sibling';
    const out = { name: n.name, className: n.cls, properties: props, children: (n.children || []).map(conv) };
    const a = n.anim || {}, attrs = {};
    if (behaviours) {
      if (a.open && a.open !== 'none') attrs.ForgeOpen = a.open;
      if (a.window) attrs.ForgeWindow = true;
      if (a.dur && a.dur !== 0.45) attrs.ForgeDur = r4(a.dur);
      if (a.hover && a.hover !== 'none') attrs.ForgeHover = a.hover;
      if (a.press && a.press !== 'none') attrs.ForgePress = a.press;
      if (a.idle && a.idle !== 'none') { attrs.ForgeIdle = a.idle; if (a.period && a.period !== 1.6) attrs.ForgePeriod = r4(a.period); }
      if (a.action && a.action !== 'none') { attrs.ForgeAction = a.action; if (a.target) attrs.ForgeTarget = a.target; if (a.action === 'roll') { attrs.ForgeRollItems = a.items || ''; } }
      if (a.bind) { attrs.ForgeBind = a.bind; attrs.ForgeFormat = a.format || '{v}'; }
      if (n.cls === 'ScreenGui') attrs.ForgeGui = true;
    }
    if (Object.keys(attrs).length) out.attributes = attrs;
    return out;
  };
  return conv(root);
}
