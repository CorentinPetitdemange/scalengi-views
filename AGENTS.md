# Instructions for coding agents

Read this file before changing the repository. Then read the relevant document in `docs/`.

## Product boundaries

- This repository is the standalone, open-source Scalengi Views application and view library.
- Do not edit another Scalengi repository from work performed here.
- The application has no global repository and no active external connector. A view instance owns its structure and its data.
- Browser-local Excel import and built-in demonstration datasets are the only data sources implemented today. A view has at most one active source. Do not add a network call, telemetry, authentication, D1/database storage, or a Scalengi connector unless the user explicitly requests it.
- Process modelling remains in Scalengi. Views here are decision, analysis and transformation views.

## Source-of-truth architecture

Read `docs/ARCHITECTURE.md` before architectural work and `docs/CREATE_A_VIEW.md` before adding a view.

- `app/` is the thin standalone shell: navigation, instance lifecycle and local persistence.
- `desktop/` is the static Vite entry point for the desktop application. It must mount the same `ScalengiViewsApp`; never fork the UI or view logic there.
- `src-tauri/` is a minimal native packaging shell. Do not move business logic, persistence rules or connectors into Rust.
- `library/src/view-registry.ts` is the public integration contract.
- `library/src/configuration.ts` owns the portable structure/YAML contract.
- `library/src/dataset.ts` owns creation and normalization of the shared dataset envelope.
- `library/src/builtin-configurations.ts` owns standard/blank structures and generated workbook contracts.
- `library/src/excel-import.ts` is the trust boundary for workbook data.
- A `*View.tsx` file renders one view. It must not access IndexedDB, localStorage, files, the network or another view.
- `library/src/builtin-views.ts` composes and registers built-in definitions. The shell must never switch on a view id.

## Non-negotiable implementation rules

1. Integrate a view only through a complete `ViewDefinition` and the registry.
2. Keep structure (`ViewConfiguration`) separate from data (`ViewDataset`).
3. A renderer is pure from the app perspective: `{ data, configuration } -> UI`.
4. Excel/YAML/IndexedDB values are untrusted. Validate size and shape at their boundary; React rendering is not validation.
5. Never use `dangerouslySetInnerHTML`, execute imported content, or interpolate imported data into CSS/URLs.
6. Keep imports browser-local. No upload is allowed without an explicit product decision.
7. Prefer one shared helper over repeated empty datasets, metrics switches or filename logic.
8. Avoid adding a dependency when the platform or an existing dependency can do the job.
9. Preserve full-screen readability and an automatic fit for dense views.
10. Do not add a static XLSX template: templates are generated from the active configuration.
11. Do not add a dedicated renderer for another hierarchical grouping. Extend `partition-view` or add a preset when the need is levels, containers, cards, attributes and optional relations.

## Choosing between a view and a preset

- Use a `partition-view` preset for a new hierarchy or decomposition such as domains/capabilities, zones/districts/blocks, products/components or organisation levels.
- Create a new renderer only when the visual grammar produces a different analysis or decision, such as a radar, ADM cycle, word cloud or collaborator galaxy.
- A preset owns its complete portable configuration and bounded example dataset. It must work with the shared `partitionItems` / `partitionRelations` Excel contract.
- Never branch on a preset id in the shell or renderer. Rendering follows level roles, attributes and vocabularies from the configuration.

## Required checks

Run from this directory with Node.js >= 22.13:

```bash
pnpm desktop:check
pnpm lint
pnpm test
```

For a native desktop change, also run `pnpm desktop:build` on the platform being validated. Keep the versions in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` identical. See `docs/DESKTOP.md` for release, signing and platform-validation rules.

Version changes must use `pnpm version:set <version>` and follow `docs/VERSIONING.md`. Never reuse or move a published version tag.

For visual changes, also verify the affected view at `http://localhost:3000` in normal and full-screen layouts. Confirm that browser console errors are empty.

## Definition of done for a view

- Standard and blank configurations work.
- The standard YAML carries a bounded example dataset; the blank configuration does not.
- YAML round-trip works and rejects malformed or oversized input.
- The generated Excel contract matches the configuration.
- Import validates controlled vocabularies and cross-sheet identifiers.
- Demo, empty state, metrics, guide and full-screen rendering exist.
- The definition is registered once and no view-id branch was added to the shell.
- Lint, build and tests pass.
