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
