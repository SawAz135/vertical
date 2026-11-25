/* =====================================================================
   Roblox Forge · Jouer — Terrain built by scripts.
   Voxels of 4 studs like Roblox's, each with a material and an occupancy,
   stored in chunks of 16³. Terrain:FillBlock / FillBall / FillCylinder /
   FillWedge / FillRegion / Clear / ReplaceMaterial / ReadVoxels /
   WriteVoxels / ReadVoxelChannels-free subset / WorldToCell / CellToWorld /
   GetMaterialColor / SetMaterialColor work; the 3D view draws the chunks
   that changed (live/terrain3d.js) and the player collides with them.
   ===================================================================== */
import { Instance, Vector3, CFrame, enumItem, EnumItem, Color3, Simple } from './roblox.js?v=11';
import { LuaTable } from './luau.js?v=11';

const fn = (f) => f;
export const VOX = 4, CH = 16;
export const MATS = ['Air', 'Water', 'Grass', 'Slate', 'Concrete', 'Brick', 'Sand', 'WoodPlanks', 'Rock', 'Glacier', 'Snow', 'Sandstone', 'Mud', 'Basalt', 'Ground', 'CrackedLava', 'Asphalt', 'Cobblestone', 'Ice', 'LeafyGrass', 'Salt', 'Limestone', 'Pavement'];
export const MAT_COLOR = { Water: [12, 84, 92], Grass: [106, 127, 63], Slate: [63, 127, 107], Concrete: [127, 102, 63], Brick: [138, 86, 62], Sand: [143, 126, 95], WoodPlanks: [139, 109, 79], Rock: [102, 108, 111], Glacier: [101, 176, 234], Snow: [195, 199, 218],
  Sandstone: [137, 90, 71], Mud: [58, 46, 36], Basalt: [30, 30, 37], Ground: [102, 92, 59], CrackedLava: [232, 156, 74], Asphalt: [115, 123, 107], Cobblestone: [132, 123, 90], Ice: [129, 194, 224], LeafyGrass: [115, 132, 74], Salt: [198, 189, 181], Limestone: [206, 173, 148], Pavement: [148, 148, 140] };
const MID = Object.fromEntries(MATS.map((m, i) => [m, i]));
const matIdOf = (m) => { const n = m instanceof EnumItem ? m.name : String(m || 'Grass'); return MID[n] ?? MID.Grass; };
export class TerrainData {
  constructor(engine) { this.E = engine; this.chunks = new Map(); this.dirty = new Set(); this.colors = { ...MAT_COLOR }; this.install(); }
  ck(cx, cy, cz) { return cx + ',' + cy + ',' + cz; }
  chunk(cx, cy, cz, make) { const k = this.ck(cx, cy, cz); let c = this.chunks.get(k); if (!c && make) { c = { cx, cy, cz, m: new Uint8Array(CH * CH * CH), o: new Uint8Array(CH * CH * CH) }; this.chunks.set(k, c); } return c; }
  get(x, y, z) { const c = this.chunk(Math.floor(x / CH), Math.floor(y / CH), Math.floor(z / CH)); if (!c) return [0, 0]; const i = ((x - c.cx * CH) * CH + (y - c.cy * CH)) * CH + (z - c.cz * CH); return [c.m[i], c.o[i]]; }
  set(x, y, z, mat, occ) { const cx = Math.floor(x / CH), cy = Math.floor(y / CH), cz = Math.floor(z / CH); const c = this.chunk(cx, cy, cz, mat !== 0); if (!c) return; const i = ((x - cx * CH) * CH + (y - cy * CH)) * CH + (z - cz * CH);
    c.m[i] = occ > 0 ? mat : 0; c.o[i] = mat === 0 ? 0 : Math.round(Math.max(0, Math.min(1, occ)) * 255); this.dirty.add(c); }
  /* fill every voxel whose centre passes inside(worldX, worldY, worldZ) → occupancy (0..1) */
  fill(min, max, mat, inside) { const id = matIdOf(mat); const x0 = Math.floor(min[0] / VOX), x1 = Math.ceil(max[0] / VOX), y0 = Math.floor(min[1] / VOX), y1 = Math.ceil(max[1] / VOX), z0 = Math.floor(min[2] / VOX), z1 = Math.ceil(max[2] / VOX); let n = 0;
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) { const o = inside((x + 0.5) * VOX, (y + 0.5) * VOX, (z + 0.5) * VOX); if (o > 0) { if (id === 0) this.set(x, y, z, 0, 0); else { const [, oo] = this.get(x, y, z); this.set(x, y, z, id, Math.max(o, oo / 255)); } if (++n > 4e6) return; } } }
  boxFill(cf, size, mat, shape = 'block') { const inv = cf.inverse(), h = [size.x / 2, size.y / 2, size.z / 2]; const ext = Math.hypot(...h) + VOX;
    this.fill([cf.p[0] - ext, cf.p[1] - ext, cf.p[2] - ext], [cf.p[0] + ext, cf.p[1] + ext, cf.p[2] + ext], mat, (x, y, z) => { const l = inv.pointToWorld({ x, y, z }); const ax = Math.abs(l.x), ay = Math.abs(l.y), az = Math.abs(l.z);
      if (shape === 'wedge') { if (ax > h[0] + 2 || ay > h[1] + 2 || az > h[2] + 2) return 0; return (l.y + h[1]) / (2 * h[1]) <= (l.z + h[2]) / (2 * h[2]) + 0.05 ? 1 : 0; }
      if (shape === 'cyl') { const r = Math.hypot(l.x, l.z); return ay <= h[1] + 2 && r <= h[0] + 2 ? Math.max(0, Math.min(1, (h[0] + 2 - r) / VOX, (h[1] + 2 - ay) / VOX)) : 0; }
      return ax <= h[0] + 2 && ay <= h[1] + 2 && az <= h[2] + 2 ? Math.max(0, Math.min(1, (h[0] + 2 - ax) / VOX, (h[1] + 2 - ay) / VOX, (h[2] + 2 - az) / VOX)) : 0; }); }
  region(r) { const c = r && r.f && r.f.CFrame, s = r && r.f && r.f.Size; if (!c || !s) return null; return { min: [c.p[0] - s.x / 2, c.p[1] - s.y / 2, c.p[2] - s.z / 2], max: [c.p[0] + s.x / 2, c.p[1] + s.y / 2, c.p[2] + s.z / 2] }; }
  install() {
    const E = this.E, rt = E.rt, self = this, CM = rt.classMethods; const ws = rt.workspace; let T = ws.kids.find((k) => k.cls === 'Terrain'); if (!T) { T = new Instance('Terrain', rt); T.props.set('Name', 'Terrain'); T.props.set('Anchored', true); T.parent = ws; ws.kids.unshift(T); }
    T.props.set('WaterColor', T.props.get('WaterColor') || new Color3(12 / 255, 84 / 255, 92 / 255)); T.props.set('WaterTransparency', T.props.get('WaterTransparency') ?? 0.3); this.inst = T;
    const tbl3 = (nx, ny, nz, f) => { const X = new LuaTable(); for (let x = 0; x < nx; x++) { const Y = new LuaTable(); for (let y = 0; y < ny; y++) { const Z = new LuaTable(); for (let z = 0; z < nz; z++) Z.arr.push(f(x, y, z)); Y.arr.push(Z); } X.arr.push(Y); } return X; };
    CM.Terrain = {
      FillBlock: fn((a) => { self.boxFill(a[1], a[2], a[3]); return []; }),
      FillBall: fn((a) => { const c = a[1], r = a[2]; self.fill([c.x - r - 4, c.y - r - 4, c.z - r - 4], [c.x + r + 4, c.y + r + 4, c.z + r + 4], a[3], (x, y, z) => Math.max(0, Math.min(1, (r + 2 - Math.hypot(x - c.x, y - c.y, z - c.z)) / VOX))); return []; }),
      FillCylinder: fn((a) => { self.boxFill(a[1], new Vector3(a[3] * 2, a[2], a[3] * 2), a[4], 'cyl'); return []; }),
      FillWedge: fn((a) => { self.boxFill(a[1], a[2], a[3], 'wedge'); return []; }),
      FillRegion: fn((a) => { const R = self.region(a[1]); if (R) self.fill(R.min, R.max, a[3], () => 1); return []; }),
      Clear: fn(() => { for (const c of self.chunks.values()) { c.m.fill(0); c.o.fill(0); self.dirty.add(c); } return []; }),
      ReplaceMaterial: fn((a) => { const R = self.region(a[1]); if (!R) return []; const from = matIdOf(a[3]), to = matIdOf(a[4]);
        for (let x = Math.floor(R.min[0] / VOX); x < Math.ceil(R.max[0] / VOX); x++) for (let y = Math.floor(R.min[1] / VOX); y < Math.ceil(R.max[1] / VOX); y++) for (let z = Math.floor(R.min[2] / VOX); z < Math.ceil(R.max[2] / VOX); z++) { const [m, o] = self.get(x, y, z); if (m === from) self.set(x, y, z, to, o / 255); } return []; }),
      ReadVoxels: fn((a) => { const R = self.region(a[1]); if (!R) return [new LuaTable(), new LuaTable()]; const x0 = Math.floor(R.min[0] / VOX), y0 = Math.floor(R.min[1] / VOX), z0 = Math.floor(R.min[2] / VOX); const nx = Math.round((R.max[0] - R.min[0]) / VOX), ny = Math.round((R.max[1] - R.min[1]) / VOX), nz = Math.round((R.max[2] - R.min[2]) / VOX);
        const mats = tbl3(nx, ny, nz, (x, y, z) => enumItem('Material', MATS[self.get(x0 + x, y0 + y, z0 + z)[0]])), occ = tbl3(nx, ny, nz, (x, y, z) => self.get(x0 + x, y0 + y, z0 + z)[1] / 255);
        mats.props = { Size: new Vector3(nx, ny, nz) }; return [mats, occ]; }),
      WriteVoxels: fn((a) => { const R = self.region(a[1]); if (!R) return []; const x0 = Math.floor(R.min[0] / VOX), y0 = Math.floor(R.min[1] / VOX), z0 = Math.floor(R.min[2] / VOX); const M = a[3], O = a[4];
        M.arr.forEach((Y, x) => Y.arr.forEach((Z, y) => Z.arr.forEach((m, z) => { const o = O && O.arr[x] && O.arr[x].arr[y] ? O.arr[x].arr[y].arr[z] ?? 1 : 1; self.set(x0 + x, y0 + y, z0 + z, matIdOf(m), o); }))); return []; }),
      WorldToCell: fn((a) => [new Vector3(Math.floor(a[1].x / VOX), Math.floor(a[1].y / VOX), Math.floor(a[1].z / VOX))]), WorldToCellPreferSolid: fn((a) => [new Vector3(Math.floor(a[1].x / VOX), Math.floor(a[1].y / VOX), Math.floor(a[1].z / VOX))]), WorldToCellPreferEmpty: fn((a) => [new Vector3(Math.floor(a[1].x / VOX), Math.floor(a[1].y / VOX), Math.floor(a[1].z / VOX))]),
      CellCenterToWorld: fn((a) => [new Vector3((a[1] + 0.5) * VOX, (a[2] + 0.5) * VOX, (a[3] + 0.5) * VOX)]), CellCornerToWorld: fn((a) => [new Vector3(a[1] * VOX, a[2] * VOX, a[3] * VOX)]),
      GetMaterialColor: fn((a) => { const c = self.colors[a[1] instanceof EnumItem ? a[1].name : a[1]] || [128, 128, 128]; return [new Color3(c[0] / 255, c[1] / 255, c[2] / 255)]; }),
      SetMaterialColor: fn((a) => { const c = a[2]; self.colors[a[1] instanceof EnumItem ? a[1].name : a[1]] = [c.r * 255, c.g * 255, c.b * 255]; for (const ch of self.chunks.values()) self.dirty.add(ch); return []; }),
      CountCells: fn(() => { let n = 0; for (const c of self.chunks.values()) for (const m of c.m) if (m) n++; return [n]; }),
      GetMaxExtents: fn(() => [new Simple('Region3int16', { Min: new Vector3(-32000, -32000, -32000), Max: new Vector3(32000, 32000, 32000) })]), PasteRegion: fn(() => []), CopyRegion: fn(() => [new Instance('TerrainRegion', rt)]), ConvertToSmooth: fn(() => []), AutowedgeCells: fn(() => []), SetCell: fn(() => []), GetCell: fn(() => []),
    };
    void CFrame;
  }
}
