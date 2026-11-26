# WHERE'S MY POTATO? — la grande récolte de Gérard

Jeu 3D à la première personne, dans le navigateur (PC + iPhone), entièrement généré par le code :
modèles, textures, shaders, sons et musique. Aucune image ni aucun son externe.

**Lancer :** servir le dossier en HTTP (ex. `python3 -m http.server` dans ce dossier, ou GitHub Pages),
puis ouvrir `index.html`. Les modules ES ne fonctionnent pas en `file://`.

## Le jeu
- Un champ en plein air couvert de dizaines de milliers de patates (instanciées sur le GPU, chacune unique :
  forme, variété, yeux, taches, germe, déformées dans le vertex shader). Elles repoussent toutes seules.
- Ramasse-les à la main ou au seau (aimant de ramassage), verse-les dans **le bac** : la roue à aubes les pose
  sur le **convoyeur**, qui les fait monter jusqu'au **bocal en verre géant**.
- Chaque patate tombée dans le bocal rapporte des francs. Le bocal se remplit vraiment (physique d'empilement),
  et quand il est plein **ça déborde** : les patates roulent du bord et s'entassent par terre (tu peux marcher dedans).
- **Chez Gérard** (PNJ animé : regard, clignements, bouche sur sa voix, gestes) : 7 lignes d'améliorations
  (seaux, gants, râteau aimanté, bottes, moteur, engrais, contrats).
- **La Grande Vente** : prestige avec cinématique (le bocal est vendu à la friterie, ×1,25 permanent par vente).
- Cycle jour/nuit (aube, coucher de soleil, étoiles, lune, lampadaires, lucioles), 18 succès, Patatothèque
  (6 variétés + patates à visage, en cœur, jumelles, dorées), sauvegarde automatique.
- Menu principal cinématique (la ferme tourne en démo), **tutoriel dans un livre en papier** aux pages qui se tournent en 3D.

## Commandes
PC : ZQSD/WASD, souris, Maj courir, Espace sauter, C s'accroupir, clic ou E ramasser/verser/parler,
1 mains, 2 seau (ou molette), G lancer, Échap pause. Manette compatible.
iPhone : glisser à gauche pour marcher, à droite pour regarder, boutons ✋ ⤒ ⇄ ↯ ».

## Code (`src/`)
- `world/potatoes.js` base de patates + shader instancié · `world/dynpotatoes.js` physique (sphères, roulement,
  sommeil, empilement, contraintes du bocal) · `world/field.js` terrain, ciel, jour/nuit · `world/machine.js`
  bac, convoyeur, bocal · `world/shop.js` boutique + catalogue · `actors/npc.js` Gérard
- `player/player.js` déplacements, caméra, bras en IK, outils · `audio/audio.js` synthèse WebAudio
- `ui/ui.js`, `ui/book.js` interface et livre · `game/achievements.js` · `main.js` boucle, états, économie, sauvegarde
- `window.__game.step(sec)` avance la simulation sans rendu (tests automatisés).

Bibliothèques : three.js r169 (MIT), polices Luckiest Guy / Fredoka / Permanent Marker (OFL), voir `vendor/` et `fonts/`.
