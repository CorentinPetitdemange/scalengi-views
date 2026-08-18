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

Un type de vue peut proposer plusieurs **modèles de départ** lorsqu’ils partagent réellement le même moteur et le même contrat. La Vue en découpage fournit ainsi Capacités fonctionnelles, POS urbain et Structure vierge comme modèles, et non comme trois moteurs dupliqués.

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

Le point d’entrée `desktop/` monte le même `ScalengiViewsApp` avec Vite en sortie statique. `src-tauri/` ne contient qu’un shell natif minimal ; aucune règle de vue, donnée ou connecteur n’y est dupliqué. La version web et les applications macOS, Windows et Linux partagent donc réellement `app/` et `library/`.

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

### Vue en découpage

`partition-view` est le moteur générique de répartition hiérarchique. Sa configuration décrit des niveaux ordonnés (`container`, `card` ou `reference`), des attributs et des vocabulaires colorés. Ses données utilisent deux collections seulement :

- `partitionItems` pour les éléments, leur niveau, leur parent et leurs valeurs ;
- `partitionRelations` pour les liens facultatifs plusieurs-à-plusieurs.

Le POS utilise les relations parent-enfant. Le modèle Capacités utilise la même hiérarchie pour Domaine → Capacité et des relations pour la couverture applicative. Les anciennes instances `pos` et `urban-pos` sont migrées localement vers ce contrat lors de leur lecture.

Le panneau de filtres est lui aussi générique : il peut limiter un niveau ou toute information déclarée dans `attributes`, y compris lorsqu’elle est portée par un élément de référence lié.

Plusieurs valeurs peuvent être sélectionnées dans une même condition et plusieurs conditions peuvent être combinées en logique `all` (ET) ou `any` (OU). La sélection des niveaux est une projection d’affichage stricte : choisir uniquement Îlot masque réellement Zone et Quartier, et les îlots deviennent les racines visibles. Les filtres restent un état d’exploration local au renderer et ne modifient ni la configuration ni les données.

### Analyse d’impact du SI par couches

`si-layers` répond à une question d’impact, contrairement au métamodèle. En vue d’ensemble, il présente les objets dans leurs couches configurées. La sélection d’un point focal calcule ensuite un périmètre multi-niveaux sur les relations orientées : entrants, sortants ou les deux. La profondeur est bornée à quatre niveaux et les objets hors périmètre disparaissent afin de conserver une lecture décisionnelle.

### Métamodèle du SI

L’ordre de la section `layers` fixe la lecture de haut en bas des couches empilées. Une couche transverse porte aussi un côté `left` ou `right` ; les couches placées du même côté conservent entre elles l’ordre de la liste.

`si-metamodel` décrit la grammaire d’un référentiel et non ses instances. Sa configuration porte les couches, leur niveau, leur disposition empilée ou transverse, les types d’objets et les relations autorisées avec leurs cardinalités. Le renderer React Flow consomme directement cette structure. Les couches empilées forment des bandes horizontales successives ; plusieurs couches portant le même niveau partagent la même ligne et sont placées côte à côte. Les couches transverses sont placées à gauche ou à droite. Sur un même côté, les couches ayant le même numéro de colonne sont empilées verticalement ; des numéros différents créent des colonnes côte à côte. Dans les deux cas, l’ordre de la liste fixe l’ordre des groupes et des couches à l’intérieur d’un groupe. La sélection des couches, le niveau d’espacement et le mode d’affichage des relations restent des états locaux d’exploration qui ne modifient pas la configuration.

Par défaut, les relations ne sont dessinées qu’autour du type sélectionné afin de préserver la lisibilité. L’utilisateur peut aussi toutes les masquer ou afficher l’ensemble du graphe. Son classeur Excel constitue une autre manière d’éditer la configuration et l’import peut retourner un nouveau couple `{ configuration, data }` ; `data` reste vide pour cette vue structurelle. Les anciens classeurs sans colonne `niveau` conservent une ligne distincte par couche ; la colonne historique `tranche` reste acceptée à l’import. Sans `colonne_transverse`, chaque couche transverse conserve sa propre colonne. Les classeurs sans `disposition` sont interprétés avec des couches empilées.

Sans colonne Excel `cote`, une couche transverse est placée à droite pour préserver la compatibilité avec les anciens classeurs.

### Export des vues

Le shell enveloppe le renderer actif dans une surface d’export et propose PNG/SVG à toutes les vues sans logique spécifique par identifiant. `library/src/export-view.ts` contient le moteur générique inspiré de l’export Scalengi ; `app/view-export-menu.tsx` ne porte que l’interaction. `html-to-image` est chargé dynamiquement au premier export. Un renderer peut exclure un contrôle avec `data-export-exclude` sans connaître le shell.

### Imports et modèles Excel

Le modèle XLSX est généré dans le navigateur depuis la configuration active. L’import est local, borné en taille et valide les relations avant de produire un `ViewDataset`. Une vue structurelle peut également retourner une nouvelle `configuration`, que le shell enregistre sans branchement sur l’identifiant de la vue.

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
