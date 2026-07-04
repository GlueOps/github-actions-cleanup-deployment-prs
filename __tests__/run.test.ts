import { run, CleanupDeps, CleanupOctokit } from "../src/run";

const marker = (app: string, env: string, tag: string) =>
  `<!-- glueops-deploy:${JSON.stringify({ app, env, tag })} -->`;

const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { status });

interface Pr {
  number: number;
  body: string | null;
  head: { ref: string };
}

function makeOctokit(triggerBody: string | null, openPrs: Pr[]) {
  const get = jest.fn().mockResolvedValue({ data: { body: triggerBody } });
  const update = jest.fn().mockResolvedValue({});
  const deleteRef = jest.fn().mockResolvedValue({});
  const paginate = jest.fn().mockResolvedValue(openPrs);
  const octokit = {
    rest: { pulls: { get, list: {}, update }, git: { deleteRef } },
    paginate,
  };
  return { octokit, get, update, deleteRef, paginate };
}

function deps(inputs: Record<string, string>, octokit: unknown): CleanupDeps {
  const core = {
    getInput: (n: string, o?: { required?: boolean }) => {
      const v = inputs[n] ?? "";
      if (o?.required && !v) throw new Error(`missing required input: ${n}`);
      return v;
    },
    info: jest.fn(),
  };
  return {
    core: core as unknown as CleanupDeps["core"],
    context: { repo: { owner: "acme", repo: "deployment-configurations" } },
    octokit: octokit as CleanupOctokit,
  };
}

describe("cleanup run()", () => {
  it("rejects an invalid pr_number before any API call", async () => {
    const { octokit, get, paginate } = makeOctokit(null, []);
    await expect(run(deps({ pr_number: "abc" }, octokit))).rejects.toThrow(
      /invalid pr_number/,
    );
    expect(get).not.toHaveBeenCalled();
    expect(paginate).not.toHaveBeenCalled();
  });

  it("does nothing when the trigger PR has no deploy marker (the safety guard)", async () => {
    const { octokit, update, deleteRef, paginate } = makeOctokit("just a human PR", [
      { number: 5, body: marker("api", "prod", "v1"), head: { ref: "x/y" } },
    ]);
    await run(deps({ pr_number: "20" }, octokit));
    expect(paginate).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(deleteRef).not.toHaveBeenCalled();
  });

  it("closes + deletes ONLY genuinely superseded deploy PRs", async () => {
    const prs: Pr[] = [
      { number: 20, body: marker("api", "prod", "v2"), head: { ref: "s/update-prod-image-tag-v2" } }, // trigger itself → skip
      { number: 15, body: marker("api", "prod", "v1"), head: { ref: "s/update-prod-image-tag-v1" } }, // superseded ✓
      { number: 14, body: marker("ui", "prod", "v1"), head: { ref: "s/update-ui-prod-image-tag-v1" } }, // different app ✗
      { number: 13, body: marker("api", "stage", "v1"), head: { ref: "s/update-stage-image-tag-v1" } }, // different env ✗
      { number: 12, body: "human PR, no marker", head: { ref: "docs/foo" } }, // no marker ✗
      { number: 30, body: marker("api", "prod", "v3"), head: { ref: "s/update-prod-image-tag-v3" } }, // newer PR ✗
    ];
    const { octokit, update, deleteRef } = makeOctokit(marker("api", "prod", "v2"), prs);
    await run(deps({ pr_number: "20" }, octokit));

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ pull_number: 15, state: "closed" }),
    );
    expect(deleteRef).toHaveBeenCalledTimes(1);
    expect(deleteRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "heads/s/update-prod-image-tag-v1" }),
    );
  });

  it("tolerates a 422 from deleteRef (branch already gone)", async () => {
    const prs: Pr[] = [{ number: 10, body: marker("api", "prod", "v1"), head: { ref: "b1" } }];
    const { octokit, update, deleteRef } = makeOctokit(marker("api", "prod", "v2"), prs);
    deleteRef.mockRejectedValueOnce(httpError(422));
    await expect(run(deps({ pr_number: "20" }, octokit))).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("isolates a failing PR, still processes the rest, then fails with a summary", async () => {
    const prs: Pr[] = [
      { number: 10, body: marker("api", "prod", "v1"), head: { ref: "b1" } },
      { number: 11, body: marker("api", "prod", "v0"), head: { ref: "b2" } },
    ];
    const { octokit, update, deleteRef } = makeOctokit(marker("api", "prod", "v2"), prs);
    // first PR's delete fails with a non-422 → must NOT abort the loop
    deleteRef.mockRejectedValueOnce(httpError(500)).mockResolvedValueOnce({});
    await expect(run(deps({ pr_number: "20" }, octokit))).rejects.toThrow(
      /cleanup failed for 1 PR/,
    );
    // both superseded PRs were still attempted
    expect(update).toHaveBeenCalledTimes(2);
    expect(deleteRef).toHaveBeenCalledTimes(2);
  });
});
