/* Roblox Forge - GUI templates. Every colour is a theme token, so each template
   takes the colours of the game. Sizes use Scale (+ aspect ratio) so they fit
   phones, tablets and PCs. Buttons are wired with real behaviours (Forge attributes). */
import { N, corner, stroke, grad, pad, list, gridL, aspect, tsize } from './gui-core.js';
import { STUD_TEMPLATES } from './stud.js';

const T = (name, text, props = {}, kids = [], anim) => N('TextLabel', name, { Text: text, BackgroundTransparency: 1, TextColor3: '$text', Font: '$font', TextScaled: true, ...props }, kids, anim ? { anim } : {});
// In Roblox a UIGradient also tints the button's own text, so gradient buttons carry their text in a child label.
const B = (name, text, props = {}, kids = [], anim = {}) => {
  const graded = kids.some((k) => k.cls === 'UIGradient') && text;
  const label = graded ? [N('TextLabel', 'Label', { Text: text, BackgroundTransparency: 1, TextColor3: props.TextColor3 || '$text', Font: '$font', TextScaled: true, TextStrokeTransparency: 0.45,
    Size: [0.9, 0, 0.74, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: (props.ZIndex || 1) + 1 })] : [];
  return N('TextButton', name, { TextColor3: '$text', Font: '$font', TextScaled: true, BackgroundColor3: '#ffffff', ...props, Text: graded ? '' : text }, [...kids, ...label],
    { anim: { hover: 'grow', press: 'squish', ...anim } });
};
const F = (name, props = {}, kids = [], anim) => N('Frame', name, { BackgroundTransparency: 1, ...props }, kids, anim ? { anim } : {});
const shine = () => F('Shine', { Size: [1, 0, 1, 0], BackgroundTransparency: 0, BackgroundColor3: '#ffffff', ZIndex: 2 },
  [grad(['#ffffff', '#ffffff'], 20, [{ t: 0, v: 1 }, { t: 0.42, v: 1 }, { t: 0.5, v: 0.55 }, { t: 0.58, v: 1 }, { t: 1, v: 1 }]), corner(0, 18)], { idle: 'shine', period: 2.6 });
const pill = (g = ['$primary', '$primary2'], r = 0.5) => [corner(r, 0), grad(g, 90)];

/** A window: gradient panel, stroke, title ribbon with shine, close button, content frame. */
function windowFrame(name, title, ar, content, visible) {
  return N('Frame', name, { Size: [0.62, 0, 0.78, 0], Position: [0.5, 0, 0.52, 0], AnchorPoint: [0.5, 0.5], BackgroundColor3: '#ffffff', Visible: visible, ZIndex: 5 }, [
    corner(0, 22), stroke('$stroke', 3, 0.1), grad(['$panel2', '$panel'], 90), aspect(ar),
    N('Frame', 'Title', { Size: [0.56, 0, 0.15, 0], Position: [0.5, 0, 0, 0], AnchorPoint: [0.5, 0.5], BackgroundColor3: '#ffffff', ZIndex: 7 }, [
      ...pill(['$primary', '$primary2'], 0.5), stroke('#000000', 2.5, 0.55),
      T('Label', title, { Size: [0.9, 0, 0.78, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], TextStrokeTransparency: 0.45, ZIndex: 8 }),
      F('Shine', { Size: [1, 0, 1, 0], BackgroundTransparency: 0, BackgroundColor3: '#ffffff', ZIndex: 9 },
        [corner(0.5, 0), grad(['#ffffff', '#ffffff'], 25, [{ t: 0, v: 1 }, { t: 0.4, v: 1 }, { t: 0.5, v: 0.5 }, { t: 0.6, v: 1 }, { t: 1, v: 1 }])], { idle: 'shine', period: 2.4 }),
    ]),
    B('Close', '✕', { Size: [0.085, 0, 0.085, 0], Position: [0.985, 0, 0.02, 0], AnchorPoint: [0.5, 0.5], BackgroundColor3: '#ffffff', ZIndex: 9 },
      [corner(0.5, 0), grad(['#ff7a8f', '$bad'], 90), stroke('#ffffff', 2.5, 0), aspect(1)], { action: 'close' }),
    F('Content', { Size: [0.92, 0, 0.76, 0], Position: [0.5, 0, 0.57, 0], AnchorPoint: [0.5, 0.5], ZIndex: 6 }, content),
  ], { anim: { open: 'pop', window: true, dur: 0.45 } });
}
const RAR = [['Commun', '#b8b8c8'], ['Rare', '#3ea0ff'], ['Épique', '#b05cff'], ['Légendaire', '#ffb300'], ['Mythique', '#ff3d6e'], ['Secret', '#00ffd0']];

function card(name, icon, label, rarity, foot, footProps = {}, footAnim = {}, i = 0) {
  const c = RAR.find((r) => r[0] === rarity)[1];
  return N('Frame', name, { BackgroundColor3: '#ffffff', LayoutOrder: i, ZIndex: 6 }, [
    corner(0, 14), stroke(c, 3, 0), grad(['$panel2', '$panel'], 90),
    T('Icon', icon, { Size: [0.7, 0, 0.46, 0], Position: [0.5, 0, 0.06, 0], AnchorPoint: [0.5, 0], ZIndex: 7 }),
    T('Name', label, { Size: [0.9, 0, 0.14, 0], Position: [0.5, 0, 0.53, 0], AnchorPoint: [0.5, 0], ZIndex: 7 }),
    T('Rarity', rarity.toUpperCase(), { Size: [0.9, 0, 0.1, 0], Position: [0.5, 0, 0.67, 0], AnchorPoint: [0.5, 0], TextColor3: c, ZIndex: 7, TextStrokeTransparency: 0.6 }),
    B('Buy', foot, { Size: [0.86, 0, 0.17, 0], Position: [0.5, 0, 0.94, 0], AnchorPoint: [0.5, 1], ZIndex: 8, ...footProps }, [...pill(['$good', '#1fa866'], 0.35), stroke('#000000', 2, 0.6)], footAnim),
  ], (rarity === 'Légendaire' || rarity === 'Mythique' || rarity === 'Secret') ? { anim: { idle: 'pulse', period: 1.8 } } : {});
}

export const TEMPLATES = [
  { id: 'hud', e: '🧭', label: 'HUD', tags: 'hud interface ecran principal argent coins gemmes menu boutons barre', win: false, make: () => [
    F('Currency', { Size: [0.22, 0, 0, 72], Position: [0.015, 0, 0, 62] }, [list('Vertical', 8, 'Left', 'Top'),
      ...[['Coins', '🪙', ['$accent', '#ff9d00']], ['Gems', '💎', ['$primary2', '$primary']]].map(([n, ic, g], i) => N('Frame', n, { Size: [1, 0, 0.45, 0], BackgroundColor3: '#ffffff', LayoutOrder: i }, [
        ...pill(['$panel2', '$panel'], 0.5), stroke(g[0], 2.5, 0),
        T('Value', ic + ' 0', { Size: [0.86, 0, 0.8, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], TextXAlignment: 'Left', TextStrokeTransparency: 0.5 }, [], { bind: n, format: ic + ' {v}' }),
        B('Plus', '+', { Size: [0, 30, 0, 30], Position: [1, -6, 0.5, 0], AnchorPoint: [1, 0.5], TextColor3: '#ffffff' }, [corner(0.5, 0), grad(g, 90), aspect(1)], { action: 'toggle', target: 'Shop' }),
      ]))]),
    F('Menu', { Size: [0.085, 0, 0.56, 0], Position: [0.012, 0, 0.6, 26], AnchorPoint: [0, 0.5] }, [list('Vertical', 10, 'Center', 'Center'),
      ...[['ShopButton', '🛒', 'Boutique', 'Shop', ['$accent', '#ff8a00']], ['BagButton', '🎒', 'Sac', 'Inventory', ['$primary2', '$primary']], ['EggButton', '🥚', 'Œufs', 'EggOpen', ['#ff7ad9', '$primary']], ['DailyButton', '🎁', 'Cadeau', 'Daily', ['$good', '#1fa866']]]
        .map(([n, ic, cap, tgt, g], i) => B(n, '', { Size: [1, 0, 0.21, 0], LayoutOrder: i }, [corner(0, 16), grad(g, 120), stroke('#ffffff', 3, 0.1), N('UIAspectRatioConstraint', 'UIAspectRatioConstraint', { AspectRatio: 1, DominantAxis: 'Height' }),
          T('Icon', ic, { Size: [0.7, 0, 0.62, 0], Position: [0.5, 0, 0.08, 0], AnchorPoint: [0.5, 0] }),
          T('Caption', cap, { Size: [1.1, 0, 0.3, 0], Position: [0.5, 0, 1.04, 0], AnchorPoint: [0.5, 1], TextStrokeTransparency: 0.2 })],
        { action: 'toggle', target: tgt, ...(n === 'DailyButton' ? { idle: 'wiggle', period: 2.2 } : {}) }))]),
  ] },
  { id: 'shop', e: '🛒', label: 'Boutique', tags: 'shop boutique magasin acheter store items objets prix vente', win: 'Shop', make: (vis) => [windowFrame('Shop', '🛒 BOUTIQUE', 1.45, [
    N('ScrollingFrame', 'Items', { Size: [1, 0, 1, 0], BackgroundTransparency: 1, ScrollBarThickness: 6, ScrollBarImageColor3: '$primary', AutomaticCanvasSize: 'Y', ZIndex: 6 }, [
      gridL([0.31, 0, 0.47, 0], [0.025, 0, 0.04, 0]), pad(6, 8, 6, 8),
      ...[['⚔️', 'Épée', 'Commun', '🪙 250'], ['🛡️', 'Bouclier', 'Rare', '🪙 900'], ['🔮', 'Orbe', 'Épique', '🪙 4K'], ['🐉', 'Dragon', 'Légendaire', '💎 120'], ['👑', 'Couronne', 'Mythique', '💎 500'], ['🌌', 'Néant', 'Secret', '💎 2K']]
        .map(([ic, n, r, p], i) => card('Item' + (i + 1), ic, n, r, p, {}, {}, i)),
    ])], vis)] },
  { id: 'inventory', e: '🎒', label: 'Inventaire', tags: 'inventory inventaire sac bag pets objets equiper grille slots', win: 'Inventory', make: (vis) => [windowFrame('Inventory', '🎒 INVENTAIRE', 1.45, [
    N('TextBox', 'Search', { Size: [0.6, 0, 0.13, 0], Position: [0, 0, 0, 0], BackgroundColor3: '$panel', Text: '', PlaceholderText: '🔎 Rechercher…', PlaceholderColor3: '$muted', TextColor3: '$text', Font: '$font', TextScaled: true, TextXAlignment: 'Left', ZIndex: 7 },
      [corner(0.5, 0), stroke('$stroke', 2, 0.4), pad(4, 14, 4, 14)]),
    T('Count', '9 / 50', { Size: [0.36, 0, 0.11, 0], Position: [1, 0, 0.01, 0], AnchorPoint: [1, 0], TextXAlignment: 'Right', TextColor3: '$muted', ZIndex: 7 }),
    N('ScrollingFrame', 'Slots', { Size: [1, 0, 0.84, 0], Position: [0, 0, 1, 0], AnchorPoint: [0, 1], BackgroundTransparency: 1, ScrollBarThickness: 6, ScrollBarImageColor3: '$primary', AutomaticCanvasSize: 'Y', ZIndex: 6 }, [
      gridL([0.15, 0, 0.3, 0], [0.012, 0, 0.03, 0]), pad(6, 6, 6, 6),
      ...['🐱:Rare', '🐶:Commun', '🐰:Commun', '🐉:Légendaire', '🟢:Épique', '👻:Mythique', '🤖:Rare', '🦊:Épique', '🌌:Secret', ':Commun', ':Commun', ':Commun'].map((s, i) => {
        const [ic, r] = s.split(':'), c = RAR.find((x) => x[0] === r)[1];
        return B('Slot' + (i + 1), '', { LayoutOrder: i, BackgroundColor3: '#ffffff', ZIndex: 7 }, [corner(0, 12), grad(ic ? ['$panel2', '$panel'] : ['$panel', '$panel'], 90), stroke(ic ? c : '$muted', ic ? 2.5 : 1.5, ic ? 0 : 0.6),
          T('Icon', ic, { Size: [0.8, 0, 0.8, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 8 })], { press: 'bounce' });
      }),
    ])], vis)] },
  { id: 'egg', e: '🥚', label: 'Œuf RNG', tags: 'egg oeuf rng gacha casino tirage roll chance hatch eclosion loot box roue spin', win: 'EggOpen', make: (vis) => [windowFrame('EggOpen', '🥚 ŒUF MYSTÈRE', 1.5, [
    F('Stage', { Size: [0.56, 0, 1, 0], ZIndex: 6, ClipsDescendants: true }, [
      F('Glow', { Size: [0.9, 0, 0.9, 0], Position: [0.5, 0, 0.42, 0], AnchorPoint: [0.5, 0.5], BackgroundTransparency: 0, BackgroundColor3: '$accent', ZIndex: 6 },
        [aspect(1), corner(0.5, 0), grad(['$accent', '$primary'], 90, [{ t: 0, v: 0.55 }, { t: 0.5, v: 0.75 }, { t: 1, v: 1 }])], { idle: 'pulse', period: 1.8 }),
      // sunburst: 8 beams crossing at the centre, each fading out at both ends, spinning together
      F('Rays', { Size: [1.5, 0, 1.5, 0], Position: [0.5, 0, 0.42, 0], AnchorPoint: [0.5, 0.5], ZIndex: 6 }, [aspect(1),
        ...Array.from({ length: 8 }, (_, k) => N('Frame', 'Beam' + (k + 1), { Size: [0.11, 0, 1, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], Rotation: k * 22.5, BackgroundColor3: k % 2 ? '$accent' : '$primary2', ZIndex: 6 },
          [grad(['#ffffff', '#ffffff'], 90, [{ t: 0, v: 1 }, { t: 0.3, v: 0.55 }, { t: 0.5, v: 0.35 }, { t: 0.7, v: 0.55 }, { t: 1, v: 1 }])]))], { idle: 'spin', period: 9 }),
      T('Result', '❔', { Size: [0.62, 0, 0.5, 0], Position: [0.5, 0, 0.42, 0], AnchorPoint: [0.5, 0.5], ZIndex: 8, TextStrokeTransparency: 0.2, TextStrokeColor3: '#000000' }, [], { idle: 'float', period: 2.4 }),
      T('ResultName', 'Tente ta chance !', { Size: [0.95, 0, 0.13, 0], Position: [0.5, 0, 0.8, 0], AnchorPoint: [0.5, 0.5], ZIndex: 8, TextStrokeTransparency: 0.3 }),
    ]),
    F('Side', { Size: [0.42, 0, 1, 0], Position: [1, 0, 0, 0], AnchorPoint: [1, 0], ZIndex: 6 }, [
      F('Odds', { Size: [1, 0, 0.7, 0], BackgroundColor3: '$panel', BackgroundTransparency: 0.25, ZIndex: 6 }, [corner(0, 14), pad(8, 10, 8, 10), list('Vertical', 4, 'Left', 'Top'),
        ...RAR.map(([r, c], i) => T('Odd' + (i + 1), `${r}  ${[60, 25, 10, 4, 0.9, 0.1][i]}%`, { Size: [1, 0, 0.145, 0], TextColor3: c, TextXAlignment: 'Left', LayoutOrder: i, ZIndex: 7, TextStrokeTransparency: 0.6 }))]),
      B('Roll', '🎰 OUVRIR · 🪙 100', { Size: [1, 0, 0.24, 0], Position: [0, 0, 1, 0], AnchorPoint: [0, 1], ZIndex: 8 }, [...pill(['$accent', '#ff8a00'], 0.4), stroke('#ffffff', 3, 0), shine()],
        { action: 'roll', target: 'Result', items: RAR.map(([r, c], i) => `${r}:${[60, 25, 10, 4, 0.9, 0.1][i]}:${c}`).join(', '), idle: 'pulse', period: 1.4 }),
    ]),
  ], vis)] },
  { id: 'settings', e: '⚙️', label: 'Paramètres', tags: 'settings parametres options reglages son musique toggle interrupteur', win: 'Settings', make: (vis) => [windowFrame('Settings', '⚙️ PARAMÈTRES', 1.3, [
    N('ScrollingFrame', 'Rows', { Size: [1, 0, 1, 0], BackgroundTransparency: 1, ScrollBarThickness: 5, ScrollBarImageColor3: '$primary', AutomaticCanvasSize: 'Y', ZIndex: 6 }, [list('Vertical', 8, 'Center', 'Top'), pad(4, 8, 4, 8),
      ...[['🎵', 'Musique'], ['🔊', 'Sons'], ['✨', 'Effets'], ['📳', 'Vibrations'], ['🌙', 'Basse qualité']].map(([ic, l], i) => N('Frame', 'Row' + (i + 1), { Size: [1, 0, 0.17, 0], BackgroundColor3: '$panel', BackgroundTransparency: 0.2, LayoutOrder: i, ZIndex: 6 }, [
        corner(0, 12), stroke('$stroke', 1.5, 0.6),
        T('Label', ic + '  ' + l, { Size: [0.62, 0, 0.66, 0], Position: [0.04, 0, 0.5, 0], AnchorPoint: [0, 0.5], TextXAlignment: 'Left', ZIndex: 7 }),
        B('Toggle', i === 4 ? 'OFF' : 'ON', { Size: [0.24, 0, 0.7, 0], Position: [0.97, 0, 0.5, 0], AnchorPoint: [1, 0.5], ZIndex: 7, BackgroundColor3: i === 4 ? '$bad' : '$good' }, [corner(0.5, 0), stroke('#ffffff', 2, 0.3)], { action: 'switch', hover: 'grow' }),
      ]))])], vis)] },
  { id: 'daily', e: '🎁', label: 'Cadeau du jour', tags: 'daily quotidien recompenses rewards jour login cadeau calendrier streak', win: 'Daily', make: (vis) => [windowFrame('Daily', '🎁 RÉCOMPENSES', 1.55, [
    F('Days', { Size: [1, 0, 0.78, 0], ZIndex: 6 }, [gridL([0.135, 0, 0.92, 0], [0.01, 0, 0, 0]),
      ...['🪙 100', '🪙 250', '💎 5', '🪙 600', '🥚 x1', '💎 25', '👑 MEGA'].map((r, i) => N('Frame', 'Day' + (i + 1), { BackgroundColor3: '#ffffff', LayoutOrder: i, ZIndex: 6 }, [
        corner(0, 12), grad(i === 6 ? ['$accent', '#ff8a00'] : i < 2 ? ['$good', '#1fa866'] : ['$panel2', '$panel'], 90), stroke(i === 6 ? '#ffffff' : '$stroke', i === 6 ? 3 : 1.5, i === 6 ? 0 : 0.4),
        T('Day', 'JOUR ' + (i + 1), { Size: [0.9, 0, 0.16, 0], Position: [0.5, 0, 0.06, 0], AnchorPoint: [0.5, 0], ZIndex: 7, TextStrokeTransparency: 0.6 }),
        T('Icon', r.split(' ')[0], { Size: [0.8, 0, 0.42, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 7 }),
        T('Amount', i < 2 ? '✔' : r.split(' ').slice(1).join(' '), { Size: [0.9, 0, 0.17, 0], Position: [0.5, 0, 0.92, 0], AnchorPoint: [0.5, 1], ZIndex: 7, TextStrokeTransparency: 0.5 }),
      ], i === 2 ? { anim: { idle: 'pulse', period: 1.2 } } : i === 6 ? { anim: { idle: 'wiggle', period: 2 } } : {}))]),
    B('Claim', '🎁 RÉCLAMER LE JOUR 3', { Size: [0.6, 0, 0.17, 0], Position: [0.5, 0, 1, 0], AnchorPoint: [0.5, 1], ZIndex: 8 }, [...pill(['$good', '#1fa866'], 0.5), stroke('#ffffff', 2.5, 0), shine()], { idle: 'pulse', period: 1.4 }),
  ], vis)] },
  { id: 'quests', e: '📜', label: 'Quêtes', tags: 'quests quetes missions objectifs taches progression barre progress', win: 'Quests', make: (vis) => [windowFrame('Quests', '📜 QUÊTES', 1.4, [
    F('List', { Size: [1, 0, 1, 0], ZIndex: 6 }, [list('Vertical', 10, 'Center', 'Top'),
      ...[['🥚 Ouvre 20 œufs', 0.6, '12 / 20', '🪙 500'], ['⚔️ Bats 5 boss', 0.2, '1 / 5', '💎 15'], ['🕒 Joue 30 minutes', 1, 'TERMINÉ', '🎁 x1']].map(([q, p, txt, rw], i) => N('Frame', 'Quest' + (i + 1), { Size: [1, 0, 0.3, 0], BackgroundColor3: '$panel', BackgroundTransparency: 0.15, LayoutOrder: i, ZIndex: 6 }, [
        corner(0, 14), stroke(p >= 1 ? '$good' : '$stroke', 2, p >= 1 ? 0 : 0.5),
        T('Title', q, { Size: [0.66, 0, 0.36, 0], Position: [0.04, 0, 0.1, 0], TextXAlignment: 'Left', ZIndex: 7 }),
        T('Reward', rw, { Size: [0.26, 0, 0.36, 0], Position: [0.96, 0, 0.1, 0], AnchorPoint: [1, 0], TextXAlignment: 'Right', TextColor3: '$accent', ZIndex: 7 }),
        N('Frame', 'Bar', { Size: [0.92, 0, 0.28, 0], Position: [0.5, 0, 0.84, 0], AnchorPoint: [0.5, 1], BackgroundColor3: '#000000', BackgroundTransparency: 0.55, ZIndex: 7 }, [corner(0.5, 0),
          N('Frame', 'Fill', { Size: [p, 0, 1, 0], BackgroundColor3: '#ffffff', ZIndex: 8 }, [corner(0.5, 0), grad(p >= 1 ? ['$good', '#1fa866'] : ['$primary', '$primary2'], 90)]),
          T('Progress', txt, { Size: [1, 0, 0.9, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 9, TextStrokeTransparency: 0.3 })]),
      ]))])], vis)] },
  { id: 'toast', e: '🔔', label: 'Notification', tags: 'notification toast alerte message popup annonce banniere', win: false, make: () => [
    N('Frame', 'Toast', { Size: [0.38, 0, 0.1, 0], Position: [0.5, 0, 0.05, 0], AnchorPoint: [0.5, 0], BackgroundColor3: '#ffffff', ZIndex: 20 }, [
      ...pill(['$panel2', '$panel'], 0.5), stroke('$primary', 2.5, 0),
      T('Message', '🎉 Nouveau pet obtenu : Dragon Légendaire !', { Size: [0.9, 0, 0.62, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 21, TextStrokeTransparency: 0.5 }),
      F('Shine', { Size: [1, 0, 1, 0], BackgroundTransparency: 0, BackgroundColor3: '#ffffff', ZIndex: 22 }, [corner(0.5, 0), grad(['#ffffff', '#ffffff'], 20, [{ t: 0, v: 1 }, { t: 0.42, v: 1 }, { t: 0.5, v: 0.5 }, { t: 0.58, v: 1 }, { t: 1, v: 1 }])], { idle: 'shine', period: 2 }),
    ], { anim: { open: 'slideDown', dur: 0.5 } }),
  ] },
  { id: 'confirm', e: '♻️', label: 'Confirmation', tags: 'confirm confirmation rebirth renaissance dialogue oui non popup achat', win: 'Confirm', make: (vis) => [windowFrame('Confirm', '♻️ REBIRTH', 1.7, [
    T('Text', 'Recommencer pour gagner ×2 pour toujours ?\nTu perds tes 🪙 mais tu gardes tes pets.', { Size: [1, 0, 0.5, 0], ZIndex: 7, TextColor3: '$text' }),
    B('Yes', '✔ OUI', { Size: [0.46, 0, 0.32, 0], Position: [0, 0, 1, 0], AnchorPoint: [0, 1], ZIndex: 8 }, [...pill(['$good', '#1fa866'], 0.4), stroke('#ffffff', 2.5, 0)], { action: 'close' }),
    B('No', '✖ NON', { Size: [0.46, 0, 0.32, 0], Position: [1, 0, 1, 0], AnchorPoint: [1, 1], ZIndex: 8 }, [...pill(['#ff7a8f', '$bad'], 0.4), stroke('#ffffff', 2.5, 0)], { action: 'close' }),
  ], vis)] },
  { id: 'bars', e: '❤️', label: 'Vie et XP', tags: 'health vie hp xp niveau level barre energie mana stamina', win: false, make: () => [
    F('Bars', { Size: [0.3, 0, 0.13, 0], Position: [0.5, 0, 0.97, 0], AnchorPoint: [0.5, 1] }, [list('Vertical', 6, 'Center', 'Bottom'),
      ...[['Health', '❤️ 85 / 100', 0.85, ['#ff6b6b', '$bad']], ['XP', '⭐ Niveau 12 · 40%', 0.4, ['$primary2', '$primary']]].map(([n, txt, p, g], i) => N('Frame', n, { Size: [1, 0, 0.44, 0], BackgroundColor3: '#000000', BackgroundTransparency: 0.45, LayoutOrder: i }, [
        corner(0.5, 0), stroke('#ffffff', 2, 0.5),
        N('Frame', 'Fill', { Size: [p, 0, 1, 0], BackgroundColor3: '#ffffff' }, [corner(0.5, 0), grad(g, 90)]),
        T('Label', txt, { Size: [1, 0, 0.82, 0], Position: [0.5, 0, 0.5, 0], AnchorPoint: [0.5, 0.5], ZIndex: 3, TextStrokeTransparency: 0.3 })]))]),
  ] },
  ...STUD_TEMPLATES,
];
export function defaultProject() {
  const root = N('ScreenGui', 'ForgeGui', { ResetOnSpawn: false, IgnoreGuiInset: true, DisplayOrder: 5 }, []);
  for (const id of ['hud', 'shop', 'egg']) root.children.push(...TEMPLATES.find((t) => t.id === id).make(id === 'egg'));
  return { v: 1, theme: 'neon', customTheme: null, root };
}
