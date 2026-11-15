/* =====================================================================
   Roblox Forge « Créer tout » : spec → map + Roblox Push pack.
   The map comes from the Map Studio generator (voxel or classic), plus game
   pads around the spawn (Vendre, Boutique, Œufs, Rebirth, Entraînement) that
   ForgeGame.server.lua wires up. The pack holds the config, the game scripts,
   the map scripts (coins, gates…), lighting and the voxel cube look.
   ===================================================================== */
import * as MC from '../map/map-core.js';
import * as MM from '../map/map-models.js';
import { configOf } from './game-spec.js';

const M = (c, m = 'SmoothPlastic') => ({ c, m });
const safe = (s) => (String(s || 'Jeu').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '') || 'Jeu').slice(0, 40);
const PADS = { Sell: ['💰 VENDRE', '#3dd68c'], Shop: ['🛒 BOUTIQUE', '#ffb02e'], Egg: ['🥚 ŒUFS', '#ff7ab6'], Rebirth: ['🔁 REBIRTH', '#b46bff'], Train: ['💪 ENTRAÎNEMENT', '#ff5c5c'] };

/** the game pads (Vendre, Boutique, Œufs, Rebirth, Entraînement) in an arc in front of the spawn */
export function padsFor(spec, nodes) {
  let spawn = null; const find = (n) => { if (spawn) return; if (n.cls === 'SpawnLocation') spawn = n; (n.children || []).forEach(find); }; nodes.forEach(find);
  const sx = spawn ? spawn.pos[0] : 0, sz = spawn ? spawn.pos[2] : 0, sy = spawn ? spawn.pos[1] - spawn.size[1] / 2 : 0.5;
  const want = [spec.sell && 'Sell', spec.shop && 'Shop', spec.eggs && 'Egg', spec.rebirth && 'Rebirth', spec.train && 'Train'].filter(Boolean);
  return MC.model('GamePads', want.map((zone, i) => {
    const n = want.length, a = n === 1 ? Math.PI * 1.5 : Math.PI * (1.12 + 0.76 * i / (n - 1)), R = 22, x = +(sx + Math.cos(a) * R).toFixed(2), z = +(sz + Math.sin(a) * R).toFixed(2), [txt, col] = PADS[zone];
    return MC.model(zone + 'Pad', [
      MC.block('Base', [11, 0.6, 11], [x, sy + 0.3, z], M('#2b2b33'), { vox: 0.5 }),
      MC.block('Pad', [9, 0.6, 9], [x, sy + 0.8, z], M(col, 'Neon'), { attrs: { ForgeGameZone: zone } }),
      MC.block('Post', [1, 7, 1], [x, sy + 4.1, z + 5], M('#3a3a46'), { vox: 0.5 }),
      MC.block('Sign', [10, 3, 0.6], [x, sy + 8.4, z + 5], M(col), { label: txt, vox: 0.5, canCollide: false }),
    ]);
  }));
}
export function buildMap(spec, seed = 7) {
  const text = spec.mapText || `${spec.genre} ${spec.theme}`;
  const g = MM.generateFromText(text, seed, { voxel: spec.voxel !== false, gen: spec.genre, theme: spec.theme, opts: spec.zones && spec.genre === 'simulator' ? { zones: Math.max(2, spec.zones) } : undefined });
  const pads = padsFor(spec, g.children);
  const name = safe(spec.title);
  const root = { id: 'root', cls: 'Folder', name, children: [...g.children, pads] };
  return { v: 1, name, theme: g.theme, lighting: { preset: g.light, over: {} }, gen: { id: g.gen, seed, opts: g.opts, text }, root };
}

/* tiny zip (stored, no compression) */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
async function deflate(u8) { // raw DEFLATE with the browser's CompressionStream (Safari 16.4+, Chrome, Firefox)
  const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); w.write(u8); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer()); }
/** zip; text files are DEFLATE-compressed when the browser can (a voxel map JSON shrinks ~10×) */
export async function zip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.path), raw = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(raw);
    let data = raw, method = 0;
    if (typeof CompressionStream !== 'undefined' && raw.length > 2048 && !/\.png$/i.test(f.path)) { try { const z = await deflate(raw); if (z.length < raw.length * 0.9) { data = z; method = 8; } } catch {} }
    const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, raw.length, true); lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, raw.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name); off += 30 + name.length + data.length;
  }
  const csize = central.reduce((s, a) => s + a.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
const kitCache = {};
const kit = async (url) => (kitCache[url] ||= await (await fetch(url, { cache: 'no-cache' })).text());

/** every file of the Roblox Push pack */
export async function packFiles(spec, map) {
  const L = MC.lightingModels(map), hasVox = (n) => n.vox || (n.children || []).some(hasVox);
  const look = spec.voxel !== false && hasVox(map.root) ? await (await import('../studio/voxel-look.js')).voxelLookFiles('../studio/') : [];
  const lines = [];
  lines.push(`Pack Roblox Forge « Créer tout » : ${spec.title}`, '', 'Ce que contient le jeu :');
  for (const l of describe(spec)) lines.push('- ' + l);
  lines.push('', 'Fichiers :', '- ReplicatedStorage/ForgeGame/Config : toute la configuration (modifiable)', '- ServerScriptService/ForgeGame : le moteur du jeu (sauvegarde, vente, boutique, rebirth…)',
    '- StarterPlayerScripts/ForgeGame : l’interface (compteurs, boutons, boutique…)', `- Workspace/${map.name} : la carte, avec les plateformes du jeu près du spawn`, '- Lighting : l’ambiance', '',
    'Publie ce .zip avec Roblox Push (« Ajouter à mon jeu »).');
  return [
    { path: 'ReplicatedStorage/ForgeGame/Config.lua', data: configOf(spec) },
    { path: 'ServerScriptService/ForgeGame.server.lua', data: await kit('kit/ForgeGame.server.lua') },
    { path: 'StarterPlayerScripts/ForgeGame.client.lua', data: await kit('kit/ForgeGame.client.lua') },
    { path: `Workspace/${map.name}.model.json`, data: JSON.stringify(MC.mapModel(map)) },
    ...Object.entries(L).map(([n, v]) => ({ path: `Lighting/${n}.model.json`, data: JSON.stringify(v, null, 1) })),
    { path: 'ServerScriptService/ForgeMap.server.lua', data: await kit('../map/kit/ForgeMap.server.lua') },
    { path: 'StarterPlayerScripts/ForgeMap.client.lua', data: await kit('../map/kit/ForgeMap.client.lua') },
    ...look,
    { path: 'LISEZ-MOI.txt', data: lines.join('\n') + '\n' },
  ];
}
export async function buildPack(spec, map) { return await zip(await packFiles(spec, map)); }

/** human summary of the spec (shown in the app and in LISEZ-MOI) */
export function describe(spec) {
  const out = [], S = spec.stats.map((s) => s.e + ' ' + s.id).join(', '), Mo = spec.money.map((m) => m.e + ' ' + m.id).join(', ');
  out.push(`Type : ${spec.genre}, thème ${spec.theme}, carte ${spec.voxel === false ? 'classique' : 'voxel'}`);
  if (S) out.push('Stats : ' + S); if (Mo) out.push('Argent : ' + Mo);
  if (spec.train) out.push(`Entraînement : +${spec.train.perClick} ${spec.train.stat} par clic (outil, bouton, touche E)`);
  if (spec.buttons.length) out.push('Boutons : ' + spec.buttons.map((b) => b.label).join(' · '));
  if (spec.sell) out.push(`Vente : ${spec.sell.from} → ${spec.sell.to} (plateforme + bouton, touche Q)`);
  if (spec.shop) out.push('Boutique : ' + spec.shop.items.map((i) => `${i.name} (${i.price} ${i.money})`).join(', '));
  if (spec.rebirth) out.push(`Rebirth : dès ${spec.rebirth.cost} ${spec.rebirth.costStat}, gains +${Math.round(spec.rebirth.bonus * 100)} % par rebirth`);
  if (spec.eggs) out.push(`Œufs : ${spec.eggs.price} ${spec.eggs.money}, pets ×${spec.eggs.pets.map((p) => p.mult).join('/×')}`);
  if (spec.zones) out.push(spec.zones + ' zones à débloquer');
  if (spec.daily) out.push(`Cadeau quotidien : ${spec.daily.amount} ${spec.daily.money}`);
  if (spec.codes.length) out.push('Codes : ' + spec.codes.map((c) => c.code).join(', '));
  if (spec.pass) out.push(`Gamepass ×${spec.pass.mult} (mets son id dans Config.pass.id)`);
  if (spec.autoTrain) out.push('Auto-entraînement');
  out.push('Sauvegarde automatique (DataStore, anti-duplication)');
  return out;
}
