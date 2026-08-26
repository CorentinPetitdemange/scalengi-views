# Repository maintenance

This document describes the small set of maintainer tasks that are useful to contributors and release managers.

## Changes and releases

Changes are proposed through pull requests and validated by the `Quality` CI check. Visual changes also require a manual check in normal and full-screen layouts.

Merging a pull request does not publish a release. Releases use Semantic Versioning and an explicit `v<version>` tag. The complete process is documented in [`VERSIONING.md`](VERSIONING.md).

```bash
pnpm version:set 0.1.0-alpha.2
pnpm version:check
```

After the version change is merged, the maintainer creates the matching tag. GitHub Actions then builds the installers and creates the GitHub Release. Published versions and tags are never replaced; a fix always receives a new version.

## Dependencies

Dependabot proposes monthly updates for npm packages and GitHub Actions. Dependency changes use the same CI checks as product changes.

Before a release, run:

```bash
pnpm audit --prod
pnpm lint
pnpm test
pnpm desktop:check
```

Known high-severity production vulnerabilities must be resolved or documented as non-applicable before publication.
