# Journal des versions

Les changements notables de Scalengi Views sont documentés ici. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et les versions suivent [Semantic Versioning](https://semver.org/).

## [0.1.0-alpha.3] - 2026-08-19

### Ajouté

- interface applicative en anglais par défaut avec sélection persistante du français dans les paramètres ;
- organisation du métamodèle par niveaux, couches côte à côte et couches transverses ordonnées à gauche ou à droite ;
- filtres de couches, modes d’affichage des relations et réglage d’espacement du métamodèle ;
- renommage et suppression complète d’une vue depuis sa structure, avec confirmation ;
- suppression explicite des données importées et activation conditionnelle de la vue d’exemple.

### Modifié

- cycle de vie des données d’exemple : leur désactivation supprime désormais leurs données et leur structure sans réactivation au rechargement ;
- cartes du métamodèle et espacement des objets simplifiés pour améliorer la lisibilité ;
- configuration des sources futures préparée pour Scalengi Inventory, Scalengi App et API/BDD, sans activer de connecteur.

### Corrigé

- exports PNG et SVG produits à partir de la surface réelle de la vue avec un arrière-plan transparent ;
- étiquettes des relations du métamodèle affichées sans cardinalités ;
- migration des configurations enregistrées lors de l’ajout de nouveaux champs de structure.

## [0.1.0-alpha.2] - 2026-08-16

### Corrigé

- la release macOS utilise désormais la signature ad hoc lorsque les secrets Apple ne sont pas configurés ;
- les variables Apple vides ne déclenchent plus l’import d’un certificat inexistant dans GitHub Actions.

## [0.1.0-alpha.1] - 2026-08-16

### Ajouté

- première application desktop Tauri pour macOS, Windows et Linux, bâtie sur la même base React que l’application web ;
- pipeline GitHub de génération des installateurs et publication des préversions ;
- Vue en découpage générique avec modèles Capacités fonctionnelles, POS urbain et structure vierge ;
- filtres multicritères, multisélection et projection libre des niveaux ;
- Métamodèle du SI navigable sur React Flow ;
- Analyse d’impact du SI par couches remaniée ;
- configurations YAML et jeux de données d’exemple portables par instance.

### Sécurité

- politique CSP restrictive pour le shell desktop ;
- imports Excel et YAML maintenus localement et validés aux frontières.

[0.1.0-alpha.3]: https://github.com/CorentinPetitdemange/scalengi-views/compare/v0.1.0-alpha.2...v0.1.0-alpha.3
[0.1.0-alpha.2]: https://github.com/CorentinPetitdemange/scalengi-views/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/CorentinPetitdemange/scalengi-views/releases/tag/v0.1.0-alpha.1
