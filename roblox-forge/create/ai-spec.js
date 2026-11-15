/* =====================================================================
   Roblox Forge « Créer tout » - AI understanding (free).
   A big open model on Hugging Face (Qwen3 235B, Llama 3.3 70B, DeepSeek…,
   free monthly credits of a free Hugging Face account, no card) reads the
   sentence and answers an « intent » JSON. intentToSpec (game-spec.js)
   checks every field. Without a token, or if the AI fails, the app uses
   the rule engine. The token is the same one as the 3D AI (forge.hfToken),
   kept in this browser and only sent to huggingface.co.
   ===================================================================== */
import { intentToSpec, specToIntent } from './game-spec.js';

const URL = 'https://router.huggingface.co/v1/chat/completions';
export const MODELS = ['Qwen/Qwen3-235B-A22B-Instruct-2507', 'meta-llama/Llama-3.3-70B-Instruct', 'deepseek-ai/DeepSeek-V3-0324', 'Qwen/Qwen2.5-72B-Instruct', 'openai/gpt-oss-20b'];
export const getToken = () => { try { return localStorage.getItem('forge.hfToken') || ''; } catch { return ''; } };
export const setToken = (t) => { try { t ? localStorage.setItem('forge.hfToken', t.trim()) : localStorage.removeItem('forge.hfToken'); } catch {} };
export const hasToken = () => /^hf_[A-Za-z0-9]{20,}$/.test(getToken());

export const SYSTEM = `Tu es le concepteur de jeux Roblox de « Roblox Forge ». L'utilisateur décrit un jeu (souvent en français, parfois en anglais, avec des fautes).
Réponds UNIQUEMENT par un objet JSON (pas de texte autour) qui décrit le jeu complet selon ce schéma :
{
 "title": string,                       // nom du jeu (court)
 "genre": "simulator"|"tycoon"|"obby"|"arena"|"island"|"city"|"cave"|"sky"|"lobby",
 "theme": "plaine"|"desert"|"neige"|"lave"|"bonbon"|"neon"|"espace"|null,
 "voxel": boolean,                      // true sauf si l'utilisateur veut un style classique/lisse
 "activity": {"stat": string, "emoji": string, "tool": string, "perClick": number} | null,   // ce que le joueur fait en cliquant (pêcher → stat "Poissons", outil "Canne à pêche")
 "stats": [{"name": string, "emoji": string, "start": number}],   // stats du joueur (Force, Vitesse, Poissons, Karma…), noms courts en français
 "money": [{"name": string, "emoji": string, "start": number}],   // monnaies : "Coins" par défaut, "Gems", "Cash" (tycoon)…
 "sell": {"from": string, "to": string, "rate": number} | null,  // vendre une stat contre une monnaie
 "shop": {"items": [{"name": string, "emoji": string, "effect": "perClick"|"mult"|"sellMult"|"capacity"|"speed"|"damage"|"health", "value": number, "price": number, "money": string}]} | null,
 "rebirth": {"cost": number, "stat": string, "bonus": number} | null,
 "eggs": {"price": number, "money": string, "pets": [{"name": string, "mult": number, "chance": number}]} | null,
 "zones": number,                       // 0 ou 2 à 6 zones à débloquer
 "daily": {"amount": number, "money": string} | null,
 "codes": [{"code": string, "amount": number, "money": string}],
 "gamepass": {"mult": number} | null,
 "auto": boolean,                       // auto-clic / auto-entraînement
 "leaderboard": {"stat": string} | null,
 "combat": {"damage": number, "reward": number, "health": boolean} | null,   // PvP à l'épée
 "buttons": [{"type": "add"|"boost"|"sell"|"shop"|"rebirth"|"egg"|"home"|"train", "stat": string, "amount": number, "mult": number, "seconds": number, "cost": {"amount": number, "money": string} | null}],
 "unsupported": [string]                // ce que l'utilisateur demande et qui N'EXISTE PAS dans ce schéma (ex : "véhicules", "quêtes avec PNJ"), en français
}
Règles :
- Un simulator a toujours une activité, une vente et une monnaie. Invente des objets de boutique cohérents avec le thème (5 objets, prix croissants 50 → 60000).
- Un bouton « +N X » est {"type":"add","stat":"X","amount":N}. « qui coûte P coins » → "cost". « double … pendant 30 secondes » → {"type":"boost","mult":2,"seconds":30}.
- Garde les mots de l'utilisateur pour les noms (accents compris). Pas d'id de gamepass. Pas de champ en dehors du schéma.
- Si on te donne le jeu actuel, renvoie le jeu COMPLET modifié (garde tout ce qui n'est pas changé).`;

const EXAMPLE_IN = 'un simulator de karaté où on donne des coups de pied, avec une boutique de ceintures, la vente et un bouton +3 coups qui coûte 10 coins';
const EXAMPLE_OUT = { title: 'Karaté Simulator', genre: 'simulator', theme: null, voxel: true, activity: { stat: 'Coups', emoji: '🥋', tool: 'Gants', perClick: 1 }, stats: [{ name: 'Coups', emoji: '🥋', start: 0 }],
  money: [{ name: 'Coins', emoji: '🪙', start: 0 }], sell: { from: 'Coups', to: 'Coins', rate: 1 },
  shop: { items: [{ name: 'Ceinture jaune', emoji: '🟡', effect: 'perClick', value: 1, price: 50, money: 'Coins' }, { name: 'Ceinture verte', emoji: '🟢', effect: 'perClick', value: 3, price: 400, money: 'Coins' },
    { name: 'Ceinture bleue', emoji: '🔵', effect: 'perClick', value: 10, price: 3500, money: 'Coins' }, { name: 'Ceinture marron', emoji: '🟤', effect: 'mult', value: 2, price: 12000, money: 'Coins' }, { name: 'Ceinture noire', emoji: '⚫', effect: 'perClick', value: 50, price: 60000, money: 'Coins' }] },
  rebirth: null, eggs: null, zones: 0, daily: null, codes: [], gamepass: null, auto: false, leaderboard: null, combat: null,
  buttons: [{ type: 'add', stat: 'Coups', amount: 3, cost: { amount: 10, money: 'Coins' } }, { type: 'sell' }, { type: 'shop' }], unsupported: [] };

function extractJSON(text) {
  const t = String(text || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b <= a) throw new Error('pas de JSON dans la réponse');
  return JSON.parse(t.slice(a, b + 1));
}
function friendly(status, body) {
  if (status === 401 || status === 403) return 'Jeton Hugging Face refusé : vérifie qu’il commence par hf_ (type « Read » ou « Inference »).';
  if (status === 402) return 'Crédits IA gratuits du mois épuisés : la compréhension par règles prend le relais.';
  if (status === 429) return 'Trop de demandes : réessaie dans une minute.';
  return `IA indisponible (${status}) ${String(body || '').slice(0, 120)}`;
}

/** sentence (+ current game for an edit) → { spec, done, unsupported, model } ; throws when no model answered */
export async function aiUnderstand(text, prevSpec, { signal, onStatus, fetchImpl = fetch } = {}) {
  const token = getToken(); if (!hasToken()) throw new Error('Pas de jeton Hugging Face');
  const user = prevSpec ? `Jeu actuel :\n${JSON.stringify(specToIntent(prevSpec))}\n\nModification demandée : ${text}` : `Description du jeu : ${text}`;
  const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: 'Description du jeu : ' + EXAMPLE_IN }, { role: 'assistant', content: JSON.stringify(EXAMPLE_OUT) }, { role: 'user', content: user }];
  let lastErr = null;
  for (const model of MODELS) {
    onStatus?.(`🧠 ${model.split('/')[1]} réfléchit…`);
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 45000); signal?.addEventListener('abort', () => ctl.abort(), { once: true });
    try {
      const res = await fetchImpl(URL, { method: 'POST', signal: ctl.signal, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 2500, response_format: { type: 'json_object' } }) });
      if (!res.ok) { const body = await res.text().catch(() => ''); lastErr = new Error(friendly(res.status, body)); if (res.status === 401 || res.status === 403 || res.status === 402) throw lastErr; continue; }
      const data = await res.json(), content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      const intent = extractJSON(content), out = intentToSpec(intent, text);
      return { ...out, model };
    } catch (e) { if (signal?.aborted) throw new Error('Annulé'); lastErr = e; if (/refusé|épuisés/.test(e.message)) throw e; }
    finally { clearTimeout(timer); }
  }
  throw lastErr || new Error('IA indisponible');
}
