import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { run, CleanupOctokit } from "./run";

// Thin ncc entrypoint: assemble real dependencies and hand off to run().
async function main(): Promise<void> {
  const token = core.getInput("gh_token", { required: true });
  await run({
    core,
    context: { repo: context.repo },
    octokit: getOctokit(token) as unknown as CleanupOctokit,
  });
}

main().catch((e) => core.setFailed(e instanceof Error ? e.message : String(e)));

// Compile-time contract: the real Octokit must stay assignable to the narrow
// CleanupOctokit view that run.ts + the test fake depend on. If an @actions/github or
// @octokit bump breaks this, reconcile the interface rather than widening the cast above.
// Type-only — erased at build; costs nothing at runtime.
type AssertAssignable<Sub extends Sup, Sup> = Sub;
type _CleanupOctokitContract = AssertAssignable<
  ReturnType<typeof getOctokit>,
  CleanupOctokit
>;
