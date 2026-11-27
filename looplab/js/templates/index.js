// LOOPLAB — template catalogue.
import { fusion, rings3000, vortex } from './top.js';
import { ringEscape, spirograph, polyrhythm, mandala } from './hypnotic.js';
import { threadClash, threadRoyale, photoDuel, friendsTriangle, battleRoyale, raceTo100, elimination, colorWar, escapeRace, colorRace } from './races.js';
import { spectrum, pulse, pianoRoll, marbleMachine } from './visualizers.js';
import { hydraulicPress, stampMill, rollerCrusher, jawCrusher, pistonStar, gyratory, twinPress, compactor, leverCrusher, bladeSlicer } from './crush.js';
import { colorSort, plinko, shrinking, rainbowSand } from './satisfying.js';

export const CATEGORIES = [
  { id: 'hypno', name: 'Boucles hypnotiques', icon: '🌀', desc: 'Anneaux, spirales et motifs qu’on ne peut pas arrêter de regarder.' },
  { id: 'race', name: 'Courses & combats', icon: '🏁', desc: 'Nomme les billes, laisse les spectateurs parier en commentaire.' },
  { id: 'music', name: 'Visualiseurs musicaux', icon: '🎵', desc: 'Tout bouge au rythme de ta musique.' },
  { id: 'crush', name: 'Écraser & trancher', icon: '🔨', desc: 'Des machines industrielles, satisfaisantes niveau ASMR.' },
  { id: 'phys', name: 'Physique satisfaisante', icon: '🎯', desc: 'Billes, sable et picots qui se rangent à la perfection.' },
];

export const TOP = [fusion, rings3000, vortex];

export const TEMPLATES = [
  fusion, rings3000, vortex,
  ringEscape, spirograph, polyrhythm, mandala,
  threadClash, threadRoyale, photoDuel, friendsTriangle, battleRoyale, raceTo100, elimination, colorWar, escapeRace, colorRace,
  spectrum, pulse, pianoRoll, marbleMachine,
  hydraulicPress, stampMill, rollerCrusher, jawCrusher, pistonStar, gyratory, twinPress, compactor, leverCrusher, bladeSlicer,
  colorSort, plinko, shrinking, rainbowSand,
];
for (const t of TOP) t.top = true;
