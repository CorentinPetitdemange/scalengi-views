# Scalengi Views architecture

## Purpose

Scalengi Views consists of an open-source library of view engines and a local web shell. The library exposes one source-level integration contract to the standalone shell and future integrations. It is currently distributed with the application rather than as a separate npm package.

The functional unit is a **view instance**:

```text
ViewInstance
├── type            -> registered ViewDefinition
├── configuration   -> portable structure (YAML), with optional distributable sample
├── data            -> instance-owned data
└── source          -> exclusive active source: sample, Excel, or none
```

The configuration defines what the view can organise: axes, layers, phases, levels, statuses, or categories. It may also embed optional `exampleData` so that a shared view remains immediately demonstrable. This sample is distributable content, not a second active source: an instance still displays exactly one source at a time. Enabling the sample copies `configuration.exampleData` into `data`; importing Excel replaces it.

A view type may provide several **starting presets** when they genuinely share the same engine and contract. The Partition View therefore provides Business Capabilities, Urban Information System Map, and Blank Structure as presets rather than three duplicated engines.

## Layer dependencies

```text
app shell
   │ consumes only the integration contract
   ▼
ViewRegistry ── ViewDefinition
   │               ├── React renderer
   │               ├── standard/blank configuration
   │               ├── dynamic Excel contract
   │               ├── Excel import and validation
   │               ├── demo data embedded in standard YAML
   │               └── shell metrics
   ▼
core library
configuration · dataset · types · xlsx
```

The `desktop/` entry point mounts the same `ScalengiViewsApp` through a static Vite build. `src-tauri/` contains only a minimal native shell; no view, data, or connector rule is duplicated there. The web application and macOS, Windows, and Linux applications therefore genuinely share `app/` and `library/`.

The reverse dependency is forbidden: a view knows nothing about the shell, IndexedDB, or another view.

## Responsibilities

### `app/`

- create and open instances;
- navigate between View, Structure, Data, and Guide;
- manage interface preferences;
- persist locally through IndexedDB;
- contain no business rule tied to a view identifier.

### `library/src/view-registry.ts`

Source-level integration contract for the application and view library. One complete definition is enough to appear in the catalogue, create an instance, display its metrics, and provide its imports.

### `library/src/configuration.ts`

Versioned descriptive schema. YAML is a portable representation of the same object, including its optional sample dataset. This module validates shape, sizes, scalar types, identifiers, uniqueness, and the sample-data envelope.

### `library/src/dataset.ts`

Shared data envelope. It guarantees that every collection exists, including after reading an older IndexedDB entry.

### View engines

Each engine receives only `data` and `configuration`. React Flow is used when a navigable space or structured relationships add value; matrices, radars, and bands use more direct rendering.

### Partition View

`partition-view` is the generic hierarchical partition engine. Its configuration describes ordered levels (`container`, `card`, or `reference`), attributes, and coloured vocabularies. Its data uses only two collections:

- `partitionItems` for elements, their level, parent, and values;
- `partitionRelations` for optional many-to-many links.

The Urban Information System Map uses parent-child relationships. The Business Capabilities preset uses the same hierarchy for Domain → Capability and relationships for application coverage. Legacy `pos` and `urban-pos` instances are migrated locally to this contract when read.

The filter panel is generic as well: it can restrict a level or any information declared in `attributes`, including information carried by a linked reference element.

Several values may be selected in one condition, and conditions may be combined with `all` (AND) or `any` (OR) logic. Level selection is a strict display projection: selecting only Block genuinely hides Zone and District, and blocks become visible roots. Filters remain local renderer exploration state and modify neither configuration nor data.

### Layered information-system impact analysis

### Information System Metamodel

The order of the `layers` section defines the top-to-bottom reading order of stacked layers. A transverse layer also has a `left` or `right` side; layers on the same side retain their list order.

`si-metamodel` describes the grammar of a repository rather than its instances. Its configuration contains layers, their level, their stacked or transverse layout, object types, and permitted relationships with cardinalities. The React Flow renderer consumes this structure directly. Stacked layers form successive horizontal bands; several layers with the same level share one row and sit side by side. Transverse layers sit on the left or right. On one side, layers with the same column number stack vertically, while different numbers create side-by-side columns. In both cases, list order determines group order and layer order within each group. Layer selection, spacing level, and relation display mode remain local exploration state and do not modify configuration.

By default, relationships are drawn only around the selected type to preserve readability. Users may also hide all relationships or display the full graph. The Excel workbook provides another way to edit configuration, and import may return a new `{ configuration, data }` pair; `data` remains empty for this structural view. Older workbooks without a `niveau` column keep one row per layer; the legacy `tranche` column remains accepted on import. Without `colonne_transverse`, each transverse layer keeps its own column. Workbooks without `disposition` are interpreted as stacked layers.

Without an Excel `cote` column, a transverse layer is placed on the right for backward compatibility.

### View export

The shell wraps the active renderer in an export surface and provides PNG/SVG export to every view without identifier-specific logic. `library/src/export-view.ts` contains the generic engine inspired by Scalengi export; `app/view-export-menu.tsx` contains only the interaction. `html-to-image` is loaded dynamically on first export. A renderer may exclude a control with `data-export-exclude` without knowing the shell.

### Excel imports and templates

The XLSX template is generated in the browser from the active configuration. Import is local, size-bounded, and validates relationships before producing a `ViewDataset`. A structural view may also return a new `configuration`, which the shell stores without branching on the view identifier.

## Storage and security

- IndexedDB stores instances; localStorage stores only theme, colour, language, and catalogue preferences.
- No file or business content is sent to a server.
- The enabled sample comes from the current configuration; when absent, the application offers the complete standard model.
- YAML, Excel, and IndexedDB are untrusted boundaries.
- Imported text remains strings rendered by React; imported HTML is never interpreted.
- Reserved identifiers (`__proto__`, `prototype`, `constructor`) are rejected.

## Source contract

An external source produces the same `{ configuration, data }` pair as an Excel import. It remains behind the source interface and does not modify view engines.

## Connectors and collaboration

Scalengi Views welcomes contributions that implement third-party connectors. To preserve data-contract consistency, exchange security, and compatibility between view engines, this work is carried out in collaboration with Scalengi.

To propose a connector or discuss an integration, contact [corentin@scalengi.com](mailto:corentin@scalengi.com).

Planned connectivity extensions include:

- a native connector to the Scalengi repository;
- an MCP integration for exposing and consuming data through the Model Context Protocol;
- a REST API for third-party tools and repositories;
- database adapters for using another repository type.

Regardless of transport, a connector supplies the view configuration and data through the shared contract without introducing a specific dependency into rendering engines.
