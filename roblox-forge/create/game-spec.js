/* =====================================================================
   Roblox Forge - « Créer tout » : sentence → game spec  (v2)
   French and English, verb forms and synonyms. Understands:
   - game type (simulator, tycoon, obby, combat arena…), theme, title
   - activities: pêche, manger/grossir, mine, bûcheron, course, muscles,
     saut, magie, clics, and « collecter / gagner des X » for any X
   - money (Coins, Gems, Cash), start values (« force de départ à 50 »)
   - GUI buttons: « +1 force », paid ones (« qui coûte 5 coins »,
     « acheter 10 force pour 100 coins »), timed boosts (« double la force
     pendant 30 secondes »), vendre, rebirth, boutique, œufs, spawn
   - shop (named items too), sell, rebirth, eggs & pets, zones, daily,
     codes, gamepass ×2, auto, leaderboard, PvP combat (épées, vie, kills)
   - edits: « ajoute … », « enlève … », « change le prix de X à N »,
     « le rebirth coûte N », « +3 par clic », « appelle le jeu « X » »
   An AI layer (ai-spec.js) can produce the same spec for free-form text;
   this rule engine is the offline fallback and the validator.
   ===================================================================== */
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/œ/g, 'oe');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const NUMW = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, vingt: 20, trente: 30, cent: 100, mille: 1000, one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10, double: 2, triple: 3 };
export const num = (t) => { if (t == null) return null; const s = String(t).trim().replace(',', '.'); const m = s.match(/^(\d+(?:\.\d+)?)([km])?$/i);
  if (m) return parseFloat(m[1]) * (m[2] ? (m[2].toLowerCase() === 'k' ? 1e3 : 1e6) : 1); return NUMW[norm(s)] ?? null; };

/* ---------- vocabulary ---------- */
export const STATS = {
  force: { id: 'Force', e: '💪', words: 'force strength puissance power muscle muscles' }, vitesse: { id: 'Vitesse', e: '⚡', words: 'vitesse speed rapidite' },
  magie: { id: 'Magie', e: '✨', words: 'magie magic mana' }, endurance: { id: 'Endurance', e: '❤️', words: 'endurance stamina' },
  intelligence: { id: 'Intelligence', e: '🧠', words: 'intelligence cerveau brain iq' }, saut: { id: 'Saut', e: '🦘', words: 'saut jump sauts' },
  taille: { id: 'Taille', e: '📏', words: 'taille size grandeur' }, xp: { id: 'XP', e: '⭐', words: 'xp experience' }, clics: { id: 'Clics', e: '👆', words: 'clic clics click clicks tap taps' },
  karma: { id: 'Karma', e: '☯️', words: 'karma aura' }, energie: { id: 'Energie', e: '🔋', words: 'energie energy' }, poissons: { id: 'Poissons', e: '🐟', words: 'poisson poissons fish' },
  minerais: { id: 'Minerais', e: '⛏️', words: 'minerai minerais ore ores' }, bois: { id: 'Bois', e: '🪵', words: 'bois wood' }, kills: { id: 'Kills', e: '⚔️', words: 'kill kills victoires' },
};
export const MONEY = { coins: { id: 'Coins', e: '🪙', words: 'coins coin pieces piece argent money sous dollars gold' }, gems: { id: 'Gems', e: '💎', words: 'gems gem gemmes gemme diamants diamant cristaux' },
  cash: { id: 'Cash', e: '💵', words: 'cash billets' } };
const GENRES = [['tycoon', /\b(tycoon|usine|factory|dropper\w*)\b/], ['obby', /\b(obby|parcours|obstacle\w*)\b/], ['arena', /\b(arene|arena|pvp|battle|combat\w*|bagarre|fight\w*|guerre)\b/],
  ['simulator', /\b(simulator|simulateur|simu|clicker)\b/], ['island', /\b(ile|island|plage)\b/], ['city', /\b(ville|city)\b/], ['cave', /\b(grotte|cave|mine)\b/], ['sky', /\b(ciel|sky|nuages?)\b/], ['lobby', /\b(lobby|hub)\b/]];
const THEMES = [['neige', /\b(neige\w*|hiver|glace|snow\w*|polaire|enneige\w*)\b/], ['desert', /\b(desert\w*|sable|dunes?)\b/], ['lave', /\b(volcan\w*|lave|magma|enfer)\b/], ['bonbon', /\b(bonbons?|candy|sucre\w*|kawaii)\b/],
  ['neon', /\b(neon|cyber\w*|futur\w*)\b/], ['espace', /\b(espace|space|galaxie|lune|cosmos|planete\w*)\b/], ['plaine', /\b(plaine|foret|prairie|campagne|ferme)\b/]];
const FEAT = {
  shop: /\b(shop|boutique|magasin|store|ameliorations?|upgrades?)\b/, sell: /\b(sell\w*|vend\w*|revend\w*|vente)\b/, rebirth: /\b(rebirth\w*|renaissance\w*|prestige|renaitre)\b/,
  eggs: /\b(oeufs?|eggs?|pets?|familiers?|compagnons?)\b/, zones: /\b(zones?|mondes?|worlds?|niveaux de carte)\b/, daily: /\b(daily|quotidien\w*|journali\w*|chaque jour|tous les jours|every day|cadeau)\b/,
  codes: /\bcodes?\b/, pass: /\b(gamepass|game pass|vip)\b/, auto: /\b(auto|autoclic\w*|auto-\w+|automatique\w*|idle|afk)\b/,
  board: /\b(classements?|leaderboards?|top \d+|meilleurs joueurs|plus forts|ranking|tableau des scores)\b/, combat: /\b(combat\w*|pvp|epees?|swords?|fight\w*|battle|tuer|kill\w*|bagarre|guerre|frapper)\b/,
  health: /\b(vie|health|hp|points de vie|coeurs?|armure\w*)\b/, train: /\b(entrain\w*|train\w*|halteres?|gym|salle de sport)\b/,
};
/* activities: what the player does → the stat it grows, the tool, and the upgrades the shop sells */
const ACTS = [
  { re: /\b(pech\w*|poissons?|canne a peche|fishing|fish\w*)\b/, stat: STATS.poissons, tool: 'Canne à pêche', theme: null, items: [['Canne en bois', '🎣'], ['Canne en fer', '🎣'], ['Canne en or', '🏆'], ['Filet', '🕸️', 'mult'], ['Bateau', '🚤']] },
  { re: /\b(mang\w*|grossi\w*|nourri\w*|bouffe|eat\w*|food)\b/, stat: STATS.taille, tool: 'Burger', items: [['Pomme', '🍎'], ['Burger', '🍔'], ['Pizza', '🍕'], ['Gâteau', '🎂', 'mult'], ['Festin royal', '🍗']] },
  { re: /\b(miner|mineur|minage|minant|mine des?|pioches?|minerais?|mining|creus\w*)\b/, stat: STATS.minerais, tool: 'Pioche', items: [['Pioche en bois', '⛏️'], ['Pioche en fer', '⛏️'], ['Pioche en or', '🏆'], ['Dynamite', '🧨', 'mult'], ['Foreuse', '🚜']] },
  { re: /\b(bucheron|couper du bois|haches?|lumber\w*|arbres a couper)\b/, stat: STATS.bois, tool: 'Hache', items: [['Hache en bois', '🪓'], ['Hache en fer', '🪓'], ['Hache en or', '🏆'], ['Tronçonneuse', '🪚', 'mult'], ['Scierie', '🏭']] },
  { re: /\b(cour(ir|se|s|t)|running|run|sprint\w*)\b/, stat: STATS.vitesse, tool: 'Baskets', items: [['Baskets', '👟'], ['Chaussures de course', '👟'], ['Chaussures dorées', '🏆'], ['Boisson énergie', '🥤', 'mult'], ['Jetpack', '🚀']] },
  { re: /\b(saut\w*|sauter|jump\w*|rebond\w*)\b/, stat: STATS.saut, tool: 'Ressort', items: [['Ressort', '🌀'], ['Trampoline', '🤸'], ['Bottes à ressort', '🏆'], ['Potion de saut', '🧪', 'mult'], ['Fusée', '🚀']] },
  { re: /\b(magi\w*|sorci\w*|baguette|mana|wizard|sort(s|ilege)?)\b/, stat: STATS.magie, tool: 'Baguette', items: [['Baguette en bois', '🪄'], ['Baguette de cristal', '🔮'], ['Bâton de mage', '🏆'], ['Grimoire', '📖', 'mult'], ['Orbe ancienne', '🌟']] },
  { re: /\b(cliqu\w*|clicker|tap\w*)\b/, stat: STATS.clics, tool: 'Doigt magique', items: [['Souris', '🖱️'], ['Souris gamer', '🖱️'], ['Souris dorée', '🏆'], ['Turbo clic', '⚡', 'mult'], ['Robot cliqueur', '🤖']] },
  { re: /\b(muscl\w*|soulev\w*|halteres?|strength|gym)\b/, stat: STATS.force, tool: 'Haltère', items: [['Haltère en bois', '🏋️'], ['Haltère en fer', '🏋️'], ['Haltère en or', '🏆'], ['Potion ×2', '🧪', 'mult'], ['Super Haltère', '💎']] },
];
const findStat = (word) => { const w = norm(word); for (const s of Object.values(STATS)) { const ws = s.words.split(' '); if (ws.includes(w) || ws.includes(w.replace(/s$/, '')) || norm(s.id) === w) return s; } return null; };
const findMoney = (word) => { const w = norm(word); for (const m of Object.values(MONEY)) { const ws = m.words.split(' '); if (ws.includes(w) || ws.includes(w.replace(/s$/, ''))) return m; } return null; };
const STOP = new Set('de du des la le les un une et ou a au aux en pour par avec sans the of and to for with qui que dans sur plus'.split(' '));

export function emptySpec() {
  return { v: 2, title: 'Mon jeu', genre: 'simulator', theme: null, voxel: true, mapText: '', stats: [], money: [], train: null, buttons: [], sell: null, shop: null, rebirth: null, eggs: null, zones: 0,
    daily: null, codes: [], pass: null, autoTrain: false, board: null, combat: null, log: [] };
}
const ensureStat = (spec, s) => { if (!spec.stats.some((x) => x.id === s.id)) spec.stats.push({ id: s.id, e: s.e, start: 0 }); return spec.stats.find((x) => x.id === s.id); };
const ensureMoney = (spec, m = MONEY.coins) => { if (!spec.money.some((x) => x.id === m.id)) spec.money.push({ id: m.id, e: m.e, start: 0 }); return spec.money.find((x) => x.id === m.id); };
const mainStat = (spec) => spec.stats.find((s) => s.id !== 'Kills') || ensureStat(spec, STATS.force);
const mainMoney = (spec) => spec.money[0] || ensureMoney(spec, spec.genre === 'tycoon' ? MONEY.cash : MONEY.coins);
const uid = (spec, base) => { const b = base.replace(/[^A-Za-z0-9]/g, '') || 'B'; let id = b, i = 2; while (spec.buttons.some((x) => x.id === id)) id = b + i++; return id; };
const COLORS = ['#ff5c5c', '#5aa9ff', '#3dd68c', '#ffb02e', '#b46bff', '#ff7ab6'];
const color = (spec) => COLORS[spec.buttons.length % COLORS.length];

/* ---------- defaults ---------- */
const trainDefault = (spec, act) => ({ stat: mainStat(spec).id, perClick: 1, cooldown: 0.2, tool: true, toolName: act ? act.tool : 'Entraînement' });
const sellDefault = (spec) => ({ from: mainStat(spec).id, to: mainMoney(spec).id, rate: 1, keep: false });
const rebirthDefault = (spec) => ({ costStat: mainStat(spec).id, cost: 1000, growth: 2.5, bonus: 0.5 });
const eggsDefault = (spec) => ({ price: 250, money: mainMoney(spec).id, pets: [{ name: 'Chat', mult: 1.2, w: 50 }, { name: 'Chien', mult: 1.4, w: 30 }, { name: 'Renard', mult: 1.8, w: 14 }, { name: 'Dragon', mult: 3, w: 5 }, { name: 'Licorne', mult: 6, w: 1 }] });
const ITEM_HINT = [[/haltere|dumbbell|poids|weight|canne|pioche|hache|baguette|souris|basket|chaussure|ressort|pomme|burger|pizza/, 'perClick'], [/epee|sword|arme|weapon|baton|hache de guerre|lance|arc/, 'damage'],
  [/armure|bouclier|shield|armor|casque/, 'health'], [/sac|bag|sacoche|backpack/, 'capacity'], [/botte|shoe|boot|jetpack|trottinette/, 'speed'], [/potion|boost|filet|dynamite|grimoire|turbo|gateau|tronconneuse|boisson/, 'mult'],
  [/aimant|magnet/, 'sellMult'], [/couronne|crown|aura/, 'mult']];
const PRICES = [50, 400, 3500, 12000, 60000, 250000, 1e6];
function itemsFrom(list, M) {
  return list.map(([name, e, eff], i) => { const k = norm(name), hint = eff || (ITEM_HINT.find(([re]) => re.test(k)) || [, 'perClick'])[1];
    const value = hint === 'mult' || hint === 'sellMult' ? 2 : hint === 'speed' ? 4 + i * 4 : hint === 'damage' ? 10 * (i + 1) : hint === 'health' ? 50 * (i + 1) : hint === 'capacity' ? 1 + i : [1, 3, 10, 25, 50, 120, 300][i] || 50 * i;
    return { id: (k.replace(/[^a-z0-9]/g, '') || 'item' + i).slice(0, 24), name: cap(name), e: e || '⭐', effect: hint, value, price: PRICES[i] || PRICES[PRICES.length - 1] * (i - 5), money: M }; });
}
function shopFor(spec, names, act) {
  const M = mainMoney(spec).id;
  if (names.length) return { stat: mainStat(spec).id, items: itemsFrom(names.map((n) => [n, /epee|sword/.test(norm(n)) ? '🗡️' : /sac|bag/.test(norm(n)) ? '🎒' : /potion/.test(norm(n)) ? '🧪' : /armure|bouclier/.test(norm(n)) ? '🛡️' : /chaussure|botte/.test(norm(n)) ? '👟' : '⭐']), M) };
  return { stat: mainStat(spec).id, items: itemsFrom((act || ACTS[ACTS.length - 1]).items, M) };
}

/* ---------- buttons ---------- */
const UNIT = (u) => (/^m/.test(u) ? 60 : /^h/.test(u) ? 3600 : 1);
function parseButtonText(rest) {
  rest = rest.replace(/^\s*(de|du|pour|qui|that|to|avec|a)\s+/, ' ').trim().replace(/^(donne|ajoute|gives?|adds?|fait gagner|permet de|pour|qui donne)\s+/, '').replace(/^(acheter|buy|obtenir|gagner|avoir)\s+/, '');
  const b = { cost: null };
  const c = rest.match(/\b(?:qui coute|coutant|coute|pour|contre|cost(?:s|ing)?|for|a)\s+(\d+(?:[.,]\d+)?(?:[km](?![a-z]))?)\s+([a-z]+)/);
  if (c && findMoney(c[2])) { b.cost = { amount: num(c[1]), money: findMoney(c[2]) }; rest = rest.replace(c[0], ' ').trim(); }
  const boost = rest.match(/\b(double|triple|x\s?(\d+)|×\s?(\d+)|multipli\w* (?:par )?(\d+))\b[^]*?\b(?:pendant|durant|for|de)\s+(\d+)\s*(s|sec\w*|min\w*|h\w*)\b/) || rest.match(/\bboost\w*\s+(?:x\s?(\d+)\s+)?(?:de|of)?\s*(\d+)\s*(s|sec\w*|min\w*)/);
  if (boost) { if (boost[0].startsWith('boost')) return { ...b, kind: 'boost', mult: num(boost[1]) || 2, duration: num(boost[2]) * UNIT(boost[3]) };
    const mult = boost[1] === 'double' ? 2 : boost[1] === 'triple' ? 3 : num(boost[2] || boost[3] || boost[4]) || 2; return { ...b, kind: 'boost', mult, duration: num(boost[5]) * UNIT(boost[6]) }; }
  if (/^(vendre|sell|vente|vend)/.test(rest)) return { ...b, kind: 'sell' };
  if (/^(rebirth|renaissance|prestige)/.test(rest)) return { ...b, kind: 'rebirth' };
  if (/^(shop|boutique|magasin)/.test(rest)) return { ...b, kind: 'shop' };
  if (/^(oeuf|egg)/.test(rest)) return { ...b, kind: 'egg' };
  if (/^(teleport|tp|spawn|maison|home|retour)/.test(rest)) return { ...b, kind: 'home' };
  if (/^(cadeau|daily|recompense)/.test(rest)) return { ...b, kind: 'daily' };
  const a = rest.match(/^([+]?\s*\d+(?:[.,]\d+)?(?:[km](?![a-z]))?)\s*(?:de\s+|d\s+|of\s+)?([a-z-]+)?/);
  if (a) return { ...b, kind: 'add', amount: num(a[1].replace(/[+\s]/g, '')) ?? 1, word: a[2] || '' };
  if (/^(entrain|train|clic|click)/.test(rest)) return { ...b, kind: 'train' };
  const w = rest.split(/\s+/).find((x) => x && !STOP.has(x)) || '';
  if (findStat(w) || findMoney(w)) return { ...b, kind: 'add', amount: 1, word: w };
  return null;
}
function parseButtons(t) {
  const out = []; const re = /\b(?:bouton|button|btn)s?\b([^,.;]*)/g; let m;
  while ((m = re.exec(t))) { const parts = m[1].split(/\bet (?:un |une |le |la )?(?:bouton|button)s?\b/); for (const p of parts) { const b = parseButtonText(p); if (b) out.push(b); } }
  const bo = /\b(?:un |le )?boost\w*\b([^,.;]*)/g; while ((m = bo.exec(t))) { if (/\bbouton\b/.test(t.slice(Math.max(0, m.index - 40), m.index))) continue; const b = parseButtonText('boost' + m[1]); if (b && b.kind === 'boost') out.push(b); }
  return out;
}
function addButton(spec, b, done) {
  const S = mainStat(spec), M = mainMoney(spec), costTxt = b.cost ? ` · ${b.cost.amount} ${b.cost.money.e}` : '';
  const once = (action, label, colorHex, extra = {}) => { if (!spec.buttons.some((x) => x.action === action)) { spec.buttons.push({ id: uid(spec, action), label, action, color: colorHex, ...extra }); done.push('bouton ' + label.replace(/^\S+\s/, '')); } };
  switch (b.kind) {
    case 'sell': spec.sell ||= sellDefault(spec); return once('sell', '💰 Vendre', '#3dd68c');
    case 'rebirth': spec.rebirth ||= rebirthDefault(spec); return once('rebirth', '🔁 Rebirth', '#b46bff');
    case 'shop': spec.shop ||= shopFor(spec, []); return once('shop', '🛒 Boutique', '#ffb02e');
    case 'egg': spec.eggs ||= eggsDefault(spec); return once('egg', '🥚 Œufs', '#ff7ab6');
    case 'home': return once('home', '🏠 Spawn', '#5aa9ff');
    case 'daily': spec.daily ||= { amount: 100, money: M.id }; return;
    case 'train': spec.train ||= trainDefault(spec); return once('train', S.e + ' Entraîner', '#ff5c5c');
    case 'boost': { const label = `🚀 Boost ×${b.mult} · ${b.duration >= 60 ? Math.round(b.duration / 60) + ' min' : b.duration + ' s'}${costTxt}`;
      spec.buttons.push({ id: uid(spec, 'Boost' + b.mult), label, action: 'boost', mult: b.mult, duration: b.duration, cooldown: Math.max(b.duration, 5), cost: b.cost ? { amount: b.cost.amount, money: ensureMoney(spec, b.cost.money).id } : null, color: '#ff9f1a' });
      done.push(`bouton boost ×${b.mult} pendant ${b.duration} s${b.cost ? ` (coûte ${b.cost.amount} ${b.cost.money.id})` : ''}`); return; }
    case 'add': {
      let target; const st = findStat(b.word), mo = !st && findMoney(b.word);
      if (mo) target = ensureMoney(spec, mo); else if (st) target = ensureStat(spec, st); else if (b.word && b.word.length > 2 && !STOP.has(b.word)) target = ensureStat(spec, { id: cap(b.word.replace(/s$/, '')), e: '⭐' }); else target = S;
      const amount = b.amount || 1, cost = b.cost ? { amount: b.cost.amount, money: ensureMoney(spec, b.cost.money).id } : null;
      if (spec.buttons.some((x) => x.action === 'add' && x.stat === target.id && x.amount === amount && JSON.stringify(x.cost) === JSON.stringify(cost))) return done.push(`bouton +${amount} ${target.id} (déjà là)`);
      spec.buttons.push({ id: uid(spec, 'Add' + amount + target.id), label: `${target.e} +${amount} ${target.id}${cost ? ` · ${cost.amount} ${b.cost.money.e}` : ''}`, action: 'add', stat: target.id, amount, cooldown: 0.25, cost, color: color(spec) });
      return done.push(`bouton +${amount} ${target.id}${cost ? ` (coûte ${cost.amount} ${cost.money})` : ''}`); }
  }
}

/* give back the words as the user typed them (accents) */
function original(text, n) { const words = String(text).split(/[\s,.;:!?«»"()]+/), want = n.split(/\s+/);
  for (let i = 0; i + want.length <= words.length; i++) if (want.every((w, k) => norm(words[i + k]).replace(/œ/g, 'oe') === w)) return words.slice(i, i + want.length).join(' ');
  return n; }
const findItem = (spec, words) => { if (!spec.shop) return null; const w = norm(words).replace(/^(l |le |la |les |du |de |des )/, '').trim();
  return spec.shop.items.find((i) => norm(i.name) === w) || spec.shop.items.find((i) => norm(i.name).includes(w) || w.includes(norm(i.name))) || null; };

/* ---------- the whole sentence (creation) or an edit ---------- */
export function applyText(text, prev) {
  const t = ' ' + norm(text).replace(/[«»"()!?]/g, ' ').replace(/\s+/g, ' ') + ' ', done = [];
  const EDIT = /^\s*(ajoute|ajouter|rajoute|mets?|met|change|modifie|enleve|enlever|supprime|retire|augmente|baisse|diminue|renomme|appelle|add|set|remove|delete|make|rename|double|fais|fait|je veux|il faut)\b/.test(t);
  const creating = !prev || (!EDIT && /\b(map|carte|jeu|game|simulator|simulateur|tycoon|obby|arene|arena)\b/.test(t));
  const spec = creating ? emptySpec() : JSON.parse(JSON.stringify(prev));
  const removing = /\b(enleve\w*|supprime\w*|retire\w*|remove\w*|delete\w*)\b/.test(t) || /^\s*sans\b/.test(t);
  let act = null, codesFromQuotes = [], shopNames = [];
  if (creating) {
    for (const [g, re] of GENRES) if (re.test(t)) { spec.genre = g; break; }
    for (const [k, re] of THEMES) if (re.test(t)) { spec.theme = k; break; }
    if (/\b(classique|classic|lisse|smooth)\b/.test(t)) spec.voxel = false;
    act = ACTS.find((a) => a.re.test(t)) || null;
    if (act && !/\b(tycoon|obby)\b/.test(t) && spec.genre !== 'arena') spec.genre = 'simulator';
    spec.mapText = text;
  }
  // title: « appelle le jeu « X » » or a quoted name
  { const quoted = [...String(text).matchAll(/[«"“]\s*([^»"”]{2,40}?)\s*[»"”]/g)].map((x) => x[1]), named = /\b(appel\w*|nomm\w*|renomm\w*|titre|nom du jeu|called|named|name)\b/.test(t);
    const q = quoted.length && (named || !FEAT.codes.test(t)) ? [null, quoted[0]] : null; if (FEAT.codes.test(t) && !named) codesFromQuotes = quoted.map((c) => c.toUpperCase().replace(/[^A-Z0-9_]/g, '')).filter((c) => c.length >= 3);
    const n = t.match(/\b(?:appelle|nomme|renomme|call|name)\w*\s+(?:le jeu|mon jeu|the game|it)?\s*([a-z0-9][a-z0-9 ]{1,30})/);
    if (q) { spec.title = q[1]; done.push('titre : ' + q[1]); } else if (n && !q) { spec.title = cap(original(text, n[1].trim())); done.push('titre : ' + spec.title); }
    else if (creating) spec.title = (act ? act.stat.id + ' ' : '') + ({ simulator: 'Simulator', tycoon: 'Tycoon', obby: 'Obby', arena: 'Arène', lobby: 'Aventure', island: 'Île', city: 'Ville', cave: 'Mine', sky: 'Ciel' }[spec.genre] || 'Jeu') + (spec.theme && spec.theme !== 'plaine' ? ' ' + cap(spec.theme) : ''); }

  if (removing) {
    const drop = (a) => (spec.buttons = spec.buttons.filter((b) => b.action !== a));
    const rm = (what, test, fn) => { if (test.test(t)) { if (fn()) done.push('− ' + what); } };
    if (/\b(bouton|button)s?\b/.test(t)) { for (const b of parseButtons(t)) { const n0 = spec.buttons.length;
        spec.buttons = spec.buttons.filter((x) => !(b.kind === 'add' ? x.action === 'add' && (!b.word || norm(x.stat).startsWith(norm(b.word).replace(/s$/, ''))) && (!b.amount || x.amount === b.amount) : x.action === b.kind));
        if (spec.buttons.length < n0) done.push('− bouton'); } }
    else {
      rm('boutique', FEAT.shop, () => { const h = !!spec.shop; spec.shop = null; drop('shop'); return h; }); rm('vente', FEAT.sell, () => { const h = !!spec.sell; spec.sell = null; drop('sell'); return h; });
      rm('rebirth', FEAT.rebirth, () => { const h = !!spec.rebirth; spec.rebirth = null; drop('rebirth'); return h; }); rm('œufs et pets', FEAT.eggs, () => { const h = !!spec.eggs; spec.eggs = null; drop('egg'); return h; });
      rm('zones', FEAT.zones, () => { const h = spec.zones > 0; spec.zones = 0; return h; }); rm('cadeau quotidien', FEAT.daily, () => { const h = !!spec.daily; spec.daily = null; return h; });
      rm('codes', FEAT.codes, () => { const h = spec.codes.length > 0; spec.codes = []; return h; }); rm('gamepass', FEAT.pass, () => { const h = !!spec.pass; spec.pass = null; return h; });
      rm('auto', FEAT.auto, () => { const h = spec.autoTrain; spec.autoTrain = false; return h; }); rm('classement', FEAT.board, () => { const h = !!spec.board; spec.board = null; return h; });
      rm('combat', FEAT.combat, () => { const h = !!spec.combat; spec.combat = null; spec.stats = spec.stats.filter((s) => s.id !== 'Kills'); return h; });
      rm('entraînement', FEAT.train, () => { const h = !!spec.train; spec.train = null; drop('train'); return h; });
    }
    spec.log.push({ text, done }); return { spec, done };
  }

  // ---- stats & money: activity, « collecter des X », named words
  if (act) { ensureStat(spec, act.stat); done.push(`activité : ${act.stat.e} ${act.stat.id} (outil ${act.tool})`); }
  for (const m of t.matchAll(/\b(?:gagner|gagne|collect\w*|recolt\w*|recup\w*|ramass\w*|farm\w*|obtenir|obtient|accumul\w*|earn\w*|gather\w*|attrap\w*|catch\w*|trouv\w*)\s+(?:des |de |du |d |la |le |les |l |plein de |beaucoup de |some |more |the )*([a-z]{3,})/g)) {
    const w = m[1]; if (STOP.has(w)) continue; const mo = findMoney(w), st = findStat(w);
    if (mo) ensureMoney(spec, mo); else if (st) ensureStat(spec, st); else if (!/^(argent|points?|trucs?)$/.test(w)) { ensureStat(spec, { id: cap(original(text, w).replace(/s$/, '')), e: '⭐' }); done.push('stat : ' + cap(w.replace(/s$/, ''))); } }
  for (const w of t.split(/[^a-z0-9-]+/)) { if (!w || STOP.has(w)) continue; const s = findStat(w); if (s && s.id !== 'Kills') ensureStat(spec, s); const m = findMoney(w); if (m) ensureMoney(spec, m); }
  if (spec.genre === 'tycoon') { ensureMoney(spec, MONEY.cash); if (creating) done.push('tycoon : parcelles, droppers, tapis, upgrader, collecteur (Cash)'); }
  if (creating && spec.genre === 'obby') done.push('obby : parcours, pièges, checkpoints, Stage au classement');

  // ---- features
  const S = () => mainStat(spec);
  if ((creating && spec.genre === 'simulator') || FEAT.train.test(t) || act) { if (!spec.train) { spec.train = trainDefault(spec, act); done.push(`entraînement : +1 ${spec.train.stat} par clic (${spec.train.toolName})`); } }
  if (FEAT.sell.test(t)) { if (!spec.sell) { spec.sell = sellDefault(spec); done.push(`vente : ${spec.sell.from} → ${spec.sell.to}`); } addButton(spec, { kind: 'sell' }, []); }
  if (FEAT.shop.test(t)) { const m = t.match(/\b(?:shop|boutique|magasin|store)\b[^,.;]*?\b(?:avec|with|qui vend|vendant|:)\s+([^.;]+)/), names = [];
    if (m) for (const part of m[1].split(/,|\bet\b|\band\b/)) { if (Object.entries(FEAT).some(([k, re]) => k !== 'combat' && k !== 'health' && re.test(' ' + part + ' ')) || /\b(combat|pvp|bouton|button)\b/.test(part)) break; const n = part.replace(/\b(un|une|des|de|du|le|la|les|a|an|the|fonctionnel(le)?s?|working|script|qui marche\w*)\b/g, ' ').replace(/\s+/g, ' ').trim();
      if (n && n.length > 2 && !findStat(n) && !findMoney(n) && !/\d/.test(n) && !Object.entries(FEAT).some(([k, re]) => k !== 'combat' && k !== 'health' && re.test(' ' + n + ' ')) && !/(bouton|button)/.test(n)) { names.push(original(text, n)); shopNames.push(n); } }
    if (!spec.shop || names.length) { spec.shop = shopFor(spec, names, act); done.push(`boutique : ${spec.shop.items.map((i) => i.name).join(', ')}`); } addButton(spec, { kind: 'shop' }, []); }
  if (FEAT.rebirth.test(t) && !/\b(coute|prix|cost)\b/.test(t)) { if (!spec.rebirth) { spec.rebirth = rebirthDefault(spec); done.push('rebirth'); } addButton(spec, { kind: 'rebirth' }, []); }
  if (FEAT.eggs.test(t) && !/\b(coute|prix|cost)\b/.test(t)) { if (!spec.eggs) { spec.eggs = eggsDefault(spec); done.push('œufs et pets (multiplicateurs)'); } }
  { const z = t.match(/\b(\d+|deux|trois|quatre|cinq|six)\s+(zones?|mondes?|worlds?)\b/); if (z) { spec.zones = Math.min(6, Math.max(2, num(z[1]) || 3)); done.push(spec.zones + ' zones à débloquer'); } else if (FEAT.zones.test(t) && !spec.zones) { spec.zones = 3; done.push('3 zones à débloquer'); } }
  if (FEAT.daily.test(t) && !spec.daily) { spec.daily = { amount: 100, money: mainMoney(spec).id }; done.push('cadeau quotidien'); }
  if (FEAT.codes.test(t)) { const cm = [...String(text).matchAll(/codes?\s+[«"]?([A-Za-z0-9_]{3,20})[»"]?/g)].map((x) => x[1].toUpperCase()).filter((c) => !/^(SECRET|PROMO|VIP)$/.test(c) || true).filter((c) => !['QUI', 'POUR', 'AVEC', 'DONNE'].includes(c));
    const list = codesFromQuotes.length ? codesFromQuotes : cm.length ? cm : ['FORGE', 'BIENVENUE']; for (const c of list) if (!spec.codes.some((x) => x.code === c)) spec.codes.push({ code: c, amount: 500, money: mainMoney(spec).id }); done.push('codes : ' + list.join(', ')); }
  if (FEAT.pass.test(t) && !spec.pass) { spec.pass = { mult: 2, price: 99, id: 0 }; done.push('gamepass ×2 (mets son id dans la Config)'); }
  if (FEAT.auto.test(t) && !spec.autoTrain) { spec.autoTrain = true; spec.train ||= trainDefault(spec, act); done.push('auto-entraînement'); }
  if (FEAT.board.test(t) && !spec.board) { spec.board = { stat: (spec.combat ? 'Kills' : S().id), top: 10 }; done.push(`classement des meilleurs (${spec.board.stat})`); }
  let tNoShop = t; for (const n of shopNames) tNoShop = tNoShop.replace(norm(n), ' ');
  if (FEAT.combat.test(tNoShop) && !spec.combat) { spec.combat = { damage: 20, reward: 25, money: mainMoney(spec).id, cooldown: 0.6, range: 7 }; ensureStat(spec, STATS.kills); if (creating && spec.genre === 'simulator' && !act && !FEAT.train.test(t)) spec.genre = 'arena';
    spec.shop ||= { stat: S().id, items: [] }; const extra = itemsFrom([['Épée en fer', '🗡️', 'damage'], ['Épée en or', '🏆', 'damage'], ['Armure', '🛡️', 'health']], mainMoney(spec).id);
    for (const it of extra) if (!spec.shop.items.some((x) => x.id === it.id)) spec.shop.items.push(it); addButton(spec, { kind: 'shop' }, []);
    done.push('combat : épée, dégâts, vie, kills, récompense par kill'); if (spec.board) spec.board.stat = 'Kills'; }
  if (spec.combat && FEAT.health.test(tNoShop)) spec.combat.health = true;

  // ---- settings (numbers): prices, start values, per click, rates
  for (const m of t.matchAll(/\b(?:prix|cout|price|cost)\s+(?:de |du |des |de la |d |l |of |the )*(.+?)\s+(?:passe a|passe de \d+ a|devient|a|=|to|en|sur)\s+(\d+(?:[.,]\d+)?(?:[km](?![a-z]))?)\b/g)) {
    const val = num(m[2]), what = m[1].trim();
    if (/^(l |le |la )?(rebirth|renaissance)/.test(what) && spec.rebirth) { spec.rebirth.cost = val; done.push(`rebirth : ${val} ${spec.rebirth.costStat}`); continue; }
    if (/^(l |le |la |les )?(oeufs?|eggs?)/.test(what) && spec.eggs) { spec.eggs.price = val; done.push(`œuf : ${val} ${spec.eggs.money}`); continue; }
    const it = findItem(spec, what); if (it) { it.price = val; done.push(`prix : ${it.name} = ${val} ${it.money}`); } }
  for (const m of t.matchAll(/\b(?:l |le |la |un |une )?([a-z ]{3,30}?)\s+(?:coute|coutera|costs?)\s+(\d+(?:[.,]\d+)?(?:[km](?![a-z]))?)\b/g)) {
    const what = m[1].trim(), val = num(m[2]); if (/\b(bouton|button)\b/.test(what)) continue;
    if (/(rebirth|renaissance)$/.test(what) && spec.rebirth) { spec.rebirth.cost = val; done.push(`rebirth : ${val} ${spec.rebirth.costStat}`); }
    else if (/(oeufs?|eggs?)$/.test(what) && spec.eggs) { spec.eggs.price = val; done.push(`œuf : ${val} ${spec.eggs.money}`); }
    else { const it = findItem(spec, what); if (it) { it.price = val; done.push(`prix : ${it.name} = ${val} ${it.money}`); } } }
  const setStart = (w, v) => { const s = findStat(w), mo = findMoney(w); const tgt = s ? ensureStat(spec, s) : mo ? ensureMoney(spec, mo) : spec.stats.find((x) => norm(x.id) === norm(w).replace(/s$/, '')) || spec.money.find((x) => norm(x.id) === norm(w));
    if (tgt) { tgt.start = v; done.push(`départ : ${v} ${tgt.id}`); } };
  for (const m of t.matchAll(/\b([a-z]+)\s+de\s+depart\s+(?:a|=|de|:)?\s*(\d+(?:[.,]\d+)?(?:[km](?![a-z]))?)/g)) setStart(m[1], num(m[2]));
  for (const m of t.matchAll(/\b(?:commence\w*|start\w*|debut\w*)\s+(?:avec|with|a|at)\s+(\d+(?:[.,]\d+)?(?:[km](?![a-z]))?)\s+([a-z]+)/g)) setStart(m[2], num(m[1]));
  for (const m of t.matchAll(/\b(\d+(?:[.,]\d+)?(?:[km](?![a-z]))?)\s+([a-z]+)\s+(?:au|de) (?:depart|debut)\b/g)) setStart(m[2], num(m[1]));
  { const m = t.match(/\+?\s*(\d+)\s*(?:[a-z]+\s+)?(?:par|per)\s+(?:clic|click|coup|tap)/); if (m && !/\bbouton\b/.test(t)) { spec.train ||= trainDefault(spec, act); spec.train.perClick = num(m[1]); done.push(`+${spec.train.perClick} ${spec.train.stat} par clic`); } }
  { const m = t.match(/\bvente\s+(?:rapporte\s+|x|×)\s*(?:x|×)?\s*(\d+)/) || t.match(/\bvend\w*\s+(?:x|×)\s*(\d+)/); if (m && spec.sell) { spec.sell.rate = num(m[1]); done.push(`vente ×${spec.sell.rate}`); } }

  // ---- buttons (also « un boost x2 de 60 s »)
  for (const b of parseButtons(t)) addButton(spec, b, done);

  // ---- a simulator always has its core loop
  if (spec.genre === 'simulator') { mainStat(spec); mainMoney(spec); spec.train ||= trainDefault(spec, act); if (!spec.buttons.some((b) => b.action === 'train')) addButton(spec, { kind: 'train' }, []); }
  if (!spec.stats.length && !spec.money.length) mainMoney(spec);
  if (!done.length) done.push(creating ? 'carte ' + spec.genre + ' jouable' : '(rien compris)');
  spec.log.push({ text, done }); return { spec, done };
}

/** spec → Luau config (ReplicatedStorage.ForgeGame.Config) */
export function toLua(v, ind = '') {
  if (v === null || v === undefined) return 'nil';
  if (typeof v === 'boolean') return String(v); if (typeof v === 'number') return String(+v.toFixed(6));
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return v.length ? '{\n' + v.map((x) => ind + '\t' + toLua(x, ind + '\t')).join(',\n') + '\n' + ind + '}' : '{}';
  const e = Object.entries(v).filter(([, x]) => x !== undefined && x !== null); if (!e.length) return '{}';
  return '{\n' + e.map(([k, x]) => `${ind}\t${/^[A-Za-z_]\w*$/.test(k) ? k : '[' + JSON.stringify(k) + ']'} = ${toLua(x, ind + '\t')}`).join(',\n') + '\n' + ind + '}';
}
export function configOf(spec) {
  const c = { title: spec.title, stats: spec.stats, money: spec.money, train: spec.train, buttons: spec.buttons, sell: spec.sell, shop: spec.shop && spec.shop.items.length ? spec.shop : null, rebirth: spec.rebirth, eggs: spec.eggs,
    zones: spec.zones, daily: spec.daily, codes: spec.codes, pass: spec.pass, autoTrain: spec.autoTrain, board: spec.board, combat: spec.combat,
    datastore: 'ForgeGame_' + (norm(spec.title || 'Game').replace(/[^a-z0-9]/g, '').slice(0, 30) || 'game') + '_v1' };
  return '-- Roblox Forge « Créer tout » : configuration du jeu (modifiable)\nreturn ' + toLua(c) + '\n';
}
