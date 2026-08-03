# Scalengi Views

Application web autonome et bibliothèque de vues spécialisées pour l’architecture d’entreprise. Ce dépôt ne dépend pas du frontend ni du backend de Scalengi.

## Principe

Scalengi Views n’embarque pas de référentiel global. L’utilisateur crée des **instances de vues indépendantes** : chaque instance a un nom, un type, une configuration, son propre fichier Excel et ses propres données locales.

- les instances sont conservées dans IndexedDB, sur l’appareil courant ;
- le fichier Excel est lu dans le navigateur et n’est pas envoyé à un serveur ;
- importer un fichier dans une vue n’affecte aucune autre vue ;
- un futur adaptateur pourra remplacer cette source locale par Scalengi, une base de données ou un outil de cartographie.

Les préférences d’interface (thème et couleur) restent dans `localStorage`. Aucune donnée métier n’y est stockée.

## Vues disponibles

- Vue Collaborateurs sur un canvas React Flow ;
- Plan d’occupation du sol sur un canvas React Flow ;
- mode plein écran, guide intégré et modèle Excel propres à chaque type de vue.

## Créer un nouveau type de vue

La bibliothèque ouverte se trouve dans `library/src`. Un type de vue implémente le contrat `ViewDefinition` dans `view-registry.ts` :

```ts
const myView: ViewDefinition = {
  id: "my-view",
  title: "Ma vue",
  component: MyReactView,
  guide: { purpose: "…", questions: [], steps: [], sheets: [] },
  template: { filename: "modele.xlsx", url: "/templates/modele.xlsx" },
  createEmptyData: () => emptyData,
  createDemoData: () => demoData,
  importExcel: importMyExcel,
  // métadonnées du catalogue…
};

viewRegistry.register(myView);
```

Le contrat regroupe donc le rendu, la documentation, le modèle d’entrée et la validation de données. L’application consomme le registre sans connaître le détail de chaque vue.

## Développement

Prérequis : Node.js `>=22.13.0`.

```bash
pnpm install
pnpm dev
pnpm lint
pnpm test
```

Les modèles téléchargeables sont dans `public/templates/`.
