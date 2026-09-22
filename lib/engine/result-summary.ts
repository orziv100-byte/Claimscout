import { isAddressHoldingFinding } from "./profile.ts";
import type { EngineFinding } from "./types.ts";

export type UserCheckLabel =
  | "Eligible"
  | "Not eligible"
  | "Already claimed"
  | "Window closed"
  | "Unable to verify"
  | "Balance on this wallet"
  | "Leftover position"
  | "Check failed"
  | "Uncertain";

export function userCheckLabel(finding: Pick<EngineFinding, "category" | "eligibility" | "sourceStatus" | "amount">): UserCheckLabel {
  if (finding.sourceStatus === "failed") return "Check failed";
  if (finding.eligibility === "eligible") return "Eligible";
  if (finding.eligibility === "ineligible") return "Not eligible";
  if (finding.eligibility === "already_claimed") return "Already claimed";
  if (finding.eligibility === "window_closed") return "Window closed";
  if (finding.eligibility === "unable_to_verify") return "Unable to verify";
  if (finding.category === "protocol_claim") {
    return Number(finding.amount) > 0 ? "Leftover position" : "Unable to verify";
  }
  if (finding.category === "native_balance" || finding.category === "forgotten_token") {
    return Number(finding.amount) > 0 ? "Balance on this wallet" : "Unable to verify";
  }
  return "Uncertain";
}

export type ScanHeadline = {
  claimNow: number;
  alreadyClaimed: number;
  notEligible: number;
  windowClosed: number;
  holdings: number;
  leftover: number;
  unable: number;
  failed: number;
  sentence: string;
};

export function scanHeadline(findings: readonly Pick<EngineFinding, "category" | "eligibility" | "sourceStatus" | "amount">[]): ScanHeadline {
  let claimNow = 0;
  let alreadyClaimed = 0;
  let notEligible = 0;
  let windowClosed = 0;
  let holdings = 0;
  let leftover = 0;
  let unable = 0;
  let failed = 0;
  for (const row of findings) {
    if (row.sourceStatus === "failed") {
      failed += 1;
      continue;
    }
    if (row.eligibility === "eligible") {
      claimNow += 1;
      continue;
    }
    if (row.eligibility === "already_claimed") {
      alreadyClaimed += 1;
      continue;
    }
    if (row.eligibility === "ineligible") {
      notEligible += 1;
      continue;
    }
    if (row.eligibility === "window_closed") {
      windowClosed += 1;
      continue;
    }
    if (isAddressHoldingFinding(row) && row.category === "protocol_claim") {
      leftover += 1;
      continue;
    }
    if (isAddressHoldingFinding(row)) {
      holdings += 1;
      continue;
    }
    if (row.eligibility === "unable_to_verify") {
      unable += 1;
    }
  }
  const bits: string[] = [];
  if (claimNow > 0) {
    bits.push(`Found ${claimNow} official Eligible result${claimNow === 1 ? "" : "s"} to review.`);
  } else {
    bits.push("Nothing to claim on this address right now.");
  }
  if (holdings > 0) bits.push(`${holdings} balance${holdings === 1 ? "" : "s"} already in this wallet.`);
  if (leftover > 0) bits.push(`${leftover} leftover protocol position${leftover === 1 ? "" : "s"}.`);
  if (notEligible > 0) bits.push(`${notEligible} program${notEligible === 1 ? "" : "s"} not eligible.`);
  if (alreadyClaimed > 0) bits.push(`${alreadyClaimed} already claimed.`);
  if (windowClosed > 0) bits.push(`${windowClosed} claim window${windowClosed === 1 ? "" : "s"} closed.`);
  if (unable > 0) bits.push(`${unable} could not be verified at address level.`);
  if (failed > 0) bits.push(`${failed} check${failed === 1 ? "" : "s"} failed.`);
  bits.push("Verified here means the checker ran — not that money is owed.");
  return {
    claimNow,
    alreadyClaimed,
    notEligible,
    windowClosed,
    holdings,
    leftover,
    unable,
    failed,
    sentence: bits.join(" "),
  };
}
