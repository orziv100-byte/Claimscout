import type { DeadlineStatus } from "./types.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export function describeDeadline(
  iso: string | undefined,
  now = Date.now(),
): { deadline: string; deadlineStatus: DeadlineStatus; deadlineLabel: string } {
  if (!iso) {
    return { deadline: "", deadlineStatus: "none", deadlineLabel: "No published deadline" };
  }
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) {
    return { deadline: iso, deadlineStatus: "none", deadlineLabel: "Deadline not parseable" };
  }
  const remaining = at - now;
  if (remaining <= 0) {
    return { deadline: iso, deadlineStatus: "expired", deadlineLabel: "Claim window closed" };
  }
  const days = remaining / DAY_MS;
  if (days <= 1) {
    return { deadline: iso, deadlineStatus: "closing", deadlineLabel: "24 hours remaining" };
  }
  if (days <= 7) {
    return { deadline: iso, deadlineStatus: "closing", deadlineLabel: "7 days remaining" };
  }
  if (days <= 30) {
    return { deadline: iso, deadlineStatus: "open", deadlineLabel: "30 days remaining" };
  }
  return { deadline: iso, deadlineStatus: "open", deadlineLabel: `Open until ${iso.slice(0, 10)}` };
}

export function estimateRoi(input: {
  amount?: string;
  priceUsd?: number;
  feeUsd?: number;
  includeFees: boolean;
}): {
  estimatedValueUsd?: number;
  estimatedFeesUsd?: number;
  estimatedNetUsd?: number;
  roiConfidence: "none" | "low" | "medium" | "high";
} {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || input.priceUsd == null || !Number.isFinite(input.priceUsd)) {
    return { roiConfidence: "none" };
  }
  const estimatedValueUsd = roundUsd(amount * input.priceUsd);
  if (!input.includeFees || input.feeUsd == null || !Number.isFinite(input.feeUsd)) {
    return { estimatedValueUsd, roiConfidence: "medium" };
  }
  const estimatedFeesUsd = roundUsd(input.feeUsd);
  return {
    estimatedValueUsd,
    estimatedFeesUsd,
    estimatedNetUsd: roundUsd(estimatedValueUsd - estimatedFeesUsd),
    roiConfidence: "high",
  };
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}
