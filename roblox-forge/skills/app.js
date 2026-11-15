/* Roblox Forge - 📚 Skills browser (search, filter, read on the phone). Data: skills.json (build.py). */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const CATS = { all: 'Tous', forge: '🛠️ Roblox Forge', roblox: '🎮 Roblox / Luau', '3d': '🧊 3D / Blender', design: '🎯 Design de jeu' };
let data = [], cat = 'all', q = '';
// on/off state: what the published repo has (s.enabled), overridden by the choices made on this phone
const KEY = 'forge.skills.state';
let local = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } })();
const isOn = (s) => (s.name in local ? local[s.name] : s.enabled !== false);
const setOn = (names, on) => { for (const n of names) local[n] = on; try { localStorage.setItem(KEY, JSON.stringify(local)); } catch {} };
const pending = () => data.filter((s) => isOn(s) !== (s.enabled !== false));
let tt; function toast(m, ms = 2600) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), ms); }

/* small, safe Markdown renderer: everything is escaped first, then a few patterns are formatted */
function md(src) {
  const lines = String(src).replace(/\r/g, '').split('\n'), out = []; let i = 0, list = null;
  const inline = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { close(); const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(l)) { close(); const rows = []; while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      out.push('<table>' + rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map((r, k) => '<tr>' + r.trim().slice(1, -1).split('|').map((c) => (k ? `<td>${inline(c.trim())}</td>` : `<th>${inline(c.trim())}</th>`)).join('') + '</tr>').join('') + '</table>'); continue; }
    const h = l.match(/^(#{1,4})\s+(.*)/); if (h) { close(); const n = Math.min(3, h[1].length); out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }
    const li = l.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/); if (li) { const tag = /^\s*\d+\./.test(l) ? 'ol' : 'ul'; if (list !== tag) { close(); out.push(`<${tag}>`); list = tag; } out.push(`<li>${inline(li[1])}</li>`); i++; continue; }
    if (!l.trim()) { close(); i++; continue; }
    close(); const para = [l]; i++; while (i < lines.length && lines[i].trim() && !/^(#|```|\s*[-*]\s|\s*\d+\.\s|\s*\|)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  close(); return out.join('\n');
}
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function render() {
  const words = norm(q).split(/\s+/).filter(Boolean);
  const list = data.filter((s) => (cat === 'all' || s.category === cat) && words.every((w) => s._hay.includes(w)));
  $('chips').innerHTML = Object.entries(CATS).map(([k, l]) => `<button class="chip${k === cat ? ' on' : ''}" data-c="${k}">${l} <small>${k === 'all' ? data.length : data.filter((s) => s.category === k).length}</small></button>`).join('');
  $('chips').querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { cat = b.dataset.c; render(); });
  $('list').innerHTML = list.slice(0, 300).map((s) => `<div class="card${isOn(s) ? '' : ' off'}" data-n="${esc(s.name)}"><div class="txt"><b><span class="tag t-${s.category}">${esc(CATS[s.category].split(' ')[0])}</span>${esc(s.name)}</b><p>${esc(s.description)}</p></div><button class="sw${isOn(s) ? ' on' : ''}" data-sw="${esc(s.name)}" aria-label="activer"></button></div>`).join('') || '<div class="note">Aucun skill pour cette recherche.</div>';
  $('list').querySelectorAll('[data-n]').forEach((b) => b.onclick = (e) => { if (!e.target.closest('[data-sw]')) open(b.dataset.n); });
  $('list').querySelectorAll('[data-sw]').forEach((b) => b.onclick = () => { const s = data.find((x) => x.name === b.dataset.sw); setOn([s.name], !isOn(s)); render(); });
  const on = data.filter(isOn).length, p = pending().length;
  $('count').textContent = `${on} / ${data.length} activés · ${data.filter((s) => s.name.startsWith('gh-')).length} trouvés en ligne`;
  $('syncNote').innerHTML = p ? `<span class="dirty">${p} changement${p > 1 ? 's' : ''} à appliquer</span> : touche ☁️ pour que Claude les prenne en compte.` : 'Claude utilise exactement ces skills.';
  const scope = () => data.filter((s) => cat === 'all' || s.category === cat).map((s) => s.name);
  $('allOn').onclick = () => { setOn(scope(), true); render(); }; $('allOff').onclick = () => { setOn(scope(), false); render(); };
}
function open(name) {
  const s = data.find((x) => x.name === name); if (!s) return;
  const d = $('detail'); d.classList.add('on'); d.scrollTop = 0; history.pushState({ s: name }, '', '#' + encodeURIComponent(name));
  const url = /^https:\/\/github\.com\//.test(s.source) ? s.source : null;
  d.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><button class="btn" id="back">← Retour</button><button class="btn" id="copy">⧉ Copier</button></div>
    <h2 style="margin:14px 0 4px">${esc(s.name)}</h2><div class="meta"><span class="tag t-${s.category}">${esc(CATS[s.category])}</span> ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Source GitHub ↗</a>` : esc(s.source)} · licence ${esc(s.license)}</div>
    <div class="note">${esc(s.description)}</div><div class="md">${md(s.body)}</div>`;
  $('back').onclick = () => history.back();
  $('copy').onclick = async () => { try { await navigator.clipboard.writeText(s.body); $('copy').textContent = '✓ Copié'; } catch { $('copy').textContent = 'Copie impossible'; } };
}
addEventListener('popstate', () => { $('detail').classList.remove('on'); });
$('q').addEventListener('input', (e) => { q = e.target.value; render(); });
fetch('skills.json', { cache: 'no-cache' }).then((r) => r.json()).then((j) => {
  data = j.skills.map((s) => ({ ...s, _hay: norm(s.name + ' ' + s.description + ' ' + s.body.slice(0, 4000)) }));
  render();
  if (location.hash) open(decodeURIComponent(location.hash.slice(1)));
}).catch(() => { $('count').textContent = 'hors connexion'; });
/* ☁️ apply to Claude: one commit on the repo's default branch moving each skill folder between
   .claude/skills (read by Claude) and .claude/skills-off, plus the updated skills.json.
   Uses the GitHub connection already made in Roblox Push (same site, same browser). */
const API = 'https://api.github.com';
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem('rp2.' + k) || 'null'); } catch { return null; } };
async function gh(token, method, path, body) {
  const r = await fetch(API + path, { method, cache: 'no-store', headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.message || r.statusText); e.status = r.status; throw e; } return j;
}
async function applyToClaude() {
  const changes = pending(); if (!changes.length) return toast('Rien à appliquer');
  const token = lsGet('token'); if (!token) return toast('Connecte d\'abord GitHub dans Roblox Push (🚀), puis reviens ici', 4000);
  const repo = 'SawAz135/vertical';
  $('sync').disabled = true; toast('Envoi à GitHub…', 6000);
  try {
    const info = await gh(token, 'GET', `/repos/${repo}`), branch = info.default_branch;
    const ref = await gh(token, 'GET', `/repos/${repo}/git/ref/heads/${branch}`), head = await gh(token, 'GET', `/repos/${repo}/git/commits/${ref.object.sha}`);
    const tree = await gh(token, 'GET', `/repos/${repo}/git/trees/${head.tree.sha}?recursive=1`);
    if (tree.truncated) throw new Error('dépôt trop grand pour une seule mise à jour');
    const want = new Map(data.map((s) => [s.name, isOn(s)]));
    const entries = tree.tree.filter((t) => t.type !== 'tree').map((t) => {
      const m = t.path.match(/^\.claude\/(skills|skills-off)\/([^/]+)\/(.*)$/);
      if (m && want.has(m[2])) return { path: `.claude/${want.get(m[2]) ? 'skills' : 'skills-off'}/${m[2]}/${m[3]}`, mode: t.mode, type: t.type, sha: t.sha };
      return { path: t.path, mode: t.mode, type: t.type, sha: t.sha };
    }).filter((t) => t.path !== 'roblox-forge/skills/skills.json');
    const json = JSON.stringify({ count: data.length, skills: data.map(({ _hay, ...s }) => ({ ...s, enabled: isOn(s) })) });
    const blob = await gh(token, 'POST', `/repos/${repo}/git/blobs`, { content: json, encoding: 'utf-8' });
    entries.push({ path: 'roblox-forge/skills/skills.json', mode: '100644', type: 'blob', sha: blob.sha });
    const nt = await gh(token, 'POST', `/repos/${repo}/git/trees`, { tree: entries });
    const on = changes.filter(isOn).map((s) => s.name), off = changes.filter((s) => !isOn(s)).map((s) => s.name);
    const msg = `Skills: ${on.length} activé(s), ${off.length} désactivé(s) depuis l'app\n\n${on.length ? 'On: ' + on.join(', ') + '\n' : ''}${off.length ? 'Off: ' + off.join(', ') + '\n' : ''}`;
    const commit = await gh(token, 'POST', `/repos/${repo}/git/commits`, { message: msg, tree: nt.sha, parents: [ref.object.sha] });
    await gh(token, 'PATCH', `/repos/${repo}/git/refs/heads/${branch}`, { sha: commit.sha });
    for (const s of data) { s.enabled = isOn(s); } local = {}; try { localStorage.removeItem(KEY); } catch {}
    render(); toast(`✓ Appliqué : ${on.length} activé(s), ${off.length} désactivé(s). Claude les prend en compte à la prochaine session.`, 5000);
  } catch (e) {
    toast(e.status === 404 || e.status === 403 ? 'Ton jeton GitHub n\'a pas accès au dépôt SawAz135/vertical : ajoute ce dépôt au jeton (Contents : lecture et écriture)' : 'Échec : ' + e.message, 6000);
  } finally { $('sync').disabled = false; }
}
$('sync').onclick = applyToClaude;
window.__skills = { get data() { return data; }, md, isOn, pending, applyToClaude }; // used by automated tests
