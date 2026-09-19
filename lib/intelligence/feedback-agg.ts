import { listFeedback } from "../feedback.ts";
import type { FeedbackType } from "../beta-types.ts";
import { sourceTierOverrides, tierForSource } from "./reputation.ts";

export const LEAD_FEEDBACK_TYPES = [
  "useful",
  "already_knew",
  "not_relevant",
  "expired",
  "broken_link",
  "suspicious",
  "claimed_successfully",
  "report_problem",
] as const;

export type FeedbackAggregate = {
  source: string;
  total: number;
  byType: Record<string, number>;
  currentTier: string;
  override: string | null;
};

export function aggregateFeedbackBySource(): FeedbackAggregate[] {
  const rows = listFeedback();
  const map = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const source = row.source || "unknown";
    const bucket = map.get(source) ?? {};
    bucket[row.type] = (bucket[row.type] ?? 0) + 1;
    bucket.total = (bucket.total ?? 0) + 1;
    map.set(source, bucket);
  }
  const overrides = sourceTierOverrides();
  return [...map.entries()]
    .map(([source, byType]) => ({
      source,
      total: byType.total ?? 0,
      byType: Object.fromEntries(Object.entries(byType).filter(([key]) => key !== "total")),
      currentTier: tierForSource(source),
      override: overrides[source] ?? null,
    }))
    .sort((a, b) => b.total - a.total);
}

export function feedbackDoesNotAutoTrust(type: FeedbackType | string): true {
  void type;
  return true;
}
