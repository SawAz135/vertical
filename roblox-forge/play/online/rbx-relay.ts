// rbx: CORS relay for public Roblox assets (images, meshes, animations, sounds), so a browser
// game player can load the assets a place refers to by rbxassetid.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, OPTIONS' };
const UA = { 'user-agent': 'Roblox/WinInet', accept: '*/*' };
async function thumb(id: string, size: string) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${id}&returnPolicy=PlaceHolder&size=${size}&format=Png&isCircular=false`);
    const j = await r.json().catch(() => null); const d = j && j.data && j.data[0];
    if (d && d.state === 'Completed' && d.imageUrl) return d.imageUrl;
    if (d && d.state !== 'Pending') return null; await new Promise((s) => setTimeout(s, 600));
  }
  return null;
}
async function asset(id: string) {
  const key = Deno.env.get('ROBLOX_KEY'); const tries = [
    key ? { u: `https://apis.roblox.com/asset-delivery-api/v1/assetId/${id}`, h: { 'x-api-key': key }, loc: true } : null,
    { u: `https://assetdelivery.roblox.com/v1/asset/?id=${id}`, h: UA },
    { u: `https://assetdelivery.roblox.com/v2/assetId/${id}`, h: UA, loc: true },
  ].filter(Boolean) as { u: string; h: Record<string, string>; loc?: boolean }[];
  for (const t of tries) {
    try { const r = await fetch(t.u, { headers: t.h }); if (!r.ok) continue;
      if (t.loc) { const j = await r.json(); const loc = j.location || (j.locations && j.locations[0] && j.locations[0].location); if (!loc) continue; const b = await fetch(loc); if (b.ok) return b; continue; }
      return r; } catch { /* next */ }
  }
  return null;
}
function imageType(b: Uint8Array) {
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png'; if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg'; if (b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return 'image/webp'; if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp'; return null;
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const u = new URL(req.url); const id = (u.searchParams.get('id') || '').replace(/\D/g, ''); const k = u.searchParams.get('k') || 'img';
  if (!id) return new Response('id?', { status: 400, headers: CORS });
  const cache = { 'cache-control': 'public, max-age=604800, immutable' };
  if (k === 'img') {
    // the original image file (exact pixels, for sprite sheets); a Decal points to its image; else the thumbnail
    let cur = id;
    for (let hop = 0; hop < 2; hop++) {
      const r = await asset(cur); if (!r) break; const b = new Uint8Array(await r.arrayBuffer()); const type = imageType(b);
      if (type) return new Response(b, { headers: { ...CORS, ...cache, 'content-type': type } });
      const txt = new TextDecoder().decode(b.subarray(0, 4000)); const m = txt.match(/<url>[^<]*?(?:id=|rbxassetid:\/\/)(\d+)/i) || txt.match(/(?:\?id=|rbxassetid:\/\/)(\d+)/); if (!m || m[1] === cur) break; cur = m[1];
    }
    const url = await thumb(id, u.searchParams.get('s') || '420x420'); if (!url) return new Response('none', { status: 404, headers: CORS });
    const r = await fetch(url); return new Response(r.body, { headers: { ...CORS, ...cache, 'content-type': r.headers.get('content-type') || 'image/png' } });
  }
  const r = await asset(id); if (!r) return new Response('none', { status: 404, headers: CORS });
  return new Response(r.body, { headers: { ...CORS, ...cache, 'content-type': 'application/octet-stream' } });
});
