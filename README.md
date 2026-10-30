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
