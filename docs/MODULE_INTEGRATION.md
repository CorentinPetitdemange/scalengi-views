# Scalengi Views as a platform module

Scalengi Views remains a complete standalone product. The same codebase also publishes a versioned module artifact so a future Scalengi platform can install Views without copying its source or coupling releases.

## Product boundary

The platform owns the workspace, identity, navigation, module lifecycle, and paid capabilities. Views owns its catalogue, view definitions, portable configurations, local datasets, Excel imports, and rendering. Inventory follows the same module model independently.

Views and Inventory may exchange data later through an explicit platform contract. Neither module imports the other, and the platform does not reach into their internal storage.

## Distribution contract

`scalengi-module.json` is the machine-readable source of truth. Each tagged release produces an asset named `scalengi-views-module-v<version>.zip`. A platform installer can query the repository’s latest compatible GitHub release, match `distribution.assetPattern`, download the asset, verify its own integrity policy, and then validate the embedded manifest before installation.

The archive contains:

- the ESM entry point declared in `entrypoints.module`;
- the stylesheet declared in `entrypoints.stylesheet`;
- the exact manifest used to build the archive;
- the JSON Schema that bounds and documents that manifest;
- bundled view engines and their source-level registry contract.

Build it locally with:

```bash
pnpm module:package
```

## Host integration

The module exports `ScalengiViewsApp`, `viewRegistry`, and `ViewRegistry`. The future platform can either consume individual view definitions through the registry or mount the complete Views feature with an authenticated host session:

```tsx
<ScalengiViewsApp
  host={{
    session: { user: platformUser },
    installationProfile: "standard", // or "demo" for an evaluation install
    openAccount: () => navigate("/account"),
    openAdministration: () => navigate("/administration"),
    signOut,
  }}
/>
```

In host mode, Views does not display or call its standalone login, account, administration, or logout flows. Identity remains owned by the platform. Views still namespaces local IndexedDB data by an opaque, stable authenticated user id limited to letters, digits, dots, underscores, colons, and hyphens.

`installationProfile` defaults to `standard`, which starts with an empty catalogue. A platform installer may explicitly pass `demo` to create the bundled examples once for each new browser-local workspace. The module never receives or creates platform credentials; account provisioning remains a platform responsibility.

React and React DOM are peer runtime dependencies of the ESM module. The standalone web and desktop distributions continue to bundle their own shell and Rust authentication service.

## Security boundary

Business datasets remain browser-local unless a future connector is explicitly installed. The module manifest declares that it requires no business-data network access. A platform must not grant broader permissions implicitly.

The module archive is a transport format, not a trust decision. A production platform should accept only allowlisted module ids, compatible manifest versions, HTTPS release sources, and artifacts verified against release provenance or a signature policy.

## Renderer-only platform reports — 12 October 2026

For shared Scalengi data, use `entrypoints.renderer` (`scalengi-views-renderer.mjs`) and `entrypoints.rendererStylesheet`. The existing `module` entry remains compatible with the local standalone feature, but is not the entry selected by Scalengi. The new entry contains no login, identity client, IndexedDB, preferences, Structure/Data screens or dataset loading. It exports `ViewReport`, `prepareViewReport`, `viewRegistry` and `ViewRegistry`. It is currently a local candidate; release and platform consumption remain pending.

The host selects a definition and supplies authorized, validated `ViewDataset`, a controlled locale, optional toolbar actions, and a configuration derived from its repository when needed. `onOpenItem` optionally navigates from a partition detail to an authorized host object screen. The renderer never determines access rights or fetches data. On an organisation/permission change, the host must discard the old projection and remount by organisation/report identity. An empty result stays empty; configuration examples are never activated.

`ViewDefinition.report` declares whether configuration is automatic or must be provided. Collaborator, verbatim and TOGAF defaults describe display grammar, without loading sample data. Partition views, SI metamodel and radar require host-provided repository structure or explicit analysis choices. The host first tries to derive them from typed metadata. Guided advanced controls appear only for choices that cannot be inferred; a missing mapping must not silently fall back to a demonstration structure. Definitions without report metadata require explicit configuration.

Scalengi owns filters, element selection and saved recipes. A saved recipe stores intent and stable references, not copied rows or extra credentials; each reopen reprojects under current rights. Renderer exploration (camera, temporary selection, legend) does not change business data.

Renderer styles are shared with standalone, scoped to `.scalengi-views-surface` / `.app-shell`. Public embedding tokens accept resolved CSS colours: `--scalengi-views-background`, `--scalengi-views-surface`, `--scalengi-views-secondary`, `--scalengi-views-foreground`, `--scalengi-views-muted`, `--scalengi-views-border`, `--scalengi-views-primary`. Host logo, sidebar, account and organisation controls are never recreated in the report. React remains external to avoid a second runtime.

Validation: `pnpm test` builds both entries and checks renderer behavior and the final bundle for standalone identity/storage. Platform CRUD, saved recipe persistence, authorised projections and browser parity are separate completion criteria, not implied by a successful package build.
