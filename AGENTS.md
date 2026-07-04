# AGENTS.md

`github-actions-cleanup-deployment-prs` — a **node24 TypeScript GitHub Action**. It runs
**inside** a GlueOps `deployment-configurations` repo on `pull_request` and closes
**superseded** deploy PRs (same app + env, older tag, lower PR number) and deletes their
branches, using the built-in `GITHUB_TOKEN`.

## Before you touch anything

- **`dist/index.js` is a committed [`ncc`](https://github.com/vercel/ncc) bundle that
  GitHub runs directly — never hand-edit it.** Change `src/`; `build-dist.yml` rebuilds and
  commits `dist/` on every PR.
- **It only ever acts on PRs carrying the `glueops-deploy` marker — never human or
  unrelated-bot PRs.** This is the core safety guarantee; don't weaken the marker gating.
- **The marker is a wire contract shared byte-for-byte with the bump action**
  (`__tests__/marker.golden`, enforced by a CI "marker contract parity" check). Never change
  the format on one side only — update both repos and the golden together.
- **The node runtime must match:** `.nvmrc` major == `action.yml` `using: node24` (CI
  asserts it) — bump them together.
- All `npm ci` uses `--ignore-scripts`; commit messages are **Conventional Commits**
  (release-please cuts releases + plain `vX.Y.Z` tags); build/test tooling runs in Docker.

## Where to look

- **Usage, inputs, and contributing/Development → [README.md](./README.md).**
  (The README's *Development* section is the authoritative contributor guide.)
- **Deeper agent-oriented context → [`.ai/`](./.ai/)** (imported essentials below).

@.ai/context.md
@.ai/glossary.md
