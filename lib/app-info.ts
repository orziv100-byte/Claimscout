export const APP_NAME = "Claim Scout";
export const APP_VERSION = "0.1.0";
export const COPYRIGHT = "© 2026 Claim Scout. All rights reserved.";
export const BETA_STAGES = {
  1: { name: "Stage 1", cap: 10, summary: "First 10 invited testers." },
  2: { name: "Stage 2", cap: 20, summary: "Expand after Stage 1 issues are reviewed." },
  3: { name: "Stage 3", cap: 50, summary: "Expand after stability is confirmed." },
} as const;

export type BetaStage = keyof typeof BETA_STAGES;

export function stageCap(stage: BetaStage): number {
  const override = Number(process.env.CLAIM_SCOUT_BETA_STAGE_CAP);
  if (Number.isFinite(override) && override > 0) return override;
  return BETA_STAGES[stage].cap;
}
