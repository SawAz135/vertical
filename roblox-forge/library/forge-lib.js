/* =====================================================================
   Roblox Forge - the Library inside every studio (Pet, GUI, Map).
   - "⬇️ Télécharger la library": installs the bundle (real Luau code
     extracted from open-licence GitHub repositories) into IndexedDB;
   - a 📚 tab: search, categories, animated preview, README, code, licence;
   - "＋ Ajouter" puts a whole package (folder layout kept, so requires
     still work) or one file into the studio's Roblox pack;
   - "＋ GitHub": paste any repository / file link, the browser fetches it
     (licence checked: only MIT, Apache, BSD, MPL, ISC, Unlicense, CC0).
   ===================================================================== */
const ALLOWED = new Set(['mit', 'apache-2.0', 'bsd-2-clause', 'bsd-3-clause', 'mpl-2.0', 'unlicense', 'cc0-1.0', 'isc', '0bsd']);
const SKIP_DIR = /(^|\/)(tests?|specs?|__tests__|examples?|demos?|bench(mark)?s?|docs?|\.github|node_modules|\.vscode)(\/|$)/i;
export const CATS = { all: '✨ Tout', animation: '🌀 Animation', vfx: '💥 Effets', map: '🗺️ Maps', pets: '🐾 Pets', camera: '🎥 Caméra', ui: '🎛️ UI', systems: '🧩 Systèmes', physics: '⚙️ Physique', audio: '🔊 Son', framework: '🏗️ Frameworks', github: '🐙 GitHub' };
const KIND = { ModuleScript: ['📦', 'ReplicatedStorage'], LocalScript: ['📱', 'StarterPlayerScripts'], Script: ['🖥️', 'ServerScriptService'] };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmtKB = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + ' Mo' : Math.max(1, Math.round(b / 1024)) + ' Ko');

/* ---------- IndexedDB ---------- */
function idb() { return new Promise((res, rej) => { const r = indexedDB.open('forge-library', 1); r.onupgradeneeded = () => { r.result.createObjectStore('pkg'); r.result.createObjectStore('meta'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function tx(store, mode, fn) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(store, mode), s = t.objectStore(store), out = fn(s); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); }
const dbGet = (store, key) => tx(store, 'readonly', (s) => s.get(key));
const dbPut = (store, key, v) => tx(store, 'readwrite', (s) => s.put(v, key));
const dbKeys = (store) => tx(store, 'readonly', (s) => s.getAllKeys());

/* ---------- Luau highlight ---------- */
function highlight(src) {
  let out = '', i = 0; const re = /(--\[(=*)\[[\s\S]*?\]\2\]|--[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\[(=*)\[[\s\S]*?\]\4\])|(\b\d+(?:\.\d+)?\b)|\b(game|workspace|script|Instance|Vector3|CFrame|Color3|UDim2|Enum|task|math|table|string|require|pcall|print|warn|typeof|type)\b|\b(local|function|end|if|then|else|elseif|for|in|do|while|repeat|until|return|and|or|not|nil|true|false|break|continue|export)\b/g;
  let m; while ((m = re.exec(src))) { out += esc(src.slice(i, m.index)); const cls = m[1] ? 'c' : m[3] ? 's' : m[5] ? 'n' : m[6] ? 'g' : 'k'; out += `<span class="tk-${cls}">${esc(m[0])}</span>`; i = re.lastIndex; }
  return out + esc(src.slice(i));
}
const stripMd = (s) => String(s || '').replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#>*_`|]/g, '').replace(/\n{3,}/g, '\n\n').trim();

/* ---------- animated previews (one tiny canvas per visible card) ---------- */
const DEMOS = {
  animation(g, t, w, h) { const x = w / 2 + Math.sin(t * 2.2) * w * 0.3 * Math.exp(-((t * 0.7) % 3)), s = 14 + Math.abs(Math.sin(t * 4)) * 4; g.fillStyle = '#7c5cff'; g.beginPath(); g.roundRect(x - s / 2, h / 2 - s / 2, s, s, 4); g.fill(); g.strokeStyle = '#3ee6ff55'; g.beginPath(); g.moveTo(10, h - 10); for (let i = 0; i <= 40; i++) { const u = i / 40; g.lineTo(10 + u * (w - 20), h - 10 - (1 - Math.cos(u * 9) * Math.exp(-u * 4)) * (h - 30) * 0.5); } g.stroke(); },
  vfx(g, t, w, h) { for (let i = 0; i < 26; i++) { const a = i * 2.39 + t, r = ((t * 30 + i * 7) % 36); g.fillStyle = `hsla(${(i * 25 + t * 80) % 360},100%,65%,${1 - r / 36})`; g.beginPath(); g.arc(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 2.2, 0, 7); g.fill(); } },
  map(g, t, w, h) { for (let x = 0; x < w; x += 3) { const n = Math.sin((x + t * 20) * 0.06) * 8 + Math.sin((x + t * 20) * 0.017) * 12, y = h * 0.6 - n; g.fillStyle = y < h * 0.45 ? '#f2f7ff' : '#4b9a3c'; g.fillRect(x, y, 3, h - y); } g.fillStyle = '#3aa8ff88'; g.fillRect(0, h * 0.75, w, h * 0.25); },
  pets(g, t, w, h) { const y = h / 2 + Math.sin(t * 3) * 4; g.fillStyle = '#ffa94d'; g.beginPath(); g.ellipse(w / 2, y, 16, 14, 0, 0, 7); g.fill(); g.fillStyle = '#161321'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(w / 2 + s * 6, y - 2, 3, 4, 0, 0, 7); g.fill(); } g.fillStyle = '#fff'; g.fillRect(w / 2 - 7, y - 5, 1.6, 1.6); g.fillRect(w / 2 + 5, y - 5, 1.6, 1.6); },
  camera(g, t, w, h) { const dx = Math.sin(t * 31) * 2 * Math.abs(Math.sin(t)), dy = Math.cos(t * 27) * 2 * Math.abs(Math.sin(t)); g.strokeStyle = '#fff'; g.strokeRect(14 + dx, 14 + dy, w - 28, h - 28); g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(w / 2 + dx, h / 2 + dy, 5, 0, 7); g.fill(); },
  ui(g, t, w, h) { const k = (Math.sin(t * 1.6) + 1) / 2, x = 8 + (1 - k * k) * -50 + 50 * k; g.fillStyle = '#1d1846'; g.beginPath(); g.roundRect(x - 40, 14, w - 16, h - 28, 8); g.fill(); g.fillStyle = '#7c5cff'; g.beginPath(); g.roundRect(x - 34, 20, w - 28, 10, 5); g.fill(); g.fillStyle = '#3dffa8'; g.beginPath(); g.roundRect(x - 34, h - 30, 30, 10, 5); g.fill(); },
  systems(g, t, w, h) { const pts = [[16, 20], [w - 16, 24], [w / 2, h - 16], [w / 2, h / 2]]; g.strokeStyle = '#3ee6ff66'; for (const [a, b] of [[0, 3], [1, 3], [2, 3]]) { g.beginPath(); g.moveTo(...pts[a]); g.lineTo(...pts[b]); g.stroke(); } pts.forEach((p, i) => { g.fillStyle = i === Math.floor(t * 2) % 4 ? '#ffd45c' : '#7c5cff'; g.beginPath(); g.arc(p[0], p[1], 5, 0, 7); g.fill(); }); },
  physics(g, t, w, h) { for (let i = 0; i < 3; i++) { const ph = (t * 1.3 + i * 0.4) % 1.2, y = h - 12 - Math.abs(Math.sin(ph * Math.PI / 1.2)) * (h - 30) * (1 - i * 0.2); g.fillStyle = ['#ff4d6d', '#ffd45c', '#3ee6ff'][i]; g.beginPath(); g.arc(18 + i * 18, y, 6, 0, 7); g.fill(); } },
  audio(g, t, w, h) { for (let i = 0; i < 8; i++) { const v = (Math.sin(t * 6 + i * 1.3) + 1.2) / 2.2 * (h - 24); g.fillStyle = `hsl(${250 + i * 12},90%,65%)`; g.fillRect(8 + i * (w - 16) / 8, h - 10 - v, (w - 16) / 8 - 2, v); } },
  framework(g, t, w, h) { for (let i = 0; i < 3; i++) { g.save(); g.translate(w / 2 + (i - 1) * 18, h / 2); g.rotate(t * (1 + i * 0.4)); g.strokeStyle = ['#7c5cff', '#3ee6ff', '#ffd45c'][i]; g.lineWidth = 2; g.strokeRect(-7, -7, 14, 14); g.restore(); } },
};
DEMOS.github = DEMOS.framework; DEMOS.tools = DEMOS.framework; DEMOS.utility = DEMOS.systems; DEMOS.network = DEMOS.systems;
let demoRAF = 0; const demoCanvases = new Set();
function runDemos() { cancelAnimationFrame(demoRAF); const t0 = performance.now();
  const tick = () => { const t = (performance.now() - t0) / 1000; for (const c of demoCanvases) { if (!c.isConnected) { demoCanvases.delete(c); continue; } const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); (DEMOS[c.dataset.cat] || DEMOS.framework)(g, t, c.width, c.height); }
    if (demoCanvases.size) demoRAF = requestAnimationFrame(tick); }; tick(); }

/* ---------- styles (injected once) ---------- */
const CSS = `.lsearch{border:0;border-radius:14px;padding:12px 14px;background:rgba(3,2,10,.7);box-shadow:0 0 0 1px rgba(170,150,255,.3) inset;font-size:16px;outline:none;color:inherit;box-sizing:border-box}
.lib-hero{padding:14px;border-radius:18px;background:linear-gradient(135deg,rgba(124,92,255,.35),rgba(62,230,255,.18));box-shadow:0 0 0 1px rgba(143,176,255,.4) inset;margin:10px 0}
.lib-hero b{font-size:16px}.lib-bar{height:10px;border-radius:6px;background:#ffffff18;overflow:hidden;margin-top:10px}.lib-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#7c5cff,#3ee6ff);transition:width .2s}
.lib-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:6px 0}.lib-chips::-webkit-scrollbar{display:none}
.lib-chip{flex:none;border:0;border-radius:11px;padding:7px 10px;font-size:12.5px;font-weight:800;background:#ffffff0c;box-shadow:0 0 0 1px rgba(170,150,255,.14) inset;white-space:nowrap;color:inherit}
.lib-chip.on{background:linear-gradient(135deg,rgba(124,92,255,.55),rgba(62,230,255,.35))}
.lib-card{display:flex;gap:10px;padding:10px;border-radius:14px;margin:8px 0;background:#ffffff08;box-shadow:0 0 0 1px rgba(170,150,255,.14) inset}
.lib-card canvas{flex:none;width:64px;height:64px;border-radius:12px;background:radial-gradient(circle at 50% 40%,#1d1846,#0b0920)}
.lib-card .lb{flex:1;min-width:0}.lib-card .lb b{display:block;font-size:14px;word-break:break-word}
.lib-card .lb p{margin:3px 0 0;font-size:12px;color:#cfc8ee;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.lib-badges{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}.lib-badges span{font-size:10px;font-weight:800;padding:2px 6px;border-radius:6px;background:#ffffff12;color:#a39bc9}.lib-badges .lic{color:#3dffa8}.lib-badges .st{color:#ffd45c}
.lib-act{display:flex;flex-direction:column;gap:6px;flex:none}.lib-act button{border:0;border-radius:10px;padding:8px 10px;font-size:12px;font-weight:850;background:#ffffff12;color:inherit;box-shadow:0 0 0 1px rgba(170,150,255,.3) inset}
.lib-act .add{background:linear-gradient(135deg,#7c5cff,#4b2fd6)}.lib-act .added{background:#3dffa833;color:#3dffa8}
.lib-files{list-style:none;margin:6px 0;padding:0;max-height:180px;overflow:auto}.lib-files li{display:flex;gap:6px;align-items:center;padding:6px 8px;border-radius:9px;font:12px ui-monospace,Menlo,monospace;cursor:pointer}.lib-files li.on{background:rgba(124,92,255,.3)}
.lib-code{max-height:46vh;overflow:auto;margin:0;padding:10px;border-radius:12px;background:#07061a;font:11.5px/1.5 ui-monospace,Menlo,monospace;white-space:pre;color:#d8d4f0;box-shadow:0 0 0 1px rgba(170,150,255,.14) inset}
.lib-readme{white-space:pre-wrap;font-size:12.5px;color:#cfc8ee;max-height:160px;overflow:auto;padding:8px 10px;border-radius:10px;background:#ffffff08}
.lib-modal{position:fixed;inset:0;z-index:80;display:grid;place-items:center;background:rgba(5,4,12,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:18px}
.lib-modal .box{max-width:420px;width:100%;padding:20px;border-radius:22px;background:linear-gradient(160deg,#1d1846,#0d0a24);box-shadow:0 0 0 1px rgba(143,176,255,.35) inset,0 30px 60px #000a;color:#f4f1ff;font:15px/1.45 -apple-system,system-ui,sans-serif}
.lib-modal h2{margin:0 0 6px;font-size:20px}.lib-modal .row2{display:flex;gap:8px;margin-top:14px}.lib-modal button{flex:1;border:0;border-radius:14px;padding:13px;font-weight:850;font-size:15px;color:#fff;background:#ffffff14}.lib-modal .go{background:linear-gradient(135deg,#7c5cff,#3ee6ff)}
.tk-k{color:#c792ea}.tk-s{color:#c3e88d}.tk-c{color:#6b6491;font-style:italic}.tk-n{color:#f78c6c}.tk-g{color:#82aaff}`;

/* =====================================================================
   createLibrary({ studio, base, toast }) -> { render(pane), packFiles(), prompt() }
   ===================================================================== */
export function createLibrary({ studio, base = '../library/', toast = () => {} }) {
  if (!document.getElementById('forge-lib-css')) { const st = document.createElement('style'); st.id = 'forge-lib-css'; st.textContent = CSS; document.head.appendChild(st); }
  const KEY = 'forge.libAdded.' + studio;
  const st = { index: null, installed: null, q: '', cat: 'all', open: null, file: 0, busy: false, progress: 0, shown: 40 };
  const added = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const setAdded = (a) => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {} };
  async function loadIndex() { if (st.index) return st.index; const r = await fetch(base + 'bundle/index.json', { cache: 'no-cache' }); const j = await r.json(); st.index = j.packages.filter((p) => !p.skip); return st.index; }
  async function installedSet() { if (!st.installed) { try { st.installed = new Set(await dbKeys('pkg')); } catch { st.installed = new Set(); } } return st.installed; }
  async function install(onProgress) {
    const list = await loadIndex(), have = await installedSet(), todo = list.filter((p) => !have.has(p.id)), total = list.reduce((s, p) => s + (p.bytes || 0), 0); let done = list.filter((p) => have.has(p.id)).reduce((s, p) => s + (p.bytes || 0), 0);
    let i = 0; const worker = async () => { while (i < todo.length) { const p = todo[i++]; try { const r = await fetch(base + 'bundle/pkg/' + p.file); const pkg = await r.json(); await dbPut('pkg', p.id, pkg); have.add(p.id); } catch {} done += p.bytes || 0; onProgress(done / total, have.size, list.length); } };
    await Promise.all([worker(), worker(), worker(), worker(), worker()]);
    await dbPut('meta', 'installed', { at: Date.now(), count: have.size }); try { localStorage.setItem('forge.libInstalled', '1'); } catch {}
    return have.size;
  }
  const getPkg = (id) => dbGet('pkg', id);

  /* ----- pack export: what the player added ends up in the Roblox pack ----- */
  async function packFiles() {
    const out = [], credits = [];
    for (const a of added()) { const pkg = await getPkg(a.id).catch(() => null); if (!pkg) continue;
      credits.push(pkg.credit || pkg.id);
      if (a.file) { const f = pkg.files.find((x) => x.path === a.file); if (!f) continue; const [, svc] = KIND[f.kind]; const name = f.path.split('/').pop();
        out.push({ path: (svc === 'ReplicatedStorage' ? 'ReplicatedStorage/ForgeLibrary/' : svc + '/') + name, data: f.source }); }
      else { for (const f of pkg.files) out.push({ path: `ReplicatedStorage/ForgeLibrary/${pkg.name}/${f.path}`, data: f.source });
        if (pkg.licenseText) out.push({ path: `ReplicatedStorage/ForgeLibrary/${pkg.name}/LICENSE.txt`, data: pkg.licenseText }); } }
    if (credits.length) out.push({ path: 'ReplicatedStorage/ForgeLibrary/CREDITS.txt', data: 'Scripts open source ajoutés depuis la Library Roblox Forge :\n' + credits.map((c) => '- ' + c).join('\n') + '\n' });
    return out;
  }

  /* ----- ＋ GitHub: fetch a repository or a single file in the browser ----- */
  async function fromGitHub(url) {
    const m = String(url).trim().match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/]+)(?:\/(.*))?)?\/?$/i);
    if (!m) throw new Error('Lien GitHub non reconnu (ex : https://github.com/owner/repo)');
    const [, owner, repo, branchIn, sub] = m, id = `${owner}/${repo}`;
    const info = await fetch(`https://api.github.com/repos/${id}`).then((r) => { if (r.status === 403) throw new Error('GitHub limite les requêtes : réessaie dans une heure'); if (!r.ok) throw new Error('Dépôt introuvable ou privé'); return r.json(); });
    const lic = (info.license && info.license.spdx_id || '').toLowerCase();
    if (!ALLOWED.has(lic)) throw new Error(`Licence « ${info.license ? info.license.spdx_id : 'aucune'} » : pas libre de réutilisation, non ajouté.`);
    const branch = branchIn || info.default_branch;
    const tree = await fetch(`https://api.github.com/repos/${id}/git/trees/${branch}?recursive=1`).then((r) => r.json());
    let paths = (tree.tree || []).filter((x) => x.type === 'blob' && /\.luau?$/i.test(x.path) && !SKIP_DIR.test(x.path)).map((x) => x.path);
    if (sub) paths = paths.filter((p) => p === sub || p.startsWith(sub.replace(/\/?$/, '/')));
    if (!paths.length) throw new Error('Aucun fichier Luau trouvé');
    const rootGuess = sub && !/\.luau?$/i.test(sub) ? sub.replace(/\/?$/, '/') : ['src/', 'lib/'].find((r) => paths.some((p) => p.startsWith(r))) || '';
    const files = []; let bytes = 0;
    for (const p of paths.slice(0, 80)) { if (rootGuess && !p.startsWith(rootGuess) && !(sub && p === sub)) continue; const src = await fetch(`https://raw.githubusercontent.com/${id}/${branch}/${p}`).then((r) => (r.ok ? r.text() : null));
      if (!src || src.length > 200000) continue; if (/getgenv\(|syn\.request|hookfunction|getrawmetatable/.test(src)) throw new Error('Code de type exploit refusé');
      const rel = sub && p === sub ? p.split('/').pop() : rootGuess ? p.slice(rootGuess.length) : p; files.push({ path: rel, kind: /\.server\.luau?$/i.test(rel) ? 'Script' : /\.client\.luau?$/i.test(rel) ? 'LocalScript' : 'ModuleScript', size: src.length, source: src }); bytes += src.length; if (bytes > 600000) break; }
    const licenseText = await fetch(`https://raw.githubusercontent.com/${id}/${branch}/LICENSE`).then((r) => (r.ok ? r.text() : null)).catch(() => null);
    const readme = await fetch(`https://raw.githubusercontent.com/${id}/${branch}/README.md`).then((r) => (r.ok ? r.text() : null)).catch(() => null);
    const pkg = { id, name: repo.replace(/[^\w]/g, '') || 'Package', branch, category: 'github', license: info.license.spdx_id, licenseText, readme: readme && readme.slice(0, 3000), stars: info.stargazers_count, description: info.description || '', url: info.html_url,
      files, credit: `${id} (${info.license.spdx_id}) - ${info.html_url}`, fileCount: files.length, bytes, kinds: [...new Set(files.map((f) => f.kind))], user: true };
    await dbPut('pkg', id, pkg); (await installedSet()).add(id);
    const extra = JSON.parse(localStorage.getItem('forge.libUser') || '[]').filter((x) => x.id !== id); extra.unshift({ ...pkg, files: undefined, licenseText: undefined, readme: undefined, summary: (readme || '').slice(0, 400) });
    try { localStorage.setItem('forge.libUser', JSON.stringify(extra.slice(0, 50))); } catch {}
    return pkg;
  }

  /* ----- first launch prompt ----- */
  async function prompt(force) {
    if (!force && (localStorage.getItem('forge.libInstalled') || localStorage.getItem('forge.libPrompted'))) return;
    let list = []; try { list = await loadIndex(); } catch { return; }
    const bytes = list.reduce((s, p) => s + (p.bytes || 0), 0), files = list.reduce((s, p) => s + (p.fileCount || 0), 0);
    const m = document.createElement('div'); m.className = 'lib-modal'; m.innerHTML = `<div class="box"><h2>📚 La Library Roblox Forge</h2>
      <div>${list.length} paquets open source · ${files} scripts Luau (animations, effets, maps, pets, UI, systèmes…) extraits de GitHub, avec leurs licences.</div>
      <div style="margin-top:8px;color:#a39bc9;font-size:13px">Installe-la une fois (${fmtKB(bytes)}) : ensuite tout s'ajoute à ton jeu avec ＋, même hors ligne.</div>
      <div class="lib-bar"><i id="libBarM"></i></div><div id="libTxtM" style="font-size:12.5px;color:#a39bc9;margin-top:6px"></div>
      <div class="row2"><button id="libLater">Plus tard</button><button class="go" id="libGo">⬇️ Télécharger la library</button></div></div>`;
    document.body.appendChild(m);
    m.querySelector('#libLater').onclick = () => { try { localStorage.setItem('forge.libPrompted', '1'); } catch {} m.remove(); };
    m.querySelector('#libGo').onclick = async (e) => { e.target.disabled = true; e.target.textContent = 'Installation…';
      const n = await install((f, k, tot) => { m.querySelector('#libBarM').style.width = (f * 100).toFixed(1) + '%'; m.querySelector('#libTxtM').textContent = `${k} / ${tot} paquets · ${(f * 100).toFixed(0)} %`; });
      m.querySelector('#libTxtM').textContent = `✓ ${n} paquets installés`; toast('📚 Library installée : onglet 📚 pour ajouter des scripts'); setTimeout(() => m.remove(), 900); };
  }

  /* ----- the 📚 tab ----- */
  async function render(pane) {
    pane.innerHTML = '<div class="note" style="margin:12px 2px">Chargement de la Library…</div>';
    let list; try { list = await loadIndex(); } catch { pane.innerHTML = '<div class="note" style="margin:12px 2px">Library introuvable.</div>'; return; }
    const user = JSON.parse(localStorage.getItem('forge.libUser') || '[]'), all = [...user, ...list.filter((p) => !user.some((u) => u.id === p.id))], have = await installedSet(), add = added();
    if (st.open) return detail(pane, st.open);
    const q = norm(st.q), shown = all.filter((p) => (st.cat === 'all' || p.category === st.cat || (st.cat === 'added' && add.some((a) => a.id === p.id))) && (!q || norm(p.id + ' ' + p.description + ' ' + (p.summary || '')).includes(q)));
    const installedAll = list.every((p) => have.has(p.id));
    pane.innerHTML = `${installedAll ? '' : `<div class="lib-hero"><b>⬇️ Télécharger la library</b><div class="note" style="margin-top:4px">${list.length} paquets · ${list.reduce((s, p) => s + p.fileCount, 0)} scripts Luau open source, avec leurs licences. ${have.size ? have.size + ' déjà installés.' : ''}</div>
        <div class="lib-bar"><i id="libBar"></i></div><button class="btn pri big" id="libInstall" style="margin-top:10px">${have.size ? 'Finir l\'installation' : 'Installer la library'}</button></div>`}
      <div class="sec"><h3>📚 Library <small>${shown.length} / ${all.length}${add.length ? ' · ' + add.length + ' ajoutés' : ''}</small></h3>
        <input class="lsearch" id="libQ" placeholder="🔎 spring, tween, terrain, pet, camera shake, datastore…" value="${esc(st.q)}" style="width:100%">
        <div class="lib-chips">${Object.entries(CATS).filter(([k]) => k !== 'github' || user.length).map(([k, l]) => `<button class="lib-chip${st.cat === k ? ' on' : ''}" data-cat="${k}">${l}</button>`).join('')}<button class="lib-chip${st.cat === 'added' ? ' on' : ''}" data-cat="added">✅ Ajoutés (${add.length})</button></div>
        <div id="libList">${shown.slice(0, st.shown).map((p) => card(p, have.has(p.id), add)).join('')}</div>
        ${shown.length > st.shown ? `<button class="btn big" id="libMore">Voir plus (${shown.length - st.shown})</button>` : ''}</div>
      <div class="sec"><h3>🐙 ＋ GitHub <small>colle un lien</small></h3><input class="lsearch" id="ghUrl" placeholder="https://github.com/owner/repo" style="width:100%"><button class="btn pri big" id="ghGo">＋ Ajouter depuis GitHub</button>
        <div class="note" id="ghMsg" style="margin-top:6px">Dépôt entier, dossier ou fichier. Seules les licences libres (MIT, Apache, BSD, MPL, ISC, Unlicense, CC0) sont acceptées.</div></div>`;
    const qi = pane.querySelector('#libQ'); qi.oninput = () => { st.q = qi.value; st.shown = 40; const pos = qi.selectionStart; render(pane).then(() => { const n = pane.querySelector('#libQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }); };
    pane.querySelectorAll('[data-cat]').forEach((b) => b.onclick = () => { st.cat = b.dataset.cat; st.shown = 40; render(pane); });
    if (pane.querySelector('#libMore')) pane.querySelector('#libMore').onclick = () => { st.shown += 40; render(pane); };
    if (pane.querySelector('#libInstall')) pane.querySelector('#libInstall').onclick = async (e) => { e.target.disabled = true; e.target.textContent = 'Installation…';
      await install((f, k, tot) => { const b = pane.querySelector('#libBar'); if (b) b.style.width = (f * 100).toFixed(1) + '%'; e.target.textContent = `${k} / ${tot} paquets…`; }); toast('📚 Library installée'); render(pane); };
    pane.querySelector('#ghGo').onclick = async () => { const msg = pane.querySelector('#ghMsg'); msg.textContent = '⏳ Lecture du dépôt…';
      try { const pkg = await fromGitHub(pane.querySelector('#ghUrl').value); const a = added(); a.push({ id: pkg.id }); setAdded(a); toast(`🐙 ${pkg.name} ajouté (${pkg.files.length} fichiers, ${pkg.license})`); st.open = pkg.id; render(pane); }
      catch (e) { msg.textContent = '❌ ' + e.message; } };
    bindCards(pane);
    pane.querySelectorAll('canvas[data-cat]').forEach((c) => demoCanvases.add(c)); runDemos();
  }
  function card(p, inst, add) {
    const isAdded = add.some((a) => a.id === p.id && !a.file);
    return `<div class="lib-card"><canvas width="64" height="64" data-cat="${esc(p.category)}"></canvas><div class="lb"><b>${esc(p.name)}</b><p>${esc(p.description || stripMd(p.summary).slice(0, 160))}</p>
      <div class="lib-badges"><span class="lic">${esc(p.license)}</span><span class="st">★ ${p.stars || 0}</span><span>${CATS[p.category] || p.category}</span><span>${p.fileCount} fichiers · ${fmtKB(p.bytes || 0)}</span>${(p.kinds || []).map((k) => `<span>${KIND[k][0]} ${k}</span>`).join('')}</div></div>
      <div class="lib-act"><button data-open="${esc(p.id)}">👁 Voir</button><button class="${isAdded ? 'added' : 'add'}" data-add="${esc(p.id)}" ${inst ? '' : 'data-need="1"'}>${isAdded ? '✓ Ajouté' : '＋ Ajouter'}</button></div></div>`;
  }
  function bindCards(pane) {
    pane.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => { st.open = b.dataset.open; st.file = 0; render(pane); });
    pane.querySelectorAll('[data-add]').forEach((b) => b.onclick = async () => { const id = b.dataset.add; let a = added();
      if (a.some((x) => x.id === id && !x.file)) { a = a.filter((x) => !(x.id === id && !x.file)); setAdded(a); toast('Retiré du pack'); return render(pane); }
      if (b.dataset.need) { const p = st.index.find((x) => x.id === id); try { const r = await fetch(base + 'bundle/pkg/' + p.file); await dbPut('pkg', id, await r.json()); (await installedSet()).add(id); } catch { return toast('Installe d\'abord la library'); } }
      a.push({ id }); setAdded(a); toast('＋ ' + id.split('/')[1] + ' ajouté au pack (ReplicatedStorage/ForgeLibrary)'); render(pane); });
  }
  async function detail(pane, id) {
    let pkg = await getPkg(id).catch(() => null);
    if (!pkg) { const p = (st.index || []).find((x) => x.id === id); if (p) { try { pkg = await fetch(base + 'bundle/pkg/' + p.file).then((r) => r.json()); await dbPut('pkg', id, pkg); (await installedSet()).add(id); } catch {} } }
    if (!pkg) { st.open = null; return render(pane); }
    const add = added(), whole = add.some((a) => a.id === id && !a.file), f = pkg.files[Math.min(st.file, pkg.files.length - 1)], main = pkg.files.find((x) => /^init\.luau?$/.test(x.path)) ? pkg.name : (pkg.files[0].path.replace(/\.luau?$/, ''));
    pane.innerHTML = `<div class="sec"><h3><button class="btn" id="libBack">‹ Retour</button><small>${esc(pkg.license)} · ★ ${pkg.stars || 0}</small></h3>
        <div style="display:flex;gap:10px;align-items:center"><canvas width="64" height="64" data-cat="${esc(pkg.category)}" style="border-radius:12px;background:#0b0920"></canvas><div><b style="font-size:16px">${esc(pkg.name)}</b><div class="note">${esc(pkg.id)} · ${pkg.files.length} fichiers</div></div></div>
        <p class="note">${esc(pkg.description)}</p>
        <button class="btn ${whole ? '' : 'pri'} big" id="libAddAll">${whole ? '✓ Ajouté — retirer' : '＋ Ajouter tout le paquet à mon jeu'}</button>
        <div class="note" style="margin-top:8px">Dans ton jeu : <code class="inl">local ${esc(pkg.name)} = require(game.ReplicatedStorage.ForgeLibrary.${esc(main.replace(/\//g, '.'))})</code></div></div>
      ${pkg.readme ? `<div class="sec"><h3>📖 Présentation</h3><div class="lib-readme">${esc(stripMd(pkg.readme).slice(0, 1800))}</div></div>` : ''}
      <div class="sec"><h3>📜 Fichiers <small>touche pour lire</small></h3><ul class="lib-files">${pkg.files.map((x, i) => `<li data-fi="${i}" class="${i === st.file ? 'on' : ''}">${KIND[x.kind][0]} ${esc(x.path)}<span style="margin-left:auto;color:#6b6491">${fmtKB(x.size)}</span></li>`).join('')}</ul>
        <pre class="lib-code">${highlight(f.source.slice(0, 40000))}</pre>
        <div class="btns" style="margin-top:8px"><button class="btn" id="libAddOne">${add.some((a) => a.id === id && a.file === f.path) ? '✓ Fichier ajouté' : '＋ Ce fichier seul'} → ${KIND[f.kind][1]}</button><button class="btn" id="libCopy">⧉ Copier</button></div></div>
      ${pkg.licenseText ? `<div class="sec"><details><summary style="font-weight:800">⚖️ Licence ${esc(pkg.license)} et crédits</summary><pre class="lib-code" style="max-height:30vh;white-space:pre-wrap">${esc(pkg.licenseText)}</pre></details><div class="note">Crédit ajouté automatiquement dans ForgeLibrary/CREDITS.txt.</div></div>` : ''}`;
    pane.querySelector('#libBack').onclick = () => { st.open = null; render(pane); };
    pane.querySelectorAll('[data-fi]').forEach((li) => li.onclick = () => { st.file = +li.dataset.fi; detail(pane, id); });
    pane.querySelector('#libAddAll').onclick = () => { let a = added(); if (whole) a = a.filter((x) => !(x.id === id && !x.file)); else a.push({ id }); setAdded(a); toast(whole ? 'Retiré du pack' : '＋ ' + pkg.name + ' ajouté au pack'); detail(pane, id); };
    pane.querySelector('#libAddOne').onclick = () => { let a = added(); const has = a.some((x) => x.id === id && x.file === f.path); a = has ? a.filter((x) => !(x.id === id && x.file === f.path)) : [...a, { id, file: f.path }]; setAdded(a); toast(has ? 'Fichier retiré' : '＋ ' + f.path.split('/').pop() + ' → ' + KIND[f.kind][1]); detail(pane, id); };
    pane.querySelector('#libCopy').onclick = async () => { try { await navigator.clipboard.writeText(f.source); toast('Copié ✓'); } catch { toast('Copie impossible'); } };
    pane.querySelectorAll('canvas[data-cat]').forEach((c) => demoCanvases.add(c)); runDemos();
  }
  return { render, packFiles, prompt, install, fromGitHub, added, state: st };
}
