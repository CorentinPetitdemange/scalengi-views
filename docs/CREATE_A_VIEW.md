# Creating and integrating a view

A view is delivered as a complete definition. Integrating it must not require any change in `app/`.

Before adding an engine, check whether an existing engine already meets the need with a different configuration. A hierarchical decomposition must become a `partition-view` preset, not a new React view.

## 1. Define the decision question

Start by writing down:

- the question answered by the view;
- the primary user;
- the decision made easier;
- the displayed objects and their controlled vocabulary;
- why a canvas, matrix, radar, or another representation is appropriate.

Do not create a view that duplicates a process diagram or merely displays data without a decision-oriented interpretation.

## 2. Extend the shared data

Add the required types to `library/src/types.ts`, then add the corresponding collections to `ViewDataset`, `createEmptyDataset`, and `normalizeDataset` in `library/src/dataset.ts`.

Imported fields must remain serialisable: strings, numbers, booleans, arrays, and plain objects.

## 3. Define the configurable structure

Add the standard configuration to `builtin-configurations.ts`:

- one section per configurable dimension;
- stable, untranslated identifiers;
- editable labels;
- colours and options only when the renderer actually consumes them;
- a usable blank configuration.

`defineView` automatically embeds `createDemoData()` as `exampleData` in the standard configuration. An imported YAML configuration may provide its own `exampleData`. The blank configuration must never contain sample data.

The renderer must use identifiers and must not assume French labels.

## 4. Build the Excel contract

Add a `build…Template(configuration)` function that produces:

- the minimum worksheets and columns;
- prefilled structural rows;
- value lists derived from the configuration;
- a short `Mode d'emploi` worksheet.

Do not add a static XLSX file to `public/`.

## 5. Import and validate

Add `import…Excel(file, configuration)` to `excel-import.ts`, reusing the shared helpers.

By default, the import returns `{ data, rowCount, warnings }`. A view whose workbook describes the structure itself may also return `configuration`; the shell applies it to the instance with the imported source.

Before returning, validate:

- required worksheets and columns;
- required and unique identifiers;
- cross-sheet references;
- values controlled by the configuration;
- numeric bounds;
- useful non-blocking warnings.

## 6. Create the renderer

Create `MyView.tsx` with this boundary:

```tsx
export function MyView({ data, configuration }: ViewRendererProps) {
  // no storage, file, or network access here
  return <section className="view-workspace">…</section>;
}
```

Provide an empty state, normal view, full-screen mode when density justifies it, selection/detail, and support for an empty or partial configuration.

The shell provides PNG/SVG export automatically. Place `data-view-export-content` on the visualisation area to frame: PNG/SVG export captures that area rather than the whole view window. A view must not reimplement export. To exclude a control or purely interactive element from the image, add `data-export-exclude` to its root. The grid background, React Flow controls and panels, and the `.rf-fullscreen-button` are already excluded by default.

## 7. Register one definition

Use `defineView` in `builtin-views.ts`:

```ts
export const myViewDefinition = defineView({
  id: "my-view",
  title: "My view",
  shortTitle: "My view",
  demoName: "My view — Demo",
  category: "Enterprise architecture",
  catalogGroup: "enterprise-architecture",
  description: "The value delivered by the view.",
  icon: "boxes",
  accent: "blue",
  insights: ["Decision", "Risk", "Roadmap"],
  component: MyView,
  createEmptyData: createEmptyDataset,
  createDemoData: myDemo,
  createDefaultConfiguration: () => createDefaultConfiguration("my-view"),
  createBlankConfiguration: () => createBlankConfiguration("my-view"),
  buildTemplate: buildMyTemplate,
  importExcel: importMyExcel,
  summarize: (data) => [
    { label: "Objects", value: data.myObjects.length },
  ],
  guide: { purpose: "…", questions: [], steps: [], sheets: [] },
});

export const viewRegistry = new ViewRegistry().registerMany([
  // existing definitions,
  myViewDefinition,
]);
```

When multiple use cases share the renderer, Excel contract, and data model, declare `presets` in the definition. Each preset provides a complete configuration, optionally with its `exampleData`. The shell displays these choices automatically during creation without branching on the view identifier.

If integration requires `if (definition.id === "my-view")` in the shell, the definition is incomplete.

Choose `catalogGroup` from:

- `organisation-experience`;
- `enterprise-architecture`;
- `diagnostic-maturity`;
- `transformation-governance`.

## 8. Test

- add relevant contract assertions;
- run `pnpm lint` and `pnpm test`;
- open the local view;
- verify normal mode, full-screen mode, filters, details, standard structure, blank structure, creation with and without sample data, and an empty browser console.
