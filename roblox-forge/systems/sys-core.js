/* =====================================================================
   Roblox Forge - Systems core (JavaScript twin of kit/ForgeLogic.lua).
   Same rules, same inputs -> same outputs: the studio's odds, Monte Carlo
   simulation and hatch preview behave exactly like the game.
   ===================================================================== */
export const PERKS = { luck2x: '🍀 Chance ×2', coins2x: '💰 Pièces ×2', equip: '🐾 +2 pets équipés', storage: '🎒 +100 places', triple: '🥚 Ouvrir ×3', auto: '⚡ Ouverture auto' };
export const QUEST_TYPES = { hatch: '🥚 Ouvrir des œufs', collect: '🪙 Gagner la monnaie principale', rebirth: '♻️ Faire des rebirths', playtime: '⏱️ Minutes de jeu' };

export function defaultConfig() {
  return {
    v: 1, name: 'ForgeSystems', datastore: 'ForgeSystems_v1',
    currencies: [{ name: 'Coins', start: 0, leaderstat: true }, { name: 'Gems', start: 5, leaderstat: true }],
    main: 'Coins',
    rarities: [
      { name: 'Commun', color: '#b8b8c8', lucky: false, sell: 5 }, { name: 'Peu commun', color: '#5ee37a', lucky: false, sell: 15 },
      { name: 'Rare', color: '#3ea0ff', lucky: false, sell: 50 }, { name: 'Épique', color: '#b05cff', lucky: true, sell: 200 },
      { name: 'Légendaire', color: '#ffb300', lucky: true, sell: 1000 }, { name: 'Mythique', color: '#ff3d6e', lucky: true, sell: 6000 },
      { name: 'Secret', color: '#00ffd0', lucky: true, sell: 50000 }],
    pets: [
      { id: 'chat', name: 'Chat', emoji: '🐱', rarity: 'Commun', power: 5 }, { id: 'chien', name: 'Chien', emoji: '🐶', rarity: 'Commun', power: 6 },
      { id: 'lapin', name: 'Lapin', emoji: '🐰', rarity: 'Peu commun', power: 10 }, { id: 'renard', name: 'Renard', emoji: '🦊', rarity: 'Peu commun', power: 12 },
      { id: 'panda', name: 'Panda', emoji: '🐼', rarity: 'Rare', power: 25 }, { id: 'tigre', name: 'Tigre', emoji: '🐯', rarity: 'Rare', power: 30 },
      { id: 'licorne', name: 'Licorne', emoji: '🦄', rarity: 'Épique', power: 60 }, { id: 'hibou', name: 'Hibou', emoji: '🦉', rarity: 'Épique', power: 55 },
      { id: 'dragon', name: 'Dragon', emoji: '🐉', rarity: 'Légendaire', power: 150 }, { id: 'phenix', name: 'Phénix', emoji: '🐦‍🔥', rarity: 'Légendaire', power: 170 },
      { id: 'kraken', name: 'Kraken', emoji: '🐙', rarity: 'Mythique', power: 400 }, { id: 'robot', name: 'Méca', emoji: '🤖', rarity: 'Mythique', power: 380 },
      { id: 'esprit', name: 'Esprit', emoji: '👻', rarity: 'Secret', power: 1500 }, { id: 'cosmos', name: 'Cosmos', emoji: '🌌', rarity: 'Secret', power: 2500 }],
    eggs: [
      { id: 'basic', name: 'Œuf Basique', emoji: '🥚', price: 100, currency: 'Coins', color: '#f2e6c9', pos: [-18, 22], pity: { after: 0, tier: 4 },
        entries: [{ pet: 'chat', weight: 40 }, { pet: 'chien', weight: 30 }, { pet: 'lapin', weight: 18 }, { pet: 'renard', weight: 9 }, { pet: 'panda', weight: 2.5 }, { pet: 'licorne', weight: 0.5 }] },
      { id: 'gold', name: 'Œuf Doré', emoji: '🌟', price: 2500, currency: 'Coins', color: '#ffd34d', pos: [0, 22], pity: { after: 60, tier: 4 },
        entries: [{ pet: 'lapin', weight: 35 }, { pet: 'renard', weight: 30 }, { pet: 'panda', weight: 18 }, { pet: 'tigre', weight: 12 }, { pet: 'licorne', weight: 3.5 }, { pet: 'hibou', weight: 1.2 }, { pet: 'dragon', weight: 0.3 }] },
      { id: 'cosmic', name: 'Œuf Cosmique', emoji: '🌌', price: 25, currency: 'Gems', color: '#7c5cff', pos: [18, 22], pity: { after: 100, tier: 6 },
        entries: [{ pet: 'tigre', weight: 50 }, { pet: 'licorne', weight: 30 }, { pet: 'dragon', weight: 14 }, { pet: 'phenix', weight: 5 }, { pet: 'kraken', weight: 0.8 }, { pet: 'robot', weight: 0.19 }, { pet: 'esprit', weight: 0.009 }, { pet: 'cosmos', weight: 0.001 }] }],
    rebirth: { base: 10000, growth: 2.5, step: 0.5, currency: 'Coins', reward: { currency: 'Gems', amount: 10 } },
    inventory: { max: 60, equip: 3 },
    daily: [{ currency: 'Coins', amount: 250 }, { currency: 'Coins', amount: 600 }, { currency: 'Gems', amount: 5 }, { currency: 'Coins', amount: 2000 }, { currency: 'Gems', amount: 10 }, { currency: 'Coins', amount: 8000 }, { currency: 'Gems', amount: 50 }],
    quests: [{ id: 'q1', name: 'Ouvre 20 œufs', type: 'hatch', target: 20, currency: 'Coins', amount: 1500 }, { id: 'q2', name: 'Gagne 50K pièces', type: 'collect', target: 50000, currency: 'Gems', amount: 15 },
      { id: 'q3', name: 'Joue 30 minutes', type: 'playtime', target: 30, currency: 'Gems', amount: 10 }, { id: 'q4', name: 'Fais 1 rebirth', type: 'rebirth', target: 1, currency: 'Gems', amount: 25 }],
    codes: [{ code: 'FORGE', currency: 'Gems', amount: 25, expires: 0 }, { code: 'BEYOND1B', currency: 'Coins', amount: 5000, expires: 0 }],
    gamepasses: [{ id: 0, name: 'Chance ×2', perk: 'luck2x' }, { id: 0, name: 'Pièces ×2', perk: 'coins2x' }, { id: 0, name: '+2 Pets', perk: 'equip' }, { id: 0, name: 'Ouvrir ×3', perk: 'triple' }],
    products: [{ id: 0, name: '100 Gems', currency: 'Gems', amount: 100 }, { id: 0, name: '50K Coins', currency: 'Coins', amount: 50000 }],
    income: { amount: 5, every: 1 },
    hatchRange: 22,
    leaderboard: { enabled: true, stat: 'Coins', pos: [0, 40] },
    autosave: 60,
  };
}

/* ---------- pure logic: identical to ForgeLogic.lua ---------- */
export const tierOf = (cfg, name) => { const i = cfg.rarities.findIndex((r) => r.name === name); return i < 0 ? 1 : i + 1; };
export const petById = (cfg, id) => cfg.pets.find((p) => p.id === id) || null;
export const eggById = (cfg, id) => cfg.eggs.find((e) => e.id === id) || null;
export function eggOdds(cfg, egg, luck = 1, minTier) {
  const list = []; let total = 0;
  for (const e of egg.entries) { const pet = petById(cfg, e.pet); if (!pet || !(e.weight > 0)) continue; const tier = tierOf(cfg, pet.rarity);
    if (minTier && tier < minTier) continue; const rar = cfg.rarities[tier - 1], w = e.weight * (rar && rar.lucky ? luck : 1); list.push({ pet: pet.id, w, tier }); total += w; }
  for (const o of list) o.p = total > 0 ? o.w / total : 0;
  return list;
}
export function pick(odds, r) { let acc = 0; for (const o of odds) { acc += o.p; if (r < acc) return o; } return odds[odds.length - 1]; }
export function hatch(cfg, egg, luck, pityCount, r) {
  const pity = egg.pity; let forced = false, odds = eggOdds(cfg, egg, luck);
  if (pity && pity.after > 0 && (pityCount || 0) + 1 >= pity.after) { const high = eggOdds(cfg, egg, luck, pity.tier); if (high.length) { odds = high; forced = true; } }
  const o = pick(odds, r); let next = (pityCount || 0) + 1; if (pity && o.tier >= (pity.tier ?? Infinity)) next = 0;
  return { pet: o.pet, pity: next, forced };
}
export const rebirthCost = (cfg, n) => Math.floor(cfg.rebirth.base * cfg.rebirth.growth ** n + 0.5);
export const abbreviate = (n) => { const u = [[1e15, 'Qa'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']].find(([v]) => Math.abs(n) >= v); if (!u) return String(Math.floor(n)); const x = n / u[0]; return (x >= 100 ? x.toFixed(0) : x.toFixed(1)).replace(/\.0$/, '') + u[1]; };
export const oneIn = (p) => (p > 0 ? abbreviate(Math.max(1, Math.round(1 / p))) : '∞');

/* ---------- Monte Carlo: real draws with the same hatch() and pity as the server ---------- */
export function rngFrom(seed) { let a = seed >>> 0 || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function simulate(cfg, egg, luck, n, seed = 1) {
  const r = rngFrom(seed), counts = {}, firstAt = {}; let pity = 0, forced = 0;
  for (let i = 1; i <= n; i++) { const h = hatch(cfg, egg, luck, pity, r()); pity = h.pity; if (h.forced) forced++; counts[h.pet] = (counts[h.pet] || 0) + 1; if (!firstAt[h.pet]) firstAt[h.pet] = i; }
  return { counts, firstAt, forced, n };
}

/* ---------- Luau export of the config ---------- */
const r4 = (v) => +(+v).toFixed(6) || 0;
export function lua(v, ind = '') {
  if (v === null || v === undefined) return 'nil';
  if (typeof v === 'number') return String(r4(v));
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return JSON.stringify(v.replace(/[\u0000-\u001f]/g, ''));
  const key = (k) => (/^[A-Za-z_]\w*$/.test(k) && !/^(and|break|do|else|elseif|end|false|for|function|if|in|local|nil|not|or|repeat|return|then|true|until|while|continue)$/.test(k) ? k : `[${JSON.stringify(k)}]`);
  const items = Array.isArray(v) ? v.map((x) => lua(x, ind + '\t')) : Object.entries(v).filter(([, x]) => x !== null && x !== undefined).map(([k, x]) => `${key(k)} = ${lua(x, ind + '\t')}`);
  if (!items.length) return '{}';
  const one = `{ ${items.join(', ')} }`; if (one.length <= 110 && !one.includes('\n')) return one;
  return `{\n${items.map((s) => ind + '\t' + s).join(',\n')},\n${ind}}`;
}
export function configLua(cfg) {
  return `--[[\n\tRoblox Forge - systems configuration (generated by Forge Systems Studio).\n\tEdit it in the studio, or here: the server reads it at start.\n]]\nreturn ${lua(cfg)}\n`;
}
/* ---------- validation (shown in the editor before export) ---------- */
export function validate(cfg) {
  const issues = [], cur = new Set(cfg.currencies.map((c) => c.name)), ids = new Set();
  for (const p of cfg.pets) { if (ids.has(p.id)) issues.push(`Pet en double : ${p.id}`); ids.add(p.id); if (!cfg.rarities.some((r) => r.name === p.rarity)) issues.push(`${p.name} : rareté inconnue`); }
  for (const e of cfg.eggs) { if (!cur.has(e.currency)) issues.push(`${e.name} : monnaie ${e.currency} inconnue`); if (!e.entries.some((x) => ids.has(x.pet) && x.weight > 0)) issues.push(`${e.name} : aucun pet`);
    for (const x of e.entries) if (!ids.has(x.pet)) issues.push(`${e.name} : pet ${x.pet} inconnu`); }
  for (const list of [cfg.daily, cfg.quests, cfg.codes, cfg.products]) for (const x of list) if (x.currency && !cur.has(x.currency)) issues.push(`Monnaie ${x.currency} inconnue`);
  if (!cur.has(cfg.main)) issues.push('Monnaie principale inconnue');
  return issues;
}
