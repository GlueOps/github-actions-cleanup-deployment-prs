# .ai/

Extra orientation for AI coding tools working in this repo. The human-facing doc is the root
[README.md](../README.md) (usage + contributing/Development); this folder holds
agent-oriented context that complements it without duplicating.

- [context.md](./context.md) — what this action does, the CD system it's part of, and the
  marker contract + safety guarantee.
- [related-repos.md](./related-repos.md) — the sibling repos and how they connect.
- [glossary.md](./glossary.md) — domain terms.

Entry point is [AGENTS.md](../AGENTS.md) at the repo root, which imports the essentials from
here.

## Planned

- `using-this-action.md` — a **consumer-facing guide for AI agents wiring this action into a
  workflow** (the `pull_request` trigger, `pr_number` + `gh_token` inputs, the App-token
  requirement on deploy PRs, common mistakes). Until it lands, the [README.md](../README.md)
  *Inputs / Usage / Notes* sections are authoritative. When adding it, link it here and from
  [AGENTS.md](../AGENTS.md).
