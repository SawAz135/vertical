/* Roblox Forge - "Stud" GUI kit: the bright, studded, thick-outlined look of popular
   simulator games (daily rewards, shop rows, gamepass store, confirm dialog, gear list,
   index, rebirth, auras, HUD buttons). Original layouts in the genre's style.
   Studs are real: frames tagged with anim.studs get a ForgeStuds attribute and
   ForgeGuiAnim.client.lua fills them with stud dots that follow the frame's size. */
import { N, corner, stroke, grad, list, gridL, aspect, tsize } from './gui-core.js';

const K = '#000000';
const out = (th = 2.4) => stroke(K, th, 0, 'Contextual');
const T = (name, text, props = {}, kids = [], anim) => N('TextLabel', name, { Text: text, BackgroundTransparency: 1, TextColor3: '#ffffff', Font: '$font', TextScaled: true, ...props }, [out(), ...kids], anim ? { anim } : {});
const F = (name, props = {}, kids = [], anim) => N('Frame', name, { BackgroundTransparency: 1, ...props }, kids, anim ? { anim } : {});
/** Studded block: gradient + black outline + rounded corners + stud dots. */
const blockKids = (g, r = 10, th = 3.5) => [corner(0, r), grad(g, 90), stroke(K, th, 0, 'Border')];
const Blk = (name, g, props = {}, kids = [], anim = {}, s = 18) => N('Frame', name, { BackgroundColor3: '#ffffff', ...props }, [...blockKids(g), ...kids], { anim: { studs: s, ...anim } });
/** Studded button with its text in a child label (a UIGradient would tint the button's own text). */
const Btn = (name, text, g, props = {}, anim = {}, kids = [], s = 14) => N('TextButton', name, { Text: '', BackgroundColor3: '#ffffff', AutoButtonColor: false, ...props }, [
  ...blockKids(g, 8, 3), ...kids,
  ...(text ? [T('Label', text, { Size: [0.9, 0, 0.7, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: (props.ZIndex || 1) + 2 })] : []),
], { anim: { hover: 'grow', press: 'squish', studs: s, ...anim } });

export const COL = {
  yellow: ['#ffe14a', '#ffb000'], magenta: ['#ff5df2', '#c018d6'], blue: ['#3fd0ff', '#1677ff'], orange: ['#ffc23a', '#ff7b00'], green: ['#7dff5a', '#1fbf2c'],
  pink: ['#ff6fb5', '#e0157a'], red: ['#ff5a5a', '#d61f1f'], purple: ['#c46bff', '#7a1fe0'], teal: ['#3fe8d8', '#0b9e9a'], grey: ['#e6e6e6', '#9c9c9c'],
  navy: ['#3b4170', '#1d2140'], wood: ['#c98a4b', '#8a5428'], sky: ['#8be3ff', '#4fb4ff'], rainbow: ['#ff4d4d', '#ffb800', '#47e04a', '#2fb4ff', '#b04dff'],
};

/** A stud window: full-width studded title bar with icon, red X, studded body. */
function win(name, title, icon, ar, content, o = {}) {
  const tg = o.title || COL.blue, bg = o.body || ['#f4f9ff', '#d6e8ff'];
  return N('Frame', name, { Size: [0.62, 0, 0.78, 0], Position: [0.5, 0, 0.52, 0], AnchorPoint: [0.5, 0.5], BackgroundColor3: '#ffffff', Visible: o.vis !== false, ZIndex: 5 }, [
    corner(0, 12), grad(bg, 90), stroke(K, 4, 0, 'Border'), aspect(ar),
    N('Frame', 'TitleBar', { Size: [1, 0, o.th || 0.15, 0], BackgroundColor3: '#ffffff', ZIndex: 6 }, [...blockKids(tg, 12, 4),
      T('Icon', icon, { Size: [0.12, 0, 0.9, 0], Position: [0.015, 0, 0.5, 0], AnchorPoint: [0, 0.5], ZIndex: 8 }, [], { idle: 'wiggle', period: 2.2 }),
      T('Title', title, { Size: [0.66, 0, 0.66, 0], Position: [0.13, 0, 0.5, 0], AnchorPoint: [0, 0.5], TextXAlignment: 'Left', ZIndex: 8 })], { anim: { studs: 20 } }),
    Btn('Close', '✕', COL.red, { Size: [0.11, 0, (o.th || 0.15) * 0.78, 0], Position: [0.985, 0, (o.th || 0.15) / 2, 0], AnchorPoint: [1, 0.5], ZIndex: 9 }, { action: 'close' }, [N('UIAspectRatioConstraint', 'UIAspectRatioConstraint', { AspectRatio: 1, DominantAxis: 'Height' })]),
    F('Content', { Size: [0.95, 0, 1 - (o.th || 0.15) - 0.06, 0], Position: [0.5, 0, (o.th || 0.15) + 0.03, 0], AnchorPoint: [0.5, 0], ZIndex: 6 }, content),
  ], { anim: { open: o.open || 'pop', window: true, dur: 0.42, ...(o.studs ? { studs: o.studs } : {}) } });
}
const iconBox = (name, ic, props = {}) => N('Frame', name, { BackgroundColor3: '#ffffff', BackgroundTransparency: 0.05, ZIndex: 8, ...props }, [corner(0, 6), stroke(K, 2.5, 0, 'Border'), grad(['#ffffff', '#e8edf5'], 90),
  T('Icon', ic, { Size: [0.8, 0, 0.8, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 9 }, [], { idle: 'float', period: 2 })]);

/* ---------- Daily rewards ---------- */
function daily(vis) {
  const C = [COL.yellow, COL.magenta, COL.blue, COL.orange, COL.green, COL.pink, COL.yellow], IC = ['🪙', '💎', '🧪', '🍀', '🥚', '⚡', '👑'];
  const W = 0.235, H = 0.47, gx = 0.02;
  const cards = C.map((g, i) => { const big = i === 6, col = i < 4 ? i : i - 4, row = i < 4 ? 0 : 1;
    return Blk('Day' + (i + 1), g, { Size: [big ? W * 2 + gx : W, 0, H, 0], Position: [col * (W + gx) + 0.005, 0, row * (H + 0.04), 0], ZIndex: 7, LayoutOrder: i }, [
      T('Day', 'Jour ' + (i + 1), { Size: [0.9, 0, 0.16, 0], Position: [0.5, 0, 0.03, 0], AnchorPoint: [0.5, 0], ZIndex: 9 }),
      iconBox('Item', IC[i], { Size: [big ? 0.28 : 0.56, 0, 0.42, 0], Position: [0.5, 0, 0.21, 0], AnchorPoint: [0.5, 0] }),
      T('ItemName', ['500 Coins', '25 Gems', 'Potion x2', 'Chance x2', 'Œuf Rare', 'Boost 1h', 'Pet Exclusif'][i], { Size: [0.9, 0, 0.11, 0], Position: [0.5, 0, 0.65, 0], AnchorPoint: [0.5, 0], ZIndex: 9 }),
      Btn('Claim', i === 0 ? 'Récupérer' : 'Récupérer', i === 0 ? COL.green : COL.grey, { Size: [0.84, 0, 0.17, 0], Position: [0.5, 0, 0.96, 0], AnchorPoint: [0.5, 1], ZIndex: 9 }, i === 0 ? { idle: 'pulse', period: 1.2 } : {}),
    ], big ? { idle: 'shine', period: 2.4 } : {}); });
  return win('Daily', 'Récompenses', '📅', 1.55, cards, { vis, title: COL.blue });
}

/* ---------- Shop rows (luck, starter pack, pro pack) ---------- */
function shop(vis) {
  const row = (name, g, title, sub, price, tiles, i, extra = []) => Blk(name, g, { Size: [1, 0, 0, 0], LayoutOrder: i, ZIndex: 7 }, [aspect(3.4),
    T('Title', title, { Size: [0.5, 0, 0.26, 0], Position: [0.03, 0, 0.08, 0], TextXAlignment: 'Left', ZIndex: 9 }),
    sub ? T('Sub', sub, { Size: [0.46, 0, 0.36, 0], Position: [0.03, 0, 0.38, 0], TextXAlignment: 'Left', TextWrapped: true, TextColor3: '#fff37a', ZIndex: 9 }) : F('Sub'),
    ...tiles.map(([ic, cap], k) => Blk('Tile' + (k + 1), [COL.sky, COL.orange, COL.green][k % 3], { Size: [0.17, 0, 0.62, 0], Position: [0.03 + k * 0.185, 0, 0.32, 0], ZIndex: 8 }, [
      T('Icon', ic, { Size: [0.8, 0, 0.6, 0], Position: [0.5, 0, 0.06, 0], AnchorPoint: [0.5, 0], ZIndex: 9 }), T('Cap', cap, { Size: [0.92, 0, 0.26, 0], Position: [0.5, 0, 0.95, 0], AnchorPoint: [0.5, 1], ZIndex: 9 })], {}, 12)),
    ...extra,
    Btn('Buy', ' ' + price, COL.green, { Size: [0.27, 0, 0.32, 0], Position: [0.96, 0, 0.88, 0], AnchorPoint: [1, 1], ZIndex: 9 }, { idle: 'pulse', period: 1.6 }),
  ]);
  return win('Shop', 'Boutique', '🛍️', 1.6, [N('ScrollingFrame', 'List', { Size: [1, 0, 1, 0], BackgroundTransparency: 1, ScrollBarThickness: 8, ScrollBarImageColor3: '#1d2140', AutomaticCanvasSize: 'Y', CanvasSize: [0, 0, 0, 0], ZIndex: 7 }, [list('Vertical', 10, 'Center', 'Top'),
    row('ServerLuck', COL.teal, 'Chance du serveur !', 'Les meilleurs pets apparaissent plus souvent', '⏣ 19', [], 0, [T('Luck', 'Chance = 1x', { Size: [0.34, 0, 0.26, 0], Position: [0.96, 0, 0.1, 0], AnchorPoint: [1, 0], ZIndex: 9 }), T('Clover', '🍀', { Size: [0.14, 0, 0.5, 0], Position: [0.52, 0, 0.25, 0], ZIndex: 9 }, [], { idle: 'spin', period: 6 })]),
    row('StarterPack', COL.blue, 'Pack de départ', null, '⏣ 599', [['🐶', 'Pet rare'], ['🗡️', 'Épée'], ['💰', '+100K']], 1, [T('Limited', 'Temps limité', { Size: [0.26, 0, 0.16, 0], Position: [0.96, 0, 0.1, 0], AnchorPoint: [1, 0], TextColor3: '#ffd84a', ZIndex: 9 })]),
    row('ProPack', [COL.red[0], COL.purple[1]], 'Pack Pro', null, '⏣ 1499', [['🐉', 'Pet légendaire'], ['🍀', 'Chance x2'], ['💎', '+5K gemmes']], 2, [T('Limited', 'Temps limité', { Size: [0.26, 0, 0.16, 0], Position: [0.96, 0, 0.1, 0], AnchorPoint: [1, 0], TextColor3: '#ffd84a', ZIndex: 9 })]),
  ])], { vis, title: COL.blue, body: COL.sky });
}

/* ---------- Gamepass store with side tabs ---------- */
function store(vis) {
  const tabs = [['Pets', '🐾', COL.blue], ['Passes', '🏪', COL.red], ['Wins', '🏆', COL.yellow], ['Boosts', '⚡', COL.purple]];
  const passes = [['+2 Pets équipés', '🐶', COL.sky, '+2'], ['+4 Pets équipés', '🐶', COL.purple, '+4'], ['Chanceux', '🍀', COL.green, ''], ['Super chanceux', '🍀', COL.yellow, 'x3'], ['x3 Œufs', '🥚', COL.magenta, 'x3'], ['x6 Œufs', '🥚', COL.red, 'x6']];
  return win('Store', 'Boutique Gamepass', '👑', 1.6, [
    F('Tabs', { Size: [0.13, 0, 1, 0], Position: [-0.005, 0, 0, 0] }, [list('Vertical', 8, 'Center', 'Top'),
      ...tabs.map(([n, ic, g], i) => Btn(n + 'Tab', '', g, { Size: [1, 0, 0.23, 0], LayoutOrder: i, ZIndex: 8 }, {}, [
        T('Icon', ic, { Size: [0.7, 0, 0.55, 0], Position: [0.5, 0, 0.06, 0], AnchorPoint: [0.5, 0], ZIndex: 10 }), T('Cap', n, { Size: [0.96, 0, 0.3, 0], Position: [0.5, 0, 0.97, 0], AnchorPoint: [0.5, 1], ZIndex: 10 })]))]),
    Blk('VIP', COL.rainbow, { Size: [0.24, 0, 1, 0], Position: [0.15, 0, 0, 0], ZIndex: 7 }, [
      N('Frame', 'Badge', { Size: [0.8, 0, 0.8, 0], Position: [0.5, 0, 0.06, 0], AnchorPoint: [0.5, 0], BackgroundColor3: '#ffffff', ZIndex: 8 }, [corner(1, 0), grad(COL.orange, 90), stroke(K, 3, 0, 'Border'), aspect(1),
        T('Label', '👑 VIP', { Size: [0.8, 0, 0.5, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 9 })], { anim: { idle: 'pulse', period: 1.4 } }),
      T('Desc', 'x1.5 Force et Victoires !', { Size: [0.9, 0, 0.2, 0], Position: [0.5, 0, 0.42, 0], AnchorPoint: [0.5, 0], TextWrapped: true, ZIndex: 9 }),
      T('Price', '699 R$', { Size: [0.7, 0, 0.1, 0], Position: [0.5, 0, 0.66, 0], AnchorPoint: [0.5, 0], TextColor3: '#7dff5a', ZIndex: 9 }),
      Btn('Buy', 'Acheter', COL.green, { Size: [0.7, 0, 0.12, 0], Position: [0.5, 0, 0.95, 0], AnchorPoint: [0.5, 1], ZIndex: 9 }, { idle: 'pulse', period: 1.2 })], { idle: 'shine', period: 2.6 }),
    N('ScrollingFrame', 'Passes', { Size: [0.59, 0, 1, 0], Position: [0.41, 0, 0, 0], BackgroundTransparency: 1, ScrollBarThickness: 8, ScrollBarImageColor3: '#1d2140', AutomaticCanvasSize: 'Y', CanvasSize: [0, 0, 0, 0], ZIndex: 7 }, [
      gridL([0.31, 0, 0.47, 0], [0.025, 0, 0.03, 0], 'Left'),
      ...passes.map(([n, ic, g, tag], i) => Blk('Pass' + (i + 1), g, { LayoutOrder: i, ZIndex: 8 }, [
        T('Name', n, { Size: [0.92, 0, 0.18, 0], Position: [0.5, 0, 0.04, 0], AnchorPoint: [0.5, 0], ZIndex: 10 }),
        N('Frame', 'Coin', { Size: [0.62, 0, 0.62, 0], Position: [0.5, 0, 0.27, 0], AnchorPoint: [0.5, 0], BackgroundColor3: '#ffffff', ZIndex: 9 }, [corner(1, 0), grad(['#ffffff', g[1]], 90), stroke(K, 3, 0, 'Border'), aspect(1),
          T('Icon', ic, { Size: [0.6, 0, 0.6, 0], Position: [0.5, 0, 0.45, 0], AnchorPoint: [0.5, 0.5], ZIndex: 10 }), T('Tag', tag, { Size: [0.6, 0, 0.3, 0], Position: [0.5, 0, 0.98, 0], AnchorPoint: [0.5, 1], ZIndex: 11 })]),
      ], {}, 14))]),
  ], { vis, title: COL.purple, body: ['#ffffff', '#eef0ff'] });
}

/* ---------- Confirm dialog ---------- */
function confirm(vis) {
  return win('Confirm', 'Confirmer', '✅', 1.75, [
    T('Question', 'Veux-tu vraiment vendre ton pet pour 1 000 067 $ ?', { Size: [0.92, 0, 0.5, 0], Position: [0.5, 0, 0.02, 0], AnchorPoint: [0.5, 0], TextWrapped: true, ZIndex: 8 }),
    Btn('Yes', 'CONFIRMER', COL.green, { Size: [0.44, 0, 0.32, 0], Position: [0.03, 0, 0.94, 0], AnchorPoint: [0, 1], ZIndex: 8 }, { action: 'close', idle: 'pulse', period: 1.4 }),
    Btn('No', 'ANNULER', COL.red, { Size: [0.44, 0, 0.32, 0], Position: [0.97, 0, 0.94, 0], AnchorPoint: [1, 1], ZIndex: 8 }, { action: 'close' }),
  ], { vis, title: COL.teal, body: ['#1f6f78', '#103c44'], studs: 22 });
}

/* ---------- Gear list (wood) ---------- */
function gears(vis) {
  const R = [['Commun', COL.grey], ['Rare', COL.blue], ['Épique', COL.purple], ['Légendaire', COL.orange]];
  return win('Gears', 'Équipements !', '🛠️', 1.55, [N('ScrollingFrame', 'List', { Size: [1, 0, 1, 0], BackgroundTransparency: 1, ScrollBarThickness: 8, ScrollBarImageColor3: '#3b2410', AutomaticCanvasSize: 'Y', CanvasSize: [0, 0, 0, 0], ZIndex: 7 }, [list('Vertical', 8, 'Center', 'Top'),
    ...['🪛', '🔨', '⛏️', '🗡️'].map((ic, i) => Blk('Gear' + (i + 1), ['#7a4b22', '#4f2e12'], { Size: [1, 0, 0, 0], LayoutOrder: i, ZIndex: 8 }, [aspect(4.6),
      N('Frame', 'IconBox', { Size: [0.19, 0, 0.84, 0], Position: [0.02, 0, 0.5, 0], AnchorPoint: [0, 0.5], BackgroundColor3: '#1a1008', ZIndex: 9 }, [corner(0, 6), stroke(K, 2.5, 0, 'Border'),
        T('Icon', ic, { Size: [0.8, 0, 0.8, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 10 })]),
      T('Name', 'Outil ' + (i + 1), { Size: [0.42, 0, 0.3, 0], Position: [0.24, 0, 0.1, 0], TextXAlignment: 'Left', ZIndex: 9 }),
      T('Stock', 'x' + (i + 1) + ' en stock', { Size: [0.3, 0, 0.18, 0], Position: [0.24, 0, 0.42, 0], TextXAlignment: 'Left', TextColor3: '#e8d6b8', ZIndex: 9 }),
      T('Price', ['$10k', '$25k', '$50k', '$250k'][i], { Size: [0.3, 0, 0.3, 0], Position: [0.24, 0, 0.62, 0], TextXAlignment: 'Left', TextColor3: '#7dff5a', ZIndex: 9 }),
      Btn('Rarity', R[i][0], R[i][1], { Size: [0.26, 0, 0.32, 0], Position: [0.97, 0, 0.86, 0], AnchorPoint: [1, 1], ZIndex: 9 }),
      Btn('Info', 'i', COL.blue, { Size: [0.07, 0, 0.26, 0], Position: [0.97, 0, 0.08, 0], AnchorPoint: [1, 0], ZIndex: 9 }, {}, [aspect(1)]),
    ], {}, 16))])], { vis, title: COL.wood, body: COL.wood, studs: 22 });
}

/* ---------- Index (pets to discover) ---------- */
function index(vis) {
  return win('Index', 'Index', '📘', 1.6, [N('ScrollingFrame', 'Grid', { Size: [1, 0, 1, 0], BackgroundTransparency: 1, ScrollBarThickness: 8, ScrollBarImageColor3: '#7a1fe0', AutomaticCanvasSize: 'Y', CanvasSize: [0, 0, 0, 0], ZIndex: 7 }, [
    gridL([0.18, 0, 0.3, 0], [0.025, 0, 0.035, 0], 'Center'),
    ...Array.from({ length: 15 }, (_, i) => Blk('Slot' + (i + 1), i < 3 ? [COL.yellow, COL.blue, COL.green][i] : COL.navy, { LayoutOrder: i, ZIndex: 8 }, [
      T('Icon', i < 3 ? ['🐺', '🐯', '🦊'][i] : '?', { Size: [0.7, 0, 0.62, 0], Position: [0.5, 0, 0.06, 0], AnchorPoint: [0.5, 0], ZIndex: 10 }),
      T('Name', i < 3 ? ['Loup', 'Tigre', 'Renard'][i] : '???', { Size: [0.9, 0, 0.22, 0], Position: [0.5, 0, 0.95, 0], AnchorPoint: [0.5, 1], ZIndex: 10 })], i < 3 ? { hover: 'grow' } : {}, 12))])],
  { vis, title: COL.purple, body: ['#23284a', '#141833'], studs: 24 });
}

/* ---------- Rebirth ---------- */
function rebirth(vis) {
  return win('Rebirth', 'Rebirth', '♻️', 1.55, [
    T('From', '0', { Size: [0.2, 0, 0.28, 0], Position: [0.25, 0, 0.04, 0], AnchorPoint: [0.5, 0], ZIndex: 8 }),
    T('Arrow', '➜', { Size: [0.2, 0, 0.22, 0], Position: [0.5, 0, 0.07, 0], AnchorPoint: [0.5, 0], TextColor3: '#ffd84a', ZIndex: 8 }, [], { idle: 'pulse', period: 1 }),
    T('To', '1', { Size: [0.2, 0, 0.28, 0], Position: [0.75, 0, 0.04, 0], AnchorPoint: [0.5, 0], TextColor3: '#7dff5a', ZIndex: 8 }),
    T('Info', 'Le rebirth remet ton argent à zéro mais donne x2 sur tout !', { Size: [0.9, 0, 0.16, 0], Position: [0.5, 0, 0.36, 0], AnchorPoint: [0.5, 0], TextColor3: '#ff8a8a', TextWrapped: true, ZIndex: 8 }),
    N('Frame', 'Bar', { Size: [0.9, 0, 0.13, 0], Position: [0.5, 0, 0.56, 0], AnchorPoint: [0.5, 0], BackgroundColor3: '#141833', ZIndex: 8 }, [corner(0.5, 0), stroke(K, 3, 0, 'Border'),
      N('Frame', 'Fill', { Size: [0.35, 0, 1, 0], BackgroundColor3: '#ffffff', ZIndex: 9 }, [corner(0.5, 0), grad(COL.green, 90)]),
      T('Label', '35 000 / 100 000', { Size: [1, 0, 0.8, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 10 })]),
    Btn('DoRebirth', 'Rebirth', COL.green, { Size: [0.42, 0, 0.2, 0], Position: [0.05, 0, 0.97, 0], AnchorPoint: [0, 1], ZIndex: 8 }, { idle: 'pulse', period: 1.4 }),
    Btn('Skip', 'Passer ⏣ 99', COL.blue, { Size: [0.42, 0, 0.2, 0], Position: [0.95, 0, 0.97, 0], AnchorPoint: [1, 1], ZIndex: 8 }),
  ], { vis, title: COL.blue, body: ['#2a2f55', '#171a36'], studs: 24 });
}

/* ---------- Auras / trails picker ---------- */
function auras(vis) {
  const C = [['#7a3cff', '#2a0a6b'], COL.yellow, COL.orange, COL.green, COL.sky, COL.yellow, COL.magenta, COL.blue, COL.red, COL.teal];
  return [
    F('AuraMenu', { Size: [0.16, 0, 0.3, 0], Position: [0.985, 0, 0.5, 0], AnchorPoint: [1, 0.5] }, [list('Vertical', 12, 'Right', 'Center'),
      Btn('AurasButton', 'Auras', COL.pink, { Size: [1, 0, 0.42, 0], LayoutOrder: 0, ZIndex: 4 }, { action: 'toggle', target: 'Auras' }),
      Btn('TrailsButton', 'Traînées', COL.blue, { Size: [1, 0, 0.42, 0], LayoutOrder: 1, ZIndex: 4 }, { action: 'toggle', target: 'Auras' })]),
    win('Auras', 'Auras · plus de puissance', '✨', 1.6, [
      N('ScrollingFrame', 'Grid', { Size: [0.66, 0, 1, 0], BackgroundTransparency: 1, ScrollBarThickness: 8, ScrollBarImageColor3: '#3b2410', AutomaticCanvasSize: 'Y', CanvasSize: [0, 0, 0, 0], ZIndex: 7 }, [
        gridL([0.22, 0, 0.3, 0], [0.03, 0, 0.04, 0], 'Left'),
        ...C.map((g, i) => Btn('Aura' + (i + 1), '', g, { LayoutOrder: i, ZIndex: 8 }, i === 0 ? { idle: 'pulse', period: 1.2 } : {}, [
          T('Icon', ['🔥', '⚡', '🌟', '🍀', '❄️', '☀️', '💜', '🌊', '❤️', '🌀'][i], { Size: [0.7, 0, 0.7, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 10 }, [], { idle: 'float', period: 1.6 + i * 0.1 })]))]),
      Blk('Selected', ['#a26a33', '#6b4019'], { Size: [0.31, 0, 1, 0], Position: [1, 0, 0, 0], AnchorPoint: [1, 0], ZIndex: 7 }, [
        T('Head', 'Choisis une aura', { Size: [0.9, 0, 0.12, 0], Position: [0.5, 0, 0.03, 0], AnchorPoint: [0.5, 0], ZIndex: 9 }),
        N('Frame', 'Preview', { Size: [0.8, 0, 0.5, 0], Position: [0.5, 0, 0.17, 0], AnchorPoint: [0.5, 0], BackgroundColor3: '#ffffff', ZIndex: 8 }, [corner(0, 8), grad(['#2a1a0b', '#120a04'], 90), stroke(K, 3, 0, 'Border'),
          T('Icon', '🔥', { Size: [0.7, 0, 0.7, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 9 }, [], { idle: 'pulse', period: 0.9 })]),
        T('Mult', 'x???', { Size: [0.6, 0, 0.1, 0], Position: [0.5, 0, 0.7, 0], AnchorPoint: [0.5, 0], TextColor3: '#7dff5a', ZIndex: 9 }),
        Btn('Equip', 'Équiper', COL.green, { Size: [0.84, 0, 0.13, 0], Position: [0.5, 0, 0.96, 0], AnchorPoint: [0.5, 1], ZIndex: 9 }, { idle: 'pulse', period: 1.4 })]),
    ], { vis, title: COL.green, body: COL.wood, studs: 22 }),
  ];
}

/* ---------- HUD: studded square menu, top pills, money ---------- */
function hud() {
  const btns = [['Shop', '🛍️', COL.pink, 'Shop'], ['Index', '📘', COL.blue, 'Index'], ['Rebirth', '♻️', COL.red, 'Rebirth'], ['Quests', '📜', COL.purple, 'Daily'], ['Codes', '🎟️', COL.teal, 'Gears'], ['Options', '⚙️', COL.navy, 'Confirm']];
  return [
    F('StudMenu', { Size: [0.15, 0, 0.42, 0], Position: [0.012, 0, 0.5, 0], AnchorPoint: [0, 0.5] }, [gridL([0.47, 0, 0.3, 0], [0.04, 0, 0.04, 0], 'Left'),
      ...btns.map(([n, ic, g, tgt], i) => Btn(n + 'Button', '', g, { LayoutOrder: i, ZIndex: 3 }, { action: 'toggle', target: tgt }, [
        T('Icon', ic, { Size: [0.72, 0, 0.62, 0], Position: [0.5, 0, 0.04, 0], AnchorPoint: [0.5, 0], ZIndex: 5 }),
        T('Cap', n, { Size: [1.05, 0, 0.32, 0], Position: [0.5, 0, 1.02, 0], AnchorPoint: [0.5, 1], ZIndex: 5 }),
        ...(i === 0 ? [N('Frame', 'Badge', { Size: [0.34, 0, 0.34, 0], Position: [1.02, 0, -0.04, 0], AnchorPoint: [1, 0], BackgroundColor3: '#ff2d2d', ZIndex: 6 }, [corner(1, 0), stroke(K, 2.5, 0, 'Border'), aspect(1),
          T('Label', '!', { Size: [0.8, 0, 0.8, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 7 })], { anim: { idle: 'pulse', period: 0.8 } })] : []),
      ], 12))]),
    F('TopBar', { Size: [0.44, 0, 0.075, 0], Position: [0.5, 0, 0.02, 0], AnchorPoint: [0.5, 0] }, [list('Horizontal', 10, 'Center', 'Center'),
      ...[['Sell', 'Vendre', COL.green], ['Base', 'Base', COL.blue], ['ShopTop', 'Boutique', COL.orange]].map(([n, t, g], i) => Btn(n, t, g, { Size: [0.31, 0, 1, 0], LayoutOrder: i, ZIndex: 3 }, n === 'ShopTop' ? { action: 'toggle', target: 'Store' } : {}))]),
    F('Money', { Size: [0.3, 0, 0.14, 0], Position: [0.012, 0, 0.98, 0], AnchorPoint: [0, 1] }, [
      T('Boost', '😊 Boost amis : +15%', { Size: [1, 0, 0.32, 0], TextXAlignment: 'Left', TextColor3: '#ffd84a' }),
      T('Cash', '$0', { Size: [0.8, 0, 0.62, 0], Position: [0, 0, 1, 0], AnchorPoint: [0, 1], TextXAlignment: 'Left', TextColor3: '#7dff5a' }, [], { bind: 'Cash', format: '${v}' }),
      Btn('Plus', '+', COL.green, { Size: [0.15, 0, 0.5, 0], Position: [1, 0, 1, -2], AnchorPoint: [1, 1], ZIndex: 3 }, { action: 'toggle', target: 'Shop' }, [N('UIAspectRatioConstraint', 'UIAspectRatioConstraint', { AspectRatio: 1, DominantAxis: 'Height' })])]),
  ];
}

/* ---------- Trade (two offers, ready / cancel) ---------- */
function trade(vis) {
  const side = (name, title, g, x) => Blk(name, g, { Size: [0.47, 0, 0.74, 0], Position: [x, 0, 0.1, 0], ZIndex: 7 }, [
    T('Head', title, { Size: [0.9, 0, 0.14, 0], Position: [0.5, 0, 0.03, 0], AnchorPoint: [0.5, 0], ZIndex: 9 }),
    N('Frame', 'Slots', { Size: [0.92, 0, 0.76, 0], Position: [0.5, 0, 0.2, 0], AnchorPoint: [0.5, 0], BackgroundTransparency: 1, ZIndex: 8 }, [gridL([0.3, 0, 0.45, 0], [0.04, 0, 0.06, 0], 'Center'),
      ...Array.from({ length: 6 }, (_, i) => Blk('Slot' + (i + 1), COL.navy, { LayoutOrder: i, ZIndex: 9 }, [T('Icon', i < 2 ? ['🐉', '🦊'][i] : '', { Size: [0.7, 0, 0.7, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 10 })], {}, 10))])], {}, 18);
  return win('Trade', 'Échange', '🤝', 1.6, [
    T('With', 'Avec Joueur2', { Size: [0.6, 0, 0.08, 0], Position: [0.5, 0, 0, 0], AnchorPoint: [0.5, 0], ZIndex: 8 }),
    side('Mine', 'Ton offre', COL.blue, 0), side('Theirs', 'Son offre  ✔', COL.purple, 0.53),
    Btn('Ready', 'Prêt', COL.green, { Size: [0.3, 0, 0.13, 0], Position: [0.3, 0, 1, 0], AnchorPoint: [0.5, 1], ZIndex: 8 }, { idle: 'pulse', period: 1.4 }),
    Btn('Cancel', 'Annuler', COL.red, { Size: [0.3, 0, 0.13, 0], Position: [0.7, 0, 1, 0], AnchorPoint: [0.5, 1], ZIndex: 8 }, { action: 'close' }),
  ], { vis, title: COL.green, body: ['#2a2f55', '#171a36'], studs: 22 });
}

/* ---------- Season pass (free + premium tracks, levels) ---------- */
function seasonPass(vis) {
  const tiers = Array.from({ length: 8 }, (_, i) => F('Tier' + (i + 1), { LayoutOrder: i, ZIndex: 7 }, [
    T('Level', 'Niv. ' + (i + 1), { Size: [1, 0, 0.12, 0], ZIndex: 8 }),
    Blk('Free', i < 3 ? COL.green : COL.grey, { Size: [1, 0, 0.38, 0], Position: [0, 0, 0.14, 0], ZIndex: 8 }, [T('Icon', ['🪙', '🧪', '🥚', '💎', '🍀', '🪙', '⚡', '🎁'][i], { Size: [0.7, 0, 0.7, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 9 })], {}, 10),
    Blk('Premium', COL.yellow, { Size: [1, 0, 0.38, 0], Position: [0, 0, 0.58, 0], ZIndex: 8 }, [T('Icon', ['🐱', '✨', '👑', '🐉', '🌈', '🦄', '🔥', '🌌'][i], { Size: [0.7, 0, 0.7, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 9 }),
      ...(i >= 3 ? [T('Lock', '🔒', { Size: [0.4, 0, 0.4, 0], Position: [1, 0, 0, 0], AnchorPoint: [0.9, 0.1], ZIndex: 10 })] : [])], {}, 10)]));
  return win('SeasonPass', 'Pass de saison', '🎫', 1.6, [
    T('Track', '🆓 Gratuit                                   👑 Premium', { Size: [1, 0, 0.07, 0], ZIndex: 8, TextXAlignment: 'Left' }),
    N('Frame', 'Bar', { Size: [1, 0, 0.06, 0], Position: [0, 0, 0.09, 0], BackgroundColor3: '#141833', ZIndex: 8 }, [corner(0.5, 0), stroke(K, 2.5, 0, 'Border'),
      N('Frame', 'Fill', { Size: [0.34, 0, 1, 0], BackgroundColor3: '#ffffff', ZIndex: 9 }, [corner(0.5, 0), grad(COL.green, 90)]), T('Xp', '340 / 1000 XP', { Size: [1, 0, 0.9, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 10 })]),
    N('ScrollingFrame', 'Tiers', { Size: [1, 0, 0.62, 0], Position: [0, 0, 0.18, 0], BackgroundTransparency: 1, ScrollBarThickness: 6, ScrollBarImageColor3: '#ffd21f', AutomaticCanvasSize: 'X', CanvasSize: [0, 0, 0, 0], ZIndex: 7 }, [
      list('Horizontal', 8, 'Left', 'Center'), ...tiers.map((t) => ({ ...t, props: { ...t.props, Size: [0.17, 0, 0.95, 0] } }))]),
    Btn('BuyPremium', '👑 Premium ⏣ 399', COL.yellow, { Size: [0.46, 0, 0.13, 0], Position: [0.5, 0, 1, 0], AnchorPoint: [0.5, 1], ZIndex: 8 }, { idle: 'shine', period: 2.2 }),
  ], { vis, title: COL.purple, body: ['#2a2f55', '#171a36'], studs: 22 });
}

/* ---------- Settings with accessibility options ---------- */
function access(vis) {
  const rows = [['Music', '🎵 Musique', true], ['Sfx', '🔊 Effets sonores', true], ['Shake', '📳 Tremblements d\'écran', true], ['Colorblind', '🎨 Mode daltonien', false], ['BigText', '🔠 Texte plus grand', false], ['Flash', '⚡ Réduire les flashs', false]];
  return win('Settings', 'Paramètres', '⚙️', 1.6, [N('ScrollingFrame', 'List', { Size: [1, 0, 1, 0], BackgroundTransparency: 1, ScrollBarThickness: 6, AutomaticCanvasSize: 'Y', CanvasSize: [0, 0, 0, 0], ZIndex: 7 }, [list('Vertical', 8, 'Center', 'Top'),
    ...rows.map(([n, l, on], i) => Blk(n, COL.navy, { Size: [1, 0, 0, 0], LayoutOrder: i, ZIndex: 8 }, [aspect(6.5),
      T('Label', l, { Size: [0.66, 0, 0.6, 0], Position: [0.04, 0, 0.5, 0], AnchorPoint: [0, 0.5], TextXAlignment: 'Left', ZIndex: 9 }),
      Btn('Toggle', on ? 'ON' : 'OFF', on ? COL.green : COL.red, { Size: [0.22, 0, 0.66, 0], Position: [0.96, 0, 0.5, 0], AnchorPoint: [1, 0.5], ZIndex: 9 }, { action: 'switch' })], {}, 14))])],
  { vis, title: COL.grey, body: ['#2a2f55', '#171a36'], studs: 22 });
}

/* ---------- Tutorial hint bubble + bouncing arrow ---------- */
function tutorial() {
  // readable on any background: dark text without outline on a white bubble, big step badge
  const plain = (name, text, props) => N('TextLabel', name, { Text: text, BackgroundTransparency: 1, Font: '$font', TextScaled: true, TextColor3: '#1d2140', ...props });
  return [F('Tutorial', { Size: [0.46, 0, 0.2, 0], Position: [0.5, 0, 0.18, 0], AnchorPoint: [0.5, 0] }, [
    N('Frame', 'Bubble', { Size: [1, 0, 1, 0], BackgroundColor3: '#ffffff', ZIndex: 20 }, [corner(0, 14), stroke(K, 4, 0, 'Border'), grad(['#ffffff', '#e9f1ff'], 90),
      N('Frame', 'Badge', { Size: [0.24, 0, 0.32, 0], Position: [0.03, 0, 0.1, 0], BackgroundColor3: '#ffffff', ZIndex: 21 }, [corner(0.5, 0), grad(COL.blue, 90), stroke(K, 2.5, 0, 'Border'),
        T('Step', 'Étape 1/3', { Size: [0.86, 0, 0.7, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 22 })]),
      plain('Text', 'Approche-toi de l\'œuf et touche « Ouvrir » !', { Size: [0.94, 0, 0.46, 0], Position: [0.03, 0, 0.48, 0], TextXAlignment: 'Left', TextWrapped: true, ZIndex: 21 }),
      Btn('Skip', 'Passer', COL.grey, { Size: [0.2, 0, 0.3, 0], Position: [0.97, 0, 0.1, 0], AnchorPoint: [1, 0], ZIndex: 22 }, { action: 'close' })]),
    T('Arrow', '👇', { Size: [0.16, 0, 0.7, 0], Position: [0.5, 0, 1.04, 0], AnchorPoint: [0.5, 0], ZIndex: 21 }, [], { idle: 'float', period: 0.9 }),
  ], { open: 'pop', window: false })];
}

export const STUD_THEME = { label: 'Stud', panel: '#1d2140', panel2: '#3b4170', primary: '#3fd0ff', primary2: '#1677ff', accent: '#ffd21f', text: '#ffffff', muted: '#c7cde0', good: '#5ee03a', bad: '#ff3b3b', stroke: '#000000', font: 'FredokaOne' };
const TAG = 'stud studs simulator simulateur populaire brainrot lego blocs ';
export const STUD_TEMPLATES = [
  { id: 'stud_hud', e: '🧱', label: 'Stud · HUD', tags: TAG + 'hud menu boutons argent cash', win: false, theme: 'stud', make: () => hud() },
  { id: 'stud_daily', e: '📅', label: 'Stud · Récompenses', tags: TAG + 'daily rewards quotidien jour claim', win: 'Daily', theme: 'stud', make: (vis) => [daily(vis)] },
  { id: 'stud_shop', e: '🛍️', label: 'Stud · Boutique', tags: TAG + 'shop boutique packs luck chance robux', win: 'Shop', theme: 'stud', make: (vis) => [shop(vis)] },
  { id: 'stud_store', e: '👑', label: 'Stud · Gamepass', tags: TAG + 'store gamepass vip passes onglets tabs', win: 'Store', theme: 'stud', make: (vis) => [store(vis)] },
  { id: 'stud_confirm', e: '✅', label: 'Stud · Confirmer', tags: TAG + 'confirm vendre sell oui non dialogue', win: 'Confirm', theme: 'stud', make: (vis) => [confirm(vis)] },
  { id: 'stud_gears', e: '🛠️', label: 'Stud · Équipements', tags: TAG + 'gears outils stock rareté bois wood liste', win: 'Gears', theme: 'stud', make: (vis) => [gears(vis)] },
  { id: 'stud_index', e: '📘', label: 'Stud · Index', tags: TAG + 'index collection pets decouvrir', win: 'Index', theme: 'stud', make: (vis) => [index(vis)] },
  { id: 'stud_rebirth', e: '♻️', label: 'Stud · Rebirth', tags: TAG + 'rebirth renaissance barre progression', win: 'Rebirth', theme: 'stud', make: (vis) => [rebirth(vis)] },
  { id: 'stud_trade', e: '🤝', label: 'Stud · Échange', tags: TAG + 'trade echange troc offre pret', win: 'Trade', theme: 'stud', make: (vis) => [trade(vis)] },
  { id: 'stud_pass', e: '🎫', label: 'Stud · Pass de saison', tags: TAG + 'season pass saison battle pass premium niveaux xp', win: 'SeasonPass', theme: 'stud', make: (vis) => [seasonPass(vis)] },
  { id: 'stud_settings', e: '⚙️', label: 'Stud · Paramètres', tags: TAG + 'settings parametres accessibilite daltonien son options', win: 'Settings', theme: 'stud', make: (vis) => [access(vis)] },
  { id: 'stud_tutorial', e: '👉', label: 'Stud · Tutoriel', tags: TAG + 'tutorial tutoriel aide etape fleche onboarding', win: false, theme: 'stud', make: () => tutorial() },
  { id: 'stud_auras', e: '✨', label: 'Stud · Auras', tags: TAG + 'auras trails traînées equiper selection', win: 'Auras', theme: 'stud', make: (vis) => auras(vis) },
];
export const STUD_ALL = ['stud_hud', 'stud_daily', 'stud_shop', 'stud_store', 'stud_confirm', 'stud_gears', 'stud_index', 'stud_rebirth', 'stud_auras', 'stud_trade', 'stud_pass', 'stud_settings'];
