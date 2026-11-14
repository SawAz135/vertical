/* =====================================================================
   Roblox Forge - "Simulateur" pet style: the round, toy-like look of popular
   pet-simulator games (genre style, original shapes). One soft blob body
   (head and body together), huge glossy eyes with two shines, blush, tiny paws,
   species ears / tail / extras, and the genre's classic variants:
   ✨ Doré, 🌈 Arc-en-ciel, 💡 Néon.
   Parts use the same names as the other generators (Body, EyeL, EarL, LegFL,
   Tail1…) so the rig, the animations and the effects work unchanged.
   ===================================================================== */
const P = (name, shape, size, pos, color, extra = {}) => ({ name, shape, size, pos, rot: extra.rot || [0, 0, 0], color, material: extra.material || 'SmoothPlastic', transparency: extra.transparency || 0, ...(extra.tint ? { tint: true } : {}) });
const mirror = (part) => ({ ...part, name: part.name.replace(/L(\d*)$/, 'R$1'), pos: [-part.pos[0], part.pos[1], part.pos[2]], rot: [part.rot[0], -part.rot[1], -part.rot[2]] });
const pair = (part) => [part, mirror(part)];
const hexMix = (a, b, t) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); const c = [16, 8, 0].map((s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t)); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };

export const CHIBI_VARIANTS = { normal: '🐾 Normal', gold: '✨ Doré', rainbow: '🌈 Arc-en-ciel', neon: '💡 Néon' };

/** Build a simulator-style pet from a generated pet description (PG.generate result). */
export function chibiPet(g, sp, variant = 'normal') {
  const plan = sp ? sp.plan : 'quad', ears = sp ? sp.ears : 'round', tail = sp ? sp.tail : 'stub';
  let c1 = g.c1, c2 = g.c2;
  if (variant === 'gold') { c1 = '#ffc93c'; c2 = '#fff1b0'; }
  const dark = hexMix(c1, '#1a1020', 0.55), pink = '#ff8fb3';
  const W = plan === 'slime' || plan === 'ghost' ? 2.5 : 2.3, H = plan === 'ghost' ? 2.5 : 2.15, D = 2.15, cy = 1.32;
  const front = -D / 2; // pets look towards -Z in Roblox
  const parts = [
    P('Body', 'Ellipsoid', [W, H, D], [0, cy, 0], c1, { tint: true, material: variant === 'gold' ? 'Metal' : 'SmoothPlastic' }),
    P('Belly', 'Ellipsoid', [W * 0.62, H * 0.5, 0.5], [0, cy - H * 0.2, front + 0.28], c2),
    // eyes: big, glossy, slightly apart, with two shines and a soft blush
    ...pair(P('EyeL', 'Ellipsoid', [0.46, 0.6, 0.22], [0.42, cy + 0.18, front + 0.1], '#120c18')),
    ...pair(P('ShineL', 'Ball', [0.17, 0.17, 0.17], [0.5, cy + 0.33, front + 0.0], '#ffffff', { material: 'Neon' })),
    ...pair(P('Shine2L', 'Ball', [0.08, 0.08, 0.08], [0.36, cy + 0.06, front + 0.0], '#ffffff', { material: 'Neon' })),
    ...pair(P('BlushL', 'Ellipsoid', [0.36, 0.17, 0.1], [0.74, cy - 0.12, front + 0.2], pink, { transparency: 0.25 })),
    P('Mouth', 'Ellipsoid', [0.2, 0.09, 0.08], [0, cy - 0.16, front + 0.04], dark),
    P('Nose', 'Ellipsoid', [0.16, 0.11, 0.1], [0, cy - 0.02, front + 0.02], hexMix(c1, '#2a1220', 0.7)),
  ];
  // paws (tiny, pet-sim style) except for floating / no-leg species
  const floaty = ['ghost', 'jelly', 'slime', 'fish', 'snake', 'eyeball', 'star', 'octo'].includes(plan);
  if (!floaty) for (const [n, x, z] of [['LegFL', 0.62, -0.5], ['LegBL', 0.62, 0.55]]) parts.push(...pair(P(n, 'Ellipsoid', [0.55, 0.42, 0.6], [x, 0.22, z], c1, { tint: true })));
  // ears
  const ear = { pointy: () => P('EarL', 'Ellipsoid', [0.42, 0.8, 0.3], [0.62, cy + H * 0.46, -0.1], c1, { tint: true, rot: [0, 0, -18] }),
    pointyBig: () => P('EarL', 'Ellipsoid', [0.5, 1.05, 0.3], [0.62, cy + H * 0.5, -0.1], c1, { tint: true, rot: [0, 0, -16] }),
    round: () => P('EarL', 'Ellipsoid', [0.55, 0.55, 0.3], [0.7, cy + H * 0.42, 0], c1, { tint: true }),
    floppy: () => P('EarL', 'Ellipsoid', [0.4, 0.95, 0.3], [W * 0.5, cy + 0.25, 0], dark, { rot: [0, 0, 22] }),
    long: () => P('EarL', 'Ellipsoid', [0.36, 1.35, 0.26], [0.4, cy + H * 0.62, 0.05], c1, { tint: true, rot: [0, 0, -8] }),
    fin: () => P('EarL', 'Ellipsoid', [0.2, 0.7, 0.5], [0.62, cy + H * 0.45, 0.1], c2, { rot: [0, 0, -25] }),
    gills: () => P('EarL', 'Ellipsoid', [0.7, 0.22, 0.2], [W * 0.5, cy + 0.35, 0], pink, { rot: [0, 0, 25] }) }[ears];
  if (ear) { const e = ear(); parts.push(...pair(e)); if (['pointy', 'pointyBig', 'round', 'long'].includes(ears)) parts.push(...pair(P('EarInL', 'Ellipsoid', [e.size[0] * 0.55, e.size[1] * 0.6, 0.12], [e.pos[0], e.pos[1] - 0.04, e.pos[2] - 0.12], pink, { rot: e.rot }))); }
  // tails
  const tl = { curl: [0.32, 0.9, 0.32], wag: [0.3, 0.75, 0.3], fluffy: [0.6, 1.0, 0.6], long: [0.24, 1.2, 0.24], tuft: [0.24, 1.0, 0.24], stub: [0.42, 0.42, 0.42], puff: [0.55, 0.55, 0.55], mane: [0.45, 1.1, 0.45], dragon: [0.4, 1.1, 0.4], fishtail: [0.2, 0.9, 0.7] }[tail];
  if (tl) parts.push(P('Tail1', 'Ellipsoid', tl, [0, cy - 0.15 + tl[1] * 0.25, D / 2 + tl[1] * 0.25], tail === 'puff' ? '#ffffff' : c1, { tint: tail !== 'puff', rot: [tail === 'stub' || tail === 'puff' ? 0 : 50, 0, 0] }));
  // species extras
  const sid = g.species;
  if (sid === 'licorne') parts.push(P('Horn', 'Ellipsoid', [0.22, 0.75, 0.22], [0, cy + H * 0.55, front + 0.45], '#ffd45c', { material: 'Neon', rot: [-15, 0, 0] }));
  if (sid === 'dragon' || plan === 'bird' || plan === 'bee' || plan === 'butterfly') parts.push(...pair(P('WingL', 'Ellipsoid', plan === 'butterfly' ? [1.3, 1.1, 0.12] : [0.9, 0.6, 0.12], [W * 0.5 + 0.2, cy + 0.35, 0.3], plan === 'bee' ? '#dff6ff' : c2, { rot: [0, -25, 20], transparency: plan === 'bee' ? 0.35 : 0 })));
  if (sid === 'dragon') parts.push(...pair(P('HornL', 'Ellipsoid', [0.18, 0.55, 0.18], [0.45, cy + H * 0.5, 0.15], '#fff1d6', { rot: [-20, 0, -15] })));
  if (plan === 'bird') parts.push(P('Beak', 'Ellipsoid', [0.3, 0.2, 0.36], [0, cy - 0.06, front - 0.08], '#ffb23e'));
  if (plan === 'robot') parts.push(P('Antenna', 'Cylinder', [0.6, 0.08, 0.08], [0, cy + H * 0.6, 0], '#9aa3b5', { rot: [0, 0, 90] }), P('AntennaTip', 'Ball', [0.22, 0.22, 0.22], [0, cy + H * 0.6 + 0.32, 0], '#ff4d6d', { material: 'Neon' }));
  if (plan === 'octo') for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; parts.push(P('Tentacle' + (i + 1), 'Ellipsoid', [0.34, 0.75, 0.34], [Math.cos(a) * 0.75, 0.35, Math.sin(a) * 0.7], c1, { tint: true })); }
  if (plan === 'shroom') parts.push(P('Cap', 'Ellipsoid', [W * 1.25, 1.1, D * 1.2], [0, cy + H * 0.45, 0], '#ff4d6d'), ...[[0.5, 0.25], [-0.6, -0.1], [0.1, -0.6]].map(([x, z], i) => P('Spot' + (i + 1), 'Ball', [0.3, 0.3, 0.3], [x, cy + H * 0.45 + 0.42, z], '#ffffff')));
  if (plan === 'ghost') parts.push(...[-0.6, 0, 0.6].map((x, i) => P('Wisp' + (i + 1), 'Ellipsoid', [0.55, 0.5, 0.55], [x, cy - H * 0.45, 0.1], c1, { tint: true })));
  // variants
  if (variant === 'neon') for (const p of parts) if (p.name !== 'Body' && p.name !== 'Belly' && (p.tint || /^(Ear|Tail|Horn|Wing|Leg|Tentacle|Wisp)/.test(p.name))) { p.material = 'Neon'; p.transparency = Math.max(p.transparency, 0.1); }
  if (variant === 'gold') for (const p of parts) if (p.tint) p.material = 'Metal';
  return parts;
}

/** Effects that go with each variant (merged over the generated pet's own effects). */
export function chibiFx(variant, g) {
  if (variant === 'gold') return { sparkles: { c1: '#fff3b0', rate: 22, size: 0.3 }, glow: { c1: '#ffd45c', brightness: 1.2, range: 9 }, outline: { c1: '#ffe27a' } };
  if (variant === 'rainbow') return { rainbow: {}, sparkles: { c1: '#ffffff', rate: 14, size: 0.26 } };
  if (variant === 'neon') return { glow: { c1: g.glow || g.c1, brightness: 2, range: 12 }, aura: { c1: g.c1, c2: '#ffffff', rate: 26 } };
  return {};
}
