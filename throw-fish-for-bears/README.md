# THROW FISH FOR BEARS (Roblox, style Studs)

Jeu complet : **10 zones** (Green Forest → Tropical Beach), **76 ours**, **44 poissons**, 12 cannes.
Tout le monde 3D (map, ours, poissons, cannes, bouchon) est construit en **pièces Plastic + Studs** par le code :
aucun asset à importer.

## Publier depuis l'iPhone
1. Prends `build/ThrowFishForBears.rbxl` (déjà compilé) **ou** le projet Rojo (`default.project.json` + `src/`).
2. Roblox Push → publier ce fichier sur ton jeu.
3. Réglages du jeu sur Roblox (Creator Hub) :
   - **Max Players = 4** (4 bases ; un 5e joueur est renvoyé avec un message).
   - Avatar **R15** recommandé (R6 marche, poses simplifiées).
   - **Studio Access to API Services = ON** pour la sauvegarde (DataStore).

Recompiler : `rojo build default.project.json -o build/ThrowFishForBears.rbxl`

## La boucle de jeu
1. Slot **1** = canne → bout de **ton** ponton → **CAST** → attends → **HOOK!** → maintiens **REEL** (sans casser la ligne) → révélation du poisson.
2. Slot **2** = poisson (🎒 Bag pour choisir) → **Throw Zone** → maintiens **THROW** (jauge) → relâche.
3. La caméra suit le poisson → **un seul ours** sort de la forêt, court, renifle, mange (cinématique) → **tu deviens cet ours**.
4. Cours jusqu'à **ta base** (flèche + distance + chrono, **SPRINT**) → redeviens humain avec l'ours au-dessus de la tête → **PLACE**.
5. L'ours se promène dans ta base et rapporte **$/s** (espèce × rareté × poids × variante).

Force : station **FISH-UP** (modèle 3D : plateforme à studs, anneau, rack d'haltères-poissons, saumon trophée) au coin avant extérieur de ta base.
Tiens-toi dans l'anneau = entraînement auto. L'enseigne « FISH-UP » apparaît quand tu t'approches. **Shop > Strength** augmente le gain par soulevé.
Chaque zone affiche sa force recommandée (💪) sur son arche ; plus de force = lancer plus loin (jusqu'à ~3000 studs, zone 10).

## Tutoriel et annonces
- **Tutoriel** (style studs) : étapes guidées dans l'ordre, sans compteur ni barre de progression (canne → ponton → lancer → moulinet →
  tenir le poisson → Throw Zone → lancer → ours → placer → FISH-UP). Bulle avec bébé ours 3D et texte machine à écrire ; flèche voxel 3D
  au-dessus de la cible, anneau et chemin de dalles à studs jusqu'à la cible, flèche au bord de l'écran, flèche au-dessus du slot à toucher.
  Revient en arrière si besoin. Progression sauvegardée, récompense unique de $1 000, bouton X pour passer.
- **Annonces serveur** : Legendary et plus = ligne colorée dans le **chat Roblox** seulement.
  Rareté **Impossible** (au-dessus d'Ultra Secret) : un seul ours (**Cosmic Bear**) et un seul poisson (**Cosmic Koi**) ;
  eux seuls déclenchent la grande annonce à l'écran pour tout le serveur (bandeau studs, rayons, « IMPOSSIBLE!!! », confettis, colonne de lumière).

## Contenu
- **10 zones** avec décor propre : forêt, pins, lac de montagne (étangs + roseaux), forêt enneigée, lac gelé (glace), bambous (lanternes, cerisiers),
  vallée de rivière (ruisseaux + ponts), montagnes rocheuses (falaises), forêt profonde (champignons géants), plage tropicale (palmiers, parasols, mer).
  Brume, teinte et particules par zone (feuilles, aiguilles, neige, pétales, lucioles, brume, poussière, sable).
- **75 ours** (`BearConfig`) : 7 gabarits (bébé → énorme), couleurs propres et traits 3D (`Models/BearTraits.luau` : bosse, crinière, mousse,
  roches, cristaux, glaçons, écharpe, chapeaux, couronne, lunettes, masque de panda roux, queue annelée, coquillages, corail, collier de fleurs…).
- **43 poissons** (`FishConfig`) sur les 8 raretés : formes spéciales raie/manta (ailes qui battent), hippocampe, requins (marteau, grand blanc),
  baudroie (leurre lumineux), espadon/marlin (rostre), moustaches, dents, nageoires voiles…
- Bouton **Inventaire** (barre du haut, à côté du chat) = fenêtre **Bears + Fish** ; tuile **Bears** = petit panneau « X/Y Active » avec Pick Up.

## Interface (layout de la capture de référence)
Gauche : Shop / Index / Low FX · Droite : Gifts, Daily, Bears + onglet `>` (ours actifs, Pick Up, +1 Slot, Place Best) ·
Bas gauche : force + argent (+$/s) · Bas centre : hotbar (vrais modèles 3D) · Bas droite : vitesse · Haut : titre + timer **Lucky Lake** (x2 chance).
Bouton d'action contextuel (CAST / HOOK! / REEL / THROW / PLACE / SPRINT), touche **E** sur PC, **1/2/3** pour la hotbar, **Shift** = sprint ours.

## Architecture
- `src/shared` : Layout (coordonnées), Config (Rarity, Fish, Bear, Rod, Zone, Economy, Game), Formulas, Net, Models (BearBuilder, FishBuilder, RodBuilder, Variants, Studs), Util.
- `src/server` : Main + Services (PlayerData avec verrou de session, State machine, Map, Base, Equip, Fishing, Throw, BearAI, Capture, BearBase, Economy, Shop, Upgrade, Index, Reward, Security).
- `src/client` : Controllers (AnimalAnimator, HumanPose, Fishing, Throw, Capture, Camera, Actions, Fx, Sound, Ambience, Data) + UI (Theme stud kit, HUD, Menus, Reveal, Notify, Window, Viewport).

Serveur autoritaire : poissons, ours (RNG), argent, achats, placement, capture (anti-téléportation), récompenses, avec limites de débit sur chaque RemoteEvent.

## Animations
Procédurales (Motor6D.Transform, sur chaque client, aucune ID d'animation nécessaire) :
ours = idle respirant, clignement, oreilles, marche 4 temps, galop, saut/atterrissage, assis, couché, sommeil, grattage, étirement/bâillement, alerte, reniflement, manger (morsure + mastication), joie, transformation, porté ;
poissons = nage, frétillement en main, vol (lancer), saut hors de l'eau, flop au sol ; humain = lancer de canne, moulinet, porter poisson/ours, charge + lancer, soulevé d'entraînement.

## Limites connues (honnêtes)
- **Pas testé dans Roblox Studio** (pas de Studio ici) : le code compile, le .rbxl se construit et les modèles 3D ont été exécutés et rendus hors Roblox (`previews/`). Le premier essai en jeu peut révéler des réglages à ajuster.
- **Sons** : sons intégrés au client Roblox (`rbxasset://sounds/...`) superposés et re-pitchés. Pour de vrais sons, mets des IDs dans `CUSTOM` (`src/client/Controllers/Sound.luau`).
- Pas de Rebirth (volontaire). Ajouter zones/espèces = ajouter des entrées dans `ZoneConfig` / `BearConfig` / `FishConfig` (+ `Layout.ZONE_COUNT`).
