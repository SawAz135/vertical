/* =====================================================================
   Roblox Forge - Pet generator ("générateur intelligent").
   Understands a French / English description ("dragon de feu légendaire",
   "chat cosmique mignon", "robot néon secret"…) and builds a detailed pet out
   of real Roblox parts: chibi proportions, glossy eyes (iris, pupil, two
   shines), curved horns / tails / tentacles made of part chains, feathered or
   membrane wings, element details (fire, ice, cosmic…) and style accessories
   (crown, halo, cyber visor…). Same description + same seed = same pet.
   ===================================================================== */

/* ---------- small maths ---------- */
const D = 180 / Math.PI;
export function rng(seed) { let a = seed >>> 0 || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const r3 = (v) => +v.toFixed(3);
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const rgb2hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const x = hex2rgb(a), y = hex2rgb(b); return rgb2hex(...x.map((v, i) => v + (y[i] - v) * t)); };
const lighten = (c, t) => mix(c, '#ffffff', t), darken = (c, t) => mix(c, '#000000', t);
function hsl(h, s, l) { h = ((h % 360) + 360) % 360 / 360; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return rgb2hex(f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255); }
function toHsl(h) { let [r, g, b] = hex2rgb(h).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let H = 0, S = 0;
  if (mx !== mn) { const d = mx - mn; S = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); H = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; H *= 60; } return [H, S, l]; }
export const shiftHue = (c, deg) => { const [h, s2, l] = toHsl(c); return hsl(h + deg, s2, l); };
// rotation (deg, Euler XYZ like CFrame.Angles) that points a part's +Z axis along d
function alongZ(d) { const l = Math.hypot(...d) || 1, x = d[0] / l, y = d[1] / l, z = d[2] / l; return [r3(Math.atan2(-y, z) * D), r3(Math.asin(Math.max(-1, Math.min(1, x))) * D), 0]; }
// point on an ellipsoid surface in direction d
function onSurface(c, size, d, push = 0) { const l = Math.hypot(...d), u = d.map((v) => v / l), k = 1 / Math.sqrt((u[0] / (size[0] / 2)) ** 2 + (u[1] / (size[1] / 2)) ** 2 + (u[2] / (size[2] / 2)) ** 2);
  return c.map((v, i) => r3(v + u[i] * (k + push))); }
const facing = (d) => [0, r3(Math.atan2(-d[0], -d[2]) * D), 0]; // part's front (-Z) looks along d (horizontal)

/* ---------- vocabulary ---------- */
import { LEX } from '../map/map-lexicon.js';
export const SPECIES = {
  chat: { fr: 'Chat', e: '🐱', plan: 'quad', ears: 'pointy', tail: 'curl', base: ['#ffa94d', '#fff1e0'], words: 'chat chaton cat kitty minou felin' },
  chien: { fr: 'Chien', e: '🐶', plan: 'quad', ears: 'floppy', tail: 'wag', snout: 1.25, base: ['#c98b5a', '#fbe9d7'], words: 'chien chiot dog puppy toutou' },
  renard: { fr: 'Renard', e: '🦊', plan: 'quad', ears: 'pointyBig', tail: 'fluffy', snout: 1.35, base: ['#ff7a2f', '#fff3e6'], words: 'renard fox kitsune' },
  loup: { fr: 'Loup', e: '🐺', plan: 'quad', ears: 'pointyBig', tail: 'fluffy', snout: 1.4, base: ['#8a94a6', '#eef1f6'], words: 'loup wolf husky' },
  tigre: { fr: 'Tigre', e: '🐯', plan: 'quad', ears: 'round', tail: 'long', pattern: 'stripes', base: ['#ff9a1f', '#fff3e0'], words: 'tigre tiger' },
  lion: { fr: 'Lion', e: '🦁', plan: 'quad', ears: 'round', tail: 'tuft', mane: true, base: ['#f2b34a', '#fff0cf'], words: 'lion roi king' },
  panda: { fr: 'Panda', e: '🐼', plan: 'quad', ears: 'round', tail: 'stub', pattern: 'panda', base: ['#ffffff', '#ffffff'], dark: '#1c1c24', words: 'panda' },
  ours: { fr: 'Ours', e: '🐻', plan: 'quad', ears: 'round', tail: 'stub', base: ['#9a6a43', '#e8c9a7'], words: 'ours bear nounours teddy' },
  lapin: { fr: 'Lapin', e: '🐰', plan: 'quad', ears: 'long', tail: 'puff', base: ['#f5f2f7', '#ffd6e6'], words: 'lapin bunny rabbit lapinou' },
  cerf: { fr: 'Cerf', e: '🦌', plan: 'quad', ears: 'pointy', tail: 'puff', antlers: true, base: ['#b9824f', '#f7e3cc'], words: 'cerf deer biche faon renne reindeer' },
  licorne: { fr: 'Licorne', e: '🦄', plan: 'quad', ears: 'pointy', tail: 'mane', mane: 'rainbow', unihorn: true, base: ['#fbf7ff', '#ffd6f5'], words: 'licorne unicorn' },
  vache: { fr: 'Vache', e: '🐮', plan: 'quad', ears: 'round', tail: 'tuft', snout: 1.1, pattern: 'spots', base: ['#f6f3ec', '#f2b3b3'], words: 'vache vaches veau taureau cow cows bull' },
  cochon: { fr: 'Cochon', e: '🐷', plan: 'quad', ears: 'floppy', tail: 'curl', snout: 0.8, base: ['#f7aec0', '#fac2cf'], words: 'cochon cochons porc porcelet pig pigs piggy' },
  mouton: { fr: 'Mouton', e: '🐑', plan: 'quad', ears: 'floppy', tail: 'puff', snout: 0.9, base: ['#f3f0ea', '#3b3432'], words: 'mouton moutons brebis agneau sheep lamb' },
  dragon: { fr: 'Dragon', e: '🐉', plan: 'quad', ears: 'fin', tail: 'dragon', snout: 1.5, horns: 'curved', wings: 'membrane', spikes: true, base: ['#3fb36b', '#e8f7c8'], words: 'dragon drake wyvern dragonnet' },
  axolotl: { fr: 'Axolotl', e: '🦎', plan: 'quad', ears: 'gills', tail: 'fishtail', base: ['#ff9ecb', '#ffe3f0'], words: 'axolotl salamandre' },
  hibou: { fr: 'Hibou', e: '🦉', plan: 'bird', beak: 'hook', tufts: true, base: ['#8b6a4a', '#f3dfc2'], words: 'hibou chouette owl' },
  pingouin: { fr: 'Pingouin', e: '🐧', plan: 'bird', beak: 'short', flippers: true, base: ['#24283a', '#ffffff'], words: 'pingouin manchot penguin' },
  poussin: { fr: 'Poussin', e: '🐥', plan: 'bird', beak: 'short', base: ['#ffd84d', '#fff4b8'], words: 'poussin poule chick canard duck oiseau bird' },
  phenix: { fr: 'Phénix', e: '🐦‍🔥', plan: 'bird', beak: 'hook', crest: true, wings: 'feather', tailFeathers: true, base: ['#ff5a1f', '#ffd04d'], element: 'feu', words: 'phenix phoenix firebird' },
  serpent: { fr: 'Serpent', e: '🐍', plan: 'snake', base: ['#45c46b', '#f2ffb8'], words: 'serpent snake cobra python naga' },
  poisson: { fr: 'Poisson', e: '🐠', plan: 'fish', base: ['#ff8a3d', '#ffffff'], words: 'poisson fish nemo koi' },
  requin: { fr: 'Requin', e: '🦈', plan: 'fish', shark: true, base: ['#6f8fb3', '#f1f6fb'], words: 'requin shark megalodon' },
  pieuvre: { fr: 'Pieuvre', e: '🐙', plan: 'octo', base: ['#c45cff', '#ffd6ff'], words: 'pieuvre poulpe octopus kraken calamar squid' },
  meduse: { fr: 'Méduse', e: '🪼', plan: 'jelly', base: ['#7ce7ff', '#ffffff'], words: 'meduse jellyfish' },
  fantome: { fr: 'Fantôme', e: '👻', plan: 'ghost', base: ['#f3f1ff', '#c9c2ff'], words: 'fantome ghost spectre esprit spirit ame' },
  slime: { fr: 'Slime', e: '🟢', plan: 'slime', base: ['#5ee37a', '#d9ffb8'], words: 'slime gelee blob' },
  abeille: { fr: 'Abeille', e: '🐝', plan: 'bee', base: ['#ffcf2e', '#2a2230'], words: 'abeille bee bourdon guepe wasp' },
  papillon: { fr: 'Papillon', e: '🦋', plan: 'butterfly', base: ['#5b8cff', '#ffd6f5'], words: 'papillon butterfly fee fairy' },
  araignee: { fr: 'Araignée', e: '🕷️', plan: 'spider', base: ['#2c2838', '#c13cff'], words: 'araignee spider tarentule' },
  robot: { fr: 'Robot', e: '🤖', plan: 'robot', base: ['#c9d1e0', '#3ee6ff'], words: 'robot mecha cyborg android droide bot' },
  golem: { fr: 'Golem', e: '🗿', plan: 'golem', base: ['#7b7f8c', '#3ee6ff'], words: 'golem pierre rocher titan stone' },
  champignon: { fr: 'Champignon', e: '🍄', plan: 'shroom', base: ['#ff4d5e', '#fff4e6'], words: 'champignon mushroom shroom' },
  etoile: { fr: 'Étoile', e: '⭐', plan: 'star', base: ['#ffd84d', '#fff6c8'], words: 'etoile star starry' },
  oeil: { fr: 'Œil', e: '👁️', plan: 'eyeball', base: ['#ffffff', '#ff3d6e'], words: 'oeil eye eyeball beholder' },
};
export const ELEMENTS = {
  feu: { fr: 'de Feu', adj: 'Ardent', c: ['#ff5a1f', '#ffd04d'], glow: '#ff7a1a', words: 'feu fire flamme flame braise brulant inferno blaze' },
  glace: { fr: 'de Glace', adj: 'Glacé', c: ['#8fd8ff', '#f2fbff'], glow: '#9be8ff', words: 'glace ice gel givre frost neige snow froid' },
  foudre: { fr: 'de Foudre', adj: 'Électrique', c: ['#ffe14d', '#fff8c8'], glow: '#fff36b', words: 'foudre eclair lightning thunder electrique orage storm' },
  ombre: { fr: 'des Ombres', adj: 'Sombre', c: ['#2a2238', '#5b3d7a'], glow: '#b04dff', words: 'ombre shadow sombre dark noir nuit night demon void neant' },
  lumiere: { fr: 'de Lumière', adj: 'Céleste', c: ['#fff6d6', '#ffffff'], glow: '#fff1a8', words: 'lumiere light celeste ange angel saint holy divin divine sacre' },
  nature: { fr: 'des Bois', adj: 'Sylvestre', c: ['#5fbf4a', '#e6ffc8'], glow: '#9dff6b', words: 'nature foret forest bois plante leaf feuille fleur flower jungle' },
  eau: { fr: 'des Mers', adj: 'Aquatique', c: ['#2fa8ff', '#d6f2ff'], glow: '#5fd4ff', words: 'eau water mer ocean vague wave aqua' },
  cosmos: { fr: 'Cosmique', adj: 'Cosmique', c: ['#4b36c9', '#c86bff'], glow: '#9a7bff', words: 'cosmique cosmos cosmic galaxie galaxy espace space etoile nebuleuse astral' },
  lave: { fr: 'de Lave', adj: 'Volcanique', c: ['#2b1d1a', '#ff5a1f'], glow: '#ff4800', words: 'lave lava volcan magma' },
  or: { fr: 'd\'Or', adj: 'Doré', c: ['#ffcf3d', '#fff2b0'], glow: '#ffd84d', words: 'or gold dore golden tresor treasure riche' },
  poison: { fr: 'Toxique', adj: 'Toxique', c: ['#7ae34d', '#3a1f4d'], glow: '#9bff3d', words: 'poison toxique toxic venin acide acid' },
  neon: { fr: 'Néon', adj: 'Néon', c: ['#1b1b2a', '#ff2fb4'], glow: '#3ee6ff', words: 'neon cyber cyberpunk synthwave futur' },
  cristal: { fr: 'de Cristal', adj: 'Cristallin', c: ['#c7a6ff', '#f6efff'], glow: '#e0c8ff', words: 'cristal crystal diamant diamond gemme gem quartz' },
  arcenciel: { fr: 'Arc-en-ciel', adj: 'Prismatique', c: ['#ff6bd5', '#7cf7ff'], glow: '#ffffff', words: 'arc-en-ciel arcenciel rainbow prisme prism multicolore' },
  sang: { fr: 'Sanglant', adj: 'Écarlate', c: ['#8a0f1f', '#ff3d4d'], glow: '#ff2d3d', words: 'sang blood vampire ecarlate rouge-sang' },
};
export const STYLES = {
  mignon: { words: 'mignon cute kawaii bebe baby mini petit adorable chibi' }, roi: { words: 'roi reine king queen royal couronne crown empereur' },
  ange: { words: 'ange angel aureole halo' }, demon: { words: 'demon demoniaque diable devil enfer hell maudit cursed' },
  cyber: { words: 'cyber robotique mecha meca techno futuriste' }, ninja: { words: 'ninja samourai samurai' }, pirate: { words: 'pirate corsaire' },
  sorcier: { words: 'sorcier wizard magicien mage magic sorciere witch' }, geant: { words: 'geant giant enorme huge titan colossal boss' }, zombie: { words: 'zombie mort undead squelette skeleton' },
};
export const RARITY_WORDS = { 'Commun': 'commun common basique', 'Rare': 'rare', 'Épique': 'epique epic', 'Légendaire': 'legendaire legendary legende', 'Mythique': 'mythique mythic mythical', 'Divin': 'divin divine dieu god', 'Secret 1/1B': 'secret 1/1b 1b milliard ultime ultimate' };
const COLORS = { rouge: '#ff3b4a', red: '#ff3b4a', bleu: '#3a7bff', blue: '#3a7bff', vert: '#3fd16b', green: '#3fd16b', rose: '#ff7ac8', pink: '#ff7ac8', violet: '#9a5cff', purple: '#9a5cff', jaune: '#ffd84d', yellow: '#ffd84d',
  orange: '#ff8a2a', noir: '#26222e', black: '#26222e', blanc: '#f7f5ff', white: '#f7f5ff', gris: '#9aa1ad', grey: '#9aa1ad', marron: '#8a5a36', brown: '#8a5a36', cyan: '#3ee6ff', turquoise: '#2fd6c4', argent: '#cfd6e2', silver: '#cfd6e2' };

/* ---------- parsing ---------- */
export function parse(text) {
  const t = ' ' + norm(text).replace(/[^\w\s\/-]/g, ' ') + ' ', has = (words) => words.split(' ').some((w) => w && t.includes(' ' + w + ' ') || (w.length > 4 && t.includes(w)));
  const out = { species: null, element: null, styles: [], rarity: null, colors: [], name: null, wings: /\b(ailes?|ailee?s?|wings?|winged|volant)\b/.test(t) };
  // compound dictionary names first (loup-garou, tigre blanc, chat noir…), with the name as typed (accents kept)
  const orig = String(text).toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter(Boolean), toks = t.trim().split(/\s+/);
  const asTyped = (i, n) => orig.slice(i, i + n).join(' ') || toks.slice(i, i + n).join(' ');
  for (let i = 0; i < toks.length && !out.species; i++) for (const [w, n] of [[toks[i] + '_' + (toks[i + 1] || ''), 2], [toks[i].replace(/-/g, '_'), 1]]) { const e = w.includes('_') ? LEX.get(w) : null;
    if (e && e.kind === 'animal' && SPECIES[e.species]) { out.species = e.species; out.lex = { ...e, word: asTyped(i, n) }; break; } }
  let t2 = t; if (!out.species) for (const [k, s] of Object.entries(SPECIES)) if (has(s.words)) { out.species = k; for (const w of s.words.split(' ')) if (w) t2 = t2.replace(' ' + w + ' ', ' '); break; }
  const has2 = (words) => words.split(' ').some((w) => w && t2.includes(' ' + w + ' ') || (w.length > 4 && t2.includes(w)));
  // not one of the 34 base species? use the scene dictionary (zèbre, pégase, loup-garou, girafe…) mapped onto a base species
  if (!out.species) { for (let i = 0; i < toks.length; i++) { const two = toks[i] + '_' + (toks[i + 1] || ''), w = LEX.has(two) ? two : toks[i], e = LEX.get(w);
      if (e && e.kind === 'animal' && SPECIES[e.species]) { out.species = e.species; out.lex = { ...e, word: asTyped(i, w.includes('_') ? 2 : 1) }; t2 = t2.replace(' ' + toks[i] + ' ', ' '); break; } } }
  for (const [k, e] of Object.entries(ELEMENTS)) if (has2(e.words)) { out.element = k; break; }
  for (const [k, s] of Object.entries(STYLES)) if (has(s.words)) out.styles.push(k);
  for (const [k, w] of Object.entries(RARITY_WORDS)) if (has(w)) out.rarity = k;
  for (const [w, c] of Object.entries(COLORS)) if (t.includes(' ' + w + ' ')) out.colors.push(c);
  const m = String(text).match(/["«“]([^"»”]{2,30})["»”]|(?:nomm[ée]+|appel[ée]+|named|called)\s+([A-Za-zÀ-ÿ0-9_-]{2,30})/i); if (m) out.name = (m[1] || m[2]).trim();
  return out;
}

/* ---------- the builder ---------- */
function Builder(r) {
  const parts = [];
  const add = (name, shape, size, pos, rot = [0, 0, 0], color = '#ffffff', material = 'SmoothPlastic', transparency = 0, extra = {}) => {
    const p = { name, shape, size: size.map((v) => r3(Math.max(0.04, v))), pos: pos.map(r3), rot: rot.map(r3), color, material, transparency, ...extra }; parts.push(p); return p; };
  const mirror = (p) => add(p.name.replace(/L(\d*)$/, 'R$1'), p.shape, p.size, [-p.pos[0], p.pos[1], p.pos[2]], [p.rot[0], -p.rot[1], -p.rot[2]], p.color, p.material, p.transparency, p.tint ? { tint: true } : {});
  const pair = (...a) => { const p = add(...a); mirror(p); return p; };
  // a smooth chain of ellipsoids following a curve: f(t) -> point, radius(t)
  const chain = (name, n, f, rad, color, material = 'SmoothPlastic', extra = {}, flat = 1) => {
    const out = []; for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, a = f(t0), b = f(t1), m = a.map((v, k) => (v + b[k]) / 2), d = b.map((v, k) => v - a[k]), len = Math.hypot(...d), rr = rad((t0 + t1) / 2);
      out.push(add(`${name}${i + 1}`, 'Ellipsoid', [rr * flat, rr, len * 1.45 + rr * 0.35], m, alongZ(d), typeof color === 'function' ? color((t0 + t1) / 2) : color, material, 0, extra)); } return out; };
  return { parts, add, mirror, pair, chain, r };
}
const bez = (p0, p1, p2, p3) => (t) => { const u = 1 - t; return [0, 1, 2].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]); };

/* ---------- face kit: the part that makes a pet look good ---------- */
function face(B, head, P, o = {}) {
  const { c, s } = head, eyeY = o.eyeY ?? 0.1, gap = o.gap ?? 0.42, es = (o.eye ?? 1) * (P.eyeScale || 1) * Math.min(s[0], s[1]) * 0.26;
  const angry = P.styles.includes('demon') || P.element === 'ombre' || P.element === 'sang' || o.fierce;
  for (const side of [-1, 1]) {
    const L = side < 0 ? 'L' : 'R', d = [side * gap, eyeY, -1], at = onSurface(c, s, d, -0.03), rot = facing([d[0] * 0.6, 0, -1]);
    if (P.style === 'robot') { B.add('Eye' + L, 'Block', [es * 1.4, es * 0.55, 0.06], at, rot, P.glow, 'Neon'); continue; }
    B.add('Eye' + L, 'Ellipsoid', [es * 1.05, es * 1.3, es * 0.5], at, rot, '#161321', 'SmoothPlastic');
    const iris = onSurface(c, s, d, 0.035 + es * 0.02);
    B.add('Iris' + L, 'Ellipsoid', [es * 0.78, es * 0.98, es * 0.28], [iris[0], iris[1] - es * 0.12, iris[2]], rot, angry ? P.glow : P.iris, angry ? 'Neon' : 'SmoothPlastic');
    B.add('Pupil' + L, 'Ellipsoid', [es * (angry ? 0.18 : 0.42), es * 0.6, es * 0.2], [iris[0], iris[1] - es * 0.1, iris[2] - 0.035], rot, '#0b0912');
    B.add('Shine' + L, 'Ball', [es * 0.42, es * 0.42, es * 0.42], [iris[0] - side * es * -0.18 + es * 0.12, iris[1] + es * 0.3, iris[2] - 0.07], [0, 0, 0], '#ffffff', 'Neon');
    B.add('Shine' + L + '2', 'Ball', [es * 0.2, es * 0.2, es * 0.2], [iris[0] - es * 0.18, iris[1] - es * 0.32, iris[2] - 0.07], [0, 0, 0], '#ffffff', 'Neon');
    if (angry) B.add('Brow' + L, 'Block', [es * 1.3, es * 0.22, es * 0.25], [at[0], at[1] + es * 0.78, at[2] - 0.05], [0, rot[1], side * -18], darken(P.c1, 0.55));
    if (!o.noBlush) { const ch = onSurface(c, s, [side * (gap + 0.32), eyeY - 0.42, -1], -0.02); B.add('Blush' + L, 'Ellipsoid', [es * 0.9, es * 0.42, 0.06], ch, facing([side * 0.9, 0, -1]), '#ff8fb8', 'SmoothPlastic', 0.25); }
  }
  if (o.mouth !== false && P.style !== 'robot') { const m = onSurface(c, s, [0, eyeY - 0.5, -1], -0.01), w = es * 0.42;
    if (angry) { for (const side of [-1, 1]) B.add('Fang' + (side < 0 ? 'L' : 'R'), 'Wedge', [0.05, w * 0.9, w * 0.5], [m[0] + side * w * 0.55, m[1] - w * 0.2, m[2] - 0.02], [180, 0, 0], '#ffffff'); }
    else for (const side of [-1, 1]) B.add('Mouth' + (side < 0 ? 'L' : 'R'), 'Cylinder', [w * 0.9, 0.05, 0.05], [m[0] + side * w * 0.38, m[1], m[2] - 0.01], [0, 0, side * 28], '#2a1b2b'); }
}

/* ---------- body plans ---------- */
function ears(B, head, P, kind) {
  const { c, s } = head, inner = lighten(P.c1, 0.55) === P.c1 ? '#ffc2d6' : mix(P.c2, '#ff9ec4', 0.45);
  const at = (dx, dy, dz) => onSurface(c, s, [dx, dy, dz], -0.06);
  if (kind === 'pointy' || kind === 'pointyBig') { const k = kind === 'pointyBig' ? 1.3 : 1; const p = at(-0.55, 0.85, -0.05);
    B.pair('EarL', 'Wedge', [0.18 * k, 0.62 * k, 0.5 * k], [p[0], p[1] + 0.18 * k, p[2]], [0, 90, -14], P.c1, 'SmoothPlastic', 0, { tint: true });
    B.pair('EarInL', 'Wedge', [0.08, 0.42 * k, 0.3 * k], [p[0] + 0.02, p[1] + 0.14 * k, p[2] - 0.07], [0, 90, -14], inner); }
  else if (kind === 'round') { const p = at(-0.62, 0.78, 0); B.pair('EarL', 'Ball', [0.5, 0.5, 0.5], p, [0, 0, 0], P.dark || P.c1, 'SmoothPlastic', 0, { tint: !P.dark });
    B.pair('EarInL', 'Ellipsoid', [0.3, 0.3, 0.12], [p[0], p[1] - 0.02, p[2] - 0.22], [0, 0, 0], inner); }
  else if (kind === 'floppy') { const p = at(-0.8, 0.45, 0.05); B.pair('EarL', 'Ellipsoid', [0.34, 0.95, 0.26], [p[0] - 0.08, p[1] - 0.35, p[2]], [0, 0, 18], darken(P.c1, 0.18)); }
  else if (kind === 'long') { const p = at(-0.3, 1, -0.05); B.pair('EarL', 'Ellipsoid', [0.36, 1.35, 0.22], [p[0], p[1] + 0.6, p[2]], [0, 0, 9], P.c1, 'SmoothPlastic', 0, { tint: true });
    B.pair('EarInL', 'Ellipsoid', [0.2, 1.05, 0.06], [p[0], p[1] + 0.57, p[2] - 0.11], [0, 0, 9], inner); }
  else if (kind === 'fin') { const p = at(-0.75, 0.55, 0.3); for (let i = 0; i < 3; i++) B.pair('FinL' + (i || ''), 'Wedge', [0.06, 0.5 - i * 0.1, 0.55 - i * 0.1], [p[0] - 0.06 * i, p[1] + 0.1 - i * 0.12, p[2] + 0.12 * i], [0, 90, -35 - i * 10], P.c2); }
  else if (kind === 'gills') { const p = at(-0.9, 0.2, 0.15); for (let i = 0; i < 3; i++) { const a = -40 + i * 40; B.pair('Gill' + (i + 1) + 'L', 'Ellipsoid', [0.16, 0.16, 0.7], [p[0] - 0.25 * Math.cos(a / D), p[1] + 0.25 * Math.sin(a / D) + 0.05, p[2] + 0.2], [-a, -65, 0], P.glow, 'Neon'); } }
}
function quad(B, P) {
  const r = B.r, k = P.size, hs = (P.style === 'mignon' ? 1.15 : 1) * (0.96 + r() * 0.1);
  const body = { c: [0, 0.98 * k, 0.32 * k], s: [1.72 * k, 1.38 * k, 2.05 * k] }, head = { c: [0, 2.08 * k, -0.78 * k], s: [1.72 * hs * k, 1.52 * hs * k, 1.5 * hs * k] };
  B.add('Body', 'Ellipsoid', body.s, body.c, [0, 0, 0], P.c1, P.mat, 0, { tint: true });
  B.add('Belly', 'Ellipsoid', [1.16 * k, 0.98 * k, 1.36 * k], [0, 0.84 * k, 0.06 * k], [0, 0, 0], P.c2, P.mat2);
  B.add('Chest', 'Ellipsoid', [0.95 * k, 0.8 * k, 0.6 * k], [0, 1.25 * k, -0.5 * k], [0, 0, 0], P.c2, P.mat2);
  B.add('Head', 'Ellipsoid', head.s, head.c, [0, 0, 0], P.c1, P.mat, 0, { tint: true });
  const sn = P.sp.snout || 1;
  if (sn > 1) { const m = onSurface(head.c, head.s, [0, -0.35, -1], -0.25 * k); B.add('Snout', 'Ellipsoid', [0.82 * k, 0.55 * k, 0.62 * sn * k], [m[0], m[1], m[2] - 0.18 * sn * k], [-8, 0, 0], P.c2, P.mat2);
    B.add('Nose', 'Ellipsoid', [0.26 * k, 0.17 * k, 0.14 * k], [m[0], m[1] + 0.14 * k, m[2] - 0.5 * sn * k], [0, 0, 0], P.dark || '#2b1d24', 'Glass'); }
  else { const m = onSurface(head.c, head.s, [0, -0.28, -1]); B.add('Nose', 'Ellipsoid', [0.2 * k, 0.13 * k, 0.1 * k], [m[0], m[1], m[2] - 0.02], [0, 0, 0], '#ff7aa8'); }
  if (P.sp.pattern === 'panda') { for (const side of [-1, 1]) B.add('Patch' + (side < 0 ? 'L' : 'R'), 'Ellipsoid', [0.55 * k, 0.62 * k, 0.12], onSurface(head.c, head.s, [side * 0.44, 0.06, -1], -0.07), [0, side * 18, side * -25], P.dark); }
  face(B, head, P, { gap: 0.42, eyeY: sn > 1 ? 0.22 : 0.1, eye: P.style === 'mignon' ? 1.15 : 1 });
  ears(B, head, P, P.sp.ears);
  // legs: short rounded legs + paws with toes
  for (const [fz, nm] of [[-0.42, 'F'], [0.98, 'B']]) for (const side of [-1, 1]) { const x = side * 0.5 * k, z = fz * k, L = side < 0 ? 'L' : 'R';
    B.add('Leg' + nm + L, 'Ellipsoid', [0.46 * k, 0.62 * k, 0.5 * k], [x, 0.42 * k, z], [0, 0, 0], P.c1, P.mat, 0, { tint: true });
    B.add('Paw' + nm + L, 'Ellipsoid', [0.52 * k, 0.3 * k, 0.62 * k], [x, 0.15 * k, z - 0.08 * k], [0, 0, 0], P.c2, P.mat2);
    for (let t = -1; t <= 1; t++) B.add('Toe' + nm + L + (t + 2), 'Ball', [0.13 * k, 0.13 * k, 0.13 * k], [x + t * 0.14 * k, 0.12 * k, z - 0.38 * k], [0, 0, 0], lighten(P.c2, 0.2));
    if (P.fierce) for (let t = -1; t <= 1; t++) B.add('Claw' + nm + L + (t + 2), 'Ellipsoid', [0.07 * k, 0.07 * k, 0.17 * k], [x + t * 0.14 * k, 0.1 * k, z - 0.47 * k], [20, 0, 0], '#f7f1e6'); }
  // patterns
  if (P.sp.pattern === 'stripes') for (let i = 0; i < 4; i++) for (const side of [-1, 1]) { const d = [side, 0.35 - i * 0.12, -0.2 + i * 0.42];
    B.add('Stripe' + (i + 1) + (side < 0 ? 'L' : 'R'), 'Ellipsoid', [0.09, 0.78 * k, 0.24 * k], onSurface(body.c, body.s, d, -0.03), [0, side * 90, side * (12 - i * 5)], '#2a1d18'); }
  if (P.sp.pattern === 'spots') for (let i = 0; i < 7; i++) { const d = [Math.cos(i * 2.4) * 0.9, 0.3 + Math.sin(i * 1.7) * 0.5, Math.sin(i * 2.4) * 0.9], p = onSurface(body.c, body.s, d, -0.04);
    B.add('Spot' + (i + 1), 'Ellipsoid', [0.4 * k - (i % 3) * 0.06, 0.4 * k - (i % 3) * 0.06, 0.1], p, alongZ(d), darken(P.c1, 0.32)); }
  if (P.sp.pattern === 'socks') for (const n of ['FL', 'FR', 'BL', 'BR']) { const leg = B.parts.find((x) => x.name === 'Leg' + n); if (leg) leg.color = P.c2; }
  if (P.sp.mane) { const n = 14; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, col = P.sp.mane === 'rainbow' ? hsl(i * (360 / n), 0.85, 0.7) : darken(P.c1, 0.25);
    B.add('Mane' + (i + 1), 'Ellipsoid', [0.62 * k, 0.62 * k, 0.5 * k], [Math.cos(a) * 0.86 * k * hs, head.c[1] + Math.sin(a) * 0.76 * k * hs, head.c[2] + 0.38 * k], [0, 0, (a * D) % 360], col, P.sp.mane === 'rainbow' ? 'SmoothPlastic' : P.mat); } }
  tails(B, P, [0, 1.2 * k, 1.3 * k], k);
  if (P.sp.antlers) for (const side of [-1, 1]) { const b = onSurface(head.c, head.s, [side * 0.35, 1, 0.1], -0.05);
    const pts = B.chain('Antler' + (side < 0 ? 'L' : 'R'), 4, bez(b, [b[0] + side * 0.25, b[1] + 0.5, b[2]], [b[0] + side * 0.7, b[1] + 0.9, b[2] + 0.15], [b[0] + side * 0.9, b[1] + 1.25, b[2] - 0.05]), () => 0.13 * k, '#e9d9bd');
    for (let j = 1; j < 3; j++) { const q = pts[j].pos; B.add('Tine' + j + (side < 0 ? 'L' : 'R'), 'Ellipsoid', [0.1, 0.1, 0.5 * k], [q[0], q[1] + 0.22, q[2] - 0.1], [-60, side * -20, 0], '#e9d9bd'); } }
  if (P.sp.unihorn) { const b = onSurface(head.c, head.s, [0, 0.9, -0.45], -0.08); for (let i = 0; i < 6; i++) { const t = i / 6;
    B.add('Horn' + (i + 1), 'Cylinder', [0.2 * k, (0.26 - t * 0.18) * k, (0.26 - t * 0.18) * k], [b[0], b[1] + t * 0.95 * k, b[2] - t * 0.25 * k], [0, i * 30, 76], i % 2 ? '#ffe7a8' : '#fff7e0', 'Foil'); } }
  if (P.sp.horns === 'curved') horns(B, head, P, k);
  if (P.sp.wings) wings(B, P, P.sp.wings, [0, 1.55 * k, 0.15 * k], k);
  if (P.sp.spikes) for (let i = 0; i < 5; i++) { const p = onSurface(body.c, body.s, [0, 1, -0.55 + i * 0.32], -0.05); B.add('Spike' + (i + 1), 'Wedge', [0.08, (0.42 - Math.abs(i - 1.5) * 0.06) * k, 0.38 * k], [p[0], p[1] + 0.12, p[2]], [0, 90, 0], P.c3); }
  return { body, head };
}
function horns(B, head, P, k) {
  for (const side of [-1, 1]) { const b = onSurface(head.c, head.s, [side * 0.42, 0.9, 0.1], -0.08), L = side < 0 ? 'L' : 'R';
    B.chain('Horn' + L, 5, bez(b, [b[0] + side * 0.2, b[1] + 0.45, b[2] + 0.1], [b[0] + side * 0.35, b[1] + 0.75, b[2] + 0.55], [b[0] + side * 0.25, b[1] + 0.7, b[2] + 1.0]), (t) => (0.24 - t * 0.17) * k,
      (t) => mix(P.horn, lighten(P.horn, 0.5), t), P.element === 'or' ? 'Foil' : 'SmoothPlastic'); }
}
function tails(B, P, base, k) {
  const t = P.sp.tail, c1 = P.c1;
  if (t === 'stub' || t === 'puff') { B.add('Tail', 'Ball', [0.5 * k, 0.5 * k, 0.5 * k], [base[0], base[1] - 0.1 * k, base[2]], [0, 0, 0], t === 'puff' ? '#ffffff' : c1); return; }
  if (t === 'fluffy') { const segs = B.chain('Tail', 4, bez(base, [0, base[1] + 0.2, base[2] + 0.6 * k], [0, base[1] + 0.9 * k, base[2] + 1.1 * k], [0, base[1] + 1.4 * k, base[2] + 0.9 * k]), (u) => (0.5 + Math.sin(u * Math.PI) * 0.35) * k, c1, P.mat);
    const tip = segs[segs.length - 1]; B.add('TailTip', 'Ellipsoid', [0.55 * k, 0.55 * k, 0.65 * k], tip.pos, tip.rot, '#ffffff'); return; }
  if (t === 'tuft' || t === 'long' || t === 'curl' || t === 'wag' || t === 'mane') { const curl = t === 'curl' ? 0.9 : t === 'wag' ? 0.5 : 0.2;
    const segs = B.chain('Tail', 6, bez(base, [0, base[1] + 0.1, base[2] + 0.7 * k], [0, base[1] + 0.6 * k + curl, base[2] + 1.0 * k], [0, base[1] + 1.1 * k + curl * 0.4, base[2] + 0.6 * k + curl * 0.3]), (u) => (0.28 - u * 0.08) * k, c1, P.mat);
    if (t === 'tuft') B.add('TailTip', 'Ball', [0.42 * k, 0.42 * k, 0.42 * k], segs[5].pos, [0, 0, 0], darken(c1, 0.3));
    if (t === 'mane') segs.forEach((s, i) => { s.color = hsl(300 - i * 50, 0.85, 0.72); });
    return; }
  if (t === 'dragon') { const segs = B.chain('Tail', 7, bez(base, [0, base[1] - 0.35, base[2] + 0.9 * k], [0.5 * k, base[1] - 0.6, base[2] + 1.8 * k], [0.2 * k, base[1] - 0.2, base[2] + 2.6 * k]), (u) => (0.42 - u * 0.3) * k, c1, P.mat);
    const tip = segs[6]; B.add('TailTip', 'Wedge', [0.1, 0.55 * k, 0.6 * k], [tip.pos[0], tip.pos[1] + 0.12, tip.pos[2] + 0.25], [0, 90, 0], P.c3, P.element === 'feu' || P.element === 'lave' ? 'Neon' : 'SmoothPlastic');
    for (let i = 1; i < 6; i += 2) B.add('TailSpike' + i, 'Wedge', [0.06, 0.24 * k, 0.24 * k], [segs[i].pos[0], segs[i].pos[1] + 0.25 * k * (1 - i / 8), segs[i].pos[2]], [0, 90, 0], P.c3); return; }
  if (t === 'fishtail') { const segs = B.chain('Tail', 4, bez(base, [0, base[1] - 0.2, base[2] + 0.7 * k], [0, base[1] - 0.25, base[2] + 1.3 * k], [0, base[1] - 0.15, base[2] + 1.8 * k]), (u) => (0.5 - u * 0.3) * k, c1, P.mat, {}, 0.7);
    B.add('TailFin', 'Ellipsoid', [0.08, 0.9 * k, 0.8 * k], [0, segs[3].pos[1], segs[3].pos[2] + 0.2], [0, 0, 0], P.glow, 'Neon', 0.25); }
}
function wings(B, P, kind, at, k) {
  for (const side of [-1, 1]) { const L = side < 0 ? 'L' : 'R', bx = side * 0.6 * k;
    if (kind === 'membrane') {
      const bone = B.chain('WingBone' + L, 3, bez([bx, at[1], at[2]], [bx + side * 0.6, at[1] + 0.8, at[2] + 0.1], [bx + side * 1.2, at[1] + 1.3, at[2] + 0.2], [bx + side * 1.8, at[1] + 1.1, at[2] + 0.4]), () => 0.12 * k, darken(P.c1, 0.2));
      const skin = P.element ? mix(P.c3, P.c2, 0.35) : P.c2, f = bez([bx, at[1], at[2]], [bx + side * 0.6, at[1] + 0.8, at[2] + 0.1], [bx + side * 1.2, at[1] + 1.3, at[2] + 0.2], [bx + side * 1.8, at[1] + 1.1, at[2] + 0.4]);
      // overlapping panels from the wing bone down to the body: one continuous membrane (and one seamless skin in Blender HD)
      for (let i = 0; i < 5; i++) { const b = f(0.2 + i * 0.2), a = [bx + side * (0.1 + i * 0.12) * k, at[1] - 0.15 * k, at[2] + 0.3 + i * 0.06], d = [b[0] - a[0], b[1] - a[1]], len = Math.hypot(...d) + 0.25 * k;
        B.add((i === 0 ? 'Wing' : 'WingSkin' + i) + L, 'Ellipsoid', [(0.55 - i * 0.04) * k, len, 0.07], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [0, 0, r3(Math.atan2(-d[0], d[1]) * D)], skin, 'SmoothPlastic', 0.04); }
      for (let i = 0; i < 3; i++) B.add('Claw' + (i + 1) + 'W' + L, 'Ellipsoid', [0.07, 0.07, 0.22], [bone[i].pos[0] + side * 0.12, bone[i].pos[1] + 0.08, bone[i].pos[2] - 0.05], [-30, 0, 0], '#f7f1e6');
    } else if (kind === 'feather') {
      for (let i = 0; i < 6; i++) { const a = (i / 5) * 70 - 10, len = (1.5 - i * 0.12) * k, x = bx + side * (0.2 + i * 0.22), col = P.element === 'feu' ? hsl(10 + i * 9, 1, 0.55) : mix(P.c1, P.c2, i / 6);
        B.add((i === 0 ? 'Wing' : 'Feather' + i) + L, 'Ellipsoid', [0.12, 0.32 * k, len], [x + side * Math.sin(a / D) * len * 0.35, at[1] + 0.35 + Math.cos(a / D) * 0.45, at[2] + 0.35], [-25 - i * 6, side * -(30 + a * 0.5), side * -a], col, P.element === 'feu' ? 'Neon' : 'SmoothPlastic'); }
    } else if (kind === 'angel') {
      for (let i = 0; i < 5; i++) B.add((i === 0 ? 'Wing' : 'Feather' + i) + L, 'Ellipsoid', [0.1, 0.42 * k, (1.3 - i * 0.16) * k], [bx + side * (0.35 + i * 0.25), at[1] + 0.5 + i * 0.12, at[2] + 0.4], [-20, side * -40, side * -(20 + i * 12)], '#ffffff', 'SmoothPlastic');
    } else if (kind === 'insect') {
      for (const [dy, s, nm] of [[0.25, 1, 'Wing'], [-0.25, 0.75, 'WingLow']]) B.add(nm + L, 'Ellipsoid', [0.04, 0.9 * s * k, 1.3 * s * k], [bx + side * 0.75 * s, at[1] + dy + 0.3, at[2] + 0.25], [0, 0, side * -(55 - dy * 40)], P.glow, 'Glass', 0.35);
    } else if (kind === 'mecha') {
      for (let i = 0; i < 3; i++) { B.add((i === 0 ? 'Wing' : 'Blade' + i) + L, 'Block', [0.08, 0.28 * k, (1.3 - i * 0.25) * k], [bx + side * (0.4 + i * 0.32), at[1] + 0.4 - i * 0.15, at[2] + 0.35], [-15, side * -25, side * -(25 + i * 20)], darken(P.c1, 0.3), 'Metal');
        B.add('BladeGlow' + i + L, 'Block', [0.09, 0.06, (1.2 - i * 0.25) * k], [bx + side * (0.4 + i * 0.32), at[1] + 0.27 - i * 0.15, at[2] + 0.35], [-15, side * -25, side * -(25 + i * 20)], P.glow, 'Neon'); }
    } } }
function birdPlan(B, P) {
  const k = P.size, body = { c: [0, 1.2 * k, 0.1 * k], s: [1.85 * k, 2.15 * k, 1.75 * k] };
  B.add('Body', 'Ellipsoid', body.s, body.c, [0, 0, 0], P.c1, P.mat, 0, { tint: true });
  B.add('Belly', 'Ellipsoid', [1.3 * k, 1.6 * k, 0.6 * k], onSurface(body.c, body.s, [0, -0.15, -1], -0.25), [0, 0, 0], P.c2, P.mat2);
  const head = { c: [0, 1.75 * k, -0.15 * k], s: [1.6 * k, 1.35 * k, 1.4 * k] }; // the "face disc" of the round bird
  B.add('Head', 'Ellipsoid', head.s, head.c, [0, 0, 0], P.c1, P.mat, 0, { tint: true });
  if (P.sp.tufts) for (const side of [-1, 1]) B.add('Ear' + (side < 0 ? 'L' : 'R'), 'Wedge', [0.12, 0.5 * k, 0.38 * k], onSurface(head.c, head.s, [side * 0.6, 0.9, 0], -0.1), [0, 90, side * -22], darken(P.c1, 0.25));
  if (P.sp.crest) for (let i = 0; i < 5; i++) { const p = onSurface(head.c, head.s, [0, 1, 0.1 + i * 0.25], -0.1); B.add('Crest' + (i + 1), 'Ellipsoid', [0.12, 0.7 * k - i * 0.08, 0.22 * k], [p[0], p[1] + 0.3, p[2]], [-30 - i * 12, 0, 0], hsl(20 + i * 10, 1, 0.55), 'Neon'); }
  face(B, head, P, { gap: 0.36, eyeY: 0.15, eye: 1.2, mouth: false, noBlush: P.sp.beak === 'hook' });
  const b = onSurface(head.c, head.s, [0, -0.15, -1]);
  B.add('Beak', 'Wedge', [0.34 * k, 0.24 * k, 0.32 * k], [b[0], b[1] - 0.06, b[2] - 0.12], [P.sp.beak === 'hook' ? 160 : 180, 0, 0], '#ffb02e');
  for (const side of [-1, 1]) { const L = side < 0 ? 'L' : 'R';
    if (!P.sp.wings) B.add('Wing' + L, 'Ellipsoid', [0.32 * k, (P.sp.flippers ? 1.2 : 1.35) * k, 0.95 * k], onSurface(body.c, body.s, [side, -0.05, 0.1], -0.12), [0, 0, side * (P.sp.flippers ? 25 : 10)], darken(P.c1, 0.12), P.mat);
    B.add('Foot' + L, 'Ellipsoid', [0.42 * k, 0.16 * k, 0.55 * k], [side * 0.42 * k, 0.08 * k, -0.25 * k], [0, side * -12, 0], '#ffb02e'); }
  if (P.sp.wings) wings(B, P, P.sp.wings, [0, 1.45 * k, 0.3 * k], k);
  if (P.sp.tailFeathers) for (let i = 0; i < 5; i++) { const a = (i - 2) * 16; B.add('Tail' + (i + 1), 'Ellipsoid', [0.14, 0.4 * k, 1.6 * k], [Math.sin(a / D) * 0.6, 0.85 * k + Math.abs(i - 2) * -0.08, 1.4 * k], [30, a, 0], hsl(10 + i * 12, 1, 0.56), 'Neon'); }
  else B.add('Tail', 'Wedge', [0.6 * k, 0.4 * k, 0.6 * k], [0, 0.65 * k, 0.95 * k], [0, 0, 0], darken(P.c1, 0.1));
  return { body, head };
}
function snakePlan(B, P) {
  const k = P.size, n = 14;
  B.chain('Coil', n, (t) => { const a = t * Math.PI * 3.2, r = (1.25 - t * 0.55) * k; return [Math.cos(a) * r, (0.32 + t * 0.85) * k, Math.sin(a) * r + 0.2 * k]; }, (t) => (0.62 - t * 0.12) * k, (t) => (Math.floor(t * n) % 2 ? P.c1 : mix(P.c1, P.c2, 0.35)), P.mat);
  const neck = B.chain('Neck', 4, bez([0.55 * k, 1.05 * k, 0], [0.4 * k, 1.6 * k, -0.2 * k], [0.1 * k, 2.2 * k, -0.4 * k], [0, 2.45 * k, -0.55 * k]), () => 0.46 * k, P.c1, P.mat);
  neck[0].name = 'Body'; neck[0].tint = true;
  const head = { c: [0, 2.6 * k, -0.85 * k], s: [1.35 * k, 0.95 * k, 1.45 * k] };
  B.add('Head', 'Ellipsoid', head.s, head.c, [0, 0, 0], P.c1, P.mat, 0, { tint: true });
  if (P.styles.includes('roi') || P.element) B.add('Hood', 'Ellipsoid', [2.0 * k, 1.5 * k, 0.25 * k], [0, 2.35 * k, -0.35 * k], [-12, 0, 0], mix(P.c1, P.c2, 0.4), P.mat);
  face(B, head, P, { gap: 0.38, eyeY: 0.25, eye: 1.05, fierce: true, noBlush: true });
  const t = onSurface(head.c, head.s, [0, -0.3, -1]); B.add('Tongue', 'Wedge', [0.06, 0.08, 0.5 * k], [t[0], t[1], t[2] - 0.2], [0, 0, 0], '#ff3d6e');
  return { body: { c: [0, 0.7 * k, 0.2], s: [2.4 * k, 1.2 * k, 2.4 * k] }, head };
}
function fishPlan(B, P) {
  const k = P.size, body = { c: [0, 1.6 * k, 0.2 * k], s: [1.35 * k, 1.75 * k, 2.6 * k] };
  B.add('Body', 'Ellipsoid', body.s, body.c, [0, 0, 0], P.c1, P.mat, 0, { tint: true });
  B.add('Belly', 'Ellipsoid', [1.05 * k, 1.0 * k, 2.0 * k], [0, 1.25 * k, 0.1 * k], [0, 0, 0], P.c2, P.mat2);
  if (!P.sp.shark) for (let i = 0; i < 2; i++) B.add('Band' + (i + 1), 'Ellipsoid', [1.4 * k, 1.8 * k, 0.28 * k], [0, 1.6 * k, (-0.35 + i * 0.85) * k], [0, 0, 0], '#ffffff');
  const head = { c: [0, 1.75 * k, -0.6 * k], s: [1.2 * k, 1.3 * k, 1.2 * k] };
  face(B, head, P, { gap: 0.55, eyeY: 0.1, eye: 1.0, fierce: P.sp.shark, noBlush: P.sp.shark, mouth: !P.sp.shark });
  if (P.sp.shark) for (let i = -2; i <= 2; i++) B.add('Tooth' + (i + 3), 'Wedge', [0.05, 0.16, 0.12], onSurface(head.c, head.s, [i * 0.12, -0.45, -1], -0.02), [180, 0, 0], '#ffffff');
  B.add('Fin', 'Wedge', [0.1, (P.sp.shark ? 1.1 : 0.8) * k, 1.0 * k], [0, 2.6 * k, 0.35 * k], [0, 180, 0], P.sp.shark ? P.c1 : P.glow, P.sp.shark ? P.mat : 'SmoothPlastic');
  B.pair('FinL', 'Ellipsoid', [0.08, 0.5 * k, 0.8 * k], [-0.72 * k, 1.25 * k, 0], [20, 0, 35], P.sp.shark ? darken(P.c1, 0.15) : P.glow);
  B.add('Tail1', 'Ellipsoid', [0.6 * k, 0.75 * k, 0.9 * k], [0, 1.6 * k, 1.5 * k], [0, 0, 0], P.c1, P.mat);
  for (const s of [-1, 1]) B.add('TailFin' + (s < 0 ? 'Up' : 'Down'), 'Ellipsoid', [0.08, 1.2 * k, 0.55 * k], [0, 1.6 * k + s * -0.45 * k, 2.05 * k], [s * 35, 0, 0], P.sp.shark ? P.c1 : P.glow, P.sp.shark ? P.mat : 'SmoothPlastic');
  for (let i = 0; i < 4; i++) B.add('Bubble' + (i + 1), 'Ball', [0.18 + i * 0.05, 0.18 + i * 0.05, 0.18 + i * 0.05], [0.3 - i * 0.1, 2.5 * k + i * 0.45, -1.3 * k - i * 0.1], [0, 0, 0], '#d6f6ff', 'Glass', 0.4);
  return { body, head };
}
function octoPlan(B, P) {
  const k = P.size, head = { c: [0, 2.0 * k, 0.1 * k], s: [2.0 * k, 2.1 * k, 1.9 * k] };
  B.add('Body', 'Ellipsoid', head.s, head.c, [0, 0, 0], P.c1, P.mat, 0, { tint: true }); B.add('Head', 'Ellipsoid', [1.7 * k, 1.2 * k, 1.6 * k], [0, 1.45 * k, 0], [0, 0, 0], P.c1, P.mat);
  for (let i = 0; i < 6; i++) { const p = onSurface(head.c, head.s, [Math.cos(i * 1.1) * 0.6, 0.7, Math.sin(i * 1.1) * 0.6 + 0.2], -0.08); B.add('Spot' + (i + 1), 'Ellipsoid', [0.32, 0.32, 0.1], p, alongZ(p.map((v, j) => v - head.c[j])), lighten(P.c1, 0.4)); }
  face(B, { c: [0, 1.75 * k, 0], s: [1.9 * k, 1.6 * k, 1.8 * k] }, P, { gap: 0.42, eyeY: 0.05, eye: 1.25 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2, dx = Math.cos(a), dz = Math.sin(a), curl = i % 2 ? 0.6 : -0.6;
    B.chain('Tentacle' + (i + 1) + '_', 6, bez([dx * 0.6 * k, 1.0 * k, dz * 0.6 * k], [dx * 1.2 * k, 0.35 * k, dz * 1.2 * k], [dx * 1.9 * k + dz * curl, 0.2 * k, dz * 1.9 * k - dx * curl], [dx * 2.0 * k + dz * curl * 1.4, 0.75 * k, dz * 2.0 * k - dx * curl * 1.4]), (t) => (0.36 - t * 0.27) * k, (t) => mix(P.c1, P.c2, t * 0.8), P.mat); }
  return { body: { c: head.c, s: head.s }, head };
}
function jellyPlan(B, P) {
  const k = P.size, head = { c: [0, 2.6 * k, 0], s: [2.2 * k, 1.7 * k, 2.2 * k] };
  B.add('Body', 'Ellipsoid', head.s, head.c, [0, 0, 0], P.c1, 'Glass', 0.25, { tint: true }); B.add('Core', 'Ball', [1.1 * k, 1.1 * k, 1.1 * k], [0, 2.6 * k, 0], [0, 0, 0], P.glow, 'Neon');
  B.add('Head', 'Ellipsoid', [2.3 * k, 0.4 * k, 2.3 * k], [0, 1.85 * k, 0], [0, 0, 0], lighten(P.c1, 0.3), 'Glass', 0.3);
  face(B, { c: [0, 2.45 * k, 0], s: [2.05 * k, 1.5 * k, 2.05 * k] }, P, { gap: 0.36, eyeY: 0, eye: 1.1 });
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, x = Math.cos(a) * 0.75 * k, z = Math.sin(a) * 0.75 * k;
    B.chain('Tentacle' + (i + 1) + '_', 4, bez([x, 1.8 * k, z], [x * 1.2, 1.2 * k, z * 1.2 + 0.2], [x * 0.9 - 0.2, 0.7 * k, z * 0.9], [x * 1.1, 0.25 * k, z * 1.1 + 0.2]), () => 0.09 * k, i % 2 ? P.glow : lighten(P.c1, 0.4), i % 2 ? 'Neon' : 'Glass'); }
  return { body: head, head };
}
function ghostPlan(B, P) {
  const k = P.size, body = { c: [0, 2.0 * k, 0], s: [1.9 * k, 2.1 * k, 1.8 * k] };
  B.add('Body', 'Ellipsoid', body.s, body.c, [0, 0, 0], P.c1, P.element === 'ombre' ? 'SmoothPlastic' : 'Glass', P.element === 'ombre' ? 0 : 0.12, { tint: true });
  B.add('Head', 'Ellipsoid', [1.6 * k, 1.5 * k, 1.5 * k], [0, 2.35 * k, -0.1 * k], [0, 0, 0], P.c1, 'SmoothPlastic', 0.0);
  B.chain('Wisp', 5, bez([0, 1.3 * k, 0.2], [0.3, 0.9 * k, 0.6 * k], [-0.4, 0.6 * k, 0.9 * k], [0.2, 0.35 * k, 1.3 * k]), (t) => (0.85 - t * 0.7) * k, P.c1, 'Glass');
  for (const side of [-1, 1]) B.add('Arm' + (side < 0 ? 'L' : 'R'), 'Ellipsoid', [0.4 * k, 0.75 * k, 0.4 * k], [side * 0.95 * k, 1.85 * k, -0.25 * k], [20, 0, side * 40], P.c1, 'SmoothPlastic');
  B.add('Core', 'Ball', [0.6 * k, 0.6 * k, 0.6 * k], [0, 1.85 * k, 0.05], [0, 0, 0], P.glow, 'Neon', 0.15);
  face(B, { c: [0, 2.35 * k, -0.1 * k], s: [1.6 * k, 1.5 * k, 1.5 * k] }, P, { gap: 0.38, eyeY: 0.1, eye: 1.2 });
  return { body, head: body };
}
function slimePlan(B, P) {
  const k = P.size, body = { c: [0, 1.0 * k, 0], s: [2.5 * k, 1.85 * k, 2.4 * k] };
  B.add('Body', 'Ellipsoid', body.s, body.c, [0, 0, 0], P.c1, 'Glass', 0.22, { tint: true });
  B.add('Core', 'Ball', [1.0 * k, 1.0 * k, 1.0 * k], [0, 1.0 * k, 0.15], [0, 0, 0], P.glow, 'Neon');
  B.add('Head', 'Ellipsoid', [2.0 * k, 0.5 * k, 2.0 * k], [0, 1.65 * k, 0], [0, 0, 0], lighten(P.c1, 0.45), 'Glass', 0.35);
  for (let i = 0; i < 5; i++) B.add('Drip' + (i + 1), 'Ellipsoid', [0.4 * k, 0.6 * k, 0.4 * k], [Math.cos(i * 1.3) * 1.05 * k, 0.32 * k, Math.sin(i * 1.3) * 1.05 * k], [0, 0, 0], P.c1, 'Glass', 0.22);
  for (let i = 0; i < 4; i++) B.add('Bubble' + (i + 1), 'Ball', [0.2, 0.2, 0.2], [Math.cos(i * 2.1) * 0.6, 0.7 + i * 0.25, Math.sin(i * 2.1) * 0.5], [0, 0, 0], '#ffffff', 'Glass', 0.3);
  face(B, body, P, { gap: 0.32, eyeY: 0.12, eye: 1.25 });
  return { body, head: body };
}
function beePlan(B, P) {
  const k = P.size, body = { c: [0, 1.6 * k, 0.55 * k], s: [1.6 * k, 1.5 * k, 1.9 * k] };
  B.add('Body', 'Ellipsoid', body.s, body.c, [0, 0, 0], P.c1, P.mat, 0, { tint: true });
  for (let i = 0; i < 3; i++) B.add('Stripe' + (i + 1), 'Ellipsoid', [1.62 * k - i * 0.12, 1.52 * k - i * 0.12, 0.3 * k], [0, 1.6 * k, (0.2 + i * 0.45) * k], [0, 0, 0], P.c2, P.mat);
  B.add('Stinger', 'Wedge', [0.1, 0.3 * k, 0.4 * k], [0, 1.55 * k, 1.55 * k], [0, 90, 90], '#2a2230');
  const head = { c: [0, 1.85 * k, -0.85 * k], s: [1.5 * k, 1.4 * k, 1.35 * k] };
  B.add('Head', 'Ellipsoid', head.s, head.c, [0, 0, 0], P.c1, P.mat, 0, { tint: true });
  face(B, head, P, { gap: 0.4, eyeY: 0.1, eye: 1.15 });
  for (const side of [-1, 1]) { const b = onSurface(head.c, head.s, [side * 0.3, 1, 0], -0.05);
    B.chain('Antenna' + (side < 0 ? 'L' : 'R'), 3, bez(b, [b[0] + side * 0.1, b[1] + 0.4, b[2]], [b[0] + side * 0.3, b[1] + 0.7, b[2] - 0.2], [b[0] + side * 0.35, b[1] + 0.85, b[2] - 0.45]), () => 0.06, '#2a2230');
    B.add('Tip' + (side < 0 ? 'L' : 'R'), 'Ball', [0.22, 0.22, 0.22], [b[0] + side * 0.35, b[1] + 0.85, b[2] - 0.45], [0, 0, 0], P.glow, 'Neon'); }
  wings(B, P, 'insect', [0, 2.0 * k, 0.4 * k], k);
  return { body, head };
}
function butterflyPlan(B, P) {
  const k = P.size, body = { c: [0, 1.6 * k, 0.3], s: [0.6 * k, 0.6 * k, 1.7 * k] };
  B.add('Body', 'Ellipsoid', body.s, body.c, [0, 0, 0], darken(P.c1, 0.4), P.mat, 0, {});
  const head = { c: [0, 1.75 * k, -0.7 * k], s: [1.2 * k, 1.1 * k, 1.1 * k] };
  B.add('Head', 'Ellipsoid', head.s, head.c, [0, 0, 0], P.c2, P.mat, 0, { tint: true });
  face(B, head, P, { gap: 0.36, eyeY: 0.05, eye: 1.2 });
  for (const side of [-1, 1]) { const L = side < 0 ? 'L' : 'R';
    B.add('Wing' + L, 'Ellipsoid', [0.05, 1.7 * k, 1.5 * k], [side * 1.0 * k, 2.3 * k, 0.1], [0, 0, side * -38], P.c1, 'SmoothPlastic', 0, { tint: true });
    B.add('WingLow' + L, 'Ellipsoid', [0.05, 1.1 * k, 1.1 * k], [side * 0.85 * k, 1.35 * k, 0.75 * k], [0, 0, side * 40], P.c1, 'SmoothPlastic', 0, { tint: true });
    for (let i = 0; i < 3; i++) B.add('WingDot' + (i + 1) + L, 'Ellipsoid', [0.07, (0.5 - i * 0.12) * k, (0.5 - i * 0.12) * k], [side * (0.75 + i * 0.32) * k, (2.0 + i * 0.32) * k, 0.1 - i * 0.06], [0, 0, side * -38], i % 2 ? '#ffffff' : P.glow, i % 2 ? 'SmoothPlastic' : 'Neon');
    B.chain('Antenna' + L, 3, bez([side * 0.2, 2.25 * k, -0.85 * k], [side * 0.3, 2.7 * k, -1.0 * k], [side * 0.5, 3.0 * k, -1.0 * k], [side * 0.65, 3.15 * k, -0.85 * k]), () => 0.05, '#2a2230');
    B.add('Tip' + L, 'Ball', [0.2, 0.2, 0.2], [side * 0.65, 3.15 * k, -0.85 * k], [0, 0, 0], P.glow, 'Neon'); }
  return { body, head };
}
function spiderPlan(B, P) {
  const k = P.size, body = { c: [0, 1.3 * k, 0.6 * k], s: [1.8 * k, 1.5 * k, 2.0 * k] };
  B.add('Body', 'Ellipsoid', body.s, body.c, [0, 0, 0], P.c1, P.mat, 0, { tint: true });
  B.add('Mark', 'Ellipsoid', [0.6 * k, 0.9 * k, 0.12], onSurface(body.c, body.s, [0, 0.6, 1], -0.03), [-35, 0, 0], P.glow, 'Neon');
  const head = { c: [0, 1.15 * k, -0.75 * k], s: [1.35 * k, 1.15 * k, 1.2 * k] };
  B.add('Head', 'Ellipsoid', head.s, head.c, [0, 0, 0], P.c1, P.mat, 0, { tint: true });
  face(B, head, P, { gap: 0.34, eyeY: 0.18, eye: 1.0, fierce: P.styles.includes('demon') });
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) { const z = (-0.65 + i * 0.45) * k, b = [side * 0.65 * k, 1.1 * k, z];
    B.chain('Leg' + (i + 1) + (side < 0 ? 'L' : 'R') + '_', 3, bez(b, [side * 1.4 * k, 1.85 * k, z * 1.3], [side * 1.95 * k, 1.4 * k, z * 1.5], [side * 2.15 * k, 0.1, z * 1.6]), (t) => (0.17 - t * 0.07) * k, darken(P.c1, 0.15)); }
  return { body, head };
}
function robotPlan(B, P) {
  const k = P.size, mat = 'Metal', body = { c: [0, 1.15 * k, 0.1], s: [1.7 * k, 1.4 * k, 1.4 * k] };
  B.add('Body', 'Block', body.s, body.c, [0, 0, 0], P.c1, mat, 0, { tint: true });
  B.add('Chest', 'Block', [0.8 * k, 0.45 * k, 0.06], [0, 1.25 * k, -0.62 * k], [0, 0, 0], P.glow, 'Neon');
  for (let i = 0; i < 3; i++) B.add('Vent' + (i + 1), 'Block', [0.9 * k, 0.06, 0.05], [0, (0.85 - i * 0.12) * k, -0.63 * k], [0, 0, 0], darken(P.c1, 0.4), mat);
  const head = { c: [0, 2.35 * k, 0], s: [1.6 * k, 1.15 * k, 1.3 * k] };
  B.add('Head', 'Block', head.s, head.c, [0, 0, 0], P.c1, mat, 0, { tint: true });
  B.add('Visor', 'Block', [1.35 * k, 0.5 * k, 0.06], [0, 2.38 * k, -0.62 * k], [0, 0, 0], '#0b1020', 'Glass');
  for (const side of [-1, 1]) { const L = side < 0 ? 'L' : 'R';
    B.add('Eye' + L, 'Ellipsoid', [0.34 * k, 0.24 * k, 0.05], [side * 0.3 * k, 2.4 * k, -0.67 * k], [0, 0, 0], P.glow, 'Neon');
    B.add('Ear' + L, 'Cylinder', [0.18, 0.5 * k, 0.5 * k], [side * 0.88 * k, 2.35 * k, 0], [0, 0, 0], darken(P.c1, 0.3), mat);
    B.add('EarGlow' + L, 'Cylinder', [0.05, 0.3 * k, 0.3 * k], [side * 0.99 * k, 2.35 * k, 0], [0, 0, 0], P.glow, 'Neon');
    B.add('Arm' + L, 'Block', [0.36 * k, 0.95 * k, 0.4 * k], [side * 1.05 * k, 1.1 * k, 0], [0, 0, side * 10], darken(P.c1, 0.15), mat);
    B.add('Hand' + L, 'Ball', [0.42 * k, 0.42 * k, 0.42 * k], [side * 1.12 * k, 0.55 * k, 0], [0, 0, 0], darken(P.c1, 0.35), mat);
    B.add('Leg' + L, 'Block', [0.5 * k, 0.55 * k, 0.6 * k], [side * 0.45 * k, 0.28 * k, 0.05], [0, 0, 0], darken(P.c1, 0.2), mat);
    B.add('Jet' + L, 'Cylinder', [0.5 * k, 0.32 * k, 0.32 * k], [side * 0.5 * k, 1.3 * k, 0.85 * k], [0, 90, 0], darken(P.c1, 0.4), mat);
    B.add('JetFire' + L, 'Ball', [0.3 * k, 0.3 * k, 0.3 * k], [side * 0.5 * k, 1.3 * k, 1.15 * k], [0, 0, 0], P.glow, 'Neon'); }
  B.add('Antenna', 'Cylinder', [0.6 * k, 0.07, 0.07], [0, 3.2 * k, 0], [0, 0, 90], '#c9cfe0', mat); B.add('Tip', 'Ball', [0.28, 0.28, 0.28], [0, 3.55 * k, 0], [0, 0, 0], P.glow, 'Neon');
  return { body, head };
}
function golemPlan(B, P) {
  const k = P.size, rock = P.element ? mix(P.c1, '#8a8f9c', 0.55) : '#7b7f8c', body = { c: [0, 1.45 * k, 0.1], s: [2.0 * k, 1.7 * k, 1.5 * k] }, r = B.r;
  B.add('Body', 'Block', body.s, body.c, [4, 8, -3], rock, 'Slate', 0, { tint: true });
  B.add('Core', 'Ball', [0.6 * k, 0.6 * k, 0.6 * k], [0, 1.5 * k, -0.68 * k], [0, 0, 0], P.glow, 'Neon');
  for (let i = 0; i < 6; i++) B.add('Rune' + (i + 1), 'Block', [0.08, 0.28 + r() * 0.3, 0.05], onSurface(body.c, body.s, [Math.cos(i) * 0.9, Math.sin(i * 2) * 0.6, -1], 0.01), [0, 0, r() * 60 - 30], P.glow, 'Neon');
  const head = { c: [0, 2.75 * k, -0.1], s: [1.25 * k, 1.0 * k, 1.1 * k] };
  B.add('Head', 'Block', head.s, head.c, [-4, -6, 2], rock, 'Slate', 0, { tint: true });
  for (const side of [-1, 1]) { const L = side < 0 ? 'L' : 'R';
    B.add('Eye' + L, 'Block', [0.3 * k, 0.16 * k, 0.05], [side * 0.28 * k, 2.82 * k, -0.67 * k], [0, 0, side * -8], P.glow, 'Neon');
    B.add('Arm' + L, 'Block', [0.7 * k, 1.5 * k, 0.75 * k], [side * 1.4 * k, 1.25 * k, 0], [6, 0, side * 8], darken(rock, 0.1), 'Basalt');
    B.add('Fist' + L, 'Block', [0.85 * k, 0.75 * k, 0.85 * k], [side * 1.48 * k, 0.4 * k, -0.05], [0, side * 12, 0], darken(rock, 0.18), 'Basalt');
    B.add('Leg' + L, 'Block', [0.65 * k, 0.7 * k, 0.75 * k], [side * 0.55 * k, 0.35 * k, 0.1], [0, 0, 0], darken(rock, 0.12), 'Slate');
    for (let i = 0; i < 2; i++) B.add('Crystal' + (i + 1) + L, 'Wedge', [0.18, (0.6 + i * 0.25) * k, 0.35 * k], [side * (0.55 + i * 0.3) * k, 2.45 * k + i * 0.2, 0.55 * k], [0, 90, side * (20 + i * 15)], P.glow, 'Glass'); }
  return { body, head };
}
function shroomPlan(B, P) {
  const k = P.size, stem = { c: [0, 1.05 * k, 0], s: [1.45 * k, 1.8 * k, 1.4 * k] };
  B.add('Body', 'Ellipsoid', stem.s, stem.c, [0, 0, 0], P.c2, P.mat, 0, {});
  const cap = { c: [0, 2.35 * k, 0.05], s: [3.0 * k, 1.6 * k, 2.9 * k] };
  B.add('Head', 'Ellipsoid', cap.s, cap.c, [0, 0, 0], P.c1, P.mat, 0, { tint: true });
  B.add('Gills', 'Ellipsoid', [2.7 * k, 0.4 * k, 2.6 * k], [0, 1.85 * k, 0.05], [0, 0, 0], darken(P.c2, 0.08), P.mat);
  for (let i = 0; i < 7; i++) { const d = [Math.cos(i * 0.9) * 0.8, 0.75, Math.sin(i * 0.9) * 0.8 + 0.1], p = onSurface(cap.c, cap.s, d, -0.05);
    B.add('Spot' + (i + 1), 'Ellipsoid', [0.42 - (i % 3) * 0.08, 0.42 - (i % 3) * 0.08, 0.1], p, alongZ(d.map((v, j) => (p[j] - cap.c[j]) * 1)), '#ffffff'); }
  face(B, { c: [0, 1.05 * k, -0.02], s: stem.s }, P, { gap: 0.36, eyeY: 0.0, eye: 1.05 });
  for (const side of [-1, 1]) B.add('Foot' + (side < 0 ? 'L' : 'R'), 'Ellipsoid', [0.5 * k, 0.28 * k, 0.62 * k], [side * 0.42 * k, 0.14 * k, -0.15 * k], [0, 0, 0], darken(P.c2, 0.08));
  return { body: stem, head: cap };
}
function starPlan(B, P) {
  const k = P.size, body = { c: [0, 1.8 * k, 0], s: [1.6 * k, 1.6 * k, 1.0 * k] };
  B.add('Body', 'Ellipsoid', body.s, body.c, [0, 0, 0], P.c1, P.mat, 0, { tint: true });
  for (let i = 0; i < 5; i++) { const a = (i / 5) * 360 + 90, rd = a / D; B.add('Point' + (i + 1), 'Ellipsoid', [0.62 * k, 1.25 * k, 0.75 * k], [Math.cos(rd) * 0.95 * k, 1.8 * k + Math.sin(rd) * 0.95 * k, 0.05], [0, 0, a - 90], P.c1, P.mat, 0, { tint: true }); }
  B.add('Head', 'Ellipsoid', [1.3 * k, 1.3 * k, 1.1 * k], [0, 1.8 * k, -0.05], [0, 0, 0], lighten(P.c1, 0.15), P.mat);
  face(B, { c: [0, 1.8 * k, -0.05], s: [1.3 * k, 1.3 * k, 1.1 * k] }, P, { gap: 0.36, eyeY: 0.08, eye: 1.0 });
  return { body, head: body };
}
function eyeballPlan(B, P) {
  const k = P.size, body = { c: [0, 1.9 * k, 0], s: [2.1 * k, 2.1 * k, 2.1 * k] };
  B.add('Body', 'Ball', body.s, body.c, [0, 0, 0], '#fbf7ff', 'SmoothPlastic', 0, { tint: true }); B.add('Head', 'Ball', [0.1, 0.1, 0.1], body.c, [0, 0, 0], '#fbf7ff');
  const f = onSurface(body.c, body.s, [0, 0.05, -1], -0.25);
  B.add('IrisL', 'Ellipsoid', [1.15 * k, 1.15 * k, 0.4], f, [0, 0, 0], P.glow, 'Neon'); B.add('PupilL', 'Ellipsoid', [0.5 * k, 0.75 * k, 0.3], [f[0], f[1], f[2] - 0.12], [0, 0, 0], '#0b0912');
  B.add('ShineL', 'Ball', [0.28, 0.28, 0.28], [f[0] + 0.3, f[1] + 0.32, f[2] - 0.2], [0, 0, 0], '#ffffff', 'Neon');
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; B.add('Vein' + (i + 1), 'Cylinder', [0.9 * k, 0.05, 0.05], onSurface(body.c, body.s, [Math.cos(a), Math.sin(a), -0.35], -0.02), [0, 30, (a * D)], '#ff6b7a'); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2;
    B.chain('Stalk' + (i + 1) + '_', 3, bez([Math.cos(a) * 0.7, 1.0 * k, Math.sin(a) * 0.7 + 0.3], [Math.cos(a) * 1.2, 0.5 * k, Math.sin(a) * 1.2 + 0.3], [Math.cos(a) * 1.6, 0.2, Math.sin(a) * 1.6 + 0.3], [Math.cos(a) * 1.8, 0.1, Math.sin(a) * 1.8 + 0.3]), () => 0.16 * k, darken(P.c2, 0.1)); }
  return { body, head: body };
}
const PLANS = { quad, bird: birdPlan, snake: snakePlan, fish: fishPlan, octo: octoPlan, jelly: jellyPlan, ghost: ghostPlan, slime: slimePlan, bee: beePlan, butterfly: butterflyPlan, spider: spiderPlan, robot: robotPlan, golem: golemPlan, shroom: shroomPlan, star: starPlan, eyeball: eyeballPlan };

/* ---------- element + style details ---------- */
function decorate(B, P, anat) {
  const { head, body } = anat, k = P.size, e = P.element, top = onSurface(head.c, head.s, [0, 1, 0], -0.02);
  const flame = (name, at, s, n = 3) => { for (let i = 0; i < n; i++) B.add(name + (i + 1), 'Ellipsoid', [s * (0.55 - i * 0.12), s * (1.1 - i * 0.18), s * (0.55 - i * 0.12)], [at[0] + (i - 1) * s * 0.22, at[1] + s * 0.35 + i * s * 0.12, at[2] + (i - 1) * 0.04], [0, 0, (i - 1) * -18], hsl(10 + i * 18, 1, 0.55 + i * 0.08), 'Neon', 0.1); };
  if (e === 'feu' || e === 'lave') { flame('Flame', top, 0.7 * k); if (e === 'lave') for (let i = 0; i < 5; i++) B.add('Crack' + (i + 1), 'Block', [0.06, 0.5 + i * 0.07, 0.04], onSurface(body.c, body.s, [Math.cos(i * 1.4), Math.sin(i * 2) * 0.5, -0.6], 0), [0, 0, i * 37], '#ff5a1f', 'Neon'); }
  if (e === 'glace' || e === 'cristal') for (let i = 0; i < 5; i++) { const d = [(i - 2) * 0.32, 1, 0.4 + Math.abs(i - 2) * 0.12], p = onSurface(body.c, body.s, d, -0.15);
    B.add('Crystal' + (i + 1), 'Wedge', [0.18, (0.7 - Math.abs(i - 2) * 0.12) * k, 0.4 * k], [p[0], p[1] + 0.25, p[2]], [0, 90, (i - 2) * -14], i % 2 ? lighten(P.glow, 0.4) : P.glow, 'Glass', 0.1); }
  if (e === 'foudre') for (const side of [-1, 1]) for (let i = 0; i < 3; i++) B.add('Bolt' + (i + 1) + (side < 0 ? 'L' : 'R'), 'Block', [0.08, 0.42 * k, 0.1], onSurface(body.c, body.s, [side, 0.25 - i * 0.22, -0.1 + i * 0.25], 0.01), [0, side * 90, i % 2 ? 35 : -35], '#fff36b', 'Neon');
  if (e === 'nature') { for (let i = 0; i < 3; i++) B.add('Leaf' + (i + 1), 'Ellipsoid', [0.12, 0.42 * k, 0.8 * k], [top[0] + (i - 1) * 0.3, top[1] + 0.25, top[2] + 0.1], [-30, (i - 1) * 50, (i - 1) * 25], hsl(100 + i * 15, 0.7, 0.45));
    B.add('Flower', 'Ball', [0.32, 0.32, 0.32], [top[0] + 0.45, top[1] + 0.05, top[2] - 0.2], [0, 0, 0], '#ff7ac8'); for (let i = 0; i < 5; i++) { const a = i * 1.256; B.add('Petal' + (i + 1), 'Ellipsoid', [0.25, 0.25, 0.08], [top[0] + 0.45 + Math.cos(a) * 0.22, top[1] + 0.05 + Math.sin(a) * 0.22, top[2] - 0.22], [0, 0, 0], '#ffffff'); } }
  if (e === 'eau') for (let i = 0; i < 3; i++) B.add('Drop' + (i + 1), 'Ball', [0.25 + i * 0.07, 0.25 + i * 0.07, 0.25 + i * 0.07], [0.8 * k - i * 0.5, top[1] + 0.3 + i * 0.25, top[2] + 0.4], [0, 0, 0], '#bfeaff', 'Glass', 0.3);
  if (e === 'cosmos') { for (let i = 0; i < 7; i++) { const d = [Math.cos(i * 2.3), Math.sin(i * 1.7) * 0.8, Math.sin(i * 2.3) * 0.6 + 0.3], p = onSurface(body.c, body.s, d, 0.0); B.add('Star' + (i + 1), 'Ball', [0.12 + (i % 3) * 0.05, 0.12 + (i % 3) * 0.05, 0.12 + (i % 3) * 0.05], p, [0, 0, 0], i % 2 ? '#ffffff' : '#ffe9a8', 'Neon'); }
    B.add('Planet', 'Ball', [0.5, 0.5, 0.5], [1.4 * k, top[1] + 0.4, top[2]], [0, 0, 0], '#ff9ad8', 'SmoothPlastic'); B.add('PlanetRing', 'Cylinder', [0.04, 0.95, 0.95], [1.4 * k, top[1] + 0.4, top[2]], [0, 0, 70], '#ffe9a8', 'Neon', 0.2); }
  if (e === 'poison') for (let i = 0; i < 6; i++) B.add('Spot' + (i + 1) + 'P', 'Ellipsoid', [0.32, 0.32, 0.08], onSurface(body.c, body.s, [Math.cos(i * 1.9), Math.sin(i * 1.3) * 0.6, Math.sin(i * 1.9)], -0.02), alongZ([Math.cos(i * 1.9), Math.sin(i * 1.3) * 0.6, Math.sin(i * 1.9)]), '#9bff3d', 'Neon');
  if (e === 'neon') for (const side of [-1, 1]) B.add('Seam' + (side < 0 ? 'L' : 'R'), 'Block', [0.06, 0.06, body.s[2] * 0.8], onSurface(body.c, body.s, [side, 0, 0], -0.01), [0, 0, 0], side < 0 ? '#ff2fb4' : '#3ee6ff', 'Neon');
  if ((e === 'ombre' || e === 'sang') && P.sp.plan === 'quad') for (let i = 0; i < 4; i++) { const p = onSurface(body.c, body.s, [0, 1, -0.4 + i * 0.3], -0.08); B.add('Wisp' + (i + 1) + 'S', 'Ellipsoid', [0.3, 0.7 - i * 0.08, 0.3], [p[0], p[1] + 0.25, p[2]], [-20, 0, 0], e === 'sang' ? '#ff2d3d' : '#b04dff', 'Neon', 0.25); }
  if (e === 'arcenciel') for (let i = 0; i < 6; i++) B.add('Band' + (i + 1) + 'R', 'Ellipsoid', [0.08, 0.35, 0.35], onSurface(body.c, body.s, [-1, 0.5 - i * 0.18, 0.2], 0), [0, 90, 0], hsl(i * 60, 0.9, 0.62), 'Neon');
  // small accessories that give each variant its own personality
  if (P.accessory && (P.sp.plan === 'quad' || P.sp.plan === 'bird')) { const nk = [0, head.c[1] - head.s[1] * 0.48, head.c[2] + 0.12], acc = P.accessory, col = shiftHue(P.glow, 180);
    if (acc === 'scarf' || acc === 'collar') { B.add('Collar', 'Cylinder', [0.22 * k, 1.05 * k, 1.05 * k], nk, [0, 0, 90], acc === 'scarf' ? col : '#e63946', acc === 'scarf' ? 'Fabric' : 'SmoothPlastic');
      if (acc === 'scarf') B.add('ScarfTail', 'Ellipsoid', [0.2 * k, 0.6 * k, 0.32 * k], [0.3 * k, nk[1] - 0.25 * k, nk[2] - 0.35 * k], [10, 0, -15], col, 'Fabric');
      else B.add('Tag', 'Ball', [0.22 * k, 0.22 * k, 0.22 * k], [0, nk[1] - 0.18 * k, nk[2] - 0.5 * k], [0, 0, 0], '#ffcf3d', 'Foil'); }
    if (acc === 'bell') { B.add('Collar', 'Cylinder', [0.16 * k, 1.0 * k, 1.0 * k], nk, [0, 0, 90], '#e63946'); B.add('Bell', 'Ball', [0.3 * k, 0.3 * k, 0.3 * k], [0, nk[1] - 0.2 * k, nk[2] - 0.5 * k], [0, 0, 0], '#ffcf3d', 'Foil'); }
    if (acc === 'bow') { const t = onSurface(head.c, head.s, [0.55, 0.75, -0.1], -0.02); for (const sd of [-1, 1]) B.add('Bow' + (sd < 0 ? 'L' : 'R'), 'Ellipsoid', [0.42 * k, 0.3 * k, 0.16 * k], [t[0] + sd * 0.2 * k, t[1], t[2]], [0, 0, sd * 25], col);
      B.add('BowKnot', 'Ball', [0.18 * k, 0.18 * k, 0.18 * k], t, [0, 0, 0], darken(col, 0.15)); } }
  // style accessories
  const st = P.styles;
  if (st.includes('roi') || (P.rarityTier >= 5 && !st.includes('ange') && !st.includes('cyber'))) { const y = top[1] + 0.12, z = top[2];
    B.add('CrownBase', 'Cylinder', [0.28, 0.9 * k, 0.9 * k], [0, y, z], [0, 0, 90], '#ffcf3d', 'Foil');
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; B.add('CrownTip' + (i + 1), 'Wedge', [0.08, 0.38, 0.24], [Math.cos(a) * 0.4 * k, y + 0.3, z + Math.sin(a) * 0.4 * k], [0, -a * D + 90, 0], '#ffcf3d', 'Foil');
      B.add('Gem' + (i + 1), 'Ball', [0.13, 0.13, 0.13], [Math.cos(a) * 0.46 * k, y + 0.02, z + Math.sin(a) * 0.46 * k], [0, 0, 0], hsl(i * 60, 0.9, 0.6), 'Neon'); } }
  if (st.includes('ange') || e === 'lumiere' || P.rarity === 'Divin') { const y = top[1] + 0.75; for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; B.add('Halo' + (i + 1), 'Ball', [0.16, 0.16, 0.16], [Math.cos(a) * 0.55 * k, y, top[2] + Math.sin(a) * 0.55 * k], [0, 0, 0], '#fff1a8', 'Neon'); }
    if (!P.sp.wings && P.sp.plan === 'quad') wings(B, P, 'angel', [0, 1.6 * k, 0.2 * k], k); }
  if (P.q && P.q.wings && !P.sp.wings && !st.includes('ange') && !st.includes('demon')) wings(B, P, P.sp.plan === 'quad' ? 'angel' : 'feather', [0, 1.6 * k, 0.2 * k], k); // « avec des ailes »
  if (st.includes('demon')) { if (P.sp.horns !== 'curved' && P.sp.plan !== 'robot') horns(B, head, { ...P, horn: '#2a1a1f' }, k * 0.7);
    if (!P.sp.wings && P.sp.plan === 'quad') wings(B, { ...P, c1: '#3a1420', c2: '#7a1f2f' }, 'membrane', [0, 1.6 * k, 0.2 * k], k * 0.8); }
  if (st.includes('cyber') && P.sp.plan !== 'robot') { const p = onSurface(head.c, head.s, [0, 0.12, -1], 0.02); B.add('Visor', 'Block', [head.s[0] * 0.85, 0.24 * k, 0.08], p, [0, 0, 0], P.glow, 'Neon', 0.15);
    B.add('Antenna', 'Cylinder', [0.6, 0.06, 0.06], [head.s[0] * 0.4, top[1] + 0.25, top[2]], [0, 0, 70], '#c9cfe0', 'Metal'); }
  if (st.includes('ninja')) { const p = onSurface(head.c, head.s, [0, 0.45, -1], 0.02); B.add('Headband', 'Cylinder', [0.22, head.s[1] * 0.98, head.s[0] * 1.02], [0, p[1], head.c[2]], [0, 0, 90], '#d62839');
    for (const s of [-1, 1]) B.add('Ribbon' + (s < 0 ? 'L' : 'R'), 'Ellipsoid', [0.12, 0.18, 0.7], [s * 0.18, p[1] - 0.05, head.c[2] + head.s[2] * 0.55], [20, s * 25, 0], '#d62839'); }
  if (st.includes('pirate')) { B.add('Hat', 'Ellipsoid', [1.5 * k, 0.45 * k, 1.0 * k], [0, top[1] + 0.2, top[2]], [0, 0, 0], '#26222e'); B.add('Skull', 'Ball', [0.22, 0.22, 0.22], [0, top[1] + 0.25, top[2] - 0.48 * k], [0, 0, 0], '#ffffff');
    const ep = onSurface(head.c, head.s, [0.42, 0.1, -1], 0.03); B.add('Eyepatch', 'Ellipsoid', [0.42 * k, 0.42 * k, 0.08], ep, [0, 0, 0], '#1b1b22'); }
  if (st.includes('sorcier')) { for (let i = 0; i < 5; i++) B.add('Hat' + (i + 1), 'Cylinder', [0.4, (1.4 - i * 0.28) * k, (1.4 - i * 0.28) * k], [0.03 * i, top[1] + 0.12 + i * 0.32, top[2] + 0.03 * i], [0, 0, 90 + i * 4], i === 0 ? '#2b1f5c' : mix('#3a2a8f', '#7c5cff', i / 5), 'Fabric');
    B.add('HatStar', 'Ball', [0.24, 0.24, 0.24], [0.15, top[1] + 1.55, top[2] + 0.15], [0, 0, 0], '#ffe14d', 'Neon'); }
  if (st.includes('zombie')) for (let i = 0; i < 3; i++) B.add('Stitch' + (i + 1), 'Block', [0.36, 0.05, 0.04], onSurface(head.c, head.s, [0.3 + i * 0.08, 0.45 - i * 0.12, -1], 0.01), [0, 0, 70], '#2a2230');
}

/* ---------- effects by rarity / element ---------- */
function effects(P) {
  const g = P.glow, t = P.rarityTier, fx = { float: { on: true } };
  if (t >= 2) Object.assign(fx, { sparkles: { on: true, c1: lighten(g, 0.5) }, glow: { on: true, c1: g, brightness: 1.5 + t * 0.4 } });
  if (t >= 3) fx.aura = { on: true, c1: g, c2: P.c1, rate: 20 + t * 6 };
  if (t >= 4) fx.rings = { on: true, c1: g, count: 8 + t, tilt: t >= 5 };
  if (t >= 5) Object.assign(fx, { outline: { on: true, c1: g }, trail: { on: true, c1: '#ffffff', c2: g } });
  if (t >= 6) Object.assign(fx, { orbs: { on: true, c1: g, count: 3 + (t - 6) * 2 }, pulse: { on: true }, spin: { on: true, speed: 50 } });
  if (t >= 7) Object.assign(fx, { rainbow: { on: true, speed: 0.3 }, lightning: { on: true, c1: g } });
  if (P.element === 'feu' || P.element === 'lave' || P.element === 'sang') fx.flames = { on: true, c1: '#ffb347', c2: P.element === 'sang' ? '#8a0f1f' : '#ff3d1f' };
  if (P.element === 'foudre') fx.lightning = { on: true, c1: '#fff36b', rate: 3 };
  if (P.element === 'arcenciel') fx.rainbow = { on: true, speed: 0.25 };
  return fx;
}

/* ---------- main entry ---------- */
export const RARITIES = ['Commun', 'Rare', 'Épique', 'Légendaire', 'Mythique', 'Divin', 'Secret 1/1B'];
export function generate(text, seed) {
  const q = parse(text || ''), s = seed ?? hash(text || 'pet'), r = rng(s);
  const keys = Object.keys(SPECIES), species = q.species || keys[Math.floor(r() * keys.length)], sp = SPECIES[species];
  const element = q.element || sp.element || null, el = element ? ELEMENTS[element] : null;
  const rarity = q.rarity || RARITIES[Math.min(6, Math.floor(r() * r() * 7))], rarityTier = RARITIES.indexOf(rarity) + 1;
  let c1 = sp.base[0], c2 = sp.base[1];
  const keepsLook = ['panda', 'pingouin', 'abeille', 'champignon', 'oeil', 'axolotl', 'poussin'].includes(species);
  if (el) { if (keepsLook) { c2 = mix(sp.base[1], el.c[1], 0.3); } else { c1 = element === 'neon' ? mix(sp.base[0], '#2a2a3f', 0.55) : el.c[0]; c2 = mix(el.c[1], sp.base[1], 0.35); } }
  // variants: a real shift of palette, not just noise
  const vk = r(); if (!q.colors.length && !keepsLook) { if (vk < 0.25) c1 = shiftHue(c1, 22); else if (vk < 0.5) c1 = shiftHue(c1, -22); else if (vk < 0.62) c1 = lighten(c1, 0.25); else if (vk < 0.72) c1 = darken(c1, 0.18); }
  if (q.lex && q.lex.palette && !q.colors.length && !el) { c1 = q.lex.palette.side; c2 = q.lex.palette.belly; }
  if (q.colors[0]) c1 = q.colors[0]; if (q.colors[1]) c2 = q.colors[1]; else if (q.colors[0]) c2 = lighten(q.colors[0], 0.7);
    const glow = el ? el.glow : hsl(Math.floor(r() * 360), 0.9, 0.62);
  const P = { q, sp, species, element, rarity, rarityTier, styles: q.styles, c1, c2, c3: el ? el.c[1] : darken(c1, 0.25), glow, dark: sp.dark, iris: mix(glow, c1, 0.3),
    horn: element === 'or' ? '#ffcf3d' : element === 'glace' ? '#dff6ff' : '#f2e6d0', mat: element === 'or' ? 'Foil' : element === 'cristal' ? 'Glass' : 'SmoothPlastic', mat2: 'SmoothPlastic',
    size: (q.styles.includes('geant') ? 1.25 : q.styles.includes('mignon') ? 0.92 : 1) * (0.96 + r() * 0.08), style: sp.plan === 'robot' ? 'robot' : q.styles.includes('mignon') ? 'mignon' : null,
    fierce: q.styles.includes('demon') || element === 'ombre' || species === 'dragon' };
  if (sp.plan === 'quad') { const alt = r(); P.sp = { ...sp };
    if (alt < 0.3 && ['pointy', 'round'].includes(sp.ears)) P.sp.ears = sp.ears === 'pointy' ? 'pointyBig' : 'pointy';
    if (r() < 0.3 && ['curl', 'wag', 'long', 'fluffy'].includes(sp.tail)) P.sp.tail = ['curl', 'fluffy', 'long', 'wag'][Math.floor(r() * 4)];
    if (!sp.pattern && r() < 0.28) P.sp.pattern = r() < 0.5 ? 'spots' : 'socks'; }
  P.eyeScale = 0.92 + r() * 0.26; P.accessory = r() < 0.45 ? ['scarf', 'bow', 'collar', 'bell'][Math.floor(r() * 4)] : null;
  const B = Builder(r), anat = PLANS[sp.plan](B, P); decorate(B, P, anat);
  const base = q.lex ? q.lex.word.replace(/(aux)$/, 'al').replace(/s$/, '').replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase()) : sp.fr;
  const name = q.name || (el ? `${base} ${el.fr}` : `${base} ${['Étoilé', 'Joyeux', 'Royal', 'Mystique', 'Sauvage', 'Doux', 'Rapide', 'Brillant'][Math.floor(r() * 8)]}`);
  const BODY = { quad: species === 'dragon' ? 'dragon' : species === 'chien' || species === 'loup' || species === 'renard' ? 'dog' : species === 'lapin' ? 'bunny' : 'cat', slime: 'slime', ghost: 'spirit', robot: 'robot' };
  return { name, species, element, rarity, rarityTier, emoji: sp.e, c1, c2, glow, parts: B.parts, fx: effects(P), body: BODY[sp.plan] || 'cat', seed: s, prompt: text || '', lex: q.lex || null, wings: !!q.wings, colored: q.colors.length > 0 };
}

/* ---------- the 100-pet index ---------- */
export function index100() {
  const sp = Object.keys(SPECIES), els = [null, ...Object.keys(ELEMENTS)], out = [], seen = new Set(), r = rng(20261114);
  const tierFor = (i) => (i < 30 ? 'Commun' : i < 52 ? 'Rare' : i < 70 ? 'Épique' : i < 84 ? 'Légendaire' : i < 93 ? 'Mythique' : i < 98 ? 'Divin' : 'Secret 1/1B');
  const styleFor = (i) => ['', '', 'mignon', '', 'roi', 'ninja', 'cyber', 'sorcier', 'demon', 'ange', 'pirate', ''][i % 12];
  for (let i = 0; out.length < 100 && i < 2000; i++) {
    const s = sp[(i * 7 + Math.floor(r() * 3)) % sp.length], e = out.length < 12 ? null : els[(i * 5 + 1) % els.length], key = s + (e || '');
    if (seen.has(key)) continue; seen.add(key);
    const text = `${SPECIES[s].words.split(' ')[0]} ${e ? ELEMENTS[e].words.split(' ')[0] : ''} ${styleFor(out.length)} ${norm(tierFor(out.length)).split(' ')[0]}`;
    out.push({ n: out.length + 1, text, seed: hash(text) + out.length, rarity: tierFor(out.length) });
  }
  return out;
}
