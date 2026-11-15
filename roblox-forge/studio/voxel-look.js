/* =====================================================================
   Roblox Forge - the "voxel figurine" look inside Roblox.
   A merged block of a voxel pet is one Part; to show the little cubes it is
   made of (bevelled edge + own tint per cube) without adding parts, the pack
   ships a tile texture:
     ForgeVoxel/color.png   8×8 cubes, light grey, per-cube tint + dark bevel lines
     ForgeVoxel/normal.png  matching bevel relief (OpenGL normal map)
     ForgeVoxel/voxel.json  { cubes: 8 }
   The Roblox Push robot uploads the two images and writes the MaterialVariant
   MaterialService/ForgeVoxel at build time (its texture can only be set when
   the place is built, not by a game script). ForgeVoxelLook.server.lua then
   gives every part with the ForgeVox attribute (its cube size in studs) a copy
   of that material at the right tile size. The part Color tints the light map.
   ===================================================================== */
export const CUBES = 8;
const PX = 32; // pixels per cube

function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/** raw RGBA pixels of the two tiles (also used by the tests) */
export function tilePixels() {
  const N = CUBES * PX, color = new Uint8ClampedArray(N * N * 4), normal = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const cx = Math.floor(x / PX), cy = Math.floor(y / PX), u = x % PX, v = y % PX, i = (y * N + x) * 4;
    const e = Math.min(u, v, PX - 1 - u, PX - 1 - v);                       // distance to the cube edge (px)
    let g = 0.88 + 0.12 * hash(cx, cy);                                      // own tint per cube
    if (e < 2) g *= 0.74; else if (e < 3) g *= 0.88;                        // bevel groove
    if ((u === 2 || v === 2) && e >= 2) g = Math.min(1, g * 1.08);         // lit top-left rim
    const c = Math.round(g * 255); color.set([c, c, c, 255], i);
    let nx = 0, ny = 0; const b = 3;                                         // bevel slopes towards the edges
    if (u < b) nx = -(b - u) / b; else if (u > PX - 1 - b) nx = (u - (PX - 1 - b)) / b;
    if (v < b) ny = (b - v) / b; else if (v > PX - 1 - b) ny = -(v - (PX - 1 - b)) / b;  // image rows go down, +Y is up
    const k = 0.7, nz = Math.sqrt(Math.max(0.05, 1 - (nx * k) ** 2 - (ny * k) ** 2));
    normal.set([Math.round((nx * k * 0.5 + 0.5) * 255), Math.round((ny * k * 0.5 + 0.5) * 255), Math.round((nz * 0.5 + 0.5) * 255), 255], i);
  }
  return { size: N, color, normal };
}
async function png(size, px) {
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size });
  cv.getContext('2d').putImageData(new ImageData(px, size, size), 0, 0);
  const blob = cv.convertToBlob ? await cv.convertToBlob({ type: 'image/png' }) : await new Promise((r) => cv.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}
let kitText = null;
/** files to add to a pack that contains voxel parts */
export async function voxelLookFiles(base = '../studio/') {
  const t = tilePixels();
  if (!kitText) kitText = await (await fetch(base + 'kit/ForgeVoxelLook.server.lua', { cache: 'no-cache' })).text();
  return [{ path: 'ForgeVoxel/color.png', data: await png(t.size, t.color) }, { path: 'ForgeVoxel/normal.png', data: await png(t.size, t.normal) },
    { path: 'ForgeVoxel/voxel.json', data: JSON.stringify({ cubes: CUBES, baseMaterial: 'SmoothPlastic' }) },
    { path: 'ServerScriptService/ForgeVoxelLook.server.lua', data: kitText }];
}
