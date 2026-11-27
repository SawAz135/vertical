# PROJECT VERTICAL — v0.2

## Fichiers
project-vertical.html (app), manifest.webmanifest, sw.js, icon-*.png (PWA), backend-example.js (scan IA), backend-push-example.js (push).

## Installation iPhone
Héberger tous les fichiers du dossier en HTTPS (ex. GitHub Pages), ouvrir project-vertical.html dans Safari, Partager › Sur l'écran d'accueil.

## Fonctionnel (local, sans compte)
Onboarding, Home, programme 12 mois, séances + player + chrono, calendrier, séances perso, nutrition manuelle, eau, détente / sprint / course (+GPS), records, badges, dunk, check-in récupération avec règles de sécurité, rappels (app ouverte), export/import/suppression, IndexedDB.

## Nécessite TON serveur (non testé)
Scan IA : backend-example.js (clé API côté serveur). Push app fermée : backend-push-example.js + HTTPS + PWA installée (iOS 16.4+).

## Limites connues
Anglais partiel ; animations génériques (pas d'analyse de posture) ; pas d'alarme garantie app fermée ; GPS arrêté si iOS suspend la page ; aucun test sur iPhone réel effectué.

## À tester sur iPhone avant usage
Installation, migration des données, chrono après changement d'app, caméra, GPS, push, hors ligne, export/import.

## Roblox Forge · Jouer (roblox-forge/play/)
Joue à tes jeux Forge dans le navigateur, en vertical sur iPhone : avatar R15 animé, joystick + saut, caméra, classement, chat, menu Échap, boutique, œufs, rebirth, vente, codes, combat, obby, tycoon. Mets le pack .zip (ou une carte .json) : il apparaît dans « Mes jeux ». « ▶ Jouer maintenant » dans Créer tout ouvre directement ton jeu. Solo (pas de serveur multijoueur).

## LOOPLAB (looplab/)
Générateur de vidéos verticales hypnotiques et satisfaisantes (TikTok / Shorts), 100 % dans le navigateur.
Ouvrir `looplab/index.html` via un serveur HTTPS (ou `localhost`).

- **35 simulations** en 6 catégories : vedettes (Fusion, 3 000 anneaux, Vortex), boucles hypnotiques, courses & combats (noms, drapeaux, photos), visualiseurs musicaux, écraser & trancher, physique satisfaisante.
- **Musique** : bande-son originale générée avec montée + drop, ou ta propre musique (le drop, le tempo et les notes sont détectés et calés sur la vidéo), ou aucune.
- **Personnalisation** : 14 designs, 9 matières, lueur, accroche, compteur, effets (éclairs, ondes de choc, étincelles, flash, secousses, glitch), traînées, options propres à chaque modèle.
- **Export** : MP4 rendu image par image (WebCodecs + mp4-muxer, plus rapide que le temps réel), 720p/1080p, 30/60 i/s, sans filigrane. Repli MediaRecorder si le navigateur n’a pas WebCodecs.
- **Mes vidéos** : vidéos gardées sur l’appareil (IndexedDB), partage natif sur mobile.
- Aperçu en direct = rendu final (simulation déterministe à pas fixe).
