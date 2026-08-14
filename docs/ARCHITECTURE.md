# Architecture de Scalengi Views

## Objectif

Scalengi Views est composé d’une bibliothèque ouverte de moteurs de vues et d’un shell web local. La bibliothèque expose le même contrat public au shell autonome et à ses intégrations.

L’unité fonctionnelle est une **instance de vue** :

```text
ViewInstance
├── type            -> ViewDefinition enregistrée
├── configuration   -> structure portable (YAML), exemple distribuable facultatif
├── data            -> données propres à l’instance
└── source          -> source active exclusive : exemple, Excel ou aucune
```

La configuration définit ce que la vue sait organiser : axes, couches, phases, niveaux, statuts ou catégories. Elle peut aussi embarquer un `exampleData` facultatif afin qu’une vue partagée reste immédiatement démontrable. Cet exemple est un contenu de distribution, pas une seconde source active : l’instance n’affiche toujours qu’une source à la fois. Activer l’exemple copie `configuration.exampleData` vers `data` ; importer Excel le remplace.

## Dépendances entre couches

```text
app shell
   │ consomme uniquement le contrat public
   ▼
ViewRegistry ── ViewDefinition
   │               ├── renderer React
   │               ├── configuration standard/vide
   │               ├── contrat Excel dynamique
   │               ├── import et validation Excel
   │               ├── données de démonstration embarquées dans le YAML standard
   │               └── métriques du shell
   ▼
core library
configuration · dataset · types · xlsx
```

Le flux inverse est interdit : une vue ne connaît pas le shell, IndexedDB ou une autre vue.

## Responsabilités

### `app/`

- création et ouverture des instances ;
- navigation Vue / Structure / Données / Guide ;
- préférences d’interface ;
- persistance locale via IndexedDB ;
- aucune règle métier spécifique à un identifiant de vue.

### `library/src/view-registry.ts`

Contrat de plug-in interne. Une définition complète suffit pour apparaître dans le catalogue, créer une instance, afficher ses métriques et fournir ses imports.

### `library/src/configuration.ts`

Schéma descriptif versionné. Le YAML est une représentation portable du même objet, y compris de son jeu d’exemple facultatif. Ce module valide forme, tailles, types scalaires, identifiants, unicité et enveloppe de données d’exemple.

### `library/src/dataset.ts`

Enveloppe de données partagée. Elle garantit que toutes les collections existent, y compris après lecture d’une ancienne entrée IndexedDB.

### Moteurs de vues

Chaque moteur reçoit uniquement `data` et `configuration`. React Flow est utilisé lorsqu’un espace navigable ou des relations structurées apportent de la valeur ; les matrices, radars et bandes utilisent un rendu plus direct.

### Export des vues

Le shell enveloppe le renderer actif dans une surface d’export et propose PNG/SVG à toutes les vues sans logique spécifique par identifiant. `library/src/export-view.ts` contient le moteur générique inspiré de l’export Scalengi ; `app/view-export-menu.tsx` ne porte que l’interaction. `html-to-image` est chargé dynamiquement au premier export. Un renderer peut exclure un contrôle avec `data-export-exclude` sans connaître le shell.

### Imports et modèles Excel

Le modèle XLSX est généré dans le navigateur depuis la configuration active. L’import est local, borné en taille et valide les relations avant de produire un `ViewDataset`.

## Stockage et sécurité

- IndexedDB contient les instances ; localStorage contient seulement thème et couleur.
- Aucun fichier ou contenu métier n’est envoyé à un serveur.
- Le jeu d’exemple activé provient de la configuration courante ; en son absence, l’application propose le modèle standard complet.
- YAML, Excel et IndexedDB sont des frontières non fiables.
- Les textes importés restent des chaînes rendues par React ; aucun HTML importé n’est interprété.
- Les identifiants réservés (`__proto__`, `prototype`, `constructor`) sont refusés.

## Contrat des sources

Une source externe produit le même couple `{ configuration, data }` qu’un import Excel. Elle reste derrière l’interface de source et ne modifie pas les moteurs de vues.

## Connecteurs et collaboration

Scalengi Views est ouvert aux contributions visant à implémenter des connecteurs tiers. Afin de préserver la cohérence du contrat de données, la sécurité des échanges et la compatibilité entre les moteurs de vues, ces travaux sont menés en collaboration avec Scalengi.

Pour proposer un connecteur ou échanger sur une intégration : [corentin@scalengi.com](mailto:corentin@scalengi.com).

Les extensions de connectivité prévues couvrent notamment :

- un connecteur natif avec le référentiel Scalengi ;
- une intégration MCP pour exposer et consommer des données via le Model Context Protocol ;
- une API REST pour les outils et référentiels tiers ;
- des adaptateurs de bases de données pour utiliser un autre type de référentiel.

Quel que soit le transport employé, un connecteur fournit la configuration de la vue et ses données dans le contrat commun, sans introduire de dépendance spécifique dans les moteurs de rendu.
