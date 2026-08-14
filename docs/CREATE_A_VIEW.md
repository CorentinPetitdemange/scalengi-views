# Créer et intégrer une vue

Une vue est livrée comme une définition complète. Son intégration ne doit nécessiter aucune modification dans `app/`.

## 1. Définir la question de décision

Écrire d’abord :

- la question à laquelle la vue répond ;
- l’utilisateur principal ;
- la décision rendue plus simple ;
- les objets affichés et leur vocabulaire contrôlé ;
- pourquoi un canvas, une matrice, un radar ou une autre représentation est approprié.

Ne pas créer une vue qui duplique un schéma de processus ou affiche seulement des données sans lecture décisionnelle.

## 2. Étendre les données partagées

Ajouter les types nécessaires dans `library/src/types.ts`, puis les collections correspondantes dans `ViewDataset`, `createEmptyDataset` et `normalizeDataset` dans `library/src/dataset.ts`.

Les champs importés doivent rester sérialisables : chaînes, nombres, booléens, tableaux et objets simples.

## 3. Définir la structure configurable

Ajouter la configuration standard dans `builtin-configurations.ts` :

- une section par dimension configurable ;
- des identifiants stables et non traduits ;
- des libellés modifiables ;
- des couleurs/options seulement si le renderer les consomme réellement ;
- un modèle vide utilisable.

`defineView` embarque automatiquement `createDemoData()` dans `exampleData` de la configuration standard. Une configuration YAML importée peut fournir son propre `exampleData`. La configuration vide, elle, ne doit jamais en contenir.

Le renderer doit utiliser les identifiants, pas supposer les libellés français.

## 4. Construire le contrat Excel

Ajouter un `build…Template(configuration)` qui produit :

- les feuilles et colonnes minimales ;
- les lignes structurelles préremplies ;
- les listes de valeurs issues de la configuration ;
- une feuille `Mode d'emploi` courte.

Ne pas ajouter de fichier XLSX statique dans `public/`.

## 5. Importer et valider

Ajouter `import…Excel(file, configuration)` dans `excel-import.ts` en réutilisant les helpers communs.

Vérifier avant de retourner :

- feuilles et colonnes requises ;
- identifiants obligatoires et uniques ;
- références entre feuilles ;
- valeurs contrôlées par la configuration ;
- bornes numériques ;
- avertissements utiles mais non bloquants.

## 6. Créer le renderer

Créer `MyView.tsx` avec cette frontière :

```tsx
export function MyView({ data, configuration }: ViewRendererProps) {
  // aucun stockage, fichier ou réseau ici
  return <section className="view-workspace">…</section>;
}
```

Prévoir : état vide, vue normale, plein écran si la densité le justifie, sélection/détail et adaptation à une configuration vide ou partielle.

Le shell fournit automatiquement l’export PNG/SVG. Placer `data-view-export-content` sur la zone de visualisation à cadrer : le PNG/SVG prendra cette zone et non toute la fenêtre de la vue. Une vue ne doit donc pas réimplémenter l’export. Pour exclure un contrôle ou un élément purement interactif de l’image, ajouter `data-export-exclude` sur sa racine. Le fond quadrillé, les contrôles et panneaux React Flow ainsi que le bouton `.rf-fullscreen-button` sont déjà exclus par défaut.

## 7. Enregistrer une définition unique

Dans `builtin-views.ts`, utiliser `defineView` :

```ts
export const myViewDefinition = defineView({
  id: "my-view",
  title: "Ma vue",
  shortTitle: "Ma vue",
  demoName: "Ma vue — Démonstration",
  category: "Architecture d’entreprise",
  catalogGroup: "enterprise-architecture",
  description: "La valeur produite par la vue.",
  icon: "boxes",
  accent: "blue",
  insights: ["Décision", "Risque", "Trajectoire"],
  component: MyView,
  createEmptyData: createEmptyDataset,
  createDemoData: myDemo,
  createDefaultConfiguration: () => createDefaultConfiguration("my-view"),
  createBlankConfiguration: () => createBlankConfiguration("my-view"),
  buildTemplate: buildMyTemplate,
  importExcel: importMyExcel,
  summarize: (data) => [
    { label: "Objets", value: data.myObjects.length },
  ],
  guide: { purpose: "…", questions: [], steps: [], sheets: [] },
});

export const viewRegistry = new ViewRegistry().registerMany([
  // définitions existantes,
  myViewDefinition,
]);
```

Si l’intégration exige un `if (definition.id === "my-view")` dans le shell, la définition est incomplète.

Choisir `catalogGroup` parmi :

- `organisation-experience` ;
- `enterprise-architecture` ;
- `diagnostic-maturity` ;
- `transformation-governance`.

## 8. Tester

- ajouter les assertions de contrat utiles ;
- exécuter `pnpm lint` et `pnpm test` ;
- ouvrir la vue locale ;
- vérifier normal, plein écran, filtre, détail, structure standard, structure vide, création avec/sans exemple et absence d’erreur console.
