# Repository maintenance

## The role of `main`

`main` always contains a complete, tested, and releasable version of Scalengi Views. There is no permanent `develop` branch: changes live on short-lived branches and are integrated through pull requests.

Merging into `main` does not automatically create a release. Publishing is an explicit action represented by a SemVer tag created by the maintainer, for example `v0.1.0-alpha.2`. The release workflow rejects a tag whose commit does not belong to `main`.

## Change lifecycle

1. For community contributions, create an issue and obtain the `status: accepted` label.
2. Create a short-lived branch: `feat/…`, `fix/…`, `docs/…`, `refactor/…`, `test/…`, or `chore/…`.
3. Open a pull request to `main`.
4. Wait for the `Quality` CI check, resolve conversations, and perform visual verification when relevant.
5. The maintainer merges with **squash**.
6. GitHub automatically deletes the merged branch.

Direct and forced pushes to `main` are forbidden. The branch requires a linear history, up-to-date CI, and resolved conversations, including for the maintainer.

## Versions and releases

The detailed lifecycle is documented in [`VERSIONING.md`](VERSIONING.md). In summary:

```bash
pnpm version:set 0.1.0-alpha.2
pnpm version:check
```

After the version-preparation pull request is merged into `main`, the maintainer creates the exact `v<version>` tag. GitHub Actions then builds the installers and creates the corresponding GitHub Release. A published tag or release is never moved or replaced.

## Dependencies

Dependabot checks npm dependencies once a month and groups them into a single pull request. GitHub Actions updates are grouped into a separate monthly pull request. Every batch follows the same checks as product code; no update is merged merely because it is automated.

Major updates or overly broad batches may be closed and handled manually in coherent groups. Security alerts are handled separately and with priority.

## Cleanup

- a merged branch is deleted automatically;
- a branch associated with a closed pull request is deleted when the pull request is closed;
- a branch with no pull request or useful activity is deleted after its content is reviewed;
- `main` and branches associated with active pull requests are never deleted;
- generated artefacts, secrets, and business data are never committed.
