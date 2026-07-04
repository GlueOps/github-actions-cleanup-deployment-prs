# Glossary

- **deploy PR** — a PR the bump action opens that changes `image.tag`. Identified **solely**
  by the `glueops-deploy` marker in its body, never by branch name or title.
- **marker** — the hidden `<!-- glueops-deploy:{"app","env","tag"} -->` HTML comment. The
  only thing this action keys off. A byte-for-byte contract with the bump action
  (`__tests__/marker.golden`); a `.trim()`ed JSON payload parsed by `parseMarker`.
- **superseded** — a deploy PR obsoleted by a newer one for the same app + env. Rule
  (`isSuperseded`): same app, same env, different tag, and a **lower PR number** than the
  trigger PR. Superseded PRs are closed and their branches deleted.
- **trigger PR** — the PR whose number is passed via `pr_number`; supersession is judged
  relative to it. If it has no marker, this action does nothing.
- **`pr_number`** — input: the PR that triggered the run
  (`${{ github.event.pull_request.number }}`).
- **`gh_token`** — input: the built-in `${{ secrets.GITHUB_TOKEN }}` (sufficient — same repo).
- **per-PR isolation** — one PR's close/delete failure is recorded and the rest still
  processed; the run then fails with an aggregated summary (`src/run.ts`).
- **committed `dist/`** — the `ncc` bundle GitHub runs directly from the ref; rebuilt and
  committed by `build-dist.yml`, never by hand.
