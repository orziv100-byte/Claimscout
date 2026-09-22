import { scanTextFlags, scanUrlFlags } from "../safety.ts";
import type { VerificationFlag } from "../types.ts";
import type { EngineFinding } from "./types.ts";

export function findingSafetyFlags(finding: EngineFinding): VerificationFlag[] {
  const flags: VerificationFlag[] = [];
  if (finding.officialUrl) flags.push(...scanUrlFlags(finding.officialUrl));
  flags.push(...scanTextFlags(`${finding.title}\n${finding.detail}`));
  return flags;
}

export function applyFindingSafety(finding: EngineFinding): EngineFinding {
  const safetyFlags = findingSafetyFlags(finding);
  if (safetyFlags.length === 0) return finding;
  const danger = safetyFlags.find((flag) => flag.severity === "danger");
  if (danger) {
    return {
      ...finding,
      verification: "rejected",
      eligibility: finding.eligibility === "eligible" ? undefined : finding.eligibility,
      sourceConfidence: "unverified",
      safetyFlags,
      detail: `${finding.detail} Safety: ${danger.message}`,
    };
  }
  if (finding.sourceConfidence === "official_project" && safetyFlags.some((flag) => flag.severity === "warning")) {
    return { ...finding, sourceConfidence: "needs_review", safetyFlags };
  }
  return { ...finding, safetyFlags };
}
