# Contributing to Scalengi Views

Thank you for helping improve Scalengi Views. Please keep changes focused and consistent with the boundaries described in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

For a substantial feature, a new view, or a connector, open an issue before starting so that the scope and approach can be discussed. Small fixes, tests, and documentation improvements may be submitted directly as pull requests.

Vulnerabilities must follow the private process described in [`SECURITY.md`](SECURITY.md) and must never be published in an issue.

## Set up the project

Requirements: Node.js 22.13 or later and pnpm 10.

```bash
git clone https://github.com/YOUR-ACCOUNT/scalengi-views.git
cd scalengi-views
pnpm install --frozen-lockfile
pnpm dev
```

Create a GitHub fork first and replace `YOUR-ACCOUNT` with your username.

## Propose a change

1. Create a short-lived branch in your fork.
2. Make one focused change with clear commits.
3. Run the required checks.
4. Open a pull request explaining the problem and the proposed solution.
5. Link the related issue when one exists and add screenshots for visual changes.

Pull requests are reviewed and validated by CI before a maintainer decides whether to merge them.

## Required checks

```bash
pnpm exec tsc --noEmit
pnpm version:check
pnpm lint
pnpm test
```

For a visual change, also verify the affected view in normal and full-screen layouts and check that the browser console contains no errors.

## Add a view

Follow [`docs/CREATE_A_VIEW.md`](docs/CREATE_A_VIEW.md). A view must be registered through a complete `ViewDefinition` and must not introduce view-specific branching in the application shell.

## Licence

The project is source-available under the [PolyForm Shield 1.0.0 licence](LICENSE), not an OSI Open Source licence. Forks and changes are permitted only for purposes allowed by that licence.

By submitting a contribution, you confirm that you have the right to provide it and grant Corentin Petitdemange a perpetual, worldwide, non-exclusive, irrevocable, royalty-free copyright licence to use, reproduce, modify, create derivative works from, publicly display, publicly perform, distribute, sublicense, and relicense that contribution under any terms. This grant allows Scalengi Views to remain available under PolyForm Shield while also supporting commercial licences and partnerships.

The pull request template requires explicit acknowledgement of these contribution terms. Do not submit a contribution if you cannot grant these rights.
