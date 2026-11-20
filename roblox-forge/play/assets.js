/* =====================================================================
   Roblox Forge · Jouer — Roblox assets for any place.
   A place refers to its images, meshes, animations and sounds by asset id
   ("rbxassetid://123", "http://www.roblox.com/asset/?id=123", …). Browsers
   cannot read Roblox's asset servers (no CORS), so a small relay (Supabase
   Edge Function "rbx", see online/rbx-relay.ts) fetches them:
     ?id=123          → the image of an Image / Decal asset (PNG)
     ?id=123&k=asset  → the raw asset file (mesh, KeyframeSequence, audio…)
   Files are kept in the browser's Cache Storage, so every asset is
   downloaded once per device.
   ===================================================================== */
export const RELAY = 'https://myfywmjifxurhwfnihdx.supabase.co/functions/v1/rbx';
const dec = new TextDecoder();
/* the numeric asset id of any Roblox content string, or null */
export function assetId(v) {
  if (v == null) return null; if (v instanceof Uint8Array) v = dec.decode(v); if (typeof v === 'number') return v > 0 ? String(Math.floor(v)) : null;
  const s = String(v).trim(); if (!s) return null; if (/^\d+$/.test(s)) return s;
  const m = s.match(/rbxassetid:\/\/(\d+)/i) || s.match(/[?&]id=(\d+)/i) || s.match(/\/asset\/(\d+)/i) || s.match(/rbxthumb:\/\/type=Asset&id=(\d+)/i); return m ? m[1] : null;
}
/* an <img>-ready URL for an image asset (the relay answers with the PNG itself) */
export const imageURL = (id, size = '420x420') => `${RELAY}?id=${id}&s=${size}`;
const mem = new Map(), inflight = new Map(), failed = new Set();
let cacheP = null; const cache = () => (cacheP ||= (typeof caches !== 'undefined' ? caches.open('forgeplay-rbx-v1').catch(() => null) : Promise.resolve(null)));
/* raw bytes of an asset (Uint8Array) or null when Roblox does not share it */
export function fetchAsset(id) {
  id = assetId(id); if (!id) return Promise.resolve(null); if (mem.has(id)) return Promise.resolve(mem.get(id)); if (failed.has(id)) return Promise.resolve(null);
  if (inflight.has(id)) return inflight.get(id);
  const url = `${RELAY}?id=${id}&k=asset`;
  const p = (async () => {
    const c = await cache(); let r = c ? await c.match(url).catch(() => null) : null;
    if (!r) { for (let i = 0; i < 2 && !r; i++) { try { const x = await fetch(url); if (x.ok) r = x; else if (x.status === 404) break; } catch { /* retry */ } } if (r && c) c.put(url, r.clone()).catch(() => {}); }
    if (!r) { failed.add(id); return null; }
    const b = new Uint8Array(await r.arrayBuffer()); mem.set(id, b); return b;
  })().finally(() => inflight.delete(id));
  inflight.set(id, p); return p;
}
