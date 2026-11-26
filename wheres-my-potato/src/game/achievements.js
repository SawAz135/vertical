import { VARIETIES } from '../world/potatoes.js';
import { ITEMS } from '../world/shop.js';
import { audio } from '../audio/audio.js';

// =====================================================================================
// ACHIEVEMENTS + SPUD-O-PEDIA (collection of varieties and special potatoes)
// State lives in game.stats (saved): stats.ach = {id: timestamp}, stats.seen = {key: count}
// =====================================================================================
export const SPECIALS = [
  { key: 's1', name: 'Patate à visage', icon: '🙂', desc: 'Deux yeux, une bouche. Elle te regarde.' },
  { key: 's2', name: 'Patate cœur', icon: '❤️', desc: 'Gérard dit qu’elle porte bonheur.' },
  { key: 's3', name: 'Patate jumelle', icon: '♊', desc: 'Deux patates, un seul tubercule.' },
];
const maxed = g => ITEMS.every(it => g.level(it.id) === it.levels.length - 1);
export const ACH = [
  { id: 'first', icon: '🥔', name: 'Première récolte', desc: 'Ramasser ta première patate.', test: g => g.stats.picked >= 1 },
  { id: 'p100', icon: '🧺', name: 'Bon début', desc: 'Ramasser 100 patates.', test: g => g.stats.picked >= 100 },
  { id: 'p1000', icon: '🚜', name: 'Récolteur pro', desc: 'Ramasser 1 000 patates.', test: g => g.stats.picked >= 1000 },
  { id: 'p10000', icon: '🏆', name: 'Légende du canton', desc: 'Ramasser 10 000 patates.', test: g => g.stats.picked >= 10000 },
  { id: 'bucket', icon: '🪣', name: 'Le seau, c’est la vie', desc: 'Acheter ton premier seau.', test: g => g.level('bucket') >= 1 },
  { id: 'benne', icon: '🏗️', name: 'Poids lourd', desc: 'Obtenir la benne à bras.', test: g => g.level('bucket') >= 4 },
  { id: 'rocket', icon: '🚀', name: 'Décollage', desc: 'Installer le moteur de fusée.', test: g => g.level('motor') >= 4 },
  { id: 'allmax', icon: '👑', name: 'Tout au maximum', desc: 'Toutes les améliorations au niveau max.', test: maxed },
  { id: 'gold', icon: '✨', name: 'Ruée vers l’or', desc: 'Trouver une patate dorée.', test: g => g.stats.gold >= 1 },
  { id: 'gold10', icon: '💰', name: 'Chercheur d’or', desc: 'Trouver 10 patates dorées.', test: g => g.stats.gold >= 10 },
  { id: 'specials', icon: '🔍', name: 'Collectionneur', desc: 'Trouver les 3 patates spéciales.', test: g => SPECIALS.every(s => g.stats.seen?.[s.key]) },
  { id: 'varieties', icon: '🌈', name: 'Arc-en-ciel', desc: 'Récolter toutes les variétés.', test: g => VARIETIES.every(v => g.stats.seen?.[v.id]) },
  { id: 'j1000', icon: '🫙', name: 'Bocal bien rempli', desc: '1 000 patates dans le bocal.', test: g => g.stats.jar >= 1000 },
  { id: 'overflow', icon: '🌊', name: 'Ça déborde !', desc: 'Faire déborder le bocal.', test: g => g.overflowed },
  { id: 'kick', icon: '🦶', name: 'Bain de patates', desc: 'Marcher dans le tas qui déborde.', test: g => g.stats.kicked >= 20 },
  { id: 'throw', icon: '🤾', name: 'Lanceur fou', desc: 'Lancer 50 patates en l’air.', test: g => g.stats.thrown >= 50 },
  { id: 'rich', icon: '💶', name: 'Millionnaire… presque', desc: 'Gagner 10 000 ₣ au total.', test: g => g.stats.earned >= 10000 },
  { id: 'sale', icon: '⭐', name: 'La Grande Vente', desc: 'Vendre tout le bocal à la friterie.', test: g => (g.stats.prestige || 0) >= 1 },
];

export class Achievements {
  constructor(game) { this.g = game; this.t = 0; }
  seen(key) { const s = this.g.stats; s.seen = s.seen || {}; const first = !s.seen[key]; s.seen[key] = (s.seen[key] || 0) + 1; return first; }
  // record a picked potato in the collection
  collect(variety, special) {
    const v = VARIETIES[variety];
    if (this.seen(v.id) && this.g.state === 'play') this.g.ui.toast(`📗 Nouvelle variété : ${v.name.fr}`);
    if (special) { const sp = SPECIALS[special - 1]; if (this.seen(sp.key)) { this.g.ui.toast(`${sp.icon} ${sp.name} trouvée !`, 'gold'); this.g.say(`Une ${sp.name.toLowerCase()} ?! Garde-la précieusement… enfin, vends-la.`, 'cheer', true); } }
  }
  update(dt) {
    this.t -= dt; if (this.t > 0) return; this.t = 0.5;
    const g = this.g, st = g.stats; st.ach = st.ach || {};
    for (const a of ACH) if (!st.ach[a.id] && a.test(g)) {
      st.ach[a.id] = Date.now();
      g.ui.achievement(a); audio.ui('fanfare'); g._save();
    }
  }
  count() { return Object.keys(this.g.stats.ach || {}).length; }
  panelHtml() {
    const g = this.g, st = g.stats, seen = st.seen || {};
    const ach = ACH.map(a => { const on = st.ach?.[a.id]; return `<div class="ach ${on ? 'on' : ''}"><div class="ach-i">${on ? a.icon : '🔒'}</div><div><b>${a.name}</b><span>${a.desc}</span></div></div>`; }).join('');
    const col = [...VARIETIES.map(v => ({ k: v.id, n: v.name.fr, c: `rgb(${v.col.map(x => Math.round(x * 255)).join(',')})`, p: v.price })), ...SPECIALS.map(s => ({ k: s.key, n: s.name, icon: s.icon }))]
      .map(c => { const n = seen[c.k] || 0; return `<div class="col ${n ? 'on' : ''}"><div class="col-spud" style="${c.c ? `--c:${c.c}` : ''}">${c.icon && n ? c.icon : ''}</div><b>${n ? c.n : '???'}</b><span>${n ? `× ${n.toLocaleString('fr-FR')}` : 'pas encore trouvée'}${c.p && n ? ` · ${c.p} ₣` : ''}</span></div>`; }).join('');
    return `<div class="set-sec">Succès · ${this.count()} / ${ACH.length}</div><div class="ach-grid">${ach}</div><div class="set-sec">Patatothèque</div><div class="col-grid">${col}</div>`;
  }
}
