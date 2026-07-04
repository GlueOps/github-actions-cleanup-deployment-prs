import { parseMarker, isSuperseded, DeployMeta } from "../src/lib";

const marker = (m: DeployMeta) => `<!-- glueops-deploy:${JSON.stringify(m)} -->`;

describe("parseMarker", () => {
  it("extracts app/env/tag from a deploy PR body", () => {
    const body = `deploy\n\n${marker({ app: "api", env: "prod", tag: "v1.2.3-rc1" })}`;
    expect(parseMarker(body)).toEqual({ app: "api", env: "prod", tag: "v1.2.3-rc1" });
  });
  it("returns null for non-deploy / empty / malformed bodies", () => {
    expect(parseMarker("a normal human PR")).toBeNull();
    expect(parseMarker(null)).toBeNull();
    expect(parseMarker(undefined)).toBeNull();
    expect(parseMarker("<!-- glueops-deploy:not-json -->")).toBeNull(); // no braces → no regex match
  });
  it("returns null when the JSON is well-formed-looking but invalid (catch path)", () => {
    // matches the {...} regex but is not valid JSON → JSON.parse throws
    expect(parseMarker("<!-- glueops-deploy:{bad json} -->")).toBeNull();
  });
  it("returns null when the marker JSON is missing required fields", () => {
    expect(parseMarker('<!-- glueops-deploy:{"app":"api"} -->')).toBeNull();
    expect(parseMarker('<!-- glueops-deploy:{"app":"a","env":"e","tag":5} -->')).toBeNull();
  });
});

describe("isSuperseded", () => {
  const api = (env: string, tag: string): DeployMeta => ({ app: "api", env, tag });

  it("supersedes an older same-app+env PR with a different tag", () => {
    expect(isSuperseded(api("prod", "v2"), 20, api("prod", "v1"), 15)).toBe(true);
  });
  it("does NOT cross environments (staging must not close prod)", () => {
    expect(isSuperseded(api("stage", "v2"), 20, api("prod", "v1"), 15)).toBe(false);
  });
  it("does NOT cross apps", () => {
    expect(
      isSuperseded({ app: "api", env: "prod", tag: "v2" }, 20, { app: "ui", env: "prod", tag: "v1" }, 15),
    ).toBe(false);
  });
  it("distinguishes hyphenated tags (does not treat rc1 as equal)", () => {
    expect(isSuperseded(api("prod", "2.0.0-rc1"), 20, api("prod", "1.0.0-rc1"), 15)).toBe(true);
  });
  it("never closes a newer PR (number gate)", () => {
    expect(isSuperseded(api("prod", "v2"), 10, api("prod", "v1"), 15)).toBe(false);
  });
  it("ignores identical tags", () => {
    expect(isSuperseded(api("prod", "v1"), 20, api("prod", "v1"), 15)).toBe(false);
  });
  it("equal PR numbers are never superseded", () => {
    expect(isSuperseded(api("prod", "v2"), 20, api("prod", "v1"), 20)).toBe(false);
  });
  // DOCUMENTED BEHAVIOR: "newer" is decided purely by PR NUMBER, not tag order.
  // A rollback (re-deploying an older tag) gets a HIGHER PR number, so it closes
  // the PR carrying the newer tag. Intentional — PR-number monotonicity is the
  // clock. Pinned here so it's a decision, not an accident.
  it("a rollback (older tag, higher PR number) supersedes the newer-tag PR", () => {
    expect(isSuperseded(api("prod", "v1"), 30, api("prod", "v2"), 20)).toBe(true);
  });
});

// The EXACT marker string below is the contract between the bump action's
// formatMarker() and this action's parseMarker(). An identical GOLDEN_MARKER
// lives in github-actions-bump-deployment-tag/__tests__/lib.test.ts — if either
// repo changes the marker format, its own test breaks against this frozen golden.
const GOLDEN_MARKER =
  '<!-- glueops-deploy:{"app":"api","env":"prod","tag":"v1.2.3-rc1"} -->';

describe("marker contract (golden fixture shared with the bump action)", () => {
  it("parses the frozen golden marker", () => {
    expect(parseMarker(GOLDEN_MARKER)).toEqual({
      app: "api",
      env: "prod",
      tag: "v1.2.3-rc1",
    });
  });
  it("parses the golden marker embedded in surrounding PR body text", () => {
    expect(parseMarker(`PR text\n\n${GOLDEN_MARKER}\n`)).toEqual({
      app: "api",
      env: "prod",
      tag: "v1.2.3-rc1",
    });
  });
});
