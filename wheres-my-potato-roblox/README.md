# WHERE'S MY POTATO? — version Roblox (1re personne)

Le même jeu que la version web, en Roblox : un désert de patates à perte de vue, Gérard et sa boutique,
le bac, le tapis en spirale qui monte au sommet en **1 seconde**, et le **bocal géant** (un gratte-ciel de 30 m)
qui se remplit puis déborde. Tout est construit par le code : aucun modèle ni aucun son à importer.

## Publier depuis l'iPhone
1. Prends `build/WheresMyPotato.rbxl` (déjà compilé) **ou** le projet Rojo (`default.project.json` + `src/`).
2. Roblox Push → publier ce fichier sur ton jeu.
3. Réglages du jeu sur Roblox (Creator Hub) :
   - **Studio Access to API Services = ON** (sauvegarde DataStore).
   - **Max Players = 6** (toi + tes amis invités).
   - Avatar R15 conseillé (en 1re personne on ne voit que les bras du jeu).

Recompiler : `rojo build default.project.json -o build/WheresMyPotato.rbxl`

## Solo + Multijoueur
- Chaque joueur arrive dans **son propre serveur privé** (le serveur public ne sert que de sas : téléportation
  immédiate vers un serveur réservé qui t'appartient).
- Bouton **👥 Multijoueur** : invitation Roblox à un ami. L'ami arrive directement dans **ton** désert
  (le code de ton serveur voyage dans l'invitation) et vous remplissez le même bocal.
- Dans Roblox Studio (test), tout le monde joue dans le même serveur local : les téléportations ne marchent qu'en jeu publié.

## Le jeu
- **Ramasser** : vise une patate, clic / ✋. Dessus, il n'y a que des **dorées**.
- **Creuser** : ramasse au même endroit → le tas se creuse vraiment (le Terrain est creusé, les patates du bord
  roulent dedans) et une autre patate apparaît dessous. Plus c'est profond, plus il y a de **violettes** (25 ₣).
  Les trous se rebouchent tout seuls en 2 minutes.
- **Outils** : mains (3, 5, 8 avec les gants), **seau** (12 → 160, avec râteau aimanté), **aspirateur** (cône d'aspiration),
  **canon** (vraies trajectoires physiques jusqu'au bac).
- **Le bac** : maintiens près du bac → les patates tombent dedans (vraie physique). La roue à aubes les pose sur le tapis,
  le tapis monte la spirale (1 s), la patate est payée au sommet et tombe dans le bocal.
- **Le bocal** : se remplit (tas + couche de vraies patates 3D sur le dessus), dôme quand il est presque plein,
  puis **déborde** : les patates passent par-dessus le bord.
- **Gérard** : reste à son comptoir, te regarde, cligne des yeux, parle (bulles tapées lettre par lettre, mâchoire qui bouge),
  fait des gestes (salut, pointe, pouce levé, haussement d'épaules). **E** / bouton pour ouvrir la boutique.
- **Boutique** : exactement les mêmes 9 articles que la version web (contenant, gants, râteau, aspirateur, canon,
  bottes, moteur, engrais, contrat).
- **Nuit** : cycle jour/nuit (longue heure dorée), **patates filantes** en or la nuit, à attraper (60 ₣).
- **Éboulements** : sur les pentes raides des dunes, des patates se détachent et dévalent (physique Roblox).

## Le livre-tuto
Au tout premier lancement, après **JOUER**, un vrai livre 3D apparaît dans tes mains (couverture en cuir dorée qui
s'ouvre, double page qui remplit l'écran, flou de profondeur sur le décor). Touche la page de droite pour avancer,
celle de gauche pour reculer : la feuille se soulève et se courbe. Relisible avec le bouton **📖**.

## Interface (style Studs)
Panneaux à studs, gradients saturés, contours noirs épais, boutons 3D (kit `StudKit`, le même que Throw Fish for Bears) :
compteur décourageant des **patates restantes dans le désert** (10 milliards, % ridicule, « fini dans X ans »),
argent, outils en gros boutons studs avec le nombre porté, bouton ✋ géant sur mobile.

## Sans lag
- Les patates du sol sont posées par le client autour de toi (pool de pièces recyclées, `BulkMoveTo`, budget par image,
  rayon réduit sur téléphone), le serveur n'envoie que les cellules creusées.
- Les patates physiques du bac/bocal sont limitées (file virtuelle au-delà), absorbées dès qu'elles se posent.
- Gérard n'est animé que si tu es à moins de 220 studs ; pas d'ombres portées sur les milliers de patates.

## Architecture
- `src/shared` : Config (économie, objets, variétés, lignes de Gérard), Land (forme des dunes, identique serveur/client),
  Potato (grille déterministe + modèle), Net, Util, StudKit.
- `src/server` : Main, World (Terrain, Structures, Shop, Gerard, Build), Services (Data avec verrou de session,
  Session solo/invitations, Harvest, Machine, Night).
- `src/client` : ClientMain, Controllers (Carpet, Viewmodel, Interact, Book, GerardAnim, Fx, Sound, State),
  UI (HUD, ShopUI, Menu).
