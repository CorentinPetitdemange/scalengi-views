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
