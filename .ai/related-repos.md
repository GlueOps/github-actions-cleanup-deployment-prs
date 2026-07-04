# Related repos

| Repo | Relationship |
|------|--------------|
| [github-actions-bump-deployment-tag](https://github.com/GlueOps/github-actions-bump-deployment-tag) | The **producer** of the marker this action reads. Runs in an app repo, mints a scoped App token, and opens the deploy PRs this action later closes. Shares the `marker.golden` wire contract (CI parity-checked). |
| [e2e-github-actions-deployment-configurations](https://github.com/GlueOps/e2e-github-actions-deployment-configurations) | The throwaway end-to-end test repo that runs this action (and bump) against real GitHub, hourly — including the cross-app / cross-env / marker-less-PR isolation assertions. It can pin `cleanup_ref` to a branch/PR to test an unmerged change before merging. |
| `deployment-configurations` (per-tenant) | The GitOps config repo this action runs **inside** (on `pull_request`), watched by ArgoCD. |

This action needs **no GitHub App** — it uses the config repo's own `GITHUB_TOKEN`. Only the
bump action needs the App (to open PRs that trigger this workflow).
