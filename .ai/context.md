# Context: what this action does

`cleanup-deployment-prs` is the **consumer/janitor** half of GlueOps Continuous Delivery. It
keeps a `deployment-configurations` repo tidy by closing deploy PRs that a newer deploy has
made obsolete, so they don't stack up.

## The flow

1. The **bump** action opens a deploy PR in the config repo (carrying a `glueops-deploy`
   marker). That PR event triggers this action (`on: pull_request`).
2. This action reads the trigger PR's marker, lists the other open PRs, and closes +
   deletes the branch of any that are **superseded**.
3. Runs on the built-in `GITHUB_TOKEN` — it operates on its **own** repo, so no App/PAT is
   needed. (Deploy PRs must be opened by an App/PAT, though, because `GITHUB_TOKEN`-authored
   PRs don't trigger this `pull_request` workflow — bump uses an App token.)

## The supersession rule (`isSuperseded` in `src/lib.ts`)

A candidate open PR is closed **iff** it has the marker **and** `same app` **and**
`same env` **and** `different tag` **and** `candidate PR number < trigger PR number`. So a
newer deploy supersedes *older* same-app+env deploy PRs. PR number is the recency clock
(this correctly handles rollbacks: a new PR with an older tag still wins).

## The safety guarantee (do not weaken)

Cleanup classifies deploy PRs **solely** by the `glueops-deploy` marker
(`<!-- glueops-deploy:{"app","env","tag"} -->`). Any PR **without** the marker — a human PR,
an unrelated bot — is ignored entirely, both as the trigger and as a candidate, so it can
never be closed/deleted. The marker format is a byte-for-byte contract with the bump action:
the golden lives in `__tests__/marker.golden` (identical in both repos) and a CI parity check
fails if they drift. See [related-repos.md](./related-repos.md).

## Source layout

`src/lib.ts` = pure logic (`parseMarker`, `isSuperseded` — unit tested). `src/run.ts` = the
orchestration (`run(deps)` with an injected Octokit; per-PR failure isolation). `src/main.ts`
= thin ncc entrypoint. Tests inject a fake Octokit.
