import { readFileSync } from "node:fs";
import { join } from "node:path";
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

// The marker is the wire contract with the bump action's formatMarker(). The golden
// lives in __tests__/marker.golden — an IDENTICAL file committed in BOTH repos — and a
// CI step ("marker contract parity") diffs it against the sibling, so a one-sided change
// fails. Here we pin this action's parseMarker() to that fixture.
const golden = JSON.parse(
  readFileSync(join(__dirname, "marker.golden"), "utf8"),
) as { meta: { app: string; env: string; tag: string }; marker: string };

describe("marker contract (shared fixture with the bump action)", () => {
  it("parses the golden marker", () => {
    expect(parseMarker(golden.marker)).toEqual(golden.meta);
  });
  it("parses the golden marker embedded in surrounding PR body text", () => {
    expect(parseMarker(`PR text\n\n${golden.marker}\n`)).toEqual(golden.meta);
  });
  it("tolerates a '}' inside a field value (regex must not stop at the first brace)", () => {
    const marker = '<!-- glueops-deploy:{"app":"team}a","env":"pr}od","tag":"v1"} -->';
    expect(parseMarker(marker)).toEqual({ app: "team}a", env: "pr}od", tag: "v1" });
  });
});
