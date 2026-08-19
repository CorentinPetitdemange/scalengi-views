# Contributing to Scalengi Views

Thank you for contributing to Scalengi Views. Contributions must remain aligned with the boundaries described in [`AGENTS.md`](AGENTS.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Contribution approval

Every community contribution starts with an issue. The maintainer reviews the proposal, may request clarification, and signals approval with the **`status: accepted`** label. Do not begin implementation or open a pull request before this approval.

Vulnerabilities must follow the private process described in [`SECURITY.md`](SECURITY.md) and must never be published in an issue.

## Setting up the environment

Requirements: Node.js 22.13 or later and pnpm 10.

```bash
git clone https://github.com/YOUR-ACCOUNT/scalengi-views.git
cd scalengi-views
git remote add upstream https://github.com/CorentinPetitdemange/scalengi-views.git
pnpm install --frozen-lockfile
pnpm dev
```

Create a GitHub fork first, then replace `YOUR-ACCOUNT` with your username.

## Git workflow

1. Create an issue and wait for approval with the `status: accepted` label.
2. Update your fork from `upstream/main`.
3. Create a branch in your fork: `feat/...`, `fix/...`, `docs/...`, `refactor/...`, or `chore/...`.
4. Make short, explicit commits following [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, or `chore:`.
5. Push the branch to your fork, never to `main`.
6. Open a focused pull request, reference the accepted issue, explain the value delivered, and attach a screenshot for visual changes.
7. Wait for CI, maintainer review, and resolution of all conversations.
8. The maintainer decides whether to merge. Merges use **squash**, and the branch is deleted when appropriate.

Nobody pushes directly to `main`, including the maintainer. Every change goes through a pull request, CI, and resolved review conversations. The maintainer remains solely responsible for merge and release decisions.

## Required checks

```bash
pnpm exec tsc --noEmit
pnpm version:check
pnpm lint
pnpm test
```

For a visual change, also verify the affected view in normal and full-screen layouts with no browser console errors.

## Adding a view

Follow [`docs/CREATE_A_VIEW.md`](docs/CREATE_A_VIEW.md). A view must be registered only through a complete `ViewDefinition` and must not introduce view-id branching in the shell.

## Contribution licence

By submitting a contribution, you agree that it may be distributed under the project's [MIT licence](LICENSE).
