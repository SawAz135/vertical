/* =====================================================================
   Roblox Forge - free AI 3D creation (.glb) straight from the app.
   Uses public Hugging Face Spaces through the official Gradio client
   (vendor/gradio-client.js, Apache-2.0):
     • text  → 3D : tencent/Hunyuan3D-2  /generation_all  (caption → textured .glb)
     • image → 3D : microsoft/TRELLIS.2  /image_to_3d + /extract_glb
     • text fallback: black-forest-labs/FLUX.1-schnell /infer (picture) → TRELLIS.2
   Free (ZeroGPU). Without an account each visitor gets a small daily GPU
   quota; a free Hugging Face token (hf_…) raises it. No card, no payment.
   The token stays in this browser (localStorage) and is only sent to Hugging Face.
   ===================================================================== */
const SPACES = { text: 'tencent/Hunyuan3D-2', image: 'microsoft/TRELLIS.2', picture: 'black-forest-labs/FLUX.1-schnell' };
const TOKEN_KEY = 'forge.hfToken';
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t.trim()) : localStorage.removeItem(TOKEN_KEY); } catch {} };

/* French → English for the prompt (the 3D models understand English best). Unknown words are kept. */
const FR = { chat: 'cat', chaton: 'kitten', chien: 'dog', chiot: 'puppy', loup: 'wolf', renard: 'fox', tigre: 'tiger', lion: 'lion', ours: 'bear', panda: 'panda', lapin: 'rabbit', cerf: 'deer', licorne: 'unicorn',
  vache: 'cow', cochon: 'pig', mouton: 'sheep', poule: 'chicken', poulet: 'chicken', coq: 'rooster', canard: 'duck', cheval: 'horse', poney: 'pony', dragon: 'dragon', serpent: 'snake', poisson: 'fish', requin: 'shark',
  pieuvre: 'octopus', abeille: 'bee', papillon: 'butterfly', araignee: 'spider', hibou: 'owl', chouette: 'owl', pingouin: 'penguin', manchot: 'penguin', grenouille: 'frog', tortue: 'turtle', singe: 'monkey', souris: 'mouse',
  elephant: 'elephant', girafe: 'giraffe', zebre: 'zebra', dauphin: 'dolphin', baleine: 'whale', aigle: 'eagle', perroquet: 'parrot', phenix: 'phoenix', dinosaure: 'dinosaur', robot: 'robot', fantome: 'ghost', golem: 'golem',
  champignon: 'mushroom', slime: 'slime', axolotl: 'axolotl', epee: 'sword', bouclier: 'shield', chapeau: 'hat', couronne: 'crown', coffre: 'treasure chest', maison: 'house', chateau: 'castle', arbre: 'tree', voiture: 'car',
  rouge: 'red', bleu: 'blue', bleue: 'blue', vert: 'green', verte: 'green', jaune: 'yellow', orange: 'orange', violet: 'purple', violette: 'purple', rose: 'pink', noir: 'black', noire: 'black', blanc: 'white', blanche: 'white',
  gris: 'grey', grise: 'grey', marron: 'brown', dore: 'golden', doree: 'golden', argent: 'silver', 'arc-en-ciel': 'rainbow', feu: 'fire', glace: 'ice', eau: 'water', foudre: 'lightning', ombre: 'shadow', cosmique: 'cosmic',
  mignon: 'cute', mignonne: 'cute', petit: 'small', petite: 'small', grand: 'big', grande: 'big', geant: 'giant', geante: 'giant', bebe: 'baby', ailes: 'wings', aile: 'wing', corne: 'horn', cornes: 'horns', avec: 'with',
  et: 'and', de: 'of', des: '', du: '', un: 'a', une: 'a', le: 'the', la: 'the', les: 'the', en: '', ninja: 'ninja', pirate: 'pirate', sorcier: 'wizard', roi: 'king', reine: 'queen', zombie: 'zombie', ange: 'angel', demon: 'demon',
  cyber: 'cyber', neon: 'neon', armure: 'armor', magique: 'magic', legendaire: 'legendary', mythique: 'mythical', rare: 'rare', bois: 'wood', pierre: 'stone', cristal: 'crystal', or: 'gold' };
const strip = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '');
export function toEnglish(text) {
  return String(text || '').toLowerCase().split(/[\s,;.!?«»"]+/).filter(Boolean).map((w) => { const k = strip(w), s = k.replace(/(s|x)$/, '');
    return FR[k] !== undefined ? FR[k] : FR[s] !== undefined ? FR[s] : w; }).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(); }
export function buildPrompt(text, style) {
  const look = { voxel: 'voxel art style made of cubes, blocky', cute: 'cute chibi toy style, big head', real: 'stylized realistic', none: '' }[style] ?? '';
  return [toEnglish(text), look, 'single character, full body, standing, game asset, centered, plain white background'].filter(Boolean).join(', '); }

let lib = null; const loadLib = async () => (lib ||= await import('./vendor/gradio-client.js'));
async function connect(space, onStatus) {
  const { Client } = await loadLib(), token = getToken();
  onStatus?.({ msg: 'Connexion à ' + space + '…' });
  return Client.connect(space, { ...(/^hf_/.test(token) ? { token } : {}), events: ['data', 'status'] }); }
/* run one endpoint with live queue / progress messages */
async function run(app, endpoint, data, onStatus, signal) {
  const job = app.submit(endpoint, data); if (signal) signal.addEventListener('abort', () => { try { job.cancel(); } catch {} }, { once: true });
  for await (const m of job) {
    if (signal?.aborted) throw new Error('Annulé');
    if (m.type === 'status') {
      if (m.stage === 'error') throw new Error(friendly(m.message || 'erreur du serveur'));
      if (m.queue && m.position != null) onStatus?.({ msg: `File d'attente : ${m.position + 1}ᵉ${m.eta ? ' · ~' + Math.ceil(m.eta) + ' s' : ''}` });
      else if (m.progress_data && m.progress_data.length) { const p = m.progress_data[0]; onStatus?.({ msg: (p.desc || 'Calcul') + (p.length ? ` ${p.index}/${p.length}` : ''), frac: p.length ? p.index / p.length : null }); }
      else if (m.stage === 'pending') onStatus?.({ msg: 'Calcul sur la carte graphique…' });
    }
    if (m.type === 'data') return m.data;
  }
  throw new Error('Pas de réponse du serveur'); }
function friendly(msg) { msg = String(msg);
  if (/quota|ZeroGPU|GPU duration|exceeded/i.test(msg)) return 'Quota gratuit du jour atteint. Ajoute ton jeton Hugging Face gratuit (hf_…) ou réessaie plus tard.';
  if (/busy|queue is full|too many/i.test(msg)) return 'Le serveur est très occupé, réessaie dans une minute.';
  if (/401|403|token|unauthor/i.test(msg)) return 'Jeton Hugging Face refusé : vérifie qu’il commence par hf_ et qu’il est en lecture.';
  return msg; }
const fileUrl = (f) => (f && typeof f === 'object' ? f.url || (f.value && f.value.url) || (f.path && null) : typeof f === 'string' ? f : null);
async function fetchBytes(url, signal) { const token = getToken(), r = await fetch(url, { signal, headers: /^hf_/.test(token) && /\.hf\.space\//.test(url) ? { Authorization: 'Bearer ' + token } : {} });
  if (!r.ok) throw new Error('Téléchargement du modèle impossible (' + r.status + ')'); return new Uint8Array(await r.arrayBuffer()); }

/** text → .glb (Hunyuan3D-2; falls back to FLUX picture → TRELLIS.2) */
export async function textTo3D(text, { style = 'voxel', onStatus, signal } = {}) {
  const caption = buildPrompt(text, style);
  try {
    const app = await connect(SPACES.text, onStatus);
    const out = await run(app, '/generation_all', { caption, image: null, mv_image_front: null, mv_image_back: null, mv_image_left: null, mv_image_right: null, steps: 25, guidance_scale: 5.5, seed: 1234,
      octree_resolution: 256, check_box_rembg: true, num_chunks: 8000, randomize_seed: true }, onStatus, signal);
    const url = fileUrl(out[1]) || fileUrl(out[0]); if (!url) throw new Error('Le serveur n’a pas renvoyé de .glb');
    onStatus?.({ msg: 'Téléchargement du modèle…' }); return { bytes: await fetchBytes(url, signal), via: 'Hunyuan3D-2', prompt: caption };
  } catch (e) { if (signal?.aborted) throw e; onStatus?.({ msg: 'Hunyuan3D indisponible (' + (e.message || e) + '), plan B : image puis TRELLIS…' }); }
  const pic = await connect(SPACES.picture, onStatus);
  const img = await run(pic, '/infer', { prompt: caption, seed: 0, randomize_seed: true, width: 768, height: 768, num_inference_steps: 4 }, onStatus, signal);
  const iu = fileUrl(img[0]); if (!iu) throw new Error('Image non générée');
  onStatus?.({ msg: 'Image prête, passage en 3D…', image: iu });
  const blob = new Blob([await fetchBytes(iu, signal)], { type: 'image/webp' });
  const r = await imageTo3D(blob, { onStatus, signal }); return { ...r, via: 'FLUX + TRELLIS.2', prompt: caption, image: iu }; }

/** picture (Blob/File) → .glb with TRELLIS.2 */
export async function imageTo3D(blob, { onStatus, signal, detail = 'normal' } = {}) {
  const { handle_file } = await loadLib(), app = await connect(SPACES.image, onStatus);
  try { await run(app, '/start_session', {}, onStatus, signal); } catch { /* older builds start the session on load */ }
  await run(app, '/image_to_3d', { image: handle_file(blob), seed: Math.floor(Math.random() * 1e6), resolution: detail === 'high' ? '1024' : '512' }, onStatus, signal);
  const out = await run(app, '/extract_glb', { decimation_target: detail === 'high' ? 120000 : 40000, texture_size: detail === 'high' ? 2048 : 1024 }, onStatus, signal);
  const url = fileUrl(out[0]) || fileUrl(out[1]); if (!url) throw new Error('Le serveur n’a pas renvoyé de .glb');
  onStatus?.({ msg: 'Téléchargement du modèle…' }); return { bytes: await fetchBytes(url, signal), via: 'TRELLIS.2' }; }
