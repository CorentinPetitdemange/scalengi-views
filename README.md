# Scalengi Views

[![CI](https://github.com/CorentinPetitdemange/scalengi-views/actions/workflows/ci.yml/badge.svg)](https://github.com/CorentinPetitdemange/scalengi-views/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Dernière version](https://img.shields.io/github/v/release/CorentinPetitdemange/scalengi-views?include_prereleases&sort=semver&display_name=tag&label=version)](CHANGELOG.md)

Scalengi Views permet de créer des vues configurables pour analyser, expliquer et piloter un système d’information. Chaque vue associe une structure, des données et une représentation adaptée à une question d’architecture d’entreprise.

> Le projet est actuellement en **alpha**. Les formats et certaines interactions peuvent encore évoluer.

## Installer

[![Télécharger pour macOS](https://img.shields.io/badge/Télécharger-macOS-111827?logo=apple&logoColor=white)](https://github.com/CorentinPetitdemange/scalengi-views/releases)
![Windows — bientôt disponible](https://img.shields.io/badge/Windows-bientôt-6b7280?logo=windows&logoColor=white)
![Linux — bientôt disponible](https://img.shields.io/badge/Linux-bientôt-6b7280?logo=linux&logoColor=white)

Les versions macOS sont disponibles dans [GitHub Releases](https://github.com/CorentinPetitdemange/scalengi-views/releases). Windows et Linux seront proposés après validation de leurs installateurs.

## Essayer en ligne

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/CorentinPetitdemange/scalengi-views?quickstart=1)

Le Codespace démarre automatiquement l’application et ouvre le port **3000**. Aucun compte Scalengi n’est nécessaire.

## Fonctionnalités

- création de plusieurs vues indépendantes ;
- structure configurable depuis l’interface ou en YAML ;
- modèle Excel généré selon la structure de chaque vue ;
- import Excel traité localement ;
- jeu de données d’exemple activable ou remplaçable ;
- affichage plein écran et export PNG/SVG ;
- persistance locale des vues et de leurs données.

## Vues disponibles

- **Collaborateurs** : responsabilités, processus, retours et relations autour des équipes ;
- **Vue en découpage** : niveaux, informations et relations libres, avec des modèles Capacités fonctionnelles et POS urbain ;
- **Diagnostic d’urbanisation** : radar configurable, écarts, preuves, responsables et actions ;
- **SI par couches** : analyse d’impact autour d’un élément et de ses dépendances ;
- **Métamodèle du SI** : types d’objets, couches, relations autorisées et cardinalités ;
- **TOGAF ADM** : phases, avancement, livrables, décisions, risques et blocages ;
- **Nuage de mots** : analyse visuelle de verbatims, besoins et dysfonctionnements.

## Données

Une vue possède sa propre configuration et une seule source de données active : exemple, Excel ou aucune donnée. Les fichiers importés restent sur l’appareil et ne sont pas envoyés à un serveur.

## Développement

Prérequis : Node.js `>=22.13.0` et pnpm 10.

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm test
```

- [Architecture](docs/ARCHITECTURE.md)
- [Créer un type de vue](docs/CREATE_A_VIEW.md)
- [Application desktop](docs/DESKTOP.md)
- [Versions et publication](docs/VERSIONING.md)
- [Maintenance du dépôt](docs/MAINTENANCE.md)

## Contribuer

Consultez le [guide de contribution](CONTRIBUTING.md), le [code de conduite](CODE_OF_CONDUCT.md) et la [politique de sécurité](SECURITY.md). Les changements sont proposés par pull request et validés par la CI avant leur intégration.

Pour discuter d’un connecteur ou d’une intégration : [corentin@scalengi.com](mailto:corentin@scalengi.com).

## Licence

Scalengi Views est distribué sous [licence MIT](LICENSE). Copyright © 2026 Corentin Petitdemange.
