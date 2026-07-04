import type * as coreNS from "@actions/core";
import { parseMarker, isSuperseded } from "./lib";

/** Narrow structural view of the Octokit surface this action uses — keeps the
 * injected fake trivial and avoids leaning on Octokit's full types. */
export interface CleanupOctokit {
  rest: {
    pulls: {
      get(p: { owner: string; repo: string; pull_number: number }): Promise<{
        data: { body?: string | null };
      }>;
      list: unknown; // route object passed to paginate()
      update(p: {
        owner: string;
        repo: string;
        pull_number: number;
        state: "closed";
      }): Promise<unknown>;
    };
    git: {
      deleteRef(p: { owner: string; repo: string; ref: string }): Promise<unknown>;
    };
  };
  paginate(
    route: unknown,
    params: unknown,
  ): Promise<Array<{ number: number; body?: string | null; head: { ref: string } }>>;
}

export interface CleanupDeps {
  core: Pick<typeof coreNS, "getInput" | "info">;
  context: { repo: { owner: string; repo: string } };
  octokit: CleanupOctokit;
}

function httpStatus(e: unknown): number | undefined {
  if (e && typeof e === "object" && "status" in e) {
    const s = (e as { status?: unknown }).status;
    if (typeof s === "number") return s;
  }
  return undefined;
}

export async function run(deps: CleanupDeps): Promise<void> {
  const { core, context, octokit } = deps;

  const raw = core.getInput("pr_number", { required: true });
  const prNumber = Number.parseInt(raw, 10);
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error(`invalid pr_number: '${raw}'`);
  }
  const { owner, repo } = context.repo;

  const { data: triggerPr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  // Only genuine deploy PRs carry the marker. Anything else (human PRs, etc.)
  // is ignored entirely — this is the guard against touching unrelated PRs.
  const trigger = parseMarker(triggerPr.body);
  if (!trigger) {
    core.info(
      `PR #${prNumber} is not a GlueOps deploy PR (no marker); nothing to clean up.`,
    );
    return;
  }
  core.info(
    `Trigger deploy PR #${prNumber}: app=${trigger.app} env=${trigger.env} tag=${trigger.tag}`,
  );

  const openPrs = await octokit.paginate(octokit.rest.pulls.list, {
    owner,
    repo,
    state: "open",
    per_page: 100,
  });

  // Per-PR isolation: one PR's failure must NOT leave the remaining superseded
  // PRs half-cleaned. Record failures and continue; fail at the end with a summary.
  const failures: string[] = [];
  for (const pr of openPrs) {
    if (pr.number === prNumber) continue;
    const meta = parseMarker(pr.body);
    if (!meta) continue; // not a deploy PR
    if (!isSuperseded(trigger, prNumber, meta, pr.number)) continue;

    core.info(
      `Closing superseded deploy PR #${pr.number} (app=${meta.app} env=${meta.env} tag=${meta.tag})`,
    );
    try {
      await octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: pr.number,
        state: "closed",
      });
      try {
        await octokit.rest.git.deleteRef({ owner, repo, ref: `heads/${pr.head.ref}` });
      } catch (e) {
        if (httpStatus(e) !== 422) throw e; // 422 = branch already gone
        core.info(`Branch ${pr.head.ref} already deleted.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      core.info(`Failed to clean up PR #${pr.number}: ${msg}`);
      failures.push(`#${pr.number}: ${msg}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `cleanup failed for ${failures.length} PR(s): ${failures.join("; ")}`,
    );
  }
}
