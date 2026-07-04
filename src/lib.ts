/**
 * Metadata that github-actions-bump-deployment-tag embeds in every deploy PR
 * body. Cleanup matches PRs on this structured data instead of reverse-parsing
 * branch names (which is lossy for hyphenated tags and app-name overrides).
 * The marker format is a shared contract with the bump action.
 */
export interface DeployMeta {
  app: string;
  env: string;
  tag: string;
}

// Capture the whole payload, not just up to the first `}` — a `}` inside a JSON string
// value (an app/env containing one) must not truncate the capture. `s` lets `.` cross
// newlines defensively; JSON.parse validates. Must stay in lock-step with the bump action.
const MARKER_RE = /<!--\s*glueops-deploy:(.+?)\s*-->/s;

export function parseMarker(body: string | null | undefined): DeployMeta | null {
  if (!body) return null;
  const m = body.match(MARKER_RE);
  if (!m) return null;
  try {
    const o = JSON.parse(m[1].trim()) as Record<string, unknown>;
    if (
      typeof o.app === "string" &&
      typeof o.env === "string" &&
      typeof o.tag === "string"
    ) {
      return { app: o.app, env: o.env, tag: o.tag };
    }
  } catch {
    /* malformed marker -> treat as absent */
  }
  return null;
}

/** True if `candidate` is superseded by the trigger deploy PR. */
export function isSuperseded(
  trigger: DeployMeta,
  triggerPrNumber: number,
  candidate: DeployMeta,
  candidatePrNumber: number,
): boolean {
  return (
    trigger.app === candidate.app &&
    trigger.env === candidate.env &&
    trigger.tag !== candidate.tag &&
    triggerPrNumber > candidatePrNumber
  );
}
