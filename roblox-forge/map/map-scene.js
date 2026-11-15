/* =====================================================================
   Roblox Forge - "décris ta scène" : turns a free sentence into things on the map.
   « une ferme avec 3 vaches et 3 cochons bleus avec des ailes »
     → farm (barn, silo, fields, hay, pen) + 3 voxel cows + 3 blue winged pigs in the pen.
   Understands, for every thing named: a count (3, trois, quelques, beaucoup…),
   a colour (bleu, rouge, doré…), « avec des ailes », géant / petit.
   Things: 17 animals (voxel engine of Pet Studio), every map resource, buildings,
   trees, farm buildings and crops. Real Roblox parts, nothing simulated.
   ===================================================================== */
import { P, block, cyl, ball, model } from './map-core.js';
import { PROPS } from './map-props.js';
import * as MM from './map-models.js';
import { voxelAnimal, VOX_SPECIES } from '../studio/voxel.js';
import { LEX, LEX_SIZE, PHRASES } from './map-lexicon.js';
import * as ARCH from './map-archetypes.js';

const M = (c, m) => ({ c, m });
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const noCol = { canCollide: false };
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); return '#' + [16, 8, 0].map((k) => { const v = (n >> k) & 255; return Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f))); }).map((v) => v.toString(16).padStart(2, '0')).join(''); };

/* ---------- vocabulary ---------- */
const NUM = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20, quelques: 3, plusieurs: 4, beaucoup: 8, plein: 8, pleins: 8, tas: 6, foule: 10, troupeau: 6 };
const BASE_COLORS = { azur: '#3fa0ff', marine: '#1d3f88', ciel: '#8ec9ff', bordeaux: '#7a1f2f', kaki: '#8a8a4a', lavande: '#b9a3ff', menthe: '#7fe0b0', corail: '#ff7a6b', saumon: '#ff9a8a', beige: '#e6d2b0',
  creme: '#fff3d6', ivoire: '#fffbe8', olive: '#7a8a3a', emeraude: '#2ecc71', rubis: '#c0102a', saphir: '#1f4fd6', indigo: '#4b3bd6', lilas: '#c8a2e8', fuchsia: '#ff3bd0', magenta: '#ff2fb0', ocre: '#d9a03a',
  chocolat: '#5a3620', caramel: '#c47a2c', citron: '#fff04d', pistache: '#a8e070', prune: '#6b2a5a', framboise: '#e0306a', argente: '#c9d1dd', bronze: '#b0703a', cuivre: '#c46a3a', fluo: '#9dff3a',
  pastel: '#ffd1e8', sombre: '#2b2b33', clair: '#f0f0f0', arc: null, black: '#2b2b33', white: '#f6f6f6', yellow: '#ffd84d', purple: '#9a5cff', grey: '#9aa1ad', gray: '#9aa1ad', brown: '#8a5a33', silver: '#c9d1dd', cyan: '#3ee6ff' };
export const COLORS = { rouge: '#e8413a', rouges: '#e8413a', bleu: '#3f86ff', bleue: '#3f86ff', bleus: '#3f86ff', bleues: '#3f86ff', vert: '#4cc46a', verte: '#4cc46a', verts: '#4cc46a', vertes: '#4cc46a',
  jaune: '#ffd84d', jaunes: '#ffd84d', rose: '#ff8ac0', roses: '#ff8ac0', violet: '#9a5cff', violette: '#9a5cff', violets: '#9a5cff', violettes: '#9a5cff', orange: '#ff9a3c', oranges: '#ff9a3c',
  noir: '#2b2b33', noire: '#2b2b33', noirs: '#2b2b33', noires: '#2b2b33', blanc: '#f6f6f6', blanche: '#f6f6f6', blancs: '#f6f6f6', blanches: '#f6f6f6', gris: '#9aa1ad', grise: '#9aa1ad', grises: '#9aa1ad',
  marron: '#8a5a33', dore: '#ffc93c', doree: '#ffc93c', dores: '#ffc93c', dorees: '#ffc93c', or: '#ffc93c', argent: '#c9d1dd', cyan: '#3ee6ff', turquoise: '#2fd6c8', red: '#e8413a', blue: '#3f86ff', green: '#4cc46a', pink: '#ff8ac0', gold: '#ffc93c' };
// noun -> thing. Animals use the voxel engine; the rest are model builders.
for (const [k, v] of Object.entries(BASE_COLORS)) if (v) for (const f of [k, k + 'e', k + 's', k + 'es']) if (!(f in COLORS)) COLORS[f] = v;
const ANIMALS = { vache: 'vache', vaches: 'vache', veau: 'vache', cow: 'vache', cows: 'vache', cochon: 'cochon', cochons: 'cochon', porc: 'cochon', porcs: 'cochon', pig: 'cochon', pigs: 'cochon',
  mouton: 'mouton', moutons: 'mouton', brebis: 'mouton', sheep: 'mouton', loup: 'loup', loups: 'loup', tigre: 'tigre', tigres: 'tigre', renard: 'renard', renards: 'renard', chat: 'chat', chats: 'chat',
  chien: 'chien', chiens: 'chien', ours: 'ours', lion: 'lion', lions: 'lion', panda: 'panda', pandas: 'panda', cerf: 'cerf', cerfs: 'cerf', biche: 'cerf', licorne: 'licorne', licornes: 'licorne',
  dragon: 'dragon', dragons: 'dragon' };
const THINGS = {
  // farm
  grange: 'barn', granges: 'barn', etable: 'barn', barn: 'barn', silo: 'silo', silos: 'silo', foin: 'hay', meule: 'hay', meules: 'hay', botte: 'hay', bottes: 'hay', champ: 'field', champs: 'field', ble: 'field',
  carotte: 'carrots', carottes: 'carrots', citrouille: 'pumpkins', citrouilles: 'pumpkins', mais: 'field', enclos: 'pen', abreuvoir: 'trough', tracteur: 'tractor', tracteurs: 'tractor', epouvantail: 'scarecrow',
  // buildings & nature (map models)
  maison: 'house', maisons: 'house', chateau: 'castle', temple: 'temple', moulin: 'windmill', statue: 'statue', cascade: 'waterfall', volcan: 'volcano', nuage: 'cloud', nuages: 'cloud',
  arbre: 'oak', arbres: 'oak', chene: 'oak', chenes: 'oak', sapin: 'pine', sapins: 'pine', cerisier: 'cherry', cerisiers: 'cherry', cactus: 'cactus', fleur: 'flowers', fleurs: 'flowers', foret: 'forest', bois: 'forest',
  // resources (map-props)
  banc: 'bench', bancs: 'bench', tonneau: 'barrel', tonneaux: 'barrel', baril: 'barrel', caisse: 'crates', caisses: 'crates', puits: 'well', marche: 'stall', etal: 'stall', tente: 'tent', tentes: 'tent',
  lanterne: 'lantern', lanternes: 'lantern', feu: 'campfire', panneau: 'signpost', fontaine: 'fountain', buisson: 'bush', buissons: 'bush', champignon: 'mushroom', champignons: 'mushroom', souche: 'stump',
  mare: 'pond', etang: 'pond', tournesol: 'sunflowers', tournesols: 'sunflowers', rocher: 'rockCluster', rochers: 'rockCluster', plateforme: 'grassPlatform', plateformes: 'grassPlatform', buches: 'logPile',
  echelle: 'ladder', oeuf: 'eggPedestal', oeufs: 'eggPedestal', porte: 'worldGate', portail: 'worldGate', boutique: 'shopBooth', shop: 'shopBooth', coffre: 'chest', coffres: 'chest', tresor: 'chest',
  gemmes: 'gemPile', diamants: 'gemPile', trophee: 'trophy', classement: 'leaderboardStand', obelisque: 'obelisk', ruines: 'ruins', torche: 'torch', torches: 'torch', lampadaire: 'streetLamp', lampadaires: 'streetLamp',
  arret: 'busStop', plot: 'trafficCone', plots: 'trafficCone', cristal: 'crystalTree' };
const DEFAULT_COUNT = { forest: 1, field: 2, hay: 4, oak: 3, pine: 3, flowers: 3, bush: 3, cloud: 3, house: 1 };

/** Parse every « [nombre] nom [couleur] [avec des ailes] [géant|petit] » in the sentence. */
const SIZE_BIG = /^(geants?|geantes?|enormes?|grands?|grandes?|immenses?|gigantesques?|giant|huge|big|large)$/, SIZE_SMALL = /^(petits?|petites?|bebes?|mini|minuscules?|small|tiny|baby)$/;
const WINGS = /^(ailes?|ailee?s?|wings?|winged|volants?)$/;
const STOP = new Set('ville villes city town village villages cite quartier zone endroit lieu monde world ile iles island plage beach obby tycoon simulator simulateur lobby hub arene arena grotte cave mine ciel sky plaine desert neige hiver enneige enneigee tropical tropicale jungle espace space bonbon candyland neon cyber cyberpunk futur parc jardin campagne theme style genre niveau level un une des de du la le les l d et avec avec sans sur sous dans pour par a au aux en ou mais tres plus moins qui que quoi mon ma mes ton ta tes son sa ses notre votre leur leurs ce cet cette ces il elle ils elles on y je tu nous vous est sont fait faire mettre met ajoute ajouter veux voudrais avoir map carte monde jeu game the a an of and with in on to some many lots lot near next autour pres cote partout ici la-bas plein pleins tas'.split(' '));
const lookup = (w) => LEX.get(w) || (THINGS[w] ? { kind: 'thing', id: THINGS[w] } : ANIMALS[w] ? { kind: 'animal', species: ANIMALS[w] } : null);
const MOD = (v) => COLORS[v] || WINGS.test(v) || SIZE_BIG.test(v) || SIZE_SMALL.test(v);

/** Parse every « [nombre] nom [couleur] [avec des ailes] [géant|petit] » in the sentence. */
export function parseScene(text) {
  let t = ' ' + norm(text).replace(/['’]/g, ' ').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ') + ' ';
  for (const p of PHRASES) t = t.split(' ' + p + ' ').join(' ' + p.replace(/ /g, '_') + ' ');
  const words = t.trim().split(' ').map((w) => w.replace(/-/g, '_')).filter(Boolean), items = [];
  const farm = words.some((w) => /^(ferme|fermes|farm|farms|ranch|campagne|countryside)$/.test(w));
  for (let i = 0; i < words.length; i++) {
    const w = words[i]; let spec = lookup(w);
    // a colour word right after a noun is a colour (« pommes orange », « maison rose »), not a thing
    if (spec && COLORS[w] && i > 0 && (lookup(words[i - 1]) || /^(en|de)$/.test(words[i - 1]))) continue;
    let count = null; for (let j = i - 1; j >= Math.max(0, i - 3); j--) { const v = words[j]; if (/^\d+$/.test(v)) { count = +v; break; } if (NUM[v]) { count = NUM[v]; break; } if (lookup(v) && !MOD(v)) break; }
    if (!spec) { // unknown word: a thing only if it was counted (« 3 xylophones ») and is not a modifier / small word
      if (count == null || STOP.has(w) || MOD(w) || w.length < 3 || /^\d/.test(w) || /^(ferme|farm|ranch|campagne)/.test(w)) continue;
      spec = { kind: 'thing', fam: 'labelled', o: { word: w.replace(/_/g, ' ') } }; }
    let color = null, wings = false, size = spec.size || 1;
    for (let j = i + 1; j < Math.min(words.length, i + 7); j++) { const v = words[j]; if (lookup(v) && !COLORS[v]) break; if (COLORS[v] && !color) color = COLORS[v];
      if (WINGS.test(v)) wings = true; if (SIZE_BIG.test(v)) size *= 1.7; if (SIZE_SMALL.test(v)) size *= 0.6; }
    for (let j = i - 1; j >= Math.max(0, i - 2); j--) { const v = words[j]; if (SIZE_BIG.test(v)) size *= 1.7; if (SIZE_SMALL.test(v)) size *= 0.6; if (COLORS[v] && !color && j === i - 1) color = COLORS[v]; }
    const plural = /[sx]$/.test(w) && !/^(ours|bois|puits|cactus|gris|mais|ble|souris|lynx|bus|taxi|tennis|bras|corps|nez|riz|choux|bijoux)$/.test(w);
    const id = spec.id || spec.species || spec.fam;
    items.push({ ...spec, kind: spec.kind, id, count: Math.min(spec.kind === 'animal' ? 12 : 10, count ?? (plural ? DEFAULT_COUNT[id] || 3 : DEFAULT_COUNT[id] || 1)), color, wings, size, word: w });
  }
  return { farm, items };
}
export const VOCABULARY_SIZE = () => LEX_SIZE + Object.keys(COLORS).length + Object.keys(NUM).length;

/* ---------- farm models (Kenney-style detailing) ---------- */
const RED = ['#c0392b', '#ad3226', '#cf4535'], TRIM = M('#f4efe6', 'WoodPlanks');
function barn(x, z, y = 0) { const kids = [];
  for (let i = 0; i < 12; i++) kids.push(block('Wall', [1.66, 12, 16], [x - 9.15 + i * 1.66, y + 6, z], M(RED[i % 3], 'WoodPlanks')));
  kids.push(block('Trim', [20.4, 0.8, 16.4], [x, y + 12.2, z], TRIM), block('Base', [20.6, 1, 16.6], [x, y + 0.5, z], M('#7d7f86', 'Cobblestone')));
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) kids.push(block('Roof', [11.8, 0.7, 2.9], [x + s * 5.2, y + 15.2, z - 7.2 + i * 2.88], M(i % 2 ? '#4a4f5c' : '#5a606e', 'Slate'), { rot: [0, 0, s * -36] }));
  // stepped gable that stays under the 36° roof: half-width = 10 − height / tan(36°)
  for (const zz of [-8.1, 8.1]) for (let i = 0, y0 = 12.6; i < 5; i++) { const h = 1.25, top = (i + 1) * h, w = Math.max(0.6, 2 * (9.3 - top * 1.376)); kids.push(block('Gable', [w, h, 0.6], [x, y + y0 + i * h + h / 2, z + zz], M(RED[0], 'WoodPlanks'))); }
  kids.push(
    block('Ridge', [0.8, 0.8, 16.8], [x, y + 18.5, z], TRIM, noCol), block('Door', [8, 9, 0.4], [x, y + 4.5, z - 8.15], M('#9b2f24', 'WoodPlanks')),
    ...[[0, 45], [0, -45]].map(([, a]) => block('DoorX', [11.6, 0.6, 0.3], [x, y + 4.5, z - 8.4], TRIM, { canCollide: false, rot: [0, 0, a] })),
    block('DoorFrame', [8.8, 0.6, 0.3], [x, y + 9.1, z - 8.4], TRIM, noCol), block('Loft', [3.4, 3, 0.3], [x, y + 13.6, z - 8.45], M('#2b2523', 'Wood'), noCol));
  return model('Barn', kids); }
function silo(x, z, y = 0) { return model('Silo', [cyl('Tank', 20, 7, [x, y + 10, z], M('#c9d1dd', 'DiamondPlate')), ...[4, 9, 14, 19].map((h) => cyl('Band', 0.5, 7.3, [x, y + h, z], M('#8a93a3', 'Metal'), noCol)),
  ball('Dome', 7.2, [x, y + 20.2, z], M('#c0392b', 'Metal')), block('Ladder', [0.8, 20, 0.3], [x, y + 10, z - 3.6], M('#5f6673', 'Metal'), noCol)]); }
function hay(x, z, r, y = 0) { const kids = [], c = ['#e9c46a', '#dcb658', '#f0cf7a'];
  for (const [dx, dy, dz] of [[0, 0, 0], [3.3, 0, 0.3], [1.6, 2.1, 0.15]]) { kids.push(block('Bale', [3.1, 2.1, 2.2], [x + dx, y + 1.05 + dy, z + dz], M(c[(dx + dy) % 3 | 0], 'Fabric'), { rot: [0, (r() - 0.5) * 12, 0] }));
    for (const o of [-0.9, 0.9]) kids.push(block('Twine', [0.15, 2.15, 2.25], [x + dx + o, y + 1.05 + dy, z + dz], M('#b2873e', 'Fabric'), noCol)); }
  return model('HayBales', kids); }
function field(x, z, r, y = 0, crop = 'ble') { const kids = [block('Soil', [24, 0.6, 18], [x, y + 0.3, z], M('#6b4426', 'Ground'))];
  for (let row = 0; row < 6; row++) { kids.push(block('Furrow', [23, 0.3, 1.4], [x, y + 0.75, z - 7.5 + row * 3], M('#5a3720', 'Ground'), noCol));
    for (let i = 0; i < 9; i++) { const px = x - 10.5 + i * 2.6, pz = z - 7.5 + row * 3;
      if (crop === 'carrots') kids.push(P('WedgePart', 'Leaf', [0.5, 1.2, 0.5], [px, y + 1.4, pz], [0, i * 40, 0], M('#4cc46a', 'Grass'), noCol));
      else if (crop === 'pumpkins') { if ((i + row) % 2) kids.push(ball('Pumpkin', 1.5, [px, y + 1.4, pz], M('#ff8a1a', 'SmoothPlastic'), noCol), block('Stem', [0.2, 0.5, 0.2], [px, y + 2.2, pz], M('#4e7a2a', 'Wood'), noCol)); }
      else kids.push(block('Wheat', [0.35, 2.2 + r() * 0.6, 0.35], [px, y + 1.8, pz], M(r() < 0.5 ? '#e9c46a' : '#d9b24f', 'Grass'), noCol), ball('Ear', 0.55, [px, y + 3.1, pz], M('#f0cf7a', 'Grass'), noCol)); } }
  return model(crop === 'carrots' ? 'CarrotField' : crop === 'pumpkins' ? 'PumpkinPatch' : 'WheatField', kids); }
function pen(x, z, w, d, y = 0) { const kids = [], wood = ['#b8794a', '#a96c40'];
  const side = (x1, z1, x2, z2) => { const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(len / 5)), a = Math.atan2(x2 - x1, z2 - z1) * 180 / Math.PI;
    for (let i = 0; i <= n; i++) { const t = i / n; kids.push(block('Post', [0.7, 4, 0.7], [x1 + (x2 - x1) * t, y + 2, z1 + (z2 - z1) * t], M('#6b4426', 'Wood'))); }
    for (const h of [1.6, 3.1]) kids.push(block('Rail', [0.35, 0.5, len], [(x1 + x2) / 2, y + h, (z1 + z2) / 2], M(wood[h > 2 ? 0 : 1], 'WoodPlanks'), { rot: [0, a, 0] })); };
  const hx = w / 2, hz = d / 2; side(x - hx, z - hz, x + hx, z - hz); side(x + hx, z - hz, x + hx, z + hz); side(x + hx, z + hz, x - hx, z + hz); side(x - hx, z + hz, x - hx, z - hz);
  kids.push(block('Grass', [w, 0.2, d], [x, y + 0.1, z], M('#6fc46a', 'Grass'), noCol));
  return model('Pen', kids); }
function trough(x, z, y = 0) { return model('Trough', [block('Box', [6, 1.6, 2], [x, y + 0.8, z], M('#8a5a33', 'WoodPlanks')), block('Water', [5.4, 0.2, 1.4], [x, y + 1.5, z], M('#4fb4ff', 'Glass'), { transparency: 0.2, canCollide: false })]); }
function tractor(x, z, y = 0) { const g = M('#3fa34d', 'SmoothPlastic');
  return model('Tractor', [block('Body', [4, 2.4, 7], [x, y + 3, z], g), block('Cab', [3.6, 3.4, 3], [x, y + 5.4, z + 1.6], g), block('Glass', [3.3, 2.2, 3.1], [x, y + 5.6, z + 1.6], M('#cfe8ff', 'Glass'), { transparency: 0.35, canCollide: false }),
    block('Roof', [4, 0.4, 3.6], [x, y + 7.3, z + 1.6], M('#f4efe6', 'SmoothPlastic')), cyl('Pipe', 2.4, 0.4, [x + 1, y + 5, z - 2.4], M('#2b2b2b', 'Metal'), noCol),
    ...[[-2.4, 2, 4.2], [2.4, 2, 4.2]].map(([dx, , d]) => cyl('BigWheel', 1.4, d, [x + dx, y + 2.1, z + 1.8], M('#2b2b2b', 'Plastic'), { rot: [0, 0, 0] })),
    ...[[-2.2, 2.6], [2.2, 2.6]].map(([dx, d]) => cyl('Wheel', 1.2, d, [x + dx, y + 1.3, z - 2.4], M('#2b2b2b', 'Plastic'), { rot: [0, 0, 0] }))]); }
function scarecrow(x, z, y = 0) { return model('Scarecrow', [block('Post', [0.5, 7, 0.5], [x, y + 3.5, z], M('#6b4426', 'Wood')), block('Arms', [6, 0.5, 0.5], [x, y + 5.2, z], M('#6b4426', 'Wood')),
  block('Shirt', [2.6, 2.6, 1.2], [x, y + 4.8, z], M('#3f86ff', 'Fabric')), ball('Head', 1.8, [x, y + 7, z], M('#e9c46a', 'Fabric')), cyl('Hat', 0.3, 3, [x, y + 7.9, z], M('#8a5a33', 'Fabric')), cyl('HatTop', 1, 1.6, [x, y + 8.5, z], M('#8a5a33', 'Fabric'))]); }

/* ---------- animals on the map (voxel engine, coarser grid so a herd stays light) ---------- */
function colorPalette(hex) { return { back: shade(hex, 0.82), side: hex, belly: shade(hex, 1.35), muzzle: shade(hex, 1.25), socks: shade(hex, 0.7), dark: shade(hex, 0.45), nose: shade(hex, 0.6), hoof: shade(hex, 0.4), mane: shade(hex, 0.55), saddle: shade(hex, 0.7) }; }
const animalCache = new Map();
export function animalModel(species, x, z, yaw, y = 0, o = {}) {
  const key = species + '|' + (o.color || '') + '|' + !!o.wings + '|' + (o.size || 1) + '|' + JSON.stringify(o.flags || {}) + JSON.stringify(o.palette || {});
  if (!animalCache.has(key)) animalCache.set(key, voxelAnimal(VOX_SPECIES[species] ? species : 'loup', { voxel: 0.13 * Math.max(1, (o.size || 1) * 0.8), scale: 1.25 * (o.size || 1), palette: o.color ? colorPalette(o.color) : o.palette || null, flags: o.flags, wings: o.wings }).parts);
  const c = Math.cos(yaw), s = Math.sin(yaw), kids = animalCache.get(key).map((p) => {
    const dx = p.pos[0] * c + p.pos[2] * s, dz = -p.pos[0] * s + p.pos[2] * c;
    return P('Part', p.name, p.size, [x + dx, y + p.pos[1], z + dz], [0, yaw * 180 / Math.PI, 0], M(p.color, p.material), { canCollide: false });
  });
  return model(o.word ? o.word.replace(/eaux$/, 'eau').replace(/aux$/, 'al').replace(/([^s])s$/, '$1').replace(/[^a-z0-9]/gi, '').replace(/^./, (c) => c.toUpperCase()) : VOX_SPECIES[species] ? VOX_SPECIES[species].fr.replace(/\s/g, '') : 'Animal', kids, { attributes: { ForgeAnimal: species } });
}

/* ---------- placing a parsed scene around the gameplay area ---------- */
const BUILDERS = { barn: (x, z) => barn(x, z), silo: (x, z) => silo(x, z), hay: (x, z, r) => hay(x, z, r), field: (x, z, r) => field(x, z, r), carrots: (x, z, r) => field(x, z, r, 0, 'carrots'),
  pumpkins: (x, z, r) => field(x, z, r, 0, 'pumpkins'), pen: (x, z) => pen(x, z, 26, 20), trough: (x, z) => trough(x, z), tractor: (x, z) => tractor(x, z), scarecrow: (x, z) => scarecrow(x, z) };
export function buildScene(T, parsed, center, r) {
  const out = [], [cx, cz] = center, animals = parsed.items.filter((it) => it.kind === 'animal'), things = parsed.items.filter((it) => it.kind === 'thing');
  const nAnimals = animals.reduce((s, a) => s + a.count, 0);
  let penAt = null;
  if (parsed.farm || things.some((t) => t.id === 'pen') || nAnimals) {
    // farm layout: barn north, silo beside it, pen in the middle (sized for the herd), fields east and west, hay near the barn
    const pw = Math.max(26, Math.ceil(Math.sqrt(nAnimals || 4)) * 9 + 8), pd = Math.max(20, pw * 0.75);
    penAt = [cx, cz]; out.push(pen(cx, cz, pw, pd), trough(cx + pw / 2 - 5, cz + pd / 2 - 3));
    if (parsed.farm) out.push(barn(cx, cz - pd / 2 - 16), silo(cx + 18, cz - pd / 2 - 16), hay(cx - 16, cz - pd / 2 - 10, r), hay(cx - 20, cz - pd / 2 - 4, r),
      field(cx - pw / 2 - 20, cz, r), field(cx + pw / 2 + 20, cz, r, 0, r() < 0.5 ? 'carrots' : 'pumpkins'), scarecrow(cx + pw / 2 + 20, cz + 12), tractor(cx - pw / 2 - 6, cz - pd / 2 - 6),
      ...[0, 1, 2].map((i) => MM.oak(T, cx - pw / 2 - 30 + i * 9, cz - pd / 2 - 24, r, 0)));
    // the animals graze inside the pen
    let k = 0; const per = Math.ceil(Math.sqrt(nAnimals)), sx = (pw - 8) / Math.max(1, per), sz = (pd - 8) / Math.max(1, per);
    for (const a of animals) for (let i = 0; i < a.count; i++, k++) { const gx = k % per, gz = Math.floor(k / per);
      out.push(animalModel(a.species || a.id, cx - pw / 2 + 4 + sx * (gx + 0.5) + (r() - 0.5) * 2, cz - pd / 2 + 4 + sz * (gz + 0.5) + (r() - 0.5) * 2, r() * Math.PI * 2, 0, a)); }
  }
  // every other named thing gets its own cluster on a ring around the farm / gameplay
  const ring = things.filter((t) => t.id !== 'pen'); let a0 = r() * Math.PI * 2;
  ring.forEach((t, idx) => { const ang = a0 + (idx / Math.max(1, ring.length)) * Math.PI * 2, R = (penAt ? 60 : 70) + (idx % 2) * 18, gx = cx + Math.cos(ang) * R, gz = cz + Math.sin(ang) * R;
    for (let i = 0; i < t.count; i++) { const ox = gx + (i % 4) * 13 - 18 + (r() - 0.5) * 3, oz = gz + Math.floor(i / 4) * 13 + (r() - 0.5) * 3;
      if (t.fam && ARCH[t.fam]) out.push(ARCH[t.fam](T, ox, oz, r, 0, { ...(t.o || {}), color: t.color || (t.o && t.o.color), scale: (t.o && t.o.scale || 1) * t.size }));
      else if (t.id === 'skyscraper') out.push(ARCH.skyscraper(T, ox, oz, r, 0, { color: t.color }));
      else if (t.id === 'roundTower' || t.id === 'lighthouse') out.push(ARCH.roundTower(T, ox, oz, r, 0, { lighthouse: t.id === 'lighthouse', color: t.color }));
      else if (t.id === 'hut') out.push(ARCH.hut(T, ox, oz, r, 0, {}));
      else if (BUILDERS[t.id]) out.push(BUILDERS[t.id](ox, oz, r));
      else if (t.id === 'forest') for (let f = 0; f < 9; f++) out.push(MM[r() < 0.5 ? 'pine' : 'oak'](T, gx + (r() - 0.5) * 40, gz + (r() - 0.5) * 40, r, 0));
      else if (PROPS[t.id]) out.push(PROPS[t.id].build(T, ox, oz, r, 0));
      else if (t.id === 'house') out.push(MM.house(T, ox, oz, r() * 360, r, 0));
      else if (t.id === 'oak' || t.id === 'pine' || t.id === 'cherry') out.push(t.id === 'cherry' ? MM.oak(T, ox, oz, r, 0, 1, true) : MM[t.id](T, ox, oz, r, 0));
      else if (t.id === 'cactus') out.push(MM.cactus(ox, oz, r, 0));
      else if (t.id === 'flowers') out.push(MM.flowers(ox, oz, r, 0));
      else if (t.id === 'cloud') out.push(MM.cloud(ox, 70 + r() * 30, oz, r));
      else if (['castle', 'temple', 'windmill', 'statue', 'waterfall', 'volcano'].includes(t.id)) out.push(MM[t.id](T, ox, oz, r, 0));
      if (t.color && !t.fam) recolor(out[out.length - 1], t.color);
    } });
  return out;
}
// « tentes rouges », « maison bleue »: tint the main surfaces, keep dark details
function recolor(m, hex) { const walk = (n) => { if (n.children) n.children.forEach(walk); else if (n.color && !/Neon|Glass/.test(n.material)) { const v = parseInt(n.color.slice(1), 16), l = ((v >> 16) + ((v >> 8) & 255) + (v & 255)) / 765;
  if (l > 0.35) n.color = shade(hex, 0.75 + l * 0.4); } }; if (m) walk(m); }
export const SCENE_WORDS = { animals: Object.keys(ANIMALS), things: Object.keys(THINGS) };
