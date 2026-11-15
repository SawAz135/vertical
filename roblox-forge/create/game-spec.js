/* =====================================================================
   Roblox Forge - « Créer tout » : sentence → game spec.
   Understands French and English: game type, theme, stats (force, vitesse…),
   money, GUI buttons (« un bouton +1 force », « bouton vendre »), working
   shop / sell / rebirth / eggs & pets / zones / daily reward / codes /
   gamepass ×2 / auto-train / leaderboard — and edits: « ajoute … »,
   « enlève … », « change le prix de … ». The spec drives the generated
   Luau (ForgeGame) and the map.
   ===================================================================== */
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const NUMW = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, cent: 100, mille: 1000, one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10 };
const num = (t) => { if (t == null) return null; const n = parseFloat(String(t).replace(',', '.').replace(/k$/i, '000').replace(/m$/i, '000000')); return isFinite(n) ? n : NUMW[norm(t)] ?? null; };

/* stats a player can grow (the first one asked becomes the trained stat) */
export const STATS = {
  force: { id: 'Force', e: '💪', words: 'force strength puissance power muscle muscles' }, vitesse: { id: 'Vitesse', e: '⚡', words: 'vitesse speed rapidite' },
  magie: { id: 'Magie', e: '✨', words: 'magie magic mana' }, endurance: { id: 'Endurance', e: '❤️', words: 'endurance stamina vie health' },
  intelligence: { id: 'Intelligence', e: '🧠', words: 'intelligence cerveau brain iq' }, saut: { id: 'Saut', e: '🦘', words: 'saut jump sauter' },
  taille: { id: 'Taille', e: '📏', words: 'taille size grandeur' }, xp: { id: 'XP', e: '⭐', words: 'xp experience' }, clics: { id: 'Clics', e: '👆', words: 'clic clics click clicks tap taps' },
  karma: { id: 'Karma', e: '☯️', words: 'karma aura' }, energie: { id: 'Energie', e: '🔋', words: 'energie energy' },
};
export const MONEY = { coins: { id: 'Coins', e: '🪙', words: 'coins coin pieces piece argent money cash sous dollars or gold' }, gems: { id: 'Gems', e: '💎', words: 'gems gemmes gemme diamants diamant cristaux' } };
const GENRES = { simulator: 'simulator simulateur simu', tycoon: 'tycoon usine', obby: 'obby parcours', arena: 'arene arena combat pvp', lobby: 'lobby hub', island: 'ile island plage', city: 'ville city', cave: 'grotte cave mine', sky: 'ciel sky nuages' };
const THEMES = { plaine: 'plaine foret prairie campagne', desert: 'desert sable', neige: 'neige hiver glace', lave: 'volcan lave feu', bonbon: 'bonbon candy sucre', neon: 'neon cyber futur', espace: 'espace space galaxie lune' };
const FEAT = { shop: 'shop boutique magasin store', sell: 'sell vendre vente revendre', rebirth: 'rebirth rebirths renaissance prestige', eggs: 'oeuf oeufs egg eggs pet pets familier familiers',
  zones: 'zone zones monde mondes world worlds', daily: 'daily quotidien quotidienne journaliere journalier', codes: 'code codes', pass: 'gamepass vip pass x2 double', auto: 'auto autoclick auto-clic auto-train automatique',
  board: 'classement leaderboard top', music: 'musique music', train: 'entrainer entrainement train training halteres haltere salle gym' };
const has = (t, words) => words.split(' ').some((w) => w && new RegExp('(^|[^a-z0-9])' + w + '([^a-z0-9]|$)').test(t));
function findStat(word) { const w = norm(word).replace(/s$/, ''); for (const [k, s] of Object.entries(STATS)) if (k === w || s.words.split(' ').includes(w) || s.words.split(' ').includes(norm(word))) return s; return null; }
function findMoney(word) { const w = norm(word); for (const m of Object.values(MONEY)) if (m.words.split(' ').includes(w) || m.words.split(' ').includes(w.replace(/s$/, ''))) return m; return null; }

export function emptySpec() {
  return { v: 1, title: 'Mon jeu', genre: 'simulator', theme: 'plaine', voxel: true, mapText: '', stats: [], money: [], train: null, buttons: [], sell: null, shop: null, rebirth: null, eggs: null, zones: 0,
    daily: null, codes: [], pass: null, autoTrain: false, leaderboard: true, music: false, log: [] };
}
const statSpec = (s) => ({ id: s.id, e: s.e, start: 0 });
function ensureStat(spec, s) { if (!spec.stats.some((x) => x.id === s.id)) spec.stats.push(statSpec(s)); return spec.stats.find((x) => x.id === s.id); }
function ensureMoney(spec, m = MONEY.coins) { if (!spec.money.some((x) => x.id === m.id)) spec.money.push({ id: m.id, e: m.e, start: 0 }); return spec.money.find((x) => x.id === m.id); }
const mainStat = (spec) => spec.stats[0] || ensureStat(spec, STATS.force);
const mainMoney = (spec) => spec.money[0] || ensureMoney(spec);
const uid = (spec, base) => { let id = base.replace(/[^A-Za-z0-9]/g, '') || 'B', i = 2; while (spec.buttons.some((b) => b.id === id)) id = base.replace(/[^A-Za-z0-9]/g, '') + i++; return id; };

/* buttons: « bouton +1 force », « un bouton qui donne 5 vitesse », « bouton vendre », « bouton rebirth », « bouton shop », « bouton x2 » */
function parseButtons(t, spec) {
  const out = [], re = /\bbouton(?:s)?\b([^,.;]*)|\bbutton(?:s)?\b([^,.;]*)/g; let m;
  while ((m = re.exec(t))) { let rest = (m[1] ?? m[2] ?? '').replace(/^\s*(de|du|pour|qui|that|to|avec)\s+/, ' ').trim();
    rest = rest.replace(/^(donne|ajoute|gives?|adds?)\s+/, '');
    const a = rest.match(/^([+-x×*]?\s*\d+(?:[.,]\d+)?\s*[km]?)\s*(?:de\s+|d\s+|of\s+)?([a-z-]+)?/), word = (a ? a[2] : rest.split(/\s+/)[0]) || '';
    if (/^(vendre|sell|vente)/.test(rest)) { out.push({ kind: 'sell' }); continue; }
    if (/^(rebirth|renaissance|prestige)/.test(rest)) { out.push({ kind: 'rebirth' }); continue; }
    if (/^(shop|boutique|magasin)/.test(rest)) { out.push({ kind: 'shop' }); continue; }
    if (/^(entrain|train|clic|click)/.test(rest) && !a) { out.push({ kind: 'train' }); continue; }
    if (/^(oeuf|egg)/.test(rest)) { out.push({ kind: 'egg' }); continue; }
    if (/^(teleport|tp|spawn|maison|home)/.test(rest)) { out.push({ kind: 'home' }); continue; }
    if (a) { const sign = /^[x×*]/.test(a[1].trim()) ? 'mul' : 'add', amount = num(a[1].replace(/[+x×*\s]/g, '')) ?? 1, st = findStat(word), mo = !st && findMoney(word);
      out.push({ kind: sign === 'mul' ? 'boost' : 'add', amount, stat: st, money: mo, word }); continue; }
    const st = findStat(word); if (st) out.push({ kind: 'add', amount: 1, stat: st }); }
  return out;
}
function addButton(spec, b) {
  const S = mainStat(spec);
  if (b.kind === 'sell') { spec.sell ||= sellDefault(spec); if (!spec.buttons.some((x) => x.action === 'sell')) spec.buttons.push({ id: 'Sell', label: '💰 Vendre', action: 'sell', color: '#3dd68c' }); return 'bouton Vendre'; }
  if (b.kind === 'rebirth') { spec.rebirth ||= rebirthDefault(spec); if (!spec.buttons.some((x) => x.action === 'rebirth')) spec.buttons.push({ id: 'Rebirth', label: '🔁 Rebirth', action: 'rebirth', color: '#b46bff' }); return 'bouton Rebirth'; }
  if (b.kind === 'shop') { spec.shop ||= shopDefault(spec, []); if (!spec.buttons.some((x) => x.action === 'shop')) spec.buttons.push({ id: 'Shop', label: '🛒 Boutique', action: 'shop', color: '#ffb02e' }); return 'bouton Boutique'; }
  if (b.kind === 'egg') { spec.eggs ||= eggsDefault(spec); if (!spec.buttons.some((x) => x.action === 'egg')) spec.buttons.push({ id: 'Egg', label: '🥚 Œuf', action: 'egg', color: '#ff7ab6' }); return 'bouton Œuf'; }
  if (b.kind === 'home') { if (!spec.buttons.some((x) => x.action === 'home')) spec.buttons.push({ id: 'Home', label: '🏠 Spawn', action: 'home', color: '#5aa9ff' }); return 'bouton Spawn'; }
  if (b.kind === 'train') { spec.train ||= trainDefault(spec); if (!spec.buttons.some((x) => x.action === 'train')) spec.buttons.push({ id: 'Train', label: S.e + ' Entraîner', action: 'train', color: '#ff5c5c' }); return 'bouton Entraîner'; }
  if (b.kind === 'boost') { spec.pass ||= { mult: b.amount || 2, price: 99, id: 0 }; return 'gamepass ×' + (b.amount || 2); }
  let target; if (b.money) target = ensureMoney(spec, b.money); else if (b.stat) target = ensureStat(spec, b.stat); else if (b.word && b.word.length > 2 && !/^(de|du|des|et|and)$/.test(b.word)) target = ensureStat(spec, { id: cap(b.word.replace(/s$/, '')), e: '⭐' }); else target = S;
  const amount = b.amount || 1, label = `+${amount} ${target.id}`;
  if (spec.buttons.some((x) => x.action === 'add' && x.stat === target.id && x.amount === amount)) return label + ' (déjà là)';
  spec.buttons.push({ id: uid(spec, 'Add' + amount + target.id), label: `${target.e} ${label}`, action: 'add', stat: target.id, amount, cooldown: 0.25, color: ['#ff5c5c', '#5aa9ff', '#3dd68c', '#ffb02e', '#b46bff'][spec.buttons.length % 5] });
  return 'bouton ' + label;
}
const trainDefault = (spec) => ({ stat: mainStat(spec).id, perClick: 1, cooldown: 0.2, tool: true });
const sellDefault = (spec) => ({ from: mainStat(spec).id, to: mainMoney(spec).id, rate: 1, keep: false });
const rebirthDefault = (spec) => ({ costStat: mainStat(spec).id, cost: 1000, growth: 2.5, bonus: 0.5 });
const eggsDefault = (spec) => ({ price: 250, money: mainMoney(spec).id, pets: [{ name: 'Chat', mult: 1.2, w: 50 }, { name: 'Chien', mult: 1.4, w: 30 }, { name: 'Renard', mult: 1.8, w: 14 }, { name: 'Dragon', mult: 3, w: 5 }, { name: 'Licorne', mult: 6, w: 1 }] });
/* shop: upgrades of the trained stat (+ per click) and of sell value; named items become upgrades too */
const ITEM_HINT = [[/haltere|dumbbell|poids|weight/, 'perClick'], [/epee|sword|arme|weapon|baton|bat|hache/, 'perClick'], [/sac|bag|sacoche|backpack/, 'capacity'], [/chaussure|botte|shoe|boot/, 'speed'],
  [/potion|boost/, 'mult'], [/aimant|magnet/, 'sellMult'], [/couronne|crown|aura/, 'mult']];
function shopDefault(spec, names) {
  const S = mainStat(spec).id, M = mainMoney(spec).id, items = [];
  const base = [['Haltère en bois', '🏋️', 'perClick', 1, 50], ['Haltère en fer', '🏋️', 'perClick', 3, 400], ['Haltère en or', '🏆', 'perClick', 10, 3500], ['Potion ×2', '🧪', 'mult', 2, 12000], ['Super Haltère', '💎', 'perClick', 50, 60000]];
  for (const n of names) { const k = norm(n), hint = (ITEM_HINT.find(([re]) => re.test(k)) || [, 'perClick'])[1], price = Math.round(100 * Math.pow(6, items.length));
    items.push({ id: n.replace(/[^A-Za-z0-9]/g, '') || 'Item' + items.length, name: cap(n), e: /epee|sword/.test(k) ? '🗡️' : /sac|bag/.test(k) ? '🎒' : /potion/.test(k) ? '🧪' : /chaussure|botte/.test(k) ? '👟' : '⭐', effect: hint, value: hint === 'mult' || hint === 'sellMult' ? 2 : hint === 'speed' ? 4 : Math.max(1, Math.round(Math.pow(4, items.length))), price, money: M }); }
  if (!items.length) for (const [name, e, effect, value, price] of base) items.push({ id: name.replace(/[^A-Za-z0-9]/g, ''), name, e, effect, value, price, money: M });
  return { stat: S, items };
}

/* give back the words as the user typed them (accents) */
function original(text, n) { const words = String(text).split(/[\s,.;:!?«»"()]+/), want = n.split(/\s+/);
  for (let i = 0; i + want.length <= words.length; i++) if (want.every((w, k) => norm(words[i + k]) === w)) return words.slice(i, i + want.length).join(' ');
  return n; }
/* the whole sentence (creation) or an edit (« ajoute… », « enlève… ») */
export function applyText(text, prev) {
  const t = ' ' + norm(text).replace(/[«»"()]/g, ' ') + ' ', spec = prev ? JSON.parse(JSON.stringify(prev)) : emptySpec(), done = [];
  const removing = /\b(enleve|enlever|supprime|supprimer|retire|retirer|remove|delete|sans)\b/.test(t);
  if (!prev || /\b(map|carte|jeu|game|simulator|tycoon|obby)\b/.test(t) && !/\b(ajoute|add|enleve|supprime|change)\b/.test(t)) {
    for (const [g, w] of Object.entries(GENRES)) if (has(t, w)) { spec.genre = g; break; }
    for (const [k, w] of Object.entries(THEMES)) if (has(t, w)) { spec.theme = k; break; }
    if (/\b(classique|classic|lisse)\b/.test(t)) spec.voxel = false;
    const titleM = text.match(/[«"]([^»"]{2,40})[»"]/); if (titleM) spec.title = titleM[1];
    else if (!prev) spec.title = { simulator: 'Simulator', tycoon: 'Tycoon', obby: 'Obby', arena: 'Arène', lobby: 'Aventure', island: 'Île', city: 'Ville', cave: 'Mine', sky: 'Ciel' }[spec.genre] + (spec.theme !== 'plaine' ? ' ' + cap(spec.theme) : '');
    spec.mapText = text;
  }
  if (removing) {
    const rm = (what, fn) => { if (fn()) done.push('− ' + what); };
    for (const b of parseButtons(t, spec)) { const before = spec.buttons.length;
      spec.buttons = spec.buttons.filter((x) => !(b.kind === 'add' ? x.action === 'add' && (!b.stat || x.stat === b.stat.id) && (!b.amount || x.amount === b.amount) : x.action === b.kind || (b.kind === 'sell' && x.action === 'sell')));
      if (spec.buttons.length < before) done.push('− bouton'); }
    if (has(t, FEAT.shop) && !/\bbouton\b/.test(t)) rm('boutique', () => { const h = !!spec.shop; spec.shop = null; spec.buttons = spec.buttons.filter((b) => b.action !== 'shop'); return h; });
    if (has(t, FEAT.sell) && !/\bbouton\b/.test(t)) rm('vente', () => { const h = !!spec.sell; spec.sell = null; spec.buttons = spec.buttons.filter((b) => b.action !== 'sell'); return h; });
    if (has(t, FEAT.rebirth) && !/\bbouton\b/.test(t)) rm('rebirth', () => { const h = !!spec.rebirth; spec.rebirth = null; spec.buttons = spec.buttons.filter((b) => b.action !== 'rebirth'); return h; });
    if (has(t, FEAT.eggs)) rm('œufs et pets', () => { const h = !!spec.eggs; spec.eggs = null; spec.buttons = spec.buttons.filter((b) => b.action !== 'egg'); return h; });
    if (has(t, FEAT.zones)) rm('zones', () => { const h = spec.zones > 0; spec.zones = 0; return h; });
    if (has(t, FEAT.daily)) rm('récompense quotidienne', () => { const h = !!spec.daily; spec.daily = null; return h; });
    if (has(t, FEAT.codes)) rm('codes', () => { const h = spec.codes.length > 0; spec.codes = []; return h; });
    if (has(t, FEAT.pass)) rm('gamepass', () => { const h = !!spec.pass; spec.pass = null; return h; });
    if (has(t, FEAT.auto)) rm('auto-entraînement', () => { const h = spec.autoTrain; spec.autoTrain = false; return h; });
    spec.log.push({ text, done }); return { spec, done };
  }
  // stats & money named anywhere
  for (const w of t.split(/[^a-z0-9-]+/)) { const s = findStat(w); if (s && !/\bbouton\b/.test('')) ensureStat(spec, s); }
  for (const w of t.split(/[^a-z0-9-]+/)) { const m = findMoney(w); if (m && !(m.id === 'Coins' && w === 'or' && !/\b(pieces? d or|or)\b/.test(t))) ensureMoney(spec, m); }
  if (spec.genre === 'simulator' || has(t, FEAT.train)) { if (!spec.train) { spec.train = trainDefault(spec); done.push('entraînement (' + spec.train.stat + ' par clic)'); } }
  // features
  if (has(t, FEAT.sell)) { if (!spec.sell) { spec.sell = sellDefault(spec); done.push(`vente : ${spec.sell.from} → ${spec.sell.to}`); } if (!spec.buttons.some((b) => b.action === 'sell')) addButton(spec, { kind: 'sell' }); }
  if (has(t, FEAT.shop)) { const m = t.match(/\b(?:shop|boutique|magasin|store)\b[^,.;]*?\b(?:avec|with|qui vend|:)\s+([^.;]+)/), names = [];
    if (m) for (const part of m[1].split(/,|\bet\b|\band\b/)) { const n = part.replace(/\b(un|une|des|de|du|le|la|les|a|an|the|fonctionnel(le)?|working|script|qui marche)\b/g, ' ').trim(); if (n && n.length > 2 && !findStat(n) && !/\d/.test(n) && !Object.values(FEAT).some((w) => has(' ' + n + ' ', w)) && !/(bouton|button)/.test(n)) names.push(original(text, n)); }
    if (!spec.shop || names.length) { spec.shop = shopDefault(spec, names); done.push(`boutique (${spec.shop.items.length} objets)`); } if (!spec.buttons.some((b) => b.action === 'shop')) addButton(spec, { kind: 'shop' }); }
  if (has(t, FEAT.rebirth)) { if (!spec.rebirth) { spec.rebirth = rebirthDefault(spec); done.push('rebirth'); } if (!spec.buttons.some((b) => b.action === 'rebirth')) addButton(spec, { kind: 'rebirth' }); }
  if (has(t, FEAT.eggs)) { if (!spec.eggs) { spec.eggs = eggsDefault(spec); done.push('œufs et pets (multiplicateurs)'); } }
  { const z = t.match(/(\d+|un|deux|trois|quatre|cinq|six)\s+(zones?|mondes?|worlds?)/); if (z) { spec.zones = Math.min(6, num(z[1]) || 3); done.push(spec.zones + ' zones à débloquer'); } else if (has(t, FEAT.zones) && !spec.zones) { spec.zones = 3; done.push('3 zones à débloquer'); } }
  if (has(t, FEAT.daily) && !spec.daily) { spec.daily = { amount: 100, money: mainMoney(spec).id }; done.push('récompense quotidienne'); }
  if (has(t, FEAT.codes)) { const cm = [...text.matchAll(/code\s+[«"]?([A-Z0-9_]{3,20})[»"]?/gi)].map((x) => x[1].toUpperCase()); const list = cm.length ? cm : ['FORGE', 'BIENVENUE'];
    for (const c of list) if (!spec.codes.some((x) => x.code === c)) spec.codes.push({ code: c, amount: 500, money: mainMoney(spec).id }); done.push('codes : ' + list.join(', ')); }
  if (has(t, FEAT.pass) && !spec.pass) { spec.pass = { mult: 2, price: 99, id: 0 }; done.push('gamepass ×2 (à relier à ton id)'); }
  if (has(t, FEAT.auto) && !spec.autoTrain) { spec.autoTrain = true; done.push('auto-entraînement'); }
  if (has(t, FEAT.music)) spec.music = true;
  // buttons
  for (const b of parseButtons(t, spec)) done.push(addButton(spec, b));
  // a simulator always has its core loop
  if (spec.genre === 'simulator') { mainStat(spec); mainMoney(spec); spec.train ||= trainDefault(spec); if (!spec.buttons.some((b) => b.action === 'train')) addButton(spec, { kind: 'train' }); }
  if (!spec.stats.length && !spec.money.length) mainMoney(spec);
  if (!done.length && !prev) done.push('jeu de base');
  spec.log.push({ text, done }); return { spec, done };
}

/** spec → Luau config (ReplicatedStorage.ForgeGame.Config) */
export function toLua(v, ind = '') {
  if (v === null || v === undefined) return 'nil';
  if (typeof v === 'boolean') return String(v); if (typeof v === 'number') return String(+v.toFixed(6));
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return v.length ? '{\n' + v.map((x) => ind + '\t' + toLua(x, ind + '\t')).join(',\n') + '\n' + ind + '}' : '{}';
  const e = Object.entries(v).filter(([, x]) => x !== undefined); if (!e.length) return '{}';
  return '{\n' + e.map(([k, x]) => `${ind}\t${/^[A-Za-z_]\w*$/.test(k) ? k : '[' + JSON.stringify(k) + ']'} = ${toLua(x, ind + '\t')}`).join(',\n') + '\n' + ind + '}';
}
export function configOf(spec) {
  const c = { title: spec.title, stats: spec.stats, money: spec.money, train: spec.train, buttons: spec.buttons, sell: spec.sell, shop: spec.shop, rebirth: spec.rebirth, eggs: spec.eggs,
    zones: spec.zones, daily: spec.daily, codes: spec.codes, pass: spec.pass, autoTrain: spec.autoTrain, leaderboard: spec.leaderboard, datastore: 'ForgeGame_' + (spec.title || 'Game').replace(/[^A-Za-z0-9]/g, '').slice(0, 30) + '_v1' };
  return '-- Roblox Forge « Créer tout » : configuration du jeu (modifiable)\nreturn ' + toLua(c) + '\n';
}
