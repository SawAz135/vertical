/* =====================================================================
   Roblox Forge - shared app shell.
   Replaces the row of emoji shortcuts in every studio with a proper
   navigator: a « ☰ Forge » button + drawer on iPhone, a labelled icon rail on
   PC / iPad landscape. ⌘K / Ctrl+K opens it, Esc closes, 1–8 jump to an app.
   ===================================================================== */
const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  create: I('<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.5L12 15l-1.8-4.5L5.5 9l4.7-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/><path d="M5 16l.6 1.4L7 18l-1.4.6L5 20l-.6-1.4L3 18l1.4-.6z"/>'),
  pets: I('<circle cx="6" cy="9" r="2"/><circle cx="10" cy="5.5" r="2"/><circle cx="14.5" cy="5.5" r="2"/><circle cx="18.5" cy="9" r="2"/><path d="M8 17c0-3 2-5.5 4.2-5.5S16.5 14 16.5 17c0 2-1.6 2.6-4.2 2.6S8 19 8 17z"/>'),
  maps: I('<path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5z"/><path d="M9 4v13M15 6.5v13"/>'),
  gui: I('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18"/><rect x="6" y="12" width="5" height="5" rx="1"/><path d="M14 13h4M14 16h3"/>'),
  systems: I('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M4.2 7.5l2.2 1.3M17.6 15.2l2.2 1.3M4.2 16.5l2.2-1.3M17.6 8.8l2.2-1.3"/><circle cx="12" cy="12" r="7.2"/>'),
  library: I('<path d="M4 4.5h4.5v15H4zM10.5 4.5H15v15h-4.5z"/><path d="M17 5.2l3.4-.9 3 14.4-3.4.9z" transform="translate(-2.5 0)"/>'),
  skills: I('<path d="M2.5 9L12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-5"/><path d="M21.5 9v5"/>'),
  push: I('<path d="M12 15V3.5"/><path d="M7.5 8L12 3.5 16.5 8"/><path d="M4 14.5v3.5a2.5 2.5 0 002.5 2.5h11a2.5 2.5 0 002.5-2.5v-3.5"/>'),
  play: I('<rect x="3" y="6" width="18" height="12" rx="4"/><path d="M7.5 10v4M5.5 12h4"/><circle cx="15.5" cy="11" r="1"/><circle cx="17.5" cy="13.5" r="1"/>'),
  menu: I('<path d="M4 7h16M4 12h16M4 17h10"/>'),
};
const base = location.pathname.replace(/[^/]*$/, ''), up = /\/roblox-forge\/[^/]+\/$/.test(base) ? '../' : '../';
const APPS = [
  { id: 'create', href: up + 'create/', name: 'Créer tout', desc: 'Une phrase → jeu complet : carte, scripts, GUI', c: '#ffd45c' },
  { id: 'play', href: up + 'play/', name: 'Jouer', desc: 'Joue à tes jeux dans le navigateur, comme dans Roblox', c: '#00b06f' },
  { id: 'studio', icon: 'pets', href: up + 'studio/', name: 'Pets', desc: 'Pets voxel, simulateur, IA 3D, animations', c: '#ff8ad8' },
  { id: 'map', icon: 'maps', href: up + 'map/', name: 'Cartes', desc: 'Cartes voxel complètes, obby, tycoon, simulator', c: '#3dffa8' },
  { id: 'gui', href: up + 'gui/', name: 'Interfaces', desc: 'GUI Roblox : boutiques, HUD, menus', c: '#3ee6ff' },
  { id: 'systems', href: up + 'systems/', name: 'Systèmes', desc: 'Œufs, économie, sauvegarde, échanges', c: '#ffb03a' },
  { id: 'library', href: up + 'library/', name: 'Bibliothèque', desc: 'Scripts open-source prêts à installer', c: '#9a8bff' },
  { id: 'skills', href: up + 'skills/', name: 'Skills', desc: 'Savoir-faire de Claude, activables', c: '#7cc4ff' },
  { id: 'push', href: up + '../roblox-push/', name: 'Roblox Push', desc: 'Publier sur Roblox depuis l’iPhone', c: '#3dffa8', sep: true },
];
const here = (() => { const m = base.match(/\/([^/]+)\/$/); const id = m ? m[1] : ''; return id === 'roblox-push' ? 'push' : id; })();
const icon = (a) => ICONS[a.icon || a.id] || ICONS.create;

function build() {
  if (document.body.classList.contains('fx-shell')) return;
  const hasStudioLayout = !!document.querySelector('#view') && !!document.querySelector('#panel, #sheet');
  document.body.classList.add('fx-shell'); if (!hasStudioLayout) document.body.classList.add('fx-page');
  // 1. remove the old emoji shortcuts to the other apps
  document.querySelectorAll('.hud a.ib, header .top a.ib, header a.btn, header .links a').forEach((a) => { const h = a.getAttribute('href') || ''; if (/^\.\.\//.test(h)) a.remove(); });
  document.querySelectorAll('header nav.tools-nav').forEach((n) => n.remove());
  // 2. « ☰ Forge » button at the start of the top bar
  const bar = document.querySelector('.hud') || document.querySelector('header .top');
  if (bar) { const b = document.createElement('button'); b.className = 'ib fx-menu'; b.type = 'button'; b.setAttribute('aria-label', 'Ouvrir le menu des apps'); b.innerHTML = `${ICONS.menu}<span class="fx-mark"></span><b>Forge</b>`; b.onclick = () => toggle(true); bar.prepend(b); }
  // 3. drawer
  const items = APPS.map((a, i) => `${a.sep ? '<div class="fx-sep"></div>' : ''}<a class="fx-item${a.id === here ? ' on' : ''}" href="${a.href}" style="--c:${a.c}" data-k="${i + 1}"><span class="fx-ic">${icon(a)}</span><span><b>${a.name}</b><small>${a.desc}</small></span></a>`).join('');
  const scrim = Object.assign(document.createElement('div'), { className: 'fx-scrim' }); scrim.onclick = () => toggle(false);
  const dr = Object.assign(document.createElement('nav'), { className: 'fx-drawer' }); dr.setAttribute('aria-label', 'Apps Roblox Forge');
  dr.innerHTML = `<div class="fx-brand"><span class="fx-mark"></span><span><b>Roblox Forge</b><small>Crée ton jeu Roblox · 0 €</small></span></div><div class="fx-nav">${items}</div>
    <div class="fx-foot">iPhone et PC · tout reste sur ton appareil et ton GitHub.<br><kbd>⌘K</kbd> ouvrir · <kbd>1</kbd>–<kbd>9</kbd> changer d’app · <kbd>Esc</kbd> fermer</div>`;
  // 4. rail (PC / iPad landscape, shown by CSS)
  const rail = Object.assign(document.createElement('nav'), { className: 'fx-rail' }); rail.setAttribute('aria-label', 'Apps');
  rail.innerHTML = `<span class="fx-mark" title="Roblox Forge"></span>${APPS.map((a) => `<a href="${a.href}" class="${a.id === here ? 'on' : ''}${a.id === 'push' ? ' fx-bottom' : ''}" data-tip="${a.name}" aria-label="${a.name}">${icon(a)}</a>`).join('')}`;
  document.body.append(scrim, dr, rail);
  // the 3D views size themselves on window resize: tell them the layout changed
  requestAnimationFrame(() => dispatchEvent(new Event('resize')));
  matchMedia('(min-width:900px) and (orientation:landscape)').addEventListener('change', () => setTimeout(() => dispatchEvent(new Event('resize')), 30));
}
function toggle(on) { document.body.classList.toggle('fx-open', on); if (on) { const a = document.querySelector('.fx-item.on') || document.querySelector('.fx-item'); a && a.focus({ preventScroll: true }); } }
addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggle(!document.body.classList.contains('fx-open')); return; }
  if (e.key === 'Escape' && document.body.classList.contains('fx-open')) { toggle(false); return; }
  if (document.body.classList.contains('fx-open') && !typing && /^[1-9]$/.test(e.key)) { const a = APPS[+e.key - 1]; if (a) location.href = a.href; }
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
export { APPS };
