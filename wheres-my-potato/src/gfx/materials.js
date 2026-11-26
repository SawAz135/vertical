import * as THREE from 'three';
import { getSet } from './textures.js';

// Material library. userData.tile = metres covered by one texture repeat; geometry helpers
// (build.js) generate world-space UVs from it so every surface tiles at a consistent scale.
export function createMaterials(texSize = 512) {
  const S = n => getSet(n, texSize);
  const std = (set, o = {}) => {
    const { tile, ...rest } = o;
    const m = new THREE.MeshStandardMaterial(Object.assign({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, roughness: 1, metalness: 0 }, rest));
    m.userData.tile = tile || 2;
    return m;
  };
  // Lazy: a texture set is only painted the first time a material that uses it is requested.
  const D = {}, cache = {};
  D.concrete = () => std(S('concrete'), { tile: 4 });
  D.concreteDusty = () => std(S('concrete'), { tile: 4, color: new THREE.Color(1.08, 1.04, 0.96) });
  D.concreteWet = () => std(S('concrete'), { tile: 4, color: new THREE.Color(0.62, 0.62, 0.64), roughness: 0.35, envMapIntensity: 1.4 });
  D.concreteDark = () => std(S('concrete'), { tile: 3, color: new THREE.Color(0.55, 0.53, 0.5) });
  D.plaster = () => std(S('plaster'), { tile: 3 });
  D.frost = () => std(S('plaster'), { tile: 3, color: new THREE.Color(0.8, 0.9, 1.02), roughness: 0.6 });
  D.corrugated = () => std(S('corrugated'), { tile: 3, metalness: 0.55, envMapIntensity: 0.7 });
  D.corrugatedRed = () => std(S('corrugated'), { tile: 3, metalness: 0.4, color: new THREE.Color(0.75, 0.32, 0.25) });
  D.corrugatedGreen = () => std(S('corrugated'), { tile: 3, metalness: 0.4, color: new THREE.Color(0.38, 0.5, 0.42) });
  D.wood = () => std(S('wood'), { tile: 2.4 });
  D.woodDark = () => std(S('wood'), { tile: 2.4, color: new THREE.Color(0.6, 0.5, 0.42) });
  D.crate = () => std(S('crateWood'), { tile: 1.3 });
  D.metal = () => std(S('metal'), { tile: 1.5, metalness: 0.85, envMapIntensity: 1.0 });
  D.paintYellow = () => std(S('paintedMetal'), { tile: 1.2, color: new THREE.Color(0.95, 0.68, 0.08), metalness: 0.3 });
  D.paintBlue = () => std(S('paintedMetal'), { tile: 1.2, color: new THREE.Color(0.18, 0.3, 0.55), metalness: 0.3 });
  D.paintGreen = () => std(S('paintedMetal'), { tile: 1.2, color: new THREE.Color(0.25, 0.4, 0.3), metalness: 0.3 });
  D.paintRed = () => std(S('paintedMetal'), { tile: 1.2, color: new THREE.Color(0.62, 0.1, 0.08), metalness: 0.3 });
  D.paintGrey = () => std(S('paintedMetal'), { tile: 1.2, color: new THREE.Color(0.55, 0.56, 0.55), metalness: 0.4 });
  D.paintCream = () => std(S('paintedMetal'), { tile: 1.2, color: new THREE.Color(0.86, 0.82, 0.7), metalness: 0.2 });
  D.grate = () => std(S('grate'), { tile: 1, metalness: 0.8, alphaTest: 0.5, side: THREE.DoubleSide });
  D.gravel = () => std(S('gravel'), { tile: 1.3, color: new THREE.Color(0.62, 0.57, 0.5) });
  D.soil = () => std(S('soil'), { tile: 3 });
  D.grass = () => std(S('grass'), { tile: 2.5 });
  D.mud = () => std(S('mud'), { tile: 3, envMapIntensity: 1.2 });
  D.straw = () => std(S('straw'), { tile: 1.6 });
  D.hay = () => std(S('straw'), { tile: 0.9, color: new THREE.Color(1.1, 1.05, 0.85) });
  D.cardboard = () => std(S('cardboard'), { tile: 1 });
  D.rubber = () => std(S('rubber'), { tile: 1 });
  D.plastic = () => std(S('plastic'), { tile: 0.6, roughness: 0.5 });
  D.plasticRed = () => std(S('plastic'), { tile: 0.6, color: new THREE.Color(2.2, 0.5, 0.35), roughness: 0.5 });
  D.snow = () => std(S('snow'), { tile: 3 });
  D.asphalt = () => std(S('asphalt'), { tile: 8 });
  D.brick = () => std(S('brick'), { tile: 2.5 });
  D.pile = () => std(S('potatoPile'), { tile: 1.1 });
  D.plaid = () => std(S('fabricPlaid'), { tile: 0.35 });
  D.canvas = () => std(S('fabricCanvas'), { tile: 0.5 });
  D.denim = () => std(S('denim'), { tile: 0.4 });
  D.skin = () => std(S('skin'), { tile: 0.25 });
  D.leather = () => std(S('leather'), { tile: 0.4 });
  D.water = () => Object.assign(new THREE.MeshStandardMaterial({ color: 0x223038, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.82, envMapIntensity: 2.0, normalMap: S('concrete').normalMap, normalScale: new THREE.Vector2(0.15, 0.15) }), { userData: { tile: 2 } });
  D.glass = () => new THREE.MeshPhysicalMaterial({ color: 0xaac4c8, roughness: 0.05, metalness: 0, transmission: 0.0, transparent: true, opacity: 0.28, envMapIntensity: 1.5 });
  D.glassDirty = () => new THREE.MeshStandardMaterial({ color: 0x8a9a88, roughness: 0.4, transparent: true, opacity: 0.55 });
  D.lampOn = () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffe2a8, emissiveIntensity: 3 });
  D.lampCold = () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xcfe6ff, emissiveIntensity: 3 });
  D.lampSodium = () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb15a, emissiveIntensity: 3 });
  D.black = () => new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.5 });
  D.rubberBlack = () => new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  D.chrome = () => new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.15, metalness: 1, envMapIntensity: 1.3 });
  D.brass = () => new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.3, metalness: 1 });
  D.screen = () => new THREE.MeshStandardMaterial({ color: 0x0a120c, emissive: 0x2a6a3a, emissiveIntensity: 0.8, roughness: 0.2 });
  D.paper = () => new THREE.MeshStandardMaterial({ color: 0xefe6cf, roughness: 0.95, side: THREE.DoubleSide });
  D.bark = () => std(S('wood'), { tile: 0.8, color: new THREE.Color(0.35, 0.3, 0.27) });
  return new Proxy(cache, { get(t, k) { if (!(k in t) && D[k]) { t[k] = D[k](); t[k].name = String(k); if (!t[k].userData.tile) t[k].userData.tile = 1; } return t[k]; } });
}
