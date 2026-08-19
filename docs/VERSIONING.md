# Versioning

Scalengi Views follows [Semantic Versioning](https://semver.org/) with an explicit prerelease channel.

## Channels

- `0.1.0-alpha.1`: active development; contracts and data may still change;
- `0.1.0-beta.1`: stabilised functional scope and broader validation;
- `0.1.0-rc.1`: stable-release candidate with blocker fixes only;
- `0.1.0`: stable release.

Incrementing the suffix publishes a new iteration of the same channel. A breaking change increments the major version after the first stable release.

## Single source and validation

The version is displayed in the application and must remain identical in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and the local package entry in `src-tauri/Cargo.lock`.

```bash
pnpm version:check
pnpm version:set 0.1.0-alpha.2
```

`version:set` rejects unsupported formats and version regressions. `version:check` blocks CI and releases when versions diverge.

## Publishing

1. Prepare the version with `pnpm version:set <version>`.
2. Describe the changes in `CHANGELOG.md`.
3. Validate `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, and `pnpm desktop:check`.
4. Merge into `main`.
5. Create and push the exact `v<version>` tag.

The GitHub workflow then builds the installers and publishes the GitHub Release. Tags with a suffix are automatically marked as prereleases; stable tags are published as regular releases. The README `/releases/latest` link intentionally points to the latest stable release. During alpha, the macOS button therefore targets the general releases page so that prereleases remain visible.

A published release and tag are never replaced. A fix always produces a new version.
