# Scalengi Views

[![CI](https://github.com/CorentinPetitdemange/scalengi-views/actions/workflows/ci.yml/badge.svg)](https://github.com/CorentinPetitdemange/scalengi-views/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Dernière version](https://img.shields.io/github/v/release/CorentinPetitdemange/scalengi-views?include_prereleases&sort=semver&display_name=tag&label=version)](CHANGELOG.md)

Application web autonome et bibliothèque de vues spécialisées pour l’architecture d’entreprise. Ce dépôt ne dépend pas du frontend ni du backend de Scalengi.

## Installer l’application

[![Télécharger pour macOS](https://img.shields.io/badge/Télécharger-macOS-111827?logo=apple&logoColor=white)](https://github.com/CorentinPetitdemange/scalengi-views/releases)
![Windows — bientôt validé](https://img.shields.io/badge/Windows-bientôt%20validé-6b7280?logo=windows&logoColor=white)
![Linux — bientôt validé](https://img.shields.io/badge/Linux-bientôt%20validé-6b7280?logo=linux&logoColor=white)

À partir de la première version publiée, macOS sera proposé pour Apple Silicon et Intel dans les [GitHub Releases](https://github.com/CorentinPetitdemange/scalengi-views/releases). Le projet est actuellement en alpha : GitHub classe donc ces versions comme préversions. Les installateurs Windows x64 et Linux x64 sont préparés par le même pipeline, mais resteront signalés comme non validés jusqu’à leurs tests manuels.

L’application desktop utilise la même base React et les mêmes données locales que la version web, dans une WebView Tauri légère. Aucun serveur n’est nécessaire après installation. Voir [la construction et la publication desktop](docs/DESKTOP.md).

## Tester en un clic

Aucune installation locale n’est nécessaire. Lancez un environnement de démonstration complet dans GitHub Codespaces :

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/CorentinPetitdemange/scalengi-views?quickstart=1)

1. Cliquez sur le bouton et créez le Codespace avec la configuration proposée.
2. Attendez le téléchargement et le démarrage automatique du conteneur de démonstration.
3. Le port **3000** s’ouvre automatiquement dans le navigateur.

Aucun compte Scalengi n’est nécessaire. Les vues et données d’exemple sont initialisées localement dans le navigateur.

## Principe

Scalengi Views n’embarque pas de référentiel global. L’utilisateur crée des **instances de vues indépendantes** : chaque instance a un nom, un type, une configuration, son propre fichier Excel et ses propres données locales.

- les instances sont conservées dans IndexedDB, sur l’appareil courant ;
- le fichier Excel est lu dans le navigateur et n’est pas envoyé à un serveur ;
- une instance possède une seule source active : jeu d’exemple, fichier Excel ou aucune donnée ;
- importer un fichier dans une vue n’affecte aucune autre vue ;
- les sources de données utilisent un contrat commun, indépendant des moteurs de vues.

Les préférences d’interface (thème et couleur) restent dans `localStorage`. Aucune donnée métier n’y est stockée.

## Vues disponibles

- Vue Collaborateurs sur un canvas React Flow ;
- Vue en découpage avec niveaux, informations et relations libres ;
  - modèle Capacités fonctionnelles : domaines, maturité et couverture applicative ;
  - modèle POS urbain : zones, quartiers, îlots et applications ;
  - structure vierge pour construire son propre découpage ;
- Diagnostic d’urbanisation configurable : radar, écarts pondérés, preuves, responsables et actions ;
- Analyse d’impact du SI par couches : point focal, dépendances entrantes/sortantes, profondeur et criticité ;
- Métamodèle du SI sur React Flow : couches, types d’objets, relations autorisées et cardinalités ;
- Cockpit TOGAF : phases ADM, avancement, gates, livrables, décisions, risques et blocages ;
- mode plein écran, guide intégré et modèle Excel propres à chaque type de vue.

## Structure d’une instance

Chaque vue créée possède deux documents distincts :

- une configuration de structure portable en YAML (axes, couches, niveaux, statuts, catégories ou galaxies selon le moteur de vue), avec un jeu d’exemple facultatif et partageable ;
- un jeu de données local, importé par Excel et stocké uniquement dans cette instance.

L’écran **Structure** permet de partir du modèle standard, d’une page blanche, de l’éditeur guidé ou d’un fichier YAML. Le standard embarque son exemple ; la page blanche n’en contient aucun. Le modèle Excel est généré à la volée depuis la configuration active : les feuilles, lignes préremplies et listes de valeurs autorisées restent donc alignées avec la vue. Aucun connecteur de référentiel n’est activé dans cette version locale.

## Créer un nouveau type de vue

La bibliothèque ouverte se trouve dans `library/src`. Le contrat `ViewDefinition` regroupe le rendu, la configuration standard et vide, le modèle Excel dynamique, l’import, la démonstration, le guide et les indicateurs. L’application consomme uniquement le registre et ne contient aucun branchement par identifiant de vue.

- [Architecture et frontières](docs/ARCHITECTURE.md)
- [Guide complet pour créer et intégrer une vue](docs/CREATE_A_VIEW.md)
- [Instructions destinées aux agents et LLM](AGENTS.md)
- [Cycle de versions et publication](docs/VERSIONING.md)

## Développement

Prérequis : Node.js `>=22.13.0`.

```bash
pnpm install
pnpm dev
pnpm lint
pnpm test
```

Les modèles Excel sont générés dans le navigateur à partir de la structure active ; aucun classeur statique n’est maintenu dans le dépôt.

## Contribuer et sécurité

- [Guide de contribution](CONTRIBUTING.md)
- [Code de conduite](CODE_OF_CONDUCT.md)
- [Politique de sécurité](SECURITY.md)

Les changements passent par une branche dédiée et une pull request validée par la CI. Les vulnérabilités ne doivent jamais être publiées dans une issue publique.

## Licence

Scalengi Views est distribué sous [licence MIT](LICENSE). Copyright © 2026 Corentin Petitdemange.
