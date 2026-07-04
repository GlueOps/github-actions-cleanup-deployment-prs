# github-actions-cleanup-deployment-prs

Keep the GlueOps `deployment-configurations` repo tidy by closing **superseded** deploy PRs so they don't stack up.

Runs **in the `deployment-configurations` repo** on `pull_request`. A TypeScript `node24` action that, using the GitHub API only: when [`github-actions-bump-deployment-tag`](https://github.com/GlueOps/github-actions-bump-deployment-tag) opens a new deploy PR, it looks at the other open PRs and, for any with the **same app + same environment but a different (older) tag and a lower PR number**, closes the PR and deletes its branch. Only the latest deploy PR per app+env survives.

## Matching is metadata-based (not branch-name parsing)

Each deploy PR body carries a machine-readable marker written by the bump action:

```
<!-- glueops-deploy:{"app":"api","env":"prod","tag":"v1.2.3-rc1"} -->
```

Cleanup groups PRs by the `app`/`env`/`tag` in that marker. This is deliberate:
- **It only ever touches genuine deploy PRs.** A PR without the marker (a human PR, etc.) is ignored entirely — both as the trigger and as a candidate — so it can never close/delete an unrelated PR.
- **It's correct for hyphenated tags and app-name overrides**, which the old reverse-parse-the-branch-name approach got wrong (e.g. truncating `v1.2.3-rc1`, or mistaking an app override for the environment).

The marker format is a shared contract with `github-actions-bump-deployment-tag`.

## Why `node24`

Runs on both GitHub-hosted and self-hosted runners with no Docker and no preinstalled tooling (the runner's bundled Node is enough). (`node20` reached end-of-life in April 2026.)

## Inputs

| Input | Required | Description |
|---|---|---|
| `pr_number` | yes | The PR number that triggered the run (`${{ github.event.pull_request.number }}`). |
| `gh_token` | yes | GitHub API token — the built-in `${{ secrets.GITHUB_TOKEN }}` is sufficient (same-repo). |

## Usage

```yaml
on:
  pull_request:
    types: [opened, reopened, synchronize]

permissions:
  contents: write        # delete superseded branches
  pull-requests: write   # close superseded PRs

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: GlueOps/github-actions-cleanup-deployment-prs@v0.0.0 # x-release-please-version
        with:
          pr_number: ${{ github.event.pull_request.number }}
          gh_token: ${{ secrets.GITHUB_TOKEN }}
```

See [`examples/`](./examples).

## Notes

- Uses the built-in `GITHUB_TOKEN` (no App/PAT) because it operates on its **own** repo.
- Requires that deploy PRs are opened by an App or PAT token — `GITHUB_TOKEN`-authored PRs do **not** trigger this `pull_request` workflow. `github-actions-bump-deployment-tag` uses an App token, which does.
- Matches PRs on the embedded deploy marker (see above), not the branch name.

## No Marketplace publishing required

Usable directly via `uses:`. If private/internal, enable *Settings → Actions → General → Access* for org repos.

## Development

```bash
docker run --rm -v "$PWD":/app -w /app node:24-bookworm-slim \
  sh -c "npm ci --ignore-scripts && npm run typecheck && npm test && npm run build"
```

`dist/index.js` is a committed `ncc` bundle that GitHub runs directly. **You never hand-build it:** `build-dist.yml` rebuilds and commits it on every PR (incl. Renovate PRs) and self-heals `main`; `ci.yml` validates source only (typecheck + Jest + `npm audit`, plus a cross-repo marker-contract check with the bump action) and asserts `.nvmrc` matches the action runtime. Deps pinned via `package-lock.json`; toolchain exact-pinned (`.nvmrc`, `ncc`, `typescript`); the org Renovate bot keeps them updated.

> Note on required checks: the `dist` auto-commit is pushed with `GITHUB_TOKEN`, which doesn't re-trigger workflows, so a runtime-dep PR's final commit has no fresh `validate` run. If you enforce required checks, that can block the merge until CI re-runs — either merge manually (reviewed) or push `dist` from a GitHub App token. Releases are cut by release-please (Conventional Commits) and attach build provenance. Pure logic is in `src/lib.ts` (unit-tested).
